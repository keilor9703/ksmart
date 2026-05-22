import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Card, Chip, Button, IconButton, TextField,
  Dialog, DialogTitle, DialogContent, DialogActions,
  Avatar, Divider, Badge, Tooltip, Alert, CircularProgress,
  InputAdornment, Menu, MenuItem, Skeleton, Stack, Paper,
  LinearProgress, useTheme, useMediaQuery,
} from '@mui/material';
import {
  ShoppingBag, Search, WhatsApp, CheckCircle, LocalShipping,
  Cancel, Receipt, Refresh, FilterList, MoreVert,
  Phone, LocationOn, Person, Comment, Schedule,
  Storefront, TrendingUp, ErrorOutline, Inventory2,
  OpenInNew, ContentCopy, Done, AccessTime,
} from '@mui/icons-material';
import apiClient from '../../api';
import { toast } from 'react-toastify';

// ─── Constants ────────────────────────────────────────────────────────────────

const ESTADOS = [
  { value: 'todos',          label: 'Todos',          color: '#6b7280', bg: '#f3f4f6' },
  { value: 'nuevo',          label: 'Nuevo',          color: '#2563EB', bg: '#dbeafe' },
  { value: 'confirmado',     label: 'Confirmado',     color: '#059669', bg: '#d1fae5' },
  { value: 'en_preparacion', label: 'En preparación', color: '#D97706', bg: '#fef3c7' },
  { value: 'enviado',        label: 'Enviado',        color: '#7C3AED', bg: '#ede9fe' },
  { value: 'entregado',      label: 'Entregado',      color: '#065f46', bg: '#a7f3d0' },
  { value: 'cancelado',      label: 'Cancelado',      color: '#9ca3af', bg: '#f3f4f6' },
];

const NEXT_ACTIONS = {
  nuevo:          [{ estado: 'confirmado',     label: 'Confirmar pedido',  icon: <CheckCircle />,    color: '#059669' },
                   { estado: 'cancelado',       label: 'Cancelar',          icon: <Cancel />,         color: '#EF4444' }],
  confirmado:     [{ estado: 'en_preparacion', label: 'En preparación',    icon: <Inventory2 />,     color: '#D97706' },
                   { estado: 'cancelado',       label: 'Cancelar',          icon: <Cancel />,         color: '#EF4444' }],
  en_preparacion: [{ estado: 'enviado',        label: 'Listo / Enviado',   icon: <LocalShipping />,  color: '#7C3AED' },
                   { estado: 'cancelado',       label: 'Cancelar',          icon: <Cancel />,         color: '#EF4444' }],
  enviado:        [{ estado: 'entregado',      label: 'Marcar entregado',  icon: <Done />,           color: '#065f46' },
                   { estado: 'cancelado',       label: 'Cancelar',          icon: <Cancel />,         color: '#EF4444' }],
  entregado:      [],
  cancelado:      [],
};

const fmt = (val) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(val);

const timeAgo = (dateStr) => {
  if (!dateStr) return '';
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (diff < 60)    return `hace ${diff}s`;
  if (diff < 3600)  return `hace ${Math.floor(diff / 60)}min`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)}h`;
  return `hace ${Math.floor(diff / 86400)}d`;
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const EstadoChip = ({ estado }) => {
  const e = ESTADOS.find(s => s.value === estado) || ESTADOS[0];
  return (
    <Chip
      label={e.label}
      size="small"
      sx={{
        bgcolor: e.bg, color: e.color,
        fontWeight: 700, fontSize: 11, border: `1px solid ${e.color}30`,
      }}
    />
  );
};

const StatCard = ({ label, count, color, bg, onClick, active }) => (
  <Paper
    onClick={onClick}
    elevation={0}
    sx={{
      p: '10px 14px', borderRadius: 3, cursor: 'pointer', transition: 'all 0.15s',
      border: `2px solid ${active ? color : 'transparent'}`,
      bgcolor: active ? bg : '#f9fafb',
      '&:hover': { bgcolor: bg, border: `2px solid ${color}40` },
      minWidth: 90, textAlign: 'center',
    }}
  >
    <Typography sx={{ fontSize: 22, fontWeight: 900, color, lineHeight: 1 }}>{count}</Typography>
    <Typography sx={{ fontSize: 10, color: '#6b7280', fontWeight: 600, mt: 0.3 }}>{label}</Typography>
  </Paper>
);

// ─── WhatsApp Dialog ─────────────────────────────────────────────────────────

const WADialog = ({ open, onClose, pedido }) => {
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!pedido) return;
    const estado = ESTADOS.find(s => s.value === pedido.estado)?.label || pedido.estado;
    setMsg(
      `Hola ${pedido.nombre_cliente} 👋\n\nTe escribimos sobre tu *Pedido #${pedido.id}*.\n\n` +
      `Estado actual: *${estado}*\n\n` +
      `¿Tienes alguna pregunta? Estamos aquí para ayudarte.`
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

