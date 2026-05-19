import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import apiClient from '../../api';
import {
    Box, TextField, Button, Typography, InputAdornment, IconButton,
    Grid, Card, CardActionArea, MenuItem, LinearProgress, Stack, Chip,
    Autocomplete, FormControlLabel, Checkbox, CircularProgress
} from '@mui/material';
import { keyframes } from '@mui/system';
import {
    Visibility, VisibilityOff, AlternateEmail, Lock, Business, Person,
    Storefront, AttachMoney, Email, Phone, LocationOn, Group,
    ArrowForward, ArrowBack, CheckCircle, LocalParking, LocalCarWash
} from '@mui/icons-material';
import { Link } from 'react-router-dom';

import BotonHuella from '../../components/common/BotonHuella';
import { CIUDADES_COLOMBIA } from '../../utils/colombiaData';

// ─── Animaciones ─────────────────────────────────────────────────────────────
const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(20px); }
  to   { opacity: 1; transform: translateY(0); }
`;

const pulseRing = keyframes`
  0%   { transform: scale(1);    opacity: 0.6; }
  50%  { transform: scale(1.08); opacity: 0.2; }
  100% { transform: scale(1);    opacity: 0.6; }
`;

const slideUp = keyframes`
  from { opacity: 0; transform: translateY(18px); }
  to   { opacity: 1; transform: translateY(0); }
