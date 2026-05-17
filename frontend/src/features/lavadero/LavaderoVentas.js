import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Paper, Typography, Grid, TextField, Button, Chip, Stack,
  IconButton, Divider, List, ListItem, ListItemText, Autocomplete,
  CircularProgress, Avatar, Tooltip,
} from '@mui/material';
import { DirectionsCar, Add, Remove, DeleteOutline, CheckCircle } from '@mui/icons-material';
import { toast } from 'react-toastify';
import apiClient from '../../api';
import { formatCurrency } from '../../utils/formatters';
import CurrencyField from '../../components/common/CurrencyField';

const ACCENT = '#FF6020';

const TIPOS_VEHICULO    = ['Moto', 'Carro', 'SUV/Camioneta', 'Otro'];
const METODOS_PAGO      = ['Efectivo', 'Transferencia', 'Tarjeta'];
const CONSUMIDOR_FINAL  = { id: null, nombre: 'Consumidor final / Otros' };

function buildEmptyCart() { return []; }

export default function LavaderoVentas({ user }) {
  const isAdmin = user?.role?.name === 'Admin';

  // ─── Data from API ─────────────────────────────────────────────────────────
  const [servicios, setServicios]   = useState([]);
  const [trabajadores, setTrabajadores] = useState([]);
  const [clientes, setClientes]     = useState([]);
  const [ventas, setVentas]         = useState([]);
  const [loadingServicios, setLoadingServicios] = useState(true);

  // ─── Form state ────────────────────────────────────────────────────────────
  const [placa, setPlaca]                 = useState('');
  const [tipoVehiculo, setTipoVehiculo]   = useState('Carro');
  const [carrito, setCarrito]             = useState(buildEmptyCart());
  const [operadorId, setOperadorId]       = useState(user?.id || null);
  const [operadorObj, setOperadorObj]     = useState(null);
  const [metodoPago, setMetodoPago]       = useState('Efectivo');
  const [valorRecibido, setValorRecibido] = useState(0);
  const [clienteObj, setClienteObj]       = useState(CONSUMIDOR_FINAL);
  const [saving, setSaving]               = useState(false);

  // ─── Fetch services ────────────────────────────────────────────────────────
  const fetchServicios = useCallback(async () => {
    setLoadingServicios(true);
    try {
      const { data } = await apiClient.get('/productos/', {
        params: { es_servicio: true, limit: 200 },
      });
      setServicios(data.results ?? data);
    } catch {
      toast.error('No se pudieron cargar los servicios.');
    } finally {
      setLoadingServicios(false);
    }
  }, []);

  // ─── Fetch workers (admin only) ────────────────────────────────────────────
  const fetchTrabajadores = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const { data } = await apiClient.get('/admin/usuarios/');
      setTrabajadores(data.results ?? data);
    } catch {
      /* silent */
    }
  }, [isAdmin]);

  // ─── Fetch clients ─────────────────────────────────────────────────────────
  const fetchClientes = useCallback(async () => {
    try {
      const { data } = await apiClient.get('/clientes/', { params: { limit: 200 } });
      const list = data.results ?? data;
      setClientes(list);
    } catch {
      /* silent */
    }
  }, []);

  // ─── Fetch recent sales ────────────────────────────────────────────────────
  const fetchVentas = useCallback(async () => {
    try {
      const { data } = await apiClient.get('/ventas/', {
        params: { limit: 10, ordering: '-fecha' },
      });
      const list = (data.results ?? data).filter(v => v.placa_vehiculo);
      setVentas(list.slice(0, 10));
    } catch {
      /* silent */
    }
  }, []);

  useEffect(() => {
    fetchServicios();
    fetchTrabajadores();
    fetchClientes();
    fetchVentas();
  }, [fetchServicios, fetchTrabajadores, fetchClientes, fetchVentas]);

  // ─── Cart helpers ──────────────────────────────────────────────────────────
  const agregarServicio = (servicio) => {
    setCarrito(prev => {
      const existente = prev.find(i => i.productoId === servicio.id);
      if (existente) {
        return prev.map(i =>
          i.productoId === servicio.id ? { ...i, cantidad: i.cantidad + 1 } : i
        );
      }
      return [
        ...prev,
        {
          productoId: servicio.id,
          nombre: servicio.nombre,
          precio: parseFloat(servicio.precio_venta ?? servicio.precio ?? 0),
          cantidad: 1,
        },
      ];
    });
  };

  const cambiarCantidad = (productoId, delta) => {
    setCarrito(prev =>
      prev
        .map(i => i.productoId === productoId ? { ...i, cantidad: i.cantidad + delta } : i)
        .filter(i => i.cantidad > 0)
    );
  };

  const quitarItem = (productoId) => {
    setCarrito(prev => prev.filter(i => i.productoId !== productoId));
  };

  const total = carrito.reduce((s, i) => s + i.precio * i.cantidad, 0);
  const cambio = metodoPago === 'Efectivo' && valorRecibido > 0
    ? Math.max(0, valorRecibido - total)
    : 0;

  // ─── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!placa.trim()) { toast.warning('Ingresa la placa del vehículo.'); return; }
    if (carrito.length === 0) { toast.warning('Agrega al menos un servicio.'); return; }

    const clienteId = clienteObj?.id ?? null;

    setSaving(true);
    try {
      await apiClient.post('/ventas/', {
        cliente_id: clienteId,
        placa_vehiculo: placa.trim().toUpperCase(),
        operador_id: operadorId,
        pagada: true,
        metodo_pago: metodoPago,
        iva_porcentaje: 0,
        detalles: carrito.map(item => ({
          producto_id: item.productoId,
          cantidad: item.cantidad,
          precio_unitario: item.precio,
        })),
      });
      toast.success('¡Lavada registrada!');
      setPlaca('');
      setTipoVehiculo('Carro');
      setCarrito(buildEmptyCart());
      setMetodoPago('Efectivo');
      setValorRecibido(0);
      setClienteObj(CONSUMIDOR_FINAL);
      fetchVentas();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al registrar la venta.');
    } finally {
      setSaving(false);
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <Box sx={{ p: { xs: 1, md: 2 }, maxWidth: 1100, mx: 'auto' }}>

      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
        <Box sx={{
          width: 42, height: 42, borderRadius: 2,
          bgcolor: `${ACCENT}18`, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <DirectionsCar sx={{ color: ACCENT, fontSize: 24 }} />
        </Box>
        <Box>
          <Typography sx={{ fontSize: 20, fontWeight: 800, lineHeight: 1.1 }}>
            POS Lavadero
          </Typography>
          <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
            Registro de lavadas
          </Typography>
        </Box>
      </Box>

      <Grid container spacing={2.5}>
        {/* ── LEFT COLUMN ── */}
        <Grid item xs={12} md={7}>

          {/* Row 1: Placa + Tipo de vehículo */}
          <Paper sx={{ p: 2.5, borderRadius: 3, mb: 2, border: '1px solid', borderColor: 'divider' }}>
            <Typography sx={{ fontWeight: 700, fontSize: 13, mb: 1.5, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Vehículo
            </Typography>
            <Grid container spacing={2} alignItems="flex-start">
              <Grid item xs={12} sm={5}>
                <TextField
                  label="Placa"
                  value={placa}
                  onChange={e => setPlaca(e.target.value.toUpperCase())}
                  size="small"
                  fullWidth
                  placeholder="AAA-000"
                  inputProps={{
                    style: { fontFamily: 'monospace', fontWeight: 800, fontSize: 18, letterSpacing: 3 },
                    maxLength: 8,
                  }}
                />
              </Grid>
              <Grid item xs={12} sm={7}>
                <Typography sx={{ fontSize: 11, color: 'text.secondary', mb: 0.8 }}>Tipo de vehículo</Typography>
                <Box sx={{ display: 'flex', gap: 0.8, flexWrap: 'wrap' }}>
                  {TIPOS_VEHICULO.map(t => (
                    <Chip
                      key={t}
                      label={t}
                      size="small"
                      onClick={() => setTipoVehiculo(t)}
                      sx={{
                        fontWeight: 600, cursor: 'pointer',
                        bgcolor: tipoVehiculo === t ? ACCENT : 'action.hover',
                        color: tipoVehiculo === t ? 'white' : 'text.primary',
                        '&:hover': { bgcolor: tipoVehiculo === t ? '#e6561c' : 'action.selected' },
                      }}
                    />
                  ))}
                </Box>
              </Grid>
            </Grid>
          </Paper>

          {/* Row 2: Service tiles */}
          <Paper sx={{ p: 2.5, borderRadius: 3, mb: 2, border: '1px solid', borderColor: 'divider' }}>
            <Typography sx={{ fontWeight: 700, fontSize: 13, mb: 1.5, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Servicios
            </Typography>
            {loadingServicios ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress size={32} sx={{ color: ACCENT }} />
              </Box>
            ) : servicios.length === 0 ? (
              <Typography sx={{ color: 'text.secondary', fontSize: 13, textAlign: 'center', py: 2 }}>
                No hay servicios configurados. Crea productos de tipo servicio en el catálogo.
              </Typography>
            ) : (
              <Grid container spacing={1.5}>
                {servicios.map(s => (
                  <Grid item xs={6} sm={4} key={s.id}>
                    <Paper
                      onClick={() => agregarServicio(s)}
                      elevation={0}
                      sx={{
                        p: 1.5, borderRadius: 2.5, cursor: 'pointer', textAlign: 'center',
                        border: '2px solid',
                        borderColor: carrito.find(i => i.productoId === s.id) ? ACCENT : 'divider',
                        bgcolor: carrito.find(i => i.productoId === s.id) ? `${ACCENT}08` : 'background.paper',
                        transition: 'all 0.15s',
                        '&:hover': { borderColor: ACCENT, bgcolor: `${ACCENT}08`, transform: 'translateY(-1px)' },
                      }}
                    >
                      <Typography sx={{ fontSize: 13, fontWeight: 700, lineHeight: 1.3, mb: 0.5 }}>
                        {s.nombre}
                      </Typography>
                      <Typography sx={{ fontSize: 13, fontWeight: 800, color: ACCENT }}>
                        {formatCurrency(parseFloat(s.precio_venta ?? s.precio ?? 0))}
                      </Typography>
                      {carrito.find(i => i.productoId === s.id) && (
                        <Chip
                          size="small"
                          label={`×${carrito.find(i => i.productoId === s.id).cantidad}`}
                          sx={{ mt: 0.5, height: 18, fontSize: 10, fontWeight: 800, bgcolor: ACCENT, color: 'white' }}
                        />
                      )}
                    </Paper>
                  </Grid>
                ))}
              </Grid>
            )}
          </Paper>

          {/* Row 3: Cart */}
          <Paper sx={{ p: 2.5, borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
            <Typography sx={{ fontWeight: 700, fontSize: 13, mb: 1.5, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Carrito
            </Typography>
            {carrito.length === 0 ? (
              <Typography sx={{ color: 'text.secondary', fontSize: 13, textAlign: 'center', py: 2 }}>
                Selecciona un servicio para agregar al carrito.
              </Typography>
            ) : (
              <>
                <List disablePadding>
                  {carrito.map((item, idx) => (
                    <React.Fragment key={item.productoId}>
                      {idx > 0 && <Divider />}
                      <ListItem
                        disablePadding
                        sx={{ py: 1 }}
                        secondaryAction={
                          <Tooltip title="Quitar">
                            <IconButton size="small" onClick={() => quitarItem(item.productoId)}
                              sx={{ color: '#EF4444' }}>
                              <DeleteOutline fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        }
                      >
                        <ListItemText
                          primary={
                            <Typography sx={{ fontWeight: 600, fontSize: 13 }}>{item.nombre}</Typography>
                          }
                          secondary={
                            <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mt: 0.5 }}>
                              <IconButton size="small" onClick={() => cambiarCantidad(item.productoId, -1)}
                                sx={{ p: 0.3, color: ACCENT }}>
                                <Remove fontSize="small" />
                              </IconButton>
                              <Typography sx={{ fontWeight: 800, minWidth: 20, textAlign: 'center', fontSize: 14 }}>
                                {item.cantidad}
                              </Typography>
                              <IconButton size="small" onClick={() => cambiarCantidad(item.productoId, 1)}
                                sx={{ p: 0.3, color: ACCENT }}>
                                <Add fontSize="small" />
                              </IconButton>
                              <Typography sx={{ fontSize: 12, color: 'text.secondary', ml: 1 }}>
                                × {formatCurrency(item.precio)}
                              </Typography>
                              <Typography sx={{ fontWeight: 700, fontSize: 13, color: ACCENT, ml: 'auto' }}>
                                = {formatCurrency(item.precio * item.cantidad)}
                              </Typography>
                            </Stack>
                          }
                        />
                      </ListItem>
                    </React.Fragment>
                  ))}
                </List>
                <Divider sx={{ my: 1.5 }} />
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography sx={{ fontWeight: 700, fontSize: 15 }}>Total</Typography>
                  <Typography sx={{ fontWeight: 900, fontSize: 22, color: ACCENT }}>
                    {formatCurrency(total)}
                  </Typography>
                </Box>
              </>
            )}
          </Paper>
        </Grid>

        {/* ── RIGHT COLUMN ── */}
        <Grid item xs={12} md={5}>
          <Paper sx={{ p: 2.5, borderRadius: 3, border: '1px solid', borderColor: 'divider', mb: 2 }}>
            <Typography sx={{ fontWeight: 700, fontSize: 13, mb: 1.5, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Cliente (opcional)
            </Typography>
            <Autocomplete
              options={[CONSUMIDOR_FINAL, ...clientes]}
              getOptionLabel={c => c.nombre || ''}
              value={clienteObj ?? CONSUMIDOR_FINAL}
              onChange={(_, v) => setClienteObj(v ?? CONSUMIDOR_FINAL)}
              isOptionEqualToValue={(opt, val) => (opt.id ?? null) === (val.id ?? null)}
              size="small"
              renderInput={params => (
                <TextField {...params} placeholder="Consumidor final / Otros" />
              )}
            />
          </Paper>

          {/* Trabajador */}
          <Paper sx={{ p: 2.5, borderRadius: 3, border: '1px solid', borderColor: 'divider', mb: 2 }}>
            <Typography sx={{ fontWeight: 700, fontSize: 13, mb: 1.5, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Trabajador
            </Typography>
            {isAdmin ? (
              <Autocomplete
                options={trabajadores}
                getOptionLabel={t => t.nombre_completo || t.username || ''}
                value={operadorObj}
                onChange={(_, v) => { setOperadorObj(v); setOperadorId(v?.id ?? null); }}
                size="small"
                renderInput={params => (
                  <TextField {...params} placeholder="Selecciona un trabajador…" />
                )}
              />
            ) : (
              <Chip
                avatar={<Avatar sx={{ bgcolor: `${ACCENT}25`, color: ACCENT, fontSize: 13, fontWeight: 800 }}>
                  {(user?.nombre_completo || '?')[0]}
                </Avatar>}
                label={user?.nombre_completo || 'Operador'}
                sx={{ fontWeight: 600, bgcolor: `${ACCENT}12`, color: 'text.primary' }}
              />
            )}
          </Paper>

          {/* Método de pago */}
          <Paper sx={{ p: 2.5, borderRadius: 3, border: '1px solid', borderColor: 'divider', mb: 2 }}>
            <Typography sx={{ fontWeight: 700, fontSize: 13, mb: 1.5, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Método de pago
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: metodoPago === 'Efectivo' ? 2 : 0 }}>
              {METODOS_PAGO.map(m => (
                <Chip
                  key={m}
                  label={m}
                  onClick={() => setMetodoPago(m)}
                  sx={{
                    fontWeight: 600, cursor: 'pointer',
                    bgcolor: metodoPago === m ? ACCENT : 'action.hover',
                    color: metodoPago === m ? 'white' : 'text.primary',
                    '&:hover': { bgcolor: metodoPago === m ? '#e6561c' : 'action.selected' },
                  }}
                />
              ))}
            </Box>
            {metodoPago === 'Efectivo' && (
              <Stack spacing={1.5}>
                <CurrencyField
                  label="Valor recibido"
                  value={valorRecibido}
                  onChange={setValorRecibido}
                  size="small"
                />
                {valorRecibido > 0 && (
                  <Box sx={{
                    p: 1.5, borderRadius: 2,
                    bgcolor: cambio >= 0 ? '#F0FDF4' : '#FEF2F2',
                    border: '1px solid',
                    borderColor: cambio >= 0 ? '#BBF7D0' : '#FECACA',
                  }}>
                    <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 0.2 }}>
                      Cambio a devolver
                    </Typography>
                    <Typography sx={{
                      fontSize: 20, fontWeight: 900,
                      color: cambio >= 0 ? '#16A34A' : '#DC2626',
                    }}>
                      {formatCurrency(cambio)}
                    </Typography>
                  </Box>
                )}
              </Stack>
            )}
          </Paper>

          {/* Submit */}
          <Button
            variant="contained"
            fullWidth
            size="large"
            onClick={handleSubmit}
            disabled={saving || carrito.length === 0 || !placa.trim()}
            startIcon={saving ? <CircularProgress size={18} color="inherit" /> : <DirectionsCar />}
            sx={{
              bgcolor: ACCENT,
              '&:hover': { bgcolor: '#e6561c' },
              '&:disabled': { bgcolor: 'action.disabledBackground' },
              fontWeight: 800, fontSize: 15, borderRadius: 2.5,
              py: 1.5, textTransform: 'none',
            }}
          >
            {saving ? 'Registrando…' : 'Registrar Lavada'}
          </Button>

          {carrito.length > 0 && placa.trim() && (
            <Box sx={{ mt: 1.5, p: 2, borderRadius: 2, bgcolor: `${ACCENT}08`, border: '1px solid', borderColor: `${ACCENT}30` }}>
              <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 0.5 }}>
                Resumen
              </Typography>
              <Typography sx={{ fontWeight: 700, fontSize: 13 }}>
                {placa.trim().toUpperCase()} · {tipoVehiculo}
              </Typography>
              <Typography sx={{ fontWeight: 900, fontSize: 18, color: ACCENT }}>
                {formatCurrency(total)}
              </Typography>
              <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
                {carrito.length} servicio{carrito.length !== 1 ? 's' : ''} · {metodoPago}
              </Typography>
            </Box>
          )}
        </Grid>
      </Grid>

      {/* ── Recent sales ── */}
      <Paper sx={{ p: 2.5, borderRadius: 3, mt: 3, border: '1px solid', borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <CheckCircle sx={{ color: '#10B981', fontSize: 18 }} />
          <Typography sx={{ fontWeight: 700, fontSize: 15 }}>
            Últimas lavadas
          </Typography>
        </Box>
        {ventas.length === 0 ? (
          <Typography sx={{ color: 'text.secondary', fontSize: 13, textAlign: 'center', py: 2 }}>
            No hay ventas con placa registradas aún.
          </Typography>
        ) : (
          <Box sx={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  {['#', 'Placa', 'Servicios', 'Total', 'Pago', 'Fecha'].map(h => (
                    <th key={h} style={{
                      textAlign: 'left', padding: '6px 10px',
                      fontWeight: 700, fontSize: 11, color: '#6B7280',
                      textTransform: 'uppercase', letterSpacing: 0.5,
                      borderBottom: '1px solid #E5E7EB',
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ventas.map((v, idx) => (
                  <tr key={v.id} style={{ background: idx % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.02)' }}>
                    <td style={{ padding: '8px 10px', color: '#9CA3AF' }}>#{v.id}</td>
                    <td style={{ padding: '8px 10px', fontFamily: 'monospace', fontWeight: 800, letterSpacing: 2 }}>
                      {v.placa_vehiculo}
                    </td>
                    <td style={{ padding: '8px 10px', color: '#6B7280' }}>
                      {(v.detalles || []).map(d => d.producto?.nombre).filter(Boolean).join(', ') || '—'}
                    </td>
                    <td style={{ padding: '8px 10px', fontWeight: 700, color: ACCENT }}>
                      {formatCurrency(v.total)}
                    </td>
                    <td style={{ padding: '8px 10px' }}>
                      <Chip
                        label={v.metodo_pago || '—'}
                        size="small"
                        sx={{ fontSize: 10, fontWeight: 700, height: 20 }}
                      />
                    </td>
                    <td style={{ padding: '8px 10px', color: '#6B7280', fontSize: 12 }}>
                      {new Date(v.fecha + (v.fecha?.includes('Z') ? '' : 'Z')).toLocaleString('es-CO', {
                        day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Box>
        )}
      </Paper>
    </Box>
  );
}
