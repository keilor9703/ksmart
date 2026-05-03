// ═══════════════════════════════════════════════════════════════════════════
// BotonWhatsApp.jsx
// Componente reutilizable: botón de WhatsApp + diálogo con preview editable.
// Se usa desde ParqueaderoBuscar, Dashboard, Suscripciones, etc.
//
// Props:
//   vehiculoId        (opcional)  - ID del vehículo
//   suscripcionId     (opcional)  - ID de la suscripción
//   tipo              ('pago' | 'recordatorio' | 'manual') - default: 'pago'
//   telefono          (opcional)  - si no se pasa, se toma del cliente del vehículo
//   variante          ('icon' | 'button' | 'fab') - default: 'button'
//   label             (opcional)  - texto del botón ('Enviar WhatsApp' por defecto)
//   tamano            ('small' | 'medium' | 'large') - default: 'medium'
//   onSent            (callback)  - se llama después de enviar
//   disabled          (bool)
// ═══════════════════════════════════════════════════════════════════════════

import React, { useState } from 'react';
import {
  IconButton, Button, Tooltip, Dialog, DialogTitle, DialogContent, DialogActions,
  Box, Typography, TextField, Stack, Alert, CircularProgress, Chip, Divider,
  ToggleButton, ToggleButtonGroup
} from '@mui/material';
import { WhatsApp, Close, Send, ContentCopy, QrCode2, OpenInNew } from '@mui/icons-material';
import apiClient from '../api';
import { toast } from 'react-toastify';

const WA_GREEN = '#25D366';

export default function BotonWhatsApp({
  vehiculoId,
  suscripcionId,
  tipo = 'pago',
  telefono,
  variante = 'button',
  label = 'WhatsApp',
  tamano = 'medium',
  onSent,
  disabled = false,
  montoOverride = null,
}) {
  const [open, setOpen] = useState(false);

  // Disparador (renderizado según variante)
  const handleOpen = (e) => {
    e?.stopPropagation();
    setOpen(true);
  };

  let trigger;
  if (variante === 'icon') {
    trigger = (
      <Tooltip title={label}>
        <IconButton
          size={tamano === 'large' ? 'medium' : 'small'}
          onClick={handleOpen}
          disabled={disabled}
          sx={{ color: WA_GREEN }}
        >
          <WhatsApp fontSize={tamano === 'large' ? 'medium' : 'small'} />
        </IconButton>
      </Tooltip>
    );
  } else if (variante === 'fab') {
    trigger = (
      <Button
        variant="contained" startIcon={<WhatsApp />}
        onClick={handleOpen} disabled={disabled}
        sx={{
          bgcolor: WA_GREEN, color: 'white', borderRadius: '50px',
          fontWeight: 800, py: 1.2, px: 3,
          boxShadow: `0 6px 20px ${WA_GREEN}50`,
          '&:hover': { bgcolor: '#1ebe5d' },
        }}
      >
        {label}
      </Button>
    );
  } else {
    trigger = (
      <Button
        variant="contained"
        size={tamano === 'small' ? 'small' : 'medium'}
        startIcon={<WhatsApp />}
        onClick={handleOpen}
        disabled={disabled}
        sx={{
          bgcolor: WA_GREEN, color: 'white', fontWeight: 700,
          '&:hover': { bgcolor: '#1ebe5d' },
        }}
      >
        {label}
      </Button>
    );
  }

  return (
    <>
      {trigger}
      {open && (
        <WhatsAppDialog
          open={open}
          onClose={() => setOpen(false)}
          vehiculoId={vehiculoId}
          suscripcionId={suscripcionId}
          tipoInicial={tipo}
          telefono={telefono}
          montoOverride={montoOverride}
          onSent={() => {
            setOpen(false);
            onSent?.();
          }}
        />
      )}
    </>
  );
}


// ═══════════════════════════════════════════════════════════════════════════
// DIÁLOGO — Preview del mensaje + envío
// ═══════════════════════════════════════════════════════════════════════════

