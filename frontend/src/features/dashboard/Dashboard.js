import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Paper, Grid, CircularProgress,
  Chip, useMediaQuery, Skeleton, Button,
  Tooltip, IconButton, Divider, CardActionArea, Stack,
  LinearProgress, Collapse,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  MonetizationOn, AccountBalanceWallet, Warning,
  TrendingUp, PointOfSale, AttachMoney, AccountBalance,
  Business, RocketLaunch, Storefront, PeopleOutline,
  AddShoppingCart, DirectionsRun, Savings, Gavel,
  Inventory2Outlined, ShoppingCart,
  LocalParking, TwoWheeler, Refresh,
  TrendingDown, LightbulbOutlined, Schedule, Speed,
  EmojiEvents, ArrowForward, Close, CheckCircle,
  AutoAwesome, Insights, CalendarToday, FiberManualRecord,
  KeyboardArrowRight, WbSunny, Nightlight, AccessTime,
  RadioButtonUnchecked, OpenInNew, BarChart,
} from '@mui/icons-material';
import { keyframes } from '@mui/system';
import apiClient from '../../api';
import { formatCurrency } from '../../utils/formatters';
import SaaSUpgradeManager from '../saas/components/SaaSUpgradeManager';
import CacaoPriceWidget from './CacaoPriceWidget';
import HelpGuideTopBar from '../../components/onboarding/HelpGuideTopBar';
import ActivationChecklist from '../../components/onboarding/ActivationChecklist';
import DailyWelcomeBanner from '../../components/common/DailyWelcomeBanner';

// ─── Design Tokens ────────────────────────────────────────────────────────────
const ACCENT  = '#0891B2';
const GREEN   = '#10B981';
const BLUE    = '#3B82F6';
const YELLOW  = '#F59E0B';
const RED     = '#EF4444';
const PURPLE  = '#8B5CF6';

const BUSINESS_TYPE_CONFIG = {
  erp:         { label: 'Comercio / ERP',  color: ACCENT,  Icon: Storefront },
  prestamos:   { label: 'Cobranzas',       color: GREEN,   Icon: AttachMoney },
  parqueadero: { label: 'Parqueadero',     color: BLUE,    Icon: LocalParking },
  lavadero:    { label: 'Lavadero',        color: PURPLE,  Icon: TwoWheeler },
  restaurante: { label: 'Restaurante',     color: RED,     Icon: Storefront },
};

const TIPS = {
  erp: [
    '💡 Activa el catálogo virtual para recibir pedidos online de tus clientes.',
    '📦 Configura alertas de stock mínimo para no quedarte sin productos clave.',
    '📊 Revisa el módulo Reportes cada semana para identificar tus productos más rentables.',
    '🧾 Conecta la facturación electrónica DIAN para cumplir con tus obligaciones fiscales.',
  ],
  prestamos: [
    '🛣️ Usa la Ruta de Cobro para organizar tus visitas de campo por zona.',
    '⚠️ Revisa diariamente el estado de mora para actuar rápido con clientes en riesgo.',
    '📈 Analiza qué clientes tienen mejor historial de pago para darles mejores tasas.',
  ],
  parqueadero: [
    '🚗 Activa la notificación cuando venza una mensualidad.',
    '📊 Revisa los ingresos por hora vs mensualidad para optimizar tarifas.',
  ],
  lavadero: [
    '⭐ Registra la productividad de cada operario para identificar al más eficiente.',
    '📱 Comparte el link de tu catálogo virtual con tus clientes frecuentes.',
  ],
  restaurante: [
    '🍽️ Configura tus mesas y áreas para visualizar la ocupación en tiempo real.',
    '👨‍🍳 Activa la pantalla de cocina para que el equipo vea las comandas en tiempo real.',
  ],
};

// ─── Keyframes ────────────────────────────────────────────────────────────────
const fadeInUp = keyframes`
  from { opacity: 0; transform: translateY(14px); }
  to   { opacity: 1; transform: translateY(0); }
`;
const fadeIn = keyframes`
  from { opacity: 0; }
  to   { opacity: 1; }
`;
const floatAnim = keyframes`
  0%, 100% { transform: translateY(0px) rotate(-5deg); }
  50%       { transform: translateY(-9px) rotate(-5deg); }
`;
const pulseSoft = keyframes`
  0%,100% { transform: scale(1); }
  50%     { transform: scale(1.05); }
`;
const blobPulse = keyframes`
  0%,100% { transform: scale(0.88); opacity: 0.75; }
  50%      { transform: scale(1.15); opacity: 0.2; }
`;
const cardEntrance = keyframes`
  from { opacity: 0; transform: scale(0.9) translateY(28px); }
  to   { opacity: 1; transform: scale(1) translateY(0); }
`;
const shimmerMove = keyframes`
  0%   { left: -100%; }
  100% { left: 200%; }
`;
const ringRotate = keyframes`
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
`;
const gradientShift = keyframes`
  0%   { background-position: 0% 50%; }
  50%  { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
`;

// ─── Helpers ──────────────────────────────────────────────────────────────────
const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 5)  return { msg: 'Buenas noches',  emoji: '🌙', Icon: Nightlight, color: '#6366f1' };
  if (h < 12) return { msg: 'Buenos días',    emoji: '☀️', Icon: WbSunny,   color: YELLOW };
  if (h < 19) return { msg: 'Buenas tardes',  emoji: '🌤️', Icon: WbSunny,   color: ACCENT };
  return       { msg: 'Buenas noches',         emoji: '🌙', Icon: Nightlight, color: '#6366f1' };
};

const getFormattedDate = () => {
  return new Date().toLocaleDateString('es-CO', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
};

// ─── Realtime Clock ───────────────────────────────────────────────────────────
function RealtimeClock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <Box sx={{ textAlign: 'right' }}>
      <Typography sx={{ fontSize: 12, color: 'text.disabled', fontVariantNumeric: 'tabular-nums', fontWeight: 600, letterSpacing: 0.3 }}>
        {time.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
      </Typography>
      <Typography sx={{ fontSize: 9.5, color: 'text.disabled', textTransform: 'capitalize', lineHeight: 1.2 }}>
        {getFormattedDate()}
      </Typography>
    </Box>
  );
}

