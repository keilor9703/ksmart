import React, { useState, useEffect } from 'react';
import { Box, Typography, Paper, CircularProgress, Container, Grid, Button } from '@mui/material';
import { WorkspacePremium, Lock, Refresh } from '@mui/icons-material';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import apiClient from '../../api';
import WompiButton from '../../components/common/WompiButton';

const ACCENT = '#F43F5E';
const GREEN = '#10B981';

const formatCurrency = (val) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(val);

const PERIODOS = [
  { label: 'Mensual', dias: 30, descuento: null },
  { label: 'Trimestral', dias: 90, descuento: '-10%' },
  { label: 'Anual', dias: 365, descuento: '-20%' },
];

const FEATURES_STARTER = [
  'Todos los módulos habilitados según tu tipo de negocio',
  'Punto de venta clásico y touch',
  'Inventario, compras y proveedores',
  'Caja diaria, cotizaciones y órdenes de trabajo',
  'Reportes, dashboard y exportación Excel/PDF',
  'Contabilidad automática en partida doble',
  'Catálogo virtual con pedidos por WhatsApp',
  'Autenticación biométrica · Usuarios ilimitados',
];

const FEATURES_PRO_EXTRA = [
  'Facturación electrónica DIAN (UBL 2.1)',
  'CUFE y QR automático en cada factura',
  'Gestión de resoluciones con alertas',
  'Soporte prioritario',
];

const groupPlanes = (planes) => {
  const g = { starter: {}, pro: {} };
  planes.forEach(p => {
    const code = p.codigo_interno?.toLowerCase() || '';
    if (code.startsWith('starter')) g.starter[p.dias_duracion] = p;
    else if (code.startsWith('pro')) g.pro[p.dias_duracion] = p;
  });
  return g;
};

