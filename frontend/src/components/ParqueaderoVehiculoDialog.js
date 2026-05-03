// ═══════════════════════════════════════════════════════════════════════════
// DIÁLOGOS DEL MÓDULO PARQUEADERO
// Coloca cada componente en su propio archivo dentro de /components/:
//
//   - ParqueaderoSuscripcionDialog.jsx
//   - ParqueaderoVehiculoDialog.jsx
//   - ParqueaderoCobrarVencidoDialog.jsx
//   - ParqueaderoSalidaHorasDialog.jsx
//   - ParqueaderoEntradaHorasDialog.jsx
//
// O en uno solo si prefieres (sólo recuerda exportarlos correctamente).
// ═══════════════════════════════════════════════════════════════════════════

import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField,
  Box, Typography, Stack, RadioGroup, Radio, FormControlLabel, Alert,
  Divider, MenuItem, InputAdornment, CircularProgress, IconButton,
  Autocomplete, Chip
} from '@mui/material';
import { Close, TwoWheeler, Person, AttachMoney, Save } from '@mui/icons-material';
import apiClient from '../api';
import { toast } from 'react-toastify';
import { formatCurrency } from '../utils/formatters';
import { ParqueaderoSuscripcionDialog } from './ParqueaderoSuscripcionDialog';

const ACCENT = '#FF6020';
const METODOS_PAGO = ['Efectivo', 'Transferencia', 'Nequi', 'Daviplata', 'Tarjeta', 'Otro'];




// ═══════════════════════════════════════════════════════════════════════════
// 2. RegistrarVehiculoDialog
//    Caso: placa nueva → registrar moto y opcionalmente crear suscripción
// ═══════════════════════════════════════════════════════════════════════════

