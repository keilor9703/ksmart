import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box, Typography, Card, Chip, Button, IconButton, TextField,
  Dialog, DialogTitle, DialogContent, DialogActions,
  Avatar, Divider, Tooltip, Alert, CircularProgress,
  InputAdornment, Paper, Stack, useTheme, useMediaQuery,
  ToggleButtonGroup, ToggleButton, alpha, Badge, Skeleton,
  Stepper, Step, StepLabel, StepConnector,
  Select, MenuItem, FormControl, Table, TableBody, TableRow,
  TableCell, TableHead, TableContainer,
  Switch, FormControlLabel,
} from '@mui/material';
import {
  ShoppingBag, Search, WhatsApp, CheckCircle, LocalShipping,
  Cancel, Receipt, Refresh, Phone, LocationOn, Comment,
  Storefront, Inventory2, Done, AccessTime,
  Edit, Close, AttachMoney, AccountBalanceWallet, Warning,
  Person, Email, ContentCopy, ViewModule, ViewList,
  SortByAlpha, Bolt, FiberManualRecord, ArrowForward,
  CheckCircleOutline, HourglassEmpty, Clear,
} from '@mui/icons-material';
import apiClient from '../../api';
import { toast } from 'react-toastify';
import ReciboDialog from '../../components/common/ReciboDialog';
import LinkPagoModal from '../../components/common/LinkPagoModal.jsx';
import usePolling from '../../hooks/usePolling';

// ─── Estado metadata ──────────────────────────────────────────────────────────

const ESTADOS_META = [
  { value: 'todos',          label: 'Todos',          color: '#6b7280', icon: null },
  { value: 'nuevo',          label: 'Nuevo',          color: '#2563EB', icon: <Bolt sx={{ fontSize: 12 }} /> },
  { value: 'confirmado',     label: 'Confirmado',     color: '#059669', icon: <CheckCircle sx={{ fontSize: 12 }} /> },
  { value: 'en_preparacion', label: 'En preparación', color: '#D97706', icon: <Inventory2 sx={{ fontSize: 12 }} /> },
  { value: 'enviado',        label: 'Enviado',        color: '#7C3AED', icon: <LocalShipping sx={{ fontSize: 12 }} /> },
  { value: 'entregado',      label: 'Entregado',      color: '#065f46', icon: <CheckCircleOutline sx={{ fontSize: 12 }} /> },
  { value: 'cancelado',      label: 'Cancelado',      color: '#9ca3af', icon: <Cancel sx={{ fontSize: 12 }} /> },
];

const ESTADO_FLOW = ['nuevo', 'confirmado', 'en_preparacion', 'enviado', 'entregado'];

const QUICK_ACTIONS = {
  nuevo:          { label: 'Confirmar',         color: '#059669', icon: <CheckCircle sx={{ fontSize: 14 }} />, next: 'confirmado' },
  confirmado:     { label: 'En preparación',    color: '#D97706', icon: <Inventory2 sx={{ fontSize: 14 }} />,  next: 'en_preparacion' },
  en_preparacion: { label: 'Listo / Enviado',   color: '#7C3AED', icon: <LocalShipping sx={{ fontSize: 14 }} />, next: 'enviado' },
  enviado:        { label: 'Entregar y Cobrar', color: '#059669', icon: <AttachMoney sx={{ fontSize: 14 }} />, next: '_pay' },
};

const METODOS_PAGO = [
  { value: 'Efectivo',      label: 'Efectivo',      icon: <AttachMoney /> },
  { value: 'Transferencia', label: 'Transferencia', icon: <AccountBalanceWallet /> },
  { value: 'Nequi',         label: 'Nequi',         icon: <AccountBalanceWallet /> },
  { value: 'Daviplata',     label: 'Daviplata',     icon: <AccountBalanceWallet /> },
  { value: 'Tarjeta',       label: 'Tarjeta',       icon: <AttachMoney /> },
];

const SORT_OPTIONS = [
  { value: 'newest',  label: 'Más reciente' },
  { value: 'oldest',  label: 'Más antiguo'  },
  { value: 'highest', label: 'Mayor valor'  },
  { value: 'lowest',  label: 'Menor valor'  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (val) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(val);

const minutesAgo = (dateStr) => {
  if (!dateStr) return 0;
  return Math.floor((Date.now() - new Date(dateStr + (dateStr.endsWith('Z') ? '' : 'Z'))) / 60000);
};

const timeAgo = (dateStr) => {
  const diff = minutesAgo(dateStr);
  if (diff < 1)   return 'ahora mismo';
  if (diff < 60)  return `hace ${diff}min`;
  if (diff < 1440) return `hace ${Math.floor(diff / 60)}h`;
  return `hace ${Math.floor(diff / 1440)}d`;
};

const getEstadoMeta = (value) => ESTADOS_META.find(e => e.value === value) || ESTADOS_META[0];

const copyToClipboard = (text) => {
  navigator.clipboard?.writeText(text).then(() => toast.success('Copiado al portapapeles'));
};

// ─── EstadoChip ───────────────────────────────────────────────────────────────

const EstadoChip = ({ estado, size = 'small' }) => {
  const theme = useTheme();
  const meta = getEstadoMeta(estado);
  return (
    <Chip
      icon={meta.icon}
      label={meta.label}
      size={size}
      sx={{
        bgcolor: alpha(meta.color, theme.palette.mode === 'dark' ? 0.18 : 0.1),
        color: meta.color,
        fontWeight: 700,
        fontSize: size === 'small' ? 11 : 12,
        border: `1px solid ${alpha(meta.color, 0.25)}`,
        '& .MuiChip-icon': { color: meta.color },
      }}
    />
  );
};

// ─── StateTimeline ────────────────────────────────────────────────────────────

const StateTimeline = ({ estado }) => {
  const theme = useTheme();
  const isCancelado = estado === 'cancelado';
  const currentIdx = ESTADO_FLOW.indexOf(estado);

  if (isCancelado) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1.5, px: 0.5 }}>
        <Cancel sx={{ color: '#EF4444', fontSize: 18 }} />
        <Typography fontSize={13} color="#EF4444" fontWeight={700}>Pedido cancelado</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ py: 1 }}>
      <Stepper alternativeLabel connector={
        <StepConnector sx={{
          '& .MuiStepConnector-line': {
            borderTopWidth: 2,
            borderColor: theme.palette.divider,
          },
          '&.Mui-active .MuiStepConnector-line, &.Mui-completed .MuiStepConnector-line': {
            borderColor: '#059669',
          },
        }} />
      }>
        {ESTADO_FLOW.map((s, i) => {
          const meta = getEstadoMeta(s);
          const completed = currentIdx > i;
          const active = currentIdx === i;
          return (
            <Step key={s} completed={completed} active={active}>
              <StepLabel
                StepIconComponent={() => (
                  <Box sx={{
                    width: 24, height: 24, borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    bgcolor: completed || active ? alpha(meta.color, 0.15) : alpha(theme.palette.text.disabled, 0.08),
                    border: `2px solid ${completed || active ? meta.color : theme.palette.divider}`,
                    transition: 'all 0.2s',
                  }}>
                    {completed
                      ? <Done sx={{ fontSize: 13, color: meta.color }} />
                      : active
                        ? <FiberManualRecord sx={{ fontSize: 10, color: meta.color }} />
                        : <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: 'divider' }} />
                    }
                  </Box>
                )}
              >
                <Typography sx={{ fontSize: 9, fontWeight: active ? 800 : 500, color: active ? meta.color : 'text.secondary', mt: 0.3 }}>
                  {meta.label}
                </Typography>
              </StepLabel>
            </Step>
          );
        })}
      </Stepper>
    </Box>
  );
};

// ─── StatFilterBar ────────────────────────────────────────────────────────────

