import React, { useState, useCallback } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Box, Typography, Button, CircularProgress, Divider,
  Grid, Paper, alpha, Chip,
} from '@mui/material';
import {
  TrendingUp, Restaurant, TableRestaurant, CreditCard,
  AttachMoney, Payments, Close, WifiProtectedSetup,
} from '@mui/icons-material';
import { toast } from 'react-toastify';
import apiClient from '../../api';

const ACCENT = '#6366F1';
const fmt = (n) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n || 0);

const KPI = ({ icon, label, value, color }) => (
  <Paper elevation={0} sx={{ p: 2, borderRadius: 2, border: '1px solid rgba(0,0,0,0.08)', textAlign: 'center' }}>
    <Box sx={{ display: 'flex', justifyContent: 'center', mb: 0.5 }}>
      {React.cloneElement(icon, { sx: { color: color || ACCENT, fontSize: 28 } })}
    </Box>
    <Typography sx={{ fontSize: 22, fontWeight: 800 }}>{value}</Typography>
    <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{label}</Typography>
  </Paper>
);

export default function ResumenTurno({ open, onClose }) {
  const [loading, setLoading] = useState(false);
  const [data, setData]       = useState(null);

  const fetchResumen = useCallback(async () => {
    if (!open) return;
    setLoading(true);
    try {
      const res = await apiClient.get('/restaurante/turno/resumen');
      setData(res.data);
    } catch {
      toast.error('Error al cargar el resumen del turno');
    } finally {
      setLoading(false);
    }
  }, [open]);

  // Cargar cuando se abre
  React.useEffect(() => {
    if (open) fetchResumen();
  }, [open, fetchResumen]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <WifiProtectedSetup sx={{ color: ACCENT }} />
          Resumen del turno
        </Box>
        <Button size="small" onClick={onClose} sx={{ minWidth: 0 }}><Close /></Button>
      </DialogTitle>
      <DialogContent>
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}>
            <CircularProgress sx={{ color: ACCENT }} />
          </Box>
        )}

        {!loading && data && (
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
              Datos del día: {data.fecha}
            </Typography>

            {/* KPIs principales */}
            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid item xs={6}>
                <KPI icon={<TrendingUp />} label="Total vendido hoy" value={fmt(data.total_ventas)} color={ACCENT} />
              </Grid>
              <Grid item xs={6}>
                <KPI icon={<Restaurant />} label="Comandas cerradas" value={data.num_comandas} color="#3B82F6" />
              </Grid>
              <Grid item xs={6}>
                <KPI icon={<TableRestaurant />} label="Ticket promedio" value={fmt(data.ticket_promedio)} color="#10B981" />
              </Grid>
              <Grid item xs={6}>
                <KPI icon={<TableRestaurant />} label="Mesas abiertas" value={data.mesas_abiertas} color="#F59E0B" />
              </Grid>
            </Grid>

            <Divider sx={{ my: 2 }} />

            {/* Desglose por método de pago */}
            <Typography sx={{ fontWeight: 700, mb: 1.5, fontSize: 14 }}>Desglose por método de pago</Typography>
            {data.por_metodo?.length > 0 ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 2 }}>
                {data.por_metodo.map(m => (
                  <Box key={m.metodo} sx={{ display: 'flex', justifyContent: 'space-between', p: 1.5, borderRadius: 1.5, bgcolor: 'rgba(0,0,0,0.03)' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {m.metodo?.toLowerCase().includes('efectivo') ? (
                        <AttachMoney sx={{ color: '#16A34A', fontSize: 18 }} />
                      ) : (
                        <CreditCard sx={{ color: '#3B82F6', fontSize: 18 }} />
                      )}
                      <Typography sx={{ fontSize: 14, fontWeight: 500 }}>{m.metodo}</Typography>
                    </Box>
                    <Typography sx={{ fontSize: 14, fontWeight: 700 }}>{fmt(m.total)}</Typography>
                  </Box>
                ))}
              </Box>
            ) : (
              <Typography color="text.secondary" sx={{ fontSize: 13, mb: 2 }}>Sin ventas aún en el turno</Typography>
            )}

            {/* Propinas */}
            {(data.propina_tarjeta > 0 || data.propina_efectivo > 0) && (
              <>
                <Divider sx={{ my: 2 }} />
                <Typography sx={{ fontWeight: 700, mb: 1.5, fontSize: 14 }}>Propinas</Typography>
                <Box sx={{ display: 'flex', gap: 2 }}>
                  {data.propina_tarjeta > 0 && (
                    <Box sx={{ flex: 1, p: 1.5, borderRadius: 1.5, bgcolor: alpha('#3B82F6', 0.08), textAlign: 'center' }}>
                      <CreditCard sx={{ color: '#3B82F6', fontSize: 20, mb: 0.5 }} />
                      <Typography sx={{ fontSize: 15, fontWeight: 700 }}>{fmt(data.propina_tarjeta)}</Typography>
                      <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>Propina tarjeta</Typography>
                    </Box>
                  )}
                  {data.propina_efectivo > 0 && (
                    <Box sx={{ flex: 1, p: 1.5, borderRadius: 1.5, bgcolor: alpha('#16A34A', 0.08), textAlign: 'center' }}>
                      <AttachMoney sx={{ color: '#16A34A', fontSize: 20, mb: 0.5 }} />
                      <Typography sx={{ fontSize: 15, fontWeight: 700 }}>{fmt(data.propina_efectivo)}</Typography>
                      <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>Propina efectivo</Typography>
                    </Box>
                  )}
                </Box>
              </>
            )}
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={fetchResumen} disabled={loading} variant="outlined" sx={{ borderColor: ACCENT, color: ACCENT }}>
          Actualizar
        </Button>
        <Button onClick={onClose} variant="contained" sx={{ bgcolor: ACCENT, '&:hover': { bgcolor: '#e55516' } }}>
          Cerrar
        </Button>
      </DialogActions>
    </Dialog>
  );
}
