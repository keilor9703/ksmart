import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField,
  Box, Typography, Stack, Alert, Divider, InputAdornment,
  CircularProgress, IconButton, Chip, Switch, FormControlLabel
} from '@mui/material';
import {
  Close, Save, WhatsApp, Timer, Phone, Person, OpenInNew, Print,
  CheckCircle, Edit, Send, QrCode
} from '@mui/icons-material';
import { QRCodeCanvas } from 'qrcode.react';
import apiClient from '../../api';
import { toast } from 'react-toastify';
import { formatCurrency } from '../../utils/formatters';
import { METODOS_PAGO_SIMPLE as METODOS_PAGO } from '../../utils/constants';
import { imprimirEntradaParqueadero } from '../../utils/printParqueadero';

const ACCENT = '#FF6020';
const WA_GREEN = '#25D366';

export function ParqueaderoEntradaHorasDialog({
  open, onClose, placaSugerida, vehiculoId, onSuccess
}) {
  const [placa, setPlaca]             = useState('');
  const [nombre, setNombre]           = useState('');
  const [telefono, setTelefono]       = useState('');
  const [obs, setObs]                 = useState('');
  const [enviarWhatsApp, setEnviarWA] = useState(true);
  const [sinTelefono, setSinTelefono] = useState(false);
  const [config, setConfig]           = useState(null);
  const [loading, setLoading]         = useState(false);

  // Post-entrada state
  const [accesoCreado, setAccesoCreado] = useState(null);
  const [registroExitoso, setRegistroExitoso] = useState(false);

  // Edit phone state (after entry)
  const [editingPhone, setEditingPhone] = useState(false);
  const [nuevoTelefono, setNuevoTelefono] = useState('');
  const [savingPhone, setSavingPhone]   = useState(false);

  const qrCanvasRef = useRef(null);

  // ── Sólo se ejecuta cuando el diálogo se ABRE (open: false → true).
  // placaSugerida se captura en ese momento; no es dependencia para evitar
  // que un re-render del padre resetee el estado post-registro.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!open) return;
    setPlaca(placaSugerida || '');
    setNombre('');
    setTelefono('');
    setObs('');
    setEnviarWA(true);
    setSinTelefono(false);
    setAccesoCreado(null);
    setRegistroExitoso(false);
    setEditingPhone(false);
    setNuevoTelefono('');
    apiClient.get('/parqueadero/config').then(({ data }) => setConfig(data));
  }, [open]); // ← solo [open], no placaSugerida

  const telefonoValido = telefono.replace(/\D/g, '').length >= 10;
  const seEnviaraWA = enviarWhatsApp && !sinTelefono && telefonoValido;

  const handleEntrada = async () => {
    if (!placa || placa.length < 3) {
      toast.warning('La placa es obligatoria.');
      return;
    }
    if (!sinTelefono && telefono.length > 0 && !telefonoValido) {
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

      if (data.wa_url) {
        window.open(data.wa_url, '_blank', 'noopener');
      }

      setAccesoCreado(data.acceso);
      setRegistroExitoso(true);
      // onSuccess se llama al cerrar, no aquí
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al registrar entrada.');
    } finally {
      setLoading(false);
    }
  };

  const handleImprimir = useCallback(() => {
    if (!accesoCreado) return;
    const canvas = qrCanvasRef.current?.querySelector('canvas');
    const qrDataUrl = canvas ? canvas.toDataURL('image/png') : null;
    const printerSize = config?.tipo_impresora_parq || 'p80';
    imprimirEntradaParqueadero(accesoCreado, config, printerSize, qrDataUrl);
  }, [accesoCreado, config]);

  const handleReenviarWA = async () => {
    if (!accesoCreado?.id || !accesoCreado?.telefono) return;
    try {
      const { data: wa } = await apiClient.post(
        `/parqueadero/accesos/${accesoCreado.id}/whatsapp-comprobante`
      );
      if (wa.wa_url) window.open(wa.wa_url, '_blank', 'noopener');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'No se pudo generar el mensaje de WhatsApp.');
    }
  };

  const handleGuardarTelefono = async () => {
    const tel = nuevoTelefono.replace(/\D/g, '');
    if (tel.length < 10) {
      toast.warning('Ingresa un teléfono válido (mínimo 10 dígitos).');
      return;
    }
    setSavingPhone(true);
    try {
      await apiClient.patch(`/parqueadero/accesos/${accesoCreado.id}`, {
        telefono: nuevoTelefono.trim(),
      });
      setAccesoCreado(prev => ({ ...prev, telefono: nuevoTelefono.trim() }));
      setEditingPhone(false);
      toast.success('Teléfono actualizado.');
    } catch {
      toast.error('Error al actualizar el teléfono.');
    } finally {
      setSavingPhone(false);
    }
  };

  const ejemplos = config?.tarifa_minuto > 0;
  const preferirImpresion = config?.preferir_impresion;

  const handleCerrarPostEntrada = () => {
    onClose();
    if (registroExitoso) onSuccess?.();
  };

  // ── UN SOLO <Dialog> — el contenido cambia según accesoCreado.
  // Esto evita el ciclo montar/desmontar que causaba el parpadeo.
  return (
    <Dialog
      open={open}
      onClose={accesoCreado ? handleCerrarPostEntrada : onClose}
      maxWidth="sm"
      fullWidth
      disableEscapeKeyDown={!!accesoCreado}
      TransitionProps={{
        onExited: () => {
          // Limpiar estado post-entrada DESPUÉS de la animación de cierre,
          // para que al volver a abrir nunca se vea el flash naranja.
          setAccesoCreado(null);
          setRegistroExitoso(false);
        },
      }}
    >
      {accesoCreado ? (
        /* ── Vista post-entrada ─────────────────────────────────────────── */
        <>
          <DialogTitle>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Stack direction="row" spacing={1} alignItems="center">
                <CheckCircle sx={{ color: '#10B981' }} />
                <Typography sx={{ fontWeight: 800 }}>Entrada registrada</Typography>
              </Stack>
              <IconButton onClick={handleCerrarPostEntrada} size="small"><Close /></IconButton>
            </Stack>
          </DialogTitle>

          <DialogContent dividers>
            <Box sx={{ textAlign: 'center', mb: 2 }}>
              <Typography sx={{
                fontSize: 36, fontWeight: 900, fontFamily: 'monospace',
                letterSpacing: 4, color: ACCENT, lineHeight: 1.1,
              }}>
                {accesoCreado.placa}
              </Typography>
              <Typography sx={{ fontSize: 13, color: 'text.secondary', mt: 0.5 }}>
                Hora de entrada:{' '}
                <strong>
                  {new Date(accesoCreado.fecha_entrada).toLocaleTimeString('es-CO', {
                    hour: '2-digit', minute: '2-digit',
                  })}
                </strong>
              </Typography>
              {accesoCreado.nombre_ocasional && (
                <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
                  {accesoCreado.nombre_ocasional}
                </Typography>
              )}
            </Box>

            {/* QR oculto para imprimir */}
            <Box ref={qrCanvasRef} sx={{ display: 'none' }}>
              <QRCodeCanvas value={accesoCreado.placa} size={120} />
            </Box>

            {/* Teléfono + edición */}
            <Box sx={{ mb: 2 }}>
              {!editingPhone ? (
                <Stack direction="row" alignItems="center" spacing={1} justifyContent="center">
                  <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>
                    {accesoCreado.telefono
                      ? `📱 ${accesoCreado.telefono}`
                      : 'Sin teléfono registrado'}
                  </Typography>
                  <Button
                    size="small" variant="text" startIcon={<Edit fontSize="small" />}
                    onClick={() => {
                      setNuevoTelefono(accesoCreado.telefono || '');
                      setEditingPhone(true);
                    }}
                    sx={{ fontSize: 11, color: 'text.secondary' }}
                  >
                    {accesoCreado.telefono ? 'Corregir teléfono' : 'Agregar teléfono'}
                  </Button>
                </Stack>
              ) : (
                <Stack direction="row" spacing={1} alignItems="flex-start">
                  <TextField
                    size="small" label="Teléfono / WhatsApp" fullWidth
                    value={nuevoTelefono}
                    onChange={(e) => setNuevoTelefono(e.target.value.replace(/[^\d+\s]/g, ''))}
                    placeholder="3001234567"
                    InputProps={{
                      startAdornment: <InputAdornment position="start"><Phone fontSize="small" /></InputAdornment>,
                    }}
                    autoFocus
                  />
                  <Button
                    variant="contained" size="small" onClick={handleGuardarTelefono}
                    disabled={savingPhone}
                    sx={{ mt: 0.5, bgcolor: ACCENT, '&:hover': { bgcolor: '#e6561c' }, whiteSpace: 'nowrap' }}
                  >
                    {savingPhone ? <CircularProgress size={14} color="inherit" /> : 'Guardar'}
                  </Button>
                  <IconButton size="small" onClick={() => setEditingPhone(false)} sx={{ mt: 0.5 }}>
                    <Close fontSize="small" />
                  </IconButton>
                </Stack>
              )}
            </Box>

            {/* Botones de acción */}
            <Stack spacing={1.5}>
              {preferirImpresion && (
                <Button
                  fullWidth variant="contained" size="large"
                  startIcon={<Print />}
                  onClick={handleImprimir}
                  sx={{ bgcolor: ACCENT, '&:hover': { bgcolor: '#e6561c' }, fontWeight: 700, py: 1.5 }}
                >
                  Imprimir comprobante de entrada
                </Button>
              )}

              {accesoCreado.telefono && (
                <Button
                  fullWidth variant="contained" size="large"
                  startIcon={<WhatsApp />}
                  onClick={handleReenviarWA}
                  sx={{ bgcolor: WA_GREEN, '&:hover': { bgcolor: '#1ebe5d' }, fontWeight: 700, py: 1.5 }}
                >
                  Enviar comprobante por WhatsApp
                </Button>
              )}
            </Stack>
          </DialogContent>

          <DialogActions sx={{ p: 2 }}>
            <Button onClick={handleCerrarPostEntrada} variant="text">Cerrar</Button>
          </DialogActions>
        </>
      ) : (
        /* ── Vista de registro ──────────────────────────────────────────── */
        <>
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

            <Divider sx={{ my: 2 }}>
              <Chip label="Para enviar comprobante" size="small"
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
                  telefono.length === 0 ? 'Opcional' :
                  !telefonoValido ? 'Mínimo 10 dígitos' :
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
                label={<Typography sx={{ fontSize: 13 }}>Sin teléfono / no quiere darlo</Typography>}
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
                        Enviar comprobante por WhatsApp al registrar
                      </Typography>
                    </Stack>
                  }
                />
              )}
            </Stack>

            {ejemplos && (
              <Box sx={{ mt: 2, p: 2, bgcolor: 'background.default', borderRadius: 2 }}>
                <Typography sx={{ fontSize: 11, fontWeight: 700, color: 'text.secondary', mb: 1, textTransform: 'uppercase' }}>
                  Tarifa actual
                </Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap" gap={0.5}>
                  <Chip size="small" label={`${formatCurrency(config.tarifa_minuto)} / min`}
                    sx={{ fontWeight: 700, bgcolor: `${ACCENT}15`, color: ACCENT }} />
                  {config.tarifa_hora > 0 && (
                    <Chip size="small" label={`${formatCurrency(config.tarifa_hora)} / hora (ref.)`}
                      sx={{ fontWeight: 600 }} />
                  )}
                  {config.cobro_minimo_minutos > 0 && (
                    <Chip size="small" label={`Mín. ${config.cobro_minimo_minutos} min`}
                      sx={{ fontWeight: 600, bgcolor: '#F59E0B20', color: '#78350F' }} />
                  )}
                </Stack>
              </Box>
            )}

            {config !== null && !ejemplos && (
              <Alert severity="warning" sx={{ mt: 2, fontSize: 12 }}>
                No has configurado la tarifa por minuto. Hazlo en "Configuración → Cobro por minutos".
              </Alert>
            )}

            <TextField
              fullWidth size="small" multiline rows={2}
              label="Observaciones (opcional)"
              placeholder="Ej: Vehículo rojo, casco azul…"
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
        </>
      )}
    </Dialog>
  );
}

export const EntradaHorasDialog = ParqueaderoEntradaHorasDialog;
export default ParqueaderoEntradaHorasDialog;
