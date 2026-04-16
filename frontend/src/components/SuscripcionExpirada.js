import React, { useState, useEffect } from 'react';
import { Box, Typography, Button, Paper, CircularProgress, Container } from '@mui/material';
import { WorkspacePremium, CheckCircle, Lock } from '@mui/icons-material';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import apiClient from '../api';

const ACCENT = '#FF6020';

export default function SuscripcionExpirada() {
  const [loadingPayment, setLoadingPayment] = useState(false);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const navigate = useNavigate();

  // 1. Inyectar el Script de Bold dinámicamente cuando el componente carga
  useEffect(() => {
    const initBoldCheckout = () => {
      if (document.querySelector('script[src="https://checkout.bold.co/library/boldPaymentButton.js"]')) {
        setScriptLoaded(true);
        return;
      }
      const js = document.createElement('script');
      js.src = 'https://checkout.bold.co/library/boldPaymentButton.js';
      js.async = true;
      js.onload = () => {
        setScriptLoaded(true);
        window.dispatchEvent(new Event('boldCheckoutLoaded'));
      };
      js.onerror = () => {
        toast.error('No se pudo cargar la pasarela de pagos. Revisa tu conexión.');
        window.dispatchEvent(new Event('boldCheckoutLoadFailed'));
      };
      document.head.appendChild(js);
    };

    initBoldCheckout();
  }, []);

  // 2. Función que orquesta el cobro
  const handlePaymentClick = async (planName) => {
    if (!scriptLoaded || !window.BoldCheckout) {
      toast.warning('La pasarela aún está cargando, intenta en un segundo.');
      return;
    }

    setLoadingPayment(true);
    try {
      // A. Pedimos el Hash criptográfico al Backend
      const { data } = await apiClient.post('/pagos/generar-hash', { plan_name: planName });

      // B. Configuramos la instancia de Bold con los datos blindados
      const checkout = new window.BoldCheckout({
        orderId: data.order_id,
        currency: data.currency,
        amount: data.amount,
        apiKey: data.api_key,
        integritySignature: data.hash_integridad,
        description: `Suscripción Ksmart360 - ${planName.replace('_', ' ').toUpperCase()}`,
        redirectionUrl: `${window.location.origin}/`, // A dónde vuelve si se sale
        renderMode: 'embedded' // ¡CLAVE PARA LA UX! Abre un modal, no redirige
      });

      // C. ¡Abrimos el modal de pagos de Bold!
      checkout.open();

    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al procesar la solicitud de pago.');
    } finally {
      setLoadingPayment(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userModules');
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
          border: '1px solid rgba(255,255,255,0.1)', color: '#f8fafc'
        }}>
          
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
            Esperamos que hayas disfrutado la experiencia Ksmart360. Para seguir gestionando tu negocio sin interrupciones, activa tu plan Premium.
          </Typography>

          {/* Tarjeta de Precio */}
          <Box sx={{ 
            p: 3, borderRadius: 3, bgcolor: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.05)', mb: 4 
          }}>
            <Typography sx={{ fontSize: 13, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, mb: 1 }}>
              Plan Premium Mensual
            </Typography>
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'baseline', mb: 2 }}>
              <Typography sx={{ fontSize: 24, fontWeight: 600, color: '#94a3b8', mr: 0.5 }}>$</Typography>
              <Typography sx={{ fontSize: 48, fontWeight: 800 }}>95.000</Typography>
              <Typography sx={{ fontSize: 16, color: '#94a3b8', ml: 1 }}>/ mes</Typography>
            </Box>
            
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, textAlign: 'left', maxWidth: 250, mx: 'auto' }}>
              {['Ventas e Inventario Ilimitado', 'Múltiples Usuarios', 'Soporte Prioritario'].map((feat, i) => (
                <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <CheckCircle sx={{ color: '#22c55e', fontSize: 18 }} />
                  <Typography sx={{ fontSize: 14, color: '#cbd5e1' }}>{feat}</Typography>
                </Box>
              ))}
            </Box>
          </Box>

          <Button
            fullWidth variant="contained" size="large"
            disabled={loadingPayment || !scriptLoaded}
            onClick={() => handlePaymentClick('premium_mensual')} // Enviamos el nombre exacto del plan
            sx={{ 
              bgcolor: ACCENT, '&:hover': { bgcolor: '#e6561c' }, 
              fontWeight: 700, py: 1.8, borderRadius: 3, fontSize: 16, mb: 3,
              boxShadow: '0 8px 24px rgba(255, 96, 32, 0.3)'
            }}
          >
            {loadingPayment ? <CircularProgress size={26} color="inherit" /> : 'Pagar Suscripción de forma segura'}
          </Button>

          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, color: '#64748b', mb: 3 }}>
            <Lock sx={{ fontSize: 14 }} />
            <Typography sx={{ fontSize: 12 }}>Pagos encriptados y procesados por Bold</Typography>
          </Box>

          <Button onClick={handleLogout} sx={{ color: '#94a3b8', fontSize: 13, textTransform: 'none' }}>
            Cerrar sesión y salir
          </Button>
        </Paper>
      </Container>
    </Box>
  );
}
