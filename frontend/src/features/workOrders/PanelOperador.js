import React, { useState, useEffect, useCallback, useRef } from 'react';
import apiClient, { getPanelOperadorPendientes, getPanelOperadorProductividad, getPanelOperadorHistorial } from '../../api';
import {
  Box, Typography, Grid, Card, CardContent, CircularProgress, Alert,
  List, ListItem, ListItemText, Divider, Chip, Tabs, Tab,
  TableContainer, Table, TableBody, TableCell, TableHead, TableRow, Paper,
  useMediaQuery, useTheme, Button, TextField, Stack, IconButton, Tooltip
} from '@mui/material';
import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip as ChartTooltip, Legend } from 'chart.js';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import dayjs from 'dayjs';
import {
  Assignment, TrendingUp, CheckCircle, PendingActions,
  Refresh, CalendarToday, PrecisionManufacturing, PlayArrow, Check,
  Visibility, PhotoCamera, AttachFile
} from '@mui/icons-material';
import { formatCurrency } from '../../utils/formatters';
import { toast } from 'react-toastify';
import OrdenTrabajoDetailDialog from './OrdenTrabajoDetailDialog';

ChartJS.register(ArcElement, ChartTooltip, Legend);

const ACCENT = '#14B8A6'; 
const GREEN = '#10B981';
const YELLOW = '#F59E0B';
const BLUE = '#3B82F6';
const RED = '#EF4444';

