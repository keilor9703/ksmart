import React, { useState, useEffect, useMemo } from 'react';
import {
  Box, Typography, Paper, Grid, TextField, Button, MenuItem,
  Divider, Tabs, Tab, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Chip, IconButton,
  Collapse, Autocomplete, InputAdornment, Stack, CircularProgress,
  useTheme, useMediaQuery, Avatar, Tooltip, LinearProgress,
  Dialog, DialogTitle, DialogContent, DialogActions
} from '@mui/material';
import {
  AttachMoney, Calculate, Visibility, Info,
  KeyboardArrowUp, Person,
  AccountBalance, PriceCheck, Warning,
  Savings, ErrorOutline
} from '@mui/icons-material';
import apiClient, { createPrestamo } from '../api';
import { formatCurrency } from '../utils/formatters';
import { toast } from 'react-toastify';

const ACCENT = '#FF6020';
const GREEN  = '#10B981';
const BLUE   = '#3B82F6';
const RED    = '#EF4444';

// ─── TabPanel ─────────────────────────────────────────────────────────────────
function TabPanel({ children, value, index, ...other }) {
  return (
    <div role="tabpanel" hidden={value !== index} {...other}>
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
}

// ─── Helper: formatea fecha corta dd/mm/yyyy ───────────────────────────────────
const fmtDate = (val) => {
  if (!val) return '—';
  try {
    const base = typeof val === 'string' ? val.split('T')[0] : val.toISOString().split('T')[0];
    const [y, m, d] = base.split('-');
    return `${d}/${m}/${y}`;
  } catch { return '—'; }
};

// ─── Helper: calcula mora en cliente (igual lógica que backend) ────────────────
const calcularMoraCliente = (cuota, tasaMoraMensual = 2) => {
  if (cuota.estado_pago === 'Pagado' || (cuota.saldo_pendiente || 0) <= 0)
    return { mora: 0, dias: 0, total: cuota.saldo_pendiente || 0 };

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const fv = new Date(((cuota.fecha_vencimiento || '').split('T')[0]) + 'T00:00:00');
  if (fv >= hoy) return { mora: 0, dias: 0, total: cuota.saldo_pendiente };

  const dias      = Math.floor((hoy - fv) / 86400000);
  const tasaDiaria = (tasaMoraMensual / 100) / 30;
  const mora       = Math.round(cuota.saldo_pendiente * tasaDiaria * dias);
  return { mora, dias, total: cuota.saldo_pendiente + mora };
};

// ─── CobradorChips ─────────────────────────────────────────────────────────────
const CobradorChips = ({ prestamoId, cobradoresMap }) => {
  const lista = cobradoresMap[prestamoId] || [];
  if (lista.length === 0)
    return <Typography sx={{ fontSize: 11, color: 'text.disabled', fontStyle: 'italic' }}>Sin asignar</Typography>;
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
      {lista.map(u => (
        <Tooltip key={u.id} title={`Cobrador: ${u.username}`} arrow>
          <Chip
            icon={<Person sx={{ fontSize: '13px !important' }} />}
            label={u.username} size="small"
            sx={{ height: 20, fontSize: 10, fontWeight: 700,
              bgcolor: `${ACCENT}15`, color: ACCENT, border: `1px solid ${ACCENT}30`,
              '& .MuiChip-icon': { color: ACCENT } }} />
        </Tooltip>
      ))}
    </Box>
  );
};