const StatFilterBar = ({ stats, filtro, onChange }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const items = ESTADOS_META.map(e => ({ ...e, count: e.value === 'todos' ? (stats.total ?? 0) : (stats[e.value] ?? 0) }));

  return (
    <Box sx={{
      display: 'flex', gap: 0.75, overflowX: 'auto', pb: 0.5,
      '&::-webkit-scrollbar': { height: 3 },
      '&::-webkit-scrollbar-thumb': { bgcolor: alpha('#000', 0.15), borderRadius: 2 },
    }}>
      {items.map(e => {
        const active = filtro === e.value;
        const isNuevo = e.value === 'nuevo' && e.count > 0;
        return (
          <Box
            key={e.value}
            onClick={() => onChange(e.value)}
            sx={{
              display: 'flex', alignItems: 'center', gap: 0.6,
              px: 1.5, py: 0.7, borderRadius: 10, cursor: 'pointer',
              flexShrink: 0, transition: 'all 0.15s',
              border: `1.5px solid ${active ? e.color : 'transparent'}`,
              bgcolor: active ? alpha(e.color, isDark ? 0.2 : 0.1) : (isDark ? alpha('#fff', 0.05) : alpha('#000', 0.04)),
              '&:hover': { bgcolor: alpha(e.color, isDark ? 0.2 : 0.08), border: `1.5px solid ${alpha(e.color, 0.4)}` },
            }}
          >
            {isNuevo && !active && (
              <Box sx={{
                width: 7, height: 7, borderRadius: '50%', bgcolor: e.color, flexShrink: 0,
                '@keyframes ping': { '0%': { transform: 'scale(1)', opacity: 1 }, '100%': { transform: 'scale(2)', opacity: 0 } },
                animation: 'ping 1.2s cubic-bezier(0,0,0.2,1) infinite',
              }} />
            )}
            <Typography sx={{ fontSize: 12, fontWeight: active ? 800 : 600, color: active ? e.color : 'text.secondary', whiteSpace: 'nowrap' }}>
              {e.label}
            </Typography>
            <Box sx={{
              minWidth: 20, height: 18, borderRadius: 5, px: 0.7,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              bgcolor: active ? e.color : alpha(e.color, 0.15),
            }}>
              <Typography sx={{ fontSize: 10, fontWeight: 900, color: active ? '#fff' : e.color, lineHeight: 1 }}>
                {e.count}
              </Typography>
            </Box>
          </Box>
        );
      })}
    </Box>
  );
};

// ─── CardSkeleton ─────────────────────────────────────────────────────────────

const CardSkeleton = () => (
  <Card elevation={0} sx={{ borderRadius: 3, borderLeft: '4px solid', borderColor: 'divider', bgcolor: 'background.paper', overflow: 'hidden' }}>
    <Box sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <Skeleton variant="circular" width={32} height={32} />
          <Box><Skeleton width={110} height={16} /><Skeleton width={70} height={12} sx={{ mt: 0.3 }} /></Box>
        </Box>
        <Skeleton width={72} height={22} sx={{ borderRadius: 4 }} />
      </Box>
      <Skeleton width={140} height={14} sx={{ mb: 1.5 }} />
      <Skeleton variant="rounded" width="100%" height={52} sx={{ borderRadius: 2, mb: 1.5 }} />
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1.5 }}>
        <Skeleton width={40} height={12} />
        <Skeleton width={80} height={20} />
      </Box>
      <Divider sx={{ mb: 1.5 }} />
      <Box sx={{ display: 'flex', gap: 0.8 }}>
        <Skeleton variant="rounded" width={60} height={30} sx={{ borderRadius: 2 }} />
        <Skeleton variant="rounded" width={32} height={30} sx={{ borderRadius: 2 }} />
        <Skeleton variant="rounded" width={32} height={30} sx={{ borderRadius: 2 }} />
        <Skeleton variant="rounded" sx={{ flex: 2, height: 30, borderRadius: 2 }} />
      </Box>
    </Box>
  </Card>
);

// ─── PaymentDialog ────────────────────────────────────────────────────────────

const PaymentDialog = ({ open, onClose, pedido, empresa, vendedor, onSuccess, linkPagoConfig }) => {
  const theme = useTheme();
  const [metodo, setMetodo] = useState('Efectivo');
  const [loading, setLoading] = useState(false);
  const [recibo, setRecibo] = useState(null);
  const [omitirInventario, setOmitirInventario] = useState(false);
  const [ivaPct, setIvaPct] = useState(0);
  const omitirInventarioRef = useRef(false);
  omitirInventarioRef.current = omitirInventario;
  const [linkPagoModalOpen, setLinkPagoModalOpen] = useState(false);

  const totalConIva = pedido ? Math.round(pedido.total * (1 + ivaPct / 100)) : 0;
  const ivaTotal = pedido ? Math.round(pedido.total * (ivaPct / 100)) : 0;

  const doConvertir = async () => {
    if (!pedido) return;
    setLoading(true);
    try {
      const res = await apiClient.post(`/pedidos-virtuales/${pedido.id}/convertir-venta`, {
        metodo_pago: metodo,
        omitir_inventario: omitirInventarioRef.current,
        iva_porcentaje: ivaPct,
      });
      const ventaSnap = {
        id: res.data.venta_id,
        fecha: new Date().toISOString(),
        cliente: { nombre: pedido.nombre_cliente, telefono: pedido.celular_cliente },
        detalles: (pedido.detalles || []).map(d => ({ producto: { nombre: d.nombre_variante ? `${d.nombre_producto} - ${d.nombre_variante}` : d.nombre_producto }, cantidad: d.cantidad, precio_unitario: d.precio_unitario })),
        total: totalConIva, iva_total: ivaTotal, iva_porcentaje: ivaPct,
        monto_pagado: totalConIva, estado_pago: 'pagado', metodo_pago: metodo,
      };
      setRecibo(ventaSnap);
      setOmitirInventario(false);
      onSuccess(res.data);
      toast.success('¡Pedido convertido a venta!');
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Error al convertir el pedido');
    } finally { setLoading(false); }
  };

  const handleConfirm = () => {
    if (metodo === 'Link de Pago') {
      setLinkPagoModalOpen(true);
    } else {
      doConvertir();
    }
  };

  const handleClose = () => { setRecibo(null); setOmitirInventario(false); onClose(); };

  const metodosDisponibles = linkPagoConfig
    ? [...METODOS_PAGO, { value: 'Link de Pago', label: 'Link de Pago / QR', icon: <Receipt /> }]
    : METODOS_PAGO;

  if (recibo) return <ReciboDialog open={open} onClose={handleClose} venta={recibo} empresa={empresa} vendedor={vendedor} />;

  return (
    <>
      <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 4 } }}>
        <DialogTitle sx={{ pb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Avatar sx={{ bgcolor: alpha('#059669', 0.12), width: 42, height: 42 }}>
              <AttachMoney sx={{ color: '#059669', fontSize: 22 }} />
            </Avatar>
            <Box>
              <Typography fontWeight={800} fontSize={15}>Forma de pago</Typography>
              <Typography fontSize={12} color="text.secondary">Pedido #{pedido?.numero_pedido ?? pedido?.id} · {fmt(totalConIva || pedido?.total || 0)}</Typography>
            </Box>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Typography fontSize={13} color="text.secondary" sx={{ mb: 2.5 }}>
            Selecciona cómo pagó el cliente para registrar la venta y generar el comprobante.
          </Typography>
          <Stack spacing={1.5}>
            {metodosDisponibles.map(m => {
              const sel = metodo === m.value;
              return (
                <Box
                  key={m.value}
                  onClick={() => setMetodo(m.value)}
                  sx={{
                    display: 'flex', alignItems: 'center', gap: 1.5,
                    p: 1.5, borderRadius: 2.5, cursor: 'pointer', transition: 'all 0.15s',
                    border: `2px solid ${sel ? '#059669' : alpha(theme.palette.divider, 1)}`,
                    bgcolor: sel ? alpha('#059669', 0.06) : 'transparent',
                    '&:hover': { border: `2px solid ${sel ? '#059669' : alpha('#059669', 0.4)}` },
                  }}
                >
                  <Box sx={{ width: 36, height: 36, borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: alpha('#059669', sel ? 0.15 : 0.07), color: '#059669' }}>
                    {m.icon}
                  </Box>
                  <Typography fontWeight={700} fontSize={14} color={sel ? '#059669' : 'text.primary'}>{m.label}</Typography>
                  {sel && <Box sx={{ ml: 'auto' }}><CheckCircle sx={{ color: '#059669', fontSize: 20 }} /></Box>}
                </Box>
              );
            })}
          </Stack>
          {/* Selector IVA */}
          <Box sx={{ mt: 2.5 }}>
            <Typography fontSize={12} fontWeight={700} color="text.secondary" sx={{ mb: 1, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              IVA
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              {[0, 5, 19].map(pct => (
                <Box
                  key={pct}
                  onClick={() => setIvaPct(pct)}
                  sx={{
                    flex: 1, py: 1, borderRadius: 2, textAlign: 'center', cursor: 'pointer',
                    border: '2px solid', transition: 'all 0.15s',
                    borderColor: ivaPct === pct ? '#059669' : 'divider',
                    bgcolor: ivaPct === pct ? alpha('#059669', 0.08) : 'transparent',
                  }}
                >
                  <Typography fontSize={13} fontWeight={700} color={ivaPct === pct ? '#059669' : 'text.secondary'}>
                    {pct === 0 ? 'Exento' : `+${pct}%`}
                  </Typography>
                </Box>
              ))}
            </Box>
            {ivaPct > 0 && (
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1, px: 0.5 }}>
                <Typography fontSize={11} color="text.secondary">Base: {fmt(pedido?.total || 0)}</Typography>
                <Typography fontSize={11} color="text.secondary">IVA {ivaPct}%: {fmt(ivaTotal)}</Typography>
                <Typography fontSize={12} fontWeight={800} color="#059669">Total: {fmt(totalConIva)}</Typography>
              </Box>
            )}
          </Box>

          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={omitirInventario}
                  onChange={e => setOmitirInventario(e.target.checked)}
                  size="small"
                  sx={{
                    '& .MuiSwitch-switchBase.Mui-checked': { color: '#F59E0B' },
                    '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: '#F59E0B' },
                  }}
                />
              }
              label={
                <Typography fontSize={11} fontWeight={omitirInventario ? 700 : 400} color={omitirInventario ? '#92400E' : 'text.secondary'}>
                  Vender sin validar stock
                </Typography>
              }
              sx={{ m: 0, gap: 0.5 }}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button onClick={handleClose} sx={{ borderRadius: 2 }}>Cancelar</Button>
          <Button variant="contained" onClick={handleConfirm} disabled={loading}
            startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <Receipt />}
            sx={{ bgcolor: '#059669', '&:hover': { bgcolor: '#047857' }, borderRadius: 2, fontWeight: 700, flex: 1 }}>
            Registrar y ver comprobante
          </Button>
        </DialogActions>
      </Dialog>

      {linkPagoConfig && (
        <LinkPagoModal
          open={linkPagoModalOpen}
          onClose={() => setLinkPagoModalOpen(false)}
          linkConfig={linkPagoConfig}
          onConfirm={() => { setLinkPagoModalOpen(false); doConvertir(); }}
        />
      )}
    </>
  );
};

