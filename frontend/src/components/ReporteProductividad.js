import React, { useState, useMemo } from 'react';
import {
  Box, Typography, Paper, Grid, Button, TextField,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Collapse, IconButton, Divider, useMediaQuery
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { TrendingUp, AttachMoney, Engineering, KeyboardArrowDown, KeyboardArrowUp } from '@mui/icons-material';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale,
  BarElement, Title, Tooltip, Legend
} from 'chart.js';
import apiClient from '../api';
import { formatCurrency } from '../utils/formatters';
import { toast } from 'react-toastify';
import {
  KpiCard, EmptyState, barChartDefaults, accentDataset,
  GREEN, BLUE, REPORT_ACCENT
} from './ReportShared';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const ACCENT = '#F43F5E';

// ─── Fila expandible desktop ──────────────────────────────────────────────────
const OperadorRow = ({ row }) => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <TableRow hover>
        <TableCell sx={{ width: 40 }}>
          <IconButton size="small" onClick={() => setOpen(p => !p)}>
            {open ? <KeyboardArrowUp fontSize="small" /> : <KeyboardArrowDown fontSize="small" />}
          </IconButton>
        </TableCell>
        <TableCell sx={{ fontWeight: 600 }}>{row.operador_username}</TableCell>
        <TableCell align="right" sx={{ fontWeight: 700, color: GREEN }}>{formatCurrency(row.total_ganado)}</TableCell>
      </TableRow>
      <TableRow>
        <TableCell colSpan={3} sx={{ p: 0, border: 0 }}>
          <Collapse in={open} unmountOnExit>
            <Box sx={{ p: 2, bgcolor: 'action.hover' }}>
              {row.desglose_unidades?.length > 0 && (
                <Box sx={{ mb: 2 }}>
                  <Typography sx={{ fontWeight: 600, fontSize: 11, mb: 1, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Unidades por Servicio
                  </Typography>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        {['Servicio', 'Unidades', 'Valor'].map(h => (
                          <TableCell key={h} align={h !== 'Servicio' ? 'right' : 'left'}>{h}</TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {row.desglose_unidades.map((s, i) => (
                        <TableRow key={i}>
                          <TableCell>{s.servicio_nombre}</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 600 }}>{s.total_unidades}</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 600, color: GREEN }}>{formatCurrency(s.total_valor ?? 0)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Box>
              )}
              <Typography sx={{ fontWeight: 600, fontSize: 11, mb: 1, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Desglose por Orden
              </Typography>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    {['Orden ID', 'Servicio', 'Valor'].map(h => (
                      <TableCell key={h} align={h === 'Valor' ? 'right' : 'left'}>{h}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {row.desglose.map((item, i) => (
                    <TableRow key={i}>
                      <TableCell sx={{ fontSize: 12 }}>#{item.orden_id}</TableCell>
                      <TableCell sx={{ fontSize: 12 }}>{item.servicio_nombre}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600 }}>{formatCurrency(item.valor_ganado)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
};

// ─── Card mobile ──────────────────────────────────────────────────────────────
const OperadorCard = ({ row }) => {
  const [open, setOpen] = useState(false);
  return (
    <Paper sx={{ mb: 2, borderRadius: 3, overflow: 'hidden', boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
      <Box
        onClick={() => setOpen(p => !p)}
        sx={{ p: 2.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}
      >
        <Box>
          <Typography sx={{ fontWeight: 700, fontSize: 14 }}>{row.operador_username}</Typography>
          <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{row.desglose.length} órdenes</Typography>
        </Box>
        <Box sx={{ textAlign: 'right' }}>
          <Typography sx={{ fontWeight: 800, fontSize: 16, color: GREEN }}>{formatCurrency(row.total_ganado)}</Typography>
          {open ? <KeyboardArrowUp fontSize="small" sx={{ color: 'text.secondary' }} /> : <KeyboardArrowDown fontSize="small" sx={{ color: 'text.secondary' }} />}
        </Box>
      </Box>
      <Collapse in={open}>
        <Divider />
        <Box sx={{ p: 2 }}>
          {row.desglose_unidades?.map((s, i) => (
            <Box key={i} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.8, borderBottom: '1px solid', borderColor: 'divider' }}>
              <Typography sx={{ fontSize: 12 }}>{s.servicio_nombre}</Typography>
              <Typography sx={{ fontWeight: 600, fontSize: 12, color: GREEN }}>{formatCurrency(s.total_valor ?? 0)}</Typography>
            </Box>
          ))}
        </Box>
      </Collapse>
    </Paper>
  );
};

// ─── Componente principal ──────────────────────────────────────────────────────
const ReporteProductividad = ({ accentColor = ACCENT }) => {
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate]     = useState(new Date().toISOString().split('T')[0]);
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading]     = useState(false);
  const [showAll, setShowAll]     = useState(false);

  const isMobile = useMediaQuery(useTheme().breakpoints.down('sm'));

  const fetchData = () => {
    setLoading(true);
    apiClient.get('/reportes/productividad', { params: { start_date: startDate, end_date: endDate } })
      .then(res => {
        setReportData(res.data);
        if (!res.data.reporte.length) toast.info('Sin datos de productividad para este período.');
      })
      .catch(err => toast.error(err.response?.data?.detail || 'Error al generar el reporte.'))
      .finally(() => setLoading(false));
  };

  const sorted  = useMemo(() => reportData ? [...reportData.reporte].sort((a, b) => b.total_ganado - a.total_ganado) : [], [reportData]);
  const visible = showAll ? sorted : sorted.slice(0, 5);
  const totalProductividad = useMemo(() => sorted.reduce((s, r) => s + r.total_ganado, 0), [sorted]);

  return (
    <Box>
      {/* Filtros */}
      <Paper sx={{ p: 2.5, mb: 3, borderRadius: 2.5, border: '1px solid', borderColor: 'divider', boxShadow: 'none' }}>
        <Grid container spacing={2} alignItems="flex-end">
          <Grid item xs={6} md={4}>
            <TextField type="date" label="Fecha inicio" value={startDate}
              onChange={e => setStartDate(e.target.value)} InputLabelProps={{ shrink: true }} fullWidth size="small" />
          </Grid>
          <Grid item xs={6} md={4}>
            <TextField type="date" label="Fecha fin" value={endDate}
              onChange={e => setEndDate(e.target.value)} InputLabelProps={{ shrink: true }} fullWidth size="small" />
          </Grid>
          <Grid item xs={12} md={4}>
            <Button variant="contained" onClick={fetchData} disabled={loading} fullWidth
              sx={{
                background: `linear-gradient(135deg, ${accentColor}, #fb7185)`,
                boxShadow: `0 4px 14px rgba(244,63,94,0.25)`,
                borderRadius: 2, fontWeight: 600,
              }}>
              {loading ? 'Generando…' : 'Generar Reporte'}
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {!reportData ? (
        <EmptyState icon="⚙️" message="Selecciona un período y presiona Generar Reporte" />
      ) : sorted.length === 0 ? (
        <EmptyState icon="👷" message="Sin datos de productividad para este período" />
      ) : (
        <>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={4}>
              <KpiCard label="Operadores activos" value={sorted.length} icon={<Engineering />} color={accentColor} />
            </Grid>
            <Grid item xs={12} sm={4}>
              <KpiCard label="Productividad total" value={formatCurrency(totalProductividad)} icon={<AttachMoney />} color={GREEN} />
            </Grid>
            <Grid item xs={12} sm={4}>
              <KpiCard
                label="Promedio por operador"
                value={formatCurrency(sorted.length ? totalProductividad / sorted.length : 0)}
                icon={<TrendingUp />}
                color={BLUE}
              />
            </Grid>
          </Grid>

          <Paper sx={{ p: 2.5, borderRadius: 3, mb: 2.5, boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
            <Typography sx={{ fontWeight: 700, fontSize: 14, mb: 2 }}>Productividad por operador</Typography>
            <Box sx={{ height: 260 }}>
              <Bar
                data={{ labels: visible.map(r => r.operador_username), datasets: [accentDataset(visible.map(r => r.total_ganado), 'Productividad', GREEN)] }}
                options={{
                  ...barChartDefaults(),
                  scales: { ...barChartDefaults().scales, y: { ...barChartDefaults().scales.y, ticks: { callback: v => formatCurrency(v) } } },
                }}
              />
            </Box>
          </Paper>

          {isMobile
            ? visible.map(row => <OperadorCard key={row.operador_id} row={row} />)
            : (
              <TableContainer sx={{ borderRadius: 2, border: "1px solid", borderColor: "divider", overflowX: "auto" }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ width: 40 }} />
                      <TableCell>Operador</TableCell>
                      <TableCell align="right">Valor Total</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {visible.map(row => <OperadorRow key={row.operador_id} row={row} />)}
                  </TableBody>
                </Table>
              </TableContainer>
            )
          }

          {sorted.length > 5 && (
            <Button onClick={() => setShowAll(p => !p)} sx={{ mt: 1.5, fontWeight: 600, color: accentColor, fontSize: 12 }}>
              {showAll ? 'Ver Top 5' : `Ver todos (${sorted.length})`}
            </Button>
          )}
        </>
      )}
    </Box>
  );
};

export default ReporteProductividad;
