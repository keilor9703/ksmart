import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box, Paper, Typography, Grid, TextField, Button, Chip, Stack,
  IconButton, Divider, Autocomplete, CircularProgress,
  Tooltip, InputAdornment, Dialog, DialogTitle, DialogContent,
  DialogActions, ToggleButtonGroup, ToggleButton, Badge, alpha,
  Table, TableHead, TableRow, TableCell, TableBody, TableContainer,
  Tabs, Tab, Switch, FormControlLabel,
} from '@mui/material';
import {
  DirectionsCar, Add, Remove, DeleteOutline, LocalCarWash,
  TwoWheeler, LocalShipping, DriveEta, ClearAll, Notes,
  Refresh, AccessTime, AttachMoney, CheckCircle, PlayArrow,
  Done, Close, Person, WhatsApp, Print, Storefront, QrCode2, Stars,
  History, PictureAsPdf, ContentCopy, Search, Replay,
} from '@mui/icons-material';
import { toast } from 'react-toastify';
import apiClient from '../../api';
import { formatCurrency } from '../../utils/formatters';
import HelpGuideTopBar from '../../components/onboarding/HelpGuideTopBar';
import { METODOS_PAGO_SIMPLE as METODOS_PAGO } from '../../utils/constants';
import { imprimirReciboLavadero } from '../../utils/printLavadero';
import LinkPagoModal from '../../components/common/LinkPagoModal';
import CurrencyField from '../../components/common/CurrencyField';

const ACCENT  = '#FF6020';
const BLUE    = '#3B82F6';
const AMBER   = '#F59E0B';
const GREEN   = '#10B981';
const RED     = '#EF4444';

const TIPOS_VEHICULO = [
  { label: 'Carro',         icon: DirectionsCar  },
  { label: 'Moto',          icon: TwoWheeler     },
  { label: 'SUV/Camioneta', icon: LocalShipping  },
  { label: 'Otro',          icon: DriveEta       },
];

const ESTADOS_TABLERO = [
  { key: 'recibido',  label: 'Recibido',  color: BLUE,  bg: '#EFF6FF', nextKey: 'lavando',   nextLabel: 'Iniciar lavado',    NextIcon: PlayArrow },
  { key: 'lavando',   label: 'Lavando',   color: AMBER, bg: '#FFFBEB', nextKey: 'terminado', nextLabel: 'Marcar terminado',  NextIcon: Done      },
  { key: 'terminado', label: 'Terminado', color: GREEN, bg: '#ECFDF5', nextKey: null,         nextLabel: null,               NextIcon: null      },
];

const formatPlaca = (raw) => {
  const clean = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (clean.length > 3) return `${clean.slice(0, 3)}-${clean.slice(3, 7)}`;
  return clean;
};

const getElapsed = (fechaEntrada) => {
  const ms = Date.now() - new Date(fechaEntrada).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return '< 1 min';
  if (mins < 60) return `${mins} min`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem > 0 ? `${hrs}h ${rem}m` : `${hrs}h`;
};

const SectionLabel = ({ children }) => (
  <Typography sx={{ fontWeight: 700, fontSize: 11, mb: 1.2, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.8 }}>
    {children}
  </Typography>
);

/* ── Tarjeta de orden en el tablero ─────────────────────────────────────── */
function OrdenCard({ orden, estadoConfig, onEstadoChange, onCobrar, trabajadores }) {
  const TipoIcon = TIPOS_VEHICULO.find(t => t.label === orden.tipo_vehiculo)?.icon ?? DirectionsCar;
  const [cambiandoLavador, setCambiandoLavador] = useState(false);
  const [nuevoLavadorObj, setNuevoLavadorObj] = useState(null);
  const [confirmandoCambio, setConfirmandoCambio] = useState(false);

  const handleIniciarLavado = () => {
    // Si es recibido → lavando, ofrecer cambio de lavador
    if (estadoConfig.key === 'recibido') {
      setNuevoLavadorObj(null);
      setConfirmandoCambio(true);
    } else {
      onEstadoChange(orden.id, estadoConfig.nextKey);
    }
  };

  const handleConfirmarInicio = async () => {
    setConfirmandoCambio(false);
    if (nuevoLavadorObj) {
      // Cambiar lavador y avanzar estado
      await onEstadoChange(orden.id, estadoConfig.nextKey, nuevoLavadorObj.id);
    } else {
      await onEstadoChange(orden.id, estadoConfig.nextKey);
    }
    setNuevoLavadorObj(null);
  };

  return (
    <>
    <Paper
      elevation={0}
      sx={{
        borderRadius: 2.5, border: `1.5px solid ${estadoConfig.color}30`,
        bgcolor: estadoConfig.bg, mb: 1.5, overflow: 'hidden',
        transition: 'box-shadow 0.15s',
        '&:hover': { boxShadow: `0 2px 12px ${estadoConfig.color}20` },
      }}
    >
      <Box sx={{ height: 3, bgcolor: estadoConfig.color }} />
      <Box sx={{ p: 1.8 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.8 }}>
          <Typography sx={{ fontSize: 20, fontWeight: 900, letterSpacing: 2, color: estadoConfig.color }}>
            {orden.placa}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'text.secondary' }}>
            <TipoIcon sx={{ fontSize: 16 }} />
            <Typography sx={{ fontSize: 11 }}>{orden.tipo_vehiculo || '—'}</Typography>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
          {(orden.detalles || []).map((d, i) => (
            <Chip
              key={i}
              label={d.cantidad > 1 ? `${d.nombre_servicio} x${d.cantidad}` : d.nombre_servicio}
              size="small"
              sx={{ fontSize: 10, height: 20, bgcolor: `${estadoConfig.color}15`, color: estadoConfig.color, fontWeight: 600 }}
            />
          ))}
        </Box>

        {/* Lavador y cliente */}
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 0.8 }}>
          {orden.operador_nombre && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4,
              bgcolor: `${BLUE}12`, px: 1, py: 0.3, borderRadius: 1 }}>
              <Person sx={{ fontSize: 12, color: BLUE }} />
              <Typography sx={{ fontSize: 11, fontWeight: 600, color: BLUE }}>{orden.operador_nombre}</Typography>
            </Box>
          )}
          {orden.cliente_nombre && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4,
              bgcolor: `${GREEN}12`, px: 1, py: 0.3, borderRadius: 1 }}>
              <Person sx={{ fontSize: 12, color: GREEN }} />
              <Typography sx={{ fontSize: 11, fontWeight: 600, color: GREEN }}>{orden.cliente_nombre}</Typography>
            </Box>
          )}
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 0.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4 }}>
            <AccessTime sx={{ fontSize: 12, color: 'text.disabled' }} />
            <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{getElapsed(orden.fecha_entrada)}</Typography>
          </Box>
          <Typography sx={{ fontWeight: 700, fontSize: 13 }}>{formatCurrency(orden.total || 0)}</Typography>
        </Box>

        {orden.observaciones && (
          <Typography sx={{ fontSize: 11, color: 'text.secondary', mt: 0.8, fontStyle: 'italic' }}>
            "{orden.observaciones}"
          </Typography>
        )}

        <Box sx={{ mt: 1.5, display: 'flex', gap: 1 }}>
          {estadoConfig.nextKey && (
            <Button
              size="small" fullWidth variant="contained"
              startIcon={<estadoConfig.NextIcon sx={{ fontSize: 14 }} />}
              onClick={handleIniciarLavado}
              sx={{
                bgcolor: estadoConfig.color, '&:hover': { filter: 'brightness(0.9)' },
                fontWeight: 700, fontSize: 11, textTransform: 'none', borderRadius: 1.5, py: 0.8,
              }}
            >
              {estadoConfig.nextLabel}
            </Button>
          )}
          {orden.estado === 'terminado' && (
            <Button
              size="small" fullWidth variant="contained"
              startIcon={<AttachMoney sx={{ fontSize: 14 }} />}
              onClick={() => onCobrar(orden)}
              sx={{
                bgcolor: GREEN, '&:hover': { filter: 'brightness(0.9)' },
                fontWeight: 700, fontSize: 11, textTransform: 'none', borderRadius: 1.5, py: 0.8,
              }}
            >
              Cobrar
            </Button>
          )}
        </Box>
      </Box>
    </Paper>

    {/* Diálogo: cambiar lavador al iniciar */}
    <Dialog open={confirmandoCambio} onClose={() => setConfirmandoCambio(false)} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 800, fontSize: 16 }}>Iniciar lavado — {orden.placa}</DialogTitle>
      <DialogContent>
        <Typography sx={{ fontSize: 13, color: 'text.secondary', mb: 2 }}>
          Lavador asignado: <strong>{orden.operador_nombre || 'Sin asignar'}</strong>
        </Typography>
        <Typography sx={{ fontSize: 13, mb: 1.5 }}>
          ¿Deseas cambiar el lavador antes de iniciar?
        </Typography>
        <Autocomplete
          size="small"
          options={trabajadores || []}
          getOptionLabel={t => t.nombre_completo || t.username}
          value={nuevoLavadorObj}
          onChange={(_, v) => setNuevoLavadorObj(v)}
          renderInput={params => <TextField {...params} label="Cambiar lavador (opcional)" />}
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
        <Button onClick={() => setConfirmandoCambio(false)} variant="outlined"
          sx={{ borderRadius: 2, borderColor: 'divider', color: 'text.secondary' }}>
          Cancelar
        </Button>
        <Button onClick={handleConfirmarInicio} variant="contained"
          sx={{ bgcolor: AMBER, '&:hover': { bgcolor: '#d97706' }, borderRadius: 2, fontWeight: 700 }}>
          {nuevoLavadorObj ? 'Cambiar y comenzar' : 'Iniciar lavado'}
        </Button>
      </DialogActions>
    </Dialog>
    </>
  );
}

