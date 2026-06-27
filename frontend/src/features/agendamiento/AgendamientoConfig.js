import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Paper, Typography, Grid, TextField, Button, Switch, Chip,
  CircularProgress, Stack, Avatar, Tooltip, InputAdornment, Divider,
  FormControl, Select, MenuItem, OutlinedInput, Checkbox, ListItemText,
  ToggleButton, ToggleButtonGroup, Alert,
} from '@mui/material';
import {
  EventAvailable, Schedule, Groups, Save, Refresh, Search, AccessTime,
  CheckCircle, Cancel as CancelIcon, Settings, WhatsApp, Payments,
} from '@mui/icons-material';
import { toast } from 'react-toastify';
import apiClient from '../../api';
import {
  fetchServiciosAgendables, configurarServicioAgendable,
  fetchAgendamientoConfig, updateAgendamientoConfig,
} from '../../api';

const TEAL = '#0891B2';
const TEAL_DARK = '#0E7490';
const DURACIONES = [15, 20, 30, 45, 60, 90, 120];

const HORAS = Array.from({ length: 24 }, (_, i) => ({
  value: i,
  label: `${String(i).padStart(2, '0')}:00`,
}));

const DIAS_SEMANA = [
  { value: 0, label: 'Lun' },
  { value: 1, label: 'Mar' },
  { value: 2, label: 'Mié' },
  { value: 3, label: 'Jue' },
  { value: 4, label: 'Vie' },
  { value: 5, label: 'Sáb' },
  { value: 6, label: 'Dom' },
];

const initials = (name = '') =>
  name.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase()).join('') || '?';

const SectionCard = ({ title, icon, children }) => (
  <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: '1px solid', borderColor: 'divider', mb: 2 }}>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, mb: 2 }}>
      <Box sx={{ color: TEAL }}>{icon}</Box>
      <Typography sx={{ fontWeight: 700, fontSize: 15 }}>{title}</Typography>
    </Box>
    {children}
  </Paper>
);

