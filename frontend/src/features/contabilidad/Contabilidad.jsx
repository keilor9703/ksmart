import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Tabs, Tab, Paper, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Chip, CircularProgress, Alert,
  TextField, Grid, Card, CardContent, IconButton, Collapse,
  Divider, Button, Dialog, DialogTitle, DialogContent, DialogActions,
  InputAdornment, Tooltip,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { es } from 'date-fns/locale';
import {
  AutoAwesome, ExpandMore, ExpandLess, AccountBalance,
  TrendingUp, Balance, MenuBook, Add, Delete, Receipt,
  CheckCircleOutline, ErrorOutline, Download, LockClock,
  PictureAsPdf, TableChart, Lock,
} from '@mui/icons-material';
import { startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';
import apiClient from '../../api';

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
  const fi = fechaInicio ? `fecha_inicio=${encodeURIComponent(fechaInicio.toISOString())}` : '';
  const ff = fechaFin ? `fecha_fin=${encodeURIComponent(fechaFin.toISOString())}` : '';
  const fc = fechaCorte ? `fecha_corte=${encodeURIComponent(fechaCorte.toISOString())}` : '';
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
      if (fechaInicio) params.fecha_inicio = fechaInicio.toISOString();
      if (fechaFin) params.fecha_fin = fechaFin.toISOString();
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
  const [fecha, setFecha] = useState(new Date());
  const [cuentas, setCuentas] = useState([]);
  const [lineas, setLineas] = useState([
    { cuenta_codigo: '', descripcion: '', debito: '', credito: '' },
    { cuenta_codigo: '', descripcion: '', debito: '', credito: '' },
  ]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (open && cuentas.length === 0)
      apiClient.get('/contabilidad/cuentas').then(r => setCuentas(r.data));
  }, [open]);

  const totalD = lineas.reduce((s, l) => s + (parseFloat(l.debito) || 0), 0);
  const totalC = lineas.reduce((s, l) => s + (parseFloat(l.credito) || 0), 0);
  const cuadra = Math.abs(totalD - totalC) < 0.01 && totalD > 0;

  const updateLinea = (i, field, val) =>
    setLineas(prev => prev.map((l, idx) => idx === i ? { ...l, [field]: val } : l));

  const handleSave = async () => {
    setSaving(true); setError(null);
    try {
      await apiClient.post('/contabilidad/asientos', {
        fecha: fecha.toISOString(),
        descripcion,
        lineas: lineas
          .filter(l => l.cuenta_codigo)
          .map(l => ({
            cuenta_codigo: l.cuenta_codigo,
            descripcion: l.descripcion || null,
            debito: parseFloat(l.debito) || 0,
            credito: parseFloat(l.credito) || 0,
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
                <TextField label="Débito" size="small" fullWidth type="number"
                  value={l.debito} onChange={e => updateLinea(i, 'debito', e.target.value)}
                  InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }} />
              </Grid>
              <Grid item xs={5} sm={2}>
                <TextField label="Crédito" size="small" fullWidth type="number"
                  value={l.credito} onChange={e => updateLinea(i, 'credito', e.target.value)}
                  InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }} />
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
      if (fechaInicio) params.fecha_inicio = fechaInicio.toISOString();
      if (fechaFin) params.fecha_fin = fechaFin.toISOString();
      const r = await apiClient.get('/contabilidad/estado-resultados', { params });
      setData(r.data);
    } finally { setLoading(false); }
  }, [fechaInicio, fechaFin]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <Box sx={{ py: 4, textAlign: 'center' }}><CircularProgress /></Box>;
  if (!data) return null;

  const Row = ({ label, value, indent = 0, bold = false, color = 'inherit', divider = false }) => (
    <>
      {divider && <TableRow><TableCell colSpan={2} sx={{ p: 0 }}><Divider /></TableCell></TableRow>}
      <TableRow>
        <TableCell sx={{ pl: 2 + indent * 2, fontWeight: bold ? 700 : 400, fontSize: bold ? 14 : 13, color }}>
          {label}
        </TableCell>
        <TableCell align="right" sx={{ fontWeight: bold ? 700 : 400, fontSize: bold ? 14 : 13, color }}>
          {fmt(value)}
        </TableCell>
      </TableRow>
    </>
  );

  return (
    <TableContainer component={Paper} sx={{ maxWidth: 620 }}>
      <Table size="small">
        <TableHead>
          <TableRow sx={{ bgcolor: 'primary.main' }}>
            <TableCell sx={{ color: 'white', fontWeight: 700 }}>Estado de Resultados</TableCell>
            <TableCell align="right" sx={{ color: 'white', fontWeight: 700 }}>Valor</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          <Row label="(+) Venta de mercancías (4135)" value={data.ingresos_operacionales} indent={1} />
          <Row label="(+) Ingresos por servicios (4175)" value={data.ingresos_servicios} indent={1} />
          <Row label="(+) Intereses y rendimientos (4210)" value={data.ingresos_financieros} indent={1} />
          <Row label="TOTAL INGRESOS" value={data.total_ingresos} bold color="success.main" divider />
          <Row label="(-) Costo de ventas (6135)" value={data.costo_ventas} indent={1} />
          <Row label="UTILIDAD BRUTA" value={data.utilidad_bruta} bold color={data.utilidad_bruta >= 0 ? 'success.main' : 'error.main'} divider />
          <Row label="(-) Gastos de personal (5105)" value={0} indent={1} />
          <Row label="(-) Gastos generales (5195)" value={data.gastos_operacionales} indent={1} />
          <Row label="(-) Gastos financieros (5305)" value={data.gastos_no_operacionales} indent={1} />
          <Row label="TOTAL GASTOS" value={data.total_gastos} bold divider />
          <Row
            label="UTILIDAD NETA DEL PERÍODO"
            value={data.utilidad_neta}
            bold
            color={data.utilidad_neta >= 0 ? 'success.main' : 'error.main'}
            divider
          />
        </TableBody>
      </Table>
    </TableContainer>
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
      if (fechaFin) params.fecha_corte = fechaFin.toISOString();
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

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (fechaInicio) params.fecha_inicio = fechaInicio.toISOString();
      if (fechaFin) params.fecha_fin = fechaFin.toISOString();
      const r = await apiClient.get('/contabilidad/balance-comprobacion', { params });
      setRows(r.data);
    } finally { setLoading(false); }
  }, [fechaInicio, fechaFin]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <Box sx={{ py: 4, textAlign: 'center' }}><CircularProgress /></Box>;

  const totD = rows.reduce((s, r) => s + r.total_debitos, 0);
  const totC = rows.reduce((s, r) => s + r.total_creditos, 0);
  const totSD = rows.reduce((s, r) => s + r.saldo_debito, 0);
  const totSC = rows.reduce((s, r) => s + r.saldo_credito, 0);

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
          {rows.length === 0 ? (
            <TableRow><TableCell colSpan={7}><Alert severity="info" sx={{ m: 1 }}>Sin movimientos.</Alert></TableCell></TableRow>
          ) : rows.map(r => (
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
          {rows.length > 0 && (
            <TableRow sx={{ '& td': { fontWeight: 700, borderTop: '2px solid', borderColor: 'divider' } }}>
              <TableCell colSpan={3}>TOTALES</TableCell>
              <TableCell align="right">{fmt(totD)}</TableCell>
              <TableCell align="right">{fmt(totC)}</TableCell>
              <TableCell align="right" sx={{ color: 'success.main' }}>{fmt(totSD)}</TableCell>
              <TableCell align="right" sx={{ color: 'error.main' }}>{fmt(totSC)}</TableCell>
            </TableRow>
          )}
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
      if (fechaInicio) params.fecha_inicio = fechaInicio.toISOString();
      if (fechaFin) params.fecha_fin = fechaFin.toISOString();
      const r = await apiClient.get('/contabilidad/resumen-iva', { params });
      setData(r.data);
    } finally { setLoading(false); }
  }, [fechaInicio, fechaFin]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <Box sx={{ py: 4, textAlign: 'center' }}><CircularProgress /></Box>;
  if (!data) return null;

  const cards = [
    { label: 'IVA Generado (cobrado en ventas)', value: data.iva_generado, cuenta: '2408', color: '#EF4444', icon: '📤' },
    { label: 'IVA Descontable (pagado en compras)', value: data.iva_descontable, cuenta: '1355', color: '#3B82F6', icon: '📥' },
    { label: data.iva_a_pagar > 0 ? 'IVA a PAGAR a la DIAN' : 'IVA a FAVOR', value: data.iva_a_pagar > 0 ? data.iva_a_pagar : data.iva_a_favor, cuenta: '', color: data.iva_a_pagar > 0 ? '#F97316' : '#10B981', icon: data.iva_a_pagar > 0 ? '⚠️' : '✅' },
  ];

  return (
    <Box>
      <Alert severity="info" sx={{ mb: 3 }}>
        Este resumen se basa en los asientos contables del período. El IVA generado proviene de ventas (cuenta 2408)
        y el IVA descontable de compras (cuenta 1355). Úsalo para preparar la declaración bimestral de IVA ante la DIAN.
      </Alert>

      <Grid container spacing={3} sx={{ mb: 4 }}>
        {cards.map((c, i) => (
          <Grid item xs={12} sm={4} key={i}>
            <Card sx={{ border: `2px solid ${c.color}22` }}>
              <CardContent>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  {c.icon} {c.label}
                  {c.cuenta && <span style={{ fontFamily: 'monospace', fontSize: 11, marginLeft: 4, color: '#94a3b8' }}> ({c.cuenta})</span>}
                </Typography>
                <Typography variant="h5" fontWeight={700} sx={{ color: c.color }}>{fmt(c.value)}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Paper sx={{ p: 2 }}>
        <Typography variant="subtitle2" gutterBottom fontWeight={700}>Fórmula declaración IVA</Typography>
        <Typography variant="body2" color="text.secondary">
          IVA a pagar = IVA Generado ({fmt(data.iva_generado)}) − IVA Descontable ({fmt(data.iva_descontable)}) = <strong>{fmt(data.iva_a_pagar > 0 ? data.iva_a_pagar : data.iva_a_favor)}</strong>
          {data.iva_a_favor > 0 ? ' (saldo a favor)' : ' (valor a pagar)'}
        </Typography>
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
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: 'grey.900' }}>
                {['#', 'Descripción', 'Período inicio', 'Período fin', 'Utilidad neta', 'Fecha cierre'].map(h => (
                  <TableCell key={h} sx={{ color: 'white', fontWeight: 700 }}>{h}</TableCell>
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
  const [inicio, setInicio] = useState(startOfYear(new Date()));
  const [fin, setFin] = useState(endOfYear(new Date()));
  const [descripcion, setDescripcion] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [confirm, setConfirm] = useState(false);

  const handleEjecutar = async () => {
    setSaving(true); setError(null);
    try {
      await apiClient.post('/contabilidad/cierres', {
        periodo_inicio: inicio.toISOString(),
        periodo_fin: fin.toISOString(),
        descripcion: descripcion || `Cierre ejercicio ${inicio.getFullYear()}`,
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
            costos y gastos del período <strong>{inicio?.toLocaleDateString('es-CO')} al {fin?.toLocaleDateString('es-CO')}</strong>.
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

  useEffect(() => {
    apiClient.get('/contabilidad/cuentas').then((r) => setCuentas(r.data)).finally(() => setLoading(false));
  }, []);

  if (loading) return <Box sx={{ py: 4, textAlign: 'center' }}><CircularProgress /></Box>;

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
  { label: 'Libro Diario',           icon: <MenuBook fontSize="small" /> },
  { label: 'Estado de Resultados',   icon: <TrendingUp fontSize="small" /> },
  { label: 'Balance General',        icon: <AccountBalance fontSize="small" /> },
  { label: 'Bal. Comprobación',      icon: <Balance fontSize="small" /> },
  { label: 'IVA / Impuestos',        icon: <Receipt fontSize="small" /> },
  { label: 'Cierre Contable',        icon: <LockClock fontSize="small" /> },
  { label: 'Plan de Cuentas (PUC)',  icon: <AutoAwesome fontSize="small" /> },
];

// Botones de exportación por tab
const EXPORT_BTNS = {
  0: 'diario', 1: 'estado-resultados', 2: 'balance-general', 3: 'balance-comprobacion',
};

export default function Contabilidad() {
  const [tab, setTab] = useState(0);
  const [fechaInicio, setFechaInicio] = useState(startOfMonth(new Date()));
  const [fechaFin, setFechaFin] = useState(endOfMonth(new Date()));

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={es}>
      <Box sx={{ p: { xs: 1, md: 3 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3, flexWrap: 'wrap' }}>
          <AutoAwesome sx={{ color: '#6366F1', fontSize: 30 }} />
          <Box sx={{ flex: 1 }}>
            <Typography variant="h5" fontWeight={700}>Contabilidad Automática</Typography>
            <Typography variant="body2" color="text.secondary">
              Asientos en partida doble · PUC colombiano · Reportes DIAN · Balance General · Exportación PDF/Excel
            </Typography>
          </Box>
        </Box>

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
          sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}
          variant="scrollable" scrollButtons="auto">
          {TABS.map((t, i) => (
            <Tab key={i} label={t.label} icon={t.icon} iconPosition="start" />
          ))}
        </Tabs>

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
