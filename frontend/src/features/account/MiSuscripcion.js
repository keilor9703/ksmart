import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Card, Chip, Button, Avatar, Divider,
  CircularProgress, Stack, useTheme, alpha, LinearProgress,
  Table, TableBody, TableRow, TableCell, TableHead, TableContainer,
  Paper, Collapse, IconButton, Tooltip, Dialog, DialogTitle,
  DialogContent, DialogActions,
} from '@mui/material';
import {
  WorkspacePremium, CheckCircle, Warning, Cancel, Refresh,
  Receipt, CreditCard, AccountBalanceWallet, AttachMoney,
  ExpandMore, ExpandLess, ContentCopy, CalendarMonth,
  Payments, HourglassBottom, Bolt, Shield, KeyboardArrowRight,
  Close,
} from '@mui/icons-material';
import { toast } from 'react-toastify';
import apiClient from '../../api';
import WompiButton from '../../components/common/WompiButton';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (val) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(val ?? 0);

const fmtDate = (iso) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
};

const fmtDateFull = (iso) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-CO', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const copyToClipboard = (text) =>
  navigator.clipboard?.writeText(text).then(() => toast.success('Copiado'));

const METODO_ICONS = {
  CARD:           <CreditCard sx={{ fontSize: 15 }} />,
  NEQUI:          <AccountBalanceWallet sx={{ fontSize: 15 }} />,
  PSE:            <AccountBalanceWallet sx={{ fontSize: 15 }} />,
  BANCOLOMBIA_QR: <AccountBalanceWallet sx={{ fontSize: 15 }} />,
  EFECTIVO:       <AttachMoney sx={{ fontSize: 15 }} />,
};

const METODO_LABELS = {
  CARD:           'Tarjeta',
  NEQUI:          'Nequi',
  PSE:            'PSE',
  BANCOLOMBIA_QR: 'QR Bancolombia',
  EFECTIVO:       'Efectivo',
};

// ─── StatusConfig ─────────────────────────────────────────────────────────────

function getStatusConfig(suscripcion) {
  if (!suscripcion) return { color: '#6b7280', label: 'Desconocido', icon: <Warning />, severity: 'neutral' };

  const { plan_type, is_active, is_plan_expired, dias_restantes, is_protected } = suscripcion;

  if (is_protected || plan_type === 'vitalicio') {
    return { color: '#7C3AED', label: 'Vitalicio', icon: <Shield />, severity: 'vitalicio', showRenew: false };
  }
  if (!is_active || is_plan_expired) {
    return { color: '#EF4444', label: 'Vencido', icon: <Cancel />, severity: 'expired', showRenew: true };
  }
  if (dias_restantes !== null && dias_restantes <= 7) {
    return { color: '#F59E0B', label: 'Por vencer', icon: <HourglassBottom />, severity: 'warning', showRenew: true };
  }
  if (plan_type === 'premium') {
    return { color: '#059669', label: 'Activo', icon: <CheckCircle />, severity: 'active', showRenew: false };
  }
  if (plan_type === 'trial') {
    return { color: '#2563EB', label: 'Prueba', icon: <Bolt />, severity: 'trial', showRenew: dias_restantes <= 15 };
  }
  return { color: '#6b7280', label: plan_type, icon: <Warning />, severity: 'neutral', showRenew: false };
}

// ─── HeroCard ─────────────────────────────────────────────────────────────────

