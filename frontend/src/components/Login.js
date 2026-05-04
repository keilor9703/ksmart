import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import apiClient from '../api';
import {
    Box, TextField, Button, Typography, InputAdornment, IconButton,
    Grid, Card, CardActionArea, MenuItem, LinearProgress, Stack, Chip
} from '@mui/material';
import { keyframes } from '@mui/system';
import {
    Visibility, VisibilityOff, AlternateEmail, Lock, Business, Person,
    Storefront, AttachMoney, Email, Phone, LocationOn, Group,
    ArrowForward, ArrowBack, CheckCircle
} from '@mui/icons-material';
import { TwoWheeler } from '@mui/icons-material';

// ─── NUEVO IMPORT ────────────────────────────────────────────────────────────
import BotonHuella from './BotonHuella';

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
    // Color del label/icono cuando el textfield es naranja (registro)
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

const TAMANOS_NEGOCIO = [
    { value: 'solo',    label: 'Solo yo',  desc: '1 persona' },
    { value: 'pequeno', label: 'Pequeño',  desc: '2-5' },
    { value: 'mediano', label: 'Mediano',  desc: '6-20' },
    { value: 'grande',  label: 'Grande',   desc: '+20' },
];

// ─── Validaciones ───────────────────────────────────────────────────────────
const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const isPhone = (v) => /^[\d+\s()-]{7,20}$/.test(v);

