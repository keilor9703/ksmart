import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Paper, Grid, CircularProgress,
  Divider, Chip, useMediaQuery
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  MonetizationOn, AccountBalanceWallet, Warning,
  Assignment, TrendingUp, ShoppingCart, Inventory2Outlined,
  CheckCircle
} from '@mui/icons-material';
import apiClient from '../api';
import { formatCurrency } from '../utils/formatters';

const ACCENT  = '#FF6020';
const GREEN   = '#10B981';
const BLUE    = '#3B82F6';
const YELLOW  = '#F59E0B';
const RED     = '#EF4444';
const PURPLE  = '#8B5CF6';

// ─── KPI Card ─────────────────────────────────────────────────────────────────
const KpiCard = ({ title, value, icon, color, sub, onClick }) => (
  <Paper
    onClick={onClick}
    sx={{
      p: 2, borderRadius: 3,
      display: 'flex', alignItems: 'center', gap: 1.5,
      boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
      cursor: onClick ? 'pointer' : 'default',
      transition: 'transform 0.15s, box-shadow 0.15s',
      width: '100%', boxSizing: 'border-box',
      '&:hover': onClick ? { transform: 'translateY(-2px)', boxShadow: '0 6px 20px rgba(0,0,0,0.1)' } : {},
    }}
  >
    <Box sx={{ width: 44, height: 44, borderRadius: 2, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: `${color}18`, color }}>
      {icon}
    </Box>
    <Box sx={{ minWidth: 0, flex: 1 }}>
      <Typography sx={{ fontSize: 11, color: 'text.secondary', fontWeight: 500 }}>{title}</Typography>
      <Typography sx={{ fontSize: 18, fontWeight: 800, lineHeight: 1.2, color: 'text.primary' }}>{value}</Typography>
      {sub && <Typography sx={{ fontSize: 10, color: 'text.secondary', mt: 0.2 }}>{sub}</Typography>}
    </Box>
  </Paper>
);

// ─── Sparkline SVG nativa — nunca desborda, sin dependencias ─────────────────
const Sparkline = ({ data, color, height = 60 }) => {
  if (!data || data.length < 2) return null;

  const vals = data.map(d => d.total);
  const max  = Math.max(...vals, 1);
  const min  = Math.min(...vals);
  const range = max - min || 1;
  const W = 300, H = height;
  const pad = 4;

  const points = vals.map((v, i) => {
    const x = pad + (i / (vals.length - 1)) * (W - pad * 2);
    const y = H - pad - ((v - min) / range) * (H - pad * 2);
    return `${x},${y}`;
  }).join(' ');

  // Área bajo la curva
  const firstX = pad;
  const lastX  = pad + (W - pad * 2);
  const area   = `${firstX},${H - pad} ${points} ${lastX},${H - pad}`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: '100%', height }} aria-hidden>
      <defs>
        <linearGradient id={`sg-${color.replace('#','')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <polygon points={area} fill={`url(#sg-${color.replace('#','')})`} />
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {/* Punto final */}
      {vals.length > 0 && (() => {
        const last = vals.length - 1;
        const x = pad + (last / (vals.length - 1)) * (W - pad * 2);
        const y = H - pad - ((vals[last] - min) / range) * (H - pad * 2);
        return <circle cx={x} cy={y} r="4" fill={color} />;
      })()}
    </svg>
  );
};

