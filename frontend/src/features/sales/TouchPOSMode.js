import React, { useState, useMemo } from 'react';
import {
    Box, Paper, Typography, IconButton, Button, TextField, InputAdornment,
    Chip, Divider, Autocomplete, useMediaQuery, useTheme,
    Dialog, DialogContent, Fab, Grid, Collapse, CircularProgress, Tooltip,
} from '@mui/material';
import {
    Search, ShoppingCart, PersonOutline, AddCircle, RemoveCircle, Delete,
    ExpandMore, Add, CloseRounded, Inventory2,
} from '@mui/icons-material';
import { formatCurrency } from '../../utils/formatters';
import CurrencyField from '../../components/common/CurrencyField';

const ACCENT = '#FF6020';
const METODOS_PAGO = [
    { value: 'Efectivo',      label: '💵 Efectivo',      pagada: true,  color: '#10B981' },
    { value: 'Transferencia', label: '🏦 Transferencia',  pagada: true,  color: '#3B82F6' },
    { value: 'Nequi',         label: '💜 Nequi',          pagada: true,  color: '#7C3AED' },
    { value: 'Daviplata',     label: '🔵 Daviplata',      pagada: true,  color: '#2563EB' },
    { value: 'Tarjeta',       label: '💳 Tarjeta',        pagada: true,  color: '#8B5CF6' },
    { value: 'Cheque',        label: '📄 Cheque',         pagada: true,  color: '#6B7280' },
    { value: 'Por Cobrar',    label: '🕒 Por Cobrar',     pagada: false, color: '#EF4444' },
];

// ─── Product Card ─────────────────────────────────────────────────────────────
const ProductCard = ({ producto, qtyInCart, onPress, groupColor }) => {
    const [pressed, setPressed] = useState(false);
    const imgSrc = Array.isArray(producto.imagenes) && producto.imagenes.length > 0
        ? producto.imagenes[0] : null;
    const color = groupColor || '#9CA3AF';
    const stockLow = !producto.es_servicio
        && producto.stock_actual !== null
        && producto.stock_actual <= (producto.stock_minimo || 0);

    return (
        <Box
            onPointerDown={() => setPressed(true)}
            onPointerUp={() => { setPressed(false); onPress(); }}
            onPointerLeave={() => setPressed(false)}
            onPointerCancel={() => setPressed(false)}
            sx={{
                position: 'relative', borderRadius: 2.5, overflow: 'hidden',
                cursor: 'pointer', bgcolor: 'background.paper',
                border: `1.5px solid ${qtyInCart > 0 ? ACCENT : 'transparent'}`,
                boxShadow: qtyInCart > 0
                    ? `0 0 0 2px ${ACCENT}22, 0 3px 10px rgba(0,0,0,0.1)`
                    : '0 1px 5px rgba(0,0,0,0.07)',
                transform: pressed ? 'scale(0.92)' : 'scale(1)',
                transition: 'transform 0.08s ease, box-shadow 0.15s',
                userSelect: 'none', WebkitUserSelect: 'none',
                touchAction: 'manipulation',
                '&:active': { transform: 'scale(0.92)' },
            }}
        >
            {/* Quantity badge */}
            {qtyInCart > 0 && (
                <Box sx={{
                    position: 'absolute', top: 5, right: 5, zIndex: 3,
                    minWidth: 20, height: 20, borderRadius: 10,
                    px: 0.5, bgcolor: ACCENT, color: 'white',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, fontWeight: 900,
                    boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
                }}>
                    {qtyInCart}
                </Box>
            )}

            {/* Image / letter avatar */}
            <Box sx={{
                height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center',
                bgcolor: imgSrc ? '#000' : `${color}1A`, overflow: 'hidden',
                position: 'relative',
            }}>
                {imgSrc ? (
                    <img
                        src={imgSrc} alt={producto.nombre}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    />
                ) : (
                    <Typography sx={{
                        fontSize: 36, fontWeight: 800, color, opacity: 0.55, lineHeight: 1,
                        userSelect: 'none',
                    }}>
                        {(producto.nombre || '?')[0].toUpperCase()}
                    </Typography>
                )}

                {/* Low stock overlay */}
                {stockLow && (
                    <Box sx={{
                        position: 'absolute', bottom: 0, left: 0, right: 0,
                        bgcolor: 'rgba(245,158,11,0.88)', py: 0.25, textAlign: 'center',
                    }}>
                        <Typography sx={{ fontSize: 9, color: '#fff', fontWeight: 700 }}>
                            ⚠ Stock: {producto.stock_actual}
                        </Typography>
                    </Box>
                )}
            </Box>

            {/* Info */}
            <Box sx={{ p: 0.9, pt: 0.7 }}>
                <Typography sx={{
                    fontSize: 11, fontWeight: 600, lineHeight: 1.25,
                    overflow: 'hidden', display: '-webkit-box',
                    WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                    color: 'text.primary', mb: 0.25,
                }}>
                    {producto.nombre}
                </Typography>
                <Typography sx={{ fontSize: 12, fontWeight: 800, color: ACCENT }}>
                    {formatCurrency(producto.precio)}
                </Typography>
            </Box>
        </Box>
    );
};

