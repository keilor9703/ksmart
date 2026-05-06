// ═══════════════════════════════════════════════════════════════════════════
// DialogoDarBaja.jsx
// Diálogo "smart" para dar de baja un vehículo con flujo mixto.
//
// Coloca en frontend/src/components/DialogoDarBaja.jsx
//
// Comportamiento:
//   1. Al abrirse, llama a GET /parqueadero/vehiculos/{id}/baja-info
//   2. Muestra el análisis (suscripciones activas, accesos abiertos, saldo)
//   3. Si NO hay nada pendiente → confirmación simple
//   4. Si HAY pendientes → checkboxes para que el usuario decida qué hacer
//   5. Al confirmar, hace POST a /dar-baja con los flags
// ═══════════════════════════════════════════════════════════════════════════

import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Stack,
  Typography, Checkbox, FormControlLabel, RadioGroup, Radio, Alert,
  TextField, MenuItem, CircularProgress, Divider, Chip, IconButton
} from '@mui/material';
import {
  Warning, Delete, EventRepeat, AccessTime, Close, MoneyOff,
  AttachMoney, ExitToApp
} from '@mui/icons-material';
import apiClient from '../../api';
import { toast } from 'react-toastify';
import { formatCurrency } from '../../utils/formatters';

const ACCENT = '#FF6020';
const METODOS_PAGO = ['Efectivo', 'Transferencia', 'Nequi', 'Daviplata', 'Tarjeta', 'Otro'];

