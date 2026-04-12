// ReportShared.js — componentes y helpers reutilizables en todos los sub-reportes
// IMPORTANTE: Solo named exports (sin default export)
import React from 'react';
import {
  Box, Typography, Grid, TextField, Button, Paper, CircularProgress, Chip
} from '@mui/material';
import { FilterList } from '@mui/icons-material';

// ─── Colores ───────────────────────────────────────────────────────────────────
export const REPORT_ACCENT = '#F43F5E';
export const GREEN  = '#10B981';
export const BLUE   = '#3B82F6';
export const YELLOW = '#F59E0B';
export const RED    = '#EF4444';

// ─── KPI Card — width 100% para que el Grid la contenga ──────────────────────
export const KpiCard = ({ label, value, icon, color, sub }) => (
  <Paper sx={{
    p: 2, borderRadius: 3,
    display: 'flex', alignItems: 'center', gap: 1.5,
    boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
    width: '100%', boxSizing: 'border-box',
  }}>
    <Box sx={{
      width: 42, height: 42, borderRadius: 2, flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      bgcolor: `${color}18`, color,
    }}>
      {icon}
    </Box>
    <Box sx={{ minWidth: 0, flex: 1 }}>
      <Typography sx={{ fontSize: 11, color: 'text.secondary', fontWeight: 500 }}>{label}</Typography>
      <Typography sx={{ fontSize: 16, fontWeight: 700, color: 'text.primary', lineHeight: 1.2 }}>{value}</Typography>
      {sub && <Typography sx={{ fontSize: 10, color: 'text.secondary', mt: 0.2 }}>{sub}</Typography>}
    </Box>
  </Paper>
);

// ─── Panel de filtros — fechas en xs=6 para que quepan en una sola fila ───────
export const FilterPanel = ({
  startDate, onStartChange,
  endDate,   onEndChange,
  onFilter,  onClear,
  loading,   accentColor = REPORT_ACCENT,
  extra,
}) => (
  <Paper sx={{
    p: { xs: 1.5, md: 2.5 }, mb: 2.5, borderRadius: 2.5,
    border: '1px solid', borderColor: 'divider', boxShadow: 'none',
    width: '100%', boxSizing: 'border-box',
  }}>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
      <FilterList sx={{ fontSize: 15, color: 'text.secondary' }} />
      <Typography sx={{ fontWeight: 600, fontSize: 11, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.6 }}>
        Filtrar por período
      </Typography>
    </Box>
    <Grid container spacing={1.5} alignItems="flex-end">
      {/* Fechas: xs=6 para que quepan una al lado de la otra en mobile */}
      <Grid item xs={6} sm={3}>
        <TextField
          type="date" label="Inicio" value={startDate}
          onChange={e => onStartChange(e.target.value)}
          InputLabelProps={{ shrink: true }} fullWidth size="small"
        />
      </Grid>
      <Grid item xs={6} sm={3}>
        <TextField
          type="date" label="Fin" value={endDate}
          onChange={e => onEndChange(e.target.value)}
          InputLabelProps={{ shrink: true }} fullWidth size="small"
        />
      </Grid>
      {extra}
      {/* Botones: fila propia en mobile */}
      <Grid item xs={12} sm={extra ? 3 : 6}>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="contained" onClick={onFilter} disabled={loading} fullWidth
            size="small"
            sx={{
              background: `linear-gradient(135deg, ${accentColor}, #fb7185)`,
              boxShadow: `0 4px 14px rgba(244,63,94,0.25)`,
              borderRadius: 2, fontWeight: 600,
            }}
          >
            {loading ? 'Cargando…' : 'Filtrar'}
          </Button>
          <Button
            variant="outlined" onClick={onClear} disabled={loading} size="small"
            sx={{ borderRadius: 2, fontWeight: 600, borderColor: 'divider', color: 'text.secondary', whiteSpace: 'nowrap' }}
          >
            Limpiar
          </Button>
        </Box>
      </Grid>
    </Grid>
  </Paper>
);

// ─── Sección de título ─────────────────────────────────────────────────────────
export const SectionTitle = ({ children, badge, color }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
    <Typography sx={{ fontWeight: 700, fontSize: 15 }}>{children}</Typography>
    {badge && (
      <Chip label={badge} size="small"
        sx={{ bgcolor: `${color || REPORT_ACCENT}12`, color: color || REPORT_ACCENT, fontWeight: 600, fontSize: 10 }} />
    )}
  </Box>
);

// ─── Estado de carga ───────────────────────────────────────────────────────────
export const LoadingState = () => (
  <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200 }}>
    <CircularProgress sx={{ color: REPORT_ACCENT }} />
  </Box>
);

// ─── Estado vacío ──────────────────────────────────────────────────────────────
export const EmptyState = ({ icon, message }) => (
  <Box sx={{ textAlign: 'center', py: 6, color: 'text.secondary' }}>
    <Typography sx={{ fontSize: 44, mb: 1.5 }}>{icon}</Typography>
    <Typography sx={{ fontSize: 14 }}>{message}</Typography>
  </Box>
);

// ─── Config de gráfica de barras ───────────────────────────────────────────────
export const barChartDefaults = () => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    title:  { display: false },
  },
  scales: {
    y: {
      beginAtZero: true,
      grid: { color: 'rgba(0,0,0,0.05)' },
      border: { display: false },
    },
    x: {
      grid: { display: false },
      border: { display: false },
    },
  },
});

// ─── Dataset de barras con colores de acento ───────────────────────────────────
export const accentDataset = (data, label, color = REPORT_ACCENT) => ({
  label,
  data,
  backgroundColor: `${color}CC`,
  borderColor: color,
  borderWidth: 1.5,
  borderRadius: 6,
  borderSkipped: false,
});
