import React, { useState, useEffect, useMemo } from 'react';
import {
  Box, Typography, Button, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Chip, IconButton, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, MenuItem, Grid, Divider, useTheme, useMediaQuery,
  Tabs, Tab, Stack, Tooltip, Autocomplete, Alert, InputAdornment,
  TableSortLabel, TablePagination
} from '@mui/material';
import {
  Add, Cancel, PrecisionManufacturing, Assignment, CheckCircleOutline,
  History, Inventory2, Search, FileDownload
} from '@mui/icons-material';
import { fetchLotes, createLote, confirmarLote, cancelarLote, fetchRecetas } from '../../api';
import apiClient from '../../api';
import { toast } from 'react-toastify';
import { formatCurrency } from '../../utils/formatters';

const ACCENT  = '#06B6D4';
const GREEN   = '#10B981';
const RED     = '#EF4444';
const PURPLE  = '#8B5CF6';

function TabPanel({ children, value, index }) {
  return <div role="tabpanel" hidden={value !== index}>{value === index && <Box sx={{ pt: 3 }}>{children}</Box>}</div>;
}

// Helper: coercion segura de maneja_lotes (puede llegar NULL/0/1 desde Postgres)
const esPerecible = (producto) => {
  if (!producto) return false;
  const v = producto.maneja_lotes;
  if (v === null || v === undefined) return false;
  return Boolean(v);
};

// SortHeader helper for historial table
function SortHeader({ col, label, histSortCol, histSortDir, onSort }) {
  return (
    <TableCell
      sortDirection={histSortCol === col ? histSortDir : false}
      sx={{ fontWeight: 600 }}
    >
      <TableSortLabel
        active={histSortCol === col}
        direction={histSortCol === col ? histSortDir : 'asc'}
        onClick={() => onSort(col)}
      >
        {label}
      </TableSortLabel>
    </TableCell>
  );
}

