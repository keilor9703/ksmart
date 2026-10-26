import React, { useState, useCallback, useEffect } from 'react';
import {
  Box, Paper, Typography, Grid, TextField, Button, Stack,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  CircularProgress, Avatar, Chip, LinearProgress,
} from '@mui/material';
import {
  Groups, AttachMoney, EmojiEvents, FileDownload, CalendarToday,
  Refresh, Percent, EventNote,
} from '@mui/icons-material';
import { toast } from 'react-toastify';
import apiClient from '../../api';
import { formatCurrency } from '../../utils/formatters';
import HelpGuideTopBar from '../../components/onboarding/HelpGuideTopBar';

const ACCENT = '#0891B2';
const GOLD   = '#F59E0B';
const GREEN  = '#10B981';

const fmtIso = (d) => d.toISOString().slice(0, 10);

const quickRanges = () => {
  const today = new Date();
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  const weekStart = new Date(today); weekStart.setDate(today.getDate() - today.getDay() + (today.getDay() === 0 ? -6 : 1));
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const monthEnd   = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  return [
    { label: 'Hoy',         start: fmtIso(today),      end: fmtIso(today) },
    { label: 'Ayer',        start: fmtIso(yesterday),  end: fmtIso(yesterday) },
    { label: 'Esta semana', start: fmtIso(weekStart),  end: fmtIso(today) },
    { label: 'Este mes',    start: fmtIso(monthStart), end: fmtIso(monthEnd) },
  ];
};

const KpiCard = ({ label, value, icon, color, sub }) => (
  <Paper sx={{ p: 2.5, borderRadius: 3, display: 'flex', alignItems: 'center', gap: 2, border: '1px solid', borderColor: 'divider' }}>
    <Box sx={{ width: 46, height: 46, borderRadius: 2, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: `${color}18`, color }}>
      {icon}
    </Box>
    <Box>
      <Typography sx={{ fontSize: 12, color: 'text.secondary', fontWeight: 500, mb: 0.2 }}>{label}</Typography>
      <Typography sx={{ fontSize: 20, fontWeight: 800 }}>{value}</Typography>
      {sub && <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{sub}</Typography>}
    </Box>
  </Paper>
);