// ─── CancelDialog ─────────────────────────────────────────────────────────────

const CancelDialog = ({ open, onClose, pedido, onSuccess }) => {
  const [motivo, setMotivo] = useState('');
  const [loading, setLoading] = useState(false);
  const [waUrl, setWaUrl] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => { if (open) { setMotivo(''); setDone(false); setWaUrl(''); } }, [open]);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await apiClient.patch(`/pedidos-virtuales/${pedido.id}/estado`, { estado: 'cancelado', motivo_cancelacion: motivo });
      const msg = `Hola ${pedido.nombre_cliente} 👋\n\nLamentamos informarte que tu *Pedido #${pedido.numero_pedido ?? pedido.id}* ha sido *cancelado*.${motivo ? `\n\n📝 Motivo: ${motivo}` : ''}\n\n¿Tienes alguna pregunta? Estamos para ayudarte. 🙏`;
      const res = await apiClient.post(`/pedidos-virtuales/${pedido.id}/whatsapp`, { mensaje: msg });
      setWaUrl(res.data.url);
      setDone(true);
      onSuccess();
      toast.success('Pedido cancelado');
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Error al cancelar');
    } finally { setLoading(false); }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 4 } }}>
      {done ? (
        <>
          <DialogTitle sx={{ pb: 0.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Avatar sx={{ bgcolor: alpha('#EF4444', 0.1), width: 36, height: 36 }}>
                <Cancel sx={{ color: '#EF4444', fontSize: 18 }} />
              </Avatar>
              <Typography fontWeight={800}>Pedido cancelado</Typography>
            </Box>
          </DialogTitle>
          <DialogContent>
            <Typography fontSize={13} color="text.secondary">¿Deseas notificar al cliente por WhatsApp?</Typography>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
            <Button onClick={onClose} sx={{ borderRadius: 2 }}>No, gracias</Button>
            <Button variant="contained" onClick={() => { window.open(waUrl, '_blank'); onClose(); }}
              startIcon={<WhatsApp />}
              sx={{ bgcolor: '#25D366', '&:hover': { bgcolor: '#128C7E' }, borderRadius: 2, fontWeight: 700 }}>
              Notificar por WhatsApp
            </Button>
          </DialogActions>
        </>
      ) : (
        <>
          <DialogTitle sx={{ pb: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Avatar sx={{ bgcolor: alpha('#EF4444', 0.1), width: 42, height: 42 }}>
                <Warning sx={{ color: '#EF4444' }} />
              </Avatar>
              <Box>
                <Typography fontWeight={800} fontSize={15}>Cancelar pedido</Typography>
                <Typography fontSize={12} color="text.secondary">#{pedido?.numero_pedido ?? pedido?.id} · {pedido?.nombre_cliente}</Typography>
              </Box>
            </Box>
          </DialogTitle>
          <DialogContent sx={{ pt: 1 }}>
            <Alert severity="warning" sx={{ borderRadius: 2, mb: 2, fontSize: 12 }}>
              Acción irreversible. El stock se restaurará si ya fue descontado.
            </Alert>
            <TextField label="Motivo de cancelación (opcional)" fullWidth multiline rows={3}
              value={motivo} onChange={e => setMotivo(e.target.value)}
              placeholder="Ej: Cliente solicitó cancelar, producto sin stock..."
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }} />
            <Typography fontSize={11} color="text.secondary" sx={{ mt: 0.8 }}>
              El motivo se incluirá en el mensaje de WhatsApp al cliente.
            </Typography>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
            <Button onClick={onClose} sx={{ borderRadius: 2 }}>No cancelar</Button>
            <Button variant="contained" onClick={handleConfirm} disabled={loading}
              startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <Cancel />}
              sx={{ bgcolor: '#EF4444', '&:hover': { bgcolor: '#DC2626' }, borderRadius: 2, fontWeight: 700 }}>
              Sí, cancelar pedido
            </Button>
          </DialogActions>
        </>
      )}
    </Dialog>
  );
};

// ─── EditDialog ───────────────────────────────────────────────────────────────

const EditDialog = ({ open, onClose, pedido, onSuccess }) => {
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (pedido && open) setForm({
      nombre_cliente: pedido.nombre_cliente || '', celular_cliente: pedido.celular_cliente || '',
      email_cliente: pedido.email_cliente || '', tipo_entrega: pedido.tipo_entrega || 'tienda',
      direccion_entrega: pedido.direccion_entrega || '', comentarios: pedido.comentarios || '',
      notas_internas: pedido.notas_internas || '',
    });
  }, [pedido, open]);

  const set = (f) => (e) => setForm(prev => ({ ...prev, [f]: e.target.value }));

  const handleSave = async () => {
    setLoading(true);
    try {
      const res = await apiClient.patch(`/pedidos-virtuales/${pedido.id}`, form);
      onSuccess(res.data); toast.success('Pedido actualizado'); onClose();
    } catch (err) { toast.error(err?.response?.data?.detail || 'Error al actualizar'); }
    finally { setLoading(false); }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 4 } }}>
      <DialogTitle sx={{ pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Avatar sx={{ bgcolor: alpha('#7C3AED', 0.1), width: 40, height: 40 }}>
              <Edit sx={{ color: '#7C3AED', fontSize: 20 }} />
            </Avatar>
            <Box>
              <Typography fontWeight={800} fontSize={15}>Editar pedido #{pedido?.numero_pedido ?? pedido?.id}</Typography>
              <Typography fontSize={12} color="text.secondary">Información de contacto y entrega</Typography>
            </Box>
          </Box>
          <IconButton size="small" onClick={onClose}><Close fontSize="small" /></IconButton>
        </Box>
      </DialogTitle>
      <DialogContent sx={{ pt: 1.5 }}>
        <Stack spacing={2}>
          <Stack direction="row" spacing={1.5}>
            <TextField label="Nombre cliente" size="small" fullWidth value={form.nombre_cliente || ''} onChange={set('nombre_cliente')}
              InputProps={{ startAdornment: <InputAdornment position="start"><Person sx={{ fontSize: 16, color: 'text.secondary' }} /></InputAdornment> }}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }} />
            <TextField label="Celular" size="small" fullWidth value={form.celular_cliente || ''} onChange={set('celular_cliente')}
              InputProps={{ startAdornment: <InputAdornment position="start"><Phone sx={{ fontSize: 16, color: 'text.secondary' }} /></InputAdornment> }}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }} />
          </Stack>
          <TextField label="Email (opcional)" size="small" fullWidth value={form.email_cliente || ''} onChange={set('email_cliente')}
            InputProps={{ startAdornment: <InputAdornment position="start"><Email sx={{ fontSize: 16, color: 'text.secondary' }} /></InputAdornment> }}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }} />
          <Stack direction="row" spacing={1.5}>
            <TextField select label="Tipo entrega" size="small" fullWidth value={form.tipo_entrega || 'tienda'} onChange={set('tipo_entrega')}
              SelectProps={{ native: true }} sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}>
              <option value="tienda">Recoge en tienda</option>
              <option value="domicilio">Domicilio</option>
            </TextField>
            {form.tipo_entrega === 'domicilio' && (
              <TextField label="Dirección" size="small" fullWidth value={form.direccion_entrega || ''} onChange={set('direccion_entrega')}
                InputProps={{ startAdornment: <InputAdornment position="start"><LocationOn sx={{ fontSize: 16, color: 'text.secondary' }} /></InputAdornment> }}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }} />
            )}
          </Stack>
          <TextField label="Comentarios del cliente" size="small" fullWidth multiline rows={2} value={form.comentarios || ''} onChange={set('comentarios')} sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }} />
          <TextField label="Notas internas (solo equipo)" size="small" fullWidth multiline rows={2} value={form.notas_internas || ''} onChange={set('notas_internas')} sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }} />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
        <Button onClick={onClose} sx={{ borderRadius: 2 }}>Cancelar</Button>
        <Button variant="contained" onClick={handleSave} disabled={loading}
          startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <Done />}
          sx={{ borderRadius: 2, fontWeight: 700 }}>Guardar cambios</Button>
      </DialogActions>
    </Dialog>
  );
};

