// ReportShared.js — solo named exports
import React from 'react';
import {
  Box, Typography, Grid, TextField, Button, Paper, CircularProgress, Chip, Stack
} from '@mui/material';
import { FilterList } from '@mui/icons-material';

export const REPORT_ACCENT = '#F43F5E';
export const GREEN  = '#10B981';
export const BLUE   = '#3B82F6';
export const YELLOW = '#F59E0B';
export const RED    = '#EF4444';

// ─── KPI Card ─────────────────────────────────────────────────────────────────
export const KpiCard = ({ label, value, icon, color, sub }) => (
  <Paper sx={{
    p: 2, borderRadius: 3,
    display: 'flex', alignItems: 'center', gap: 1.5,
    boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
    width: '100%', boxSizing: 'border-box',
  }}>
    <Box sx={{
      width: 40, height: 40, borderRadius: 2, flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      bgcolor: `${color}18`, color,
    }}>
      {icon}
    </Box>
    <Box sx={{ minWidth: 0, flex: 1 }}>
      <Typography sx={{ fontSize: 11, color: 'text.secondary', fontWeight: 500 }}>{label}</Typography>
      <Typography sx={{ fontSize: 15, fontWeight: 700, color: 'text.primary', lineHeight: 1.2 }}>{value}</Typography>
      {sub && <Typography sx={{ fontSize: 10, color: 'text.secondary', mt: 0.2 }}>{sub}</Typography>}
    </Box>
  </Paper>
);

// ─── FilterPanel — layout vertical con Stack, nunca desborda ─────────────────
export const FilterPanel = ({
  startDate, onStartChange,
  endDate,   onEndChange,
  onFilter,  onClear,
  loading,   accentColor = REPORT_ACCENT,
  extra,
}) => (
  <Paper sx={{
    p: { xs: 1.5, md: 2.5 }, mb: 2, borderRadius: 2.5,
    border: '1px solid', borderColor: 'divider', boxShadow: 'none',
    width: '100%', boxSizing: 'border-box',
  }}>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
      <FilterList sx={{ fontSize: 14, color: 'text.secondary' }} />
      <Typography sx={{ fontWeight: 600, fontSize: 10, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.6 }}>
        Filtrar por período
      </Typography>
    </Box>

    {/* Stack vertical: cada sección en su propia fila, nunca horizontal forzado */}
    <Stack spacing={1.5} sx={{ width: '100%' }}>
      {/* Fila 1: Inicio + Fin en la misma fila usando Box flex */}
      <Box sx={{ display: 'flex', gap: 1, width: '100%' }}>
        <TextField
          type="date" label="Inicio" value={startDate}
          onChange={e => onStartChange(e.target.value)}
          InputLabelProps={{ shrink: true }} size="small"
          sx={{ flex: 1 }}
        />
        <TextField
          type="date" label="Fin" value={endDate}
          onChange={e => onEndChange(e.target.value)}
          InputLabelProps={{ shrink: true }} size="small"
          sx={{ flex: 1 }}
        />
      </Box>

      {/* Extra si viene */}
      {extra}

      {/* Fila 2: Botones en su propia fila — siempre visibles */}
      <Box sx={{ display: 'flex', gap: 1, width: '100%' }}>
        <Button
          variant="contained" onClick={onFilter} disabled={loading}
          size="small" fullWidth
          sx={{
            background: `linear-gradient(135deg, ${accentColor}, #fb7185)`,
            boxShadow: `0 4px 14px rgba(244,63,94,0.2)`,
            borderRadius: 2, fontWeight: 600,
          }}
        >
          {loading ? 'Cargando…' : 'Filtrar'}
        </Button>
        <Button
          variant="outlined" onClick={onClear} disabled={loading}
          size="small"
          sx={{ borderRadius: 2, fontWeight: 600, borderColor: 'divider', color: 'text.secondary', whiteSpace: 'nowrap' }}
        >
          Limpiar
        </Button>
      </Box>
    </Stack>
  </Paper>
);

// ─── SectionTitle ─────────────────────────────────────────────────────────────
export const SectionTitle = ({ children, badge, color }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
    <Typography sx={{ fontWeight: 700, fontSize: 15 }}>{children}</Typography>
    {badge && (
      <Chip label={badge} size="small"
        sx={{ bgcolor: `${color || REPORT_ACCENT}12`, color: color || REPORT_ACCENT, fontWeight: 600, fontSize: 10 }} />
    )}
  </Box>
);

// ─── LoadingState ─────────────────────────────────────────────────────────────
export const LoadingState = () => (
  <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 180 }}>
    <CircularProgress sx={{ color: REPORT_ACCENT }} />
  </Box>
);

// ─── EmptyState ───────────────────────────────────────────────────────────────
export const EmptyState = ({ icon, message }) => (
  <Box sx={{ textAlign: 'center', py: 5, color: 'text.secondary' }}>
    <Typography sx={{ fontSize: 40, mb: 1 }}>{icon}</Typography>
    <Typography sx={{ fontSize: 13 }}>{message}</Typography>
  </Box>
);

// ─── barChartDefaults ─────────────────────────────────────────────────────────
export const barChartDefaults = () => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false }, title: { display: false } },
  scales: {
    y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' }, border: { display: false } },
    x: { grid: { display: false }, border: { display: false } },
  },
});

// ─── accentDataset ────────────────────────────────────────────────────────────
export const accentDataset = (data, label, color = REPORT_ACCENT) => ({
  label, data,
  backgroundColor: `${color}CC`,
  borderColor: color,
  borderWidth: 1.5,
  borderRadius: 6,
  borderSkipped: false,
});