function TabPanel({ children, value, index }) {
  return (
    <div role="tabpanel" hidden={value !== index}>
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
}

const KpiCard = ({ label, value, icon, color, subtitle }) => (
  <Paper sx={{ p: 2.5, borderRadius: 3, display: 'flex', alignItems: 'center', gap: 2, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
    <Box sx={{ width: 48, height: 48, borderRadius: 2, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: `${color}18`, color }}>
      {icon}
    </Box>
    <Box>
      <Typography sx={{ fontSize: 12, color: 'text.secondary', fontWeight: 500, mb: 0.3 }}>{label}</Typography>
      <Typography sx={{ fontSize: 18, fontWeight: 700, color: 'text.primary' }}>{value}</Typography>
      {subtitle && <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>{subtitle}</Typography>}
    </Box>
  </Paper>
);

const OrdenCard = ({ orden, onIniciar, onTerminar, onView, onUploadEvidence }) => {
  const fileInputRef = useRef(null);

  const getEstadoChip = (estado) => {
    const map = {
      'Pendiente': { label: 'Pendiente', color: 'info' },
      'Iniciada': { label: 'Iniciada', color: 'primary' },
      'En revisión': { label: 'En Revisión', color: 'warning' },
    };
    const props = map[estado] || { label: estado, color: 'default' };
    return <Chip label={props.label} color={props.color} size="small" sx={{ fontWeight: 600, fontSize: 11, borderRadius: 1.5 }} />;
  };

  const handleFileChange = (e) => {
    if (e.target.files?.[0]) {
      onUploadEvidence(orden.id, e.target.files[0]);
    }
  };

  return (
    <Paper sx={{ p: 2.5, mb: 2, borderRadius: 3, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
        <Box>
          <Typography sx={{ fontWeight: 700, fontSize: 15 }}>Orden #{orden.id}</Typography>
          <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{orden.cliente_nombre}</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <IconButton size="small" onClick={() => onView(orden)} sx={{ color: BLUE }}>
            <Visibility fontSize="small" />
          </IconButton>
          {getEstadoChip(orden.estado)}
        </Box>
      </Box>
      
      <Box sx={{ mb: 1.5 }}>
        {orden.servicios?.length > 0 && (
            <Typography sx={{ fontSize: 12, fontWeight: 600, color: BLUE, mb: 0.5 }}>
                🛠 {orden.servicios.map(s => s.servicio.nombre).join(', ')}
            </Typography>
        )}
        {orden.productos?.length > 0 && (
            <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
                📦 {orden.productos.map(p => `${p.producto.nombre} (x${p.cantidad})`).join(', ')}
            </Typography>
        )}
      </Box>

      <Divider sx={{ my: 1.5 }} />
      <Grid container spacing={1} sx={{ mb: 1.5 }}>
        <Grid item xs={6}><Box sx={{ textAlign: 'center', p: 1, borderRadius: 2, bgcolor: 'action.hover' }}><Typography sx={{ fontSize: 10, color: 'text.secondary', mb: 0.2 }}>Total</Typography><Typography sx={{ fontSize: 13, fontWeight: 700 }}>{formatCurrency(orden.total)}</Typography></Box></Grid>
        <Grid item xs={6}><Box sx={{ textAlign: 'center', p: 1, borderRadius: 2, bgcolor: 'action.hover' }}><Typography sx={{ fontSize: 10, color: 'text.secondary', mb: 0.2 }}>Contacto</Typography><Typography sx={{ fontSize: 13, fontWeight: 700 }}>{orden.cliente_telefono || 'N/A'}</Typography></Box></Grid>
      </Grid>
      
      {/* ── BOTONES DE ACCIÓN PARA OPERADOR ── */}
      <Box sx={{ display: 'flex', gap: 1, justifyContent: 'space-between', alignItems: 'center', mt: 2 }}>
        <Box>
            <input type="file" hidden ref={fileInputRef} onChange={handleFileChange} accept="image/*" />
            <Tooltip title="Subir evidencia/foto">
                <IconButton size="small" onClick={() => fileInputRef.current?.click()} sx={{ color: ACCENT, bgcolor: `${ACCENT}12` }}>
                    <PhotoCamera fontSize="small" />
                </IconButton>
            </Tooltip>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
            {orden.estado === 'Pendiente' && (
            <Button size="small" variant="contained" color="info" startIcon={<PlayArrow />} onClick={() => onIniciar(orden.id)} sx={{ borderRadius: 2, fontWeight: 700 }}>
                Iniciar
            </Button>
            )}
            {orden.estado === 'Iniciada' && (
            <Button size="small" variant="contained" color="primary" startIcon={<Check />} onClick={() => onTerminar(orden.id)} sx={{ borderRadius: 2, fontWeight: 700 }}>
                Terminar
            </Button>
            )}
        </Box>
      </Box>
    </Paper>
  );
};

const HistorialCard = ({ orden, onView }) => (
  <Paper sx={{ p: 2.5, mb: 2, borderRadius: 3, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
      <Box>
        <Typography sx={{ fontWeight: 700, fontSize: 15 }}>Orden #{orden.id}</Typography>
        <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{orden.cliente_nombre}</Typography>
      </Box>
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
        <IconButton size="small" onClick={() => onView(orden)} sx={{ color: BLUE }}>
            <Visibility fontSize="small" />
        </IconButton>
        <Chip label={orden.estado_pago_venta === 'pagado' ? 'Pagado' : 'Pendiente'} color={orden.estado_pago_venta === 'pagado' ? 'success' : 'warning'} size="small" sx={{ fontWeight: 600, fontSize: 10, borderRadius: 1.5 }} />
      </Box>
    </Box>
    <Divider sx={{ my: 1.5 }} />
    <Grid container spacing={1}>
      <Grid item xs={6}><Box sx={{ textAlign: 'center', p: 1, borderRadius: 2, bgcolor: 'action.hover' }}><Typography sx={{ fontSize: 10, color: 'text.secondary', mb: 0.2 }}>Total</Typography><Typography sx={{ fontSize: 13, fontWeight: 700 }}>{formatCurrency(orden.total)}</Typography></Box></Grid>
      <Grid item xs={6}><Box sx={{ textAlign: 'center', p: 1, borderRadius: 2, bgcolor: 'action.hover' }}><Typography sx={{ fontSize: 10, color: 'text.secondary', mb: 0.2 }}>Fecha</Typography><Typography sx={{ fontSize: 13, fontWeight: 700 }}>{new Date(orden.fecha_actualizacion).toLocaleDateString()}</Typography></Box></Grid>
    </Grid>
  </Paper>
);

const PanelOperador = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [pendientes, setPendientes] = useState([]);
  const [productividad, setProductividad] = useState(null);
  const [historial, setHistorial] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentTab, setCurrentTab] = useState(0);
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);

  const [selectedOrden, setSelectedOrden] = useState(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);

  const fetchPanelData = useCallback(async () => {
    try {
      setLoading(true);
      const [pendientesRes, productividadRes, historialRes] = await Promise.all([
        getPanelOperadorPendientes(),
        getPanelOperadorProductividad(startDate ? startDate.format('YYYY-MM-DD') : null, endDate ? endDate.format('YYYY-MM-DD') : null),
        getPanelOperadorHistorial()
      ]);
      // Filtramos en frontend por si acaso para no mostrar las que ya pasaron a "En revisión"
      setPendientes(pendientesRes.data.filter(o => ['Pendiente', 'Iniciada'].includes(o.estado)));
      setProductividad(productividadRes.data);
      setHistorial(historialRes.data);
      setError(null);
    } catch (err) { setError('Error al cargar datos del panel'); } finally { setLoading(false); }
  }, [startDate, endDate]);

  useEffect(() => { fetchPanelData(); }, [fetchPanelData]);

  // ── HANDLERS DE FLUJO DE TRABAJO ──
  const handleIniciar = async (id) => {
    try {
        await apiClient.put(`/panel_operador/${id}/iniciar`);
        toast.success("Orden Iniciada");
        fetchPanelData();
    } catch (e) { toast.error("Error al iniciar la orden"); }
  };

  const handleTerminar = async (id) => {
    try {
        await apiClient.put(`/panel_operador/${id}/terminar`);
        toast.success("Orden terminada y enviada a revisión");
        fetchPanelData();
    } catch (e) { toast.error("Error al terminar la orden"); }
  };

  const handleViewDetails = async (ordenSummary) => {
    try {
        const res = await apiClient.get(`/ordenes-trabajo/${ordenSummary.id}`);
        setSelectedOrden(res.data);
        setShowDetailDialog(true);
    } catch (e) { toast.error("Error al cargar detalles"); }
  };

  const handleUploadEvidence = async (id, file) => {
    try {
        const formData = new FormData();
        formData.append("file", file);
        await apiClient.post(`/ordenes-trabajo/${id}/evidencia`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        toast.success("Evidencia subida correctamente");
    } catch (e) { toast.error("Error al subir evidencia"); }
  };

  const handleTabChange = (event, newValue) => setCurrentTab(newValue);
  const handleClearFilters = () => { setStartDate(null); setEndDate(null); };

  const chartData = {
    labels: productividad?.grafica_servicios_semana.map(d => d.name) || [],
    datasets: [{
        label: 'Unidades de Servicio', data: productividad?.grafica_servicios_semana.map(d => d.value) || [],
        backgroundColor: ['rgba(255, 99, 132, 0.7)', 'rgba(54, 162, 235, 0.7)', 'rgba(255, 206, 86, 0.7)', 'rgba(75, 192, 192, 0.7)', 'rgba(153, 102, 255, 0.7)', 'rgba(255, 159, 64, 0.7)'],
        borderColor: ['rgba(255, 99, 132, 1)', 'rgba(54, 162, 235, 1)', 'rgba(255, 206, 86, 1)', 'rgba(75, 192, 192, 1)', 'rgba(153, 102, 255, 1)', 'rgba(255, 159, 64, 1)'], borderWidth: 1,
    }],
  };

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}><CircularProgress sx={{ color: ACCENT }} /></Box>;
  if (error) return <Alert severity="error" sx={{ mt: 2, borderRadius: 2 }}>{error}</Alert>;

  return (
    <Box sx={{ width: '100%' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ width: 40, height: 40, borderRadius: 2, bgcolor: `${ACCENT}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: ACCENT }}>
            <PrecisionManufacturing />
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 700, fontSize: 20, lineHeight: 1.2 }}>Panel del Operador</Typography>
            <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>Órdenes pendientes, productividad y estadísticas</Typography>
          </Box>
        </Box>
        <Button variant="outlined" startIcon={<Refresh />} onClick={fetchPanelData} sx={{ borderRadius: 2, fontWeight: 600, borderColor: 'divider', color: 'text.secondary' }}>Actualizar</Button>
      </Box>

      <Paper sx={{ borderRadius: 3, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
        <Tabs value={currentTab} onChange={handleTabChange} variant={isMobile ? 'scrollable' : 'standard'} scrollButtons="auto" sx={{ px: 2, borderBottom: '1px solid', borderColor: 'divider', '& .MuiTab-root': { fontWeight: 600, fontSize: 13, textTransform: 'none', minHeight: 52 }, '& .MuiTabs-indicator': { backgroundColor: ACCENT, height: 3, borderRadius: 3 }, '& .Mui-selected': { color: `${ACCENT} !important` } }}>
          <Tab label={`📋 Órdenes Pendientes (${pendientes.length})`} />
          <Tab label="📊 Productividad" />
          <Tab label="🕒 Historial Reciente" />
        </Tabs>

        <TabPanel value={currentTab} index={0}>
          <Box sx={{ px: { xs: 2, md: 3 }, pb: 3 }}>
            {isMobile ? (
              <Box>
                {pendientes.length === 0 ? (
                  <Box sx={{ textAlign: 'center', py: 6, color: 'text.secondary' }}><CheckCircle sx={{ fontSize: 48, mb: 1, opacity: 0.3 }} /><Typography>No hay órdenes pendientes</Typography></Box>
                ) : (
                  pendientes.map(orden => <OrdenCard key={orden.id} orden={orden} onIniciar={handleIniciar} onTerminar={handleTerminar} onView={handleViewDetails} onUploadEvidence={handleUploadEvidence} />)
                )}
              </Box>
            ) : (
              <TableContainer sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      {['ID', 'Cliente', 'Estado', 'Servicios', 'Productos', 'Total', 'Acciones'].map(h => <TableCell key={h} sx={{ fontWeight: 600 }}>{h}</TableCell>)}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {pendientes.length === 0 ? (
                      <TableRow><TableCell colSpan={7} sx={{ textAlign: 'center', py: 6, color: 'text.secondary' }}>No hay órdenes pendientes</TableCell></TableRow>
                    ) : (
                      pendientes.map(orden => (
                        <TableRow key={orden.id} hover>
                          <TableCell sx={{ fontWeight: 600, color: 'text.secondary' }}>#{orden.id}</TableCell>
                          <TableCell sx={{ fontWeight: 600 }}>{orden.cliente_nombre}</TableCell>
                          <TableCell>
                            <Chip label={orden.estado} color={orden.estado === 'Iniciada' ? 'primary' : 'info'} size="small" sx={{ fontWeight: 600, fontSize: 10, borderRadius: 1.5 }} />
                          </TableCell>
                          <TableCell sx={{ fontSize: 11, color: BLUE, fontWeight: 600 }}>
                            {orden.servicios?.length > 0 ? orden.servicios.map(s => s.servicio.nombre).join(', ') : 'N/A'}
                          </TableCell>
                          <TableCell sx={{ fontSize: 11 }}>
                            {orden.productos?.length > 0 ? orden.productos.map(p => `${p.producto.nombre} (×${p.cantidad})`).join(', ') : 'N/A'}
                          </TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>{formatCurrency(orden.total)}</TableCell>
                          <TableCell>
                            <Box sx={{ display: 'flex', gap: 0.5 }}>
                                <Tooltip title="Ver detalles">
                                    <IconButton size="small" onClick={() => handleViewDetails(orden)} sx={{ color: BLUE }}>
                                        <Visibility fontSize="small" />
                                    </IconButton>
                                </Tooltip>
                                <input type="file" hidden id={`file-up-${orden.id}`} onChange={(e) => handleUploadEvidence(orden.id, e.target.files[0])} accept="image/*" />
                                <Tooltip title="Subir evidencia">
                                    <IconButton size="small" component="label" htmlFor={`file-up-${orden.id}`} sx={{ color: ACCENT }}>
                                        <PhotoCamera fontSize="small" />
                                    </IconButton>
                                </Tooltip>
                                {orden.estado === 'Pendiente' && (
                                    <Button size="small" variant="contained" color="info" startIcon={<PlayArrow />} onClick={() => handleIniciar(orden.id)} sx={{ borderRadius: 2, fontWeight: 700 }}>
                                        Iniciar
                                    </Button>
                                )}
                                {orden.estado === 'Iniciada' && (
                                    <Button size="small" variant="contained" color="primary" startIcon={<Check />} onClick={() => handleTerminar(orden.id)} sx={{ borderRadius: 2, fontWeight: 700 }}>
                                        Terminar
                                    </Button>
                                )}
                            </Box>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Box>
        </TabPanel>

        <TabPanel value={currentTab} index={1}>
          <Box sx={{ px: { xs: 2, md: 3 }, pb: 3 }}>
            {productividad && (
              <>
                <Paper sx={{ p: 2, mb: 3, borderRadius: 2, bgcolor: 'action.hover', border: '1px solid', borderColor: 'divider', boxShadow: 'none' }}>
                  <Typography sx={{ fontSize: 11, fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.6, mb: 1.5 }}>Filtrar período</Typography>
                  <LocalizationProvider dateAdapter={AdapterDayjs}>
                    <Stack direction={isMobile ? 'column' : 'row'} spacing={2} sx={{ alignItems: 'flex-start' }}>
                      <DatePicker label="Fecha Inicio" value={startDate} onChange={setStartDate} slotProps={{ textField: { fullWidth: isMobile, size: 'small' } }} />
                      <DatePicker label="Fecha Fin" value={endDate} onChange={setEndDate} slotProps={{ textField: { fullWidth: isMobile, size: 'small' } }} />
                      <Button variant="contained" onClick={fetchPanelData} sx={{ height: 40, bgcolor: ACCENT, borderRadius: 2, fontWeight: 600 }}>Aplicar</Button>
                      <Button variant="outlined" onClick={handleClearFilters} sx={{ height: 40, borderRadius: 2, fontWeight: 600, borderColor: 'divider', color: 'text.secondary' }}>Limpiar</Button>
                    </Stack>
                  </LocalizationProvider>
                </Paper>
                <Grid container spacing={2} sx={{ mb: 3 }}>
                  <Grid item xs={6} sm={3}><KpiCard label="Unidades Hoy" value={productividad.servicios_hoy} icon={<CalendarToday />} color={BLUE} /></Grid>
                  <Grid item xs={6} sm={3}><KpiCard label="Unidades Semana" value={productividad.servicios_semana} icon={<TrendingUp />} color={GREEN} /></Grid>
                  <Grid item xs={6} sm={3}><KpiCard label="Unidades Mes" value={productividad.servicios_mes} icon={<Assignment />} color={ACCENT} /></Grid>
                  <Grid item xs={6} sm={3}><KpiCard label="Órdenes Cerradas" value={productividad.ordenes_completadas_semana} icon={<CheckCircle />} color={YELLOW} subtitle="Esta semana" /></Grid>
                </Grid>
                <Paper sx={{ p: 3, borderRadius: 3, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', mb: 3 }}>
                  <Typography sx={{ fontWeight: 700, fontSize: 16, mb: 2 }}>Distribución de Unidades de Servicio</Typography>
                  {productividad.grafica_servicios_semana.length > 0 ? (
                    <Box sx={{ maxWidth: 400, mx: 'auto' }}><Doughnut data={chartData} /></Box>
                  ) : <Box sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}><Typography>No hay datos para mostrar</Typography></Box>}
                </Paper>
              </>
            )}
          </Box>
        </TabPanel>

        <TabPanel value={currentTab} index={2}>
          <Box sx={{ px: { xs: 2, md: 3 }, pb: 3 }}>
            <Typography sx={{ fontSize: 11, fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.6, mb: 2 }}>Últimos 7 días</Typography>
            {isMobile ? (
              <Box>{historial.length === 0 ? <Box sx={{ textAlign: 'center', py: 6, color: 'text.secondary' }}><Assignment sx={{ fontSize: 48, mb: 1, opacity: 0.3 }} /><Typography>No hay órdenes cerradas recientemente</Typography></Box> : historial.map(orden => <HistorialCard key={orden.id} orden={orden} onView={handleViewDetails} />)}</Box>
            ) : (
              <TableContainer sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>{['ID', 'Cliente', 'Total', 'Estado Pago', 'Fecha', 'Acciones'].map(h => <TableCell key={h} sx={{ fontWeight: 600 }}>{h}</TableCell>)}</TableRow>
                  </TableHead>
                  <TableBody>
                    {historial.length === 0 ? <TableRow><TableCell colSpan={6} sx={{ textAlign: 'center', py: 6, color: 'text.secondary' }}>No hay órdenes cerradas recientemente</TableCell></TableRow> : historial.map(orden => (
                      <TableRow key={orden.id} hover>
                        <TableCell sx={{ fontWeight: 600, color: 'text.secondary' }}>#{orden.id}</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>{orden.cliente_nombre}</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>{formatCurrency(orden.total)}</TableCell>
                        <TableCell><Chip label={orden.estado_pago_venta === 'pagado' ? 'Pagado' : 'Pendiente'} color={orden.estado_pago_venta === 'pagado' ? 'success' : 'warning'} size="small" sx={{ fontWeight: 600, fontSize: 10, borderRadius: 1.5 }} /></TableCell>
                        <TableCell sx={{ fontSize: 11 }}>{new Date(orden.fecha_actualizacion).toLocaleDateString()}</TableCell>
                        <TableCell>
                            <IconButton size="small" onClick={() => handleViewDetails(orden)} sx={{ color: BLUE }}>
                                <Visibility fontSize="small" />
                            </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Box>
        </TabPanel>
      </Paper>

      <OrdenTrabajoDetailDialog open={showDetailDialog} handleClose={() => setShowDetailDialog(false)} orden={selectedOrden} />
    </Box>
  );
};

export default PanelOperador;