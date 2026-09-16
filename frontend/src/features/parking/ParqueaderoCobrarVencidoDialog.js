import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField,
  Box, Typography, Stack, RadioGroup, Radio, FormControlLabel, Alert,
  Divider, MenuItem, InputAdornment, CircularProgress, IconButton,
  useTheme // ✨ NUEVO IMPORT
} from '@mui/material';
import { Close, Save, QrCode2 } from '@mui/icons-material';
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
// 3. CobrarVencidoDialog
//    Caso: mensualidad vencida → operario decide cómo cobrar
//    Lógica: se le pregunta SI entró durante esos días o NO
// ═══════════════════════════════════════════════════════════════════════════

export function ParqueaderoCobrarVencidoDialog({ open, onClose, resultado, onSuccess }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark'; // ✨ Detectamos el modo

  // Paleta dinámica
  const redBg = isDark ? 'rgba(239, 68, 68, 0.15)' : '#FEF2F2';
  const redText = isDark ? '#FCA5A5' : '#991B1B';
  const greenBg = isDark ? 'rgba(16, 185, 129, 0.15)' : '#F0FDF4';
  const darkBoxBg = isDark ? 'rgba(0, 0, 0, 0.4)' : '#1F1F1F';
  const borderStyle = isDark ? '1px solid rgba(255,255,255,0.08)' : 'none';

  const [entroEnVencidos, setEntroEnVencidos] = useState('no');  // 'no' | 'si'
  const [diasEntro, setDiasEntro]             = useState('');
  const [tipoRetro, setTipoRetro]             = useState('mensual');
  const [crearNueva, setCrearNueva]           = useState(true);
  const [tipoNueva, setTipoNueva]             = useState('mensual');
  const [montoPagado, setMontoPagado]         = useState('');
  const [metodoPago, setMetodoPago]           = useState('Efectivo');
  const [config, setConfig]                   = useState(null);
  const [obs, setObs]                         = useState('');
  const [loading, setLoading]                 = useState(false);
  const [metodoLinkQR, setMetodoLinkQR]       = useState(null);   // pago con Link/QR
  const [linkPagoModalOpen, setLinkPagoModalOpen] = useState(false);
  const [imprimir, setImprimir]               = useState(false);  // imprimir comprobante

  // Reset SOLO al abrir el diálogo. Antes dependía de `resultado` (un objeto
  // nuevo en cada refetch del padre) y borraba lo que el operario ya escribió.
  useEffect(() => {
    if (!open) return;
    apiClient.get('/parqueadero/config').then(({ data }) => {
      setConfig(data);
      setImprimir(!!data?.preferir_impresion);
    });
    apiClient.get('/empresa/link-pago').then(({ data }) => setMetodoLinkQR(data || null)).catch(() => {});
    setEntroEnVencidos('no');
    setDiasEntro(String(resultado?.dias_vencido || 1));
    setTipoRetro('mensual');
    setCrearNueva(true);
    setTipoNueva('mensual');
    setMontoPagado('');
    setMetodoPago('Efectivo');
    setObs('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const tarifa = (t) => {
    if (!config) return 0;
    if (t === 'mensual')   return config.tarifa_mensual;
    if (t === 'quincenal') return config.tarifa_quincenal;
    if (t === 'diaria')    return config.tarifa_diaria;
    return 0;
  };

  // Nunca cobrar más días de los realmente vencidos (el max del input no
  // impide teclearlo a mano).
  const maxDias = Number(resultado?.dias_vencido || 1);
  const dias = Math.min(Math.max(Number(diasEntro || 0), 0), maxDias);
  const totalRetro = entroEnVencidos === 'no' ? 0 :
    (tipoRetro === 'diaria' ? tarifa('diaria') * dias : tarifa(tipoRetro));
  const totalNueva = (entroEnVencidos === 'no' || crearNueva) ? tarifa(tipoNueva) : 0;
  const total = totalRetro + totalNueva;
  const pagaAhora = montoPagado === '' ? total : Number(montoPagado);

  const handleCobrar = async () => {
    if (!resultado?.vehiculo?.id) return;
    setLoading(true);
    try {
      if (entroEnVencidos === 'no') {
        // Caso simple: solo cobramos nueva suscripción desde HOY
        await apiClient.post('/parqueadero/suscripciones', {
          vehiculo_id:          resultado.vehiculo.id,
          tipo:                 tipoNueva,
          monto_pagado:         pagaAhora,
          metodo_pago_inicial: metodoPago,
          observaciones:        obs || 'Renovación tras vencimiento (no entró en días vencidos).',
        });
      } else {
        // Caso retroactivo
        await apiClient.post('/parqueadero/suscripciones/retroactiva', {
          vehiculo_id:              resultado.vehiculo.id,
          tipo_retroactivo:         tipoRetro,
          dias_vencidos_a_cobrar:   dias,
          crear_nueva_desde_hoy:    crearNueva,
          tipo_nueva_suscripcion:   crearNueva ? tipoNueva : null,
          monto_pagado_total:       pagaAhora,
          metodo_pago:              metodoPago,
          observaciones:            obs || null,
        });
      }
      toast.success('Cobro registrado correctamente.');
      // Comprobante impreso (Sunmi o navegador), homologado con la salida por horas
      if (imprimir && pagaAhora > 0) {
        imprimirReciboSuscripcion({
          placa:       resultado?.placa || resultado?.vehiculo?.placa,
          cliente:     resultado?.vehiculo?.cliente_nombre,
          concepto:    entroEnVencidos === 'no' ? 'Renovación suscripción' : 'Días vencidos + renovación',
          total,
          pagado:      pagaAhora,
          saldo:       Math.max(0, total - pagaAhora),
          metodo_pago: metodoPago,
        }, config, config?.tipo_impresora_parq || 'p80');
      }
      onSuccess?.();
      onClose?.();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al registrar el cobro.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ bgcolor: redBg, borderBottom: borderStyle }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography sx={{ fontWeight: 800, color: redText }}>
            Cobrar mensualidad vencida
          </Typography>
          <IconButton onClick={onClose} size="small" sx={{ color: redText }}><Close /></IconButton>
        </Stack>
        <Typography sx={{ fontSize: 12, color: redText, mt: 0.5, opacity: 0.8 }}>
          {resultado?.placa} · Vencida hace {resultado?.dias_vencido} día{resultado?.dias_vencido !== 1 ? 's' : ''}
        </Typography>
      </DialogTitle>

      <DialogContent dividers>
        <Alert severity="warning" sx={{ mb: 2, fontSize: 13 }}>
          ¿El vehículo entró al parqueadero durante los días que estuvo vencida la mensualidad?
        </Alert>

        <RadioGroup value={entroEnVencidos} onChange={(e) => setEntroEnVencidos(e.target.value)} sx={{ mb: 2 }}>
          <FormControlLabel value="no" control={<Radio />}
            label={<Typography sx={{ fontSize: 14 }}>
              <strong>No entró</strong> · Solo cobrar nueva mensualidad desde hoy
            </Typography>}
          />
          <FormControlLabel value="si" control={<Radio />}
            label={<Typography sx={{ fontSize: 14 }}>
              <strong>Sí entró</strong> · Cobrar los días vencidos como deuda
            </Typography>}
          />
        </RadioGroup>

        {/* Caso "sí entró" */}
        {entroEnVencidos === 'si' && (
          <Box sx={{ p: 2, bgcolor: redBg, borderRadius: 2, mb: 2, border: borderStyle }}>
            <Typography sx={{ fontSize: 12, fontWeight: 700, mb: 1, color: redText, textTransform: 'uppercase' }}>
              Cobro de deuda
            </Typography>
            <TextField
              fullWidth size="small" label="¿Cuántos días entró?"
              type="number" inputProps={{ min: 1, max: resultado?.dias_vencido }}
              value={diasEntro} onChange={(e) => setDiasEntro(e.target.value)}
              helperText={`Máximo ${resultado?.dias_vencido} días vencidos`}
              sx={{ mb: 1.5 }}
            />
            <Typography sx={{ fontSize: 12, fontWeight: 600, mb: 1 }}>
              ¿Cómo cobrar esos {dias} día{dias !== 1 ? 's' : ''}?
            </Typography>
            <RadioGroup row value={tipoRetro} onChange={(e) => setTipoRetro(e.target.value)}>
              <FormControlLabel value="diaria" control={<Radio size="small" />}
                label={<Typography sx={{ fontSize: 12 }}>Por día ({formatCurrency(tarifa('diaria'))})</Typography>} />
              <FormControlLabel value="mensual" control={<Radio size="small" />}
                label={<Typography sx={{ fontSize: 12 }}>Como mensualidad ({formatCurrency(tarifa('mensual'))})</Typography>} />
            </RadioGroup>
            <Typography sx={{ fontSize: 13, mt: 1 }}>
              Subtotal deuda: <strong>{formatCurrency(totalRetro)}</strong>
            </Typography>
          </Box>
        )}

        {/* Crear nueva desde hoy */}
        <Box sx={{ p: 2, bgcolor: greenBg, borderRadius: 2, mb: 2, border: borderStyle }}>
          {entroEnVencidos === 'si' && (
            <FormControlLabel
              control={<Radio
                checked={crearNueva}
                onClick={() => setCrearNueva(!crearNueva)}
              />}
              label={<Typography sx={{ fontSize: 13, fontWeight: 700 }}>
                Además, crear nueva suscripción desde HOY
              </Typography>}
              sx={{ mb: 1 }}
            />
          )}
          {(entroEnVencidos === 'no' || crearNueva) && (
            <>
              <Typography sx={{ fontSize: 12, fontWeight: 600, mb: 1 }}>
                Tipo de plan nuevo
              </Typography>
              <RadioGroup row value={tipoNueva} onChange={(e) => setTipoNueva(e.target.value)}>
                <FormControlLabel value="mensual"   control={<Radio size="small" />} label={<Typography sx={{ fontSize: 12 }}>Mensual</Typography>} />
                <FormControlLabel value="quincenal" control={<Radio size="small" />} label={<Typography sx={{ fontSize: 12 }}>Quincenal</Typography>} />
                <FormControlLabel value="diaria"    control={<Radio size="small" />} label={<Typography sx={{ fontSize: 12 }}>Diaria</Typography>} />
              </RadioGroup>
              <Typography sx={{ fontSize: 13, mt: 1 }}>
                Subtotal nueva: <strong>{formatCurrency(totalNueva)}</strong>
              </Typography>
            </>
          )}
        </Box>

        <Divider sx={{ my: 2 }} />

        <CurrencyField
          fullWidth size="small" label="Monto pagado ahora"
          helperText={pagaAhora < total ? 'Quedará saldo pendiente' : 'Cobro completo'}
          value={montoPagado}
          onChange={(val) => setMontoPagado(val)}
          placeholder={`${formatCurrency(total)} (paga completo)`}
          sx={{ mb: 2 }}
        />

        <TextField
          fullWidth select size="small" label="Método de pago"
          value={metodoPago} onChange={(e) => setMetodoPago(e.target.value)}
          sx={{ mb: 2 }}
        >
          {(metodoLinkQR ? ['Efectivo', 'Link/QR', ...METODOS_PAGO.filter(m => m !== 'Efectivo')] : METODOS_PAGO)
            .map(m => <MenuItem key={m} value={m}>{m}</MenuItem>)}
        </TextField>

        <FormControlLabel
          control={<Switch checked={imprimir} onChange={(e) => setImprimir(e.target.checked)} size="small" />}
          label={<Typography sx={{ fontSize: 13 }}>Imprimir comprobante</Typography>}
        />

        <TextField
          fullWidth size="small" multiline rows={2}
          label="Observaciones (opcional)"
          value={obs} onChange={(e) => setObs(e.target.value)}
        />

        {/* Resumen final */}
        <Box sx={{ mt: 2, p: 2, bgcolor: darkBoxBg, color: 'white', borderRadius: 2, border: borderStyle }}>
          <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
            <Typography sx={{ fontSize: 13, opacity: 0.85 }}>Total facturado</Typography>
            <Typography sx={{ fontSize: 14, fontWeight: 700 }}>{formatCurrency(total)}</Typography>
          </Stack>
          <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
            <Typography sx={{ fontSize: 13, opacity: 0.85 }}>Recibe ahora</Typography>
            <Typography sx={{ fontSize: 14, fontWeight: 700, color: '#10B981' }}>
              {formatCurrency(pagaAhora)}
            </Typography>
          </Stack>
          {pagaAhora < total && (
            <Stack direction="row" justifyContent="space-between" sx={{ pt: 0.5, borderTop: '1px solid rgba(255,255,255,0.2)' }}>
              <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#FCA5A5' }}>Saldo pendiente</Typography>
              <Typography sx={{ fontSize: 16, fontWeight: 800, color: '#FCA5A5' }}>
                {formatCurrency(total - pagaAhora)}
              </Typography>
            </Stack>
          )}
        </Box>
      </DialogContent>

      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} disabled={loading}>Cancelar</Button>
        <Button
          variant="contained" disabled={loading || total <= 0}
          onClick={() => {
            if (metodoPago === 'Link/QR' && metodoLinkQR) setLinkPagoModalOpen(true);
            else handleCobrar();
          }}
          startIcon={loading ? <CircularProgress size={16} color="inherit" /> : metodoPago === 'Link/QR' ? <QrCode2 /> : <Save />}
          sx={{ bgcolor: '#EF4444', '&:hover': { bgcolor: '#dc2626' }, fontWeight: 700 }}
        >
          {metodoPago === 'Link/QR' ? 'Mostrar QR / Link' : 'Confirmar cobro'}
        </Button>
      </DialogActions>

      {/* Modal QR / Link de pago — homologado con la salida por horas */}
      <LinkPagoModal
        open={linkPagoModalOpen}
        onClose={() => setLinkPagoModalOpen(false)}
        onConfirm={async () => {
          setLinkPagoModalOpen(false);
          await handleCobrar();
        }}
        linkConfig={metodoLinkQR}
        clienteTelefono={resultado?.vehiculo?.cliente_telefono || ''}
      />
    </Dialog>
  );
}

export const CobrarVencidoDialog  = ParqueaderoCobrarVencidoDialog;
export default ParqueaderoCobrarVencidoDialog;