function WhatsAppDialog({
  open, onClose, vehiculoId, suscripcionId, tipoInicial,
  telefono, montoOverride, onSent
}) {
  const [tipo, setTipo]                 = useState(tipoInicial);
  const [loading, setLoading]           = useState(false);
  const [generando, setGenerando]       = useState(false);
  const [data, setData]                 = useState(null);
  const [mensajeEditado, setMensaje]    = useState('');
  const [error, setError]               = useState(null);

  // Cargar el mensaje generado al abrir o cambiar tipo
  React.useEffect(() => {
    if (!open) return;
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tipo]);

  const cargar = async () => {
    setGenerando(true);
    setError(null);
    try {
      const { data: resp } = await apiClient.post('/parqueadero/whatsapp/generar', {
        vehiculo_id:     vehiculoId,
        suscripcion_id:  suscripcionId,
        telefono:        telefono,
        tipo,
        monto_override:  montoOverride,
      });
      setData(resp);
      setMensaje(resp.mensaje);
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al generar el mensaje.');
    } finally {
      setGenerando(false);
    }
  };

  // Cuando el usuario edita, regeneramos el wa_url manualmente sin llamar API
  const waUrlConMensajeEditado = () => {
    if (!data) return null;
    const mensajeFinal = mensajeEditado || data.mensaje;
    const encoded = encodeURIComponent(mensajeFinal);
    return `https://wa.me/${data.telefono}?text=${encoded}`;
  };

  const handleEnviar = async () => {
    const url = waUrlConMensajeEditado();
    if (!url) return;
    setLoading(true);
    try {
      // Si el mensaje fue editado, registrar el envío con el nuevo texto
      if (mensajeEditado !== data.mensaje) {
        await apiClient.post('/parqueadero/whatsapp/generar', {
          vehiculo_id:    vehiculoId,
          suscripcion_id: suscripcionId,
          telefono:       data.telefono,
          tipo,
          monto_override: montoOverride,
          mensaje_personalizado: mensajeEditado,
        });
      }
      // Abrir WhatsApp en nueva pestaña
      window.open(url, '_blank', 'noopener');
      toast.success('Mensaje listo en WhatsApp. Pulsa "enviar" para que llegue al cliente.');
      onSent?.();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al registrar el envío.');
    } finally {
      setLoading(false);
    }
  };

  const copiarMensaje = async () => {
    try {
      await navigator.clipboard.writeText(mensajeEditado);
      toast.info('Mensaje copiado al portapapeles.');
    } catch {
      toast.warning('No se pudo copiar.');
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ pb: 1 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Stack direction="row" spacing={1} alignItems="center">
            <WhatsApp sx={{ color: WA_GREEN }} />
            <Typography sx={{ fontWeight: 800 }}>Enviar por WhatsApp</Typography>
          </Stack>
          <IconButton onClick={onClose} size="small"><Close /></IconButton>
        </Stack>
        {data?.telefono && (
          <Typography sx={{ fontSize: 12, color: 'text.secondary', mt: 0.3 }}>
            📱 +{data.telefono}
            {data.metodo_nombre && ` · Método: ${data.metodo_nombre}`}
          </Typography>
        )}
      </DialogTitle>

      <DialogContent dividers>

        {/* Selector de tipo de mensaje */}
        <Typography sx={{ fontSize: 12, fontWeight: 700, color: 'text.secondary', mb: 1, textTransform: 'uppercase' }}>
          Tipo de mensaje
        </Typography>
        <ToggleButtonGroup
          exclusive value={tipo} onChange={(_, v) => v && setTipo(v)}
          size="small" fullWidth
          sx={{ mb: 2 }}
        >
          <ToggleButton value="pago" sx={{ fontWeight: 700, fontSize: 12 }}>
            💰 Pago
          </ToggleButton>
          <ToggleButton value="recordatorio" sx={{ fontWeight: 700, fontSize: 12 }}>
            🔔 Recordatorio
          </ToggleButton>
          <ToggleButton value="manual" sx={{ fontWeight: 700, fontSize: 12 }}>
            📝 Manual
          </ToggleButton>
        </ToggleButtonGroup>

        {/* Estado de carga / error */}
        {generando && (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <CircularProgress size={28} />
            <Typography sx={{ fontSize: 12, color: 'text.secondary', mt: 1 }}>
              Generando mensaje...
            </Typography>
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
        )}

        {/* Advertencia (ej. método de pago no configurado) */}
        {data?.advertencia && !error && (
          <Alert severity="warning" sx={{ mb: 2, fontSize: 12 }}>
            {data.advertencia}
          </Alert>
        )}

        {/* Preview / editor del mensaje */}
        {data && !generando && (
          <>
            <Typography sx={{ fontSize: 12, fontWeight: 700, color: 'text.secondary', mb: 1, textTransform: 'uppercase' }}>
              Mensaje (editable)
            </Typography>
            <TextField
              fullWidth multiline minRows={8} maxRows={16}
              value={mensajeEditado}
              onChange={(e) => setMensaje(e.target.value)}
              sx={{
                '& .MuiOutlinedInput-root': {
                  fontFamily: 'monospace', fontSize: 13,
                  bgcolor: 'background.default',
                },
              }}
            />
            <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
              <Chip size="small" label={`${mensajeEditado.length} caracteres`}
                sx={{ fontSize: 10, height: 22 }} />
              <Button size="small" startIcon={<ContentCopy />} onClick={copiarMensaje}
                sx={{ fontSize: 11, py: 0.3 }}>
                Copiar
              </Button>
            </Stack>

            {/* QR opcional */}
            {data.tiene_qr && data.qr_data_uri && (
              <>
                <Divider sx={{ my: 2 }}>
                  <Chip size="small" icon={<QrCode2 />} label="Código QR de pago"
                    sx={{ fontWeight: 700, bgcolor: '#FEF3C7' }} />
                </Divider>
                <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'background.default', borderRadius: 2 }}>
                  <img src={data.qr_data_uri} alt="QR de pago"
                    style={{ maxWidth: 200, maxHeight: 200, borderRadius: 8 }} />
                  <Typography sx={{ fontSize: 11, color: 'text.secondary', mt: 1 }}>
                    El cliente debe escanear este QR para pagar
                  </Typography>
                  <Typography sx={{ fontSize: 11, color: 'warning.main', fontWeight: 700, mt: 0.5 }}>
                    ⚠️ WhatsApp no permite enviar imágenes desde wa.me/.
                    Después de mandar el mensaje, adjunta este QR manualmente.
                  </Typography>
                </Box>
              </>
            )}
          </>
        )}

      </DialogContent>

      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} disabled={loading}>Cancelar</Button>
        <Button
          variant="contained" onClick={handleEnviar}
          disabled={loading || generando || !data}
          startIcon={loading ? <CircularProgress size={16} color="inherit" /> :
                     <OpenInNew />}
          sx={{ bgcolor: WA_GREEN, '&:hover': { bgcolor: '#1ebe5d' }, fontWeight: 700 }}
        >
          Abrir WhatsApp
        </Button>
      </DialogActions>
    </Dialog>
  );
}