// ─── Cart Item Row ─────────────────────────────────────────────────────────────
const CartItemRow = ({ detail, onAddOne, onRemoveOne, onRemoveAll }) => {
    const subtotal = detail.cantidad * detail.precioUnitario
        * (1 - (detail.descuentoPct || 0) / 100);
    return (
        <Box sx={{
            display: 'flex', alignItems: 'center', gap: 0.5,
            py: 0.9, px: 0.5,
            borderBottom: '1px solid', borderColor: 'divider',
        }}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{
                    fontSize: 12, fontWeight: 600,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                    {detail.producto?.nombre}
                </Typography>
                <Typography sx={{ fontSize: 10.5, color: 'text.secondary' }}>
                    {formatCurrency(detail.precioUnitario)} c/u
                    {(detail.descuentoPct || 0) > 0 && (
                        <span style={{ color: '#10B981', marginLeft: 4 }}>
                            -{detail.descuentoPct}%
                        </span>
                    )}
                </Typography>
            </Box>

            {/* Qty stepper */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.2, flexShrink: 0 }}>
                <IconButton
                    size="small"
                    onClick={() => onRemoveOne(detail.producto?.id)}
                    sx={{ color: '#EF4444', p: 0.3 }}
                >
                    <RemoveCircle sx={{ fontSize: 18 }} />
                </IconButton>
                <Typography sx={{
                    minWidth: 22, textAlign: 'center',
                    fontWeight: 700, fontSize: 13,
                }}>
                    {detail.cantidad}
                </Typography>
                <IconButton
                    size="small"
                    onClick={() => onAddOne(detail.producto)}
                    sx={{ color: '#10B981', p: 0.3 }}
                >
                    <AddCircle sx={{ fontSize: 18 }} />
                </IconButton>
            </Box>

            {/* Subtotal */}
            <Typography sx={{
                minWidth: 62, textAlign: 'right',
                fontWeight: 700, fontSize: 12.5, color: ACCENT, flexShrink: 0,
            }}>
                {formatCurrency(subtotal)}
            </Typography>

            {/* Remove */}
            <IconButton
                size="small"
                onClick={() => onRemoveAll(detail.producto?.id)}
                sx={{ color: 'text.disabled', p: 0.3, '&:hover': { color: '#EF4444' } }}
            >
                <Delete sx={{ fontSize: 15 }} />
            </IconButton>
        </Box>
    );
};

