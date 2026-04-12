import React, { useState, useEffect } from 'react';
import apiClient from '../api';
import { toast } from 'react-toastify';
import BulkUpload from './BulkUpload';
import {
  Box, Typography, Grid, TextField, Button, InputAdornment,
  Collapse, Divider, Chip, IconButton
} from '@mui/material';
import {
  PersonAdd, ExpandMore, ExpandLess, Upload,
  Business, Person, Close
} from '@mui/icons-material';

const ACCENT = '#3B82F6';

// ─── Toggle tipo tercero ───────────────────────────────────────────────────────
const TipoToggle = ({ label, icon, checked, onChange, color }) => (
  <Button
    variant={checked ? 'contained' : 'outlined'}
    startIcon={icon}
    onClick={() => onChange(!checked)}
    sx={{
      borderRadius: 2, fontWeight: 600, fontSize: 13, textTransform: 'none',
      ...(checked
        ? { bgcolor: color, '&:hover': { bgcolor: color, filter: 'brightness(0.92)' }, borderColor: color }
        : { borderColor: 'divider', color: 'text.secondary' }),
    }}
  >
    {label}
  </Button>
);

const ClienteForm = ({
  onClienteAdded, clienteToEdit, onClienteUpdated,
  forceOpen, onClose,
}) => {
  const [nombre, setNombre]         = useState('');
  const [cedula, setCedula]         = useState('');
  const [telefono, setTelefono]     = useState('');
  const [direccion, setDireccion]   = useState('');
  const [cupoCredito, setCupoCredito] = useState('');
  const [esCliente, setEsCliente]   = useState(true);
  const [esProveedor, setEsProveedor] = useState(false);

  const [formOpen, setFormOpen]     = useState(false);
  const [bulkOpen, setBulkOpen]     = useState(false);
  const [clientes, setClientes]     = useState([]);

  // Sincronizar apertura con prop externa (cuando se edita o se hace clic en "Nuevo Tercero")
  useEffect(() => {
    if (forceOpen !== undefined) setFormOpen(forceOpen);
  }, [forceOpen]);

  useEffect(() => { fetchClientes(); }, []);

  const fetchClientes = () =>
    apiClient.get('/clientes/').then(r => setClientes(r.data)).catch(console.error);

  // Cargar datos al editar
  useEffect(() => {
    if (clienteToEdit) {
      setNombre(clienteToEdit.nombre);
      setCedula(clienteToEdit.cedula || '');
      setTelefono(clienteToEdit.telefono || '');
      setDireccion(clienteToEdit.direccion || '');
      setCupoCredito(clienteToEdit.cupo_credito || '');
      setEsCliente(clienteToEdit.es_cliente ?? true);
      setEsProveedor(clienteToEdit.es_proveedor ?? false);
    } else {
      resetFields();
    }
  }, [clienteToEdit]);

  const resetFields = () => {
    setNombre(''); setCedula(''); setTelefono('');
    setDireccion(''); setCupoCredito('');
    setEsCliente(true); setEsProveedor(false);
  };

  const handleClose = () => {
    resetFields();
    setFormOpen(false);
    if (onClose) onClose();
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!esCliente && !esProveedor) {
      toast.warning('El tercero debe ser al menos Cliente o Proveedor.');
      return;
    }
    const data = {
      nombre, cedula, telefono, direccion,
      cupo_credito: parseFloat(cupoCredito) || 0,
      es_cliente: esCliente,
      es_proveedor: esProveedor,
    };
    const request = clienteToEdit
      ? apiClient.put(`/clientes/${clienteToEdit.id}`, data)
      : apiClient.post('/clientes/', data);

    request.then(res => {
      toast.success(`Tercero ${clienteToEdit ? 'actualizado' : 'agregado'} exitosamente`);
      if (clienteToEdit) {
        onClienteUpdated(res.data);
      } else {
        resetFields();
        onClienteAdded(res.data);
      }
      handleClose();
    }).catch(err => {
      toast.error(`Error al ${clienteToEdit ? 'actualizar' : 'agregar'} el tercero.`);
    });
  };

  const isEditing = Boolean(clienteToEdit);

  return (
    // width: 100% + boxSizing garantiza que padding no desborde
    <Box sx={{ width: '100%', boxSizing: 'border-box' }}>

      {/* ── Panel del formulario ── */}
      <Box sx={{
        borderRadius: 3, border: '1px solid', borderColor: 'divider',
        bgcolor: 'background.paper',
        // overflow: hidden solo en el eje Y para no cortar el collapse
        overflowX: 'hidden',
        boxShadow: formOpen ? '0 4px 24px rgba(0,0,0,0.08)' : '0 2px 8px rgba(0,0,0,0.04)',
        transition: 'box-shadow 0.2s',
        mb: 2, width: '100%', boxSizing: 'border-box',
      }}>
        {/* Header del panel */}
        <Box
          onClick={() => { if (!forceOpen) setFormOpen(o => !o); }}
          sx={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            px: { xs: 1.5, md: 2.5 }, py: 1.5,
            cursor: forceOpen ? 'default' : 'pointer',
            '&:hover': { bgcolor: forceOpen ? 'transparent' : 'action.hover' },
            transition: 'background 0.15s', minWidth: 0,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0, flex: 1 }}>
            <Box sx={{
              width: 30, height: 30, borderRadius: 1.5, flexShrink: 0,
              bgcolor: `${ACCENT}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: ACCENT,
            }}>
              <PersonAdd fontSize="small" />
            </Box>
            <Typography sx={{ fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {isEditing ? 'Editar Tercero' : 'Agregar Nuevo Tercero'}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0, ml: 1 }}>
            {formOpen && (
              <IconButton
                size="small"
                onClick={(e) => { e.stopPropagation(); handleClose(); }}
                sx={{ color: 'text.secondary' }}
              >
                <Close fontSize="small" />
              </IconButton>
            )}
            {!forceOpen && (
              formOpen
                ? <ExpandLess sx={{ color: 'text.secondary', fontSize: 20 }} />
                : <ExpandMore sx={{ color: 'text.secondary', fontSize: 20 }} />
            )}
          </Box>
        </Box>

        {/* Contenido colapsable */}
        <Collapse in={formOpen}>
          <Divider />
          <Box component="form" onSubmit={handleSubmit} sx={{ p: { xs: 1.5, md: 3 }, boxSizing: 'border-box' }}>
            <Grid container spacing={1.5}>

              <Grid item xs={12} sm={6}>
                <TextField
                  label="Nombre / Razón Social"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  fullWidth required size="small"
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  label="Cédula / NIT"
                  value={cedula}
                  onChange={(e) => setCedula(e.target.value)}
                  fullWidth size="small"
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  label="Teléfono"
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                  fullWidth size="small"
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  label="Dirección"
                  value={direccion}
                  onChange={(e) => setDireccion(e.target.value)}
                  fullWidth size="small"
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  label="Cupo de Crédito"
                  value={cupoCredito}
                  onChange={(e) => setCupoCredito(e.target.value.replace(/[^0-9.]/g, ''))}
                  fullWidth size="small"
                  helperText="Solo aplica para clientes"
                  InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
                />
              </Grid>

              {/* Tipo de tercero */}
              <Grid item xs={12} sm={6}>
                <Typography sx={{ fontSize: 11, color: 'text.secondary', mb: 0.8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Tipo de tercero
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  <TipoToggle label="Es Cliente"   icon={<Person fontSize="small" />}   checked={esCliente}   onChange={setEsCliente}   color={ACCENT}    />
                  <TipoToggle label="Es Proveedor" icon={<Business fontSize="small" />} checked={esProveedor} onChange={setEsProveedor} color="#10B981" />
                </Box>
              </Grid>

              <Grid item xs={12}>
                <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                  <Button onClick={handleClose} variant="outlined" size="small"
                    sx={{ borderRadius: 2, fontWeight: 600, borderColor: 'divider', color: 'text.secondary' }}>
                    Cancelar
                  </Button>
                  <Button type="submit" variant="contained" size="small"
                    sx={{
                      background: `linear-gradient(135deg, ${ACCENT}, #60a5fa)`,
                      boxShadow: `0 4px 14px rgba(59,130,246,0.3)`,
                      borderRadius: 2, fontWeight: 600,
                    }}>
                    {isEditing ? 'Actualizar' : 'Guardar Tercero'}
                  </Button>
                </Box>
              </Grid>
            </Grid>
          </Box>
        </Collapse>
      </Box>

      {/* ── Panel de carga masiva ── */}
      <Box sx={{
        borderRadius: 3, border: '1px solid', borderColor: 'divider',
        bgcolor: 'background.paper', overflowX: 'hidden',
        boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
        width: '100%', boxSizing: 'border-box',
      }}>
        <Box
          onClick={() => setBulkOpen(o => !o)}
          sx={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            px: { xs: 1.5, md: 2.5 }, py: 1.5, cursor: 'pointer',
            '&:hover': { bgcolor: 'action.hover' }, transition: 'background 0.15s',
            minWidth: 0,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0, flex: 1 }}>
            <Box sx={{
              width: 30, height: 30, borderRadius: 1.5, flexShrink: 0,
              bgcolor: 'rgba(139,92,246,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8B5CF6',
            }}>
              <Upload fontSize="small" />
            </Box>
            <Typography sx={{ fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              Carga Masiva de Terceros
            </Typography>
          </Box>
          <Box sx={{ flexShrink: 0, ml: 1 }}>
            {bulkOpen
              ? <ExpandLess sx={{ color: 'text.secondary', fontSize: 20 }} />
              : <ExpandMore sx={{ color: 'text.secondary', fontSize: 20 }} />
            }
          </Box>
        </Box>

        <Collapse in={bulkOpen}>
          <Divider />
          <Box sx={{ p: { xs: 1.5, md: 3 }, boxSizing: 'border-box' }}>
            <BulkUpload uploadType="clientes" onUploadSuccess={fetchClientes} />
          </Box>
        </Collapse>
      </Box>
    </Box>
  );
};

export default ClienteForm;
