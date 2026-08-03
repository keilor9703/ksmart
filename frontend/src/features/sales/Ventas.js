import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import apiClient from '../../api';
import { formatCurrency } from '../../utils/formatters';
import { sugerenciasEfectivo } from '../../utils/cashSuggestions';
import { toast } from 'react-toastify';
import CurrencyField from '../../components/common/CurrencyField';
import ConfirmationDialog from '../../components/common/ConfirmationDialog';
import VentaDetailDialog from './VentaDetailDialog';
import DevolucionDialog from './DevolucionDialog';
import QuickCreateModal from '../../components/common/QuickCreateModal';
import ReciboDialog from '../../components/common/ReciboDialog';
import LinkPagoModal from '../../components/common/LinkPagoModal';
import LiquidButton from '../../components/common/LiquidButton';
import TouchPOSMode from './TouchPOSMode';
import {
    Box, Paper, Typography, Grid, TextField, Button, IconButton,
    Autocomplete, Table, TableBody, TableCell, TableContainer,
    TableHead, TableRow, Chip, useMediaQuery, useTheme, Tabs, Tab,
    TablePagination, Divider, Tooltip, InputAdornment, CircularProgress,
    ToggleButton, ToggleButtonGroup, Switch, FormControlLabel,
    Badge, Dialog, DialogTitle, DialogContent, DialogActions,
    List, ListItem, ListItemText,
} from '@mui/material';
import {
    Edit, Delete, Visibility, Search, ShoppingCart, TrendingUp,
    Receipt, AssignmentReturn, Add, QrCodeScanner,
    Videocam, VideocamOff, LockOutlined, LockOpenOutlined,
    AddCircle, RemoveCircle, PersonOutline, HelpOutline,
    Keyboard, TouchApp, FileDownload, Stars, CreditCard, Close,
    PictureAsPdf, Scale, Notes, PlayCircleOutline,
} from '@mui/icons-material';
import { getProductoByBarcode } from '../../api';
import HelpGuideTopBar from '../../components/onboarding/HelpGuideTopBar';
import SmartTooltip from '../../components/onboarding/SmartTooltip';
import BasculaWidget from '../../components/common/BasculaWidget';
import BasculaConfigDialog from '../../components/common/BasculaConfigDialog';
import { esPesable, useBascula } from '../../hooks/useBascula';
import VarianteSelectorDialog from '../../components/common/VarianteSelectorDialog';
import { sunmiScannerDisponible, escanearSunmi, onScanFisico } from '../../utils/sunmiScanner';
import { alpha } from '@mui/material/styles';

const ACCENT = '#0891B2';
const ACCENT2 = '#0EA5E9';
const HAS_BARCODE_DETECTOR = typeof window !== 'undefined' && 'BarcodeDetector' in window;
const HAS_CAMERA = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
const BARCODE_FORMATS = ['ean_13', 'ean_8', 'code_128', 'qr_code', 'upc_e', 'code_39', 'itf'];

// Helper para focus neon/glassmorphism en TextFields
const getInputSx = (accentColor) => ({
  '& .MuiOutlinedInput-root': {
    borderRadius: 2.5,
    transition: 'all 0.2s ease-in-out',
    '&:hover .MuiOutlinedInput-notchedOutline': {
      borderColor: alpha(accentColor, 0.6),
    },
    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
      borderColor: accentColor,
      borderWidth: 2,
    },
    '&.Mui-focused': {
      boxShadow: `0 0 0 3px ${alpha(accentColor, 0.15)}`,
    },
  },
  '& .MuiInputLabel-root.Mui-focused': {
    color: accentColor,
  },
});

// Solo Efectivo viene fijo por defecto. Cualquier otro método (Nequi,
// Transferencia, Bancolombia, etc.) debe ser configurado por la empresa en
// Mi Cuenta → Link de Pago — no se asumen pasarelas que la empresa no usa.
const METODOS_PAGO = [
    { value: 'Efectivo',      label: '💵 Efectivo',      pagada: true,  color: '#10B981' },
    { value: 'Por Cobrar',    label: '🕒 Por Cobrar',     pagada: false, color: '#EF4444' },
];

// Cada link/QR de pago activo de la empresa (Nequi, Bancolombia, etc.)
// aparece como su propia opción de método de pago, además de la lista fija
// de arriba. El value se codifica como "link:{id}" para poder distinguirlo
// y recuperar cuál link específico se usó al armar el payload de la venta.
const buildMetodosPago = (linkPagosConfig) => [
    ...METODOS_PAGO,
    ...linkPagosConfig.map(l => ({
        value: `link:${l.id}`,
        label: `📲 ${l.nombre}`,
        pagada: true,
        color: '#0891B2',
        digital: true,
        linkData: l,
    })),
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

// ─── Badge de estado ──────────────────────────────────────────────────────────
const getEstadoPagoChip = (estado) => {
    const map = { pagado: { label: 'Pagada', color: 'success' }, parcial: { label: 'Parcial', color: 'warning' }, pendiente: { label: 'Pendiente', color: 'error' } };
    const p = map[estado] || { label: 'Desconocido', color: 'default' };
    return <Chip label={p.label} color={p.color} size="small" sx={{ fontWeight: 600, fontSize: 11, borderRadius: 1.5 }} />;
};

// ─── Chip de estado de Factura Electrónica ────────────────────────────────────
const ChipFE = ({ estado, ventaId, onReintentar }) => {
    if (!estado || estado === 'no_enviado') return null;
    if (estado === 'exitoso') {
        return (
            <Chip
                label="✓ FE"
                size="small"
                sx={{ ml: 0.5, bgcolor: '#d1fae5', color: '#065f46', fontWeight: 700, fontSize: 10, height: 18, borderRadius: 1 }}
            />
        );
    }
    if (estado === 'pendiente') {
        return (
            <Chip
                label="⏳ FE"
                size="small"
                sx={{ ml: 0.5, bgcolor: '#fef3c7', color: '#92400e', fontWeight: 700, fontSize: 10, height: 18, borderRadius: 1 }}
            />
        );
    }
    if (estado === 'fallido') {
        return (
            <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.3 }}>
                <Chip
                    label="✗ FE"
                    size="small"
                    sx={{ ml: 0.5, bgcolor: '#fee2e2', color: '#991b1b', fontWeight: 700, fontSize: 10, height: 18, borderRadius: 1 }}
                />
                <Tooltip title="Reintentar emisión FE">
                    <IconButton
                        size="small"
                        onClick={() => onReintentar && onReintentar(ventaId)}
                        sx={{ p: 0.2, color: '#DC2626', '&:hover': { bgcolor: '#FEE2E2' } }}
                    >
                        <span style={{ fontSize: 11 }}>↺</span>
                    </IconButton>
                </Tooltip>
            </Box>
        );
    }
    return null;
};

