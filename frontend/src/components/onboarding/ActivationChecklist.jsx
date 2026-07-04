import React, { useState, useMemo } from 'react';
import {
  Box, Typography, Paper, LinearProgress, Collapse,
  IconButton, Tooltip, Chip,
} from '@mui/material';
import {
  CheckCircle, RadioButtonUnchecked, ExpandMore, ExpandLess,
  ArrowForward, RocketLaunch, EmojiEvents,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { keyframes } from '@mui/system';

const ACCENT = '#0891B2';
const GREEN  = '#10B981';
const YELLOW = '#F59E0B';

const confettiBurst = keyframes`
  0%   { opacity: 0; transform: scale(0.5) rotate(0deg); }
  50%  { opacity: 1; transform: scale(1.15) rotate(6deg); }
  100% { opacity: 1; transform: scale(1) rotate(0deg); }
`;

const pulseGreen = keyframes`
  0%,100% { box-shadow: 0 0 0 0 ${GREEN}40; }
  50%     { box-shadow: 0 0 0 8px ${GREEN}00; }
`;

const STORAGE_KEY = 'ksmart_checklist_dismissed';

function getDismissed() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
  catch { return []; }
}
function dismiss(id) {
  const cur = getDismissed();
  if (!cur.includes(id)) localStorage.setItem(STORAGE_KEY, JSON.stringify([...cur, id]));
}

// Per-step metadata: color, estimated time
const STEP_META = {
  account_created: { color: GREEN,  time: null,    emoji: '✅' },
  add_product:     { color: ACCENT, time: '~3 min', emoji: '📦' },
  first_sale:      { color: YELLOW, time: '~2 min', emoji: '💰' },
  setup_catalogo:  { color: '#8B5CF6', time: '~10 min', emoji: '🛍️' },
  activate_plan:   { color: '#EF4444', time: null,  emoji: '⭐' },
};

const CheckRow = ({ step, onDismiss }) => {
  const navigate = useNavigate();
  const meta = STEP_META[step.id] || { color: ACCENT, time: null, emoji: '•' };

  return (
    <Box
      sx={{
        display: 'flex', alignItems: 'center', gap: 1.5,
        py: 0.85, px: 1.25, borderRadius: 2,
        cursor: step.path && !step.done ? 'pointer' : 'default',
        transition: 'background 0.15s',
        '&:hover': step.path && !step.done ? { bgcolor: 'action.hover' } : {},
      }}
      onClick={() => step.path && !step.done && navigate(step.path)}
    >
      {/* Step icon */}
      <Box sx={{ color: step.done ? GREEN : 'text.disabled', flexShrink: 0, display: 'flex' }}>
        {step.done
          ? <CheckCircle sx={{ fontSize: 19 }} />
          : <RadioButtonUnchecked sx={{ fontSize: 19 }} />}
      </Box>

      {/* Emoji + text */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
          <Typography sx={{ fontSize: 13 }}>{meta.emoji}</Typography>
          <Typography sx={{
            fontSize: 12.5, fontWeight: step.done ? 500 : 700,
            color: step.done ? 'text.disabled' : 'text.primary',
            textDecoration: step.done ? 'line-through' : 'none',
          }}>
            {step.label}
          </Typography>
        </Box>
        {!step.done && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, mt: 0.15 }}>
            <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{step.desc}</Typography>
            {meta.time && (
              <Typography sx={{ fontSize: 10, color: meta.color, fontWeight: 600 }}>{meta.time}</Typography>
            )}
          </Box>
        )}
      </Box>

      {/* CTAs */}
      {!step.done && step.cta && (
        <Chip label="Activar" size="small" sx={{ bgcolor: `${meta.color}18`, color: meta.color, fontWeight: 700, fontSize: 10 }} />
      )}
      {!step.done && step.path && !step.cta && (
        <ArrowForward sx={{ fontSize: 14, color: 'text.disabled', flexShrink: 0 }} />
      )}
      {!step.done && step.optional && !step.path && (
        <Tooltip title="Marcar como hecho">
          <IconButton size="small" onClick={e => { e.stopPropagation(); onDismiss(step.id); }} sx={{ opacity: 0.5 }}>
            <CheckCircle sx={{ fontSize: 14 }} />
          </IconButton>
        </Tooltip>
      )}
    </Box>
  );
};

