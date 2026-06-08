/**
 * BasculaWidget.js
 * Panel de pesaje en tiempo real con dos modos:
 *   - "peso"   : báscula → calcula precio
 *   - "precio" : operario ingresa monto objetivo → báscula muestra progreso hasta alcanzarlo
 *
 * Props:
 *   producto       { nombre, precio, unidad_medida }
 *   onConfirmar    (cantidad, subtotal) => void
 *   onCancelar     () => void
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Box, Typography, IconButton, Chip, Divider,
  LinearProgress, Tooltip, ToggleButton, ToggleButtonGroup,
  InputAdornment, TextField,
} from '@mui/material';
import ScaleIcon from '@mui/icons-material/Scale';
import UsbIcon from '@mui/icons-material/Usb';
import UsbOffIcon from '@mui/icons-material/UsbOff';
import SettingsIcon from '@mui/icons-material/Settings';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import MonitorWeightIcon from '@mui/icons-material/MonitorWeight';
import { useBascula } from '../../hooks/useBascula';
import BasculaConfigDialog from './BasculaConfigDialog';
import { formatCurrency } from '../../utils/formatters';

export default function BasculaWidget({ producto, onConfirmar, onCancelar }) {
  const {
    conectar, desconectar,
    peso, estable, conectado, error,
    config, guardarConfig,
  } = useBascula();

  const [configOpen,   setConfigOpen]   = useState(false);
  const [conectando,   setConectando]   = useState(false);
  const [modo,         setModo]         = useState('peso'); // 'peso' | 'precio'
  const [montoObjetivo, setMontoObjetivo] = useState('');
  const montoInputRef = useRef(null);

  const precioKg   = producto?.precio || 0;
  const pesoEnKg   = config.unidad === 'g' ? peso / 1000 : peso;
  const subtotal   = pesoEnKg * precioKg;

  // En modo precio: kg necesarios para alcanzar el monto objetivo
  const montoNum      = parseFloat((montoObjetivo || '0').replace(/\./g, '').replace(',', '.')) || 0;
  const kgNecesarios  = precioKg > 0 ? montoNum / precioKg : 0;
  const progreso      = kgNecesarios > 0 ? Math.min((pesoEnKg / kgNecesarios) * 100, 100) : 0;
  const pesoFalta     = Math.max(0, kgNecesarios - pesoEnKg);
  const metaAlcanzada = kgNecesarios > 0 && pesoEnKg >= kgNecesarios;

  // Para confirmación: en modo precio usamos kgNecesarios (monto exacto); en modo peso usamos pesoEnKg real
  const cantidadFinal  = modo === 'precio' ? kgNecesarios  : pesoEnKg;
  const subtotalFinal  = modo === 'precio' ? montoNum       : subtotal;

  const puedeConfirmar = modo === 'peso'
    ? (estable && pesoEnKg > 0)
    : (montoNum > 0 && metaAlcanzada && estable);

  useEffect(() => {
    return () => { desconectar(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Al cambiar a modo precio, foco en campo monto
  useEffect(() => {
    if (modo === 'precio') setTimeout(() => montoInputRef.current?.focus(), 100);
  }, [modo]);

  const handleConectar = async () => {
    setConectando(true);
    await conectar();
    setConectando(false);
  };

  const handleConfirmar = () => {
    if (!puedeConfirmar) return;
    onConfirmar(cantidadFinal, subtotalFinal);
  };

  // Formatea número mientras escribe (solo dígitos, sin decimales — pesos colombianos)
  const handleMontoChange = (e) => {
    const raw = e.target.value.replace(/\D/g, '');
    setMontoObjetivo(raw ? Number(raw).toLocaleString('es-CO') : '');
  };

  const pesoDisplay = peso > 0
    ? `${peso.toFixed(3)} ${config.unidad === 'g' ? 'g' : 'kg'}`
    : '— — —';

  const estabilidadLabel = conectado
    ? (estable && peso > 0
        ? <><CheckCircleIcon color="success" fontSize="small" /><Typography variant="caption" color="success.main">Peso estable</Typography></>
        : <><HourglassEmptyIcon color="warning" fontSize="small" sx={{ animation: 'spin 1s linear infinite', '@keyframes spin': { from: { transform: 'rotate(0deg)' }, to: { transform: 'rotate(360deg)' } } }} /><Typography variant="caption" color="text.secondary">Esperando estabilidad…</Typography></>
      )
    : null;

  return (
    <>
      <Dialog open maxWidth="xs" fullWidth onClose={onCancelar}>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, pb: 1 }}>
          <ScaleIcon color="primary" />
          <Box flex={1}>
            Pesar producto
            <Typography variant="body2" color="text.secondary" noWrap>
              {producto?.nombre}
            </Typography>
          </Box>
          <Tooltip title="Configurar báscula">
            <IconButton size="small" onClick={() => setConfigOpen(true)}>
              <SettingsIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </DialogTitle>

        <Divider />

        <DialogContent sx={{ textAlign: 'center', py: 2 }}>

          {/* Toggle de modo */}
          <ToggleButtonGroup
            value={modo} exclusive size="small"
            onChange={(_, v) => { if (v) setModo(v); }}
            sx={{ mb: 2 }}
          >
            <ToggleButton value="peso" sx={{ gap: 0.5, px: 2 }}>
              <MonitorWeightIcon fontSize="small" /> Por peso
            </ToggleButton>
            <ToggleButton value="precio" sx={{ gap: 0.5, px: 2 }}>
              <AttachMoneyIcon fontSize="small" /> Por precio
            </ToggleButton>
          </ToggleButtonGroup>

          {/* Campo monto objetivo (solo modo precio) */}
          {modo === 'precio' && (
            <Box mb={2}>
              <TextField
                inputRef={montoInputRef}
                fullWidth size="small"
                label="¿Cuánto quiere gastar?"
                value={montoObjetivo}
                onChange={handleMontoChange}
                placeholder="Ej. 10.000"
                InputProps={{
                  startAdornment: <InputAdornment position="start">$</InputAdornment>,
                }}
                helperText={
                  kgNecesarios > 0
                    ? `Equivale a ${kgNecesarios.toFixed(3)} kg a ${formatCurrency(precioKg)}/kg`
                    : `Precio: ${formatCurrency(precioKg)}/kg`
                }
              />
            </Box>
          )}

          {/* Estado de conexión */}
          <Box display="flex" justifyContent="center" alignItems="center" gap={1} mb={2}>
            {conectado ? (
              <Chip icon={<UsbIcon />} label="Báscula conectada" color="success" size="small" variant="outlined" />
            ) : (
              <Chip icon={<UsbOffIcon />} label="Sin conexión" color="default" size="small" variant="outlined" />
            )}
          </Box>

          {/* Visualización del peso */}
          <Box
            sx={{
              bgcolor: metaAlcanzada ? 'success.50' : 'grey.100',
              borderRadius: 3,
              py: 2.5,
              px: 2,
              mb: 2,
              border: '2px solid',
              borderColor: metaAlcanzada ? 'success.main' : (estable && peso > 0 ? 'success.light' : 'transparent'),
              transition: 'all 0.3s',
            }}
          >
            <Typography
              variant="h2"
              fontWeight="bold"
              color={peso > 0 ? 'text.primary' : 'text.disabled'}
              sx={{ fontVariantNumeric: 'tabular-nums', letterSpacing: 2 }}
            >
              {pesoDisplay}
            </Typography>

            {estabilidadLabel && (
              <Box mt={0.5} display="flex" justifyContent="center" alignItems="center" gap={0.5}>
                {estabilidadLabel}
              </Box>
            )}
          </Box>

          {/* Barra de progreso (modo precio) */}
          {modo === 'precio' && kgNecesarios > 0 && (
            <Box mb={1.5}>
              <Box display="flex" justifyContent="space-between" mb={0.5}>
                <Typography variant="caption" color="text.secondary">
                  {pesoEnKg.toFixed(3)} kg
                </Typography>
                <Typography variant="caption" color={metaAlcanzada ? 'success.main' : 'text.secondary'} fontWeight={metaAlcanzada ? 700 : 400}>
                  {metaAlcanzada ? '¡Listo!' : `Faltan ${pesoFalta.toFixed(3)} kg`}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {kgNecesarios.toFixed(3)} kg
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={progreso}
                color={metaAlcanzada ? 'success' : 'primary'}
                sx={{ height: 10, borderRadius: 5 }}
              />
              <Typography variant="caption" color="text.secondary" display="block" mt={0.5}>
                {Math.round(progreso)}% del objetivo ({formatCurrency(montoNum)})
              </Typography>
            </Box>
          )}

          {/* Subtotal (modo peso) */}
          {modo === 'peso' && peso > 0 && (
            <Box mb={1}>
              <Typography variant="body2" color="text.secondary">
                {pesoEnKg.toFixed(3)} kg × {formatCurrency(precioKg)}/kg
              </Typography>
              <Typography variant="h5" fontWeight="bold" color="primary">
                {formatCurrency(subtotal)}
              </Typography>
            </Box>
          )}

          {error && (
            <Typography variant="caption" color="error" display="block" mt={1}>
              {error}
            </Typography>
          )}

          {conectando && <LinearProgress sx={{ mt: 2, borderRadius: 1 }} />}

          {!conectado && !conectando && (
            <Button variant="outlined" startIcon={<UsbIcon />} onClick={handleConectar} sx={{ mt: 1 }}>
              Conectar báscula
            </Button>
          )}

          {conectado && (
            <Button size="small" color="inherit" onClick={desconectar} sx={{ mt: 1, opacity: 0.6 }}>
              Desconectar
            </Button>
          )}
        </DialogContent>

        <Divider />

        <DialogActions sx={{ px: 2, py: 1.5 }}>
          <Button onClick={onCancelar} color="inherit">Cancelar</Button>
          <Button
            variant="contained"
            color="success"
            disabled={!puedeConfirmar}
            onClick={handleConfirmar}
            startIcon={puedeConfirmar ? <CheckCircleIcon /> : undefined}
          >
            Agregar al carrito
          </Button>
        </DialogActions>
      </Dialog>

      <BasculaConfigDialog
        open={configOpen}
        config={config}
        onGuardar={guardarConfig}
        onClose={() => setConfigOpen(false)}
      />
    </>
  );
}