/* ── Item grid card (services & products) ───────────────────────────────── */
function ItemCard({ item, enCarrito, onAgregar }) {
  return (
    <Paper
      onClick={() => onAgregar(item)}
      elevation={0}
      sx={{
        p: 1.2, borderRadius: 2, cursor: 'pointer',
        border: '1.5px solid',
        borderColor: enCarrito ? ACCENT : 'divider',
        bgcolor: enCarrito ? `${ACCENT}08` : 'transparent',
        transition: 'all 0.12s',
        '&:hover': { borderColor: ACCENT, bgcolor: `${ACCENT}05` },
        position: 'relative',
      }}
    >
      {enCarrito && (
        <Box sx={{
          position: 'absolute', top: -8, right: -8,
          width: 20, height: 20, borderRadius: '50%',
          bgcolor: ACCENT, color: 'white',
          fontSize: 11, fontWeight: 900,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {enCarrito.cantidad}
        </Box>
      )}
      <Typography sx={{ fontWeight: 700, fontSize: 12, lineHeight: 1.3 }}>{item.nombre}</Typography>
      <Typography sx={{ fontSize: 11, color: GREEN, fontWeight: 600, mt: 0.3 }}>
        {formatCurrency(item.precio_venta ?? item.precio ?? 0)}
      </Typography>
    </Paper>
  );
}

/* ══════════════════════════════════════════════════════════════════════════ */
export default function LavaderoVentas({ user }) {
  const isAdmin = user?.role?.name === 'Admin';

  /* ── Form state ───────────────────────────────────────────────────────── */
  const [placa,         setPlaca]         = useState('');
  const [tipoVehiculo,  setTipoVehiculo]  = useState('Carro');
  const [servicios,     setServicios]     = useState([]);
  const [productos,     setProductos]     = useState([]);
  const [carrito,       setCarrito]       = useState([]);
  const [operadorId,    setOperadorId]    = useState(user?.id || null);
  const [operadorObj,   setOperadorObj]   = useState(null);
  const [trabajadores,  setTrabajadores]  = useState([]);
  const [clientes,      setClientes]      = useState([]);
  const [clienteObj,    setClienteObj]    = useState(null);
  const [observaciones, setObservaciones] = useState('');
  const [saving,        setSaving]        = useState(false);
  const [busquedaServ,  setBusquedaServ]  = useState('');
  const [busquedaProd,  setBusquedaProd]  = useState('');
  const [loadingItems,  setLoadingItems]  = useState(true);

  /* ── Board state ──────────────────────────────────────────────────────── */
  const [ordenes,      setOrdenes]      = useState([]);
  const [loadingBoard, setLoadingBoard] = useState(true);
  const [tick,         setTick]         = useState(0);
  const [mobileView,   setMobileView]   = useState('crear');
  const [boardFilter,  setBoardFilter]  = useState('recibido');

  /* ── Config & cobrar ──────────────────────────────────────────────────── */
  const [config,        setConfig]        = useState(null);
  const [cobrarOrden,   setCobrarOrden]   = useState(null);
  const [metodoPago,    setMetodoPago]    = useState('Efectivo');
  const [solicitaFe,    setSolicitaFe]    = useState(false);
  const [cobrando,      setCobrando]      = useState(false);
  const [cobraData,     setCobraData]     = useState(null);   // post-cobro result
  const [montoRecibido, setMontoRecibido] = useState(0);
  const [metodoLinkQR,  setMetodoLinkQR]  = useState(null);
  const [linkPagoOpen,  setLinkPagoOpen]  = useState(false);

  /* ── Fidelización ──────────────────────────────────────────────────────── */
  const [configFidel,     setConfigFidel]     = useState({ activa: true, redeem_rate: 100 });
  const [cobrarPuntos,    setCobrarPuntos]    = useState(0);
  const [puntosACanjear,  setPuntosACanjear]  = useState(0);

  /* ── Historial ────────────────────────────────────────────────────────── */
  const [mainTab,         setMainTab]         = useState(0);  // 0=POS 1=Historial
  const [historial,       setHistorial]       = useState([]);
  const [histLoading,     setHistLoading]     = useState(false);
  const [reintentando,    setReintentando]    = useState(null);
  const [histFechaIni,    setHistFechaIni]    = useState('');
  const [histFechaFin,    setHistFechaFin]    = useState('');
  const [histPlaca,       setHistPlaca]       = useState('');

  const fetchHistorial = useCallback(async () => {
    setHistLoading(true);
    try {
      const params = {};
      if (histFechaIni) params.fecha_inicio = histFechaIni;
      if (histFechaFin) params.fecha_fin    = histFechaFin;
      if (histPlaca.trim()) params.placa    = histPlaca.trim();
      const { data } = await apiClient.get('/lavadero/historial', { params });
      setHistorial(data);
    } catch { toast.error('No se pudo cargar el historial.'); }
    finally { setHistLoading(false); }
  }, [histFechaIni, histFechaFin, histPlaca]);

  useEffect(() => {
    if (mainTab === 1) fetchHistorial();
  }, [mainTab, fetchHistorial]);

  const reintentarFE = async (ventaId) => {
    setReintentando(ventaId);
    try {
      const r = await apiClient.post(`/lavadero/ventas/${ventaId}/reintentar-fe`);
      if (r.data.estado === 'exitoso') {
        toast.success(`✅ FE emitida — N° ${r.data.numero_factura || ''}`);
      } else {
        toast.warning(`FE ${r.data.estado}: ${r.data.mensaje || 'Sin detalles'}`);
      }
      fetchHistorial();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Error al reintentar FE');
    } finally {
      setReintentando(null);
    }
  };

  /* ── Computed ─────────────────────────────────────────────────────────── */
  const metodosDisponibles = useMemo(
    () => metodoLinkQR
      ? ['Efectivo', 'Link/QR', ...METODOS_PAGO.filter(m => m !== 'Efectivo')]
      : [...METODOS_PAGO],
    [metodoLinkQR],
  );

  const devuelta = useMemo(() => {
    if (metodoPago !== 'Efectivo' || montoRecibido <= 0) return null;
    const descPts = puntosACanjear * (configFidel.redeem_rate || 100);
    const totalFinal = Math.max(0, (cobrarOrden?.total || 0) - descPts);
    return montoRecibido - totalFinal;
  }, [metodoPago, montoRecibido, cobrarOrden, puntosACanjear, configFidel.redeem_rate]);

  /* ── Fetchers ─────────────────────────────────────────────────────────── */
  const fetchOrdenes = useCallback(async () => {
    try {
      const { data } = await apiClient.get('/lavadero/ordenes', { params: { activas: true } });
      setOrdenes(data);
    } catch { /* silent */ } finally { setLoadingBoard(false); }
  }, []);

  const fetchItems = useCallback(async () => {
    setLoadingItems(true);
    try {
      const { data } = await apiClient.get('/productos/', { params: { limit: 500 } });
      const all = data.results ?? data;
      setServicios(all.filter(p => p.es_servicio));
      setProductos(all.filter(p => !p.es_servicio && p.precio > 0));
    } catch { toast.error('No se pudieron cargar los servicios.'); }
    finally { setLoadingItems(false); }
  }, []);

  const fetchTrabajadores = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const { data } = await apiClient.get('/admin/usuarios/');
      setTrabajadores(data.results ?? data);
    } catch { /* silent */ }
  }, [isAdmin]);

  const fetchClientes = useCallback(async () => {
    try {
      const { data } = await apiClient.get('/clientes/', { params: { limit: 200 } });
      setClientes(data.results ?? data);
    } catch { /* silent */ }
  }, []);

  const fetchConfig = useCallback(async () => {
    try {
      const { data } = await apiClient.get('/lavadero/config');
      setConfig(data);
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    fetchOrdenes();
    fetchItems();
    fetchTrabajadores();
    fetchClientes();
    fetchConfig();
    apiClient.get('/empresa/link-pago').then(({ data }) => setMetodoLinkQR(data || null)).catch(() => {});
    apiClient.get('/empresa/config-ventas').then(({ data }) => setConfigFidel({
      activa:      data.fidelizacion_activa     ?? true,
      redeem_rate: data.fidelizacion_redeem_rate ?? 100,
    })).catch(() => {});
  }, [fetchOrdenes, fetchItems, fetchTrabajadores, fetchClientes, fetchConfig]);

  // Fetch puntos cuando se selecciona una orden para cobrar
  useEffect(() => {
    if (!cobrarOrden?.cliente_id || !configFidel.activa) {
      setCobrarPuntos(0);
      setPuntosACanjear(0);
      return;
    }
    apiClient.get(`/clientes/${cobrarOrden.cliente_id}/puntos`)
      .then(({ data }) => setCobrarPuntos(data.puntos_disponibles || 0))
      .catch(() => setCobrarPuntos(0));
    setPuntosACanjear(0);
  }, [cobrarOrden, configFidel.activa]);

  useEffect(() => {
    const id = setInterval(() => { fetchOrdenes(); setTick(t => t + 1); }, 30000);
    return () => clearInterval(id);
  }, [fetchOrdenes]);

  /* ── Cart helpers ─────────────────────────────────────────────────────── */
  const agregarItem = (item, esServicio) => {
    setCarrito(prev => {
      const ex = prev.find(i => i.productoId === item.id);
      if (ex) return prev.map(i => i.productoId === item.id ? { ...i, cantidad: i.cantidad + 1 } : i);
      return [...prev, {
        productoId:   item.id,
        nombre:       item.nombre,
        precio:       parseFloat(item.precio_venta ?? item.precio ?? 0),
        cantidad:     1,
        comision_pct: esServicio ? (item.comision_pct ?? null) : 0,
      }];
    });
  };

  const cambiarCantidad = (id, delta) =>
    setCarrito(prev =>
      prev.map(i => i.productoId === id ? { ...i, cantidad: i.cantidad + delta } : i)
          .filter(i => i.cantidad > 0)
    );

  const total = carrito.reduce((s, i) => s + i.precio * i.cantidad, 0);

  const serviciosFiltrados = useMemo(() => {
    if (!busquedaServ.trim()) return servicios;
    const q = busquedaServ.toLowerCase();
    return servicios.filter(s => s.nombre.toLowerCase().includes(q));
  }, [servicios, busquedaServ]);

  const productosFiltrados = useMemo(() => {
    if (!busquedaProd.trim()) return productos;
    const q = busquedaProd.toLowerCase();
    return productos.filter(p => p.nombre.toLowerCase().includes(q));
  }, [productos, busquedaProd]);

  const resetForm = () => {
    setPlaca(''); setTipoVehiculo('Carro'); setCarrito([]);
    setObservaciones(''); setBusquedaServ(''); setBusquedaProd(''); setClienteObj(null);
    if (isAdmin) { setOperadorId(null); setOperadorObj(null); }
  };

  /* ── Registrar entrada ────────────────────────────────────────────────── */
  const handleRegistrar = async () => {
    if (!placa.trim()) { toast.warning('Ingresa la placa del vehículo.'); return; }
    if (carrito.length === 0) { toast.warning('Agrega al menos un servicio.'); return; }
    if (isAdmin && !operadorId) { toast.warning('Debes asignar un lavador antes de registrar.'); return; }

    setSaving(true);
    try {
      await apiClient.post('/lavadero/ordenes', {
        placa:         placa.trim().toUpperCase().replace(/-/g, ''),
        tipo_vehiculo: tipoVehiculo,
        operador_id:   operadorId,
        cliente_id:    clienteObj?.id ?? null,
        observaciones: observaciones.trim() || null,
        detalles: carrito.map(item => ({
          producto_id:     item.productoId,
          nombre_servicio: item.nombre,
          cantidad:        item.cantidad,
          precio_unitario: item.precio,
          comision_pct:    item.comision_pct,
        })),
      });
      toast.success('¡Vehículo registrado! Aparece en el tablero.');
      resetForm();
      fetchOrdenes();
      if (window.innerWidth < 900) setMobileView('tablero');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al registrar la entrada.');
    } finally {
      setSaving(false);
    }
  };

  /* ── Avanzar estado ───────────────────────────────────────────────────── */
  const handleEstadoChange = async (ordenId, nuevoEstado, nuevoOperadorId = null) => {
    setOrdenes(prev => prev.map(o => o.id === ordenId ? { ...o, estado: nuevoEstado } : o));
    try {
      const payload = { estado: nuevoEstado };
      if (nuevoOperadorId) payload.operador_id = nuevoOperadorId;
      await apiClient.patch(`/lavadero/ordenes/${ordenId}`, payload);
      fetchOrdenes();
    } catch {
      toast.error('Error al actualizar el estado.');
      fetchOrdenes();
    }
  };

  /* ── Cobrar ───────────────────────────────────────────────────────────── */
  const handleCobrar = async () => {
    if (!cobrarOrden) return;
    setCobrando(true);
    try {
      const metodoReal = metodoPago === 'Link/QR' ? (metodoLinkQR?.nombre || 'Link/QR') : metodoPago;
      const descuentoPts = puntosACanjear * (configFidel.redeem_rate || 100);
      const totalFinal = Math.max(0, (cobrarOrden.total || 0) - descuentoPts);
      const { data: resData } = await apiClient.post(`/lavadero/ordenes/${cobrarOrden.id}/cobrar`, {
        metodo_pago:      metodoReal,
        monto_pagado:     totalFinal,
        puntos_canjeados: puntosACanjear || 0,
        descuento_puntos: descuentoPts || 0,
        solicita_fe:      solicitaFe,
      });
      setCobraData(resData);
      fetchOrdenes();
      if (config?.imprimir_recibo) {
        imprimirReciboLavadero(resData, config, config?.tipo_impresora || 'p80');
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al registrar el cobro.');
    } finally {
      setCobrando(false);
    }
  };

  /* ── WhatsApp receipt ─────────────────────────────────────────────────── */
  const handleEnviarWARecibo = () => {
    if (!cobraData) return;
    const tel = cobraData.cliente_telefono;
    if (!tel) { toast.warning('El cliente no tiene teléfono registrado.'); return; }
    const num = tel.replace(/\D/g, '');
    const countryNum = num.startsWith('57') ? num : `57${num}`;
    const fechaSalida = new Date(cobraData.fecha_salida || Date.now());
    const fechaStr = fechaSalida.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const horaStr  = fechaSalida.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
    const detallesStr = (cobraData.detalles || [])
      .map(d => `• ${d.nombre_servicio}${d.cantidad > 1 ? ` x${d.cantidad}` : ''}: $${Number(d.precio_unitario * d.cantidad).toLocaleString('es-CO')}`)
      .join('\n');
    const nombreLav = config?.nombre_lavadero || 'Lavadero';
    const msg = `🚗 *Recibo de Lavado - ${nombreLav}*\n\nPlaca: *${cobraData.placa}*${cobraData.tipo_vehiculo ? ` (${cobraData.tipo_vehiculo})` : ''}\n📅 ${fechaStr} ${horaStr}\n\n${detallesStr}\n\n💰 *Total: $${Number(cobraData.total).toLocaleString('es-CO')}*\nPago: ${cobraData.metodo_pago}\n\n¡Gracias por su preferencia! 🙏`;
    window.open(`https://wa.me/${countryNum}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener');
  };

  /* ── Board grouping ───────────────────────────────────────────────────── */
  const ordensPorEstado = useMemo(() => {
    const map = { recibido: [], lavando: [], terminado: [] };
    ordenes.forEach(o => { if (map[o.estado]) map[o.estado].push(o); });
    return map;
  }, [ordenes]);

  const activeCount = ordenes.length;

  /* ─────────────────────────────────────────────────────────────────────── */
  return (
    <Box sx={{ p: { xs: 1, md: 2 }, maxWidth: 1300, mx: 'auto' }}>

      {/* ── Header ── */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2.5, flexWrap: 'wrap', gap: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ width: 42, height: 42, borderRadius: 2, bgcolor: `${ACCENT}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <LocalCarWash sx={{ color: ACCENT, fontSize: 24 }} />
          </Box>
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography sx={{ fontSize: 20, fontWeight: 800, lineHeight: 1.1 }}>POS Lavadero</Typography>
              <HelpGuideTopBar
                moduleName="POS Lavadero"
                moduleColor={ACCENT}
                steps={[
                  { title: 'Registra la entrada', description: 'Ingresa la placa, tipo de vehículo y los servicios solicitados. Presiona "Registrar Entrada".' },
                  { title: 'Tablero de órdenes', description: 'Cada vehículo aparece en el tablero. Avanza el estado: Recibido → Lavando → Terminado.' },
                  { title: 'Cobra al finalizar', description: 'Cuando el vehículo esté listo, presiona "Cobrar" para registrar el pago y entregar.' },
                  { title: 'Recibo automático', description: 'Si lo activaste en Config. Lavadero, el recibo se imprime al cobrar.' },
                ]}
                faqItems={[
                  { q: '¿Cómo agrego más servicios?', a: 'En el módulo Productos, crea un producto marcando "Es servicio" con su nombre y precio.' },
                  { q: '¿Puedo también vender productos?', a: 'Sí. Los productos físicos (sin marcar "Es servicio") aparecen en la sección "Productos" y se pueden agregar al cobro.' },
                  { q: '¿Qué pasa cuando cobro?', a: 'La orden pasa a "Entregado" y queda registrada en el reporte del lavadero.' },
                  { q: '¿Cómo configuro comisiones?', a: 'Ve a Config. Lavadero para definir el % de comisión global o por servicio.' },
                ]}
              />
            </Box>
            <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>Entrada rápida y tablero de órdenes</Typography>
          </Box>
        </Box>
        <Button
          size="small" variant="outlined" startIcon={<Refresh />}
          onClick={fetchOrdenes}
          sx={{ borderRadius: 2, textTransform: 'none', borderColor: 'divider' }}
        >
          Actualizar tablero
        </Button>
      </Box>

      {/* ── Tabs principales: POS | Historial ── */}
      <Tabs
        value={mainTab} onChange={(_, v) => setMainTab(v)}
        sx={{ mb: 2, borderBottom: '1px solid', borderColor: 'divider',
          '& .MuiTab-root': { fontWeight: 700, textTransform: 'none', minHeight: 44 },
          '& .MuiTabs-indicator': { bgcolor: ACCENT },
          '& .Mui-selected': { color: `${ACCENT} !important` },
        }}
      >
        <Tab icon={<LocalCarWash fontSize="small" />} iconPosition="start" label="POS Lavadero" />
        <Tab icon={<History fontSize="small" />} iconPosition="start" label="Historial de ventas" />
      </Tabs>

      {/* ══ TAB 1: Historial ══ */}
      {mainTab === 1 && (
        <Box>
          {/* Filtros */}
          <Paper sx={{ p: 2, mb: 2.5, borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
            <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <TextField label="Desde" type="date" size="small" InputLabelProps={{ shrink: true }}
                value={histFechaIni} onChange={e => setHistFechaIni(e.target.value)} sx={{ width: 155 }} />
              <TextField label="Hasta" type="date" size="small" InputLabelProps={{ shrink: true }}
                value={histFechaFin} onChange={e => setHistFechaFin(e.target.value)} sx={{ width: 155 }} />
              <TextField label="Placa" size="small"
                value={histPlaca} onChange={e => setHistPlaca(e.target.value.toUpperCase())}
                inputProps={{ style: { textTransform: 'uppercase', letterSpacing: 2 } }}
                sx={{ width: 130 }} />
              <Button variant="contained" startIcon={histLoading ? <CircularProgress size={14} color="inherit" /> : <Search />}
                onClick={fetchHistorial} disabled={histLoading}
                sx={{ bgcolor: ACCENT, '&:hover': { bgcolor: '#e5551c' }, fontWeight: 700, borderRadius: 2 }}>
                Buscar
              </Button>
            </Box>
          </Paper>

          {/* KPIs rápidos */}
          {historial.length > 0 && (
            <Box sx={{ display: 'flex', gap: 2, mb: 2.5, flexWrap: 'wrap' }}>
              <Paper sx={{ p: 2, borderRadius: 3, bgcolor: alpha(GREEN, 0.07), border: `1px solid ${alpha(GREEN, 0.2)}`, flex: 1, minWidth: 150 }}>
                <Typography sx={{ fontWeight: 800, fontSize: 11, color: GREEN, textTransform: 'uppercase' }}>Total cobrado</Typography>
                <Typography sx={{ fontWeight: 900, fontSize: 22, color: GREEN }}>
                  ${new Intl.NumberFormat('es-CO').format(historial.reduce((a, h) => a + (h.total || 0), 0))}
                </Typography>
              </Paper>
              <Paper sx={{ p: 2, borderRadius: 3, bgcolor: alpha(BLUE, 0.07), border: `1px solid ${alpha(BLUE, 0.2)}`, flex: 1, minWidth: 150 }}>
                <Typography sx={{ fontWeight: 800, fontSize: 11, color: BLUE, textTransform: 'uppercase' }}>Órdenes</Typography>
                <Typography sx={{ fontWeight: 900, fontSize: 22, color: BLUE }}>{historial.length}</Typography>
              </Paper>
              <Paper sx={{ p: 2, borderRadius: 3, bgcolor: alpha(ACCENT, 0.07), border: `1px solid ${alpha(ACCENT, 0.2)}`, flex: 1, minWidth: 150 }}>
                <Typography sx={{ fontWeight: 800, fontSize: 11, color: ACCENT, textTransform: 'uppercase' }}>FE emitidas</Typography>
                <Typography sx={{ fontWeight: 900, fontSize: 22, color: ACCENT }}>
                  {historial.filter(h => h.estado_fe === 'exitoso').length}
                </Typography>
              </Paper>
            </Box>
          )}

          {/* Tabla */}
          <Paper sx={{ borderRadius: 3, overflow: 'hidden' }}>
            <TableContainer sx={{ maxHeight: '65vh' }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    {['Fecha', 'Placa', 'Vehículo', 'Servicios', 'Total', 'Método', 'Cliente', 'Operador', 'FE', 'N° Factura', 'PDF'].map(h => (
                      <TableCell key={h} sx={{ fontWeight: 800, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.3, bgcolor: 'action.hover' }}>{h}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {historial.length === 0 && !histLoading && (
                    <TableRow>
                      <TableCell colSpan={11} align="center" sx={{ py: 6, color: 'text.disabled' }}>
                        Sin registros. Usa los filtros y presiona Buscar.
                      </TableCell>
                    </TableRow>
                  )}
                  {historial.map(h => {
                    const feColor = h.estado_fe === 'exitoso' ? GREEN : h.estado_fe === 'fallido' ? RED : '#94a3b8';
                    const feLabel = h.estado_fe === 'exitoso' ? 'Emitida' : h.estado_fe === 'fallido' ? 'Fallida' : 'Sin FE';
                    return (
                      <TableRow key={h.id} hover sx={{ '& td': { py: 1.1 } }}>
                        <TableCell>
                          <Typography sx={{ fontSize: 12, fontWeight: 600 }}>
                            {h.fecha_salida ? new Date(h.fecha_salida).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                          </Typography>
                          <Typography sx={{ fontSize: 10, color: 'text.disabled' }}>
                            {h.fecha_salida ? new Date(h.fecha_salida).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }) : ''}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography sx={{ fontSize: 13, fontWeight: 800, letterSpacing: 2, fontFamily: 'monospace' }}>{h.placa}</Typography>
                        </TableCell>
                        <TableCell><Typography sx={{ fontSize: 12 }}>{h.tipo_vehiculo || '—'}</Typography></TableCell>
                        <TableCell sx={{ maxWidth: 200 }}>
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.3 }}>
                            {(h.servicios || []).map((s, i) => (
                              <Chip key={i} label={`${s.nombre}${s.cantidad > 1 ? ` x${s.cantidad}` : ''}`} size="small"
                                sx={{ fontSize: 10, height: 18, bgcolor: alpha(ACCENT, 0.1), color: ACCENT }} />
                            ))}
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Typography sx={{ fontSize: 13, fontWeight: 800, color: GREEN }}>
                            ${new Intl.NumberFormat('es-CO').format(h.total || 0)}
                          </Typography>
                        </TableCell>
                        <TableCell><Typography sx={{ fontSize: 12 }}>{h.metodo_pago || '—'}</Typography></TableCell>
                        <TableCell><Typography sx={{ fontSize: 12 }}>{h.cliente_nombre || '—'}</Typography></TableCell>
                        <TableCell><Typography sx={{ fontSize: 12 }}>{h.operador_nombre || '—'}</Typography></TableCell>
                        <TableCell>
                          <Chip label={feLabel} size="small" sx={{ bgcolor: alpha(feColor, 0.1), color: feColor, fontWeight: 700, fontSize: 10, height: 20 }} />
                        </TableCell>
                        <TableCell>
                          <Typography sx={{ fontSize: 11, fontFamily: 'monospace', fontWeight: 600 }}>{h.numero_factura || '—'}</Typography>
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', gap: 0.3, alignItems: 'center' }}>
                            {h.pdf_url ? (
                              <Tooltip title="Ver PDF factura electrónica">
                                <IconButton size="small" component="a" href={h.pdf_url} target="_blank" rel="noopener noreferrer" sx={{ color: '#EF4444' }}>
                                  <PictureAsPdf fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            ) : <Typography sx={{ fontSize: 11, color: 'text.disabled' }}>—</Typography>}
                            {h.venta_id && (h.estado_fe === 'fallido' || !h.estado_fe) && (
                              <Tooltip title={h.estado_fe === 'fallido' ? 'Reintentar emisión FE' : 'Emitir FE'}>
                                <span>
                                  <IconButton size="small"
                                    disabled={reintentando === h.venta_id}
                                    onClick={() => reintentarFE(h.venta_id)}
                                    sx={{ color: '#6366F1' }}
                                  >
                                    {reintentando === h.venta_id
                                      ? <CircularProgress size={14} />
                                      : <Replay fontSize="small" />}
                                  </IconButton>
                                </span>
                              </Tooltip>
                            )}
                          </Box>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Box>
      )}

      {/* ══ TAB 0: POS ══ */}
      {mainTab === 0 && <>

      {/* ── Mobile tab switcher ── */}
      <Box sx={{ display: { xs: 'flex', md: 'none' }, mb: 2 }}>
        <ToggleButtonGroup
          value={mobileView} exclusive
          onChange={(_, v) => v && setMobileView(v)}
          size="small" fullWidth
        >
          <ToggleButton value="crear" sx={{ fontWeight: 700, textTransform: 'none' }}>
            Nueva Entrada
          </ToggleButton>
          <ToggleButton value="tablero" sx={{ fontWeight: 700, textTransform: 'none' }}>
            <Badge badgeContent={activeCount} color="error" max={99}>
              Tablero&nbsp;&nbsp;
            </Badge>
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>

      <Grid container spacing={2.5}>

        {/* ══ LEFT: Formulario de entrada ══ */}
        <Grid item xs={12} md={5}
          sx={{ display: { xs: mobileView === 'crear' ? 'block' : 'none', md: 'block' } }}
        >
          {/* Placa + tipo vehículo */}
          <Paper sx={{ p: 2.5, borderRadius: 3, mb: 2, border: '1px solid', borderColor: 'divider' }}>
            <SectionLabel>Vehículo</SectionLabel>
            <TextField
              label="Placa" fullWidth size="small"
              value={placa}
              onChange={e => setPlaca(formatPlaca(e.target.value))}
              inputProps={{ maxLength: 8, style: { textTransform: 'uppercase', fontWeight: 800, letterSpacing: 4, fontSize: 18 } }}
              placeholder="ABC-123"
              sx={{ mb: 2 }}
            />
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {TIPOS_VEHICULO.map(({ label, icon: Icon }) => (
                <Chip
                  key={label}
                  icon={<Icon sx={{ fontSize: 16 }} />}
                  label={label}
                  onClick={() => setTipoVehiculo(label)}
                  sx={{
                    cursor: 'pointer', fontWeight: 600, fontSize: 12,
                    bgcolor: tipoVehiculo === label ? ACCENT : 'action.hover',
                    color:   tipoVehiculo === label ? 'white' : 'text.primary',
                    '&:hover': { filter: 'brightness(0.95)' },
                    '& .MuiChip-icon': { color: tipoVehiculo === label ? 'rgba(255,255,255,0.9)' : 'text.secondary' },
                  }}
                />
              ))}
            </Box>
          </Paper>

          {/* Servicios */}
          <Paper sx={{ p: 2.5, borderRadius: 3, mb: 2, border: '1px solid', borderColor: 'divider' }}>
            <SectionLabel>Servicios de lavado</SectionLabel>
            <TextField
              size="small" fullWidth placeholder="Buscar servicio…"
              value={busquedaServ}
              onChange={e => setBusquedaServ(e.target.value)}
              sx={{ mb: 1.5 }}
              InputProps={{
                endAdornment: busquedaServ ? (
                  <IconButton size="small" onClick={() => setBusquedaServ('')}><Close sx={{ fontSize: 14 }} /></IconButton>
                ) : null,
              }}
            />
            {loadingItems ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                <CircularProgress size={24} sx={{ color: ACCENT }} />
              </Box>
            ) : serviciosFiltrados.length === 0 ? (
              <Typography sx={{ color: 'text.disabled', fontSize: 12, textAlign: 'center', py: 2 }}>
                {servicios.length === 0
                  ? 'No hay servicios. Créalos en Productos marcando "Es servicio".'
                  : 'Sin resultados para esta búsqueda.'}
              </Typography>
            ) : (
              <Grid container spacing={1}>
                {serviciosFiltrados.map(s => (
                  <Grid item xs={6} key={s.id}>
                    <ItemCard
                      item={s}
                      enCarrito={carrito.find(i => i.productoId === s.id)}
                      onAgregar={item => agregarItem(item, true)}
                    />
                  </Grid>
                ))}
              </Grid>
            )}
          </Paper>

          {/* Productos adicionales (productos físicos / consumibles) */}
          {(!loadingItems && productos.length > 0) && (
            <Paper sx={{ p: 2.5, borderRadius: 3, mb: 2, border: '1px solid', borderColor: 'divider' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.2 }}>
                <Storefront sx={{ fontSize: 15, color: 'text.secondary' }} />
                <SectionLabel>Productos adicionales</SectionLabel>
              </Box>
              <TextField
                size="small" fullWidth placeholder="Buscar producto…"
                value={busquedaProd}
                onChange={e => setBusquedaProd(e.target.value)}
                sx={{ mb: 1.5 }}
                InputProps={{
                  endAdornment: busquedaProd ? (
                    <IconButton size="small" onClick={() => setBusquedaProd('')}><Close sx={{ fontSize: 14 }} /></IconButton>
                  ) : null,
                }}
              />
              <Grid container spacing={1}>
                {productosFiltrados.map(p => (
                  <Grid item xs={6} key={p.id}>
                    <ItemCard
                      item={p}
                      enCarrito={carrito.find(i => i.productoId === p.id)}
                      onAgregar={item => agregarItem(item, false)}
                    />
                  </Grid>
                ))}
                {productosFiltrados.length === 0 && (
                  <Grid item xs={12}>
                    <Typography sx={{ color: 'text.disabled', fontSize: 12, textAlign: 'center', py: 1 }}>
                      Sin resultados para esta búsqueda.
                    </Typography>
                  </Grid>
                )}
              </Grid>
            </Paper>
          )}

          {/* Carrito resumen */}
          {carrito.length > 0 && (
            <Paper sx={{ p: 2.5, borderRadius: 3, mb: 2, border: `1.5px solid ${ACCENT}30`, bgcolor: `${ACCENT}04` }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                <SectionLabel>Seleccionados</SectionLabel>
                <Tooltip title="Limpiar">
                  <IconButton size="small" onClick={() => setCarrito([])} sx={{ color: 'text.disabled' }}>
                    <ClearAll sx={{ fontSize: 16 }} />
                  </IconButton>
                </Tooltip>
              </Box>
              <Stack spacing={0.8}>
                {carrito.map(item => (
                  <Box key={item.productoId} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography sx={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{item.nombre}</Typography>
                    <Typography sx={{ fontSize: 13, color: 'text.secondary', minWidth: 70, textAlign: 'right' }}>
                      {formatCurrency(item.precio * item.cantidad)}
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}>
                      <IconButton size="small" onClick={() => cambiarCantidad(item.productoId, -1)} sx={{ p: 0.3 }}>
                        <Remove sx={{ fontSize: 14 }} />
                      </IconButton>
                      <Typography sx={{ fontWeight: 700, fontSize: 13, minWidth: 18, textAlign: 'center' }}>{item.cantidad}</Typography>
                      <IconButton size="small" onClick={() => cambiarCantidad(item.productoId, 1)} sx={{ p: 0.3 }}>
                        <Add sx={{ fontSize: 14 }} />
                      </IconButton>
                      <IconButton size="small" onClick={() => cambiarCantidad(item.productoId, -item.cantidad)} sx={{ p: 0.3, color: 'error.main' }}>
                        <DeleteOutline sx={{ fontSize: 14 }} />
                      </IconButton>
                    </Box>
                  </Box>
                ))}
              </Stack>
              <Divider sx={{ my: 1.5 }} />
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography sx={{ fontWeight: 700, fontSize: 14 }}>Total estimado</Typography>
                <Typography sx={{ fontWeight: 800, fontSize: 16, color: GREEN }}>{formatCurrency(total)}</Typography>
              </Box>
            </Paper>
          )}

          {/* Trabajador (solo admin) */}
          {isAdmin && trabajadores.length > 0 && (
            <Paper sx={{ p: 2.5, borderRadius: 3, mb: 2, border: '1px solid', borderColor: 'divider' }}>
              <SectionLabel>Asignar lavador</SectionLabel>
              <Autocomplete
                size="small"
                options={trabajadores}
                getOptionLabel={t => t.nombre_completo || t.username}
                value={operadorObj}
                onChange={(_, v) => { setOperadorObj(v); setOperadorId(v?.id ?? null); }}
                renderInput={params => <TextField {...params} label="Lavador" placeholder="Seleccionar…" />}
              />
            </Paper>
          )}

          {/* Cliente (opcional) */}
          <Paper sx={{ p: 2.5, borderRadius: 3, mb: 2, border: '1px solid', borderColor: 'divider' }}>
            <SectionLabel>Cliente (opcional)</SectionLabel>
            <Autocomplete
              size="small"
              options={clientes}
              getOptionLabel={c => c.nombre || ''}
              value={clienteObj}
              onChange={(_, v) => setClienteObj(v)}
              renderInput={params => <TextField {...params} label="Buscar cliente" placeholder="Consumidor final" />}
            />
          </Paper>

          {/* Observaciones */}
          <Paper sx={{ p: 2.5, borderRadius: 3, mb: 2, border: '1px solid', borderColor: 'divider' }}>
            <SectionLabel>Observaciones</SectionLabel>
            <TextField
              size="small" fullWidth multiline rows={2}
              placeholder="Daños previos, pedido especial…"
              value={observaciones}
              onChange={e => setObservaciones(e.target.value)}
              InputProps={{ startAdornment: <InputAdornment position="start"><Notes sx={{ fontSize: 16, color: 'text.disabled', mt: 0.5 }} /></InputAdornment> }}
            />
          </Paper>

          {/* Botón registrar */}
          <Button
            fullWidth variant="contained" size="large"
            disabled={saving || carrito.length === 0 || !placa.trim() || (isAdmin && !operadorId)}
            onClick={handleRegistrar}
            startIcon={saving ? <CircularProgress size={18} color="inherit" /> : <CheckCircle />}
            sx={{
              bgcolor: ACCENT, '&:hover': { bgcolor: '#e6561c' },
              '&.Mui-disabled': { bgcolor: 'action.disabledBackground' },
              fontWeight: 800, fontSize: 15, borderRadius: 3,
              textTransform: 'none', py: 1.5,
            }}
          >
            {saving ? 'Registrando…' : 'Registrar Entrada'}
          </Button>
          {isAdmin && !operadorId && (
            <Typography sx={{ fontSize: 11, color: 'error.main', textAlign: 'center', mt: 0.8 }}>
              ⚠ Debes asignar un lavador para registrar
            </Typography>
          )}
        </Grid>

        {/* ══ RIGHT: Tablero kanban ══ */}
        <Grid item xs={12} md={7}
          sx={{ display: { xs: mobileView === 'tablero' ? 'block' : 'none', md: 'block' } }}
        >
          <Paper sx={{ p: 2.5, borderRadius: 3, border: '1px solid', borderColor: 'divider', height: '100%' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Typography sx={{ fontWeight: 800, fontSize: 15 }}>Tablero de órdenes</Typography>
              {loadingBoard && <CircularProgress size={16} sx={{ color: ACCENT }} />}
            </Box>

            {/* Mobile: tabs por estado */}
            <Box sx={{ display: { xs: 'block', md: 'none' }, mb: 2 }}>
              <ToggleButtonGroup
                value={boardFilter} exclusive
                onChange={(_, v) => v && setBoardFilter(v)}
                size="small" fullWidth
              >
                {ESTADOS_TABLERO.map(est => (
                  <ToggleButton key={est.key} value={est.key} sx={{ fontWeight: 700, textTransform: 'none', fontSize: 11 }}>
                    <Badge
                      badgeContent={ordensPorEstado[est.key]?.length || 0}
                      max={99}
                      sx={{ '& .MuiBadge-badge': { bgcolor: est.color, color: 'white', fontSize: 9, minWidth: 16, height: 16 } }}
                    >
                      <span>{est.label}&nbsp;&nbsp;</span>
                    </Badge>
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
            </Box>

            {/* Desktop: 3 columnas */}
            <Grid container spacing={1.5} sx={{ display: { xs: 'none', md: 'flex' } }}>
              {ESTADOS_TABLERO.map(est => (
                <Grid item md={4} key={est.key}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5, pb: 1, borderBottom: `2px solid ${est.color}` }}>
                    <Typography sx={{ fontWeight: 700, fontSize: 12, color: est.color, textTransform: 'uppercase', letterSpacing: 0.6 }}>
                      {est.label}
                    </Typography>
                    <Chip
                      label={ordensPorEstado[est.key]?.length || 0}
                      size="small"
                      sx={{ height: 20, fontSize: 11, fontWeight: 700, bgcolor: `${est.color}18`, color: est.color }}
                    />
                  </Box>
                  <Box sx={{ minHeight: 80 }}>
                    {(ordensPorEstado[est.key] || []).length === 0 ? (
                      <Box sx={{ py: 4, textAlign: 'center' }}>
                        <Typography sx={{ color: 'text.disabled', fontSize: 12 }}>Sin órdenes</Typography>
                      </Box>
                    ) : (
                      (ordensPorEstado[est.key] || []).map(o => (
                        <OrdenCard
                          key={o.id}
                          orden={o}
                          estadoConfig={est}
                          trabajadores={trabajadores}
                          onEstadoChange={handleEstadoChange}
                          onCobrar={ord => { setCobrarOrden(ord); setMetodoPago('Efectivo'); setMontoRecibido(0); }}
                          tick={tick}
                        />
                      ))
                    )}
                  </Box>
                </Grid>
              ))}
            </Grid>

            {/* Mobile: columna filtrada */}
            <Box sx={{ display: { xs: 'block', md: 'none' } }}>
              {(() => {
                const est   = ESTADOS_TABLERO.find(e => e.key === boardFilter);
                const lista = ordensPorEstado[boardFilter] || [];
                return lista.length === 0 ? (
                  <Box sx={{ py: 6, textAlign: 'center' }}>
                    <Typography sx={{ color: 'text.disabled', fontSize: 13 }}>Sin órdenes en "{est?.label}"</Typography>
                  </Box>
                ) : lista.map(o => (
                  <OrdenCard
                    key={o.id} orden={o}
                    estadoConfig={est}
                    trabajadores={trabajadores}
                    onEstadoChange={handleEstadoChange}
                    onCobrar={ord => { setCobrarOrden(ord); setMetodoPago('Efectivo'); setMontoRecibido(0); }}
                    tick={tick}
                  />
                ));
              })()}
            </Box>

            {/* Resumen footer */}
            {activeCount > 0 && (
              <Box sx={{ mt: 2, pt: 1.5, borderTop: '1px dashed', borderColor: 'divider', display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                {ESTADOS_TABLERO.map(est => (
                  <Box key={est.key} sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: est.color }} />
                    <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
                      {est.label}: <strong>{ordensPorEstado[est.key]?.length || 0}</strong>
                    </Typography>
                  </Box>
                ))}
              </Box>
            )}
          </Paper>
        </Grid>
      </Grid>

      {/* ══ Cobrar / Post-cobro dialog ══ */}
      <Dialog
        open={!!cobrarOrden}
        onClose={() => { if (!cobrando) setCobrarOrden(null); }}
        TransitionProps={{ onExited: () => { setCobraData(null); setMontoRecibido(0); setCobrarPuntos(0); setPuntosACanjear(0); } }}
        maxWidth="xs" fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        {cobraData ? (
          /* ── Post-cobro view ── */
          <>
            <DialogTitle sx={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              pb: 1,
              background: `linear-gradient(135deg, ${alpha(GREEN, 0.08)}, ${alpha(GREEN, 0.02)})`,
              borderBottom: `1px solid ${alpha(GREEN, 0.2)}`,
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CheckCircle sx={{ color: GREEN, fontSize: 22 }} />
                <Box>
                  <Typography sx={{ fontWeight: 800, fontSize: 15 }}>¡Pago registrado!</Typography>
                  <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{cobraData.placa} — {cobraData.tipo_vehiculo}</Typography>
                </Box>
              </Box>
              <IconButton size="small" onClick={() => setCobrarOrden(null)}>
                <Close fontSize="small" />
              </IconButton>
            </DialogTitle>

            <DialogContent sx={{ pt: 2.5 }}>
              {/* Detalles del pago */}
              <Box sx={{ mb: 2 }}>
                {(cobraData.detalles || []).map((d, i) => (
                  <Box key={i} sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.4 }}>
                    <Typography sx={{ fontSize: 13 }}>
                      {d.nombre_servicio}{d.cantidad > 1 ? ` x${d.cantidad}` : ''}
                    </Typography>
                    <Typography sx={{ fontSize: 13, fontWeight: 600 }}>
                      {formatCurrency(d.precio_unitario * d.cantidad)}
                    </Typography>
                  </Box>
                ))}
                <Divider sx={{ my: 1 }} />
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography sx={{ fontWeight: 800 }}>Total</Typography>
                  <Typography sx={{ fontWeight: 900, fontSize: 18, color: GREEN }}>
                    {formatCurrency(cobraData.total || 0)}
                  </Typography>
                </Box>
                <Typography sx={{ fontSize: 12, color: 'text.secondary', textAlign: 'right' }}>
                  Pago: {cobraData.metodo_pago}
                </Typography>
              </Box>

              <Divider sx={{ mb: 2 }} />

              {/* Opciones de recibo */}
              <Typography sx={{ fontSize: 12, fontWeight: 600, color: 'text.secondary', mb: 1.5, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Comprobante de pago
              </Typography>
              <Stack spacing={1}>
                <Button
                  fullWidth variant="outlined"
                  startIcon={<Print />}
                  onClick={() => imprimirReciboLavadero(cobraData, config, config?.tipo_impresora || 'p80')}
                  sx={{ borderRadius: 2, fontWeight: 700, textTransform: 'none', justifyContent: 'flex-start' }}
                >
                  Imprimir recibo
                </Button>
                {cobraData.cliente_telefono && (
                  <Button
                    fullWidth variant="outlined"
                    startIcon={<WhatsApp />}
                    onClick={handleEnviarWARecibo}
                    sx={{
                      borderRadius: 2, fontWeight: 700, textTransform: 'none', justifyContent: 'flex-start',
                      borderColor: '#25D366', color: '#25D366',
                      '&:hover': { bgcolor: alpha('#25D366', 0.05), borderColor: '#25D366' },
                    }}
                  >
                    Enviar recibo por WhatsApp
                  </Button>
                )}
              </Stack>
            </DialogContent>

            <DialogActions sx={{ px: 2.5, pb: 2.5 }}>
              <Button
                fullWidth variant="contained"
                onClick={() => setCobrarOrden(null)}
                sx={{ borderRadius: 2, bgcolor: GREEN, '&:hover': { filter: 'brightness(0.9)' }, fontWeight: 700, textTransform: 'none' }}
              >
                Cerrar
              </Button>
            </DialogActions>
          </>
        ) : (
          /* ── Cobrar form view ── */
          <>
            <DialogTitle sx={{ fontWeight: 800, pb: 1 }}>
              Cobrar — <span style={{ color: ACCENT }}>{cobrarOrden?.placa}</span>
            </DialogTitle>
            <DialogContent>
              {cobrarOrden && (
                <>
                  {/* Detalle de servicios */}
                  <Box sx={{ mb: 2 }}>
                    {(cobrarOrden.detalles || []).map((d, i) => (
                      <Box key={i} sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.4 }}>
                        <Typography sx={{ fontSize: 13 }}>
                          {d.nombre_servicio}{d.cantidad > 1 ? ` x${d.cantidad}` : ''}
                        </Typography>
                        <Typography sx={{ fontSize: 13, fontWeight: 600 }}>
                          {formatCurrency(d.precio_unitario * d.cantidad)}
                        </Typography>
                      </Box>
                    ))}
                    <Divider sx={{ my: 1 }} />
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography sx={{ fontWeight: 800 }}>Total</Typography>
                      <Typography sx={{ fontWeight: 900, fontSize: 18, color: GREEN }}>
                        {formatCurrency(cobrarOrden.total || 0)}
                      </Typography>
                    </Box>
                  </Box>

                  {/* Puntos de fidelización */}
                  {configFidel.activa && cobrarOrden?.cliente_id && cobrarPuntos > 0 && (() => {
                    const descPts = puntosACanjear * (configFidel.redeem_rate || 100);
                    const totalFinal = Math.max(0, (cobrarOrden.total || 0) - descPts);
                    return (
                      <Box sx={{ mb: 2, p: 1.5, borderRadius: 2, bgcolor: '#10B98108', border: '1px solid #10B98128' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
                          <Stars sx={{ fontSize: 15, color: GREEN }} />
                          <Typography sx={{ fontSize: 12, fontWeight: 700, color: GREEN, flex: 1 }}>
                            {cobrarPuntos} puntos disponibles
                          </Typography>
                          <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>
                            = {formatCurrency(cobrarPuntos * (configFidel.redeem_rate || 100))}
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', gap: 0.8, flexWrap: 'wrap', mb: descPts > 0 ? 1 : 0 }}>
                          {[0, Math.floor(cobrarPuntos * 0.5), cobrarPuntos]
                            .filter((v, i, a) => a.indexOf(v) === i)
                            .map(pts => (
                              <Chip
                                key={pts}
                                label={pts === 0 ? 'Sin canje' : pts === cobrarPuntos ? 'Todo' : `${pts} pts`}
                                size="small"
                                onClick={() => setPuntosACanjear(pts)}
                                sx={{
                                  cursor: 'pointer', fontWeight: 600, fontSize: 11,
                                  bgcolor: puntosACanjear === pts ? GREEN : 'action.hover',
                                  color:   puntosACanjear === pts ? 'white' : 'text.primary',
                                }}
                              />
                            ))}
                        </Box>
                        {descPts > 0 && (
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>Descuento puntos:</Typography>
                            <Typography sx={{ fontSize: 13, fontWeight: 800, color: GREEN }}>-{formatCurrency(descPts)}</Typography>
                          </Box>
                        )}
                        {descPts > 0 && (
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 0.5 }}>
                            <Typography sx={{ fontSize: 12, fontWeight: 700 }}>Total a cobrar:</Typography>
                            <Typography sx={{ fontSize: 16, fontWeight: 900, color: ACCENT }}>{formatCurrency(totalFinal)}</Typography>
                          </Box>
                        )}
                      </Box>
                    );
                  })()}

                  {/* Método de pago */}
                  <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 1, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Método de pago
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.8, mb: 2 }}>
                    {metodosDisponibles.map(m => (
                      <Chip
                        key={m}
                        label={m === 'Link/QR' && metodoLinkQR?.nombre ? `${metodoLinkQR.nombre}` : m}
                        icon={m === 'Link/QR' ? <QrCode2 sx={{ fontSize: 14 }} /> : undefined}
                        onClick={() => { setMetodoPago(m); setMontoRecibido(0); }}
                        sx={{
                          cursor: 'pointer', fontWeight: 600, fontSize: 12,
                          bgcolor: metodoPago === m ? GREEN : 'action.hover',
                          color:   metodoPago === m ? 'white' : 'text.primary',
                          '& .MuiChip-icon': { color: metodoPago === m ? 'white' : 'text.secondary' },
                        }}
                      />
                    ))}
                  </Box>

                  {/* Calculadora de vueltas (solo Efectivo) */}
                  {metodoPago === 'Efectivo' && (
                    <Box sx={{ mt: 1 }}>
                      <CurrencyField
                        fullWidth size="small" label="Monto recibido del cliente"
                        value={montoRecibido}
                        onChange={val => setMontoRecibido(val)}
                      />
                      {devuelta !== null && (
                        <Box sx={{
                          mt: 1.2, px: 2, py: 1, borderRadius: 2, textAlign: 'center',
                          bgcolor: devuelta >= 0 ? alpha(GREEN, 0.08) : alpha(RED, 0.08),
                          border: `1.5px solid ${devuelta >= 0 ? alpha(GREEN, 0.35) : alpha(RED, 0.35)}`,
                        }}>
                          <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>
                            {devuelta >= 0 ? 'Cambio a devolver' : 'Falta por recibir'}
                          </Typography>
                          <Typography sx={{ fontSize: 22, fontWeight: 900, color: devuelta >= 0 ? GREEN : RED }}>
                            {formatCurrency(Math.abs(devuelta))}
                          </Typography>
                        </Box>
                      )}
                    </Box>
                  )}

                  {/* Toggle Factura Electrónica */}
                  <Box sx={{ mt: 1.5 }}>
                    <FormControlLabel
                      control={
                        <Switch
                          size="small"
                          checked={solicitaFe}
                          onChange={e => setSolicitaFe(e.target.checked)}
                          color="primary"
                        />
                      }
                      label={
                        <Typography sx={{ fontSize: 12, fontWeight: solicitaFe ? 700 : 500, color: solicitaFe ? 'primary.main' : 'text.secondary' }}>
                          🧾 ¿El cliente requiere factura electrónica?
                        </Typography>
                      }
                      sx={{ m: 0 }}
                    />
                  </Box>

                  {/* Botón QR/Link cuando ese método está seleccionado */}
                  {metodoPago === 'Link/QR' && metodoLinkQR && (
                    <Button
                      fullWidth variant="outlined"
                      startIcon={<QrCode2 />}
                      onClick={() => setLinkPagoOpen(true)}
                      sx={{ mt: 1.5, borderRadius: 2, fontWeight: 700, textTransform: 'none', borderColor: ACCENT, color: ACCENT }}
                    >
                      Mostrar QR / Link de pago
                    </Button>
                  )}
                </>
              )}
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
              <Button
                onClick={() => setCobrarOrden(null)}
                disabled={cobrando}
                variant="outlined"
                sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleCobrar}
                disabled={cobrando}
                variant="contained"
                startIcon={cobrando ? <CircularProgress size={16} color="inherit" /> : <CheckCircle />}
                sx={{
                  bgcolor: GREEN, '&:hover': { filter: 'brightness(0.9)' },
                  fontWeight: 800, borderRadius: 2, textTransform: 'none', flex: 1,
                }}
              >
                {cobrando ? 'Procesando…' : `Confirmar pago`}
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* ── LinkPagoModal ── */}
      <LinkPagoModal
        open={linkPagoOpen}
        onClose={() => setLinkPagoOpen(false)}
        onConfirm={() => { setLinkPagoOpen(false); handleCobrar(); }}
        linkConfig={metodoLinkQR}
        clienteTelefono={cobrarOrden?.cliente_telefono || ''}
      />

      </> /* fin TAB 0 POS */}
    </Box>
  );
}
