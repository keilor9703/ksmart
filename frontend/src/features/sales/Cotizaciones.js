import React, { useState, useEffect, useMemo } from 'react';
import {
  Box, Paper, Typography, Tabs, Tab, TextField, Button, Grid,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  IconButton, Chip, Tooltip, InputAdornment, Divider, useTheme,
  useMediaQuery, Autocomplete, Dialog, DialogTitle, DialogContent,
  DialogActions, MenuItem, Stack, TablePagination, Alert
} from '@mui/material';
import {
  Description, Add, Delete, Visibility, Transform, Search,
  CheckCircle, Cancel, HourglassEmpty, AddCircleOutline,
  RemoveCircleOutline, Close, AttachMoney, Receipt
} from '@mui/icons-material';
import apiClient from '../../api';
import { formatCurrency } from '../../utils/formatters';
import { toast } from 'react-toastify';
import QuickCreateModal from '../../components/common/QuickCreateModal';

// ─── Palette ─────────────────────────────────────────────────────────────────
const TEAL   = '#0D9488';
const GREEN  = '#10B981';
const YELLOW = '#F59E0B';
const RED    = '#EF4444';
const BLUE   = '#3B82F6';
const GRAY   = '#64748B';

// ─── Estado de cotización ─────────────────────────────────────────────────────
const ESTADO_CONFIG = {
  vigente:    { label: 'Vigente',    color: 'success', icon: <CheckCircle sx={{ fontSize: 14 }} /> },
  vencida:    { label: 'Vencida',    color: 'error',   icon: <Cancel sx={{ fontSize: 14 }} /> },
  convertida: { label: 'Convertida', color: 'info',    icon: <Transform sx={{ fontSize: 14 }} /> },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
// Reemplaza fmtDate y fmtDateTime con esto:
const parseUTC = (val) => {
  if (!val) return null;
  // Fuerza interpretación UTC si el string no trae info de zona
  const s = typeof val === 'string' && !val.endsWith('Z') && !val.includes('+')
    ? val + 'Z'
    : val;
  return new Date(s);
};

const fmtDate = (val) => {
  const d = parseUTC(val);
  if (!d) return '—';
  return d.toLocaleDateString('es-CO', {
    timeZone: 'America/Bogota',
    day: '2-digit', month: 'short', year: 'numeric'
  });
};

const fmtDateTime = (val) => {
  const d = parseUTC(val);
  if (!d) return '—';
  return d.toLocaleString('es-CO', {
    timeZone: 'America/Bogota',
    day: '2-digit', month: 'short',
    hour: '2-digit', minute: '2-digit', hour12: true
  });
};
function TabPanel({ children, value, index }) {
  return (
    <div role="tabpanel" hidden={value !== index}>
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
}

const EstadoChip = ({ estado }) => {
  const cfg = ESTADO_CONFIG[estado] || { label: estado, color: 'default' };
  return (
    <Chip
      label={cfg.label}
      color={cfg.color}
      size="small"
      icon={cfg.icon}
      sx={{ fontWeight: 700, fontSize: 11, borderRadius: 1.5, pl: 0.5 }}
    />
  );
};

const KpiCard = ({ label, value, icon, color }) => (
  <Paper sx={{ p: 2.5, borderRadius: 3, display: 'flex', alignItems: 'center', gap: 2, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
    <Box sx={{ width: 44, height: 44, borderRadius: 2, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: `${color}18`, color }}>
      {icon}
    </Box>
    <Box>
      <Typography sx={{ fontSize: 12, color: 'text.secondary', fontWeight: 500 }}>{label}</Typography>
      <Typography sx={{ fontSize: 18, fontWeight: 700 }}>{value}</Typography>
    </Box>
  </Paper>
);

// ─── Fila de producto en el formulario ────────────────────────────────────────
const DetalleRow = ({ det, idx, productos, productoInput, onProductoInputChange, onProductChange, onFieldChange, onRemove, isMobile, openQuickCreate }) => {
  const subtotal = det.cantidad * det.precio_unitario;
  const prodSel  = productos.find(p => p.id === parseInt(det.producto_id)) || null;

  return (
    <Box sx={{ mb: 1.5, p: 1.5, borderRadius: 2, bgcolor: 'action.hover', border: '1px solid', borderColor: 'divider' }}>
      <Box sx={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'stretch' : 'center', gap: 1.5 }}>
        <Autocomplete
          options={productos}
          getOptionLabel={p => p?.nombre || ''}
          value={prodSel}
          onChange={(_, v) => onProductChange(idx, v)}
          inputValue={productoInput}
          onInputChange={(_, v) => onProductoInputChange(idx, v)}
          filterOptions={(opts, state) => {
            const q = (state.inputValue || '').toLowerCase().trim();
            return q ? opts.filter(o => o.nombre.toLowerCase().includes(q)) : opts;
          }}
          noOptionsText={
            <Box sx={{ py: 0.5 }}>
              <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 1 }}>Sin resultados</Typography>
              <Button size="small" variant="contained" fullWidth startIcon={<Add />}
                onClick={() => openQuickCreate(productoInput || '', idx)}
                sx={{ borderRadius: 2, fontWeight: 600, fontSize: 12, bgcolor: TEAL }}>
                Crear "{productoInput}"
              </Button>
            </Box>
          }
          renderOption={(props, option) => (
            <li {...props} key={option.id}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%', gap: 2 }}>
                <span style={{ fontSize: 13.5 }}>{option.nombre}</span>
                <Typography variant="caption" color="text.secondary">
                  {option.es_servicio ? 'Servicio' : `Stock: ${option.stock_actual ?? 0}`}
                </Typography>
              </Box>
            </li>
          )}
          renderInput={params => <TextField {...params} label="Producto / Servicio" size="small" placeholder="Buscar…" />}
          sx={{ flex: 1, minWidth: isMobile ? '100%' : 200 }}
        />
        <TextField
          type="number" label="Cantidad" size="small"
          value={det.cantidad}
          onChange={e => onFieldChange(idx, 'cantidad', parseFloat(e.target.value) || 1)}
          InputProps={{ inputProps: { min: 0.01, step: 'any' } }}
          sx={{ width: isMobile ? '100%' : 100 }}
        />
        <TextField
          type="number" label="Precio unit." size="small"
          value={det.precio_unitario}
          onChange={e => onFieldChange(idx, 'precio_unitario', parseFloat(e.target.value) || 0)}
          InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
          sx={{ width: isMobile ? '100%' : 140 }}
        />
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography sx={{ fontWeight: 700, fontSize: 14, color: TEAL, minWidth: 80 }}>
            {formatCurrency(subtotal)}
          </Typography>
          <Tooltip title="Quitar">
            <span>
              <IconButton size="small" onClick={() => onRemove(idx)}
                sx={{ color: RED, bgcolor: '#FEF2F2', borderRadius: 1.5 }}>
                <RemoveCircleOutline fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        </Box>
      </Box>
    </Box>
  );
};

// ─── Componente principal ──────────────────────────────────────────────────────
const Cotizaciones = () => {
  const theme    = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [tab, setTab] = useState(0);
  const [cotizaciones, setCotizaciones] = useState([]);
  const [clientes, setClientes]         = useState([]);
  const [productos, setProductos]       = useState([]);
  const [loading, setLoading]           = useState(false);

  // Form state
  const [clienteSel, setClienteSel]     = useState(null);
  const [clienteInput, setClienteInput] = useState('');
  const [ivaPorcentaje, setIvaPorcentaje] = useState(0);
  const [validaHasta, setValidaHasta]   = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [detalles, setDetalles] = useState([
    { producto_id: '', cantidad: 1, precio_unitario: 0 }
  ]);
  const [productoInputs, setProductoInputs] = useState(['']);

  // QuickCreate
  const [quickCreate, setQuickCreate] = useState({ open: false, initialName: '', targetIdx: null });

  // Convertir modal
  const [convertirModal, setConvertirModal] = useState({ open: false, cotizacion: null });
  const [convertirPagada, setConvertirPagada] = useState(true);
  const [convertirMetodo, setConvertirMetodo] = useState('Efectivo');
  const [convertirLoading, setConvertirLoading] = useState(false);

  // Detail modal
  const [detailModal, setDetailModal] = useState({ open: false, cot: null });

  // Filters + pagination
  const [searchTerm, setSearchTerm]   = useState('');
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [page, setPage]               = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    try {
      const [cotRes, cliRes, prodRes] = await Promise.all([
        apiClient.get('/cotizaciones/'),
        apiClient.get('/clientes/'),
        apiClient.get('/productos/'),
      ]);
      setCotizaciones(cotRes.data);
      setClientes(cliRes.data.filter(c => c.es_cliente));
      setProductos(prodRes.data.filter(p => p.es_servicio || p.grupo_item === 2));
    } catch {
      toast.error('Error cargando cotizaciones');
    }
  };

  // ── Form helpers ──────────────────────────────────────────────────────────
  const resetForm = () => {
    setClienteSel(null); setClienteInput('');
    setIvaPorcentaje(0); setValidaHasta(''); setObservaciones('');
    setDetalles([{ producto_id: '', cantidad: 1, precio_unitario: 0 }]);
    setProductoInputs(['']);
  };

  const addDetalle = () => {
    setDetalles(p => [...p, { producto_id: '', cantidad: 1, precio_unitario: 0 }]);
    setProductoInputs(p => [...p, '']);
  };

  const removeDetalle = (idx) => {
    setDetalles(p => p.filter((_, i) => i !== idx));
    setProductoInputs(p => p.filter((_, i) => i !== idx));
  };

  const handleProductChange = (idx, newVal) => {
    setDetalles(p => p.map((d, i) => i === idx
      ? { ...d, producto_id: newVal?.id || '', precio_unitario: newVal?.precio || 0 }
      : d
    ));
  };

  const handleFieldChange = (idx, field, val) =>
    setDetalles(p => p.map((d, i) => i === idx ? { ...d, [field]: val } : d));

  const handleProductoInputChange = (idx, val) =>
    setProductoInputs(p => { const n = [...p]; n[idx] = val; return n; });

  const openQuickCreate = (initialName, targetIdx) =>
    setQuickCreate({ open: true, initialName, targetIdx });

  const handleQuickCreated = (nuevo) => {
    setProductos(prev => [...prev, nuevo]);
    if (quickCreate.targetIdx !== null) {
      handleProductChange(quickCreate.targetIdx, nuevo);
      handleProductoInputChange(quickCreate.targetIdx, nuevo.nombre);
    }
    setQuickCreate(q => ({ ...q, open: false }));
  };

  const calcTotal = () => detalles.reduce((s, d) => s + d.cantidad * d.precio_unitario, 0);

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!clienteSel) { toast.warning('Selecciona un cliente.'); return; }
    if (detalles.some(d => !d.producto_id || d.cantidad <= 0)) {
      toast.warning('Todos los ítems deben tener producto y cantidad válida.');
      return;
    }

    setLoading(true);
    try {
      await apiClient.post('/cotizaciones/', {
        cliente_id:     clienteSel.id,
        detalles:       detalles.map(d => ({
          producto_id:     parseInt(d.producto_id),
          cantidad:        parseFloat(d.cantidad),
          precio_unitario: parseFloat(d.precio_unitario),
        })),
        iva_porcentaje: parseFloat(ivaPorcentaje) || 0,
        valida_hasta:   validaHasta ? new Date(validaHasta + 'T23:59:59').toISOString() : null,
        observaciones:  observaciones || null,
      });
      toast.success('Cotización creada correctamente.');
      resetForm();
      fetchAll();
      setTab(1);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al crear la cotización.');
    } finally {
      setLoading(false);
    }
  };

  // ── Convertir ─────────────────────────────────────────────────────────────
  const handleConvertir = async () => {
    if (!convertirModal.cotizacion) return;
    setConvertirLoading(true);
    try {
      await apiClient.post(`/cotizaciones/${convertirModal.cotizacion.id}/convertir`, {
        pagada:      convertirPagada,
        metodo_pago: convertirPagada ? convertirMetodo : null,
      });
      toast.success('¡Cotización convertida a venta exitosamente!');
      setConvertirModal({ open: false, cotizacion: null });
      fetchAll();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al convertir la cotización.');
    } finally {
      setConvertirLoading(false);
    }
  };

  // ── Eliminar ──────────────────────────────────────────────────────────────
  const handleEliminar = async (id) => {
    if (!window.confirm('¿Eliminar esta cotización?')) return;
    try {
      await apiClient.delete(`/cotizaciones/${id}`);
      toast.success('Cotización eliminada.');
      fetchAll();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al eliminar.');
    }
  };

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const vigentes    = cotizaciones.filter(c => c.estado_cotizacion === 'vigente');
  const convertidas = cotizaciones.filter(c => c.estado_cotizacion === 'convertida');
  const totalVigente = vigentes.reduce((s, c) => s + c.total, 0);

  // ── Filtros ───────────────────────────────────────────────────────────────
  const filtradas = useMemo(() => {
    return cotizaciones.filter(c => {
      const matchSearch = !searchTerm ||
        (c.cliente?.nombre || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchEstado = filtroEstado === 'todos' || c.estado_cotizacion === filtroEstado;
      return matchSearch && matchEstado;
    });
  }, [cotizaciones, searchTerm, filtroEstado]);

  const paginadas = filtradas.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <Box sx={{ width: '100%' }}>

      {/* ── Header ── */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ width: 40, height: 40, borderRadius: 2, bgcolor: `${TEAL}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: TEAL }}>
            <Description />
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 700, fontSize: 20, lineHeight: 1.2 }}>Cotizaciones</Typography>
            <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>Proformas y presupuestos convertibles a venta</Typography>
          </Box>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddCircleOutline />}
          onClick={() => { resetForm(); setTab(0); }}
          sx={{ bgcolor: TEAL, '&:hover': { bgcolor: '#0F766E' }, borderRadius: 2, fontWeight: 600, boxShadow: `0 4px 14px ${TEAL}40` }}
        >
          Nueva Cotización
        </Button>
      </Box>

      {/* ── KPIs ── */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={4}>
          <KpiCard label="Total registradas" value={cotizaciones.length} icon={<Receipt />} color={TEAL} />
        </Grid>
        <Grid item xs={12} sm={4}>
          <KpiCard label="Vigentes" value={vigentes.length} icon={<HourglassEmpty />} color={YELLOW} />
        </Grid>
        <Grid item xs={12} sm={4}>
          <KpiCard label="Valor cotizaciones vigentes" value={formatCurrency(totalVigente)} icon={<AttachMoney />} color={GREEN} />
        </Grid>
      </Grid>

      {/* ── Tabs ── */}
      <Paper sx={{ borderRadius: 3, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          sx={{
            px: 2, borderBottom: '1px solid', borderColor: 'divider',
            '& .MuiTab-root': { fontWeight: 600, fontSize: 13, textTransform: 'none', minHeight: 52 },
            '& .MuiTabs-indicator': { backgroundColor: TEAL, height: 3, borderRadius: 3 },
            '& .Mui-selected': { color: `${TEAL} !important` },
          }}
        >
          <Tab label="➕ Nueva Cotización" />
          <Tab label={`📋 Historial (${cotizaciones.length})`} />
        </Tabs>

        {/* ══ TAB 0: FORMULARIO ══ */}
        <TabPanel value={tab} index={0}>
          <Box sx={{ p: { xs: 2, md: 3 } }}>

            {/* Info */}
            <Alert severity="info" sx={{ mb: 3, borderRadius: 2 }}>
              Las cotizaciones <strong>no descuentan stock</strong> ni crean movimientos de inventario.
              Cuando el cliente acepte, usa "Convertir a Venta" para cerrar la operación.
            </Alert>

            {/* Cliente */}
            <Box sx={{ mb: 3 }}>
              <Typography sx={{ fontWeight: 600, fontSize: 12, mb: 1.5, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.6 }}>
                Cliente
              </Typography>
              <Autocomplete
                options={clientes}
                getOptionLabel={o => o?.nombre || ''}
                value={clienteSel}
                onChange={(_, v) => setClienteSel(v)}
                inputValue={clienteInput}
                onInputChange={(_, v) => setClienteInput(v)}
                filterOptions={(opts, state) => {
                  const q = (state.inputValue || '').toLowerCase().trim();
                  return q ? opts.filter(o => o.nombre.toLowerCase().includes(q) || (o.cedula || '').includes(q)) : opts;
                }}
                renderOption={(props, option) => (
                  <li {...props} key={option.id} style={{ padding: '8px 12px' }}>
                    <Box>
                      <Typography sx={{ fontSize: 14, fontWeight: 600 }}>{option.nombre}</Typography>
                      <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{option.cedula || 'Sin NIT/CC'}</Typography>
                    </Box>
                  </li>
                )}
                renderInput={params => (
                  <TextField {...params} label="Seleccionar cliente" required fullWidth placeholder="Busca por nombre o NIT…" />
                )}
              />
            </Box>

            {/* Ítems */}
            <Box sx={{ mb: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography sx={{ fontWeight: 600, fontSize: 12, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.6 }}>
                  Productos / Servicios
                </Typography>
                <Button size="small" startIcon={<AddCircleOutline />} onClick={addDetalle}
                  sx={{ color: TEAL, fontWeight: 600 }}>
                  Añadir ítem
                </Button>
              </Box>
              {detalles.map((det, idx) => (
                <DetalleRow
                  key={idx}
                  det={det}
                  idx={idx}
                  productos={productos}
                  productoInput={productoInputs[idx] || ''}
                  onProductoInputChange={handleProductoInputChange}
                  onProductChange={handleProductChange}
                  onFieldChange={handleFieldChange}
                  onRemove={removeDetalle}
                  isMobile={isMobile}
                  openQuickCreate={openQuickCreate}
                />
              ))}
            </Box>

            <Divider sx={{ mb: 3 }} />

            {/* Configuración */}
            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth label="% IVA Global" type="number"
                  value={ivaPorcentaje}
                  onChange={e => setIvaPorcentaje(e.target.value)}
                  helperText="Incluido en el total"
                  size="small"
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth label="Válida hasta (opcional)" type="date"
                  InputLabelProps={{ shrink: true }}
                  value={validaHasta}
                  onChange={e => setValidaHasta(e.target.value)}
                  inputProps={{ min: new Date().toLocaleDateString('en-CA') }}
                  size="small"
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <Paper sx={{ p: 2, borderRadius: 2, textAlign: 'center', bgcolor: `${TEAL}0D`, border: `1.5px dashed ${TEAL}60`, boxShadow: 'none', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>Total Cotización</Typography>
                  <Typography sx={{ fontSize: 22, fontWeight: 800, color: TEAL }}>
                    {formatCurrency(calcTotal())}
                  </Typography>
                </Paper>
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth multiline rows={2}
                  label="Notas u observaciones (opcional)"
                  value={observaciones}
                  onChange={e => setObservaciones(e.target.value)}
                  placeholder="Ej: Incluye instalación, válido para 2 unidades mínimo…"
                  size="small"
                />
              </Grid>
            </Grid>

            <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                variant="contained" size="large"
                onClick={handleSubmit} disabled={loading}
                startIcon={<Description />}
                sx={{ bgcolor: TEAL, '&:hover': { bgcolor: '#0F766E' }, borderRadius: 2, fontWeight: 700, px: 4, boxShadow: `0 4px 14px ${TEAL}40` }}
              >
                {loading ? 'Creando…' : 'Crear Cotización'}
              </Button>
            </Box>
          </Box>
        </TabPanel>

        {/* ══ TAB 1: HISTORIAL ══ */}
        <TabPanel value={tab} index={1}>
          <Box sx={{ px: { xs: 2, md: 3 }, pb: 3 }}>

            {/* Filtros */}
            <Box sx={{ mb: 2.5, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <TextField
                placeholder="Buscar por cliente…"
                value={searchTerm}
                onChange={e => { setSearchTerm(e.target.value); setPage(0); }}
                InputProps={{ startAdornment: <InputAdornment position="start"><Search sx={{ fontSize: 20, color: 'text.secondary' }} /></InputAdornment> }}
                sx={{ flex: 1, minWidth: 200 }}
                size="small"
              />
              <TextField
                select label="Estado" value={filtroEstado}
                onChange={e => { setFiltroEstado(e.target.value); setPage(0); }}
                sx={{ minWidth: 160 }}
                size="small"
              >
                <MenuItem value="todos">Todos</MenuItem>
                <MenuItem value="vigente">Vigentes</MenuItem>
                <MenuItem value="vencida">Vencidas</MenuItem>
                <MenuItem value="convertida">Convertidas</MenuItem>
              </TextField>
            </Box>

            {isMobile ? (
              /* ─ Mobile cards ─ */
              <Box>
                {paginadas.length === 0
                  ? <Box sx={{ textAlign: 'center', py: 6, color: 'text.secondary' }}>
                      <Description sx={{ fontSize: 48, mb: 1, opacity: 0.3 }} />
                      <Typography>No se encontraron cotizaciones</Typography>
                    </Box>
                  : paginadas.map(c => (
                      <Paper key={c.id} sx={{ p: 2.5, mb: 2, borderRadius: 3, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
                          <Box>
                            <Typography sx={{ fontWeight: 700, fontSize: 15 }}>{c.cliente?.nombre || 'N/A'}</Typography>
                            <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
                              #{c.id} · {fmtDateTime(c.fecha)}
                            </Typography>
                          </Box>
                          <EstadoChip estado={c.estado_cotizacion} />
                        </Box>
                        <Divider sx={{ my: 1.5 }} />
                        <Grid container spacing={1} sx={{ mb: 1.5 }}>
                          {[
                            { label: 'Total',       val: formatCurrency(c.total) },
                            { label: 'Válida hasta', val: fmtDate(c.valida_hasta) },
                            { label: 'Ítems',        val: c.detalles?.length || 0 },
                          ].map(({ label, val }) => (
                            <Grid item xs={4} key={label}>
                              <Box sx={{ textAlign: 'center', p: 1, borderRadius: 2, bgcolor: 'action.hover' }}>
                                <Typography sx={{ fontSize: 10, color: 'text.secondary', mb: 0.2 }}>{label}</Typography>
                                <Typography sx={{ fontSize: 12, fontWeight: 700 }}>{val}</Typography>
                              </Box>
                            </Grid>
                          ))}
                        </Grid>
                        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                          <Tooltip title="Ver detalle">
                            <IconButton size="small" onClick={() => setDetailModal({ open: true, cot: c })}
                              sx={{ color: BLUE, bgcolor: '#EFF6FF', borderRadius: 1.5 }}>
                              <Visibility fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          {c.estado_cotizacion === 'vigente' && (
                            <Tooltip title="Convertir a venta">
                              <IconButton size="small"
                                onClick={() => { setConvertirModal({ open: true, cotizacion: c }); setConvertirPagada(true); setConvertirMetodo('Efectivo'); }}
                                sx={{ color: GREEN, bgcolor: '#ECFDF5', borderRadius: 1.5 }}>
                                <Transform fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                          {c.estado_cotizacion !== 'convertida' && (
                            <Tooltip title="Eliminar">
                              <IconButton size="small" onClick={() => handleEliminar(c.id)}
                                sx={{ color: RED, bgcolor: '#FEF2F2', borderRadius: 1.5 }}>
                                <Delete fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                        </Box>
                      </Paper>
                    ))
                }
              </Box>
            ) : (
              /* ─ Desktop table ─ */
              <TableContainer sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                <Table size="small">
                  <TableHead sx={{ bgcolor: 'action.hover' }}>
                    <TableRow>
                      {['#', 'Cliente', 'Total', 'Creada', 'Válida Hasta', 'Estado', 'Acciones'].map(h => (
                        <TableCell key={h} sx={{ fontWeight: 700 }}>{h}</TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {paginadas.length === 0
                      ? <TableRow>
                          <TableCell colSpan={7} sx={{ textAlign: 'center', py: 6, color: 'text.secondary' }}>
                            No se encontraron cotizaciones
                          </TableCell>
                        </TableRow>
                      : paginadas.map(c => (
                          <TableRow key={c.id} hover>
                            <TableCell sx={{ fontWeight: 600, color: 'text.secondary', fontSize: 12 }}>#{c.id}</TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>{c.cliente?.nombre || 'N/A'}</TableCell>
                            <TableCell sx={{ fontWeight: 700, color: TEAL }}>{formatCurrency(c.total)}</TableCell>
                            <TableCell sx={{ fontSize: 12, color: 'text.secondary' }}>{fmtDateTime(c.fecha)}</TableCell>
                            <TableCell sx={{ fontSize: 12, color: c.estado_cotizacion === 'vencida' ? RED : 'text.secondary' }}>
                              {fmtDate(c.valida_hasta)}
                            </TableCell>
                            <TableCell><EstadoChip estado={c.estado_cotizacion} /></TableCell>
                            <TableCell>
                              <Box sx={{ display: 'flex', gap: 0.5 }}>
                                <Tooltip title="Ver detalle">
                                  <IconButton size="small" onClick={() => setDetailModal({ open: true, cot: c })}
                                    sx={{ color: BLUE, '&:hover': { bgcolor: '#EFF6FF' } }}>
                                    <Visibility fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                                {c.estado_cotizacion === 'vigente' && (
                                  <Tooltip title="Convertir a venta">
                                    <IconButton size="small"
                                      onClick={() => { setConvertirModal({ open: true, cotizacion: c }); setConvertirPagada(true); setConvertirMetodo('Efectivo'); }}
                                      sx={{ color: GREEN, '&:hover': { bgcolor: '#ECFDF5' } }}>
                                      <Transform fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                )}
                                {c.estado_cotizacion !== 'convertida' && (
                                  <Tooltip title="Eliminar">
                                    <IconButton size="small" onClick={() => handleEliminar(c.id)}
                                      sx={{ color: RED, '&:hover': { bgcolor: '#FEF2F2' } }}>
                                      <Delete fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                )}
                              </Box>
                            </TableCell>
                          </TableRow>
                        ))
                    }
                  </TableBody>
                </Table>
              </TableContainer>
            )}

            <TablePagination
              rowsPerPageOptions={[10, 25, 50]}
              component="div"
              count={filtradas.length}
              rowsPerPage={rowsPerPage}
              page={page}
              onPageChange={(_, p) => setPage(p)}
              onRowsPerPageChange={e => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
              labelRowsPerPage="Filas:"
              labelDisplayedRows={({ from, to, count }) => `${from}–${to} de ${count}`}
            />
          </Box>
        </TabPanel>
      </Paper>

      {/* ══ MODAL: Detalle cotización ══ */}
      <Dialog open={detailModal.open} onClose={() => setDetailModal({ open: false, cot: null })}
        maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography sx={{ fontWeight: 700, fontSize: 17 }}>Cotización #{detailModal.cot?.id}</Typography>
            <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{detailModal.cot?.cliente?.nombre}</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <EstadoChip estado={detailModal.cot?.estado_cotizacion} />
            <IconButton size="small" onClick={() => setDetailModal({ open: false, cot: null })}><Close fontSize="small" /></IconButton>
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          {detailModal.cot && (
            <>
              <Grid container spacing={2} sx={{ mb: 3 }}>
                {[
                  { label: 'Creada',       val: fmtDateTime(detailModal.cot.fecha) },
                  { label: 'Válida hasta', val: fmtDate(detailModal.cot.valida_hasta) },
                  { label: 'IVA',          val: `${detailModal.cot.iva_porcentaje || 0}%` },
                ].map(({ label, val }) => (
                  <Grid item xs={12} sm={4} key={label}>
                    <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: 'action.hover' }}>
                      <Typography sx={{ fontSize: 11, color: 'text.secondary', mb: 0.3 }}>{label}</Typography>
                      <Typography sx={{ fontWeight: 600, fontSize: 14 }}>{val}</Typography>
                    </Box>
                  </Grid>
                ))}
              </Grid>

              {detailModal.cot.observaciones && (
                <Alert severity="info" sx={{ mb: 2.5, borderRadius: 2, fontSize: 13 }}>
                  {detailModal.cot.observaciones}
                </Alert>
              )}

              <TableContainer sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                <Table size="small">
                  <TableHead sx={{ bgcolor: 'action.hover' }}>
                    <TableRow>
                      {['Producto', 'Cantidad', 'Precio Unit.', 'Subtotal'].map(h => (
                        <TableCell key={h} align={h !== 'Producto' ? 'right' : 'left'} sx={{ fontWeight: 700 }}>{h}</TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(detailModal.cot.detalles || []).map((d, idx) => (
                      <TableRow key={idx} hover>
                        <TableCell sx={{ fontWeight: 600 }}>{d.producto?.nombre}</TableCell>
                        <TableCell align="right">{d.cantidad} {d.producto?.unidad_medida}</TableCell>
                        <TableCell align="right">{formatCurrency(d.precio_unitario)}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700 }}>{formatCurrency(d.cantidad * d.precio_unitario)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow sx={{ bgcolor: 'action.hover' }}>
                      <TableCell colSpan={3} align="right" sx={{ fontWeight: 700 }}>Total:</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 800, color: TEAL, fontSize: 15 }}>
                        {formatCurrency(detailModal.cot.total)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
          {detailModal.cot?.estado_cotizacion === 'vigente' && (
            <Button
              variant="contained" startIcon={<Transform />}
              onClick={() => {
                setConvertirModal({ open: true, cotizacion: detailModal.cot });
                setDetailModal({ open: false, cot: null });
                setConvertirPagada(true);
                setConvertirMetodo('Efectivo');
              }}
              sx={{ bgcolor: GREEN, '&:hover': { bgcolor: '#059669' }, borderRadius: 2, fontWeight: 700, mr: 'auto' }}
            >
              Convertir a Venta
            </Button>
          )}
          <Button onClick={() => setDetailModal({ open: false, cot: null })} variant="outlined"
            sx={{ borderRadius: 2, fontWeight: 600, borderColor: 'divider' }}>
            Cerrar
          </Button>
        </DialogActions>
      </Dialog>

      {/* ══ MODAL: Convertir a venta ══ */}
      <Dialog open={convertirModal.open} onClose={() => setConvertirModal({ open: false, cotizacion: null })}
        maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3, overflow: 'hidden' } }}>
        <Box sx={{ height: 5, background: `linear-gradient(90deg, ${TEAL}, ${GREEN})` }} />
        <DialogTitle sx={{ fontWeight: 800, fontSize: 18 }}>
          Convertir Cotización a Venta
        </DialogTitle>
        <DialogContent dividers sx={{ p: 3 }}>
          {convertirModal.cotizacion && (
            <>
              <Box sx={{ p: 2, mb: 3, borderRadius: 2, bgcolor: `${TEAL}08`, border: `1px solid ${TEAL}30` }}>
                <Typography sx={{ fontWeight: 700, fontSize: 15, mb: 0.5 }}>
                  {convertirModal.cotizacion.cliente?.nombre}
                </Typography>
                <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 1 }}>
                  Cotización #{convertirModal.cotizacion.id} · {convertirModal.cotizacion.detalles?.length || 0} ítem(s)
                </Typography>
                <Typography sx={{ fontWeight: 800, fontSize: 20, color: TEAL }}>
                  {formatCurrency(convertirModal.cotizacion.total)}
                </Typography>
              </Box>

              <Typography sx={{ fontWeight: 600, fontSize: 12, mb: 2, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.6 }}>
                Método de pago
              </Typography>

              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2.5 }}>
                {[
                  { value: 'Efectivo',      label: '💵 Efectivo',      pagada: true },
                  { value: 'Transferencia', label: '🏦 Transferencia',  pagada: true },
                  { value: 'Tarjeta',       label: '💳 Tarjeta',        pagada: true },
                  { value: null,            label: '🕒 Por Cobrar',     pagada: false },
                ].map(opt => {
                  const selected = opt.pagada
                    ? (convertirPagada && convertirMetodo === opt.value)
                    : !convertirPagada;
                  const color = opt.pagada ? GREEN : '#EF4444';
                  return (
                    <Box key={opt.label}
                      onClick={() => {
                        setConvertirPagada(opt.pagada);
                        if (opt.value) setConvertirMetodo(opt.value);
                      }}
                      sx={{
                        px: 2, py: 1, borderRadius: 2, cursor: 'pointer',
                        border: '1.5px solid',
                        borderColor: selected ? color : 'divider',
                        bgcolor: selected ? `${color}12` : 'background.paper',
                        color: selected ? color : 'text.secondary',
                        fontSize: 13, fontWeight: selected ? 700 : 500,
                        transition: 'all 0.15s', userSelect: 'none',
                        '&:hover': { borderColor: color },
                      }}
                    >
                      {opt.label}
                    </Box>
                  );
                })}
              </Box>

              <Alert severity="warning" sx={{ borderRadius: 2, fontSize: 13 }}>
                Esta acción <strong>validará el stock</strong> y creará los movimientos de inventario. No se puede deshacer.
              </Alert>
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
          <Button onClick={() => setConvertirModal({ open: false, cotizacion: null })} variant="outlined"
            sx={{ borderRadius: 2, fontWeight: 600, borderColor: 'divider' }} disabled={convertirLoading}>
            Cancelar
          </Button>
          <Button variant="contained" onClick={handleConvertir} disabled={convertirLoading}
            startIcon={<Transform />}
            sx={{ bgcolor: GREEN, '&:hover': { bgcolor: '#059669' }, borderRadius: 2, fontWeight: 700, px: 3 }}>
            {convertirLoading ? 'Procesando…' : 'Confirmar y Convertir'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── QuickCreate ── */}
      <QuickCreateModal
        open={quickCreate.open}
        onClose={() => setQuickCreate(q => ({ ...q, open: false }))}
        type="producto"
        initialName={quickCreate.initialName}
        onCreated={handleQuickCreated}
      />

    </Box>
  );
};

export default Cotizaciones;
