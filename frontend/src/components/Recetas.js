import React, { useState, useEffect, useMemo } from 'react';
import {
  Box, Typography, Button, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, IconButton, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, Grid, Divider, useTheme, useMediaQuery,
  Chip, Tooltip, InputAdornment, Autocomplete, Stack
} from '@mui/material';
import { Add, Delete, Search, Close, Science, InfoOutlined } from '@mui/icons-material';
import { fetchRecetas, createReceta, deleteReceta } from '../api';
import apiClient from '../api';
import { toast } from 'react-toastify';
import ConfirmationDialog from './ConfirmationDialog';
import QuickCreateModal from './QuickCreateModal';
import { formatCurrency } from '../utils/formatters';

const DEFAULT_ACCENT = '#8B5CF6';

// ─── Card mobile ──────────────────────────────────────────────────────────────
const RecetaCard = ({ receta, onDelete, accentColor }) => (
  <Paper sx={{ p: 2.5, mb: 2, borderRadius: 3, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
      <Box>
        <Typography sx={{ fontWeight: 700, fontSize: 15 }}>{receta.nombre}</Typography>
        <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
          → {receta.producto_resultante.nombre}
        </Typography>
      </Box>
      <Tooltip title="Eliminar receta">
        <IconButton size="small" onClick={() => onDelete(receta.id)}
          sx={{ color: '#EF4444', bgcolor: '#FEF2F2', borderRadius: 1.5 }}>
          <Delete fontSize="small" />
        </IconButton>
      </Tooltip>
    </Box>
    <Divider sx={{ my: 1.5 }} />
    <Box>
      <Typography sx={{ fontSize: 11, color: 'text.secondary', fontWeight: 600, mb: 0.5 }}>INSUMOS</Typography>
      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 1 }}>
        {receta.items.map(it => (
          <Chip key={it.insumo.id} label={`${it.insumo.nombre} × ${it.cantidad}`} size="small"
            sx={{ bgcolor: `${accentColor}12`, color: accentColor, fontWeight: 600, fontSize: 10, borderRadius: 1 }} />
        ))}
      </Box>
      {receta.servicios_maquila.length > 0 && (
        <>
          <Typography sx={{ fontSize: 11, color: 'text.secondary', fontWeight: 600, mb: 0.5 }}>SERVICIOS</Typography>
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
            {receta.servicios_maquila.map(s => (
              <Chip key={s.servicio.id} label={s.servicio.nombre} size="small"
                sx={{ bgcolor: 'rgba(6,182,212,0.1)', color: '#06B6D4', fontWeight: 600, fontSize: 10, borderRadius: 1 }} />
            ))}
          </Box>
        </>
      )}
    </Box>
  </Paper>
);

