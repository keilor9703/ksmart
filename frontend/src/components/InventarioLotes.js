import React, { useState, useEffect, useMemo } from 'react';
import {
  Box, Typography, Paper, Grid, TextField, Button, MenuItem,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Chip, IconButton, Stack, CircularProgress, Avatar, Tooltip,
  Dialog, DialogTitle, DialogContent, DialogActions, InputAdornment,
  Tabs, Tab, Autocomplete, LinearProgress, Alert, useTheme, useMediaQuery, Divider
} from '@mui/material';
import {
  Warning, Error as ErrorIcon, CheckCircle, Info,
  Add, Layers, Science, TrendingDown,
  CalendarMonth, Visibility, Edit, Close, Search
} from '@mui/icons-material';
import apiClient from '../api';
import { formatCurrency } from '../utils/formatters';
import { toast } from 'react-toastify';

const PURPLE  = '#8B5CF6'; // NUEVO COLOR DEL MÓDULO
const ACCENT  = '#FF6020';
const GREEN   = '#10B981';
const YELLOW  = '#F59E0B';
const RED     = '#EF4444';
const BLUE    = '#3B82F6';

// ─── Configuración de urgencias ───────────────────────────────────────────────
const URGENCIA_CONFIG = {
  vencido: { color: RED,    bg: '#FEF2F2', label: 'VENCIDO',   icon: <ErrorIcon />,   chipColor: 'error'    },
  critico: { color: RED,    bg: '#FEF2F2', label: '≤ 5 días',  icon: <Warning />,     chipColor: 'error'    },
  alerta:  { color: YELLOW, bg: '#FFFBEB', label: '≤ 15 días', icon: <Warning />,     chipColor: 'warning'  },
  aviso:   { color: BLUE,   bg: '#EFF6FF', label: '≤ 30 días', icon: <Info />,        chipColor: 'info'     },
  ok:      { color: GREEN,  bg: '#ECFDF5', label: 'Vigente',   icon: <CheckCircle />, chipColor: 'success'  },
};

const fmtFecha = (val) => {
  if (!val) return '—';
  try {
    const [y, m, d] = String(val).split('T')[0].split('-');
    return `${d}/${m}/${y}`;
  } catch { return '—'; }
};

const UrgenciaChip = ({ urgencia, dias }) => {
  const cfg = URGENCIA_CONFIG[urgencia] || URGENCIA_CONFIG.ok;
  return (
    <Chip 
      label={urgencia === 'vencido' ? `Vencido hace ${Math.abs(dias)}d` : `${dias}d restantes`} 
      size="small" 
      sx={(theme) => ({ 
        fontWeight: 700, 
        fontSize: 10, 
        bgcolor: theme.palette.mode === 'dark' ? `${cfg.color}15` : cfg.bg, 
        color: cfg.color, 
        border: `1px solid ${cfg.color}30` 
      })} 
    />
  );
};

const BarraConsumo = ({ inicial, actual }) => {
  const pct = inicial > 0 ? Math.round(((inicial - actual) / inicial) * 100) : 0;
  return (
    <Box sx={{ minWidth: 100 }}>
      <LinearProgress variant="determinate" value={pct}
        sx={{ height: 6, borderRadius: 3, bgcolor: '#e2e8f0', '& .MuiLinearProgress-bar': { bgcolor: pct > 80 ? RED : pct > 50 ? YELLOW : GREEN } }} 
      />
      <Typography sx={{ fontSize: 10, color: 'text.secondary', mt: 0.5, fontWeight: 600 }}>
        {actual} / {inicial} ({100 - pct}% disp.)
      </Typography>
    </Box>
  );
};

