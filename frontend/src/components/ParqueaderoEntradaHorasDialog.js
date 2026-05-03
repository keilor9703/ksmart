
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
// 5. EntradaHorasDialog
//    Caso: cliente ocasional entra por horas
// ═══════════════════════════════════════════════════════════════════════════

export function ParqueaderoEntradaHorasDialog({ open, onClose, placaSugerida, vehiculoId, onSuccess }) {
  const [placa, setPlaca]     = useState('');
  const [obs, setObs]         = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPlaca(placaSugerida || '');
    setObs('');
  }, [open, placaSugerida]);

  const handleEntrada = async () => {
    if (!placa || placa.length < 3) {
      toast.warning('La placa es obligatoria.');
      return;
    }
    setLoading(true);
    try {
      await apiClient.post('/parqueadero/accesos/entrada', {
        placa, vehiculo_id: vehiculoId || null, observaciones: obs || null,
      });
      toast.success('Entrada registrada. La moto está dentro.');
      onSuccess?.();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al registrar entrada.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography sx={{ fontWeight: 800 }}>Entrada por horas</Typography>
          <IconButton onClick={onClose} size="small"><Close /></IconButton>
        </Stack>
      </DialogTitle>

      <DialogContent dividers>
        <Alert severity="info" sx={{ mb: 2, fontSize: 13 }}>
          Se cobrará al momento de la salida según las horas que dure dentro.
        </Alert>

        <TextField
          fullWidth size="small" label="Placa *"
          value={placa}
          onChange={(e) => setPlaca(e.target.value.toUpperCase().replace(/[\s-]/g, '').slice(0, 10))}
          inputProps={{ style: { fontFamily: 'monospace', fontWeight: 700, letterSpacing: 2, textAlign: 'center' } }}
          sx={{ mb: 2 }}
        />

        <TextField
          fullWidth size="small" multiline rows={2}
          label="Observaciones (opcional)"
          placeholder="Ej: Moto roja, cliente joven con casco azul…"
          value={obs} onChange={(e) => setObs(e.target.value)}
        />
      </DialogContent>

      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} disabled={loading}>Cancelar</Button>
        <Button
          variant="contained" onClick={handleEntrada} disabled={loading}
          startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <Save />}
          sx={{ bgcolor: ACCENT, '&:hover': { bgcolor: '#e6561c' }, fontWeight: 700 }}
        >
          Registrar entrada
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export const EntradaHorasDialog         = ParqueaderoEntradaHorasDialog;
export default ParqueaderoEntradaHorasDialog;
