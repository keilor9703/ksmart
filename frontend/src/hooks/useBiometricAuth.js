// ═══════════════════════════════════════════════════════════════════════════
// useBiometricAuth.js
// Hook reutilizable que encapsula toda la lógica de WebAuthn en el frontend.
//
// Coloca este archivo en frontend/src/hooks/useBiometricAuth.js
// Si no tienes carpeta hooks, créala.
//
// Uso:
//   const { isSupported, registerBiometric, loginWithBiometric, ... } = useBiometricAuth();
// ═══════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react';
import apiClient from '../api';

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

// ── Detectar si el dispositivo soporta WebAuthn al montar ───────────────
    useEffect(() => {
      const supported = !!(
        window.PublicKeyCredential &&
        typeof navigator.credentials?.create === 'function' &&
        typeof navigator.credentials?.get === 'function'
      );
      setIsSupported(supported);

      // ✨ CORRECCIÓN: Agregamos window. a PublicKeyCredential
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
    const { data } = await apiClient.get('/auth/biometric/credentials');
    return data;
  }, []);

  const deleteCredential = useCallback(async (id) => {
    await apiClient.delete(`/auth/biometric/credentials/${id}`);
  }, []);


  return {
    isSupported,
    isPlatformAuthAvailable,
    loading,
    registerBiometric,
    loginWithBiometric,
    listCredentials,
    deleteCredential,
  };
}
