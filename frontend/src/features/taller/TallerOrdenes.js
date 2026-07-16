import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Button, Chip, IconButton, CircularProgress, Grid,
  Card, Avatar, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, MenuItem, Divider, Autocomplete, Tabs, Tab, Table, TableBody,
  TableCell, TableHead, TableRow, Alert,
} from '@mui/material';
import {
  Build, DirectionsCar, TwoWheeler, Add, Close, AttachMoney, Engineering,
  Cancel, ArrowForward, Delete, Sell,
} from '@mui/icons-material';
import { alpha, useTheme } from '@mui/material/styles';
import { toast } from 'react-toastify';
import apiClient from '../../api';

const ESTADO_META = {
  recibido:      { label: 'Recibido',      color: '#2563EB' },
  diagnostico:   { label: 'Diagnóstico',   color: '#7C3AED' },
  en_reparacion: { label: 'En reparación', color: '#D97706' },
  listo:         { label: 'Listo',         color: '#059669' },
  entregado:     { label: 'Entregado',     color: '#065F46' },
  vendido:       { label: 'Vendido',       color: '#065F46' },
  cancelado:     { label: 'Cancelado',     color: '#9CA3AF' },
};

const NEXT_ESTADO = {
  recibido: 'diagnostico',
  diagnostico: 'en_reparacion',
  en_reparacion: 'listo',
};

const fmt = (v) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v || 0);

const EstadoChip = ({ estado }) => {
  const meta = ESTADO_META[estado] || { label: estado, color: '#9CA3AF' };
  return (
    <Chip
      label={meta.label}
      size="small"
      sx={{ bgcolor: alpha(meta.color, 0.12), color: meta.color, fontWeight: 700, fontSize: 11 }}
    />
  );
};

