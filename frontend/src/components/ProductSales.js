import React, { useState, useEffect, useMemo } from 'react';
import {
  Box, Typography, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, Button, Chip, Grid, TableSortLabel, useMediaQuery
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { ShoppingCart, Settings } from '@mui/icons-material';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import apiClient from '../api';
import { formatCurrency } from '../utils/formatters';
import { toast } from 'react-toastify';
import { visuallyHidden, stableSort, getComparator } from '../utils/sortingUtils';
import { FilterPanel, KpiCard, SectionTitle, LoadingState, barChartDefaults, accentDataset, GREEN, BLUE } from './ReportShared';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const ACCENT = '#F43F5E';

const SalesCard = ({ item }) => (
  <Paper sx={{ p: 2, mb: 1.5, borderRadius: 3, boxShadow: '0 2px 10px rgba(0,0,0,0.06)', width: '100%', boxSizing: 'border-box' }}>
    <Typography sx={{ fontWeight: 700, fontSize: 14, mb: 0.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.product_name}</Typography>
    <Typography sx={{ fontSize: 11, color: 'text.secondary', mb: 1 }}>#{item.product_id}</Typography>
    <Box sx={{ display: 'flex', gap: 1 }}>
      {[{ label: 'Cantidad', val: item.total_quantity_sold }, { label: 'Ingresos', val: formatCurrency(item.total_revenue) }].map(({ label, val }) => (
        <Box key={label} sx={{ flex: 1, p: 1, borderRadius: 1.5, bgcolor: 'action.hover', textAlign: 'center' }}>
          <Typography sx={{ fontSize: 9, color: 'text.secondary' }}>{label}</Typography>
          <Typography sx={{ fontWeight: 700, fontSize: 13 }}>{val}</Typography>
        </Box>
      ))}
    </Box>
  </Paper>
);

const SortableTable = ({ data, order, orderBy, onSort, columns }) => (
  <TableContainer sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider', overflowX: 'auto' }}>
    <Table size="small">
      <TableHead>
        <TableRow>
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
          ? <TableRow><TableCell colSpan={columns.length} sx={{ textAlign: 'center', py: 5, color: 'text.secondary' }}>Sin datos</TableCell></TableRow>
          : data.map((item, i) => (
              <TableRow key={i} hover>
                {columns.map(c => (
                  <TableCell key={c.id} align={c.numeric ? 'right' : 'left'}
                    sx={{ fontWeight: c.bold ? 700 : 400, color: c.color ? c.color(item) : 'text.primary', fontSize: 13 }}>
                    {c.render ? c.render(item) : item[c.id]}
                  </TableCell>
                ))}
              </TableRow>
            ))
        }
      </TableBody>
    </Table>
  </TableContainer>
);

const ProductSales = ({ accentColor = ACCENT }) => {
  const [salesData, setSalesData] = useState({ productos: [], servicios: [] });
  const [loading, setLoading]     = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate]     = useState('');
  const [order, setOrder]         = useState('desc');
  const [orderBy, setOrderBy]     = useState('total_revenue');
  const [showAll, setShowAll]     = useState({ prod: false, serv: false });
  const isMobile = useMediaQuery(useTheme().breakpoints.down('sm'));

  useEffect(() => { fetchData(); }, []); // eslint-disable-line

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = {};
      if (startDate) params.start_date = startDate;
      if (endDate)   params.end_date   = endDate;
      const { data } = await apiClient.get('/reportes/productos_vendidos', { params });
      setSalesData(data);
    } catch { toast.error('Error al cargar el reporte de ventas por producto.'); }
    finally { setLoading(false); }
  };

  const handleClear = () => { setStartDate(''); setEndDate(''); setTimeout(fetchData, 0); };
  const handleSort  = (col) => { setOrder(prev => orderBy === col && prev === 'desc' ? 'asc' : 'desc'); setOrderBy(col); };

  const sortedProd  = useMemo(() => stableSort(salesData.productos, getComparator(order, orderBy)), [salesData.productos, order, orderBy]);
  const sortedServ  = useMemo(() => stableSort(salesData.servicios, getComparator(order, orderBy)), [salesData.servicios, order, orderBy]);
  const visibleProd = showAll.prod ? sortedProd : sortedProd.slice(0, 5);
  const visibleServ = showAll.serv ? sortedServ : sortedServ.slice(0, 5);
  const totalIngresos = [...salesData.productos, ...salesData.servicios].reduce((s, i) => s + i.total_revenue, 0);

  const COLS = [
    { id: 'product_name',       label: 'Producto', numeric: false },
    { id: 'total_quantity_sold', label: 'Cant.',    numeric: true, bold: true },
    { id: 'total_revenue',       label: 'Ingresos', numeric: true, bold: true, render: i => formatCurrency(i.total_revenue), color: () => GREEN },
  ];

  const renderSection = (title, sorted, visible, showKey, color) => (
    <Box sx={{ mb: 3, width: '100%' }}>
      <SectionTitle badge={`${sorted.length}`} color={color}>{title}</SectionTitle>
      {visible.length > 0 && (
        <Paper sx={{ p: 2, borderRadius: 3, mb: 2, boxShadow: '0 2px 10px rgba(0,0,0,0.06)', width: '100%', boxSizing: 'border-box' }}>
          <Box sx={{ height: 200, width: '100%', overflow: 'hidden' }}>
            <Bar
              data={{ labels: visible.map(i => i.product_name), datasets: [accentDataset(visible.map(i => i.total_revenue), 'Ingresos', color)] }}
              options={{ ...barChartDefaults(), scales: { ...barChartDefaults().scales, y: { ...barChartDefaults().scales.y, ticks: { callback: v => formatCurrency(v) } } } }}
            />
          </Box>
        </Paper>
      )}
      {isMobile
        ? visible.map(i => <SalesCard key={i.product_id} item={i} />)
        : <SortableTable data={visible} order={order} orderBy={orderBy} onSort={handleSort} columns={COLS} />
      }
      {sorted.length > 5 && (
        <Button onClick={() => setShowAll(p => ({ ...p, [showKey]: !p[showKey] }))} sx={{ mt: 1, fontWeight: 600, color, fontSize: 12 }}>
          {showAll[showKey] ? 'Ver solo Top 5' : `Ver todos (${sorted.length})`}
        </Button>
      )}
    </Box>
  );

  return (
    <Box sx={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
      <FilterPanel startDate={startDate} onStartChange={setStartDate} endDate={endDate} onEndChange={setEndDate} onFilter={fetchData} onClear={handleClear} loading={loading} accentColor={accentColor} />
      {loading ? <LoadingState /> : (
        <>
          {/* KPIs: 2 por fila usando flex, nunca Grid que puede desbordar */}
          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mb: 2, width: '100%' }}>
            <Box sx={{ flex: '1 1 calc(50% - 6px)', minWidth: 0 }}>
              <KpiCard label="Productos vendidos" value={salesData.productos.length} icon={<ShoppingCart />} color={accentColor} />
            </Box>
            <Box sx={{ flex: '1 1 calc(50% - 6px)', minWidth: 0 }}>
              <KpiCard label="Servicios prestados" value={salesData.servicios.length} icon={<Settings />} color={BLUE} />
            </Box>
            <Box sx={{ flex: '1 1 100%', minWidth: 0 }}>
              <KpiCard label="Total ingresos" value={formatCurrency(totalIngresos)} icon={<ShoppingCart />} color={GREEN} />
            </Box>
          </Box>
          {renderSection('Productos Vendidos', sortedProd, visibleProd, 'prod', accentColor)}
          {renderSection('Servicios Prestados', sortedServ, visibleServ, 'serv', BLUE)}
        </>
      )}
    </Box>
  );
};

export default ProductSales;