export default function DialogoDarBaja({ open, vehiculo, onClose, onSuccess }) {
  const [loading, setLoading]     = useState(true);
  const [bajaInfo, setBajaInfo]   = useState(null);
  const [error, setError]         = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Flags del usuario (los checkboxes)
  const [cancelarSuscripciones, setCancelarSusc]   = useState(true);
  const [marcarIncobrable, setMarcarIncobrable]    = useState(true);
  const [accionAcceso, setAccionAcceso]            = useState('cobrar'); // 'cobrar' o 'cerrar'
  const [metodoPagoAcceso, setMetodoPagoAcceso]    = useState('Efectivo');
  const [motivo, setMotivo]                        = useState('');

  // Cargar info al abrir
  useEffect(() => {
    if (!open || !vehiculo) return;
    setLoading(true);
    setError(null);
    setBajaInfo(null);
    setMotivo('');

    apiClient.get(`/parqueadero/vehiculos/${vehiculo.id}/baja-info`)
      .then(({ data }) => {
        setBajaInfo(data);
        // Activar checkboxes por defecto si hay items
        setCancelarSusc(data.suscripciones_activas.length > 0);
        setMarcarIncobrable(data.saldo_total_pendiente > 0);
      })
      .catch((err) => {
        setError(err.response?.data?.detail || 'No se pudo cargar la información.');
      })
      .finally(() => setLoading(false));
  }, [open, vehiculo]);

  // Validar que el usuario haya marcado lo necesario
  const puedeConfirmar = () => {
    if (!bajaInfo) return false;
    if (bajaInfo.puede_dar_baja_directo) return true;
    // Hay suscripciones → debe marcar cancelar
    if (bajaInfo.suscripciones_activas.length > 0 && !cancelarSuscripciones) return false;
    // Hay accesos → debe haber elegido cobrar o cerrar (siempre tiene un valor)
    return true;
  };

  const handleConfirmar = async () => {
    setSubmitting(true);
    try {
      const payload = {
        cancelar_suscripciones:  cancelarSuscripciones,
        marcar_saldo_incobrable: cancelarSuscripciones && marcarIncobrable,
        cerrar_accesos_abiertos: bajaInfo.accesos_abiertos.length > 0 && accionAcceso === 'cerrar',
        cobrar_acceso_abierto:   bajaInfo.accesos_abiertos.length > 0 && accionAcceso === 'cobrar',
        metodo_pago_acceso:      metodoPagoAcceso,
        motivo:                  motivo.trim() || null,
      };

      const { data } = await apiClient.post(
        `/parqueadero/vehiculos/${vehiculo.id}/dar-baja`,
        payload
      );
      toast.success(data.mensaje);
      onSuccess?.();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al dar de baja.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ pb: 1 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Box sx={{
              width: 36, height: 36, borderRadius: 2, bgcolor: '#FEE2E2',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Delete sx={{ color: '#DC2626', fontSize: 20 }} />
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 800, fontSize: 17 }}>
                Dar de baja moto
              </Typography>
              <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
                {vehiculo?.placa} · {vehiculo?.cliente_nombre}
              </Typography>
            </Box>
          </Stack>
          <IconButton onClick={onClose} size="small"><Close /></IconButton>
        </Stack>
      </DialogTitle>

      <DialogContent dividers>

        {loading ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <CircularProgress sx={{ color: ACCENT }} />
            <Typography sx={{ mt: 2, fontSize: 13, color: 'text.secondary' }}>
              Analizando vehículo…
            </Typography>
          </Box>
        ) : error ? (
          <Alert severity="error">{error}</Alert>
        ) : bajaInfo?.puede_dar_baja_directo ? (
          // ─── CASO SIMPLE: no hay nada pendiente ───────────────────────
          <>
            <Alert severity="success" sx={{ mb: 2 }}>
              Esta moto no tiene actividad pendiente. Puedes darla de baja sin
              consecuencias adicionales.
            </Alert>
            <Typography sx={{ fontSize: 13, color: 'text.secondary', mb: 1 }}>
              El histórico de pagos antiguos se conservará. La moto desaparecerá
              de las listas pero podrás reactivarla si vuelve.
            </Typography>
          </>
        ) : (
          // ─── CASO COMPLEJO: hay actividad pendiente ───────────────────
          <>
            <Alert severity="warning" icon={<Warning />} sx={{ mb: 2 }}>
              <Typography sx={{ fontSize: 13, fontWeight: 700 }}>
                Esta moto tiene actividad pendiente
              </Typography>
              <Typography sx={{ fontSize: 12, mt: 0.5 }}>
                Decide qué hacer con cada elemento antes de continuar.
              </Typography>
            </Alert>

            {/* ─── BLOQUE: Suscripciones activas ──────────────────────── */}
            {bajaInfo.suscripciones_activas.length > 0 && (
              <Box sx={{
                p: 2, mb: 2, borderRadius: 2,
                border: '1px solid', borderColor: 'divider',
                bgcolor: 'rgba(245, 158, 11, 0.05)',
              }}>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                  <EventRepeat sx={{ color: '#F59E0B', fontSize: 18 }} />
                  <Typography sx={{ fontWeight: 700, fontSize: 13 }}>
                    {bajaInfo.suscripciones_activas.length} suscripción
                    {bajaInfo.suscripciones_activas.length > 1 ? 'es' : ''} activa
                    {bajaInfo.suscripciones_activas.length > 1 ? 's' : ''}
                  </Typography>
                </Stack>

                <Stack spacing={0.5} sx={{ mb: 1.5, ml: 1 }}>
                  {bajaInfo.suscripciones_activas.map((s) => (
                    <Box key={s.id} sx={{
                      p: 1, bgcolor: 'background.paper', borderRadius: 1,
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    }}>
                      <Box>
                        <Stack direction="row" spacing={0.5} alignItems="center">
                          <Chip size="small" label={s.tipo?.toUpperCase()}
                            sx={{ height: 18, fontSize: 9, fontWeight: 700, bgcolor: 'action.hover' }} />
                          <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
                            {s.es_vigente
                              ? `Vence en ${s.dias_para_vencer} día${s.dias_para_vencer !== 1 ? 's' : ''}`
                              : `Venció hace ${Math.abs(s.dias_para_vencer)} día${Math.abs(s.dias_para_vencer) !== 1 ? 's' : ''}`}
                          </Typography>
                        </Stack>
                      </Box>
                      <Typography sx={{
                        fontSize: 12, fontWeight: 700,
                        color: s.saldo_pendiente > 0 ? '#EF4444' : '#10B981',
                      }}>
                        {s.saldo_pendiente > 0
                          ? `Saldo: ${formatCurrency(s.saldo_pendiente)}`
                          : 'Pagada'}
                      </Typography>
                    </Box>
                  ))}
                </Stack>

                <FormControlLabel
                  control={
                    <Checkbox checked={cancelarSuscripciones}
                      onChange={(e) => setCancelarSusc(e.target.checked)} />
                  }
                  label={
                    <Typography sx={{ fontSize: 13, fontWeight: 600 }}>
                      Cancelar todas las suscripciones
                    </Typography>
                  }
                />

                {cancelarSuscripciones && bajaInfo.saldo_total_pendiente > 0 && (
                  <Box sx={{ ml: 4 }}>
                    <FormControlLabel
                      control={
                        <Checkbox checked={marcarIncobrable}
                          onChange={(e) => setMarcarIncobrable(e.target.checked)} />
                      }
                      label={
                        <Typography sx={{ fontSize: 12 }}>
                          Marcar saldo de {formatCurrency(bajaInfo.saldo_total_pendiente)} como incobrable
                          <Typography component="span" sx={{ fontSize: 11, color: 'text.secondary', display: 'block' }}>
                            (Para reportes contables — el cliente ya no se cobrará)
                          </Typography>
                        </Typography>
                      }
                    />
                  </Box>
                )}
              </Box>
            )}

            {/* ─── BLOQUE: Accesos abiertos ───────────────────────────── */}
            {bajaInfo.accesos_abiertos.length > 0 && (
              <Box sx={{
                p: 2, mb: 2, borderRadius: 2,
                border: '1px solid', borderColor: 'divider',
                bgcolor: 'rgba(59, 130, 246, 0.05)',
              }}>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                  <AccessTime sx={{ color: '#3B82F6', fontSize: 18 }} />
                  <Typography sx={{ fontWeight: 700, fontSize: 13 }}>
                    {bajaInfo.accesos_abiertos.length} acceso por horas abierto
                    {bajaInfo.accesos_abiertos.length > 1 ? 's' : ''}
                  </Typography>
                </Stack>

                {bajaInfo.accesos_abiertos.map((a) => (
                  <Box key={a.id} sx={{
                    p: 1, mb: 0.5, bgcolor: 'background.paper', borderRadius: 1,
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}>
                    <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
                      Dentro hace {a.minutos_dentro} min
                    </Typography>
                    <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#3B82F6' }}>
                      Cobro est: {formatCurrency(a.monto_estimado)}
                    </Typography>
                  </Box>
                ))}

                <RadioGroup
                  value={accionAcceso}
                  onChange={(e) => setAccionAcceso(e.target.value)}
                  sx={{ mt: 1 }}
                >
                  <FormControlLabel
                    value="cobrar"
                    control={<Radio size="small" />}
                    label={
                      <Stack direction="row" spacing={0.5} alignItems="center">
                        <AttachMoney sx={{ fontSize: 16, color: '#10B981' }} />
                        <Typography sx={{ fontSize: 12 }}>
                          Cobrar y cerrar (recomendado)
                        </Typography>
                      </Stack>
                    }
                  />
                  <FormControlLabel
                    value="cerrar"
                    control={<Radio size="small" />}
                    label={
                      <Stack direction="row" spacing={0.5} alignItems="center">
                        <ExitToApp sx={{ fontSize: 16, color: '#94A3B8' }} />
                        <Typography sx={{ fontSize: 12 }}>
                          Solo cerrar sin cobrar
                        </Typography>
                      </Stack>
                    }
                  />
                </RadioGroup>

                {accionAcceso === 'cobrar' && (
                  <TextField
                    select size="small" fullWidth
                    label="Método de pago"
                    value={metodoPagoAcceso}
                    onChange={(e) => setMetodoPagoAcceso(e.target.value)}
                    sx={{ mt: 1 }}
                  >
                    {METODOS_PAGO.map(m => (
                      <MenuItem key={m} value={m}>{m}</MenuItem>
                    ))}
                  </TextField>
                )}
              </Box>
            )}
          </>
        )}

        {/* ─── Motivo (siempre visible) ─────────────────────────────── */}
        {!loading && !error && (
          <TextField
            fullWidth size="small" multiline rows={2}
            label="Motivo (opcional)"
            placeholder="Ej: Cliente se mudó de ciudad"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            inputProps={{ maxLength: 500 }}
            sx={{ mt: 1 }}
          />
        )}
      </DialogContent>

      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} disabled={submitting}>
          Cancelar
        </Button>
        <Button
          variant="contained" color="error"
          onClick={handleConfirmar}
          disabled={loading || submitting || !!error || !puedeConfirmar()}
          startIcon={submitting ? <CircularProgress size={16} color="inherit" /> : <Delete />}
        >
          {submitting ? 'Procesando…' : 'Dar de baja'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
