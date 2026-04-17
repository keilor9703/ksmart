import React, { useState, useEffect, useMemo } from 'react';
import { 
  Box, Typography, Paper, CircularProgress, IconButton, Tooltip,Button,
  Divider, Chip, Grid, TextField, InputAdornment, MenuItem, Select, FormControl, InputLabel
} from '@mui/material';
import { 
  WhatsApp, CheckCircle, Search, DirectionsRun, PersonAdd, LocationOn 
} from '@mui/icons-material';
import apiClient from '../api';
import { formatCurrency } from '../utils/formatters';
import { toast } from 'react-toastify';

const ACCENT = '#3B82F6';

const RutaCobro = () => {
  const [cuotas, setCuotas] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    fetchInicial();
  }, []);

  const fetchInicial = async () => {
    setLoading(true);
    try {
      const [uRes, cRes, meRes] = await Promise.all([
        apiClient.get('/admin/usuarios'),
        apiClient.get('/prestamos/cuotas-pendientes'),
        apiClient.get('/users/me')
      ]);
      setUsuarios(uRes.data);
      setCuotas(cRes.data);
      setCurrentUser(meRes.data);
    } catch (e) {
      toast.error("Error al sincronizar datos de ruta");
    } finally {
      setLoading(false);
    }
  };

  const esAdmin = currentUser?.role?.name === 'Admin';

  const cuotasFiltradas = useMemo(() => {
    return cuotas.filter(c => 
      c.cliente_nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.cliente_direccion?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [cuotas, searchTerm]);

  const handleAsignar = async (clienteId, usuarioId) => {
    try {
      await apiClient.post('/prestamos/asignar-cobrador', {
        cliente_id: clienteId,
        usuario_id: usuarioId
      });
      toast.success("Ruta actualizada");
      fetchInicial();
    } catch (e) {
      toast.error("Error al asignar");
    }
  };

  const handleRegistrarPago = async (id) => {
    if (!window.confirm("¿Confirmas el recaudo de esta cuota?")) return;
    try {
      await apiClient.post(`/prestamos/cuotas/${id}/pagar`);
      toast.success("Pago registrado");
      fetchInicial();
    } catch (e) { toast.error("Error en la transacción"); }
  };

  // ✅ FUNCIÓN PARA GOOGLE MAPS
  const handleOpenMaps = (direccion) => {
    if (!direccion) return toast.info("El cliente no tiene dirección registrada");
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(direccion)}`;
    window.open(url, '_blank');
  };

  if (loading) return <Box sx={{ p: 5, textAlign: 'center' }}><CircularProgress /></Box>;

  return (
    <Box sx={{ maxWidth: 1100, margin: '0 auto', p: { xs: 1, sm: 3 } }}>
      
      {/* HEADER */}
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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

      {/* BUSCADOR */}
      <Paper sx={{ p: 2, mb: 4, borderRadius: 4, boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
        <TextField
          fullWidth
          variant="standard"
          placeholder="Buscar cliente o dirección..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            disableUnderline: true,
            startAdornment: <InputAdornment position="start"><Search sx={{ color: 'text.secondary' }} /></InputAdornment>,
            sx: { fontSize: 16, py: 1 }
          }}
        />
      </Paper>

      {/* LISTADO */}
      <Grid container spacing={3}>
        {cuotasFiltradas.map(cuota => (
          <Grid item xs={12} key={cuota.cuota_id}>
            <Paper sx={{ 
              p: { xs: 2.5, md: 3 }, borderRadius: 5, border: '1px solid', borderColor: 'divider',
              transition: 'all 0.2s', '&:hover': { boxShadow: '0 8px 30px rgba(0,0,0,0.08)' } 
            }}>
              <Grid container spacing={2}>
                
                {/* FILA 1: INFO Y MONTO (Arriba siempre) */}
                <Grid item xs={12} md={7}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Box>
                      <Typography sx={{ fontWeight: 800, fontSize: 18, lineHeight: 1.2 }}>{cuota.cliente_nombre}</Typography>
                      <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 1 }}>{cuota.cliente_direccion || 'Sin dirección'}</Typography>
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <Chip label={`Cuota #${cuota.numero_cuota}`} size="small" sx={{ fontWeight: 700, bgcolor: 'action.selected' }} />
                        <Chip label={new Date(cuota.fecha_vencimiento).toLocaleDateString()} size="small" variant="outlined" />
                      </Box>
                    </Box>
                    <Box sx={{ textAlign: 'right' }}>
                       <Typography sx={{ fontSize: 10, fontWeight: 800, color: 'text.secondary' }}>RECAUDAR</Typography>
                       <Typography sx={{ fontWeight: 900, fontSize: 22, color: '#10B981' }}>{formatCurrency(cuota.monto_cuota)}</Typography>
                    </Box>
                  </Box>
                </Grid>

                {/* FILA 2: ASIGNACIÓN (Ocupa todo el ancho en móvil) */}
                {esAdmin && (
                  <Grid item xs={12} md={5}>
                    <FormControl fullWidth variant="outlined">
                      <InputLabel>Asignar Cobrador</InputLabel>
                      <Select
                        value={cuota.usuario_asignado_id || ''}
                        label="Asignar Cobrador"
                        onChange={(e) => handleAsignar(cuota.cliente_id, e.target.value)}
                        startAdornment={<InputAdornment position="start"><PersonAdd sx={{ fontSize: 20, color: ACCENT }} /></InputAdornment>}
                        sx={{ borderRadius: 3, height: 50, bgcolor: 'background.paper' }}
                      >
                        <MenuItem value=""><em>Sin asignar</em></MenuItem>
                        {usuarios.map(u => <MenuItem key={u.id} value={u.id}>{u.username.toUpperCase()}</MenuItem>)}
                      </Select>
                    </FormControl>
                  </Grid>
                )}

                <Grid item xs={12}><Divider sx={{ borderStyle: 'dashed' }} /></Grid>

                {/* FILA 3: BOTONES DE ACCIÓN (Horizontal y grandes) */}
                <Grid item xs={12}>
                  <Box sx={{ display: 'flex', gap: 2, justifyContent: 'space-between', alignItems: 'center' }}>
                    <Box sx={{ display: 'flex', gap: 1.5 }}>
                      <Tooltip title="Ubicación en Maps">
                        <IconButton 
                          onClick={() => handleOpenMaps(cuota.cliente_direccion)}
                          sx={{ bgcolor: '#3B82F6', color: 'white', '&:hover': { bgcolor: '#2563EB' }, width: 44, height: 44 }}
                        >
                          <LocationOn fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Chat WhatsApp">
                        <IconButton 
                          onClick={() => window.open(`https://wa.me/57${cuota.cliente_telefono}`, '_blank')}
                          sx={{ bgcolor: '#22C55E', color: 'white', '&:hover': { bgcolor: '#16A34A' }, width: 44, height: 44 }}
                        >
                          <WhatsApp fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>

                    <Button
                      variant="contained"
                      startIcon={<CheckCircle />}
                      onClick={() => handleRegistrarPago(cuota.cuota_id)}
                      sx={{ 
                        bgcolor: '#10B981', px: 3, borderRadius: 3, fontWeight: 800,
                        boxShadow: '0 4px 12px rgba(16,185,129,0.2)',
                        '&:hover': { bgcolor: '#059669' }
                      }}
                    >
                      PAGADO
                    </Button>
                  </Box>
                </Grid>

              </Grid>
            </Paper>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
};

export default RutaCobro;