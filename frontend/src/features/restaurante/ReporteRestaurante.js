import React, { useState, useCallback, useEffect } from 'react';
import {
  Box, Typography, Button, CircularProgress, Paper, Grid,
  Tab, Tabs, Chip, useTheme, useMediaQuery, alpha, TextField, IconButton,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Tooltip, Stack,
} from '@mui/material';
import {
  BarChart, TrendingUp, TableRestaurant, Person,
  Restaurant, Refresh, CalendarToday, History,
  CheckCircle, ErrorOutline, HourglassEmpty, PictureAsPdf,
  Replay, ContentCopy, Receipt,
} from '@mui/icons-material';
import { toast } from 'react-toastify';
import apiClient from '../../api';

const ACCENT = '#0891B2';

const fmt = (n) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n || 0);
const fmtDate = (iso) => iso ? new Date(iso).toLocaleString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
const toIso = (date) => date.toISOString().split('T')[0];
const copy = (txt) => navigator.clipboard?.writeText(txt).then(() => toast.success('Copiado'));

const RANGOS = [
  { label: 'Hoy',      getDates: () => { const d = new Date(); return [d, d]; } },
  { label: '7 días',   getDates: () => { const d = new Date(); const d2 = new Date(); d2.setDate(d.getDate() - 6); return [d2, d]; } },
  { label: '30 días',  getDates: () => { const d = new Date(); const d2 = new Date(); d2.setDate(d.getDate() - 29); return [d2, d]; } },
  { label: 'Este mes', getDates: () => { const d = new Date(); return [new Date(d.getFullYear(), d.getMonth(), 1), d]; } },
];

const BarraH = ({ label, valor, max, sub }) => {
  const pct = max > 0 ? (valor / max) * 100 : 0;
  return (
    <Box sx={{ mb: 1.5 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.4 }}>
        <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{label}</Typography>
        <Box sx={{ textAlign: 'right' }}>
          <Typography sx={{ fontSize: 13, fontWeight: 700, color: ACCENT }}>{fmt(valor)}</Typography>
          {sub && <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{sub}</Typography>}
        </Box>
      </Box>
      <Box sx={{ height: 6, borderRadius: 3, bgcolor: 'rgba(0,0,0,0.07)', overflow: 'hidden' }}>
        <Box sx={{ height: '100%', width: `${pct}%`, bgcolor: ACCENT, borderRadius: 3, transition: 'width 0.5s' }} />
      </Box>
    </Box>
  );
};

const KPI = ({ icon, label, value, sub, color }) => (
  <Paper elevation={0} sx={{ p: 2, borderRadius: 2, border: '1px solid rgba(0,0,0,0.08)', height: '100%' }}>
    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
      <Box sx={{ p: 1, borderRadius: 2, bgcolor: alpha(color || ACCENT, 0.1) }}>
        {React.cloneElement(icon, { sx: { color: color || ACCENT, fontSize: 22 } })}
      </Box>
      <Box>
        <Typography sx={{ fontSize: 12, color: 'text.secondary', fontWeight: 500 }}>{label}</Typography>
        <Typography sx={{ fontSize: 22, fontWeight: 800, lineHeight: 1.2 }}>{value}</Typography>
        {sub && <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{sub}</Typography>}
      </Box>
    </Box>
  </Paper>
);

function ChipFE({ estado }) {
  if (estado === 'exitoso')   return <Chip label="FE OK"     size="small" icon={<CheckCircle sx={{ fontSize: '14px !important' }} />}   color="success" />;
  if (estado === 'fallido')   return <Chip label="Fallida"   size="small" icon={<ErrorOutline sx={{ fontSize: '14px !important' }} />}  color="error" />;
  if (estado === 'pendiente') return <Chip label="Pendiente" size="small" icon={<HourglassEmpty sx={{ fontSize: '14px !important' }} />} color="warning" />;
  return <Chip label="Sin FE" size="small" sx={{ bgcolor: 'rgba(0,0,0,0.06)', color: 'text.secondary' }} />;
}

