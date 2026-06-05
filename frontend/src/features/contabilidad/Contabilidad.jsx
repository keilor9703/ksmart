import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Tabs, Tab, Paper, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Chip, CircularProgress, Alert,
  TextField, MenuItem, Grid, Card, CardContent, IconButton, Collapse,
  Divider,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { es } from 'date-fns/locale';
import {
  AutoAwesome, ExpandMore, ExpandLess, AccountBalance,
  TrendingUp, Balance, MenuBook,
} from '@mui/icons-material';
import { startOfMonth, endOfMonth } from 'date-fns';
import apiClient from '../../api';

const fmt = (n) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(n ?? 0);

const ORIGEN_LABELS = {
  venta: 'Venta',
  gasto: 'Gasto',
  compra: 'Compra',
  cuota_prestamo: 'Cuota préstamo',
  manual: 'Manual',
};

const ORIGEN_COLORS = {
  venta: 'success',
  gasto: 'error',
  compra: 'warning',
  cuota_prestamo: 'info',
  manual: 'default',
};

// ─── Tab: Libro Diario ───────────────────────────────────────────────────────

function LibroDiario({ fechaInicio, fechaFin }) {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState(null);
  const pageSize = 30;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = { page, page_size: pageSize };
      if (fechaInicio) params.fecha_inicio = fechaInicio.toISOString();
      if (fechaFin) params.fecha_fin = fechaFin.toISOString();
      const r = await apiClient.get('/contabilidad/asientos', { params });
      setItems(r.data.items);
      setTotal(r.data.total);
    } catch {
      setError('No se pudo cargar el libro diario.');
    } finally {
      setLoading(false);
    }
  }, [page, fechaInicio, fechaFin]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <Box sx={{ py: 4, textAlign: 'center' }}><CircularProgress /></Box>;
  if (error) return <Alert severity="error">{error}</Alert>;

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {total} asiento{total !== 1 ? 's' : ''} registrado{total !== 1 ? 's' : ''}
      </Typography>
      {items.length === 0 && (
        <Alert severity="info">
          Sin asientos contables en este período. Las ventas y gastos nuevos generarán asientos automáticamente.
        </Alert>
      )}
      {items.map((a) => (
        <Paper key={a.id} sx={{ mb: 1.5, border: '1px solid', borderColor: 'divider' }}>
          <Box
            sx={{ display: 'flex', alignItems: 'center', p: 1.5, cursor: 'pointer', gap: 1 }}
            onClick={() => setExpandedId(expandedId === a.id ? null : a.id)}
          >
            <Box sx={{ flex: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                <Typography variant="caption" color="text.secondary">#{a.numero}</Typography>
                <Chip
                  label={ORIGEN_LABELS[a.tipo_origen] || a.tipo_origen}
                  color={ORIGEN_COLORS[a.tipo_origen] || 'default'}
                  size="small"
                />
                <Typography variant="body2" sx={{ fontWeight: 500 }}>{a.descripcion}</Typography>
              </Box>
              <Typography variant="caption" color="text.secondary">
                {new Date(a.fecha).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
              </Typography>
            </Box>
            <Box sx={{ textAlign: 'right', mr: 1 }}>
              <Typography variant="body2" color="success.main">{fmt(a.total_debitos)}</Typography>
            </Box>
            <IconButton size="small">
              {expandedId === a.id ? <ExpandLess /> : <ExpandMore />}
            </IconButton>
          </Box>
          <Collapse in={expandedId === a.id}>
            <Divider />
            <Box sx={{ p: 1.5 }}>
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
                        <Typography variant="caption" sx={{ fontFamily: 'monospace', fontWeight: 600 }}>
                          {l.cuenta?.codigo}
                        </Typography>{' '}
                        <Typography variant="caption" color="text.secondary">{l.cuenta?.nombre}</Typography>
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
    </Box>
  );
}

// ─── Tab: Estado de Resultados ───────────────────────────────────────────────

function EstadoResultados({ fechaInicio, fechaFin }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (fechaInicio) params.fecha_inicio = fechaInicio.toISOString();
      if (fechaFin) params.fecha_fin = fechaFin.toISOString();
      const r = await apiClient.get('/contabilidad/estado-resultados', { params });
      setData(r.data);
    } catch {
      setError('No se pudo cargar el estado de resultados.');
    } finally {
      setLoading(false);
    }
  }, [fechaInicio, fechaFin]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <Box sx={{ py: 4, textAlign: 'center' }}><CircularProgress /></Box>;
  if (error) return <Alert severity="error">{error}</Alert>;
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
    <TableContainer component={Paper} sx={{ maxWidth: 600 }}>
      <Table size="small">
        <TableHead>
          <TableRow sx={{ bgcolor: 'primary.main' }}>
            <TableCell sx={{ color: 'white', fontWeight: 700 }}>Estado de Resultados</TableCell>
            <TableCell align="right" sx={{ color: 'white', fontWeight: 700 }}>Valor</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          <Row label="(+) Venta de mercancías" value={data.ingresos_operacionales} indent={1} />
          <Row label="(+) Ingresos por servicios" value={data.ingresos_servicios} indent={1} />
          <Row label="(+) Intereses y rendimientos" value={data.ingresos_financieros} indent={1} />
          <Row label="TOTAL INGRESOS" value={data.total_ingresos} bold color="success.main" divider />
          <Row label="(-) Costo de ventas" value={data.costo_ventas} indent={1} />
          <Row label="UTILIDAD BRUTA" value={data.utilidad_bruta} bold color={data.utilidad_bruta >= 0 ? 'success.main' : 'error.main'} divider />
          <Row label="(-) Gastos operacionales" value={data.gastos_operacionales} indent={1} />
          <Row label="(-) Gastos no operacionales" value={data.gastos_no_operacionales} indent={1} />
          <Row label="TOTAL GASTOS" value={data.total_gastos} bold divider />
          <Row
            label="UTILIDAD NETA"
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

// ─── Tab: Balance de Comprobación ────────────────────────────────────────────

const TIPO_COLORS = {
  activo: '#3B82F6', pasivo: '#EF4444', patrimonio: '#8B5CF6',
  ingreso: '#10B981', costo: '#F59E0B', gasto: '#F97316',
};

function BalanceComprobacion({ fechaInicio, fechaFin }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (fechaInicio) params.fecha_inicio = fechaInicio.toISOString();
      if (fechaFin) params.fecha_fin = fechaFin.toISOString();
      const r = await apiClient.get('/contabilidad/balance-comprobacion', { params });
      setRows(r.data);
    } catch {
      setError('No se pudo cargar el balance de comprobación.');
    } finally {
      setLoading(false);
    }
  }, [fechaInicio, fechaFin]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <Box sx={{ py: 4, textAlign: 'center' }}><CircularProgress /></Box>;
  if (error) return <Alert severity="error">{error}</Alert>;

  const totD = rows.reduce((s, r) => s + r.total_debitos, 0);
  const totC = rows.reduce((s, r) => s + r.total_creditos, 0);
  const totSD = rows.reduce((s, r) => s + r.saldo_debito, 0);
  const totSC = rows.reduce((s, r) => s + r.saldo_credito, 0);

  return (
    <TableContainer component={Paper}>
      <Table size="small">
        <TableHead>
          <TableRow sx={{ bgcolor: 'grey.900' }}>
            <TableCell sx={{ color: 'white', fontWeight: 700 }}>Código</TableCell>
            <TableCell sx={{ color: 'white', fontWeight: 700 }}>Cuenta</TableCell>
            <TableCell sx={{ color: 'white', fontWeight: 700 }}>Tipo</TableCell>
            <TableCell align="right" sx={{ color: 'white', fontWeight: 700 }}>Débitos</TableCell>
            <TableCell align="right" sx={{ color: 'white', fontWeight: 700 }}>Créditos</TableCell>
            <TableCell align="right" sx={{ color: 'white', fontWeight: 700 }}>Saldo Déb.</TableCell>
            <TableCell align="right" sx={{ color: 'white', fontWeight: 700 }}>Saldo Créd.</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7}>
                <Alert severity="info" sx={{ m: 1 }}>Sin movimientos en este período.</Alert>
              </TableCell>
            </TableRow>
          ) : (
            rows.map((r) => (
              <TableRow key={r.codigo} hover>
                <TableCell sx={{ fontFamily: 'monospace', fontWeight: 600 }}>{r.codigo}</TableCell>
                <TableCell sx={{ fontSize: 12 }}>{r.nombre}</TableCell>
                <TableCell>
                  <Chip
                    label={r.tipo}
                    size="small"
                    sx={{ bgcolor: TIPO_COLORS[r.tipo] + '22', color: TIPO_COLORS[r.tipo], fontWeight: 600, fontSize: 11 }}
                  />
                </TableCell>
                <TableCell align="right" sx={{ fontSize: 12 }}>{fmt(r.total_debitos)}</TableCell>
                <TableCell align="right" sx={{ fontSize: 12 }}>{fmt(r.total_creditos)}</TableCell>
                <TableCell align="right" sx={{ fontSize: 12, color: 'success.main' }}>
                  {r.saldo_debito > 0 ? fmt(r.saldo_debito) : ''}
                </TableCell>
                <TableCell align="right" sx={{ fontSize: 12, color: 'error.main' }}>
                  {r.saldo_credito > 0 ? fmt(r.saldo_credito) : ''}
                </TableCell>
              </TableRow>
            ))
          )}
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

