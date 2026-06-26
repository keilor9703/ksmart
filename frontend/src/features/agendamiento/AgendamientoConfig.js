import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Paper, Typography, Grid, TextField, Button, Switch, Chip,
  CircularProgress, Stack, Avatar, Tooltip, InputAdornment, Divider,
  FormControl, Select, MenuItem, OutlinedInput, Checkbox, ListItemText,
} from '@mui/material';
import {
  EventAvailable, Schedule, Groups, Save, Refresh, Search,
  CheckCircle, Cancel as CancelIcon,
} from '@mui/icons-material';
import { toast } from 'react-toastify';
import apiClient from '../../api';
import {
  fetchServiciosAgendables, configurarServicioAgendable,
} from '../../api';

const TEAL = '#0D9488';
const TEAL_DARK = '#0F766E';

const DURACIONES = [15, 20, 30, 45, 60, 90, 120];

const initials = (name = '') =>
  name.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase()).join('') || '?';

export default function AgendamientoConfig() {
  const [servicios, setServicios] = useState([]);
  const [usuarios, setUsuarios]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [savingId, setSavingId]   = useState(null);
  const [query, setQuery]         = useState('');

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [srvRes, usrRes] = await Promise.all([
        fetchServiciosAgendables(false),
        apiClient.get('/users/'),
      ]);
      setUsuarios(usrRes.data.filter(u => u.is_active !== false));
      setServicios((srvRes.data || []).map(s => ({
        ...s,
        _agendable: s.agendable,
        _duracion: s.duracion_minutos || 30,
        _trabajadores: (s.trabajadores || []).map(t => t.id),
        _dirty: false,
      })));
    } catch (e) {
      toast.error('Error al cargar los servicios.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const patch = (id, changes) =>
    setServicios(prev => prev.map(s => s.id === id ? { ...s, ...changes, _dirty: true } : s));

  const handleSave = async (srv) => {
    if (srv._agendable && srv._trabajadores.length === 0) {
      toast.error('Asigna al menos un trabajador para poder agendar este servicio.');
      return;
    }
    setSavingId(srv.id);
    try {
      const { data } = await configurarServicioAgendable(srv.id, {
        agendable: srv._agendable,
        duracion_minutos: Number(srv._duracion) || 30,
        trabajador_ids: srv._trabajadores,
      });
      setServicios(prev => prev.map(s => s.id === srv.id ? {
        ...s,
        agendable: data.agendable,
        duracion_minutos: data.duracion_minutos,
        trabajadores: data.trabajadores || [],
        _dirty: false,
      } : s));
      toast.success(`"${srv.nombre}" actualizado.`);
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'No se pudo guardar.');
    } finally {
      setSavingId(null);
    }
  };

  const filtered = servicios.filter(s =>
    s.nombre.toLowerCase().includes(query.toLowerCase()));

  const agendablesCount = servicios.filter(s => s.agendable).length;

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <CircularProgress sx={{ color: TEAL }} />
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 1.5, sm: 3 }, maxWidth: 1100, mx: 'auto' }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
          <Avatar sx={{ bgcolor: TEAL, width: 44, height: 44 }}>
            <EventAvailable />
          </Avatar>
          <Box sx={{ flex: 1, minWidth: 200 }}>
            <Typography sx={{ fontWeight: 800, fontSize: { xs: 20, sm: 24 } }}>
              Configuración de Agendamiento
            </Typography>
            <Typography sx={{ color: 'text.secondary', fontSize: 13 }}>
              Habilita servicios para citas y asigna qué trabajadores pueden atenderlos.
            </Typography>
          </Box>
          <Chip
            label={`${agendablesCount} agendable${agendablesCount === 1 ? '' : 's'}`}
            sx={{ bgcolor: `${TEAL}1A`, color: TEAL_DARK, fontWeight: 700 }}
          />
          <Tooltip title="Recargar">
            <Button onClick={fetchAll} startIcon={<Refresh />} size="small"
              sx={{ color: TEAL_DARK }}>Recargar</Button>
          </Tooltip>
        </Box>
      </Box>

      {/* Buscador */}
      <TextField
        fullWidth size="small" placeholder="Buscar servicio…"
        value={query} onChange={e => setQuery(e.target.value)}
        InputProps={{ startAdornment: (
          <InputAdornment position="start"><Search sx={{ color: 'text.disabled' }} /></InputAdornment>
        ) }}
        sx={{ mb: 2.5 }}
      />

      {usuarios.length === 0 && (
        <Paper sx={{ p: 2, mb: 2, borderRadius: 2, bgcolor: '#FEF3C7', border: '1px solid #FCD34D' }}>
          <Typography sx={{ fontSize: 13, color: '#92400E' }}>
            No hay usuarios activos. Crea trabajadores en <b>Usuarios y Permisos</b> antes de configurar el agendamiento.
          </Typography>
        </Paper>
      )}

      {filtered.length === 0 ? (
        <Paper sx={{ p: 5, textAlign: 'center', borderRadius: 3, border: '1px dashed', borderColor: 'divider' }}>
          <Typography sx={{ color: 'text.secondary' }}>
            No hay servicios. Crea productos marcados como <b>servicio</b> en el módulo de Productos.
          </Typography>
        </Paper>
      ) : (
        <Stack spacing={2}>
          {filtered.map(srv => {
            const on = srv._agendable;
            return (
              <Paper key={srv.id} elevation={0} sx={{
                p: { xs: 2, sm: 2.5 }, borderRadius: 3,
                border: '1px solid', borderColor: on ? `${TEAL}55` : 'divider',
                bgcolor: on ? `${TEAL}08` : 'background.paper',
                transition: 'all .2s',
              }}>
                <Grid container spacing={2} alignItems="center">
                  {/* Nombre + toggle */}
                  <Grid item xs={12} sm={5}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
                      <Switch
                        checked={on}
                        onChange={e => patch(srv.id, { _agendable: e.target.checked })}
                        sx={{ '& .Mui-checked': { color: TEAL }, '& .Mui-checked + .MuiSwitch-track': { bgcolor: `${TEAL} !important` } }}
                      />
                      <Box sx={{ minWidth: 0 }}>
                        <Typography sx={{ fontWeight: 700, fontSize: 15, lineHeight: 1.2 }} noWrap>
                          {srv.nombre}
                        </Typography>
                        <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
                          {srv.precio != null ? `$${Number(srv.precio).toLocaleString('es-CO')}` : 'Sin precio'}
                        </Typography>
                      </Box>
                    </Box>
                  </Grid>

                  {/* Duración */}
                  <Grid item xs={6} sm={3}>
                    <TextField
                      select fullWidth size="small" label="Duración"
                      value={srv._duracion}
                      disabled={!on}
                      onChange={e => patch(srv.id, { _duracion: e.target.value })}
                      InputProps={{ startAdornment: (
                        <InputAdornment position="start"><Schedule sx={{ fontSize: 18, color: TEAL }} /></InputAdornment>
                      ) }}
                    >
                      {DURACIONES.map(d => (
                        <MenuItem key={d} value={d}>{d} min</MenuItem>
                      ))}
                    </TextField>
                  </Grid>

                  {/* Trabajadores */}
                  <Grid item xs={6} sm={4}>
                    <FormControl fullWidth size="small" disabled={!on}>
                      <Select
                        multiple displayEmpty
                        value={srv._trabajadores}
                        onChange={e => patch(srv.id, { _trabajadores: e.target.value })}
                        input={<OutlinedInput />}
                        renderValue={(sel) => sel.length === 0
                          ? <Typography sx={{ fontSize: 13, color: 'text.disabled' }}>Asignar trabajadores…</Typography>
                          : (
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                              {sel.map(id => {
                                const u = usuarios.find(x => x.id === id);
                                return <Chip key={id} size="small" label={u?.nombre_completo || u?.username || id}
                                  sx={{ bgcolor: `${TEAL}1A`, color: TEAL_DARK, fontWeight: 600, height: 22 }} />;
                              })}
                            </Box>
                          )}
                      >
                        {usuarios.map(u => (
                          <MenuItem key={u.id} value={u.id} sx={{ py: 0.5 }}>
                            <Checkbox checked={srv._trabajadores.includes(u.id)} sx={{ '&.Mui-checked': { color: TEAL } }} />
                            <Avatar sx={{ width: 26, height: 26, fontSize: 11, mr: 1, bgcolor: TEAL_DARK }}>
                              {initials(u.nombre_completo || u.username)}
                            </Avatar>
                            <ListItemText primary={u.nombre_completo || u.username} />
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                </Grid>

                {srv._dirty && (
                  <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1.5, gap: 1 }}>
                    <Button size="small" onClick={fetchAll} startIcon={<CancelIcon />} color="inherit">
                      Descartar
                    </Button>
                    <Button
                      size="small" variant="contained" disableElevation
                      onClick={() => handleSave(srv)}
                      disabled={savingId === srv.id}
                      startIcon={savingId === srv.id ? <CircularProgress size={15} color="inherit" /> : <Save />}
                      sx={{ bgcolor: TEAL, '&:hover': { bgcolor: TEAL_DARK } }}
                    >
                      Guardar
                    </Button>
                  </Box>
                )}
              </Paper>
            );
          })}
        </Stack>
      )}
    </Box>
  );
}
