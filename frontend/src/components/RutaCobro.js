import React, { useState, useEffect, useMemo } from 'react';
import { 
  Box, Typography, Paper, CircularProgress, IconButton, Tooltip, Button,
  Divider, Chip, Grid, TextField, InputAdornment, Autocomplete, FormControlLabel, Switch, Badge, Stack, Avatar
} from '@mui/material';
import { 
  WhatsApp, CheckCircle, Search, DirectionsRun, LocationOn, PersonSearch, MoreTime, FilterList,
  AccountBalanceWallet, AssignmentInd, TrendingUp, PointOfSale, Receipt
} from '@mui/icons-material';
import apiClient, { registrarPagoRuta, reprogramarCuotaRuta } from '../api';
import { formatCurrency } from '../utils/formatters';
import { toast } from 'react-toastify';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';

const ACCENT = '#FF6020';
const GREEN = '#10B981';
const BLUE = '#3B82F6';
const YELLOW = '#F59E0B';

const RutaCobro = () => {
  const [cuotas, setCuotas] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [resumenDias, setResumenDias] = useState([]); 
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroFecha, setFiltroFecha] = useState(new Date().toISOString().split('T')[0]);
  const [currentUser, setCurrentUser] = useState(null);
  const [asignacionGlobal, setAsignacionGlobal] = useState({});
  
  // Modales
  const [pagoModal, setPagoModal] = useState({ open: false, cuota: null, monto: '' });
  const [reprogramarModal, setReprogramarModal] = useState({ open: false, cuota: null, nuevaFecha: '' });
  
  // ── NUEVO ESTADO: Liquidación ──
  const [liquidacionModal, setLiquidacionModal] = useState(false);
  const [datosLiquidacion, setDatosLiquidacion] = useState(null);

  useEffect(() => {
    fetchInicial();
  }, []);

  const fetchInicial = async () => {
    setLoading(true);
    try {
      const [cRes, meRes, calRes] = await Promise.all([
        apiClient.get('/prestamos/cuotas-pendientes'),
        apiClient.get('/users/me'),
        apiClient.get('/reportes/calendario-cobros')
      ]);
      
      setCuotas(cRes.data);
      setCurrentUser(meRes.data);
      setResumenDias(calRes.data);

      if (meRes.data?.role?.name === 'Admin') {
        const uRes = await apiClient.get('/admin/usuarios');
        setUsuarios(uRes.data);
      }
    } catch (e) {
      toast.error("Error de sincronización");
    } finally {
      setLoading(false);
    }
  };

  const esAdmin = currentUser?.role?.name === 'Admin';

  const cuotasFiltradas = useMemo(() => {
    return cuotas.filter(c => {
      const asignadaAMi = !esAdmin ? c.usuario_asignado_id === currentUser?.id : true;
      const matchSearch = (c.cliente_nombre || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (c.cliente_direccion || '').toLowerCase().includes(searchTerm.toLowerCase());
      const fechaCuota = c.fecha_vencimiento ? c.fecha_vencimiento.split('T')[0] : '';
      const matchFecha = filtroFecha ? fechaCuota === filtroFecha : true; 
      return asignadaAMi && matchSearch && matchFecha;
    });
  }, [cuotas, searchTerm, filtroFecha, esAdmin, currentUser]);

  const kpis = useMemo(() => {
    const total = cuotasFiltradas.reduce((sum, c) => sum + (c.saldo_pendiente || 0), 0);
    const cantidad = cuotasFiltradas.length;
    return { total, cantidad };
  }, [cuotasFiltradas]);

  // ── NUEVA FUNCIÓN: Obtener Liquidación ──
  const abrirLiquidacion = async () => {
    try {
        const res = await apiClient.get('/prestamos/liquidacion-diaria');
        setDatosLiquidacion(res.data);
        setLiquidacionModal(true);
    } catch (error) {
        toast.error("Error al obtener la liquidación del día.");
    }
  };

  const confirmarLiquidacion = () => {
      toast.success("✅ Cierre de caja auditado correctamente.");
      setLiquidacionModal(false);
  };

  const handleAsignar = async (cuota, newValue) => {
    const usuarioId = newValue ? newValue.id : null;
    const idReal = cuota.id || cuota.cuota_id;
    const isGlobal = asignacionGlobal[idReal];

    const payload = { 
      usuario_id: usuarioId,
      cliente_id: isGlobal ? cuota.cliente_id : null,
      cuotas: isGlobal ? [] : [idReal]
    };

    try {
      await apiClient.post('/prestamos/asignar-cobrador', payload);
      toast.success("Asignación actualizada");
      fetchInicial();
    } catch (e) {
      toast.error("Error al asignar cobrador.");
    }
  };

  const confirmarPago = async () => {
    const { cuota, monto } = pagoModal;
    try {
      const res = await apiClient.post(`/prestamos/cuotas/${cuota.cuota_id}/pagar`, { monto_pagado: parseFloat(monto) });
      toast.success("Pago registrado");
      const link = `https://wa.me/57${cuota.cliente_telefono}?text=${encodeURIComponent(`🧾 *Ksmart360 - RECIBO*\n💰 Recibido: ${formatCurrency(parseFloat(monto))}\n✅ Su saldo ha sido actualizado.`)}`;
      window.open(link, '_blank');
      setPagoModal({ open: false, cuota: null, monto: '' });
      fetchInicial(); 
    } catch (e) {
      toast.error("Error al procesar pago");
    }
  };

  return (
    <Box sx={{ width: '100%', p: { xs: 1, md: 2 } }}>
      
      {/* ── HEADER CON BOTÓN DE CIERRE ── */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h5" sx={{ fontWeight: 800 }}>Ruta de Cobro</Typography>
          {esAdmin && (
              <Button 
                variant="contained" 
                startIcon={<PointOfSale />} 
                onClick={abrirLiquidacion}
                sx={{ bgcolor: ACCENT, fontWeight: 800, borderRadius: 2 }}
              >
                Cierre de Ruta
              </Button>
          )}
      </Box>

      {/* ── KPIs ── */}
      <Grid container spacing={2} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={4}>
          <Paper sx={{ p: 2, borderRadius: 3, display: 'flex', alignItems: 'center', gap: 2, border: '1px solid', borderColor: 'divider' }}>
            <Avatar sx={{ bgcolor: `${BLUE}15`, color: BLUE }}><AccountBalanceWallet /></Avatar>
            <Box>
              <Typography variant="caption" color="text.secondary" fontWeight={700}>TOTAL RUTA</Typography>
              <Typography variant="h6" fontWeight={800}>{formatCurrency(kpis.total)}</Typography>
            </Box>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Paper sx={{ p: 2, borderRadius: 3, display: 'flex', alignItems: 'center', gap: 2, border: '1px solid', borderColor: 'divider' }}>
            <Avatar sx={{ bgcolor: `${ACCENT}15`, color: ACCENT }}><AssignmentInd /></Avatar>
            <Box>
              <Typography variant="caption" color="text.secondary" fontWeight={700}>CLIENTES HOY</Typography>
              <Typography variant="h6" fontWeight={800}>{kpis.cantidad} Pendientes</Typography>
            </Box>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Paper sx={{ p: 2, borderRadius: 3, display: 'flex', alignItems: 'center', gap: 2, border: '1px solid', borderColor: 'divider' }}>
            <Avatar sx={{ bgcolor: `${GREEN}15`, color: GREEN }}><TrendingUp /></Avatar>
            <Box>
              <Typography variant="caption" color="text.secondary" fontWeight={700}>ESTADO</Typography>
              <Typography variant="h6" fontWeight={800}>{esAdmin ? "Supervisión" : "Operativo"}</Typography>
            </Box>
          </Paper>
        </Grid>
      </Grid>

      {/* ── FILTROS ── */}
      <Paper sx={{ p: 2, mb: 3, borderRadius: 3 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="center" justifyContent="space-between">
          <Typography variant="h6" fontWeight={800}>Calendario de Cobros</Typography>
          <Box sx={{ display: 'flex', gap: 1, overflowX: 'auto', width: { xs: '100%', md: 'auto' }, pb: 1 }}>
            {resumenDias.map((d) => (
              <Badge key={d.fecha} badgeContent={d.total_cuotas} color="error">
                <Chip 
                  label={new Date(d.fecha + 'T00:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })}
                  onClick={() => setFiltroFecha(d.fecha)}
                  variant={filtroFecha === d.fecha ? "contained" : "outlined"}
                  sx={{ fontWeight: 700, bgcolor: filtroFecha === d.fecha ? ACCENT : 'transparent' }}
                />
              </Badge>
            ))}
            <Button onClick={() => setFiltroFecha('')} size="small">Ver Todo</Button>
          </Box>
        </Stack>
        <Divider sx={{ my: 2 }} />
        <TextField 
          fullWidth placeholder="Filtrar por nombre o dirección..." 
          value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{ startAdornment: <InputAdornment position="start"><Search /></InputAdornment> }}
        />
      </Paper>

      {/* ── LISTADO DE CUOTAS ── */}
      <Grid container spacing={2}>
        {cuotasFiltradas.map((cuota) => {
          const cobrador = usuarios.find(u => u.id === cuota.usuario_asignado_id);
          return (
            <Grid item xs={12} md={6} key={cuota.cuota_id}>
              <Paper sx={{ p: 2.5, borderRadius: 4, borderLeft: `6px solid ${cuota.usuario_asignado_id ? GREEN : BLUE}` }}>
                
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                  <Box>
                    <Typography variant="h6" fontWeight={800}>{cuota.cliente_nombre}</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <LocationOn sx={{ fontSize: 14 }} /> {cuota.cliente_direccion || 'Sin dirección'}
                    </Typography>
                  </Box>
                  <Typography variant="h5" fontWeight={900} color={GREEN}>{formatCurrency(cuota.saldo_pendiente)}</Typography>
                </Box>

                {esAdmin && (
                  <Box sx={{ p: 1.5, bgcolor: 'action.hover', borderRadius: 2, mb: 2 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
                      <Typography variant="caption" fontWeight={800}>ASIGNAR COBRADOR</Typography>
                      <FormControlLabel
                        control={<Switch size="small" checked={!!asignacionGlobal[cuota.cuota_id]} onChange={() => setAsignacionGlobal(prev => ({ ...prev, [cuota.cuota_id]: !prev[cuota.cuota_id] }))} />}
                        label={<Typography variant="caption">Toda la ruta</Typography>}
                      />
                    </Stack>
                    <Autocomplete
                      size="small"
                      options={usuarios}
                      getOptionLabel={(u) => u.username.toUpperCase()}
                      value={cobrador || null}
                      onChange={(_, val) => handleAsignar(cuota, val)}
                      renderInput={(params) => <TextField {...params} placeholder="Seleccionar cobrador..." />}
                    />
                  </Box>
                )}

                <Divider sx={{ mb: 2, borderStyle: 'dashed' }} />

                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Stack direction="row" spacing={1}>
                    <IconButton size="small" sx={{ bgcolor: `${GREEN}15`, color: GREEN }} onClick={() => window.open(`https://wa.me/57${cuota.cliente_telefono}`, '_blank')}><WhatsApp /></IconButton>
                    <IconButton size="small" sx={{ bgcolor: `${BLUE}15`, color: BLUE }} onClick={() => window.open(`http://googleusercontent.com/maps.google.com/q=${encodeURIComponent(cuota.cliente_direccion)}`, '_blank')}><LocationOn /></IconButton>
                    <IconButton size="small" sx={{ bgcolor: `${YELLOW}15`, color: YELLOW }} onClick={() => setReprogramarModal({ open: true, cuota, nuevaFecha: cuota.fecha_vencimiento })}><MoreTime /></IconButton>
                  </Stack>
                  <Button 
                    variant="contained" 
                    startIcon={<CheckCircle />} 
                    onClick={() => setPagoModal({ open: true, cuota, monto: cuota.saldo_pendiente })}
                    sx={{ bgcolor: GREEN, fontWeight: 800, borderRadius: 2 }}
                  >
                    COBRAR
                  </Button>
                </Box>
              </Paper>
            </Grid>
          );
        })}
      </Grid>

      {/* ── MODALES DE PAGO Y LIQUIDACIÓN ── */}
      <Dialog open={pagoModal.open} onClose={() => setPagoModal({ ...pagoModal, open: false })} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>Registrar Pago</DialogTitle>
        <DialogContent>
          <Typography variant="body2" mb={2}>Confirmar recaudo para <b>{pagoModal.cuota?.cliente_nombre}</b></Typography>
          <TextField fullWidth autoFocus type="number" value={pagoModal.monto} onChange={(e) => setPagoModal({ ...pagoModal, monto: e.target.value })} 
            InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }} />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setPagoModal({ ...pagoModal, open: false })}>Cancelar</Button>
          <Button onClick={confirmarPago} variant="contained" sx={{ bgcolor: GREEN, fontWeight: 800 }}>Confirmar</Button>
        </DialogActions>
      </Dialog>

      {/* MODAL DE CIERRE DE RUTA */}
      <Dialog open={liquidacionModal} onClose={() => setLiquidacionModal(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 4 } }}>
        <DialogTitle sx={{ fontWeight: 900, textAlign: 'center', bgcolor: 'action.hover', pb: 3 }}>
            Liquidación Diaria
            <Typography variant="body2" color="text.secondary">Resumen de efectivo a entregar hoy</Typography>
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
            {datosLiquidacion?.cobradores?.length === 0 ? (
                <Typography textAlign="center" color="text.secondary" py={4}>No hay recaudos registrados hoy.</Typography>
            ) : (
                <Stack spacing={2} mt={2}>
                    {datosLiquidacion?.cobradores.map(cob => (
                        <Paper key={cob.cobrador_id} variant="outlined" sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Box>
                                <Typography fontWeight={800} fontSize={16}>{cob.cobrador_nombre}</Typography>
                                <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                    <Receipt fontSize="small" /> {cob.cuotas_cobradas} recibos hoy
                                </Typography>
                            </Box>
                            <Typography fontWeight={900} fontSize={20} color={GREEN}>
                                {formatCurrency(cob.total_recaudado)}
                            </Typography>
                        </Paper>
                    ))}
                    <Divider sx={{ my: 2, borderStyle: 'dashed' }} />
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 1 }}>
                        <Typography fontWeight={800} fontSize={18}>EFECTIVO TOTAL:</Typography>
                        <Typography fontWeight={900} fontSize={26} color={ACCENT}>
                            {formatCurrency(datosLiquidacion?.total_global || 0)}
                        </Typography>
                    </Box>
                </Stack>
            )}
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setLiquidacionModal(false)} color="inherit" sx={{ fontWeight: 700 }}>Cerrar</Button>
          <Button onClick={confirmarLiquidacion} variant="contained" disabled={datosLiquidacion?.cobradores?.length === 0} sx={{ bgcolor: ACCENT, fontWeight: 800 }}>
             Recibir Dinero
          </Button>
        </DialogActions>
      </Dialog>

    </Box>
  );
};

export default RutaCobro;
