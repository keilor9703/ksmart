import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Card, Chip, Button, Avatar, Divider,
  CircularProgress, Stack, useTheme, alpha, LinearProgress,
  Table, TableBody, TableRow, TableCell, TableHead, TableContainer,
  Collapse, IconButton, Tooltip, Dialog, DialogTitle,
  DialogContent, DialogActions, Tabs, Tab, TextField, MenuItem,
  InputAdornment, Switch, FormControlLabel,
} from '@mui/material';
import {
  WorkspacePremium, CheckCircle, Warning, Cancel, Refresh,
  Receipt, CreditCard, AccountBalanceWallet, AttachMoney,
  ExpandMore, ExpandLess, ContentCopy, CalendarMonth,
  Payments, HourglassBottom, Bolt, Shield,
  Close, QrCode2, Business, Person, Lock, Save,
  Language, LocationOn, Groups, Visibility, VisibilityOff,
  OpenInNew, Email, Phone, Stars, Storage, Security,
  Cloud, Speed, Public, VerifiedUser, DataObject,
} from '@mui/icons-material';
import { toast } from 'react-toastify';
import apiClient from '../../api';
import WompiButton from '../../components/common/WompiButton';
import LinkPagoConfig from '../../components/common/LinkPagoConfig';

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

const PAISES_OPT = [
  { code: 'CO',   label: 'Colombia',       flag: '🇨🇴' },
  { code: 'MX',   label: 'México',         flag: '🇲🇽' },
  { code: 'EC',   label: 'Ecuador',        flag: '🇪🇨' },
  { code: 'PE',   label: 'Perú',           flag: '🇵🇪' },
  { code: 'VE',   label: 'Venezuela',      flag: '🇻🇪' },
  { code: 'AR',   label: 'Argentina',      flag: '🇦🇷' },
  { code: 'CL',   label: 'Chile',          flag: '🇨🇱' },
  { code: 'ES',   label: 'España',         flag: '🇪🇸' },
  { code: 'US',   label: 'Estados Unidos', flag: '🇺🇸' },
  { code: 'OTRO', label: 'Otro país',      flag: '🌎' },
];

const TAMANOS_OPT = [
  { value: 'solo',    label: 'Solo yo (1 persona)' },
  { value: 'pequeno', label: 'Pequeño (2–5)' },
  { value: 'mediano', label: 'Mediano (6–20)' },
  { value: 'grande',  label: 'Grande (+20)' },
];

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

  // Progress bar: use backend total_dias (trial period) or plan duration
  const planDias = suscripcion?.total_dias || planActual?.dias_duracion || 14;
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

// ─── MiEmpresaTab ─────────────────────────────────────────────────────────────

