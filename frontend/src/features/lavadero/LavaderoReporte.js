import React, { useState, useCallback } from 'react';
import {
  Box, Paper, Typography, Grid, TextField, Button, Stack,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  CircularProgress,
} from '@mui/material';
import { DirectionsCar, BarChart, AttachMoney, LocalCarWash } from '@mui/icons-material';
import { toast } from 'react-toastify';
import apiClient from '../../api';
import { formatCurrency } from '../../utils/formatters';
import HelpGuideTopBar from '../../components/onboarding/HelpGuideTopBar';

const ACCENT = '#FF6020';

function getMonthBounds() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const lastDay = new Date(y, now.getMonth() + 1, 0).getDate();
  return {
    start: `${y}-${m}-01`,
    end:   `${y}-${m}-${lastDay}`,
  };
}

const KpiCard = ({ label, value, icon, color }) => (
  <Paper sx={{
    p: 2.5, borderRadius: 3, display: 'flex', alignItems: 'center', gap: 2,
    border: '1px solid', borderColor: 'divider',
  }}>
    <Box sx={{
      width: 46, height: 46, borderRadius: 2, flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      bgcolor: `${color}18`, color,
    }}>
      {icon}
    </Box>
    <Box>
      <Typography sx={{ fontSize: 12, color: 'text.secondary', fontWeight: 500, mb: 0.3 }}>
        {label}
      </Typography>
      <Typography sx={{ fontSize: 18, fontWeight: 800, color: 'text.primary' }}>
        {value}
      </Typography>
    </Box>
  </Paper>
);

