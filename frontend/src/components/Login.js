import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import apiClient from '../api';
import {
    Box, TextField, Button, Typography, InputAdornment, IconButton,
    Grid, Card, CardActionArea
} from '@mui/material';
import { keyframes } from '@mui/system';
import {
    Visibility, VisibilityOff, AlternateEmail, Lock, Business, Person,
    Storefront, AttachMoney, Badge
} from '@mui/icons-material';

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

const shimmer = keyframes`
  0%   { background-position: -200% center; }
  100% { background-position:  200% center; }
`;

// ─── Estilos de campo reutilizables ──────────────────────────────────────────
const fieldSx = {
    '& .MuiInputLabel-root': {
        color: '#64748b', fontSize: 11, fontWeight: 700,
        letterSpacing: 1.4, textTransform: 'uppercase',
    },
    '& .MuiInputLabel-root.Mui-focused': { color: '#22c55e' },
    '& .MuiOutlinedInput-root': {
        borderRadius: 2.5,
        backgroundColor: 'rgba(241, 245, 249, 0.05)',
        backdropFilter: 'blur(10px)',
        color: '#f1f5f9',
        fontSize: 15,
        // Altura ligeramente mayor para dar más presencia al campo
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
    },
    '& .MuiInputAdornment-root .MuiSvgIcon-root': { color: '#475569', fontSize: 19 },
    '& .MuiOutlinedInput-root.Mui-focused .MuiInputAdornment-root .MuiSvgIcon-root': { color: '#22c55e' },
};

