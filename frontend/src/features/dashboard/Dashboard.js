import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Paper, Grid, CircularProgress,
  Divider, Chip, useMediaQuery, Skeleton, Button,
  CardActionArea, Tooltip, IconButton
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  MonetizationOn, AccountBalanceWallet, Warning,
  TrendingUp, PointOfSale, AttachMoney, AccountBalance,
  Business, RocketLaunch, Storefront, PeopleOutline,
  AddShoppingCart, DirectionsRun, Savings, Gavel,
  Inventory2Outlined, ShoppingCart,
  LocalParking, TwoWheeler, Refresh
} from '@mui/icons-material';
import { keyframes } from '@mui/system';
import apiClient from '../../api';
import { formatCurrency } from '../../utils/formatters';
import SaaSUpgradeManager from '../saas/components/SaaSUpgradeManager';
// Al tope, junto a los otros imports:
import CacaoPriceWidget from './CacaoPriceWidget';
import HelpGuideTopBar from '../../components/onboarding/HelpGuideTopBar';


const ACCENT  = '#FF6020';
const GREEN   = '#10B981';
const BLUE    = '#3B82F6';
const YELLOW  = '#F59E0B';
const RED     = '#EF4444';
const PURPLE  = '#8B5CF6';

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
`;

const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return { msg: 'Buenos días',    emoji: '☀️' };
  if (h < 19) return { msg: 'Buenas tardes',  emoji: '🌤️' };
  return       { msg: 'Buenas noches',         emoji: '🌙' };
};

const KpiCard = ({ title, value, icon, color, sub, onClick, loading }) => {
  const theme = useTheme();
  return (
    <Paper onClick={onClick} sx={{
      p: 1.5, borderRadius: 3,
      display: 'flex', alignItems: 'center', gap: 1.5,
      boxShadow: theme.palette.mode === 'dark' ? '0 2px 12px rgba(0,0,0,0.3)' : '0 2px 12px rgba(0,0,0,0.06)',
      cursor: onClick ? 'pointer' : 'default',
      transition: 'transform 0.15s, box-shadow 0.15s',
      width: '100%', boxSizing: 'border-box',
      bgcolor: 'background.paper',
      '&:hover': onClick ? { transform: 'translateY(-2px)', boxShadow: theme.palette.mode === 'dark' ? '0 6px 20px rgba(0,0,0,0.4)' : '0 6px 20px rgba(0,0,0,0.1)' } : {},
    }}>
      <Box sx={{ width: 40, height: 40, borderRadius: 2, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: `${color}18`, color }}>
        {icon}
      </Box>
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography sx={{ fontSize: 11, color: 'text.secondary', fontWeight: 500 }}>{title}</Typography>
        {loading ? <Skeleton width={80} height={24} /> : <Typography sx={{ fontSize: 17, fontWeight: 800, lineHeight: 1.2, color: 'text.primary' }}>{value}</Typography>}
        {sub && !loading && <Typography sx={{ fontSize: 10, color: 'text.secondary', mt: 0.2 }}>{sub}</Typography>}
      </Box>
    </Paper>
  );
};




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

const Dashboard = ({ user }) => {
  const [data, setData]           = useState(null);
  const [caja, setCaja]           = useState(null);

  const [loadingMain, setLoadingMain] = useState(true);
  const [loadingCaja, setLoadingCaja] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [sparkDays, setSparkDays]     = useState(30);

  const navigate  = useNavigate();
  const theme     = useTheme();
  const isMobile  = useMediaQuery(theme.breakpoints.down('sm'));

  const fetchAll = useCallback(async () => {
    setLoadingMain(true);
    setLoadingCaja(true);
    try {
      const [dashRes, cajaRes] = await Promise.allSettled([
        apiClient.get('/reportes/dashboard'),
        apiClient.get('/caja/corte/preview')
      ]);

      if (dashRes.status === 'fulfilled') setData(dashRes.value.data);
      if (cajaRes.status === 'fulfilled') setCaja(cajaRes.value.data);
    } finally {
      setLoadingMain(false);
      setLoadingCaja(false);
      setLastUpdated(new Date());
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const hasAccess = (path) => {
    if (user?.role?.name === 'Admin' && user?.empresa_id === 1) return true;
    const modulosEmpresa = user?.empresa?.modulos_habilitados;
    if (!modulosEmpresa) return true;
    return modulosEmpresa.includes(path);
  };

  const esPrestamista = useMemo(() => {
    const mods = user?.empresa?.modulos_habilitados;
    return mods?.includes('/prestamos') && !mods?.includes('/ventas');
  }, [user]);

  const esParqueadero = useMemo(() => {
    return user?.empresa?.modulos_habilitados?.includes('/parqueadero');
  }, [user]);

  const accesosRapidos = useMemo(() => {
    const todos = [
      { label: 'Simular Préstamo', icon: <AttachMoney sx={{ fontSize: 14 }} />, color: GREEN,  path: '/prestamos' },
      { label: 'Ruta de Cobro',    icon: <DirectionsRun sx={{ fontSize: 14 }} />, color: BLUE,   path: '/ruta-cobro' },
      { label: 'Nueva Venta',      icon: <AddShoppingCart sx={{ fontSize: 14 }} />, color: ACCENT, path: '/ventas' },
      { label: 'Compras',          icon: <ShoppingCart sx={{ fontSize: 14 }} />,    color: GREEN,  path: '/compras' },
      { label: 'Inventario',       icon: <Inventory2Outlined sx={{ fontSize: 14 }} />, color: YELLOW, path: '/inventario' },
      { label: 'Terceros',         icon: <PeopleOutline sx={{ fontSize: 14 }} />, color: BLUE,   path: '/clientes' },
      { label: 'Caja / Gastos',    icon: <PointOfSale sx={{ fontSize: 14 }} />,     color: PURPLE, path: '/caja' },
      { label: 'Reportes',         icon: <TrendingUp sx={{ fontSize: 14 }} />,      color: RED,    path: '/reportes' },
    ];
    return todos.filter(a => hasAccess(a.path));
  }, [user]);

  const greeting = getGreeting();
  const nombreCorto = (user?.nombre_completo?.split(' ')[0] || user?.username || 'usuario');

  if (loadingMain && !data) return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
      <CircularProgress sx={{ color: ACCENT }} />
    </Box>
  );

  const ventas30       = data?.ventas_ultimos_30_dias || [];
  const totalUltimos30 = ventas30.reduce((s, d) => s + d.total, 0);
  const mejorDia = ventas30.reduce((mx, d) => d.total > mx.total ? d : mx, { total: 0, day: '' });

  const isZeroState = esPrestamista
    ? (data?.capital_en_calle || 0) === 0 && (caja?.total_dia || 0) === 0
    : esParqueadero
      ? (data?.ingresos_hoy || 0) === 0 && (data?.accesos_dentro?.length || 0) === 0 && (caja?.total_dia || 0) === 0
      : totalUltimos30 === 0 && (data?.cuentas_por_cobrar || 0) === 0 && (caja?.total_dia || 0) === 0;

  return (
    <Box sx={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>

      {/* ── SaaS Activation Manager (Trial Banner & Upgrade Modal) ── */}
      <SaaSUpgradeManager user={user} />

      {/* ── HEADER ── */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 2, flexWrap: 'wrap', gap: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          {/* Avatar letter */}
          <Box sx={{
            width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
            background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT}99)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontWeight: 900, fontSize: 19,
            boxShadow: `0 4px 14px ${ACCENT}35`,
          }}>
            {nombreCorto[0].toUpperCase()}
          </Box>
          <Box>
            <Typography sx={{ fontSize: 11, color: 'text.secondary', fontWeight: 500 }}>
              {greeting.emoji} {greeting.msg}
            </Typography>
            <Typography sx={{ fontWeight: 800, fontSize: 20, lineHeight: 1.1, color: 'text.primary' }}>
              {nombreCorto}
            </Typography>
            <Typography sx={{ fontSize: 11, color: 'text.secondary', mt: 0.15, display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Business sx={{ fontSize: 11 }} />
              {user?.empresa?.nombre || 'Mi Empresa'}
              {' · '}
              {esPrestamista ? 'Cobranzas' : esParqueadero ? 'Parqueadero' : 'Resumen General'}
            </Typography>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {lastUpdated && (
            <Typography sx={{ fontSize: 10, color: 'text.disabled', display: { xs: 'none', sm: 'block' } }}>
              Act. {lastUpdated.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
            </Typography>
          )}
          <HelpGuideTopBar
            moduleName="Dashboard"
            moduleColor={ACCENT}
            steps={[
              { title: 'Revisa los KPIs del día', description: 'Las tarjetas superiores muestran ventas, inventario, cobros pendientes y otros indicadores clave actualizados en tiempo real.' },
              { title: 'Accesos rápidos', description: 'Los botones de acceso directo te llevan al módulo más relevante según tu tipo de negocio.' },
              { title: 'Configura tu empresa', description: 'Ve a Usuarios y Permisos para agregar empleados. Ve a Catálogo Virtual para activar tu tienda online.' },
              { title: 'Consulta los reportes', description: 'El módulo Reportes te da un análisis completo de ventas, rentabilidad, IVA y más para tomar decisiones.' },
            ]}
            faqItems={[
              { q: '¿Qué son los KPIs?', a: 'Son indicadores clave de rendimiento (Key Performance Indicators). Muestran un resumen rápido de la actividad del negocio: ventas del día, cartera pendiente, stock bajo, etc.' },
              { q: '¿Cómo actualizo los datos del dashboard?', a: 'Haz clic en el ícono de actualizar (↻) en la esquina superior derecha. Los datos también se actualizan cada vez que entras al dashboard.' },
              { q: '¿Qué módulos están disponibles?', a: 'Depende de los módulos asignados a tu rol. El administrador puede configurar qué ve cada usuario en Usuarios y Permisos.' },
              { q: '¿Cómo configuro mi empresa?', a: 'Ve a Usuarios y Permisos para gestionar empleados. Ve a Catálogo Virtual para tu tienda online. Las tarifas y configuración específica están en cada módulo.' },
            ]}
          />
          <Tooltip title="Actualizar datos">
            <IconButton
              onClick={() => fetchAll()}
              size="small"
              sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}
            >
              <Refresh sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* ── KPI GRID ── */}
      <Grid container spacing={1.5} sx={{ mb: 3, animation: `${fadeIn} 0.5s ease both` }}>
        {esPrestamista ? (
          <>
            <Grid item xs={6} sm={3}>
              <KpiCard title="Capital en Calle" value={formatCurrency(data?.capital_en_calle || 0)} icon={<AccountBalance />} color={BLUE} sub="Total pendiente" onClick={() => navigate('/prestamos')} loading={loadingMain}/>
            </Grid>
            <Grid item xs={6} sm={3}>
              <KpiCard title="Recaudo Hoy" value={formatCurrency(data?.recaudo_prestamos_hoy || 0)} icon={<Savings />} color={GREEN} sub="Dinero ingresado" onClick={() => navigate('/ruta-cobro')} loading={loadingMain}/>
            </Grid>
            <Grid item xs={6} sm={3}>
              <KpiCard title="Ganancia Hoy" value={formatCurrency((data?.recaudo_prestamos_hoy || 0) * 0.2)} icon={<TrendingUp />} color={PURPLE} sub="Intereses estimados" loading={loadingMain}/>
            </Grid>
            <Grid item xs={6} sm={3}>
              <KpiCard title="Mora Crítica" value={data?.cuotas_mora || 0} icon={<Gavel />} color={RED} sub="Cuotas vencidas" onClick={() => navigate('/ruta-cobro')} loading={loadingMain}/>
            </Grid>
          </>
        ) : esParqueadero ? (
          <>
            <Grid item xs={6} sm={3}>
              <KpiCard title="Vehículos Dentro" value={data?.accesos_dentro?.length || 0} icon={<LocalParking />} color={BLUE} sub="Por horas" onClick={() => navigate('/parqueadero')} loading={loadingMain}/>
            </Grid>
            <Grid item xs={6} sm={3}>
              <KpiCard title="Ingresos Hoy" value={formatCurrency(data?.ingresos_hoy || 0)} icon={<AttachMoney />} color={GREEN} sub="Mensualidades y horas" onClick={() => navigate('/parqueadero')} loading={loadingMain}/>
            </Grid>
            <Grid item xs={6} sm={3}>
              <KpiCard title="Vencimientos" value={data?.vencidas || 0} icon={<Warning />} color={RED} sub="Mensualidades por cobrar" onClick={() => navigate('/parqueadero')} loading={loadingMain}/>
            </Grid>
            <Grid item xs={6} sm={3}>
              <KpiCard title="Caja hoy" value={formatCurrency(caja?.total_dia || 0)} icon={<PointOfSale />} color={PURPLE} loading={loadingCaja}/>
            </Grid>
          </>
        ) : (
          <>
            <Grid item xs={6} sm={3}>
              <KpiCard title="Ventas hoy" value={formatCurrency(data?.ventas_hoy || 0)} icon={<MonetizationOn />} color={ACCENT} onClick={() => navigate('/ventas')} loading={loadingMain}/>
            </Grid>
            <Grid item xs={6} sm={3}>
              <KpiCard title="Por cobrar" value={formatCurrency(data?.cuentas_por_cobrar || 0)} icon={<AccountBalanceWallet />} color={BLUE} onClick={() => navigate('/clientes')} loading={loadingMain}/>
            </Grid>
            <Grid item xs={6} sm={3}>
              <KpiCard title="Bajo stock" value={data?.productos_bajo_stock || 0} icon={<Warning />} color={RED} onClick={() => navigate('/inventario')} loading={loadingMain}/>
            </Grid>
            <Grid item xs={6} sm={3}>
              <KpiCard title="Caja hoy" value={formatCurrency(caja?.total_dia || 0)} icon={<PointOfSale />} color={GREEN} loading={loadingCaja}/>
            </Grid>
          </>
        )}
      </Grid>

      {/* ── ALERTAS CONTEXTUALES ── */}
      {data && (() => {
        const alerts = [];
        if (!esPrestamista && !esParqueadero) {
          if ((data.productos_bajo_stock || 0) > 0)
            alerts.push({ label: `${data.productos_bajo_stock} productos bajo stock`, color: RED, path: '/inventario' });
          if ((data.cuentas_por_cobrar || 0) > 0)
            alerts.push({ label: `${formatCurrency(data.cuentas_por_cobrar)} por cobrar`, color: YELLOW, path: '/clientes' });
        }
        if (esPrestamista) {
          if ((data.cuotas_mora || 0) > 0)
            alerts.push({ label: `${data.cuotas_mora} cuotas en mora`, color: RED, path: '/ruta-cobro' });
          if ((data.capital_en_calle || 0) > 0)
            alerts.push({ label: `${formatCurrency(data.capital_en_calle)} en calle`, color: BLUE, path: '/prestamos' });
        }
        if (esParqueadero) {
          if ((data.vencidas || 0) > 0)
            alerts.push({ label: `${data.vencidas} mensualidades vencidas`, color: RED, path: '/parqueadero' });
          if ((data.por_vencer_5_dias || 0) > 0)
            alerts.push({ label: `${data.por_vencer_5_dias} vencen en 5 días`, color: YELLOW, path: '/parqueadero' });
        }
        if (alerts.length === 0) return null;
        return (
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
            {alerts.map((a, i) => (
              <Chip
                key={i}
                label={a.label}
                size="small"
                onClick={() => navigate(a.path)}
                icon={<Warning sx={{ fontSize: '14px !important' }} />}
                sx={{
                  cursor: 'pointer',
                  bgcolor: `${a.color}12`,
                  color: a.color,
                  fontWeight: 700,
                  fontSize: 11,
                  border: `1px solid ${a.color}28`,
                  '&:hover': { bgcolor: `${a.color}20` },
                }}
              />
            ))}
          </Box>
        );
      })()}

{user?.empresa_id === 1 && <CacaoPriceWidget />}


      {/* ── CONTENIDO PRINCIPAL ── */}
      {isZeroState ? (
        <Paper sx={{
          p: { xs: 3, md: 5 },
          borderRadius: 4,
          textAlign: 'center',
          mb: 3,
          border: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
          backgroundImage: 'none',
          boxShadow: theme.palette.mode === 'dark' ? '0 10px 40px rgba(0,0,0,0.3)' : '0 10px 40px rgba(0,0,0,0.04)',
        }}>
          <Box sx={{ width: 80, height: 80, borderRadius: '24px', bgcolor: `${ACCENT}10`, color: ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 3, transform: 'rotate(-5deg)', boxShadow: `0 8px 20px ${ACCENT}20` }}>
            <RocketLaunch sx={{ fontSize: 40 }} />
          </Box>
          <Typography variant="h4" sx={{ fontWeight: 900, mb: 1, letterSpacing: -0.5, color: 'text.primary' }}>¡Bienvenido, {user?.empresa?.nombre || user?.nombre_completo?.split(' ')[0] || 'Usuario'}!</Typography>
          <Typography sx={{ color: 'text.secondary', maxWidth: 600, mx: 'auto', mb: 5, fontSize: 16 }}>
            {esPrestamista
              ? 'Estamos listos para potenciar tu negocio de cobranzas. Sigue esta guía rápida para empezar a gestionar tus rutas y capital.'
              : (esParqueadero
                  ? 'Configura tu parqueadero y empieza a controlar los ingresos de vehículos de forma eficiente.'
                  : 'Tu espacio de trabajo inteligente está listo. Sigue estos pasos para realizar tu primera operación.')}
          </Typography>

          <Grid container spacing={3} justifyContent="center" sx={{ maxWidth: 1000, mx: 'auto' }}>
            {[
              {
                title: esPrestamista ? 'Registra Clientes' : (esParqueadero ? 'Configura Tarifas' : 'Agrega Productos'),
                desc: esPrestamista ? 'Crea tu base de deudores y rutas.' : (esParqueadero ? 'Define precios por hora y mes.' : 'Sube tu inventario inicial.'),
                path: esPrestamista ? '/clientes' : (esParqueadero ? '/parqueadero/config' : '/productos'),
                icon: esPrestamista ? <PeopleOutline /> : (esParqueadero ? <Gavel /> : <Storefront />),
                color: PURPLE
              },
              {
                title: esPrestamista ? 'Simula un Préstamo' : (esParqueadero ? 'Registra Vehículos' : 'Crea Clientes'),
                desc: esPrestamista ? 'Calcula cuotas e intereses fácilmente.' : (esParqueadero ? 'Añade motos y autos frecuentes.' : 'Organiza tu cartera de clientes.'),
                path: esPrestamista ? '/prestamos' : (esParqueadero ? '/parqueadero/vehiculos' : '/clientes'),
                icon: esPrestamista ? <AttachMoney /> : (esParqueadero ? <TwoWheeler /> : <PeopleOutline />),
                color: BLUE
              },
              {
                title: esPrestamista ? 'Inicia tu Ruta' : (esParqueadero ? 'Control de Accesos' : 'Primera Venta'),
                desc: esPrestamista ? 'Realiza los cobros del día hoy mismo.' : (esParqueadero ? 'Registra entradas y salidas.' : 'Usa el POS para facturar rápido.'),
                path: esPrestamista ? '/ruta-cobro' : (esParqueadero ? '/parqueadero/buscar' : '/ventas'),
                icon: esPrestamista ? <DirectionsRun /> : (esParqueadero ? <LocalParking /> : <AddShoppingCart />),
                color: GREEN
              },
            ].map((step, idx) => (
              <Grid item xs={12} sm={4} key={idx}>
                <CardActionArea onClick={() => navigate(step.path)} sx={{ height: '100%', borderRadius: 4, transition: 'all 0.3s' }}>
                  <Paper sx={{
                    p: 4,
                    height: '100%',
                    borderRadius: 4,
                    border: '1px solid',
                    borderColor: 'divider',
                    bgcolor: 'background.paper',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    transition: 'all 0.3s',
                    '&:hover': { borderColor: step.color, bgcolor: `${step.color}05`, transform: 'translateY(-5px)', boxShadow: `0 12px 30px ${step.color}15` }
                  }}>
                    <Box sx={{ width: 56, height: 56, borderRadius: '16px', bgcolor: `${step.color}10`, color: step.color, mb: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{React.cloneElement(step.icon, { sx: { fontSize: 28 } })}</Box>
                    <Typography sx={{ fontWeight: 800, fontSize: 16, mb: 1, color: 'text.primary' }}>{step.title}</Typography>
                    <Typography sx={{ fontSize: 12, color: 'text.secondary', textAlign: 'center' }}>{step.desc}</Typography>
                  </Paper>
                </CardActionArea>
              </Grid>
            ))}
          </Grid>

          <Box sx={{ mt: 6, pt: 4, borderTop: '1px solid', borderColor: 'divider' }}>
            <Typography variant="caption" color="text.secondary">¿Necesitas ayuda personalizada? Contacta a nuestro equipo de soporte.</Typography>
          </Box>
        </Paper>
      ) : (
        <Grid container spacing={1.5} sx={{ mb: 3 }}>
          <Grid item xs={12} md={8}>
            <Paper sx={{
              p: 2,
              borderRadius: 3,
              bgcolor: 'background.paper',
              border: '1px solid',
              borderColor: 'divider',
              height: '100%',
              boxSizing: 'border-box',
              boxShadow: theme.palette.mode === 'dark' ? '0 2px 12px rgba(0,0,0,0.3)' : '0 2px 12px rgba(0,0,0,0.06)',
            }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1, flexWrap: 'wrap', gap: 1 }}>
                <Box>
                  <Typography sx={{ fontWeight: 700, fontSize: 14, color: 'text.primary' }}>{esPrestamista ? 'Historial de Recaudos' : 'Ventas — últimos 30 días'}</Typography>
                  <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>Total: <strong>{formatCurrency(totalUltimos30)}</strong></Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  {mejorDia.total > 0 && <Chip label={`🏆 Mejor: ${formatCurrency(mejorDia.total)}`} size="small" sx={{ bgcolor: `${ACCENT}12`, color: ACCENT, fontWeight: 700, fontSize: 10 }} />}
                  <Box sx={{ display: 'flex', border: '1px solid', borderColor: 'divider', borderRadius: 1.5, overflow: 'hidden' }}>
                    {[7, 30].map(d => (
                      <Box
                        key={d}
                        onClick={() => setSparkDays(d)}
                        sx={{
                          px: 1.2, py: 0.4, fontSize: 10, fontWeight: 700, cursor: 'pointer',
                          bgcolor: sparkDays === d ? `${ACCENT}18` : 'transparent',
                          color: sparkDays === d ? ACCENT : 'text.secondary',
                          transition: 'all 0.2s',
                          '&:hover': { bgcolor: sparkDays === d ? `${ACCENT}18` : 'action.hover' },
                        }}
                      >
                        {d}d
                      </Box>
                    ))}
                  </Box>
                </Box>
              </Box>
              {ventas30.length > 1 ? <Sparkline data={ventas30.slice(-sparkDays)} color={esPrestamista ? GREEN : ACCENT} height={isMobile ? 60 : 90} /> : <Box sx={{ textAlign: 'center', py: 3, color: 'text.secondary' }}><Typography fontSize={12}>Faltan datos para graficar</Typography></Box>}
            </Paper>
          </Grid>
          <Grid item xs={12} md={4}>
            <Paper sx={{
              p: 2,
              borderRadius: 3,
              bgcolor: 'background.paper',
              border: '1px solid',
              borderColor: 'divider',
              boxSizing: 'border-box',
              boxShadow: theme.palette.mode === 'dark' ? '0 2px 12px rgba(0,0,0,0.3)' : '0 2px 12px rgba(0,0,0,0.06)',
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <PointOfSale sx={{ color: YELLOW, fontSize: 16 }} />
                <Typography sx={{ fontWeight: 700, fontSize: 13, color: 'text.primary' }}>Caja actual</Typography>
              </Box>
              {caja ? (
                <>
                  <MetodoBarra icon={<AttachMoney sx={{ fontSize: 13 }} />} label="Efectivo" value={caja.efectivo} total={caja.total_dia} color={GREEN} />
                  <MetodoBarra icon={<AccountBalance sx={{ fontSize: 13 }} />} label="Transferencia" value={caja.transferencia} total={caja.total_dia} color={BLUE} />
                  <Divider sx={{ my: 1 }} />
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography sx={{ fontSize: 12, fontWeight: 700, color: 'text.primary' }}>Saldo Neto</Typography>
                    <Typography sx={{ fontSize: 14, fontWeight: 800, color: YELLOW }}>{formatCurrency(caja.total_dia - (caja.total_gastos || 0))}</Typography>
                  </Box>
                </>
              ) : <Skeleton height={100} />}
            </Paper>
          </Grid>
        </Grid>
      )}

      {/* ── ACCESOS RÁPIDOS ── */}
      <Grid container spacing={1.5}>
        <Grid item xs={12}>
          <Paper sx={{
            p: 2,
            borderRadius: 3,
            bgcolor: 'background.paper',
            border: '1px solid',
            borderColor: 'divider',
            boxSizing: 'border-box',
            boxShadow: theme.palette.mode === 'dark' ? '0 2px 12px rgba(0,0,0,0.3)' : '0 2px 12px rgba(0,0,0,0.06)',
          }}>
            <Typography sx={{ fontWeight: 700, fontSize: 10, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.6, mb: 1.5 }}>Acceso rápido</Typography>
            <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
              {accesosRapidos.map(({ label, icon, color, path }) => (
                <Box key={label} onClick={() => navigate(path)} sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1.1, borderRadius: 2.5, bgcolor: `${color}0D`, border: `1px solid ${color}22`, cursor: 'pointer', transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)', '&:hover': { bgcolor: `${color}1A`, transform: 'translateY(-2px)', boxShadow: `0 6px 16px ${color}18`, borderColor: `${color}45` } }}>
                  <Box sx={{ color, display: 'flex' }}>{icon}</Box>
                  <Typography sx={{ fontSize: 12, fontWeight: 700, color, whiteSpace: 'nowrap' }}>{label}</Typography>
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
