import React, { useState, useEffect } from 'react';
import apiClient from '../api';
import { toast } from 'react-toastify';
import BulkUpload from './BulkUpload';
import {
  Box, Typography, Grid, TextField, Button, InputAdornment,
  Collapse, Divider, Chip, MenuItem, Select, FormControl, InputLabel
} from '@mui/material';
import { Inventory, ExpandMore, ExpandLess, Upload, Close, Settings } from '@mui/icons-material';

const DEFAULT_ACCENT = '#8B5CF6';

const GRUPOS = [
  { value: 1, label: 'MP — Materia Prima' },
  { value: 2, label: 'PT — Producto Terminado' },
  { value: 3, label: 'AF — Activo Fijo' },
  { value: 4, label: 'INS — Insumos' },
];

const UNIDADES = [
  { value: 'UND', label: 'Unidad (Und)' },
  { value: 'MTS', label: 'Metros (Mts)' },
  { value: 'KGS', label: 'Kilos (Kg)' },
  { value: 'GRS', label: 'Gramos (Gr)' },
  { value: 'PAR', label: 'Pares' },
];

// ─── Toggle genérico ──────────────────────────────────────────────────────────
const ToggleBtn = ({ label, checked, onChange, color }) => (
  <Button
    variant={checked ? 'contained' : 'outlined'}
    onClick={() => onChange(!checked)}
    size="small"
    sx={{
      borderRadius: 2, fontWeight: 600, fontSize: 12.5, textTransform: 'none',
      ...(checked
        ? { bgcolor: color, '&:hover': { bgcolor: color, filter: 'brightness(0.9)' }, borderColor: color }
        : { borderColor: 'divider', color: 'text.secondary' }),
    }}
  >
    {label}
  </Button>
);

