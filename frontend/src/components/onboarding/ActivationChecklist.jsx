import React, { useState, useMemo } from 'react';
import {
  Box, Typography, Paper, LinearProgress, Collapse,
  IconButton, Tooltip, Chip,
} from '@mui/material';
import {
  CheckCircle, RadioButtonUnchecked, ExpandMore, ExpandLess,
  ArrowForward, RocketLaunch,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

const ACCENT = '#0891B2';
const GREEN  = '#10B981';

const STORAGE_KEY = 'ksmart_checklist_dismissed';

function getDismissed() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
  catch { return []; }
}
function dismiss(id) {
  const cur = getDismissed();
  if (!cur.includes(id)) localStorage.setItem(STORAGE_KEY, JSON.stringify([...cur, id]));
}

const CheckRow = ({ step, onDismiss }) => {
  const navigate = useNavigate();
  return (
    <Box
      sx={{
        display: 'flex', alignItems: 'center', gap: 1.5, py: 0.75, px: 1,
        borderRadius: 2, cursor: step.path ? 'pointer' : 'default',
        transition: 'background 0.15s',
        '&:hover': step.path && !step.done ? { bgcolor: 'action.hover' } : {},
      }}
      onClick={() => step.path && !step.done && navigate(step.path)}
    >
      <Box sx={{ color: step.done ? GREEN : 'text.disabled', flexShrink: 0, display: 'flex' }}>
        {step.done ? <CheckCircle sx={{ fontSize: 18 }} /> : <RadioButtonUnchecked sx={{ fontSize: 18 }} />}
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{
          fontSize: 12.5, fontWeight: step.done ? 500 : 700,
          color: step.done ? 'text.disabled' : 'text.primary',
          textDecoration: step.done ? 'line-through' : 'none',
        }}>
          {step.label}
        </Typography>
        {!step.done && (
          <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{step.desc}</Typography>
        )}
      </Box>
      {!step.done && step.cta && (
        <Chip label="Activar" size="small" sx={{ bgcolor: `${ACCENT}18`, color: ACCENT, fontWeight: 700, fontSize: 10 }} />
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
  const [open, setOpen]     = useState(true);
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
      desc: 'Publica tus productos en tu tienda online y compártela con tus clientes.',
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

  return (
    <Paper
      sx={{
        mb: 2.5, borderRadius: 3, border: '1px solid', borderColor: `${ACCENT}28`,
        bgcolor: 'background.paper', overflow: 'hidden',
      }}
    >
      {/* Header */}
      <Box
        onClick={() => setOpen(o => !o)}
        sx={{
          display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1.25,
          cursor: 'pointer', bgcolor: `${ACCENT}08`,
          borderBottom: open ? '1px solid' : 'none', borderColor: `${ACCENT}18`,
        }}
      >
        <RocketLaunch sx={{ color: ACCENT, fontSize: 18 }} />
        <Box sx={{ flex: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: 'text.primary' }}>
              Configura tu cuenta
            </Typography>
            <Chip
              label={`${doneCount}/${steps.length}`}
              size="small"
              sx={{ height: 18, fontSize: 10, fontWeight: 700, bgcolor: pct === 100 ? `${GREEN}18` : `${ACCENT}18`, color: pct === 100 ? GREEN : ACCENT }}
            />
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
            <LinearProgress
              variant="determinate"
              value={pct}
              sx={{
                flex: 1, height: 4, borderRadius: 2,
                bgcolor: `${ACCENT}15`,
                '& .MuiLinearProgress-bar': { bgcolor: pct === 100 ? GREEN : ACCENT, borderRadius: 2 },
              }}
            />
            <Typography sx={{ fontSize: 10, color: 'text.secondary', flexShrink: 0 }}>{pct}%</Typography>
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
        </Box>
      </Collapse>
    </Paper>
  );
}
