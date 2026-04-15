import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Paper, Grid, CircularProgress,
  Divider, Chip, useMediaQuery, Skeleton, Button,
  CardActionArea // ✅ Añadido para efectos de clic en el Onboarding
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  MonetizationOn, AccountBalanceWallet, Warning,
  Assignment, TrendingUp, TrendingDown, ShoppingCart,
  Inventory2Outlined, CheckCircle, PointOfSale,
  AssignmentReturn, AttachMoney, CreditCard, AccountBalance,
  MoneyOff, Business, RocketLaunch, Storefront, PeopleOutline, AddShoppingCart // ✅ Nuevos iconos para Onboarding
} from '@mui/icons-material';
import apiClient from '../api';
import { formatCurrency } from '../utils/formatters';

const ACCENT  = '#FF6020';
const GREEN   = '#10B981';
const BLUE    = '#3B82F6';
const YELLOW  = '#F59E0B';
const RED     = '#EF4444';
const PURPLE  = '#8B5CF6';

// ─── KPI Card clickeable ───
const KpiCard = ({ title, value, icon, color, sub, onClick, loading }) => (
  <Paper onClick={onClick} sx={{
    p: 1.5, borderRadius: 3,
    display: 'flex', alignItems: 'center', gap: 1.5,
    boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
    cursor: onClick ? 'pointer' : 'default',
    transition: 'transform 0.15s, box-shadow 0.15s',
    width: '100%', boxSizing: 'border-box',
    '&:hover': onClick ? { transform: 'translateY(-2px)', boxShadow: '0 6px 20px rgba(0,0,0,0.1)' } : {},
  }}>
    <Box sx={{ width: 40, height: 40, borderRadius: 2, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: `${color}18`, color }}>
      {icon}
    </Box>
    <Box sx={{ minWidth: 0, flex: 1 }}>
      <Typography sx={{ fontSize: 11, color: 'text.secondary', fontWeight: 500 }}>{title}</Typography>
      {loading ? <Skeleton width={80} height={24} /> : <Typography sx={{ fontSize: 17, fontWeight: 800, lineHeight: 1.2 }}>{value}</Typography>}
      {sub && !loading && <Typography sx={{ fontSize: 10, color: 'text.secondary', mt: 0.2 }}>{sub}</Typography>}
    </Box>
  </Paper>
);

// ─── Sparkline SVG nativa ───
const Sparkline = ({ data, color, height = 70 }) => {
  if (!data || data.length < 2) return null;
  const vals  = data.map(d => d.total);
  const max   = Math.max(...vals, 1);
  const min   = Math.min(...vals);
  const range = max - min || 1;
  const W = 300, H = height, pad = 6;

  const pts = vals.map((v, i) => {
    const x = pad + (i / (vals.length - 1)) * (W - pad * 2);
    const y = H - pad - ((v - min) / range) * (H - pad * 2);
    return `${x},${y}`;
  }).join(' ');
  const area = `${pad},${H - pad} ${pts} ${pad + (vals.length - 1) / (vals.length - 1) * (W - pad * 2)},${H - pad}`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: '100%', height }} aria-hidden>
      <defs>
        <linearGradient id={`sg${color.replace('#','')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.2" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <polygon points={area} fill={`url(#sg${color.replace('#','')})`} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {(() => {
        const li = vals.length - 1;
        const x  = pad + (W - pad * 2);
        const y  = H - pad - ((vals[li] - min) / range) * (H - pad * 2);
        return <circle cx={x} cy={y} r="4" fill={color} />;
      })()}
    </svg>
  );
};

