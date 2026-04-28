import React, { useState } from 'react';
import {
  Box, Typography, TextField, Button, Paper, Container,
  InputAdornment, IconButton, Card, CardActionArea, Grid, CircularProgress,
  MenuItem, LinearProgress, Stack, Chip
} from '@mui/material';
import {
  Visibility, VisibilityOff, Business, Person, Lock,
  Storefront, AttachMoney, Email, Phone, LocationOn,
  ArrowForward, ArrowBack, CheckCircle, Group
} from '@mui/icons-material';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import apiClient from '../api';

const ACCENT = '#FF6020';

// ── Catálogos pequeños ──────────────────────────────────────────────────────
const PAISES = [
  { code: 'CO', label: 'Colombia',   flag: '🇨🇴' },
  { code: 'MX', label: 'México',     flag: '🇲🇽' },
  { code: 'EC', label: 'Ecuador',    flag: '🇪🇨' },
  { code: 'PE', label: 'Perú',       flag: '🇵🇪' },
  { code: 'VE', label: 'Venezuela',  flag: '🇻🇪' },
  { code: 'AR', label: 'Argentina',  flag: '🇦🇷' },
  { code: 'CL', label: 'Chile',      flag: '🇨🇱' },
  { code: 'ES', label: 'España',     flag: '🇪🇸' },
  { code: 'US', label: 'Estados Unidos', flag: '🇺🇸' },
  { code: 'OTRO', label: 'Otro país', flag: '🌎' },
];

const ORIGENES = [
  'Recomendado por un amigo',
  'Búsqueda en Google',
  'Facebook / Instagram',
  'TikTok',
  'YouTube',
  'WhatsApp',
  'Otro',
];

const TAMANOS_NEGOCIO = [
  { value: 'solo',     label: 'Solo yo',       desc: '1 persona' },
  { value: 'pequeno',  label: 'Pequeño',       desc: '2-5 empleados' },
  { value: 'mediano',  label: 'Mediano',       desc: '6-20 empleados' },
  { value: 'grande',   label: 'Grande',        desc: '+20 empleados' },
];

// ── Validaciones simples ────────────────────────────────────────────────────
const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const isPhone = (v) => /^[\d+\s()-]{7,20}$/.test(v);

