import React, { useState, useEffect, useMemo } from 'react';
import { 
  Box, Typography, Paper, CircularProgress, IconButton, Tooltip, Button,
  Divider, Chip, Grid, TextField, InputAdornment, Autocomplete, FormControlLabel, Switch, Badge, Stack, Avatar
} from '@mui/material';
import { 
  WhatsApp, CheckCircle, Search, DirectionsRun, LocationOn, PersonSearch, MoreTime, FilterList,
  AccountBalanceWallet, AssignmentInd, TrendingUp
} from '@mui/icons-material';
import apiClient, { registrarPagoRuta, reprogramarCuotaRuta } from '../api';
import { formatCurrency } from '../utils/formatters';
import { toast } from 'react-toastify';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';

const ACCENT = '#3B82F6';
const GREEN = '#10B981';
const YELLOW = '#F59E0B';

// Parseo seguro de fecha
const getSafeDateString = (fechaStr) => {
  if (!fechaStr) return 'Sin fecha';
  try {
    const base = fechaStr.split('T')[0]; 
    const [year, month, day] = base.split('-');
    return `${day}/${month}/${year}`;
  } catch (error) {
    return 'Inválida';
  }
};

const RutaCobro = () => {
  const [cuotas, setCuotas] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [resumenDias, setResumenDias] = useState([]); 
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroFecha, setFiltroFecha] = useState(new Date().toISOString().split('T')[0]); // Default hoy para eficiencia
  const [currentUser, setCurrentUser] = useState(null);
  
  const [asignacionGlobal, setAsignacionGlobal] = useState({});
  
  // Modales
  const [pagoModal, setPagoModal] = useState({ open: false, cuota: null, monto: '' });
  const [reprogramarModal, setReprogramarModal] = useState({ open: false, cuota: null, nuevaFecha: '' });

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
      toast.error("Error al sincronizar datos de ruta");
    } finally {
      setLoading(false);
    }
  };

  const esAdmin = currentUser?.role?.name === 'Admin';

  // ─── LÓGICA DE FILTRADO CON RESTRICCIÓN DE COBRADOR ───
  const cuotasFiltradas = useMemo(() => {
    return cuotas.filter(c => {
      // Si no es admin, solo ve lo que tiene su ID asignado
      const filtroUsuario = !esAdmin ? c.usuario_asignado_id === currentUser?.id : true;

      const matchSearch = c.cliente_nombre.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          c.cliente_direccion?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const fechaCuota = c.fecha_vencimiento ? c.fecha_vencimiento.split('T')[0] : '';
      const matchFecha = filtroFecha ? fechaCuota === filtroFecha : true; 
      
      return filtroUsuario && matchSearch && matchFecha;
    });
  }, [cuotas, searchTerm, filtroFecha, esAdmin, currentUser]);

  // ─── KPIs PARA MONITOREO DE RUTA ───
  const metricas = useMemo(() => {
    const totalDinero = cuotasFiltradas.reduce((s, c) => s + (c.saldo_pendiente || 0), 0);
    const totalClientes = cuotasFiltradas.length;
    return { totalDinero, totalClientes };
  }, [cuotasFiltradas]);

  const handleToggleGlobal = (cuotaId) => {
    setAsignacionGlobal(prev => ({ ...prev, [cuotaId]: !prev[cuotaId] }));
  };

  const handleOpenMaps = (direccion) => {
    if (!direccion) return toast.info("El cliente no tiene dirección registrada");
    const url = `http://maps.google.com/?q=${encodeURIComponent(direccion)}`;
    window.open(url, '_blank');
  };

