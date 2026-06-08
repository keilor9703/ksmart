/**
 * BasculaWidget.js
 * Panel de pesaje en tiempo real.
 *
 * Props:
 *   producto       { nombre, precio, unidad_medida }  — producto seleccionado
 *   onConfirmar    (cantidad, subtotal) => void        — callback al confirmar
 *   onCancelar     () => void
 */
import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Box, Typography, IconButton, Chip, Divider,
  LinearProgress, Tooltip, CircularProgress,
} from '@mui/material';
import ScaleIcon from '@mui/icons-material/Scale';
import UsbIcon from '@mui/icons-material/Usb';
import UsbOffIcon from '@mui/icons-material/UsbOff';
import SettingsIcon from '@mui/icons-material/Settings';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import { useBascula } from '../../hooks/useBascula';
import BasculaConfigDialog from './BasculaConfigDialog';
import { formatCurrency } from '../../utils/formatters';

export default function BasculaWidget({ producto, onConfirmar, onCancelar }) {
  const {
    conectar, desconectar,
    peso, estable, conectado, error,
    config, guardarConfig,
  } = useBascula();

  const [configOpen,     setConfigOpen]     = useState(false);
  const [conectando,     setConectando]     = useState(false);
  const [pesoConfirmado, setPesoConfirmado] = useState(null);

  // precio en KGS; si la báscula reporta gramos, convertir
  const pesoEnKg = config.unidad === 'g' ? peso / 1000 : peso;
  const subtotal = pesoEnKg * (producto?.precio || 0);

  // Si hay un error de conexión pero el puerto no existe, limpiar al desmontar
  useEffect(() => {
    return () => { desconectar(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleConectar = async () => {
    setConectando(true);
    await conectar();
    setConectando(false);
  };

  const handleConfirmar = () => {
    if (pesoEnKg <= 0) return;
    setPesoConfirmado(pesoEnKg);
    onConfirmar(pesoEnKg, subtotal);
  };

  const pesoDisplay = peso > 0
    ? `${peso.toFixed(3)} ${config.unidad === 'g' ? 'g' : 'kg'}`
    : '— — —';

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

        <DialogContent sx={{ textAlign: 'center', py: 3 }}>
          {/* Estado de conexión */}
          <Box display="flex" justifyContent="center" alignItems="center" gap={1} mb={2}>
            {conectado ? (
              <Chip
                icon={<UsbIcon />}
                label="Báscula conectada"
                color="success"
                size="small"
                variant="outlined"
              />
            ) : (
              <Chip
                icon={<UsbOffIcon />}
                label="Sin conexión"
                color="default"
                size="small"
                variant="outlined"
              />
            )}
          </Box>

          {/* Visualización del peso */}
          <Box
            sx={{
              bgcolor: 'grey.100',
              borderRadius: 3,
              py: 3,
              px: 2,
              mb: 2,
              border: estable && peso > 0 ? '2px solid' : '2px solid transparent',
              borderColor: estable && peso > 0 ? 'success.main' : 'transparent',
              transition: 'border-color 0.3s',
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

            {conectado && (
              <Box mt={1} display="flex" justifyContent="center" alignItems="center" gap={0.5}>
                {estable && peso > 0 ? (
                  <><CheckCircleIcon color="success" fontSize="small" />
                    <Typography variant="caption" color="success.main">Peso estable</Typography></>
                ) : (
                  <><HourglassEmptyIcon color="warning" fontSize="small" sx={{ animation: 'spin 1s linear infinite', '@keyframes spin': { from: { transform: 'rotate(0deg)' }, to: { transform: 'rotate(360deg)' } } }} />
                    <Typography variant="caption" color="text.secondary">Esperando estabilidad…</Typography></>
                )}
              </Box>
            )}
          </Box>

          {/* Subtotal */}
          {peso > 0 && (
            <Box mb={1}>
              <Typography variant="body2" color="text.secondary">
                {pesoEnKg.toFixed(3)} kg × {formatCurrency(producto?.precio || 0)}/kg
              </Typography>
              <Typography variant="h5" fontWeight="bold" color="primary">
                {formatCurrency(subtotal)}
              </Typography>
            </Box>
          )}

          {/* Error */}
          {error && (
            <Typography variant="caption" color="error" display="block" mt={1}>
              {error}
            </Typography>
          )}

          {/* Barra de progreso mientras conecta */}
          {conectando && <LinearProgress sx={{ mt: 2, borderRadius: 1 }} />}

          {/* Botón conectar */}
          {!conectado && !conectando && (
            <Button
              variant="outlined"
              startIcon={<UsbIcon />}
              onClick={handleConectar}
              sx={{ mt: 2 }}
            >
              Conectar báscula
            </Button>
          )}

          {conectado && (
            <Button
              size="small"
              color="inherit"
              onClick={desconectar}
              sx={{ mt: 1, opacity: 0.6 }}
            >
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
            disabled={!estable || pesoEnKg <= 0}
            onClick={handleConfirmar}
            startIcon={pesoConfirmado ? <CheckCircleIcon /> : undefined}
          >
            {pesoConfirmado ? 'Confirmado' : 'Agregar al carrito'}
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
