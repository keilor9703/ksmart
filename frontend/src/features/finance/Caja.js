import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box, Typography, Paper, Grid, Button, Divider, Tabs, Tab,
  TextField, Chip, Table, TableBody, TableCell, Stack, Autocomplete, Tooltip,
  TableContainer, TableHead, TableRow, CircularProgress, TablePagination,
  Dialog, DialogTitle, DialogContent, DialogActions, MenuItem, Select,
  FormControl, InputLabel, InputAdornment,
  IconButton, Alert, useTheme, useMediaQuery,
  TableSortLabel, LinearProgress, Avatar, Collapse,
} from '@mui/material';
import {
  PointOfSale, CheckCircle, Close, Add,
  TrendingUp, AttachMoney, CreditCard, AccountBalance,
  Refresh, MoneyOff, Edit, Delete, FileDownload,
  Warning, EmojiEvents, WhatshotOutlined, CalendarToday,
  ExpandMore, ExpandLess, Bolt,
} from '@mui/icons-material';
import { toast } from 'react-toastify';
import apiClient from '../../api';
import { formatCurrency } from '../../utils/formatters';
import CurrencyField from '../../components/common/CurrencyField';
import QuickCreateModal from '../../components/common/QuickCreateModal';

const ACCENT  = '#6366F1';
const GREEN   = '#10B981';
const RED     = '#EF4444';
const BLUE    = '#3B82F6';
const YELLOW  = '#F59E0B';
const PURPLE  = '#8B5CF6';

const BILLETES = [100000, 50000, 20000, 10000, 5000, 2000, 1000];
const MONEDAS  = [500, 200, 100, 50];

const CATEGORIAS_GASTO = [
  'Servicios públicos', 'Arriendo', 'Nómina', 'Proveedores',
  'Transporte', 'Papelería', 'Aseo y cafetería', 'Mantenimiento',
  'Publicidad', 'Impuestos', 'Otros',
];

const METODOS_PAGO = ['Efectivo', 'Transferencia', 'Tarjeta', 'Nequi', 'Daviplata'];

const todayISO = () => new Date().toISOString().split('T')[0];

const fmtFecha = (iso) => {
  if (!iso) return '—';
  try {
    const [y, m, d] = String(iso).split('T')[0].split('-');
    return `${d}/${m}/${y}`;
  } catch { return '—'; }
};

// ─── DenomGrid ─────────────────────────────────────────────────────────────────
const DenomGrid = ({ denoms, onChange }) => {
  const update = (d, val) => onChange({ ...denoms, [d]: Math.max(0, parseInt(val, 10) || 0) });
  const subBilletes = BILLETES.reduce((s, d) => s + d * (parseInt(denoms[d] || 0, 10) || 0), 0);
  const subMonedas  = MONEDAS.reduce((s, d)  => s + d * (parseInt(denoms[d] || 0, 10) || 0), 0);

  return (
    <Box>
      <Typography sx={{ fontSize: 11, fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.6, mb: 1 }}>Billetes</Typography>
      <Grid container spacing={1} sx={{ mb: 1 }}>
        {BILLETES.map(d => (
          <Grid size={{ xs: 6 }} key={d}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>${(d).toLocaleString('es-CO')}</Typography>
                <Typography sx={{ fontSize: 11, fontWeight: 700, color: GREEN }}>{formatCurrency(d * (parseInt(denoms[d] || 0, 10) || 0))}</Typography>
              </Box>
              <TextField type="number" size="small" value={denoms[d] || ''}
                onChange={e => update(d, e.target.value)}
                inputProps={{ min: 0, style: { width: 52, textAlign: 'center', fontWeight: 700, padding: '4px 6px' } }}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5 } }} />
            </Box>
          </Grid>
        ))}
      </Grid>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1.5 }}>
        <Typography sx={{ fontSize: 12, fontWeight: 700 }}>
          Subtotal billetes: <Box component="span" sx={{ color: GREEN }}>{formatCurrency(subBilletes)}</Box>
        </Typography>
      </Box>
      <Typography sx={{ fontSize: 11, fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.6, mb: 1 }}>Monedas</Typography>
      <Grid container spacing={1} sx={{ mb: 1 }}>
        {MONEDAS.map(d => (
          <Grid size={{ xs: 6 }} key={d}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>${d}</Typography>
                <Typography sx={{ fontSize: 11, fontWeight: 700, color: BLUE }}>{formatCurrency(d * (parseInt(denoms[d] || 0, 10) || 0))}</Typography>
              </Box>
              <TextField type="number" size="small" value={denoms[d] || ''}
                onChange={e => update(d, e.target.value)}
                inputProps={{ min: 0, style: { width: 52, textAlign: 'center', fontWeight: 700, padding: '4px 6px' } }}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5 } }} />
            </Box>
          </Grid>
        ))}
      </Grid>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Typography sx={{ fontSize: 12, fontWeight: 700 }}>
          Subtotal monedas: <Box component="span" sx={{ color: BLUE }}>{formatCurrency(subMonedas)}</Box>
        </Typography>
      </Box>
    </Box>
  );
};

// ─── KPI Card ──────────────────────────────────────────────────────────────────
const KpiCard = ({ label, value, icon, color, sub, highlight }) => (
  <Paper sx={(theme) => ({
    p: { xs: 1.5, sm: 2 }, borderRadius: 3,
    display: 'flex', alignItems: 'center', gap: 1.5,
    border: '1px solid',
    borderColor: highlight ? `${color}40` : 'divider',
    bgcolor: highlight
      ? (theme.palette.mode === 'dark' ? `${color}15` : `${color}08`)
      : 'background.paper',
    boxShadow: highlight ? `0 2px 12px ${color}18` : '0 1px 4px rgba(0,0,0,0.05)',
  })}>
    <Avatar sx={{ width: 40, height: 40, bgcolor: `${color}18`, color, flexShrink: 0 }}>
      {icon}
    </Avatar>
    <Box sx={{ minWidth: 0 }}>
      <Typography sx={{ fontSize: 11, color: 'text.secondary', fontWeight: 500, lineHeight: 1 }}>
        {label}
      </Typography>
      <Typography sx={{ fontSize: 18, fontWeight: 900, lineHeight: 1.2, color: highlight ? color : 'text.primary' }}>
        {value}
      </Typography>
      {sub && <Typography sx={{ fontSize: 10, color: 'text.secondary', mt: 0.3 }}>{sub}</Typography>}
    </Box>
  </Paper>
);

// ─── SortTh ────────────────────────────────────────────────────────────────────
const SortTh = ({ col, label, sortCol, sortDir, onSort }) => (
  <TableCell sx={{ fontSize: 11, fontWeight: 700 }}>
    <TableSortLabel active={sortCol === col} direction={sortCol === col ? sortDir : 'asc'} onClick={() => onSort(col)}>
      {label}
    </TableSortLabel>
  </TableCell>
);

