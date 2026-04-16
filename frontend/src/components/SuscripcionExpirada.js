import React, { useState, useEffect } from 'react';
import { Box, Typography, Button, Paper, CircularProgress, Container, Grid } from '@mui/material';
import { WorkspacePremium, CheckCircle, Lock, Refresh } from '@mui/icons-material';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import apiClient from '../api';

const ACCENT = '#FF6020';

const formatCurrency = (val) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(val);

export default function SuscripcionExpirada() {
  const [loadingPayment, setLoadingPayment] = useState(false);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [planes, setPlanes] = useState([]);
  const [loadingPlanes, setLoadingPlanes] = useState(true);
  const [isVerifying, setIsVerifying] = useState(false);
  
  const navigate = useNavigate();

  useEffect(() => {
    // 1. Cargar Script de Bold
    const initBoldCheckout = () => {
      if (document.querySelector('script[src="https://checkout.bold.co/library/boldPaymentButton.js"]')) {
        setScriptLoaded(true);
        return;
      }
      const js = document.createElement('script');
      js.src = 'https://checkout.bold.co/library/boldPaymentButton.js';
      js.async = true;
      js.onload = () => setScriptLoaded(true);
      document.head.appendChild(js);
    };
    initBoldCheckout();

    // 2. Traer Planes Activos
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

    // 3. 🚀 MAGIA: Polling en segundo plano. 
    // Revisa cada 4 segundos si el webhook ya activó la cuenta por detrás.
    const checkInterval = setInterval(async () => {
      try {
        const res = await apiClient.get('/users/me');
        if (res.status === 200) {
          clearInterval(checkInterval);
          toast.success('¡Pago detectado exitosamente!');
          window.location.href = '/'; // Recarga forzada para limpiar el estado
        }
      } catch (error) {
        // Ignoramos el error silenciosamente mientras espera
      }
    }, 4000);

    return () => clearInterval(checkInterval);
  }, []);

  // Función para el botón manual de verificar
  const verificarPagoManual = async () => {
    setIsVerifying(true);
    try {
      const res = await apiClient.get('/users/me');
      if (res.status === 200) {
        toast.success('¡Tu cuenta ha sido activada!');
        window.location.href = '/';
      }
    } catch (error) {
      toast.info('Aún estamos esperando la confirmación de tu banco. Intenta en unos segundos.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handlePaymentClick = async (planCodigo) => {
    if (!scriptLoaded || !window.BoldCheckout) {
      toast.warning('La pasarela aún está cargando...');
      return;
    }
    setLoadingPayment(true);
    try {
      const { data } = await apiClient.post('/pagos/generar-hash', { plan_name: planCodigo });

      const checkout = new window.BoldCheckout({
        orderId: data.order_id,
        currency: data.currency,
        amount: data.amount,
        apiKey: data.api_key,
        integritySignature: data.hash_integridad,
        description: `Suscripción Ksmart360 - ${planCodigo.toUpperCase()}`,
        redirectionUrl: `${window.location.origin}/`,
        renderMode: 'embedded'
      });

      checkout.open();

    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al procesar el pago.');
    } finally {
      setLoadingPayment(false);
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
          
          <Box sx={{ width: 72, height: 72, borderRadius: '50%', bgcolor: 'rgba(245, 158, 11, 0.1)', color: '#F59E0B', display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 3 }}>
            <WorkspacePremium sx={{ fontSize: 40 }} />
          </Box>
          
          <Typography variant="h4" sx={{ fontWeight: 800, mb: 1, letterSpacing: -0.5 }}>Tu periodo de prueba finalizó</Typography>
          <Typography sx={{ color: '#94a3b8', fontSize: 15, mb: 4 }}>Elige el plan que mejor se adapte a tu negocio para continuar.</Typography>

          {loadingPlanes ? (
            <CircularProgress sx={{ color: ACCENT, my: 4 }} />
          ) : planes.length === 0 ? (
            <Typography sx={{ my: 4, color: '#fca5a5' }}>En este momento no hay planes disponibles.</Typography>
          ) : (
            <Grid container spacing={3} justifyContent="center" sx={{ mb: 4 }}>
              {planes.map((plan) => (
                <Grid item xs={12} sm={6} md={planes.length === 1 ? 8 : 6} key={plan.id}>
                  <Box sx={{ p: 3, borderRadius: 3, bgcolor: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.05)', height: '100%', display: 'flex', flexDirection: 'column' }}>
                    <Typography sx={{ fontSize: 13, color: '#94a3b8', textTransform: 'uppercase', mb: 1, fontWeight: 700 }}>
                      {plan.nombre}
                    </Typography>
                    
                    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'baseline', mb: 2 }}>
                      <Typography sx={{ fontSize: 36, fontWeight: 800 }}>{formatCurrency(plan.precio)}</Typography>
                      <Typography sx={{ fontSize: 14, color: '#94a3b8', ml: 1 }}>/ {plan.dias_duracion} días</Typography>
                    </Box>

                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, textAlign: 'left', mb: 3, flexGrow: 1 }}>
                      {plan.caracteristicas ? plan.caracteristicas.split(',').map((feat, i) => (
                        <Box key={i} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                          <CheckCircle sx={{ color: '#22c55e', fontSize: 18, mt: 0.2 }} />
                          <Typography sx={{ fontSize: 13, color: '#cbd5e1' }}>{feat.trim()}</Typography>
                        </Box>
                      )) : (
                        <Typography sx={{ fontSize: 13, color: '#64748b', textAlign: 'center' }}>Acceso total a la plataforma</Typography>
                      )}
                    </Box>

                    <Button
                      fullWidth variant="contained" size="large"
                      disabled={loadingPayment || !scriptLoaded}
                      onClick={() => handlePaymentClick(plan.codigo_interno)}
                      sx={{ bgcolor: ACCENT, '&:hover': { bgcolor: '#e6561c' }, fontWeight: 700, borderRadius: 2 }}
                    >
                      {loadingPayment ? <CircularProgress size={24} color="inherit" /> : 'Seleccionar Plan'}
                    </Button>
                  </Box>
                </Grid>
              ))}
            </Grid>
          )}

          {/* 🚀 BOTÓN MANUAL DE VERIFICACIÓN */}
          <Box sx={{ mt: 2, mb: 4, p: 2, borderRadius: 2, bgcolor: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.2)' }}>
            <Typography sx={{ fontSize: 13, color: '#cbd5e1', mb: 1.5 }}>¿Ya realizaste tu pago y la pantalla no avanza?</Typography>
            <Button 
              variant="outlined" 
              startIcon={isVerifying ? <CircularProgress size={16} /> : <Refresh />} 
              onClick={verificarPagoManual}
              disabled={isVerifying}
              sx={{ color: '#4ade80', borderColor: '#4ade80', '&:hover': { borderColor: '#22c55e', bgcolor: 'rgba(34, 197, 94, 0.1)' } }}
            >
              {isVerifying ? 'Verificando...' : 'Verificar estado del pago'}
            </Button>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, color: '#64748b', mb: 3 }}>
            <Lock sx={{ fontSize: 14 }} />
            <Typography sx={{ fontSize: 12 }}>Pagos seguros procesados por Bold</Typography>
          </Box>

          <Button onClick={handleLogout} sx={{ color: '#94a3b8', fontSize: 13, textTransform: 'none' }}>
            Cerrar sesión
          </Button>
        </Paper>
      </Container>
    </Box>
  );
}