// ─── Pedido Detail Dialog ─────────────────────────────────────────────────────

const PedidoDetail = ({ open, onClose, pedido, onAction, onConvertir, onWhatsApp }) => {
  const [notas, setNotas] = useState('');
  const [converting, setConverting] = useState(false);

  useEffect(() => { setNotas(pedido?.notas_internas || ''); }, [pedido]);

  if (!pedido) return null;
  const actions = NEXT_ACTIONS[pedido.estado] || [];

  const handleConvertir = async () => {
    setConverting(true);
    await onConvertir(pedido.id);
    setConverting(false);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth
      PaperProps={{ sx: { borderRadius: 4 } }}>
      <DialogTitle sx={{ pb: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Avatar sx={{ bgcolor: '#FF6020', width: 38, height: 38, fontSize: 14, fontWeight: 900 }}>
              #{pedido.id}
            </Avatar>
            <Box>
              <Typography fontWeight={800} fontSize={15}>{pedido.nombre_cliente}</Typography>
              <EstadoChip estado={pedido.estado} />
            </Box>
          </Box>
          <IconButton onClick={onClose} size="small"><Cancel fontSize="small" /></IconButton>
        </Box>
      </DialogTitle>
      <DialogContent sx={{ pt: 1.5 }}>
        {/* Client info */}
        <Box sx={{ bgcolor: '#f9fafb', borderRadius: 3, p: 1.5, mb: 2 }}>
          <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.7 }}>
              <Phone sx={{ fontSize: 14, color: '#6b7280' }} />
              <Typography fontSize={13} fontWeight={600}>{pedido.celular_cliente}</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.7 }}>
              <LocalShipping sx={{ fontSize: 14, color: '#6b7280' }} />
              <Typography fontSize={13}>{pedido.tipo_entrega === 'domicilio' ? 'Domicilio' : 'Recoge en tienda'}</Typography>
            </Box>
            {pedido.direccion_entrega && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.7 }}>
                <LocationOn sx={{ fontSize: 14, color: '#6b7280' }} />
                <Typography fontSize={13}>{pedido.direccion_entrega}</Typography>
              </Box>
            )}
            {pedido.comentarios && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.7 }}>
                <Comment sx={{ fontSize: 14, color: '#6b7280' }} />
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
          {pedido.detalles?.map((d, i) => (
            <Box key={i} sx={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              py: 1, borderBottom: i < pedido.detalles.length - 1 ? '1px solid #f1f5f9' : 'none',
            }}>
              <Box>
                <Typography fontSize={13} fontWeight={600}>{d.nombre_producto}</Typography>
                <Typography fontSize={11} color="text.secondary">{fmt(d.precio_unitario)} × {d.cantidad}</Typography>
              </Box>
              <Typography fontSize={13} fontWeight={700} color="#FF6020">{fmt(d.subtotal)}</Typography>
            </Box>
          ))}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1.5, pt: 1, borderTop: '2px solid #f1f5f9' }}>
            <Typography fontWeight={700}>Total</Typography>
            <Typography fontWeight={900} fontSize={16} color="#FF6020">{fmt(pedido.total)}</Typography>
          </Box>
        </Box>

        {/* Notes */}
        <TextField
          label="Notas internas"
          size="small" fullWidth multiline rows={2}
          value={notas} onChange={e => setNotas(e.target.value)}
          placeholder="Solo visibles para el equipo..."
          sx={{ mb: 2, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
        />

        {/* Alerts */}
        {pedido.venta_id && (
          <Alert severity="success" sx={{ borderRadius: 2, mb: 1.5 }}>
            Venta #{pedido.venta_id} generada — aparece en reportes de ventas.
          </Alert>
        )}
        {pedido.stock_descontado && !pedido.venta_id && (
          <Alert severity="info" sx={{ borderRadius: 2, mb: 1.5 }}>
            Stock descontado del inventario al confirmar.
          </Alert>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 2.5, pb: 2.5, flexWrap: 'wrap', gap: 1, justifyContent: 'flex-start' }}>
        <Button
          size="small" startIcon={<WhatsApp />}
          onClick={() => { onClose(); onWhatsApp(pedido); }}
          sx={{ borderRadius: 2, color: '#25D366', border: '1px solid #25D366' }}
        >
          WhatsApp
        </Button>
        {!pedido.venta_id && ['confirmado', 'en_preparacion', 'enviado', 'entregado'].includes(pedido.estado) && (
          <Button
            size="small" startIcon={converting ? <CircularProgress size={14} /> : <Receipt />}
            onClick={handleConvertir} disabled={converting}
            sx={{ borderRadius: 2, color: '#7C3AED', border: '1px solid #7C3AED' }}
          >
            Convertir a Venta
          </Button>
        )}
        <Box sx={{ flex: 1 }} />
        {actions.map(a => (
          <Button
            key={a.estado}
            size="small" variant={a.estado === 'cancelado' ? 'outlined' : 'contained'}
            startIcon={a.icon}
            onClick={() => onAction(pedido.id, a.estado, notas)}
            sx={{
              borderRadius: 2, fontWeight: 700,
              bgcolor: a.estado !== 'cancelado' ? a.color : 'transparent',
              color: a.estado !== 'cancelado' ? '#fff' : a.color,
              borderColor: a.color,
              '&:hover': { bgcolor: a.estado !== 'cancelado' ? a.color : `${a.color}15`, opacity: 0.9 },
            }}
          >
            {a.label}
          </Button>
        ))}
      </DialogActions>
    </Dialog>
  );
};

