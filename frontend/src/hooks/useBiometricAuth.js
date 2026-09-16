// ═══════════════════════════════════════════════════════════════════════════
// useBiometricAuth.js
// Hook reutilizable que encapsula toda la lógica de WebAuthn en el frontend.
//
// Coloca este archivo en frontend/src/hooks/useBiometricAuth.js
// Si no tienes carpeta hooks, créala.
// ═══════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import apiClient from '../api';
import {
  nativoDisponible, registrarNativo, loginNativo, desactivarNativo,
} from '../utils/biometricNativa';
import { setBiometricUser, clearBiometricUser, getBiometricUser, normalizeUser } from '../utils/quickAccess';

// Dentro del WebView empaquetado de la app Android (Capacitor), WebAuthn no
// funciona hoy: requiere un origen HTTPS real asociado por Digital Asset
// Links, y la app carga sus assets locales (https://localhost). No es un
// problema del dispositivo/navegador del usuario — por eso NO usamos el
// mensaje genérico "prueba desde Chrome/Edge/Safari" cuando corremos dentro
// de la app nativa, para no confundir a alguien que sí tiene huella/Face ID.
const ES_APP_NATIVA = Capacitor.isNativePlatform();

// ─── Helpers de codificación base64url ←→ ArrayBuffer ──────────────────────
function base64urlToBuffer(base64url) {
  const padding = '='.repeat((4 - (base64url.length % 4)) % 4);
  const base64 = (base64url + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  const buffer = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) buffer[i] = raw.charCodeAt(i);
  return buffer.buffer;
}

