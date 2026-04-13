import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Typography, Box, IconButton, Divider,
  Table, TableBody, TableCell, TableHead, TableRow,
  TextField, Chip, Paper, CircularProgress, Alert
} from '@mui/material';
import { Close, AssignmentReturn, CheckCircle, Inventory2Outlined } from '@mui/icons-material';
import { toast } from 'react-toastify';
import apiClient from '../api';
import { formatCurrency } from '../utils/formatters';

const YELLOW = '#F59E0B';
const GREEN  = '#10B981';

const DevolucionDialog = ({ open, onClose, venta, onSuccess }) => {
  const [items, setItems]           = useState([]);
  const [motivo, setMotivo]         = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open || !venta) return;
    setMotivo('');
    const devolvibles = (venta.detalles || [])
      .filter(d => {
        // Mostrar si tiene producto cargado y no es servicio
        // Si producto es null (no vino en el joinedload), mostrar igual
        // para no perder ítems — el backend validará
        if (!d.producto) return true;
        return !d.producto.es_servicio;
      })
      .map(d => ({
        detalle_id:    d.id,
        producto_id:   d.producto_id,
        nombre:        d.producto?.nombre || `Producto #${d.producto_id}`,
        unidad:        d.producto?.unidad_medida || 'UND',
        cantidad_orig: d.cantidad,
        precio_unit:   d.precio_unitario,
        cantidad_dev:  0,
        seleccionado:  false,
      }));
    setItems(devolvibles);
  }, [open, venta]);

  const toggleItem = (idx) => {
    setItems(prev => prev.map((it, i) =>
      i === idx
        ? { ...it, seleccionado: !it.seleccionado, cantidad_dev: !it.seleccionado ? it.cantidad_orig : 0 }
        : it
    ));
  };

  const setCantidad = (idx, val) => {
    const parsed = Math.max(0, Math.min(items[idx].cantidad_orig, parseFloat(val) || 0));
    setItems(prev => prev.map((it, i) =>
      i === idx ? { ...it, cantidad_dev: parsed, seleccionado: parsed > 0 } : it
    ));
  };

  const itemsSel        = items.filter(it => it.seleccionado && it.cantidad_dev > 0);
  const totalDevolucion = itemsSel.reduce((s, it) => s + it.cantidad_dev * it.precio_unit, 0);

  const handleConfirmar = async () => {
    if (itemsSel.length === 0) { toast.warning('Selecciona al menos un producto.'); return; }
    if (!motivo.trim())        { toast.warning('Indica el motivo de la devolución.'); return; }
    setSubmitting(true);
    try {
      await apiClient.post('/devoluciones/', {
        venta_id: venta.id,
        motivo:   motivo.trim(),
        items: itemsSel.map(it => ({
          detalle_id:      it.detalle_id,
          producto_id:     it.producto_id,
          cantidad:        it.cantidad_dev,
          precio_unitario: it.precio_unit,   // ✅ nombre correcto del schema
        })),
      });
      toast.success('Devolución registrada. Stock actualizado.');
      onSuccess?.();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al registrar la devolución.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!venta) return null;

  return (
    <Dialog open={open} onClose={submitting ? undefined : onClose} maxWidth="sm" fullWidth
      PaperProps={{ sx: { borderRadius: 3, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' } }}>

      <Box sx={{ height: 4, bgcolor: YELLOW }} />

      <DialogTitle sx={{ pb: 1, pt: 2, pr: 6 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ width: 40, height: 40, borderRadius: 2, bgcolor: `${YELLOW}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: YELLOW, flexShrink: 0 }}>
            <AssignmentReturn />
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 700, fontSize: 15 }}>Registrar Devolución</Typography>
            <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
              Venta #{venta.id} · {venta.cliente?.nombre}
            </Typography>
          </Box>
        </Box>
        <IconButton size="small" onClick={onClose} disabled={submitting}
          sx={{ position: 'absolute', right: 12, top: 14, color: 'text.secondary' }}>
          <Close fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 1 }}>

        {/* Resumen venta original */}
        <Paper sx={{ p: 1.5, mb: 2, borderRadius: 2, bgcolor: 'action.hover', boxShadow: 'none', border: 'none' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Box>
              <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>Total original</Typography>
              <Typography sx={{ fontWeight: 700, fontSize: 14 }}>{formatCurrency(venta.total)}</Typography>
            </Box>
            <Box sx={{ textAlign: 'right' }}>
              <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>Estado</Typography>
              <Chip label={venta.estado_pago} size="small"
                color={venta.estado_pago === 'pagado' ? 'success' : venta.estado_pago === 'parcial' ? 'warning' : 'error'}
                sx={{ fontWeight: 600, fontSize: 10 }} />
            </Box>
          </Box>
        </Paper>

        {/* Tabla de ítems */}
        <Typography sx={{ fontSize: 11, fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.6, mb: 1 }}>
          Selecciona los productos a devolver
        </Typography>

        {items.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 3, color: 'text.secondary' }}>
            <Inventory2Outlined sx={{ fontSize: 36, opacity: 0.2, mb: 1 }} />
            <Typography fontSize={13}>Esta venta no tiene productos físicos devolvibles.</Typography>
          </Box>
        ) : (
          <Table size="small" sx={{ mb: 2 }}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontSize: 11 }}>Producto</TableCell>
                <TableCell align="right" sx={{ fontSize: 11 }}>Vendido</TableCell>
                <TableCell align="center" sx={{ fontSize: 11 }}>A devolver</TableCell>
                <TableCell align="right" sx={{ fontSize: 11 }}>Crédito</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {items.map((it, idx) => (
                <TableRow key={it.detalle_id} hover onClick={() => toggleItem(idx)}
                  sx={{
                    cursor: 'pointer',
                    bgcolor: it.seleccionado ? `${YELLOW}08` : 'transparent',
                    '& td': { borderLeft: it.seleccionado ? `3px solid ${YELLOW}` : '3px solid transparent' },
                  }}
                >
                  <TableCell>
                    <Typography sx={{ fontWeight: it.seleccionado ? 600 : 400, fontSize: 13 }}>{it.nombre}</Typography>
                    <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>{formatCurrency(it.precio_unit)} / {it.unidad}</Typography>
                  </TableCell>
                  <TableCell align="right" sx={{ fontSize: 13 }}>{it.cantidad_orig}</TableCell>
                  <TableCell align="center" onClick={e => e.stopPropagation()}>
                    <TextField type="number" value={it.cantidad_dev}
                      onChange={e => setCantidad(idx, e.target.value)}
                      size="small" sx={{ width: 75 }}
                      inputProps={{ min: 0, max: it.cantidad_orig, step: 1 }} />
                  </TableCell>
                  <TableCell align="right"
                    sx={{ fontWeight: 600, color: it.seleccionado ? YELLOW : 'text.secondary', fontSize: 13 }}>
                    {formatCurrency(it.cantidad_dev * it.precio_unit)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {/* Resumen nota crédito */}
        {itemsSel.length > 0 && (
          <Paper sx={{ p: 1.5, mb: 2, borderRadius: 2, bgcolor: `${YELLOW}08`, border: `1px solid ${YELLOW}30`, boxShadow: 'none' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography sx={{ fontSize: 13, fontWeight: 600 }}>Nota crédito a generar</Typography>
              <Typography sx={{ fontSize: 16, fontWeight: 800, color: YELLOW }}>{formatCurrency(totalDevolucion)}</Typography>
            </Box>
            <Typography sx={{ fontSize: 11, color: 'text.secondary', mt: 0.3 }}>
              {itemsSel.length} producto{itemsSel.length > 1 ? 's' : ''} · el stock se repondrá automáticamente
            </Typography>
          </Paper>
        )}

        <Divider sx={{ mb: 2 }} />

        <TextField fullWidth size="small" label="Motivo de la devolución *"
          value={motivo} onChange={e => setMotivo(e.target.value)}
          placeholder="Ej: Producto en mal estado, error en pedido…"
          multiline rows={2} />

        {itemsSel.length > 0 && (
          <Alert severity="info" sx={{ mt: 1.5, borderRadius: 2, fontSize: 12 }}>
            {venta.estado_pago === 'pagado'
              ? `El cliente tiene un crédito a favor de ${formatCurrency(totalDevolucion)} para próximas compras.`
              : `El saldo pendiente se reducirá en ${formatCurrency(totalDevolucion)}.`}
          </Alert>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5, pt: 1, gap: 1 }}>
        <Button onClick={onClose} disabled={submitting} variant="outlined" size="small"
          sx={{ borderRadius: 2, fontWeight: 600, borderColor: 'divider', color: 'text.secondary', flex: 1 }}>
          Cancelar
        </Button>
        <Button onClick={handleConfirmar}
          disabled={submitting || itemsSel.length === 0 || !motivo.trim()}
          variant="contained" size="small"
          startIcon={submitting ? <CircularProgress size={14} color="inherit" /> : <CheckCircle sx={{ fontSize: 16 }} />}
          sx={{ borderRadius: 2, fontWeight: 600, flex: 1, bgcolor: YELLOW, '&:hover': { bgcolor: '#d97706' }, color: '#fff', '&.Mui-disabled': { opacity: 0.5 } }}>
          {submitting ? 'Procesando…' : 'Confirmar Devolución'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default DevolucionDialog;