export default function AgendamientoConfig() {
  const [servicios, setServicios] = useState([]);
  const [usuarios, setUsuarios]   = useState([]);
  const [config, setConfig]       = useState(null);
  const [loading, setLoading]     = useState(true);
  const [savingId, setSavingId]   = useState(null);
  const [savingConfig, setSavingConfig] = useState(false);
  const [query, setQuery]         = useState('');

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [srvRes, usrRes, cfgRes] = await Promise.all([
        fetchServiciosAgendables(false),
        apiClient.get('/users/'),
        fetchAgendamientoConfig(),
      ]);
      setUsuarios(usrRes.data.filter(u => u.is_active !== false));
      setConfig(cfgRes.data);
      setServicios((srvRes.data || []).map(s => ({
        ...s,
        _agendable: s.agendable,
        _duracion: s.duracion_minutos || 30,
        _trabajadores: (s.trabajadores || []).map(t => t.id),
        _dirty: false,
      })));
    } catch {
      toast.error('Error al cargar la configuración.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const patch = (id, changes) =>
    setServicios(prev => prev.map(s => s.id === id ? { ...s, ...changes, _dirty: true } : s));

  const patchConfig = (changes) => setConfig(c => ({ ...c, ...changes }));

  const handleSaveConfig = async () => {
    setSavingConfig(true);
    try {
      const { data } = await updateAgendamientoConfig({
        hora_apertura: config.hora_apertura,
        hora_cierre: config.hora_cierre,
        dias_laborales: config.dias_laborales,
        dias_no_laborales: config.dias_no_laborales,
        whatsapp: config.whatsapp || null,
        requiere_anticipo: config.requiere_anticipo,
        porcentaje_anticipo: config.porcentaje_anticipo,
      });
      setConfig(data);
      toast.success('Horario y políticas actualizados.');
    } catch {
      toast.error('No se pudo guardar la configuración.');
    } finally {
      setSavingConfig(false);
    }
  };

  const handleSaveServicio = async (srv) => {
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
        ...s, agendable: data.agendable, duracion_minutos: data.duracion_minutos,
        trabajadores: data.trabajadores || [], _dirty: false,
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
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3, flexWrap: 'wrap' }}>
        <Avatar sx={{ bgcolor: TEAL, width: 44, height: 44 }}><EventAvailable /></Avatar>
        <Box sx={{ flex: 1, minWidth: 200 }}>
          <Typography sx={{ fontWeight: 800, fontSize: { xs: 20, sm: 24 } }}>
            Configuración de Agendamiento
          </Typography>
          <Typography sx={{ color: 'text.secondary', fontSize: 13 }}>
            Horario, días laborables, servicios y trabajadores.
          </Typography>
        </Box>
        <Chip label={`${agendablesCount} activo${agendablesCount !== 1 ? 's' : ''}`}
          sx={{ bgcolor: `${TEAL}1A`, color: TEAL_DARK, fontWeight: 700 }} />
        <Tooltip title="Recargar">
          <Button onClick={fetchAll} startIcon={<Refresh />} size="small" sx={{ color: TEAL_DARK }}>
            Recargar
          </Button>
        </Tooltip>
      </Box>

      {/* ── SECCIÓN 1: Horario y días ── */}
      {config && (
        <SectionCard title="Horario y días laborables" icon={<AccessTime />}>
          <Grid container spacing={2} alignItems="flex-start">
            <Grid item xs={6} sm={3}>
              <TextField select fullWidth size="small" label="Apertura"
                value={config.hora_apertura ?? 8}
                onChange={e => patchConfig({ hora_apertura: Number(e.target.value) })}>
                {HORAS.map(h => <MenuItem key={h.value} value={h.value}>{h.label}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={6} sm={3}>
              <TextField select fullWidth size="small" label="Cierre"
                value={config.hora_cierre ?? 18}
                onChange={e => patchConfig({ hora_cierre: Number(e.target.value) })}>
                {HORAS.filter(h => h.value > (config.hora_apertura ?? 8)).map(h => (
                  <MenuItem key={h.value} value={h.value}>{h.label}</MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography sx={{ fontSize: 13, fontWeight: 600, mb: 0.8, color: 'text.secondary' }}>
                Días laborables
              </Typography>
              <ToggleButtonGroup
                value={config.dias_laborales || []}
                onChange={(e, dias) => patchConfig({ dias_laborales: dias })}
                size="small" sx={{ flexWrap: 'wrap', gap: 0.5 }}
              >
                {DIAS_SEMANA.map(d => (
                  <ToggleButton key={d.value} value={d.value}
                    sx={{
                      textTransform: 'none', px: 1.5, fontSize: 12, borderRadius: '20px !important',
                      '&.Mui-selected': { bgcolor: `${TEAL} !important`, color: '#fff !important' },
                    }}>
                    {d.label}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth size="small" label="Número WhatsApp del negocio"
                placeholder="3001234567" value={config.whatsapp || ''}
                onChange={e => patchConfig({ whatsapp: e.target.value })}
                helperText="Para que los clientes coordinen el anticipo."
                InputProps={{ startAdornment: (
                  <InputAdornment position="start"><WhatsApp sx={{ fontSize: 18, color: '#25D366' }} /></InputAdornment>
                ) }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Switch checked={config.requiere_anticipo || false}
                    onChange={e => patchConfig({ requiere_anticipo: e.target.checked })}
                    sx={{ '& .Mui-checked': { color: TEAL }, '& .Mui-checked + .MuiSwitch-track': { bgcolor: `${TEAL} !important` } }} />
                  <Typography sx={{ fontSize: 13.5, fontWeight: 600 }}>Requiere anticipo</Typography>
                </Box>
                {config.requiere_anticipo && (
                  <TextField select size="small" label="% anticipo"
                    value={config.porcentaje_anticipo || 50}
                    onChange={e => patchConfig({ porcentaje_anticipo: Number(e.target.value) })}
                    sx={{ width: 130 }}>
                    {[25, 30, 40, 50, 60, 70, 100].map(p => (
                      <MenuItem key={p} value={p}>{p}%</MenuItem>
                    ))}
                  </TextField>
                )}
              </Box>
              {config.requiere_anticipo && !config.whatsapp && (
                <Alert severity="warning" sx={{ mt: 1, py: 0.5, fontSize: 12 }}>
                  Agrega un WhatsApp para que los clientes puedan coordinar el anticipo.
                </Alert>
              )}
            </Grid>
            <Grid item xs={12}>
              <Button variant="contained" disableElevation onClick={handleSaveConfig}
                disabled={savingConfig}
                startIcon={savingConfig ? <CircularProgress size={16} color="inherit" /> : <Save />}
                sx={{ bgcolor: TEAL, '&:hover': { bgcolor: TEAL_DARK } }}>
                Guardar horario y políticas
              </Button>
            </Grid>
          </Grid>
        </SectionCard>
      )}

      {/* ── SECCIÓN 2: Servicios agendables ── */}
      <SectionCard title="Servicios agendables y trabajadores" icon={<Groups />}>
        <TextField fullWidth size="small" placeholder="Buscar servicio…"
          value={query} onChange={e => setQuery(e.target.value)}
          InputProps={{ startAdornment: (
            <InputAdornment position="start"><Search sx={{ color: 'text.disabled' }} /></InputAdornment>
          ) }}
          sx={{ mb: 2 }}
        />

        {usuarios.length === 0 && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            No hay usuarios activos. Crea trabajadores en <b>Usuarios y Permisos</b>.
          </Alert>
        )}

        {filtered.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
            <Typography>No hay servicios. Crea productos marcados como <b>servicio</b> en Productos.</Typography>
          </Box>
        ) : (
          <Stack spacing={1.5}>
            {filtered.map(srv => {
              const on = srv._agendable;
              return (
                <Paper key={srv.id} elevation={0} sx={{
                  p: { xs: 1.8, sm: 2.2 }, borderRadius: 3,
                  border: '1px solid', borderColor: on ? `${TEAL}55` : 'divider',
                  bgcolor: on ? `${TEAL}08` : 'background.paper', transition: 'all .15s',
                }}>
                  <Grid container spacing={1.5} alignItems="center">
                    <Grid item xs={12} sm={5}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
                        <Switch checked={on}
                          onChange={e => patch(srv.id, { _agendable: e.target.checked })}
                          sx={{ '& .Mui-checked': { color: TEAL }, '& .Mui-checked + .MuiSwitch-track': { bgcolor: `${TEAL} !important` } }} />
                        <Box sx={{ minWidth: 0 }}>
                          <Typography sx={{ fontWeight: 700, fontSize: 14.5, lineHeight: 1.2 }} noWrap>
                            {srv.nombre}
                          </Typography>
                          <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
                            {srv.precio != null ? `$${Number(srv.precio).toLocaleString('es-CO')}` : 'Sin precio'}
                          </Typography>
                        </Box>
                      </Box>
                    </Grid>
                    <Grid item xs={5} sm={2.5}>
                      <TextField select fullWidth size="small" label="Duración"
                        value={srv._duracion} disabled={!on}
                        onChange={e => patch(srv.id, { _duracion: e.target.value })}
                        InputProps={{ startAdornment: (
                          <InputAdornment position="start"><Schedule sx={{ fontSize: 16, color: TEAL }} /></InputAdornment>
                        ) }}>
                        {DURACIONES.map(d => <MenuItem key={d} value={d}>{d} min</MenuItem>)}
                      </TextField>
                    </Grid>
                    <Grid item xs={7} sm={4.5}>
                      <FormControl fullWidth size="small" disabled={!on}>
                        <Select multiple displayEmpty value={srv._trabajadores}
                          onChange={e => patch(srv.id, { _trabajadores: e.target.value })}
                          input={<OutlinedInput />}
                          renderValue={(sel) => sel.length === 0
                            ? <Typography sx={{ fontSize: 13, color: 'text.disabled' }}>Asignar trabajadores…</Typography>
                            : (
                              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.4 }}>
                                {sel.map(id => {
                                  const u = usuarios.find(x => x.id === id);
                                  return <Chip key={id} size="small"
                                    label={u?.nombre_completo?.split(' ')[0] || u?.username || id}
                                    sx={{ bgcolor: `${TEAL}1A`, color: TEAL_DARK, fontWeight: 600, height: 20, fontSize: 11 }} />;
                                })}
                              </Box>
                            )}>
                          {usuarios.map(u => (
                            <MenuItem key={u.id} value={u.id} sx={{ py: 0.5 }}>
                              <Checkbox checked={srv._trabajadores.includes(u.id)}
                                sx={{ '&.Mui-checked': { color: TEAL } }} />
                              <Avatar sx={{ width: 24, height: 24, fontSize: 10, mr: 1, bgcolor: TEAL_DARK }}>
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
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1.2, gap: 1 }}>
                      <Button size="small" onClick={fetchAll} startIcon={<CancelIcon />} color="inherit">
                        Descartar
                      </Button>
                      <Button size="small" variant="contained" disableElevation
                        onClick={() => handleSaveServicio(srv)} disabled={savingId === srv.id}
                        startIcon={savingId === srv.id ? <CircularProgress size={14} color="inherit" /> : <Save />}
                        sx={{ bgcolor: TEAL, '&:hover': { bgcolor: TEAL_DARK } }}>
                        Guardar
                      </Button>
                    </Box>
                  )}
                </Paper>
              );
            })}
          </Stack>
        )}
      </SectionCard>
    </Box>
  );
}
