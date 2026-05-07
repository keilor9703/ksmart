import React, { useState, useEffect, useMemo } from 'react';
import {
  Box, Typography, Button, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, IconButton, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, Grid, Divider, useTheme, useMediaQuery,
  Chip, Tooltip, InputAdornment, Autocomplete, Stack
} from '@mui/material';
import { Add, Delete, Edit, ReceiptLong, Search, Close, Science } from '@mui/icons-material';
import { fetchRecetas, createReceta, updateReceta, deleteReceta } from '../../api';
import apiClient from '../../api';
import { toast } from 'react-toastify';
import ConfirmationDialog from '../../components/common/ConfirmationDialog';
import QuickCreateModal from '../../components/common/QuickCreateModal';

const DEFAULT_ACCENT = '#8B5CF6';

// ─── Card Mobile para Recetas ──────────────────────────────────────────────────
const RecetaCard = ({ receta, onDelete, onEdit, accentColor }) => (
  <Paper sx={{ p: 2.5, mb: 2, borderRadius: 3, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontWeight: 700, fontSize: 15, mb: 0.3 }}>{receta.nombre}</Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
          <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>Produce:</Typography>
          <Chip 
            label={receta.producto_resultante.nombre} 
            size="small"
            sx={{ 
              bgcolor: `${accentColor}12`, 
              color: accentColor, 
              fontWeight: 600, 
              fontSize: 10, 
              borderRadius: 1,
              height: 20
            }} 
          />
        </Box>
      </Box>
      <Box sx={{ display: 'flex', gap: 0.5, ml: 1, flexShrink: 0 }}>
        <Tooltip title="Editar receta">
          <IconButton
            size="small"
            onClick={() => onEdit(receta)}
            sx={{ color: accentColor, bgcolor: `${accentColor}15`, borderRadius: 1.5 }}
          >
            <Edit fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Eliminar receta">
          <IconButton
            size="small"
            onClick={() => onDelete(receta.id)}
            sx={{ color: '#EF4444', bgcolor: '#FEF2F2', borderRadius: 1.5 }}
          >
            <Delete fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
    </Box>

    <Divider sx={{ my: 1.5 }} />

    {/* Insumos */}
    <Box sx={{ mb: receta.servicios_maquila.length > 0 ? 1.5 : 0 }}>
      <Typography sx={{ 
        fontSize: 10, 
        color: 'text.secondary', 
        fontWeight: 600, 
        mb: 0.5,
        textTransform: 'uppercase',
        letterSpacing: 0.5
      }}>
        Insumos ({receta.items.length})
      </Typography>
      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
        {receta.items.map(it => (
          <Chip 
            key={it.insumo.id} 
            label={`${it.insumo.nombre} × ${it.cantidad}`} 
            size="small"
            sx={{ 
              bgcolor: 'action.hover', 
              fontWeight: 500, 
              fontSize: 10, 
              borderRadius: 1,
              height: 22
            }} 
          />
        ))}
      </Box>
    </Box>

    {/* Servicios */}
    {receta.servicios_maquila.length > 0 && (
      <Box>
        <Typography sx={{ 
          fontSize: 10, 
          color: 'text.secondary', 
          fontWeight: 600, 
          mb: 0.5,
          textTransform: 'uppercase',
          letterSpacing: 0.5
        }}>
          Servicios ({receta.servicios_maquila.length})
        </Typography>
        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
          {receta.servicios_maquila.map(s => (
            <Chip 
              key={s.servicio.id} 
              label={s.servicio.nombre} 
              size="small"
              sx={{ 
                bgcolor: 'rgba(6,182,212,0.1)', 
                color: '#06B6D4', 
                fontWeight: 600, 
                fontSize: 10, 
                borderRadius: 1,
                height: 22
              }} 
            />
          ))}
        </Box>
      </Box>
    )}
  </Paper>
);