// ─── Componente principal ──────────────────────────────────────────────────────
const Recetas = ({ accentColor = DEFAULT_ACCENT }) => {
  const theme    = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [recetas, setRecetas]     = useState([]);
  const [productos, setProductos] = useState([]);
  const [insumos, setInsumos]     = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [open, setOpen]           = useState(false);
  const [loading, setLoading]     = useState(false);

  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [itemToDelete, setItemToDelete]           = useState(null);

  const [formData, setFormData] = useState({
    producto_id: '', nombre: '', descripcion: '',
    servicios: [],
    items: [{ insumo_id: '', cantidad: '' }],
  });
  
  const [productoInput, setProductoInput] = useState('');
  const [insumoInputs, setInsumoInputs] = useState({});
  const [quickCreate, setQuickCreate] = useState({ open: false, type: 'producto', initialName: '', targetIdx: null });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [recRes, prodRes] = await Promise.all([fetchRecetas(), apiClient.get('/productos/')]);
      setRecetas(recRes.data);
      const all = prodRes.data;
      setProductos(all);
      setInsumos(all.filter(p => !p.es_servicio && [1, 4].includes(p.grupo_item)));
    } catch { toast.error('Error cargando recetas'); }
  };

  const handleClose = () => {
    setOpen(false);
    setProductoInput('');
    setInsumoInputs({});
    setFormData({ producto_id: '', nombre: '', descripcion: '', servicios: [], items: [{ insumo_id: '', cantidad: '' }] });
  };

  const openQuickCreate = (type, initialName = '', targetIdx = null) =>
      setQuickCreate({ open: true, type, initialName, targetIdx });
  const closeQuickCreate = () => setQuickCreate(q => ({ ...q, open: false }));

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

  const addItem     = () => setFormData(f => ({ ...f, items: [...f.items, { insumo_id: '', cantidad: '' }] }));
  const addServicio = () => setFormData(f => ({ ...f, servicios: [...f.servicios, { servicio_id: '' }] }));
  const removeItem  = (i) => {
      setFormData(f => ({ ...f, items: f.items.filter((_, idx) => idx !== i) }));
      setInsumoInputs(prev => { const next = { ...prev }; delete next[i]; return next; });
  };
  const removeServicio = (i) => setFormData(f => ({ ...f, servicios: f.servicios.filter((_, idx) => idx !== i) }));

  const handleItemChange = (i, field, val) =>
    setFormData(f => { const items = [...f.items]; items[i][field] = val; return { ...f, items }; });
  
  const handleInsumoInputChange = (i, val) => setInsumoInputs(prev => ({ ...prev, [i]: val }));

  const handleServicioChange = (i, val) =>
    setFormData(f => { const servicios = [...f.servicios]; servicios[i].servicio_id = val; return { ...f, servicios }; });

  const handleSubmit = async () => {
    if (!formData.producto_id || formData.items.some(it => !it.insumo_id || !it.cantidad)) {
      toast.warning('Complete todos los campos requeridos'); return;
    }
    setLoading(true);
    try {
      await createReceta({
        ...formData,
        producto_id: parseInt(formData.producto_id),
        servicios: formData.servicios.filter(s => s.servicio_id !== '').map(s => ({ servicio_id: parseInt(s.servicio_id) })),
        items: formData.items.map(it => ({ insumo_id: parseInt(it.insumo_id), cantidad: parseFloat(it.cantidad) })),
      });
      toast.success('Receta creada exitosamente');
      loadData(); handleClose();
    } catch (err) {
      toast.error(err.response?.data?.detail?.[0]?.msg || 'Error al crear receta');
    } finally { setLoading(false); }
  };

  const filteredRecetas = useMemo(() =>
    recetas.filter(r =>
      r.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.producto_resultante.nombre.toLowerCase().includes(searchTerm.toLowerCase())
    ), [recetas, searchTerm]
  );

  const handleDeleteClick = (id) => { setItemToDelete(id); setShowConfirmDialog(true); };

  const productosNoServicio = productos.filter(p => !p.es_servicio);
  const servicios           = productos.filter(p => p.es_servicio);

  // ─── LÓGICA DE COSTEO DINÁMICO ───
  const calcularCostoEstimado = () => {
    return formData.items.reduce((total, item) => {
      const insumoInfo = insumos.find(i => i.id === parseInt(item.insumo_id));
      const costoUnitario = insumoInfo?.costo || 0;
      const cantidad = parseFloat(item.cantidad) || 0;
      return total + (costoUnitario * cantidad);
    }, 0);
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ width: 40, height: 40, borderRadius: 2, bgcolor: `${accentColor}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: accentColor }}>
            <Science />
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 700, fontSize: 20, lineHeight: 1.2 }}>Fórmulas y Recetas</Typography>
            <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>Ingeniería de producto y lista de materiales (BOM)</Typography>
          </Box>
        </Box>
        <Button variant="contained" startIcon={<Add />} onClick={() => setOpen(true)}
          sx={{ background: `linear-gradient(135deg, ${accentColor}, #a78bfa)`, boxShadow: `0 4px 14px rgba(139,92,246,0.3)`, borderRadius: 2, fontWeight: 600 }}>
          Nueva Receta
        </Button>
      </Box>

      <Paper sx={{ borderRadius: 3, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
        <Box sx={{ px: 2.5, py: 2, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <TextField
              placeholder="Buscar por receta o producto resultante…"
              value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              size="small" sx={{ minWidth: 300 }}
              InputProps={{ startAdornment: <InputAdornment position="start"><Search sx={{ color: 'text.secondary', fontSize: 20 }} /></InputAdornment> }}
            />
            <Typography sx={{ fontSize: 13, fontWeight: 600, color: 'text.secondary' }}>
                Total: {filteredRecetas.length} recetas
            </Typography>
        </Box>

        <TableContainer>
          <Table size="small">
            <TableHead sx={{ bgcolor: 'action.hover' }}>
              <TableRow>
                {['Nombre de la Receta', 'Produce (Resultante)', 'Materiales e Insumos', 'Costeo Actual', 'Acciones'].map(h => <TableCell key={h} sx={{ fontWeight: 600 }}>{h}</TableCell>)}
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredRecetas.length === 0 ? (
                <TableRow><TableCell colSpan={5} sx={{ textAlign: 'center', py: 6, color: 'text.secondary' }}>No hay recetas registradas</TableCell></TableRow>
              ) : filteredRecetas.map(r => {
                const costoReceta = r.items.reduce((tot, it) => tot + ((it.insumo.costo || 0) * it.cantidad), 0);
                return (
                  <TableRow key={r.id} hover>
                    <TableCell sx={{ fontWeight: 700 }}>{r.nombre}</TableCell>
                    <TableCell>
                      <Chip label={r.producto_resultante.nombre} size="small" sx={{ bgcolor: `${accentColor}12`, color: accentColor, fontWeight: 600, fontSize: 12, borderRadius: 1.5 }} />
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                        {r.items.map(it => (
                          <Chip key={it.insumo.id} label={`${it.insumo.nombre} × ${it.cantidad}`} size="small" sx={{ bgcolor: 'action.hover', border: '1px solid', borderColor: 'divider', fontSize: 11, borderRadius: 1 }} />
                        ))}
                      </Box>
                    </TableCell>
                    <TableCell sx={{ fontWeight: 600, color: 'text.secondary' }}>
                        {formatCurrency(costoReceta)}
                    </TableCell>
                    <TableCell>
                      <Tooltip title="Eliminar receta">
                        <IconButton size="small" onClick={() => handleDeleteClick(r.id)} sx={{ color: '#EF4444', '&:hover': { bgcolor: '#FEF2F2' } }}>
                          <Delete fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* ── Diálogo nueva receta (Vuelve al diseño original) ── */}
      <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: 3, overflow: 'hidden' } }}>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{ width: 32, height: 32, borderRadius: 1.5, bgcolor: `${accentColor}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: accentColor }}>
              <Science fontSize="small" />
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 700, fontSize: 17 }}>Nueva Receta de Producción</Typography>
              <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>Define la fórmula (BOM) del producto</Typography>
            </Box>
          </Box>
          <IconButton size="small" onClick={handleClose}><Close fontSize="small" /></IconButton>
        </DialogTitle>

        <DialogContent dividers>
          {/* Info general */}
          <Typography sx={{ fontWeight: 600, fontSize: 11, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.6, mb: 1.5 }}>
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
                return opts.filter(o => o.nombre.toLowerCase().includes(q));
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
                  placeholder="Busca por nombre…" 
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
              <Typography sx={{ fontWeight: 600, fontSize: 11, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.6 }}>
                Servicios de Maquila
              </Typography>
              <Button size="small" startIcon={<Add />} onClick={addServicio}
                sx={{ color: '#06B6D4', fontWeight: 600, fontSize: 12 }}>
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
                <Box key={idx} sx={{ display: 'flex', gap: 1.5, alignItems: 'center', p: 1.5, borderRadius: 2, bgcolor: 'action.hover', border: '1px solid', borderColor: 'divider', width: '100%' }}>
                  <Autocomplete
                    options={servicios}
                    value={servicios.find(p => p.id === parseInt(srv.servicio_id)) || null}
                    onChange={(_, v) => handleServicioChange(idx, v ? v.id : '')}
                    getOptionLabel={opt => opt ? opt.nombre : ''}
                    filterOptions={(opts, state) => {
                      const q = (state.inputValue || '').toLowerCase().trim();
                      if (!q) return opts;
                      return opts.filter(o => o.nombre.toLowerCase().includes(q));
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
                    sx={{ width: '100%' }}
                    size="small"
                    noOptionsText="Sin resultados"
                    ListboxProps={{ style: { maxHeight: 220 } }}
                  />
                  <Tooltip title="Quitar">
                    <IconButton size="small" onClick={() => removeServicio(idx)}
                      sx={{ color: '#EF4444', bgcolor: '#FEF2F2', borderRadius: 1.5, flexShrink: 0 }}>
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
              <Typography sx={{ fontWeight: 600, fontSize: 11, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.6 }}>
                Ingredientes / Insumos (por unidad producida)
              </Typography>
              <Button size="small" startIcon={<Add />} onClick={addItem}
                sx={{ color: accentColor, fontWeight: 600, fontSize: 12 }}>
                Añadir insumo
              </Button>
            </Box>
            <Stack direction="column" spacing={1.5} sx={{ width: '100%' }}>
              {formData.items.map((item, idx) => {
                  const insumoSeleccionado = insumos.find(p => p.id === parseInt(item.insumo_id));
                  const costoLinea = (insumoSeleccionado?.costo || 0) * (parseFloat(item.cantidad) || 0);

                  return (
                    <Box key={idx} sx={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 1.5, alignItems: isMobile ? 'stretch' : 'center', p: 1.5, borderRadius: 2, bgcolor: 'action.hover', border: '1px solid', borderColor: 'divider', width: '100%' }}>
                        <Autocomplete
                            options={insumos}
                            value={insumoSeleccionado || null}
                            onChange={(_, v) => handleItemChange(idx, 'insumo_id', v ? v.id : '')}
                            inputValue={insumoInputs[idx] || ''}
                            onInputChange={(_, v) => handleInsumoInputChange(idx, v)}
                            getOptionLabel={opt => opt ? opt.nombre : ''}
                            filterOptions={(opts, state) => {
                                const q = (state.inputValue || '').toLowerCase().trim();
                                if (!q) return opts;
                                return opts.filter(o => o.nombre.toLowerCase().includes(q));
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
                            sx={{ flex: 2, minWidth: isMobile ? '100%' : 200 }}
                            size="small"
                            ListboxProps={{ style: { maxHeight: 240 } }}
                        />

                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <TextField 
                              type="number" 
                              label="Cantidad req." 
                              size="small" 
                              value={item.cantidad} 
                              onChange={e => handleItemChange(idx, 'cantidad', e.target.value)} 
                              sx={{ flex: 1, minWidth: 100 }} 
                              InputProps={{ inputProps: { min: 0, step: 'any' } }}
                            />
                            
                            <Box sx={{ minWidth: 80, textAlign: 'right' }}>
                                <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>Costo Lín.</Typography>
                                <Typography sx={{ fontWeight: 700, color: '#374151', fontSize: 13 }}>{formatCurrency(costoLinea)}</Typography>
                            </Box>

                            <Tooltip title="Quitar">
                              <span>
                                <IconButton size="small" onClick={() => removeItem(idx)} disabled={formData.items.length === 1} 
                                  sx={{ color: '#EF4444', bgcolor: '#FEF2F2', borderRadius: 1.5, flexShrink: 0, '&.Mui-disabled': { opacity: 0.3 } }}>
                                  <Delete fontSize="small" />
                                </IconButton>
                              </span>
                            </Tooltip>
                        </Box>
                    </Box>
                  )
              })}
            </Stack>

            {/* COSTEO DINÁMICO */}
            <Box sx={{ mt: 3, pt: 2, borderTop: '1px dashed', borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'text.secondary' }}>
                    <InfoOutlined fontSize="small" />
                    <Typography sx={{ fontSize: 12 }}>El costo se calcula basado en el precio promedio (Kardex) actual.</Typography>
                </Box>
                <Box sx={{ textAlign: 'right' }}>
                    <Typography sx={{ fontSize: 12, fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase' }}>Costo Total Estimado</Typography>
                    <Typography sx={{ fontSize: 24, fontWeight: 800, color: accentColor }}>{formatCurrency(calcularCostoEstimado())}</Typography>
                </Box>
            </Box>
          </Box>
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
          <Button onClick={handleClose} variant="outlined" sx={{ borderRadius: 2, fontWeight: 600, borderColor: 'divider', color: 'text.secondary' }}>Cancelar</Button>
          <Button onClick={handleSubmit} variant="contained" disabled={loading} sx={{ background: `linear-gradient(135deg, ${accentColor}, #a78bfa)`, boxShadow: `0 4px 14px rgba(139,92,246,0.3)`, borderRadius: 2, fontWeight: 600, px: 4 }}>
            {loading ? 'Guardando…' : 'Guardar Fórmula'}
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmationDialog open={showConfirmDialog} handleClose={() => setShowConfirmDialog(false)} handleConfirm={async () => { try { await deleteReceta(itemToDelete); toast.success('Receta eliminada'); loadData(); } catch (err) { toast.error('Error al eliminar'); } finally { setShowConfirmDialog(false); } }} title="Eliminar Receta" message="Esta acción es irreversible." />
      <QuickCreateModal open={quickCreate.open} onClose={closeQuickCreate} type={quickCreate.type} initialName={quickCreate.initialName} onCreated={handleQuickCreated} />
    </Box>
  );
};

export default Recetas;