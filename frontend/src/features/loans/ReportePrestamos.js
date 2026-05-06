import React, { useState, useEffect } from 'react';
import { Box, Grid, Paper, Typography, CircularProgress, Divider } from '@mui/material';
import { AccountBalance, Payments, TrendingUp, Timer, MonetizationOn } from '@mui/icons-material';
import apiClient from '../../api';
import { formatCurrency } from '../../utils/formatters';
import { KpiCard, GREEN, BLUE, RED, YELLOW } from '../reports/ReportShared';

const ReportePrestamos = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient.get('/reportes/financiero-prestamos')
      .then(res => setData(res.data))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}><CircularProgress /></Box>;

  const { resumen } = data;

  return (
    <Box>
      <Typography variant="h6" fontWeight={800} mb={3}>Estado Financiero de Cartera</Typography>
      
      <Grid container spacing={2} mb={4}>
        <Grid item xs={12} md={4}>
          <KpiCard label="Capital Prestado" value={formatCurrency(resumen.capital_prestado)} icon={<AccountBalance />} color={BLUE} sub="Dinero total colocado" />
        </Grid>
        <Grid item xs={12} md={4}>
          <KpiCard label="Ganancia Real (Intereses)" value={formatCurrency(resumen.intereses_recaudados)} icon={<TrendingUp />} color={GREEN} sub="Intereses ya cobrados" />
        </Grid>
        <Grid item xs={12} md={4}>
          <KpiCard label="Total en Mora" value={formatCurrency(resumen.total_en_mora)} icon={<Timer />} color={RED} sub="Capital en riesgo" />
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, borderRadius: 3 }}>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>DESGLOSE DE CAPITAL</Typography>
            <Divider sx={{ my: 1.5 }} />
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
              <Typography>Capital Recuperado</Typography>
              <Typography fontWeight={700} color={GREEN}>{formatCurrency(resumen.capital_recuperado)}</Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography>Capital Pendiente</Typography>
              <Typography fontWeight={700}>{formatCurrency(resumen.capital_pendiente)}</Typography>
            </Box>
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, borderRadius: 3 }}>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>RENDIMIENTO DE INTERESES</Typography>
            <Divider sx={{ my: 1.5 }} />
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
              <Typography>Intereses por Cobrar</Typography>
              <Typography fontWeight={700}>{formatCurrency(resumen.intereses_pendientes)}</Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography>Total Proyectado</Typography>
              <Typography fontWeight={700} color={BLUE}>{formatCurrency(resumen.intereses_esperados)}</Typography>
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default ReportePrestamos;