// ─── WADialog ─────────────────────────────────────────────────────────────────

const WADialog = ({ open, onClose, pedido }) => {
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!pedido) return;
    const estado = getEstadoMeta(pedido.estado)?.label || pedido.estado;
    setMsg(`Hola ${pedido.nombre_cliente} 👋\n\nTe escribimos sobre tu *Pedido #${pedido.numero_pedido ?? pedido.id}*.\n\nEstado actual: *${estado}*\n\n¿Tienes alguna pregunta? Estamos aquí para ayudarte.`);
  }, [pedido]);

  const handleSend = async () => {
    if (!msg.trim() || !pedido) return;
    setLoading(true);
    try {
      const res = await apiClient.post(`/pedidos-virtuales/${pedido.id}/whatsapp`, { mensaje: msg });
      window.open(res.data.url, '_blank'); onClose();
    } catch { toast.error('Error al generar el enlace'); }
    finally { setLoading(false); }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 4 } }}>
      <DialogTitle sx={{ pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Avatar sx={{ bgcolor: '#25D366', width: 38, height: 38 }}><WhatsApp sx={{ fontSize: 20 }} /></Avatar>
          <Box>
            <Typography fontWeight={800} fontSize={15}>Mensaje WhatsApp</Typography>
            <Typography fontSize={12} color="text.secondary">{pedido?.nombre_cliente} · {pedido?.celular_cliente}</Typography>
          </Box>
        </Box>
      </DialogTitle>
      <DialogContent>
        <TextField fullWidth multiline rows={6} value={msg} onChange={e => setMsg(e.target.value)}
          placeholder="Escribe el mensaje..." sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2, fontFamily: 'monospace', fontSize: 13 } }} />
        <Typography fontSize={11} color="text.secondary" sx={{ mt: 1 }}>
          Se abrirá WhatsApp Web con este mensaje listo para enviar.
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose} sx={{ borderRadius: 2 }}>Cancelar</Button>
        <Button variant="contained" onClick={handleSend} disabled={loading || !msg.trim()}
          startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <WhatsApp />}
          sx={{ bgcolor: '#25D366', '&:hover': { bgcolor: '#128C7E' }, borderRadius: 2, fontWeight: 700 }}>
          Abrir WhatsApp
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ─── DetailDialog ─────────────────────────────────────────────────────────────

const DETAIL_ACTIONS = {
  nuevo:          [{ estado: 'confirmado',     label: 'Confirmar',     color: '#059669', icon: <CheckCircle /> }],
  confirmado:     [{ estado: 'en_preparacion', label: 'En preparación',color: '#D97706', icon: <Inventory2 /> }],
  en_preparacion: [{ estado: 'enviado',        label: 'Listo/Enviado', color: '#7C3AED', icon: <LocalShipping /> }],
  enviado: [], entregado: [], cancelado: [],
};

