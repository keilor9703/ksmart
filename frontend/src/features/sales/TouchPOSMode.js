import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
    Box, Paper, Typography, IconButton, Button, TextField, InputAdornment,
    Chip, Divider, Autocomplete, useMediaQuery, useTheme,
    Dialog, DialogContent, Fab, Grid, Collapse, CircularProgress, Tooltip,
    Switch, FormControlLabel,
} from '@mui/material';
import {
    Search, ShoppingCart, PersonOutline, AddCircle, RemoveCircle, Delete,
    ExpandMore, Add, CloseRounded, Inventory2, QrCodeScanner, Videocam, VideocamOff,
    Stars,
} from '@mui/icons-material';
import { formatCurrency } from '../../utils/formatters';
import CurrencyField from '../../components/common/CurrencyField';
import { getProductoByBarcode } from '../../api';
import { toast } from 'react-toastify';

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
    omitirInventario, setOmitirInventario,
    linkPagoConfig,
    fidelizacionActiva, clientePuntos, puntosACanjear, setPuntosACanjear, redeemRate,
}) => {
    const validItems = saleDetails.filter(d => d.producto && d.cantidad > 0);
    const subtotal = calculateSubtotal();
    const ivaPorc = parseFloat(ivaPorcentajeGlobal) || 0;
    const ivaAmount = ivaPorc > 0 ? subtotal * ivaPorc / (100 + ivaPorc) : 0; // IVA incluido
    const descuentoPuntos = (puntosACanjear || 0) * (redeemRate || 100);
    const total = Math.max(0, subtotal - descuentoPuntos);

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
                {ivaPorc > 0 && (
                    <Box sx={{ px: 1, mb: 0.5 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                            <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>Base (sin IVA)</Typography>
                            <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{formatCurrency(subtotal - ivaAmount)}</Typography>
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                            <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>IVA incluido ({ivaPorc}%)</Typography>
                            <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{formatCurrency(ivaAmount)}</Typography>
                        </Box>
                    </Box>
                )}
                <Box sx={{ textAlign: 'center', mb: 1 }}>
                    <Typography sx={{
                        fontSize: 9, color: 'text.secondary',
                        letterSpacing: 1.5, textTransform: 'uppercase',
                    }}>
                        Total a cobrar
                    </Typography>
                    {descuentoPuntos > 0 ? (
                        <>
                            <Typography sx={{ fontSize: 16, fontWeight: 700, color: 'text.secondary', textDecoration: 'line-through', lineHeight: 1.1 }}>
                                {formatCurrency(subtotal)}
                            </Typography>
                            <Typography sx={{ fontSize: 34, fontWeight: 900, color: ACCENT, lineHeight: 1.1 }}>
                                {formatCurrency(total)}
                            </Typography>
                            <Chip label={`-${formatCurrency(descuentoPuntos)} puntos`} size="small"
                                sx={{ mt: 0.3, bgcolor: '#10B98118', color: '#10B981', fontWeight: 700, fontSize: 9 }} />
                        </>
                    ) : (
                        <Typography sx={{ fontSize: 34, fontWeight: 900, color: ACCENT, lineHeight: 1.1 }}>
                            {formatCurrency(total)}
                        </Typography>
                    )}
                </Box>

                {/* Puntos de fidelización */}
                {fidelizacionActiva && cliente && !isMostrador && clientePuntos > 0 && (
                    <Box sx={{ mb: 1, p: 1, borderRadius: 1.5, bgcolor: '#10B98108', border: '1px solid #10B98128' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                            <Stars sx={{ fontSize: 13, color: '#10B981' }} />
                            <Typography sx={{ fontSize: 11, fontWeight: 700, color: '#10B981', flex: 1 }}>
                                {clientePuntos} pts disponibles
                            </Typography>
                            <Typography sx={{ fontSize: 9, color: 'text.secondary' }}>
                                = {formatCurrency(clientePuntos * (redeemRate || 100))}
                            </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                            {[0, Math.floor(clientePuntos * 0.5), clientePuntos].filter((v, i, a) => a.indexOf(v) === i).map(pts => (
                                <Chip
                                    key={pts}
                                    label={pts === 0 ? 'Sin canje' : pts === clientePuntos ? 'Todo' : `${pts} pts`}
                                    size="small"
                                    onClick={() => setPuntosACanjear(pts)}
                                    sx={{
                                        fontSize: 9, fontWeight: 700, cursor: 'pointer', height: 20,
                                        bgcolor: puntosACanjear === pts ? '#10B98120' : 'background.paper',
                                        color: puntosACanjear === pts ? '#10B981' : 'text.secondary',
                                        border: '1px solid',
                                        borderColor: puntosACanjear === pts ? '#10B981' : 'divider',
                                    }}
                                />
                            ))}
                        </Box>
                    </Box>
                )}

                {/* Payment methods */}
                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 1, justifyContent: 'center' }}>
                    {[...METODOS_PAGO, ...(linkPagoConfig ? [{ value: 'Link de Pago', label: '📲 Link/QR', pagada: true, color: '#FF6020' }] : [])].map(opt => {
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

                {/* Omitir validación de stock */}
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1 }}>
                    <FormControlLabel
                        control={
                            <Switch
                                checked={omitirInventario || false}
                                onChange={e => setOmitirInventario?.(e.target.checked)}
                                size="small"
                                sx={{
                                    '& .MuiSwitch-switchBase.Mui-checked': { color: '#F59E0B' },
                                    '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: '#F59E0B' },
                                }}
                            />
                        }
                        label={
                            <Typography fontSize={11} fontWeight={omitirInventario ? 700 : 400} color={omitirInventario ? '#92400E' : 'text.secondary'}>
                                Vender sin validar stock
                            </Typography>
                        }
                        sx={{ m: 0, gap: 0.5 }}
                    />
                </Box>

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
    omitirInventario, setOmitirInventario,
    linkPagoConfig,
    fidelizacionActiva, clientePuntos, puntosACanjear, setPuntosACanjear, redeemRate,
}) => {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));

    const [search, setSearch] = useState('');
    const [cartOpen, setCartOpen] = useState(false);
    const [expandedGroups, setExpandedGroups] = useState({});

    // ── Barcode / Camera ──
    const [barcodeInput, setBarcodeInput]         = useState('');
    const [cameraActive, setCameraActive]         = useState(false);
    const [searchingBarcode, setSearchingBarcode] = useState(false);
    const [scanFlash, setScanFlash]               = useState(false);
    const barcodeFieldRef  = useRef(null);
    const videoRef         = useRef(null);
    const streamRef        = useRef(null);
    const rAFRef           = useRef(null);
    const zxingControlsRef = useRef(null);
    const scanCooldownRef  = useRef(false);

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
                        if (!scanCooldownRef.current && now - lastDetect >= 120) {
                            lastDetect = now;
                            const v = videoRef.current;
                            if (v.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA && v.videoWidth > 0) {
                                try { const codes = await detector.detect(v); if (codes.length > 0) onBarcode(codes[0].rawValue); } catch {}
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
                onAddProduct(producto);
                if (producto.impuesto?.porcentaje != null) {
                    setIvaPorcentajeGlobal(producto.impuesto.porcentaje);
                }
                playScanBeep();
                toast.success(`${producto.nombre} añadido al carrito`);
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
        omitirInventario, setOmitirInventario,
        linkPagoConfig,
        fidelizacionActiva, clientePuntos, puntosACanjear, setPuntosACanjear, redeemRate,
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
                {/* Sticky search + barcode bar */}
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
                        sx={{ mb: 0.8, '& .MuiOutlinedInput-root': { borderRadius: 2.5 } }}
                    />
                    {/* Barcode scanner */}
                    <Box sx={{ display: 'flex', gap: 0.8 }}>
                        <TextField
                            fullWidth size="small"
                            placeholder="Escanea o digita el código de barras y presiona Enter…"
                            value={barcodeInput}
                            onChange={(e) => setBarcodeInput(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleProcessBarcode(barcodeInput); } }}
                            inputRef={barcodeFieldRef}
                            autoComplete="off"
                            disabled={searchingBarcode}
                            InputProps={{
                                startAdornment: <InputAdornment position="start"><QrCodeScanner sx={{ color: ACCENT, fontSize: 18 }} /></InputAdornment>,
                                endAdornment: searchingBarcode ? <CircularProgress size={16} sx={{ color: ACCENT }} /> : null,
                                sx: { fontSize: 13, fontWeight: 600, borderRadius: 2 },
                            }}
                        />
                        <Tooltip title={cameraActive ? 'Cerrar cámara' : 'Usar cámara del dispositivo'}>
                            <IconButton onClick={handleToggleCamera}
                                sx={{ bgcolor: cameraActive ? '#FEF2F2' : '#EFF6FF', color: cameraActive ? '#EF4444' : '#3B82F6', borderRadius: 2, p: 1, flexShrink: 0 }}>
                                {cameraActive ? <VideocamOff sx={{ fontSize: 20 }} /> : <Videocam sx={{ fontSize: 20 }} />}
                            </IconButton>
                        </Tooltip>
                    </Box>
                    {/* Camera overlay */}
                    {cameraActive && (
                        <Box sx={{ mt: 1, position: 'relative', borderRadius: 2, overflow: 'hidden', bgcolor: '#000', minHeight: 220 }}>
                            <video ref={videoRef} style={{ width: '100%', display: 'block', maxHeight: 260, objectFit: 'cover' }} playsInline muted />
                            <Box sx={{
                                position: 'absolute', inset: 0, borderRadius: 2,
                                bgcolor: 'rgba(16,185,129,0.28)', border: '3px solid #10B981',
                                opacity: scanFlash ? 1 : 0,
                                transition: scanFlash ? 'none' : 'opacity 0.35s ease-out',
                                pointerEvents: 'none', zIndex: 3,
                            }} />
                            <Box sx={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1.5, pointerEvents: 'none' }}>
                                <Box sx={{ position: 'relative', width: { xs: 200, sm: 260 }, height: { xs: 110, sm: 130 } }}>
                                    <Box sx={{ position: 'absolute', inset: 0, boxShadow: '0 0 0 100vw rgba(0,0,0,0.45)', borderRadius: 2 }} />
                                    {(() => {
                                        const c = scanFlash ? '#10B981' : ACCENT;
                                        return <>
                                            <Box sx={{ position: 'absolute', top: -1, left: -1, width: 20, height: 20, borderTop: `3px solid ${c}`, borderLeft: `3px solid ${c}`, borderRadius: '4px 0 0 0', transition: 'border-color 0.15s' }} />
                                            <Box sx={{ position: 'absolute', top: -1, right: -1, width: 20, height: 20, borderTop: `3px solid ${c}`, borderRight: `3px solid ${c}`, borderRadius: '0 4px 0 0', transition: 'border-color 0.15s' }} />
                                            <Box sx={{ position: 'absolute', bottom: -1, left: -1, width: 20, height: 20, borderBottom: `3px solid ${c}`, borderLeft: `3px solid ${c}`, borderRadius: '0 0 0 4px', transition: 'border-color 0.15s' }} />
                                            <Box sx={{ position: 'absolute', bottom: -1, right: -1, width: 20, height: 20, borderBottom: `3px solid ${c}`, borderRight: `3px solid ${c}`, borderRadius: '0 0 4px 0', transition: 'border-color 0.15s' }} />
                                        </>;
                                    })()}
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
