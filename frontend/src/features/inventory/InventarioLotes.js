import React, { useState, useEffect, useMemo } from 'react';
import {
  Box, Typography, Paper, Grid, TextField, Button,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TableSortLabel, TablePagination,
  Chip, IconButton, Stack, CircularProgress, Avatar, Tooltip,
  Dialog, DialogTitle, DialogContent, DialogActions, InputAdornment,
  Tabs, Tab, Autocomplete, LinearProgress, Alert, useTheme, useMediaQuery, Divider,
} from '@mui/material';
import {
  Warning, Error as ErrorIcon, CheckCircle, Info,
  Add, Layers, Science, TrendingDown,
  CalendarMonth, Edit, Close, Search,
  Refresh, FileDownload, AttachMoney
} from '@mui/icons-material';
import apiClient from '../../api';
import { formatCurrency } from '../../utils/formatters';
import { toast } from 'react-toastify';
import CurrencyField from '../../components/common/CurrencyField';

const PURPLE = '#8B5CF6';
const ACCENT  = '#FF6020';
const GREEN   = '#10B981';
const YELLOW  = '#F59E0B';
const RED     = '#EF4444';
const BLUE    = '#3B82F6';

const URGENCIA_CONFIG = {
  vencido: { color: RED,    bg: '#FEF2F2', label: 'VENCIDO',   icon: <ErrorIcon />,   chipColor: 'error'   },
  critico: { color: RED,    bg: '#FEF2F2', label: '≤ 5 días',  icon: <Warning />,     chipColor: 'error'   },
  alerta:  { color: YELLOW, bg: '#FFFBEB', label: '≤ 15 días', icon: <Warning />,     chipColor: 'warning' },
  aviso:   { color: BLUE,   bg: '#EFF6FF', label: '≤ 30 días', icon: <Info />,        chipColor: 'info'    },
  ok:      { color: GREEN,  bg: '#ECFDF5', label: 'Vigente',   icon: <CheckCircle />, chipColor: 'success' },
};

const fmtFecha = (val) => {
  if (!val) return '—';
  try {
    const [y, m, d] = String(val).split('T')[0].split('-');
    return `${d}/${m}/${y}`;
  } catch { return '—'; }
};

const UrgenciaChip = ({ urgencia, dias }) => {
  const cfg = URGENCIA_CONFIG[urgencia] || URGENCIA_CONFIG.ok;
  return (
    <Chip
      label={urgencia === 'vencido' ? `Vencido hace ${Math.abs(dias)}d` : `${dias}d restantes`}
      size="small"
      sx={(theme) => ({
        fontWeight: 700, fontSize: 10,
        bgcolor: theme.palette.mode === 'dark' ? `${cfg.color}15` : cfg.bg,
        color: cfg.color, border: `1px solid ${cfg.color}30`
      })}
    />
  );
};

const BarraConsumo = ({ inicial, actual }) => {
  const pct = inicial > 0 ? Math.round(((inicial - actual) / inicial) * 100) : 0;
  return (
    <Box>
      <LinearProgress variant="determinate" value={pct}
        sx={{ height: 6, borderRadius: 3, bgcolor: '#e2e8f0',
          '& .MuiLinearProgress-bar': { bgcolor: pct > 80 ? RED : pct > 50 ? YELLOW : GREEN }
        }}
      />
      <Typography sx={{ fontSize: 10, color: 'text.secondary', mt: 0.5, fontWeight: 600 }}>
        {actual} / {inicial} ({100 - pct}% disp.)
      </Typography>
    </Box>
  );
};