const DetailDialog = ({ open, onClose, pedido, empresa, vendedor, onStateChange, onEdit, onCancel, onConvertir, linkPagoConfig }) => {
  const theme = useTheme();
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [changingState, setChangingState] = useState(false);
  if (!pedido) return null;

  const isEntregado = pedido.estado === 'entregado';
  const isCancelado = pedido.estado === 'cancelado';
  const canConvertir = !pedido.venta_id && !isCancelado && ['confirmado', 'en_preparacion', 'enviado', 'entregado'].includes(pedido.estado);

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 4, overflow: 'hidden' } }}>
        {/* Header with color strip */}
        <Box sx={{ height: 4, bgcolor: getEstadoMeta(pedido.estado).color }} />
        <DialogTitle sx={{ pb: 0, pt: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Avatar sx={{ bgcolor: alpha('#0891B2', 0.12), width: 42, height: 42, fontSize: 13, fontWeight: 900, color: '#0891B2' }}>
                #{pedido.numero_pedido ?? pedido.id}
              </Avatar>
              <Box>
                <Typography fontWeight={800} fontSize={16}>{pedido.nombre_cliente}</Typography>
                <EstadoChip estado={pedido.estado} />
              </Box>
            </Box>
            <Box sx={{ display: 'flex', gap: 0.5 }}>
              {!isEntregado && !isCancelado && (
                <Tooltip title="Editar pedido">
                  <IconButton size="small" onClick={() => { onClose(); onEdit(pedido); }}>
                    <Edit fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
              <IconButton size="small" onClick={onClose}><Close fontSize="small" /></IconButton>
            </Box>
          </Box>
        </DialogTitle>

        {/* State timeline */}
        <Box sx={{ px: 3, pt: 0.5, pb: 0 }}>
          <StateTimeline estado={pedido.estado} />
        </Box>

        <DialogContent sx={{ pt: 1.5 }}>
          {/* Client info */}
          <Box sx={{ bgcolor: theme.palette.mode === 'dark' ? alpha('#fff', 0.04) : alpha('#000', 0.03), borderRadius: 2.5, p: 1.5, mb: 2 }}>
            <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
              <Tooltip title="Copiar número">
                <Box onClick={() => copyToClipboard(pedido.celular_cliente)}
                  sx={{ display: 'flex', alignItems: 'center', gap: 0.6, cursor: 'pointer', '&:hover': { color: 'primary.main' } }}>
                  <Phone sx={{ fontSize: 14, color: 'text.secondary' }} />
                  <Typography fontSize={13} fontWeight={600}>{pedido.celular_cliente}</Typography>
                  <ContentCopy sx={{ fontSize: 12, color: 'text.disabled', ml: 0.2 }} />
                </Box>
              </Tooltip>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
                <LocalShipping sx={{ fontSize: 14, color: 'text.secondary' }} />
                <Typography fontSize={13}>{pedido.tipo_entrega === 'domicilio' ? 'Domicilio' : 'Recoge en tienda'}</Typography>
              </Box>
              {pedido.direccion_entrega && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
                  <LocationOn sx={{ fontSize: 14, color: 'text.secondary' }} />
                  <Typography fontSize={13}>{pedido.direccion_entrega}</Typography>
                </Box>
              )}
            </Stack>
            {pedido.comentarios && (
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.6, mt: 1, pt: 1, borderTop: `1px solid ${theme.palette.divider}` }}>
                <Comment sx={{ fontSize: 14, color: 'text.secondary', mt: 0.2 }} />
                <Typography fontSize={12} color="text.secondary" sx={{ fontStyle: 'italic' }}>"{pedido.comentarios}"</Typography>
              </Box>
            )}
          </Box>

          {/* Products */}
          <Typography fontSize={11} fontWeight={800} color="text.secondary" sx={{ mb: 1, textTransform: 'uppercase', letterSpacing: 0.6 }}>
            Productos ({pedido.detalles?.length || 0})
          </Typography>
          <Box sx={{ mb: 2 }}>
            {(pedido.detalles || []).map((d, i) => (
              <Box key={i} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 0.9, borderBottom: i < pedido.detalles.length - 1 ? `1px solid ${theme.palette.divider}` : 'none' }}>
                <Box>
                  <Typography fontSize={13} fontWeight={600}>
                    {d.nombre_producto}
                    {d.nombre_variante && <Typography component="span" fontSize={12} fontWeight={600} color="#0891B2"> · {d.nombre_variante}</Typography>}
                  </Typography>
                  <Typography fontSize={11} color="text.secondary">{fmt(d.precio_unitario)} × {d.cantidad} uds.</Typography>
                </Box>
                <Typography fontSize={13} fontWeight={700} color="#0891B2">{fmt(d.subtotal)}</Typography>
              </Box>
            ))}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1.5, pt: 1.5, borderTop: `2px solid ${theme.palette.divider}` }}>
              <Typography fontWeight={700}>Total del pedido</Typography>
              <Typography fontWeight={900} fontSize={17} color="#0891B2">{fmt(pedido.total)}</Typography>
            </Box>
          </Box>

          {pedido.venta_id && (
            <Alert severity="success" sx={{ borderRadius: 2, mb: 1, fontSize: 12 }}>
              ✅ Venta #{pedido.venta_id} registrada — visible en reportes financieros.
            </Alert>
          )}
          {pedido.notas_internas && (
            <Alert severity="info" icon={false} sx={{ borderRadius: 2, fontSize: 12 }}>
              <Typography fontSize={11} fontWeight={700} color="text.secondary" sx={{ mb: 0.3 }}>NOTA INTERNA</Typography>
              {pedido.notas_internas}
            </Alert>
          )}
        </DialogContent>

        <DialogActions sx={{ px: 2.5, pb: 2.5, flexWrap: 'wrap', gap: 1 }}>
          <Button size="small" startIcon={<WhatsApp />} onClick={() => { onClose(); onStateChange('_wa', pedido); }}
            sx={{ borderRadius: 2, color: '#25D366', border: `1px solid ${alpha('#25D366', 0.4)}` }}>
            WhatsApp
          </Button>
          {pedido.estado === 'enviado' && !pedido.venta_id && (
            <Button size="small" variant="contained" startIcon={<AttachMoney />} onClick={() => setPaymentOpen(true)}
              sx={{ bgcolor: '#059669', '&:hover': { bgcolor: '#047857' }, borderRadius: 2, fontWeight: 700 }}>
              Entregar y Cobrar
            </Button>
          )}
          {canConvertir && pedido.estado !== 'enviado' && (
            <Button size="small" startIcon={<Receipt />} onClick={() => setPaymentOpen(true)}
              sx={{ borderRadius: 2, color: '#7C3AED', border: `1px solid ${alpha('#7C3AED', 0.4)}` }}>
              Convertir a Venta
            </Button>
          )}
          <Box sx={{ flex: 1 }} />
          {(DETAIL_ACTIONS[pedido.estado] || []).map(a => (
            <Button key={a.estado} size="small" variant="contained" disabled={changingState}
              startIcon={changingState ? <CircularProgress size={14} color="inherit" /> : a.icon}
              onClick={async () => {
                if (changingState) return;
                setChangingState(true);
                try {
                  await onStateChange(a.estado, pedido);
                  onClose();
                } catch {
                  // el toast de error ya lo muestra handleStateChange — dejamos el diálogo abierto
                } finally {
                  setChangingState(false);
                }
              }}
              endIcon={<ArrowForward sx={{ fontSize: 14 }} />}
              sx={{ bgcolor: a.color, '&:hover': { filter: 'brightness(0.9)' }, borderRadius: 2, fontWeight: 700 }}>
              {a.label}
            </Button>
          ))}
          {!isEntregado && !isCancelado && (
            <Button size="small" startIcon={<Cancel />} onClick={() => { onClose(); onCancel(pedido); }}
              sx={{ borderRadius: 2, color: '#EF4444', border: `1px solid ${alpha('#EF4444', 0.35)}` }}>
              Cancelar
            </Button>
          )}
        </DialogActions>
      </Dialog>

      <PaymentDialog open={paymentOpen} onClose={() => setPaymentOpen(false)}
        pedido={pedido} empresa={empresa} vendedor={vendedor} linkPagoConfig={linkPagoConfig}
        onSuccess={(updated) => { setPaymentOpen(false); onConvertir(updated); onClose(); }} />
    </>
  );
};

// ─── PedidoCard ───────────────────────────────────────────────────────────────

