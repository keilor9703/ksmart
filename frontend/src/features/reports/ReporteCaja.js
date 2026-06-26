import React, { useState, useEffect, useMemo } from 'react';
import {
  Box, Typography, Button, TextField, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Paper, CircularProgress,
  Chip, TableSortLabel, Stack,
} from '@mui/material';
import {
  PointOfSale, TrendingUp, TrendingDown, AccountBalance,
  FileDownload, CalendarToday,
} from '@mui/icons-material';
import apiClient from '../../api';
import { formatCurrency } from '../../utils/formatters';
import { toast } from 'react-toastify';

const pad = n => String(n).padStart(2, '0');
const fmt = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = () => fmt(new Date());
const firstOfMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`;
};

const KpiCard = ({ label, value, icon, color, negative, sub }) => (
  <Paper sx={{ p: 2.5, borderRadius: 3, border: '1px solid', borderColor: 'divider', flex: 1, minWidth: 160 }}>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
      <Box sx={{ width: 40, height: 40, borderRadius: 2, bgcolor: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', color }}>
        {icon}
      </Box>
      <Box>
        <Typography sx={{ fontSize: 11, color: 'text.secondary', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</Typography>
        <Typography sx={{ fontSize: 18, fontWeight: 800, color: negative ? '#EF4444' : color }}>
          {negative ? '-' : ''}{value}
        </Typography>
        {sub && <Typography sx={{ fontSize: 11, color: 'text.secondary', mt: 0.3 }}>{sub}</Typography>}
      </Box>
    </Box>
  </Paper>
);

const METODO_COLORS = {
  Efectivo: '#10B981', Transferencia: '#3B82F6', Tarjeta: '#8B5CF6',
  Nequi: '#6366F1', Daviplata: '#F59E0B',
};
const metodoColor = (m) => METODO_COLORS[m] || '#64748B';

const PRESETS = [
  { key: 'hoy', label: 'Hoy' },
  { key: 'semana', label: 'Esta semana' },
  { key: 'mes', label: 'Este mes' },
  { key: 'mes_ant', label: 'Mes anterior' },
];

const ReporteCaja = ({ accentColor = '#6366F1' }) => {

  const [startDate, setStartDate] = useState(firstOfMonth());
  const [endDate, setEndDate] = useState(today());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sortCol, setSortCol] = useState('fecha');
  const [sortDir, setSortDir] = useState('asc');

  const fetchReport = async () => {
    if (!startDate || !endDate) { toast.warning('Selecciona un rango de fechas'); return; }
    setLoading(true);
    try {
      const res = await apiClient.get('/reportes/caja-rango', {
        params: { start_date: startDate, end_date: endDate },
      });
      setData(res.data);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al cargar el reporte');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchReport(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const setPreset = (preset) => {
    const now = new Date();
    if (preset === 'hoy') {
      setStartDate(today()); setEndDate(today());
    } else if (preset === 'semana') {
      const d = new Date(now); d.setDate(now.getDate() - 6);
      setStartDate(fmt(d)); setEndDate(today());
    } else if (preset === 'mes') {
      setStartDate(firstOfMonth()); setEndDate(today());
    } else if (preset === 'mes_ant') {
      const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const last  = new Date(now.getFullYear(), now.getMonth(), 0);
      setStartDate(fmt(first)); setEndDate(fmt(last));
    }
  };

  const handleSort = (col) => {
    setSortDir(prev => col === sortCol ? (prev === 'asc' ? 'desc' : 'asc') : 'asc');
    setSortCol(col);
  };

  const sortedDias = useMemo(() => {
    if (!data) return [];
    return [...data.resumen_diario].sort((a, b) => {
      let va, vb;
      switch (sortCol) {
        case 'ingresos': va = a.ingresos; vb = b.ingresos; break;
        case 'egresos':  va = a.egresos;  vb = b.egresos;  break;
        case 'neto':     va = a.neto;     vb = b.neto;     break;
        default: va = new Date(a.fecha); vb = new Date(b.fecha);
      }
      return sortDir === 'asc' ? va - vb : vb - va;
    });
  }, [data, sortCol, sortDir]);

  const promedioDiario = data && data.resumen_diario.length > 0
    ? data.total_ingresos / data.resumen_diario.length
    : 0;

  const mejorDia = data && data.resumen_diario.length > 0
    ? data.resumen_diario.reduce((best, d) => d.ingresos > best.ingresos ? d : best, data.resumen_diario[0])
    : null;

  const handleExportCSV = () => {
    if (!data) return;
    const rows = [
      ['Fecha', 'Ingresos', 'Egresos', 'Neto'],
      ...sortedDias.map(d => [d.fecha, d.ingresos, d.egresos, d.neto]),
      ['TOTAL', data.total_ingresos, data.total_egresos, data.neto_total],
    ];
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'reporte-caja.csv';
    a.click(); URL.revokeObjectURL(url);
  };

  return (
    <Box sx={{ width: '100%' }}>
      <Box sx={{ mb: 2 }}>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          {PRESETS.map(p => (
            <Chip
              key={p.key}
              label={p.label}
              size="small"
              variant="outlined"
              icon={<CalendarToday sx={{ fontSize: '14px !important' }} />}
              onClick={() => { setPreset(p.key); setTimeout(fetchReport, 0); }}
              sx={{ borderRadius: 1.5, fontWeight: 600, cursor: 'pointer' }}
            />
          ))}
        </Stack>
      </Box>

      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <TextField
          label="Desde"
          type="date"
          size="small"
          value={startDate}
          onChange={e => setStartDate(e.target.value)}
          InputLabelProps={{ shrink: true }}
          sx={{ minWidth: 150 }}
        />
        <TextField
          label="Hasta"
          type="date"
          size="small"
          value={endDate}
          onChange={e => setEndDate(e.target.value)}
          InputLabelProps={{ shrink: true }}
          sx={{ minWidth: 150 }}
        />
        <Button
          variant="contained"
          onClick={fetchReport}
          disabled={loading}
          startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <PointOfSale />}
          sx={{ bgcolor: accentColor, '&:hover': { bgcolor: accentColor }, borderRadius: 2, fontWeight: 600 }}
        >
          {loading ? 'Cargando…' : 'Generar'}
        </Button>
        <Button
          variant="outlined"
          startIcon={<FileDownload />}
          onClick={handleExportCSV}
          disabled={!data}
          sx={{ borderRadius: 2, fontWeight: 600 }}
        >
          CSV
        </Button>
      </Box>

      {!data && !loading && (
        <Box sx={{ textAlign: 'center', py: 8, color: 'text.secondary' }}>
          <PointOfSale sx={{ fontSize: 52, mb: 1.5, opacity: 0.25 }} />
          <Typography>Selecciona un rango y presiona Generar</Typography>
        </Box>
      )}

      {loading && !data && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress sx={{ color: accentColor }} />
        </Box>
      )}

      {data && (
        <>
          <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
            <KpiCard label="Ingresos" value={formatCurrency(data.total_ingresos)} icon={<TrendingUp />} color="#10B981" />
            <KpiCard label="Egresos" value={formatCurrency(data.total_egresos)} icon={<TrendingDown />} color="#EF4444" negative />
            <KpiCard
              label="Neto"
              value={formatCurrency(Math.abs(data.neto_total))}
              icon={<AccountBalance />}
              color={data.neto_total >= 0 ? '#3B82F6' : '#EF4444'}
              negative={data.neto_total < 0}
            />
            <KpiCard
              label="Promedio Diario"
              value={formatCurrency(promedioDiario)}
              icon={<CalendarToday />}
              color="#F59E0B"
            />
            {mejorDia && (
              <KpiCard
                label="Mejor Día"
                value={mejorDia.fecha}
                icon={<TrendingUp />}
                color={accentColor}
                sub={formatCurrency(mejorDia.ingresos)}
              />
            )}
          </Box>

          {Object.keys(data.totales_por_metodo).length > 0 && (
            <Box sx={{ mb: 3 }}>
              <Typography sx={{ fontSize: 11, fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.6, mb: 1 }}>
                Ingresos por método de pago
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {Object.entries(data.totales_por_metodo).map(([metodo, total]) => (
                  <Chip
                    key={metodo}
                    label={`${metodo}: ${formatCurrency(total)}`}
                    size="small"
                    sx={{ bgcolor: `${metodoColor(metodo)}15`, color: metodoColor(metodo), fontWeight: 700, borderRadius: 1.5 }}
                  />
                ))}
              </Box>
            </Box>
          )}

          <TableContainer component={Paper} sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider', overflowX: 'auto' }}>
            <Table size="small" sx={{ minWidth: 500 }}>
              <TableHead>
                <TableRow sx={{ bgcolor: 'action.hover' }}>
                  <TableCell sx={{ fontWeight: 700 }}>
                    <TableSortLabel
                      active={sortCol === 'fecha'}
                      direction={sortCol === 'fecha' ? sortDir : 'asc'}
                      onClick={() => handleSort('fecha')}
                    >
                      Fecha
                    </TableSortLabel>
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, color: '#10B981' }}>
                    <TableSortLabel
                      active={sortCol === 'ingresos'}
                      direction={sortCol === 'ingresos' ? sortDir : 'asc'}
                      onClick={() => handleSort('ingresos')}
                    >
                      Ingresos
                    </TableSortLabel>
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, color: '#EF4444' }}>
                    <TableSortLabel
                      active={sortCol === 'egresos'}
                      direction={sortCol === 'egresos' ? sortDir : 'asc'}
                      onClick={() => handleSort('egresos')}
                    >
                      Egresos
                    </TableSortLabel>
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>
                    <TableSortLabel
                      active={sortCol === 'neto'}
                      direction={sortCol === 'neto' ? sortDir : 'asc'}
                      onClick={() => handleSort('neto')}
                    >
                      Neto
                    </TableSortLabel>
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Métodos</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {sortedDias.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
                      Sin movimientos en el período
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedDias.map(dia => (
                    <TableRow key={dia.fecha} hover>
                      <TableCell sx={{ fontWeight: 600 }}>{dia.fecha}</TableCell>
                      <TableCell align="right" sx={{ color: '#10B981', fontWeight: 600 }}>
                        {formatCurrency(dia.ingresos)}
                      </TableCell>
                      <TableCell align="right" sx={{ color: '#EF4444' }}>
                        {dia.egresos > 0 ? `-${formatCurrency(dia.egresos)}` : '—'}
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, color: dia.neto >= 0 ? '#3B82F6' : '#EF4444' }}>
                        {formatCurrency(dia.neto)}
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                          {Object.entries(dia.por_metodo).map(([m, v]) => (
                            <Chip
                              key={m}
                              label={`${m} ${formatCurrency(v)}`}
                              size="small"
                              sx={{ bgcolor: `${metodoColor(m)}12`, color: metodoColor(m), fontSize: 10, fontWeight: 600, borderRadius: 1, height: 20 }}
                            />
                          ))}
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))
                )}
                {sortedDias.length > 0 && (
                  <TableRow sx={{ bgcolor: 'action.selected' }}>
                    <TableCell sx={{ fontWeight: 800 }}>TOTAL</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 800, color: '#10B981' }}>
                      {formatCurrency(data.total_ingresos)}
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 800, color: '#EF4444' }}>
                      {data.total_egresos > 0 ? `-${formatCurrency(data.total_egresos)}` : '—'}
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 800, color: data.neto_total >= 0 ? '#3B82F6' : '#EF4444' }}>
                      {formatCurrency(data.neto_total)}
                    </TableCell>
                    <TableCell />
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}
    </Box>
  );
};

export default ReporteCaja;