export default function ActivationChecklist({ user, data, totalUltimos30 }) {
  const [open, setOpen]         = useState(true);
  const [dismissed, setDismissed] = useState(getDismissed);

  const esPrestamista = useMemo(() => {
    const mods = user?.empresa?.modulos_habilitados;
    return mods?.includes('/prestamos') && !mods?.includes('/ventas');
  }, [user]);

  const handleDismiss = (id) => {
    dismiss(id);
    setDismissed(getDismissed());
  };

  const steps = useMemo(() => [
    {
      id: 'account_created',
      label: 'Crea tu cuenta',
      desc: 'Ya estás dentro del sistema.',
      done: true,
      path: null,
    },
    {
      id: 'add_product',
      label: esPrestamista ? 'Registra tu primer cliente' : 'Agrega tu primer producto',
      desc: esPrestamista ? 'Crea tu base de deudores.' : 'Sube tu catálogo de productos.',
      done: dismissed.includes('add_product')
        || (esPrestamista ? (data?.capital_en_calle || 0) > 0 : (data?.total_productos || 0) > 0),
      path: esPrestamista ? '/clientes' : '/productos',
    },
    {
      id: 'first_sale',
      label: esPrestamista ? 'Simula tu primer préstamo' : 'Registra tu primera venta',
      desc: esPrestamista ? 'Crea un préstamo de prueba.' : 'Usa el POS para tu primera transacción.',
      done: dismissed.includes('first_sale')
        || (esPrestamista ? (data?.capital_en_calle || 0) > 0 : (totalUltimos30 || 0) > 0),
      path: esPrestamista ? '/prestamos' : '/ventas',
    },
    {
      id: 'setup_catalogo',
      label: 'Configura tu catálogo virtual',
      desc: 'Publica tus productos y compárte la tienda con tus clientes.',
      done: dismissed.includes('setup_catalogo') || !!user?.empresa?.slug_catalogo,
      path: '/admin/catalogo',
      optional: true,
    },
    {
      id: 'activate_plan',
      label: 'Activa tu suscripción',
      desc: 'Desbloquea todas las funciones sin límite.',
      done: user?.empresa?.plan_type !== 'trial',
      path: '/mi-suscripcion',
      cta: true,
    },
  ], [esPrestamista, data, totalUltimos30, dismissed, user]);

  const doneCount = steps.filter(s => s.done).length;
  const pct       = Math.round((doneCount / steps.length) * 100);
  const allDone   = pct === 100;

  return (
    <Paper sx={{
      mb: 2.5, borderRadius: 3, overflow: 'hidden',
      border: '1px solid',
      borderColor: allDone ? `${GREEN}40` : `${ACCENT}28`,
      bgcolor: 'background.paper',
      boxShadow: allDone ? `0 0 0 0 transparent` : 'none',
      animation: allDone ? `${pulseGreen} 2s ease 3` : 'none',
      transition: 'border-color 0.5s ease',
    }}>
      {/* Header */}
      <Box
        onClick={() => setOpen(o => !o)}
        sx={{
          display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1.25,
          cursor: 'pointer',
          bgcolor: allDone ? `${GREEN}08` : `${ACCENT}08`,
          borderBottom: open ? '1px solid' : 'none',
          borderColor: allDone ? `${GREEN}18` : `${ACCENT}18`,
          transition: 'background 0.3s ease',
        }}
      >
        {allDone
          ? <EmojiEvents sx={{ color: GREEN, fontSize: 19, animation: `${confettiBurst} 0.6s ease both` }} />
          : <RocketLaunch sx={{ color: ACCENT, fontSize: 18 }} />}

        <Box sx={{ flex: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: allDone ? GREEN : 'text.primary' }}>
              {allDone ? '¡Perfil completo!' : 'Configura tu cuenta'}
            </Typography>
            <Chip
              label={`${doneCount}/${steps.length}`}
              size="small"
              sx={{
                height: 18, fontSize: 10, fontWeight: 700,
                bgcolor: allDone ? `${GREEN}18` : `${ACCENT}18`,
                color: allDone ? GREEN : ACCENT,
              }}
            />
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
            <LinearProgress
              variant="determinate"
              value={pct}
              sx={{
                flex: 1, height: 5, borderRadius: 2.5,
                bgcolor: allDone ? `${GREEN}15` : `${ACCENT}15`,
                '& .MuiLinearProgress-bar': {
                  bgcolor: allDone ? GREEN : ACCENT,
                  borderRadius: 2.5,
                  transition: 'width 0.7s cubic-bezier(0.4,0,0.2,1)',
                },
              }}
            />
            <Typography sx={{ fontSize: 10, color: allDone ? GREEN : 'text.secondary', flexShrink: 0, fontWeight: 600 }}>
              {pct}%
            </Typography>
          </Box>
        </Box>
        <IconButton size="small" sx={{ color: 'text.disabled' }}>
          {open ? <ExpandLess sx={{ fontSize: 18 }} /> : <ExpandMore sx={{ fontSize: 18 }} />}
        </IconButton>
      </Box>

      {/* Steps */}
      <Collapse in={open}>
        <Box sx={{ px: 1, py: 0.75 }}>
          {steps.map(step => (
            <CheckRow key={step.id} step={step} onDismiss={handleDismiss} />
          ))}
          {allDone && (
            <Box sx={{ textAlign: 'center', py: 1.5, mt: 0.5, borderTop: '1px solid', borderColor: 'divider' }}>
              <Typography sx={{ fontSize: 12, color: GREEN, fontWeight: 700 }}>
                🎉 ¡Excelente! Tu cuenta está completamente configurada.
              </Typography>
            </Box>
          )}
        </Box>
      </Collapse>
    </Paper>
  );
}
