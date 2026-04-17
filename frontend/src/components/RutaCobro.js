import React, { useState, useEffect } from 'react';
import { 
  Box, Typography, Paper, CircularProgress, IconButton, Tooltip, Button,
  Divider, Chip, Grid, TextField, Dialog, DialogTitle, DialogContent, DialogActions,
  InputAdornment, Badge
} from '@mui/material';
import { 
  WhatsApp, CheckCircle, Search, LocationOn, CalendarToday,
  MoreTime, ReceiptLong, FormatListBulleted, Warning
} from '@mui/icons-material';
import apiClient, { registrarPagoRuta, reprogramarCuotaRuta } from '../api';
import { formatCurrency } from '../utils/formatters';
import { toast } from 'react-toastify';

const ACCENT = '#3B82F6';
const GREEN = '#10B981';
const YELLOW = '#F59E0B';
const RED = '#EF4444';
const BLUE = '#0b5fe7';

const RutaCobro = () => {
  const [cuotas, setCuotas] = useState([]);
  const [resumenDias, setResumenDias] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroFecha, setFiltroFecha] = useState(''); 

  const [pagoModal, setPagoModal] = useState({ open: false, cuota: null, monto: '' });
  const [reprogramarModal, setReprogramarModal] = useState({ open: false, cuota: null, nuevaFecha: '' });

  useEffect(() => {
    fetchInicial();
  }, []);

  const fetchInicial = async () => {
    setLoading(true);
    try {
      const [resCuotas, resCal] = await Promise.all([
        apiClient.get('/prestamos/cuotas-pendientes'),
        apiClient.get('/reportes/calendario-cobros')
      ]);
      setCuotas(resCuotas.data);
      setResumenDias(resCal.data);
    } catch (error) {
      toast.error('Error al cargar la ruta');
    } finally {
      setLoading(false);
    }
  };

  // ─── LÓGICA DE PAGOS ───
  const openPagoModal = (cuota) => {
    setPagoModal({ open: true, cuota, monto: cuota.saldo_pendiente });
  };

  const confirmarPago = async () => {
    const { cuota, monto } = pagoModal;
    try {
      const res = await registrarPagoRuta(cuota.cuota_id, { monto_pagado: parseFloat(monto) });
      toast.success(res.data.msg);
      enviarReciboWhatsApp(cuota, res.data.monto_total_recibido, res.data.cuotas_afectadas);
      setPagoModal({ open: false, cuota: null, monto: '' });
      fetchInicial(); 
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error en el pago');
    }
  };

  const enviarReciboWhatsApp = (cuota, montoPagado, cuotasAfectadas) => {
    const mensaje = `🧾 *RECIBO DE PAGO - Ksmart360*\n\nHola *${cuota.cliente_nombre}*.\n💰 *Recibido:* ${formatCurrency(montoPagado)}\n🔢 *Cuotas liquidadas/abonadas:* ${cuotasAfectadas}\n\n¡Gracias por tu pago!`;
    window.open(`https://wa.me/57${cuota.cliente_telefono}?text=${encodeURIComponent(mensaje)}`, '_blank');
  };

  // ─── LÓGICA DE REPROGRAMACIÓN ───
  const openReprogramarModal = (cuota) => {
    const fechaActual = new Date(cuota.fecha_vencimiento).toISOString().split('T')[0];
    setReprogramarModal({ open: true, cuota, nuevaFecha: fechaActual });
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

  const filtradas = cuotas.filter(c => {
    const matchSearch = c.cliente_nombre.toLowerCase().includes(searchTerm.toLowerCase());
    const fechaCuota = new Date(c.fecha_vencimiento).toISOString().split('T')[0];
    const matchFecha = filtroFecha ? fechaCuota <= filtroFecha : true;
    return matchSearch && matchFecha;
  });

  return (
    <Box sx={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
      
      {/* ─── HEADER Y CALENDARIO ─── */}
      <Paper sx={{ p: 2, mb: 3, borderRadius: 3, boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
        <Typography variant="h6" fontWeight={800} mb={2}>Ruta de Cobro Inteligente</Typography>
        
        {/* Barra de Calendario Horizontal */}
        <Box sx={{ display: 'flex', gap: 1.5, overflowX: 'auto', pb: 2, mb: 2 }}>
          <Button 
            variant={filtroFecha === '' ? 'contained' : 'outlined'} 
            onClick={() => setFiltroFecha('')} 
            sx={{ minWidth: 100, borderRadius: 2 }}
            startIcon={<FormatListBulleted />}
          >
            Todo
          </Button>
          {resumenDias.map((d, i) => (
            <Paper 
              key={i} 
              onClick={() => setFiltroFecha(d.fecha)}
              sx={{ 
                p: 1.5, minWidth: 70, textAlign: 'center', cursor: 'pointer', borderRadius: 2,
                border: '1px solid',
                borderColor: filtroFecha === d.fecha ? ACCENT : 'divider',
                bgcolor: filtroFecha === d.fecha ? `${ACCENT}10` : 'background.paper',
                transition: '0.2s'
              }}
            >
              <Typography variant="caption" fontWeight={800} color="text.secondary">
                {new Date(d.fecha).toLocaleDateString('es-CO', { month: 'short' }).toUpperCase()}
              </Typography>
              <Typography variant="h6" fontWeight={900}>{new Date(d.fecha).getDate() + 1}</Typography>
              <Badge badgeContent={d.total_cuotas} color="primary" />
            </Paper>
          ))}
        </Box>

        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <TextField fullWidth size="small" placeholder="Buscar cliente..." 
              value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{ startAdornment: <InputAdornment position="start"><Search /></InputAdornment> }}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField fullWidth size="small" type="date" label="Filtrar hasta..." 
              InputLabelProps={{ shrink: true }} value={filtroFecha} onChange={(e) => setFiltroFecha(e.target.value)} 
            />
          </Grid>
        </Grid>
      </Paper>

      {/* ─── LISTA DE CLIENTES ─── */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}><CircularProgress /></Box>
      ) : filtradas.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <CheckCircle sx={{ fontSize: 60, color: GREEN, mb: 2 }} />
          <Typography variant="h6" fontWeight={700}>¡Todo Limpio!</Typography>
        </Box>
      ) : (
        <Grid container spacing={2}>
          {filtradas.map(cuota => {
            const isMora = new Date(cuota.fecha_vencimiento) < new Date() && new Date(cuota.fecha_vencimiento).toISOString().split('T')[0] !== new Date().toISOString().split('T')[0];
            return (
              <Grid item xs={12} md={6} key={cuota.cuota_id}>
                <Paper sx={{ p: 2, borderRadius: 3, borderLeft: `6px solid ${isMora ? RED : ACCENT}` }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                    <Box>
                      <Typography fontWeight={800} fontSize={16}>{cuota.cliente_nombre}</Typography>
                      <Typography fontSize={11} color="text.secondary">{cuota.cliente_direccion}</Typography>
                    </Box>
                    <Typography fontWeight={900} color={GREEN} fontSize={18}>{formatCurrency(cuota.saldo_pendiente)}</Typography>
                  </Box>

                  <Divider sx={{ my: 1.5 }} />

                  <Grid container spacing={1} sx={{ mb: 2 }}>
                    <Grid item xs={4}>
                      <Typography fontSize={10} color="text.secondary">CUOTA</Typography>
                      <Typography fontWeight={700}>#{cuota.numero_cuota}</Typography>
                    </Grid>
                    <Grid item xs={8} sx={{ textAlign: 'right' }}>
                      <Typography fontSize={10} color="text.secondary">VENCIMIENTO</Typography>
                      <Typography fontWeight={700} color={isMora ? RED : 'text.primary'}>
                        {new Date(cuota.fecha_vencimiento).toLocaleDateString('es-CO', { day: '2-digit', month: 'long' })}
                      </Typography>
                    </Grid>
                  </Grid>

                  {/* ✅ BOTONES RECUPERADOS: Mapa, WhatsApp, Reprogramar y Cobrar */}
                  <Box sx={{ display: 'flex', gap: 1, justifyContent: 'space-between' }}>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Tooltip title="Ver en Mapa">
                        <IconButton size="small" sx={{ bgcolor: '#EFF6FF', color: BLUE }} onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(cuota.cliente_direccion)}`, '_blank')}>
                          <LocationOn fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="WhatsApp">
                        <IconButton size="small" sx={{ bgcolor: '#ECFDF5', color: GREEN }} onClick={() => window.open(`https://wa.me/57${cuota.cliente_telefono}`, '_blank')}>
                          <WhatsApp fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Reprogramar Visita">
                        <IconButton size="small" sx={{ bgcolor: '#FFFBEB', color: YELLOW }} onClick={() => openReprogramarModal(cuota)}>
                          <MoreTime fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                    <Button 
                      variant="contained" startIcon={<ReceiptLong />}
                      onClick={() => openPagoModal(cuota)}
                      sx={{ bgcolor: GREEN, '&:hover': { bgcolor: '#059669' }, fontWeight: 700, borderRadius: 2 }}
                    >
                      Cobrar
                    </Button>
                  </Box>
                </Paper>
              </Grid>
            );
          })}
        </Grid>
      )}

      {/* MODAL DE PAGO */}
      <Dialog open={pagoModal.open} onClose={() => setPagoModal({ ...pagoModal, open: false })} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 800 }}>Registrar Pago</DialogTitle>
        <DialogContent>
          <Typography variant="body2" mb={2}>Monto recibido del cliente <strong>{pagoModal.cuota?.cliente_nombre}</strong>:</Typography>
          <TextField fullWidth autoFocus type="number" value={pagoModal.monto} onChange={(e) => setPagoModal({ ...pagoModal, monto: e.target.value })} 
            InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
            helperText="Si paga de más, el saldo se aplicará a las siguientes cuotas (Cascada)."
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setPagoModal({ ...pagoModal, open: false })} color="inherit">Cancelar</Button>
          <Button onClick={confirmarPago} variant="contained" sx={{ bgcolor: GREEN, fontWeight: 700 }}>Confirmar y Notificar</Button>
        </DialogActions>
      </Dialog>

      {/* MODAL DE REPROGRAMACIÓN */}
      <Dialog open={reprogramarModal.open} onClose={() => setReprogramarModal({ ...reprogramarModal, open: false })} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 800 }}>Reprogramar Cobro</DialogTitle>
        <DialogContent>
          <Typography variant="body2" mb={2}>Selecciona la nueva fecha de compromiso para este cliente.</Typography>
          <TextField fullWidth type="date" InputLabelProps={{ shrink: true }} value={reprogramarModal.nuevaFecha} onChange={(e) => setReprogramarModal({ ...reprogramarModal, nuevaFecha: e.target.value })} />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setReprogramarModal({ ...reprogramarModal, open: false })} color="inherit">Cancelar</Button>
          <Button onClick={confirmarReprogramacion} variant="contained" sx={{ bgcolor: YELLOW, fontWeight: 700 }}>Guardar Fecha</Button>
        </DialogActions>
      </Dialog>

    </Box>
  );
};

export default RutaCobro;