const HeroCard = ({ suscripcion, planActual, onRefresh, refreshing }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const status = getStatusConfig(suscripcion);
  const diasRestantes = suscripcion?.dias_restantes ?? 0;

  // Progress bar: fill % based on plan duration vs days remaining
  const planDias = planActual?.dias_duracion || 30;
  const progressPct = suscripcion?.is_plan_expired
    ? 0
    : Math.min(100, Math.round((diasRestantes / planDias) * 100));

  const progressColor = status.severity === 'expired' ? '#EF4444'
    : status.severity === 'warning' ? '#F59E0B'
    : status.severity === 'vitalicio' ? '#7C3AED'
    : '#059669';

  return (
    <Card elevation={0} sx={{
      borderRadius: 4,
      border: `1px solid ${alpha(status.color, 0.3)}`,
      background: isDark
        ? `linear-gradient(135deg, ${alpha(status.color, 0.08)} 0%, ${alpha('#0d1117', 0.9)} 100%)`
        : `linear-gradient(135deg, ${alpha(status.color, 0.05)} 0%, #fff 100%)`,
      overflow: 'hidden',
      position: 'relative',
      mb: 3,
    }}>
      {/* Top accent line */}
      <Box sx={{ height: 4, bgcolor: status.color, width: '100%' }} />

      <Box sx={{ p: { xs: 2.5, md: 3.5 } }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2.5} alignItems={{ sm: 'center' }}>

          {/* Icon + status */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1 }}>
            <Avatar sx={{
              width: 58, height: 58, flexShrink: 0,
              bgcolor: alpha(status.color, isDark ? 0.18 : 0.1),
              border: `2px solid ${alpha(status.color, 0.3)}`,
            }}>
              <WorkspacePremium sx={{ color: status.color, fontSize: 28 }} />
            </Avatar>

            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.4 }}>
                <Typography fontWeight={800} fontSize={18}>
                  {planActual ? planActual.nombre : 'Mi Suscripción'}
                </Typography>
                <Chip
                  icon={React.cloneElement(status.icon, { sx: { fontSize: '14px !important', color: `${status.color} !important` } })}
                  label={status.label}
                  size="small"
                  sx={{
                    bgcolor: alpha(status.color, isDark ? 0.18 : 0.1),
                    color: status.color,
                    fontWeight: 800,
                    fontSize: 11,
                    border: `1px solid ${alpha(status.color, 0.3)}`,
                    '& .MuiChip-icon': { color: status.color },
                  }}
                />
              </Box>

              {suscripcion?.trial_ends_at && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <CalendarMonth sx={{ fontSize: 13, color: 'text.secondary' }} />
                  <Typography fontSize={13} color="text.secondary">
                    {suscripcion.is_plan_expired
                      ? `Venció el ${fmtDate(suscripcion.trial_ends_at)}`
                      : `Vigente hasta el ${fmtDate(suscripcion.trial_ends_at)}`}
                  </Typography>
                </Box>
              )}
            </Box>
          </Box>

          {/* Days counter */}
          {suscripcion?.plan_type !== 'vitalicio' && !suscripcion?.is_protected && (
            <Box sx={{
              textAlign: { xs: 'left', sm: 'center' },
              p: 2, borderRadius: 3,
              bgcolor: alpha(status.color, isDark ? 0.1 : 0.06),
              border: `1px solid ${alpha(status.color, 0.2)}`,
              minWidth: 110,
            }}>
              <Typography fontWeight={900} fontSize={32} color={status.color} lineHeight={1}>
                {suscripcion?.is_plan_expired ? '0' : (diasRestantes ?? '—')}
              </Typography>
              <Typography fontSize={11} color="text.secondary" fontWeight={600}>
                {diasRestantes === 1 ? 'día restante' : 'días restantes'}
              </Typography>
            </Box>
          )}

          <Tooltip title="Actualizar estado">
            <IconButton size="small" onClick={onRefresh} disabled={refreshing}
              sx={{ alignSelf: 'flex-start', color: 'text.secondary' }}>
              {refreshing ? <CircularProgress size={16} /> : <Refresh sx={{ fontSize: 18 }} />}
            </IconButton>
          </Tooltip>
        </Stack>

        {/* Progress bar */}
        {suscripcion?.plan_type !== 'vitalicio' && !suscripcion?.is_protected && (
          <Box sx={{ mt: 2.5 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.8 }}>
              <Typography fontSize={11} color="text.secondary" fontWeight={600}>
                Tiempo restante del período
              </Typography>
              <Typography fontSize={11} fontWeight={700} color={progressColor}>
                {progressPct}%
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={progressPct}
              sx={{
                height: 8, borderRadius: 4,
                bgcolor: alpha(progressColor, 0.12),
                '& .MuiLinearProgress-bar': { bgcolor: progressColor, borderRadius: 4 },
              }}
            />
            {planActual && (
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.8 }}>
                <Typography fontSize={10} color="text.disabled">Inicio período</Typography>
                <Typography fontSize={10} color="text.disabled">{fmtDate(suscripcion.trial_ends_at)}</Typography>
              </Box>
            )}
          </Box>
        )}
      </Box>
    </Card>
  );
};

