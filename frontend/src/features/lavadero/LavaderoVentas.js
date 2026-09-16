import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Box, Paper, Typography, Grid, TextField, Button, Chip, Stack,
  IconButton, Divider, Autocomplete, CircularProgress,
  Tooltip, InputAdornment, Dialog, DialogTitle, DialogContent,
  DialogActions, ToggleButtonGroup, ToggleButton, Badge, alpha,
  Table, TableHead, TableRow, TableCell, TableBody, TableContainer,
  Tabs, Tab, Switch, FormControlLabel, useMediaQuery, useTheme,
} from '@mui/material';
import {
  DirectionsCar, Add, Remove, DeleteOutline, LocalCarWash,
  TwoWheeler, LocalShipping, DriveEta, ClearAll, Notes,
  Refresh, AccessTime, AttachMoney, CheckCircle, PlayArrow,
  Done, Close, Person, WhatsApp, Print, Storefront, QrCode2, Stars,
  History, PictureAsPdf, ContentCopy, Search, Replay, Undo,
  WarningAmber, Cancel, TrendingUp, Bolt, DragIndicator,
  Assignment, Groups, BarChart, ArrowForward,
} from '@mui/icons-material';
import { DndContext, useDraggable, useDroppable, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import apiClient from '../../api';
import { formatCurrency } from '../../utils/formatters';
import HelpGuideTopBar from '../../components/onboarding/HelpGuideTopBar';
import { METODOS_PAGO_SIMPLE as METODOS_PAGO } from '../../utils/constants';
import { imprimirReciboLavadero } from '../../utils/printLavadero';
import LinkPagoModal from '../../components/common/LinkPagoModal';
import CurrencyField from '../../components/common/CurrencyField';

const ACCENT  = '#0891B2';
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

// Icono aproximado para una categoría de vehículo con nombre libre (ej.
// "Camioneta Grande", "Motocicletas") — busca una palabra en común con los
// íconos conocidos; si no hay coincidencia, usa un carro genérico.
const iconoParaVehiculo = (label) => {
  const l = String(label).toLowerCase();
  if (l.includes('moto')) return TwoWheeler;
  if (l.includes('camion') || l.includes('suv')) return LocalShipping;
  if (l.includes('carro') || l.includes('auto') || l.includes('taxi')) return DirectionsCar;
  return DriveEta;
};

const ESTADOS_TABLERO = [
  { key: 'recibido',  label: 'Recibido',  color: BLUE,  bg: '#EFF6FF', nextKey: 'lavando',   nextLabel: 'Iniciar lavado',    NextIcon: PlayArrow, prevKey: null,        prevLabel: null },
  { key: 'lavando',   label: 'Lavando',   color: AMBER, bg: '#FFFBEB', nextKey: 'terminado', nextLabel: 'Marcar terminado',  NextIcon: Done,      prevKey: 'recibido',  prevLabel: 'Regresar a Recibido' },
  { key: 'terminado', label: 'Terminado', color: GREEN, bg: '#ECFDF5', nextKey: null,         nextLabel: null,               NextIcon: null,      prevKey: 'lavando',   prevLabel: 'Regresar a Lavando' },
];

// Minutos que puede estar un vehículo "Lavando" antes de marcarlo como
// demorado en el tablero (alerta visual, no bloquea nada).
const MINUTOS_DEMORA = 45;

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

const getElapsedMinutes = (fechaEntrada) =>
  Math.floor((Date.now() - new Date(fechaEntrada).getTime()) / 60000);

// Aviso sonoro + vibración cuando un vehículo queda listo — para que el
// encargado se entere sin tener que estar mirando la pantalla todo el rato.
// Beep generado con Web Audio (sin archivo de audio que cargar).
const avisarVehiculoListo = () => {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.setValueAtTime(1046, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.16, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
    setTimeout(() => ctx.close(), 500);
  } catch { /* navegadores sin Web Audio: se ignora, no es crítico */ }
  if (navigator.vibrate) navigator.vibrate([120, 60, 120]);
};


// Un servicio de lavado puede costar distinto según el vehículo (moto, carro,
// SUV…). Eso se modela como UN producto-servicio con VARIANTES — la misma
// herramienta de variantes por atributo que ya existe en Productos — donde
// cada variante representa un tipo de vehículo. Si el servicio no tiene
// variantes, aplica igual a cualquier vehículo con su precio base. Si tiene
// variantes pero ninguna coincide con el vehículo seleccionado, ese servicio
// no aplica y se oculta de la grilla.
const resolverServicioParaVehiculo = (servicio, tipoVehiculo) => {
  const variantes = (servicio.variantes || []).filter(v => v.activo !== false);
  if (!servicio.tiene_variantes || variantes.length === 0) {
    return { disponible: true, precio: parseFloat(servicio.precio_venta ?? servicio.precio ?? 0) };
  }
  const match = variantes.find(v =>
    Object.values(v.atributos || {}).some(val => String(val).toLowerCase() === String(tipoVehiculo).toLowerCase())
  );
  if (!match) return { disponible: false, precio: 0 };
  return { disponible: true, precio: parseFloat(match.precio ?? servicio.precio_venta ?? servicio.precio ?? 0) };
};

const SectionLabel = ({ children, step }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.2 }}>
    {step && (
      <Box sx={{
        width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
        bgcolor: ACCENT, color: 'white', fontSize: 11, fontWeight: 800,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {step}
      </Box>
    )}
    <Typography sx={{ fontWeight: 700, fontSize: 11, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.8 }}>
      {children}
    </Typography>
  </Box>
);

/* ── Arrastrar y soltar entre columnas del tablero ────────────────────────── */
function DraggableOrdenCard({ id, children }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: `orden-${id}` });
  const style = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    zIndex: isDragging ? 50 : 'auto',
    opacity: isDragging ? 0.9 : 1,
    position: 'relative',
  };
  return <div ref={setNodeRef} style={style}>{children({ listeners, attributes })}</div>;
}

