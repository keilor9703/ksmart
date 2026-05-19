import React, { useState, useEffect, useMemo } from 'react';
import {
  Box, Typography, Paper, Button, Chip, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, TableSortLabel, TablePagination,
  InputAdornment, TextField, useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { TrendingUp, TrendingDown, AttachMoney, FileDownload, Search } from '@mui/icons-material';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import apiClient from '../../api';
import { formatCurrency } from '../../utils/formatters';
import { toast } from 'react-toastify';
import { FilterPanel, KpiCard, LoadingState, EmptyState, barChartDefaults, GREEN, BLUE, RED } from './ReportShared';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);
const ACCENT = '#F43F5E';
const YELLOW = '#F59E0B';

const RentCard = ({ item }) => {
  const positive = item.net_profit > 0;
  return (
    <Paper sx={{ p: 2, mb: 1.5, borderRadius: 3, boxShadow: '0 2px 10px rgba(0,0,0,0.06)', borderLeft: `4px solid ${positive ? GREEN : RED}`, width: '100%', boxSizing: 'border-box' }}>
      <Typography sx={{ fontWeight: 700, fontSize: 13, mb: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.product_name}</Typography>
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        {[
          { label: 'Cantidad', val: item.total_quantity_sold,            color: 'text.primary' },
          { label: 'Ingresos', val: formatCurrency(item.total_revenue),  color: BLUE },
          { label: 'Costo',    val: formatCurrency(item.total_cost),     color: 'text.secondary' },
          { label: 'Ganancia', val: formatCurrency(item.net_profit),     color: positive ? GREEN : RED },
          { label: 'Margen',   val: `${item.profit_margin.toFixed(1)}%`, color: positive ? GREEN : RED },
        ].map(({ label, val, color }) => (
          <Box key={label} sx={{ flex: '1 1 calc(33% - 6px)', minWidth: 0, p: 0.8, borderRadius: 1.5, bgcolor: 'action.hover', textAlign: 'center' }}>
            <Typography sx={{ fontSize: 9, color: 'text.secondary' }}>{label}</Typography>
            <Typography sx={{ fontWeight: 700, fontSize: 11, color }}>{val}</Typography>
          </Box>
        ))}
      </Box>
    </Paper>
  );
};

const RentabilidadReporte = ({ accentColor = ACCENT }) => {
  const [data, setData]           = useState([]);
  const [loading, setLoading]     = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate]     = useState('');
  const [busqueda, setBusqueda]   = useState('');
  const [sortCol, setSortCol]     = useState('net_profit');
  const [sortDir, setSortDir]     = useState('desc');
  const [page, setPage]           = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(15);
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
      setPage(0);
    } catch { toast.error('Error al cargar el reporte de rentabilidad.'); }
    finally { setLoading(false); }
  };

  const handleClear = () => { setStartDate(''); setEndDate(''); setTimeout(fetchData, 0); };

  const handleSort = (col) => {
    setSortDir(prev => col === sortCol ? (prev === 'asc' ? 'desc' : 'asc') : 'desc');
    setSortCol(col);
    setPage(0);
  };

  const sorted = useMemo(() => {
    let list = [...data];
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase();
      list = list.filter(i => i.product_name.toLowerCase().includes(q));
    }
    list.sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      switch (sortCol) {
        case 'nombre':    return dir * a.product_name.localeCompare(b.product_name);
        case 'cantidad':  return dir * (a.total_quantity_sold - b.total_quantity_sold);
        case 'ingresos':  return dir * (a.total_revenue - b.total_revenue);
        case 'costo':     return dir * (a.total_cost - b.total_cost);
        case 'margen':    return dir * (a.profit_margin - b.profit_margin);
        default:          return dir * (a.net_profit - b.net_profit);
      }
    });
    return list;
  }, [data, busqueda, sortCol, sortDir]);

  const paginated = useMemo(() =>
    sorted.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage),
    [sorted, page, rowsPerPage]
  );

  const chartVisible = sorted.slice(0, 10);
  const totalProfit  = data.reduce((s, i) => s + i.net_profit, 0);
  const totalRevenue = data.reduce((s, i) => s + i.total_revenue, 0);
  const totalCost    = data.reduce((s, i) => s + i.total_cost, 0);
  const avgMargin    = data.length ? data.reduce((s, i) => s + i.profit_margin, 0) / data.length : 0;
  const productosRentables = data.filter(i => i.net_profit > 0).length;

  const handleExportCSV = () => {
    if (!sorted.length) return;
    const rows = [
      ['#', 'Producto', 'Cantidad vendida', 'Ingresos', 'Costo', 'Ganancia neta', 'Margen %'],
      ...sorted.map((item, i) => [
        i + 1,
        item.product_name,
        item.total_quantity_sold,
        item.total_revenue,
        item.total_cost,
        item.net_profit,
        item.profit_margin.toFixed(2),
      ]),
      ['', 'TOTALES', '', totalRevenue, totalCost, totalProfit, avgMargin.toFixed(2)],
    ];
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'rentabilidad-productos.csv';
    a.click(); URL.revokeObjectURL(url);
  };

  const SortTh = ({ col, children, align = 'left' }) => (
    <TableCell align={align}>
      <TableSortLabel active={sortCol === col} direction={sortCol === col ? sortDir : 'asc'} onClick={() => handleSort(col)}>
        {children}
      </TableSortLabel>
    </TableCell>
  );

  return (
    <Box sx={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
      <FilterPanel
        startDate={startDate} onStartChange={setStartDate}
        endDate={endDate}     onEndChange={setEndDate}
        onFilter={fetchData}  onClear={handleClear}
        loading={loading}     accentColor={accentColor}
      />

      {loading ? <LoadingState /> : sorted.length === 0 && !busqueda ? (
        <EmptyState icon="📊" message="No hay datos de rentabilidad para el período seleccionado." />
      ) : (
        <>
          {/* KPIs */}
          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mb: 2, width: '100%' }}>
            <Box sx={{ flex: '1 1 calc(50% - 6px)', minWidth: 0 }}>
              <KpiCard label="Ganancia neta" value={formatCurrency(totalProfit)} icon={<TrendingUp />} color={totalProfit >= 0 ? GREEN : RED} sub={`${productosRentables} de ${data.length} rentables`} />
            </Box>
            <Box sx={{ flex: '1 1 calc(50% - 6px)', minWidth: 0 }}>
              <KpiCard label="Ingresos totales" value={formatCurrency(totalRevenue)} icon={<AttachMoney />} color={accentColor} />
            </Box>
            <Box sx={{ flex: '1 1 calc(50% - 6px)', minWidth: 0 }}>
              <KpiCard label="CMV (costo ventas)" value={formatCurrency(totalCost)} icon={<TrendingDown />} color={RED} sub={`${totalRevenue > 0 ? (totalCost / totalRevenue * 100).toFixed(1) : 0}% de ingresos`} />
            </Box>
            <Box sx={{ flex: '1 1 calc(50% - 6px)', minWidth: 0 }}>
              <KpiCard label="Margen promedio" value={`${avgMargin.toFixed(1)}%`} icon={<TrendingUp />} color={avgMargin >= 30 ? GREEN : avgMargin >= 10 ? YELLOW : RED} />
            </Box>
          </Box>

          {/* Bar chart */}
          {chartVisible.length > 0 && (
            <Paper sx={{ p: 2, borderRadius: 3, mb: 2, boxShadow: '0 2px 10px rgba(0,0,0,0.06)', width: '100%', boxSizing: 'border-box' }}>
              <Typography sx={{ fontWeight: 700, fontSize: 13, mb: 1.5 }}>Ganancia neta por producto (Top 10)</Typography>
              <Box sx={{ height: 200, width: '100%', overflow: 'hidden' }}>
                <Bar
                  data={{
                    labels: chartVisible.map(i => i.product_name.length > 16 ? i.product_name.slice(0, 14) + '…' : i.product_name),
                    datasets: [{
                      label: 'Ganancia neta',
                      data: chartVisible.map(i => i.net_profit),
                      backgroundColor: chartVisible.map(i => i.net_profit > 0 ? `${GREEN}CC` : `${RED}CC`),
                      borderColor: chartVisible.map(i => i.net_profit > 0 ? GREEN : RED),
                      borderWidth: 1.5, borderRadius: 6, borderSkipped: false,
                    }],
                  }}
                  options={{
                    ...barChartDefaults(),
                    scales: {
                      ...barChartDefaults().scales,
                      y: { ...barChartDefaults().scales.y, ticks: { callback: v => formatCurrency(v) } },
                    },
                  }}
                />
              </Box>
            </Paper>
          )}

          {/* Search + export toolbar */}
          <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
            <TextField
              size="small"
              placeholder="Buscar producto…"
              value={busqueda}
              onChange={e => { setBusqueda(e.target.value); setPage(0); }}
              InputProps={{ startAdornment: <InputAdornment position="start"><Search sx={{ fontSize: 18, color: 'text.disabled' }} /></InputAdornment> }}
              sx={{ flex: 1, minWidth: isMobile ? '100%' : 220 }}
            />
            <Button
              size="small" variant="outlined" startIcon={<FileDownload />}
              onClick={handleExportCSV} disabled={sorted.length === 0}
              sx={{ borderRadius: 2, fontWeight: 600, whiteSpace: 'nowrap' }}
            >
              CSV
            </Button>
          </Box>

          {isMobile ? (
            sorted.map(i => <RentCard key={i.product_id} item={i} />)
          ) : (
            <>
              <TableContainer sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider', overflowX: 'auto' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: 'action.hover' }}>
                      <TableCell sx={{ fontWeight: 700 }}>#</TableCell>
                      <SortTh col="nombre">Producto</SortTh>
                      <SortTh col="cantidad" align="right">Cant.</SortTh>
                      <SortTh col="ingresos" align="right">Ingresos</SortTh>
                      <SortTh col="costo" align="right">Costo</SortTh>
                      <SortTh col="net_profit" align="right">Ganancia</SortTh>
                      <SortTh col="margen" align="right">Margen</SortTh>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {paginated.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
                          Sin resultados para "{busqueda}"
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginated.map((item, i) => {
                        const globalIdx = page * rowsPerPage + i;
                        const pos = item.net_profit > 0;
                        return (
                          <TableRow key={item.product_id} hover>
                            <TableCell sx={{ fontWeight: 700, color: globalIdx < 3 ? accentColor : 'text.secondary', fontSize: 12 }}>
                              {globalIdx + 1}
                            </TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>{item.product_name}</TableCell>
                            <TableCell align="right">{item.total_quantity_sold}</TableCell>
                            <TableCell align="right" sx={{ color: BLUE, fontWeight: 600 }}>{formatCurrency(item.total_revenue)}</TableCell>
                            <TableCell align="right" sx={{ color: 'text.secondary' }}>{formatCurrency(item.total_cost)}</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700, color: pos ? GREEN : RED }}>{formatCurrency(item.net_profit)}</TableCell>
                            <TableCell align="right">
                              <Chip
                                label={`${item.profit_margin.toFixed(1)}%`}
                                size="small"
                                sx={{ bgcolor: pos ? `${GREEN}15` : `${RED}15`, color: pos ? GREEN : RED, fontWeight: 700, fontSize: 10, borderRadius: 1.5 }}
                              />
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                    {/* Totals row */}
                    {paginated.length > 0 && (
                      <TableRow sx={{ bgcolor: 'action.selected' }}>
                        <TableCell colSpan={3} sx={{ fontWeight: 800, fontSize: 12 }}>TOTAL ({sorted.length} productos)</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 800, color: BLUE }}>{formatCurrency(totalRevenue)}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 800, color: 'text.secondary' }}>{formatCurrency(totalCost)}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 800, color: totalProfit >= 0 ? GREEN : RED }}>{formatCurrency(totalProfit)}</TableCell>
                        <TableCell align="right">
                          <Chip
                            label={`${avgMargin.toFixed(1)}%`}
                            size="small"
                            sx={{ bgcolor: avgMargin >= 30 ? `${GREEN}15` : `${RED}15`, color: avgMargin >= 30 ? GREEN : RED, fontWeight: 700, fontSize: 10, borderRadius: 1.5 }}
                          />
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
              <TablePagination
                component="div"
                count={sorted.length}
                page={page}
                onPageChange={(_, p) => setPage(p)}
                rowsPerPage={rowsPerPage}
                onRowsPerPageChange={e => { setRowsPerPage(parseInt(e.target.value)); setPage(0); }}
                rowsPerPageOptions={[10, 15, 25, 50]}
                labelRowsPerPage="Filas:"
                labelDisplayedRows={({ from, to, count }) => `${from}-${to} de ${count}`}
              />
            </>
          )}
        </>
      )}
    </Box>
  );
};

export default RentabilidadReporte;
