import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, Typography, Box, Button, IconButton } from '@mui/material';
import { Close, VerifiedUser } from '@mui/icons-material';
import BotonHuella from './BotonHuella';
import useBiometricAuth from '../../hooks/useBiometricAuth';

export default function ModalHuella() {
  const [open, setOpen] = useState(false);
  const { isSupported, isPlatformAuthAvailable, hasLocalCredential } = useBiometricAuth();

  useEffect(() => {
    // Leemos si el usuario ya pidió que no lo molestemos más
    const dismissed = localStorage.getItem('biometric_promo_dismissed') === 'true';

    // REGLAS PARA MOSTRAR EL MODAL:
    // 1. El hardware lo soporta (isSupported && isPlatformAuthAvailable)
    // 2. NO tiene huella activada aún (!hasLocalCredential)
    // 3. NO ha descartado el modal permanentemente (!dismissed)
    if (isSupported && isPlatformAuthAvailable && !hasLocalCredential && !dismissed) {
      // Le damos un respiro de 1.5 segundos después del login antes de mostrar el modal
      const timer = setTimeout(() => setOpen(true), 1500);
      return () => clearTimeout(timer);
    }
  }, [isSupported, isPlatformAuthAvailable, hasLocalCredential]);

  const handleClose = () => {
    setOpen(false);
  };

  const handleDismissForever = () => {
    localStorage.setItem('biometric_promo_dismissed', 'true');
    setOpen(false);
  };

  const handleSuccess = () => {
    // Cuando el registro sea exitoso, cerramos el modal.
    // (BotonHuella ya se encarga de guardar 'biometric_enabled' en localStorage)
    setOpen(false);
  };

  return (
    <Dialog 
      open={open} 
      onClose={handleClose}
      PaperProps={{
        sx: {
          background: 'linear-gradient(160deg, #0f172a 0%, #020617 100%)',
          color: '#f1f5f9',
          borderRadius: 4,
          maxWidth: 400,
          p: 1,
          border: '1px solid rgba(34,197,94,0.2)',
          boxShadow: '0 24px 48px rgba(0,0,0,0.5)',
        }
      }}
    >
      <IconButton 
        onClick={handleClose} 
        sx={{ position: 'absolute', right: 12, top: 12, color: '#64748b' }}
      >
        <Close />
      </IconButton>

      <DialogContent sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', pt: 4 }}>
        <Box sx={{ 
          bgcolor: 'rgba(34,197,94,0.1)', 
          p: 2, 
          borderRadius: '50%', 
          mb: 2 
        }}>
          <VerifiedUser sx={{ fontSize: 48, color: '#10B981' }} />
        </Box>

        <Typography variant="h5" sx={{ fontWeight: 800, mb: 1, letterSpacing: -0.5 }}>
          Entra más rápido
        </Typography>

        <Typography sx={{ color: '#94a3b8', fontSize: 14, mb: 3, px: 2 }}>
          Activa el inicio de sesión con tu huella dactilar o reconocimiento facial para acceder de forma segura sin escribir tu contraseña.
        </Typography>

        {/* ✨ Aquí reutilizamos nuestro BotonHuella en modo registro ✨ */}
        <Box sx={{ mb: 3 }}>
          <BotonHuella 
            modo="register" 
            label="Toca para activar"
            onSuccess={handleSuccess} 
          />
        </Box>

        <Button 
          onClick={handleDismissForever}
          sx={{ 
            color: '#64748b', 
            fontSize: 12, 
            textTransform: 'none',
            '&:hover': { background: 'transparent', color: '#f87171' }
          }}
        >
          No me interesa, no volver a preguntar
        </Button>
      </DialogContent>
    </Dialog>
  );
}