// ─── Cart Panel ───────────────────────────────────────────────────────────────
const CartPanel = ({
    saleDetails, onAddOne, onRemoveOne, onRemoveAll,
    cliente, setCliente, clientes, isMostrador, onSetMostrador,
    clienteInput, setClienteInput,
    pagada, setPagada, metodoPago, setMetodoPago,
    valorRecibido, setValorRecibido,
    ivaPorcentajeGlobal, setIvaPorcentajeGlobal,
    onSubmit, savingVenta, calculateSubtotal, cambioEfectivo,
    openQuickCreate, isDark, onClose,
}) => {
    const validItems = saleDetails.filter(d => d.producto && d.cantidad > 0);
    const total = calculateSubtotal();

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

            {/* Header */}
            <Box sx={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                px: 2, py: 1.5, borderBottom: '1px solid', borderColor: 'divider', flexShrink: 0,
            }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <ShoppingCart sx={{ fontSize: 18, color: ACCENT }} />
                    <Typography sx={{ fontWeight: 700, fontSize: 14 }}>
                        Carrito
                        {validItems.length > 0 && (
                            <Box component="span" sx={{
                                ml: 0.8, px: 0.8, py: 0.2, borderRadius: 10,
                                bgcolor: ACCENT, color: 'white', fontSize: 10, fontWeight: 900,
                            }}>
                                {validItems.length}
                            </Box>
                        )}
                    </Typography>
                </Box>
                {onClose && (
                    <IconButton size="small" onClick={onClose}>
                        <CloseRounded sx={{ fontSize: 20 }} />
                    </IconButton>
                )}
            </Box>

            {/* Cliente */}
            <Box sx={{
                px: 1.5, py: 1.2,
                borderBottom: '1px solid', borderColor: 'divider', flexShrink: 0,
            }}>
                <Box sx={{ display: 'flex', gap: 0.8, alignItems: 'center' }}>
                    <Tooltip title="Venta a consumidor final anónimo">
                        <Button
                            size="small"
                            variant={isMostrador ? 'contained' : 'outlined'}
                            startIcon={<PersonOutline sx={{ fontSize: 13 }} />}
                            onClick={onSetMostrador}
                            sx={{
                                borderRadius: 1.5, fontWeight: 600, fontSize: 11,
                                py: 0.5, px: 1, borderColor: '#64748B', whiteSpace: 'nowrap', flexShrink: 0,
                                ...(isMostrador
                                    ? { bgcolor: '#64748B', color: 'white', '&:hover': { bgcolor: '#475569' } }
                                    : { color: '#64748B', '&:hover': { bgcolor: '#F1F5F9' } }
                                ),
                            }}
                        >
                            Mostrador
                        </Button>
                    </Tooltip>
                    <Autocomplete
                        sx={{ flex: 1, minWidth: 0 }}
                        size="small"
                        options={clientes}
                        getOptionLabel={(o) => o?.nombre || ''}
                        value={cliente}
                        onChange={(_, v) => { setCliente(v); }}
                        inputValue={clienteInput}
                        onInputChange={(_, v) => setClienteInput(v)}
                        filterOptions={(opts, state) => {
                            const q = (state.inputValue || '').toLowerCase().trim();
                            if (!q) return opts.slice(0, 30);
                            return opts.filter(o =>
                                o.nombre.toLowerCase().includes(q) ||
                                (o.cedula || '').includes(q) ||
                                (o.telefono || '').includes(q)
                            );
                        }}
                        noOptionsText={
                            <Box sx={{ py: 0.5 }}>
                                <Button
                                    size="small" variant="contained" fullWidth
                                    startIcon={<Add sx={{ fontSize: 13 }} />}
                                    onClick={() => openQuickCreate('tercero', clienteInput)}
                                    sx={{ borderRadius: 1.5, fontWeight: 600, fontSize: 11, bgcolor: '#3B82F6', '&:hover': { bgcolor: '#2563EB' } }}
                                >
                                    Crear cliente
                                </Button>
                            </Box>
                        }
                        renderOption={(props, option) => (
                            <li {...props} key={option.id} style={{ padding: '6px 10px' }}>
                                <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{option.nombre}</Typography>
                                {option.cedula && (
                                    <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>
                                        {option.cedula}
                                    </Typography>
                                )}
                            </li>
                        )}
                        renderInput={(params) => (
                            <TextField {...params} placeholder="Buscar cliente…" />
                        )}
                    />
                </Box>
            </Box>

            {/* Cart items list */}
            <Box sx={{ flex: 1, overflowY: 'auto', px: 0.5 }}>
                {validItems.length === 0 ? (
                    <Box sx={{ textAlign: 'center', py: 5, color: 'text.secondary' }}>
                        <ShoppingCart sx={{ fontSize: 40, opacity: 0.18, mb: 0.8 }} />
                        <Typography sx={{ fontSize: 13, fontWeight: 500 }}>Carrito vacío</Typography>
                        <Typography sx={{ fontSize: 11, color: 'text.disabled', mt: 0.3 }}>
                            Toca un producto para añadirlo
                        </Typography>
                    </Box>
                ) : (
                    validItems.map(detail => (
                        <CartItemRow
                            key={detail.id}
                            detail={detail}
                            onAddOne={onAddOne}
                            onRemoveOne={onRemoveOne}
                            onRemoveAll={onRemoveAll}
                        />
                    ))
                )}
            </Box>

            {/* Footer: total + payment + submit */}
            <Box sx={{
                borderTop: '1.5px solid', borderColor: 'divider',
                flexShrink: 0, px: 1.5, pt: 1, pb: 1.5,
                bgcolor: isDark ? 'background.paper' : '#FFFBF9',
            }}>
                {/* IVA toggle */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6, mb: 1, flexWrap: 'wrap' }}>
                    <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>IVA:</Typography>
                    {[0, 19].map(pct => (
                        <Chip
                            key={pct}
                            label={pct === 0 ? 'Exento' : `${pct}%`}
                            size="small"
                            onClick={() => setIvaPorcentajeGlobal(pct)}
                            sx={{
                                fontSize: 10, fontWeight: 700, cursor: 'pointer', height: 22,
                                ...(ivaPorcentajeGlobal === pct
                                    ? { bgcolor: ACCENT, color: 'white', '& .MuiChip-label': { color: 'white' } }
                                    : { bgcolor: 'transparent', border: '1px solid', borderColor: 'divider' }
                                ),
                            }}
                        />
                    ))}
                </Box>

                {/* Total */}
                <Box sx={{ textAlign: 'center', mb: 1 }}>
                    <Typography sx={{
                        fontSize: 9, color: 'text.secondary',
                        letterSpacing: 1.5, textTransform: 'uppercase',
                    }}>
                        Total a cobrar
                    </Typography>
                    <Typography sx={{ fontSize: 34, fontWeight: 900, color: ACCENT, lineHeight: 1.1 }}>
                        {formatCurrency(total)}
                    </Typography>
                </Box>

                {/* Payment methods */}
                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 1, justifyContent: 'center' }}>
                    {METODOS_PAGO.map(opt => {
                        const isSelected = pagada
                            ? (opt.pagada && metodoPago === opt.value)
                            : !opt.pagada;
                        return (
                            <Box
                                key={opt.value}
                                onClick={() => { setPagada(opt.pagada); if (opt.pagada) setMetodoPago(opt.value); }}
                                sx={{
                                    px: 0.9, py: 0.5, borderRadius: 1.5, cursor: 'pointer',
                                    border: '1px solid',
                                    borderColor: isSelected ? opt.color : 'divider',
                                    bgcolor: isSelected ? `${opt.color}15` : 'background.paper',
                                    color: isSelected ? opt.color : 'text.secondary',
                                    fontSize: 11, fontWeight: isSelected ? 700 : 500,
                                    transition: 'all 0.12s', userSelect: 'none',
                                    '&:hover': { borderColor: opt.color },
                                    whiteSpace: 'nowrap',
                                }}
                            >
                                {opt.label}
                            </Box>
                        );
                    })}
                </Box>

                {/* Efectivo: recibido + cambio */}
                {pagada && metodoPago === 'Efectivo' && (
                    <Box sx={{ mb: 1 }}>
                        <CurrencyField
                            label="Valor recibido" size="small" fullWidth
                            value={valorRecibido} onChange={setValorRecibido}
                        />
                        {valorRecibido > 0 && (
                            <Box sx={{
                                mt: 0.6, px: 1.5, py: 0.6, borderRadius: 1.5, textAlign: 'center',
                                bgcolor: cambioEfectivo >= 0 ? '#10B98112' : '#EF444412',
                                border: '1px solid',
                                borderColor: cambioEfectivo >= 0 ? '#10B98140' : '#EF444440',
                            }}>
                                <Typography sx={{ fontSize: 9, color: 'text.secondary' }}>
                                    Cambio a devolver
                                </Typography>
                                <Typography sx={{
                                    fontSize: 16, fontWeight: 800,
                                    color: cambioEfectivo >= 0 ? '#10B981' : '#EF4444',
                                }}>
                                    {formatCurrency(cambioEfectivo >= 0 ? cambioEfectivo : 0)}
                                </Typography>
                                {cambioEfectivo < 0 && (
                                    <Typography sx={{ fontSize: 9, color: '#EF4444' }}>
                                        Faltan {formatCurrency(Math.abs(cambioEfectivo))}
                                    </Typography>
                                )}
                            </Box>
                        )}
                    </Box>
                )}

                {/* Submit button */}
                <Button
                    fullWidth variant="contained"
                    disabled={savingVenta || validItems.length === 0 || !cliente}
                    onClick={onSubmit}
                    startIcon={savingVenta
                        ? <CircularProgress size={15} sx={{ color: 'white' }} />
                        : <ShoppingCart sx={{ fontSize: 18 }} />
                    }
                    sx={{
                        background: `linear-gradient(135deg, ${ACCENT}, #ff9a62)`,
                        boxShadow: `0 4px 14px rgba(255,96,32,0.35)`,
                        borderRadius: 2.5, fontWeight: 700, py: 1.3, fontSize: 14,
                        '&:disabled': {
                            background: 'rgba(0,0,0,0.12)',
                            boxShadow: 'none',
                        },
                    }}
                >
                    {savingVenta ? 'Guardando…' : 'Registrar Venta'}
                </Button>

                {!cliente && validItems.length > 0 && (
                    <Typography sx={{ fontSize: 10, color: '#F59E0B', textAlign: 'center', mt: 0.6, fontWeight: 600 }}>
                        Selecciona un cliente para continuar
                    </Typography>
                )}
            </Box>
        </Box>
    );
};

