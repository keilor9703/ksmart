import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Button, IconButton, Paper, Grid, Chip,
  CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, MenuItem, Tooltip, alpha, useTheme, Divider,
  ToggleButtonGroup, ToggleButton,
} from '@mui/material';
import {
  Add, Edit, Delete, Check, Close, EventNote, Phone,
  Person, TableRestaurant, CalendarToday, Schedule, Group,
} from '@mui/icons-material';
import { toast } from 'react-toastify';
import apiClient from '../../api';

const ACCENT = '#0891B2';

const ESTADOS = ['pendiente', 'confirmada', 'cancelada', 'completada'];
const ESTADO_COLORS = {
  pendiente:  { bg: 'rgba(245,158,11,0.12)',  color: '#D97706', label: 'Pendiente' },
  confirmada: { bg: 'rgba(34,197,94,0.12)',   color: '#16A34A', label: 'Confirmada' },
  cancelada:  { bg: 'rgba(239,68,68,0.12)',   color: '#DC2626', label: 'Cancelada' },
  completada: { bg: 'rgba(148,163,184,0.12)', color: '#64748B', label: 'Completada' },
};

const HORAS = Array.from({ length: 32 }, (_, i) => {
  const h = Math.floor(i / 2) + 7;
  const m = i % 2 === 0 ? '00' : '30';
  return `${String(h).padStart(2, '0')}:${m}`;
});

const toLocalDate = (d) => {
  if (!d) return '';
  if (d instanceof Date) return d.toISOString().split('T')[0];
  return d;
};

const today = () => new Date().toISOString().split('T')[0];

