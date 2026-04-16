import React, { useState, useEffect, useRef } from 'react';
import { Box, Typography, Button, Paper, CircularProgress, Container, Fade } from '@mui/material';
import { WorkspacePremium, CheckCircle, Lock, Autorenew } from '@mui/icons-material';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import apiClient from '../api';

const ACCENT = '#FF6020';

export default function SuscripcionExpirada() {
  const [loadingPayment, setLoadingPayment] = useState(false);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [isWaitingPayment, setIsWaitingPayment] = useState(false);
  const navigate = useNavigate();
  
  // Usamos una referencia para el intervalo para poder limpiarlo fácilmente
  const pollingRef = useRef(null);

  // 1. Inyectar el Script de Bold
  useEffect(() => {
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

    // Limpieza al desmontar el componente
    return () => stopPolling();
  }, []);

  // 2. Función para dejar de preguntar al servidor
  const stopPolling = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  };

  // 3. Función de Sondeo (Polling)
  const startPollingStatus = () => {
    setIsWaitingPayment(true);
    
    // Si ya hay un intervalo corriendo, lo limpiamos para no duplicar
    stopPolling();

    pollingRef.current = setInterval(async () => {
      try {
        // Consultamos el perfil del usuario
        // Si el backend devuelve 200 (en lugar de 402), es porque ya está activo
        const res = await apiClient.get('/users/me');
        
        if (res.status === 200 && res.data.empresa.plan_type === 'premium') {
          stopPolling();
          toast.success('¡Pago verificado con éxito! Bienvenido al plan Premium.');
          
          // Damos un segundo de gracia para que el usuario vea el éxito y redirigimos
          setTimeout(() => {
            window.location.href = '/'; // Forzamos recarga limpia al dashboard
          }, 1500);
        }
      } catch (error) {
        // Mientras siga devolviendo 402, simplemente ignoramos el error y seguimos esperando
        console.log("Esperando confirmación de pago...");
      }
    }, 4000); // Preguntamos cada 4 segundos
  };

  // 4. Manejador de Pago
  const handlePaymentClick = async (planName) => {
    if (!scriptLoaded || !window.BoldCheckout) {
      toast.warning('La pasarela aún está cargando...');
      return;
    }

    setLoadingPayment(true);
    try {
      const { data } = await apiClient.post('/pagos/generar-hash', { plan_name: planName });

      const checkout = new window.BoldCheckout({
        orderId: data.order_id,
        currency: data.currency,
        amount: data.amount,
        apiKey: data.api_key,
        integritySignature: data.hash_integridad,
        description: `Suscripción Ksmart360 - PREMIUM`,
        redirectionUrl: `${window.location.origin}/`,
        renderMode: 'embedded'
      });

      checkout.open();
      
      // 🚀 ¡AQUÍ EMPIEZA LA MAGIA!
      // Una vez abierta la pasarela, empezamos a vigilar el backend
      startPollingStatus();

    } catch (error) {
      toast.error('Error al iniciar el proceso de pago.');
    } finally {
      setLoadingPayment(false);
    }
  };

  const handleLogout = () => {
    stopPolling();
    localStorage.removeItem('token');
    navigate('/login');
  };

  return (
    <Box sx={{ 
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', 
      background: 'linear-gradient(160deg, #0f172a 0%, #020617 100%)', p: 2 
    }}>
      <Container maxWidth="sm">
        <Paper sx={{ 
          p: { xs: 3, md: 5 }, borderRadius: 4, textAlign: 'center',
          background: 'rgba(30, 41, 59, 0.7)', backdropFilter: 'blur(16px)',
          border: '1px solid rgba(255,255,255,0.1)', color: '#f8fafc',
          position: 'relative', overflow: 'hidden'
        }}>
          
          {/* Overlay de espera de pago */}
          <Fade in={isWaitingPayment}>
            <Box sx={{ 
              position: 'absolute', inset: 0, bgcolor: 'rgba(15, 23, 42, 0.9)', 
              zIndex: 10, display: 'flex', flexDirection: 'column', 
              alignItems: 'center', justifyContent: 'center', p: 3
            }}>
              <Autorenew sx={{ fontSize: 60, color: ACCENT, mb: 2, animation: 'spin 2s linear infinite' }} />
              <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
              <Typography variant="h5" sx={{ fontWeight: 800, mb: 1 }}>Procesando tu pago...</Typography>
              <Typography sx={{ color: '#94a3b8', mb: 4 }}>
                No cierres esta ventana. Estamos esperando la confirmación de tu banco.
              </Typography>
              <Button onClick={() => setIsWaitingPayment(false)} sx={{ color: '#94a3b8' }}>
                Regresar a las opciones
              </Button>
            </Box>
          </Fade>

          <Box sx={{ 
            width: 72, height: 72, borderRadius: '50%', bgcolor: 'rgba(245, 158, 11, 0.1)', 
            color: '#F59E0B', display: 'flex', alignItems: 'center', justifyContent: 'center', 
            mx: 'auto', mb: 3 
          }}>
            <WorkspacePremium sx={{ fontSize: 40 }} />
          </Box>
          
          <Typography variant="h4" sx={{ fontWeight: 800, mb: 1, letterSpacing: -0.5 }}>
            Tu periodo de prueba finalizó
          </Typography>
          <Typography sx={{ color: '#94a3b8', fontSize: 15, mb: 4 }}>
            Activa tu plan Premium para continuar gestionando tu negocio.
          </Typography>

          <Box sx={{ p: 3, borderRadius: 3, bgcolor: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.05)', mb: 4 }}>
            <Typography sx={{ fontSize: 13, color: '#94a3b8', textTransform: 'uppercase', mb: 1 }}>Plan Mensual</Typography>
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'baseline', mb: 2 }}>
              <Typography sx={{ fontSize: 24, fontWeight: 600, color: '#94a3b8', mr: 0.5 }}>$</Typography>
              <Typography sx={{ fontSize: 48, fontWeight: 800 }}>95.000</Typography>
              <Typography sx={{ fontSize: 16, color: '#94a3b8', ml: 1 }}>/ mes</Typography>
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, textAlign: 'left', maxWidth: 220, mx: 'auto' }}>
              {['Ventas e Inventario Ilimitado', 'Múltiples Usuarios', 'Soporte Prioritario'].map((f, i) => (
                <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <CheckCircle sx={{ color: '#22c55e', fontSize: 16 }} />
                  <Typography sx={{ fontSize: 13, color: '#cbd5e1' }}>{f}</Typography>
                </Box>
              ))}
            </Box>
          </Box>

          <Button
            fullWidth variant="contained" size="large"
            disabled={loadingPayment || !scriptLoaded}
            onClick={() => handlePaymentClick('premium_mensual')}
            sx={{ 
              bgcolor: ACCENT, '&:hover': { bgcolor: '#e6561c' }, 
              fontWeight: 700, py: 1.8, borderRadius: 3, fontSize: 16, mb: 3,
              boxShadow: '0 8px 24px rgba(255, 96, 32, 0.3)'
            }}
          >
            {loadingPayment ? <CircularProgress size={26} color="inherit" /> : 'Pagar Suscripción'}
          </Button>

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
