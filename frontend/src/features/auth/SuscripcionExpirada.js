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

// Familia de un plan = su código sin el sufijo de período. Robusto ante cualquier
// nomenclatura (basico_mensual, comercio_anual, premium30, etc.).
const familiaDe = (codigo = '') =>
  codigo.toLowerCase()
    .replace(/[_\- ]?(mensual|trimestral|semestral|anual|mes|meses|anio|anios|año|años|year|month|30|60|90|180|365)$/g, '')
    .trim() || codigo.toLowerCase();

// Agrupa planes por familia → { familia: { dias_duracion: plan } }
const groupPlanes = (planes) => {
  const g = {};
  planes.forEach(p => {
    const fam = familiaDe(p.codigo_interno || p.nombre || '');
    if (!g[fam]) g[fam] = {};
    g[fam][p.dias_duracion] = p;
  });
  return g;
};

// Convierte el campo caracteristicas (texto) en lista de bullets.
const parseFeatures = (plan) => {
  const raw = plan?.caracteristicas || '';
  return raw
    .split(/\r?\n|·|;|\|/)
    .map(s => s.replace(/^[-•✓✦*\s]+/, '').trim())
    .filter(Boolean);
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
            // Una tarjeta por familia; usa el plan del período elegido (o el mensual como respaldo).
            const tarjetas = Object.keys(groups)
              .map(fam => ({ fam, plan: groups[fam][periodo.dias] || groups[fam][30] || Object.values(groups[fam])[0] }))
              .filter(t => t.plan)
              .sort((a, b) => (a.plan.precio || 0) - (b.plan.precio || 0));

            if (tarjetas.length === 0) {
              return <Typography sx={{ my: 4, color: '#fca5a5' }}>No hay planes disponibles para este período.</Typography>;
            }

            const sm = tarjetas.length >= 3 ? 4 : 6;
            const renderCard = ({ plan }) => {
              const destacado = Boolean(plan.is_featured);
              const meses = Math.max(1, Math.round((plan.dias_duracion || 30) / 30));
              const precioMes = meses === 1 ? plan.precio : Math.round(plan.precio / meses);
              const esLargo = (plan.dias_duracion || 30) > 30;
              const features = parseFeatures(plan);
              return (
                <Box sx={{
                  p: 3, borderRadius: 3, height: '100%', display: 'flex', flexDirection: 'column',
                  bgcolor: destacado ? 'rgba(244,63,94,0.08)' : 'rgba(0,0,0,0.3)',
                  border: '1px solid', borderColor: destacado ? 'rgba(244,63,94,0.4)' : 'rgba(255,255,255,0.08)',
                }}>
                  {destacado && (
                    <Box sx={{ bgcolor: ACCENT, color: 'white', fontSize: 10, fontWeight: 900, py: 0.3, px: 1.5, borderRadius: 1, alignSelf: 'flex-start', mb: 1.5 }}>
                      ✦ MÁS ELEGIDO
                    </Box>
                  )}
                  <Typography sx={{ fontSize: 16, fontWeight: 900, color: destacado ? ACCENT : '#f8fafc', mb: 0.5 }}>
                    {plan.nombre}
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5, mb: 0.5 }}>
                    <Typography sx={{ fontSize: 30, fontWeight: 900, color: '#f8fafc' }}>{formatCurrency(precioMes)}</Typography>
                    <Typography sx={{ fontSize: 12, color: '#94a3b8' }}>/mes</Typography>
                  </Box>
                  {esLargo && (
                    <Typography sx={{ fontSize: 11, color: GREEN, fontWeight: 600, mb: 1.5 }}>
                      Total: {formatCurrency(plan.precio)}{periodo.descuento ? ` · Ahorras ${periodo.descuento}` : ''}
                    </Typography>
                  )}
                  <Box sx={{ flex: 1, mb: 2.5, mt: 1 }}>
                    <Box sx={{ display: 'flex', gap: 1, mb: 0.7, alignItems: 'flex-start' }}>
                      <Typography sx={{ color: plan.incluye_fe ? GREEN : '#475569', fontSize: 12, mt: 0.1 }}>{plan.incluye_fe ? '✓' : '✕'}</Typography>
                      <Typography sx={{ fontSize: 12.5, color: plan.incluye_fe ? '#cbd5e1' : '#475569' }}>Facturación electrónica DIAN</Typography>
                    </Box>
                    {features.map((f, i) => (
                      <Box key={i} sx={{ display: 'flex', gap: 1, mb: 0.7, alignItems: 'flex-start' }}>
                        <Typography sx={{ color: GREEN, fontSize: 12, mt: 0.1 }}>✓</Typography>
                        <Typography sx={{ fontSize: 12.5, color: '#cbd5e1' }}>{f}</Typography>
                      </Box>
                    ))}
                  </Box>
                  <WompiButton planName={plan.codigo_interno} onSuccess={async () => { if (onActive) await onActive(); navigate('/'); }} />
                </Box>
              );
            };
            return (
              <Grid container spacing={2.5} justifyContent="center" sx={{ mb: 3 }}>
                {tarjetas.map(t => (
                  <Grid item xs={12} sm={sm} key={t.fam}>{renderCard(t)}</Grid>
                ))}
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