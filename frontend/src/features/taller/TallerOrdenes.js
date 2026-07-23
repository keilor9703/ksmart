import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box, Typography, Button, Chip, IconButton, CircularProgress, Grid,
  Card, Avatar, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, MenuItem, Divider, Autocomplete, Tabs, Tab, Table, TableBody,
  TableCell, TableHead, TableRow, Alert, InputAdornment, Tooltip, Badge, Stack,
} from '@mui/material';
import {
  Build, DirectionsCar, TwoWheeler, Add, Close, AttachMoney, Engineering,
  Cancel, ArrowForward, Delete, Sell, Info, Warning, CheckCircle,
  RadioButtonUnchecked, PlayCircleFilled, CalculateOutlined,
} from '@mui/icons-material';
import { alpha, useTheme } from '@mui/material/styles';
import { toast } from 'react-toastify';
import apiClient from '../../api';
import CurrencyField from '../../components/common/CurrencyField';
import { BRAND_OPTIONS, getModelOptions } from '../parking/vehicleBrands';

// Un solo lugar con el flujo de estados por tipo de orden — la Kanban y el
// stepper del detalle se generan a partir de esto, así que agregar un paso
// nuevo el día de mañana no implica tocar el layout en dos sitios distintos.
const FLUJO_COLUMNAS = {
  reparacion_cliente:     ['recibido', 'diagnostico', 'en_reparacion', 'listo', 'entregado'],
  remanufactura_reventa:  ['recibido', 'diagnostico', 'en_reparacion', 'listo', 'vendido'],
};

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

const EstadoChip = ({ estado, size = 'small' }) => {
  const meta = ESTADO_META[estado] || { label: estado, color: '#9CA3AF' };
  return (
    <Chip
      label={meta.label}
      size={size}
      sx={{ bgcolor: alpha(meta.color, 0.12), color: meta.color, fontWeight: 700, fontSize: size === 'small' ? 11 : 12 }}
    />
  );
};

// ─── Diálogo de confirmación genérico (para "Cancelar orden") ─────────────
const ConfirmDialog = ({ open, onClose, onConfirm, title, message, confirmLabel = 'Confirmar', loading }) => (
  <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
    <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <Warning sx={{ color: '#EF4444' }} /> {title}
    </DialogTitle>
    <DialogContent>
      <Typography fontSize={13.5} color="text.secondary">{message}</Typography>
    </DialogContent>
    <DialogActions sx={{ px: 3, pb: 2 }}>
      <Button onClick={onClose} sx={{ color: 'text.secondary' }}>Volver</Button>
      <Button onClick={onConfirm} variant="contained" color="error" disabled={loading} sx={{ borderRadius: 2, fontWeight: 700 }}>
        {loading ? <CircularProgress size={18} color="inherit" /> : confirmLabel}
      </Button>
    </DialogActions>
  </Dialog>
);