const exportCSV = (rows, fechaInicio, fechaFin) => {
  if (!rows.length) return;
  const headers = ['Trabajador', 'Servicios', 'Total ventas', 'Comisión'];
  const csvRows = rows.map(r => [
    `"${r.nombre}"`, r.num_servicios, r.total_ventas.toFixed(0), r.comision_total.toFixed(0),
  ].join(','));
  const csv = [headers.join(','), ...csvRows].join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = `comisiones-agendamiento-${fechaInicio}-${fechaFin}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

export default function AgendamientoReporte() {
  const ranges = quickRanges();

  const [fechaInicio, setFechaInicio] = useState(ranges[3].start);
  const [fechaFin,    setFechaFin]    = useState(ranges[3].end);
  const [activeRange, setActiveRange] = useState('Este mes');
  const [reportData,  setReportData]  = useState(null);
  const [loading,     setLoading]     = useState(false);

  const fetchReporte = useCallback(async (inicio, fin) => {
    const start = inicio ?? fechaInicio;
    const end   = fin   ?? fechaFin;
    if (!start || !end) { toast.warning('Selecciona un rango de fechas.'); return; }
    setLoading(true);
    try {
      const { data } = await apiClient.get('/agendamiento/reporte-comisiones', {
        params: { fecha_inicio: start, fecha_fin: end },
      });
      setReportData(data);
      if (!(data.trabajadores || []).length) toast.info('No hay citas cobradas en el período seleccionado.');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al generar el reporte.');
    } finally {
      setLoading(false);
    }
  }, [fechaInicio, fechaFin]);

  useEffect(() => { fetchReporte(ranges[3].start, ranges[3].end); }, []); // eslint-disable-line

  const applyRange = (r) => {
    setFechaInicio(r.start);
    setFechaFin(r.end);
    setActiveRange(r.label);
    fetchReporte(r.start, r.end);
  };

  const rows      = reportData?.trabajadores ?? [];
  const resumen   = reportData?.resumen ?? {};
  const topWorker = rows[0];

  return (
    <Box sx={{ p: { xs: 1, md: 2 }, maxWidth: 960, mx: 'auto' }}>

      {/* ── Header ── */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ width: 42, height: 42, borderRadius: 2, bgcolor: `${ACCENT}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <EventNote sx={{ color: ACCENT, fontSize: 24 }} />
          </Box>
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography sx={{ fontSize: 20, fontWeight: 800, lineHeight: 1.1 }}>Reporte Agendamiento</Typography>
              <HelpGuideTopBar
                moduleName="Reporte Agendamiento"
                moduleColor={ACCENT}
                steps={[
                  { title: 'Selecciona el período', description: 'Usa los botones rápidos o el selector de fechas.' },
                  { title: 'Consulta por trabajador', description: 'Muestra cuántas citas cobró cada trabajador y cuánto se le debe de comisión.' },
                  { title: 'Configura la comisión', description: 'Ve a Config Agendamiento para definir el % global o por servicio.' },
                  { title: 'Exporta los datos', description: 'Usa el botón CSV para descargar el reporte.' },
                ]}
                faqItems={[
                  { q: '¿Qué citas cuenta este reporte?', a: 'Solo las citas de Agendamiento que ya fueron cobradas (convertidas en venta pagada). No mezcla ventas de otros módulos del mismo trabajador.' },
                  { q: '¿Cómo se calcula la comisión?', a: 'Se aplica el % del servicio si lo tiene configurado; si no, el % global de Config Agendamiento.' },
                  { q: '¿Por qué no aparece un trabajador?', a: 'Solo aparecen quienes tengan al menos una cita cobrada en el período.' },
                ]}
              />
            </Box>
            <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>Comisiones por trabajador</Typography>
          </Box>
        </Box>
        {reportData && rows.length > 0 && (
          <Button
            size="small" variant="outlined" startIcon={<FileDownload />}
            onClick={() => exportCSV(rows, fechaInicio, fechaFin)}
            sx={{ borderRadius: 2, fontWeight: 600, borderColor: 'divider', textTransform: 'none' }}
          >
            Exportar CSV
          </Button>
        )}
      </Box>

      {/* ── Filtros ── */}
      <Paper sx={{ p: 2.5, borderRadius: 3, mb: 2.5, border: '1px solid', borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', gap: 0.8, mb: 2, flexWrap: 'wrap' }}>
          {ranges.map(r => (
            <Chip
              key={r.label} label={r.label} size="small"
              icon={<CalendarToday sx={{ fontSize: 12 }} />}
              onClick={() => applyRange(r)}
              sx={{
                fontWeight: 600, cursor: 'pointer',
                bgcolor: activeRange === r.label ? ACCENT : 'action.hover',
                color: activeRange === r.label ? 'white' : 'text.primary',
                '& .MuiChip-icon': { color: activeRange === r.label ? 'rgba(255,255,255,0.8)' : 'text.disabled' },
                '&:hover': { bgcolor: activeRange === r.label ? '#0e7490' : 'action.selected' },
                transition: 'all 0.15s',
              }}
            />
          ))}
        </Box>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'flex-end' }}>
          <TextField label="Fecha inicio" type="date" value={fechaInicio}
            onChange={e => { setFechaInicio(e.target.value); setActiveRange(''); }}
            InputLabelProps={{ shrink: true }} size="small" sx={{ flex: 1 }} />
          <TextField label="Fecha fin" type="date" value={fechaFin}
            onChange={e => { setFechaFin(e.target.value); setActiveRange(''); }}
            InputLabelProps={{ shrink: true }} size="small" sx={{ flex: 1 }} />
          <Button
            variant="contained" onClick={() => { setActiveRange(''); fetchReporte(); }}
            disabled={loading}
            startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <Refresh />}
            sx={{ bgcolor: ACCENT, '&:hover': { bgcolor: '#0e7490' }, fontWeight: 700, borderRadius: 2.5, textTransform: 'none', whiteSpace: 'nowrap', minWidth: 160 }}
          >
            {loading ? 'Generando…' : 'Generar Reporte'}
          </Button>
        </Stack>
      </Paper>

      {/* ── Data ── */}
      {reportData && (
        <>
          <Grid container spacing={2} sx={{ mb: 2.5 }}>
            <Grid item xs={6} sm={3}>
              <KpiCard label="Trabajadores" value={resumen.num_trabajadores ?? rows.length} icon={<Groups />} color={ACCENT} />
            </Grid>
            <Grid item xs={6} sm={3}>
              <KpiCard label="Citas cobradas" value={resumen.total_servicios ?? 0} icon={<EventNote />} color={ACCENT} />
            </Grid>
            <Grid item xs={6} sm={3}>
              <KpiCard label="Total en ventas" value={formatCurrency(resumen.total_ventas ?? 0)} icon={<AttachMoney />} color={GREEN} />
            </Grid>
            <Grid item xs={6} sm={3}>
              <KpiCard
                label="Comisiones totales" value={formatCurrency(resumen.comision_total ?? 0)} icon={<Percent />} color={GOLD}
                sub={resumen.comision_pct_global != null ? `Global: ${resumen.comision_pct_global}%` : null}
              />
            </Grid>
          </Grid>

          {topWorker && (
            <Paper sx={{
              p: 2.5, mb: 2.5, borderRadius: 3,
              background: `linear-gradient(135deg, ${GOLD}12, ${GOLD}06)`,
              border: `1.5px solid ${GOLD}50`,
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                <EmojiEvents sx={{ color: GOLD, fontSize: 28 }} />
                <Box sx={{ flex: 1 }}>
                  <Typography sx={{ fontSize: 11, color: GOLD, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8 }}>
                    Mejor rendimiento
                  </Typography>
                  <Typography sx={{ fontWeight: 800, fontSize: 17, lineHeight: 1.2 }}>{topWorker.nombre}</Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>Citas</Typography>
                    <Typography sx={{ fontWeight: 900, fontSize: 22, color: ACCENT, lineHeight: 1 }}>{topWorker.num_servicios}</Typography>
                  </Box>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>Comisión</Typography>
                    <Typography sx={{ fontWeight: 900, fontSize: 22, color: GOLD, lineHeight: 1 }}>
                      {formatCurrency(topWorker.comision_total)}
                    </Typography>
                  </Box>
                </Box>
              </Box>
            </Paper>
          )}

          {rows.length === 0 ? (
            <Paper sx={{ p: 5, borderRadius: 3, textAlign: 'center', border: '1px solid', borderColor: 'divider' }}>
              <EventNote sx={{ fontSize: 48, color: 'action.disabled', mb: 1 }} />
              <Typography sx={{ color: 'text.secondary', fontSize: 14 }}>
                No hay citas cobradas para este período.
              </Typography>
            </Paper>
          ) : (
            <TableContainer component={Paper} sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
              <Table>
                <TableHead>
                  <TableRow sx={{ bgcolor: 'action.hover' }}>
                    {['#', 'Trabajador', 'Citas', 'Total ventas', 'Comisión', '% Part.'].map(h => (
                      <TableCell key={h} sx={{ fontWeight: 700, fontSize: 11, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.5, py: 1.5 }}>
                        {h}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((row, idx) => {
                    const isTop   = idx === 0;
                    const inicial = (row.nombre || '?')[0].toUpperCase();
                    return (
                      <TableRow key={row.operador_id ?? idx} hover sx={{ '&:last-child td': { border: 0 }, bgcolor: isTop ? `${GOLD}06` : 'transparent' }}>
                        <TableCell sx={{ width: 32 }}>
                          {isTop ? <EmojiEvents sx={{ color: GOLD, fontSize: 18 }} /> : <Typography sx={{ fontSize: 12, color: 'text.disabled', fontWeight: 600 }}>#{idx + 1}</Typography>}
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                            <Avatar sx={{ width: 32, height: 32, fontSize: 13, fontWeight: 700, bgcolor: isTop ? `${GOLD}25` : `${ACCENT}20`, color: isTop ? GOLD : ACCENT }}>
                              {inicial}
                            </Avatar>
                            <Typography sx={{ fontWeight: 700, fontSize: 13 }}>{row.nombre}</Typography>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 38, height: 38, borderRadius: '50%', bgcolor: isTop ? `${GOLD}18` : `${ACCENT}15`, color: isTop ? GOLD : ACCENT, fontWeight: 800, fontSize: 14 }}>
                            {row.num_servicios}
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Typography sx={{ fontWeight: 700, fontSize: 14, color: GREEN }}>{formatCurrency(row.total_ventas)}</Typography>
                        </TableCell>
                        <TableCell>
                          <Typography sx={{ fontWeight: 700, fontSize: 13, color: GOLD }}>{formatCurrency(row.comision_total)}</Typography>
                        </TableCell>
                        <TableCell sx={{ minWidth: 140 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Box sx={{ flex: 1 }}>
                              <LinearProgress variant="determinate" value={Math.min(row.porcentaje, 100)}
                                sx={{ height: 6, borderRadius: 3, bgcolor: 'action.hover', '& .MuiLinearProgress-bar': { bgcolor: isTop ? GOLD : ACCENT } }} />
                            </Box>
                            <Typography sx={{ fontSize: 12, fontWeight: 700, color: isTop ? GOLD : ACCENT, minWidth: 36 }}>{row.porcentaje}%</Typography>
                          </Box>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  <TableRow sx={{ bgcolor: `${ACCENT}06`, borderTop: `2px solid ${ACCENT}20` }}>
                    <TableCell />
                    <TableCell sx={{ fontWeight: 800, fontSize: 13, color: ACCENT }}>TOTAL</TableCell>
                    <TableCell sx={{ fontWeight: 800, fontSize: 14, color: ACCENT }}>{resumen.total_servicios ?? 0}</TableCell>
                    <TableCell sx={{ fontWeight: 800, fontSize: 14, color: GREEN }}>{formatCurrency(resumen.total_ventas ?? 0)}</TableCell>
                    <TableCell sx={{ fontWeight: 800, fontSize: 13, color: GOLD }}>{formatCurrency(resumen.comision_total ?? 0)}</TableCell>
                    <TableCell sx={{ fontWeight: 800, fontSize: 13, color: ACCENT }}>100%</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </>
      )}

      {!reportData && !loading && (
        <Paper sx={{ p: 6, borderRadius: 3, textAlign: 'center', border: '1px dashed', borderColor: 'divider' }}>
          <EventNote sx={{ fontSize: 52, color: 'action.disabled', mb: 1.5 }} />
          <Typography sx={{ color: 'text.secondary', fontSize: 14, fontWeight: 500 }}>
            Selecciona un período y presiona Generar Reporte
          </Typography>
        </Paper>
      )}
    </Box>
  );
}
