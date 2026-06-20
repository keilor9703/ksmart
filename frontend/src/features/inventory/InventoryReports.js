import React, { useEffect, useState, useMemo } from 'react';
import {
  Box, Typography, Grid, TextField, Button, Table, TableHead, TableRow,
  TableCell, TableBody, Tabs, Tab, Chip, TableContainer, Paper,
  Autocomplete, useMediaQuery, InputAdornment, Tooltip, Divider, CircularProgress,
  TableSortLabel, TablePagination, LinearProgress,
} from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';
import {
  Inventory2Outlined, Refresh, Download, TrendingUp, TrendingDown,
  Search, BarChart, ReceiptLong, AttachMoney, WarningAmber, CheckCircle,
} from '@mui/icons-material';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip as ChartTooltip,
  Legend,
} from 'chart.js';
import apiClient from '../../api';
import { formatCurrency } from '../../utils/formatters';
import { toast } from 'react-toastify';
import HelpGuideTopBar from '../../components/onboarding/HelpGuideTopBar';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, ChartTooltip, Legend);

const ACCENT = '#F59E0B';
const GREEN  = '#10B981';
const RED    = '#EF4444';
const BLUE   = '#3B82F6';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function TabPanel({ children, value, index }) {
  return (
    <div role="tabpanel" hidden={value !== index}>
      {value === index && <Box sx={{ pt: 2.5 }}>{children}</Box>}
    </div>
  );
}

const KpiCard = ({ label, value, icon, color }) => (
  <Paper sx={{ p: 2, borderRadius: 2.5, display: 'flex', alignItems: 'center', gap: 1.5, boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
    <Box sx={{ width: 38, height: 38, borderRadius: 1.5, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: `${color}18`, color }}>
      {icon}
    </Box>
    <Box>
      <Typography sx={{ fontSize: 11, color: 'text.secondary', fontWeight: 500 }}>{label}</Typography>
      <Typography sx={{ fontSize: 15, fontWeight: 700, color: 'text.primary' }}>{value}</Typography>
    </Box>
  </Paper>
);

const tipoChipConfig = {
  entrada:     { color: GREEN,  label: '↑ Entrada' },
  salida:      { color: RED,    label: '↓ Salida'  },
  ajuste:      { color: ACCENT, label: '⟳ Ajuste'  },
  venta:       { color: RED,    label: '⬇ Venta'   },
  compra:      { color: GREEN,  label: '⬆ Compra'  },
};
const TipoChip = ({ tipo }) => {
  const p = tipoChipConfig[tipo] || { color: '#94a3b8', label: tipo };
  return (
    <Chip label={p.label} size="small"
      sx={{ bgcolor: `${p.color}18`, color: p.color, fontWeight: 700, fontSize: 10, borderRadius: 1.5 }} />
  );
};

// ─── Margen helpers ────────────────────────────────────────────────────────────
const calcMargen = (precio, costo) => {
  const p = parseFloat(precio) || 0;
  const c = parseFloat(costo) || 0;
  if (!p) return null;
  return ((p - c) / p * 100);
};

const MargenChip = ({ precio, costo }) => {
  const pct = calcMargen(precio, costo);
  if (pct === null) return <Typography sx={{ color: 'text.disabled', fontSize: 12 }}>—</Typography>;
  const color = pct >= 30 ? GREEN : pct >= 10 ? '#F59E0B' : RED;
  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'center', px: 1, py: 0.2, borderRadius: 1.5, bgcolor: `${color}12`, border: `1px solid ${color}30` }}>
      <Typography sx={{ fontSize: 11, fontWeight: 700, color }}>{pct.toFixed(1)}%</Typography>
    </Box>
  );
};

// ─── Date preset helper ────────────────────────────────────────────────────────
function getPresetDates(key) {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  const todayStr = `${yyyy}-${mm}-${dd}`;

  const fmt = d => {
    const y = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const dy = String(d.getDate()).padStart(2, '0');
    return `${y}-${mo}-${dy}`;
  };

  if (key === 'mes') {
    return { start: `${yyyy}-${mm}-01`, end: todayStr };
  }
  if (key === 'trim') {
    const d = new Date(today);
    d.setMonth(d.getMonth() - 3);
    return { start: fmt(d), end: todayStr };
  }
  if (key === 'semestre' || key === 'sem') {
    const d = new Date(today);
    d.setMonth(d.getMonth() - 6);
    return { start: fmt(d), end: todayStr };
  }
  if (key === 'año') {
    return { start: `${yyyy}-01-01`, end: todayStr };
  }
  return { start: '', end: todayStr };
}

// ─── Tabla de rotación (desktop) ──────────────────────────────────────────────
const RotTable = ({ rows, emptyText, totalIngresos }) => (
  <TableContainer sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell>Producto</TableCell>
          <TableCell align="right">Cant. vendida</TableCell>
          <TableCell align="right">Ingresos</TableCell>
          <TableCell align="right">% Ingr.</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.length === 0
          ? <TableRow><TableCell colSpan={4} sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>{emptyText}</TableCell></TableRow>
          : rows.map((r, i) => (
            <TableRow key={r.producto_id} hover>
              <TableCell>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box sx={{ width: 22, height: 22, borderRadius: 1, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: i < 3 ? `${ACCENT}20` : 'action.hover', fontSize: 10, fontWeight: 700, color: i < 3 ? ACCENT : 'text.secondary' }}>
                    {i + 1}
                  </Box>
                  <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{r.nombre}</Typography>
                </Box>
              </TableCell>
              <TableCell align="right" sx={{ fontWeight: 700 }}>{r.total_cantidad_vendida}</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700, color: GREEN }}>{formatCurrency(r.total_ingresos)}</TableCell>
              <TableCell align="right" sx={{ fontSize: 12, color: 'text.secondary' }}>
                {totalIngresos > 0 ? `${(r.total_ingresos / totalIngresos * 100).toFixed(1)}%` : '—'}
              </TableCell>
            </TableRow>
          ))
        }
      </TableBody>
    </Table>
  </TableContainer>
);