export default function Registro() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);                 // 1 = perfil, 2 = cuenta
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    // Paso 1 — Perfil del negocio
    tipo_negocio:    'erp',
    nombre_empresa:  '',
    pais:            'CO',
    ciudad:          '',
    tamano_negocio:  'pequeno',

    // Paso 2 — Cuenta del usuario
    nombre_completo: '',
    email:           '',
    telefono:        '',
    username:        '',
    password:        '',

    // Marketing (opcional)
    origen:          '',
  });

  const update = (key) => (e) =>
    setFormData((prev) => ({ ...prev, [key]: e.target.value }));

  // ── Validación por paso ────────────────────────────────────────────────────
  const canContinueStep1 = () =>
    formData.nombre_empresa.trim().length >= 2 &&
    formData.ciudad.trim().length >= 2 &&
    formData.pais &&
    formData.tamano_negocio &&
    formData.tipo_negocio;

  const canSubmitStep2 = () => {
    if (formData.nombre_completo.trim().length < 3) return false;
    if (!isEmail(formData.email)) return false;
    if (!isPhone(formData.telefono)) return false;
    if (formData.username.trim().length < 3) return false;
    if (formData.password.length < 6) return false;
    return true;
  };

  // ── Avanzar al paso 2 ──────────────────────────────────────────────────────
  const handleNext = () => {
    if (!canContinueStep1()) {
      toast.warning('Completa los campos del negocio para continuar.');
      return;
    }
    setStep(2);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ── Submit final ───────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmitStep2()) {
      toast.warning('Por favor revisa los datos antes de continuar.');
      return;
    }

    setLoading(true);
    try {
      // El backend espera estos campos. Si aún no los soporta, los ignora.
      await apiClient.post('/auth/register', {
        nombre_empresa:  formData.nombre_empresa.trim(),
        username:        formData.username.trim().toLowerCase(),
        password:        formData.password,
        tipo_negocio:    formData.tipo_negocio,
        // Campos nuevos del rediseño:
        nombre_completo: formData.nombre_completo.trim(),
        email:           formData.email.trim().toLowerCase(),
        telefono:        formData.telefono.trim(),
        pais:            formData.pais,
        ciudad:          formData.ciudad.trim(),
        tamano_negocio:  formData.tamano_negocio,
        origen:          formData.origen || null,
      });
      toast.success('¡Bienvenido a Ksmart360! Tu espacio fue creado.');
      navigate('/login');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al crear la cuenta.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(160deg, #0f172a 0%, #020617 100%)',
      py: { xs: 3, md: 5 }, px: 2,
    }}>
      <Container maxWidth="sm" disableGutters>
        <Paper sx={{
          p: { xs: 3, md: 4 }, borderRadius: 4, textAlign: 'center',
          boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
        }}>
          {/* Logo + título */}
          <Box sx={{ mb: 2.5 }}>
            <img src="/Logo.jpeg" alt="Logo" style={{ width: 56, height: 56, borderRadius: '50%' }} />
          </Box>

          <Typography variant="h5" fontWeight={800} mb={0.5}>
            {step === 1 ? 'Crea tu espacio' : 'Casi listo'}
          </Typography>
          <Typography variant="body2" color="text.secondary" mb={3}>
            {step === 1
              ? 'Cuéntanos sobre tu negocio · 14 días gratis · Sin tarjeta'
              : 'Crea tu usuario para acceder a tu panel'}
          </Typography>

          {/* Indicador de progreso */}
          <Box sx={{ mb: 3 }}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
              <Chip
                size="small" label="1 · Negocio"
                icon={step > 1 ? <CheckCircle sx={{ fontSize: 14 }} /> : null}
                sx={{
                  fontWeight: 700, fontSize: 11,
                  bgcolor: step >= 1 ? `${ACCENT}15` : 'action.hover',
                  color:   step >= 1 ? ACCENT : 'text.secondary',
                }}
              />
              <Box sx={{ flex: 1, height: 2, bgcolor: step === 2 ? ACCENT : 'action.hover', borderRadius: 1 }} />
              <Chip
                size="small" label="2 · Cuenta"
                sx={{
                  fontWeight: 700, fontSize: 11,
                  bgcolor: step === 2 ? `${ACCENT}15` : 'action.hover',
                  color:   step === 2 ? ACCENT : 'text.secondary',
                }}
              />
            </Stack>
            <LinearProgress
              variant="determinate" value={step === 1 ? 50 : 100}
              sx={{
                height: 4, borderRadius: 2,
                bgcolor: 'action.hover',
                '& .MuiLinearProgress-bar': { bgcolor: ACCENT },
              }}
            />
          </Box>

          <form onSubmit={handleSubmit} noValidate>
            {/* ═══════════════════════════════════════════════════════════════ */}
            {/* PASO 1 — Perfil del negocio                                      */}
            {/* ═══════════════════════════════════════════════════════════════ */}
            {step === 1 && (
              <Stack spacing={2.2}>
                {/* Selector tipo negocio */}
                <Box>
                  <Typography sx={{ fontSize: 12, fontWeight: 700, color: 'text.secondary', textAlign: 'left', mb: 1, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Tipo de negocio
                  </Typography>
                  <Grid container spacing={1.5}>
                    <Grid item xs={6}>
                      <Card sx={{
                        border: formData.tipo_negocio === 'erp' ? `2px solid ${ACCENT}` : '2px solid transparent',
                        bgcolor: formData.tipo_negocio === 'erp' ? `${ACCENT}08` : 'background.paper',
                        transition: '0.25s',
                      }}>
                        <CardActionArea onClick={() => setFormData({ ...formData, tipo_negocio: 'erp' })} sx={{ p: 1.5 }}>
                          <Storefront sx={{ color: formData.tipo_negocio === 'erp' ? ACCENT : 'text.disabled', fontSize: 28 }} />
                          <Typography variant="subtitle2" fontWeight={700} sx={{ mt: 0.5 }}>Comercio / ERP</Typography>
                          <Typography variant="caption" color="text.secondary">Ventas e Inventario</Typography>
                        </CardActionArea>
                      </Card>
                    </Grid>
                    <Grid item xs={6}>
                      <Card sx={{
                        border: formData.tipo_negocio === 'prestamos' ? `2px solid ${ACCENT}` : '2px solid transparent',
                        bgcolor: formData.tipo_negocio === 'prestamos' ? `${ACCENT}08` : 'background.paper',
                        transition: '0.25s',
                      }}>
                        <CardActionArea onClick={() => setFormData({ ...formData, tipo_negocio: 'prestamos' })} sx={{ p: 1.5 }}>
                          <AttachMoney sx={{ color: formData.tipo_negocio === 'prestamos' ? ACCENT : 'text.disabled', fontSize: 28 }} />
                          <Typography variant="subtitle2" fontWeight={700} sx={{ mt: 0.5 }}>Cobranzas</Typography>
                          <Typography variant="caption" color="text.secondary">Rutas de cobro</Typography>
                        </CardActionArea>
                      </Card>
                    </Grid>
                  </Grid>
                </Box>

                {/* Nombre empresa */}
                <TextField
                  fullWidth required label="Nombre de tu negocio"
                  placeholder="Ej: Vialmar Cacao, Almacén Don José…"
                  value={formData.nombre_empresa}
                  onChange={update('nombre_empresa')}
                  InputProps={{ startAdornment: <InputAdornment position="start"><Business fontSize="small" /></InputAdornment> }}
                />

                {/* País + Ciudad */}
                <Grid container spacing={1.5}>
                  <Grid item xs={5}>
                    <TextField
                      select fullWidth required label="País"
                      value={formData.pais}
                      onChange={update('pais')}
                    >
                      {PAISES.map((p) => (
                        <MenuItem key={p.code} value={p.code}>
                          <span style={{ marginRight: 8 }}>{p.flag}</span>{p.label}
                        </MenuItem>
                      ))}
                    </TextField>
                  </Grid>
                  <Grid item xs={7}>
                    <TextField
                      fullWidth required label="Ciudad"
                      placeholder="Ej: Bogotá"
                      value={formData.ciudad}
                      onChange={update('ciudad')}
                      InputProps={{ startAdornment: <InputAdornment position="start"><LocationOn fontSize="small" /></InputAdornment> }}
                    />
                  </Grid>
                </Grid>

                {/* Tamaño */}
                <Box>
                  <Typography sx={{ fontSize: 12, fontWeight: 700, color: 'text.secondary', textAlign: 'left', mb: 1, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    ¿Cuántas personas trabajan contigo?
                  </Typography>
                  <Grid container spacing={1}>
                    {TAMANOS_NEGOCIO.map((t) => (
                      <Grid item xs={6} sm={3} key={t.value}>
                        <Card sx={{
                          border: formData.tamano_negocio === t.value ? `2px solid ${ACCENT}` : '2px solid transparent',
                          bgcolor: formData.tamano_negocio === t.value ? `${ACCENT}08` : 'background.paper',
                          transition: '0.2s',
                        }}>
                          <CardActionArea onClick={() => setFormData({ ...formData, tamano_negocio: t.value })} sx={{ p: 1, textAlign: 'center' }}>
                            <Group sx={{ color: formData.tamano_negocio === t.value ? ACCENT : 'text.disabled', fontSize: 22 }} />
                            <Typography sx={{ fontSize: 12, fontWeight: 700, mt: 0.3 }}>{t.label}</Typography>
                            <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>{t.desc}</Typography>
                          </CardActionArea>
                        </Card>
                      </Grid>
                    ))}
                  </Grid>
                </Box>

                {/* Botón continuar */}
                <Button
                  fullWidth variant="contained" size="large"
                  endIcon={<ArrowForward />}
                  onClick={handleNext}
                  disabled={!canContinueStep1()}
                  sx={{
                    bgcolor: ACCENT, py: 1.6, borderRadius: 3, fontWeight: 800, fontSize: 15,
                    boxShadow: `0 8px 24px ${ACCENT}40`,
                    '&:hover': { bgcolor: '#e6561c' },
                    mt: 1,
                  }}
                >
                  Continuar
                </Button>
              </Stack>
            )}

            {/* ═══════════════════════════════════════════════════════════════ */}
            {/* PASO 2 — Cuenta del usuario                                      */}
            {/* ═══════════════════════════════════════════════════════════════ */}
            {step === 2 && (
              <Stack spacing={2.2}>
                <TextField
                  fullWidth required label="Tu nombre completo"
                  placeholder="Ej: María Pérez"
                  value={formData.nombre_completo}
                  onChange={update('nombre_completo')}
                  InputProps={{ startAdornment: <InputAdornment position="start"><Person fontSize="small" /></InputAdornment> }}
                />

                <TextField
                  fullWidth required type="email" label="Correo electrónico"
                  placeholder="tucorreo@ejemplo.com"
                  value={formData.email}
                  onChange={update('email')}
                  error={formData.email.length > 0 && !isEmail(formData.email)}
                  helperText={formData.email.length > 0 && !isEmail(formData.email) ? 'Correo no válido' : 'Lo usaremos para recuperar tu cuenta'}
                  InputProps={{ startAdornment: <InputAdornment position="start"><Email fontSize="small" /></InputAdornment> }}
                />

                <TextField
                  fullWidth required type="tel" label="WhatsApp / Teléfono"
                  placeholder="Ej: 300 123 4567"
                  value={formData.telefono}
                  onChange={update('telefono')}
                  helperText="Te avisaremos por aquí si hay algo importante"
                  InputProps={{ startAdornment: <InputAdornment position="start"><Phone fontSize="small" /></InputAdornment> }}
                />

                <TextField
                  fullWidth required label="Usuario para ingresar"
                  placeholder="Sin espacios. Ej: maria.perez"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value.trim() })}
                  helperText="Este será tu nombre para iniciar sesión"
                  InputProps={{ startAdornment: <InputAdornment position="start"><Person fontSize="small" /></InputAdornment> }}
                />

                <TextField
                  fullWidth required type={showPassword ? 'text' : 'password'} label="Contraseña segura"
                  value={formData.password}
                  onChange={update('password')}
                  helperText="Mínimo 6 caracteres"
                  InputProps={{
                    startAdornment: <InputAdornment position="start"><Lock fontSize="small" /></InputAdornment>,
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton onClick={() => setShowPassword(!showPassword)} edge="end">
                          {showPassword ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />

                {/* Marketing — opcional */}
                <TextField
                  select fullWidth label="¿Cómo nos conociste? (opcional)"
                  value={formData.origen}
                  onChange={update('origen')}
                >
                  <MenuItem value="">Prefiero no decir</MenuItem>
                  {ORIGENES.map((o) => (
                    <MenuItem key={o} value={o}>{o}</MenuItem>
                  ))}
                </TextField>

                {/* Botones */}
                <Stack direction="row" spacing={1.5} sx={{ mt: 1 }}>
                  <Button
                    variant="outlined" size="large" startIcon={<ArrowBack />}
                    onClick={() => setStep(1)} disabled={loading}
                    sx={{ py: 1.6, borderRadius: 3, fontWeight: 700, flex: 0.6 }}
                  >
                    Atrás
                  </Button>
                  <Button
                    type="submit" variant="contained" size="large"
                    disabled={loading || !canSubmitStep2()}
                    sx={{
                      bgcolor: ACCENT, py: 1.6, borderRadius: 3, fontWeight: 800, fontSize: 15,
                      boxShadow: `0 8px 24px ${ACCENT}40`,
                      '&:hover': { bgcolor: '#e6561c' },
                      flex: 1.4,
                    }}
                  >
                    {loading ? <CircularProgress size={22} color="inherit" /> : 'Crear mi cuenta'}
                  </Button>
                </Stack>
              </Stack>
            )}
          </form>

          <Typography sx={{ mt: 3, fontSize: 13, color: 'text.secondary' }}>
            ¿Ya tienes una cuenta?{' '}
            <Link to="/login" style={{ color: ACCENT, fontWeight: 700, textDecoration: 'none' }}>
              Inicia sesión aquí
            </Link>
          </Typography>

          {/* Trust indicators sutiles */}
          <Stack direction="row" spacing={2} justifyContent="center" sx={{ mt: 2, opacity: 0.7 }}>
            <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>🔒 Datos cifrados</Typography>
            <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>✓ Sin tarjeta</Typography>
            <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>📧 Cancela cuando quieras</Typography>
          </Stack>
        </Paper>
      </Container>
    </Box>
  );
}