function DroppableColumn({ id, children }) {
  const { setNodeRef, isOver } = useDroppable({ id: `col-${id}` });
  return (
    <Box ref={setNodeRef} sx={{
      minHeight: 80, borderRadius: 2, transition: 'background-color 0.15s',
      bgcolor: isOver ? alpha(ACCENT, 0.06) : 'transparent',
      outline: isOver ? `2px dashed ${alpha(ACCENT, 0.4)}` : 'none',
      p: isOver ? 0.5 : 0,
    }}>
      {children}
    </Box>
  );
}

/* ── Tarjeta de orden en el tablero ─────────────────────────────────────── */
function OrdenCard({ orden, estadoConfig, onEstadoChange, onCobrar, onCancelar, trabajadores, dragHandleProps }) {
  const TipoIcon = iconoParaVehiculo(orden.tipo_vehiculo || '');
  const [cambiandoLavador, setCambiandoLavador] = useState(false);
  const [nuevoLavadorObj, setNuevoLavadorObj] = useState(null);
  const [confirmandoCambio, setConfirmandoCambio] = useState(false);

  const demorado = estadoConfig.key === 'lavando' && getElapsedMinutes(orden.fecha_entrada) > MINUTOS_DEMORA;

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
        borderRadius: 2.5,
        border: demorado ? `1.5px solid ${RED}60` : `1.5px solid ${estadoConfig.color}30`,
        bgcolor: estadoConfig.bg, mb: 1.5, overflow: 'hidden',
        transition: 'box-shadow 0.15s, transform 0.15s',
        '&:hover': { boxShadow: `0 6px 18px ${estadoConfig.color}25`, transform: 'translateY(-1px)' },
      }}
    >
      <Box sx={{ height: 3, bgcolor: demorado ? RED : estadoConfig.color }} />
      <Box sx={{ p: 1.8 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.8 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4 }}>
            {dragHandleProps && (
              <Box
                {...dragHandleProps.listeners}
                {...dragHandleProps.attributes}
                sx={{
                  display: { xs: 'none', md: 'flex' },
                  cursor: 'grab', color: 'text.disabled', touchAction: 'none',
                  '&:active': { cursor: 'grabbing' },
                }}
              >
                <DragIndicator sx={{ fontSize: 18 }} />
              </Box>
            )}
            <Typography sx={{ fontSize: 20, fontWeight: 900, letterSpacing: 2, color: estadoConfig.color }}>
              {orden.placa}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'text.secondary' }}>
            <TipoIcon sx={{ fontSize: 16 }} />
            <Typography sx={{ fontSize: 11 }}>{orden.tipo_vehiculo || '—'}</Typography>
          </Box>
        </Box>

        {demorado && (
          <Box sx={{
            display: 'flex', alignItems: 'center', gap: 0.5, mb: 1,
            px: 1, py: 0.4, borderRadius: 1, bgcolor: `${RED}12`,
          }}>
            <WarningAmber sx={{ fontSize: 14, color: RED }} />
            <Typography sx={{ fontSize: 10.5, fontWeight: 700, color: RED }}>
              Lleva más de {MINUTOS_DEMORA} min lavando
            </Typography>
          </Box>
        )}

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
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6,
              bgcolor: `${BLUE}12`, pl: 0.4, pr: 1, py: 0.3, borderRadius: 5 }}>
              <Box sx={{
                width: 16, height: 16, borderRadius: '50%', bgcolor: BLUE, color: 'white',
                fontSize: 9, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {orden.operador_nombre[0]?.toUpperCase()}
              </Box>
              <Typography sx={{ fontSize: 11, fontWeight: 600, color: BLUE }}>{orden.operador_nombre}</Typography>
            </Box>
          )}
          {orden.cliente_nombre && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4,
              bgcolor: `${GREEN}12`, px: 1, py: 0.3, borderRadius: 5 }}>
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
          {estadoConfig.prevKey && (
            <Tooltip title={estadoConfig.prevLabel}>
              <IconButton
                size="small"
                onClick={() => onEstadoChange(orden.id, estadoConfig.prevKey)}
                sx={{
                  border: '1px solid', borderColor: 'divider', borderRadius: 1.5,
                  color: 'text.secondary', flexShrink: 0,
                }}
              >
                <Undo sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
          )}
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
          <Tooltip title="Cancelar orden">
            <IconButton
              size="small"
              onClick={() => {
                if (window.confirm(`¿Cancelar la orden de ${orden.placa}? Esta acción no se puede deshacer.`)) {
                  onCancelar(orden.id);
                }
              }}
              sx={{
                border: '1px solid', borderColor: `${RED}40`, borderRadius: 1.5,
                color: RED, flexShrink: 0,
              }}
            >
              <Cancel sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
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
function ItemCard({ item, enCarrito, onAgregar, precio }) {
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
        {formatCurrency(precio ?? item.precio_venta ?? item.precio ?? 0)}
      </Typography>
    </Paper>
  );
}

