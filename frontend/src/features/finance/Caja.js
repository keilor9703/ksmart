import React, { useState, useEffect, useMemo } from 'react';
import {
  Box, Typography, Paper, Grid, Button, Divider, Tabs, Tab,
  TextField, Chip, Table, TableBody, TableCell, Stack, Autocomplete, Tooltip,
  TableContainer, TableHead, TableRow, CircularProgress, TablePagination,
  Dialog, DialogTitle, DialogContent, DialogActions, MenuItem, Select,
  FormControl, InputLabel, InputAdornment,
  IconButton, Alert, useTheme, useMediaQuery,
  TableSortLabel, LinearProgress,
} from '@mui/material';
import {
  PointOfSale, CheckCircle, Close, Add,
  TrendingUp, AttachMoney, CreditCard, AccountBalance,
  Refresh, ReceiptLong, MoneyOff, Edit, Delete, Search, FileDownload,
  Category, CalendarToday, FilterList,
} from '@mui/icons-material';
import { toast } from 'react-toastify';
import apiClient from '../../api';
import { formatCurrency } from '../../utils/formatters';
import CurrencyField from '../../components/common/CurrencyField';
import QuickCreateModal from '../../components/common/QuickCreateModal';
import HelpGuideTopBar from '../../components/onboarding/HelpGuideTopBar';

const ACCENT  = '#FF6020';
const GREEN   = '#10B981';
const RED     = '#EF4444';
const BLUE    = '#3B82F6';
const YELLOW  = '#F59E0B';

const BILLETES = [100000, 50000, 20000, 10000, 5000, 2000, 1000];
const MONEDAS  = [500, 200, 100, 50];

const CATEGORIAS_GASTO = [
  'Servicios públicos', 'Arriendo', 'Nómina', 'Proveedores',
  'Transporte', 'Papelería', 'Aseo y cafetería', 'Mantenimiento',
  'Publicidad', 'Impuestos', 'Otros',
];

const todayISO = () => new Date().toISOString().split('T')[0];

function TabPanel({ children, value, index, ...other }) {
  return (
    <div role="tabpanel" hidden={value !== index} {...other}>
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
}

// ─── KPI Card ──────────────────────────────────────────────────────────────────
const KpiCard = ({ label, value, icon, color, sub }) => (
  <Paper sx={{
    p: 2, borderRadius: 3,
    display: 'flex', alignItems: 'center', gap: 1.5,
    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
  }}>
    <Box sx={{
      width: 42, height: 42, borderRadius: 2, flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      bgcolor: `${color}18`, color,
    }}>
      {icon}
    </Box>
    <Box sx={{ minWidth: 0 }}>
      <Typography sx={{ fontSize: 11, color: 'text.secondary', fontWeight: 500 }}>
        {label}
      </Typography>
      <Typography sx={{ fontSize: 17, fontWeight: 800, lineHeight: 1.2 }}>
        {value}
      </Typography>
      {sub && <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>{sub}</Typography>}
    </Box>
  </Paper>
);

// ─── Método Row ────────────────────────────────────────────────────────────────
const MetodoRow = ({ icon, label, value, color }) => (
  <Box sx={{
    display: 'flex', alignItems: 'center', gap: 1.5,
    py: 1.2, borderBottom: '1px solid', borderColor: 'divider',
  }}>
    <Box sx={{
      width: 30, height: 30, borderRadius: 1.5,
      bgcolor: `${color}15`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color, flexShrink: 0,
    }}>
      {icon}
    </Box>
    <Typography sx={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{label}</Typography>
    <Typography sx={{ fontSize: 14, fontWeight: 700, color }}>{formatCurrency(value)}</Typography>
  </Box>
);

// ─── SortTh ────────────────────────────────────────────────────────────────────
const SortTh = ({ col, label, sortCol, sortDir, onSort, align, sx }) => (
  <TableCell align={align} sx={{ fontSize: 11, fontWeight: 600, ...sx }}>
    <TableSortLabel active={sortCol === col} direction={sortCol === col ? sortDir : 'asc'} onClick={() => onSort(col)}>
      {label}
    </TableSortLabel>
  </TableCell>
);

// ─── DenomGrid ─────────────────────────────────────────────────────────────────
const DenomGrid = ({ denoms, onChange }) => {
  const update = (d, val) => {
    const n = Math.max(0, parseInt(val, 10) || 0);
    onChange({ ...denoms, [d]: n });
  };
  const subBilletes = BILLETES.reduce((s, d) => s + d * (parseInt(denoms[d] || 0, 10) || 0), 0);
  const subMonedas  = MONEDAS.reduce((s, d) => s + d * (parseInt(denoms[d] || 0, 10) || 0), 0);
  return (
    <Box>
      <Typography sx={{ fontSize: 11, fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.6, mb: 1 }}>Billetes</Typography>
      <Grid container spacing={1} sx={{ mb: 1 }}>
        {BILLETES.map(d => (
          <Grid item xs={6} key={d}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>${(d).toLocaleString('es-CO')}</Typography>
                <Typography sx={{ fontSize: 11, fontWeight: 700, color: GREEN }}>{formatCurrency(d * (parseInt(denoms[d] || 0, 10) || 0))}</Typography>
              </Box>
              <TextField type="number" size="small" value={denoms[d] || ''} onChange={e => update(d, e.target.value)}
                inputProps={{ min: 0, style: { width: 52, textAlign: 'center', fontWeight: 700, padding: '4px 6px' } }}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5 } }} />
            </Box>
          </Grid>
        ))}
      </Grid>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1.5 }}>
        <Typography sx={{ fontSize: 12, fontWeight: 700 }}>Subtotal billetes: <Box component="span" sx={{ color: GREEN }}>{formatCurrency(subBilletes)}</Box></Typography>
      </Box>
      <Typography sx={{ fontSize: 11, fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.6, mb: 1 }}>Monedas</Typography>
      <Grid container spacing={1} sx={{ mb: 1 }}>
        {MONEDAS.map(d => (
          <Grid item xs={6} key={d}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>${d}</Typography>
                <Typography sx={{ fontSize: 11, fontWeight: 700, color: BLUE }}>{formatCurrency(d * (parseInt(denoms[d] || 0, 10) || 0))}</Typography>
              </Box>
              <TextField type="number" size="small" value={denoms[d] || ''} onChange={e => update(d, e.target.value)}
                inputProps={{ min: 0, style: { width: 52, textAlign: 'center', fontWeight: 700, padding: '4px 6px' } }}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5 } }} />
            </Box>
          </Grid>
        ))}
      </Grid>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Typography sx={{ fontSize: 12, fontWeight: 700 }}>Subtotal monedas: <Box component="span" sx={{ color: BLUE }}>{formatCurrency(subMonedas)}</Box></Typography>
      </Box>
    </Box>
  );
};

