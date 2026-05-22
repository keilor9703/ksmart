import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Card, Chip, Button, IconButton, TextField,
  Dialog, DialogTitle, DialogContent, DialogActions,
  Avatar, Divider, Tooltip, Alert, CircularProgress,
  InputAdornment, Paper, Stack, useTheme, useMediaQuery,
  ToggleButtonGroup, ToggleButton, alpha,
} from '@mui/material';
import {
  ShoppingBag, Search, WhatsApp, CheckCircle, LocalShipping,
  Cancel, Receipt, Refresh, Phone, LocationOn, Comment,
  Storefront, ErrorOutline, Inventory2, Done, AccessTime,
  Edit, Close, AttachMoney, AccountBalanceWallet, Warning,
  Person, Email,
} from '@mui/icons-material';
import apiClient from '../../api';
import { toast } from 'react-toastify';
import ReciboDialog from '../../components/common/ReciboDialog';

// ─── Constants ────────────────────────────────────────────────────────────────

const ESTADOS_META = [
  { value: 'todos',          label: 'Todos',          color: '#6b7280' },
  { value: 'nuevo',          label: 'Nuevo',          color: '#2563EB' },
  { value: 'confirmado',     label: 'Confirmado',     color: '#059669' },
  { value: 'en_preparacion', label: 'En preparación', color: '#D97706' },
  { value: 'enviado',        label: 'Enviado',        color: '#7C3AED' },
  { value: 'entregado',      label: 'Entregado',      color: '#065f46' },
  { value: 'cancelado',      label: 'Cancelado',      color: '#9ca3af' },
];

const METODOS_PAGO = [
  { value: 'Efectivo',      label: 'Efectivo',      icon: <AttachMoney /> },
  { value: 'Transferencia', label: 'Transferencia', icon: <AccountBalanceWallet /> },
];

const fmt = (val) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(val);

