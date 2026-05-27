import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box, Paper, Typography, Grid, TextField, Button, Chip, Stack,
  IconButton, Divider, List, ListItem, ListItemText, Autocomplete,
  CircularProgress, Avatar, Tooltip, InputAdornment,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
} from '@mui/material';
import {
  DirectionsCar, Add, Remove, DeleteOutline, CheckCircle,
  TwoWheeler, LocalShipping, DriveEta, Search, ClearAll,
  Replay, Notes,
} from '@mui/icons-material';
import { toast } from 'react-toastify';
import apiClient from '../../api';
import { formatCurrency } from '../../utils/formatters';
import CurrencyField from '../../components/common/CurrencyField';
import HelpGuideTopBar from '../../components/onboarding/HelpGuideTopBar';
import { METODOS_PAGO_SIMPLE as METODOS_PAGO } from '../../utils/constants';

const ACCENT = '#FF6020';
const GREEN  = '#10B981';

const TIPOS_VEHICULO = [
  { label: 'Carro',        icon: DirectionsCar  },
  { label: 'Moto',         icon: TwoWheeler     },
  { label: 'SUV/Camioneta',icon: LocalShipping  },
  { label: 'Otro',         icon: DriveEta       },
];
const CONSUMIDOR_FINAL = { id: null, nombre: 'Consumidor final / Otros' };

const buildEmptyCart = () => [];

const SectionLabel = ({ children }) => (
  <Typography sx={{ fontWeight: 700, fontSize: 11, mb: 1.5, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.8 }}>
    {children}
  </Typography>
);

/* ── format & validate placa ─────────────────────────────────────────────── */
const formatPlaca = (raw) => {
  const clean = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (clean.length > 3) return `${clean.slice(0, 3)}-${clean.slice(3, 7)}`;
  return clean;
};

