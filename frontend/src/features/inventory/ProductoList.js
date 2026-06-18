import React, { useState, useEffect, useMemo, Fragment } from 'react';
import apiClient from '../../api';
import { formatCurrency } from '../../utils/formatters';
import { toast } from 'react-toastify';
import ConfirmationDialog from '../../components/common/ConfirmationDialog';
import {
  Table, TableBody, TableCell, TableContainer, TablePagination,
  TableHead, TableRow, TableSortLabel, IconButton, Typography,
  useMediaQuery, useTheme,
  Box, TextField, Chip, Button, Grid, Paper, Divider, Tooltip, InputAdornment,
  Collapse, CircularProgress, Alert, Checkbox, Dialog, DialogTitle,
  DialogContent, DialogActions, Select, MenuItem, FormControl, InputLabel,
  LinearProgress,
} from '@mui/material';
import {
  Edit, Delete, Search, Download, Inventory,
  Warning, CheckCircle, Category, Settings, ContentCopy, SwapVert,
  FilterList, Close,
} from '@mui/icons-material';

const DEFAULT_ACCENT = '#8B5CF6';

// ─── KPI Card ─────────────────────────────────────────────────────────────────
const KpiCard = ({ label, value, icon, color, sub }) => (
  <Paper sx={{
    p: 2, borderRadius: 3, display: 'flex', alignItems: 'center', gap: 1.5,
    boxShadow: '0 2px 8px rgba(0,0,0,0.06)', height: '100%',
  }}>
    <Box sx={{
      width: 42, height: 42, borderRadius: 2, flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      bgcolor: `${color}18`, color,
    }}>
      {icon}
    </Box>
    <Box sx={{ minWidth: 0 }}>
      <Typography sx={{ fontSize: 11, color: 'text.secondary', fontWeight: 500 }}>{label}</Typography>
      <Typography sx={{ fontSize: 17, fontWeight: 800, lineHeight: 1.2 }}>{value}</Typography>
      {sub && <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>{sub}</Typography>}
    </Box>
  </Paper>
);

