import React, { useState, useCallback, useEffect } from 'react';
import {
  Box, Typography, Avatar, Chip, Button, IconButton, Tooltip,
  CircularProgress, useTheme, alpha, Stack, Divider,
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Select, MenuItem, FormControl, InputLabel,
  InputAdornment, Paper,
} from '@mui/material';
import {
  PointOfSale, Search, Refresh, Close, TableRestaurant,
  Receipt, AccessTime, Person, AttachMoney, CheckCircle,
  QrCode2,
} from '@mui/icons-material';
import { toast } from 'react-toastify';
import apiClient from '../../api';
import CurrencyField from '../../components/common/CurrencyField';
import LinkPagoModal from '../../components/common/LinkPagoModal.jsx';
import usePolling from '../../hooks/usePolling';
import ReciboDialog from '../../components/common/ReciboDialog';

const fmt = (v) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v ?? 0);

const timeAgo = (iso) => {
  if (!iso) return '';
  const d = new Date(iso.endsWith('Z') || iso.includes('+') ? iso : iso + 'Z');
  const diff = Math.floor((Date.now() - d) / 60000);
  if (isNaN(diff) || diff < 0) return '—';
  if (diff < 1) return 'ahora';
  if (diff < 60) return `${diff} min`;
  return `${Math.floor(diff / 60)}h ${diff % 60 > 0 ? `${diff % 60}min` : ''}`.trim();
};

// Solo Efectivo viene fijo — el resto son los links de pago que la empresa
// configure en Mi Cuenta → Link de Pago.
const METODOS = ['Efectivo'];

// ─── PagarDialog ──────────────────────────────────────────────────────────────