// ─── Componente Principal ──────────────────────────────────────────────────────
const Recetas = ({ accentColor = DEFAULT_ACCENT }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [recetas, setRecetas] = useState([]);
  const [productos, setProductos] = useState([]);
  const [insumos, setInsumos] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const [editingReceta, setEditingReceta] = useState(null);

  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);

  const [formData, setFormData] = useState({
    producto_id: '', nombre: '', descripcion: '',
    servicios: [],
    items: [{ insumo_id: '', cantidad: '' }],
  });

  const [productoInput, setProductoInput] = useState('');
  const [insumoInputs, setInsumoInputs] = useState({});
  const [quickCreate, setQuickCreate] = useState({ 
    open: false, type: 'producto', initialName: '', targetIdx: null 
  });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [recRes, prodRes] = await Promise.all([
        fetchRecetas(), 
        apiClient.get('/productos/')
      ]);
      setRecetas(recRes.data);
      const all = prodRes.data;
      setProductos(all);
      setInsumos(all.filter(p => !p.es_servicio && [1, 4].includes(p.grupo_item)));
    } catch { 
      toast.error('Error cargando recetas'); 
    }
  };

  const openEdit = (receta) => {
    setEditingReceta(receta);
    setFormData({
      producto_id: receta.producto_id,
      nombre: receta.nombre,
      descripcion: receta.descripcion || '',
      items: receta.items.map(it => ({ insumo_id: it.insumo.id, cantidad: it.cantidad })),
      servicios: receta.servicios_maquila.map(s => ({ servicio_id: s.servicio.id })),
    });
    setProductoInput(receta.producto_resultante.nombre);
    const inputs = {};
    receta.items.forEach((it, idx) => { inputs[idx] = it.insumo.nombre; });
    setInsumoInputs(inputs);
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setEditingReceta(null);
    setProductoInput('');
    setInsumoInputs({});
    setFormData({
      producto_id: '', nombre: '', descripcion: '',
      servicios: [], items: [{ insumo_id: '', cantidad: '' }]
    });
  };

  const openQuickCreate = (type, initialName = '', targetIdx = null) =>
    setQuickCreate({ open: true, type, initialName, targetIdx });

  const closeQuickCreate = () => 
    setQuickCreate(q => ({ ...q, open: false }));

  const handleQuickCreated = (nuevoRegistro) => {
    setProductos(prev => [...prev, nuevoRegistro]);
    setInsumos(prev => [...prev, nuevoRegistro]);

    if (quickCreate.targetIdx === 'resultante') {
      setFormData(f => ({ ...f, producto_id: nuevoRegistro.id }));
      setProductoInput(nuevoRegistro.nombre);
    } else if (quickCreate.targetIdx !== null) {
      handleItemChange(quickCreate.targetIdx, 'insumo_id', nuevoRegistro.id);
      setInsumoInputs(prev => ({ ...prev, [quickCreate.targetIdx]: nuevoRegistro.nombre }));
    }
    closeQuickCreate();
  };

  const addItem = () => 
    setFormData(f => ({ ...f, items: [...f.items, { insumo_id: '', cantidad: '' }] }));
  
  const addServicio = () => 
    setFormData(f => ({ ...f, servicios: [...f.servicios, { servicio_id: '' }] }));
  
  const removeItem = (i) => {
    setFormData(f => ({ ...f, items: f.items.filter((_, idx) => idx !== i) }));
    setInsumoInputs(prev => { const next = { ...prev }; delete next[i]; return next; });
  };
  
  const removeServicio = (i) => 
    setFormData(f => ({ ...f, servicios: f.servicios.filter((_, idx) => idx !== i) }));

  const handleItemChange = (i, field, val) =>
    setFormData(f => { 
      const items = [...f.items]; 
      items[i][field] = val; 
      return { ...f, items }; 
    });

  const handleInsumoInputChange = (i, val) => 
    setInsumoInputs(prev => ({ ...prev, [i]: val }));

  const handleServicioChange = (i, val) =>
    setFormData(f => { 
      const servicios = [...f.servicios]; 
      servicios[i].servicio_id = val; 
      return { ...f, servicios }; 
    });

  const handleSubmit = async () => {
    if (!formData.producto_id || formData.items.some(it => !it.insumo_id || !it.cantidad)) {
      toast.warning('Complete todos los campos requeridos');
      return;
    }
    setLoading(true);
    const payload = {
      ...formData,
      producto_id: parseInt(formData.producto_id),
      servicios: formData.servicios
        .filter(s => s.servicio_id !== '')
        .map(s => ({ servicio_id: parseInt(s.servicio_id) })),
      items: formData.items.map(it => ({
        insumo_id: parseInt(it.insumo_id),
        cantidad: parseFloat(it.cantidad),
      })),
    };
    try {
      if (editingReceta) {
        await updateReceta(editingReceta.id, payload);
        toast.success('Receta actualizada exitosamente');
      } else {
        await createReceta(payload);
        toast.success('Receta creada exitosamente');
      }
      loadData();
      handleClose();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al guardar la receta');
    } finally {
      setLoading(false);
    }
  };

  const filteredRecetas = useMemo(() =>
    recetas.filter(r =>
      r.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.producto_resultante.nombre.toLowerCase().includes(searchTerm.toLowerCase())
    ), [recetas, searchTerm]
  );

  const handleDeleteClick = (id) => { 
    setItemToDelete(id); 
    setShowConfirmDialog(true); 
  };

  const productosNoServicio = productos.filter(p => !p.es_servicio);
  const servicios = productos.filter(p => p.es_servicio);

  return (
    <Box sx={{ width: '100%' }}>
      {/* ── Toolbar ── */}
      <Box sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        mb: 2.5, 
        gap: 2, 
        flexWrap: 'wrap' 
      }}>
        {/* KPI */}
        <Box sx={{ 
          px: 2, py: 1, borderRadius: 2, 
          bgcolor: `${accentColor}0D`, 
          border: `1px solid ${accentColor}25`,
          minWidth: isMobile ? '100%' : 'auto'
        }}>
          <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>
            Total recetas
          </Typography>
          <Typography sx={{ fontWeight: 700, fontSize: 18, color: accentColor }}>
            {recetas.length}
          </Typography>
        </Box>

        {/* Búsqueda */}
        <TextField
          placeholder="Buscar receta o producto…"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          size="small"
          sx={{ minWidth: isMobile ? '100%' : 220, flex: 1, maxWidth: isMobile ? '100%' : 400 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search sx={{ color: 'text.secondary', fontSize: 20 }} />
              </InputAdornment>
            ),
          }}
        />

        {/* Botón Nueva Receta */}
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => setOpen(true)}
          fullWidth={isMobile}
          sx={{ 
            background: `linear-gradient(135deg, ${accentColor}, #a78bfa)`, 
            boxShadow: `0 4px 14px rgba(139,92,246,0.3)`, 
            borderRadius: 2, 
            fontWeight: 600, 
            whiteSpace: 'nowrap' 
          }}
        >
          Nueva Receta
        </Button>
      </Box>

      {/* ── Lista Responsive ── */}
      {isMobile ? (
        <Box>
          {filteredRecetas.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 6, color: 'text.secondary' }}>
              <Science sx={{ fontSize: 48, mb: 1, opacity: 0.3 }} />
              <Typography>No hay recetas registradas</Typography>
            </Box>
          ) : (
            filteredRecetas.map(r => (
              <RecetaCard
                key={r.id}
                receta={r}
                onDelete={handleDeleteClick}
                onEdit={openEdit}
                accentColor={accentColor}
              />
            ))
          )}
        </Box>
      ) : (
        <TableContainer sx={{ 
          borderRadius: 2, 
          border: "1px solid", 
          borderColor: "divider", 
          overflowX: "auto" 
        }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                {['Nombre', 'Producto Resultante', 'Insumos', 'Servicios Maquila', 'Acciones'].map(h => (
                  <TableCell key={h}>{h}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredRecetas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} sx={{ textAlign: 'center', py: 6, color: 'text.secondary' }}>
                    No hay recetas registradas
                  </TableCell>
                </TableRow>
              ) : (
                filteredRecetas.map(r => (
                  <TableRow key={r.id} hover>
                    <TableCell sx={{ fontWeight: 600 }}>{r.nombre}</TableCell>
                    <TableCell>
                      <Chip 
                        label={r.producto_resultante.nombre} 
                        size="small"
                        sx={{ 
                          bgcolor: `${accentColor}12`, 
                          color: accentColor, 
                          fontWeight: 600, 
                          fontSize: 11, 
                          borderRadius: 1.5 
                        }} 
                      />
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                        {r.items.map(it => (
                          <Chip 
                            key={it.insumo.id} 
                            label={`${it.insumo.nombre} ×${it.cantidad}`} 
                            size="small"
                            sx={{ 
                              bgcolor: 'action.hover', 
                              fontSize: 10, 
                              borderRadius: 1 
                            }} 
                          />
                        ))}
                      </Box>
                    </TableCell>
                    <TableCell>
                      {r.servicios_maquila.length > 0 ? (
                        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                          {r.servicios_maquila.map(s => (
                            <Chip 
                              key={s.servicio.id} 
                              label={s.servicio.nombre} 
                              size="small"
                              sx={{ 
                                bgcolor: 'rgba(6,182,212,0.1)', 
                                color: '#06B6D4', 
                                fontSize: 10, 
                                borderRadius: 1 
                              }} 
                            />
                          ))}
                        </Box>
                      ) : (
                        <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>—</Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        <Tooltip title="Editar receta">
                          <IconButton
                            size="small"
                            onClick={() => openEdit(r)}
                            sx={{ color: accentColor, '&:hover': { bgcolor: `${accentColor}15` } }}
                          >
                            <Edit fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Eliminar receta">
                          <IconButton
                            size="small"
                            onClick={() => handleDeleteClick(r.id)}
                            sx={{ color: '#EF4444', '&:hover': { bgcolor: '#FEF2F2' } }}
                          >
                            <Delete fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* ── Diálogo Nueva Receta ── */}
      <Dialog 
        open={open} 
        onClose={handleClose} 
        maxWidth="md" 
        fullWidth
        fullScreen={isMobile}
        PaperProps={{ sx: { borderRadius: isMobile ? 0 : 3 } }}
      >
        <DialogTitle sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          pb: 1 
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{ 
              width: 32, height: 32, borderRadius: 1.5, 
              bgcolor: `${accentColor}18`, 
              display: 'flex', alignItems: 'center', justifyContent: 'center', 
              color: accentColor 
            }}>
              <Science fontSize="small" />
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 700, fontSize: 17 }}>
                {editingReceta ? 'Editar Receta' : 'Nueva Receta de Producción'}
              </Typography>
              <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
                {editingReceta ? `Modificando: ${editingReceta.nombre}` : 'Define la fórmula (BOM) del producto'}
              </Typography>
            </Box>
          </Box>
          <IconButton size="small" onClick={handleClose}>
            <Close fontSize="small" />
          </IconButton>
        </DialogTitle>

        <DialogContent dividers>
          {/* Resto del código del formulario sigue igual... */}
          {/* (Es muy largo, se mantiene exactamente como está) */}
          <Typography sx={{ 
            fontWeight: 600, fontSize: 11, color: 'text.secondary', 
            textTransform: 'uppercase', letterSpacing: 0.6, mb: 1.5 
          }}>
            Información general
          </Typography>

          <Stack direction="column" spacing={2} sx={{ mb: 3, width: '100%' }}>
            <Autocomplete
              options={productosNoServicio}
              value={productosNoServicio.find(p => p.id === parseInt(formData.producto_id)) || null}
              onChange={(_, v) => setFormData({ ...formData, producto_id: v ? v.id : '' })}
              inputValue={productoInput}
              onInputChange={(_, v) => setProductoInput(v)}
              getOptionLabel={opt => opt ? opt.nombre : ''}
              filterOptions={(opts, state) => {
                const q = (state.inputValue || '').toLowerCase().trim();
                if (!q) return opts;
                return opts.filter(o => 
                  o.nombre.toLowerCase().includes(q) ||
                  (o.codigo_barras && o.codigo_barras.toLowerCase().includes(q))
                );
              }}
              noOptionsText={
                <Box sx={{ py: 0.5 }}>
                  <Typography sx={{ fontSize: 13, color: 'text.secondary', mb: 1 }}>
                    No se encontró ningún producto
                  </Typography>
                  <Button
                    size="small" variant="contained" fullWidth
                    startIcon={<Add />}
                    onClick={() => openQuickCreate('producto', productoInput, 'resultante')}
                    sx={{
                      borderRadius: 2, fontWeight: 600, fontSize: 12,
                      bgcolor: '#10B981', '&:hover': { bgcolor: '#059669' },
                    }}
                  >
                    Crear "{productoInput || 'nuevo producto'}"
                  </Button>
                </Box>
              }
              renderOption={(props, option) => (
                <li {...props} key={option.id} style={{ padding: '10px 14px' }}>
                  <Box>
                    <Typography sx={{ fontSize: 14, fontWeight: 600, lineHeight: 1.3 }}>
                      {option.nombre}
                    </Typography>
                    <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
                      {['MP','PT','AF','INS'][option.grupo_item - 1] || 'PT'} · {option.unidad_medida} · Stock: {option.stock_actual ?? 0}
                    </Typography>
                  </Box>
                </li>
              )}
              renderInput={params => (
                <TextField
                  {...params}
                  label="Producto a Producir *"
                  placeholder="Escribe para buscar por nombre…"
                  fullWidth
                  InputProps={{
                    ...params.InputProps,
                    endAdornment: (
                      <>
                        {params.InputProps.endAdornment}
                        <Tooltip title="Crear nuevo producto resultante">
                          <IconButton
                            size="small"
                            onClick={() => openQuickCreate('producto', productoInput, 'resultante')}
                            sx={{ color: '#10B981', p: 0.5 }}
                          >
                            <Add fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </>
                    ),
                  }}
                />
              )}
              fullWidth
              sx={{ width: '100%' }}
              ListboxProps={{ style: { maxHeight: 280 } }}
            />

            <TextField
              fullWidth
              label="Nombre de la Receta *"
              value={formData.nombre}
              onChange={e => setFormData({ ...formData, nombre: e.target.value })}
              required
              sx={{ width: '100%' }}
            />
          </Stack>

          {/* Servicios */}
          <Box sx={{ mb: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
              <Typography sx={{ 
                fontWeight: 600, fontSize: 11, color: 'text.secondary', 
                textTransform: 'uppercase', letterSpacing: 0.6 
              }}>
                Servicios de Maquila
              </Typography>
              <Button 
                size="small" 
                startIcon={<Add />} 
                onClick={addServicio}
                sx={{ color: '#06B6D4', fontWeight: 600, fontSize: 12 }}
              >
                Añadir servicio
              </Button>
            </Box>
            {formData.servicios.length === 0 && (
              <Typography sx={{ fontSize: 13, color: 'text.secondary', fontStyle: 'italic' }}>
                Sin servicios asociados
              </Typography>
            )}
            <Stack direction="column" spacing={1} sx={{ width: '100%' }}>
              {formData.servicios.map((srv, idx) => (
                <Box 
                  key={idx} 
                  sx={{ 
                    display: 'flex', 
                    flexDirection: isMobile ? 'column' : 'row',
                    gap: 1.5, 
                    alignItems: isMobile ? 'stretch' : 'center', 
                    p: 1.5, 
                    borderRadius: 2, 
                    bgcolor: 'action.hover', 
                    border: '1px solid', 
                    borderColor: 'divider', 
                    width: '100%' 
                  }}
                >
                  <Autocomplete
                    options={servicios}
                    value={servicios.find(p => p.id === parseInt(srv.servicio_id)) || null}
                    onChange={(_, v) => handleServicioChange(idx, v ? v.id : '')}
                    getOptionLabel={opt => opt ? opt.nombre : ''}
                    filterOptions={(opts, state) => {
                      const q = (state.inputValue || '').toLowerCase().trim();
                      if (!q) return opts;
                      return opts.filter(o => 
                        o.nombre.toLowerCase().includes(q) ||
                        (o.codigo_barras && o.codigo_barras.toLowerCase().includes(q))
                      );
                    }}
                    renderOption={(props, option) => (
                      <li {...props} key={option.id} style={{ padding: '10px 14px' }}>
                        <Typography sx={{ fontSize: 14, fontWeight: 600 }}>{option.nombre}</Typography>
                      </li>
                    )}
                    renderInput={params => (
                      <TextField {...params} label="Servicio" size="small" placeholder="Escribe para buscar…" fullWidth />
                    )}
                    fullWidth
                    sx={{ flex: 1 }}
                    size="small"
                    noOptionsText="Sin resultados"
                    ListboxProps={{ style: { maxHeight: 220 } }}
                  />
                  <Tooltip title="Quitar">
                    <IconButton 
                      size="small" 
                      onClick={() => removeServicio(idx)}
                      sx={{ 
                        color: '#EF4444', 
                        bgcolor: '#FEF2F2', 
                        borderRadius: 1.5, 
                        flexShrink: 0,
                        alignSelf: isMobile ? 'flex-end' : 'center'
                      }}
                    >
                      <Delete fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>
              ))}
            </Stack>
          </Box>

          <Divider sx={{ mb: 3 }} />

          {/* Insumos */}
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
              <Typography sx={{ 
                fontWeight: 600, fontSize: 11, color: 'text.secondary', 
                textTransform: 'uppercase', letterSpacing: 0.6 
              }}>
                Ingredientes / Insumos (por unidad producida)
              </Typography>
              <Button 
                size="small" 
                startIcon={<Add />} 
                onClick={addItem}
                sx={{ color: accentColor, fontWeight: 600, fontSize: 12 }}
              >
                Añadir insumo
              </Button>
            </Box>
            <Stack direction="column" spacing={1.5} sx={{ width: '100%' }}>
              {formData.items.map((item, idx) => (
                <Box 
                  key={idx} 
                  sx={{ 
                    p: 1.5, 
                    borderRadius: 2, 
                    bgcolor: 'action.hover', 
                    border: '1px solid', 
                    borderColor: 'divider', 
                    width: '100%' 
                  }}
                >
                  <Autocomplete
                    options={insumos}
                    value={insumos.find(p => p.id === parseInt(item.insumo_id)) || null}
                    onChange={(_, v) => handleItemChange(idx, 'insumo_id', v ? v.id : '')}
                    inputValue={insumoInputs[idx] || ''}
                    onInputChange={(_, v) => handleInsumoInputChange(idx, v)}
                    getOptionLabel={opt => opt ? opt.nombre : ''}
                    filterOptions={(opts, state) => {
                      const q = (state.inputValue || '').toLowerCase().trim();
                      if (!q) return opts;
                      return opts.filter(o => 
                        o.nombre.toLowerCase().includes(q) ||
                        (o.codigo_barras && o.codigo_barras.toLowerCase().includes(q))
                      );
                    }}
                    noOptionsText={
                      <Box sx={{ py: 0.5 }}>
                        <Typography sx={{ fontSize: 13, color: 'text.secondary', mb: 1 }}>
                          No se encontró ningún insumo
                        </Typography>
                        <Button
                          size="small" variant="contained" fullWidth
                          startIcon={<Add />}
                          onClick={() => openQuickCreate('producto', insumoInputs[idx] || '', idx)}
                          sx={{
                            borderRadius: 2, fontWeight: 600, fontSize: 12,
                            bgcolor: '#10B981', '&:hover': { bgcolor: '#059669' },
                          }}
                        >
                          Crear "{insumoInputs[idx] || 'nuevo insumo'}"
                        </Button>
                      </Box>
                    }
                    renderOption={(props, option) => (
                      <li {...props} key={option.id} style={{ padding: '10px 14px' }}>
                        <Box>
                          <Typography sx={{ fontSize: 14, fontWeight: 600, lineHeight: 1.3 }}>
                            {option.nombre}
                          </Typography>
                          <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
                            Stock: {option.stock_actual ?? 0} {option.unidad_medida}
                          </Typography>
                        </Box>
                      </li>
                    )}
                    renderInput={params => (
                      <TextField
                        {...params}
                        label="Insumo (busca por nombre)"
                        size="small"
                        placeholder="Escribe para buscar…"
                        fullWidth
                        InputProps={{
                          ...params.InputProps,
                          endAdornment: (
                            <>
                              {params.InputProps.endAdornment}
                              <Tooltip title="Crear nuevo insumo">
                                <IconButton
                                  size="small"
                                  onClick={() => openQuickCreate('producto', insumoInputs[idx] || '', idx)}
                                  sx={{ color: '#10B981', p: 0.5 }}
                                >
                                  <Add fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </>
                          ),
                        }}
                      />
                    )}
                    fullWidth
                    sx={{ width: '100%', mb: 1 }}
                    size="small"
                    ListboxProps={{ style: { maxHeight: 240 } }}
                  />

                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                    <TextField
                      type="number"
                      label="Cantidad"
                      size="small"
                      value={item.cantidad}
                      onChange={e => handleItemChange(idx, 'cantidad', e.target.value)}
                      fullWidth
                      InputProps={{ inputProps: { min: 0, step: 'any' } }}
                    />
                    <Tooltip title="Quitar">
                      <span>
                        <IconButton 
                          size="small" 
                          onClick={() => removeItem(idx)} 
                          disabled={formData.items.length === 1}
                          sx={{ 
                            color: '#EF4444', 
                            bgcolor: '#FEF2F2', 
                            borderRadius: 1.5, 
                            flexShrink: 0, 
                            '&.Mui-disabled': { opacity: 0.3 } 
                          }}
                        >
                          <Delete fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </Box>
                </Box>
              ))}
            </Stack>
          </Box>
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
          <Button 
            onClick={handleClose} 
            variant="outlined"
            fullWidth={isMobile}
            sx={{ 
              borderRadius: 2, 
              fontWeight: 600, 
              borderColor: 'divider', 
              color: 'text.secondary' 
            }}
          >
            Cancelar
          </Button>
          <Button 
            onClick={handleSubmit} 
            variant="contained" 
            disabled={loading}
            fullWidth={isMobile}
            sx={{ 
              background: `linear-gradient(135deg, ${accentColor}, #a78bfa)`, 
              boxShadow: `0 4px 14px rgba(139,92,246,0.3)`, 
              borderRadius: 2, 
              fontWeight: 600 
            }}
          >
            {loading ? 'Guardando…' : editingReceta ? 'Actualizar Receta' : 'Guardar Receta'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Confirmación Delete */}
      <ConfirmationDialog
        open={showConfirmDialog}
        handleClose={() => setShowConfirmDialog(false)}
        handleConfirm={async () => {
          try {
            await deleteReceta(itemToDelete);
            toast.success('Receta eliminada exitosamente');
            loadData();
          } catch (err) {
            const msg = err.response?.data?.detail || 'Error al eliminar la receta';
            toast.error(msg, { autoClose: 7000 });
          } finally { 
            setShowConfirmDialog(false); 
          }
        }}
        title="Eliminar Receta"
        message="¿Estás seguro de que quieres eliminar esta receta? Esta acción no se puede deshacer."
      />

      {/* QuickCreate Modal */}
      <QuickCreateModal
        open={quickCreate.open}
        onClose={closeQuickCreate}
        type={quickCreate.type}
        initialName={quickCreate.initialName}
        onCreated={handleQuickCreated}
      />
    </Box>
  );
};

export default Recetas;