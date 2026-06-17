import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import apiClient from '../../api';
import {
    Box, TextField, Button, Typography, InputAdornment, IconButton,
    Grid, Card, CardActionArea, MenuItem, LinearProgress, Stack, Chip,
    Autocomplete, FormControlLabel, Checkbox, CircularProgress, Divider, Dialog,
    DialogTitle, DialogContent, DialogActions,
} from '@mui/material';
import { keyframes } from '@mui/system';
import {
    Visibility, VisibilityOff, AlternateEmail, Lock, Business, Person,
    Storefront, AttachMoney, Email, Phone, LocationOn, Group,
    ArrowForward, ArrowBack, CheckCircle, LocalParking, LocalCarWash, Pin,
    TableRestaurant, VpnKey, VerifiedUser, ManageAccounts,
} from '@mui/icons-material';
import { Link } from 'react-router-dom';

import BotonHuella from '../../components/common/BotonHuella';
import { CIUDADES_COLOMBIA } from '../../utils/colombiaData';

// ─── Sistema de diseño ───────────────────────────────────────────────────────
// Stack tipográfico tipo Apple (SF Pro → Inter → system) para sensación premium.
const APPLE_FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Inter", "Segoe UI", Roboto, system-ui, sans-serif';
// Curva spring de Apple (overshoot sutil) para transiciones con vida.
const SPRING = 'cubic-bezier(0.34, 1.56, 0.64, 1)';
const BRAND_CYAN = '#1ec8e0';

// ─── Animaciones ─────────────────────────────────────────────────────────────
const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(14px) scale(0.985); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
`;

const pulseRing = keyframes`
  0%   { transform: scale(1);    opacity: 0.55; }
  50%  { transform: scale(1.07); opacity: 0.18; }
  100% { transform: scale(1);    opacity: 0.55; }
`;

// Aurora ambiental: blobs que respiran lentamente en el fondo.
const auroraFloat = keyframes`
  0%   { transform: translate(0, 0) scale(1);       opacity: 0.55; }
  33%  { transform: translate(30px, -24px) scale(1.12); opacity: 0.7; }
  66%  { transform: translate(-20px, 18px) scale(0.95); opacity: 0.45; }
  100% { transform: translate(0, 0) scale(1);       opacity: 0.55; }
`;

const slideUp = keyframes`
  from { opacity: 0; transform: translateY(18px); }
  to   { opacity: 1; transform: translateY(0); }
