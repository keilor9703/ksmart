import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Tabs, Tab, Paper, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Chip, CircularProgress, Alert,
  TextField, Grid, Card, CardContent, IconButton, Collapse,
  Divider, Button, Dialog, DialogTitle, DialogContent, DialogActions,
  Tooltip, LinearProgress, useTheme, useMediaQuery,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';
import {
  AutoAwesome, ExpandMore, ExpandLess, AccountBalance,
  TrendingUp, TrendingDown, Balance, MenuBook, Add, Delete, Receipt,
  CheckCircleOutline, ErrorOutline, Download, LockClock,
  PictureAsPdf, TableChart, Lock, AttachMoney, Storefront,
  BusinessCenter, Info,
} from '@mui/icons-material';
import apiClient from '../../api';
import CurrencyField from '../../components/common/CurrencyField';

// ─── Utilidad de descarga ─────────────────────────────────────────────────────
function descargar(url, filename) {
  const token = localStorage.getItem('token') || sessionStorage.getItem('token');
  fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    .then(r => r.blob())
    .then(blob => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
    });
}

function BotonesExportar({ tipo, fechaInicio, fechaFin, fechaCorte }) {
  const base = `/contabilidad/exportar`;
  const fi = fechaInicio ? `fecha_inicio=${encodeURIComponent(dayjs(fechaInicio).toISOString())}` : '';
  const ff = fechaFin ? `fecha_fin=${encodeURIComponent(dayjs(fechaFin).toISOString())}` : '';
  const fc = fechaCorte ? `fecha_corte=${encodeURIComponent(dayjs(fechaCorte).toISOString())}` : '';
  const qs = (parts) => parts.filter(Boolean).join('&');

  const opciones = {
    'diario': [
      { label: 'Excel', icon: <TableChart fontSize="small" />, color: '#10B981',
        url: `${base}/libro-diario.xlsx?${qs([fi, ff])}`, file: 'libro_diario.xlsx' },
      { label: 'PDF',   icon: <PictureAsPdf fontSize="small" />, color: '#EF4444',
        url: `${base}/libro-diario.pdf?${qs([fi, ff])}`, file: 'libro_diario.pdf' },
    ],
    'balance-comprobacion': [
      { label: 'Excel', icon: <TableChart fontSize="small" />, color: '#10B981',
        url: `${base}/balance-comprobacion.xlsx?${qs([fi, ff])}`, file: 'balance_comprobacion.xlsx' },
    ],
    'estado-resultados': [
      { label: 'PDF', icon: <PictureAsPdf fontSize="small" />, color: '#EF4444',
        url: `${base}/estado-resultados.pdf?${qs([fi, ff])}`, file: 'estado_resultados.pdf' },
    ],
    'balance-general': [
      { label: 'PDF', icon: <PictureAsPdf fontSize="small" />, color: '#EF4444',
        url: `${base}/balance-general.pdf?${qs([fc])}`, file: 'balance_general.pdf' },
    ],
  };

  const btns = opciones[tipo] || [];
  return (
    <Box sx={{ display: 'flex', gap: 1 }}>
      {btns.map(b => (
        <Tooltip key={b.label} title={`Descargar ${b.label}`}>
          <Button size="small" variant="outlined" startIcon={b.icon}
            sx={{ borderColor: b.color, color: b.color, '&:hover': { bgcolor: b.color + '11' } }}
            onClick={() => descargar(apiClient.defaults.baseURL + b.url, b.file)}>
            {b.label}
          </Button>
        </Tooltip>
      ))}
    </Box>
  );
}

const fmt = (n) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(n ?? 0);

const ORIGEN_LABELS = {
  venta: 'Venta', gasto: 'Gasto', compra: 'Compra',
  pago_compra: 'Pago a proveedor', cuota_prestamo: 'Cuota préstamo', manual: 'Manual',
};
const ORIGEN_COLORS = {
  venta: 'success', gasto: 'error', compra: 'warning',
  pago_compra: 'secondary', cuota_prestamo: 'info', manual: 'default',
};
const TIPO_COLORS = {
  activo: '#3B82F6', pasivo: '#EF4444', patrimonio: '#8B5CF6',
  ingreso: '#10B981', costo: '#F59E0B', gasto: '#F97316',
};

// ─── Libro Diario ────────────────────────────────────────────────────────────

function LibroDiario({ fechaInicio, fechaFin }) {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [showManual, setShowManual] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params = { page: 1, page_size: 100 };
      if (fechaInicio) params.fecha_inicio = dayjs(fechaInicio).toISOString();
      if (fechaFin) params.fecha_fin = dayjs(fechaFin).toISOString();
      const r = await apiClient.get('/contabilidad/asientos', { params });
      setItems(r.data.items); setTotal(r.data.total);
    } catch { setError('No se pudo cargar el libro diario.'); }
    finally { setLoading(false); }
  }, [fechaInicio, fechaFin]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <Box sx={{ py: 4, textAlign: 'center' }}><CircularProgress /></Box>;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="body2" color="text.secondary">
          {total} asiento{total !== 1 ? 's' : ''} registrado{total !== 1 ? 's' : ''}
        </Typography>
        <Button startIcon={<Add />} variant="outlined" size="small" onClick={() => setShowManual(true)}>
          Asiento manual
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {items.length === 0 && (
        <Alert severity="info">
          Sin asientos en este período. Las ventas, gastos y compras nuevos generarán asientos automáticamente.
        </Alert>
      )}

      {items.map((a) => (
        <Paper key={a.id} sx={{ mb: 1.5, border: '1px solid', borderColor: 'divider' }}>
          <Box
            sx={{ display: 'flex', alignItems: 'center', p: 1.5, cursor: 'pointer', gap: 1 }}
            onClick={() => setExpandedId(expandedId === a.id ? null : a.id)}
          >
            <Box sx={{ flex: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5, flexWrap: 'wrap' }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                  #{a.numero}
                </Typography>
                <Chip label={ORIGEN_LABELS[a.tipo_origen] || a.tipo_origen}
                  color={ORIGEN_COLORS[a.tipo_origen] || 'default'} size="small" />
                <Typography variant="body2" sx={{ fontWeight: 500 }}>{a.descripcion}</Typography>
              </Box>
              <Typography variant="caption" color="text.secondary">
                {new Date(a.fecha).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
              </Typography>
            </Box>
            <Box sx={{ textAlign: 'right', mr: 1, minWidth: 110 }}>
              <Typography variant="body2" color="success.main" fontWeight={600}>{fmt(a.total_debitos)}</Typography>
            </Box>
            <IconButton size="small">
              {expandedId === a.id ? <ExpandLess /> : <ExpandMore />}
            </IconButton>
          </Box>
          <Collapse in={expandedId === a.id}>
            <Divider />
            <Box sx={{ p: 1.5, overflowX: 'auto' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700, fontSize: 12 }}>Cuenta</TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: 12 }}>Descripción</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, fontSize: 12 }}>Débito</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, fontSize: 12 }}>Crédito</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(a.lineas || []).sort((x, y) => x.orden - y.orden).map((l) => (
                    <TableRow key={l.id}>
                      <TableCell sx={{ fontSize: 12 }}>
                        <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{l.cuenta?.codigo}</span>{' '}
                        <span style={{ color: '#94a3b8' }}>{l.cuenta?.nombre}</span>
                      </TableCell>
                      <TableCell sx={{ fontSize: 12, color: 'text.secondary' }}>{l.descripcion}</TableCell>
                      <TableCell align="right" sx={{ fontSize: 12, color: l.debito > 0 ? 'success.main' : 'text.disabled' }}>
                        {l.debito > 0 ? fmt(l.debito) : '—'}
                      </TableCell>
                      <TableCell align="right" sx={{ fontSize: 12, color: l.credito > 0 ? 'error.main' : 'text.disabled' }}>
                        {l.credito > 0 ? fmt(l.credito) : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow sx={{ '& td': { fontWeight: 700, borderTop: '2px solid', borderColor: 'divider' } }}>
                    <TableCell colSpan={2}>Totales</TableCell>
                    <TableCell align="right" sx={{ color: 'success.main' }}>{fmt(a.total_debitos)}</TableCell>
                    <TableCell align="right" sx={{ color: 'error.main' }}>{fmt(a.total_creditos)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </Box>
          </Collapse>
        </Paper>
      ))}

      <AsientoManualDialog open={showManual} onClose={() => setShowManual(false)} onSaved={load} />
    </Box>
  );
}

