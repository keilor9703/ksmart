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
  Button, Alert, useTheme, useMediaQuery
} from '@mui/material';
import {
  LocalParking, TrendingUp, Warning, ErrorOutline, CheckCircle,
  Refresh, Search, AccessTime, TwoWheeler, Timer, AttachMoney
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import apiClient from '../../api';
import { formatCurrency } from '../../utils/formatters';
import usePolling from '../../hooks/usePolling';
import BotonWhatsApp from '../../components/common/BotonWhatsApp';   // ✨ NUEVO
import SaaSUpgradeManager from '../saas/components/SaaSUpgradeManager';
import HelpGuideTopBar from '../../components/onboarding/HelpGuideTopBar';

const ACCENT = '#0891B2';

export default function ParqueaderoDashboard({ user }) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [reporte, setReporte]             = useState(null);
  const [loadingReporte, setLoadingReporte] = useState(false);
  const navigate              = useNavigate();
  const theme                 = useTheme();
  const isMobile              = useMediaQuery(theme.breakpoints.down('sm'));

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

  const cargarReporte = React.useCallback(async () => {
    setLoadingReporte(true);
    try {
      const hoy = new Date();
      const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toLocaleDateString('en-CA');
      const hoyStr = hoy.toLocaleDateString('en-CA');
      const { data } = await apiClient.get('/parqueadero/reportes/ingresos', {
        params: { start_date: inicioMes, end_date: hoyStr }
      });
      setReporte(data);
    } catch {
      /* silent — reporte is optional */
    } finally {
      setLoadingReporte(false);
    }
  }, []);

  useEffect(() => {
    cargar();
    cargarReporte();
  }, [cargar, cargarReporte]);
  // Refresco cada 60s; se pausa si la pestaña está oculta.
  usePolling(() => cargar(true), 60000);

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
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, gap: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{
            width: 38, height: 38, borderRadius: 2,
            bgcolor: `${ACCENT}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <LocalParking sx={{ fontSize: 20, color: ACCENT }} />
          </Box>
          <Box>
            <Typography sx={{ fontSize: 18, fontWeight: 700, lineHeight: 1.2 }}>
              Panel del parqueadero
            </Typography>
            <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
              {new Date().toLocaleDateString('es-CO', {
                weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
              })}
            </Typography>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, flexShrink: 0, alignItems: 'center' }}>
          <HelpGuideTopBar
            moduleName="Parqueadero"
            moduleColor={ACCENT}
            steps={[
              { title: 'Verifica el estado del parqueadero', description: 'El panel muestra el cupo disponible, vehículos activos y alertas de suscripciones vencidas.' },
              { title: 'Gestiona entradas y salidas', description: 'Usa "Buscar Placa" para registrar entradas por hora o verificar el estado de suscripciones mensuales.' },
              { title: 'Cobra suscripciones vencidas', description: 'Los clientes con suscripción vencida aparecen en rojo. Haz clic en "Cobrar" para renovar.' },
              { title: 'Envía recordatorios por WhatsApp', description: 'Los botones de WhatsApp envían mensajes automáticos de cobro a clientes con saldo pendiente.' },
            ]}
            faqItems={[
              { q: '¿Cómo registro la entrada de un vehículo?', a: 'Ve a "Buscar Placa", escribe la placa y selecciona "Entrada de vehículo". Si es primera vez, el sistema pedirá los datos del propietario.' },
              { q: '¿Qué significa cupo disponible?', a: 'Es la diferencia entre el cupo total configurado y los vehículos actualmente dentro del parqueadero.' },
              { q: '¿Cómo cobro una suscripción vencida?', a: 'En la lista de suscripciones vencidas, haz clic en "Cobrar" y selecciona el método de pago. La suscripción se renueva automáticamente.' },
              { q: '¿Cómo configuro el cupo total?', a: 'Ve al módulo "Config Parqueadero" y establece el número máximo de vehículos que puede albergar el parqueadero.' },
            ]}
          />
          <Button
            variant="contained" startIcon={<Search />}
            onClick={() => navigate('/parqueadero/buscar')}
            sx={{ bgcolor: ACCENT, '&:hover': { bgcolor: '#0e7490' }, fontWeight: 700, textTransform: 'none', borderRadius: 2 }}
          >
            {isMobile ? 'Buscar' : 'Buscar placa'}
          </Button>
          <Tooltip title="Actualizar">
            <IconButton onClick={() => cargar()} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
              <Refresh />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

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
        <KpiCard xs={6} md={2.4} label="Vencidas" value={data?.vencidas || 0}
          icon={<ErrorOutline />} color="#EF4444" subtitle="Renovar urgente" />
        <KpiCard xs={6} md={2.4} label="Por vencer (5d)" value={data?.por_vencer_5_dias || 0}
          icon={<Warning />} color="#F59E0B" subtitle="Avisar al cliente" />
        <KpiCard xs={6} md={2.4} label="Ingresos hoy" value={formatCurrency(data?.ingresos_hoy || 0)}
          icon={<AttachMoney />} color="#10B981"
          subtitle={`Semana: ${formatCurrency(data?.ingresos_semana || 0)}`} />
        <KpiCard xs={6} md={2.4} label="Ingresos del mes" value={formatCurrency(data?.ingresos_mes || 0)}
          icon={<TrendingUp />} color="#3B82F6"
          subtitle={`Desde el 1° del mes`} />
        <KpiCard xs={12} md={2.4} label="Mensualidades activas" value={data?.mensualidades_activas || 0}
          icon={<LocalParking />} color={ACCENT}
          subtitle={`${(data?.accesos_dentro || []).length} por horas dentro`} />
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
              titulo="Vehículos dentro pagando por horas"
              icono={<Timer sx={{ color: '#3B82F6' }} />}
              color="#3B82F6"
              items={data.accesos_dentro}
              empty="No hay vehículos por horas dentro."
              renderItem={(a) => <AccesoItem acceso={a} navigate={navigate} />}
            />
          </Grid>
        )}
      </Grid>

      {/* ─── Desglose de ingresos del mes ────────────────────────── */}
      {(reporte || loadingReporte) && (
        <Paper sx={{ p: { xs: 2, md: 3 }, mt: 2, borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <TrendingUp sx={{ color: '#3B82F6', fontSize: 20 }} />
              <Typography sx={{ fontSize: 14, fontWeight: 800 }}>
                Desglose de ingresos — mes actual
              </Typography>
            </Stack>
            {loadingReporte && <Skeleton variant="rounded" width={80} height={20} />}
          </Stack>

          {reporte && (
            <Grid container spacing={2}>

              {/* Por tipo */}
              <Grid item xs={12} md={6}>
                <Typography sx={{ fontSize: 11, fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.5, mb: 1.5 }}>
                  Por tipo de suscripción
                </Typography>
                <Stack spacing={1}>
                  {[
                    { key: 'mensual',    label: 'Mensual',    color: '#10B981' },
                    { key: 'quincenal',  label: 'Quincenal',  color: '#3B82F6' },
                    { key: 'diaria',     label: 'Diaria',     color: '#F59E0B' },
                    { key: 'por_horas',  label: 'Por horas',  color: ACCENT },
                  ].map(({ key, label, color }) => {
                    const val = reporte.desglose_por_tipo?.[key] || 0;
                    const total = reporte.total_general || 1;
                    const pct = Math.round((val / total) * 100);
                    return (
                      <Box key={key}>
                        <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.3 }}>
                          <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{label}</Typography>
                          <Stack direction="row" spacing={1}>
                            <Typography sx={{ fontSize: 12, fontWeight: 700, color }}>{pct}%</Typography>
                            <Typography sx={{ fontSize: 12, fontWeight: 800 }}>{formatCurrency(val)}</Typography>
                          </Stack>
                        </Stack>
                        <LinearProgress
                          variant="determinate" value={Math.min(pct, 100)}
                          sx={{ height: 6, borderRadius: 3, bgcolor: `${color}20`,
                            '& .MuiLinearProgress-bar': { bgcolor: color, borderRadius: 3 } }}
                        />
                      </Box>
                    );
                  })}
                </Stack>
              </Grid>

              {/* Por método de pago */}
              <Grid item xs={12} md={6}>
                <Typography sx={{ fontSize: 11, fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.5, mb: 1.5 }}>
                  Por método de pago
                </Typography>
                {Object.keys(reporte.desglose_por_metodo || {}).length === 0 ? (
                  <Typography sx={{ fontSize: 12, color: 'text.disabled' }}>Sin cobros registrados este mes.</Typography>
                ) : (
                  <Stack spacing={1}>
                    {Object.entries(reporte.desglose_por_metodo || {})
                      .filter(([, v]) => v > 0)
                      .sort(([, a], [, b]) => b - a)
                      .map(([metodo, valor]) => {
                        const total = reporte.total_general || 1;
                        const pct = Math.round((valor / total) * 100);
                        const color = metodo === 'Efectivo' ? '#10B981' : metodo === 'Nequi' ? '#8B5CF6' : metodo === 'Transferencia' ? '#3B82F6' : '#F59E0B';
                        return (
                          <Box key={metodo}>
                            <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.3 }}>
                              <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{metodo}</Typography>
                              <Stack direction="row" spacing={1}>
                                <Typography sx={{ fontSize: 12, fontWeight: 700, color }}>{pct}%</Typography>
                                <Typography sx={{ fontSize: 12, fontWeight: 800 }}>{formatCurrency(valor)}</Typography>
                              </Stack>
                            </Stack>
                            <LinearProgress
                              variant="determinate" value={Math.min(pct, 100)}
                              sx={{ height: 6, borderRadius: 3, bgcolor: `${color}20`,
                                '& .MuiLinearProgress-bar': { bgcolor: color, borderRadius: 3 } }}
                            />
                          </Box>
                        );
                      })}
                  </Stack>
                )}
              </Grid>

              {/* Total general */}
              <Grid item xs={12}>
                <Box sx={{ pt: 1.5, borderTop: '1px dashed', borderColor: 'divider',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography sx={{ fontSize: 13, color: 'text.secondary', fontWeight: 600 }}>
                    Total acumulado este mes
                  </Typography>
                  <Typography sx={{ fontSize: 20, fontWeight: 900, color: '#10B981' }}>
                    {formatCurrency(reporte.total_general || 0)}
                  </Typography>
                </Box>
              </Grid>

            </Grid>
          )}
        </Paper>
      )}
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