// ─── PlanCard (para renovación) ───────────────────────────────────────────────

const PlanCard = ({ plan, onSuccess, current }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const ACCENT = '#FF6020';
  const features = plan.caracteristicas?.split(',').map(f => f.trim()).filter(Boolean) || [];

  return (
    <Card elevation={0} sx={{
      borderRadius: 3,
      border: `1.5px solid ${current ? alpha(ACCENT, 0.5) : alpha(theme.palette.divider, 1)}`,
      bgcolor: current ? alpha(ACCENT, isDark ? 0.07 : 0.03) : 'background.paper',
      p: 2.5, height: '100%', display: 'flex', flexDirection: 'column',
      position: 'relative', transition: 'all 0.2s',
      '&:hover': { borderColor: alpha(ACCENT, 0.5), boxShadow: `0 4px 20px ${alpha(ACCENT, 0.1)}` },
    }}>
      {current && (
        <Chip label="Plan actual" size="small" sx={{
          position: 'absolute', top: -10, right: 12,
          bgcolor: ACCENT, color: '#fff', fontWeight: 700, fontSize: 10,
        }} />
      )}

      <Typography fontSize={12} fontWeight={800} color={ACCENT} textTransform="uppercase" mb={1} letterSpacing={0.8}>
        {plan.nombre}
      </Typography>

      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5, mb: 1.5 }}>
        <Typography fontWeight={900} fontSize={28}>{fmt(plan.precio)}</Typography>
        <Typography fontSize={13} color="text.secondary">/ {plan.dias_duracion} días</Typography>
      </Box>

      <Box sx={{ flex: 1, mb: 2.5 }}>
        {features.map((feat, i) => (
          <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 0.8, mb: 0.6 }}>
            <CheckCircle sx={{ fontSize: 13, color: '#059669', flexShrink: 0 }} />
            <Typography fontSize={12.5} color="text.secondary">{feat}</Typography>
          </Box>
        ))}
      </Box>

      <WompiButton planName={plan.codigo_interno} onSuccess={onSuccess} />
    </Card>
  );
};

// ─── PaymentDetailDialog ──────────────────────────────────────────────────────