// ─── Tarjeta mobile de un lote ────────────────────────────────────────────────
const LoteCard = ({ lote, onAjustar }) => {
  const cfg       = URGENCIA_CONFIG[lote.urgencia] || URGENCIA_CONFIG.ok;
  const isVencido = lote.urgencia === 'vencido';
  const isCritico = lote.urgencia === 'critico';

  return (
    <Paper sx={(theme) => ({
      p: 2, mb: 1.5, borderRadius: 3,
      border: '1px solid',
      borderColor: (isVencido || isCritico)
        ? `${RED}40`
        : theme.palette.mode === 'dark' ? 'divider' : `${cfg.color}30`,
      bgcolor: theme.palette.mode === 'dark'
        ? (isVencido ? 'rgba(239,68,68,0.12)' : isCritico ? 'rgba(239,68,68,0.06)' : 'background.paper')
        : (isVencido ? '#FEF2F2' : isCritico ? '#FFF5F5' : 'background.paper'),
    })}>
      {/* Fila 1: nombre + estado */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
        <Box sx={{ flex: 1, mr: 1 }}>
          <Typography sx={{ fontWeight: 700, fontSize: 14, lineHeight: 1.3 }}>
            {lote.producto_nombre}
          </Typography>
          <Typography sx={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 12, color: 'text.secondary' }}>
            {lote.numero_lote}
            {lote.referencia_compra && (
              <span style={{ fontFamily: 'inherit', fontWeight: 400, fontSize: 10 }}> · {lote.referencia_compra}</span>
            )}
          </Typography>
        </Box>
        <UrgenciaChip urgencia={lote.urgencia} dias={lote.dias_restantes} />
      </Box>

      <Divider sx={{ my: 1 }} />

      {/* Fila 2: datos en grid 2x2 */}
      <Grid container spacing={1} sx={{ mb: 1.5 }}>
        <Grid size={{ xs: 6 }}>
          <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>Vencimiento</Typography>
          <Typography sx={{ fontSize: 12, fontWeight: 700, color: cfg.color }}>
            {fmtFecha(lote.fecha_vencimiento)}
          </Typography>
          {lote.fecha_fabricacion && (
            <Typography sx={{ fontSize: 9, color: 'text.secondary' }}>Fab: {fmtFecha(lote.fecha_fabricacion)}</Typography>
          )}
        </Grid>
        <Grid size={{ xs: 6 }}>
          <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>Valor total</Typography>
          <Typography sx={{ fontSize: 12, fontWeight: 700 }}>
            {formatCurrency(lote.cantidad_actual * lote.costo_unitario)}
          </Typography>
          <Typography sx={{ fontSize: 9, color: 'text.secondary' }}>
            {formatCurrency(lote.costo_unitario)} / ud.
          </Typography>
        </Grid>
      </Grid>

      {/* Barra de consumo o chip Agotado */}
      <Box sx={{ mb: 1.5 }}>
        {lote.cantidad_actual <= 0
          ? <Chip label="Agotado" size="small" sx={{ bgcolor: '#F1F5F9', color: '#64748b', fontWeight: 700, fontSize: 10 }} />
          : <BarraConsumo inicial={lote.cantidad_inicial} actual={lote.cantidad_actual} />
        }
      </Box>

      {/* Botón ajustar */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          size="small" startIcon={<Edit fontSize="small" />}
          onClick={() => onAjustar(lote)}
          sx={{ color: BLUE, bgcolor: `${BLUE}10`, borderRadius: 1.5, fontWeight: 600, fontSize: 12 }}
        >
          Ajustar
        </Button>
      </Box>
    </Paper>
  );
};

// ─── Componente principal ──────────────────────────────────────────────────────
const InventarioLotes = () => {
  const theme    = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [tab, setTab]         = useState(0);
  const [loading, setLoading] = useState(true);
  const [lotes, setLotes]     = useState([]);
  const [alertas, setAlertas] = useState([]);
  const [resumen, setResumen] = useState(null);
  const [productos, setProductos] = useState([]);
  const [clientes, setClientes]   = useState([]);
  const [filtroUrgencia, setFiltroUrgencia] = useState('todos');
  const [busqueda, setBusqueda]   = useState('');

  // Sorting
  const [sortCol, setSortCol] = useState('vencimiento');
  const [sortDir, setSortDir] = useState('asc');

  // Pagination
  const [lotesPage, setLotesPage] = useState(0);
  const [lotesPP, setLotesPP]     = useState(15);

  // Dias alerta
  const [diasAlerta, setDiasAlerta] = useState(30);

  const [modalLote,   setModalLote]   = useState({ open: false });
  const [modalAjuste, setModalAjuste] = useState({ open: false, lote: null });
  const [modalFefo,   setModalFefo]   = useState({ open: false, producto: null, cantidad: '', resultado: null });

  const [form, setForm] = useState({
    producto_id: null, numero_lote: '', fecha_vencimiento: '',
    fecha_fabricacion: '', cantidad_inicial: '', costo_unitario: '',
    proveedor_id: null, referencia_compra: '', observaciones: '',
  });

  const [ajusteForm, setAjusteForm] = useState({ cantidad: '', motivo: '', referencia: '' });

  useEffect(() => { fetchData(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-fetch alertas when diasAlerta changes (after initial load)
  useEffect(() => {
    if (!loading) recargarAlertas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diasAlerta]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [resLotes, resAlertas, resResumen, resProd, resClie] = await Promise.allSettled([
        apiClient.get('/inventario/lotes?solo_activos=true'),
        apiClient.get(`/reportes/proximos-a-vencer?dias=${diasAlerta}`),
        apiClient.get('/reportes/resumen-alertas-vencimiento'),
        apiClient.get('/productos/'),
        apiClient.get('/clientes/'),
      ]);
      if (resLotes.status === 'fulfilled')   setLotes(resLotes.value.data);
      else toast.error('Error al cargar lotes');
      if (resAlertas.status === 'fulfilled') setAlertas(resAlertas.value.data);
      if (resResumen.status === 'fulfilled') setResumen(resResumen.value.data);
      if (resProd.status === 'fulfilled')    setProductos(resProd.value.data.filter(p => p.maneja_lotes));
      if (resClie.status === 'fulfilled')    setClientes(resClie.value.data.filter(c => c.es_proveedor));
    } finally {
      setLoading(false);
    }
  };

  const recargarAlertas = async () => {
    try {
      const res = await apiClient.get(`/reportes/proximos-a-vencer?dias=${diasAlerta}`);
      setAlertas(res.data);
    } catch {
      toast.error('Error al recargar alertas');
    }
  };

  const handleCrearLote = async () => {
    if (!form.producto_id || !form.numero_lote || !form.fecha_vencimiento || !form.cantidad_inicial || !form.costo_unitario) {
      return toast.warning('Completa los campos obligatorios (*)');
    }
    try {
      await apiClient.post('/inventario/lotes', {
        producto_id:       form.producto_id.id,
        numero_lote:       form.numero_lote.trim().toUpperCase(),
        fecha_vencimiento: form.fecha_vencimiento,
        fecha_fabricacion: form.fecha_fabricacion || undefined,
        cantidad_inicial:  parseFloat(form.cantidad_inicial),
        costo_unitario:    parseFloat(form.costo_unitario),
        proveedor_id:      form.proveedor_id?.id || undefined,
        referencia_compra: form.referencia_compra || undefined,
        observaciones:     form.observaciones || undefined,
      });
      toast.success('Lote registrado correctamente');
      setModalLote({ open: false });
      setForm({ producto_id: null, numero_lote: '', fecha_vencimiento: '', fecha_fabricacion: '', cantidad_inicial: '', costo_unitario: '', proveedor_id: null, referencia_compra: '', observaciones: '' });
      fetchData();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Error al crear el lote');
    }
  };

  const handleAjustar = async () => {
    if (!ajusteForm.cantidad || !ajusteForm.motivo) return toast.warning('Ingresa cantidad y motivo.');
    const cant = parseFloat(ajusteForm.cantidad);
    if (cant < 0 && modalAjuste.lote) {
      const nuevaCant = modalAjuste.lote.cantidad_actual + cant;
      if (!window.confirm(`¿Confirmas restar ${Math.abs(cant)} unidades del lote "${modalAjuste.lote.numero_lote}"? Stock resultante: ${nuevaCant.toFixed(2)}`)) return;
    }
    try {
      await apiClient.patch(`/inventario/lotes/${modalAjuste.lote.id}/ajuste`, {
        cantidad:   parseFloat(ajusteForm.cantidad),
        motivo:     ajusteForm.motivo,
        referencia: ajusteForm.referencia || undefined,
      });
      toast.success('Lote ajustado correctamente');
      setModalAjuste({ open: false, lote: null });
      setAjusteForm({ cantidad: '', motivo: '', referencia: '' });
      fetchData();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Error al ajustar');
    }
  };

  const abrirAjuste = (lote) => {
    setModalAjuste({ open: true, lote });
    setAjusteForm({ cantidad: '', motivo: '', referencia: '' });
  };

  const consultarFefo = async () => {
    if (!modalFefo.producto || !modalFefo.cantidad) return;
    try {
      const res = await apiClient.get(
        `/inventario/lotes/${modalFefo.producto.id}/sugerencia-fefo?cantidad_requerida=${modalFefo.cantidad}`
      );
      setModalFefo(prev => ({ ...prev, resultado: res.data }));
    } catch {
      toast.error('Error al consultar FEFO');
    }
  };

  // ── Sort handler ──
  const handleSort = (col) => {
    setSortDir(d => sortCol === col ? (d === 'asc' ? 'desc' : 'asc') : 'asc');
    setSortCol(col);
    setLotesPage(0);
  };

  const SortHeader = ({ col, label }) => (
    <TableCell sx={{ fontWeight: 800 }}>
      <TableSortLabel
        active={sortCol === col}
        direction={sortCol === col ? sortDir : 'asc'}
        onClick={() => handleSort(col)}
      >
        {label}
      </TableSortLabel>
    </TableCell>
  );

  // ── Filtered ──
  const lotesFiltrados = useMemo(() => lotes.filter(l => {
    const q = busqueda.toLowerCase();
    const matchBusqueda = !busqueda || (
      l.producto_nombre?.toLowerCase().includes(q) ||
      l.numero_lote?.toLowerCase().includes(q) ||
      (l.producto_barcode && l.producto_barcode.toLowerCase().includes(q))
    );
    const matchUrgencia = filtroUrgencia === 'todos' || l.urgencia === filtroUrgencia;
    return matchBusqueda && matchUrgencia;
  }), [lotes, busqueda, filtroUrgencia]);

  // ── Sorted ──
  const lotesSorted = useMemo(() => {
    return [...lotesFiltrados].sort((a, b) => {
      if (sortCol === 'producto') {
        return sortDir === 'asc'
          ? a.producto_nombre.localeCompare(b.producto_nombre)
          : b.producto_nombre.localeCompare(a.producto_nombre);
      }
      if (sortCol === 'vencimiento') {
        const da = new Date(a.fecha_vencimiento || 0), db = new Date(b.fecha_vencimiento || 0);
        return sortDir === 'asc' ? da - db : db - da;
      }
      if (sortCol === 'stock') {
        return sortDir === 'asc'
          ? (a.cantidad_actual - b.cantidad_actual)
          : (b.cantidad_actual - a.cantidad_actual);
      }
      if (sortCol === 'valor') {
        const va = a.cantidad_actual * a.costo_unitario;
        const vb = b.cantidad_actual * b.costo_unitario;
        return sortDir === 'asc' ? va - vb : vb - va;
      }
      return 0;
    });
  }, [lotesFiltrados, sortCol, sortDir]);

  // ── Paginated ──
  const lotesPaginated = useMemo(
    () => lotesSorted.slice(lotesPage * lotesPP, lotesPage * lotesPP + lotesPP),
    [lotesSorted, lotesPage, lotesPP]
  );

  const alertasFiltradas = useMemo(() => alertas.filter(a => {
    const q = busqueda.toLowerCase();
    return !busqueda ||
      a.producto_nombre?.toLowerCase().includes(q) ||
      a.numero_lote?.toLowerCase().includes(q) ||
      (a.producto_barcode && a.producto_barcode.toLowerCase().includes(q));
  }), [alertas, busqueda]);

  // ── KPI derived values ──
  const valorizacionTotal = lotes.reduce((s, l) => s + (l.cantidad_actual * l.costo_unitario), 0);
  const totalLotesActivos = lotes.length;

  // ── CSV export ──
  const exportCSV = () => {
    const headers = ['Producto', 'N° Lote', 'Vencimiento', 'Estado', 'Stock actual', 'Stock inicial', 'Costo unit.', 'Valor total', 'Ref. compra'];
    const rows = lotesSorted.map(l => [
      l.producto_nombre,
      l.numero_lote,
      l.fecha_vencimiento,
      l.urgencia,
      l.cantidad_actual,
      l.cantidad_inicial,
      l.costo_unitario,
      l.cantidad_actual * l.costo_unitario,
      l.referencia_compra || ''
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const now = new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' }).replace(/[/:, ]/g, '-');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lotes_perecederos_${now}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  if (loading) return <Box sx={{ p: 5, textAlign: 'center' }}><CircularProgress sx={{ color: PURPLE }} /></Box>;

  return (
    <Box sx={{ width: '100%' }}>

      {/* ── Header ── */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ width: 40, height: 40, borderRadius: 2, bgcolor: `${PURPLE}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: PURPLE }}>
            <Layers />
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 700, fontSize: 20, lineHeight: 1.2 }}>Lotes y Perecederos</Typography>
            <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>Control de vencimientos y trazabilidad FEFO</Typography>
          </Box>
        </Box>

        {/* Botones: en móvil se apilan verticalmente */}
        <Stack direction={isMobile ? 'column' : 'row'} spacing={1.5} sx={{ width: isMobile ? '100%' : 'auto' }} alignItems="center">
          <IconButton
            onClick={fetchData} size="small"
            sx={{ color: 'text.secondary', border: '1px solid', borderColor: 'divider', borderRadius: 1.5 }}
          >
            <Refresh fontSize="small" />
          </IconButton>
          <Button
            fullWidth={isMobile}
            variant="outlined" startIcon={<Science />}
            onClick={() => setModalFefo({ open: true, producto: null, cantidad: '', resultado: null })}
            sx={{ borderRadius: 2, fontWeight: 600, color: PURPLE, borderColor: `${PURPLE}50`, '&:hover': { borderColor: PURPLE, bgcolor: `${PURPLE}10` } }}
          >
            Simular FEFO
          </Button>
          <Button
            fullWidth={isMobile}
            variant="contained" startIcon={<Add />}
            onClick={() => setModalLote({ open: true })}
            sx={{ bgcolor: PURPLE, borderRadius: 2, fontWeight: 600, boxShadow: `0 4px 14px ${PURPLE}40`, '&:hover': { bgcolor: '#7C3AED' } }}
          >
            Registrar Lote
          </Button>
        </Stack>
      </Box>

      {/* ── KPI Cards ── */}
      {resumen && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          {[
            { label: 'Total lotes',   val: totalLotesActivos,              color: PURPLE, bg: '#F5F3FF', icon: <Layers /> },
            { label: 'Valorización',  val: formatCurrency(valorizacionTotal), color: GREEN,  bg: '#ECFDF5', icon: <AttachMoney /> },
            { label: 'Vencidos',      val: resumen.vencidos,               color: RED,    bg: '#FEF2F2', icon: <ErrorIcon /> },
            { label: 'Críticos ≤5d',  val: resumen.criticos,               color: RED,    bg: '#FEF2F2', icon: <Warning /> },
            { label: 'Alertas ≤15d',  val: resumen.alertas,                color: YELLOW, bg: '#FFFBEB', icon: <Warning /> },
            { label: 'Avisos ≤30d',   val: resumen.avisos,                 color: BLUE,   bg: '#EFF6FF', icon: <CalendarMonth /> },
          ].map(({ label, val, color, bg, icon }) => (
            <Grid size={{ xs: 6, sm: 4, md: 2 }} key={label}>
              <Paper sx={(theme) => ({
                p: 2, borderRadius: 3, border: '1px solid', borderColor: 'divider',
                bgcolor: (typeof val === 'number' && val > 0) || typeof val === 'string'
                  ? (theme.palette.mode === 'dark' ? `${color}15` : bg)
                  : 'background.paper'
              })}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Avatar sx={{ width: 36, height: 36, bgcolor: `${color}20`, color }}>
                    {icon}
                  </Avatar>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontSize: typeof val === 'string' ? 13 : 22, fontWeight: 900, color: (typeof val === 'number' && val > 0) ? color : (typeof val === 'string' ? color : 'text.primary'), lineHeight: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {val}
                    </Typography>
                    <Typography sx={{ fontSize: 11, color: 'text.secondary', fontWeight: 600 }}>
                      {label}
                    </Typography>
                  </Box>
                </Box>
              </Paper>
            </Grid>
          ))}
        </Grid>
      )}

      {/* ── Alerta vencidos ── */}
      {resumen?.vencidos > 0 && (
        <Alert severity="error" sx={{ mb: 3, borderRadius: 2, fontWeight: 600 }}>
          <strong>{resumen.vencidos} lote(s) VENCIDO(S)</strong> — Retíralos del inventario inmediatamente.
          {resumen.valor_total_en_riesgo > 0 && (
            <> Valor en riesgo: <strong>{formatCurrency(resumen.valor_total_en_riesgo)}</strong></>
          )}
        </Alert>
      )}

      <Paper sx={{ borderRadius: 4, overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
        <Tabs
          value={tab} onChange={(_, v) => setTab(v)}
          variant={isMobile ? 'fullWidth' : 'standard'}
          sx={{
            px: isMobile ? 0 : 2, borderBottom: '1px solid', borderColor: 'divider',
            '& .MuiTabs-indicator': { bgcolor: PURPLE },
            '& .Mui-selected': { color: `${PURPLE} !important` },
          }}
        >
          <Tab label={`📦 Stock (${lotes.length})`} sx={{ fontWeight: 700, textTransform: 'none', fontSize: isMobile ? 12 : 13 }} />
          <Tab label={`⚠️ Vencimientos (${alertas.length})`} sx={{ fontWeight: 700, textTransform: 'none', fontSize: isMobile ? 12 : 13 }} />
        </Tabs>

        {/* ── Filtros ── */}
        <Box sx={{ p: 2, display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center', borderBottom: '1px solid', borderColor: 'divider' }}>
          <TextField
            size="small" placeholder="Buscar producto o lote..."
            value={busqueda} onChange={e => { setBusqueda(e.target.value); setLotesPage(0); }}
            sx={{ flex: 1, minWidth: 160 }}
            InputProps={{
              startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment>,
              endAdornment: busqueda ? (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => { setBusqueda(''); setLotesPage(0); }}>
                    <Close fontSize="small" />
                  </IconButton>
                </InputAdornment>
              ) : null,
            }}
          />
          {tab === 0 && (
            <>
              {/* Urgency filter chips */}
              <Box sx={{ display: 'flex', gap: 0.8, flexWrap: 'wrap' }}>
                {[
                  { key: 'todos',   label: 'Todos' },
                  { key: 'vencido', label: 'Vencidos' },
                  { key: 'critico', label: 'Críticos' },
                  { key: 'alerta',  label: 'Alertas' },
                  { key: 'aviso',   label: 'Avisos' },
                  { key: 'ok',      label: 'Vigentes' },
                ].map(({ key, label }) => {
                  const cfg = key === 'todos' ? { color: '#64748b' } : (URGENCIA_CONFIG[key] || { color: '#64748b' });
                  const count = key === 'todos' ? lotes.length : lotes.filter(l => l.urgencia === key).length;
                  return (
                    <Chip
                      key={key}
                      label={`${label} (${count})`}
                      onClick={() => { setFiltroUrgencia(key); setLotesPage(0); }}
                      size="small"
                      sx={{
                        fontWeight: 700, fontSize: 11, cursor: 'pointer',
                        bgcolor: filtroUrgencia === key ? cfg.color : 'transparent',
                        color: filtroUrgencia === key ? '#fff' : 'text.secondary',
                        border: `1px solid ${filtroUrgencia === key ? cfg.color : 'divider'}`,
                      }}
                    />
                  );
                })}
              </Box>
              {/* CSV export button */}
              <Tooltip title="Exportar CSV" arrow>
                <IconButton size="small" onClick={exportCSV} sx={{ color: 'text.secondary', border: '1px solid', borderColor: 'divider', borderRadius: 1.5 }}>
                  <FileDownload fontSize="small" />
                </IconButton>
              </Tooltip>
            </>
          )}
          {tab === 1 && (
            /* Dias alerta button group */
            <Box sx={{ display: 'flex', gap: 0.5 }}>
              {[15, 30, 60, 90].map(d => (
                <Button
                  key={d} size="small"
                  variant={diasAlerta === d ? 'contained' : 'outlined'}
                  onClick={() => setDiasAlerta(d)}
                  sx={{
                    minWidth: 40, borderRadius: 2, fontWeight: 600,
                    ...(diasAlerta === d
                      ? { bgcolor: PURPLE }
                      : { borderColor: `${PURPLE}40`, color: PURPLE })
                  }}
                >
                  {d}d
                </Button>
              ))}
            </Box>
          )}
        </Box>

        {/* ════ TAB 0: STOCK POR LOTES ════ */}
        {tab === 0 && (
          <Box sx={{ p: 2 }}>
            {lotesSorted.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 6, color: 'text.secondary' }}>
                <Layers sx={{ fontSize: 48, mb: 1, opacity: 0.2 }} />
                <Typography>No hay lotes que coincidan con los filtros.</Typography>
              </Box>
            ) : isMobile ? (
              /* ─ Cards mobile ─ */
              <>
                {lotesPaginated.map(lote => (
                  <LoteCard key={lote.id} lote={lote} onAjustar={abrirAjuste} />
                ))}
                <TablePagination
                  component="div"
                  count={lotesSorted.length}
                  page={lotesPage}
                  onPageChange={(_, newPage) => setLotesPage(newPage)}
                  rowsPerPage={lotesPP}
                  onRowsPerPageChange={e => { setLotesPP(parseInt(e.target.value, 10)); setLotesPage(0); }}
                  rowsPerPageOptions={[10, 15, 25]}
                  labelRowsPerPage="Filas:"
                  labelDisplayedRows={({ from, to, count }) => `${from}–${to} de ${count}`}
                />
              </>
            ) : (
              /* ─ Tabla desktop ─ */
              <>
                <TableContainer>
                  <Table size="small">
                    <TableHead sx={{ bgcolor: 'action.hover' }}>
                      <TableRow>
                        <SortHeader col="producto"    label="PRODUCTO" />
                        <TableCell sx={{ fontWeight: 800 }}>N° LOTE</TableCell>
                        <SortHeader col="vencimiento" label="VENCIMIENTO" />
                        <TableCell sx={{ fontWeight: 800 }}>ESTADO</TableCell>
                        <SortHeader col="stock"       label="STOCK / CONSUMO" />
                        <TableCell sx={{ fontWeight: 800 }}>COSTO UNIT.</TableCell>
                        <SortHeader col="valor"       label="VALOR" />
                        <TableCell />
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {lotesPaginated.map(lote => {
                        const cfg = URGENCIA_CONFIG[lote.urgencia] || URGENCIA_CONFIG.ok;
                        const isVencido = lote.urgencia === 'vencido';
                        const isCritico = lote.urgencia === 'critico';
                        return (
                          <TableRow key={lote.id} hover
                            sx={(theme) => ({
                              bgcolor: theme.palette.mode === 'dark'
                                ? (isVencido ? 'rgba(239,68,68,0.15)' : isCritico ? 'rgba(239,68,68,0.08)' : 'transparent')
                                : (isVencido ? '#FEF2F2' : isCritico ? '#FFF5F5' : 'transparent'),
                            })}
                          >
                            <TableCell sx={{ fontWeight: 700 }}>{lote.producto_nombre}</TableCell>
                            <TableCell>
                              <Typography sx={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 12 }}>{lote.numero_lote}</Typography>
                              {lote.referencia_compra && (
                                <Typography sx={{ fontSize: 9, color: 'text.secondary' }}>Ref: {lote.referencia_compra}</Typography>
                              )}
                            </TableCell>
                            <TableCell>
                              <Typography sx={{ fontSize: 12, fontWeight: 700, color: cfg.color }}>{fmtFecha(lote.fecha_vencimiento)}</Typography>
                              {lote.fecha_fabricacion && (
                                <Typography sx={{ fontSize: 9, color: 'text.secondary' }}>Fab: {fmtFecha(lote.fecha_fabricacion)}</Typography>
                              )}
                            </TableCell>
                            <TableCell><UrgenciaChip urgencia={lote.urgencia} dias={lote.dias_restantes} /></TableCell>
                            <TableCell>
                              {lote.cantidad_actual <= 0
                                ? <Chip label="Agotado" size="small" sx={{ bgcolor: '#F1F5F9', color: '#64748b', fontWeight: 700, fontSize: 10 }} />
                                : <BarraConsumo inicial={lote.cantidad_inicial} actual={lote.cantidad_actual} />
                              }
                            </TableCell>
                            <TableCell>{formatCurrency(lote.costo_unitario)}</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>{formatCurrency(lote.cantidad_actual * lote.costo_unitario)}</TableCell>
                            <TableCell align="right">
                              <Tooltip title="Ajustar cantidad" arrow>
                                <IconButton size="small" onClick={() => abrirAjuste(lote)} sx={{ color: BLUE, bgcolor: `${BLUE}10` }}>
                                  <Edit fontSize="small" />
                                </IconButton>
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
                  count={lotesSorted.length}
                  page={lotesPage}
                  onPageChange={(_, newPage) => setLotesPage(newPage)}
                  rowsPerPage={lotesPP}
                  onRowsPerPageChange={e => { setLotesPP(parseInt(e.target.value, 10)); setLotesPage(0); }}
                  rowsPerPageOptions={[10, 15, 25, 50]}
                  labelRowsPerPage="Filas:"
                  labelDisplayedRows={({ from, to, count }) => `${from}–${to} de ${count}`}
                />
              </>
            )}
          </Box>
        )}

        {/* ════ TAB 1: PRÓXIMOS A VENCER ════ */}
        {tab === 1 && (
          <Box sx={{ p: 2 }}>
            {alertasFiltradas.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 6 }}>
                <CheckCircle sx={{ fontSize: 48, color: PURPLE, mb: 1 }} />
                <Typography color="text.secondary">No hay lotes próximos a vencer en los próximos {diasAlerta} días.</Typography>
              </Box>
            ) : (
              <Stack spacing={2}>
                {alertasFiltradas.map(alerta => {
                  const cfg = URGENCIA_CONFIG[alerta.urgencia] || URGENCIA_CONFIG.ok;
                  const loteRef = lotes.find(l => l.id === alerta.lote_id);
                  return (
                    <Paper key={alerta.lote_id} variant="outlined" sx={(theme) => ({
                      p: 2, borderRadius: 2,
                      borderColor: theme.palette.mode === 'dark' ? `${cfg.color}40` : `${cfg.color}30`,
                      bgcolor: theme.palette.mode === 'dark' ? `${cfg.color}10` : cfg.bg,
                    })}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 1 }}>
                        <Box sx={{ flex: 1 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5, flexWrap: 'wrap' }}>
                            <Avatar sx={{ width: 28, height: 28, bgcolor: `${cfg.color}20`, color: cfg.color }}>
                              {React.cloneElement(cfg.icon, { sx: { fontSize: 16 } })}
                            </Avatar>
                            <Typography sx={{ fontWeight: 800, fontSize: 15 }}>{alerta.producto_nombre}</Typography>
                            <UrgenciaChip urgencia={alerta.urgencia} dias={alerta.dias_restantes} />
                            {loteRef && (
                              <Button
                                size="small"
                                onClick={() => abrirAjuste(loteRef)}
                                startIcon={<Edit fontSize="small" />}
                                sx={{ color: BLUE, bgcolor: `${BLUE}10`, borderRadius: 1.5, fontWeight: 600, fontSize: 11, ml: 1, flexShrink: 0 }}
                              >
                                Ajustar
                              </Button>
                            )}
                          </Box>
                          <Typography sx={{ fontSize: 12, color: 'text.secondary', ml: 0.5 }}>
                            Lote: <strong>{alerta.numero_lote}</strong>
                            {' · '}Vence: <strong>{fmtFecha(alerta.fecha_vencimiento)}</strong>
                            {' · '}Stock: <strong>{alerta.cantidad_actual} {alerta.unidad_medida}</strong>
                          </Typography>
                        </Box>
                        <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
                          <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>Valor en riesgo</Typography>
                          <Typography sx={{ fontWeight: 900, fontSize: 16, color: cfg.color }}>
                            {formatCurrency(alerta.valor_en_riesgo)}
                          </Typography>
                        </Box>
                      </Box>
                    </Paper>
                  );
                })}
              </Stack>
            )}
          </Box>
        )}
      </Paper>

      {/* ════ MODAL: Registrar Lote ════ */}
      <Dialog
        open={modalLote.open} onClose={() => setModalLote({ open: false })}
        maxWidth="md" fullWidth fullScreen={isMobile}
        PaperProps={{ sx: { borderRadius: isMobile ? 0 : 4, overflow: 'hidden' } }}
      >
        <Box sx={{ height: 6, bgcolor: PURPLE }} />
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pt: 2.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Avatar sx={{ bgcolor: `${PURPLE}15`, color: PURPLE }}><Layers /></Avatar>
            <Typography variant="h6" sx={{ fontWeight: 800 }}>Registrar Entrada de Lote</Typography>
          </Box>
          <IconButton onClick={() => setModalLote({ open: false })} size="small"><Close /></IconButton>
        </DialogTitle>

        <DialogContent dividers sx={{ p: { xs: 2, md: 3 } }}>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.secondary', textTransform: 'uppercase', mb: 1, display: 'block' }}>
                1. Selección de Producto *
              </Typography>
              <Autocomplete
                options={productos}
                getOptionLabel={o => `${o.nombre} (${o.unidad_medida || 'UND'})`}
                value={form.producto_id}
                onChange={(_, v) => setForm(p => ({ ...p, producto_id: v }))}
                filterOptions={(opts, state) => {
                  const q = (state.inputValue || '').toLowerCase().trim();
                  if (!q) return opts;
                  return opts.filter(o =>
                    o.nombre.toLowerCase().includes(q) ||
                    (o.codigo_barras && o.codigo_barras.toLowerCase().includes(q))
                  );
                }}
                renderInput={params => <TextField {...params} placeholder="Busca por nombre del producto o código..." fullWidth required />}
              />
            </Grid>

            <Grid item xs={12}><Divider><Chip label="Datos del Lote" size="small" /></Divider></Grid>

            <Grid item xs={12} sm={6}>
              <TextField fullWidth required label="Número de Lote" placeholder="Ej: L-4520-X"
                value={form.numero_lote} onChange={e => setForm(p => ({ ...p, numero_lote: e.target.value.toUpperCase() }))} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth required label="Cantidad Recibida" type="number"
                value={form.cantidad_inicial} onChange={e => setForm(p => ({ ...p, cantidad_inicial: e.target.value }))}
                InputProps={{ endAdornment: <InputAdornment position="end">{form.producto_id?.unidad_medida || 'UND'}</InputAdornment> }} />
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth required label="Fecha Vencimiento" type="date" InputLabelProps={{ shrink: true }}
                value={form.fecha_vencimiento} onChange={e => setForm(p => ({ ...p, fecha_vencimiento: e.target.value }))}
                inputProps={{ min: new Date().toLocaleDateString('en-CA') }}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth label="Fabricación (Opc.)" type="date" InputLabelProps={{ shrink: true }}
                value={form.fecha_fabricacion} onChange={e => setForm(p => ({ ...p, fecha_fabricacion: e.target.value }))} />
            </Grid>

            <Grid item xs={12}><Divider><Chip label="Financiero y Origen" size="small" /></Divider></Grid>

            <Grid item xs={12} sm={6}>
              <CurrencyField fullWidth required label="Costo Unitario"
                value={form.costo_unitario}
                onChange={val => setForm({ ...form, costo_unitario: val })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="Referencia / Factura" placeholder="Ej: FACT-9902"
                value={form.referencia_compra} onChange={e => setForm(p => ({ ...p, referencia_compra: e.target.value }))} />
            </Grid>
            <Grid item xs={12}>
              <Autocomplete
                options={clientes} getOptionLabel={o => o.nombre} value={form.proveedor_id}
                onChange={(_, v) => setForm(p => ({ ...p, proveedor_id: v }))}
                renderInput={params => <TextField {...params} label="Proveedor / Origen de Mercancía" fullWidth placeholder="Busca al proveedor..." />}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth multiline rows={2} label="Observaciones Internas"
                value={form.observaciones} onChange={e => setForm(p => ({ ...p, observaciones: e.target.value }))} />
            </Grid>
          </Grid>
        </DialogContent>

        <DialogActions sx={{ p: { xs: 2, sm: 3 }, bgcolor: 'action.hover', gap: 1 }}>
          <Button
            onClick={() => setModalLote({ open: false })} variant="outlined"
            sx={{ borderRadius: 2, fontWeight: 700, color: 'text.secondary', flex: isMobile ? 1 : 'none' }}
          >
            Cancelar
          </Button>
          <Button
            variant="contained" onClick={handleCrearLote}
            sx={{ bgcolor: PURPLE, fontWeight: 800, borderRadius: 2, flex: isMobile ? 1 : 'none', '&:hover': { bgcolor: '#7C3AED' } }}
          >
            Guardar Lote
          </Button>
        </DialogActions>
      </Dialog>

      {/* ════ MODAL: Ajuste manual ════ */}
      <Dialog
        open={modalAjuste.open} onClose={() => setModalAjuste({ open: false, lote: null })}
        maxWidth="xs" fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}>
          <TrendingDown sx={{ color: ACCENT }} /> Ajuste de Lote
        </DialogTitle>
        <DialogContent>
          {modalAjuste.lote && (
            <Paper variant="outlined" sx={{ p: 1.5, mb: 2, borderRadius: 2, bgcolor: 'action.hover' }}>
              <Typography sx={{ fontWeight: 700, fontSize: 13 }}>{modalAjuste.lote.producto_nombre}</Typography>
              <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
                Lote {modalAjuste.lote.numero_lote} · Stock: {modalAjuste.lote.cantidad_actual}
              </Typography>
            </Paper>
          )}
          <Stack spacing={2}>
            <TextField fullWidth size="small" label="Cantidad" type="number"
              helperText="Positivo = entrada · Negativo = salida (merma, donación...)"
              value={ajusteForm.cantidad} onChange={e => setAjusteForm(p => ({ ...p, cantidad: e.target.value }))} />
            <TextField fullWidth size="small" label="Motivo *"
              placeholder="Ej: Merma por daño, Retiro por vencimiento..."
              value={ajusteForm.motivo} onChange={e => setAjusteForm(p => ({ ...p, motivo: e.target.value }))} />
            <TextField fullWidth size="small" label="Referencia (opcional)"
              value={ajusteForm.referencia} onChange={e => setAjusteForm(p => ({ ...p, referencia: e.target.value }))} />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, gap: 1 }}>
          <Button onClick={() => setModalAjuste({ open: false, lote: null })} color="inherit" sx={{ flex: 1 }}>Cancelar</Button>
          <Button variant="contained" onClick={handleAjustar} sx={{ bgcolor: ACCENT, fontWeight: 800, borderRadius: 2, flex: 1 }}>
            Aplicar Ajuste
          </Button>
        </DialogActions>
      </Dialog>

      {/* ════ MODAL: Simulador FEFO ════ */}
      <Dialog
        open={modalFefo.open}
        onClose={() => setModalFefo({ open: false, producto: null, cantidad: '', resultado: null })}
        maxWidth="sm" fullWidth fullScreen={isMobile}
        PaperProps={{ sx: { borderRadius: isMobile ? 0 : 3 } }}
      >
        <DialogTitle sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Science sx={{ color: PURPLE }} /> Simulador FEFO
          </Box>
          <IconButton size="small" onClick={() => setModalFefo({ open: false, producto: null, cantidad: '', resultado: null })}>
            <Close fontSize="small" />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Consulta qué lotes se consumirían al vender una cantidad, priorizando los que vencen primero.
          </Typography>
          <Stack spacing={2} sx={{ mb: 2 }}>
            <Autocomplete
              options={productos} getOptionLabel={o => o.nombre}
              value={modalFefo.producto}
              onChange={(_, v) => setModalFefo(p => ({ ...p, producto: v, resultado: null }))}
              renderInput={params => <TextField {...params} label="Producto" size="small" fullWidth />}
            />
            <TextField fullWidth size="small" label="Cantidad a vender" type="number"
              value={modalFefo.cantidad}
              onChange={e => setModalFefo(p => ({ ...p, cantidad: e.target.value, resultado: null }))}
              InputProps={{ endAdornment: <InputAdornment position="end">{modalFefo.producto?.unidad_medida || 'UND'}</InputAdornment> }}
            />
          </Stack>
          <Button fullWidth variant="outlined" onClick={consultarFefo}
            disabled={!modalFefo.producto || !modalFefo.cantidad}
            sx={{ mb: 2, borderRadius: 2, fontWeight: 700, color: PURPLE, borderColor: PURPLE }}
          >
            Consultar Lotes
          </Button>

          {modalFefo.resultado && (
            <Box>
              {modalFefo.resultado.factible
                ? <Alert severity="success" sx={{ mb: 2, borderRadius: 2 }}>Stock suficiente — {modalFefo.resultado.lotes_sugeridos.length} lote(s) a consumir</Alert>
                : <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>Stock insuficiente — faltan {modalFefo.resultado.faltante} unidades</Alert>
              }
              <Stack spacing={1}>
                {modalFefo.resultado.lotes_sugeridos.map((l, i) => (
                  <Paper key={i} variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                      <Box>
                        <Typography sx={{ fontWeight: 700, fontSize: 12 }}>{i + 1}° · Lote {l.numero_lote}</Typography>
                        <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>
                          Vence: {fmtFecha(l.fecha_vencimiento)} ({l.dias_restantes}d) · Disp: {l.cantidad_disponible}
                        </Typography>
                      </Box>
                      <Chip label={`Consumir: ${l.a_consumir}`} size="small"
                        sx={{ fontWeight: 700, bgcolor: `${PURPLE}15`, color: PURPLE }} />
                    </Box>
                  </Paper>
                ))}
              </Stack>
              {modalFefo.resultado?.lotes_sugeridos?.length > 0 && (
                <Box sx={{ mt: 1.5, p: 1.5, borderRadius: 2, bgcolor: `${PURPLE}08`, border: `1px dashed ${PURPLE}30` }}>
                  <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>Costo estimado del despacho</Typography>
                  <Typography sx={{ fontSize: 15, fontWeight: 800, color: PURPLE }}>
                    {formatCurrency(modalFefo.resultado.lotes_sugeridos.reduce((s, l) => s + (l.a_consumir * (l.costo_unitario || 0)), 0))}
                  </Typography>
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button
            fullWidth={isMobile}
            onClick={() => setModalFefo({ open: false, producto: null, cantidad: '', resultado: null })}
            color="inherit" sx={{ fontWeight: 700 }}
          >
            Cerrar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default InventarioLotes;