// ─── AnimatedNumber ───────────────────────────────────────────────────────────
function AnimatedNumber({ value, format = 'currency', duration = 750 }) {
  const [display, setDisplay] = useState(0);
  const rafRef    = useRef(null);
  const startRef  = useRef(null);
  const prevRef   = useRef(0);
  const numVal = typeof value === 'number' ? value : (parseFloat(String(value).replace(/[^0-9.-]/g, '')) || 0);

  useEffect(() => {
    const from = prevRef.current;
    const to   = numVal;
    startRef.current = null;

    const step = (ts) => {
      if (!startRef.current) startRef.current = ts;
      const progress = Math.min((ts - startRef.current) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const cur = from + (to - from) * eased;
      setDisplay(cur);
      prevRef.current = cur;
      if (progress < 1) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [numVal, duration]);

  if (format === 'currency') return <>{formatCurrency(display)}</>;
  return <>{Math.round(display).toLocaleString('es-CO')}</>;
}

// ─── KPI Card (Premium) ───────────────────────────────────────────────────────
const KpiCard = ({ title, value, icon, color, sub, onClick, loading, delta, format = 'currency', delay = 0 }) => {
  const theme  = useTheme();
  const dark   = theme.palette.mode === 'dark';
  const deltaUp   = delta > 0;
  const deltaColor = delta == null ? null : (deltaUp ? GREEN : RED);
  const numVal = typeof value === 'number' ? value : (parseFloat(String(value).replace(/[^0-9.-]/g, '')) || 0);
  const nonZero = numVal > 0;

  return (
    <Paper onClick={onClick} sx={{
      p: 2, borderRadius: 3,
      display: 'flex', alignItems: 'flex-start', gap: 1.5,
      boxShadow: dark
        ? '0 2px 12px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.04)'
        : '0 2px 12px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04)',
      cursor: onClick ? 'pointer' : 'default',
      transition: 'all 0.25s cubic-bezier(0.4,0,0.2,1)',
      width: '100%', boxSizing: 'border-box',
      bgcolor: 'background.paper',
      animation: `${fadeInUp} 0.5s ${delay}s ease both`,
      borderTop: nonZero && !loading ? `3px solid ${color}` : '3px solid transparent',
      position: 'relative', overflow: 'hidden',
      '&:hover': onClick ? {
        transform: 'translateY(-3px)',
        boxShadow: dark
          ? `0 8px 24px rgba(0,0,0,0.45), 0 0 0 1px ${color}30`
          : `0 8px 24px rgba(0,0,0,0.1), 0 0 0 1px ${color}30`,
        '& .kpi-shimmer': { animation: `${shimmerMove} 0.6s ease` },
      } : {},
    }}>
      {/* Shimmer overlay */}
      <Box className="kpi-shimmer" sx={{
        position: 'absolute', top: 0, left: '-100%', width: '60%', height: '100%',
        background: `linear-gradient(90deg, transparent, ${color}08, transparent)`,
        pointerEvents: 'none', zIndex: 0,
      }} />

      <Box sx={{
        width: 44, height: 44, borderRadius: 2.5, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        bgcolor: `${color}18`, color,
        ...(nonZero && !loading ? { animation: `${pulseSoft} 3.5s ease-in-out infinite` } : {}),
        position: 'relative', zIndex: 1,
      }}>
        {icon}
      </Box>
      <Box sx={{ minWidth: 0, flex: 1, position: 'relative', zIndex: 1 }}>
        <Typography sx={{ fontSize: 10, color: 'text.secondary', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.7 }}>
          {title}
        </Typography>
        {loading ? <Skeleton width={88} height={28} sx={{ borderRadius: 1, mt: 0.5 }} /> : (
          <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75, flexWrap: 'wrap', mt: 0.3 }}>
            <Typography sx={{ fontSize: 19, fontWeight: 900, lineHeight: 1.2, color: 'text.primary', letterSpacing: -0.5 }}>
              <AnimatedNumber value={numVal} format={format} />
            </Typography>
            {delta != null && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.2 }}>
                {deltaUp
                  ? <TrendingUp sx={{ fontSize: 12, color: GREEN }} />
                  : <TrendingDown sx={{ fontSize: 12, color: RED }} />}
                <Typography sx={{ fontSize: 9.5, fontWeight: 700, color: deltaColor, lineHeight: 1 }}>
                  {Math.abs(delta).toFixed(0)}% vs ayer
                </Typography>
              </Box>
            )}
          </Box>
        )}
        {sub && !loading && (
          <Typography sx={{ fontSize: 10, color: 'text.secondary', mt: 0.2 }}>{sub}</Typography>
        )}
      </Box>
    </Paper>
  );
};

// ─── Smooth Bezier Sparkline ──────────────────────────────────────────────────
const Sparkline = ({ data, color, height = 70 }) => {
  const uid = useRef(`sg${Math.random().toString(36).slice(2, 7)}`).current;
  if (!data || data.length < 2) return null;
  const vals  = data.map(d => d.total);
  const max   = Math.max(...vals, 1);
  const min   = Math.min(...vals);
  const range = max - min || 1;
  const W = 300, H = height, pad = 6;

  const pts = vals.map((v, i) => ({
    x: pad + (i / (vals.length - 1)) * (W - pad * 2),
    y: H - pad - ((v - min) / range) * (H - pad * 2),
  }));

  const pathD = pts.reduce((acc, pt, i) => {
    if (i === 0) return `M ${pt.x},${pt.y}`;
    const prev = pts[i - 1];
    const cpx  = (prev.x + pt.x) / 2;
    return `${acc} C ${cpx},${prev.y} ${cpx},${pt.y} ${pt.x},${pt.y}`;
  }, '');

  const areaD = `${pathD} L ${pts[pts.length - 1].x},${H - pad} L ${pad},${H - pad} Z`;
  const last  = pts[pts.length - 1];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: '100%', height }} aria-hidden>
      <defs>
        <linearGradient id={uid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={areaD} fill={`url(#${uid})`} />
      <path d={pathD} fill="none" stroke={color} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={last.x} cy={last.y} r="4.5" fill={color} />
      <circle cx={last.x} cy={last.y} r="4" fill={color} opacity="0.25">
        <animate attributeName="r"       values="4;10;4"     dur="2s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.3;0;0.3"  dur="2s" repeatCount="indefinite" />
      </circle>
    </svg>
  );
};

// ─── Métodos de Pago Bar ──────────────────────────────────────────────────────
const MetodoBarra = ({ label, value, total, color, icon }) => {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <Box sx={{ mb: 1.3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
          <Box sx={{ color, display: 'flex' }}>{icon}</Box>
          <Typography sx={{ fontSize: 11.5 }}>{label}</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4 }}>
          <Typography sx={{ fontSize: 11, fontWeight: 700, color }}>{formatCurrency(value)}</Typography>
          <Typography sx={{ fontSize: 9.5, color: 'text.disabled', fontWeight: 600 }}>({pct.toFixed(0)}%)</Typography>
        </Box>
      </Box>
      <Box sx={{ height: 6, borderRadius: 3, bgcolor: `${color}15`, overflow: 'hidden' }}>
        <Box sx={{
          height: '100%', width: `${pct}%`, borderRadius: 3,
          background: `linear-gradient(90deg, ${color}88, ${color})`,
          transition: 'width 0.85s cubic-bezier(0.4,0,0.2,1)',
        }} />
      </Box>
    </Box>
  );
};

// ─── Rotating Tip Banner ──────────────────────────────────────────────────────
function TipBanner({ tipoNegocio }) {
  const tips  = TIPS[tipoNegocio] || TIPS.erp;
  const [idx, setIdx]   = useState(0);
  const [show, setShow] = useState(true);

  useEffect(() => {
    const t = setInterval(() => {
      setShow(false);
      setTimeout(() => { setIdx(i => (i + 1) % tips.length); setShow(true); }, 320);
    }, 8000);
    return () => clearInterval(t);
  }, [tips.length]);

  return (
    <Box sx={{
      display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1.2,
      borderRadius: 2.5, bgcolor: 'action.hover',
      border: '1px solid', borderColor: 'divider', mb: 2,
      opacity: show ? 1 : 0, transform: show ? 'translateY(0)' : 'translateY(5px)',
      transition: 'opacity 0.3s ease, transform 0.3s ease',
    }}>
      <LightbulbOutlined sx={{ fontSize: 16, color: YELLOW, flexShrink: 0 }} />
      <Typography sx={{ fontSize: 12, color: 'text.secondary', lineHeight: 1.5, fontWeight: 500 }}>
        {tips[idx]}
      </Typography>
    </Box>
  );
}

