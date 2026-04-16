import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import apiClient from '../api';
import {
    Box, TextField, Button, Typography, InputAdornment, IconButton
} from '@mui/material';
import { keyframes } from '@mui/system';
import { Visibility, VisibilityOff, AlternateEmail, Lock, Business, Person } from '@mui/icons-material';

// ─── Animación suave de entrada (Difuminado hacia arriba) ──────────────
const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(15px); }
  to { opacity: 1; transform: translateY(0); }
`;

// ─── Estilos compartidos para los campos de texto ──────────────
const fieldSx = {
    '& .MuiInputLabel-root': {
        color: '#64748b', fontSize: 11, fontWeight: 700,
        letterSpacing: 1.2, textTransform: 'uppercase',
    },
    '& .MuiInputLabel-root.Mui-focused': { color: '#22c55e' },
    '& .MuiOutlinedInput-root': {
        borderRadius: 3, backgroundColor: 'rgba(241, 245, 249, 0.06)',
        backdropFilter: 'blur(8px)', color: '#f1f5f9', fontSize: 15,
        '& input': {
            color: '#f1f5f9', WebkitTextFillColor: '#f1f5f9', caretColor: '#22c55e',
            '&:-webkit-autofill': {
                WebkitBoxShadow: '0 0 0 100px #1e293b inset',
                WebkitTextFillColor: '#f1f5f9', caretColor: '#22c55e', borderRadius: 'inherit',
            },
        },
        '& fieldset': { borderColor: 'rgba(148, 163, 184, 0.25)', borderWidth: 1.5 },
        '&:hover fieldset': { borderColor: 'rgba(148, 163, 184, 0.5)' },
        '&.Mui-focused fieldset': { borderColor: '#22c55e', borderWidth: 2 },
    },
    '& .MuiInputAdornment-root .MuiSvgIcon-root': { color: '#64748b', fontSize: 20 },
    '& .MuiOutlinedInput-root.Mui-focused .MuiInputAdornment-root .MuiSvgIcon-root': { color: '#22c55e' },
};

const Login = ({ onLogin }) => {
    // ─── Estados de la UI ───
    const [isLoginView, setIsLoginView] = useState(true);
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    // ─── Estados de los Formularios ───
    const [loginData, setLoginData] = useState({ username: '', password: '' });
    const [regData, setRegData] = useState({ nombre_empresa: '', username: '', password: '' });

    // ─── Manejador de Ingreso (Login) ───
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
            toast.success('Inicio de sesión exitoso');
            onLogin();
            navigate('/');
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Usuario o contraseña incorrectos');
        } finally {
            setLoading(false);
        }
    };

    // ─── Manejador de Registro (Onboarding) ───
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
            // Pasamos los datos al login para mayor comodidad y cambiamos la vista
            setLoginData({ username: regData.username, password: '' });
            setRegData({ nombre_empresa: '', username: '', password: '' });
            setIsLoginView(true);
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Error al crear la cuenta.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Box sx={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden' }}>

            {/* ── Panel izquierdo — Imagen de fondo ── */}
            <Box sx={{
                display: { xs: 'none', md: 'flex' }, width: '58%', flexShrink: 0, height: '100%',
                backgroundImage: "url('/images/sistema-erp.1.12.avif')", backgroundSize: 'cover',
                backgroundPosition: 'center', position: 'relative', alignItems: 'flex-end',
            }}>
                <Box sx={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, rgba(15,23,42,0.7) 0%, rgba(2,6,23,0.5) 100%)' }} />
                <Box sx={{ position: 'relative', p: 5, color: '#fff' }}>
                    <Typography sx={{ fontWeight: 800, fontSize: 32, lineHeight: 1.2, mb: 1 }}>Ksmart360</Typography>
                    <Typography sx={{ opacity: 0.75, fontSize: 15 }}>Gestiona tu negocio de forma inteligente</Typography>
                </Box>
            </Box>

            {/* ── Panel derecho — Formularios Dinámicos ── */}
            <Box sx={{
                flex: 1, minWidth: 0, height: '100%', display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                background: 'linear-gradient(160deg, #0f172a 0%, #020617 100%)',
                px: { xs: 3, sm: 5 }, overflowY: 'auto',
            }}>
                <Box sx={{ width: '100%', maxWidth: 400, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    
                    {/* Logo (Constante) */}
                    <Box sx={{ mb: 3 }}>
                        <img src="/Logo.jpeg" alt="Ksmart360"
                            style={{
                                width: 72, height: 72, borderRadius: '50%', objectFit: 'cover',
                                border: '3px solid rgba(34,197,94,0.4)', boxShadow: '0 0 32px rgba(34,197,94,0.2)',
                            }}
                        />
                    </Box>

                    {/* ── CONTENEDOR ANIMADO (Cambia según el estado isLoginView) ── */}
                    <Box key={isLoginView ? 'login' : 'register'} sx={{ animation: `${fadeIn} 0.4s cubic-bezier(0.4, 0, 0.2, 1)`, width: '100%' }}>
                        
                        {/* Cabeceras dinámicas */}
                        <Typography sx={{ fontWeight: 800, fontSize: 28, color: '#f1f5f9', letterSpacing: -0.5, mb: 0.5, textAlign: 'center' }}>
                            {isLoginView ? 'Ingresar' : 'Crea tu espacio'}
                        </Typography>
                        <Typography sx={{ color: '#64748b', fontSize: 14, mb: 4, textAlign: 'center' }}>
                            {isLoginView ? 'Ingresa tus credenciales para continuar' : 'Obtén 14 días gratis. Sin tarjeta de crédito.'}
                        </Typography>

                        {/* FORMULARIO DE LOGIN */}
                        {isLoginView ? (
                            <Box component="form" onSubmit={handleLoginSubmit} sx={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 2 }}>
                                <TextField
                                    fullWidth label="Usuario" required sx={fieldSx}
                                    value={loginData.username} onChange={e => setLoginData({ ...loginData, username: e.target.value })}
                                    InputProps={{ startAdornment: <InputAdornment position="start"><AlternateEmail /></InputAdornment> }}
                                />
                                <TextField
                                    fullWidth label="Contraseña" type={showPassword ? 'text' : 'password'} required sx={fieldSx}
                                    value={loginData.password} onChange={e => setLoginData({ ...loginData, password: e.target.value })}
                                    InputProps={{
                                        startAdornment: <InputAdornment position="start"><Lock /></InputAdornment>,
                                        endAdornment: (
                                            <InputAdornment position="end">
                                                <IconButton onClick={() => setShowPassword(!showPassword)} edge="end" sx={{ color: '#64748b' }}>
                                                    {showPassword ? <VisibilityOff /> : <Visibility />}
                                                </IconButton>
                                            </InputAdornment>
                                        ),
                                    }}
                                />
                                <Button
                                    type="submit" fullWidth variant="contained" disabled={loading}
                                    sx={{
                                        mt: 1, py: 1.6, borderRadius: 3, fontWeight: 700, fontSize: 15,
                                        background: loading ? 'rgba(34,197,94,0.5)' : 'linear-gradient(90deg, #22c55e 0%, #16a34a 100%)',
                                        boxShadow: loading ? 'none' : '0 8px 24px rgba(34,197,94,0.35)',
                                        transition: 'all 0.2s',
                                        '&:hover': { background: 'linear-gradient(90deg, #16a34a 0%, #15803d 100%)', transform: 'translateY(-1px)' },
                                    }}
                                >
                                    {loading ? 'Ingresando…' : 'Ingresar al sistema'}
                                </Button>
                                
                                <Typography sx={{ mt: 2, color: '#94a3b8', fontSize: 13, textAlign: 'center' }}>
                                    ¿No tienes una cuenta?{' '}
                                    <span onClick={() => setIsLoginView(false)} style={{ color: '#22c55e', fontWeight: 700, cursor: 'pointer' }}>
                                        Regístrate gratis
                                    </span>
                                </Typography>
                            </Box>
                        ) : (
                            /* FORMULARIO DE REGISTRO (ONBOARDING) */
                            <Box component="form" onSubmit={handleRegisterSubmit} sx={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 2 }}>
                                <TextField
                                    fullWidth label="Nombre de tu Empresa o Negocio" required sx={fieldSx}
                                    value={regData.nombre_empresa} onChange={e => setRegData({ ...regData, nombre_empresa: e.target.value })}
                                    InputProps={{ startAdornment: <InputAdornment position="start"><Business /></InputAdornment> }}
                                />
                                <TextField
                                    fullWidth label="Usuario para iniciar sesión" required sx={fieldSx}
                                    value={regData.username} onChange={e => setRegData({ ...regData, username: e.target.value.trim() })}
                                    InputProps={{ startAdornment: <InputAdornment position="start"><Person /></InputAdornment> }}
                                />
                                <TextField
                                    fullWidth label="Contraseña segura" type={showPassword ? 'text' : 'password'} required sx={fieldSx}
                                    value={regData.password} onChange={e => setRegData({ ...regData, password: e.target.value })}
                                    InputProps={{
                                        startAdornment: <InputAdornment position="start"><Lock /></InputAdornment>,
                                        endAdornment: (
                                            <InputAdornment position="end">
                                                <IconButton onClick={() => setShowPassword(!showPassword)} edge="end" sx={{ color: '#64748b' }}>
                                                    {showPassword ? <VisibilityOff /> : <Visibility />}
                                                </IconButton>
                                            </InputAdornment>
                                        ),
                                    }}
                                />
                                <Button
                                    type="submit" fullWidth variant="contained" disabled={loading}
                                    sx={{
                                        mt: 1, py: 1.6, borderRadius: 3, fontWeight: 700, fontSize: 15,
                                        background: loading ? 'rgba(249,115,22,0.5)' : 'linear-gradient(90deg, #f97316 0%, #ea580c 100%)',
                                        boxShadow: loading ? 'none' : '0 8px 24px rgba(249,115,22,0.35)',
                                        transition: 'all 0.2s',
                                        '&:hover': { background: 'linear-gradient(90deg, #ea580c 0%, #c2410c 100%)', transform: 'translateY(-1px)' },
                                    }}
                                >
                                    {loading ? 'Configurando tu cuenta...' : 'Comenzar mi prueba gratis'}
                                </Button>
                                
                                <Typography sx={{ mt: 2, color: '#94a3b8', fontSize: 13, textAlign: 'center' }}>
                                    ¿Ya tienes una cuenta?{' '}
                                    <span onClick={() => setIsLoginView(true)} style={{ color: '#f97316', fontWeight: 700, cursor: 'pointer' }}>
                                        Inicia sesión aquí
                                    </span>
                                </Typography>
                            </Box>
                        )}
                    </Box>

                    {/* Footer Permanente */}
                    <Typography sx={{ mt: 5, color: '#334155', fontSize: 12, textAlign: 'center' }}>
                        Powered by KSMP Systems · 2026
                    </Typography>
                </Box>
            </Box>
        </Box>
    );
};

export default Login;
