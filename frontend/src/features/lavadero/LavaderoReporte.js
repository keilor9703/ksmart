import React, { useState, useCallback, useEffect } from 'react';
import {
  Box, Paper, Typography, Grid, TextField, Button, Stack,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  CircularProgress, Avatar, Chip, Tooltip, LinearProgress,
  Select, MenuItem, FormControl, InputLabel,
} from '@mui/material';
import {
  DirectionsCar, BarChart, AttachMoney, LocalCarWash,
  EmojiEvents, FileDownload, CalendarToday, Refresh, Percent,
  Timer, Warning, ExpandMore, ExpandLess, Storefront,
} from '@mui/icons-material';
import { toast } from 'react-toastify';
import apiClient from '../../api';
import { formatCurrency } from '../../utils/formatters';
import HelpGuideTopBar from '../../components/onboarding/HelpGuideTopBar';
import { alpha } from '@mui/material/styles';

const ACCENT = '#0891B2';
const GOLD   = '#F59E0B';
const BLUE   = '#3B82F6';
const GREEN  = '#10B981';

/* ── date helpers ─────────────────────────────────────────────────────────── */
const fmtIso = (d) => d.toISOString().slice(0, 10);

const quickRanges = () => {
  const today = new Date();
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  const weekStart = new Date(today); weekStart.setDate(today.getDate() - today.getDay() + (today.getDay() === 0 ? -6 : 1));
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const monthEnd   = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  return [
    { label: 'Hoy',        start: fmtIso(today),      end: fmtIso(today) },
    { label: 'Ayer',       start: fmtIso(yesterday),  end: fmtIso(yesterday) },
    { label: 'Esta semana',start: fmtIso(weekStart),  end: fmtIso(today) },
    { label: 'Este mes',   start: fmtIso(monthStart), end: fmtIso(monthEnd) },
  ];
};

