import React, { useState } from 'react';
import { 
  Box, Typography, TextField, Button, Paper, Container, 
  InputAdornment, IconButton, Card, CardActionArea, Grid, CircularProgress 
} from '@mui/material';
import { 
  Visibility, VisibilityOff, Business, Person, Lock, 
  Storefront, AttachMoney 
} from '@mui/icons-material';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import apiClient from '../api';

const ACCENT = '#FF6020';

export default function Registro() {
  // ✅ AQUÍ ESTÁ LA CLAVE: Se añade tipo_negocio al estado inicial
  const [formData, setFormData] = useState({ 
    nombre_empresa: '', 
    username: '', 
    password: '', 
    tipo_negocio: 'erp' 
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.password.length < 6) {
      toast.warning('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    setLoading(true);
    try {
      // Ahora se enviará el payload completo, incluyendo tipo_negocio
      await apiClient.post('/auth/register', formData);
      toast.success('¡Espacio de trabajo configurado con éxito!');
      navigate('/login'); 
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al crear la cuenta.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ 
      minHeight: '100vh', display: 'flex', alignItems: 'center', 
      background: 'linear-gradient(160deg, #0f172a 0%, #020617 100%)', py: 5 
    }}>
      <Container maxWidth="sm">
        <Paper sx={{ p: 4, borderRadius: 4, textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.4)' }}>
          <Box sx={{ mb: 2 }}>
             <img src="/Logo.jpeg" alt="Logo" style={{ width: 60, height: 60, borderRadius: '50%' }} />
          </Box>
          <Typography variant="h5" fontWeight={800} mb={1}>Bienvenido a Ksmart360</Typography>
          <Typography variant="body2" color="text.secondary" mb={4}>
            Selecciona tu modelo de negocio para personalizar tu experiencia.
          </Typography>

          <form onSubmit={handleSubmit}>
            {/* ✅ SELECTORES DE TIPO DE NEGOCIO */}
            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid item xs={6}>
                <Card sx={{ 
                  border: formData.tipo_negocio === 'erp' ? `2px solid ${ACCENT}` : '2px solid transparent',
                  bgcolor: formData.tipo_negocio === 'erp' ? `${ACCENT}08` : 'background.paper',
                  transition: '0.3s'
                }}>
                  <CardActionArea onClick={() => setFormData({...formData, tipo_negocio: 'erp'})} sx={{ p: 2 }}>
                    <Storefront sx={{ color: formData.tipo_negocio === 'erp' ? ACCENT : 'text.disabled', fontSize: 30 }} />
                    <Typography variant="subtitle2" fontWeight={700}>Comercio / ERP</Typography>
                    <Typography variant="caption" color="text.secondary">Ventas e Inventario</Typography>
                  </CardActionArea>
                </Card>
              </Grid>
              <Grid item xs={6}>
                <Card sx={{ 
                  border: formData.tipo_negocio === 'prestamos' ? `2px solid ${ACCENT}` : '2px solid transparent',
                  bgcolor: formData.tipo_negocio === 'prestamos' ? `${ACCENT}08` : 'background.paper',
                  transition: '0.3s'
                }}>
                  <CardActionArea onClick={() => setFormData({...formData, tipo_negocio: 'prestamos'})} sx={{ p: 2 }}>
                    <AttachMoney sx={{ color: formData.tipo_negocio === 'prestamos' ? ACCENT : 'text.disabled', fontSize: 30 }} />
                    <Typography variant="subtitle2" fontWeight={700}>Cobranzas</Typography>
                    <Typography variant="caption" color="text.secondary">Rutas de Cobro</Typography>
                  </CardActionArea>
                </Card>
              </Grid>
            </Grid>

            <TextField fullWidth label="Nombre de tu Negocio" required margin="normal"
              value={formData.nombre_empresa}
              onChange={(e) => setFormData({ ...formData, nombre_empresa: e.target.value })}
              InputProps={{ startAdornment: <InputAdornment position="start"><Business /></InputAdornment> }}
            />

            <TextField fullWidth label="Usuario Maestro" required margin="normal"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value.trim() })}
              InputProps={{ startAdornment: <InputAdornment position="start"><Person /></InputAdornment> }}
            />

            <TextField fullWidth label="Contraseña" type={showPassword ? 'text' : 'password'} margin="normal" required
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              InputProps={{
                startAdornment: <InputAdornment position="start"><Lock /></InputAdornment>,
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={() => setShowPassword(!showPassword)}>
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                )
              }}
              sx={{ mb: 4 }}
            />

            <Button type="submit" fullWidth variant="contained" size="large" disabled={loading}
              sx={{ 
                bgcolor: ACCENT, py: 1.8, borderRadius: 3, fontWeight: 800, fontSize: 16,
                boxShadow: `0 8px 24px ${ACCENT}40`,
                '&:hover': { bgcolor: '#e6561c' } 
              }}
            >
              {loading ? <CircularProgress size={24} color="inherit" /> : 'Crear mi Empresa'}
            </Button>
          </form>

          <Typography sx={{ mt: 3, fontSize: 13, color: 'text.secondary' }}>
            ¿Ya tienes una cuenta? <Link to="/login" style={{ color: ACCENT, fontWeight: 700, textDecoration: 'none' }}>Inicia sesión aquí</Link>
          </Typography>
        </Paper>
      </Container>
    </Box>
  );
}