// ─── Product Group Section ────────────────────────────────────────────────────
const GroupSection = ({ section, isExpanded, onToggle, saleDetails, onAddProduct }) => {
    const getQty = (productoId) => {
        const d = saleDetails.find(d => d.producto?.id === productoId);
        return d ? d.cantidad : 0;
    };

    return (
        <Box sx={{ mb: 1.5 }}>
            {/* Group header */}
            <Box
                onClick={onToggle}
                sx={{
                    display: 'flex', alignItems: 'center', gap: 1,
                    py: 0.9, px: 1.5, borderRadius: 2, cursor: 'pointer',
                    bgcolor: isExpanded
                        ? `${section.color}12`
                        : 'action.hover',
                    border: '1px solid',
                    borderColor: isExpanded ? `${section.color}30` : 'transparent',
                    transition: 'all 0.15s',
                    userSelect: 'none',
                    '&:hover': { bgcolor: `${section.color}18` },
                }}
            >
                <Box sx={{
                    width: 10, height: 10, borderRadius: '50%',
                    bgcolor: section.color, flexShrink: 0,
                    boxShadow: `0 0 4px ${section.color}60`,
                }} />
                <Typography sx={{ fontWeight: 700, fontSize: 13, flex: 1, color: 'text.primary' }}>
                    {section.nombre}
                </Typography>
                <Typography sx={{
                    fontSize: 11, color: 'text.secondary',
                    bgcolor: 'action.selected', px: 0.8, py: 0.1, borderRadius: 10,
                    fontWeight: 600,
                }}>
                    {section.prods.length}
                </Typography>
                <ExpandMore sx={{
                    fontSize: 18, color: 'text.secondary',
                    transform: isExpanded ? 'rotate(180deg)' : 'none',
                    transition: 'transform 0.2s',
                }} />
            </Box>

            {/* Products grid */}
            <Collapse in={isExpanded} timeout={180}>
                <Box sx={{ mt: 1, pl: 0.5 }}>
                    <Grid container spacing={1}>
                        {section.prods.map(p => (
                            <Grid item xs={6} sm={4} md={3} key={p.id}>
                                <ProductCard
                                    producto={p}
                                    qtyInCart={getQty(p.id)}
                                    onPress={() => onAddProduct(p)}
                                    groupColor={section.color}
                                />
                            </Grid>
                        ))}
                    </Grid>
                </Box>
            </Collapse>
        </Box>
    );
};