// ─── Gasto Card Mobile ─────────────────────────────────────────────────────────
const GastoCard = ({ gasto, onEdit, onDelete }) => (
  <Paper sx={{ p: 2, mb: 1.5, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontWeight: 700, fontSize: 14, mb: 0.3 }}>
          {gasto.tercero?.nombre}
        </Typography>
        <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 0.5 }}>
          {gasto.concepto}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Chip
            label={gasto.metodo_pago}
            size="small"
            sx={{ fontSize: 10, height: 20, bgcolor: 'action.hover', fontWeight: 600 }}
          />
          {gasto.categoria && (
            <Chip
              label={gasto.categoria}
              size="small"
              sx={{ fontSize: 10, height: 20, bgcolor: `${BLUE}12`, color: BLUE, fontWeight: 600 }}
            />
          )}
          <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
            {new Date(gasto.fecha).toLocaleDateString()}
          </Typography>
        </Box>
      </Box>
      <Box sx={{ textAlign: 'right' }}>
        <Typography sx={{ fontWeight: 800, fontSize: 16, color: RED, ml: 1, mb: 1 }}>
          {formatCurrency(gasto.monto)}
        </Typography>
        <Stack direction="row" spacing={0.5} justifyContent="flex-end">
          <IconButton size="small" onClick={() => onEdit(gasto)} color="primary">
            <Edit fontSize="small" />
          </IconButton>
          <IconButton size="small" onClick={() => onDelete(gasto.id)} color="error">
            <Delete fontSize="small" />
          </IconButton>
        </Stack>
      </Box>
    </Box>
  </Paper>
);