// ─── Card mobile ──────────────────────────────────────────────────────────────
const ProductoCard = ({ producto, grupos, onEditProducto, handleDelete, accentColor }) => {
  const [showVariantes, setShowVariantes] = useState(false);
  const stockActual = producto.stock_actual ?? 0;
  const stockMinimo = producto.stock_minimo ?? 0;
  const isService   = !!producto.es_servicio;
  const isLow       = !isService && stockActual <= stockMinimo;
  const isCritical  = !isService && stockActual <= 0;
  const group       = grupos.find(g => g.id === producto.grupo_item) || { codigo: '—', color: '#94a3b8' };
  const varCount    = producto.variantes?.length || 0;

  return (
    <Paper sx={{ p: 2.5, mb: 2, borderRadius: 3, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
        <Box sx={{ minWidth: 0, flex: 1, mr: 1 }}>
          <Typography sx={{ fontWeight: 700, fontSize: 15, lineHeight: 1.2 }}>{producto.nombre}</Typography>
          {producto.descripcion && (
            <Typography sx={{ fontSize: 11, color: 'text.secondary', mt: 0.2, noWrap: false }}>
              {producto.descripcion}
            </Typography>
          )}
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mt: 0.5, flexWrap: 'wrap' }}>
            {producto.sku && (
              <Typography sx={{ fontSize: 11, fontFamily: 'monospace', fontWeight: 700, color: 'text.primary', bgcolor: 'action.hover', px: 0.8, py: 0.2, borderRadius: 1 }}>
                {producto.sku}
              </Typography>
            )}
            {producto.codigo_barras && (
              <Typography sx={{ fontSize: 10, color: 'text.disabled', fontFamily: 'monospace' }}>
                {producto.codigo_barras}
              </Typography>
            )}
          </Box>
        </Box>
        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', justifyContent: 'flex-end', flexShrink: 0 }}>
          <Chip label={group.codigo} size="small"
            sx={{ bgcolor: `${group.color}18`, color: group.color, fontWeight: 700, fontSize: 10, borderRadius: 1 }} />
          {producto.maneja_lotes && (
            <Chip label="LOTES" size="small" sx={{ bgcolor: '#F59E0B18', color: '#F59E0B', fontWeight: 800, fontSize: 9, borderRadius: 1, height: 20 }} />
          )}
          {isService
            ? <Chip label="Servicio" size="small" sx={{ bgcolor: 'rgba(100,116,139,0.1)', color: '#64748b', fontWeight: 600, fontSize: 10, borderRadius: 1 }} />
            : <Chip
                label={isCritical ? '⚠ Sin Stock' : (isLow ? '⚠ Bajo' : '✓ OK')}
                size="small"
                color={isCritical ? 'error' : (isLow ? 'warning' : 'success')}
                sx={{ fontWeight: 600, fontSize: 10, borderRadius: 1 }}
              />
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

      <Box sx={{ display: 'flex', gap: 1, justifyContent: 'space-between', alignItems: 'center' }}>
        {/* Variants chip */}
        {producto.tiene_variantes && varCount > 0 ? (
          <Chip
            label={`${varCount} variante${varCount > 1 ? 's' : ''}`}
            size="small"
            onClick={() => setShowVariantes(v => !v)}
            sx={{ fontSize: 10, fontWeight: 600, cursor: 'pointer',
              bgcolor: `${accentColor}15`, color: accentColor,
              border: `1px solid ${accentColor}30`,
            }}
          />
        ) : <Box />}
        <Box sx={{ display: 'flex', gap: 1 }}>
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
      </Box>

      {/* Variants expand */}
      <Collapse in={showVariantes}>
        <Divider sx={{ my: 1.5 }} />
        <Typography sx={{ fontSize: 11, fontWeight: 700, color: 'text.secondary', mb: 1, textTransform: 'uppercase', letterSpacing: 0.8 }}>
          Variantes
        </Typography>
        {(producto.variantes || []).map(v => (
          <Box key={v.id} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            py: 0.6, px: 1, mb: 0.5, borderRadius: 1.5, bgcolor: 'action.hover' }}>
            <Box>
              <Typography sx={{ fontSize: 12, fontWeight: 600 }}>{v.nombre}</Typography>
              <Typography sx={{ fontSize: 10, fontFamily: 'monospace', color: 'text.secondary' }}>{v.sku}</Typography>
            </Box>
            <Box sx={{ textAlign: 'right' }}>
              <Typography sx={{ fontSize: 12, fontWeight: 700 }}>{formatCurrency(v.precio ?? producto.precio)}</Typography>
              <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>Stock: {v.stock_actual ?? 0}</Typography>
            </Box>
          </Box>
        ))}
      </Collapse>
    </Paper>
  );
};

