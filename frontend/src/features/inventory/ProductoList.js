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
  FilterList, Close, TrendingUp, TrendingDown,
} from '@mui/icons-material';
import { alpha } from '@mui/material/styles';

const DEFAULT_ACCENT  = '#7C3AED';
const ACCENT2         = '#4F46E5';

// Un producto con variantes no acumula su propio stock_actual (cada
// movimiento de inventario va a la variante correspondiente) — leer
// producto.stock_actual directo muestra un valor congelado desde antes de
// que tuviera variantes. El stock real es la suma de sus variantes activas.
const getStockTotal = (producto) => {
  if (producto.tiene_variantes) {
    return (producto.variantes || [])
      .filter(v => v.activo !== false)
      .reduce((sum, v) => sum + (v.stock_actual ?? 0), 0);
  }
  return producto.stock_actual ?? 0;
};

// ─── KPI Card premium ─────────────────────────────────────────────────────────
const KpiCard = ({ label, value, icon, gradient, sub, trend }) => {
  const theme  = useTheme();
  const isDark = theme.palette.mode === 'dark';

  return (
    <Paper elevation={0} sx={{
      p: 2, borderRadius: 3,
      height: '100%',
      background: isDark
        ? `linear-gradient(145deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)`
        : `#fff`,
      border: '1px solid',
      borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
      boxShadow: isDark
        ? '0 4px 24px rgba(0,0,0,0.3)'
        : '0 2px 16px rgba(0,0,0,0.05)',
      position: 'relative',
      overflow: 'hidden',
      transition: 'transform 0.2s, box-shadow 0.2s',
      '&:hover': {
        transform: 'translateY(-2px)',
        boxShadow: isDark ? '0 8px 32px rgba(0,0,0,0.4)' : '0 8px 32px rgba(0,0,0,0.1)',
      },
      // decorative gradient blob
      '&::after': {
        content: '""', position: 'absolute',
        width: 80, height: 80, borderRadius: '50%',
        background: gradient,
        opacity: 0.12,
        top: -20, right: -20,
      },
    }}>
      <Box sx={{ position: 'relative', zIndex: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
          <Box sx={{
            width: 40, height: 40, borderRadius: 2,
            background: gradient,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: `0 4px 12px ${gradient.includes('124') ? 'rgba(124,58,237,0.35)' : 'rgba(16,185,129,0.35)'}`,
          }}>
            {React.cloneElement(icon, { sx: { color: '#fff', fontSize: 20 } })}
          </Box>
          {trend !== undefined && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}>
              {trend >= 0
                ? <TrendingUp sx={{ fontSize: 14, color: '#10B981' }} />
                : <TrendingDown sx={{ fontSize: 14, color: '#EF4444' }} />}
            </Box>
          )}
        </Box>
        <Typography sx={{ fontSize: 10.5, color: 'text.secondary', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.6, mb: 0.4 }}>
          {label}
        </Typography>
        <Typography sx={{ fontSize: 22, fontWeight: 800, lineHeight: 1.1, letterSpacing: -0.5 }}>
          {value}
        </Typography>
        {sub && (
          <Typography sx={{ fontSize: 10.5, color: 'text.secondary', mt: 0.3, fontWeight: 400 }}>
            {sub}
          </Typography>
        )}
      </Box>
    </Paper>
  );
};

