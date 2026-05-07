import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField,
  Box, Typography, Stack, Alert, Divider, MenuItem, InputAdornment,
  CircularProgress, IconButton, Chip, Switch, FormControlLabel
} from '@mui/material';
import {
  Close, Save, WhatsApp, Timer, Phone, Person, OpenInNew, AttachMoney
} from '@mui/icons-material';
import apiClient from '../../api';
import { toast } from 'react-toastify';
import { formatCurrency } from '../../utils/formatters';
import CurrencyField from '../../components/common/CurrencyField';

const ACCENT = '#FF6020';
const WA_GREEN = '#25D366';
const METODOS_PAGO = ['Efectivo', 'Transferencia', 'Nequi', 'Daviplata', 'Tarjeta', 'Otro'];



// ═══════════════════════════════════════════════════════════════════════════
// 4. RegistrarSalidaHorasDialog
//    Caso: moto está dentro pagando por horas → cobrar al salir
// ═══════════════════════════════════════════════════════════════════════════
export function ParqueaderoSalidaHorasDialog({ open, onClose, acceso, onSuccess }) {
  const [montoManual, setMontoManual] = useState('');
  const [metodoPago, setMetodoPago]   = useState('Efectivo');
  const [obs, setObs]                 = useState('');
  const [config, setConfig]           = useState(null);
  const [enviarWA, setEnviarWA]       = useState(false);
  const [loading, setLoading]         = useState(false);

  useEffect(() => {
    if (!open) return;
    apiClient.get('/parqueadero/config').then(({ data }) => setConfig(data));
    setMontoManual(''); setMetodoPago('Efectivo'); setObs('');
    // Auto-marcar WhatsApp si hay teléfono
    setEnviarWA(!!acceso?.telefono);
  }, [open, acceso]);

  // Calcular minutos en vivo
  const calcular = () => {
    if (!acceso?.fecha_entrada) return { minReales: 0, minCobrar: 0, monto: 0 };
    const entrada = new Date(acceso.fecha_entrada);
    const ahora = new Date();
    const minReales = Math.max(1, Math.round((ahora - entrada) / 60000));
    const cobroMin = config?.cobro_minimo_minutos || 0;
    const minCobrar = cobroMin > 0 ? Math.max(minReales, cobroMin) : minReales;
    const monto = Math.round(minCobrar * (config?.tarifa_minuto || 0));
    return { minReales, minCobrar, monto };
  };

  const { minReales, minCobrar, monto } = calcular();
  const cobroFinal = montoManual === '' ? monto : Number(montoManual);
  const aplicaCobroMinimo = minReales < minCobrar;

  const handleSalida = async () => {
    if (!acceso?.id) return;
    setLoading(true);
    try {
      // 1. Registrar la salida
      await apiClient.post('/parqueadero/accesos/salida', {
        acceso_id:    acceso.id,
        metodo_pago:  metodoPago,
        monto_manual: montoManual === '' ? null : Number(montoManual),
        observaciones: obs || null,
      });

      // 2. Si se quiere enviar recibo por WhatsApp
      if (enviarWA && acceso.telefono) {
        try {
          const { data: wa } = await apiClient.post('/parqueadero/whatsapp/generar', {
            telefono: acceso.telefono,
            tipo:     'recibo_salida',
            monto_override: cobroFinal,
            mensaje_personalizado: construirMensajeRecibo(acceso, minCobrar, cobroFinal, metodoPago, config),
          });
          if (wa.wa_url) {
            window.open(wa.wa_url, '_blank', 'noopener');
          }
        } catch (waErr) {
          console.warn('Salida registrada pero WhatsApp falló:', waErr);
        }
      }

      toast.success(`Salida registrada. Cobro: ${formatCurrency(cobroFinal)}`);
      onSuccess?.();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al registrar salida.');
    } finally {
      setLoading(false);
    }
  };

  // Calcular tiempo en formato legible
  const horas = Math.floor(minReales / 60);
  const mins = minReales % 60;
  const tiempoLegible = horas > 0 ? `${horas}h ${mins}min` : `${minReales} min`;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography sx={{ fontWeight: 800 }}>Registrar salida</Typography>
          <IconButton onClick={onClose} size="small"><Close /></IconButton>
        </Stack>
      </DialogTitle>

      <DialogContent dividers>

        {/* Placa + cliente */}
        <Box sx={{ textAlign: 'center', mb: 2 }}>
          <Typography sx={{
            fontSize: 28, fontWeight: 900, fontFamily: 'monospace',
            letterSpacing: 3, color: ACCENT,
          }}>
            {acceso?.placa}
          </Typography>
          {acceso?.nombre_ocasional && (
            <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
              {acceso.nombre_ocasional}
            </Typography>
          )}
          <Typography sx={{ fontSize: 12, color: 'text.secondary', mt: 0.5 }}>
            Tiempo dentro: <strong>{tiempoLegible}</strong>
          </Typography>
        </Box>

        {/* Cobro automático */}
        <Box sx={{ p: 2, bgcolor: 'rgba(16, 185, 129, 0.08)', borderRadius: 2, mb: 2, textAlign: 'center' }}>
          <Typography sx={{ fontSize: 11, color: 'text.secondary', textTransform: 'uppercase', fontWeight: 700, mb: 0.5 }}>
            Cobro
          </Typography>
          <Typography sx={{ fontSize: 28, fontWeight: 900, color: '#10B981' }}>
            {formatCurrency(monto)}
          </Typography>
          <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
            {minCobrar} min × {formatCurrency(config?.tarifa_minuto || 0)}
          </Typography>
          {aplicaCobroMinimo && (
            <Chip size="small" label={`Cobro mínimo: ${minCobrar} min`}
              sx={{ mt: 0.5, fontSize: 10, bgcolor: '#F59E0B20', color: '#78350F', fontWeight: 700 }} />
          )}
        </Box>

        <CurrencyField
          fullWidth size="small" label="Cobrar otro monto (descuento)"
          value={montoManual}
          onChange={(val) => setMontoManual(val)}
          placeholder={`${formatCurrency(monto)} (cálculo automático)`}
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

        {/* Enviar recibo por WhatsApp */}
        {acceso?.telefono && (
          <FormControlLabel
            sx={{ mt: 1 }}
            control={
              <Switch
                checked={enviarWA}
                onChange={(e) => setEnviarWA(e.target.checked)}
                sx={{
                  '& .Mui-checked': { color: WA_GREEN },
                  '& .Mui-checked + .MuiSwitch-track': { bgcolor: WA_GREEN },
                }}
              />
            }
            label={
              <Stack direction="row" spacing={0.5} alignItems="center">
                <WhatsApp sx={{ fontSize: 16, color: WA_GREEN }} />
                <Typography sx={{ fontSize: 13, fontWeight: 600 }}>
                  Enviar recibo por WhatsApp ({acceso.telefono})
                </Typography>
              </Stack>
            }
          />
        )}
      </DialogContent>

      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} disabled={loading}>Cancelar</Button>
        <Button
          variant="contained" onClick={handleSalida} disabled={loading}
          startIcon={loading ? <CircularProgress size={16} color="inherit" /> :
                     enviarWA && acceso?.telefono ? <OpenInNew /> : <Save />}
          sx={{
            bgcolor: '#10B981', '&:hover': { bgcolor: '#059669' },
            fontWeight: 700,
          }}
        >
          Cobrar {formatCurrency(cobroFinal)}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function construirMensajeRecibo(acceso, minutos, monto, metodoPago, config) {
  const nombre = (acceso.nombre_ocasional || 'cliente').split(' ')[0];
  const parq = config?.nombre_parqueadero || 'el parqueadero';
  return (
    `Hola ${nombre} 👋\n\n` +
    `Confirmamos la salida de tu moto *${acceso.placa}* de *${parq}*.\n\n` +
    `📋 *Resumen:*\n` +
    `• Tiempo total: ${minutos} min\n` +
    `• Valor pagado: *${formatCurrency(monto)}*\n` +
    `• Método: ${metodoPago}\n\n` +
    `Gracias por preferirnos. ¡Vuelve pronto!`
  );
}

export const RegistrarSalidaHorasDialog = ParqueaderoSalidaHorasDialog;
export default ParqueaderoSalidaHorasDialog;