const PedidoCard = React.memo(function PedidoCard({ pedido, empresa, vendedor, onStateChange, onCancel, onConvertir, onWhatsApp, onEdit, onDetail, onComprobante, linkPagoConfig }) {
  const theme = useTheme();
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [justUpdated, setJustUpdated] = useState(false);
  // Evita doble-clic en la acción principal (ej. "Confirmar" dos veces con
  // conexión lenta) y resalta la tarjeta en rojo si la acción falla, ya que
  // el toast solo puede pasar desapercibido para un empleado que ya siguió
  // con el siguiente pedido.
  const [changingState, setChangingState] = useState(false);
  const [errorFlash, setErrorFlash] = useState(false);
  const meta = getEstadoMeta(pedido.estado);
  const isEntregado = pedido.estado === 'entregado';
  const isCancelado = pedido.estado === 'cancelado';
  const mins = minutesAgo(pedido.fecha_creacion);
  const isUrgente = pedido.estado === 'nuevo' && mins > 45;
  const isReciente = mins < 5;
  const quickAction = QUICK_ACTIONS[pedido.estado];

  return (
    <>
      <Card
        elevation={0}
        sx={{
          borderRadius: 3,
          border: `1px solid ${errorFlash ? '#EF4444' : alpha(meta.color, isUrgente ? 0.5 : 0.15)}`,
          borderLeft: `4px solid ${errorFlash ? '#EF4444' : meta.color}`,
          bgcolor: theme.palette.background.paper,
          transition: 'all 0.2s',
          position: 'relative',
          overflow: 'visible',
          ...(isUrgente && {
            '@keyframes urgentGlow': {
              '0%, 100%': { boxShadow: `0 0 0 0 ${alpha(meta.color, 0)}` },
              '50%': { boxShadow: `0 0 0 4px ${alpha(meta.color, 0.15)}` },
            },
            animation: 'urgentGlow 2s ease-in-out infinite',
          }),
          ...(justUpdated && {
            '@keyframes highlight': { '0%': { bgcolor: alpha(meta.color, 0.2) }, '100%': {} },
            animation: 'highlight 0.8s ease-out',
          }),
          ...(errorFlash && {
            '@keyframes errorShake': {
              '0%, 100%': { transform: 'translateX(0)' },
              '25%': { transform: 'translateX(-4px)' },
              '75%': { transform: 'translateX(4px)' },
            },
            animation: 'errorShake 0.3s ease-in-out 2',
          }),
          '&:hover': {
            borderColor: alpha(meta.color, 0.45),
            boxShadow: `0 6px 24px ${alpha(meta.color, 0.1)}`,
            transform: 'translateY(-2px)',
          },
        }}
      >
        {/* Urgency badge */}
        {isUrgente && (
          <Tooltip title={`Sin confirmar hace ${mins}min — requiere atención`}>
            <Box sx={{
              position: 'absolute', top: -6, right: 10,
              bgcolor: '#EF4444', color: '#fff',
              fontSize: 9, fontWeight: 800,
              px: 1, py: 0.3, borderRadius: 4,
              display: 'flex', alignItems: 'center', gap: 0.4,
              boxShadow: `0 2px 8px ${alpha('#EF4444', 0.4)}`,
              '@keyframes urgentBadge': { '0%,100%': { transform: 'scale(1)' }, '50%': { transform: 'scale(1.05)' } },
              animation: 'urgentBadge 1.5s ease-in-out infinite',
            }}>
              <HourglassEmpty sx={{ fontSize: 9 }} />
              URGENTE
            </Box>
          </Tooltip>
        )}

        {/* New badge */}
        {isReciente && pedido.estado === 'nuevo' && (
          <Box sx={{
            position: 'absolute', top: -6, right: isUrgente ? 80 : 10,
            bgcolor: '#2563EB', color: '#fff',
            fontSize: 9, fontWeight: 800,
            px: 1, py: 0.3, borderRadius: 4,
          }}>
            NUEVO
          </Box>
        )}

        <Box sx={{ p: 2 }}>
          {/* Header row */}
          <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 1.2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, minWidth: 0 }}>
              <Typography sx={{ fontSize: 10, fontWeight: 700, color: 'text.disabled', flexShrink: 0 }}>#{pedido.numero_pedido ?? pedido.id}</Typography>
              <Typography fontWeight={700} fontSize={14} noWrap sx={{ maxWidth: { xs: 130, sm: 150 } }}>
                {pedido.nombre_cliente}
              </Typography>
            </Box>
            <EstadoChip estado={pedido.estado} />
          </Box>

          {/* Contact + delivery */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5, flexWrap: 'wrap' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4 }}>
              <Phone sx={{ fontSize: 12, color: 'text.disabled' }} />
              <Typography fontSize={11} color="text.secondary">{pedido.celular_cliente}</Typography>
            </Box>
            <Chip
              size="small"
              label={pedido.tipo_entrega === 'domicilio' ? '🛵 Domicilio' : '🏪 Tienda'}
              sx={{
                height: 18, fontSize: 10, fontWeight: 600, borderRadius: 1,
                bgcolor: pedido.tipo_entrega === 'domicilio' ? alpha('#7C3AED', 0.1) : alpha('#059669', 0.1),
                color: pedido.tipo_entrega === 'domicilio' ? '#7C3AED' : '#059669',
              }}
            />
          </Box>

          {/* Products */}
          <Box sx={{ bgcolor: theme.palette.mode === 'dark' ? alpha('#fff', 0.03) : alpha('#000', 0.025), borderRadius: 2, p: 1, mb: 1.5, minHeight: 44 }}>
            {(pedido.detalles || []).slice(0, 2).map((d, i) => (
              <Box key={i} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography fontSize={11} color="text.secondary" noWrap sx={{ flex: 1 }}>
                  <b style={{ color: 'inherit' }}>{d.cantidad}×</b> {d.nombre_producto}{d.nombre_variante ? ` (${d.nombre_variante})` : ''}
                </Typography>
                <Typography fontSize={11} color="text.disabled" sx={{ ml: 0.5, flexShrink: 0 }}>{fmt(d.subtotal)}</Typography>
              </Box>
            ))}
            {(pedido.detalles?.length || 0) > 2 && (
              <Typography fontSize={10} color="text.disabled" sx={{ mt: 0.3 }}>
                +{pedido.detalles.length - 2} producto{pedido.detalles.length - 2 > 1 ? 's' : ''} más
              </Typography>
            )}
          </Box>

          {/* Total + time */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4 }}>
              <AccessTime sx={{ fontSize: 11, color: isUrgente ? '#EF4444' : 'text.disabled' }} />
              <Typography fontSize={11} color={isUrgente ? '#EF4444' : 'text.disabled'} fontWeight={isUrgente ? 700 : 400}>
                {timeAgo(pedido.fecha_creacion)}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.4 }}>
              {pedido.venta_id && <Chip label={`V#${pedido.venta_id}`} size="small" sx={{ fontSize: 9, height: 16, bgcolor: alpha('#059669', 0.1), color: '#059669', mr: 0.5 }} />}
              <Typography fontSize={16} fontWeight={900} color="#0891B2">{fmt(pedido.total)}</Typography>
            </Box>
          </Box>

          <Divider sx={{ mb: 1.5 }} />

          {/* Actions */}
          <Box sx={{ display: 'flex', gap: 0.7, alignItems: 'center' }}>
            {/* Detail */}
            <Button size="small" variant="outlined" onClick={() => onDetail(pedido)}
              sx={{ borderRadius: 2, fontSize: 11, flex: 1, minWidth: 0, py: 0.5 }}>
              Detalle
            </Button>

            {/* WhatsApp */}
            <Tooltip title="Enviar WhatsApp">
              <IconButton size="small" onClick={() => onWhatsApp(pedido)}
                sx={{ borderRadius: 2, border: `1px solid ${alpha('#25D366', 0.4)}`, color: '#25D366', width: 30, height: 30 }}>
                <WhatsApp sx={{ fontSize: 15 }} />
              </IconButton>
            </Tooltip>

            {/* Edit */}
            {!isEntregado && !isCancelado && (
              <Tooltip title="Editar pedido">
                <IconButton size="small" onClick={() => onEdit(pedido)}
                  sx={{ borderRadius: 2, border: `1px solid ${theme.palette.divider}`, color: 'text.secondary', width: 30, height: 30 }}>
                  <Edit sx={{ fontSize: 15 }} />
                </IconButton>
              </Tooltip>
            )}

            {/* Primary action */}
            {quickAction && (
              <Button size="small" variant="contained" disabled={changingState}
                startIcon={changingState ? <CircularProgress size={14} color="inherit" /> : quickAction.icon}
                onClick={async () => {
                  if (changingState) return;
                  if (quickAction.next === '_pay') { setPaymentOpen(true); return; }
                  setChangingState(true);
                  try {
                    await onStateChange(quickAction.next, pedido);
                  } catch {
                    setErrorFlash(true);
                    setTimeout(() => setErrorFlash(false), 900);
                  } finally {
                    setChangingState(false);
                  }
                }}
                sx={{ bgcolor: quickAction.color, '&:hover': { filter: 'brightness(0.9)' }, borderRadius: 2, fontSize: 11, fontWeight: 700, flex: 2, py: 0.5 }}>
                {quickAction.label}
              </Button>
            )}

            {/* Cancel */}
            {!isEntregado && !isCancelado && (
              <Tooltip title="Cancelar pedido">
                <IconButton size="small" onClick={() => onCancel(pedido)}
                  sx={{ borderRadius: 2, border: `1px solid ${alpha('#EF4444', 0.3)}`, color: '#EF4444', width: 30, height: 30 }}>
                  <Cancel sx={{ fontSize: 15 }} />
                </IconButton>
              </Tooltip>
            )}

            {/* Receipt for delivered */}
            {isEntregado && pedido.venta_id && (
              <Tooltip title="Ver comprobante de venta">
                <IconButton size="small" onClick={() => onComprobante(pedido)}
                  sx={{ borderRadius: 2, border: `1px solid ${alpha('#059669', 0.4)}`, color: '#059669', width: 30, height: 30 }}>
                  <Receipt sx={{ fontSize: 15 }} />
                </IconButton>
              </Tooltip>
            )}
          </Box>
        </Box>
      </Card>

      <PaymentDialog open={paymentOpen} onClose={() => setPaymentOpen(false)}
        pedido={pedido} empresa={empresa} vendedor={vendedor} linkPagoConfig={linkPagoConfig}
        onSuccess={(updated) => { setPaymentOpen(false); onConvertir(updated); setJustUpdated(true); setTimeout(() => setJustUpdated(false), 1000); }} />
    </>
  );
});

// ─── ListView row ─────────────────────────────────────────────────────────────

