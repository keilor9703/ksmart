import React, { useState, useEffect, useMemo } from 'react';
import {
  Box, Paper, Typography, Tabs, Tab, TextField, MenuItem, Button,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  IconButton, Grid, Divider, useTheme, Chip, TablePagination, Autocomplete,
  Dialog, DialogTitle, DialogContent, DialogActions,
  List, ListItem, ListItemText, Tooltip, InputAdornment, useMediaQuery, Stack
} from '@mui/material';
import {
  Add, Delete, ShoppingBag, Receipt, Payment, CheckCircle,
  Visibility, Search, TrendingDown, AttachMoney, Warning,
  LocalShipping, Close, Science
} from '@mui/icons-material';
import apiClient, { fetchCompras, createCompra, addPagoCompra } from '../../api';
import { formatCurrency } from '../../utils/formatters';
import { toast } from 'react-toastify';
import CurrencyField from '../../components/common/CurrencyField';
import QuickCreateModal from '../../components/common/QuickCreateModal';

// ─── Constantes ────────────────────────────────────────────────────────────────
const ACCENT  = '#FF6020';
const GREEN   = '#10B981';
const RED     = '#EF4444';
const BLUE    = '#3B82F6';
const YELLOW  = '#F59E0B';

// ─── TabPanel ─────────────────────────────────────────────────────────────────
function TabPanel({ children, value, index }) {
  return (
    <div role="tabpanel" hidden={value !== index}>
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
const KpiCard = ({ label, value, icon, color }) => (
  <Paper sx={{ p: 2.5, borderRadius: 3, display: 'flex', alignItems: 'center', gap: 2, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
    <Box sx={{ width: 48, height: 48, borderRadius: 2, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: `${color}18`, color }}>
      {icon}
    </Box>
    <Box>
      <Typography sx={{ fontSize: 12, color: 'text.secondary', fontWeight: 500, mb: 0.3 }}>{label}</Typography>
      <Typography sx={{ fontSize: 18, fontWeight: 700, color: 'text.primary' }}>{value}</Typography>
    </Box>
  </Paper>
);

// ─── Chip de estado ───────────────────────────────────────────────────────────
const EstadoChip = ({ estado }) => {
  const map = {
    pagado:    { label: 'Pagada',    color: 'success' },
    parcial:   { label: 'Parcial',   color: 'warning' },
    pendiente: { label: 'Pendiente', color: 'error'   },
  };
  const p = map[estado] || { label: estado, color: 'default' };
  return <Chip label={p.label} color={p.color} size="small" sx={{ fontWeight: 600, fontSize: 11, borderRadius: 1.5 }} />;
};

// ─── Sección label ────────────────────────────────────────────────────────────
const SectionLabel = ({ children }) => (
  <Typography sx={{ fontWeight: 600, fontSize: 11, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.8, mb: 1.5 }}>
    {children}
  </Typography>
);

// ─── Componente principal ──────────────────────────────────────────────────────
const Compras = () => {
  const theme    = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [tab, setTab]               = useState(0);
  const [proveedores, setProveedores] = useState([]);
  const [productos, setProductos]     = useState([]);
  const [compras, setCompras]         = useState([]);
  const [loading, setLoading]         = useState(false);

  // Form
  const [proveedorSel, setProveedorSel]           = useState(null);
  const [proveedorInput, setProveedorInput]        = useState('');
  const [refFactura, setRefFactura]               = useState('');
  // Se añaden los campos de lotes al estado inicial de detalles
  const [detalles, setDetalles]                   = useState([{ producto_id: '', cantidad: 1, precio_unitario: 0, numero_lote: '', fecha_vencimiento: '', fecha_fabricacion: '' }]);
  const [ivaPorcentajeGlobal, setIvaPorcentajeGlobal] = useState(0);
  const [pagadaAlCrear, setPagadaAlCrear]         = useState(false);

  // QuickCreate — creación inline de tercero o producto
  const [quickCreate, setQuickCreate] = useState({ open: false, type: 'tercero', initialName: '', targetIdx: null });

  const openQuickCreate = (type, initialName = '', targetIdx = null) =>
    setQuickCreate({ open: true, type, initialName, targetIdx });
  const closeQuickCreate = () =>
    setQuickCreate(q => ({ ...q, open: false }));

  // Cuando se crea un nuevo tercero o producto desde el modal
  const handleQuickCreated = (nuevoRegistro) => {
    if (quickCreate.type === 'tercero') {
      // Agregar a la lista y seleccionarlo automáticamente
      setProveedores(prev => [...prev, nuevoRegistro]);
      setProveedorSel(nuevoRegistro);
      setProveedorInput(nuevoRegistro.nombre);
    } else {
      // Agregar a productos y seleccionarlo en el detalle correspondiente
      setProductos(prev => [...prev, nuevoRegistro]);
      if (quickCreate.targetIdx !== null) {
        handleDetalleChange(quickCreate.targetIdx, 'producto_id', nuevoRegistro.id);
      }
    }
    closeQuickCreate();
  };

  // Pago
  const [openPayDialog, setOpenPayDialog]   = useState(false);
  const [selectedCompra, setSelectedCompra] = useState(null);
  const [montoAbono, setMontoAbono]         = useState('');
  const [metodoPago, setMetodoPago]         = useState('Transferencia');
  const [detallePago, setDetallePago]       = useState('');

  // Detalle
  const [openDetailDialog, setOpenDetailDialog] = useState(false);
  const [compraDetalle, setCompraDetalle]       = useState(null);

  // Paginación
  const [page, setPage]               = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [searchTerm, setSearchTerm]   = useState('');

  // ── Carga inicial ────────────────────────────────────────────────────────
  useEffect(() => { loadBaseData(); fetchHistorial(); }, []);

  const loadBaseData = async () => {
    try {
      const [provRes, prodRes] = await Promise.all([
        apiClient.get('/clientes/'),
        apiClient.get('/productos/')
      ]);
      setProveedores(provRes.data.filter(c => c.es_proveedor));
      setProductos(prodRes.data.filter(p => !p.es_servicio));
    } catch { toast.error('Error cargando proveedores/productos'); }
  };

  const fetchHistorial = async () => {
    try {
      const res = await fetchCompras();
      setCompras(res.data);
    } catch { toast.error('Error cargando historial de compras'); }
  };

  // Input values para los autocomplete de productos (uno por línea de detalle)
  const [productoInputs, setProductoInputs] = useState(['']);
  const handleProductoInputChange = (idx, val) =>
    setProductoInputs(prev => { const next = [...prev]; next[idx] = val; return next; });

  const addDetalle = () => {
    setDetalles(p => [...p, { producto_id: '', cantidad: 1, precio_unitario: 0, numero_lote: '', fecha_vencimiento: '', fecha_fabricacion: '' }]);
    setProductoInputs(p => [...p, '']);
  };
  const removeDetalle = (idx) => {
    setDetalles(p => p.filter((_, i) => i !== idx));
    setProductoInputs(p => p.filter((_, i) => i !== idx));
  };
  const handleDetalleChange = (idx, field, val) =>
    setDetalles(p => p.map((d, i) => i === idx ? { ...d, [field]: val } : d));

  const calcularTotal = () =>
    detalles.reduce((acc, d) => acc + d.cantidad * d.precio_unitario, 0);

  const resetForm = () => {
    setProveedorSel(null); setProveedorInput(''); setRefFactura('');
    setDetalles([{ producto_id: '', cantidad: 1, precio_unitario: 0, numero_lote: '', fecha_vencimiento: '', fecha_fabricacion: '' }]);
    setProductoInputs(['']);
    setIvaPorcentajeGlobal(0); setPagadaAlCrear(false);
  };

  const handleSubmit = async () => {
    if (!proveedorSel || detalles.some(d => !d.producto_id || d.cantidad <= 0)) {
      toast.warning('Complete el proveedor y los ítems de compra.');
      return;
    }

    // ─── Validación Inteligente de Lotes ───
    for (let d of detalles) {
      const prod = productos.find(p => p.id === parseInt(d.producto_id));
      if (prod?.maneja_lotes && (!d.numero_lote || !d.fecha_vencimiento)) {
        toast.warning(`El producto "${prod.nombre}" es perecedero. Ingresa el Lote y Vencimiento.`);
        return;
      }
    }

    setLoading(true);
    try {
      await createCompra({
        proveedor_id: proveedorSel.id,
        referencia_factura: refFactura,
        detalles: detalles.map(d => ({
          ...d,
          producto_id:     parseInt(d.producto_id),
          cantidad:        parseFloat(d.cantidad),
          precio_unitario: parseFloat(d.precio_unitario),
          iva_porcentaje:  0.0,
          // Se envían los datos de lotes al backend
          numero_lote: d.numero_lote || undefined,
          fecha_vencimiento: d.fecha_vencimiento || undefined,
          fecha_fabricacion: d.fecha_fabricacion || undefined,
        })),
        pagada: pagadaAlCrear,
        iva_porcentaje: parseFloat(ivaPorcentajeGlobal),
      });
      toast.success('Compra registrada e inventario actualizado.');
      resetForm(); fetchHistorial(); setTab(1);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al registrar compra');
    } finally { setLoading(false); }
  };

  // ── Pagos ────────────────────────────────────────────────────────────────
  const handleOpenPay = (compra) => {
    setSelectedCompra(compra);
    setMontoAbono(compra.total - compra.monto_pagado);
    setDetallePago(''); setOpenPayDialog(true);
  };

  const handleConfirmPago = async () => {
    if (!montoAbono || montoAbono <= 0) { toast.warning('Ingrese un monto válido.'); return; }
    try {
      await addPagoCompra({
        compra_id: selectedCompra.id,
        monto: parseFloat(montoAbono),
        metodo_pago: metodoPago,
        detalle_pago: detallePago,
      });
      toast.success('Pago registrado correctamente');
      setOpenPayDialog(false); fetchHistorial();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al registrar el pago');
    }
  };

  // ── Filtros / stats ──────────────────────────────────────────────────────
  const filteredCompras = compras.filter(c =>
    c.proveedor.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.referencia_factura || '').toLowerCase().includes(searchTerm.toLowerCase())
  );
  const paginatedCompras = useMemo(() =>
    filteredCompras.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage),
    [filteredCompras, page, rowsPerPage]
  );
  const cuentasPorPagar   = compras.filter(c => c.estado_pago !== 'pagado');
  const totalPorPagar     = cuentasPorPagar.reduce((s, c) => s + (c.total - c.monto_pagado), 0);
  const totalCompras      = compras.reduce((s, c) => s + c.total, 0);

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <Box sx={{ width: '100%' }}>

      {/* ── Header ── */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ width: 40, height: 40, borderRadius: 2, bgcolor: `${GREEN}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: GREEN }}>
            <ShoppingBag />
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 700, fontSize: 20, lineHeight: 1.2 }}>Compras</Typography>
            <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>Gestión de proveedores y cuentas por pagar</Typography>
          </Box>
        </Box>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => { resetForm(); setTab(0); }}
          sx={{ background: `linear-gradient(135deg, ${GREEN}, #34d399)`, boxShadow: `0 4px 14px rgba(16,185,129,0.35)`, borderRadius: 2, fontWeight: 600 }}
        >
          Nueva Compra
        </Button>
      </Box>

      {/* ── KPIs ── */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={4}>
          <KpiCard label="Total compras" value={formatCurrency(totalCompras)} icon={<TrendingDown />} color={GREEN} />
        </Grid>
        <Grid item xs={12} sm={4}>
          <KpiCard label="Facturas pendientes" value={cuentasPorPagar.length} icon={<Receipt />} color={YELLOW} />
        </Grid>
        <Grid item xs={12} sm={4}>
          <KpiCard label="Total por pagar" value={formatCurrency(totalPorPagar)} icon={<AttachMoney />} color={RED} />
        </Grid>
      </Grid>

      {/* ── Tabs ── */}
      <Paper sx={{ borderRadius: 3, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          variant={isMobile ? 'scrollable' : 'standard'}
          scrollButtons="auto"
          sx={{
            px: 2,
            borderBottom: '1px solid', borderColor: 'divider',
            '& .MuiTab-root': { fontWeight: 600, fontSize: 13, textTransform: 'none', minHeight: 52 },
            '& .MuiTabs-indicator': { backgroundColor: GREEN, height: 3, borderRadius: 3 },
            '& .Mui-selected': { color: `${GREEN} !important` },
          }}
        >
          <Tab label="➕ Registrar Compra" />
          <Tab label={`📋 Historial (${compras.length})`} />
          <Tab label={`⚠️ Por Pagar (${cuentasPorPagar.length})`} />
        </Tabs>

        {/* ══ Tab 0: Registrar ══ */}
        <TabPanel value={tab} index={0}>
          <Box sx={{ p: { xs: 2, md: 3 } }}>

            {/* Proveedor + metadatos */}
            <SectionLabel>Información de la compra</SectionLabel>
            <Stack direction="column" spacing={1.5} sx={{ mb: 3 }}>

              {/* Fila 1: Proveedor — línea completa siempre */}
              <Autocomplete
                options={proveedores}
                getOptionLabel={(o) => o.nombre || ''}
                value={proveedorSel}
                onChange={(_, v) => setProveedorSel(v)}
                inputValue={proveedorInput}
                onInputChange={(_, v) => setProveedorInput(v)}
                filterOptions={(opts, state) => {
                  const q = (state.inputValue || '').toLowerCase().trim();
                  if (!q) return opts;
                  return opts.filter(o =>
                    o.nombre.toLowerCase().includes(q) ||
                    (o.cedula || '').toLowerCase().includes(q)
                  );
                }}
                noOptionsText={
                  <Box sx={{ py: 0.5 }}>
                    <Typography sx={{ fontSize: 13, color: 'text.secondary', mb: 1 }}>
                      No se encontró ningún proveedor
                    </Typography>
                    <Button
                      size="small" variant="contained" fullWidth
                      startIcon={<Add />}
                      onClick={() => openQuickCreate('tercero', proveedorInput)}
                      sx={{
                        borderRadius: 2, fontWeight: 600, fontSize: 12,
                        bgcolor: '#3B82F6', '&:hover': { bgcolor: '#2563EB' },
                      }}
                    >
                      Crear "{proveedorInput || 'nuevo proveedor'}"
                    </Button>
                  </Box>
                }
                renderOption={(props, option) => (
                  <li {...props} key={option.id} style={{ padding: '8px 12px' }}>
                    <Box>
                      <Typography sx={{ fontSize: 14, fontWeight: 600 }}>{option.nombre}</Typography>
                      <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
                        NIT/CC: {option.cedula || 'Sin identificación'}
                      </Typography>
                    </Box>
                  </li>
                )}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Proveedor (busca por nombre o NIT)"
                    required fullWidth size="small"
                    placeholder="Escribe para buscar…"
                    InputProps={{
                      ...params.InputProps,
                      endAdornment: (
                        <>
                          {params.InputProps.endAdornment}
                          <Tooltip title="Crear nuevo proveedor">
                            <IconButton
                              size="small"
                              onClick={() => openQuickCreate('tercero', proveedorInput)}
                              sx={{ color: '#3B82F6', p: 0.5 }}
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
              />

              {/* Fila 2: Referencia — línea completa */}
              <TextField
                fullWidth label="Referencia / Nro. Factura Proveedor"
                value={refFactura}
                onChange={(e) => setRefFactura(e.target.value)}
                size="small"
              />

              {/* Fila 3: IVA + Pagada */}
              <Box sx={{ display: 'flex', gap: 1.5 }}>
                <TextField
                  label="% IVA Global" type="number"
                  value={ivaPorcentajeGlobal}
                  onChange={(e) => setIvaPorcentajeGlobal(e.target.value)}
                  helperText="IVA incluido"
                  size="small"
                  sx={{ flex: 1 }}
                />
                <Button
                  variant={pagadaAlCrear ? 'contained' : 'outlined'}
                  size="small"
                  onClick={() => setPagadaAlCrear(p => !p)}
                  sx={{
                    borderRadius: 2, fontWeight: 600, fontSize: 12, height: 40, flexShrink: 0,
                    ...(pagadaAlCrear
                      ? { bgcolor: GREEN, '&:hover': { bgcolor: '#059669' }, borderColor: GREEN }
                      : { borderColor: 'divider', color: 'text.secondary' }),
                  }}
                >
                  {pagadaAlCrear ? '✓ Pagada' : 'Pagada'}
                </Button>
              </Box>
            </Stack>

            {/* Detalle de ítems */}
            <Box sx={{ mb: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <SectionLabel>Productos / Insumos</SectionLabel>
                <Button size="small" startIcon={<Add />} onClick={addDetalle} sx={{ color: GREEN, fontWeight: 600 }}>
                  Añadir ítem
                </Button>
              </Box>

              {detalles.map((det, idx) => {
                const prodSel = productos.find(p => p.id === parseInt(det.producto_id));
                return (
                  <Box
                    key={idx}
                    sx={{
                      mb: 1.5, p: isMobile ? 2 : 1.5,
                      borderRadius: 2, bgcolor: 'action.hover',
                      border: '1px solid', borderColor: 'divider',
                    }}
                  >
                    <Box sx={{
                      display: 'flex', flexDirection: isMobile ? 'column' : 'row',
                      alignItems: isMobile ? 'stretch' : 'center',
                      gap: 1.5
                    }}>
                      <Autocomplete
                        options={productos}
                        getOptionLabel={(p) => p.nombre || ''}
                        value={prodSel || null}
                        onChange={(_, v) => handleDetalleChange(idx, 'producto_id', v ? v.id : '')}
                        inputValue={productoInputs[idx] || ''}
                        onInputChange={(_, v) => handleProductoInputChange(idx, v)}
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
                              onClick={() => openQuickCreate('producto', productoInputs[idx] || '', idx)}
                              sx={{
                                borderRadius: 2, fontWeight: 600, fontSize: 12,
                                bgcolor: '#10B981', '&:hover': { bgcolor: '#059669' },
                              }}
                            >
                              Crear "{productoInputs[idx] || 'nuevo producto'}"
                            </Button>
                          </Box>
                        }
                        renderOption={(props, option) => (
                          <li {...props} key={option.id} style={{ padding: '8px 12px' }}>
                            <Box>
                              <Typography sx={{ fontSize: 14, fontWeight: 600 }}>{option.nombre}</Typography>
                              <Typography sx={{ fontSize: 11, color: option.maneja_lotes ? '#10B981' : 'text.secondary' }}>
                                {option.unidad_medida} · {option.maneja_lotes ? '📦 Perecedero (Lotes)' : `Stock: ${option.stock_actual ?? 0}`}
                              </Typography>
                            </Box>
                          </li>
                        )}
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            label="Producto / Insumo"
                            size="small"
                            placeholder="Escribe para buscar…"
                            InputProps={{
                              ...params.InputProps,
                              endAdornment: (
                                <>
                                  {params.InputProps.endAdornment}
                                  <Tooltip title="Crear nuevo producto">
                                    <IconButton
                                      size="small"
                                      onClick={() => openQuickCreate('producto', productoInputs[idx] || '', idx)}
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
                        sx={{ flex: 1, minWidth: isMobile ? '100%' : 220 }}
                      />
                      <TextField
                        type="number" label="Cantidad"
                        value={det.cantidad}
                        onChange={(e) => handleDetalleChange(idx, 'cantidad', e.target.value)}
                        InputProps={{ inputProps: { min: 0, step: 'any' } }}
                        sx={{ width: isMobile ? '100%' : 110 }}
                        size="small"
                      />
                      <CurrencyField
                        label="Precio Unit. (Costo)"
                        value={det.precio_unitario}
                        onChange={(val) => handleDetalleChange(idx, 'precio_unitario', val)}
                        sx={{ width: isMobile ? '100%' : 160 }}
                        size="small"
                      />
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                        <Typography sx={{ fontWeight: 700, fontSize: 14, color: GREEN, minWidth: 90 }}>
                          {formatCurrency(det.cantidad * det.precio_unitario)}
                        </Typography>
                        <Tooltip title="Quitar">
                          <span>
                            <IconButton
                              size="small" onClick={() => removeDetalle(idx)}
                              disabled={detalles.length === 1}
                              sx={{ color: RED, bgcolor: '#FEF2F2', borderRadius: 1.5, '&.Mui-disabled': { opacity: 0.3 } }}
                            >
                              <Delete fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                      </Box>
                    </Box>
                    
                    {/* ─── DESPLIEGUE INTELIGENTE DE LOTES ─── */}
                   {/* ─── DESPLIEGUE INTELIGENTE DE LOTES ─── */}
                    {prodSel?.maneja_lotes && (
                       <Box sx={{ 
                         mt: 1.5, p: 1.5, 
                         bgcolor: theme.palette.mode === 'dark' ? 'rgba(16,185,129,0.08)' : '#ECFDF5', 
                         borderRadius: 2, border: '1px dashed #10B981', 
                         display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 1.5, alignItems: 'center' 
                       }}>
                          <Typography sx={{ display: {xs:'none', md:'flex'}, color: '#10B981' }}><Science fontSize="small"/></Typography>
                          <TextField size="small" label="Número de Lote *" value={det.numero_lote || ''} onChange={e => handleDetalleChange(idx, 'numero_lote', e.target.value.toUpperCase())} sx={{ flex: 1, width: isMobile ? '100%' : 'auto' }} />
                          <TextField size="small" type="date" label="Fecha Vencimiento *" InputLabelProps={{ shrink: true }} value={det.fecha_vencimiento || ''} onChange={e => handleDetalleChange(idx, 'fecha_vencimiento', e.target.value)} inputProps={{ min: new Date().toLocaleDateString('en-CA') }} sx={{ flex: 1, width: isMobile ? '100%' : 'auto' }} />
                          <TextField size="small" type="date" label="Fabricación" InputLabelProps={{ shrink: true }} value={det.fecha_fabricacion || ''} onChange={e => handleDetalleChange(idx, 'fecha_fabricacion', e.target.value)} sx={{ flex: 1, width: isMobile ? '100%' : 'auto' }} />
                       </Box>
                    )}
                  </Box>
                );
              })}
            </Box>

            <Divider sx={{ mb: 3 }} />

            {/* Total + botón */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
              <Paper sx={{
                p: 2, borderRadius: 2, textAlign: 'center',
                bgcolor: `${GREEN}0D`, border: `1.5px dashed ${GREEN}60`, boxShadow: 'none', minWidth: 200,
              }}>
                <Typography sx={{ fontSize: 11, color: 'text.secondary', mb: 0.5 }}>Total Compra</Typography>
                <Typography sx={{ fontSize: 24, fontWeight: 800, color: GREEN }}>
                  {formatCurrency(calcularTotal())}
                </Typography>
              </Paper>

              <Button
                variant="contained" size="large"
                onClick={handleSubmit} disabled={loading}
                startIcon={<LocalShipping />}
                sx={{
                  background: `linear-gradient(135deg, ${GREEN}, #34d399)`,
                  boxShadow: `0 4px 14px rgba(16,185,129,0.35)`,
                  borderRadius: 2, fontWeight: 600, px: 4,
                }}
              >
                {loading ? 'Procesando…' : 'Registrar Entrada de Mercancía'}
              </Button>
            </Box>
          </Box>
        </TabPanel>

        {/* ══ Tab 1: Historial ══ */}
        <TabPanel value={tab} index={1}>
          <Box sx={{ px: { xs: 2, md: 3 }, pb: 3 }}>
            <Box sx={{ mb: 2.5 }}>
              <TextField
                fullWidth placeholder="Buscar por proveedor o nro. factura…"
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setPage(0); }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search sx={{ color: 'text.secondary', fontSize: 20 }} />
                    </InputAdornment>
                  ),
                }}
              />
            </Box>

            {isMobile ? (
              <Box>
                {paginatedCompras.length === 0
                  ? <Box sx={{ textAlign: 'center', py: 6, color: 'text.secondary' }}>
                      <Receipt sx={{ fontSize: 48, mb: 1, opacity: 0.3 }} />
                      <Typography>No se encontraron compras</Typography>
                    </Box>
                  : paginatedCompras.map(c => (
                      <Paper key={c.id} sx={{ p: 2.5, mb: 2, borderRadius: 3, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
                          <Box>
                            <Typography sx={{ fontWeight: 700, fontSize: 15 }}>{c.proveedor.nombre}</Typography>
                            <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
                              #{c.id} · {new Date(c.fecha).toLocaleDateString()} · {c.referencia_factura || 'Sin ref.'}
                            </Typography>
                          </Box>
                          <EstadoChip estado={c.estado_pago} />
                        </Box>
                        <Divider sx={{ my: 1.5 }} />
                        <Grid container spacing={1} sx={{ mb: 1.5 }}>
                          {[
                            { label: 'Total',  val: formatCurrency(c.total) },
                            { label: 'Pagado', val: formatCurrency(c.monto_pagado) },
                            { label: 'Saldo',  val: formatCurrency(c.total - c.monto_pagado) },
                          ].map(({ label, val }) => (
                            <Grid item xs={4} key={label}>
                              <Box sx={{ textAlign: 'center', p: 1, borderRadius: 2, bgcolor: 'action.hover' }}>
                                <Typography sx={{ fontSize: 10, color: 'text.secondary', mb: 0.2 }}>{label}</Typography>
                                <Typography sx={{ fontSize: 13, fontWeight: 700 }}>{val}</Typography>
                              </Box>
                            </Grid>
                          ))}
                        </Grid>
                        <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                          <Tooltip title="Ver detalle">
                            <IconButton size="small" onClick={() => { setCompraDetalle(c); setOpenDetailDialog(true); }}
                              sx={{ color: BLUE, bgcolor: '#EFF6FF', borderRadius: 1.5 }}>
                              <Visibility fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </Paper>
                    ))
                }
              </Box>
            ) : (
              <TableContainer sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      {['#', 'Fecha', 'Proveedor', 'Factura Ref.', 'Total', 'Pagado', 'Saldo', 'Estado', 'Acciones'].map(h => (
                        <TableCell key={h}>{h}</TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {paginatedCompras.length === 0
                      ? <TableRow>
                          <TableCell colSpan={9} sx={{ textAlign: 'center', py: 6, color: 'text.secondary' }}>
                            No se encontraron compras
                          </TableCell>
                        </TableRow>
                      : paginatedCompras.map(c => (
                          <TableRow key={c.id} hover>
                            <TableCell sx={{ fontWeight: 600, color: 'text.secondary', fontSize: 12 }}>#{c.id}</TableCell>
                            <TableCell sx={{ fontSize: 12, whiteSpace: 'nowrap' }}>{new Date(c.fecha).toLocaleDateString()}</TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>{c.proveedor.nombre}</TableCell>
                            <TableCell sx={{ fontSize: 12, color: 'text.secondary' }}>{c.referencia_factura || '—'}</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>{formatCurrency(c.total)}</TableCell>
                            <TableCell sx={{ color: GREEN, fontWeight: 600 }}>{formatCurrency(c.monto_pagado)}</TableCell>
                            <TableCell sx={{ color: c.total - c.monto_pagado > 0 ? RED : 'text.primary', fontWeight: 600 }}>
                              {formatCurrency(c.total - c.monto_pagado)}
                            </TableCell>
                            <TableCell><EstadoChip estado={c.estado_pago} /></TableCell>
                            <TableCell>
                              <Tooltip title="Ver detalle">
                                <IconButton size="small" onClick={() => { setCompraDetalle(c); setOpenDetailDialog(true); }}
                                  sx={{ color: BLUE, '&:hover': { bgcolor: '#EFF6FF' } }}>
                                  <Visibility fontSize="small" />
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

            <TablePagination
              rowsPerPageOptions={[5, 10, 25]}
              component="div"
              count={filteredCompras.length}
              rowsPerPage={rowsPerPage}
              page={page}
              onPageChange={(_, p) => setPage(p)}
              onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
              labelRowsPerPage="Filas:"
              labelDisplayedRows={({ from, to, count }) => `${from}–${to} de ${count}`}
            />
          </Box>
        </TabPanel>

        {/* ══ Tab 2: Cuentas por pagar ══ */}
        <TabPanel value={tab} index={2}>
          <Box sx={{ px: { xs: 2, md: 3 }, pb: 3 }}>
            {cuentasPorPagar.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 8 }}>
                <CheckCircle sx={{ fontSize: 56, color: GREEN, mb: 1.5 }} />
                <Typography sx={{ fontWeight: 700, fontSize: 18, mb: 0.5 }}>¡Todo al día!</Typography>
                <Typography sx={{ color: 'text.secondary' }}>No hay facturas con saldo pendiente.</Typography>
              </Box>
            ) : (
              <>
                {/* Resumen */}
                <Paper sx={{
                  p: 2, mb: 3, borderRadius: 2,
                  bgcolor: `${RED}08`, border: `1px solid ${RED}30`,
                  display: 'flex', alignItems: 'center', gap: 1.5, boxShadow: 'none',
                }}>
                  <Warning sx={{ color: RED }} />
                  <Box>
                    <Typography sx={{ fontWeight: 700, color: RED }}>
                      {cuentasPorPagar.length} factura{cuentasPorPagar.length > 1 ? 's' : ''} con saldo pendiente
                    </Typography>
                    <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>
                      Total a cancelar: <strong>{formatCurrency(totalPorPagar)}</strong>
                    </Typography>
                  </Box>
                </Paper>

                {isMobile ? (
                  <Box>
                    {cuentasPorPagar.map(c => (
                      <Paper key={c.id} sx={{ p: 2.5, mb: 2, borderRadius: 3, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', borderLeft: `4px solid ${RED}` }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
                          <Box>
                            <Typography sx={{ fontWeight: 700, fontSize: 15 }}>{c.proveedor.nombre}</Typography>
                            <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{c.referencia_factura || `#${c.id}`}</Typography>
                          </Box>
                          <EstadoChip estado={c.estado_pago} />
                        </Box>
                        <Grid container spacing={1} sx={{ mb: 1.5 }}>
                          {[
                            { label: 'Total',    val: formatCurrency(c.total) },
                            { label: 'Pagado',   val: formatCurrency(c.monto_pagado) },
                            { label: 'Pendiente',val: formatCurrency(c.total - c.monto_pagado) },
                          ].map(({ label, val }) => (
                            <Grid item xs={4} key={label}>
                              <Box sx={{ textAlign: 'center', p: 1, borderRadius: 2, bgcolor: 'action.hover' }}>
                                <Typography sx={{ fontSize: 10, color: 'text.secondary', mb: 0.2 }}>{label}</Typography>
                                <Typography sx={{ fontSize: 13, fontWeight: 700 }}>{val}</Typography>
                              </Box>
                            </Grid>
                          ))}
                        </Grid>
                        <Button fullWidth variant="contained" size="small" startIcon={<CheckCircle />}
                          onClick={() => handleOpenPay(c)}
                          sx={{ background: `linear-gradient(135deg, ${GREEN}, #34d399)`, boxShadow: 'none', borderRadius: 2, fontWeight: 600 }}>
                          Registrar Abono
                        </Button>
                      </Paper>
                    ))}
                  </Box>
                ) : (
                  <TableContainer sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          {['Proveedor', 'Factura', 'Total', 'Pagado', 'Saldo Pendiente', 'Acción'].map(h => (
                            <TableCell key={h}>{h}</TableCell>
                          ))}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {cuentasPorPagar.map(c => (
                          <TableRow key={c.id} hover>
                            <TableCell sx={{ fontWeight: 600 }}>{c.proveedor.nombre}</TableCell>
                            <TableCell sx={{ fontSize: 12, color: 'text.secondary' }}>{c.referencia_factura || `#${c.id}`}</TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>{formatCurrency(c.total)}</TableCell>
                            <TableCell sx={{ color: GREEN, fontWeight: 600 }}>{formatCurrency(c.monto_pagado)}</TableCell>
                            <TableCell sx={{ color: RED, fontWeight: 700 }}>{formatCurrency(c.total - c.monto_pagado)}</TableCell>
                            <TableCell>
                              <Button variant="contained" size="small" startIcon={<CheckCircle />}
                                onClick={() => handleOpenPay(c)}
                                sx={{ background: `linear-gradient(135deg, ${GREEN}, #34d399)`, boxShadow: 'none', borderRadius: 1.5, fontWeight: 600, fontSize: 12 }}>
                                Abonar
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </>
            )}
          </Box>
        </TabPanel>
      </Paper>

      {/* ══ Diálogo: Registrar Pago ══ */}
      <Dialog open={openPayDialog} onClose={() => setOpenPayDialog(false)} maxWidth="sm" fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1 }}>
          <Box>
            <Typography sx={{ fontWeight: 700, fontSize: 17 }}>Registrar Pago a Proveedor</Typography>
            <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{selectedCompra?.proveedor?.nombre}</Typography>
          </Box>
          <IconButton size="small" onClick={() => setOpenPayDialog(false)}>
            <Close fontSize="small" />
          </IconButton>
        </DialogTitle>

        <DialogContent dividers>
          {/* Resumen de la factura */}
          <Grid container spacing={2} sx={{ mb: 2 }}>
            {[
              { label: 'Factura', val: selectedCompra?.referencia_factura || `#${selectedCompra?.id}` },
              { label: 'Total factura', val: formatCurrency(selectedCompra?.total || 0) },
            ].map(({ label, val }) => (
              <Grid item xs={6} key={label}>
                <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: 'action.hover' }}>
                  <Typography sx={{ fontSize: 11, color: 'text.secondary', mb: 0.3 }}>{label}</Typography>
                  <Typography sx={{ fontWeight: 700 }}>{val}</Typography>
                </Box>
              </Grid>
            ))}
            <Grid item xs={12}>
              <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: `${RED}0D`, border: `1px dashed ${RED}50` }}>
                <Typography sx={{ fontSize: 11, color: RED, mb: 0.3 }}>Saldo pendiente</Typography>
                <Typography sx={{ fontWeight: 800, fontSize: 18, color: RED }}>
                  {formatCurrency(selectedCompra ? selectedCompra.total - selectedCompra.monto_pagado : 0)}
                </Typography>
              </Box>
            </Grid>
          </Grid>

          {/* Historial de pagos previos */}
          {selectedCompra?.pagos?.length > 0 && (
            <Box sx={{ mb: 2 }}>
              <SectionLabel>Pagos anteriores</SectionLabel>
              <Box sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider', overflow: 'hidden' }}>
                {selectedCompra.pagos.map((p, idx) => (
                  <Box key={idx} sx={{
                    px: 2, py: 1.2, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    borderBottom: idx < selectedCompra.pagos.length - 1 ? '1px solid' : 'none',
                    borderColor: 'divider',
                  }}>
                    <Box>
                      <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{p.metodo_pago}</Typography>
                      <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
                        {new Date(p.fecha).toLocaleString()}{p.detalle_pago ? ` · ${p.detalle_pago}` : ''}
                      </Typography>
                    </Box>
                    <Typography sx={{ fontWeight: 700, color: GREEN }}>{formatCurrency(p.monto)}</Typography>
                  </Box>
                ))}
              </Box>
            </Box>
          )}

          <Divider sx={{ mb: 2 }} />
          <SectionLabel>Nuevo abono</SectionLabel>

          <Grid container spacing={2}>
            <Grid item xs={12}>
              <CurrencyField
                fullWidth label="Monto a pagar"
                value={montoAbono} onChange={(val) => setMontoAbono(val)}
                required autoFocus
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                select fullWidth label="Método de pago"
                value={metodoPago} onChange={(e) => setMetodoPago(e.target.value)}
              >
                {['Transferencia', 'Efectivo', 'Cheque', 'Nota Crédito'].map(m => (
                  <MenuItem key={m} value={m}>{m}</MenuItem>
                ))}
              </TextField>
            </Grid>
            {metodoPago !== 'Efectivo' && (
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label={
                    metodoPago === 'Transferencia' ? 'Nro. Cuenta / Comprobante'
                    : metodoPago === 'Cheque'      ? 'Nro. Cheque'
                    : 'Nro. Referencia / Nota'
                  }
                  value={detallePago}
                  onChange={(e) => setDetallePago(e.target.value)}
                  placeholder="Ej: 123456789"
                  required
                />
              </Grid>
            )}
          </Grid>
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
          <Button onClick={() => setOpenPayDialog(false)} variant="outlined"
            sx={{ borderRadius: 2, fontWeight: 600, borderColor: 'divider' }}>
            Cancelar
          </Button>
          <Button onClick={handleConfirmPago} variant="contained"
            sx={{ background: `linear-gradient(135deg, ${GREEN}, #34d399)`, boxShadow: `0 4px 14px rgba(16,185,129,0.3)`, borderRadius: 2, fontWeight: 600 }}>
            Confirmar Pago
          </Button>
        </DialogActions>
      </Dialog>

      {/* ══ Diálogo: Detalle completo ══ */}
      <Dialog open={openDetailDialog} onClose={() => setOpenDetailDialog(false)} maxWidth="md" fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography sx={{ fontWeight: 700, fontSize: 17 }}>Detalle de Compra #{compraDetalle?.id}</Typography>
            <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{compraDetalle?.proveedor?.nombre}</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <EstadoChip estado={compraDetalle?.estado_pago} />
            <IconButton size="small" onClick={() => setOpenDetailDialog(false)}><Close fontSize="small" /></IconButton>
          </Box>
        </DialogTitle>

        <DialogContent dividers>
          {/* Metadatos */}
          <Grid container spacing={2} sx={{ mb: 3 }}>
            {[
              { label: 'Proveedor',     val: compraDetalle?.proveedor?.nombre },
              { label: 'Fecha',         val: compraDetalle ? new Date(compraDetalle.fecha).toLocaleString() : '' },
              { label: 'Ref. Factura',  val: compraDetalle?.referencia_factura || 'N/A' },
            ].map(({ label, val }) => (
              <Grid item xs={12} sm={4} key={label}>
                <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: 'action.hover' }}>
                  <Typography sx={{ fontSize: 11, color: 'text.secondary', mb: 0.3 }}>{label}</Typography>
                  <Typography sx={{ fontWeight: 600, fontSize: 14 }}>{val}</Typography>
                </Box>
              </Grid>
            ))}
          </Grid>

          {/* Ítems */}
          <SectionLabel>Ítems comprados</SectionLabel>
          <TableContainer sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider', mb: 3 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  {['Producto', 'Lote', 'Cantidad', 'Precio Unit.', 'Subtotal'].map(h => (
                    <TableCell key={h} align={h !== 'Producto' && h !== 'Lote' ? 'right' : 'left'}>{h}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {compraDetalle?.detalles.map((d, idx) => {
                  return (
                    <TableRow key={idx} hover>
                      <TableCell sx={{ fontWeight: 600 }}>{d.producto.nombre}</TableCell>
                      <TableCell sx={{ fontSize: 12, color: 'text.secondary' }}>
                        {d.numero_lote ? (
                          <>
                            <strong>Lote:</strong> {d.numero_lote}<br/>
                            <strong>Vence:</strong> {d.fecha_vencimiento ? new Date(d.fecha_vencimiento).toLocaleDateString() : ''}
                          </>
                        ) : '—'}
                      </TableCell>
                      <TableCell align="right">{d.cantidad} {d.producto.unidad_medida}</TableCell>
                      <TableCell align="right">{formatCurrency(d.precio_unitario)}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>{formatCurrency(d.cantidad * d.precio_unitario)}</TableCell>
                    </TableRow>
                  );
                })}
                <TableRow sx={{ bgcolor: 'action.hover' }}>
                  <TableCell colSpan={4} align="right" sx={{ fontWeight: 700 }}>Total:</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 800, color: GREEN }}>{formatCurrency(compraDetalle?.total || 0)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>

          {/* Pagos */}
          <SectionLabel>Historial de pagos / abonos</SectionLabel>
          <TableContainer sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  {['Fecha', 'Método', 'Referencia', 'Monto'].map(h => (
                    <TableCell key={h} align={h === 'Monto' ? 'right' : 'left'}>{h}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {compraDetalle?.pagos?.length > 0
                  ? compraDetalle.pagos.map((p, idx) => (
                      <TableRow key={idx} hover>
                        <TableCell sx={{ fontSize: 12 }}>{new Date(p.fecha).toLocaleString()}</TableCell>
                        <TableCell sx={{ fontSize: 12 }}>{p.metodo_pago}</TableCell>
                        <TableCell sx={{ fontSize: 12, color: 'text.secondary' }}>{p.detalle_pago || '—'}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700, color: GREEN }}>{formatCurrency(p.monto)}</TableCell>
                      </TableRow>
                    ))
                  : <TableRow>
                      <TableCell colSpan={4} sx={{ textAlign: 'center', py: 3, color: 'text.secondary' }}>
                        No hay pagos registrados
                      </TableCell>
                    </TableRow>
                }
                <TableRow sx={{ bgcolor: 'action.hover' }}>
                  <TableCell colSpan={3} align="right" sx={{ fontWeight: 700 }}>Total pagado:</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 800, color: GREEN }}>{formatCurrency(compraDetalle?.monto_pagado || 0)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell colSpan={3} align="right" sx={{ fontWeight: 700, color: RED }}>Saldo pendiente:</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 800, color: RED }}>
                    {formatCurrency(compraDetalle ? compraDetalle.total - compraDetalle.monto_pagado : 0)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2 }}>
          {compraDetalle?.estado_pago !== 'pagado' && (
            <Button
              variant="contained" startIcon={<Payment />}
              onClick={() => { setOpenDetailDialog(false); handleOpenPay(compraDetalle); }}
              sx={{ background: `linear-gradient(135deg, ${GREEN}, #34d399)`, borderRadius: 2, fontWeight: 600, mr: 'auto' }}
            >
              Registrar Abono
            </Button>
          )}
          <Button onClick={() => setOpenDetailDialog(false)} variant="outlined"
            sx={{ borderRadius: 2, fontWeight: 600, borderColor: 'divider' }}>
            Cerrar
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── QuickCreateModal — creación inline de terceros y productos ── */}
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

export default Compras;