// ─── Tab: Plan de Cuentas ────────────────────────────────────────────────────

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
            <TableCell sx={{ color: 'white', fontWeight: 700 }}>Código</TableCell>
            <TableCell sx={{ color: 'white', fontWeight: 700 }}>Nombre</TableCell>
            <TableCell sx={{ color: 'white', fontWeight: 700 }}>Tipo</TableCell>
            <TableCell sx={{ color: 'white', fontWeight: 700 }}>Naturaleza</TableCell>
            <TableCell sx={{ color: 'white', fontWeight: 700 }}>Mov.</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {cuentas.map((c) => (
            <TableRow key={c.id} hover sx={{ opacity: c.permite_movimiento ? 1 : 0.6 }}>
              <TableCell sx={{ fontFamily: 'monospace', fontWeight: 600, pl: 1 + c.nivel * 1.5 }}>
                {c.codigo}
              </TableCell>
              <TableCell sx={{ fontSize: 12, fontWeight: c.nivel <= 2 ? 700 : 400 }}>{c.nombre}</TableCell>
              <TableCell>
                <Chip
                  label={c.tipo}
                  size="small"
                  sx={{ bgcolor: (TIPO_COLORS[c.tipo] || '#888') + '22', color: TIPO_COLORS[c.tipo] || '#888', fontSize: 11 }}
                />
              </TableCell>
              <TableCell sx={{ fontSize: 12 }}>{c.naturaleza}</TableCell>
              <TableCell>{c.permite_movimiento ? '✓' : ''}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

// ─── Componente principal ────────────────────────────────────────────────────

export default function Contabilidad() {
  const [tab, setTab] = useState(0);
  const [fechaInicio, setFechaInicio] = useState(startOfMonth(new Date()));
  const [fechaFin, setFechaFin] = useState(endOfMonth(new Date()));

  const tabs = [
    { label: 'Libro Diario', icon: <MenuBook fontSize="small" /> },
    { label: 'Estado de Resultados', icon: <TrendingUp fontSize="small" /> },
    { label: 'Balance de Comprobación', icon: <Balance fontSize="small" /> },
    { label: 'Plan de Cuentas (PUC)', icon: <AccountBalance fontSize="small" /> },
  ];

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={es}>
      <Box sx={{ p: { xs: 1, md: 3 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
          <AutoAwesome sx={{ color: '#6366F1', fontSize: 28 }} />
          <Box>
            <Typography variant="h5" fontWeight={700}>Contabilidad Automática</Typography>
            <Typography variant="body2" color="text.secondary">
              Los asientos se generan automáticamente con cada venta y gasto registrado.
            </Typography>
          </Box>
        </Box>

        {tab < 3 && (
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={6} md={3}>
              <DatePicker
                label="Desde"
                value={fechaInicio}
                onChange={setFechaInicio}
                slotProps={{ textField: { size: 'small', fullWidth: true } }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <DatePicker
                label="Hasta"
                value={fechaFin}
                onChange={setFechaFin}
                slotProps={{ textField: { size: 'small', fullWidth: true } }}
              />
            </Grid>
          </Grid>
        )}

        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}
          variant="scrollable"
          scrollButtons="auto"
        >
          {tabs.map((t, i) => (
            <Tab key={i} label={t.label} icon={t.icon} iconPosition="start" />
          ))}
        </Tabs>

        {tab === 0 && <LibroDiario fechaInicio={fechaInicio} fechaFin={fechaFin} />}
        {tab === 1 && <EstadoResultados fechaInicio={fechaInicio} fechaFin={fechaFin} />}
        {tab === 2 && <BalanceComprobacion fechaInicio={fechaInicio} fechaFin={fechaFin} />}
        {tab === 3 && <PlanCuentas />}
      </Box>
    </LocalizationProvider>
  );
}