// ─── Main Component ───────────────────────────────────────────────────────────
const TouchPOSMode = ({
    grupos, productos, saleDetails,
    onAddProduct, onRemoveOne, onRemoveAll,
    cliente, setCliente, clientes, isMostrador, onSetMostrador,
    clienteInput, setClienteInput,
    pagada, setPagada, metodoPago, setMetodoPago,
    valorRecibido, setValorRecibido,
    ivaPorcentajeGlobal, setIvaPorcentajeGlobal,
    onSubmit, savingVenta, calculateSubtotal, cambioEfectivo,
    openQuickCreate, isDark,
}) => {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));

    const [search, setSearch] = useState('');
    const [cartOpen, setCartOpen] = useState(false);
    const [expandedGroups, setExpandedGroups] = useState({});

    const toggleGroup = (gid) =>
        setExpandedGroups(prev => ({ ...prev, [gid]: prev[gid] === false ? true : false }));
    const isExpanded = (gid) => expandedGroups[gid] !== false; // default open

    // Group products by category
    const { sections, allProducts } = useMemo(() => {
        const sortedGrupos = [...grupos].sort((a, b) => (a.orden || 0) - (b.orden || 0));
        const map = {};
        sortedGrupos.forEach(g => { map[g.id] = []; });
        const ungrouped = [];

        productos.forEach(p => {
            const gid = p.grupo_item;
            if (gid && map[gid] !== undefined) {
                map[gid].push(p);
            } else {
                ungrouped.push(p);
            }
        });

        const built = sortedGrupos
            .map(g => ({ id: g.id, nombre: g.nombre, color: g.color || '#9CA3AF', prods: map[g.id] }))
            .filter(s => s.prods.length > 0);

        if (ungrouped.length > 0) {
            built.push({ id: '_none', nombre: 'General', color: '#9CA3AF', prods: ungrouped });
        }

        return { sections: built, allProducts: productos };
    }, [grupos, productos]);

    // Search filter
    const searchResults = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return null;
        return allProducts.filter(p =>
            p.nombre.toLowerCase().includes(q) ||
            (p.descripcion || '').toLowerCase().includes(q) ||
            (p.codigo_barras || '').includes(search.trim())
        );
    }, [search, allProducts]);

    const cartCount = saleDetails
        .filter(d => d.producto)
        .reduce((s, d) => s + d.cantidad, 0);

    const getQtySearch = (productoId) => {
        const d = saleDetails.find(d => d.producto?.id === productoId);
        return d ? d.cantidad : 0;
    };

    const cartPanelProps = {
        saleDetails, onAddOne: onAddProduct, onRemoveOne, onRemoveAll,
        cliente, setCliente, clientes, isMostrador, onSetMostrador,
        clienteInput, setClienteInput,
        pagada, setPagada, metodoPago, setMetodoPago,
        valorRecibido, setValorRecibido,
        ivaPorcentajeGlobal, setIvaPorcentajeGlobal,
        onSubmit, savingVenta, calculateSubtotal, cambioEfectivo,
        openQuickCreate, isDark,
    };

    return (
        <Box sx={{
            display: 'flex', gap: 0,
            height: 'calc(100vh - 310px)',
            minHeight: 520,
        }}>
            {/* ══ Products Panel ══ */}
            <Box sx={{
                flex: 1, overflowY: 'auto', minWidth: 0,
                pr: isMobile ? 0 : 2,
                pb: isMobile ? 10 : 1,
            }}>
                {/* Sticky search bar */}
                <Box sx={{
                    position: 'sticky', top: 0, zIndex: 2,
                    pb: 1.5, bgcolor: 'background.default',
                }}>
                    <TextField
                        fullWidth size="small"
                        placeholder="Buscar producto por nombre, código o descripción…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <Search sx={{ color: 'text.secondary', fontSize: 18 }} />
                                </InputAdornment>
                            ),
                        }}
                        sx={{
                            '& .MuiOutlinedInput-root': { borderRadius: 2.5 },
                        }}
                    />
                </Box>

                {/* Content: search results or grouped sections */}
                {searchResults !== null ? (
                    <Box>
                        <Typography sx={{ fontSize: 11, color: 'text.secondary', mb: 1.5, fontWeight: 600 }}>
                            {searchResults.length} resultado(s) para "{search}"
                        </Typography>
                        {searchResults.length === 0 ? (
                            <Box sx={{ textAlign: 'center', py: 6, color: 'text.secondary' }}>
                                <Inventory2 sx={{ fontSize: 40, opacity: 0.2, mb: 1 }} />
                                <Typography sx={{ fontSize: 13 }}>Sin resultados</Typography>
                            </Box>
                        ) : (
                            <Grid container spacing={1}>
                                {searchResults.map(p => (
                                    <Grid item xs={6} sm={4} md={3} key={p.id}>
                                        <ProductCard
                                            producto={p}
                                            qtyInCart={getQtySearch(p.id)}
                                            onPress={() => onAddProduct(p)}
                                            groupColor="#9CA3AF"
                                        />
                                    </Grid>
                                ))}
                            </Grid>
                        )}
                    </Box>
                ) : sections.length === 0 ? (
                    <Box sx={{ textAlign: 'center', py: 8, color: 'text.secondary' }}>
                        <Inventory2 sx={{ fontSize: 48, opacity: 0.18, mb: 1 }} />
                        <Typography sx={{ fontSize: 14, fontWeight: 500 }}>
                            No hay productos disponibles
                        </Typography>
                        <Typography sx={{ fontSize: 12, color: 'text.disabled', mt: 0.5 }}>
                            Crea productos en el módulo de Inventario
                        </Typography>
                    </Box>
                ) : (
                    sections.map(section => (
                        <GroupSection
                            key={section.id}
                            section={section}
                            isExpanded={isExpanded(section.id)}
                            onToggle={() => toggleGroup(section.id)}
                            saleDetails={saleDetails}
                            onAddProduct={onAddProduct}
                        />
                    ))
                )}
            </Box>

            {/* ══ Cart Panel — desktop ══ */}
            {!isMobile && (
                <Paper elevation={0} sx={{
                    width: 306, flexShrink: 0,
                    border: '1.5px solid', borderColor: 'divider',
                    borderRadius: 3, overflow: 'hidden',
                    display: 'flex', flexDirection: 'column',
                }}>
                    <CartPanel {...cartPanelProps} />
                </Paper>
            )}

            {/* ══ FAB — mobile cart button ══ */}
            {isMobile && (
                <Fab
                    onClick={() => setCartOpen(true)}
                    sx={{
                        position: 'fixed', bottom: 24, right: 24, zIndex: 1200,
                        bgcolor: ACCENT, '&:hover': { bgcolor: '#e5541c' },
                        boxShadow: '0 4px 18px rgba(255,96,32,0.45)',
                        color: 'white',
                    }}
                >
                    <Box sx={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <ShoppingCart />
                        {cartCount > 0 && (
                            <Box sx={{
                                position: 'absolute', top: -10, right: -12,
                                minWidth: 18, height: 18, borderRadius: 10,
                                bgcolor: 'white', color: ACCENT,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 10, fontWeight: 900, px: 0.5,
                                boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
                            }}>
                                {cartCount}
                            </Box>
                        )}
                    </Box>
                </Fab>
            )}

            {/* ══ Cart Dialog — mobile ══ */}
            {isMobile && (
                <Dialog
                    open={cartOpen}
                    onClose={() => setCartOpen(false)}
                    fullScreen
                    PaperProps={{
                        sx: { bgcolor: 'background.default', display: 'flex', flexDirection: 'column' },
                    }}
                >
                    <DialogContent sx={{ p: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                        <CartPanel
                            {...cartPanelProps}
                            onClose={() => setCartOpen(false)}
                        />
                    </DialogContent>
                </Dialog>
            )}
        </Box>
    );
};

export default TouchPOSMode;