function bufferToBase64url(buffer) {
  const bytes = new Uint8Array(buffer);
  let str = '';
  for (let i = 0; i < bytes.byteLength; i++) str += String.fromCharCode(bytes[i]);
  return window.btoa(str)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export default function useBiometricAuth() {
  const [isSupported, setIsSupported] = useState(false);
  const [isPlatformAuthAvailable, setIsPlatformAuthAvailable] = useState(false);
  const [loading, setLoading] = useState(false);

  // ¿Hay credencial biométrica en este dispositivo Y pertenece al usuario
  // actual? (last_username = usuario en sesión, o el último que entró). Sin
  // el chequeo de dueño, a un usuario sin huella se le ocultaba la opción de
  // registrarla solo porque OTRO la tenía en el mismo equipo.
  const [hasLocalCredential, setHasLocalCredential] = useState(() => {
    if (localStorage.getItem('biometric_enabled') !== 'true') return false;
    const owner = getBiometricUser();
    const actual = normalizeUser(localStorage.getItem('last_username'));
    return !owner || !actual || owner === actual;
  });

  // ── Detectar si el dispositivo soporta biometría al montar ──────────────
  useEffect(() => {
    if (ES_APP_NATIVA) {
      // Dentro de la app instalada usamos biometría NATIVA (BiometricPrompt /
      // Face ID) en vez de WebAuthn. Consultamos al plugin nativo.
      nativoDisponible().then(ok => {
        setIsSupported(ok);
        setIsPlatformAuthAvailable(ok);
      });
      return;
    }

    const supported = !!(
      window.PublicKeyCredential &&
      typeof navigator.credentials?.create === 'function' &&
      typeof navigator.credentials?.get === 'function'
    );
    setIsSupported(supported);

    // ✨ CORRECCIÓN APLICADA: window.PublicKeyCredential
    if (supported && window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable) {
      window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
        .then(setIsPlatformAuthAvailable)
        .catch(() => setIsPlatformAuthAvailable(false));
    }
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // REGISTRO DE CREDENCIAL (usuario ya autenticado)
  // ─────────────────────────────────────────────────────────────────────────
  const registerBiometric = useCallback(async (deviceName = null) => {
    if (!isSupported) {
      throw new Error('Tu dispositivo no soporta autenticación biométrica.');
    }
    setLoading(true);
    try {
      // App instalada → biometría nativa (Keystore + BiometricPrompt).
      if (ES_APP_NATIVA) {
        const result = await registrarNativo(deviceName);  // registra al dueño
        setHasLocalCredential(true);
        return result;
      }

      // Paso 1: pedir opciones al backend
      const { data: opts } = await apiClient.post('/auth/biometric/register/options');

      // Paso 2: convertir las opciones a formato que entienda navigator.credentials
      const publicKey = {
        ...opts,
        challenge: base64urlToBuffer(opts.challenge),
        user: {
          ...opts.user,
          id: base64urlToBuffer(opts.user.id),
        },
        excludeCredentials: (opts.excludeCredentials || []).map(c => ({
          ...c,
          id: base64urlToBuffer(c.id),
        })),
      };

      // Paso 3: pedir al navegador que cree la credencial (modal nativo del SO)
      const credential = await navigator.credentials.create({ publicKey });
      if (!credential) {
        throw new Error('No se pudo crear la credencial.');
      }

      // Paso 4: serializar la respuesta para enviar al backend
      const serialized = {
        id: credential.id,
        rawId: bufferToBase64url(credential.rawId),
        type: credential.type,
        response: {
          attestationObject: bufferToBase64url(credential.response.attestationObject),
          clientDataJSON:    bufferToBase64url(credential.response.clientDataJSON),
        },
        clientExtensionResults: credential.getClientExtensionResults?.() || {},
      };

      // Paso 5: enviar al backend para verificar y guardar
      const { data: result } = await apiClient.post('/auth/biometric/register/verify', {
        credential:  serialized,
        device_name: deviceName,
      });

      // Si el registro es exitoso, marcamos este navegador Y a qué usuario
      // pertenece la credencial (equipos compartidos: sin el dueño, el botón
      // de huella aparecía para cualquiera e iniciaba sesión con otra cuenta).
      if (result.success) {
        localStorage.setItem('biometric_enabled', 'true');
        setBiometricUser(localStorage.getItem('last_username'));
        setHasLocalCredential(true);
      }

      return result;  // { success, credential_id, device_name, message }
    } finally {
      setLoading(false);
    }
  }, [isSupported]);

  // ─────────────────────────────────────────────────────────────────────────
  // LOGIN CON HUELLA (sin sesión previa)
  // ─────────────────────────────────────────────────────────────────────────
  const loginWithBiometric = useCallback(async (username = null) => {
    if (!isSupported) {
      throw new Error('Tu dispositivo no soporta autenticación biométrica.');
    }
    setLoading(true);
    try {
      // App instalada → login con biometría nativa.
      if (ES_APP_NATIVA) {
        return await loginNativo();
      }

      // Paso 1: pedir opciones de autenticación
      const { data: opts } = await apiClient.post('/auth/biometric/login/options', {
        username,
      });

      // Paso 2: convertir
      const publicKey = {
        ...opts,
        challenge: base64urlToBuffer(opts.challenge),
        allowCredentials: (opts.allowCredentials || []).map(c => ({
          ...c,
          id: base64urlToBuffer(c.id),
        })),
      };

      // Paso 3: pedir al navegador que autentique (modal nativo)
      const assertion = await navigator.credentials.get({ publicKey });
      if (!assertion) {
        throw new Error('Autenticación cancelada.');
      }

      // Paso 4: serializar la respuesta
      const serialized = {
        id: assertion.id,
        rawId: bufferToBase64url(assertion.rawId),
        type: assertion.type,
        response: {
          authenticatorData: bufferToBase64url(assertion.response.authenticatorData),
          clientDataJSON:    bufferToBase64url(assertion.response.clientDataJSON),
          signature:         bufferToBase64url(assertion.response.signature),
          userHandle:        assertion.response.userHandle
            ? bufferToBase64url(assertion.response.userHandle)
            : null,
        },
        clientExtensionResults: assertion.getClientExtensionResults?.() || {},
      };

      // Paso 5: enviar al backend para verificar y obtener JWT
      const { data: result } = await apiClient.post('/auth/biometric/login/verify', {
        credential: serialized,
      });

      return result;  // { access_token, user_id, username, empresa_id, rol, device_name }
    } finally {
      setLoading(false);
    }
  }, [isSupported]);

  // ─────────────────────────────────────────────────────────────────────────
  // GESTIÓN DE CREDENCIALES (perfil)
  // ─────────────────────────────────────────────────────────────────────────
  const listCredentials = useCallback(async () => {
    // En la app nativa no hay lista WebAuthn en el backend: el token vive en el
    // Keystore de ESTE dispositivo. Devolvemos una entrada sintética si está
    // activada, para reutilizar la misma UI de gestión.
    if (ES_APP_NATIVA) {
      return hasLocalCredential
        ? [{ id: 'native', device_name: 'Este dispositivo', user_agent: navigator.userAgent, last_used_at: null }]
        : [];
    }
    const { data } = await apiClient.get('/auth/biometric/credentials');
    return data;
  }, [hasLocalCredential]);

//   const deleteCredential = useCallback(async (id) => {
//     await apiClient.delete(`/auth/biometric/credentials/${id}`);
    
//     // Opcional: Si el usuario borra todas sus credenciales, podrías limpiar el localStorage,
//     // pero requeriría lógica extra para saber si borró "la última" de este navegador específico.
//     // De momento, si lo borra, simplemente fallará el intento de login con huella, lo cual es seguro.
//   }, []);

const deleteCredential = useCallback(async (id) => {
  // App instalada → desactivar biometría nativa (backend + Keystore + flag).
  if (ES_APP_NATIVA) {
    await desactivarNativo();
    clearBiometricUser();
    setHasLocalCredential(false);
    return;
  }
  await apiClient.delete(`/auth/biometric/credentials/${id}`);
  // Si el usuario quedó sin credenciales, ocultar el botón en este navegador
  try {
    const restantes = await apiClient.get('/auth/biometric/credentials');
    if (restantes.data.length === 0) {
      localStorage.removeItem('biometric_enabled');
      clearBiometricUser();
      setHasLocalCredential(false);
    }
  } catch {
    // Si falla la consulta, no pasa nada
  }
}, []);

  return {
    isSupported,
    isPlatformAuthAvailable,
    loading,
    registerBiometric,
    loginWithBiometric,
    listCredentials,
    deleteCredential,
    hasLocalCredential, // ✨ NUEVO: Exportamos la bandera
    esAppNativa: ES_APP_NATIVA,
  };
}