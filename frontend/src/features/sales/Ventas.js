import React, { useState, useEffect, useRef, useCallback } from 'react';
import apiClient from '../../api';
import { formatCurrency } from '../../utils/formatters';
import { toast } from 'react-toastify';
import CurrencyField from '../../components/common/CurrencyField';
import ConfirmationDialog from '../../components/common/ConfirmationDialog';
import VentaDetailDialog from './VentaDetailDialog';
import DevolucionDialog from './DevolucionDialog';
import QuickCreateModal from '../../components/common/QuickCreateModal';
import ReciboDialog from '../../components/common/ReciboDialog';
import LinkPagoModal from '../../components/common/LinkPagoModal';
import TouchPOSMode from './TouchPOSMode';
import {
    Box, Paper, Typography, Grid, TextField, Button, IconButton,
    Autocomplete, Table, TableBody, TableCell, TableContainer,
    TableHead, TableRow, Chip, useMediaQuery, useTheme, Tabs, Tab,
    TablePagination, Divider, Tooltip, InputAdornment, CircularProgress,
    ToggleButton, ToggleButtonGroup, Switch, FormControlLabel,
} from '@mui/material';
import {
    Edit, Delete, Visibility, Search, ShoppingCart, TrendingUp,
    Receipt, AttachMoney, AssignmentReturn, Add, QrCodeScanner,
    Videocam, VideocamOff, LockOutlined, LockOpenOutlined,
    AddCircle, RemoveCircle, PersonOutline, HelpOutline,
    Keyboard, TouchApp, FileDownload, Stars, CreditCard,
} from '@mui/icons-material';
import { getProductoByBarcode } from '../../api';
import HelpGuideTopBar from '../../components/onboarding/HelpGuideTopBar';
import SmartTooltip from '../../components/onboarding/SmartTooltip';
import BasculaWidget from '../../components/common/BasculaWidget';
import { esPesable } from '../../hooks/useBascula';
import VarianteSelectorDialog from '../../components/common/VarianteSelectorDialog';

const ACCENT = '#FF6020';
const HAS_BARCODE_DETECTOR = typeof window !== 'undefined' && 'BarcodeDetector' in window;
const HAS_CAMERA = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
const BARCODE_FORMATS = ['ean_13', 'ean_8', 'code_128', 'qr_code', 'upc_e', 'code_39', 'itf'];

const METODOS_PAGO = [
    { value: 'Efectivo',      label: '💵 Efectivo',      pagada: true,  color: '#10B981' },
    { value: 'Transferencia', label: '🏦 Transferencia',  pagada: true,  color: '#3B82F6' },
    { value: 'Nequi',         label: '💜 Nequi',          pagada: true,  color: '#7C3AED' },
    { value: 'Daviplata',     label: '🔵 Daviplata',      pagada: true,  color: '#2563EB' },
    { value: 'Tarjeta',       label: '💳 Tarjeta',        pagada: true,  color: '#8B5CF6' },
    { value: 'Cheque',        label: '📄 Cheque',         pagada: true,  color: '#6B7280' },
    { value: 'Por Cobrar',    label: '🕒 Por Cobrar',     pagada: false, color: '#EF4444' },
    { value: 'Link de Pago',  label: '📲 Link/QR',        pagada: true,  color: '#FF6020', digital: true },
];

const PUNTOS_REDEEM_RATE_DEFAULT = 100;

// ─── Tab Panel ────────────────────────────────────────────────────────────────
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
        <Box sx={{ width: 48, height: 48, borderRadius: 2, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: `${color}18`, color }}>
            {icon}
        </Box>
        <Box>
            <Typography sx={{ fontSize: 12, color: 'text.secondary', fontWeight: 500, mb: 0.3 }}>{label}</Typography>
            <Typography sx={{ fontSize: 18, fontWeight: 700, color: 'text.primary' }}>{value}</Typography>
        </Box>
    </Paper>
);

// ─── Badge de estado ──────────────────────────────────────────────────────────
const getEstadoPagoChip = (estado) => {
    const map = { pagado: { label: 'Pagada', color: 'success' }, parcial: { label: 'Parcial', color: 'warning' }, pendiente: { label: 'Pendiente', color: 'error' } };
    const p = map[estado] || { label: 'Desconocido', color: 'default' };
    return <Chip label={p.label} color={p.color} size="small" sx={{ fontWeight: 600, fontSize: 11, borderRadius: 1.5 }} />;
};

// ─── Venta Card (mobile) ──────────────────────────────────────────────────────
const VentaCard = ({ venta, handleEdit, handleDelete, handleOpenDetails, handleOpenDevolucion }) => (
    <Paper sx={{ p: 2.5, mb: 2, borderRadius: 3, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
            <Box>
                <Typography sx={{ fontWeight: 700, fontSize: 15 }}>{venta.cliente?.nombre || 'Sin cliente'}</Typography>
                <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>#{venta.id} · {new Date(venta.fecha + 'Z').toLocaleString()}</Typography>
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
            {[{ label: 'Total', val: formatCurrency(venta.total) }, { label: 'Pagado', val: formatCurrency(venta.monto_pagado) }, { label: 'Saldo', val: formatCurrency(venta.total - venta.monto_pagado) }].map(({ label, val }) => (
                <Grid item xs={4} key={label}>
                    <Box sx={{ textAlign: 'center', p: 1, borderRadius: 2, bgcolor: 'action.hover' }}>
                        <Typography sx={{ fontSize: 10, color: 'text.secondary', mb: 0.2 }}>{label}</Typography>
                        <Typography sx={{ fontSize: 13, fontWeight: 700 }}>{val}</Typography>
                    </Box>
                </Grid>
            ))}
        </Grid>
        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
            <Tooltip title="Ver detalle"><IconButton size="small" onClick={() => handleOpenDetails(venta)} sx={{ color: '#3B82F6', bgcolor: '#EFF6FF', borderRadius: 1.5 }}><Visibility fontSize="small" /></IconButton></Tooltip>
            {venta.detalles?.length > 0 && (
                <Tooltip title="Registrar devolución"><IconButton size="small" onClick={() => handleOpenDevolucion(venta)} sx={{ color: '#F59E0B', bgcolor: '#FFFBEB', borderRadius: 1.5 }}><AssignmentReturn fontSize="small" /></IconButton></Tooltip>
            )}
            <Tooltip title="Editar"><IconButton size="small" onClick={() => handleEdit(venta)} sx={{ color: ACCENT, bgcolor: '#FFF0E9', borderRadius: 1.5 }}><Edit fontSize="small" /></IconButton></Tooltip>
            <Tooltip title="Eliminar"><IconButton size="small" onClick={() => handleDelete(venta.id)} sx={{ color: '#EF4444', bgcolor: '#FEF2F2', borderRadius: 1.5 }}><Delete fontSize="small" /></IconButton></Tooltip>
        </Box>
    </Paper>
);

// ─── Fila de producto en el carrito ──────────────────────────────────────────
const SaleDetailRow = ({ detail, productos, onProductChange, onFieldChange, onRemove, isMobile, productoInput, onProductoInputChange, openQuickCreate }) => {
    const [priceUnlocked, setPriceUnlocked] = useState(false);

    const subtotalSinDesc = detail.cantidad * detail.precioUnitario;
    const descuentoMonto = subtotalSinDesc * ((detail.descuentoPct || 0) / 100);
    const subtotalFinal = subtotalSinDesc - descuentoMonto;
    const stock = detail.producto?.stock_actual ?? null;
    const isService = detail.producto?.es_servicio;
    const stockBajo = !isService && stock !== null && stock <= (detail.producto?.stock_minimo ?? 0);

    const handleQty = (delta) => {
        const isDecimal = detail.producto && ['MTS', 'KGS', 'LTS'].includes(detail.producto.unidad_medida);
        const next = isDecimal
            ? Math.max(0, parseFloat((detail.cantidad + delta).toFixed(2)))
            : Math.max(0, Math.round(detail.cantidad + delta));
        onFieldChange(detail.id, 'cantidad', next);
    };

    return (
        <Box sx={{
            display: 'flex', flexDirection: isMobile ? 'column' : 'row',
            alignItems: isMobile ? 'stretch' : 'center',
            gap: 1, mb: 1.5, p: isMobile ? 2 : 1.5,
            borderRadius: 2, bgcolor: 'action.hover',
            border: '1px solid', borderColor: stockBajo ? '#F59E0B50' : 'divider',
        }}>
            {/* Producto */}
            <Box sx={{ flex: 1, minWidth: isMobile ? '100%' : 200 }}>
                <Autocomplete
                    options={productos}
                    getOptionLabel={(p) => p?.nombre || ''}
                    value={detail.producto}
                    onChange={(_, v) => { onProductChange(detail.id, v); setPriceUnlocked(false); }}
                    inputValue={productoInput}
                    onInputChange={(_, v) => onProductoInputChange(v)}
                    filterOptions={(opts, state) => {
                        const q = (state.inputValue || '').toLowerCase().trim();
                        if (!q) return opts;
                        return opts.filter(o =>
                            o.nombre.toLowerCase().includes(q) ||
                            (o.codigo_barras && o.codigo_barras.toLowerCase().includes(q)) ||
                            (o.descripcion && o.descripcion.toLowerCase().includes(q))
                        );
                    }}
                    noOptionsText={
                        <Box sx={{ py: 0.5 }}>
                            <Typography sx={{ fontSize: 13, color: 'text.secondary', mb: 1 }}>No se encontró el producto</Typography>
                            <Button size="small" variant="contained" fullWidth startIcon={<Add />} onClick={openQuickCreate}
                                sx={{ borderRadius: 2, fontWeight: 600, fontSize: 12, bgcolor: '#10B981', '&:hover': { bgcolor: '#059669' } }}>
                                Crear "{productoInput || 'nuevo producto'}"
                            </Button>
                        </Box>
                    }
                    renderOption={(props, option) => (
                        <li {...props} key={option.id}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%', gap: 2, alignItems: 'center' }}>
                                <Box>
                                    <Typography sx={{ fontSize: 13.5, fontWeight: 500 }}>{option.nombre}</Typography>
                                    {option.descripcion && (
                                        <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{option.descripcion}</Typography>
                                    )}
                                </Box>
                                <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
                                    <Typography sx={{ fontSize: 12, fontWeight: 700, color: ACCENT }}>{formatCurrency(option.precio)}</Typography>
                                    <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                                        <Typography sx={{ fontSize: 10, color: option.es_servicio ? '#3B82F6' : (option.stock_actual <= 0 ? '#EF4444' : 'text.secondary') }}>
                                            {option.es_servicio ? 'Servicio' : `Stock: ${option.stock_actual ?? 0}`}
                                        </Typography>
                                        {option.impuesto && (
                                            <Typography sx={{ fontSize: 10, fontWeight: 700, color: option.impuesto.porcentaje > 0 ? '#F43F5E' : '#10B981' }}>
                                                {option.impuesto.codigo}
                                            </Typography>
                                        )}
                                    </Box>
                                </Box>
                            </Box>
                        </li>
                    )}
                    renderInput={(params) => (
                        <TextField {...params} size="small" label="Producto / Servicio" placeholder="Busca por nombre…"
                            InputProps={{
                                ...params.InputProps,
                                endAdornment: (<>{params.InputProps.endAdornment}<Tooltip title="Crear nuevo producto"><IconButton size="small" onClick={openQuickCreate} sx={{ color: '#10B981', p: 0.5 }}><Add fontSize="small" /></IconButton></Tooltip></>),
                            }}
                        />
                    )}
                />
                {/* Stock badge + impuesto badge */}
                {detail.producto && (
                    <Box sx={{ display: 'flex', gap: 0.8, mt: 0.4, flexWrap: 'wrap' }}>
                        {!isService && stock !== null && (
                            <Typography sx={{ fontSize: 10, color: stockBajo ? '#F59E0B' : 'text.disabled', fontWeight: 600 }}>
                                {stockBajo ? `⚠ Stock bajo: ${stock}` : `Stock: ${stock}`}
                            </Typography>
                        )}
                        {detail.producto.impuesto && (
                            <Box component="span" sx={{ fontSize: 10, fontWeight: 700, color: detail.producto.impuesto.porcentaje > 0 ? '#F43F5E' : '#10B981', bgcolor: detail.producto.impuesto.porcentaje > 0 ? '#F43F5E18' : '#10B98118', px: 0.8, py: 0.2, borderRadius: 1 }}>
                                {detail.producto.impuesto.codigo} {detail.producto.impuesto.porcentaje}%
                            </Box>
                        )}
                    </Box>
                )}
            </Box>

            {/* Cantidad con +/- */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: isMobile ? '100%' : 'auto' }}>
                <IconButton size="small" onClick={() => handleQty(-1)} sx={{ color: '#EF4444', p: 0.5 }}>
                    <RemoveCircle fontSize="small" />
                </IconButton>
                <TextField
                    type="number" size="small"
                    value={detail.cantidad}
                    onChange={(e) => {
                        const isDecimal = detail.producto && ['MTS', 'KGS', 'LTS'].includes(detail.producto.unidad_medida);
                        const parsed = isDecimal ? parseFloat(e.target.value) : parseInt(e.target.value, 10);
                        onFieldChange(detail.id, 'cantidad', isNaN(parsed) ? 0 : parsed);
                    }}
                    inputProps={{ min: 0, step: detail.producto && ['MTS', 'KGS', 'LTS'].includes(detail.producto.unidad_medida) ? 'any' : '1' }}
                    sx={{ width: 64, '& input': { textAlign: 'center', fontWeight: 700, fontSize: 14, p: '6px 4px' } }}
                />
                <IconButton size="small" onClick={() => handleQty(1)} sx={{ color: '#10B981', p: 0.5 }}>
                    <AddCircle fontSize="small" />
                </IconButton>
            </Box>

            {/* Precio (bloqueado por defecto) */}
            <Box sx={{ minWidth: isMobile ? '100%' : 120 }}>
                {priceUnlocked ? (
                    <CurrencyField
                        label="Precio" size="small"
                        value={detail.precioUnitario}
                        onChange={(val) => onFieldChange(detail.id, 'precioUnitario', val)}
                        InputProps={{
                            endAdornment: (
                                <Tooltip title="Bloquear precio">
                                    <IconButton size="small" onClick={() => setPriceUnlocked(false)} sx={{ p: 0.3 }}>
                                        <LockOpenOutlined sx={{ fontSize: 14, color: ACCENT }} />
                                    </IconButton>
                                </Tooltip>
                            )
                        }}
                    />
                ) : (
                    <Tooltip title="Clic para editar precio">
                        <Box onClick={() => setPriceUnlocked(true)} sx={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            px: 1.5, py: 0.8, borderRadius: 1.5, cursor: 'pointer',
                            border: '1px dashed', borderColor: 'divider',
                            '&:hover': { borderColor: ACCENT, bgcolor: `${ACCENT}06` },
                            transition: 'all 0.15s',
                        }}>
                            <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{formatCurrency(detail.precioUnitario)}</Typography>
                            <LockOutlined sx={{ fontSize: 12, color: 'text.disabled', ml: 0.5 }} />
                        </Box>
                    </Tooltip>
                )}
            </Box>

            {/* Desc % (compacto) */}
            <SmartTooltip
                id="venta_descuento"
                title="Descuento por ítem"
                description="Ingresa un % de descuento para este producto. El subtotal se ajusta automáticamente."
                variant="warning"
                placement="top"
            >
                <TextField
                    type="number" size="small" label="Desc. %"
                    value={detail.descuentoPct || 0}
                    onChange={(e) => onFieldChange(detail.id, 'descuentoPct', Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)))}
                    inputProps={{ min: 0, max: 100, step: 1 }}
                    sx={{ width: isMobile ? '100%' : 68 }}
                />
            </SmartTooltip>

            {/* Subtotal + quitar */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: isMobile ? '100%' : 'auto', justifyContent: isMobile ? 'space-between' : 'flex-end' }}>
                <Box sx={{ textAlign: 'right' }}>
                    {(detail.descuentoPct || 0) > 0 && (
                        <Typography sx={{ fontSize: 10, color: 'text.secondary', textDecoration: 'line-through' }}>{formatCurrency(subtotalSinDesc)}</Typography>
                    )}
                    <Typography sx={{ fontWeight: 800, fontSize: 14, color: (detail.descuentoPct || 0) > 0 ? '#10B981' : ACCENT }}>
                        {formatCurrency(subtotalFinal)}
                    </Typography>
                </Box>
                <Tooltip title="Quitar">
                    <IconButton onClick={() => onRemove(detail.id)} size="small" sx={{ color: '#EF4444', bgcolor: '#FEF2F2', borderRadius: 1.5 }}>
                        <RemoveCircle fontSize="small" />
                    </IconButton>
                </Tooltip>
            </Box>
        </Box>
    );
};

