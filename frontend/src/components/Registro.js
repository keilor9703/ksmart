import React, { useState } from 'react';
import { Box, Typography, TextField, Button, Paper, Container, InputAdornment, IconButton } from '@mui/material';
import { Visibility, VisibilityOff, Business, Person, Lock } from '@mui/icons-material';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import apiClient from '../api';

const ACCENT = '#FF6020';

export default function Registro() {
  const [formData, setFormData] = useState({ nombre_empresa: '', username: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validación básica de frontend
    if (formData.password.length < 6) {
      toast.warning('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    setLoading(true);
    try {
      await apiClient.post('/auth/register', formData);
      toast.success('¡Cuenta creada con éxito! Ahora puedes iniciar sesión.');
      // Limpiamos el formulario por seguridad y redirigimos
      setFormData({ nombre_empresa: '', username: '', password: '' });
      navigate('/login'); 
    } catch (error) {
      // Manejo estricto de errores del backend
      const errorMsg = error.response?.data?.detail || 'Error de conexión con el servidor.';
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#f8fafc', p: 2 }}>
      <Container maxWidth="sm">
        <Paper sx={{ p: { xs: 3, md: 5 }, borderRadius: 4, boxShadow: '0 10px 40px rgba(0,0,0,0.08)', textAlign: 'center' }}>
          
          <Box component="img" src="/Logo2.png" alt="Logo" sx={{ width: 60, height: 60, mb: 2, borderRadius: 2 }} />
          
          <Typography variant="h5" sx={{ fontWeight: 800, mb: 1 }}>Crea tu espacio de trabajo</Typography>
          <Typography sx={{ color: 'text.secondary', fontSize: 14, mb: 4 }}>
            Únete a Ksmart360 y obtén 14 días gratis con todas las funciones premium.
          </Typography>

          <form onSubmit={handleSubmit}>
            <TextField
              fullWidth required label="Nombre de tu Empresa o Negocio" variant="outlined" margin="normal"
              value={formData.nombre_empresa}
              onChange={(e) => setFormData({ ...formData, nombre_empresa: e.target.value })}
              InputProps={{ startAdornment: <InputAdornment position="start"><Business sx={{ color: 'text.secondary' }}/></InputAdornment> }}
              sx={{ mb: 2 }}
            />
            
            <TextField
              fullWidth required label="Usuario para iniciar sesión" variant="outlined" margin="normal"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value.trim() })} // trim() evita espacios accidentales
              InputProps={{ startAdornment: <InputAdornment position="start"><Person sx={{ color: 'text.secondary' }}/></InputAdornment> }}
              sx={{ mb: 2 }}
            />

            <TextField
              fullWidth required label="Contraseña segura" type={showPassword ? 'text' : 'password'} variant="outlined" margin="normal"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              InputProps={{
                startAdornment: <InputAdornment position="start"><Lock sx={{ color: 'text.secondary' }}/></InputAdornment>,
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={() => setShowPassword(!showPassword)} edge="end">
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                )
              }}
              sx={{ mb: 4 }}
            />

            <Button
              type="submit" fullWidth variant="contained" size="large" disabled={loading}
              sx={{ bgcolor: ACCENT, '&:hover': { bgcolor: '#e6561c' }, fontWeight: 700, py: 1.5, borderRadius: 2, mb: 3 }}
            >
              {loading ? 'Configurando tu cuenta...' : 'Comenzar mi prueba gratis'}
            </Button>
          </form>

          <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>
            ¿Ya tienes una cuenta?{' '}
            <Link to="/login" style={{ color: ACCENT, fontWeight: 700, textDecoration: 'none' }}>
              Inicia sesión aquí
            </Link>
          </Typography>
        </Paper>
      </Container>
    </Box>
  );
}
