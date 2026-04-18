import React, { useState, useEffect, useMemo } from 'react';
import { 
  Box, Typography, Paper, Grid, TextField, Button, MenuItem, 
  Divider, Card, Tabs, Tab, Table, TableBody, TableCell, 
  TableContainer, TableHead, TableRow, Chip, IconButton, 
  Collapse, Autocomplete, InputAdornment, Stack, CircularProgress, useTheme, useMediaQuery, Tooltip
} from '@mui/material';
import { 
  AttachMoney, Calculate, Visibility, Info, KeyboardArrowDown, KeyboardArrowUp, Person
} from '@mui/icons-material';
import apiClient, { createPrestamo } from '../api';
import { formatCurrency } from '../utils/formatters';
import { toast } from 'react-toastify';

const ACCENT = '#FF6020';

function TabPanel({ children, value, index, ...other }) {
  return (
    <div role="tabpanel" hidden={value !== index} {...other}>
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
}

// ─── Prestamo Card (Mobile - Estilo Ventas) ──────────────────────────────────
const PrestamoCard = ({ prestamo, expanded, onExpand, accent, clientes }) => {
  const totalCuotas = prestamo.numero_cuotas || prestamo.cantidad_cuotas || 0;
  const pagadas = prestamo.cuotas?.filter(c => c.estado_pago === 'Pagado').length || 0;
  const nombreCliente = prestamo.cliente?.nombre || clientes.find(c => c.id === prestamo.cliente_id)?.nombre || 'Santiago/Camilo';
  const saldoPendiente = prestamo.cuotas?.reduce((acc, c) => acc + (c.estado_pago !== 'Pagado' ? c.saldo_pendiente : 0), 0) || 0;

  return (
    <Paper sx={{ p: 2.5, mb: 2, borderRadius: 3, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', bgcolor: 'background.paper' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
        <Box>
          <Typography sx={{ fontWeight: 700, fontSize: 15 }}>{nombreCliente}</Typography>
          <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>#{prestamo.id} · {prestamo.modalidad || prestamo.modalidad_cobro}</Typography>
        </Box>
        <Chip label={prestamo.estado} size="small" color={prestamo.estado === 'Activo' ? 'success' : 'default'} sx={{ fontWeight: 600, fontSize: 11 }} />
      </Box>
      <Divider sx={{ my: 1.5 }} />
      <Grid container spacing={1} sx={{ mb: 1.5 }}>
        {[
          { label: 'Prestado', val: formatCurrency(prestamo.monto_prestado) },
          { label: 'Pendiente', val: formatCurrency(saldoPendiente) },
          { label: 'Progreso', val: `${pagadas}/${totalCuotas}` },
        ].map(({ label, val }) => (
          <Grid item xs={4} key={label}>
            <Box sx={{ textAlign: 'center', p: 1, borderRadius: 2, bgcolor: 'action.hover' }}>
              <Typography sx={{ fontSize: 9, color: 'text.secondary', mb: 0.2 }}>{label}</Typography>
              <Typography sx={{ fontSize: 11, fontWeight: 800 }}>{val}</Typography>
            </Box>
          </Grid>
        ))}
      </Grid>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button size="small" startIcon={expanded ? <KeyboardArrowUp /> : <Visibility />} onClick={onExpand} sx={{ color: accent, fontWeight: 700, textTransform: 'none' }}>
          {expanded ? 'Ocultar' : 'Ver detalle'}
        </Button>
      </Box>
      <Collapse in={expanded} timeout="auto" unmountOnExit>
        <Box sx={{ mt: 2, pt: 2, borderTop: '1px dashed', borderColor: 'divider' }}>
          <Stack spacing={1}>
            {prestamo.cuotas?.map((c) => (
              <Box key={c.id} sx={{ display: 'flex', justifyContent: 'space-between', p: 1, borderRadius: 1.5, bgcolor: 'action.hover' }}>
                <Typography sx={{ fontSize: 11 }}>Cuota #{c.numero_cuota}</Typography>
                <Typography sx={{ fontSize: 11, fontWeight: 700 }}>{formatCurrency(c.saldo_pendiente)}</Typography>
                <Chip label={c.estado_pago} size="small" variant="outlined" sx={{ height: 16, fontSize: 9 }} color={c.estado_pago === 'Pagado' ? 'success' : 'warning'} />
              </Box>
            ))}
          </Stack>
        </Box>
      </Collapse>
    </Paper>
  );
};

// ─── Componente Principal ──────────────────────────────────────────────────────
const Prestamos = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [tab, setTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [clientes, setClientes] = useState([]);
  const [prestamosActivos, setPrestamosActivos] = useState([]);
  const [expandedId, setExpandedId] = useState(null);

  // Estados Formulario
  const [selectedCliente, setSelectedCliente] = useState(null);
  const [monto, setMonto] = useState('');
  const [tasaInteres, setTasaInteres] = useState('');
  const [cuotas, setCuotas] = useState('');
  const [modalidad, setModalidad] = useState('Mensual');

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [resClie, resPres] = await Promise.all([apiClient.get('/clientes/'), apiClient.get('/prestamos/')]);
      setClientes(resClie.data);
      setPrestamosActivos(resPres.data);
    } catch { toast.error("Error de sincronización"); } finally { setLoading(false); }
  };

  const simulacion = useMemo(() => {
    const capital = parseFloat(monto) || 0;
    const interesPct = parseFloat(tasaInteres) || 0;
    const numeroCuotas = parseInt(cuotas) || 0;
    if (capital <= 0 || interesPct <= 0 || numeroCuotas <= 0) return null;
    const gananciaInteres = capital * (interesPct / 100);
    const totalPagar = capital + gananciaInteres;
    return { capital, gananciaInteres, totalPagar, valorCuota: totalPagar / numeroCuotas, numeroCuotas };
  }, [monto, tasaInteres, cuotas]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedCliente || !simulacion) return toast.warning("Datos incompletos");
    setIsSubmitting(true);
    try {
      await createPrestamo({
        cliente_id: selectedCliente.id,
        monto_prestado: simulacion.capital,
        tasa_interes: parseFloat(tasaInteres),
        cantidad_cuotas: simulacion.numeroCuotas,
        modalidad: modalidad
      });
      toast.success("Préstamo generado");
      setMonto(''); setTasaInteres(''); setCuotas(''); setSelectedCliente(null);
      fetchData(); setTab(1);
    } catch { toast.error("Error al crear"); } finally { setIsSubmitting(false); }
  };

  return (
    <Box sx={{ width: '100%' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
        <Box sx={{ width: 40, height: 40, borderRadius: 2, bgcolor: `${ACCENT}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: ACCENT }}>
          <AttachMoney />
        </Box>
        <Box>
          <Typography sx={{ fontWeight: 700, fontSize: 20 }}>Préstamos</Typography>
          <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>Simulación y gestión de cartera</Typography>
        </Box>
      </Box>

      <Paper sx={{ borderRadius: 3, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} variant={isMobile ? "fullWidth" : "standard"}
          sx={{ px: 2, borderBottom: '1px solid', borderColor: 'divider', '& .MuiTabs-indicator': { backgroundColor: ACCENT }, '& .Mui-selected': { color: `${ACCENT} !important` } }}>
          <Tab label="➕ Nuevo Préstamo" sx={{ fontWeight: 600 }} />
          <Tab label={`📋 Cartera (${prestamosActivos.length})`} sx={{ fontWeight: 600 }} />
        </Tabs>

        <TabPanel value={tab} index={0}>
          <Box sx={{ p: { xs: 2, md: 3 } }}>
            <Grid container spacing={4}>
              <Grid item xs={12} md={6}>
                <Stack spacing={3}>
                  <Box>
                    <Typography sx={{ fontWeight: 600, fontSize: 12, mb: 1, color: 'text.secondary', textTransform: 'uppercase' }}>Cliente</Typography>
                    <Autocomplete options={clientes} getOptionLabel={(o) => `${o.nombre} (${o.cedula || 'N/A'})`} value={selectedCliente} onChange={(_, v) => setSelectedCliente(v)}
                      renderInput={(params) => <TextField {...params} label="Seleccionar deudor" required fullWidth />} />
                  </Box>
                  <Box>
                    <Typography sx={{ fontWeight: 600, fontSize: 12, mb: 1, color: 'text.secondary', textTransform: 'uppercase' }}>Condiciones</Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={12} sm={6}><TextField fullWidth required label="Capital" type="number" value={monto} onChange={(e) => setMonto(e.target.value)} InputProps={{ startAdornment: '$' }} /></Grid>
                      <Grid item xs={12} sm={6}><TextField fullWidth required label="Tasa %" type="number" value={tasaInteres} onChange={(e) => setTasaInteres(e.target.value)} /></Grid>
                      <Grid item xs={12} sm={6}><TextField select fullWidth label="Modalidad" value={modalidad} onChange={(e) => setModalidad(e.target.value)}>{['Diario', 'Semanal', 'Quincenal', 'Mensual'].map(m => <MenuItem key={m} value={m}>{m}</MenuItem>)}</TextField></Grid>
                      <Grid item xs={12} sm={6}><TextField fullWidth required label="Nº Cuotas" type="number" value={cuotas} onChange={(e) => setCuotas(e.target.value)} /></Grid>
                    </Grid>
                  </Box>
                </Stack>
              </Grid>

              <Grid item xs={12} md={6}>
                <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                  <Typography sx={{ fontWeight: 700, fontSize: 13, mb: 1.5, color: 'text.secondary', display: 'flex', alignItems: 'center', gap: 1 }}><Info fontSize="small" /> PROYECCIÓN FINANCIERA</Typography>
                  <Paper variant="outlined" sx={{ p: 4, borderRadius: 4, bgcolor: 'action.hover', borderStyle: 'dashed', flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
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
                          <Typography color="text.secondary">Intereses calculados:</Typography>
                          <Typography fontWeight={700} color="success.main">+{formatCurrency(simulacion.gananciaInteres)}</Typography>
                        </Box>
                        <Divider sx={{ borderBottomWidth: 2 }} />
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Typography fontWeight={800} variant="h6">Total a Recaudar:</Typography>
                          <Typography variant="h5" fontWeight={900} color="primary.main">{formatCurrency(simulacion.totalPagar)}</Typography>
                        </Box>
                        <Box sx={{ mt: 2, p: 3, bgcolor: 'background.paper', borderRadius: 3, border: '1px solid', borderColor: 'divider', textAlign: 'center' }}>
                          <Typography variant="body2" color="text.secondary">Valor por Cuota:</Typography>
                          <Typography variant="h4" fontWeight={900} color="success.main">{formatCurrency(simulacion.valorCuota)}</Typography>
                          <Chip label={`${simulacion.numeroCuotas} PAGOS ${modalidad.toUpperCase()}S`} size="small" sx={{ fontWeight: 800, mt: 1 }} />
                        </Box>
                        <Button variant="contained" fullWidth onClick={handleSubmit} disabled={isSubmitting} sx={{ mt: 2, py: 2, borderRadius: 3, fontWeight: 800, bgcolor: ACCENT }}>
                          {isSubmitting ? <CircularProgress size={24} color="inherit" /> : 'Confirmar Préstamo'}
                        </Button>
                      </Stack>
                    ) : (
                      <Box sx={{ textAlign: 'center', opacity: 0.4 }}><Calculate sx={{ fontSize: 80, mb: 1 }} /><Typography>Complete los datos</Typography></Box>
                    )}
                  </Paper>
                </Box>
              </Grid>
            </Grid>
          </Box>
        </TabPanel>

        <TabPanel value={tab} index={1}>
          <Box sx={{ p: { xs: 2, md: 3 } }}>
            {isMobile ? (
              prestamosActivos.map(p => (
                <PrestamoCard key={p.id} prestamo={p} accent={ACCENT} expanded={expandedId === p.id} onExpand={() => setExpandedId(expandedId === p.id ? null : p.id)} clientes={clientes} />
              ))
            ) : (
              <TableContainer sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                <Table size="small">
                  <TableHead sx={{ bgcolor: 'action.hover' }}>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700 }}>CLIENTE</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>CAPITAL PRESTADO</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>SALDO PENDIENTE</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>MODALIDAD</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>PROGRESO PAGOS</TableCell>
                      <TableCell align="right">DETALLE</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {prestamosActivos.map(p => {
                      const nombreCliente = p.cliente?.nombre || clientes.find(c => c.id === p.cliente_id)?.nombre || 'N/A';
                      const totalCuotas = p.numero_cuotas || p.cantidad_cuotas || 0;
                      const cuotasPagadas = p.cuotas?.filter(c => c.estado_pago === 'Pagado').length || 0;
                      const saldoAdeudadoActual = p.cuotas?.reduce((acc, c) => acc + (c.estado_pago !== 'Pagado' ? c.saldo_pendiente : 0), 0) || 0;

                      return (
                        <React.Fragment key={p.id}>
                          <TableRow hover>
                            <TableCell sx={{ fontWeight: 700 }}>{nombreCliente}</TableCell>
                            <TableCell>{formatCurrency(p.monto_prestado)}</TableCell>
                            <TableCell sx={{ fontWeight: 900, color: ACCENT }}>{formatCurrency(saldoAdeudadoActual)}</TableCell>
                            <TableCell>{p.modalidad_cobro || p.modalidad}</TableCell>
                            <TableCell>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Typography variant="body2" sx={{ fontWeight: 700 }}>{cuotasPagadas} / {totalCuotas}</Typography>
                                    <Typography variant="caption" color="text.secondary">({Math.round((cuotasPagadas / totalCuotas) * 100) || 0}%)</Typography>
                                </Box>
                            </TableCell>
                            <TableCell align="right">
                              <IconButton onClick={() => setExpandedId(expandedId === p.id ? null : p.id)} color="primary">
                                {expandedId === p.id ? <KeyboardArrowUp /> : <Visibility />}
                              </IconButton>
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell colSpan={6} sx={{ p: 0 }}>
                              <Collapse in={expandedId === p.id}>
                                <Box sx={{ p: 3, bgcolor: 'action.hover' }}>
                                  <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 2, color: ACCENT }}>Plan de Pagos Actualizado</Typography>
                                  <Grid container spacing={2}>
                                    {p.cuotas?.map(c => (
                                      <Grid item xs={12} sm={4} md={3} key={c.id}>
                                        <Paper variant="outlined" sx={{ p: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                          <Box>
                                            <Typography variant="caption" sx={{ fontWeight: 700 }}>Cuota #{c.numero_cuota}</Typography>
                                            <Typography variant="body2" sx={{ fontWeight: 800 }}>{formatCurrency(c.saldo_pendiente)}</Typography>
                                            <Typography variant="caption" sx={{ fontSize: 9, display: 'block' }} color="text.secondary">Original: {formatCurrency(c.monto_cuota)}</Typography>
                                          </Box>
                                          <Chip label={c.estado_pago} size="small" color={c.estado_pago === 'Pagado' ? 'success' : c.estado_pago === 'Parcial' ? 'warning' : 'default'} />
                                        </Paper>
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
      </Paper>
    </Box>
  );
};

export default Prestamos;