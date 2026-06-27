import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Box, Paper, TextField, InputAdornment, Typography, Button, Stack,
  CircularProgress, Chip, Avatar, Divider, IconButton, Alert,
  Dialog, DialogTitle, DialogContent, DialogActions
} from '@mui/material';
import {
  Search, TwoWheeler, DirectionsCar, CheckCircle, ErrorOutline, HelpOutline,
  AccessTime, Person, LocalParking, Logout, Refresh, ContentPaste,
  QrCodeScanner, CameraAlt, Edit, Close, Phone, Send
} from '@mui/icons-material';
import { useSearchParams } from 'react-router-dom';
import apiClient from '../../api';
import { toast } from 'react-toastify';
import { formatCurrency } from '../../utils/formatters';

import RegistrarSuscripcionDialog   from './ParqueaderoSuscripcionDialog';
import RegistrarVehiculoDialog      from './ParqueaderoVehiculoDialog';
import CobrarVencidoDialog          from './ParqueaderoCobrarVencidoDialog';
import RegistrarSalidaHorasDialog   from './ParqueaderoSalidaHorasDialog';
import EntradaHorasDialog           from './ParqueaderoEntradaHorasDialog';
import BotonWhatsApp                from '../../components/common/BotonWhatsApp';
import HelpGuideTopBar             from '../../components/onboarding/HelpGuideTopBar';

// ── Scanner globals ───────────────────────────────────────────────────────────
const HAS_BARCODE_DETECTOR = typeof window !== 'undefined' && 'BarcodeDetector' in window;
const HAS_CAMERA = typeof navigator !== 'undefined' && !!navigator?.mediaDevices?.getUserMedia;
const BARCODE_FORMATS = ['qr_code', 'code_128', 'code_39', 'ean_13', 'ean_8', 'upc_a', 'upc_e'];

// ── Paleta ────────────────────────────────────────────────────────────────────
const ACCENT = '#0891B2';

const formatPlaca = (raw) => {
  const clean = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (clean.length > 3) return `${clean.slice(0, 3)}-${clean.slice(3, 7)}`;
  return clean;
};
const SEMAFORO = {
  verde:    { bg: '#10B981', light: '#10B98115', text: '#065F46', label: 'AL DÍA'      },
  amarillo: { bg: '#F59E0B', light: '#F59E0B15', text: '#78350F', label: 'POR VENCER'  },
  rojo:     { bg: '#EF4444', light: '#EF444415', text: '#7F1D1D', label: 'VENCIDA'     },
  azul:     { bg: '#3B82F6', light: '#3B82F615', text: '#1E3A8A', label: 'NO REGISTRADA' },
  gris:     { bg: '#64748B', light: '#64748B15', text: '#1F1F1F', label: 'DENTRO'      },
};

