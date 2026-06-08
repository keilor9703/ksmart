/**
 * BasculaConfigDialog.js
 * Diálogo de configuración para la báscula USB/Serial.
 * Se muestra una sola vez (o al presionar "Configurar báscula").
 * Persiste en localStorage a través de useBascula.guardarConfig().
 */
import React, { useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Grid, TextField, MenuItem, Typography,
  Alert, Divider, Box,
} from '@mui/material';
import ScaleIcon from '@mui/icons-material/Scale';

const BAUD_OPTIONS  = [1200, 2400, 4800, 9600, 19200, 38400, 57600, 115200];
const PARITY_OPTIONS = [
  { value: 'none', label: 'Sin paridad' },
  { value: 'even', label: 'Par (Even)'  },
  { value: 'odd',  label: 'Impar (Odd)' },
];

export default function BasculaConfigDialog({ open, config, onGuardar, onClose }) {
  const [local, setLocal] = useState({ ...config });

  const set = (field) => (e) =>
    setLocal(prev => ({ ...prev, [field]: e.target.value }));

  const handleGuardar = () => {
    onGuardar({
      baudRate: Number(local.baudRate),
      dataBits: Number(local.dataBits),
      stopBits: Number(local.stopBits),
      parity:   local.parity,
      unidad:   local.unidad,
    });
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <ScaleIcon color="primary" />
        Configuración de Báscula
      </DialogTitle>

      <DialogContent>
        <Alert severity="info" sx={{ mb: 2 }}>
          Requiere Chrome o Edge en escritorio. La configuración se guarda automáticamente.
        </Alert>

        <Typography variant="subtitle2" gutterBottom color="text.secondary">
          Puerto Serial (USB)
        </Typography>

        <Grid container spacing={2}>
          <Grid item xs={12}>
            <TextField
              select fullWidth label="Velocidad (Baud Rate)"
              value={local.baudRate} onChange={set('baudRate')} size="small"
            >
              {BAUD_OPTIONS.map(b => (
                <MenuItem key={b} value={b}>{b}</MenuItem>
              ))}
            </TextField>
          </Grid>

          <Grid item xs={6}>
            <TextField
              select fullWidth label="Bits de datos"
              value={local.dataBits} onChange={set('dataBits')} size="small"
            >
              {[7, 8].map(n => <MenuItem key={n} value={n}>{n}</MenuItem>)}
            </TextField>
          </Grid>

          <Grid item xs={6}>
            <TextField
              select fullWidth label="Bits de parada"
              value={local.stopBits} onChange={set('stopBits')} size="small"
            >
              {[1, 2].map(n => <MenuItem key={n} value={n}>{n}</MenuItem>)}
            </TextField>
          </Grid>

          <Grid item xs={12}>
            <TextField
              select fullWidth label="Paridad"
              value={local.parity} onChange={set('parity')} size="small"
            >
              {PARITY_OPTIONS.map(p => (
                <MenuItem key={p.value} value={p.value}>{p.label}</MenuItem>
              ))}
            </TextField>
          </Grid>
        </Grid>

        <Divider sx={{ my: 2 }} />

        <Typography variant="subtitle2" gutterBottom color="text.secondary">
          Unidad reportada por la báscula
        </Typography>
        <TextField
          select fullWidth label="Unidad"
          value={local.unidad} onChange={set('unidad')} size="small"
        >
          <MenuItem value="kg">Kilogramos (kg)</MenuItem>
          <MenuItem value="g">Gramos (g)</MenuItem>
          <MenuItem value="lb">Libras (lb)</MenuItem>
        </TextField>

        <Box mt={2}>
          <Typography variant="caption" color="text.secondary">
            Marcas compatibles: Toledo / Mettler, Torrey, Bematech y básculas genéricas chinas.
            Si tu báscula no conecta, verifica que el baud rate coincida con la configuración
            de fábrica (generalmente 9600).
          </Typography>
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button variant="contained" onClick={handleGuardar}>Guardar</Button>
      </DialogActions>
    </Dialog>
  );
}
