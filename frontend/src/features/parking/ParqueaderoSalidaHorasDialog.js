import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField,
  Box, Typography, Stack, Divider, MenuItem, InputAdornment,
  CircularProgress, IconButton, Chip, Switch, FormControlLabel
} from '@mui/material';
import {
  Close, Save, WhatsApp, OpenInNew, Print, CheckCircle, QrCode2
} from '@mui/icons-material';
import apiClient from '../../api';
import { toast } from 'react-toastify';
import { formatCurrency } from '../../utils/formatters';
import CurrencyField from '../../components/common/CurrencyField';
import { METODOS_PAGO_SIMPLE } from '../../utils/constants';
import { imprimirSalidaParqueadero } from '../../utils/printParqueadero';
import LinkPagoModal from '../../components/common/LinkPagoModal';

const ACCENT   = '#FF6020';
const WA_GREEN = '#25D366';
const GREEN    = '#10B981';
const RED      = '#EF4444';

export function ParqueaderoSalidaHorasDialog({ open, onClose, acceso, onSuccess }) {
  const [montoManual,    setMontoManual]   = useState('');
  const [metodoPago,     setMetodoPago]    = useState('Efectivo');
  const [obs,            setObs]           = useState('');
  const [config,         setConfig]        = useState(null);
  const [enviarWA,       setEnviarWA]      = useState(false);
  const [loading,        setLoading]       = useState(false);
  const [metodoLinkQR,     setMetodoLinkQR]    = useState(null);  // método "libre" con link/QR
  const [montoRecibido,    setMontoRecibido]   = useState('');    // para calculadora de vueltas
  const [linkPagoModalOpen, setLinkPagoModalOpen] = useState(false); // modal QR/link

  // Post-salida state
  const [salidaData, setSalidaData] = useState(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!open) return;
    apiClient.get('/parqueadero/config').then(({ data }) => setConfig(data));
    // Cargar config de link/QR desde la misma fuente que ventas y restaurante
    apiClient.get('/empresa/link-pago').then(({ data }) => {
      setMetodoLinkQR(data || null);
    }).catch(() => {});
    setMontoManual('');
    setMetodoPago('Efectivo');
    setObs('');
    setMontoRecibido('');
    setEnviarWA(!!acceso?.telefono);
    setSalidaData(null);
  }, [open]);

  const calcular = () => {
    if (!acceso?.fecha_entrada) return { minReales: 0, minCobrar: 0, monto: 0, detalle: '' };
    const entrada = new Date(acceso.fecha_entrada);
    const ahora = new Date();
    const minReales = Math.max(1, Math.round((ahora - entrada) / 60000));
    const cobroMin = config?.cobro_minimo_minutos || 0;
    const minCobrar = cobroMin > 0 ? Math.max(minReales, cobroMin) : minReales;

    if (config?.usar_tarifa_plena) {
      const umbral   = config?.fraccion_minutos || 480;
      const tarPlena = config?.tarifa_plena || 0;
      const tarMin   = config?.tarifa_minuto || 0;
      const periodos = Math.floor(minCobrar / umbral);
      const resto    = minCobrar % umbral;
      const monto    = Math.round(periodos * tarPlena + resto * tarMin);
      const umbralH  = (umbral / 60).toFixed(1).replace('.0', '');
      const fmt = v => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v);
      let detalle;
      if (periodos === 0) {
        detalle = `${minCobrar} min × ${fmt(tarMin)}/min`;
      } else if (resto === 0) {
        detalle = `${periodos} período${periodos !== 1 ? 's' : ''} de ${umbralH}h × ${fmt(tarPlena)}`;
      } else {
        detalle = `${periodos} × ${fmt(tarPlena)} + ${resto} min × ${fmt(tarMin)}/min`;
      }
      return { minReales, minCobrar, monto, detalle };
    }

    const monto = Math.round(minCobrar * (config?.tarifa_minuto || 0));
    return { minReales, minCobrar, monto, detalle: `${minCobrar} min × ${formatCurrency(config?.tarifa_minuto || 0)}` };
  };

  const { minReales, minCobrar, monto, detalle } = calcular();
  const cobroFinal = montoManual === '' ? monto : Number(montoManual);
  const aplicaCobroMinimo = minReales < minCobrar;

  // Lista de métodos: incluye Link/QR solo si existe configurado
  const metodosList = metodoLinkQR
    ? ['Efectivo', 'Link/QR', ...METODOS_PAGO_SIMPLE.filter(m => m !== 'Efectivo')]
    : METODOS_PAGO_SIMPLE;

  // Calculadora de vueltas
  const montoRecibidoNum = Number(montoRecibido) || 0;
  const devuelta = montoRecibidoNum > 0 ? montoRecibidoNum - cobroFinal : null;

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

      if (enviarWA && acceso.telefono) {
        try {
          const { data: wa } = await apiClient.post('/parqueadero/whatsapp/generar', {
            acceso_id:        acceso.id,
            telefono:         acceso.telefono,
            tipo:             'recibo_salida',
            monto_override:   cobroFinal,
            minutos:          minCobrar,
            metodo_pago_text: metodoPago,
          });
          if (wa.wa_url) window.open(wa.wa_url, '_blank', 'noopener');
        } catch (waErr) {
          console.warn('Salida registrada pero WhatsApp falló:', waErr);
        }
      }

      setSalidaData({ minCobrar, cobroFinal, metodoPago });
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al registrar salida.');
    } finally {
      setLoading(false);
    }
  };

  const handleImprimir = () => {
    if (!acceso || !salidaData) return;
    const printerSize = config?.tipo_impresora_parq || 'p80';
    imprimirSalidaParqueadero(acceso, salidaData.minCobrar, salidaData.cobroFinal, salidaData.metodoPago, config, printerSize);
  };

  const handleCerrarPostSalida = () => {
    onClose();
    onSuccess?.();
  };

  const horas = Math.floor(minReales / 60);
  const mins = minReales % 60;
  const tiempoLegible = horas > 0 ? `${horas}h ${mins}min` : `${minReales} min`;

  const preferirImpresion = config?.preferir_impresion;

  return (
    <>
    <Dialog
      open={open}
      onClose={salidaData ? handleCerrarPostSalida : onClose}
      maxWidth="xs"
      fullWidth
      disableEscapeKeyDown={!!salidaData}
      TransitionProps={{
        onExited: () => {
          setSalidaData(null);
          setMontoRecibido('');
        },
      }}
    >
      {salidaData ? (
        // ── Vista post-salida ──────────────────────────────────────────
        <>
          <DialogTitle>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Stack direction="row" spacing={1} alignItems="center">
                <CheckCircle sx={{ color: GREEN }} />
                <Typography sx={{ fontWeight: 800 }}>Salida registrada</Typography>
              </Stack>
              <IconButton onClick={handleCerrarPostSalida} size="small"><Close /></IconButton>
            </Stack>
          </DialogTitle>
          <DialogContent dividers>
            <Box sx={{ textAlign: 'center', mb: 3 }}>
              <Typography sx={{ fontSize: 28, fontWeight: 900, fontFamily: 'monospace', letterSpacing: 3, color: ACCENT }}>
                {acceso?.placa}
              </Typography>
              <Typography sx={{ fontSize: 22, fontWeight: 900, color: GREEN, mt: 1 }}>
                {formatCurrency(salidaData.cobroFinal)}
              </Typography>
              <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
                {salidaData.minCobrar} min · {salidaData.metodoPago}
              </Typography>
            </Box>
            <Stack spacing={1.5}>
              {preferirImpresion && (
                <Button fullWidth variant="contained" size="large" startIcon={<Print />}
                  onClick={handleImprimir}
                  sx={{ bgcolor: ACCENT, '&:hover': { bgcolor: '#e6561c' }, fontWeight: 700 }}
                >
                  Imprimir comprobante de salida
                </Button>
              )}
              {acceso?.telefono && (
                <Button fullWidth variant="contained" size="large" startIcon={<WhatsApp />}
                  onClick={async () => {
                    try {
                      const { data: wa } = await apiClient.post('/parqueadero/whatsapp/generar', {
                        acceso_id:        acceso.id,
                        telefono:         acceso.telefono,
                        tipo:             'recibo_salida',
                        monto_override:   salidaData.cobroFinal,
                        minutos:          salidaData.minCobrar,
                        metodo_pago_text: salidaData.metodoPago,
                      });
                      if (wa.wa_url) window.open(wa.wa_url, '_blank', 'noopener');
                    } catch {
                      toast.error('No se pudo generar el mensaje de WhatsApp.');
                    }
                  }}
                  sx={{ bgcolor: WA_GREEN, '&:hover': { bgcolor: '#1ebe5d' }, fontWeight: 700 }}
                >
                  Enviar recibo por WhatsApp
                </Button>
              )}
            </Stack>
          </DialogContent>
          <DialogActions sx={{ p: 2 }}>
            <Button onClick={handleCerrarPostSalida}>Cerrar</Button>
          </DialogActions>
        </>
      ) : (
        // ── Vista de cobro ─────────────────────────────────────────────
        <>
          <DialogTitle>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography sx={{ fontWeight: 800 }}>Registrar salida</Typography>
              <IconButton onClick={onClose} size="small"><Close /></IconButton>
            </Stack>
          </DialogTitle>

          <DialogContent dividers>
            {/* Placa y tiempo */}
            <Box sx={{ textAlign: 'center', mb: 2 }}>
              <Typography sx={{ fontSize: 28, fontWeight: 900, fontFamily: 'monospace', letterSpacing: 3, color: ACCENT }}>
                {acceso?.placa}
              </Typography>
              {acceso?.nombre_ocasional && (
                <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{acceso.nombre_ocasional}</Typography>
              )}
              <Typography sx={{ fontSize: 12, color: 'text.secondary', mt: 0.5 }}>
                Tiempo dentro: <strong>{tiempoLegible}</strong>
              </Typography>
            </Box>

            {/* Cobro calculado */}
            <Box sx={{ p: 2, bgcolor: 'rgba(16, 185, 129, 0.08)', borderRadius: 2, mb: 2, textAlign: 'center' }}>
              <Typography sx={{ fontSize: 11, color: 'text.secondary', textTransform: 'uppercase', fontWeight: 700, mb: 0.5 }}>
                Cobro
              </Typography>
              <Typography sx={{ fontSize: 28, fontWeight: 900, color: GREEN }}>
                {formatCurrency(monto)}
              </Typography>
              <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
                {detalle}
              </Typography>
              {aplicaCobroMinimo && (
                <Chip size="small"
                  label={config?.usar_tarifa_plena ? `Tarifa mínima: ${minCobrar} min` : `Cobro mínimo: ${minCobrar} min`}
                  sx={{ mt: 0.5, fontSize: 10, bgcolor: '#F59E0B20', color: '#78350F', fontWeight: 700 }} />
              )}
            </Box>

            {/* Monto manual */}
            <CurrencyField
              fullWidth size="small" label="Cobrar otro monto (descuento)"
              value={montoManual}
              onChange={(val) => setMontoManual(val)}
              placeholder={`${formatCurrency(monto)} (cálculo automático)`}
              sx={{ mb: 2 }}
            />

            {/* Método de pago */}
            <TextField
              fullWidth select size="small" label="Método de pago"
              value={metodoPago} onChange={(e) => { setMetodoPago(e.target.value); setMontoRecibido(''); }}
              sx={{ mb: 2 }}
            >
              {metodosList.map(m => (
                <MenuItem key={m} value={m}>
                  {m === 'Link/QR' ? (
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      <QrCode2 sx={{ fontSize: 16, color: '#7C3AED' }} />
                      <span>{metodoLinkQR?.nombre || 'Link / QR'}</span>
                    </Stack>
                  ) : m}
                </MenuItem>
              ))}
            </TextField>

            {/* ── Calculadora de vueltas (solo Efectivo) ── */}
            {metodoPago === 'Efectivo' && (
              <Box sx={{ mb: 2, p: 1.5, bgcolor: 'rgba(16,185,129,0.05)', borderRadius: 2, border: '1px solid rgba(16,185,129,0.2)' }}>
                <Typography sx={{ fontSize: 11, fontWeight: 700, color: 'text.secondary', mb: 1, textTransform: 'uppercase' }}>
                  Calculadora de vueltas
                </Typography>
                <CurrencyField
                  fullWidth size="small" label="Monto recibido del cliente"
                  value={montoRecibido}
                  onChange={(val) => setMontoRecibido(val)}
                  placeholder="0"
                />
                {devuelta !== null && (
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 1.5 }}>
                    <Typography sx={{ fontSize: 13, fontWeight: 600, color: 'text.secondary' }}>
                      {devuelta >= 0 ? 'Devuelta:' : 'Falta:'}
                    </Typography>
                    <Typography sx={{
                      fontSize: 20, fontWeight: 900,
                      color: devuelta >= 0 ? GREEN : RED,
                    }}>
                      {devuelta >= 0
                        ? formatCurrency(devuelta)
                        : `- ${formatCurrency(Math.abs(devuelta))}`}
                    </Typography>
                  </Stack>
                )}
              </Box>
            )}

            {/* Observaciones */}
            <TextField
              fullWidth size="small" multiline rows={2}
              label="Observaciones (opcional)"
              value={obs} onChange={(e) => setObs(e.target.value)}
            />

            {/* Toggle WhatsApp */}
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
              variant="contained"
              disabled={loading}
              onClick={() => {
                if (metodoPago === 'Link/QR' && metodoLinkQR) {
                  setLinkPagoModalOpen(true);
                } else {
                  handleSalida();
                }
              }}
              startIcon={loading ? <CircularProgress size={16} color="inherit" /> :
                         metodoPago === 'Link/QR' ? <QrCode2 /> :
                         enviarWA && acceso?.telefono ? <WhatsApp /> : <Save />}
              sx={{ bgcolor: GREEN, '&:hover': { bgcolor: '#059669' }, fontWeight: 700 }}
            >
              {metodoPago === 'Link/QR' ? 'Mostrar QR / Link' : `Cobrar ${formatCurrency(cobroFinal)}`}
            </Button>
          </DialogActions>
        </>
      )}
    </Dialog>

    {/* Modal QR / Link de pago — se abre cuando método = Link/QR */}
    {metodoLinkQR && (
      <LinkPagoModal
        open={linkPagoModalOpen}
        onClose={() => setLinkPagoModalOpen(false)}
        onConfirm={async () => {
          setLinkPagoModalOpen(false);
          await handleSalida();
        }}
        linkConfig={metodoLinkQR}
        clienteTelefono={acceso?.telefono || ''}
      />
    )}
    </>
  );
}

export const RegistrarSalidaHorasDialog = ParqueaderoSalidaHorasDialog;
export default ParqueaderoSalidaHorasDialog;
