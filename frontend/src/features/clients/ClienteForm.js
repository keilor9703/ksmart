import React, { useState, useEffect } from 'react';
import apiClient from '../../api';
import { toast } from 'react-toastify';
import CurrencyField from '../../components/common/CurrencyField';
import BulkUpload from '../../components/common/BulkUpload';
import {
  Box, Typography, Grid, TextField, Button, InputAdornment,
  Collapse, Divider, Chip, IconButton, Paper,
} from '@mui/material';
import {
  PersonAdd, ExpandMore, ExpandLess, Upload,
  Business, Person, Close, ReceiptLong,
} from '@mui/icons-material';

const ACCENT = '#3B82F6';

const PESOS_DV = [71, 67, 59, 53, 47, 43, 41, 37, 29, 23, 19, 17, 13, 7, 3];
const calcularDV = (nit) => {
  const digits = String(nit).replace(/\D/g, '');
  if (!digits || digits.length < 4) return '';
  const padded = digits.padStart(15, '0');
  const suma = padded.split('').reduce((acc, d, i) => acc + parseInt(d) * PESOS_DV[i], 0);
  const residuo = suma % 11;
  return String(residuo === 0 || residuo === 1 ? residuo : 11 - residuo);
};

const SectionLabel = ({ children }) => (
  <Typography sx={{
    fontSize: 11, fontWeight: 700, color: 'text.secondary',
    textTransform: 'uppercase', letterSpacing: 0.8, mb: 1.5,
  }}>
    {children}
  </Typography>
);

