import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Button, Dialog, DialogContent,
  IconButton, CircularProgress, useTheme, ToggleButton, ToggleButtonGroup, Chip
} from '@mui/material';
import { Close, WorkspacePremium, Check, Bolt } from '@mui/icons-material';
import apiClient from '../../../api';
import { formatCurrency } from '../../../utils/formatters';
import WompiButton from '../../../components/common/WompiButton';

const GREEN = '#10B981';
const ACCENT = '#F43F5E';

// Agrupa los planes por código base (starter/pro) y periodo (30/90/365)
const groupPlanes = (planes) => {
  const groups = { starter: {}, pro: {} };
  planes.forEach(p => {
    const code = p.codigo_interno?.toLowerCase() || '';
    const dias = p.dias_duracion;
    if (code.includes('starter') || code.includes('basico') || code.includes('básico')) {
      groups.starter[dias] = p;
    } else if (code.includes('pro')) {
      groups.pro[dias] = p;
    }
  });
  return groups;
};

const PERIODOS = [
  { label: 'Mensual', dias: 30, descuento: null },
  { label: 'Trimestral', dias: 90, descuento: '-10%' },
  { label: 'Anual', dias: 365, descuento: '-20%' },
];

const FeatureItem = ({ text, included = true }) => (
  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 0.8 }}>
    <Box sx={{
      width: 18, height: 18, borderRadius: '50%', flexShrink: 0, mt: 0.1,
      bgcolor: included ? `${GREEN}20` : 'rgba(0,0,0,0.05)',
      color: included ? GREEN : '#9CA3AF',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <Typography sx={{ fontSize: 10, fontWeight: 900 }}>{included ? '✓' : '✕'}</Typography>
    </Box>
    <Typography sx={{ fontSize: 12.5, color: included ? 'text.primary' : 'text.disabled', lineHeight: 1.4 }}>
      {text}
    </Typography>
  </Box>
);

const FEATURES_STARTER = [
  'Todos los módulos habilitados según tu tipo de negocio',
  'Punto de venta clásico y touch',
  'Inventario, compras y proveedores',
  'Clientes, cartera y cuentas por cobrar',
  'Caja diaria con arqueo',
  'Cotizaciones y órdenes de trabajo',
  'Producción y recetas',
  'Reportes y dashboard en tiempo real',
  'Exportación a Excel y PDF',
  'Contabilidad automática en partida doble',
  'Programa de puntos y fidelización',
  'Catálogo virtual con pedidos por WhatsApp',
  'Autenticación biométrica (huella/rostro)',
  'Usuarios ilimitados',
  'Acceso desde celular, tablet y computador',
];

const FEATURES_PRO_EXTRA = [
  'Facturación electrónica DIAN (UBL 2.1)',
  'CUFE y QR automático en cada factura',
  'Gestión de resoluciones DIAN',
  'Alertas de resolución próxima a vencer',
  'Soporte prioritario',
];

const PlanCard = ({ plan, periodo, featured, theme }) => {
  const diasLabel = periodo.dias === 30 ? '/mes' : periodo.dias === 90 ? '/mes (trimestral)' : '/mes (anual)';
  const precioMes = periodo.dias === 30 ? plan.precio : Math.round(plan.precio / (periodo.dias / 30));
  const isPro = featured;

  return (
    <Box sx={{
      flex: 1,
      border: '2px solid',
      borderColor: isPro ? ACCENT : 'divider',
      borderRadius: 3,
      p: 3,
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
      bgcolor: isPro
        ? theme.palette.mode === 'dark' ? 'rgba(244,63,94,0.07)' : '#FFF5F6'
        : 'background.paper',
      boxShadow: isPro ? '0 8px 30px rgba(244,63,94,0.12)' : '0 2px 8px rgba(0,0,0,0.06)',
    }}>
      {isPro && (
        <Box sx={{
          position: 'absolute', top: -1, left: '50%', transform: 'translateX(-50%)',
          bgcolor: ACCENT, color: 'white', px: 2, py: 0.4,
          borderRadius: '0 0 8px 8px', fontSize: 10, fontWeight: 900, letterSpacing: 0.5,
        }}>
          ✦ MÁS ELEGIDO
        </Box>
      )}

      {/* Header */}
      <Box sx={{ mb: 2, mt: isPro ? 1.5 : 0 }}>
        <Typography sx={{ fontWeight: 900, fontSize: 20, mb: 0.5, color: isPro ? ACCENT : 'text.primary' }}>
          {plan.nombre}
        </Typography>
        <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 1.5 }}>
          {isPro ? 'Para negocios que facturan electrónicamente.' : 'Todo el sistema. Sin restricciones de módulos.'}
        </Typography>

        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
          <Typography sx={{ fontSize: 32, fontWeight: 900, color: isPro ? ACCENT : 'text.primary', lineHeight: 1 }}>
            {formatCurrency(precioMes)}
          </Typography>
          <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{diasLabel}</Typography>
        </Box>
        {periodo.dias > 30 && (
          <Typography sx={{ fontSize: 11, color: GREEN, fontWeight: 600, mt: 0.5 }}>
            Total: {formatCurrency(plan.precio)} · Ahorras {periodo.descuento}
          </Typography>
        )}
      </Box>

      {/* Features */}
      <Box sx={{ flex: 1, mb: 2.5 }}>
        {isPro && (
          <Typography sx={{ fontSize: 11, fontWeight: 700, color: 'text.secondary', mb: 1, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Todo del plan Básico, más:
          </Typography>
        )}
        {(isPro ? FEATURES_PRO_EXTRA : FEATURES_STARTER).map((f, i) => (
          <FeatureItem key={i} text={f} />
        ))}
        {!isPro && (
          <FeatureItem text="Facturación electrónica DIAN" included={false} />
        )}
      </Box>

      <WompiButton
        planName={plan.codigo_interno}
        onSuccess={() => window.location.reload()}
        sx={isPro ? { bgcolor: ACCENT, '&:hover': { bgcolor: '#E11D48' } } : {}}
      />
    </Box>
  );
};

const SaaSUpgradeManager = ({ user }) => {
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [planes, setPlanes] = useState([]);
  const [loadingPlanes, setLoadingPlanes] = useState(false);
  const [periodo, setPeriodo] = useState(PERIODOS[0]);
  const theme = useTheme();

  const calculateDaysLeft = (dateString) => {
    if (!dateString) return 0;
    const endsAt = new Date(dateString.endsWith('Z') ? dateString : dateString + 'Z');
    return Math.ceil((endsAt - new Date()) / (1000 * 60 * 60 * 24));
  };

  const diasRestantes = calculateDaysLeft(user?.empresa?.trial_ends_at);
  const isTrial = user?.empresa?.plan_type === 'trial' && user?.empresa_id !== 1;

  const handleOpenUpgrade = async () => {
    setUpgradeOpen(true);
    if (planes.length === 0) {
      setLoadingPlanes(true);
      try {
        const { data } = await apiClient.get('/planes-activos');
        setPlanes(data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingPlanes(false);
      }
    }
  };

  if (!isTrial || diasRestantes <= 0) return null;

  const groups = groupPlanes(planes);
  const starterPlan = groups.starter[periodo.dias] || groups.starter[30];
  const proPlan = groups.pro[periodo.dias] || groups.pro[30];
  const hasPlans = starterPlan && proPlan;

  return (
    <>
      {/* TRIAL BANNER */}
      <Box sx={{
        mb: 3, p: 1.5, borderRadius: 2,
        bgcolor: theme.palette.mode === 'dark' ? 'rgba(37,99,235,0.15)' : '#EFF6FF',
        border: '1px solid',
        borderColor: theme.palette.mode === 'dark' ? 'rgba(37,99,235,0.3)' : '#BFDBFE',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2,
      }}>
        <Typography sx={{ fontSize: 12, color: theme.palette.mode === 'dark' ? '#93C5FD' : '#1E3A8A', fontWeight: 600 }}>
          ⏱ Estás en tu periodo de prueba. Te quedan {diasRestantes} días gratis.
        </Typography>
        <Button size="small" variant="contained" onClick={handleOpenUpgrade}
          sx={{ bgcolor: '#2563EB', fontSize: 11, fontWeight: 700, boxShadow: 'none' }}>
          Activar mi cuenta
        </Button>
      </Box>

      {/* MODAL */}
      <Dialog open={upgradeOpen} onClose={() => setUpgradeOpen(false)} maxWidth="md" fullWidth
        PaperProps={{ sx: { borderRadius: 3, bgcolor: 'background.default' } }}>

        {/* Header */}
        <Box sx={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          px: 3, py: 2, borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'background.paper',
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{
              width: 36, height: 36, borderRadius: 2,
              bgcolor: 'rgba(244,63,94,0.1)', color: ACCENT,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <WorkspacePremium fontSize="small" />
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 900, fontSize: 17, lineHeight: 1.2 }}>Elige tu Plan</Typography>
              <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>14 días de prueba incluidos al registrarse</Typography>
            </Box>
          </Box>
          <IconButton onClick={() => setUpgradeOpen(false)} size="small"><Close /></IconButton>
        </Box>

        <DialogContent sx={{ p: { xs: 2, md: 3 } }}>
          {loadingPlanes ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
              <CircularProgress sx={{ color: ACCENT }} />
            </Box>
          ) : (
            <>
              {/* Toggle de periodo */}
              <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
                <Box sx={{
                  display: 'inline-flex', gap: 0.5, p: 0.5,
                  bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.06)' : '#F3F4F6',
                  borderRadius: 2,
                }}>
                  {PERIODOS.map(p => (
                    <Box
                      key={p.dias}
                      onClick={() => setPeriodo(p)}
                      sx={{
                        px: 2, py: 0.8, borderRadius: 1.5, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: 0.8,
                        bgcolor: periodo.dias === p.dias
                          ? theme.palette.mode === 'dark' ? '#1E293B' : 'white'
                          : 'transparent',
                        boxShadow: periodo.dias === p.dias ? '0 1px 4px rgba(0,0,0,0.12)' : 'none',
                        transition: 'all 0.15s',
                      }}
                    >
                      <Typography sx={{ fontSize: 13, fontWeight: periodo.dias === p.dias ? 700 : 500, color: periodo.dias === p.dias ? 'text.primary' : 'text.secondary' }}>
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

              {/* Cards de planes */}
              {hasPlans ? (
                <Box sx={{ display: 'flex', gap: 2.5, flexDirection: { xs: 'column', sm: 'row' } }}>
                  <PlanCard plan={starterPlan} periodo={periodo} featured={false} theme={theme} />
                  <PlanCard plan={proPlan} periodo={periodo} featured={true} theme={theme} />
                </Box>
              ) : (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <Typography color="text.secondary" sx={{ fontSize: 13 }}>
                    No hay planes disponibles para este periodo todavía.
                  </Typography>
                  <Typography color="text.secondary" sx={{ fontSize: 12, mt: 1 }}>
                    Selecciona el plan Mensual para continuar.
                  </Typography>
                </Box>
              )}

              {/* Nota DIAN */}
              <Box sx={{
                mt: 2.5, p: 1.5, borderRadius: 2, textAlign: 'center',
                bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.04)' : '#F9FAFB',
              }}>
                <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
                  <strong>¿Por qué Pro?</strong> Solo si tu negocio está obligado a emitir factura electrónica ante la DIAN.
                  Si no, el plan Básico tiene todo lo que necesitas.
                </Typography>
              </Box>

              {/* Wompi footer */}
              <Typography sx={{ fontSize: 11, color: 'text.disabled', textAlign: 'center', mt: 2 }}>
                Pagos procesados por <strong>Wompi (Bancolombia)</strong> — Tarjeta, Nequi, PSE y QR
              </Typography>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default SaaSUpgradeManager;
