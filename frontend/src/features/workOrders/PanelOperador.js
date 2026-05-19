import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import apiClient, { getPanelOperadorPendientes, getPanelOperadorProductividad, getPanelOperadorHistorial } from '../../api';
import {
  Box, Typography, Grid, Card, CardContent, CircularProgress, Alert,
  Divider, Chip, Tabs, Tab,
  TableContainer, Table, TableBody, TableCell, TableHead, TableRow, Paper,
  TableSortLabel, TablePagination,
  useMediaQuery, useTheme, Button, TextField, Stack, IconButton, Tooltip,
  InputAdornment, LinearProgress,
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
  Visibility, PhotoCamera, Search, FileDownload, AccessTime,
  Speed, EmojiEvents, WorkHistory,
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
const ORANGE = '#F97316';

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

const timeAgo = (dateStr) => {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr + (dateStr.includes('Z') ? '' : 'Z')).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'ahora mismo';
  if (mins < 60) return `hace ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `hace ${hrs}h`;
  return `hace ${Math.floor(hrs / 24)}d`;
};

const urgencyInfo = (orden) => {
  const diff = Date.now() - new Date((orden.fecha_creacion || '') + 'Z').getTime();
  const hrs = diff / 3600000;
  if (orden.estado === 'Pendiente') {
    if (hrs > 24) return { label: 'Urgente', color: RED };
    if (hrs > 8) return { label: 'Atención', color: ORANGE };
    return { label: 'Normal', color: GREEN };
  }
  if (orden.estado === 'Iniciada') return { label: 'En curso', color: BLUE };
  return null;
};

const OrdenCard = ({ orden, onIniciar, onTerminar, onView, onUploadEvidence }) => {
  const fileInputRef = useRef(null);
  const urg = urgencyInfo(orden);

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
    if (e.target.files?.[0]) onUploadEvidence(orden.id, e.target.files[0]);
  };

  return (
    <Paper sx={{
      p: 2.5, mb: 2, borderRadius: 3, boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
      borderLeft: urg ? `4px solid ${urg.color}` : undefined,
    }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography sx={{ fontWeight: 700, fontSize: 15 }}>Orden #{orden.id}</Typography>
            {urg && <Chip label={urg.label} size="small" sx={{ bgcolor: `${urg.color}18`, color: urg.color, fontWeight: 700, fontSize: 10, borderRadius: 1, height: 18 }} />}
          </Box>
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
            📦 {orden.productos.map(p => `${p.producto.nombre} (×${p.cantidad})`).join(', ')}
          </Typography>
        )}
      </Box>

      <Divider sx={{ my: 1.5 }} />
      <Grid container spacing={1} sx={{ mb: 1.5 }}>
        <Grid item xs={4}>
          <Box sx={{ textAlign: 'center', p: 1, borderRadius: 2, bgcolor: 'action.hover' }}>
            <Typography sx={{ fontSize: 10, color: 'text.secondary', mb: 0.2 }}>Total</Typography>
            <Typography sx={{ fontSize: 13, fontWeight: 700 }}>{formatCurrency(orden.total)}</Typography>
          </Box>
        </Grid>
        <Grid item xs={4}>
          <Box sx={{ textAlign: 'center', p: 1, borderRadius: 2, bgcolor: 'action.hover' }}>
            <Typography sx={{ fontSize: 10, color: 'text.secondary', mb: 0.2 }}>Contacto</Typography>
            <Typography sx={{ fontSize: 12, fontWeight: 600 }}>{orden.cliente_telefono || 'N/A'}</Typography>
          </Box>
        </Grid>
        <Grid item xs={4}>
          <Box sx={{ textAlign: 'center', p: 1, borderRadius: 2, bgcolor: `${urg?.color || ACCENT}10` }}>
            <Typography sx={{ fontSize: 10, color: 'text.secondary', mb: 0.2 }}>Asignada</Typography>
            <Typography sx={{ fontSize: 11, fontWeight: 600, color: urg?.color || ACCENT }}>
              {timeAgo(orden.fecha_creacion)}
            </Typography>
          </Box>
        </Grid>
      </Grid>

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
        <Chip
          label={orden.estado_pago_venta === 'pagado' ? 'Pagado' : 'Pendiente'}
          color={orden.estado_pago_venta === 'pagado' ? 'success' : 'warning'}
          size="small"
          sx={{ fontWeight: 600, fontSize: 10, borderRadius: 1.5 }}
        />
      </Box>
    </Box>
    <Divider sx={{ my: 1.5 }} />
    <Grid container spacing={1}>
      <Grid item xs={6}>
        <Box sx={{ textAlign: 'center', p: 1, borderRadius: 2, bgcolor: 'action.hover' }}>
          <Typography sx={{ fontSize: 10, color: 'text.secondary', mb: 0.2 }}>Total</Typography>
          <Typography sx={{ fontSize: 13, fontWeight: 700 }}>{formatCurrency(orden.total)}</Typography>
        </Box>
      </Grid>
      <Grid item xs={6}>
        <Box sx={{ textAlign: 'center', p: 1, borderRadius: 2, bgcolor: 'action.hover' }}>
          <Typography sx={{ fontSize: 10, color: 'text.secondary', mb: 0.2 }}>Fecha</Typography>
          <Typography sx={{ fontSize: 13, fontWeight: 700 }}>{new Date(orden.fecha_actualizacion).toLocaleDateString()}</Typography>
        </Box>
      </Grid>
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

  // Historial date range
  const [histStartDate, setHistStartDate] = useState(null);
  const [histEndDate, setHistEndDate] = useState(null);

  // Pending tab search + sort
  const [busqueda, setBusqueda] = useState('');
  const [sortCol, setSortCol] = useState('fecha');
  const [sortDir, setSortDir] = useState('asc');

  // Historial pagination + sort
  const [histSortCol, setHistSortCol] = useState('fecha');
  const [histSortDir, setHistSortDir] = useState('desc');
  const [histPage, setHistPage] = useState(0);
  const [histRowsPerPage, setHistRowsPerPage] = useState(15);

  const [selectedOrden, setSelectedOrden] = useState(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);

  const fetchPanelData = useCallback(async () => {
    try {
      setLoading(true);
      const histParams = {};
      if (histStartDate) histParams.start_date = histStartDate.format('YYYY-MM-DD');
      if (histEndDate) histParams.end_date = histEndDate.format('YYYY-MM-DD');

      const [pendientesRes, productividadRes, historialRes] = await Promise.all([
        getPanelOperadorPendientes(),
        getPanelOperadorProductividad(
          startDate ? startDate.format('YYYY-MM-DD') : null,
          endDate ? endDate.format('YYYY-MM-DD') : null
        ),
        Object.keys(histParams).length > 0
          ? apiClient.get('/panel_operador/historial', { params: histParams })
          : getPanelOperadorHistorial(),
      ]);
      setPendientes(pendientesRes.data.filter(o => ['Pendiente', 'Iniciada'].includes(o.estado)));
      setProductividad(productividadRes.data);
      setHistorial(historialRes.data);
      setError(null);
    } catch (err) {
      setError('Error al cargar datos del panel');
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, histStartDate, histEndDate]);

  useEffect(() => { fetchPanelData(); }, [fetchPanelData]);

  const handleIniciar = async (id) => {
    try {
      await apiClient.put(`/panel_operador/${id}/iniciar`);
      toast.success('Orden iniciada');
      fetchPanelData();
    } catch { toast.error('Error al iniciar la orden'); }
  };

  const handleTerminar = async (id) => {
    try {
      await apiClient.put(`/panel_operador/${id}/terminar`);
      toast.success('Orden terminada y enviada a revisión');
      fetchPanelData();
    } catch { toast.error('Error al terminar la orden'); }
  };

  const handleViewDetails = async (ordenSummary) => {
    try {
      const res = await apiClient.get(`/ordenes-trabajo/${ordenSummary.id}`);
      setSelectedOrden(res.data);
      setShowDetailDialog(true);
    } catch { toast.error('Error al cargar detalles'); }
  };

  const handleUploadEvidence = async (id, file) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      await apiClient.post(`/ordenes-trabajo/${id}/evidencia`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success('Evidencia subida correctamente');
    } catch { toast.error('Error al subir evidencia'); }
  };

  const handleSort = (col) => {
    setSortDir(prev => col === sortCol ? (prev === 'asc' ? 'desc' : 'asc') : 'asc');
    setSortCol(col);
  };

  const handleHistSort = (col) => {
    setHistSortDir(prev => col === histSortCol ? (prev === 'asc' ? 'desc' : 'asc') : 'desc');
    setHistSortCol(col);
    setHistPage(0);
  };

  // Filtered + sorted pending orders
  const pendientesFiltrados = useMemo(() => {
    let list = [...pendientes];
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase();
      list = list.filter(o =>
        String(o.id).includes(q) ||
        (o.cliente_nombre || '').toLowerCase().includes(q) ||
        (o.servicios || []).some(s => s.servicio.nombre.toLowerCase().includes(q))
      );
    }
    list.sort((a, b) => {
      let va, vb;
      switch (sortCol) {
        case 'cliente': va = a.cliente_nombre || ''; vb = b.cliente_nombre || ''; return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
        case 'total': va = a.total; vb = b.total; break;
        case 'estado': va = a.estado; vb = b.estado; return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
        case 'urgencia': {
          const urgScore = (o) => {
            const hrs = (Date.now() - new Date((o.fecha_creacion || '') + 'Z').getTime()) / 3600000;
            return hrs;
          };
          va = urgScore(a); vb = urgScore(b); break;
        }
        default: va = new Date(a.fecha_creacion || 0); vb = new Date(b.fecha_creacion || 0);
      }
      return sortDir === 'asc' ? va - vb : vb - va;
    });
    return list;
  }, [pendientes, busqueda, sortCol, sortDir]);

  // Filtered + sorted + paginated historial
  const historialSorted = useMemo(() => {
    return [...historial].sort((a, b) => {
      let va, vb;
      switch (histSortCol) {
        case 'cliente': va = a.cliente_nombre || ''; vb = b.cliente_nombre || ''; return histSortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
        case 'total': va = a.total; vb = b.total; break;
        case 'pago': va = a.estado_pago_venta || ''; vb = b.estado_pago_venta || ''; return histSortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
        default: va = new Date(a.fecha_actualizacion || 0); vb = new Date(b.fecha_actualizacion || 0);
      }
      return histSortDir === 'asc' ? va - vb : vb - va;
    });
  }, [historial, histSortCol, histSortDir]);

  const historialPaginado = useMemo(() =>
    historialSorted.slice(histPage * histRowsPerPage, histPage * histRowsPerPage + histRowsPerPage),
    [historialSorted, histPage, histRowsPerPage]
  );

  const totalHistorial = useMemo(() => historial.reduce((s, o) => s + (o.total || 0), 0), [historial]);
  const pagadasHistorial = useMemo(() => historial.filter(o => o.estado_pago_venta === 'pagado').length, [historial]);

  const handleExportHistorialCSV = () => {
    const rows = [
      ['ID', 'Cliente', 'Total', 'Estado Pago', 'Fecha'],
      ...historialSorted.map(o => [o.id, o.cliente_nombre, o.total, o.estado_pago_venta, new Date(o.fecha_actualizacion).toLocaleDateString('es-CO')]),
    ];
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'historial-operador.csv';
    a.click(); URL.revokeObjectURL(url);
  };

  const chartData = {
    labels: productividad?.grafica_servicios_semana.map(d => d.name) || [],
    datasets: [{
      label: 'Unidades de Servicio',
      data: productividad?.grafica_servicios_semana.map(d => d.value) || [],
      backgroundColor: ['rgba(255,99,132,0.7)', 'rgba(54,162,235,0.7)', 'rgba(255,206,86,0.7)', 'rgba(75,192,192,0.7)', 'rgba(153,102,255,0.7)', 'rgba(255,159,64,0.7)'],
      borderColor: ['rgba(255,99,132,1)', 'rgba(54,162,235,1)', 'rgba(255,206,86,1)', 'rgba(75,192,192,1)', 'rgba(153,102,255,1)', 'rgba(255,159,64,1)'],
      borderWidth: 1,
    }],
  };

  const SortTh = ({ col, children, align = 'left' }) => (
    <TableCell align={align} sx={{ fontWeight: 700 }}>
      <TableSortLabel active={sortCol === col} direction={sortCol === col ? sortDir : 'asc'} onClick={() => handleSort(col)}>
        {children}
      </TableSortLabel>
    </TableCell>
  );

  const HistSortTh = ({ col, children, align = 'left' }) => (
    <TableCell align={align} sx={{ fontWeight: 700 }}>
      <TableSortLabel active={histSortCol === col} direction={histSortCol === col ? histSortDir : 'asc'} onClick={() => handleHistSort(col)}>
        {children}
      </TableSortLabel>
    </TableCell>
  );

  if (loading) return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
      <CircularProgress sx={{ color: ACCENT }} />
    </Box>
  );
  if (error) return <Alert severity="error" sx={{ mt: 2, borderRadius: 2 }}>{error}</Alert>;

  const urgentes = pendientesFiltrados.filter(o => {
    const hrs = (Date.now() - new Date((o.fecha_creacion || '') + 'Z').getTime()) / 3600000;
    return o.estado === 'Pendiente' && hrs > 8;
  }).length;

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
        <Button variant="outlined" startIcon={<Refresh />} onClick={fetchPanelData} sx={{ borderRadius: 2, fontWeight: 600, borderColor: 'divider', color: 'text.secondary' }}>
          Actualizar
        </Button>
      </Box>

      <Paper sx={{ borderRadius: 3, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
        <Tabs
          value={currentTab}
          onChange={(_, v) => setCurrentTab(v)}
          variant={isMobile ? 'scrollable' : 'standard'}
          scrollButtons="auto"
          sx={{ px: 2, borderBottom: '1px solid', borderColor: 'divider', '& .MuiTab-root': { fontWeight: 600, fontSize: 13, textTransform: 'none', minHeight: 52 }, '& .MuiTabs-indicator': { backgroundColor: ACCENT, height: 3, borderRadius: 3 }, '& .Mui-selected': { color: `${ACCENT} !important` } }}
        >
          <Tab label={`📋 Órdenes Pendientes (${pendientes.length})`} />
          <Tab label="📊 Productividad" />
          <Tab label={`🕒 Historial (${historial.length})`} />
        </Tabs>

        {/* ── TAB 0: PENDIENTES ── */}
        <TabPanel value={currentTab} index={0}>
          <Box sx={{ px: { xs: 2, md: 3 }, pb: 3 }}>
            {/* KPI summary bar */}
            <Grid container spacing={2} sx={{ mb: 2.5 }}>
              <Grid item xs={6} sm={3}>
                <KpiCard label="Pendientes" value={pendientes.filter(o => o.estado === 'Pendiente').length} icon={<PendingActions />} color={YELLOW} />
              </Grid>
              <Grid item xs={6} sm={3}>
                <KpiCard label="Iniciadas" value={pendientes.filter(o => o.estado === 'Iniciada').length} icon={<PlayArrow />} color={BLUE} />
              </Grid>
              <Grid item xs={6} sm={3}>
                <KpiCard label="Urgentes" value={urgentes} icon={<AccessTime />} color={urgentes > 0 ? RED : GREEN} subtitle="> 8 horas sin atender" />
              </Grid>
              <Grid item xs={6} sm={3}>
                <KpiCard label="Total pendiente" value={formatCurrency(pendientes.reduce((s, o) => s + (o.total || 0), 0))} icon={<TrendingUp />} color={ACCENT} />
              </Grid>
            </Grid>

            {/* Search */}
            <TextField
              size="small"
              fullWidth
              placeholder="Buscar por #, cliente, servicio..."
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              InputProps={{ startAdornment: <InputAdornment position="start"><Search sx={{ fontSize: 18, color: 'text.disabled' }} /></InputAdornment> }}
              sx={{ mb: 2 }}
            />

            {isMobile ? (
              <Box>
                {pendientesFiltrados.length === 0 ? (
                  <Box sx={{ textAlign: 'center', py: 6, color: 'text.secondary' }}>
                    <CheckCircle sx={{ fontSize: 48, mb: 1, opacity: 0.3 }} />
                    <Typography>No hay órdenes pendientes</Typography>
                  </Box>
                ) : (
                  pendientesFiltrados.map(orden => (
                    <OrdenCard key={orden.id} orden={orden} onIniciar={handleIniciar} onTerminar={handleTerminar} onView={handleViewDetails} onUploadEvidence={handleUploadEvidence} />
                  ))
                )}
              </Box>
            ) : (
              <TableContainer sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider', overflowX: 'auto' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: 'action.hover' }}>
                      <SortTh col="fecha">ID / Fecha</SortTh>
                      <SortTh col="cliente">Cliente</SortTh>
                      <SortTh col="urgencia">Tiempo</SortTh>
                      <SortTh col="estado">Estado</SortTh>
                      <TableCell sx={{ fontWeight: 700 }}>Servicios</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Productos</TableCell>
                      <SortTh col="total" align="right">Total</SortTh>
                      <TableCell sx={{ fontWeight: 700 }}>Acciones</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {pendientesFiltrados.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} sx={{ textAlign: 'center', py: 6, color: 'text.secondary' }}>
                          No hay órdenes pendientes
                        </TableCell>
                      </TableRow>
                    ) : (
                      pendientesFiltrados.map(orden => {
                        const urg = urgencyInfo(orden);
                        return (
                          <TableRow key={orden.id} hover sx={{ borderLeft: urg ? `3px solid ${urg.color}` : undefined }}>
                            <TableCell>
                              <Typography sx={{ fontWeight: 600, fontSize: 13 }}>#{orden.id}</Typography>
                              <Typography sx={{ fontSize: 10, color: 'text.disabled' }}>
                                {orden.fecha_creacion ? new Date(orden.fecha_creacion + 'Z').toLocaleDateString() : ''}
                              </Typography>
                            </TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>{orden.cliente_nombre}</TableCell>
                            <TableCell>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <AccessTime sx={{ fontSize: 13, color: urg?.color || 'text.disabled' }} />
                                <Typography sx={{ fontSize: 11, color: urg?.color || 'text.secondary', fontWeight: 600 }}>
                                  {timeAgo(orden.fecha_creacion)}
                                </Typography>
                              </Box>
                              {urg && <Chip label={urg.label} size="small" sx={{ bgcolor: `${urg.color}15`, color: urg.color, fontSize: 9, fontWeight: 700, borderRadius: 1, height: 16, mt: 0.3 }} />}
                            </TableCell>
                            <TableCell>
                              <Chip
                                label={orden.estado}
                                color={orden.estado === 'Iniciada' ? 'primary' : 'info'}
                                size="small"
                                sx={{ fontWeight: 600, fontSize: 10, borderRadius: 1.5 }}
                              />
                            </TableCell>
                            <TableCell sx={{ fontSize: 11, color: BLUE, fontWeight: 600 }}>
                              {orden.servicios?.length > 0 ? orden.servicios.map(s => s.servicio.nombre).join(', ') : '—'}
                            </TableCell>
                            <TableCell sx={{ fontSize: 11 }}>
                              {orden.productos?.length > 0 ? orden.productos.map(p => `${p.producto.nombre} ×${p.cantidad}`).join(', ') : '—'}
                            </TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700 }}>{formatCurrency(orden.total)}</TableCell>
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
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Box>
        </TabPanel>

        {/* ── TAB 1: PRODUCTIVIDAD ── */}
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
                      <Button variant="contained" onClick={fetchPanelData} sx={{ height: 40, bgcolor: ACCENT, '&:hover': { bgcolor: ACCENT }, borderRadius: 2, fontWeight: 600 }}>Aplicar</Button>
                      <Button variant="outlined" onClick={() => { setStartDate(null); setEndDate(null); }} sx={{ height: 40, borderRadius: 2, fontWeight: 600, borderColor: 'divider', color: 'text.secondary' }}>Limpiar</Button>
                    </Stack>
                  </LocalizationProvider>
                </Paper>

                <Grid container spacing={2} sx={{ mb: 3 }}>
                  <Grid item xs={6} sm={3}>
                    <KpiCard label="Unidades Hoy" value={productividad.servicios_hoy} icon={<CalendarToday />} color={BLUE} />
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <KpiCard label="Unidades Semana" value={productividad.servicios_semana} icon={<TrendingUp />} color={GREEN} />
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <KpiCard label="Unidades Mes" value={productividad.servicios_mes} icon={<Assignment />} color={ACCENT} />
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <KpiCard label="Órdenes Cerradas" value={productividad.ordenes_completadas_semana} icon={<CheckCircle />} color={YELLOW} subtitle="Esta semana" />
                  </Grid>
                </Grid>

                {/* Service distribution chart */}
                <Paper sx={{ p: 3, borderRadius: 3, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', mb: 3 }}>
                  <Typography sx={{ fontWeight: 700, fontSize: 16, mb: 2 }}>Distribución de Unidades de Servicio</Typography>
                  {productividad.grafica_servicios_semana.length > 0 ? (
                    <Box sx={{ maxWidth: 400, mx: 'auto' }}>
                      <Doughnut data={chartData} />
                    </Box>
                  ) : (
                    <Box sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
                      <Speed sx={{ fontSize: 48, mb: 1, opacity: 0.3 }} />
                      <Typography>No hay datos para mostrar</Typography>
                    </Box>
                  )}
                </Paper>

                {/* Service breakdown bars */}
                {productividad.grafica_servicios_semana.length > 0 && (
                  <Paper sx={{ p: 3, borderRadius: 3, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
                    <Typography sx={{ fontWeight: 700, fontSize: 14, mb: 2 }}>Detalle por Servicio</Typography>
                    {(() => {
                      const total = productividad.grafica_servicios_semana.reduce((s, d) => s + d.value, 0);
                      const COLORS = [BLUE, GREEN, ACCENT, YELLOW, ORANGE, RED];
                      return productividad.grafica_servicios_semana.map((d, i) => (
                        <Box key={d.name} sx={{ mb: 1.5 }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.4 }}>
                            <Typography sx={{ fontSize: 12, fontWeight: 600 }}>{d.name}</Typography>
                            <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{d.value} uds — {total > 0 ? Math.round(d.value / total * 100) : 0}%</Typography>
                          </Box>
                          <LinearProgress
                            variant="determinate"
                            value={total > 0 ? (d.value / total) * 100 : 0}
                            sx={{ height: 6, borderRadius: 3, bgcolor: `${COLORS[i % COLORS.length]}20`, '& .MuiLinearProgress-bar': { bgcolor: COLORS[i % COLORS.length], borderRadius: 3 } }}
                          />
                        </Box>
                      ));
                    })()}
                  </Paper>
                )}
              </>
            )}
          </Box>
        </TabPanel>

        {/* ── TAB 2: HISTORIAL ── */}
        <TabPanel value={currentTab} index={2}>
          <Box sx={{ px: { xs: 2, md: 3 }, pb: 3 }}>
            {/* Date range + export */}
            <Paper sx={{ p: 2, mb: 2.5, borderRadius: 2, bgcolor: 'action.hover', border: '1px solid', borderColor: 'divider', boxShadow: 'none' }}>
              <Typography sx={{ fontSize: 11, fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.6, mb: 1.5 }}>Filtrar historial</Typography>
              <LocalizationProvider dateAdapter={AdapterDayjs}>
                <Stack direction={isMobile ? 'column' : 'row'} spacing={2} alignItems="flex-start">
                  <DatePicker label="Desde" value={histStartDate} onChange={setHistStartDate} slotProps={{ textField: { size: 'small', fullWidth: isMobile } }} />
                  <DatePicker label="Hasta" value={histEndDate} onChange={setHistEndDate} slotProps={{ textField: { size: 'small', fullWidth: isMobile } }} />
                  <Button variant="contained" onClick={fetchPanelData} sx={{ height: 40, bgcolor: ACCENT, '&:hover': { bgcolor: ACCENT }, borderRadius: 2, fontWeight: 600 }}>Aplicar</Button>
                  <Button variant="outlined" onClick={() => { setHistStartDate(null); setHistEndDate(null); }} sx={{ height: 40, borderRadius: 2, fontWeight: 600, borderColor: 'divider', color: 'text.secondary' }}>Limpiar</Button>
                  <Button variant="outlined" startIcon={<FileDownload />} onClick={handleExportHistorialCSV} disabled={historial.length === 0} sx={{ height: 40, borderRadius: 2, fontWeight: 600 }}>CSV</Button>
                </Stack>
              </LocalizationProvider>
            </Paper>

            {/* Summary KPIs for historial */}
            <Grid container spacing={2} sx={{ mb: 2.5 }}>
              <Grid item xs={6} sm={3}>
                <KpiCard label="Órdenes" value={historial.length} icon={<WorkHistory />} color={BLUE} />
              </Grid>
              <Grid item xs={6} sm={3}>
                <KpiCard label="Cobradas" value={pagadasHistorial} icon={<CheckCircle />} color={GREEN} subtitle={`${historial.length > 0 ? Math.round(pagadasHistorial / historial.length * 100) : 0}% del historial`} />
              </Grid>
              <Grid item xs={6} sm={3}>
                <KpiCard label="Total facturado" value={formatCurrency(totalHistorial)} icon={<TrendingUp />} color={ACCENT} />
              </Grid>
              <Grid item xs={6} sm={3}>
                <KpiCard label="Ticket promedio" value={historial.length > 0 ? formatCurrency(totalHistorial / historial.length) : '$0'} icon={<EmojiEvents />} color={YELLOW} />
              </Grid>
            </Grid>

            {isMobile ? (
              <Box>
                {historial.length === 0 ? (
                  <Box sx={{ textAlign: 'center', py: 6, color: 'text.secondary' }}>
                    <Assignment sx={{ fontSize: 48, mb: 1, opacity: 0.3 }} />
                    <Typography>No hay órdenes cerradas en el período</Typography>
                  </Box>
                ) : (
                  historialSorted.map(orden => <HistorialCard key={orden.id} orden={orden} onView={handleViewDetails} />)
                )}
              </Box>
            ) : (
              <>
                <TableContainer sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider', overflowX: 'auto' }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ bgcolor: 'action.hover' }}>
                        <HistSortTh col="fecha">ID / Fecha</HistSortTh>
                        <HistSortTh col="cliente">Cliente</HistSortTh>
                        <TableCell sx={{ fontWeight: 700 }}>Servicios / Productos</TableCell>
                        <HistSortTh col="total" align="right">Total</HistSortTh>
                        <HistSortTh col="pago">Estado Pago</HistSortTh>
                        <TableCell sx={{ fontWeight: 700 }}>Acciones</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {historialPaginado.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} sx={{ textAlign: 'center', py: 6, color: 'text.secondary' }}>
                            No hay órdenes cerradas en el período
                          </TableCell>
                        </TableRow>
                      ) : (
                        historialPaginado.map(orden => (
                          <TableRow key={orden.id} hover>
                            <TableCell>
                              <Typography sx={{ fontWeight: 600, fontSize: 13 }}>#{orden.id}</Typography>
                              <Typography sx={{ fontSize: 10, color: 'text.disabled' }}>{new Date(orden.fecha_actualizacion).toLocaleDateString()}</Typography>
                            </TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>{orden.cliente_nombre}</TableCell>
                            <TableCell sx={{ fontSize: 11 }}>
                              {orden.servicios?.length > 0 && <Box sx={{ color: BLUE, fontWeight: 600 }}>{orden.servicios.map(s => s.servicio.nombre).join(', ')}</Box>}
                              {orden.productos?.length > 0 && <Box sx={{ color: 'text.secondary' }}>{orden.productos.map(p => `${p.producto.nombre} ×${p.cantidad}`).join(', ')}</Box>}
                            </TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700 }}>{formatCurrency(orden.total)}</TableCell>
                            <TableCell>
                              <Chip
                                label={orden.estado_pago_venta === 'pagado' ? 'Pagado' : 'Pendiente'}
                                color={orden.estado_pago_venta === 'pagado' ? 'success' : 'warning'}
                                size="small"
                                sx={{ fontWeight: 600, fontSize: 10, borderRadius: 1.5 }}
                              />
                            </TableCell>
                            <TableCell>
                              <IconButton size="small" onClick={() => handleViewDetails(orden)} sx={{ color: BLUE }}>
                                <Visibility fontSize="small" />
                              </IconButton>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
                <TablePagination
                  component="div"
                  count={historialSorted.length}
                  page={histPage}
                  onPageChange={(_, p) => setHistPage(p)}
                  rowsPerPage={histRowsPerPage}
                  onRowsPerPageChange={e => { setHistRowsPerPage(parseInt(e.target.value)); setHistPage(0); }}
                  rowsPerPageOptions={[10, 15, 25, 50]}
                  labelRowsPerPage="Filas:"
                  labelDisplayedRows={({ from, to, count }) => `${from}-${to} de ${count}`}
                />
              </>
            )}
          </Box>
        </TabPanel>
      </Paper>

      <OrdenTrabajoDetailDialog open={showDetailDialog} handleClose={() => setShowDetailDialog(false)} orden={selectedOrden} />
    </Box>
  );
};

export default PanelOperador;