// ─── CuotaItem: muestra cuota + mora si está vencida ──────────────────────────
const CuotaItem = ({ cuota, tasaMora }) => {
  const { mora, dias, total } = calcularMoraCliente(cuota, tasaMora);
  const vencida = dias > 0 && cuota.estado_pago !== 'Pagado';

  return (
    <Paper variant="outlined" sx={{
      p: 1.5,
      borderColor: vencida ? `${RED}40` : 'divider',
      bgcolor:     vencida ? `${RED}05` : 'transparent',
    }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Box>
          <Typography variant="caption" sx={{ fontWeight: 700 }}>Cuota #{cuota.numero_cuota}</Typography>
          <Typography variant="body2" sx={{ fontWeight: 800 }}>{formatCurrency(cuota.saldo_pendiente)}</Typography>
          <Typography variant="caption" sx={{ fontSize: 9, display: 'block', color: 'text.secondary' }}>
            Vence: {fmtDate(cuota.fecha_vencimiento)}
          </Typography>
          {vencida && (
            <Box sx={{ mt: 0.5 }}>
              <Chip
                icon={<ErrorOutline sx={{ fontSize: '11px !important' }} />}
                label={`+${formatCurrency(mora)} mora · ${dias}d`}
                size="small"
                sx={{ height: 18, fontSize: 9, fontWeight: 700,
                  bgcolor: `${RED}15`, color: RED, border: `1px solid ${RED}30`,
                  '& .MuiChip-icon': { color: RED } }} />
              <Typography sx={{ fontSize: 9, color: RED, fontWeight: 800, mt: 0.3 }}>
                Total con mora: {formatCurrency(total)}
              </Typography>
            </Box>
          )}
        </Box>
        <Chip
          label={cuota.estado_pago} size="small"
          color={cuota.estado_pago === 'Pagado'  ? 'success'
               : cuota.estado_pago === 'Parcial' ? 'warning'
               : vencida                         ? 'error'
               :                                   'default'} />
      </Box>
    </Paper>
  );
};

// ─── PrestamoCard — vista móvil ────────────────────────────────────────────────
const PrestamoCard = ({ prestamo, expanded, onExpand, accent, clientes, cobradoresMap, onAbonoCapital }) => {
  const totalCuotas    = prestamo.numero_cuotas || prestamo.cantidad_cuotas || 0;
  const pagadas        = prestamo.cuotas?.filter(c => c.estado_pago === 'Pagado').length || 0;
  const nombreCliente  = prestamo.cliente?.nombre
    || clientes.find(c => c.id === prestamo.cliente_id)?.nombre || 'N/A';
  const saldoPendiente = prestamo.cuotas?.reduce(
    (acc, c) => acc + (c.estado_pago !== 'Pagado' ? c.saldo_pendiente : 0), 0
  ) || 0;
  const ultimaCuota = prestamo.cuotas?.slice().sort((a, b) => b.numero_cuota - a.numero_cuota)[0];
  const fechaFin    = ultimaCuota?.fecha_vencimiento || null;
  const tasaMoraP   = prestamo.tasa_mora ?? 2;

  const moraTotal = (prestamo.cuotas || []).reduce((acc, c) => {
    const { mora } = calcularMoraCliente(c, tasaMoraP);
    return acc + mora;
  }, 0);

  return (
    <Paper sx={{ p: 2.5, mb: 2, borderRadius: 3, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', bgcolor: 'background.paper' }}>
      {/* Encabezado */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
        <Box sx={{ flex: 1, minWidth: 0, pr: 1 }}>
          <Typography sx={{ fontWeight: 700, fontSize: 15 }}>{nombreCliente}</Typography>
          <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
            #{prestamo.id} · {prestamo.modalidad || prestamo.modalidad_cobro}
          </Typography>
        </Box>
        <Stack direction="row" spacing={0.5} alignItems="center">
          {moraTotal > 0 && (
            <Chip label="MORA" size="small"
              sx={{ height: 18, fontSize: 9, fontWeight: 800, bgcolor: `${RED}15`, color: RED }} />
          )}
          <Chip
            label={prestamo.estado} size="small"
            color={prestamo.estado === 'Activo' ? 'success' : 'default'}
            sx={{ fontWeight: 600, fontSize: 11 }} />
        </Stack>
      </Box>

      {/* Fechas inicio / vence */}
      <Box sx={{ display: 'flex', gap: 1, mb: 1.5 }}>
        <Box sx={{ flex: 1, p: 1, borderRadius: 2, bgcolor: 'action.hover', textAlign: 'center' }}>
          <Typography sx={{ fontSize: 9, color: 'text.secondary', fontWeight: 700, textTransform: 'uppercase', mb: 0.2 }}>Inicio</Typography>
          <Typography sx={{ fontSize: 11, fontWeight: 800, color: BLUE }}>{fmtDate(prestamo.fecha_inicio)}</Typography>
        </Box>
        <Box sx={{ flex: 1, p: 1, borderRadius: 2, bgcolor: 'action.hover', textAlign: 'center' }}>
          <Typography sx={{ fontSize: 9, color: 'text.secondary', fontWeight: 700, textTransform: 'uppercase', mb: 0.2 }}>Vence</Typography>
          <Typography sx={{ fontSize: 11, fontWeight: 800, color: ACCENT }}>{fmtDate(fechaFin)}</Typography>
        </Box>
      </Box>

      {/* Mora acumulada */}
      {moraTotal > 0 && (
        <Box sx={{ mb: 1.5, p: 1.5, borderRadius: 2, bgcolor: `${RED}08`, border: `1px solid ${RED}20` }}>
          <Typography sx={{ fontSize: 10, color: RED, fontWeight: 700 }}>
            ⚠️ Mora acumulada: {formatCurrency(moraTotal)} · Tasa {tasaMoraP}% mensual
          </Typography>
        </Box>
      )}

      {/* Cobradores */}
      <Box sx={{ mb: 1.5 }}>
        <Typography sx={{ fontSize: 10, color: 'text.disabled', fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase', mb: 0.5 }}>
          Cobrador(es)
        </Typography>
        <CobradorChips prestamoId={prestamo.id} cobradoresMap={cobradoresMap} />
      </Box>

      <Divider sx={{ my: 1.5 }} />

      {/* Métricas */}
      <Grid container spacing={1} sx={{ mb: 1.5 }}>
        {[
          { label: 'Prestado',  val: formatCurrency(prestamo.monto_prestado) },
          { label: 'Pendiente', val: formatCurrency(saldoPendiente) },
          { label: 'Progreso',  val: `${pagadas}/${totalCuotas}` },
        ].map(({ label, val }) => (
          <Grid item xs={4} key={label}>
            <Box sx={{ textAlign: 'center', p: 1, borderRadius: 2, bgcolor: 'action.hover' }}>
              <Typography sx={{ fontSize: 9, color: 'text.secondary', mb: 0.2 }}>{label}</Typography>
              <Typography sx={{ fontSize: 11, fontWeight: 800 }}>{val}</Typography>
            </Box>
          </Grid>
        ))}
      </Grid>

      {/* Acciones */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Button size="small" startIcon={<Savings />}
          onClick={() => onAbonoCapital(prestamo.id)}
          sx={{ color: BLUE, fontWeight: 700, textTransform: 'none', fontSize: 11 }}>
          Abono Capital
        </Button>
        <Button size="small"
          startIcon={expanded ? <KeyboardArrowUp /> : <Visibility />}
          onClick={onExpand}
          sx={{ color: accent, fontWeight: 700, textTransform: 'none' }}>
          {expanded ? 'Ocultar' : 'Ver cuotas'}
        </Button>
      </Box>

      {/* Detalle cuotas con mora */}
      <Collapse in={expanded} timeout="auto" unmountOnExit>
        <Box sx={{ mt: 2, pt: 2, borderTop: '1px dashed', borderColor: 'divider' }}>
          <Stack spacing={1}>
            {prestamo.cuotas?.map(c => (
              <CuotaItem key={c.id} cuota={c} tasaMora={tasaMoraP} />
            ))}
          </Stack>
        </Box>
      </Collapse>
    </Paper>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════
const Prestamos = () => {
  const theme    = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [tab,              setTab]              = useState(0);
  const [loading,          setLoading]          = useState(true);
  const [isSubmitting,     setIsSubmitting]     = useState(false);
  const [clientes,         setClientes]         = useState([]);
  const [usuarios,         setUsuarios]         = useState([]);
  const [prestamosActivos, setPrestamosActivos] = useState([]);
  const [cuotasPendientes, setCuotasPendientes] = useState([]);
  const [expandedId,       setExpandedId]       = useState(null);
  const [reporte,          setReporte]          = useState(null);
  const [loadingReporte,   setLoadingReporte]   = useState(false);

  // ── Formulario nuevo préstamo ──────────────────────────────────────────────
  const [selectedCliente, setSelectedCliente] = useState(null);
  const [monto,           setMonto]           = useState('');
  const [tasaInteres,     setTasaInteres]     = useState('');
  const [tasaMora,        setTasaMora]        = useState('2');
  const [cuotas,          setCuotas]          = useState('');
  const [modalidad,       setModalidad]       = useState('Mensual');

  // ── Modal abono a capital ──────────────────────────────────────────────────
  const [abonoModal,   setAbonoModal]   = useState({ open: false, prestamoId: null });
  const [abonoMonto,   setAbonoMonto]   = useState('');
  const [abonoLoading, setAbonoLoading] = useState(false);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [resClie, resPres, resUsers, resCuotas] = await Promise.all([
        apiClient.get('/clientes/'),
        apiClient.get('/prestamos/'),
        apiClient.get('/admin/usuarios'),
        apiClient.get('/prestamos/cuotas-pendientes'),
      ]);
      setClientes(resClie.data);
      setPrestamosActivos(resPres.data);
      setUsuarios(resUsers.data);
      setCuotasPendientes(resCuotas.data);
    } catch {
      toast.error('Error de sincronización');
    } finally {
      setLoading(false);
    }
  };

  const fetchReporte = async () => {
    if (reporte) return;
    setLoadingReporte(true);
    try {
      const { data } = await apiClient.get('/reportes/financiero-prestamos');
      setReporte(data);
    } catch {
      toast.error('Error al cargar el reporte financiero');
    } finally {
      setLoadingReporte(false);
    }
  };

  const handleTabChange = (_, v) => {
    setTab(v);
    if (v === 2) fetchReporte();
  };

  // ── Abono a capital ────────────────────────────────────────────────────────
  const handleAbonoCapital = async () => {
    const monto_abono = parseFloat(abonoMonto);
    if (!monto_abono || monto_abono <= 0) return toast.warning('Ingresa un monto válido');
    setAbonoLoading(true);
    try {
      const res = await apiClient.post(
        `/prestamos/${abonoModal.prestamoId}/abono-capital`,
        { monto_abono }
      );
      toast.success(res.data.msg);
      const { saldo_anterior, nuevo_saldo, cuotas_restantes, nuevo_valor_cuota } = res.data;
      if (nuevo_saldo > 0) {
        toast.info(
          `Saldo: ${formatCurrency(saldo_anterior)} → ${formatCurrency(nuevo_saldo)} · ` +
          `${cuotas_restantes} cuotas de ${formatCurrency(nuevo_valor_cuota)}`,
          { autoClose: 7000 }
        );
      }
      setAbonoModal({ open: false, prestamoId: null });
      setAbonoMonto('');
      fetchData();
      setReporte(null); // fuerza recarga del reporte al abrir tab 2
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Error al aplicar el abono');
    } finally {
      setAbonoLoading(false);
    }
  };

  // ── cobradoresMap ──────────────────────────────────────────────────────────
  const cobradoresMap = useMemo(() => {
    const map = {};
    for (const cuota of cuotasPendientes) {
      const pid = cuota.prestamo_id;
      const uid = cuota.usuario_asignado_id;
      if (!pid || !uid) continue;
      if (!map[pid]) map[pid] = {};
      if (!map[pid][uid]) {
        const user = usuarios.find(u => u.id === uid);
        if (user) map[pid][uid] = { id: uid, username: user.username };
      }
    }
    const result = {};
    for (const [pid, usersObj] of Object.entries(map))
      result[pid] = Object.values(usersObj);
    return result;
  }, [cuotasPendientes, usuarios]);

  // ── Simulación ─────────────────────────────────────────────────────────────
  const simulacion = useMemo(() => {
    const capital      = parseFloat(monto)      || 0;
    const interesPct   = parseFloat(tasaInteres) || 0;
    const numeroCuotas = parseInt(cuotas)        || 0;
    if (capital <= 0 || interesPct <= 0 || numeroCuotas <= 0) return null;
    const gananciaInteres = capital * (interesPct / 100);
    const totalPagar      = capital + gananciaInteres;
    return { capital, gananciaInteres, totalPagar, valorCuota: totalPagar / numeroCuotas, numeroCuotas };
  }, [monto, tasaInteres, cuotas]);

  // ── Submit nuevo préstamo ──────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedCliente || !simulacion) return toast.warning('Datos incompletos');
    setIsSubmitting(true);
    try {
      await createPrestamo({
        cliente_id:      selectedCliente.id,
        monto_prestado:  simulacion.capital,
        tasa_interes:    parseFloat(tasaInteres),
        cantidad_cuotas: simulacion.numeroCuotas,
        modalidad,
        tasa_mora:       parseFloat(tasaMora) || 2,
      });
      toast.success('Préstamo generado');
      setMonto(''); setTasaInteres(''); setCuotas('');
      setTasaMora('2'); setSelectedCliente(null);
      fetchData();
      setTab(1);
    } catch {
      toast.error('Error al crear');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── RENDER ─────────────────────────────────────────────────────────────────
  return (
    <Box sx={{ width: '100%' }}>

      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
        <Box sx={{ width: 40, height: 40, borderRadius: 2, bgcolor: `${ACCENT}18`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: ACCENT }}>
          <AttachMoney />
        </Box>
        <Box>
          <Typography sx={{ fontWeight: 700, fontSize: 20 }}>Préstamos</Typography>
          <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>Simulación y gestión de cartera</Typography>
        </Box>
      </Box>

      <Paper sx={{ borderRadius: 3, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
        <Tabs value={tab} onChange={handleTabChange}
          variant={isMobile ? 'fullWidth' : 'standard'}
          sx={{ px: 2, borderBottom: '1px solid', borderColor: 'divider',
            '& .MuiTabs-indicator': { backgroundColor: ACCENT },
            '& .Mui-selected': { color: `${ACCENT} !important` } }}>
          <Tab label="➕ Nuevo Préstamo"                          sx={{ fontWeight: 600 }} />
          <Tab label={`📋 Cartera (${prestamosActivos.length})`} sx={{ fontWeight: 600 }} />
          <Tab label="📊 Reporte"                                 sx={{ fontWeight: 600 }} />
        </Tabs>

        {/* ══════════════════════════════════════════════════════
            TAB 0: NUEVO PRÉSTAMO
            ══════════════════════════════════════════════════════ */}
        <TabPanel value={tab} index={0}>
          <Box sx={{ p: { xs: 2, md: 3 } }}>
            <Grid container spacing={4}>

              {/* Formulario */}
              <Grid item xs={12} md={6}>
                <Stack spacing={3}>
                  <Box>
                    <Typography sx={{ fontWeight: 600, fontSize: 12, mb: 1, color: 'text.secondary', textTransform: 'uppercase' }}>
                      Cliente
                    </Typography>
                    <Autocomplete
                      options={clientes}
                      getOptionLabel={o => `${o.nombre} (${o.cedula || 'N/A'})`}
                      value={selectedCliente}
                      onChange={(_, v) => setSelectedCliente(v)}
                      renderInput={params => <TextField {...params} label="Seleccionar deudor" required fullWidth />} />
                  </Box>

                  <Box>
                    <Typography sx={{ fontWeight: 600, fontSize: 12, mb: 1, color: 'text.secondary', textTransform: 'uppercase' }}>
                      Condiciones del Préstamo
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={12} sm={6}>
                        <TextField fullWidth required label="Capital" type="number"
                          value={monto} onChange={e => setMonto(e.target.value)}
                          InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }} />
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <TextField fullWidth required label="Tasa interés %" type="number"
                          value={tasaInteres} onChange={e => setTasaInteres(e.target.value)}
                          InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }} />
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <TextField select fullWidth label="Modalidad"
                          value={modalidad} onChange={e => setModalidad(e.target.value)}>
                          {['Diario', 'Semanal', 'Quincenal', 'Mensual'].map(m => (
                            <MenuItem key={m} value={m}>{m}</MenuItem>
                          ))}
                        </TextField>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <TextField fullWidth required label="Nº Cuotas" type="number"
                          value={cuotas} onChange={e => setCuotas(e.target.value)} />
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <TextField fullWidth label="Mora mensual %" type="number"
                          value={tasaMora} onChange={e => setTasaMora(e.target.value)}
                          helperText="% mensual aplicado si se atrasa"
                          InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }} />
                      </Grid>
                    </Grid>
                  </Box>
                </Stack>
              </Grid>

              {/* Proyección */}
              <Grid item xs={12} md={6}>
                <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                  <Typography sx={{ fontWeight: 700, fontSize: 13, mb: 1.5, color: 'text.secondary',
                    display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Info fontSize="small" /> PROYECCIÓN FINANCIERA
                  </Typography>
                  <Paper variant="outlined" sx={{ p: 4, borderRadius: 4, bgcolor: 'action.hover',
                    borderStyle: 'dashed', flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    {simulacion ? (
                      <Stack spacing={3}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Typography color="text.secondary">Cliente:</Typography>
                          <Typography fontWeight={700} color={ACCENT}>{selectedCliente?.nombre}</Typography>
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Typography color="text.secondary">Capital:</Typography>
                          <Typography fontWeight={700}>{formatCurrency(simulacion.capital)}</Typography>
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Typography color="text.secondary">Intereses:</Typography>
                          <Typography fontWeight={700} color="success.main">+{formatCurrency(simulacion.gananciaInteres)}</Typography>
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Typography color="text.secondary">Mora si se atrasa:</Typography>
                          <Typography fontWeight={700} color={RED}>{tasaMora || 2}% mensual</Typography>
                        </Box>
                        <Divider sx={{ borderBottomWidth: 2 }} />
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Typography fontWeight={800} variant="h6">Total a Recaudar:</Typography>
                          <Typography variant="h5" fontWeight={900} color="primary.main">
                            {formatCurrency(simulacion.totalPagar)}
                          </Typography>
                        </Box>
                        <Box sx={{ p: 3, bgcolor: 'background.paper', borderRadius: 3,
                          border: '1px solid', borderColor: 'divider', textAlign: 'center' }}>
                          <Typography variant="body2" color="text.secondary">Valor por Cuota:</Typography>
                          <Typography variant="h4" fontWeight={900} color="success.main">
                            {formatCurrency(simulacion.valorCuota)}
                          </Typography>
                          <Chip label={`${simulacion.numeroCuotas} PAGOS ${modalidad.toUpperCase()}S`}
                            size="small" sx={{ fontWeight: 800, mt: 1 }} />
                        </Box>
                        <Button variant="contained" fullWidth onClick={handleSubmit} disabled={isSubmitting}
                          sx={{ mt: 2, py: 2, borderRadius: 3, fontWeight: 800, bgcolor: ACCENT }}>
                          {isSubmitting ? <CircularProgress size={24} color="inherit" /> : 'Confirmar Préstamo'}
                        </Button>
                      </Stack>
                    ) : (
                      <Box sx={{ textAlign: 'center', opacity: 0.4 }}>
                        <Calculate sx={{ fontSize: 80, mb: 1 }} />
                        <Typography>Complete los datos</Typography>
                      </Box>
                    )}
                  </Paper>
                </Box>
              </Grid>
            </Grid>
          </Box>
        </TabPanel>

        {/* ══════════════════════════════════════════════════════
            TAB 1: CARTERA
            ══════════════════════════════════════════════════════ */}
        <TabPanel value={tab} index={1}>
          <Box sx={{ p: { xs: 2, md: 3 } }}>
            {loading ? (
              <Box sx={{ textAlign: 'center', py: 6 }}>
                <CircularProgress sx={{ color: ACCENT }} />
              </Box>
            ) : isMobile ? (

              /* ── Vista móvil ── */
              prestamosActivos.map(p => (
                <PrestamoCard
                  key={p.id}
                  prestamo={p}
                  accent={ACCENT}
                  expanded={expandedId === p.id}
                  onExpand={() => setExpandedId(expandedId === p.id ? null : p.id)}
                  clientes={clientes}
                  cobradoresMap={cobradoresMap}
                  onAbonoCapital={id => { setAbonoModal({ open: true, prestamoId: id }); setAbonoMonto(''); }} />
              ))

            ) : (

              /* ── Vista desktop ── */
              <TableContainer sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                <Table size="small">
                  <TableHead sx={{ bgcolor: 'action.hover' }}>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700 }}>CLIENTE</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>CAPITAL</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>SALDO</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>MORA</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>MODALIDAD</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>PROGRESO</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>INICIO / VENCE</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>COBRADOR(ES)</TableCell>
                      <TableCell align="right">ACCIONES</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {prestamosActivos.map(p => {
                      const nombreCliente = p.cliente?.nombre || clientes.find(c => c.id === p.cliente_id)?.nombre || 'N/A';
                      const totalCuotas   = p.numero_cuotas || p.cantidad_cuotas || 0;
                      const cuotasPagadas = p.cuotas?.filter(c => c.estado_pago === 'Pagado').length || 0;
                      const saldoAdeudado = p.cuotas?.reduce((acc, c) => acc + (c.estado_pago !== 'Pagado' ? c.saldo_pendiente : 0), 0) || 0;
                      const pct           = totalCuotas ? Math.round((cuotasPagadas / totalCuotas) * 100) : 0;
                      const ultimaCuota   = p.cuotas?.slice().sort((a, b) => b.numero_cuota - a.numero_cuota)[0];
                      const fechaFin      = ultimaCuota?.fecha_vencimiento || null;
                      const tasaMoraP     = p.tasa_mora ?? 2;

                      const moraTotal = (p.cuotas || []).reduce((acc, c) => {
                        const { mora } = calcularMoraCliente(c, tasaMoraP);
                        return acc + mora;
                      }, 0);

                      return (
                        <React.Fragment key={p.id}>
                          <TableRow hover sx={{ bgcolor: moraTotal > 0 ? `${RED}03` : 'transparent' }}>

                            <TableCell sx={{ fontWeight: 700 }}>{nombreCliente}</TableCell>
                            <TableCell>{formatCurrency(p.monto_prestado)}</TableCell>
                            <TableCell sx={{ fontWeight: 900, color: ACCENT }}>{formatCurrency(saldoAdeudado)}</TableCell>

                            {/* Mora */}
                            <TableCell>
                              {moraTotal > 0 ? (
                                <Box>
                                  <Typography sx={{ fontSize: 11, fontWeight: 800, color: RED }}>
                                    {formatCurrency(moraTotal)}
                                  </Typography>
                                  <Typography sx={{ fontSize: 9, color: 'text.secondary' }}>
                                    {tasaMoraP}% / mes
                                  </Typography>
                                </Box>
                              ) : (
                                <Typography sx={{ fontSize: 11, color: GREEN, fontWeight: 700 }}>Al día ✓</Typography>
                              )}
                            </TableCell>

                            <TableCell>{p.modalidad_cobro || p.modalidad}</TableCell>

                            <TableCell>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Typography variant="body2" sx={{ fontWeight: 700 }}>{cuotasPagadas} / {totalCuotas}</Typography>
                                <Typography variant="caption" color="text.secondary">({pct}%)</Typography>
                              </Box>
                            </TableCell>

                            {/* Fechas */}
                            <TableCell>
                              <Typography sx={{ fontSize: 11, color: BLUE,   fontWeight: 700 }}>📅 {fmtDate(p.fecha_inicio)}</Typography>
                              <Typography sx={{ fontSize: 11, color: ACCENT, fontWeight: 700 }}>🏁 {fmtDate(fechaFin)}</Typography>
                            </TableCell>

                            <TableCell>
                              <CobradorChips prestamoId={p.id} cobradoresMap={cobradoresMap} />
                            </TableCell>

                            <TableCell align="right">
                              <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                                <Tooltip title="Abono a capital" arrow>
                                  <IconButton size="small"
                                    onClick={() => { setAbonoModal({ open: true, prestamoId: p.id }); setAbonoMonto(''); }}
                                    sx={{ color: BLUE, bgcolor: `${BLUE}10`, '&:hover': { bgcolor: `${BLUE}20` } }}>
                                    <Savings fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                                <IconButton size="small" color="primary"
                                  onClick={() => setExpandedId(expandedId === p.id ? null : p.id)}>
                                  {expandedId === p.id ? <KeyboardArrowUp /> : <Visibility />}
                                </IconButton>
                              </Stack>
                            </TableCell>
                          </TableRow>

                          {/* Fila expandida: cuotas con mora */}
                          <TableRow>
                            <TableCell colSpan={9} sx={{ p: 0 }}>
                              <Collapse in={expandedId === p.id}>
                                <Box sx={{ p: 3, bgcolor: 'action.hover' }}>
                                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                    <Typography variant="subtitle2" sx={{ fontWeight: 800, color: ACCENT }}>
                                      Plan de Pagos Actualizado
                                    </Typography>
                                    {moraTotal > 0 && (
                                      <Chip
                                        icon={<ErrorOutline sx={{ fontSize: '14px !important' }} />}
                                        label={`Mora total: ${formatCurrency(moraTotal)}`}
                                        size="small"
                                        sx={{ bgcolor: `${RED}15`, color: RED, fontWeight: 700, fontSize: 11 }} />
                                    )}
                                  </Box>
                                  <Grid container spacing={2}>
                                    {p.cuotas?.map(c => (
                                      <Grid item xs={12} sm={4} md={3} key={c.id}>
                                        <CuotaItem cuota={c} tasaMora={tasaMoraP} />
                                      </Grid>
                                    ))}
                                  </Grid>
                                </Box>
                              </Collapse>
                            </TableCell>
                          </TableRow>
                        </React.Fragment>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Box>
        </TabPanel>

        {/* ══════════════════════════════════════════════════════
            TAB 2: REPORTE FINANCIERO
            ══════════════════════════════════════════════════════ */}
        <TabPanel value={tab} index={2}>
          <Box sx={{ p: { xs: 2, md: 3 } }}>
            {loadingReporte ? (
              <Box sx={{ textAlign: 'center', py: 8 }}>
                <CircularProgress sx={{ color: ACCENT }} />
                <Typography sx={{ mt: 2, color: 'text.secondary' }}>Cargando reporte...</Typography>
              </Box>
            ) : !reporte ? (
              <Box sx={{ textAlign: 'center', py: 8 }}>
                <Typography color="text.secondary">No hay datos disponibles.</Typography>
              </Box>
            ) : (
              <Stack spacing={3}>

                {/* KPI Cards */}
                <Grid container spacing={2}>
                  {[
                    { label: 'Capital Prestado',   value: reporte.resumen.capital_prestado,   icon: <AttachMoney />,   color: BLUE,  bg: '#EFF6FF' },
                    { label: 'Capital Recuperado', value: reporte.resumen.capital_recuperado, icon: <PriceCheck />,    color: GREEN, bg: '#ECFDF5' },
                    { label: 'Capital en Calle',   value: reporte.resumen.capital_pendiente,  icon: <AccountBalance />,color: ACCENT,bg: '#FFF7ED' },
                    { label: 'Total en Mora',      value: reporte.resumen.total_en_mora,      icon: <Warning />,       color: RED,   bg: '#FEF2F2' },
                  ].map(({ label, value, icon, color, bg }) => (
                    <Grid item xs={12} sm={6} md={3} key={label}>
                      <Paper sx={{ p: 2.5, borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
                          <Avatar sx={{ width: 36, height: 36, bgcolor: bg, color }}>{icon}</Avatar>
                          <Typography sx={{ fontSize: 11, fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase' }}>
                            {label}
                          </Typography>
                        </Box>
                        <Typography sx={{ fontSize: 20, fontWeight: 900, color }}>{formatCurrency(value)}</Typography>
                      </Paper>
                    </Grid>
                  ))}
                </Grid>

                {/* Intereses */}
                <Paper sx={{ p: 3, borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
                  <Typography sx={{ fontWeight: 700, mb: 2.5, fontSize: 14 }}>Intereses — Recaudado vs Pendiente</Typography>
                  <Grid container spacing={3}>
                    {[
                      { label: 'Intereses Esperados',  value: reporte.resumen.intereses_esperados,  color: BLUE  },
                      { label: 'Intereses Recaudados', value: reporte.resumen.intereses_recaudados, color: GREEN },
                      { label: 'Intereses Pendientes', value: reporte.resumen.intereses_pendientes, color: ACCENT },
                    ].map(({ label, value, color }) => {
                      const pct = reporte.resumen.intereses_esperados > 0
                        ? Math.round((value / reporte.resumen.intereses_esperados) * 100) : 0;
                      return (
                        <Grid item xs={12} md={4} key={label}>
                          <Box sx={{ mb: 0.5, display: 'flex', justifyContent: 'space-between' }}>
                            <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{label}</Typography>
                            <Typography sx={{ fontSize: 12, fontWeight: 700, color }}>{pct}%</Typography>
                          </Box>
                          <LinearProgress variant="determinate" value={Math.min(pct, 100)}
                            sx={{ height: 8, borderRadius: 4, bgcolor: `${color}20`,
                              '& .MuiLinearProgress-bar': { bgcolor: color, borderRadius: 4 } }} />
                          <Typography sx={{ fontSize: 13, fontWeight: 800, mt: 0.5, color }}>{formatCurrency(value)}</Typography>
                        </Grid>
                      );
                    })}
                  </Grid>
                </Paper>

                {/* Proyección de cobros */}
                {(() => {
                  const datos = (reporte.proyeccion_recaudo_mes || [])
                    .filter(d => d.total > 0)
                    .sort((a, b) => a.day.localeCompare(b.day));

                  if (datos.length === 0) {
                    return (
                      <Paper sx={{ p: 3, borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
                        <Typography sx={{ fontWeight: 700, mb: 1, fontSize: 14 }}>Proyección — Próximos 30 días</Typography>
                        <Box sx={{ textAlign: 'center', py: 4, opacity: 0.4 }}>
                          <Typography color="text.secondary">No hay cobros programados en los próximos 30 días</Typography>
                        </Box>
                      </Paper>
                    );
                  }

                  const BAR_H  = 130;
                  const maxVal = Math.max(...datos.map(d => d.total), 1);

                  return (
                    <Paper sx={{ p: 3, borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                        <Typography sx={{ fontWeight: 700, fontSize: 14 }}>Proyección — Próximos 30 días</Typography>
                        <Chip label={`${datos.length} días con cobros`} size="small"
                          sx={{ bgcolor: `${ACCENT}15`, color: ACCENT, fontWeight: 700, fontSize: 10 }} />
                      </Box>
                      <Box sx={{ overflowX: 'auto', pb: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: '8px',
                          height: BAR_H + 48, minWidth: datos.length * 48 }}>
                          {datos.map((d, i) => {
                            const barPx = Math.max(Math.round((d.total / maxVal) * BAR_H), 6);
                            const label = (() => {
                              try { return new Date(d.day + 'T00:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }); }
                              catch { return d.day; }
                            })();
                            const isMax = d.total === maxVal;
                            return (
                              <Tooltip key={i} title={`${label}: ${formatCurrency(d.total)}`} arrow placement="top">
                                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: '1 0 44px', cursor: 'default' }}>
                                  <Typography sx={{ fontSize: 9, fontWeight: isMax ? 800 : 400,
                                    color: isMax ? ACCENT : 'text.secondary', mb: 0.5, whiteSpace: 'nowrap' }}>
                                    {d.total >= 1000000 ? `$${(d.total/1000000).toFixed(1)}M` : `$${(d.total/1000).toFixed(0)}k`}
                                  </Typography>
                                  <Box sx={{ width: '80%', height: `${barPx}px`,
                                    bgcolor: isMax ? ACCENT : (i % 2 === 0 ? '#FFB38E' : `${ACCENT}60`),
                                    borderRadius: '4px 4px 0 0', transition: 'height 0.4s ease',
                                    '&:hover': { opacity: 0.8 } }} />
                                  <Typography sx={{ fontSize: 9, color: 'text.secondary', mt: 0.5, textAlign: 'center', lineHeight: 1.1 }}>
                                    {label}
                                  </Typography>
                                </Box>
                              </Tooltip>
                            );
                          })}
                        </Box>
                      </Box>
                      <Box sx={{ mt: 2, pt: 1.5, borderTop: '1px dashed', borderColor: 'divider',
                        display: 'flex', justifyContent: 'space-between' }}>
                        <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>Total proyectado</Typography>
                        <Typography sx={{ fontSize: 13, fontWeight: 900, color: GREEN }}>
                          {formatCurrency(datos.reduce((s, d) => s + d.total, 0))}
                        </Typography>
                      </Box>
                    </Paper>
                  );
                })()}

              </Stack>
            )}
          </Box>
        </TabPanel>
      </Paper>

      {/* ════════════════════════════════════════════════════════
          MODAL: Abono a Capital
          ════════════════════════════════════════════════════════ */}
      <Dialog
        open={abonoModal.open}
        onClose={() => !abonoLoading && setAbonoModal({ open: false, prestamoId: null })}
        maxWidth="xs" fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}>
          <Savings sx={{ color: BLUE }} /> Abono a Capital
        </DialogTitle>
        <DialogContent>
          <Box sx={{ p: 2, mb: 2.5, borderRadius: 2, bgcolor: `${BLUE}08`, border: `1px solid ${BLUE}20` }}>
            <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
              El monto ingresado se descuenta del saldo total y las cuotas restantes
              se <strong>recalculan en partes iguales</strong> automáticamente.
              Si el abono cubre el saldo completo, el préstamo queda <strong>liquidado</strong>.
            </Typography>
          </Box>
          <TextField
            fullWidth autoFocus type="number"
            label="Monto del abono a capital"
            value={abonoMonto}
            onChange={e => setAbonoMonto(e.target.value)}
            InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }} />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, gap: 1 }}>
          <Button color="inherit" disabled={abonoLoading}
            onClick={() => setAbonoModal({ open: false, prestamoId: null })}>
            Cancelar
          </Button>
          <Button variant="contained" disabled={abonoLoading || !abonoMonto}
            onClick={handleAbonoCapital}
            sx={{ bgcolor: BLUE, fontWeight: 800, borderRadius: 2, px: 3 }}>
            {abonoLoading
              ? <CircularProgress size={20} color="inherit" />
              : 'Aplicar Abono'}
          </Button>
        </DialogActions>
      </Dialog>

    </Box>
  );
};

export default Prestamos;
