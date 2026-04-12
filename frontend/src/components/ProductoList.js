import React, { useState, useEffect, useMemo } from 'react';
import apiClient from '../api';
import { formatCurrency } from '../utils/formatters';
import { toast } from 'react-toastify';
import ConfirmationDialog from './ConfirmationDialog';
import {
  Table, TableBody, TableCell, TableContainer, TablePagination,
  TableHead, TableRow, IconButton, Typography, useMediaQuery, useTheme,
  Box, TextField, Chip, Button, Grid, Paper, Divider, Tooltip, InputAdornment
} from '@mui/material';
import {
  Edit, Delete, Search, Download, Inventory,
  Warning, CheckCircle, Category, Settings
} from '@mui/icons-material';

const DEFAULT_ACCENT = '#8B5CF6';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const GROUP_MAP = {
  1: { label: 'MP',  full: 'Materia Prima',       color: '#3B82F6' },
  2: { label: 'PT',  full: 'Prod. Terminado',      color: '#10B981' },
  3: { label: 'AF',  full: 'Activo Fijo',          color: '#F59E0B' },
  4: { label: 'INS', full: 'Insumo',               color: '#8B5CF6' },
};

const getGroup = (id) => GROUP_MAP[id] || { label: '—', full: 'Sin Grupo', color: '#94a3b8' };

// ─── KPI Card ─────────────────────────────────────────────────────────────────
const KpiCard = ({ label, value, icon, color }) => (
  <Box sx={{
    display: 'flex', alignItems: 'center', gap: 1.5,
    px: 2, py: 1.2, borderRadius: 2,
    bgcolor: `${color}0D`, border: `1px solid ${color}25`,
  }}>
    <Box sx={{ color, display: 'flex' }}>{icon}</Box>
    <Box>
      <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>{label}</Typography>
      <Typography sx={{ fontWeight: 700, fontSize: 16, color }}>{value}</Typography>
    </Box>
  </Box>
);

