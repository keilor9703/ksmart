import React, { useState, useEffect } from 'react';
import apiClient from '../api';
import { toast } from 'react-toastify';
import BulkUpload from './BulkUpload';
import {
  Box, Typography, Grid, TextField, Button, InputAdornment,
  Collapse, Divider, Chip, MenuItem, Select, FormControl, InputLabel, IconButton,
  ButtonGroup, Switch, FormControlLabel, Autocomplete
} from '@mui/material';
import { Inventory, ExpandMore, ExpandLess, Upload, Close, Category, Science } from '@mui/icons-material';
import { GRUPOS_PRODUCTO, UNIDADES_MEDIDA } from '../utils/constants';

const DEFAULT_ACCENT = '#8B5CF6';

const Panel = ({ title, icon, chip, open, onToggle, forceOpen, onClose, children, accentColor }) => (
  <Box sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider', bgcolor: 'background.paper', mb: 2, boxShadow: open ? '0 4px 24px rgba(0,0,0,0.08)' : '0 2px 8px rgba(0,0,0,0.04)', transition: 'box-shadow 0.2s' }}>
    <Box onClick={() => { if (!forceOpen) onToggle(); }} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: { xs: 1.5, md: 2.5 }, py: 1.5, cursor: forceOpen ? 'default' : 'pointer', '&:hover': { bgcolor: forceOpen ? 'transparent' : 'action.hover' } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0, flex: 1 }}>
        <Box sx={{ width: 30, height: 30, borderRadius: 1.5, flexShrink: 0, bgcolor: `${accentColor}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: accentColor }}>{icon}</Box>
        <Typography sx={{ fontWeight: 600, fontSize: 14 }}>{title}</Typography>
        {chip && <Box sx={{ flexShrink: 0 }}>{chip}</Box>}
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0, ml: 1 }}>
        {open && onClose && <IconButton size="small" onClick={(e) => { e.stopPropagation(); onClose(); }} sx={{ color: 'text.secondary' }}><Close fontSize="small" /></IconButton>}
        {!forceOpen && (open ? <ExpandLess sx={{ color: 'text.secondary', fontSize: 20 }} /> : <ExpandMore sx={{ color: 'text.secondary', fontSize: 20 }} />)}
      </Box>
    </Box>
    <Collapse in={open}>
      <Divider />
      <Box sx={{ p: { xs: 2, md: 3 }, bgcolor: 'background.default' }}>{children}</Box>
    </Collapse>
  </Box>
);

const ProductoForm = ({ onProductoAdded, productoToEdit, onProductoUpdated, forceOpen, onClose, accentColor = DEFAULT_ACCENT }) => {
  const [nombre, setNombre]         = useState('');
  const [precio, setPrecio]         = useState('');
  const [costo, setCosto]           = useState('');
  const [esServicio, setEsServicio] = useState(false);
  const [unidadMedida, setUnidadMedida] = useState('UND');
  const [grupoItem, setGrupoItem]   = useState(2);
  const [stockMinimo, setStockMinimo] = useState('');
  const [stockActual, setStockActual] = useState(0);
  const [manejaLotes, setManejaLotes] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);

  useEffect(() => { if (forceOpen !== undefined) setFormOpen(forceOpen); }, [forceOpen]);

  useEffect(() => {
    if (productoToEdit) {
      setNombre(productoToEdit.nombre);
      setPrecio(productoToEdit.precio || '');
      setCosto(productoToEdit.costo || '');
      setEsServicio(productoToEdit.es_servicio);
      setUnidadMedida(productoToEdit.unidad_medida || 'UND');
      setGrupoItem(productoToEdit.grupo_item || 2);
      setStockMinimo(productoToEdit.stock_minimo != null ? String(productoToEdit.stock_minimo) : '');
      setStockActual(productoToEdit.stock_actual ?? 0);
      setManejaLotes(productoToEdit.maneja_lotes || false);
    } else {
      resetFields();
    }
  }, [productoToEdit]);

  const resetFields = () => {
    setNombre(''); setPrecio(''); setCosto(''); setEsServicio(false); setUnidadMedida('UND'); setGrupoItem(2); setStockMinimo(''); setStockActual(0); setManejaLotes(false);
  };

  const handleClose = () => { resetFields(); setFormOpen(false); if (onClose) onClose(); };

  const handleSubmit = (e) => {
    e.preventDefault();
    const data = {
      nombre,
      precio: parseFloat(precio) || 0.0,
      costo: esServicio ? 0.0 : (parseFloat(costo) || 0.0),
      es_servicio: esServicio,
      unidad_medida: esServicio ? 'UND' : unidadMedida,
      grupo_item: esServicio ? 2 : parseInt(grupoItem),
      stock_minimo: esServicio || stockMinimo === '' ? 0 : parseFloat(stockMinimo),
      maneja_lotes: esServicio ? false : manejaLotes,
    };
    
    const req = productoToEdit ? apiClient.put(`/productos/${productoToEdit.id}`, data) : apiClient.post('/productos/', data);
    req.then(res => {
      toast.success(`Ítem ${productoToEdit ? 'actualizado' : 'agregado'} exitosamente`);
      if (productoToEdit) { onProductoUpdated(res.data); } else { resetFields(); onProductoAdded(res.data); }
      handleClose();
    }).catch(() => toast.error(`Error al ${productoToEdit ? 'actualizar' : 'agregar'} el ítem.`));
  };

  const isEditing = Boolean(productoToEdit);

  return (
    <Box sx={{ mb: 3 }}>
      <Panel title={isEditing ? 'Editar Ítem' : 'Agregar Nuevo Ítem'} icon={<Category fontSize="small" />} chip={isEditing && <Chip label="Editando" size="small" sx={{ bgcolor: `${accentColor}18`, color: accentColor, fontWeight: 600, fontSize: 11 }} />} open={formOpen} onToggle={() => setFormOpen(o => !o)} forceOpen={forceOpen && formOpen} onClose={handleClose} accentColor={accentColor}>
        <Box component="form" onSubmit={handleSubmit}>
          
          {/* ── 1. SELECTOR PRINCIPAL DE TIPO DE ÍTEM ── */}
          <Box sx={{ mb: 4, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <Typography sx={{ fontSize: 12, fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.8, mb: 1.5 }}>
              ¿Qué tipo de ítem deseas crear?
            </Typography>
            <ButtonGroup variant="outlined" sx={{ '& .MuiButton-root': { py: 1.5, px: { xs: 2, sm: 4 }, borderColor: 'divider' } }}>
              <Button onClick={() => setEsServicio(false)} sx={{ bgcolor: !esServicio ? `${accentColor}15` : 'transparent', color: !esServicio ? accentColor : 'text.secondary', borderColor: !esServicio ? `${accentColor} !important` : 'divider', fontWeight: !esServicio ? 700 : 500, fontSize: { xs: 13, sm: 15 } }}>
                📦 Producto Físico
              </Button>
              <Button onClick={() => setEsServicio(true)} sx={{ bgcolor: esServicio ? '#06B6D415' : 'transparent', color: esServicio ? '#06B6D4' : 'text.secondary', borderColor: esServicio ? `#06B6D4 !important` : 'divider', fontWeight: esServicio ? 700 : 500, fontSize: { xs: 13, sm: 15 } }}>
                ⚙️ Servicio Intangible
              </Button>
            </ButtonGroup>
          </Box>

          <Divider sx={{ mb: 3 }} />

          {/* ── 2. CAMPOS DEL FORMULARIO DINÁMICO ── */}
          <Grid container spacing={3}>
            <Grid item xs={12} sm={esServicio ? 8 : 6}>
              <TextField label={esServicio ? "Nombre del Servicio *" : "Nombre del Producto *"} value={nombre} onChange={e => setNombre(e.target.value)} fullWidth required />
            </Grid>
            <Grid item xs={12} sm={esServicio ? 4 : 3}>
              <TextField label={esServicio ? "Precio de Venta *" : "Precio de Venta (Opcional)"} value={precio} onChange={e => setPrecio(e.target.value.replace(/[^0-9.]/g, ''))} fullWidth required={esServicio} InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }} />
            </Grid>

            {/* CAMPOS EXCLUSIVOS DE PRODUCTOS FÍSICOS */}
            {!esServicio && (
              <>
                <Grid item xs={12} sm={3}>
                  <TextField label="Costo Actual *" value={costo} onChange={e => setCosto(e.target.value.replace(/[^0-9.]/g, ''))} fullWidth required InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }} />
                </Grid>
                
                {/* 👇 MODIFICADO: Selector moderno de Grupos */}
                <Grid item xs={12} sm={4}>
                  <Autocomplete
                    options={GRUPOS_PRODUCTO}
                    getOptionLabel={(option) => option.label || ''}
                    value={GRUPOS_PRODUCTO.find(g => g.id === grupoItem) || null}
                    onChange={(_, newValue) => setGrupoItem(newValue ? newValue.id : 2)}
                    renderInput={(params) => (
                      <TextField {...params} label="Grupo o Categoría *" required />
                    )}
                  />
                </Grid>
                
                {/* 👇 MODIFICADO: Unidad de medida 100% Universal (Free Solo) */}
                <Grid item xs={12} sm={4}>
                  <Autocomplete
                    freeSolo
                    options={UNIDADES_MEDIDA.map(u => u.value)}
                    value={unidadMedida}
                    onChange={(_, newValue) => setUnidadMedida(newValue || 'UND')}
                    onInputChange={(_, newInputValue) => setUnidadMedida(newInputValue ? newInputValue.toUpperCase() : '')}
                    renderInput={(params) => (
                      <TextField {...params} label="Unidad de Medida *" required placeholder="Ej: CAJAx12" />
                    )}
                  />
                </Grid>
                
                <Grid item xs={12} sm={4}>
                  <TextField label="Alerta de Stock Mínimo" value={stockMinimo} onChange={e => setStockMinimo(e.target.value.replace(/[^0-9.]/g, ''))} fullWidth placeholder="Ej: 10" helperText="Te avisaremos cuando baje de este número" />
                </Grid>
                
                <Grid item xs={12}>
                  <Box sx={{ p: 1.5, borderRadius: 2, border: '1px solid', borderColor: manejaLotes ? '#10B981' : 'divider', bgcolor: manejaLotes ? '#ECFDF5' : 'transparent', transition: 'all 0.2s' }}>
                    <FormControlLabel 
                      control={<Switch checked={manejaLotes} onChange={(e) => setManejaLotes(e.target.checked)} color="success" />} 
                      label={<Typography sx={{ fontWeight: 600, fontSize: 14, color: manejaLotes ? '#059669' : 'text.primary' }}>Este es un Producto Perecedero (Control por Lotes y Vencimiento)</Typography>} 
                      sx={{ m: 0 }}
                    />
                    {manejaLotes && (
                      <Typography sx={{ fontSize: 12, color: '#059669', mt: 0.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Science fontSize="small" /> Activado: Catálogo actualizado. Podrás ingresar los números de Lote y Vencimientos cuando registres Entradas en el módulo "Lotes" o "Compras".
                      </Typography>
                    )}
                  </Box>
                </Grid>

                {isEditing && (
                  <Grid item xs={12}>
                    <Box sx={{ p: 2, bgcolor: 'action.hover', borderRadius: 2, border: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 2 }}>
                       <Inventory color="action" />
                       <Box>
                         <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>Stock Actual en Bodega</Typography>
                         <Typography sx={{ fontWeight: 700, fontSize: 16 }}>{stockActual} {unidadMedida}</Typography>
                         <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>*Este valor se actualiza automáticamente con compras y ventas.</Typography>
                       </Box>
                    </Box>
                  </Grid>
                )}
              </>
            )}

            {/* ── BOTONES ── */}
            <Grid item xs={12}>
              <Box sx={{ display: 'flex', gap: 1.5, justifyContent: 'flex-end', mt: 1 }}>
                <Button onClick={handleClose} variant="outlined" sx={{ borderRadius: 2, fontWeight: 600, borderColor: 'divider', color: 'text.secondary', px: 3 }}>Cancelar</Button>
                <Button type="submit" variant="contained" sx={{ background: esServicio ? `linear-gradient(135deg, #06B6D4, #22d3ee)` : `linear-gradient(135deg, ${accentColor}, #a78bfa)`, boxShadow: esServicio ? `0 4px 14px rgba(6,182,212,0.3)` : `0 4px 14px rgba(139,92,246,0.3)`, borderRadius: 2, fontWeight: 600, px: 4 }}>
                  {isEditing ? 'Actualizar Cambios' : `Guardar ${esServicio ? 'Servicio' : 'Producto'}`}
                </Button>
              </Box>
            </Grid>
          </Grid>
        </Box>
      </Panel>

      {!isEditing && (
        <Panel title="Carga Masiva de Inventario" icon={<Upload fontSize="small" />} chip={<Chip label="Excel / CSV" size="small" sx={{ bgcolor: 'rgba(139,92,246,0.1)', color: accentColor, fontWeight: 600, fontSize: 11 }} />} open={bulkOpen} onToggle={() => setBulkOpen(o => !o)} accentColor={accentColor}>
          <BulkUpload uploadType="productos" onUploadSuccess={() => {}} />
        </Panel>
      )}
    </Box>
  );
};

export default ProductoForm;