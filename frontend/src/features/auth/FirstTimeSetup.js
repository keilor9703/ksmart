import React, { useState, useRef } from 'react';
import {
  Box, Typography, TextField, Button, Stepper, Step, StepLabel,
  CircularProgress, Avatar, IconButton, InputAdornment, Paper,
  LinearProgress, Alert,
} from '@mui/material';
import {
  Business, Person, Lock, Visibility, VisibilityOff,
  CloudUpload, CheckCircle, ArrowForward, ArrowBack,
} from '@mui/icons-material';
import { toast } from 'react-toastify';
import apiClient from '../../api';

const STEPS = ['Tu Empresa', 'Usuario Administrador', 'Confirmar'];

export default function FirstTimeSetup({ onComplete }) {
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading]       = useState(false);
  const [showPass, setShowPass]     = useState(false);
  const [showPass2, setShowPass2]   = useState(false);
  const fileRef = useRef();

  const [form, setForm] = useState({
    empresa_nombre: '',
    empresa_nit:    '',
    empresa_color:  '#F43F5E',
    logo_base64:    null,
    admin_username: '',
    admin_password: '',
    admin_password2: '',
  });

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleLogo = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast.error('El logo no debe superar 2 MB'); return; }
    const reader = new FileReader();
    reader.onload = (ev) => setForm((f) => ({ ...f, logo_base64: ev.target.result }));
    reader.readAsDataURL(file);
  };

  const canNext = () => {
    if (activeStep === 0) return form.empresa_nombre.trim().length >= 2;
    if (activeStep === 1) {
      return (
        form.admin_username.trim().length >= 3 &&
        form.admin_password.length >= 6 &&
        form.admin_password === form.admin_password2
      );
    }
    return true;
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      await apiClient.post('/setup/init', {
        empresa_nombre: form.empresa_nombre.trim(),
        empresa_nit:    form.empresa_nit.trim(),
        empresa_color:  form.empresa_color,
        logo_base64:    form.logo_base64 || null,
        admin_username: form.admin_username.trim(),
        admin_password: form.admin_password,
      });
      toast.success('¡Sistema configurado! Ahora puedes iniciar sesión.');
      onComplete();
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Error al configurar el sistema');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(135deg, #0A0A0A 0%, #1F1F1F 100%)',
        p: 2,
      }}
    >
      <Paper
        elevation={24}
        sx={{
          width: '100%', maxWidth: 520, borderRadius: 4, overflow: 'hidden',
          background: '#1F1F1F', border: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        {/* Header */}
        <Box sx={{ background: 'linear-gradient(135deg, #F43F5E, #818CF8)', p: 4, textAlign: 'center' }}>
          <Typography variant="h5" sx={{ fontWeight: 800, color: '#fff', mb: 0.5 }}>
            Bienvenido a Ksmart360
          </Typography>
          <Typography sx={{ color: 'rgba(255,255,255,0.8)', fontSize: 14 }}>
            Configura tu sistema por primera vez
          </Typography>
        </Box>

        <Box sx={{ p: 4 }}>
          <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
            {STEPS.map((label) => (
              <Step key={label}>
                <StepLabel
                  sx={{
                    '& .MuiStepLabel-label': { color: '#94a3b8', fontSize: 12 },
                    '& .MuiStepLabel-label.Mui-active': { color: '#fff' },
                    '& .MuiStepLabel-label.Mui-completed': { color: '#F43F5E' },
                  }}
                >
                  {label}
                </StepLabel>
              </Step>
            ))}
          </Stepper>

          {/* PASO 0 — Empresa */}
          {activeStep === 0 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Avatar
                  src={form.logo_base64}
                  sx={{
                    width: 72, height: 72, cursor: 'pointer', border: '2px dashed rgba(255,255,255,0.2)',
                    background: '#0A0A0A', flexShrink: 0,
                  }}
                  onClick={() => fileRef.current?.click()}
                >
                  <CloudUpload sx={{ color: '#64748b' }} />
                </Avatar>
                <Box>
                  <Typography sx={{ color: '#e2e8f0', fontSize: 13, fontWeight: 600 }}>Logo de la empresa</Typography>
                  <Typography sx={{ color: '#64748b', fontSize: 12 }}>Haz clic en el ícono para subir (PNG, JPG — máx. 2 MB)</Typography>
                  <Button size="small" sx={{ mt: 0.5, fontSize: 11, color: '#F43F5E', textTransform: 'none' }} onClick={() => fileRef.current?.click()}>
                    Seleccionar archivo
                  </Button>
                </Box>
                <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleLogo} />
              </Box>

              <TextField
                label="Nombre de la empresa *"
                value={form.empresa_nombre}
                onChange={set('empresa_nombre')}
                fullWidth
                InputProps={{ startAdornment: <Business sx={{ mr: 1, color: '#64748b' }} /> }}
                sx={fieldSx}
              />
              <TextField
                label="NIT / RUC (opcional)"
                value={form.empresa_nit}
                onChange={set('empresa_nit')}
                fullWidth
                sx={fieldSx}
              />
              <Box>
                <Typography sx={{ color: '#94a3b8', fontSize: 12, mb: 1 }}>Color principal de la marca</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <input
                    type="color"
                    value={form.empresa_color}
                    onChange={(e) => setForm((f) => ({ ...f, empresa_color: e.target.value }))}
                    style={{ width: 48, height: 40, border: 'none', borderRadius: 8, cursor: 'pointer', background: 'transparent' }}
                  />
                  <Typography sx={{ color: '#e2e8f0', fontFamily: 'monospace', fontSize: 14 }}>{form.empresa_color}</Typography>
                </Box>
              </Box>
            </Box>
          )}

          {/* PASO 1 — Administrador */}
          {activeStep === 1 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
              <Alert severity="info" sx={{ fontSize: 12, background: 'rgba(59,130,246,0.1)', color: '#93c5fd', border: '1px solid rgba(59,130,246,0.2)' }}>
                Este usuario será el <strong>dueño del sistema</strong>. Guarda estas credenciales en un lugar seguro.
              </Alert>
              <TextField
                label="Nombre de usuario *"
                value={form.admin_username}
                onChange={set('admin_username')}
                fullWidth
                InputProps={{ startAdornment: <Person sx={{ mr: 1, color: '#64748b' }} /> }}
                sx={fieldSx}
              />
              <TextField
                label="Contraseña *"
                type={showPass ? 'text' : 'password'}
                value={form.admin_password}
                onChange={set('admin_password')}
                fullWidth
                InputProps={{
                  startAdornment: <Lock sx={{ mr: 1, color: '#64748b' }} />,
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton onClick={() => setShowPass((v) => !v)} size="small">
                        {showPass ? <VisibilityOff sx={{ color: '#64748b' }} /> : <Visibility sx={{ color: '#64748b' }} />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
                sx={fieldSx}
                helperText="Mínimo 6 caracteres"
              />
              <TextField
                label="Confirmar contraseña *"
                type={showPass2 ? 'text' : 'password'}
                value={form.admin_password2}
                onChange={set('admin_password2')}
                fullWidth
                error={form.admin_password2.length > 0 && form.admin_password !== form.admin_password2}
                helperText={form.admin_password2.length > 0 && form.admin_password !== form.admin_password2 ? 'Las contraseñas no coinciden' : ''}
                InputProps={{
                  startAdornment: <Lock sx={{ mr: 1, color: '#64748b' }} />,
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton onClick={() => setShowPass2((v) => !v)} size="small">
                        {showPass2 ? <VisibilityOff sx={{ color: '#64748b' }} /> : <Visibility sx={{ color: '#64748b' }} />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
                sx={fieldSx}
              />
            </Box>
          )}

          {/* PASO 2 — Confirmación */}
          {activeStep === 2 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center', textAlign: 'center' }}>
              {form.logo_base64 && (
                <Avatar src={form.logo_base64} sx={{ width: 80, height: 80, mb: 1 }} />
              )}
              <Typography sx={{ color: '#e2e8f0', fontWeight: 700, fontSize: 18 }}>
                {form.empresa_nombre}
              </Typography>
              {form.empresa_nit && (
                <Typography sx={{ color: '#64748b', fontSize: 13 }}>NIT: {form.empresa_nit}</Typography>
              )}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                <Box sx={{ width: 20, height: 20, borderRadius: '50%', background: form.empresa_color }} />
                <Typography sx={{ color: '#94a3b8', fontSize: 13 }}>{form.empresa_color}</Typography>
              </Box>
              <Box sx={{ width: '100%', background: 'rgba(255,255,255,0.04)', borderRadius: 2, p: 2, mt: 1 }}>
                <Typography sx={{ color: '#94a3b8', fontSize: 12, mb: 0.5 }}>Usuario administrador</Typography>
                <Typography sx={{ color: '#e2e8f0', fontWeight: 600 }}>@{form.admin_username}</Typography>
              </Box>
              <Alert severity="warning" sx={{ fontSize: 12, background: 'rgba(245,158,11,0.1)', color: '#fcd34d', border: '1px solid rgba(245,158,11,0.2)', width: '100%', textAlign: 'left' }}>
                Al hacer clic en <strong>Inicializar</strong> se creará toda la configuración base. Esta acción solo puede ejecutarse una vez.
              </Alert>
            </Box>
          )}

          {/* Navegación */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4, gap: 2 }}>
            <Button
              variant="outlined"
              startIcon={<ArrowBack />}
              onClick={() => setActiveStep((s) => s - 1)}
              disabled={activeStep === 0 || loading}
              sx={{ borderColor: 'rgba(255,255,255,0.12)', color: '#94a3b8', '&:hover': { borderColor: '#94a3b8' } }}
            >
              Atrás
            </Button>

            {activeStep < STEPS.length - 1 ? (
              <Button
                variant="contained"
                endIcon={<ArrowForward />}
                onClick={() => setActiveStep((s) => s + 1)}
                disabled={!canNext()}
                sx={{ background: 'linear-gradient(135deg, #F43F5E, #818CF8)', fontWeight: 700, flex: 1, maxWidth: 200 }}
              >
                Siguiente
              </Button>
            ) : (
              <Button
                variant="contained"
                endIcon={loading ? <CircularProgress size={16} color="inherit" /> : <CheckCircle />}
                onClick={handleSubmit}
                disabled={loading}
                sx={{ background: 'linear-gradient(135deg, #10B981, #059669)', fontWeight: 700, flex: 1, maxWidth: 240 }}
              >
                {loading ? 'Inicializando...' : 'Inicializar Sistema'}
              </Button>
            )}
          </Box>
        </Box>
      </Paper>
    </Box>
  );
}

const fieldSx = {
  '& .MuiOutlinedInput-root': {
    color: '#e2e8f0',
    '& fieldset': { borderColor: 'rgba(255,255,255,0.12)' },
    '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.25)' },
    '&.Mui-focused fieldset': { borderColor: '#F43F5E' },
  },
  '& .MuiInputLabel-root': { color: '#64748b' },
  '& .MuiInputLabel-root.Mui-focused': { color: '#F43F5E' },
  '& .MuiFormHelperText-root': { color: '#64748b' },
};