// ─── Mini barra de tendencia ───────────────────────────────────────────────────
const TrendBars = ({ cortes }) => {
  if (!cortes || cortes.length === 0) return null;
  const ultimos = [...cortes].sort((a, b) => new Date(a.fecha) - new Date(b.fecha)).slice(-14);
  const maxVal = Math.max(...ultimos.map(c => c.total_ventas_dia), 1);
  return (
    <Box>
      <Typography sx={{ fontSize: 11, fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.5, mb: 1.5 }}>
        Ingresos últimos {ultimos.length} días
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 0.4, height: 60 }}>
        {ultimos.map((c, i) => {
          const pct  = (c.total_ventas_dia / maxVal) * 100;
          const dif  = c.diferencia;
          const barColor = dif < -1000 ? RED : dif > 1000 ? BLUE : GREEN;
          return (
            <Tooltip
              key={i}
              title={`${fmtFecha(c.fecha)} · ${formatCurrency(c.total_ventas_dia)} · ${dif >= 0 ? '+' : ''}${formatCurrency(dif)}`}
              arrow
            >
              <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'default' }}>
                <Box sx={{
                  width: '100%', borderRadius: '3px 3px 0 0',
                  height: `${Math.max(pct, 8)}%`,
                  bgcolor: barColor, opacity: 0.85,
                  transition: 'opacity 0.2s',
                  '&:hover': { opacity: 1 },
                }} />
              </Box>
            </Tooltip>
          );
        })}
      </Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
        <Typography sx={{ fontSize: 9, color: 'text.secondary' }}>{fmtFecha(ultimos[0]?.fecha)}</Typography>
        <Typography sx={{ fontSize: 9, color: 'text.secondary' }}>{fmtFecha(ultimos[ultimos.length - 1]?.fecha)}</Typography>
      </Box>
      <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
        {[{ color: GREEN, label: 'Cuadre exacto' }, { color: BLUE, label: 'Sobrante' }, { color: RED, label: 'Faltante' }].map(({ color, label }) => (
          <Box key={label} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box sx={{ width: 10, height: 10, borderRadius: 1, bgcolor: color }} />
            <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>{label}</Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
};

// ─── Corte Card Mobile ─────────────────────────────────────────────────────────
const CorteCard = ({ corte }) => {
  const dif = corte.diferencia;
  const difColor = dif === 0 ? GREEN : dif > 0 ? BLUE : RED;
  return (
    <Paper sx={{ p: 2, mb: 1.5, borderRadius: 2.5, border: '1px solid', borderColor: 'divider' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
        <Box>
          <Typography sx={{ fontWeight: 700, fontSize: 14 }}>
            {new Date(corte.fecha + 'T12:00:00').toLocaleDateString('es-CO', { weekday: 'short', day: '2-digit', month: 'short' })}
          </Typography>
          <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>Corte #{corte.id}</Typography>
        </Box>
        <Box sx={{ textAlign: 'right' }}>
          <Typography sx={{ fontWeight: 900, fontSize: 16, color: ACCENT }}>{formatCurrency(corte.total_ventas_dia)}</Typography>
          <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>ingresos</Typography>
        </Box>
      </Box>
      <Grid container spacing={1}>
        {[
          { label: 'Gastos', val: corte.total_gastos || 0, color: RED },
          { label: 'Efectivo esp.', val: corte.total_efectivo_ventas, color: GREEN },
          { label: 'Físico', val: corte.efectivo_fisico, color: BLUE },
          { label: dif >= 0 ? 'Sobrante' : 'Faltante', val: Math.abs(dif), color: difColor },
        ].map(({ label, val, color }) => (
          <Grid size={{ xs: 6 }} key={label}>
            <Box sx={{ p: 0.8, borderRadius: 1.5, bgcolor: `${color}08`, textAlign: 'center' }}>
              <Typography sx={{ fontSize: 9, color: 'text.secondary' }}>{label}</Typography>
              <Typography sx={{ fontSize: 11, fontWeight: 700, color }}>{formatCurrency(val)}</Typography>
            </Box>
          </Grid>
        ))}
      </Grid>
      {corte.observaciones && (
        <Typography sx={{ fontSize: 11, color: 'text.secondary', mt: 1, fontStyle: 'italic' }}>📝 {corte.observaciones}</Typography>
      )}
    </Paper>
  );
};

// ─── Gasto Row ─────────────────────────────────────────────────────────────────
const GastoRow = ({ gasto, onEdit, onDelete, isMobile }) => {
  if (isMobile) return (
    <Paper sx={{ p: 1.5, mb: 1, borderRadius: 2, border: '1px solid', borderColor: `${RED}20`, bgcolor: `${RED}04` }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 700, fontSize: 13 }}>{gasto.tercero?.nombre}</Typography>
          <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{gasto.concepto}</Typography>
          <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5, flexWrap: 'wrap' }}>
            <Chip label={gasto.metodo_pago} size="small" sx={{ fontSize: 9, height: 18 }} />
            {gasto.categoria && <Chip label={gasto.categoria} size="small" sx={{ fontSize: 9, height: 18, bgcolor: `${BLUE}12`, color: BLUE }} />}
          </Box>
        </Box>
        <Box sx={{ textAlign: 'right', ml: 1 }}>
          <Typography sx={{ fontWeight: 800, fontSize: 15, color: RED }}>{formatCurrency(gasto.monto)}</Typography>
          <Stack direction="row" spacing={0.3} justifyContent="flex-end" sx={{ mt: 0.5 }}>
            <IconButton size="small" onClick={() => onEdit(gasto)} sx={{ color: BLUE }}><Edit sx={{ fontSize: 14 }} /></IconButton>
            <IconButton size="small" onClick={() => onDelete(gasto.id)} sx={{ color: RED }}><Delete sx={{ fontSize: 14 }} /></IconButton>
          </Stack>
        </Box>
      </Box>
    </Paper>
  );

  return (
    <TableRow hover>
      <TableCell sx={{ fontSize: 12 }}>{fmtFecha(gasto.fecha)}</TableCell>
      <TableCell sx={{ fontWeight: 600, fontSize: 12 }}>{gasto.tercero?.nombre || '—'}</TableCell>
      <TableCell sx={{ fontSize: 12 }}>{gasto.concepto}</TableCell>
      <TableCell>
        {gasto.categoria && <Chip label={gasto.categoria} size="small" sx={{ fontSize: 9, height: 20, bgcolor: `${BLUE}12`, color: BLUE }} />}
      </TableCell>
      <TableCell sx={{ fontSize: 12 }}>{gasto.metodo_pago}</TableCell>
      <TableCell sx={{ fontWeight: 700, color: RED }}>{formatCurrency(gasto.monto)}</TableCell>
      <TableCell align="right">
        <IconButton size="small" onClick={() => onEdit(gasto)} sx={{ color: BLUE }}><Edit fontSize="small" /></IconButton>
        <IconButton size="small" onClick={() => onDelete(gasto.id)} sx={{ color: RED }}><Delete fontSize="small" /></IconButton>
      </TableCell>
    </TableRow>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// ─── COMPONENTE PRINCIPAL ──────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

export default function Caja() {
  const theme    = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [tab, setTab] = useState(0);

  // Data
  const [preview,   setPreview]   = useState(null);
  const [historial, setHistorial] = useState([]);
  const [gastos,    setGastos]    = useState([]);
  const [terceros,  setTerceros]  = useState([]);

  // Loading
  const [loading,    setLoading]    = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Cerrar caja modal
  const [openCierre,  setOpenCierre]  = useState(false);
  const [efectivoFisico, setEfectivoFisico] = useState('');
  const [observaciones,  setObservaciones]  = useState('');
  const [useDenoms, setUseDenoms] = useState(false);
  const [denoms,    setDenoms]    = useState({});

  // Historial filtros / sort / page
  const [cortesSortCol, setCortesSortCol] = useState('fecha');
  const [cortesSortDir, setCortesSortDir] = useState('desc');
  const [cortesPage,    setCortesPage]    = useState(0);
  const [cortesPP,      setCortesPP]      = useState(15);
  const [cortesDesde,   setCortesDesde]   = useState('');
  const [cortesHasta,   setCortesHasta]   = useState('');
  const [showGastosHistorial, setShowGastosHistorial] = useState(false);

  // Gasto form
  const [gastoDialog,    setGastoDialog]    = useState(false);
  const [editingGastoId, setEditingGastoId] = useState(null);
  const [gastoTercero,   setGastoTercero]   = useState(null);
  const [gastoMonto,     setGastoMonto]     = useState('');
  const [gastoConcepto,  setGastoConcepto]  = useState('');
  const [gastoMetodo,    setGastoMetodo]    = useState('Efectivo');
  const [gastoFecha,     setGastoFecha]     = useState(todayISO());
  const [gastoCategoria, setGastoCategoria] = useState('');

  // Gastos filtros / sort / page (historial tab)
  const [gastosSortCol, setGastosSortCol] = useState('fecha');
  const [gastosSortDir, setGastosSortDir] = useState('desc');
  const [gastosPage,    setGastosPage]    = useState(0);
  const [gastosPP,      setGastosPP]      = useState(10);
  const [filtroGCat,    setFiltroGCat]    = useState('');

  // Delete dialog
  const [deleteGastoId, setDeleteGastoId] = useState(null);

  // QuickCreate tercero
  const [quickCreate, setQuickCreate] = useState({ open: false });

  useEffect(() => { loadAll(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const denomTotal = useMemo(
    () => [...BILLETES, ...MONEDAS].reduce((s, d) => s + d * (parseInt(denoms[d] || 0, 10) || 0), 0),
    [denoms]
  );

  useEffect(() => {
    if (useDenoms) setEfectivoFisico(denomTotal > 0 ? String(denomTotal) : '');
  }, [useDenoms, denomTotal]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [rPrev, rHist, rGastos, rTerc] = await Promise.allSettled([
        apiClient.get('/caja/corte/preview'),
        apiClient.get('/caja/cortes?limit=90'),
        apiClient.get('/caja/gastos?limit=200'),
        apiClient.get('/clientes/'),
      ]);
      if (rPrev.status    === 'fulfilled') setPreview(rPrev.value.data);
      else toast.error('Error al cargar el resumen del día');
      if (rHist.status    === 'fulfilled') setHistorial(rHist.value.data);
      if (rGastos.status  === 'fulfilled') setGastos(rGastos.value.data);
      if (rTerc.status    === 'fulfilled') setTerceros(rTerc.value.data);
    } finally { setLoading(false); }
  }, []);

  // ── ¿Ya hay corte hoy? ──────────────────────────────────────────────────────
  const corteHoy = useMemo(() => {
    const hoy = todayISO();
    return historial.find(c => String(c.fecha).startsWith(hoy)) || null;
  }, [historial]);

  // ── Gastos de hoy ───────────────────────────────────────────────────────────
  const gastosHoy = useMemo(() => {
    const hoy = todayISO();
    return gastos.filter(g => String(g.fecha).startsWith(hoy));
  }, [gastos]);

  const totalGastosHoy = useMemo(() => gastosHoy.reduce((s, g) => s + g.monto, 0), [gastosHoy]);

  // ── Racha de cortes consecutivos ────────────────────────────────────────────
  const racha = useMemo(() => {
    const cortesFecha = new Set(historial.map(c => String(c.fecha).split('T')[0]));
    let streak = 0;
    const hoy = new Date();
    // Si no hay corte hoy, start from yesterday
    const start = corteHoy ? new Date() : (() => { const d = new Date(); d.setDate(d.getDate() - 1); return d; })();
    const cursor = new Date(start);
    while (true) {
      const iso = cursor.toISOString().split('T')[0];
      if (cortesFecha.has(iso)) { streak++; cursor.setDate(cursor.getDate() - 1); }
      else break;
      if (streak > 365) break;
    }
    return streak;
  }, [historial, corteHoy]);

  // ── Stats del mes actual ─────────────────────────────────────────────────────
  const mesActual = todayISO().slice(0, 7);
  const cortesMes = useMemo(() => historial.filter(c => String(c.fecha).startsWith(mesActual)), [historial, mesActual]);
  const statsMes = useMemo(() => {
    if (cortesMes.length === 0) return null;
    const ingresos = cortesMes.reduce((s, c) => s + c.total_ventas_dia, 0);
    const egresosT = cortesMes.reduce((s, c) => s + (c.total_gastos || 0), 0);
    const mejor    = cortesMes.reduce((best, c) => c.total_ventas_dia > best.total_ventas_dia ? c : best, cortesMes[0]);
    const difAcum  = cortesMes.reduce((s, c) => s + (c.diferencia || 0), 0);
    const diasFaltante = cortesMes.filter(c => c.diferencia < -1000).length;
    return { ingresos, egresosT, mejor, difAcum, diasFaltante, totalDias: cortesMes.length };
  }, [cortesMes]);

  // ── Cierre de caja ──────────────────────────────────────────────────────────
  const handleCerrarCaja = async () => {
    setSubmitting(true);
    try {
      await apiClient.post('/caja/corte', {
        efectivo_fisico: efectivoFisico === '' ? 0 : parseFloat(efectivoFisico),
        observaciones,
      });
      toast.success('¡Caja cerrada exitosamente!');
      setOpenCierre(false);
      setEfectivoFisico(''); setObservaciones(''); setUseDenoms(false); setDenoms({});
      loadAll();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al cerrar la caja');
    } finally { setSubmitting(false); }
  };

  const diferenciaCierre = (efectivoFisico === '' ? 0 : parseFloat(efectivoFisico)) - (preview?.efectivo || 0);

  // ── Gasto CRUD ───────────────────────────────────────────────────────────────
  const resetGasto = () => {
    setEditingGastoId(null); setGastoTercero(null); setGastoMonto('');
    setGastoConcepto(''); setGastoCategoria(''); setGastoFecha(todayISO());
    setGastoMetodo('Efectivo');
  };

  const handleSaveGasto = async () => {
    if (!gastoTercero || !gastoMonto || !gastoConcepto) {
      return toast.warning('Completa todos los campos obligatorios del gasto.');
    }
    setSubmitting(true);
    try {
      const payload = {
        tercero_id: gastoTercero.id,
        monto: parseFloat(gastoMonto),
        concepto: gastoConcepto,
        metodo_pago: gastoMetodo,
        fecha: gastoFecha || todayISO(),
        ...(gastoCategoria && { categoria: gastoCategoria }),
      };
      if (editingGastoId) {
        await apiClient.patch(`/caja/gastos/${editingGastoId}`, payload);
        toast.success('Gasto actualizado');
      } else {
        await apiClient.post('/caja/gastos', payload);
        toast.success('Gasto registrado');
      }
      setGastoDialog(false); resetGasto();
      loadAll();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al procesar el gasto');
    } finally { setSubmitting(false); }
  };

  const handleEditGasto = (g) => {
    setEditingGastoId(g.id);
    setGastoTercero(g.tercero); setGastoMonto(String(g.monto));
    setGastoConcepto(g.concepto); setGastoMetodo(g.metodo_pago);
    setGastoFecha(g.fecha ? String(g.fecha).split('T')[0] : todayISO());
    setGastoCategoria(g.categoria || '');
    setGastoDialog(true);
  };

  const handleDeleteGasto = async (id) => {
    if (!window.confirm('¿Eliminar este gasto? Esta acción no se puede deshacer.')) return;
    setDeleteGastoId(id);
    try {
      await apiClient.delete(`/caja/gastos/${id}`);
      toast.success('Gasto eliminado');
      loadAll();
    } catch { toast.error('Error al eliminar el gasto'); }
    finally { setDeleteGastoId(null); }
  };

  // ── Historial sort y filtros ─────────────────────────────────────────────────
  const handleCorteSort = (col) => {
    setCortesSortDir(d => col === cortesSortCol ? (d === 'asc' ? 'desc' : 'asc') : 'asc');
    setCortesSortCol(col); setCortesPage(0);
  };

  const filteredCortes = useMemo(() => historial.filter(c => {
    if (cortesDesde && String(c.fecha).split('T')[0] < cortesDesde) return false;
    if (cortesHasta && String(c.fecha).split('T')[0] > cortesHasta) return false;
    return true;
  }), [historial, cortesDesde, cortesHasta]);

  const sortedCortes = useMemo(() => [...filteredCortes].sort((a, b) => {
    let va, vb;
    if (cortesSortCol === 'ingresos')   { va = a.total_ventas_dia; vb = b.total_ventas_dia; }
    else if (cortesSortCol === 'gastos'){ va = a.total_gastos||0;  vb = b.total_gastos||0; }
    else if (cortesSortCol === 'dif')   { va = a.diferencia;        vb = b.diferencia; }
    else { va = new Date(a.fecha); vb = new Date(b.fecha); }
    return cortesSortDir === 'asc' ? (va - vb) : (vb - va);
  }), [filteredCortes, cortesSortCol, cortesSortDir]);

  const paginatedCortes = useMemo(
    () => sortedCortes.slice(cortesPage * cortesPP, cortesPage * cortesPP + cortesPP),
    [sortedCortes, cortesPage, cortesPP]
  );

  // ── Gastos historial filtros ──────────────────────────────────────────────────
  const gastosFiltrados = useMemo(() => {
    let g = [...gastos];
    if (filtroGCat) g = g.filter(x => x.categoria === filtroGCat);
    return g.sort((a, b) => {
      const da = new Date(a.fecha), db = new Date(b.fecha);
      return gastosSortDir === 'asc' ? da - db : db - da;
    });
  }, [gastos, filtroGCat, gastosSortDir]);

  const paginatedGastos = useMemo(
    () => gastosFiltrados.slice(gastosPage * gastosPP, gastosPage * gastosPP + gastosPP),
    [gastosFiltrados, gastosPage, gastosPP]
  );

  // ── CSV export ───────────────────────────────────────────────────────────────
  const exportCSV = () => {
    const rows = [
      ['Fecha', 'Ingresos', 'Gastos', 'Efectivo esp.', 'Efectivo físico', 'Diferencia', 'Estado'],
      ...sortedCortes.map(c => [
        String(c.fecha).split('T')[0], c.total_ventas_dia, c.total_gastos || 0,
        c.total_efectivo_ventas, c.efectivo_fisico, c.diferencia, c.estado,
      ]),
    ];
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const now = new Date().toISOString().split('T')[0];
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `cortes_caja_${now}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 10 }}>
      <CircularProgress sx={{ color: ACCENT }} />
    </Box>
  );

  return (
    <Box sx={{ width: '100%' }}>

      {/* ── Header ── */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ width: 42, height: 42, borderRadius: 2, bgcolor: `${ACCENT}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: ACCENT }}>
            <PointOfSale />
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 800, fontSize: 20, lineHeight: 1.2 }}>Control de Caja</Typography>
            <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>
              {new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })}
            </Typography>
          </Box>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center">
          {/* Indicador de racha */}
          {racha >= 3 && (
            <Tooltip title={`${racha} días consecutivos con corte de caja`} arrow>
              <Paper sx={{ px: 1.5, py: 0.8, borderRadius: 2, display: 'flex', alignItems: 'center', gap: 0.5, bgcolor: `${YELLOW}10`, border: `1px solid ${YELLOW}30` }}>
                <WhatshotOutlined sx={{ color: YELLOW, fontSize: 16 }} />
                <Typography sx={{ fontSize: 12, fontWeight: 700, color: YELLOW }}>{racha} días</Typography>
              </Paper>
            </Tooltip>
          )}
          <IconButton onClick={loadAll} size="small" sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1.5 }}>
            <Refresh fontSize="small" />
          </IconButton>
          <Button
            variant="outlined" size="small" startIcon={<Add />}
            onClick={() => { resetGasto(); setGastoDialog(true); }}
            sx={{ borderRadius: 2, fontWeight: 700, borderColor: `${RED}40`, color: RED, '&:hover': { borderColor: RED, bgcolor: `${RED}08` } }}
          >
            Gasto
          </Button>
          <Button
            variant="contained" size="small" startIcon={<PointOfSale />}
            onClick={() => setOpenCierre(true)}
            disabled={!!corteHoy}
            sx={{ borderRadius: 2, fontWeight: 700, background: corteHoy ? undefined : `linear-gradient(135deg, ${ACCENT}, #818CF8)`, boxShadow: corteHoy ? 'none' : `0 4px 14px ${ACCENT}30` }}
          >
            {corteHoy ? 'Corte realizado' : 'Cerrar Caja'}
          </Button>
        </Stack>
      </Box>

      {/* ── Banner estado de hoy ── */}
      {corteHoy ? (
        <Alert
          severity="success" icon={<CheckCircle />}
          sx={{ mb: 2.5, borderRadius: 2.5, fontWeight: 600, bgcolor: `${GREEN}10`, border: `1px solid ${GREEN}30` }}
        >
          Corte de caja realizado hoy a las{' '}
          <strong>{new Date(corteHoy.fecha).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Bogota' })}</strong>.
          {corteHoy.diferencia === 0
            ? ' ✓ Cuadre exacto.'
            : corteHoy.diferencia > 0
              ? ` Sobrante de ${formatCurrency(corteHoy.diferencia)}.`
              : ` Faltante de ${formatCurrency(Math.abs(corteHoy.diferencia))}.`
          }
        </Alert>
      ) : (
        <Alert
          severity="warning" icon={<Warning />}
          sx={{ mb: 2.5, borderRadius: 2.5, fontWeight: 600 }}
          action={
            <Button color="inherit" size="small" onClick={() => setOpenCierre(true)} sx={{ fontWeight: 700 }}>
              Cerrar ahora
            </Button>
          }
        >
          Aún no has realizado el corte de caja de hoy.
        </Alert>
      )}

      {/* ── Tabs ── */}
      <Paper sx={{ borderRadius: 3.5, overflow: 'hidden', boxShadow: '0 2px 16px rgba(0,0,0,0.06)' }}>
        <Tabs
          value={tab} onChange={(_, v) => setTab(v)}
          variant={isMobile ? 'fullWidth' : 'standard'}
          sx={{
            px: isMobile ? 0 : 2, borderBottom: '1px solid', borderColor: 'divider',
            '& .MuiTab-root': { fontWeight: 700, textTransform: 'none', fontSize: 13 },
            '& .MuiTabs-indicator': { bgcolor: ACCENT, height: 3, borderRadius: 2 },
            '& .Mui-selected': { color: `${ACCENT} !important` },
          }}
        >
          <Tab label="🏦 Arqueo del Día" />
          <Tab label="📊 Historial" />
        </Tabs>

        {/* ══ TAB 0: ARQUEO DEL DÍA ══════════════════════════════════════════ */}
        {tab === 0 && (
          <Box sx={{ p: { xs: 2, sm: 3 } }}>

            {/* KPI Cards */}
            {preview && (
              <Grid container spacing={1.5} sx={{ mb: 3 }}>
                <Grid size={{ xs: 6, sm: 4 }}>
                  <KpiCard
                    label="Ingresos del Día"
                    value={formatCurrency(preview.total_dia)}
                    icon={<TrendingUp />}
                    color={ACCENT}
                    sub={`${(preview.num_ventas || 0) + (preview.num_abonos || 0)} transacciones`}
                    highlight
                  />
                </Grid>
                <Grid size={{ xs: 6, sm: 4 }}>
                  <KpiCard
                    label="Efectivo en Caja"
                    value={formatCurrency(preview.efectivo)}
                    icon={<AttachMoney />}
                    color={preview.efectivo < 0 ? RED : GREEN}
                    sub="Ventas − gastos efectivo"
                    highlight={preview.efectivo < 0}
                  />
                </Grid>
                <Grid size={{ xs: 6, sm: 4 }}>
                  <KpiCard
                    label="Bancos / Transferencias"
                    value={formatCurrency(preview.transferencia)}
                    icon={<AccountBalance />}
                    color={BLUE}
                  />
                </Grid>
                <Grid size={{ xs: 6, sm: 6 }}>
                  <KpiCard
                    label="Gastos del Día"
                    value={formatCurrency(preview.total_gastos)}
                    icon={<MoneyOff />}
                    color={RED}
                    sub={`${gastosHoy.length} registro${gastosHoy.length !== 1 ? 's' : ''} hoy`}
                    highlight={preview.total_gastos > 0}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <KpiCard
                    label="Neto del Día"
                    value={formatCurrency((preview.total_dia || 0) - (preview.total_gastos || 0))}
                    icon={<Bolt />}
                    color={((preview.total_dia || 0) - (preview.total_gastos || 0)) >= 0 ? PURPLE : RED}
                    highlight
                  />
                </Grid>
              </Grid>
            )}

            {/* Desglose por método */}
            {preview && (
              <Paper variant="outlined" sx={{ p: 2, borderRadius: 3, mb: 3 }}>
                <Typography sx={{ fontWeight: 700, fontSize: 13, mb: 1.5 }}>Desglose por método de cobro</Typography>
                {[
                  { label: 'Efectivo (caja física)', val: preview.efectivo, color: GREEN, icon: <AttachMoney sx={{ fontSize: 16 }} /> },
                  { label: 'Bancos / Transferencias', val: preview.transferencia, color: BLUE,  icon: <AccountBalance sx={{ fontSize: 16 }} /> },
                  { label: 'Tarjetas / Datafono',     val: preview.tarjeta + (preview.otros || 0), color: YELLOW, icon: <CreditCard sx={{ fontSize: 16 }} /> },
                ].map(({ label, val, color, icon }) => (
                  <Box key={label} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
                    <Box sx={{ width: 28, height: 28, borderRadius: 1.5, bgcolor: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', color, flexShrink: 0 }}>
                      {icon}
                    </Box>
                    <Typography sx={{ flex: 1, fontSize: 13 }}>{label}</Typography>
                    <Typography sx={{ fontSize: 14, fontWeight: 700, color }}>{formatCurrency(val)}</Typography>
                  </Box>
                ))}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', pt: 1.5, mt: 0.5 }}>
                  <Typography sx={{ fontWeight: 700, fontSize: 14 }}>Total cobrado</Typography>
                  <Typography sx={{ fontWeight: 900, fontSize: 16, color: ACCENT }}>
                    {formatCurrency((preview.efectivo || 0) + (preview.transferencia || 0) + (preview.tarjeta || 0) + (preview.otros || 0))}
                  </Typography>
                </Box>
                {/* Origen ingresos */}
                {(preview.ventas_contado > 0 || preview.abonos_cartera > 0 || preview.recaudo_prestamos > 0) && (
                  <Box sx={{ mt: 1.5, pt: 1.5, borderTop: '1px dashed', borderColor: 'divider' }}>
                    <Typography sx={{ fontSize: 11, fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.5, mb: 1 }}>Por origen</Typography>
                    <Grid container spacing={1}>
                      {[
                        { label: `Ventas contado (${preview.num_ventas || 0})`, val: preview.ventas_contado || 0, color: GREEN },
                        { label: `Cartera cobrada (${preview.num_abonos || 0})`, val: preview.abonos_cartera || 0, color: BLUE },
                        ...(preview.recaudo_prestamos > 0 ? [{ label: 'Recaudo préstamos', val: preview.recaudo_prestamos || 0, color: PURPLE }] : []),
                      ].map(({ label, val, color }) => (
                        <Grid size={{ xs: 12, sm: 4 }} key={label}>
                          <Box sx={{ p: 1.2, borderRadius: 2, bgcolor: `${color}08`, border: `1px solid ${color}20`, textAlign: 'center' }}>
                            <Typography sx={{ fontSize: 10, color: 'text.secondary', mb: 0.3 }}>{label}</Typography>
                            <Typography sx={{ fontSize: 14, fontWeight: 800, color }}>{formatCurrency(val)}</Typography>
                          </Box>
                        </Grid>
                      ))}
                    </Grid>
                  </Box>
                )}
              </Paper>
            )}

            {/* Gastos de hoy */}
            <Paper variant="outlined" sx={{ borderRadius: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 2, pb: 1.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <MoneyOff sx={{ color: RED, fontSize: 20 }} />
                  <Typography sx={{ fontWeight: 700, fontSize: 14 }}>
                    Gastos de hoy
                  </Typography>
                  {gastosHoy.length > 0 && (
                    <Chip label={`${formatCurrency(totalGastosHoy)} total`} size="small"
                      sx={{ fontWeight: 700, bgcolor: `${RED}12`, color: RED, fontSize: 11 }} />
                  )}
                </Box>
                <Button size="small" startIcon={<Add />}
                  onClick={() => { resetGasto(); setGastoFecha(todayISO()); setGastoDialog(true); }}
                  sx={{ color: RED, fontWeight: 700, borderRadius: 2 }}
                >
                  Registrar
                </Button>
              </Box>
              <Divider />
              <Box sx={{ p: 1.5 }}>
                {gastosHoy.length === 0 ? (
                  <Typography sx={{ fontSize: 13, color: 'text.secondary', textAlign: 'center', py: 2 }}>
                    Sin gastos registrados hoy
                  </Typography>
                ) : isMobile ? (
                  gastosHoy.map(g => (
                    <GastoRow key={g.id} gasto={g} onEdit={handleEditGasto} onDelete={handleDeleteGasto} isMobile />
                  ))
                ) : (
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontSize: 11, fontWeight: 700 }}>Beneficiario</TableCell>
                        <TableCell sx={{ fontSize: 11, fontWeight: 700 }}>Concepto</TableCell>
                        <TableCell sx={{ fontSize: 11, fontWeight: 700 }}>Categoría</TableCell>
                        <TableCell sx={{ fontSize: 11, fontWeight: 700 }}>Método</TableCell>
                        <TableCell sx={{ fontSize: 11, fontWeight: 700 }}>Monto</TableCell>
                        <TableCell />
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {gastosHoy.map(g => (
                        <GastoRow key={g.id} gasto={g} onEdit={handleEditGasto} onDelete={handleDeleteGasto} isMobile={false} />
                      ))}
                    </TableBody>
                  </Table>
                )}
              </Box>
            </Paper>
          </Box>
        )}

        {/* ══ TAB 1: HISTORIAL ═══════════════════════════════════════════════ */}
        {tab === 1 && (
          <Box sx={{ p: { xs: 2, sm: 3 } }}>

            {/* Stats del mes */}
            {statsMes && (
              <Box sx={{ mb: 3 }}>
                <Typography sx={{ fontWeight: 700, fontSize: 13, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.5, mb: 1.5 }}>
                  Mes en curso
                </Typography>
                <Grid container spacing={1.5}>
                  {[
                    { label: 'Ingresos del mes', val: formatCurrency(statsMes.ingresos), color: ACCENT, icon: <TrendingUp /> },
                    { label: 'Gastos del mes',   val: formatCurrency(statsMes.egresosT), color: RED,    icon: <MoneyOff /> },
                    { label: 'Cortes realizados', val: statsMes.totalDias,                color: GREEN,  icon: <CheckCircle /> },
                    { label: 'Mejor día',          val: formatCurrency(statsMes.mejor?.total_ventas_dia || 0), color: PURPLE, icon: <EmojiEvents />, sub: fmtFecha(statsMes.mejor?.fecha) },
                  ].map(({ label, val, color, icon, sub }) => (
                    <Grid size={{ xs: 6, sm: 3 }} key={label}>
                      <KpiCard label={label} value={val} icon={icon} color={color} sub={sub} />
                    </Grid>
                  ))}
                </Grid>
                {statsMes.difAcum !== 0 && (
                  <Alert
                    severity={statsMes.difAcum > 0 ? 'info' : 'error'}
                    sx={{ mt: 1.5, borderRadius: 2 }}
                  >
                    {statsMes.difAcum > 0
                      ? `Sobrante acumulado del mes: ${formatCurrency(statsMes.difAcum)}`
                      : `Faltante acumulado del mes: ${formatCurrency(Math.abs(statsMes.difAcum))}`
                    }
                    {statsMes.diasFaltante > 0 && ` · ${statsMes.diasFaltante} día(s) con faltante`}
                  </Alert>
                )}
              </Box>
            )}

            {/* Gráfica de tendencia */}
            {historial.length >= 3 && (
              <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3, mb: 3 }}>
                <TrendBars cortes={historial} />
              </Paper>
            )}

            {/* Historial de cortes */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5, flexWrap: 'wrap', gap: 1 }}>
              <Typography sx={{ fontWeight: 700, fontSize: 14 }}>Historial de cortes</Typography>
              <Stack direction="row" spacing={1} alignItems="center">
                <TextField size="small" type="date" label="Desde" value={cortesDesde}
                  onChange={e => { setCortesDesde(e.target.value); setCortesPage(0); }}
                  InputLabelProps={{ shrink: true }} sx={{ width: 140 }} />
                <TextField size="small" type="date" label="Hasta" value={cortesHasta}
                  onChange={e => { setCortesHasta(e.target.value); setCortesPage(0); }}
                  InputLabelProps={{ shrink: true }} sx={{ width: 140 }} />
                <Tooltip title="Exportar CSV" arrow>
                  <IconButton size="small" onClick={exportCSV} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1.5 }}>
                    <FileDownload fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Stack>
            </Box>

            {historial.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 6, color: 'text.secondary' }}>
                <PointOfSale sx={{ fontSize: 48, opacity: 0.2, mb: 1 }} />
                <Typography>No hay cortes registrados aún.</Typography>
              </Box>
            ) : isMobile ? (
              filteredCortes.map(c => <CorteCard key={c.id} corte={c} />)
            ) : (
              <>
                <TableContainer sx={{ borderRadius: 2.5, border: '1px solid', borderColor: 'divider', overflowX: 'auto' }}>
                  <Table size="small">
                    <TableHead sx={{ bgcolor: 'action.hover' }}>
                      <TableRow>
                        <SortTh col="fecha"    label="Fecha"          sortCol={cortesSortCol} sortDir={cortesSortDir} onSort={handleCorteSort} />
                        <SortTh col="ingresos" label="Ingresos"       sortCol={cortesSortCol} sortDir={cortesSortDir} onSort={handleCorteSort} />
                        <SortTh col="gastos"   label="Gastos"         sortCol={cortesSortCol} sortDir={cortesSortDir} onSort={handleCorteSort} />
                        <TableCell sx={{ fontSize: 11, fontWeight: 700 }}>Efec. esperado</TableCell>
                        <TableCell sx={{ fontSize: 11, fontWeight: 700 }}>Efec. físico</TableCell>
                        <SortTh col="dif"      label="Diferencia"     sortCol={cortesSortCol} sortDir={cortesSortDir} onSort={handleCorteSort} />
                        <TableCell sx={{ fontSize: 11, fontWeight: 700 }}>Observaciones</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {paginatedCortes.map(c => {
                        const dif = c.diferencia;
                        const difColor = dif === 0 ? GREEN : dif > 0 ? BLUE : RED;
                        const esFaltante = dif < -1000;
                        return (
                          <TableRow key={c.id} hover
                            sx={(theme) => ({
                              bgcolor: esFaltante
                                ? (theme.palette.mode === 'dark' ? 'rgba(239,68,68,0.08)' : '#FFF5F5')
                                : 'transparent',
                            })}
                          >
                            <TableCell sx={{ fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>
                              {new Date(String(c.fecha).split('T')[0] + 'T12:00:00').toLocaleDateString('es-CO', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
                            </TableCell>
                            <TableCell sx={{ fontWeight: 700, color: ACCENT }}>{formatCurrency(c.total_ventas_dia)}</TableCell>
                            <TableCell sx={{ color: RED, fontWeight: 600 }}>{formatCurrency(c.total_gastos || 0)}</TableCell>
                            <TableCell sx={{ color: c.total_efectivo_ventas < 0 ? RED : GREEN, fontWeight: 600 }}>
                              {formatCurrency(c.total_efectivo_ventas)}
                            </TableCell>
                            <TableCell>{formatCurrency(c.efectivo_fisico)}</TableCell>
                            <TableCell sx={{ fontWeight: 700, color: difColor }}>
                              {dif === 0 ? <Chip label="Cuadre exacto" size="small" sx={{ bgcolor: `${GREEN}15`, color: GREEN, fontWeight: 700, fontSize: 10 }} />
                                : dif > 0 ? `+${formatCurrency(dif)}`
                                : formatCurrency(dif)
                              }
                            </TableCell>
                            <TableCell sx={{ fontSize: 11, color: 'text.secondary', maxWidth: 160 }}>
                              <Tooltip title={c.observaciones || ''}>
                                <Typography sx={{ fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 140 }}>
                                  {c.observaciones || '—'}
                                </Typography>
                              </Tooltip>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
                <TablePagination
                  component="div"
                  count={filteredCortes.length}
                  page={cortesPage}
                  onPageChange={(_, p) => setCortesPage(p)}
                  rowsPerPage={cortesPP}
                  onRowsPerPageChange={e => { setCortesPP(parseInt(e.target.value, 10)); setCortesPage(0); }}
                  rowsPerPageOptions={[10, 15, 25, 50]}
                  labelRowsPerPage="Por página:"
                  labelDisplayedRows={({ from, to, count }) => `${from}–${to} de ${count}`}
                />
              </>
            )}

            {/* ─ Historial gastos (colapsable) ─ */}
            <Box sx={{ mt: 3 }}>
              <Button
                fullWidth
                onClick={() => setShowGastosHistorial(p => !p)}
                endIcon={showGastosHistorial ? <ExpandLess /> : <ExpandMore />}
                sx={{
                  justifyContent: 'space-between', textAlign: 'left',
                  borderRadius: 2.5, fontWeight: 700, fontSize: 13,
                  py: 1.5, px: 2, border: '1px solid', borderColor: 'divider',
                  color: 'text.primary', bgcolor: 'action.hover',
                  '&:hover': { bgcolor: `${RED}06` },
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <MoneyOff sx={{ color: RED, fontSize: 18 }} />
                  Historial completo de gastos ({gastos.length})
                </Box>
              </Button>
              <Collapse in={showGastosHistorial}>
                <Paper variant="outlined" sx={{ borderRadius: '0 0 2.5rem 2.5rem', overflow: 'hidden', mt: -0.5, borderTop: 0 }}>
                  {/* Filtro categoría */}
                  <Box sx={{ p: 2, display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center', borderBottom: '1px solid', borderColor: 'divider' }}>
                    <FormControl size="small" sx={{ minWidth: 160 }}>
                      <InputLabel>Categoría</InputLabel>
                      <Select value={filtroGCat} label="Categoría" onChange={e => { setFiltroGCat(e.target.value); setGastosPage(0); }}>
                        <MenuItem value="">Todas</MenuItem>
                        {CATEGORIAS_GASTO.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                      </Select>
                    </FormControl>
                    <Button size="small" startIcon={<Add />}
                      onClick={() => { resetGasto(); setGastoDialog(true); }}
                      variant="outlined" sx={{ color: RED, borderColor: `${RED}40`, fontWeight: 700, borderRadius: 2 }}
                    >
                      Nuevo gasto
                    </Button>
                  </Box>
                  <Box sx={{ p: 1.5 }}>
                    {isMobile ? (
                      paginatedGastos.map(g => (
                        <GastoRow key={g.id} gasto={g} onEdit={handleEditGasto} onDelete={handleDeleteGasto} isMobile />
                      ))
                    ) : (
                      <Table size="small">
                        <TableHead sx={{ bgcolor: 'action.hover' }}>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 700, fontSize: 11 }}>Fecha</TableCell>
                            <TableCell sx={{ fontWeight: 700, fontSize: 11 }}>Beneficiario</TableCell>
                            <TableCell sx={{ fontWeight: 700, fontSize: 11 }}>Concepto</TableCell>
                            <TableCell sx={{ fontWeight: 700, fontSize: 11 }}>Categoría</TableCell>
                            <TableCell sx={{ fontWeight: 700, fontSize: 11 }}>Método</TableCell>
                            <TableCell sx={{ fontWeight: 700, fontSize: 11 }}>Monto</TableCell>
                            <TableCell />
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {paginatedGastos.map(g => (
                            <GastoRow key={g.id} gasto={g} onEdit={handleEditGasto} onDelete={handleDeleteGasto} isMobile={false} />
                          ))}
                        </TableBody>
                      </Table>
                    )}
                    <TablePagination
                      component="div"
                      count={gastosFiltrados.length}
                      page={gastosPage}
                      onPageChange={(_, p) => setGastosPage(p)}
                      rowsPerPage={gastosPP}
                      onRowsPerPageChange={e => { setGastosPP(parseInt(e.target.value, 10)); setGastosPage(0); }}
                      rowsPerPageOptions={[10, 25, 50]}
                      labelRowsPerPage="Por página:"
                      labelDisplayedRows={({ from, to, count }) => `${from}–${to} de ${count}`}
                    />
                  </Box>
                </Paper>
              </Collapse>
            </Box>
          </Box>
        )}
      </Paper>

      {/* ════ MODAL: CERRAR CAJA ════════════════════════════════════════════════ */}
      <Dialog
        open={openCierre}
        onClose={() => { if (!submitting) { setOpenCierre(false); setUseDenoms(false); setDenoms({}); } }}
        maxWidth="sm" fullWidth fullScreen={isMobile}
        PaperProps={{ sx: { borderRadius: isMobile ? 0 : 3.5, overflow: 'hidden' } }}
      >
        <Box sx={{ height: 5, background: `linear-gradient(90deg, ${ACCENT}, #818CF8)` }} />
        <DialogTitle sx={{ pb: 1, pt: 2.5, pr: 6 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Avatar sx={{ bgcolor: `${ACCENT}15`, color: ACCENT }}><PointOfSale /></Avatar>
            <Box>
              <Typography sx={{ fontWeight: 800, fontSize: 16 }}>Cierre de Caja</Typography>
              <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{preview?.fecha} · Cuenta el efectivo de la gaveta</Typography>
            </Box>
          </Box>
          <IconButton size="small" onClick={() => { setOpenCierre(false); setUseDenoms(false); setDenoms({}); }}
            disabled={submitting} sx={{ position: 'absolute', right: 12, top: 14, color: 'text.secondary' }}>
            <Close fontSize="small" />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ pt: 1 }}>
          {/* Efectivo esperado */}
          <Paper sx={{ p: 2, mb: 2, borderRadius: 2.5, bgcolor: 'action.hover', border: '1px solid', borderColor: 'divider' }}>
            <Typography sx={{ fontSize: 11, fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.6, mb: 1.5 }}>
              Composición del efectivo esperado
            </Typography>
            {[
              { label: 'Ventas en efectivo',       val: preview?.ventas_contado || 0,   color: GREEN },
              { label: 'Abonos cartera efectivo',  val: preview?.abonos_cartera || 0,   color: BLUE },
              { label: 'Recaudo préstamos',         val: preview?.recaudo_prestamos || 0, color: PURPLE },
              { label: 'Gastos en efectivo (−)',   val: -(preview?.total_gastos || 0),  color: RED },
            ].filter(x => x.val !== 0).map(({ label, val, color }) => (
              <Box key={label} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
                <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{label}</Typography>
                <Typography sx={{ fontSize: 12, fontWeight: 700, color }}>
                  {val >= 0 ? '' : '−'}{formatCurrency(Math.abs(val))}
                </Typography>
              </Box>
            ))}
            <Divider sx={{ my: 1 }} />
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography sx={{ fontSize: 13, fontWeight: 700 }}>Efectivo esperado en caja</Typography>
              <Typography sx={{ fontSize: 18, fontWeight: 900, color: (preview?.efectivo || 0) < 0 ? RED : GREEN }}>
                {formatCurrency(preview?.efectivo || 0)}
              </Typography>
            </Box>
          </Paper>

          {/* Toggle denominaciones */}
          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
            <Button variant="outlined" size="small"
              onClick={() => { setUseDenoms(p => !p); if (useDenoms) { setDenoms({}); setEfectivoFisico(''); } }}
              sx={{ borderRadius: 2, fontWeight: 700, fontSize: 12, borderColor: ACCENT, color: ACCENT }}
            >
              {useDenoms ? 'Ingresar total directo' : 'Contar por denominaciones'}
            </Button>
          </Box>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {useDenoms ? (
              <>
                <DenomGrid denoms={denoms} onChange={setDenoms} />
                <Box sx={{ display: 'flex', justifyContent: 'space-between', p: 1.5, borderRadius: 2, bgcolor: `${GREEN}08`, border: `1px solid ${GREEN}20` }}>
                  <Typography sx={{ fontSize: 13, fontWeight: 700 }}>Total contado</Typography>
                  <Typography sx={{ fontSize: 18, fontWeight: 900, color: GREEN }}>{formatCurrency(denomTotal)}</Typography>
                </Box>
              </>
            ) : (
              <CurrencyField
                label="Dinero físico en gaveta *"
                value={efectivoFisico}
                onChange={setEfectivoFisico}
                helperText="Cuenta billetes y monedas, ingresa el total aquí"
              />
            )}

            {efectivoFisico !== '' && (
              <Alert
                severity={diferenciaCierre === 0 ? 'success' : diferenciaCierre > 0 ? 'info' : 'error'}
                sx={{ borderRadius: 2 }}
              >
                <Typography sx={{ fontWeight: 800, fontSize: 14 }}>
                  {diferenciaCierre === 0
                    ? '✓ Cuadre exacto — todo en orden'
                    : diferenciaCierre > 0
                      ? `Sobrante: ${formatCurrency(Math.abs(diferenciaCierre))}`
                      : `Faltante: ${formatCurrency(Math.abs(diferenciaCierre))}`
                  }
                </Typography>
                {Math.abs(diferenciaCierre) > 1000 && (
                  <Typography sx={{ fontSize: 11, mt: 0.5 }}>
                    Se notificará al administrador automáticamente.
                  </Typography>
                )}
              </Alert>
            )}

            <TextField fullWidth size="small" multiline rows={2}
              label="Observaciones (opcional)"
              value={observaciones} onChange={e => setObservaciones(e.target.value)}
              placeholder="Ej: Faltante por vuelto en efectivo..." />
          </Box>
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2.5, pt: 1, gap: 1 }}>
          <Button onClick={() => { setOpenCierre(false); setUseDenoms(false); setDenoms({}); }}
            disabled={submitting} variant="outlined" sx={{ borderRadius: 2, fontWeight: 600, color: 'text.secondary', flex: isMobile ? 1 : 'none' }}>
            Cancelar
          </Button>
          <Button onClick={handleCerrarCaja} disabled={submitting} variant="contained"
            startIcon={submitting ? <CircularProgress size={14} color="inherit" /> : <CheckCircle />}
            sx={{ borderRadius: 2, fontWeight: 700, flex: isMobile ? 1 : 'none', background: `linear-gradient(135deg, ${ACCENT}, #818CF8)`, boxShadow: `0 4px 14px ${ACCENT}30`, color: '#fff' }}
          >
            {submitting ? 'Cerrando…' : 'Confirmar Cierre'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ════ MODAL: GASTO ══════════════════════════════════════════════════════ */}
      <Dialog
        open={gastoDialog} onClose={() => !submitting && setGastoDialog(false)}
        maxWidth="sm" fullWidth fullScreen={isMobile}
        PaperProps={{ sx: { borderRadius: isMobile ? 0 : 3.5, overflow: 'hidden' } }}
      >
        <Box sx={{ height: 4, bgcolor: RED }} />
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pt: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Avatar sx={{ bgcolor: `${RED}15`, color: RED }}><MoneyOff /></Avatar>
            <Typography sx={{ fontWeight: 800, fontSize: 15 }}>
              {editingGastoId ? 'Editar Gasto' : 'Registrar Gasto'}
            </Typography>
          </Box>
          <IconButton size="small" onClick={() => setGastoDialog(false)} disabled={submitting}><Close fontSize="small" /></IconButton>
        </DialogTitle>

        <DialogContent sx={{ pt: 0.5 }}>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Autocomplete
              options={terceros}
              getOptionLabel={o => o.nombre || ''}
              value={gastoTercero}
              onChange={(_, v) => setGastoTercero(v)}
              noOptionsText={
                <Button size="small" onClick={() => setQuickCreate({ open: true })}>
                  + Crear nuevo tercero
                </Button>
              }
              renderInput={params => (
                <TextField {...params} label="Beneficiario / Proveedor *" size="small" fullWidth
                  InputProps={{
                    ...params.InputProps,
                    endAdornment: (
                      <>
                        {params.InputProps.endAdornment}
                        <Tooltip title="Crear nuevo">
                          <IconButton size="small" onClick={() => setQuickCreate({ open: true })}>
                            <Add fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </>
                    ),
                  }}
                />
              )}
            />
            <Grid container spacing={1.5}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <CurrencyField label="Monto *" value={gastoMonto} onChange={setGastoMonto} size="small" fullWidth />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField fullWidth size="small" type="date" label="Fecha" value={gastoFecha}
                  onChange={e => setGastoFecha(e.target.value)} InputLabelProps={{ shrink: true }} />
              </Grid>
            </Grid>
            <TextField fullWidth size="small" label="Concepto / Descripción *"
              placeholder="Ej: Pago luz eléctrica enero"
              value={gastoConcepto} onChange={e => setGastoConcepto(e.target.value)} />
            <Grid container spacing={1.5}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <FormControl fullWidth size="small">
                  <InputLabel>Método de pago</InputLabel>
                  <Select value={gastoMetodo} label="Método de pago" onChange={e => setGastoMetodo(e.target.value)}>
                    {METODOS_PAGO.map(m => <MenuItem key={m} value={m}>{m}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <FormControl fullWidth size="small">
                  <InputLabel>Categoría</InputLabel>
                  <Select value={gastoCategoria} label="Categoría" onChange={e => setGastoCategoria(e.target.value)}>
                    <MenuItem value="">Sin categoría</MenuItem>
                    {CATEGORIAS_GASTO.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
            {/* Preview: impacto en caja */}
            {gastoMonto && gastoMetodo === 'Efectivo' && (
              <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2, bgcolor: `${RED}06` }}>
                <Typography sx={{ fontSize: 12, color: RED, fontWeight: 700 }}>
                  💡 Este gasto en efectivo reducirá la caja física en {formatCurrency(parseFloat(gastoMonto) || 0)}
                </Typography>
              </Paper>
            )}
          </Stack>
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button onClick={() => setGastoDialog(false)} disabled={submitting} variant="outlined"
            sx={{ borderRadius: 2, fontWeight: 600, color: 'text.secondary', flex: isMobile ? 1 : 'none' }}>
            Cancelar
          </Button>
          <Button onClick={handleSaveGasto} disabled={submitting} variant="contained"
            startIcon={submitting ? <CircularProgress size={14} color="inherit" /> : <CheckCircle />}
            sx={{ borderRadius: 2, fontWeight: 700, bgcolor: RED, flex: isMobile ? 1 : 'none', '&:hover': { bgcolor: '#d32f2f' } }}
          >
            {submitting ? 'Guardando…' : editingGastoId ? 'Actualizar' : 'Guardar Gasto'}
          </Button>
        </DialogActions>
      </Dialog>

      <QuickCreateModal
        open={quickCreate.open}
        onClose={() => setQuickCreate({ open: false })}
        type="tercero"
        initialName=""
        onCreated={(t) => { setTerceros(p => [...p, t]); setGastoTercero(t); setQuickCreate({ open: false }); }}
      />
    </Box>
  );
}
