import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Box, Typography, Avatar, Chip, Button, IconButton, Tooltip,
  CircularProgress, useTheme, alpha, Badge, Stack, Divider,
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Select, MenuItem, FormControl, InputLabel,
  List, ListItem, ListItemText, ListItemSecondaryAction,
  Paper, ToggleButton, ToggleButtonGroup, Tab, Tabs,
  useMediaQuery, Switch, FormControlLabel, Collapse, InputAdornment,
} from '@mui/material';
import {
  TableRestaurant, Add, Refresh, Close, Person,
  Restaurant, AttachMoney, Cancel, Send,
  CheckCircle, HourglassBottom, FiberManualRecord,
  Edit, Delete, Settings, Receipt, Note, MenuBook, Print,
  ExpandMore, ExpandLess, PointOfSale, Replay,
  ViewModule, Map as MapIcon, WifiProtectedSetup,
} from '@mui/icons-material';
import { toast } from 'react-toastify';
import apiClient from '../../api';
import { imprimirComanda, imprimirCuenta } from '../../utils/printComanda';
import usePolling from '../../hooks/usePolling';
import ReciboDialog from '../../components/common/ReciboDialog';
import LinkPagoModal from '../../components/common/LinkPagoModal.jsx';
import ResumenTurno from './ResumenTurno';

// ─── Config colores de estado ─────────────────────────────────────────────────

const ESTADO_MESA = {
  libre:     { color: '#059669', label: 'Libre',     bg: 'rgba(5,150,105,0.12)' },
  ocupada:   { color: '#F59E0B', label: 'Ocupada',   bg: 'rgba(245,158,11,0.12)' },
  en_cuenta: { color: '#7C3AED', label: 'En cuenta', bg: 'rgba(124,58,237,0.12)' },
  reservada: { color: '#2563EB', label: 'Reservada', bg: 'rgba(37,99,235,0.12)' },
};

const ESTADO_ITEM = {
  pendiente:      { color: '#F59E0B', label: 'Pendiente',      icon: <HourglassBottom sx={{ fontSize: 12 }} /> },
  en_preparacion: { color: '#2563EB', label: 'En preparación', icon: <Restaurant sx={{ fontSize: 12 }} /> },
  listo:          { color: '#059669', label: 'Listo',          icon: <CheckCircle sx={{ fontSize: 12 }} /> },
  entregado:      { color: '#6b7280', label: 'Entregado',      icon: <CheckCircle sx={{ fontSize: 12 }} /> },
  cancelado:      { color: '#EF4444', label: 'Cancelado',      icon: <Cancel sx={{ fontSize: 12 }} /> },
};

const fmt = (v) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v ?? 0);

const timeAgo = (iso) => {
  if (!iso) return '';
  // Handle both naive datetimes (no tz info) and aware ones (+00:00 / Z)
  const d = new Date(iso.endsWith('Z') || iso.includes('+') ? iso : iso + 'Z');
  const diff = Math.floor((Date.now() - d) / 60000);
  if (isNaN(diff) || diff < 0) return '—';
  if (diff < 1) return 'ahora';
  if (diff < 60) return `${diff}min`;
  return `${Math.floor(diff / 60)}h${diff % 60 > 0 ? ` ${diff % 60}min` : ''}`;
};

// ─── AbrirComandaDialog ───────────────────────────────────────────────────────

const AbrirComandaDialog = ({ open, onClose, mesa, onSuccess }) => {
  const [personasStr, setPersonasStr] = useState('2');
  const [notas, setNotas] = useState('');
  const [loading, setLoading] = useState(false);

  // Permite borrar y escribir libremente; solo valida al enviar
  const personas = parseInt(personasStr, 10) || 1;

  const handleAbrir = async () => {
    if (personas < 1) return;
    setLoading(true);
    try {
      await apiClient.post('/restaurante/comandas', {
        mesa_id: mesa.id, personas, notas: notas || null,
      });
      toast.success(`Mesa ${mesa.numero} — comanda abierta`);
      onSuccess();
      onClose();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Error al abrir comanda');
    } finally { setLoading(false); }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 4 } }}>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Avatar sx={{ bgcolor: alpha('#059669', 0.12), width: 40, height: 40, flexShrink: 0 }}>
            <TableRestaurant sx={{ color: '#059669', fontSize: 20 }} />
          </Avatar>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography fontWeight={800} fontSize={15}>Abrir mesa {mesa?.numero}</Typography>
            <Typography fontSize={12} color="text.secondary" noWrap>{mesa?.zona} · {mesa?.capacidad} sillas</Typography>
          </Box>
          <IconButton size="small" onClick={onClose}><Close fontSize="small" /></IconButton>
        </Box>
      </DialogTitle>
      <DialogContent dividers sx={{ pt: 2 }}>
        <Stack spacing={2.5}>
          <TextField
            label="Número de personas"
            type="number"
            size="medium"
            fullWidth
            value={personasStr}
            onChange={e => setPersonasStr(e.target.value)}
            onBlur={() => {
              // Al salir del campo, asegurar valor mínimo de 1
              const v = parseInt(personasStr, 10);
              setPersonasStr(String(isNaN(v) || v < 1 ? 1 : v));
            }}
            inputProps={{ min: 1, max: mesa?.capacidad || 20 }}
            InputProps={{ startAdornment: <Person sx={{ mr: 1, color: 'text.secondary', fontSize: 20 }} /> }}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
          />
          <TextField
            label="Nota inicial (opcional)"
            size="medium"
            fullWidth
            multiline
            rows={2}
            value={notas}
            onChange={e => setNotas(e.target.value)}
            placeholder="Ej: cliente con silla de bebé, cumpleaños..."
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
        <Button onClick={onClose} sx={{ borderRadius: 2 }}>Cancelar</Button>
        <Button variant="contained" onClick={handleAbrir} disabled={loading || personas < 1}
          startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <TableRestaurant />}
          sx={{ bgcolor: '#059669', '&:hover': { bgcolor: '#047857' }, borderRadius: 2, fontWeight: 700, flex: 1, py: 1.1 }}>
          Abrir mesa
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ─── ComandaPanel ─────────────────────────────────────────────────────────────

