import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, MenuItem, Typography, Box,
  IconButton, Divider, Grid
} from '@mui/material';
import { Close, Payment, CheckCircle } from '@mui/icons-material';
import { toast } from 'react-toastify';
import apiClient from '../../api';
import { formatCurrency } from '../../utils/formatters';
import CurrencyField from '../../components/common/CurrencyField';
import { METODOS_PAGO_SIMPLE as METODOS } from '../../utils/constants';

const ACCENT = '#FF6020';
const GREEN  = '#10B981';

/**
 * PaymentDialog — modal para registrar abono o pago total de una venta.
 *
 * Props:
 *   open               {bool}
 *   handleClose        {fn}
 *   venta              {object}  — venta con total, monto_pagado, id
 *   onPaymentSuccess   {fn}
 *   pagoToEdit         {object}  — si viene, edita un pago existente
 */
const PaymentDialog = ({ open, handleClose, venta, onPaymentSuccess, pagoToEdit }) => {
  const [monto, setMonto]       = useState(0);
  const [metodo, setMetodo]     = useState('Efectivo');
  const [detalle, setDetalle]   = useState('');
  const [loading, setLoading]   = useState(false);

  const isEditing = Boolean(pagoToEdit);
  const pendiente = venta ? venta.total - venta.monto_pagado : 0;

  useEffect(() => {
    if (!open) return;
    if (isEditing) {
      setMonto(pagoToEdit.monto);
      setMetodo(pagoToEdit.metodo_pago || 'Efectivo');
      setDetalle(pagoToEdit.detalle_pago || '');
    } else {
      setMonto(pendiente > 0 ? pendiente : 0);
      setMetodo('Efectivo');
      setDetalle('');
    }
  }, [open, pagoToEdit, pendiente, isEditing]);

  const handleConfirm = async () => {
    if (!monto || monto <= 0) { toast.warning('Ingrese un monto válido.'); return; }
    if (monto > pendiente && !isEditing) {
      toast.warning(`El monto no puede superar el saldo pendiente (${formatCurrency(pendiente)}).`);
      return;
    }
    setLoading(true);
    try {
      if (isEditing) {
        await apiClient.put(`/pagos/${pagoToEdit.id}`, { monto, metodo_pago: metodo, detalle_pago: detalle });
        toast.success('Pago actualizado correctamente');
      } else {
        await apiClient.post('/pagos/', { venta_id: venta.id, monto, metodo_pago: metodo, detalle_pago: detalle });
        toast.success('Pago registrado correctamente');
      }
      onPaymentSuccess?.();
      handleClose();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al registrar el pago');
    } finally {
      setLoading(false);
    }
  };

  if (!venta) return null;

  return (
    <Dialog
      open={open}
      onClose={loading ? undefined : handleClose}
      maxWidth="xs"
      fullWidth
      PaperProps={{ sx: { borderRadius: 3, border: 'none', boxShadow: '0 20px 60px rgba(0,0,0,0.15)', overflow: 'hidden' } }}
    >
      <Box sx={{ height: 4, bgcolor: GREEN }} />

      <DialogTitle sx={{ pb: 1, pt: 2, pr: 6 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ width: 40, height: 40, borderRadius: 2, bgcolor: `${GREEN}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: GREEN, flexShrink: 0 }}>
            <Payment />
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 700, fontSize: 15 }}>
              {isEditing ? 'Editar Pago' : 'Registrar Pago'}
            </Typography>
            <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
              Venta #{venta.id}
            </Typography>
          </Box>
        </Box>
        <IconButton size="small" onClick={handleClose} disabled={loading}
          sx={{ position: 'absolute', right: 12, top: 14, color: 'text.secondary' }}>
          <Close fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 1 }}>
        {/* Resumen de la venta */}
        <Grid container spacing={1} sx={{ mb: 2 }}>
          {[
            { label: 'Total venta',      val: formatCurrency(venta.total),        color: 'text.primary' },
            { label: 'Ya pagado',        val: formatCurrency(venta.monto_pagado), color: GREEN },
            { label: 'Saldo pendiente',  val: formatCurrency(pendiente),          color: pendiente > 0 ? '#EF4444' : GREEN },
          ].map(({ label, val, color }) => (
            <Grid item xs={4} key={label}>
              <Box sx={{ p: 1.2, borderRadius: 2, bgcolor: 'action.hover', textAlign: 'center' }}>
                <Typography sx={{ fontSize: 9, color: 'text.secondary', mb: 0.2 }}>{label}</Typography>
                <Typography sx={{ fontSize: 12, fontWeight: 700, color }}>{val}</Typography>
              </Box>
            </Grid>
          ))}
        </Grid>

        <Divider sx={{ mb: 2 }} />

        {/* Monto con formateo automático */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <CurrencyField
            label="Monto a pagar"
            value={monto}
            onChange={(num) => setMonto(num)}
            required
            autoFocus
            helperText={pendiente > 0 ? `Máximo: ${formatCurrency(pendiente)}` : undefined}
          />

          <TextField
            select fullWidth label="Método de pago" size="small"
            value={metodo} onChange={(e) => setMetodo(e.target.value)}
          >
            {METODOS.map(m => <MenuItem key={m} value={m}>{m}</MenuItem>)}
          </TextField>

          {metodo !== 'Efectivo' && (
            <TextField
              fullWidth size="small"
              label={metodo === 'Transferencia' ? 'Nro. comprobante / cuenta'
                   : metodo === 'Cheque'        ? 'Nro. de cheque'
                   : 'Referencia'}
              value={detalle}
              onChange={(e) => setDetalle(e.target.value)}
              placeholder="Ej: 123456789"
            />
          )}

          {/* Acceso rápido: pago total */}
          {!isEditing && pendiente > 0 && monto < pendiente && (
            <Button
              variant="text" size="small"
              onClick={() => setMonto(pendiente)}
              sx={{ color: GREEN, fontWeight: 600, fontSize: 12, alignSelf: 'flex-start', p: 0 }}
            >
              Usar saldo completo: {formatCurrency(pendiente)}
            </Button>
          )}
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5, pt: 1, gap: 1 }}>
        <Button
          onClick={handleClose} disabled={loading}
          variant="outlined" size="small"
          sx={{ borderRadius: 2, fontWeight: 600, borderColor: 'divider', color: 'text.secondary', flex: 1 }}
        >
          Cancelar
        </Button>
        <Button
          onClick={handleConfirm} disabled={loading}
          variant="contained" size="small"
          startIcon={<CheckCircle sx={{ fontSize: 16 }} />}
          sx={{
            borderRadius: 2, fontWeight: 600, flex: 1,
            background: `linear-gradient(135deg, ${GREEN}, #34d399)`,
            boxShadow: `0 4px 14px rgba(16,185,129,0.3)`,
            color: '#fff',
          }}
        >
          {loading ? 'Procesando…' : isEditing ? 'Actualizar' : 'Confirmar Pago'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default PaymentDialog;