export default function LavaderoReporte({ user }) {
  const bounds = getMonthBounds();
  const [fechaInicio, setFechaInicio] = useState(bounds.start);
  const [fechaFin, setFechaFin]       = useState(bounds.end);
  const [reportData, setReportData]   = useState(null);
  const [loading, setLoading]         = useState(false);

  const fetchReporte = useCallback(async () => {
    if (!fechaInicio || !fechaFin) {
      toast.warning('Selecciona un rango de fechas.');
      return;
    }
    setLoading(true);
    try {
      const { data } = await apiClient.get('/lavadero/reporte', {
        params: { fecha_inicio: fechaInicio, fecha_fin: fechaFin },
      });
      setReportData(data);
      if (!(data.trabajadores ?? data.reporte ?? []).length) {
        toast.info('No hay datos para el período seleccionado.');
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al generar el reporte.');
    } finally {
      setLoading(false);
    }
  }, [fechaInicio, fechaFin]);

  const rows = reportData
    ? (reportData.trabajadores ?? reportData.reporte ?? [])
    : [];

  const totalLavadas = rows.reduce((s, r) => s + (r.num_lavadas ?? r.total_lavadas ?? 0), 0);
  const totalVentas  = rows.reduce((s, r) => s + parseFloat(r.total_ventas ?? r.total_ingresos ?? 0), 0);

  return (
    <Box sx={{ p: { xs: 1, md: 2 }, maxWidth: 900, mx: 'auto' }}>

      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{
            width: 42, height: 42, borderRadius: 2,
            bgcolor: `${ACCENT}18`, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <DirectionsCar sx={{ color: ACCENT, fontSize: 24 }} />
          </Box>
          <Box>
            <Typography sx={{ fontSize: 20, fontWeight: 800, lineHeight: 1.1 }}>
              Reporte Lavadero
            </Typography>
            <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
              Productividad por trabajador
            </Typography>
          </Box>
        </Box>
        <HelpGuideTopBar
          moduleName="Reporte Lavadero"
          moduleColor={ACCENT}
          steps={[
            { title: 'Selecciona el período', description: 'Usa los campos de fecha inicio y fin para filtrar las lavadas del período que quieres analizar.' },
            { title: 'Consulta por trabajador', description: 'La tabla muestra cuántas lavadas hizo cada empleado y el total de ingresos generados por cada uno.' },
            { title: 'Analiza el rendimiento', description: 'Compara el desempeño de los lavadores para identificar al más productivo o detectar días con baja actividad.' },
            { title: 'Exporta los datos', description: 'Si el reporte tiene botón de descarga, úsalo para llevar los datos a Excel.' },
          ]}
          faqItems={[
            { q: '¿Qué significa el total por trabajador?', a: 'Es la suma del valor de todas las lavadas que ese empleado realizó en el período seleccionado.' },
            { q: '¿Por qué no aparece un lavador en el reporte?', a: 'Solo aparecen empleados que tengan lavadas registradas en ese período. Si no hizo ninguna, no aparecerá.' },
            { q: '¿Puedo ver el reporte del día de hoy?', a: 'Sí, selecciona la fecha de hoy en ambos campos (inicio y fin). El reporte se actualiza al consultar.' },
            { q: '¿Cómo sé cuál fue el día más productivo?', a: 'Cambia el rango de fechas a un mes completo y observa los totales. El pico más alto en el gráfico indica el día más activo.' },
          ]}
        />
      </Box>

      {/* Filtros */}
      <Paper sx={{ p: 2.5, borderRadius: 3, mb: 2.5, border: '1px solid', borderColor: 'divider' }}>
        <Typography sx={{ fontWeight: 700, fontSize: 13, mb: 1.5, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Período
        </Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'flex-end' }}>
          <TextField
            label="Fecha inicio"
            type="date"
            value={fechaInicio}
            onChange={e => setFechaInicio(e.target.value)}
            InputLabelProps={{ shrink: true }}
            size="small"
            sx={{ flex: 1 }}
          />
          <TextField
            label="Fecha fin"
            type="date"
            value={fechaFin}
            onChange={e => setFechaFin(e.target.value)}
            InputLabelProps={{ shrink: true }}
            size="small"
            sx={{ flex: 1 }}
          />
          <Button
            variant="contained"
            onClick={fetchReporte}
            disabled={loading}
            startIcon={loading
              ? <CircularProgress size={16} color="inherit" />
              : <BarChart />
            }
            sx={{
              bgcolor: ACCENT,
              '&:hover': { bgcolor: '#e6561c' },
              fontWeight: 700, borderRadius: 2.5,
              textTransform: 'none', whiteSpace: 'nowrap',
              minWidth: 150,
            }}
          >
            {loading ? 'Generando…' : 'Generar Reporte'}
          </Button>
        </Stack>
      </Paper>

      {/* KPIs — only when there's data */}
      {reportData && (
        <>
          <Grid container spacing={2} sx={{ mb: 2.5 }}>
            <Grid item xs={12} sm={4}>
              <KpiCard
                label="Trabajadores"
                value={rows.length}
                icon={<LocalCarWash />}
                color={ACCENT}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <KpiCard
                label="Total lavadas"
                value={totalLavadas}
                icon={<DirectionsCar />}
                color="#3B82F6"
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <KpiCard
                label="Total en ventas"
                value={formatCurrency(totalVentas)}
                icon={<AttachMoney />}
                color="#10B981"
              />
            </Grid>
          </Grid>

          {/* Summary card */}
          <Paper sx={{
            p: 2.5, borderRadius: 3, mb: 2.5,
            border: `1.5px solid ${ACCENT}40`,
            bgcolor: `${ACCENT}06`,
          }}>
            <Typography sx={{ fontWeight: 700, fontSize: 13, mb: 0.5, color: ACCENT, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Resumen del período
            </Typography>
            <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 1 }}>
              {fechaInicio} → {fechaFin}
            </Typography>
            <Box sx={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              <Box>
                <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>Total lavadas</Typography>
                <Typography sx={{ fontWeight: 900, fontSize: 28, color: ACCENT, lineHeight: 1.1 }}>
                  {totalLavadas}
                </Typography>
              </Box>
              <Box>
                <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>Ingresos totales</Typography>
                <Typography sx={{ fontWeight: 900, fontSize: 28, color: '#10B981', lineHeight: 1.1 }}>
                  {formatCurrency(totalVentas)}
                </Typography>
              </Box>
              {rows.length > 0 && (
                <Box>
                  <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>Promedio por trabajador</Typography>
                  <Typography sx={{ fontWeight: 900, fontSize: 28, color: '#3B82F6', lineHeight: 1.1 }}>
                    {formatCurrency(totalVentas / rows.length)}
                  </Typography>
                </Box>
              )}
            </Box>
          </Paper>

          {/* Table */}
          {rows.length === 0 ? (
            <Paper sx={{ p: 4, borderRadius: 3, textAlign: 'center', border: '1px solid', borderColor: 'divider' }}>
              <DirectionsCar sx={{ fontSize: 48, color: 'action.disabled', mb: 1 }} />
              <Typography sx={{ color: 'text.secondary', fontSize: 14 }}>
                No hay datos de productividad para este período.
              </Typography>
            </Paper>
          ) : (
            <TableContainer component={Paper} sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: 'action.hover' }}>
                    {['Trabajador', 'N° lavadas', 'Total en ventas', 'Promedio/lavada'].map(h => (
                      <TableCell key={h} sx={{
                        fontWeight: 700, fontSize: 11,
                        color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.5,
                        py: 1.5,
                      }}>
                        {h}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((row, idx) => {
                    const numLavadas = row.num_lavadas ?? row.total_lavadas ?? 0;
                    const ventas     = parseFloat(row.total_ventas ?? row.total_ingresos ?? 0);
                    const promedio   = numLavadas > 0 ? ventas / numLavadas : 0;
                    return (
                      <TableRow key={idx} hover sx={{ '&:last-child td': { border: 0 } }}>
                        <TableCell sx={{ fontWeight: 600, fontSize: 13 }}>
                          {row.trabajador ?? row.nombre ?? row.operador_username ?? `#${idx + 1}`}
                        </TableCell>
                        <TableCell>
                          <Box sx={{
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            width: 36, height: 36, borderRadius: '50%',
                            bgcolor: `${ACCENT}15`, color: ACCENT, fontWeight: 800, fontSize: 14,
                          }}>
                            {numLavadas}
                          </Box>
                        </TableCell>
                        <TableCell sx={{ fontWeight: 700, fontSize: 14, color: '#10B981' }}>
                          {formatCurrency(ventas)}
                        </TableCell>
                        <TableCell sx={{ fontWeight: 600, fontSize: 13, color: 'text.secondary' }}>
                          {formatCurrency(promedio)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {/* Totals row */}
                  <TableRow sx={{ bgcolor: `${ACCENT}06` }}>
                    <TableCell sx={{ fontWeight: 800, fontSize: 13, color: ACCENT }}>TOTAL</TableCell>
                    <TableCell sx={{ fontWeight: 800, fontSize: 14, color: ACCENT }}>{totalLavadas}</TableCell>
                    <TableCell sx={{ fontWeight: 800, fontSize: 14, color: '#10B981' }}>
                      {formatCurrency(totalVentas)}
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: 13, color: 'text.secondary' }}>
                      {rows.length > 0 ? formatCurrency(totalVentas / rows.length) : '—'}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </>
      )}

      {/* Empty state before first fetch */}
      {!reportData && !loading && (
        <Paper sx={{ p: 5, borderRadius: 3, textAlign: 'center', border: '1px dashed', borderColor: 'divider' }}>
          <BarChart sx={{ fontSize: 52, color: 'action.disabled', mb: 1.5 }} />
          <Typography sx={{ color: 'text.secondary', fontSize: 14, fontWeight: 500 }}>
            Selecciona un período y presiona Generar Reporte
          </Typography>
        </Paper>
      )}
    </Box>
  );
}