`;

// ─── Estilos de campo reutilizables ──────────────────────────────────────────
const fieldSx = {
    '& .MuiInputLabel-root': {
        color: '#64748b', fontSize: 11, fontWeight: 700,
        letterSpacing: 1.4, textTransform: 'uppercase',
    },
    '& .MuiInputLabel-root.Mui-focused': { color: '#22c55e' },
    '& .MuiFormHelperText-root': { color: '#475569', fontSize: 11, mt: 0.5 },
    '& .MuiFormHelperText-root.Mui-error': { color: '#f87171' },
    '& .MuiOutlinedInput-root': {
        borderRadius: 2.5,
        backgroundColor: 'rgba(241, 245, 249, 0.05)',
        backdropFilter: 'blur(10px)',
        color: '#f1f5f9',
        fontSize: 15,
        '& input': {
            padding: '14px 14px',
            color: '#f1f5f9',
            WebkitTextFillColor: '#f1f5f9',
            caretColor: '#22c55e',
            '&:-webkit-autofill': {
                WebkitBoxShadow: '0 0 0 100px #1e293b inset',
                WebkitTextFillColor: '#f1f5f9',
                caretColor: '#22c55e',
                borderRadius: 'inherit',
            },
        },
        '& fieldset': { borderColor: 'rgba(148, 163, 184, 0.2)', borderWidth: 1.5 },
        '&:hover fieldset': { borderColor: 'rgba(148, 163, 184, 0.45)' },
        '&.Mui-focused fieldset': { borderColor: '#22c55e', borderWidth: 2 },
        '&.Mui-error fieldset': { borderColor: '#f87171' },
    },
    '& .MuiInputAdornment-root .MuiSvgIcon-root': { color: '#475569', fontSize: 19 },
    '& .MuiOutlinedInput-root.Mui-focused .MuiInputAdornment-root .MuiSvgIcon-root': { color: '#22c55e' },
    '&.orange-field': {
        '& .MuiInputLabel-root.Mui-focused': { color: '#f97316' },
        '& .MuiOutlinedInput-root.Mui-focused fieldset': { borderColor: '#f97316' },
        '& .MuiOutlinedInput-root.Mui-focused .MuiInputAdornment-root .MuiSvgIcon-root': { color: '#f97316' },
    },
};

// ─── Catálogos ──────────────────────────────────────────────────────────────
const PAISES = [
    { code: 'CO', label: 'Colombia',        flag: '🇨🇴' },
    { code: 'MX', label: 'México',          flag: '🇲🇽' },
    { code: 'EC', label: 'Ecuador',         flag: '🇪🇨' },
    { code: 'PE', label: 'Perú',            flag: '🇵🇪' },
    { code: 'VE', label: 'Venezuela',       flag: '🇻🇪' },
    { code: 'AR', label: 'Argentina',       flag: '🇦🇷' },
    { code: 'CL', label: 'Chile',           flag: '🇨🇱' },
    { code: 'ES', label: 'España',          flag: '🇪🇸' },
    { code: 'US', label: 'Estados Unidos',  flag: '🇺🇸' },
    { code: 'OTRO', label: 'Otro país',     flag: '🌎' },
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

const CAROUSEL_FEATURES = [
  {
    Icon: Storefront,
    tag: 'COMERCIO & ERP',
    color: '#FF6020',
    title: 'Vende más inteligente',
    desc: 'POS moderno, inventario en tiempo real, compras, clientes y reportes financieros en un solo lugar.',
    stats: [{ label: 'Productos', val: '∞' }, { label: 'Clientes', val: '∞' }, { label: 'Reportes', val: '12+' }],
  },
  {
    Icon: AttachMoney,
    tag: 'COBRANZAS',
    color: '#22c55e',
    title: 'Rutas de cobro en campo',
    desc: 'Mora calculada en tiempo real, evidencias geolocalizadas y control total de tu capital en la calle.',
    stats: [{ label: 'Cuotas', val: '∞' }, { label: 'Mora', val: 'Auto' }, { label: 'GPS', val: 'Sí' }],
  },
  {
    Icon: LocalParking,
    tag: 'PARQUEADERO',
    color: '#3B82F6',
    title: 'Control de accesos total',
    desc: 'Semáforo de vehículos, suscripciones mensuales, accesos por horas e ingresos desglosados.',
    stats: [{ label: 'Tipos', val: '4' }, { label: 'WhatsApp', val: 'Sí' }, { label: 'Reportes', val: 'Real-time' }],
  },
  {
    Icon: LocalCarWash,
    tag: 'LAVADERO',
    color: '#8B5CF6',
    title: 'POS especializado',
    desc: 'Registro de servicios, turnos del personal, ingresos por operario y fidelización de clientes.',
    stats: [{ label: 'Servicios', val: '∞' }, { label: 'Operarios', val: '∞' }, { label: 'POS', val: 'Touch' }],
  },
];

const TAMANOS_NEGOCIO = [
    { value: 'solo',    label: 'Solo yo',  desc: '1 persona' },
    { value: 'pequeno', label: 'Pequeño',  desc: '2-5' },
    { value: 'mediano', label: 'Mediano',  desc: '6-20' },
    { value: 'grande',  label: 'Grande',   desc: '+20' },
];

const getPwdStrength = (pwd) => {
  if (!pwd) return null;
  const hasUpper   = /[A-Z]/.test(pwd);
  const hasNumber  = /[0-9]/.test(pwd);
  const hasSpecial = /[^A-Za-z0-9]/.test(pwd);
  if (pwd.length < 4) return { level: 1, label: 'Muy débil', color: '#EF4444' };
  if (pwd.length < 6) return { level: 2, label: 'Débil', color: '#F59E0B' };
  if (pwd.length >= 8 && hasNumber && (hasUpper || hasSpecial)) return { level: 4, label: 'Segura', color: '#22c55e' };
  if (pwd.length >= 6 && (hasNumber || hasUpper)) return { level: 3, label: 'Buena', color: '#22c55e' };
  return { level: 2, label: 'Débil', color: '#F59E0B' };
};

const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const isPhone = (v) => /^[\d+\s()-]{7,20}$/.test(v);

// ─── Feature Carousel ────────────────────────────────────────────────────────
function FeatureCarousel() {
  const [idx, setIdx] = React.useState(0);
  const [visible, setVisible] = React.useState(true);

  React.useEffect(() => {
    const t = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIdx(i => (i + 1) % CAROUSEL_FEATURES.length);
        setVisible(true);
      }, 280);
    }, 4500);
    return () => clearInterval(t);
  }, []);

  const f = CAROUSEL_FEATURES[idx];

  return (
    <Box sx={{ position: 'relative', p: { md: 5, lg: 6 }, color: '#fff', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>

      {/* Brand mark — top left */}
      <Box sx={{ position: 'absolute', top: 36, left: 44 }}>
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <img src="/Logo.jpeg" alt="Ksmart360" style={{ width: 34, height: 34, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.25)', objectFit: 'cover' }} />
          <Typography sx={{ fontWeight: 900, fontSize: 18, color: '#fff', letterSpacing: -0.3 }}>Ksmart360</Typography>
          <Chip label="SaaS" size="small" sx={{ bgcolor: 'rgba(255,255,255,0.13)', color: '#fff', fontWeight: 700, fontSize: 9, height: 18, backdropFilter: 'blur(4px)', border: '1px solid rgba(255,255,255,0.15)' }} />
        </Stack>
        <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', mt: 0.5, ml: '50px' }}>Sistema de Gestión Empresarial</Typography>
      </Box>

      {/* Animated feature slide */}
      <Box sx={{
        mb: 4,
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(12px)',
        transition: 'opacity 0.28s ease, transform 0.28s ease',
      }}>
        <Chip
          label={f.tag}
          size="small"
          sx={{ bgcolor: `${f.color}25`, color: f.color, fontWeight: 800, fontSize: 10, mb: 2, border: `1px solid ${f.color}45`, letterSpacing: 0.8 }}
        />
        <Typography sx={{ fontWeight: 900, fontSize: { md: 28, lg: 34 }, lineHeight: 1.15, mb: 1.5, color: '#f1f5f9' }}>
          {f.title}
        </Typography>
        <Typography sx={{ fontSize: 14, color: 'rgba(241,245,249,0.68)', lineHeight: 1.75, maxWidth: 370, mb: 3 }}>
          {f.desc}
        </Typography>
        <Stack direction="row" spacing={3}>
          {f.stats.map(s => (
            <Box key={s.label}>
              <Typography sx={{ fontSize: 20, fontWeight: 900, color: f.color, lineHeight: 1 }}>{s.val}</Typography>
              <Typography sx={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: 0.8, mt: 0.2 }}>{s.label}</Typography>
            </Box>
          ))}
        </Stack>
      </Box>

      {/* Navigation dots */}
      <Stack direction="row" spacing={0.8} sx={{ mb: 3 }}>
        {CAROUSEL_FEATURES.map((_, i) => (
          <Box
            key={i}
            onClick={() => { setIdx(i); setVisible(true); }}
            sx={{
              width: i === idx ? 22 : 7,
              height: 7,
              borderRadius: 4,
              bgcolor: i === idx ? f.color : 'rgba(255,255,255,0.22)',
              cursor: 'pointer',
              transition: 'all 0.35s cubic-bezier(0.4,0,0.2,1)',
            }}
          />
        ))}
      </Stack>

      {/* Stats bar */}
      <Box sx={{ p: 2, borderRadius: 2.5, bgcolor: 'rgba(255,255,255,0.07)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.09)' }}>
        <Stack direction="row" justifyContent="space-around">
          {[
            { val: '500+', label: 'Negocios activos' },
            { val: '14 días', label: 'Prueba gratis' },
            { val: '99.9%', label: 'Disponibilidad' },
          ].map(s => (
            <Box key={s.label} sx={{ textAlign: 'center' }}>
              <Typography sx={{ fontWeight: 900, fontSize: 15, color: '#f1f5f9' }}>{s.val}</Typography>
              <Typography sx={{ fontSize: 10, color: 'rgba(255,255,255,0.45)' }}>{s.label}</Typography>
            </Box>
          ))}
        </Stack>
      </Box>
    </Box>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
const Login = ({ onLogin }) => {
    const [isLoginView, setIsLoginView]   = useState(true);
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading]           = useState(false);
    const [regStep, setRegStep]           = useState(1);
    const [regSuccess, setRegSuccess]     = useState(false);
    const navigate = useNavigate();

    const [loginData, setLoginData] = useState({ 
        username: localStorage.getItem('last_username') || '', 
        password: '' 
    });

    const initialRegState = {
        tipo_negocio:    'erp',
        nombre_empresa:  '',
        nit:             '', 
        pais:            'CO',
        ciudad:          '',
        tamano_negocio:  'pequeno',
        nombre_completo: '',
        email:           '',
        telefono:        '',
        username:        '',
        password:        '',
        origen:          '',
        acepta_terminos: false,
    };
    const [regData, setRegData] = useState(initialRegState);

    const updateReg = (key) => (e) =>
        setRegData((prev) => ({ ...prev, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

    const canContinueStep1 = () =>
        regData.nombre_empresa.trim().length >= 2 &&
        regData.nit.trim().length >= 5 && 
        regData.ciudad.trim().length >= 2 &&
        regData.pais &&
        regData.tamano_negocio &&
        regData.tipo_negocio;

    const canSubmitStep2 = () =>
        regData.nombre_completo.trim().length >= 3 &&
        isEmail(regData.email) &&
        isPhone(regData.telefono) &&
        regData.username.trim().length >= 3 &&
        regData.password.length >= 6 &&
        regData.acepta_terminos;

    const switchToRegister = () => {
        setIsLoginView(false);
        setRegStep(1);
    };

    const switchToLogin = () => {
        setIsLoginView(true);
        setRegStep(1);
    };

    // ── Handlers ─────────────────────────────────────────────────────────────
    const handleLoginSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const response = await apiClient.post(
                '/auth/token',
                new URLSearchParams({ username: loginData.username, password: loginData.password }),
                { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
            );
            
            localStorage.setItem('token', response.data.access_token);
            localStorage.setItem('last_username', loginData.username);
            
            onLogin();

            if (response.data.is_expired) {
                toast.warning('Tu acceso ha expirado. Redirigiendo a renovación...');
                setTimeout(() => {
                    navigate('/suscripcion-expirada');
                }, 1500);
            } else {
                toast.success('Inicio de sesión exitoso');
                navigate('/');
            }
        } catch (err) {
            const status = err.response?.status;
            const detail = err.response?.data?.detail;

            if (status === 403) {
                toast.error(detail || 'Cuenta suspendida por el administrador.');
            } else {
                toast.error(detail || 'Usuario o contraseña incorrectos');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleNextStep = () => {
        if (!canContinueStep1()) {
            toast.warning('Completa los campos del negocio para continuar.');
            return;
        }
        setRegStep(2);
    };

    const handleRegisterSubmit = async (e) => {
        e.preventDefault();
        if (!canSubmitStep2()) {
            toast.warning('Por favor revisa los datos antes de continuar.');
            return;
        }
        setLoading(true);
        try {
            await apiClient.post('/auth/register', {
                nombre_empresa:  regData.nombre_empresa.trim(),
                nit:             regData.nit.trim(), 
                username:        regData.username.trim().toLowerCase(),
                password:        regData.password,
                tipo_negocio:    regData.tipo_negocio,
                nombre_completo: regData.nombre_completo.trim(),
                email:           regData.email.trim().toLowerCase(),
                telefono:        regData.telefono.trim(),
                pais:            regData.pais,
                ciudad:          regData.ciudad.trim(),
                tamano_negocio:  regData.tamano_negocio,
                origen:          regData.origen || null,
            });
            const usernameUsed = regData.username.trim().toLowerCase();
            localStorage.setItem('last_username', usernameUsed);
            setRegSuccess(true);
            setTimeout(() => {
              setRegSuccess(false);
              setLoginData({ username: usernameUsed, password: '' });
              setRegData(initialRegState);
              setRegStep(1);
              setIsLoginView(true);
              toast.success('¡Cuenta creada! Ya puedes iniciar sesión.');
            }, 2200);
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Error al crear la cuenta.');
        } finally {
            setLoading(false);
        }
    };

    const handleBiometricSuccess = (data) => {
        localStorage.setItem('token', data.access_token);
        localStorage.setItem('last_username', data.username);

        localStorage.setItem('user', JSON.stringify({
            id:         data.user_id,
            username:   data.username,
            empresa_id: data.empresa_id,
            rol:        data.rol,
        }));

        onLogin();

        toast.success('¡Bienvenido de vuelta!');
        navigate('/');
    };

    // ── Render ───────────────────────────────────────────────────────────────
    return (
        <>
        {regSuccess && (
          <Box sx={{
            position: 'fixed', inset: 0, zIndex: 9999,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            background: 'linear-gradient(160deg, #0f172a 0%, #020617 100%)',
            animation: `${fadeIn} 0.35s ease`,
            gap: 2,
          }}>
            <Box sx={{
              width: 88, height: 88, borderRadius: '50%',
              bgcolor: 'rgba(34,197,94,0.12)',
              border: '2px solid rgba(34,197,94,0.4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              animation: `${pulseRing} 1.2s ease infinite`,
            }}>
              <CheckCircle sx={{ fontSize: 50, color: '#22c55e' }} />
            </Box>
            <Typography sx={{ fontWeight: 900, fontSize: 26, color: '#f1f5f9', letterSpacing: -0.5 }}>
              ¡Bienvenido a bordo!
            </Typography>
            <Typography sx={{ fontSize: 14, color: '#64748b', textAlign: 'center', maxWidth: 300 }}>
              Tu espacio de trabajo está listo.<br />Redirigiendo al inicio de sesión…
            </Typography>
          </Box>
        )}
        <Box sx={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden' }}>

            {/* ── Panel izquierdo (imagen hero) ── */}
            <Box sx={{
                display: { xs: 'none', md: 'flex' },
                width: '55%',
                flexShrink: 0,
                height: '100%',
                backgroundImage: "url('/images/sistema-erp.1.12.avif')",
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                position: 'relative',
                alignItems: 'flex-end',
            }}>
                <Box sx={{
                    position: 'absolute', inset: 0,
                    background: 'linear-gradient(150deg, rgba(15,23,42,0.88) 0%, rgba(2,6,23,0.62) 55%, rgba(15,23,42,0.92) 100%)',
                }} />
                <Box sx={{ position: 'relative', width: '100%', height: '100%' }}>
                    <FeatureCarousel />
                </Box>
            </Box>

            {/* ── Panel derecho (formulario) ── */}
            <Box sx={{
                flex: 1,
                minWidth: 0,
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'linear-gradient(160deg, #0f172a 0%, #020617 100%)',
                px: { xs: 3, sm: 6, lg: 8 },
                py: { xs: 3, lg: 4 },
                overflowY: 'auto',
            }}>
                <Box sx={{
                    width: '100%',
                    maxWidth: { xs: 460, lg: 520 },
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    my: 'auto',
                }}>

                    {/* Mobile branding — only on xs/sm */}
                    <Box sx={{ display: { xs: 'flex', md: 'none' }, alignItems: 'center', gap: 1.5, mb: 3, alignSelf: 'flex-start' }}>
                        <img src="/Logo.jpeg" alt="Ksmart360" style={{ width: 34, height: 34, borderRadius: '50%', border: '2px solid rgba(34,197,94,0.4)', objectFit: 'cover' }} />
                        <Box>
                            <Typography sx={{ fontWeight: 800, fontSize: 16, color: '#f1f5f9', lineHeight: 1 }}>Ksmart360</Typography>
                            <Typography sx={{ fontSize: 11, color: '#64748b' }}>14 días gratis · Sin tarjeta de crédito</Typography>
                        </Box>
                    </Box>

                    {/* ── Logo ── */}
                    <Box sx={{
                        mb: isLoginView ? 4 : 3,
                        position: 'relative',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.4s ease',
                    }}>
                        <Box sx={{
                            position: 'absolute',
                            width: isLoginView ? { xs: 140, lg: 156 } : { xs: 110, lg: 120 },
                            height: isLoginView ? { xs: 140, lg: 156 } : { xs: 110, lg: 120 },
                            borderRadius: '50%',
                            border: '1.5px solid rgba(34,197,94,0.35)',
                            animation: `${pulseRing} 3s ease-in-out infinite`,
                            transition: 'all 0.4s ease',
                        }} />
                        <Box sx={{
                            position: 'absolute',
                            width: isLoginView ? { xs: 118, lg: 132 } : { xs: 92, lg: 102 },
                            height: isLoginView ? { xs: 118, lg: 132 } : { xs: 92, lg: 102 },
                            borderRadius: '50%',
                            border: '1px solid rgba(34,197,94,0.2)',
                            transition: 'all 0.4s ease',
                        }} />
                        <img
                            src="/Logo.jpeg"
                            alt="Ksmart360"
                            style={{
                                width:        isLoginView ? 110 : 84,
                                height:       isLoginView ? 110 : 84,
                                borderRadius: '50%',
                                objectFit:    'cover',
                                border:       '3px solid rgba(34,197,94,0.55)',
                                boxShadow:    '0 0 40px rgba(34,197,94,0.25), 0 0 80px rgba(34,197,94,0.1)',
                                position:     'relative',
                                zIndex:       1,
                                transition:   'all 0.4s ease',
                            }}
                        />
                    </Box>

                    {/* ── Bloque animado: Login / Registro ── */}
                    <Box
                        key={isLoginView ? 'login' : `register-${regStep}`}
                        sx={{ animation: `${fadeIn} 0.4s cubic-bezier(0.4, 0, 0.2, 1)`, width: '100%' }}
                    >
                        <Typography sx={{
                            fontWeight: 800,
                            fontSize: { xs: 28, lg: 32 },
                            color: '#f1f5f9',
                            letterSpacing: -0.8,
                            mb: 0.5,
                            textAlign: 'center',
                        }}>
                            {isLoginView ? 'Ingresar' : (regStep === 1 ? 'Crea tu espacio' : 'Casi listo')}
                        </Typography>

                        <Typography sx={{
                            color: '#64748b',
                            fontSize: { xs: 13, lg: 14 },
                            mb: isLoginView ? 4 : 3,
                            textAlign: 'center',
                        }}>
                            {isLoginView
                                ? 'Ingresa tus credenciales para continuar'
                                : (regStep === 1
                                    ? 'Cuéntanos sobre tu negocio · 14 días gratis · Sin tarjeta'
                                    : 'Crea tu usuario para acceder a tu panel')}
                        </Typography>

                        {/* ─── PROGRESO (solo en registro) ─── */}
                        {!isLoginView && (
                            <Box sx={{ mb: 3 }}>
                                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                                    <Chip
                                        size="small"
                                        label="1 · Negocio"
                                        icon={regStep > 1 ? <CheckCircle sx={{ fontSize: 14, color: '#f97316 !important' }} /> : null}
                                        sx={{
                                            fontWeight: 700, fontSize: 11, height: 24,
                                            bgcolor: regStep >= 1 ? 'rgba(249,115,22,0.15)' : 'rgba(148,163,184,0.1)',
                                            color:   regStep >= 1 ? '#f97316' : '#64748b',
                                            border: 'none',
                                        }}
                                    />
                                    <Box sx={{
                                        flex: 1, height: 2, borderRadius: 1,
                                        bgcolor: regStep === 2 ? '#f97316' : 'rgba(148,163,184,0.15)',
                                        transition: 'all 0.3s',
                                    }} />
                                    <Chip
                                        size="small"
                                        label="2 · Cuenta"
                                        sx={{
                                            fontWeight: 700, fontSize: 11, height: 24,
                                            bgcolor: regStep === 2 ? 'rgba(249,115,22,0.15)' : 'rgba(148,163,184,0.1)',
                                            color:   regStep === 2 ? '#f97316' : '#64748b',
                                            border: 'none',
                                        }}
                                    />
                                </Stack>
                                <LinearProgress
                                    variant="determinate"
                                    value={regStep === 1 ? 50 : 100}
                                    sx={{
                                        height: 3, borderRadius: 2,
                                        bgcolor: 'rgba(148,163,184,0.1)',
                                        '& .MuiLinearProgress-bar': { bgcolor: '#f97316' },
                                    }}
                                />
                            </Box>
                        )}

                        {isLoginView ? (
                            <Box
                                component="form"
                                onSubmit={handleLoginSubmit}
                                sx={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 2.5 }}
                            >
                                <TextField
                                    fullWidth label="Usuario" required sx={fieldSx}
                                    value={loginData.username}
                                    onChange={e => setLoginData({ ...loginData, username: e.target.value })}
                                    InputProps={{ startAdornment: <InputAdornment position="start"><AlternateEmail /></InputAdornment> }}
                                />
                                <TextField
                                    fullWidth label="Contraseña"
                                    type={showPassword ? 'text' : 'password'}
                                    required sx={fieldSx}
                                    value={loginData.password}
                                    onChange={e => setLoginData({ ...loginData, password: e.target.value })}
                                    InputProps={{
                                        startAdornment: <InputAdornment position="start"><Lock /></InputAdornment>,
                                        endAdornment: (
                                            <InputAdornment position="end">
                                                <IconButton
                                                    onClick={() => setShowPassword(!showPassword)}
                                                    edge="end"
                                                    sx={{ color: '#64748b' }}
                                                >
                                                    {showPassword ? <VisibilityOff /> : <Visibility />}
                                                </IconButton>
                                            </InputAdornment>
                                        ),
                                    }}
                                />

                                <Box sx={{ textAlign: 'right', mt: -1 }}>
                                    <Typography
                                        onClick={() => toast.info('Para restablecer tu contraseña, contacta a tu administrador o escríbenos a soporte@ksmart360.com')}
                                        sx={{ fontSize: 12, color: '#22c55e', cursor: 'pointer', fontWeight: 600, display: 'inline', '&:hover': { color: '#16a34a', textDecoration: 'underline' } }}
                                    >
                                        ¿Olvidaste tu contraseña?
                                    </Typography>
                                </Box>

                                <Button
                                    type="submit" fullWidth variant="contained"
                                    disabled={loading}
                                    sx={{
                                        mt: 0.5, py: 1.8, borderRadius: 2.5,
                                        fontWeight: 700,
                                        fontSize: { xs: 15, lg: 16 },
                                        letterSpacing: 0.3,
                                        background: loading
                                            ? 'rgba(34,197,94,0.4)'
                                            : 'linear-gradient(90deg, #22c55e 0%, #16a34a 100%)',
                                        boxShadow: loading ? 'none' : '0 8px 28px rgba(34,197,94,0.3)',
                                        transition: 'all 0.25s',
                                        '&:hover:not(:disabled)': {
                                            background: 'linear-gradient(90deg, #16a34a 0%, #15803d 100%)',
                                            boxShadow: '0 12px 36px rgba(34,197,94,0.4)',
                                            transform: 'translateY(-2px)',
                                        },
                                    }}
                                >
                                    {loading ? (
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <CircularProgress size={16} sx={{ color: 'rgba(255,255,255,0.85)' }} />
                                            Ingresando…
                                        </Box>
                                    ) : 'Ingresar al sistema'}
                                </Button>

                                <BotonHuella
                                    modo="login"
                                    username={loginData.username}
                                    onSuccess={handleBiometricSuccess}
                                />

                                <Typography sx={{ mt: 1.5, color: '#94a3b8', fontSize: 13, textAlign: 'center' }}>
                                    ¿No tienes una cuenta?{' '}
                                    <span
                                        onClick={switchToRegister}
                                        style={{ color: '#22c55e', fontWeight: 700, cursor: 'pointer' }}
                                    >
                                        Regístrate gratis
                                    </span>
                                </Typography>
                            </Box>
                        ) : (
                            <Box
                                component="form"
                                onSubmit={regStep === 2 ? handleRegisterSubmit : (e) => { e.preventDefault(); handleNextStep(); }}
                                sx={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 2.2 }}
                            >
                                {/* ──────── PASO 1 — Negocio ──────── */}
                                {regStep === 1 && (
                                    <>
                                        <Grid container spacing={1.5}>
                                            {[
                                                { key: 'erp',         label: 'Comercio / ERP', Icon: Storefront,   desc: 'Ventas e Inventario'  },
                                                { key: 'prestamos',   label: 'Cobranzas',      Icon: AttachMoney,  desc: 'Rutas de Cobro'       },
                                                { key: 'parqueadero', label: 'Parqueadero',    Icon: LocalParking, desc: 'Control vehículos'    },
                                                { key: 'lavadero',    label: 'Lavadero',       Icon: LocalCarWash, desc: 'POS + productividad'  },
                                            ].map(({ key, label, Icon, desc }) => (
                                                <Grid item xs={6} key={key}>
                                                    <Card sx={{
                                                        border: regData.tipo_negocio === key
                                                            ? '2px solid #ea580c'
                                                            : '2px solid rgba(148,163,184,0.1)',
                                                        bgcolor: regData.tipo_negocio === key
                                                            ? 'rgba(234,88,12,0.1)'
                                                            : 'rgba(241,245,249,0.04)',
                                                        transition: 'all 0.2s',
                                                        borderRadius: 2.5,
                                                    }}>
                                                        <CardActionArea
                                                            onClick={() => setRegData({ ...regData, tipo_negocio: key })}
                                                            sx={{ p: 1.8, textAlign: 'center', color: '#f1f5f9' }}
                                                        >
                                                            <Icon sx={{
                                                                color: regData.tipo_negocio === key ? '#ea580c' : '#64748b',
                                                                fontSize: 26, mb: 0.5,
                                                            }} />
                                                            <Typography variant="subtitle2" fontWeight={700} fontSize={12}>
                                                                {label}
                                                            </Typography>
                                                            <Typography sx={{ fontSize: 10, color: '#64748b', mt: 0.2 }}>
                                                                {desc}
                                                            </Typography>
                                                        </CardActionArea>
                                                    </Card>
                                                </Grid>
                                            ))}
                                        </Grid>

                                        <TextField
                                            fullWidth label="Nombre del Negocio" required
                                            className="orange-field" sx={fieldSx}
                                            placeholder="Ej: Vialmar Cacao, Almacén Don José…"
                                            value={regData.nombre_empresa}
                                            onChange={updateReg('nombre_empresa')}
                                            InputProps={{ startAdornment: <InputAdornment position="start"><Business /></InputAdornment> }}
                                        />

                                        <TextField
                                            fullWidth label="NIT o Cédula de Ciudadanía" required
                                            className="orange-field" sx={fieldSx}
                                            placeholder="Ej: 901.123.456-7"
                                            value={regData.nit}
                                            onChange={updateReg('nit')}
                                            helperText="Requerido para la identificación legal de tu espacio"
                                            InputProps={{ startAdornment: <InputAdornment position="start"><CheckCircle /></InputAdornment> }}
                                        />

                                        {/* ── SOLUCIÓN: STACK en lugar de GRID para el 100% real ── */}
                                        <Stack direction="row" spacing={2} sx={{ width: '100%' }}>
                                            <Box sx={{ width: { xs: '45%', sm: '35%' } }}>
                                                <TextField
                                                    select fullWidth required label="País"
                                                    className="orange-field" sx={fieldSx}
                                                    value={regData.pais}
                                                    onChange={updateReg('pais')}
                                                    SelectProps={{
                                                        MenuProps: {
                                                            PaperProps: {
                                                                sx: { bgcolor: '#1e293b', color: '#f1f5f9', maxHeight: 300 },
                                                            },
                                                        },
                                                    }}
                                                >
                                                    {PAISES.map((p) => (
                                                        <MenuItem key={p.code} value={p.code} sx={{ color: '#f1f5f9' }}>
                                                            <span style={{ marginRight: 8 }}>{p.flag}</span>{p.label}
                                                        </MenuItem>
                                                    ))}
                                                </TextField>
                                            </Box>

                                            <Box sx={{ flex: 1 }}>
                                                <Autocomplete
                                                    options={CIUDADES_COLOMBIA}
                                                    value={regData.ciudad}
                                                    onChange={(e, newValue) => setRegData({ ...regData, ciudad: newValue || '' })}
                                                    onInputChange={(e, newInputValue) => setRegData({ ...regData, ciudad: newInputValue })}
                                                    freeSolo
                                                    renderInput={(params) => (
                                                        <TextField
                                                            {...params}
                                                            fullWidth required label="Ciudad"
                                                            className="orange-field" 
                                                            sx={{
                                                                ...fieldSx,
                                                                '& .MuiOutlinedInput-root': {
                                                                    ...fieldSx['& .MuiOutlinedInput-root'],
                                                                    pr: '35px !important' 
                                                                }
                                                            }}
                                                            placeholder="Ej: Buenaventura"
                                                            InputProps={{
                                                                ...params.InputProps,
                                                                startAdornment: (
                                                                    <>
                                                                        <InputAdornment position="start"><LocationOn /></InputAdornment>
                                                                        {params.InputProps.startAdornment}
                                                                    </>
                                                                )
                                                            }}
                                                        />
                                                    )}
                                                />
                                            </Box>
                                        </Stack>

                                        <Box>
                                            <Typography sx={{
                                                fontSize: 11, fontWeight: 700, color: '#64748b',
                                                letterSpacing: 1.4, textTransform: 'uppercase', mb: 1,
                                            }}>
                                                ¿Cuántas personas trabajan contigo?
                                            </Typography>
                                            <Grid container spacing={1}>
                                                {TAMANOS_NEGOCIO.map((t) => (
                                                    <Grid item xs={6} sm={3} key={t.value}>
                                                        <Card sx={{
                                                            border: regData.tamano_negocio === t.value
                                                                ? '2px solid #ea580c'
                                                                : '2px solid rgba(148,163,184,0.1)',
                                                            bgcolor: regData.tamano_negocio === t.value
                                                                ? 'rgba(234,88,12,0.1)'
                                                                : 'rgba(241,245,249,0.04)',
                                                            transition: 'all 0.2s',
                                                            borderRadius: 2,
                                                        }}>
                                                            <CardActionArea
                                                                onClick={() => setRegData({ ...regData, tamano_negocio: t.value })}
                                                                sx={{ p: 1.2, textAlign: 'center', color: '#f1f5f9' }}
                                                            >
                                                                <Group sx={{
                                                                    color: regData.tamano_negocio === t.value ? '#ea580c' : '#64748b',
                                                                    fontSize: 20,
                                                                }} />
                                                                <Typography sx={{ fontSize: 11, fontWeight: 700, mt: 0.2 }}>
                                                                    {t.label}
                                                                </Typography>
                                                                <Typography sx={{ fontSize: 9, color: '#64748b' }}>
                                                                    {t.desc}
                                                                </Typography>
                                                            </CardActionArea>
                                                        </Card>
                                                    </Grid>
                                                ))}
                                            </Grid>
                                        </Box>

                                        <Button
                                            type="submit" fullWidth variant="contained"
                                            disabled={!canContinueStep1()}
                                            endIcon={<ArrowForward />}
                                            sx={{
                                                mt: 0.5, py: 1.8, borderRadius: 2.5,
                                                fontWeight: 700,
                                                fontSize: { xs: 15, lg: 16 },
                                                letterSpacing: 0.3,
                                                background: !canContinueStep1()
                                                    ? 'rgba(249,115,22,0.3)'
                                                    : 'linear-gradient(90deg, #f97316 0%, #ea580c 100%)',
                                                boxShadow: !canContinueStep1() ? 'none' : '0 8px 28px rgba(249,115,22,0.3)',
                                                transition: 'all 0.25s',
                                                '&:hover:not(:disabled)': {
                                                    background: 'linear-gradient(90deg, #ea580c 0%, #c2410c 100%)',
                                                    boxShadow: '0 12px 36px rgba(249,115,22,0.4)',
                                                    transform: 'translateY(-2px)',
                                                },
                                            }}
                                        >
                                            Continuar
                                        </Button>
                                    </>
                                )}

                                {/* ──────── PASO 2 — Cuenta ──────── */}
                                {regStep === 2 && (
                                    <>
                                        <TextField
                                            fullWidth required label="Tu nombre completo"
                                            className="orange-field" sx={fieldSx}
                                            placeholder="Ej: María Pérez"
                                            value={regData.nombre_completo}
                                            onChange={updateReg('nombre_completo')}
                                            InputProps={{ startAdornment: <InputAdornment position="start"><Person /></InputAdornment> }}
                                        />

                                        <TextField
                                            fullWidth required type="email" label="Correo electrónico"
                                            className="orange-field" sx={fieldSx}
                                            placeholder="tucorreo@ejemplo.com"
                                            value={regData.email}
                                            onChange={updateReg('email')}
                                            error={regData.email.length > 0 && !isEmail(regData.email)}
                                            helperText={
                                                regData.email.length > 0 && !isEmail(regData.email)
                                                    ? 'Correo no válido'
                                                    : 'Lo usaremos para recuperar tu cuenta'
                                            }
                                            InputProps={{ startAdornment: <InputAdornment position="start"><Email /></InputAdornment> }}
                                        />

                                        <TextField
                                            fullWidth required type="tel" label="WhatsApp / Teléfono"
                                            className="orange-field" sx={fieldSx}
                                            placeholder="Ej: 300 123 4567"
                                            value={regData.telefono}
                                            onChange={updateReg('telefono')}
                                            helperText="Te avisaremos por aquí si hay algo importante"
                                            InputProps={{ startAdornment: <InputAdornment position="start"><Phone /></InputAdornment> }}
                                        />

                                        <TextField
                                            fullWidth required label="Usuario para ingresar"
                                            className="orange-field" sx={fieldSx}
                                            placeholder="Sin espacios. Ej: maria.perez"
                                            value={regData.username}
                                            onChange={(e) => setRegData({ ...regData, username: e.target.value.trim() })}
                                            helperText="Este será tu nombre para iniciar sesión"
                                            InputProps={{ startAdornment: <InputAdornment position="start"><Person /></InputAdornment> }}
                                        />

                                        <TextField
                                            fullWidth required label="Contraseña segura"
                                            type={showPassword ? 'text' : 'password'}
                                            className="orange-field" sx={fieldSx}
                                            value={regData.password}
                                            onChange={updateReg('password')}
                                            helperText="Mínimo 6 caracteres"
                                            InputProps={{
                                                startAdornment: <InputAdornment position="start"><Lock /></InputAdornment>,
                                                endAdornment: (
                                                    <InputAdornment position="end">
                                                        <IconButton
                                                            onClick={() => setShowPassword(!showPassword)}
                                                            edge="end"
                                                            sx={{ color: '#64748b' }}
                                                        >
                                                            {showPassword ? <VisibilityOff /> : <Visibility />}
                                                        </IconButton>
                                                    </InputAdornment>
                                                ),
                                            }}
                                        />

                                        <TextField
                                            select fullWidth label="¿Cómo nos conociste? (opcional)"
                                            className="orange-field" sx={fieldSx}
                                            value={regData.origen}
                                            onChange={updateReg('origen')}
                                            SelectProps={{
                                                MenuProps: {
                                                    PaperProps: {
                                                        sx: { bgcolor: '#1e293b', color: '#f1f5f9', maxHeight: 280 },
                                                    },
                                                },
                                            }}
                                        >
                                            <MenuItem value="" sx={{ color: '#94a3b8' }}>Prefiero no decir</MenuItem>
                                            {ORIGENES.map((o) => (
                                                <MenuItem key={o} value={o} sx={{ color: '#f1f5f9' }}>{o}</MenuItem>
                                            ))}
                                        </TextField>

                                        {/* ✅ ACEPTACIÓN LEGAL */}
                                        <Box sx={{ textAlign: 'left', mt: 1 }}>
                                            <FormControlLabel
                                                control={
                                                    <Checkbox 
                                                        checked={regData.acepta_terminos} 
                                                        onChange={updateReg('acepta_terminos')}
                                                        sx={{ color: '#f97316', '&.Mui-checked': { color: '#f97316' } }}
                                                    />
                                                }
                                                label={
                                                    <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                                                        Acepto los <Link to="/terminos" target="_blank" style={{ color: '#f97316', fontWeight: 700 }}>Términos</Link>, la <Link to="/privacidad" target="_blank" style={{ color: '#f97316', fontWeight: 700 }}>Privacidad</Link> y el <Link to="/habeas-data" target="_blank" style={{ color: '#f97316', fontWeight: 700 }}>Tratamiento de Datos</Link>.
                                                    </Typography>
                                                }
                                            />
                                        </Box>

                                        <Stack direction="row" spacing={1.5} sx={{ mt: 0.5 }}>
                                            <Button
                                                variant="outlined"
                                                startIcon={<ArrowBack />}
                                                onClick={() => setRegStep(1)}
                                                disabled={loading}
                                                sx={{
                                                    py: 1.8, borderRadius: 2.5, fontWeight: 700, flex: 0.6,
                                                    color: '#94a3b8',
                                                    borderColor: 'rgba(148,163,184,0.3)',
                                                    '&:hover': {
                                                        borderColor: '#94a3b8',
                                                        bgcolor: 'rgba(148,163,184,0.08)',
                                                    },
                                                }}
                                            >
                                                Atrás
                                            </Button>
                                            <Button
                                                type="submit" variant="contained"
                                                disabled={loading || !canSubmitStep2()}
                                                sx={{
                                                    py: 1.8, borderRadius: 2.5,
                                                    fontWeight: 700,
                                                    fontSize: { xs: 14, lg: 15 },
                                                    letterSpacing: 0.3,
                                                    flex: 1.4,
                                                    background: (loading || !canSubmitStep2())
                                                        ? 'rgba(249,115,22,0.3)'
                                                        : 'linear-gradient(90deg, #f97316 0%, #ea580c 100%)',
                                                    boxShadow: (loading || !canSubmitStep2()) ? 'none' : '0 8px 28px rgba(249,115,22,0.3)',
                                                    transition: 'all 0.25s',
                                                    '&:hover:not(:disabled)': {
                                                        background: 'linear-gradient(90deg, #ea580c 0%, #c2410c 100%)',
                                                        boxShadow: '0 12px 36px rgba(249,115,22,0.4)',
                                                        transform: 'translateY(-2px)',
                                                    },
                                                }}
                                            >
                                                {loading ? 'Configurando…' : 'Crear mi cuenta'}
                                            </Button>
                                        </Stack>
                                    </>
                                )}

                                <Typography sx={{ mt: 1, color: '#94a3b8', fontSize: 13, textAlign: 'center' }}>
                                    ¿Ya tienes una cuenta?{' '}
                                    <span
                                        onClick={switchToLogin}
                                        style={{ color: '#f97316', fontWeight: 700, cursor: 'pointer' }}
                                    >
                                        Inicia sesión aquí
                                    </span>
                                </Typography>

                                <Stack direction="row" spacing={2} justifyContent="center" sx={{ mt: 1, opacity: 0.85 }}>
                                    <Typography sx={{ fontSize: 10, color: '#94a3b8', fontWeight: 500 }}>🔒 Datos cifrados</Typography>
                                    <Typography sx={{ fontSize: 10, color: '#94a3b8', fontWeight: 500 }}>✓ Sin tarjeta</Typography>
                                    <Typography sx={{ fontSize: 10, color: '#94a3b8', fontWeight: 500 }}>📧 Cancela cuando quieras</Typography>
                                </Stack>
                            </Box>
                        )}
                    </Box>

                    <Typography sx={{ mt: 4, color: '#64748b', fontSize: 12, textAlign: 'center', fontWeight: 500, letterSpacing: 0.5 }}>
                        Powered by KSMP Systems · 2026
                    </Typography>
                </Box>
            </Box>
        </Box>
        </>
    );
};

export default Login;