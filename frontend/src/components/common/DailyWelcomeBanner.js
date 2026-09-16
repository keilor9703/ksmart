import React, { useState, useEffect, useCallback } from 'react';
import { Box, Typography, IconButton } from '@mui/material';
import { Close, LocalFireDepartment, Star, TrendingUp } from '@mui/icons-material';
import { keyframes } from '@mui/system';
import { useTheme } from '@mui/material/styles';

// ─── Animaciones ─────────────────────────────────────────────────────────────
const slideDown = keyframes`
  from { opacity: 0; transform: translateY(-16px); max-height: 0; }
  to   { opacity: 1; transform: translateY(0);      max-height: 100px; }
`;
const slideUp = keyframes`
  from { opacity: 1; transform: translateY(0);      max-height: 100px; }
  to   { opacity: 0; transform: translateY(-12px);  max-height: 0; }
`;

// ─── Lógica de racha y sesión diaria ─────────────────────────────────────────
const STREAK_KEY     = 'ksmart_login_streak';
const LAST_DATE_KEY  = 'ksmart_last_login_date';
const SHOWN_TODAY_KEY = 'ksmart_welcome_shown_today';

function getTodayStr() {
  return new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD'
}

function computeAndUpdateStreak() {
  const today    = getTodayStr();
  const lastDate = localStorage.getItem(LAST_DATE_KEY);
  const streak   = parseInt(localStorage.getItem(STREAK_KEY) || '0', 10);

  if (lastDate === today) {
    // Ya fue registrada hoy → solo devolver la racha
    return streak;
  }

  // Calcular nueva racha
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  const newStreak = lastDate === yesterdayStr ? streak + 1 : 1;
  localStorage.setItem(STREAK_KEY, String(newStreak));
  localStorage.setItem(LAST_DATE_KEY, today);
  return newStreak;
}

// ─── Mensajes inspiradores según tipo de negocio y hora ─────────────────────
function getInsight(tipoNegocio, nombre) {
  const h = new Date().getHours();
  const maps = {
    erp: [
      { from: 5,  to: 11, msg: `¡Buenos días, ${nombre}! Las ventas de la mañana construyen el día. Empieza registrando.` },
      { from: 12, to: 17, msg: `La tarde es ideal para revisar tu inventario y anticipar faltantes, ${nombre}.` },
      { from: 18, to: 23, msg: `Cierra el día fuerte, ${nombre}. Revisa el corte de caja y los pendientes.` },
    ],
    prestamos: [
      { from: 5,  to: 11, msg: `Buenos días, ${nombre}. Organiza tu ruta de cobro antes de salir.` },
      { from: 12, to: 17, msg: `${nombre}, ¿revisaste las cuotas vencidas de hoy? Actúa antes de que sumen mora.` },
      { from: 18, to: 23, msg: `Consolida el recaudo del día, ${nombre}. Cada peso cuenta en tu capital.` },
    ],
    parqueadero: [
      { from: 5,  to: 11, msg: `¡El día empieza, ${nombre}! Verifica el espacio disponible y las mensualidades vigentes.` },
      { from: 12, to: 17, msg: `Hora pico activa. Asegúrate de que el registro de entradas esté al día, ${nombre}.` },
      { from: 18, to: 23, msg: `${nombre}, revisa las salidas del día y el total de ingresos antes de cerrar.` },
    ],
    lavadero: [
      { from: 5,  to: 11, msg: `¡A lavarse! ${nombre}, asigna operarios y abre el turno cuando estés listo.` },
      { from: 12, to: 17, msg: `La jornada avanza, ${nombre}. ¿Cuántos vehículos llevas hoy?` },
      { from: 18, to: 23, msg: `Cierra el turno, ${nombre}. Revisa la producción de cada operario.` },
    ],
    restaurante: [
      { from: 5,  to: 11, msg: `¡Buenos días, ${nombre}! Prepara las mesas y confirma las reservas del almuerzo.` },
      { from: 12, to: 17, msg: `Hora pico en el comedor, ${nombre}. La cocina en tiempo real te mantiene al mando.` },
      { from: 18, to: 23, msg: `${nombre}, ¿está lista la comanda del cierre? Revisa el cuadre de mesas.` },
    ],
  };

  const msgs = maps[tipoNegocio] || maps.erp;
  const match = msgs.find(m => h >= m.from && h < m.to) || msgs[msgs.length - 1];
  return match.msg;
}

