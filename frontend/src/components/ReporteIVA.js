import React, { useState, useEffect } from 'react';
import { Box, Typography, Paper, Grid, Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from '@mui/material';
import { TrendingUp, TrendingDown, AttachMoney } from '@mui/icons-material';
import apiClient from '../api';
import { formatCurrency } from '../utils/formatters';
import { toast } from 'react-toastify';
import { FilterPanel, KpiCard, LoadingState, GREEN, BLUE, RED } from './ReportShared';

const ACCENT = '#F43F5E';

const ReporteIVA = ({ accentColor = ACCENT }) => {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate]     = useState('');
  const [data, setData]           = useState(null);
  const [loading, setLoading]     = useState(false);

  useEffect(() => { fetchReport(); }, []); // eslint-disable-line

  const fetchReport = async () => {
    setLoading(true);
    try {
      const params = {};
      if (startDate) params.start_date = startDate;
      if (endDate)   params.end_date   = endDate;
      const { data: res } = await apiClient.get('/reportes/iva-neto', { params });
      setData(res);
    } catch { toast.error('Error al generar el reporte tributario.'); }
    finally { setLoading(false); }
  };

  const handleClear = () => { setStartDate(''); setEndDate(''); setTimeout(fetchReport, 0); };

  const ivaNeto  = data?.iva_neto_resultado ?? 0;
  const netColor = ivaNeto >= 0 ? RED : GREEN;
  const netLabel = ivaNeto >= 0 ? 'A pagar' : 'A favor';

  return (
    <Box sx={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
      <FilterPanel
        startDate={startDate} onStartChange={setStartDate}
        endDate={endDate}     onEndChange={setEndDate}
        onFilter={fetchReport} onClear={handleClear}
        loading={loading}     accentColor={accentColor}
      />

      {loading ? <LoadingState /> : !data ? null : (
        <>
          {/* KPIs — 2 por fila en mobile */}
          <Grid container spacing={1.5} sx={{ mb: 2 }}>
            <Grid item xs={6} sm={4}>
              <KpiCard label="IVA Generado" value={formatCurrency(data.iva_generado_ventas)} icon={<TrendingUp />} color={GREEN} sub="Ventas" />
            </Grid>
            <Grid item xs={6} sm={4}>
              <KpiCard label="IVA Descontable" value={formatCurrency(data.iva_descontable_compras)} icon={<TrendingDown />} color={BLUE} sub="Compras" />
            </Grid>
            <Grid item xs={12} sm={4}>
              {/* Card especial IVA Neto — ocupa fila completa en mobile */}
              <Paper sx={{
                p: 2, borderRadius: 3,
                display: 'flex', alignItems: 'center', gap: 1.5,
                boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
                bgcolor: `${netColor}08`, border: `2px solid ${netColor}30`,
                width: '100%', boxSizing: 'border-box',
              }}>
                <Box sx={{ width: 42, height: 42, borderRadius: 2, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: `${netColor}18`, color: netColor }}>
                  <AttachMoney />
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontSize: 11, color: netColor, fontWeight: 600, mb: 0.2 }}>IVA Neto — {netLabel}</Typography>
                  <Typography sx={{ fontSize: 20, fontWeight: 800, color: netColor }}>{formatCurrency(Math.abs(ivaNeto))}</Typography>
                </Box>
              </Paper>
            </Grid>
          </Grid>

          <TableContainer sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider', overflowX: 'auto' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Concepto</TableCell>
                  <TableCell align="right">Valor</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {[
                  { label: 'Ventas brutas (recaudado)',         val: data.ventas_brutas,           color: GREEN,          bold: false },
                  { label: 'Base gravable ventas',              val: data.base_gravable_ventas,    color: 'text.primary',  bold: false },
                  { label: 'IVA generado (a pagar al fisco)',   val: data.iva_generado_ventas,     color: GREEN,          bold: true  },
                  { label: 'IVA descontable (por compras)',     val: data.iva_descontable_compras, color: BLUE,           bold: true  },
                ].map(({ label, val, color, bold }) => (
                  <TableRow key={label} hover>
                    <TableCell sx={{ fontWeight: bold ? 700 : 400, fontSize: 13 }}>{label}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: bold ? 800 : 600, color, fontSize: 13 }}>{formatCurrency(val)}</TableCell>
                  </TableRow>
                ))}
                <TableRow sx={{ bgcolor: `${netColor}08` }}>
                  <TableCell sx={{ fontWeight: 800, color: netColor }}>IVA Neto — {netLabel}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 800, fontSize: 15, color: netColor }}>{formatCurrency(Math.abs(ivaNeto))}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}
    </Box>
  );
};

export default ReporteIVA;
 