const handleAsignar = async (cuota, newValue) => {
  const usuarioId = newValue ? newValue.id : null;
  const idCuotaReal = cuota.cuota_id || cuota.id;
  const isGlobal = !!asignacionGlobal[idCuotaReal];

  // Construimos el objeto EXACTAMENTE como lo pide tu función asignar_cobrador en Python
  const payload = {
    usuario_id: usuarioId,
    // Si es global, enviamos cliente_id. Si no, enviamos null.
    cliente_id: isGlobal ? (cuota.cliente_id || null) : null,
    // Si NO es global, enviamos la lista de IDs. Si es global, enviamos null o lista vacía.
    cuota_ids: !isGlobal ? [idCuotaReal] : null 
  };

  // Validación de seguridad antes de enviar
  if (isGlobal && !cuota.cliente_id) {
    toast.error("Esta cuota no tiene la información del cliente necesaria para asignación global.");
    return;
  }

  try {
    await apiClient.post('/prestamos/asignar-cobrador', payload);
    toast.success(isGlobal ? "Toda la ruta del cliente fue asignada" : "Cobrador asignado a la cuota");
    fetchInicial(); // Refrescar para actualizar KPIs y vista
  } catch (e) {
    const errorMsg = e.response?.data?.detail || "Error en la comunicación con el servidor";
    toast.error(`Error: ${errorMsg}`);
    console.error("Payload enviado:", payload); // Para depuración en consola
  }
};


  const confirmarPago = async () => {
    const { cuota, monto } = pagoModal;
    try {
      const res = await registrarPagoRuta(cuota.cuota_id, { monto_pagado: parseFloat(monto) });
      toast.success(res.data.msg);
      window.open(`https://wa.me/57${cuota.cliente_telefono}?text=${encodeURIComponent(`🧾 *RECIBO* \n💰 Recibido: ${formatCurrency(res.data.monto_total_recibido)}`)}`, '_blank');
      setPagoModal({ open: false, cuota: null, monto: '' });
      fetchInicial(); 
    } catch (error) {
      toast.error('Error en el pago');
    }
  };

  const confirmarReprogramacion = async () => {
    const { cuota, nuevaFecha } = reprogramarModal;
    try {
      await reprogramarCuotaRuta(cuota.cuota_id, { nueva_fecha: new Date(nuevaFecha).toISOString() });
      toast.success('Compromiso actualizado');
      setReprogramarModal({ open: false, cuota: null, nuevaFecha: '' });
      fetchInicial();
    } catch (error) {
      toast.error('Error al reprogramar');
    }
  };

  if (loading) return <Box sx={{ p: 5, textAlign: 'center' }}><CircularProgress /></Box>;

  return (
    <Box sx={{ maxWidth: 1100, margin: '0 auto', p: { xs: 1, sm: 3 }, boxSizing: 'border-box' }}>
      
      {/* KPIs SUPERIORES */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={4}>
          <Paper sx={{ p: 2, borderRadius: 3, display: 'flex', alignItems: 'center', gap: 2, border: '1px solid', borderColor: 'divider' }}>
            <Avatar sx={{ bgcolor: `${ACCENT}15`, color: ACCENT }}><AccountBalanceWallet /></Avatar>
            <Box>
              <Typography variant="caption" color="text.secondary" fontWeight={700}>TOTAL RUTA</Typography>
              <Typography variant="h6" fontWeight={800}>{formatCurrency(metricas.totalDinero)}</Typography>
            </Box>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Paper sx={{ p: 2, borderRadius: 3, display: 'flex', alignItems: 'center', gap: 2, border: '1px solid', borderColor: 'divider' }}>
            <Avatar sx={{ bgcolor: `${GREEN}15`, color: GREEN }}><AssignmentInd /></Avatar>
            <Box>
              <Typography variant="caption" color="text.secondary" fontWeight={700}>CLIENTES</Typography>
              <Typography variant="h6" fontWeight={800}>{metricas.totalClientes} Pendientes</Typography>
            </Box>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Paper sx={{ p: 2, borderRadius: 3, display: 'flex', alignItems: 'center', gap: 2, border: '1px solid', borderColor: 'divider' }}>
            <Avatar sx={{ bgcolor: `${YELLOW}15`, color: YELLOW }}><TrendingUp /></Avatar>
            <Box>
              <Typography variant="caption" color="text.secondary" fontWeight={700}>ESTADO</Typography>
              <Typography variant="h6" fontWeight={800}>{esAdmin ? "Supervisión" : "Operativo"}</Typography>
            </Box>
          </Paper>
        </Grid>
      </Grid>

      {/* HEADER TÍTULO */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800 }}>
            {esAdmin ? "Gestión de Rutas" : "Mi Ruta de Cobro"}
          </Typography>
          <Typography color="text.secondary" sx={{ fontSize: 13 }}>
            {esAdmin ? "Asigna personal y supervisa el recaudo" : "Visualiza tus cobros asignados para hoy"}
          </Typography>
        </Box>
        <Box sx={{ p: 1.5, borderRadius: 3, bgcolor: `${ACCENT}15`, color: ACCENT }}>
          <DirectionsRun fontSize="large" />
        </Box>
      </Box>

      {/* FILTROS DE FECHA */}
      <Paper sx={{ p: 2.5, mb: 3, borderRadius: 4, boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
          <FilterList sx={{ color: 'text.secondary', fontSize: 20 }} />
          <Typography sx={{ fontSize: 13, fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase' }}>
            Calendario de Cobros
          </Typography>
        </Box>
        
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
          <Chip 
            label="Ver Todo" 
            onClick={() => setFiltroFecha('')}
            sx={{ fontWeight: 700, bgcolor: filtroFecha === '' ? ACCENT : 'background.default', color: filtroFecha === '' ? 'white' : 'text.primary' }}
          />
          {resumenDias.map((d) => (
            <Badge key={d.fecha} badgeContent={d.total_cuotas} color="error">
              <Chip 
                label={new Date(d.fecha + 'T00:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })}
                onClick={() => setFiltroFecha(d.fecha)}
                sx={{ fontWeight: 700, bgcolor: filtroFecha === d.fecha ? ACCENT : 'background.default', color: filtroFecha === d.fecha ? 'white' : 'text.primary' }}
              />
            </Badge>
          ))}
        </Box>

        <Grid container spacing={2}>
          <Grid item xs={12}>
            <TextField
              fullWidth
              placeholder="Buscar por cliente o dirección..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: <InputAdornment position="start"><Search /></InputAdornment>,
                sx: { borderRadius: 3, bgcolor: 'action.hover' }
              }}
            />
          </Grid>
        </Grid>
      </Paper>

      {/* LISTADO DE TARJETAS (ESTRUCTURA ORIGINAL PRESERVADA) */}
      <Stack spacing={3}>
        {cuotasFiltradas.length === 0 ? (
          <Paper sx={{ p: 8, textAlign: 'center', borderRadius: 4, bgcolor: 'action.hover', border: '2px dashed', borderColor: 'divider' }}>
            <Typography color="text.secondary">No hay cobros pendientes en esta selección.</Typography>
          </Paper>
        ) : (
          cuotasFiltradas.map(cuota => {
            const cobradorAsignado = usuarios.find(u => u.id === cuota.usuario_asignado_id) || null;
            const idReal = cuota.id || cuota.cuota_id;

            return (
              <Paper key={idReal} sx={{ p: { xs: 2, sm: 3 }, borderRadius: 4, border: '1px solid', borderColor: 'divider', boxShadow: '0 4px 15px rgba(0,0,0,0.03)' }}>
                <Stack spacing={2}>
                  
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 2 }}>
                    <Box sx={{ flex: 1, minWidth: '200px' }}>
                      <Typography sx={{ fontWeight: 800, fontSize: 18, lineHeight: 1.2 }}>{cuota.cliente_nombre}</Typography>
                      <Typography sx={{ fontSize: 13, color: 'text.secondary', mt: 0.5 }}>
                         {cuota.cliente_direccion || 'Sin dirección'}
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                        <Chip label={`Cuota #${cuota.numero_cuota}`} size="small" sx={{ fontWeight: 700 }} />
                        <Chip label={getSafeDateString(cuota.fecha_vencimiento)} size="small" variant="outlined" />
                        {!esAdmin && cuota.usuario_asignado_id && <Chip icon={<AssignmentInd />} label="Asignado a mí" size="small" color="success" variant="outlined" />}
                      </Box>
                    </Box>
                    <Box sx={{ textAlign: { xs: 'left', sm: 'right' } }}>
                      <Typography sx={{ fontSize: 10, fontWeight: 800, color: 'text.secondary' }}>PENDIENTE</Typography>
                      <Typography sx={{ fontWeight: 900, fontSize: 24, color: GREEN }}>{formatCurrency(cuota.saldo_pendiente ?? cuota.monto_cuota)}</Typography>
                    </Box>
                  </Box>

                  {esAdmin && (
                    <Box sx={{ p: 2, bgcolor: 'action.hover', borderRadius: 3 }}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
                        <Typography variant="caption" fontWeight={800}>ASIGNAR COBRADOR</Typography>
                        <FormControlLabel
                          control={<Switch size="small" checked={!!asignacionGlobal[idReal]} onChange={() => handleToggleGlobal(idReal)} />}
                          label={<Typography variant="caption">Todo el préstamo</Typography>}
                        />
                      </Stack>
                      <Autocomplete
                        options={usuarios}
                        getOptionLabel={(option) => option.username.toUpperCase()}
                        value={cobradorAsignado}
                        onChange={(e, newValue) => handleAsignar(cuota, newValue)}
                        renderInput={(params) => <TextField {...params} size="small" placeholder="Seleccionar cobrador..." />}
                      />
                    </Box>
                  )}

                  <Divider sx={{ borderStyle: 'dashed' }} />

                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
                    <Stack direction="row" spacing={1}>
                      <IconButton onClick={() => handleOpenMaps(cuota.cliente_direccion)} sx={{ bgcolor: '#3B82F6', color: 'white', '&:hover': { bgcolor: '#2563EB' } }}><LocationOn fontSize="small" /></IconButton>
                      <IconButton onClick={() => window.open(`https://wa.me/57${cuota.cliente_telefono}`, '_blank')} sx={{ bgcolor: '#22C55E', color: 'white', '&:hover': { bgcolor: '#16A34A' } }}><WhatsApp fontSize="small" /></IconButton>
                      <IconButton onClick={() => setReprogramarModal({ open: true, cuota, nuevaFecha: cuota.fecha_vencimiento ? cuota.fecha_vencimiento.split('T')[0] : '' })} sx={{ bgcolor: YELLOW, color: 'white', '&:hover': { bgcolor: '#D97706' } }}><MoreTime fontSize="small" /></IconButton>
                    </Stack>

                    <Button
                      variant="contained"
                      startIcon={<CheckCircle />}
                      onClick={() => setPagoModal({ open: true, cuota, monto: cuota.saldo_pendiente ?? cuota.monto_cuota })}
                      sx={{ bgcolor: GREEN, fontWeight: 800, borderRadius: 2, '&:hover': { bgcolor: '#059669' } }}
                    >
                      RECAUDAR
                    </Button>
                  </Box>

                </Stack>
              </Paper>
            );
          })
        )}
      </Stack>

      {/* MODALES DE ACCIÓN PRESERVADOS */}
      <Dialog open={pagoModal.open} onClose={() => setPagoModal({ ...pagoModal, open: false })} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 800 }}>Registrar Pago</DialogTitle>
        <DialogContent>
          <Typography variant="body2" mb={2}>Monto para <strong>{pagoModal.cuota?.cliente_nombre}</strong>:</Typography>
          <TextField fullWidth autoFocus type="number" value={pagoModal.monto} onChange={(e) => setPagoModal({ ...pagoModal, monto: e.target.value })} 
            InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPagoModal({ ...pagoModal, open: false })}>Cancelar</Button>
          <Button onClick={confirmarPago} variant="contained" sx={{ bgcolor: GREEN, fontWeight: 800 }}>Confirmar</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={reprogramarModal.open} onClose={() => setReprogramarModal({ ...reprogramarModal, open: false })} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 800 }}>Reprogramar Cobro</DialogTitle>
        <DialogContent>
          <Typography variant="body2" mb={2}>Selecciona la nueva fecha de compromiso.</Typography>
          <TextField fullWidth type="date" InputLabelProps={{ shrink: true }} value={reprogramarModal.nuevaFecha} onChange={(e) => setReprogramarModal({ ...reprogramarModal, nuevaFecha: e.target.value })} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReprogramarModal({ ...reprogramarModal, open: false })}>Cancelar</Button>
          <Button onClick={confirmarReprogramacion} variant="contained" sx={{ bgcolor: YELLOW, fontWeight: 800 }}>Guardar</Button>
        </DialogActions>
      </Dialog>

    </Box>
  );
};

export default RutaCobro;