// ─── Paletas por tipo ────────────────────────────────────────────────────────
const PALETTE = {
  erp:         { from: '#0891B2', to: '#0E7490' },
  prestamos:   { from: '#10B981', to: '#059669' },
  parqueadero: { from: '#3B82F6', to: '#2563EB' },
  lavadero:    { from: '#8B5CF6', to: '#7C3AED' },
  restaurante: { from: '#EC4899', to: '#DB2777' },
};

// ─── Componente principal ─────────────────────────────────────────────────────
export default function DailyWelcomeBanner({ user, tipoNegocio }) {
  const theme    = useTheme();
  const dark     = theme.palette.mode === 'dark';
  const [visible, setVisible]   = useState(false);
  const [leaving, setLeaving]   = useState(false);
  const [streak,  setStreak]    = useState(1);

  const nombre     = user?.nombre_completo?.split(' ')[0] || user?.username || 'usuario';
  const pal        = PALETTE[tipoNegocio] || PALETTE.erp;
  const insight    = getInsight(tipoNegocio, nombre);

  const dismiss = useCallback(() => {
    setLeaving(true);
    setTimeout(() => setVisible(false), 420);
  }, []);

  useEffect(() => {
    const today      = getTodayStr();
    const shownToday = localStorage.getItem(SHOWN_TODAY_KEY);

    // Solo mostrar una vez por día y solo para usuarios ya existentes (no nuevos)
    const isNewUser = localStorage.getItem('ksmart_show_welcome') === 'true';
    if (isNewUser || shownToday === today) return;

    const s = computeAndUpdateStreak();
    setStreak(s);
    localStorage.setItem(SHOWN_TODAY_KEY, today);

    // Mostrar con un pequeño delay para que el dashboard termine de renderizar
    const t1 = setTimeout(() => setVisible(true), 800);
    // Auto-dismiss después de 7s
    const t2 = setTimeout(() => dismiss(), 8000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [dismiss]);

  if (!visible) return null;

  return (
    <Box
      sx={{
        mb: 2,
        borderRadius: 2.5,
        overflow: 'hidden',
        animation: `${leaving ? slideUp : slideDown} 0.42s cubic-bezier(0.34,1.56,0.64,1) both`,
        background: dark
          ? `linear-gradient(135deg, ${pal.from}18, ${pal.to}10)`
          : `linear-gradient(135deg, ${pal.from}12, ${pal.to}08)`,
        border: `1px solid ${pal.from}30`,
        boxShadow: `0 4px 20px ${pal.from}15`,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2.5, py: 1.4 }}>
        {/* Streak fire icon */}
        <Box
          sx={{
            width: 34, height: 34, borderRadius: '50%',
            background: `linear-gradient(135deg, ${pal.from}25, ${pal.to}15)`,
            border: `1px solid ${pal.from}35`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {streak >= 7 ? (
            <LocalFireDepartment sx={{ fontSize: 17, color: pal.from }} />
          ) : streak >= 3 ? (
            <Star sx={{ fontSize: 16, color: pal.from }} />
          ) : (
            <TrendingUp sx={{ fontSize: 16, color: pal.from }} />
          )}
        </Box>

        {/* Texto */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {streak >= 2 && (
            <Typography
              sx={{
                fontSize: 10, fontWeight: 800,
                color: pal.from,
                textTransform: 'uppercase', letterSpacing: 0.8,
                lineHeight: 1,
              }}
            >
              {streak >= 30 ? '🔥 ' : ''}{streak} {streak === 1 ? 'día' : 'días'} consecutivos
            </Typography>
          )}
          <Typography
            sx={{
              fontSize: 12.5, color: dark ? 'rgba(241,245,249,0.85)' : 'rgba(15,23,42,0.85)',
              lineHeight: 1.45, fontWeight: 500,
              mt: streak >= 2 ? 0.3 : 0,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}
          >
            {insight}
          </Typography>
        </Box>

        {/* Cerrar */}
        <IconButton
          size="small"
          onClick={dismiss}
          sx={{
            flexShrink: 0, color: 'text.disabled',
            '&:hover': { color: 'text.secondary', bgcolor: `${pal.from}15` },
            borderRadius: 1.5,
          }}
        >
          <Close sx={{ fontSize: 15 }} />
        </IconButton>
      </Box>
    </Box>
  );
}
