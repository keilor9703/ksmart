import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog, DialogContent, DialogTitle, Box, Typography, IconButton,
  Button, Chip, CircularProgress, Divider, Tooltip, TextField,
  Alert, Tabs, Tab, Avatar, Stack,
} from '@mui/material';
import {
  Close, Fingerprint, PhoneAndroid, Laptop, Delete, Add,
  Pin, CheckCircle, Lock, LockOpen, Security, Info,
} from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';
import { toast } from 'react-toastify';
import BotonHuella from './BotonHuella';
import useBiometricAuth from '../../hooks/useBiometricAuth';
import apiClient from '../../api';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function DeviceIcon({ userAgent }) {
  const ua = (userAgent || '').toLowerCase();
  const isMobile = /iphone|android|ipad/.test(ua);
  return isMobile
    ? <PhoneAndroid sx={{ fontSize: 20 }} />
    : <Laptop sx={{ fontSize: 20 }} />;
}

function timeAgo(dateStr) {
  if (!dateStr) return 'Nunca';
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60) return 'Hace un momento';
  if (diff < 3600) return `Hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `Hace ${Math.floor(diff / 3600)} h`;
  if (diff < 2592000) return `Hace ${Math.floor(diff / 86400)} días`;
  return new Date(dateStr).toLocaleDateString('es-CO');
}

// ─── Tab: Biometría ──────────────────────────────────────────────────────────

function TabBiometria() {
  const theme = useTheme();
  const { isSupported, isPlatformAuthAvailable, listCredentials, deleteCredential } = useBiometricAuth();
  const [credentials, setCredentials] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [deletingId, setDeletingId] = useState(null);
  const [showRegister, setShowRegister] = useState(false);

  const load = useCallback(async () => {
    setLoadingList(true);
    try {
      const data = await listCredentials();
      setCredentials(data);
    } catch {
      // silencioso si el usuario no tiene credenciales
    } finally {
      setLoadingList(false);
    }
  }, [listCredentials]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id, deviceName) => {
    if (!window.confirm(`¿Eliminar la huella de "${deviceName}"? Tendrás que registrarla de nuevo en ese dispositivo.`)) return;
    setDeletingId(id);
    try {
      await deleteCredential(id);
      toast.success('Dispositivo eliminado.');
      load();
    } catch {
      toast.error('No se pudo eliminar el dispositivo.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleRegisterSuccess = () => {
    toast.success('¡Huella registrada en este dispositivo!');
    setShowRegister(false);
    load();
  };

  if (!isSupported || !isPlatformAuthAvailable) {
    return (
      <Alert severity="info" icon={<Info />} sx={{ mt: 2 }}>
        Tu dispositivo o navegador actual no soporta autenticación biométrica (WebAuthn).
        Intenta desde Chrome, Edge o Safari en un dispositivo con huella o Face ID.
      </Alert>
    );
  }

  return (
    <Box sx={{ mt: 1 }}>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2, lineHeight: 1.6 }}>
        Registra tu huella dactilar o Face ID en cada dispositivo que uses para
        acceder al sistema sin contraseña.
      </Typography>

      {loadingList ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
          <CircularProgress size={28} />
        </Box>
      ) : credentials.length === 0 ? (
        <Box sx={{
          textAlign: 'center', py: 4,
          border: `2px dashed ${theme.palette.divider}`,
          borderRadius: 3, mb: 2,
        }}>
          <Fingerprint sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
          <Typography color="text.secondary" variant="body2">
            No tienes dispositivos registrados
          </Typography>
        </Box>
      ) : (
        <Stack spacing={1.5} sx={{ mb: 2 }}>
          {credentials.map((cred) => (
            <Box key={cred.id} sx={{
              display: 'flex', alignItems: 'center', gap: 1.5,
              p: 1.5, borderRadius: 2,
              border: `1px solid ${theme.palette.divider}`,
              bgcolor: 'background.default',
            }}>
              <Avatar sx={{ bgcolor: 'rgba(16,185,129,0.12)', color: '#10B981', width: 36, height: 36 }}>
                <DeviceIcon userAgent={cred.user_agent} />
              </Avatar>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2" fontWeight={600} noWrap>
                  {cred.device_name || 'Dispositivo desconocido'}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Último uso: {timeAgo(cred.last_used_at)}
                </Typography>
              </Box>
              <Tooltip title="Eliminar este dispositivo">
                <IconButton
                  size="small"
                  color="error"
                  disabled={deletingId === cred.id}
                  onClick={() => handleDelete(cred.id, cred.device_name)}
                >
                  {deletingId === cred.id ? <CircularProgress size={16} /> : <Delete fontSize="small" />}
                </IconButton>
              </Tooltip>
            </Box>
          ))}
        </Stack>
      )}

      {showRegister ? (
        <Box sx={{
          p: 2.5, borderRadius: 3, textAlign: 'center',
          bgcolor: 'rgba(16,185,129,0.06)',
          border: '1px solid rgba(16,185,129,0.2)',
        }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Toca el botón y sigue las instrucciones de tu dispositivo
          </Typography>
          <BotonHuella
            modo="register"
            label="Registrar este dispositivo"
            onSuccess={handleRegisterSuccess}
            onError={(err, msg) => toast.error(msg)}
          />
          <Button size="small" onClick={() => setShowRegister(false)} sx={{ mt: 1, color: 'text.secondary' }}>
            Cancelar
          </Button>
        </Box>
      ) : (
        <Button
          variant="outlined"
          startIcon={<Add />}
          fullWidth
          onClick={() => setShowRegister(true)}
          sx={{ borderRadius: 2, borderStyle: 'dashed' }}
        >
          Agregar este dispositivo
        </Button>
      )}
    </Box>
  );
}

// ─── Tab: PIN ────────────────────────────────────────────────────────────────

function PinDigit({ value, filled }) {
  const theme = useTheme();
  return (
    <Box sx={{
      width: 44, height: 54, borderRadius: 2,
      border: `2px solid ${filled ? '#0891B2' : theme.palette.divider}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      bgcolor: filled ? 'rgba(8,145,178,0.08)' : 'background.default',
      transition: 'all 0.15s ease',
    }}>
      {filled && <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: '#0891B2' }} />}
    </Box>
  );
}