const PaymentDetailDialog = ({ open, onClose, pago }) => {
  const theme = useTheme();
  if (!pago) return null;
  const metodoLabel = METODO_LABELS[pago.metodo_pago] || pago.metodo_pago || '—';
  const metodoIcon = METODO_ICONS[pago.metodo_pago] || <Payments sx={{ fontSize: 15 }} />;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 4 } }}>
      <Box sx={{ height: 4, bgcolor: '#059669' }} />
      <DialogTitle sx={{ pb: 1, pt: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Avatar sx={{ bgcolor: alpha('#059669', 0.1), width: 38, height: 38 }}>
              <Receipt sx={{ color: '#059669', fontSize: 20 }} />
            </Avatar>
            <Box>
              <Typography fontWeight={800} fontSize={15}>Detalle del pago</Typography>
              <Typography fontSize={12} color="text.secondary">#{pago.id} · {fmtDate(pago.fecha_pago)}</Typography>
            </Box>
          </Box>
          <IconButton size="small" onClick={onClose}><Close fontSize="small" /></IconButton>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ pt: 1.5 }}>
        <Stack spacing={0}>
          {[
            ['Plan adquirido',   pago.plan?.nombre || '—'],
            ['Duración',         pago.plan ? `${pago.plan.dias_duracion} días` : '—'],
            ['Monto pagado',     fmt(pago.monto)],
            ['Moneda',           pago.moneda || 'COP'],
            ['Método de pago',   metodoLabel],
            ['Email pagador',    pago.email_pagador || '—'],
            ['Fecha y hora',     fmtDateFull(pago.fecha_pago)],
          ].map(([label, value]) => (
            <Box key={label} sx={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
              py: 1.2, borderBottom: `1px solid ${theme.palette.divider}`,
            }}>
              <Typography fontSize={12.5} color="text.secondary">{label}</Typography>
              <Typography fontSize={12.5} fontWeight={600} textAlign="right" sx={{ maxWidth: '55%' }}>{value}</Typography>
            </Box>
          ))}
          {pago.wompi_tx_id && (
            <Box sx={{ py: 1.2 }}>
              <Typography fontSize={12.5} color="text.secondary" mb={0.5}>ID de transacción</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1,
                bgcolor: alpha(theme.palette.text.primary, 0.04), borderRadius: 1.5, p: 1 }}>
                <Typography fontSize={11} fontFamily="monospace" sx={{ flex: 1, wordBreak: 'break-all', color: 'text.secondary' }}>
                  {pago.wompi_tx_id}
                </Typography>
                <Tooltip title="Copiar">
                  <IconButton size="small" onClick={() => copyToClipboard(pago.wompi_tx_id)}>
                    <ContentCopy sx={{ fontSize: 14 }} />
                  </IconButton>
                </Tooltip>
              </Box>
            </Box>
          )}
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose} sx={{ borderRadius: 2 }}>Cerrar</Button>
      </DialogActions>
    </Dialog>
  );
};

// ─── HistorialTable ───────────────────────────────────────────────────────────

