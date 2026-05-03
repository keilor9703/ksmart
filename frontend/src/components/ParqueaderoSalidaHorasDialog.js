import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField,
  Box, Typography, Stack, RadioGroup, Radio, FormControlLabel, Alert,
  Divider, MenuItem, InputAdornment, CircularProgress, IconButton,
  Autocomplete, Chip
} from '@mui/material';
import { Close, TwoWheeler, Person, AttachMoney, Save } from '@mui/icons-material';
import apiClient from '../api';
import { toast } from 'react-toastify';
import { formatCurrency } from '../utils/formatters';

const ACCENT = '#FF6020';
const METODOS_PAGO = ['Efectivo', 'Transferencia', 'Nequi', 'Daviplata', 'Tarjeta', 'Otro'];


// ═══════════════════════════════════════════════════════════════════════════
// 4. RegistrarSalidaHorasDialog
//    Caso: moto está dentro pagando por horas → cobrar al salir
// ═══════════════════════════════════════════════════════════════════════════

export function ParqueaderoSalidaHorasDialog({ open, onClose, acceso, onSuccess }) {
  const [montoManual, setMontoManual] = useState('');
  const [metodoPago, setMetodoPago]   = useState('Efectivo');
  const [obs, setObs]                 = useState('');
  const [loading, setLoading]         = useState(false);
  const [config, setConfig]           = useState(null);

  useEffect(() => {
    if (!open) return;
    apiClient.get('/parqueadero/config').then(({ data }) => setConfig(data));
    setMontoManual(''); setMetodoPago('Efectivo'); setObs('');
  }, [open]);

  // Calcular horas en vivo
  const calcularHoras = () => {
    if (!acceso?.fecha_entrada) return { horas: 0, monto: 0 };
    const entrada = new Date(acceso.fecha_entrada);
    const ahora = new Date();
    const horas = Math.max(1, (ahora - entrada) / 3600000);
    const monto = Math.round(horas * (config?.tarifa_hora || 0));
    return { horas, monto };
  };
  const { horas, monto } = calcularHoras();
  const cobroFinal = montoManual === '' ? monto : Number(montoManual);

  const handleSalida = async () => {
    if (!acceso?.id) return;
    setLoading(true);
    try {
      await apiClient.post('/parqueadero/accesos/salida', {
        acceso_id:    acceso.id,
        metodo_pago:  metodoPago,
        monto_manual: montoManual === '' ? null : Number(montoManual),
        observaciones: obs || null,
      });
      toast.success(`Salida registrada. Cobro: ${formatCurrency(cobroFinal)}`);
      onSuccess?.();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al registrar salida.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography sx={{ fontWeight: 800 }}>Registrar salida</Typography>
          <IconButton onClick={onClose} size="small"><Close /></IconButton>
        </Stack>
      </DialogTitle>

      <DialogContent dividers>
        <Box sx={{ textAlign: 'center', mb: 2 }}>
          <Typography sx={{
            fontSize: 28, fontWeight: 900, fontFamily: 'monospace',
            letterSpacing: 3, color: ACCENT,
          }}>
            {acceso?.placa}
          </Typography>
          <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
            Tiempo dentro: <strong>{horas.toFixed(1)} horas</strong>
          </Typography>
        </Box>

        <Box sx={{ p: 2, bgcolor: '#F0FDF4', borderRadius: 2, mb: 2, textAlign: 'center' }}>
          <Typography sx={{ fontSize: 11, color: 'text.secondary', textTransform: 'uppercase', fontWeight: 700, mb: 0.5 }}>
            Cobro automático
          </Typography>
          <Typography sx={{ fontSize: 28, fontWeight: 900, color: '#10B981' }}>
            {formatCurrency(monto)}
          </Typography>
          <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
            {horas.toFixed(1)}h × {formatCurrency(config?.tarifa_hora || 0)}/h
          </Typography>
        </Box>

        <TextField
          fullWidth size="small" label="Cobrar otro monto (descuento)"
          value={montoManual}
          onChange={(e) => setMontoManual(e.target.value.replace(/\D/g, ''))}
          placeholder={`${formatCurrency(monto)} (cálculo automático)`}
          InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
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
      </DialogContent>

      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} disabled={loading}>Cancelar</Button>
        <Button
          variant="contained" onClick={handleSalida} disabled={loading}
          startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <Save />}
          sx={{ bgcolor: '#10B981', '&:hover': { bgcolor: '#059669' }, fontWeight: 700 }}
        >
          Cobrar {formatCurrency(cobroFinal)}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
export const RegistrarSalidaHorasDialog = ParqueaderoSalidaHorasDialog;
export default ParqueaderoSalidaHorasDialog;