const InventarioLotes = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
  const [tab, setTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [lotes, setLotes] = useState([]);
  const [alertas, setAlertas] = useState([]);
  const [resumen, setResumen] = useState(null);
  const [productos, setProductos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [filtroUrgencia, setFiltroUrgencia] = useState('todos');
  const [busqueda, setBusqueda] = useState('');

  const [modalLote, setModalLote] = useState({ open: false });
  const [modalAjuste, setModalAjuste] = useState({ open: false, lote: null });
  const [modalFefo, setModalFefo] = useState({ open: false, producto: null, cantidad: '', resultado: null });

  const [form, setForm] = useState({
    producto_id: null, numero_lote: '', fecha_vencimiento: '',
    fecha_fabricacion: '', cantidad_inicial: '', costo_unitario: '',
    proveedor_id: null, referencia_compra: '', observaciones: '',
  });

  const [ajusteForm, setAjusteForm] = useState({ cantidad: '', motivo: '', referencia: '' });

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [resLotes, resAlertas, resResumen, resProd, resClie] = await Promise.all([
        apiClient.get('/inventario/lotes?solo_activos=true'),
        apiClient.get('/reportes/proximos-a-vencer?dias=30'),
        apiClient.get('/reportes/resumen-alertas-vencimiento'),
        apiClient.get('/productos/'),
        apiClient.get('/clientes/'),
      ]);
      setLotes(resLotes.data);
      setAlertas(resAlertas.data);
      setResumen(resResumen.data);
      setProductos(resProd.data.filter(p => !p.es_servicio));
      setClientes(resClie.data.filter(c => c.es_proveedor));
    } catch {
      toast.error('Error al cargar los datos de lotes');
    } finally {
      setLoading(false);
    }
  };

  const handleCrearLote = async () => {
    if (!form.producto_id || !form.numero_lote || !form.fecha_vencimiento || !form.cantidad_inicial || !form.costo_unitario) {
      return toast.warning('Completa los campos obligatorios (*)');
    }
    try {
      await apiClient.post('/inventario/lotes', {
        producto_id: form.producto_id.id,
        numero_lote: form.numero_lote.trim().toUpperCase(),
        fecha_vencimiento: form.fecha_vencimiento,
        fecha_fabricacion: form.fecha_fabricacion || undefined,
        cantidad_inicial: parseFloat(form.cantidad_inicial),
        costo_unitario: parseFloat(form.costo_unitario),
        proveedor_id: form.proveedor_id?.id || undefined,
        referencia_compra: form.referencia_compra || undefined,
        observaciones: form.observaciones || undefined,
      });
      toast.success('Lote registrado correctamente');
      setModalLote({ open: false });
      setForm({ producto_id: null, numero_lote: '', fecha_vencimiento: '', fecha_fabricacion: '', cantidad_inicial: '', costo_unitario: '', proveedor_id: null, referencia_compra: '', observaciones: '' });
      fetchData();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Error al crear el lote');
    }
  };

  const handleAjustar = async () => {
    if (!ajusteForm.cantidad || !ajusteForm.motivo) return toast.warning('Ingresa cantidad y motivo.');
    try {
      await apiClient.patch(`/inventario/lotes/${modalAjuste.lote.id}/ajuste`, {
        cantidad:   parseFloat(ajusteForm.cantidad),
        motivo:     ajusteForm.motivo,
        referencia: ajusteForm.referencia || undefined,
      });
      toast.success('Lote ajustado correctamente');
      setModalAjuste({ open: false, lote: null });
      setAjusteForm({ cantidad: '', motivo: '', referencia: '' });
      fetchData();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Error al ajustar');
    }
  };

  const consultarFefo = async () => {
    if (!modalFefo.producto || !modalFefo.cantidad) return;
    try {
      const res = await apiClient.get(
        `/inventario/lotes/${modalFefo.producto.id}/sugerencia-fefo?cantidad_requerida=${modalFefo.cantidad}`
      );
      setModalFefo(prev => ({ ...prev, resultado: res.data }));
    } catch (e) {
      toast.error('Error al consultar FEFO');
    }
  };

  const lotesFiltrados = useMemo(() => {
    return lotes.filter(l => {
      const matchBusqueda = !busqueda || (l.producto_nombre?.toLowerCase().includes(busqueda.toLowerCase()) || l.numero_lote?.toLowerCase().includes(busqueda.toLowerCase()));
      const matchUrgencia = filtroUrgencia === 'todos' || l.urgencia === filtroUrgencia;
      return matchBusqueda && matchUrgencia;
    });
  }, [lotes, busqueda, filtroUrgencia]);

  const alertasFiltradas = useMemo(() => {
    return alertas.filter(a =>
      !busqueda ||
      a.producto_nombre?.toLowerCase().includes(busqueda.toLowerCase()) ||
      a.numero_lote?.toLowerCase().includes(busqueda.toLowerCase())
    );
  }, [alertas, busqueda]);

  if (loading) return <Box sx={{ p: 5, textAlign: 'center' }}><CircularProgress sx={{ color: PURPLE }} /></Box>;

  return (
    <Box sx={{ width: '100%' }}>
      {/* ── Header ── */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ width: 40, height: 40, borderRadius: 2, bgcolor: `${PURPLE}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: PURPLE }}>
            <Layers />
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 700, fontSize: 20, lineHeight: 1.2 }}>Lotes y Perecederos</Typography>
            <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>Control de vencimientos y trazabilidad FEFO</Typography>
          </Box>
        </Box>
        <Stack direction="row" spacing={1.5}>
          <Button variant="outlined" startIcon={<Science />} onClick={() => setModalFefo({ open: true, producto: null, cantidad: '', resultado: null })} sx={{ borderRadius: 2, fontWeight: 600, color: PURPLE, borderColor: `${PURPLE}50`, '&:hover': { borderColor: PURPLE, bgcolor: `${PURPLE}10` } }}>
            Simular FEFO
          </Button>
          <Button variant="contained" startIcon={<Add />} onClick={() => setModalLote({ open: true })} sx={{ bgcolor: PURPLE, borderRadius: 2, fontWeight: 600, boxShadow: `0 4px 14px ${PURPLE}40`, '&:hover': { bgcolor: '#7C3AED' } }}>
            Registrar Lote
          </Button>
        </Stack>
      </Box>

      {/* ── KPI Cards ── */}
      {resumen && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          {[
            { label: 'Vencidos',      val: resumen.vencidos,  color: RED,    bg: '#FEF2F2', icon: <ErrorIcon /> },
            { label: 'Críticos ≤5d',  val: resumen.criticos,  color: RED,    bg: '#FEF2F2', icon: <Warning /> },
            { label: 'Alertas ≤15d',  val: resumen.alertas,   color: YELLOW, bg: '#FFFBEB', icon: <Warning /> },
            { label: 'Avisos ≤30d',   val: resumen.avisos,    color: BLUE,   bg: '#EFF6FF', icon: <CalendarMonth /> },
          ].map(({ label, val, color, bg, icon }) => (
            <Grid item xs={6} md={3} key={label}>
              <Paper sx={(theme) => ({ 
                p: 2, borderRadius: 3, border: '1px solid', borderColor: 'divider',
                bgcolor: val > 0 ? (theme.palette.mode === 'dark' ? `${color}15` : bg) : 'background.paper' 
              })}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Avatar sx={{ width: 36, height: 36, bgcolor: `${color}20`, color }}>
                    {icon}
                  </Avatar>
                  <Box>
                    <Typography sx={{ fontSize: 22, fontWeight: 900, color: val > 0 ? color : 'text.primary', lineHeight: 1 }}>
                      {val}
                    </Typography>
                    <Typography sx={{ fontSize: 11, color: 'text.secondary', fontWeight: 600 }}>
                      {label}
                    </Typography>
                  </Box>
                </Box>
              </Paper>
            </Grid>
          ))}
        </Grid>
      )}

      {/* ── Alerta si hay vencidos ── */}
      {resumen?.vencidos > 0 && (
        <Alert severity="error" sx={{ mb: 3, borderRadius: 2, fontWeight: 600 }}>
          <strong>{resumen.vencidos} lote(s) VENCIDO(S)</strong> — Retíralos del inventario inmediatamente para evitar sanciones sanitarias.
          {resumen.valor_total_en_riesgo > 0 && (
            <> Valor en riesgo: <strong>{formatCurrency(resumen.valor_total_en_riesgo)}</strong></>
          )}
        </Alert>
      )}

      <Paper sx={{ borderRadius: 4, overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ px: 2, borderBottom: '1px solid', borderColor: 'divider', '& .MuiTabs-indicator': { bgcolor: PURPLE }, '& .Mui-selected': { color: `${PURPLE} !important` } }}>
          <Tab label={`📦 Stock por Lotes (${lotes.length})`} sx={{ fontWeight: 700, textTransform: 'none' }} />
          <Tab label={`⚠️ Próximos a Vencer (${alertas.length})`} sx={{ fontWeight: 700, textTransform: 'none' }} />
        </Tabs>

        {/* ── Filtros comunes ── */}
        <Box sx={{ p: 2, display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center', borderBottom: '1px solid', borderColor: 'divider' }}>
          <TextField
            size="small" placeholder="Buscar producto o número de lote..."
            value={busqueda} onChange={e => setBusqueda(e.target.value)}
            sx={{ flex: 1, minWidth: 200 }}
            InputProps={{ startAdornment: <InputAdornment position="start"><Search fontSize="small"/></InputAdornment> }} 
          />
          {tab === 0 && (
            <TextField select size="small" label="Urgencia" value={filtroUrgencia}
              onChange={e => setFiltroUrgencia(e.target.value)} sx={{ minWidth: 150 }}>
              <MenuItem value="todos">Todos</MenuItem>
              <MenuItem value="vencido">Vencidos</MenuItem>
              <MenuItem value="critico">Críticos</MenuItem>
              <MenuItem value="alerta">Alertas</MenuItem>
              <MenuItem value="aviso">Avisos</MenuItem>
              <MenuItem value="ok">Vigentes</MenuItem>
            </TextField>
          )}
        </Box>

        {/* ════ TAB 0: TODOS LOS LOTES ════ */}
        {tab === 0 && (
          <Box sx={{ p: 2 }}>
            <TableContainer>
              <Table size="small">
                <TableHead sx={{ bgcolor: 'action.hover' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 800 }}>PRODUCTO</TableCell>
                    <TableCell sx={{ fontWeight: 800 }}>N° LOTE</TableCell>
                    <TableCell sx={{ fontWeight: 800 }}>VENCIMIENTO</TableCell>
                    <TableCell sx={{ fontWeight: 800 }}>ESTADO</TableCell>
                    <TableCell sx={{ fontWeight: 800 }}>STOCK / CONSUMO</TableCell>
                    <TableCell sx={{ fontWeight: 800 }}>COSTO UNIT.</TableCell>
                    <TableCell sx={{ fontWeight: 800 }}>VALOR</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 800 }}>ACCIONES</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {lotesFiltrados.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
                        No hay lotes que coincidan con los filtros.
                      </TableCell>
                    </TableRow>
                  ) : (
                    lotesFiltrados.map(lote => {
                      const cfg = URGENCIA_CONFIG[lote.urgencia] || URGENCIA_CONFIG.ok;
                      const isVencido = lote.urgencia === 'vencido';
                      const isCritico = lote.urgencia === 'critico';
                      
                      return (
                        <TableRow key={lote.id} hover 
                          sx={(theme) => ({ 
                            bgcolor: theme.palette.mode === 'dark' 
                              ? (isVencido ? 'rgba(239, 68, 68, 0.15)' : isCritico ? 'rgba(239, 68, 68, 0.08)' : 'transparent')
                              : (isVencido ? '#FEF2F2' : isCritico ? '#FFF5F5' : 'transparent'),
                            '&:hover': {
                              bgcolor: theme.palette.mode === 'dark' 
                                ? (isVencido ? 'rgba(239, 68, 68, 0.25)' : isCritico ? 'rgba(239, 68, 68, 0.15)' : 'action.hover')
                                : (isVencido ? '#FEE2E2' : isCritico ? '#FEE2E2' : 'action.hover')
                            }
                          })}
                        >
                          <TableCell sx={{ fontWeight: 700 }}>{lote.producto_nombre}</TableCell>
                          <TableCell>
                            <Typography sx={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 12 }}>
                              {lote.numero_lote}
                            </Typography>
                            {lote.referencia_compra && (
                              <Typography sx={{ fontSize: 9, color: 'text.secondary' }}>
                                Ref: {lote.referencia_compra}
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell>
                            <Typography sx={{ fontSize: 12, fontWeight: 700, color: cfg.color }}>
                              {fmtFecha(lote.fecha_vencimiento)}
                            </Typography>
                            {lote.fecha_fabricacion && (
                              <Typography sx={{ fontSize: 9, color: 'text.secondary' }}>
                                Fab: {fmtFecha(lote.fecha_fabricacion)}
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell>
                            <UrgenciaChip urgencia={lote.urgencia} dias={lote.dias_restantes} />
                          </TableCell>
                          <TableCell>
                            <BarraConsumo inicial={lote.cantidad_inicial} actual={lote.cantidad_actual} />
                          </TableCell>
                          <TableCell>{formatCurrency(lote.costo_unitario)}</TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>
                            {formatCurrency(lote.cantidad_actual * lote.costo_unitario)}
                          </TableCell>
                          <TableCell align="right">
                            <Tooltip title="Ajustar cantidad" arrow>
                              <IconButton size="small"
                                onClick={() => {
                                  setModalAjuste({ open: true, lote });
                                  setAjusteForm({ cantidad: '', motivo: '', referencia: '' });
                                }}
                                sx={{ color: BLUE, bgcolor: `${BLUE}10` }}>
                                <Edit fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}

        {/* ════ TAB 1: PRÓXIMOS A VENCER ════ */}
        {tab === 1 && (
          <Box sx={{ p: 2 }}>
            {alertasFiltradas.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 6 }}>
                <CheckCircle sx={{ fontSize: 48, color: PURPLE, mb: 1 }} />
                <Typography color="text.secondary">
                  No hay lotes próximos a vencer en los próximos 30 días. ✓
                </Typography>
              </Box>
            ) : (
              <Stack spacing={2}>
                {alertasFiltradas.map(alerta => {
                  const cfg = URGENCIA_CONFIG[alerta.urgencia] || URGENCIA_CONFIG.ok;
                  return (
                    <Paper key={alerta.lote_id} variant="outlined" sx={(theme) => ({
                      p: 2, borderRadius: 2,
                      borderColor: theme.palette.mode === 'dark' ? `${cfg.color}40` : `${cfg.color}30`,
                      bgcolor: theme.palette.mode === 'dark' ? `${cfg.color}10` : cfg.bg,
                    })}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 1 }}>
                        <Box>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                            <Avatar sx={{ width: 28, height: 28, bgcolor: `${cfg.color}20`, color: cfg.color }}>
                              {React.cloneElement(cfg.icon, { sx: { fontSize: 16 } })}
                            </Avatar>
                            <Typography sx={{ fontWeight: 800, fontSize: 15 }}>
                              {alerta.producto_nombre}
                            </Typography>
                            <UrgenciaChip urgencia={alerta.urgencia} dias={alerta.dias_restantes} />
                          </Box>
                          <Typography sx={{ fontSize: 12, color: 'text.secondary', ml: 0.5 }}>
                            Lote: <strong>{alerta.numero_lote}</strong>
                            &nbsp;·&nbsp;Vence: <strong>{fmtFecha(alerta.fecha_vencimiento)}</strong>
                            &nbsp;·&nbsp;Stock: <strong>{alerta.cantidad_actual} {alerta.unidad_medida}</strong>
                          </Typography>
                        </Box>
                        <Box sx={{ textAlign: 'right' }}>
                          <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>Valor en riesgo</Typography>
                          <Typography sx={{ fontWeight: 900, fontSize: 16, color: cfg.color }}>
                            {formatCurrency(alerta.valor_en_riesgo)}
                          </Typography>
                        </Box>
                      </Box>
                    </Paper>
                  );
                })}
              </Stack>
            )}
          </Box>
        )}
      </Paper>

      {/* ════ MODAL: Registrar Lote ════ */}
      <Dialog open={modalLote.open} onClose={() => setModalLote({ open: false })} maxWidth="md" fullWidth fullScreen={isMobile} PaperProps={{ sx: { borderRadius: isMobile ? 0 : 4, overflow: 'hidden' } }}>
        <Box sx={{ height: 6, bgcolor: PURPLE }} />
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pt: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Avatar sx={{ bgcolor: `${PURPLE}15`, color: PURPLE }}><Layers /></Avatar>
            <Typography variant="h6" sx={{ fontWeight: 800 }}>Registrar Entrada de Lote</Typography>
          </Box>
          <IconButton onClick={() => setModalLote({ open: false })} size="small"><Close /></IconButton>
        </DialogTitle>

        <DialogContent dividers sx={{ p: { xs: 2, md: 4 } }}>
          <Grid container spacing={3}>
            {/* Sección 1: Identificación del Producto */}
            <Grid item xs={12}>
              <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.secondary', textTransform: 'uppercase', mb: 1, display: 'block' }}>
                1. Selección de Producto *
              </Typography>
              <Autocomplete
                options={productos}
                getOptionLabel={o => `${o.nombre} (${o.unidad_medida || 'UND'})`}
                value={form.producto_id}
                onChange={(_, v) => setForm(p => ({ ...p, producto_id: v }))}
                renderInput={params => (
                  <TextField {...params} placeholder="Busca por nombre del producto..." fullWidth required size="medium" />
                )} 
              />
            </Grid>

            {/* Sección 2: Datos del Lote */}
            <Grid item xs={12}><Divider><Chip label="Datos del Lote" size="small" /></Divider></Grid>
            
            <Grid item xs={12} md={6}>
              <TextField fullWidth required label="Número de Lote" placeholder="Ej: L-4520-X"
                value={form.numero_lote} onChange={e => setForm(p => ({ ...p, numero_lote: e.target.value.toUpperCase() }))} 
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField fullWidth required label="Cantidad Recibida" type="number"
                value={form.cantidad_inicial} onChange={e => setForm(p => ({ ...p, cantidad_inicial: e.target.value }))}
                InputProps={{ endAdornment: <InputAdornment position="end">{form.producto_id?.unidad_medida || 'UND'}</InputAdornment> }} 
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField fullWidth required label="Fecha de Vencimiento" type="date" InputLabelProps={{ shrink: true }}
                value={form.fecha_vencimiento} onChange={e => setForm(p => ({ ...p, fecha_vencimiento: e.target.value }))}
                inputProps={{ min: new Date().toISOString().split('T')[0] }} 
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField fullWidth label="Fecha de Fabricación (Opcional)" type="date" InputLabelProps={{ shrink: true }}
                value={form.fecha_fabricacion} onChange={e => setForm(p => ({ ...p, fecha_fabricacion: e.target.value }))} 
              />
            </Grid>

            {/* Sección 3: Costos y Proveedor */}
            <Grid item xs={12}><Divider><Chip label="Financiero y Origen" size="small" /></Divider></Grid>

            <Grid item xs={12} md={6}>
              <TextField fullWidth required label="Costo Unitario de Compra" type="number"
                value={form.costo_unitario} onChange={e => setForm(p => ({ ...p, costo_unitario: e.target.value }))}
                InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }} 
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField fullWidth label="Referencia / Factura" placeholder="Ej: FACT-9902"
                value={form.referencia_compra} onChange={e => setForm(p => ({ ...p, referencia_compra: e.target.value }))} 
              />
            </Grid>

            <Grid item xs={12}>
              <Autocomplete
                options={clientes}
                getOptionLabel={o => o.nombre}
                value={form.proveedor_id}
                onChange={(_, v) => setForm(p => ({ ...p, proveedor_id: v }))}
                renderInput={params => (
                  <TextField {...params} label="Proveedor / Origen de Mercancía" fullWidth placeholder="Busca al proveedor..." />
                )} 
              />
            </Grid>

            <Grid item xs={12}>
              <TextField fullWidth multiline rows={2} label="Observaciones Internas"
                value={form.observaciones} onChange={e => setForm(p => ({ ...p, observaciones: e.target.value }))} 
              />
            </Grid>
          </Grid>
        </DialogContent>

        <DialogActions sx={{ p: 3, bgcolor: 'action.hover', gap: 1 }}>
          <Button onClick={() => setModalLote({ open: false })} variant="outlined" sx={{ borderRadius: 2, fontWeight: 700, color: 'text.secondary' }}>
            Cancelar
          </Button>
          <Button variant="contained" onClick={handleCrearLote} sx={{ bgcolor: PURPLE, fontWeight: 800, borderRadius: 2, px: 5, '&:hover': { bgcolor: '#7C3AED' } }}>
            Guardar Entrada de Lote
          </Button>
        </DialogActions>
      </Dialog>

      {/* ════ MODAL: Ajuste manual de lote ════ */}
      <Dialog open={modalAjuste.open} onClose={() => setModalAjuste({ open: false, lote: null })} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}>
          <TrendingDown sx={{ color: ACCENT }} /> Ajuste de Lote
        </DialogTitle>
        <DialogContent>
          {modalAjuste.lote && (
            <Paper variant="outlined" sx={{ p: 1.5, mb: 2, borderRadius: 2, bgcolor: 'action.hover' }}>
              <Typography sx={{ fontWeight: 700, fontSize: 13 }}>{modalAjuste.lote.producto_nombre}</Typography>
              <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
                Lote {modalAjuste.lote.numero_lote} · Stock actual: {modalAjuste.lote.cantidad_actual}
              </Typography>
            </Paper>
          )}
          <Stack spacing={2}>
            <TextField fullWidth size="small" label="Cantidad" type="number" helperText="Positivo = entrada · Negativo = salida (merma, vencido, donación)" value={ajusteForm.cantidad} onChange={e => setAjusteForm(p => ({ ...p, cantidad: e.target.value }))} />
            <TextField fullWidth size="small" label="Motivo *" placeholder="Ej: Merma por daño, Retiro por vencimiento..." value={ajusteForm.motivo} onChange={e => setAjusteForm(p => ({ ...p, motivo: e.target.value }))} />
            <TextField fullWidth size="small" label="Referencia" value={ajusteForm.referencia} onChange={e => setAjusteForm(p => ({ ...p, referencia: e.target.value }))} />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, gap: 1 }}>
          <Button onClick={() => setModalAjuste({ open: false, lote: null })} color="inherit">Cancelar</Button>
          <Button variant="contained" onClick={handleAjustar} sx={{ bgcolor: ACCENT, fontWeight: 800, borderRadius: 2 }}>Aplicar Ajuste</Button>
        </DialogActions>
      </Dialog>

      {/* ════ MODAL: Simulador FEFO ════ */}
      <Dialog open={modalFefo.open} onClose={() => setModalFefo({ open: false, producto: null, cantidad: '', resultado: null })} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}>
          <Science sx={{ color: PURPLE }} /> Simulador FEFO
          <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>
            (First Expired, First Out)
          </Typography>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Consulta qué lotes se consumirían al vender una cantidad determinada, priorizando los que vencen primero.
          </Typography>
          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid item xs={12} sm={7}>
              <Autocomplete options={productos.filter(p => !p.es_servicio)} getOptionLabel={o => o.nombre} value={modalFefo.producto} onChange={(_, v) => setModalFefo(p => ({ ...p, producto: v, resultado: null }))} renderInput={params => <TextField {...params} label="Producto" size="small" fullWidth />} />
            </Grid>
            <Grid item xs={12} sm={5}>
              <TextField fullWidth size="small" label="Cantidad a vender" type="number" value={modalFefo.cantidad} onChange={e => setModalFefo(p => ({ ...p, cantidad: e.target.value, resultado: null }))} InputProps={{ endAdornment: <InputAdornment position="end">{modalFefo.producto?.unidad_medida || 'UND'}</InputAdornment> }} />
            </Grid>
          </Grid>
          <Button fullWidth variant="outlined" onClick={consultarFefo} disabled={!modalFefo.producto || !modalFefo.cantidad} sx={{ mb: 2, borderRadius: 2, fontWeight: 700, color: PURPLE, borderColor: PURPLE }}>Consultar Lotes</Button>

          {modalFefo.resultado && (
            <Box>
              {modalFefo.resultado.factible ? (
                <Alert severity="success" sx={{ mb: 2, borderRadius: 2 }}>✅ Stock suficiente — se consumirán {modalFefo.resultado.lotes_sugeridos.length} lote(s)</Alert>
              ) : (
                <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>❌ Stock insuficiente — faltan {modalFefo.resultado.faltante} unidades en lotes vigentes</Alert>
              )}
              <Stack spacing={1}>
                {modalFefo.resultado.lotes_sugeridos.map((l, i) => (
                  <Paper key={i} variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Box>
                        <Typography sx={{ fontWeight: 700, fontSize: 12 }}>{i + 1}° · Lote {l.numero_lote}</Typography>
                        <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>Vence: {fmtFecha(l.fecha_vencimiento)} ({l.dias_restantes}d) · Disponible: {l.cantidad_disponible}</Typography>
                      </Box>
                      <Chip label={`Consumir: ${l.a_consumir}`} size="small" sx={{ fontWeight: 700, bgcolor: `${PURPLE}15`, color: PURPLE }} />
                    </Box>
                  </Paper>
                ))}
              </Stack>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setModalFefo({ open: false, producto: null, cantidad: '', resultado: null })} color="inherit" sx={{ fontWeight: 700 }}>Cerrar</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default InventarioLotes;