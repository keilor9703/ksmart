import React, { useState, useCallback } from 'react';
import {
  Box, Typography, Grid, TextField, Button, Table, TableHead, TableRow,
  TableCell, TableBody, TableContainer, Paper, Chip, Collapse, Avatar,
  CircularProgress, Tooltip, LinearProgress, InputAdornment, Divider,
  useMediaQuery,
} from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';
import {
  Person, ExpandMore, ExpandLess, BarChart as BarChartIcon,
  TrendingUp, ShoppingCart, AccountBalanceWallet, StarRate,
  Download, Search, CalendarToday, InfoOutlined,
} from '@mui/icons-material';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement,
  Title, Tooltip as ChartTooltip, Legend,
} from 'chart.js';
import apiClient from '../../api';
import { formatCurrency } from '../../utils/formatters';
import { toast } from 'react-toastify';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, ChartTooltip, Legend);

// ─── Constants ────────────────────────────────────────────────────────────────

const COLOR_PRIMARY = '#6366F1';
const GREEN  = '#10B981';
const RED    = '#EF4444';
const AMBER  = '#F59E0B';

const PRESETS = [
  { key: 'hoy',       label: 'Hoy'         },
  { key: 'semana',    label: 'Esta semana'  },
  { key: 'mes',       label: 'Este mes'     },
  { key: 'trimestre', label: 'Trimestre'    },
  { key: 'año',       label: 'Este año'     },
];

const RANK_COLORS = ['#FFD700', '#C0C0C0', '#CD7F32'];

