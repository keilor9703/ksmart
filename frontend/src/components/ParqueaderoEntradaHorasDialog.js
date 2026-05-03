import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField,
  Box, Typography, Stack, Alert, Divider, MenuItem, InputAdornment,
  CircularProgress, IconButton, Chip, Switch, FormControlLabel
} from '@mui/material';
import {
  Close, Save, WhatsApp, Timer, Phone, Person, OpenInNew, AttachMoney
} from '@mui/icons-material';
import apiClient from '../api';
import { toast } from 'react-toastify';
import { formatCurrency } from '../utils/formatters';

const ACCENT = '#FF6020';
const WA_GREEN = '#25D366';
const METODOS_PAGO = ['Efectivo', 'Transferencia', 'Nequi', 'Daviplata', 'Tarjeta', 'Otro'];




// ═══════════════════════════════════════════════════════════════════════════
// 5. EntradaHorasDialog
//    Caso: cliente ocasional entra por horas
// ═══════════════════════════════════════════════════════════════════════════

export function ParqueaderoEntradaHorasDialog({
  open, onClose, placaSugerida, vehiculoId, onSuccess
}) {
  const [placa, setPlaca]               = useState('');
  const [nombre, setNombre]             = useState('');
  const [telefono, setTelefono]         = useState('');
  const [obs, setObs]                   = useState('');
  const [enviarWhatsApp, setEnviarWA]   = useState(true);
  const [sinTelefono, setSinTelefono]   = useState(false);
  const [config, setConfig]             = useState(null);
  const [loading, setLoading]           = useState(false);

  useEffect(() => {
    if (!open) return;
    setPlaca(placaSugerida || '');
    setNombre('');
    setTelefono('');
    setObs('');
    setEnviarWA(true);
    setSinTelefono(false);
    apiClient.get('/parqueadero/config').then(({ data }) => setConfig(data));
  }, [open, placaSugerida]);

  // Validar teléfono (mínimo 10 dígitos)
  const telefonoValido = telefono.replace(/\D/g, '').length >= 10;

  // Decidir si se enviará el WhatsApp
  const seEnviaraWA = enviarWhatsApp && !sinTelefono && telefonoValido;

  const handleEntrada = async () => {
    if (!placa || placa.length < 3) {
      toast.warning('La placa es obligatoria.');
      return;
    }
    if (!sinTelefono && !telefonoValido) {
      toast.warning('Ingresa un teléfono válido o marca "Sin teléfono".');
      return;
    }

    setLoading(true);
    try {
      const { data } = await apiClient.post('/parqueadero/accesos/entrada', {
        placa,
        vehiculo_id:      vehiculoId || null,
        nombre_ocasional: nombre.trim() || null,
        telefono:         sinTelefono ? null : (telefono.trim() || null),
        observaciones:    obs.trim() || null,
        enviar_whatsapp:  seEnviaraWA,
      });

      // Si hay wa_url, abrir WhatsApp en nueva pestaña
      if (data.wa_url) {
        window.open(data.wa_url, '_blank', 'noopener');
        toast.success('Entrada registrada. WhatsApp abierto, dale "enviar".');
      } else if (data.advertencia) {
        toast.info(data.advertencia);
      } else {
        toast.success('Entrada registrada.');
      }

      onSuccess?.();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al registrar entrada.');
    } finally {
      setLoading(false);
    }
  };

  // Calcular ejemplos de cobro
  const ejemplos = config?.tarifa_minuto > 0;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Stack direction="row" spacing={1} alignItems="center">
            <Timer sx={{ color: ACCENT }} />
            <Typography sx={{ fontWeight: 800 }}>Entrada por minutos</Typography>
          </Stack>
          <IconButton onClick={onClose} size="small"><Close /></IconButton>
        </Stack>
      </DialogTitle>

      <DialogContent dividers>

        <Alert severity="info" sx={{ mb: 2, fontSize: 12 }}>
          Se cobrará el tiempo exacto en minutos al momento de la salida.
        </Alert>

        {/* ─── Datos básicos ───────────────────────────────────── */}
        <Typography sx={{ fontSize: 12, fontWeight: 700, color: 'text.secondary', mb: 1, textTransform: 'uppercase' }}>
          Datos del vehículo
        </Typography>

        <TextField
          fullWidth size="small" label="Placa *"
          value={placa}
          onChange={(e) => setPlaca(e.target.value.toUpperCase().replace(/[\s-]/g, '').slice(0, 10))}
          inputProps={{
            style: { fontFamily: 'monospace', fontWeight: 700, letterSpacing: 2, textAlign: 'center' },
          }}
          sx={{ mb: 2 }}
        />

        {/* ─── ✨ NUEVO: Datos del cliente para WhatsApp ─────────── */}
        <Divider sx={{ my: 2 }}>
          <Chip label="Para enviar comprobante por WhatsApp" size="small"
            icon={<WhatsApp />} sx={{ fontWeight: 700, bgcolor: `${WA_GREEN}15`, color: WA_GREEN }} />
        </Divider>

        <Stack spacing={1.5}>
          <TextField
            fullWidth size="small" label="Nombre del cliente (opcional)"
            placeholder="Para personalizar el mensaje"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            disabled={sinTelefono}
            InputProps={{
              startAdornment: <InputAdornment position="start"><Person fontSize="small" /></InputAdornment>,
            }}
          />

          <TextField
            fullWidth size="small" label="Teléfono / WhatsApp"
            placeholder="3001234567"
            value={telefono}
            onChange={(e) => setTelefono(e.target.value.replace(/[^\d+\s]/g, ''))}
            disabled={sinTelefono}
            error={telefono.length > 0 && !telefonoValido && !sinTelefono}
            helperText={
              sinTelefono ? 'Sin teléfono — no se enviará WhatsApp' :
              telefono.length === 0 ? 'Mínimo 10 dígitos' :
              !telefonoValido ? 'Teléfono inválido' :
              '✓ Válido'
            }
            InputProps={{
              startAdornment: <InputAdornment position="start"><Phone fontSize="small" /></InputAdornment>,
            }}
          />

          <FormControlLabel
            control={
              <Switch checked={sinTelefono}
                onChange={(e) => {
                  setSinTelefono(e.target.checked);
                  if (e.target.checked) setEnviarWA(false);
                }}
              />
            }
            label={
              <Typography sx={{ fontSize: 13 }}>
                Sin teléfono / no quiere darlo
              </Typography>
            }
          />

          {!sinTelefono && telefonoValido && (
            <FormControlLabel
              control={
                <Switch
                  checked={enviarWhatsApp}
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
                    Enviar comprobante de entrada por WhatsApp
                  </Typography>
                </Stack>
              }
            />
          )}
        </Stack>

        {/* ─── Tarifa actual (informativa) ───────────────────── */}
        {ejemplos && (
          <Box sx={{ mt: 2, p: 2, bgcolor: 'background.default', borderRadius: 2 }}>
            <Typography sx={{ fontSize: 11, fontWeight: 700, color: 'text.secondary', mb: 1, textTransform: 'uppercase' }}>
              Tarifa actual
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" gap={0.5}>
              <Chip size="small" label={`${formatCurrency(config.tarifa_minuto)} / min`}
                sx={{ fontWeight: 700, bgcolor: `${ACCENT}15`, color: ACCENT }} />
              {config.tarifa_hora > 0 && (
                <Chip size="small" label={`${formatCurrency(config.tarifa_hora)} / hora (referencial)`}
                  sx={{ fontWeight: 600 }} />
              )}
              {config.cobro_minimo_minutos > 0 && (
                <Chip size="small" label={`Mín. ${config.cobro_minimo_minutos} min`}
                  sx={{ fontWeight: 600, bgcolor: '#F59E0B20', color: '#78350F' }} />
              )}
            </Stack>
          </Box>
        )}

        {!ejemplos && (
          <Alert severity="warning" sx={{ mt: 2, fontSize: 12 }}>
            No has configurado la tarifa por minuto. Hazlo en
            "Configuración → Cobro por minutos" antes de cobrar la salida.
          </Alert>
        )}

        <TextField
          fullWidth size="small" multiline rows={2}
          label="Observaciones (opcional)"
          placeholder="Ej: Moto roja, casco azul…"
          value={obs} onChange={(e) => setObs(e.target.value)}
          sx={{ mt: 2 }}
        />
      </DialogContent>

      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} disabled={loading}>Cancelar</Button>
        <Button
          variant="contained" onClick={handleEntrada} disabled={loading}
          startIcon={
            loading ? <CircularProgress size={16} color="inherit" /> :
            seEnviaraWA ? <OpenInNew /> : <Save />
          }
          sx={{
            bgcolor: seEnviaraWA ? WA_GREEN : ACCENT,
            '&:hover': { bgcolor: seEnviaraWA ? '#1ebe5d' : '#e6561c' },
            fontWeight: 700,
          }}
        >
          {seEnviaraWA ? 'Registrar y enviar WhatsApp' : 'Registrar entrada'}
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




export const EntradaHorasDialog         = ParqueaderoEntradaHorasDialog;
export default ParqueaderoEntradaHorasDialog;