const ListRow = React.memo(function ListRow({ pedido, empresa, vendedor, onStateChange, onCancel, onConvertir, onWhatsApp, onEdit, onDetail, onComprobante, linkPagoConfig }) {
  const theme = useTheme();
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [changingState, setChangingState] = useState(false);
  const [errorFlash, setErrorFlash] = useState(false);
  const meta = getEstadoMeta(pedido.estado);
  const isEntregado = pedido.estado === 'entregado';
  const isCancelado = pedido.estado === 'cancelado';
  const mins = minutesAgo(pedido.fecha_creacion);
  const isUrgente = pedido.estado === 'nuevo' && mins > 45;
  const quickAction = QUICK_ACTIONS[pedido.estado];

  return (
    <>
      <TableRow hover sx={{ cursor: 'pointer', borderLeft: `3px solid ${errorFlash ? '#EF4444' : meta.color}`, transition: 'border-color 0.2s', '& td': { py: 1.2, fontSize: 12 } }}>
        <TableCell onClick={() => onDetail(pedido)} sx={{ width: 60 }}>
          <Typography fontSize={11} color="text.disabled" fontWeight={700}>#{pedido.numero_pedido ?? pedido.id}</Typography>
        </TableCell>
        <TableCell onClick={() => onDetail(pedido)} sx={{ minWidth: 130 }}>
          <Typography fontSize={13} fontWeight={700} noWrap sx={{ maxWidth: 160 }}>{pedido.nombre_cliente}</Typography>
          <Typography fontSize={11} color="text.secondary">{pedido.celular_cliente}</Typography>
        </TableCell>
        <TableCell onClick={() => onDetail(pedido)}>
          <EstadoChip estado={pedido.estado} />
          {isUrgente && <Chip label="urgente" size="small" sx={{ ml: 0.5, fontSize: 9, height: 16, bgcolor: alpha('#EF4444', 0.1), color: '#EF4444', fontWeight: 700 }} />}
        </TableCell>
        <TableCell onClick={() => onDetail(pedido)} sx={{ display: { xs: 'none', md: 'table-cell' } }}>
          <Typography fontSize={11} color="text.secondary">{pedido.detalles?.length || 0} ítems</Typography>
        </TableCell>
        <TableCell onClick={() => onDetail(pedido)} align="right">
          <Typography fontSize={13} fontWeight={800} color="#0891B2">{fmt(pedido.total)}</Typography>
        </TableCell>
        <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>
          <Typography fontSize={11} color={isUrgente ? '#EF4444' : 'text.disabled'}>{timeAgo(pedido.fecha_creacion)}</Typography>
        </TableCell>
        <TableCell align="right" sx={{ width: 180 }}>
          <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end' }}>
            <Tooltip title="WhatsApp">
              <IconButton size="small" onClick={() => onWhatsApp(pedido)} sx={{ color: '#25D366', p: 0.5 }}>
                <WhatsApp sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
            {!isEntregado && !isCancelado && (
              <Tooltip title="Editar">
                <IconButton size="small" onClick={() => onEdit(pedido)} sx={{ color: 'text.secondary', p: 0.5 }}>
                  <Edit sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
            )}
            {quickAction && (
              <Button size="small" variant="contained" disabled={changingState}
                onClick={async () => {
                  if (changingState) return;
                  if (quickAction.next === '_pay') { setPaymentOpen(true); return; }
                  setChangingState(true);
                  try {
                    await onStateChange(quickAction.next, pedido);
                  } catch {
                    setErrorFlash(true);
                    setTimeout(() => setErrorFlash(false), 900);
                  } finally {
                    setChangingState(false);
                  }
                }}
                sx={{ bgcolor: quickAction.color, '&:hover': { filter: 'brightness(0.9)' }, borderRadius: 1.5, fontSize: 10, fontWeight: 700, px: 1, py: 0.3, minWidth: 0 }}>
                {changingState ? <CircularProgress size={12} color="inherit" /> : quickAction.label}
              </Button>
            )}
            {!isEntregado && !isCancelado && (
              <Tooltip title="Cancelar">
                <IconButton size="small" onClick={() => onCancel(pedido)} sx={{ color: '#EF4444', p: 0.5 }}>
                  <Cancel sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
            )}
            {isEntregado && pedido.venta_id && (
              <Tooltip title="Ver comprobante de venta">
                <IconButton size="small" onClick={() => onComprobante(pedido)} sx={{ color: '#059669', p: 0.5 }}>
                  <Receipt sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
            )}
          </Box>
        </TableCell>
      </TableRow>

      <PaymentDialog open={paymentOpen} onClose={() => setPaymentOpen(false)}
        pedido={pedido} empresa={empresa} vendedor={vendedor} linkPagoConfig={linkPagoConfig}
        onSuccess={(updated) => { setPaymentOpen(false); onConvertir(updated); }} />
    </>
  );
});

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PedidosVirtuales({ user }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [pedidos,       setPedidos]       = useState([]);
  const [stats,         setStats]         = useState({});
  const [loading,       setLoading]       = useState(true);
  const [search,        setSearch]        = useState('');
  const [estadoFiltro,  setEstadoFiltro]  = useState('todos');
  const [sort,          setSort]          = useState('newest');
  const [viewMode,      setViewMode]      = useState('grid');
  const [lastFetch,     setLastFetch]     = useState(null);
  const [refreshing,    setRefreshing]    = useState(false);

  const [detailPedido,   setDetailPedido]   = useState(null);
  const [cancelPedido,   setCancelPedido]   = useState(null);
  const [editPedido,     setEditPedido]     = useState(null);
  const [waPedido,       setWaPedido]       = useState(null);
  const [linkPagoConfig, setLinkPagoConfig] = useState(null);
  const [comprobantePedido, setComprobantePedido] = useState(null); // {venta, pedido}

  const empresa = user?.empresa || null;
  const vendedor = user ? (`${user.nombre_completo || ''}`.trim() || user.username || user.email) : '';

  // Evita solicitudes GET solapadas cuando un tick del polling cae mientras
  // otra petición (poll anterior o refresh manual) sigue en vuelo.
  const fetchInFlightRef = useRef(false);
  // null hasta que termine la primera carga — así no se notifican como
  // "nuevos" los pedidos que ya existían al abrir la pantalla.
  const seenNuevoIdsRef = useRef(null);

  const fetchAll = useCallback(async (silent = false) => {
    if (silent && fetchInFlightRef.current) return;
    fetchInFlightRef.current = true;
    if (!silent) setLoading(true); else setRefreshing(true);
    try {
      const [pRes, sRes] = await Promise.all([
        apiClient.get('/pedidos-virtuales/', { params: { estado: estadoFiltro !== 'todos' ? estadoFiltro : undefined, search: search || undefined, limit: 200 } }),
        apiClient.get('/pedidos-virtuales/stats'),
      ]);
      const nuevoIdsNow = new Set(pRes.data.filter(p => p.estado === 'nuevo').map(p => p.id));
      if (seenNuevoIdsRef.current !== null) {
        const arrived = pRes.data.filter(p => p.estado === 'nuevo' && !seenNuevoIdsRef.current.has(p.id));
        if (arrived.length === 1) {
          toast.info(`🛎️ Nuevo pedido de ${arrived[0].nombre_cliente} — ${fmt(arrived[0].total)}`, { autoClose: 8000 });
        } else if (arrived.length > 1) {
          toast.info(`🛎️ ${arrived.length} pedidos nuevos recibidos`, { autoClose: 8000 });
        }
      }
      seenNuevoIdsRef.current = nuevoIdsNow;
      setPedidos(pRes.data);
      setStats(sRes.data);
      setLastFetch(new Date());
    } catch { toast.error('Error al cargar pedidos'); }
    finally { setLoading(false); setRefreshing(false); fetchInFlightRef.current = false; }
  }, [estadoFiltro, search]);

  useEffect(() => {
    const t = setTimeout(() => fetchAll(false), search ? 350 : 0);
    return () => clearTimeout(t);
  }, [fetchAll, search]);

  // Refresco cada 60s; se pausa si la pestaña está oculta.
  usePolling(() => fetchAll(true), 60_000);

  useEffect(() => {
    apiClient.get('/empresa/link-pago').then(r => setLinkPagoConfig(r.data)).catch(() => {});
  }, []);

  // Sort pedidos client-side — los "nuevo" (requieren acción) siempre flotan
  // arriba sin importar el criterio elegido, para que nunca queden enterrados
  // en una lista larga ordenada por "menor valor" o "más antiguo".
  const sortedPedidos = React.useMemo(() => [...pedidos].sort((a, b) => {
    const aNuevo = a.estado === 'nuevo' ? 0 : 1;
    const bNuevo = b.estado === 'nuevo' ? 0 : 1;
    if (aNuevo !== bNuevo) return aNuevo - bNuevo;
    if (sort === 'newest') return new Date(b.fecha_creacion) - new Date(a.fecha_creacion);
    if (sort === 'oldest') return new Date(a.fecha_creacion) - new Date(b.fecha_creacion);
    if (sort === 'highest') return (b.total || 0) - (a.total || 0);
    if (sort === 'lowest')  return (a.total || 0) - (b.total || 0);
    return 0;
  }), [pedidos, sort]);

  const handleStateChange = useCallback(async (estado, pedido) => {
    if (estado === '_wa') { setWaPedido(pedido); return; }
    try {
      const res = await apiClient.patch(`/pedidos-virtuales/${pedido.id}/estado`, { estado });
      setPedidos(prev => prev.map(p => p.id === pedido.id ? res.data : p));
      fetchAll(true);
      toast.success(`→ ${getEstadoMeta(estado).label}`);
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Error al actualizar estado');
      throw err; // el caller (tarjeta/fila) lo captura para resaltar el error visualmente
    }
  }, [fetchAll]);

  const handleConvertir = useCallback((updated) => {
    setPedidos(prev => prev.map(p => p.id === updated.id ? updated : p));
    fetchAll(true);
  }, [fetchAll]);

  const handleEditSuccess = useCallback((updated) => {
    setPedidos(prev => prev.map(p => p.id === updated.id ? updated : p));
    setDetailPedido(prev => (prev?.id === updated.id ? updated : prev));
  }, []);

  const handleComprobante = useCallback(async (pedido) => {
    try {
      const res = await apiClient.get(`/ventas/${pedido.venta_id}`);
      setComprobantePedido({ venta: res.data, pedido });
    } catch {
      toast.error('No se pudo cargar el comprobante de venta');
    }
  }, []);

  const urgentCount = pedidos.filter(p => p.estado === 'nuevo' && minutesAgo(p.fecha_creacion) > 45).length;

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, bgcolor: theme.palette.background.default, minHeight: '100vh' }}>

      {/* ── Header ── */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2.5, flexWrap: 'wrap', gap: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Badge badgeContent={urgentCount > 0 ? urgentCount : 0} color="error" overlap="circular">
            <Avatar sx={{ bgcolor: alpha('#F43F5E', 0.12), width: 46, height: 46 }}>
              <Storefront sx={{ color: '#F43F5E', fontSize: 24 }} />
            </Avatar>
          </Badge>
          <Box>
            <Typography variant="h6" fontWeight={900} lineHeight={1.1}>Pedidos Tienda Virtual</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, mt: 0.2 }}>
              <Box sx={{
                width: 7, height: 7, borderRadius: '50%',
                bgcolor: refreshing ? '#F59E0B' : '#10B981',
                '@keyframes livePulse': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.4 } },
                animation: 'livePulse 2s ease-in-out infinite',
              }} />
              <Typography fontSize={11} color="text.secondary">
                {lastFetch ? `Actualizado ${timeAgo(lastFetch.toISOString())}` : 'Cargando…'}
                {' · '}{stats.total ?? 0} pedidos
              </Typography>
            </Box>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {/* View toggle */}
          <ToggleButtonGroup value={viewMode} exclusive onChange={(_, v) => v && setViewMode(v)} size="small"
            sx={{ '& .MuiToggleButton-root': { px: 1, py: 0.5, borderRadius: 2 } }}>
            <ToggleButton value="grid"><ViewModule fontSize="small" /></ToggleButton>
            <ToggleButton value="list"><ViewList fontSize="small" /></ToggleButton>
          </ToggleButtonGroup>

          <Button variant="outlined" startIcon={refreshing ? <CircularProgress size={14} /> : <Refresh />}
            onClick={() => fetchAll(false)} disabled={refreshing}
            sx={{ borderRadius: 2, fontWeight: 600, fontSize: 12 }}>
            {!isMobile && 'Actualizar'}
          </Button>
        </Box>
      </Box>

      {/* ── Stats filter bar ── */}
      <Box sx={{ mb: 2.5 }}>
        <StatFilterBar stats={stats} filtro={estadoFiltro} onChange={(v) => { setEstadoFiltro(v); }} />
      </Box>

      {/* ── Search + Sort ── */}
      <Box sx={{ display: 'flex', gap: 1, mb: 2.5 }}>
        <TextField
          fullWidth size="small"
          placeholder="Buscar por nombre, celular o #ID…"
          value={search} onChange={e => setSearch(e.target.value)}
          InputProps={{
            startAdornment: <InputAdornment position="start"><Search sx={{ fontSize: 17, color: 'text.secondary' }} /></InputAdornment>,
            endAdornment: search ? (
              <InputAdornment position="end">
                <IconButton size="small" onClick={() => setSearch('')}><Clear sx={{ fontSize: 16 }} /></IconButton>
              </InputAdornment>
            ) : null,
          }}
          sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2.5, bgcolor: theme.palette.background.paper } }}
        />
        <FormControl size="small" sx={{ minWidth: isMobile ? 110 : 145, flexShrink: 0 }}>
          <Select value={sort} onChange={e => setSort(e.target.value)}
            startAdornment={<SortByAlpha sx={{ fontSize: 16, color: 'text.secondary', mr: 0.5 }} />}
            sx={{ borderRadius: 2.5, fontSize: 12 }}>
            {SORT_OPTIONS.map(o => <MenuItem key={o.value} value={o.value} sx={{ fontSize: 12 }}>{o.label}</MenuItem>)}
          </Select>
        </FormControl>
      </Box>

      {/* ── Result count ── */}
      {!loading && search && (
        <Typography fontSize={12} color="text.secondary" sx={{ mb: 1.5 }}>
          {sortedPedidos.length} resultado{sortedPedidos.length !== 1 ? 's' : ''} para "{search}"
        </Typography>
      )}

      {/* ── Content ── */}
      {loading ? (
        // Skeleton grid
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2,1fr)', md: 'repeat(3,1fr)', lg: 'repeat(4,1fr)' }, gap: 2 }}>
          {Array.from({ length: 8 }).map((_, i) => <CardSkeleton key={i} />)}
        </Box>
      ) : sortedPedidos.length === 0 ? (
        <Box sx={{ textAlign: 'center', pt: 10, color: 'text.secondary' }}>
          <ShoppingBag sx={{ fontSize: 56, mb: 2, opacity: 0.18 }} />
          <Typography fontWeight={800} fontSize={16}>
            {search ? 'Sin resultados' : estadoFiltro !== 'todos' ? `Sin pedidos "${getEstadoMeta(estadoFiltro).label}"` : 'Sin pedidos aún'}
          </Typography>
          <Typography fontSize={13} sx={{ mt: 0.5, maxWidth: 320, mx: 'auto' }}>
            {search
              ? 'Intenta con otro nombre, celular o escribe #ID para buscar por número de pedido.'
              : estadoFiltro !== 'todos'
                ? 'No hay pedidos con este estado. Prueba cambiando el filtro.'
                : 'Cuando un cliente haga un pedido desde el catálogo virtual aparecerá aquí automáticamente.'}
          </Typography>
          {(search || estadoFiltro !== 'todos') && (
            <Button size="small" sx={{ mt: 2, borderRadius: 2 }}
              onClick={() => { setSearch(''); setEstadoFiltro('todos'); }}>
              Limpiar filtros
            </Button>
          )}
        </Box>
      ) : viewMode === 'grid' ? (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2,1fr)', md: 'repeat(3,1fr)', lg: 'repeat(4,1fr)' }, gap: 2 }}>
          {sortedPedidos.map(p => (
            <PedidoCard key={p.id} pedido={p} empresa={empresa} vendedor={vendedor}
              onStateChange={handleStateChange} onCancel={setCancelPedido}
              onConvertir={handleConvertir} onWhatsApp={setWaPedido}
              onEdit={setEditPedido} onDetail={setDetailPedido} onComprobante={handleComprobante} linkPagoConfig={linkPagoConfig} />
          ))}
        </Box>
      ) : (
        <Paper elevation={0} sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider', overflow: 'hidden' }}>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: theme.palette.mode === 'dark' ? alpha('#fff', 0.04) : alpha('#000', 0.025) }}>
                  <TableCell sx={{ fontWeight: 700, fontSize: 11 }}>#</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: 11 }}>Cliente</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: 11 }}>Estado</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: 11, display: { xs: 'none', md: 'table-cell' } }}>Ítems</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: 11 }} align="right">Total</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: 11, display: { xs: 'none', sm: 'table-cell' } }}>Hace</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: 11 }} align="right">Acciones</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {sortedPedidos.map(p => (
                  <ListRow key={p.id} pedido={p} empresa={empresa} vendedor={vendedor}
                    onStateChange={handleStateChange} onCancel={setCancelPedido}
                    onConvertir={handleConvertir} onWhatsApp={setWaPedido}
                    onEdit={setEditPedido} onDetail={setDetailPedido} onComprobante={handleComprobante} linkPagoConfig={linkPagoConfig} />
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {/* ── Dialogs ── */}
      <DetailDialog open={!!detailPedido} onClose={() => setDetailPedido(null)} pedido={detailPedido}
        empresa={empresa} vendedor={vendedor} onStateChange={handleStateChange}
        onEdit={p => { setDetailPedido(null); setEditPedido(p); }}
        onCancel={p => { setDetailPedido(null); setCancelPedido(p); }}
        onConvertir={handleConvertir} linkPagoConfig={linkPagoConfig} />

      <CancelDialog open={!!cancelPedido} onClose={() => setCancelPedido(null)}
        pedido={cancelPedido} onSuccess={() => { fetchAll(true); setCancelPedido(null); }} />

      <EditDialog open={!!editPedido} onClose={() => setEditPedido(null)}
        pedido={editPedido} onSuccess={handleEditSuccess} />

      <WADialog open={!!waPedido} onClose={() => setWaPedido(null)} pedido={waPedido} />

      {comprobantePedido && (
        <ReciboDialog
          open={!!comprobantePedido}
          onClose={() => setComprobantePedido(null)}
          venta={comprobantePedido.venta}
          empresa={empresa}
          vendedor={vendedor}
        />
      )}
    </Box>
  );
}
