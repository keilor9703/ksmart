import React, { useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Box, Typography,
  IconButton, Divider, Chip, Table, TableBody, TableCell,
  TableHead, TableRow, Paper, Grid, Button
} from '@mui/material';
import { Close, Receipt, AttachMoney, CreditCard, AccountBalance, AccessTime, Print } from '@mui/icons-material';
import { formatCurrency } from '../../utils/formatters';
import ReciboDialog from '../../components/common/ReciboDialog';

const ACCENT  = '#0891B2';
const GREEN   = '#10B981';
const BLUE    = '#3B82F6';
const YELLOW  = '#F59E0B';
const RED     = '#EF4444';
const PURPLE  = '#8B5CF6';

// ─── Config método de pago ─────────────────────────────────────────────────
const METODO_CONFIG = {
  'Efectivo':      { icon: <AttachMoney sx={{ fontSize: 14 }} />, color: GREEN  },
  'Transferencia': { icon: <AccountBalance sx={{ fontSize: 14 }} />, color: BLUE   },
  'Tarjeta':       { icon: <CreditCard sx={{ fontSize: 14 }} />, color: PURPLE },
  'Por Cobrar':    { icon: <AccessTime sx={{ fontSize: 14 }} />, color: RED    },
};

const getMetodoPago = (venta) => {
  if (venta.metodo_pago) return venta.metodo_pago;
  if (venta.estado_pago === 'pendiente') return 'Por Cobrar';
  return 'Efectivo';
};

// ─── Chip de estado ────────────────────────────────────────────────────────
const EstadoChip = ({ estado }) => {
  const map = {
    pagado:    { label: 'Pagada',    color: 'success' },
    parcial:   { label: 'Parcial',   color: 'warning' },
    pendiente: { label: 'Pendiente', color: 'error'   },
  };
  const cfg = map[estado] || { label: estado, color: 'default' };
  return <Chip label={cfg.label} color={cfg.color} size="small" sx={{ fontWeight: 700, fontSize: 11, borderRadius: 1.5 }} />;
};