// ─── Dialog: Asiento Manual ──────────────────────────────────────────────────

function AsientoManualDialog({ open, onClose, onSaved }) {
  const [descripcion, setDescripcion] = useState('');
  const [fecha, setFecha] = useState(dayjs());
  const [cuentas, setCuentas] = useState([]);
  const [lineas, setLineas] = useState([
    { cuenta_codigo: '', descripcion: '', debito: 0, credito: 0 },
    { cuenta_codigo: '', descripcion: '', debito: 0, credito: 0 },
  ]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (open && cuentas.length === 0)
      apiClient.get('/contabilidad/cuentas').then(r => setCuentas(r.data));
  }, [open]);

  const totalD = lineas.reduce((s, l) => s + (Number(l.debito) || 0), 0);
  const totalC = lineas.reduce((s, l) => s + (Number(l.credito) || 0), 0);
  const cuadra = Math.abs(totalD - totalC) < 0.01 && totalD > 0;

  const updateLinea = (i, field, val) =>
    setLineas(prev => prev.map((l, idx) => idx === i ? { ...l, [field]: val } : l));

  const handleSave = async () => {
    setSaving(true); setError(null);
    try {
      await apiClient.post('/contabilidad/asientos', {
        fecha: dayjs(fecha).toISOString(),
        descripcion,
        lineas: lineas
          .filter(l => l.cuenta_codigo)
          .map(l => ({
            cuenta_codigo: l.cuenta_codigo,
            descripcion: l.descripcion || null,
            debito: Number(l.debito) || 0,
            credito: Number(l.credito) || 0,
          })),
      });
      onSaved(); onClose();
      setLineas([
        { cuenta_codigo: '', descripcion: '', debito: '', credito: '' },
        { cuenta_codigo: '', descripcion: '', debito: '', credito: '' },
      ]);
      setDescripcion('');
    } catch (e) {
      setError(e.response?.data?.detail || 'Error al guardar el asiento');
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Asiento Contable Manual</DialogTitle>
      <DialogContent>
        <Grid container spacing={2} sx={{ mt: 0.5 }}>
          <Grid item xs={12} sm={8}>
            <TextField label="Descripción del asiento" fullWidth size="small"
              value={descripcion} onChange={e => setDescripcion(e.target.value)} />
          </Grid>
          <Grid item xs={12} sm={4}>
            <DatePicker label="Fecha" value={fecha} onChange={setFecha}
              slotProps={{ textField: { size: 'small', fullWidth: true } }} />
          </Grid>
        </Grid>

        <Box sx={{ mt: 2 }}>
          {lineas.map((l, i) => (
            <Grid container spacing={1} key={i} sx={{ mb: 1, alignItems: 'center' }}>
              <Grid item xs={12} sm={3}>
                <TextField select label="Cuenta" size="small" fullWidth
                  value={l.cuenta_codigo} onChange={e => updateLinea(i, 'cuenta_codigo', e.target.value)}
                  SelectProps={{ native: true }}>
                  <option value=""></option>
                  {cuentas.filter(c => c.permite_movimiento).map(c => (
                    <option key={c.codigo} value={c.codigo}>{c.codigo} — {c.nombre}</option>
                  ))}
                </TextField>
              </Grid>
              <Grid item xs={12} sm={3}>
                <TextField label="Descripción" size="small" fullWidth
                  value={l.descripcion} onChange={e => updateLinea(i, 'descripcion', e.target.value)} />
              </Grid>
              <Grid item xs={5} sm={2}>
                <CurrencyField label="Débito" size="small" fullWidth
                  value={l.debito} onChange={val => updateLinea(i, 'debito', val)} />
              </Grid>
              <Grid item xs={5} sm={2}>
                <CurrencyField label="Crédito" size="small" fullWidth
                  value={l.credito} onChange={val => updateLinea(i, 'credito', val)} />
              </Grid>
              <Grid item xs={2} sm={1}>
                <IconButton size="small" color="error"
                  onClick={() => setLineas(prev => prev.filter((_, idx) => idx !== i))}>
                  <Delete fontSize="small" />
                </IconButton>
              </Grid>
            </Grid>
          ))}
          <Button size="small" startIcon={<Add />}
            onClick={() => setLineas(prev => [...prev, { cuenta_codigo: '', descripcion: '', debito: '', credito: '' }])}>
            Agregar línea
          </Button>
        </Box>

        <Box sx={{ mt: 2, p: 1.5, bgcolor: cuadra ? 'success.light' : 'warning.light', borderRadius: 2, display: 'flex', gap: 2 }}>
          {cuadra ? <CheckCircleOutline color="success" /> : <ErrorOutline color="warning" />}
          <Typography variant="body2">
            Débitos: <strong>{fmt(totalD)}</strong> — Créditos: <strong>{fmt(totalC)}</strong>
            {!cuadra && totalD > 0 && ` — Diferencia: ${fmt(Math.abs(totalD - totalC))}`}
          </Typography>
        </Box>

        {error && <Alert severity="error" sx={{ mt: 1 }}>{error}</Alert>}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button variant="contained" disabled={!cuadra || !descripcion || saving} onClick={handleSave}>
          {saving ? 'Guardando...' : 'Registrar asiento'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ─── Estado de Resultados ────────────────────────────────────────────────────

function EstadoResultados({ fechaInicio, fechaFin }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (fechaInicio) params.fecha_inicio = dayjs(fechaInicio).toISOString();
      if (fechaFin) params.fecha_fin = dayjs(fechaFin).toISOString();
      const r = await apiClient.get('/contabilidad/estado-resultados', { params });
      setData(r.data);
    } finally { setLoading(false); }
  }, [fechaInicio, fechaFin]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <Box sx={{ py: 4, textAlign: 'center' }}><CircularProgress /></Box>;
  if (!data) return null;

  const margenBruto = data.total_ingresos > 0 ? (data.utilidad_bruta / data.total_ingresos) * 100 : 0;
  const margenNeto = data.total_ingresos > 0 ? (data.utilidad_neta / data.total_ingresos) * 100 : 0;
  const esGanancia = data.utilidad_neta >= 0;

  const kpis = [
    { label: 'Total Ingresos', value: data.total_ingresos, color: '#10B981', icon: <TrendingUp />, desc: 'Ventas + Servicios + Intereses' },
    { label: 'Total Costos y Gastos', value: data.costo_ventas + data.total_gastos, color: '#EF4444', icon: <TrendingDown />, desc: `${((data.costo_ventas + data.total_gastos) / (data.total_ingresos || 1) * 100).toFixed(1)}% de ingresos` },
    { label: 'Utilidad Bruta', value: data.utilidad_bruta, color: '#3B82F6', icon: <BusinessCenter />, desc: `Margen ${margenBruto.toFixed(1)}%` },
    { label: esGanancia ? 'Utilidad Neta' : 'Pérdida Neta', value: data.utilidad_neta, color: esGanancia ? '#10B981' : '#EF4444', icon: esGanancia ? <TrendingUp /> : <TrendingDown />, desc: `Margen neto ${margenNeto.toFixed(1)}%` },
  ];

  const SectionHeader = ({ label, color }) => (
    <TableRow>
      <TableCell colSpan={3} sx={{ bgcolor: color + '18', color, fontWeight: 800, fontSize: 12, letterSpacing: 1, py: 0.75, borderBottom: `2px solid ${color}44` }}>
        {label}
      </TableCell>
    </TableRow>
  );

  const Row = ({ label, cuenta, value, indent = 0, bold = false, color = 'text.primary', bg = 'transparent' }) => (
    <TableRow sx={{ bgcolor: bg, '&:hover': { bgcolor: bg !== 'transparent' ? bg : 'action.hover' } }}>
      <TableCell sx={{ pl: 2 + indent * 2, fontWeight: bold ? 700 : 400, fontSize: bold ? 14 : 12, color, width: '55%' }}>
        {label}
      </TableCell>
      <TableCell sx={{ fontSize: 11, color: 'text.disabled', fontFamily: 'monospace' }}>{cuenta}</TableCell>
      <TableCell align="right" sx={{ fontWeight: bold ? 700 : 400, fontSize: bold ? 14 : 12, color, pr: 2 }}>
        {fmt(value)}
      </TableCell>
    </TableRow>
  );

  return (
    <Box>
      {/* KPI Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {kpis.map((k, i) => (
          <Grid item xs={6} md={3} key={i}>
            <Paper sx={{ p: 2, border: `1px solid ${k.color}33`, borderRadius: 2, position: 'relative', overflow: 'hidden' }}>
              <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, bgcolor: k.color }} />
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Box sx={{ color: k.color, display: 'flex' }}>{k.icon}</Box>
                <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.2 }}>{k.label}</Typography>
              </Box>
              <Typography variant="h6" fontWeight={700} sx={{ color: k.color, mb: 0.5 }}>{fmt(k.value)}</Typography>
              <Typography variant="caption" color="text.disabled">{k.desc}</Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>

      {/* Margen bruto visual */}
      <Paper sx={{ p: 2, mb: 3, border: '1px solid', borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="body2" fontWeight={600}>Margen bruto</Typography>
          <Typography variant="body2" fontWeight={700} color={margenBruto >= 15 ? 'success.main' : 'warning.main'}>{margenBruto.toFixed(1)}%</Typography>
        </Box>
        <LinearProgress variant="determinate" value={Math.min(Math.max(margenBruto, 0), 100)}
          sx={{ height: 8, borderRadius: 4, bgcolor: 'grey.800',
            '& .MuiLinearProgress-bar': { bgcolor: margenBruto >= 30 ? '#10B981' : margenBruto >= 15 ? '#F59E0B' : '#EF4444', borderRadius: 4 } }} />
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
          <Typography variant="caption" color="text.disabled">Objetivo mín. 15%</Typography>
          <Typography variant="caption" color="text.disabled">Objetivo óptimo 30%+</Typography>
        </Box>
      </Paper>

      {/* Tabla Estado de Resultados */}
      <Paper sx={{ border: '1px solid', borderColor: 'divider' }}>
        <Box sx={{ px: 2, py: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid', borderColor: 'divider' }}>
          <Typography variant="subtitle1" fontWeight={700}>
            Estado de Resultados — {dayjs(fechaInicio).format('DD/MM/YYYY')} al {dayjs(fechaFin).format('DD/MM/YYYY')}
          </Typography>
        </Box>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: 'grey.900' }}>
                <TableCell sx={{ color: 'white', fontWeight: 700, width: '55%' }}>CONCEPTO</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 700, fontSize: 11 }}>CUENTA PUC</TableCell>
                <TableCell align="right" sx={{ color: 'white', fontWeight: 700, pr: 2 }}>VALOR</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              <SectionHeader label="INGRESOS" color="#10B981" />
              <Row label="Venta de mercancías" cuenta="4135" value={data.ingresos_operacionales} indent={1} />
              <Row label="Ingresos por servicios" cuenta="4175" value={data.ingresos_servicios} indent={1} />
              <Row label="Intereses y rendimientos financieros" cuenta="4210" value={data.ingresos_financieros} indent={1} />
              <Row label="= TOTAL INGRESOS" value={data.total_ingresos} bold color="#10B981" bg="#10B98110" />

              <SectionHeader label="COSTO DE VENTAS" color="#F59E0B" />
              <Row label="(-) Costo de mercancías vendidas" cuenta="6135" value={data.costo_ventas} indent={1} />
              <Row label="= UTILIDAD BRUTA" value={data.utilidad_bruta} bold color={data.utilidad_bruta >= 0 ? '#10B981' : '#EF4444'} bg={data.utilidad_bruta >= 0 ? '#10B98110' : '#EF444410'} />

              <SectionHeader label="GASTOS OPERACIONALES" color="#F97316" />
              <Row label="(-) Gastos de personal y nómina" cuenta="5105" value={data.gastos_personal || 0} indent={1} />
              <Row label="(-) Gastos generales y diversos" cuenta="5195" value={data.gastos_operacionales} indent={1} />
              <Row label="(-) Gastos financieros" cuenta="5305" value={data.gastos_no_operacionales} indent={1} />
              <Row label="= TOTAL GASTOS" value={data.total_gastos} bold color="#F97316" bg="#F9731610" />

              <TableRow sx={{ bgcolor: esGanancia ? '#10B98118' : '#EF444418' }}>
                <TableCell colSpan={2} sx={{ fontWeight: 800, fontSize: 15, color: esGanancia ? '#10B981' : '#EF4444', py: 1.5, pl: 2 }}>
                  {esGanancia ? '✓ UTILIDAD NETA DEL PERÍODO' : '✗ PÉRDIDA NETA DEL PERÍODO'}
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 800, fontSize: 15, color: esGanancia ? '#10B981' : '#EF4444', pr: 2 }}>
                  {fmt(data.utilidad_neta)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
        <Box sx={{ px: 2, py: 1, borderTop: '1px solid', borderColor: 'divider', display: 'flex', gap: 3 }}>
          <Typography variant="caption" color="text.disabled">
            Margen neto: <strong style={{ color: esGanancia ? '#10B981' : '#EF4444' }}>{margenNeto.toFixed(1)}%</strong>
          </Typography>
          <Typography variant="caption" color="text.disabled">
            Margen bruto: <strong style={{ color: margenBruto >= 15 ? '#10B981' : '#F59E0B' }}>{margenBruto.toFixed(1)}%</strong>
          </Typography>
        </Box>
      </Paper>
    </Box>
  );
}