/* ── KPI del día, estilo "premium" con blob de gradiente ─────────────────── */
function DiaKpiCard({ label, value, icon, gradient, isDark }) {
  return (
    <Paper elevation={0} sx={{
      p: 1.8, borderRadius: 3, flex: '1 1 0', minWidth: 128,
      position: 'relative', overflow: 'hidden',
      border: '1px solid',
      borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
      background: isDark ? 'rgba(255,255,255,0.03)' : '#fff',
      boxShadow: isDark ? '0 2px 14px rgba(0,0,0,0.25)' : '0 2px 12px rgba(0,0,0,0.05)',
      transition: 'transform 0.15s, box-shadow 0.15s',
      '&:hover': { transform: 'translateY(-2px)', boxShadow: isDark ? '0 6px 22px rgba(0,0,0,0.35)' : '0 6px 22px rgba(0,0,0,0.09)' },
      '&::after': {
        content: '""', position: 'absolute', width: 64, height: 64, borderRadius: '50%',
        background: gradient, opacity: 0.14, top: -18, right: -18,
      },
    }}>
      <Box sx={{ position: 'relative', zIndex: 1 }}>
        <Box sx={{
          width: 30, height: 30, borderRadius: 1.5, mb: 1,
          background: gradient, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {React.cloneElement(icon, { sx: { color: '#fff', fontSize: 16 } })}
        </Box>
        <Typography sx={{ fontSize: 10, color: 'text.secondary', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          {label}
        </Typography>
        <Typography sx={{ fontSize: 18, fontWeight: 800, letterSpacing: -0.3, lineHeight: 1.25 }}>
          {value}
        </Typography>
      </Box>
    </Paper>
  );
}

/* ══════════════════════════════════════════════════════════════════════════ */
export default function LavaderoVentas({ user }) {
  const isAdmin = user?.role?.name === 'Admin';
  const theme    = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isDark   = theme.palette.mode === 'dark';
  const navigate = useNavigate();
  const busquedaServRef = useRef(null);

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
  const [boardSearch,  setBoardSearch]  = useState('');
  const [resumenHoy,   setResumenHoy]   = useState(null);
  const [vehiculosFrecuentes, setVehiculosFrecuentes] = useState([]);

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
  const prevOrdenesRef = useRef([]);

  const fetchOrdenes = useCallback(async () => {
    try {
      const { data } = await apiClient.get('/lavadero/ordenes', { params: { activas: true } });
      // Aviso sonoro cuando un vehículo QUEDA listo (pasa a "terminado") —
      // así el encargado se entera aunque no esté mirando la pantalla.
      const prevMap = new Map(prevOrdenesRef.current.map(o => [o.id, o.estado]));
      const recienTerminados = data.filter(o => o.estado === 'terminado' && prevMap.get(o.id) && prevMap.get(o.id) !== 'terminado');
      if (recienTerminados.length > 0) avisarVehiculoListo();
      prevOrdenesRef.current = data;
      setOrdenes(data);
    } catch { /* silent */ } finally { setLoadingBoard(false); }
  }, []);

  const fetchResumenHoy = useCallback(async () => {
    try {
      const hoy = new Date().toISOString().slice(0, 10);
      const { data } = await apiClient.get('/lavadero/reporte', { params: { fecha_inicio: hoy, fecha_fin: hoy } });
      setResumenHoy(data.resumen || null);
    } catch { /* silent — el header KPI es informativo, no crítico */ }
  }, []);

  const fetchVehiculosFrecuentes = useCallback(async () => {
    try {
      const { data } = await apiClient.get('/lavadero/vehiculos-frecuentes');
      setVehiculosFrecuentes(data || []);
    } catch { /* silent */ }
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
    fetchResumenHoy();
    fetchVehiculosFrecuentes();
    fetchItems();
    fetchTrabajadores();
    fetchClientes();
    fetchConfig();
    apiClient.get('/empresa/link-pago').then(({ data }) => setMetodoLinkQR(data || null)).catch(() => {});
    apiClient.get('/empresa/config-ventas').then(({ data }) => setConfigFidel({
      activa:      data.fidelizacion_activa     ?? true,
      redeem_rate: data.fidelizacion_redeem_rate ?? 100,
    })).catch(() => {});
  }, [fetchOrdenes, fetchResumenHoy, fetchVehiculosFrecuentes, fetchItems, fetchTrabajadores, fetchClientes, fetchConfig]);

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
    const id = setInterval(() => { fetchOrdenes(); fetchResumenHoy(); setTick(t => t + 1); }, 30000);
    return () => clearInterval(id);
  }, [fetchOrdenes, fetchResumenHoy]);

  /* ── Cart helpers ─────────────────────────────────────────────────────── */
  const agregarItem = (item, esServicio) => {
    const precioResuelto = esServicio
      ? resolverServicioParaVehiculo(item, tipoVehiculo).precio
      : parseFloat(item.precio_venta ?? item.precio ?? 0);
    setCarrito(prev => {
      const ex = prev.find(i => i.productoId === item.id);
      if (ex) return prev.map(i => i.productoId === item.id ? { ...i, cantidad: i.cantidad + 1 } : i);
      return [...prev, {
        productoId:   item.id,
        nombre:       item.nombre,
        precio:       precioResuelto,
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

  // Solo se muestran los servicios que aplican al tipo de vehículo elegido:
  // sin variantes (aplican a cualquiera) o con una variante para ese vehículo.
  // Categorías de vehículo reales del negocio: se toman de TODOS los valores
  // de variante que existan en los servicios, sin importar cómo se llame el
  // atributo (Vehículo, Presentación, etc.) — no de una lista fija, así cada
  // lavadero usa las suyas (Automóvil, Moto, Camioneta Grande, Taxi…).
  const opcionesVehiculo = useMemo(() => {
    const set = new Set();
    servicios.forEach(s => (s.variantes || []).forEach(v => {
      Object.values(v.atributos || {}).forEach(val => { if (val) set.add(String(val)); });
    }));
    return set.size > 0 ? Array.from(set) : TIPOS_VEHICULO.map(t => t.label);
  }, [servicios]);

  // Si el vehículo seleccionado ya no existe entre las opciones reales
  // (ej. al cargar los servicios por primera vez), cae al primero disponible.
  useEffect(() => {
    if (opcionesVehiculo.length > 0 && !opcionesVehiculo.includes(tipoVehiculo)) {
      setTipoVehiculo(opcionesVehiculo[0]);
    }
  }, [opcionesVehiculo]); // eslint-disable-line react-hooks/exhaustive-deps

  const serviciosFiltrados = useMemo(() => {
    let list = servicios.filter(s => resolverServicioParaVehiculo(s, tipoVehiculo).disponible);
    if (busquedaServ.trim()) {
      const q = busquedaServ.toLowerCase();
      list = list.filter(s => s.nombre.toLowerCase().includes(q));
    }
    return list;
  }, [servicios, busquedaServ, tipoVehiculo]);

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
      fetchVehiculosFrecuentes();
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

  /* ── Cancelar orden ───────────────────────────────────────────────────── */
  const handleCancelarOrden = async (ordenId) => {
    setOrdenes(prev => prev.filter(o => o.id !== ordenId));
    try {
      await apiClient.post(`/lavadero/ordenes/${ordenId}/cancelar`);
      toast.success('Orden cancelada.');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al cancelar la orden.');
    } finally {
      fetchOrdenes();
    }
  };

  /* ── Arrastrar y soltar en el tablero ─────────────────────────────────── */
  const dndSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over) return;
    const ordenId = Number(String(active.id).replace('orden-', ''));
    const nuevoEstado = String(over.id).replace('col-', '');
    const orden = ordenes.find(o => o.id === ordenId);
    if (!orden || orden.estado === nuevoEstado) return;
    handleEstadoChange(ordenId, nuevoEstado);
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
      fetchResumenHoy();
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
    const q = boardSearch.trim().toUpperCase();
    const filtradas = q ? ordenes.filter(o => o.placa.includes(q)) : ordenes;
    const map = { recibido: [], lavando: [], terminado: [] };
    filtradas.forEach(o => { if (map[o.estado]) map[o.estado].push(o); });
    return map;
  }, [ordenes, boardSearch]);

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
          onClick={() => { fetchOrdenes(); fetchResumenHoy(); }}
          sx={{ borderRadius: 2, textTransform: 'none', borderColor: 'divider' }}
        >
          Actualizar tablero
        </Button>
      </Box>

      {/* ── KPIs del día, siempre visibles mientras se trabaja ── */}
      <Box sx={{ display: 'flex', gap: 1.2, mb: 2.5, flexWrap: 'wrap' }}>
        <DiaKpiCard
          label="Activos ahora" value={activeCount}
          icon={<LocalCarWash />} gradient={`linear-gradient(135deg, ${ACCENT}, ${BLUE})`}
          isDark={isDark}
        />
        <DiaKpiCard
          label="Lavados hoy" value={resumenHoy?.total_lavadas ?? '—'}
          icon={<Bolt />} gradient={`linear-gradient(135deg, ${AMBER}, #F97316)`}
          isDark={isDark}
        />
        <DiaKpiCard
          label="Ingresos hoy" value={resumenHoy ? formatCurrency(resumenHoy.total_ventas || 0) : '—'}
          icon={<AttachMoney />} gradient={`linear-gradient(135deg, ${GREEN}, #059669)`}
          isDark={isDark}
        />
        <DiaKpiCard
          label="Prom./lavada hoy"
          value={resumenHoy && resumenHoy.total_lavadas > 0
            ? formatCurrency(resumenHoy.total_ventas / resumenHoy.total_lavadas)
            : '—'}
          icon={<TrendingUp />} gradient={`linear-gradient(135deg, #8B5CF6, #6366F1)`}
          isDark={isDark}
        />
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
          {isMobile ? (
            /* ── Móvil: tarjetas (evita el scroll horizontal de 11 columnas) ── */
            historial.length === 0 && !histLoading ? (
              <Paper sx={{ p: 4, borderRadius: 3, textAlign: 'center', color: 'text.disabled' }}>
                Sin registros. Usa los filtros y presiona Buscar.
              </Paper>
            ) : (
              <Stack spacing={1.5}>
                {historial.map(h => {
                  const feColor = h.estado_fe === 'exitoso' ? GREEN : h.estado_fe === 'fallido' ? RED : '#94a3b8';
                  const feLabel = h.estado_fe === 'exitoso' ? 'Emitida' : h.estado_fe === 'fallido' ? 'Fallida' : 'Sin FE';
                  return (
                    <Paper key={h.id} sx={{ p: 2, borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                        <Box>
                          <Typography sx={{ fontSize: 15, fontWeight: 800, letterSpacing: 2, fontFamily: 'monospace' }}>{h.placa}</Typography>
                          <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
                            {h.tipo_vehiculo || '—'} · {h.fecha_salida ? new Date(h.fecha_salida).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                            {h.fecha_salida ? ` · ${new Date(h.fecha_salida).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}` : ''}
                          </Typography>
                        </Box>
                        <Typography sx={{ fontSize: 15, fontWeight: 800, color: GREEN }}>
                          ${new Intl.NumberFormat('es-CO').format(h.total || 0)}
                        </Typography>
                      </Box>

                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.4, mb: 1 }}>
                        {(h.servicios || []).map((s, i) => (
                          <Chip key={i} label={`${s.nombre}${s.cantidad > 1 ? ` x${s.cantidad}` : ''}`} size="small"
                            sx={{ fontSize: 10, height: 18, bgcolor: alpha(ACCENT, 0.1), color: ACCENT }} />
                        ))}
                      </Box>

                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center', mb: 1 }}>
                        <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{h.metodo_pago || '—'}</Typography>
                        {h.cliente_nombre && <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>· {h.cliente_nombre}</Typography>}
                        {h.operador_nombre && <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>· {h.operador_nombre}</Typography>}
                      </Box>

                      <Divider sx={{ my: 1 }} />

                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Chip label={feLabel} size="small" sx={{ bgcolor: alpha(feColor, 0.1), color: feColor, fontWeight: 700, fontSize: 10, height: 20 }} />
                          {h.numero_factura && (
                            <Typography sx={{ fontSize: 11, fontFamily: 'monospace', fontWeight: 600, color: 'text.secondary' }}>{h.numero_factura}</Typography>
                          )}
                        </Box>
                        <Box sx={{ display: 'flex', gap: 0.3, alignItems: 'center' }}>
                          {h.pdf_url && (
                            <IconButton size="small" component="a" href={h.pdf_url} target="_blank" rel="noopener noreferrer" sx={{ color: '#EF4444' }}>
                              <PictureAsPdf fontSize="small" />
                            </IconButton>
                          )}
                          {h.venta_id && (h.estado_fe === 'fallido' || !h.estado_fe) && (
                            <IconButton size="small"
                              disabled={reintentando === h.venta_id}
                              onClick={() => reintentarFE(h.venta_id)}
                              sx={{ color: '#0891B2' }}
                            >
                              {reintentando === h.venta_id
                                ? <CircularProgress size={14} />
                                : <Replay fontSize="small" />}
                            </IconButton>
                          )}
                        </Box>
                      </Box>
                    </Paper>
                  );
                })}
              </Stack>
            )
          ) : (
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
                                    sx={{ color: '#0891B2' }}
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
          )}
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
            <SectionLabel step={1}>Vehículo</SectionLabel>
            <TextField
              label="Placa" fullWidth size="small"
              value={placa}
              onChange={e => setPlaca(formatPlaca(e.target.value))}
              onKeyDown={e => {
                if (e.key === 'Enter') { e.preventDefault(); busquedaServRef.current?.focus(); }
              }}
              inputProps={{ maxLength: 8, style: { textTransform: 'uppercase', fontWeight: 800, letterSpacing: 4, fontSize: 18 } }}
              placeholder="ABC-123"
              sx={{ mb: 2 }}
            />
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {opcionesVehiculo.map(label => {
                const Icon = iconoParaVehiculo(label);
                return (
                <Chip
                  key={label}
                  icon={<Icon sx={{ fontSize: 16 }} />}
                  label={label}
                  onClick={() => {
                    if (label !== tipoVehiculo && carrito.length > 0) {
                      setCarrito([]);
                      toast.info('Cambiaste el tipo de vehículo — se limpiaron los servicios seleccionados porque sus precios dependen del vehículo.');
                    }
                    setTipoVehiculo(label);
                  }}
                  sx={{
                    cursor: 'pointer', fontWeight: 600, fontSize: 12,
                    bgcolor: tipoVehiculo === label ? ACCENT : 'action.hover',
                    color:   tipoVehiculo === label ? 'white' : 'text.primary',
                    '&:hover': { filter: 'brightness(0.95)' },
                    '& .MuiChip-icon': { color: tipoVehiculo === label ? 'rgba(255,255,255,0.9)' : 'text.secondary' },
                  }}
                />
                );
              })}
            </Box>

            {vehiculosFrecuentes.length > 0 && (
              <Box sx={{ mt: 2, pt: 1.5, borderTop: '1px dashed', borderColor: 'divider' }}>
                <Typography sx={{ fontSize: 10.5, fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.6, mb: 0.8 }}>
                  Vehículos frecuentes
                </Typography>
                <Box sx={{ display: 'flex', gap: 0.8, flexWrap: 'wrap' }}>
                  {vehiculosFrecuentes.map(v => (
                    <Chip
                      key={v.placa}
                      label={`${v.placa}${v.cliente_nombre ? ` · ${v.cliente_nombre}` : ''}`}
                      size="small"
                      onClick={() => {
                        setPlaca(formatPlaca(v.placa));
                        if (v.tipo_vehiculo && opcionesVehiculo.includes(v.tipo_vehiculo)) {
                          setTipoVehiculo(v.tipo_vehiculo);
                        }
                        if (v.cliente_id) {
                          const c = clientes.find(cl => cl.id === v.cliente_id);
                          if (c) setClienteObj(c);
                        }
                      }}
                      sx={{
                        cursor: 'pointer', fontWeight: 600, fontSize: 11,
                        fontFamily: 'monospace', bgcolor: alpha(ACCENT, 0.08), color: ACCENT,
                        '&:hover': { bgcolor: alpha(ACCENT, 0.16) },
                      }}
                    />
                  ))}
                </Box>
              </Box>
            )}
          </Paper>

          {/* Servicios */}
          <Paper sx={{ p: 2.5, borderRadius: 3, mb: 2, border: '1px solid', borderColor: 'divider' }}>
            <SectionLabel step={2}>Servicios de lavado para {tipoVehiculo}</SectionLabel>
            <TextField
              inputRef={busquedaServRef}
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
                  : busquedaServ.trim()
                    ? 'Sin resultados para esta búsqueda.'
                    : `Ningún servicio tiene un precio configurado para "${tipoVehiculo}".`}
              </Typography>
            ) : (
              <Grid container spacing={1}>
                {serviciosFiltrados.map(s => (
                  <Grid item xs={6} key={s.id}>
                    <ItemCard
                      item={s}
                      precio={resolverServicioParaVehiculo(s, tipoVehiculo).precio}
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
              <SectionLabel step={3}>Asignar lavador</SectionLabel>
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
            <SectionLabel step={4}>Cliente (opcional)</SectionLabel>
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
            <SectionLabel step={5}>Observaciones</SectionLabel>
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
              bgcolor: ACCENT, '&:hover': { bgcolor: '#0e7490' },
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

        {/* ══ RIGHT: Resumen + accesos rápidos + Tablero kanban ══ */}
        <Grid item xs={12} md={7}
          sx={{ display: { xs: mobileView === 'tablero' ? 'block' : 'none', md: 'block' } }}
        >
          {/* Resumen de la orden en curso */}
          <Paper sx={{ p: 2.5, borderRadius: 3, mb: 2, border: '1px solid', borderColor: 'divider' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
              <Assignment sx={{ fontSize: 18, color: ACCENT }} />
              <Typography sx={{ fontWeight: 800, fontSize: 14 }}>Resumen de la orden</Typography>
            </Box>
            <Stack spacing={1.2}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
                <DirectionsCar sx={{ fontSize: 16, color: 'text.disabled' }} />
                <Box>
                  <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>Vehículo</Typography>
                  <Typography sx={{ fontSize: 13, fontWeight: 700 }}>
                    {placa ? `${placa} · ${tipoVehiculo}` : 'Sin placa'}
                  </Typography>
                </Box>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
                <LocalCarWash sx={{ fontSize: 16, color: 'text.disabled' }} />
                <Box>
                  <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>Servicios</Typography>
                  <Typography sx={{ fontSize: 13, fontWeight: 700 }}>
                    {carrito.length > 0 ? carrito.map(i => i.nombre).join(', ') : 'No seleccionado'}
                  </Typography>
                </Box>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
                <Person sx={{ fontSize: 16, color: 'text.disabled' }} />
                <Box>
                  <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>Lavador</Typography>
                  <Typography sx={{ fontSize: 13, fontWeight: 700 }}>
                    {operadorObj?.nombre_completo || operadorObj?.username || (isAdmin ? 'Sin asignar' : (user?.nombre_completo || user?.username || 'Sin asignar'))}
                  </Typography>
                </Box>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
                <Groups sx={{ fontSize: 16, color: 'text.disabled' }} />
                <Box>
                  <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>Cliente</Typography>
                  <Typography sx={{ fontSize: 13, fontWeight: 700 }}>
                    {clienteObj?.nombre || 'Sin asignar'}
                  </Typography>
                </Box>
              </Box>
            </Stack>
            <Box sx={{
              mt: 2, p: 1.5, borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              bgcolor: alpha(GREEN, 0.08), border: `1px solid ${alpha(GREEN, 0.25)}`,
            }}>
              <Typography sx={{ fontSize: 12, fontWeight: 700, color: GREEN }}>Total a pagar</Typography>
              <Typography sx={{ fontSize: 18, fontWeight: 900, color: GREEN }}>{formatCurrency(total)}</Typography>
            </Box>
          </Paper>

          {/* Accesos rápidos a módulos relacionados */}
          <Grid container spacing={1.2} sx={{ mb: 2 }}>
            {[
              { label: 'Clientes',  icon: <Groups />,   color: BLUE,  onClick: () => navigate('/clientes') },
              { label: 'Historial', icon: <History />,  color: AMBER, onClick: () => setMainTab(1) },
              { label: 'Reportes',  icon: <BarChart />, color: '#8B5CF6', onClick: () => navigate('/lavadero/reporte') },
              { label: 'Config.',   icon: <Bolt />,      color: ACCENT, onClick: () => navigate('/lavadero/config') },
            ].map(a => (
              <Grid item xs={6} sm={3} key={a.label}>
                <Paper
                  onClick={a.onClick}
                  elevation={0}
                  sx={{
                    p: 1.5, borderRadius: 2.5, cursor: 'pointer', textAlign: 'center',
                    bgcolor: alpha(a.color, 0.06), border: `1px solid ${alpha(a.color, 0.18)}`,
                    transition: 'transform 0.12s',
                    '&:hover': { transform: 'translateY(-1px)', bgcolor: alpha(a.color, 0.1) },
                  }}
                >
                  {React.cloneElement(a.icon, { sx: { color: a.color, fontSize: 20, mb: 0.4 } })}
                  <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: a.color }}>{a.label}</Typography>
                </Paper>
              </Grid>
            ))}
          </Grid>

          <Paper sx={{ p: 2.5, borderRadius: 3, border: '1px solid', borderColor: 'divider', height: '100%' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Typography sx={{ fontWeight: 800, fontSize: 15 }}>Tablero de órdenes</Typography>
              {loadingBoard && <CircularProgress size={16} sx={{ color: ACCENT }} />}
            </Box>

            <TextField
              size="small" fullWidth placeholder="Buscar por placa…"
              value={boardSearch}
              onChange={e => setBoardSearch(e.target.value.toUpperCase())}
              sx={{ mb: 2 }}
              InputProps={{
                startAdornment: <InputAdornment position="start"><Search sx={{ fontSize: 16, color: 'text.disabled' }} /></InputAdornment>,
                endAdornment: boardSearch ? (
                  <IconButton size="small" onClick={() => setBoardSearch('')}><Close sx={{ fontSize: 14 }} /></IconButton>
                ) : null,
              }}
            />

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

            {/* Desktop: 3 columnas, con arrastrar y soltar entre estados */}
            <DndContext sensors={dndSensors} onDragEnd={handleDragEnd}>
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
                  <DroppableColumn id={est.key}>
                    {(ordensPorEstado[est.key] || []).length === 0 ? (
                      <Box sx={{ py: 4, textAlign: 'center', opacity: 0.5 }}>
                        <LocalCarWash sx={{ fontSize: 26, color: est.color, mb: 0.5 }} />
                        <Typography sx={{ color: 'text.disabled', fontSize: 12 }}>Sin órdenes</Typography>
                      </Box>
                    ) : (
                      (ordensPorEstado[est.key] || []).map(o => (
                        <DraggableOrdenCard key={o.id} id={o.id}>
                          {(dragHandleProps) => (
                            <OrdenCard
                              orden={o}
                              estadoConfig={est}
                              trabajadores={trabajadores}
                              onEstadoChange={handleEstadoChange}
                              onCobrar={ord => { setCobrarOrden(ord); setMetodoPago('Efectivo'); setMontoRecibido(0); }}
                              onCancelar={handleCancelarOrden}
                              dragHandleProps={dragHandleProps}
                              tick={tick}
                            />
                          )}
                        </DraggableOrdenCard>
                      ))
                    )}
                  </DroppableColumn>
                </Grid>
              ))}
            </Grid>
            </DndContext>

            {/* Mobile: columna filtrada */}
            <Box sx={{ display: { xs: 'block', md: 'none' } }}>
              {(() => {
                const est   = ESTADOS_TABLERO.find(e => e.key === boardFilter);
                const lista = ordensPorEstado[boardFilter] || [];
                return lista.length === 0 ? (
                  <Box sx={{ py: 6, textAlign: 'center', opacity: 0.5 }}>
                    <LocalCarWash sx={{ fontSize: 34, color: est?.color, mb: 1 }} />
                    <Typography sx={{ color: 'text.disabled', fontSize: 13 }}>Sin órdenes en "{est?.label}"</Typography>
                  </Box>
                ) : lista.map(o => (
                  <OrdenCard
                    key={o.id} orden={o}
                    estadoConfig={est}
                    trabajadores={trabajadores}
                    onEstadoChange={handleEstadoChange}
                    onCobrar={ord => { setCobrarOrden(ord); setMetodoPago('Efectivo'); setMontoRecibido(0); }}
                    onCancelar={handleCancelarOrden}
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