// ─── Componente ────────────────────────────────────────────────────────────
const VentaDetailDialog = ({ open, handleClose, venta, empresa, vendedor }) => {
  const [reciboOpen, setReciboOpen] = useState(false);
  if (!venta) return null;

  const metodo    = getMetodoPago(venta);
  const metodoCfg = METODO_CONFIG[metodo] || METODO_CONFIG['Efectivo'];
  const saldo     = (venta.total || 0) - (venta.monto_pagado || 0);
  const fecha     = new Date(venta.fecha + (venta.fecha?.includes('Z') ? '' : 'Z'));

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: { borderRadius: 3, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' } }}
    >
      {/* Barra superior */}
      <Box sx={{ height: 4, bgcolor: ACCENT }} />

      <DialogTitle sx={{ pb: 1, pt: 2, pr: 6 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ width: 40, height: 40, borderRadius: 2, bgcolor: `${ACCENT}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: ACCENT, flexShrink: 0 }}>
            <Receipt />
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 700, fontSize: 15 }}>
              Venta #{venta.numero_venta ?? venta.id}
            </Typography>
            <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
              {fecha.toLocaleString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </Typography>
          </Box>
        </Box>
        <IconButton size="small" onClick={handleClose}
          sx={{ position: 'absolute', right: 12, top: 14, color: 'text.secondary' }}>
          <Close fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 1, pb: 2.5 }}>

        {/* Cliente + Estado */}
        <Paper sx={{ p: 1.5, mb: 2, borderRadius: 2, bgcolor: 'action.hover', boxShadow: 'none', border: 'none' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
            <Box>
              <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>Cliente</Typography>
              <Typography sx={{ fontWeight: 700, fontSize: 14 }}>
                {venta.cliente?.nombre || `Cliente #${venta.cliente_id}`}
              </Typography>
            </Box>
            <Box sx={{ textAlign: 'right' }}>
              <Typography sx={{ fontSize: 11, color: 'text.secondary', mb: 0.3 }}>Estado</Typography>
              <EstadoChip estado={venta.estado_pago} />
            </Box>
          </Box>
        </Paper>

        {/* Productos */}
        <Typography sx={{ fontSize: 11, fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.6, mb: 1 }}>
          Productos
        </Typography>
        <Table size="small" sx={{ mb: 2 }}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontSize: 11 }}>Producto</TableCell>
              <TableCell align="right" sx={{ fontSize: 11 }}>Cant.</TableCell>
              <TableCell align="right" sx={{ fontSize: 11 }}>Precio unit.</TableCell>
              <TableCell align="right" sx={{ fontSize: 11 }}>Subtotal</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {(venta.detalles || []).map(d => {
              const nombre = d.producto?.nombre || `Producto #${d.producto_id}`;
              const precio = d.precio_unitario || 0;
              const desc   = d.descuento_pct || 0;
              const subtotal = d.cantidad * precio;
              return (
                <TableRow key={d.id} hover>
                  <TableCell>
                    <Typography sx={{ fontSize: 13, fontWeight: 500 }}>{nombre}</Typography>
                    {desc > 0 && (
                      <Typography sx={{ fontSize: 10, color: GREEN }}>Desc. {desc}%</Typography>
                    )}
                  </TableCell>
                  <TableCell align="right" sx={{ fontSize: 13 }}>{d.cantidad}</TableCell>
                  <TableCell align="right" sx={{ fontSize: 13 }}>{formatCurrency(precio)}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600, fontSize: 13 }}>
                    {formatCurrency(subtotal)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>

        <Divider sx={{ mb: 2 }} />

        {/* Totales + método de pago */}
        <Grid container spacing={1.5}>
          {/* Resumen financiero */}
          <Grid item xs={12} sm={7}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.6 }}>
              {venta.iva_porcentaje > 0 && (
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>IVA incluido ({venta.iva_porcentaje}%)</Typography>
                  <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{formatCurrency(venta.iva_total || 0)}</Typography>
                </Box>
              )}
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography sx={{ fontSize: 13, fontWeight: 700 }}>Total</Typography>
                <Typography sx={{ fontSize: 15, fontWeight: 800, color: ACCENT }}>{formatCurrency(venta.total)}</Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>Pagado</Typography>
                <Typography sx={{ fontSize: 12, fontWeight: 600, color: GREEN }}>{formatCurrency(venta.monto_pagado)}</Typography>
              </Box>
              {saldo > 0 && (
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>Saldo pendiente</Typography>
                  <Typography sx={{ fontSize: 12, fontWeight: 700, color: RED }}>{formatCurrency(saldo)}</Typography>
                </Box>
              )}
            </Box>
          </Grid>

          {/* Método de pago */}
          <Grid item xs={12} sm={5}>
            <Box sx={{
              p: 1.5, borderRadius: 2,
              bgcolor: `${metodoCfg.color}08`,
              border: `1px solid ${metodoCfg.color}25`,
              display: 'flex', alignItems: 'center', gap: 1, height: '100%'
            }}>
              <Box sx={{ width: 32, height: 32, borderRadius: 1.5, bgcolor: `${metodoCfg.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: metodoCfg.color, flexShrink: 0 }}>
                {metodoCfg.icon}
              </Box>
              <Box>
                <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>Método de pago</Typography>
                <Typography sx={{ fontSize: 13, fontWeight: 700, color: metodoCfg.color }}>{metodo}</Typography>
              </Box>
            </Box>
          </Grid>
        </Grid>

        {/* ── Botón recibo ── */}
        <Box sx={{ mt: 2.5, display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            startIcon={<Print />}
            variant="outlined"
            size="small"
            onClick={() => setReciboOpen(true)}
            sx={{ borderRadius: 2, fontWeight: 600, textTransform: 'none', color: '#0891B2', borderColor: '#0891B2', '&:hover': { bgcolor: '#0891B210', borderColor: '#0891B2' } }}
          >
            Imprimir / Compartir recibo
          </Button>
        </Box>

        {/* Historial de pagos si hay abonos */}
        {(venta.pagos || []).length > 0 && (
          <>
            <Divider sx={{ my: 2 }} />
            <Typography sx={{ fontSize: 11, fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.6, mb: 1 }}>
              Abonos registrados
            </Typography>
            {venta.pagos.map(p => {
              const mp  = p.metodo_pago || 'Efectivo';
              const cfg = METODO_CONFIG[mp] || METODO_CONFIG['Efectivo'];
              return (
                <Box key={p.id} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 0.8, borderBottom: '1px solid', borderColor: 'divider' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ color: cfg.color, display: 'flex' }}>{cfg.icon}</Box>
                    <Box>
                      <Typography sx={{ fontSize: 12, fontWeight: 500 }}>{mp}</Typography>
                      <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>
                        {new Date(p.fecha).toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        {p.detalle_pago && ` · ${p.detalle_pago}`}
                      </Typography>
                    </Box>
                  </Box>
                  <Typography sx={{ fontWeight: 700, color: GREEN, fontSize: 13 }}>
                    {formatCurrency(p.monto)}
                  </Typography>
                </Box>
              );
            })}
          </>
        )}
      </DialogContent>

      <ReciboDialog
        open={reciboOpen}
        onClose={() => setReciboOpen(false)}
        venta={venta}
        empresa={empresa}
        vendedor={vendedor}
      />
    </Dialog>
  );
};

export default VentaDetailDialog;