export default function LavaderoVentas({ user }) {
  const isAdmin = user?.role?.name === 'Admin';

  const [servicios,      setServicios]      = useState([]);
  const [trabajadores,   setTrabajadores]   = useState([]);
  const [clientes,       setClientes]       = useState([]);
  const [ventas,         setVentas]         = useState([]);
  const [loadingServicios, setLoadingServicios] = useState(true);

  const [placa,          setPlaca]          = useState('');
  const [tipoVehiculo,   setTipoVehiculo]   = useState('Carro');
  const [carrito,        setCarrito]        = useState(buildEmptyCart());
  const [operadorId,     setOperadorId]     = useState(user?.id || null);
  const [operadorObj,    setOperadorObj]    = useState(null);
  const [metodoPago,     setMetodoPago]     = useState('Efectivo');
  const [valorRecibido,  setValorRecibido]  = useState(0);
  const [clienteObj,     setClienteObj]     = useState(CONSUMIDOR_FINAL);
  const [observaciones,  setObservaciones]  = useState('');
  const [saving,         setSaving]         = useState(false);
  const [busquedaServicio, setBusquedaServicio] = useState('');

  /* ── fetch ──────────────────────────────────────────────────────────────── */
  const fetchServicios = useCallback(async () => {
    setLoadingServicios(true);
    try {
      const { data } = await apiClient.get('/productos/', { params: { es_servicio: true, limit: 200 } });
      setServicios(data.results ?? data);
    } catch {
      toast.error('No se pudieron cargar los servicios.');
    } finally {
      setLoadingServicios(false);
    }
  }, []);

  const fetchTrabajadores = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const { data } = await apiClient.get('/admin/usuarios/');
      setTrabajadores(data.results ?? data);
    } catch { /* silent */ }
  }, [isAdmin]);

  const fetchClientes = useCallback(async () => {
    try {
      const { data } = await apiClient.get('/clientes/', { params: { limit: 200 } });
      setClientes(data.results ?? data);
    } catch { /* silent */ }
  }, []);

  const fetchVentas = useCallback(async () => {
    try {
      const { data } = await apiClient.get('/ventas/', { params: { limit: 12, ordering: '-fecha' } });
      const list = (data.results ?? data).filter(v => v.placa_vehiculo);
      setVentas(list.slice(0, 12));
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    fetchServicios();
    fetchTrabajadores();
    fetchClientes();
    fetchVentas();
  }, [fetchServicios, fetchTrabajadores, fetchClientes, fetchVentas]);

  /* ── cart ──────────────────────────────────────────────────────────────── */
  const agregarServicio = (servicio) => {
    setCarrito(prev => {
      const existente = prev.find(i => i.productoId === servicio.id);
      if (existente) return prev.map(i => i.productoId === servicio.id ? { ...i, cantidad: i.cantidad + 1 } : i);
      return [...prev, {
        productoId: servicio.id,
        nombre: servicio.nombre,
        precio: parseFloat(servicio.precio_venta ?? servicio.precio ?? 0),
        cantidad: 1,
      }];
    });
  };

  const cambiarCantidad = (productoId, delta) => {
    setCarrito(prev => prev.map(i => i.productoId === productoId ? { ...i, cantidad: i.cantidad + delta } : i).filter(i => i.cantidad > 0));
  };

  const quitarItem = (productoId) => setCarrito(prev => prev.filter(i => i.productoId !== productoId));

  const total  = carrito.reduce((s, i) => s + i.precio * i.cantidad, 0);
  const cambio = metodoPago === 'Efectivo' && valorRecibido > 0 ? Math.max(0, valorRecibido - total) : 0;

  const serviciosFiltrados = useMemo(() => {
    if (!busquedaServicio.trim()) return servicios;
    const q = busquedaServicio.toLowerCase();
    return servicios.filter(s => s.nombre.toLowerCase().includes(q));
  }, [servicios, busquedaServicio]);

  /* ── quick repeat from recent sales ──────────────────────────────────────*/
  const repetirVenta = (v) => {
    setPlaca(v.placa_vehiculo || '');
    if (v.tipo_vehiculo) setTipoVehiculo(v.tipo_vehiculo);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    toast.info(`Placa ${v.placa_vehiculo} cargada. Selecciona los servicios.`);
  };

  /* ── reset ─────────────────────────────────────────────────────────────── */
  const resetForm = () => {
    setPlaca(''); setTipoVehiculo('Carro');
    setCarrito(buildEmptyCart()); setMetodoPago('Efectivo');
    setValorRecibido(0); setClienteObj(CONSUMIDOR_FINAL);
    setObservaciones(''); setBusquedaServicio('');
  };

  /* ── submit ─────────────────────────────────────────────────────────────── */
  const handleSubmit = async () => {
    if (!placa.trim()) { toast.warning('Ingresa la placa del vehículo.'); return; }
    if (carrito.length === 0) { toast.warning('Agrega al menos un servicio.'); return; }

    setSaving(true);
    try {
      await apiClient.post('/ventas/', {
        cliente_id:     clienteObj?.id ?? null,
        placa_vehiculo: placa.trim().toUpperCase().replace(/-/g, ''),
        tipo_vehiculo:  tipoVehiculo,
        operador_id:    operadorId,
        pagada:         true,
        metodo_pago:    metodoPago,
        iva_porcentaje: 0,
        observaciones:  observaciones.trim() || null,
        detalles: carrito.map(item => ({
          producto_id:     item.productoId,
          cantidad:        item.cantidad,
          precio_unitario: item.precio,
        })),
      });
      toast.success('¡Lavada registrada exitosamente!');
      resetForm();
      fetchVentas();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al registrar la venta.');
    } finally {
      setSaving(false);
    }
  };

  const TipoIcon = TIPOS_VEHICULO.find(t => t.label === tipoVehiculo)?.icon ?? DirectionsCar;

  /* ── render ─────────────────────────────────────────────────────────────── */
  return (
    <Box sx={{ p: { xs: 1, md: 2 }, maxWidth: 1140, mx: 'auto' }}>

      {/* ── Header ── */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ width: 42, height: 42, borderRadius: 2, bgcolor: `${ACCENT}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <DirectionsCar sx={{ color: ACCENT, fontSize: 24 }} />
          </Box>
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography sx={{ fontSize: 20, fontWeight: 800, lineHeight: 1.1 }}>POS Lavadero</Typography>
              <HelpGuideTopBar
                moduleName="POS Lavadero"
                moduleColor={ACCENT}
                steps={[
                  { title: 'Selecciona el tipo de vehículo', description: 'Elige entre Moto, Carro, SUV u Otro. El tipo se guarda en el historial.' },
                  { title: 'Elige el servicio', description: 'Haz clic en las tarjetas de servicio para agregar al carrito. Puedes combinar varios.' },
                  { title: 'Asigna el lavador', description: 'Selecciona el empleado que realizará el trabajo para el reporte de productividad.' },
                  { title: 'Cobra y registra', description: 'Selecciona el método de pago y haz clic en "Registrar Lavada".' },
                ]}
                faqItems={[
                  { q: '¿Cómo agrego un nuevo tipo de lavada?', a: 'En el módulo Productos, crea un producto de tipo "Servicio" con el nombre y precio de la lavada.' },
                  { q: '¿Puedo atender varios vehículos a la vez?', a: 'Sí. Cada orden es independiente — termina una y la pantalla se limpia para la siguiente.' },
                  { q: '¿Cómo veo cuánto produjo cada lavador?', a: 'Ve al módulo "Reporte Lavadero" y selecciona el período para ver detalle por trabajador.' },
                  { q: '¿Qué es el botón "Repetir" en el historial?', a: 'Carga la misma placa del registro anterior para agilizar el registro de vehículos frecuentes.' },
                ]}
              />
            </Box>
            <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>Registro rápido de lavadas</Typography>
          </Box>
        </Box>
      </Box>

      <Grid container spacing={2.5}>
        {/* ══ LEFT COLUMN ══════════════════════════════════════════════════ */}
        <Grid item xs={12} md={7}>

          {/* ─ Vehículo ─ */}
          <Paper sx={{ p: 2.5, borderRadius: 3, mb: 2, border: '1px solid', borderColor: 'divider' }}>
            <SectionLabel>Vehículo</SectionLabel>
            <Grid container spacing={2} alignItems="flex-start">
              <Grid item xs={12} sm={5}>
                <TextField
                  label="Placa"
                  value={placa}
                  onChange={e => setPlaca(formatPlaca(e.target.value))}
                  size="small"
                  fullWidth
                  placeholder="ABC-123"
                  inputProps={{
                    style: { fontFamily: 'monospace', fontWeight: 800, fontSize: 20, letterSpacing: 4 },
                    maxLength: 8,
                  }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <TipoIcon sx={{ color: ACCENT, fontSize: 20 }} />
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>
              <Grid item xs={12} sm={7}>
                <Typography sx={{ fontSize: 11, color: 'text.secondary', mb: 0.8 }}>Tipo de vehículo</Typography>
                <Box sx={{ display: 'flex', gap: 0.8, flexWrap: 'wrap' }}>
                  {TIPOS_VEHICULO.map(({ label, icon: Icon }) => (
                    <Chip
                      key={label}
                      label={label}
                      size="small"
                      icon={<Icon sx={{ fontSize: 14 }} />}
                      onClick={() => setTipoVehiculo(label)}
                      sx={{
                        fontWeight: 600, cursor: 'pointer',
                        bgcolor: tipoVehiculo === label ? ACCENT : 'action.hover',
                        color: tipoVehiculo === label ? 'white' : 'text.primary',
                        '& .MuiChip-icon': { color: tipoVehiculo === label ? 'rgba(255,255,255,0.85)' : 'text.secondary' },
                        '&:hover': { bgcolor: tipoVehiculo === label ? '#e6561c' : 'action.selected' },
                        transition: 'all 0.15s',
                      }}
                    />
                  ))}
                </Box>
              </Grid>
            </Grid>
          </Paper>

          {/* ─ Servicios ─ */}
          <Paper sx={{ p: 2.5, borderRadius: 3, mb: 2, border: '1px solid', borderColor: 'divider' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
              <SectionLabel>Servicios</SectionLabel>
              {servicios.length > 6 && (
                <TextField
                  size="small"
                  placeholder="Buscar…"
                  value={busquedaServicio}
                  onChange={e => setBusquedaServicio(e.target.value)}
                  sx={{ width: 160, '& .MuiOutlinedInput-root': { borderRadius: 2, fontSize: 13 } }}
                  InputProps={{
                    startAdornment: <InputAdornment position="start"><Search sx={{ fontSize: 16, color: 'text.disabled' }} /></InputAdornment>,
                  }}
                />
              )}
            </Box>
            {loadingServicios ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress size={32} sx={{ color: ACCENT }} />
              </Box>
            ) : serviciosFiltrados.length === 0 ? (
              <Typography sx={{ color: 'text.secondary', fontSize: 13, textAlign: 'center', py: 2 }}>
                {servicios.length === 0
                  ? 'No hay servicios configurados. Crea productos de tipo servicio en el catálogo.'
                  : 'Sin resultados para la búsqueda.'
                }
              </Typography>
            ) : (
              <Grid container spacing={1.5}>
                {serviciosFiltrados.map(s => {
                  const inCart = carrito.find(i => i.productoId === s.id);
                  return (
                    <Grid item xs={6} sm={4} key={s.id}>
                      <Paper
                        onClick={() => agregarServicio(s)}
                        elevation={0}
                        sx={{
                          p: 1.5, borderRadius: 2.5, cursor: 'pointer', textAlign: 'center',
                          border: '2px solid',
                          borderColor: inCart ? ACCENT : 'divider',
                          bgcolor: inCart ? `${ACCENT}08` : 'background.paper',
                          transition: 'all 0.15s',
                          '&:hover': { borderColor: ACCENT, bgcolor: `${ACCENT}08`, transform: 'translateY(-2px)', boxShadow: `0 4px 12px ${ACCENT}20` },
                          position: 'relative',
                        }}
                      >
                        <Typography sx={{ fontSize: 13, fontWeight: 700, lineHeight: 1.3, mb: 0.4 }}>
                          {s.nombre}
                        </Typography>
                        <Typography sx={{ fontSize: 14, fontWeight: 800, color: ACCENT }}>
                          {formatCurrency(parseFloat(s.precio_venta ?? s.precio ?? 0))}
                        </Typography>
                        {inCart && (
                          <Box sx={{
                            position: 'absolute', top: -8, right: -8,
                            width: 22, height: 22, borderRadius: '50%',
                            bgcolor: ACCENT, color: '#fff',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 11, fontWeight: 800,
                          }}>
                            {inCart.cantidad}
                          </Box>
                        )}
                      </Paper>
                    </Grid>
                  );
                })}
              </Grid>
            )}
          </Paper>

          {/* ─ Carrito ─ */}
          <Paper sx={{ p: 2.5, borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
              <SectionLabel>Carrito {carrito.length > 0 && `(${carrito.length})`}</SectionLabel>
              {carrito.length > 0 && (
                <Tooltip title="Limpiar carrito">
                  <IconButton size="small" onClick={() => setCarrito([])} sx={{ color: '#EF4444', p: 0.5 }}>
                    <ClearAll fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
            </Box>
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
                      <ListItem disablePadding sx={{ py: 1 }} secondaryAction={
                        <Tooltip title="Quitar">
                          <IconButton size="small" onClick={() => quitarItem(item.productoId)} sx={{ color: '#EF4444' }}>
                            <DeleteOutline fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      }>
                        <ListItemText
                          primary={<Typography sx={{ fontWeight: 600, fontSize: 13 }}>{item.nombre}</Typography>}
                          secondary={
                            <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mt: 0.5 }}>
                              <IconButton size="small" onClick={() => cambiarCantidad(item.productoId, -1)} sx={{ p: 0.3, color: ACCENT }}>
                                <Remove fontSize="small" />
                              </IconButton>
                              <Typography sx={{ fontWeight: 800, minWidth: 20, textAlign: 'center', fontSize: 14 }}>
                                {item.cantidad}
                              </Typography>
                              <IconButton size="small" onClick={() => cambiarCantidad(item.productoId, 1)} sx={{ p: 0.3, color: ACCENT }}>
                                <Add fontSize="small" />
                              </IconButton>
                              <Typography sx={{ fontSize: 12, color: 'text.secondary', ml: 1 }}>
                                × {formatCurrency(item.precio)}
                              </Typography>
                              <Typography sx={{ fontWeight: 700, fontSize: 13, color: ACCENT, ml: 'auto !important' }}>
                                {formatCurrency(item.precio * item.cantidad)}
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
                  <Typography sx={{ fontWeight: 900, fontSize: 24, color: ACCENT }}>{formatCurrency(total)}</Typography>
                </Box>
              </>
            )}
          </Paper>
        </Grid>

        {/* ══ RIGHT COLUMN ═════════════════════════════════════════════════ */}
        <Grid item xs={12} md={5}>

          {/* ─ Cliente ─ */}
          <Paper sx={{ p: 2.5, borderRadius: 3, border: '1px solid', borderColor: 'divider', mb: 2 }}>
            <SectionLabel>Cliente (opcional)</SectionLabel>
            <Autocomplete
              options={[CONSUMIDOR_FINAL, ...clientes]}
              getOptionLabel={c => c.nombre || ''}
              value={clienteObj ?? CONSUMIDOR_FINAL}
              onChange={(_, v) => setClienteObj(v ?? CONSUMIDOR_FINAL)}
              isOptionEqualToValue={(opt, val) => (opt.id ?? null) === (val.id ?? null)}
              size="small"
              renderInput={params => <TextField {...params} placeholder="Consumidor final / Otros" />}
            />
          </Paper>

          {/* ─ Trabajador ─ */}
          <Paper sx={{ p: 2.5, borderRadius: 3, border: '1px solid', borderColor: 'divider', mb: 2 }}>
            <SectionLabel>Trabajador</SectionLabel>
            {isAdmin ? (
              <Autocomplete
                options={trabajadores}
                getOptionLabel={t => t.nombre_completo || t.username || ''}
                value={operadorObj}
                onChange={(_, v) => { setOperadorObj(v); setOperadorId(v?.id ?? null); }}
                size="small"
                renderInput={params => <TextField {...params} placeholder="Selecciona un trabajador…" />}
              />
            ) : (
              <Chip
                avatar={
                  <Avatar sx={{ bgcolor: `${ACCENT}25`, color: ACCENT, fontSize: 13, fontWeight: 800 }}>
                    {(user?.nombre_completo || '?')[0]}
                  </Avatar>
                }
                label={user?.nombre_completo || 'Operador'}
                sx={{ fontWeight: 600, bgcolor: `${ACCENT}12` }}
              />
            )}
          </Paper>

          {/* ─ Método de pago ─ */}
          <Paper sx={{ p: 2.5, borderRadius: 3, border: '1px solid', borderColor: 'divider', mb: 2 }}>
            <SectionLabel>Método de pago</SectionLabel>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: metodoPago === 'Efectivo' ? 2 : 0 }}>
              {METODOS_PAGO.map(m => (
                <Chip
                  key={m} label={m}
                  onClick={() => setMetodoPago(m)}
                  sx={{
                    fontWeight: 600, cursor: 'pointer',
                    bgcolor: metodoPago === m ? ACCENT : 'action.hover',
                    color: metodoPago === m ? 'white' : 'text.primary',
                    '&:hover': { bgcolor: metodoPago === m ? '#e6561c' : 'action.selected' },
                    transition: 'all 0.15s',
                  }}
                />
              ))}
            </Box>
            {metodoPago === 'Efectivo' && (
              <Stack spacing={1.5}>
                <CurrencyField label="Valor recibido" value={valorRecibido} onChange={setValorRecibido} size="small" />
                {valorRecibido > 0 && (
                  <Box sx={{
                    p: 1.5, borderRadius: 2,
                    bgcolor: cambio >= 0 ? '#F0FDF4' : '#FEF2F2',
                    border: '1px solid', borderColor: cambio >= 0 ? '#BBF7D0' : '#FECACA',
                  }}>
                    <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 0.2 }}>Cambio a devolver</Typography>
                    <Typography sx={{ fontSize: 22, fontWeight: 900, color: cambio >= 0 ? '#16A34A' : '#DC2626' }}>
                      {formatCurrency(cambio)}
                    </Typography>
                  </Box>
                )}
              </Stack>
            )}
          </Paper>

          {/* ─ Observaciones ─ */}
          <Paper sx={{ p: 2.5, borderRadius: 3, border: '1px solid', borderColor: 'divider', mb: 2 }}>
            <SectionLabel>Observaciones (opcional)</SectionLabel>
            <TextField
              fullWidth multiline rows={2} size="small"
              placeholder="Ej: rayón leve costado derecho, llantas con barro…"
              value={observaciones}
              onChange={e => setObservaciones(e.target.value)}
              InputProps={{
                startAdornment: <InputAdornment position="start"><Notes sx={{ fontSize: 16, color: 'text.disabled', alignSelf: 'flex-start', mt: 0.8 }} /></InputAdornment>,
              }}
            />
          </Paper>

          {/* ─ Submit ─ */}
          <Button
            variant="contained"
            fullWidth size="large"
            onClick={handleSubmit}
            disabled={saving || carrito.length === 0 || !placa.trim()}
            startIcon={saving ? <CircularProgress size={18} color="inherit" /> : <CheckCircle />}
            sx={{
              bgcolor: ACCENT, '&:hover': { bgcolor: '#e6561c' },
              '&:disabled': { bgcolor: 'action.disabledBackground' },
              fontWeight: 800, fontSize: 15, borderRadius: 2.5,
              py: 1.5, textTransform: 'none',
              boxShadow: carrito.length > 0 && placa.trim() ? `0 6px 20px ${ACCENT}40` : 'none',
              transition: 'all 0.2s',
            }}
          >
            {saving ? 'Registrando…' : 'Registrar Lavada'}
          </Button>

          {/* ─ Resumen rápido ─ */}
          {carrito.length > 0 && placa.trim() && (
            <Box sx={{ mt: 1.5, p: 2, borderRadius: 2, bgcolor: `${ACCENT}08`, border: '1px solid', borderColor: `${ACCENT}30` }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                <TipoIcon sx={{ color: ACCENT, fontSize: 18 }} />
                <Typography sx={{ fontWeight: 700, fontSize: 13 }}>
                  {placa.trim().toUpperCase()} · {tipoVehiculo}
                </Typography>
              </Box>
              <Typography sx={{ fontWeight: 900, fontSize: 20, color: ACCENT }}>{formatCurrency(total)}</Typography>
              <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
                {carrito.length} servicio{carrito.length !== 1 ? 's' : ''} · {metodoPago}
              </Typography>
            </Box>
          )}
        </Grid>
      </Grid>

      {/* ── Últimas lavadas ── */}
      <Paper sx={{ p: 2.5, borderRadius: 3, mt: 3, border: '1px solid', borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <CheckCircle sx={{ color: GREEN, fontSize: 18 }} />
          <Typography sx={{ fontWeight: 700, fontSize: 15 }}>Últimas lavadas registradas</Typography>
        </Box>

        {ventas.length === 0 ? (
          <Typography sx={{ color: 'text.secondary', fontSize: 13, textAlign: 'center', py: 2 }}>
            No hay lavadas registradas aún.
          </Typography>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: 'action.hover' }}>
                  {['Placa', 'Tipo', 'Servicios', 'Total', 'Pago', 'Fecha', ''].map(h => (
                    <TableCell key={h} sx={{ fontWeight: 700, fontSize: 11, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.5, py: 1 }}>
                      {h}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {ventas.map((v) => {
                  const TipoIconRow = TIPOS_VEHICULO.find(t => t.label === v.tipo_vehiculo)?.icon ?? DirectionsCar;
                  return (
                    <TableRow key={v.id} hover sx={{ '&:last-child td': { border: 0 } }}>
                      <TableCell>
                        <Typography sx={{ fontFamily: 'monospace', fontWeight: 800, fontSize: 13, letterSpacing: 1.5, color: ACCENT }}>
                          {v.placa_vehiculo}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {v.tipo_vehiculo && (
                          <Tooltip title={v.tipo_vehiculo}>
                            <TipoIconRow sx={{ fontSize: 18, color: 'text.secondary' }} />
                          </Tooltip>
                        )}
                      </TableCell>
                      <TableCell sx={{ color: 'text.secondary', fontSize: 12, maxWidth: 160 }}>
                        <Typography noWrap sx={{ fontSize: 12 }}>
                          {(v.detalles || []).map(d => d.producto?.nombre).filter(Boolean).join(', ') || '—'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography sx={{ fontWeight: 700, fontSize: 13 }}>{formatCurrency(v.total)}</Typography>
                      </TableCell>
                      <TableCell>
                        <Chip label={v.metodo_pago || '—'} size="small" sx={{ fontSize: 10, fontWeight: 700, height: 20 }} />
                      </TableCell>
                      <TableCell sx={{ color: 'text.secondary', fontSize: 12, whiteSpace: 'nowrap' }}>
                        {new Date(v.fecha + (v.fecha?.includes('Z') ? '' : 'Z')).toLocaleString('es-CO', {
                          day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
                        })}
                      </TableCell>
                      <TableCell>
                        <Tooltip title="Usar esta placa">
                          <IconButton size="small" onClick={() => repetirVenta(v)} sx={{ color: ACCENT, p: 0.5 }}>
                            <Replay sx={{ fontSize: 16 }} />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>
    </Box>
  );
}