// ─── Order Card ───────────────────────────────────────────────────────────────

const PedidoCard = ({ pedido, onAction, onDetail, onWhatsApp }) => {
  const actions = NEXT_ACTIONS[pedido.estado] || [];
  const primaryAction = actions.find(a => a.estado !== 'cancelado');

  return (
    <Card elevation={0} sx={{
      border: '1px solid #e5e7eb', borderRadius: 3, p: 0, overflow: 'hidden',
      transition: 'box-shadow 0.15s',
      '&:hover': { boxShadow: '0 4px 20px rgba(0,0,0,0.08)' },
    }}>
      {/* Header bar */}
      <Box sx={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        px: 2, py: 1.5, borderBottom: '1px solid #f1f5f9',
        bgcolor: pedido.estado === 'nuevo' ? '#eff6ff' : pedido.estado === 'cancelado' ? '#f9fafb' : '#fff',
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
          <Typography fontSize={13} fontWeight={900} color="#FF6020">#{pedido.id}</Typography>
          <EstadoChip estado={pedido.estado} />
          {pedido.venta_id && (
            <Chip size="small" label={`Venta #${pedido.venta_id}`}
              sx={{ bgcolor: '#d1fae5', color: '#065f46', fontWeight: 700, fontSize: 10, height: 20 }} />
          )}
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Typography fontSize={11} color="text.secondary">{timeAgo(pedido.fecha_creacion)}</Typography>
          <Tooltip title="WhatsApp cliente">
            <IconButton size="small" onClick={() => onWhatsApp(pedido)}
              sx={{ color: '#25D366', '&:hover': { bgcolor: '#f0fdf4' } }}>
              <WhatsApp sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Ver detalle">
            <IconButton size="small" onClick={() => onDetail(pedido)}
              sx={{ '&:hover': { bgcolor: '#f1f5f9' } }}>
              <OpenInNew sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Body */}
      <Box sx={{ px: 2, py: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 1 }}>
          <Box>
            <Typography fontSize={14} fontWeight={700}>{pedido.nombre_cliente}</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Phone sx={{ fontSize: 12, color: '#9ca3af' }} />
              <Typography fontSize={12} color="text.secondary">{pedido.celular_cliente}</Typography>
              {pedido.tipo_entrega === 'domicilio' && (
                <>
                  <Typography fontSize={12} color="text.secondary">·</Typography>
                  <LocalShipping sx={{ fontSize: 12, color: '#9ca3af' }} />
                  <Typography fontSize={12} color="text.secondary">Domicilio</Typography>
                </>
              )}
            </Box>
          </Box>
          <Typography fontSize={16} fontWeight={900} color="#FF6020">{fmt(pedido.total)}</Typography>
        </Box>

        {/* Products summary */}
        <Box sx={{ bgcolor: '#f9fafb', borderRadius: 2, px: 1.5, py: 1, mb: 1.5 }}>
          {pedido.detalles?.slice(0, 2).map((d, i) => (
            <Typography key={i} fontSize={12} color="text.secondary">
              {d.nombre_producto} × {d.cantidad}
            </Typography>
          ))}
          {(pedido.detalles?.length || 0) > 2 && (
            <Typography fontSize={11} color="text.secondary" fontStyle="italic">
              +{pedido.detalles.length - 2} producto(s) más
            </Typography>
          )}
        </Box>

        {/* Actions */}
        {primaryAction && (
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              size="small" variant="contained" fullWidth
              startIcon={primaryAction.icon}
              onClick={() => onAction(pedido.id, primaryAction.estado)}
              sx={{
                bgcolor: primaryAction.color, fontWeight: 700, borderRadius: 2, fontSize: 12,
                '&:hover': { bgcolor: primaryAction.color, opacity: 0.9 },
              }}
            >
              {primaryAction.label}
            </Button>
            <Button
              size="small" variant="outlined"
              onClick={() => onAction(pedido.id, 'cancelado')}
              sx={{ borderRadius: 2, borderColor: '#EF4444', color: '#EF4444', minWidth: 40, px: 1.5 }}
            >
              <Cancel sx={{ fontSize: 16 }} />
            </Button>
          </Box>
        )}
      </Box>
    </Card>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PedidosVirtuales() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const [pedidos, setPedidos]       = useState([]);
  const [stats, setStats]           = useState({});
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filtroEstado, setFiltro]   = useState('todos');
  const [search, setSearch]         = useState('');

  const [detailPedido, setDetailPedido] = useState(null);
  const [waPedido, setWaPedido]         = useState(null);

  // ── Fetch ──
  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const [pedRes, statsRes] = await Promise.all([
        apiClient.get('/pedidos-virtuales/', {
          params: {
            estado: filtroEstado !== 'todos' ? filtroEstado : undefined,
            search: search || undefined,
            limit: 100,
          },
        }),
        apiClient.get('/pedidos-virtuales/stats'),
      ]);
      setPedidos(pedRes.data);
      setStats(statsRes.data);
    } catch {
      toast.error('Error al cargar los pedidos');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filtroEstado, search]);

  useEffect(() => { loadData(); }, [loadData]);

  // Auto-refresh every 60s for new orders
  useEffect(() => {
    const interval = setInterval(() => loadData(true), 60000);
    return () => clearInterval(interval);
  }, [loadData]);

  // ── Actions ──
  const handleAction = async (pedidoId, nuevoEstado, notas) => {
    try {
      await apiClient.patch(`/pedidos-virtuales/${pedidoId}/estado`, {
        estado: nuevoEstado,
        notas_internas: notas || undefined,
      });
      const label = ESTADOS.find(s => s.value === nuevoEstado)?.label || nuevoEstado;
      toast.success(`Pedido #${pedidoId} → ${label}`);
      setDetailPedido(null);
      await loadData(true);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'No se pudo actualizar el estado');
    }
  };

  const handleConvertir = async (pedidoId) => {
    try {
      const res = await apiClient.post(`/pedidos-virtuales/${pedidoId}/convertir-venta`);
      toast.success(`✅ Venta #${res.data.venta_id} generada desde pedido #${pedidoId}`);
      setDetailPedido(res.data);
      await loadData(true);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al convertir');
    }
  };

  // ── Render ──
  const statsOrdered = ESTADOS.filter(e => e.value !== 'todos');
  const pendingCount = (stats.nuevo || 0) + (stats.confirmado || 0) + (stats.en_preparacion || 0);

  return (
    <Box sx={{ p: { xs: 1.5, md: 3 }, maxWidth: 1100, mx: 'auto' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2.5, flexWrap: 'wrap', gap: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Avatar sx={{ bgcolor: '#FF6020', width: 42, height: 42 }}>
            <ShoppingBag />
          </Avatar>
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="h6" fontWeight={900}>Pedidos Tienda Virtual</Typography>
              {pendingCount > 0 && (
                <Chip label={`${pendingCount} activos`} size="small"
                  sx={{ bgcolor: '#fef3c7', color: '#D97706', fontWeight: 700, fontSize: 11 }} />
              )}
            </Box>
            <Typography fontSize={12} color="text.secondary">
              {stats.total || 0} pedidos en total · se actualiza cada 60s
            </Typography>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title="Actualizar">
            <IconButton onClick={() => loadData(true)} disabled={refreshing}
              sx={{ border: '1px solid #e5e7eb', borderRadius: 2 }}>
              {refreshing ? <CircularProgress size={18} /> : <Refresh />}
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {refreshing && <LinearProgress sx={{ mb: 1.5, borderRadius: 1 }} />}

      {/* Stats row */}
      <Box sx={{ display: 'flex', gap: 1.5, mb: 2.5, overflowX: 'auto', pb: 0.5 }}>
        <StatCard
          label="Todos" count={stats.total || 0}
          color="#374151" bg="#f3f4f6"
          active={filtroEstado === 'todos'}
          onClick={() => setFiltro('todos')}
        />
        {statsOrdered.map(e => (
          <StatCard
            key={e.value}
            label={e.label} count={stats[e.value] || 0}
            color={e.color} bg={e.bg}
            active={filtroEstado === e.value}
            onClick={() => setFiltro(e.value)}
          />
        ))}
      </Box>

      {/* Search */}
      <TextField
        fullWidth size="small" placeholder="Buscar por nombre o celular..."
        value={search} onChange={e => setSearch(e.target.value)}
        InputProps={{
          startAdornment: <InputAdornment position="start"><Search sx={{ fontSize: 18, color: '#9ca3af' }} /></InputAdornment>,
        }}
        sx={{ mb: 2.5, '& .MuiOutlinedInput-root': { borderRadius: 3, bgcolor: '#f9fafb' } }}
      />

      {/* Empty state */}
      {!loading && pedidos.length === 0 && (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Storefront sx={{ fontSize: 56, color: '#d1d5db', mb: 2 }} />
          <Typography fontWeight={700} color="text.secondary" gutterBottom>
            {filtroEstado === 'todos' ? 'Aún no hay pedidos' : `Sin pedidos en estado "${ESTADOS.find(s => s.value === filtroEstado)?.label}"`}
          </Typography>
          <Typography fontSize={13} color="text.secondary">
            Los pedidos de tu tienda virtual aparecerán aquí automáticamente.
          </Typography>
        </Box>
      )}

      {/* Loading skeleton */}
      {loading && (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' }, gap: 2 }}>
          {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} variant="rounded" height={180} sx={{ borderRadius: 3 }} />)}
        </Box>
      )}

      {/* Pedidos grid */}
      {!loading && pedidos.length > 0 && (
        <Box sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' },
          gap: 2,
        }}>
          {pedidos.map(pedido => (
            <PedidoCard
              key={pedido.id}
              pedido={pedido}
              onAction={handleAction}
              onDetail={setDetailPedido}
              onWhatsApp={setWaPedido}
            />
          ))}
        </Box>
      )}

      {/* Detail Dialog */}
      <PedidoDetail
        open={!!detailPedido}
        onClose={() => setDetailPedido(null)}
        pedido={detailPedido}
        onAction={handleAction}
        onConvertir={handleConvertir}
        onWhatsApp={(p) => { setDetailPedido(null); setWaPedido(p); }}
      />

      {/* WhatsApp Dialog */}
      <WADialog
        open={!!waPedido}
        onClose={() => setWaPedido(null)}
        pedido={waPedido}
      />
    </Box>
  );
}
