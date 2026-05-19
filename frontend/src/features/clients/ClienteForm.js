import React, { useState, useEffect } from 'react';
import apiClient from '../../api';
import { toast } from 'react-toastify';
import CurrencyField from '../../components/common/CurrencyField';
import BulkUpload from '../../components/common/BulkUpload';
import {
  Box, Typography, Grid, TextField, Button, InputAdornment,
  Collapse, Divider, Chip, IconButton
} from '@mui/material';
import {
  PersonAdd, ExpandMore, ExpandLess, Upload,
  Business, Person, Close
} from '@mui/icons-material';

const ACCENT = '#3B82F6';

// ─── Algoritmo DIAN para calcular DV a partir del NIT ─────────────────────────
// https://www.dian.gov.co — pesos oficiales para el dígito de verificación
const PESOS_DV = [71, 67, 59, 53, 47, 43, 41, 37, 29, 23, 19, 17, 13, 7, 3];
const calcularDV = (nit) => {
  const digits = String(nit).replace(/\D/g, '');
  if (!digits || digits.length < 4) return '';
  const padded = digits.padStart(15, '0');
  const suma = padded.split('').reduce((acc, d, i) => acc + parseInt(d) * PESOS_DV[i], 0);
  const residuo = suma % 11;
  return String(residuo === 0 || residuo === 1 ? residuo : 11 - residuo);
};

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
  const [email, setEmail]           = useState('');
  const [tipoDocumento, setTipoDocumento] = useState(13); // 13: Cédula
  const [dv, setDv]                 = useState('');
  const [tipoOrganizacion, setTipoOrganizacion] = useState(2); // 2: Natural
  const [tipoRegimen, setTipoRegimen] = useState(49); // 49: No responsable
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

  // Auto-calcular DV cada vez que cambia el NIT (cedula) y el tipo es NIT (31)
  useEffect(() => {
    if (Number(tipoDocumento) === 31 && cedula) {
      setDv(calcularDV(cedula));
    } else if (Number(tipoDocumento) !== 31) {
      setDv('');
    }
  }, [cedula, tipoDocumento]);

  // Cargar datos al editar
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
    const data = {
      nombre, cedula, telefono, direccion,
      email,
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
                  label="Correo Electrónico"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  fullWidth size="small"
                  type="email"
                  placeholder="correo@ejemplo.com"
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <CurrencyField
                  label="Cupo de Crédito"
                  value={cupoCredito}
                  onChange={setCupoCredito}
                  fullWidth size="small"
                  helperText="Solo aplica para clientes"
                />
              </Grid>

              {/* Tipo de tercero */}
              <Grid item xs={12}>
                <Typography sx={{ fontSize: 11, color: 'text.secondary', mb: 0.8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Tipo de tercero
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  <TipoToggle label="Es Cliente"   icon={<Person fontSize="small" />}   checked={esCliente}   onChange={setEsCliente}   color={ACCENT}    />
                  <TipoToggle label="Es Proveedor" icon={<Business fontSize="small" />} checked={esProveedor} onChange={setEsProveedor} color="#10B981" />
                </Box>
              </Grid>

              <Grid item xs={12}>
                <Divider sx={{ my: 1 }}><Chip label="FACTURACIÓN ELECTRÓNICA (DIAN)" size="small" sx={{ fontSize: 10, fontWeight: 700 }} /></Divider>
              </Grid>

              <Grid item xs={12} sm={12}>
                 <Button 
                    fullWidth 
                    variant="text" 
                    size="small" 
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    endIcon={showAdvanced ? <ExpandLess /> : <ExpandMore />}
                    sx={{ height: '100%', textTransform: 'none', fontWeight: 700, color: 'text.secondary' }}
                 >
                    {showAdvanced ? "Ocultar Datos DIAN" : "Ver Datos DIAN"}
                 </Button>
              </Grid>

              <Grid item xs={12}>
                <Collapse in={showAdvanced}>
                  <Grid container spacing={1.5} sx={{ pt: 1 }}>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        select
                        label="Tipo de Documento"
                        value={tipoDocumento}
                        onChange={(e) => setTipoDocumento(Number(e.target.value))}
                        fullWidth size="small"
                        SelectProps={{ native: true }}
                      >
                        <option value={13}>Cédula de Ciudadanía</option>
                        <option value={31}>NIT (Número de Identificación Tributaria)</option>
                        <option value={11}>Registro Civil</option>
                        <option value={12}>Tarjeta de Identidad</option>
                        <option value={22}>Cédula de Extranjería</option>
                        <option value={41}>Pasaporte</option>
                        <option value={42}>Tipo de documento extranjero</option>
                        <option value={50}>NIT de otro país</option>
                        <option value={91}>NUIP</option>
                      </TextField>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        label="DV (Dígito de Verificación)"
                        value={dv}
                        onChange={(e) => setDv(e.target.value)}
                        fullWidth size="small"
                        placeholder={Number(tipoDocumento) === 31 ? 'Se calcula automáticamente' : 'Solo aplica para NIT'}
                        disabled={Number(tipoDocumento) !== 31}
                        InputProps={{ readOnly: Number(tipoDocumento) === 31 }}
                        helperText={Number(tipoDocumento) === 31 ? (dv ? `DV calculado automáticamente: ${dv}` : 'Ingresa el NIT para calcular') : ''}
                        sx={{ '& .MuiInputBase-input': { fontWeight: dv ? 700 : 400, color: dv ? '#10B981' : undefined } }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <TextField
                        select
                        label="Tipo Organización"
                        value={tipoOrganizacion}
                        onChange={(e) => setTipoOrganizacion(Number(e.target.value))}
                        fullWidth size="small"
                        SelectProps={{ native: true }}
                      >
                        <option value={1}>Jurídica</option>
                        <option value={2}>Natural</option>
                      </TextField>
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <TextField
                        select
                        label="Régimen Fiscal"
                        value={tipoRegimen}
                        onChange={(e) => setTipoRegimen(Number(e.target.value))}
                        fullWidth size="small"
                        SelectProps={{ native: true }}
                      >
                        <option value={48}>Responsable de IVA</option>
                        <option value={49}>No responsable de IVA</option>
                      </TextField>
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <TextField
                        label="Responsabilidades Fiscales"
                        value={responsabilidadFiscal}
                        onChange={(e) => setResponsabilidadFiscal(e.target.value)}
                        fullWidth size="small"
                        placeholder="O-13, R-99-PN"
                      />
                    </Grid>
                  </Grid>
                </Collapse>
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
            <BulkUpload uploadType="clientes" onUploadSuccess={() => { if (onClienteAdded) onClienteAdded(); }} />
          </Box>
        </Collapse>
      </Box>
    </Box>
  );
};

export default ClienteForm;
