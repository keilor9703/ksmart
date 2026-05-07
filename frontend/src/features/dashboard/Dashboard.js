import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Paper, Grid, CircularProgress,
  Divider, Chip, useMediaQuery, Skeleton, Button,
  CardActionArea, Dialog, DialogTitle, DialogContent, IconButton
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  MonetizationOn, AccountBalanceWallet, Warning,
  TrendingUp, PointOfSale, AttachMoney, AccountBalance, 
  Business, RocketLaunch, Storefront, PeopleOutline, 
  AddShoppingCart, DirectionsRun, Savings, Gavel, 
  Inventory2Outlined, Close, WorkspacePremium, ShoppingCart,
  LocalParking, TwoWheeler
} from '@mui/icons-material';
import apiClient from '../../api';
import { formatCurrency } from '../../utils/formatters';
import WompiButton from '../../components/common/WompiButton';
// Al tope, junto a los otros imports:
import CacaoPriceWidget from './CacaoPriceWidget';


const ACCENT  = '#FF6020';
const GREEN   = '#10B981';
const BLUE    = '#3B82F6';
const YELLOW  = '#F59E0B';
const RED     = '#EF4444';
const PURPLE  = '#8B5CF6';

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

const Dashboard = () => {
  const [data, setData]           = useState(null);
  const [caja, setCaja]           = useState(null);
  const [user, setUser]           = useState(null);
  
  const [loadingMain, setLoadingMain] = useState(true);
  const [loadingCaja, setLoadingCaja] = useState(true);

  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [planes, setPlanes] = useState([]);
  const [loadingPlanes, setLoadingPlanes] = useState(false);

  const navigate  = useNavigate();
  const theme     = useTheme();
  const isMobile  = useMediaQuery(theme.breakpoints.down('sm'));

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
      if (cajaRes.status === 'fulfilled') setCaja(cajaRes.value.data);
      if (userRes.status === 'fulfilled') setUser(userRes.value.data);
    } finally {
      setLoadingMain(false);
      setLoadingCaja(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleOpenUpgrade = async () => {
    setUpgradeOpen(true);
    if (planes.length === 0) {
      setLoadingPlanes(true);
      try {
        const { data: resPlanes } = await apiClient.get('/planes-activos');
        setPlanes(resPlanes);
      } catch (error) {
        console.error("Error cargando planes:", error);
      } finally {
        setLoadingPlanes(false);
      }
    }
  };

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

  if (loadingMain && !data) return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
      <CircularProgress sx={{ color: ACCENT }} />
    </Box>
  );

  const ventas30       = data?.ventas_ultimos_30_dias || [];
  const totalUltimos30 = ventas30.reduce((s, d) => s + d.total, 0);
  const mejorDia = ventas30.reduce((mx, d) => d.total > mx.total ? d : mx, { total: 0, day: '' });

  const calculateDaysLeft = (dateString) => {
    if (!dateString) return 0;
    const endsAt = new Date(dateString.endsWith('Z') ? dateString : dateString + 'Z');
    const diffTime = endsAt - new Date();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const diasRestantes = calculateDaysLeft(user?.empresa?.trial_ends_at);
  const isZeroState = esPrestamista 
    ? (data?.capital_en_calle || 0) === 0 && (caja?.total_dia || 0) === 0
    : totalUltimos30 === 0 && (data?.cuentas_por_cobrar || 0) === 0 && (caja?.total_dia || 0) === 0;

  return (
    <Box sx={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>

      {/* ── HEADER ── */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, flexWrap: 'wrap', gap: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ 
            width: 40, height: 40, borderRadius: 2, 
            background: `linear-gradient(135deg, ${ACCENT}20, ${ACCENT}05)`, 
            display: 'flex', alignItems: 'center', justifyContent: 'center', 
            color: ACCENT, border: `1px solid ${ACCENT}30` 
          }}>
            {esPrestamista ? <Savings /> : (esParqueadero ? <LocalParking /> : <TrendingUp />)}
          </Box>
          <Box>
            <Typography sx={{ fontSize: 10, fontWeight: 800, color: ACCENT, textTransform: 'uppercase', letterSpacing: 1.2, mb: 0.1, display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Business sx={{ fontSize: 12 }} /> {user?.empresa?.nombre || 'Mi Empresa'}
            </Typography>
            <Typography sx={{ fontWeight: 800, fontSize: 18, lineHeight: 1.1, color: 'text.primary' }}>
              {esPrestamista ? 'Panel de Cobranzas' : (esParqueadero ? 'Panel de Parqueadero' : 'Resumen General')}
            </Typography>
            <Typography sx={{ fontSize: 11, color: 'text.secondary', mt: 0.2 }}>
              {new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })}
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* ── TRIAL BANNER ── */}
      {user?.empresa?.plan_type === 'trial' && user?.empresa_id !== 1 && diasRestantes > 0 && (
        <Box sx={{ mb: 3, p: 1.5, borderRadius: 2, bgcolor: '#EFF6FF', border: '1px solid #BFDBFE', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
          <Typography sx={{ fontSize: 12, color: '#1E3A8A', fontWeight: 600 }}>
            ⏱ Estás en tu periodo de prueba. Te quedan {diasRestantes} días gratis.
          </Typography>
          <Button size="small" variant="contained" onClick={handleOpenUpgrade} sx={{ bgcolor: '#2563EB', fontSize: 11, fontWeight: 700, boxShadow: 'none' }}>
            Activar mi cuenta
          </Button>
        </Box>
      )}

      {/* ── KPI GRID ── */}
      <Grid container spacing={1.5} sx={{ mb: 3 }}>
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



{user?.empresa_id === 1 && <CacaoPriceWidget />}


      {/* ── CONTENIDO PRINCIPAL ── */}
      {isZeroState ? (
        <Paper sx={{ p: { xs: 3, md: 5 }, borderRadius: 4, boxShadow: '0 10px 40px rgba(0,0,0,0.04)', textAlign: 'center', mb: 3, border: '1px solid rgba(0,0,0,0.05)', background: 'linear-gradient(to bottom, #ffffff, #fcfcfc)' }}>
          <Box sx={{ width: 80, height: 80, borderRadius: '24px', bgcolor: `${ACCENT}10`, color: ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 3, transform: 'rotate(-5deg)', boxShadow: `0 8px 20px ${ACCENT}20` }}>
            <RocketLaunch sx={{ fontSize: 40 }} />
          </Box>
          <Typography variant="h4" sx={{ fontWeight: 900, mb: 1, letterSpacing: -0.5 }}>¡Bienvenido, {user?.nombre_completo?.split(' ')[0] || 'Usuario'}!</Typography>
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
                  <Paper sx={{ p: 4, height: '100%', borderRadius: 4, border: '1px solid', borderColor: 'divider', display: 'flex', flexDirection: 'column', alignItems: 'center', transition: 'all 0.3s', '&:hover': { borderColor: step.color, bgcolor: `${step.color}05`, transform: 'translateY(-5px)', boxShadow: `0 12px 30px ${step.color}15` } }}>
                    <Box sx={{ width: 56, height: 56, borderRadius: '16px', bgcolor: `${step.color}10`, color: step.color, mb: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{React.cloneElement(step.icon, { sx: { fontSize: 28 } })}</Box>
                    <Typography sx={{ fontWeight: 800, fontSize: 16, mb: 1 }}>{step.title}</Typography>
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
            <Paper sx={{ p: 2, borderRadius: 3, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', height: '100%', boxSizing: 'border-box' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1, flexWrap: 'wrap', gap: 1 }}>
                <Box>
                  <Typography sx={{ fontWeight: 700, fontSize: 14 }}>{esPrestamista ? 'Historial de Recaudos' : 'Ventas — últimos 30 días'}</Typography>
                  <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>Total: <strong>{formatCurrency(totalUltimos30)}</strong></Typography>
                </Box>
                {mejorDia.total > 0 && <Chip label={`🏆 Mejor: ${formatCurrency(mejorDia.total)}`} size="small" sx={{ bgcolor: `${ACCENT}12`, color: ACCENT, fontWeight: 700, fontSize: 10 }} />}
              </Box>
              {ventas30.length > 1 ? <Sparkline data={ventas30} color={esPrestamista ? GREEN : ACCENT} height={isMobile ? 60 : 90} /> : <Box sx={{ textAlign: 'center', py: 3, color: 'text.secondary' }}><Typography fontSize={12}>Faltan datos para graficar</Typography></Box>}
            </Paper>
          </Grid>
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 2, borderRadius: 3, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', boxSizing: 'border-box' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <PointOfSale sx={{ color: YELLOW, fontSize: 16 }} />
                <Typography sx={{ fontWeight: 700, fontSize: 13 }}>Caja actual</Typography>
              </Box>
              {caja ? (
                <>
                  <MetodoBarra icon={<AttachMoney sx={{ fontSize: 13 }} />} label="Efectivo" value={caja.efectivo} total={caja.total_dia} color={GREEN} />
                  <MetodoBarra icon={<AccountBalance sx={{ fontSize: 13 }} />} label="Transferencia" value={caja.transferencia} total={caja.total_dia} color={BLUE} />
                  <Divider sx={{ my: 1 }} />
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography sx={{ fontSize: 12, fontWeight: 700 }}>Saldo Neto</Typography>
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
          <Paper sx={{ p: 2, borderRadius: 3, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', boxSizing: 'border-box' }}>
            <Typography sx={{ fontWeight: 700, fontSize: 10, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.6, mb: 1.5 }}>Acceso rápido autorizado</Typography>
            <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
              {accesosRapidos.map(({ label, icon, color, path }) => (
                <Box key={label} onClick={() => navigate(path)} sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1, borderRadius: 2.5, bgcolor: `${color}0D`, border: `1px solid ${color}25`, cursor: 'pointer', transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)', '&:hover': { bgcolor: `${color}18`, transform: 'translateY(-2px)', boxShadow: `0 4px 12px ${color}15` } }}>
                  <Box sx={{ color, display: 'flex' }}>{icon}</Box>
                  <Typography sx={{ fontSize: 12, fontWeight: 700, color, whiteSpace: 'nowrap' }}>{label}</Typography>
                </Box>
              ))}
            </Box>
          </Paper>
        </Grid>
      </Grid>

      {/* ── MODAL DE SUSCRIPCIÓN ── */}
      <Dialog open={upgradeOpen} onClose={() => setUpgradeOpen(false)} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: 3, bgcolor: 'background.default' } }}>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: 'background.paper', borderBottom: '1px solid', borderColor: 'divider' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{ width: 40, height: 40, borderRadius: 2, bgcolor: 'rgba(244, 63, 94, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#F43F5E' }}>
              <WorkspacePremium />
            </Box>
            <Typography sx={{ fontWeight: 800, fontSize: 18 }}>Elige tu Plan</Typography>
          </Box>
          <IconButton onClick={() => setUpgradeOpen(false)}><Close /></IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: { xs: 2, md: 4 } }}>
          {loadingPlanes ? <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}><CircularProgress sx={{ color: '#F43F5E' }} /></Box> :
            <Grid container spacing={3}>
              {planes.map(plan => (
                <Grid item xs={12} sm={6} md={4} key={plan.id}>
                  <Paper sx={{ p: 3, textAlign: 'center', borderRadius: 3, border: '1px solid', borderColor: 'divider', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', bgcolor: 'background.paper' }}>
                    <Typography sx={{ fontWeight: 800, fontSize: 18, mb: 1 }}>{plan.nombre}</Typography>
                    <Typography sx={{ fontSize: 24, fontWeight: 800, color: '#F43F5E', mb: 1 }}>{formatCurrency(plan.precio)}</Typography>
                    <Typography sx={{ fontSize: 13, color: 'text.secondary', mb: 3 }}>Acceso total por {plan.dias_duracion} días</Typography>
                    <WompiButton planName={plan.codigo_interno} onSuccess={() => { setUpgradeOpen(false); window.location.reload(); }} />
                  </Paper>
                </Grid>
              ))}
            </Grid>
          }
        </DialogContent>
      </Dialog>

    </Box>
  );
};

export default Dashboard;