const fmtDateLabel = (iso) => {
  if (!iso) return '—';
  return new Date(iso + 'T12:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });
};

/* ── KPI card ─────────────────────────────────────────────────────────────── */
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

/* ── CSV export ───────────────────────────────────────────────────────────── */
const exportCSV = (rows, fechaInicio, fechaFin) => {
  if (!rows.length) return;
  const headers = ['Trabajador', 'Lavadas', 'Total ventas', 'Comisión ganada', 'Promedio/lavada', '% participación', 'Primera lavada', 'Última lavada'];
  const csvRows = rows.map(r => {
    const prom = r.num_lavadas > 0 ? r.total_ventas / r.num_lavadas : 0;
    return [
      `"${r.nombre}"`,
      r.num_lavadas,
      r.total_ventas.toFixed(0),
      (r.comision_ganada ?? 0).toFixed(0),
      prom.toFixed(0),
      `${r.porcentaje ?? 0}%`,
      r.primera_lavada ? fmtDateLabel(r.primera_lavada.slice(0, 10)) : '—',
      r.ultima_lavada  ? fmtDateLabel(r.ultima_lavada.slice(0, 10))  : '—',
    ].join(',');
  });
  const csv = [headers.join(','), ...csvRows].join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = `reporte-lavadero-${fechaInicio}-${fechaFin}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

/* ══════════════════════════════════════════════════════════════════════════ */
export default function LavaderoReporte({ user }) {
  const ranges = quickRanges();

  const [fechaInicio, setFechaInicio] = useState(ranges[3].start); // este mes por defecto
  const [fechaFin,    setFechaFin]    = useState(ranges[3].end);
  const [activeRange, setActiveRange] = useState('Este mes');
  const [reportData,  setReportData]  = useState(null);
  const [loading,     setLoading]     = useState(false);
  const [tiemposData, setTiemposData] = useState(null);
  const [detalleAbierto, setDetalleAbierto] = useState(false);
  const [sedes,   setSedes]   = useState([]);
  const [sedeId,  setSedeId]  = useState('');

  useEffect(() => {
    apiClient.get('/lavadero/sedes').then(({ data }) => setSedes(data || [])).catch(() => {});
  }, []);

  const fetchReporte = useCallback(async (inicio, fin) => {
    const start = inicio ?? fechaInicio;
    const end   = fin   ?? fechaFin;
    if (!start || !end) { toast.warning('Selecciona un rango de fechas.'); return; }
    setLoading(true);
    try {
      const params = { fecha_inicio: start, fecha_fin: end };
      if (sedeId) params.sede_id = sedeId;
      const [{ data }, tiemposRes] = await Promise.all([
        apiClient.get('/lavadero/reporte', { params }),
        apiClient.get('/lavadero/reporte-tiempos', { params }).catch(() => null),
      ]);
      setReportData(data);
      setTiemposData(tiemposRes?.data ?? null);
      const trabajadores = data.trabajadores ?? [];
      if (!trabajadores.length) toast.info('No hay datos para el período seleccionado.');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al generar el reporte.');
    } finally {
      setLoading(false);
    }
  }, [fechaInicio, fechaFin, sedeId]);

  /* auto-fetch este mes al montar */
  useEffect(() => { fetchReporte(ranges[3].start, ranges[3].end); }, []); // eslint-disable-line

  /* re-generar al cambiar de sede (si ya había un reporte cargado) */
  const isFirstSedeRender = React.useRef(true);
  useEffect(() => {
    if (isFirstSedeRender.current) { isFirstSedeRender.current = false; return; }
    fetchReporte();
  }, [sedeId]); // eslint-disable-line

  const applyRange = (r) => {
    setFechaInicio(r.start);
    setFechaFin(r.end);
    setActiveRange(r.label);
    fetchReporte(r.start, r.end);
  };

  const rows        = reportData?.trabajadores ?? [];
  const resumen     = reportData?.resumen ?? {};
  const topWorker   = rows[0]; // ya ordenados por total desc desde el backend

  return (
    <Box sx={{ p: { xs: 1, md: 2 }, maxWidth: 960, mx: 'auto' }}>

      {/* ── Header ── */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ width: 42, height: 42, borderRadius: 2, bgcolor: `${ACCENT}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <BarChart sx={{ color: ACCENT, fontSize: 24 }} />
          </Box>
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography sx={{ fontSize: 20, fontWeight: 800, lineHeight: 1.1 }}>Reporte Lavadero</Typography>
              <HelpGuideTopBar
                moduleName="Reporte Lavadero"
                moduleColor={ACCENT}
                steps={[
                  { title: 'Selecciona el período', description: 'Usa los botones rápidos (Hoy, Semana, Mes) o el selector de fechas para definir el período a analizar.' },
                  { title: 'Consulta por trabajador', description: 'La tabla muestra cuántas lavadas hizo cada empleado y el total de ingresos generados.' },
                  { title: 'Analiza el rendimiento', description: 'Las barras de porcentaje muestran la participación de cada lavador en el total del período.' },
                  { title: 'Exporta los datos', description: 'Usa el botón CSV para descargar el reporte en Excel.' },
                ]}
                faqItems={[
                  { q: '¿Qué significa la columna "Lavadas"?', a: 'Es el número total de órdenes de lavado cobradas por ese trabajador en el período seleccionado. Solo cuentan órdenes marcadas como pagadas.' },
                  { q: '¿Qué significa "Total ventas"?', a: 'Es la suma del valor cobrado en todas las órdenes del trabajador en el período. Es el ingreso bruto que ese empleado generó para el negocio.' },
                  { q: '¿Cómo se calcula la "Comisión"?', a: 'Se calcula aplicando el porcentaje de comisión configurado (visible en el KPI superior como "Global %") sobre el Total ventas de cada trabajador. Ejemplo: si el porcentaje es 30% y el trabajador vendió $100.000, su comisión es $30.000.' },
                  { q: '¿Qué es el "Prom./lavada"?', a: 'Es el valor promedio cobrado por cada lavada. Se obtiene dividiendo el Total ventas entre el número de Lavadas. Sirve para medir si el trabajador está vendiendo servicios de mayor o menor valor.' },
                  { q: '¿Qué significa "% Part."?', a: 'Es el porcentaje de participación: qué proporción del ingreso total del negocio en ese período aportó ese trabajador. Se calcula como (Total ventas del trabajador ÷ Total ventas de todos) × 100.' },
                  { q: '¿Por qué no aparece un lavador?', a: 'Solo aparecen empleados con lavadas registradas en el período. Si no hizo ninguna, no aparece.' },
                  { q: '¿Puedo ver el reporte del día de hoy?', a: 'Sí, haz clic en el botón "Hoy". El reporte se actualiza al instante.' },
                  { q: '¿Qué incluye el reporte?', a: 'Solo ventas con placa de vehículo registrada. No incluye otros tipos de ventas del sistema.' },
                ]}
              />
            </Box>
            <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>Productividad por trabajador</Typography>
          </Box>
        </Box>
        {reportData && rows.length > 0 && (
          <Tooltip title="Exportar CSV">
            <Button
              size="small" variant="outlined"
              startIcon={<FileDownload />}
              onClick={() => exportCSV(rows, fechaInicio, fechaFin)}
              sx={{ borderRadius: 2, fontWeight: 600, borderColor: 'divider', textTransform: 'none' }}
            >
              Exportar CSV
            </Button>
          </Tooltip>
        )}
      </Box>

      {/* ── Filtros ── */}
      <Paper sx={{ p: 2.5, borderRadius: 3, mb: 2.5, border: '1px solid', borderColor: 'divider' }}>
        {/* Quick range buttons */}
        <Box sx={{ display: 'flex', gap: 0.8, mb: 2, flexWrap: 'wrap' }}>
          {ranges.map(r => (
            <Chip
              key={r.label}
              label={r.label}
              size="small"
              icon={<CalendarToday sx={{ fontSize: 12 }} />}
              onClick={() => applyRange(r)}
              sx={{
                fontWeight: 600, cursor: 'pointer',
                bgcolor: activeRange === r.label ? ACCENT : 'action.hover',
                color: activeRange === r.label ? 'white' : 'text.primary',
                '& .MuiChip-icon': { color: activeRange === r.label ? 'rgba(255,255,255,0.8)' : 'text.disabled' },
                '&:hover': { bgcolor: activeRange === r.label ? '#0e7490' : 'action.selected' },
                transition: 'transform 0.15s, box-shadow 0.15s, background-color 0.15s, border-color 0.15s, color 0.15s, opacity 0.15s',
              }}
            />
          ))}
        </Box>

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'flex-end' }}>
          <TextField
            label="Fecha inicio" type="date"
            value={fechaInicio}
            onChange={e => { setFechaInicio(e.target.value); setActiveRange(''); }}
            InputLabelProps={{ shrink: true }}
            size="small" sx={{ flex: 1 }}
          />
          <TextField
            label="Fecha fin" type="date"
            value={fechaFin}
            onChange={e => { setFechaFin(e.target.value); setActiveRange(''); }}
            InputLabelProps={{ shrink: true }}
            size="small" sx={{ flex: 1 }}
          />
          {sedes.length > 0 && (
            <FormControl size="small" sx={{ flex: 1, minWidth: 160 }}>
              <InputLabel id="reporte-sede-label">Sede</InputLabel>
              <Select
                labelId="reporte-sede-label"
                label="Sede"
                value={sedeId}
                onChange={e => setSedeId(e.target.value)}
                startAdornment={<Storefront sx={{ fontSize: 16, color: 'text.secondary', mr: 0.8 }} />}
              >
                <MenuItem value="">Todas las sedes</MenuItem>
                {sedes.map(s => (
                  <MenuItem key={s.id} value={String(s.id)}>{s.nombre}</MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
          <Button
            variant="contained"
            onClick={() => { setActiveRange(''); fetchReporte(); }}
            disabled={loading}
            startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <Refresh />}
            sx={{
              bgcolor: ACCENT, '&:hover': { bgcolor: '#0e7490' },
              fontWeight: 700, borderRadius: 2.5,
              textTransform: 'none', whiteSpace: 'nowrap', minWidth: 160,
            }}
          >
            {loading ? 'Generando…' : 'Generar Reporte'}
          </Button>
        </Stack>
      </Paper>

      {/* ── Data ── */}
      {reportData && (
        <>
          {/* KPIs */}
          <Grid container spacing={2} sx={{ mb: 2.5 }}>
            <Grid item xs={6} sm={3}>
              <KpiCard label="Trabajadores" value={resumen.num_trabajadores ?? rows.length} icon={<LocalCarWash />} color={ACCENT} />
            </Grid>
            <Grid item xs={6} sm={3}>
              <KpiCard label="Total lavadas" value={resumen.total_lavadas ?? 0} icon={<DirectionsCar />} color={BLUE} />
            </Grid>
            <Grid item xs={6} sm={3}>
              <KpiCard
                label="Total en ventas"
                value={formatCurrency(resumen.total_ventas ?? 0)}
                icon={<AttachMoney />}
                color={GREEN}
                sub={rows.length > 0 ? `Prom. ${formatCurrency((resumen.total_ventas ?? 0) / rows.length)} / trab.` : null}
              />
            </Grid>
            <Grid item xs={6} sm={3}>
              <KpiCard
                label="Comisiones totales"
                value={formatCurrency(resumen.comision_global ?? 0)}
                icon={<Percent />}
                color={GOLD}
                sub={resumen.comision_pct_global != null ? `Global: ${resumen.comision_pct_global}%` : null}
              />
            </Grid>
          </Grid>

          {/* Top performer banner */}
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
                    Mejor rendimiento · {fmtDateLabel(fechaInicio)} – {fmtDateLabel(fechaFin)}
                  </Typography>
                  <Typography sx={{ fontWeight: 800, fontSize: 17, lineHeight: 1.2 }}>{topWorker.nombre}</Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>Lavadas</Typography>
                    <Typography sx={{ fontWeight: 900, fontSize: 22, color: ACCENT, lineHeight: 1 }}>{topWorker.num_lavadas}</Typography>
                  </Box>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>Ingresos</Typography>
                    <Typography sx={{ fontWeight: 900, fontSize: 22, color: GREEN, lineHeight: 1 }}>
                      {formatCurrency(topWorker.total_ventas)}
                    </Typography>
                  </Box>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>Participación</Typography>
                    <Typography sx={{ fontWeight: 900, fontSize: 22, color: GOLD, lineHeight: 1 }}>
                      {topWorker.porcentaje ?? 0}%
                    </Typography>
                  </Box>
                </Box>
              </Box>
            </Paper>
          )}

          {/* Table */}
          {rows.length === 0 ? (
            <Paper sx={{ p: 5, borderRadius: 3, textAlign: 'center', border: '1px solid', borderColor: 'divider' }}>
              <DirectionsCar sx={{ fontSize: 48, color: 'action.disabled', mb: 1 }} />
              <Typography sx={{ color: 'text.secondary', fontSize: 14 }}>
                No hay datos de productividad para este período.
              </Typography>
            </Paper>
          ) : (
            <TableContainer component={Paper} sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
              <Table>
                <TableHead>
                  <TableRow sx={{ bgcolor: 'action.hover' }}>
                    {['#', 'Trabajador', 'Lavadas', 'Total ventas', 'Comisión', 'Prom./lavada', '% Part.'].map(h => (
                      <TableCell key={h} sx={{ fontWeight: 700, fontSize: 11, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.5, py: 1.5 }}>
                        {h}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((row, idx) => {
                    const numLavadas = row.num_lavadas ?? 0;
                    const ventas     = parseFloat(row.total_ventas ?? 0);
                    const promedio   = numLavadas > 0 ? ventas / numLavadas : 0;
                    const pct        = row.porcentaje ?? 0;
                    const isTop      = idx === 0;
                    const inicial    = (row.nombre || '?')[0].toUpperCase();
                    return (
                      <TableRow
                        key={row.operador_id ?? idx}
                        hover
                        sx={{
                          '&:last-child td': { border: 0 },
                          bgcolor: isTop ? `${GOLD}06` : 'transparent',
                        }}
                      >
                        {/* Rank */}
                        <TableCell sx={{ width: 32 }}>
                          {isTop
                            ? <EmojiEvents sx={{ color: GOLD, fontSize: 18 }} />
                            : <Typography sx={{ fontSize: 12, color: 'text.disabled', fontWeight: 600 }}>#{idx + 1}</Typography>
                          }
                        </TableCell>

                        {/* Trabajador */}
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                            <Avatar sx={{
                              width: 32, height: 32, fontSize: 13, fontWeight: 700,
                              bgcolor: isTop ? `${GOLD}25` : `${ACCENT}20`,
                              color: isTop ? GOLD : ACCENT,
                            }}>
                              {inicial}
                            </Avatar>
                            <Box>
                              <Typography sx={{ fontWeight: 700, fontSize: 13 }}>{row.nombre}</Typography>
                              {row.primera_lavada && (
                                <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
                                  {fmtDateLabel(row.primera_lavada.slice(0, 10))} – {fmtDateLabel(row.ultima_lavada?.slice(0, 10))}
                                </Typography>
                              )}
                            </Box>
                          </Box>
                        </TableCell>

                        {/* Lavadas */}
                        <TableCell>
                          <Box sx={{
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            width: 38, height: 38, borderRadius: '50%',
                            bgcolor: isTop ? `${GOLD}18` : `${ACCENT}15`,
                            color: isTop ? GOLD : ACCENT,
                            fontWeight: 800, fontSize: 14,
                          }}>
                            {numLavadas}
                          </Box>
                        </TableCell>

                        {/* Total ventas */}
                        <TableCell>
                          <Typography sx={{ fontWeight: 700, fontSize: 14, color: GREEN }}>
                            {formatCurrency(ventas)}
                          </Typography>
                        </TableCell>

                        {/* Comisión */}
                        <TableCell>
                          <Typography sx={{ fontWeight: 700, fontSize: 13, color: GOLD }}>
                            {formatCurrency(row.comision_ganada ?? 0)}
                          </Typography>
                        </TableCell>

                        {/* Promedio */}
                        <TableCell sx={{ fontWeight: 600, fontSize: 13, color: 'text.secondary' }}>
                          {formatCurrency(promedio)}
                        </TableCell>

                        {/* % Participación */}
                        <TableCell sx={{ minWidth: 140 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Box sx={{ flex: 1 }}>
                              <LinearProgress
                                variant="determinate"
                                value={Math.min(pct, 100)}
                                sx={{
                                  height: 6, borderRadius: 3, bgcolor: 'action.hover',
                                  '& .MuiLinearProgress-bar': {
                                    bgcolor: isTop ? GOLD : ACCENT,
                                    transition: 'width 0.6s ease',
                                  },
                                }}
                              />
                            </Box>
                            <Typography sx={{ fontSize: 12, fontWeight: 700, color: isTop ? GOLD : ACCENT, minWidth: 36 }}>
                              {pct}%
                            </Typography>
                          </Box>
                        </TableCell>
                      </TableRow>
                    );
                  })}

                  {/* Totals row */}
                  <TableRow sx={{ bgcolor: `${ACCENT}06`, borderTop: `2px solid ${ACCENT}20` }}>
                    <TableCell />
                    <TableCell sx={{ fontWeight: 800, fontSize: 13, color: ACCENT }}>TOTAL</TableCell>
                    <TableCell sx={{ fontWeight: 800, fontSize: 14, color: ACCENT }}>{resumen.total_lavadas ?? 0}</TableCell>
                    <TableCell sx={{ fontWeight: 800, fontSize: 14, color: GREEN }}>
                      {formatCurrency(resumen.total_ventas ?? 0)}
                    </TableCell>
                    <TableCell sx={{ fontWeight: 800, fontSize: 13, color: GOLD }}>
                      {formatCurrency(resumen.comision_global ?? 0)}
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: 13, color: 'text.secondary' }}>
                      {rows.length > 0 ? formatCurrency((resumen.total_ventas ?? 0) / (resumen.total_lavadas || 1)) : '—'}
                    </TableCell>
                    <TableCell sx={{ fontWeight: 800, fontSize: 13, color: ACCENT }}>100%</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          )}

          {/* ── Tiempos de lavada ── */}
          {tiemposData && tiemposData.num_lavados_con_tiempo > 0 && (
            <Box sx={{ mt: 3.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                <Timer sx={{ color: ACCENT, fontSize: 20 }} />
                <Typography sx={{ fontWeight: 800, fontSize: 15 }}>Tiempos de lavada</Typography>
                <Chip
                  label={`Prom. general: ${tiemposData.promedio_general_minutos} min`}
                  size="small"
                  sx={{ fontWeight: 700, fontSize: 11, bgcolor: alpha(ACCENT, 0.1), color: ACCENT }}
                />
              </Box>
              <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 2 }}>
                Tiempo real entre "Lavando" y "Terminado" por trabajador. Solo cuenta lavadas registradas
                con esta versión — las anteriores no tienen este dato.
              </Typography>

              <TableContainer component={Paper} sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider', mb: 2 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: 'action.hover' }}>
                      {['Trabajador', 'Lavadas', 'Prom.', 'Más rápida', 'Más lenta'].map(h => (
                        <TableCell key={h} sx={{ fontWeight: 700, fontSize: 11, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                          {h}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {tiemposData.trabajadores.map(t => (
                      <TableRow key={t.operador_id ?? t.nombre} hover sx={{ '&:last-child td': { border: 0 } }}>
                        <TableCell sx={{ fontWeight: 700, fontSize: 13 }}>{t.nombre}</TableCell>
                        <TableCell sx={{ fontSize: 13 }}>{t.num_lavados}</TableCell>
                        <TableCell sx={{ fontWeight: 700, fontSize: 13, color: ACCENT }}>{t.promedio_minutos} min</TableCell>
                        <TableCell sx={{ fontSize: 13, color: GREEN }}>{t.minimo_minutos} min</TableCell>
                        <TableCell sx={{ fontSize: 13, color: t.maximo_minutos > tiemposData.promedio_general_minutos * 1.5 ? '#EF4444' : 'text.secondary' }}>
                          {t.maximo_minutos} min
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              <Button
                size="small" onClick={() => setDetalleAbierto(v => !v)}
                endIcon={detalleAbierto ? <ExpandLess /> : <ExpandMore />}
                sx={{ textTransform: 'none', fontWeight: 700, color: ACCENT, mb: 1 }}
              >
                {detalleAbierto ? 'Ocultar detalle por lavada' : `Ver detalle de las ${tiemposData.detalle.length} lavadas (de más lenta a más rápida)`}
              </Button>

              {detalleAbierto && (
                <TableContainer component={Paper} sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider', maxHeight: 420 }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        {['Placa', 'Vehículo', 'Trabajador', 'Duración', 'Terminó'].map(h => (
                          <TableCell key={h} sx={{ fontWeight: 700, fontSize: 11, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.5, bgcolor: 'action.hover' }}>
                            {h}
                          </TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {tiemposData.detalle.map(d => {
                        const lenta = d.minutos > tiemposData.promedio_general_minutos * 1.5;
                        return (
                          <TableRow key={d.orden_id} hover sx={{ '&:last-child td': { border: 0 } }}>
                            <TableCell sx={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 12 }}>{d.placa}</TableCell>
                            <TableCell sx={{ fontSize: 12 }}>{d.tipo_vehiculo || '—'}</TableCell>
                            <TableCell sx={{ fontSize: 12 }}>{d.operador_nombre}</TableCell>
                            <TableCell>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                {lenta && <Warning sx={{ fontSize: 14, color: '#EF4444' }} />}
                                <Typography sx={{ fontSize: 13, fontWeight: 700, color: lenta ? '#EF4444' : 'text.primary' }}>
                                  {d.minutos} min
                                </Typography>
                              </Box>
                            </TableCell>
                            <TableCell sx={{ fontSize: 11, color: 'text.secondary' }}>
                              {new Date(d.fecha_fin_lavado).toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Box>
          )}
        </>
      )}

      {/* ── Empty initial state ── */}
      {!reportData && !loading && (
        <Paper sx={{ p: 6, borderRadius: 3, textAlign: 'center', border: '1px dashed', borderColor: 'divider' }}>
          <BarChart sx={{ fontSize: 52, color: 'action.disabled', mb: 1.5 }} />
          <Typography sx={{ color: 'text.secondary', fontSize: 14, fontWeight: 500 }}>
            Selecciona un período y presiona Generar Reporte
          </Typography>
        </Paper>
      )}
    </Box>
  );
}
