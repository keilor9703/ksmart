// ═══════════════════════════════════════════════════════════════════════════
// ParqueaderoConfig.jsx — VERSIÓN 2 (integra WhatsApp + métodos de pago)
// REEMPLAZA tu archivo /components/ParqueaderoConfig.jsx por este.
// ═══════════════════════════════════════════════════════════════════════════

import React, { useState, useEffect } from 'react';
import {
  Box, Paper, Typography, Grid, TextField, Button, InputAdornment,
  Alert, CircularProgress, Stack, Chip
} from '@mui/material';
import {
  Settings, Save, AttachMoney, LocalParking, Schedule, CheckCircle
} from '@mui/icons-material';
import apiClient from '../api';
import { toast } from 'react-toastify';
import { formatCurrency } from '../utils/formatters';

// ✨ Nueva sección integrada
import ParqueaderoMetodosPago from './ParqueaderoMetodosPago';

const ACCENT = '#FF6020';

export default function ParqueaderoConfig() {
  const [config, setConfig]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState(null);

  useEffect(() => { cargar(); }, []);

  const cargar = async () => {
    setLoading(true);
    try {
      const { data } = await apiClient.get('/parqueadero/config');
      setConfig(data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al cargar la configuración.');
    } finally {
      setLoading(false);
    }
  };

  const handleNumber = (campo) => (e) => {
    const v = e.target.value.replace(/\D/g, '');
    setConfig(prev => ({ ...prev, [campo]: v === '' ? 0 : Number(v) }));
  };

  const handleText = (campo) => (e) => {
    setConfig(prev => ({ ...prev, [campo]: e.target.value }));
  };

  const handleGuardar = async () => {
    setSaving(true);
    try {
      const { data } = await apiClient.put('/parqueadero/config', {
        tarifa_mensual:     config.tarifa_mensual || 0,
        tarifa_quincenal:   config.tarifa_quincenal || 0,
        tarifa_diaria:      config.tarifa_diaria || 0,
        tarifa_hora:        config.tarifa_hora || 0,
        cupo_total:         config.cupo_total || 0,
        nombre_parqueadero: config.nombre_parqueadero || null,
        direccion:          config.direccion || null,
        horario_apertura:   config.horario_apertura || '06:30',
        horario_cierre:     config.horario_cierre || '20:00',
      });
      setConfig(data);
      toast.success('Configuración guardada.');
    } catch (err) {
      if (err.response?.status === 403) {
        toast.error('Solo el administrador puede modificar la configuración.');
      } else {
        toast.error(err.response?.data?.detail || 'Error al guardar.');
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error" sx={{ m: 2 }}>{error}</Alert>;
  }

  const configCompleta = config?.tarifa_mensual > 0 && config?.cupo_total > 0;

  return (
    <Box sx={{ p: { xs: 1, md: 2 }, maxWidth: 1100, mx: 'auto' }}>

      {/* ─── Encabezado ─────────────────────────────────────────── */}
      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2 }}>
        <Box sx={{
          width: 48, height: 48, borderRadius: 2,
          background: `linear-gradient(135deg, ${ACCENT} 0%, #ff9a62 100%)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Settings sx={{ color: 'white' }} />
        </Box>
        <Box>
          <Typography sx={{ fontSize: 22, fontWeight: 800, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            Configuración del parqueadero
          </Typography>
          <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>
            Tarifas, cupo, métodos de pago y mensajes de WhatsApp
          </Typography>
        </Box>
      </Stack>

      {/* ─── Estado configuración base ──────────────────────────── */}
      {!configCompleta && (
        <Alert severity="warning" sx={{ mb: 2, borderRadius: 2 }}>
          <strong>Configuración incompleta.</strong> Establece al menos la tarifa mensual y el cupo total para empezar.
        </Alert>
      )}

      {configCompleta && (
        <Alert severity="success" sx={{ mb: 2, borderRadius: 2 }} icon={<CheckCircle />}>
          Configuración base lista.
        </Alert>
      )}

      {/* ─── Datos del parqueadero ──────────────────────────────── */}
      <Paper sx={{ p: 3, mb: 2, borderRadius: 3 }}>
        <SectionHeader icon={<LocalParking sx={{ color: ACCENT }} />} title="Datos del parqueadero" />
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth size="small" label="Nombre del parqueadero"
              placeholder="Ej: Parqueadero Don Carlos"
              value={config?.nombre_parqueadero || ''}
              onChange={handleText('nombre_parqueadero')}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth size="small" label="Dirección"
              placeholder="Ej: Calle 10 #15-20"
              value={config?.direccion || ''}
              onChange={handleText('direccion')}
            />
          </Grid>
          <Grid item xs={6} md={3}>
            <TextField
              fullWidth size="small" label="Cupo total *"
              type="number" inputProps={{ min: 0 }}
              value={config?.cupo_total || ''}
              onChange={handleNumber('cupo_total')}
              helperText="Cuántas motos caben"
              InputProps={{
                endAdornment: <InputAdornment position="end">motos</InputAdornment>,
              }}
            />
          </Grid>
          <Grid item xs={6} md={3}>
            <Stack direction="row" spacing={1}>
              <TextField
                fullWidth size="small" label="Apertura"
                value={config?.horario_apertura || '06:30'}
                onChange={handleText('horario_apertura')}
                placeholder="06:30"
                InputProps={{
                  startAdornment: <Schedule sx={{ fontSize: 16, color: 'text.secondary', mr: 0.5 }} />,
                }}
              />
              <TextField
                fullWidth size="small" label="Cierre"
                value={config?.horario_cierre || '20:00'}
                onChange={handleText('horario_cierre')}
                placeholder="20:00"
              />
            </Stack>
          </Grid>
        </Grid>
      </Paper>

      {/* ─── Tarifas ────────────────────────────────────────────── */}
      <Paper sx={{ p: 3, mb: 2, borderRadius: 3 }}>
        <SectionHeader icon={<AttachMoney sx={{ color: ACCENT }} />} title="Tarifas estándar" />
        <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 2 }}>
          Estas son las tarifas por defecto. Al cobrar puedes ajustar el monto si quieres aplicar un descuento.
        </Typography>

        <Grid container spacing={2}>
          <TarifaInput
            label="Mensual" placeholder="80000"
            descripcion="Mismo día del mes siguiente"
            value={config?.tarifa_mensual} onChange={handleNumber('tarifa_mensual')}
            requerido
          />
          <TarifaInput
            label="Quincenal" placeholder="45000"
            descripcion="15 días"
            value={config?.tarifa_quincenal} onChange={handleNumber('tarifa_quincenal')}
          />
          <TarifaInput
            label="Diaria" placeholder="5000"
            descripcion="1 día completo"
            value={config?.tarifa_diaria} onChange={handleNumber('tarifa_diaria')}
          />
          <TarifaInput
            label="Por hora" placeholder="1500"
            descripcion="Cliente ocasional"
            value={config?.tarifa_hora} onChange={handleNumber('tarifa_hora')}
          />
        </Grid>
      </Paper>

      {/* ─── Vista previa de tarifas ────────────────────────────── */}
      <Paper sx={{ p: 3, mb: 2, borderRadius: 3, bgcolor: 'background.default' }}>
        <Typography sx={{ fontSize: 12, fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', mb: 1 }}>
          Vista previa
        </Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap" gap={1}>
          <Chip label={`Mensual ${formatCurrency(config?.tarifa_mensual || 0)}`}
            sx={{ bgcolor: '#10B98115', color: '#065F46', fontWeight: 700 }} />
          <Chip label={`Quincenal ${formatCurrency(config?.tarifa_quincenal || 0)}`}
            sx={{ bgcolor: '#3B82F615', color: '#1E3A8A', fontWeight: 700 }} />
          <Chip label={`Diaria ${formatCurrency(config?.tarifa_diaria || 0)}`}
            sx={{ bgcolor: '#F59E0B15', color: '#78350F', fontWeight: 700 }} />
          <Chip label={`Hora ${formatCurrency(config?.tarifa_hora || 0)}`}
            sx={{ bgcolor: '#8B5CF615', color: '#5B21B6', fontWeight: 700 }} />
          <Chip label={`Cupo ${config?.cupo_total || 0} motos`}
            sx={{ bgcolor: ACCENT + '15', color: ACCENT, fontWeight: 700 }} />
        </Stack>
      </Paper>

      {/* ─── Guardar ────────────────────────────────────────────── */}
      <Stack direction="row" justifyContent="flex-end" sx={{ mb: 4 }}>
        <Button
          variant="contained" size="large" onClick={handleGuardar}
          disabled={saving}
          startIcon={saving ? <CircularProgress size={18} color="inherit" /> : <Save />}
          sx={{
            bgcolor: ACCENT, '&:hover': { bgcolor: '#e6561c' },
            fontWeight: 800, px: 4, py: 1.5, borderRadius: 2,
            boxShadow: `0 6px 18px ${ACCENT}40`,
          }}
        >
          Guardar tarifas
        </Button>
      </Stack>

      {/* ═════════════════════════════════════════════════════════════ */}
      {/* ✨ NUEVA SECCIÓN: Métodos de pago + Plantillas WhatsApp        */}
      {/* ═════════════════════════════════════════════════════════════ */}
      <ParqueaderoMetodosPago />

    </Box>
  );
}


function SectionHeader({ icon, title }) {
  return (
    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
      {icon}
      <Typography sx={{ fontSize: 16, fontWeight: 800 }}>{title}</Typography>
    </Stack>
  );
}

function TarifaInput({ label, placeholder, descripcion, value, onChange, requerido }) {
  return (
    <Grid item xs={6} md={3}>
      <TextField
        fullWidth size="small"
        label={`${label}${requerido ? ' *' : ''}`}
        type="number" inputProps={{ min: 0 }}
        placeholder={placeholder}
        value={value || ''}
        onChange={onChange}
        helperText={descripcion}
        InputProps={{
          startAdornment: <InputAdornment position="start">$</InputAdornment>,
        }}
      />
    </Grid>
  );
}
