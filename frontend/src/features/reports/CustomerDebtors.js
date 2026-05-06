import React, { useState, useEffect, useMemo } from 'react';
import { Box, Typography, Paper, Button, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TableSortLabel, useMediaQuery } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { People, AccountBalanceWallet, TrendingDown } from '@mui/icons-material';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import apiClient from '../../api';
import { formatCurrency } from '../../utils/formatters';
import { toast } from 'react-toastify';
import { visuallyHidden, stableSort, getComparator } from '../../utils/sortingUtils';
import { KpiCard, LoadingState, barChartDefaults, accentDataset, RED, YELLOW } from './ReportShared';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);
const ACCENT = '#F43F5E';

const ClientCard = ({ name, id, primary, primaryLabel, color }) => (
  <Paper sx={{ p: 2, mb: 1.5, borderRadius: 3, boxShadow: '0 2px 10px rgba(0,0,0,0.06)', width: '100%', boxSizing: 'border-box' }}>
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography sx={{ fontWeight: 700, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</Typography>
        <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>#{id}</Typography>
      </Box>
      <Box sx={{ textAlign: 'right', flexShrink: 0, ml: 1 }}>
        <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>{primaryLabel}</Typography>
        <Typography sx={{ fontWeight: 800, fontSize: 15, color }}>{formatCurrency(primary)}</Typography>
      </Box>
    </Box>
  </Paper>
);

const RankedTable = ({ data, columns, order, orderBy, onSort }) => (
  <TableContainer sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider', overflowX: 'auto' }}>
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell sx={{ width: 32 }}>#</TableCell>
          {columns.map(c => (
            <TableCell key={c.id} align={c.numeric ? 'right' : 'left'}>
              <TableSortLabel active={orderBy === c.id} direction={orderBy === c.id ? order : 'asc'} onClick={() => onSort(c.id)}>
                {c.label}
                {orderBy === c.id && <Box component="span" sx={visuallyHidden}>{order === 'desc' ? 'desc' : 'asc'}</Box>}
              </TableSortLabel>
            </TableCell>
          ))}
        </TableRow>
      </TableHead>
      <TableBody>
        {data.length === 0
          ? <TableRow><TableCell colSpan={columns.length + 1} sx={{ textAlign: 'center', py: 5, color: 'text.secondary' }}>Sin datos</TableCell></TableRow>
          : data.map((row, i) => (
              <TableRow key={i} hover>
                <TableCell sx={{ fontWeight: 700, color: i < 3 ? ACCENT : 'text.secondary', fontSize: 12 }}>{i + 1}</TableCell>
                {columns.map(c => (
                  <TableCell key={c.id} align={c.numeric ? 'right' : 'left'}
                    sx={{ fontWeight: c.bold ? 700 : 400, color: c.color ? c.color(row) : 'text.primary', fontSize: 13 }}>
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

const CustomerDebtors = ({ accentColor = ACCENT }) => {
  const [data, setData]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [order, setOrder]     = useState('desc');
  const [orderBy, setOrderBy] = useState('total_debt_amount');
  const [showAll, setShowAll] = useState(false);
  const isMobile = useMediaQuery(useTheme().breakpoints.down('sm'));

  useEffect(() => { fetchData(); }, []); // eslint-disable-line

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: res } = await apiClient.get('/reportes/clientes_deudores');
      setData(res);
    } catch { toast.error('Error al cargar clientes deudores.'); }
    finally { setLoading(false); }
  };

  const handleSort = (col) => { setOrder(p => orderBy === col && p === 'desc' ? 'asc' : 'desc'); setOrderBy(col); };
  const sorted     = useMemo(() => stableSort(data, getComparator(order, orderBy)), [data, order, orderBy]);
  const visible    = showAll ? sorted : sorted.slice(0, 5);
  const totalDeuda = data.reduce((s, c) => s + c.total_debt_amount, 0);

  const COLS = [
    { id: 'client_name',       label: 'Cliente',    numeric: false, bold: true },
    { id: 'total_debt_amount', label: 'Deuda total', numeric: true,  bold: true, render: r => formatCurrency(r.total_debt_amount), color: () => RED },
  ];

  if (loading) return <LoadingState />;

  if (data.length === 0) return (
    <Box sx={{ textAlign: 'center', py: 6 }}>
      <Typography sx={{ fontSize: 44, mb: 1.5 }}>✅</Typography>
      <Typography sx={{ fontWeight: 700, fontSize: 17, mb: 0.5 }}>¡Sin deudores!</Typography>
      <Typography sx={{ color: 'text.secondary', fontSize: 13 }}>Todos los clientes están al día.</Typography>
    </Box>
  );

  return (
    <Box sx={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
      <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mb: 2, width: '100%' }}>
        <Box sx={{ flex: '1 1 calc(50% - 6px)', minWidth: 0 }}>
          <KpiCard label="Clientes deudores" value={data.length} icon={<People />} color={RED} />
        </Box>
        <Box sx={{ flex: '1 1 calc(50% - 6px)', minWidth: 0 }}>
          <KpiCard label="Deuda total" value={formatCurrency(totalDeuda)} icon={<AccountBalanceWallet />} color={RED} />
        </Box>
        <Box sx={{ flex: '1 1 100%', minWidth: 0 }}>
          <KpiCard label="Deuda promedio" value={formatCurrency(data.length ? totalDeuda / data.length : 0)} icon={<TrendingDown />} color={YELLOW} />
        </Box>
      </Box>

      <Paper sx={{ p: 2, borderRadius: 3, mb: 2, boxShadow: '0 2px 10px rgba(0,0,0,0.06)', width: '100%', boxSizing: 'border-box' }}>
        <Typography sx={{ fontWeight: 700, fontSize: 13, mb: 1.5 }}>Top clientes por monto adeudado</Typography>
        <Box sx={{ height: 200, width: '100%', overflow: 'hidden' }}>
          <Bar data={{ labels: visible.map(c => c.client_name), datasets: [accentDataset(visible.map(c => c.total_debt_amount), '', RED)] }}
            options={{ ...barChartDefaults(), scales: { ...barChartDefaults().scales, y: { ...barChartDefaults().scales.y, ticks: { callback: v => formatCurrency(v) } } } }} />
        </Box>
      </Paper>

      {isMobile
        ? visible.map(c => <ClientCard key={c.client_id} name={c.client_name} id={c.client_id} primary={c.total_debt_amount} primaryLabel="Deuda total" color={RED} />)
        : <RankedTable data={visible} columns={COLS} order={order} orderBy={orderBy} onSort={handleSort} />
      }
      {sorted.length > 5 && (
        <Button onClick={() => setShowAll(p => !p)} sx={{ mt: 1, fontWeight: 600, color: RED, fontSize: 12 }}>
          {showAll ? 'Ver solo Top 5' : `Ver todos (${sorted.length})`}
        </Button>
      )}
    </Box>
  );
};

export default CustomerDebtors;