// ─── Venta Card (mobile) ──────────────────────────────────────────────────────
const VentaCard = ({ venta, handleEdit, handleDelete, handleOpenDetails, handleOpenDevolucion, handleReintentarFE }) => (
    <Paper sx={{ p: 2.5, mb: 2, borderRadius: 3, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
            <Box sx={{ flex: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5, flexWrap: 'wrap' }}>
                    <Typography sx={{
                        fontSize: 12, fontWeight: 800, fontFamily: 'monospace',
                        bgcolor: `${ACCENT}14`, color: ACCENT,
                        px: 0.8, py: 0.2, borderRadius: 1, display: 'inline-block',
                    }}>
                        V{String(venta.numero_venta ?? venta.id).padStart(4, '0')}
                    </Typography>
                    <ChipFE estado={venta.estado_electronico} ventaId={venta.id} onReintentar={handleReintentarFE} />
                </Box>
                <Typography sx={{ fontWeight: 700, fontSize: 15 }}>{venta.cliente?.nombre || 'Consumidor final'}</Typography>
                {venta.numero_factura && (
                    <Typography sx={{ fontSize: 11, fontFamily: 'monospace', color: 'text.secondary', fontWeight: 600 }}>
                        FE: {venta.numero_factura}
                    </Typography>
                )}
                <Typography sx={{ fontSize: 11, color: 'text.disabled' }}>{new Date(venta.fecha + (venta.fecha?.endsWith('Z') ? '' : 'Z')).toLocaleString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</Typography>
            </Box>
            {getEstadoPagoChip(venta.estado_pago)}
        </Box>
        <Divider sx={{ my: 1.5 }} />
        <Box sx={{ mb: 1.5 }}>
            {venta.detalles.map(d => (
                <Typography key={d.id} sx={{ fontSize: 13, color: 'text.secondary', mb: 0.3 }}>
                    • {d.producto?.nombre || d.nombre_libre || 'Ítem'} × {d.cantidad}
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
            {venta.pdf_url && (
                <Tooltip title="PDF factura electrónica">
                    <IconButton size="small" component="a" href={venta.pdf_url} target="_blank" rel="noopener noreferrer" sx={{ color: '#EF4444', bgcolor: '#FEF2F2', borderRadius: 1.5 }}>
                        <PictureAsPdf fontSize="small" />
                    </IconButton>
                </Tooltip>
            )}
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
    const stock = detail.producto?.stock_vigente ?? detail.producto?.stock_actual ?? null;
    const isService = detail.producto?.es_servicio;
    const stockBajo = !isService && stock !== null && stock <= (detail.producto?.stock_minimo ?? 0);

    const handleQty = (delta) => {
        const isDecimal = detail.producto && ['MTS', 'KGS', 'LTS'].includes(detail.producto.unidad_medida);
        const next = isDecimal
            ? Math.max(0, parseFloat((detail.cantidad + delta).toFixed(2)))
            : Math.max(0, Math.round(detail.cantidad + delta));
        onFieldChange(detail.id, 'cantidad', next);
    };

    // ── Campos reutilizables (mismo contenido en móvil y escritorio) ──
    const cantidadEl = (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: isMobile ? 0 : 0.4 }}>
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
    );

    const precioEl = (
        priceUnlocked ? (
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
        )
    );

    const descEl = (
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
                sx={{ width: isMobile ? 90 : 68 }}
            />
        </SmartTooltip>
    );

    const subtotalEl = (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, justifyContent: 'flex-end' }}>
            <Box sx={{ textAlign: 'right' }}>
                {(detail.descuentoPct || 0) > 0 && (
                    <Typography sx={{ fontSize: 10, color: 'text.secondary', textDecoration: 'line-through' }}>{formatCurrency(subtotalSinDesc)}</Typography>
                )}
                <Typography sx={{ fontWeight: 800, fontSize: 15, color: (detail.descuentoPct || 0) > 0 ? '#10B981' : ACCENT }}>
                    {formatCurrency(subtotalFinal)}
                </Typography>
            </Box>
            <Tooltip title="Quitar">
                <IconButton onClick={() => onRemove(detail.id)} size="small" sx={{ color: '#EF4444', bgcolor: '#FEF2F2', borderRadius: 1.5 }}>
                    <RemoveCircle fontSize="small" />
                </IconButton>
            </Tooltip>
        </Box>
    );

    const productoBox = (
        <>
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
                                    <Typography sx={{ fontSize: 10, color: option.es_servicio ? '#3B82F6' : ((option.stock_vigente ?? option.stock_actual) <= 0 ? '#EF4444' : 'text.secondary') }}>
                                        {option.es_servicio ? 'Servicio' : `Stock: ${option.stock_vigente ?? option.stock_actual ?? 0}`}
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
        </>
    );

    // ── Móvil: filas compactas (cantidad+precio) y (desc+total) ──
    if (isMobile) {
        return (
            <Box sx={{
                display: 'flex', flexDirection: 'column',
                gap: 1.2, mb: 1.5, p: 1.5,
                borderRadius: 2, bgcolor: 'action.hover',
                border: '1px solid', borderColor: stockBajo ? '#F59E0B50' : 'divider',
            }}>
                {/* Producto */}
                <Box>
                    {productoBox}
                </Box>
                {/* Cantidad + Precio (misma fila) */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {cantidadEl}
                    <Box sx={{ flex: 1, minWidth: 0 }}>{precioEl}</Box>
                </Box>
                {/* Desc % + Total (misma fila) */}
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                    {descEl}
                    {subtotalEl}
                </Box>
            </Box>
        );
    }

    return (
        <Box sx={{
            display: 'flex', flexDirection: 'row',
            alignItems: 'flex-start',
            gap: 1, mb: 1.5, p: 1.5,
            borderRadius: 2, bgcolor: 'action.hover',
            border: '1px solid', borderColor: stockBajo ? '#F59E0B50' : 'divider',
        }}>
            {/* Producto */}
            <Box sx={{ flex: 1, minWidth: 200 }}>
                {productoBox}
            </Box>

            {/* Cantidad con +/- */}
            {cantidadEl}

            {/* Precio (bloqueado por defecto) */}
            <Box sx={{ minWidth: 120, mt: 0.4 }}>
                {precioEl}
            </Box>

            {/* Desc % (compacto) */}
            <Box sx={{ mt: 0.4 }}>
                {descEl}
            </Box>

            {/* Subtotal + quitar */}
            <Box sx={{ mt: 0.4 }}>
                {subtotalEl}
            </Box>
        </Box>
    );
};

// ─── Componente principal ──────────────────────────────────────────────────────
const Ventas = ({ user }) => {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    // El historial de ventas permite editar/eliminar una venta ya registrada —
    // solo el Admin puede hacerlo (el backend también lo bloquea en
    // PUT/DELETE /ventas/{id}, esto es solo para no mostrar la pestaña).
    const isAdmin = user?.role?.name === 'Admin';
    const location = useLocation();

    // Cobro proveniente de una cita del módulo de agendamiento.
    const citaIdRef = useRef(null);          // id de la cita a vincular al guardar
    const citaVendedorRef = useRef(null);    // id del trabajador (vendedor) de la cita
    const citaProductoRef = useRef(null);    // servicio inyectado (para preservarlo en refetch)
    const fromCitaAppliedRef = useRef(false); // evita reaplicar al re-render
    // Ref hacia handleGuardarBorrador (definida más abajo) para el atajo de
    // teclado, sin depender del orden de declaración dentro del componente.
    const handleGuardarBorradorRef = useRef(null);

    // ── Data ──
    const [totalVentasHoy, setTotalVentasHoy] = useState(0);
    const [ventas, setVentas]       = useState([]);
    const [clientes, setClientes]   = useState([]);
    const [productos, setProductos] = useState([]);
    const [grupos, setGrupos]       = useState([]);
    const [empleados, setEmpleados] = useState([]);

    // ── UI Mode ──
    const [viewMode, setViewMode] = useState(localStorage.getItem('ventas_view_mode') || 'classic');

    // ── Form ──
    const [cliente, setCliente]     = useState(null);
    const [isMostrador, setIsMostrador] = useState(false);
    const [atendidoPor, setAtendidoPor] = useState(null);
    const [saleDetails, setSaleDetails] = useState([{ id: Date.now(), producto: null, cantidad: 1, precioUnitario: 0, descuentoPct: 0 }]);
    const [ivaPorcentajeGlobal, setIvaPorcentajeGlobal] = useState(19);
    const [valorRecibido, setValorRecibido] = useState(0);
    const [pagada, setPagada]       = useState(true);
    const [metodoPago, setMetodoPago] = useState('Efectivo');
    const [solicitaFe, setSolicitaFe] = useState(false);
    const [editingVenta, setEditingVenta] = useState(null);
    const [savingVenta, setSavingVenta]   = useState(false);

    // ── Borradores de venta ("aparcar" el carrito para atender a otro cliente) ──
    const [borradores, setBorradores]         = useState([]);
    const [borradoresOpen, setBorradoresOpen] = useState(false);
    const [guardandoBorrador, setGuardandoBorrador] = useState(false);
    const [retomandoBorradorId, setRetomandoBorradorId] = useState(null);

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
    // ── Link de Pago POS (múltiples links activos: Nequi, Bancolombia, etc.) ──
    const [linkPagosConfig, setLinkPagosConfig] = useState([]);
    const [linkPagoModalOpen, setLinkPagoModalOpen] = useState(false);
    const pendingVentaRef = useRef(null);
    const metodosPagoConLinks = buildMetodosPago(linkPagosConfig);
    const selectedLinkPago = metodoPago?.startsWith('link:')
        ? linkPagosConfig.find(l => `link:${l.id}` === metodoPago)
        : null;

    // ── Barcode / Camera ──
    const [barcodeInput, setBarcodeInput]     = useState('');
    const [cameraActive, setCameraActive]     = useState(false);
    const [sunmiScanOk, setSunmiScanOk]       = useState(false); // escáner nativo Sunmi disponible
    const handleProcessBarcodeRef = useRef(null);                 // para el listener del botón físico
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
    const [basculaProducto,    setBasculaProducto]    = useState(null);
    const [basculaConfigOpen,  setBasculaConfigOpen]  = useState(false);
    const { config: basculaConfig, guardarConfig: guardarBasculaConfig } = useBascula();
    const [varianteProducto, setVarianteProducto] = useState(null); // producto con variantes esperando selección
    const [tabValue, setTabValue]                 = useState(0);
    const [page, setPage]                         = useState(0);
    const [rowsPerPage, setRowsPerPage]           = useState(25);
    const [searchTerm, setSearchTerm]             = useState('');
    const [fechaInicio, setFechaInicio]           = useState('');
    const [fechaFin, setFechaFin]                 = useState('');
    const [estadoPagoFiltro, setEstadoPagoFiltro] = useState('');
    const [ventasTotal, setVentasTotal]           = useState(0);
    const [ventasPages, setVentasPages]           = useState(1);
    const [ventasStats, setVentasStats]           = useState({ sum_total: 0, sum_pagado: 0, sum_pendiente: 0 });

    // ── Fetch inicial ──
    const fetchBorradores = useCallback(() => {
        apiClient.get('/ventas/borradores').then(r => setBorradores(r.data || [])).catch(() => {});
    }, []);

    useEffect(() => {
        fetchVentas(); fetchClientes(); fetchProductos(); fetchVentasSummary(); fetchGrupos();
        fetchBorradores();
        apiClient.get('/admin/usuarios/').then(r => setEmpleados(r.data.filter(u => u.is_active))).catch(() => {});
        apiClient.get('/empresa/link-pago/activos').then(r => setLinkPagosConfig(r.data || [])).catch(() => {});
        apiClient.get('/empresa/config-ventas').then(r => setConfigFidelizacion({
            activa:      r.data.fidelizacion_activa     ?? true,
            redeem_rate: r.data.fidelizacion_redeem_rate ?? PUNTOS_REDEEM_RATE_DEFAULT,
        })).catch(() => {});
    }, []);

    // ── Precarga desde una cita (cobro de agendamiento) ──
    // El módulo de agendamiento redirige aquí guardando los datos en sessionStorage
    // (robusto ante recargas/navegación) con el state de React Router como respaldo.
    useEffect(() => {
        if (fromCitaAppliedRef.current) return;
        let fc = null;
        try {
            const raw = sessionStorage.getItem('ksmart_cobro_cita');
            if (raw) fc = JSON.parse(raw);
        } catch { /* ignore */ }
        if (!fc) fc = location.state?.fromCita || null;
        if (!fc) return;

        fromCitaAppliedRef.current = true;
        try { sessionStorage.removeItem('ksmart_cobro_cita'); } catch { /* ignore */ }

        if (fc.cliente) {
            setCliente(fc.cliente);
            setClienteInput(fc.cliente.nombre || '');
            setIsMostrador(false);
            setClientes(prev => prev.some(c => c.id === fc.cliente.id) ? prev : [...prev, fc.cliente]);
        }
        if (fc.producto) {
            // El servicio puede no estar en la lista POS (solo_pos); lo añadimos para
            // que el Autocomplete del ítem lo muestre, y lo preservamos en refetch.
            citaProductoRef.current = fc.producto;
            setProductos(prev => prev.some(p => p.id === fc.producto.id) ? prev : [...prev, fc.producto]);
            const newRowId = Date.now();
            setSaleDetails([{
                id: newRowId, producto: fc.producto, cantidad: 1,
                precioUnitario: fc.precio ?? fc.producto.precio ?? 0, descuentoPct: 0,
            }]);
            // El Autocomplete del producto es controlado en inputValue: hay que
            // setear el texto para que muestre el nombre del servicio.
            setProductoInputs({ [newRowId]: fc.producto.nombre || '' });
        }
        if (fc.trabajadorId) {
            citaVendedorRef.current = fc.trabajadorId;  // garantiza operador_id = trabajador
            const trab = { id: fc.trabajadorId, nombre_completo: fc.trabajadorNombre, username: fc.trabajadorNombre };
            setEmpleados(prev => prev.some(e => e.id === fc.trabajadorId) ? prev : [...prev, trab]);
            setAtendidoPor(prev => prev || trab);
        }
        citaIdRef.current = fc.citaId;
        toast.info('Cobro de cita cargado. Agrega más productos si lo necesitas y registra la venta.');
        // Limpia el state para que un refresh no reaplique la precarga.
        window.history.replaceState({}, document.title);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Cuando lleguen los empleados reales, reemplaza el vendedor inyectado por el
    // objeto completo del trabajador (para el Autocomplete), sin perder el id.
    useEffect(() => {
        if (!citaVendedorRef.current || !empleados.length) return;
        const emp = empleados.find(e => e.id === citaVendedorRef.current);
        if (emp) setAtendidoPor(prev => (prev && prev.id === emp.id) ? emp : (prev || emp));
    }, [empleados]);

    const fetchVentas = (p = page, rpp = rowsPerPage, search = searchTerm, fi = fechaInicio, ff = fechaFin, ep = estadoPagoFiltro) => {
        const params = { page: p + 1, page_size: rpp };
        if (search) params.search = search;
        if (fi) params.fecha_inicio = fi;
        if (ff) params.fecha_fin = ff;
        if (ep) params.estado_pago = ep;
        apiClient.get('/ventas/', { params })
            .then(r => {
                setVentas(r.data.items);
                setVentasTotal(r.data.total);
                setVentasPages(r.data.pages);
                if (r.data.stats) setVentasStats(r.data.stats);
            })
            .catch(console.error);
    };
    const fetchClientes      = () => apiClient.get('/clientes/').then(r => setClientes(r.data)).catch(console.error);
    const fetchClientePuntos = useCallback((clienteId) => {
        if (!clienteId) { setClientePuntos(0); setPuntosACanjear(0); return; }
        apiClient.get(`/clientes/${clienteId}/puntos`)
            .then(r => setClientePuntos(r.data.puntos_disponibles || 0))
            .catch(() => setClientePuntos(0));
    }, []);
    const fetchProductos     = () => apiClient.get('/productos/', { params: { solo_pos: true } }).then(r => {
        let list = [...r.data];
        // Preserva el servicio inyectado desde un cobro de cita (puede no ser solo_pos).
        const cp = citaProductoRef.current;
        if (cp && !list.some(p => p.id === cp.id)) list.push(cp);
        setProductos(list.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')));
    }).catch(console.error);
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
        } else if (!citaIdRef.current) {
            // No resetear si hay un cobro de cita precargado (se borraría el servicio
            // y el cliente al refrescar la lista de clientes).
            resetForm();
        }
    }, [editingVenta, clientes]);

    // ── Atajo de teclado: Ctrl+Enter → registrar venta ──
    useEffect(() => {
        const onKey = (e) => {
            // Cmd/Ctrl+Enter → registrar venta
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && tabValue === 0 && !savingVenta) {
                e.preventDefault();
                document.getElementById('btn-registrar-venta')?.click();
                return;
            }

            // Cmd/Ctrl+G → guardar el carrito actual como borrador
            if ((e.ctrlKey || e.metaKey) && (e.key === 'g' || e.key === 'G') && tabValue === 0 && !savingVenta) {
                e.preventDefault();
                handleGuardarBorradorRef.current?.();
                return;
            }

            // Auto-focus al campo de búsqueda cuando:
            // - Estamos en el tab de venta (0) y la cámara no está activa
            // - La tecla es un carácter imprimible (letras, números)
            // - El foco actual NO está en un input, textarea o select
            if (
                tabValue === 0 &&
                !cameraActive &&
                !e.ctrlKey && !e.metaKey && !e.altKey &&
                e.key.length === 1 &&
                barcodeFieldRef.current
            ) {
                const active = document.activeElement;
                const tag = active?.tagName?.toLowerCase();
                const isTypingElsewhere = tag === 'input' || tag === 'textarea' || tag === 'select' || active?.isContentEditable;
                if (!isTypingElsewhere) {
                    barcodeFieldRef.current.focus();
                    // No prevenimos el default para que el carácter caiga en el campo
                }
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [tabValue, savingVenta, cameraActive]);

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

    const handleToggleCamera = async () => {
        // En un dispositivo Sunmi usamos el escáner nativo (la cámara del WebView
        // no funciona al cargar la web remota). En un navegador/celular normal,
        // se usa la cámara web como antes.
        if (sunmiScanOk) {
            const code = await escanearSunmi();
            if (code) handleProcessBarcode(code);
            return;
        }
        if (cameraActive) { cleanupCamera(); setCameraActive(false); setTimeout(() => barcodeFieldRef.current?.focus(), 100); }
        else setCameraActive(true);
    };

    // Detectar el escáner Sunmi al montar.
    useEffect(() => {
        sunmiScannerDisponible().then(setSunmiScanOk).catch(() => setSunmiScanOk(false));
    }, []);

    // Botón físico del escáner del V3 (modo broadcast): inyecta el código en la
    // misma lógica que la búsqueda por código de barras. Solo en modo clásico —
    // en modo táctil lo maneja TouchPOSMode para no procesarlo dos veces.
    useEffect(() => {
        if (!sunmiScanOk || viewMode !== 'classic') return undefined;
        return onScanFisico((code) => handleProcessBarcodeRef.current?.(code));
    }, [sunmiScanOk, viewMode]);

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
        let abrioModal = false;
        try {
            const res = await getProductoByBarcode(barcode);
            if (res.data) {
                const producto = res.data;
                if (producto.id === 0) {
                    toast.warning(`"${producto.nombre}" no está en tu inventario. Regístralo primero.`);
                    openQuickCreate('producto', producto.nombre);
                    return;
                }
                // Variantes: abrir selector antes de agregar
                if (producto.tiene_variantes && producto.variantes?.length > 0) {
                    setVarianteProducto(producto);
                    abrioModal = true;
                    return;
                }
                // Pesable: abrir báscula (tanto si ya está en carrito como si es nuevo)
                if (esPesable(producto.unidad_medida)) {
                    setBasculaProducto(producto);
                    abrioModal = true;
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
            // No devolver foco al campo si se abrió báscula o selector de variantes
            if (!abrioModal) {
                setTimeout(() => barcodeFieldRef.current?.focus(), 100);
            }
        }
    };
    handleProcessBarcodeRef.current = handleProcessBarcode;

    // ── Mostrador ──
    const handleSetMostrador = () => {
        if (solicitaFe) {
            toast.warning('La Factura Electrónica exige un cliente identificado. Desactiva FE para vender como Mostrador.');
            return;
        }
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

    // Determina si un cliente está identificado (tiene cédula/NIT) para FE
    const clienteIdentificado = (c) => !!(c && (c.cedula || '').trim());

    // Toggle de FE: al activarlo se exige cliente identificado (no Mostrador).
    const handleToggleFe = (checked) => {
        if (checked && (isMostrador || !clienteIdentificado(cliente))) {
            // Limpiar Mostrador / cliente sin identificación: el cajero debe elegir uno válido
            setCliente(null); setClienteInput(''); setIsMostrador(false);
            toast.info('Selecciona o registra un cliente con NIT/cédula para emitir Factura Electrónica.');
        }
        setSolicitaFe(checked);
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
            setProductos(prev => [...prev, nuevo].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')));
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
        if (solicitaFe && !clienteIdentificado(cliente)) {
            toast.error('La Factura Electrónica requiere un cliente con NIT/cédula. Edita el cliente o desactiva FE.');
            return;
        }
        const validDetails = saleDetails.filter(d => d.isLibre ? d.precioUnitario > 0 : (d.producto !== null && d.cantidad > 0));
        if (validDetails.length === 0) { toast.error('Agrega al menos un producto al carrito.'); return; }

        const descuentoPuntosImporte = puntosACanjear * (configFidelizacion.redeem_rate || PUNTOS_REDEEM_RATE_DEFAULT);

        // ── Link de Pago — mostrar QR/URL al cliente antes de registrar ──
        if (pagada && selectedLinkPago && !pendingVentaRef.current) {
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
            pagada, metodo_pago: pagada ? (selectedLinkPago ? 'Link de Pago' : metodoPago) : null,
            link_pago_nombre: pagada && selectedLinkPago ? selectedLinkPago.nombre : undefined,
            iva_porcentaje: parseFloat(ivaPorcentajeGlobal),
            // El vendedor es el trabajador de la cita si la venta vino de un cobro de agendamiento.
            operador_id: atendidoPor?.id ?? citaVendedorRef.current ?? user?.id,
            descuento_puntos: descuentoPuntosImporte,
            puntos_canjeados: puntosACanjear,
            omitir_inventario: omitirInventarioRef.current,
            solicita_fe: solicitaFe,
            cita_id: citaIdRef.current || undefined,
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
            // La cita (si la hubo) quedó vinculada en el backend; limpiar para la próxima venta.
            citaIdRef.current = null;
            citaVendedorRef.current = null;
            fetchVentas(); fetchVentasSummary();
            fetchProductos(); // refrescar stock visible tras el descuento de inventario

            const totalBruto = snapDetails.reduce((s, d) => s + d.precio_unitario * d.cantidad, 0);
            setReciboVenta({
                id: saved.id, numero_venta: saved.numero_venta,
                fecha: saved.fecha || new Date().toISOString(),
                cliente: snapCliente, detalles: snapDetails,
                total: saved.total ?? totalBruto, iva_porcentaje: parseFloat(ivaPorcentajeGlobal) || 0,
                iva_total: saved.iva_total ?? 0,
                monto_pagado: pagada ? (saved.total ?? totalBruto) : 0,
                metodo_pago: ventaData.metodo_pago, estado_pago: pagada ? 'pagado' : 'pendiente',
                puntos_ganados: saved.puntos_ganados ?? 0,
                puntos_canjeados: puntosACanjear || 0,
                descuento_puntos: descuentoPuntosImporte || 0,
                saldo_puntos_cliente: saved.saldo_puntos_cliente ?? null,
            });
            setReciboOpen(true);
            resetForm();
            setTimeout(() => barcodeFieldRef.current?.focus(), 150);
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Error al guardar la venta.');
        } finally {
            setSavingVenta(false);
        }
    };

    const handleSubmit = (e) => { if (e?.preventDefault) e.preventDefault(); handleVentaSubmit(); };

    const resetForm = () => {
        setCliente(null); setClienteInput(''); setIsMostrador(false);
        setAtendidoPor(null);
        const initialId = Date.now();
        setSaleDetails([{ id: initialId, producto: null, cantidad: 1, precioUnitario: 0, descuentoPct: 0 }]);
        setProductoInputs({}); setIvaPorcentajeGlobal(19); setValorRecibido(0);
        setPagada(true); setMetodoPago('Efectivo'); setSolicitaFe(false); setEditingVenta(null);
        setPuntosACanjear(0); setClientePuntos(0); setOmitirInventario(false); pendingVentaRef.current = null;
        cleanupCamera(); setCameraActive(false);
        setTimeout(() => barcodeFieldRef.current?.focus(), 300);
    };

    // ── Borradores de venta ──────────────────────────────────────────────
    const handleGuardarBorrador = async () => {
        if (editingVenta) { toast.warning('No puedes aparcar una venta que estás editando.'); return; }
        const validDetails = saleDetails.filter(d => d.isLibre ? d.precioUnitario > 0 : (d.producto !== null && d.cantidad > 0));
        if (validDetails.length === 0) { toast.warning('Agrega al menos un producto antes de guardar el borrador.'); return; }

        const snapshot = {
            saleDetails, cliente, isMostrador, clienteInput, atendidoPor,
            metodoPago, pagada, ivaPorcentajeGlobal, valorRecibido, solicitaFe,
            omitirInventario, puntosACanjear,
            citaId: citaIdRef.current || null,
        };
        const clienteNombre = isMostrador ? 'Mostrador' : (cliente?.nombre || 'Sin cliente');

        setGuardandoBorrador(true);
        try {
            await apiClient.post('/ventas/borradores', {
                cliente_nombre: clienteNombre,
                total_aproximado: calculateSubtotal(),
                datos: snapshot,
            });
            toast.success('Venta guardada como borrador — puedes atender al siguiente cliente.');
            resetForm();
            fetchBorradores();
        } catch (err) {
            toast.error(err.response?.data?.detail || 'No se pudo guardar el borrador.');
        } finally {
            setGuardandoBorrador(false);
        }
    };
    handleGuardarBorradorRef.current = handleGuardarBorrador;

    const handleRetomarBorrador = async (borradorId) => {
        setRetomandoBorradorId(borradorId);
        try {
            const { data } = await apiClient.get(`/ventas/borradores/${borradorId}`);
            const d = data.datos || {};
            setSaleDetails(d.saleDetails?.length ? d.saleDetails : [{ id: Date.now(), producto: null, cantidad: 1, precioUnitario: 0, descuentoPct: 0 }]);
            setCliente(d.cliente ?? null);
            setIsMostrador(!!d.isMostrador);
            setClienteInput(d.clienteInput || '');
            setAtendidoPor(d.atendidoPor ?? null);
            setMetodoPago(d.metodoPago || 'Efectivo');
            setPagada(d.pagada ?? true);
            setIvaPorcentajeGlobal(d.ivaPorcentajeGlobal ?? 19);
            setValorRecibido(d.valorRecibido || 0);
            setSolicitaFe(!!d.solicitaFe);
            setOmitirInventario(!!d.omitirInventario);
            setPuntosACanjear(d.puntosACanjear || 0);
            citaIdRef.current = d.citaId || null;
            setEditingVenta(null);
            setTabValue(0);
            setBorradoresOpen(false);
            await apiClient.delete(`/ventas/borradores/${borradorId}`);
            fetchBorradores();
            toast.success('Borrador retomado.');
        } catch {
            toast.error('No se pudo retomar el borrador.');
        } finally {
            setRetomandoBorradorId(null);
        }
    };

    const handleDescartarBorrador = async (borradorId) => {
        if (!window.confirm('¿Descartar este borrador? No se podrá recuperar.')) return;
        try {
            await apiClient.delete(`/ventas/borradores/${borradorId}`);
            fetchBorradores();
            toast.success('Borrador descartado.');
        } catch {
            toast.error('No se pudo descartar el borrador.');
        }
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

    // ── Reintentar emisión FE ──
    const handleReintentarFE = (ventaId) => {
        apiClient.post(`/fe/ventas/${ventaId}/emitir`)
            .then(() => fetchVentas())
            .catch(err => console.error('Error al reintentar FE:', err));
    };

    // Filtros y paginación son server-side; ventas ya viene filtrado y paginado
    const filteredVentas  = ventas;
    const paginatedVentas = ventas;

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

            {/* ── Header Hero Banner ── */}
            <Paper
                elevation={0}
                sx={{
                    p: { xs: 2.5, md: 4 },
                    mb: 3,
                    borderRadius: 4,
                    position: 'relative',
                    overflow: 'hidden',
                    background: isDark
                        ? `linear-gradient(135deg, ${alpha(ACCENT, 0.95)} 0%, #0F172A 100%)`
                        : `linear-gradient(135deg, ${ACCENT} 0%, ${ACCENT2} 100%)`,
                    color: '#fff',
                    boxShadow: '0 8px 32px rgba(8, 145, 178, 0.15)',
                    '&::before': {
                        content: '""',
                        position: 'absolute',
                        top: -50,
                        right: -50,
                        width: 150,
                        height: 150,
                        borderRadius: '50%',
                        background: 'rgba(255, 255, 255, 0.08)',
                        filter: 'blur(20px)',
                    },
                    '&::after': {
                        content: '""',
                        position: 'absolute',
                        bottom: -30,
                        left: '30%',
                        width: 100,
                        height: 100,
                        borderRadius: '50%',
                        background: 'rgba(255, 255, 255, 0.05)',
                        filter: 'blur(15px)',
                    }
                }}
            >
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2, position: 'relative', zIndex: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Box sx={{
                            width: 48,
                            height: 48,
                            borderRadius: 3,
                            bgcolor: 'rgba(255, 255, 255, 0.2)',
                            backdropFilter: 'blur(8px)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            border: '1px solid rgba(255, 255, 255, 0.3)'
                        }}>
                            <ShoppingCart sx={{ color: '#fff', fontSize: 24 }} />
                        </Box>
                        <Box>
                            <Typography sx={{ fontWeight: 800, fontSize: { xs: 20, md: 24 }, letterSpacing: -0.5 }}>POS & Ventas</Typography>
                            <Typography sx={{ fontSize: 13, color: 'rgba(255,255,255,0.85)' }}>Registra cobros y administra facturas electrónicas al instante</Typography>
                        </Box>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
                        <HelpGuideTopBar
                            moduleName="Ventas POS"
                            moduleColor="#fff"
                            steps={[
                                { title: 'Selecciona el cliente', description: 'Busca por nombre, NIT o teléfono. Para ventas rápidas usa el botón "Mostrador".' },
                                { title: 'Agrega productos', description: 'Escanea el código de barras o escribe el nombre. Usa los botones + / − para ajustar cantidades.' },
                                { title: 'Aplica descuentos', description: 'Cada producto tiene un campo "Desc. %" donde puedes reducir su precio de forma individual.' },
                                { title: 'Elige el método de pago', description: 'Selecciona Efectivo, Transferencia, Tarjeta o "Por Cobrar" para registrar ventas a crédito.' },
                                { title: 'Registra la venta', description: 'Haz clic en "Registrar Venta" o presiona Ctrl + Enter para guardar. El sistema descuenta el stock automáticamente.' },
                            ]}
                        />
                    </Box>
                </Box>
            </Paper>

            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
                <Box />
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <ToggleButtonGroup
                        value={viewMode}
                        exclusive
                        onChange={handleViewModeChange}
                        size="small"
                        sx={{
                            bgcolor: 'background.paper',
                            borderRadius: 2.5,
                            border: '1px solid',
                            borderColor: 'divider',
                            p: 0.5,
                            '& .MuiToggleButton-root': {
                                border: 'none',
                                borderRadius: 2,
                                px: 2,
                                py: 0.5,
                                textTransform: 'none',
                                fontWeight: 700,
                                fontSize: 12.5,
                                '&.Mui-selected': {
                                    bgcolor: alpha(ACCENT, 0.1),
                                    color: ACCENT,
                                    '&:hover': { bgcolor: alpha(ACCENT, 0.15) }
                                }
                            }
                        }}
                    >
                        <ToggleButton value="classic" sx={{ gap: 1 }}>
                            <Keyboard fontSize="small" /> {!isMobile && 'Teclado'}
                        </ToggleButton>
                        <ToggleButton value="touch" sx={{ gap: 1 }}>
                            <TouchApp fontSize="small" /> {!isMobile && 'Táctil'}
                        </ToggleButton>
                    </ToggleButtonGroup>
                    <Tooltip title="Configurar báscula digital (USB/Serial)">
                        <IconButton onClick={() => setBasculaConfigOpen(true)} size="small" sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 1, bgcolor: 'background.paper' }}>
                            <Scale fontSize="small" sx={{ color: 'text.secondary' }} />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="Exportar historial filtrado a CSV">
                        <IconButton onClick={exportCSV} size="small" sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 1, bgcolor: 'background.paper' }}>
                            <FileDownload fontSize="small" sx={{ color: 'text.secondary' }} />
                        </IconButton>
                    </Tooltip>
                    <Box sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        px: 2,
                        py: 0.75,
                        borderRadius: 2.5,
                        bgcolor: alpha(ACCENT, 0.08),
                        border: '1px solid',
                        borderColor: alpha(ACCENT, 0.15),
                        boxShadow: `0 2px 8px ${alpha(ACCENT, 0.05)}`
                    }}>
                        <TrendingUp sx={{ fontSize: 18, color: ACCENT }} />
                        <Typography sx={{ fontSize: 12, color: 'text.secondary', fontWeight: 600 }}>Hoy:</Typography>
                        <Typography sx={{ fontSize: 14, fontWeight: 800, color: ACCENT }}>{formatCurrency(totalVentasHoy)}</Typography>
                    </Box>
                    {borradores.length > 0 && (
                        <Button
                            size="small"
                            onClick={() => setBorradoresOpen(true)}
                            startIcon={<Badge badgeContent={borradores.length} color="warning"><Notes sx={{ fontSize: 18 }} /></Badge>}
                            sx={{
                                ml: 1, borderRadius: 2.5, fontWeight: 700, fontSize: 12, textTransform: 'none',
                                color: '#B45309', bgcolor: alpha('#F59E0B', 0.1),
                                '&:hover': { bgcolor: alpha('#F59E0B', 0.18) },
                            }}
                        >
                            Borradores
                        </Button>
                    )}
                </Box>
            </Box>

            {/* ── Tabs ── */}
            <Paper sx={{ borderRadius: 4, border: '1px solid', borderColor: 'divider', boxShadow: isDark ? '0 12px 40px rgba(0,0,0,0.3)' : '0 8px 30px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
                <Tabs
                    value={tabValue} onChange={(_, v) => setTabValue(v)}
                    sx={{
                        px: 2, borderBottom: '1px solid', borderColor: 'divider',
                        background: isDark ? 'rgba(255,255,255,0.01)' : 'rgba(0,0,0,0.01)',
                        '& .MuiTab-root': { fontWeight: 700, fontSize: 14, textTransform: 'none', minHeight: 56 },
                        '& .MuiTabs-indicator': { backgroundColor: ACCENT, height: 3, borderRadius: 3 },
                        '& .Mui-selected': { color: `${ACCENT} !important` },
                    }}
                >
                    <Tab label={editingVenta ? '✏️ Editar Venta' : '➕ Nueva Venta POS'} />
                    {isAdmin && <Tab label={`📋 Historial de Ventas (${ventas.length})`} />}
                </Tabs>

                {/* ════════════════════════════════════════
                    TAB 0 — REGISTRAR VENTA
                ════════════════════════════════════════ */}
                <TabPanel value={tabValue} index={0}>
                    {viewMode === 'classic' ? (
                        <Box sx={{ display: 'flex', gap: 0, alignItems: 'stretch', minHeight: 0, flexDirection: { xs: 'column', lg: 'row' } }}>
                          {/* ── LEFT PANEL ── */}
                          <Box sx={{ flex: 1, minWidth: 0, p: { xs: 2, md: 3 }, overflowY: 'auto', maxHeight: { lg: 'calc(100vh - 220px)' } }}>
                            {/* ── 0. ¿Factura Electrónica? (primera pregunta al cliente) ── */}
                            {user?.empresa?.facturacion_electronica_activa && (
                                <Paper elevation={0} sx={{
                                    mb: 2.5, p: 1.5, borderRadius: 3,
                                    border: '1.5px solid', borderColor: solicitaFe ? 'primary.main' : `${ACCENT}40`,
                                    bgcolor: solicitaFe ? 'primary.50' : (isDark ? `${ACCENT}08` : `${ACCENT}05`),
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap',
                                }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                                        <Typography sx={{ fontSize: 22 }}>🧾</Typography>
                                        <Box sx={{ minWidth: 0 }}>
                                            <Typography sx={{ fontSize: 14, fontWeight: 700 }}>
                                                ¿El cliente requiere Factura Electrónica?
                                            </Typography>
                                            <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
                                                {solicitaFe
                                                    ? 'Factura Electrónica (FE) — requiere cliente con NIT/cédula'
                                                    : 'Documento Equivalente POS (DEE) — consumidor final'}
                                            </Typography>
                                        </Box>
                                    </Box>
                                    <FormControlLabel
                                        control={
                                            <Switch
                                                checked={solicitaFe}
                                                onChange={e => handleToggleFe(e.target.checked)}
                                                color="primary"
                                            />
                                        }
                                        label={
                                            <Typography sx={{ fontSize: 13, fontWeight: 700, color: solicitaFe ? 'primary.main' : 'text.secondary' }}>
                                                {solicitaFe ? 'SÍ — FE' : 'No'}
                                            </Typography>
                                        }
                                        sx={{ m: 0 }}
                                    />
                                </Paper>
                            )}

                            {/* ── 1. Cliente ── */}
                            <Box sx={{ mb: 2.5 }}>
                                <Typography sx={{ fontWeight: 600, fontSize: 11, mb: 1, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.8 }}>
                                    Cliente
                                </Typography>
                                <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                                    {/* Botón Mostrador */}
                                    <Tooltip title={solicitaFe ? 'No disponible: la Factura Electrónica exige un cliente identificado' : 'Venta a cliente anónimo (Consumidor Final)'}>
                                        <span>
                                        <Button
                                            size="small" variant={isMostrador ? 'contained' : 'outlined'}
                                            startIcon={<PersonOutline fontSize="small" />}
                                            onClick={handleSetMostrador}
                                            disabled={solicitaFe}
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
                                        </span>
                                    </Tooltip>

                                    <Autocomplete
                                        sx={{ flex: 1, minWidth: 220 }}
                                        options={clientes}
                                        getOptionLabel={(o) => o?.nombre || ''}
                                        value={cliente}
                                        onChange={(_, v) => {
                                            if (solicitaFe && v && !clienteIdentificado(v)) {
                                                toast.warning(`"${v.nombre}" no tiene NIT/cédula registrado. Edítalo o elige otro cliente para emitir FE.`);
                                            }
                                            setCliente(v); setIsMostrador(false);
                                        }}
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
                                                sx={getInputSx(ACCENT)}
                                                InputProps={{
                                                    ...params.InputProps,
                                                    endAdornment: (<>{params.InputProps.endAdornment}<Tooltip title="Crear nuevo cliente"><IconButton size="small" onClick={() => openQuickCreate('tercero', clienteInput)} sx={{ color: ACCENT, p: 0.5 }}><Add fontSize="small" /></IconButton></Tooltip></>),
                                                }}
                                            />
                                        )}
                                    />
                                </Box>
                            </Box>

                            {/* ── 1b. Atendido por ── */}
                            {empleados.length > 1 && (
                              <Box sx={{ mb: 2.5 }}>
                                <Typography sx={{ fontSize: 11, fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.6, mb: 1 }}>
                                  Atendido por
                                </Typography>
                                <Autocomplete
                                  options={empleados}
                                  getOptionLabel={o => o.nombre_completo || o.username}
                                  value={atendidoPor}
                                  onChange={(_, v) => setAtendidoPor(v)}
                                  renderOption={(props, option) => (
                                    <Box component="li" {...props} sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                      <Box sx={{
                                        width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                                        bgcolor: `${ACCENT}20`, color: ACCENT,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: 12, fontWeight: 800,
                                      }}>
                                        {(option.nombre_completo || option.username).charAt(0).toUpperCase()}
                                      </Box>
                                      <Box>
                                        <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{option.nombre_completo || option.username}</Typography>
                                        {option.nombre_completo && <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>@{option.username}</Typography>}
                                      </Box>
                                    </Box>
                                  )}
                                  renderInput={params => (
                                    <TextField {...params} size="small" fullWidth
                                      sx={getInputSx(ACCENT)}
                                      placeholder={`${user?.nombre_completo || user?.username} (por defecto)`}
                                      helperText="Deja vacío si el vendedor es quien inicia sesión"
                                    />
                                  )}
                                />
                              </Box>
                            )}

                            {/* ── 2. Escáner de código de barras (prominente) ── */}
                            <Paper elevation={0} sx={{
                                mb: 2.5, p: 2, borderRadius: 3,
                                border: `1.5px solid ${ACCENT}40`,
                                bgcolor: isDark ? `${ACCENT}08` : `${ACCENT}05`,
                            }}>
                                <Box
                                    component="form"
                                    onSubmit={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        const val = (barcodeFieldRef.current?.value || barcodeInput || '').trim();
                                        if (val) handleProcessBarcode(val);
                                    }}
                                    sx={{ display: 'flex', gap: 1, alignItems: 'center' }}
                                >
                                    <TextField
                                        fullWidth
                                        placeholder="Escanea o digita el código de barras y presiona Enter…"
                                        value={barcodeInput}
                                        onChange={(e) => setBarcodeInput(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                const val = e.target.value.trim();
                                                if (val) handleProcessBarcode(val);
                                            }
                                        }}
                                        inputRef={barcodeFieldRef}
                                        autoComplete="off"
                                        disabled={searchingBarcode}
                                        sx={getInputSx(ACCENT)}
                                        InputProps={{
                                            startAdornment: <InputAdornment position="start"><QrCodeScanner sx={{ color: ACCENT, fontSize: 22 }} /></InputAdornment>,
                                            endAdornment: searchingBarcode ? <CircularProgress size={18} sx={{ color: ACCENT }} /> : null,
                                            sx: { fontSize: 15, fontWeight: 600, borderRadius: 2 },
                                            // Este campo es para escanear (lector físico o cámara), no para
                                            // escribir a mano: inputMode="none" evita que el teclado virtual
                                            // se despliegue en móvil cada vez que el cursor queda aquí.
                                            inputProps: { inputMode: 'none' },
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
                                            Agregar producto
                                        </Button>
                                    </Box>
                                </Box>

                                {/* Lista con scroll independiente */}
                                <Box sx={{ maxHeight: { xs: 340, md: 'calc(100vh - 460px)' }, overflowY: 'auto', pr: 0.5,
                                    '&::-webkit-scrollbar': { width: 4 },
                                    '&::-webkit-scrollbar-thumb': { bgcolor: `${ACCENT}50`, borderRadius: 2 },
                                }}>
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
                                </Box>{/* fin scroll */}
                            </Box>
                          </Box>{/* end LEFT PANEL */}

                          {/* ── vertical DIVIDER — desktop only ── */}
                          <Box sx={{ display: { xs: 'none', lg: 'block' }, width: '1px', bgcolor: 'divider', flexShrink: 0 }} />

                          {/* ── RIGHT PANEL ── */}
                          <Box sx={{
                            width: { xs: '100%', lg: 560 }, flexShrink: 0,
                            p: { xs: 2, md: 3 },
                            display: 'flex', flexDirection: 'column', gap: 2,
                            overflowY: 'auto', maxHeight: { lg: 'calc(100vh - 220px)' },
                            bgcolor: isDark ? 'background.paper' : '#FFFBF9',
                            borderLeft: { md: `1.5px solid ${ACCENT}20` },
                          }}>
                            {/* Línea de descuento */}
                            {calculateDescuentoTotal() > 0 && (
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                                    <Typography sx={{ color: 'text.secondary', fontSize: 13 }}>Descuento total</Typography>
                                    <Typography sx={{ color: '#10B981', fontWeight: 600, fontSize: 13 }}>− {formatCurrency(calculateDescuentoTotal())}</Typography>
                                </Box>
                            )}

                            {/* ── Fila 1: IVA + desglose + toggle stock ── */}
                            <Box sx={{
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                flexWrap: 'wrap', gap: 1, mb: 1.5,
                                px: 1.5, py: 1, borderRadius: 2,
                                bgcolor: 'action.hover',
                            }}>
                                {/* IVA chips */}
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
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
                                    {parseFloat(ivaPorcentajeGlobal) > 0 && (() => {
                                        const rate = parseFloat(ivaPorcentajeGlobal);
                                        const sub = calculateSubtotal();
                                        const ivaIncluido = sub * rate / (100 + rate);
                                        const baseNeta = sub - ivaIncluido;
                                        return (
                                            <Box sx={{ display: 'flex', gap: 1.5, ml: 1 }}>
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
                                {/* Toggle stock en la misma fila de IVA */}
                                <FormControlLabel
                                    control={
                                        <Switch
                                            checked={omitirInventario}
                                            onChange={e => setOmitirInventario(e.target.checked)}
                                            size="small"
                                            sx={{
                                                '& .MuiSwitch-switchBase.Mui-checked': { color: '#F59E0B' },
                                                '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: '#F59E0B' },
                                            }}
                                        />
                                    }
                                    label={
                                        <Typography fontSize={12} fontWeight={omitirInventario ? 700 : 500} color={omitirInventario ? '#92400E' : 'text.secondary'}>
                                            Sin validar stock
                                        </Typography>
                                    }
                                    sx={{ m: 0, gap: 0.5 }}
                                />
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

                            {/* ── Métodos de pago ── */}
                            <Box>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.8 }}>
                                    <Typography sx={{ fontSize: 13, fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.8 }}>
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
                                    {metodosPagoConLinks.map(opt => {
                                        const isSelected = pagada ? (opt.pagada && metodoPago === opt.value) : !opt.pagada;
                                        return (
                                            <Box key={opt.value} onClick={() => { setPagada(opt.pagada); if (opt.pagada) setMetodoPago(opt.value); }}
                                                sx={{
                                                    px: 1.5, py: 0.7,
                                                    borderRadius: 2, cursor: 'pointer',
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

                            {/* ── Resumen tipo de documento DIAN ── */}
                            {pagada && user?.empresa?.facturacion_electronica_activa && (
                                <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
                                    📄 Generará un <strong>{solicitaFe ? 'Factura Electrónica (FE)' : 'Documento Equivalente Electrónico (DEE/POS)'}</strong> a la DIAN y consumirá 1 documento de tu cuota mensual.
                                </Typography>
                            )}

                            {/* ── Valor recibido + Cambio (Efectivo) ── */}
                            {pagada && metodoPago === 'Efectivo' && (
                                <Box>
                                    <Typography sx={{ fontSize: 11, fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.8, mb: 0.8 }}>
                                        Valor recibido
                                    </Typography>
                                    <CurrencyField label="" size="small" fullWidth value={valorRecibido} onChange={setValorRecibido} />
                                    {/* Un toque = billete con el que paga el cliente (evita teclear) */}
                                    {totalFinal > 0 && (
                                        <Box sx={{ display: 'flex', gap: 0.6, flexWrap: 'wrap', mt: 0.8 }}>
                                            {sugerenciasEfectivo(totalFinal).map(s => (
                                                <Chip
                                                    key={s.valor}
                                                    label={s.label}
                                                    size="small"
                                                    onClick={() => setValorRecibido(s.valor)}
                                                    sx={{
                                                        fontWeight: 700, fontSize: 11, cursor: 'pointer',
                                                        bgcolor: valorRecibido === s.valor ? '#10B981' : alpha('#10B981', 0.08),
                                                        color: valorRecibido === s.valor ? '#fff' : '#059669',
                                                        border: '1px solid', borderColor: alpha('#10B981', 0.35),
                                                        '&:hover': { bgcolor: valorRecibido === s.valor ? '#059669' : alpha('#10B981', 0.16) },
                                                    }}
                                                />
                                            ))}
                                        </Box>
                                    )}
                                    {valorRecibido > 0 && (
                                        <Box sx={{
                                            mt: 0.8, px: 2, py: 0.6, borderRadius: 2, textAlign: 'center',
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

                            {/* ── Total + Botón (total arriba). Sin mt:'auto': ya no se ancla
                                al fondo del panel dejando un vacío cuando no hay contenido
                                intermedio (ej. método de pago distinto a Efectivo); ahora sube
                                dinámicamente para quedar justo debajo del contenido anterior. ── */}
                            <Box sx={{ mt: 2.5, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
                                <Box sx={{ textAlign: 'center', mb: 1.5 }}>
                                    <Typography sx={{ fontSize: 12, fontWeight: 700, color: 'text.secondary', letterSpacing: 1.5, textTransform: 'uppercase' }}>
                                        Total a cobrar
                                    </Typography>
                                    {descuentoPuntosImporte > 0
                                        ? <>
                                            <Typography sx={{ fontSize: 16, fontWeight: 900, color: 'text.disabled', lineHeight: 1, textDecoration: 'line-through' }}>
                                                {formatCurrency(totalConIva)}
                                            </Typography>
                                            <Typography sx={{ fontSize: { xs: 36, md: 44 }, fontWeight: 900, color: '#10B981', lineHeight: 1 }}>
                                                {formatCurrency(totalFinal)}
                                            </Typography>
                                            <Chip icon={<Stars sx={{ fontSize: '14px !important' }} />} label={`-${formatCurrency(descuentoPuntosImporte)} pts`} size="small" sx={{ mt: 0.5, bgcolor: '#10B98115', color: '#10B981', fontWeight: 700, fontSize: 10 }} />
                                          </>
                                        : <Typography sx={{ fontSize: { xs: 36, md: 44 }, fontWeight: 900, color: ACCENT, lineHeight: 1 }}>
                                            {formatCurrency(totalFinal)}
                                          </Typography>
                                    }
                                </Box>
                                {editingVenta && (
                                    <Button onClick={resetForm} variant="outlined" fullWidth
                                        sx={{ borderRadius: 2, fontWeight: 600, borderColor: 'divider', mb: 1 }}>
                                        Cancelar edición
                                    </Button>
                                )}
                                {!editingVenta && (
                                    <Tooltip title="Guarda el carrito actual para atender a otro cliente y retomarlo después (Ctrl+G)">
                                        <span>
                                            <Button
                                                onClick={handleGuardarBorrador}
                                                variant="outlined" fullWidth
                                                disabled={guardandoBorrador}
                                                startIcon={guardandoBorrador ? <CircularProgress size={14} /> : <Notes />}
                                                sx={{ borderRadius: 2, fontWeight: 600, borderColor: '#F59E0B', color: '#B45309', mb: 1 }}
                                            >
                                                Guardar como borrador
                                            </Button>
                                        </span>
                                    </Tooltip>
                                )}
                                {borradores.length > 0 && (
                                    <Button
                                        onClick={() => setBorradoresOpen(true)}
                                        variant="contained" fullWidth disableElevation
                                        startIcon={<Badge badgeContent={borradores.length} color="error"><Notes /></Badge>}
                                        sx={{ borderRadius: 2, fontWeight: 700, mb: 1, bgcolor: '#F59E0B', color: '#fff', '&:hover': { bgcolor: '#D97706' } }}
                                    >
                                        Retomar venta guardada
                                    </Button>
                                )}
                                <Typography sx={{ fontSize: 11, color: 'text.disabled', textAlign: 'center', mb: 0.4 }}>
                                    Ctrl + Enter · Ctrl + G borrador
                                </Typography>
                                <LiquidButton
                                    id="btn-registrar-venta"
                                    type="submit" fullWidth
                                    disabled={savingVenta} loading={savingVenta}
                                    onClick={handleSubmit}
                                    startIcon={!savingVenta && (selectedLinkPago ? <CreditCard /> : <ShoppingCart />)}
                                >
                                    {savingVenta ? 'Guardando…' : (editingVenta ? 'Actualizar' : (selectedLinkPago ? 'Cobrar con Link' : 'Registrar Venta'))}
                                </LiquidButton>
                            </Box>
                          </Box>{/* end RIGHT PANEL */}

                          {/* ── Barra fija de cobro (solo móvil): total + registrar siempre
                              visibles sin scrollear hasta el fondo del formulario. ── */}
                          {isMobile && saleDetails.filter(d => d.producto || d.isLibre).length > 0 && (
                            <>
                              <Box sx={{ height: 76 }} />{/* espacio para que la barra no tape contenido */}
                              <Box sx={{
                                  position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 1100,
                                  px: 1.5, pt: 1, pb: 'calc(10px + env(safe-area-inset-bottom))',
                                  bgcolor: 'background.paper',
                                  borderTop: '1px solid', borderColor: 'divider',
                                  boxShadow: '0 -6px 24px rgba(0,0,0,0.12)',
                                  display: 'flex', alignItems: 'center', gap: 1.5,
                              }}>
                                  <Box sx={{ minWidth: 0, flex: 1 }} onClick={() => document.getElementById('btn-registrar-venta')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}>
                                      <Typography sx={{ fontSize: 10, color: 'text.secondary', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6 }}>
                                          {saleDetails.filter(d => d.producto || d.isLibre).length} ítem(s) · Total
                                      </Typography>
                                      <Typography sx={{ fontSize: 20, fontWeight: 900, color: ACCENT, lineHeight: 1.1 }} noWrap>
                                          {formatCurrency(totalFinal)}
                                      </Typography>
                                  </Box>
                                  <Button
                                      variant="contained"
                                      disabled={savingVenta}
                                      onClick={handleSubmit}
                                      startIcon={savingVenta ? <CircularProgress size={16} color="inherit" /> : <ShoppingCart />}
                                      sx={{
                                          borderRadius: 2.5, fontWeight: 800, textTransform: 'none', px: 2.5, py: 1.2,
                                          bgcolor: ACCENT, '&:hover': { bgcolor: '#0e7490' },
                                          boxShadow: `0 6px 18px ${alpha(ACCENT, 0.35)}`, flexShrink: 0,
                                      }}
                                  >
                                      {savingVenta ? 'Guardando…' : (editingVenta ? 'Actualizar' : 'Cobrar')}
                                  </Button>
                              </Box>
                            </>
                          )}
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
                                onGuardarBorrador={handleGuardarBorrador}
                                guardandoBorrador={guardandoBorrador}
                                borradoresCount={borradores.length}
                                onVerBorradores={() => setBorradoresOpen(true)}
                                calculateSubtotal={calculateSubtotal}
                                cambioEfectivo={cambioEfectivo}
                                openQuickCreate={openQuickCreate}
                                isDark={isDark}
                                omitirInventario={omitirInventario}
                                setOmitirInventario={setOmitirInventario}
                                linkPagosConfig={linkPagosConfig}
                                metodosPagoConLinks={metodosPagoConLinks}
                                fidelizacionActiva={configFidelizacion.activa}
                                clientePuntos={clientePuntos}
                                puntosACanjear={puntosACanjear}
                                setPuntosACanjear={setPuntosACanjear}
                                redeemRate={configFidelizacion.redeem_rate || PUNTOS_REDEEM_RATE_DEFAULT}
                                solicitaFe={solicitaFe}
                                setSolicitaFe={handleToggleFe}
                                feActiva={!!user?.empresa?.facturacion_electronica_activa}
                            />
                        </Box>
                    )}

                        </TabPanel>
                {/* ════════════════════════════════════════
                    TAB 1 — HISTORIAL
                ════════════════════════════════════════ */}
                {isAdmin && <TabPanel value={tabValue} index={1}>
                    <Box sx={{ px: { xs: 2, md: 3 }, pb: 3 }}>

                        {/* ── Buscador principal ── */}
                        <TextField
                            fullWidth size="small" sx={{ mb: 1.5 }}
                            placeholder="Buscar por cliente, producto, N° venta, N° factura…"
                            value={searchTerm}
                            onChange={(e) => { const v = e.target.value; setSearchTerm(v); setPage(0); fetchVentas(0, rowsPerPage, v, fechaInicio, fechaFin, estadoPagoFiltro); }}
                            InputProps={{ startAdornment: <InputAdornment position="start"><Search sx={{ color: 'text.secondary', fontSize: 18 }} /></InputAdornment>,
                                endAdornment: searchTerm ? <InputAdornment position="end"><IconButton size="small" onClick={() => { setSearchTerm(''); setPage(0); fetchVentas(0, rowsPerPage, '', fechaInicio, fechaFin, estadoPagoFiltro); }}><Close fontSize="small" /></IconButton></InputAdornment> : null,
                            }}
                        />

                        {/* ── Filtros de fecha + estado ── */}
                        <Box sx={{ display: 'flex', gap: 1, mb: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
                            {/* Atajos de fecha */}
                            {[
                                { label: 'Hoy', fn: () => { const d = new Date().toISOString().slice(0,10); setFechaInicio(d); setFechaFin(d); setPage(0); fetchVentas(0, rowsPerPage, searchTerm, d, d, estadoPagoFiltro); } },
                                { label: 'Esta semana', fn: () => { const now = new Date(); const mon = new Date(now); mon.setDate(now.getDate() - now.getDay() + 1); const fi = mon.toISOString().slice(0,10); const ff = now.toISOString().slice(0,10); setFechaInicio(fi); setFechaFin(ff); setPage(0); fetchVentas(0, rowsPerPage, searchTerm, fi, ff, estadoPagoFiltro); } },
                                { label: 'Este mes', fn: () => { const now = new Date(); const fi = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`; const ff = now.toISOString().slice(0,10); setFechaInicio(fi); setFechaFin(ff); setPage(0); fetchVentas(0, rowsPerPage, searchTerm, fi, ff, estadoPagoFiltro); } },
                            ].map(s => (
                                <Chip key={s.label} label={s.label} size="small" onClick={s.fn}
                                    sx={{ fontSize: 11, fontWeight: 600, cursor: 'pointer', bgcolor: 'action.hover', borderRadius: 1.5 }} />
                            ))}
                            <TextField size="small" type="date" label="Desde" value={fechaInicio}
                                onChange={(e) => { const v = e.target.value; setFechaInicio(v); setPage(0); fetchVentas(0, rowsPerPage, searchTerm, v, fechaFin, estadoPagoFiltro); }}
                                InputLabelProps={{ shrink: true }} sx={{ width: 145, input: { colorScheme: isDark ? 'dark' : 'light' } }} />
                            <TextField size="small" type="date" label="Hasta" value={fechaFin}
                                onChange={(e) => { const v = e.target.value; setFechaFin(v); setPage(0); fetchVentas(0, rowsPerPage, searchTerm, fechaInicio, v, estadoPagoFiltro); }}
                                InputLabelProps={{ shrink: true }} sx={{ width: 145, input: { colorScheme: isDark ? 'dark' : 'light' } }} />
                            {(fechaInicio || fechaFin || searchTerm || estadoPagoFiltro) && (
                                <Button size="small" variant="text" onClick={() => { setFechaInicio(''); setFechaFin(''); setSearchTerm(''); setEstadoPagoFiltro(''); setPage(0); fetchVentas(0, rowsPerPage, '', '', '', ''); }}
                                    sx={{ color: 'text.secondary', fontSize: 11, whiteSpace: 'nowrap', ml: 'auto' }}>
                                    Limpiar todo
                                </Button>
                            )}
                        </Box>

                        {/* ── Chips de estado ── */}
                        <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
                            {[
                                { value: '',          label: `Todas (${ventasTotal})` },
                                { value: 'pagado',    label: 'Pagadas', color: '#16a34a' },
                                { value: 'pendiente', label: 'Pendientes', color: '#EF4444' },
                                { value: 'credito',   label: 'Crédito', color: '#F59E0B' },
                            ].map(f => (
                                <Chip key={f.value} label={f.label} size="small"
                                    onClick={() => { setEstadoPagoFiltro(f.value); setPage(0); fetchVentas(0, rowsPerPage, searchTerm, fechaInicio, fechaFin, f.value); }}
                                    sx={{
                                        fontSize: 11, fontWeight: 600, cursor: 'pointer', borderRadius: 1.5,
                                        ...(estadoPagoFiltro === f.value
                                            ? { bgcolor: f.color || ACCENT, color: '#fff' }
                                            : { bgcolor: 'action.hover', color: 'text.secondary' }),
                                    }}
                                />
                            ))}
                        </Box>

                        {/* ── Barra de resumen financiero ── */}
                        <Box sx={{
                            display: 'flex', gap: 2, mb: 2, px: 2, py: 1.5, borderRadius: 2,
                            bgcolor: 'action.hover', flexWrap: 'wrap', alignItems: 'center',
                        }}>
                            <Typography sx={{ fontSize: 12, color: 'text.secondary', fontWeight: 600 }}>
                                {ventasTotal} venta{ventasTotal !== 1 ? 's' : ''}
                            </Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>Total:</Typography>
                                <Typography sx={{ fontSize: 13, fontWeight: 800, color: 'text.primary' }}>{formatCurrency(ventasStats.sum_total)}</Typography>
                            </Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>Cobrado:</Typography>
                                <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#16a34a' }}>{formatCurrency(ventasStats.sum_pagado)}</Typography>
                            </Box>
                            {ventasStats.sum_pendiente > 0 && (
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                    <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>Pendiente:</Typography>
                                    <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#EF4444' }}>{formatCurrency(ventasStats.sum_pendiente)}</Typography>
                                </Box>
                            )}
                        </Box>

                        {/* ── Cards (mobile) / Tabla (desktop) ── */}
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
                                            handleReintentarFE={handleReintentarFE}
                                        />
                                    ))
                                }
                            </Box>
                        ) : (
                            <TableContainer sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                                <Table size="small">
                                    <TableHead>
                                        <TableRow sx={{ bgcolor: 'action.hover' }}>
                                            <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, width: 90 }}>Venta</TableCell>
                                            <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, width: 120, display: { xs: 'none', lg: 'table-cell' } }}>Fact. Electrónica</TableCell>
                                            <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>Cliente</TableCell>
                                            <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>Productos</TableCell>
                                            <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }} align="right">Total</TableCell>
                                            <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>Estado</TableCell>
                                            <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, display: { xs: 'none', md: 'table-cell' } }}>Fecha</TableCell>
                                            <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>Acciones</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {paginatedVentas.length === 0
                                            ? <TableRow><TableCell colSpan={8} sx={{ textAlign: 'center', py: 6, color: 'text.secondary' }}>No se encontraron ventas</TableCell></TableRow>
                                            : paginatedVentas.map(v => {
                                                const saldo = (v.total || 0) - (v.monto_pagado || 0);
                                                const productosSummary = v.detalles?.length > 0
                                                    ? v.detalles.length === 1
                                                        ? `${v.detalles[0].producto?.nombre || v.detalles[0].nombre_libre || 'Ítem'} ×${v.detalles[0].cantidad}`
                                                        : `${v.detalles[0].producto?.nombre || v.detalles[0].nombre_libre || 'Ítem'} ×${v.detalles[0].cantidad} + ${v.detalles.length - 1} más`
                                                    : '—';
                                                const productosTooltip = v.detalles?.map(d => `${d.producto?.nombre || d.nombre_libre || 'Ítem'} ×${d.cantidad}`).join('\n');
                                                const fechaVenta = new Date(v.fecha + (v.fecha?.endsWith('Z') ? '' : 'Z'));
                                                const fechaStr = fechaVenta.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
                                                const horaStr  = fechaVenta.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
                                                return (
                                                <TableRow key={v.id} hover sx={{ '&:hover': { bgcolor: 'action.hover' } }}>
                                                    {/* Columna: ID de Venta */}
                                                    <TableCell>
                                                        <Typography sx={{
                                                            fontSize: 12, fontWeight: 800, fontFamily: 'monospace',
                                                            bgcolor: `${ACCENT}14`, color: ACCENT,
                                                            px: 0.8, py: 0.2, borderRadius: 1, display: 'inline-block',
                                                        }}>
                                                            V{String(v.numero_venta ?? v.id).padStart(4, '0')}
                                                        </Typography>
                                                    </TableCell>
                                                    {/* Columna: Factura Electrónica */}
                                                    <TableCell sx={{ display: { xs: 'none', lg: 'table-cell' } }}>
                                                        {v.numero_factura ? (
                                                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.3 }}>
                                                                <Typography sx={{ fontSize: 12, fontFamily: 'monospace', fontWeight: 700, color: 'text.primary' }}>
                                                                    {v.numero_factura}
                                                                </Typography>
                                                                <ChipFE estado={v.estado_electronico} ventaId={v.id} onReintentar={handleReintentarFE} />
                                                            </Box>
                                                        ) : (
                                                            <ChipFE estado={v.estado_electronico} ventaId={v.id} onReintentar={handleReintentarFE} />
                                                        )}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Typography sx={{ fontWeight: 600, fontSize: 13 }}>{v.cliente?.nombre || <Typography component="span" sx={{ color: 'text.disabled', fontStyle: 'italic', fontSize: 12 }}>Consumidor final</Typography>}</Typography>
                                                        {v.cliente?.celular && <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>{v.cliente.celular}</Typography>}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Tooltip title={<Box sx={{ whiteSpace: 'pre-line', fontSize: 12 }}>{productosTooltip}</Box>} arrow>
                                                            <Typography sx={{ fontSize: 12, color: 'text.secondary', cursor: v.detalles?.length > 1 ? 'help' : 'default', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                                {productosSummary}
                                                            </Typography>
                                                        </Tooltip>
                                                    </TableCell>
                                                    <TableCell align="right">
                                                        <Typography sx={{ fontWeight: 800, fontSize: 13 }}>{formatCurrency(v.total)}</Typography>
                                                        {saldo > 0 && (
                                                            <Typography sx={{ fontSize: 10, color: '#EF4444', fontWeight: 600 }}>
                                                                Saldo: {formatCurrency(saldo)}
                                                            </Typography>
                                                        )}
                                                    </TableCell>
                                                    <TableCell>{getEstadoPagoChip(v.estado_pago)}</TableCell>
                                                    <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>
                                                        <Typography sx={{ fontSize: 12, fontWeight: 600 }}>{fechaStr}</Typography>
                                                        <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>{horaStr}</Typography>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Box sx={{ display: 'flex', gap: 0.3 }}>
                                                            <Tooltip title="Ver comprobante"><IconButton size="small" onClick={() => handleOpenDetails(v)} sx={{ color: '#3B82F6', '&:hover': { bgcolor: '#EFF6FF' } }}><Visibility fontSize="small" /></IconButton></Tooltip>
                                                            {v.pdf_url && (
                                                                <Tooltip title="Descargar PDF factura electrónica">
                                                                    <IconButton size="small" component="a" href={v.pdf_url} target="_blank" rel="noopener noreferrer" sx={{ color: '#EF4444', '&:hover': { bgcolor: '#FEF2F2' } }}>
                                                                        <PictureAsPdf fontSize="small" />
                                                                    </IconButton>
                                                                </Tooltip>
                                                            )}
                                                            {v.detalles?.length > 0 && (
                                                                <Tooltip title="Registrar devolución"><IconButton size="small" onClick={() => handleOpenDevolucion(v)} sx={{ color: '#F59E0B', '&:hover': { bgcolor: '#FFFBEB' } }}><AssignmentReturn fontSize="small" /></IconButton></Tooltip>
                                                            )}
                                                            <Tooltip title="Editar venta"><IconButton size="small" onClick={() => handleEdit(v)} sx={{ color: ACCENT, '&:hover': { bgcolor: '#FFF0E9' } }}><Edit fontSize="small" /></IconButton></Tooltip>
                                                            <Tooltip title="Eliminar"><IconButton size="small" onClick={() => handleDelete(v.id)} sx={{ color: '#EF4444', '&:hover': { bgcolor: '#FEF2F2' } }}><Delete fontSize="small" /></IconButton></Tooltip>
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
                            rowsPerPageOptions={[10, 25, 50]} component="div"
                            count={ventasTotal} rowsPerPage={rowsPerPage} page={page}
                            onPageChange={(_, p) => { setPage(p); fetchVentas(p, rowsPerPage); }}
                            onRowsPerPageChange={(e) => { const rpp = parseInt(e.target.value, 10); setRowsPerPage(rpp); setPage(0); fetchVentas(0, rpp); }}
                            labelRowsPerPage="Filas:" labelDisplayedRows={({ from, to, count }) => `${from}–${to} de ${count}`}
                        />
                    </Box>
                </TabPanel>}
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
                defaultTipo="cliente"
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
            <BasculaConfigDialog
                open={basculaConfigOpen}
                config={basculaConfig}
                onGuardar={guardarBasculaConfig}
                onClose={() => setBasculaConfigOpen(false)}
            />
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
                linkConfig={selectedLinkPago}
                clienteTelefono={cliente?.telefono || ''}
            />

            {/* ── Borradores de venta ── */}
            <Dialog open={borradoresOpen} onClose={() => setBorradoresOpen(false)} maxWidth="xs" fullWidth
                PaperProps={{ sx: { borderRadius: 3 } }}>
                <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, fontWeight: 800, fontSize: 16 }}>
                    <Notes sx={{ color: '#F59E0B' }} /> Ventas en borrador
                </DialogTitle>
                <DialogContent dividers sx={{ p: 0 }}>
                    {borradores.length === 0 ? (
                        <Typography sx={{ p: 3, textAlign: 'center', color: 'text.secondary', fontSize: 13 }}>
                            No hay borradores guardados.
                        </Typography>
                    ) : (
                        <List disablePadding>
                            {borradores.map(b => (
                                <ListItem
                                    key={b.id}
                                    divider
                                    secondaryAction={
                                        <Box sx={{ display: 'flex', gap: 0.5 }}>
                                            <Tooltip title="Retomar esta venta">
                                                <span>
                                                    <IconButton
                                                        edge="end" color="primary"
                                                        disabled={retomandoBorradorId === b.id}
                                                        onClick={() => handleRetomarBorrador(b.id)}
                                                    >
                                                        {retomandoBorradorId === b.id
                                                            ? <CircularProgress size={18} />
                                                            : <PlayCircleOutline />}
                                                    </IconButton>
                                                </span>
                                            </Tooltip>
                                            <Tooltip title="Descartar borrador">
                                                <IconButton edge="end" color="error" onClick={() => handleDescartarBorrador(b.id)}>
                                                    <Delete fontSize="small" />
                                                </IconButton>
                                            </Tooltip>
                                        </Box>
                                    }
                                >
                                    <ListItemText
                                        primary={b.cliente_nombre || 'Sin cliente'}
                                        secondary={`${formatCurrency(b.total_aproximado || 0)} · ${new Date(b.created_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}`}
                                        primaryTypographyProps={{ fontWeight: 700, fontSize: 14 }}
                                        secondaryTypographyProps={{ fontSize: 12 }}
                                    />
                                </ListItem>
                            ))}
                        </List>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setBorradoresOpen(false)} sx={{ textTransform: 'none' }}>Cerrar</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default Ventas;