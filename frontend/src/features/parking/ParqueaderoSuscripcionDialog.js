import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField,
  Box, Typography, Stack, RadioGroup, Radio, FormControlLabel, Alert,
  Divider, MenuItem, InputAdornment, CircularProgress, IconButton,
  Autocomplete, Chip
} from '@mui/material';
import { Close, TwoWheeler, Person, AttachMoney, Save, QrCode2, Print } from '@mui/icons-material';
import apiClient from '../../api';
import { toast } from 'react-toastify';
import { formatCurrency } from '../../utils/formatters';
import CurrencyField from '../../components/common/CurrencyField';
import { METODOS_PAGO_SIMPLE as METODOS_PAGO } from '../../utils/constants';
import { imprimirReciboSuscripcion } from '../../utils/printParqueadero';
import LinkPagoModal from '../../components/common/LinkPagoModal';
import { Switch } from '@mui/material';

const ACCENT = '#0891B2';


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
  const [metodoLinkQR, setMetodoLinkQR]   = useState(null);   // pago con Link/QR (igual que la salida)
  const [linkPagoModalOpen, setLinkPagoModalOpen] = useState(false);
  const [imprimir, setImprimir]           = useState(false);  // imprimir comprobante al cobrar

  // Cargar tarifas al abrir
  useEffect(() => {
    if (!open) return;
    apiClient.get('/parqueadero/config')
      .then(({ data }) => {
        setConfig(data);
        setImprimir(!!data?.preferir_impresion);
      })
      .catch(() => toast.error('No se pudo cargar la configuración de tarifas.'));
    apiClient.get('/empresa/link-pago').then(({ data }) => setMetodoLinkQR(data || null)).catch(() => {});
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
      // Comprobante impreso (Sunmi o navegador), homologado con la salida por horas
      if (imprimir && pagado > 0) {
        const nombreTipo = tipo === 'mensual' ? 'Mensualidad' : tipo === 'quincenal' ? 'Quincena' : 'Día';
        imprimirReciboSuscripcion({
          placa:       vehiculo.placa,
          cliente:     vehiculo.cliente_nombre,
          concepto:    nombreTipo,
          total:       montoFinal,
          pagado,
          saldo:       Math.max(0, montoFinal - pagado),
          metodo_pago: metodoPago,
        }, config, config?.tipo_impresora_parq || 'p80');
      }
      onSuccess?.();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al registrar.');
    } finally {
      setLoading(false);
    }
  };

  const metodosList = metodoLinkQR
    ? ['Efectivo', 'Link/QR', ...METODOS_PAGO.filter(m => m !== 'Efectivo')]
    : METODOS_PAGO;

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
          {metodosList.map(m => <MenuItem key={m} value={m}>{m}</MenuItem>)}
        </TextField>

        <FormControlLabel
          control={<Switch checked={imprimir} onChange={(e) => setImprimir(e.target.checked)} size="small" />}
          label={<Typography sx={{ fontSize: 13 }}>Imprimir comprobante</Typography>}
          sx={{ mb: 1 }}
        />

        <TextField
          fullWidth size="small" multiline rows={2}
          label="Observaciones (opcional)"
          value={obs} onChange={(e) => setObs(e.target.value)}
        />

        {/* Resumen */}
        <Box sx={{ mt: 2, p: 2, bgcolor: 'background.default', borderRadius: 2 }}>
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
          variant="contained" disabled={loading}
          onClick={() => {
            if (metodoPago === 'Link/QR' && metodoLinkQR) setLinkPagoModalOpen(true);
            else handleGuardar();
          }}
          startIcon={loading ? <CircularProgress size={16} color="inherit" /> : metodoPago === 'Link/QR' ? <QrCode2 /> : <Save />}
          sx={{ bgcolor: ACCENT, '&:hover': { bgcolor: '#0e7490' }, fontWeight: 700 }}
        >
          {metodoPago === 'Link/QR' ? 'Mostrar QR / Link' : 'Registrar'}
        </Button>
      </DialogActions>

      {/* Modal QR / Link de pago — homologado con la salida por horas */}
      <LinkPagoModal
        open={linkPagoModalOpen}
        onClose={() => setLinkPagoModalOpen(false)}
        onConfirm={async () => {
          setLinkPagoModalOpen(false);
          await handleGuardar();
        }}
        linkConfig={metodoLinkQR}
        clienteTelefono={vehiculo?.cliente_telefono || ''}
      />
    </Dialog>
  );
}
export const RegistrarSuscripcionDialog = ParqueaderoSuscripcionDialog;
export default ParqueaderoSuscripcionDialog;