// ─── Card mobile ──────────────────────────────────────────────────────────────
const ProductoCard = ({ producto, grupos, onEditProducto, handleDelete, accentColor }) => {
  const [showVariantes, setShowVariantes] = useState(false);
  const theme  = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const stockActual = getStockTotal(producto);
  const stockMinimo = producto.stock_minimo ?? 0;
  const isService   = !!producto.es_servicio;
  const isLow       = !isService && stockActual <= stockMinimo;
  const isCritical  = !isService && stockActual <= 0;
  const group       = grupos.find(g => g.id === producto.grupo_item) || { codigo: '—', color: '#94a3b8' };
  const varCount    = producto.variantes?.length || 0;

  const stockPct = stockMinimo > 0 ? Math.min(100, (stockActual / stockMinimo) * 100) : 100;
  const barColor = isCritical ? '#EF4444' : isLow ? '#F59E0B' : '#10B981';

  return (
    <Paper elevation={0} sx={{
      p: 2.5, mb: 1.5, borderRadius: 3,
      border: '1px solid',
      borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
      background: isDark
        ? 'rgba(255,255,255,0.03)'
        : '#fff',
      boxShadow: isCritical
        ? '0 0 0 1.5px #EF4444, 0 4px 16px rgba(239,68,68,0.1)'
        : isLow
          ? '0 0 0 1.5px #F59E0B40, 0 4px 16px rgba(245,158,11,0.08)'
          : '0 2px 12px rgba(0,0,0,0.04)',
      transition: 'transform 0.15s',
      '&:hover': { transform: 'translateY(-1px)' },
    }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
        <Box sx={{ minWidth: 0, flex: 1, mr: 1 }}>
          <Typography sx={{ fontWeight: 700, fontSize: 15, lineHeight: 1.2 }}>{producto.nombre}</Typography>
          {producto.descripcion && (
            <Typography sx={{ fontSize: 11, color: 'text.secondary', mt: 0.3 }}>
              {producto.descripcion}
            </Typography>
          )}
          <Box sx={{ display: 'flex', gap: 0.8, alignItems: 'center', mt: 0.8, flexWrap: 'wrap' }}>
            {producto.sku && (
              <Typography sx={{
                fontSize: 11, fontFamily: 'monospace', fontWeight: 700,
                color: accentColor, bgcolor: `${accentColor}12`,
                px: 0.8, py: 0.2, borderRadius: 1,
              }}>
                {producto.sku}
              </Typography>
            )}
            {producto.codigo_barras && (
              <Typography sx={{ fontSize: 10, color: 'text.disabled', fontFamily: 'monospace' }}>
                ▐ {producto.codigo_barras}
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

      <Divider sx={{ my: 1.5, opacity: 0.5 }} />

      <Grid container spacing={1} sx={{ mb: 1.5 }}>
        {[
          { label: 'Precio',  val: formatCurrency(producto.precio) },
          { label: 'Costo',   val: formatCurrency(producto.costo) },
          { label: 'Unidad',  val: producto.unidad_medida },
          ...(!isService ? [{ label: `${stockActual} / ${stockMinimo}`, val: '', isStock: true }] : []),
        ].filter(i => i.label).map(({ label, val, isStock }) => (
          <Grid item xs={4} key={label}>
            <Box sx={{ p: 1, borderRadius: 1.5, bgcolor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)', textAlign: 'center' }}>
              <Typography sx={{ fontSize: 10, color: 'text.secondary', mb: 0.2, fontWeight: 500 }}>
                {isStock ? 'Stock' : label}
              </Typography>
              {isStock
                ? (
                  <Box>
                    <Typography sx={{ fontSize: 11, fontWeight: 700, color: barColor }}>{label}</Typography>
                    <Box sx={{ height: 3, borderRadius: 2, bgcolor: 'action.hover', mt: 0.5, overflow: 'hidden' }}>
                      <Box sx={{ height: '100%', width: `${stockPct}%`, bgcolor: barColor, borderRadius: 2, transition: 'width 0.4s' }} />
                    </Box>
                  </Box>
                )
                : val && <Typography sx={{ fontSize: 12, fontWeight: 600 }}>{val}</Typography>
              }
            </Box>
          </Grid>
        ))}
      </Grid>

      <Box sx={{ display: 'flex', gap: 1, justifyContent: 'space-between', alignItems: 'center' }}>
        {producto.tiene_variantes && varCount > 0 ? (
          <Chip
            label={`${varCount} variante${varCount > 1 ? 's' : ''}`}
            size="small"
            onClick={() => setShowVariantes(v => !v)}
            sx={{
              fontSize: 10, fontWeight: 600, cursor: 'pointer',
              bgcolor: `${accentColor}15`, color: accentColor,
              border: `1px solid ${accentColor}30`,
            }}
          />
        ) : <Box />}
        <Box sx={{ display: 'flex', gap: 0.8 }}>
          <Tooltip title="Editar">
            <IconButton size="small" onClick={() => onEditProducto(producto)}
              sx={{ color: accentColor, bgcolor: `${accentColor}12`, borderRadius: 1.5, '&:hover': { bgcolor: `${accentColor}22` } }}>
              <Edit fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Eliminar">
            <IconButton size="small" onClick={() => handleDelete(producto.id)}
              sx={{ color: '#EF4444', bgcolor: '#FEF2F2', borderRadius: 1.5, '&:hover': { bgcolor: '#FEE2E2' } }}>
              <Delete fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      <Collapse in={showVariantes}>
        <Divider sx={{ my: 1.5, opacity: 0.5 }} />
        <Typography sx={{ fontSize: 11, fontWeight: 700, color: 'text.secondary', mb: 1, textTransform: 'uppercase', letterSpacing: 0.8 }}>
          Variantes
        </Typography>
        {(producto.variantes || []).map(v => (
          <Box key={v.id} sx={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            py: 0.6, px: 1, mb: 0.5, borderRadius: 1.5,
            bgcolor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
          }}>
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
  const [selected, setSelected]           = useState(new Set());
  const [bulkPriceDialog, setBulkPriceDialog] = useState(false);
  const [bulkPct, setBulkPct]             = useState('');

  const theme    = useTheme();
  const isDark   = theme.palette.mode === 'dark';
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
      try { await apiClient.put(`/productos/${id}`, { ...prod, precio: newPrecio }); ok++; } catch {}
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

  const handleSort = (column) => {
    if (column === sortBy) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(column); setSortDir('asc'); }
    setPage(0);
  };

  // ── Filtrado ────────────────────────────────────────────────────────────────
  const filteredProductos = useMemo(() => {
    let list = productos;
    if (filterGroup !== 'all') {
      if (filterGroup === 'servicio') list = list.filter(p => p.es_servicio);
      else list = list.filter(p => !p.es_servicio && String(p.grupo_item) === filterGroup);
    }
    if (filterStock !== 'all') {
      if (filterStock === 'ok')       list = list.filter(p => !p.es_servicio && getStockTotal(p) >= (p.stock_minimo ?? 0));
      else if (filterStock === 'bajo') list = list.filter(p => !p.es_servicio && getStockTotal(p) < (p.stock_minimo ?? 0) && getStockTotal(p) > 0);
      else if (filterStock === 'sinStock') list = list.filter(p => !p.es_servicio && getStockTotal(p) <= 0);
    }
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

  // ── Sorted + paginated ──────────────────────────────────────────────────────
  const paginatedProductos = useMemo(() => {
    const sorted = [...filteredProductos].sort((a, b) => {
      let aVal, bVal;
      if (sortBy === 'nombre') {
        return sortDir === 'asc' ? (a.nombre || '').localeCompare(b.nombre || '') : (b.nombre || '').localeCompare(a.nombre || '');
      } else if (sortBy === 'precio') { aVal = a.precio ?? 0; bVal = b.precio ?? 0; }
      else if (sortBy === 'costo')    { aVal = a.costo ?? 0;  bVal = b.costo ?? 0;  }
      else if (sortBy === 'stock')    { aVal = getStockTotal(a); bVal = getStockTotal(b); }
      else { return sortDir === 'asc' ? (a.nombre || '').localeCompare(b.nombre || '') : (b.nombre || '').localeCompare(a.nombre || ''); }
      return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
    });
    return sorted.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
  }, [filteredProductos, page, rowsPerPage, sortBy, sortDir]);

  // ── Stats ────────────────────────────────────────────────────────────────
  const stockBajo       = productos.filter(p => !p.es_servicio && getStockTotal(p) < (p.stock_minimo ?? 0)).length;
  const servicios       = productos.filter(p => p.es_servicio).length;
  const productosN      = productos.filter(p => !p.es_servicio).length;
  const valorInventario = productos.filter(p => !p.es_servicio).reduce((s, p) => {
    if (p.tiene_variantes) {
      return s + (p.variantes || []).filter(v => v.activo !== false)
        .reduce((sv, v) => sv + (v.stock_actual ?? 0) * (v.costo ?? p.costo ?? 0), 0);
    }
    return s + (p.stock_actual ?? 0) * (p.costo ?? 0);
  }, 0);

  // ── Filtros dinámicos ─────────────────────────────────────────────────────
  const groupFilters = [
    { value: 'all', label: `Todos (${productos.length})` },
    ...grupos.map(g => ({
      value: String(g.id), label: g.nombre, color: g.color,
      count: productos.filter(p => !p.es_servicio && p.grupo_item === g.id).length,
    })),
    { value: 'servicio', label: `Servicios (${servicios})` },
  ];

  const stockFilters = [
    { value: 'all',      label: `Todos`,       count: productos.filter(p => !p.es_servicio).length },
    { value: 'ok',       label: `✓ OK`,        count: productos.filter(p => !p.es_servicio && getStockTotal(p) >= (p.stock_minimo ?? 0)).length, color: '#10B981' },
    { value: 'bajo',     label: `⚠ Bajo`,      count: productos.filter(p => !p.es_servicio && getStockTotal(p) < (p.stock_minimo ?? 0) && getStockTotal(p) > 0).length, color: '#F59E0B' },
    { value: 'sinStock', label: `⛔ Sin stock`, count: productos.filter(p => !p.es_servicio && getStockTotal(p) <= 0).length, color: '#EF4444' },
  ];

  const mobileSortOptions = [
    { value: 'nombre', label: 'Nombre' },
    { value: 'precio', label: 'Precio' },
    { value: 'costo',  label: 'Costo' },
    { value: 'stock',  label: 'Stock' },
  ];

  const getMargen  = (precio, costo) => { const p = precio ?? 0; const c = costo ?? 0; return p > 0 ? ((p - c) / p) * 100 : 0; };
  const margenColor = (m) => m >= 30 ? '#10B981' : m >= 10 ? '#F59E0B' : '#EF4444';

  // ── Bulk selection ──────────────────────────────────────────────────────────
  const allVisibleIds = paginatedProductos.map(p => p.id);
  const allSelected   = allVisibleIds.length > 0 && allVisibleIds.every(id => selected.has(id));
  const someSelected  = allVisibleIds.some(id => selected.has(id)) && !allSelected;
  const toggleSelect  = (id) => setSelected(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  const toggleAll     = () => {
    if (allSelected) setSelected(prev => { const s = new Set(prev); allVisibleIds.forEach(id => s.delete(id)); return s; });
    else setSelected(prev => { const s = new Set(prev); allVisibleIds.forEach(id => s.add(id)); return s; });
  };

  // ── KPI gradient map ────────────────────────────────────────────────────────
  const KPI_GRADIENTS = {
    productos: `linear-gradient(135deg, ${accentColor}, #4F46E5)`,
    servicios: `linear-gradient(135deg, #06B6D4, #0284C7)`,
    alerta:    `linear-gradient(135deg, #EF4444, #DC2626)`,
    valor:     `linear-gradient(135deg, #10B981, #059669)`,
  };

  // ── Column header style ─────────────────────────────────────────────────────
  const thStyle = {
    fontWeight: 700, textTransform: 'uppercase', fontSize: 10.5,
    letterSpacing: 0.7, color: 'text.secondary', whiteSpace: 'nowrap',
    borderBottom: '2px solid', borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
    bgcolor: isDark ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.018)',
    py: 1.5, px: 1.5,
  };

  return (
    <Box sx={{ width: '100%', maxWidth: '100%' }}>
      {loading && <LinearProgress sx={{ mb: 1.5, borderRadius: 1, '& .MuiLinearProgress-bar': { background: `linear-gradient(90deg, ${accentColor}, #4F46E5)` } }} />}
      {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      {/* ── KPI Cards ──────────────────────────────────────────────────────────── */}
      <Grid container spacing={1.5} sx={{ mb: 3 }}>
        <Grid item xs={6} sm={3}>
          <KpiCard label="Productos" value={productosN} icon={<Inventory />} gradient={KPI_GRADIENTS.productos} sub={`${filteredProductos.length} filtrados`} />
        </Grid>
        <Grid item xs={6} sm={3}>
          <KpiCard label="Servicios" value={servicios} icon={<Settings />} gradient={KPI_GRADIENTS.servicios} />
        </Grid>
        <Grid item xs={6} sm={3}>
          <KpiCard label="Stock bajo" value={stockBajo} icon={<Warning />} gradient={KPI_GRADIENTS.alerta} sub="requieren reposición" trend={-1} />
        </Grid>
        <Grid item xs={6} sm={3}>
          <KpiCard label="Valor inventario" value={formatCurrency(valorInventario)} icon={<CheckCircle />} gradient={KPI_GRADIENTS.valor} trend={1} />
        </Grid>
      </Grid>
      <Divider sx={{ mb: 3, opacity: 0.6 }} />

      {/* ── Buscador ───────────────────────────────────────────────────────────── */}
      <TextField
        fullWidth
        placeholder="Buscar por nombre, SKU, código de barras o descripción…"
        value={searchTerm}
        onChange={e => { setSearchTerm(e.target.value); setPage(0); }}
        sx={{
          mb: 2,
          '& .MuiOutlinedInput-root': {
            borderRadius: 2.5,
            bgcolor: isDark ? 'rgba(255,255,255,0.04)' : '#fff',
            transition: 'box-shadow 0.2s',
            '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: accentColor },
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: accentColor, borderWidth: 2 },
            '&.Mui-focused': { boxShadow: `0 0 0 3px ${alpha(accentColor, 0.12)}` },
          },
          '& .MuiInputLabel-root.Mui-focused': { color: accentColor },
        }}
        InputProps={{
          startAdornment: <InputAdornment position="start"><Search sx={{ color: accentColor, fontSize: 20 }} /></InputAdornment>,
          endAdornment: searchTerm
            ? <InputAdornment position="end">
                <IconButton size="small" onClick={() => { setSearchTerm(''); setPage(0); }}>
                  <Close fontSize="small" />
                </IconButton>
              </InputAdornment>
            : null,
        }}
      />

      {/* ── Toolbar: ordenar (mobile) + exportar ───────────────────────────────── */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5, flexWrap: 'nowrap' }}>
        {isMobile && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, flex: 1, overflow: 'hidden' }}>
            <SwapVert sx={{ fontSize: 16, color: 'text.secondary', flexShrink: 0 }} />
            <Box sx={{ display: 'flex', gap: 0.8, overflowX: 'auto', pb: 0.3, '&::-webkit-scrollbar': { display: 'none' } }}>
              {mobileSortOptions.map(opt => (
                <Chip
                  key={opt.value}
                  label={opt.label + (sortBy === opt.value ? (sortDir === 'asc' ? ' ↑' : ' ↓') : '')}
                  size="small"
                  onClick={() => handleSort(opt.value)}
                  sx={{
                    fontWeight: 600, fontSize: 11, borderRadius: 1.5, cursor: 'pointer', flexShrink: 0,
                    ...(sortBy === opt.value
                      ? { bgcolor: accentColor, color: '#fff' }
                      : { bgcolor: 'action.hover', color: 'text.secondary' }),
                  }}
                />
              ))}
            </Box>
          </Box>
        )}

        <Box sx={{ display: 'flex', gap: 0.8, ml: 'auto', flexShrink: 0 }}>
          <Tooltip title="Descargar plantilla Excel">
            {isMobile
              ? <IconButton size="small" onClick={handleTemplate} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1.5 }}>
                  <Download fontSize="small" />
                </IconButton>
              : <Button variant="outlined" size="small" startIcon={<Download />} onClick={handleTemplate}
                  sx={{ borderRadius: 2, fontWeight: 600, fontSize: 12, borderColor: 'divider', color: 'text.secondary' }}>
                  Plantilla
                </Button>
            }
          </Tooltip>
          <Tooltip title="Exportar lista a Excel">
            {isMobile
              ? <IconButton size="small" onClick={() => handleExport('xlsx')} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1.5 }}>
                  <Download fontSize="small" />
                </IconButton>
              : <Button variant="outlined" size="small" startIcon={<Download />} onClick={() => handleExport('xlsx')}
                  sx={{ borderRadius: 2, fontWeight: 600, fontSize: 12, borderColor: accentColor, color: accentColor }}>
                  Exportar
                </Button>
            }
          </Tooltip>
        </Box>
      </Box>

      {/* ── Filtros de categoría ────────────────────────────────────────────────── */}
      <Box sx={{ mb: 1.5 }}>
        {isMobile && (
          <Typography sx={{ fontSize: 10, fontWeight: 700, color: 'text.disabled', textTransform: 'uppercase', letterSpacing: 0.6, mb: 0.5 }}>
            Categoría
          </Typography>
        )}
        <Box sx={{ display: 'flex', gap: 0.8, overflowX: 'auto', pb: 0.3, '&::-webkit-scrollbar': { display: 'none' }, flexWrap: isMobile ? 'nowrap' : 'wrap' }}>
          {groupFilters.map(f => (
            <Chip
              key={f.value}
              label={
                f.color
                  ? <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: filterGroup === f.value ? '#fff' : f.color, display: 'inline-block', flexShrink: 0 }} />
                      {f.label}
                    </Box>
                  : f.label
              }
              onClick={() => { setFilterGroup(f.value); setFilterStock('all'); setPage(0); }}
              size="small"
              sx={{
                fontWeight: 600, fontSize: 12, borderRadius: 2, cursor: 'pointer', flexShrink: 0,
                transition: 'all 0.15s',
                ...(filterGroup === f.value
                  ? { bgcolor: f.color || accentColor, color: '#fff', boxShadow: `0 2px 8px ${f.color || accentColor}60` }
                  : { bgcolor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)', color: 'text.secondary', '&:hover': { bgcolor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.09)' } }),
              }}
            />
          ))}
        </Box>
      </Box>

      {/* ── Filtros de stock ────────────────────────────────────────────────────── */}
      {filterGroup !== 'servicio' && (
        <Box sx={{ mb: 2 }}>
          {isMobile && (
            <Typography sx={{ fontSize: 10, fontWeight: 700, color: 'text.disabled', textTransform: 'uppercase', letterSpacing: 0.6, mb: 0.5 }}>
              Stock
            </Typography>
          )}
          <Box sx={{ display: 'flex', gap: 0.8, overflowX: 'auto', pb: 0.3, '&::-webkit-scrollbar': { display: 'none' }, flexWrap: isMobile ? 'nowrap' : 'wrap' }}>
            {stockFilters.map(f => (
              <Chip
                key={f.value}
                label={`${f.label} ${f.count !== undefined ? `(${f.count})` : ''}`}
                onClick={() => { setFilterStock(f.value); setPage(0); }}
                size="small"
                sx={{
                  fontWeight: 600, fontSize: 12, borderRadius: 2, cursor: 'pointer', flexShrink: 0,
                  transition: 'all 0.15s',
                  ...(filterStock === f.value
                    ? { bgcolor: f.color || accentColor, color: '#fff', boxShadow: `0 2px 8px ${f.color || accentColor}55` }
                    : { bgcolor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)', color: 'text.secondary' }),
                }}
              />
            ))}
          </Box>
        </Box>
      )}

      {/* ── Bulk action bar ─────────────────────────────────────────────────────── */}
      {selected.size > 0 && (
        <Box sx={{
          display: 'flex', alignItems: 'center', gap: 1.5, mb: 2, px: 2, py: 1.5,
          background: `linear-gradient(135deg, ${accentColor}18, ${ACCENT2}12)`,
          borderRadius: 2.5, border: `1px solid ${accentColor}30`, flexWrap: 'wrap',
          backdropFilter: 'blur(8px)',
        }}>
          <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: accentColor, flexShrink: 0,
            boxShadow: `0 0 6px ${accentColor}`, animation: 'pulse 1.5s infinite',
            '@keyframes pulse': { '0%, 100%': { opacity: 1 }, '50%': { opacity: 0.4 } } }} />
          <Typography sx={{ fontWeight: 700, fontSize: 13, color: accentColor }}>
            {selected.size} seleccionado{selected.size > 1 ? 's' : ''}
          </Typography>
          <Button size="small" variant="outlined"
            sx={{ borderRadius: 2, fontSize: 12, borderColor: accentColor, color: accentColor }}
            onClick={() => setBulkPriceDialog(true)}>
            Ajustar precios %
          </Button>
          <Button size="small" variant="outlined" color="error"
            sx={{ borderRadius: 2, fontSize: 12, ml: 'auto' }}
            onClick={() => setSelected(new Set())}>
            <Close fontSize="small" sx={{ mr: 0.5 }} /> Cancelar
          </Button>
        </Box>
      )}

      {/* ── Lista principal ──────────────────────────────────────────────────────── */}
      {isMobile ? (
        <Box>
          {paginatedProductos.length === 0
            ? <Box sx={{ textAlign: 'center', py: 8, color: 'text.secondary' }}>
                <Inventory sx={{ fontSize: 52, mb: 1.5, opacity: 0.2, color: accentColor }} />
                <Typography sx={{ fontWeight: 600 }}>No se encontraron productos</Typography>
                <Typography sx={{ fontSize: 12, mt: 0.5 }}>Prueba con otro filtro o búsqueda</Typography>
              </Box>
            : paginatedProductos.map(p => (
                <ProductoCard key={p.id} producto={p} grupos={grupos} onEditProducto={onEditProducto}
                  handleDelete={handleDelete} accentColor={accentColor} />
              ))
          }
        </Box>
      ) : (
        <TableContainer sx={{
          borderRadius: 3,
          border: '1px solid',
          borderColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)',
          overflow: 'hidden',
          boxShadow: isDark ? '0 4px 32px rgba(0,0,0,0.3)' : '0 2px 16px rgba(0,0,0,0.05)',
        }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox" sx={{ ...thStyle, py: 1.5 }}>
                  <Checkbox
                    size="small"
                    checked={allSelected}
                    indeterminate={someSelected}
                    onChange={toggleAll}
                    sx={{ color: accentColor, '&.Mui-checked': { color: accentColor } }}
                  />
                </TableCell>
                {[
                  { key: 'sku',              label: 'SKU / Barcode', sortable: false },
                  { key: 'nombre',           label: 'Nombre',        sortable: true  },
                  { key: 'grupo',            label: 'Grupo',         sortable: false },
                  { key: 'unidad',           label: 'Unidad',        sortable: false },
                  { key: 'costo',            label: 'Costo',         sortable: true  },
                  { key: 'costo_produccion', label: 'C. Producción', sortable: false, tooltip: 'Costo real del último lote de producción confirmado' },
                  { key: 'precio',           label: 'Precio',        sortable: true  },
                  { key: 'margen',           label: 'Margen',        sortable: false },
                  { key: 'stock',            label: 'Stock',         sortable: true  },
                  { key: 'tipo',             label: 'Tipo',          sortable: false },
                  { key: 'acciones',         label: '',              sortable: false },
                ].map(col => (
                  <TableCell key={col.key} sx={thStyle}>
                    {col.tooltip
                      ? <Tooltip title={col.tooltip}><span>{col.label}</span></Tooltip>
                      : col.sortable
                        ? <TableSortLabel
                            active={sortBy === col.key}
                            direction={sortBy === col.key ? sortDir : 'asc'}
                            onClick={() => handleSort(col.key)}
                            sx={{ '&.Mui-active': { color: accentColor }, '& .MuiTableSortLabel-icon': { color: `${accentColor} !important` } }}
                          >
                            {col.label}
                          </TableSortLabel>
                        : col.label
                    }
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {paginatedProductos.length === 0
                ? <TableRow>
                    <TableCell colSpan={12} sx={{ textAlign: 'center', py: 8, color: 'text.secondary' }}>
                      <Box>
                        <Inventory sx={{ fontSize: 48, mb: 1.5, opacity: 0.2, color: accentColor }} />
                        <Typography sx={{ fontWeight: 600 }}>No se encontraron productos</Typography>
                        <Typography sx={{ fontSize: 12, mt: 0.5 }}>Prueba con otro filtro o búsqueda</Typography>
                      </Box>
                    </TableCell>
                  </TableRow>
                : paginatedProductos.map(producto => {
                    const stockActual = getStockTotal(producto);
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
                        <TableRow
                          hover
                          selected={selected.has(producto.id)}
                          sx={{
                            cursor: 'default',
                            transition: 'background-color 0.15s',
                            '&:hover': {
                              bgcolor: isDark ? `${accentColor}10` : `${accentColor}07`,
                              '& .row-actions': { opacity: 1 },
                            },
                            '&.Mui-selected': {
                              bgcolor: isDark ? `${accentColor}18` : `${accentColor}0A`,
                              '&:hover': { bgcolor: isDark ? `${accentColor}22` : `${accentColor}12` },
                            },
                            // Borde izquierdo de alerta de stock
                            ...(isCritical
                              ? { borderLeft: '3px solid #EF4444' }
                              : isLow
                                ? { borderLeft: '3px solid #F59E0B' }
                                : {}
                            ),
                          }}
                        >
                          <TableCell padding="checkbox">
                            <Checkbox size="small" checked={selected.has(producto.id)} onChange={() => toggleSelect(producto.id)}
                              sx={{ color: accentColor, '&.Mui-checked': { color: accentColor } }} />
                          </TableCell>

                          {/* SKU */}
                          <TableCell sx={{ fontSize: 12, py: 1.5, px: 1.5 }}>
                            <Box>
                              {producto.sku
                                ? <Typography sx={{ display: 'inline-block', fontSize: 11, fontWeight: 700, fontFamily: 'monospace', color: accentColor, bgcolor: `${accentColor}12`, px: 0.8, py: 0.2, borderRadius: 1 }}>
                                    {producto.sku}
                                  </Typography>
                                : <Typography sx={{ fontSize: 11, color: 'text.disabled' }}>—</Typography>
                              }
                              {producto.codigo_barras && (
                                <Typography sx={{ fontSize: 10, color: 'text.disabled', fontFamily: 'monospace', mt: 0.3 }}>
                                  ▐ {producto.codigo_barras}
                                </Typography>
                              )}
                              {producto.tiene_variantes && (
                                <Chip
                                  label={`${varCount} vars`}
                                  size="small"
                                  onClick={() => setExpandedProducts(prev => {
                                    const next = new Set(prev);
                                    next.has(producto.id) ? next.delete(producto.id) : next.add(producto.id);
                                    return next;
                                  })}
                                  sx={{ mt: 0.3, height: 16, fontSize: 9, fontWeight: 700, cursor: 'pointer', bgcolor: `${accentColor}18`, color: accentColor, borderRadius: 0.5 }}
                                />
                              )}
                            </Box>
                          </TableCell>

                          {/* Nombre */}
                          <TableCell sx={{ py: 1.5, px: 1.5 }}>
                            <Box>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                                <Typography sx={{ fontWeight: 700, fontSize: 13 }}>{producto.nombre}</Typography>
                                {producto.maneja_lotes && (
                                  <Tooltip title="Maneja control por lotes">
                                    <Chip label="LOTES" size="small" sx={{ height: 16, fontSize: 8, fontWeight: 900, bgcolor: '#F59E0B18', color: '#F59E0B', borderRadius: 0.5 }} />
                                  </Tooltip>
                                )}
                              </Box>
                              {producto.descripcion && (
                                <Typography sx={{ fontSize: 11, color: 'text.secondary', lineHeight: 1.2, mt: 0.2 }}>
                                  {producto.descripcion}
                                </Typography>
                              )}
                            </Box>
                          </TableCell>

                          {/* Grupo */}
                          <TableCell sx={{ py: 1.5, px: 1.5 }}>
                            <Chip label={group.codigo} size="small"
                              sx={{ bgcolor: `${group.color}18`, color: group.color, fontWeight: 700, fontSize: 10, borderRadius: 1 }} />
                          </TableCell>

                          {/* Unidad */}
                          <TableCell sx={{ fontSize: 12, py: 1.5, px: 1.5, color: 'text.secondary' }}>{producto.unidad_medida}</TableCell>

                          {/* Costo */}
                          <TableCell sx={{ fontSize: 12, py: 1.5, px: 1.5 }}>{formatCurrency(producto.costo)}</TableCell>

                          {/* Costo Producción */}
                          <TableCell sx={{ fontSize: 12, fontWeight: 700, color: producto.costo_produccion != null ? '#06B6D4' : 'text.disabled', py: 1.5, px: 1.5 }}>
                            {producto.costo_produccion != null ? formatCurrency(producto.costo_produccion) : '—'}
                          </TableCell>

                          {/* Precio */}
                          <TableCell sx={{ fontWeight: 800, fontSize: 13.5, py: 1.5, px: 1.5, color: accentColor }}>{formatCurrency(producto.precio)}</TableCell>

                          {/* Margen */}
                          <TableCell sx={{ py: 1.5, px: 1.5 }}>
                            {isService
                              ? <Typography sx={{ fontSize: 12, color: 'text.disabled' }}>—</Typography>
                              : <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                  <Box sx={{ width: 32, height: 4, borderRadius: 2, bgcolor: 'action.hover', overflow: 'hidden' }}>
                                    <Box sx={{ height: '100%', width: `${Math.min(100, margen)}%`, bgcolor: margenColor(margen), borderRadius: 2 }} />
                                  </Box>
                                  <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: margenColor(margen) }}>
                                    {margen.toFixed(1)}%
                                  </Typography>
                                </Box>
                            }
                          </TableCell>

                          {/* Stock */}
                          <TableCell sx={{ py: 1.5, px: 1.5 }}>
                            {isService
                              ? <Typography sx={{ fontSize: 12, color: 'text.disabled' }}>—</Typography>
                              : (
                                <Tooltip title={isCritical ? 'Sin existencias' : isLow ? 'Stock por debajo del mínimo' : 'Stock saludable'}>
                                  <Chip
                                    label={`${stockActual} / ${stockMinimo}`}
                                    size="small"
                                    color={isCritical || isLow ? 'error' : 'success'}
                                    variant={isCritical || isLow ? 'filled' : 'outlined'}
                                    sx={{ fontWeight: 600, fontSize: 11, borderRadius: 1.5 }}
                                  />
                                </Tooltip>
                              )
                            }
                          </TableCell>

                          {/* Tipo */}
                          <TableCell sx={{ py: 1.5, px: 1.5 }}>
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

                          {/* Acciones */}
                          <TableCell sx={{ py: 1.5, px: 1.5 }}>
                            <Box className="row-actions" sx={{ display: 'flex', gap: 0.3, opacity: 0.6, transition: 'opacity 0.15s' }}>
                              <Tooltip title="Editar">
                                <IconButton size="small" onClick={() => onEditProducto(producto)}
                                  sx={{ color: accentColor, '&:hover': { bgcolor: `${accentColor}12` } }}>
                                  <Edit sx={{ fontSize: 16 }} />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Duplicar">
                                <IconButton size="small" onClick={() => handleDuplicate(producto.id)}
                                  sx={{ color: '#64748b', '&:hover': { bgcolor: 'action.hover' } }}>
                                  <ContentCopy sx={{ fontSize: 16 }} />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Eliminar">
                                <IconButton size="small" onClick={() => handleDelete(producto.id)}
                                  sx={{ color: '#EF4444', '&:hover': { bgcolor: '#FEF2F2' } }}>
                                  <Delete sx={{ fontSize: 16 }} />
                                </IconButton>
                              </Tooltip>
                            </Box>
                          </TableCell>
                        </TableRow>

                        {/* ── Variantes expandidas ── */}
                        {producto.tiene_variantes && varCount > 0 && (
                          <TableRow>
                            <TableCell colSpan={12} sx={{ p: 0, border: 0 }}>
                              <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                                <Box sx={{ px: 4, py: 1.5, bgcolor: isDark ? `${accentColor}08` : `${accentColor}05`, borderTop: '1px solid', borderColor: 'divider' }}>
                                  <Typography sx={{ fontSize: 11, fontWeight: 700, color: accentColor, mb: 1, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                    Variantes de {producto.nombre}
                                  </Typography>
                                  <Table size="small">
                                    <TableHead>
                                      <TableRow>
                                        {['SKU', 'Nombre', 'Atributos', 'Precio', 'Stock'].map(h => (
                                          <TableCell key={h} sx={{ fontSize: 10, fontWeight: 700, color: 'text.secondary', py: 0.8 }}>{h}</TableCell>
                                        ))}
                                      </TableRow>
                                    </TableHead>
                                    <TableBody>
                                      {(producto.variantes || []).map(v => (
                                        <TableRow key={v.id} hover sx={{ '&:hover': { bgcolor: `${accentColor}08` } }}>
                                          <TableCell sx={{ fontSize: 11, fontFamily: 'monospace', fontWeight: 700, color: accentColor }}>{v.sku}</TableCell>
                                          <TableCell sx={{ fontSize: 11 }}>{v.nombre}</TableCell>
                                          <TableCell>
                                            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                                              {v.atributos && Object.entries(v.atributos).map(([k, val]) => (
                                                <Chip key={k} label={`${k}: ${val}`} size="small" sx={{ height: 16, fontSize: 9 }} />
                                              ))}
                                            </Box>
                                          </TableCell>
                                          <TableCell sx={{ fontSize: 11 }}>{v.precio != null ? formatCurrency(v.precio) : '—'}</TableCell>
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
        rowsPerPageOptions={[5, 10, 25, 50]}
        component="div"
        count={filteredProductos.length}
        rowsPerPage={rowsPerPage}
        page={page}
        onPageChange={(_, p) => setPage(p)}
        onRowsPerPageChange={e => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
        labelRowsPerPage="Filas:"
        labelDisplayedRows={({ from, to, count }) => `${from}–${to} de ${count}`}
        sx={{
          mt: 0.5,
          '& .MuiTablePagination-selectIcon': { color: accentColor },
        }}
      />

      {/* ── Confirm Dialog ── */}
      <ConfirmationDialog
        open={showConfirmDialog}
        handleClose={() => setShowConfirmDialog(false)}
        handleConfirm={confirmDelete}
        title="Eliminar producto"
        message="¿Estás seguro de que quieres eliminar este producto/servicio? Esta acción no se puede deshacer."
      />

      {/* ── Bulk price dialog ── */}
      <Dialog open={bulkPriceDialog} onClose={() => setBulkPriceDialog(false)} maxWidth="xs" fullWidth
        PaperProps={{ sx: { borderRadius: 3.5, border: '1px solid', borderColor: 'divider', overflow: 'hidden' } }}>
        {/* Franja superior */}
        <Box sx={{ height: 3, background: `linear-gradient(90deg, ${accentColor}, ${ACCENT2})` }} />
        <DialogTitle sx={{ fontWeight: 800, fontSize: 16, display: 'flex', alignItems: 'center', gap: 1.2 }}>
          <Box sx={{
            width: 32, height: 32, borderRadius: 2,
            background: `linear-gradient(135deg, ${accentColor}, ${ACCENT2})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <FilterList sx={{ color: '#fff', fontSize: 16 }} />
          </Box>
          Ajustar precios en masa
        </DialogTitle>
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
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: 2,
                transition: 'box-shadow 0.2s',
                '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: accentColor },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: accentColor, borderWidth: 2 },
                '&.Mui-focused': { boxShadow: `0 0 0 3px ${alpha(accentColor, 0.1)}` },
              },
              '& .MuiInputLabel-root.Mui-focused': { color: accentColor },
            }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button onClick={() => setBulkPriceDialog(false)}
            sx={{ borderRadius: 2.5, fontWeight: 600, color: 'text.secondary' }}>Cancelar</Button>
          <Button
            variant="contained"
            onClick={handleBulkPriceApply}
            disabled={!bulkPct}
            sx={{
              borderRadius: 2.5,
              fontWeight: 700,
              px: 3, py: 1,
              background: `linear-gradient(135deg, ${accentColor}, ${ACCENT2})`,
              boxShadow: `0 4px 14px ${alpha(accentColor, 0.45)}`,
              '&:hover': { transform: 'translateY(-1px)', boxShadow: `0 6px 20px ${alpha(accentColor, 0.55)}` },
              '&:disabled': { background: 'rgba(0,0,0,0.12)', boxShadow: 'none' },
              transition: 'all 0.2s',
            }}
          >
            Aplicar cambio
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ProductoList;
