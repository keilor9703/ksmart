// ═══════════════════════════════════════════════════════════════════════════
// BotonHuella.jsx
// Botón circular estilo Wompi con icono de huella + texto debajo.
//
// Coloca en frontend/src/components/BotonHuella.jsx
// ═══════════════════════════════════════════════════════════════════════════

import React, { useState } from 'react';
import { Box, IconButton, Typography, CircularProgress, Tooltip } from '@mui/material';
import { Fingerprint } from '@mui/icons-material';
import useBiometricAuth from '../../hooks/useBiometricAuth';
import { toast } from 'react-toastify';

const HUELLA_GREEN = '#10B981';   // verde tipo Wompi (ajustable)
const DARK_BG = '#1a1f2e';

export default function BotonHuella({
  modo = 'login',
  username = null,
  onSuccess,
  onError,
  onCredentialLost,           // callback cuando la credencial ya no existe
  label,
  size = 80,
  hideIfUnsupported = true,
}) {
  const {
    isSupported,
    isPlatformAuthAvailable,
    loading,
    registerBiometric,
    loginWithBiometric,
    hasLocalCredential, // ✨ NUEVO: Importamos la bandera
  } = useBiometricAuth();

  const [hovered, setHovered] = useState(false);

  // 1. Si el dispositivo no soporta biometría y queremos ocultarlo, no renderiza
  if (hideIfUnsupported && (!isSupported || !isPlatformAuthAvailable)) {
    return null;
  }

  // ✨ 2. NUEVA REGLA: Ocultar en login si NO hay credencial guardada localmente
  if (modo === 'login' && !hasLocalCredential) {
    return null;
  }

  const handleClick = async () => {
    try {
      if (modo === 'register') {
        const result = await registerBiometric();
        toast.success(result.message || 'Huella registrada correctamente.');
        onSuccess?.(result);
      } else {
        const result = await loginWithBiometric(username);
        // No mostramos toast aquí porque el componente padre suele redirigir
        onSuccess?.(result);
      }
    } catch (err) {
      // Errores comunes y amigables
      let mensaje = 'No se pudo completar la autenticación.';
      const errMsg = err.message || err.toString();
       if (
        err.name === 'NotAllowedError' ||
        errMsg.includes('no credentials') ||
        errMsg.includes('llaves de acceso') ||
        errMsg.includes('no se encontró') ||
        err.response?.status === 401  // backend dijo "esta credencial no existe"
        ) {
            if (!errMsg.toLowerCase().includes('cancel')) {
              localStorage.removeItem('biometric_enabled');
              onCredentialLost?.();  // el padre decide cómo reaccionar, sin recarga forzada
            }
        }

      if (err.name === 'NotAllowedError' || errMsg.includes('cancel')) {
        mensaje = 'Autenticación cancelada.';
      } else if (err.name === 'InvalidStateError') {
        mensaje = 'Esta huella ya está registrada en este dispositivo.';
      } else if (err.name === 'NotSupportedError') {
        mensaje = 'Tu dispositivo no soporta este tipo de autenticación.';
      } else if (err.name === 'SecurityError') {
        mensaje = 'Error de seguridad. Verifica que estás en una conexión segura (HTTPS).';
      } else if (err.response?.data?.detail) {
        mensaje = err.response.data.detail;
      } else if (errMsg) {
        mensaje = errMsg;
      }

      // Solo mostramos toast en errores reales, no en cancelaciones
      if (!errMsg.includes('cancel') && err.name !== 'NotAllowedError') {
        toast.error(mensaje);
      }
      onError?.(err, mensaje);
    }
  };

  const labelDefault = modo === 'register' ? 'Activar huella' : 'Ingresar con huella';

  return (
    <Box sx={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 1,
      mt: 2,
    }}>
      <Tooltip title={loading ? 'Esperando huella...' : labelDefault}>
        <span>
          <IconButton
            onClick={handleClick}
            disabled={loading}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            sx={{
              width: size,
              height: size,
              bgcolor: DARK_BG,
              color: HUELLA_GREEN,
              transition: 'all 0.25s ease',
              boxShadow: hovered
                ? `0 8px 24px ${HUELLA_GREEN}50`
                : `0 4px 12px rgba(0,0,0,0.25)`,
              transform: hovered ? 'scale(1.05)' : 'scale(1)',
              '&:hover': {
                bgcolor: '#0A0A0A',
                color: HUELLA_GREEN,
              },
              '&:disabled': {
                bgcolor: DARK_BG,
                color: HUELLA_GREEN,
                opacity: 0.7,
              },
            }}
          >
            {loading ? (
              <CircularProgress size={size * 0.4} sx={{ color: HUELLA_GREEN }} />
            ) : (
              <Fingerprint sx={{ fontSize: size * 0.55 }} />
            )}
          </IconButton>
        </span>
      </Tooltip>
      <Typography sx={{
        fontSize: 13,
        fontWeight: 600,
        color: 'text.secondary',
        textAlign: 'center',
      }}>
        {label || labelDefault}
      </Typography>
    </Box>
  );
}