// ─── Balance General ─────────────────────────────────────────────────────────

function BalanceGeneral({ fechaFin }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (fechaFin) params.fecha_corte = dayjs(fechaFin).toISOString();
      const r = await apiClient.get('/contabilidad/balance-general', { params });
      setData(r.data);
    } finally { setLoading(false); }
  }, [fechaFin]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <Box sx={{ py: 4, textAlign: 'center' }}><CircularProgress /></Box>;
  if (!data) return null;

  const ecuacion = Math.abs(data.total_activos - data.total_pasivos_patrimonio) < 1;

  const Seccion = ({ titulo, items, total, color }) => (
    <>
      <TableRow sx={{ bgcolor: color + '22' }}>
        <TableCell colSpan={2} sx={{ fontWeight: 800, color, fontSize: 13 }}>{titulo}</TableCell>
      </TableRow>
      {items.map(item => (
        <TableRow key={item.codigo} hover>
          <TableCell sx={{ pl: 4, fontSize: 12 }}>
            <span style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 600 }}>{item.codigo}</span>{' '}
            {item.nombre}
          </TableCell>
          <TableCell align="right" sx={{ fontSize: 12 }}>{fmt(item.saldo)}</TableCell>
        </TableRow>
      ))}
      <TableRow sx={{ '& td': { fontWeight: 700, borderTop: '1px solid', borderColor: 'divider' } }}>
        <TableCell sx={{ pl: 4, color }}>Total {titulo}</TableCell>
        <TableCell align="right" sx={{ color }}>{fmt(total)}</TableCell>
      </TableRow>
    </>
  );

  return (
    <Box>
      {ecuacion ? (
        <Alert severity="success" icon={<CheckCircleOutline />} sx={{ mb: 2 }}>
          Balance cuadrado: Activos = Pasivos + Patrimonio = {fmt(data.total_activos)}
        </Alert>
      ) : (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Diferencia detectada: Activos {fmt(data.total_activos)} ≠ P+P {fmt(data.total_pasivos_patrimonio)}
        </Alert>
      )}

      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <TableContainer component={Paper}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: '#1e3a5f' }}>
                  <TableCell sx={{ color: 'white', fontWeight: 700 }}>ACTIVOS</TableCell>
                  <TableCell align="right" sx={{ color: 'white', fontWeight: 700 }}>Saldo</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                <Seccion titulo="ACTIVOS" items={data.activos} total={data.total_activos} color="#3B82F6" />
              </TableBody>
            </Table>
          </TableContainer>
        </Grid>

        <Grid item xs={12} md={6}>
          <TableContainer component={Paper}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: '#4a1942' }}>
                  <TableCell sx={{ color: 'white', fontWeight: 700 }}>PASIVOS Y PATRIMONIO</TableCell>
                  <TableCell align="right" sx={{ color: 'white', fontWeight: 700 }}>Saldo</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                <Seccion titulo="PASIVOS" items={data.pasivos} total={data.total_pasivos} color="#EF4444" />
                <Seccion titulo="PATRIMONIO" items={data.patrimonio} total={data.total_patrimonio} color="#8B5CF6" />
                <TableRow sx={{ '& td': { fontWeight: 800, fontSize: 14 } }}>
                  <TableCell>TOTAL PASIVOS + PATRIMONIO</TableCell>
                  <TableCell align="right">{fmt(data.total_pasivos_patrimonio)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        </Grid>
      </Grid>
    </Box>
  );
}

