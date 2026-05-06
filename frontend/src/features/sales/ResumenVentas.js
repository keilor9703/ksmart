import React, { useState, useEffect } from 'react';
import apiClient from '../../api';
import { formatCurrency } from '../../utils/formatters';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import { Box, Paper, Typography, Grid, Divider } from '@mui/material';
import { 
  AttachMoney, Today, CheckCircleOutline, AccountBalanceWallet,
  TrendingDown, AccountBalance, Savings, ShoppingCart
} from '@mui/icons-material';
import { KpiCard, FilterPanel, LoadingState, GREEN, RED, YELLOW, BLUE } from '../reports/ReportShared';


ChartJS.register(ArcElement, Tooltip, Legend);

const ACCENT = '#F43F5E';
const PURPLE = '#8B5CF6';

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
      // Nota: El backend debe enviar total_compras y total_gastos en este endpoint
      const { data } = await apiClient.get('/reportes/ventas_summary', { params });
      setSummary(data);
    } catch { console.error('Error fetching financial summary'); }
    finally { setLoading(false); }
  };

  const handleClear = () => { setStartDate(''); setEndDate(''); setTimeout(fetchSummary, 0); };

  // Variables financieras seguras (fallback a 0 si el backend aún no las envía)
  const ingresosReales = summary?.total_pagado || 0;
  const comprasTotales = summary?.total_compras || 0; // Lo pagado a proveedores
  const gastosTotales  = summary?.total_gastos || 0;  // Gastos menores/operativos
  const egresosTotales = comprasTotales + gastosTotales;
  const saldoNeto      = ingresosReales - egresosTotales;
  const saldoPositivo  = saldoNeto >= 0;

  const chartData = summary ? {
    labels: ['Pagado (Caja)', 'Pendiente (Por Cobrar)'],
    datasets: [{
      data: [summary.total_pagado, summary.total_pendiente],
      backgroundColor: [`${GREEN}CC`, `${YELLOW}CC`],
      borderColor: [GREEN, YELLOW],
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
        <Typography color="text.secondary" fontSize={13}>No se pudo cargar el resumen financiero.</Typography>
      ) : (
        <Box sx={{ width: '100%' }}>
          
          {/* ── PANEL GERENCIAL: FLUJO DE CAJA NETO ── */}
          <Typography sx={{ fontWeight: 700, fontSize: 13, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.8, mb: 1.5 }}>
            Flujo de Caja (Liquidez)
          </Typography>
          
          <Paper sx={{ p: 2.5, mb: 3, borderRadius: 3, boxShadow: '0 4px 20px rgba(0,0,0,0.08)', borderTop: `4px solid ${saldoPositivo ? GREEN : RED}` }}>
            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'flex-start', md: 'center' }, gap: 2 }}>
              <Box>
                <Typography sx={{ fontSize: 13, fontWeight: 600, color: 'text.secondary', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <AccountBalance fontSize="small" /> Saldo Neto Estimado
                </Typography>
                <Typography sx={{ fontSize: 32, fontWeight: 800, color: saldoPositivo ? GREEN : RED }}>
                  {formatCurrency(saldoNeto)}
                </Typography>
                <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
                  Dinero real que te queda tras cubrir compras y gastos.
                </Typography>
              </Box>
              
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', bgcolor: 'action.hover', p: 1.5, borderRadius: 2 }}>
                <Box>
                  <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>(+) Ingresos Reales</Typography>
                  <Typography sx={{ fontSize: 14, fontWeight: 700, color: GREEN }}>{formatCurrency(ingresosReales)}</Typography>
                </Box>
                <Divider orientation="vertical" flexItem />
                <Box>
                  <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>(-) Egresos Totales</Typography>
                  <Typography sx={{ fontSize: 14, fontWeight: 700, color: RED }}>{formatCurrency(egresosTotales)}</Typography>
                </Box>
              </Box>
            </Box>

            <Divider sx={{ my: 2 }} />

            <Grid container spacing={2}>
              <Grid item xs={6} md={3}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <ShoppingCart sx={{ color: RED, fontSize: 18 }} />
                  <Box>
                    <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>Compras a Proveedores</Typography>
                    <Typography sx={{ fontSize: 13, fontWeight: 700 }}>{formatCurrency(comprasTotales)}</Typography>
                  </Box>
                </Box>
              </Grid>
              <Grid item xs={6} md={3}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <TrendingDown sx={{ color: RED, fontSize: 18 }} />
                  <Box>
                    <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>Gastos Operativos</Typography>
                    <Typography sx={{ fontSize: 13, fontWeight: 700 }}>{formatCurrency(gastosTotales)}</Typography>
                  </Box>
                </Box>
              </Grid>
              <Grid item xs={12} md={6}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, bgcolor: `${BLUE}10`, p: 1, borderRadius: 1.5 }}>
                  <Savings sx={{ color: BLUE, fontSize: 18 }} />
                  <Box sx={{ flex: 1 }}>
                    <Typography sx={{ fontSize: 10, color: BLUE, fontWeight: 600 }}>Cuentas por Cobrar (Capital Atrapado)</Typography>
                    <Typography sx={{ fontSize: 14, fontWeight: 800, color: BLUE }}>{formatCurrency(summary.total_pendiente)}</Typography>
                  </Box>
                </Box>
              </Grid>
            </Grid>
          </Paper>

          {/* ── PANEL COMERCIAL: VENTAS ── */}
          <Typography sx={{ fontWeight: 700, fontSize: 13, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.8, mb: 1.5, mt: 4 }}>
            Rendimiento Comercial
          </Typography>

          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mb: 1.5 }}>
            {[
              { label: 'Total Facturado', value: formatCurrency(summary.total_general),    icon: <AttachMoney />,          color: PURPLE },
              { label: 'Ventas de Hoy',   value: formatCurrency(summary.total_ventas_hoy), icon: <Today />,                color: GREEN  },
              { label: 'Recaudado',       value: formatCurrency(summary.total_pagado),     icon: <CheckCircleOutline />,   color: BLUE   },
              { label: 'Cartera',         value: formatCurrency(summary.total_pendiente),  icon: <AccountBalanceWallet />, color: YELLOW },
            ].map(k => (
              <Box key={k.label} sx={{ flex: '1 1 calc(50% - 6px)', minWidth: 0 }}>
                <KpiCard {...k} />
              </Box>
            ))}
          </Box>

          {/* Barra de cobranza y Donut (Misma lógica original) */}
          <Grid container spacing={2}>
            <Grid item xs={12} md={7}>
              {summary.total_general > 0 && (
                <Paper sx={{ p: 2.5, mb: 2, borderRadius: 3, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', height: '100%', boxSizing: 'border-box' }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography sx={{ fontWeight: 600, fontSize: 13 }}>Eficiencia de Cobranza</Typography>
                    <Typography sx={{ fontWeight: 800, fontSize: 14, color: GREEN }}>
                      {((summary.total_pagado / summary.total_general) * 100).toFixed(1)}%
                    </Typography>
                  </Box>
                  <Typography sx={{ fontSize: 11, color: 'text.secondary', mb: 2 }}>
                    Porcentaje de las ventas totales que ya se han convertido en dinero líquido.
                  </Typography>
                  <Box sx={{ height: 10, borderRadius: 5, bgcolor: `${YELLOW}30`, overflow: 'hidden' }}>
                    <Box sx={{
                      height: '100%', borderRadius: 5,
                      background: `linear-gradient(90deg, ${GREEN}, #34d399)`,
                      width: `${Math.min((summary.total_pagado / summary.total_general) * 100, 100)}%`,
                      transition: 'width 0.6s ease',
                    }} />
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1.5 }}>
                    <Typography sx={{ fontSize: 11, color: 'text.secondary', fontWeight: 600 }}>Pagado: <span style={{color: GREEN}}>{formatCurrency(summary.total_pagado)}</span></Typography>
                    <Typography sx={{ fontSize: 11, color: 'text.secondary', fontWeight: 600 }}>Pendiente: <span style={{color: YELLOW}}>{formatCurrency(summary.total_pendiente)}</span></Typography>
                  </Box>
                </Paper>
              )}
            </Grid>
            <Grid item xs={12} md={5}>
              <Paper sx={{ p: 2.5, borderRadius: 3, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', height: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <Typography sx={{ fontWeight: 700, fontSize: 13, mb: 1, textAlign: 'center', width: '100%' }}>Distribución de Ventas</Typography>
                <Box sx={{ width: '100%', maxWidth: 220, position: 'relative' }}>
                  <Doughnut data={chartData} options={chartOptions} />
                  <Box sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -60%)', textAlign: 'center', pointerEvents: 'none' }}>
                    <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>Facturado</Typography>
                    <Typography sx={{ fontWeight: 800, fontSize: 12 }}>{formatCurrency(summary.total_general)}</Typography>
                  </Box>
                </Box>
              </Paper>
            </Grid>
          </Grid>

        </Box>
      )}
    </Box>
  );
};

export default ResumenVentas;