const PagarDialog = ({ open, comanda, empresa, onClose, onPagado }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const [metodo, setMetodo] = useState('Efectivo');
  const [recibido, setRecibido] = useState('');
  const [propina, setPropina] = useState(0);
  const [propinaEfectivo, setPropinaEfectivo] = useState(0);
  const [loading, setLoading] = useState(false);
  const [reciboVenta, setReciboVenta] = useState(null);
  const [reciboOpen, setReciboOpen] = useState(false);
  const [linkPagosConfig, setLinkPagosConfig] = useState([]);
  const [linkPagoOpen, setLinkPagoOpen] = useState(false);
  const selectedLinkPago = metodo?.startsWith('link:')
    ? linkPagosConfig.find(l => `link:${l.id}` === metodo)
    : null;

  useEffect(() => {
    apiClient.get('/empresa/link-pago/activos').then(r => setLinkPagosConfig(r.data || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (open) { setMetodo('Efectivo'); setRecibido(''); setPropina(0); setPropinaEfectivo(0); }
  }, [open, comanda?.id]);

  if (!comanda) return null;

  const totalBase = comanda.total ?? 0;
  const totalConPropina = totalBase + (propina || 0) + (propinaEfectivo || 0);
  const montoRec = parseInt(recibido.replace(/\./g, ''), 10) || 0;
  const cambio = metodo === 'Efectivo' ? Math.max(0, montoRec - totalConPropina) : 0;
  const faltante = metodo === 'Efectivo' && montoRec > 0 ? Math.max(0, totalConPropina - montoRec) : 0;

  const puedeConfirmar =
    !!selectedLinkPago ||
    metodo !== 'Efectivo' ||
    montoRec >= totalConPropina;

  const handleRecibidoChange = (e) => {
    const raw = e.target.value.replace(/\D/g, '');
    if (raw === '') { setRecibido(''); return; }
    setRecibido(new Intl.NumberFormat('es-CO').format(parseInt(raw, 10)));
  };

  const handlePagar = async () => {
    setLoading(true);
    try {
      const metodoPagoFinal = selectedLinkPago ? `Link de Pago: ${selectedLinkPago.nombre}` : metodo;
      const res = await apiClient.post(`/restaurante/comandas/${comanda.id}/cerrar`, {
        metodo_pago: metodoPagoFinal,
        propina,
        propina_efectivo: propinaEfectivo,
        omitir_inventario: false,
        cobrado_por_cajero: true,
      });
      const itemsActivos = (comanda.items || []).filter(i => i.estado !== 'cancelado');
      const ventaSnap = {
        id: res.data.venta_id,
        fecha: new Date().toISOString(),
        cliente: { nombre: `Mesa ${comanda.mesa_numero}`, telefono: '' },
        detalles: itemsActivos.map(d => ({
          producto: { nombre: d.nombre_producto },
          cantidad: d.cantidad,
          precio_unitario: d.precio_unitario,
        })),
        total: res.data.total,
        iva_total: 0, iva_porcentaje: 0,
        monto_pagado: res.data.total,
        estado_pago: 'pagado',
        metodo_pago: metodoPagoFinal,
      };
      setReciboVenta(ventaSnap);
      setReciboOpen(true);
      toast.success(`Mesa ${comanda.mesa_numero} — pago registrado`);
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Error al registrar el pago');
    } finally { setLoading(false); }
  };

  const itemsActivos = (comanda.items || []).filter(i => i.estado !== 'cancelado');

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth
        PaperProps={{ sx: { borderRadius: 4 } }}>
        <DialogTitle sx={{ pb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Avatar sx={{ bgcolor: alpha('#7C3AED', 0.12), width: 40, height: 40 }}>
              <PointOfSale sx={{ color: '#7C3AED', fontSize: 20 }} />
            </Avatar>
            <Box sx={{ flex: 1 }}>
              <Typography fontWeight={800} fontSize={15}>
                Cobrar Mesa {comanda.mesa_numero}
              </Typography>
              <Typography fontSize={12} color="text.secondary">
                Ticket #{comanda.numero_comanda} · {comanda.mesero_nombre || '—'}
              </Typography>
            </Box>
            <IconButton size="small" onClick={onClose}><Close fontSize="small" /></IconButton>
          </Box>
        </DialogTitle>

        <DialogContent dividers sx={{ pt: 2 }}>
          <Stack spacing={2}>
            {/* Detalle de ítems */}
            <Box sx={{
              p: 1.5, borderRadius: 2,
              bgcolor: isDark ? alpha('#fff', 0.03) : alpha('#000', 0.025),
              border: `1px solid ${theme.palette.divider}`,
            }}>
              <Typography fontSize={11} fontWeight={700} color="text.secondary"
                textTransform="uppercase" letterSpacing={0.8} mb={1}>
                Consumo
              </Typography>
              <Stack spacing={0.6}>
                {itemsActivos.map(item => (
                  <Box key={item.id} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Typography fontSize={13} sx={{ flex: 1, mr: 1 }}>
                      {item.cantidad}× {item.nombre_producto}
                      {item.notas && (
                        <Typography component="span" fontSize={11} color="text.disabled"> — {item.notas}</Typography>
                      )}
                    </Typography>
                    <Typography fontSize={13} fontWeight={700} sx={{ flexShrink: 0 }}>
                      {fmt(item.subtotal)}
                    </Typography>
                  </Box>
                ))}
              </Stack>
              <Divider sx={{ my: 1 }} />
              {propina > 0 && (
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography fontSize={13} color="text.secondary">Propina tarjeta</Typography>
                  <Typography fontSize={13}>{fmt(propina)}</Typography>
                </Box>
              )}
              {propinaEfectivo > 0 && (
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography fontSize={13} color="text.secondary">Propina efectivo</Typography>
                  <Typography fontSize={13}>{fmt(propinaEfectivo)}</Typography>
                </Box>
              )}
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography fontSize={15} fontWeight={800}>TOTAL</Typography>
                <Typography fontSize={17} fontWeight={900} color="#0891B2">{fmt(totalConPropina)}</Typography>
              </Box>
            </Box>

            {/* Propina */}
            <Box sx={{ display: 'flex', gap: 1.5 }}>
              <CurrencyField
                label="Propina tarjeta"
                size="small"
                fullWidth
                value={propina}
                onChange={(num) => setPropina(Math.max(0, num || 0))}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
              />
              <CurrencyField
                label="Propina efectivo"
                size="small"
                fullWidth
                value={propinaEfectivo}
                onChange={(num) => setPropinaEfectivo(Math.max(0, num || 0))}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
              />
            </Box>

            {/* Método de pago */}
            <FormControl size="small" fullWidth>
              <InputLabel>Método de pago</InputLabel>
              <Select value={metodo} onChange={e => setMetodo(e.target.value)} label="Método de pago"
                sx={{ borderRadius: 2 }}>
                {METODOS.map(m => <MenuItem key={m} value={m}>{m}</MenuItem>)}
                {linkPagosConfig.map(l => (
                  <MenuItem key={l.id} value={`link:${l.id}`}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <QrCode2 sx={{ fontSize: 16, color: '#0891B2' }} />
                      {l.nombre}
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Efectivo: monto recibido + cambio */}
            {metodo === 'Efectivo' && (
              <Box>
                <TextField
                  label="Monto recibido"
                  size="small"
                  fullWidth
                  inputMode="numeric"
                  value={recibido}
                  onChange={handleRecibidoChange}
                  InputProps={{
                    startAdornment: <InputAdornment position="start">$</InputAdornment>,
                  }}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 }, mb: 1.5 }}
                />
                {montoRec > 0 && (
                  <Box sx={{
                    p: 1.5, borderRadius: 2, textAlign: 'center',
                    bgcolor: cambio > 0
                      ? alpha('#059669', 0.08)
                      : faltante > 0 ? alpha('#EF4444', 0.08) : alpha('#F59E0B', 0.08),
                    border: `1.5px solid ${cambio > 0 ? alpha('#059669', 0.3) : faltante > 0 ? alpha('#EF4444', 0.3) : alpha('#F59E0B', 0.3)}`,
                  }}>
                    {cambio > 0 ? (
                      <>
                        <Typography fontSize={11} color="#059669" fontWeight={700}>CAMBIO A DEVOLVER</Typography>
                        <Typography fontSize={24} fontWeight={900} color="#059669">{fmt(cambio)}</Typography>
                      </>
                    ) : faltante > 0 ? (
                      <>
                        <Typography fontSize={11} color="#EF4444" fontWeight={700}>FALTA</Typography>
                        <Typography fontSize={24} fontWeight={900} color="#EF4444">{fmt(faltante)}</Typography>
                      </>
                    ) : (
                      <Typography fontSize={13} fontWeight={700} color="#F59E0B">Pago exacto</Typography>
                    )}
                  </Box>
                )}
              </Box>
            )}

            {/* Link/QR: indicador visual */}
            {selectedLinkPago && (
              <Box sx={{
                p: 1.5, borderRadius: 2, textAlign: 'center',
                bgcolor: alpha('#0891B2', 0.06),
                border: `1.5px solid ${alpha('#0891B2', 0.25)}`,
              }}>
                <QrCode2 sx={{ color: '#0891B2', fontSize: 28, mb: 0.5 }} />
                <Typography fontSize={12} fontWeight={700} color="#0891B2">
                  {selectedLinkPago.nombre}
                </Typography>
                <Typography fontSize={11} color="text.secondary" mt={0.3}>
                  Al confirmar se mostrará el QR / link al cliente
                </Typography>
              </Box>
            )}
          </Stack>
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
          <Button onClick={onClose} sx={{ borderRadius: 2 }}>Cancelar</Button>
          <Button
            variant="contained"
            disabled={loading || !puedeConfirmar}
            startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <CheckCircle />}
            onClick={() => selectedLinkPago ? setLinkPagoOpen(true) : handlePagar()}
            sx={{
              borderRadius: 2, fontWeight: 800, fontSize: 14, py: 1.1, flex: 1,
              bgcolor: selectedLinkPago ? '#0891B2' : '#059669',
              '&:hover': { bgcolor: selectedLinkPago ? '#E8531A' : '#047857' },
            }}>
            {selectedLinkPago ? 'Mostrar QR / Link' : `Confirmar pago ${fmt(totalConPropina)}`}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Link de Pago modal */}
      {selectedLinkPago && (
        <LinkPagoModal
          open={linkPagoOpen}
          onClose={() => setLinkPagoOpen(false)}
          linkConfig={selectedLinkPago}
          onConfirm={async () => {
            setLinkPagoOpen(false);
            await handlePagar();
          }}
        />
      )}

      <ReciboDialog
        open={reciboOpen}
        onClose={() => {
          setReciboOpen(false);
          setReciboVenta(null);
          onClose();
          onPagado();
        }}
        venta={reciboVenta}
        empresa={empresa}
        vendedor="Cajero"
      />
    </>
  );
};