const HistorialTable = ({ historial }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const [detailPago, setDetailPago] = useState(null);
  const [showAll, setShowAll] = useState(false);

  const items = showAll ? historial : historial.slice(0, 5);

  if (!historial.length) {
    return (
      <Box sx={{ textAlign: 'center', py: 6, color: 'text.secondary' }}>
        <Receipt sx={{ fontSize: 48, opacity: 0.15, mb: 1.5 }} />
        <Typography fontWeight={700} fontSize={15}>Sin pagos registrados</Typography>
        <Typography fontSize={13} sx={{ mt: 0.5, maxWidth: 280, mx: 'auto' }}>
          Aquí aparecerán todos tus pagos de suscripción una vez que realices tu primera compra.
        </Typography>
      </Box>
    );
  }

  return (
    <>
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: isDark ? alpha('#fff', 0.03) : alpha('#000', 0.025) }}>
              {['Fecha', 'Plan', 'Monto', 'Método', 'ID Transacción', ''].map(h => (
                <TableCell key={h} sx={{ fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, py: 1.2 }}>
                  {h}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {items.map((pago) => {
              const metodoLabel = METODO_LABELS[pago.metodo_pago] || pago.metodo_pago || '—';
              const metodoIcon = METODO_ICONS[pago.metodo_pago] || <Payments sx={{ fontSize: 15 }} />;
              return (
                <TableRow key={pago.id} hover sx={{ cursor: 'pointer', '& td': { py: 1.3 } }}
                  onClick={() => setDetailPago(pago)}>
                  <TableCell>
                    <Typography fontSize={12.5} fontWeight={600}>{fmtDate(pago.fecha_pago)}</Typography>
                    <Typography fontSize={10.5} color="text.disabled">
                      {pago.fecha_pago ? new Date(pago.fecha_pago).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }) : ''}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography fontSize={12.5}>{pago.plan?.nombre || '—'}</Typography>
                    {pago.plan?.dias_duracion && (
                      <Typography fontSize={10.5} color="text.disabled">{pago.plan.dias_duracion} días</Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Typography fontSize={13} fontWeight={800} color="#FF6020">{fmt(pago.monto)}</Typography>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6, color: 'text.secondary' }}>
                      {metodoIcon}
                      <Typography fontSize={12}>{metodoLabel}</Typography>
                    </Box>
                  </TableCell>
                  <TableCell sx={{ maxWidth: 140 }}>
                    {pago.wompi_tx_id ? (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
                        onClick={e => { e.stopPropagation(); copyToClipboard(pago.wompi_tx_id); }}>
                        <Typography fontSize={11} fontFamily="monospace" color="text.disabled"
                          sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 110 }}>
                          {pago.wompi_tx_id}
                        </Typography>
                        <ContentCopy sx={{ fontSize: 12, color: 'text.disabled', flexShrink: 0 }} />
                      </Box>
                    ) : <Typography fontSize={11} color="text.disabled">—</Typography>}
                  </TableCell>
                  <TableCell align="right">
                    <Chip icon={<CheckCircle sx={{ fontSize: '12px !important', color: '#059669 !important' }} />}
                      label="Pagado" size="small" sx={{
                        bgcolor: alpha('#059669', 0.1), color: '#059669',
                        fontWeight: 700, fontSize: 10, height: 20,
                        '& .MuiChip-icon': { ml: '4px' },
                      }} />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      {historial.length > 5 && (
        <Box sx={{ textAlign: 'center', pt: 1.5 }}>
          <Button size="small" onClick={() => setShowAll(v => !v)}
            endIcon={showAll ? <ExpandLess /> : <ExpandMore />}
            sx={{ color: 'text.secondary', fontSize: 12, borderRadius: 2 }}>
            {showAll ? 'Ver menos' : `Ver ${historial.length - 5} pagos más`}
          </Button>
        </Box>
      )}

      <PaymentDetailDialog open={!!detailPago} onClose={() => setDetailPago(null)} pago={detailPago} />
    </>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

export default function MiSuscripcion({ user }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const [data, setData]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showPlanes, setShowPlanes] = useState(false);

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true); else setRefreshing(true);
    try {
      const res = await apiClient.get('/suscripcion/mi-suscripcion');
      setData(res.data);
    } catch {
      toast.error('Error al cargar la información de suscripción');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const status = getStatusConfig(data?.suscripcion);

  // Determine the current plan from the most recent payment
  const planActual = data?.historial_pagos?.[0]?.plan || null;

  const handleRenewSuccess = async () => {
    toast.success('¡Suscripción renovada!');
    await fetchData(true);
    setShowPlanes(false);
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <CircularProgress sx={{ color: '#FF6020' }} />
      </Box>
    );
  }

  const { suscripcion, historial_pagos = [], planes_disponibles = [] } = data || {};
  const showRenewSection = status.showRenew || showPlanes;

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 900, mx: 'auto' }}>

      {/* ── Header ── */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
        <Avatar sx={{ bgcolor: alpha('#FF6020', 0.12), width: 44, height: 44 }}>
          <WorkspacePremium sx={{ color: '#FF6020', fontSize: 22 }} />
        </Avatar>
        <Box>
          <Typography variant="h6" fontWeight={900} lineHeight={1.1}>Mi Suscripción</Typography>
          <Typography fontSize={12} color="text.secondary">
            {user?.empresa?.nombre || 'Estado de tu plan y historial de pagos'}
          </Typography>
        </Box>
      </Box>

      {/* ── Hero Status Card ── */}
      <HeroCard
        suscripcion={suscripcion}
        planActual={planActual}
        onRefresh={() => fetchData(true)}
        refreshing={refreshing}
      />

      {/* ── Renovar / Upgrade (si aplica) ── */}
      {planes_disponibles.length > 0 && (
        <Card elevation={0} sx={{
          borderRadius: 3,
          border: `1px solid ${showRenewSection
            ? alpha('#FF6020', 0.4)
            : alpha(theme.palette.divider, 1)}`,
          bgcolor: 'background.paper',
          mb: 3, overflow: 'hidden',
          transition: 'border-color 0.2s',
        }}>
          <Box
            onClick={() => setShowPlanes(v => !v)}
            sx={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              px: 2.5, py: 2, cursor: 'pointer',
              '&:hover': { bgcolor: alpha(theme.palette.text.primary, 0.025) },
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box sx={{ width: 36, height: 36, borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center',
                bgcolor: alpha('#FF6020', isDark ? 0.15 : 0.08) }}>
                <Payments sx={{ color: '#FF6020', fontSize: 18 }} />
              </Box>
              <Box>
                <Typography fontWeight={700} fontSize={14}>
                  {status.severity === 'expired' ? 'Reactivar suscripción' : 'Renovar o cambiar plan'}
                </Typography>
                <Typography fontSize={12} color="text.secondary">
                  {planes_disponibles.length} {planes_disponibles.length === 1 ? 'plan disponible' : 'planes disponibles'}
                </Typography>
              </Box>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {status.showRenew && !showPlanes && (
                <Chip label="Acción requerida" size="small" sx={{
                  bgcolor: alpha('#EF4444', 0.1), color: '#EF4444', fontWeight: 700, fontSize: 10,
                }} />
              )}
              {showPlanes ? <ExpandLess sx={{ color: 'text.secondary' }} /> : <ExpandMore sx={{ color: 'text.secondary' }} />}
            </Box>
          </Box>

          <Collapse in={showPlanes} timeout="auto">
            <Divider />
            <Box sx={{ p: 2.5 }}>
              <Box sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: `repeat(${Math.min(planes_disponibles.length, 3)}, 1fr)` },
                gap: 2,
              }}>
                {planes_disponibles.map(plan => (
                  <PlanCard
                    key={plan.id}
                    plan={plan}
                    current={planActual?.id === plan.id}
                    onSuccess={handleRenewSuccess}
                  />
                ))}
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mt: 2.5, color: 'text.disabled' }}>
                <Shield sx={{ fontSize: 14 }} />
                <Typography fontSize={11.5}>Pagos seguros procesados por <strong>Wompi (Bancolombia)</strong></Typography>
              </Box>
            </Box>
          </Collapse>
        </Card>
      )}

      {/* ── Historial de pagos ── */}
      <Card elevation={0} sx={{
        borderRadius: 3,
        border: `1px solid ${alpha(theme.palette.divider, 1)}`,
        bgcolor: 'background.paper',
        overflow: 'hidden',
      }}>
        <Box sx={{ px: 2.5, py: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{ width: 36, height: 36, borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center',
              bgcolor: alpha('#059669', isDark ? 0.15 : 0.08) }}>
              <Receipt sx={{ color: '#059669', fontSize: 18 }} />
            </Box>
            <Box>
              <Typography fontWeight={700} fontSize={14}>Historial de pagos</Typography>
              <Typography fontSize={12} color="text.secondary">
                {historial_pagos.length} {historial_pagos.length === 1 ? 'pago registrado' : 'pagos registrados'}
              </Typography>
            </Box>
          </Box>
          {historial_pagos.length > 0 && (
            <Chip
              label={`Total: ${fmt(historial_pagos.reduce((acc, p) => acc + (p.monto || 0), 0))}`}
              size="small"
              sx={{ fontWeight: 700, fontSize: 11, bgcolor: alpha('#059669', 0.1), color: '#059669' }}
            />
          )}
        </Box>

        <Divider />
        <HistorialTable historial={historial_pagos} />
      </Card>

    </Box>
  );
}