// ─── Componente principal ──────────────────────────────────────────────────────
const Ventas = ({ user }) => {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

    // ── Data ──
    const [totalVentasHoy, setTotalVentasHoy] = useState(0);
    const [ventas, setVentas]       = useState([]);
    const [clientes, setClientes]   = useState([]);
    const [productos, setProductos] = useState([]);
    const [grupos, setGrupos]       = useState([]);

    // ── UI Mode ──
    const [viewMode, setViewMode] = useState(localStorage.getItem('ventas_view_mode') || 'classic');

    // ── Form ──
    const [cliente, setCliente]     = useState(null);
    const [isMostrador, setIsMostrador] = useState(false);
    const [saleDetails, setSaleDetails] = useState([{ id: Date.now(), producto: null, cantidad: 1, precioUnitario: 0, descuentoPct: 0 }]);
    const [ivaPorcentajeGlobal, setIvaPorcentajeGlobal] = useState(19);
    const [valorRecibido, setValorRecibido] = useState(0);
    const [pagada, setPagada]       = useState(true);
    const [metodoPago, setMetodoPago] = useState('Efectivo');
    const [editingVenta, setEditingVenta] = useState(null);
    const [savingVenta, setSavingVenta]   = useState(false);

    // ── Fidelización ──
    const [clientePuntos, setClientePuntos]   = useState(0);
    const [puntosACanjear, setPuntosACanjear] = useState(0);
    const [configFidelizacion, setConfigFidelizacion] = useState({
        activa: true, redeem_rate: PUNTOS_REDEEM_RATE_DEFAULT,
    });
    // ── Omitir inventario (local, por venta, se resetea con cada nueva venta) ──
    const [omitirInventario, setOmitirInventario] = useState(false);
    // Ref para que handleVentaSubmit siempre lea el valor más reciente
    // incluso cuando es llamado desde el callback de LinkPagoModal
    const omitirInventarioRef = useRef(false);
    omitirInventarioRef.current = omitirInventario;
    // ── Link de Pago POS ──
    const [linkPagoConfig, setLinkPagoConfig] = useState(null);
    const [linkPagoModalOpen, setLinkPagoModalOpen] = useState(false);
    const pendingVentaRef = useRef(null);

    // ── Barcode / Camera ──
    const [barcodeInput, setBarcodeInput]     = useState('');
    const [cameraActive, setCameraActive]     = useState(false);
    const [searchingBarcode, setSearchingBarcode] = useState(false);
    const [scanFlash, setScanFlash]           = useState(false);
    const barcodeFieldRef  = useRef(null);
    const videoRef         = useRef(null);
    const streamRef        = useRef(null);
    const rAFRef           = useRef(null);
    const zxingControlsRef = useRef(null);
    const scanCooldownRef  = useRef(false);

    // ── UI ──
    const [clienteInput, setClienteInput] = useState('');
    const [productoInputs, setProductoInputs] = useState({});
    const [quickCreate, setQuickCreate] = useState({ open: false, type: 'tercero', initialName: '', targetIdx: null });
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [ventaToDelete, setVentaToDelete]       = useState(null);
    const [detailModalOpen, setDetailModalOpen]   = useState(false);
    const [selectedVenta, setSelectedVenta]       = useState(null);
    const [devolucionOpen, setDevolucionOpen]     = useState(false);
    const [ventaDevolucion, setVentaDevolucion]   = useState(null);
    const [reciboOpen, setReciboOpen]             = useState(false);
    const [reciboVenta, setReciboVenta]           = useState(null);
    const [basculaProducto,  setBasculaProducto]  = useState(null);
    const [varianteProducto, setVarianteProducto] = useState(null); // producto con variantes esperando selección
    const [tabValue, setTabValue]                 = useState(0);
    const [page, setPage]                         = useState(0);
    const [rowsPerPage, setRowsPerPage]           = useState(10);
    const [searchTerm, setSearchTerm]             = useState('');
    const [fechaInicio, setFechaInicio]           = useState('');
    const [fechaFin, setFechaFin]                 = useState('');

    // ── Fetch inicial ──
    useEffect(() => {
        fetchVentas(); fetchClientes(); fetchProductos(); fetchVentasSummary(); fetchGrupos();
        apiClient.get('/empresa/link-pago').then(r => setLinkPagoConfig(r.data)).catch(() => {});
        apiClient.get('/empresa/config-ventas').then(r => setConfigFidelizacion({
            activa:      r.data.fidelizacion_activa     ?? true,
            redeem_rate: r.data.fidelizacion_redeem_rate ?? PUNTOS_REDEEM_RATE_DEFAULT,
        })).catch(() => {});
    }, []);

    const fetchVentas        = () => apiClient.get('/ventas/').then(r => setVentas(r.data)).catch(console.error);
    const fetchClientes      = () => apiClient.get('/clientes/').then(r => setClientes(r.data)).catch(console.error);
    const fetchClientePuntos = useCallback((clienteId) => {
        if (!clienteId) { setClientePuntos(0); setPuntosACanjear(0); return; }
        apiClient.get(`/clientes/${clienteId}/puntos`)
            .then(r => setClientePuntos(r.data.puntos_disponibles || 0))
            .catch(() => setClientePuntos(0));
    }, []);
    const fetchProductos     = () => apiClient.get('/productos/', { params: { solo_pos: true } }).then(r => setProductos(r.data)).catch(console.error);
    const fetchGrupos        = () => apiClient.get('/grupos-producto/').then(r => setGrupos(r.data)).catch(console.error);
    const fetchVentasSummary = () => apiClient.get('/reportes/ventas_summary').then(r => setTotalVentasHoy(r.data.total_ventas_hoy)).catch(console.error);

useEffect(() => {
        fetchClientePuntos(cliente?.id || null);
        setPuntosACanjear(0);
    }, [cliente, fetchClientePuntos]);

    const handleViewModeChange = (event, newMode) => {
        if (newMode !== null) {
            setViewMode(newMode);
            localStorage.setItem('ventas_view_mode', newMode);
        }
    };

    // ── Touch mode cart ops ──
    const handleAddToCartDirect = (producto) => {
        // Variantes: mostrar selector primero
        if (producto.tiene_variantes && producto.variantes?.length > 0) {
            setVarianteProducto(producto);
            return;
        }
        // Pesable: abrir báscula
        if (esPesable(producto.unidad_medida)) {
            setBasculaProducto(producto);
            return;
        }
        _agregarAlCarritoSimple(producto, 1, producto.precio || 0, null, null);
    };

    const _agregarAlCarritoSimple = (producto, cantidad, precioUnitario, varianteId, nombreVariante) => {
        setSaleDetails(prev => {
            // Para productos con variante, la clave del carrito incluye la variante
            const clave = varianteId
                ? (d) => d.producto?.id === producto.id && d.varianteId === varianteId
                : (d) => d.producto?.id === producto.id && !d.varianteId;
            const existingIdx = prev.findIndex(clave);
            if (existingIdx !== -1) {
                return prev.map((d, i) => i === existingIdx ? { ...d, cantidad: d.cantidad + cantidad } : d);
            }
            const newRow = {
                id: Date.now(),
                producto,
                cantidad,
                precioUnitario,
                descuentoPct: 0,
                varianteId,
                nombreVariante,
            };
            if (prev.length === 1 && !prev[0].producto) return [newRow];
            return [...prev, newRow];
        });
        playScanBeep();
    };

    const handleConfirmarPesoBascula = (pesoKg) => {
        const producto = basculaProducto;
        setBasculaProducto(null);
        if (!producto || pesoKg <= 0) return;
        const varId  = producto._varianteId    || null;
        const varNom = producto._nombreVariante || null;
        if (producto._detalleId) {
            // Modo clásico — actualizar fila existente
            _aplicarProductoEnDetalle(producto._detalleId, producto, pesoKg, producto.precio || 0, varId, varNom);
        } else {
            // Modo Touch — agregar al carrito
            _agregarAlCarritoSimple(producto, pesoKg, producto.precio || 0, varId, varNom);
        }
    };

    const handleConfirmarVariante = (variante) => {
        const producto = varianteProducto;
        setVarianteProducto(null);
        if (!producto || !variante) return;
        const precio = variante.precio != null ? variante.precio : (producto.precio || 0);
        // Si además es pesable, abrir báscula con precio de la variante
        if (esPesable(producto.unidad_medida)) {
            setBasculaProducto({ ...producto, precio, _varianteId: variante.id, _nombreVariante: variante.nombre, _detalleId: producto._detalleId });
            return;
        }
        if (producto._detalleId) {
            // Modo clásico
            _aplicarProductoEnDetalle(producto._detalleId, producto, 1, precio, variante.id, variante.nombre);
        } else {
            // Modo Touch
            _agregarAlCarritoSimple(producto, 1, precio, variante.id, variante.nombre);
        }
    };
    const handleRemoveOneFromCart = (productoId) => {
        setSaleDetails(prev => {
            const detail = prev.find(d => d.producto?.id === productoId);
            if (!detail) return prev;
            if (detail.cantidad <= 1) {
                const filtered = prev.filter(d => d.producto?.id !== productoId);
                return filtered.length === 0
                    ? [{ id: Date.now(), producto: null, cantidad: 1, precioUnitario: 0, descuentoPct: 0 }]
                    : filtered;
            }
            return prev.map(d => d.producto?.id === productoId ? { ...d, cantidad: d.cantidad - 1 } : d);
        });
    };
    const handleRemoveAllFromCart = (productoId) => {
        setSaleDetails(prev => {
            const filtered = prev.filter(d => d.producto?.id !== productoId);
            return filtered.length === 0
                ? [{ id: Date.now(), producto: null, cantidad: 1, precioUnitario: 0, descuentoPct: 0 }]
                : filtered;
        });
    };

    // ── Edición de venta existente ──
    useEffect(() => {
        if (editingVenta) {
            const clientMatch = clientes.find(c => c.id === editingVenta.cliente_id) || null;
            setCliente(clientMatch);
            setClienteInput(clientMatch?.nombre || '');
            setIsMostrador(false);
            const newDetails = editingVenta.detalles.map(d => ({
                id: d.id, producto: d.producto, cantidad: d.cantidad,
                precioUnitario: d.precio_unitario, descuentoPct: d.descuento_pct || 0,
            }));
            setSaleDetails(newDetails);
            const pInputs = {};
            newDetails.forEach(d => { pInputs[d.id] = d.producto?.nombre || ''; });
            setProductoInputs(pInputs);
            setPagada(editingVenta.estado_pago === 'pagado');
            setMetodoPago(editingVenta.metodo_pago || 'Efectivo');
        } else {
            resetForm();
        }
    }, [editingVenta, clientes]);

    // ── Atajo de teclado: Ctrl+Enter → registrar venta ──
    useEffect(() => {
        const onKey = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && tabValue === 0 && !savingVenta) {
                e.preventDefault();
                document.getElementById('btn-registrar-venta')?.click();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [tabValue, savingVenta]);

    // ── Cámara: inicializar cuando cameraActive pasa a true ──
    const cleanupCamera = useCallback(() => {
        if (rAFRef.current) { cancelAnimationFrame(rAFRef.current); rAFRef.current = null; }
        if (zxingControlsRef.current) { try { zxingControlsRef.current.stop(); } catch {} zxingControlsRef.current = null; }
        if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
        if (videoRef.current) videoRef.current.srcObject = null;
    }, []);

    useEffect(() => {
        if (!cameraActive) return;
        let active = true;

        (async () => {
            try {
                if (!HAS_CAMERA) { toast.error('Tu navegador no soporta acceso a cámara.'); setCameraActive(false); return; }

                // onBarcode: mantiene la cámara activa con cooldown de 1.5s entre lecturas
                const onBarcode = (code) => {
                    if (!active || scanCooldownRef.current) return;
                    scanCooldownRef.current = true;
                    setScanFlash(true);
                    setTimeout(() => setScanFlash(false), 380);
                    setTimeout(() => { scanCooldownRef.current = false; }, 1500);
                    handleProcessBarcode(code);
                };

                if (HAS_BARCODE_DETECTOR) {
                    const stream = await navigator.mediaDevices.getUserMedia({
                        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
                    });
                    if (!active) { stream.getTracks().forEach(t => t.stop()); return; }
                    streamRef.current = stream;
                    videoRef.current.srcObject = stream;
                    await videoRef.current.play();

                    const detector = new window.BarcodeDetector({ formats: BARCODE_FORMATS });
                    let lastDetect = 0;
                    const tick = async () => {
                        if (!active || !videoRef.current) return;
                        const now = Date.now();
                        // Durante cooldown, salta la detección pero mantiene el loop
                        if (!scanCooldownRef.current && now - lastDetect >= 120) {
                            lastDetect = now;
                            const v = videoRef.current;
                            if (v.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA && v.videoWidth > 0) {
                                try {
                                    const codes = await detector.detect(v);
                                    if (codes.length > 0) onBarcode(codes[0].rawValue);
                                } catch {}
                            }
                        }
                        rAFRef.current = requestAnimationFrame(tick);
                    };
                    rAFRef.current = requestAnimationFrame(tick);
                } else {
                    const { BrowserMultiFormatReader } = await import('@zxing/browser');
                    if (!active) return;
                    const reader = new BrowserMultiFormatReader();
                    const controls = await reader.decodeFromConstraints(
                        { video: { facingMode: 'environment' } },
                        videoRef.current,
                        // ZXing llama este callback continuamente; el cooldownRef evita procesar duplicados
                        (result) => { if (result && active) onBarcode(result.getText()); }
                    );
                    if (!active) { controls.stop(); return; }
                    zxingControlsRef.current = controls;
                }
            } catch (err) {
                if (!active) return;
                cleanupCamera(); setCameraActive(false);
                if (err.name === 'NotAllowedError') toast.error('Acceso a cámara denegado. Revisa los permisos en tu navegador.');
                else if (err.name === 'NotFoundError') toast.error('No se detectó ninguna cámara en este dispositivo.');
                else toast.error('Error al iniciar la cámara. Intenta de nuevo.');
            }
        })();

        return () => { active = false; cleanupCamera(); };
    }, [cameraActive, cleanupCamera]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleToggleCamera = () => {
        if (cameraActive) { cleanupCamera(); setCameraActive(false); setTimeout(() => barcodeFieldRef.current?.focus(), 100); }
        else setCameraActive(true);
    };

    // ── Barcode processing ──
    const playScanBeep = () => {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator(); const gain = ctx.createGain();
            osc.connect(gain); gain.connect(ctx.destination);
            osc.frequency.setValueAtTime(1000, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
            osc.start(); osc.stop(ctx.currentTime + 0.1);
        } catch {}
    };

    const handleProcessBarcode = async (code) => {
        const barcode = code.trim();
        if (!barcode) return;
        setSearchingBarcode(true);
        try {
            const res = await getProductoByBarcode(barcode);
            if (res.data) {
                const producto = res.data;
                if (producto.id === 0) {
                    toast.warning(`"${producto.nombre}" no está en tu inventario. Regístralo primero.`);
                    openQuickCreate('producto', producto.nombre);
                    return;
                }
                const existingIdx = saleDetails.findIndex(d => d.producto?.id === producto.id);
                if (existingIdx !== -1) {
                    const updated = [...saleDetails];
                    updated[existingIdx] = { ...updated[existingIdx], cantidad: updated[existingIdx].cantidad + 1 };
                    setSaleDetails(updated);
                    toast.success(`+1 ${producto.nombre}`);
                } else {
                    const newRow = { id: Date.now(), producto, cantidad: 1, precioUnitario: producto.precio || 0, descuentoPct: 0 };
                    if (saleDetails.length === 1 && !saleDetails[0].producto) {
                        setSaleDetails([newRow]);
                    } else {
                        setSaleDetails(prev => [...prev, newRow]);
                    }
                    // Auto-sugerir IVA del producto escaneado
                    if (producto.impuesto?.porcentaje != null) {
                        setIvaPorcentajeGlobal(producto.impuesto.porcentaje);
                    }
                    toast.success(`${producto.nombre} añadido al carrito`);
                }
                playScanBeep();
            } else {
                toast.warning(`Código "${barcode}" no encontrado`);
            }
        } catch {
            toast.error('Error al buscar por código de barras');
        } finally {
            setSearchingBarcode(false);
            setBarcodeInput('');
            setTimeout(() => barcodeFieldRef.current?.focus(), 100);
        }
    };

    // ── Mostrador ──
    const handleSetMostrador = () => {
        const candidato = clientes.find(c =>
            c.nombre.toLowerCase().includes('consumidor') ||
            c.nombre.toLowerCase().includes('mostrador') ||
            c.nombre.toLowerCase().includes('publico') ||
            c.nombre.toLowerCase().includes('anonimo')
        );
        if (candidato) {
            setCliente(candidato); setClienteInput(candidato.nombre); setIsMostrador(true);
        } else {
            toast.info('Crea un cliente "Consumidor Final" para usar esta opción rápida.');
            openQuickCreate('tercero', 'Consumidor Final');
        }
    };

    // ── QuickCreate ──
    const openQuickCreate = (type, initialName = '', targetIdx = null) =>
        setQuickCreate({ open: true, type, initialName, targetIdx });
    const closeQuickCreate = () => setQuickCreate(q => ({ ...q, open: false }));
    const handleQuickCreated = (nuevo) => {
        if (quickCreate.type === 'tercero') {
            setClientes(prev => [...prev, nuevo]);
            setCliente(nuevo); setClienteInput(nuevo.nombre); setIsMostrador(false);
        } else {
            setProductos(prev => [...prev, nuevo]);
            if (quickCreate.targetIdx !== null) {
                handleProductChange(quickCreate.targetIdx, nuevo);
                handleProductoInputChange(quickCreate.targetIdx, nuevo.nombre);
            }
        }
        closeQuickCreate();
    };

    // ── Cart ops ──
    const handleProductoInputChange = (id, val) => setProductoInputs(prev => ({ ...prev, [id]: val }));
    const handleAddSaleDetail = () => setSaleDetails(p => [...p, { id: Date.now(), producto: null, cantidad: 1, precioUnitario: 0, descuentoPct: 0 }]);
    const handleAddLibreDetail = () => setSaleDetails(p => [...p, { id: Date.now(), producto: null, cantidad: 1, precioUnitario: 0, descuentoPct: 0, isLibre: true, nombreLibre: '' }]);
    const handleRemoveSaleDetail = (id) => {
        setSaleDetails(p => p.filter(d => d.id !== id));
        setProductoInputs(p => { const n = { ...p }; delete n[id]; return n; });
    };
    const handleFieldChange = (id, field, value) => setSaleDetails(p => p.map(d => d.id === id ? { ...d, [field]: value } : d));
    const handleProductChange = (id, newValue) => {
        if (!newValue) {
            handleFieldChange(id, 'producto', null);
            handleFieldChange(id, 'precioUnitario', 0);
            return;
        }
        // Variantes: mostrar selector primero
        if (newValue.tiene_variantes && newValue.variantes?.length > 0) {
            setVarianteProducto({ ...newValue, _detalleId: id });
            return;
        }
        // Pesable: abrir báscula
        if (esPesable(newValue.unidad_medida)) {
            setBasculaProducto({ ...newValue, _detalleId: id });
            return;
        }
        handleFieldChange(id, 'producto', newValue);
        handleFieldChange(id, 'precioUnitario', newValue?.precio ?? 0);
        if (newValue?.impuesto?.porcentaje != null) {
            setIvaPorcentajeGlobal(newValue.impuesto.porcentaje);
        }
    };

    // Confirmar peso desde báscula en modo clásico
    const _aplicarProductoEnDetalle = (detalleId, producto, cantidad, precio, varianteId, nombreVariante) => {
        handleFieldChange(detalleId, 'producto', producto);
        handleFieldChange(detalleId, 'precioUnitario', precio);
        handleFieldChange(detalleId, 'cantidad', cantidad);
        if (varianteId) {
            handleFieldChange(detalleId, 'varianteId', varianteId);
            handleFieldChange(detalleId, 'nombreVariante', nombreVariante);
        }
        if (producto?.impuesto?.porcentaje != null) {
            setIvaPorcentajeGlobal(producto.impuesto.porcentaje);
        }
    };

    // ── Cálculos ──
    const calculateSubtotal = () => saleDetails.reduce((t, d) => {
        const bruto = d.cantidad * d.precioUnitario;
        return t + bruto - bruto * ((d.descuentoPct || 0) / 100);
    }, 0);
    const calculateDescuentoTotal = () => saleDetails.reduce((t, d) =>
        t + d.cantidad * d.precioUnitario * ((d.descuentoPct || 0) / 100), 0);

    // ── Submit ──
    const handleVentaSubmit = async () => {
        if (!cliente) { toast.error('Selecciona un cliente o usa el botón Mostrador.'); return; }
        const validDetails = saleDetails.filter(d => d.isLibre ? d.precioUnitario > 0 : (d.producto !== null && d.cantidad > 0));
        if (validDetails.length === 0) { toast.error('Agrega al menos un producto al carrito.'); return; }

        const descuentoPuntosImporte = puntosACanjear * (configFidelizacion.redeem_rate || PUNTOS_REDEEM_RATE_DEFAULT);

        // ── Link de Pago — mostrar QR/URL al cliente antes de registrar ──
        if (pagada && metodoPago === 'Link de Pago' && !pendingVentaRef.current) {
            if (!linkPagoConfig) {
                toast.error('No hay un link de pago configurado. Configúralo en Mi Suscripción.');
                return;
            }
            const subtotal = calculateSubtotal();
            const totalBruto = subtotal; // IVA incluido: el precio ya tiene el IVA
            const totalFinal = Math.max(0, totalBruto - descuentoPuntosImporte);
            pendingVentaRef.current = { totalFinal };
            setLinkPagoModalOpen(true);
            return;
        }
        pendingVentaRef.current = null;

        const ventaData = {
            cliente_id: cliente.id,
            detalles: validDetails.map(({ producto, cantidad, precioUnitario, descuentoPct, isLibre, nombreLibre, varianteId, nombreVariante }) => ({
                producto_id:     isLibre ? null : producto.id,
                variante_id:     varianteId || undefined,
                nombre_libre:    isLibre ? (nombreLibre || 'Ítem libre') : undefined,
                nombre_variante: nombreVariante || undefined,
                cantidad,
                precio_unitario: precioUnitario * (1 - (descuentoPct || 0) / 100),
                descuento_pct:   descuentoPct || 0,
                iva_porcentaje:  0.0,
            })),
            pagada, metodo_pago: pagada ? metodoPago : null,
            iva_porcentaje: parseFloat(ivaPorcentajeGlobal),
            operador_id: user?.id,
            descuento_puntos: descuentoPuntosImporte,
            puntos_canjeados: puntosACanjear,
            omitir_inventario: omitirInventarioRef.current,
        };

        const snapDetails = validDetails.map(d => ({
            producto: d.producto, cantidad: d.cantidad,
            precio_unitario: d.precioUnitario * (1 - (d.descuentoPct || 0) / 100),
            descuento_pct: d.descuentoPct || 0,
        }));
        const snapCliente = cliente;

        setSavingVenta(true);
        try {
            const res = editingVenta
                ? await apiClient.put(`/ventas/${editingVenta.id}`, ventaData)
                : await apiClient.post('/ventas/', ventaData);
            const saved = res.data || {};
            toast.success(`Venta ${editingVenta ? 'actualizada' : 'registrada'} exitosamente`);
            fetchVentas(); fetchVentasSummary();

            const totalBruto = snapDetails.reduce((s, d) => s + d.precio_unitario * d.cantidad, 0);
            setReciboVenta({
                id: saved.id, fecha: saved.fecha || new Date().toISOString(),
                cliente: snapCliente, detalles: snapDetails,
                total: saved.total ?? totalBruto, iva_porcentaje: parseFloat(ivaPorcentajeGlobal) || 0,
                iva_total: saved.iva_total ?? 0,
                monto_pagado: pagada ? (saved.total ?? totalBruto) : 0,
                metodo_pago: ventaData.metodo_pago, estado_pago: pagada ? 'pagado' : 'pendiente',
            });
            setReciboOpen(true);
            resetForm(); setTabValue(1);
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Error al guardar la venta.');
        } finally {
            setSavingVenta(false);
        }
    };

    const handleSubmit = (e) => { e.preventDefault(); handleVentaSubmit(); };

    const resetForm = () => {
        setCliente(null); setClienteInput(''); setIsMostrador(false);
        const initialId = Date.now();
        setSaleDetails([{ id: initialId, producto: null, cantidad: 1, precioUnitario: 0, descuentoPct: 0 }]);
        setProductoInputs({}); setIvaPorcentajeGlobal(19); setValorRecibido(0);
        setPagada(true); setMetodoPago('Efectivo'); setEditingVenta(null);
        setPuntosACanjear(0); setClientePuntos(0); setOmitirInventario(false); pendingVentaRef.current = null;
        cleanupCamera(); setCameraActive(false);
        setTimeout(() => barcodeFieldRef.current?.focus(), 300);
    };

    const handleDelete  = (id) => { setVentaToDelete(id); setShowDeleteDialog(true); };
    const confirmDelete = () => {
        apiClient.delete(`/ventas/${ventaToDelete}`)
            .then(() => { toast.success('Venta eliminada'); fetchVentas(); fetchVentasSummary(); })
            .catch(err => toast.error(err.response?.data?.detail || 'Error al eliminar la venta.', { autoClose: 7000 }))
            .finally(() => { setShowDeleteDialog(false); setVentaToDelete(null); });
    };
    const handleEdit           = (v) => { setEditingVenta(v); setTabValue(0); };
    const handleOpenDetails    = (v) => { setSelectedVenta(v); setDetailModalOpen(true); };
    const handleCloseDetails   = ()  => { setDetailModalOpen(false); setSelectedVenta(null); };
    const handleOpenDevolucion = (v) => { setVentaDevolucion(v); setDevolucionOpen(true); };
    const handleDevolucionSuccess = () => { fetchVentas(); fetchVentasSummary(); };

    // ── Filtros historial ──
    const filteredVentas = [...ventas]
        .filter(v => {
            const matchName = (v.cliente?.nombre || '').toLowerCase().includes(searchTerm.toLowerCase());
            const vDate = new Date(v.fecha + 'Z');
            const matchStart = !fechaInicio || vDate >= new Date(fechaInicio);
            const matchEnd   = !fechaFin   || vDate <= new Date(fechaFin + 'T23:59:59');
            return matchName && matchStart && matchEnd;
        })
        .sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    const paginatedVentas = filteredVentas.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
    const totalPendiente = ventas.filter(v => v.estado_pago === 'pendiente').reduce((s, v) => s + (v.total - v.monto_pagado), 0);

    const exportCSV = () => {
        const headers = ['ID', 'Fecha', 'Cliente', 'Total', 'Pagado', 'Estado', 'Método'];
        const rows = filteredVentas.map(v => [
            v.id,
            new Date(v.fecha).toLocaleString('es-CO'),
            v.cliente?.nombre || 'Mostrador',
            v.total?.toFixed(2) || '0',
            v.monto_pagado?.toFixed(2) || '0',
            v.estado_pago || '',
            v.metodo_pago || '',
        ]);
        const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
        const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url;
        a.download = `ventas_${new Date().toISOString().slice(0,10)}.csv`;
        a.click(); URL.revokeObjectURL(url);
    };
    const totalConIva = calculateSubtotal(); // IVA incluido: total no cambia
    const descuentoPuntosImporte = puntosACanjear * (configFidelizacion.redeem_rate || PUNTOS_REDEEM_RATE_DEFAULT);
    const totalFinal = Math.max(0, totalConIva - descuentoPuntosImporte);
    const cambioEfectivo = valorRecibido - totalFinal;

    return (
        <Box sx={{ width: '100%', minWidth: 0 }}>

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
                    <HelpGuideTopBar
                        moduleName="Ventas POS"
                        moduleColor={ACCENT}
                        steps={[
                            { title: 'Selecciona el cliente', description: 'Busca por nombre, NIT o teléfono. Para ventas rápidas usa el botón "Mostrador".' },
                            { title: 'Agrega productos', description: 'Escanea el código de barras o escribe el nombre. Usa los botones + / − para ajustar cantidades.' },
                            { title: 'Aplica descuentos', description: 'Cada producto tiene un campo "Desc. %" donde puedes reducir su precio de forma individual.' },
                            { title: 'Elige el método de pago', description: 'Selecciona Efectivo, Transferencia, Tarjeta o "Por Cobrar" para registrar ventas a crédito.' },
                            { title: 'Registra la venta', description: 'Haz clic en "Registrar Venta" o presiona Ctrl + Enter para guardar. El sistema descuenta el stock automáticamente.' },
                            { title: 'Atajos de teclado', description: 'Ctrl + Enter: registrar venta. Enter en el campo de código de barras: agregar producto al carrito. Estos atajos agilizan el proceso en caja.' },
                        ]}
                        faqItems={[
                            { q: '¿Qué atajos de teclado están disponibles?', a: 'Ctrl + Enter (o Cmd + Enter en Mac): registra la venta sin usar el mouse. Enter en el campo de código de barras: agrega el producto al carrito inmediatamente. Estos atajos están activos siempre que estés en la pestaña de nueva venta.' },
                            { q: '¿Cómo registro una venta a crédito?', a: 'Selecciona "Por Cobrar" como método de pago. La venta queda registrada como deuda del cliente y aparece en "Cartera pendiente". Puedes gestionarla desde el historial.' },
                            { q: '¿Puedo aplicar un descuento en la venta?', a: 'Sí, cada producto en el carrito tiene un campo "Desc. %" donde puedes ingresar un porcentaje de descuento individual. El total se recalcula automáticamente.' },
                            { q: '¿Qué pasa con el stock al registrar una venta?', a: 'El stock se descuenta automáticamente al registrar. Si un producto tiene stock bajo o insuficiente para la cantidad pedida, verás una alerta en el carrito.' },
                            { q: '¿Cómo edito o anulo una venta ya registrada?', a: 'En la pestaña "Historial", usa el ícono de lápiz ✏️ para editar o el ícono de devolución para registrar una devolución parcial o total.' },
                        ]}
                    />
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <ToggleButtonGroup
                        value={viewMode}
                        exclusive
                        onChange={handleViewModeChange}
                        size="small"
                        sx={{ bgcolor: 'background.paper', borderRadius: 2 }}
                    >
                        <ToggleButton value="classic" sx={{ textTransform: 'none', gap: 1, px: 2 }}>
                            <Keyboard fontSize="small" /> {!isMobile && 'Teclado'}
                        </ToggleButton>
                        <ToggleButton value="touch" sx={{ textTransform: 'none', gap: 1, px: 2 }}>
                            <TouchApp fontSize="small" /> {!isMobile && 'Táctil'}
                        </ToggleButton>
                    </ToggleButtonGroup>
                    <Tooltip title="Exportar historial filtrado a CSV">
                        <IconButton onClick={exportCSV} size="small" sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1.5 }}>
                            <FileDownload fontSize="small" />
                        </IconButton>
                    </Tooltip>
                    <Button
                        variant="contained" startIcon={<ShoppingCart />}
                        onClick={() => { resetForm(); setTabValue(0); }}
                        sx={{ background: `linear-gradient(135deg, ${ACCENT}, #ff9a62)`, boxShadow: `0 4px 14px rgba(255,96,32,0.35)`, borderRadius: 2, fontWeight: 600 }}
                    >
                        Nueva Venta
                    </Button>
                </Box>
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

            {/* ── Tabs ── */}
            <Paper sx={{ borderRadius: 3, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
                <Tabs
                    value={tabValue} onChange={(_, v) => setTabValue(v)}
                    sx={{
                        px: 2, borderBottom: '1px solid', borderColor: 'divider',
                        '& .MuiTab-root': { fontWeight: 600, fontSize: 13.5, textTransform: 'none', minHeight: 52 },
                        '& .MuiTabs-indicator': { backgroundColor: ACCENT, height: 3, borderRadius: 3 },
                        '& .Mui-selected': { color: `${ACCENT} !important` },
                    }}
                >
                    <Tab label={editingVenta ? '✏️ Editar Venta' : '➕ Registrar Venta'} />
                    <Tab label={`📋 Historial (${ventas.length})`} />
                </Tabs>

                {/* ════════════════════════════════════════
                    TAB 0 — REGISTRAR VENTA
                ════════════════════════════════════════ */}
                <TabPanel value={tabValue} index={0}>
                    {viewMode === 'classic' ? (
                        <Box component="form" onSubmit={handleSubmit} sx={{ p: { xs: 2, md: 3 } }}>
                            {/* ── 1. Cliente ── */}
                            <Box sx={{ mb: 2.5 }}>
                                <Typography sx={{ fontWeight: 600, fontSize: 11, mb: 1, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.8 }}>
                                    Cliente
                                </Typography>
                                <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                                    {/* Botón Mostrador */}
                                    <Tooltip title="Venta a cliente anónimo (Consumidor Final)">
                                        <Button
                                            size="small" variant={isMostrador ? 'contained' : 'outlined'}
                                            startIcon={<PersonOutline fontSize="small" />}
                                            onClick={handleSetMostrador}
                                            sx={{
                                                borderRadius: 2, fontWeight: 600, fontSize: 12,
                                                borderColor: '#64748B', whiteSpace: 'nowrap',
                                                ...(isMostrador
                                                    ? { bgcolor: '#64748B', color: 'white', '&:hover': { bgcolor: '#475569' } }
                                                    : { color: '#64748B', '&:hover': { bgcolor: '#F1F5F9', borderColor: '#64748B' } }
                                                )
                                            }}
                                        >
                                            Mostrador
                                        </Button>
                                    </Tooltip>

                                    <Autocomplete
                                        sx={{ flex: 1, minWidth: 220 }}
                                        options={clientes}
                                        getOptionLabel={(o) => o?.nombre || ''}
                                        value={cliente}
                                        onChange={(_, v) => { setCliente(v); setIsMostrador(false); }}
                                        inputValue={clienteInput}
                                        onInputChange={(_, v) => setClienteInput(v)}
                                        filterOptions={(opts, state) => {
                                            const q = (state.inputValue || '').toLowerCase().trim();
                                            if (!q) return opts;
                                            return opts.filter(o =>
                                                o.nombre.toLowerCase().includes(q) ||
                                                (o.cedula || '').toLowerCase().includes(q) ||
                                                (o.telefono || '').includes(q)
                                            );
                                        }}
                                        noOptionsText={
                                            <Box sx={{ py: 0.5 }}>
                                                <Typography sx={{ fontSize: 13, color: 'text.secondary', mb: 1 }}>No se encontró el cliente</Typography>
                                                <Button size="small" variant="contained" fullWidth startIcon={<Add />}
                                                    onClick={() => openQuickCreate('tercero', clienteInput)}
                                                    sx={{ borderRadius: 2, fontWeight: 600, fontSize: 12, bgcolor: '#3B82F6', '&:hover': { bgcolor: '#2563EB' } }}>
                                                    Crear "{clienteInput || 'nuevo cliente'}"
                                                </Button>
                                            </Box>
                                        }
                                        renderOption={(props, option) => (
                                            <li {...props} key={option.id} style={{ padding: '8px 12px' }}>
                                                <Box>
                                                    <Typography sx={{ fontSize: 14, fontWeight: 600 }}>{option.nombre}</Typography>
                                                    <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
                                                        {option.cedula ? `NIT/CC: ${option.cedula}` : ''}{option.telefono ? `  ·  📞 ${option.telefono}` : ''}
                                                    </Typography>
                                                </Box>
                                            </li>
                                        )}
                                        renderInput={(params) => (
                                            <TextField
                                                {...params} label="Buscar cliente por nombre, NIT o teléfono" fullWidth
                                                InputProps={{
                                                    ...params.InputProps,
                                                    endAdornment: (<>{params.InputProps.endAdornment}<Tooltip title="Crear nuevo cliente"><IconButton size="small" onClick={() => openQuickCreate('tercero', clienteInput)} sx={{ color: '#3B82F6', p: 0.5 }}><Add fontSize="small" /></IconButton></Tooltip></>),
                                                }}
                                            />
                                        )}
                                    />
                                </Box>
                            </Box>

                            {/* ── 2. Escáner de código de barras (prominente) ── */}
                            <Paper elevation={0} sx={{
                                mb: 2.5, p: 2, borderRadius: 3,
                                border: `1.5px solid ${ACCENT}40`,
                                bgcolor: isDark ? `${ACCENT}08` : `${ACCENT}05`,
                            }}>
                                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                                    <TextField
                                        fullWidth
                                        placeholder="Escanea o digita el código de barras y presiona Enter…"
                                        value={barcodeInput}
                                        onChange={(e) => setBarcodeInput(e.target.value)}
                                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleProcessBarcode(barcodeInput); } }}
                                        inputRef={barcodeFieldRef}
                                        autoComplete="off"
                                        disabled={searchingBarcode}
                                        InputProps={{
                                            startAdornment: <InputAdornment position="start"><QrCodeScanner sx={{ color: ACCENT, fontSize: 22 }} /></InputAdornment>,
                                            endAdornment: searchingBarcode ? <CircularProgress size={18} sx={{ color: ACCENT }} /> : null,
                                            sx: { fontSize: 15, fontWeight: 600, borderRadius: 2 }
                                        }}
                                    />
                                    <Tooltip title={cameraActive ? 'Cerrar cámara' : 'Usar cámara del dispositivo'}>
                                        <IconButton onClick={handleToggleCamera}
                                            sx={{ bgcolor: cameraActive ? '#FEF2F2' : '#EFF6FF', color: cameraActive ? '#EF4444' : '#3B82F6', borderRadius: 2, p: 1.2 }}>
                                            {cameraActive ? <VideocamOff /> : <Videocam />}
                                        </IconButton>
                                    </Tooltip>
                                </Box>

                                {/* Cámara con overlay */}
                                {cameraActive && (
                                    <Box sx={{ mt: 2, position: 'relative', borderRadius: 2, overflow: 'hidden', bgcolor: '#000', minHeight: 240 }}>
                                        <video ref={videoRef} style={{ width: '100%', display: 'block', maxHeight: 300, objectFit: 'cover' }} playsInline muted />

                                        {/* Flash verde de confirmación */}
                                        <Box sx={{
                                            position: 'absolute', inset: 0, borderRadius: 2,
                                            bgcolor: 'rgba(16,185,129,0.28)',
                                            border: '3px solid #10B981',
                                            opacity: scanFlash ? 1 : 0,
                                            transition: scanFlash ? 'none' : 'opacity 0.35s ease-out',
                                            pointerEvents: 'none', zIndex: 3,
                                        }} />

                                        {/* Overlay de apuntado */}
                                        <Box sx={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1.5, pointerEvents: 'none' }}>
                                            <Box sx={{ position: 'relative', width: { xs: 200, sm: 260 }, height: { xs: 120, sm: 140 } }}>
                                                <Box sx={{ position: 'absolute', inset: 0, boxShadow: '0 0 0 100vw rgba(0,0,0,0.45)', borderRadius: 2 }} />
                                                {/* Esquinas — cambian a verde cuando se detecta un código */}
                                                {(() => {
                                                    const c = scanFlash ? '#10B981' : ACCENT;
                                                    return <>
                                                        <Box sx={{ position: 'absolute', top: -1, left: -1, width: 20, height: 20, borderTop: `3px solid ${c}`, borderLeft: `3px solid ${c}`, borderRadius: '4px 0 0 0', transition: 'border-color 0.15s' }} />
                                                        <Box sx={{ position: 'absolute', top: -1, right: -1, width: 20, height: 20, borderTop: `3px solid ${c}`, borderRight: `3px solid ${c}`, borderRadius: '0 4px 0 0', transition: 'border-color 0.15s' }} />
                                                        <Box sx={{ position: 'absolute', bottom: -1, left: -1, width: 20, height: 20, borderBottom: `3px solid ${c}`, borderLeft: `3px solid ${c}`, borderRadius: '0 0 0 4px', transition: 'border-color 0.15s' }} />
                                                        <Box sx={{ position: 'absolute', bottom: -1, right: -1, width: 20, height: 20, borderBottom: `3px solid ${c}`, borderRight: `3px solid ${c}`, borderRadius: '0 0 4px 0', transition: 'border-color 0.15s' }} />
                                                    </>;
                                                })()}
                                                {/* Línea de escaneo — se pausa durante cooldown */}
                                                {!scanFlash && (
                                                    <Box sx={{ position: 'absolute', left: 4, right: 4, height: 2, background: `linear-gradient(90deg, transparent, ${ACCENT}CC, transparent)`, borderRadius: 1, animation: 'scanLine 1.8s ease-in-out infinite', '@keyframes scanLine': { '0%': { top: '5%' }, '50%': { top: '90%' }, '100%': { top: '5%' } } }} />
                                                )}
                                            </Box>
                                            <Typography sx={{ color: 'rgba(255,255,255,0.9)', fontSize: 11, bgcolor: scanFlash ? 'rgba(16,185,129,0.75)' : 'rgba(0,0,0,0.45)', borderRadius: 5, px: 2, py: 0.4, transition: 'background-color 0.15s', fontWeight: scanFlash ? 700 : 400 }}>
                                                {scanFlash ? '✓ Detectado — apunta el siguiente' : 'Apunta el código al recuadro'}
                                            </Typography>
                                        </Box>
                                    </Box>
                                )}
                            </Paper>

                            {/* ── 3. Carrito de productos ── */}
                            <Box sx={{ mb: 2 }}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                                    <Typography sx={{ fontWeight: 600, fontSize: 11, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.8 }}>
                                        Productos / Servicios ({saleDetails.filter(d => d.producto || d.isLibre).length})
                                    </Typography>
                                    <Box sx={{ display: 'flex', gap: 1 }}>
                                        <Button size="small" variant="outlined" onClick={handleAddLibreDetail}
                                            sx={{ color: '#F59E0B', borderColor: '#F59E0B40', fontWeight: 600, fontSize: 12, borderRadius: 2,
                                                '&:hover': { borderColor: '#F59E0B', bgcolor: '#FEF3C708' } }}>
                                            ＋ Ítem libre
                                        </Button>
                                        <Button size="small" startIcon={<Add />} onClick={handleAddSaleDetail}
                                            sx={{ color: ACCENT, fontWeight: 600, fontSize: 12 }}>
                                            Agregar línea
                                        </Button>
                                    </Box>
                                </Box>

                                {saleDetails.map(detail => (
                                    detail.isLibre ? (
                                        <Box key={detail.id} sx={{
                                            display: 'flex', flexDirection: isMobile ? 'column' : 'row',
                                            alignItems: isMobile ? 'stretch' : 'center',
                                            gap: 1, mb: 1.5, p: isMobile ? 2 : 1.5,
                                            borderRadius: 2, bgcolor: '#FEF3C720',
                                            border: '1px dashed', borderColor: '#F59E0B60',
                                        }}>
                                            {/* Descripción libre */}
                                            <Box sx={{ flex: 1, minWidth: isMobile ? '100%' : 200 }}>
                                                <TextField
                                                    fullWidth size="small"
                                                    label="Descripción del ítem"
                                                    placeholder="Ej: Servicio personalizado, ajuste especial…"
                                                    value={detail.nombreLibre || ''}
                                                    onChange={(e) => handleFieldChange(detail.id, 'nombreLibre', e.target.value)}
                                                    InputProps={{ sx: { fontSize: 13 } }}
                                                />
                                                <Typography sx={{ fontSize: 10, color: '#F59E0B', mt: 0.4, fontWeight: 600 }}>
                                                    Ítem libre — sin producto del catálogo
                                                </Typography>
                                            </Box>
                                            {/* Cantidad */}
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: isMobile ? '100%' : 'auto' }}>
                                                <IconButton size="small" onClick={() => handleFieldChange(detail.id, 'cantidad', Math.max(0, (detail.cantidad || 1) - 1))} sx={{ color: '#EF4444', p: 0.5 }}>
                                                    <RemoveCircle fontSize="small" />
                                                </IconButton>
                                                <TextField
                                                    type="number" size="small"
                                                    value={detail.cantidad}
                                                    onChange={(e) => handleFieldChange(detail.id, 'cantidad', parseFloat(e.target.value) || 0)}
                                                    inputProps={{ min: 0, step: 'any' }}
                                                    sx={{ width: 64, '& input': { textAlign: 'center', fontWeight: 700, fontSize: 14, p: '6px 4px' } }}
                                                />
                                                <IconButton size="small" onClick={() => handleFieldChange(detail.id, 'cantidad', (detail.cantidad || 1) + 1)} sx={{ color: '#10B981', p: 0.5 }}>
                                                    <AddCircle fontSize="small" />
                                                </IconButton>
                                            </Box>
                                            {/* Precio */}
                                            <Box sx={{ minWidth: isMobile ? '100%' : 120 }}>
                                                <CurrencyField
                                                    label="Precio" size="small"
                                                    value={detail.precioUnitario}
                                                    onChange={(val) => handleFieldChange(detail.id, 'precioUnitario', val)}
                                                />
                                            </Box>
                                            {/* Subtotal + quitar */}
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: isMobile ? '100%' : 'auto', justifyContent: isMobile ? 'space-between' : 'flex-end' }}>
                                                <Typography sx={{ fontWeight: 800, fontSize: 14, color: ACCENT }}>
                                                    {((detail.precioUnitario || 0) * (detail.cantidad || 1)).toLocaleString('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 })}
                                                </Typography>
                                                <Tooltip title="Quitar">
                                                    <IconButton onClick={() => handleRemoveSaleDetail(detail.id)} size="small" sx={{ color: '#EF4444', bgcolor: '#FEF2F2', borderRadius: 1.5 }}>
                                                        <RemoveCircle fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                            </Box>
                                        </Box>
                                    ) : (
                                        <SaleDetailRow
                                            key={detail.id} detail={detail} productos={productos}
                                            onProductChange={handleProductChange} onFieldChange={handleFieldChange}
                                            onRemove={handleRemoveSaleDetail} isMobile={isMobile}
                                            productoInput={productoInputs[detail.id] || ''}
                                            onProductoInputChange={(val) => handleProductoInputChange(detail.id, val)}
                                            openQuickCreate={() => openQuickCreate('producto', productoInputs[detail.id] || '', detail.id)}
                                        />
                                    )
                                ))}
                            </Box>
                        </Box>
                    ) : (
                        <Box sx={{ p: { xs: 1.5, md: 2 } }}>
                            <TouchPOSMode
                                grupos={grupos}
                                productos={productos}
                                saleDetails={saleDetails}
                                onAddProduct={handleAddToCartDirect}
                                onRemoveOne={handleRemoveOneFromCart}
                                onRemoveAll={handleRemoveAllFromCart}
                                cliente={cliente}
                                setCliente={(v) => { setCliente(v); setIsMostrador(false); }}
                                clientes={clientes}
                                isMostrador={isMostrador}
                                onSetMostrador={handleSetMostrador}
                                clienteInput={clienteInput}
                                setClienteInput={setClienteInput}
                                pagada={pagada}
                                setPagada={setPagada}
                                metodoPago={metodoPago}
                                setMetodoPago={setMetodoPago}
                                valorRecibido={valorRecibido}
                                setValorRecibido={setValorRecibido}
                                ivaPorcentajeGlobal={ivaPorcentajeGlobal}
                                setIvaPorcentajeGlobal={setIvaPorcentajeGlobal}
                                onSubmit={handleVentaSubmit}
                                savingVenta={savingVenta}
                                calculateSubtotal={calculateSubtotal}
                                cambioEfectivo={cambioEfectivo}
                                openQuickCreate={openQuickCreate}
                                isDark={isDark}
                                omitirInventario={omitirInventario}
                                setOmitirInventario={setOmitirInventario}
                                linkPagoConfig={linkPagoConfig}
                                fidelizacionActiva={configFidelizacion.activa}
                                clientePuntos={clientePuntos}
                                puntosACanjear={puntosACanjear}
                                setPuntosACanjear={setPuntosACanjear}
                                redeemRate={configFidelizacion.redeem_rate || PUNTOS_REDEEM_RATE_DEFAULT}
                            />
                        </Box>
                    )}

                                        {/* ── 4. Panel de totales y cobro (SOLO CLASSIC) ── */}
                    {viewMode === 'classic' && (
                        <Paper elevation={0} sx={{
                            p: { xs: 2, md: 3 }, borderRadius: 3,
                            border: `1.5px solid ${ACCENT}30`,
                            bgcolor: isDark ? 'background.paper' : '#FFFBF9',
                        }}>
                            {/* Línea de descuento */}
                            {calculateDescuentoTotal() > 0 && (
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                                    <Typography sx={{ color: 'text.secondary', fontSize: 13 }}>Descuento total</Typography>
                                    <Typography sx={{ color: '#10B981', fontWeight: 600, fontSize: 13 }}>− {formatCurrency(calculateDescuentoTotal())}</Typography>
                                </Box>
                            )}

                            {/* ── IVA + Desglose en una sola fila compacta ── */}
                            <Box sx={{
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                flexWrap: 'wrap', gap: 1, mb: 1.5,
                                px: 1.5, py: 1, borderRadius: 2,
                                bgcolor: 'action.hover',
                            }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Typography sx={{ fontSize: 12, fontWeight: 600, color: 'text.secondary' }}>IVA:</Typography>
                                    {[0, 19].map(pct => (
                                        <Chip
                                            key={pct}
                                            label={pct === 0 ? 'Exento (0%)' : `+${pct}%`}
                                            onClick={() => setIvaPorcentajeGlobal(pct)}
                                            size="small"
                                            sx={{
                                                cursor: 'pointer', fontWeight: 700, fontSize: 12, height: 28,
                                                ...(ivaPorcentajeGlobal == pct
                                                    ? { bgcolor: ACCENT, color: 'white', '& .MuiChip-label': { color: 'white' } }
                                                    : { bgcolor: 'background.paper', border: '1.5px solid', borderColor: 'divider' }
                                                )
                                            }}
                                        />
                                    ))}
                                </Box>
                                {parseFloat(ivaPorcentajeGlobal) > 0 && (() => {
                                    const rate = parseFloat(ivaPorcentajeGlobal);
                                    const sub = calculateSubtotal();
                                    const ivaIncluido = sub * rate / (100 + rate);
                                    const baseNeta = sub - ivaIncluido;
                                    return (
                                        <Box sx={{ display: 'flex', gap: 2 }}>
                                            <Typography sx={{ color: 'text.secondary', fontSize: 12 }}>
                                                Base: <strong>{formatCurrency(baseNeta)}</strong>
                                            </Typography>
                                            <Typography sx={{ color: 'text.secondary', fontSize: 12 }}>
                                                IVA {ivaPorcentajeGlobal}%: <strong>{formatCurrency(ivaIncluido)}</strong>
                                            </Typography>
                                        </Box>
                                    );
                                })()}
                            </Box>

                            {/* ── TOTAL grande + toggle stock en la misma fila ── */}
                            <Box sx={{
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                flexWrap: 'wrap', gap: 1, mb: 2,
                            }}>
                                {/* Total */}
                                <Box>
                                    <Typography sx={{ fontSize: 11, color: 'text.secondary', letterSpacing: 1.5, textTransform: 'uppercase' }}>
                                        Total a cobrar
                                    </Typography>
                                    {descuentoPuntosImporte > 0
                                        ? <>
                                            <Typography sx={{ fontSize: 22, fontWeight: 900, color: 'text.disabled', lineHeight: 1, textDecoration: 'line-through' }}>
                                                {formatCurrency(totalConIva)}
                                            </Typography>
                                            <Typography sx={{ fontSize: { xs: 44, md: 56 }, fontWeight: 900, color: '#10B981', lineHeight: 1 }}>
                                                {formatCurrency(totalFinal)}
                                            </Typography>
                                            <Chip icon={<Stars sx={{ fontSize: '14px !important' }} />} label={`-${formatCurrency(descuentoPuntosImporte)} puntos`} size="small" sx={{ mt: 0.5, bgcolor: '#10B98115', color: '#10B981', fontWeight: 700, fontSize: 10 }} />
                                          </>
                                        : <Typography sx={{ fontSize: { xs: 44, md: 56 }, fontWeight: 900, color: ACCENT, lineHeight: 1 }}>
                                            {formatCurrency(totalFinal)}
                                          </Typography>
                                    }
                                </Box>

                                {/* Toggle stock — a la derecha del total */}
                                <Box sx={{
                                    display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.5,
                                }}>
                                    <FormControlLabel
                                        control={
                                            <Switch
                                                checked={omitirInventario}
                                                onChange={e => setOmitirInventario(e.target.checked)}
                                                sx={{
                                                    '& .MuiSwitch-switchBase.Mui-checked': { color: '#F59E0B' },
                                                    '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: '#F59E0B' },
                                                }}
                                            />
                                        }
                                        label={
                                            <Typography fontSize={13} fontWeight={omitirInventario ? 700 : 500} color={omitirInventario ? '#92400E' : 'text.secondary'}>
                                                Vender sin validar stock
                                            </Typography>
                                        }
                                        sx={{ m: 0, gap: 0.5 }}
                                    />
                                </Box>
                            </Box>

                            {/* ── Puntos de fidelización ── */}
                            {configFidelizacion.activa && cliente && !isMostrador && clientePuntos > 0 && (
                                <Box sx={{ mb: 2, p: 1.5, borderRadius: 2, bgcolor: '#10B98108', border: '1px solid #10B98128' }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                                            <Stars sx={{ fontSize: 16, color: '#10B981' }} />
                                            <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#10B981' }}>
                                                {clientePuntos} puntos disponibles
                                            </Typography>
                                            <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>
                                                (= {formatCurrency(clientePuntos * (configFidelizacion.redeem_rate || PUNTOS_REDEEM_RATE_DEFAULT))} de descuento)
                                            </Typography>
                                        </Box>
                                        {puntosACanjear > 0 && (
                                            <Chip label={`Canjeando ${puntosACanjear} pts`} size="small" onDelete={() => setPuntosACanjear(0)} sx={{ bgcolor: '#10B98118', color: '#10B981', fontWeight: 700, fontSize: 10 }} />
                                        )}
                                    </Box>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <Typography sx={{ fontSize: 11, color: 'text.secondary', flexShrink: 0 }}>Canjear:</Typography>
                                        {[0, Math.floor(clientePuntos * 0.25), Math.floor(clientePuntos * 0.5), clientePuntos].filter((v, i, a) => a.indexOf(v) === i && v >= 0).map(pts => (
                                            <Chip
                                                key={pts}
                                                label={pts === 0 ? 'Ninguno' : `${pts} pts`}
                                                size="small"
                                                onClick={() => setPuntosACanjear(pts)}
                                                sx={{ fontSize: 10, fontWeight: 700, cursor: 'pointer', bgcolor: puntosACanjear === pts ? '#10B98120' : 'background.paper', color: puntosACanjear === pts ? '#10B981' : 'text.secondary', border: '1px solid', borderColor: puntosACanjear === pts ? '#10B981' : 'divider' }}
                                            />
                                        ))}
                                    </Box>
                                </Box>
                            )}

                            <Divider sx={{ mb: 2 }} />

                            {/* ── Método de pago + efectivo + botón ── todo en una fila ── */}
                            <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start', flexWrap: 'wrap' }}>

                                {/* Métodos de pago */}
                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
                                        <Typography sx={{ fontSize: 12, fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.8 }}>
                                            Método de pago
                                        </Typography>
                                        <SmartTooltip
                                            id="venta_metodo_pago"
                                            title="Métodos de pago"
                                            description="'Por Cobrar' registra la venta como deuda del cliente. Puedes ver y cobrar las deudas pendientes en el historial."
                                            variant="info"
                                            placement="right"
                                        >
                                            <HelpOutline sx={{ fontSize: 14, color: 'text.disabled', cursor: 'pointer' }} />
                                        </SmartTooltip>
                                    </Box>
                                    <Box sx={{ display: 'flex', gap: 0.8, flexWrap: 'wrap' }}>
                                        {METODOS_PAGO.filter(opt => opt.value !== 'Link de Pago' || !!linkPagoConfig).map(opt => {
                                            const isSelected = pagada ? (opt.pagada && metodoPago === opt.value) : !opt.pagada;
                                            return (
                                                <Box key={opt.value} onClick={() => { setPagada(opt.pagada); if (opt.pagada) setMetodoPago(opt.value); }}
                                                    sx={{
                                                        px: 1.5, py: 1, borderRadius: 2, cursor: 'pointer',
                                                        border: '1.5px solid', borderColor: isSelected ? opt.color : 'divider',
                                                        bgcolor: isSelected ? `${opt.color}15` : 'background.paper',
                                                        color: isSelected ? opt.color : 'text.secondary',
                                                        fontSize: 13, fontWeight: isSelected ? 700 : 500,
                                                        transition: 'all 0.15s', userSelect: 'none',
                                                        '&:hover': { borderColor: opt.color, bgcolor: `${opt.color}08` },
                                                        whiteSpace: 'nowrap',
                                                    }}
                                                >
                                                    {opt.label}
                                                </Box>
                                            );
                                        })}
                                    </Box>
                                </Box>

                                {/* Efectivo: recibido + cambio */}
                                {pagada && metodoPago === 'Efectivo' && (
                                    <Box sx={{ minWidth: 160 }}>
                                        <Typography sx={{ fontSize: 12, fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.8, mb: 1 }}>
                                            Valor recibido
                                        </Typography>
                                        <CurrencyField
                                            label="" size="small" fullWidth
                                            value={valorRecibido} onChange={setValorRecibido}
                                        />
                                        {valorRecibido > 0 && (
                                            <Box sx={{
                                                mt: 0.8, px: 2, py: 0.8, borderRadius: 2, textAlign: 'center',
                                                bgcolor: cambioEfectivo >= 0 ? '#10B98112' : '#EF444412',
                                                border: '1.5px solid', borderColor: cambioEfectivo >= 0 ? '#10B98140' : '#EF444440',
                                            }}>
                                                <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>Cambio a devolver</Typography>
                                                <Typography sx={{ fontSize: 18, fontWeight: 800, color: cambioEfectivo >= 0 ? '#10B981' : '#EF4444' }}>
                                                    {formatCurrency(cambioEfectivo >= 0 ? cambioEfectivo : 0)}
                                                </Typography>
                                                {cambioEfectivo < 0 && (
                                                    <Typography sx={{ fontSize: 10, color: '#EF4444' }}>Faltan {formatCurrency(Math.abs(cambioEfectivo))}</Typography>
                                                )}
                                            </Box>
                                        )}
                                    </Box>
                                )}

                                {/* Botón registrar */}
                                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'flex-end', gap: 0.5, flexShrink: 0 }}>
                                    {editingVenta && (
                                        <Button onClick={resetForm} variant="outlined"
                                            sx={{ borderRadius: 2, fontWeight: 600, borderColor: 'divider', mb: 0.5 }}>
                                            Cancelar edición
                                        </Button>
                                    )}
                                    <Button
                                        id="btn-registrar-venta"
                                        type="submit" variant="contained"
                                        disabled={savingVenta}
                                        onClick={handleSubmit}
                                        startIcon={savingVenta ? <CircularProgress size={18} sx={{ color: 'white' }} /> : (metodoPago === 'Link de Pago' ? <CreditCard /> : <ShoppingCart />)}
                                        sx={{
                                            background: metodoPago === 'Link de Pago' ? 'linear-gradient(135deg, #FF6020, #ff9a62)' : `linear-gradient(135deg, ${ACCENT}, #ff9a62)`,
                                            boxShadow: `0 4px 14px rgba(255,96,32,0.35)`,
                                            borderRadius: 3, fontWeight: 800, py: 1.8, px: 4,
                                            fontSize: 16, whiteSpace: 'nowrap',
                                        }}
                                    >
                                        {savingVenta ? 'Guardando…' : (editingVenta ? 'Actualizar' : (metodoPago === 'Link de Pago' ? 'Cobrar con Link' : 'Registrar Venta'))}
                                    </Button>
                                    <Typography sx={{ fontSize: 10, color: 'text.disabled', textAlign: 'right' }}>
                                        Ctrl + Enter
                                    </Typography>
                                </Box>
                            </Box>
                        </Paper>
                        )}
                        </TabPanel>
                {/* ════════════════════════════════════════
                    TAB 1 — HISTORIAL
                ════════════════════════════════════════ */}
                <TabPanel value={tabValue} index={1}>
                    <Box sx={{ px: { xs: 2, md: 3 }, pb: 3 }}>

                        {/* Filtros */}
                        <Grid container spacing={1.5} sx={{ mb: 2.5 }} alignItems="center">
                            <Grid item xs={12} sm={5}>
                                <TextField
                                    fullWidth size="small"
                                    placeholder="Buscar por nombre de cliente…"
                                    value={searchTerm}
                                    onChange={(e) => { setSearchTerm(e.target.value); setPage(0); }}
                                    InputProps={{ startAdornment: <InputAdornment position="start"><Search sx={{ color: 'text.secondary', fontSize: 18 }} /></InputAdornment> }}
                                />
                            </Grid>
                            <Grid item xs={6} sm={3}>
                                <TextField
                                    fullWidth size="small" type="date" label="Desde"
                                    value={fechaInicio}
                                    onChange={(e) => { setFechaInicio(e.target.value); setPage(0); }}
                                    InputLabelProps={{ shrink: true }}
                                    sx={{ input: { colorScheme: isDark ? 'dark' : 'light' } }}
                                />
                            </Grid>
                            <Grid item xs={6} sm={3}>
                                <TextField
                                    fullWidth size="small" type="date" label="Hasta"
                                    value={fechaFin}
                                    onChange={(e) => { setFechaFin(e.target.value); setPage(0); }}
                                    InputLabelProps={{ shrink: true }}
                                    sx={{ input: { colorScheme: isDark ? 'dark' : 'light' } }}
                                />
                            </Grid>
                            {(fechaInicio || fechaFin || searchTerm) && (
                                <Grid item xs={12} sm={1}>
                                    <Button size="small" variant="text" onClick={() => { setFechaInicio(''); setFechaFin(''); setSearchTerm(''); setPage(0); }}
                                        sx={{ color: 'text.secondary', fontSize: 11, whiteSpace: 'nowrap' }}>
                                        Limpiar
                                    </Button>
                                </Grid>
                            )}
                        </Grid>

                        {/* Resultado del filtro */}
                        {filteredVentas.length !== ventas.length && (
                            <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 1.5 }}>
                                Mostrando {filteredVentas.length} de {ventas.length} ventas
                            </Typography>
                        )}

                        {/* Cards (mobile) / Tabla (desktop) */}
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
                                            handleOpenDetails={handleOpenDetails}
                                            handleOpenDevolucion={handleOpenDevolucion}
                                        />
                                    ))
                                }
                            </Box>
                        ) : (
                            <TableContainer sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                                <Table size="small">
                                    <TableHead>
                                        <TableRow>
                                            {['#', 'Cliente', 'Productos', 'Total', 'Pagado', 'Saldo', 'Estado', 'Fecha', 'Acciones'].map(h => (
                                                <TableCell key={h} sx={{ fontWeight: 700, fontSize: 12 }}>{h}</TableCell>
                                            ))}
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {paginatedVentas.length === 0
                                            ? <TableRow><TableCell colSpan={9} sx={{ textAlign: 'center', py: 6, color: 'text.secondary' }}>No se encontraron ventas</TableCell></TableRow>
                                            : paginatedVentas.map(v => (
                                                <TableRow key={v.id} hover>
                                                    <TableCell sx={{ fontWeight: 600, color: 'text.secondary', fontSize: 12 }}>#{v.id}</TableCell>
                                                    <TableCell sx={{ fontWeight: 600 }}>{v.cliente?.nombre || 'N/A'}</TableCell>
                                                    <TableCell>
                                                        {v.detalles.map(d => (
                                                            <Typography key={d.id} sx={{ fontSize: 12, color: 'text.secondary' }}>{d.producto?.nombre} × {d.cantidad}</Typography>
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
                                                            <Tooltip title="Ver detalle"><IconButton size="small" onClick={() => handleOpenDetails(v)} sx={{ color: '#3B82F6', '&:hover': { bgcolor: '#EFF6FF' } }}><Visibility fontSize="small" /></IconButton></Tooltip>
                                                            {v.detalles?.length > 0 && (
                                                                <Tooltip title="Registrar devolución"><IconButton size="small" onClick={() => handleOpenDevolucion(v)} sx={{ color: '#F59E0B', '&:hover': { bgcolor: '#FFFBEB' } }}><AssignmentReturn fontSize="small" /></IconButton></Tooltip>
                                                            )}
                                                            <Tooltip title="Editar"><IconButton size="small" onClick={() => handleEdit(v)} sx={{ color: ACCENT, '&:hover': { bgcolor: '#FFF0E9' } }}><Edit fontSize="small" /></IconButton></Tooltip>
                                                            <Tooltip title="Eliminar"><IconButton size="small" onClick={() => handleDelete(v.id)} sx={{ color: '#EF4444', '&:hover': { bgcolor: '#FEF2F2' } }}><Delete fontSize="small" /></IconButton></Tooltip>
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
                            rowsPerPageOptions={[10, 25, 50]} component="div"
                            count={filteredVentas.length} rowsPerPage={rowsPerPage} page={page}
                            onPageChange={(_, p) => setPage(p)}
                            onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
                            labelRowsPerPage="Filas:" labelDisplayedRows={({ from, to, count }) => `${from}–${to} de ${count}`}
                        />
                    </Box>
                </TabPanel>
            </Paper>

            {/* ── Dialogs ── */}
            <ConfirmationDialog
                open={showDeleteDialog} handleClose={() => setShowDeleteDialog(false)}
                handleConfirm={confirmDelete} title="Eliminar venta"
                message="¿Estás seguro de que quieres eliminar esta venta? Esta acción no se puede deshacer."
            />
            <VentaDetailDialog
                open={detailModalOpen} handleClose={handleCloseDetails}
                venta={selectedVenta} empresa={user?.empresa}
                vendedor={user?.nombre_completo || user?.username}
            />
            <DevolucionDialog
                open={devolucionOpen} onClose={() => setDevolucionOpen(false)}
                venta={ventaDevolucion} onSuccess={handleDevolucionSuccess}
            />
            <QuickCreateModal
                open={quickCreate.open} onClose={closeQuickCreate}
                type={quickCreate.type} initialName={quickCreate.initialName}
                onCreated={handleQuickCreated}
            />
            <ReciboDialog
                open={reciboOpen} onClose={() => setReciboOpen(false)}
                venta={reciboVenta} empresa={user?.empresa}
                vendedor={user?.nombre_completo || user?.username}
            />
            {basculaProducto && (
                <BasculaWidget
                    producto={basculaProducto}
                    onConfirmar={handleConfirmarPesoBascula}
                    onCancelar={() => setBasculaProducto(null)}
                />
            )}
            {varianteProducto && (
                <VarianteSelectorDialog
                    producto={varianteProducto}
                    onSeleccionar={handleConfirmarVariante}
                    onCancelar={() => setVarianteProducto(null)}
                />
            )}
            <LinkPagoModal
                open={linkPagoModalOpen}
                onClose={() => { setLinkPagoModalOpen(false); pendingVentaRef.current = null; }}
                onConfirm={() => { setLinkPagoModalOpen(false); handleVentaSubmit(); }}
                linkConfig={linkPagoConfig}
                clienteTelefono={cliente?.telefono || ''}
            />
        </Box>
    );
};

export default Ventas;