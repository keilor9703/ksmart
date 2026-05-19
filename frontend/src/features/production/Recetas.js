import React, { useState, useEffect, useMemo } from 'react';
import {
  Box, Typography, Button, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TableSortLabel, TablePagination, IconButton, Dialog,
  DialogTitle, DialogContent, DialogActions, TextField, Grid, Divider,
  useTheme, useMediaQuery, Chip, Tooltip, InputAdornment, Autocomplete, Stack
} from '@mui/material';
import {
  Add, Delete, Edit, Search, Close, Science,
  ContentCopy, FileDownload, AttachMoney, TrendingDown, TrendingUp
} from '@mui/icons-material';
import { fetchRecetas, createReceta, updateReceta, deleteReceta } from '../../api';
import apiClient from '../../api';
import { toast } from 'react-toastify';
import { formatCurrency } from '../../utils/formatters';
import CurrencyField from '../../components/common/CurrencyField';
import ConfirmationDialog from '../../components/common/ConfirmationDialog';
import QuickCreateModal from '../../components/common/QuickCreateModal';

const DEFAULT_ACCENT = '#8B5CF6';
const RED   = '#EF4444';
const GREEN = '#10B981';
const CYAN  = '#06B6D4';
const AMBER = '#F59E0B';

// ─── KPI Card ──────────────────────────────────────────────────────────────────
const KpiCard = ({ label, value, color, sub, icon }) => (
  <Paper sx={{ p: 2, borderRadius: 3, display: 'flex', alignItems: 'center', gap: 1.5, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
    <Box sx={{ width: 40, height: 40, borderRadius: 2, bgcolor: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', color, flexShrink: 0 }}>
      {icon}
    </Box>
    <Box sx={{ minWidth: 0 }}>
      <Typography sx={{ fontSize: 11, color: 'text.secondary', fontWeight: 500 }}>{label}</Typography>
      <Typography sx={{ fontSize: 15, fontWeight: 800, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</Typography>
      {sub && <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>{sub}</Typography>}
    </Box>
  </Paper>
);

// ─── Card Mobile ───────────────────────────────────────────────────────────────
const RecetaCard = ({ receta, onDelete, onEdit, onDuplicate, accentColor }) => (
  <Paper sx={{ p: 2.5, mb: 2, borderRadius: 3, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
      <Box sx={{ flex: 1, minWidth: 0, pr: 1 }}>
        <Typography sx={{ fontWeight: 700, fontSize: 15, mb: 0.3 }}>{receta.nombre}</Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
          <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>Produce:</Typography>
          <Chip label={receta.producto_resultante.nombre} size="small"
            sx={{ bgcolor: `${accentColor}12`, color: accentColor, fontWeight: 600, fontSize: 10, borderRadius: 1, height: 20 }} />
          {(receta.porciones || 1) > 1 && (
            <Chip label={`× ${receta.porciones} uds`} size="small"
              sx={{ bgcolor: `${CYAN}12`, color: CYAN, fontWeight: 600, fontSize: 10, borderRadius: 1, height: 20 }} />
          )}
        </Box>
      </Box>
      <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }}>
        <Tooltip title="Duplicar receta">
          <IconButton size="small" onClick={() => onDuplicate(receta)}
            sx={{ color: AMBER, bgcolor: `${AMBER}15`, borderRadius: 1.5 }}>
            <ContentCopy fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Editar receta">
          <IconButton size="small" onClick={() => onEdit(receta)}
            sx={{ color: accentColor, bgcolor: `${accentColor}15`, borderRadius: 1.5 }}>
            <Edit fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Eliminar receta">
          <IconButton size="small" onClick={() => onDelete(receta.id)}
            sx={{ color: RED, bgcolor: '#FEF2F2', borderRadius: 1.5 }}>
            <Delete fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
    </Box>

    <Divider sx={{ my: 1.5 }} />

    <Box sx={{ mb: receta.servicios_maquila.length > 0 ? 1.5 : 0 }}>
      <Typography sx={{ fontSize: 10, color: 'text.secondary', fontWeight: 600, mb: 0.5, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        Insumos ({receta.items.length})
      </Typography>
      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
        {receta.items.map(it => (
          <Chip key={it.insumo.id} label={`${it.insumo.nombre} × ${it.cantidad}`} size="small"
            sx={{ bgcolor: 'action.hover', fontWeight: 500, fontSize: 10, borderRadius: 1, height: 22 }} />
        ))}
      </Box>
    </Box>

    {receta.servicios_maquila.length > 0 && (
      <Box sx={{ mb: receta.costoPorUnidad > 0 ? 1.5 : 0 }}>
        <Typography sx={{ fontSize: 10, color: 'text.secondary', fontWeight: 600, mb: 0.5, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Servicios ({receta.servicios_maquila.length})
        </Typography>
        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
          {receta.servicios_maquila.map(s => (
            <Chip key={s.servicio.id} label={s.servicio.nombre} size="small"
              sx={{ bgcolor: `${CYAN}10`, color: CYAN, fontWeight: 600, fontSize: 10, borderRadius: 1, height: 22 }} />
          ))}
        </Box>
      </Box>
    )}

    {receta.costoPorUnidad > 0 && (
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1, pt: 1, borderTop: '1px dashed', borderColor: 'divider' }}>
        <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>Costo por unidad</Typography>
        <Typography sx={{ fontSize: 13, fontWeight: 800, color: RED }}>{formatCurrency(receta.costoPorUnidad)}</Typography>
      </Box>
    )}
  </Paper>
);

// ─── Componente Principal ──────────────────────────────────────────────────────
const Recetas = ({ accentColor = DEFAULT_ACCENT }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [recetas, setRecetas]     = useState([]);
  const [productos, setProductos] = useState([]);
  const [insumos, setInsumos]     = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [open, setOpen]             = useState(false);
  const [loading, setLoading]       = useState(false);
  const [editingReceta, setEditingReceta] = useState(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [itemToDelete, setItemToDelete]           = useState(null);

  // Sort & pagination
  const [sortCol, setSortCol]             = useState('nombre');
  const [sortDir, setSortDir]             = useState('asc');
  const [page, setPage]                   = useState(0);
  const [rowsPerPage, setRowsPerPage]     = useState(15);

  const [formData, setFormData] = useState({
    producto_id: '', nombre: '', descripcion: '',
    porciones: 1, precio_sugerido: '',
    servicios: [],
    items: [{ insumo_id: '', cantidad: '' }],
  });

  const [productoInput, setProductoInput] = useState('');
  const [insumoInputs, setInsumoInputs]   = useState({});
  const [quickCreate, setQuickCreate]     = useState({ open: false, type: 'producto', initialName: '', targetIdx: null });

  useEffect(() => { loadData(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadData = async () => {
    try {
      const [recRes, prodRes] = await Promise.all([fetchRecetas(), apiClient.get('/productos/')]);
      setRecetas(recRes.data);
      const all = prodRes.data;
      setProductos(all);
      setInsumos(all.filter(p => !p.es_servicio));
    } catch {
      toast.error('Error cargando recetas');
    }
  };

  // ─── Maps y costos ──────────────────────────────────────────────────────────
  const productosMap = useMemo(() =>
    Object.fromEntries(productos.map(p => [p.id, p])),
    [productos]
  );

  const recetasConCosto = useMemo(() => {
    return recetas.map(r => {
      const costoBatch =
        r.items.reduce((s, it) => {
          const prod = productosMap[it.insumo?.id];
          const cu = prod?.costo_unitario ?? it.insumo?.costo_unitario ?? 0;
          return s + cu * it.cantidad;
        }, 0) +
        r.servicios_maquila.reduce((s, sm) => {
          const svc = productosMap[sm.servicio?.id];
          return s + (svc?.precio_venta ?? svc?.costo_unitario ?? sm.servicio?.precio_venta ?? 0);
        }, 0);
      const porciones = r.porciones || 1;
      return { ...r, costoBatch, costoPorUnidad: porciones > 0 ? costoBatch / porciones : costoBatch };
    });
  }, [recetas, productosMap]);

  // ─── KPIs ──────────────────────────────────────────────────────────────────
  const costoPromedio = recetasConCosto.length > 0
    ? recetasConCosto.reduce((s, r) => s + r.costoPorUnidad, 0) / recetasConCosto.length : 0;
  const recetaMasCara   = recetasConCosto.reduce((best, r) => r.costoPorUnidad > (best?.costoPorUnidad || 0) ? r : best, null);
  const recetaMasBarata = recetasConCosto.filter(r => r.costoPorUnidad > 0)
    .reduce((best, r) => !best || r.costoPorUnidad < best.costoPorUnidad ? r : best, null);

  // ─── Filter + Sort + Paginate ───────────────────────────────────────────────
  const filteredRecetas = useMemo(() =>
    recetasConCosto.filter(r =>
      r.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.producto_resultante.nombre.toLowerCase().includes(searchTerm.toLowerCase())
    ), [recetasConCosto, searchTerm]
  );

  const sortedRecetas = useMemo(() => {
    return [...filteredRecetas].sort((a, b) => {
      if (sortCol === 'nombre')
        return sortDir === 'asc' ? a.nombre.localeCompare(b.nombre) : b.nombre.localeCompare(a.nombre);
      if (sortCol === 'producto') {
        const va = a.producto_resultante.nombre, vb = b.producto_resultante.nombre;
        return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
      }
      if (sortCol === 'costo')
        return sortDir === 'asc' ? a.costoPorUnidad - b.costoPorUnidad : b.costoPorUnidad - a.costoPorUnidad;
      if (sortCol === 'insumos')
        return sortDir === 'asc' ? a.items.length - b.items.length : b.items.length - a.items.length;
      return 0;
    });
  }, [filteredRecetas, sortCol, sortDir]);

  const paginatedRecetas = useMemo(() =>
    sortedRecetas.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage),
    [sortedRecetas, page, rowsPerPage]
  );

  const handleSort = (col) => {
    setSortDir(prev => col === sortCol ? (prev === 'asc' ? 'desc' : 'asc') : 'asc');
    setSortCol(col);
    setPage(0);
  };

  // ─── SortTh (closure) ──────────────────────────────────────────────────────
  const SortTh = ({ col, label, align, sx: sxProp }) => (
    <TableCell align={align} sx={{ fontWeight: 600, ...sxProp }}>
      <TableSortLabel active={sortCol === col} direction={sortCol === col ? sortDir : 'asc'} onClick={() => handleSort(col)}>
        {label}
      </TableSortLabel>
    </TableCell>
  );

  // ─── Live cost calculator ───────────────────────────────────────────────────
  const costoLiveItems = useMemo(() => {
    return formData.items.map(item => {
      const prod = productosMap[parseInt(item.insumo_id)];
      const qty  = parseFloat(item.cantidad) || 0;
      const cu   = prod?.costo_unitario || 0;
      return { prod, qty, cu, subtotal: cu * qty };
    });
  }, [formData.items, productosMap]);

  const costoLiveServicios = useMemo(() => {
    return formData.servicios.map(srv => {
      const svc = productosMap[parseInt(srv.servicio_id)];
      return { svc, costo: svc?.precio_venta || svc?.costo_unitario || 0 };
    });
  }, [formData.servicios, productosMap]);

  const costoLiveTotal = useMemo(() =>
    costoLiveItems.reduce((s, i) => s + i.subtotal, 0) +
    costoLiveServicios.reduce((s, s2) => s + s2.costo, 0),
    [costoLiveItems, costoLiveServicios]
  );

  const porcionesNum = Math.max(1, parseInt(formData.porciones) || 1);
  const costoLivePorUnidad = costoLiveTotal / porcionesNum;
  const precioSugerido = parseFloat(formData.precio_sugerido) || 0;
  const margenPct = precioSugerido > 0 && costoLivePorUnidad > 0
    ? ((precioSugerido - costoLivePorUnidad) / precioSugerido * 100) : null;
  const margenColor = margenPct === null ? 'text.secondary'
    : margenPct >= 30 ? GREEN : margenPct >= 10 ? AMBER : RED;

  // ─── Handlers ──────────────────────────────────────────────────────────────
  const openEdit = (receta) => {
    setEditingReceta(receta);
    setFormData({
      producto_id:    receta.producto_id,
      nombre:         receta.nombre,
      descripcion:    receta.descripcion || '',
      porciones:      receta.porciones || 1,
      precio_sugerido: receta.precio_sugerido ? String(receta.precio_sugerido) : '',
      items:    receta.items.map(it => ({ insumo_id: it.insumo.id, cantidad: it.cantidad })),
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
    setFormData({ producto_id: '', nombre: '', descripcion: '', porciones: 1, precio_sugerido: '', servicios: [], items: [{ insumo_id: '', cantidad: '' }] });
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

  const removeItem = (i) => {
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
      toast.warning('Complete todos los campos requeridos');
      return;
    }
    setLoading(true);
    const payload = {
      nombre:         formData.nombre,
      descripcion:    formData.descripcion,
      producto_id:    parseInt(formData.producto_id),
      porciones:      parseInt(formData.porciones) || 1,
      precio_sugerido: parseFloat(formData.precio_sugerido) || null,
      servicios: formData.servicios
        .filter(s => s.servicio_id !== '')
        .map(s => ({ servicio_id: parseInt(s.servicio_id) })),
      items: formData.items.map(it => ({
        insumo_id: parseInt(it.insumo_id),
        cantidad:  parseFloat(it.cantidad),
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

  const handleDuplicate = async (receta) => {
    try {
      await createReceta({
        nombre:         `Copia de ${receta.nombre}`,
        producto_id:    receta.producto_id,
        descripcion:    receta.descripcion || '',
        porciones:      receta.porciones || 1,
        precio_sugerido: receta.precio_sugerido || null,
        servicios: receta.servicios_maquila.map(s => ({ servicio_id: s.servicio.id })),
        items:     receta.items.map(it => ({ insumo_id: it.insumo.id, cantidad: it.cantidad })),
      });
      toast.success(`Receta duplicada como "Copia de ${receta.nombre}"`);
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al duplicar la receta');
    }
  };

  const handleDeleteClick = (id) => { setItemToDelete(id); setShowConfirmDialog(true); };

  const handleExportCSV = () => {
    const rows = [
      ['Nombre', 'Producto Resultante', 'Porciones', 'Costo Lote', 'Costo/Unidad', 'Precio Sugerido', '# Insumos', '# Servicios'],
      ...sortedRecetas.map(r => [
        r.nombre, r.producto_resultante.nombre,
        r.porciones || 1, r.costoBatch.toFixed(2), r.costoPorUnidad.toFixed(2),
        r.precio_sugerido || '', r.items.length, r.servicios_maquila.length,
      ]),
    ];
    const csv = rows.map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'recetas.csv';
    a.click(); URL.revokeObjectURL(url);
  };

  const productosNoServicio = productos.filter(p => !p.es_servicio);
  const servicios = productos.filter(p => p.es_servicio);

  return (
    <Box sx={{ width: '100%' }}>
      {/* ── Header ── */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ width: 40, height: 40, borderRadius: 2, bgcolor: `${accentColor}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: accentColor }}>
            <Science />
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 700, fontSize: 20, lineHeight: 1.2 }}>Recetas de Producción</Typography>
            <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>Fórmulas (BOM), costos y rendimiento</Typography>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', width: isMobile ? '100%' : 'auto' }}>
          {sortedRecetas.length > 0 && (
            <Button variant="outlined" size="small" startIcon={<FileDownload />} onClick={handleExportCSV}
              sx={{ borderRadius: 2, fontWeight: 600, fontSize: 12, borderColor: 'divider', color: 'text.secondary' }}>
              CSV
            </Button>
          )}
          <Button variant="contained" startIcon={<Add />} onClick={() => setOpen(true)} fullWidth={isMobile}
            sx={{ background: `linear-gradient(135deg, ${accentColor}, #a78bfa)`, boxShadow: `0 4px 14px rgba(139,92,246,0.3)`, borderRadius: 2, fontWeight: 600 }}>
            Nueva Receta
          </Button>
        </Box>
      </Box>

      {/* ── KPIs ── */}
      <Grid container spacing={1.5} sx={{ mb: 3 }}>
        <Grid item xs={6} sm={3}>
          <KpiCard label="Total Recetas" value={recetasConCosto.length} color={accentColor} icon={<Science />} sub="fórmulas registradas" />
        </Grid>
        <Grid item xs={6} sm={3}>
          <KpiCard label="Costo Promedio/u" value={formatCurrency(costoPromedio)} color={CYAN} icon={<AttachMoney />} sub="por unidad producida" />
        </Grid>
        <Grid item xs={6} sm={3}>
          <KpiCard
            label="Receta más cara"
            value={recetaMasCara ? formatCurrency(recetaMasCara.costoPorUnidad) : '—'}
            color={RED}
            icon={<TrendingUp />}
            sub={recetaMasCara?.nombre || ''}
          />
        </Grid>
        <Grid item xs={6} sm={3}>
          <KpiCard
            label="Receta más barata"
            value={recetaMasBarata ? formatCurrency(recetaMasBarata.costoPorUnidad) : '—'}
            color={GREEN}
            icon={<TrendingDown />}
            sub={recetaMasBarata?.nombre || ''}
          />
        </Grid>
      </Grid>

      {/* ── Búsqueda ── */}
      <Box sx={{ display: 'flex', gap: 1.5, mb: 2.5, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField
          placeholder="Buscar receta o producto…"
          value={searchTerm}
          onChange={e => { setSearchTerm(e.target.value); setPage(0); }}
          size="small"
          sx={{ flex: 1, minWidth: 220, maxWidth: 420 }}
          InputProps={{ startAdornment: <InputAdornment position="start"><Search sx={{ color: 'text.secondary', fontSize: 20 }} /></InputAdornment> }}
        />
        {searchTerm && (
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {filteredRecetas.length} de {recetasConCosto.length}
          </Typography>
        )}
      </Box>

      {/* ── Lista ── */}
      {isMobile ? (
        <Box>
          {paginatedRecetas.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 6, color: 'text.secondary' }}>
              <Science sx={{ fontSize: 48, mb: 1, opacity: 0.3 }} />
              <Typography>{recetas.length === 0 ? 'No hay recetas registradas' : 'Sin resultados'}</Typography>
            </Box>
          ) : (
            paginatedRecetas.map(r => (
              <RecetaCard key={r.id} receta={r} onDelete={handleDeleteClick} onEdit={openEdit}
                onDuplicate={handleDuplicate} accentColor={accentColor} />
            ))
          )}
          {sortedRecetas.length > rowsPerPage && (
            <TablePagination component="div" count={sortedRecetas.length} page={page}
              onPageChange={(_, p) => setPage(p)} rowsPerPage={rowsPerPage}
              onRowsPerPageChange={e => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
              rowsPerPageOptions={[10, 15, 25, 50]}
              labelRowsPerPage="Filas:" labelDisplayedRows={({ from, to, count }) => `${from}-${to} de ${count}`} />
          )}
        </Box>
      ) : (
        <>
          <TableContainer sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider', overflowX: 'auto' }}>
            <Table size="small">
              <TableHead sx={{ bgcolor: 'action.hover' }}>
                <TableRow>
                  <SortTh col="nombre"   label="Nombre" />
                  <SortTh col="producto" label="Producto Resultante" />
                  <SortTh col="insumos"  label="Insumos" />
                  <TableCell sx={{ fontWeight: 600 }}>Servicios</TableCell>
                  <SortTh col="costo"    label="Costo/u" align="right" />
                  <TableCell sx={{ fontWeight: 600 }} align="center">Acciones</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {paginatedRecetas.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} sx={{ textAlign: 'center', py: 6, color: 'text.secondary' }}>
                      {recetas.length === 0 ? 'No hay recetas registradas' : 'Sin resultados para esta búsqueda'}
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedRecetas.map(r => (
                    <TableRow key={r.id} hover>
                      <TableCell sx={{ fontWeight: 600 }}>{r.nombre}</TableCell>
                      <TableCell>
                        <Chip label={r.producto_resultante.nombre} size="small"
                          sx={{ bgcolor: `${accentColor}12`, color: accentColor, fontWeight: 600, fontSize: 11, borderRadius: 1.5 }} />
                        {(r.porciones || 1) > 1 && (
                          <Typography sx={{ fontSize: 10, color: 'text.secondary', mt: 0.3 }}>× {r.porciones} uds</Typography>
                        )}
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
                        {r.servicios_maquila.length > 0 ? (
                          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                            {r.servicios_maquila.map(s => (
                              <Chip key={s.servicio.id} label={s.servicio.nombre} size="small"
                                sx={{ bgcolor: `${CYAN}10`, color: CYAN, fontSize: 10, borderRadius: 1 }} />
                            ))}
                          </Box>
                        ) : <Typography sx={{ fontSize: 12, color: 'text.disabled' }}>—</Typography>}
                      </TableCell>
                      <TableCell align="right">
                        <Typography sx={{ fontWeight: 700, color: r.costoPorUnidad > 0 ? RED : 'text.disabled', fontSize: 13 }}>
                          {r.costoPorUnidad > 0 ? formatCurrency(r.costoPorUnidad) : '—'}
                        </Typography>
                        {r.costoPorUnidad > 0 && r.precio_sugerido && (
                          <Typography sx={{ fontSize: 10, color: GREEN }}>
                            PV: {formatCurrency(r.precio_sugerido)}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell align="center">
                        <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
                          <Tooltip title="Duplicar receta">
                            <IconButton size="small" onClick={() => handleDuplicate(r)}
                              sx={{ color: AMBER, '&:hover': { bgcolor: `${AMBER}15` } }}>
                              <ContentCopy fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Editar receta">
                            <IconButton size="small" onClick={() => openEdit(r)}
                              sx={{ color: accentColor, '&:hover': { bgcolor: `${accentColor}15` } }}>
                              <Edit fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Eliminar receta">
                            <IconButton size="small" onClick={() => handleDeleteClick(r.id)}
                              sx={{ color: RED, '&:hover': { bgcolor: '#FEF2F2' } }}>
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
          <TablePagination component="div" count={sortedRecetas.length} page={page}
            onPageChange={(_, p) => setPage(p)} rowsPerPage={rowsPerPage}
            onRowsPerPageChange={e => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
            rowsPerPageOptions={[10, 15, 25, 50]}
            labelRowsPerPage="Filas:" labelDisplayedRows={({ from, to, count }) => `${from}-${to} de ${count}`} />
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* ── DIÁLOGO NUEVA / EDITAR RECETA ─────────────────────────────────── */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth fullScreen={isMobile}
        PaperProps={{ sx: { borderRadius: isMobile ? 0 : 3 } }}>
        <Box sx={{ height: 4, background: `linear-gradient(90deg, ${accentColor}, #a78bfa)` }} />
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{ width: 32, height: 32, borderRadius: 1.5, bgcolor: `${accentColor}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: accentColor }}>
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
          <IconButton size="small" onClick={handleClose}><Close fontSize="small" /></IconButton>
        </DialogTitle>

        <DialogContent dividers sx={{ p: isMobile ? 2 : 3 }}>
          {/* ── Información general ── */}
          <Typography sx={{ fontWeight: 600, fontSize: 11, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.6, mb: 1.5 }}>
            Información general
          </Typography>
          <Stack spacing={2} sx={{ mb: 3 }}>
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
                return opts.filter(o => o.nombre.toLowerCase().includes(q) || (o.codigo_barras || '').toLowerCase().includes(q));
              }}
              noOptionsText={
                <Box sx={{ py: 0.5 }}>
                  <Typography sx={{ fontSize: 13, color: 'text.secondary', mb: 1 }}>No se encontró ningún producto</Typography>
                  <Button size="small" variant="contained" fullWidth startIcon={<Add />}
                    onClick={() => openQuickCreate('producto', productoInput, 'resultante')}
                    sx={{ borderRadius: 2, fontWeight: 600, fontSize: 12, bgcolor: GREEN, '&:hover': { bgcolor: '#059669' } }}>
                    Crear "{productoInput || 'nuevo producto'}"
                  </Button>
                </Box>
              }
              renderOption={(props, option) => (
                <li {...props} key={option.id} style={{ padding: '10px 14px' }}>
                  <Typography sx={{ fontSize: 14, fontWeight: 600, lineHeight: 1.3 }}>{option.nombre}</Typography>
                  <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
                    {option.unidad_medida} · Stock: {option.stock_actual ?? 0}
                  </Typography>
                </li>
              )}
              renderInput={params => (
                <TextField {...params} label="Producto a Producir *" placeholder="Escribe para buscar por nombre…" fullWidth
                  InputProps={{ ...params.InputProps, endAdornment: (<>{params.InputProps.endAdornment}<Tooltip title="Crear nuevo producto resultante"><IconButton size="small" onClick={() => openQuickCreate('producto', productoInput, 'resultante')} sx={{ color: GREEN, p: 0.5 }}><Add fontSize="small" /></IconButton></Tooltip></>) }} />
              )}
              fullWidth ListboxProps={{ style: { maxHeight: 280 } }}
            />
            <TextField fullWidth label="Nombre de la Receta *" value={formData.nombre}
              onChange={e => setFormData({ ...formData, nombre: e.target.value })} required />
            <Grid container spacing={1.5}>
              <Grid item xs={12} sm={4}>
                <TextField fullWidth type="number" label="Porciones / Unidades que produce *"
                  value={formData.porciones}
                  onChange={e => setFormData({ ...formData, porciones: Math.max(1, parseInt(e.target.value) || 1) })}
                  inputProps={{ min: 1 }} size="small"
                  helperText="Ej: si produce 10 hamburguesas, escribe 10" />
              </Grid>
              <Grid item xs={12} sm={8}>
                <CurrencyField label="Precio de venta sugerido (opcional)" value={formData.precio_sugerido}
                  onChange={v => setFormData({ ...formData, precio_sugerido: v })}
                  helperText={margenPct !== null ? `Margen: ${margenPct.toFixed(1)}%` : 'Para calcular el margen'} />
              </Grid>
            </Grid>
          </Stack>

          {/* ── Servicios de Maquila ── */}
          <Box sx={{ mb: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
              <Typography sx={{ fontWeight: 600, fontSize: 11, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.6 }}>
                Servicios de Maquila
              </Typography>
              <Button size="small" startIcon={<Add />} onClick={addServicio}
                sx={{ color: CYAN, fontWeight: 600, fontSize: 12 }}>
                Añadir servicio
              </Button>
            </Box>
            {formData.servicios.length === 0 && (
              <Typography sx={{ fontSize: 13, color: 'text.secondary', fontStyle: 'italic' }}>Sin servicios asociados</Typography>
            )}
            <Stack spacing={1}>
              {formData.servicios.map((srv, idx) => (
                <Box key={idx} sx={{ display: 'flex', gap: 1.5, alignItems: 'center', p: 1.5, borderRadius: 2, bgcolor: 'action.hover', border: '1px solid', borderColor: 'divider' }}>
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
                        {(option.precio_venta || option.costo_unitario) > 0 && (
                          <Typography sx={{ fontSize: 11, color: CYAN }}>{formatCurrency(option.precio_venta || option.costo_unitario)}</Typography>
                        )}
                      </li>
                    )}
                    renderInput={params => <TextField {...params} label="Servicio" size="small" placeholder="Escribe para buscar…" fullWidth />}
                    fullWidth sx={{ flex: 1 }} size="small" noOptionsText="Sin resultados" ListboxProps={{ style: { maxHeight: 220 } }}
                  />
                  {costoLiveServicios[idx]?.costo > 0 && (
                    <Typography sx={{ fontSize: 11, fontWeight: 700, color: CYAN, whiteSpace: 'nowrap' }}>
                      {formatCurrency(costoLiveServicios[idx].costo)}
                    </Typography>
                  )}
                  <Tooltip title="Quitar">
                    <IconButton size="small" onClick={() => removeServicio(idx)}
                      sx={{ color: RED, bgcolor: '#FEF2F2', borderRadius: 1.5, flexShrink: 0 }}>
                      <Delete fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>
              ))}
            </Stack>
          </Box>

          <Divider sx={{ mb: 3 }} />

          {/* ── Ingredientes / Insumos ── */}
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
              <Typography sx={{ fontWeight: 600, fontSize: 11, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.6 }}>
                Ingredientes / Insumos (por lote)
              </Typography>
              <Button size="small" startIcon={<Add />} onClick={addItem}
                sx={{ color: accentColor, fontWeight: 600, fontSize: 12 }}>
                Añadir insumo
              </Button>
            </Box>
            <Stack spacing={1.5}>
              {formData.items.map((item, idx) => (
                <Box key={idx} sx={{ p: 1.5, borderRadius: 2, bgcolor: 'action.hover', border: '1px solid', borderColor: 'divider' }}>
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
                      return opts.filter(o => o.nombre.toLowerCase().includes(q) || (o.codigo_barras || '').toLowerCase().includes(q));
                    }}
                    noOptionsText={
                      <Box sx={{ py: 0.5 }}>
                        <Typography sx={{ fontSize: 13, color: 'text.secondary', mb: 1 }}>No se encontró ningún insumo</Typography>
                        <Button size="small" variant="contained" fullWidth startIcon={<Add />}
                          onClick={() => openQuickCreate('producto', insumoInputs[idx] || '', idx)}
                          sx={{ borderRadius: 2, fontWeight: 600, fontSize: 12, bgcolor: GREEN, '&:hover': { bgcolor: '#059669' } }}>
                          Crear "{insumoInputs[idx] || 'nuevo insumo'}"
                        </Button>
                      </Box>
                    }
                    renderOption={(props, option) => (
                      <li {...props} key={option.id} style={{ padding: '10px 14px' }}>
                        <Typography sx={{ fontSize: 14, fontWeight: 600, lineHeight: 1.3 }}>{option.nombre}</Typography>
                        <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
                          Stock: {option.stock_actual ?? 0} {option.unidad_medida}
                          {option.costo_unitario > 0 && ` · Costo: ${formatCurrency(option.costo_unitario)}`}
                        </Typography>
                      </li>
                    )}
                    renderInput={params => (
                      <TextField {...params} label="Insumo (busca por nombre)" size="small" placeholder="Escribe para buscar…" fullWidth
                        InputProps={{ ...params.InputProps, endAdornment: (<>{params.InputProps.endAdornment}<Tooltip title="Crear nuevo insumo"><IconButton size="small" onClick={() => openQuickCreate('producto', insumoInputs[idx] || '', idx)} sx={{ color: GREEN, p: 0.5 }}><Add fontSize="small" /></IconButton></Tooltip></>) }} />
                    )}
                    fullWidth sx={{ width: '100%', mb: 1 }} size="small" ListboxProps={{ style: { maxHeight: 240 } }}
                  />
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                    <Box sx={{ flex: 1 }}>
                      <TextField type="number" label="Cantidad" size="small" value={item.cantidad}
                        onChange={e => handleItemChange(idx, 'cantidad', e.target.value)}
                        fullWidth InputProps={{ inputProps: { min: 0, step: 'any' } }} />
                      {costoLiveItems[idx]?.cu > 0 && costoLiveItems[idx]?.qty > 0 && (
                        <Typography sx={{ fontSize: 11, color: 'text.secondary', mt: 0.5 }}>
                          {formatCurrency(costoLiveItems[idx].cu)} × {costoLiveItems[idx].qty} ={' '}
                          <Box component="span" sx={{ fontWeight: 700, color: RED }}>
                            {formatCurrency(costoLiveItems[idx].subtotal)}
                          </Box>
                        </Typography>
                      )}
                    </Box>
                    <Tooltip title="Quitar">
                      <span>
                        <IconButton size="small" onClick={() => removeItem(idx)} disabled={formData.items.length === 1}
                          sx={{ color: RED, bgcolor: '#FEF2F2', borderRadius: 1.5, flexShrink: 0, mt: 0.3, '&.Mui-disabled': { opacity: 0.3 } }}>
                          <Delete fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </Box>
                </Box>
              ))}
            </Stack>
          </Box>

          {/* ── Cost Summary Panel ── */}
          {costoLiveTotal > 0 && (
            <Paper sx={{ p: 2, borderRadius: 2, bgcolor: `${accentColor}08`, border: `1px solid ${accentColor}20`, mt: 2.5 }}>
              <Typography sx={{ fontSize: 11, fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.6, mb: 1.5 }}>
                Resumen de Costos
              </Typography>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>Costo total del lote</Typography>
                <Typography sx={{ fontSize: 13, fontWeight: 700 }}>{formatCurrency(costoLiveTotal)}</Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>Porciones / Unidades</Typography>
                <Typography sx={{ fontSize: 13, fontWeight: 700 }}>÷ {porcionesNum}</Typography>
              </Box>
              <Divider sx={{ my: 1 }} />
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography sx={{ fontSize: 14, fontWeight: 700 }}>Costo por Unidad</Typography>
                <Typography sx={{ fontSize: 17, fontWeight: 800, color: RED }}>{formatCurrency(costoLivePorUnidad)}</Typography>
              </Box>
              {margenPct !== null && (
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
                  <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>Margen con precio sugerido</Typography>
                  <Typography sx={{ fontSize: 13, fontWeight: 700, color: margenColor }}>
                    {margenPct.toFixed(1)}% {margenPct >= 30 ? '✓' : margenPct >= 10 ? '⚠' : '✗'}
                  </Typography>
                </Box>
              )}
            </Paper>
          )}
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
          <Button onClick={handleClose} variant="outlined" fullWidth={isMobile}
            sx={{ borderRadius: 2, fontWeight: 600, borderColor: 'divider', color: 'text.secondary' }}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} variant="contained" disabled={loading} fullWidth={isMobile}
            sx={{ background: `linear-gradient(135deg, ${accentColor}, #a78bfa)`, boxShadow: `0 4px 14px rgba(139,92,246,0.3)`, borderRadius: 2, fontWeight: 600 }}>
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
            toast.error(err.response?.data?.detail || 'Error al eliminar la receta', { autoClose: 7000 });
          } finally {
            setShowConfirmDialog(false);
          }
        }}
        title="Eliminar Receta"
        message="¿Estás seguro de que quieres eliminar esta receta? Esta acción no se puede deshacer."
      />

      <QuickCreateModal open={quickCreate.open} onClose={closeQuickCreate} type={quickCreate.type}
        initialName={quickCreate.initialName} onCreated={handleQuickCreated} />
    </Box>
  );
};

export default Recetas;