// ─── ComandaCard ──────────────────────────────────────────────────────────────

const ComandaCard = ({ comanda, onClick }) => {
  const theme = useTheme();
  const itemsActivos = (comanda.items || []).filter(i => i.estado !== 'cancelado');
  const espera = timeAgo(comanda.fecha_apertura);

  return (
    <Paper
      onClick={onClick}
      elevation={0}
      sx={{
        p: 2, borderRadius: 3, cursor: 'pointer',
        border: `2px solid ${alpha('#7C3AED', 0.3)}`,
        bgcolor: alpha('#7C3AED', 0.04),
        transition: 'all 0.2s',
        '&:active': { transform: 'scale(0.99)' },
        '&:hover': {
          borderColor: '#7C3AED',
          bgcolor: alpha('#7C3AED', 0.08),
          boxShadow: `0 6px 20px ${alpha('#7C3AED', 0.2)}`,
        },
      }}
    >
      {/* Fila superior: ícono + mesa + precio */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
        <Avatar sx={{ bgcolor: alpha('#7C3AED', 0.12), width: 40, height: 40, flexShrink: 0 }}>
          <TableRestaurant sx={{ color: '#7C3AED', fontSize: 20 }} />
        </Avatar>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, flexWrap: 'wrap' }}>
            <Typography fontWeight={900} fontSize={17} color="#7C3AED" lineHeight={1}>
              Mesa {comanda.mesa_numero}
            </Typography>
            <Chip
              label={`Ticket #${comanda.numero_comanda}`}
              size="small"
              sx={{ fontSize: 10, height: 18, fontWeight: 700,
                bgcolor: alpha('#7C3AED', 0.12), color: '#7C3AED' }}
            />
          </Box>
        </Box>
        {/* Precio alineado a la derecha, nunca se corta */}
        <Typography
          fontWeight={900} fontSize={18} color="#0891B2"
          sx={{ flexShrink: 0, textAlign: 'right', minWidth: 'max-content' }}
        >
          {fmt(comanda.total)}
        </Typography>
      </Box>

      {/* Metadata: personas · tiempo · mesero */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.2, flexWrap: 'wrap' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4 }}>
          <Person sx={{ fontSize: 12, color: 'text.disabled' }} />
          <Typography fontSize={11} color="text.secondary">{comanda.personas} personas</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4 }}>
          <AccessTime sx={{ fontSize: 12, color: 'text.disabled' }} />
          <Typography fontSize={11} color="text.secondary">{espera}</Typography>
        </Box>
        {comanda.mesero_nombre && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4, minWidth: 0 }}>
            <Person sx={{ fontSize: 12, color: 'text.disabled' }} />
            <Typography fontSize={11} color="text.disabled"
              sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 130 }}>
              {comanda.mesero_nombre}
            </Typography>
          </Box>
        )}
      </Box>

      {/* Preview ítems */}
      <Box sx={{
        bgcolor: alpha('#7C3AED', 0.04), borderRadius: 2,
        px: 1.2, py: 0.8, mb: 1.5,
      }}>
        {itemsActivos.slice(0, 3).map(item => (
          <Typography key={item.id} fontSize={12} color="text.secondary"
            sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {item.cantidad}× {item.nombre_producto}
          </Typography>
        ))}
        {itemsActivos.length > 3 && (
          <Typography fontSize={11} color="text.disabled">
            +{itemsActivos.length - 3} más...
          </Typography>
        )}
      </Box>

      <Button
        fullWidth variant="contained" size="medium"
        startIcon={<AttachMoney />}
        sx={{
          borderRadius: 2.5, fontWeight: 700, fontSize: 13,
          bgcolor: '#7C3AED', '&:hover': { bgcolor: '#6D28D9' },
          py: 1,
        }}
        onClick={onClick}
      >
        Cobrar {fmt(comanda.total)}
      </Button>
    </Paper>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