const MiEmpresaTab = () => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const [cuenta, setCuenta]       = useState(null);
  const [loading, setLoading]     = useState(true);
  const [savingInfo, setSavingInfo] = useState(false);
  const [savingPwd, setSavingPwd]   = useState(false);
  const [pwdOpen, setPwdOpen]       = useState(false);
  const [showCurPwd, setShowCurPwd] = useState(false);
  const [showNewPwd, setShowNewPwd] = useState(false);

  const [form, setForm] = useState({
    empresa_nombre: '', ciudad: '', pais: '', tamano_negocio: '',
    nombre_completo: '', email: '', telefono: '',
  });
  const [pwd, setPwd] = useState({ password_actual: '', nueva_password: '' });

  const [fidel, setFidel] = useState({ activa: true, earn_rate: 1000, redeem_rate: 100 });
  const [savingFidel, setSavingFidel] = useState(false);

  const fetchCuenta = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/empresa/mi-cuenta');
      setCuenta(res.data);
      setForm({
        empresa_nombre:  res.data.empresa.nombre        || '',
        ciudad:          res.data.empresa.ciudad         || '',
        pais:            res.data.empresa.pais           || '',
        tamano_negocio:  res.data.empresa.tamano_negocio || '',
        nombre_completo: res.data.usuario.nombre_completo || '',
        email:           res.data.usuario.email          || '',
        telefono:        res.data.usuario.telefono       || '',
      });
    } catch {
      toast.error('Error al cargar los datos de la cuenta');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchConfig = useCallback(async () => {
    try {
      const { data } = await apiClient.get('/empresa/config-ventas');
      setFidel({
        activa:      data.fidelizacion_activa     ?? true,
        earn_rate:   data.fidelizacion_earn_rate  ?? 1000,
        redeem_rate: data.fidelizacion_redeem_rate ?? 100,
      });
    } catch { /* silent */ }
  }, []);

  const handleSaveFidel = async () => {
    setSavingFidel(true);
    try {
      await apiClient.put('/empresa/config-ventas', {
        fidelizacion_activa:      fidel.activa,
        fidelizacion_earn_rate:   Number(fidel.earn_rate)   || 1000,
        fidelizacion_redeem_rate: Number(fidel.redeem_rate) || 100,
      });
      toast.success('Configuración de fidelización guardada');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al guardar');
    } finally {
      setSavingFidel(false);
    }
  };

  useEffect(() => { fetchCuenta(); fetchConfig(); }, [fetchCuenta, fetchConfig]);

  const handleSaveInfo = async () => {
    setSavingInfo(true);
    try {
      await apiClient.put('/empresa/mi-cuenta', form);
      toast.success('Datos actualizados correctamente');
      await fetchCuenta();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al guardar los datos');
    } finally {
      setSavingInfo(false);
    }
  };

  const handleSavePwd = async () => {
    setSavingPwd(true);
    try {
      await apiClient.put('/empresa/mi-cuenta/password', pwd);
      toast.success('Contraseña actualizada correctamente');
      setPwd({ password_actual: '', nueva_password: '' });
      setPwdOpen(false);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al cambiar la contraseña');
    } finally {
      setSavingPwd(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress sx={{ color: '#FF6020' }} />
      </Box>
    );
  }

  const logoRaw = cuenta?.empresa?.logo_base64;
  const logoSrc = logoRaw
    ? (logoRaw.startsWith('data:') ? logoRaw : `data:image/webp;base64,${logoRaw}`)
    : null;

  const sectionIcon = (color) => ({
    width: 36, height: 36, borderRadius: 2, flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    bgcolor: alpha(color, isDark ? 0.15 : 0.08),
  });

  return (
    <Box sx={{ pt: 2 }}>

      {/* ── Logo ── */}
      <Card elevation={0} sx={{ borderRadius: 3, border: `1px solid ${alpha(theme.palette.divider, 1)}`, mb: 2.5 }}>
        <Box sx={{ px: 2.5, py: 2, display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={sectionIcon('#FF6020')}><Business sx={{ color: '#FF6020', fontSize: 18 }} /></Box>
          <Typography fontWeight={700} fontSize={14}>Logo de la empresa</Typography>
        </Box>
        <Divider />
        <Box sx={{ px: 2.5, py: 2.5, display: 'flex', alignItems: 'center', gap: 3, flexWrap: 'wrap' }}>
          <Box sx={{
            width: 80, height: 80, borderRadius: 3, flexShrink: 0, overflow: 'hidden',
            border: `2px dashed ${alpha(theme.palette.divider, 1)}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            bgcolor: alpha(theme.palette.text.primary, 0.025),
          }}>
            {logoSrc
              ? <img src={logoSrc} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              : <Business sx={{ fontSize: 32, opacity: 0.2 }} />
            }
          </Box>
          <Box>
            <Typography fontSize={13} color="text.secondary" mb={1}>
              El logo se gestiona desde el módulo <strong>Catálogo Virtual</strong>.
            </Typography>
            <Button
              component="a" href="/admin/catalogo" size="small" variant="outlined"
              endIcon={<OpenInNew sx={{ fontSize: 14 }} />}
              sx={{
                borderRadius: 2, fontSize: 12, textTransform: 'none',
                borderColor: alpha('#FF6020', 0.5), color: '#FF6020',
                '&:hover': { borderColor: '#FF6020', bgcolor: alpha('#FF6020', 0.06) },
              }}
            >
              Ir a Catálogo Virtual
            </Button>
          </Box>
        </Box>
      </Card>

      {/* ── Empresa ── */}
      <Card elevation={0} sx={{ borderRadius: 3, border: `1px solid ${alpha(theme.palette.divider, 1)}`, mb: 2.5 }}>
        <Box sx={{ px: 2.5, py: 2, display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={sectionIcon('#2563EB')}><Business sx={{ color: '#2563EB', fontSize: 18 }} /></Box>
          <Box>
            <Typography fontWeight={700} fontSize={14}>Información de la empresa</Typography>
            <Typography fontSize={12} color="text.secondary">NIT: {cuenta?.empresa?.nit || '—'}</Typography>
          </Box>
        </Box>
        <Divider />
        <Box sx={{ px: 2.5, py: 2.5, display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
          <TextField
            label="Nombre de la empresa" size="small" fullWidth
            value={form.empresa_nombre}
            onChange={e => setForm(f => ({ ...f, empresa_nombre: e.target.value }))}
            InputProps={{ startAdornment: <InputAdornment position="start"><Business sx={{ fontSize: 16, color: 'text.disabled' }} /></InputAdornment> }}
          />
          <TextField
            label="Ciudad" size="small" fullWidth
            value={form.ciudad}
            onChange={e => setForm(f => ({ ...f, ciudad: e.target.value }))}
            InputProps={{ startAdornment: <InputAdornment position="start"><LocationOn sx={{ fontSize: 16, color: 'text.disabled' }} /></InputAdornment> }}
          />
          <TextField
            select label="País" size="small" fullWidth
            value={form.pais}
            onChange={e => setForm(f => ({ ...f, pais: e.target.value }))}
            InputProps={{ startAdornment: <InputAdornment position="start"><Language sx={{ fontSize: 16, color: 'text.disabled' }} /></InputAdornment> }}
          >
            {PAISES_OPT.map(p => (
              <MenuItem key={p.code} value={p.code}>{p.flag} {p.label}</MenuItem>
            ))}
          </TextField>
          <TextField
            select label="Tamaño del negocio" size="small" fullWidth
            value={form.tamano_negocio}
            onChange={e => setForm(f => ({ ...f, tamano_negocio: e.target.value }))}
            InputProps={{ startAdornment: <InputAdornment position="start"><Groups sx={{ fontSize: 16, color: 'text.disabled' }} /></InputAdornment> }}
          >
            {TAMANOS_OPT.map(t => (
              <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>
            ))}
          </TextField>
        </Box>
      </Card>

      {/* ── Administrador ── */}
      <Card elevation={0} sx={{ borderRadius: 3, border: `1px solid ${alpha(theme.palette.divider, 1)}`, mb: 2.5 }}>
        <Box sx={{ px: 2.5, py: 2, display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={sectionIcon('#059669')}><Person sx={{ color: '#059669', fontSize: 18 }} /></Box>
          <Box>
            <Typography fontWeight={700} fontSize={14}>Datos del administrador</Typography>
            <Typography fontSize={12} color="text.secondary">Usuario: {cuenta?.usuario?.username || '—'}</Typography>
          </Box>
        </Box>
        <Divider />
        <Box sx={{ px: 2.5, py: 2.5, display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
          <TextField
            label="Nombre completo" size="small" fullWidth
            value={form.nombre_completo}
            onChange={e => setForm(f => ({ ...f, nombre_completo: e.target.value }))}
            InputProps={{ startAdornment: <InputAdornment position="start"><Person sx={{ fontSize: 16, color: 'text.disabled' }} /></InputAdornment> }}
          />
          <TextField
            label="Correo electrónico" size="small" fullWidth type="email"
            value={form.email}
            onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
            InputProps={{ startAdornment: <InputAdornment position="start"><Email sx={{ fontSize: 16, color: 'text.disabled' }} /></InputAdornment> }}
          />
          <TextField
            label="Teléfono" size="small" fullWidth
            value={form.telefono}
            onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))}
            InputProps={{ startAdornment: <InputAdornment position="start"><Phone sx={{ fontSize: 16, color: 'text.disabled' }} /></InputAdornment> }}
          />
        </Box>
      </Card>

      {/* ── Save info button ── */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2.5 }}>
        <Button
          variant="contained" onClick={handleSaveInfo} disabled={savingInfo}
          startIcon={savingInfo ? <CircularProgress size={16} color="inherit" /> : <Save />}
          sx={{ borderRadius: 2.5, bgcolor: '#FF6020', '&:hover': { bgcolor: '#e05519' }, fontWeight: 700, px: 3 }}
        >
          {savingInfo ? 'Guardando…' : 'Guardar cambios'}
        </Button>
      </Box>

      {/* ── Programa de fidelización ── */}
      <Card elevation={0} sx={{ borderRadius: 3, border: `1px solid ${alpha(theme.palette.divider, 1)}`, mb: 2.5 }}>
        <Box sx={{ px: 2.5, py: 2, display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={sectionIcon('#F59E0B')}><Stars sx={{ color: '#F59E0B', fontSize: 18 }} /></Box>
          <Box sx={{ flex: 1 }}>
            <Typography fontWeight={700} fontSize={14}>Programa de fidelización</Typography>
            <Typography fontSize={12} color="text.secondary">Puntos que acumulan los clientes al comprar</Typography>
          </Box>
          <FormControlLabel
            control={
              <Switch
                checked={fidel.activa}
                onChange={e => setFidel(f => ({ ...f, activa: e.target.checked }))}
                sx={{
                  '& .MuiSwitch-switchBase.Mui-checked':                  { color: '#F59E0B' },
                  '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: '#F59E0B' },
                }}
              />
            }
            label={<Typography fontSize={12} fontWeight={600} color={fidel.activa ? '#92400E' : 'text.secondary'}>{fidel.activa ? 'Activo' : 'Inactivo'}</Typography>}
            sx={{ m: 0 }}
          />
        </Box>
        <Collapse in={fidel.activa} timeout="auto">
          <Divider />
          <Box sx={{ px: 2.5, py: 2.5 }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2, mb: 2 }}>
              <TextField
                label="COP por punto ganado" size="small" fullWidth type="number"
                helperText={`1 punto cada $${Number(fidel.earn_rate).toLocaleString('es-CO')} COP`}
                value={fidel.earn_rate}
                onChange={e => setFidel(f => ({ ...f, earn_rate: e.target.value }))}
                InputProps={{ inputProps: { min: 1 } }}
              />
              <TextField
                label="COP de descuento por punto" size="small" fullWidth type="number"
                helperText={`1 punto = $${Number(fidel.redeem_rate).toLocaleString('es-CO')} de descuento`}
                value={fidel.redeem_rate}
                onChange={e => setFidel(f => ({ ...f, redeem_rate: e.target.value }))}
                InputProps={{ inputProps: { min: 1 } }}
              />
            </Box>
            <Box sx={{
              p: 1.5, borderRadius: 2, mb: 2,
              bgcolor: alpha('#F59E0B', isDark ? 0.1 : 0.06),
              border: `1px solid ${alpha('#F59E0B', 0.25)}`,
            }}>
              <Typography fontSize={12} color="text.secondary">
                Ejemplo: compra de <strong>$50.000</strong> →
                gana <strong>{Math.floor(50000 / Math.max(Number(fidel.earn_rate) || 1000, 1))} puntos</strong>
                &nbsp;({Math.floor(50000 / Math.max(Number(fidel.earn_rate) || 1000, 1)) * (Number(fidel.redeem_rate) || 100) > 0
                  ? `= $${(Math.floor(50000 / Math.max(Number(fidel.earn_rate) || 1000, 1)) * (Number(fidel.redeem_rate) || 100)).toLocaleString('es-CO')} de descuento`
                  : '0 descuento'})
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                variant="contained" onClick={handleSaveFidel} disabled={savingFidel}
                startIcon={savingFidel ? <CircularProgress size={16} color="inherit" /> : <Save />}
                sx={{ borderRadius: 2.5, bgcolor: '#F59E0B', '&:hover': { bgcolor: '#D97706' }, fontWeight: 700, px: 3 }}
              >
                {savingFidel ? 'Guardando…' : 'Guardar configuración'}
              </Button>
            </Box>
          </Box>
        </Collapse>
        {!fidel.activa && (
          <>
            <Divider />
            <Box sx={{ px: 2.5, py: 1.5 }}>
              <Button
                variant="contained" onClick={handleSaveFidel} disabled={savingFidel} size="small"
                startIcon={savingFidel ? <CircularProgress size={14} color="inherit" /> : <Save />}
                sx={{ borderRadius: 2, bgcolor: '#6B7280', '&:hover': { bgcolor: '#4B5563' }, fontWeight: 700 }}
              >
                {savingFidel ? 'Guardando…' : 'Guardar (desactivado)'}
              </Button>
            </Box>
          </>
        )}
      </Card>

      {/* ── Password change ── */}
      <Card elevation={0} sx={{ borderRadius: 3, border: `1px solid ${alpha(theme.palette.divider, 1)}` }}>
        <Box
          onClick={() => setPwdOpen(v => !v)}
          sx={{
            px: 2.5, py: 2, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            '&:hover': { bgcolor: alpha(theme.palette.text.primary, 0.025) },
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={sectionIcon('#7C3AED')}><Lock sx={{ color: '#7C3AED', fontSize: 18 }} /></Box>
            <Box>
              <Typography fontWeight={700} fontSize={14}>Cambiar contraseña</Typography>
              <Typography fontSize={12} color="text.secondary">Actualiza tu contraseña de acceso</Typography>
            </Box>
          </Box>
          {pwdOpen ? <ExpandLess sx={{ color: 'text.secondary' }} /> : <ExpandMore sx={{ color: 'text.secondary' }} />}
        </Box>

        <Collapse in={pwdOpen} timeout="auto">
          <Divider />
          <Box sx={{ px: 2.5, py: 2.5 }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2, mb: 2 }}>
              <TextField
                label="Contraseña actual" size="small" fullWidth
                type={showCurPwd ? 'text' : 'password'}
                value={pwd.password_actual}
                onChange={e => setPwd(p => ({ ...p, password_actual: e.target.value }))}
                InputProps={{
                  startAdornment: <InputAdornment position="start"><Lock sx={{ fontSize: 16, color: 'text.disabled' }} /></InputAdornment>,
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={() => setShowCurPwd(v => !v)} edge="end">
                        {showCurPwd ? <VisibilityOff sx={{ fontSize: 16 }} /> : <Visibility sx={{ fontSize: 16 }} />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
              <TextField
                label="Nueva contraseña" size="small" fullWidth
                type={showNewPwd ? 'text' : 'password'}
                value={pwd.nueva_password}
                onChange={e => setPwd(p => ({ ...p, nueva_password: e.target.value }))}
                InputProps={{
                  startAdornment: <InputAdornment position="start"><Lock sx={{ fontSize: 16, color: 'text.disabled' }} /></InputAdornment>,
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={() => setShowNewPwd(v => !v)} edge="end">
                        {showNewPwd ? <VisibilityOff sx={{ fontSize: 16 }} /> : <Visibility sx={{ fontSize: 16 }} />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                variant="contained" onClick={handleSavePwd}
                disabled={savingPwd || !pwd.password_actual || !pwd.nueva_password}
                startIcon={savingPwd ? <CircularProgress size={16} color="inherit" /> : <Save />}
                sx={{ borderRadius: 2.5, bgcolor: '#7C3AED', '&:hover': { bgcolor: '#6d28d9' }, fontWeight: 700, px: 3 }}
              >
                {savingPwd ? 'Guardando…' : 'Cambiar contraseña'}
              </Button>
            </Box>
          </Box>
        </Collapse>
      </Card>
    </Box>
  );
};

// ─── PlataformaTab ────────────────────────────────────────────────────────────

const PlataformaTab = () => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const sectionIcon = (color) => ({
    width: 36, height: 36, borderRadius: 2, flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    bgcolor: alpha(color, isDark ? 0.15 : 0.08),
  });

  const StatChip = ({ label, value, color }) => (
    <Box sx={{
      flex: 1, minWidth: 120,
      p: 2, borderRadius: 3, textAlign: 'center',
      bgcolor: alpha(color, isDark ? 0.1 : 0.06),
      border: `1px solid ${alpha(color, 0.2)}`,
    }}>
      <Typography fontWeight={900} fontSize={22} color={color}>{value}</Typography>
      <Typography fontSize={11} color="text.secondary" fontWeight={600}>{label}</Typography>
    </Box>
  );

  const Feature = ({ icon, title, desc }) => (
    <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
      <Box sx={{ mt: 0.2, color: '#059669', flexShrink: 0 }}>{icon}</Box>
      <Box>
        <Typography fontSize={13} fontWeight={700}>{title}</Typography>
        <Typography fontSize={12} color="text.secondary">{desc}</Typography>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ pt: 2 }}>

      {/* ── Hero Oracle ── */}
      <Card elevation={0} sx={{
        borderRadius: 4, mb: 3, overflow: 'hidden',
        border: `1px solid ${alpha('#C74634', 0.3)}`,
        background: isDark
          ? `linear-gradient(135deg, ${alpha('#C74634', 0.1)} 0%, ${alpha('#0d1117', 0.9)} 100%)`
          : `linear-gradient(135deg, ${alpha('#C74634', 0.06)} 0%, #fff 100%)`,
      }}>
        <Box sx={{ height: 4, background: 'linear-gradient(90deg, #C74634 0%, #f5a623 100%)' }} />
        <Box sx={{ p: { xs: 2.5, md: 3.5 } }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2.5} alignItems={{ sm: 'center' }}>
            <Avatar sx={{
              width: 64, height: 64, flexShrink: 0,
              bgcolor: alpha('#C74634', isDark ? 0.15 : 0.08),
              border: `2px solid ${alpha('#C74634', 0.25)}`,
            }}>
              <Cloud sx={{ color: '#C74634', fontSize: 32 }} />
            </Avatar>
            <Box sx={{ flex: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5, flexWrap: 'wrap' }}>
                <Typography fontWeight={900} fontSize={18}>Oracle Cloud Infrastructure</Typography>
                <Chip
                  icon={<CheckCircle sx={{ fontSize: '13px !important', color: '#059669 !important' }} />}
                  label="Activo"
                  size="small"
                  sx={{ bgcolor: alpha('#059669', 0.1), color: '#059669', fontWeight: 800, fontSize: 11, border: `1px solid ${alpha('#059669', 0.3)}` }}
                />
              </Box>
              <Typography fontSize={13} color="text.secondary">
                Ksmart360 opera sobre la misma infraestructura utilizada por instituciones financieras,
                gobiernos y empresas Fortune 500 a nivel mundial.
              </Typography>
            </Box>
          </Stack>

          {/* Stats */}
          <Box sx={{ display: 'flex', gap: 2, mt: 3, flexWrap: 'wrap' }}>
            <StatChip label="CPUs ARM" value="4" color="#C74634" />
            <StatChip label="RAM (GB)" value="24" color="#2563EB" />
            <StatChip label="Almacenamiento" value="96 GB" color="#059669" />
            <StatChip label="Uptime" value="24/7" color="#7C3AED" />
          </Box>
        </Box>
      </Card>

      {/* ── Características ── */}
      <Card elevation={0} sx={{ borderRadius: 3, border: `1px solid ${alpha(theme.palette.divider, 1)}`, mb: 2.5 }}>
        <Box sx={{ px: 2.5, py: 2, display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={sectionIcon('#059669')}><VerifiedUser sx={{ color: '#059669', fontSize: 18 }} /></Box>
          <Box>
            <Typography fontWeight={700} fontSize={14}>Seguridad e Infraestructura</Typography>
            <Typography fontSize={12} color="text.secondary">Estándares enterprise en cada capa</Typography>
          </Box>
        </Box>
        <Divider />
        <Box sx={{ px: 2.5, py: 2.5, display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2.5 }}>
          <Feature
            icon={<Shield sx={{ fontSize: 18 }} />}
            title="Servidor dedicado"
            desc="Recursos exclusivos — sin compartir CPU ni memoria con otros servicios."
          />
          <Feature
            icon={<Security sx={{ fontSize: 18 }} />}
            title="HTTPS / TLS cifrado"
            desc="Toda la comunicación entre tu negocio y la plataforma está cifrada con certificado SSL."
          />
          <Feature
            icon={<Storage sx={{ fontSize: 18 }} />}
            title="Base de datos privada"
            desc="PostgreSQL en servidor propio. Tus datos no están en infraestructura compartida de terceros."
          />
          <Feature
            icon={<Speed sx={{ fontSize: 18 }} />}
            title="Arquitectura ARM de alto rendimiento"
            desc="Procesadores ARM Ampere A1 — la misma arquitectura usada en chips Apple M1/M2."
          />
          <Feature
            icon={<Public sx={{ fontSize: 18 }} />}
            title="Disponibilidad continua"
            desc="Servicio activo 24 horas los 7 días de la semana, sin interrupciones por inactividad."
          />
          <Feature
            icon={<DataObject sx={{ fontSize: 18 }} />}
            title="Soberanía de datos"
            desc="Control total sobre la información — sin dependencia de servicios gratuitos con vencimiento."
          />
        </Box>
      </Card>

      {/* ── Credenciales Oracle ── */}
      <Card elevation={0} sx={{
        borderRadius: 3, mb: 2.5,
        border: `1px solid ${alpha('#2563EB', 0.25)}`,
        bgcolor: alpha('#2563EB', isDark ? 0.06 : 0.03),
      }}>
        <Box sx={{ px: 2.5, py: 2, display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={sectionIcon('#2563EB')}><Cloud sx={{ color: '#2563EB', fontSize: 18 }} /></Box>
          <Box>
            <Typography fontWeight={700} fontSize={14}>Infraestructura certificada</Typography>
            <Typography fontSize={12} color="text.secondary">Respaldada por Oracle Corporation</Typography>
          </Box>
        </Box>
        <Divider sx={{ borderColor: alpha('#2563EB', 0.15) }} />
        <Box sx={{ px: 2.5, py: 2 }}>
          {[
            ['Proveedor cloud', 'Oracle Cloud Infrastructure (OCI)'],
            ['Región', 'US Ashburn (us-ashburn-1)'],
            ['Tipo de instancia', 'VM.Standard.A1.Flex — Always Free Tier'],
            ['Sistema operativo', 'Ubuntu 22.04 LTS'],
            ['Servidor web', 'Nginx + Gunicorn'],
            ['Base de datos', 'PostgreSQL 14'],
            ['API Backend', 'FastAPI (Python)'],
          ].map(([label, value]) => (
            <Box key={label} sx={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              py: 1.1, borderBottom: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
            }}>
              <Typography fontSize={12.5} color="text.secondary">{label}</Typography>
              <Typography fontSize={12.5} fontWeight={600}>{value}</Typography>
            </Box>
          ))}
        </Box>
      </Card>

      {/* ── Nota pie ── */}
      <Box sx={{
        p: 2, borderRadius: 2.5,
        bgcolor: alpha(theme.palette.text.primary, isDark ? 0.04 : 0.025),
        border: `1px solid ${alpha(theme.palette.divider, 1)}`,
        display: 'flex', gap: 1.5, alignItems: 'flex-start',
      }}>
        <Shield sx={{ fontSize: 16, color: 'text.disabled', mt: 0.2, flexShrink: 0 }} />
        <Typography fontSize={12} color="text.secondary">
          Ksmart360 es desarrollado y operado por <strong>TechStack Colombia</strong>.
          La infraestructura Oracle Cloud garantiza que tu información empresarial cumple con
          los más altos estándares de disponibilidad y seguridad del sector tecnológico.
        </Typography>
      </Box>

    </Box>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

export default function MiSuscripcion({ user }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const [tab, setTab]           = useState(0);
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

  const { suscripcion, historial_pagos = [], planes_disponibles = [] } = data || {};
  const showRenewSection = status.showRenew || showPlanes;

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 900, mx: 'auto' }}>

      {/* ── Header ── */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5 }}>
        <Avatar sx={{ bgcolor: alpha('#FF6020', 0.12), width: 44, height: 44 }}>
          <WorkspacePremium sx={{ color: '#FF6020', fontSize: 22 }} />
        </Avatar>
        <Box>
          <Typography variant="h6" fontWeight={900} lineHeight={1.1}>Mi Cuenta</Typography>
          <Typography fontSize={12} color="text.secondary">
            {user?.empresa?.nombre || 'Empresa y suscripción'}
          </Typography>
        </Box>
      </Box>

      {/* ── Tabs ── */}
      <Tabs
        value={tab} onChange={(_, v) => setTab(v)}
        sx={{
          mb: 3,
          borderBottom: `1px solid ${alpha(theme.palette.divider, 1)}`,
          '& .MuiTab-root': { textTransform: 'none', fontWeight: 700, fontSize: 13, minHeight: 44 },
          '& .MuiTabs-indicator': { bgcolor: '#FF6020' },
          '& .Mui-selected': { color: '#FF6020 !important' },
        }}
      >
        <Tab label="Mi Empresa" />
        <Tab label="Suscripción" />
        <Tab label="Plataforma" />
      </Tabs>

      {/* ── Tab 0: Mi Empresa ── */}
      {tab === 0 && <MiEmpresaTab />}

      {/* ── Tab 2: Plataforma ── */}
      {tab === 2 && <PlataformaTab />}

      {/* ── Tab 1: Suscripción ── */}
      {tab === 1 && <>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '40vh' }}>
          <CircularProgress sx={{ color: '#FF6020' }} />
        </Box>
      ) : <>

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

      {/* ── Link de Pago POS ── */}
      <Card elevation={0} sx={{
        borderRadius: 3,
        border: `1px solid ${alpha(theme.palette.divider, 1)}`,
        bgcolor: 'background.paper',
        mb: 3, overflow: 'hidden',
      }}>
        <Box sx={{ px: 2.5, py: 2, display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{
            width: 36, height: 36, borderRadius: 2, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            bgcolor: alpha('#FF6020', isDark ? 0.15 : 0.08),
          }}>
            <QrCode2 sx={{ color: '#FF6020', fontSize: 18 }} />
          </Box>
          <Box>
            <Typography fontWeight={700} fontSize={14}>Link de Pago en POS</Typography>
            <Typography fontSize={12} color="text.secondary">
              Configura el QR o link de cobro que aparecerá en el punto de venta
            </Typography>
          </Box>
        </Box>
        <Divider />
        <Box sx={{ px: 2.5, py: 2.5 }}>
          <LinkPagoConfig />
        </Box>
      </Card>

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

      </>}
      </>}
    </Box>
  );
}