// ─── Corte Card Mobile ─────────────────────────────────────────────────────────
const CorteCard = ({ corte }) => {
  const dif = corte.diferencia;
  const difColor = dif === 0 ? 'text.primary' : dif > 0 ? BLUE : RED;
  const expectedColor = corte.total_efectivo_ventas < 0 ? RED : GREEN;

  return (
    <Paper sx={{ p: 2.5, mb: 2, borderRadius: 3, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
        <Box>
          <Typography sx={{ fontWeight: 700, fontSize: 15 }}>
            {new Date(corte.fecha).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
          </Typography>
          <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>Corte #{corte.id}</Typography>
        </Box>
        <Chip
          label={corte.estado}
          size="small"
          sx={{
            bgcolor: corte.estado === 'cerrado' ? `${GREEN}15` : `${YELLOW}15`,
            color: corte.estado === 'cerrado' ? GREEN : YELLOW,
            fontWeight: 600, fontSize: 10, borderRadius: 1.5,
          }}
        />
      </Box>

      <Divider sx={{ my: 1.5 }} />

      <Grid container spacing={1} sx={{ mb: 1 }}>
        {[
          { label: 'Ingresos', val: corte.total_ventas_dia, color: ACCENT },
          { label: 'Gastos', val: corte.total_gastos || 0, color: RED },
          { label: 'Efectivo Esperado', val: corte.total_efectivo_ventas, color: expectedColor },
          { label: 'Efectivo Físico', val: corte.efectivo_fisico, color: BLUE },
        ].map(({ label, val, color }) => (
          <Grid item xs={6} key={label}>
            <Box sx={{ textAlign: 'center', p: 1, borderRadius: 2, bgcolor: 'action.hover' }}>
              <Typography sx={{ fontSize: 10, color: 'text.secondary', mb: 0.2 }}>{label}</Typography>
              <Typography sx={{ fontSize: 13, fontWeight: 700, color }}>{formatCurrency(val)}</Typography>
            </Box>
          </Grid>
        ))}
      </Grid>

      {corte.observaciones && (
        <Box sx={{ mt: 1, p: 1, borderRadius: 1.5, bgcolor: 'action.hover' }}>
          <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>📝 {corte.observaciones}</Typography>
        </Box>
      )}

      {dif !== 0 && (
        <Box sx={{ mt: 1.5, pt: 1.5, borderTop: '1px dashed', borderColor: 'divider', textAlign: 'center' }}>
          <Typography sx={{ fontSize: 11, color: 'text.secondary', mb: 0.3 }}>
            {dif > 0 ? 'Sobrante' : 'Faltante'}
          </Typography>
          <Typography sx={{ fontWeight: 800, fontSize: 16, color: difColor }}>
            {dif === 0 ? '—' : dif > 0 ? `+${formatCurrency(dif)}` : formatCurrency(dif)}
          </Typography>
        </Box>
      )}
    </Paper>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// ─── COMPONENTE PRINCIPAL ──────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

export default function Caja() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [tab, setTab] = useState(0);

  // Estados Cierre Caja
  const [preview, setPreview] = useState(null);
  const [historial, setHistorial] = useState([]);
  const [loadingPreview, setLoadingPreview] = useState(true);
  const [loadingHistorial, setLoadingHistorial] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [efectivoFisico, setEfectivoFisico] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Denominaciones
  const [useDenoms, setUseDenoms] = useState(false);
  const [denoms, setDenoms] = useState({});

  // Historial de cortes paginación y filtros
  const [cortesPage, setCortesPage] = useState(0);
  const [cortesRowsPerPage, setCortesRowsPerPage] = useState(10);
  const [cortesSortCol, setCortesSortCol] = useState('fecha');
  const [cortesSortDir, setCortesSortDir] = useState('desc');
  const [cortesDesde, setCortesDesde] = useState('');
  const [cortesHasta, setCortesHasta] = useState('');
  const [cortesEstado, setCortesEstado] = useState('');

  // Estados Gastos
  const [gastos, setGastos] = useState([]);
  const [terceros, setTerceros] = useState([]);
  const [loadingGastos, setLoadingGastos] = useState(false);
  const [deleteGastoId, setDeleteGastoId] = useState(null);
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);

  // Filtros gastos
  const [busquedaGasto, setBusquedaGasto] = useState('');
  const [filtroMetodo, setFiltroMetodo] = useState('');
  const [filtroGastoDesde, setFiltroGastoDesde] = useState('');
  const [filtroGastoHasta, setFiltroGastoHasta] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('');
  const [gastosPage, setGastosPage] = useState(0);
  const [gastosRowsPerPage, setGastosRowsPerPage] = useState(10);
  const [gastosSortCol, setGastosSortCol] = useState('fecha');
  const [gastosSortDir, setGastosSortDir] = useState('desc');

  // Formulario Gasto
  const [editingGastoId, setEditingGastoId] = useState(null);
  const [gastoTercero, setGastoTercero] = useState(null);
  const [terceroInput, setTerceroInput] = useState('');
  const [gastoMonto, setGastoMonto] = useState('');
  const [gastoConcepto, setGastoConcepto] = useState('');
  const [gastoMetodo, setGastoMetodo] = useState('Efectivo');
  const [gastoFecha, setGastoFecha] = useState(todayISO());
  const [gastoCategoria, setGastoCategoria] = useState('');

  // QuickCreate
  const [quickCreate, setQuickCreate] = useState({ open: false, type: 'tercero', initialName: '' });

  useEffect(() => { // eslint-disable-line react-hooks/exhaustive-deps
    fetchPreview();
    fetchHistorial();
    fetchGastos();
    fetchTerceros();
  }, []);

  const denomTotal = useMemo(() =>
    [...BILLETES, ...MONEDAS].reduce((s, d) => s + d * (parseInt(denoms[d] || 0, 10) || 0), 0),
    [denoms]
  );

  useEffect(() => { // eslint-disable-line react-hooks/exhaustive-deps
    if (useDenoms) setEfectivoFisico(denomTotal > 0 ? String(denomTotal) : '');
  }, [useDenoms, denomTotal]);

  const fetchPreview = async () => {
    setLoadingPreview(true);
    try {
      const { data } = await apiClient.get('/caja/corte/preview');
      setPreview(data);
    } catch { toast.error('Error al cargar el resumen del día'); }
    finally { setLoadingPreview(false); }
  };

  const fetchHistorial = async () => {
    setLoadingHistorial(true);
    try {
      const { data } = await apiClient.get('/caja/cortes');
      setHistorial(data);
    } catch { }
    finally { setLoadingHistorial(false); }
  };

  const fetchGastos = async () => {
    setLoadingGastos(true);
    try {
      const { data } = await apiClient.get('/caja/gastos');
      setGastos(data);
    } catch { toast.error('Error al cargar historial de gastos'); }
    finally { setLoadingGastos(false); }
  };

  const fetchTerceros = async () => {
    try {
      const { data } = await apiClient.get('/clientes/');
      setTerceros(data);
    } catch { }
  };

  const handleCerrarCaja = async () => {
    setSubmitting(true);
    try {
      await apiClient.post('/caja/corte', {
        efectivo_fisico: efectivoFisico === '' ? 0 : parseFloat(efectivoFisico),
        observaciones,
      });
      toast.success('¡Caja cerrada exitosamente!');
      setOpenDialog(false);
      setEfectivoFisico('');
      setObservaciones('');
      setUseDenoms(false);
      setDenoms({});
      fetchPreview();
      fetchHistorial();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al cerrar la caja');
    } finally { setSubmitting(false); }
  };

  const handleRegistrarGasto = async (e) => {
    e.preventDefault();
    if (!gastoTercero || !gastoMonto || !gastoConcepto) {
      toast.warning('Completa todos los campos obligatorios del gasto.');
      return;
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
        toast.success('Gasto actualizado correctamente');
      } else {
        await apiClient.post('/caja/gastos', payload);
        toast.success('Gasto registrado correctamente');
      }

      resetGastoForm();
      fetchGastos(); fetchPreview();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al procesar el gasto');
    } finally { setSubmitting(false); }
  };

  const resetGastoForm = () => {
    setEditingGastoId(null);
    setGastoTercero(null); setTerceroInput(''); setGastoMonto('');
    setGastoConcepto(''); setGastoCategoria(''); setGastoFecha(todayISO());
  };

  const handleEditGasto = (g) => {
    setEditingGastoId(g.id);
    setGastoTercero(g.tercero);
    setTerceroInput(g.tercero?.nombre || '');
    setGastoMonto(g.monto.toString());
    setGastoConcepto(g.concepto);
    setGastoMetodo(g.metodo_pago);
    setGastoFecha(g.fecha ? g.fecha.split('T')[0] : todayISO());
    setGastoCategoria(g.categoria || '');
    if (isMobile) window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteGasto = (id) => {
    setDeleteGastoId(id);
    setOpenDeleteDialog(true);
  };

  const handleConfirmDeleteGasto = async () => {
    setSubmitting(true);
    try {
      await apiClient.delete(`/caja/gastos/${deleteGastoId}`);
      toast.success('Gasto eliminado correctamente');
      setOpenDeleteDialog(false);
      fetchGastos(); fetchPreview();
    } catch {
      toast.error('Error al eliminar el gasto');
    } finally {
      setSubmitting(false);
      setDeleteGastoId(null);
    }
  };

  // ─── Sort handlers ──────────────────────────────────────────────────────────
  const handleGastoSort = (col) => {
    setGastosSortDir(prev => col === gastosSortCol ? (prev === 'asc' ? 'desc' : 'asc') : 'asc');
    setGastosSortCol(col);
    setGastosPage(0);
  };

  const handleCorteSort = (col) => {
    setCortesSortDir(prev => col === cortesSortCol ? (prev === 'asc' ? 'desc' : 'asc') : 'asc');
    setCortesSortCol(col);
    setCortesPage(0);
  };

  // ─── Cortes filtrados, ordenados y paginados ────────────────────────────────
  const filteredCortes = useMemo(() => {
    return historial.filter(c => {
      if (cortesEstado && c.estado !== cortesEstado) return false;
      if (cortesDesde && new Date(c.fecha) < new Date(cortesDesde)) return false;
      if (cortesHasta) {
        const h = new Date(cortesHasta); h.setHours(23, 59, 59);
        if (new Date(c.fecha) > h) return false;
      }
      return true;
    });
  }, [historial, cortesDesde, cortesHasta, cortesEstado]);

  const sortedCortes = useMemo(() => {
    return [...filteredCortes].sort((a, b) => {
      let va, vb;
      switch (cortesSortCol) {
        case 'ingresos':    va = a.total_ventas_dia;    vb = b.total_ventas_dia;    break;
        case 'gastos':      va = a.total_gastos || 0;   vb = b.total_gastos || 0;   break;
        case 'diferencia':  va = a.diferencia;           vb = b.diferencia;           break;
        default:            va = new Date(a.fecha);      vb = new Date(b.fecha);
      }
      return cortesSortDir === 'asc' ? va - vb : vb - va;
    });
  }, [filteredCortes, cortesSortCol, cortesSortDir]);

  const paginatedCortes = sortedCortes.slice(
    cortesPage * cortesRowsPerPage,
    cortesPage * cortesRowsPerPage + cortesRowsPerPage
  );

  // ─── Análisis ──────────────────────────────────────────────────────────────

  const gastosPorCategoria = useMemo(() => {
    const map = {};
    gastos.forEach(g => {
      const cat = g.categoria || 'Sin categoría';
      if (!map[cat]) map[cat] = { total: 0, count: 0 };
      map[cat].total += g.monto;
      map[cat].count++;
    });
    const totalAll = gastos.reduce((s, g) => s + g.monto, 0);
    return Object.entries(map)
      .map(([cat, { total, count }]) => ({ cat, total, count, pct: totalAll > 0 ? Math.round(total / totalAll * 100) : 0 }))
      .sort((a, b) => b.total - a.total);
  }, [gastos]);

  const topBeneficiarios = useMemo(() => {
    const map = {};
    gastos.forEach(g => {
      const nom = g.tercero?.nombre || 'Desconocido';
      if (!map[nom]) map[nom] = { total: 0, count: 0 };
      map[nom].total += g.monto;
      map[nom].count++;
    });
    return Object.entries(map)
      .map(([nombre, { total, count }]) => ({ nombre, total, count }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [gastos]);

  const mesActual = todayISO().slice(0, 7);
  const cortesMes = useMemo(() => historial.filter(c => c.fecha?.startsWith(mesActual)), [historial, mesActual]);
  const diferenciaAcumuladaMes = useMemo(() => cortesMes.reduce((s, c) => s + (c.diferencia || 0), 0), [cortesMes]);


  const handleExportCSVCortes = () => {
    const rows = [
      ['Fecha', 'Ingresos', 'Gastos', 'Efectivo Esperado', 'Efectivo Físico', 'Diferencia', 'Estado', 'Observaciones'],
      ...sortedCortes.map(c => [
        new Date(c.fecha).toLocaleDateString('es-CO'),
        c.total_ventas_dia,
        c.total_gastos || 0,
        c.total_efectivo_ventas,
        c.efectivo_fisico,
        c.diferencia,
        c.estado,
        c.observaciones || '',
      ]),
    ];
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'cortes-caja.csv';
    a.click(); URL.revokeObjectURL(url);
  };


  const openQuickCreate = (initialName = '') => setQuickCreate({ open: true, type: 'tercero', initialName });
  const closeQuickCreate = () => setQuickCreate({ ...quickCreate, open: false });
  const handleQuickCreated = (nuevoTercero) => {
    setTerceros(prev => [...prev, nuevoTercero]);
    setGastoTercero(nuevoTercero);
    setTerceroInput(nuevoTercero.nombre);
    closeQuickCreate();
  };

  const diferencia = (efectivoFisico === '' ? 0 : parseFloat(efectivoFisico)) - (preview?.efectivo || 0);

  return (
    <Box sx={{ width: '100%' }}>
      {/* ── Header ── */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ width: 40, height: 40, borderRadius: 2, bgcolor: `${ACCENT}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: ACCENT }}>
            <PointOfSale />
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 700, fontSize: 20, lineHeight: 1.2 }}>Control de Caja</Typography>
            <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>Arqueo, cortes y gastos menores</Typography>
          </Box>
          <HelpGuideTopBar
            moduleName="Control de Caja"
            moduleColor={ACCENT}
            steps={[
              { title: 'Revisa el arqueo del día', description: 'En la pestaña "Arqueo" verás el resumen de ingresos por método de pago acumulados en el día.' },
              { title: 'Registra gastos menores', description: 'Usa la pestaña "Gastos" para registrar egresos de caja chica como cafetería, papelería o servicios menores.' },
              { title: 'Realiza el corte de caja', description: 'Al final del día, el corte registra el saldo final y cierra el período. Ingresa el efectivo físico contado.' },
              { title: 'Consulta el historial', description: 'Revisa cortes anteriores en la pestaña "Historial" para comparar y detectar descuadres.' },
            ]}
            faqItems={[
              { q: '¿Qué es el arqueo de caja?', a: 'Es el conteo y verificación del dinero disponible en un momento dado, comparando el dinero teórico (ventas) con el físico (billetes/monedas contados).' },
              { q: '¿Qué incluye el total del día?', a: 'Suma todas las ventas pagadas (efectivo, tarjeta, transferencia). Las ventas "Por Cobrar" no aparecen en el arqueo hasta que se paguen.' },
              { q: '¿Cómo registro un gasto de caja chica?', a: 'Ve a la pestaña "Gastos", haz clic en "Nuevo Gasto", ingresa el concepto y monto. El gasto se resta del efectivo disponible.' },
              { q: '¿Puedo corregir un corte ya realizado?', a: 'Los cortes son definitivos para mantener la integridad del registro. Si hay un error, contacta al administrador para anular y rehacer el corte.' },
            ]}
          />
        </Box>
        <Tooltip title="Actualizar datos">
          <IconButton onClick={() => { fetchPreview(); fetchHistorial(); fetchGastos(); }} size="small"
            sx={{ bgcolor: 'action.hover', borderRadius: 2 }}>
            <Refresh fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      {/* ── Tabs ── */}
      <Paper sx={{ borderRadius: 3, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', overflow: 'hidden', mb: 3 }}>
        <Tabs
          value={tab} onChange={(_, v) => setTab(v)}
          variant={isMobile ? 'scrollable' : 'standard'} scrollButtons="auto"
          sx={{
            px: 2, borderBottom: '1px solid', borderColor: 'divider',
            '& .MuiTab-root': { fontWeight: 600, fontSize: 13, textTransform: 'none', minHeight: 52 },
            '& .MuiTabs-indicator': { backgroundColor: ACCENT, height: 3, borderRadius: 3 },
            '& .Mui-selected': { color: `${ACCENT} !important` },
          }}
        >
          <Tab label="Corte y Resumen" />
          <Tab label="Gastos" />
          <Tab label="Análisis" />
        </Tabs>
      </Paper>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* ── TAB 0: RESUMEN Y CORTE ──────────────────────────────────────────── */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <TabPanel value={tab} index={0} sx={{ pt: 0 }}>
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2, gap: 1, flexWrap: 'wrap' }}>
          <Button variant="outlined" startIcon={<Refresh />} onClick={fetchPreview} size="small" sx={{ borderRadius: 2, fontWeight: 600, borderColor: 'divider', color: 'text.secondary' }}>
            Actualizar
          </Button>
          <Button variant="contained" startIcon={<PointOfSale />} onClick={() => setOpenDialog(true)} size="small" sx={{ background: `linear-gradient(135deg, ${ACCENT}, #ff9a62)`, boxShadow: `0 4px 14px rgba(255,96,32,0.3)`, borderRadius: 2, fontWeight: 600 }}>
            Cerrar Caja
          </Button>
        </Box>

        {loadingPreview ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress sx={{ color: ACCENT }} /></Box>
        ) : preview && (
          <>
            {/* KPIs — 5 cards */}
            <Grid container spacing={1.5} sx={{ mb: 2 }}>
              <Grid item xs={6} sm={4}>
                <KpiCard label="Ingresos Totales" value={formatCurrency(preview.total_dia)} icon={<TrendingUp />} color={ACCENT} sub={preview.fecha} />
              </Grid>
              <Grid item xs={6} sm={4}>
                <KpiCard label="Caja (Efectivo)" value={formatCurrency(preview.efectivo)} icon={<AttachMoney />} color={preview.efectivo < 0 ? RED : GREEN} />
              </Grid>
              <Grid item xs={6} sm={4}>
                <KpiCard label="Bancos (Transf.)" value={formatCurrency(preview.transferencia)} icon={<AccountBalance />} color={BLUE} />
              </Grid>
              <Grid item xs={6} sm={6}>
                <KpiCard label="Total Gastos" value={formatCurrency(preview.total_gastos)} icon={<MoneyOff />} color={RED} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <KpiCard
                  label="Neto del Día"
                  value={formatCurrency((preview.total_dia || 0) - (preview.total_gastos || 0))}
                  icon={<AccountBalance />}
                  color={((preview.total_dia || 0) - (preview.total_gastos || 0)) >= 0 ? BLUE : RED}
                />
              </Grid>
            </Grid>

            {/* Desglose Métodos */}
            <Paper sx={{ p: 2.5, borderRadius: 3, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', mb: 2 }}>
              <Typography sx={{ fontWeight: 700, fontSize: 14, mb: 1.5 }}>
                Saldos Netos Actuales (Ingresos descontando Gastos)
              </Typography>
              <MetodoRow icon={<AttachMoney sx={{ fontSize: 16 }} />} label="Caja Física (Efectivo)" value={preview.efectivo} color={preview.efectivo < 0 ? RED : GREEN} />
              <MetodoRow icon={<AccountBalance sx={{ fontSize: 16 }} />} label="Bancos (Transferencias)" value={preview.transferencia} color={BLUE} />
              <MetodoRow icon={<CreditCard sx={{ fontSize: 16 }} />} label="Datafono (Tarjetas)" value={preview.tarjeta + (preview.otros || 0)} color={YELLOW} />

              <Box sx={{ display: 'flex', justifyContent: 'space-between', pt: 1.5, borderTop: '2px solid', borderColor: 'divider', mt: 1 }}>
                <Typography sx={{ fontWeight: 700, fontSize: 14 }}>Balance Total (Efectivo + Bancos)</Typography>
                <Typography sx={{ fontWeight: 800, fontSize: 16, color: ACCENT }}>
                  {formatCurrency(preview.efectivo + preview.transferencia + preview.tarjeta + (preview.otros || 0))}
                </Typography>
              </Box>

              {(preview.ventas_contado > 0 || preview.abonos_cartera > 0) && (
                <Box sx={{ mt: 2, pt: 1.5, borderTop: '1px dashed', borderColor: 'divider' }}>
                  <Typography sx={{ fontSize: 11, fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.6, mb: 1 }}>
                    Por origen de ingreso
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    <Box sx={{ flex: 1, p: 1.2, borderRadius: 2, bgcolor: `${GREEN}08`, border: `1px solid ${GREEN}20`, textAlign: 'center', minWidth: isMobile ? '100%' : 'auto' }}>
                      <Typography sx={{ fontSize: 10, color: 'text.secondary', mb: 0.3 }}>Ventas contado ({preview.num_ventas || 0})</Typography>
                      <Typography sx={{ fontSize: 13, fontWeight: 700, color: GREEN }}>{formatCurrency(preview.ventas_contado || 0)}</Typography>
                    </Box>
                    <Box sx={{ flex: 1, p: 1.2, borderRadius: 2, bgcolor: `${BLUE}08`, border: `1px solid ${BLUE}20`, textAlign: 'center', minWidth: isMobile ? '100%' : 'auto' }}>
                      <Typography sx={{ fontSize: 10, color: 'text.secondary', mb: 0.3 }}>Abonos cartera ({preview.num_abonos || 0})</Typography>
                      <Typography sx={{ fontSize: 13, fontWeight: 700, color: BLUE }}>{formatCurrency(preview.abonos_cartera || 0)}</Typography>
                    </Box>
                  </Box>
                </Box>
              )}
            </Paper>
          </>
        )}

        {/* Historial de Cortes */}
        <Paper sx={{ p: 2.5, borderRadius: 3, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <Typography sx={{ fontWeight: 700, fontSize: 14, mb: 1.5 }}>Historial de cortes</Typography>

          {/* Filtros de cortes */}
          {!isMobile && (
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mb: 2, flexWrap: 'wrap' }} alignItems="center">
              <TextField size="small" label="Desde" type="date" value={cortesDesde}
                onChange={e => { setCortesDesde(e.target.value); setCortesPage(0); }}
                InputLabelProps={{ shrink: true }} sx={{ flex: 1, minWidth: 140 }} />
              <TextField size="small" label="Hasta" type="date" value={cortesHasta}
                onChange={e => { setCortesHasta(e.target.value); setCortesPage(0); }}
                InputLabelProps={{ shrink: true }} sx={{ flex: 1, minWidth: 140 }} />
              <Box sx={{ display: 'flex', gap: 0.5 }}>
                {['', 'abierto', 'cerrado'].map(e => (
                  <Chip key={e || 'todos'} label={e ? e.charAt(0).toUpperCase() + e.slice(1) : 'Todos'}
                    onClick={() => { setCortesEstado(e); setCortesPage(0); }} size="small"
                    sx={{ fontWeight: 600, fontSize: 11, borderRadius: 1.5, cursor: 'pointer',
                      bgcolor: cortesEstado === e ? `${ACCENT}20` : 'background.paper',
                      color: cortesEstado === e ? ACCENT : 'text.secondary',
                      border: '1.5px solid', borderColor: cortesEstado === e ? ACCENT : 'divider' }} />
                ))}
              </Box>
              <Tooltip title="Exportar CSV">
                <IconButton size="small" onClick={handleExportCSVCortes}><FileDownload fontSize="small" /></IconButton>
              </Tooltip>
            </Stack>
          )}

          {loadingHistorial ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}><CircularProgress size={24} sx={{ color: ACCENT }} /></Box>
          ) : historial.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}><PointOfSale sx={{ fontSize: 40, opacity: 0.2, mb: 1 }} /><Typography fontSize={13}>No hay cortes registrados</Typography></Box>
          ) : isMobile ? (
            <Box>{filteredCortes.map(c => <CorteCard key={c.id} corte={c} />)}</Box>
          ) : (
            <>
              <TableContainer sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider', overflowX: 'auto' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <SortTh col="fecha" label="Fecha" sortCol={cortesSortCol} sortDir={cortesSortDir} onSort={handleCorteSort} />
                      <SortTh col="ingresos" label="Ingresos Día" sortCol={cortesSortCol} sortDir={cortesSortDir} onSort={handleCorteSort} />
                      <SortTh col="gastos" label="Gastos" sortCol={cortesSortCol} sortDir={cortesSortDir} onSort={handleCorteSort} />
                      <TableCell sx={{ fontSize: 11, fontWeight: 600 }}>Efectivo Esperado</TableCell>
                      <TableCell sx={{ fontSize: 11, fontWeight: 600 }}>Efectivo Físico</TableCell>
                      <SortTh col="diferencia" label="Diferencia" sortCol={cortesSortCol} sortDir={cortesSortDir} onSort={handleCorteSort} />
                      <TableCell sx={{ fontSize: 11, fontWeight: 600 }}>Estado</TableCell>
                      <TableCell sx={{ fontSize: 11, fontWeight: 600 }}>Observaciones</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {paginatedCortes.map(c => {
                      const dif = c.diferencia;
                      const difColor = dif === 0 ? 'text.primary' : dif > 0 ? BLUE : RED;
                      return (
                        <TableRow key={c.id} hover>
                          <TableCell sx={{ fontSize: 11, whiteSpace: 'nowrap' }}>
                            {new Date(c.fecha).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>{formatCurrency(c.total_ventas_dia)}</TableCell>
                          <TableCell sx={{ color: RED, fontWeight: 600 }}>{formatCurrency(c.total_gastos || 0)}</TableCell>
                          <TableCell sx={{ color: c.total_efectivo_ventas < 0 ? RED : GREEN, fontWeight: 600 }}>{formatCurrency(c.total_efectivo_ventas)}</TableCell>
                          <TableCell>{formatCurrency(c.efectivo_fisico)}</TableCell>
                          <TableCell sx={{ fontWeight: 700, color: difColor }}>
                            {dif === 0 ? '—' : dif > 0 ? `+${formatCurrency(dif)}` : formatCurrency(dif)}
                          </TableCell>
                          <TableCell>
                            <Chip label={c.estado} size="small" sx={{ bgcolor: c.estado === 'cerrado' ? `${GREEN}15` : `${YELLOW}15`, color: c.estado === 'cerrado' ? GREEN : YELLOW, fontWeight: 600, fontSize: 10, borderRadius: 1.5 }} />
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
                rowsPerPage={cortesRowsPerPage}
                onRowsPerPageChange={e => { setCortesRowsPerPage(parseInt(e.target.value, 10)); setCortesPage(0); }}
                rowsPerPageOptions={[10, 25, 50]}
                labelRowsPerPage="Por página:"
                labelDisplayedRows={({ from, to, count }) => `${from}–${to} de ${count}`}
              />
            </>
          )}
        </Paper>
      </TabPanel>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* ── TAB 1: REGISTRO DE GASTOS ───────────────────────────────────────── */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <TabPanel value={tab} index={1} sx={{ pt: 0 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', py: 8, gap: 3 }}>
          <Box sx={{ width: 72, height: 72, borderRadius: 3, bgcolor: `${RED}12`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <MoneyOff sx={{ fontSize: 36, color: RED }} />
          </Box>
          <Box sx={{ textAlign: 'center', maxWidth: 460 }}>
            <Typography sx={{ fontWeight: 700, fontSize: 20, mb: 1 }}>Gestión de Gastos</Typography>
            <Typography sx={{ color: 'text.secondary', fontSize: 14, lineHeight: 1.6 }}>
              El registro y control de gastos se gestiona desde el módulo <strong>Compras y Gastos</strong>.
              Allí puedes registrar nuevos gastos, ver el historial completo, filtrar por categoría, método de pago y fechas.
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'center' }}>
            <Button
              variant="contained"
              size="large"
              startIcon={<MoneyOff />}
              onClick={() => { window.location.href = '/compras'; }}
              sx={{ background: `linear-gradient(135deg, ${RED}, #f87171)`, boxShadow: `0 4px 14px rgba(239,68,68,0.3)`, borderRadius: 2, fontWeight: 600, px: 4 }}
            >
              Ir a Compras y Gastos
            </Button>
          </Box>
          <Paper sx={{ p: 2.5, borderRadius: 2, bgcolor: 'action.hover', border: '1px solid', borderColor: 'divider', maxWidth: 420, width: '100%' }}>
            <Typography sx={{ fontSize: 12, fontWeight: 700, color: 'text.secondary', mb: 1, textTransform: 'uppercase', letterSpacing: 0.5 }}>¿Por qué está allá?</Typography>
            <Typography sx={{ fontSize: 13, color: 'text.secondary', lineHeight: 1.7 }}>
              Los gastos y las compras son dos caras del mismo concepto: salidas de dinero. Tenerlos en un solo módulo evita duplicar información y facilita la gestión de proveedores, cuentas por pagar y control de egresos desde un único lugar.
            </Typography>
          </Paper>
        </Box>
      </TabPanel>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* ── TAB 2: ANÁLISIS ─────────────────────────────────────────────────── */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <TabPanel value={tab} index={2} sx={{ pt: 0 }}>
        <Grid container spacing={3}>
          {/* Gastos por categoría */}
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 2.5, borderRadius: 3, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              <Typography sx={{ fontWeight: 700, fontSize: 14, mb: 2 }}>Gastos por Categoría</Typography>
              {gastosPorCategoria.length === 0 ? (
                <Typography sx={{ color: 'text.secondary', fontSize: 13, textAlign: 'center', py: 3 }}>Sin gastos registrados</Typography>
              ) : gastosPorCategoria.map(({ cat, total, count, pct }) => (
                <Box key={cat} sx={{ mb: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography sx={{ fontSize: 12, fontWeight: 600 }}>
                      {cat} <Typography component="span" sx={{ fontSize: 10, color: 'text.secondary' }}>({count})</Typography>
                    </Typography>
                    <Typography sx={{ fontSize: 12, fontWeight: 700, color: RED }}>
                      {formatCurrency(total)} <Typography component="span" sx={{ fontSize: 10, color: 'text.secondary' }}>{pct}%</Typography>
                    </Typography>
                  </Box>
                  <LinearProgress variant="determinate" value={pct}
                    sx={{ borderRadius: 2, height: 6, bgcolor: `${RED}15`, '& .MuiLinearProgress-bar': { bgcolor: RED, borderRadius: 2 } }} />
                </Box>
              ))}
            </Paper>
          </Grid>

          {/* Top beneficiarios */}
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 2.5, borderRadius: 3, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              <Typography sx={{ fontWeight: 700, fontSize: 14, mb: 2 }}>Top Beneficiarios por Monto</Typography>
              {topBeneficiarios.length === 0 ? (
                <Typography sx={{ color: 'text.secondary', fontSize: 13, textAlign: 'center', py: 3 }}>Sin datos</Typography>
              ) : topBeneficiarios.map(({ nombre, total, count }, idx) => (
                <Box key={nombre} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1.2, borderBottom: idx < topBeneficiarios.length - 1 ? '1px solid' : 'none', borderColor: 'divider' }}>
                  <Box sx={{ width: 28, height: 28, borderRadius: 1.5, bgcolor: `${ACCENT}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Typography sx={{ fontSize: 12, fontWeight: 800, color: ACCENT }}>{idx + 1}</Typography>
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nombre}</Typography>
                    <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>{count} egreso{count !== 1 ? 's' : ''}</Typography>
                  </Box>
                  <Typography sx={{ fontSize: 14, fontWeight: 700, color: RED, flexShrink: 0 }}>{formatCurrency(total)}</Typography>
                </Box>
              ))}
            </Paper>
          </Grid>

          {/* Distribución por método de pago */}
          <Grid item xs={12}>
            <Paper sx={{ p: 2.5, borderRadius: 3, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              <Typography sx={{ fontWeight: 700, fontSize: 14, mb: 2 }}>Gastos por Método de Pago</Typography>
              <Grid container spacing={2}>
                {['Efectivo', 'Transferencia', 'Tarjeta'].map(m => {
                  const mGastos = gastos.filter(g => g.metodo_pago === m);
                  const mTotal = mGastos.reduce((s, g) => s + g.monto, 0);
                  const mPct = gastos.length > 0 ? Math.round(mGastos.length / gastos.length * 100) : 0;
                  const colors = { Efectivo: GREEN, Transferencia: BLUE, Tarjeta: YELLOW };
                  const c = colors[m];
                  return (
                    <Grid item xs={12} sm={4} key={m}>
                      <Box sx={{ p: 2, borderRadius: 2, border: '1.5px solid', borderColor: `${c}30`, bgcolor: `${c}08`, textAlign: 'center' }}>
                        <Typography sx={{ fontSize: 11, color: 'text.secondary', mb: 0.5 }}>{m}</Typography>
                        <Typography sx={{ fontSize: 20, fontWeight: 800, color: c }}>{formatCurrency(mTotal)}</Typography>
                        <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{mGastos.length} transacciones · {mPct}%</Typography>
                      </Box>
                    </Grid>
                  );
                })}
              </Grid>
            </Paper>
          </Grid>

          {/* Resumen del mes en curso */}
          {cortesMes.length > 0 && (
            <Grid item xs={12}>
              <Paper sx={{ p: 2.5, borderRadius: 3, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                <Typography sx={{ fontWeight: 700, fontSize: 14, mb: 2 }}>Resumen del Mes en Curso</Typography>
                <Grid container spacing={2}>
                  {[
                    { label: 'Cortes realizados', val: cortesMes.length, color: ACCENT, isMoney: false },
                    { label: 'Total ingresos', val: cortesMes.reduce((s, c) => s + c.total_ventas_dia, 0), color: GREEN, isMoney: true },
                    { label: 'Total gastos', val: cortesMes.reduce((s, c) => s + (c.total_gastos || 0), 0), color: RED, isMoney: true },
                    { label: 'Diferencia acumulada', val: diferenciaAcumuladaMes, color: diferenciaAcumuladaMes >= 0 ? BLUE : RED, isMoney: true },
                  ].map(({ label, val, color, isMoney }) => (
                    <Grid item xs={6} sm={3} key={label}>
                      <Box sx={{ textAlign: 'center', p: 1.5, borderRadius: 2, bgcolor: `${color}08`, border: `1px solid ${color}20` }}>
                        <Typography sx={{ fontSize: 10, color: 'text.secondary', mb: 0.5 }}>{label}</Typography>
                        <Typography sx={{ fontSize: isMoney ? 15 : 22, fontWeight: 800, color }}>
                          {isMoney ? formatCurrency(val) : val}
                        </Typography>
                      </Box>
                    </Grid>
                  ))}
                </Grid>
              </Paper>
            </Grid>
          )}
        </Grid>
      </TabPanel>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* ── DIALOG: CERRAR CAJA ─────────────────────────────────────────────── */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <Dialog
        open={openDialog}
        onClose={() => { if (!submitting) { setOpenDialog(false); setUseDenoms(false); setDenoms({}); } }}
        maxWidth="sm" fullWidth fullScreen={isMobile}
        PaperProps={{ sx: { borderRadius: isMobile ? 0 : 3, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' } }}
      >
        <Box sx={{ height: 4, bgcolor: ACCENT }} />
        <DialogTitle sx={{ pb: 1, pt: 2.5, pr: 6 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{ width: 38, height: 38, borderRadius: 2, bgcolor: `${ACCENT}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: ACCENT }}>
              <PointOfSale />
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 700, fontSize: 15 }}>Cerrar Caja</Typography>
              <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{preview?.fecha}</Typography>
            </Box>
          </Box>
          <IconButton size="small" onClick={() => { setOpenDialog(false); setUseDenoms(false); setDenoms({}); }} disabled={submitting} sx={{ position: 'absolute', right: 12, top: 16, color: 'text.secondary' }}>
            <Close fontSize="small" />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ pt: 1 }}>
          {/* Composición del efectivo esperado */}
          <Paper sx={{ p: 2, mb: 2, borderRadius: 2, bgcolor: 'action.hover', border: '1px solid', borderColor: 'divider' }}>
            <Typography sx={{ fontSize: 11, fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.6, mb: 1.5 }}>
              Composición del Efectivo Esperado
            </Typography>
            {[
              { label: 'Ventas en efectivo', value: preview?.ventas_contado || 0, color: GREEN },
              { label: 'Abonos en efectivo', value: preview?.abonos_cartera || 0, color: BLUE },
              { label: 'Gastos en efectivo', value: -(preview?.total_gastos || 0), color: RED },
            ].map(({ label, value, color }) => (
              <Box key={label} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
                <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{label}</Typography>
                <Typography sx={{ fontSize: 12, fontWeight: 700, color }}>{value >= 0 ? '' : '-'}{formatCurrency(Math.abs(value))}</Typography>
              </Box>
            ))}
            <Divider sx={{ my: 1 }} />
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography sx={{ fontSize: 13, fontWeight: 700 }}>Efectivo Esperado en Caja</Typography>
              <Typography sx={{ fontSize: 15, fontWeight: 800, color: preview?.efectivo < 0 ? RED : GREEN }}>
                {formatCurrency(preview?.efectivo || 0)}
              </Typography>
            </Box>
            {preview?.efectivo < 0 && (
              <Typography sx={{ fontSize: 11, color: RED, mt: 1, lineHeight: 1.3 }}>
                *Negativo porque los gastos en efectivo superan las ventas en efectivo.
              </Typography>
            )}
          </Paper>

          {/* Toggle denominaciones */}
          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
            <Button
              variant="outlined"
              size="small"
              onClick={() => { setUseDenoms(p => !p); if (useDenoms) { setDenoms({}); setEfectivoFisico(''); } }}
              sx={{ borderRadius: 2, fontWeight: 600, fontSize: 12, borderColor: ACCENT, color: ACCENT, '&:hover': { borderColor: ACCENT, bgcolor: `${ACCENT}08` } }}
            >
              {useDenoms ? 'Ingresar total directo' : 'Contar por denominaciones'}
            </Button>
          </Box>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {useDenoms ? (
              <>
                <DenomGrid denoms={denoms} onChange={setDenoms} />
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 1.5, borderRadius: 2, bgcolor: `${GREEN}08`, border: `1px solid ${GREEN}20` }}>
                  <Typography sx={{ fontSize: 13, fontWeight: 700 }}>Total contado</Typography>
                  <Typography sx={{ fontSize: 17, fontWeight: 800, color: GREEN }}>{formatCurrency(denomTotal)}</Typography>
                </Box>
              </>
            ) : (
              <CurrencyField
                label="Dinero físico contado en la gaveta *"
                value={efectivoFisico}
                onChange={setEfectivoFisico}
                helperText="Digita el total de billetes y monedas"
              />
            )}
            {efectivoFisico !== '' && (
              <Alert
                severity={diferencia === 0 ? 'success' : diferencia > 0 ? 'info' : 'error'}
                sx={{ borderRadius: 2, fontSize: 13 }}
              >
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                  {diferencia === 0
                    ? '✓ Cuadre exacto (El dinero físico coincide con el sistema)'
                    : diferencia > 0
                      ? `Sobrante de Caja: ${formatCurrency(Math.abs(diferencia))}`
                      : `Faltante de Caja: ${formatCurrency(Math.abs(diferencia))}`
                  }
                </Typography>
                {preview?.efectivo < 0 && diferencia > 0 && (
                  <Typography variant="body2" sx={{ fontSize: 11, mt: 0.5, lineHeight: 1.2, opacity: 0.9 }}>
                    Al ingresar dinero físico cubriendo un saldo negativo, el sistema asume que usaste dinero externo para pagar gastos, reflejándolo como sobrante.
                  </Typography>
                )}
              </Alert>
            )}
            <TextField fullWidth size="small" multiline rows={2} label="Observaciones (opcional)" value={observaciones} onChange={e => setObservaciones(e.target.value)} placeholder="Ej: Faltante por vuelto en efectivo..." />
          </Box>
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2.5, pt: 1, gap: 1 }}>
          <Button onClick={() => { setOpenDialog(false); setUseDenoms(false); setDenoms({}); }} disabled={submitting} variant="outlined" size="small" fullWidth={isMobile} sx={{ borderRadius: 2, fontWeight: 600, borderColor: 'divider', color: 'text.secondary', flex: isMobile ? 1 : 'auto' }}>
            Cancelar
          </Button>
          <Button onClick={handleCerrarCaja} disabled={submitting} variant="contained" size="small" fullWidth={isMobile} startIcon={submitting ? <CircularProgress size={14} color="inherit" /> : <CheckCircle sx={{ fontSize: 16 }} />} sx={{ borderRadius: 2, fontWeight: 600, flex: isMobile ? 1 : 'auto', background: `linear-gradient(135deg, ${ACCENT}, #ff9a62)`, boxShadow: `0 4px 14px rgba(255,96,32,0.3)`, color: '#fff' }}>
            {submitting ? 'Cerrando…' : 'Confirmar cierre'}
          </Button>
        </DialogActions>
      </Dialog>

      <QuickCreateModal open={quickCreate.open} onClose={closeQuickCreate} type={quickCreate.type} initialName={quickCreate.initialName} onCreated={handleQuickCreated} />

      {/* ── DIALOG: ELIMINAR GASTO ── */}
      <Dialog open={openDeleteDialog} onClose={() => !submitting && setOpenDeleteDialog(false)} maxWidth="xs" fullWidth
        PaperProps={{ sx: { borderRadius: 3, overflow: 'hidden' } }}>
        <Box sx={{ height: 4, bgcolor: RED }} />
        <DialogTitle sx={{ pb: 1, pt: 2.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{ width: 38, height: 38, borderRadius: 2, bgcolor: `${RED}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: RED }}>
              <Delete />
            </Box>
            <Typography sx={{ fontWeight: 700, fontSize: 16 }}>¿Eliminar este gasto?</Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: 14, color: 'text.secondary', mt: 1 }}>
            Esta acción no se puede deshacer. El registro del gasto será eliminado permanentemente del sistema y se recalculará el balance de caja.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, pt: 1, gap: 1 }}>
          <Button onClick={() => setOpenDeleteDialog(false)} disabled={submitting} variant="outlined" size="small" fullWidth sx={{ borderRadius: 2, fontWeight: 600, borderColor: 'divider', color: 'text.secondary' }}>
            Cancelar
          </Button>
          <Button onClick={handleConfirmDeleteGasto} disabled={submitting} variant="contained" size="small" fullWidth sx={{ borderRadius: 2, fontWeight: 600, bgcolor: RED, '&:hover': { bgcolor: '#d32f2f' } }}>
            {submitting ? 'Eliminando...' : 'Confirmar Eliminación'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