function getPresetDates(key) {
  const today  = new Date();
  const toStr  = (d) => d.toISOString().slice(0, 10);
  const todayS = toStr(today);
  if (key === 'hoy')       return { start: todayS, end: todayS };
  if (key === 'semana') {
    const mon = new Date(today);
    mon.setDate(today.getDate() - today.getDay() + (today.getDay() === 0 ? -6 : 1));
    return { start: toStr(mon), end: todayS };
  }
  if (key === 'mes')       return { start: `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-01`, end: todayS };
  if (key === 'trimestre') { const d = new Date(today); d.setMonth(d.getMonth()-3); return { start: toStr(d), end: todayS }; }
  if (key === 'año')       return { start: `${today.getFullYear()}-01-01`, end: todayS };
  return { start: '', end: todayS };
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

const KpiCard = ({ label, value, sub, icon, color }) => {
  const theme = useTheme();
  return (
    <Paper sx={{ p: 2, borderRadius: 2.5, border: '1px solid', borderColor: 'divider', boxShadow: 'none' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Box sx={{ width: 40, height: 40, borderRadius: 2, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: alpha(color, theme.palette.mode === 'dark' ? 0.2 : 0.1), color }}>
          {icon}
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontSize: 11, color: 'text.secondary', fontWeight: 500 }}>{label}</Typography>
          <Typography sx={{ fontSize: 15, fontWeight: 800, color, lineHeight: 1.2 }}>{value}</Typography>
          {sub && <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{sub}</Typography>}
        </Box>
      </Box>
    </Paper>
  );
};

// ─── Rank Badge ───────────────────────────────────────────────────────────────

const RankBadge = ({ rank }) => (
  <Box sx={{
    width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    bgcolor: rank <= 3 ? alpha(RANK_COLORS[rank - 1], 0.18) : alpha('#6B7280', 0.1),
    border: `2px solid ${rank <= 3 ? RANK_COLORS[rank - 1] : '#9CA3AF'}`,
  }}>
    <Typography sx={{ fontSize: 11, fontWeight: 900, color: rank <= 3 ? RANK_COLORS[rank - 1] : '#9CA3AF' }}>
      {rank}
    </Typography>
  </Box>
);

// ─── Estado Chip ──────────────────────────────────────────────────────────────

const EstadoChip = ({ estado }) => {
  const map = { pagado: [GREEN, 'Pagado'], pendiente: [AMBER, 'Pendiente'], parcial: [COLOR_PRIMARY, 'Parcial'] };
  const [color, label] = map[estado] || ['#9CA3AF', estado];
  return (
    <Chip label={label} size="small" sx={{ bgcolor: alpha(color, 0.12), color, fontWeight: 700, fontSize: 10, height: 20, borderRadius: 1 }} />
  );
};

// ─── Drill-down row ───────────────────────────────────────────────────────────

const DrillDownRow = ({ vendedor, startDate, endDate, isMobile }) => {
  const theme  = useTheme();
  const [open, setOpen]   = useState(false);
  const [ventas, setVentas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch]   = useState('');

  const loadVentas = useCallback(async () => {
    if (ventas.length > 0) { setOpen(o => !o); return; }
    setLoading(true);
    setOpen(true);
    try {
      const params = {};
      if (startDate) params.start_date = startDate;
      if (endDate)   params.end_date   = endDate;
      const res = await apiClient.get(`/reportes/ventas-vendedor/${vendedor.vendedor_id}`, { params });
      setVentas(res.data);
    } catch {
      toast.error('Error al cargar ventas del vendedor');
    } finally {
      setLoading(false);
    }
  }, [vendedor.vendedor_id, startDate, endDate, ventas.length]);

  const filtered = ventas.filter(v =>
    !search || (v.cliente || '').toLowerCase().includes(search.toLowerCase())
  );

  const fmtDate = (iso) => {
    const d = new Date(iso + (iso.endsWith('Z') ? '' : 'Z'));
    return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  return (
    <>
      {/* Main row */}
      <TableRow
        hover
        onClick={loadVentas}
        sx={{ cursor: 'pointer', '&:hover': { bgcolor: alpha(COLOR_PRIMARY, 0.04) } }}
      >
        <TableCell sx={{ py: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <RankBadge rank={vendedor._rank} />
            <Avatar sx={{ width: 32, height: 32, fontSize: 13, fontWeight: 700, bgcolor: alpha(COLOR_PRIMARY, 0.15), color: COLOR_PRIMARY }}>
              {(vendedor.nombre || '?')[0].toUpperCase()}
            </Avatar>
            <Box>
              <Typography sx={{ fontWeight: 700, fontSize: 13 }}>{vendedor.nombre}</Typography>
              {vendedor.email && <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{vendedor.email}</Typography>}
            </Box>
          </Box>
        </TableCell>
        <TableCell align="center">
          <Chip label={vendedor.total_ventas} size="small" sx={{ fontWeight: 700, bgcolor: alpha(COLOR_PRIMARY, 0.1), color: COLOR_PRIMARY }} />
        </TableCell>
        {!isMobile && (
          <>
            <TableCell align="right" sx={{ fontWeight: 700, color: COLOR_PRIMARY }}>{formatCurrency(vendedor.total_ingresos)}</TableCell>
            <TableCell align="right" sx={{ color: GREEN, fontWeight: 600 }}>{formatCurrency(vendedor.total_cobrado)}</TableCell>
            <TableCell align="right" sx={{ color: vendedor.total_pendiente > 0 ? RED : 'text.secondary' }}>{formatCurrency(vendedor.total_pendiente)}</TableCell>
            <TableCell align="right" sx={{ color: 'text.secondary', fontSize: 12 }}>{formatCurrency(vendedor.ticket_promedio)}</TableCell>
          </>
        )}
        {isMobile && (
          <TableCell align="right" sx={{ fontWeight: 700, color: COLOR_PRIMARY }}>{formatCurrency(vendedor.total_ingresos)}</TableCell>
        )}
        <TableCell align="right">
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, justifyContent: 'flex-end' }}>
            {!isMobile && (
              <Box sx={{ width: 60 }}>
                <LinearProgress
                  variant="determinate"
                  value={vendedor.pct_total}
                  sx={{ height: 5, borderRadius: 3, bgcolor: alpha(COLOR_PRIMARY, 0.12), '& .MuiLinearProgress-bar': { bgcolor: COLOR_PRIMARY } }}
                />
                <Typography sx={{ fontSize: 10, color: 'text.secondary', textAlign: 'right' }}>{vendedor.pct_total}%</Typography>
              </Box>
            )}
            {loading
              ? <CircularProgress size={14} />
              : open ? <ExpandLess sx={{ fontSize: 18, color: 'text.secondary' }} /> : <ExpandMore sx={{ fontSize: 18, color: 'text.secondary' }} />
            }
          </Box>
        </TableCell>
      </TableRow>

      {/* Expanded detail */}
      <TableRow>
        <TableCell colSpan={isMobile ? 4 : 8} sx={{ p: 0, border: 'none' }}>
          <Collapse in={open} timeout="auto" unmountOnExit>
            <Box sx={{ bgcolor: alpha(COLOR_PRIMARY, theme.palette.mode === 'dark' ? 0.07 : 0.03), p: 2, borderBottom: `1px solid ${alpha(COLOR_PRIMARY, 0.15)}` }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5, flexWrap: 'wrap', gap: 1 }}>
                <Typography sx={{ fontSize: 12, fontWeight: 700, color: COLOR_PRIMARY }}>
                  Ventas de {vendedor.nombre} · {ventas.length} registros
                </Typography>
                <TextField
                  size="small" placeholder="Buscar cliente..."
                  value={search} onChange={e => setSearch(e.target.value)}
                  sx={{ width: 200, '& .MuiOutlinedInput-root': { borderRadius: 2, fontSize: 12, height: 30 } }}
                  InputProps={{ startAdornment: <InputAdornment position="start"><Search sx={{ fontSize: 14, color: 'text.secondary' }} /></InputAdornment> }}
                />
              </Box>
              {loading ? (
                <Box sx={{ textAlign: 'center', py: 2 }}><CircularProgress size={20} /></Box>
              ) : filtered.length === 0 ? (
                <Typography sx={{ textAlign: 'center', color: 'text.secondary', fontSize: 12, py: 2 }}>Sin ventas en este período</Typography>
              ) : (
                <TableContainer sx={{ borderRadius: 1.5, border: `1px solid ${alpha(COLOR_PRIMARY, 0.15)}` }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontSize: 11, fontWeight: 700 }}>#</TableCell>
                        <TableCell sx={{ fontSize: 11, fontWeight: 700 }}>Fecha</TableCell>
                        {!isMobile && <TableCell sx={{ fontSize: 11, fontWeight: 700 }}>Cliente</TableCell>}
                        {!isMobile && <TableCell align="center" sx={{ fontSize: 11, fontWeight: 700 }}>Ítems</TableCell>}
                        <TableCell align="right" sx={{ fontSize: 11, fontWeight: 700 }}>Total</TableCell>
                        <TableCell align="right" sx={{ fontSize: 11, fontWeight: 700 }}>Estado</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {filtered.map(v => (
                        <TableRow key={v.id} hover>
                          <TableCell sx={{ fontSize: 11, color: 'text.secondary' }}>#{v.id}</TableCell>
                          <TableCell sx={{ fontSize: 11, whiteSpace: 'nowrap' }}>{fmtDate(v.fecha)}</TableCell>
                          {!isMobile && <TableCell sx={{ fontSize: 12 }}>{v.cliente || <span style={{ color: '#9CA3AF' }}>Sin cliente</span>}</TableCell>}
                          {!isMobile && <TableCell align="center" sx={{ fontSize: 11 }}>{v.num_items}</TableCell>}
                          <TableCell align="right" sx={{ fontWeight: 700, color: COLOR_PRIMARY, fontSize: 12 }}>{formatCurrency(v.total)}</TableCell>
                          <TableCell align="right"><EstadoChip estado={v.estado_pago} /></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ReporteVendedores({ accentColor }) {
  const theme   = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [startDate, setStartDate] = useState('');
  const [endDate,   setEndDate]   = useState('');
  const [data,      setData]      = useState(null);
  const [loading,   setLoading]   = useState(false);
  const [searched,  setSearched]  = useState(false);

  const handlePreset = (key) => {
    const { start, end } = getPresetDates(key);
    setStartDate(start);
    setEndDate(end);
  };

  const handleConsultar = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (startDate) params.start_date = startDate;
      if (endDate)   params.end_date   = endDate;
      const res = await apiClient.get('/reportes/ventas-vendedor', { params });
      setData(res.data);
      setSearched(true);
    } catch {
      toast.error('Error al cargar el reporte de vendedores');
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  const vendedores = data?.vendedores || [];
  const topVendedor = vendedores[0];
  const ticketProm = vendedores.length > 0
    ? vendedores.reduce((s, v) => s + v.ticket_promedio, 0) / vendedores.length
    : 0;

  // Chart data — horizontal bar
  const chartData = {
    labels: vendedores.map(v => v.nombre.split(' ')[0]),
    datasets: [{
      label: 'Ingresos',
      data:   vendedores.map(v => v.total_ingresos),
      backgroundColor: vendedores.map((_, i) => alpha(COLOR_PRIMARY, i === 0 ? 0.9 : 0.5)),
      borderColor:     vendedores.map((_, i) => i === 0 ? COLOR_PRIMARY : alpha(COLOR_PRIMARY, 0.7)),
      borderWidth: 1,
      borderRadius: 4,
    }],
  };

  const chartOptions = {
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: ctx => formatCurrency(ctx.parsed.x) } },
    },
    scales: {
      x: {
        ticks: { font: { size: 10 }, callback: v => formatCurrency(v) },
        grid: { color: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' },
      },
      y: {
        ticks: { font: { size: 11 } },
        grid: { display: false },
      },
    },
  };

  const handleExportCSV = () => {
    if (!vendedores.length) return;
    const rows = [
      ['Rank', 'Nombre', 'Email', 'N° Ventas', 'Total Ingresos', 'Cobrado', 'Pendiente', 'Ticket Promedio', '% Total'],
      ...vendedores.map((v, i) => [
        i + 1, v.nombre, v.email || '', v.total_ventas,
        v.total_ingresos, v.total_cobrado, v.total_pendiente,
        v.ticket_promedio, `${v.pct_total}%`,
      ]),
    ];
    const csv  = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `ventas_por_vendedor_${startDate || 'todo'}_a_${endDate || 'hoy'}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  return (
    <Box>
      {/* Presets */}
      <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mb: 1.5 }}>
        {PRESETS.map(p => (
          <Chip
            key={p.key} label={p.label} size="small" onClick={() => handlePreset(p.key)}
            sx={{ fontSize: 11, fontWeight: 600, borderRadius: 1.5, cursor: 'pointer', '&:hover': { bgcolor: alpha(COLOR_PRIMARY, 0.12), color: COLOR_PRIMARY } }}
          />
        ))}
      </Box>

      {/* Filtro */}
      <Paper sx={{ p: 2, borderRadius: 2.5, mb: 3, boxShadow: 'none', border: '1px solid', borderColor: 'divider' }}>
        <Typography sx={{ fontWeight: 600, fontSize: 11, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.6, mb: 1.5 }}>
          Período de análisis
        </Typography>
        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <TextField
            type="date" label="Desde" size="small" value={startDate}
            onChange={e => setStartDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
            InputProps={{ startAdornment: <InputAdornment position="start"><CalendarToday sx={{ fontSize: 14, color: 'text.secondary' }} /></InputAdornment> }}
            sx={{ flex: '1 1 140px', '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
          />
          <TextField
            type="date" label="Hasta" size="small" value={endDate}
            onChange={e => setEndDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
            InputProps={{ startAdornment: <InputAdornment position="start"><CalendarToday sx={{ fontSize: 14, color: 'text.secondary' }} /></InputAdornment> }}
            sx={{ flex: '1 1 140px', '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
          />
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="contained" onClick={handleConsultar}
              disabled={loading}
              startIcon={loading ? <CircularProgress size={14} color="inherit" /> : <BarChartIcon />}
              sx={{ background: `linear-gradient(135deg, ${COLOR_PRIMARY}, #818CF8)`, borderRadius: 2, fontWeight: 700, whiteSpace: 'nowrap' }}
            >
              {loading ? 'Cargando…' : 'Consultar'}
            </Button>
            <Tooltip title="Exportar CSV">
              <span>
                <Button
                  variant="outlined" onClick={handleExportCSV}
                  disabled={!vendedores.length}
                  sx={{ borderRadius: 2, minWidth: 44, p: 0, height: 38, borderColor: 'divider', color: 'text.secondary' }}
                >
                  <Download fontSize="small" />
                </Button>
              </span>
            </Tooltip>
          </Box>
        </Box>
      </Paper>

      {/* Estado inicial */}
      {!searched && !loading && (
        <Box sx={{ textAlign: 'center', py: 8, color: 'text.secondary' }}>
          <Person sx={{ fontSize: 52, mb: 1.5, opacity: 0.2 }} />
          <Typography fontWeight={700}>Define el período y presiona Consultar</Typography>
          <Typography fontSize={13} sx={{ mt: 0.5 }}>Verás el ranking de ventas de cada vendedor con drill-down detallado.</Typography>
        </Box>
      )}

      {/* Sin resultados */}
      {searched && !loading && vendedores.length === 0 && (
        <Box sx={{ textAlign: 'center', py: 8, color: 'text.secondary' }}>
          <InfoOutlined sx={{ fontSize: 48, mb: 1.5, opacity: 0.25 }} />
          <Typography fontWeight={700}>Sin ventas registradas en este período</Typography>
          <Typography fontSize={13} sx={{ mt: 0.5 }}>Verifica que las ventas tengan vendedor asignado.</Typography>
        </Box>
      )}

      {/* Resultados */}
      {searched && !loading && vendedores.length > 0 && (
        <>
          {/* KPIs */}
          <Grid container spacing={1.5} sx={{ mb: 3 }}>
            <Grid item xs={6} sm={3}>
              <KpiCard
                label="Vendedores activos"
                value={vendedores.length}
                icon={<Person />}
                color={COLOR_PRIMARY}
              />
            </Grid>
            <Grid item xs={6} sm={3}>
              <KpiCard
                label="Ingresos del período"
                value={formatCurrency(data.total_ingresos_periodo)}
                sub={`${data.total_ventas_periodo} ventas`}
                icon={<TrendingUp />}
                color={GREEN}
              />
            </Grid>
            <Grid item xs={6} sm={3}>
              <KpiCard
                label="Top vendedor"
                value={topVendedor?.nombre.split(' ')[0] || '—'}
                sub={topVendedor ? formatCurrency(topVendedor.total_ingresos) : ''}
                icon={<StarRate />}
                color={AMBER}
              />
            </Grid>
            <Grid item xs={6} sm={3}>
              <KpiCard
                label="Ticket prom. global"
                value={formatCurrency(ticketProm)}
                icon={<ShoppingCart />}
                color="#8B5CF6"
              />
            </Grid>
          </Grid>

          {/* Chart */}
          {vendedores.length > 1 && (
            <Paper sx={{ p: 2, borderRadius: 2.5, mb: 3, boxShadow: 'none', border: '1px solid', borderColor: 'divider' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                <BarChartIcon sx={{ fontSize: 16, color: COLOR_PRIMARY }} />
                <Typography sx={{ fontWeight: 700, fontSize: 13 }}>Ingresos por vendedor</Typography>
              </Box>
              <Box sx={{ height: Math.max(vendedores.length * 42, 160) }}>
                <Bar data={chartData} options={chartOptions} />
              </Box>
            </Paper>
          )}

          {/* Tabla ranking */}
          <Paper sx={{ borderRadius: 2.5, border: '1px solid', borderColor: 'divider', boxShadow: 'none', overflow: 'hidden' }}>
            <Box sx={{ px: 2.5, py: 1.5, display: 'flex', alignItems: 'center', gap: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
              <AccountBalanceWallet sx={{ fontSize: 16, color: COLOR_PRIMARY }} />
              <Typography sx={{ fontWeight: 700, fontSize: 13 }}>Ranking de vendedores</Typography>
              <Chip
                label="Haz clic en una fila para ver sus ventas"
                size="small"
                icon={<ExpandMore sx={{ fontSize: 14 }} />}
                sx={{ ml: 'auto', fontSize: 10, height: 22, bgcolor: alpha(COLOR_PRIMARY, 0.08), color: COLOR_PRIMARY }}
              />
            </Box>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: theme.palette.mode === 'dark' ? alpha(COLOR_PRIMARY, 0.08) : alpha(COLOR_PRIMARY, 0.04) }}>
                    <TableCell sx={{ fontWeight: 700, fontSize: 11 }}>Vendedor</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 700, fontSize: 11 }}>Ventas</TableCell>
                    {!isMobile && <>
                      <TableCell align="right" sx={{ fontWeight: 700, fontSize: 11 }}>Ingresos</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, fontSize: 11 }}>Cobrado</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, fontSize: 11 }}>Pendiente</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, fontSize: 11 }}>Ticket prom.</TableCell>
                    </>}
                    {isMobile && <TableCell align="right" sx={{ fontWeight: 700, fontSize: 11 }}>Ingresos</TableCell>}
                    <TableCell align="right" sx={{ fontWeight: 700, fontSize: 11 }}>% Total</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {vendedores.map((v, i) => (
                    <DrillDownRow
                      key={v.vendedor_id}
                      vendedor={{ ...v, _rank: i + 1 }}
                      startDate={startDate}
                      endDate={endDate}
                      isMobile={isMobile}
                    />
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

            {/* Footer totales */}
            <Divider />
            <Box sx={{
              px: 2.5, py: 1.5,
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr 1fr' : '2fr 1fr 1fr 1fr 1fr 1fr',
              gap: 1,
              bgcolor: theme.palette.mode === 'dark' ? alpha('#fff', 0.02) : alpha(COLOR_PRIMARY, 0.03),
            }}>
              <Typography sx={{ fontWeight: 800, fontSize: 12 }}>TOTALES</Typography>
              <Typography sx={{ fontWeight: 800, fontSize: 12, textAlign: 'center' }}>
                {data.total_ventas_periodo}
              </Typography>
              {!isMobile && <>
                <Typography sx={{ fontWeight: 800, fontSize: 12, textAlign: 'right', color: COLOR_PRIMARY }}>
                  {formatCurrency(data.total_ingresos_periodo)}
                </Typography>
                <Typography sx={{ fontWeight: 800, fontSize: 12, textAlign: 'right', color: GREEN }}>
                  {formatCurrency(vendedores.reduce((s, v) => s + v.total_cobrado, 0))}
                </Typography>
                <Typography sx={{ fontWeight: 800, fontSize: 12, textAlign: 'right', color: RED }}>
                  {formatCurrency(vendedores.reduce((s, v) => s + v.total_pendiente, 0))}
                </Typography>
                <Typography sx={{ fontSize: 12, textAlign: 'right', color: 'text.secondary' }}>—</Typography>
              </>}
              {isMobile && (
                <Typography sx={{ fontWeight: 800, fontSize: 12, textAlign: 'right', color: COLOR_PRIMARY }}>
                  {formatCurrency(data.total_ingresos_periodo)}
                </Typography>
              )}
            </Box>
          </Paper>
        </>
      )}
    </Box>
  );
}
