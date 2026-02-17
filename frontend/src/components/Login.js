import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import apiClient from '../api';
import { Avatar, Button, TextField, Box, Typography, Container, Card } from '@mui/material';

const Login = ({ onLogin }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const response = await apiClient.post('/token',
                new URLSearchParams({
                    username: username,
                    password: password,
                }),
                {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    }
                }
            );
            const { access_token } = response.data;
            localStorage.setItem('token', access_token);
            toast.success('Inicio de sesión exitoso!');
            onLogin();
            navigate('/');
        } catch (error) {
            console.error('Error de inicio de sesión:', error);
            toast.error('Credenciales inválidas.');
        }
    };

    return (
        <Container component="main" maxWidth="xs">
            <Card sx={{ marginTop: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', p: 2 }}>
                <Box sx={{ width: 80, height: 80, borderRadius: '50%', overflow: 'hidden', m: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    <img src={process.env.PUBLIC_URL + '/Logo.jpeg'} alt="Ksmart360 Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                </Box>
                <Typography component="h1" variant="h5" color="text.primary">
                    Iniciar Sesión
                </Typography>
                <Box component="form" onSubmit={handleSubmit} noValidate sx={{ mt: 1 }}>
                    <TextField
                        margin="normal"
                        required
                        fullWidth
                        id="username"
                        label="Usuario"
                        name="username"
                        autoComplete="username"
                        autoFocus
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                    />
                    <TextField
                        margin="normal"
                        required
                        fullWidth
                        name="password"
                        label="Contraseña"
                        type="password"
                        id="password"
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                    />
                    <Button
                        type="submit"
                        fullWidth
                        variant="contained"
                        sx={{ mt: 3, mb: 2 }}
                    >
                        Ingresar
                    </Button>
                </Box>
            </Card>
        </Container>
    );
};

export default Login;