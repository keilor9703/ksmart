import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import apiClient from '../api';

import {
    Box,
    TextField,
    Button,
    Typography,
    Paper,
    InputAdornment,
    IconButton
} from '@mui/material';

import { Visibility, VisibilityOff } from '@mui/icons-material';

const Login = ({ onLogin }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);

    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            const response = await apiClient.post(
                '/token',
                new URLSearchParams({ username, password }),
                {
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                }
            );

            localStorage.setItem('token', response.data.access_token);
            toast.success('Inicio de sesión exitoso');
            onLogin();
            navigate('/');
        } catch {
            toast.error('Credenciales inválidas');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Box
            sx={{
                display: 'flex',
                height: '100vh',
                width: '100vw',
                overflow: 'hidden',
            }}
        >
            {/* IMAGEN IZQUIERDA — se oculta en pantallas pequeñas */}
            <Box
                sx={{
                    // En md+ ocupa 60%, en sm ocupa 40%, en xs desaparece
                    display: { xs: 'none', sm: 'block' },
                    width: { sm: '40%', md: '60%' },
                    flexShrink: 0,
                    height: '100%',
                    backgroundImage: "url('/images/1706694810975.jpg')",
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    position: 'relative',
                    transition: 'width 0.3s ease',
                }}
            >
                {/* overlay oscuro */}
                <Box
                    sx={{
                        position: 'absolute',
                        inset: 0,
                        background: 'rgba(0,0,0,0.45)',
                    }}
                />

                {/* texto branding */}
                <Box
                    sx={{
                        position: 'absolute',
                        bottom: 40,
                        left: 40,
                        color: '#fff',
                    }}
                >
                    <Typography variant="h4" fontWeight={700}>
                        Ksmart360
                    </Typography>
                    <Typography sx={{ opacity: 0.8 }}>
                        Gestiona tu negocio de forma inteligente
                    </Typography>
                </Box>
            </Box>

            {/* LOGIN DERECHO — siempre visible, ocupa el espacio restante */}
            <Box
                sx={{
                    flex: 1,
                    minWidth: 0,          // evita desbordamiento en flex
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'linear-gradient(180deg, #0f172a, #020617)',
                    px: { xs: 2, sm: 3 }, // padding lateral en móvil
                }}
            >
                <Paper
                    sx={{
                        width: '100%',
                        maxWidth: 420,
                        p: { xs: 3, sm: 5 }, // padding interno adaptable
                        borderRadius: 4,
                        background: 'rgba(15, 23, 42, 0.85)',
                        backdropFilter: 'blur(12px)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
                        color: '#fff',
                    }}
                >
                    {/* LOGO */}
                    <Box sx={{ textAlign: 'center', mb: 3 }}>
                        <img
                            src="/Logo.jpeg"
                            alt="logo"
                            style={{
                                width: 60,
                                height: 60,
                                borderRadius: '50%',
                                display: 'inline',
                                maxWidth: '100%',
                            }}
                        />
                    </Box>

                    {/* TITULO */}
                    <Typography
                        variant="h5"
                        textAlign="center"
                        fontWeight={700}
                        sx={{ mb: 1 }}
                    >
                        Iniciar sesión
                    </Typography>

                    <Typography
                        variant="body2"
                        textAlign="center"
                        sx={{ mb: 4, opacity: 0.7 }}
                    >
                        Ingresa tus credenciales para continuar
                    </Typography>

                    {/* FORM */}
                    <Box component="form" onSubmit={handleSubmit}>

                        <TextField
                            fullWidth
                            label="Usuario"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            sx={{
                                mb: 2,
                                input: { color: '#fff' },
                                label: { color: '#94a3b8' },
                                '& .MuiOutlinedInput-root': {
                                    borderRadius: 2,
                                    backgroundColor: 'rgba(255,255,255,0.05)',
                                },
                            }}
                        />

                        <TextField
                            fullWidth
                            label="Contraseña"
                            type={showPassword ? 'text' : 'password'}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            sx={{
                                mb: 3,
                                input: { color: '#fff' },
                                label: { color: '#94a3b8' },
                                '& .MuiOutlinedInput-root': {
                                    borderRadius: 2,
                                    backgroundColor: 'rgba(255,255,255,0.05)',
                                },
                            }}
                            InputProps={{
                                endAdornment: (
                                    <InputAdornment position="end">
                                        <IconButton onClick={() => setShowPassword(!showPassword)}>
                                            {showPassword ? <VisibilityOff /> : <Visibility />}
                                        </IconButton>
                                    </InputAdornment>
                                ),
                            }}
                        />

                        <Button
                            fullWidth
                            type="submit"
                            variant="contained"
                            sx={{
                                py: 1.5,
                                borderRadius: 2,
                                fontWeight: 600,
                                background: 'linear-gradient(90deg, #22c55e, #16a34a)',
                            }}
                        >
                            {loading ? 'Ingresando...' : 'Ingresar'}
                        </Button>
                    </Box>
                </Paper>
            </Box>
        </Box>
    );
};

export default Login;