// ─── Diálogo: nueva orden (vehículo + orden) ──────────────────────────────
const NuevaOrdenDialog = ({ open, onClose, tipoOrden, clientes, onCreated }) => {
  const [placa, setPlaca] = useState('');
  const [tipo, setTipo] = useState('carro');
  const [marca, setMarca] = useState('');
  const [linea, setLinea] = useState('');
  const [anio, setAnio] = useState('');
  const [cliente, setCliente] = useState(null);
  const [descripcion, setDescripcion] = useState('');
  const [precioCompra, setPrecioCompra] = useState(null);
  const [saving, setSaving] = useState(false);

  const modelOptions = useMemo(() => getModelOptions(marca), [marca]);

  const reset = () => {
    setPlaca(''); setTipo('carro'); setMarca(''); setLinea(''); setAnio('');
    setCliente(null); setDescripcion(''); setPrecioCompra(null);
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
          modelo: linea || null,
          anio: anio ? Number(anio) : null,
          origen: tipoOrden === 'remanufactura_reventa' ? 'compra_reventa' : 'cliente',
          cliente_id: cliente?.id || null,
        },
        tipo_orden: tipoOrden,
        descripcion_problema: descripcion || null,
        precio_compra_vehiculo: precioCompra || null,
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
        <Stack spacing={1.5}>
          <TextField
            fullWidth label="Placa *" value={placa}
            onChange={(e) => setPlaca(e.target.value.toUpperCase().replace(/[\s-]/g, '').slice(0, 10))}
            inputProps={{ style: { fontFamily: 'monospace', fontWeight: 700, letterSpacing: 2 } }}
          />

          <Stack direction="row" spacing={1.5}>
            <TextField select label="Tipo" sx={{ flex: 1 }} value={tipo} onChange={(e) => { setTipo(e.target.value); setMarca(''); setLinea(''); }}>
              <MenuItem value="carro">Carro</MenuItem>
              <MenuItem value="moto">Moto</MenuItem>
            </TextField>
            <TextField
              label="Año" sx={{ flex: 1 }} type="number" value={anio}
              onChange={(e) => setAnio(e.target.value)}
              inputProps={{ min: 1970, max: new Date().getFullYear() + 1 }}
            />
          </Stack>

          <Stack direction="row" spacing={1.5}>
            {/* Marca — mismo patrón que Parqueadero: freeSolo, filtra la Línea */}
            <Autocomplete
              sx={{ flex: 1 }}
              freeSolo
              options={BRAND_OPTIONS}
              value={marca}
              inputValue={marca}
              onInputChange={(_, v) => setMarca(v)}
              onChange={(_, v) => { setMarca(v || ''); setLinea(''); }}
              renderInput={(params) => <TextField {...params} label="Marca" placeholder="Ej: Toyota, Yamaha…" />}
            />
            {/* Línea — filtrada por la marca elegida, igual que Parqueadero */}
            <Autocomplete
              sx={{ flex: 1 }}
              freeSolo
              options={modelOptions}
              value={linea}
              inputValue={linea}
              onInputChange={(_, v) => setLinea(v)}
              onChange={(_, v) => setLinea(v || '')}
              noOptionsText={marca ? 'Sin líneas para esta marca' : 'Selecciona una marca primero'}
              renderInput={(params) => <TextField {...params} label="Línea" placeholder="Ej: Corolla, FZ 150…" />}
            />
          </Stack>
        </Stack>

        {tipoOrden === 'reparacion_cliente' ? (
          <Autocomplete
            options={clientes}
            getOptionLabel={(o) => `${o.nombre}${o.telefono ? ` · ${o.telefono}` : ''}`}
            value={cliente}
            onChange={(_, v) => setCliente(v)}
            renderInput={(params) => <TextField {...params} label="Cliente (dueño del vehículo)" placeholder="Busca por nombre…" />}
          />
        ) : (
          <CurrencyField
            label="Precio de compra del vehículo *"
            value={precioCompra}
            onChange={setPrecioCompra}
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

// ─── Sub-diálogo de cierre: cobrar (cliente) o vender (reventa), con
//     calculadora de margen bidireccional para la reventa ─────────────────
const CerrarOrdenDialog = ({ open, onClose, orden, esReventa, clientes, onClosed }) => {
  const costoBase = orden?.costo_acumulado || 0;
  // ── Servicio a cliente (flujo simple, sin cambios) ──
  const [valor, setValor] = useState(null);
  const [metodoPago, setMetodoPago] = useState('Efectivo');
  // ── Venta de vehículo remanufacturado (pago mixto) ──
  const [valorTotal, setValorTotal] = useState(null);
  const [margenPct, setMargenPct] = useState('');
  const [metodoPagoEfectivo, setMetodoPagoEfectivo] = useState('Efectivo');
  const [tieneCredito, setTieneCredito] = useState(false);
  const [montoCredito, setMontoCredito] = useState(null);
  const [compradorCredito, setCompradorCredito] = useState(null);
  const [tienePermuta, setTienePermuta] = useState(false);
  const [permutaValor, setPermutaValor] = useState(null);
  const [permutaPlaca, setPermutaPlaca] = useState('');
  const [permutaTipo, setPermutaTipo] = useState('carro');
  const [permutaMarca, setPermutaMarca] = useState('');
  const [permutaLinea, setPermutaLinea] = useState('');
  const [permutaAnio, setPermutaAnio] = useState('');
  const [permutaColor, setPermutaColor] = useState('');
  const [closing, setClosing] = useState(false);
  const [linkPagosConfig, setLinkPagosConfig] = useState([]);

  // Solo Efectivo viene fijo — el resto son los links de pago que la empresa
  // configure en Mi Cuenta → Link de Pago.
  const metodosPago = ['Efectivo', ...linkPagosConfig.map(l => `Link de Pago: ${l.nombre}`)];

  useEffect(() => {
    apiClient.get('/empresa/link-pago/activos').then(r => setLinkPagosConfig(r.data || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (!open || !orden) return;
    setValor(null);
    setMetodoPago('Efectivo');
    setValorTotal(orden.precio_venta_sugerido || null);
    setMargenPct('');
    setMetodoPagoEfectivo('Efectivo');
    setTieneCredito(false); setMontoCredito(null); setCompradorCredito(null);
    setTienePermuta(false); setPermutaValor(null);
    setPermutaPlaca(''); setPermutaTipo('carro'); setPermutaMarca(''); setPermutaLinea('');
    setPermutaAnio(''); setPermutaColor('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, orden?.id]);

  if (!orden) return null;

  const utilidad = valor != null ? valor - costoBase : null;

  const handleMargenChange = (raw) => {
    setMargenPct(raw);
    const pct = Number(raw);
    if (raw !== '' && !isNaN(pct) && costoBase > 0) {
      setValorTotal(Math.round(costoBase * (1 + pct / 100)));
    }
  };

  const handleValorTotalChange = (num) => {
    setValorTotal(num);
    if (num != null && costoBase > 0) {
      setMargenPct((((num - costoBase) / costoBase) * 100).toFixed(1));
    }
  };

  // Efectivo = lo que sobra del total una vez descontado crédito y permuta —
  // así el dueño solo reparte lo que NO es efectivo, y el resto se calcula solo.
  const creditoNum = tieneCredito ? (montoCredito || 0) : 0;
  const permutaNum = tienePermuta ? (permutaValor || 0) : 0;
  const efectivoCalculado = valorTotal != null ? Math.max(0, valorTotal - creditoNum - permutaNum) : null;
  const excedeTotal = valorTotal != null && (creditoNum + permutaNum) > valorTotal;
  const utilidadReventa = valorTotal != null ? valorTotal - costoBase : null;

  const permutaCompleta = !tienePermuta || (permutaPlaca && permutaMarca && permutaLinea && permutaAnio && permutaColor);

  const handleCerrarCliente = async () => {
    if (!valor) { toast.warning('Indica el valor'); return; }
    setClosing(true);
    try {
      const res = await apiClient.post(`/taller/ordenes/${orden.id}/cerrar-cliente`, { valor_cobrado: valor, metodo_pago: metodoPago });
      toast.success('¡Servicio cobrado y entregado!');
      onClosed(res.data);
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'No se pudo cerrar la orden');
    } finally {
      setClosing(false);
    }
  };

  const handleCerrarReventa = async () => {
    if (!valorTotal) { toast.warning('Indica el precio de venta'); return; }
    if (excedeTotal) { toast.warning('El crédito + la permuta no pueden superar el precio de venta'); return; }
    if (tieneCredito && !compradorCredito) { toast.warning('Indica el cliente comprador para la cuenta por cobrar'); return; }
    if (tienePermuta && !permutaCompleta) { toast.warning('Completa los datos del vehículo recibido en permuta'); return; }
    setClosing(true);
    try {
      const payload = {
        monto_efectivo: efectivoCalculado || 0,
        metodo_pago_efectivo: metodoPagoEfectivo,
        monto_credito: creditoNum,
        comprador_cliente_id: compradorCredito?.id || null,
        permuta_valor: permutaNum,
        permuta_vehiculo: tienePermuta ? {
          placa: permutaPlaca.trim().toUpperCase(), tipo: permutaTipo,
          marca: permutaMarca, modelo: permutaLinea, anio: permutaAnio ? Number(permutaAnio) : null,
          color: permutaColor, origen: 'compra_reventa',
        } : null,
      };
      const res = await apiClient.post(`/taller/ordenes/${orden.id}/cerrar-reventa`, payload);
      toast.success('¡Vehículo vendido!');
      onClosed(res.data);
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'No se pudo cerrar la orden');
    } finally {
      setClosing(false);
    }
  };

  if (!esReventa) {
    return (
      <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          Cobrar y entregar
          <IconButton size="small" onClick={onClose}><Close fontSize="small" /></IconButton>
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', p: 1.2, borderRadius: 2, bgcolor: 'action.hover' }}>
            <Typography fontSize={12.5} color="text.secondary">Costo acumulado</Typography>
            <Typography fontWeight={800} fontSize={13}>{fmt(costoBase)}</Typography>
          </Box>
          <CurrencyField label="Valor a cobrar" value={valor} onChange={setValor} />
          {valor != null && costoBase > 0 && (
            <Alert severity={utilidad >= 0 ? 'success' : 'error'} icon={<CalculateOutlined />} sx={{ borderRadius: 2, fontSize: 12.5 }}>
              Margen: <strong>{(((valor - costoBase) / costoBase) * 100).toFixed(1)}%</strong> · Utilidad: <strong>{fmt(utilidad)}</strong>
            </Alert>
          )}
          <TextField select label="Método de pago" fullWidth value={metodoPago} onChange={(e) => setMetodoPago(e.target.value)}>
            {metodosPago.map((m) => <MenuItem key={m} value={m}>{m}</MenuItem>)}
          </TextField>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button fullWidth variant="contained" onClick={handleCerrarCliente} disabled={closing}
            sx={{ bgcolor: '#059669', '&:hover': { bgcolor: '#047857' }, borderRadius: 2, fontWeight: 700 }}>
            {closing ? <CircularProgress size={20} color="inherit" /> : 'Confirmar'}
          </Button>
        </DialogActions>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        Vender vehículo
        <IconButton size="small" onClick={onClose}><Close fontSize="small" /></IconButton>
      </DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', p: 1.2, borderRadius: 2, bgcolor: 'action.hover' }}>
          <Typography fontSize={12.5} color="text.secondary">Costo acumulado</Typography>
          <Typography fontWeight={800} fontSize={13}>{fmt(costoBase)}</Typography>
        </Box>

        <TextField
          label="Margen de ganancia deseado" type="number" fullWidth
          value={margenPct} onChange={(e) => handleMargenChange(e.target.value)}
          helperText="Calcula el precio de venta sugerido a partir del costo — o ajusta el precio abajo y el margen se recalcula solo."
          InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }}
        />
        <CurrencyField label="Precio de venta total" value={valorTotal} onChange={handleValorTotalChange} />
        {valorTotal != null && costoBase > 0 && (
          <Alert severity={utilidadReventa >= 0 ? 'success' : 'error'} icon={<CalculateOutlined />} sx={{ borderRadius: 2, fontSize: 12.5 }}>
            Margen: <strong>{(((valorTotal - costoBase) / costoBase) * 100).toFixed(1)}%</strong> · Utilidad: <strong>{fmt(utilidadReventa)}</strong>
          </Alert>
        )}

        <Divider />
        <Typography sx={{ fontWeight: 700, fontSize: 12, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.5 }}>
          ¿Cómo se paga?
        </Typography>

        {/* Crédito */}
        <Box sx={{ p: 1.2, borderRadius: 2, border: '1px solid', borderColor: tieneCredito ? '#F59E0B' : 'divider' }}>
          <Button
            fullWidth size="small" onClick={() => setTieneCredito((v) => !v)}
            sx={{ justifyContent: 'flex-start', textTransform: 'none', fontWeight: 700, color: tieneCredito ? '#F59E0B' : 'text.secondary' }}
          >
            {tieneCredito ? '☑' : '☐'}&nbsp; Parte queda a crédito (cuenta por cobrar)
          </Button>
          {tieneCredito && (
            <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 1.2 }}>
              <CurrencyField label="Monto a crédito" value={montoCredito} onChange={setMontoCredito} />
              <Autocomplete
                options={clientes || []}
                getOptionLabel={(o) => `${o.nombre}${o.telefono ? ` · ${o.telefono}` : ''}`}
                value={compradorCredito}
                onChange={(_, v) => setCompradorCredito(v)}
                renderInput={(params) => <TextField {...params} label="Cliente comprador *" placeholder="Busca por nombre…" />}
              />
            </Box>
          )}
        </Box>

        {/* Permuta */}
        <Box sx={{ p: 1.2, borderRadius: 2, border: '1px solid', borderColor: tienePermuta ? '#7C3AED' : 'divider' }}>
          <Button
            fullWidth size="small" onClick={() => setTienePermuta((v) => !v)}
            sx={{ justifyContent: 'flex-start', textTransform: 'none', fontWeight: 700, color: tienePermuta ? '#7C3AED' : 'text.secondary' }}
          >
            {tienePermuta ? '☑' : '☐'}&nbsp; Recibo otro vehículo en permuta
          </Button>
          {tienePermuta && (
            <Stack spacing={1.2} sx={{ mt: 1 }}>
              <CurrencyField label="Valor asignado a la permuta" value={permutaValor} onChange={setPermutaValor} />
              <TextField
                fullWidth size="small" label="Placa del vehículo recibido *" value={permutaPlaca}
                onChange={(e) => setPermutaPlaca(e.target.value.toUpperCase().replace(/[\s-]/g, '').slice(0, 10))}
                inputProps={{ style: { fontFamily: 'monospace', fontWeight: 700, letterSpacing: 2 } }}
              />
              <Stack direction="row" spacing={1}>
                <TextField select size="small" label="Tipo" sx={{ flex: 1 }} value={permutaTipo}
                  onChange={(e) => { setPermutaTipo(e.target.value); setPermutaMarca(''); setPermutaLinea(''); }}>
                  <MenuItem value="carro">Carro</MenuItem>
                  <MenuItem value="moto">Moto</MenuItem>
                </TextField>
                <TextField size="small" label="Año *" sx={{ flex: 1 }} type="number" value={permutaAnio} onChange={(e) => setPermutaAnio(e.target.value)} />
              </Stack>
              <Stack direction="row" spacing={1}>
                <Autocomplete
                  size="small" sx={{ flex: 1 }} freeSolo options={BRAND_OPTIONS}
                  value={permutaMarca} inputValue={permutaMarca}
                  onInputChange={(_, v) => setPermutaMarca(v)}
                  onChange={(_, v) => { setPermutaMarca(v || ''); setPermutaLinea(''); }}
                  renderInput={(params) => <TextField {...params} label="Marca *" />}
                />
                <Autocomplete
                  size="small" sx={{ flex: 1 }} freeSolo options={getModelOptions(permutaMarca)}
                  value={permutaLinea} inputValue={permutaLinea}
                  onInputChange={(_, v) => setPermutaLinea(v)}
                  onChange={(_, v) => setPermutaLinea(v || '')}
                  renderInput={(params) => <TextField {...params} label="Línea *" />}
                />
              </Stack>
              <TextField size="small" fullWidth label="Color *" value={permutaColor} onChange={(e) => setPermutaColor(e.target.value)} />
            </Stack>
          )}
        </Box>

        {/* Efectivo — se calcula solo con lo que sobra */}
        <Box sx={{
          p: 1.2, borderRadius: 2, bgcolor: alpha('#059669', 0.08), border: '1px solid', borderColor: alpha('#059669', 0.3),
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <Typography fontSize={12.5} fontWeight={700} color="text.secondary">Efectivo a recibir</Typography>
          <Typography fontWeight={900} fontSize={15} color="#059669">{fmt(efectivoCalculado)}</Typography>
        </Box>
        {excedeTotal && (
          <Alert severity="error" sx={{ borderRadius: 2, fontSize: 12 }}>El crédito + la permuta superan el precio de venta total.</Alert>
        )}
        {efectivoCalculado > 0 && (
          <TextField select size="small" label="Método de pago del efectivo" fullWidth value={metodoPagoEfectivo} onChange={(e) => setMetodoPagoEfectivo(e.target.value)}>
            {metodosPago.map((m) => <MenuItem key={m} value={m}>{m}</MenuItem>)}
          </TextField>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button fullWidth variant="contained" onClick={handleCerrarReventa} disabled={closing || excedeTotal}
          sx={{ bgcolor: '#059669', '&:hover': { bgcolor: '#047857' }, borderRadius: 2, fontWeight: 700 }}>
          {closing ? <CircularProgress size={20} color="inherit" /> : 'Confirmar venta'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ─── Diálogo: detalle de la orden ──────────────────────────────────────────
const DetalleOrdenDialog = ({ open, onClose, orden, productos, clientes, onChanged }) => {
  const theme = useTheme();
  const [tipoDetalle, setTipoDetalle] = useState('repuesto');
  const [producto, setProducto] = useState(null);
  const [descripcion, setDescripcion] = useState('');
  const [cantidad, setCantidad] = useState('1');
  const [costoUnitario, setCostoUnitario] = useState(null);
  const [addingDetalle, setAddingDetalle] = useState(false);
  const [cerrarOpen, setCerrarOpen] = useState(false);
  const [cancelarOpen, setCancelarOpen] = useState(false);
  const [cancelando, setCancelando] = useState(false);

  useEffect(() => {
    setTipoDetalle('repuesto'); setProducto(null); setDescripcion('');
    setCantidad('1'); setCostoUnitario(null);
  }, [orden?.id]);

  if (!orden) return null;
  const esReventa = orden.tipo_orden === 'remanufactura_reventa';
  const cerrada = ['entregado', 'vendido', 'cancelado'].includes(orden.estado);
  const columnas = FLUJO_COLUMNAS[orden.tipo_orden] || FLUJO_COLUMNAS.reparacion_cliente;
  const pasoActualIdx = columnas.indexOf(orden.estado);

  const handleAgregarDetalle = async () => {
    if (!descripcion.trim() || !costoUnitario) { toast.warning('Completa descripción y costo'); return; }
    setAddingDetalle(true);
    try {
      const res = await apiClient.post(`/taller/ordenes/${orden.id}/detalles`, {
        tipo: tipoDetalle,
        producto_id: tipoDetalle === 'repuesto' ? (producto?.id || null) : null,
        descripcion: descripcion.trim(),
        cantidad: Number(cantidad) || 1,
        costo_unitario: costoUnitario,
      });
      toast.success('Costo agregado');
      onChanged(res.data);
      setProducto(null); setDescripcion(''); setCantidad('1'); setCostoUnitario(null);
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

  const handleConfirmarCancelar = async () => {
    setCancelando(true);
    try {
      const res = await apiClient.patch(`/taller/ordenes/${orden.id}/estado`, { estado: 'cancelado', notificar_cliente: false });
      toast.success('Orden cancelada');
      onChanged(res.data);
      setCancelarOpen(false);
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'No se pudo cancelar');
    } finally {
      setCancelando(false);
    }
  };

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
            <Avatar sx={{ bgcolor: alpha('#EA580C', 0.12), color: '#EA580C', width: 40, height: 40 }}>
              {orden.vehiculo?.tipo === 'moto' ? <TwoWheeler /> : <DirectionsCar />}
            </Avatar>
            <Box>
              <Typography fontWeight={800}>{orden.vehiculo?.placa}</Typography>
              <Typography fontSize={12} color="text.secondary">
                {[orden.vehiculo?.marca, orden.vehiculo?.modelo, orden.vehiculo?.anio].filter(Boolean).join(' · ')}
              </Typography>
            </Box>
          </Box>
          <IconButton size="small" onClick={onClose}><Close fontSize="small" /></IconButton>
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {/* ── Progreso de la orden — deja clarísimo en qué paso va y cuál sigue ── */}
          {!cerrada ? (
            <Box sx={{ mb: 2.5 }}>
              <Typography sx={{ fontWeight: 700, fontSize: 11, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.5, mb: 1 }}>
                Etapa actual
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1.5 }}>
                {columnas.map((col, i) => (
                  <React.Fragment key={col}>
                    <Tooltip title={ESTADO_META[col].label}>
                      <Box sx={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.4, flex: 1,
                      }}>
                        {i < pasoActualIdx
                          ? <CheckCircle sx={{ fontSize: 20, color: ESTADO_META[col].color }} />
                          : i === pasoActualIdx
                            ? <PlayCircleFilled sx={{ fontSize: 20, color: ESTADO_META[col].color }} />
                            : <RadioButtonUnchecked sx={{ fontSize: 20, color: 'text.disabled' }} />}
                        <Typography sx={{ fontSize: 9.5, fontWeight: i === pasoActualIdx ? 800 : 500, color: i === pasoActualIdx ? ESTADO_META[col].color : 'text.secondary', textAlign: 'center' }}>
                          {ESTADO_META[col].label}
                        </Typography>
                      </Box>
                    </Tooltip>
                    {i < columnas.length - 1 && (
                      <Box sx={{ flex: 0.6, height: 2, bgcolor: i < pasoActualIdx ? ESTADO_META[col].color : 'divider', mb: 2 }} />
                    )}
                  </React.Fragment>
                ))}
              </Box>
              {NEXT_ESTADO[orden.estado] && (
                <Button
                  fullWidth variant="outlined" endIcon={<ArrowForward />}
                  onClick={() => handleCambiarEstado(NEXT_ESTADO[orden.estado])}
                  sx={{ borderRadius: 2, fontWeight: 700, borderColor: '#EA580C', color: '#EA580C', '&:hover': { borderColor: '#C2410C', bgcolor: alpha('#EA580C', 0.06) } }}
                >
                  Marcar como "{ESTADO_META[NEXT_ESTADO[orden.estado]].label}"
                </Button>
              )}
            </Box>
          ) : (
            <Box sx={{ mb: 2.5 }}><EstadoChip estado={orden.estado} size="medium" /></Box>
          )}

          {orden.descripcion_problema && (
            <Alert severity="info" icon={<Info />} sx={{ borderRadius: 2, mb: 2, fontSize: 12.5 }}>{orden.descripcion_problema}</Alert>
          )}

          {/* ── Costos — sección propia y claramente separada del progreso ── */}
          <Box sx={{ p: 1.5, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
            <Typography sx={{ fontWeight: 700, fontSize: 13, mb: 1 }}>
              {esReventa ? '💰 Costos de remanufactura' : '🔧 Repuestos y mano de obra'}
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
                <Typography sx={{ fontSize: 11, fontWeight: 700, color: 'text.secondary', mb: 1 }}>Agregar costo</Typography>
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
                        onChange={(_, v) => { setProducto(v); setDescripcion(v?.nombre || ''); if (v?.costo) setCostoUnitario(v.costo); }}
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
                    <CurrencyField size="small" label="Costo c/u" value={costoUnitario} onChange={setCostoUnitario} />
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
          </Box>

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
              onClick={() => setCerrarOpen(true)}
              sx={{ bgcolor: '#059669', '&:hover': { bgcolor: '#047857' }, borderRadius: 2, fontWeight: 700 }}
            >
              {esReventa ? 'Vender vehículo' : 'Cobrar y entregar'}
            </Button>
          )}
          {!cerrada && orden.estado !== 'cancelado' && (
            <Button color="error" startIcon={<Cancel />} onClick={() => setCancelarOpen(true)}>
              Cancelar orden
            </Button>
          )}
        </DialogActions>
      </Dialog>

      <CerrarOrdenDialog
        open={cerrarOpen} onClose={() => setCerrarOpen(false)} orden={orden} esReventa={esReventa} clientes={clientes}
        onClosed={(updated) => { onChanged(updated); setCerrarOpen(false); }}
      />
      <ConfirmDialog
        open={cancelarOpen} onClose={() => setCancelarOpen(false)} onConfirm={handleConfirmarCancelar}
        loading={cancelando}
        title="¿Cancelar esta orden?"
        message="Esta acción no se puede deshacer. El vehículo quedará marcado como cancelado y no podrás seguir agregando costos ni cerrarla."
        confirmLabel="Sí, cancelar"
      />
    </>
  );
};

// ─── Columna Kanban ─────────────────────────────────────────────────────────
const ColumnaEstado = ({ estado, ordenes, onSelect }) => {
  const meta = ESTADO_META[estado];
  return (
    <Box sx={{ minWidth: 0 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.2, px: 0.5, flexWrap: 'wrap' }}>
        <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: meta.color }} />
        <Typography sx={{ fontWeight: 800, fontSize: 13 }}>{meta.label}</Typography>
        <Badge badgeContent={ordenes.length} color="default" sx={{
          '& .MuiBadge-badge': { position: 'static', transform: 'none', bgcolor: alpha(meta.color, 0.15), color: meta.color, fontWeight: 800, fontSize: 10.5 },
        }} />
      </Box>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.2, minHeight: 80 }}>
        {ordenes.map((orden) => (
          <Card
            key={orden.id}
            variant="outlined"
            onClick={() => onSelect(orden)}
            sx={{
              p: 1.5, borderRadius: 2.5, cursor: 'pointer',
              borderLeft: `4px solid ${meta.color}`,
              transition: 'transform 0.15s', '&:hover': { transform: 'translateY(-2px)' },
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {orden.vehiculo?.tipo === 'moto' ? <TwoWheeler sx={{ color: '#EA580C', fontSize: 18 }} /> : <DirectionsCar sx={{ color: '#EA580C', fontSize: 18 }} />}
              <Typography fontWeight={800} fontSize={13.5}>{orden.vehiculo?.placa}</Typography>
            </Box>
            <Typography fontSize={11} color="text.secondary" sx={{ mt: 0.3 }}>
              {[orden.vehiculo?.marca, orden.vehiculo?.modelo].filter(Boolean).join(' ') || '—'}
            </Typography>
            {orden.mecanico_nombre && (
              <Typography sx={{ fontSize: 10.5, color: 'text.secondary', mt: 0.6, display: 'flex', alignItems: 'center', gap: 0.4 }}>
                <Engineering sx={{ fontSize: 12 }} /> {orden.mecanico_nombre}
              </Typography>
            )}
            <Divider sx={{ my: 0.8 }} />
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography fontSize={10.5} color="text.secondary">Costo</Typography>
              <Typography fontWeight={800} fontSize={12}>{fmt(orden.costo_acumulado)}</Typography>
            </Box>
          </Card>
        ))}
        {!ordenes.length && (
          <Typography sx={{ fontSize: 11.5, color: 'text.disabled', textAlign: 'center', py: 2 }}>Vacío</Typography>
        )}
      </Box>
    </Box>
  );
};

// ─── Página principal ──────────────────────────────────────────────────────
const TallerOrdenes = () => {
  const [tab, setTab] = useState('reparacion_cliente');
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
      const res = await apiClient.get('/taller/ordenes', { params: { tipo_orden: tab } });
      setOrdenes(res.data || []);
    } catch {
      toast.error('No se pudieron cargar las órdenes del taller');
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => { fetchOrdenes(); }, [fetchOrdenes]);

  useEffect(() => {
    apiClient.get('/taller/stats').then((r) => setStats(r.data)).catch(() => {});
    apiClient.get('/clientes/', { params: { limit: 500 } }).then((r) => setClientes(r.data || [])).catch(() => {});
    apiClient.get('/productos/', { params: { limit: 500 } }).then((r) => setProductos(r.data || [])).catch(() => {});
  }, []);

  // Actualiza la orden en el estado local — como la Kanban agrupa las
  // tarjetas leyendo `orden.estado` de este mismo array, la tarjeta "se
  // mueve" de columna sola apenas cambia el estado, sin recargar la página.
  const refreshOne = (updated) => {
    setSelectedOrden(updated);
    setOrdenes((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
    apiClient.get('/taller/stats').then((r) => setStats(r.data)).catch(() => {});
  };

  const esReventaTab = tab === 'remanufactura_reventa';
  const columnas = FLUJO_COLUMNAS[tab];

  const ordenesPorEstado = useMemo(() => {
    const map = {};
    for (const col of [...columnas, 'cancelado']) map[col] = [];
    for (const o of ordenes) {
      if (map[o.estado]) map[o.estado].push(o);
    }
    return map;
  }, [ordenes, columnas]);

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

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab value="reparacion_cliente" label="Reparación a cliente" />
        <Tab value="remanufactura_reventa" label="Remanufactura y reventa" />
      </Tabs>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
      ) : (
        <Box sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
          gap: 2,
        }}>
          {[...columnas, 'cancelado'].map((estado) => (
            <ColumnaEstado key={estado} estado={estado} ordenes={ordenesPorEstado[estado] || []} onSelect={setSelectedOrden} />
          ))}
        </Box>
      )}

      <NuevaOrdenDialog
        open={nuevaOpen} onClose={() => setNuevaOpen(false)} tipoOrden={tab}
        clientes={clientes} onCreated={() => fetchOrdenes()}
      />
      <DetalleOrdenDialog
        open={!!selectedOrden} onClose={() => setSelectedOrden(null)}
        orden={selectedOrden} productos={productos} clientes={clientes}
        onChanged={refreshOne}
      />
    </Box>
  );
};

export default TallerOrdenes;