const Lotes = () => {
  const theme    = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [tab, setTab]         = useState(0);
  const [lotes, setLotes]     = useState([]);
  const [recetas, setRecetas] = useState([]);
  const [clientes, setClientes] = useState([]);

  const [open, setOpen]               = useState(false);
  const [openConfirm, setOpenConfirm] = useState(false);
  const [selectedLote, setSelectedLote] = useState(null);
  const [loading, setLoading]         = useState(false);

  const [formData, setFormData]       = useState({ receta_id: '', cantidad_a_producir: '', cliente_id: '', observaciones: '', numero_lote_produccion: '' });
  const [confirmData, setConfirmData] = useState({
    cantidad_real:     '',
    observaciones:     '',
    numero_lote:       '',
    fecha_vencimiento: '',
    fecha_fabricacion: '',
  });

  const [simulacion, setSimulacion]   = useState(null);
  const [simulando, setSimulando]     = useState(false);

  // ── Confirm-cancel dialog (replaces window.confirm)
  const [confirmCancelId, setConfirmCancelId] = useState(null);

  // ── Búsqueda en tab activo
  const [busquedaActivo, setBusquedaActivo] = useState('');

  // ── Historial search + date filter
  const [busquedaHist, setBusquedaHist] = useState('');
  const [histDesde, setHistDesde]       = useState('');
  const [histHasta, setHistHasta]       = useState('');

  // ── Historial sort
  const [histSortCol, setHistSortCol] = useState('fecha');
  const [histSortDir, setHistSortDir] = useState('desc');

  // ── Historial pagination
  const [histPage, setHistPage] = useState(0);
  const [histPP, setHistPP]     = useState(10);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [lotResponse, recResponse, cliResponse] = await Promise.all([
        fetchLotes(), fetchRecetas(), apiClient.get('/clientes/')
      ]);
      setLotes(lotResponse.data);
      setRecetas(recResponse.data);
      setClientes(cliResponse.data.filter(c => c.es_cliente));
    } catch { toast.error('Error cargando el panel de producción'); }
  };

  const handleOpenConfirm = (lote) => {
    setSelectedLote(lote);
    setConfirmData({
      cantidad_real:     lote.cantidad_a_producir,
      observaciones:     '',
      numero_lote:       '',
      fecha_vencimiento: '',
      fecha_fabricacion: '',
    });
    setOpenConfirm(true);
  };

  // ¿El producto resultante del lote seleccionado maneja_lotes?
  const productoResultante   = selectedLote?.receta?.producto_resultante;
  const productoEsPerecible  = esPerecible(productoResultante);

  const handleConfirmarFinal = async () => {
    if (productoEsPerecible) {
      if (!confirmData.numero_lote.trim()) {
        toast.warning('El producto es perecedero. Debes ingresar el Número de Lote.');
        return;
      }
      if (!confirmData.fecha_vencimiento) {
        toast.warning('El producto es perecedero. Debes ingresar la Fecha de Vencimiento.');
        return;
      }
    }

    setLoading(true);
    try {
      await confirmarLote(selectedLote.id, {
        cantidad_real:     parseFloat(confirmData.cantidad_real),
        precios_servicios: [],
        observaciones:     confirmData.observaciones,
        ...(productoEsPerecible && {
          numero_lote:       confirmData.numero_lote.trim().toUpperCase(),
          fecha_vencimiento: confirmData.fecha_vencimiento,
          fecha_fabricacion: confirmData.fecha_fabricacion || undefined,
        }),
      });
      toast.success('¡Lote finalizado! Inventario actualizado correctamente.');
      loadData();
      setOpenConfirm(false);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al finalizar el lote');
    } finally { setLoading(false); }
  };

  // ── Cancel handlers (MUI Dialog instead of window.confirm)
  const handleCancelarConfirmado = async () => {
    if (!confirmCancelId) return;
    try {
      await cancelarLote(confirmCancelId);
      toast.info('Orden de producción cancelada');
      loadData();
    } catch {
      toast.error('Error al cancelar la orden');
    } finally {
      setConfirmCancelId(null);
    }
  };

  const lotesEnPlanta  = lotes.filter(l => l.estado === 'En produccion');
  const lotesHistorial = lotes.filter(l => l.estado !== 'En produccion');

  // ── Filtro tab activo
  const lotesEnPlantaFiltrados = useMemo(() => {
    if (!busquedaActivo) return lotesEnPlanta;
    const q = busquedaActivo.toLowerCase();
    return lotesEnPlanta.filter(l =>
      l.receta?.producto_resultante?.nombre?.toLowerCase().includes(q) ||
      l.receta?.nombre?.toLowerCase().includes(q) ||
      String(l.id).includes(q)
    );
  }, [lotesEnPlanta, busquedaActivo]);

  // ── Eficiencia promedio (confirmados)
  const eficienciaPromedio = useMemo(() => {
    const confirmados = lotesHistorial.filter(l => l.estado === 'Confirmado' && l.cantidad_a_producir > 0);
    if (confirmados.length === 0) return null;
    const suma = confirmados.reduce((s, l) => s + (l.cantidad_real || 0) / l.cantidad_a_producir * 100, 0);
    return suma / confirmados.length;
  }, [lotesHistorial]);

  // ── Simulation debounce
  useEffect(() => {
    if (formData.receta_id && formData.cantidad_a_producir > 0) {
      setSimulando(true);
      const timer = setTimeout(() => {
        apiClient.get(`/produccion/recetas/${formData.receta_id}/simular?cantidad=${formData.cantidad_a_producir}`)
          .then(res => setSimulacion(res.data))
          .catch(() => setSimulacion(null))
          .finally(() => setSimulando(false));
      }, 500);
      return () => clearTimeout(timer);
    } else {
      setSimulacion(null);
    }
  }, [formData.receta_id, formData.cantidad_a_producir]);

  // ── Historial filter
  const lotesHistorialFiltrado = useMemo(() => {
    const q = busquedaHist.toLowerCase();
    return lotesHistorial.filter(l => {
      const matchBusqueda = !busquedaHist ||
        l.receta?.producto_resultante?.nombre?.toLowerCase().includes(q) ||
        String(l.id).includes(q);
      const fechaCierre = l.fecha_confirmacion ? new Date(l.fecha_confirmacion) : null;
      const matchDesde  = !histDesde || (fechaCierre && fechaCierre >= new Date(histDesde));
      const matchHasta  = !histHasta || (fechaCierre && fechaCierre <= new Date(histHasta + 'T23:59:59'));
      return matchBusqueda && matchDesde && matchHasta;
    });
  }, [lotesHistorial, busquedaHist, histDesde, histHasta]);

  // ── Historial sort
  const handleHistSort = (col) => {
    if (histSortCol === col) {
      setHistSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setHistSortCol(col);
      setHistSortDir('asc');
    }
    setHistPage(0);
  };

  const lotesHistorialOrdenado = useMemo(() => {
    return [...lotesHistorialFiltrado].sort((a, b) => {
      if (histSortCol === 'fecha') {
        const da = a.fecha_confirmacion ? new Date(a.fecha_confirmacion) : new Date(0);
        const db = b.fecha_confirmacion ? new Date(b.fecha_confirmacion) : new Date(0);
        return histSortDir === 'asc' ? da - db : db - da;
      }
      if (histSortCol === 'producto') {
        const na = a.receta?.producto_resultante?.nombre ?? '';
        const nb = b.receta?.producto_resultante?.nombre ?? '';
        return histSortDir === 'asc' ? na.localeCompare(nb) : nb.localeCompare(na);
      }
      if (histSortCol === 'cantidad') {
        return histSortDir === 'asc'
          ? (a.cantidad_real || 0) - (b.cantidad_real || 0)
          : (b.cantidad_real || 0) - (a.cantidad_real || 0);
      }
      if (histSortCol === 'costo') {
        return histSortDir === 'asc'
          ? (a.costo_unitario_resultado || 0) - (b.costo_unitario_resultado || 0)
          : (b.costo_unitario_resultado || 0) - (a.costo_unitario_resultado || 0);
      }
      return 0;
    });
  }, [lotesHistorialFiltrado, histSortCol, histSortDir]);

  // ── Historial pagination
  const lotesHistorialPaginado = useMemo(() =>
    lotesHistorialOrdenado.slice(histPage * histPP, histPage * histPP + histPP),
    [lotesHistorialOrdenado, histPage, histPP]
  );

  // Reset page when filter changes
  useEffect(() => { setHistPage(0); }, [busquedaHist, histDesde, histHasta]);

  // ── CSV export
  const exportHistorialCSV = () => {
    const headers = ['#', 'Producto', 'Fecha Cierre', 'Cant. Esperada', 'Cant. Real', 'Merma/Sobrante', 'Costo Unit.', 'Estado'];
    const rows = lotesHistorialOrdenado.map(l => {
      const merma = l.estado === 'Confirmado' ? (l.cantidad_real || 0) - l.cantidad_a_producir : 0;
      return [
        l.id,
        l.receta?.producto_resultante?.nombre ?? '',
        l.fecha_confirmacion ? new Date(l.fecha_confirmacion).toLocaleDateString('es-CO') : '',
        l.cantidad_a_producir,
        l.cantidad_real ?? '',
        merma !== 0 ? merma : '',
        l.costo_unitario_resultado ?? '',
        l.estado,
      ];
    });
    const csv = [headers, ...rows]
      .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = 'historial_produccion.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  // ── KPI derived values
  const kpiCanceladas   = lotesHistorial.filter(l => l.estado === 'Cancelado').length;
  const kpiCostoTotal   = formatCurrency(
    lotesHistorial
      .filter(l => l.estado === 'Confirmado')
      .reduce((s, l) => s + (l.cantidad_real || 0) * (l.costo_unitario_resultado || 0), 0)
  );

  return (
    <Box sx={{ width: '100%', overflowX: 'hidden' }}>

      {/* ── Header ── */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ width: 40, height: 40, borderRadius: 2, bgcolor: `${ACCENT}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: ACCENT }}>
            <PrecisionManufacturing />
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 700, fontSize: { xs: 18, sm: 20 }, lineHeight: 1.2 }}>Órdenes de Producción</Typography>
            <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>Control de planta, mermas y generación de lotes</Typography>
          </Box>
        </Box>
        <Button variant="contained" startIcon={<Add />} onClick={() => setOpen(true)}
          sx={{ background: `linear-gradient(135deg, ${ACCENT}, #22d3ee)`, boxShadow: `0 4px 14px rgba(6,182,212,0.35)`, borderRadius: 2, fontWeight: 600, width: isMobile ? '100%' : 'auto' }}>
          Lanzar Producción
        </Button>
      </Box>

      {/* ── KPIs ── */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={6} sm={6} md={3}>
          <Paper sx={{ p: 2.5, borderRadius: 3, display: 'flex', alignItems: 'center', gap: 2, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
            <Assignment sx={{ color: '#F59E0B', fontSize: 32 }} />
            <Box>
              <Typography sx={{ fontSize: 12, color: 'text.secondary', fontWeight: 600 }}>EN PLANTA AHORA</Typography>
              <Typography sx={{ fontSize: 22, fontWeight: 800 }}>
                {lotesEnPlanta.length} <span style={{ fontSize: 14, fontWeight: 500, color: '#64748b' }}>Lotes activos</span>
              </Typography>
            </Box>
          </Paper>
        </Grid>
        <Grid item xs={6} sm={6} md={3}>
          <Paper sx={{ p: 2.5, borderRadius: 3, display: 'flex', alignItems: 'center', gap: 2, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
            <CheckCircleOutline sx={{ color: GREEN, fontSize: 32 }} />
            <Box>
              <Typography sx={{ fontSize: 12, color: 'text.secondary', fontWeight: 600 }}>PRODUCCIÓN HISTÓRICA</Typography>
              <Typography sx={{ fontSize: 22, fontWeight: 800 }}>
                {lotesHistorial.filter(l => l.estado === 'Confirmado').reduce((acc, l) => acc + (l.cantidad_real || 0), 0)}{' '}
                <span style={{ fontSize: 14, fontWeight: 500, color: '#64748b' }}>Unidades Creadas</span>
              </Typography>
            </Box>
          </Paper>
        </Grid>
        <Grid item xs={6} sm={6} md={3}>
          <Paper sx={{ p: 2.5, borderRadius: 3, display: 'flex', alignItems: 'center', gap: 2, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
            <Cancel sx={{ color: RED, fontSize: 32 }} />
            <Box>
              <Typography sx={{ fontSize: 12, color: 'text.secondary', fontWeight: 600 }}>ÓRDENES CANCELADAS</Typography>
              <Typography sx={{ fontSize: 22, fontWeight: 800 }}>
                {kpiCanceladas} <span style={{ fontSize: 14, fontWeight: 500, color: '#64748b' }}>Canceladas</span>
              </Typography>
            </Box>
          </Paper>
        </Grid>
        <Grid item xs={6} sm={6} md={3}>
          <Paper sx={{ p: 2.5, borderRadius: 3, display: 'flex', alignItems: 'center', gap: 2, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
            <Inventory2 sx={{ color: PURPLE, fontSize: 32 }} />
            <Box>
              <Typography sx={{ fontSize: 12, color: 'text.secondary', fontWeight: 600 }}>COSTO TOTAL PRODUCIDO</Typography>
              <Typography sx={{ fontSize: 18, fontWeight: 800, lineHeight: 1.3 }}>{kpiCostoTotal}</Typography>
            </Box>
          </Paper>
        </Grid>
        {eficienciaPromedio !== null && (
          <Grid item xs={12} sm={6} md={3}>
            <Paper sx={{ p: 2.5, borderRadius: 3, display: 'flex', alignItems: 'center', gap: 2, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
              <CheckCircleOutline sx={{ color: eficienciaPromedio >= 95 ? GREEN : eficienciaPromedio >= 80 ? '#F59E0B' : RED, fontSize: 32 }} />
              <Box>
                <Typography sx={{ fontSize: 12, color: 'text.secondary', fontWeight: 600 }}>EFICIENCIA PROMEDIO</Typography>
                <Typography sx={{ fontSize: 22, fontWeight: 800, color: eficienciaPromedio >= 95 ? GREEN : eficienciaPromedio >= 80 ? '#F59E0B' : RED }}>
                  {eficienciaPromedio.toFixed(1)}%
                </Typography>
                <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>real vs planificado</Typography>
              </Box>
            </Paper>
          </Grid>
        )}
      </Grid>

      {/* ── TABS ── */}
      <Paper sx={{ borderRadius: 3, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', overflow: 'hidden', width: '100%' }}>
        <Tabs
          value={tab} onChange={(_, v) => setTab(v)}
          variant={isMobile ? 'scrollable' : 'standard'}
          scrollButtons="auto" allowScrollButtonsMobile
          sx={{
            px: { xs: 1, md: 2 }, borderBottom: '1px solid', borderColor: 'divider',
            '& .MuiTab-root': { fontWeight: 600, fontSize: 13, textTransform: 'none', minHeight: 52, whiteSpace: 'nowrap' },
            '& .MuiTabs-indicator': { backgroundColor: ACCENT, height: 3, borderRadius: 3 },
            '& .Mui-selected': { color: `${ACCENT} !important` }
          }}
        >
          <Tab icon={<PrecisionManufacturing sx={{ fontSize: 18, mr: 1 }} />} iconPosition="start" label={`En Producción (${lotesEnPlanta.length})`} />
          <Tab icon={<History sx={{ fontSize: 18, mr: 1 }} />} iconPosition="start" label="Historial Terminado" />
        </Tabs>

        <Box sx={{ p: { xs: 2, md: 3 } }}>
          {/* TAB 0: EN PLANTA */}
          <TabPanel value={tab} index={0}>
            {lotesEnPlanta.length > 0 && (
              <Box sx={{ mb: 2 }}>
                <TextField
                  size="small" fullWidth placeholder="Buscar por producto, receta o N° orden…"
                  value={busquedaActivo}
                  onChange={e => setBusquedaActivo(e.target.value)}
                  InputProps={{ startAdornment: <InputAdornment position="start"><Search sx={{ fontSize: 18 }} /></InputAdornment> }}
                  sx={{ maxWidth: 400 }}
                />
                {busquedaActivo && (
                  <Typography variant="caption" sx={{ color: 'text.secondary', ml: 1 }}>
                    {lotesEnPlantaFiltrados.length} de {lotesEnPlanta.length} órdenes
                  </Typography>
                )}
              </Box>
            )}
            {lotesEnPlantaFiltrados.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 6, color: 'text.secondary' }}>
                <PrecisionManufacturing sx={{ fontSize: 48, mb: 1, opacity: 0.2 }} />
                <Typography>{lotesEnPlanta.length === 0 ? 'La planta está libre. No hay órdenes en proceso.' : 'Sin resultados para esta búsqueda.'}</Typography>
              </Box>
            ) : (
              <Grid container spacing={2}>
                {lotesEnPlantaFiltrados.map(l => (
                  <Grid item xs={12} md={6} key={l.id}>
                    <Paper sx={{ p: 2.5, borderRadius: 3, borderLeft: '4px solid #F59E0B', border: '1px solid', borderColor: 'divider', position: 'relative' }}>
                      <Box sx={{ position: 'absolute', top: 16, right: 16, display: 'flex', gap: 0.5, alignItems: 'center' }}>
                        {esPerecible(l.receta?.producto_resultante) && (
                          <Chip label="Perecedero" size="small" sx={{ bgcolor: `${PURPLE}15`, color: PURPLE, fontWeight: 600, fontSize: 10 }} />
                        )}
                        <Chip label="En Curso" size="small" sx={{ bgcolor: '#FEF3C7', color: '#D97706', fontWeight: 600, fontSize: 10 }} />
                      </Box>
                      <Typography sx={{ fontSize: 11, color: 'text.secondary', fontWeight: 600 }}>
                        ORDEN #{l.id}{l.numero_lote_produccion ? ` · ${l.numero_lote_produccion}` : ''} · {new Date(l.fecha_planificada).toLocaleDateString()}
                      </Typography>
                      <Typography sx={{ fontWeight: 800, fontSize: 18, mt: 0.5, mb: 1 }}>
                        {l.receta.producto_resultante.nombre}
                      </Typography>
                      <Divider sx={{ my: 1.5 }} />
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                        <Box>
                          <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>Cantidad Solicitada</Typography>
                          <Typography sx={{ fontWeight: 700, fontSize: 16 }}>
                            {l.cantidad_a_producir} {l.receta.producto_resultante.unidad_medida}
                          </Typography>
                        </Box>
                        <Box sx={{ textAlign: 'right' }}>
                          <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>Destino</Typography>
                          <Typography sx={{ fontWeight: 600, fontSize: 13, color: ACCENT }}>
                            {(!l.cliente || l.cliente.cedula === 'INTERNO') ? 'Inventario Interno' : `Maquila: ${l.cliente.nombre}`}
                          </Typography>
                        </Box>
                      </Box>
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <Button fullWidth variant="contained" color="success" onClick={() => handleOpenConfirm(l)}
                          sx={{ fontWeight: 600, borderRadius: 2, bgcolor: GREEN, '&:hover': { bgcolor: '#059669' }, boxShadow: 'none' }}>
                          Finalizar Lote
                        </Button>
                        <Tooltip title="Cancelar Orden">
                          <IconButton onClick={() => setConfirmCancelId(l.id)} sx={{ color: RED, bgcolor: '#FEF2F2', borderRadius: 2 }}>
                            <Cancel />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </Paper>
                  </Grid>
                ))}
              </Grid>
            )}
          </TabPanel>

          {/* TAB 1: HISTORIAL */}
          <TabPanel value={tab} index={1}>
            {/* Filter bar */}
            <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
              <TextField
                size="small"
                placeholder="Buscar producto..."
                value={busquedaHist}
                onChange={e => setBusquedaHist(e.target.value)}
                sx={{ flex: 1, minWidth: 160 }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search sx={{ fontSize: 18 }} />
                    </InputAdornment>
                  )
                }}
              />
              <TextField
                type="date" label="Desde" size="small"
                value={histDesde}
                onChange={e => setHistDesde(e.target.value)}
                InputLabelProps={{ shrink: true }}
                sx={{ minWidth: 140 }}
              />
              <TextField
                type="date" label="Hasta" size="small"
                value={histHasta}
                onChange={e => setHistHasta(e.target.value)}
                InputLabelProps={{ shrink: true }}
                sx={{ minWidth: 140 }}
              />
              {(busquedaHist || histDesde || histHasta) && (
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => { setBusquedaHist(''); setHistDesde(''); setHistHasta(''); }}
                  sx={{ borderRadius: 2, borderColor: 'divider', color: 'text.secondary', fontWeight: 600 }}
                >
                  Limpiar
                </Button>
              )}
              <Tooltip title="Exportar CSV">
                <IconButton
                  size="small"
                  onClick={exportHistorialCSV}
                  sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, color: GREEN }}
                >
                  <FileDownload fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>

            {isMobile ? (
              <Box>
                {lotesHistorialPaginado.length === 0
                  ? <Box sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}><Typography>No hay historial</Typography></Box>
                  : lotesHistorialPaginado.map(l => {
                      const merma     = l.estado === 'Confirmado' ? l.cantidad_real - l.cantidad_a_producir : 0;
                      const isSuccess = l.estado === 'Confirmado';
                      return (
                        <Paper key={l.id} sx={{ p: 2, mb: 2, borderRadius: 3, borderLeft: `4px solid ${isSuccess ? GREEN : RED}`, border: '1px solid', borderColor: 'divider' }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                            <Typography sx={{ fontWeight: 600, color: 'text.secondary', fontSize: 12 }}>#{l.id}</Typography>
                            <Chip label={l.estado} size="small" sx={{ bgcolor: isSuccess ? `${GREEN}15` : `${RED}15`, color: isSuccess ? GREEN : RED, fontWeight: 600, fontSize: 10, borderRadius: 1 }} />
                          </Box>
                          <Typography sx={{ fontWeight: 800, fontSize: 16 }}>{l.receta.producto_resultante.nombre}</Typography>
                          <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 1.5 }}>
                            Cierre: {l.fecha_confirmacion ? new Date(l.fecha_confirmacion).toLocaleDateString() : '—'}
                          </Typography>
                          <Divider sx={{ my: 1 }} />
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Box>
                              <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>Rendimiento</Typography>
                              <Typography sx={{ fontWeight: 700, fontSize: 14 }}>{isSuccess ? `${l.cantidad_real} Unds` : '—'}</Typography>
                              {isSuccess && merma !== 0 && (
                                <Typography sx={{ fontSize: 11, fontWeight: 600, color: merma > 0 ? GREEN : RED }}>
                                  {merma > 0 ? `+${merma} sobrante` : `${merma} merma`}
                                </Typography>
                              )}
                            </Box>
                            <Box sx={{ textAlign: 'right' }}>
                              <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>Costo Unit.</Typography>
                              <Typography sx={{ fontWeight: 700, fontSize: 14 }}>{isSuccess ? formatCurrency(l.costo_unitario_resultado) : '—'}</Typography>
                            </Box>
                          </Box>
                        </Paper>
                      );
                    })
                }
                <TablePagination
                  component="div"
                  count={lotesHistorialOrdenado.length}
                  page={histPage}
                  onPageChange={(_, p) => setHistPage(p)}
                  rowsPerPage={histPP}
                  onRowsPerPageChange={e => { setHistPP(parseInt(e.target.value, 10)); setHistPage(0); }}
                  rowsPerPageOptions={[5, 10, 25, 50]}
                  labelRowsPerPage="Por página:"
                  labelDisplayedRows={({ from, to, count }) => `${from}–${to} de ${count}`}
                />
              </Box>
            ) : (
              <>
                <TableContainer sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                  <Table size="small">
                    <TableHead sx={{ bgcolor: 'action.hover' }}>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 600 }}>Lote</TableCell>
                        <SortHeader col="fecha"    label="Fecha Fin"           histSortCol={histSortCol} histSortDir={histSortDir} onSort={handleHistSort} />
                        <SortHeader col="producto" label="Producto Creado"     histSortCol={histSortCol} histSortDir={histSortDir} onSort={handleHistSort} />
                        <SortHeader col="cantidad" label="Rendimiento (Mermas)" histSortCol={histSortCol} histSortDir={histSortDir} onSort={handleHistSort} />
                        <SortHeader col="costo"    label="Costo Unitario"      histSortCol={histSortCol} histSortDir={histSortDir} onSort={handleHistSort} />
                        <TableCell sx={{ fontWeight: 600 }}>Estado</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {lotesHistorialPaginado.length === 0
                        ? <TableRow><TableCell colSpan={6} align="center" sx={{ py: 4 }}>No hay historial</TableCell></TableRow>
                        : lotesHistorialPaginado.map(l => {
                            const merma = l.estado === 'Confirmado' ? l.cantidad_real - l.cantidad_a_producir : 0;
                            return (
                              <TableRow key={l.id} hover>
                                <TableCell sx={{ fontWeight: 600, color: 'text.secondary', fontSize: 12 }}>#{l.id}</TableCell>
                                <TableCell sx={{ fontSize: 12 }}>{l.fecha_confirmacion ? new Date(l.fecha_confirmacion).toLocaleDateString() : '—'}</TableCell>
                                <TableCell sx={{ fontWeight: 700 }}>{l.receta.producto_resultante.nombre}</TableCell>
                                <TableCell>
                                  {l.estado === 'Confirmado' ? (
                                    <Box>
                                      <Typography sx={{ fontWeight: 700, fontSize: 13 }}>{l.cantidad_real} Unds</Typography>
                                      {merma !== 0 && (
                                        <Typography sx={{ fontSize: 11, fontWeight: 600, color: merma > 0 ? GREEN : RED }}>
                                          {merma > 0 ? `+${merma} sobrante` : `${merma} merma`} vs Plan
                                        </Typography>
                                      )}
                                      {l.cantidad_a_producir > 0 && (
                                        <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>
                                          {((l.cantidad_real / l.cantidad_a_producir) * 100).toFixed(1)}% efic.
                                        </Typography>
                                      )}
                                    </Box>
                                  ) : '—'}
                                </TableCell>
                                <TableCell sx={{ fontWeight: 600 }}>
                                  {l.estado === 'Confirmado' ? (
                                    <Box>
                                      <Typography sx={{ fontWeight: 700, fontSize: 13 }}>{formatCurrency(l.costo_unitario_resultado)}/u</Typography>
                                      {(l.costo_insumos > 0 || l.costo_maquila > 0) && (
                                        <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>
                                          📦 {formatCurrency(l.costo_insumos)} + ⚙️ {formatCurrency(l.costo_maquila)}
                                        </Typography>
                                      )}
                                    </Box>
                                  ) : '—'}
                                </TableCell>
                                <TableCell>
                                  <Chip
                                    label={l.estado}
                                    size="small"
                                    sx={{
                                      bgcolor: l.estado === 'Confirmado' ? `${GREEN}15` : `${RED}15`,
                                      color: l.estado === 'Confirmado' ? GREEN : RED,
                                      fontWeight: 600, fontSize: 10, borderRadius: 1
                                    }}
                                  />
                                </TableCell>
                              </TableRow>
                            );
                          })
                      }
                    </TableBody>
                  </Table>
                </TableContainer>
                <TablePagination
                  component="div"
                  count={lotesHistorialOrdenado.length}
                  page={histPage}
                  onPageChange={(_, p) => setHistPage(p)}
                  rowsPerPage={histPP}
                  onRowsPerPageChange={e => { setHistPP(parseInt(e.target.value, 10)); setHistPage(0); }}
                  rowsPerPageOptions={[5, 10, 25, 50]}
                  labelRowsPerPage="Por página:"
                  labelDisplayedRows={({ from, to, count }) => `${from}–${to} de ${count}`}
                />
              </>
            )}
          </TabPanel>
        </Box>
      </Paper>

      {/* ════ MODAL: Lanzar Producción ════ */}
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <Box sx={{ height: 4, bgcolor: ACCENT }} />
        <DialogTitle sx={{ fontWeight: 800, fontSize: 18 }}>Lanzar Orden de Producción</DialogTitle>
        <DialogContent dividers sx={{ p: { xs: 2, sm: 3 } }}>
          <Stack spacing={2.5}>
            <Autocomplete
              options={recetas}
              getOptionLabel={(option) => `${option.nombre} (Produce: ${option.producto_resultante?.nombre || ''})`}
              value={recetas.find(r => r.id === parseInt(formData.receta_id)) || null}
              onChange={(e, newValue) => setFormData({ ...formData, receta_id: newValue ? newValue.id : '' })}
              renderOption={(props, option) => (
                <li {...props} style={{ padding: '12px 16px', borderBottom: '1px solid #e2e8f0', display: 'block' }}>
                  <Typography sx={{ fontWeight: 600, fontSize: 14 }}>{option.nombre}</Typography>
                  <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>Produce: {option.producto_resultante?.nombre}</Typography>
                </li>
              )}
              renderInput={(params) => (
                <TextField {...params} label="Fórmula a Producir *" placeholder="Busca por nombre..." fullWidth />
              )}
              noOptionsText="No hay recetas creadas"
            />

            <Box sx={{ p: 2, borderRadius: 2, bgcolor: 'background.default', border: '1px solid', borderColor: 'divider' }}>
              <Typography sx={{ fontSize: 11, fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', mb: 1.5 }}>Configuración del Lote</Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField fullWidth type="number" label="Cantidad Esperada *"
                    value={formData.cantidad_a_producir}
                    onChange={(e) => setFormData({ ...formData, cantidad_a_producir: e.target.value })} />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="N° Orden Producción (opcional)"
                    value={formData.numero_lote_produccion}
                    onChange={(e) => setFormData({ ...formData, numero_lote_produccion: e.target.value.toUpperCase() })}
                    placeholder="Ej: OP-2026-001"
                    helperText="Identificador interno del lote"
                    size="small"
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField select fullWidth label="Destino (Cliente o Bodega)"
                    value={formData.cliente_id}
                    onChange={(e) => setFormData({ ...formData, cliente_id: e.target.value })}
                    SelectProps={{ MenuProps: { PaperProps: { sx: { borderRadius: 2 } } } }}
                  >
                    <MenuItem value="" sx={{ py: 1.5 }}>🏢 Para mi Inventario</MenuItem>
                    {clientes.map(c => (
                      <MenuItem key={c.id} value={c.id} sx={{ py: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
                        👤 Maquila: {c.nombre}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>
              </Grid>
            </Box>

            {simulando ? (
              <Typography sx={{ fontSize: 12, color: 'text.secondary', textAlign: 'center' }}>Analizando inventario...</Typography>
            ) : simulacion ? (
              <Box sx={{ p: 2, borderRadius: 2, border: '1px solid', borderColor: simulacion.factible ? '#10B98150' : '#EF444450', bgcolor: simulacion.factible ? '#10B9810A' : '#EF44440A' }}>
                <Typography sx={{ fontWeight: 700, fontSize: 13, color: simulacion.factible ? '#10B981' : '#EF4444', mb: 1 }}>
                  {simulacion.factible ? '✅ Inventario suficiente para esta producción' : '⚠️ Faltan insumos en inventario'}
                </Typography>
                {!simulacion.factible && (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mb: 2 }}>
                    {simulacion.faltantes.map(f => (
                      <Typography key={f.insumo_id} sx={{ fontSize: 12, color: '#EF4444' }}>
                        • Falta <strong>{f.faltante} {f.unidad}</strong> de {f.nombre} (Req: {f.requerido} | Disp: {f.disponible})
                      </Typography>
                    ))}
                    <Typography sx={{ fontSize: 11, color: 'text.secondary', mt: 0.5 }}>
                      *Puedes crear el lote para planificarlo, pero no podrás finalizarlo hasta ingresar el stock faltante.
                    </Typography>
                  </Box>
                )}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed', borderColor: 'divider', pt: 1, mt: 1 }}>
                  <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>Costo estimado:</Typography>
                  <Typography sx={{ fontSize: 13, fontWeight: 700 }}>{formatCurrency(simulacion.costo_teorico_total)}</Typography>
                </Box>
              </Box>
            ) : null}

            <TextField fullWidth multiline rows={2} label="Notas u observaciones para el operador"
              value={formData.observaciones}
              onChange={(e) => setFormData({ ...formData, observaciones: e.target.value })}
              placeholder="Ej: Usar lote antiguo de azúcar..." />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: { xs: 2, sm: 3 }, py: 2 }}>
          <Button onClick={() => setOpen(false)} sx={{ color: 'text.secondary', fontWeight: 600 }}>Cancelar</Button>
          <Button variant="contained" onClick={async () => {
            if (!formData.receta_id || !formData.cantidad_a_producir) { toast.warning('Completa receta y cantidad'); return; }
            await createLote({ ...formData, cliente_id: formData.cliente_id ? Number(formData.cliente_id) : null, receta_id: Number(formData.receta_id), cantidad_a_producir: Number(formData.cantidad_a_producir), numero_lote_produccion: formData.numero_lote_produccion || null });
            loadData(); setOpen(false);
            setFormData({ receta_id: '', cantidad_a_producir: '', cliente_id: '', observaciones: '', numero_lote_produccion: '' });
            toast.success('Orden enviada a planta');
          }} sx={{ bgcolor: ACCENT, '&:hover': { bgcolor: '#0891B2' }, fontWeight: 600 }}>
            Enviar a Planta
          </Button>
        </DialogActions>
      </Dialog>

      {/* ════ MODAL: Cierre de Producción ════ */}
      <Dialog
        open={openConfirm}
        onClose={() => setOpenConfirm(false)}
        maxWidth="sm" fullWidth
        fullScreen={isMobile}
        PaperProps={{ sx: { borderRadius: isMobile ? 0 : 3 } }}
      >
        <Box sx={{ height: 4, bgcolor: GREEN }} />
        <DialogTitle sx={{ fontWeight: 800, fontSize: 18, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          Cierre de Producción
        </DialogTitle>

        <DialogContent dividers sx={{ p: { xs: 2, sm: 3 }, bgcolor: 'background.paper' }}>
          {/* Info del producto */}
          <Box sx={{ p: 2, mb: 3, borderRadius: 2, bgcolor: 'background.default', border: '1px solid', borderColor: 'divider' }}>
            <Typography sx={{ fontSize: 13, color: 'text.secondary', mb: 0.5 }}>Producto Resultante</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              <Typography sx={{ fontWeight: 800, fontSize: 18 }}>{productoResultante?.nombre}</Typography>
              {productoEsPerecible && (
                <Chip
                  label="Perecedero"
                  size="small"
                  icon={<Inventory2 sx={{ fontSize: 14 }} />}
                  sx={{ bgcolor: `${PURPLE}15`, color: PURPLE, fontWeight: 700, fontSize: 11 }}
                />
              )}
            </Box>
            <Typography sx={{ fontSize: 13, fontWeight: 600, color: ACCENT, mt: 1 }}>
              Cantidad Esperada: {selectedLote?.cantidad_a_producir}
            </Typography>
          </Box>

          {/* Cantidad real */}
          <Typography sx={{ fontSize: 12, fontWeight: 600, color: 'text.secondary', mb: 1.5, textTransform: 'uppercase' }}>
            Resultado Real Obtenido
          </Typography>
          <TextField
            fullWidth type="number"
            label="Cantidad real a ingresar a Bodega *"
            value={confirmData.cantidad_real}
            onChange={(e) => setConfirmData({ ...confirmData, cantidad_real: e.target.value })}
            sx={{ mb: 2 }}
            helperText="El sistema calculará automáticamente el nuevo costo unitario promediando las mermas."
          />

          {/* Profitability preview */}
          {confirmData.cantidad_real > 0 && productoResultante?.precio_venta > 0 && (
            <Box sx={{ p: 2, borderRadius: 2, bgcolor: 'background.default', border: '1px solid', borderColor: 'divider', mb: 2 }}>
              <Typography sx={{ fontSize: 11, fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', mb: 1 }}>
                Análisis de Rentabilidad (estimado)
              </Typography>
              {(() => {
                const costoEstimado = (selectedLote?.receta?.items || []).reduce((s, it) => {
                  return s + (it.cantidad || 0) * (it.insumo?.costo || 0);
                }, 0) * selectedLote?.cantidad_a_producir;
                const cantReal = parseFloat(confirmData.cantidad_real) || 1;
                const costoUnit = costoEstimado / cantReal;
                const precioVenta = productoResultante.precio_venta;
                const margen = precioVenta > 0 ? ((precioVenta - costoUnit) / precioVenta * 100) : null;
                const colorM = margen === null ? 'text.secondary' : margen >= 30 ? GREEN : margen >= 10 ? '#F59E0B' : RED;
                return (
                  <>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>Precio de venta</Typography>
                      <Typography sx={{ fontSize: 12, fontWeight: 700 }}>{formatCurrency(precioVenta)}</Typography>
                    </Box>
                    {costoUnit > 0 && (
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                        <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>Costo est. por unidad</Typography>
                        <Typography sx={{ fontSize: 12, fontWeight: 700 }}>{formatCurrency(costoUnit)}</Typography>
                      </Box>
                    )}
                    {margen !== null && (
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>Margen estimado</Typography>
                        <Typography sx={{ fontSize: 13, fontWeight: 800, color: colorM }}>
                          {margen.toFixed(1)}% {margen >= 30 ? '✓' : margen >= 10 ? '⚠' : '✗'}
                        </Typography>
                      </Box>
                    )}
                  </>
                );
              })()}
            </Box>
          )}

          {/* SECCIÓN PERECEDERO */}
          {productoEsPerecible && (
            <>
              <Divider sx={{ my: 2.5 }}>
                <Chip
                  label="Trazabilidad del Lote Producido"
                  size="small"
                  icon={<Inventory2 sx={{ fontSize: 14 }} />}
                  sx={{ bgcolor: `${PURPLE}15`, color: PURPLE, fontWeight: 700 }}
                />
              </Divider>

              <Alert severity="info" sx={{ mb: 2.5, borderRadius: 2, fontSize: 13 }}>
                Este producto es <strong>perecedero</strong>. Asigna el número de lote y la fecha de vencimiento
                para que el sistema registre la entrada correctamente en el control FEFO.
              </Alert>

              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <TextField
                    fullWidth required
                    label="Número de Lote de Producción *"
                    placeholder="Ej: PROD-2026-001"
                    value={confirmData.numero_lote}
                    onChange={(e) => setConfirmData({ ...confirmData, numero_lote: e.target.value.toUpperCase() })}
                    helperText="Identificador único para este lote producido"
                    InputProps={{
                      startAdornment: <InputAdornment position="start">🏷</InputAdornment>
                    }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth required
                    label="Fecha de Vencimiento *"
                    type="date"
                    InputLabelProps={{ shrink: true }}
                    value={confirmData.fecha_vencimiento}
                    onChange={(e) => setConfirmData({ ...confirmData, fecha_vencimiento: e.target.value })}
                    inputProps={{ min: new Date().toLocaleDateString('en-CA') }}
                    helperText="Fecha límite de consumo"
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Fecha de Fabricación (Opcional)"
                    type="date"
                    InputLabelProps={{ shrink: true }}
                    value={confirmData.fecha_fabricacion}
                    onChange={(e) => setConfirmData({ ...confirmData, fecha_fabricacion: e.target.value })}
                    helperText="Fecha de elaboración del producto"
                  />
                </Grid>
              </Grid>
            </>
          )}

          {/* Observaciones */}
          <TextField
            fullWidth multiline rows={2}
            label="Observaciones de Cierre"
            value={confirmData.observaciones}
            onChange={(e) => setConfirmData({ ...confirmData, observaciones: e.target.value })}
            placeholder="Ej: Se dañaron 2 unidades en el horno..."
            sx={{ mt: 2.5 }}
          />
        </DialogContent>

        <DialogActions sx={{ px: { xs: 2, sm: 3 }, py: 2, gap: 1 }}>
          <Button
            onClick={() => setOpenConfirm(false)}
            sx={{ color: 'text.secondary', fontWeight: 600, flex: isMobile ? 1 : 'none' }}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleConfirmarFinal}
            variant="contained"
            disabled={loading}
            sx={{ bgcolor: GREEN, '&:hover': { bgcolor: '#059669' }, fontWeight: 600, px: { xs: 2, sm: 3 }, flex: isMobile ? 1 : 'none' }}
          >
            {loading ? 'Procesando…' : 'Finalizar e Ingresar a Inventario'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ════ DIALOG: Confirmar Cancelación ════ */}
      <Dialog
        open={!!confirmCancelId}
        onClose={() => setConfirmCancelId(null)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ fontWeight: 700 }}>¿Cancelar orden?</DialogTitle>
        <DialogContent>
          <Typography color="text.secondary" fontSize={14}>
            Esta acción no se puede deshacer. Los insumos reservados no se devolverán automáticamente al inventario.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, gap: 1 }}>
          <Button
            onClick={() => setConfirmCancelId(null)}
            sx={{ flex: 1, fontWeight: 600 }}
            variant="outlined"
          >
            Volver
          </Button>
          <Button
            onClick={handleCancelarConfirmado}
            variant="contained"
            color="error"
            sx={{ flex: 1, fontWeight: 600, borderRadius: 2 }}
          >
            Sí, cancelar
          </Button>
        </DialogActions>
      </Dialog>

    </Box>
  );
};

export default Lotes;
