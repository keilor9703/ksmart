// ─── Helpers internos ────────────────────────────────────────────────────────
import React, { useState, useEffect, useMemo } from 'react';
import {
  Box, Typography, Paper, Grid, Button, Chip,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TableSortLabel, useMediaQuery, CircularProgress
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { People, AccountBalanceWallet, TrendingUp, TrendingDown } from '@mui/icons-material';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import apiClient from '../../api';
import { formatCurrency } from '../../utils/formatters';
import { toast } from 'react-toastify';
import { visuallyHidden, stableSort, getComparator } from '../../utils/sortingUtils';
import {
  FilterPanel, KpiCard, SectionTitle, LoadingState, EmptyState,
  barChartDefaults, accentDataset,
  GREEN, BLUE, RED, YELLOW, REPORT_ACCENT
} from './ReportShared.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const ACCENT = '#F43F5E';

// ─── Gráfica simple ───────────────────────────────────────────────────────────
const SimpleBar = ({ labels, values, color, height = 260 }) => (
  <Box sx={{ height }}>
    <Bar
      data={{ labels, datasets: [accentDataset(values, '', color)] }}
      options={{
        ...barChartDefaults(),
        maintainAspectRatio: false,
        plugins: { ...barChartDefaults().plugins },
        scales: {
          ...barChartDefaults().scales,
          y: { ...barChartDefaults().scales.y, ticks: { callback: v => formatCurrency(v) } },
        },
      }}
    />
  </Box>
);

// ─── Tabla reutilizable ───────────────────────────────────────────────────────
const RankedTable = ({ data, columns, order, orderBy, onSort }) => (
  <TableContainer sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell sx={{ width: 40 }}>#</TableCell>
          {columns.map(c => (
            <TableCell key={c.id} align={c.numeric ? 'right' : 'left'}>
              <TableSortLabel
                active={orderBy === c.id}
                direction={orderBy === c.id ? order : 'asc'}
                onClick={() => onSort(c.id)}
              >
                {c.label}
                {orderBy === c.id && <Box component="span" sx={visuallyHidden}>{order === 'desc' ? 'desc' : 'asc'}</Box>}
              </TableSortLabel>
            </TableCell>
          ))}
        </TableRow>
      </TableHead>
      <TableBody>
        {data.length === 0
          ? <TableRow><TableCell colSpan={columns.length + 1} sx={{ textAlign: 'center', py: 5, color: 'text.secondary' }}>Sin datos para este período</TableCell></TableRow>
          : data.map((row, i) => (
              <TableRow key={i} hover>
                <TableCell sx={{ fontWeight: 700, color: i < 3 ? ACCENT : 'text.secondary', fontSize: 12 }}>{i + 1}</TableCell>
                {columns.map(c => (
                  <TableCell key={c.id} align={c.numeric ? 'right' : 'left'}
                    sx={{ fontWeight: c.bold ? 700 : 400, color: c.color?.(row) || 'text.primary', fontSize: 13 }}>
                    {c.render ? c.render(row) : row[c.id]}
                  </TableCell>
                ))}
              </TableRow>
            ))
        }
      </TableBody>
    </Table>
  </TableContainer>
);

// ─── Card mobile cliente ──────────────────────────────────────────────────────
const ClientCard = ({ name, id, primary, primaryLabel, color }) => (
  <Paper sx={{ p: 2.5, mb: 2, borderRadius: 3, boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <Box>
        <Typography sx={{ fontWeight: 700, fontSize: 14 }}>{name}</Typography>
        <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>#{id}</Typography>
      </Box>
      <Box sx={{ textAlign: 'right' }}>
        <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>{primaryLabel}</Typography>
        <Typography sx={{ fontWeight: 800, fontSize: 16, color }}>{formatCurrency(primary)}</Typography>
      </Box>
    </Box>
  </Paper>
);

// ══════════════════════════════════════════════════════════════════════════════
// CustomerBuyers
// ══════════════════════════════════════════════════════════════════════════════
export const CustomerBuyers = ({ accentColor = ACCENT }) => {
  const [data, setData]           = useState([]);
  const [loading, setLoading]     = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate]     = useState('');
  const [order, setOrder]         = useState('desc');
  const [orderBy, setOrderBy]     = useState('total_purchase_amount');
  const [showAll, setShowAll]     = useState(false);

  const isMobile = useMediaQuery(useTheme().breakpoints.down('sm'));

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = {};
      if (startDate) params.start_date = startDate;
      if (endDate)   params.end_date   = endDate;
      const { data: res } = await apiClient.get('/reportes/clientes_compradores', { params });
      setData(res);
    } catch { toast.error('Error al cargar clientes compradores.'); }
    finally { setLoading(false); }
  };

  const handleClear = () => { setStartDate(''); setEndDate(''); setTimeout(fetchData, 0); };
  const handleSort  = (col) => { setOrder(p => orderBy === col && p === 'desc' ? 'asc' : 'desc'); setOrderBy(col); };

  const sorted  = useMemo(() => stableSort(data, getComparator(order, orderBy)), [data, order, orderBy]);
  const visible = showAll ? sorted : sorted.slice(0, 5);

  const totalCompras = data.reduce((s, c) => s + c.total_purchase_amount, 0);

  const COLS = [
    { id: 'client_name',            label: 'Cliente',      numeric: false, bold: true },
    { id: 'total_purchase_amount',  label: 'Total comprado', numeric: true, bold: true, render: r => formatCurrency(r.total_purchase_amount), color: () => GREEN },
  ];

  return (
    <Box>
      <FilterPanel startDate={startDate} onStartChange={setStartDate} endDate={endDate} onEndChange={setEndDate}
        onFilter={fetchData} onClear={handleClear} loading={loading} accentColor={accentColor} />

      {loading ? <LoadingState /> : data.length === 0 ? (
        <EmptyState icon="👥" message="No hay datos de clientes compradores para el período." />
      ) : (
        <>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={4}>
              <KpiCard label="Clientes activos" value={data.length} icon={<People />} color={accentColor} />
            </Grid>
            <Grid item xs={12} sm={4}>
              <KpiCard label="Total facturado" value={formatCurrency(totalCompras)} icon={<TrendingUp />} color={GREEN} />
            </Grid>
            <Grid item xs={12} sm={4}>
              <KpiCard label="Ticket promedio" value={formatCurrency(totalCompras / data.length)} icon={<AccountBalanceWallet />} color={BLUE} />
            </Grid>
          </Grid>

          <Paper sx={{ p: 2.5, borderRadius: 3, mb: 2.5, boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
            <Typography sx={{ fontWeight: 700, fontSize: 14, mb: 2 }}>Top clientes por monto de compra</Typography>
            <SimpleBar labels={visible.map(c => c.client_name)} values={visible.map(c => c.total_purchase_amount)} color={accentColor} />
          </Paper>

          {isMobile
            ? visible.map(c => <ClientCard key={c.client_id} name={c.client_name} id={c.client_id} primary={c.total_purchase_amount} primaryLabel="Total comprado" color={GREEN} />)
            : <RankedTable data={visible} columns={COLS} order={order} orderBy={orderBy} onSort={handleSort} />
          }

          {sorted.length > 5 && (
            <Button onClick={() => setShowAll(p => !p)} sx={{ mt: 1.5, fontWeight: 600, color: accentColor, fontSize: 12 }}>
              {showAll ? 'Ver solo Top 5' : `Ver todos (${sorted.length})`}
            </Button>
          )}
        </>
      )}
    </Box>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// CustomerDebtors
// ══════════════════════════════════════════════════════════════════════════════
export const CustomerDebtors = ({ accentColor = ACCENT }) => {
  const [data, setData]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [order, setOrder]     = useState('desc');
  const [orderBy, setOrderBy] = useState('total_debt_amount');
  const [showAll, setShowAll] = useState(false);

  const isMobile = useMediaQuery(useTheme().breakpoints.down('sm'));

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: res } = await apiClient.get('/reportes/clientes_deudores');
      setData(res);
    } catch { toast.error('Error al cargar clientes deudores.'); }
    finally { setLoading(false); }
  };

  const handleSort = (col) => { setOrder(p => orderBy === col && p === 'desc' ? 'asc' : 'desc'); setOrderBy(col); };
  const sorted  = useMemo(() => stableSort(data, getComparator(order, orderBy)), [data, order, orderBy]);
  const visible = showAll ? sorted : sorted.slice(0, 5);

  const totalDeuda = data.reduce((s, c) => s + c.total_debt_amount, 0);

  const COLS = [
    { id: 'client_name',       label: 'Cliente',   numeric: false, bold: true },
    { id: 'total_debt_amount', label: 'Deuda total', numeric: true, bold: true, render: r => formatCurrency(r.total_debt_amount), color: () => RED },
  ];

  return (
    <Box>
      {loading ? <LoadingState /> : data.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Typography sx={{ fontSize: 48, mb: 1.5 }}>✅</Typography>
          <Typography sx={{ fontWeight: 700, fontSize: 18 }}>¡Sin deudores!</Typography>
          <Typography sx={{ color: 'text.secondary' }}>Todos los clientes están al día.</Typography>
        </Box>
      ) : (
        <>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={4}>
              <KpiCard label="Clientes deudores" value={data.length} icon={<People />} color={RED} />
            </Grid>
            <Grid item xs={12} sm={4}>
              <KpiCard label="Deuda total" value={formatCurrency(totalDeuda)} icon={<AccountBalanceWallet />} color={RED} />
            </Grid>
            <Grid item xs={12} sm={4}>
              <KpiCard label="Deuda promedio" value={formatCurrency(totalDeuda / data.length)} icon={<TrendingDown />} color={YELLOW} />
            </Grid>
          </Grid>

          <Paper sx={{ p: 2.5, borderRadius: 3, mb: 2.5, boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
            <Typography sx={{ fontWeight: 700, fontSize: 14, mb: 2 }}>Top clientes por monto adeudado</Typography>
            <SimpleBar labels={visible.map(c => c.client_name)} values={visible.map(c => c.total_debt_amount)} color={RED} />
          </Paper>

          {isMobile
            ? visible.map(c => <ClientCard key={c.client_id} name={c.client_name} id={c.client_id} primary={c.total_debt_amount} primaryLabel="Deuda total" color={RED} />)
            : <RankedTable data={visible} columns={COLS} order={order} orderBy={orderBy} onSort={handleSort} />
          }

          {sorted.length > 5 && (
            <Button onClick={() => setShowAll(p => !p)} sx={{ mt: 1.5, fontWeight: 600, color: RED, fontSize: 12 }}>
              {showAll ? 'Ver solo Top 5' : `Ver todos (${sorted.length})`}
            </Button>
          )}
        </>
      )}
    </Box>
  );
};

export default CustomerBuyers;
