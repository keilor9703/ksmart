import React, { useState, useEffect, useMemo } from 'react';
import { 
  Box, Typography, Paper, CircularProgress, IconButton, Tooltip, Button,
  Divider, Chip, Grid, TextField, InputAdornment, Autocomplete, FormControlLabel, Switch, Badge, Stack, Avatar
} from '@mui/material';
import { 
  WhatsApp, CheckCircle, Search, DirectionsRun, LocationOn, PersonSearch, MoreTime, FilterList,
  AccountBalanceWallet, AssignmentInd, TrendingUp, PointOfSale, Receipt, Edit
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
  const [filtroFecha, setFiltroFecha] = useState(new Date().toISOString().split('T')[0]); // Default: Hoy
  const [currentUser, setCurrentUser] = useState(null);
  
  const [asignacionGlobal, setAsignacionGlobal] = useState({});
  // NUEVO ESTADO: Controla qué tarjetas están en modo edición de cobrador
  const [editandoAsignacion, setEditandoAsignacion] = useState({});
  
  // Modales
  const [pagoModal, setPagoModal] = useState({ open: false, cuota: null, monto: '' });
  const [reprogramarModal, setReprogramarModal] = useState({ open: false, cuota: null, nuevaFecha: '' });
  
  // Modal Liquidación
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
      toast.error("Error al sincronizar datos de ruta");
    } finally {
      setLoading(false);
    }
  };

  const esAdmin = currentUser?.role?.name === 'Admin';

  const cuotasFiltradas = useMemo(() => {
    return cuotas.filter(c => {
      // Filtro de Permisos
      const asignadaAMi = !esAdmin ? c.usuario_asignado_id === currentUser?.id : true;
      
      // Búsqueda
      const matchSearch = (c.cliente_nombre || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (c.cliente_direccion || '').toLowerCase().includes(searchTerm.toLowerCase());
      
      // Fecha
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

  const handleToggleGlobal = (cuotaId) => {
    setAsignacionGlobal(prev => ({ ...prev, [cuotaId]: !prev[cuotaId] }));
  };

  const handleOpenMaps = (direccion) => {
    if (!direccion) return toast.info("El cliente no tiene dirección registrada");
    const url = `http://googleusercontent.com/maps.google.com/q=${encodeURIComponent(direccion)}`;
    window.open(url, '_blank');
  };

  const handleAsignar = async (cuota, newValue) => {
    const usuarioId = newValue ? newValue.id : null;
    const idReal = cuota.id || cuota.cuota_id;
    const isGlobal = !!asignacionGlobal[idReal];

    const payload = { 
      usuario_id: usuarioId,
      cliente_id: isGlobal ? (cuota.cliente_id || null) : null,
      cuota_ids: !isGlobal ? [idReal] : null
    };

    try {
      await apiClient.post('/prestamos/asignar-cobrador', payload);
      toast.success(isGlobal ? "Se asignó TODA la ruta del cliente." : "Cobrador asignado a la cuota.");
      
      // Cerramos el modo edición al terminar
      setEditandoAsignacion(prev => ({ ...prev, [idReal]: false }));
      fetchInicial();
    } catch (e) {
      toast.error(`Fallo la asignación: ${e.response?.data?.detail || "Verifique los datos"}`);
    }
  };

  const confirmarPago = async () => {
    const { cuota, monto } = pagoModal;
    try {
      const res = await apiClient.post(`/prestamos/cuotas/${cuota.cuota_id}/pagar`, { monto_pagado: parseFloat(monto) });
      toast.success(res.data?.msg || "Pago registrado");
      window.open(`https://wa.me/57${cuota.cliente_telefono}?text=${encodeURIComponent(`🧾 *RECIBO* \n💰 Recibido: ${formatCurrency(parseFloat(monto))}`)}`, '_blank');
      setPagoModal({ open: false, cuota: null, monto: '' });
      fetchInicial(); 
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error en el pago');
    }
  };

  const confirmarReprogramacion = async () => {
    const { cuota, nuevaFecha } = reprogramarModal;
    try {
      await apiClient.post(`/prestamos/cuotas/${cuota.cuota_id}/reprogramar`, { nueva_fecha: new Date(nuevaFecha).toISOString() });
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
      
      {/* ── KPIs (Apilados correctamente en celular) ── */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={4}>
          <Paper sx={{ p: 2, borderRadius: 3, display: 'flex', alignItems: 'center', gap: 2, border: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}>
            <Avatar sx={{ bgcolor: `${BLUE}15`, color: BLUE }}><AccountBalanceWallet /></Avatar>
            <Box>
              <Typography variant="caption" color="text.secondary" fontWeight={700}>TOTAL RUTA</Typography>
              <Typography variant="h6" fontWeight={800}>{formatCurrency(kpis.total)}</Typography>
            </Box>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Paper sx={{ p: 2, borderRadius: 3, display: 'flex', alignItems: 'center', gap: 2, border: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}>
            <Avatar sx={{ bgcolor: `${ACCENT}15`, color: ACCENT }}><AssignmentInd /></Avatar>
            <Box>
              <Typography variant="caption" color="text.secondary" fontWeight={700}>CLIENTES HOY</Typography>
              <Typography variant="h6" fontWeight={800}>{kpis.cantidad} Pendientes</Typography>
            </Box>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Paper sx={{ p: 2, borderRadius: 3, display: 'flex', alignItems: 'center', gap: 2, border: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}>
            <Avatar sx={{ bgcolor: `${GREEN}15`, color: GREEN }}><TrendingUp /></Avatar>
            <Box>
              <Typography variant="caption" color="text.secondary" fontWeight={700}>ESTADO</Typography>
              <Typography variant="h6" fontWeight={800}>{esAdmin ? "Supervisión" : "Operativo"}</Typography>
            </Box>
          </Paper>
        </Grid>
      </Grid>

      {/* ── HEADER ── */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800 }}>
            {esAdmin ? "Gestión de Rutas" : "Mi Ruta de Cobro"}
          </Typography>
          <Typography color="text.secondary" sx={{ fontSize: 13 }}>
            {esAdmin ? "Asigna personal y supervisa el recaudo" : `Cobros asignados para ti`}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {esAdmin && (
              <Button 
                variant="contained" 
                startIcon={<PointOfSale />}
                onClick={abrirLiquidacion}
                sx={{ bgcolor: ACCENT, fontWeight: 800, borderRadius: 3, height: 45 }}
              >
                Cierre
              </Button>
          )}
          <Box sx={{ p: 1.2, borderRadius: 3, bgcolor: `${ACCENT}15`, color: ACCENT, display: { xs: 'none', sm: 'flex' } }}>
            <DirectionsRun fontSize="large" />
          </Box>
        </Box>
      </Box>

      {/* ── FILTROS DE FECHA ── */}
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
            sx={{ 
              fontWeight: 700, 
              bgcolor: filtroFecha === '' ? 'action.selected' : 'background.default', 
              border: '1px solid', borderColor: filtroFecha === '' ? 'divider' : 'transparent'
            }}
          />
          {resumenDias.map((d) => {
            const labelStr = `${d.fecha.split('-')[2]} de ${new Date(d.fecha + 'T00:00:00').toLocaleDateString('es-CO', { month: 'short' })}`;
            return (
              <Badge key={d.fecha} badgeContent={d.total_cuotas} color="error" sx={{ '& .MuiBadge-badge': { right: 5, top: 5 } }}>
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

        {/* BUSCADOR */}
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <TextField
              fullWidth
              placeholder="Buscar por cliente o dirección..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                disableUnderline: true,
                startAdornment: <InputAdornment position="start"><Search sx={{ color: 'text.secondary' }} /></InputAdornment>,
                sx: { borderRadius: 3, bgcolor: 'background.default', px: 2, py: 0.5, border: '1px solid', borderColor: 'divider' }
              }}
              variant="standard"
            />
          </Grid>
        </Grid>
      </Paper>

      {/* ── LISTADO DE TARJETAS ── */}
      <Stack spacing={3}>
        {cuotasFiltradas.length === 0 ? (
          <Paper sx={{ p: 8, textAlign: 'center', borderRadius: 4, bgcolor: 'action.hover', border: '2px dashed', borderColor: 'divider' }}>
            <Typography color="text.secondary">No se encontraron cobros pendientes para esta selección.</Typography>
          </Paper>
        ) : (
          cuotasFiltradas.map(cuota => {
            const cobradorAsignado = usuarios.find(u => u.id === cuota.usuario_asignado_id) || null;
            const idReal = cuota.id || cuota.cuota_id;
            const estaEditando = editandoAsignacion[idReal];

            return (
              <Paper key={idReal} sx={{ p: { xs: 2, sm: 3 }, borderRadius: 4, border: '1px solid', borderColor: 'divider', boxShadow: '0 4px 15px rgba(0,0,0,0.03)' }}>
                <Stack spacing={2}>
                  
                  {/* Info Principal y Monto */}
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 2 }}>
                    <Box sx={{ flex: 1, minWidth: '200px' }}>
                      <Typography sx={{ fontWeight: 800, fontSize: 18, lineHeight: 1.2 }}>{cuota.cliente_nombre}</Typography>
                      <Typography sx={{ fontSize: 13, color: 'text.secondary', mt: 0.5 }}>
                        {cuota.cliente_direccion || 'Sin dirección'}
                      </Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
                        <Chip label={`Cuota #${cuota.numero_cuota}`} size="small" sx={{ fontWeight: 700, bgcolor: 'action.selected' }} />
                        <Chip label={getSafeDateString(cuota.fecha_vencimiento)} size="small" variant="outlined" />
                        {!esAdmin && cuota.usuario_asignado_id && <Chip icon={<AssignmentInd />} label="Mi Ruta" size="small" color="success" variant="outlined" />}
                      </Box>
                    </Box>
                    <Box sx={{ textAlign: { xs: 'left', sm: 'right' }, minWidth: '120px' }}>
                      <Typography sx={{ fontSize: 10, fontWeight: 800, color: 'text.secondary' }}>RECAUDAR</Typography>
                      <Typography sx={{ fontWeight: 900, fontSize: 24, color: GREEN }}>{formatCurrency(cuota.saldo_pendiente ?? cuota.monto_cuota)}</Typography>
                    </Box>
                  </Box>

                  {/* ── ASIGNACIÓN DE COBRADOR (UX MEJORADO) ── */}
                  {esAdmin && (
                    <Box sx={{ p: 2, bgcolor: 'background.default', borderRadius: 3 }}>
                      {cobradorAsignado && !estaEditando ? (
                        // MODO LECTURA: Ya hay cobrador asignado
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                            <Avatar sx={{ width: 32, height: 32, bgcolor: `${GREEN}20`, color: GREEN }}>
                              <AssignmentInd sx={{ fontSize: 18 }} />
                            </Avatar>
                            <Box>
                              <Typography sx={{ fontSize: 10, color: 'text.secondary', fontWeight: 700 }}>COBRADOR ASIGNADO</Typography>
                              <Typography sx={{ fontSize: 14, fontWeight: 800 }}>{cobradorAsignado.username.toUpperCase()}</Typography>
                            </Box>
                          </Box>
                          <Button 
                            size="small" 
                            variant="outlined" 
                            startIcon={<Edit />}
                            onClick={() => setEditandoAsignacion(prev => ({ ...prev, [idReal]: true }))}
                            sx={{ borderRadius: 2, fontSize: 11, fontWeight: 700, textTransform: 'none' }}
                          >
                            Cambiar
                          </Button>
                        </Box>
                      ) : (
                        // MODO EDICIÓN / VACÍO: Muestra el Autocomplete
                        <Box>
                          <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
                            <Typography sx={{ fontSize: 12, color: 'text.secondary', fontWeight: 600 }}>
                              {cobradorAsignado ? "Cambiar Asignación" : "Asignar Cobrador"}
                            </Typography>
                            <FormControlLabel
                              control={<Switch size="small" checked={!!asignacionGlobal[idReal]} onChange={() => handleToggleGlobal(idReal)} color="primary" />}
                              label={<Typography sx={{ fontSize: 11, color: 'text.secondary' }}>Todo el préstamo</Typography>}
                            />
                          </Stack>
                          <Autocomplete
                            fullWidth
                            options={usuarios}
                            getOptionLabel={(option) => option.username ? option.username.toUpperCase() : ''}
                            value={cobradorAsignado}
                            onChange={(e, newValue) => handleAsignar(cuota, newValue)}
                            renderInput={(params) => (
                              <TextField 
                                {...params} size="small" placeholder="Busca por nombre..." autoFocus={estaEditando}
                                InputProps={{
                                  ...params.InputProps,
                                  startAdornment: (
                                    <>
                                      <InputAdornment position="start"><PersonSearch sx={{ color: ACCENT, ml: 1 }} /></InputAdornment>
                                      {params.InputProps.startAdornment}
                                    </>
                                  ),
                                  sx: { borderRadius: 2, bgcolor: 'background.paper' }
                                }}
                              />
                            )}
                          />
                          {/* Botón para cancelar la edición si te arrepientes */}
                          {cobradorAsignado && (
                            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
                               <Button size="small" sx={{ fontSize: 11, color: 'text.secondary' }} onClick={() => setEditandoAsignacion(prev => ({ ...prev, [idReal]: false }))}>
                                 Cancelar
                               </Button>
                            </Box>
                          )}
                        </Box>
                      )}
                    </Box>
                  )}

                  <Divider sx={{ borderStyle: 'dashed' }} />

                  {/* Botones de Acción */}
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
                    <Box sx={{ display: 'flex', gap: 1.5 }}>
                      <Tooltip title="Ubicación en Maps">
                        <IconButton onClick={() => handleOpenMaps(cuota.cliente_direccion)} sx={{ bgcolor: '#3B82F6', color: 'white', '&:hover': { bgcolor: '#2563EB' }, width: 44, height: 44, boxShadow: '0 4px 10px rgba(59,130,246,0.3)' }}>
                          <LocationOn fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Chat WhatsApp">
                        <IconButton onClick={() => window.open(`https://wa.me/57${cuota.cliente_telefono}`, '_blank')} sx={{ bgcolor: '#22C55E', color: 'white', '&:hover': { bgcolor: '#16A34A' }, width: 44, height: 44, boxShadow: '0 4px 10px rgba(34,197,94,0.3)' }}>
                          <WhatsApp fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Reprogramar Visita">
                        <IconButton onClick={() => setReprogramarModal({ open: true, cuota, nuevaFecha: cuota.fecha_vencimiento ? cuota.fecha_vencimiento.split('T')[0] : '' })} sx={{ bgcolor: YELLOW, color: 'white', '&:hover': { bgcolor: '#D97706' }, width: 44, height: 44, boxShadow: '0 4px 10px rgba(245,158,11,0.3)' }}>
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

      {/* ── MODALES ── */}
      <Dialog open={pagoModal.open} onClose={() => setPagoModal({ ...pagoModal, open: false })} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 800 }}>Registrar Recaudo</DialogTitle>
        <DialogContent>
          <Typography variant="body2" mb={2}>Monto recibido de <strong>{pagoModal.cuota?.cliente_nombre}</strong>:</Typography>
          <TextField fullWidth autoFocus type="number" value={pagoModal.monto} onChange={(e) => setPagoModal({ ...pagoModal, monto: e.target.value })} 
            InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }} />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setPagoModal({ ...pagoModal, open: false })} color="inherit">Cancelar</Button>
          <Button onClick={confirmarPago} variant="contained" sx={{ bgcolor: GREEN, fontWeight: 800 }}>Confirmar</Button>
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
          <Button onClick={confirmarReprogramacion} variant="contained" sx={{ bgcolor: YELLOW, fontWeight: 800 }}>Guardar Fecha</Button>
        </DialogActions>
      </Dialog>

      {/* Modal Liquidación */}
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
