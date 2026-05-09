// ═══════════════════════════════════════════════════════════════════════════
// ParqueaderoDashboard.jsx — VERSIÓN 2 (con botones WhatsApp en cada item)
// REEMPLAZA tu archivo /components/ParqueaderoDashboard.jsx por este.
//
// Cambios respecto a v1:
//   ✨ Botón WhatsApp pequeño en cada item de "Por vencer" y "Vencidas"
//   ✨ Cliente puede ser cobrado en 2 clicks desde el dashboard
// ═══════════════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Paper, Typography, Grid, Stack, Chip, Avatar, Skeleton, IconButton,
  LinearProgress, Tooltip, List, ListItem, ListItemText, ListItemAvatar, Divider,
  Button, Alert
} from '@mui/material';
import {
  LocalParking, TrendingUp, Warning, ErrorOutline, CheckCircle,
  Refresh, Search, AccessTime, TwoWheeler, Timer, AttachMoney
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import apiClient from '../../api';
import { formatCurrency } from '../../utils/formatters';
import BotonWhatsApp from '../../components/common/BotonWhatsApp';   // ✨ NUEVO
import SaaSUpgradeManager from '../saas/components/SaaSUpgradeManager';

const ACCENT = '#FF6020';

export default function ParqueaderoDashboard({ user }) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const navigate              = useNavigate();

  const cargar = useCallback(async (silencioso = false) => {
    if (!silencioso) setLoading(true);
    try {
      const { data } = await apiClient.get('/parqueadero/dashboard');
      setData(data);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al cargar el panel.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargar();
    const id = setInterval(() => cargar(true), 60000);
    return () => clearInterval(id);
  }, [cargar]);

  if (loading && !data) {
    return (
      <Box sx={{ p: 2 }}>
        <Skeleton variant="rounded" height={120} sx={{ mb: 2 }} />
        <Grid container spacing={2}>
          {[1, 2, 3, 4].map(i => (
            <Grid item xs={6} md={3} key={i}>
              <Skeleton variant="rounded" height={100} />
            </Grid>
          ))}
        </Grid>
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error" sx={{ m: 2 }}>{error}</Alert>;
  }

  const pctOcup = data?.porcentaje_ocupacion || 0;
  const colorCupo = pctOcup >= 90 ? '#EF4444' : pctOcup >= 70 ? '#F59E0B' : '#10B981';

  return (
    <Box sx={{ p: { xs: 1, md: 2 }, maxWidth: 1400, mx: 'auto' }}>

      {/* ─── SaaS Activation Manager (Trial Banner & Upgrade Modal) ─── */}
      <SaaSUpgradeManager user={user} />

      {/* ─── Encabezado ─────────────────────────────────────────── */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Box>
          <Typography sx={{ fontSize: 22, fontWeight: 800, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            Panel del parqueadero
          </Typography>
          <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>
            {new Date().toLocaleDateString('es-CO', {
              weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
            })}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button
            variant="contained" startIcon={<Search />}
            onClick={() => navigate('/parqueadero/buscar')}
            sx={{ bgcolor: ACCENT, '&:hover': { bgcolor: '#e6561c' }, fontWeight: 700 }}
          >
            Buscar placa
          </Button>
          <Tooltip title="Actualizar">
            <IconButton onClick={() => cargar()} sx={{ border: '1px solid', borderColor: 'divider' }}>
              <Refresh />
            </IconButton>
          </Tooltip>
        </Stack>
      </Stack>

      {/* ─── Cupo banner ────────────────────────────────────────── */}
      <Paper sx={{
        p: 3, mb: 3, borderRadius: 3,
        background: `linear-gradient(135deg, ${colorCupo}15 0%, ${colorCupo}25 100%)`,
        border: '1px solid', borderColor: `${colorCupo}40`,
      }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={5}>
            <Stack direction="row" spacing={2} alignItems="center">
              <Avatar sx={{ bgcolor: colorCupo, width: 56, height: 56 }}>
                <LocalParking sx={{ fontSize: 32 }} />
              </Avatar>
              <Box>
                <Typography sx={{ fontSize: 12, fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 1 }}>
                  Cupo disponible
                </Typography>
                <Typography sx={{ fontSize: 36, fontWeight: 900, lineHeight: 1.1, color: colorCupo }}>
                  {data?.cupo_disponible || 0}
                  <Typography component="span" sx={{ fontSize: 16, color: 'text.secondary', ml: 0.5 }}>
                    / {data?.cupo_total || 0}
                  </Typography>
                </Typography>
              </Box>
            </Stack>
          </Grid>
          <Grid item xs={12} md={7}>
            <Stack spacing={0.5} sx={{ mb: 1 }}>
              <Stack direction="row" justifyContent="space-between">
                <Typography sx={{ fontSize: 12, fontWeight: 700 }}>Ocupación</Typography>
                <Typography sx={{ fontSize: 12, fontWeight: 800, color: colorCupo }}>
                  {pctOcup}% · {data?.cupo_ocupado_estimado || 0} ocupado{data?.cupo_ocupado_estimado !== 1 ? 's' : ''}
                </Typography>
              </Stack>
              <LinearProgress
                variant="determinate" value={Math.min(100, pctOcup)}
                sx={{
                  height: 8, borderRadius: 4,
                  bgcolor: 'rgba(0,0,0,0.06)',
                  '& .MuiLinearProgress-bar': { bgcolor: colorCupo },
                }}
              />
            </Stack>
            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
              <Chip size="small" icon={<TwoWheeler />}
                label={`${data?.mensualidades_activas || 0} mensuales activas`}
                sx={{ bgcolor: 'background.paper', fontWeight: 600 }} />
              <Chip size="small" icon={<AccessTime />}
                label={`${(data?.accesos_dentro || []).length} por horas`}
                sx={{ bgcolor: 'background.paper', fontWeight: 600 }} />
              <Chip size="small" icon={<TwoWheeler />}
                label={`${data?.total_vehiculos || 0} motos registradas`}
                sx={{ bgcolor: 'background.paper', fontWeight: 600 }} />
            </Stack>
          </Grid>
        </Grid>
      </Paper>

      {/* ─── KPIs ──────────────────────────────────────────────── */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <KpiCard xs={6} md={3} label="Vencidas" value={data?.vencidas || 0}
          icon={<ErrorOutline />} color="#EF4444" subtitle="Renovar urgente" />
        <KpiCard xs={6} md={3} label="Por vencer (5 días)" value={data?.por_vencer_5_dias || 0}
          icon={<Warning />} color="#F59E0B" subtitle="Avisar al cliente" />
        <KpiCard xs={6} md={3} label="Ingresos hoy" value={formatCurrency(data?.ingresos_hoy || 0)}
          icon={<AttachMoney />} color="#10B981"
          subtitle={`Mes: ${formatCurrency(data?.ingresos_mes || 0)}`} />
        <KpiCard xs={6} md={3} label="Ingresos semana" value={formatCurrency(data?.ingresos_semana || 0)}
          icon={<TrendingUp />} color="#3B82F6" subtitle="Últimos 7 días" />
      </Grid>

      {/* ─── Listas ─────────────────────────────────────────────── */}
      <Grid container spacing={2}>

        <Grid item xs={12} md={6}>
          <ListaPanel
            titulo="Mensualidades vencidas"
            icono={<ErrorOutline sx={{ color: '#EF4444' }} />}
            color="#EF4444"
            items={data?.suscripciones_vencidas || []}
            empty="No hay mensualidades vencidas. ¡Todo en orden!"
            renderItem={(s) => (
              <SubscItem
                placa={s.placa} propietario={s.propietario} telefono={s.telefono}
                fechaVence={s.fecha_vence} dias={s.dias_vencido} tipoDias="vencido"
                tipo={s.tipo}
                vehiculoId={s.vehiculo_id}
                suscripcionId={s.suscripcion_id}
                tipoMensaje="pago"
                onClick={() => navigate(`/parqueadero/buscar?placa=${s.placa}`)}
              />
            )}
          />
        </Grid>

        <Grid item xs={12} md={6}>
          <ListaPanel
            titulo="Por vencer (próximos 5 días)"
            icono={<Warning sx={{ color: '#F59E0B' }} />}
            color="#F59E0B"
            items={data?.proximos_vencimientos || []}
            empty="Ningún vencimiento próximo."
            renderItem={(s) => (
              <SubscItem
                placa={s.placa} propietario={s.propietario} telefono={s.telefono}
                fechaVence={s.fecha_vence} dias={s.dias_restantes} tipoDias="restante"
                tipo={s.tipo}
                vehiculoId={s.vehiculo_id}
                suscripcionId={s.suscripcion_id}
                tipoMensaje="recordatorio"
                onClick={() => navigate(`/parqueadero/buscar?placa=${s.placa}`)}
              />
            )}
          />
        </Grid>

        {(data?.accesos_dentro || []).length > 0 && (
          <Grid item xs={12}>
            <ListaPanel
              titulo="Motos dentro pagando por horas"
              icono={<Timer sx={{ color: '#3B82F6' }} />}
              color="#3B82F6"
              items={data.accesos_dentro}
              empty="No hay motos por horas dentro."
              renderItem={(a) => <AccesoItem acceso={a} navigate={navigate} />}
            />
          </Grid>
        )}
      </Grid>
    </Box>
  );
}


// ═══════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTES
// ═══════════════════════════════════════════════════════════════════════════

function KpiCard({ xs, md, label, value, icon, color, subtitle }) {
  return (
    <Grid item xs={xs} md={md}>
      <Paper sx={{
        p: 2, borderRadius: 3, height: '100%',
        border: '1px solid', borderColor: 'divider',
        transition: 'all 0.2s',
        '&:hover': { borderColor: color, boxShadow: `0 4px 16px ${color}25` },
      }}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
          <Box>
            <Typography sx={{ fontSize: 11, fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              {label}
            </Typography>
            <Typography sx={{ fontSize: 22, fontWeight: 900, mt: 0.5, color, lineHeight: 1.1 }}>
              {value}
            </Typography>
            {subtitle && (
              <Typography sx={{ fontSize: 11, color: 'text.secondary', mt: 0.5 }}>
                {subtitle}
              </Typography>
            )}
          </Box>
          <Avatar sx={{ bgcolor: `${color}15`, color, width: 36, height: 36 }}>
            {icon}
          </Avatar>
        </Stack>
      </Paper>
    </Grid>
  );
}

function ListaPanel({ titulo, icono, color, items, empty, renderItem }) {
  return (
    <Paper sx={{ borderRadius: 3, height: '100%', border: '1px solid', borderColor: 'divider', overflow: 'hidden' }}>
      <Box sx={{
        p: 2, bgcolor: `${color}10`, borderBottom: '1px solid',
        borderColor: `${color}25`,
      }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          {icono}
          <Typography sx={{ fontSize: 14, fontWeight: 800 }}>{titulo}</Typography>
          <Chip size="small" label={items.length}
            sx={{ ml: 'auto', fontWeight: 800, bgcolor: color, color: 'white' }} />
        </Stack>
      </Box>
      <Box sx={{ maxHeight: 360, overflowY: 'auto' }}>
        {items.length === 0 ? (
          <Box sx={{ p: 3, textAlign: 'center', color: 'text.secondary' }}>
            <CheckCircle sx={{ fontSize: 40, opacity: 0.3, mb: 1 }} />
            <Typography sx={{ fontSize: 13 }}>{empty}</Typography>
          </Box>
        ) : (
          <List dense disablePadding>
            {items.map((item, idx) => (
              <React.Fragment key={item.suscripcion_id || item.id || idx}>
                {renderItem(item)}
                {idx < items.length - 1 && <Divider component="li" />}
              </React.Fragment>
            ))}
          </List>
        )}
      </Box>
    </Paper>
  );
}

function SubscItem({
  placa, propietario, telefono, fechaVence, dias, tipoDias, tipo,
  vehiculoId, suscripcionId, tipoMensaje, onClick,
}) {
  const esVencido = tipoDias === 'vencido';

  return (
    <ListItem
      sx={{
        py: 1.2, cursor: 'pointer',
        '&:hover': { bgcolor: 'action.hover' },
      }}
      onClick={onClick}
      secondaryAction={
        telefono && (
          <Box onClick={(e) => e.stopPropagation()}>
            <BotonWhatsApp
              vehiculoId={vehiculoId}
              suscripcionId={suscripcionId}
              tipo={tipoMensaje}
              variante="icon"
              tamano="small"
              telefono={telefono}
            />
          </Box>
        )
      }
    >
      <ListItemAvatar>
        <Avatar sx={{
          bgcolor: esVencido ? '#FEE2E2' : '#FEF3C7',
          color:   esVencido ? '#991B1B' : '#78350F',
          width: 40, height: 40,
        }}>
          <TwoWheeler />
        </Avatar>
      </ListItemAvatar>
      <ListItemText
        primary={
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ pr: 5 }}>
            <Typography sx={{ fontFamily: 'monospace', fontWeight: 800, fontSize: 14, letterSpacing: 1 }}>
              {placa}
            </Typography>
            <Chip
              size="small"
              label={tipo?.toUpperCase()}
              sx={{ height: 18, fontSize: 9, fontWeight: 700, bgcolor: 'action.hover' }}
            />
          </Stack>
        }
        secondary={
          <Stack spacing={0.3}>
            <Typography sx={{ fontSize: 12, color: 'text.primary' }} noWrap>{propietario}</Typography>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: 'wrap' }}>
              {telefono && (
                <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
                  📱 {telefono}
                </Typography>
              )}
              <Typography sx={{
                fontSize: 11, fontWeight: 700,
                color: esVencido ? '#EF4444' : (dias <= 2 ? '#F59E0B' : '#10B981'),
              }}>
                {esVencido
                  ? `Vencida hace ${dias} día${dias !== 1 ? 's' : ''}`
                  : (dias === 0 ? 'Vence HOY' : `Vence en ${dias} día${dias !== 1 ? 's' : ''}`)}
              </Typography>
            </Stack>
          </Stack>
        }
      />
    </ListItem>
  );
}

function AccesoItem({ acceso, navigate }) {
  // Fix para evitar horas negativas (fuerza la interpretación de la fecha en UTC si falta la 'Z')
  const fechaStr = acceso.fecha_entrada.endsWith('Z') ? acceso.fecha_entrada : `${acceso.fecha_entrada}Z`;
  const entrada = new Date(fechaStr);
  const ahora = new Date();
  
  // Calculamos las horas y evitamos que se muestren números negativos
  let horas = ((ahora - entrada) / 3600000).toFixed(1);
  if (horas < 0) horas = "0.0";

  return (
    <ListItem
      sx={{ py: 1.2, cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}
      onClick={() => navigate(`/parqueadero/buscar?placa=${acceso.placa}`)}
      // secondaryAction={
      //   // Quitamos la condición de vehiculo_id para que el botón SIEMPRE aparezca
      //   <Box onClick={(e) => e.stopPropagation()}>
      //     <BotonWhatsApp
      //       vehiculoId={acceso.vehiculo_id} // Si es ocasional será null/undefined, tu BotonWhatsApp debería manejarlo
      //       placa={acceso.placa}
      //       tipo="manual" 
      //       variante="icon"
      //       tamano="small"
      //       telefono={acceso.telefono || acceso.cliente_telefono} 
      //     />
      //   </Box>
      // }
    >
      <ListItemAvatar>
        <Avatar sx={{ bgcolor: '#DBEAFE', color: '#1E40AF', width: 40, height: 40 }}>
          <Timer />
        </Avatar>
      </ListItemAvatar>
      <ListItemText
        primary={
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ pr: 5 }}>
            <Typography sx={{ fontFamily: 'monospace', fontWeight: 800, fontSize: 14, letterSpacing: 1 }}>
              {acceso.placa}
            </Typography>
            <Chip size="small" label={`${horas}h dentro`}
              sx={{ height: 18, fontSize: 10, fontWeight: 700, bgcolor: '#3B82F6', color: 'white' }} />
          </Stack>
        }
        secondary={
          <Stack spacing={0.3}>
            <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
              Entró: {entrada.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
              {acceso.observaciones && ` · ${acceso.observaciones}`}
            </Typography>
            {(acceso.telefono || acceso.cliente_telefono) && (
              <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
                📱 {acceso.telefono || acceso.cliente_telefono}
              </Typography>
            )}
          </Stack>
        }
      />
    </ListItem>
  );
}