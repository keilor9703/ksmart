import React, { useState, useEffect } from 'react';
import { Box, Typography, Paper, CircularProgress, Container, Grid, Button } from '@mui/material';
import { WorkspacePremium, Lock, Refresh } from '@mui/icons-material';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import apiClient from '../api';
import WompiButton from './WompiButton'; // ✅ Importamos nuestro nuevo motor de pagos

const ACCENT = '#F43F5E'; // Rojo/Rosa corporativo

const formatCurrency = (val) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(val);

export default function SuscripcionExpirada() {
  const [planes, setPlanes] = useState([]);
  const [loadingPlanes, setLoadingPlanes] = useState(true);
  const [isVerifying, setIsVerifying] = useState(false);
  
  const navigate = useNavigate();

  useEffect(() => {
    // 1. Traer Planes Activos
    const fetchPlanes = async () => {
      try {
        const { data } = await apiClient.get('/planes-activos');
        setPlanes(data);
      } catch (error) {
        toast.error("Error al cargar los planes.");
      } finally {
        setLoadingPlanes(false);
      }
    };
    fetchPlanes();

    // 2. 🚀 MAGIA: Polling en segundo plano. 
    // Revisa cada 5 segundos si el webhook de WOMPI ya activó la cuenta.
    const checkInterval = setInterval(async () => {
      try {
        const res = await apiClient.get('/users/me');
        if (res.status === 200) {
          clearInterval(checkInterval);
          toast.success('¡Pago detectado! Tu cuenta ha sido activada.');
          window.location.href = '/'; // Redirección absoluta a la raíz
        }
      } catch (error) {
        // Ignoramos errores mientras esperamos la activación
      }
    }, 5000);

    return () => clearInterval(checkInterval);
  }, []);

  const verificarPagoManual = async () => {
    setIsVerifying(true);
    try {
      const res = await apiClient.get('/users/me');
      if (res.status === 200) {
        toast.success('¡Tu cuenta está activa!');
        window.location.href = '/';
      }
    } catch (error) {
      toast.info('Aún no recibimos confirmación de Wompi. Intenta en un momento.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  return (
    <Box sx={{ 
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', 
      background: 'linear-gradient(160deg, #0f172a 0%, #020617 100%)', p: 2 
    }}>
      <Container maxWidth="md">
        <Paper sx={{ 
          p: { xs: 3, md: 5 }, borderRadius: 4, textAlign: 'center',
          background: 'rgba(30, 41, 59, 0.7)', backdropFilter: 'blur(16px)',
          border: '1px solid rgba(255,255,255,0.1)', color: '#f8fafc',
          position: 'relative'
        }}>
          
          <Box sx={{ width: 72, height: 72, borderRadius: '50%', bgcolor: 'rgba(244, 63, 94, 0.1)', color: ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 3 }}>
            <WorkspacePremium sx={{ fontSize: 40 }} />
          </Box>
          
          <Typography variant="h4" sx={{ fontWeight: 800, mb: 1, letterSpacing: -0.5 }}>Tu acceso ha expirado</Typography>
          <Typography sx={{ color: '#94a3b8', fontSize: 15, mb: 4 }}>Renueva tu suscripción para seguir gestionando tu negocio con Ksmart360.</Typography>

          {loadingPlanes ? (
            <CircularProgress sx={{ color: ACCENT, my: 4 }} />
          ) : planes.length === 0 ? (
            <Typography sx={{ my: 4, color: '#fca5a5' }}>No hay planes de suscripción configurados.</Typography>
          ) : (
            <Grid container spacing={3} justifyContent="center" sx={{ mb: 4 }}>
              {planes.map((plan) => (
                <Grid item xs={12} sm={6} key={plan.id}>
                  <Box sx={{ 
                    p: 3, borderRadius: 3, bgcolor: 'rgba(0,0,0,0.3)', 
                    border: '1px solid rgba(255,255,255,0.05)', height: '100%', 
                    display: 'flex', flexDirection: 'column' 
                  }}>
                    <Typography sx={{ fontSize: 13, color: ACCENT, textTransform: 'uppercase', mb: 1, fontWeight: 800 }}>
                      {plan.nombre}
                    </Typography>
                    
                    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'baseline', mb: 3 }}>
                      <Typography sx={{ fontSize: 32, fontWeight: 800 }}>{formatCurrency(plan.precio)}</Typography>
                      <Typography sx={{ fontSize: 14, color: '#94a3b8', ml: 1 }}>/ {plan.dias_duracion} días</Typography>
                    </Box>

                    <Box sx={{ flexGrow: 1, mb: 3 }}>
                        {plan.caracteristicas?.split(',').map((feat, i) => (
                            <Typography key={i} sx={{ fontSize: 13, color: '#cbd5e1', mb: 0.5 }}>• {feat.trim()}</Typography>
                        ))}
                    </Box>

                    {/* ✅ EL NUEVO BOTÓN DE WOMPI */}
                    <WompiButton 
                      planName={plan.codigo_interno} 
                      onSuccess={() => { window.location.href = '/'; }} 
                    />
                  </Box>
                </Grid>
              ))}
            </Grid>
          )}

          <Box sx={{ mt: 2, mb: 4, p: 2, borderRadius: 2, bgcolor: 'rgba(34, 197, 94, 0.05)', border: '1px solid rgba(34, 197, 94, 0.1)' }}>
            <Typography sx={{ fontSize: 13, color: '#cbd5e1', mb: 1.5 }}>¿Ya realizaste el pago y no ves el cambio?</Typography>
            <Button 
              variant="outlined" 
              size="small"
              startIcon={isVerifying ? <CircularProgress size={16} /> : <Refresh />} 
              onClick={verificarPagoManual}
              disabled={isVerifying}
              sx={{ color: '#4ade80', borderColor: '#4ade80', '&:hover': { borderColor: '#22c55e' } }}
            >
              Verificar suscripción ahora
            </Button>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, color: '#64748b', mb: 3 }}>
            <Lock sx={{ fontSize: 14 }} />
            <Typography sx={{ fontSize: 12 }}>Pagos seguros procesados por <strong>Wompi (Bancolombia)</strong></Typography>
          </Box>

          <Button onClick={handleLogout} sx={{ color: '#94a3b8', fontSize: 13, textTransform: 'none' }}>
            Cerrar sesión
          </Button>
        </Paper>
      </Container>
    </Box>
  );
}