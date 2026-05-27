import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField,
  Box, Typography, Stack, RadioGroup, Radio, FormControlLabel, Alert,
  Divider, MenuItem, InputAdornment, CircularProgress, IconButton,
  Autocomplete, Chip
} from '@mui/material';
import { Close, TwoWheeler, Person, AttachMoney, Save } from '@mui/icons-material';
import apiClient from '../../api';
import { toast } from 'react-toastify';
import { formatCurrency } from '../../utils/formatters';
import CurrencyField from '../../components/common/CurrencyField';
import { METODOS_PAGO_SIMPLE as METODOS_PAGO } from '../../utils/constants';

const ACCENT = '#FF6020';


// ═══════════════════════════════════════════════════════════════════════════
// 1. RegistrarSuscripcionDialog
//    Caso: vehículo registrado SIN suscripción → registrar pago de mensualidad
// ═══════════════════════════════════════════════════════════════════════════

export function ParqueaderoSuscripcionDialog({ open, onClose, vehiculo, onSuccess }) {
  const [tipo, setTipo]                   = useState('mensual');
  const [config, setConfig]               = useState(null);
  const [montoPersonalizado, setMontoPer] = useState('');
  const [montoPagado, setMontoPagado]     = useState('');
  const [metodoPago, setMetodoPago]       = useState('Efectivo');
  const [obs, setObs]                     = useState('');
  const [loading, setLoading]             = useState(false);

  // Cargar tarifas al abrir
  useEffect(() => {
    if (!open) return;
    apiClient.get('/parqueadero/config')
      .then(({ data }) => setConfig(data))
      .catch(() => toast.error('No se pudo cargar la configuración de tarifas.'));
    // Reset
    setTipo('mensual');
    setMontoPer('');
    setMontoPagado('');
    setMetodoPago('Efectivo');
    setObs('');
  }, [open]);

  const tarifa = config ? (
    tipo === 'mensual'   ? config.tarifa_mensual :
    tipo === 'quincenal' ? config.tarifa_quincenal :
    config.tarifa_diaria
  ) : 0;

  const montoFinal = montoPersonalizado !== '' ? Number(montoPersonalizado) : tarifa;
  const pagado = montoPagado === '' ? montoFinal : Number(montoPagado);  // Por defecto paga todo

  const handleGuardar = async () => {
    if (!vehiculo?.id) return;
    if (montoFinal <= 0) {
      toast.warning('La tarifa configurada es 0. Configúrala primero.');
      return;
    }
    setLoading(true);
    try {
      await apiClient.post('/parqueadero/suscripciones', {
        vehiculo_id:        vehiculo.id,
        tipo,
        monto_personalizado: montoPersonalizado === '' ? null : Number(montoPersonalizado),
        monto_pagado:       pagado,
        metodo_pago_inicial: metodoPago,
        observaciones:      obs || null,
      });
      toast.success(`Suscripción ${tipo} registrada.`);
      onSuccess?.();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al registrar.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ pb: 1 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Stack direction="row" spacing={1} alignItems="center">
            <AttachMoney sx={{ color: ACCENT }} />
            <Typography sx={{ fontWeight: 800 }}>Registrar suscripción</Typography>
          </Stack>
          <IconButton onClick={onClose} size="small"><Close /></IconButton>
        </Stack>
        {vehiculo && (
          <Typography sx={{ fontSize: 13, color: 'text.secondary', mt: 0.5 }}>
            {vehiculo.placa} · {vehiculo.cliente_nombre}
          </Typography>
        )}
      </DialogTitle>

      <DialogContent dividers>
        {/* Tipo de plan */}
        <Typography sx={{ fontSize: 12, fontWeight: 700, color: 'text.secondary', mb: 1, textTransform: 'uppercase' }}>
          Tipo de plan
        </Typography>
        <RadioGroup row value={tipo} onChange={(e) => setTipo(e.target.value)} sx={{ mb: 2 }}>
          <FormControlLabel value="mensual"   control={<Radio />} label={`Mensual (${formatCurrency(config?.tarifa_mensual || 0)})`} />
          <FormControlLabel value="quincenal" control={<Radio />} label={`Quincenal (${formatCurrency(config?.tarifa_quincenal || 0)})`} />
          <FormControlLabel value="diaria"    control={<Radio />} label={`Diaria (${formatCurrency(config?.tarifa_diaria || 0)})`} />
        </RadioGroup>

        {/* Override de monto */}
        <CurrencyField
          fullWidth size="small" label="Monto personalizado (descuento o ajuste)"
          placeholder={`Tarifa estándar: ${formatCurrency(tarifa)}`}
          value={montoPersonalizado}
          onChange={(val) => setMontoPer(val)}
          sx={{ mb: 2 }}
        />

        <Divider sx={{ my: 2 }}>
          <Chip label="Pago" size="small" sx={{ fontWeight: 700 }} />
        </Divider>

        {/* Monto pagado ahora */}
        <CurrencyField
          fullWidth size="small" label="Monto pagado ahora"
          helperText="Si paga menos del total, queda con saldo pendiente"
          value={montoPagado}
          onChange={(val) => setMontoPagado(val)}
          placeholder={`${formatCurrency(montoFinal)} (paga completo)`}
          sx={{ mb: 2 }}
        />

        <TextField
          fullWidth select size="small" label="Método de pago"
          value={metodoPago} onChange={(e) => setMetodoPago(e.target.value)}
          sx={{ mb: 2 }}
        >
          {METODOS_PAGO.map(m => <MenuItem key={m} value={m}>{m}</MenuItem>)}
        </TextField>

        <TextField
          fullWidth size="small" multiline rows={2}
          label="Observaciones (opcional)"
          value={obs} onChange={(e) => setObs(e.target.value)}
        />

        {/* Resumen */}
        <Box sx={{ mt: 2, p: 2, bgcolor: '#F8FAFC', borderRadius: 2 }}>
          <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
            <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>Total a cobrar</Typography>
            <Typography sx={{ fontSize: 14, fontWeight: 700 }}>{formatCurrency(montoFinal)}</Typography>
          </Stack>
          <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
            <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>Paga ahora</Typography>
            <Typography sx={{ fontSize: 14, fontWeight: 700, color: '#10B981' }}>{formatCurrency(pagado)}</Typography>
          </Stack>
          {pagado < montoFinal && (
            <Stack direction="row" justifyContent="space-between" sx={{ pt: 0.5, borderTop: '1px dashed', borderColor: 'divider' }}>
              <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#EF4444' }}>Saldo pendiente</Typography>
              <Typography sx={{ fontSize: 14, fontWeight: 800, color: '#EF4444' }}>
                {formatCurrency(montoFinal - pagado)}
              </Typography>
            </Stack>
          )}
        </Box>
      </DialogContent>

      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} disabled={loading}>Cancelar</Button>
        <Button
          variant="contained" onClick={handleGuardar} disabled={loading}
          startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <Save />}
          sx={{ bgcolor: ACCENT, '&:hover': { bgcolor: '#e6561c' }, fontWeight: 700 }}
        >
          Registrar
        </Button>
      </DialogActions>
    </Dialog>
  );
}
export const RegistrarSuscripcionDialog = ParqueaderoSuscripcionDialog;
export default ParqueaderoSuscripcionDialog;