const timeAgo = (dateStr) => {
  if (!dateStr) return '';
  const diff = Math.floor((Date.now() - new Date(dateStr + (dateStr.endsWith('Z') ? '' : 'Z'))) / 1000);
  if (diff < 60)    return `hace ${diff}s`;
  if (diff < 3600)  return `hace ${Math.floor(diff / 60)}min`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)}h`;
  return `hace ${Math.floor(diff / 86400)}d`;
};

const getEstadoMeta = (value) =>
  ESTADOS_META.find(e => e.value === value) || ESTADOS_META[0];

// ─── EstadoChip ───────────────────────────────────────────────────────────────

const EstadoChip = ({ estado }) => {
  const theme = useTheme();
  const meta = getEstadoMeta(estado);
  return (
    <Chip
      label={meta.label}
      size="small"
      sx={{
        bgcolor: alpha(meta.color, theme.palette.mode === 'dark' ? 0.2 : 0.12),
        color: meta.color,
        fontWeight: 700,
        fontSize: 11,
        border: `1px solid ${alpha(meta.color, 0.3)}`,
      }}
    />
  );
};

// ─── StatCard ─────────────────────────────────────────────────────────────────

const StatCard = ({ label, count, color, onClick, active }) => {
  const theme = useTheme();
  return (
    <Paper
      onClick={onClick}
      elevation={0}
      sx={{
        p: '10px 14px', borderRadius: 3, cursor: 'pointer', transition: 'all 0.15s',
        border: `2px solid ${active ? color : 'transparent'}`,
        bgcolor: active
          ? alpha(color, theme.palette.mode === 'dark' ? 0.2 : 0.1)
          : theme.palette.background.default,
        '&:hover': {
          bgcolor: alpha(color, theme.palette.mode === 'dark' ? 0.2 : 0.08),
          border: `2px solid ${alpha(color, 0.4)}`,
        },
        minWidth: 90, textAlign: 'center',
      }}
    >
      <Typography sx={{ fontSize: 22, fontWeight: 900, color, lineHeight: 1 }}>{count}</Typography>
      <Typography sx={{ fontSize: 10, color: 'text.secondary', fontWeight: 600, mt: 0.3 }}>{label}</Typography>
    </Paper>
  );
};

// ─── PaymentDialog ────────────────────────────────────────────────────────────

const PaymentDialog = ({ open, onClose, pedido, empresa, vendedor, onSuccess }) => {
  const theme = useTheme();
  const [metodo, setMetodo] = useState('Efectivo');
  const [loading, setLoading] = useState(false);
  const [recibo, setRecibo] = useState(null);

  const handleConfirm = async () => {
    if (!pedido) return;
    setLoading(true);
    try {
      const res = await apiClient.post(`/pedidos-virtuales/${pedido.id}/convertir-venta`, {
        metodo_pago: metodo,
      });
      const updated = res.data;
      // Build venta snapshot for ReciboDialog
      const ventaSnap = {
        id: updated.venta_id,
        fecha: new Date().toISOString(),
        cliente: { nombre: pedido.nombre_cliente, telefono: pedido.celular_cliente },
        detalles: (pedido.detalles || []).map(d => ({
          producto: { nombre: d.nombre_producto },
          cantidad: d.cantidad,
          precio_unitario: d.precio_unitario,
        })),
        total: pedido.total,
        iva_total: 0,
        iva_porcentaje: 0,
        monto_pagado: pedido.total,
        estado_pago: 'pagado',
        metodo_pago: metodo,
      };
      setRecibo(ventaSnap);
      onSuccess(updated);
      toast.success('¡Pedido convertido a venta exitosamente!');
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Error al convertir el pedido');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setRecibo(null);
    onClose();
  };

  if (recibo) {
    return (
      <ReciboDialog
        open={open}
        onClose={handleClose}
        venta={recibo}
        empresa={empresa}
        vendedor={vendedor}
      />
    );
  }

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth
      PaperProps={{ sx: { borderRadius: 4 } }}>
      <DialogTitle sx={{ pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Avatar sx={{ bgcolor: alpha('#059669', 0.15), width: 40, height: 40 }}>
            <AttachMoney sx={{ color: '#059669' }} />
          </Avatar>
          <Box>
            <Typography fontWeight={800} fontSize={15}>Forma de pago</Typography>
            <Typography fontSize={12} color="text.secondary">
              Pedido #{pedido?.id} · {fmt(pedido?.total || 0)}
            </Typography>
          </Box>
        </Box>
      </DialogTitle>
      <DialogContent sx={{ pt: 1 }}>
        <Typography fontSize={13} color="text.secondary" sx={{ mb: 2 }}>
          Selecciona cómo pagó el cliente para registrar la venta y generar el comprobante.
        </Typography>
        <ToggleButtonGroup
          value={metodo}
          exclusive
          onChange={(_, v) => v && setMetodo(v)}
          fullWidth
          sx={{ gap: 1 }}
        >
          {METODOS_PAGO.map(m => (
            <ToggleButton
              key={m.value}
              value={m.value}
              sx={{
                flex: 1,
                borderRadius: '12px !important',
                border: `2px solid ${metodo === m.value ? '#059669' : alpha(theme.palette.divider, 1)} !important`,
                bgcolor: metodo === m.value ? alpha('#059669', 0.08) : 'transparent',
                color: metodo === m.value ? '#059669' : 'text.secondary',
                fontWeight: 700,
                py: 1.5,
                gap: 1,
                '&.Mui-selected': {
                  bgcolor: alpha('#059669', 0.08),
                  color: '#059669',
                },
              }}
            >
              {m.icon}
              {m.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
        <Button onClick={handleClose} sx={{ borderRadius: 2 }}>Cancelar</Button>
        <Button
          variant="contained"
          onClick={handleConfirm}
          disabled={loading}
          startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <Receipt />}
          sx={{
            bgcolor: '#059669', '&:hover': { bgcolor: '#047857' },
            borderRadius: 2, fontWeight: 700, flex: 1,
          }}
        >
          Registrar y ver comprobante
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ─── CancelDialog ─────────────────────────────────────────────────────────────

const CancelDialog = ({ open, onClose, pedido, onSuccess }) => {
  const [motivo, setMotivo] = useState('');
  const [loading, setLoading] = useState(false);
  const [showWA, setShowWA] = useState(false);
  const [waUrl, setWaUrl] = useState('');

  useEffect(() => { if (open) setMotivo(''); }, [open]);

  const handleConfirm = async () => {
    if (!pedido) return;
    setLoading(true);
    try {
      await apiClient.patch(`/pedidos-virtuales/${pedido.id}/estado`, {
        estado: 'cancelado',
        motivo_cancelacion: motivo,
      });
      // Build WhatsApp cancel URL
      const msg =
        `Hola ${pedido.nombre_cliente} 👋\n\n` +
        `Lamentamos informarte que tu *Pedido #${pedido.id}* ha sido *cancelado*.\n` +
        (motivo ? `\n📝 Motivo: ${motivo}\n` : '') +
        `\n¿Tienes alguna pregunta? Estamos para ayudarte. 🙏`;
      const res = await apiClient.post(`/pedidos-virtuales/${pedido.id}/whatsapp`, { mensaje: msg });
      setWaUrl(res.data.url);
      setShowWA(true);
      onSuccess();
      toast.success('Pedido cancelado');
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Error al cancelar el pedido');
    } finally {
      setLoading(false);
    }
  };

  if (showWA) {
    return (
      <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth
        PaperProps={{ sx: { borderRadius: 4 } }}>
        <DialogTitle sx={{ pb: 0.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Avatar sx={{ bgcolor: alpha('#EF4444', 0.12), width: 36, height: 36 }}>
              <Cancel sx={{ color: '#EF4444', fontSize: 20 }} />
            </Avatar>
            <Typography fontWeight={800}>Pedido cancelado</Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Typography fontSize={13} color="text.secondary" sx={{ mb: 2 }}>
            ¿Deseas notificar al cliente por WhatsApp?
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button onClick={onClose} sx={{ borderRadius: 2 }}>No, gracias</Button>
          <Button
            variant="contained"
            onClick={() => { window.open(waUrl, '_blank'); onClose(); }}
            startIcon={<WhatsApp />}
            sx={{ bgcolor: '#25D366', '&:hover': { bgcolor: '#128C7E' }, borderRadius: 2, fontWeight: 700 }}
          >
            Notificar por WhatsApp
          </Button>
        </DialogActions>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth
      PaperProps={{ sx: { borderRadius: 4 } }}>
      <DialogTitle sx={{ pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Avatar sx={{ bgcolor: alpha('#EF4444', 0.12), width: 40, height: 40 }}>
            <Warning sx={{ color: '#EF4444' }} />
          </Avatar>
          <Box>
            <Typography fontWeight={800} fontSize={15}>Cancelar pedido</Typography>
            <Typography fontSize={12} color="text.secondary">Pedido #{pedido?.id} · {pedido?.nombre_cliente}</Typography>
          </Box>
        </Box>
      </DialogTitle>
      <DialogContent sx={{ pt: 1 }}>
        <Alert severity="warning" sx={{ borderRadius: 2, mb: 2 }}>
          Esta acción no se puede deshacer. El stock será restaurado si ya fue descontado.
        </Alert>
        <TextField
          label="Motivo de cancelación (opcional)"
          fullWidth multiline rows={3}
          value={motivo}
          onChange={e => setMotivo(e.target.value)}
          placeholder="Ej: Cliente solicitó cancelar, producto sin stock..."
          sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
        />
        <Typography fontSize={11} color="text.secondary" sx={{ mt: 1 }}>
          El motivo aparecerá en el mensaje de WhatsApp al cliente.
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
        <Button onClick={onClose} sx={{ borderRadius: 2 }}>No cancelar</Button>
        <Button
          variant="contained"
          onClick={handleConfirm}
          disabled={loading}
          startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <Cancel />}
          sx={{ bgcolor: '#EF4444', '&:hover': { bgcolor: '#DC2626' }, borderRadius: 2, fontWeight: 700 }}
        >
          Sí, cancelar pedido
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ─── EditDialog ───────────────────────────────────────────────────────────────

const EditDialog = ({ open, onClose, pedido, onSuccess }) => {
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (pedido && open) {
      setForm({
        nombre_cliente:    pedido.nombre_cliente || '',
        celular_cliente:   pedido.celular_cliente || '',
        email_cliente:     pedido.email_cliente || '',
        tipo_entrega:      pedido.tipo_entrega || 'tienda',
        direccion_entrega: pedido.direccion_entrega || '',
        comentarios:       pedido.comentarios || '',
        notas_internas:    pedido.notas_internas || '',
      });
    }
  }, [pedido, open]);

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }));

  const handleSave = async () => {
    setLoading(true);
    try {
      const res = await apiClient.patch(`/pedidos-virtuales/${pedido.id}`, form);
      onSuccess(res.data);
      toast.success('Pedido actualizado');
      onClose();
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Error al actualizar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth
      PaperProps={{ sx: { borderRadius: 4 } }}>
      <DialogTitle sx={{ pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Avatar sx={{ bgcolor: alpha('#7C3AED', 0.12), width: 38, height: 38 }}>
              <Edit sx={{ color: '#7C3AED', fontSize: 20 }} />
            </Avatar>
            <Box>
              <Typography fontWeight={800} fontSize={15}>Editar pedido #{pedido?.id}</Typography>
              <Typography fontSize={12} color="text.secondary">Solo información de contacto y entrega</Typography>
            </Box>
          </Box>
          <IconButton size="small" onClick={onClose}><Close fontSize="small" /></IconButton>
        </Box>
      </DialogTitle>
      <DialogContent sx={{ pt: 1 }}>
        <Stack spacing={2}>
          <Stack direction="row" spacing={1.5}>
            <TextField
              label="Nombre cliente" size="small" fullWidth
              value={form.nombre_cliente || ''} onChange={set('nombre_cliente')}
              InputProps={{ startAdornment: <InputAdornment position="start"><Person sx={{ fontSize: 16, color: 'text.secondary' }} /></InputAdornment> }}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
            />
            <TextField
              label="Celular" size="small" fullWidth
              value={form.celular_cliente || ''} onChange={set('celular_cliente')}
              InputProps={{ startAdornment: <InputAdornment position="start"><Phone sx={{ fontSize: 16, color: 'text.secondary' }} /></InputAdornment> }}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
            />
          </Stack>
          <TextField
            label="Email (opcional)" size="small" fullWidth
            value={form.email_cliente || ''} onChange={set('email_cliente')}
            InputProps={{ startAdornment: <InputAdornment position="start"><Email sx={{ fontSize: 16, color: 'text.secondary' }} /></InputAdornment> }}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
          />
          <Stack direction="row" spacing={1.5}>
            <TextField
              select label="Tipo entrega" size="small" fullWidth
              value={form.tipo_entrega || 'tienda'} onChange={set('tipo_entrega')}
              SelectProps={{ native: true }}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
            >
              <option value="tienda">Recoge en tienda</option>
              <option value="domicilio">Domicilio</option>
            </TextField>
            {form.tipo_entrega === 'domicilio' && (
              <TextField
                label="Dirección" size="small" fullWidth
                value={form.direccion_entrega || ''} onChange={set('direccion_entrega')}
                InputProps={{ startAdornment: <InputAdornment position="start"><LocationOn sx={{ fontSize: 16, color: 'text.secondary' }} /></InputAdornment> }}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
              />
            )}
          </Stack>
          <TextField
            label="Comentarios del cliente" size="small" fullWidth multiline rows={2}
            value={form.comentarios || ''} onChange={set('comentarios')}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
          />
          <TextField
            label="Notas internas (solo equipo)" size="small" fullWidth multiline rows={2}
            value={form.notas_internas || ''} onChange={set('notas_internas')}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
        <Button onClick={onClose} sx={{ borderRadius: 2 }}>Cancelar</Button>
        <Button
          variant="contained" onClick={handleSave} disabled={loading}
          startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <Done />}
          sx={{ borderRadius: 2, fontWeight: 700 }}
        >
          Guardar cambios
        </Button>
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
    setMsg(
      `Hola ${pedido.nombre_cliente} 👋\n\nTe escribimos sobre tu *Pedido #${pedido.id}*.\n\n` +
      `Estado actual: *${estado}*\n\n¿Tienes alguna pregunta? Estamos aquí para ayudarte.`
    );
  }, [pedido]);

  const handleSend = async () => {
    if (!msg.trim() || !pedido) return;
    setLoading(true);
    try {
      const res = await apiClient.post(`/pedidos-virtuales/${pedido.id}/whatsapp`, { mensaje: msg });
      window.open(res.data.url, '_blank');
      onClose();
    } catch {
      toast.error('Error al generar el enlace');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth
      PaperProps={{ sx: { borderRadius: 4 } }}>
      <DialogTitle sx={{ pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Avatar sx={{ bgcolor: '#25D366', width: 36, height: 36 }}><WhatsApp sx={{ fontSize: 20 }} /></Avatar>
          <Box>
            <Typography fontWeight={800} fontSize={15}>Mensaje WhatsApp</Typography>
            <Typography fontSize={12} color="text.secondary">{pedido?.nombre_cliente} · {pedido?.celular_cliente}</Typography>
          </Box>
        </Box>
      </DialogTitle>
      <DialogContent>
        <TextField
          fullWidth multiline rows={6}
          value={msg} onChange={e => setMsg(e.target.value)}
          placeholder="Escribe el mensaje..."
          sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
        />
        <Typography fontSize={11} color="text.secondary" sx={{ mt: 1 }}>
          Se abrirá WhatsApp Web con este mensaje listo para enviar.
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose} sx={{ borderRadius: 2 }}>Cancelar</Button>
        <Button
          variant="contained" onClick={handleSend} disabled={loading || !msg.trim()}
          startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <WhatsApp />}
          sx={{ bgcolor: '#25D366', '&:hover': { bgcolor: '#128C7E' }, borderRadius: 2, fontWeight: 700 }}
        >
          Abrir WhatsApp
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ─── DetailDialog ─────────────────────────────────────────────────────────────

const DetailDialog = ({ open, onClose, pedido, empresa, vendedor, onStateChange, onEdit, onCancel, onConvertir }) => {
  const theme = useTheme();
  const [paymentOpen, setPaymentOpen] = useState(false);

  if (!pedido) return null;

  const isEntregado = pedido.estado === 'entregado';
  const isCancelado = pedido.estado === 'cancelado';
  const canConvertir = !pedido.venta_id && !isCancelado && ['confirmado', 'en_preparacion', 'enviado', 'entregado'].includes(pedido.estado);

  const ACTIONS = {
    nuevo:          [{ estado: 'confirmado',     label: 'Confirmar',      icon: <CheckCircle />, color: '#059669' }],
    confirmado:     [{ estado: 'en_preparacion', label: 'En preparación', icon: <Inventory2 />,  color: '#D97706' }],
    en_preparacion: [{ estado: 'enviado',        label: 'Listo/Enviado',  icon: <LocalShipping />, color: '#7C3AED' }],
    enviado:        [],
    entregado:      [],
    cancelado:      [],
  };

  const actions = ACTIONS[pedido.estado] || [];

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth
        PaperProps={{ sx: { borderRadius: 4 } }}>
        <DialogTitle sx={{ pb: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Avatar sx={{ bgcolor: alpha('#FF6020', 0.15), width: 40, height: 40, fontSize: 13, fontWeight: 900, color: '#FF6020' }}>
                #{pedido.id}
              </Avatar>
              <Box>
                <Typography fontWeight={800} fontSize={15}>{pedido.nombre_cliente}</Typography>
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
        <DialogContent sx={{ pt: 1.5 }}>
          {/* Client info */}
          <Box sx={{
            bgcolor: theme.palette.mode === 'dark' ? alpha('#fff', 0.04) : '#f9fafb',
            borderRadius: 3, p: 1.5, mb: 2,
          }}>
            <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.7 }}>
                <Phone sx={{ fontSize: 14, color: 'text.secondary' }} />
                <Typography fontSize={13} fontWeight={600}>{pedido.celular_cliente}</Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.7 }}>
                <LocalShipping sx={{ fontSize: 14, color: 'text.secondary' }} />
                <Typography fontSize={13}>{pedido.tipo_entrega === 'domicilio' ? 'Domicilio' : 'Recoge en tienda'}</Typography>
              </Box>
              {pedido.direccion_entrega && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.7 }}>
                  <LocationOn sx={{ fontSize: 14, color: 'text.secondary' }} />
                  <Typography fontSize={13}>{pedido.direccion_entrega}</Typography>
                </Box>
              )}
              {pedido.comentarios && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.7 }}>
                  <Comment sx={{ fontSize: 14, color: 'text.secondary' }} />
                  <Typography fontSize={13}>{pedido.comentarios}</Typography>
                </Box>
              )}
            </Stack>
          </Box>

          {/* Products */}
          <Typography fontSize={12} fontWeight={800} color="text.secondary" sx={{ mb: 1, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Productos
          </Typography>
          <Box sx={{ mb: 2 }}>
            {(pedido.detalles || []).map((d, i) => (
              <Box key={i} sx={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                py: 1, borderBottom: i < pedido.detalles.length - 1 ? `1px solid ${theme.palette.divider}` : 'none',
              }}>
                <Box>
                  <Typography fontSize={13} fontWeight={600}>{d.nombre_producto}</Typography>
                  <Typography fontSize={11} color="text.secondary">{fmt(d.precio_unitario)} × {d.cantidad}</Typography>
                </Box>
                <Typography fontSize={13} fontWeight={700} color="#FF6020">{fmt(d.subtotal)}</Typography>
              </Box>
            ))}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1.5, pt: 1, borderTop: `2px solid ${theme.palette.divider}` }}>
              <Typography fontWeight={700}>Total</Typography>
              <Typography fontWeight={900} fontSize={16} color="#FF6020">{fmt(pedido.total)}</Typography>
            </Box>
          </Box>

          {/* Alerts */}
          {pedido.venta_id && (
            <Alert severity="success" sx={{ borderRadius: 2, mb: 1 }}>
              Venta #{pedido.venta_id} generada — aparece en reportes.
            </Alert>
          )}
          {pedido.notas_internas && (
            <Alert severity="info" icon={<Comment />} sx={{ borderRadius: 2 }}>
              {pedido.notas_internas}
            </Alert>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 2.5, pb: 2.5, flexWrap: 'wrap', gap: 1 }}>
          {/* WhatsApp */}
          <Button
            size="small" startIcon={<WhatsApp />}
            onClick={() => { onClose(); onStateChange('_wa', pedido); }}
            sx={{ borderRadius: 2, color: '#25D366', border: `1px solid ${alpha('#25D366', 0.5)}` }}
          >
            WhatsApp
          </Button>

          {/* Entregar y Cobrar (enviado state) */}
          {pedido.estado === 'enviado' && !pedido.venta_id && (
            <Button
              size="small" variant="contained"
              startIcon={<AttachMoney />}
              onClick={() => setPaymentOpen(true)}
              sx={{ bgcolor: '#059669', '&:hover': { bgcolor: '#047857' }, borderRadius: 2, fontWeight: 700 }}
            >
              Entregar y Cobrar
            </Button>
          )}

          {/* Convert to venta (for non-enviado states) */}
          {canConvertir && pedido.estado !== 'enviado' && (
            <Button
              size="small" startIcon={<Receipt />}
              onClick={() => { setPaymentOpen(true); }}
              sx={{ borderRadius: 2, color: '#7C3AED', border: `1px solid ${alpha('#7C3AED', 0.5)}` }}
            >
              Convertir a Venta
            </Button>
          )}

          <Box sx={{ flex: 1 }} />

          {/* State transitions */}
          {actions.map(a => (
            <Button
              key={a.estado}
              size="small" variant="contained"
              startIcon={a.icon}
              onClick={() => { onStateChange(a.estado, pedido); onClose(); }}
              sx={{ bgcolor: a.color, '&:hover': { filter: 'brightness(0.9)' }, borderRadius: 2, fontWeight: 700 }}
            >
              {a.label}
            </Button>
          ))}

          {/* Cancel */}
          {!isEntregado && !isCancelado && (
            <Button
              size="small" startIcon={<Cancel />}
              onClick={() => { onClose(); onCancel(pedido); }}
              sx={{ borderRadius: 2, color: '#EF4444', border: `1px solid ${alpha('#EF4444', 0.4)}` }}
            >
              Cancelar
            </Button>
          )}
        </DialogActions>
      </Dialog>

      <PaymentDialog
        open={paymentOpen}
        onClose={() => setPaymentOpen(false)}
        pedido={pedido}
        empresa={empresa}
        vendedor={vendedor}
        onSuccess={(updated) => {
          setPaymentOpen(false);
          onConvertir(updated);
          onClose();
        }}
      />
    </>
  );
};

