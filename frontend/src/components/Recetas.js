import React, { useState, useEffect, useMemo } from 'react';
import {
  Box, Typography, Button, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, IconButton, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, MenuItem, Grid, Divider, useTheme, useMediaQuery,
  Chip, Tooltip, InputAdornment, Autocomplete
} from '@mui/material';
import { Add, Delete, ReceiptLong, Search, Close, Science } from '@mui/icons-material';
import { fetchRecetas, createReceta, deleteReceta } from '../api';
import apiClient from '../api';
import { toast } from 'react-toastify';
import ConfirmationDialog from './ConfirmationDialog';

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
    setFormData({ producto_id: '', nombre: '', descripcion: '', servicios: [], items: [{ insumo_id: '', cantidad: '' }] });
  };

  const addItem     = () => setFormData(f => ({ ...f, items: [...f.items, { insumo_id: '', cantidad: '' }] }));
  const addServicio = () => setFormData(f => ({ ...f, servicios: [...f.servicios, { servicio_id: '' }] }));
  const removeItem  = (i) => setFormData(f => ({ ...f, items: f.items.filter((_, idx) => idx !== i) }));
  const removeServicio = (i) => setFormData(f => ({ ...f, servicios: f.servicios.filter((_, idx) => idx !== i) }));

  const handleItemChange = (i, field, val) =>
    setFormData(f => { const items = [...f.items]; items[i][field] = val; return { ...f, items }; });
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

  // ── Selects helpers ──────────────────────────────────────────────────────
  const productosNoServicio = productos.filter(p => !p.es_servicio);
  const servicios           = productos.filter(p => p.es_servicio);

  return (
    <Box>
      {/* ── Toolbar ── */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2.5, gap: 2, flexWrap: 'wrap' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ px: 2, py: 1, borderRadius: 2, bgcolor: `${accentColor}0D`, border: `1px solid ${accentColor}25` }}>
            <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>Total recetas</Typography>
            <Typography sx={{ fontWeight: 700, fontSize: 18, color: accentColor }}>{recetas.length}</Typography>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flex: 1, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <TextField
            placeholder="Buscar receta o producto…"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            sx={{ minWidth: 220, flex: 1 }}
            InputProps={{
              startAdornment: <InputAdornment position="start"><Search sx={{ color: 'text.secondary', fontSize: 20 }} /></InputAdornment>,
            }}
          />
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => setOpen(true)}
            sx={{ background: `linear-gradient(135deg, ${accentColor}, #a78bfa)`, boxShadow: `0 4px 14px rgba(139,92,246,0.3)`, borderRadius: 2, fontWeight: 600, whiteSpace: 'nowrap' }}
          >
            Nueva Receta
          </Button>
        </Box>
      </Box>

      {/* ── Lista ── */}
      {isMobile ? (
        <Box>
          {filteredRecetas.length === 0
            ? <Box sx={{ textAlign: 'center', py: 6, color: 'text.secondary' }}>
                <Science sx={{ fontSize: 48, mb: 1, opacity: 0.3 }} />
                <Typography>No hay recetas registradas</Typography>
              </Box>
            : filteredRecetas.map(r => (
                <RecetaCard key={r.id} receta={r} onDelete={handleDeleteClick} accentColor={accentColor} />
              ))
          }
        </Box>
      ) : (
        <TableContainer sx={{ borderRadius: 2, border: "1px solid", borderColor: "divider", overflowX: "auto" }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                {['Nombre', 'Producto Resultante', 'Insumos', 'Servicios Maquila', 'Acciones'].map(h => (
                  <TableCell key={h}>{h}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredRecetas.length === 0
                ? <TableRow>
                    <TableCell colSpan={5} sx={{ textAlign: 'center', py: 6, color: 'text.secondary' }}>
                      No hay recetas registradas
                    </TableCell>
                  </TableRow>
                : filteredRecetas.map(r => (
                    <TableRow key={r.id} hover>
                      <TableCell sx={{ fontWeight: 600 }}>{r.nombre}</TableCell>
                      <TableCell>
                        <Chip label={r.producto_resultante.nombre} size="small"
                          sx={{ bgcolor: `${accentColor}12`, color: accentColor, fontWeight: 600, fontSize: 11, borderRadius: 1.5 }} />
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                          {r.items.map(it => (
                            <Chip key={it.insumo.id} label={`${it.insumo.nombre} ×${it.cantidad}`} size="small"
                              sx={{ bgcolor: 'action.hover', fontSize: 10, borderRadius: 1 }} />
                          ))}
                        </Box>
                      </TableCell>
                      <TableCell>
                        {r.servicios_maquila.length > 0
                          ? <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                              {r.servicios_maquila.map(s => (
                                <Chip key={s.servicio.id} label={s.servicio.nombre} size="small"
                                  sx={{ bgcolor: 'rgba(6,182,212,0.1)', color: '#06B6D4', fontSize: 10, borderRadius: 1 }} />
                              ))}
                            </Box>
                          : <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>—</Typography>
                        }
                      </TableCell>
                      <TableCell>
                        <Tooltip title="Eliminar receta">
                          <IconButton size="small" onClick={() => handleDeleteClick(r.id)}
                            sx={{ color: '#EF4444', '&:hover': { bgcolor: '#FEF2F2' } }}>
                            <Delete fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))
              }
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* ── Diálogo nueva receta ── */}
      <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
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
          {/* Info básica */}
          <Typography sx={{ fontWeight: 600, fontSize: 11, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.6, mb: 1.5 }}>
            Información general
          </Typography>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                select fullWidth label="Producto a Producir"
                value={formData.producto_id}
                onChange={e => setFormData({ ...formData, producto_id: e.target.value })}
                required
              >
                {productosNoServicio.map(p => <MenuItem key={p.id} value={p.id}>{p.nombre}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth label="Nombre de la Receta"
                value={formData.nombre}
                onChange={e => setFormData({ ...formData, nombre: e.target.value })}
                required
              />
            </Grid>
          </Grid>

          {/* Servicios de maquila */}
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
            {formData.servicios.map((srv, idx) => (
              <Box key={idx} sx={{ display: 'flex', gap: 1.5, mb: 1, alignItems: 'center', p: 1.5, borderRadius: 2, bgcolor: 'action.hover', border: '1px solid', borderColor: 'divider' }}>
                <TextField
                  select fullWidth label="Servicio" size="small"
                  value={srv.servicio_id}
                  onChange={e => handleServicioChange(idx, e.target.value)}
                >
                  {servicios.map(p => <MenuItem key={p.id} value={p.id}>{p.nombre}</MenuItem>)}
                </TextField>
                <Tooltip title="Quitar">
                  <IconButton size="small" onClick={() => removeServicio(idx)}
                    sx={{ color: '#EF4444', bgcolor: '#FEF2F2', borderRadius: 1.5, flexShrink: 0 }}>
                    <Delete fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
            ))}
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
            {formData.items.map((item, idx) => (
              <Box key={idx} sx={{ display: 'flex', gap: 1.5, mb: 1, alignItems: 'center', p: 1.5, borderRadius: 2, bgcolor: 'action.hover', border: '1px solid', borderColor: 'divider' }}>
                <TextField
                  select fullWidth label="Insumo" size="small"
                  value={item.insumo_id}
                  onChange={e => handleItemChange(idx, 'insumo_id', e.target.value)}
                  sx={{ flex: 2 }}
                >
                  {insumos.map(p => <MenuItem key={p.id} value={p.id}>{p.nombre} ({p.unidad_medida})</MenuItem>)}
                </TextField>
                <TextField
                  type="number" label="Cantidad" size="small"
                  value={item.cantidad}
                  onChange={e => handleItemChange(idx, 'cantidad', e.target.value)}
                  sx={{ flex: 1, minWidth: 100 }}
                  InputProps={{ inputProps: { min: 0, step: 'any' } }}
                />
                <Tooltip title="Quitar">
                  <span>
                    <IconButton size="small" onClick={() => removeItem(idx)} disabled={formData.items.length === 1}
                      sx={{ color: '#EF4444', bgcolor: '#FEF2F2', borderRadius: 1.5, flexShrink: 0, '&.Mui-disabled': { opacity: 0.3 } }}>
                      <Delete fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
              </Box>
            ))}
          </Box>
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
          <Button onClick={handleClose} variant="outlined"
            sx={{ borderRadius: 2, fontWeight: 600, borderColor: 'divider', color: 'text.secondary' }}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} variant="contained" disabled={loading}
            sx={{ background: `linear-gradient(135deg, ${accentColor}, #a78bfa)`, boxShadow: `0 4px 14px rgba(139,92,246,0.3)`, borderRadius: 2, fontWeight: 600 }}>
            {loading ? 'Guardando…' : 'Guardar Receta'}
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmationDialog
        open={showConfirmDialog}
        handleClose={() => setShowConfirmDialog(false)}
        handleConfirm={async () => {
          try {
            await deleteReceta(itemToDelete);
            toast.success('Receta eliminada exitosamente');
            loadData();
          } catch { toast.error('Error al eliminar la receta'); }
          finally { setShowConfirmDialog(false); }
        }}
        title="Eliminar Receta"
        message="¿Estás seguro de que quieres eliminar esta receta? Esta acción no se puede deshacer."
      />
    </Box>
  );
};

export default Recetas;
