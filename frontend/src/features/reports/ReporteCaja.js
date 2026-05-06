import React, { useState } from 'react';
import {
  Box, Typography, Button, TextField, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Paper, Grid, CircularProgress,
  Chip, useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { PointOfSale, TrendingUp, TrendingDown, AccountBalance } from '@mui/icons-material';
import apiClient from '../../api';
import { formatCurrency } from '../../utils/formatters';
import { toast } from 'react-toastify';

const today = () => new Date().toISOString().slice(0, 10);
const firstOfMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
};

const KpiCard = ({ label, value, icon, color, negative }) => (
  <Paper sx={{ p: 2.5, borderRadius: 3, border: '1px solid', borderColor: 'divider', flex: 1, minWidth: 160 }}>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
      <Box sx={{ width: 40, height: 40, borderRadius: 2, bgcolor: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', color }}>
        {icon}
      </Box>
      <Box>
        <Typography sx={{ fontSize: 11, color: 'text.secondary', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</Typography>
        <Typography sx={{ fontSize: 18, fontWeight: 800, color: negative ? '#EF4444' : color }}>
          {negative ? '-' : ''}{formatCurrency(value)}
        </Typography>
      </Box>
    </Box>
  </Paper>
);

const METODO_COLORS = {
  Efectivo: '#10B981', Transferencia: '#3B82F6', Tarjeta: '#8B5CF6',
  Nequi: '#FF6020', Daviplata: '#F59E0B',
};
const metodoColor = (m) => METODO_COLORS[m] || '#64748B';

const ReporteCaja = ({ accentColor = '#FF6020' }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [startDate, setStartDate] = useState(firstOfMonth());
  const [endDate, setEndDate] = useState(today());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

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

  return (
    <Box sx={{ width: '100%' }}>
      {/* Filtros */}
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
      </Box>

      {!data && !loading && (
        <Box sx={{ textAlign: 'center', py: 8, color: 'text.secondary' }}>
          <PointOfSale sx={{ fontSize: 52, mb: 1.5, opacity: 0.25 }} />
          <Typography>Selecciona un rango y presiona Generar</Typography>
        </Box>
      )}

      {data && (
        <>
          {/* KPIs */}
          <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
            <KpiCard label="Ingresos" value={data.total_ingresos} icon={<TrendingUp />} color="#10B981" />
            <KpiCard label="Egresos"  value={data.total_egresos}  icon={<TrendingDown />} color="#EF4444" negative />
            <KpiCard label="Neto"     value={Math.abs(data.neto_total)} icon={<AccountBalance />}
              color={data.neto_total >= 0 ? '#3B82F6' : '#EF4444'}
              negative={data.neto_total < 0}
            />
          </Box>

          {/* Totales por método de pago */}
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

          {/* Tabla diaria */}
          <TableContainer sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: 'action.hover' }}>
                  <TableCell sx={{ fontWeight: 700 }}>Fecha</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, color: '#10B981' }}>Ingresos</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, color: '#EF4444' }}>Egresos</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>Neto</TableCell>
                  {!isMobile && <TableCell sx={{ fontWeight: 700 }}>Métodos</TableCell>}
                </TableRow>
              </TableHead>
              <TableBody>
                {data.resumen_diario.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
                      Sin movimientos en el período
                    </TableCell>
                  </TableRow>
                ) : (
                  data.resumen_diario.map(dia => (
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
                      {!isMobile && (
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
                      )}
                    </TableRow>
                  ))
                )}
                {/* Fila de totales */}
                {data.resumen_diario.length > 0 && (
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
                    {!isMobile && <TableCell />}
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
