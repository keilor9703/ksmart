// ═══════════════════════════════════════════════════════════════════════════
// ParqueaderoConfig.jsx — VERSIÓN 3
// Añade: tarifa por minuto + cobro mínimo + indicador de equivalente horario
// REEMPLAZA tu archivo /components/ParqueaderoConfig.jsx por este.
// ═══════════════════════════════════════════════════════════════════════════

import React, { useState, useEffect } from 'react';
import {
  Box, Paper, Typography, Grid, TextField, Button, InputAdornment,
  Alert, CircularProgress, Stack, Chip, Tooltip
} from '@mui/material';
import {
  Settings, Save, AttachMoney, LocalParking, Schedule, CheckCircle, Timer, InfoOutlined
} from '@mui/icons-material';
import apiClient from '../../api';
import { toast } from 'react-toastify';
import { formatCurrency } from '../../utils/formatters';
import CurrencyField from '../../components/common/CurrencyField';

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

  const handleNumber = (campo) => (val) => {
    setConfig(prev => ({ ...prev, [campo]: val }));
  };

  const handleText = (campo) => (e) => {
    setConfig(prev => ({ ...prev, [campo]: e.target.value }));
  };

  // ✨ NUEVO: cuando se cambia tarifa_minuto, sugerir tarifa_hora automáticamente
  const handleTarifaMinuto = (val) => {
    const num = val || 0;
    setConfig(prev => ({
      ...prev,
      tarifa_minuto: num,
      // Sugerir tarifa_hora SOLO si está en 0 o si no se ha tocado manualmente
      tarifa_hora: (!prev.tarifa_hora || prev.tarifa_hora === 0) ? num * 60 : prev.tarifa_hora,
    }));
  };

  const handleGuardar = async () => {
    setSaving(true);
    try {
      const { data } = await apiClient.put('/parqueadero/config', {
        tarifa_mensual:        config.tarifa_mensual || 0,
        tarifa_quincenal:      config.tarifa_quincenal || 0,
        tarifa_diaria:         config.tarifa_diaria || 0,
        tarifa_hora:           config.tarifa_hora || 0,
        tarifa_minuto:         config.tarifa_minuto || 0,
        cobro_minimo_minutos:  config.cobro_minimo_minutos ?? 30,
        cupo_total:            config.cupo_total || 0,
        nombre_parqueadero:    config.nombre_parqueadero || null,
        direccion:             config.direccion || null,
        horario_apertura:      config.horario_apertura || '06:30',
        horario_cierre:        config.horario_cierre || '20:00',
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
    return <Box sx={{ p: 4, textAlign: 'center' }}><CircularProgress /></Box>;
  }

  if (error) {
    return <Alert severity="error" sx={{ m: 2 }}>{error}</Alert>;
  }

  const configCompleta = config?.tarifa_mensual > 0 && config?.cupo_total > 0;
  const horaCalculada = (config?.tarifa_minuto || 0) * 60;
  const horaConfigurada = config?.tarifa_hora || 0;
  const diferenciaHora = horaConfigurada > 0 && horaCalculada > 0 && horaConfigurada !== horaCalculada;

  // Cobro mínimo en valor
  const valorCobroMinimo = (config?.cobro_minimo_minutos || 0) * (config?.tarifa_minuto || 0);

  return (
    <Box sx={{ p: { xs: 1, md: 2 }, maxWidth: 1100, mx: 'auto' }}>

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

      {/* ─── Tarifas para suscripciones ─────────────────────────── */}
      <Paper sx={{ p: 3, mb: 2, borderRadius: 3 }}>
        <SectionHeader icon={<AttachMoney sx={{ color: ACCENT }} />} title="Tarifas para suscripciones" />
        <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 2 }}>
          Tarifas para clientes mensuales o quincenales. Al cobrar puedes ajustar el monto puntualmente.
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
        </Grid>
      </Paper>

      {/* ─── ✨ NUEVO: Cobro por minutos para clientes ocasionales ─── */}
      <Paper sx={{ p: 3, mb: 2, borderRadius: 3, border: '2px solid', borderColor: '#10B98140' }}>
        <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2 }}>
          <Box sx={{
            width: 40, height: 40, borderRadius: 2,
            bgcolor: '#10B98115', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Timer sx={{ color: '#10B981' }} />
          </Box>
          <Box>
            <Typography sx={{ fontSize: 16, fontWeight: 800 }}>
              Cobro por minutos (clientes ocasionales)
            </Typography>
            <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
              Para motos que entran por horas y se les cobra el tiempo exacto
            </Typography>
          </Box>
        </Stack>

        <Grid container spacing={2}>
          <Grid item xs={12} md={4}>
            <CurrencyField
              fullWidth size="small" label="Tarifa por minuto"
              placeholder="50"
              value={config?.tarifa_minuto}
              onChange={handleTarifaMinuto}
              helperText="Lo que cobras por cada minuto"
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <CurrencyField
              fullWidth size="small" label="Tarifa por hora (informativa)"
              placeholder="3000"
              value={config?.tarifa_hora}
              onChange={handleNumber('tarifa_hora')}
              helperText={
                config?.tarifa_minuto > 0
                  ? `Sugerido: ${formatCurrency(horaCalculada)} (60 × min)`
                  : "Solo se muestra al cliente como referencia"
              }
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth size="small" label="Cobro mínimo"
              type="number" inputProps={{ min: 0, max: 240 }}
              placeholder="30"
              value={config?.cobro_minimo_minutos ?? 30}
              onChange={handleNumber('cobro_minimo_minutos')}
              helperText={
                config?.cobro_minimo_minutos > 0 && config?.tarifa_minuto > 0
                  ? `= ${formatCurrency(valorCobroMinimo)} mínimo`
                  : "0 = desactivado"
              }
              InputProps={{
                endAdornment: <InputAdornment position="end">min</InputAdornment>,
              }}
            />
          </Grid>
        </Grid>

        {diferenciaHora && (
          <Alert severity="info" sx={{ mt: 2, fontSize: 12 }} icon={<InfoOutlined />}>
            Tu tarifa por hora ({formatCurrency(horaConfigurada)}) no coincide con la calculada
            por minuto ({formatCurrency(horaCalculada)}). Esto está bien si lo configuraste a propósito —
            la tarifa por hora es solo informativa, lo que se cobra es por minutos.
          </Alert>
        )}

        {config?.tarifa_minuto > 0 && (
          <Box sx={{ mt: 2, p: 2, bgcolor: '#10B98110', borderRadius: 2 }}>
            <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#065F46', mb: 1, textTransform: 'uppercase' }}>
              Ejemplos de cobro
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" gap={1}>
              <Chip size="small" label={`15 min = ${formatCurrency(15 * config.tarifa_minuto)}`}
                sx={{ bgcolor: 'background.paper' }} />
              <Chip size="small" label={`30 min = ${formatCurrency(30 * config.tarifa_minuto)}`}
                sx={{ bgcolor: 'background.paper' }} />
              <Chip size="small" label={`60 min = ${formatCurrency(60 * config.tarifa_minuto)}`}
                sx={{ bgcolor: 'background.paper' }} />
              <Chip size="small" label={`120 min = ${formatCurrency(120 * config.tarifa_minuto)}`}
                sx={{ bgcolor: 'background.paper' }} />
            </Stack>
          </Box>
        )}
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
          <Chip label={`Minuto ${formatCurrency(config?.tarifa_minuto || 0)}`}
            sx={{ bgcolor: '#10B98115', color: '#065F46', fontWeight: 700 }} />
          <Chip label={`Hora (info) ${formatCurrency(config?.tarifa_hora || 0)}`}
            sx={{ bgcolor: '#94A3B815', color: '#475569', fontWeight: 700 }} />
          <Chip label={`Cupo ${config?.cupo_total || 0} motos`}
            sx={{ bgcolor: ACCENT + '15', color: ACCENT, fontWeight: 700 }} />
        </Stack>
      </Paper>

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
          Guardar configuración
        </Button>
      </Stack>

      {/* ✨ Sección de WhatsApp + Métodos de pago (sin cambios) */}
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
      <CurrencyField
        fullWidth size="small"
        label={`${label}${requerido ? ' *' : ''}`}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        helperText={descripcion}
      />
    </Grid>
  );
}