const ComandaPanel = ({ mesa, comanda, productos, config, onClose, onSuccess, empresa, vendedor }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isDark = theme.palette.mode === 'dark';
  const [search, setSearch] = useState('');
  const [selectedItems, setSelectedItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [reciboVenta, setReciboVenta] = useState(null);
  const [reciboOpen, setReciboOpen]   = useState(false);
  const [propina, setPropina] = useState(0);
  const [metodo, setMetodo] = useState('Efectivo');
  const [tab, setTab] = useState(0); // 0=Pedido, 1=Menú (solo móvil)
  const [linkPagoConfig, setLinkPagoConfig] = useState(null);
  const [linkPagoModalOpen, setLinkPagoModalOpen] = useState(false);
  const pendingCerrarRef = useRef(false);
  const [omitirInventario, setOmitirInventario] = useState(false);
  const [cartExpanded, setCartExpanded] = useState(true);
  const [recibido, setRecibido] = useState('');
  const omitirInventarioRef = useRef(false);
  omitirInventarioRef.current = omitirInventario;

  // ── Calculadora de cambio (cobro directo mesero) ─────────────────────────
  const totalBase = comanda?.total ?? 0;
  const totalConPropina = totalBase + (propina || 0);
  const montoRec = parseInt(recibido.replace(/\./g, ''), 10) || 0;
  const cambio   = metodo === 'Efectivo' ? Math.max(0, montoRec - totalConPropina) : 0;
  const faltante = metodo === 'Efectivo' && montoRec > 0 ? Math.max(0, totalConPropina - montoRec) : 0;
  const puedeConfirmarCobro =
    metodo === 'Link de Pago' ||
    metodo !== 'Efectivo' ||
    montoRec >= totalConPropina;

  const handleRecibidoChange = (e) => {
    const raw = e.target.value.replace(/\D/g, '');
    if (raw === '') { setRecibido(''); return; }
    setRecibido(new Intl.NumberFormat('es-CO').format(parseInt(raw, 10)));
  };

  useEffect(() => {
    apiClient.get('/empresa/link-pago').then(r => setLinkPagoConfig(r.data)).catch(() => {});
  }, []);

  const itemsActivos = comanda?.items?.filter(i => i.estado !== 'cancelado') || [];
  const hayPendientes = itemsActivos.some(i => i.estado === 'pendiente' && i.va_a_cocina);
  const hayEnPrep = itemsActivos.some(i => i.estado === 'en_preparacion' && i.va_a_cocina);

  const productosFiltrados = productos.filter(p =>
    p.nombre.toLowerCase().includes(search.toLowerCase()) ||
    (p.descripcion && p.descripcion.toLowerCase().includes(search.toLowerCase()))
  );

  const groupedByCategory = useMemo(() => {
    const map = new Map();
    for (const p of productosFiltrados) {
      const cat = p.categoria || 'Sin categoría';
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat).push(p);
    }
    return Array.from(map.entries()).map(([categoria, prods]) => ({ categoria, prods }));
  }, [productosFiltrados]);

  const [expandedCategories, setExpandedCategories] = useState({});
  const toggleCategory = (cat) => setExpandedCategories(prev => ({ ...prev, [cat]: !prev[cat] }));
  const isCategoryExpanded = (cat) => search.trim() !== '' || expandedCategories[cat] !== false;

  const platosMenu = productosFiltrados.filter(p => p.requiere_cocina);
  const otrosMenu  = productosFiltrados.filter(p => !p.requiere_cocina);

  const addToSelected = (prod) => {
    setSelectedItems(prev => {
      const existe = prev.find(i => i.producto_id === prod.id);
      if (existe) return prev.map(i => i.producto_id === prod.id ? { ...i, cantidad: i.cantidad + 1 } : i);
      return [...prev, {
        producto_id: prod.id,
        nombre_producto: prod.nombre,
        precio_unitario: prod.precio,
        cantidad: 1,
        notas: '',
        area_cocina: config?.areas_cocina?.[0] || 'Cocina general',
      }];
    });
  };

  const [notaAbierta, setNotaAbierta] = useState(null); // producto_id con nota expandida

  const removeSelected = (pid) => setSelectedItems(prev => prev.filter(i => i.producto_id !== pid));

  const updateCantidad = (pid, delta) => {
    setSelectedItems(prev =>
      prev.map(i => i.producto_id === pid ? { ...i, cantidad: Math.max(1, i.cantidad + delta) } : i)
    );
  };

  const updateNota = (pid, nota) => {
    setSelectedItems(prev => prev.map(i => i.producto_id === pid ? { ...i, notas: nota } : i));
  };

  const handleEnviarCocina = async () => {
    if (!selectedItems.length) return;
    setLoading(true);
    try {
      await apiClient.post(`/restaurante/comandas/${comanda.id}/items`, selectedItems);
      if (config?.imprimir_comanda_auto) {
        imprimirComanda({
          mesa,
          comanda,
          items: selectedItems,
          empresaNombre: empresa?.nombre || '',
          nombreMesero: vendedor || '',
          printerSize: config?.tipo_impresora || 'p80',
        });
      }
      setSelectedItems([]);
      toast.success('Pedido enviado a cocina');
      if (isMobile) setTab(0); // volver al pedido tras enviar
      onSuccess();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Error al enviar');
    } finally { setLoading(false); }
  };

  const handleImprimirManual = () => {
    const itemsParaImprimir = itemsActivos.length > 0 ? itemsActivos : selectedItems;
    if (!itemsParaImprimir.length) return toast.info('No hay ítems para imprimir');
    imprimirComanda({
      mesa,
      comanda,
      items: itemsParaImprimir,
      empresaNombre: empresa?.nombre || '',
      nombreMesero: vendedor || '',
      titulo: 'REIMPRESIÓN',
      printerSize: config?.tipo_impresora || 'p80',
    });
  };

  const doCerrarCuenta = async () => {
    setLoading(true);
    try {
      const res = await apiClient.post(`/restaurante/comandas/${comanda.id}/cerrar`, {
        metodo_pago: metodo, propina, omitir_inventario: omitirInventarioRef.current,
      });
      const ventaSnap = {
        id: res.data.venta_id,
        fecha: new Date().toISOString(),
        cliente: { nombre: `Mesa ${mesa.numero}`, telefono: '' },
        detalles: itemsActivos.map(d => ({
          producto: { nombre: d.nombre_producto }, cantidad: d.cantidad, precio_unitario: d.precio_unitario,
        })),
        total: res.data.total, iva_total: 0, iva_porcentaje: 0,
        monto_pagado: res.data.total, estado_pago: 'pagado', metodo_pago: metodo,
      };
      setReciboVenta(ventaSnap);
      setReciboOpen(true);
      setOmitirInventario(false);
      toast.success(`Mesa ${mesa.numero} cerrada — Venta #${res.data.venta_id}`);
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Error al cerrar');
    } finally { setLoading(false); }
  };

  const handleCerrarCuenta = () => {
    if (metodo === 'Link de Pago') {
      pendingCerrarRef.current = true;
      setLinkPagoModalOpen(true);
    } else {
      doCerrarCuenta();
    }
  };

  const handleCancelarItem = async (itemId) => {
    try {
      await apiClient.patch(`/restaurante/comandas/${comanda.id}/items/${itemId}`, { estado: 'cancelado' });
      onSuccess();
    } catch (e) { toast.error('Error al cancelar ítem'); }
  };

  const handleSolicitarCuenta = async () => {
    setLoading(true);
    try {
      const res = await apiClient.patch(`/restaurante/comandas/${comanda.id}/solicitar-cuenta`);
      imprimirCuenta({
        mesa,
        comanda: res.data,
        items: itemsActivos,
        empresaNombre: empresa?.nombre || '',
        nombreMesero: vendedor || '',
        propina,
        printerSize: config?.tipo_impresora || 'p80',
      });
      toast.success(`Cuenta solicitada — Ticket #${res.data.numero_comanda}`);
      onSuccess();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Error al solicitar la cuenta');
    } finally { setLoading(false); }
  };

  const handleReabrirCuenta = async () => {
    setLoading(true);
    try {
      await apiClient.patch(`/restaurante/comandas/${comanda.id}/reabrir-cuenta`);
      toast.success('Comanda reabierta');
      onSuccess();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Error al reabrir la comanda');
    } finally { setLoading(false); }
  };

  const handleReimprimirCuenta = () => {
    if (!itemsActivos.length) return toast.info('No hay ítems para imprimir');
    imprimirCuenta({
      mesa,
      comanda,
      items: itemsActivos,
      empresaNombre: empresa?.nombre || '',
      nombreMesero: vendedor || '',
      propina,
      printerSize: config?.tipo_impresora || 'p80',
    });
  };

  // ── Sección de ítems (reutilizada en móvil y desktop) ──────────────────────
  const PedidoContent = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
        {itemsActivos.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 5, color: 'text.disabled' }}>
            <Restaurant sx={{ fontSize: 40, opacity: 0.2, mb: 1 }} />
            <Typography fontSize={13}>Aún no hay ítems.</Typography>
            <Typography fontSize={12} sx={{ mt: 0.5 }}>
              {isMobile ? 'Toca "Menú" para agregar.' : 'Selecciona productos del menú →'}
            </Typography>
          </Box>
        ) : (
          <Stack spacing={1}>
            {itemsActivos.map(item => {
              const est = ESTADO_ITEM[item.estado] || ESTADO_ITEM.pendiente;
              return (
                <Box key={item.id} sx={{
                  display: 'flex', alignItems: 'center', gap: 1,
                  p: 1.5, borderRadius: 2,
                  bgcolor: isDark ? alpha('#fff', 0.03) : alpha('#000', 0.025),
                  border: `1px solid ${alpha(est.color, 0.2)}`,
                }}>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography fontSize={13} fontWeight={700} noWrap>{item.nombre_producto}</Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, mt: 0.3 }}>
                      <Typography fontSize={12} color="text.disabled">{item.cantidad}× {fmt(item.precio_unitario)}</Typography>
                      {item.notas && <Tooltip title={item.notas}><Note sx={{ fontSize: 13, color: 'text.disabled' }} /></Tooltip>}
                    </Box>
                  </Box>
                  <Chip icon={est.icon} label={est.label} size="small"
                    sx={{ fontSize: 10, height: 22, fontWeight: 700, bgcolor: alpha(est.color, 0.1), color: est.color, '& .MuiChip-icon': { color: est.color } }} />
                  <Typography fontSize={13} fontWeight={700} color="#FF6020" sx={{ flexShrink: 0, minWidth: 58, textAlign: 'right' }}>
                    {fmt(item.subtotal)}
                  </Typography>
                  {item.estado === 'pendiente' && (
                    <Tooltip title="Cancelar">
                      <IconButton size="small" onClick={() => handleCancelarItem(item.id)} sx={{ color: '#EF4444', p: 0.4 }}>
                        <Cancel sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Tooltip>
                  )}
                </Box>
              );
            })}
          </Stack>
        )}

        {/* Sección de cierre */}
        {itemsActivos.length > 0 && (
          <Box sx={{ mt: 2, pt: 2, borderTop: `2px solid ${theme.palette.divider}` }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
              <Typography fontSize={13} color="text.secondary">Subtotal</Typography>
              <Typography fontSize={13} fontWeight={700}>{fmt(comanda.total)}</Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
              <Typography fontSize={13} color="text.secondary">Propina</Typography>
              <TextField size="small" type="number" value={propina}
                onChange={e => setPropina(Math.max(0, +e.target.value))}
                sx={{ width: 110, '& .MuiOutlinedInput-root': { borderRadius: 2, fontSize: 13 } }} />
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
              <Typography fontWeight={800} fontSize={16}>Total</Typography>
              <Typography fontWeight={900} fontSize={18} color="#FF6020">{fmt(comanda.total + propina)}</Typography>
            </Box>

            {/* Estado: en_cuenta (esperando pago en caja) */}
            {comanda.estado === 'en_cuenta' ? (
              <Box>
                <Box sx={{
                  p: 1.5, borderRadius: 2, mb: 1.5,
                  bgcolor: alpha('#7C3AED', 0.08),
                  border: `1.5px solid ${alpha('#7C3AED', 0.3)}`,
                  textAlign: 'center',
                }}>
                  <PointOfSale sx={{ color: '#7C3AED', fontSize: 22, mb: 0.5 }} />
                  <Typography fontSize={13} fontWeight={800} color="#7C3AED">
                    Cliente en caja — Ticket #{comanda.numero_comanda}
                  </Typography>
                  <Typography fontSize={11} color="text.secondary" mt={0.3}>
                    El cajero procesará el pago
                  </Typography>
                </Box>
                <Stack spacing={1}>
                  <Button fullWidth variant="outlined" size="small"
                    startIcon={<Print />}
                    onClick={handleReimprimirCuenta}
                    sx={{ borderRadius: 2, fontWeight: 700, fontSize: 12, borderColor: '#7C3AED', color: '#7C3AED' }}>
                    Reimprimir ticket de cuenta
                  </Button>
                  <Button fullWidth variant="outlined" size="small"
                    startIcon={<Replay />}
                    onClick={handleReabrirCuenta}
                    disabled={loading}
                    sx={{ borderRadius: 2, fontWeight: 700, fontSize: 12, borderColor: '#F59E0B', color: '#F59E0B' }}>
                    Reabrir (cliente volvió a la mesa)
                  </Button>
                </Stack>
                {config?.mesero_puede_cobrar_directo && (
                  <Divider sx={{ my: 1.5 }}><Typography fontSize={10} color="text.disabled">O cobrar directamente</Typography></Divider>
                )}
              </Box>
            ) : (
              /* Botón: solicitar cuenta para que vaya a la caja */
              <Button fullWidth variant="outlined"
                disabled={loading || (!config?.imprimir_comanda_auto && (hayPendientes || hayEnPrep))}
                startIcon={loading ? <CircularProgress size={15} color="inherit" /> : <PointOfSale />}
                onClick={handleSolicitarCuenta}
                sx={{ borderRadius: 2, fontWeight: 700, fontSize: 13, py: 1, mb: 1.5, borderColor: '#7C3AED', color: '#7C3AED', '&:hover': { bgcolor: alpha('#7C3AED', 0.06), borderColor: '#6D28D9' } }}>
                Pedir cuenta → Cliente va a la caja
              </Button>
            )}

            {/* Cobrar directamente (solo si el admin lo habilitó en configuración) */}
            {config?.mesero_puede_cobrar_directo && (
              <>
                <FormControl size="small" fullWidth sx={{ mb: 1.5 }}>
                  <InputLabel>Método de pago</InputLabel>
                  <Select value={metodo} onChange={e => { setMetodo(e.target.value); setRecibido(''); }} label="Método de pago" sx={{ borderRadius: 2 }}>
                    {['Efectivo', 'Tarjeta', 'Nequi', 'Transferencia', 'Daviplata'].map(m => (
                      <MenuItem key={m} value={m}>{m}</MenuItem>
                    ))}
                    {linkPagoConfig && (
                      <MenuItem value="Link de Pago">Link de Pago / QR</MenuItem>
                    )}
                  </Select>
                </FormControl>

                {/* Calculadora de cambio — solo cuando es Efectivo */}
                {metodo === 'Efectivo' && (
                  <Box sx={{ mb: 1.5 }}>
                    <TextField
                      label="Monto recibido del cliente"
                      size="small"
                      fullWidth
                      inputMode="numeric"
                      value={recibido}
                      onChange={handleRecibidoChange}
                      InputProps={{
                        startAdornment: <InputAdornment position="start">$</InputAdornment>,
                      }}
                      sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 }, mb: 1 }}
                    />
                    {montoRec > 0 && (
                      <Box sx={{
                        p: 1.5, borderRadius: 2, textAlign: 'center',
                        bgcolor: cambio > 0
                          ? alpha('#059669', 0.08)
                          : faltante > 0 ? alpha('#EF4444', 0.08) : alpha('#F59E0B', 0.08),
                        border: `1.5px solid ${cambio > 0 ? alpha('#059669', 0.3) : faltante > 0 ? alpha('#EF4444', 0.3) : alpha('#F59E0B', 0.3)}`,
                      }}>
                        {cambio > 0 ? (
                          <>
                            <Typography fontSize={11} color="#059669" fontWeight={700}>CAMBIO A DEVOLVER</Typography>
                            <Typography fontSize={22} fontWeight={900} color="#059669">{fmt(cambio)}</Typography>
                          </>
                        ) : faltante > 0 ? (
                          <>
                            <Typography fontSize={11} color="#EF4444" fontWeight={700}>FALTA</Typography>
                            <Typography fontSize={22} fontWeight={900} color="#EF4444">{fmt(faltante)}</Typography>
                          </>
                        ) : (
                          <Typography fontSize={13} fontWeight={700} color="#F59E0B">Pago exacto ✓</Typography>
                        )}
                      </Box>
                    )}
                  </Box>
                )}

                <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1 }}>
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
                      <Typography fontSize={11} fontWeight={omitirInventario ? 700 : 400} color={omitirInventario ? '#92400E' : 'text.secondary'}>
                        Vender sin validar stock
                      </Typography>
                    }
                    sx={{ m: 0, gap: 0.5 }}
                  />
                </Box>
                <Button fullWidth variant="contained"
                  disabled={loading || !puedeConfirmarCobro || (!config?.imprimir_comanda_auto && (hayPendientes || hayEnPrep))}
                  startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <Receipt />}
                  onClick={handleCerrarCuenta}
                  sx={{ borderRadius: 2, fontWeight: 800, fontSize: 14, py: 1.2, bgcolor: '#059669', '&:hover': { bgcolor: '#047857' }, mb: 0.5 }}>
                  Cobrar directamente (mesero)
                </Button>
                {!config?.imprimir_comanda_auto && (hayPendientes || hayEnPrep) && (
                  <Typography fontSize={11} color="text.secondary" textAlign="center">
                    Espera a que cocina confirme todos los ítems
                  </Typography>
                )}
              </>
            )}
          </Box>
        )}
      </Box>
    </Box>
  );

  // ── Sección de menú (reutilizada en móvil y desktop) ───────────────────────
  const MenuContent = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box sx={{ p: 1.5, borderBottom: `1px solid ${theme.palette.divider}` }}>
        <TextField size="small" fullWidth placeholder="Buscar en el menú..."
          value={search} onChange={e => setSearch(e.target.value)}
          sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2, fontSize: 14 } }} />
      </Box>

      <Box sx={{ flex: 1, overflowY: 'auto', p: 1.5 }}>
        {productosFiltrados.length === 0 ? (
          <Typography fontSize={13} color="text.disabled" textAlign="center" sx={{ mt: 4 }}>Sin productos</Typography>
        ) : (
          <Stack spacing={0.5}>
            {groupedByCategory.map(({ categoria, prods }) => {
              const open = isCategoryExpanded(categoria);
              return (
                <Box key={categoria}>
                  {/* Category header */}
                  <Box
                    onClick={() => toggleCategory(categoria)}
                    sx={{
                      display: 'flex', alignItems: 'center', gap: 0.8,
                      px: 1, py: 0.7, borderRadius: 2, cursor: 'pointer', mb: 0.5,
                      bgcolor: isDark ? alpha('#FF6020', 0.08) : alpha('#FF6020', 0.06),
                      '&:hover': { bgcolor: alpha('#FF6020', 0.12) },
                    }}
                  >
                    <Typography fontSize={11} fontWeight={800} color="#FF6020" textTransform="uppercase"
                      letterSpacing={0.8} sx={{ flex: 1 }}>
                      {categoria}
                    </Typography>
                    <Typography fontSize={10} color="text.disabled" sx={{ mr: 0.5 }}>{prods.length}</Typography>
                    {open ? <ExpandLess sx={{ fontSize: 16, color: '#FF6020' }} /> : <ExpandMore sx={{ fontSize: 16, color: '#FF6020' }} />}
                  </Box>
                  {/* Products in category */}
                  {open && (
                    <Stack spacing={0.8} sx={{ mb: 0.5 }}>
                      {prods.map(prod => {
                        const imgSrc = Array.isArray(prod.imagenes) && prod.imagenes.length > 0 ? prod.imagenes[0] : null;
                        return (
                          <Box key={prod.id} onClick={() => addToSelected(prod)} sx={{
                            display: 'flex', gap: 1, alignItems: 'flex-start',
                            p: 1.4, borderRadius: 2, cursor: 'pointer',
                            border: `1px solid ${alpha(theme.palette.divider, 1)}`,
                            bgcolor: isDark ? alpha('#fff', 0.025) : alpha('#000', 0.02),
                            transition: 'all 0.15s',
                            '&:hover': { borderColor: '#FF6020', bgcolor: alpha('#FF6020', 0.04) },
                            '&:active': { transform: 'scale(0.98)' },
                          }}>
                            {imgSrc ? (
                              <Box sx={{ width: 44, height: 44, borderRadius: 1.5, overflow: 'hidden', flexShrink: 0 }}>
                                <img src={imgSrc} alt={prod.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                              </Box>
                            ) : (
                              <Box sx={{ width: 44, height: 44, borderRadius: 1.5, bgcolor: alpha('#FF6020', 0.12), display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <Typography sx={{ fontSize: 20, fontWeight: 800, color: '#FF6020', opacity: 0.7 }}>
                                  {(prod.nombre || '?')[0].toUpperCase()}
                                </Typography>
                              </Box>
                            )}
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <Typography fontSize={13} fontWeight={600} sx={{ flex: 1, mr: 1 }}>{prod.nombre}</Typography>
                                <Typography fontSize={13} fontWeight={700} color="#FF6020" sx={{ flexShrink: 0 }}>
                                  {fmt(prod.precio)}
                                </Typography>
                              </Box>
                              {prod.descripcion && (
                                <Typography fontSize={11} color="text.secondary" sx={{ mt: 0.3, lineHeight: 1.4 }}>
                                  {prod.descripcion}
                                </Typography>
                              )}
                            </Box>
                          </Box>
                        );
                      })}
                    </Stack>
                  )}
                </Box>
              );
            })}
          </Stack>
        )}
      </Box>

      {/* Carrito — ítems seleccionados para enviar */}
      {selectedItems.length > 0 && (
        <Box sx={{
          flexShrink: 0,
          bgcolor: theme.palette.background.paper,
          borderTop: `2px solid ${alpha('#059669', 0.3)}`,
          boxShadow: '0 -4px 20px rgba(0,0,0,0.12)',
        }}>
          {/* Cabecera: resumen + toggle expandir */}
          <Box
            onClick={() => setCartExpanded(e => !e)}
            sx={{
              display: 'flex', alignItems: 'center', gap: 1,
              px: 1.5, py: 0.9, cursor: 'pointer',
              '&:hover': { bgcolor: alpha('#059669', 0.04) },
            }}
          >
            <Box sx={{
              width: 22, height: 22, borderRadius: '50%',
              bgcolor: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <Typography fontSize={11} fontWeight={800} sx={{ color: '#fff' }}>
                {selectedItems.reduce((a, i) => a + i.cantidad, 0)}
              </Typography>
            </Box>
            <Typography fontSize={12} fontWeight={700} color="#059669" sx={{ flex: 1 }}>
              ítem{selectedItems.reduce((a, i) => a + i.cantidad, 0) !== 1 ? 's' : ''} en el pedido
            </Typography>
            {cartExpanded
              ? <ExpandLess sx={{ fontSize: 18, color: '#059669' }} />
              : <ExpandMore sx={{ fontSize: 18, color: '#059669' }} />
            }
          </Box>

          {/* Lista desplegable de ítems */}
          <Collapse in={cartExpanded}>
            <Box sx={{ maxHeight: 200, overflowY: 'auto', px: 1.5, pb: 1 }}>
              <Stack spacing={0.7}>
                {selectedItems.map(it => (
                  <Box key={it.producto_id} sx={{
                    borderRadius: 2,
                    border: `1px solid ${alpha('#059669', notaAbierta === it.producto_id ? 0.5 : 0.15)}`,
                    bgcolor: alpha('#059669', 0.04), overflow: 'hidden',
                  }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 1, py: 0.7 }}>
                      <Typography fontSize={13} fontWeight={600} sx={{ flex: 1, minWidth: 0 }} noWrap>
                        {it.nombre_producto}
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3, flexShrink: 0 }}>
                        <IconButton size="small" onClick={e => { e.stopPropagation(); updateCantidad(it.producto_id, -1); }}
                          sx={{ width: 22, height: 22, bgcolor: alpha('#000', 0.06), borderRadius: 1, p: 0 }}>
                          <Typography fontSize={15} lineHeight={1} sx={{ userSelect: 'none' }}>−</Typography>
                        </IconButton>
                        <Typography fontSize={13} fontWeight={700} sx={{ minWidth: 18, textAlign: 'center' }}>
                          {it.cantidad}
                        </Typography>
                        <IconButton size="small" onClick={e => { e.stopPropagation(); updateCantidad(it.producto_id, 1); }}
                          sx={{ width: 22, height: 22, bgcolor: alpha('#059669', 0.12), borderRadius: 1, p: 0 }}>
                          <Typography fontSize={15} lineHeight={1} sx={{ color: '#059669', userSelect: 'none' }}>+</Typography>
                        </IconButton>
                      </Box>
                      <Tooltip title={it.notas ? `Nota: ${it.notas}` : 'Agregar nota'}>
                        <IconButton size="small"
                          onClick={e => { e.stopPropagation(); setNotaAbierta(n => n === it.producto_id ? null : it.producto_id); }}
                          sx={{ p: 0.3, color: it.notas ? '#F59E0B' : 'text.disabled' }}>
                          <Note sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Tooltip>
                      <IconButton size="small" onClick={e => { e.stopPropagation(); removeSelected(it.producto_id); }}
                        sx={{ p: 0.3, color: '#EF4444' }}>
                        <Close sx={{ fontSize: 14 }} />
                      </IconButton>
                    </Box>
                    {notaAbierta === it.producto_id && (
                      <Box sx={{ px: 1, pb: 0.8 }}>
                        <TextField autoFocus size="small" fullWidth
                          placeholder="Ej: sin sal, sin cebolla..."
                          value={it.notas || ''}
                          onChange={e => updateNota(it.producto_id, e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') setNotaAbierta(null); }}
                          sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5, fontSize: 12 } }}
                        />
                      </Box>
                    )}
                    {it.notas && notaAbierta !== it.producto_id && (
                      <Box sx={{ px: 1, pb: 0.5 }}>
                        <Typography fontSize={11} sx={{ color: '#F59E0B', fontStyle: 'italic' }}>📝 {it.notas}</Typography>
                      </Box>
                    )}
                  </Box>
                ))}
              </Stack>
            </Box>
          </Collapse>

          {/* Botón enviar — siempre visible */}
          <Box sx={{ px: 1.5, pb: 1.5, pt: 0.5 }}>
            <Button fullWidth variant="contained" onClick={handleEnviarCocina} disabled={loading}
              startIcon={loading ? <CircularProgress size={15} color="inherit" /> : <Send />}
              sx={{ borderRadius: 2, fontWeight: 800, fontSize: 14, py: 1.1, bgcolor: '#059669', '&:hover': { bgcolor: '#047857' } }}>
              Enviar {selectedItems.reduce((a, i) => a + i.cantidad, 0)} ítem(s) a cocina
            </Button>
          </Box>
        </Box>
      )}
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <Box sx={{ px: 2, py: 1.5, display: 'flex', alignItems: 'center', gap: 1.5, borderBottom: `1px solid ${theme.palette.divider}`, flexShrink: 0 }}>
        <Avatar sx={{ bgcolor: alpha('#F59E0B', 0.12), width: 38, height: 38, flexShrink: 0 }}>
          <TableRestaurant sx={{ color: '#F59E0B', fontSize: 19 }} />
        </Avatar>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
            <Typography fontWeight={800} fontSize={15} noWrap>Mesa {mesa.numero}{mesa.nombre ? ` — ${mesa.nombre}` : ''}</Typography>
            {comanda.origen === 'autoservicio' && (
              <Chip label="📱 Pedido del cliente" size="small"
                sx={{ fontSize: 10, height: 19, fontWeight: 800, bgcolor: alpha('#7C3AED', 0.15), color: '#7C3AED' }} />
            )}
          </Box>
          <Typography fontSize={12} color="text.secondary" noWrap>
            Comanda #{comanda.numero_comanda} · {comanda.personas} persona{comanda.personas !== 1 ? 's' : ''} · {timeAgo(comanda.fecha_apertura)}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
          <Chip label={fmt(comanda.total)} size="small"
            sx={{ fontWeight: 900, bgcolor: alpha('#FF6020', 0.1), color: '#FF6020', fontSize: 12 }} />
          <Tooltip title="Imprimir comanda">
            <IconButton size="small" onClick={handleImprimirManual}><Print fontSize="small" /></IconButton>
          </Tooltip>
          <IconButton size="small" onClick={onClose}><Close fontSize="small" /></IconButton>
        </Box>
      </Box>

      {/* Tabs — solo en móvil */}
      {isMobile && (
        <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="fullWidth"
          sx={{
            flexShrink: 0,
            borderBottom: `1px solid ${theme.palette.divider}`,
            '& .MuiTab-root': { textTransform: 'none', fontWeight: 600, fontSize: 13, minHeight: 44 },
            '& .Mui-selected': { color: '#FF6020 !important' },
            '& .MuiTabs-indicator': { bgcolor: '#FF6020' },
          }}>
          <Tab label={`Pedido${itemsActivos.length > 0 ? ` (${itemsActivos.length})` : ''}`}
            icon={<Receipt sx={{ fontSize: 16 }} />} iconPosition="start" />
          <Tab label={`Menú${selectedItems.length > 0 ? ` +${selectedItems.reduce((a, i) => a + i.cantidad, 0)}` : ''}`}
            icon={<MenuBook sx={{ fontSize: 16 }} />} iconPosition="start" />
        </Tabs>
      )}

      {/* Body */}
      {isMobile ? (
        // ── MÓVIL: una pestaña a la vez ──────────────────────────────────────
        <Box sx={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {tab === 0 && PedidoContent}
          {tab === 1 && MenuContent}
        </Box>
      ) : (
        // ── DESKTOP: split view ───────────────────────────────────────────────
        <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          <Box sx={{ flex: 1, overflow: 'hidden', borderRight: `1px solid ${theme.palette.divider}` }}>
            {PedidoContent}
          </Box>

          {/* Panel derecho: buscador + lista dividida + carrito */}
          <Box sx={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

            {/* Buscador */}
            <Box sx={{ p: 1.5, borderBottom: `1px solid ${theme.palette.divider}`, flexShrink: 0 }}>
              <TextField size="small" fullWidth placeholder="Buscar en el menú..."
                value={search} onChange={e => setSearch(e.target.value)}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2, fontSize: 13 } }} />
            </Box>

            {/* Lista de productos */}
            <Box sx={{ flex: 1, overflowY: 'auto', p: 1.5 }}>
              {productosFiltrados.length === 0 ? (
                <Typography fontSize={12} color="text.disabled" textAlign="center" sx={{ mt: 3 }}>
                  Sin productos
                </Typography>
              ) : (
                <Stack spacing={0.5}>
                  {groupedByCategory.map(({ categoria, prods }) => {
                    const open = isCategoryExpanded(categoria);
                    return (
                      <Box key={categoria}>
                        {/* Category header */}
                        <Box
                          onClick={() => toggleCategory(categoria)}
                          sx={{
                            display: 'flex', alignItems: 'center', gap: 0.8,
                            px: 1, py: 0.6, borderRadius: 2, cursor: 'pointer', mb: 0.5,
                            bgcolor: isDark ? alpha('#FF6020', 0.08) : alpha('#FF6020', 0.06),
                            '&:hover': { bgcolor: alpha('#FF6020', 0.12) },
                          }}
                        >
                          <Typography fontSize={10} fontWeight={800} color="#FF6020" textTransform="uppercase"
                            letterSpacing={0.8} sx={{ flex: 1 }}>
                            {categoria}
                          </Typography>
                          <Typography fontSize={9} color="text.disabled" sx={{ mr: 0.5 }}>{prods.length}</Typography>
                          {open ? <ExpandLess sx={{ fontSize: 14, color: '#FF6020' }} /> : <ExpandMore sx={{ fontSize: 14, color: '#FF6020' }} />}
                        </Box>
                        {/* Products */}
                        {open && (
                          <Stack spacing={0.7} sx={{ mb: 0.5 }}>
                            {prods.map(prod => {
                              const imgSrc = Array.isArray(prod.imagenes) && prod.imagenes.length > 0 ? prod.imagenes[0] : null;
                              return (
                                <Box key={prod.id}
                                  onClick={() => addToSelected(prod)}
                                  sx={{
                                    display: 'flex', gap: 1, alignItems: 'flex-start',
                                    p: 1.2, borderRadius: 2, cursor: 'pointer',
                                    border: `1px solid ${alpha(theme.palette.divider, 1)}`,
                                    bgcolor: isDark ? alpha('#fff', 0.025) : alpha('#000', 0.02),
                                    transition: 'all 0.15s',
                                    '&:hover': { borderColor: '#FF6020', bgcolor: alpha('#FF6020', 0.04) },
                                    '&:active': { transform: 'scale(0.98)' },
                                  }}
                                >
                                  {imgSrc ? (
                                    <Box sx={{ width: 38, height: 38, borderRadius: 1.5, overflow: 'hidden', flexShrink: 0 }}>
                                      <img src={imgSrc} alt={prod.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                                    </Box>
                                  ) : (
                                    <Box sx={{ width: 38, height: 38, borderRadius: 1.5, bgcolor: alpha('#FF6020', 0.12), display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                      <Typography sx={{ fontSize: 17, fontWeight: 800, color: '#FF6020', opacity: 0.7 }}>
                                        {(prod.nombre || '?')[0].toUpperCase()}
                                      </Typography>
                                    </Box>
                                  )}
                                  <Box sx={{ flex: 1, minWidth: 0 }}>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                      <Typography fontSize={12.5} fontWeight={600} sx={{ flex: 1, mr: 0.5 }}>{prod.nombre}</Typography>
                                      <Typography fontSize={12} fontWeight={700} color="#FF6020" sx={{ flexShrink: 0 }}>
                                        {fmt(prod.precio)}
                                      </Typography>
                                    </Box>
                                    {prod.descripcion && (
                                      <Typography fontSize={10} color="text.secondary" sx={{ mt: 0.3, lineHeight: 1.4 }}>
                                        {prod.descripcion}
                                      </Typography>
                                    )}
                                  </Box>
                                </Box>
                              );
                            })}
                          </Stack>
                        )}
                      </Box>
                    );
                  })}
                </Stack>
              )}
            </Box>

            {/* Carrito — ítems seleccionados para enviar */}
            {selectedItems.length > 0 && (
              <Box sx={{
                flexShrink: 0,
                bgcolor: theme.palette.background.paper,
                borderTop: `2px solid ${alpha('#059669', 0.3)}`,
                boxShadow: '0 -4px 20px rgba(0,0,0,0.10)',
              }}>
                {/* Cabecera: resumen + toggle */}
                <Box
                  onClick={() => setCartExpanded(e => !e)}
                  sx={{
                    display: 'flex', alignItems: 'center', gap: 1,
                    px: 1.5, py: 0.8, cursor: 'pointer',
                    '&:hover': { bgcolor: alpha('#059669', 0.04) },
                  }}
                >
                  <Box sx={{
                    width: 20, height: 20, borderRadius: '50%',
                    bgcolor: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <Typography fontSize={10} fontWeight={800} sx={{ color: '#fff' }}>
                      {selectedItems.reduce((a, i) => a + i.cantidad, 0)}
                    </Typography>
                  </Box>
                  <Typography fontSize={11} fontWeight={700} color="#059669" sx={{ flex: 1 }}>
                    ítem{selectedItems.reduce((a, i) => a + i.cantidad, 0) !== 1 ? 's' : ''} en el pedido
                  </Typography>
                  {cartExpanded
                    ? <ExpandLess sx={{ fontSize: 16, color: '#059669' }} />
                    : <ExpandMore sx={{ fontSize: 16, color: '#059669' }} />
                  }
                </Box>

                {/* Lista desplegable de ítems */}
                <Collapse in={cartExpanded}>
                  <Box sx={{ maxHeight: 180, overflowY: 'auto', px: 1.5, pb: 0.5 }}>
                    <Stack spacing={0.6}>
                      {selectedItems.map(it => (
                        <Box key={it.producto_id} sx={{
                          borderRadius: 2,
                          border: `1px solid ${alpha('#059669', notaAbierta === it.producto_id ? 0.5 : 0.15)}`,
                          bgcolor: alpha('#059669', 0.04), overflow: 'hidden',
                        }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 1, py: 0.6 }}>
                            <Typography fontSize={12} fontWeight={600} sx={{ flex: 1, minWidth: 0 }} noWrap>
                              {it.nombre_producto}
                            </Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3, flexShrink: 0 }}>
                              <IconButton size="small" onClick={e => { e.stopPropagation(); updateCantidad(it.producto_id, -1); }}
                                sx={{ width: 22, height: 22, bgcolor: alpha('#000', 0.06), borderRadius: 1, p: 0 }}>
                                <Typography fontSize={15} lineHeight={1} sx={{ userSelect: 'none' }}>−</Typography>
                              </IconButton>
                              <Typography fontSize={12} fontWeight={700} sx={{ minWidth: 18, textAlign: 'center' }}>
                                {it.cantidad}
                              </Typography>
                              <IconButton size="small" onClick={e => { e.stopPropagation(); updateCantidad(it.producto_id, 1); }}
                                sx={{ width: 22, height: 22, bgcolor: alpha('#059669', 0.12), borderRadius: 1, p: 0 }}>
                                <Typography fontSize={15} lineHeight={1} sx={{ color: '#059669', userSelect: 'none' }}>+</Typography>
                              </IconButton>
                            </Box>
                            <Tooltip title={it.notas ? `Nota: ${it.notas}` : 'Agregar nota'}>
                              <IconButton size="small"
                                onClick={e => { e.stopPropagation(); setNotaAbierta(n => n === it.producto_id ? null : it.producto_id); }}
                                sx={{ p: 0.3, color: it.notas ? '#F59E0B' : 'text.disabled' }}>
                                <Note sx={{ fontSize: 15 }} />
                              </IconButton>
                            </Tooltip>
                            <IconButton size="small" onClick={e => { e.stopPropagation(); removeSelected(it.producto_id); }}
                              sx={{ p: 0.3, color: '#EF4444' }}>
                              <Close sx={{ fontSize: 13 }} />
                            </IconButton>
                          </Box>
                          {notaAbierta === it.producto_id && (
                            <Box sx={{ px: 1, pb: 0.8 }}>
                              <TextField autoFocus size="small" fullWidth placeholder="Nota para cocina..."
                                value={it.notas || ''} onChange={e => updateNota(it.producto_id, e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') setNotaAbierta(null); }}
                                sx={{ '& .MuiOutlinedInput-root': { fontSize: 12, borderRadius: 1.5 } }} />
                            </Box>
                          )}
                          {it.notas && notaAbierta !== it.producto_id && (
                            <Box sx={{ px: 1, pb: 0.5 }}>
                              <Typography fontSize={10} sx={{ color: '#F59E0B', fontStyle: 'italic' }}>📝 {it.notas}</Typography>
                            </Box>
                          )}
                        </Box>
                      ))}
                    </Stack>
                  </Box>
                </Collapse>

                {/* Botón enviar — siempre visible */}
                <Box sx={{ px: 1.5, pb: 1.2, pt: 0.5 }}>
                  <Button fullWidth variant="contained" onClick={handleEnviarCocina} disabled={loading}
                    startIcon={loading ? <CircularProgress size={14} color="inherit" /> : <Send />}
                    sx={{ borderRadius: 2, fontWeight: 800, fontSize: 13, py: 0.9, bgcolor: '#059669', '&:hover': { bgcolor: '#047857' } }}>
                    Enviar {selectedItems.reduce((a, i) => a + i.cantidad, 0)} ítem(s) a cocina
                  </Button>
                </Box>
              </Box>
            )}
          </Box>
        </Box>
      )}

      {/* ── Recibo de venta — mismo componente que el módulo de Ventas ── */}
      <ReciboDialog
        open={reciboOpen}
        onClose={() => { setReciboOpen(false); setReciboVenta(null); onClose(); }}
        venta={reciboVenta}
        empresa={empresa}
        vendedor={vendedor}
      />

      {/* ── Link de Pago / QR modal ── */}
      {linkPagoConfig && (
        <LinkPagoModal
          open={linkPagoModalOpen}
          onClose={() => { setLinkPagoModalOpen(false); pendingCerrarRef.current = false; }}
          linkConfig={linkPagoConfig}
          onConfirm={() => {
            setLinkPagoModalOpen(false);
            pendingCerrarRef.current = false;
            doCerrarCuenta();
          }}
        />
      )}

    </Box>
  );
};

// ─── MesaCard (visual tile en el mapa) ───────────────────────────────────────

const MesaCard = ({ mesa, onClick }) => {
  const theme = useTheme();
  const cfg = ESTADO_MESA[mesa.estado] || ESTADO_MESA.libre;
  const comanda = mesa.comanda_activa;
  const itemsPendientes = comanda?.items?.filter(i => i.estado === 'pendiente').length || 0;
  const itemsListos = comanda?.items?.filter(i => i.estado === 'listo').length || 0;
  const tiempoAbierta = comanda ? timeAgo(comanda.fecha_apertura) : null;
  const esAutoservicio = comanda?.origen === 'autoservicio';

  return (
    <Box
      onClick={onClick}
      sx={{
        width: 130, minHeight: 110,
        borderRadius: 3, cursor: 'pointer',
        border: `2px solid ${cfg.color}`,
        bgcolor: cfg.bg,
        p: 1.5, display: 'flex', flexDirection: 'column',
        transition: 'all 0.2s',
        '&:hover': { transform: 'translateY(-3px)', boxShadow: `0 8px 24px ${alpha(cfg.color, 0.25)}` },
        position: 'relative',
      }}
    >
      {/* Badges de alertas */}
      {itemsListos > 0 && (
        <Box sx={{
          position: 'absolute', top: -8, right: -8,
          width: 22, height: 22, borderRadius: '50%',
          bgcolor: '#059669', color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 10, fontWeight: 900,
          boxShadow: `0 2px 8px ${alpha('#059669', 0.5)}`,
          '@keyframes pop': { '0%,100%': { transform: 'scale(1)' }, '50%': { transform: 'scale(1.15)' } },
          animation: 'pop 1.5s ease-in-out infinite',
        }}>
          {itemsListos}
        </Box>
      )}
      {itemsPendientes > 0 && (
        <Box sx={{
          position: 'absolute', top: -8, left: -8,
          width: 22, height: 22, borderRadius: '50%',
          bgcolor: '#F59E0B', color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 10, fontWeight: 900,
        }}>
          {itemsPendientes}
        </Box>
      )}

      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
        <Typography fontWeight={900} fontSize={20} color={cfg.color}>{mesa.numero}</Typography>
        <Chip label={cfg.label} size="small"
          sx={{ fontSize: 9, height: 18, fontWeight: 700, bgcolor: alpha(cfg.color, 0.15), color: cfg.color, px: 0.2 }} />
      </Box>

      {mesa.nombre && (
        <Typography fontSize={10} color="text.secondary" noWrap mb={0.3}>{mesa.nombre}</Typography>
      )}

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4, mb: 0.5 }}>
        <Person sx={{ fontSize: 11, color: 'text.disabled' }} />
        <Typography fontSize={10} color="text.disabled">{mesa.capacidad} sillas</Typography>
      </Box>

      {comanda && (
        <>
          <Typography fontSize={10} color="text.secondary">{tiempoAbierta}</Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 0.3 }}>
            <Typography fontSize={11} fontWeight={800} color="#FF6020">
              {fmt(comanda.total)}
            </Typography>
            {esAutoservicio && (
              <Chip label="📱 Cliente" size="small"
                sx={{ fontSize: 8, height: 16, fontWeight: 800, bgcolor: alpha('#7C3AED', 0.15), color: '#7C3AED', px: 0.2 }} />
            )}
          </Box>
        </>
      )}
    </Box>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

