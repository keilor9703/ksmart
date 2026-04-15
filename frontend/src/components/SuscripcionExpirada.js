import React from 'react';
// Déjalo así:
import { Box, Typography, Button, Paper, Container, Grid } from '@mui/material';
import { 
  LockOutlined, Shield, TrendingUp, WhatsApp, ExitToApp, CloudDone 
} from '@mui/icons-material';

const SuscripcionExpirada = () => {
  // 🟢 IMPORTANTE: Cambia este número por tu WhatsApp real de ventas
  const WHATSAPP_NUMBER = "573001234567"; 
  const WHATSAPP_MSG = encodeURIComponent("Hola! Mi periodo de prueba en Ksmart360 ha terminado y me gustaría adquirir un plan Premium para mi empresa.");

  const handleContactSales = () => {
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${WHATSAPP_MSG}`, '_blank');
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    window.location.href = '/login'; // Ajusta esto a tu ruta real de login
  };

  return (
    <Box sx={{ 
      minHeight: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      bgcolor: 'background.default',
      p: 2
    }}>
      <Container maxWidth="md">
        <Paper sx={{ 
          p: { xs: 3, md: 6 }, 
          borderRadius: 4, 
          boxShadow: '0 10px 40px rgba(0,0,0,0.1)',
          textAlign: 'center',
          position: 'relative',
          overflow: 'hidden'
        }}>
          {/* Barra decorativa superior */}
          <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, height: 6, background: 'linear-gradient(90deg, #3B82F6, #8B5CF6)' }} />

          <Box sx={{ 
            width: 80, height: 80, borderRadius: '50%', 
            bgcolor: '#EFF6FF', color: '#3B82F6', 
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            mx: 'auto', mb: 3,
            border: '8px solid #DBEAFE'
          }}>
            <LockOutlined sx={{ fontSize: 36 }} />
          </Box>

          <Typography variant="h4" sx={{ fontWeight: 800, mb: 2, color: 'text.primary' }}>
            Tu periodo de prueba ha terminado
          </Typography>
          
          <Typography sx={{ fontSize: 16, color: 'text.secondary', mb: 4, maxWidth: 500, mx: 'auto' }}>
            Esperamos que hayas disfrutado explorar todas las herramientas de nuestra plataforma. Para seguir operando y llevar tu negocio al siguiente nivel, actualiza tu plan.
          </Typography>

          <Grid container spacing={3} sx={{ mb: 5, textAlign: 'left' }}>
            <Grid item xs={12} md={4}>
              <Box sx={{ p: 2, bgcolor: 'action.hover', borderRadius: 3, height: '100%' }}>
                <CloudDone sx={{ color: '#10B981', mb: 1 }} />
                <Typography sx={{ fontWeight: 700, fontSize: 14, mb: 0.5 }}>Datos a salvo</Typography>
                <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>Tus inventarios, clientes y ventas están seguros y respaldados en la nube.</Typography>
              </Box>
            </Grid>
            <Grid item xs={12} md={4}>
              <Box sx={{ p: 2, bgcolor: 'action.hover', borderRadius: 3, height: '100%' }}>
                <Shield sx={{ color: '#3B82F6', mb: 1 }} />
                <Typography sx={{ fontWeight: 700, fontSize: 14, mb: 0.5 }}>Sin interrupciones</Typography>
                <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>Al activar tu plan, retomarás tu operación exactamente donde la dejaste.</Typography>
              </Box>
            </Grid>
            <Grid item xs={12} md={4}>
              <Box sx={{ p: 2, bgcolor: 'action.hover', borderRadius: 3, height: '100%' }}>
                <TrendingUp sx={{ color: '#8B5CF6', mb: 1 }} />
                <Typography sx={{ fontWeight: 700, fontSize: 14, mb: 0.5 }}>Actualizaciones</Typography>
                <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>Obtén soporte prioritario y acceso a todas las nuevas funciones.</Typography>
              </Box>
            </Grid>
          </Grid>

          <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2, justifyContent: 'center' }}>
            <Button 
              variant="contained" 
              size="large"
              startIcon={<WhatsApp />}
              onClick={handleContactSales}
              sx={{ 
                bgcolor: '#25D366', 
                color: '#fff',
                fontWeight: 700, 
                px: 4, py: 1.5, borderRadius: 2,
                '&:hover': { bgcolor: '#1DA851' },
                boxShadow: '0 4px 14px rgba(37, 211, 102, 0.3)'
              }}
            >
              Contactar a Ventas
            </Button>
            <Button 
              variant="outlined" 
              size="large"
              startIcon={<ExitToApp />}
              onClick={handleLogout}
              sx={{ 
                fontWeight: 600, px: 4, py: 1.5, borderRadius: 2,
                color: 'text.secondary', borderColor: 'divider'
              }}
            >
              Cerrar Sesión
            </Button>
          </Box>

        </Paper>
      </Container>
    </Box>
  );
};

export default SuscripcionExpirada;