// ─── Cards de rotación (mobile) ───────────────────────────────────────────────
const RotCards = ({ rows, emptyText, accentPill }) => {
  if (rows.length === 0) return (
    <Box sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
      <Typography fontSize={13}>{emptyText}</Typography>
    </Box>
  );
  return rows.map((r, i) => (
    <Paper key={r.producto_id} sx={{ p: 2, mb: 1.5, borderRadius: 2.5, border: '1px solid', borderColor: 'divider' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
          <Box sx={{ width: 24, height: 24, borderRadius: 1, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: i < 3 ? `${accentPill}20` : 'action.hover', fontSize: 10, fontWeight: 800, color: i < 3 ? accentPill : 'text.secondary' }}>
            {i + 1}
          </Box>
          <Typography sx={{ fontWeight: 700, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.nombre}</Typography>
        </Box>
        <Box sx={{ textAlign: 'right', flexShrink: 0, ml: 1 }}>
          <Typography sx={{ fontSize: 13, fontWeight: 800, color: GREEN }}>{formatCurrency(r.total_ingresos)}</Typography>
          <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{r.total_cantidad_vendida} uds.</Typography>
        </Box>
      </Box>
    </Paper>
  ));
};

// ─── Presets chip row ──────────────────────────────────────────────────────────
const PresetChips = ({ presets, onSelect }) => (
  <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mb: 1.5 }}>
    {presets.map(p => (
      <Chip
        key={p.key}
        label={p.label}
        size="small"
        onClick={() => onSelect(p.key)}
        sx={{ fontSize: 11, fontWeight: 600, borderRadius: 1.5, cursor: 'pointer', '&:hover': { bgcolor: `${ACCENT}18`, color: ACCENT } }}
      />
    ))}
  </Box>
);

// ─── Componente principal ──────────────────────────────────────────────────────
export default function InventoryReports() {
  const [tab, setTab] = useState(0);
  const theme         = useTheme();
  const isMobile      = useMediaQuery(theme.breakpoints.down('sm'));
  const isDark        = theme.palette.mode === 'dark';

  // Row backgrounds that adapt to dark/light mode
  const agotadoBg      = isDark ? alpha(RED,      0.18) : '#FEF2F2';
  const bajoBg         = isDark ? alpha(ACCENT,   0.14) : '#FFFBEB';
  const agotadoHeaderBg = isDark ? alpha('#7C3AED', 0.14) : alpha('#7C3AED', 0.05);
  const bajoHeaderBg   = isDark ? alpha(RED,      0.10) : alpha(RED,      0.05);

  // Inventario actual
  const [inv, setInv]                 = useState({ items: [], total_valor_costo: 0, total_valor_venta: 0 });
  const [invSearch, setInvSearch]     = useState('');
  const [invLoading, setInvLoading]   = useState(false);
  const [invSortCol, setInvSortCol]   = useState('nombre');
  const [invSortDir, setInvSortDir]   = useState('asc');
  const [invPage, setInvPage]         = useState(0);
  const [invRowsPerPage, setInvRowsPerPage] = useState(25);
  const [invTipo, setInvTipo]         = useState('todos'); // 'todos' | 'productos' | 'servicios'
  const [invStockFiltro, setInvStockFiltro] = useState('todos'); // 'todos' | 'bajo' | 'agotado'

  // Rotación
  const [rotStart, setRotStart]     = useState('');
  const [rotEnd, setRotEnd]         = useState('');
  const [rotLimit, setRotLimit]     = useState(10);
  const [rotIncServ, setRotIncServ] = useState(false);
  const [rot, setRot]               = useState({ top: [], slow: [] });
  const [rotLoaded, setRotLoaded]   = useState(false);
  const [rotLoading, setRotLoading] = useState(false);

  // Kardex
  const [productos, setProductos] = useState([]);
  const [producto, setProducto]   = useState(null);
  const [kStart, setKStart]       = useState('');
  const [kEnd, setKEnd]           = useState('');
  const [kRows, setKRows]         = useState([]);
  const [kLoaded, setKLoaded]     = useState(false);
  const [kLoading, setKLoading]   = useState(false);

  const loadInventario = async () => {
    setInvLoading(true);
    try {
      const { data } = await apiClient.get('/reportes/inventario-actual');
      setInv(data);
    } catch (e) { console.error(e); }
    finally { setInvLoading(false); }
  };

  const loadRotacion = async () => {
    setRotLoading(true);
    try {
      const params = { limit: rotLimit, incluir_servicios: rotIncServ };
      if (rotStart) params.start_date = rotStart;
      if (rotEnd)   params.end_date   = rotEnd;
      const { data } = await apiClient.get('/reportes/rotacion', { params });
      setRot(data); setRotLoaded(true);
    } catch (e) { console.error(e); }
    finally { setRotLoading(false); }
  };

  const handleExportRotacion = async () => {
    try {
      const params = new URLSearchParams();
      params.set('limit', rotLimit);
      params.set('incluir_servicios', rotIncServ);
      if (rotStart) params.set('start_date', rotStart);
      if (rotEnd)   params.set('end_date', rotEnd);

      const res = await apiClient.get(`/reportes/rotacion/export?${params}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      const filename = `rotacion_${rotStart || 'inicio'}_a_${rotEnd || 'hoy'}.xlsx`;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch {
      toast.error('Error al exportar reporte de rotación');
    }
  };

  const loadKardex = async () => {
    if (!producto) return;
    setKLoading(true);
    try {
      const params = {};
      if (kStart) params.start_date = kStart;
      if (kEnd)   params.end_date   = kEnd;
      const { data } = await apiClient.get(`/inventario/kardex/${producto.id}`, { params });
      setKRows(data.items || []); setKLoaded(true);
    } catch (e) { console.error(e); }
    finally { setKLoading(false); }
  };

  const handleExportKardex = async () => {
    if (!producto) return;
    try {
      const params = new URLSearchParams();
      if (kStart) params.set('start_date', kStart);
      if (kEnd)   params.set('end_date', kEnd);
      const res = await apiClient.get(`/inventario/kardex/${producto.id}/export?${params}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `kardex_${producto.nombre.replace(/\s+/g, '_')}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch {
      toast.error('Error al exportar kardex');
    }
  };

  const handleExportKardexCSV = () => {
    if (!kRows.length) return;
    const rows = [
      ['Fecha', 'Tipo', 'Cantidad', 'Costo Unit.', 'Referencia', 'Saldo Cant.', 'Saldo Costo', 'Saldo Valor'],
      ...kRows.map(r => [
        new Date(r.fecha).toLocaleDateString('es-CO'),
        r.tipo, r.cantidad, r.costo_unitario, r.referencia || '',
        r.saldo_cantidad, r.saldo_costo_unitario, r.saldo_valor,
      ]),
    ];
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `kardex_${producto?.nombre.replace(/\s+/g, '_') || 'producto'}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  useEffect(() => {
    loadInventario();
    apiClient.get('/productos/').then(res => setProductos(res.data || []));
  }, []);

  const handleExportInventario = async () => {
    try {
      const params = new URLSearchParams();
      if (invSearch) params.set('search', invSearch);
      const res = await apiClient.get(`/reportes/inventario-actual/export?${params}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'inventario_actual.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch {
      toast.error('Error al exportar inventario');
    }
  };

  // ── Sort + filter + paginate ────────────────────────────────────────────────
  const invFiltered = useMemo(() => {
    const q = invSearch.toLowerCase();
    let filtered = inv.items.filter(it => it.nombre.toLowerCase().includes(q));

    // Type filter
    if (invTipo === 'productos') filtered = filtered.filter(it => !it.es_servicio);
    else if (invTipo === 'servicios') filtered = filtered.filter(it => it.es_servicio);

    // Stock status filter
    if (invStockFiltro === 'bajo') {
      filtered = filtered.filter(it => it.stock_actual <= it.stock_minimo && it.stock_actual > 0);
    } else if (invStockFiltro === 'agotado') {
      filtered = filtered.filter(it => it.stock_actual === 0);
    }

    return [...filtered].sort((a, b) => {
      if (invSortCol === 'nombre') {
        return invSortDir === 'asc'
          ? a.nombre.localeCompare(b.nombre)
          : b.nombre.localeCompare(a.nombre);
      }
      const fields = {
        stock:    'stock_actual',
        minimo:   'stock_minimo',
        costo:    'costo',
        precio:   'precio',
        valCosto: 'valor_costo',
        valVenta: 'valor_venta',
      };
      const f = fields[invSortCol];
      if (f) return invSortDir === 'asc'
        ? (a[f] ?? 0) - (b[f] ?? 0)
        : (b[f] ?? 0) - (a[f] ?? 0);
      return 0;
    });
  }, [inv.items, invSearch, invSortCol, invSortDir, invTipo, invStockFiltro]);

  const invPaginated = useMemo(() =>
    invFiltered.slice(invPage * invRowsPerPage, invPage * invRowsPerPage + invRowsPerPage),
    [invFiltered, invPage, invRowsPerPage]
  );

  // ── Inventory KPI counts ─────────────────────────────────────────────────────
  const invBajoMinimo = useMemo(
    () => inv.items.filter(it => it.stock_actual <= it.stock_minimo && it.stock_actual > 0).length,
    [inv.items]
  );
  const invAgotados = useMemo(
    () => inv.items.filter(it => it.stock_actual === 0).length,
    [inv.items]
  );

  // ── InvSortHeader helper (defined inside component to close over state) ──────
  const InvSortHeader = ({ col, label, align = 'left' }) => (
    <TableCell align={align}>
      <TableSortLabel
        active={invSortCol === col}
        direction={invSortCol === col ? invSortDir : 'asc'}
        onClick={() => {
          setInvSortDir(d => invSortCol === col ? (d === 'asc' ? 'desc' : 'asc') : 'asc');
          setInvSortCol(col);
        }}
      >
        {label}
      </TableSortLabel>
    </TableCell>
  );

  // ── Rotación: total ingresos for % column ────────────────────────────────────
  const totalTopIngresos = useMemo(
    () => rot.top.reduce((s, r) => s + (r.total_ingresos || 0), 0),
    [rot.top]
  );

  // ── Rotación: bar chart data ─────────────────────────────────────────────────
  const rotBarData = useMemo(() => ({
    labels: rot.top.map(r => r.nombre),
    datasets: [{
      label: 'Ingresos',
      data: rot.top.map(r => r.total_ingresos),
      backgroundColor: `${GREEN}CC`,
      borderColor: GREEN,
      borderWidth: 1,
      borderRadius: 4,
    }],
  }), [rot.top]);

  const rotBarOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: ctx => formatCurrency(ctx.parsed.y),
        },
      },
    },
    scales: {
      x: { ticks: { font: { size: 10 }, maxRotation: 35, minRotation: 20 } },
      y: { ticks: { font: { size: 10 }, callback: v => formatCurrency(v) } },
    },
  };

  // ── Kardex: entry/exit summaries ─────────────────────────────────────────────
  const kEntradas = useMemo(
    () => kRows.filter(r => ['entrada', 'compra'].includes(r.tipo)),
    [kRows]
  );
  const kSalidas = useMemo(
    () => kRows.filter(r => ['salida', 'venta'].includes(r.tipo)),
    [kRows]
  );
  const totalEntradas = useMemo(() => kEntradas.reduce((s, r) => s + r.cantidad, 0), [kEntradas]);
  const totalSalidas  = useMemo(() => kSalidas.reduce((s, r) => s + r.cantidad, 0), [kSalidas]);

  // ── Alertas de stock (derived from inv.items) ────────────────────────────────
  const alertasAgotado = useMemo(
    () => inv.items.filter(it => !it.es_servicio && it.stock_actual === 0),
    [inv.items]
  );
  const alertasBajo = useMemo(
    () => inv.items.filter(it => !it.es_servicio && it.stock_actual > 0 && it.stock_actual <= it.stock_minimo && it.stock_minimo > 0),
    [inv.items]
  );
  const alertasSinMin = useMemo(
    () => inv.items.filter(it => !it.es_servicio && it.stock_actual > 0 && (!it.stock_minimo || it.stock_minimo === 0)),
    [inv.items]
  );
  const alertasTotal = alertasAgotado.length + alertasBajo.length;

  // ── Preset definitions ───────────────────────────────────────────────────────
  const PRESETS_ROT = [
    { key: 'mes',      label: 'Este mes'   },
    { key: 'trim',     label: 'Trimestre'  },
    { key: 'semestre', label: 'Semestre'   },
    { key: 'año',      label: 'Este año'   },
  ];

  const PRESETS_K = [
    { key: 'mes',  label: 'Este mes'         },
    { key: 'trim', label: 'Últimos 3 meses'  },
    { key: 'sem',  label: 'Últimos 6 meses'  },
    { key: 'año',  label: 'Este año'         },
  ];

  const TABS = [
    { label: 'Inventario', icon: <Inventory2Outlined fontSize="small" />, fullLabel: 'Inventario Actual' },
    { label: 'Rotación',   icon: <BarChart fontSize="small" />,           fullLabel: 'Rotación'          },
    { label: 'Kardex',     icon: <ReceiptLong fontSize="small" />,        fullLabel: 'Kardex (PPP)'      },
    {
      label: alertasTotal > 0 ? `Alertas (${alertasTotal})` : 'Alertas',
      icon: <WarningAmber fontSize="small" />,
      fullLabel: 'Alertas de Stock',
    },
  ];

  return (
    <Box sx={{ width: '100%' }}>

      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1.5, mb: 2.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ width: 38, height: 38, borderRadius: 2, bgcolor: `${ACCENT}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: ACCENT, flexShrink: 0 }}>
            <BarChart />
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontWeight: 700, fontSize: 18, lineHeight: 1.2 }}>Reportes de Inventario</Typography>
            <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>Inventario actual, rotación y kardex</Typography>
          </Box>
        </Box>
        <HelpGuideTopBar
          moduleName="Reportes de Inventario"
          moduleColor={ACCENT}
          steps={[
            { title: 'Inventario actual', description: 'La pestaña "Inventario" muestra el stock disponible de todos los productos con su valor en dinero.' },
            { title: 'Rotación y ventas', description: 'Analiza qué productos se venden más y cuáles tienen baja rotación para tomar decisiones de compra.' },
            { title: 'Kardex de movimientos', description: 'El Kardex registra cada entrada y salida de un producto. Filtra por producto y fecha para ver el historial detallado.' },
            { title: 'Alertas de stock', description: 'Los productos con stock igual o menor al mínimo configurado aparecen resaltados en rojo.' },
          ]}
          faqItems={[
            { q: '¿Qué es el Kardex?', a: 'Es el registro cronológico de todas las entradas y salidas de un producto: compras, ventas, ajustes y devoluciones.' },
            { q: '¿Cómo sé qué productos están por agotarse?', a: 'Revisa la pestaña de inventario. Los productos con stock igual o menor al mínimo se muestran en rojo o con alerta.' },
            { q: '¿Puedo exportar el inventario actual?', a: 'Sí, usa el botón de descarga CSV disponible en la pestaña de inventario para exportar a Excel.' },
            { q: '¿Cómo calcula el valor del inventario?', a: 'Multiplica el stock actual de cada producto por su costo registrado. La suma total es el valor del inventario.' },
          ]}
        />
      </Box>

      {/* Tabs + contenido */}
      <Paper sx={{ borderRadius: 3, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', border: '1px solid', borderColor: 'divider', width: '100%', boxSizing: 'border-box' }}>
        <Tabs
          value={tab} onChange={(_, v) => setTab(v)}
          variant={isMobile ? 'fullWidth' : 'scrollable'}
          scrollButtons={isMobile ? false : 'auto'}
          sx={{
            borderBottom: '1px solid', borderColor: 'divider',
            '& .MuiTab-root': { fontWeight: 600, fontSize: 12, textTransform: 'none', minHeight: isMobile ? 48 : 52, minWidth: isMobile ? 0 : 'auto', px: isMobile ? 0.5 : 2 },
            '& .MuiTabs-indicator': { backgroundColor: ACCENT, height: 3, borderRadius: 3 },
            '& .Mui-selected': { color: `${ACCENT} !important` },
          }}
        >
          {TABS.map((t, i) => (
            <Tab key={i}
              icon={t.icon}
              iconPosition={isMobile ? 'top' : 'start'}
              label={isMobile ? undefined : t.label}
              title={t.fullLabel}
              sx={isMobile ? { gap: 0, '& .MuiTab-iconWrapper': { mb: 0 } } : { gap: 0.6 }}
            />
          ))}
        </Tabs>

        {isMobile && (
          <Box sx={{ px: 2, pt: 1.5, pb: 0.5 }}>
            <Typography sx={{ fontWeight: 700, fontSize: 13, color: ACCENT }}>{TABS[tab].fullLabel}</Typography>
          </Box>
        )}

        <Box sx={{ p: { xs: 1.5, md: 3 } }}>

          {/* ══ Tab 0: Inventario Actual ══ */}
          <TabPanel value={tab} index={0}>
            {/* KPIs */}
            <Grid container spacing={1.5} sx={{ mb: 2.5 }}>
              <Grid size={{ xs: 6, sm: 4, md: 2.4 }}>
                <KpiCard label="Valor a costo" value={formatCurrency(inv.total_valor_costo)} icon={<AttachMoney />} color={ACCENT} />
              </Grid>
              <Grid size={{ xs: 6, sm: 4, md: 2.4 }}>
                <KpiCard label="Valor a precio venta" value={formatCurrency(inv.total_valor_venta)} icon={<TrendingUp />} color={GREEN} />
              </Grid>
              <Grid size={{ xs: 6, sm: 4, md: 2.4 }}>
                <KpiCard label="Total ítems" value={inv.items.length} icon={<Inventory2Outlined />} color={BLUE} />
              </Grid>
              <Grid size={{ xs: 6, sm: 6, md: 2.4 }}>
                <KpiCard label="Bajo mínimo" value={invBajoMinimo} icon={<WarningAmber />} color={RED} />
              </Grid>
              <Grid size={{ xs: 6, sm: 6, md: 2.4 }}>
                <KpiCard label="Agotados" value={invAgotados} icon={<WarningAmber />} color="#7C3AED" />
              </Grid>
            </Grid>

            {/* Type filter chips */}
            <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mb: 1 }}>
              {[
                { key: 'todos',     label: 'Todos'     },
                { key: 'productos', label: 'Productos' },
                { key: 'servicios', label: 'Servicios' },
              ].map(c => (
                <Chip
                  key={c.key}
                  label={c.label}
                  size="small"
                  onClick={() => { setInvTipo(c.key); setInvPage(0); }}
                  sx={{
                    fontSize: 11, fontWeight: 600, borderRadius: 1.5, cursor: 'pointer',
                    bgcolor: invTipo === c.key ? `${ACCENT}18` : undefined,
                    color:   invTipo === c.key ? ACCENT : 'text.secondary',
                    border:  invTipo === c.key ? `1px solid ${ACCENT}40` : '1px solid transparent',
                  }}
                />
              ))}

              <Box sx={{ width: 1, height: 0, flexBasis: '100%', display: { xs: 'none', sm: 'none' } }} />

              {/* Stock status chips */}
              {[
                { key: 'todos',   label: 'Todos'        },
                { key: 'bajo',    label: 'Bajo mínimo'  },
                { key: 'agotado', label: 'Agotados'     },
              ].map(c => (
                <Chip
                  key={`stock-${c.key}`}
                  label={c.label}
                  size="small"
                  onClick={() => { setInvStockFiltro(c.key); setInvPage(0); }}
                  sx={{
                    fontSize: 11, fontWeight: 600, borderRadius: 1.5, cursor: 'pointer',
                    bgcolor: invStockFiltro === c.key ? `${RED}12` : undefined,
                    color:   invStockFiltro === c.key ? RED : 'text.secondary',
                    border:  invStockFiltro === c.key ? `1px solid ${RED}40` : '1px solid transparent',
                  }}
                />
              ))}
            </Box>

            {/* Toolbar */}
            <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
              <TextField
                placeholder="Buscar producto…"
                value={invSearch}
                onChange={e => { setInvSearch(e.target.value); setInvPage(0); }}
                size="small"
                sx={{ flex: 1, minWidth: isMobile ? '100%' : 200 }}
                InputProps={{
                  startAdornment: <InputAdornment position="start"><Search sx={{ color: 'text.secondary', fontSize: 18 }} /></InputAdornment>,
                }}
              />
              <Button size="small" startIcon={<Refresh />} onClick={loadInventario} variant="outlined"
                disabled={invLoading}
                sx={{ borderRadius: 2, fontWeight: 600, borderColor: 'divider', color: 'text.secondary', whiteSpace: 'nowrap', flexShrink: 0 }}>
                {invLoading ? <CircularProgress size={14} /> : 'Actualizar'}
              </Button>
              <Button size="small" startIcon={<Download />} variant="contained"
                onClick={handleExportInventario}
                sx={{ background: `linear-gradient(135deg, ${ACCENT}, #fcd34d)`, borderRadius: 2, fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0 }}>
                Excel
              </Button>
            </Box>

            {/* Mobile: cards */}
            {isMobile ? (
              <Box>
                {invFiltered.length === 0
                  ? <Box sx={{ textAlign: 'center', py: 5, color: 'text.secondary' }}><Typography>Sin resultados</Typography></Box>
                  : invFiltered.map(it => {
                    const bgColor = it.stock_actual === 0
                      ? agotadoBg
                      : (it.stock_actual <= it.stock_minimo && it.stock_actual > 0 ? bajoBg : undefined);
                    return (
                      <Paper key={it.id} sx={{ p: 2, mb: 1.5, borderRadius: 2.5, border: '1px solid', borderColor: 'divider', bgcolor: bgColor }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <Box sx={{ minWidth: 0, flex: 1 }}>
                            <Typography sx={{ fontWeight: 700, fontSize: 13, mb: 0.3 }}>{it.nombre}</Typography>
                            <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{it.unidad_medida || '—'}</Typography>
                          </Box>
                          <Box sx={{ textAlign: 'right', flexShrink: 0, ml: 1 }}>
                            <Typography sx={{ fontSize: 15, fontWeight: 800, color: ACCENT }}>
                              {it.stock_actual} <Typography component="span" sx={{ fontSize: 10, fontWeight: 400, color: 'text.secondary' }}>uds.</Typography>
                            </Typography>
                            {it.stock_minimo > 0 && (
                              <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>Mín: {it.stock_minimo}</Typography>
                            )}
                          </Box>
                        </Box>
                        <Divider sx={{ my: 1 }} />
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                          <Box>
                            <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>Val. costo</Typography>
                            <Typography sx={{ fontSize: 13, fontWeight: 700, color: ACCENT }}>{formatCurrency(it.valor_costo)}</Typography>
                          </Box>
                          <Box sx={{ textAlign: 'right' }}>
                            <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>Val. venta</Typography>
                            <Typography sx={{ fontSize: 13, fontWeight: 700, color: GREEN }}>{formatCurrency(it.valor_venta)}</Typography>
                          </Box>
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
                          <Box>
                            <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>Margen</Typography>
                            <MargenChip precio={it.precio} costo={it.costo} />
                          </Box>
                        </Box>
                      </Paper>
                    );
                  })
                }
              </Box>
            ) : (
              /* Desktop: tabla */
              <>
                <TableContainer sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider', overflowX: 'auto' }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>#</TableCell>
                        <InvSortHeader col="nombre"   label="Nombre"     align="left"  />
                        <TableCell>Unidad</TableCell>
                        <InvSortHeader col="stock"    label="Stock"      align="right" />
                        <InvSortHeader col="minimo"   label="Mín."       align="right" />
                        <InvSortHeader col="costo"    label="Costo"      align="right" />
                        <InvSortHeader col="precio"   label="Precio"     align="right" />
                        <InvSortHeader col="valCosto" label="Val. Costo" align="right" />
                        <InvSortHeader col="valVenta" label="Val. Venta" align="right" />
                        <TableCell align="right">Margen</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {invPaginated.length === 0
                        ? <TableRow><TableCell colSpan={10} sx={{ textAlign: 'center', py: 5, color: 'text.secondary' }}>No hay ítems</TableCell></TableRow>
                        : invPaginated.map(it => {
                          const rowBg = it.stock_actual === 0
                            ? agotadoBg
                            : (it.stock_actual <= it.stock_minimo && it.stock_actual > 0 ? bajoBg : undefined);
                          return (
                            <TableRow key={it.id} hover sx={{ bgcolor: rowBg }}>
                              <TableCell sx={{ fontWeight: 600, color: 'text.secondary', fontSize: 12 }}>#{it.id}</TableCell>
                              <TableCell>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                  <Typography sx={{ fontWeight: 600, fontSize: 13 }}>{it.nombre}</Typography>
                                  {it.es_servicio && <Chip label="Servicio" size="small" sx={{ fontSize: 9, height: 16, borderRadius: 1 }} />}
                                </Box>
                              </TableCell>
                              <TableCell sx={{ fontSize: 12 }}>{it.unidad_medida || '—'}</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 700 }}>{it.stock_actual}</TableCell>
                              <TableCell align="right" sx={{ fontSize: 12, color: 'text.secondary' }}>{it.stock_minimo ?? '—'}</TableCell>
                              <TableCell align="right">{formatCurrency(it.costo)}</TableCell>
                              <TableCell align="right">{formatCurrency(it.precio)}</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 700, color: ACCENT }}>{formatCurrency(it.valor_costo)}</TableCell>
                              <TableCell align="right" sx={{ color: GREEN, fontWeight: 600 }}>{formatCurrency(it.valor_venta)}</TableCell>
                              <TableCell align="right"><MargenChip precio={it.precio} costo={it.costo} /></TableCell>
                            </TableRow>
                          );
                        })
                      }
                    </TableBody>
                  </Table>
                </TableContainer>
                <TablePagination
                  rowsPerPageOptions={[10, 25, 50, 100]}
                  component="div"
                  count={invFiltered.length}
                  rowsPerPage={invRowsPerPage}
                  page={invPage}
                  onPageChange={(_, p) => setInvPage(p)}
                  onRowsPerPageChange={e => { setInvRowsPerPage(parseInt(e.target.value, 10)); setInvPage(0); }}
                  labelRowsPerPage="Filas:"
                  labelDisplayedRows={({ from, to, count }) => `${from}-${to} de ${count}`}
                  sx={{
                    '& .MuiTablePagination-toolbar': { flexWrap: 'wrap', pl: 0 },
                    '& .MuiTablePagination-spacer': { display: 'none' },
                    '& .MuiTablePagination-displayedRows': { fontSize: 11 },
                    '& .MuiTablePagination-selectLabel': { fontSize: 11 },
                  }}
                />
              </>
            )}
          </TabPanel>

          {/* ══ Tab 1: Rotación ══ */}
          <TabPanel value={tab} index={1}>
            {/* Date preset chips */}
            <PresetChips
              presets={PRESETS_ROT}
              onSelect={key => {
                const { start, end } = getPresetDates(key);
                setRotStart(start);
                setRotEnd(end);
              }}
            />

            <Paper sx={{ p: 2, borderRadius: 2.5, mb: 3, boxShadow: 'none', border: '1px solid', borderColor: 'divider' }}>
              <Typography sx={{ fontWeight: 600, fontSize: 11, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.6, mb: 1.5 }}>
                Parámetros
              </Typography>
              <Grid container spacing={1.5} alignItems="flex-end">
                <Grid size={{ xs: 6, sm: 3 }}>
                  <TextField type="date" label="Desde" size="small" value={rotStart}
                    onChange={e => setRotStart(e.target.value)} InputLabelProps={{ shrink: true }} fullWidth />
                </Grid>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <TextField type="date" label="Hasta" size="small" value={rotEnd}
                    onChange={e => setRotEnd(e.target.value)} InputLabelProps={{ shrink: true }} fullWidth />
                </Grid>
                <Grid size={{ xs: 6, sm: 2 }}>
                  <TextField type="number" label="Top N" size="small" value={rotLimit}
                    onChange={e => setRotLimit(parseInt(e.target.value || '10', 10))} fullWidth />
                </Grid>
                <Grid size={{ xs: 6, sm: 2 }}>
                  <TextField select label="Servicios" size="small"
                    SelectProps={{ native: true }}
                    value={rotIncServ ? '1' : '0'}
                    onChange={e => setRotIncServ(e.target.value === '1')} fullWidth>
                    <option value="0">No incluir</option>
                    <option value="1">Incluir</option>
                  </TextField>
                </Grid>
                <Grid size={{ xs: 12, sm: 2 }}>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button variant="contained" onClick={loadRotacion} fullWidth size="small"
                      disabled={rotLoading}
                      startIcon={rotLoading ? <CircularProgress size={14} color="inherit" /> : <BarChart />}
                      sx={{ background: `linear-gradient(135deg, ${ACCENT}, #fcd34d)`, borderRadius: 2, fontWeight: 600 }}>
                      {rotLoading ? 'Cargando…' : 'Consultar'}
                    </Button>
                    <Tooltip title="Exportar Rotación a Excel">
                      <span>
                        <Button variant="outlined" onClick={handleExportRotacion} size="small"
                          disabled={rotLoading || !rotLoaded}
                          sx={{ borderRadius: 2, minWidth: 44, p: 0, height: 38, borderColor: 'divider', color: 'text.secondary' }}>
                          <Download fontSize="small" />
                        </Button>
                      </span>
                    </Tooltip>
                  </Box>
                </Grid>
              </Grid>
            </Paper>

            {!rotLoaded ? (
              <Box sx={{ textAlign: 'center', py: 8, color: 'text.secondary' }}>
                <BarChart sx={{ fontSize: 52, mb: 1.5, opacity: 0.25 }} />
                <Typography>Define los parámetros y presiona Consultar</Typography>
              </Box>
            ) : (
              <>
                {/* Bar chart for top sellers */}
                {rot.top.length > 0 && (
                  <Paper sx={{ p: 2, borderRadius: 2.5, mb: 3, boxShadow: 'none', border: '1px solid', borderColor: 'divider' }}>
                    <Typography sx={{ fontWeight: 600, fontSize: 12, color: 'text.secondary', mb: 1.5 }}>
                      Ingresos por producto (más vendidos)
                    </Typography>
                    <Box sx={{ height: 180 }}>
                      <Bar data={rotBarData} options={rotBarOptions} />
                    </Box>
                  </Paper>
                )}

                <Grid container spacing={2.5}>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                      <TrendingUp sx={{ color: GREEN, fontSize: 20 }} />
                      <Typography sx={{ fontWeight: 700, fontSize: 14 }}>Más vendidos</Typography>
                      <Chip label={`Top ${rotLimit}`} size="small" sx={{ bgcolor: `${GREEN}12`, color: GREEN, fontWeight: 600, fontSize: 10 }} />
                    </Box>
                    {isMobile
                      ? <RotCards rows={rot.top} emptyText="Sin datos de ventas en el período" accentPill={GREEN} />
                      : <RotTable rows={rot.top} emptyText="Sin datos de ventas en el período" totalIngresos={totalTopIngresos} />
                    }
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                      <TrendingDown sx={{ color: RED, fontSize: 20 }} />
                      <Typography sx={{ fontWeight: 700, fontSize: 14 }}>Menor rotación</Typography>
                      <Chip label={`Top ${rotLimit}`} size="small" sx={{ bgcolor: `${RED}12`, color: RED, fontWeight: 600, fontSize: 10 }} />
                    </Box>
                    {isMobile
                      ? <RotCards rows={rot.slow} emptyText="Sin datos de rotación baja" accentPill={RED} />
                      : <RotTable rows={rot.slow} emptyText="Sin datos de rotación baja" totalIngresos={0} />
                    }
                  </Grid>
                </Grid>
              </>
            )}
          </TabPanel>

          {/* ══ Tab 2: Kardex ══ */}
          <TabPanel value={tab} index={2}>
            {/* Date preset chips */}
            <PresetChips
              presets={PRESETS_K}
              onSelect={key => {
                const { start, end } = getPresetDates(key);
                setKStart(start);
                setKEnd(end);
              }}
            />

            <Paper sx={{ p: 2, borderRadius: 2.5, mb: 2.5, boxShadow: 'none', border: '1px solid', borderColor: 'divider' }}>
              <Typography sx={{ fontWeight: 600, fontSize: 11, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.6, mb: 1.5 }}>
                Producto y rango de fechas
              </Typography>
              {/* Fila 1: selector de producto — siempre ancho completo */}
              <Autocomplete
                options={productos}
                getOptionLabel={o => o ? o.nombre : ''}
                value={producto}
                onChange={(_, v) => setProducto(v)}
                renderOption={(props, o) => (
                  <li {...props} key={o.id}>
                    <Box>
                      <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{o.nombre}</Typography>
                      <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>Stock: {o.stock_actual ?? 0}</Typography>
                    </Box>
                  </li>
                )}
                renderInput={params => <TextField {...params} label="Producto" size="small" fullWidth />}
                ListboxProps={{ style: { maxHeight: 280 } }}
                fullWidth
                sx={{ mb: 1.5 }}
              />

              {/* Fila 2: fechas + botones */}
              <Grid container spacing={1.5} alignItems="center">
                <Grid size={{ xs: 6, sm: 3 }}>
                  <TextField type="date" label="Inicio" size="small" value={kStart}
                    onChange={e => setKStart(e.target.value)} InputLabelProps={{ shrink: true }} fullWidth />
                </Grid>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <TextField type="date" label="Fin" size="small" value={kEnd}
                    onChange={e => setKEnd(e.target.value)} InputLabelProps={{ shrink: true }} fullWidth />
                </Grid>
                <Grid size={{ xs: 8, sm: 4 }}>
                  <Button variant="contained" onClick={loadKardex} disabled={!producto || kLoading}
                    startIcon={kLoading ? <CircularProgress size={14} color="inherit" /> : <ReceiptLong />}
                    fullWidth size="small"
                    sx={{ background: `linear-gradient(135deg, ${ACCENT}, #fcd34d)`, borderRadius: 2, fontWeight: 600 }}>
                    {kLoading ? 'Cargando…' : 'Consultar'}
                  </Button>
                </Grid>
                <Grid size={{ xs: 4, sm: 2 }}>
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    <Tooltip title="Exportar Kardex a Excel">
                      <span style={{ flex: 1 }}>
                        <Button variant="outlined" disabled={!producto} fullWidth size="small"
                          startIcon={<Download />}
                          onClick={handleExportKardex}
                          sx={{ borderRadius: 2, fontWeight: 600, borderColor: 'divider' }}>
                          Excel
                        </Button>
                      </span>
                    </Tooltip>
                    <Tooltip title="Exportar Kardex a CSV">
                      <span>
                        <Button variant="outlined" disabled={!kRows.length} size="small"
                          onClick={handleExportKardexCSV}
                          sx={{ borderRadius: 2, minWidth: 44, p: 0, height: 38, borderColor: 'divider', color: 'text.secondary' }}>
                          CSV
                        </Button>
                      </span>
                    </Tooltip>
                  </Box>
                </Grid>
              </Grid>
            </Paper>

            {!kLoaded ? (
              <Box sx={{ textAlign: 'center', py: 8, color: 'text.secondary' }}>
                <ReceiptLong sx={{ fontSize: 52, mb: 1.5, opacity: 0.25 }} />
                <Typography>Selecciona un producto y presiona Consultar</Typography>
              </Box>
            ) : kRows.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 6, color: 'text.secondary' }}>
                <Typography>Sin movimientos en el período</Typography>
              </Box>
            ) : (
              <>
                {/* Mini KPIs kardex */}
                <Box sx={{ display: 'flex', gap: 1.5, mb: 2.5, flexWrap: 'wrap' }}>
                  {[
                    { label: 'Movimientos',    val: kRows.length,                                                        color: BLUE      },
                    { label: 'Saldo final',    val: kRows[kRows.length - 1]?.saldo_cantidad ?? 0,                       color: ACCENT    },
                    { label: 'Valor final',    val: formatCurrency(kRows[kRows.length - 1]?.saldo_valor ?? 0),          color: GREEN     },
                    { label: 'Costo promedio', val: formatCurrency(kRows[kRows.length - 1]?.saldo_costo_unitario ?? 0), color: '#8B5CF6' },
                    { label: 'Total entradas', val: totalEntradas,                                                       color: GREEN     },
                    { label: 'Total salidas',  val: totalSalidas,                                                        color: RED       },
                  ].map(({ label, val, color }) => (
                    <Box key={label} sx={{ px: 2, py: 1, borderRadius: 2, bgcolor: `${color}0D`, border: `1px solid ${color}25`, minWidth: isMobile ? 'calc(50% - 8px)' : 'auto' }}>
                      <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>{label}</Typography>
                      <Typography sx={{ fontWeight: 700, fontSize: 14, color }}>{val}</Typography>
                    </Box>
                  ))}
                </Box>

                {/* Mobile: cards */}
                {isMobile ? (
                  <Box>
                    {kRows.map((r, i) => (
                      <Paper key={i} sx={{ p: 2, mb: 1.5, borderRadius: 2.5, border: '1px solid', borderColor: 'divider' }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                          <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
                            {new Date(r.fecha).toLocaleDateString('es-CO', { timeZone: 'America/Bogota', day: '2-digit', month: 'short', year: 'numeric' })}
                          </Typography>
                          <TipoChip tipo={r.tipo} />
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Box>
                            <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>Cantidad</Typography>
                            <Typography sx={{ fontWeight: 800, fontSize: 14 }}>{r.cantidad}</Typography>
                          </Box>
                          <Box sx={{ textAlign: 'center' }}>
                            <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>Saldo</Typography>
                            <Typography sx={{ fontWeight: 800, fontSize: 14, color: ACCENT }}>{r.saldo_cantidad}</Typography>
                          </Box>
                          <Box sx={{ textAlign: 'right' }}>
                            <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>Val. saldo</Typography>
                            <Typography sx={{ fontWeight: 700, fontSize: 13, color: GREEN }}>{formatCurrency(r.saldo_valor)}</Typography>
                          </Box>
                        </Box>
                        {r.referencia && (
                          <Typography sx={{ fontSize: 11, color: 'text.secondary', mt: 0.5 }}>Ref: {r.referencia}</Typography>
                        )}
                      </Paper>
                    ))}
                  </Box>
                ) : (
                  /* Desktop: tabla completa */
                  <TableContainer sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider', overflowX: 'auto' }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          {['Fecha', 'Tipo', 'Cantidad', 'Costo Unit.', 'Referencia', 'Saldo Cant.', 'Saldo Costo', 'Saldo Valor'].map(h => (
                            <TableCell key={h} align={['Cantidad','Costo Unit.','Saldo Cant.','Saldo Costo','Saldo Valor'].includes(h) ? 'right' : 'left'}>
                              {h}
                            </TableCell>
                          ))}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {kRows.map((r, i) => (
                          <TableRow key={i} hover>
                            <TableCell sx={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                              {new Date(r.fecha).toLocaleDateString('es-CO', { timeZone: 'America/Bogota', day: '2-digit', month: 'short', year: 'numeric' })}
                            </TableCell>
                            <TableCell><TipoChip tipo={r.tipo} /></TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700 }}>{r.cantidad}</TableCell>
                            <TableCell align="right">{formatCurrency(r.costo_unitario)}</TableCell>
                            <TableCell sx={{ fontSize: 12, color: 'text.secondary' }}>{r.referencia || '—'}</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700, color: ACCENT }}>{r.saldo_cantidad}</TableCell>
                            <TableCell align="right">{formatCurrency(r.saldo_costo_unitario)}</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700, color: GREEN }}>{formatCurrency(r.saldo_valor)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </>
            )}
          </TabPanel>

          {/* ══ Tab 3: Alertas de Stock ══ */}
          <TabPanel value={tab} index={3}>
            {/* KPI cards */}
            <Grid container spacing={1.5} sx={{ mb: 2.5 }}>
              <Grid size={{ xs: 12, sm: 4 }}>
                <KpiCard label="Agotados" value={alertasAgotado.length} icon={<WarningAmber />} color="#7C3AED" />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <KpiCard label="Bajo mínimo" value={alertasBajo.length} icon={<WarningAmber />} color={RED} />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <KpiCard label="Sin mínimo config." value={alertasSinMin.length} icon={<WarningAmber />} color="#94A3B8" />
              </Grid>
            </Grid>

            {alertasAgotado.length === 0 && alertasBajo.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 8, color: 'text.secondary' }}>
                <CheckCircle sx={{ fontSize: 52, mb: 1.5, color: GREEN, opacity: 0.6 }} />
                <Typography sx={{ fontWeight: 600, fontSize: 15 }}>¡Sin alertas de stock!</Typography>
                <Typography sx={{ fontSize: 13, mt: 0.5 }}>Todo el inventario está en niveles correctos.</Typography>
              </Box>
            ) : (
              <>
                {/* Sección: Agotados */}
                {alertasAgotado.length > 0 && (
                  <Box sx={{ mb: 3 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                      <Typography sx={{ fontWeight: 700, fontSize: 14, color: '#7C3AED' }}>🔴 Agotados</Typography>
                      <Chip label={alertasAgotado.length} size="small" sx={{ bgcolor: '#7C3AED18', color: '#7C3AED', fontWeight: 700, fontSize: 11 }} />
                    </Box>

                    {isMobile ? (
                      <Box>
                        {alertasAgotado.map(it => (
                          <Paper key={it.id} sx={{ p: 2, mb: 1.5, borderRadius: 2.5, border: `1px solid #7C3AED30`, bgcolor: agotadoBg }}>
                            <Typography sx={{ fontWeight: 700, fontSize: 13 }}>{it.nombre}</Typography>
                            <Typography sx={{ fontSize: 11, color: 'text.secondary', mb: 0.5 }}>{it.unidad_medida || '—'}</Typography>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                              <Box>
                                <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>Stock</Typography>
                                <Typography sx={{ fontWeight: 800, fontSize: 14, color: RED }}>0</Typography>
                              </Box>
                              <Box sx={{ textAlign: 'center' }}>
                                <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>Mín.</Typography>
                                <Typography sx={{ fontWeight: 700, fontSize: 14, color: '#7C3AED' }}>{it.stock_minimo ?? '—'}</Typography>
                              </Box>
                              <Box sx={{ textAlign: 'right' }}>
                                <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>Val. costo perdida</Typography>
                                <Typography sx={{ fontWeight: 700, fontSize: 13, color: ACCENT }}>{formatCurrency(it.valor_costo)}</Typography>
                              </Box>
                            </Box>
                          </Paper>
                        ))}
                      </Box>
                    ) : (
                      <TableContainer sx={{ borderRadius: 2, border: '1px solid #7C3AED30' }}>
                        <Table size="small">
                          <TableHead>
                            <TableRow sx={{ bgcolor: agotadoHeaderBg }}>
                              <TableCell>Nombre</TableCell>
                              <TableCell>Unidad</TableCell>
                              <TableCell align="right">Stock</TableCell>
                              <TableCell align="right">Mín</TableCell>
                              <TableCell align="right">Val. Costo perdida</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {alertasAgotado.map(it => (
                              <TableRow key={it.id} sx={{ bgcolor: agotadoBg }}>
                                <TableCell sx={{ fontWeight: 600, fontSize: 13 }}>{it.nombre}</TableCell>
                                <TableCell sx={{ fontSize: 12, color: 'text.secondary' }}>{it.unidad_medida || '—'}</TableCell>
                                <TableCell align="right" sx={{ fontWeight: 800, color: RED }}>0</TableCell>
                                <TableCell align="right" sx={{ color: '#7C3AED' }}>{it.stock_minimo ?? '—'}</TableCell>
                                <TableCell align="right" sx={{ fontWeight: 700, color: ACCENT }}>{formatCurrency(it.valor_costo)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    )}
                  </Box>
                )}

                {/* Sección: Bajo mínimo */}
                {alertasBajo.length > 0 && (
                  <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                      <Typography sx={{ fontWeight: 700, fontSize: 14, color: RED }}>🟡 Bajo mínimo</Typography>
                      <Chip label={alertasBajo.length} size="small" sx={{ bgcolor: `${RED}12`, color: RED, fontWeight: 700, fontSize: 11 }} />
                    </Box>

                    {isMobile ? (
                      <Box>
                        {alertasBajo.map(it => (
                          <Paper key={it.id} sx={{ p: 2, mb: 1.5, borderRadius: 2.5, border: `1px solid ${RED}30`, bgcolor: bajoBg }}>
                            <Typography sx={{ fontWeight: 700, fontSize: 13 }}>{it.nombre}</Typography>
                            <Typography sx={{ fontSize: 11, color: 'text.secondary', mb: 0.5 }}>{it.unidad_medida || '—'}</Typography>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                              <Box>
                                <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>Stock actual</Typography>
                                <Typography sx={{ fontWeight: 800, fontSize: 14, color: RED }}>{it.stock_actual}</Typography>
                              </Box>
                              <Box sx={{ textAlign: 'center' }}>
                                <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>Mín.</Typography>
                                <Typography sx={{ fontWeight: 700, fontSize: 14 }}>{it.stock_minimo}</Typography>
                              </Box>
                              <Box sx={{ textAlign: 'center' }}>
                                <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>Diferencia</Typography>
                                <Typography sx={{ fontWeight: 700, fontSize: 14, color: ACCENT }}>{it.stock_minimo - it.stock_actual}</Typography>
                              </Box>
                              <Box sx={{ textAlign: 'right' }}>
                                <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>Val. costo</Typography>
                                <Typography sx={{ fontWeight: 700, fontSize: 13, color: GREEN }}>{formatCurrency(it.valor_costo)}</Typography>
                              </Box>
                            </Box>
                            <LinearProgress
                              variant="determinate"
                              value={Math.min((it.stock_actual / it.stock_minimo) * 100, 100)}
                              sx={{ height: 4, borderRadius: 2, bgcolor: `${RED}20`, '& .MuiLinearProgress-bar': { bgcolor: RED } }}
                            />
                          </Paper>
                        ))}
                      </Box>
                    ) : (
                      <TableContainer sx={{ borderRadius: 2, border: `1px solid ${RED}30` }}>
                        <Table size="small">
                          <TableHead>
                            <TableRow sx={{ bgcolor: bajoHeaderBg }}>
                              <TableCell>Nombre</TableCell>
                              <TableCell>Unidad</TableCell>
                              <TableCell align="right">Stock</TableCell>
                              <TableCell align="right">Mín</TableCell>
                              <TableCell align="right">Diferencia</TableCell>
                              <TableCell align="right">Val. Costo</TableCell>
                              <TableCell sx={{ minWidth: 120 }}>Nivel</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {alertasBajo.map(it => (
                              <TableRow key={it.id} sx={{ bgcolor: bajoBg }}>
                                <TableCell sx={{ fontWeight: 600, fontSize: 13 }}>{it.nombre}</TableCell>
                                <TableCell sx={{ fontSize: 12, color: 'text.secondary' }}>{it.unidad_medida || '—'}</TableCell>
                                <TableCell align="right" sx={{ fontWeight: 800, color: RED }}>{it.stock_actual}</TableCell>
                                <TableCell align="right">{it.stock_minimo}</TableCell>
                                <TableCell align="right" sx={{ fontWeight: 700, color: ACCENT }}>{it.stock_minimo - it.stock_actual}</TableCell>
                                <TableCell align="right" sx={{ fontWeight: 700, color: GREEN }}>{formatCurrency(it.valor_costo)}</TableCell>
                                <TableCell sx={{ minWidth: 120 }}>
                                  <LinearProgress
                                    variant="determinate"
                                    value={Math.min((it.stock_actual / it.stock_minimo) * 100, 100)}
                                    sx={{ height: 4, borderRadius: 2, mt: 0.5, bgcolor: `${RED}20`, '& .MuiLinearProgress-bar': { bgcolor: RED } }}
                                  />
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    )}
                  </Box>
                )}
              </>
            )}
          </TabPanel>

        </Box>
      </Paper>
    </Box>
  );
}