// ─── PedidoCard ───────────────────────────────────────────────────────────────

const PedidoCard = ({ pedido, empresa, vendedor, onStateChange, onCancel, onConvertir, onWhatsApp, onEdit, onDetail }) => {
  const theme = useTheme();
  const [paymentOpen, setPaymentOpen] = useState(false);
  const meta = getEstadoMeta(pedido.estado);
  const isEntregado = pedido.estado === 'entregado';
  const isCancelado = pedido.estado === 'cancelado';

  // Primary quick action per state
  const quickAction = {
    nuevo:          { label: 'Confirmar',      color: '#059669', icon: <CheckCircle sx={{ fontSize: 14 }} />, next: 'confirmado' },
    confirmado:     { label: 'En preparación', color: '#D97706', icon: <Inventory2 sx={{ fontSize: 14 }} />,  next: 'en_preparacion' },
    en_preparacion: { label: 'Listo/Enviado',  color: '#7C3AED', icon: <LocalShipping sx={{ fontSize: 14 }} />, next: 'enviado' },
    enviado:        { label: 'Entregar y Cobrar', color: '#059669', icon: <AttachMoney sx={{ fontSize: 14 }} />, next: '_pay' },
  }[pedido.estado];

  return (
    <>
      <Card
        elevation={0}
        sx={{
          borderRadius: 3,
          border: `1px solid ${alpha(meta.color, 0.2)}`,
          bgcolor: theme.palette.background.paper,
          transition: 'all 0.18s',
          '&:hover': {
            borderColor: alpha(meta.color, 0.5),
            boxShadow: `0 4px 20px ${alpha(meta.color, 0.12)}`,
            transform: 'translateY(-1px)',
          },
          position: 'relative',
          overflow: 'visible',
        }}
      >
        {/* Color accent bar */}
        <Box sx={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 3,
          borderRadius: '12px 12px 0 0',
          bgcolor: meta.color,
        }} />

        <Box sx={{ p: 2, pt: 2.5 }}>
          {/* Header */}
          <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 1.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Avatar sx={{
                width: 34, height: 34, fontSize: 12, fontWeight: 900,
                bgcolor: alpha(meta.color, 0.12), color: meta.color,
              }}>
                #{pedido.id}
              </Avatar>
              <Box>
                <Typography fontWeight={700} fontSize={13} noWrap sx={{ maxWidth: 140 }}>{pedido.nombre_cliente}</Typography>
                <Typography fontSize={11} color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.4 }}>
                  <AccessTime sx={{ fontSize: 11 }} /> {timeAgo(pedido.fecha_creacion)}
                </Typography>
              </Box>
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.5 }}>
              <EstadoChip estado={pedido.estado} />
              {pedido.venta_id && (
                <Chip label={`V#${pedido.venta_id}`} size="small" sx={{ fontSize: 10, height: 18, bgcolor: alpha('#059669', 0.1), color: '#059669' }} />
              )}
            </Box>
          </Box>

          {/* Phone + delivery */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5, flexWrap: 'wrap' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Phone sx={{ fontSize: 13, color: 'text.secondary' }} />
              <Typography fontSize={12} color="text.secondary">{pedido.celular_cliente}</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <LocalShipping sx={{ fontSize: 13, color: 'text.secondary' }} />
              <Typography fontSize={12} color="text.secondary">
                {pedido.tipo_entrega === 'domicilio' ? 'Domicilio' : 'Tienda'}
              </Typography>
            </Box>
          </Box>

          {/* Products summary */}
          <Box sx={{
            bgcolor: theme.palette.mode === 'dark' ? alpha('#fff', 0.03) : '#f9fafb',
            borderRadius: 2, p: 1, mb: 1.5,
          }}>
            {(pedido.detalles || []).slice(0, 2).map((d, i) => (
              <Typography key={i} fontSize={11} color="text.secondary" noWrap>
                {d.cantidad}× {d.nombre_producto}
              </Typography>
            ))}
            {pedido.detalles?.length > 2 && (
              <Typography fontSize={11} color="text.secondary">+{pedido.detalles.length - 2} más...</Typography>
            )}
          </Box>

          {/* Total */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
            <Typography fontSize={11} color="text.secondary" fontWeight={600}>TOTAL</Typography>
            <Typography fontSize={16} fontWeight={900} color="#FF6020">{fmt(pedido.total)}</Typography>
          </Box>

          <Divider sx={{ mb: 1.5 }} />

          {/* Action buttons */}
          <Box sx={{ display: 'flex', gap: 0.8, flexWrap: 'wrap' }}>
            {/* Ver detalle */}
            <Button
              size="small" variant="outlined"
              onClick={() => onDetail(pedido)}
              sx={{ borderRadius: 2, fontSize: 11, flex: 1, minWidth: 60 }}
            >
              Detalle
            </Button>

            {/* WhatsApp */}
            <Tooltip title="WhatsApp">
              <IconButton
                size="small"
                onClick={() => onWhatsApp(pedido)}
                sx={{
                  borderRadius: 2,
                  border: `1px solid ${alpha('#25D366', 0.4)}`,
                  color: '#25D366',
                  width: 32, height: 32,
                }}
              >
                <WhatsApp sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>

            {/* Edit */}
            {!isEntregado && !isCancelado && (
              <Tooltip title="Editar">
                <IconButton
                  size="small"
                  onClick={() => onEdit(pedido)}
                  sx={{
                    borderRadius: 2,
                    border: `1px solid ${theme.palette.divider}`,
                    color: 'text.secondary',
                    width: 32, height: 32,
                  }}
                >
                  <Edit sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
            )}

            {/* Quick primary action */}
            {quickAction && (
              <Button
                size="small" variant="contained"
                startIcon={quickAction.icon}
                onClick={() => {
                  if (quickAction.next === '_pay') setPaymentOpen(true);
                  else onStateChange(quickAction.next, pedido);
                }}
                sx={{
                  bgcolor: quickAction.color,
                  '&:hover': { filter: 'brightness(0.9)' },
                  borderRadius: 2, fontSize: 11, fontWeight: 700, flex: 2,
                }}
              >
                {quickAction.label}
              </Button>
            )}

            {/* Cancel */}
            {!isEntregado && !isCancelado && (
              <Tooltip title="Cancelar pedido">
                <IconButton
                  size="small"
                  onClick={() => onCancel(pedido)}
                  sx={{
                    borderRadius: 2,
                    border: `1px solid ${alpha('#EF4444', 0.3)}`,
                    color: '#EF4444',
                    width: 32, height: 32,
                  }}
                >
                  <Cancel sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
            )}

            {/* Recibo for delivered */}
            {isEntregado && pedido.venta_id && (
              <Tooltip title="Ver comprobante">
                <IconButton
                  size="small"
                  onClick={() => onDetail(pedido)}
                  sx={{
                    borderRadius: 2,
                    border: `1px solid ${alpha('#059669', 0.4)}`,
                    color: '#059669',
                    width: 32, height: 32,
                  }}
                >
                  <Receipt sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
            )}
          </Box>
        </Box>
      </Card>

      <PaymentDialog
        open={paymentOpen}
        onClose={() => setPaymentOpen(false)}
        pedido={pedido}
        empresa={empresa}
        vendedor={vendedor}
        onSuccess={(updated) => {
          setPaymentOpen(false);
          onConvertir(updated);
        }}
      />
    </>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PedidosVirtuales({ user }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [pedidos, setPedidos] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [estadoFiltro, setEstadoFiltro] = useState('todos');

  // Dialog state
  const [detailPedido, setDetailPedido] = useState(null);
  const [cancelPedido, setCancelPedido] = useState(null);
  const [editPedido, setEditPedido] = useState(null);
  const [waPedido, setWaPedido] = useState(null);

  const empresa = user?.empresa || null;
  const vendedor = user ? `${user.nombre || ''} ${user.apellido || ''}`.trim() || user.email : '';

  const fetchAll = useCallback(async () => {
    try {
      const [pRes, sRes] = await Promise.all([
        apiClient.get('/pedidos-virtuales/', { params: { estado: estadoFiltro !== 'todos' ? estadoFiltro : undefined, search: search || undefined, limit: 100 } }),
        apiClient.get('/pedidos-virtuales/stats'),
      ]);
      setPedidos(pRes.data);
      setStats(sRes.data);
    } catch {
      toast.error('Error al cargar pedidos');
    } finally {
      setLoading(false);
    }
  }, [estadoFiltro, search]);

  useEffect(() => {
    setLoading(true);
    const t = setTimeout(fetchAll, search ? 400 : 0);
    return () => clearTimeout(t);
  }, [fetchAll, search]);

  // Auto-refresh every 60s
  useEffect(() => {
    const id = setInterval(fetchAll, 60_000);
    return () => clearInterval(id);
  }, [fetchAll]);

  const handleStateChange = async (estado, pedido) => {
    if (estado === '_wa') { setWaPedido(pedido); return; }
    try {
      const res = await apiClient.patch(`/pedidos-virtuales/${pedido.id}/estado`, { estado });
      setPedidos(prev => prev.map(p => p.id === pedido.id ? res.data : p));
      fetchAll();
      toast.success(`Estado actualizado a "${getEstadoMeta(estado).label}"`);
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Error al actualizar estado');
    }
  };

  const handleConvertir = (updated) => {
    setPedidos(prev => prev.map(p => p.id === updated.id ? updated : p));
    fetchAll();
  };

  const handleCancelSuccess = () => {
    fetchAll();
    setCancelPedido(null);
  };

  const handleEditSuccess = (updated) => {
    setPedidos(prev => prev.map(p => p.id === updated.id ? updated : p));
    if (detailPedido?.id === updated.id) setDetailPedido(updated);
  };

  const statsMeta = ESTADOS_META.filter(e => e.value !== 'todos');

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, bgcolor: theme.palette.background.default, minHeight: '100vh' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Avatar sx={{ bgcolor: alpha('#F43F5E', 0.12), width: 44, height: 44 }}>
            <Storefront sx={{ color: '#F43F5E' }} />
          </Avatar>
          <Box>
            <Typography variant="h6" fontWeight={900} lineHeight={1.1}>Pedidos Tienda Virtual</Typography>
            <Typography fontSize={12} color="text.secondary">
              {stats.total ?? 0} pedidos · auto-actualiza cada 60s
            </Typography>
          </Box>
        </Box>
        <Button
          variant="outlined" startIcon={<Refresh />}
          onClick={() => { setLoading(true); fetchAll(); }}
          sx={{ borderRadius: 2, fontWeight: 600 }}
        >
          Actualizar
        </Button>
      </Box>

      {/* Stats bar */}
      <Box sx={{ display: 'flex', gap: 1, mb: 3, flexWrap: 'wrap' }}>
        <StatCard
          label="Todos" count={stats.total ?? 0} color="#6b7280"
          active={estadoFiltro === 'todos'} onClick={() => setEstadoFiltro('todos')}
        />
        {statsMeta.map(e => (
          <StatCard
            key={e.value}
            label={e.label} count={stats[e.value] ?? 0} color={e.color}
            active={estadoFiltro === e.value} onClick={() => setEstadoFiltro(e.value)}
          />
        ))}
      </Box>

      {/* Search */}
      <TextField
        fullWidth size="small"
        placeholder="Buscar por nombre o celular..."
        value={search} onChange={e => setSearch(e.target.value)}
        InputProps={{
          startAdornment: <InputAdornment position="start"><Search sx={{ fontSize: 18, color: 'text.secondary' }} /></InputAdornment>,
        }}
        sx={{ mb: 2.5, '& .MuiOutlinedInput-root': { borderRadius: 3, bgcolor: theme.palette.background.paper } }}
      />

      {/* Grid */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', pt: 8 }}>
          <CircularProgress />
        </Box>
      ) : pedidos.length === 0 ? (
        <Box sx={{ textAlign: 'center', pt: 8, color: 'text.secondary' }}>
          <ShoppingBag sx={{ fontSize: 48, mb: 2, opacity: 0.3 }} />
          <Typography fontWeight={700}>Sin pedidos</Typography>
          <Typography fontSize={13}>Los pedidos del catálogo virtual aparecerán aquí.</Typography>
        </Box>
      ) : (
        <Box sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)', lg: 'repeat(4, 1fr)' },
          gap: 2,
        }}>
          {pedidos.map(p => (
            <PedidoCard
              key={p.id}
              pedido={p}
              empresa={empresa}
              vendedor={vendedor}
              onStateChange={handleStateChange}
              onCancel={setCancelPedido}
              onConvertir={handleConvertir}
              onWhatsApp={setWaPedido}
              onEdit={setEditPedido}
              onDetail={setDetailPedido}
            />
          ))}
        </Box>
      )}

      {/* Dialogs */}
      <DetailDialog
        open={!!detailPedido}
        onClose={() => setDetailPedido(null)}
        pedido={detailPedido}
        empresa={empresa}
        vendedor={vendedor}
        onStateChange={handleStateChange}
        onEdit={(p) => { setDetailPedido(null); setEditPedido(p); }}
        onCancel={(p) => { setDetailPedido(null); setCancelPedido(p); }}
        onConvertir={handleConvertir}
      />

      <CancelDialog
        open={!!cancelPedido}
        onClose={() => setCancelPedido(null)}
        pedido={cancelPedido}
        onSuccess={handleCancelSuccess}
      />

      <EditDialog
        open={!!editPedido}
        onClose={() => setEditPedido(null)}
        pedido={editPedido}
        onSuccess={handleEditSuccess}
      />

      <WADialog
        open={!!waPedido}
        onClose={() => setWaPedido(null)}
        pedido={waPedido}
      />
    </Box>
  );
}