// ─── Tab Historial ─────────────────────────────────────────────────────────────
function HistorialTab() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const today = toIso(new Date());
  const [fechaIni, setFechaIni] = useState(today);
  const [fechaFin, setFechaFin] = useState(today);
  const [mesaFiltro, setMesaFiltro] = useState('');
  const [historial, setHistorial] = useState([]);
  const [loading, setLoading] = useState(false);
  const [reintentando, setReintentando] = useState(null);

  const fetchHistorial = useCallback(async () => {
    setLoading(true);
    try {
      const params = { fecha_inicio: fechaIni, fecha_fin: fechaFin };
      if (mesaFiltro.trim()) params.mesa = mesaFiltro.trim();
      const r = await apiClient.get('/restaurante/historial', { params });
      setHistorial(r.data);
    } catch {
      toast.error('Error cargando historial');
    } finally {
      setLoading(false);
    }
  }, [fechaIni, fechaFin, mesaFiltro]);

  useEffect(() => { fetchHistorial(); }, []);

  const reintentar = async (ventaId) => {
    setReintentando(ventaId);
    try {
      const r = await apiClient.post(`/restaurante/ventas/${ventaId}/reintentar-fe`);
      toast.success(`FE ${r.data.estado === 'exitoso' ? 'emitida' : 'falló de nuevo'}: ${r.data.numero_factura || r.data.mensaje || ''}`);
      fetchHistorial();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Error al reintentar FE');
    } finally {
      setReintentando(null);
    }
  };

  const totalVentas = historial.reduce((s, c) => s + (c.total || 0), 0);
  const feOk = historial.filter(c => c.estado_fe === 'exitoso').length;
  const feFallidas = historial.filter(c => c.estado_fe === 'fallido').length;

  return (
    <Box>
      {/* Filtros */}
      <Paper elevation={0} sx={{ p: 2, borderRadius: 2, border: '1px solid rgba(0,0,0,0.08)', mb: 2 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems="flex-end">
          <TextField
            label="Desde" type="date" size="small" value={fechaIni}
            onChange={e => setFechaIni(e.target.value)}
            InputLabelProps={{ shrink: true }} sx={{ minWidth: 150 }}
          />
          <TextField
            label="Hasta" type="date" size="small" value={fechaFin}
            onChange={e => setFechaFin(e.target.value)}
            InputLabelProps={{ shrink: true }} sx={{ minWidth: 150 }}
          />
          <TextField
            label="Mesa" size="small" value={mesaFiltro}
            onChange={e => setMesaFiltro(e.target.value)}
            placeholder="Ej: 5" sx={{ minWidth: 100 }}
          />
          <Button
            variant="contained" startIcon={loading ? <CircularProgress size={14} color="inherit" /> : <Refresh />}
            onClick={fetchHistorial} disabled={loading}
            sx={{ bgcolor: ACCENT, '&:hover': { bgcolor: '#e05010' }, minWidth: 130, height: 40 }}
          >
            Consultar
          </Button>
        </Stack>
      </Paper>

      {/* KPIs */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={6} sm={4}>
          <KPI icon={<TrendingUp />} label="Total ventas" value={fmt(totalVentas)} color={ACCENT} />
        </Grid>
        <Grid item xs={6} sm={4}>
          <KPI icon={<Receipt />} label="FE emitidas" value={feOk} color="#10B981" />
        </Grid>
        {feFallidas > 0 && (
          <Grid item xs={6} sm={4}>
            <KPI icon={<ErrorOutline />} label="FE fallidas" value={feFallidas} color="#EF4444" />
          </Grid>
        )}
      </Grid>

      {/* Tabla */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress sx={{ color: ACCENT }} /></Box>
      ) : historial.length === 0 ? (
        <Paper elevation={0} sx={{ p: 4, textAlign: 'center', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 2 }}>
          <History sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
          <Typography color="text.secondary">No hay ventas en el período seleccionado</Typography>
        </Paper>
      ) : isMobile ? (
        // En celular las 9 columnas no caben: cada venta se muestra como tarjeta.
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {historial.map((c) => (
            <Paper key={c.comanda_id} elevation={0} sx={{ p: 1.75, border: '1px solid rgba(0,0,0,0.08)', borderRadius: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1, mb: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
                  <Chip label={`Mesa ${c.mesa}`} size="small" icon={<TableRestaurant sx={{ fontSize: '13px !important' }} />}
                    sx={{ bgcolor: alpha(ACCENT, 0.1), color: ACCENT, fontWeight: 600 }} />
                  <ChipFE estado={c.estado_fe} />
                </Box>
                <Typography sx={{ fontWeight: 800, fontSize: 15, whiteSpace: 'nowrap' }}>{fmt(c.total)}</Typography>
              </Box>

              <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{fmtDate(c.fecha_cierre)}</Typography>
              <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
                Mesero: {c.mesero || '—'} · {c.metodo_pago || '—'}
              </Typography>

              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.4, mt: 1 }}>
                {c.items.slice(0, 4).map((it, i) => (
                  <Chip key={i} label={`${it.cantidad}× ${it.nombre}`} size="small"
                    sx={{ fontSize: 10, height: 20, bgcolor: 'rgba(0,0,0,0.06)' }} />
                ))}
                {c.items.length > 4 && <Chip label={`+${c.items.length - 4}`} size="small" sx={{ fontSize: 10, height: 20 }} />}
              </Box>

              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1.25, pt: 1, borderTop: '1px dashed rgba(0,0,0,0.1)' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 0 }}>
                  {c.numero_factura ? (
                    <>
                      <Typography sx={{ fontSize: 12, color: 'text.secondary' }} noWrap>Fact: {c.numero_factura}</Typography>
                      <Tooltip title="Copiar">
                        <IconButton size="small" onClick={() => copy(c.numero_factura)}><ContentCopy sx={{ fontSize: 13 }} /></IconButton>
                      </Tooltip>
                    </>
                  ) : <Typography sx={{ fontSize: 12, color: 'text.disabled' }}>Sin factura</Typography>}
                </Box>
                <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }}>
                  {c.pdf_url && (
                    <Tooltip title="Ver PDF">
                      <IconButton size="small" component="a" href={c.pdf_url} target="_blank" sx={{ color: '#3B82F6' }}>
                        <PictureAsPdf sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Tooltip>
                  )}
                  {c.estado_fe !== 'exitoso' && c.venta_id && (
                    <Tooltip title="Reintentar FE">
                      <span>
                        <IconButton size="small" onClick={() => reintentar(c.venta_id)} disabled={reintentando === c.venta_id} sx={{ color: '#F59E0B' }}>
                          {reintentando === c.venta_id ? <CircularProgress size={14} /> : <Replay sx={{ fontSize: 16 }} />}
                        </IconButton>
                      </span>
                    </Tooltip>
                  )}
                </Box>
              </Box>
            </Paper>
          ))}
        </Box>
      ) : (
        <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid rgba(0,0,0,0.08)', borderRadius: 2 }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: 'rgba(0,0,0,0.03)' }}>
                <TableCell sx={{ fontWeight: 700 }}>Fecha</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Mesa</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Mesero</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Ítems</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Método</TableCell>
                <TableCell sx={{ fontWeight: 700 }} align="right">Total</TableCell>
                <TableCell sx={{ fontWeight: 700 }} align="center">FE</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>N° Factura</TableCell>
                <TableCell sx={{ fontWeight: 700 }} align="center">Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {historial.map((c) => (
                <TableRow key={c.comanda_id} hover>
                  <TableCell sx={{ fontSize: 12, whiteSpace: 'nowrap' }}>{fmtDate(c.fecha_cierre)}</TableCell>
                  <TableCell>
                    <Chip label={`Mesa ${c.mesa}`} size="small" icon={<TableRestaurant sx={{ fontSize: '13px !important' }} />}
                      sx={{ bgcolor: alpha(ACCENT, 0.1), color: ACCENT, fontWeight: 600 }} />
                  </TableCell>
                  <TableCell sx={{ fontSize: 12 }}>{c.mesero}</TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.4 }}>
                      {c.items.slice(0, 3).map((it, i) => (
                        <Chip key={i} label={`${it.cantidad}× ${it.nombre}`} size="small"
                          sx={{ fontSize: 10, height: 20, bgcolor: 'rgba(0,0,0,0.06)' }} />
                      ))}
                      {c.items.length > 3 && (
                        <Chip label={`+${c.items.length - 3}`} size="small" sx={{ fontSize: 10, height: 20 }} />
                      )}
                    </Box>
                  </TableCell>
                  <TableCell sx={{ fontSize: 12 }}>{c.metodo_pago || '—'}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>{fmt(c.total)}</TableCell>
                  <TableCell align="center"><ChipFE estado={c.estado_fe} /></TableCell>
                  <TableCell sx={{ fontSize: 12 }}>
                    {c.numero_factura ? (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Typography sx={{ fontSize: 12 }}>{c.numero_factura}</Typography>
                        <Tooltip title="Copiar">
                          <IconButton size="small" onClick={() => copy(c.numero_factura)}>
                            <ContentCopy sx={{ fontSize: 13 }} />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    ) : '—'}
                  </TableCell>
                  <TableCell align="center">
                    <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
                      {c.pdf_url && (
                        <Tooltip title="Ver PDF">
                          <IconButton size="small" component="a" href={c.pdf_url} target="_blank" sx={{ color: '#3B82F6' }}>
                            <PictureAsPdf sx={{ fontSize: 16 }} />
                          </IconButton>
                        </Tooltip>
                      )}
                      {c.estado_fe !== 'exitoso' && c.venta_id && (
                        <Tooltip title="Reintentar FE">
                          <span>
                            <IconButton
                              size="small"
                              onClick={() => reintentar(c.venta_id)}
                              disabled={reintentando === c.venta_id}
                              sx={{ color: '#F59E0B' }}
                            >
                              {reintentando === c.venta_id
                                ? <CircularProgress size={14} />
                                : <Replay sx={{ fontSize: 16 }} />}
                            </IconButton>
                          </span>
                        </Tooltip>
                      )}
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function ReporteRestaurante() {
  const [mainTab, setMainTab] = useState(0);
  const [tab, setTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [rangoIdx, setRangoIdx] = useState(1);
  const [resumen, setResumen]    = useState(null);
  const [mesas, setMesas]         = useState([]);
  const [meseros, setMeseros]     = useState([]);
  const [productos, setProductos] = useState([]);

  const [desde, hasta] = RANGOS[rangoIdx].getDates();

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const params = { desde: toIso(desde) + 'T00:00:00Z', hasta: toIso(hasta) + 'T23:59:59Z' };
    try {
      const [r, m, me, p] = await Promise.all([
        apiClient.get('/restaurante/reportes/resumen', { params }),
        apiClient.get('/restaurante/reportes/mesas',   { params }),
        apiClient.get('/restaurante/reportes/meseros', { params }),
        apiClient.get('/restaurante/reportes/productos', { params }),
      ]);
      setResumen(r.data);
      setMesas(m.data);
      setMeseros(me.data);
      setProductos(p.data);
    } catch {
      toast.error('Error al cargar reportes');
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangoIdx]);

  useEffect(() => { if (mainTab === 0) fetchAll(); }, [fetchAll, mainTab]);

  const maxMesa   = mesas[0]?.total    || 1;
  const maxMesero = meseros[0]?.total  || 1;
  const maxProd   = productos[0]?.cantidad || 1;

  return (
    <Box sx={{ maxWidth: 1100, mx: 'auto', p: { xs: 1, md: 0 } }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2, flexWrap: 'wrap', gap: 1 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800, fontFamily: "'Geist', sans-serif", display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <BarChart sx={{ color: ACCENT, fontSize: 28 }} />
            Ventas — Restaurante
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Reportes de rendimiento e historial de ventas con FE
          </Typography>
        </Box>
      </Box>

      {/* Main Tabs */}
      <Tabs
        value={mainTab} onChange={(_, v) => setMainTab(v)}
        sx={{
          mb: 3, borderBottom: 1, borderColor: 'divider',
          '& .MuiTab-root': { textTransform: 'none', fontWeight: 600 },
          '& .Mui-selected': { color: `${ACCENT} !important` },
          '& .MuiTabs-indicator': { bgcolor: ACCENT },
        }}
      >
        <Tab label="Reportes" icon={<BarChart />} iconPosition="start" />
        <Tab label="Historial de ventas" icon={<History />} iconPosition="start" />
      </Tabs>

      {/* ── REPORTES ── */}
      {mainTab === 0 && (
        <>
          {/* Selector de rango */}
          <Box sx={{ display: 'flex', gap: 1, mb: 3, flexWrap: 'wrap', alignItems: 'center' }}>
            <CalendarToday sx={{ fontSize: 16, color: 'text.secondary' }} />
            {RANGOS.map((r, i) => (
              <Chip
                key={r.label} label={r.label} size="small"
                onClick={() => setRangoIdx(i)}
                sx={{
                  cursor: 'pointer',
                  bgcolor: rangoIdx === i ? ACCENT : alpha(ACCENT, 0.1),
                  color: rangoIdx === i ? '#fff' : ACCENT,
                  fontWeight: 600,
                }}
              />
            ))}
            <Button
              variant="outlined" size="small"
              startIcon={loading ? <CircularProgress size={14} /> : <Refresh />}
              onClick={fetchAll} disabled={loading}
              sx={{ borderColor: ACCENT, color: ACCENT, ml: 'auto' }}
            >
              Actualizar
            </Button>
          </Box>

          {/* KPIs resumen */}
          {resumen && (
            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid item xs={6} sm={3}>
                <KPI icon={<TrendingUp />} label="Total vendido" value={fmt(resumen.total_ventas)} color={ACCENT} />
              </Grid>
              <Grid item xs={6} sm={3}>
                <KPI icon={<Restaurant />} label="Comandas" value={resumen.total_comandas} color="#3B82F6" />
              </Grid>
              <Grid item xs={6} sm={3}>
                <KPI icon={<TableRestaurant />} label="Ticket promedio" value={fmt(resumen.ticket_promedio)} color="#10B981" />
              </Grid>
              <Grid item xs={6} sm={3}>
                <KPI icon={<CalendarToday />} label="Días con ventas" value={resumen.por_dia?.length || 0} color="#8B5CF6" />
              </Grid>
            </Grid>
          )}

          {/* Sub-tabs reportes */}
          <Tabs
            value={tab} onChange={(_, v) => setTab(v)}
            sx={{
              mb: 3, borderBottom: 1, borderColor: 'divider',
              '& .MuiTab-root': { textTransform: 'none', fontWeight: 600, fontSize: 13 },
              '& .Mui-selected': { color: `${ACCENT} !important` },
              '& .MuiTabs-indicator': { bgcolor: ACCENT },
            }}
          >
            <Tab label="Ventas por día" icon={<TrendingUp />} iconPosition="start" />
            <Tab label="Por mesa" icon={<TableRestaurant />} iconPosition="start" />
            <Tab label="Por mesero" icon={<Person />} iconPosition="start" />
            <Tab label="Productos top" icon={<Restaurant />} iconPosition="start" />
          </Tabs>

          {loading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress sx={{ color: ACCENT }} /></Box>
          )}

          {!loading && tab === 0 && resumen && (
            <Paper elevation={0} sx={{ p: 2.5, borderRadius: 2, border: '1px solid rgba(0,0,0,0.08)' }}>
              <Typography sx={{ fontWeight: 700, mb: 2 }}>Ventas diarias</Typography>
              {resumen.por_dia?.length > 0 ? (
                resumen.por_dia.map(d => {
                  const maxDia = Math.max(...resumen.por_dia.map(x => x.total));
                  return <BarraH key={d.fecha} label={d.fecha} valor={d.total} max={maxDia} />;
                })
              ) : (
                <Typography color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>Sin ventas en el período seleccionado</Typography>
              )}
            </Paper>
          )}

          {!loading && tab === 1 && (
            <Paper elevation={0} sx={{ p: 2.5, borderRadius: 2, border: '1px solid rgba(0,0,0,0.08)' }}>
              <Typography sx={{ fontWeight: 700, mb: 2 }}>Ingresos por mesa</Typography>
              {mesas.length > 0 ? mesas.map(m => (
                <BarraH key={m.mesa} label={`Mesa ${m.mesa}${m.zona ? ` — ${m.zona}` : ''}`} valor={m.total} max={maxMesa} sub={`${m.comandas} comanda${m.comandas !== 1 ? 's' : ''}`} />
              )) : (
                <Typography color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>Sin datos en el período</Typography>
              )}
            </Paper>
          )}

          {!loading && tab === 2 && (
            <Paper elevation={0} sx={{ p: 2.5, borderRadius: 2, border: '1px solid rgba(0,0,0,0.08)' }}>
              <Typography sx={{ fontWeight: 700, mb: 2 }}>Desempeño por mesero</Typography>
              {meseros.length > 0 ? meseros.map(m => (
                <BarraH key={m.mesero_id} label={m.nombre} valor={m.total} max={maxMesero} sub={`${m.comandas} comanda${m.comandas !== 1 ? 's' : ''}`} />
              )) : (
                <Typography color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>Sin datos en el período</Typography>
              )}
            </Paper>
          )}

          {!loading && tab === 3 && (
            <Paper elevation={0} sx={{ p: 2.5, borderRadius: 2, border: '1px solid rgba(0,0,0,0.08)' }}>
              <Typography sx={{ fontWeight: 700, mb: 2 }}>Productos más vendidos (top 30)</Typography>
              {productos.length > 0 ? productos.map((p, i) => (
                <Box key={p.nombre} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.2 }}>
                  <Typography sx={{ fontSize: 11, fontWeight: 700, color: 'text.disabled', width: 20, textAlign: 'right' }}>{i + 1}</Typography>
                  <Box sx={{ flex: 1 }}>
                    <BarraH label={p.nombre} valor={p.total} max={maxProd * (productos[0]?.precio_unitario || 1)} sub={`${p.cantidad} unidades · ${fmt(p.total)}`} />
                  </Box>
                </Box>
              )) : (
                <Typography color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>Sin datos en el período</Typography>
              )}
            </Paper>
          )}
        </>
      )}

      {/* ── HISTORIAL ── */}
      {mainTab === 1 && <HistorialTab />}
    </Box>
  );
}