// ─── Panel colapsable reutilizable ────────────────────────────────────────────
const Panel = ({ title, icon, chip, open, onToggle, forceOpen, onClose, children, accentColor }) => (
  <Box sx={{
    borderRadius: 3, border: '1px solid', borderColor: 'divider',
    bgcolor: 'background.paper', overflow: 'hidden', mb: 2,
    boxShadow: open ? '0 4px 24px rgba(0,0,0,0.08)' : '0 2px 8px rgba(0,0,0,0.04)',
    transition: 'box-shadow 0.2s',
  }}>
    <Box
      onClick={() => { if (!forceOpen) onToggle(); }}
      sx={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        px: 2.5, py: 1.8, cursor: forceOpen ? 'default' : 'pointer',
        '&:hover': { bgcolor: forceOpen ? 'transparent' : 'action.hover' },
        transition: 'background 0.15s',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Box sx={{ width: 32, height: 32, borderRadius: 1.5, bgcolor: `${accentColor}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: accentColor }}>
          {icon}
        </Box>
        <Typography sx={{ fontWeight: 600, fontSize: 14 }}>{title}</Typography>
        {chip}
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        {open && onClose && (
          <Button size="small" onClick={(e) => { e.stopPropagation(); onClose(); }}
            startIcon={<Close fontSize="small" />}
            sx={{ color: 'text.secondary', fontWeight: 600, fontSize: 12, textTransform: 'none' }}>
            Cerrar
          </Button>
        )}
        {!forceOpen && (open ? <ExpandLess sx={{ color: 'text.secondary' }} /> : <ExpandMore sx={{ color: 'text.secondary' }} />)}
      </Box>
    </Box>
    <Collapse in={open}>
      <Divider />
      <Box sx={{ p: { xs: 2, md: 3 } }}>{children}</Box>
    </Collapse>
  </Box>
);

// ─── Componente principal ──────────────────────────────────────────────────────
const ProductoForm = ({
  onProductoAdded, productoToEdit, onProductoUpdated,
  forceOpen, onClose, accentColor = DEFAULT_ACCENT,
}) => {
  const [nombre, setNombre]         = useState('');
  const [precio, setPrecio]         = useState('');
  const [costo, setCosto]           = useState('');
  const [esServicio, setEsServicio] = useState(false);
  const [unidadMedida, setUnidadMedida] = useState('UND');
  const [grupoItem, setGrupoItem]   = useState(2);
  const [stockMinimo, setStockMinimo] = useState('');
  const [stockActual, setStockActual] = useState(0);

  const [formOpen, setFormOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);

  useEffect(() => {
    if (forceOpen !== undefined) setFormOpen(forceOpen);
  }, [forceOpen]);

  useEffect(() => {
    if (productoToEdit) {
      setNombre(productoToEdit.nombre);
      setPrecio(productoToEdit.precio);
      setCosto(productoToEdit.costo || '');
      setEsServicio(productoToEdit.es_servicio);
      setUnidadMedida(productoToEdit.unidad_medida || 'UND');
      setGrupoItem(productoToEdit.grupo_item || 2);
      setStockMinimo(productoToEdit.stock_minimo != null ? String(productoToEdit.stock_minimo) : '');
      setStockActual(productoToEdit.stock_actual ?? 0);
    } else {
      resetFields();
    }
  }, [productoToEdit]);

  const resetFields = () => {
    setNombre(''); setPrecio(''); setCosto('');
    setEsServicio(false); setUnidadMedida('UND'); setGrupoItem(2);
    setStockMinimo(''); setStockActual(0);
  };

  const handleClose = () => {
    resetFields();
    setFormOpen(false);
    if (onClose) onClose();
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const data = {
      nombre,
      precio: parseFloat(precio),
      costo: parseFloat(costo) || 0.0,
      es_servicio: esServicio,
      unidad_medida: unidadMedida,
      grupo_item: parseInt(grupoItem),
      stock_minimo: stockMinimo === '' ? 0 : parseFloat(stockMinimo),
    };
    const req = productoToEdit
      ? apiClient.put(`/productos/${productoToEdit.id}`, data)
      : apiClient.post('/productos/', data);

    req.then(res => {
      toast.success(`Producto ${productoToEdit ? 'actualizado' : 'agregado'} exitosamente`);
      if (productoToEdit) { onProductoUpdated(res.data); } else { resetFields(); onProductoAdded(res.data); }
      handleClose();
    }).catch(() => toast.error(`Error al ${productoToEdit ? 'actualizar' : 'agregar'} el producto.`));
  };

  const isEditing = Boolean(productoToEdit);

  return (
    <Box sx={{ mb: 3 }}>
      {/* ── Panel formulario ── */}
      <Panel
        title={isEditing ? 'Editar Producto / Servicio' : 'Agregar Nuevo Producto / Servicio'}
        icon={<Inventory fontSize="small" />}
        chip={isEditing && <Chip label="Editando" size="small" sx={{ bgcolor: `${accentColor}18`, color: accentColor, fontWeight: 600, fontSize: 11 }} />}
        open={formOpen}
        onToggle={() => setFormOpen(o => !o)}
        forceOpen={forceOpen && formOpen}
        onClose={handleClose}
        accentColor={accentColor}
      >
        <Box component="form" onSubmit={handleSubmit}>
          <Grid container spacing={2}>

            {/* Nombre */}
            <Grid item xs={12} sm={6}>
              <TextField label="Nombre" value={nombre} onChange={e => setNombre(e.target.value)} fullWidth required />
            </Grid>

            {/* Precio */}
            <Grid item xs={12} sm={3}>
              <TextField
                label="Precio de Venta" value={precio}
                onChange={e => setPrecio(e.target.value.replace(/[^0-9.]/g, ''))}
                fullWidth required
                InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
              />
            </Grid>

            {/* Costo */}
            <Grid item xs={12} sm={3}>
              <TextField
                label="Costo" value={costo}
                onChange={e => setCosto(e.target.value.replace(/[^0-9.]/g, ''))}
                fullWidth required
                InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
              />
            </Grid>

            {/* Grupo */}
            <Grid item xs={12} sm={4}>
              <FormControl fullWidth>
                <InputLabel>Grupo de Item</InputLabel>
                <Select value={grupoItem} label="Grupo de Item" onChange={e => setGrupoItem(e.target.value)} required>
                  {GRUPOS.map(g => <MenuItem key={g.value} value={g.value}>{g.label}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>

            {/* Unidad */}
            <Grid item xs={12} sm={4}>
              <FormControl fullWidth>
                <InputLabel>Unidad de Medida</InputLabel>
                <Select value={unidadMedida} label="Unidad de Medida" onChange={e => setUnidadMedida(e.target.value)}>
                  {UNIDADES.map(u => <MenuItem key={u.value} value={u.value}>{u.label}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>

            {/* Es servicio */}
            <Grid item xs={12} sm={4} sx={{ display: 'flex', alignItems: 'center' }}>
              <Box>
                <Typography sx={{ fontSize: 11, color: 'text.secondary', mb: 1, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.6 }}>
                  Tipo
                </Typography>
                <ToggleBtn
                  label={esServicio ? '⚙️ Es un Servicio' : '📦 Es un Producto'}
                  checked={esServicio}
                  onChange={setEsServicio}
                  color={accentColor}
                />
              </Box>
            </Grid>

            {/* Stock — solo si no es servicio */}
            {!esServicio && (
              <>
                <Grid item xs={12} sm={3}>
                  <TextField
                    label="Stock Mínimo" value={stockMinimo}
                    onChange={e => setStockMinimo(e.target.value.replace(/[^0-9.]/g, ''))}
                    fullWidth helperText="Alerta cuando baje de este valor"
                  />
                </Grid>
                <Grid item xs={12} sm={3}>
                  <TextField
                    label="Stock Actual" value={stockActual}
                    fullWidth
                    InputProps={{ readOnly: true }}
                    helperText="Se actualiza por movimientos"
                    sx={{ '& .MuiOutlinedInput-root': { bgcolor: 'action.hover' } }}
                  />
                </Grid>
              </>
            )}

            {/* Botones */}
            <Grid item xs={12}>
              <Box sx={{ display: 'flex', gap: 1.5, justifyContent: 'flex-end' }}>
                <Button onClick={handleClose} variant="outlined"
                  sx={{ borderRadius: 2, fontWeight: 600, borderColor: 'divider', color: 'text.secondary' }}>
                  Cancelar
                </Button>
                <Button type="submit" variant="contained"
                  sx={{ background: `linear-gradient(135deg, ${accentColor}, #a78bfa)`, boxShadow: `0 4px 14px rgba(139,92,246,0.3)`, borderRadius: 2, fontWeight: 600 }}>
                  {isEditing ? 'Actualizar Producto' : 'Guardar Producto'}
                </Button>
              </Box>
            </Grid>
          </Grid>
        </Box>
      </Panel>

      {/* ── Panel carga masiva ── */}
      <Panel
        title="Carga Masiva de Productos"
        icon={<Upload fontSize="small" />}
        chip={<Chip label="Excel / CSV" size="small" sx={{ bgcolor: 'rgba(139,92,246,0.1)', color: accentColor, fontWeight: 600, fontSize: 11 }} />}
        open={bulkOpen}
        onToggle={() => setBulkOpen(o => !o)}
        accentColor={accentColor}
      >
        <BulkUpload uploadType="productos" onUploadSuccess={() => {}} />
      </Panel>
    </Box>
  );
};

export default ProductoForm;
