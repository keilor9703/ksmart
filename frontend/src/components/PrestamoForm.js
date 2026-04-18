import React, { useState, useEffect, useMemo } from 'react';
import { 
  Box, Typography, Paper, Grid, TextField, Button, MenuItem, 
  Divider, Card, Tabs, Tab, Table, TableBody, TableCell, 
  TableContainer, TableHead, TableRow, Chip, IconButton, 
  Collapse, Autocomplete, InputAdornment, Stack, CircularProgress, useTheme, useMediaQuery
} from '@mui/material';
import { 
  AttachMoney, Calculate, Visibility, KeyboardArrowDown, KeyboardArrowUp, AssignmentInd
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

const Prestamos = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [tab, setTab] = useState(1);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [clientes, setClientes] = useState([]);
  const [prestamosActivos, setPrestamosActivos] = useState([]);
  const [asignacionesRuta, setAsignacionesRuta] = useState([]); // Nueva fuente de verdad
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
      // 1. Cargamos Préstamos, Clientes y también la Ruta de Cobro (que sí trae los cobradores)
      const [resClie, resPres, resRuta] = await Promise.all([
        apiClient.get('/clientes/'),
        apiClient.get('/prestamos/'),
        apiClient.get('/prestamos/cuotas-pendientes')
      ]);

      setClientes(resClie.data);
      setPrestamosActivos(resPres.data);
      setAsignacionesRuta(resRuta.data);
      
    } catch (e) {
      toast.error("Error al sincronizar datos de cartera");
    } finally {
      setLoading(false);
    }
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
    if (!selectedCliente || !simulacion) return toast.warning("Faltan datos");
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
          <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>Supervisión y control de cartera</Typography>
        </Box>
      </Box>

      <Paper sx={{ borderRadius: 3, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} variant={isMobile ? "fullWidth" : "standard"}
          sx={{ px: 2, borderBottom: '1px solid', borderColor: 'divider', '& .MuiTabs-indicator': { backgroundColor: ACCENT }, '& .Mui-selected': { color: `${ACCENT} !important` } }}>
          <Tab label="➕ Nuevo" sx={{ fontWeight: 600 }} />
          <Tab label={`📋 Cartera (${prestamosActivos.length})`} sx={{ fontWeight: 600 }} />
        </Tabs>

        <TabPanel value={tab} index={1}>
          <Box sx={{ p: { xs: 1, md: 3 } }}>
            <TableContainer sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
              <Table size="small">
                <TableHead sx={{ bgcolor: 'action.hover' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>CLIENTE</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>COBRADOR</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>CAPITAL</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>PENDIENTE</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>PROGRESO</TableCell>
                    <TableCell align="right">DETALLE</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {prestamosActivos.map(p => {
                    const nombreCliente = p.cliente?.nombre || clientes.find(c => c.id === p.cliente_id)?.nombre || 'Santiago/Camilo';
                    const totalCuotas = p.numero_cuotas || p.cantidad_cuotas || 0;
                    const cuotasPagadas = p.cuotas?.filter(c => c.estado_pago === 'Pagado').length || 0;
                    const saldoAdeudadoActual = p.cuotas?.reduce((acc, c) => acc + (c.estado_pago !== 'Pagado' ? c.saldo_pendiente : 0), 0) || 0;
                    
                    // ── LÓGICA DE CRUCE DE COBRADOR ──
                    // Buscamos en la lista de asignaciones de la ruta si alguna cuota de este cliente tiene cobrador
                    const asignacionEncontrada = asignacionesRuta.find(a => a.cliente_nombre === nombreCliente && a.usuario_asignado_id);
                    const cobradorNombre = asignacionEncontrada?.usuario_asignado_username || "Sin asignar";

                    return (
                      <React.Fragment key={p.id}>
                        <TableRow hover>
                          <TableCell sx={{ fontWeight: 700 }}>{nombreCliente}</TableCell>
                          <TableCell>
                              {asignacionEncontrada ? (
                                  <Chip 
                                    label={cobradorNombre.toUpperCase()} 
                                    size="small" color="primary" variant="outlined" 
                                    sx={{ fontWeight: 700, fontSize: 10 }} 
                                    icon={<AssignmentInd sx={{ fontSize: '14px !important' }} />}
                                  />
                              ) : (
                                  <Typography variant="caption" sx={{ opacity: 0.3 }}>Sin asignar</Typography>
                              )}
                          </TableCell>
                          <TableCell>{formatCurrency(p.monto_prestado)}</TableCell>
                          <TableCell sx={{ fontWeight: 900, color: ACCENT }}>{formatCurrency(saldoAdeudadoActual)}</TableCell>
                          <TableCell>{cuotasPagadas} / {totalCuotas}</TableCell>
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
                                <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 2, color: ACCENT }}>Historial de Cuotas</Typography>
                                <Grid container spacing={2}>
                                  {p.cuotas?.map(c => (
                                    <Grid item xs={12} sm={4} md={3} key={c.id}>
                                      <Paper variant="outlined" sx={{ p: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: 'background.paper' }}>
                                        <Box>
                                          <Typography variant="caption" sx={{ fontWeight: 700 }}>#{c.numero_cuota}</Typography>
                                          <Typography variant="body2" sx={{ fontWeight: 800 }}>{formatCurrency(c.saldo_pendiente)}</Typography>
                                        </Box>
                                        <Chip label={c.estado_pago} size="small" color={c.estado_pago === 'Pagado' ? 'success' : c.estado_pago === 'Parcial' ? 'warning' : 'default'} sx={{ fontSize: 9 }} />
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
          </Box>
        </TabPanel>

        {/* Tab 0 (Nuevo Préstamo) - Se mantiene igual que tu versión anterior */}
        <TabPanel value={tab} index={0}>
            {/* ... contenido del formulario simulador ... */}
        </TabPanel>
      </Paper>
    </Box>
  );
};

export default Prestamos;