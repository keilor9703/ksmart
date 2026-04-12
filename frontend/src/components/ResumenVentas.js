import React, { useState, useEffect } from 'react';
import apiClient from '../api';
import { formatCurrency } from '../utils/formatters';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import { Box, Paper, Typography, Grid } from '@mui/material';
import { AttachMoney, Today, CheckCircleOutline, AccountBalanceWallet } from '@mui/icons-material';
import { KpiCard, FilterPanel, LoadingState, GREEN, RED, YELLOW, BLUE } from './ReportShared';

ChartJS.register(ArcElement, Tooltip, Legend);

const ACCENT = '#F43F5E';

const ResumenVentas = ({ accentColor = ACCENT }) => {
  const [summary, setSummary]     = useState(null);
  const [loading, setLoading]     = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate]     = useState('');

  useEffect(() => { fetchSummary(); }, []); // eslint-disable-line

  const fetchSummary = async () => {
    setLoading(true);
    const params = {};
    if (startDate) params.start_date = startDate;
    if (endDate)   params.end_date   = endDate;
    try {
      const { data } = await apiClient.get('/reportes/ventas_summary', { params });
      setSummary(data);
    } catch { console.error('Error fetching sales summary'); }
    finally { setLoading(false); }
  };

  const handleClear = () => { setStartDate(''); setEndDate(''); setTimeout(fetchSummary, 0); };

  const chartData = summary ? {
    labels: ['Pagado', 'Pendiente'],
    datasets: [{
      data: [summary.total_pagado, summary.total_pendiente],
      backgroundColor: [`${GREEN}CC`, `${RED}CC`],
      borderColor: [GREEN, RED],
      borderWidth: 2,
      hoverOffset: 6,
    }],
  } : null;

  const chartOptions = {
    responsive: true, cutout: '70%',
    plugins: {
      legend: { position: 'bottom', labels: { padding: 14, font: { size: 11, weight: '600' }, boxWidth: 10, usePointStyle: true, pointStyle: 'circle' } },
      tooltip: { callbacks: { label: ctx => {
        const total = ctx.dataset.data.reduce((s, v) => s + v, 0);
        const pct = total > 0 ? ((ctx.parsed / total) * 100).toFixed(1) : 0;
        return ` ${formatCurrency(ctx.parsed)} (${pct}%)`;
      }}},
    },
  };

  return (
    <Box sx={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
      <FilterPanel
        startDate={startDate} onStartChange={setStartDate}
        endDate={endDate}     onEndChange={setEndDate}
        onFilter={fetchSummary} onClear={handleClear}
        loading={loading} accentColor={accentColor}
      />

      {loading ? <LoadingState /> : !summary ? (
        <Typography color="text.secondary" fontSize={13}>No se pudo cargar el resumen.</Typography>
      ) : (
        <Grid container spacing={2}>
          {/* KPIs — 2 por fila en mobile (xs=6), 2 por fila en tablet (sm=6) */}
          <Grid item xs={12} lg={8}>
            <Grid container spacing={1.5}>
              {[
                { label: 'Total General',   value: formatCurrency(summary.total_general),    icon: <AttachMoney />,          color: YELLOW },
                { label: 'Ventas de Hoy',   value: formatCurrency(summary.total_ventas_hoy), icon: <Today />,                color: GREEN  },
                { label: 'Total Pagado',    value: formatCurrency(summary.total_pagado),      icon: <CheckCircleOutline />,   color: BLUE   },
                { label: 'Total Pendiente', value: formatCurrency(summary.total_pendiente),   icon: <AccountBalanceWallet />, color: RED    },
              ].map(k => (
                <Grid item xs={6} sm={6} key={k.label}>
                  <KpiCard {...k} />
                </Grid>
              ))}

              {/* Barra de cobranza */}
              {summary.total_general > 0 && (
                <Grid item xs={12}>
                  <Paper sx={{ p: 2, borderRadius: 3, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography sx={{ fontWeight: 600, fontSize: 12 }}>Tasa de cobranza</Typography>
                      <Typography sx={{ fontWeight: 700, fontSize: 12, color: GREEN }}>
                        {((summary.total_pagado / summary.total_general) * 100).toFixed(1)}%
                      </Typography>
                    </Box>
                    <Box sx={{ height: 8, borderRadius: 5, bgcolor: `${RED}20`, overflow: 'hidden' }}>
                      <Box sx={{
                        height: '100%', borderRadius: 5,
                        background: `linear-gradient(90deg, ${GREEN}, #34d399)`,
                        width: `${Math.min((summary.total_pagado / summary.total_general) * 100, 100)}%`,
                        transition: 'width 0.6s ease',
                      }} />
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.8 }}>
                      <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>Pagado: {formatCurrency(summary.total_pagado)}</Typography>
                      <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>Pendiente: {formatCurrency(summary.total_pendiente)}</Typography>
                    </Box>
                  </Paper>
                </Grid>
              )}
            </Grid>
          </Grid>

          {/* Donut */}
          <Grid item xs={12} lg={4}>
            <Paper sx={{ p: 2.5, borderRadius: 3, display: 'flex', flexDirection: 'column', justifyContent: 'center', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
              <Typography sx={{ fontWeight: 700, fontSize: 14, mb: 2, textAlign: 'center' }}>Distribución de pagos</Typography>
              <Box sx={{ maxWidth: 240, mx: 'auto', position: 'relative' }}>
                <Doughnut data={chartData} options={chartOptions} />
                <Box sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -60%)', textAlign: 'center', pointerEvents: 'none' }}>
                  <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>Total</Typography>
                  <Typography sx={{ fontWeight: 800, fontSize: 14 }}>{formatCurrency(summary.total_general)}</Typography>
                </Box>
              </Box>
            </Paper>
          </Grid>
        </Grid>
      )}
    </Box>
  );
};

export default ResumenVentas;
