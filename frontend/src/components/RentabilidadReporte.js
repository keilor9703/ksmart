import React, { useState, useEffect, useMemo } from 'react';
import {
  Box, Typography, Paper, Grid, Button, Chip,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  useMediaQuery
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { TrendingUp, TrendingDown, AttachMoney } from '@mui/icons-material';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale,
  BarElement, Title, Tooltip, Legend
} from 'chart.js';
import apiClient from '../api';
import { formatCurrency } from '../utils/formatters';
import { toast } from 'react-toastify';
import {
  FilterPanel, KpiCard, LoadingState, EmptyState, barChartDefaults,
  GREEN, BLUE, RED, REPORT_ACCENT
} from './ReportShared.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const ACCENT = '#F43F5E';

const RentCard = ({ item }) => {
  const positive = item.net_profit > 0;
  return (
    <Paper sx={{ p: 2.5, mb: 2, borderRadius: 3, boxShadow: '0 2px 10px rgba(0,0,0,0.06)', borderLeft: `4px solid ${positive ? GREEN : RED}` }}>
      <Typography sx={{ fontWeight: 700, fontSize: 14, mb: 1.5 }}>{item.product_name}</Typography>
      <Grid container spacing={1}>
        {[
          { label: 'Cantidad', val: item.total_quantity_sold,          color: 'text.primary' },
          { label: 'Ingresos', val: formatCurrency(item.total_revenue), color: BLUE           },
          { label: 'Costo',    val: formatCurrency(item.total_cost),    color: 'text.secondary'},
          { label: 'Ganancia', val: formatCurrency(item.net_profit),    color: positive ? GREEN : RED },
          { label: 'Margen',   val: `${item.profit_margin.toFixed(1)}%`,color: positive ? GREEN : RED },
        ].map(({ label, val, color }) => (
          <Grid item xs={4} key={label}>
            <Box sx={{ p: 1, borderRadius: 1.5, bgcolor: 'action.hover', textAlign: 'center' }}>
              <Typography sx={{ fontSize: 9, color: 'text.secondary' }}>{label}</Typography>
              <Typography sx={{ fontWeight: 700, fontSize: 12, color }}>{val}</Typography>
            </Box>
          </Grid>
        ))}
      </Grid>
    </Paper>
  );
};

const RentabilidadReporte = ({ accentColor = ACCENT }) => {
  const [data, setData]           = useState([]);
  const [loading, setLoading]     = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate]     = useState('');
  const [showAll, setShowAll]     = useState(false);

  const isMobile = useMediaQuery(useTheme().breakpoints.down('sm'));

  useEffect(() => { fetchData(); }, []); // eslint-disable-line

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = {};
      if (startDate) params.start_date = startDate;
      if (endDate)   params.end_date   = endDate;
      const { data: res } = await apiClient.get('/reportes/rentabilidad_productos', { params });
      setData(res);
    } catch { toast.error('Error al cargar el reporte de rentabilidad.'); }
    finally { setLoading(false); }
  };

  const handleClear = () => { setStartDate(''); setEndDate(''); setTimeout(fetchData, 0); };

  const sorted  = useMemo(() => [...data].sort((a, b) => b.net_profit - a.net_profit), [data]);
  const visible = showAll ? sorted : sorted.slice(0, 5);

  const totalProfit  = data.reduce((s, i) => s + i.net_profit, 0);
  const totalRevenue = data.reduce((s, i) => s + i.total_revenue, 0);
  const avgMargin    = data.length ? data.reduce((s, i) => s + i.profit_margin, 0) / data.length : 0;

  return (
    <Box>
      <FilterPanel
        startDate={startDate} onStartChange={setStartDate}
        endDate={endDate}     onEndChange={setEndDate}
        onFilter={fetchData}  onClear={handleClear}
        loading={loading}     accentColor={accentColor}
      />

      {loading ? <LoadingState /> : visible.length === 0 ? (
        <EmptyState icon="📊" message="No hay datos de rentabilidad para el período seleccionado." />
      ) : (
        <>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={4}>
              <KpiCard label="Ganancia neta total" value={formatCurrency(totalProfit)} icon={<TrendingUp />} color={totalProfit >= 0 ? GREEN : RED} />
            </Grid>
            <Grid item xs={12} sm={4}>
              <KpiCard label="Ingresos totales" value={formatCurrency(totalRevenue)} icon={<AttachMoney />} color={accentColor} />
            </Grid>
            <Grid item xs={12} sm={4}>
              <KpiCard label="Margen promedio" value={`${avgMargin.toFixed(1)}%`} icon={<TrendingUp />} color={avgMargin >= 0 ? GREEN : RED} />
            </Grid>
          </Grid>

          <Paper sx={{ p: 2.5, borderRadius: 3, mb: 2.5, boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
            <Typography sx={{ fontWeight: 700, fontSize: 14, mb: 2 }}>Ganancia neta por producto</Typography>
            <Box sx={{ height: 280 }}>
              <Bar
                data={{
                  labels: visible.map(i => i.product_name),
                  datasets: [{
                    label: 'Ganancia neta',
                    data: visible.map(i => i.net_profit),
                    backgroundColor: visible.map(i => i.net_profit > 0 ? `${GREEN}CC` : `${RED}CC`),
                    borderColor:     visible.map(i => i.net_profit > 0 ? GREEN : RED),
                    borderWidth: 1.5,
                    borderRadius: 6,
                    borderSkipped: false,
                  }],
                }}
                options={{
                  ...barChartDefaults(),
                  scales: { ...barChartDefaults().scales, y: { ...barChartDefaults().scales.y, ticks: { callback: v => formatCurrency(v) } } },
                }}
              />
            </Box>
          </Paper>

          {isMobile
            ? visible.map(i => <RentCard key={i.product_id} item={i} />)
            : (
              <TableContainer sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      {['#', 'Producto', 'Cant.', 'Ingresos', 'Costo', 'Ganancia neta', 'Margen'].map(h => (
                        <TableCell key={h} align={h !== 'Producto' && h !== '#' ? 'right' : 'left'}>{h}</TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {visible.map((item, i) => {
                      const pos = item.net_profit > 0;
                      return (
                        <TableRow key={item.product_id} hover>
                          <TableCell sx={{ fontWeight: 700, color: i < 3 ? accentColor : 'text.secondary', fontSize: 12 }}>{i + 1}</TableCell>
                          <TableCell sx={{ fontWeight: 600 }}>{item.product_name}</TableCell>
                          <TableCell align="right">{item.total_quantity_sold}</TableCell>
                          <TableCell align="right" sx={{ color: BLUE, fontWeight: 600 }}>{formatCurrency(item.total_revenue)}</TableCell>
                          <TableCell align="right" sx={{ color: 'text.secondary' }}>{formatCurrency(item.total_cost)}</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 700, color: pos ? GREEN : RED }}>{formatCurrency(item.net_profit)}</TableCell>
                          <TableCell align="right">
                            <Chip label={`${item.profit_margin.toFixed(1)}%`} size="small"
                              sx={{ bgcolor: pos ? `${GREEN}15` : `${RED}15`, color: pos ? GREEN : RED, fontWeight: 700, fontSize: 10, borderRadius: 1.5 }} />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            )
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

export default RentabilidadReporte;