// ─── Componente principal ──────────────────────────────────────────────────────
const Dashboard = () => {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const navigate = useNavigate();
  const isMobile = useMediaQuery(useTheme().breakpoints.down('sm'));

  useEffect(() => {
    apiClient.get('/reportes/dashboard')
      .then(r => { setData(r.data); setError(null); })
      .catch(() => setError('Error al cargar el dashboard.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
      <CircularProgress sx={{ color: ACCENT }} />
    </Box>
  );

  if (error) return (
    <Box sx={{ textAlign: 'center', py: 8 }}>
      <Typography color="error" sx={{ fontWeight: 600 }}>{error}</Typography>
    </Box>
  );

  // Calcular tendencia (último día vs promedio)
  const ventas30 = data.ventas_ultimos_30_dias || [];
  const totalUltimos30 = ventas30.reduce((s, d) => s + d.total, 0);
  const promediosDia   = ventas30.length ? totalUltimos30 / ventas30.length : 0;
  const ventaHoy       = data.ventas_hoy || 0;
  const tendencia      = promediosDia > 0 ? ((ventaHoy - promediosDia) / promediosDia * 100).toFixed(1) : 0;
  const tendenciaPos   = parseFloat(tendencia) >= 0;

  // Últimos 7 días para el mini-chart
  const ultimos7 = ventas30.slice(-7);

  return (
    <Box sx={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>

      {/* ── Header ── */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5 }}>
        <Box sx={{ width: 42, height: 42, borderRadius: 2, flexShrink: 0, bgcolor: `${ACCENT}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: ACCENT }}>
          <TrendingUp />
        </Box>
        <Box>
          <Typography sx={{ fontWeight: 700, fontSize: 20, lineHeight: 1.2 }}>Dashboard</Typography>
          <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>Resumen general del negocio</Typography>
        </Box>
      </Box>

      {/* ── KPIs principales ── */}
      <Grid container spacing={1.5} sx={{ mb: 2 }}>
        <Grid item xs={6} sm={3}>
          <KpiCard
            title="Ventas hoy" value={formatCurrency(ventaHoy)} icon={<MonetizationOn />} color={ACCENT}
            sub={`${tendenciaPos ? '▲' : '▼'} ${Math.abs(tendencia)}% vs promedio`}
            onClick={() => navigate('/ventas')}
          />
        </Grid>
        <Grid item xs={6} sm={3}>
          <KpiCard
            title="Cuentas por cobrar" value={formatCurrency(data.cuentas_por_cobrar)} icon={<AccountBalanceWallet />} color={BLUE}
            sub="Saldo pendiente clientes"
            onClick={() => navigate('/clientes')}
          />
        </Grid>
        <Grid item xs={6} sm={3}>
          <KpiCard
            title="Bajo stock" value={data.productos_bajo_stock} icon={<Warning />}
            color={data.productos_bajo_stock > 0 ? RED : GREEN}
            sub={data.productos_bajo_stock === 0 ? 'Todo en niveles normales' : 'Productos bajo mínimo'}
            onClick={() => navigate('/inventario')}
          />
        </Grid>
        <Grid item xs={6} sm={3}>
          <KpiCard
            title="Órdenes recientes" value={data.ordenes_recientes?.length || 0} icon={<Assignment />} color={PURPLE}
            sub="Últimas órdenes de trabajo"
            onClick={() => navigate('/ordenes-trabajo')}
          />
        </Grid>
      </Grid>

      <Grid container spacing={1.5}>

        {/* ── Gráfica de ventas 30 días ── */}
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 2.5, borderRadius: 3, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', height: '100%', boxSizing: 'border-box' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2, flexWrap: 'wrap', gap: 1 }}>
              <Box>
                <Typography sx={{ fontWeight: 700, fontSize: 15 }}>Ventas — últimos 30 días</Typography>
                <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
                  Total: <strong>{formatCurrency(totalUltimos30)}</strong>
                </Typography>
              </Box>
              <Chip
                label={`${tendenciaPos ? '▲' : '▼'} ${Math.abs(tendencia)}% hoy`}
                size="small"
                sx={{ bgcolor: tendenciaPos ? `${GREEN}15` : `${RED}15`, color: tendenciaPos ? GREEN : RED, fontWeight: 700, fontSize: 11 }}
              />
            </Box>

            {ventas30.length > 1 ? (
              <>
                <Sparkline data={ventas30} color={ACCENT} height={isMobile ? 80 : 120} />
                {/* Eje X con etiquetas */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5, px: 0.5 }}>
                  {[ventas30[0], ventas30[Math.floor(ventas30.length / 2)], ventas30[ventas30.length - 1]].map((d, i) => (
                    <Typography key={i} sx={{ fontSize: 10, color: 'text.secondary' }}>
                      {new Date(d.day + 'T00:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}
                    </Typography>
                  ))}
                </Box>
              </>
            ) : (
              <Box sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
                <TrendingUp sx={{ fontSize: 40, opacity: 0.2, mb: 1 }} />
                <Typography fontSize={13}>Sin datos de ventas registradas aún</Typography>
              </Box>
            )}

            {/* Mini resumen de los últimos 7 días */}
            {ultimos7.length > 0 && (
              <>
                <Divider sx={{ my: 2 }} />
                <Typography sx={{ fontSize: 11, fontWeight: 600, color: 'text.secondary', mb: 1, textTransform: 'uppercase', letterSpacing: 0.6 }}>
                  Últimos 7 días
                </Typography>
                <Box sx={{ display: 'flex', gap: 0.8, flexWrap: 'wrap' }}>
                  {ultimos7.map((d, i) => (
                    <Box key={i} sx={{
                      flex: '1 1 0', minWidth: 0, textAlign: 'center',
                      p: 0.8, borderRadius: 1.5,
                      bgcolor: d.total > promediosDia ? `${GREEN}10` : 'action.hover',
                    }}>
                      <Typography sx={{ fontSize: 9, color: 'text.secondary' }}>
                        {new Date(d.day + 'T00:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}
                      </Typography>
                      <Typography sx={{ fontSize: 11, fontWeight: 700, color: d.total > promediosDia ? GREEN : 'text.primary' }}>
                        {formatCurrency(d.total)}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </>
            )}
          </Paper>
        </Grid>

        {/* ── Órdenes recientes ── */}
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2.5, borderRadius: 3, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', height: '100%', boxSizing: 'border-box' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <Assignment sx={{ color: PURPLE, fontSize: 18 }} />
              <Typography sx={{ fontWeight: 700, fontSize: 15 }}>Órdenes recientes</Typography>
            </Box>

            {!data.ordenes_recientes?.length ? (
              <Box sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
                <CheckCircle sx={{ fontSize: 36, opacity: 0.2, mb: 1 }} />
                <Typography fontSize={13}>Sin órdenes recientes</Typography>
              </Box>
            ) : (
              <Box>
                {data.ordenes_recientes.map((orden, i) => (
                  <Box key={orden.id}>
                    <Box
                      onClick={() => navigate('/ordenes-trabajo')}
                      sx={{ py: 1.2, cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' }, borderRadius: 1.5, px: 1, mx: -1 }}
                    >
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <Box sx={{ minWidth: 0, flex: 1 }}>
                          <Typography sx={{ fontWeight: 700, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            OT #{orden.id} · {orden.cliente?.nombre}
                          </Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, mt: 0.3 }}>
                            <Chip
                              label={orden.estado}
                              size="small"
                              sx={{
                                height: 18, fontSize: 9, fontWeight: 700, borderRadius: 1,
                                bgcolor: orden.estado === 'completada' ? `${GREEN}18`
                                       : orden.estado === 'en_proceso' ? `${BLUE}18`
                                       : `${YELLOW}18`,
                                color: orden.estado === 'completada' ? GREEN
                                     : orden.estado === 'en_proceso' ? BLUE
                                     : YELLOW,
                              }}
                            />
                          </Box>
                        </Box>
                        <Typography sx={{ fontWeight: 700, fontSize: 13, color: ACCENT, flexShrink: 0, ml: 1 }}>
                          {formatCurrency(orden.total)}
                        </Typography>
                      </Box>
                    </Box>
                    {i < data.ordenes_recientes.length - 1 && <Divider />}
                  </Box>
                ))}
              </Box>
            )}
          </Paper>
        </Grid>

        {/* ── Accesos rápidos ── */}
        <Grid item xs={12}>
          <Paper sx={{ p: 2, borderRadius: 3, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', boxSizing: 'border-box' }}>
            <Typography sx={{ fontWeight: 700, fontSize: 13, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.6, mb: 1.5 }}>
              Acceso rápido
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {[
                { label: 'Nueva Venta',    icon: <MonetizationOn sx={{ fontSize: 16 }} />, color: ACCENT,  path: '/ventas' },
                { label: 'Compras',        icon: <ShoppingCart sx={{ fontSize: 16 }} />,    color: GREEN,   path: '/compras' },
                { label: 'Inventario',     icon: <Inventory2Outlined sx={{ fontSize: 16 }} />, color: YELLOW, path: '/inventario' },
                { label: 'Terceros',       icon: <AccountBalanceWallet sx={{ fontSize: 16 }} />, color: BLUE, path: '/clientes' },
                { label: 'Reportes',       icon: <TrendingUp sx={{ fontSize: 16 }} />,      color: RED,    path: '/reportes' },
                { label: 'Órdenes',        icon: <Assignment sx={{ fontSize: 16 }} />,      color: PURPLE, path: '/ordenes-trabajo' },
              ].map(({ label, icon, color, path }) => (
                <Box
                  key={label}
                  onClick={() => navigate(path)}
                  sx={{
                    display: 'flex', alignItems: 'center', gap: 0.8,
                    px: 1.5, py: 1, borderRadius: 2,
                    bgcolor: `${color}0D`, border: `1px solid ${color}25`,
                    cursor: 'pointer', transition: 'all 0.15s',
                    '&:hover': { bgcolor: `${color}18`, transform: 'translateY(-1px)' },
                  }}
                >
                  <Box sx={{ color }}>{icon}</Box>
                  <Typography sx={{ fontSize: 12, fontWeight: 600, color, whiteSpace: 'nowrap' }}>{label}</Typography>
                </Box>
              ))}
            </Box>
          </Paper>
        </Grid>

      </Grid>
    </Box>
  );
};

export default Dashboard;