// ─── Smart Insights ───────────────────────────────────────────────────────────
function InsightsPanel({ data, tipoNegocio, ventasHoyVal, ventasAyerVal, totalUltimos30, dark }) {
  const insights = useMemo(() => {
    const list = [];
    if (!data) return list;

    const promedioDiario = totalUltimos30 / 30;
    const vsDelta = ventasAyerVal > 0
      ? ((ventasHoyVal - ventasAyerVal) / ventasAyerVal) * 100
      : null;

    if (tipoNegocio === 'erp' || tipoNegocio === 'lavadero') {
      if (ventasHoyVal > 0 && promedioDiario > 0) {
        const vsPromedio = ((ventasHoyVal - promedioDiario) / promedioDiario) * 100;
        if (vsPromedio > 10) {
          list.push({
            icon: <TrendingUp sx={{ fontSize: 14 }} />,
            color: GREEN,
            text: `Las ventas de hoy están ${Math.abs(vsPromedio).toFixed(0)}% por encima del promedio diario de los últimos 30 días.`,
          });
        } else if (vsPromedio < -10) {
          list.push({
            icon: <TrendingDown sx={{ fontSize: 14 }} />,
            color: YELLOW,
            text: `Las ventas de hoy están ${Math.abs(vsPromedio).toFixed(0)}% por debajo del promedio. ¡Empuja antes del cierre!`,
          });
        }
      }
      if ((data.productos_bajo_stock || 0) > 0) {
        list.push({
          icon: <Warning sx={{ fontSize: 14 }} />,
          color: RED,
          text: `Tienes ${data.productos_bajo_stock} producto${data.productos_bajo_stock > 1 ? 's' : ''} bajo stock mínimo. Realiza una compra hoy para evitar quiebres.`,
        });
      }
      if ((data.cuentas_por_cobrar || 0) > 0) {
        list.push({
          icon: <AccountBalanceWallet sx={{ fontSize: 14 }} />,
          color: BLUE,
          text: `Tienes ${formatCurrency(data.cuentas_por_cobrar)} pendiente por cobrar. Gestiona tu cartera para mejorar el flujo de caja.`,
        });
      }
    }

    if (tipoNegocio === 'prestamos') {
      if ((data.cuotas_mora || 0) > 0) {
        list.push({
          icon: <Warning sx={{ fontSize: 14 }} />,
          color: RED,
          text: `${data.cuotas_mora} cuota${data.cuotas_mora > 1 ? 's' : ''} en mora. Prioriza estos cobros en tu ruta de hoy.`,
        });
      }
      if ((data.capital_en_calle || 0) > 0 && (data.recaudo_prestamos_hoy || 0) > 0) {
        const tasaRecaudo = ((data.recaudo_prestamos_hoy / data.capital_en_calle) * 100).toFixed(1);
        list.push({
          icon: <TrendingUp sx={{ fontSize: 14 }} />,
          color: GREEN,
          text: `Recaudaste el ${tasaRecaudo}% del capital activo hoy. Buen ritmo de cobro.`,
        });
      }
    }

    if (tipoNegocio === 'parqueadero') {
      if ((data.vencidas || 0) > 0) {
        list.push({
          icon: <Warning sx={{ fontSize: 14 }} />,
          color: RED,
          text: `${data.vencidas} mensualidad${data.vencidas > 1 ? 'es' : ''} vencida${data.vencidas > 1 ? 's' : ''}. Contacta a esos clientes hoy.`,
        });
      }
    }

    if (list.length === 0) {
      list.push({
        icon: <AutoAwesome sx={{ fontSize: 14 }} />,
        color: ACCENT,
        text: 'Los insights aparecerán cuando tengas más datos de operación. ¡Registra tu primera transacción!',
      });
    }

    return list.slice(0, 3);
  }, [data, tipoNegocio, ventasHoyVal, ventasAyerVal, totalUltimos30]);

  return (
    <Paper sx={{
      p: 2, borderRadius: 3, mb: 2,
      bgcolor: 'background.paper',
      border: '1px solid', borderColor: 'divider',
      boxShadow: dark ? '0 2px 12px rgba(0,0,0,0.3)' : '0 2px 12px rgba(0,0,0,0.06)',
      animation: `${fadeInUp} 0.5s 0.15s ease both`,
    }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
        <Box sx={{ width: 26, height: 26, borderRadius: 1.5, bgcolor: `${ACCENT}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Insights sx={{ color: ACCENT, fontSize: 14 }} />
        </Box>
        <Typography sx={{ fontWeight: 700, fontSize: 11, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.7 }}>
          Insights del negocio
        </Typography>
      </Box>
      <Stack spacing={0.8}>
        {insights.map((ins, i) => (
          <Box key={i} sx={{
            display: 'flex', alignItems: 'flex-start', gap: 1.2,
            px: 1.4, py: 0.9, borderRadius: 2,
            bgcolor: `${ins.color}08`,
            border: `1px solid ${ins.color}18`,
          }}>
            <Box sx={{ color: ins.color, flexShrink: 0, mt: 0.1 }}>{ins.icon}</Box>
            <Typography sx={{ fontSize: 11.5, color: 'text.secondary', lineHeight: 1.5, fontWeight: 500 }}>
              {ins.text}
            </Typography>
          </Box>
        ))}
      </Stack>
    </Paper>
  );
}

// ─── Welcome Overlay (new users — cinematic) ──────────────────────────────────
function WelcomeOverlay({ user, tipoNegocio, onDismiss }) {
  const navigate  = useNavigate();
  const theme     = useTheme();
  const dark      = theme.palette.mode === 'dark';
  const biz       = BUSINESS_TYPE_CONFIG[tipoNegocio] || BUSINESS_TYPE_CONFIG.erp;
  const nombre    = user?.nombre_completo?.split(' ')[0] || user?.username || 'usuario';
  const [step, setStep] = useState(0);
  const [checkedItems, setCheckedItems] = useState({});

  const toggleCheck = (id) => setCheckedItems(p => ({ ...p, [id]: !p[id] }));

  const SLIDES = [
    {
      emoji: '🎉',
      title: `¡Bienvenido a Ksmart360, ${nombre}!`,
      desc: 'Tu plataforma inteligente de gestión empresarial está lista. Tienes 14 días de prueba gratuita para explorar todo sin costo.',
      cta: 'Empezar tour',
      color: biz.color,
    },
    {
      emoji: '🏪',
      title: 'Tu negocio, tu módulo',
      desc: `Detectamos que gestionarás un negocio de tipo "${biz.label}". Tus KPIs, módulos y reportes están 100% optimizados para darte la información más relevante.`,
      cta: 'Siguiente',
      color: biz.color,
    },
    {
      emoji: '🚀',
      title: '3 pasos para despegar',
      desc: 'Marca los pasos que quieres completar hoy y te guiaremos en cada uno.',
      cta: 'Siguiente',
      color: GREEN,
      isChecklist: true,
    },
    {
      emoji: '✨',
      title: '¡Todo listo!',
      desc: 'Tu panel de control está activo. Explora los módulos del menú lateral y recuerda: el equipo de Ksmart360 está contigo en cada paso.',
      cta: 'Ir al Dashboard',
      color: ACCENT,
    },
  ];

  const cur = SLIDES[step];

  const CHECKLIST = [
    { id: 'product', label: 'Agrega tu catálogo de productos', emoji: '📦', path: '/productos' },
    { id: 'client',  label: 'Registra tu primer cliente',       emoji: '👤', path: '/clientes' },
    { id: 'sale',    label: 'Realiza tu primera venta',         emoji: '💰', path: '/ventas'   },
    { id: 'sub',     label: 'Activa tu suscripción completa',   emoji: '⭐', path: '/mi-suscripcion' },
  ];

  return (
    <Box sx={{
      position: 'fixed', inset: 0, zIndex: 9999, p: 2,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      bgcolor: dark ? 'rgba(5,8,20,0.92)' : 'rgba(10,15,35,0.88)',
      backdropFilter: 'blur(20px)',
      animation: `${fadeIn} 0.45s ease`,
    }}>
      {/* Ambient blobs */}
      <Box sx={{
        position: 'absolute', top: '8%', left: '12%', width: 380, height: 380,
        borderRadius: '50%', background: `radial-gradient(circle, ${biz.color}22, transparent 70%)`,
        filter: 'blur(55px)', pointerEvents: 'none',
        animation: `${blobPulse} 4.5s ease-in-out infinite`,
      }} />
      <Box sx={{
        position: 'absolute', bottom: '8%', right: '12%', width: 300, height: 300,
        borderRadius: '50%', background: `radial-gradient(circle, ${GREEN}1E, transparent 70%)`,
        filter: 'blur(48px)', pointerEvents: 'none',
        animation: `${blobPulse} 6s ease-in-out infinite reverse`,
      }} />

      {/* Card */}
      <Box sx={{
        width: '100%', maxWidth: 480,
        bgcolor: dark ? 'rgba(11,17,35,0.97)' : 'rgba(255,255,255,0.99)',
        borderRadius: 5,
        border: `1px solid ${dark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.06)'}`,
        boxShadow: `0 40px 80px rgba(0,0,0,0.5), 0 0 0 1px ${biz.color}28`,
        overflow: 'hidden',
        animation: `${cardEntrance} 0.6s cubic-bezier(0.34,1.56,0.64,1) both`,
      }}>
        {/* Animated progress bar top */}
        <Box sx={{ height: 5, bgcolor: 'action.hover', position: 'relative' }}>
          <Box sx={{
            position: 'absolute', left: 0, top: 0, height: '100%',
            width: `${((step + 1) / SLIDES.length) * 100}%`,
            background: `linear-gradient(90deg, ${biz.color}, ${GREEN})`,
            transition: 'width 0.55s cubic-bezier(0.4,0,0.2,1)',
            borderRadius: '0 4px 4px 0',
          }} />
        </Box>

        {/* Header with logo */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 3, pt: 2.5, pb: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <img src="/logos/svg/ksmart-icon-rounded.svg" alt="K360" style={{ width: 22, height: 22, borderRadius: 5 }} />
            <Typography sx={{ fontWeight: 800, fontSize: 12, color: 'text.secondary', letterSpacing: 0.2 }}>Ksmart360</Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 0.6 }}>
            {SLIDES.map((_, i) => (
              <Box key={i} sx={{
                height: 6,
                width: i === step ? 20 : 6,
                borderRadius: 3,
                bgcolor: i === step ? biz.color : (i < step ? `${GREEN}60` : 'action.hover'),
                transition: 'all 0.35s cubic-bezier(0.4,0,0.2,1)',
              }} />
            ))}
          </Box>
        </Box>

        <Box sx={{ p: 4, pt: 2.5, textAlign: 'center' }}>
          <Typography sx={{ fontSize: 52, lineHeight: 1.2, mb: 2, display: 'block', animation: `${floatAnim} 3s ease-in-out infinite` }}>
            {cur.emoji}
          </Typography>
          <Typography sx={{ fontWeight: 900, fontSize: { xs: 20, sm: 24 }, color: 'text.primary', letterSpacing: -0.5, mb: 1.5, lineHeight: 1.2 }}>
            {cur.title}
          </Typography>
          <Typography sx={{ fontSize: 14, color: 'text.secondary', lineHeight: 1.7, mb: cur.isChecklist ? 2.5 : 3.5, maxWidth: 380, mx: 'auto' }}>
            {cur.desc}
          </Typography>

          {/* Step 2: checklist interactivo */}
          {cur.isChecklist && (
            <Stack spacing={1} sx={{ mb: 3, textAlign: 'left', maxWidth: 340, mx: 'auto' }}>
              {CHECKLIST.map((item) => (
                <Box
                  key={item.id}
                  onClick={() => toggleCheck(item.id)}
                  sx={{
                    display: 'flex', alignItems: 'center', gap: 1.5,
                    px: 2, py: 1.1, borderRadius: 2.5, cursor: 'pointer',
                    bgcolor: checkedItems[item.id] ? `${GREEN}10` : 'action.hover',
                    border: '1px solid',
                    borderColor: checkedItems[item.id] ? `${GREEN}35` : 'divider',
                    transition: 'all 0.2s ease',
                    '&:hover': { borderColor: checkedItems[item.id] ? `${GREEN}50` : `${biz.color}40` },
                  }}
                >
                  <Box sx={{ color: checkedItems[item.id] ? GREEN : 'text.disabled', flexShrink: 0 }}>
                    {checkedItems[item.id]
                      ? <CheckCircle sx={{ fontSize: 18 }} />
                      : <RadioButtonUnchecked sx={{ fontSize: 18 }} />
                    }
                  </Box>
                  <Typography sx={{ fontSize: 13 }}>{item.emoji}</Typography>
                  <Typography sx={{ fontSize: 13, fontWeight: 600, color: 'text.primary', flex: 1, textDecoration: checkedItems[item.id] ? 'line-through' : 'none', opacity: checkedItems[item.id] ? 0.6 : 1 }}>
                    {item.label}
                  </Typography>
                </Box>
              ))}
            </Stack>
          )}

          <Button
            fullWidth
            onClick={() => {
              if (step < SLIDES.length - 1) setStep(s => s + 1);
              else onDismiss();
            }}
            sx={{
              py: 1.7, borderRadius: 3, fontWeight: 800, fontSize: 15,
              color: '#fff', textTransform: 'none',
              background: `linear-gradient(135deg, ${cur.color}, ${cur.color}cc)`,
              boxShadow: `0 8px 24px ${cur.color}40`,
              '&:hover': { boxShadow: `0 12px 32px ${cur.color}55`, transform: 'translateY(-1px)' },
              transition: 'all 0.2s ease',
            }}
          >
            {cur.cta}
          </Button>
        </Box>

        <Box sx={{ textAlign: 'center', pb: 2.5 }}>
          <Button onClick={onDismiss} sx={{ fontSize: 11.5, color: 'text.disabled', textTransform: 'none', '&:hover': { color: 'text.secondary', bgcolor: 'transparent' } }}>
            Saltar introducción
          </Button>
        </Box>
      </Box>
    </Box>
  );
}