// ─── Componente principal ──────────────────────────────────────────────────────
const ProductoList = ({ onEditProducto, onProductoDeleted, accentColor = DEFAULT_ACCENT }) => {
  const [productos, setProductos]         = useState([]);
  const [grupos, setGrupos]               = useState([]);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState(null);
  const [searchTerm, setSearchTerm]       = useState('');
  const [filterGroup, setFilterGroup]     = useState('all');
  const [filterStock, setFilterStock]     = useState('all');
  const [sortBy, setSortBy]               = useState('nombre');
  const [sortDir, setSortDir]             = useState('asc');
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [productoToDelete, setProductoToDelete]   = useState(null);
  const [page, setPage]               = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [expandedProducts, setExpandedProducts] = useState(new Set());
  // Bulk selection
  const [selected, setSelected]           = useState(new Set());
  const [bulkPriceDialog, setBulkPriceDialog] = useState(false);
  const [bulkPct, setBulkPct]             = useState('');

  const theme    = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const getGroup = (id) => grupos.find(g => g.id === id) || { codigo: '—', nombre: 'Sin Grupo', color: '#94a3b8' };

  useEffect(() => {
    fetchProductos();
    apiClient.get('/grupos-producto/').then(r => setGrupos(r.data || [])).catch(() => {});
  }, []);

  const fetchProductos = () => {
    setLoading(true);
    setError(null);
    apiClient.get('/productos/')
      .then(r => { setProductos(r.data); setSelected(new Set()); })
      .catch(() => setError('No se pudieron cargar los productos. Intenta recargar la página.'))
      .finally(() => setLoading(false));
  };

  const handleDelete = (id) => { setProductoToDelete(id); setShowConfirmDialog(true); };

  const handleDuplicate = async (id) => {
    try {
      await apiClient.post(`/productos/${id}/duplicate`);
      toast.success('Producto duplicado');
      fetchProductos();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al duplicar');
    }
  };

  const handleBulkPriceApply = async () => {
    const pct = parseFloat(bulkPct);
    if (isNaN(pct)) return;
    const ids = Array.from(selected);
    let ok = 0;
    for (const id of ids) {
      const prod = productos.find(p => p.id === id);
      if (!prod) continue;
      const newPrecio = Math.round(prod.precio * (1 + pct / 100));
      try {
        await apiClient.put(`/productos/${id}`, { ...prod, precio: newPrecio });
        ok++;
      } catch {}
    }
    toast.success(`${ok} productos actualizados`);
    setBulkPriceDialog(false);
    setBulkPct('');
    fetchProductos();
  };

  const confirmDelete = () => {
    apiClient.delete(`/productos/${productoToDelete}`)
      .then(() => { toast.success('Producto eliminado exitosamente'); fetchProductos(); if (onProductoDeleted) onProductoDeleted(); })
      .catch(err => toast.error(err.response?.data?.detail || 'Error al eliminar el producto.', { autoClose: 7000 }))
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

  // ── Sort handler ──────────────────────────────────────────────────────────
  const handleSort = (column) => {
    if (column === sortBy) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortDir('asc');
    }
    setPage(0);
  };

  // ── Filtrado ─────────────────────────────────────────────────────────────
  const filteredProductos = useMemo(() => {
    let list = productos;

    // Group filter
    if (filterGroup !== 'all') {
      if (filterGroup === 'servicio') list = list.filter(p => p.es_servicio);
      else list = list.filter(p => !p.es_servicio && String(p.grupo_item) === filterGroup);
    }

    // Stock filter (applied after group filter) — consistent: bajo means stock_actual < stock_minimo
    if (filterStock !== 'all') {
      if (filterStock === 'ok') {
        list = list.filter(p => !p.es_servicio && (p.stock_actual ?? 0) >= (p.stock_minimo ?? 0));
      } else if (filterStock === 'bajo') {
        list = list.filter(p => !p.es_servicio && (p.stock_actual ?? 0) < (p.stock_minimo ?? 0) && (p.stock_actual ?? 0) > 0);
      } else if (filterStock === 'sinStock') {
        list = list.filter(p => !p.es_servicio && (p.stock_actual ?? 0) <= 0);
      }
    }

    // Search filter
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      list = list.filter(p =>
        p.nombre.toLowerCase().includes(q) ||
        (p.sku && p.sku.toLowerCase().includes(q)) ||
        (p.codigo_barras && p.codigo_barras.toLowerCase().includes(q)) ||
        (p.descripcion && p.descripcion.toLowerCase().includes(q))
      );
    }

    return list;
  }, [productos, searchTerm, filterGroup, filterStock]);

  // ── Sorted + paginated ────────────────────────────────────────────────────
  const paginatedProductos = useMemo(() => {
    const sorted = [...filteredProductos].sort((a, b) => {
      let aVal, bVal;
      if (sortBy === 'nombre') {
        aVal = a.nombre || '';
        bVal = b.nombre || '';
        return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      } else if (sortBy === 'precio') {
        aVal = a.precio ?? 0;
        bVal = b.precio ?? 0;
      } else if (sortBy === 'costo') {
        aVal = a.costo ?? 0;
        bVal = b.costo ?? 0;
      } else if (sortBy === 'stock') {
        aVal = a.stock_actual ?? 0;
        bVal = b.stock_actual ?? 0;
      } else {
        aVal = a.nombre || '';
        bVal = b.nombre || '';
        return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
    });
    return sorted.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
  }, [filteredProductos, page, rowsPerPage, sortBy, sortDir]);

  // ── Stats ────────────────────────────────────────────────────────────────
  const stockBajo        = productos.filter(p => !p.es_servicio && (p.stock_actual ?? 0) < (p.stock_minimo ?? 0)).length;
  const servicios        = productos.filter(p => p.es_servicio).length;
  const productosN       = productos.filter(p => !p.es_servicio).length;
  const valorInventario  = productos
    .filter(p => !p.es_servicio)
    .reduce((sum, p) => sum + (p.stock_actual ?? 0) * (p.costo ?? 0), 0);

  // ── Filtros de grupo dinámicos con conteos ────────────────────────────────
  const groupFilters = [
    { value: 'all',      label: `Todos (${productos.length})` },
    ...grupos.map(g => ({
      value: String(g.id), label: g.nombre, color: g.color,
      count: productos.filter(p => !p.es_servicio && p.grupo_item === g.id).length,
    })),
    { value: 'servicio', label: `Servicios (${productos.filter(p => p.es_servicio).length})` },
  ];

  const stockFilters = [
    { value: 'all',      label: `Todos (${productos.filter(p => !p.es_servicio).length})` },
    { value: 'ok',       label: `✓ OK (${productos.filter(p => !p.es_servicio && (p.stock_actual ?? 0) >= (p.stock_minimo ?? 0)).length})` },
    { value: 'bajo',     label: `⚠ Bajo (${productos.filter(p => !p.es_servicio && (p.stock_actual ?? 0) < (p.stock_minimo ?? 0) && (p.stock_actual ?? 0) > 0).length})` },
    { value: 'sinStock', label: `⛔ Sin stock (${productos.filter(p => !p.es_servicio && (p.stock_actual ?? 0) <= 0).length})` },
  ];

  // Mobile sort options
  const mobileSortOptions = [
    { value: 'nombre',  label: 'Nombre' },
    { value: 'precio',  label: 'Precio' },
    { value: 'costo',   label: 'Costo' },
    { value: 'stock',   label: 'Stock' },
  ];

  // ── Margen helper ─────────────────────────────────────────────────────────
  const getMargen = (precio, costo) => {
    const p = precio ?? 0;
    const c = costo ?? 0;
    return p > 0 ? ((p - c) / p) * 100 : 0;
  };

  const margenColor = (m) => {
    if (m >= 30) return '#10B981';
    if (m >= 10) return '#F59E0B';
    return '#EF4444';
  };

  // ── Bulk selection helpers ─────────────────────────────────────────────────
  const allVisibleIds = paginatedProductos.map(p => p.id);
  const allSelected   = allVisibleIds.length > 0 && allVisibleIds.every(id => selected.has(id));
  const someSelected  = allVisibleIds.some(id => selected.has(id)) && !allSelected;
  const toggleSelect  = (id) => setSelected(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  const toggleAll     = () => {
    if (allSelected) setSelected(prev => { const s = new Set(prev); allVisibleIds.forEach(id => s.delete(id)); return s; });
    else setSelected(prev => { const s = new Set(prev); allVisibleIds.forEach(id => s.add(id)); return s; });
  };

  return (
    <Box sx={{ width: '100%', maxWidth: '100%' }}>
      {/* ── Loading / Error ── */}
      {loading && <LinearProgress sx={{ mb: 1, borderRadius: 1 }} />}
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      {/* ── KPI Cards ── */}
      <Grid container spacing={1.5} sx={{ mb: 2 }}>
        <Grid item xs={6} sm={3}>
          <KpiCard
            label="Productos"
            value={productosN}
            icon={<Inventory fontSize="small" />}
            color={accentColor}
          />
        </Grid>
        <Grid item xs={6} sm={3}>
          <KpiCard
            label="Servicios"
            value={servicios}
            icon={<Settings fontSize="small" />}
            color="#06B6D4"
          />
        </Grid>
        <Grid item xs={6} sm={3}>
          <KpiCard
            label="Stock bajo"
            value={stockBajo}
            icon={<Warning fontSize="small" />}
            color="#EF4444"
          />
        </Grid>
        <Grid item xs={6} sm={3}>
          <KpiCard
            label="Valor inventario"
            value={formatCurrency(valorInventario)}
            icon={<CheckCircle fontSize="small" />}
            color="#10B981"
          />
        </Grid>
      </Grid>

      {/* ── Buscador ── */}
      <TextField
        fullWidth
        placeholder="Buscar por nombre, código de barras o descripción…"
        value={searchTerm}
        onChange={e => { setSearchTerm(e.target.value); setPage(0); }}
        sx={{ mb: 1.5 }}
        InputProps={{
          startAdornment: <InputAdornment position="start"><Search sx={{ color: 'text.secondary', fontSize: 20 }} /></InputAdornment>,
        }}
      />

      {/* ── Mobile sort ── */}
      {isMobile && (
        <Box sx={{ display: 'flex', gap: 1, mb: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
          <SwapVert sx={{ fontSize: 16, color: 'text.secondary' }} />
          {mobileSortOptions.map(opt => (
            <Chip
              key={opt.value}
              label={opt.label + (sortBy === opt.value ? (sortDir === 'asc' ? ' ↑' : ' ↓') : '')}
              size="small"
              onClick={() => handleSort(opt.value)}
              sx={{
                fontWeight: 600, fontSize: 11, borderRadius: 1.5, cursor: 'pointer',
                ...(sortBy === opt.value
                  ? { bgcolor: accentColor, color: '#fff' }
                  : { bgcolor: 'action.hover', color: 'text.secondary' }),
              }}
            />
          ))}
        </Box>
      )}

      {/* ── Botones exportar ── */}
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
      <Box sx={{ display: 'flex', gap: 1, mb: 1, flexWrap: 'wrap' }}>
        {groupFilters.map(f => (
          <Chip
            key={f.value}
            label={
              f.color
                ? <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: filterGroup === f.value ? '#fff' : f.color, display: 'inline-block' }} />
                    {f.label}
                  </Box>
                : f.label
            }
            onClick={() => { setFilterGroup(f.value); setFilterStock('all'); setPage(0); }}
            size="small"
            sx={{
              fontWeight: 600, fontSize: 12, borderRadius: 1.5, cursor: 'pointer',
              ...(filterGroup === f.value
                ? { bgcolor: f.color || accentColor, color: '#fff' }
                : { bgcolor: 'action.hover', color: 'text.secondary' }),
            }}
          />
        ))}
      </Box>

      {/* ── Filtros de stock (ocultos cuando se filtra por servicios) ── */}
      {filterGroup !== 'servicio' && (
        <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
          {stockFilters.map(f => (
            <Chip
              key={f.value}
              label={f.label}
              onClick={() => { setFilterStock(f.value); setPage(0); }}
              size="small"
              sx={{
                fontWeight: 600, fontSize: 12, borderRadius: 1.5, cursor: 'pointer',
                ...(filterStock === f.value
                  ? { bgcolor: accentColor, color: '#fff' }
                  : { bgcolor: 'action.hover', color: 'text.secondary' }),
              }}
            />
          ))}
        </Box>
      )}

      {/* ── Bulk action bar ── */}
      {selected.size > 0 && (
        <Box sx={{
          display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5, px: 2, py: 1.5,
          bgcolor: `${accentColor}12`, borderRadius: 2, border: `1px solid ${accentColor}30`, flexWrap: 'wrap',
        }}>
          <Typography sx={{ fontWeight: 700, fontSize: 13, color: accentColor }}>
            {selected.size} seleccionado{selected.size > 1 ? 's' : ''}
          </Typography>
          <Button size="small" variant="outlined"
            sx={{ borderRadius: 2, fontSize: 12, borderColor: accentColor, color: accentColor }}
            onClick={() => setBulkPriceDialog(true)}>
            Ajustar precios %
          </Button>
          <Button size="small" variant="outlined" color="error"
            sx={{ borderRadius: 2, fontSize: 12 }}
            onClick={() => setSelected(new Set())}>
            <Close fontSize="small" sx={{ mr: 0.5 }} /> Cancelar
          </Button>
        </Box>
      )}

      {/* ── Lista ── */}
      {isMobile ? (
        <Box>
          {paginatedProductos.length === 0
            ? <Box sx={{ textAlign: 'center', py: 6, color: 'text.secondary' }}>
                <Inventory sx={{ fontSize: 48, mb: 1, opacity: 0.3 }} />
                <Typography>No se encontraron productos</Typography>
              </Box>
            : paginatedProductos.map(p => (
                <ProductoCard key={p.id} producto={p} grupos={grupos} onEditProducto={onEditProducto}
                  handleDelete={handleDelete} accentColor={accentColor} />
              ))
          }
        </Box>
      ) : (
        <TableContainer sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: 'action.hover' }}>
                <TableCell padding="checkbox">
                  <Checkbox
                    size="small"
                    checked={allSelected}
                    indeterminate={someSelected}
                    onChange={toggleAll}
                  />
                </TableCell>
                <TableCell sx={{ fontWeight: 800, textTransform: 'uppercase', fontSize: 11 }}>SKU</TableCell>
                <TableCell sx={{ fontWeight: 800, textTransform: 'uppercase', fontSize: 11 }}>
                  <TableSortLabel
                    active={sortBy === 'nombre'}
                    direction={sortBy === 'nombre' ? sortDir : 'asc'}
                    onClick={() => handleSort('nombre')}
                  >
                    Nombre
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ fontWeight: 800, textTransform: 'uppercase', fontSize: 11 }}>Grupo</TableCell>
                <TableCell sx={{ fontWeight: 800, textTransform: 'uppercase', fontSize: 11 }}>Unidad</TableCell>
                <TableCell sx={{ fontWeight: 800, textTransform: 'uppercase', fontSize: 11 }}>
                  <TableSortLabel
                    active={sortBy === 'costo'}
                    direction={sortBy === 'costo' ? sortDir : 'asc'}
                    onClick={() => handleSort('costo')}
                  >
                    Costo
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ fontWeight: 800, textTransform: 'uppercase', fontSize: 11 }}>
                  <TableSortLabel
                    active={sortBy === 'precio'}
                    direction={sortBy === 'precio' ? sortDir : 'asc'}
                    onClick={() => handleSort('precio')}
                  >
                    Precio
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ fontWeight: 800, textTransform: 'uppercase', fontSize: 11 }}>Margen</TableCell>
                <TableCell sx={{ fontWeight: 800, textTransform: 'uppercase', fontSize: 11 }}>
                  <TableSortLabel
                    active={sortBy === 'stock'}
                    direction={sortBy === 'stock' ? sortDir : 'asc'}
                    onClick={() => handleSort('stock')}
                  >
                    Stock
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ fontWeight: 800, textTransform: 'uppercase', fontSize: 11 }}>Tipo</TableCell>
                <TableCell sx={{ fontWeight: 800, textTransform: 'uppercase', fontSize: 11 }}>Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paginatedProductos.length === 0
                ? <TableRow>
                    <TableCell colSpan={11} sx={{ textAlign: 'center', py: 6, color: 'text.secondary' }}>
                      No se encontraron productos
                    </TableCell>
                  </TableRow>
                : paginatedProductos.map(producto => {
                    const stockActual = producto.stock_actual ?? 0;
                    const stockMinimo = producto.stock_minimo ?? 0;
                    const isService   = !!producto.es_servicio;
                    const isLow       = !isService && stockActual <= stockMinimo;
                    const isCritical  = !isService && stockActual <= 0;
                    const group       = getGroup(producto.grupo_item);
                    const margen      = getMargen(producto.precio, producto.costo);
                    const isExpanded  = expandedProducts.has(producto.id);
                    const varCount    = producto.variantes?.length || 0;

                    return (
                      <Fragment key={producto.id}>
                      <TableRow hover selected={selected.has(producto.id)}>
                        <TableCell padding="checkbox">
                          <Checkbox size="small" checked={selected.has(producto.id)} onChange={() => toggleSelect(producto.id)} />
                        </TableCell>
                        <TableCell sx={{ fontSize: 12, fontWeight: 700, fontFamily: 'monospace' }}>
                          <Box>
                            {producto.sku ? (
                              <Typography sx={{
                                display: 'inline-block',
                                fontSize: 11, fontWeight: 700, fontFamily: 'monospace',
                                color: 'text.primary', bgcolor: 'action.hover',
                                px: 0.8, py: 0.2, borderRadius: 1,
                              }}>
                                {producto.sku}
                              </Typography>
                            ) : (
                              <Typography sx={{ fontSize: 11, color: 'text.disabled' }}>—</Typography>
                            )}
                            {producto.codigo_barras && (
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4, mt: 0.4 }}>
                                <Typography sx={{ fontSize: 9, color: 'text.disabled' }}>▐</Typography>
                                <Typography sx={{ fontSize: 10, color: 'text.disabled', fontFamily: 'monospace' }}>
                                  {producto.codigo_barras}
                                </Typography>
                              </Box>
                            )}
                            {producto.tiene_variantes && (
                              <Chip
                                label={`${varCount} vars`}
                                size="small"
                                onClick={() => setExpandedProducts(prev => {
                                  const next = new Set(prev);
                                  if (next.has(producto.id)) next.delete(producto.id);
                                  else next.add(producto.id);
                                  return next;
                                })}
                                sx={{ mt: 0.3, height: 16, fontSize: 9, fontWeight: 700, cursor: 'pointer', bgcolor: '#8B5CF618', color: '#8B5CF6', borderRadius: 0.5 }}
                              />
                            )}
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Box sx={{ py: 0.5 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Typography sx={{ fontWeight: 700, fontSize: 13.5 }}>{producto.nombre}</Typography>
                              {producto.maneja_lotes && (
                                <Tooltip title="Maneja control por lotes">
                                  <Chip label="LOTES" size="small" sx={{ height: 16, fontSize: 8, fontWeight: 900, bgcolor: '#F59E0B18', color: '#F59E0B', borderRadius: 0.5 }} />
                                </Tooltip>
                              )}
                            </Box>
                            {producto.descripcion && (
                              <Typography sx={{ fontSize: 11, color: 'text.secondary', lineHeight: 1, mt: 0.3 }}>
                                {producto.descripcion}
                              </Typography>
                            )}
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Chip label={group.codigo} size="small"
                            sx={{ bgcolor: `${group.color}18`, color: group.color, fontWeight: 700, fontSize: 10, borderRadius: 1 }} />
                        </TableCell>
                        <TableCell sx={{ fontSize: 12 }}>{producto.unidad_medida}</TableCell>
                        <TableCell sx={{ fontSize: 12 }}>{formatCurrency(producto.costo)}</TableCell>
                        <TableCell sx={{ fontWeight: 800, fontSize: 13 }}>{formatCurrency(producto.precio)}</TableCell>
                        <TableCell>
                          {isService ? (
                            <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>—</Typography>
                          ) : (
                            <Typography sx={{ fontSize: 12, fontWeight: 700, color: margenColor(margen) }}>
                              {margen.toFixed(1)}%
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          {isService ? (
                            <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>—</Typography>
                          ) : (
                            <Tooltip title={isCritical ? 'Sin existencias' : (isLow ? 'Stock por debajo del mínimo' : 'Stock saludable')}>
                              <Chip
                                label={`${stockActual} / ${stockMinimo}`}
                                size="small"
                                color={isCritical || isLow ? 'error' : 'success'}
                                variant={isCritical || isLow ? 'filled' : 'outlined'}
                                sx={{ fontWeight: 600, fontSize: 11, borderRadius: 1.5 }}
                              />
                            </Tooltip>
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
                            <Tooltip title="Duplicar producto">
                              <IconButton size="small" onClick={() => handleDuplicate(producto.id)}
                                sx={{ color: '#64748b', '&:hover': { bgcolor: 'action.hover' } }}>
                                <ContentCopy fontSize="small" />
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
                      {producto.tiene_variantes && varCount > 0 && (
                        <TableRow>
                          <TableCell colSpan={11} sx={{ p: 0, border: 0 }}>
                            <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                              <Box sx={{ px: 4, py: 1.5, bgcolor: 'action.hover' }}>
                                <Typography sx={{ fontSize: 11, fontWeight: 700, color: 'text.secondary', mb: 1, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                  Variantes de {producto.nombre}
                                </Typography>
                                <Table size="small">
                                  <TableHead>
                                    <TableRow>
                                      <TableCell sx={{ fontSize: 10, fontWeight: 700 }}>SKU</TableCell>
                                      <TableCell sx={{ fontSize: 10, fontWeight: 700 }}>Nombre</TableCell>
                                      <TableCell sx={{ fontSize: 10, fontWeight: 700 }}>Atributos</TableCell>
                                      <TableCell sx={{ fontSize: 10, fontWeight: 700 }}>Precio</TableCell>
                                      <TableCell sx={{ fontSize: 10, fontWeight: 700 }}>Stock</TableCell>
                                    </TableRow>
                                  </TableHead>
                                  <TableBody>
                                    {(producto.variantes || []).map(v => (
                                      <TableRow key={v.id} hover>
                                        <TableCell sx={{ fontSize: 11, fontFamily: 'monospace', fontWeight: 700 }}>{v.sku}</TableCell>
                                        <TableCell sx={{ fontSize: 11 }}>{v.nombre}</TableCell>
                                        <TableCell>
                                          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                                            {v.atributos && Object.entries(v.atributos).map(([k, val]) => (
                                              <Chip key={k} label={`${k}: ${val}`} size="small" sx={{ height: 16, fontSize: 9 }} />
                                            ))}
                                          </Box>
                                        </TableCell>
                                        <TableCell sx={{ fontSize: 11 }}>{v.precio != null ? `$${v.precio.toLocaleString('es-CO')}` : '—'}</TableCell>
                                        <TableCell sx={{ fontSize: 11 }}>{v.stock_actual}</TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </Box>
                            </Collapse>
                          </TableCell>
                        </TableRow>
                      )}
                      </Fragment>
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

      {/* ── Bulk price dialog ── */}
      <Dialog open={bulkPriceDialog} onClose={() => setBulkPriceDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Ajustar precios en masa</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: 13, color: 'text.secondary', mb: 2 }}>
            Se aplicará el ajuste a <strong>{selected.size}</strong> producto(s) seleccionado(s).
          </Typography>
          <TextField
            fullWidth
            label="Variación de precio (%)"
            placeholder="Ej: 10 para subir 10%, -5 para bajar 5%"
            value={bulkPct}
            onChange={e => setBulkPct(e.target.value)}
            type="number"
            InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }}
            autoFocus
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setBulkPriceDialog(false)}>Cancelar</Button>
          <Button variant="contained" onClick={handleBulkPriceApply} disabled={!bulkPct}>
            Aplicar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ProductoList;
