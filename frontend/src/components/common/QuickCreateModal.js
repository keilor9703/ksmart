import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Box, Typography, TextField, Button, IconButton,
  CircularProgress, InputAdornment, Divider, Switch, FormControlLabel
} from '@mui/material';
import {
  Close, PersonAdd, Inventory2Outlined,
  CheckCircle, Science
} from '@mui/icons-material';
import { toast } from 'react-toastify';
import apiClient from '../../api';
import { GRUPOS_PRODUCTO, UNIDADES_MEDIDA } from '../../utils/constants';
import CurrencyField from './CurrencyField';

// ─── Colores y configuración por tipo ─────────────────────────────────────────
const TYPE_CONFIG = {
  tercero: {
    title:       'Crear nuevo proveedor / cliente',
    subtitle:    'Solo los campos esenciales — puedes completar el resto después',
    icon:        <PersonAdd />,
    color:       '#3B82F6',
    colorLight:  '#EFF6FF',
    btnLabel:    'Crear Tercero',
  },
  producto: {
    title:       'Crear nuevo producto',
    subtitle:    'Solo los campos esenciales — puedes completar el resto después',
    icon:        <Inventory2Outlined />,
    color:       '#10B981',
    colorLight:  '#ECFDF5',
    btnLabel:    'Crear Producto',
  },
};