function TabPin({ user }) {
  const theme = useTheme();
  const [step, setStep] = useState('menu');  // 'menu' | 'enter' | 'confirm'
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [hasPinSet, setHasPinSet] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(true);

  useEffect(() => {
    // Verificamos si el usuario tiene PIN configurado comprobando el localStorage
    // (el backend no expone si tiene PIN para evitar enumerar información sensible)
    const stored = localStorage.getItem('pin_configured') === 'true';
    setHasPinSet(stored);
    setCheckingStatus(false);
  }, []);

  const addDigit = (d) => {
    const target = step === 'confirm' ? confirm : pin;
    const setter = step === 'confirm' ? setConfirm : setPin;
    if (target.length < 6) setter(target + d);
  };

  const removeDigit = () => {
    if (step === 'confirm') setConfirm(c => c.slice(0, -1));
    else setPin(p => p.slice(0, -1));
  };

  const handleNextStep = () => {
    if (pin.length < 4) {
      toast.warning('El PIN debe tener al menos 4 dígitos.');
      return;
    }
    setStep('confirm');
  };

  const handleSave = async () => {
    if (pin !== confirm) {
      toast.error('Los PINs no coinciden. Intenta de nuevo.');
      setConfirm('');
      setStep('confirm');
      return;
    }
    setLoading(true);
    try {
      await apiClient.post('/auth/pin/set', { pin });
      localStorage.setItem('pin_configured', 'true');
      localStorage.setItem('pin_length', String(pin.length));
      localStorage.setItem('pin_username', user?.username || '');
      setHasPinSet(true);
      setStep('menu');
      setPin('');
      setConfirm('');
      toast.success('¡PIN configurado! Podrás usarlo en el próximo inicio de sesión.');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'No se pudo guardar el PIN.');
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async () => {
    if (!window.confirm('¿Eliminar el PIN de acceso rápido?')) return;
    setLoading(true);
    try {
      await apiClient.delete('/auth/pin');
      localStorage.removeItem('pin_configured');
      localStorage.removeItem('pin_length');
      setHasPinSet(false);
      toast.success('PIN eliminado.');
    } catch {
      toast.error('No se pudo eliminar el PIN.');
    } finally {
      setLoading(false);
    }
  };

  const cancelSetup = () => { setStep('menu'); setPin(''); setConfirm(''); };

  const currentPin = step === 'confirm' ? confirm : pin;

  if (checkingStatus) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={28} /></Box>;
  }

  if (step === 'menu') {
    return (
      <Box sx={{ mt: 1 }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5, lineHeight: 1.6 }}>
          El PIN de 4-6 dígitos te permite ingresar al sistema rápidamente en este
          dispositivo, sin escribir tu contraseña completa.
        </Typography>

        {hasPinSet ? (
          <>
            <Alert severity="success" icon={<CheckCircle />} sx={{ mb: 2.5 }}>
              PIN configurado y activo en este dispositivo.
            </Alert>
            <Stack spacing={1.5}>
              <Button
                variant="outlined"
                startIcon={<Pin />}
                fullWidth
                onClick={() => { setStep('enter'); setPin(''); setConfirm(''); }}
                sx={{ borderRadius: 2 }}
              >
                Cambiar PIN
              </Button>
              <Button
                variant="outlined"
                color="error"
                startIcon={<LockOpen />}
                fullWidth
                onClick={handleRemove}
                disabled={loading}
                sx={{ borderRadius: 2 }}
              >
                Eliminar PIN
              </Button>
            </Stack>
          </>
        ) : (
          <>
            <Alert severity="info" icon={<Lock />} sx={{ mb: 2.5 }}>
              No tienes PIN configurado.
            </Alert>
            <Button
              variant="contained"
              startIcon={<Pin />}
              fullWidth
              onClick={() => setStep('enter')}
              sx={{ borderRadius: 2 }}
            >
              Configurar PIN de acceso rápido
            </Button>
          </>
        )}
      </Box>
    );
  }

  // Paso "enter" o "confirm" — mostrar teclado numérico
  return (
    <Box sx={{ mt: 1 }}>
      <Typography variant="body2" fontWeight={600} sx={{ mb: 0.5, textAlign: 'center' }}>
        {step === 'enter' ? 'Ingresa tu nuevo PIN (4-6 dígitos)' : 'Repite el PIN para confirmar'}
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2.5, textAlign: 'center' }}>
        {step === 'enter' ? 'Elige entre 4 y 6 dígitos' : 'Asegúrate de que coincida con el anterior'}
      </Typography>

      {/* Indicadores de dígitos */}
      <Box sx={{ display: 'flex', gap: 1.5, justifyContent: 'center', mb: 3 }}>
        {Array.from({ length: Math.max(4, currentPin.length + (currentPin.length < 6 ? 1 : 0)) }).map((_, i) => (
          <PinDigit key={i} filled={i < currentPin.length} />
        ))}
      </Box>

      {/* Teclado numérico */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1.5, maxWidth: 240, mx: 'auto', mb: 2.5 }}>
        {[1,2,3,4,5,6,7,8,9].map(d => (
          <Button key={d} variant="outlined" onClick={() => addDigit(String(d))}
            sx={{ height: 52, borderRadius: 2, fontSize: 20, fontWeight: 700 }}>
            {d}
          </Button>
        ))}
        <Box /> {/* espacio vacío */}
        <Button variant="outlined" onClick={() => addDigit('0')}
          sx={{ height: 52, borderRadius: 2, fontSize: 20, fontWeight: 700 }}>
          0
        </Button>
        <Button variant="outlined" onClick={removeDigit} sx={{ height: 52, borderRadius: 2 }}>
          ⌫
        </Button>
      </Box>

      <Stack direction="row" spacing={1.5}>
        <Button variant="text" fullWidth onClick={cancelSetup} sx={{ color: 'text.secondary' }}>
          Cancelar
        </Button>
        {step === 'enter' ? (
          <Button
            variant="contained" fullWidth
            disabled={pin.length < 4}
            onClick={handleNextStep}
            sx={{ borderRadius: 2 }}
          >
            Continuar
          </Button>
        ) : (
          <Button
            variant="contained" fullWidth
            disabled={confirm.length < 4 || loading}
            onClick={handleSave}
            sx={{ borderRadius: 2 }}
          >
            {loading ? <CircularProgress size={18} sx={{ color: '#fff' }} /> : 'Guardar PIN'}
          </Button>
        )}
      </Stack>
    </Box>
  );
}

