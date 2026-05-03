// ═══════════════════════════════════════════════════════════════════════════
// ParqueaderoSuscripciones.jsx — VERSIÓN 2 (con botones WhatsApp)
// REEMPLAZA tu archivo /components/ParqueaderoSuscripciones.jsx por este.
//
// Cambios respecto a v1:
//   ✨ Botón WhatsApp en filas con saldo pendiente
//   ✨ Botón WhatsApp en cards mobile
// ═══════════════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Paper, Typography, Stack, Chip, IconButton, Tooltip,
  Skeleton, Alert, Button, ToggleButton, ToggleButtonGroup,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem,
  InputAdornment, Divider, useMediaQuery, useTheme, CircularProgress
} from '@mui/material';
import {
  EventRepeat, Refresh, Payment, Visibility,
  AttachMoney, Cancel, Close, Save
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import apiClient from '../api';
import { toast } from 'react-toastify';
import { formatCurrency } from '../utils/formatters';
import BotonWhatsApp from './BotonWhatsApp';   // ✨ NUEVO

const ACCENT = '#FF6020';
const METODOS_PAGO = ['Efectivo', 'Transferencia', 'Nequi', 'Daviplata', 'Tarjeta', 'Otro'];

export default function ParqueaderoSuscripciones() {
  const [items, setItems]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [filtro, setFiltro]     = useState('todas');
  const [dlgAbono, setDlgAbono] = useState(null);
  const [confirmCancel, setConfirmCancel] = useState(null);
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filtro === 'vigentes') params.append('solo_vigentes', 'true');
      if (filtro === 'vencidas') params.append('solo_vencidas', 'true');
      params.append('limit', '300');
      const { data } = await apiClient.get(`/parqueadero/suscripciones?${params}`);
      const filtrado = filtro === 'con_saldo'
        ? data.filter(s => s.saldo_pendiente > 0)
        : data;
      setItems(filtrado);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al cargar.');
    } finally {
      setLoading(false);
    }
  }, [filtro]);

  useEffect(() => { cargar(); }, [cargar]);

  const totalFacturado = items.reduce((sum, s) => sum + (s.monto_total || 0), 0);
  const totalPagado    = items.reduce((sum, s) => sum + (s.monto_pagado || 0), 0);
  const totalSaldo     = items.reduce((sum, s) => sum + (s.saldo_pendiente || 0), 0);

  const handleCancelar = async () => {
    if (!confirmCancel) return;
    try {
      await apiClient.delete(`/parqueadero/suscripciones/${confirmCancel.id}`);
      toast.success('Suscripción cancelada.');
      setConfirmCancel(null);
      cargar();
    } catch (err) {
      const status = err.response?.status;
      if (status === 403) {
        toast.error('Solo el administrador puede cancelar suscripciones.');
      } else {
        toast.error(err.response?.data?.detail || 'Error al cancelar.');
      }
    }
  };

  return (
    <Box sx={{ p: { xs: 1, md: 2 }, maxWidth: 1400, mx: 'auto' }}>

      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2, flexWrap: 'wrap', gap: 1 }}>
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <Box sx={{
            width: 44, height: 44, borderRadius: 2,
            background: `linear-gradient(135deg, ${ACCENT} 0%, #ff9a62 100%)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <EventRepeat sx={{ color: 'white' }} />
          </Box>
          <Box>
            <Typography sx={{ fontSize: 20, fontWeight: 800, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              Suscripciones
            </Typography>
            <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
              {items.length} registro{items.length !== 1 ? 's' : ''}
            </Typography>
          </Box>
        </Stack>
        <Tooltip title="Actualizar">
          <IconButton onClick={cargar} sx={{ border: '1px solid', borderColor: 'divider' }}>
            <Refresh />
          </IconButton>
        </Tooltip>
      </Stack>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 2 }}>
        <KpiSmall label="Facturado" value={formatCurrency(totalFacturado)} color="text.primary" />
        <KpiSmall label="Pagado" value={formatCurrency(totalPagado)} color="#10B981" />
        <KpiSmall label="Saldo pendiente" value={formatCurrency(totalSaldo)}
          color={totalSaldo > 0 ? '#EF4444' : '#10B981'} />
      </Stack>

      <Paper sx={{ p: 1, mb: 2, borderRadius: 3 }}>
        <ToggleButtonGroup
          exclusive value={filtro}
          onChange={(_, v) => v && setFiltro(v)}
          size="small"
          sx={{
            flexWrap: 'wrap',
            '& .MuiToggleButton-root': {
              fontWeight: 700, textTransform: 'none',
              '&.Mui-selected': { bgcolor: ACCENT + '15', color: ACCENT },
            },
          }}
        >
          <ToggleButton value="todas">Todas</ToggleButton>
          <ToggleButton value="vigentes">Vigentes</ToggleButton>
          <ToggleButton value="vencidas">Vencidas</ToggleButton>
          <ToggleButton value="con_saldo">Con saldo pendiente</ToggleButton>
        </ToggleButtonGroup>
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {loading ? (
        <Stack spacing={1}>
          {[1, 2, 3, 4].map(i => <Skeleton key={i} variant="rounded" height={70} />)}
        </Stack>
      ) : items.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 3 }}>
          <EventRepeat sx={{ fontSize: 64, color: 'text.disabled', mb: 1 }} />
          <Typography sx={{ fontSize: 16, fontWeight: 700, mb: 0.5 }}>
            Sin registros
          </Typography>
          <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>
            {filtro === 'todas'
              ? 'Aún no hay suscripciones. Empieza desde "Buscar placa".'
              : 'No hay suscripciones que coincidan con este filtro.'}
          </Typography>
        </Paper>
      ) : isMobile ? (
        <Stack spacing={1}>
          {items.map(s => (
            <SuscripcionCard
              key={s.id} susc={s}
              onVer={() => navigate(`/parqueadero/buscar?placa=${s.placa}`)}
              onAbonar={() => setDlgAbono(s)}
              onCancelar={() => setConfirmCancel(s)}
            />
          ))}
        </Stack>
      ) : (
        <TableContainer component={Paper} sx={{ borderRadius: 3 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 800, fontSize: 11, textTransform: 'uppercase' }}>Placa</TableCell>
                <TableCell sx={{ fontWeight: 800, fontSize: 11, textTransform: 'uppercase' }}>Propietario</TableCell>
                <TableCell sx={{ fontWeight: 800, fontSize: 11, textTransform: 'uppercase' }}>Tipo</TableCell>
                <TableCell sx={{ fontWeight: 800, fontSize: 11, textTransform: 'uppercase' }}>Vigencia</TableCell>
                <TableCell align="right" sx={{ fontWeight: 800, fontSize: 11, textTransform: 'uppercase' }}>Total</TableCell>
                <TableCell align="right" sx={{ fontWeight: 800, fontSize: 11, textTransform: 'uppercase' }}>Pagado</TableCell>
                <TableCell align="right" sx={{ fontWeight: 800, fontSize: 11, textTransform: 'uppercase' }}>Saldo</TableCell>
                <TableCell sx={{ fontWeight: 800, fontSize: 11, textTransform: 'uppercase' }}>Estado</TableCell>
                <TableCell align="right" sx={{ fontWeight: 800, fontSize: 11, textTransform: 'uppercase' }}>Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {items.map(s => (
                <SuscripcionRow
                  key={s.id} susc={s}
                  onVer={() => navigate(`/parqueadero/buscar?placa=${s.placa}`)}
                  onAbonar={() => setDlgAbono(s)}
                  onCancelar={() => setConfirmCancel(s)}
                />
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {dlgAbono && (
        <AbonoDialog
          open={!!dlgAbono} susc={dlgAbono}
          onClose={() => setDlgAbono(null)}
          onSuccess={() => { setDlgAbono(null); cargar(); }}
        />
      )}

      <Dialog open={!!confirmCancel} onClose={() => setConfirmCancel(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>¿Cancelar esta suscripción?</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: 14 }}>
            Suscripción <strong>{confirmCancel?.tipo?.toUpperCase()}</strong> de la moto <strong>{confirmCancel?.placa}</strong>.
          </Typography>
          <Typography sx={{ fontSize: 12, color: 'text.secondary', mt: 1 }}>
            La suscripción quedará marcada como cancelada (no se borra). Útil cuando se registró por error.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmCancel(null)}>No</Button>
          <Button variant="contained" color="error" onClick={handleCancelar}>
            Sí, cancelar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}


// ═══════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTES
// ═══════════════════════════════════════════════════════════════════════════

function KpiSmall({ label, value, color }) {
  return (
    <Paper sx={{ p: 1.5, borderRadius: 2, flex: 1, border: '1px solid', borderColor: 'divider' }}>
      <Typography sx={{ fontSize: 10, fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {label}
      </Typography>
      <Typography sx={{ fontSize: 18, fontWeight: 900, color, mt: 0.3 }}>
        {value}
      </Typography>
    </Paper>
  );
}

function SuscripcionRow({ susc, onVer, onAbonar, onCancelar }) {
  const colorEstado = colorPorEstadoPago(susc.estado_pago);
  const colorTipo = colorPorEstado(susc);
  const tieneSaldo = susc.saldo_pendiente > 0 && susc.estado !== 'cancelada';

  return (
    <TableRow hover sx={{ opacity: susc.estado === 'cancelada' ? 0.5 : 1 }}>
      <TableCell>
        <Typography sx={{ fontFamily: 'monospace', fontWeight: 800, fontSize: 13, letterSpacing: 1 }}>
          {susc.placa || '—'}
        </Typography>
      </TableCell>
      <TableCell>
        <Typography sx={{ fontSize: 13 }}>{susc.cliente_nombre || '—'}</Typography>
      </TableCell>
      <TableCell>
        <Chip size="small" label={susc.tipo?.toUpperCase()}
          sx={{ height: 18, fontSize: 9, fontWeight: 700, bgcolor: 'action.hover' }} />
        {susc.es_retroactiva && (
          <Chip size="small" label="RETRO"
            sx={{ height: 18, fontSize: 9, fontWeight: 700, ml: 0.5, bgcolor: '#FEE2E2', color: '#991B1B' }} />
        )}
      </TableCell>
      <TableCell>
        <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
          {fechaCorta(susc.fecha_inicio)}
        </Typography>
        <Typography sx={{ fontSize: 12, fontWeight: 700, color: colorTipo.text }}>
          → {fechaCorta(susc.fecha_vencimiento)}
        </Typography>
      </TableCell>
      <TableCell align="right" sx={{ fontWeight: 600, fontSize: 13 }}>
        {formatCurrency(susc.monto_total)}
      </TableCell>
      <TableCell align="right" sx={{ fontWeight: 700, fontSize: 13, color: '#10B981' }}>
        {formatCurrency(susc.monto_pagado)}
      </TableCell>
      <TableCell align="right" sx={{
        fontWeight: 800, fontSize: 13,
        color: tieneSaldo ? '#EF4444' : 'text.disabled',
      }}>
        {tieneSaldo ? formatCurrency(susc.saldo_pendiente) : '—'}
      </TableCell>
      <TableCell>
        <Chip size="small"
          label={susc.estado === 'cancelada' ? 'CANCELADA' : susc.estado_pago.toUpperCase()}
          sx={{
            height: 18, fontSize: 9, fontWeight: 700,
            bgcolor: susc.estado === 'cancelada' ? '#94A3B820' : colorEstado.bg,
            color:   susc.estado === 'cancelada' ? '#475569'   : colorEstado.text,
          }}
        />
      </TableCell>
      <TableCell align="right">
        <Stack direction="row" spacing={0} justifyContent="flex-end">
          <Tooltip title="Ver placa">
            <IconButton size="small" onClick={onVer} sx={{ color: ACCENT }}>
              <Visibility fontSize="small" />
            </IconButton>
          </Tooltip>
          {tieneSaldo && (
            <>
              <Tooltip title="Registrar abono">
                <IconButton size="small" onClick={onAbonar} sx={{ color: '#10B981' }}>
                  <Payment fontSize="small" />
                </IconButton>
              </Tooltip>
              {/* ✨ NUEVO: WhatsApp inline para cobros */}
              <BotonWhatsApp
                vehiculoId={susc.vehiculo_id}
                suscripcionId={susc.id}
                tipo="pago"
                variante="icon"
                tamano="small"
              />
            </>
          )}
          {susc.estado !== 'cancelada' && (
            <Tooltip title="Cancelar suscripción">
              <IconButton size="small" onClick={onCancelar} sx={{ color: 'error.main' }}>
                <Cancel fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Stack>
      </TableCell>
    </TableRow>
  );
}

function SuscripcionCard({ susc, onVer, onAbonar, onCancelar }) {
  const colorEstado = colorPorEstadoPago(susc.estado_pago);
  const tieneSaldo = susc.saldo_pendiente > 0 && susc.estado !== 'cancelada';

  return (
    <Paper sx={{
      p: 1.5, borderRadius: 2, border: '1px solid', borderColor: 'divider',
      opacity: susc.estado === 'cancelada' ? 0.5 : 1,
    }}>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 1 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography sx={{
              fontFamily: 'monospace', fontWeight: 800, fontSize: 16,
              letterSpacing: 1.5, color: ACCENT,
            }}>
              {susc.placa || '—'}
            </Typography>
            <Chip size="small" label={susc.tipo?.toUpperCase()}
              sx={{ height: 18, fontSize: 9, fontWeight: 700, bgcolor: 'action.hover' }} />
          </Stack>
          <Typography sx={{ fontSize: 12, color: 'text.secondary' }} noWrap>
            {susc.cliente_nombre}
          </Typography>
        </Box>
        <Chip size="small"
          label={susc.estado === 'cancelada' ? 'CANCELADA' : susc.estado_pago.toUpperCase()}
          sx={{
            height: 18, fontSize: 9, fontWeight: 700,
            bgcolor: susc.estado === 'cancelada' ? '#94A3B820' : colorEstado.bg,
            color:   susc.estado === 'cancelada' ? '#475569'   : colorEstado.text,
          }}
        />
      </Stack>

      <Divider sx={{ my: 1 }} />

      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Box>
          <Typography sx={{ fontSize: 10, color: 'text.secondary', textTransform: 'uppercase' }}>
            Vence
          </Typography>
          <Typography sx={{ fontSize: 12, fontWeight: 700 }}>
            {fechaCorta(susc.fecha_vencimiento)}
          </Typography>
        </Box>
        <Box sx={{ textAlign: 'right' }}>
          <Typography sx={{ fontSize: 10, color: 'text.secondary', textTransform: 'uppercase' }}>
            {tieneSaldo ? 'Saldo' : 'Total'}
          </Typography>
          <Typography sx={{
            fontSize: 14, fontWeight: 800,
            color: tieneSaldo ? '#EF4444' : '#10B981',
          }}>
            {formatCurrency(tieneSaldo ? susc.saldo_pendiente : susc.monto_total)}
          </Typography>
        </Box>
      </Stack>

      <Stack direction="row" spacing={0.5} sx={{ mt: 1 }}>
        <Button size="small" startIcon={<Visibility />} onClick={onVer} sx={{ flex: 1, fontSize: 11 }}>
          Ver
        </Button>
        {tieneSaldo && (
          <>
            <Button size="small" startIcon={<Payment />} onClick={onAbonar}
              variant="contained" sx={{ flex: 1, fontSize: 11, bgcolor: '#10B981', '&:hover': { bgcolor: '#059669' } }}>
              Abonar
            </Button>
            {/* ✨ NUEVO: WhatsApp en mobile */}
            <BotonWhatsApp
              vehiculoId={susc.vehiculo_id}
              suscripcionId={susc.id}
              tipo="pago"
              variante="icon"
              tamano="small"
            />
          </>
        )}
      </Stack>
    </Paper>
  );
}


function AbonoDialog({ open, onClose, susc, onSuccess }) {
  const [monto, setMonto]     = useState(String(susc.saldo_pendiente || 0));
  const [metodo, setMetodo]   = useState('Efectivo');
  const [obs, setObs]         = useState('');
  const [loading, setLoading] = useState(false);

  const montoNum = Number(monto || 0);
  const excede   = montoNum > susc.saldo_pendiente + 0.01;

  const handleGuardar = async () => {
    if (montoNum <= 0) {
      toast.warning('El monto debe ser mayor a cero.');
      return;
    }
    if (excede) {
      toast.warning('El monto excede el saldo pendiente.');
      return;
    }
    setLoading(true);
    try {
      await apiClient.post('/parqueadero/pagos', {
        suscripcion_id: susc.id,
        monto:          montoNum,
        metodo_pago:    metodo,
        observaciones:  obs || null,
      });
      toast.success(`Abono de ${formatCurrency(montoNum)} registrado.`);
      onSuccess?.();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al registrar abono.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ pb: 1 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Stack direction="row" spacing={1} alignItems="center">
            <AttachMoney sx={{ color: '#10B981' }} />
            <Typography sx={{ fontWeight: 800 }}>Registrar abono</Typography>
          </Stack>
          <IconButton onClick={onClose} size="small"><Close /></IconButton>
        </Stack>
        <Typography sx={{ fontSize: 13, color: 'text.secondary', mt: 0.3 }}>
          {susc.placa} · {susc.cliente_nombre}
        </Typography>
      </DialogTitle>

      <DialogContent dividers>
        <Box sx={{
          p: 2, bgcolor: 'rgba(239, 68, 68, 0.08)',
          borderRadius: 2, mb: 2, textAlign: 'center',
        }}>
          <Typography sx={{ fontSize: 11, color: 'text.secondary', textTransform: 'uppercase', fontWeight: 700 }}>
            Saldo pendiente
          </Typography>
          <Typography sx={{ fontSize: 24, fontWeight: 900, color: '#EF4444' }}>
            {formatCurrency(susc.saldo_pendiente)}
          </Typography>
          <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
            Pagado: {formatCurrency(susc.monto_pagado)} de {formatCurrency(susc.monto_total)}
          </Typography>
        </Box>

        <TextField
          fullWidth size="small" label="Monto del abono"
          value={monto}
          onChange={(e) => setMonto(e.target.value.replace(/\D/g, ''))}
          error={excede}
          helperText={excede ? 'Excede el saldo pendiente' : 'Puede ser parcial o total'}
          InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
          sx={{ mb: 2 }}
        />

        <TextField
          fullWidth select size="small" label="Método de pago"
          value={metodo} onChange={(e) => setMetodo(e.target.value)}
          sx={{ mb: 2 }}
        >
          {METODOS_PAGO.map(m => <MenuItem key={m} value={m}>{m}</MenuItem>)}
        </TextField>

        <TextField
          fullWidth size="small" multiline rows={2}
          label="Observaciones (opcional)"
          value={obs} onChange={(e) => setObs(e.target.value)}
        />
      </DialogContent>

      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} disabled={loading}>Cancelar</Button>
        <Button
          variant="contained" onClick={handleGuardar} disabled={loading || excede || montoNum <= 0}
          startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <Save />}
          sx={{ bgcolor: '#10B981', '&:hover': { bgcolor: '#059669' }, fontWeight: 700 }}
        >
          Registrar abono
        </Button>
      </DialogActions>
    </Dialog>
  );
}


function fechaCorta(fechaIso) {
  if (!fechaIso) return '—';
  const d = new Date(fechaIso);
  if (isNaN(d)) return fechaIso;
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: '2-digit' });
}

function colorPorEstado(susc) {
  const hoy = new Date();
  const vence = new Date(susc.fecha_vencimiento);
  if (vence < hoy) return { text: '#EF4444' };
  const diff = (vence - hoy) / (1000 * 60 * 60 * 24);
  if (diff <= 5) return { text: '#F59E0B' };
  return { text: '#10B981' };
}

function colorPorEstadoPago(estado) {
  switch (estado) {
    case 'pagado':  return { bg: '#10B98120', text: '#065F46' };
    case 'parcial': return { bg: '#F59E0B20', text: '#78350F' };
    default:        return { bg: '#EF444420', text: '#7F1D1D' };
  }
}
