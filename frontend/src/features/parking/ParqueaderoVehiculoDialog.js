// ═══════════════════════════════════════════════════════════════════════════
// DIÁLOGOS DEL MÓDULO PARQUEADERO
// ═══════════════════════════════════════════════════════════════════════════

import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField,
  Box, Typography, Stack, RadioGroup, Radio, FormControlLabel, Alert,
  Divider, MenuItem, InputAdornment, CircularProgress, IconButton,
  Autocomplete, Chip
} from '@mui/material';
import { Close, DirectionsCar, Person, AttachMoney, Save } from '@mui/icons-material';
import apiClient from '../../api';
import { toast } from 'react-toastify';
import { formatCurrency } from '../../utils/formatters';
import { ParqueaderoSuscripcionDialog } from './ParqueaderoSuscripcionDialog';
import { BRAND_OPTIONS, getModelOptions } from './vehicleBrands';
import { METODOS_PAGO_SIMPLE as METODOS_PAGO } from '../../utils/constants';

const ACCENT = '#FF6020';




// ═══════════════════════════════════════════════════════════════════════════
// 2. RegistrarVehiculoDialog
//    Caso: placa nueva → registrar vehículo y opcionalmente crear suscripción
// ═══════════════════════════════════════════════════════════════════════════

export function ParqueaderoVehiculoDialog({ open, onClose, placaSugerida, onSuccess }) {
  const [paso, setPaso]               = useState(1);
  const [clientes, setClientes]       = useState([]);
  const [clienteSel, setClienteSel]   = useState(null);
  const [crearCliente, setCrearCl]    = useState(false);

  // Datos vehículo
  const [placa, setPlaca]             = useState('');
  const [marca, setMarca]             = useState('');
  const [marcaInput, setMarcaInput]   = useState('');
  const [modelo, setModelo]           = useState('');
  const [modeloInput, setModeloInput] = useState('');
  const [color, setColor]             = useState('');

  // Si crea cliente nuevo
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [nuevaCedula, setNuevaCedula] = useState('');
  const [nuevoTel, setNuevoTel]       = useState('');

  const [vehiculoCreado, setVehCreado] = useState(null);
  const [loading, setLoading]          = useState(false);

  const modelOptions = getModelOptions(marca);

  useEffect(() => {
    if (!open) return;
    setPaso(1);
    setPlaca(placaSugerida || '');
    setMarca(''); setMarcaInput('');
    setModelo(''); setModeloInput('');
    setColor('');
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
      setPaso(2);
      toast.success('Vehículo registrado. Ahora el pago.');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al registrar.');
    } finally {
      setLoading(false);
    }
  };

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
            <DirectionsCar sx={{ color: ACCENT }} />
            <Typography sx={{ fontWeight: 800 }}>Registrar nuevo vehículo</Typography>
          </Stack>
          <IconButton onClick={onClose} size="small"><Close /></IconButton>
        </Stack>
      </DialogTitle>

      <DialogContent dividers>
        <Alert severity="info" sx={{ mb: 2, fontSize: 13 }}>
          Después de registrar el vehículo, podrás registrar el pago de su mensualidad.
        </Alert>

        {/* Datos vehículo */}
        <Typography sx={{ fontSize: 12, fontWeight: 700, color: 'text.secondary', mb: 1, textTransform: 'uppercase' }}>
          Datos del vehículo
        </Typography>
        <Stack spacing={1.5}>
          <TextField
            fullWidth size="small" label="Placa *"
            value={placa}
            onChange={(e) => setPlaca(e.target.value.toUpperCase().replace(/[\s-]/g, '').slice(0, 10))}
            inputProps={{ style: { fontFamily: 'monospace', fontWeight: 700, letterSpacing: 2 } }}
          />

          <Stack direction="row" spacing={1}>
            {/* Marca */}
            <Autocomplete
              sx={{ flex: 1 }}
              size="small"
              freeSolo
              options={BRAND_OPTIONS}
              value={marca}
              inputValue={marcaInput}
              onInputChange={(_, val) => setMarcaInput(val)}
              onChange={(_, val) => {
                const v = val || '';
                setMarca(v);
                setMarcaInput(v);
                setModelo('');
                setModeloInput('');
              }}
              renderInput={(params) => (
                <TextField {...params} label="Marca" placeholder="Ej: Honda, Yamaha…" />
              )}
            />

            {/* Modelo — filtrado por marca */}
            <Autocomplete
              sx={{ flex: 1 }}
              size="small"
              freeSolo
              options={modelOptions}
              value={modelo}
              inputValue={modeloInput}
              onInputChange={(_, val) => setModeloInput(val)}
              onChange={(_, val) => {
                const v = val || '';
                setModelo(v);
                setModeloInput(v);
              }}
              noOptionsText={marca ? 'Sin modelos para esta marca' : 'Selecciona una marca primero'}
              renderInput={(params) => (
                <TextField {...params} label="Modelo" placeholder="Ej: CB 190R…" />
              )}
            />
          </Stack>

          <TextField fullWidth size="small" label="Color" value={color} onChange={(e) => setColor(e.target.value)} placeholder="Negro, rojo, blanco…" />
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
          Registrar vehículo y continuar
        </Button>
      </DialogActions>
    </Dialog>
  );
}




// Aliases para los imports que usa ParqueaderoBuscar

export const RegistrarVehiculoDialog    = ParqueaderoVehiculoDialog;


export default ParqueaderoVehiculoDialog;