// ─── Balance de Comprobación ─────────────────────────────────────────────────

function BalanceComprobacion({ fechaInicio, fechaFin }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (fechaInicio) params.fecha_inicio = dayjs(fechaInicio).toISOString();
      if (fechaFin) params.fecha_fin = dayjs(fechaFin).toISOString();
      const r = await apiClient.get('/contabilidad/balance-comprobacion', { params });
      setRows(r.data);
    } finally { setLoading(false); }
  }, [fechaInicio, fechaFin]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <Box sx={{ py: 4, textAlign: 'center' }}><CircularProgress /></Box>;

  const totD  = rows.reduce((s, r) => s + r.total_debitos,  0);
  const totC  = rows.reduce((s, r) => s + r.total_creditos, 0);
  const totSD = rows.reduce((s, r) => s + r.saldo_debito,   0);
  const totSC = rows.reduce((s, r) => s + r.saldo_credito,  0);

  if (rows.length === 0)
    return <Alert severity="info">Sin movimientos.</Alert>;

  /* ── Vista móvil — tarjetas ─────────────────────────────────────── */
  if (isMobile) {
    return (
      <Box>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {rows.map(r => {
            const color = TIPO_COLORS[r.tipo] || '#888';
            return (
              <Paper key={r.codigo} sx={{ p: 1.5, border: '1px solid', borderColor: 'divider', borderLeft: `3px solid ${color}` }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography sx={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 12, color }}>{r.codigo}</Typography>
                    <Chip label={r.tipo} size="small"
                      sx={{ bgcolor: color + '22', color, fontSize: 10, height: 20 }} />
                  </Box>
                </Box>
                <Typography sx={{ fontSize: 13, fontWeight: 500, mb: 1 }}>{r.nombre}</Typography>
                <Grid container spacing={1}>
                  <Grid item xs={6}>
                    <Typography sx={{ fontSize: 10, color: 'text.disabled', textTransform: 'uppercase' }}>Débitos</Typography>
                    <Typography sx={{ fontSize: 12, fontWeight: 600 }}>{fmt(r.total_debitos)}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography sx={{ fontSize: 10, color: 'text.disabled', textTransform: 'uppercase' }}>Créditos</Typography>
                    <Typography sx={{ fontSize: 12, fontWeight: 600 }}>{fmt(r.total_creditos)}</Typography>
                  </Grid>
                  {r.saldo_debito > 0 && (
                    <Grid item xs={6}>
                      <Typography sx={{ fontSize: 10, color: 'text.disabled', textTransform: 'uppercase' }}>Saldo Déb.</Typography>
                      <Typography sx={{ fontSize: 12, fontWeight: 600, color: 'success.main' }}>{fmt(r.saldo_debito)}</Typography>
                    </Grid>
                  )}
                  {r.saldo_credito > 0 && (
                    <Grid item xs={6}>
                      <Typography sx={{ fontSize: 10, color: 'text.disabled', textTransform: 'uppercase' }}>Saldo Créd.</Typography>
                      <Typography sx={{ fontSize: 12, fontWeight: 600, color: 'error.main' }}>{fmt(r.saldo_credito)}</Typography>
                    </Grid>
                  )}
                </Grid>
              </Paper>
            );
          })}
        </Box>
        {/* Totales móvil */}
        <Paper sx={{ mt: 1.5, p: 1.5, bgcolor: 'action.selected' }}>
          <Typography sx={{ fontWeight: 700, fontSize: 12, mb: 1 }}>TOTALES</Typography>
          <Grid container spacing={1}>
            <Grid item xs={6}><Typography sx={{ fontSize: 11, color: 'text.secondary' }}>Débitos</Typography><Typography sx={{ fontWeight: 700 }}>{fmt(totD)}</Typography></Grid>
            <Grid item xs={6}><Typography sx={{ fontSize: 11, color: 'text.secondary' }}>Créditos</Typography><Typography sx={{ fontWeight: 700 }}>{fmt(totC)}</Typography></Grid>
            <Grid item xs={6}><Typography sx={{ fontSize: 11, color: 'text.secondary' }}>Saldo Déb.</Typography><Typography sx={{ fontWeight: 700, color: 'success.main' }}>{fmt(totSD)}</Typography></Grid>
            <Grid item xs={6}><Typography sx={{ fontSize: 11, color: 'text.secondary' }}>Saldo Créd.</Typography><Typography sx={{ fontWeight: 700, color: 'error.main' }}>{fmt(totSC)}</Typography></Grid>
          </Grid>
        </Paper>
      </Box>
    );
  }

  /* ── Vista desktop — tabla ──────────────────────────────────────── */
  return (
    <TableContainer component={Paper}>
      <Table size="small">
        <TableHead>
          <TableRow sx={{ bgcolor: 'grey.900' }}>
            {['Código','Cuenta','Tipo','Débitos','Créditos','Saldo Déb.','Saldo Créd.'].map(h => (
              <TableCell key={h} align={h.length > 5 ? 'right' : 'left'}
                sx={{ color: 'white', fontWeight: 700, '&:first-of-type, &:nth-of-type(2), &:nth-of-type(3)': { textAlign: 'left' } }}>
                {h}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map(r => (
            <TableRow key={r.codigo} hover>
              <TableCell sx={{ fontFamily: 'monospace', fontWeight: 600 }}>{r.codigo}</TableCell>
              <TableCell sx={{ fontSize: 12 }}>{r.nombre}</TableCell>
              <TableCell>
                <Chip label={r.tipo} size="small"
                  sx={{ bgcolor: (TIPO_COLORS[r.tipo] || '#888') + '22', color: TIPO_COLORS[r.tipo] || '#888', fontSize: 11 }} />
              </TableCell>
              <TableCell align="right" sx={{ fontSize: 12 }}>{fmt(r.total_debitos)}</TableCell>
              <TableCell align="right" sx={{ fontSize: 12 }}>{fmt(r.total_creditos)}</TableCell>
              <TableCell align="right" sx={{ fontSize: 12, color: 'success.main' }}>{r.saldo_debito > 0 ? fmt(r.saldo_debito) : ''}</TableCell>
              <TableCell align="right" sx={{ fontSize: 12, color: 'error.main' }}>{r.saldo_credito > 0 ? fmt(r.saldo_credito) : ''}</TableCell>
            </TableRow>
          ))}
          <TableRow sx={{ '& td': { fontWeight: 700, borderTop: '2px solid', borderColor: 'divider' } }}>
            <TableCell colSpan={3}>TOTALES</TableCell>
            <TableCell align="right">{fmt(totD)}</TableCell>
            <TableCell align="right">{fmt(totC)}</TableCell>
            <TableCell align="right" sx={{ color: 'success.main' }}>{fmt(totSD)}</TableCell>
            <TableCell align="right" sx={{ color: 'error.main' }}>{fmt(totSC)}</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </TableContainer>
  );
}

// ─── Resumen IVA / Impuestos ──────────────────────────────────────────────────

function ResumenIVA({ fechaInicio, fechaFin }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (fechaInicio) params.fecha_inicio = dayjs(fechaInicio).toISOString();
      if (fechaFin) params.fecha_fin = dayjs(fechaFin).toISOString();
      const r = await apiClient.get('/contabilidad/resumen-iva', { params });
      setData(r.data);
    } finally { setLoading(false); }
  }, [fechaInicio, fechaFin]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <Box sx={{ py: 4, textAlign: 'center' }}><CircularProgress /></Box>;
  if (!data) return null;

  const aPagar = data.iva_a_pagar > 0;
  const ivaNeto = aPagar ? data.iva_a_pagar : data.iva_a_favor;
  // Estimado de ICA: 1% sobre base gravable ventas (base = iva_generado / 0.19)
  const baseGravableVentas = data.iva_generado > 0 ? Math.round(data.iva_generado / 0.19) : 0;
  const icaEstimado = Math.round(baseGravableVentas * 0.001);

  const bimestre = (() => {
    const d = dayjs(fechaInicio);
    const mes = d.month();
    const bim = Math.floor(mes / 2) + 1;
    return `Bimestre ${bim} — ${d.format('MMM').toUpperCase()} / ${d.add(1, 'month').format('MMM YYYY').toUpperCase()}`;
  })();

  return (
    <Box>
      {/* Header período */}
      <Paper sx={{ p: 2, mb: 3, border: '1px solid', borderColor: '#F9731344', bgcolor: '#F9731308', display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
        <AccountBalance sx={{ color: '#F97316' }} />
        <Box sx={{ flex: 1 }}>
          <Typography variant="subtitle1" fontWeight={700} color="#F97316">PERÍODO BIMESTRAL DIAN</Typography>
          <Typography variant="body2" color="text.secondary">{bimestre} · {dayjs(fechaInicio).format('DD/MM/YYYY')} — {dayjs(fechaFin).format('DD/MM/YYYY')}</Typography>
        </Box>
        <Chip label="Formulario 300 · DIAN" sx={{ bgcolor: '#F9731322', color: '#F97316', fontWeight: 600 }} />
      </Paper>

      {/* KPI Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={4}>
          <Paper sx={{ p: 2.5, border: '1px solid #10B98133', borderRadius: 2, position: 'relative', overflow: 'hidden' }}>
            <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, bgcolor: '#10B981' }} />
            <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
              Ventas Brutas (inc. IVA)
            </Typography>
            <Typography variant="h5" fontWeight={700} color="#10B981" sx={{ mb: 0.5 }}>
              {fmt(baseGravableVentas + data.iva_generado)}
            </Typography>
            <Typography variant="caption" color="text.disabled">Total facturado inc. IVA</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Paper sx={{ p: 2.5, border: '1px solid #3B82F633', borderRadius: 2, position: 'relative', overflow: 'hidden' }}>
            <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, bgcolor: '#3B82F6' }} />
            <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
              Base Gravable Ventas
            </Typography>
            <Typography variant="h5" fontWeight={700} color="#3B82F6" sx={{ mb: 0.5 }}>
              {fmt(baseGravableVentas)}
            </Typography>
            <Typography variant="caption" color="text.disabled">Ventas sin IVA</Typography>
          </Paper>
        </Grid>
        <Grid item xs={6} sm={2}>
          <Paper sx={{ p: 2.5, border: '1px solid #EF444433', borderRadius: 2, position: 'relative', overflow: 'hidden' }}>
            <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, bgcolor: '#EF4444' }} />
            <Typography variant="caption" color="text.secondary" display="block" gutterBottom>IVA Generado</Typography>
            <Typography variant="h6" fontWeight={700} color="#EF4444">{fmt(data.iva_generado)}</Typography>
            <Typography variant="caption" color="text.disabled">IVA cobrado en ventas</Typography>
          </Paper>
        </Grid>
        <Grid item xs={6} sm={2}>
          <Paper sx={{ p: 2.5, border: '1px solid #6366F133', borderRadius: 2, position: 'relative', overflow: 'hidden' }}>
            <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, bgcolor: '#6366F1' }} />
            <Typography variant="caption" color="text.secondary" display="block" gutterBottom>IVA Descontable</Typography>
            <Typography variant="h6" fontWeight={700} color="#6366F1">{fmt(data.iva_descontable)}</Typography>
            <Typography variant="caption" color="text.disabled">IVA pagado en compras</Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* IVA Neto destacado */}
      <Paper sx={{ p: 3, mb: 3, border: `2px solid ${aPagar ? '#EF4444' : '#10B981'}55`, bgcolor: aPagar ? '#EF444408' : '#10B98108', borderRadius: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
          <Box>
            <Typography variant="overline" sx={{ color: aPagar ? '#EF4444' : '#10B981', fontWeight: 700, letterSpacing: 2 }}>
              IVA NETO — {aPagar ? 'A PAGAR' : 'A FAVOR'}
            </Typography>
            <Typography variant="h4" fontWeight={800} sx={{ color: aPagar ? '#EF4444' : '#10B981' }}>
              {fmt(ivaNeto)}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {aPagar ? 'Debe declarar y pagar este valor a la DIAN (Form. 300)' : 'Saldo a favor — puede descontar en el siguiente período'}
            </Typography>
          </Box>
          <Chip label={aPagar ? 'A PAGAR' : 'A FAVOR'}
            sx={{ bgcolor: aPagar ? '#EF4444' : '#10B981', color: 'white', fontWeight: 700, fontSize: 13, px: 1 }} />
        </Box>
      </Paper>

      {/* Tabla detallada Forma 300 */}
      <Paper sx={{ border: '1px solid', borderColor: 'divider', mb: 3 }}>
        <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Typography variant="subtitle2" fontWeight={700}>Detalle declaración IVA (Formulario 300)</Typography>
        </Box>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: 'grey.900' }}>
                <TableCell sx={{ color: 'white', fontWeight: 700 }}>CONCEPTO</TableCell>
                <TableCell align="right" sx={{ color: 'white', fontWeight: 700 }}>VALOR</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              <TableRow><TableCell colSpan={2} sx={{ bgcolor: '#10B98112', color: '#10B981', fontWeight: 700, fontSize: 11, letterSpacing: 1 }}>VENTAS</TableCell></TableRow>
              <TableRow hover><TableCell sx={{ pl: 3 }}>Ventas brutas totales (inc. IVA)</TableCell><TableCell align="right" sx={{ color: '#10B981' }}>{fmt(baseGravableVentas + data.iva_generado)}</TableCell></TableRow>
              <TableRow hover><TableCell sx={{ pl: 3 }}>(-) IVA incluido en ventas</TableCell><TableCell align="right">{fmt(data.iva_generado)}</TableCell></TableRow>
              <TableRow sx={{ bgcolor: '#10B98108' }}><TableCell sx={{ pl: 3, fontWeight: 700 }}>= Base gravable ventas</TableCell><TableCell align="right" sx={{ fontWeight: 700, color: '#10B981' }}>{fmt(baseGravableVentas)}</TableCell></TableRow>
              <TableRow sx={{ bgcolor: '#10B98108' }}><TableCell sx={{ pl: 3, fontWeight: 700 }}>IVA generado (≈19% s/ base gravable)</TableCell><TableCell align="right" sx={{ fontWeight: 700, color: '#10B981' }}>{fmt(data.iva_generado)}</TableCell></TableRow>

              <TableRow><TableCell colSpan={2} sx={{ bgcolor: '#3B82F612', color: '#3B82F6', fontWeight: 700, fontSize: 11, letterSpacing: 1 }}>COMPRAS</TableCell></TableRow>
              <TableRow hover><TableCell sx={{ pl: 3 }}>(-) IVA descontable (crédito fiscal)</TableCell><TableCell align="right" sx={{ color: '#3B82F6' }}>{fmt(data.iva_descontable)}</TableCell></TableRow>

              <TableRow><TableCell colSpan={2} sx={{ bgcolor: '#F9731612', color: '#F97316', fontWeight: 700, fontSize: 11, letterSpacing: 1 }}>RESULTADO</TableCell></TableRow>
              <TableRow sx={{ bgcolor: aPagar ? '#EF444410' : '#10B98110' }}>
                <TableCell sx={{ fontWeight: 800, fontSize: 14 }}>IVA Neto — {aPagar ? 'A pagar' : 'A favor'}</TableCell>
                <TableCell align="right" sx={{ fontWeight: 800, fontSize: 14, color: aPagar ? '#EF4444' : '#10B981' }}>{fmt(ivaNeto)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* ICA estimado */}
      {icaEstimado > 0 && (
        <Paper sx={{ p: 2, mb: 3, border: '1px solid', borderColor: '#6366F133', bgcolor: '#6366F108' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <AccountBalance sx={{ color: '#6366F1', fontSize: 28 }} />
            <Box>
              <Typography variant="subtitle2" fontWeight={700} color="#6366F1">Estimado ICA — Industria y Comercio</Typography>
              <Typography variant="h6" fontWeight={700} color="#6366F1">{fmt(icaEstimado)}</Typography>
              <Typography variant="caption" color="text.secondary">
                Calculado sobre base gravable ventas ({fmt(baseGravableVentas)}) × tasa estimada 10‰ (1%). Verifica la tarifa vigente de tu municipio con tu contador — la tasa varía según actividad económica y localidad.
              </Typography>
            </Box>
          </Box>
        </Paper>
      )}

      {/* Info tributaria */}
      <Paper sx={{ p: 2, border: '1px solid', borderColor: '#F59E0B44', bgcolor: '#F59E0B08' }}>
        <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
          <Info sx={{ color: '#F59E0B', fontSize: 18 }} />
          <Typography variant="subtitle2" fontWeight={700} color="#F59E0B">Información tributaria Colombia</Typography>
        </Box>
        {[
          'Declaración de IVA: Formulario 300 ante DIAN.',
          'Período: Bimestral (grandes contribuyentes y responsables del régimen común).',
          'Tarifa general IVA: 19% | Bienes especiales: 5% | Excluidos: 0%.',
          'Tasa ReteIVA (si aplica): 15% sobre IVA facturado — aplica cuando el comprador es gran contribuyente o agente retenedor.',
          'Nota: Este reporte muestra IVA consolidado. Consulta tu contador para la declaración definitiva.',
        ].map((t, i) => (
          <Typography key={i} variant="caption" color="text.secondary" display="block" sx={{ '&::before': { content: '"•"', mr: 1, color: '#F59E0B' } }}>{t}</Typography>
        ))}
      </Paper>
    </Box>
  );
}

// ─── Cierre Contable ─────────────────────────────────────────────────────────

function CierreContableTab() {
  const [cierres, setCierres] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);

  const load = () => {
    setLoading(true);
    apiClient.get('/contabilidad/cierres').then(r => setCierres(r.data)).finally(() => setLoading(false));
  };
  useEffect(load, []);

  if (loading) return <Box sx={{ py: 4, textAlign: 'center' }}><CircularProgress /></Box>;

  return (
    <Box>
      <Alert severity="warning" sx={{ mb: 3 }}>
        <strong>El cierre contable es irreversible.</strong> Traslada los saldos de ingresos, costos y gastos
        a la cuenta de Resultado del Ejercicio (3605/3610) y congela el período. Solo hazlo al finalizar un ejercicio fiscal.
      </Alert>

      <Box sx={{ mb: 2 }}>
        <Button variant="contained" color="warning" startIcon={<Lock />} onClick={() => setShowDialog(true)}>
          Ejecutar Cierre de Período
        </Button>
      </Box>

      {cierres.length === 0 ? (
        <Alert severity="info">No hay cierres contables registrados.</Alert>
      ) : (
        <TableContainer component={Paper} sx={{ overflowX: 'auto' }}>
          <Table size="small" sx={{ minWidth: 560 }}>
            <TableHead>
              <TableRow sx={{ bgcolor: 'grey.900' }}>
                {['#', 'Descripción', 'Período inicio', 'Período fin', 'Utilidad neta', 'Fecha cierre'].map(h => (
                  <TableCell key={h} sx={{ color: 'white', fontWeight: 700, whiteSpace: 'nowrap' }}>{h}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {cierres.map(c => (
                <TableRow key={c.id} hover>
                  <TableCell>{c.id}</TableCell>
                  <TableCell>{c.descripcion}</TableCell>
                  <TableCell>{new Date(c.periodo_inicio).toLocaleDateString('es-CO')}</TableCell>
                  <TableCell>{new Date(c.periodo_fin).toLocaleDateString('es-CO')}</TableCell>
                  <TableCell sx={{ color: c.utilidad_neta >= 0 ? 'success.main' : 'error.main', fontWeight: 700 }}>
                    {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(c.utilidad_neta)}
                  </TableCell>
                  <TableCell>{new Date(c.created_at).toLocaleDateString('es-CO')}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <DialogCierre open={showDialog} onClose={() => setShowDialog(false)} onDone={() => { setShowDialog(false); load(); }} />
    </Box>
  );
}

function DialogCierre({ open, onClose, onDone }) {
  const [inicio, setInicio] = useState(dayjs().startOf('year'));
  const [fin, setFin] = useState(dayjs().endOf('year'));
  const [descripcion, setDescripcion] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [confirm, setConfirm] = useState(false);

  const handleEjecutar = async () => {
    setSaving(true); setError(null);
    try {
      await apiClient.post('/contabilidad/cierres', {
        periodo_inicio: dayjs(inicio).toISOString(),
        periodo_fin: dayjs(fin).toISOString(),
        descripcion: descripcion || `Cierre ejercicio ${dayjs(inicio).year()}`,
      });
      onDone();
    } catch (e) {
      setError(e.response?.data?.detail || 'Error al ejecutar el cierre');
    } finally { setSaving(false); setConfirm(false); }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Lock color="warning" /> Cierre Contable de Período
      </DialogTitle>
      <DialogContent>
        {!confirm ? (
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12}>
              <TextField label="Descripción" fullWidth size="small" value={descripcion}
                onChange={e => setDescripcion(e.target.value)}
                placeholder={`Cierre ejercicio ${new Date().getFullYear()}`} />
            </Grid>
            <Grid item xs={6}>
              <DatePicker label="Inicio período" value={inicio} onChange={setInicio}
                slotProps={{ textField: { size: 'small', fullWidth: true } }} />
            </Grid>
            <Grid item xs={6}>
              <DatePicker label="Fin período" value={fin} onChange={setFin}
                slotProps={{ textField: { size: 'small', fullWidth: true } }} />
            </Grid>
          </Grid>
        ) : (
          <Alert severity="error" sx={{ mt: 1 }}>
            <strong>¿Confirmas el cierre?</strong><br />
            Se generará un asiento de cierre que lleva a cero todas las cuentas de ingresos,
            costos y gastos del período <strong>{inicio ? dayjs(inicio).format('DD/MM/YYYY') : ''} al {fin ? dayjs(fin).format('DD/MM/YYYY') : ''}</strong>.
            Esta acción <strong>no se puede deshacer</strong>.
          </Alert>
        )}
        {error && <Alert severity="error" sx={{ mt: 1 }}>{error}</Alert>}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        {!confirm ? (
          <Button variant="contained" color="warning" onClick={() => setConfirm(true)}>
            Revisar y confirmar
          </Button>
        ) : (
          <Button variant="contained" color="error" disabled={saving} onClick={handleEjecutar}>
            {saving ? 'Ejecutando...' : 'Sí, ejecutar cierre'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

// ─── Plan de Cuentas ─────────────────────────────────────────────────────────

function PlanCuentas() {
  const [cuentas, setCuentas] = useState([]);
  const [loading, setLoading] = useState(true);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  useEffect(() => {
    apiClient.get('/contabilidad/cuentas').then((r) => setCuentas(r.data)).finally(() => setLoading(false));
  }, []);

  if (loading) return <Box sx={{ py: 4, textAlign: 'center' }}><CircularProgress /></Box>;

  // ── Vista móvil — tarjetas ───────────────────────────────────────────────
  if (isMobile) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        {cuentas.map((c) => {
          const isGroup = c.nivel <= 2;
          const color = TIPO_COLORS[c.tipo] || '#888';
          return (
            <Box
              key={c.id}
              sx={{
                px: 1.5, py: 1,
                pl: 1.5 + c.nivel * 1.2,
                borderLeft: isGroup ? `3px solid ${color}` : `1px solid transparent`,
                bgcolor: isGroup
                  ? theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.025)'
                  : 'transparent',
                opacity: c.permite_movimiento ? 1 : 0.55,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                <Typography sx={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 12, color: color, minWidth: 38 }}>
                  {c.codigo}
                </Typography>
                <Typography sx={{ fontSize: 13, fontWeight: isGroup ? 800 : 400, flex: 1 }}>
                  {c.nombre}
                </Typography>
                <Chip
                  label={c.tipo}
                  size="small"
                  sx={{ bgcolor: color + '22', color, fontSize: 10, height: 20 }}
                />
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.3, pl: 0.5 }}>
                <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{c.naturaleza}</Typography>
                {c.permite_movimiento && (
                  <Typography sx={{ fontSize: 10, color: 'success.main', fontWeight: 700 }}>· Mov. permitido</Typography>
                )}
              </Box>
            </Box>
          );
        })}
      </Box>
    );
  }

  // ── Vista desktop — tabla ────────────────────────────────────────────────
  return (
    <TableContainer component={Paper}>
      <Table size="small">
        <TableHead>
          <TableRow sx={{ bgcolor: 'grey.900' }}>
            {['Código','Nombre','Tipo','Naturaleza','Mov.'].map(h => (
              <TableCell key={h} sx={{ color: 'white', fontWeight: 700 }}>{h}</TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {cuentas.map((c) => (
            <TableRow key={c.id} hover sx={{ opacity: c.permite_movimiento ? 1 : 0.65 }}>
              <TableCell sx={{ fontFamily: 'monospace', fontWeight: 600, pl: 1 + c.nivel * 1.5 }}>{c.codigo}</TableCell>
              <TableCell sx={{ fontSize: 12, fontWeight: c.nivel <= 2 ? 700 : 400 }}>{c.nombre}</TableCell>
              <TableCell>
                <Chip label={c.tipo} size="small"
                  sx={{ bgcolor: (TIPO_COLORS[c.tipo] || '#888') + '22', color: TIPO_COLORS[c.tipo] || '#888', fontSize: 11 }} />
              </TableCell>
              <TableCell sx={{ fontSize: 12 }}>{c.naturaleza}</TableCell>
              <TableCell sx={{ color: c.permite_movimiento ? 'success.main' : 'text.disabled' }}>
                {c.permite_movimiento ? '✓' : ''}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

// ─── Componente principal ────────────────────────────────────────────────────

const TABS = [
  { label: 'Libro Diario',          short: 'Diario',    icon: <MenuBook fontSize="small" /> },
  { label: 'Estado de Resultados',  short: 'P&L',       icon: <TrendingUp fontSize="small" /> },
  { label: 'Balance General',       short: 'Bal. Gral', icon: <AccountBalance fontSize="small" /> },
  { label: 'Bal. Comprobación',     short: 'Comprob.',  icon: <Balance fontSize="small" /> },
  { label: 'IVA / Impuestos',       short: 'IVA',       icon: <Receipt fontSize="small" /> },
  { label: 'Cierre Contable',       short: 'Cierre',    icon: <LockClock fontSize="small" /> },
  { label: 'Plan de Cuentas (PUC)', short: 'PUC',       icon: <AutoAwesome fontSize="small" /> },
];

// Botones de exportación por tab
const EXPORT_BTNS = {
  0: 'diario', 1: 'estado-resultados', 2: 'balance-general', 3: 'balance-comprobacion',
};

// Calcula el bimestre actual (Colombia: ene-feb, mar-abr, may-jun, jul-ago, sep-oct, nov-dic)
function bimestreActual() {
  const now = dayjs();
  const mes = now.month(); // 0-based
  const inicioMes = Math.floor(mes / 2) * 2;
  return {
    inicio: now.month(inicioMes).startOf('month'),
    fin: now.month(inicioMes + 1).endOf('month'),
  };
}

export default function Contabilidad() {
  const [tab, setTab] = useState(0);
  const [fechaInicio, setFechaInicio] = useState(dayjs().startOf('month'));
  const [fechaFin, setFechaFin] = useState(dayjs().endOf('month'));
  const [inicializando, setInicializando] = useState(false);
  const [initResult, setInitResult] = useState(null);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const handleInicializar = async () => {
    setInicializando(true);
    setInitResult(null);
    try {
      const r = await apiClient.post('/contabilidad/inicializar');
      setInitResult(r.data.asientos_creados);
    } catch (e) {
      setInitResult({ error: 'Error al inicializar' });
    } finally {
      setInicializando(false);
    }
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <Box sx={{ p: { xs: 1, md: 3 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3, flexWrap: 'wrap' }}>
          <AutoAwesome sx={{ color: '#6366F1', fontSize: 30, flexShrink: 0 }} />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant={isMobile ? 'h6' : 'h5'} fontWeight={700}>Contabilidad Automática</Typography>
            {!isMobile && (
              <Typography variant="body2" color="text.secondary">
                Asientos en partida doble · PUC colombiano · Reportes DIAN · Balance General · Exportación PDF/Excel
              </Typography>
            )}
          </Box>
          <Tooltip title="Genera asientos contables para todas las transacciones históricas que aún no los tienen. Ejecuta una sola vez al activar el módulo.">
            <Button
              variant="outlined" size="small"
              startIcon={inicializando ? <CircularProgress size={14} /> : <AccountBalance />}
              onClick={handleInicializar} disabled={inicializando}
              sx={{ borderColor: '#6366F1', color: '#6366F1', flexShrink: 0,
                '&:hover': { borderColor: '#4F46E5', bgcolor: '#6366F111' } }}
            >
              {isMobile ? (inicializando ? '…' : 'Inicializar') : (inicializando ? 'Procesando…' : 'Inicializar contabilidad')}
            </Button>
          </Tooltip>
        </Box>

        {initResult && !initResult.error && (
          <Alert severity="success" sx={{ mb: 2 }} onClose={() => setInitResult(null)}>
            Inicialización completa — Asientos creados: <strong>Ventas {initResult.ventas}</strong> · <strong>Gastos {initResult.gastos}</strong> · <strong>Compras {initResult.compras}</strong> · <strong>Pagos proveedores {initResult.pagos_compra}</strong> · <strong>Cuotas préstamo {initResult.cuotas}</strong>. Total: <strong>{initResult.total}</strong>
          </Alert>
        )}
        {initResult?.error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setInitResult(null)}>{initResult.error}</Alert>
        )}

        {tab < 5 && (
          <Grid container spacing={2} sx={{ mb: 2 }} alignItems="center">
            <Grid item xs={12} sm={6} md={3}>
              <DatePicker label="Desde" value={fechaInicio} onChange={setFechaInicio}
                slotProps={{ textField: { size: 'small', fullWidth: true } }} />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <DatePicker label="Hasta" value={fechaFin} onChange={setFechaFin}
                slotProps={{ textField: { size: 'small', fullWidth: true } }} />
            </Grid>
            {tab === 4 && (
              <Grid item xs={12} sm="auto">
                <Tooltip title="Bimestre actual — período estándar para declaración IVA Colombia">
                  <Button size="small" variant="outlined" color="warning"
                    onClick={() => { const b = bimestreActual(); setFechaInicio(b.inicio); setFechaFin(b.fin); }}>
                    Bimestre actual
                  </Button>
                </Tooltip>
              </Grid>
            )}
            {EXPORT_BTNS[tab] && (
              <Grid item xs={12} md="auto">
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Download sx={{ color: 'text.secondary', fontSize: 18 }} />
                  <BotonesExportar tipo={EXPORT_BTNS[tab]}
                    fechaInicio={fechaInicio} fechaFin={fechaFin} fechaCorte={fechaFin} />
                </Box>
              </Grid>
            )}
          </Grid>
        )}

        <Tabs value={tab} onChange={(_, v) => setTab(v)}
          sx={{
            mb: 3, borderBottom: 1, borderColor: 'divider',
            '& .MuiTab-root': { minWidth: isMobile ? 0 : 'auto', px: isMobile ? 1 : 2, fontSize: isMobile ? 11 : 13 },
          }}
          variant="scrollable" scrollButtons="auto" allowScrollButtonsMobile>
          {TABS.map((t, i) => (
            <Tab key={i} label={isMobile ? t.short : t.label} icon={t.icon}
              iconPosition={isMobile ? 'top' : 'start'}
              sx={isMobile ? { minHeight: 56, gap: 0, py: 0.5, '& .MuiTab-iconWrapper': { mb: 0 } } : {}} />
          ))}
        </Tabs>

        {isMobile && (
          <Typography sx={{ fontWeight: 700, fontSize: 13, color: '#6366F1', mb: 1.5 }}>
            {TABS[tab].label}
          </Typography>
        )}

        {tab === 0 && <LibroDiario fechaInicio={fechaInicio} fechaFin={fechaFin} />}
        {tab === 1 && <EstadoResultados fechaInicio={fechaInicio} fechaFin={fechaFin} />}
        {tab === 2 && <BalanceGeneral fechaFin={fechaFin} />}
        {tab === 3 && <BalanceComprobacion fechaInicio={fechaInicio} fechaFin={fechaFin} />}
        {tab === 4 && <ResumenIVA fechaInicio={fechaInicio} fechaFin={fechaFin} />}
        {tab === 5 && <CierreContableTab />}
        {tab === 6 && <PlanCuentas />}
      </Box>
    </LocalizationProvider>
  );
}