// ─── Componente principal ─────────────────────────────────────────────────────
const Login = ({ onLogin }) => {
    const [isLoginView, setIsLoginView]   = useState(true);
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading]           = useState(false);
    const navigate = useNavigate();

    const [loginData, setLoginData] = useState({ username: '', password: '' });
    const [regData,   setRegData]   = useState({
        nombre_empresa: '', nit: '', username: '', password: '', tipo_negocio: 'erp'
    });

    // ── Handlers ──────────────────────────────────────────────────────────────
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

    const handleRegisterSubmit = async (e) => {
        e.preventDefault();
        if (regData.password.length < 6) {
            toast.warning('La contraseña debe tener al menos 6 caracteres.');
            return;
        }
        setLoading(true);
        try {
            await apiClient.post('/auth/register', regData);
            toast.success('¡Cuenta creada con éxito! Por favor, inicia sesión.');
            setLoginData({ username: regData.username, password: '' });
            setRegData({ nombre_empresa: '', nit: '', username: '', password: '', tipo_negocio: 'erp' });
            setIsLoginView(true);
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Error al crear la cuenta.');
        } finally {
            setLoading(false);
        }
    };

    // ── Render ─────────────────────────────────────────────────────────────────
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
                {/* Overlay degradado */}
                <Box sx={{
                    position: 'absolute', inset: 0,
                    background: 'linear-gradient(135deg, rgba(15,23,42,0.75) 0%, rgba(2,6,23,0.55) 100%)',
                }} />

                {/* Texto inferior del hero */}
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
                // Padding horizontal responsivo; más generoso en desktop
                px: { xs: 3, sm: 6, lg: 8 },
                overflowY: 'auto',
            }}>
                {/*
                  * maxWidth aumentado: 460 en móvil-tablet, 520 en desktop.
                  * Esto es el cambio clave para que se vea más grande en PC.
                */}
                <Box sx={{
                    width: '100%',
                    maxWidth: { xs: 460, lg: 520 },
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                }}>

                    {/* ── Logo prominente ────────────────────────────────── */}
                    <Box sx={{
                        mb: 4,
                        position: 'relative',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}>
                        {/* Anillo pulsante exterior */}
                        <Box sx={{
                            position: 'absolute',
                            width: { xs: 140, lg: 156 },
                            height: { xs: 140, lg: 156 },
                            borderRadius: '50%',
                            border: '1.5px solid rgba(34,197,94,0.35)',
                            animation: `${pulseRing} 3s ease-in-out infinite`,
                        }} />
                        {/* Anillo interior */}
                        <Box sx={{
                            position: 'absolute',
                            width: { xs: 118, lg: 132 },
                            height: { xs: 118, lg: 132 },
                            borderRadius: '50%',
                            border: '1px solid rgba(34,197,94,0.2)',
                        }} />
                        {/* Imagen del logo */}
                        <img
                            src="/Logo.jpeg"
                            alt="Ksmart360"
                            style={{
                                width:        110,
                                height:       110,
                                borderRadius: '50%',
                                objectFit:    'cover',
                                border:       '3px solid rgba(34,197,94,0.55)',
                                boxShadow:    '0 0 40px rgba(34,197,94,0.25), 0 0 80px rgba(34,197,94,0.1)',
                                position:     'relative',
                                zIndex:       1,
                            }}
                        />
                    </Box>

                    {/* ── Bloque animado: Login / Registro ───────────────── */}
                    <Box
                        key={isLoginView ? 'login' : 'register'}
                        sx={{
                            animation: `${fadeIn} 0.4s cubic-bezier(0.4, 0, 0.2, 1)`,
                            width: '100%',
                        }}
                    >
                        {/* Título */}
                        <Typography sx={{
                            fontWeight: 800,
                            fontSize: { xs: 30, lg: 34 },
                            color: '#f1f5f9',
                            letterSpacing: -0.8,
                            mb: 0.5,
                            textAlign: 'center',
                        }}>
                            {isLoginView ? 'Ingresar' : 'Crea tu espacio'}
                        </Typography>

                        {/* Subtítulo */}
                        <Typography sx={{
                            color: '#64748b',
                            fontSize: { xs: 14, lg: 15 },
                            mb: 4,
                            textAlign: 'center',
                        }}>
                            {isLoginView
                                ? 'Ingresa tus credenciales para continuar'
                                : 'Obtén 14 días gratis · Sin tarjeta de crédito'}
                        </Typography>

                        {/* ── Formulario LOGIN ── */}
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

                                {/* Botón principal con shimmer en hover */}
                                <Button
                                    type="submit" fullWidth variant="contained"
                                    disabled={loading}
                                    sx={{
                                        mt: 0.5,
                                        py: 1.8,
                                        borderRadius: 2.5,
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

                                <Typography sx={{ mt: 1.5, color: '#94a3b8', fontSize: 13, textAlign: 'center' }}>
                                    ¿No tienes una cuenta?{' '}
                                    <span
                                        onClick={() => setIsLoginView(false)}
                                        style={{ color: '#22c55e', fontWeight: 700, cursor: 'pointer' }}
                                    >
                                        Regístrate gratis
                                    </span>
                                </Typography>
                            </Box>

                        ) : (
                        /* ── Formulario REGISTRO ── */
                            <Box
                                component="form"
                                onSubmit={handleRegisterSubmit}
                                sx={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 2.5 }}
                            >
                                {/* Selector de tipo de negocio */}
                                <Grid container spacing={1.5} sx={{ mb: 0.5 }}>
                                    {[
                                        { key: 'erp',       label: 'Comercio / ERP',  Icon: Storefront  },
                                        { key: 'prestamos', label: 'Prestamista',      Icon: AttachMoney },
                                    ].map(({ key, label, Icon }) => (
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
                                                    sx={{ p: 2, textAlign: 'center', color: '#f1f5f9' }}
                                                >
                                                    <Icon sx={{
                                                        color: regData.tipo_negocio === key ? '#ea580c' : '#64748b',
                                                        fontSize: 28, mb: 0.5,
                                                    }} />
                                                    <Typography variant="subtitle2" fontWeight={700} fontSize={12}>
                                                        {label}
                                                    </Typography>
                                                </CardActionArea>
                                            </Card>
                                        </Grid>
                                    ))}
                                </Grid>

                                <TextField
                                    fullWidth label="Nombre del Negocio" required sx={fieldSx}
                                    value={regData.nombre_empresa}
                                    onChange={e => setRegData({ ...regData, nombre_empresa: e.target.value })}
                                    InputProps={{ startAdornment: <InputAdornment position="start"><Business /></InputAdornment> }}
                                />
                                <TextField
                                    fullWidth label="NIT o Cédula" required sx={fieldSx}
                                    value={regData.nit}
                                    onChange={e => setRegData({ ...regData, nit: e.target.value.trim() })}
                                    InputProps={{ startAdornment: <InputAdornment position="start"><Badge /></InputAdornment> }}
                                />
                                <TextField
                                    fullWidth label="Usuario para ingresar" required sx={fieldSx}
                                    value={regData.username}
                                    onChange={e => setRegData({ ...regData, username: e.target.value.trim() })}
                                    InputProps={{ startAdornment: <InputAdornment position="start"><Person /></InputAdornment> }}
                                />
                                <TextField
                                    fullWidth label="Contraseña segura"
                                    type={showPassword ? 'text' : 'password'}
                                    required sx={fieldSx}
                                    value={regData.password}
                                    onChange={e => setRegData({ ...regData, password: e.target.value })}
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
                                        mt: 0.5,
                                        py: 1.8,
                                        borderRadius: 2.5,
                                        fontWeight: 700,
                                        fontSize: { xs: 15, lg: 16 },
                                        letterSpacing: 0.3,
                                        background: loading
                                            ? 'rgba(249,115,22,0.4)'
                                            : 'linear-gradient(90deg, #f97316 0%, #ea580c 100%)',
                                        boxShadow: loading ? 'none' : '0 8px 28px rgba(249,115,22,0.3)',
                                        transition: 'all 0.25s',
                                        '&:hover:not(:disabled)': {
                                            background: 'linear-gradient(90deg, #ea580c 0%, #c2410c 100%)',
                                            boxShadow: '0 12px 36px rgba(249,115,22,0.4)',
                                            transform: 'translateY(-2px)',
                                        },
                                    }}
                                >
                                    {loading ? 'Configurando tu cuenta...' : 'Comenzar mi prueba gratis'}
                                </Button>

                                <Typography sx={{ mt: 1.5, color: '#94a3b8', fontSize: 13, textAlign: 'center' }}>
                                    ¿Ya tienes una cuenta?{' '}
                                    <span
                                        onClick={() => setIsLoginView(true)}
                                        style={{ color: '#f97316', fontWeight: 700, cursor: 'pointer' }}
                                    >
                                        Inicia sesión aquí
                                    </span>
                                </Typography>
                            </Box>
                        )}
                    </Box>

                    {/* Footer */}
                    <Typography sx={{ mt: 6, color: '#1e293b', fontSize: 12, textAlign: 'center' }}>
                        Powered by KSMP Systems · 2026
                    </Typography>
                </Box>
            </Box>
        </Box>
    );
};

export default Login;