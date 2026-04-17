import React, { useState, useEffect, useMemo } from 'react';
import { 
  Box, Typography, Paper, CircularProgress, IconButton, Tooltip, Button,
  Divider, Chip, Grid, TextField, InputAdornment, Autocomplete, FormControlLabel, Switch, Badge, Stack
} from '@mui/material';
import { 
  WhatsApp, CheckCircle, Search, DirectionsRun, LocationOn, PersonSearch, MoreTime, FilterList
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
  const [filtroFecha, setFiltroFecha] = useState(''); 
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

  // 🔴 AQUÍ ESTÁ LA SOLUCIÓN: Cambiamos <= por === para que filtre exactamente ese día
  const cuotasFiltradas = useMemo(() => {
    return cuotas.filter(c => {
      const matchSearch = c.cliente_nombre.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          c.cliente_direccion?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const fechaCuota = c.fecha_vencimiento ? c.fecha_vencimiento.split('T')[0] : '';
      
      // Si hay un filtro, debe ser exactamente igual a la fecha de la cuota
      const matchFecha = filtroFecha ? fechaCuota === filtroFecha : true; 
      
      return matchSearch && matchFecha;
    });
  }, [cuotas, searchTerm, filtroFecha]);

  const handleToggleGlobal = (cuotaId) => {
    setAsignacionGlobal(prev => ({ ...prev, [cuotaId]: !prev[cuotaId] }));
  };

  const handleAsignar = async (cuota, newValue) => {
    const usuarioId = newValue ? newValue.id : null;
    const idReal = cuota.id || cuota.cuota_id;
    const isGlobal = asignacionGlobal[idReal];

    if (!idReal && !isGlobal) {
      toast.error("Error: Cuota no identificada");
      return;
    }
    
    const payload = { usuario_id: usuarioId };
    if (isGlobal) payload.cliente_id = cuota.cliente_id;
    else payload.cuota_ids = [idReal];

    try {
      await apiClient.post('/prestamos/asignar-cobrador', payload);
      toast.success(isGlobal ? "Se asignó TODA la ruta del cliente." : "Se actualizó la cuota correctamente.");
      fetchInicial();
    } catch (e) {
      toast.error("Error al asignar cobrador");
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
      toast.error(error.response?.data?.detail || 'Error en el pago');
    }
  };

   const handleOpenMaps = (direccion) => {
    if (!direccion) return toast.info("El cliente no tiene dirección registrada");
    const url = `http://maps.google.com/?q=${encodeURIComponent(direccion)}`;
    window.open(url, '_blank');
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
      
      {/* HEADER */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800 }}>
            {esAdmin ? "Gestión de Rutas" : "Mi Ruta de Cobro"}
          </Typography>
          <Typography color="text.secondary" sx={{ fontSize: 13 }}>
            {esAdmin ? "Asigna personal y supervisa el recaudo" : `Pendientes: ${cuotas.length}`}
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
            Filtros de Ruta
          </Typography>
        </Box>
        
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
          <Chip 
            label="Todas las fechas" 
            onClick={() => setFiltroFecha('')}
            sx={{ 
              fontWeight: 700, 
              bgcolor: filtroFecha === '' ? ACCENT : 'background.default', 
              color: filtroFecha === '' ? 'white' : 'text.primary',
              border: '1px solid', borderColor: filtroFecha === '' ? ACCENT : 'divider'
            }}
          />
          {resumenDias.map((d) => {
            const labelStr = `${d.fecha.split('-')[2]}/${d.fecha.split('-')[1]}`;
            return (
              <Badge key={d.fecha} badgeContent={d.total_cuotas} color="primary" sx={{ '& .MuiBadge-badge': { right: 5, top: 5 } }}>
                <Chip 
                  label={labelStr}
                  onClick={() => setFiltroFecha(d.fecha)}
                  sx={{ 
                    fontWeight: 700, pr: 1,
                    bgcolor: filtroFecha === d.fecha ? ACCENT : 'background.default', 
                    color: filtroFecha === d.fecha ? 'white' : 'text.primary',
                    border: '1px solid', borderColor: filtroFecha === d.fecha ? ACCENT : 'divider'
                  }}
                />
              </Badge>
            );
          })}
        </Box>

        {/* BUSCADORES Y FECHA MANUAL */}
        <Grid container spacing={2}>
          <Grid item xs={12} sm={8}>
            <TextField
              fullWidth
              placeholder="Buscar por cliente o dirección..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                disableUnderline: true,
                startAdornment: <InputAdornment position="start"><Search sx={{ color: 'text.secondary' }} /></InputAdornment>,
                sx: { borderRadius: 3, bgcolor: 'background.default', px: 2, py: 0.5 }
              }}
              variant="standard"
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField 
              fullWidth 
              size="small" 
              type="date" 
              label="Filtrar por fecha" 
              InputLabelProps={{ shrink: true }} 
              value={filtroFecha} 
              onChange={(e) => setFiltroFecha(e.target.value)} 
              variant="standard" 
              InputProps={{ disableUnderline: true, sx: { borderRadius: 3, bgcolor: 'background.default', px: 2, py: 0.5 } }}
            />
          </Grid>
        </Grid>
      </Paper>

      {/* LISTADO DE TARJETAS */}
      <Stack spacing={3}>
        {cuotasFiltradas.length === 0 ? (
          <Paper sx={{ p: 8, textAlign: 'center', borderRadius: 4, bgcolor: 'action.hover', border: '2px dashed', borderColor: 'divider' }}>
            <Typography color="text.secondary">No se encontraron cobros pendientes para esta fecha.</Typography>
          </Paper>
        ) : (
          cuotasFiltradas.map(cuota => {
            const cobradorAsignado = usuarios.find(u => u.id === cuota.usuario_asignado_id) || null;
            const idReal = cuota.id || cuota.cuota_id;

            return (
              <Paper key={idReal} sx={{ p: { xs: 2, sm: 3 }, borderRadius: 4, border: '1px solid', borderColor: 'divider', boxShadow: '0 4px 15px rgba(0,0,0,0.03)' }}>
                <Stack spacing={2}>
                  
                  {/* FILA 1: Info Principal y Monto */}
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 2 }}>
                    <Box sx={{ flex: 1, minWidth: '200px' }}>
                      <Typography sx={{ fontWeight: 800, fontSize: 18, lineHeight: 1.2 }}>{cuota.cliente_nombre}</Typography>
                      <Typography sx={{ fontSize: 13, color: 'text.secondary', mt: 0.5 }}>
                        ID: {cuota.cliente_cedula || 'N/A'} • {cuota.cliente_direccion || 'Sin dirección'}
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                        <Chip label={`Cuota #${cuota.numero_cuota}`} size="small" sx={{ fontWeight: 700, bgcolor: 'action.selected' }} />
                        <Chip label={getSafeDateString(cuota.fecha_vencimiento)} size="small" variant="outlined" />
                      </Box>
                    </Box>
                    <Box sx={{ textAlign: { xs: 'left', sm: 'right' }, minWidth: '120px' }}>
                      <Typography sx={{ fontSize: 10, fontWeight: 800, color: 'text.secondary' }}>RECAUDAR</Typography>
                      <Typography sx={{ fontWeight: 900, fontSize: 24, color: GREEN }}>{formatCurrency(cuota.saldo_pendiente ?? cuota.monto_cuota)}</Typography>
                    </Box>
                  </Box>

                  {/* FILA 2: Asignación (Solo Admin) */}
                  {esAdmin && (
                    <Box sx={{ p: 2, bgcolor: 'background.default', borderRadius: 3 }}>
                      <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 1, fontWeight: 600 }}>Asignar Cobrador</Typography>
                      <Autocomplete
                        fullWidth
                        options={usuarios}
                        getOptionLabel={(option) => option.username ? option.username.toUpperCase() : ''}
                        value={cobradorAsignado}
                        onChange={(e, newValue) => handleAsignar(cuota, newValue)}
                        renderInput={(params) => (
                          <TextField 
                            {...params} 
                            size="small"
                            placeholder="Busca por nombre..."
                            InputProps={{
                              ...params.InputProps,
                              startAdornment: (
                                <>
                                  <InputAdornment position="start">
                                    <PersonSearch sx={{ color: ACCENT, ml: 1 }} />
                                  </InputAdornment>
                                  {params.InputProps.startAdornment}
                                </>
                              ),
                              sx: { borderRadius: 2, bgcolor: 'background.paper' }
                            }}
                          />
                        )}
                      />
                      <FormControlLabel
                        sx={{ mt: 1 }}
                        control={<Switch size="small" checked={!!asignacionGlobal[idReal]} onChange={() => handleToggleGlobal(idReal)} color="primary" />}
                        label={<Typography sx={{ fontSize: 12, color: 'text.secondary' }}>Aplicar a todas las cuotas de este cliente</Typography>}
                      />
                    </Box>
                  )}

                  <Divider sx={{ borderStyle: 'dashed' }} />

                  {/* FILA 3: Botones de Acción */}
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
                    <Box sx={{ display: 'flex', gap: 1.5 }}>
                      <Tooltip title="Ubicación en Maps">
                        <IconButton 
                          onClick={() => handleOpenMaps(cuota.cliente_direccion)}
                          sx={{ bgcolor: '#3B82F6', color: 'white', '&:hover': { bgcolor: '#2563EB' }, width: 44, height: 44, boxShadow: '0 4px 10px rgba(59,130,246,0.3)' }}
                        >
                          <LocationOn fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Chat WhatsApp">
                        <IconButton 
                          onClick={() => window.open(`https://wa.me/57${cuota.cliente_telefono}`, '_blank')}
                          sx={{ bgcolor: '#22C55E', color: 'white', '&:hover': { bgcolor: '#16A34A' }, width: 44, height: 44, boxShadow: '0 4px 10px rgba(34,197,94,0.3)' }}
                        >
                          <WhatsApp fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Reprogramar Visita">
                        <IconButton 
                          onClick={() => setReprogramarModal({ open: true, cuota, nuevaFecha: cuota.fecha_vencimiento ? cuota.fecha_vencimiento.split('T')[0] : '' })}
                          sx={{ bgcolor: YELLOW, color: 'white', '&:hover': { bgcolor: '#D97706' }, width: 44, height: 44, boxShadow: '0 4px 10px rgba(245,158,11,0.3)' }}
                        >
                          <MoreTime fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>

                    <Button
                      variant="contained"
                      startIcon={<CheckCircle />}
                      onClick={() => setPagoModal({ open: true, cuota, monto: cuota.saldo_pendiente ?? cuota.monto_cuota })}
                      sx={{ bgcolor: GREEN, px: 3, py: 1, borderRadius: 3, fontWeight: 800, boxShadow: '0 4px 12px rgba(16,185,129,0.3)', '&:hover': { bgcolor: '#059669' } }}
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

      {/* MODALES DE ACCIÓN */}
      <Dialog open={pagoModal.open} onClose={() => setPagoModal({ ...pagoModal, open: false })} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 800 }}>Registrar Recaudo</DialogTitle>
        <DialogContent>
          <Typography variant="body2" mb={2}>Monto recibido del cliente <strong>{pagoModal.cuota?.cliente_nombre}</strong>:</Typography>
          <TextField fullWidth autoFocus type="number" value={pagoModal.monto} onChange={(e) => setPagoModal({ ...pagoModal, monto: e.target.value })} 
            InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setPagoModal({ ...pagoModal, open: false })} color="inherit">Cancelar</Button>
          <Button onClick={confirmarPago} variant="contained" sx={{ bgcolor: GREEN, fontWeight: 800, textTransform: 'none' }}>Confirmar</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={reprogramarModal.open} onClose={() => setReprogramarModal({ ...reprogramarModal, open: false })} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 800 }}>Reprogramar Cobro</DialogTitle>
        <DialogContent>
          <Typography variant="body2" mb={2}>Selecciona la nueva fecha de compromiso para este cliente.</Typography>
          <TextField fullWidth type="date" InputLabelProps={{ shrink: true }} value={reprogramarModal.nuevaFecha} onChange={(e) => setReprogramarModal({ ...reprogramarModal, nuevaFecha: e.target.value })} />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setReprogramarModal({ ...reprogramarModal, open: false })} color="inherit">Cancelar</Button>
          <Button onClick={confirmarReprogramacion} variant="contained" sx={{ bgcolor: YELLOW, fontWeight: 800, textTransform: 'none' }}>Guardar Fecha</Button>
        </DialogActions>
      </Dialog>

    </Box>
  );
};

export default RutaCobro;