// ─── Formulario de Tercero ────────────────────────────────────────────────────
const TerceroForm = ({ data, onChange, errors }) => (
  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
    <TextField
      label="Nombre o razón social *"
      value={data.nombre}
      onChange={e => onChange('nombre', e.target.value)}
      fullWidth size="small"
      error={!!errors.nombre}
      helperText={errors.nombre}
      autoFocus
      placeholder="Ej: Distribuciones García S.A.S."
    />
    <Box sx={{ display: 'flex', gap: 1.5 }}>
      <TextField label="NIT / Cédula" value={data.cedula} onChange={e => onChange('cedula', e.target.value)} size="small" error={!!errors.cedula} helperText={errors.cedula || 'Único por tercero'} sx={{ flex: 1 }} />
      <TextField label="Teléfono" value={data.telefono} onChange={e => onChange('telefono', e.target.value)} size="small" sx={{ flex: 1 }} />
    </Box>
    <TextField label="Dirección" value={data.direccion} onChange={e => onChange('direccion', e.target.value)} size="small" fullWidth />
    <CurrencyField
      label="Cupo de crédito"
      value={data.cupo_credito}
      onChange={val => onChange('cupo_credito', val)}
      helperText="Límite máximo de ventas a crédito. Deja en 0 si no aplica."
    />
    
    <Box>
      <Typography sx={{ fontSize: 11, fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', mb: 0.8 }}>Tipo de tercero</Typography>
      <Box sx={{ display: 'flex', gap: 1 }}>
        {[
          { key: 'es_proveedor', label: '🏭 Proveedor' },
          { key: 'es_cliente',   label: '👤 Cliente'   },
        ].map(({ key, label }) => (
          <Box
            key={key}
            onClick={() => onChange(key, !data[key])}
            sx={{
              flex: 1, py: 1, borderRadius: 2, textAlign: 'center',
              cursor: 'pointer', fontSize: 13, fontWeight: 600,
              border: '1.5px solid', borderColor: data[key] ? '#3B82F6' : 'divider',
              bgcolor: data[key] ? '#EFF6FF' : 'background.paper',
              color: data[key] ? '#3B82F6' : 'text.secondary',
              transition: 'all 0.15s', userSelect: 'none',
            }}
          >
            {label}
          </Box>
        ))}
      </Box>
    </Box>
  </Box>
);

// ─── Formulario de Producto ───────────────────────────────────────────────────
const ProductoForm = ({ data, onChange, errors }) => (
  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
    <TextField
      label="Nombre del producto *"
      value={data.nombre}
      onChange={e => onChange('nombre', e.target.value)}
      fullWidth size="small"
      error={!!errors.nombre}
      helperText={errors.nombre}
      autoFocus
    />
    <Box sx={{ display: 'flex', gap: 1.5 }}>
      <CurrencyField
        label="Costo de compra *"
        value={data.costo}
        onChange={val => onChange('costo', val)}
        error={!!errors.costo}
        helperText={errors.costo}
        sx={{ flex: 1 }}
      />
      <CurrencyField
        label="Precio de venta"
        value={data.precio}
        onChange={val => onChange('precio', val)}
        sx={{ flex: 1 }}
      />
    </Box>

    <Box>
      <Typography sx={{ fontSize: 11, fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', mb: 0.8 }}>Unidad de medida</Typography>
      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
        {UNIDADES_MEDIDA.map(u => (
          <Box key={u.value} onClick={() => onChange('unidad_medida', u.value)}
            sx={{ px: 1.4, py: 0.6, borderRadius: 1.5, cursor: 'pointer', fontSize: 12, fontWeight: 600, border: '1.5px solid', borderColor: data.unidad_medida === u.value ? '#10B981' : 'divider', bgcolor: data.unidad_medida === u.value ? '#ECFDF5' : 'transparent', color: data.unidad_medida === u.value ? '#10B981' : 'text.secondary', userSelect: 'none' }}
          >
            {u.value}
          </Box>
        ))}
      </Box>
    </Box>

    <Box>
      <Typography sx={{ fontSize: 11, fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', mb: 0.8 }}>Tipo de producto</Typography>
      <Box sx={{ display: 'flex', gap: 0.8, flexWrap: 'wrap' }}>
        {GRUPOS_PRODUCTO.map(g => (
          <Box key={g.id} onClick={() => onChange('grupo_item', g.id)}
            sx={{ flex: '1 1 0', minWidth: 0, py: 0.8, borderRadius: 2, textAlign: 'center', cursor: 'pointer', fontSize: 12, fontWeight: 600, border: '1.5px solid', borderColor: data.grupo_item === g.id ? g.color : 'divider', bgcolor: data.grupo_item === g.id ? `${g.color}12` : 'background.paper', color: data.grupo_item === g.id ? g.color : 'text.secondary', userSelect: 'none' }}
          >
            {g.emoji} {g.short}
          </Box>
        ))}
      </Box>
    </Box>

    {/* 👇 NUEVO SWITCH INTELIGENTE PARA LOTES 👇 */}
    <Box sx={{ 
      p: 1.5, borderRadius: 2, border: '1px solid', 
      borderColor: data.maneja_lotes ? '#10B981' : 'divider', 
      bgcolor: data.maneja_lotes ? '#ECFDF5' : 'transparent',
      transition: 'all 0.2s'
    }}>
      <FormControlLabel 
        control={<Switch checked={data.maneja_lotes} onChange={(e) => onChange('maneja_lotes', e.target.checked)} color="success" />} 
        label={<Typography sx={{ fontWeight: 600, fontSize: 14, color: data.maneja_lotes ? '#059669' : 'text.primary' }}>Producto Perecedero (Maneja Lotes)</Typography>} 
        sx={{ m: 0 }}
      />
      {data.maneja_lotes && (
        <Typography sx={{ fontSize: 11, color: '#059669', mt: 0.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Science fontSize="small" /> Las entradas requerirán fecha de vencimiento y las salidas usarán lógica FEFO.
        </Typography>
      )}
    </Box>
  </Box>
);

// ─── Componente principal ──────────────────────────────────────────────────────
const QuickCreateModal = ({ open, onClose, type, initialName = '', onCreated }) => {
  const cfg = TYPE_CONFIG[type] || TYPE_CONFIG.tercero;

  const [terceroData, setTerceroData] = useState({ nombre: '', cedula: '', telefono: '', direccion: '', es_proveedor: true, es_cliente: false, cupo_credito: 0 });
  const [productoData, setProductoData] = useState({ nombre: '', costo: '', precio: '', unidad_medida: 'UND', grupo_item: 1, es_servicio: false, stock_minimo: 0, maneja_lotes: false });
  const [errors, setErrors]     = useState({});
  const [saving, setSaving]     = useState(false);
  const [savedItem, setSavedItem] = useState(null);

  useEffect(() => {
    if (!open) return;
    setSavedItem(null); setErrors({});
    if (type === 'tercero') {
      setTerceroData({ nombre: initialName, cedula: '', telefono: '', direccion: '', es_proveedor: true, es_cliente: false, cupo_credito: 0 });
    } else {
      setProductoData({ nombre: initialName, costo: '', precio: '', unidad_medida: 'UND', grupo_item: 1, es_servicio: false, stock_minimo: 0, maneja_lotes: false });
    }
  }, [open, type, initialName]);

  const handleTerceroChange  = (k, v) => { setTerceroData(p => ({ ...p, [k]: v })); setErrors(e => ({ ...e, [k]: '' })); };
  const handleProductoChange = (k, v) => { setProductoData(p => ({ ...p, [k]: v })); setErrors(e => ({ ...e, [k]: '' })); };

  const validateTercero = () => { const errs = {}; if (!terceroData.nombre.trim()) errs.nombre = 'El nombre es obligatorio'; return errs; };
  const validateProducto = () => { const errs = {}; if (!productoData.nombre.trim()) errs.nombre = 'El nombre es obligatorio'; if (!productoData.costo && productoData.costo !== 0) errs.costo = 'Ingresa el costo'; return errs; };

  const handleSave = async () => {
    const errs = type === 'tercero' ? validateTercero() : validateProducto();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    setSaving(true);
    try {
      let response;
      if (type === 'tercero') {
        response = await apiClient.post('/clientes/', { ...terceroData, cupo_credito: parseFloat(terceroData.cupo_credito) || 0 });
      } else {
        response = await apiClient.post('/productos/', {
          ...productoData,
          costo: parseFloat(productoData.costo) || 0,
          precio: parseFloat(productoData.precio) || 0,
          maneja_lotes: productoData.maneja_lotes // ✅ SE ENVÍA AL BACKEND
        });
      }

      const nuevo = response.data;
      setSavedItem(nuevo);
      toast.success(`${type === 'tercero' ? 'Tercero' : 'Producto'} "${nuevo.nombre}" creado y seleccionado`);
      setTimeout(() => { onCreated(nuevo); onClose(); }, 700);
    } catch (err) {
      const detail = err.response?.data?.detail || '';
      if (detail.toLowerCase().includes('cedula') || detail.toLowerCase().includes('unique')) {
        setErrors({ cedula: 'Ya existe un tercero con ese NIT/cédula' });
      } else { toast.error(detail || `Error al crear el ${type === 'tercero' ? 'tercero' : 'producto'}`); }
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' } }}>
      <Box sx={{ height: 4, bgcolor: cfg.color }} />
      <DialogTitle sx={{ pb: 1, pt: 2, pr: 6 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ width: 40, height: 40, borderRadius: 2, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: `${cfg.color}18`, color: cfg.color }}>{cfg.icon}</Box>
          <Box>
            <Typography sx={{ fontWeight: 700, fontSize: 15 }}>{cfg.title}</Typography>
            <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{cfg.subtitle}</Typography>
          </Box>
        </Box>
        <IconButton size="small" onClick={onClose} disabled={saving} sx={{ position: 'absolute', right: 12, top: 14, color: 'text.secondary' }}><Close fontSize="small" /></IconButton>
      </DialogTitle>
      <DialogContent sx={{ pt: 1.5, pb: 2 }}>
        {type === 'tercero' ? <TerceroForm data={terceroData} onChange={handleTerceroChange} errors={errors} /> : <ProductoForm data={productoData} onChange={handleProductoChange} errors={errors} />}
      </DialogContent>
      <Divider />
      <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
        <Button onClick={onClose} disabled={saving} variant="outlined" size="small" sx={{ borderRadius: 2, fontWeight: 600, borderColor: 'divider', color: 'text.secondary', flex: 1 }}>Cancelar</Button>
        <Button onClick={handleSave} disabled={saving} variant="contained" size="small" startIcon={saving ? <CircularProgress size={14} color="inherit" /> : savedItem ? <CheckCircle sx={{ fontSize: 16 }} /> : null} sx={{ borderRadius: 2, fontWeight: 600, flex: 1, bgcolor: savedItem ? '#10B981' : cfg.color, '&:hover': { bgcolor: savedItem ? '#059669' : cfg.color }, color: '#fff' }}>
          {saving ? 'Guardando…' : savedItem ? '¡Creado!' : cfg.btnLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default QuickCreateModal;