// ─── Mini barra de método de pago ───
const MetodoBarra = ({ label, value, total, color, icon }) => {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <Box sx={{ mb: 1 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
          <Box sx={{ color, display: 'flex' }}>{icon}</Box>
          <Typography sx={{ fontSize: 11 }}>{label}</Typography>
        </Box>
        <Typography sx={{ fontSize: 11, fontWeight: 700, color }}>{formatCurrency(value)}</Typography>
      </Box>
      <Box sx={{ height: 4, borderRadius: 3, bgcolor: `${color}18`, overflow: 'hidden' }}>
        <Box sx={{ height: '100%', width: `${pct}%`, bgcolor: color, borderRadius: 3, transition: 'width 0.6s ease' }} />
      </Box>
    </Box>
  );
};

// ─── Componente principal ───
const Dashboard = () => {
  const [data, setData]           = useState(null);
  const [caja, setCaja]           = useState(null);
  
  const [companyName, setCompanyName] = useState(''); 
  const [empresaData, setEmpresaData] = useState(null); 
  
  const [loadingMain, setLoadingMain] = useState(true);
  const [loadingCaja, setLoadingCaja] = useState(true);
  const [error, setError]         = useState(null);

  const navigate  = useNavigate();
  const isMobile  = useMediaQuery(useTheme().breakpoints.down('sm'));

  const fetchAll = useCallback(async () => {
    setLoadingMain(true);
    setLoadingCaja(true);
    try { 
      const [dashRes, cajaRes, userRes] = await Promise.allSettled([
        apiClient.get('/reportes/dashboard'),
        apiClient.get('/caja/corte/preview'),
        apiClient.get('/users/me')
      ]);
      
      if (dashRes.status === 'fulfilled') setData(dashRes.value.data);
      else setError('Error al cargar el dashboard.');
      
      if (cajaRes.status === 'fulfilled') setCaja(cajaRes.value.data);
      
      if (userRes.status === 'fulfilled') {
        const empresaInfo = userRes.value.data.empresa;
        setCompanyName(empresaInfo?.nombre || 'Mi Empresa');
        setEmpresaData(empresaInfo); 
      }
    } finally {
      setLoadingMain(false);
      setLoadingCaja(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  if (loadingMain && !data) return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
      <CircularProgress sx={{ color: ACCENT }} />
    </Box>
  );

  if (error) return (
    <Box sx={{ textAlign: 'center', py: 8 }}>
      <Typography color="error" sx={{ fontWeight: 600 }}>{error}</Typography>
    </Box>
  );

  // ── Cálculos de tendencia ──
  const ventas30       = data?.ventas_ultimos_30_dias || [];
  const totalUltimos30 = ventas30.reduce((s, d) => s + d.total, 0);
  const promedioDia    = ventas30.length ? totalUltimos30 / ventas30.length : 0;
  const ventaHoy       = data?.ventas_hoy || 0;
  const tendencia      = promedioDia > 0 ? ((ventaHoy - promedioDia) / promedioDia * 100).toFixed(1) : 0;
  const tendenciaPos   = parseFloat(tendencia) >= 0;

  const mejorDia = ventas30.reduce((mx, d) => d.total > mx.total ? d : mx, { total: 0, day: '' });

  const ultimos7     = ventas30.slice(-7);
  const anteriores7  = ventas30.slice(-14, -7);
  const totalUlt7    = ultimos7.reduce((s, d) => s + d.total, 0);
  const totalAnt7    = anteriores7.reduce((s, d) => s + d.total, 0);
  
  const diffSemana   = totalAnt7 > 0 ? ((totalUlt7 - totalAnt7) / totalAnt7 * 100).toFixed(1) : (totalUlt7 > 0 ? 100 : 0);
  const diffPos      = parseFloat(diffSemana) >= 0;

  const calculateDaysLeft = (dateString) => {
    if (!dateString) return 0;
    const endsAt = new Date(dateString.endsWith('Z') ? dateString : dateString + 'Z');
    const now = new Date();
    const diffTime = endsAt - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  };

  const diasRestantes = calculateDaysLeft(empresaData?.trial_ends_at);

  // ✅ LOGICA DE "ZERO STATE"
  // Si no hay ventas históricas, ni caja, ni cuentas por cobrar, asumimos que es una cuenta virgen.
  const isZeroState = totalUltimos30 === 0 && (data?.cuentas_por_cobrar || 0) === 0 && (caja?.total_dia || 0) === 0;

  return (
    <Box sx={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>

      {/* ── Header ── */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, flexWrap: 'wrap', gap: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ 
            width: 40, height: 40, borderRadius: 2, 
            background: `linear-gradient(135deg, ${ACCENT}20, ${ACCENT}05)`, 
            display: 'flex', alignItems: 'center', justifyContent: 'center', 
            color: ACCENT, border: `1px solid ${ACCENT}30` 
          }}>
            <TrendingUp />
          </Box>
          <Box>
            <Typography sx={{ 
              fontSize: 10, fontWeight: 800, color: ACCENT, 
              textTransform: 'uppercase', letterSpacing: 1.2, mb: 0.1,
              display: 'flex', alignItems: 'center', gap: 0.5
            }}>
              <Business sx={{ fontSize: 12 }} /> 
              {companyName ? companyName : <Skeleton width={80} height={12} sx={{ display: 'inline-block' }}/>}
            </Typography>
            <Typography sx={{ fontWeight: 800, fontSize: 18, lineHeight: 1.1, color: 'text.primary' }}>
              Resumen General
            </Typography>
            <Typography sx={{ fontSize: 11, color: 'text.secondary', mt: 0.2 }}>
              {new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })}
            </Typography>
          </Box>
        </Box>

        {!isZeroState && (
          <Chip
            icon={diffPos ? <TrendingUp sx={{ fontSize: 12 }} /> : <TrendingDown sx={{ fontSize: 12 }} />}
            label={`${diffPos ? '+' : ''}${diffSemana}% vs semana anterior`}
            size="small"
            sx={{
              bgcolor: diffPos ? `${GREEN}15` : `${RED}15`,
              color: diffPos ? GREEN : RED,
              fontWeight: 700, fontSize: 10,
              '& .MuiChip-icon': { color: diffPos ? GREEN : RED },
            }}
          />
        )}
      </Box>

      {/* BANNER DE TRIAL */}
      {empresaData?.plan_type === 'trial' && diasRestantes > 0 && (
        <Box sx={{ 
          mb: 2, p: 1.5, borderRadius: 2, 
          bgcolor: '#EFF6FF', border: '1px solid #BFDBFE', 
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexWrap: 'wrap', gap: 2
        }}>
          <Typography sx={{ fontSize: 12, color: '#1E3A8A', fontWeight: 600 }}>
            ⏱ Estás en tu periodo de prueba. Te quedan {diasRestantes} días gratis.
          </Typography>
          <Button 
            size="small" 
            variant="contained" 
            onClick={() => window.open(`https://wa.me/3175882321?text=Hola,%20quiero%20activar%20mi%20plan%20premium`, '_blank')}
            sx={{ bgcolor: '#2563EB', fontSize: 11, fontWeight: 700, boxShadow: 'none' }}
          >
            Activar mi cuenta
          </Button>
        </Box>
      )}

      {/* ── KPIs principales ── */}
      <Grid container spacing={1.5} sx={{ mb: 2 }}>
        <Grid item xs={6} sm={3}>
          <KpiCard
            title="Ventas hoy" value={formatCurrency(ventaHoy)}
            icon={<MonetizationOn />} color={ACCENT}
            sub={`${tendenciaPos ? '▲' : '▼'} ${Math.abs(tendencia)}% vs promedio`}
            onClick={() => navigate('/ventas')} loading={loadingMain}
          />
        </Grid>
        <Grid item xs={6} sm={3}>
          <KpiCard
            title="Por cobrar" value={formatCurrency(data?.cuentas_por_cobrar || 0)}
            icon={<AccountBalanceWallet />} color={BLUE} sub="Saldo pendiente clientes"
            onClick={() => navigate('/clientes')} loading={loadingMain}
          />
        </Grid>
        <Grid item xs={6} sm={3}>
          <KpiCard
            title="Bajo stock" value={data?.productos_bajo_stock || 0}
            icon={<Warning />} color={data?.productos_bajo_stock > 0 ? RED : GREEN}
            sub={data?.productos_bajo_stock === 0 ? 'Todo en orden' : 'Requieren reposición'}
            onClick={() => navigate('/inventario')} loading={loadingMain}
          />
        </Grid>
        <Grid item xs={6} sm={3}>
          <KpiCard
            title="Caja hoy (Neto)" value={formatCurrency((caja?.total_dia || 0) - (caja?.total_gastos || 0))}
            icon={<PointOfSale />} color={YELLOW}
            sub={caja?.total_gastos > 0 ? `- ${formatCurrency(caja.total_gastos)} en gastos` : 'Sin gastos hoy'}
            onClick={() => navigate('/caja')} loading={loadingCaja}
          />
        </Grid>
      </Grid>

      {/* ✅ FLUJO DE ONBOARDING (ESTADO CERO) */}
      {isZeroState ? (
        <Paper sx={{ p: { xs: 3, md: 5 }, borderRadius: 3, boxShadow: '0 2px 24px rgba(0,0,0,0.04)', textAlign: 'center', mb: 3 }}>
          <Box sx={{ width: 64, height: 64, borderRadius: '50%', bgcolor: `${ACCENT}15`, color: ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 2 }}>
            <RocketLaunch sx={{ fontSize: 32 }} />
          </Box>
          <Typography variant="h5" sx={{ fontWeight: 800, mb: 1 }}>¡Bienvenido a Ksmart360!</Typography>
          <Typography sx={{ color: 'text.secondary', maxWidth: 500, mx: 'auto', mb: 4 }}>
            Tu espacio de trabajo está listo. Sigue estos tres rápidos pasos para configurar tu negocio y empezar a vender.
          </Typography>
          
          <Grid container spacing={2} justifyContent="center" sx={{ maxWidth: 900, mx: 'auto' }}>
            {[
              { title: '1. Agrega tus Productos', desc: 'Crea tu catálogo o sube tu inventario en Excel.', icon: <Storefront sx={{ fontSize: 30 }}/>, path: '/productos', color: PURPLE },
              { title: '2. Registra Clientes', desc: 'Añade tu cartera de clientes y proveedores.', icon: <PeopleOutline sx={{ fontSize: 30 }}/>, path: '/clientes', color: BLUE },
              { title: '3. Tu Primera Venta', desc: 'Factura y empieza a ver crecer tus métricas.', icon: <AddShoppingCart sx={{ fontSize: 30 }}/>, path: '/ventas', color: GREEN },
            ].map((step, idx) => (
              <Grid item xs={12} sm={4} key={idx}>
                <CardActionArea onClick={() => navigate(step.path)} sx={{ height: '100%', borderRadius: 3 }}>
                  <Paper sx={{ p: 3, height: '100%', borderRadius: 3, border: '1px dashed', borderColor: 'divider', transition: 'all 0.2s', '&:hover': { borderColor: step.color, bgcolor: `${step.color}05` } }}>
                    <Box sx={{ color: step.color, mb: 1 }}>{step.icon}</Box>
                    <Typography sx={{ fontWeight: 700, fontSize: 15, mb: 0.5 }}>{step.title}</Typography>
                    <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{step.desc}</Typography>
                  </Paper>
                </CardActionArea>
              </Grid>
            ))}
          </Grid>
        </Paper>
      ) : (
        /* ── Gráficas y resto del dashboard regular ── */
        <Grid container spacing={1.5}>
          {/* ── Gráfica ventas 30 días ── */}
          <Grid item xs={12} md={8}>
            <Paper sx={{ p: 2, borderRadius: 3, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', height: '100%', boxSizing: 'border-box' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1, flexWrap: 'wrap', gap: 1 }}>
                <Box>
                  <Typography sx={{ fontWeight: 700, fontSize: 14 }}>Ventas — últimos 30 días</Typography>
                  <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
                    Total: <strong>{formatCurrency(totalUltimos30)}</strong>
                    {promedioDia > 0 && ` · Promedio: ${formatCurrency(promedioDia)}/día`}
                  </Typography>
                </Box>
                {mejorDia.total > 0 && (
                  <Chip label={`🏆 Mejor: ${formatCurrency(mejorDia.total)}`} size="small"
                    sx={{ bgcolor: `${ACCENT}12`, color: ACCENT, fontWeight: 700, fontSize: 10 }} />
                )}
              </Box>

              {ventas30.length > 1
                ? <Sparkline data={ventas30} color={ACCENT} height={isMobile ? 60 : 90} />
                : <Box sx={{ textAlign: 'center', py: 3, color: 'text.secondary' }}>
                    <TrendingUp sx={{ fontSize: 36, opacity: 0.2, mb: 1 }} />
                    <Typography fontSize={12}>Faltan datos para graficar</Typography>
                  </Box>
              }

              {ventas30.length > 1 && (
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5, px: 0.5 }}>
                  {[ventas30[0], ventas30[Math.floor(ventas30.length / 2)], ventas30[ventas30.length - 1]].map((d, i) => (
                    <Typography key={i} sx={{ fontSize: 10, color: 'text.secondary' }}>
                      {new Date(d.day + 'T00:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}
                    </Typography>
                  ))}
                </Box>
              )}

              {ultimos7.length > 0 && (
                <>
                  <Divider sx={{ my: 1.5 }} />
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Typography sx={{ fontSize: 10, fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.6 }}>
                      Últimos 7 días
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', gap: 0.6, flexWrap: 'wrap' }}>
                    {ultimos7.map((d, i) => (
                      <Box key={i} sx={{
                        flex: '1 1 0', minWidth: 0, textAlign: 'center',
                        p: 0.6, borderRadius: 1.5,
                        bgcolor: d.total >= promedioDia ? `${GREEN}10` : 'action.hover',
                      }}>
                        <Typography sx={{ fontSize: 9, color: 'text.secondary' }}>
                          {new Date(d.day + 'T00:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}
                        </Typography>
                        <Typography sx={{ fontSize: 10, fontWeight: 700, color: d.total >= promedioDia ? GREEN : 'text.primary' }}>
                          {formatCurrency(d.total)}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                </>
              )}
            </Paper>
          </Grid>

          {/* ── Columna derecha ── */}
          <Grid item xs={12} md={4}>
            <Grid container spacing={1.5} sx={{ height: '100%' }}>

              {/* Caja del día */}
              <Grid item xs={12}>
                <Paper sx={{ p: 2, borderRadius: 3, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', boxSizing: 'border-box', cursor: 'pointer', '&:hover': { boxShadow: '0 6px 20px rgba(0,0,0,0.1)' } }}
                  onClick={() => navigate('/caja')}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <PointOfSale sx={{ color: YELLOW, fontSize: 16 }} />
                    <Typography sx={{ fontWeight: 700, fontSize: 13 }}>Resumen de caja hoy</Typography>
                  </Box>
                  {loadingCaja ? (
                    <Box>{[1,2,3].map(i => <Skeleton key={i} height={20} sx={{ mb: 0.5 }} />)}</Box>
                  ) : caja ? (
                    <>
                      <MetodoBarra icon={<AttachMoney sx={{ fontSize: 13 }} />} label="Efectivo"       value={caja.efectivo}      total={caja.total_dia} color={GREEN}  />
                      <MetodoBarra icon={<AccountBalance sx={{ fontSize: 13 }} />} label="Transferencia" value={caja.transferencia}  total={caja.total_dia} color={BLUE}   />
                      <MetodoBarra icon={<CreditCard sx={{ fontSize: 13 }} />}   label="Tarjeta"        value={caja.tarjeta}       total={caja.total_dia} color={PURPLE} />
                      
                      <Divider sx={{ mt: 1, mb: 0.5 }} />
                      
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.2 }}>
                        <Typography sx={{ fontSize: 11, fontWeight: 600, color: 'text.secondary' }}>Ingresos Brutos</Typography>
                        <Typography sx={{ fontSize: 11, fontWeight: 700 }}>{formatCurrency(caja.total_dia)}</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <MoneyOff sx={{ fontSize: 12, color: RED }} />
                          <Typography sx={{ fontSize: 11, fontWeight: 600, color: RED }}>Egresos / Gastos</Typography>
                        </Box>
                        <Typography sx={{ fontSize: 11, fontWeight: 700, color: RED }}>- {formatCurrency(caja.total_gastos || 0)}</Typography>
                      </Box>
                      
                      <Divider sx={{ my: 0.5 }} />
                      
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography sx={{ fontSize: 12, fontWeight: 700 }}>Saldo Neto</Typography>
                        <Typography sx={{ fontSize: 14, fontWeight: 800, color: YELLOW }}>
                          {formatCurrency(caja.total_dia - (caja.total_gastos || 0))}
                        </Typography>
                      </Box>
                    </>
                  ) : (
                    <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>Sin datos de caja</Typography>
                  )}
                </Paper>
              </Grid>

              {/* Órdenes recientes */}
              <Grid item xs={12}>
                <Paper sx={{ p: 2, borderRadius: 3, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', boxSizing: 'border-box' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <Assignment sx={{ color: PURPLE, fontSize: 16 }} />
                    <Typography sx={{ fontWeight: 700, fontSize: 13 }}>Órdenes recientes</Typography>
                  </Box>
                  {!data?.ordenes_recientes?.length ? (
                    <Box sx={{ textAlign: 'center', py: 1.5, color: 'text.secondary' }}>
                      <CheckCircle sx={{ fontSize: 24, opacity: 0.2, mb: 0.5 }} />
                      <Typography fontSize={11}>Sin órdenes recientes</Typography>
                    </Box>
                  ) : (
                    data.ordenes_recientes.slice(0, 4).map((orden, i) => (
                      <Box key={orden.id}>
                        <Box onClick={() => navigate('/ordenes-trabajo')}
                          sx={{ py: 0.5, cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' }, borderRadius: 1, px: 0.5, mx: -0.5 }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Box sx={{ minWidth: 0, flex: 1 }}>
                              <Typography sx={{ fontWeight: 600, fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                OT #{orden.id} · {orden.cliente?.nombre}
                              </Typography>
                              <Chip label={orden.estado} size="small" sx={{
                                height: 14, fontSize: 9, fontWeight: 700, borderRadius: 1, mt: 0.2,
                                bgcolor: orden.estado === 'Cerrada' ? `${GREEN}15` : orden.estado === 'En produccion' ? `${BLUE}15` : `${YELLOW}15`,
                                color: orden.estado === 'Cerrada' ? GREEN : orden.estado === 'En produccion' ? BLUE : YELLOW,
                              }} />
                            </Box>
                            <Typography sx={{ fontWeight: 700, fontSize: 11, color: ACCENT, ml: 1, flexShrink: 0 }}>
                              {formatCurrency(orden.total)}
                            </Typography>
                          </Box>
                        </Box>
                        {i < Math.min(data.ordenes_recientes.length, 4) - 1 && <Divider />}
                      </Box>
                    ))
                  )}
                </Paper>
              </Grid>
            </Grid>
          </Grid>
        </Grid>
      )}

      {/* ── Accesos rápidos (Siempre visibles) ── */}
      <Grid container spacing={1.5} sx={{ mt: 0.5 }}>
        <Grid item xs={12}>
          <Paper sx={{ p: 2, borderRadius: 3, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', boxSizing: 'border-box' }}>
            <Typography sx={{ fontWeight: 700, fontSize: 10, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.6, mb: 1 }}>
              Acceso rápido
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {[
                { label: 'Nueva Venta',   icon: <MonetizationOn sx={{ fontSize: 14 }} />,      color: ACCENT,  path: '/ventas' },
                { label: 'Compras',       icon: <ShoppingCart sx={{ fontSize: 14 }} />,        color: GREEN,   path: '/compras' },
                { label: 'Inventario',    icon: <Inventory2Outlined sx={{ fontSize: 14 }} />,  color: YELLOW,  path: '/inventario' },
                { label: 'Terceros',      icon: <AccountBalanceWallet sx={{ fontSize: 14 }} />, color: BLUE,    path: '/clientes' },
                { label: 'Reportes',      icon: <TrendingUp sx={{ fontSize: 14 }} />,          color: RED,     path: '/reportes' },
                { label: 'Devoluciones',  icon: <AssignmentReturn sx={{ fontSize: 14 }} />,    color: '#F59E0B', path: '/ventas' },
                { label: 'Caja / Gastos', icon: <PointOfSale sx={{ fontSize: 14 }} />,         color: PURPLE,  path: '/caja' },
              ].map(({ label, icon, color, path }) => (
                <Box key={label} onClick={() => navigate(path)}
                  sx={{
                    display: 'flex', alignItems: 'center', gap: 0.8,
                    px: 1.2, py: 0.6, borderRadius: 2,
                    bgcolor: `${color}0D`, border: `1px solid ${color}25`,
                    cursor: 'pointer', transition: 'all 0.15s',
                    '&:hover': { bgcolor: `${color}18`, transform: 'translateY(-1px)' },
                  }}>
                  <Box sx={{ color, display: 'flex' }}>{icon}</Box>
                  <Typography sx={{ fontSize: 11, fontWeight: 600, color, whiteSpace: 'nowrap' }}>{label}</Typography>
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