// ─── Dialog principal ────────────────────────────────────────────────────────

export default function SecurityDialog({ open, onClose, user }) {
  const [tab, setTab] = useState(0);
  const theme = useTheme();

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      PaperProps={{ sx: { borderRadius: 3 } }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5, pr: 6 }}>
        <Avatar sx={{ bgcolor: 'rgba(8,145,178,0.12)', color: '#0891B2', width: 36, height: 36 }}>
          <Security fontSize="small" />
        </Avatar>
        <Box>
          <Typography variant="subtitle1" fontWeight={700} lineHeight={1.2}>
            Seguridad de la cuenta
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {user?.username}
          </Typography>
        </Box>
      </DialogTitle>
      <IconButton onClick={onClose} sx={{ position: 'absolute', right: 12, top: 12, color: 'text.secondary' }}>
        <Close />
      </IconButton>

      <Divider />

      <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 3, pt: 0 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="fullWidth">
          <Tab label="Biometría" icon={<Fingerprint fontSize="small" />} iconPosition="start" sx={{ minHeight: 48, fontSize: 13 }} />
          <Tab label="PIN rápido" icon={<Pin fontSize="small" />} iconPosition="start" sx={{ minHeight: 48, fontSize: 13 }} />
        </Tabs>
      </Box>

      <DialogContent sx={{ pt: 2, pb: 3 }}>
        {tab === 0 && <TabBiometria />}
        {tab === 1 && <TabPin user={user} />}
      </DialogContent>
    </Dialog>
  );
}
