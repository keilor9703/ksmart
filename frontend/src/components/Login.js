import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import apiClient from '../api';
import {
    Box, TextField, Button, Typography, InputAdornment, IconButton
} from '@mui/material';
import { Visibility, VisibilityOff, AlternateEmail, Lock } from '@mui/icons-material';

// ─── Estilos compartidos para los campos de texto — estilo Rappi ──────────────
const fieldSx = {
    '& .MuiInputLabel-root': {
        color: '#64748b',
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: 1.2,
        textTransform: 'uppercase',
    },
    '& .MuiInputLabel-root.Mui-focused': {
        color: '#22c55e',
    },
    '& .MuiOutlinedInput-root': {
        borderRadius: 3,
        backgroundColor: 'rgba(241, 245, 249, 0.06)',
        backdropFilter: 'blur(8px)',
        color: '#f1f5f9',
        fontSize: 15,
        // Fix crítico: evitar el fondo azul del autocompletado del navegador
        '& input': {
            color: '#f1f5f9',
            WebkitTextFillColor: '#f1f5f9',
            caretColor: '#22c55e',
            // Anular el background azul del autocomplete del navegador
            '&:-webkit-autofill': {
                WebkitBoxShadow: '0 0 0 100px #1e293b inset',
                WebkitTextFillColor: '#f1f5f9',
                caretColor: '#22c55e',
                borderRadius: 'inherit',
            },
        },
        '& fieldset': {
            borderColor: 'rgba(148, 163, 184, 0.25)',
            borderWidth: 1.5,
        },
        '&:hover fieldset': {
            borderColor: 'rgba(148, 163, 184, 0.5)',
        },
        '&.Mui-focused fieldset': {
            borderColor: '#22c55e',
            borderWidth: 2,
        },
    },
    '& .MuiInputAdornment-root .MuiSvgIcon-root': {
        color: '#64748b',
        fontSize: 20,
    },
    '& .MuiOutlinedInput-root.Mui-focused .MuiInputAdornment-root .MuiSvgIcon-root': {
        color: '#22c55e',
    },
};

const Login = ({ onLogin }) => {
    const [username, setUsername]       = useState('');
    const [password, setPassword]       = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading]         = useState(false);
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const response = await apiClient.post(
                '/token',
                new URLSearchParams({ username, password }),
                { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
            );
            localStorage.setItem('token', response.data.access_token);
            toast.success('Inicio de sesión exitoso');
            onLogin();
            navigate('/');
        } catch {
            toast.error('Usuario o contraseña incorrectos');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Box sx={{
            display: 'flex',
            height: '100vh',
            width: '100vw',
            overflow: 'hidden',
        }}>

            {/* ── Panel izquierdo — imagen de fondo ── */}
            <Box sx={{
                display: { xs: 'none', md: 'flex' },
                width: '58%',
                flexShrink: 0,
                height: '100%',
                backgroundImage: "url('/images/sistema-erp.1.12.avif')",
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                position: 'relative',
                alignItems: 'flex-end',
            }}>
                {/* Degradado oscuro para legibilidad */}
                <Box sx={{
                    position: 'absolute', inset: 0,
                    background: 'linear-gradient(135deg, rgba(15,23,42,0.7) 0%, rgba(2,6,23,0.5) 100%)',
                }} />
                <Box sx={{ position: 'relative', p: 5, color: '#fff' }}>
                    <Typography sx={{ fontWeight: 800, fontSize: 32, lineHeight: 1.2, mb: 1 }}>
                        Ksmart360
                    </Typography>
                    <Typography sx={{ opacity: 0.75, fontSize: 15 }}>
                        Gestiona tu negocio de forma inteligente
                    </Typography>
                </Box>
            </Box>

            {/* ── Panel derecho — formulario ── */}
            <Box sx={{
                flex: 1,
                minWidth: 0,
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'linear-gradient(160deg, #0f172a 0%, #020617 100%)',
                px: { xs: 3, sm: 5 },
                overflowY: 'auto',
            }}>

                {/* Tarjeta del formulario */}
                <Box sx={{
                    width: '100%',
                    maxWidth: 400,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                }}>

                    {/* Logo */}
                    <Box sx={{ mb: 3 }}>
                        <img
                            src="/Logo.jpeg"
                            alt="Ksmart360"
                            style={{
                                width: 72, height: 72,
                                borderRadius: '50%',
                                objectFit: 'cover',
                                border: '3px solid rgba(34,197,94,0.4)',
                                boxShadow: '0 0 32px rgba(34,197,94,0.2)',
                            }}
                        />
                    </Box>

                    {/* Título */}
                    <Typography sx={{
                        fontWeight: 800, fontSize: 30, color: '#f1f5f9',
                        letterSpacing: -0.5, mb: 0.5,
                    }}>
                        Ingresar
                    </Typography>
                    <Typography sx={{ color: '#64748b', fontSize: 14, mb: 4, textAlign: 'center' }}>
                        Ingresa tus credenciales para continuar
                    </Typography>

                    {/* ── Formulario ── */}
                    <Box
                        component="form"
                        onSubmit={handleSubmit}
                        sx={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 2 }}
                        autoComplete="on"
                    >
                        {/* Campo usuario */}
                        <TextField
                            fullWidth
                            label="Usuario"
                            value={username}
                            onChange={e => setUsername(e.target.value)}
                            autoComplete="username"
                            required
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <AlternateEmail />
                                    </InputAdornment>
                                ),
                            }}
                            sx={fieldSx}
                        />

                        {/* Campo contraseña */}
                        <TextField
                            fullWidth
                            label="Contraseña"
                            type={showPassword ? 'text' : 'password'}
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            autoComplete="current-password"
                            required
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <Lock />
                                    </InputAdornment>
                                ),
                                endAdornment: (
                                    <InputAdornment position="end">
                                        <IconButton
                                            onClick={() => setShowPassword(s => !s)}
                                            edge="end"
                                            sx={{ color: '#64748b', '&:hover': { color: '#94a3b8' } }}
                                        >
                                            {showPassword ? <VisibilityOff /> : <Visibility />}
                                        </IconButton>
                                    </InputAdornment>
                                ),
                            }}
                            sx={fieldSx}
                        />

                        {/* Botón */}
                        <Button
                            fullWidth
                            type="submit"
                            variant="contained"
                            disabled={loading}
                            sx={{
                                mt: 1,
                                py: 1.6,
                                borderRadius: 3,
                                fontWeight: 700,
                                fontSize: 16,
                                letterSpacing: 0.3,
                                background: loading
                                    ? 'rgba(34,197,94,0.5)'
                                    : 'linear-gradient(90deg, #22c55e 0%, #16a34a 100%)',
                                boxShadow: loading ? 'none' : '0 8px 24px rgba(34,197,94,0.35)',
                                transition: 'all 0.2s',
                                '&:hover': {
                                    background: 'linear-gradient(90deg, #16a34a 0%, #15803d 100%)',
                                    boxShadow: '0 12px 32px rgba(34,197,94,0.45)',
                                    transform: 'translateY(-1px)',
                                },
                                '&:active': { transform: 'translateY(0)' },
                                '&.Mui-disabled': { color: '#fff' },
                            }}
                        >
                            {loading ? 'Ingresando…' : 'Ingresar'}
                        </Button>
                    </Box>

                    {/* Footer */}
                    <Typography sx={{ mt: 4, color: '#334155', fontSize: 12, textAlign: 'center' }}>
                        Powered by KSMP Systems · 2026
                    </Typography>
                </Box>
            </Box>
        </Box>
    );
};

export default Login;