const ClienteForm = ({
  onClienteAdded, clienteToEdit, onClienteUpdated,
  forceOpen, onClose,
}) => {
  const [nombre, setNombre]         = useState('');
  const [cedula, setCedula]         = useState('');
  const [telefono, setTelefono]     = useState('');
  const [direccion, setDireccion]   = useState('');
  const [email, setEmail]           = useState('');
  const [tipoDocumento, setTipoDocumento] = useState(13);
  const [dv, setDv]                 = useState('');
  const [tipoOrganizacion, setTipoOrganizacion] = useState(2);
  const [tipoRegimen, setTipoRegimen] = useState(49);
  const [responsabilidadFiscal, setResponsabilidadFiscal] = useState('R-99-PN');
  const [cupoCredito, setCupoCredito] = useState('');
  const [esCliente, setEsCliente]   = useState(true);
  const [esProveedor, setEsProveedor] = useState(false);
  const [formOpen, setFormOpen]     = useState(false);
  const [bulkOpen, setBulkOpen]     = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    if (forceOpen !== undefined) setFormOpen(forceOpen);
  }, [forceOpen]);

  useEffect(() => {
    if (Number(tipoDocumento) === 31 && cedula) {
      setDv(calcularDV(cedula));
      setShowAdvanced(true);
    } else if (Number(tipoDocumento) !== 31) {
      setDv('');
    }
  }, [cedula, tipoDocumento]);

  useEffect(() => {
    if (clienteToEdit) {
      setNombre(clienteToEdit.nombre);
      setCedula(clienteToEdit.cedula || '');
      setTelefono(clienteToEdit.telefono || '');
      setDireccion(clienteToEdit.direccion || '');
      setEmail(clienteToEdit.email || '');
      setTipoDocumento(clienteToEdit.tipo_documento_id || 13);
      setDv(clienteToEdit.dv || '');
      setTipoOrganizacion(clienteToEdit.tipo_organizacion_id || 2);
      setTipoRegimen(clienteToEdit.tipo_regimen_id || 49);
      setResponsabilidadFiscal(clienteToEdit.responsabilidad_fiscal_codes || 'R-99-PN');
      setCupoCredito(clienteToEdit.cupo_credito || '');
      setEsCliente(clienteToEdit.es_cliente ?? true);
      setEsProveedor(clienteToEdit.es_proveedor ?? false);
      setShowAdvanced(Number(clienteToEdit.tipo_documento_id) === 31);
    } else {
      resetFields();
    }
  }, [clienteToEdit]);

  const resetFields = () => {
    setNombre(''); setCedula(''); setTelefono('');
    setDireccion(''); setEmail(''); setTipoDocumento(13);
    setDv(''); setTipoOrganizacion(2); setTipoRegimen(49);
    setResponsabilidadFiscal('R-99-PN');
    setCupoCredito('');
    setEsCliente(true); setEsProveedor(false);
    setShowAdvanced(false);
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
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      toast.warning('El email no tiene un formato válido.');
      return;
    }
    if (cupoCredito && parseFloat(cupoCredito) < 0) {
      toast.warning('El cupo de crédito no puede ser negativo.');
      return;
    }
    const data = {
      nombre, cedula, telefono, direccion, email,
      tipo_documento_id: tipoDocumento,
      dv,
      tipo_organizacion_id: tipoOrganizacion,
      tipo_regimen_id: tipoRegimen,
      responsabilidad_fiscal_codes: responsabilidadFiscal,
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
    }).catch((err) => {
      const detail = err.response?.data?.detail;
      toast.error(detail || `Error al ${clienteToEdit ? 'actualizar' : 'agregar'} el tercero.`);
    });
  };

  const isEditing = Boolean(clienteToEdit);

  return (
    <Box sx={{ width: '100%', boxSizing: 'border-box' }}>

      {/* ── Formulario ── */}
      <Paper elevation={0} sx={{
        borderRadius: 3, border: '1px solid', borderColor: 'divider',
        bgcolor: 'background.paper', overflow: 'hidden',
        boxShadow: formOpen ? '0 4px 24px rgba(0,0,0,0.08)' : '0 2px 8px rgba(0,0,0,0.04)',
        mb: 2,
      }}>
        {/* Header */}
        <Box
          onClick={() => { if (!forceOpen) setFormOpen(o => !o); }}
          sx={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            px: 2.5, py: 1.5,
            cursor: forceOpen ? 'default' : 'pointer',
            '&:hover': { bgcolor: forceOpen ? 'transparent' : 'action.hover' },
            transition: 'background 0.15s',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{
              width: 32, height: 32, borderRadius: 1.5, flexShrink: 0,
              bgcolor: `${ACCENT}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: ACCENT,
            }}>
              <PersonAdd fontSize="small" />
            </Box>
            <Typography sx={{ fontWeight: 700, fontSize: 14 }}>
              {isEditing ? 'Editar Tercero' : 'Agregar Nuevo Tercero'}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            {formOpen && (
              <IconButton size="small" onClick={(e) => { e.stopPropagation(); handleClose(); }}>
                <Close fontSize="small" />
              </IconButton>
            )}
            {!forceOpen && (formOpen
              ? <ExpandLess sx={{ color: 'text.secondary' }} />
              : <ExpandMore sx={{ color: 'text.secondary' }} />
            )}
          </Box>
        </Box>

        {/* Contenido */}
        <Collapse in={formOpen}>
          <Divider />
          <Box component="form" onSubmit={handleSubmit} sx={{ p: { xs: 2, md: 3 } }}>

            {/* ── Sección 1: Identificación ── */}
            <SectionLabel>Identificación</SectionLabel>
            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid item xs={12} sm={6} md={4}>
                <TextField
                  label="Nombre / Razón Social *"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  fullWidth required size="small"
                />
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <TextField
                  label="Cédula / NIT"
                  value={cedula}
                  onChange={(e) => setCedula(e.target.value)}
                  fullWidth size="small"
                />
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <TextField
                  label="Teléfono"
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                  fullWidth size="small"
                />
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <TextField
                  label="Correo Electrónico"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  fullWidth size="small"
                  type="email"
                  placeholder="correo@ejemplo.com"
                />
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <TextField
                  label="Dirección"
                  value={direccion}
                  onChange={(e) => setDireccion(e.target.value)}
                  fullWidth size="small"
                />
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <CurrencyField
                  label="Cupo de Crédito"
                  value={cupoCredito}
                  onChange={setCupoCredito}
                  fullWidth size="small"
                  helperText="Solo aplica para clientes"
                />
              </Grid>
            </Grid>

            {/* ── Sección 2: Tipo de tercero ── */}
            <SectionLabel>Tipo de tercero</SectionLabel>
            <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mb: 3 }}>
              {[
                { label: 'Es Cliente', icon: <Person fontSize="small" />, checked: esCliente, onChange: setEsCliente, color: ACCENT },
                { label: 'Es Proveedor', icon: <Business fontSize="small" />, checked: esProveedor, onChange: setEsProveedor, color: '#10B981' },
              ].map(({ label, icon, checked, onChange, color }) => (
                <Button
                  key={label}
                  variant={checked ? 'contained' : 'outlined'}
                  startIcon={icon}
                  onClick={() => onChange(!checked)}
                  sx={{
                    borderRadius: 2, fontWeight: 600, fontSize: 13, textTransform: 'none', px: 2.5, py: 1,
                    ...(checked
                      ? { bgcolor: color, '&:hover': { bgcolor: color, filter: 'brightness(0.92)' }, borderColor: color }
                      : { borderColor: 'divider', color: 'text.secondary' }),
                  }}
                >
                  {label}
                </Button>
              ))}
            </Box>

            {/* ── Sección 3: Datos DIAN (colapsable) ── */}
            <Box
              onClick={() => setShowAdvanced(v => !v)}
              sx={{
                display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer',
                p: 1.5, borderRadius: 2, border: '1px solid', borderColor: 'rgba(245,158,11,0.35)',
                bgcolor: 'rgba(245,158,11,0.07)', transition: 'all 0.15s',
                '&:hover': { borderColor: '#F59E0B' },
              }}
            >
              <ReceiptLong sx={{ fontSize: 18, color: '#F59E0B' }} />
              <Box sx={{ flex: 1 }}>
                <Typography sx={{ fontSize: 13, fontWeight: 700, color: 'text.primary' }}>
                  Identidad Legal y Tributaria (DIAN)
                </Typography>
                <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
                  Requerido para emitir Factura Electrónica
                </Typography>
              </Box>
              <Typography sx={{ fontSize: 11, color: 'text.secondary', mr: 0.5 }}>
                {showAdvanced ? 'Ocultar' : 'Ver campos'}
              </Typography>
              {showAdvanced ? <ExpandLess sx={{ color: 'text.secondary', fontSize: 18 }} /> : <ExpandMore sx={{ color: 'text.secondary', fontSize: 18 }} />}
            </Box>

            <Collapse in={showAdvanced}>
              <Box sx={{ pt: 2, pb: 1 }}>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6} md={4}>
                    <TextField
                      select label="Tipo de Documento"
                      value={tipoDocumento}
                      onChange={(e) => setTipoDocumento(Number(e.target.value))}
                      fullWidth size="small"
                      SelectProps={{ native: true }}
                    >
                      <option value={13}>Cédula de Ciudadanía</option>
                      <option value={31}>NIT</option>
                      <option value={11}>Registro Civil</option>
                      <option value={12}>Tarjeta de Identidad</option>
                      <option value={22}>Cédula de Extranjería</option>
                      <option value={41}>Pasaporte</option>
                      <option value={42}>Doc. extranjero</option>
                      <option value={50}>NIT otro país</option>
                      <option value={91}>NUIP</option>
                    </TextField>
                  </Grid>
                  <Grid item xs={12} sm={6} md={2}>
                    <TextField
                      label="DV"
                      value={dv}
                      onChange={(e) => setDv(e.target.value)}
                      fullWidth size="small"
                      placeholder={Number(tipoDocumento) === 31 ? 'Auto' : 'Solo NIT'}
                      disabled={Number(tipoDocumento) !== 31}
                      InputProps={{ readOnly: Number(tipoDocumento) === 31 }}
                      helperText={Number(tipoDocumento) === 31 && dv ? 'Se calculó automáticamente' : ''}
                      sx={{ '& .MuiInputBase-input': { fontWeight: dv ? 700 : 400, color: dv ? '#10B981' : undefined } }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={4} md={2}>
                    <TextField
                      select label="Organización"
                      value={tipoOrganizacion}
                      onChange={(e) => setTipoOrganizacion(Number(e.target.value))}
                      fullWidth size="small"
                      SelectProps={{ native: true }}
                    >
                      <option value={1}>Jurídica</option>
                      <option value={2}>Natural</option>
                    </TextField>
                  </Grid>
                  <Grid item xs={12} sm={4} md={2}>
                    <TextField
                      select label="Régimen Fiscal"
                      value={tipoRegimen}
                      onChange={(e) => setTipoRegimen(Number(e.target.value))}
                      fullWidth size="small"
                      SelectProps={{ native: true }}
                    >
                      <option value={48}>Responsable de IVA</option>
                      <option value={49}>No responsable de IVA</option>
                    </TextField>
                  </Grid>
                  <Grid item xs={12} sm={4} md={2}>
                    <TextField
                      label="Responsabilidad Fiscal"
                      value={responsabilidadFiscal}
                      onChange={(e) => setResponsabilidadFiscal(e.target.value)}
                      fullWidth size="small"
                      placeholder="R-99-PN"
                    />
                  </Grid>
                </Grid>
              </Box>
            </Collapse>

            {/* ── Botones ── */}
            <Box sx={{ display: 'flex', gap: 1.5, justifyContent: 'flex-end', mt: 3 }}>
              <Button onClick={handleClose} variant="outlined" size="small"
                sx={{ borderRadius: 2, fontWeight: 600, borderColor: 'divider', color: 'text.secondary', px: 3 }}>
                Cancelar
              </Button>
              <Button type="submit" variant="contained" size="small"
                sx={{
                  background: `linear-gradient(135deg, ${ACCENT}, #60a5fa)`,
                  boxShadow: `0 4px 14px rgba(59,130,246,0.3)`,
                  borderRadius: 2, fontWeight: 700, px: 3,
                }}>
                {isEditing ? 'Actualizar Tercero' : 'Guardar Tercero'}
              </Button>
            </Box>
          </Box>
        </Collapse>
      </Paper>

      {/* ── Carga masiva ── */}
      <Paper elevation={0} sx={{
        borderRadius: 3, border: '1px solid', borderColor: 'divider',
        bgcolor: 'background.paper', overflow: 'hidden',
        boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
      }}>
        <Box
          onClick={() => setBulkOpen(o => !o)}
          sx={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            px: 2.5, py: 1.5, cursor: 'pointer',
            '&:hover': { bgcolor: 'action.hover' }, transition: 'background 0.15s',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{
              width: 32, height: 32, borderRadius: 1.5, flexShrink: 0,
              bgcolor: 'rgba(139,92,246,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8B5CF6',
            }}>
              <Upload fontSize="small" />
            </Box>
            <Typography sx={{ fontWeight: 700, fontSize: 14 }}>
              Carga Masiva de Terceros
            </Typography>
          </Box>
          {bulkOpen
            ? <ExpandLess sx={{ color: 'text.secondary' }} />
            : <ExpandMore sx={{ color: 'text.secondary' }} />
          }
        </Box>
        <Collapse in={bulkOpen}>
          <Divider />
          <Box sx={{ p: { xs: 2, md: 3 } }}>
            <BulkUpload uploadType="clientes" onUploadSuccess={() => { if (onClienteAdded) onClienteAdded(); }} />
          </Box>
        </Collapse>
      </Paper>
    </Box>
  );
};

export default ClienteForm;