export default function SuscripcionExpirada({ onActive }) {
  const [planes, setPlanes] = useState([]);
  const [loadingPlanes, setLoadingPlanes] = useState(true);
  const [isVerifying, setIsVerifying] = useState(false);
  const [periodo, setPeriodo] = useState(PERIODOS[0]);

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

    // Polling de respaldo: por si el webhook llega antes que el botón confirme.
    // Intervalo corto para que la activación sea casi inmediata en cualquier escenario.
    const checkInterval = setInterval(async () => {
      try {
        const res = await apiClient.get('/users/me');
        const empresa = res.data.empresa;
        if (res.status === 200 && empresa?.is_active && !empresa?.is_plan_expired) {
          clearInterval(checkInterval);
          toast.success('¡Suscripción activa! Ingresando...');
          if (onActive) await onActive();
          navigate('/');
        }
      } catch (error) {
        // Ignorar 402/401 mientras el pago no se confirma
      }
    }, 5000);

    return () => clearInterval(checkInterval);
  }, [navigate, onActive]);

  const verificarPagoManual = async () => {
    setIsVerifying(true);
    try {
      const res = await apiClient.get('/users/me');
      const empresa = res.data.empresa;
      if (res.status === 200 && empresa?.is_active && !empresa?.is_plan_expired) {
        toast.success('¡Pago confirmado! Bienvenido.');
        if (onActive) await onActive();
        navigate('/');
      } else {
        toast.info('Aún no recibimos la confirmación. Si ya pagaste, espera unos segundos.');
      }
    } catch (error) {
      toast.info('Aún no se refleja el pago en el sistema.');
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
      background: 'linear-gradient(160deg, #0A0A0A 0%, #020617 100%)', p: 2 
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

          {/* Toggle periodo */}
          {!loadingPlanes && planes.length > 0 && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
              <Box sx={{ display: 'inline-flex', gap: 0.5, p: 0.5, bgcolor: 'rgba(255,255,255,0.06)', borderRadius: 2 }}>
                {PERIODOS.map(p => (
                  <Box key={p.dias} onClick={() => setPeriodo(p)} sx={{
                    px: 2, py: 0.8, borderRadius: 1.5, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 0.8,
                    bgcolor: periodo.dias === p.dias ? 'rgba(255,255,255,0.1)' : 'transparent',
                    transition: 'all 0.15s',
                  }}>
                    <Typography sx={{ fontSize: 13, fontWeight: periodo.dias === p.dias ? 700 : 400, color: periodo.dias === p.dias ? '#f8fafc' : '#94a3b8' }}>
                      {p.label}
                    </Typography>
                    {p.descuento && (
                      <Box sx={{ bgcolor: GREEN, color: 'white', px: 0.8, py: 0.1, borderRadius: 1, fontSize: 10, fontWeight: 800 }}>
                        {p.descuento}
                      </Box>
                    )}
                  </Box>
                ))}
              </Box>
            </Box>
          )}

          {loadingPlanes ? (
            <CircularProgress sx={{ color: ACCENT, my: 4 }} />
          ) : planes.length === 0 ? (
            <Typography sx={{ my: 4, color: '#fca5a5' }}>No hay planes de suscripción configurados.</Typography>
          ) : (() => {
            const groups = groupPlanes(planes);
            const starterPlan = groups.starter[periodo.dias] || groups.starter[30];
            const proPlan = groups.pro[periodo.dias] || groups.pro[30];
            const renderCard = (plan, isPro) => {
              if (!plan) return null;
              const precioMes = periodo.dias === 30 ? plan.precio : Math.round(plan.precio / (periodo.dias / 30));
              const features = isPro ? FEATURES_PRO_EXTRA : FEATURES_STARTER;
              return (
                <Box sx={{
                  p: 3, borderRadius: 3, height: '100%', display: 'flex', flexDirection: 'column',
                  bgcolor: isPro ? 'rgba(244,63,94,0.08)' : 'rgba(0,0,0,0.3)',
                  border: '1px solid', borderColor: isPro ? 'rgba(244,63,94,0.4)' : 'rgba(255,255,255,0.08)',
                }}>
                  {isPro && (
                    <Box sx={{ bgcolor: ACCENT, color: 'white', fontSize: 10, fontWeight: 900, py: 0.3, px: 1.5, borderRadius: 1, alignSelf: 'flex-start', mb: 1.5 }}>
                      ✦ MÁS ELEGIDO
                    </Box>
                  )}
                  <Typography sx={{ fontSize: 16, fontWeight: 900, color: isPro ? ACCENT : '#f8fafc', mb: 0.5 }}>
                    {plan.nombre}
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5, mb: 0.5 }}>
                    <Typography sx={{ fontSize: 30, fontWeight: 900, color: '#f8fafc' }}>{formatCurrency(precioMes)}</Typography>
                    <Typography sx={{ fontSize: 12, color: '#94a3b8' }}>/mes</Typography>
                  </Box>
                  {periodo.dias > 30 && (
                    <Typography sx={{ fontSize: 11, color: GREEN, fontWeight: 600, mb: 1.5 }}>
                      Total: {formatCurrency(plan.precio)} · Ahorras {periodo.descuento}
                    </Typography>
                  )}
                  <Box sx={{ flex: 1, mb: 2.5, mt: 1 }}>
                    {isPro && <Typography sx={{ fontSize: 11, color: '#94a3b8', mb: 1, fontWeight: 700, textTransform: 'uppercase' }}>Todo del Básico, más:</Typography>}
                    {features.map((f, i) => (
                      <Box key={i} sx={{ display: 'flex', gap: 1, mb: 0.7, alignItems: 'flex-start' }}>
                        <Typography sx={{ color: GREEN, fontSize: 12, mt: 0.1 }}>✓</Typography>
                        <Typography sx={{ fontSize: 12.5, color: '#cbd5e1' }}>{f}</Typography>
                      </Box>
                    ))}
                    {!isPro && (
                      <Box sx={{ display: 'flex', gap: 1, mb: 0.7, alignItems: 'flex-start' }}>
                        <Typography sx={{ color: '#475569', fontSize: 12, mt: 0.1 }}>✕</Typography>
                        <Typography sx={{ fontSize: 12.5, color: '#475569' }}>Facturación electrónica DIAN</Typography>
                      </Box>
                    )}
                  </Box>
                  <WompiButton planName={plan.codigo_interno} onSuccess={async () => { if (onActive) await onActive(); navigate('/'); }} />
                </Box>
              );
            };
            return (
              <Grid container spacing={2.5} justifyContent="center" sx={{ mb: 3 }}>
                <Grid item xs={12} sm={6}>{renderCard(starterPlan, false)}</Grid>
                <Grid item xs={12} sm={6}>{renderCard(proPlan, true)}</Grid>
              </Grid>
            );
          })()}

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