// ─── Componente principal ─────────────────────────────────────────────────────
const Login = ({ onLogin }) => {
    const [isLoginView, setIsLoginView]   = useState(true);
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading]           = useState(false);
    const [regStep, setRegStep]           = useState(1);   // 1 = negocio, 2 = cuenta
    const navigate = useNavigate();

    const [loginData, setLoginData] = useState({ username: '', password: '' });

    const initialRegState = {
        // Paso 1
        tipo_negocio:    'erp',
        nombre_empresa:  '',
        pais:            'CO',
        ciudad:          '',
        tamano_negocio:  'pequeno',
        // Paso 2
        nombre_completo: '',
        email:           '',
        telefono:        '',
        username:        '',
        password:        '',
        // Marketing
        origen:          '',
    };
    const [regData, setRegData] = useState(initialRegState);

    const updateReg = (key) => (e) =>
        setRegData((prev) => ({ ...prev, [key]: e.target.value }));

    // ── Validación por paso ──────────────────────────────────────────────────
    const canContinueStep1 = () =>
        regData.nombre_empresa.trim().length >= 2 &&
        regData.ciudad.trim().length >= 2 &&
        regData.pais &&
        regData.tamano_negocio &&
        regData.tipo_negocio;

    const canSubmitStep2 = () =>
        regData.nombre_completo.trim().length >= 3 &&
        isEmail(regData.email) &&
        isPhone(regData.telefono) &&
        regData.username.trim().length >= 3 &&
        regData.password.length >= 6;

    // ── Cambiar entre login/registro ─────────────────────────────────────────
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
                '/token',
                new URLSearchParams({ username: loginData.username, password: loginData.password }),
                { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
            );
            localStorage.setItem('token', response.data.access_token);
            onLogin();
            if (response.data.is_expired) {
                toast.warning('Tu suscripción ha expirado. Redirigiendo a pagos...', { autoClose: 5000 });
                navigate('/planes');
            } else {
                toast.success('Inicio de sesión exitoso');
                navigate('/');
            }
        } catch (err) {
            const status = err.response?.status;
            const detail = err.response?.data?.detail;
            if (status === 403) toast.error(detail || 'Cuenta suspendida por el administrador.');
            else                 toast.error(detail || 'Usuario o contraseña incorrectos');
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
            toast.success('¡Cuenta creada con éxito! Ya puedes iniciar sesión.');
            const usernameUsed = regData.username.trim().toLowerCase();
            setLoginData({ username: usernameUsed, password: '' });
            setRegData(initialRegState);
            setRegStep(1);
            setIsLoginView(true);
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Error al crear la cuenta.');
        } finally {
            setLoading(false);
        }
    };

    // ─── NUEVA FUNCIÓN BIOMÉTRICA ───────────────────────────────────────────────


    const handleBiometricSuccess = (data) => {
    // Guardar token igual que cuando hace login normal
    localStorage.setItem('token', data.access_token);
    localStorage.setItem('user', JSON.stringify({
        id:         data.user_id,
        username:   data.username,
        empresa_id: data.empresa_id,
        rol:        data.rol,
    }));

    // ✨ LA LÍNEA QUE FALTABA ✨
    // Le avisa a App.js que actualice el estado y renderice el Dashboard
    onLogin(); 

    toast.success('¡Bienvenido de vuelta!');
    navigate('/');
    };

    // ── Render ───────────────────────────────────────────────────────────────
    return (
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
                    background: 'linear-gradient(135deg, rgba(15,23,42,0.75) 0%, rgba(2,6,23,0.55) 100%)',
                }} />
                <Box sx={{ position: 'relative', p: 6, color: '#fff' }}>
                    <Typography sx={{ fontWeight: 800, fontSize: 36, lineHeight: 1.15, mb: 1 }}>
                        Ksmart360
                    </Typography>
                    <Typography sx={{ opacity: 0.7, fontSize: 15, maxWidth: 340, lineHeight: 1.6 }}>
                        Gestiona ventas, inventarios, producción y cobranza desde un solo lugar.
                    </Typography>
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

                    {/* ── Logo prominente (más pequeño en registro para dar espacio) ── */}
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

                        {/* ════════════════════════════════════════════════ */}
                        {/* ── Formulario LOGIN ──                           */}
                        {/* ════════════════════════════════════════════════ */}
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
                                    {loading ? 'Ingresando…' : 'Ingresar al sistema'}
                                </Button>

                                {/* ✨ NUEVO: Botón de huella estilo Wompi integrado aquí ✨ */}
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
                            /* ════════════════════════════════════════════════ */
                            /* ── Formulario REGISTRO en 2 pasos ──             */
                            /* ════════════════════════════════════════════════ */
                            <Box
                                component="form"
                                onSubmit={regStep === 2 ? handleRegisterSubmit : (e) => { e.preventDefault(); handleNextStep(); }}
                                sx={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 2.2 }}
                            >
                                {/* ──────── PASO 1 — Negocio ──────── */}
                                {regStep === 1 && (
                                    <>
                                        {/* Selector tipo de negocio */}
                                        <Grid container spacing={1.5}>
                                            {[
                                                { key: 'erp',       label: 'Comercio / ERP',  Icon: Storefront,  desc: 'Ventas e Inventario' },
                                                { key: 'prestamos', label: 'Cobranzas',       Icon: AttachMoney, desc: 'Rutas de Cobro' },
                                                { key: 'parqueadero',  label: 'Parqueadero',     desc: 'Motos / vehículos',    Icon: TwoWheeler    },  // ← NUEVO
                                            ].map(({ key, label, Icon, desc }) => (
                                                <Grid item xs={4} key={key}>
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

                                        <Grid container spacing={1.5}>
                                            <Grid item xs={5}>
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
                                            </Grid>
                                            <Grid item xs={7}>
                                                <TextField
                                                    fullWidth required label="Ciudad"
                                                    className="orange-field" sx={fieldSx}
                                                    placeholder="Ej: Bogotá"
                                                    value={regData.ciudad}
                                                    onChange={updateReg('ciudad')}
                                                    InputProps={{ startAdornment: <InputAdornment position="start"><LocationOn /></InputAdornment> }}
                                                />
                                            </Grid>
                                        </Grid>

                                        {/* Tamaño del negocio */}
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

                                {/* Trust indicators */}
                                <Stack direction="row" spacing={2} justifyContent="center" sx={{ mt: 0.5, opacity: 0.6 }}>
                                    <Typography sx={{ fontSize: 10, color: '#64748b' }}>🔒 Datos cifrados</Typography>
                                    <Typography sx={{ fontSize: 10, color: '#64748b' }}>✓ Sin tarjeta</Typography>
                                    <Typography sx={{ fontSize: 10, color: '#64748b' }}>📧 Cancela cuando quieras</Typography>
                                </Stack>
                            </Box>
                        )}
                    </Box>

                    {/* Footer */}
                    <Typography sx={{ mt: 4, color: '#1e293b', fontSize: 12, textAlign: 'center' }}>
                        Powered by KSMP Systems · 2026
                    </Typography>
                </Box>
            </Box>
        </Box>
    );
};

export default Login;