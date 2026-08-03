// ═══════════════════════════════════════════════════════════════════════════
// ParqueaderoSuscripciones.jsx — VERSIÓN 2 (con botones WhatsApp)
// REEMPLAZA tu archivo /components/ParqueaderoSuscripciones.jsx por este.
//
// Cambios respecto a v1:
//   ✨ Botón WhatsApp en filas con saldo pendiente
//   ✨ Botón WhatsApp en cards mobile
// ═══════════════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Paper, Typography, Stack, Chip, IconButton, Tooltip,
  Skeleton, Alert, Button, ToggleButton, ToggleButtonGroup,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TableSortLabel, TablePagination, Tab, Tabs,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem,
  InputAdornment, Divider, useMediaQuery, useTheme, CircularProgress
} from '@mui/material';
import {
  EventRepeat, Refresh, Payment, Visibility,
  AttachMoney, Cancel, Close, Save, Search, FileDownload,
  CheckCircle, ErrorOutline, HourglassEmpty, PictureAsPdf, Replay,
  Receipt, CalendarToday, ContentCopy,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import apiClient from '../../api';
import { toast } from 'react-toastify';
import { formatCurrency } from '../../utils/formatters';
import CurrencyField from '../../components/common/CurrencyField';
import BotonWhatsApp from '../../components/common/BotonWhatsApp';
import HelpGuideTopBar from '../../components/onboarding/HelpGuideTopBar';
import { METODOS_PAGO_SIMPLE as METODOS_PAGO } from '../../utils/constants';

const ACCENT = '#0891B2';

export default function ParqueaderoSuscripciones() {
  const [tab, setTab] = useState(0);
  return (
    <Box sx={{ p: { xs: 1, md: 2 }, maxWidth: 1400, mx: 'auto' }}>
      <Paper sx={{ mb: 2, borderRadius: 3 }}>
        <Tabs
          value={tab} onChange={(_, v) => setTab(v)}
          sx={{
            px: 1,
            '& .MuiTab-root': { fontWeight: 700, textTransform: 'none', minHeight: 48 },
            '& .Mui-selected': { color: ACCENT },
            '& .MuiTabs-indicator': { bgcolor: ACCENT },
          }}
        >
          <Tab icon={<EventRepeat sx={{ fontSize: 18 }} />} iconPosition="start" label="Suscripciones" />
          <Tab icon={<Receipt sx={{ fontSize: 18 }} />}     iconPosition="start" label="Historial FE" />
        </Tabs>
      </Paper>
      {tab === 0 && <SuscripcionesTab />}
      {tab === 1 && <HistorialFETab />}
    </Box>
  );
}

function SuscripcionesTab() {
  const [items, setItems]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [filtro, setFiltro]     = useState('todas');
  const [dlgAbono, setDlgAbono] = useState(null);
  const [confirmCancel, setConfirmCancel] = useState(null);
  const [busqueda, setBusqueda]       = useState('');
  const [sortCol, setSortCol]         = useState('fecha_vencimiento');
  const [sortDir, setSortDir]         = useState('asc');
  const [page, setPage]               = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(15);
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filtro === 'vigentes') params.append('solo_vigentes', 'true');
      if (filtro === 'vencidas') params.append('solo_vencidas', 'true');
      params.append('limit', '300');
      const { data } = await apiClient.get(`/parqueadero/suscripciones?${params}`);
      const filtrado = filtro === 'con_saldo'
        ? data.filter(s => s.saldo_pendiente > 0)
        : data;
      setItems(filtrado);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al cargar.');
    } finally {
      setLoading(false);
    }
  }, [filtro]);

  useEffect(() => { cargar(); }, [cargar]);

  const itemsFiltrados = React.useMemo(() => {
    let list = [...items];
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase();
      list = list.filter(s =>
        (s.placa || '').toLowerCase().includes(q) ||
        (s.cliente_nombre || '').toLowerCase().includes(q)
      );
    }
    list.sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      switch (sortCol) {
        case 'placa':   return dir * (a.placa || '').localeCompare(b.placa || '');
        case 'cliente': return dir * (a.cliente_nombre || '').localeCompare(b.cliente_nombre || '');
        case 'tipo':    return dir * (a.tipo || '').localeCompare(b.tipo || '');
        case 'total':   return dir * ((a.monto_total || 0) - (b.monto_total || 0));
        case 'pagado':  return dir * ((a.monto_pagado || 0) - (b.monto_pagado || 0));
        case 'saldo':   return dir * ((a.saldo_pendiente || 0) - (b.saldo_pendiente || 0));
        default:        return dir * (a.fecha_vencimiento || '').localeCompare(b.fecha_vencimiento || '');
      }
    });
    return list;
  }, [items, busqueda, sortCol, sortDir]);

  const itemsPaginados = React.useMemo(() =>
    itemsFiltrados.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage),
    [itemsFiltrados, page, rowsPerPage]
  );

  const totalFacturado = items.reduce((sum, s) => sum + (s.monto_total || 0), 0);
  const totalPagado    = items.reduce((sum, s) => sum + (s.monto_pagado || 0), 0);
  const totalSaldo     = items.reduce((sum, s) => sum + (s.saldo_pendiente || 0), 0);

  const vigentesCount = items.filter(s => {
    if (s.estado === 'cancelada') return false;
    const partes = (s.fecha_vencimiento || '').split('T')[0].split('-');
    if (partes.length !== 3) return false;
    const vence = new Date(partes[0], partes[1] - 1, partes[2]);
    const hoy = new Date(); hoy.setHours(0,0,0,0);
    return vence >= hoy;
  }).length;

  const vencidasCount = items.filter(s => {
    if (s.estado === 'cancelada') return false;
    const partes = (s.fecha_vencimiento || '').split('T')[0].split('-');
    if (partes.length !== 3) return false;
    const vence = new Date(partes[0], partes[1] - 1, partes[2]);
    const hoy = new Date(); hoy.setHours(0,0,0,0);
    return vence < hoy;
  }).length;

  const handleCancelar = async () => {
    if (!confirmCancel) return;
    try {
      await apiClient.delete(`/parqueadero/suscripciones/${confirmCancel.id}`);
      toast.success('Suscripción cancelada.');
      setConfirmCancel(null);
      cargar();
    } catch (err) {
      const status = err.response?.status;
      if (status === 403) {
        toast.error('Solo el administrador puede cancelar suscripciones.');
      } else {
        toast.error(err.response?.data?.detail || 'Error al cancelar.');
      }
    }
  };

  const handleExportCSV = () => {
    if (!itemsFiltrados.length) return;
    const rows = [
      ['#', 'Placa', 'Propietario', 'Tipo', 'Inicio', 'Vencimiento', 'Total', 'Pagado', 'Saldo', 'Estado'],
      ...itemsFiltrados.map((s, i) => [
        i + 1, s.placa || '', s.cliente_nombre || '', (s.tipo || '').toUpperCase(),
        fechaCorta(s.fecha_inicio), fechaCorta(s.fecha_vencimiento),
        s.monto_total || 0, s.monto_pagado || 0, s.saldo_pendiente || 0,
        s.estado === 'cancelada' ? 'Cancelada' : (s.estado_pago || '').toUpperCase(),
      ]),
      ['', 'TOTALES', '', '', '', '', totalFacturado, totalPagado, totalSaldo, ''],
    ];
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a'); a.href = url; a.download = 'suscripciones-parqueadero.csv';
    a.click(); URL.revokeObjectURL(url);
  };

  const SortTh = ({ col, children, align = 'left' }) => (
    <TableCell align={align} sx={{ fontWeight: 800, fontSize: 11, textTransform: 'uppercase' }}>
      <TableSortLabel
        active={sortCol === col}
        direction={sortCol === col ? sortDir : 'asc'}
        onClick={() => {
          setSortDir(prev => col === sortCol ? (prev === 'asc' ? 'desc' : 'asc') : 'asc');
          setSortCol(col);
          setPage(0);
        }}
      >
        {children}
      </TableSortLabel>
    </TableCell>
  );

  return (
    <Box>

      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2, flexWrap: 'wrap', gap: 1 }}>
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <Box sx={{
            width: 44, height: 44, borderRadius: 2,
            background: `linear-gradient(135deg, ${ACCENT} 0%, #22D3EE 100%)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <EventRepeat sx={{ color: 'white' }} />
          </Box>
          <Box>
            <Typography sx={{ fontSize: 20, fontWeight: 800, fontFamily: "'Geist', sans-serif" }}>
              Suscripciones
            </Typography>
            <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
              {items.length} registro{items.length !== 1 ? 's' : ''}
            </Typography>
          </Box>
          <HelpGuideTopBar
            moduleName="Suscripciones"
            moduleColor={ACCENT}
            steps={[
              { title: 'Revisa suscripciones activas', description: 'Verás todas las suscripciones mensuales con su fecha de vencimiento y saldo pendiente.' },
              { title: 'Identifica las vencidas', description: 'Las suscripciones vencidas aparecen con estado rojo. Son clientes que deben renovar.' },
              { title: 'Renueva y cobra', description: 'Selecciona una suscripción vencida y usa el botón "Cobrar/Renovar" para registrar el pago y extender la fecha.' },
              { title: 'Notifica por WhatsApp', description: 'Usa el botón de WhatsApp para enviar un mensaje automático al cliente con el monto adeudado.' },
            ]}
            faqItems={[
              { q: '¿Qué es una suscripción mensual?', a: 'Es un acuerdo por el que un vehículo paga una tarifa fija mensual para tener acceso permanente al parqueadero.' },
              { q: '¿Cómo renuevo una suscripción?', a: 'Haz clic en el botón de cobro/renovación, selecciona el método de pago y la fecha se extiende automáticamente un mes.' },
              { q: '¿Qué pasa con vehículos de suscripción vencida?', a: 'Siguen apareciendo en el listado como vencidos. Debes cobrar la renovación antes de permitirles el acceso nuevamente.' },
              { q: '¿Cómo filtro las suscripciones por estado?', a: 'Usa los botones de filtro en la parte superior: Todos, Activas o Vencidas.' },
            ]}
          />
        </Stack>
        <Tooltip title="Actualizar">
          <IconButton onClick={cargar} sx={{ border: '1px solid', borderColor: 'divider' }}>
            <Refresh />
          </IconButton>
        </Tooltip>
      </Stack>

      <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap', gap: 1 }}>
        <KpiSmall label="Facturado" value={formatCurrency(totalFacturado)} color="text.primary" />
        <KpiSmall label="Pagado" value={formatCurrency(totalPagado)} color="#10B981" />
        <KpiSmall label="Saldo pendiente" value={formatCurrency(totalSaldo)} color={totalSaldo > 0 ? '#EF4444' : '#10B981'} />
        <KpiSmall label="Vigentes" value={String(vigentesCount)} color="#10B981" />
        <KpiSmall label="Vencidas" value={String(vencidasCount)} color={vencidasCount > 0 ? '#EF4444' : 'text.secondary'} />
      </Stack>

      <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField
          size="small"
          placeholder="Buscar por placa o cliente…"
          value={busqueda}
          onChange={e => { setBusqueda(e.target.value); setPage(0); }}
          InputProps={{
            startAdornment: <InputAdornment position="start"><Search sx={{ fontSize: 18, color: 'text.disabled' }} /></InputAdornment>,
          }}
          sx={{ flex: 1, minWidth: 200 }}
        />
        <Button size="small" variant="outlined" startIcon={<FileDownload />}
          onClick={handleExportCSV} disabled={!itemsFiltrados.length}
          sx={{ borderRadius: 2, fontWeight: 600, whiteSpace: 'nowrap' }}>
          CSV
        </Button>
      </Box>

      <Paper sx={{ p: 1, mb: 2, borderRadius: 3 }}>
        <ToggleButtonGroup
          exclusive value={filtro}
          onChange={(_, v) => v && setFiltro(v)}
          size="small"
          sx={{
            flexWrap: 'wrap',
            '& .MuiToggleButton-root': {
              fontWeight: 700, textTransform: 'none',
              '&.Mui-selected': { bgcolor: ACCENT + '15', color: ACCENT },
            },
          }}
        >
          <ToggleButton value="todas">Todas</ToggleButton>
          <ToggleButton value="vigentes">Vigentes</ToggleButton>
          <ToggleButton value="vencidas">Vencidas</ToggleButton>
          <ToggleButton value="con_saldo">Con saldo pendiente</ToggleButton>
        </ToggleButtonGroup>
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {loading ? (
        <Stack spacing={1}>
          {[1, 2, 3, 4].map(i => <Skeleton key={i} variant="rounded" height={70} />)}
        </Stack>
      ) : items.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 3 }}>
          <EventRepeat sx={{ fontSize: 64, color: 'text.disabled', mb: 1 }} />
          <Typography sx={{ fontSize: 16, fontWeight: 700, mb: 0.5 }}>
            Sin registros
          </Typography>
          <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>
            {filtro === 'todas'
              ? 'Aún no hay suscripciones. Empieza desde "Buscar placa".'
              : 'No hay suscripciones que coincidan con este filtro.'}
          </Typography>
        </Paper>
      ) : isMobile ? (
        <Stack spacing={1}>
          {itemsFiltrados.map(s => (
            <SuscripcionCard
              key={s.id} susc={s}
              onVer={() => navigate(`/parqueadero/buscar?placa=${s.placa}`)}
              onAbonar={() => setDlgAbono(s)}
              onCancelar={() => setConfirmCancel(s)}
            />
          ))}
        </Stack>
      ) : (
        <>
          <TableContainer component={Paper} sx={{ borderRadius: 3 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <SortTh col="placa">Placa</SortTh>
                  <SortTh col="cliente">Propietario</SortTh>
                  <SortTh col="tipo">Tipo</SortTh>
                  <TableCell sx={{ fontWeight: 800, fontSize: 11, textTransform: 'uppercase' }}>Vigencia</TableCell>
                  <SortTh col="total" align="right">Total</SortTh>
                  <SortTh col="pagado" align="right">Pagado</SortTh>
                  <SortTh col="saldo" align="right">Saldo</SortTh>
                  <TableCell sx={{ fontWeight: 800, fontSize: 11, textTransform: 'uppercase' }}>Estado</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 800, fontSize: 11, textTransform: 'uppercase' }}>Acciones</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {itemsPaginados.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
                      {busqueda ? `Sin resultados para "${busqueda}"` : 'Sin suscripciones en esta categoría'}
                    </TableCell>
                  </TableRow>
                ) : itemsPaginados.map(s => (
                  <SuscripcionRow
                    key={s.id} susc={s}
                    onVer={() => navigate(`/parqueadero/buscar?placa=${s.placa}`)}
                    onAbonar={() => setDlgAbono(s)}
                    onCancelar={() => setConfirmCancel(s)}
                  />
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            component="div"
            count={itemsFiltrados.length}
            page={page}
            onPageChange={(_, p) => setPage(p)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={e => { setRowsPerPage(parseInt(e.target.value)); setPage(0); }}
            rowsPerPageOptions={[10, 15, 25, 50]}
            labelRowsPerPage="Filas:"
            labelDisplayedRows={({ from, to, count }) => `${from}-${to} de ${count}`}
          />
        </>
      )}

      {dlgAbono && (
        <AbonoDialog
          open={!!dlgAbono} susc={dlgAbono}
          onClose={() => setDlgAbono(null)}
          onSuccess={() => { setDlgAbono(null); cargar(); }}
        />
      )}

      <Dialog open={!!confirmCancel} onClose={() => setConfirmCancel(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>¿Cancelar esta suscripción?</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: 14 }}>
            Suscripción <strong>{confirmCancel?.tipo?.toUpperCase()}</strong> del vehículo <strong>{confirmCancel?.placa}</strong>.
          </Typography>
          <Typography sx={{ fontSize: 12, color: 'text.secondary', mt: 1 }}>
            La suscripción quedará marcada como cancelada (no se borra). Útil cuando se registró por error.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmCancel(null)}>No</Button>
          <Button variant="contained" color="error" onClick={handleCancelar}>
            Sí, cancelar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}


// ═══════════════════════════════════════════════════════════════════════════
// HISTORIAL FE
// ═══════════════════════════════════════════════════════════════════════════

const fmt = (n) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n || 0);
const fmtDatetime = (iso) => iso ? new Date(iso).toLocaleString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
// Día local (en-CA = YYYY-MM-DD). toISOString() es UTC: desde las 7pm hora
// colombiana los rangos "Hoy"/"7 días" apuntaban al día siguiente.
const toIso = (d) => d.toLocaleDateString('en-CA');
const copy = (txt) => navigator.clipboard?.writeText(txt).then(() => {});

const RANGOS = [
  { label: 'Hoy',      getDates: () => { const d = new Date(); return [d, d]; } },
  { label: '7 días',   getDates: () => { const d = new Date(), d2 = new Date(); d2.setDate(d.getDate() - 6); return [d2, d]; } },
  { label: '30 días',  getDates: () => { const d = new Date(), d2 = new Date(); d2.setDate(d.getDate() - 29); return [d2, d]; } },
  { label: 'Este mes', getDates: () => { const d = new Date(); return [new Date(d.getFullYear(), d.getMonth(), 1), d]; } },
];

function ChipFE({ estado }) {
  if (estado === 'exitoso')   return <Chip label="FE OK"     size="small" icon={<CheckCircle   sx={{ fontSize: '14px !important' }} />} color="success" />;
  if (estado === 'fallido')   return <Chip label="Fallida"   size="small" icon={<ErrorOutline  sx={{ fontSize: '14px !important' }} />} color="error" />;
  if (estado === 'pendiente') return <Chip label="Pendiente" size="small" icon={<HourglassEmpty sx={{ fontSize: '14px !important' }} />} color="warning" />;
  return <Chip label="Sin FE" size="small" sx={{ bgcolor: 'rgba(0,0,0,0.06)', color: 'text.secondary' }} />;
}

function HistorialFETab() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const today = toIso(new Date());
  const [fechaIni, setFechaIni] = useState(today);
  const [fechaFin, setFechaFin] = useState(today);
  const [historial, setHistorial] = useState([]);
  const [loading, setLoading]     = useState(false);
  const [reintentando, setReintentando] = useState(null);

  const fetchHistorial = useCallback(async () => {
    setLoading(true);
    try {
      const r = await apiClient.get('/parqueadero/suscripciones/historial-fe', {
        params: { fecha_inicio: fechaIni, fecha_fin: fechaFin },
      });
      setHistorial(r.data);
    } catch {
      toast.error('Error cargando historial de FE');
    } finally {
      setLoading(false);
    }
  }, [fechaIni, fechaFin]);

  useEffect(() => { fetchHistorial(); }, [fetchHistorial]);

  const reintentar = async (ventaId) => {
    setReintentando(ventaId);
    try {
      const r = await apiClient.post(`/parqueadero/ventas/${ventaId}/reintentar-fe`);
      const estado = r.data.estado;
      if (estado === 'exitoso') {
        toast.success(`✅ FE emitida — N° ${r.data.numero_factura || ''}`);
      } else {
        toast.warning(`FE ${estado}: ${r.data.mensaje || 'Sin detalles'}`);
      }
      fetchHistorial();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Error al reintentar FE');
    } finally {
      setReintentando(null);
    }
  };

  const totalVentas  = historial.reduce((s, v) => s + (v.total || 0), 0);
  const feOk         = historial.filter(v => v.estado_fe === 'exitoso').length;
  const feFallidas   = historial.filter(v => v.estado_fe === 'fallido').length;
  const sinFe        = historial.filter(v => !v.estado_fe).length;

  return (
    <Box>
      {/* Filtros de fecha */}
      <Paper elevation={0} sx={{ p: 2, borderRadius: 2, border: '1px solid rgba(0,0,0,0.08)', mb: 2 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems="flex-end">
          <TextField
            label="Desde" type="date" size="small" value={fechaIni}
            onChange={e => setFechaIni(e.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={{ width: 150 }}
          />
          <TextField
            label="Hasta" type="date" size="small" value={fechaFin}
            onChange={e => setFechaFin(e.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={{ width: 150 }}
          />
          <Stack direction="row" spacing={0.5} flexWrap="wrap">
            {RANGOS.map(r => (
              <Button key={r.label} size="small" variant="outlined"
                startIcon={<CalendarToday sx={{ fontSize: 13 }} />}
                onClick={() => {
                  const [d1, d2] = r.getDates();
                  setFechaIni(toIso(d1));
                  setFechaFin(toIso(d2));
                }}
                sx={{ fontWeight: 600, textTransform: 'none', borderRadius: 2, fontSize: 12 }}
              >
                {r.label}
              </Button>
            ))}
          </Stack>
          <Button variant="contained" size="small" startIcon={<Refresh />}
            onClick={fetchHistorial} disabled={loading}
            sx={{ bgcolor: ACCENT, '&:hover': { bgcolor: '#0e7490' }, fontWeight: 700, whiteSpace: 'nowrap' }}
          >
            {loading ? <CircularProgress size={16} color="inherit" /> : 'Buscar'}
          </Button>
        </Stack>
      </Paper>

      {/* KPIs */}
      <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap', gap: 1 }}>
        <KpiSmall label="Total cobrado"  value={fmt(totalVentas)}        color="text.primary" />
        <KpiSmall label="FE exitosas"    value={String(feOk)}            color="#10B981" />
        <KpiSmall label="FE fallidas"    value={String(feFallidas)}      color={feFallidas > 0 ? '#EF4444' : 'text.secondary'} />
        <KpiSmall label="Sin FE"         value={String(sinFe)}           color={sinFe > 0 ? '#F59E0B' : 'text.secondary'} />
        <KpiSmall label="Total registros" value={String(historial.length)} color="text.primary" />
      </Stack>

      {/* Tabla */}
      {historial.length === 0 && !loading ? (
        <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 3 }}>
          <Receipt sx={{ fontSize: 64, color: 'text.disabled', mb: 1 }} />
          <Typography sx={{ fontWeight: 700, mb: 0.5 }}>Sin registros en este período</Typography>
          <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>
            Cambia el rango de fechas o registra pagos de suscripciones.
          </Typography>
        </Paper>
      ) : isMobile ? (
        // En celular las 8 columnas no caben: cada venta se muestra como tarjeta.
        <Stack spacing={1.5}>
          {loading
            ? [1, 2, 3].map(i => <Skeleton key={i} variant="rounded" height={96} />)
            : historial.map(v => (
              <Paper key={v.venta_id} sx={{ p: 1.75, borderRadius: 2, border: '1px solid', borderColor: 'divider' }} elevation={0}>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                  <Box sx={{ minWidth: 0 }}>
                    <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
                      <Typography sx={{ fontFamily: 'monospace', fontWeight: 800, fontSize: 14, letterSpacing: 1 }}>{v.placa || '—'}</Typography>
                      <Chip size="small"
                        label={v.origen === 'parqueadero_suscripcion' ? 'Suscripción' : 'Por horas'}
                        sx={{ fontSize: 10, fontWeight: 700, height: 18,
                              bgcolor: v.origen === 'parqueadero_suscripcion' ? '#0891B220' : '#F59E0B20',
                              color:   v.origen === 'parqueadero_suscripcion' ? '#4338CA'   : '#92400E' }} />
                      <ChipFE estado={v.estado_fe} />
                    </Stack>
                    <Typography sx={{ fontSize: 11, color: 'text.secondary', mt: 0.5 }}>
                      {fmtDatetime(v.fecha)} · {v.metodo_pago || '—'}
                    </Typography>
                    {v.numero_factura && (
                      <Typography sx={{ fontSize: 11, color: 'text.secondary' }} noWrap>Fact: {v.numero_factura}</Typography>
                    )}
                  </Box>
                  <Stack alignItems="flex-end" spacing={0.5} sx={{ flexShrink: 0 }}>
                    <Typography sx={{ fontWeight: 800, fontSize: 15 }}>{fmt(v.total)}</Typography>
                    <Stack direction="row">
                      {v.pdf_url && (
                        <IconButton size="small" onClick={() => window.open(v.pdf_url, '_blank')} sx={{ color: '#EF4444' }}>
                          <PictureAsPdf fontSize="small" />
                        </IconButton>
                      )}
                      {(v.estado_fe === 'fallido' || !v.estado_fe) && (
                        <IconButton size="small" disabled={reintentando === v.venta_id}
                          onClick={() => reintentar(v.venta_id)} sx={{ color: '#0891B2' }}>
                          {reintentando === v.venta_id ? <CircularProgress size={16} /> : <Replay fontSize="small" />}
                        </IconButton>
                      )}
                    </Stack>
                  </Stack>
                </Stack>
              </Paper>
            ))}
        </Stack>
      ) : (
        <TableContainer component={Paper} sx={{ borderRadius: 3 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 800, fontSize: 11, textTransform: 'uppercase' }}>Fecha</TableCell>
                <TableCell sx={{ fontWeight: 800, fontSize: 11, textTransform: 'uppercase' }}>Origen</TableCell>
                <TableCell sx={{ fontWeight: 800, fontSize: 11, textTransform: 'uppercase' }}>Placa</TableCell>
                <TableCell align="right" sx={{ fontWeight: 800, fontSize: 11, textTransform: 'uppercase' }}>Total</TableCell>
                <TableCell sx={{ fontWeight: 800, fontSize: 11, textTransform: 'uppercase' }}>Método</TableCell>
                <TableCell sx={{ fontWeight: 800, fontSize: 11, textTransform: 'uppercase' }}>FE</TableCell>
                <TableCell sx={{ fontWeight: 800, fontSize: 11, textTransform: 'uppercase' }}>N° Factura</TableCell>
                <TableCell align="center" sx={{ fontWeight: 800, fontSize: 11, textTransform: 'uppercase' }}>Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                [1, 2, 3].map(i => (
                  <TableRow key={i}>
                    {[1,2,3,4,5,6,7,8].map(j => (
                      <TableCell key={j}><Skeleton variant="text" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : historial.map(v => (
                <TableRow key={v.venta_id} hover>
                  <TableCell sx={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                    {fmtDatetime(v.fecha)}
                  </TableCell>
                  <TableCell>
                    <Chip size="small"
                      label={v.origen === 'parqueadero_suscripcion' ? 'Suscripción' : 'Por horas'}
                      sx={{
                        fontSize: 10, fontWeight: 700, height: 18,
                        bgcolor: v.origen === 'parqueadero_suscripcion' ? '#0891B220' : '#F59E0B20',
                        color:   v.origen === 'parqueadero_suscripcion' ? '#4338CA'   : '#92400E',
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography sx={{ fontFamily: 'monospace', fontWeight: 800, fontSize: 13, letterSpacing: 1 }}>
                      {v.placa || '—'}
                    </Typography>
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, fontSize: 13 }}>
                    {fmt(v.total)}
                  </TableCell>
                  <TableCell sx={{ fontSize: 12 }}>{v.metodo_pago || '—'}</TableCell>
                  <TableCell><ChipFE estado={v.estado_fe} /></TableCell>
                  <TableCell>
                    {v.numero_factura ? (
                      <Stack direction="row" alignItems="center" spacing={0.5}>
                        <Typography sx={{ fontSize: 12, fontWeight: 600 }}>{v.numero_factura}</Typography>
                        {v.cufe && (
                          <Tooltip title={`Copiar CUFE: ${v.cufe}`}>
                            <IconButton size="small" onClick={() => copy(v.cufe)}>
                              <ContentCopy sx={{ fontSize: 13 }} />
                            </IconButton>
                          </Tooltip>
                        )}
                      </Stack>
                    ) : <Typography sx={{ fontSize: 12, color: 'text.disabled' }}>—</Typography>}
                  </TableCell>
                  <TableCell align="center">
                    <Stack direction="row" spacing={0} justifyContent="center">
                      {v.pdf_url && (
                        <Tooltip title="Descargar PDF">
                          <IconButton size="small" onClick={() => window.open(v.pdf_url, '_blank')}
                            sx={{ color: '#EF4444' }}>
                            <PictureAsPdf fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                      {(v.estado_fe === 'fallido' || !v.estado_fe) && (
                        <Tooltip title={v.estado_fe === 'fallido' ? `Reintentar FE${v.mensaje_proveedor ? ` — ${v.mensaje_proveedor}` : ''}` : 'Emitir FE'}>
                          <span>
                            <IconButton size="small"
                              disabled={reintentando === v.venta_id}
                              onClick={() => reintentar(v.venta_id)}
                              sx={{ color: '#0891B2' }}
                            >
                              {reintentando === v.venta_id
                                ? <CircularProgress size={16} />
                                : <Replay fontSize="small" />}
                            </IconButton>
                          </span>
                        </Tooltip>
                      )}
                    </Stack>
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


// ═══════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTES
// ═══════════════════════════════════════════════════════════════════════════

function KpiSmall({ label, value, color }) {
  return (
    <Paper sx={{ p: 1.5, borderRadius: 2, flex: 1, border: '1px solid', borderColor: 'divider' }}>
      <Typography sx={{ fontSize: 10, fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {label}
      </Typography>
      <Typography sx={{ fontSize: 18, fontWeight: 900, color, mt: 0.3 }}>
        {value}
      </Typography>
    </Paper>
  );
}

function SuscripcionRow({ susc, onVer, onAbonar, onCancelar }) {
  const colorEstado = colorPorEstadoPago(susc.estado_pago);
  const colorTipo = colorPorEstado(susc);
  const tieneSaldo = susc.saldo_pendiente > 0 && susc.estado !== 'cancelada';

  return (
    <TableRow hover sx={{ opacity: susc.estado === 'cancelada' ? 0.5 : 1 }}>
      <TableCell>
        <Typography sx={{ fontFamily: 'monospace', fontWeight: 800, fontSize: 13, letterSpacing: 1 }}>
          {susc.placa || '—'}
        </Typography>
      </TableCell>
      <TableCell>
        <Typography sx={{ fontSize: 13 }}>{susc.cliente_nombre || '—'}</Typography>
      </TableCell>
      <TableCell>
        <Chip size="small" label={susc.tipo?.toUpperCase()}
          sx={{ height: 18, fontSize: 9, fontWeight: 700, bgcolor: 'action.hover' }} />
        {susc.es_retroactiva && (
          <Chip size="small" label="RETRO"
            sx={{ height: 18, fontSize: 9, fontWeight: 700, ml: 0.5, bgcolor: '#FEE2E2', color: '#991B1B' }} />
        )}
      </TableCell>
      <TableCell>
        <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
          {fechaCorta(susc.fecha_inicio)}
        </Typography>
        <Typography sx={{ fontSize: 12, fontWeight: 700, color: colorTipo.text }}>
          → {fechaCorta(susc.fecha_vencimiento)}
        </Typography>
      </TableCell>
      <TableCell align="right" sx={{ fontWeight: 600, fontSize: 13 }}>
        {formatCurrency(susc.monto_total)}
      </TableCell>
      <TableCell align="right" sx={{ fontWeight: 700, fontSize: 13, color: '#10B981' }}>
        {formatCurrency(susc.monto_pagado)}
      </TableCell>
      <TableCell align="right" sx={{
        fontWeight: 800, fontSize: 13,
        color: tieneSaldo ? '#EF4444' : 'text.disabled',
      }}>
        {tieneSaldo ? formatCurrency(susc.saldo_pendiente) : '—'}
      </TableCell>
      <TableCell>
        <Chip size="small"
          label={susc.estado === 'cancelada' ? 'CANCELADA' : susc.estado_pago.toUpperCase()}
          sx={{
            height: 18, fontSize: 9, fontWeight: 700,
            bgcolor: susc.estado === 'cancelada' ? '#94A3B820' : colorEstado.bg,
            color:   susc.estado === 'cancelada' ? '#475569'   : colorEstado.text,
          }}
        />
      </TableCell>
      <TableCell align="right">
        <Stack direction="row" spacing={0} justifyContent="flex-end">
          <Tooltip title="Ver placa">
            <IconButton size="small" onClick={onVer} sx={{ color: ACCENT }}>
              <Visibility fontSize="small" />
            </IconButton>
          </Tooltip>
          {tieneSaldo && (
            <>
              <Tooltip title="Registrar abono">
                <IconButton size="small" onClick={onAbonar} sx={{ color: '#10B981' }}>
                  <Payment fontSize="small" />
                </IconButton>
              </Tooltip>
              {/* ✨ NUEVO: WhatsApp inline para cobros */}
              <BotonWhatsApp
                vehiculoId={susc.vehiculo_id}
                suscripcionId={susc.id}
                tipo="pago"
                variante="icon"
                tamano="small"
              />
            </>
          )}
          {susc.estado !== 'cancelada' && (
            <Tooltip title="Cancelar suscripción">
              <IconButton size="small" onClick={onCancelar} sx={{ color: 'error.main' }}>
                <Cancel fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Stack>
      </TableCell>
    </TableRow>
  );
}

function SuscripcionCard({ susc, onVer, onAbonar, onCancelar }) {
  const colorEstado = colorPorEstadoPago(susc.estado_pago);
  const tieneSaldo = susc.saldo_pendiente > 0 && susc.estado !== 'cancelada';

  return (
    <Paper sx={{
      p: 1.5, borderRadius: 2, border: '1px solid', borderColor: 'divider',
      opacity: susc.estado === 'cancelada' ? 0.5 : 1,
    }}>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 1 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography sx={{
              fontFamily: 'monospace', fontWeight: 800, fontSize: 16,
              letterSpacing: 1.5, color: ACCENT,
            }}>
              {susc.placa || '—'}
            </Typography>
            <Chip size="small" label={susc.tipo?.toUpperCase()}
              sx={{ height: 18, fontSize: 9, fontWeight: 700, bgcolor: 'action.hover' }} />
          </Stack>
          <Typography sx={{ fontSize: 12, color: 'text.secondary' }} noWrap>
            {susc.cliente_nombre}
          </Typography>
        </Box>
        <Chip size="small"
          label={susc.estado === 'cancelada' ? 'CANCELADA' : susc.estado_pago.toUpperCase()}
          sx={{
            height: 18, fontSize: 9, fontWeight: 700,
            bgcolor: susc.estado === 'cancelada' ? '#94A3B820' : colorEstado.bg,
            color:   susc.estado === 'cancelada' ? '#475569'   : colorEstado.text,
          }}
        />
      </Stack>

      <Divider sx={{ my: 1 }} />

      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Box>
          <Typography sx={{ fontSize: 10, color: 'text.secondary', textTransform: 'uppercase' }}>
            Período
          </Typography>
          <Typography sx={{ fontSize: 11, fontWeight: 600 }}>
            {fechaCorta(susc.fecha_inicio)} → {fechaCorta(susc.fecha_vencimiento)}
          </Typography>
        </Box>
        <Box sx={{ textAlign: 'right' }}>
          <Typography sx={{ fontSize: 10, color: 'text.secondary', textTransform: 'uppercase' }}>
            {tieneSaldo ? 'Saldo' : 'Total'}
          </Typography>
          <Typography sx={{
            fontSize: 14, fontWeight: 800,
            color: tieneSaldo ? '#EF4444' : '#10B981',
          }}>
            {formatCurrency(tieneSaldo ? susc.saldo_pendiente : susc.monto_total)}
          </Typography>
        </Box>
      </Stack>

      <Stack direction="row" spacing={0.5} sx={{ mt: 1 }}>
        <Button size="small" startIcon={<Visibility />} onClick={onVer} sx={{ flex: 1, fontSize: 11 }}>
          Ver
        </Button>
        {tieneSaldo && (
          <>
            <Button size="small" startIcon={<Payment />} onClick={onAbonar}
              variant="contained" sx={{ flex: 1, fontSize: 11, bgcolor: '#10B981', '&:hover': { bgcolor: '#059669' } }}>
              Abonar
            </Button>
            {/* ✨ NUEVO: WhatsApp en mobile */}
            <BotonWhatsApp
              vehiculoId={susc.vehiculo_id}
              suscripcionId={susc.id}
              tipo="pago"
              variante="icon"
              tamano="small"
            />
          </>
        )}
      </Stack>
    </Paper>
  );
}


function AbonoDialog({ open, onClose, susc, onSuccess }) {
  const [monto, setMonto]     = useState(String(susc.saldo_pendiente || 0));
  const [metodo, setMetodo]   = useState('Efectivo');
  const [obs, setObs]         = useState('');
  const [loading, setLoading] = useState(false);

  const montoNum = Number(monto || 0);
  const excede   = montoNum > susc.saldo_pendiente + 0.01;

  const handleGuardar = async () => {
    if (montoNum <= 0) {
      toast.warning('El monto debe ser mayor a cero.');
      return;
    }
    if (excede) {
      toast.warning('El monto excede el saldo pendiente.');
      return;
    }
    setLoading(true);
    try {
      await apiClient.post('/parqueadero/pagos', {
        suscripcion_id: susc.id,
        monto:          montoNum,
        metodo_pago:    metodo,
        observaciones:  obs || null,
      });
      toast.success(`Abono de ${formatCurrency(montoNum)} registrado.`);
      onSuccess?.();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al registrar abono.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ pb: 1 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Stack direction="row" spacing={1} alignItems="center">
            <AttachMoney sx={{ color: '#10B981' }} />
            <Typography sx={{ fontWeight: 800 }}>Registrar abono</Typography>
          </Stack>
          <IconButton onClick={onClose} size="small"><Close /></IconButton>
        </Stack>
        <Typography sx={{ fontSize: 13, color: 'text.secondary', mt: 0.3 }}>
          {susc.placa} · {susc.cliente_nombre}
        </Typography>
      </DialogTitle>

      <DialogContent dividers>
        <Box sx={{
          p: 2, bgcolor: 'rgba(239, 68, 68, 0.08)',
          borderRadius: 2, mb: 2, textAlign: 'center',
        }}>
          <Typography sx={{ fontSize: 11, color: 'text.secondary', textTransform: 'uppercase', fontWeight: 700 }}>
            Saldo pendiente
          </Typography>
          <Typography sx={{ fontSize: 24, fontWeight: 900, color: '#EF4444' }}>
            {formatCurrency(susc.saldo_pendiente)}
          </Typography>
          <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
            Pagado: {formatCurrency(susc.monto_pagado)} de {formatCurrency(susc.monto_total)}
          </Typography>
        </Box>

        <CurrencyField
          fullWidth size="small" label="Monto del abono"
          value={monto}
          onChange={(val) => setMonto(val)}
          error={excede}
          helperText={excede ? 'Excede el saldo pendiente' : 'Puede ser parcial o total'}
          sx={{ mb: 2 }}
        />

        <TextField
          fullWidth select size="small" label="Método de pago"
          value={metodo} onChange={(e) => setMetodo(e.target.value)}
          sx={{ mb: 2 }}
        >
          {METODOS_PAGO.map(m => <MenuItem key={m} value={m}>{m}</MenuItem>)}
        </TextField>

        <TextField
          fullWidth size="small" multiline rows={2}
          label="Observaciones (opcional)"
          value={obs} onChange={(e) => setObs(e.target.value)}
        />
      </DialogContent>

      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} disabled={loading}>Cancelar</Button>
        <Button
          variant="contained" onClick={handleGuardar} disabled={loading || excede || montoNum <= 0}
          startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <Save />}
          sx={{ bgcolor: '#10B981', '&:hover': { bgcolor: '#059669' }, fontWeight: 700 }}
        >
          Registrar abono
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ════ REEMPLAZA ESTAS FUNCIONES AL FINAL DE TUS ARCHIVOS ════

function fechaCorta(fechaIso) {
  if (!fechaIso) return '—';

  // 🛠️ FIX: Ignoramos la 'Z' y la hora UTC para que no reste 5 horas
  const partes = fechaIso.split('T')[0].split('-');
  if (partes.length === 3) {
    const d = new Date(partes[0], partes[1] - 1, partes[2]);
    return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  const d = new Date(fechaIso);
  if (isNaN(d)) return fechaIso;
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
}

function colorPorEstado(susc) {
  // 🛠️ FIX: Comparamos fechas ignorando las horas
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0); // Normalizamos "hoy" a la medianoche local

  const partes = susc.fecha_vencimiento.split('T')[0].split('-');
  const vence = new Date(partes[0], partes[1] - 1, partes[2]);
  vence.setHours(0, 0, 0, 0);

  if (vence < hoy) return { text: '#EF4444' }; // Vencida (Rojo)
  const diff = (vence - hoy) / (1000 * 60 * 60 * 24);
  if (diff <= 5) return { text: '#F59E0B' }; // Por vencer (Amarillo)
  return { text: '#10B981' }; // Vigente (Verde)
}

function colorPorEstadoPago(estado) {
  switch (estado) {
    case 'pagado':  return { bg: '#10B98120', text: '#065F46' };
    case 'parcial': return { bg: '#F59E0B20', text: '#78350F' };
    default:        return { bg: '#EF444420', text: '#7F1D1D' };
  }
}