// ─── Diálogo: nueva orden (vehículo + orden) ──────────────────────────────
const NuevaOrdenDialog = ({ open, onClose, tipoOrden, clientes, onCreated }) => {
  const [placa, setPlaca] = useState('');
  const [tipo, setTipo] = useState('carro');
  const [marca, setMarca] = useState('');
  const [modelo, setModelo] = useState('');
  const [cliente, setCliente] = useState(null);
  const [descripcion, setDescripcion] = useState('');
  const [precioCompra, setPrecioCompra] = useState('');
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setPlaca(''); setTipo('carro'); setMarca(''); setModelo('');
    setCliente(null); setDescripcion(''); setPrecioCompra('');
  };

  const handleSave = async () => {
    if (!placa.trim()) { toast.warning('La placa es obligatoria'); return; }
    if (tipoOrden === 'remanufactura_reventa' && !precioCompra) {
      toast.warning('Indica el precio de compra del vehículo'); return;
    }
    setSaving(true);
    try {
      const payload = {
        vehiculo: {
          placa: placa.trim().toUpperCase(),
          tipo,
          marca: marca || null,
          modelo: modelo || null,
          origen: tipoOrden === 'remanufactura_reventa' ? 'compra_reventa' : 'cliente',
          cliente_id: cliente?.id || null,
        },
        tipo_orden: tipoOrden,
        descripcion_problema: descripcion || null,
        precio_compra_vehiculo: precioCompra ? Number(precioCompra) : null,
      };
      const res = await apiClient.post('/taller/ordenes', payload);
      toast.success('Orden creada correctamente');
      onCreated(res.data);
      reset();
      onClose();
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Error al crear la orden');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography fontWeight={800}>
          {tipoOrden === 'remanufactura_reventa' ? 'Nuevo vehículo para remanufacturar' : 'Ingresar vehículo a reparación'}
        </Typography>
        <IconButton size="small" onClick={onClose}><Close fontSize="small" /></IconButton>
      </DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
        <Grid container spacing={2}>
          <Grid item xs={7}>
            <TextField label="Placa *" fullWidth value={placa} onChange={(e) => setPlaca(e.target.value.toUpperCase())} />
          </Grid>
          <Grid item xs={5}>
            <TextField select label="Tipo" fullWidth value={tipo} onChange={(e) => setTipo(e.target.value)}>
              <MenuItem value="carro">Carro</MenuItem>
              <MenuItem value="moto">Moto</MenuItem>
            </TextField>
          </Grid>
          <Grid item xs={6}>
            <TextField label="Marca" fullWidth value={marca} onChange={(e) => setMarca(e.target.value)} />
          </Grid>
          <Grid item xs={6}>
            <TextField label="Modelo" fullWidth value={modelo} onChange={(e) => setModelo(e.target.value)} />
          </Grid>
        </Grid>

        {tipoOrden === 'reparacion_cliente' ? (
          <Autocomplete
            options={clientes}
            getOptionLabel={(o) => `${o.nombre}${o.telefono ? ` · ${o.telefono}` : ''}`}
            value={cliente}
            onChange={(_, v) => setCliente(v)}
            renderInput={(params) => <TextField {...params} label="Cliente (dueño del vehículo)" placeholder="Busca por nombre…" />}
          />
        ) : (
          <TextField
            label="Precio de compra del vehículo *" fullWidth type="number"
            value={precioCompra} onChange={(e) => setPrecioCompra(e.target.value)}
            InputProps={{ startAdornment: '$' }}
          />
        )}

        <TextField
          label={tipoOrden === 'remanufactura_reventa' ? 'Notas (opcional)' : 'Motivo de ingreso / falla reportada'}
          fullWidth multiline rows={2}
          value={descripcion} onChange={(e) => setDescripcion(e.target.value)}
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleSave} variant="contained" disabled={saving} fullWidth
          sx={{ borderRadius: 2, fontWeight: 700 }}>
          {saving ? <CircularProgress size={20} color="inherit" /> : 'Crear orden'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ─── Diálogo: detalle de la orden ──────────────────────────────────────────
const DetalleOrdenDialog = ({ open, onClose, orden, productos, mecanicos, onChanged }) => {
  const theme = useTheme();
  const [tipoDetalle, setTipoDetalle] = useState('repuesto');
  const [producto, setProducto] = useState(null);
  const [descripcion, setDescripcion] = useState('');
  const [cantidad, setCantidad] = useState('1');
  const [costoUnitario, setCostoUnitario] = useState('');
  const [addingDetalle, setAddingDetalle] = useState(false);
  const [cerrarOpen, setCerrarOpen] = useState(false);
  const [valorCierre, setValorCierre] = useState('');
  const [metodoPago, setMetodoPago] = useState('Efectivo');
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    setTipoDetalle('repuesto'); setProducto(null); setDescripcion('');
    setCantidad('1'); setCostoUnitario(''); setValorCierre('');
  }, [orden?.id]);

  if (!orden) return null;
  const esReventa = orden.tipo_orden === 'remanufactura_reventa';
  const cerrada = ['entregado', 'vendido', 'cancelado'].includes(orden.estado);

  const handleAgregarDetalle = async () => {
    if (!descripcion.trim() || !costoUnitario) { toast.warning('Completa descripción y costo'); return; }
    setAddingDetalle(true);
    try {
      const res = await apiClient.post(`/taller/ordenes/${orden.id}/detalles`, {
        tipo: tipoDetalle,
        producto_id: tipoDetalle === 'repuesto' ? (producto?.id || null) : null,
        descripcion: descripcion.trim(),
        cantidad: Number(cantidad) || 1,
        costo_unitario: Number(costoUnitario),
      });
      toast.success('Costo agregado');
      onChanged(res.data);
      setProducto(null); setDescripcion(''); setCantidad('1'); setCostoUnitario('');
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Error al agregar el costo');
    } finally {
      setAddingDetalle(false);
    }
  };

  const handleEliminarDetalle = async (detalleId) => {
    try {
      await apiClient.delete(`/taller/ordenes/${orden.id}/detalles/${detalleId}`);
      const res = await apiClient.get(`/taller/ordenes/${orden.id}`);
      onChanged(res.data);
    } catch {
      toast.error('No se pudo eliminar');
    }
  };

  const handleCambiarEstado = async (nuevoEstado) => {
    try {
      const res = await apiClient.patch(`/taller/ordenes/${orden.id}/estado`, { estado: nuevoEstado, notificar_cliente: true });
      toast.success(`Estado actualizado a "${ESTADO_META[nuevoEstado]?.label || nuevoEstado}"`);
      onChanged(res.data);
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'No se pudo cambiar el estado');
    }
  };

  const handleCerrar = async () => {
    if (!valorCierre) { toast.warning('Indica el valor'); return; }
    setClosing(true);
    try {
      const url = esReventa ? `/taller/ordenes/${orden.id}/cerrar-reventa` : `/taller/ordenes/${orden.id}/cerrar-cliente`;
      const payload = esReventa
        ? { precio_venta_final: Number(valorCierre), metodo_pago: metodoPago }
        : { valor_cobrado: Number(valorCierre), metodo_pago: metodoPago };
      const res = await apiClient.post(url, payload);
      toast.success(esReventa ? '¡Vehículo vendido!' : '¡Servicio cobrado y entregado!');
      onChanged(res.data);
      setCerrarOpen(false);
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'No se pudo cerrar la orden');
    } finally {
      setClosing(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
          <Avatar sx={{ bgcolor: alpha('#EA580C', 0.12), color: '#EA580C', width: 40, height: 40 }}>
            {orden.vehiculo?.tipo === 'moto' ? <TwoWheeler /> : <DirectionsCar />}
          </Avatar>
          <Box>
            <Typography fontWeight={800}>{orden.vehiculo?.placa}</Typography>
            <Typography fontSize={12} color="text.secondary">
              {orden.vehiculo?.marca} {orden.vehiculo?.modelo}
            </Typography>
          </Box>
        </Box>
        <IconButton size="small" onClick={onClose}><Close fontSize="small" /></IconButton>
      </DialogTitle>
      <DialogContent sx={{ pt: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <EstadoChip estado={orden.estado} />
          {!cerrada && NEXT_ESTADO[orden.estado] && (
            <Button size="small" endIcon={<ArrowForward />} onClick={() => handleCambiarEstado(NEXT_ESTADO[orden.estado])}
              sx={{ fontWeight: 700 }}>
              Pasar a {ESTADO_META[NEXT_ESTADO[orden.estado]]?.label}
            </Button>
          )}
        </Box>

        {orden.descripcion_problema && (
          <Alert severity="info" sx={{ borderRadius: 2, mb: 2, fontSize: 12.5 }}>{orden.descripcion_problema}</Alert>
        )}

        <Typography sx={{ fontWeight: 700, fontSize: 13, mb: 1 }}>
          {esReventa ? 'Costos de remanufactura' : 'Repuestos y mano de obra'}
        </Typography>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Descripción</TableCell>
              <TableCell align="right">Cant.</TableCell>
              <TableCell align="right">Subtotal</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {esReventa && orden.precio_compra_vehiculo && (
              <TableRow>
                <TableCell sx={{ fontStyle: 'italic', color: 'text.secondary' }}>Compra del vehículo</TableCell>
                <TableCell align="right">—</TableCell>
                <TableCell align="right">{fmt(orden.precio_compra_vehiculo)}</TableCell>
                <TableCell />
              </TableRow>
            )}
            {(orden.detalles || []).map((d) => (
              <TableRow key={d.id}>
                <TableCell sx={{ fontSize: 12.5 }}>{d.descripcion}</TableCell>
                <TableCell align="right" sx={{ fontSize: 12.5 }}>{d.cantidad}</TableCell>
                <TableCell align="right" sx={{ fontSize: 12.5, fontWeight: 700 }}>{fmt(d.subtotal)}</TableCell>
                <TableCell align="right">
                  {!cerrada && (
                    <IconButton size="small" onClick={() => handleEliminarDetalle(d.id)}>
                      <Delete sx={{ fontSize: 14 }} />
                    </IconButton>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {!(orden.detalles || []).length && !orden.precio_compra_vehiculo && (
              <TableRow><TableCell colSpan={4} sx={{ color: 'text.disabled', fontSize: 12 }}>Sin costos registrados aún</TableCell></TableRow>
            )}
          </TableBody>
        </Table>

        {!cerrada && (
          <Box sx={{ mt: 1.5, p: 1.5, borderRadius: 2, bgcolor: alpha(theme.palette.text.primary, 0.03) }}>
            <Grid container spacing={1} alignItems="center">
              <Grid item xs={12} sm={3}>
                <TextField select size="small" fullWidth label="Tipo" value={tipoDetalle} onChange={(e) => setTipoDetalle(e.target.value)}>
                  <MenuItem value="repuesto">Repuesto</MenuItem>
                  <MenuItem value="mano_obra">Mano de obra</MenuItem>
                  <MenuItem value="servicio_externo">Servicio externo</MenuItem>
                </TextField>
              </Grid>
              <Grid item xs={12} sm={5}>
                {tipoDetalle === 'repuesto' ? (
                  <Autocomplete
                    size="small"
                    options={productos}
                    getOptionLabel={(o) => o.nombre}
                    value={producto}
                    onChange={(_, v) => { setProducto(v); setDescripcion(v?.nombre || ''); if (v?.costo) setCostoUnitario(String(v.costo)); }}
                    renderInput={(params) => <TextField {...params} label="Repuesto" />}
                  />
                ) : (
                  <TextField size="small" fullWidth label="Descripción" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
                )}
              </Grid>
              <Grid item xs={4} sm={1.5}>
                <TextField size="small" fullWidth label="Cant." type="number" value={cantidad} onChange={(e) => setCantidad(e.target.value)} />
              </Grid>
              <Grid item xs={5} sm={2}>
                <TextField size="small" fullWidth label="Costo c/u" type="number" value={costoUnitario} onChange={(e) => setCostoUnitario(e.target.value)} />
              </Grid>
              <Grid item xs={3} sm={0.5}>
                <IconButton onClick={handleAgregarDetalle} disabled={addingDetalle} sx={{ color: '#EA580C' }}>
                  <Add />
                </IconButton>
              </Grid>
            </Grid>
            {tipoDetalle === 'repuesto' && (
              <Typography sx={{ fontSize: 10.5, color: 'text.secondary', mt: 0.5 }}>
                Al agregar un repuesto de inventario se descuenta su stock automáticamente.
              </Typography>
            )}
          </Box>
        )}

        <Divider sx={{ my: 2 }} />
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
          <Typography fontWeight={700}>Costo acumulado</Typography>
          <Typography fontWeight={900} color="#EA580C">{fmt(orden.costo_acumulado)}</Typography>
        </Box>
        {orden.margen != null && (
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography fontWeight={700}>{esReventa ? 'Margen (vendido)' : 'Margen (cobrado)'}</Typography>
            <Typography fontWeight={900} color={orden.margen >= 0 ? '#059669' : '#EF4444'}>{fmt(orden.margen)}</Typography>
          </Box>
        )}

        {orden.venta_id && (
          <Alert severity="success" sx={{ borderRadius: 2, mt: 2, fontSize: 12 }}>
            ✅ Venta #{orden.venta_id} registrada — visible en Caja y Reportes.
          </Alert>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        {orden.estado === 'listo' && !cerrada && (
          <Button
            fullWidth variant="contained" startIcon={esReventa ? <Sell /> : <AttachMoney />}
            onClick={() => { setValorCierre(esReventa ? String(orden.precio_venta_sugerido || '') : ''); setCerrarOpen(true); }}
            sx={{ bgcolor: '#059669', '&:hover': { bgcolor: '#047857' }, borderRadius: 2, fontWeight: 700 }}
          >
            {esReventa ? 'Vender vehículo' : 'Cobrar y entregar'}
          </Button>
        )}
        {!cerrada && orden.estado !== 'cancelado' && (
          <Button color="error" startIcon={<Cancel />} onClick={() => handleCambiarEstado('cancelado')}>
            Cancelar
          </Button>
        )}
      </DialogActions>

      <Dialog open={cerrarOpen} onClose={() => setCerrarOpen(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle>{esReventa ? 'Vender vehículo' : 'Cobrar y entregar'}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <TextField
            label={esReventa ? 'Precio de venta final' : 'Valor a cobrar'} type="number" fullWidth
            value={valorCierre} onChange={(e) => setValorCierre(e.target.value)}
            InputProps={{ startAdornment: '$' }}
          />
          <TextField select label="Método de pago" fullWidth value={metodoPago} onChange={(e) => setMetodoPago(e.target.value)}>
            {['Efectivo', 'Transferencia', 'Nequi', 'Daviplata', 'Tarjeta'].map((m) => <MenuItem key={m} value={m}>{m}</MenuItem>)}
          </TextField>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button fullWidth variant="contained" onClick={handleCerrar} disabled={closing}
            sx={{ bgcolor: '#059669', '&:hover': { bgcolor: '#047857' }, borderRadius: 2, fontWeight: 700 }}>
            {closing ? <CircularProgress size={20} color="inherit" /> : 'Confirmar'}
          </Button>
        </DialogActions>
      </Dialog>
    </Dialog>
  );
};

// ─── Página principal ──────────────────────────────────────────────────────
const TallerOrdenes = () => {
  const [tab, setTab] = useState('reparacion_cliente');
  const [estadoFiltro, setEstadoFiltro] = useState('todos');
  const [ordenes, setOrdenes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [clientes, setClientes] = useState([]);
  const [productos, setProductos] = useState([]);
  const [nuevaOpen, setNuevaOpen] = useState(false);
  const [selectedOrden, setSelectedOrden] = useState(null);

  const fetchOrdenes = useCallback(async () => {
    setLoading(true);
    try {
      const params = { tipo_orden: tab };
      if (estadoFiltro !== 'todos') params.estado = estadoFiltro;
      const res = await apiClient.get('/taller/ordenes', { params });
      setOrdenes(res.data || []);
    } catch {
      toast.error('No se pudieron cargar las órdenes del taller');
    } finally {
      setLoading(false);
    }
  }, [tab, estadoFiltro]);

  useEffect(() => { fetchOrdenes(); }, [fetchOrdenes]);

  useEffect(() => {
    apiClient.get('/taller/stats').then((r) => setStats(r.data)).catch(() => {});
    apiClient.get('/clientes/', { params: { limit: 500 } }).then((r) => setClientes(r.data || [])).catch(() => {});
    apiClient.get('/productos/', { params: { limit: 500 } }).then((r) => setProductos(r.data || [])).catch(() => {});
  }, []);

  const refreshOne = (updated) => {
    setSelectedOrden(updated);
    setOrdenes((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
    apiClient.get('/taller/stats').then((r) => setStats(r.data)).catch(() => {});
  };

  const esReventaTab = tab === 'remanufactura_reventa';

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, flexWrap: 'wrap', gap: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Avatar sx={{ bgcolor: alpha('#EA580C', 0.12), color: '#EA580C' }}><Build /></Avatar>
          <Box>
            <Typography variant="h6" fontWeight={800}>Taller de Mecánica</Typography>
            <Typography fontSize={12.5} color="text.secondary">Reparaciones y remanufactura de vehículos</Typography>
          </Box>
        </Box>
        <Button variant="contained" startIcon={<Add />} onClick={() => setNuevaOpen(true)}
          sx={{ bgcolor: '#EA580C', '&:hover': { bgcolor: '#C2410C' }, borderRadius: 2, fontWeight: 700 }}>
          {esReventaTab ? 'Nuevo vehículo' : 'Ingresar vehículo'}
        </Button>
      </Box>

      {stats && (
        <Grid container spacing={1.5} sx={{ mb: 2 }}>
          {[
            { label: 'Órdenes activas', value: stats.ordenes_activas, color: '#2563EB' },
            { label: 'En reparación (cliente)', value: stats.vehiculos_en_reparacion, color: '#D97706' },
            { label: 'En remanufactura', value: stats.vehiculos_en_reventa, color: '#7C3AED' },
            { label: 'Ingresos servicio (mes)', value: fmt(stats.ingresos_servicios_mes), color: '#059669' },
            { label: 'Margen reventa (mes)', value: fmt(stats.margen_reventa_mes), color: stats.margen_reventa_mes >= 0 ? '#059669' : '#EF4444' },
          ].map((s) => (
            <Grid item xs={6} md key={s.label}>
              <Card variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
                <Typography fontSize={11} color="text.secondary">{s.label}</Typography>
                <Typography fontWeight={800} fontSize={17} color={s.color}>{s.value}</Typography>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 1 }}>
        <Tab value="reparacion_cliente" label="Reparación a cliente" />
        <Tab value="remanufactura_reventa" label="Remanufactura y reventa" />
      </Tabs>

      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
        {['todos', ...Object.keys(ESTADO_META)].map((e) => (
          <Chip
            key={e}
            label={e === 'todos' ? 'Todos' : ESTADO_META[e].label}
            onClick={() => setEstadoFiltro(e)}
            sx={{
              fontWeight: 700, cursor: 'pointer',
              bgcolor: estadoFiltro === e ? '#EA580C' : 'action.hover',
              color: estadoFiltro === e ? '#fff' : 'text.secondary',
            }}
          />
        ))}
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
      ) : ordenes.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 6, color: 'text.secondary' }}>
          <Build sx={{ fontSize: 40, opacity: 0.3, mb: 1 }} />
          <Typography>No hay órdenes {estadoFiltro !== 'todos' ? `en estado "${ESTADO_META[estadoFiltro]?.label}"` : ''}</Typography>
        </Box>
      ) : (
        <Grid container spacing={2}>
          {ordenes.map((orden) => (
            <Grid item xs={12} sm={6} md={4} key={orden.id}>
              <Card
                variant="outlined"
                onClick={() => setSelectedOrden(orden)}
                sx={{
                  p: 2, borderRadius: 3, cursor: 'pointer', height: '100%',
                  borderLeft: `4px solid ${ESTADO_META[orden.estado]?.color || '#9CA3AF'}`,
                  transition: 'transform 0.15s', '&:hover': { transform: 'translateY(-2px)' },
                }}
              >
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {orden.vehiculo?.tipo === 'moto' ? <TwoWheeler sx={{ color: '#EA580C' }} /> : <DirectionsCar sx={{ color: '#EA580C' }} />}
                    <Box>
                      <Typography fontWeight={800}>{orden.vehiculo?.placa}</Typography>
                      <Typography fontSize={11.5} color="text.secondary">
                        {orden.vehiculo?.marca} {orden.vehiculo?.modelo}
                      </Typography>
                    </Box>
                  </Box>
                  <EstadoChip estado={orden.estado} />
                </Box>
                {orden.mecanico_nombre && (
                  <Typography sx={{ fontSize: 11.5, color: 'text.secondary', mt: 1, display: 'flex', alignItems: 'center', gap: 0.4 }}>
                    <Engineering sx={{ fontSize: 13 }} /> {orden.mecanico_nombre}
                  </Typography>
                )}
                <Divider sx={{ my: 1.2 }} />
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography fontSize={11.5} color="text.secondary">Costo acumulado</Typography>
                  <Typography fontWeight={800} fontSize={13}>{fmt(orden.costo_acumulado)}</Typography>
                </Box>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      <NuevaOrdenDialog
        open={nuevaOpen} onClose={() => setNuevaOpen(false)} tipoOrden={tab}
        clientes={clientes} onCreated={() => fetchOrdenes()}
      />
      <DetalleOrdenDialog
        open={!!selectedOrden} onClose={() => setSelectedOrden(null)}
        orden={selectedOrden} productos={productos} mecanicos={[]}
        onChanged={refreshOne}
      />
    </Box>
  );
};

export default TallerOrdenes;