export default function MapaMesas({ user }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isDark = theme.palette.mode === 'dark';

  const [mesas, setMesas] = useState([]);
  const [productos, setProductos] = useState([]);
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [mesaSeleccionada, setMesaSeleccionada] = useState(null);
  const [panelMode, setPanelMode] = useState(null);  // 'abrir' | 'comanda'
  const [zonaFiltro, setZonaFiltro] = useState('todas');
  const [vistaPlano, setVistaPlano] = useState(() => localStorage.getItem('mapaMesas_vista') === 'plano');
  const [turnoOpen, setTurnoOpen]   = useState(false);

  const empresa = user?.empresa || null;
  const vendedor = user ? (user.nombre_completo || user.username || user.email) : '';

  const fetchAll = useCallback(async (silent = false) => {
    if (!silent) setLoading(true); else setRefreshing(true);
    try {
      const [mRes, pRes, cRes] = await Promise.all([
        apiClient.get('/restaurante/mesas'),
        apiClient.get('/productos/', { params: { limit: 500, solo_pos: true } }),
        apiClient.get('/restaurante/config'),
      ]);
      setMesas(mRes.data);
      setProductos(pRes.data.filter ? pRes.data.filter(p => p.precio > 0) : pRes.data);
      setConfig(cRes.data);
    } catch {
      toast.error('Error al cargar el mapa de mesas');
    } finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);
  // Refresco automático cada 15s; se pausa si la pestaña está oculta o hay
  // un panel abierto (para no desmontar el recibo mientras el usuario lo revisa).
  usePolling(() => fetchAll(true), 15_000, { enabled: !mesaSeleccionada && !config?.imprimir_comanda_auto });

  // ── Vigilancia de comandas de autoservicio (catálogo) ─────────────────────
  // Solo activo cuando imprimir_comanda_auto está ON.
  // Cada 8s consulta comandas nuevas con mesero_id=null y dispara impresión
  // automática en el dispositivo del restaurante por cada una no vista aún.
  const autoservicioDesdeRef = useRef(new Date().toISOString());
  const autoservicioImpresosRef = useRef(new Set());

  const checkAutoservicio = useCallback(async () => {
    if (!config?.imprimir_comanda_auto) return;
    try {
      const res = await apiClient.get('/restaurante/comandas', {
        params: {
          autoservicio: true,
          estado: 'enviada',
          desde: autoservicioDesdeRef.current,
        },
      });
      const nuevas = res.data.filter(c => !autoservicioImpresosRef.current.has(c.id));
      for (const comanda of nuevas) {
        autoservicioImpresosRef.current.add(comanda.id);
        const itemsParaImprimir = (comanda.items || []).filter(i => i.estado !== 'cancelado');
        if (itemsParaImprimir.length === 0) continue;
        imprimirComanda({
          mesa: { numero: comanda.mesa_numero, zona: comanda.mesa_zona, nombre: null },
          comanda: { numero_comanda: comanda.numero_comanda, personas: comanda.personas },
          items: itemsParaImprimir,
          empresaNombre: empresa?.nombre || '',
          nombreMesero: 'Autoservicio (catálogo)',
          titulo: 'COMANDA — AUTOSERVICIO',
          printerSize: config?.tipo_impresora || 'p80',
        });
        toast.info(`📱 Mesa ${comanda.mesa_numero} — pedido desde catálogo (imprimiendo)`);
      }
      // Avanzar el cursor al timestamp más reciente procesado
      if (nuevas.length > 0) {
        autoservicioDesdeRef.current = nuevas[0].fecha_apertura || new Date().toISOString();
        fetchAll(true); // refrescar mapa para mostrar la mesa como ocupada
      }
    } catch { /* silencioso — es vigilancia de fondo */ }
  }, [config, empresa, fetchAll]);

  usePolling(checkAutoservicio, 8_000, { enabled: !!config?.imprimir_comanda_auto });

  const handleMesaClick = (mesa) => {
    setMesaSeleccionada(mesa);
    setPanelMode(mesa.estado === 'libre' ? 'abrir' : 'comanda');
  };

  const handleSuccess = () => {
    fetchAll(true);
    // Si la mesa seleccionada cambió, refrescar su data
    setMesaSeleccionada(null);
    setPanelMode(null);
  };

  const zonas = ['todas', ...new Set(mesas.map(m => m.zona).filter(Boolean))];
  const mesasFiltradas = zonaFiltro === 'todas' ? mesas : mesas.filter(m => m.zona === zonaFiltro);

  const countPorEstado = (estado) => mesas.filter(m => m.estado === estado).length;

  if (loading) return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
      <CircularProgress sx={{ color: '#FF6020' }} />
    </Box>
  );

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, bgcolor: 'background.default', minHeight: '100vh' }}>

      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2.5, flexWrap: 'wrap', gap: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Avatar sx={{ bgcolor: alpha('#F59E0B', 0.12), width: 46, height: 46 }}>
            <TableRestaurant sx={{ color: '#F59E0B', fontSize: 24 }} />
          </Avatar>
          <Box>
            <Typography variant="h6" fontWeight={900} lineHeight={1.1}>Mapa de Mesas</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, mt: 0.2 }}>
              <FiberManualRecord sx={{ fontSize: 8, color: refreshing ? '#F59E0B' : '#10B981',
                '@keyframes pulse': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.4 } },
                animation: 'pulse 2s ease-in-out infinite' }} />
              <Typography fontSize={11} color="text.secondary">
                {mesas.length} mesas · {countPorEstado('libre')} libres · {countPorEstado('ocupada')} ocupadas
              </Typography>
            </Box>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title={vistaPlano ? 'Vista cuadrícula' : 'Vista plano'}>
            <IconButton
              onClick={() => setVistaPlano(v => {
                const next = !v;
                localStorage.setItem('mapaMesas_vista', next ? 'plano' : 'lista');
                return next;
              })}
              sx={{ border: `1px solid ${theme.palette.divider}`, borderRadius: 2 }}
            >
              {vistaPlano ? <ViewModule fontSize="small" /> : <MapIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
          <Tooltip title="Resumen del turno">
            <IconButton
              onClick={() => setTurnoOpen(true)}
              sx={{ border: `1px solid ${theme.palette.divider}`, borderRadius: 2 }}
            >
              <WifiProtectedSetup fontSize="small" />
            </IconButton>
          </Tooltip>
          <Button variant="outlined" startIcon={refreshing ? <CircularProgress size={14} /> : <Refresh />}
            onClick={() => fetchAll(false)} disabled={refreshing}
            sx={{ borderRadius: 2, fontWeight: 600, fontSize: 12 }}>
            Actualizar
          </Button>
        </Box>
      </Box>

      {/* Filtro zonas */}
      {zonas.length > 1 && (
        <Box sx={{ display: 'flex', gap: 0.8, mb: 2.5, flexWrap: 'wrap' }}>
          {zonas.map(z => (
            <Chip key={z} label={z === 'todas' ? 'Todas las zonas' : z}
              onClick={() => setZonaFiltro(z)}
              sx={{
                fontWeight: zonaFiltro === z ? 800 : 500, cursor: 'pointer',
                bgcolor: zonaFiltro === z ? '#FF6020' : alpha(theme.palette.divider, 1),
                color: zonaFiltro === z ? '#fff' : 'text.secondary',
                '&:hover': { bgcolor: zonaFiltro === z ? '#E8531A' : alpha('#FF6020', 0.1) },
              }} />
          ))}
        </Box>
      )}

      {/* Mapa de mesas */}
      {mesas.length === 0 ? (
        <Paper elevation={0} sx={{ p: 6, textAlign: 'center', borderRadius: 4, border: `1px dashed ${alpha(theme.palette.divider, 1)}` }}>
          <TableRestaurant sx={{ fontSize: 56, opacity: 0.15, mb: 2 }} />
          <Typography fontWeight={800} fontSize={16} mb={0.5}>Sin mesas configuradas</Typography>
          <Typography fontSize={13} color="text.secondary" mb={3} maxWidth={320} mx="auto">
            Configura las mesas del restaurante desde Restaurante → Configuración.
          </Typography>
        </Paper>
      ) : vistaPlano && mesasFiltradas.some(m => m.pos_x != null && m.pos_y != null) ? (
        /* ── Vista Plano ── */
        <Paper elevation={0} sx={{
          position: 'relative',
          width: '100%',
          minHeight: 520,
          borderRadius: 3,
          border: `1.5px dashed ${alpha(theme.palette.divider, 1)}`,
          bgcolor: isDark ? alpha('#fff', 0.02) : alpha('#000', 0.015),
          overflow: 'auto',
        }}>
          <Box sx={{ position: 'relative', width: 900, height: 600, m: 'auto' }}>
            {mesasFiltradas.map(mesa => {
              const x = mesa.pos_x ?? 0;
              const y = mesa.pos_y ?? 0;
              const est = ESTADO_MESA[mesa.estado] || ESTADO_MESA.libre;
              return (
                <Tooltip key={mesa.id} title={`${mesa.nombre || `Mesa ${mesa.numero}`} · ${est.label}`} arrow>
                  <Box
                    onClick={() => handleMesaClick(mesa)}
                    sx={{
                      position: 'absolute',
                      left: `${x}%`,
                      top: `${y}%`,
                      transform: 'translate(-50%, -50%)',
                      width: 72,
                      height: 72,
                      borderRadius: mesa.forma === 'redonda' ? '50%' : 2.5,
                      border: `2.5px solid ${est.color}`,
                      bgcolor: est.bg,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      transition: 'transform 0.15s, box-shadow 0.15s',
                      '&:hover': { transform: 'translate(-50%, -50%) scale(1.1)', boxShadow: `0 0 0 3px ${alpha(est.color, 0.35)}` },
                    }}
                  >
                    <Typography sx={{ fontSize: 16, fontWeight: 900, color: est.color, lineHeight: 1 }}>
                      {mesa.numero}
                    </Typography>
                    {mesa.comanda_activa && (
                      <Typography sx={{ fontSize: 9, color: est.color, fontWeight: 700 }}>
                        {fmt(mesa.comanda_activa.total)}
                      </Typography>
                    )}
                  </Box>
                </Tooltip>
              );
            })}
          </Box>
          <Typography sx={{ position: 'absolute', bottom: 8, right: 12, fontSize: 10, color: 'text.disabled' }}>
            Configura las posiciones en Configuración → Mesas
          </Typography>
        </Paper>
      ) : (
        /* ── Vista Cuadrícula ── */
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
          {mesasFiltradas.map(mesa => (
            <MesaCard key={mesa.id} mesa={mesa} onClick={() => handleMesaClick(mesa)} />
          ))}
        </Box>
      )}

      {/* Dialog: Abrir mesa libre */}
      {mesaSeleccionada && panelMode === 'abrir' && (
        <AbrirComandaDialog
          open
          mesa={mesaSeleccionada}
          onClose={() => { setMesaSeleccionada(null); setPanelMode(null); }}
          onSuccess={handleSuccess}
        />
      )}

      {/* Dialog: Gestionar comanda activa */}
      {(() => {
        // Derivar la mesa desde el estado vivo para que los re-renders
        // tras fetchAll reflejen los ítems nuevos sin cerrar el dialog
        const mesaActual = mesaSeleccionada
          ? (mesas.find(m => m.id === mesaSeleccionada.id) || mesaSeleccionada)
          : null;
        if (!mesaActual || panelMode !== 'comanda' || !mesaActual.comanda_activa) return null;
        return (
          <Dialog
            open fullWidth maxWidth="md"
            fullScreen={isMobile}
            PaperProps={{ sx: { borderRadius: isMobile ? 0 : 4, overflow: 'hidden', height: isMobile ? '100%' : '88vh' } }}
            onClose={() => { setMesaSeleccionada(null); setPanelMode(null); fetchAll(true); }}
          >
            <ComandaPanel
              mesa={mesaActual}
              comanda={mesaActual.comanda_activa}
              productos={productos}
              config={config}
              empresa={empresa}
              vendedor={vendedor}
              onClose={() => { setMesaSeleccionada(null); setPanelMode(null); fetchAll(true); }}
              onSuccess={() => fetchAll(true)}
            />
          </Dialog>
        );
      })()}
      <ResumenTurno open={turnoOpen} onClose={() => setTurnoOpen(false)} />
    </Box>
  );
}