export function ParqueaderoVehiculoDialog({ open, onClose, placaSugerida, onSuccess }) {
  const [paso, setPaso]               = useState(1);  // 1 = datos moto, 2 = suscripción
  const [clientes, setClientes]       = useState([]);
  const [clienteSel, setClienteSel]   = useState(null);
  const [crearCliente, setCrearCl]    = useState(false);

  // Datos moto
  const [placa, setPlaca]             = useState('');
  const [marca, setMarca]             = useState('');
  const [modelo, setModelo]           = useState('');
  const [color, setColor]             = useState('');

  // Si crea cliente nuevo
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [nuevaCedula, setNuevaCedula] = useState('');
  const [nuevoTel, setNuevoTel]       = useState('');

  const [vehiculoCreado, setVehCreado] = useState(null);
  const [loading, setLoading]          = useState(false);

  useEffect(() => {
    if (!open) return;
    setPaso(1);
    setPlaca(placaSugerida || '');
    setMarca(''); setModelo(''); setColor('');
    setClienteSel(null); setCrearCl(false);
    setNuevoNombre(''); setNuevaCedula(''); setNuevoTel('');
    setVehCreado(null);
    apiClient.get('/clientes/?limit=500').then(({ data }) => setClientes(data));
  }, [open, placaSugerida]);

  const handleCrearVehiculo = async () => {
    if (!placa || placa.length < 3) {
      toast.warning('La placa es obligatoria.');
      return;
    }
    setLoading(true);
    try {
      let clienteId = clienteSel?.id;

      // Crear cliente si no existe
      if (crearCliente) {
        if (!nuevoNombre.trim()) {
          toast.warning('Falta el nombre del propietario.');
          setLoading(false);
          return;
        }
        const { data: cliNuevo } = await apiClient.post('/clientes/', {
          nombre:    nuevoNombre.trim(),
          cedula:    nuevaCedula.trim() || null,
          telefono:  nuevoTel.trim() || null,
          es_cliente:   true,
          es_proveedor: false,
        });
        clienteId = cliNuevo.id;
      }

      if (!clienteId) {
        toast.warning('Selecciona o crea un propietario.');
        setLoading(false);
        return;
      }

      const { data: veh } = await apiClient.post('/parqueadero/vehiculos', {
        placa, cliente_id: clienteId, marca, modelo, color,
      });
      setVehCreado(veh);
      setPaso(2);   // pasar a registrar suscripción
      toast.success('Moto registrada. Ahora el pago.');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al registrar.');
    } finally {
      setLoading(false);
    }
  };

  // Cuando creamos la moto y luego la suscripción
  if (vehiculoCreado && paso === 2) {
    return (
      <ParqueaderoSuscripcionDialog
        open={open} onClose={onClose}
        vehiculo={vehiculoCreado}
        onSuccess={onSuccess}
      />
    );
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Stack direction="row" spacing={1} alignItems="center">
            <TwoWheeler sx={{ color: ACCENT }} />
            <Typography sx={{ fontWeight: 800 }}>Registrar nueva moto</Typography>
          </Stack>
          <IconButton onClick={onClose} size="small"><Close /></IconButton>
        </Stack>
      </DialogTitle>

      <DialogContent dividers>
        <Alert severity="info" sx={{ mb: 2, fontSize: 13 }}>
          Después de registrar la moto, podrás registrar el pago de su mensualidad.
        </Alert>

        {/* Datos moto */}
        <Typography sx={{ fontSize: 12, fontWeight: 700, color: 'text.secondary', mb: 1, textTransform: 'uppercase' }}>
          Datos de la moto
        </Typography>
        <Stack spacing={1.5}>
          <TextField
            fullWidth size="small" label="Placa *"
            value={placa}
            onChange={(e) => setPlaca(e.target.value.toUpperCase().replace(/[\s-]/g, '').slice(0, 10))}
            inputProps={{ style: { fontFamily: 'monospace', fontWeight: 700, letterSpacing: 2 } }}
          />
          <Stack direction="row" spacing={1}>
            <TextField fullWidth size="small" label="Marca" value={marca} onChange={(e) => setMarca(e.target.value)} placeholder="Yamaha, Honda…" />
            <TextField fullWidth size="small" label="Modelo" value={modelo} onChange={(e) => setModelo(e.target.value)} placeholder="XTZ 125…" />
          </Stack>
          <TextField fullWidth size="small" label="Color" value={color} onChange={(e) => setColor(e.target.value)} placeholder="Negra, roja…" />
        </Stack>

        <Divider sx={{ my: 2 }} />

        {/* Propietario */}
        <Typography sx={{ fontSize: 12, fontWeight: 700, color: 'text.secondary', mb: 1, textTransform: 'uppercase' }}>
          Propietario
        </Typography>

        {!crearCliente ? (
          <>
            <Autocomplete
              size="small" options={clientes}
              getOptionLabel={(c) => `${c.nombre}${c.cedula ? ` · CC ${c.cedula}` : ''}`}
              value={clienteSel}
              onChange={(_, v) => setClienteSel(v)}
              renderInput={(params) => <TextField {...params} label="Buscar propietario existente" />}
            />
            <Button
              size="small" sx={{ mt: 1, color: ACCENT, fontWeight: 700 }}
              onClick={() => setCrearCl(true)}
            >
              + Es propietario nuevo, crearlo ahora
            </Button>
          </>
        ) : (
          <Stack spacing={1.5}>
            <TextField fullWidth size="small" label="Nombre completo *" value={nuevoNombre} onChange={(e) => setNuevoNombre(e.target.value)} />
            <Stack direction="row" spacing={1}>
              <TextField fullWidth size="small" label="Cédula / NIT" value={nuevaCedula} onChange={(e) => setNuevaCedula(e.target.value)} />
              <TextField fullWidth size="small" label="Teléfono" value={nuevoTel} onChange={(e) => setNuevoTel(e.target.value)} />
            </Stack>
            <Button size="small" onClick={() => setCrearCl(false)} sx={{ alignSelf: 'flex-start' }}>
              ← Buscar entre los existentes
            </Button>
          </Stack>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} disabled={loading}>Cancelar</Button>
        <Button
          variant="contained" onClick={handleCrearVehiculo} disabled={loading}
          startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <Save />}
          sx={{ bgcolor: ACCENT, '&:hover': { bgcolor: '#e6561c' }, fontWeight: 700 }}
        >
          Registrar moto y continuar
        </Button>
      </DialogActions>
    </Dialog>
  );
}




// Aliases para los imports que usa ParqueaderoBuscar

export const RegistrarVehiculoDialog    = ParqueaderoVehiculoDialog;


export default ParqueaderoVehiculoDialog;