export default function ParqueaderoBuscar() {
  const [placa, setPlaca]               = useState('');
  const [resultado, setResultado]       = useState(null);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState(null);
  const inputRef                        = useRef(null);
  const [searchParams]                  = useSearchParams();

  const [dlgSuscripcion,   setDlgSuscripcion]   = useState(false);
  const [dlgVehiculo,      setDlgVehiculo]      = useState(false);
  const [dlgVencido,       setDlgVencido]       = useState(false);
  const [dlgSalidaHoras,   setDlgSalidaHoras]   = useState(false);
  const [dlgEntradaHoras,  setDlgEntradaHoras]  = useState(false);
  const [dlgEditTelefono,  setDlgEditTelefono]  = useState(false);

  // Camera scanner state
  const [scannerOpen, setScannerOpen]   = useState(false);
  const videoRef    = useRef(null);
  const rAFRef      = useRef(null);
  const zxingRef    = useRef(null);
  const streamRef   = useRef(null);
  const cooldownRef = useRef(false);

  const cleanupCamera = useCallback(() => {
    cancelAnimationFrame(rAFRef.current);
    zxingRef.current?.stop?.();
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    if (!scannerOpen) {
      cleanupCamera();
    }
  }, [scannerOpen, cleanupCamera]);

  // ── Auto-focus al cargar y precargar desde query param ──────────────────
  useEffect(() => {
    inputRef.current?.focus();
    const placaParam = searchParams.get('placa');
    if (placaParam) {
      setPlaca(formatPlaca(placaParam));
      buscarConPlaca(placaParam);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const buscarConPlaca = async (placaInput) => {
    const placaLimpia = placaInput.trim().toUpperCase().replace(/[\s-]/g, '');
    if (placaLimpia.length < 3) {
      toast.warning('Ingresa al menos 3 caracteres de la placa.');
      return;
    }
    setLoading(true);
    setError(null);
    setResultado(null);
    try {
      const { data } = await apiClient.get(`/parqueadero/buscar/${placaLimpia}`);
      setResultado(data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al consultar la placa.');
    } finally {
      setLoading(false);
    }
  };

  const buscar = (e) => {
    e?.preventDefault();
    buscarConPlaca(placa);
  };

  const reset = () => {
    setPlaca('');
    setResultado(null);
    setError(null);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const pegarPlaca = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setPlaca(formatPlaca(text.trim()));
    } catch {
      toast.info('No se pudo acceder al portapapeles.');
    }
  };

  const onQrDetected = useCallback((rawValue) => {
    if (cooldownRef.current) return;
    cooldownRef.current = true;
    const placaLimpia = rawValue.trim().toUpperCase().replace(/[\s-]/g, '').slice(0, 7);
    if (placaLimpia.length >= 3) {
      setScannerOpen(false);
      setPlaca(formatPlaca(placaLimpia));
      buscarConPlaca(placaLimpia);
      toast.success(`Placa detectada: ${placaLimpia}`);
    }
    setTimeout(() => { cooldownRef.current = false; }, 2000);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startCamera = useCallback(async () => {
    if (!HAS_CAMERA) {
      toast.error('Cámara no disponible en este dispositivo.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      if (HAS_BARCODE_DETECTOR) {
        const detector = new window.BarcodeDetector({ formats: BARCODE_FORMATS });
        const loop = async () => {
          if (!videoRef.current || videoRef.current.readyState < 2) {
            rAFRef.current = requestAnimationFrame(loop);
            return;
          }
          try {
            const barcodes = await detector.detect(videoRef.current);
            if (barcodes.length > 0) {
              onQrDetected(barcodes[0].rawValue);
            }
          } catch {}
          rAFRef.current = requestAnimationFrame(loop);
        };
        rAFRef.current = requestAnimationFrame(loop);
      } else {
        // Fallback: @zxing/browser
        try {
          const { BrowserMultiFormatReader } = await import('@zxing/browser');
          const reader = new BrowserMultiFormatReader();
          zxingRef.current = reader;
          reader.decodeFromVideoElement(videoRef.current, (result, err) => {
            if (result) onQrDetected(result.getText());
          });
        } catch {
          toast.error('No se pudo iniciar el lector de QR.');
        }
      }
    } catch (err) {
      toast.error('No se pudo acceder a la cámara. Verifica los permisos.');
    }
  }, [onQrDetected]);

  useEffect(() => {
    if (scannerOpen) {
      setTimeout(() => startCamera(), 100);
    }
  }, [scannerOpen, startCamera]);

  const onAccionCompletada = () => {
    // Los diálogos de Entrada y Salida manejan su propio cierre en la vista post-registro.
    // Aquí solo cerramos los que no tienen vista post.
    setDlgSuscripcion(false);
    setDlgVehiculo(false);
    setDlgVencido(false);
    setDlgEditTelefono(false);
    if (resultado?.placa) {
      apiClient.get(`/parqueadero/buscar/${resultado.placa}`)
        .then(({ data }) => setResultado(data));
    }
  };

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto', p: { xs: 1, md: 2 } }}>

      {/* ─── Encabezado ──────────────────────────────────────────── */}
      <Box sx={{ position: 'relative', mb: 3 }}>
        <Box sx={{ position: 'absolute', top: 0, right: 0 }}>
          <HelpGuideTopBar
            moduleName="Buscar Placa"
            moduleColor={ACCENT}
            steps={[
              { title: 'Escribe la placa', description: 'Ingresa la placa completa del vehículo (ej: ABC123). El sistema buscará su registro automáticamente.' },
              { title: 'Escanea el QR', description: 'Si tienes el comprobante impreso, usa el botón de escáner para leer el QR y buscar al instante.' },
              { title: 'Registra la salida', description: 'Cuando el vehículo salga, busca la placa, calcula el tiempo y cobra el monto correspondiente.' },
              { title: 'Vehículo nuevo', description: 'Si la placa no existe, el sistema te permitirá registrar el vehículo y su propietario en el momento.' },
            ]}
            faqItems={[
              { q: '¿Cómo funciona el escáner QR?', a: 'Presiona el botón de QR para activar la cámara. Apunta al código QR del comprobante impreso o usa un lector USB/Bluetooth que escriba la placa automáticamente.' },
              { q: '¿Qué pasa si la placa no está registrada?', a: 'El sistema te mostrará la opción de registrar el vehículo como nuevo. Ingresa los datos del propietario y el tipo de vehículo.' },
              { q: '¿Cómo cobro a un vehículo por horas?', a: 'Registra la entrada al llegar. Al salir, busca la placa nuevamente, el sistema calcula el tiempo y el costo automáticamente.' },
              { q: '¿Qué significa que la suscripción está vencida?', a: 'El cliente no ha pagado la renovación mensual. Puedes cobrarla desde aquí o desde el módulo de Suscripciones.' },
            ]}
          />
        </Box>
        <Box sx={{ textAlign: 'center' }}>
          <Box sx={{
            width: 64, height: 64, borderRadius: '50%',
            background: `linear-gradient(135deg, ${ACCENT} 0%, #22D3EE 100%)`,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            mb: 1.5, boxShadow: `0 8px 24px ${ACCENT}40`,
          }}>
            <Search sx={{ fontSize: 32, color: 'white' }} />
          </Box>
          <Typography sx={{ fontSize: 22, fontWeight: 800, fontFamily: "'Geist', sans-serif" }}>
            Buscar placa
          </Typography>
          <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>
            Escribe la placa o escanea el QR del comprobante
          </Typography>
        </Box>
      </Box>

      {/* ─── Input ──────────────────────────────────────────────── */}
      <Paper elevation={0} sx={{
        p: 2, mb: 2, borderRadius: 3,
        border: '2px solid', borderColor: 'divider',
      }}>
        <Box component="form" onSubmit={buscar}>
          <TextField
            inputRef={inputRef}
            fullWidth autoFocus
            placeholder="ABC-123"
            value={placa}
            onChange={(e) => setPlaca(formatPlaca(e.target.value))}
            disabled={loading}
            inputProps={{
              maxLength: 8,
              style: {
                textAlign: 'center', textTransform: 'uppercase',
                fontWeight: 900, letterSpacing: 6, fontSize: 32,
                fontFamily: 'monospace',
              },
            }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <DirectionsCar sx={{ color: ACCENT, fontSize: 28 }} />
                </InputAdornment>
              ),
              endAdornment: (
                <InputAdornment position="end">
                  {HAS_CAMERA && (
                    <IconButton
                      onClick={() => setScannerOpen(true)}
                      title="Escanear QR"
                      size="small"
                      sx={{ color: ACCENT }}
                    >
                      <QrCodeScanner />
                    </IconButton>
                  )}
                  <IconButton onClick={pegarPlaca} title="Pegar" size="small">
                    <ContentPaste fontSize="small" />
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
          <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
            <Button
              type="submit"
              variant="contained" fullWidth size="large"
              disabled={loading || placa.length < 3}
              startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <Search />}
              sx={{
                bgcolor: ACCENT, py: 1.5, fontSize: 15, fontWeight: 800, borderRadius: 2,
                boxShadow: `0 6px 18px ${ACCENT}40`,
                '&:hover': { bgcolor: '#e6561c' },
              }}
            >
              {loading ? 'Consultando...' : 'Consultar'}
            </Button>
            {resultado && (
              <Button variant="outlined" size="large" onClick={reset}
                startIcon={<Refresh />} sx={{ minWidth: 130, borderRadius: 2 }}>
                Otra placa
              </Button>
            )}
          </Stack>
        </Box>
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{error}</Alert>}

      {resultado && (
        <ResultadoCard
          resultado={resultado}
          onCobrarVencido={() => setDlgVencido(true)}
          onRegistrarSuscripcion={() => setDlgSuscripcion(true)}
          onRegistrarVehiculo={() => setDlgVehiculo(true)}
          onRegistrarSalida={() => setDlgSalidaHoras(true)}
          onCobrarPorHoras={() => setDlgEntradaHoras(true)}
          onEditarTelefono={() => setDlgEditTelefono(true)}
        />
      )}

      {/* ─── Diálogos ───────────────────────────────────────────── */}
      {resultado && (
        <>
          <RegistrarSuscripcionDialog
            open={dlgSuscripcion} onClose={() => setDlgSuscripcion(false)}
            vehiculo={resultado.vehiculo} onSuccess={onAccionCompletada}
          />
          <RegistrarVehiculoDialog
            open={dlgVehiculo} onClose={() => setDlgVehiculo(false)}
            placaSugerida={resultado.placa} onSuccess={onAccionCompletada}
          />
          <CobrarVencidoDialog
            open={dlgVencido} onClose={() => setDlgVencido(false)}
            resultado={resultado} onSuccess={onAccionCompletada}
          />
          <RegistrarSalidaHorasDialog
            open={dlgSalidaHoras} onClose={() => setDlgSalidaHoras(false)}
            acceso={resultado.acceso_abierto} onSuccess={onAccionCompletada}
          />
          <EntradaHorasDialog
            open={dlgEntradaHoras} onClose={() => setDlgEntradaHoras(false)}
            placaSugerida={resultado.placa}
            vehiculoId={resultado.vehiculo?.id}
            onSuccess={onAccionCompletada}
          />
          {resultado.acceso_abierto && (
            <EditarTelefonoDialog
              open={dlgEditTelefono}
              onClose={() => setDlgEditTelefono(false)}
              acceso={resultado.acceso_abierto}
              onSuccess={onAccionCompletada}
            />
          )}
        </>
      )}

      {/* ─── Modal escáner cámara ────────────────────────────────── */}
      <Dialog
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        maxWidth="sm" fullWidth
      >
        <DialogTitle>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Stack direction="row" spacing={1} alignItems="center">
              <QrCodeScanner sx={{ color: ACCENT }} />
              <Typography sx={{ fontWeight: 800 }}>Escanear QR</Typography>
            </Stack>
            <IconButton onClick={() => setScannerOpen(false)} size="small"><Close /></IconButton>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2, fontSize: 12 }}>
            Apunta la cámara al QR del comprobante de entrada. La placa se leerá automáticamente.
          </Alert>
          <Box sx={{
            position: 'relative', borderRadius: 2, overflow: 'hidden',
            bgcolor: '#000', width: '100%',
            aspectRatio: '4/3',
          }}>
            <video
              ref={videoRef}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              playsInline muted
            />
            {/* Visor */}
            <Box sx={{
              position: 'absolute', top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
              width: 180, height: 180,
              border: '3px solid', borderColor: ACCENT,
              borderRadius: 2, pointerEvents: 'none',
              boxShadow: `0 0 0 2000px rgba(0,0,0,0.45)`,
            }} />
          </Box>
          <Typography sx={{ fontSize: 12, color: 'text.secondary', textAlign: 'center', mt: 1 }}>
            También puedes conectar un lector USB/Bluetooth — escribe la placa directamente en el campo de búsqueda
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setScannerOpen(false)}>Cancelar</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}


// ═══════════════════════════════════════════════════════════════════════════
// DIALOG EDITAR TELÉFONO
// ═══════════════════════════════════════════════════════════════════════════

function EditarTelefonoDialog({ open, onClose, acceso, onSuccess }) {
  const [telefono, setTelefono] = useState('');
  const [saving, setSaving] = useState(false);
  const WA_GREEN = '#25D366';

  useEffect(() => {
    if (open) setTelefono(acceso?.telefono || '');
  }, [open, acceso]);

  const telefonoValido = telefono.replace(/\D/g, '').length >= 10;

  const handleGuardar = async () => {
    if (!telefonoValido) return;
    setSaving(true);
    try {
      await apiClient.patch(`/parqueadero/accesos/${acceso.id}`, { telefono: telefono.trim() });
      toast.success('Teléfono actualizado.');
      onSuccess?.();
    } catch {
      toast.error('Error al actualizar el teléfono.');
    } finally {
      setSaving(false);
    }
  };

  const handleReenviarWA = async () => {
    if (!telefonoValido) return;
    setSaving(true);
    try {
      await apiClient.patch(`/parqueadero/accesos/${acceso.id}`, { telefono: telefono.trim() });

      const { data: waData } = await apiClient.post('/parqueadero/accesos/entrada', {
        placa: acceso.placa,
        nombre_ocasional: acceso.nombre_ocasional,
        telefono: telefono.trim(),
        enviar_whatsapp: true,
      }).catch(() => ({ data: null }));

      // Generar mensaje manual si no hay wa_url del backend
      const tel = telefono.trim().replace(/\D/g, '');
      const nombre = (acceso.nombre_ocasional || 'cliente').split(' ')[0];
      const horaEntrada = new Date(acceso.fecha_entrada).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
      const msg =
        `Hola ${nombre} 👋\n\n` +
        `Tu vehículo *${acceso.placa}* ingresó al parqueadero a las *${horaEntrada}*.\n\n` +
        `Se cobrará el tiempo exacto al momento de la salida.\n\n` +
        `¡Bienvenido!`;
      window.open(`https://wa.me/${tel}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener');

      toast.success('Teléfono actualizado y WhatsApp enviado.');
      onSuccess?.();
    } catch {
      toast.error('Error al actualizar o reenviar.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Stack direction="row" spacing={1} alignItems="center">
            <Edit sx={{ color: ACCENT }} />
            <Typography sx={{ fontWeight: 800 }}>Editar teléfono</Typography>
          </Stack>
          <IconButton onClick={onClose} size="small"><Close /></IconButton>
        </Stack>
      </DialogTitle>
      <DialogContent dividers>
        <Typography sx={{ fontSize: 13, color: 'text.secondary', mb: 2 }}>
          Vehículo <strong>{acceso?.placa}</strong> — ingresado a las{' '}
          {acceso?.fecha_entrada
            ? new Date(acceso.fecha_entrada).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
            : '—'}
        </Typography>
        <TextField
          fullWidth size="small" label="Teléfono / WhatsApp"
          placeholder="3001234567"
          value={telefono}
          onChange={(e) => setTelefono(e.target.value.replace(/[^\d+\s]/g, ''))}
          error={telefono.length > 0 && !telefonoValido}
          helperText={telefono.length > 0 && !telefonoValido ? 'Mínimo 10 dígitos' : ''}
          InputProps={{
            startAdornment: <InputAdornment position="start"><Phone fontSize="small" /></InputAdornment>,
          }}
          autoFocus
        />
      </DialogContent>
      <DialogActions sx={{ p: 2, gap: 1 }}>
        <Button onClick={onClose} disabled={saving}>Cancelar</Button>
        <Button
          variant="outlined" disabled={!telefonoValido || saving}
          startIcon={saving ? <CircularProgress size={14} color="inherit" /> : null}
          onClick={handleGuardar}
        >
          Solo guardar
        </Button>
        <Button
          variant="contained" disabled={!telefonoValido || saving}
          startIcon={<Send fontSize="small" />}
          onClick={handleReenviarWA}
          sx={{ bgcolor: WA_GREEN, '&:hover': { bgcolor: '#1ebe5d' }, fontWeight: 700 }}
        >
          Guardar y reenviar
        </Button>
      </DialogActions>
    </Dialog>
  );
}


// ═══════════════════════════════════════════════════════════════════════════
// CARD DE RESULTADO
// ═══════════════════════════════════════════════════════════════════════════

function ResultadoCard({
  resultado, onCobrarVencido, onRegistrarSuscripcion,
  onRegistrarVehiculo, onRegistrarSalida, onCobrarPorHoras, onEditarTelefono,
}) {
  const semaforo = SEMAFORO[resultado.color_semaforo] || SEMAFORO.gris;

  const mostrarWhatsApp =
    resultado.vehiculo &&
    resultado.vehiculo.cliente_telefono &&
    resultado.tipo_resultado !== 'vehiculo_no_registrado';

  const tipoMensaje =
    resultado.tipo_resultado === 'vehiculo_vencido'    ? 'pago' :
    resultado.tipo_resultado === 'vehiculo_al_dia' &&
      resultado.suscripcion_actual?.saldo_pendiente > 0 ? 'pago' :
    resultado.tipo_resultado === 'vehiculo_al_dia' &&
      resultado.suscripcion_actual?.dias_restantes <= 5 ? 'recordatorio' :
    'manual';

  return (
    <Paper sx={{
      borderRadius: 3, overflow: 'hidden',
      border: '2px solid', borderColor: semaforo.bg,
      boxShadow: `0 8px 32px ${semaforo.bg}30`,
    }}>
      {/* Header con semáforo */}
      <Box sx={{
        bgcolor: semaforo.bg, color: 'white',
        p: 3, textAlign: 'center', position: 'relative',
      }}>
        <IconoEstado tipo={resultado.tipo_resultado} />
        <Chip label={semaforo.label} size="small"
          sx={{
            bgcolor: 'rgba(255,255,255,0.25)', color: 'white',
            fontWeight: 800, fontSize: 11, letterSpacing: 1,
            mb: 1.5,
          }}
        />
        <Typography sx={{
          fontSize: 36, fontWeight: 900, fontFamily: 'monospace',
          letterSpacing: 4, lineHeight: 1.1,
        }}>
          {resultado.placa}
        </Typography>
        <Typography sx={{ fontSize: 14, mt: 1, opacity: 0.95, lineHeight: 1.4 }}>
          {resultado.mensaje}
        </Typography>
      </Box>

      <Box sx={{ p: 3 }}>

        {/* ── Vigente / Vencido ── */}
        {(resultado.tipo_resultado === 'vehiculo_al_dia' ||
          resultado.tipo_resultado === 'vehiculo_vencido') && (
          <>
            <DatosVehiculo veh={resultado.vehiculo} />
            <Divider sx={{ my: 2 }} />
            <DatosSuscripcion susc={resultado.suscripcion_actual} resultado={resultado} />

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 3 }}>
              {resultado.tipo_resultado === 'vehiculo_vencido' && (
                <Button
                  fullWidth variant="contained" size="large"
                  onClick={onCobrarVencido}
                  sx={{ bgcolor: '#EF4444', '&:hover': { bgcolor: '#dc2626' }, fontWeight: 700 }}
                >
                  Cobrar y dejar entrar
                </Button>
              )}
              {mostrarWhatsApp && (
                <Box sx={{ flex: 1 }}>
                  <BotonWhatsApp
                    vehiculoId={resultado.vehiculo.id}
                    suscripcionId={resultado.suscripcion_actual?.id}
                    tipo={tipoMensaje}
                    label={
                      resultado.tipo_resultado === 'vehiculo_vencido'
                        ? 'Cobrar por WhatsApp'
                        : 'Enviar por WhatsApp'
                    }
                    tamano="large"
                  />
                </Box>
              )}
            </Stack>

            {resultado.tipo_resultado === 'vehiculo_al_dia' &&
              resultado.suscripcion_actual?.saldo_pendiente > 0 && (
              <Alert severity="warning" sx={{ mt: 2, borderRadius: 2 }}>
                Tiene saldo pendiente de <strong>{formatCurrency(resultado.suscripcion_actual.saldo_pendiente)}</strong>.
              </Alert>
            )}
          </>
        )}

        {/* ── Sin suscripción ── */}
        {resultado.tipo_resultado === 'vehiculo_sin_susc' && (
          <>
            <DatosVehiculo veh={resultado.vehiculo} />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 3 }}>
              <Button
                fullWidth variant="contained" size="large"
                onClick={onRegistrarSuscripcion}
                sx={{ bgcolor: ACCENT, '&:hover': { bgcolor: '#e6561c' }, fontWeight: 700 }}
              >
                Registrar pago
              </Button>
              <Button variant="outlined" size="large" onClick={onCobrarPorHoras}>
                Por horas
              </Button>
              {mostrarWhatsApp && (
                <BotonWhatsApp
                  vehiculoId={resultado.vehiculo.id}
                  tipo="manual" label="WhatsApp" tamano="large"
                />
              )}
            </Stack>
          </>
        )}

        {/* ── No registrado ── */}
        {resultado.tipo_resultado === 'vehiculo_no_registrado' && (
          <>
            <Box sx={{ textAlign: 'center', py: 2, color: 'text.secondary' }}>
              <HelpOutline sx={{ fontSize: 48, opacity: 0.3, mb: 1 }} />
              <Typography sx={{ fontSize: 14 }}>
                Esta placa nunca se ha registrado en el parqueadero.
              </Typography>
            </Box>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 2 }}>
              <Button
                fullWidth variant="contained" size="large"
                onClick={onRegistrarVehiculo}
                sx={{ bgcolor: ACCENT, '&:hover': { bgcolor: '#e6561c' }, fontWeight: 700 }}
              >
                Registrar vehículo + pago
              </Button>
              <Button variant="outlined" size="large" onClick={onCobrarPorHoras}>
                Cobrar por horas
              </Button>
            </Stack>
          </>
        )}

        {/* ── Acceso abierto ── */}
        {resultado.tipo_resultado === 'tiene_acceso_abierto' && (
          <>
            <Box sx={{ bgcolor: 'background.default', borderRadius: 2, p: 2, mb: 2 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                <Typography sx={{ fontSize: 12, color: 'text.secondary', textTransform: 'uppercase', fontWeight: 700 }}>
                  Tiempo dentro
                </Typography>
                <AccessTime sx={{ color: '#64748B', fontSize: 18 }} />
              </Stack>
              <Typography sx={{ fontSize: 28, fontWeight: 900 }}>
                {resultado.horas_transcurridas?.toFixed(1)} horas
              </Typography>
              {resultado.acceso_abierto && (
                <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 0.5 }}>
                  <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
                    {resultado.acceso_abierto.nombre_ocasional
                      ? `👤 ${resultado.acceso_abierto.nombre_ocasional}`
                      : ''}
                    {resultado.acceso_abierto.telefono
                      ? `  📱 ${resultado.acceso_abierto.telefono}`
                      : '  Sin teléfono'}
                  </Typography>
                  <IconButton
                    size="small"
                    onClick={onEditarTelefono}
                    title={resultado.acceso_abierto.telefono ? 'Corregir teléfono' : 'Agregar teléfono'}
                    sx={{ color: 'text.secondary', p: 0.3 }}
                  >
                    <Edit sx={{ fontSize: 14 }} />
                  </IconButton>
                </Stack>
              )}
              <Divider sx={{ my: 1.5 }} />
              <Stack direction="row" justifyContent="space-between">
                <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>Cobro estimado</Typography>
                <Typography sx={{ fontSize: 18, fontWeight: 800, color: ACCENT }}>
                  {formatCurrency(resultado.monto_estimado)}
                </Typography>
              </Stack>
            </Box>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <Button
                fullWidth variant="contained" size="large"
                onClick={onRegistrarSalida}
                startIcon={<Logout />}
                sx={{ bgcolor: '#10B981', '&:hover': { bgcolor: '#059669' }, fontWeight: 700, py: 1.5 }}
              >
                Registrar salida y cobrar
              </Button>
              {mostrarWhatsApp && (
                <BotonWhatsApp
                  vehiculoId={resultado.vehiculo?.id}
                  tipo="pago"
                  montoOverride={resultado.monto_estimado}
                  label="Cobrar WhatsApp" tamano="large"
                />
              )}
            </Stack>
          </>
        )}

      </Box>
    </Paper>
  );
}


// ═══════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTES
// ═══════════════════════════════════════════════════════════════════════════

function IconoEstado({ tipo }) {
  const icon = {
    vehiculo_al_dia:        <CheckCircle  sx={{ fontSize: 56 }} />,
    vehiculo_vencido:       <ErrorOutline sx={{ fontSize: 56 }} />,
    vehiculo_sin_susc:      <HelpOutline  sx={{ fontSize: 56 }} />,
    vehiculo_no_registrado: <DirectionsCar sx={{ fontSize: 56 }} />,
    tiene_acceso_abierto:   <AccessTime   sx={{ fontSize: 56 }} />,
  }[tipo] || <LocalParking sx={{ fontSize: 56 }} />;
  return <Box sx={{ mb: 1.5, opacity: 0.95 }}>{icon}</Box>;
}

function DatosVehiculo({ veh }) {
  if (!veh) return null;
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
      <Avatar sx={{ bgcolor: ACCENT, width: 48, height: 48 }}>
        <Person />
      </Avatar>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontSize: 17, fontWeight: 700, lineHeight: 1.2 }} noWrap>
          {veh.cliente_nombre || '—'}
        </Typography>
        <Stack direction="row" spacing={1} sx={{ mt: 0.5, flexWrap: 'wrap', gap: 0.5 }}>
          {veh.cliente_cedula && (
            <Chip size="small" label={`CC ${veh.cliente_cedula}`} sx={{ fontSize: 11 }} />
          )}
          {veh.cliente_telefono && (
            <Chip size="small" label={`📱 ${veh.cliente_telefono}`} sx={{ fontSize: 11 }} />
          )}
          {(veh.marca || veh.modelo) && (
            <Chip size="small"
              label={`🚗 ${[veh.marca, veh.modelo].filter(Boolean).join(' ')}`}
              sx={{ fontSize: 11 }} />
          )}
          {veh.color && (
            <Chip size="small" label={veh.color} sx={{ fontSize: 11 }} />
          )}
        </Stack>
      </Box>
    </Box>
  );
}

function DatosSuscripcion({ susc, resultado }) {
  if (!susc) return null;
  const esVencida = resultado.tipo_resultado === 'vehiculo_vencido';
  const dias = esVencida ? resultado.dias_vencido : susc.dias_restantes;

  return (
    <Box sx={{
      bgcolor: esVencida ? 'rgba(239, 68, 68, 0.08)' : 'rgba(16, 185, 129, 0.08)',
      borderRadius: 2, p: 2,
    }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
        <Chip
          label={susc.tipo?.toUpperCase()} size="small"
          sx={{
            bgcolor: esVencida ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
            color: esVencida ? '#991B1B' : '#166534',
            fontWeight: 800, fontSize: 11,
          }}
        />
        <Typography sx={{
          fontSize: 13, fontWeight: 700,
          color: esVencida ? '#991B1B' : '#166534',
        }}>
          {esVencida
            ? `Vencida hace ${dias} día${dias !== 1 ? 's' : ''}`
            : `Vence en ${dias} día${dias !== 1 ? 's' : ''}`}
        </Typography>
      </Stack>

      <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
        <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>Inicio</Typography>
        <Typography sx={{ fontSize: 12, fontWeight: 600 }}>
          {fechaCorta(susc.fecha_inicio)}
        </Typography>
      </Stack>
      <Stack direction="row" justifyContent="space-between" sx={{ mb: 1.5 }}>
        <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>Vencimiento</Typography>
        <Typography sx={{
          fontSize: 12, fontWeight: 800,
          color: esVencida ? '#991B1B' : '#166534',
        }}>
          {fechaCorta(susc.fecha_vencimiento)}
        </Typography>
      </Stack>

      <Divider sx={{ my: 1 }} />

      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Box>
          <Typography sx={{ fontSize: 11, color: 'text.secondary', textTransform: 'uppercase', fontWeight: 700 }}>
            Pagado
          </Typography>
          <Typography sx={{ fontSize: 16, fontWeight: 800, color: '#10B981' }}>
            {formatCurrency(susc.monto_pagado)}
          </Typography>
        </Box>
        <Box sx={{ textAlign: 'right' }}>
          <Typography sx={{ fontSize: 11, color: 'text.secondary', textTransform: 'uppercase', fontWeight: 700 }}>
            Total
          </Typography>
          <Typography sx={{ fontSize: 16, fontWeight: 800 }}>
            {formatCurrency(susc.monto_total)}
          </Typography>
        </Box>
      </Stack>

      {susc.saldo_pendiente > 0 && (
        <Box sx={{ mt: 1, pt: 1, borderTop: '1px dashed', borderColor: 'divider', textAlign: 'center' }}>
          <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
            Saldo pendiente
          </Typography>
          <Typography sx={{ fontSize: 18, fontWeight: 900, color: '#EF4444' }}>
            {formatCurrency(susc.saldo_pendiente)}
          </Typography>
        </Box>
      )}
    </Box>
  );
}

function fechaCorta(fechaIso) {
  if (!fechaIso) return '—';
  const partes = fechaIso.split('T')[0].split('-');
  if (partes.length === 3) {
    const d = new Date(partes[0], partes[1] - 1, partes[2]);
    return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
  }
  const d = new Date(fechaIso);
  if (isNaN(d)) return fechaIso;
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
}