export default function CajaRestaurante({ user }) {
  const theme = useTheme();
  const [comandas, setComandas] = useState([]);
  const [buscar, setBuscar] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [comandaSeleccionada, setComandaSeleccionada] = useState(null);
  const empresa = user?.empresa || null;

  const fetchPendientes = useCallback(async (silent = false) => {
    if (!silent) setLoading(true); else setRefreshing(true);
    try {
      const params = buscar.trim() ? { buscar: buscar.trim() } : {};
      const res = await apiClient.get('/restaurante/caja/pendientes', { params });
      setComandas(res.data);
    } catch {
      if (!silent) toast.error('Error al cargar pendientes de pago');
    } finally { setLoading(false); setRefreshing(false); }
  }, [buscar]);

  useEffect(() => { fetchPendientes(); }, [fetchPendientes]);
  usePolling(() => fetchPendientes(true), 10_000, { enabled: !comandaSeleccionada });

  const handleSearch = (e) => {
    if (e.key === 'Enter') fetchPendientes();
  };

  if (loading) return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
      <CircularProgress sx={{ color: '#7C3AED' }} />
    </Box>
  );

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, bgcolor: 'background.default', minHeight: '100vh' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Avatar sx={{ bgcolor: alpha('#7C3AED', 0.12), width: 48, height: 48 }}>
            <PointOfSale sx={{ color: '#7C3AED', fontSize: 26 }} />
          </Avatar>
          <Box>
            <Typography variant="h6" fontWeight={900} lineHeight={1.1}>Caja — Cobro de Mesas</Typography>
            <Typography fontSize={12} color="text.secondary">
              {comandas.length === 0
                ? 'Sin pendientes de cobro'
                : `${comandas.length} mesa${comandas.length !== 1 ? 's' : ''} esperando pago`}
            </Typography>
          </Box>
        </Box>
        <Button variant="outlined" startIcon={refreshing ? <CircularProgress size={14} /> : <Refresh />}
          onClick={() => fetchPendientes(false)} disabled={refreshing}
          sx={{ borderRadius: 2, fontWeight: 600, fontSize: 12 }}>
          Actualizar
        </Button>
      </Box>

      {/* Búsqueda */}
      <Box sx={{ mb: 3 }}>
        <TextField
          fullWidth
          size="small"
          placeholder="Buscar por número de mesa o ticket (#)..."
          value={buscar}
          onChange={e => setBuscar(e.target.value)}
          onKeyDown={handleSearch}
          InputProps={{
            startAdornment: <InputAdornment position="start"><Search sx={{ fontSize: 18, color: 'text.disabled' }} /></InputAdornment>,
            endAdornment: buscar && (
              <InputAdornment position="end">
                <IconButton size="small" onClick={() => { setBuscar(''); }}>
                  <Close fontSize="small" />
                </IconButton>
              </InputAdornment>
            ),
          }}
          sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
        />
      </Box>

      {/* Lista de comandas pendientes */}
      {comandas.length === 0 ? (
        <Paper elevation={0} sx={{
          p: 6, textAlign: 'center', borderRadius: 4,
          border: `1px dashed ${alpha(theme.palette.divider, 1)}`,
        }}>
          <PointOfSale sx={{ fontSize: 56, opacity: 0.12, mb: 2, color: '#7C3AED' }} />
          <Typography fontWeight={800} fontSize={16} mb={0.5}>
            {buscar ? 'Sin resultados' : 'Sin cobros pendientes'}
          </Typography>
          <Typography fontSize={13} color="text.secondary">
            {buscar
              ? 'No hay mesas con ese número o ticket.'
              : 'Cuando un mesero solicite la cuenta aparecerá aquí.'}
          </Typography>
        </Paper>
      ) : (
        <Box sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' },
          gap: 2,
        }}>
          {comandas.map(c => (
            <ComandaCard
              key={c.id}
              comanda={c}
              onClick={() => setComandaSeleccionada(c)}
            />
          ))}
        </Box>
      )}

      {/* Dialog de pago */}
      <PagarDialog
        open={!!comandaSeleccionada}
        comanda={comandaSeleccionada}
        empresa={empresa}
        onClose={() => setComandaSeleccionada(null)}
        onPagado={() => {
          setComandaSeleccionada(null);
          fetchPendientes(true);
        }}
      />
    </Box>
  );
}