// ─── Quick Access Grid ────────────────────────────────────────────────────────
function QuickAccessGrid({ accesosRapidos }) {
  const navigate = useNavigate();
  const theme = useTheme();
  const dark = theme.palette.mode === 'dark';

  return (
    <Paper sx={{
      p: 2.5, borderRadius: 3, bgcolor: 'background.paper',
      border: '1px solid', borderColor: 'divider', boxSizing: 'border-box',
      boxShadow: dark ? '0 2px 12px rgba(0,0,0,0.3)' : '0 2px 12px rgba(0,0,0,0.06)',
      animation: `${fadeInUp} 0.5s 0.35s ease both`,
    }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <Typography sx={{ fontWeight: 700, fontSize: 10.5, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.7 }}>
          Acceso rápido
        </Typography>
        <Box sx={{ flex: 1, height: 1, bgcolor: 'divider' }} />
      </Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 1.2 }}>
        {accesosRapidos.map(({ label, icon, color, path }) => (
          <Box
            key={label}
            onClick={() => navigate(path)}
            sx={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.8,
              px: 1.5, py: 1.6, borderRadius: 2.5,
              bgcolor: `${color}0D`, border: `1px solid ${color}20`,
              cursor: 'pointer', transition: 'all 0.22s cubic-bezier(0.4,0,0.2,1)',
              '&:hover': {
                bgcolor: `${color}18`,
                transform: 'translateY(-3px)',
                boxShadow: `0 8px 20px ${color}25`,
                borderColor: `${color}45`,
              },
              '&:active': { transform: 'translateY(0) scale(0.97)' },
            }}
          >
            <Box sx={{
              width: 38, height: 38, borderRadius: 2,
              bgcolor: `${color}18`, color,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {React.cloneElement(icon, { sx: { fontSize: 19 } })}
            </Box>
            <Typography sx={{ fontSize: 11, fontWeight: 700, color, textAlign: 'center', lineHeight: 1.2 }}>
              {label}
            </Typography>
          </Box>
        ))}
      </Box>
    </Paper>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
const Dashboard = ({ user }) => {
  const [data, setData]           = useState(null);
  const [caja, setCaja]           = useState(null);
  const [loadingMain, setLoadingMain] = useState(true);
  const [loadingCaja, setLoadingCaja] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [sparkDays, setSparkDays]     = useState(30);
  const [showWelcome, setShowWelcome] = useState(
    () => localStorage.getItem('ksmart_show_welcome') === 'true'
  );

  const navigate  = useNavigate();
  const theme     = useTheme();
  const isMobile  = useMediaQuery(theme.breakpoints.down('sm'));
  const dark      = theme.palette.mode === 'dark';

  const fetchAll = useCallback(async () => {
    setLoadingMain(true);
    setLoadingCaja(true);
    try {
      const [dashRes, cajaRes] = await Promise.allSettled([
        apiClient.get('/reportes/dashboard'),
        apiClient.get('/caja/corte/preview'),
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

  const handleDismissWelcome = () => {
    localStorage.removeItem('ksmart_show_welcome');
    setShowWelcome(false);
  };

  const hasAccess = (path) => {
    if (user?.role?.name === 'Admin' && user?.empresa_id === 1) return true;
    const mods = user?.empresa?.modulos_habilitados;
    if (!mods) return true;
    return mods.includes(path);
  };

  const esPrestamista = useMemo(() => {
    const mods = user?.empresa?.modulos_habilitados;
    return mods?.includes('/prestamos') && !mods?.includes('/ventas');
  }, [user]);

  const tipoNegocio = useMemo(
    () => data?.tipo_negocio || user?.empresa?.tipo_negocio || 'erp',
    [data, user]
  );

  const esParqueadero = useMemo(
    () => tipoNegocio === 'parqueadero' || user?.empresa?.modulos_habilitados?.includes('/parqueadero'),
    [tipoNegocio, user]
  );

  const esLavadero = useMemo(() => tipoNegocio === 'lavadero', [tipoNegocio]);

  const biz = BUSINESS_TYPE_CONFIG[tipoNegocio] || BUSINESS_TYPE_CONFIG.erp;

  const accesosRapidos = useMemo(() => {
    const todos = [
      { label: 'Nueva Venta',      icon: <AddShoppingCart />, color: ACCENT, path: '/ventas' },
      { label: 'Compras',          icon: <ShoppingCart />,   color: GREEN,  path: '/compras' },
      { label: 'Inventario',       icon: <Inventory2Outlined />, color: YELLOW, path: '/inventario' },
      { label: 'Terceros',         icon: <PeopleOutline />,  color: BLUE,   path: '/clientes' },
      { label: 'Caja / Gastos',    icon: <PointOfSale />,    color: PURPLE, path: '/caja' },
      { label: 'Reportes',         icon: <BarChart />,       color: RED,    path: '/reportes' },
      { label: 'Simular Préstamo', icon: <AttachMoney />,    color: GREEN,  path: '/prestamos' },
      { label: 'Ruta de Cobro',    icon: <DirectionsRun />,  color: BLUE,   path: '/ruta-cobro' },
    ];
    return todos.filter(a => hasAccess(a.path));
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const greeting    = getGreeting();
  const nombreCorto = user?.nombre_completo?.split(' ')[0] || user?.username || 'usuario';
  const isTrial     = user?.empresa?.plan_type === 'trial' && user?.empresa_id !== 1;

  // Días restantes de trial
  const diasTrial = useMemo(() => {
    if (!isTrial || !user?.empresa?.trial_ends_at) return null;
    const diff = new Date(user.empresa.trial_ends_at) - new Date();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }, [isTrial, user]);

  // Loading state
  if (loadingMain && !data) return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 300, gap: 2 }}>
      <CircularProgress sx={{ color: biz.color }} size={36} />
      <Typography sx={{ fontSize: 13, color: 'text.secondary', fontWeight: 500 }}>Cargando tu dashboard…</Typography>
    </Box>
  );

  const ventas30       = data?.ventas_ultimos_30_dias || [];
  const totalUltimos30 = ventas30.reduce((s, d) => s + d.total, 0);
  const mejorDia       = ventas30.reduce((mx, d) => d.total > mx.total ? d : mx, { total: 0 });
  const ventasHoyVal   = data?.ventas_hoy || 0;
  const ventasAyerVal  = data?.ventas_ayer || 0;
  const ventasDelta    = ventasAyerVal > 0 ? ((ventasHoyVal - ventasAyerVal) / ventasAyerVal) * 100 : null;
  const recaudoHoyVal  = data?.recaudo_prestamos_hoy || 0;

  const isZeroState = esPrestamista
    ? (data?.capital_en_calle || 0) === 0 && (caja?.total_dia || 0) === 0
    : esParqueadero
      ? (data?.ingresos_hoy || 0) === 0 && (data?.accesos_dentro?.length || 0) === 0 && (caja?.total_dia || 0) === 0
      : totalUltimos30 === 0 && (data?.cuentas_por_cobrar || 0) === 0 && (caja?.total_dia || 0) === 0;

  // Build & prioritize alerts
  const alerts = [];
  if (!esPrestamista && !esParqueadero) {
    if ((data?.productos_bajo_stock || 0) > 0)
      alerts.push({ label: `${data.productos_bajo_stock} productos bajo stock`, color: RED, path: '/inventario', pri: 2 });
    if ((data?.cuentas_por_cobrar || 0) > 0)
      alerts.push({ label: `${formatCurrency(data.cuentas_por_cobrar)} por cobrar`, color: YELLOW, path: '/clientes', pri: 1 });
  }
  if (esPrestamista) {
    if ((data?.cuotas_mora || 0) > 0)
      alerts.push({ label: `${data.cuotas_mora} cuotas en mora`, color: RED, path: '/ruta-cobro', pri: 2 });
    if ((data?.capital_en_calle || 0) > 0)
      alerts.push({ label: `${formatCurrency(data.capital_en_calle)} en calle`, color: BLUE, path: '/prestamos', pri: 1 });
  }
  if (esParqueadero) {
    if ((data?.vencidas || 0) > 0)
      alerts.push({ label: `${data.vencidas} mensualidades vencidas`, color: RED, path: '/parqueadero', pri: 2 });
    if ((data?.por_vencer_5_dias || 0) > 0)
      alerts.push({ label: `${data.por_vencer_5_dias} vencen en 5 días`, color: YELLOW, path: '/parqueadero', pri: 1 });
  }
  alerts.sort((a, b) => b.pri - a.pri);

  return (
    <Box sx={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>

      {/* ── Welcome overlay (new users) ── */}
      {showWelcome && (
        <WelcomeOverlay user={user} tipoNegocio={tipoNegocio} onDismiss={handleDismissWelcome} />
      )}

      {/* ── SaaS Trial/Upgrade Manager ── */}
      <SaaSUpgradeManager user={user} />

      {/* ── Activation Checklist (trial only) ── */}
      {isTrial && (
        <ActivationChecklist user={user} data={data} totalUltimos30={totalUltimos30} />
      )}

      {/* ─────────────────────────────────────────────────────────────────
          HEADER PREMIUM
      ───────────────────────────────────────────────────────────────── */}
      <Box sx={{
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
        mb: 2, flexWrap: 'wrap', gap: 1,
        animation: `${fadeInUp} 0.45s ease both`,
      }}>
        {/* Left: avatar + greeting */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {/* Avatar with animated ring */}
          <Box sx={{ position: 'relative', flexShrink: 0 }}>
            {/* Outer rotating ring */}
            <Box sx={{
              position: 'absolute', inset: -4, borderRadius: '50%',
              background: `conic-gradient(${biz.color}, ${biz.color}00, ${biz.color})`,
              animation: `${ringRotate} 6s linear infinite`,
              opacity: 0.4,
            }} />
            <Box sx={{
              width: 54, height: 54, borderRadius: '50%',
              background: `linear-gradient(135deg, ${biz.color}, ${biz.color}88)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontWeight: 900, fontSize: 22,
              boxShadow: `0 4px 20px ${biz.color}45`,
              border: `3px solid`,
              borderColor: 'background.default',
              position: 'relative', zIndex: 1,
            }}>
              {nombreCorto[0]?.toUpperCase()}
            </Box>
            <Box sx={{
              position: 'absolute', bottom: 0, right: 0, zIndex: 2,
              width: 16, height: 16, borderRadius: '50%',
              bgcolor: GREEN, border: '2.5px solid', borderColor: 'background.default',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <FiberManualRecord sx={{ fontSize: 6, color: '#fff' }} />
            </Box>
          </Box>

          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, flexWrap: 'wrap' }}>
              <Typography sx={{ fontSize: 11.5, color: 'text.secondary', fontWeight: 500 }}>
                {greeting.emoji} {greeting.msg} —
              </Typography>
              <Chip
                label={biz.label}
                size="small"
                sx={{
                  height: 20, fontSize: 10, fontWeight: 700,
                  bgcolor: `${biz.color}15`, color: biz.color,
                  border: `1px solid ${biz.color}30`,
                  '& .MuiChip-label': { px: 0.8 },
                }}
              />
              {isTrial && diasTrial !== null && (
                <Chip
                  label={diasTrial === 0 ? 'Trial expira hoy' : `${diasTrial}d de trial`}
                  size="small"
                  sx={{
                    height: 20, fontSize: 10, fontWeight: 700,
                    bgcolor: diasTrial <= 3 ? `${RED}18` : `${YELLOW}15`,
                    color: diasTrial <= 3 ? RED : YELLOW,
                    border: `1px solid ${diasTrial <= 3 ? RED : YELLOW}30`,
                    '& .MuiChip-label': { px: 0.8 },
                  }}
                />
              )}
            </Box>
            <Typography sx={{ fontWeight: 900, fontSize: { xs: 22, sm: 26 }, lineHeight: 1.1, color: 'text.primary', letterSpacing: -0.5 }}>
              {nombreCorto}
            </Typography>
            <Typography sx={{ fontSize: 11, color: 'text.secondary', mt: 0.15, display: 'flex', alignItems: 'center', gap: 0.4, flexWrap: 'wrap' }}>
              <Business sx={{ fontSize: 11 }} />
              {user?.empresa?.nombre || 'Mi Empresa'}
              {lastUpdated && (
                <>
                  <span style={{ opacity: 0.4 }}>·</span>
                  <Schedule sx={{ fontSize: 10 }} />
                  Act. {lastUpdated.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                </>
              )}
            </Typography>
          </Box>
        </Box>

        {/* Right: clock + help + refresh */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <RealtimeClock />
          <HelpGuideTopBar
            moduleName="Dashboard"
            moduleColor={ACCENT}
            steps={[
              { title: 'Revisa los KPIs del día', description: 'Las tarjetas superiores muestran ventas, cartera, stock bajo y caja actualizados en tiempo real.' },
              { title: 'Accesos rápidos', description: 'Los botones te llevan al módulo más relevante según tu tipo de negocio con un solo clic.' },
              { title: 'Insights del negocio', description: 'Ksmart360 analiza tus datos y te da recomendaciones inteligentes personalizadas.' },
              { title: 'Consulta los reportes', description: 'El módulo Reportes te da un análisis de ventas, rentabilidad, IVA y más.' },
            ]}
            faqItems={[
              { q: '¿Qué son los KPIs?', a: 'Indicadores clave de rendimiento. Muestran un resumen rápido de la actividad: ventas, cartera, stock bajo, caja.' },
              { q: '¿Cómo actualizo los datos?', a: 'Clic en el ícono ↻ o recarga la página. Los datos también se actualizan al ingresar.' },
              { q: '¿Qué módulos están disponibles?', a: 'Depende de los módulos asignados a tu rol. El administrador puede configurar qué ve cada usuario.' },
            ]}
          />
          <Tooltip title="Actualizar datos">
            <IconButton
              onClick={() => fetchAll()}
              size="small"
              sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, transition: 'all 0.2s', '&:hover': { borderColor: ACCENT, color: ACCENT, bgcolor: `${ACCENT}08` } }}
            >
              <Refresh sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* ── Daily Welcome Banner (returning users) ── */}
      {!showWelcome && (
        <DailyWelcomeBanner user={user} tipoNegocio={tipoNegocio} />
      )}

      {/* ── Alerts ── */}
      {alerts.length > 0 && (
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2, animation: `${fadeInUp} 0.45s 0.05s ease both` }}>
          {alerts.map((a, i) => (
            <Chip
              key={i}
              label={a.label}
              size="small"
              onClick={() => navigate(a.path)}
              icon={<Warning sx={{ fontSize: '14px !important' }} />}
              sx={{
                cursor: 'pointer', bgcolor: `${a.color}12`, color: a.color,
                fontWeight: 700, fontSize: 11, border: `1px solid ${a.color}28`,
                '&:hover': { bgcolor: `${a.color}20`, transform: 'translateY(-1px)' },
                transition: 'all 0.2s ease',
              }}
            />
          ))}
        </Box>
      )}

      {/* ─────────────────────────────────────────────────────────────────
          KPI GRID
      ───────────────────────────────────────────────────────────────── */}
      <Grid container spacing={1.5} sx={{ mb: 2.5 }}>
        {esPrestamista ? (
          <>
            <Grid item xs={6} sm={3}><KpiCard title="Capital en Calle" value={data?.capital_en_calle || 0} icon={<AccountBalance />} color={BLUE} sub="Total pendiente" onClick={() => navigate('/prestamos')} loading={loadingMain} delay={0} /></Grid>
            <Grid item xs={6} sm={3}><KpiCard title="Recaudo Hoy" value={recaudoHoyVal} icon={<Savings />} color={GREEN} sub="Dinero ingresado" onClick={() => navigate('/ruta-cobro')} loading={loadingMain} delay={0.06} /></Grid>
            <Grid item xs={6} sm={3}><KpiCard title="Intereses Hoy" value={data?.intereses_cobrados_hoy || 0} icon={<TrendingUp />} color={PURPLE} sub="Intereses cobrados" loading={loadingMain} delay={0.12} /></Grid>
            <Grid item xs={6} sm={3}><KpiCard title="Mora Crítica" value={data?.cuotas_mora || 0} format="integer" icon={<Gavel />} color={RED} sub="Cuotas vencidas" onClick={() => navigate('/ruta-cobro')} loading={loadingMain} delay={0.18} /></Grid>
          </>
        ) : esParqueadero ? (
          <>
            <Grid item xs={6} sm={3}><KpiCard title="Vehículos Dentro" value={data?.ocupacion_actual ?? (data?.accesos_dentro?.length || 0)} format="integer" icon={<LocalParking />} color={BLUE} sub="Por horas" onClick={() => navigate('/parqueadero')} loading={loadingMain} delay={0} /></Grid>
            <Grid item xs={6} sm={3}><KpiCard title="Ingresos Hoy" value={data?.ingresos_parq_hoy ?? data?.ingresos_hoy ?? 0} icon={<AttachMoney />} color={GREEN} sub="Mensualidades y horas" onClick={() => navigate('/parqueadero')} loading={loadingMain} delay={0.06} /></Grid>
            <Grid item xs={6} sm={3}><KpiCard title="Suscripciones" value={data?.suscripciones_vigentes ?? (data?.vencidas || 0)} format="integer" icon={<TwoWheeler />} color={PURPLE} sub="Vigentes hoy" onClick={() => navigate('/parqueadero')} loading={loadingMain} delay={0.12} /></Grid>
            <Grid item xs={6} sm={3}><KpiCard title="Caja hoy" value={caja?.total_dia || 0} icon={<PointOfSale />} color={YELLOW} loading={loadingCaja} delay={0.18} /></Grid>
          </>
        ) : esLavadero ? (
          <>
            <Grid item xs={6} sm={3}><KpiCard title="Ingresos Lavadero" value={data?.ingresos_lavadero_hoy || 0} icon={<MonetizationOn />} color={ACCENT} sub="Órdenes cobradas hoy" onClick={() => navigate('/lavadero/ventas')} loading={loadingMain} delay={0} /></Grid>
            <Grid item xs={6} sm={3}><KpiCard title="Órdenes Hoy" value={data?.ordenes_lavadero_hoy || 0} format="integer" icon={<TwoWheeler />} color={BLUE} sub="Vehículos lavados hoy" onClick={() => navigate('/lavadero/ventas')} loading={loadingMain} delay={0.06} /></Grid>
            <Grid item xs={6} sm={3}><KpiCard title="Por cobrar" value={data?.cuentas_por_cobrar || 0} icon={<AccountBalanceWallet />} color={YELLOW} sub="Cartera pendiente" loading={loadingMain} delay={0.12} /></Grid>
            <Grid item xs={6} sm={3}><KpiCard title="Caja hoy" value={caja?.total_dia || 0} icon={<PointOfSale />} color={GREEN} loading={loadingCaja} delay={0.18} /></Grid>
          </>
        ) : (
          <>
            <Grid item xs={6} sm={3}><KpiCard title="Ventas hoy" value={ventasHoyVal} icon={<MonetizationOn />} color={ACCENT} onClick={() => navigate('/ventas')} loading={loadingMain} delta={ventasDelta} delay={0} /></Grid>
            <Grid item xs={6} sm={3}><KpiCard title="Por cobrar" value={data?.cuentas_por_cobrar || 0} icon={<AccountBalanceWallet />} color={BLUE} onClick={() => navigate('/clientes')} loading={loadingMain} delay={0.06} /></Grid>
            <Grid item xs={6} sm={3}><KpiCard title="Bajo stock" value={data?.productos_bajo_stock || 0} format="integer" icon={<Warning />} color={RED} onClick={() => navigate('/inventario')} loading={loadingMain} delay={0.12} /></Grid>
            <Grid item xs={6} sm={3}><KpiCard title="Caja hoy" value={caja?.total_dia || 0} icon={<PointOfSale />} color={GREEN} loading={loadingCaja} delay={0.18} /></Grid>
          </>
        )}
      </Grid>

      {/* Cacao Widget (superadmin) */}
      {user?.empresa_id === 1 && <CacaoPriceWidget />}

      {/* ─────────────────────────────────────────────────────────────────
          INSIGHTS PANEL (non-zero state only)
      ───────────────────────────────────────────────────────────────── */}
      {!isZeroState && !loadingMain && (
        <InsightsPanel
          data={data}
          tipoNegocio={tipoNegocio}
          ventasHoyVal={ventasHoyVal}
          ventasAyerVal={ventasAyerVal}
          totalUltimos30={totalUltimos30}
          dark={dark}
        />
      )}

      {/* ─────────────────────────────────────────────────────────────────
          ZERO STATE (first-time welcome)
      ───────────────────────────────────────────────────────────────── */}
      {isZeroState ? (
        <Paper sx={{
          p: { xs: 3, md: 5 }, borderRadius: 4, textAlign: 'center', mb: 3,
          border: '1px solid', borderColor: 'divider', bgcolor: 'background.paper',
          backgroundImage: 'none',
          boxShadow: dark ? '0 10px 40px rgba(0,0,0,0.3)' : '0 10px 40px rgba(0,0,0,0.04)',
          animation: `${fadeInUp} 0.6s 0.2s ease both`,
        }}>
          <Box sx={{
            width: 84, height: 84, borderRadius: '24px',
            background: `linear-gradient(135deg, ${biz.color}20, ${biz.color}08)`,
            color: biz.color,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            mx: 'auto', mb: 3,
            animation: `${floatAnim} 3s ease-in-out infinite`,
            boxShadow: `0 8px 24px ${biz.color}22`,
            border: `1px solid ${biz.color}22`,
          }}>
            <RocketLaunch sx={{ fontSize: 42 }} />
          </Box>

          <Typography variant="h4" sx={{ fontWeight: 900, mb: 1, letterSpacing: -0.5, color: 'text.primary', fontSize: { xs: 22, sm: 28 } }}>
            ¡Bienvenido, {user?.empresa?.nombre || nombreCorto}!
          </Typography>
          <Typography sx={{ color: 'text.secondary', maxWidth: 560, mx: 'auto', mb: 5, fontSize: 15.5, lineHeight: 1.65 }}>
            {esPrestamista
              ? 'Tu plataforma de cobranzas está lista. Sigue esta guía para empezar a gestionar tus rutas y capital.'
              : esParqueadero
                ? 'Tu panel de control está activo. Configura tarifas y empieza a registrar vehículos ahora mismo.'
                : 'Tu espacio de trabajo inteligente está listo. Realiza tu primera operación en 3 pasos.'}
          </Typography>

          <Grid container spacing={2.5} justifyContent="center" sx={{ maxWidth: 900, mx: 'auto' }}>
            {[
              {
                title:  esPrestamista ? 'Registra Clientes'    : (esParqueadero ? 'Configura Tarifas'     : 'Agrega Productos'),
                desc:   esPrestamista ? 'Crea tu base de deudores y rutas.'  : (esParqueadero ? 'Define precios por hora y mes.' : 'Sube tu inventario inicial.'),
                path:   esPrestamista ? '/clientes'             : (esParqueadero ? '/parqueadero/config'   : '/productos'),
                icon:   esPrestamista ? <PeopleOutline />        : (esParqueadero ? <Gavel />               : <Storefront />),
                color:  PURPLE, num: '01',
              },
              {
                title:  esPrestamista ? 'Simula un Préstamo'   : (esParqueadero ? 'Registra Vehículos'    : 'Crea Clientes'),
                desc:   esPrestamista ? 'Calcula cuotas e intereses fácilmente.' : (esParqueadero ? 'Añade motos y autos frecuentes.' : 'Organiza tu cartera de clientes.'),
                path:   esPrestamista ? '/prestamos'            : (esParqueadero ? '/parqueadero/vehiculos' : '/clientes'),
                icon:   esPrestamista ? <AttachMoney />          : (esParqueadero ? <TwoWheeler />          : <PeopleOutline />),
                color:  BLUE, num: '02',
              },
              {
                title:  esPrestamista ? 'Inicia tu Ruta'       : (esParqueadero ? 'Control de Accesos'    : 'Primera Venta'),
                desc:   esPrestamista ? 'Realiza los cobros del día hoy mismo.' : (esParqueadero ? 'Registra entradas y salidas.' : 'Usa el POS para facturar rápido.'),
                path:   esPrestamista ? '/ruta-cobro'           : (esParqueadero ? '/parqueadero/buscar'   : '/ventas'),
                icon:   esPrestamista ? <DirectionsRun />        : (esParqueadero ? <LocalParking />        : <AddShoppingCart />),
                color:  GREEN, num: '03',
              },
            ].map((s, i) => (
              <Grid item xs={12} sm={4} key={i}>
                <CardActionArea onClick={() => navigate(s.path)} sx={{ height: '100%', borderRadius: 3.5 }}>
                  <Paper sx={{
                    p: 3.5, height: '100%', borderRadius: 3.5,
                    border: '1px solid', borderColor: 'divider', bgcolor: 'background.paper',
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    position: 'relative', overflow: 'hidden',
                    transition: 'all 0.25s cubic-bezier(0.4,0,0.2,1)',
                    '&:hover': {
                      borderColor: s.color, bgcolor: `${s.color}05`,
                      transform: 'translateY(-6px)', boxShadow: `0 16px 40px ${s.color}18`,
                    },
                  }}>
                    <Typography sx={{ position: 'absolute', top: 10, right: 14, fontSize: 30, fontWeight: 900, color: `${s.color}12`, lineHeight: 1 }}>
                      {s.num}
                    </Typography>
                    <Box sx={{ width: 58, height: 58, borderRadius: '18px', bgcolor: `${s.color}12`, color: s.color, mb: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${s.color}20` }}>
                      {React.cloneElement(s.icon, { sx: { fontSize: 30 } })}
                    </Box>
                    <Typography sx={{ fontWeight: 800, fontSize: 15.5, mb: 1, color: 'text.primary', textAlign: 'center' }}>{s.title}</Typography>
                    <Typography sx={{ fontSize: 12.5, color: 'text.secondary', textAlign: 'center', lineHeight: 1.55 }}>{s.desc}</Typography>
                    <Box sx={{ mt: 'auto', pt: 2, display: 'flex', alignItems: 'center', gap: 0.4 }}>
                      <Typography sx={{ fontSize: 11.5, color: s.color, fontWeight: 700 }}>Ir ahora</Typography>
                      <ArrowForward sx={{ fontSize: 13, color: s.color }} />
                    </Box>
                  </Paper>
                </CardActionArea>
              </Grid>
            ))}
          </Grid>

          <Box sx={{ mt: 5, pt: 4, borderTop: '1px solid', borderColor: 'divider' }}>
            <Typography variant="caption" color="text.secondary">
              ¿Necesitas ayuda? Contáctanos por WhatsApp — nuestro equipo de soporte está listo para ti.
            </Typography>
          </Box>
        </Paper>

      ) : (
        /* ─────────────────────────────────────────────────────────────────
            ACTIVE STATE — Charts & Cash
        ───────────────────────────────────────────────────────────────── */
        <Grid container spacing={1.5} sx={{ mb: 2.5, animation: `${fadeInUp} 0.5s 0.2s ease both` }}>
          {/* Sparkline panel */}
          <Grid item xs={12} md={8}>
            <Paper sx={{
              p: 2.5, borderRadius: 3, bgcolor: 'background.paper',
              border: '1px solid', borderColor: 'divider', height: '100%', boxSizing: 'border-box',
              boxShadow: dark ? '0 2px 12px rgba(0,0,0,0.3)' : '0 2px 12px rgba(0,0,0,0.06)',
              position: 'relative', overflow: 'hidden',
            }}>
              {/* Ksmart360 watermark */}
              <Box sx={{
                position: 'absolute', bottom: 12, right: 14,
                display: 'flex', alignItems: 'center', gap: 0.5, opacity: 0.06,
                pointerEvents: 'none',
              }}>
                <img src="/logos/svg/ksmart-icon-rounded.svg" alt="" style={{ width: 14, height: 14, borderRadius: 3 }} />
                <Typography sx={{ fontSize: 9, fontWeight: 900, letterSpacing: 0.5 }}>KSMART360</Typography>
              </Box>

              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5, flexWrap: 'wrap', gap: 1 }}>
                <Box>
                  <Typography sx={{ fontWeight: 800, fontSize: 14.5, color: 'text.primary' }}>
                    {esPrestamista ? 'Historial de Recaudos' : 'Evolución de ventas'}
                  </Typography>
                  <Typography sx={{ fontSize: 11.5, color: 'text.secondary' }}>
                    Últimos {sparkDays} días · Total: <strong>{formatCurrency(totalUltimos30)}</strong>
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                  {mejorDia.total > 0 && (
                    <Chip
                      icon={<EmojiEvents sx={{ fontSize: '13px !important' }} />}
                      label={`Mejor: ${formatCurrency(mejorDia.total)}`}
                      size="small"
                      sx={{ bgcolor: `${ACCENT}12`, color: ACCENT, fontWeight: 700, fontSize: 10 }}
                    />
                  )}
                  <Box sx={{ display: 'flex', border: '1px solid', borderColor: 'divider', borderRadius: 1.5, overflow: 'hidden' }}>
                    {[7, 30].map(d => (
                      <Box key={d} onClick={() => setSparkDays(d)} sx={{
                        px: 1.4, py: 0.5, fontSize: 10.5, fontWeight: 700, cursor: 'pointer',
                        bgcolor: sparkDays === d ? `${ACCENT}18` : 'transparent',
                        color: sparkDays === d ? ACCENT : 'text.secondary',
                        transition: 'all 0.2s',
                        '&:hover': { bgcolor: sparkDays === d ? `${ACCENT}18` : 'action.hover' },
                      }}>
                        {d}d
                      </Box>
                    ))}
                  </Box>
                </Box>
              </Box>
              {ventas30.length > 1 ? (
                <Sparkline data={ventas30.slice(-sparkDays)} color={esPrestamista ? GREEN : ACCENT} height={isMobile ? 65 : 96} />
              ) : (
                <Box sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
                  <TrendingUp sx={{ fontSize: 38, opacity: 0.18, mb: 1 }} />
                  <Typography fontSize={12} color="text.disabled">Faltan datos para graficar</Typography>
                </Box>
              )}
            </Paper>
          </Grid>

          {/* Caja panel */}
          <Grid item xs={12} md={4}>
            <Paper sx={{
              p: 2.5, borderRadius: 3, bgcolor: 'background.paper',
              border: '1px solid', borderColor: 'divider', height: '100%', boxSizing: 'border-box',
              boxShadow: dark ? '0 2px 12px rgba(0,0,0,0.3)' : '0 2px 12px rgba(0,0,0,0.06)',
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <Box sx={{ width: 34, height: 34, borderRadius: 2, bgcolor: `${YELLOW}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <PointOfSale sx={{ color: YELLOW, fontSize: 16 }} />
                </Box>
                <Box>
                  <Typography sx={{ fontWeight: 800, fontSize: 13.5, color: 'text.primary', lineHeight: 1 }}>Caja actual</Typography>
                  <Typography sx={{ fontSize: 10.5, color: 'text.secondary' }}>Corte del día</Typography>
                </Box>
              </Box>
              {caja ? (
                <>
                  <MetodoBarra icon={<AttachMoney sx={{ fontSize: 13 }} />} label="Efectivo" value={caja.efectivo || 0} total={caja.total_dia || 0} color={GREEN} />
                  <MetodoBarra icon={<AccountBalance sx={{ fontSize: 13 }} />} label="Transferencia" value={caja.transferencia || 0} total={caja.total_dia || 0} color={BLUE} />
                  <Divider sx={{ my: 1.5 }} />
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: 'text.primary' }}>Saldo Neto</Typography>
                    <Box sx={{ textAlign: 'right' }}>
                      <Typography sx={{ fontSize: 17, fontWeight: 900, color: YELLOW, letterSpacing: -0.5 }}>
                        {formatCurrency((caja.total_dia || 0) - (caja.total_gastos || 0))}
                      </Typography>
                      {(caja.total_gastos || 0) > 0 && (
                        <Typography sx={{ fontSize: 10, color: RED }}>
                          Gastos: -{formatCurrency(caja.total_gastos)}
                        </Typography>
                      )}
                    </Box>
                  </Box>
                </>
              ) : (
                <Skeleton height={120} sx={{ borderRadius: 2 }} />
              )}
            </Paper>
          </Grid>
        </Grid>
      )}

      {/* ── Tip Banner (active users only) ── */}
      {!isZeroState && <TipBanner tipoNegocio={tipoNegocio} />}

      {/* ─────────────────────────────────────────────────────────────────
          ACCESOS RÁPIDOS (Grid layout)
      ───────────────────────────────────────────────────────────────── */}
      <QuickAccessGrid accesosRapidos={accesosRapidos} />

    </Box>
  );
};

export default Dashboard;
