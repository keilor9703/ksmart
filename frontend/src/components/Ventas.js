import React, { useState, useEffect } from 'react';
import apiClient from '../api';
import { formatCurrency } from '../utils/formatters';
import { toast } from 'react-toastify';
import ConfirmationDialog from './ConfirmationDialog';
import VentaDetailDialog from './VentaDetailDialog';
import {
    Box, Paper, Typography, Grid, TextField, Button, IconButton,
    Autocomplete, Table, TableBody, TableCell, TableContainer,
    TableHead, TableRow, Chip, useMediaQuery, useTheme, Card,
    CardContent, CardActions, Tabs, Tab, TablePagination, Divider,
    Stack, Tooltip, InputAdornment
} from '@mui/material';
import {
    AddCircleOutline, RemoveCircleOutline, Edit, Delete, Visibility,
    Search, ShoppingCart, TrendingUp, Receipt, AttachMoney,
    AccessTime, CheckCircle, Cancel
} from '@mui/icons-material';
import { ToggleButton, ToggleButtonGroup } from '@mui/material';

// ─── Constantes de diseño ──────────────────────────────────────────────────────
const ACCENT = '#FF6020';

// ─── Tab Panel ────────────────────────────────────────────────────────────────
function TabPanel({ children, value, index, ...other }) {
    return (
        <div role="tabpanel" hidden={value !== index} {...other}>
            {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
        </div>
    );
}

// ─── Label de producto ────────────────────────────────────────────────────────
const productLabel = (p) => {
    if (!p) return '';
    const stockTxt = p.es_servicio ? 'Servicio' : `stock: ${p.stock_actual ?? 0}`;
    return `${p.nombre} (${stockTxt})`;
};

// ─── KPI Card ─────────────────────────────────────────────────────────────────
const KpiCard = ({ label, value, icon, color }) => (
    <Paper
        sx={{
            p: 2.5, borderRadius: 3,
            display: 'flex', alignItems: 'center', gap: 2,
            boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
        }}
    >
        <Box sx={{
            width: 48, height: 48, borderRadius: 2, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: `${color}18`, color,
        }}>
            {icon}
        </Box>
        <Box>
            <Typography sx={{ fontSize: 12, color: 'text.secondary', fontWeight: 500, mb: 0.3 }}>
                {label}
            </Typography>
            <Typography sx={{ fontSize: 18, fontWeight: 700, color: 'text.primary' }}>
                {value}
            </Typography>
        </Box>
    </Paper>
);

// ─── Badge de estado ──────────────────────────────────────────────────────────
const getEstadoPagoChip = (estado) => {
    const map = {
        pagado:    { label: 'Pagada',    color: 'success' },
        parcial:   { label: 'Parcial',   color: 'warning' },
        pendiente: { label: 'Pendiente', color: 'error'   },
    };
    const p = map[estado] || { label: 'Desconocido', color: 'default' };
    return <Chip label={p.label} color={p.color} size="small" sx={{ fontWeight: 600, fontSize: 11, borderRadius: 1.5 }} />;
};

// ─── Venta Card (mobile) ──────────────────────────────────────────────────────
const VentaCard = ({ venta, handleEdit, handleDelete, handleOpenDetails }) => (
    <Paper sx={{ p: 2.5, mb: 2, borderRadius: 3, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
            <Box>
                <Typography sx={{ fontWeight: 700, fontSize: 15 }}>
                    {venta.cliente?.nombre || 'Sin cliente'}
                </Typography>
                <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
                    #{venta.id} · {new Date(venta.fecha + 'Z').toLocaleString()}
                </Typography>
            </Box>
            {getEstadoPagoChip(venta.estado_pago)}
        </Box>

        <Divider sx={{ my: 1.5 }} />

        <Box sx={{ mb: 1.5 }}>
            {venta.detalles.map(d => (
                <Typography key={d.id} sx={{ fontSize: 13, color: 'text.secondary', mb: 0.3 }}>
                    • {d.producto?.nombre} × {d.cantidad}
                </Typography>
            ))}
        </Box>

        <Grid container spacing={1} sx={{ mb: 1.5 }}>
            {[
                { label: 'Total',  val: formatCurrency(venta.total) },
                { label: 'Pagado', val: formatCurrency(venta.monto_pagado) },
                { label: 'Saldo',  val: formatCurrency(venta.total - venta.monto_pagado) },
            ].map(({ label, val }) => (
                <Grid item xs={4} key={label}>
                    <Box sx={{ textAlign: 'center', p: 1, borderRadius: 2, bgcolor: 'action.hover' }}>
                        <Typography sx={{ fontSize: 10, color: 'text.secondary', mb: 0.2 }}>{label}</Typography>
                        <Typography sx={{ fontSize: 13, fontWeight: 700 }}>{val}</Typography>
                    </Box>
                </Grid>
            ))}
        </Grid>

        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
            <Tooltip title="Ver detalle">
                <IconButton size="small" onClick={() => handleOpenDetails(venta)}
                    sx={{ color: '#3B82F6', bgcolor: '#EFF6FF', borderRadius: 1.5 }}>
                    <Visibility fontSize="small" />
                </IconButton>
            </Tooltip>
            <Tooltip title="Editar">
                <IconButton size="small" onClick={() => handleEdit(venta)}
                    sx={{ color: ACCENT, bgcolor: '#FFF0E9', borderRadius: 1.5 }}>
                    <Edit fontSize="small" />
                </IconButton>
            </Tooltip>
            <Tooltip title="Eliminar">
                <IconButton size="small" onClick={() => handleDelete(venta.id)}
                    sx={{ color: '#EF4444', bgcolor: '#FEF2F2', borderRadius: 1.5 }}>
                    <Delete fontSize="small" />
                </IconButton>
            </Tooltip>
        </Box>
    </Paper>
);

// ─── Fila de producto en formulario ───────────────────────────────────────────
const SaleDetailRow = ({ detail, productos, onProductChange, onFieldChange, onRemove, isMobile }) => (
    <Box sx={{
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        alignItems: isMobile ? 'stretch' : 'center',
        gap: 1.5, mb: 1.5, p: isMobile ? 2 : 1.5,
        borderRadius: 2, bgcolor: 'action.hover',
        border: '1px solid', borderColor: 'divider',
    }}>
        <Autocomplete
            options={productos}
            getOptionLabel={productLabel}
            value={detail.producto}
            onChange={(_, newValue) => onProductChange(detail.id, newValue)}
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
            renderInput={(params) => (
                <TextField {...params} label="Producto" placeholder="Busca por nombre…" />
            )}
            sx={{ flex: 1, minWidth: isMobile ? '100%' : 220 }}
        />

        <TextField
            type="number"
            label="Cantidad"
            value={detail.cantidad}
            onChange={(e) => {
                const isDecimal = detail.producto && ['MTS', 'KGS'].includes(detail.producto.unidad_medida);
                const parsed = isDecimal ? parseFloat(e.target.value) : parseInt(e.target.value, 10);
                onFieldChange(detail.id, 'cantidad', isNaN(parsed) ? '' : parsed);
            }}
            InputProps={{
                inputProps: {
                    step: detail.producto && ['MTS', 'KGS'].includes(detail.producto.unidad_medida) ? 'any' : '1',
                    min: 0,
                },
            }}
            sx={{ width: isMobile ? '100%' : 110 }}
        />

        <TextField
            type="number"
            label="Precio Unit."
            value={detail.precioUnitario}
            onChange={(e) => onFieldChange(detail.id, 'precioUnitario', parseFloat(e.target.value))}
            InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
            sx={{ width: isMobile ? '100%' : 140 }}
        />

        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minWidth: isMobile ? '100%' : 'auto', gap: 1 }}>
            <Typography sx={{ fontWeight: 700, fontSize: 14, color: ACCENT }}>
                {formatCurrency(detail.cantidad * detail.precioUnitario)}
            </Typography>
            <Tooltip title="Quitar">
                <IconButton onClick={() => onRemove(detail.id)} size="small"
                    sx={{ color: '#EF4444', bgcolor: '#FEF2F2', borderRadius: 1.5 }}>
                    <RemoveCircleOutline fontSize="small" />
                </IconButton>
            </Tooltip>
        </Box>
    </Box>
);

// ─── Componente principal ──────────────────────────────────────────────────────
const Ventas = () => {
    const [totalVentasHoy, setTotalVentasHoy] = useState(0);
    const [ventas, setVentas]     = useState([]);
    const [clientes, setClientes] = useState([]);
    const [productos, setProductos] = useState([]);

    const [cliente, setCliente]   = useState(null);
    const [saleDetails, setSaleDetails] = useState([{ id: Date.now(), producto: null, cantidad: 1, precioUnitario: 0 }]);
    const [ivaPorcentajeGlobal, setIvaPorcentajeGlobal] = useState(0);
    const [pagada, setPagada]     = useState(true);
    const [editingVenta, setEditingVenta] = useState(null);
    const [estadoPago, setEstadoPago]     = useState('pagada');

    const [showConfirmDialog, setShowConfirmDialog]         = useState(false);
    const [ventaToDelete, setVentaToDelete]                 = useState(null);
    const [showConfirmSaleDialog, setShowConfirmSaleDialog] = useState(false);
    const [saleToConfirm, setSaleToConfirm]                 = useState(null);

    const [detailModalOpen, setDetailModalOpen] = useState(false);
    const [selectedVenta, setSelectedVenta]     = useState(null);

    const [tabValue, setTabValue]       = useState(0);
    const [page, setPage]               = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [searchTerm, setSearchTerm]   = useState('');

    const theme    = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

    useEffect(() => {
        fetchVentas(); fetchClientes(); fetchProductos(); fetchVentasSummary();
    }, []);

    const fetchVentas    = () => apiClient.get('/ventas/').then(r => setVentas(r.data)).catch(console.error);
    const fetchClientes  = () => apiClient.get('/clientes/').then(r => setClientes(r.data)).catch(console.error);
    const fetchProductos = () => apiClient.get('/productos/').then(r =>
        setProductos(r.data.filter(p => p.es_servicio || p.grupo_item === 2))
    ).catch(console.error);
    const fetchVentasSummary = () =>
        apiClient.get('/reportes/ventas_summary').then(r => setTotalVentasHoy(r.data.total_ventas_hoy)).catch(console.error);

    useEffect(() => {
        if (editingVenta) {
            setCliente(clientes.find(c => c.id === editingVenta.cliente_id) || null);
            setSaleDetails(editingVenta.detalles.map(d => ({
                id: d.id, producto: d.producto, cantidad: d.cantidad, precioUnitario: d.precio_unitario,
            })));
            setPagada(editingVenta.estado_pago === 'pagado');
            setEstadoPago(editingVenta.estado_pago === 'pagado' ? 'pagada' : 'pendiente');
        } else {
            resetForm();
        }
    }, [editingVenta, clientes]);

    const resetForm = () => {
        setCliente(null);
        setSaleDetails([{ id: Date.now(), producto: null, cantidad: 1, precioUnitario: 0 }]);
        setIvaPorcentajeGlobal(0);
        setPagada(true);
        setEstadoPago('pagada');
        setEditingVenta(null);
    };

    const handleAddSaleDetail = () =>
        setSaleDetails(p => [...p, { id: Date.now(), producto: null, cantidad: 1, precioUnitario: 0 }]);
    const handleRemoveSaleDetail = (id) =>
        setSaleDetails(p => p.filter(d => d.id !== id));
    const handleFieldChange = (id, field, value) =>
        setSaleDetails(p => p.map(d => d.id === id ? { ...d, [field]: value } : d));
    const handleProductChange = (id, newValue) => {
        handleFieldChange(id, 'producto', newValue);
        handleFieldChange(id, 'precioUnitario', newValue?.precio ?? 0);
    };
    const calculateSubtotal = () =>
        saleDetails.reduce((t, d) => t + d.cantidad * d.precioUnitario, 0);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!cliente || saleDetails.some(d => !d.producto || d.cantidad <= 0)) {
            toast.error('Selecciona un cliente y verifica que todos los productos tengan cantidad válida.');
            return;
        }
        const ventaData = {
            cliente_id: cliente.id,
            detalles: saleDetails.map(({ producto, cantidad, precioUnitario }) => ({
                producto_id: producto.id, cantidad, precio_unitario: precioUnitario, iva_porcentaje: 0.0,
            })),
            pagada,
            iva_porcentaje: parseFloat(ivaPorcentajeGlobal),
        };
        setSaleToConfirm(ventaData);
        setShowConfirmSaleDialog(true);
    };

    const confirmSale = () => {
        if (!saleToConfirm) return;
        const req = editingVenta
            ? apiClient.put(`/ventas/${editingVenta.id}`, saleToConfirm)
            : apiClient.post('/ventas/', saleToConfirm);
        req.then(() => {
            toast.success(`Venta ${editingVenta ? 'actualizada' : 'registrada'} exitosamente`);
            fetchVentas(); fetchVentasSummary(); resetForm(); setTabValue(1);
        }).catch(err => toast.error(err.response?.data?.detail || 'Error al guardar la venta.'))
          .finally(() => { setShowConfirmSaleDialog(false); setSaleToConfirm(null); });
    };

    const handleDelete   = (id) => { setVentaToDelete(id); setShowConfirmDialog(true); };
    const confirmDelete  = () => {
        apiClient.delete(`/ventas/${ventaToDelete}`)
            .then(() => { toast.success('Venta eliminada'); fetchVentas(); fetchVentasSummary(); })
            .catch(() => toast.error('Error al eliminar la venta.'))
            .finally(() => { setShowConfirmDialog(false); setVentaToDelete(null); });
    };
    const handleEdit = (v) => { setEditingVenta(v); setTabValue(0); };
    const handleOpenDetails  = (v) => { setSelectedVenta(v); setDetailModalOpen(true); };
    const handleCloseDetails = ()  => { setDetailModalOpen(false); setSelectedVenta(null); };

    const filteredVentas  = [...ventas]
        .filter(v => (v.cliente?.nombre || '').toLowerCase().includes(searchTerm.toLowerCase()))
        .sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    const paginatedVentas = filteredVentas.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

    const totalPendiente = ventas.filter(v => v.estado_pago === 'pendiente')
        .reduce((s, v) => s + (v.total - v.monto_pagado), 0);

    return (
        <Box sx={{ width: '100%' }}>

            {/* ── Header ── */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Box sx={{ width: 40, height: 40, borderRadius: 2, bgcolor: `${ACCENT}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: ACCENT }}>
                        <ShoppingCart />
                    </Box>
                    <Box>
                        <Typography sx={{ fontWeight: 700, fontSize: 20, lineHeight: 1.2 }}>Ventas</Typography>
                        <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>Gestión de ventas y cobros</Typography>
                    </Box>
                </Box>
                <Button
                    variant="contained"
                    startIcon={<AddCircleOutline />}
                    onClick={() => { resetForm(); setTabValue(0); }}
                    sx={{ background: `linear-gradient(135deg, ${ACCENT}, #ff9a62)`, boxShadow: `0 4px 14px rgba(255,96,32,0.35)`, borderRadius: 2, fontWeight: 600 }}
                >
                    Nueva Venta
                </Button>
            </Box>

            {/* ── KPIs ── */}
            <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={12} sm={4}>
                    <KpiCard label="Ventas hoy" value={formatCurrency(totalVentasHoy)} icon={<TrendingUp />} color={ACCENT} />
                </Grid>
                <Grid item xs={12} sm={4}>
                    <KpiCard label="Total registros" value={ventas.length} icon={<Receipt />} color="#3B82F6" />
                </Grid>
                <Grid item xs={12} sm={4}>
                    <KpiCard label="Cartera pendiente" value={formatCurrency(totalPendiente)} icon={<AttachMoney />} color="#EF4444" />
                </Grid>
            </Grid>

            {/* ── Tabs container ── */}
            <Paper sx={{ borderRadius: 3, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
                <Tabs
                    value={tabValue}
                    onChange={(_, v) => setTabValue(v)}
                    sx={{
                        px: 2,
                        borderBottom: '1px solid', borderColor: 'divider',
                        '& .MuiTab-root': { fontWeight: 600, fontSize: 13.5, textTransform: 'none', minHeight: 52 },
                        '& .MuiTabs-indicator': { backgroundColor: ACCENT, height: 3, borderRadius: 3 },
                        '& .Mui-selected': { color: `${ACCENT} !important` },
                    }}
                >
                    <Tab label={editingVenta ? '✏️ Editar Venta' : '➕ Registrar Venta'} />
                    <Tab label={`📋 Historial (${ventas.length})`} />
                </Tabs>

                {/* ══ Tab 0: Formulario ══ */}
                <TabPanel value={tabValue} index={0}>
                    <Box sx={{ p: { xs: 2, md: 3 } }}>
                        <Box component="form" onSubmit={handleSubmit}>

                            {/* Cliente */}
                            <Box sx={{ mb: 3 }}>
                                <Typography sx={{ fontWeight: 600, fontSize: 12, mb: 1, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.6 }}>
                                    Cliente
                                </Typography>
                                <Autocomplete
                                    options={clientes}
                                    getOptionLabel={(o) => o.nombre}
                                    value={cliente}
                                    onChange={(_, v) => setCliente(v)}
                                    renderInput={(params) => <TextField {...params} label="Seleccionar cliente" required fullWidth />}
                                />
                            </Box>

                            {/* Productos */}
                            <Box sx={{ mb: 3 }}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                    <Typography sx={{ fontWeight: 600, fontSize: 12, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.6 }}>
                                        Productos / Servicios
                                    </Typography>
                                    <Button size="small" startIcon={<AddCircleOutline />} onClick={handleAddSaleDetail}
                                        sx={{ color: ACCENT, fontWeight: 600 }}>
                                        Añadir ítem
                                    </Button>
                                </Box>
                                {saleDetails.map(detail => (
                                    <SaleDetailRow
                                        key={detail.id}
                                        detail={detail}
                                        productos={productos}
                                        onProductChange={handleProductChange}
                                        onFieldChange={handleFieldChange}
                                        onRemove={handleRemoveSaleDetail}
                                        isMobile={isMobile}
                                    />
                                ))}
                            </Box>

                            <Divider sx={{ mb: 3 }} />

                            {/* Totales */}
                            <Grid container spacing={2} alignItems="center">
                                <Grid item xs={12} sm={3}>
                                    <TextField
                                        label="% IVA Global (Incluido)"
                                        type="number"
                                        value={ivaPorcentajeGlobal}
                                        onChange={(e) => setIvaPorcentajeGlobal(e.target.value)}
                                        fullWidth
                                        helperText="El total no cambia"
                                    />
                                </Grid>

                                <Grid item xs={12} sm={3}>
                                    <Paper sx={{
                                        p: 2, borderRadius: 2, textAlign: 'center',
                                        bgcolor: `${ACCENT}0D`, border: `1.5px dashed ${ACCENT}60`, boxShadow: 'none',
                                    }}>
                                        <Typography sx={{ fontSize: 11, color: 'text.secondary', mb: 0.5 }}>Total Factura</Typography>
                                        <Typography sx={{ fontSize: 22, fontWeight: 800, color: ACCENT }}>
                                            {formatCurrency(calculateSubtotal())}
                                        </Typography>
                                    </Paper>
                                </Grid>

                                <Grid item xs={12} sm={6}>
                                    <Box sx={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 2, alignItems: isMobile ? 'stretch' : 'center', justifyContent: 'flex-end' }}>
                                        <ToggleButtonGroup
                                            value={estadoPago} exclusive
                                            onChange={(_, v) => { if (v !== null) { setEstadoPago(v); setPagada(v === 'pagada'); } }}
                                            sx={{
                                                '& .MuiToggleButton-root': { fontWeight: 600, fontSize: 13, textTransform: 'none', borderRadius: '8px !important', px: 2 },
                                                '& .Mui-selected[value="pagada"]':   { bgcolor: '#DCFCE7 !important', color: '#16a34a !important', borderColor: '#22c55e !important' },
                                                '& .Mui-selected[value="pendiente"]':{ bgcolor: '#FEF2F2 !important', color: '#dc2626 !important', borderColor: '#EF4444 !important' },
                                            }}
                                        >
                                            <ToggleButton value="pagada">💰 Efectivo</ToggleButton>
                                            <ToggleButton value="pendiente">🕒 Por Cobrar</ToggleButton>
                                        </ToggleButtonGroup>

                                        <Box sx={{ display: 'flex', gap: 1 }}>
                                            {editingVenta && (
                                                <Button onClick={resetForm} variant="outlined"
                                                    sx={{ borderRadius: 2, fontWeight: 600, borderColor: 'divider' }}>
                                                    Cancelar
                                                </Button>
                                            )}
                                            <Button type="submit" variant="contained"
                                                sx={{ background: `linear-gradient(135deg, ${ACCENT}, #ff9a62)`, boxShadow: `0 4px 14px rgba(255,96,32,0.35)`, borderRadius: 2, fontWeight: 600, px: 3 }}>
                                                {editingVenta ? 'Actualizar' : 'Registrar Venta'}
                                            </Button>
                                        </Box>
                                    </Box>
                                </Grid>
                            </Grid>
                        </Box>
                    </Box>
                </TabPanel>

                {/* ══ Tab 1: Historial ══ */}
                <TabPanel value={tabValue} index={1}>
                    <Box sx={{ px: { xs: 2, md: 3 }, pb: 3 }}>
                        <Box sx={{ mb: 2.5 }}>
                            <TextField
                                fullWidth
                                placeholder="Buscar por nombre de cliente…"
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
                                {paginatedVentas.length === 0
                                    ? <Box sx={{ textAlign: 'center', py: 6, color: 'text.secondary' }}>
                                        <Receipt sx={{ fontSize: 48, mb: 1, opacity: 0.3 }} />
                                        <Typography>No se encontraron ventas</Typography>
                                      </Box>
                                    : paginatedVentas.map(v => (
                                        <VentaCard key={v.id} venta={v}
                                            handleEdit={handleEdit} handleDelete={handleDelete}
                                            handleOpenDetails={handleOpenDetails} />
                                    ))
                                }
                            </Box>
                        ) : (
                            <TableContainer sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                                <Table size="small">
                                    <TableHead>
                                        <TableRow>
                                            {['#', 'Cliente', 'Productos', 'Total', 'Pagado', 'Saldo', 'Estado', 'Fecha', 'Acciones'].map(h => (
                                                <TableCell key={h}>{h}</TableCell>
                                            ))}
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {paginatedVentas.length === 0
                                            ? <TableRow>
                                                <TableCell colSpan={9} sx={{ textAlign: 'center', py: 6, color: 'text.secondary' }}>
                                                    No se encontraron ventas
                                                </TableCell>
                                              </TableRow>
                                            : paginatedVentas.map(v => (
                                                <TableRow key={v.id} hover>
                                                    <TableCell sx={{ fontWeight: 600, color: 'text.secondary', fontSize: 12 }}>#{v.id}</TableCell>
                                                    <TableCell sx={{ fontWeight: 600 }}>{v.cliente?.nombre || 'N/A'}</TableCell>
                                                    <TableCell>
                                                        {v.detalles.map(d => (
                                                            <Typography key={d.id} sx={{ fontSize: 12, color: 'text.secondary' }}>
                                                                {d.producto?.nombre} × {d.cantidad}
                                                            </Typography>
                                                        ))}
                                                    </TableCell>
                                                    <TableCell sx={{ fontWeight: 700 }}>{formatCurrency(v.total)}</TableCell>
                                                    <TableCell sx={{ color: '#16a34a', fontWeight: 600 }}>{formatCurrency(v.monto_pagado)}</TableCell>
                                                    <TableCell sx={{ color: v.total - v.monto_pagado > 0 ? '#EF4444' : 'text.primary', fontWeight: 600 }}>
                                                        {formatCurrency(v.total - v.monto_pagado)}
                                                    </TableCell>
                                                    <TableCell>{getEstadoPagoChip(v.estado_pago)}</TableCell>
                                                    <TableCell sx={{ fontSize: 12, color: 'text.secondary', whiteSpace: 'nowrap' }}>
                                                        {new Date(v.fecha + 'Z').toLocaleString()}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Box sx={{ display: 'flex', gap: 0.5 }}>
                                                            <Tooltip title="Ver detalle">
                                                                <IconButton size="small" onClick={() => handleOpenDetails(v)}
                                                                    sx={{ color: '#3B82F6', '&:hover': { bgcolor: '#EFF6FF' } }}>
                                                                    <Visibility fontSize="small" />
                                                                </IconButton>
                                                            </Tooltip>
                                                            <Tooltip title="Editar">
                                                                <IconButton size="small" onClick={() => handleEdit(v)}
                                                                    sx={{ color: ACCENT, '&:hover': { bgcolor: '#FFF0E9' } }}>
                                                                    <Edit fontSize="small" />
                                                                </IconButton>
                                                            </Tooltip>
                                                            <Tooltip title="Eliminar">
                                                                <IconButton size="small" onClick={() => handleDelete(v.id)}
                                                                    sx={{ color: '#EF4444', '&:hover': { bgcolor: '#FEF2F2' } }}>
                                                                    <Delete fontSize="small" />
                                                                </IconButton>
                                                            </Tooltip>
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
                            count={filteredVentas.length}
                            rowsPerPage={rowsPerPage}
                            page={page}
                            onPageChange={(_, p) => setPage(p)}
                            onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
                            labelRowsPerPage="Filas:"
                            labelDisplayedRows={({ from, to, count }) => `${from}–${to} de ${count}`}
                        />
                    </Box>
                </TabPanel>
            </Paper>

            {/* Diálogos */}
            <ConfirmationDialog
                open={showConfirmDialog}
                handleClose={() => setShowConfirmDialog(false)}
                handleConfirm={confirmDelete}
                title="Eliminar venta"
                message="¿Estás seguro de que quieres eliminar esta venta? Esta acción no se puede deshacer."
            />
            <ConfirmationDialog
                open={showConfirmSaleDialog}
                handleClose={() => setShowConfirmSaleDialog(false)}
                handleConfirm={confirmSale}
                title="Confirmar venta"
                message={`¿Confirmas el registro de esta venta por ${formatCurrency(calculateSubtotal())}?`}
            />
            <VentaDetailDialog
                open={detailModalOpen}
                handleClose={handleCloseDetails}
                venta={selectedVenta}
            />
        </Box>
    );
};

export default Ventas;