// ─── Card mobile ──────────────────────────────────────────────────────────────
const ProductoCard = ({ producto, onEditProducto, handleDelete, accentColor }) => {
  const stockActual = producto.stock_actual ?? 0;
  const stockMinimo = producto.stock_minimo ?? 0;
  const isService   = !!producto.es_servicio;
  const low         = !isService && stockActual < stockMinimo;
  const group       = getGroup(producto.grupo_item);

  return (
    <Paper sx={{ p: 2.5, mb: 2, borderRadius: 3, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
        <Box>
          <Typography sx={{ fontWeight: 700, fontSize: 15 }}>{producto.nombre}</Typography>
          <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>#{producto.id}</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <Chip label={group.label} size="small"
            sx={{ bgcolor: `${group.color}18`, color: group.color, fontWeight: 700, fontSize: 10, borderRadius: 1 }} />
          {isService
            ? <Chip label="Servicio" size="small" sx={{ bgcolor: 'rgba(100,116,139,0.1)', color: '#64748b', fontWeight: 600, fontSize: 10, borderRadius: 1 }} />
            : <Chip label={low ? '⚠ Stock bajo' : '✓ Stock OK'} size="small" color={low ? 'error' : 'success'}
                sx={{ fontWeight: 600, fontSize: 10, borderRadius: 1 }} />
          }
        </Box>
      </Box>

      <Divider sx={{ my: 1.5 }} />

      <Grid container spacing={1} sx={{ mb: 1.5 }}>
        {[
          { label: 'Precio',  val: formatCurrency(producto.precio) },
          { label: 'Costo',   val: formatCurrency(producto.costo) },
          { label: 'Unidad',  val: producto.unidad_medida },
          ...(!isService ? [{ label: `Stock ${stockActual}/${stockMinimo}`, val: '' }] : []),
        ].filter(i => i.label).map(({ label, val }) => (
          <Grid item xs={4} key={label}>
            <Box sx={{ p: 1, borderRadius: 1.5, bgcolor: 'action.hover', textAlign: 'center' }}>
              <Typography sx={{ fontSize: 10, color: 'text.secondary', mb: 0.2 }}>{label}</Typography>
              {val && <Typography sx={{ fontSize: 12, fontWeight: 600 }}>{val}</Typography>}
            </Box>
          </Grid>
        ))}
      </Grid>

      <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
        <Tooltip title="Editar">
          <IconButton size="small" onClick={() => onEditProducto(producto)}
            sx={{ color: accentColor, bgcolor: `${accentColor}12`, borderRadius: 1.5 }}>
            <Edit fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Eliminar">
          <IconButton size="small" onClick={() => handleDelete(producto.id)}
            sx={{ color: '#EF4444', bgcolor: '#FEF2F2', borderRadius: 1.5 }}>
            <Delete fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
    </Paper>
  );
};

// ─── Componente principal ──────────────────────────────────────────────────────
const ProductoList = ({ onEditProducto, onProductoDeleted, accentColor = DEFAULT_ACCENT }) => {
  const [productos, setProductos]         = useState([]);
  const [searchTerm, setSearchTerm]       = useState('');
  const [filterGroup, setFilterGroup]     = useState('all');
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [productoToDelete, setProductoToDelete]   = useState(null);
  const [page, setPage]               = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const theme    = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  useEffect(() => { fetchProductos(); }, []);

  const fetchProductos = () =>
    apiClient.get('/productos/').then(r => setProductos(r.data)).catch(console.error);

  const handleDelete = (id) => { setProductoToDelete(id); setShowConfirmDialog(true); };

  const confirmDelete = () => {
    apiClient.delete(`/productos/${productoToDelete}`)
      .then(() => { toast.success('Producto eliminado exitosamente'); fetchProductos(); if (onProductoDeleted) onProductoDeleted(); })
      .catch(() => toast.error('Error al eliminar el producto.'))
      .finally(() => { setShowConfirmDialog(false); setProductoToDelete(null); });
  };

  const handleExport = async (formato) => {
    try {
      const res = await apiClient.get(`/productos/export?formato=${formato}`, { responseType: 'blob' });
      const url  = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `productos.${formato}`);
      document.body.appendChild(link); link.click(); link.remove();
    } catch { toast.error('Error al exportar productos'); }
  };

  const handleTemplate = async () => {
    try {
      const res  = await apiClient.get('/productos/template', { responseType: 'blob' });
      const url  = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url; link.setAttribute('download', 'plantilla_productos.xlsx');
      document.body.appendChild(link); link.click(); link.remove();
    } catch { toast.error('Error al descargar plantilla'); }
  };

  // ── Filtrado ─────────────────────────────────────────────────────────────
  const filteredProductos = useMemo(() => {
    let list = productos;
    if (filterGroup !== 'all') {
      if (filterGroup === 'servicio') list = list.filter(p => p.es_servicio);
      else list = list.filter(p => !p.es_servicio && String(p.grupo_item) === filterGroup);
    }
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      list = list.filter(p => p.nombre.toLowerCase().includes(q));
    }
    return list;
  }, [productos, searchTerm, filterGroup]);

  const paginatedProductos = useMemo(() =>
    [...filteredProductos]
      .sort((a, b) => a.nombre.localeCompare(b.nombre))
      .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage),
    [filteredProductos, page, rowsPerPage]
  );

  // ── Stats ────────────────────────────────────────────────────────────────
  const stockBajo   = productos.filter(p => !p.es_servicio && (p.stock_actual ?? 0) < (p.stock_minimo ?? 0)).length;
  const servicios   = productos.filter(p => p.es_servicio).length;
  const productosN  = productos.filter(p => !p.es_servicio).length;

  // ── Filtros de grupo ─────────────────────────────────────────────────────
  const groupFilters = [
    { value: 'all',      label: 'Todos' },
    { value: '1',        label: 'MP' },
    { value: '2',        label: 'PT' },
    { value: '3',        label: 'AF' },
    { value: '4',        label: 'INS' },
    { value: 'servicio', label: 'Servicios' },
  ];

  return (
    <Box sx={{ width: '100%', maxWidth: '100%' }}>
      {/* ── Stats ── */}
      <Box sx={{ display: 'flex', gap: 1.5, mb: 2, flexWrap: 'wrap' }}>
        <KpiCard label="Productos" value={productosN} icon={<Inventory fontSize="small" />} color={accentColor} />
        <KpiCard label="Servicios" value={servicios} icon={<Settings fontSize="small" />} color="#06B6D4" />
        {stockBajo > 0 && (
          <KpiCard label="Stock bajo" value={stockBajo} icon={<Warning fontSize="small" />} color="#EF4444" />
        )}
      </Box>

      {/* ── Buscador ── */}
      <TextField
        fullWidth
        placeholder="Buscar producto o servicio…"
        value={searchTerm}
        onChange={e => { setSearchTerm(e.target.value); setPage(0); }}
        sx={{ mb: 1.5 }}
        InputProps={{
          startAdornment: <InputAdornment position="start"><Search sx={{ color: 'text.secondary', fontSize: 20 }} /></InputAdornment>,
        }}
      />

      {/* ── Botones exportar (en fila separada en mobile) ── */}
      <Box sx={{ display: 'flex', gap: 1, mb: 1.5, flexWrap: 'wrap' }}>
        <Tooltip title="Descargar plantilla Excel">
          <Button variant="outlined" size="small" startIcon={<Download />} onClick={handleTemplate}
            sx={{ borderRadius: 2, fontWeight: 600, fontSize: 12, borderColor: 'divider', color: 'text.secondary' }}>
            Plantilla
          </Button>
        </Tooltip>
        <Tooltip title="Exportar lista a Excel">
          <Button variant="outlined" size="small" startIcon={<Download />} onClick={() => handleExport('xlsx')}
            sx={{ borderRadius: 2, fontWeight: 600, fontSize: 12, borderColor: 'divider', color: 'text.secondary' }}>
            Exportar
          </Button>
        </Tooltip>
      </Box>

      {/* ── Filtros de grupo ── */}
      <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
        {groupFilters.map(f => (
          <Chip
            key={f.value}
            label={f.label}
            onClick={() => { setFilterGroup(f.value); setPage(0); }}
            size="small"
            sx={{
              fontWeight: 600, fontSize: 12, borderRadius: 1.5, cursor: 'pointer',
              ...(filterGroup === f.value
                ? { bgcolor: accentColor, color: '#fff' }
                : { bgcolor: 'action.hover', color: 'text.secondary' }),
            }}
          />
        ))}
      </Box>

      {/* ── Lista ── */}
      {isMobile ? (
        <Box>
          {paginatedProductos.length === 0
            ? <Box sx={{ textAlign: 'center', py: 6, color: 'text.secondary' }}>
                <Inventory sx={{ fontSize: 48, mb: 1, opacity: 0.3 }} />
                <Typography>No se encontraron productos</Typography>
              </Box>
            : paginatedProductos.map(p => (
                <ProductoCard key={p.id} producto={p} onEditProducto={onEditProducto}
                  handleDelete={handleDelete} accentColor={accentColor} />
              ))
          }
        </Box>
      ) : (
        <TableContainer sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                {['#', 'Nombre', 'Grupo', 'Unidad', 'Costo', 'Precio', 'Stock', 'Tipo', 'Acciones'].map(h => (
                  <TableCell key={h}>{h}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {paginatedProductos.length === 0
                ? <TableRow>
                    <TableCell colSpan={9} sx={{ textAlign: 'center', py: 6, color: 'text.secondary' }}>
                      No se encontraron productos
                    </TableCell>
                  </TableRow>
                : paginatedProductos.map(producto => {
                    const stockActual = producto.stock_actual ?? 0;
                    const stockMinimo = producto.stock_minimo ?? 0;
                    const isService   = !!producto.es_servicio;
                    const low         = !isService && stockActual < stockMinimo;
                    const group       = getGroup(producto.grupo_item);

                    return (
                      <TableRow key={producto.id} hover>
                        <TableCell sx={{ fontWeight: 600, color: 'text.secondary', fontSize: 12 }}>#{producto.id}</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>{producto.nombre}</TableCell>
                        <TableCell>
                          <Chip label={group.label} size="small"
                            sx={{ bgcolor: `${group.color}18`, color: group.color, fontWeight: 700, fontSize: 10, borderRadius: 1 }} />
                        </TableCell>
                        <TableCell sx={{ fontSize: 12 }}>{producto.unidad_medida}</TableCell>
                        <TableCell>{formatCurrency(producto.costo)}</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>{formatCurrency(producto.precio)}</TableCell>
                        <TableCell>
                          {isService ? (
                            <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>—</Typography>
                          ) : (
                            <Chip
                              label={`${stockActual} / ${stockMinimo}`}
                              size="small"
                              color={low ? 'error' : 'success'}
                              variant={low ? 'filled' : 'outlined'}
                              sx={{ fontWeight: 600, fontSize: 11, borderRadius: 1.5 }}
                            />
                          )}
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={isService ? 'Servicio' : 'Producto'}
                            size="small"
                            sx={{
                              fontSize: 10, fontWeight: 600, borderRadius: 1,
                              bgcolor: isService ? 'rgba(100,116,139,0.1)' : `${accentColor}12`,
                              color: isService ? '#64748b' : accentColor,
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', gap: 0.5 }}>
                            <Tooltip title="Editar">
                              <IconButton size="small" onClick={() => onEditProducto(producto)}
                                sx={{ color: accentColor, '&:hover': { bgcolor: `${accentColor}12` } }}>
                                <Edit fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Eliminar">
                              <IconButton size="small" onClick={() => handleDelete(producto.id)}
                                sx={{ color: '#EF4444', '&:hover': { bgcolor: '#FEF2F2' } }}>
                                <Delete fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        </TableCell>
                      </TableRow>
                    );
                  })
              }
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <TablePagination
        rowsPerPageOptions={[5, 10, 25]}
        component="div"
        count={filteredProductos.length}
        rowsPerPage={rowsPerPage}
        page={page}
        onPageChange={(_, p) => setPage(p)}
        onRowsPerPageChange={e => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
        labelRowsPerPage="Filas:"
        labelDisplayedRows={({ from, to, count }) => `${from}–${to} de ${count}`}
      />

      <ConfirmationDialog
        open={showConfirmDialog}
        handleClose={() => setShowConfirmDialog(false)}
        handleConfirm={confirmDelete}
        title="Eliminar producto"
        message="¿Estás seguro de que quieres eliminar este producto/servicio? Esta acción no se puede deshacer."
      />
    </Box>
  );
};

export default ProductoList;