`;

// ─── Estilos de campo reutilizables ──────────────────────────────────────────
const fieldSx = {
    '& .MuiInputLabel-root': {
        color: '#8b97a8', fontSize: 14, fontWeight: 500,
        letterSpacing: 0, textTransform: 'none',
    },
    '& .MuiInputLabel-root.Mui-focused': { color: '#22c55e', fontWeight: 600 },
    '& .MuiFormHelperText-root': { color: '#64748b', fontSize: 12, mt: 0.6, ml: 0.5 },
    '& .MuiFormHelperText-root.Mui-error': { color: '#f87171' },
    '& .MuiOutlinedInput-root': {
        borderRadius: 3,
        backgroundColor: 'rgba(255, 255, 255, 0.035)',
        backdropFilter: 'blur(12px)',
        color: '#f1f5f9',
        fontSize: 15,
        transition: 'border-color 0.2s ease, box-shadow 0.25s ease, background-color 0.2s ease',
        '& input': {
            padding: '15px 14px',
            color: '#f1f5f9',
            WebkitTextFillColor: '#f1f5f9',
            caretColor: '#22c55e',
            '&:-webkit-autofill': {
                WebkitBoxShadow: '0 0 0 100px #141c2e inset',
                WebkitTextFillColor: '#f1f5f9',
                caretColor: '#22c55e',
                borderRadius: 'inherit',
            },
        },
        '& fieldset': { borderColor: 'rgba(148, 163, 184, 0.16)', borderWidth: 1.5 },
        '&:hover': { backgroundColor: 'rgba(255, 255, 255, 0.05)' },
        '&:hover fieldset': { borderColor: 'rgba(148, 163, 184, 0.38)' },
        '&.Mui-focused': { boxShadow: '0 0 0 4px rgba(34, 197, 94, 0.12)' },
        '&.Mui-focused fieldset': { borderColor: '#22c55e', borderWidth: 1.5 },
        '&.Mui-error fieldset': { borderColor: '#f87171' },
        '&.Mui-error.Mui-focused': { boxShadow: '0 0 0 4px rgba(248, 113, 113, 0.12)' },
    },
    '& .MuiInputAdornment-root .MuiSvgIcon-root': { color: '#5b6b80', fontSize: 19, transition: 'color 0.2s ease' },
    '& .MuiOutlinedInput-root.Mui-focused .MuiInputAdornment-root .MuiSvgIcon-root': { color: '#22c55e' },
    '&.orange-field': {
        '& .MuiInputLabel-root.Mui-focused': { color: '#f97316' },
        '& .MuiOutlinedInput-root.Mui-focused': { boxShadow: '0 0 0 4px rgba(249, 115, 22, 0.12)' },
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
  const hasLower   = /[a-z]/.test(pwd);
  const hasNumber  = /[0-9]/.test(pwd);
  const hasSpecial = /[^A-Za-z0-9]/.test(pwd);
  const score = [pwd.length >= 8, hasUpper, hasLower, hasNumber, hasSpecial].filter(Boolean).length;
  if (pwd.length < 4)  return { level: 1, label: 'Muy débil',  color: '#EF4444' };
  if (pwd.length < 8)  return { level: 2, label: 'Débil — usa mín. 8 caracteres', color: '#F59E0B' };
  if (score >= 5)      return { level: 5, label: 'Muy segura ✓', color: '#22c55e' };
  if (score >= 4)      return { level: 4, label: 'Segura',        color: '#84cc16' };
  if (score >= 3)      return { level: 3, label: 'Aceptable',     color: '#F59E0B' };
  return                      { level: 2, label: 'Débil',        color: '#F59E0B' };
};

const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const isPhone = (v) => /^[\d+\s()-]{7,20}$/.test(v);
const isUsername = (v) => /^[a-zA-Z0-9._-]{3,30}$/.test(v);

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
          <img src="/logos/svg/ksmart-icon-rounded.svg" alt="Ksmart360" style={{ width: 34, height: 34, borderRadius: 8 }} />
          <Typography sx={{ fontWeight: 900, fontSize: 18, color: '#fff', letterSpacing: -0.3 }}>Ksmart360</Typography>
          <Chip label="SaaS" size="small" sx={{ bgcolor: 'rgba(255,255,255,0.13)', color: '#fff', fontWeight: 700, fontSize: 9, height: 18, backdropFilter: 'blur(4px)', border: '1px solid rgba(255,255,255,0.15)' }} />
        </Stack>
        <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', mt: 0.5, ml: '50px' }}>Sistema de Gestión Empresarial</Typography>
      </Box>

      {/* Animated feature slide */}
      <Box sx={{
        mb: 4,
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0) scale(1)' : 'translateY(16px) scale(0.98)',
        filter: visible ? 'blur(0px)' : 'blur(2px)',
        transition: 'opacity 0.32s ease, transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), filter 0.32s ease',
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

// ─── PIN Numpad (login rápido) ────────────────────────────────────────────────
const PIN_GREEN = '#10B981';

function PinNumpad({ username, onSuccess, onCancel }) {
    const pinLength = parseInt(localStorage.getItem('pin_length') || '4', 10);
    const [pin, setPin] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const addDigit = (d) => {
        if (pin.length < pinLength) setPin(p => p + d);
    };
    const removeDigit = () => setPin(p => p.slice(0, -1));

    const handleVerify = useCallback(async (currentPin) => {
        setLoading(true);
        setError('');
        try {
            const { data } = await apiClient.post('/auth/pin/verify', { username, pin: currentPin });
            onSuccess(data);
        } catch (err) {
            const msg = err.response?.data?.detail || 'PIN incorrecto.';
            setError(msg);
            setPin('');
        } finally {
            setLoading(false);
        }
    }, [username, onSuccess]);

    // Auto-submit al completar exactamente los dígitos configurados
    React.useEffect(() => {
        if (pin.length === pinLength) handleVerify(pin);
    }, [pin, pinLength, handleVerify]);

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', animation: `${fadeIn} 0.3s ease` }}>
            <Typography sx={{ fontSize: 14, fontWeight: 600, color: '#94a3b8', mb: 0.5 }}>
                PIN de acceso rápido
            </Typography>
            <Typography sx={{ fontSize: 12, color: '#64748b', mb: 2.5 }}>
                {username}
            </Typography>

            {/* Indicadores — exactamente pinLength slots */}
            <Box sx={{ display: 'flex', gap: 1.5, mb: 2.5 }}>
                {Array.from({ length: pinLength }).map((_, i) => (
                    <Box key={i} sx={{
                        width: 38, height: 46, borderRadius: 1.5,
                        border: `2px solid ${i < pin.length ? PIN_GREEN : 'rgba(255,255,255,0.15)'}`,
                        bgcolor: i < pin.length ? `${PIN_GREEN}20` : 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'all 0.12s ease',
                    }}>
                        {i < pin.length && <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: PIN_GREEN }} />}
                    </Box>
                ))}
            </Box>

            {error && (
                <Typography sx={{ fontSize: 12, color: '#f87171', mb: 1.5, textAlign: 'center' }}>
                    {error}
                </Typography>
            )}

            {/* Teclado */}
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1.2, maxWidth: 220, mb: 2 }}>
                {[1,2,3,4,5,6,7,8,9].map(d => (
                    <Button key={d}
                        onClick={() => addDigit(String(d))}
                        disabled={loading || pin.length >= pinLength}
                        sx={{
                            height: 50, borderRadius: 2,
                            bgcolor: 'rgba(255,255,255,0.06)',
                            color: '#e2e8f0', fontSize: 20, fontWeight: 700,
                            '&:hover': { bgcolor: 'rgba(255,255,255,0.12)' },
                            '&:disabled': { opacity: 0.4 },
                        }}>
                        {d}
                    </Button>
                ))}
                <Box />
                <Button onClick={() => addDigit('0')} disabled={loading || pin.length >= pinLength}
                    sx={{ height: 50, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.06)', color: '#e2e8f0', fontSize: 20, fontWeight: 700, '&:hover': { bgcolor: 'rgba(255,255,255,0.12)' }, '&:disabled': { opacity: 0.4 } }}>
                    0
                </Button>
                <Button onClick={removeDigit} disabled={loading}
                    sx={{ height: 50, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.06)', color: '#94a3b8', fontSize: 18 }}>
                    ⌫
                </Button>
            </Box>

            {loading && <CircularProgress size={20} sx={{ color: PIN_GREEN, mb: 1.5 }} />}

            <Button onClick={onCancel} sx={{ color: '#64748b', fontSize: 12, textTransform: 'none' }}>
                Usar contraseña en su lugar
            </Button>
        </Box>
    );
}

// ─── Componente principal ─────────────────────────────────────────────────────
const Login = ({ onLogin }) => {
    const [isLoginView, setIsLoginView]   = useState(true);
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading]           = useState(false);
    const [loginFailed, setLoginFailed]   = useState(false);
    const [regStep, setRegStep]           = useState(1);
    const [regSuccess, setRegSuccess]     = useState(false);
    const [rememberMe, setRememberMe]     = useState(false);
    const [forgotOpen, setForgotOpen]     = useState(false);
    const [recov, setRecov] = useState({
        step: 0, username: '', hints: {}, nombreCompleto: '',
        empresaNombre: '', empresaNit: '', recoveryToken: '',
        nuevaPassword: '', confirmarPassword: '', loading: false, error: '',
    });
    const resetRecov = () => setRecov({
        step: 0, username: '', hints: {}, nombreCompleto: '',
        empresaNombre: '', empresaNit: '', recoveryToken: '',
        nuevaPassword: '', confirmarPassword: '', loading: false, error: '',
    });
    const [showRecovPwd, setShowRecovPwd]           = useState(false);
    const [showRecovConfirm, setShowRecovConfirm]   = useState(false);
    const [showLoginNitField, setShowLoginNitField] = useState(false);
    const [loginNit, setLoginNit]                   = useState('');
    const [pinMode, setPinMode]           = useState(() => {
        // Mostrar PIN si el usuario tiene PIN configurado y hay username guardado
        return localStorage.getItem('pin_configured') === 'true'
            && !!localStorage.getItem('last_username');
    });
    const navigate = useNavigate();

    const [loginData, setLoginData] = useState({
        username: localStorage.getItem('last_username') || '',
        password: ''
    });

    const initialRegState = {
        tipo_negocio:    '',
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
        confirmPassword: '',
        origen:          '',
        acepta_terminos: false,
    };
    const [regData, setRegData] = useState(initialRegState);

    const updateReg = (key) => (e) => {
        const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
        setRegData((prev) => {
            const next = { ...prev, [key]: value };
            // Auto-sugerir username desde nombre_completo
            if (key === 'nombre_completo') {
                const autoUser = value
                    .toLowerCase()
                    .normalize('NFD').replace(/[̀-ͯ]/g, '')
                    .trim()
                    .split(/\s+/)
                    .slice(0, 2)
                    .join('.');
                const cleanUser = autoUser.replace(/[^a-z0-9._-]/g, '');
                const prevAuto = (prev.nombre_completo || '')
                    .toLowerCase()
                    .normalize('NFD').replace(/[̀-ͯ]/g, '')
                    .trim()
                    .split(/\s+/)
                    .slice(0, 2)
                    .join('.')
                    .replace(/[^a-z0-9._-]/g, '');
                if (!prev.username || prev.username === prevAuto) {
                    next.username = cleanUser;
                }
            }
            return next;
        });
    };

    const [step1Attempted, setStep1Attempted] = useState(false);
    const [step1Touched, setStep1Touched] = useState({});
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const touchField = (field) => setStep1Touched(prev => ({ ...prev, [field]: true }));
    const showFieldError = (field) => (step1Attempted || step1Touched[field]) && step1Errors[field];

    const step1Errors = {
        tipo_negocio:   !regData.tipo_negocio,
        nombre_empresa: regData.nombre_empresa.trim().length < 2,
        nit:            regData.nit.trim().length < 5,
        ciudad:         regData.ciudad.trim().length < 2,
    };

    const canContinueStep1 = () =>
        !step1Errors.tipo_negocio &&
        !step1Errors.nombre_empresa &&
        !step1Errors.nit &&
        !step1Errors.ciudad &&
        !!regData.pais &&
        !!regData.tamano_negocio;

    const pwdMatch = regData.confirmPassword.length > 0 && regData.password !== regData.confirmPassword;

    const canSubmitStep2 = () =>
        regData.nombre_completo.trim().length >= 3 &&
        isEmail(regData.email) &&
        isPhone(regData.telefono) &&
        regData.username.trim().length >= 3 &&
        regData.password.length >= 8 &&
        regData.password === regData.confirmPassword &&
        regData.acepta_terminos;

    const switchToRegister = () => {
        setIsLoginView(false);
        setRegStep(1);
    };

    const switchToLogin = () => {
        setIsLoginView(true);
        setRegStep(1);
    };

    // ─── Helper compartido para manejar la sesión post-login ─────────────────
    const handleAuthSuccess = (data, successMsg = 'Inicio de sesión exitoso') => {
        localStorage.setItem('token', data.access_token);
        localStorage.setItem('last_username', data.username || loginData.username);
        onLogin();
        if (data.is_expired) {
            toast.warning('Tu acceso ha expirado. Redirigiendo a renovación...');
            setTimeout(() => navigate('/suscripcion-expirada'), 1500);
        } else {
            toast.success(successMsg);
            navigate('/');
        }
    };

    // ── Handlers ─────────────────────────────────────────────────────────────
    const handleLoginSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const qp = [];
            if (rememberMe) qp.push('remember_me=true');
            if (showLoginNitField && loginNit.trim()) qp.push(`empresa_nit=${encodeURIComponent(loginNit.trim())}`);
            const url = `/auth/token${qp.length ? '?' + qp.join('&') : ''}`;
            const response = await apiClient.post(
                url,
                new URLSearchParams({ username: loginData.username, password: loginData.password }),
                { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
            );
            setShowLoginNitField(false);
            setLoginNit('');
            handleAuthSuccess({ ...response.data, username: loginData.username }, 'Inicio de sesión exitoso');
        } catch (err) {
            const httpStatus = err.response?.status;
            const detail = err.response?.data?.detail;
            if (httpStatus === 403) {
                toast.error(detail || 'Cuenta suspendida por el administrador.');
            } else if (httpStatus === 409 && detail === 'EMPRESA_REQUERIDA') {
                setShowLoginNitField(true);
                setLoginData(d => ({ ...d, password: '' }));
                toast.info('Hay varias cuentas con ese usuario. Ingresa el NIT de tu empresa para continuar.');
            } else {
                toast.error(detail || 'Usuario o contraseña incorrectos');
                setLoginFailed(true);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleNextStep = () => {
        setStep1Attempted(true);
        if (!canContinueStep1()) return;
        setStep1Attempted(false);
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
            const usernameUsed = regData.username.trim().toLowerCase();
            const passwordUsed = regData.password;

            await apiClient.post('/auth/register', {
                nombre_empresa:  regData.nombre_empresa.trim(),
                nit:             regData.nit.trim(),
                tipo_negocio:    regData.tipo_negocio || 'erp',
                username:        usernameUsed,
                password:        passwordUsed,
                nombre_completo: regData.nombre_completo.trim(),
                email:           regData.email.trim().toLowerCase(),
                telefono:        regData.telefono.trim(),
                pais:            regData.pais,
                ciudad:          regData.ciudad.trim(),
                tamano_negocio:  regData.tamano_negocio,
                origen:          regData.origen || null,
            });

            // Auto-login: entrar directo al sistema sin pasar por el login
            localStorage.setItem('last_username', usernameUsed);
            const loginRes = await apiClient.post(
                '/auth/token',
                new URLSearchParams({ username: usernameUsed, password: passwordUsed }),
                { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
            );
            setRegData(initialRegState);
            setRegStep(1);
            // Mostrar pantalla de bienvenida 2.2s y luego entrar al sistema
            setRegSuccess(true);
            setTimeout(() => {
                setRegSuccess(false);
                handleAuthSuccess({ ...loginRes.data, username: usernameUsed }, '¡Bienvenido a KSmart360!');
            }, 2200);
        } catch (error) {
            const detail = error.response?.data?.detail;
            const msg = Array.isArray(detail)
                ? detail.map(e => e.msg).join(' | ')
                : (detail || 'Error al crear la cuenta.');
            toast.error(msg);
        } finally {
            setLoading(false);
        }
    };

    const handleBiometricSuccess = (data) => {
        handleAuthSuccess(data, '¡Bienvenido de vuelta!');
    };

    // ── Recuperación de contraseña nativa (sin email) ─────────────────────────
    const recovBuscar = async () => {
        if (!recov.username.trim() || !recov.empresaNit.trim()) return;
        setRecov(s => ({ ...s, loading: true, error: '' }));
        try {
            const { data } = await apiClient.post('/auth/recover/buscar', {
                username: recov.username.trim(),
                empresa_nit: recov.empresaNit.trim(),
            });
            setRecov(s => ({ ...s, step: 1, hints: data.hints, empresaNombre: data.empresa_nombre || '', loading: false }));
        } catch (err) {
            setRecov(s => ({ ...s, loading: false, error: err.response?.data?.detail || 'Error al buscar usuario.' }));
        }
    };

    const recovVerificar = async () => {
        setRecov(s => ({ ...s, loading: true, error: '' }));
        try {
            const { data } = await apiClient.post('/auth/recover/verificar', {
                username: recov.username.trim(),
                empresa_nit: recov.empresaNit.trim(),
                nombre_completo: recov.nombreCompleto.trim(),
            });
            setRecov(s => ({ ...s, step: 2, recoveryToken: data.recovery_token, loading: false }));
        } catch (err) {
            setRecov(s => ({ ...s, loading: false, error: err.response?.data?.detail || 'No se pudo verificar la identidad.' }));
        }
    };

    const recovCambiar = async () => {
        if (recov.nuevaPassword !== recov.confirmarPassword) {
            setRecov(s => ({ ...s, error: 'Las contraseñas no coinciden.' }));
            return;
        }
        if (!recov.nuevaPassword) {
            setRecov(s => ({ ...s, error: 'Ingresa una nueva contraseña.' }));
            return;
        }
        setRecov(s => ({ ...s, loading: true, error: '' }));
        try {
            const { data: cambioData } = await apiClient.post('/auth/recover/cambiar', {
                recovery_token: recov.recoveryToken,
                nueva_password: recov.nuevaPassword,
            });
            // Auto-login con la nueva contraseña — pasar NIT para desambiguar si hay otro usuario con mismo nombre
            const params = new URLSearchParams();
            params.append('username', cambioData.username || recov.username.trim());
            params.append('password', recov.nuevaPassword);
            const nitQ = recov.empresaNit.trim() ? `?empresa_nit=${encodeURIComponent(recov.empresaNit.trim())}` : '';
            const { data: tokenData } = await apiClient.post(`/auth/token${nitQ}`, params, {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            });
            setForgotOpen(false);
            resetRecov();
            handleAuthSuccess(tokenData, '¡Contraseña cambiada! Bienvenido de vuelta.');
        } catch (err) {
            setRecov(s => ({ ...s, loading: false, error: err.response?.data?.detail || 'Error al cambiar la contraseña.' }));
        }
    };

    const handlePinSuccess = (data) => {
        handleAuthSuccess(data, '¡Acceso con PIN exitoso!');
    };

    // ── Render ───────────────────────────────────────────────────────────────
    return (
        <>
        {regSuccess && (
          <Box sx={{
            position: 'fixed', inset: 0, zIndex: 9999,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            fontFamily: APPLE_FONT,
            background: 'radial-gradient(circle at 50% 38%, #131d33 0%, #0b1120 50%, #050810 100%)',
            animation: `${fadeIn} 0.45s ${SPRING}`,
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
        <Box sx={{
            display: 'flex',
            position: 'fixed', inset: 0,      /* anclado al viewport — nunca crea scrollbars en el doc */
            overflow: 'hidden',
            fontFamily: APPLE_FONT,
            '& .MuiTypography-root, & .MuiInputBase-root, & .MuiButton-root, & .MuiInputLabel-root, & .MuiFormHelperText-root, & input, & .MuiChip-label': {
                fontFamily: APPLE_FONT,
            },
        }}>

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
                {/* Overlay base + tinte de marca cyan en las esquinas para cohesión cromática */}
                <Box sx={{
                    position: 'absolute', inset: 0,
                    background: 'linear-gradient(150deg, rgba(10,15,28,0.90) 0%, rgba(5,8,16,0.58) 52%, rgba(10,15,28,0.94) 100%)',
                }} />
                <Box sx={{
                    position: 'absolute', inset: 0, pointerEvents: 'none',
                    background: 'radial-gradient(circle at 18% 88%, rgba(30,200,224,0.18) 0%, transparent 42%)',
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
                overflow: 'hidden',          /* recorta los blobs — sin scroll en este nivel */
                position: 'relative',
                background: 'radial-gradient(circle at 50% 0%, #131d33 0%, #0b1120 45%, #050810 100%)',
            }}>
                {/* Aurora ambiental — contenida dentro del panel */}
                <Box sx={{
                    position: 'absolute', top: '-5%', right: '-8%',
                    width: 320, height: 320, borderRadius: '50%', pointerEvents: 'none',
                    background: 'radial-gradient(circle, rgba(30,200,224,0.16) 0%, transparent 70%)',
                    filter: 'blur(18px)',
                    animation: `${auroraFloat} 16s ease-in-out infinite`,
                }} />
                <Box sx={{
                    position: 'absolute', bottom: '-5%', left: '-8%',
                    width: 280, height: 280, borderRadius: '50%', pointerEvents: 'none',
                    background: 'radial-gradient(circle, rgba(34,197,94,0.12) 0%, transparent 70%)',
                    filter: 'blur(20px)',
                    animation: `${auroraFloat} 20s ease-in-out infinite reverse`,
                }} />

                {/* Área de scroll real — solo el contenido del formulario desplaza */}
                <Box sx={{
                    position: 'absolute', inset: 0,
                    overflowY: 'auto', overflowX: 'hidden',
                    px: { xs: 3, sm: 6, lg: 8 },
                    '&::-webkit-scrollbar': { width: 0 },   /* scrollbar invisible en webkit */
                    scrollbarWidth: 'none',                  /* Firefox */
                }}>
                <Box sx={{
                    width: '100%',
                    maxWidth: { xs: 460, lg: 520 },
                    mx: 'auto',
                    minHeight: '100%',
                    position: 'relative',
                    zIndex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    py: { xs: 4, lg: 4 },
                }}>

                    {/* Mobile branding — only on xs/sm */}
                    <Box sx={{ display: { xs: 'flex', md: 'none' }, alignItems: 'center', gap: 1.5, mb: 3, alignSelf: 'flex-start' }}>
                        <img src="/logos/svg/ksmart-icon-rounded.svg" alt="Ksmart360" style={{ width: 34, height: 34, borderRadius: '50%' }} />
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
                        transition: `all 0.5s ${SPRING}`,
                        width:     isLoginView ? { xs: 132, lg: 144 } : { xs: 108, lg: 116 },
                        height:    isLoginView ? { xs: 132, lg: 144 } : { xs: 108, lg: 116 },
                        flexShrink: 0,
                    }}>
                        {/* Halo ambiental difuminado detrás del logo */}
                        <Box sx={{
                            position: 'absolute', inset: -8, borderRadius: '50%',
                            background: `radial-gradient(circle, ${BRAND_CYAN}33 0%, transparent 68%)`,
                            filter: 'blur(14px)',
                        }} />
                        {/* Único anillo elegante que respira */}
                        <Box sx={{
                            position: 'absolute', inset: 0,
                            borderRadius: '50%',
                            border: `1.5px solid ${BRAND_CYAN}40`,
                            animation: `${pulseRing} 3.4s ease-in-out infinite`,
                            transition: `all 0.5s ${SPRING}`,
                        }} />
                        <img
                            src="/logos/svg/ksmart-icon-rounded.svg"
                            alt="Ksmart360"
                            style={{
                                width:        isLoginView ? '74%' : '72%',
                                height:       isLoginView ? '74%' : '72%',
                                borderRadius: '28%',
                                boxShadow:    '0 8px 32px rgba(30,200,224,0.28), 0 0 64px rgba(30,200,224,0.10)',
                                position:     'relative',
                                zIndex:       1,
                                transition:   `all 0.5s ${SPRING}`,
                            }}
                        />
                    </Box>

                    {/* ── Bloque animado: Login / Registro ── */}
                    <Box
                        key={isLoginView ? 'login' : `register-${regStep}`}
                        sx={{ animation: `${fadeIn} 0.5s ${SPRING}`, width: '100%' }}
                    >
                        <Typography sx={{
                            fontWeight: 700,
                            fontSize: { xs: 30, lg: 36 },
                            color: '#f8fafc',
                            letterSpacing: -1.1,
                            lineHeight: 1.1,
                            mb: 0.75,
                            textAlign: 'center',
                        }}>
                            {isLoginView ? 'Bienvenido de nuevo' : (regStep === 1 ? 'Crea tu espacio' : 'Casi listo')}
                        </Typography>

                        <Typography sx={{
                            color: '#94a3b8',
                            fontSize: { xs: 14, lg: 15 },
                            fontWeight: 400,
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
                            <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 2.5 }}>

                                {/* ─── Modo PIN ─── */}
                                {pinMode && loginData.username ? (
                                    <PinNumpad
                                        username={loginData.username}
                                        onSuccess={handlePinSuccess}
                                        onCancel={() => setPinMode(false)}
                                    />
                                ) : (
                                <Box
                                    component="form"
                                    onSubmit={handleLoginSubmit}
                                    sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}
                                >
                                <TextField
                                    fullWidth label="Usuario" required sx={fieldSx}
                                    value={loginData.username}
                                    onChange={e => {
                                        setLoginData({ ...loginData, username: e.target.value });
                                        if (showLoginNitField) { setShowLoginNitField(false); setLoginNit(''); }
                                    }}
                                    InputProps={{ startAdornment: <InputAdornment position="start"><AlternateEmail /></InputAdornment> }}
                                />
                                {showLoginNitField && (
                                    <Box sx={{ animation: `${slideUp} 0.25s ease` }}>
                                        <Typography sx={{ fontSize: 12, color: '#f59e0b', mb: 1, fontWeight: 600 }}>
                                            Hay varias empresas con ese usuario. Ingresa el NIT de tu empresa para continuar.
                                        </Typography>
                                        <TextField
                                            fullWidth autoFocus label="NIT de tu empresa" required sx={fieldSx}
                                            value={loginNit}
                                            onChange={e => {
                                                const raw = e.target.value.replace(/[^0-9-]/g, '');
                                                const parts = raw.split('-');
                                                const clean = parts.length > 2 ? parts[0] + '-' + parts.slice(1).join('') : raw;
                                                setLoginNit(clean);
                                            }}
                                            placeholder="Ej: 901123456-7"
                                            InputProps={{ startAdornment: <InputAdornment position="start"><Business /></InputAdornment> }}
                                        />
                                    </Box>
                                )}
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

                                {/* Recordar sesión + ¿Olvidaste tu contraseña? */}
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: -1 }}>
                                    <FormControlLabel
                                        control={
                                            <Checkbox
                                                checked={rememberMe}
                                                onChange={e => setRememberMe(e.target.checked)}
                                                size="small"
                                                sx={{
                                                    color: 'rgba(255,255,255,0.3)',
                                                    '&.Mui-checked': { color: '#22c55e' },
                                                    padding: '4px',
                                                }}
                                            />
                                        }
                                        label={
                                            <Typography sx={{ fontSize: 12, color: '#64748b', fontWeight: 500 }}>
                                                Recordar sesión
                                            </Typography>
                                        }
                                    />
                                    <Typography
                                        onClick={() => { resetRecov(); setForgotOpen(true); }}
                                        sx={{ fontSize: 12, color: '#22c55e', cursor: 'pointer', fontWeight: 600, '&:hover': { color: '#16a34a', textDecoration: 'underline' } }}
                                    >
                                        ¿Olvidaste tu contraseña?
                                    </Typography>
                                </Box>

                                <Button
                                    type="submit" fullWidth variant="contained"
                                    disabled={loading}
                                    sx={{
                                        mt: 0.5, py: 1.7, borderRadius: 3,
                                        fontWeight: 600, textTransform: 'none',
                                        fontSize: { xs: 15, lg: 16 },
                                        letterSpacing: 0.2,
                                        background: loading
                                            ? 'rgba(34,197,94,0.4)'
                                            : 'linear-gradient(90deg, #22c55e 0%, #16a34a 100%)',
                                        boxShadow: loading ? 'none' : '0 6px 20px rgba(34,197,94,0.22)',
                                        transition: `all 0.22s ${SPRING}`,
                                        '&:hover:not(:disabled)': {
                                            background: 'linear-gradient(90deg, #16a34a 0%, #15803d 100%)',
                                            boxShadow: '0 8px 26px rgba(34,197,94,0.3)',
                                        },
                                        '&:active:not(:disabled)': { transform: 'scale(0.985)' },
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
                                    onCredentialLost={() => {/* simplemente oculta el botón sin reload */}}
                                />

                                {/* Acceso rápido por PIN */}
                                {localStorage.getItem('pin_configured') === 'true' && loginData.username && (
                                    <>
                                        <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)', my: -0.5 }}>
                                            <Typography sx={{ fontSize: 11, color: '#475569', px: 1 }}>o</Typography>
                                        </Divider>
                                        <Button
                                            variant="text"
                                            startIcon={<Pin />}
                                            onClick={() => setPinMode(true)}
                                            sx={{
                                                color: '#64748b', fontSize: 12, fontWeight: 600,
                                                '&:hover': { color: '#10B981', bgcolor: 'rgba(16,185,129,0.06)' },
                                            }}
                                        >
                                            Ingresar con PIN
                                        </Button>
                                    </>
                                )}

                                <Typography sx={{ mt: 1, color: '#94a3b8', fontSize: 13, textAlign: 'center' }}>
                                    ¿No tienes una cuenta?{' '}
                                    <span
                                        onClick={switchToRegister}
                                        style={{ color: '#22c55e', fontWeight: 700, cursor: 'pointer' }}
                                    >
                                        Regístrate gratis
                                    </span>
                                </Typography>
                                </Box>
                                )}
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
                                        <TextField
                                            select fullWidth required
                                            label="Tipo de negocio"
                                            className="orange-field" sx={fieldSx}
                                            value={regData.tipo_negocio}
                                            onChange={updateReg('tipo_negocio')}
                                            error={step1Attempted && step1Errors.tipo_negocio}
                                            helperText={step1Attempted && step1Errors.tipo_negocio ? 'Selecciona el tipo de negocio' : ''}
                                            SelectProps={{
                                                MenuProps: {
                                                    PaperProps: {
                                                        sx: { bgcolor: '#1e293b', color: '#f1f5f9' },
                                                    },
                                                },
                                            }}
                                        >
                                            {[
                                                { key: 'erp',         label: 'Comercio / ERP',  Icon: Storefront,      desc: 'Ventas, inventario y clientes',  color: '#f97316' },
                                                { key: 'prestamos',   label: 'Cobranzas',        Icon: AttachMoney,     desc: 'Préstamos y rutas de cobro',     color: '#22c55e' },
                                                { key: 'parqueadero', label: 'Parqueadero',      Icon: LocalParking,    desc: 'Suscripciones y accesos',        color: '#3b82f6' },
                                                { key: 'lavadero',    label: 'Lavadero',         Icon: LocalCarWash,    desc: 'POS y productividad',            color: '#8b5cf6' },
                                                { key: 'restaurante', label: 'Restaurante',      Icon: TableRestaurant, desc: 'Mesas, comandas y cocina',       color: '#ec4899' },
                                            ].map(({ key, label, Icon, desc, color }) => (
                                                <MenuItem key={key} value={key} sx={{ color: '#f1f5f9', py: 1.2 }}>
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                                        <Box sx={{ width: 30, height: 30, borderRadius: 1.5, bgcolor: `${color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                            <Icon sx={{ fontSize: 17, color }} />
                                                        </Box>
                                                        <Box>
                                                            <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9', lineHeight: 1.2 }}>{label}</Typography>
                                                            <Typography sx={{ fontSize: 11, color: '#64748b', lineHeight: 1.2 }}>{desc}</Typography>
                                                        </Box>
                                                    </Box>
                                                </MenuItem>
                                            ))}
                                        </TextField>

                                        <TextField
                                            fullWidth label="Nombre del Negocio" required
                                            className="orange-field" sx={fieldSx}
                                            placeholder="Ej: Vialmar Cacao, Almacén Don José…"
                                            value={regData.nombre_empresa}
                                            onChange={updateReg('nombre_empresa')}
                                            error={showFieldError('nombre_empresa')}
                                            helperText={showFieldError('nombre_empresa') ? 'Mínimo 2 caracteres' : ''}
                                            onBlur={() => touchField('nombre_empresa')}
                                            autoFocus
                                            InputProps={{ startAdornment: <InputAdornment position="start"><Business /></InputAdornment> }}
                                        />

                                        <TextField
                                            fullWidth label="NIT o Cédula de Ciudadanía" required
                                            className="orange-field" sx={fieldSx}
                                            placeholder="Ej: 901.123.456-7"
                                            value={regData.nit}
                                            onChange={(e) => {
                                                const raw = e.target.value.replace(/[^0-9-]/g, '');
                                                const parts = raw.split('-');
                                                const clean = parts.length > 2 ? parts[0] + '-' + parts.slice(1).join('') : raw;
                                                setRegData(prev => ({ ...prev, nit: clean }));
                                            }}
                                            error={showFieldError('nit')}
                                            helperText={showFieldError('nit') ? 'Ingresa un NIT o cédula válido (mín. 5 dígitos)' : 'NIT empresarial o cédula del responsable'}
                                            onBlur={() => touchField('nit')}
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
                                                    options={regData.pais === 'CO' ? CIUDADES_COLOMBIA : []}
                                                    value={regData.ciudad}
                                                    onChange={(e, newValue) => setRegData({ ...regData, ciudad: newValue || '' })}
                                                    onInputChange={(e, newInputValue) => setRegData({ ...regData, ciudad: newInputValue })}
                                                    freeSolo
                                                    renderInput={(params) => (
                                                        <TextField
                                                            {...params}
                                                            fullWidth required label="Ciudad"
                                                            className="orange-field"
                                                            error={showFieldError('ciudad')}
                                                            helperText={showFieldError('ciudad') ? 'Ingresa tu ciudad' : ''}
                                                            onBlur={() => touchField('ciudad')}
                                                            sx={{
                                                                ...fieldSx,
                                                                '& .MuiOutlinedInput-root': {
                                                                    ...fieldSx['& .MuiOutlinedInput-root'],
                                                                    pr: '35px !important'
                                                                }
                                                            }}
                                                            placeholder={regData.pais === 'CO' ? 'Ej: Buenaventura' : 'Escribe tu ciudad'}
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
                                                mt: 0.5, py: 1.7, borderRadius: 3,
                                                fontWeight: 600, textTransform: 'none',
                                                fontSize: { xs: 15, lg: 16 },
                                                letterSpacing: 0.2,
                                                background: !canContinueStep1()
                                                    ? 'rgba(249,115,22,0.3)'
                                                    : 'linear-gradient(90deg, #f97316 0%, #ea580c 100%)',
                                                boxShadow: !canContinueStep1() ? 'none' : '0 6px 20px rgba(249,115,22,0.22)',
                                                transition: `all 0.22s ${SPRING}`,
                                                '&:hover:not(:disabled)': {
                                                    background: 'linear-gradient(90deg, #ea580c 0%, #c2410c 100%)',
                                                    boxShadow: '0 8px 26px rgba(249,115,22,0.3)',
                                                },
                                                '&:active:not(:disabled)': { transform: 'scale(0.985)' },
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
                                            autoFocus
                                            inputProps={{ autoComplete: 'name' }}
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
                                            inputProps={{ autoComplete: 'email' }}
                                            InputProps={{ startAdornment: <InputAdornment position="start"><Email /></InputAdornment> }}
                                        />

                                        <TextField
                                            fullWidth required type="tel" label="WhatsApp / Teléfono"
                                            className="orange-field" sx={fieldSx}
                                            placeholder="Ej: 300 123 4567"
                                            value={regData.telefono}
                                            onChange={updateReg('telefono')}
                                            error={regData.telefono.length > 0 && !isPhone(regData.telefono)}
                                            helperText={
                                                regData.telefono.length > 0 && !isPhone(regData.telefono)
                                                    ? 'Teléfono no válido (mín. 7 dígitos)'
                                                    : 'Te avisaremos por aquí si hay algo importante'
                                            }
                                            inputProps={{ autoComplete: 'tel' }}
                                            InputProps={{ startAdornment: <InputAdornment position="start"><Phone /></InputAdornment> }}
                                        />

                                        <TextField
                                            fullWidth required label="Usuario para ingresar"
                                            className="orange-field" sx={fieldSx}
                                            placeholder="Sin espacios. Ej: maria.perez"
                                            value={regData.username}
                                            onChange={(e) => setRegData({ ...regData, username: e.target.value.replace(/[^a-zA-Z0-9._-]/g, '') })}
                                            error={regData.username.length > 0 && !isUsername(regData.username)}
                                            helperText={
                                                regData.username.length > 0 && !isUsername(regData.username)
                                                    ? 'Solo letras, números, punto, guion bajo o guion (3-30 caracteres)'
                                                    : regData.username
                                                        ? `✓ ${regData.username}`
                                                        : 'Letras, números, punto y guion bajo. Sin espacios.'
                                            }
                                            inputProps={{ autoComplete: 'username' }}
                                            InputProps={{ startAdornment: <InputAdornment position="start"><Person /></InputAdornment> }}
                                        />

                                        <TextField
                                            fullWidth required label="Contraseña segura"
                                            type={showPassword ? 'text' : 'password'}
                                            className="orange-field" sx={fieldSx}
                                            value={regData.password}
                                            onChange={updateReg('password')}
                                            helperText="Mínimo 8 caracteres"
                                            inputProps={{ autoComplete: 'new-password' }}
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
                                        {/* Indicador de fuerza */}
                                        {regData.password && (() => {
                                            const s = getPwdStrength(regData.password);
                                            if (!s) return null;
                                            return (
                                                <Box sx={{ mt: -1.5, px: 0.5 }}>
                                                    <LinearProgress
                                                        variant="determinate"
                                                        value={(s.level / 5) * 100}
                                                        sx={{
                                                            height: 3, borderRadius: 2,
                                                            bgcolor: 'rgba(255,255,255,0.08)',
                                                            '& .MuiLinearProgress-bar': { bgcolor: s.color, transition: 'all 0.35s ease' },
                                                        }}
                                                    />
                                                    <Typography sx={{ fontSize: 10, color: s.color, fontWeight: 700, mt: 0.4 }}>{s.label}</Typography>
                                                </Box>
                                            );
                                        })()}
                                        <TextField
                                            fullWidth required label="Confirmar contraseña"
                                            type={showConfirmPassword ? 'text' : 'password'}
                                            className="orange-field" sx={fieldSx}
                                            value={regData.confirmPassword}
                                            onChange={updateReg('confirmPassword')}
                                            error={pwdMatch}
                                            helperText={pwdMatch ? 'Las contraseñas no coinciden' : ''}
                                            inputProps={{ autoComplete: 'new-password' }}
                                            InputProps={{
                                                startAdornment: <InputAdornment position="start"><Lock /></InputAdornment>,
                                                endAdornment: (
                                                    <InputAdornment position="end">
                                                        <IconButton onClick={() => setShowConfirmPassword(v => !v)} edge="end" sx={{ color: '#64748b' }}>
                                                            {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
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
                                                    py: 1.7, borderRadius: 3, fontWeight: 600, flex: 0.6,
                                                    textTransform: 'none',
                                                    color: '#94a3b8',
                                                    borderColor: 'rgba(148,163,184,0.3)',
                                                    transition: `all 0.22s ${SPRING}`,
                                                    '&:hover': {
                                                        borderColor: '#94a3b8',
                                                        bgcolor: 'rgba(148,163,184,0.08)',
                                                    },
                                                    '&:active': { transform: 'scale(0.985)' },
                                                }}
                                            >
                                                Atrás
                                            </Button>
                                            <Button
                                                type="submit" variant="contained"
                                                disabled={loading || !canSubmitStep2()}
                                                sx={{
                                                    py: 1.7, borderRadius: 3,
                                                    fontWeight: 600, textTransform: 'none',
                                                    fontSize: { xs: 14, lg: 15 },
                                                    letterSpacing: 0.2,
                                                    flex: 1.4,
                                                    background: (loading || !canSubmitStep2())
                                                        ? 'rgba(249,115,22,0.3)'
                                                        : 'linear-gradient(90deg, #f97316 0%, #ea580c 100%)',
                                                    boxShadow: (loading || !canSubmitStep2()) ? 'none' : '0 6px 20px rgba(249,115,22,0.22)',
                                                    transition: `all 0.22s ${SPRING}`,
                                                    '&:hover:not(:disabled)': {
                                                        background: 'linear-gradient(90deg, #ea580c 0%, #c2410c 100%)',
                                                        boxShadow: '0 8px 26px rgba(249,115,22,0.3)',
                                                    },
                                                    '&:active:not(:disabled)': { transform: 'scale(0.985)' },
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

                    <Typography sx={{ mt: 4, color: '#475569', fontSize: 11.5, textAlign: 'center', fontWeight: 500, letterSpacing: 0.3 }}>
                        Powered by Tech Stack Colombia S.A.S · 2026
                    </Typography>
                </Box>   {/* content box */}
                </Box>   {/* scroll area */}
            </Box>       {/* panel derecho */}
        </Box>           {/* outer flex */}

        {/* ── Modal recuperación de contraseña ── */}
        <Dialog
            open={forgotOpen}
            onClose={() => setForgotOpen(false)}
            PaperProps={{ sx: { bgcolor: '#1e293b', color: '#f1f5f9', borderRadius: 3, minWidth: 340, border: '1px solid rgba(255,255,255,0.08)' } }}
        >
            <DialogTitle sx={{ fontWeight: 800, fontSize: 18, color: '#f1f5f9', pb: 0.5 }}>
                Recuperar contraseña
            </DialogTitle>


            <DialogContent sx={{ pb: 1 }}>
                {/* ── PASO 0: Identificar usuario por username + NIT ── */}
                {recov.step === 0 && (
                    <Box sx={{ pt: 1 }}>
                        <Typography sx={{ fontSize: 13, color: '#94a3b8', mb: 2.5, lineHeight: 1.6 }}>
                            Ingresa tu nombre de usuario y el NIT de tu empresa. Con esos datos localizaremos tu cuenta.
                        </Typography>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <TextField
                                fullWidth autoFocus label="Nombre de usuario"
                                placeholder="ej: juanperez"
                                value={recov.username}
                                onChange={e => setRecov(s => ({ ...s, username: e.target.value, error: '' }))}
                                sx={fieldSx}
                                InputProps={{ startAdornment: <InputAdornment position="start"><Person sx={{ color: '#f97316' }} /></InputAdornment> }}
                            />
                            <TextField fullWidth label="NIT de tu empresa"
                                placeholder="Ej: 901123456-7"
                                value={recov.empresaNit}
                                onChange={e => {
                                    const raw = e.target.value.replace(/[^0-9-]/g, '');
                                    const parts = raw.split('-');
                                    const clean = parts.length > 2 ? parts[0] + '-' + parts.slice(1).join('') : raw;
                                    setRecov(s => ({ ...s, empresaNit: clean, error: '' }));
                                }}
                                onKeyDown={e => e.key === 'Enter' && recovBuscar()}
                                sx={fieldSx}
                                InputProps={{ startAdornment: <InputAdornment position="start"><ManageAccounts sx={{ color: '#f97316' }} /></InputAdornment> }}
                            />
                        </Box>
                        {recov.error && (
                            <Typography sx={{ fontSize: 12, color: '#f87171', mt: 1.5, bgcolor: 'rgba(239,68,68,0.08)', p: 1.5, borderRadius: 2 }}>
                                {recov.error}
                            </Typography>
                        )}
                    </Box>
                )}

                {/* ── PASO 1: Verificar identidad con nombre completo ── */}
                {recov.step === 1 && (
                    <Box sx={{ pt: 1 }}>
                        {/* Info: empresa identificada */}
                        {recov.empresaNombre && (
                            <Box sx={{ mb: 2, p: 1.5, borderRadius: 2, bgcolor: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)' }}>
                                <Typography sx={{ fontSize: 12, color: '#22c55e', fontWeight: 600 }}>
                                    Empresa: {recov.empresaNombre}
                                </Typography>
                            </Box>
                        )}

                        <Typography sx={{ fontSize: 13, color: '#94a3b8', mb: 2, lineHeight: 1.6 }}>
                            Para confirmar que eres el dueño de la cuenta, escribe tu nombre completo tal como quedó registrado.
                        </Typography>

                        {/* Pista enmascarada del nombre */}
                        {recov.hints.nombre_completo && (
                            <Box sx={{ mb: 2, p: 1.5, borderRadius: 2, bgcolor: 'rgba(249,115,22,0.06)', border: '1px solid rgba(249,115,22,0.2)' }}>
                                <Typography sx={{ fontSize: 11, fontWeight: 700, color: '#f97316', mb: 0.5, textTransform: 'uppercase' }}>Pista</Typography>
                                <Chip size="small" label={`Nombre registrado: ${recov.hints.nombre_completo}`} sx={{ bgcolor: 'rgba(255,255,255,0.07)', color: '#cbd5e1', fontSize: 11 }} />
                            </Box>
                        )}

                        <TextField fullWidth autoFocus label="Tu nombre completo"
                            placeholder="Escríbelo exactamente como lo registraste"
                            value={recov.nombreCompleto}
                            onChange={e => setRecov(s => ({ ...s, nombreCompleto: e.target.value, error: '' }))}
                            onKeyDown={e => e.key === 'Enter' && recovVerificar()}
                            sx={fieldSx}
                            InputProps={{ startAdornment: <InputAdornment position="start"><Person sx={{ color: '#f97316' }} /></InputAdornment> }}
                        />
                        {recov.error && (
                            <Typography sx={{ fontSize: 12, color: '#f87171', mt: 1.5, bgcolor: 'rgba(239,68,68,0.08)', p: 1.5, borderRadius: 2 }}>
                                {recov.error}
                            </Typography>
                        )}
                    </Box>
                )}

                {/* ── PASO 2: Nueva contraseña ── */}
                {recov.step === 2 && (
                    <Box sx={{ pt: 1 }}>
                        <Typography sx={{ fontSize: 13, color: '#94a3b8', mb: 2.5, lineHeight: 1.6 }}>
                            Identidad verificada. Ahora elige una nueva contraseña para tu cuenta <strong style={{ color: '#f1f5f9' }}>{recov.username}</strong>.
                        </Typography>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <TextField fullWidth label="Nueva contraseña"
                                type={showRecovPwd ? 'text' : 'password'}
                                value={recov.nuevaPassword}
                                onChange={e => setRecov(s => ({ ...s, nuevaPassword: e.target.value, error: '' }))}
                                sx={fieldSx}
                                InputProps={{
                                    startAdornment: <InputAdornment position="start"><Lock sx={{ color: '#f97316' }} /></InputAdornment>,
                                    endAdornment: (
                                        <InputAdornment position="end">
                                            <IconButton size="small" tabIndex={-1} onClick={() => setShowRecovPwd(v => !v)} sx={{ color: '#64748b' }}>
                                                {showRecovPwd ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                                            </IconButton>
                                        </InputAdornment>
                                    ),
                                }}
                            />
                            <TextField fullWidth label="Confirmar contraseña"
                                type={showRecovConfirm ? 'text' : 'password'}
                                value={recov.confirmarPassword}
                                onChange={e => setRecov(s => ({ ...s, confirmarPassword: e.target.value, error: '' }))}
                                onKeyDown={e => e.key === 'Enter' && recovCambiar()}
                                sx={fieldSx}
                                error={!!recov.confirmarPassword && recov.nuevaPassword !== recov.confirmarPassword}
                                helperText={recov.confirmarPassword && recov.nuevaPassword !== recov.confirmarPassword ? 'Las contraseñas no coinciden' : ''}
                                InputProps={{
                                    startAdornment: <InputAdornment position="start"><Lock sx={{ color: '#f97316' }} /></InputAdornment>,
                                    endAdornment: (
                                        <InputAdornment position="end">
                                            <IconButton size="small" tabIndex={-1} onClick={() => setShowRecovConfirm(v => !v)} sx={{ color: '#64748b' }}>
                                                {showRecovConfirm ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                                            </IconButton>
                                        </InputAdornment>
                                    ),
                                }}
                            />
                        </Box>
                        {recov.error && (
                            <Typography sx={{ fontSize: 12, color: '#f87171', mt: 1.5, bgcolor: 'rgba(239,68,68,0.08)', p: 1.5, borderRadius: 2 }}>
                                {recov.error}
                            </Typography>
                        )}
                    </Box>
                )}
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
                <Button
                    onClick={() => { if (recov.step === 0) { setForgotOpen(false); resetRecov(); } else setRecov(s => ({ ...s, step: s.step - 1, error: '' })); }}
                    disabled={recov.loading}
                    sx={{ color: '#64748b', fontWeight: 600, textTransform: 'none' }}
                >
                    {recov.step === 0 ? 'Cancelar' : 'Atrás'}
                </Button>
                <Button
                    variant="contained"
                    disabled={recov.loading ||
                        (recov.step === 0 && (!recov.username.trim() || !recov.empresaNit.trim())) ||
                        (recov.step === 1 && !recov.nombreCompleto.trim()) ||
                        (recov.step === 2 && (!recov.nuevaPassword || recov.nuevaPassword !== recov.confirmarPassword))
                    }
                    onClick={recov.step === 0 ? recovBuscar : recov.step === 1 ? recovVerificar : recovCambiar}
                    startIcon={recov.loading ? <CircularProgress size={16} color="inherit" /> : null}
                    sx={{ background: 'linear-gradient(90deg, #f97316, #ea580c)', borderRadius: 2, fontWeight: 700, textTransform: 'none', '&:disabled': { opacity: 0.4 } }}
                >
                    {recov.step === 0 && 'Buscar mi cuenta'}
                    {recov.step === 1 && 'Verificar identidad'}
                    {recov.step === 2 && 'Cambiar contraseña'}
                </Button>
            </DialogActions>
        </Dialog>
        </>
    );
};

export default Login;