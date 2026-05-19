import React, { useState, useEffect, useMemo } from 'react';
import {
  Box, Typography, Paper, Grid, Button, Divider, Tabs, Tab,
  TextField, Chip, Table, TableBody, TableCell, Stack, Autocomplete, Tooltip,
  TableContainer, TableHead, TableRow, CircularProgress, TablePagination,
  Dialog, DialogTitle, DialogContent, DialogActions, MenuItem, Select,
  FormControl, InputLabel, InputAdornment,
  IconButton, Alert, useTheme, useMediaQuery
} from '@mui/material';
import {
  PointOfSale, CheckCircle, Close, Add,
  TrendingUp, AttachMoney, CreditCard, AccountBalance,
  Refresh, ReceiptLong, MoneyOff, Edit, Delete, Search, FileDownload,
  Category, CalendarToday, FilterList
} from '@mui/icons-material';
import { toast } from 'react-toastify';
import apiClient from '../../api';
import { formatCurrency } from '../../utils/formatters';
import CurrencyField from '../../components/common/CurrencyField';
import QuickCreateModal from '../../components/common/QuickCreateModal';

const ACCENT = '#FF6020';
const GREEN  = '#10B981';
const RED    = '#EF4444';
const BLUE   = '#3B82F6';
const YELLOW = '#F59E0B';

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
    boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
  }}>
    <Box sx={{
      width: 42, height: 42, borderRadius: 2, flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      bgcolor: `${color}18`, color
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
    py: 1.2, borderBottom: '1px solid', borderColor: 'divider'
  }}>
    <Box sx={{
      width: 30, height: 30, borderRadius: 1.5,
      bgcolor: `${color}15`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color, flexShrink: 0
    }}>
      {icon}
    </Box>
    <Typography sx={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{label}</Typography>
    <Typography sx={{ fontSize: 14, fontWeight: 700, color }}>{formatCurrency(value)}</Typography>
  </Box>
);

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
            fontWeight: 600, fontSize: 10, borderRadius: 1.5
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

  // Historial de cortes paginación
  const [cortesPage, setCortesPage] = useState(0);
  const [cortesRowsPerPage, setCortesRowsPerPage] = useState(10);

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
  const [gastosPage, setGastosPage] = useState(0);
  const [gastosRowsPerPage, setGastosRowsPerPage] = useState(10);

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

  useEffect(() => {
    fetchPreview();
    fetchHistorial();
    fetchGastos();
    fetchTerceros();
  }, []);

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
        observaciones
      });
      toast.success('¡Caja cerrada exitosamente!');
      setOpenDialog(false);
      setEfectivoFisico('');
      setObservaciones('');
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

  // ─── Gastos filtrados y paginados ───────────────────────────────────────────
  const filteredGastos = useMemo(() => {
    return gastos.filter(g => {
      if (filtroMetodo && g.metodo_pago !== filtroMetodo) return false;
      if (busquedaGasto) {
        const q = busquedaGasto.toLowerCase();
        const inTercero = g.tercero?.nombre?.toLowerCase().includes(q);
        const inConcepto = g.concepto?.toLowerCase().includes(q);
        const inCategoria = g.categoria?.toLowerCase().includes(q);
        if (!inTercero && !inConcepto && !inCategoria) return false;
      }
      if (filtroGastoDesde) {
        if (new Date(g.fecha) < new Date(filtroGastoDesde)) return false;
      }
      if (filtroGastoHasta) {
        const hasta = new Date(filtroGastoHasta); hasta.setHours(23, 59, 59);
        if (new Date(g.fecha) > hasta) return false;
      }
      return true;
    });
  }, [gastos, busquedaGasto, filtroMetodo, filtroGastoDesde, filtroGastoHasta]);

  const paginatedGastos = filteredGastos.slice(
    gastosPage * gastosRowsPerPage,
    gastosPage * gastosRowsPerPage + gastosRowsPerPage
  );

  const paginatedCortes = historial.slice(
    cortesPage * cortesRowsPerPage,
    cortesPage * cortesRowsPerPage + cortesRowsPerPage
  );

  // ─── KPIs de gastos ────────────────────────────────────────────────────────
  const hoy = todayISO();
  const mesActual = hoy.slice(0, 7);
  const gastosHoy = useMemo(() => gastos.filter(g => g.fecha?.startsWith(hoy)), [gastos, hoy]);
  const gastosMes  = useMemo(() => gastos.filter(g => g.fecha?.startsWith(mesActual)), [gastos, mesActual]);
  const totalHoy   = gastosHoy.reduce((s, g) => s + g.monto, 0);
  const totalMes   = gastosMes.reduce((s, g) => s + g.monto, 0);
  const topMetodo  = useMemo(() => {
    const tally = {};
    gastos.forEach(g => { tally[g.metodo_pago] = (tally[g.metodo_pago] || 0) + g.monto; });
    return Object.entries(tally).sort((a, b) => b[1] - a[1])[0]?.[0] || '—';
  }, [gastos]);

  // ─── CSV Export ────────────────────────────────────────────────────────────
  const handleExportCSV = () => {
    const rows = [
      ['Fecha', 'Beneficiario', 'Concepto', 'Categoría', 'Método', 'Monto'],
      ...filteredGastos.map(g => [
        g.fecha ? new Date(g.fecha).toLocaleDateString('es-CO') : '',
        g.tercero?.nombre || '',
        g.concepto || '',
        g.categoria || '',
        g.metodo_pago || '',
        g.monto,
      ]),
    ];
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'gastos.csv';
    a.click(); URL.revokeObjectURL(url);
  };

  const hasGastoFilters = busquedaGasto || filtroMetodo || filtroGastoDesde || filtroGastoHasta;

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
        </Box>
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
            '& .Mui-selected': { color: `${ACCENT} !important` }
          }}
        >
          <Tab label="Corte y Resumen" />
          <Tab label="Registrar Gasto (Egreso)" />
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
            {/* KPIs */}
            <Grid container spacing={1.5} sx={{ mb: 2 }}>
              <Grid item xs={6} sm={3}>
                <KpiCard label="Ingresos Totales" value={formatCurrency(preview.total_dia)} icon={<TrendingUp />} color={ACCENT} sub={preview.fecha} />
              </Grid>
              <Grid item xs={6} sm={3}>
                <KpiCard label="Caja (Efectivo)" value={formatCurrency(preview.efectivo)} icon={<AttachMoney />} color={preview.efectivo < 0 ? RED : GREEN} />
              </Grid>
              <Grid item xs={6} sm={3}>
                <KpiCard label="Bancos (Transf.)" value={formatCurrency(preview.transferencia)} icon={<AccountBalance />} color={BLUE} />
              </Grid>
              <Grid item xs={6} sm={3}>
                <KpiCard label="Total Gastos" value={formatCurrency(preview.total_gastos)} icon={<MoneyOff />} color={RED} />
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
          {loadingHistorial ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}><CircularProgress size={24} sx={{ color: ACCENT }} /></Box>
          ) : historial.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}><PointOfSale sx={{ fontSize: 40, opacity: 0.2, mb: 1 }} /><Typography fontSize={13}>No hay cortes registrados</Typography></Box>
          ) : isMobile ? (
            <Box>{historial.map(c => <CorteCard key={c.id} corte={c} />)}</Box>
          ) : (
            <>
              <TableContainer sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider', overflowX: 'auto' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      {['Fecha', 'Ingresos Día', 'Gastos', 'Efectivo Esperado', 'Efectivo Físico', 'Diferencia', 'Estado', 'Observaciones'].map(h => (
                        <TableCell key={h} sx={{ fontSize: 11, fontWeight: 600 }}>{h}</TableCell>
                      ))}
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
                count={historial.length}
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
        {/* KPIs de gastos */}
        <Grid container spacing={1.5} sx={{ mb: 3 }}>
          <Grid item xs={6} sm={3}>
            <KpiCard label="Gastos Hoy" value={formatCurrency(totalHoy)} icon={<MoneyOff />} color={RED} sub={`${gastosHoy.length} egreso${gastosHoy.length !== 1 ? 's' : ''}`} />
          </Grid>
          <Grid item xs={6} sm={3}>
            <KpiCard label="Gastos Este Mes" value={formatCurrency(totalMes)} icon={<ReceiptLong />} color={YELLOW} sub={`${gastosMes.length} registro${gastosMes.length !== 1 ? 's' : ''}`} />
          </Grid>
          <Grid item xs={6} sm={3}>
            <KpiCard label="Total Registros" value={gastos.length} icon={<TrendingUp />} color={BLUE} sub="histórico" />
          </Grid>
          <Grid item xs={6} sm={3}>
            <KpiCard label="Método Frecuente" value={topMetodo} icon={<CreditCard />} color={GREEN} sub="por monto total" />
          </Grid>
        </Grid>

        <Grid container spacing={3}>
          <Grid item xs={12} md={5}>
            <Paper sx={{ p: 3, borderRadius: 3, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              <Typography sx={{ fontWeight: 700, fontSize: 15, mb: 2 }}>
                {editingGastoId ? 'Modificar gasto' : 'Registrar nuevo gasto'}
              </Typography>
              <Box component="form" onSubmit={handleRegistrarGasto}>
                <Stack spacing={2}>
                  <Autocomplete
                    options={terceros} getOptionLabel={(o) => o?.nombre || ''}
                    value={gastoTercero} onChange={(_, v) => setGastoTercero(v)}
                    inputValue={terceroInput} onInputChange={(_, v) => setTerceroInput(v)}
                    filterOptions={(opts, state) => {
                      const q = (state.inputValue || '').toLowerCase().trim();
                      if (!q) return opts;
                      return opts.filter(o => o.nombre.toLowerCase().includes(q) || (o.cedula || '').toLowerCase().includes(q));
                    }}
                    noOptionsText={
                      <Box sx={{ py: 0.5 }}>
                        <Typography sx={{ fontSize: 13, color: 'text.secondary', mb: 1 }}>No se encontró ningún beneficiario</Typography>
                        <Button size="small" variant="contained" fullWidth startIcon={<Add />} onClick={() => openQuickCreate(terceroInput)} sx={{ borderRadius: 2, fontWeight: 600, fontSize: 12, bgcolor: '#3B82F6', '&:hover': { bgcolor: '#2563EB' } }}>
                          Crear "{terceroInput || 'nuevo beneficiario'}"
                        </Button>
                      </Box>
                    }
                    renderInput={(params) => (
                      <TextField {...params} label="Beneficiario (A quién se le paga) *" required fullWidth size="small"
                        InputProps={{
                          ...params.InputProps,
                          endAdornment: (
                            <>
                              {params.InputProps.endAdornment}
                              <Tooltip title="Crear nuevo proveedor/beneficiario">
                                <IconButton size="small" onClick={() => openQuickCreate(terceroInput)} sx={{ color: '#3B82F6', p: 0.5 }}><Add fontSize="small" /></IconButton>
                              </Tooltip>
                            </>
                          ),
                        }}
                      />
                    )}
                  />
                  <TextField label="Concepto / Razón del gasto *" required fullWidth size="small" value={gastoConcepto} onChange={e => setGastoConcepto(e.target.value)} placeholder="Ej: Compra de insumos de aseo" />
                  <CurrencyField label="Monto del gasto *" value={gastoMonto} onChange={setGastoMonto} required />

                  <Grid container spacing={1.5}>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        label="Fecha del gasto"
                        type="date"
                        size="small"
                        fullWidth
                        value={gastoFecha}
                        onChange={e => setGastoFecha(e.target.value)}
                        InputLabelProps={{ shrink: true }}
                        InputProps={{ startAdornment: <InputAdornment position="start"><CalendarToday sx={{ fontSize: 14, color: 'text.secondary' }} /></InputAdornment> }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <FormControl size="small" fullWidth>
                        <InputLabel>Categoría</InputLabel>
                        <Select
                          value={gastoCategoria}
                          onChange={e => setGastoCategoria(e.target.value)}
                          label="Categoría"
                          startAdornment={<InputAdornment position="start"><Category sx={{ fontSize: 14, color: 'text.secondary' }} /></InputAdornment>}
                        >
                          <MenuItem value=""><em>Sin categoría</em></MenuItem>
                          {CATEGORIAS_GASTO.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                        </Select>
                      </FormControl>
                    </Grid>
                  </Grid>

                  <Box>
                    <Typography sx={{ fontSize: 11, fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.6, mb: 1 }}>Método de Pago (Salida)</Typography>
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      {['Efectivo', 'Transferencia', 'Tarjeta'].map(opt => (
                        <Chip key={opt} label={opt} onClick={() => setGastoMetodo(opt)}
                          sx={{ fontWeight: 600, fontSize: 12, borderRadius: 1.5, bgcolor: gastoMetodo === opt ? `${ACCENT}20` : 'background.paper', color: gastoMetodo === opt ? ACCENT : 'text.secondary', border: '1.5px solid', borderColor: gastoMetodo === opt ? ACCENT : 'divider', '&:hover': { borderColor: ACCENT }, cursor: 'pointer' }}
                        />
                      ))}
                    </Box>
                  </Box>
                  <Stack direction="row" spacing={1}>
                    <Button type="submit" variant="contained" fullWidth disabled={submitting} sx={{ mt: 1, background: editingGastoId ? `linear-gradient(135deg, ${BLUE}, #60a5fa)` : `linear-gradient(135deg, ${RED}, #f87171)`, boxShadow: `0 4px 14px rgba(239,68,68,0.3)`, borderRadius: 2, fontWeight: 600 }}>
                      {submitting ? 'Guardando...' : editingGastoId ? 'Actualizar Salida' : 'Registrar Salida'}
                    </Button>
                    {editingGastoId && (
                      <Button variant="outlined" fullWidth onClick={resetGastoForm} sx={{ mt: 1, borderRadius: 2, fontWeight: 600 }}>
                        Cancelar
                      </Button>
                    )}
                  </Stack>
                </Stack>
              </Box>
            </Paper>
          </Grid>
          <Grid item xs={12} md={7}>
            <Paper sx={{ p: 3, borderRadius: 3, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              {/* Header historial */}
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
                <Typography sx={{ fontWeight: 700, fontSize: 15 }}>Historial de Gastos</Typography>
                <Button size="small" startIcon={<FileDownload />} onClick={handleExportCSV} variant="outlined" sx={{ borderRadius: 2, fontWeight: 600, fontSize: 12 }}>
                  CSV
                </Button>
              </Box>

              {/* Filtros */}
              <Stack spacing={1} sx={{ mb: 2 }}>
                <TextField
                  size="small" fullWidth
                  placeholder="Buscar por beneficiario, concepto o categoría..."
                  value={busquedaGasto}
                  onChange={e => { setBusquedaGasto(e.target.value); setGastosPage(0); }}
                  InputProps={{ startAdornment: <InputAdornment position="start"><Search sx={{ fontSize: 16, color: 'text.secondary' }} /></InputAdornment> }}
                />
                <Stack direction="row" spacing={1} flexWrap="wrap">
                  <TextField
                    size="small" label="Desde" type="date"
                    value={filtroGastoDesde}
                    onChange={e => { setFiltroGastoDesde(e.target.value); setGastosPage(0); }}
                    InputLabelProps={{ shrink: true }}
                    sx={{ flex: 1, minWidth: 130 }}
                  />
                  <TextField
                    size="small" label="Hasta" type="date"
                    value={filtroGastoHasta}
                    onChange={e => { setFiltroGastoHasta(e.target.value); setGastosPage(0); }}
                    InputLabelProps={{ shrink: true }}
                    sx={{ flex: 1, minWidth: 130 }}
                  />
                  <FormControl size="small" sx={{ flex: 1, minWidth: 130 }}>
                    <InputLabel>Método</InputLabel>
                    <Select value={filtroMetodo} onChange={e => { setFiltroMetodo(e.target.value); setGastosPage(0); }} label="Método">
                      <MenuItem value="">Todos</MenuItem>
                      {['Efectivo', 'Transferencia', 'Tarjeta'].map(m => <MenuItem key={m} value={m}>{m}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Stack>
                {hasGastoFilters && (
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700 }}>
                      <FilterList sx={{ fontSize: 13, verticalAlign: 'middle', mr: 0.5 }} />
                      {filteredGastos.length} de {gastos.length} registros
                    </Typography>
                    <Chip label="Limpiar filtros" size="small" onDelete={() => { setBusquedaGasto(''); setFiltroMetodo(''); setFiltroGastoDesde(''); setFiltroGastoHasta(''); setGastosPage(0); }} sx={{ fontSize: 10 }} />
                  </Box>
                )}
              </Stack>

              {loadingGastos ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}><CircularProgress size={24} sx={{ color: RED }} /></Box>
              ) : filteredGastos.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
                  <ReceiptLong sx={{ fontSize: 40, opacity: 0.2, mb: 1 }} />
                  <Typography fontSize={13}>{gastos.length === 0 ? 'No hay gastos registrados' : 'No hay resultados con estos filtros'}</Typography>
                </Box>
              ) : isMobile ? (
                <Box>{paginatedGastos.map(g => <GastoCard key={g.id} gasto={g} onEdit={handleEditGasto} onDelete={handleDeleteGasto} />)}</Box>
              ) : (
                <TableContainer sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontSize: 11, fontWeight: 600 }}>Fecha</TableCell>
                        <TableCell sx={{ fontSize: 11, fontWeight: 600 }}>Beneficiario</TableCell>
                        <TableCell sx={{ fontSize: 11, fontWeight: 600 }}>Concepto</TableCell>
                        <TableCell sx={{ fontSize: 11, fontWeight: 600 }}>Categoría</TableCell>
                        <TableCell sx={{ fontSize: 11, fontWeight: 600 }}>Método</TableCell>
                        <TableCell sx={{ fontSize: 11, fontWeight: 600 }}>Monto</TableCell>
                        <TableCell sx={{ fontSize: 11, fontWeight: 600 }} align="center">Acc.</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {paginatedGastos.map(g => (
                        <TableRow key={g.id} hover>
                          <TableCell sx={{ fontSize: 11, whiteSpace: 'nowrap' }}>{new Date(g.fecha).toLocaleDateString()}</TableCell>
                          <TableCell sx={{ fontWeight: 600, fontSize: 12 }}>{g.tercero?.nombre}</TableCell>
                          <TableCell sx={{ fontSize: 12, color: 'text.secondary' }}>{g.concepto}</TableCell>
                          <TableCell>
                            {g.categoria ? (
                              <Chip label={g.categoria} size="small" sx={{ fontSize: 9, height: 18, bgcolor: `${BLUE}12`, color: BLUE, fontWeight: 600 }} />
                            ) : <Typography sx={{ fontSize: 11, color: 'text.disabled' }}>—</Typography>}
                          </TableCell>
                          <TableCell sx={{ fontSize: 11 }}>{g.metodo_pago}</TableCell>
                          <TableCell sx={{ color: RED, fontWeight: 700 }}>{formatCurrency(g.monto)}</TableCell>
                          <TableCell align="center">
                            <Stack direction="row" spacing={0.5} justifyContent="center">
                              <Tooltip title="Editar">
                                <IconButton size="small" onClick={() => handleEditGasto(g)} color="primary">
                                  <Edit fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Eliminar">
                                <IconButton size="small" onClick={() => handleDeleteGasto(g.id)} color="error">
                                  <Delete fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </Stack>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
              {filteredGastos.length > gastosRowsPerPage && (
                <TablePagination
                  component="div"
                  count={filteredGastos.length}
                  page={gastosPage}
                  onPageChange={(_, p) => setGastosPage(p)}
                  rowsPerPage={gastosRowsPerPage}
                  onRowsPerPageChange={e => { setGastosRowsPerPage(parseInt(e.target.value, 10)); setGastosPage(0); }}
                  rowsPerPageOptions={[10, 25, 50]}
                  labelRowsPerPage="Por página:"
                  labelDisplayedRows={({ from, to, count }) => `${from}–${to} de ${count}`}
                />
              )}
            </Paper>
          </Grid>
        </Grid>
      </TabPanel>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* ── DIALOG: CERRAR CAJA ─────────────────────────────────────────────── */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <Dialog open={openDialog} onClose={() => !submitting && setOpenDialog(false)} maxWidth="xs" fullWidth fullScreen={isMobile}
        PaperProps={{ sx: { borderRadius: isMobile ? 0 : 3, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' } }}>
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
          <IconButton size="small" onClick={() => setOpenDialog(false)} disabled={submitting} sx={{ position: 'absolute', right: 12, top: 16, color: 'text.secondary' }}>
            <Close fontSize="small" />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ pt: 1 }}>
          <Paper sx={{ p: 2, mb: 2, borderRadius: 2, bgcolor: 'action.hover', border: '1px solid', borderColor: 'divider' }}>
            <Typography sx={{ fontSize: 11, fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.6, mb: 1 }}>
              Arqueo de Caja (Efectivo)
            </Typography>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
              <Typography sx={{ fontSize: 13, fontWeight: 700 }}>Efectivo Esperado en Caja</Typography>
              <Typography sx={{ fontSize: 15, fontWeight: 800, color: preview?.efectivo < 0 ? RED : GREEN }}>
                {formatCurrency(preview?.efectivo || 0)}
              </Typography>
            </Box>
            {preview?.efectivo < 0 && (
                <Typography sx={{ fontSize: 11, color: RED, mt: 1, lineHeight: 1.3 }}>
                  *El valor esperado es negativo porque has registrado más gastos en efectivo que ventas en efectivo.
                </Typography>
            )}
          </Paper>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <CurrencyField
              label="Dinero físico contado en la gaveta *"
              value={efectivoFisico}
              onChange={setEfectivoFisico}
              helperText="Digita el total de billetes y monedas"
            />
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
          <Button onClick={() => setOpenDialog(false)} disabled={submitting} variant="outlined" size="small" fullWidth={isMobile} sx={{ borderRadius: 2, fontWeight: 600, borderColor: 'divider', color: 'text.secondary', flex: isMobile ? 1 : 'auto' }}>
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