// ─── DialogReserva ─────────────────────────────────────────────────────────────
const DialogReserva = ({ open, onClose, reserva, mesas, onSaved }) => {
  const [form, setForm] = useState({
    nombre_cliente: '', telefono: '', fecha: today(), hora: '19:00',
    personas: 2, mesa_id: '', notas: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (reserva) {
      setForm({
        nombre_cliente: reserva.nombre_cliente || '',
        telefono: reserva.telefono || '',
        fecha: reserva.fecha || today(),
        hora: reserva.hora || '19:00',
        personas: reserva.personas || 2,
        mesa_id: reserva.mesa_id || '',
        notas: reserva.notas || '',
      });
    } else {
      setForm({ nombre_cliente: '', telefono: '', fecha: today(), hora: '19:00', personas: 2, mesa_id: '', notas: '' });
    }
  }, [reserva, open]);

  const set = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }));

  const handleSave = async () => {
    if (!form.nombre_cliente.trim()) return toast.error('El nombre del cliente es obligatorio');
    setSaving(true);
    try {
      const body = {
        ...form,
        mesa_id: form.mesa_id || null,
        personas: parseInt(form.personas) || 2,
      };
      if (reserva) {
        await apiClient.put(`/restaurante/reservas/${reserva.id}`, body);
        toast.success('Reserva actualizada');
      } else {
        await apiClient.post('/restaurante/reservas', body);
        toast.success('Reserva creada');
      }
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>
        {reserva ? 'Editar reserva' : 'Nueva reserva'}
      </DialogTitle>
      <DialogContent>
        <Grid container spacing={2} sx={{ mt: 0 }}>
          <Grid item xs={12}>
            <TextField fullWidth label="Nombre del cliente *" value={form.nombre_cliente} onChange={set('nombre_cliente')} size="small"
              InputProps={{ startAdornment: <Person sx={{ mr: 1, color: '#64748b', fontSize: 18 }} /> }} />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField fullWidth label="Teléfono" value={form.telefono} onChange={set('telefono')} size="small"
              InputProps={{ startAdornment: <Phone sx={{ mr: 1, color: '#64748b', fontSize: 18 }} /> }} />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField fullWidth label="Personas" type="number" value={form.personas} onChange={set('personas')} size="small"
              InputProps={{ startAdornment: <Group sx={{ mr: 1, color: '#64748b', fontSize: 18 }} />, inputProps: { min: 1, max: 50 } }} />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField fullWidth label="Fecha *" type="date" value={form.fecha} onChange={set('fecha')} size="small"
              InputLabelProps={{ shrink: true }}
              InputProps={{ startAdornment: <CalendarToday sx={{ mr: 1, color: '#64748b', fontSize: 18 }} /> }} />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField fullWidth select label="Hora *" value={form.hora} onChange={set('hora')} size="small"
              InputProps={{ startAdornment: <Schedule sx={{ mr: 1, color: '#64748b', fontSize: 18 }} /> }}>
              {HORAS.map(h => <MenuItem key={h} value={h}>{h}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid item xs={12}>
            <TextField fullWidth select label="Mesa asignada (opcional)" value={form.mesa_id} onChange={set('mesa_id')} size="small"
              InputProps={{ startAdornment: <TableRestaurant sx={{ mr: 1, color: '#64748b', fontSize: 18 }} /> }}>
              <MenuItem value="">Sin asignar</MenuItem>
              {mesas.filter(m => m.is_active).map(m => (
                <MenuItem key={m.id} value={m.id}>Mesa {m.numero}{m.nombre ? ` — ${m.nombre}` : ''}{m.zona ? ` (${m.zona})` : ''}</MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12}>
            <TextField fullWidth multiline rows={2} label="Notas especiales" value={form.notas} onChange={set('notas')} size="small"
              placeholder="Cumpleaños, alergias, solicitudes especiales..." />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={saving}>Cancelar</Button>
        <Button variant="contained" onClick={handleSave} disabled={saving}
          sx={{ bgcolor: ACCENT, '&:hover': { bgcolor: '#e55516' } }}>
          {saving ? <CircularProgress size={18} sx={{ color: '#fff' }} /> : (reserva ? 'Guardar' : 'Crear reserva')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ─── Tarjeta Reserva ───────────────────────────────────────────────────────────
const TarjetaReserva = ({ reserva, onEdit, onDelete, onEstado }) => {
  const ec = ESTADO_COLORS[reserva.estado] || ESTADO_COLORS.pendiente;
  return (
    <Paper elevation={1} sx={{ p: 2, borderRadius: 2, border: `1px solid rgba(0,0,0,0.08)`, position: 'relative' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
        <Box>
          <Typography sx={{ fontWeight: 700, fontSize: 15 }}>{reserva.nombre_cliente}</Typography>
          {reserva.telefono && (
            <Typography sx={{ fontSize: 12, color: 'text.secondary', display: 'flex', alignItems: 'center', gap: 0.4 }}>
              <Phone sx={{ fontSize: 12 }} /> {reserva.telefono}
            </Typography>
          )}
        </Box>
        <Box sx={{ display: 'flex', gap: 0.4 }}>
          <Tooltip title="Editar">
            <IconButton size="small" onClick={() => onEdit(reserva)}>
              <Edit sx={{ fontSize: 15 }} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Eliminar">
            <IconButton size="small" onClick={() => onDelete(reserva)} sx={{ color: '#EF4444' }}>
              <Delete sx={{ fontSize: 15 }} />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Info */}
      <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mb: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Schedule sx={{ fontSize: 14, color: 'text.secondary' }} />
          <Typography sx={{ fontSize: 12 }}>{reserva.hora}</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Group sx={{ fontSize: 14, color: 'text.secondary' }} />
          <Typography sx={{ fontSize: 12 }}>{reserva.personas} personas</Typography>
        </Box>
        {reserva.mesa_numero && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <TableRestaurant sx={{ fontSize: 14, color: 'text.secondary' }} />
            <Typography sx={{ fontSize: 12 }}>Mesa {reserva.mesa_numero}</Typography>
          </Box>
        )}
      </Box>

      {reserva.notas && (
        <Typography sx={{ fontSize: 12, color: 'text.secondary', fontStyle: 'italic', mb: 1 }}>
          "{reserva.notas}"
        </Typography>
      )}

      {/* Estado */}
      <Box sx={{ display: 'flex', gap: 0.8, flexWrap: 'wrap' }}>
        {ESTADOS.filter(e => e !== reserva.estado).map(e => {
          const c = ESTADO_COLORS[e];
          return (
            <Chip
              key={e}
              label={c.label}
              size="small"
              onClick={() => onEstado(reserva, e)}
              sx={{ fontSize: 11, bgcolor: c.bg, color: c.color, fontWeight: 600, cursor: 'pointer', '&:hover': { opacity: 0.8 } }}
            />
          );
        })}
        <Chip
          label={ec.label}
          size="small"
          sx={{ fontSize: 11, bgcolor: ec.bg, color: ec.color, fontWeight: 700, border: `1px solid ${ec.color}` }}
        />
      </Box>
    </Paper>
  );
};

// ─── Principal ─────────────────────────────────────────────────────────────────
export default function ReservasRestaurante() {
  const [reservas, setReservas] = useState([]);
  const [mesas, setMesas]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [dialogOpen, setDialogOpen]   = useState(false);
  const [editing, setEditing]         = useState(null);
  const [fechaFiltro, setFechaFiltro] = useState(today());
  const [estadoFiltro, setEstadoFiltro] = useState('todas');

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (fechaFiltro) params.fecha = fechaFiltro;
      if (estadoFiltro !== 'todas') params.estado = estadoFiltro;
      const [r, m] = await Promise.all([
        apiClient.get('/restaurante/reservas', { params }),
        apiClient.get('/restaurante/mesas'),
      ]);
      setReservas(r.data);
      setMesas(m.data);
    } catch (err) {
      toast.error('Error al cargar reservas');
    } finally {
      setLoading(false);
    }
  }, [fechaFiltro, estadoFiltro]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleDelete = async (reserva) => {
    if (!window.confirm(`¿Eliminar la reserva de "${reserva.nombre_cliente}"?`)) return;
    try {
      await apiClient.delete(`/restaurante/reservas/${reserva.id}`);
      toast.success('Reserva eliminada');
      fetchAll();
    } catch {
      toast.error('Error al eliminar');
    }
  };

  const handleEstado = async (reserva, estado) => {
    try {
      await apiClient.put(`/restaurante/reservas/${reserva.id}`, { estado });
      toast.success('Estado actualizado');
      fetchAll();
    } catch {
      toast.error('Error al actualizar estado');
    }
  };

  return (
    <Box sx={{ maxWidth: 960, mx: 'auto', p: { xs: 1, md: 0 } }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3, flexWrap: 'wrap', gap: 1 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800, fontFamily: "'Geist', sans-serif", display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <EventNote sx={{ color: ACCENT, fontSize: 28 }} />
            Reservas
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Gestiona las reservas de mesas de tu restaurante
          </Typography>
        </Box>
        <Button
          variant="contained" startIcon={<Add />}
          onClick={() => { setEditing(null); setDialogOpen(true); }}
          sx={{ bgcolor: ACCENT, '&:hover': { bgcolor: '#e55516' } }}
        >
          Nueva reserva
        </Button>
      </Box>

      {/* Filtros */}
      <Box sx={{ display: 'flex', gap: 2, mb: 2.5, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField
          type="date" size="small" label="Fecha"
          value={fechaFiltro} onChange={e => setFechaFiltro(e.target.value)}
          InputLabelProps={{ shrink: true }} sx={{ width: 170 }}
        />
        <Box sx={{ display: 'flex', gap: 0.7, flexWrap: 'wrap' }}>
          {['todas', ...ESTADOS].map(e => {
            const ec = ESTADO_COLORS[e];
            const sel = estadoFiltro === e;
            return (
              <Chip key={e} label={ec?.label || 'Todas'} size="small"
                onClick={() => setEstadoFiltro(e)}
                sx={{
                  cursor: 'pointer', fontWeight: 600,
                  bgcolor: sel ? (ec?.bg || alpha(ACCENT, 0.12)) : 'transparent',
                  color: sel ? (ec?.color || ACCENT) : 'text.secondary',
                  border: `1px solid ${sel ? (ec?.color || ACCENT) : 'rgba(0,0,0,0.12)'}`,
                }}
              />
            );
          })}
        </Box>
      </Box>

      {/* Contenido */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress sx={{ color: ACCENT }} /></Box>
      ) : reservas.length === 0 ? (
        <Paper elevation={0} sx={{ p: 5, textAlign: 'center', borderRadius: 2, border: '1px dashed rgba(0,0,0,0.12)' }}>
          <EventNote sx={{ fontSize: 56, color: 'text.disabled', mb: 1 }} />
          <Typography color="text.secondary">No hay reservas para los filtros seleccionados</Typography>
          <Button
            variant="outlined" startIcon={<Add />} size="small" sx={{ mt: 2, borderColor: ACCENT, color: ACCENT }}
            onClick={() => { setEditing(null); setDialogOpen(true); }}
          >
            Crear primera reserva
          </Button>
        </Paper>
      ) : (
        <Grid container spacing={2}>
          {reservas.map(r => (
            <Grid item xs={12} sm={6} md={4} key={r.id}>
              <TarjetaReserva
                reserva={r}
                onEdit={rv => { setEditing(rv); setDialogOpen(true); }}
                onDelete={handleDelete}
                onEstado={handleEstado}
              />
            </Grid>
          ))}
        </Grid>
      )}

      <DialogReserva
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        reserva={editing}
        mesas={mesas}
        onSaved={fetchAll}
      />
    </Box>
  );
}
