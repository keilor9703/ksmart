import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box, Paper, Typography, Button, Chip, IconButton, CircularProgress, Stack,
  Avatar, Tooltip, Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  MenuItem, Grid, Divider, Menu, ListItemIcon, ListItemText, Autocomplete,
  ToggleButtonGroup, ToggleButton, useMediaQuery, Fab,
} from '@mui/material';
import {
  EventNote, ChevronLeft, ChevronRight, Today, Add, Schedule, Person,
  Engineering, MoreVert, CheckCircle, PlayArrow, DoneAll, Cancel as CancelIcon,
  Delete, EventBusy, Settings, AccessTime, Share,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useTheme } from '@mui/material/styles';
import apiClient, {
  fetchServiciosAgendables, fetchDisponibilidad, fetchCitas,
  createCita, updateCita, cambiarEstadoCita, deleteCita,
} from '../../api';

const TEAL = '#0D9488';
const TEAL_DARK = '#0F766E';

const ESTADOS = {
  pendiente:  { label: 'Pendiente',  color: '#D97706', bg: '#FEF3C7' },
  confirmada: { label: 'Confirmada', color: '#0D9488', bg: '#CCFBF1' },
  en_curso:   { label: 'En curso',   color: '#2563EB', bg: '#DBEAFE' },
  completada: { label: 'Completada', color: '#16A34A', bg: '#DCFCE7' },
  cancelada:  { label: 'Cancelada',  color: '#DC2626', bg: '#FEE2E2' },
  no_asistio: { label: 'No asistió', color: '#6B7280', bg: '#F3F4F6' },
};

// ── Helpers de fecha (local) ───────────────────────────────────────────────
const pad = n => String(n).padStart(2, '0');
const toYMD = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fmtHora = (iso) => new Date(iso).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true });
const fmtFechaLarga = (d) => d.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });
const initials = (name = '') =>
  name.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase()).join('') || '?';

export default function Agendamiento() {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [fecha, setFecha]       = useState(() => new Date());
  const [citas, setCitas]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing]   = useState(null);
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [menuCita, setMenuCita] = useState(null);

  const ymd = toYMD(fecha);

  const cargarCitas = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await fetchCitas({ desde: ymd, hasta: ymd });
      setCitas(data || []);
    } catch (e) {
      toast.error('Error al cargar las citas.');
    } finally {
      setLoading(false);
    }
  }, [ymd]);

  useEffect(() => { cargarCitas(); }, [cargarCitas]);

  const moverDia = (delta) => {
    const d = new Date(fecha);
    d.setDate(d.getDate() + delta);
    setFecha(d);
  };

  const stats = useMemo(() => {
    const activos = citas.filter(c => !['cancelada', 'no_asistio'].includes(c.estado));
    return {
      total: citas.length,
      pendientes: citas.filter(c => c.estado === 'pendiente').length,
      confirmadas: citas.filter(c => c.estado === 'confirmada').length,
      completadas: citas.filter(c => c.estado === 'completada').length,
      activos: activos.length,
    };
  }, [citas]);

  const compartirLink = async () => {
    try {
      const { data } = await apiClient.get('/catalogo/config');
      const slug = data?.slug_catalogo;
      if (!slug) {
        toast.info('Configura primero el enlace de tu negocio en Catálogo Virtual para compartir tu página de citas.');
        return;
      }
      const url = `${window.location.origin}/${slug}/agendar`;
      try {
        await navigator.clipboard.writeText(url);
        toast.success('¡Link de agendamiento copiado! Compártelo con tus clientes.');
      } catch {
        window.prompt('Copia tu link público de agendamiento:', url);
      }
    } catch {
      toast.error('No se pudo obtener el link público.');
    }
  };

  const handleEstado = async (cita, estado) => {
    setMenuAnchor(null);
    try {
      await cambiarEstadoCita(cita.id, estado);
      toast.success(`Cita marcada como ${ESTADOS[estado]?.label?.toLowerCase()}.`);
      cargarCitas();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'No se pudo actualizar.');
    }
  };

  const handleDelete = async (cita) => {
    setMenuAnchor(null);
    if (!window.confirm(`¿Eliminar la cita de ${cita.cliente_display || 'cliente'}?`)) return;
    try {
      await deleteCita(cita.id);
      toast.success('Cita eliminada.');
      cargarCitas();
    } catch (e) {
      toast.error('No se pudo eliminar.');
    }
  };

  const citasOrdenadas = [...citas].sort((a, b) => new Date(a.fecha_inicio) - new Date(b.fecha_inicio));
  const esHoy = toYMD(new Date()) === ymd;

  return (
    <Box sx={{ p: { xs: 1.5, sm: 3 }, maxWidth: 1000, mx: 'auto', pb: 10 }}>
      {/* ── Header ── */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5, flexWrap: 'wrap' }}>
        <Avatar sx={{ bgcolor: TEAL, width: 44, height: 44 }}><EventNote /></Avatar>
        <Box sx={{ flex: 1, minWidth: 160 }}>
          <Typography sx={{ fontWeight: 800, fontSize: { xs: 20, sm: 24 } }}>Agenda de Citas</Typography>
          <Typography sx={{ color: 'text.secondary', fontSize: 13 }}>
            Gestiona las citas de tus servicios por trabajador.
          </Typography>
        </Box>
        <Tooltip title="Copiar link público para que tus clientes agenden solos">
          <Button onClick={compartirLink} startIcon={<Share />}
            size="small" variant="contained" disableElevation
            sx={{ bgcolor: TEAL, '&:hover': { bgcolor: TEAL_DARK } }}>
            Compartir
          </Button>
        </Tooltip>
        <Tooltip title="Configurar servicios y trabajadores">
          <Button onClick={() => navigate('/agendamiento/config')} startIcon={<Settings />}
            size="small" variant="outlined"
            sx={{ color: TEAL_DARK, borderColor: `${TEAL}66` }}>
            Configurar
          </Button>
        </Tooltip>
      </Box>

      {/* ── Navegación de fecha ── */}
      <Paper elevation={0} sx={{
        p: 1.5, borderRadius: 3, border: '1px solid', borderColor: 'divider',
        mb: 2, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap',
      }}>
        <IconButton onClick={() => moverDia(-1)} size="small"><ChevronLeft /></IconButton>
        <Box sx={{ flex: 1, textAlign: 'center', minWidth: 160 }}>
          <Typography sx={{ fontWeight: 700, fontSize: 16, textTransform: 'capitalize', lineHeight: 1.1 }}>
            {fmtFechaLarga(fecha)}
          </Typography>
          <Typography sx={{ fontSize: 12, color: esHoy ? TEAL : 'text.secondary', fontWeight: esHoy ? 700 : 400 }}>
            {esHoy ? '● Hoy' : fecha.getFullYear()}
          </Typography>
        </Box>
        <IconButton onClick={() => moverDia(1)} size="small"><ChevronRight /></IconButton>
        <Tooltip title="Ir a hoy">
          <IconButton onClick={() => setFecha(new Date())} size="small" sx={{ color: TEAL }}>
            <Today />
          </IconButton>
        </Tooltip>
        <TextField
          type="date" size="small" value={ymd}
          onChange={e => { const [y, m, d] = e.target.value.split('-'); setFecha(new Date(+y, +m - 1, +d)); }}
          sx={{ width: 150 }}
        />
      </Paper>

      {/* ── Stats ── */}
      {!loading && citas.length > 0 && (
        <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap', gap: 1 }}>
          <Chip label={`${stats.activos} activas`} sx={{ bgcolor: `${TEAL}1A`, color: TEAL_DARK, fontWeight: 700 }} />
          {stats.pendientes > 0 && <Chip size="small" label={`${stats.pendientes} pendientes`} sx={{ bgcolor: ESTADOS.pendiente.bg, color: ESTADOS.pendiente.color, fontWeight: 600 }} />}
          {stats.confirmadas > 0 && <Chip size="small" label={`${stats.confirmadas} confirmadas`} sx={{ bgcolor: ESTADOS.confirmada.bg, color: ESTADOS.confirmada.color, fontWeight: 600 }} />}
          {stats.completadas > 0 && <Chip size="small" label={`${stats.completadas} completadas`} sx={{ bgcolor: ESTADOS.completada.bg, color: ESTADOS.completada.color, fontWeight: 600 }} />}
        </Stack>
      )}

      {/* ── Lista de citas ── */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress sx={{ color: TEAL }} />
        </Box>
      ) : citasOrdenadas.length === 0 ? (
        <Paper sx={{ p: 6, textAlign: 'center', borderRadius: 3, border: '1px dashed', borderColor: 'divider' }}>
          <EventBusy sx={{ fontSize: 56, color: 'text.disabled', mb: 1 }} />
          <Typography sx={{ fontWeight: 700, color: 'text.secondary' }}>Sin citas para este día</Typography>
          <Typography sx={{ fontSize: 13, color: 'text.disabled', mb: 2.5 }}>
            Agenda una nueva cita con el botón inferior.
          </Typography>
          <Button variant="contained" disableElevation startIcon={<Add />}
            onClick={() => { setEditing(null); setDialogOpen(true); }}
            sx={{ bgcolor: TEAL, '&:hover': { bgcolor: TEAL_DARK } }}>
            Nueva cita
          </Button>
        </Paper>
      ) : (
        <Stack spacing={1.2}>
          {citasOrdenadas.map(cita => {
            const est = ESTADOS[cita.estado] || ESTADOS.pendiente;
            const cancelada = ['cancelada', 'no_asistio'].includes(cita.estado);
            return (
              <Paper key={cita.id} elevation={0} sx={{
                p: { xs: 1.5, sm: 2 }, borderRadius: 3, border: '1px solid', borderColor: 'divider',
                borderLeft: `4px solid ${est.color}`,
                opacity: cancelada ? 0.6 : 1,
                display: 'flex', alignItems: 'center', gap: { xs: 1.5, sm: 2 },
              }}>
                {/* Hora */}
                <Box sx={{ textAlign: 'center', minWidth: 64 }}>
                  <Typography sx={{ fontWeight: 800, fontSize: 15, color: TEAL_DARK, lineHeight: 1.1 }}>
                    {fmtHora(cita.fecha_inicio)}
                  </Typography>
                  <Typography sx={{ fontSize: 11, color: 'text.disabled' }}>
                    {fmtHora(cita.fecha_fin)}
                  </Typography>
                </Box>
                <Divider orientation="vertical" flexItem />
                {/* Detalle */}
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 700, fontSize: 15 }} noWrap>
                    {cita.producto_nombre}
                  </Typography>
                  <Stack direction="row" spacing={1.5} sx={{ mt: 0.3, flexWrap: 'wrap' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4 }}>
                      <Person sx={{ fontSize: 15, color: 'text.disabled' }} />
                      <Typography sx={{ fontSize: 12.5, color: 'text.secondary' }} noWrap>
                        {cita.cliente_display || 'Sin cliente'}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4 }}>
                      <Engineering sx={{ fontSize: 15, color: 'text.disabled' }} />
                      <Typography sx={{ fontSize: 12.5, color: 'text.secondary' }} noWrap>
                        {cita.trabajador_nombre}
                      </Typography>
                    </Box>
                  </Stack>
                </Box>
                {/* Estado + menú */}
                <Stack direction={isMobile ? 'column' : 'row'} spacing={0.5} alignItems="center">
                  <Chip label={est.label} size="small"
                    sx={{ bgcolor: est.bg, color: est.color, fontWeight: 700, fontSize: 11 }} />
                  <IconButton size="small" onClick={(e) => { setMenuAnchor(e.currentTarget); setMenuCita(cita); }}>
                    <MoreVert />
                  </IconButton>
                </Stack>
              </Paper>
            );
          })}
        </Stack>
      )}

      {/* ── Menú de acciones por cita ── */}
      <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={() => setMenuAnchor(null)}>
        {menuCita && menuCita.estado === 'pendiente' && (
          <MenuItem onClick={() => handleEstado(menuCita, 'confirmada')}>
            <ListItemIcon><CheckCircle fontSize="small" sx={{ color: ESTADOS.confirmada.color }} /></ListItemIcon>
            <ListItemText>Confirmar</ListItemText>
          </MenuItem>
        )}
        {menuCita && ['pendiente', 'confirmada'].includes(menuCita.estado) && (
          <MenuItem onClick={() => handleEstado(menuCita, 'en_curso')}>
            <ListItemIcon><PlayArrow fontSize="small" sx={{ color: ESTADOS.en_curso.color }} /></ListItemIcon>
            <ListItemText>Iniciar</ListItemText>
          </MenuItem>
        )}
        {menuCita && ['confirmada', 'en_curso', 'pendiente'].includes(menuCita.estado) && (
          <MenuItem onClick={() => handleEstado(menuCita, 'completada')}>
            <ListItemIcon><DoneAll fontSize="small" sx={{ color: ESTADOS.completada.color }} /></ListItemIcon>
            <ListItemText>Completar</ListItemText>
          </MenuItem>
        )}
        <MenuItem onClick={() => { setEditing(menuCita); setDialogOpen(true); setMenuAnchor(null); }}>
          <ListItemIcon><Schedule fontSize="small" /></ListItemIcon>
          <ListItemText>Reprogramar / Editar</ListItemText>
        </MenuItem>
        {menuCita && !['cancelada', 'no_asistio', 'completada'].includes(menuCita.estado) && (
          <MenuItem onClick={() => handleEstado(menuCita, 'cancelada')}>
            <ListItemIcon><CancelIcon fontSize="small" sx={{ color: ESTADOS.cancelada.color }} /></ListItemIcon>
            <ListItemText>Cancelar cita</ListItemText>
          </MenuItem>
        )}
        {menuCita && menuCita.estado !== 'no_asistio' && menuCita.estado !== 'completada' && (
          <MenuItem onClick={() => handleEstado(menuCita, 'no_asistio')}>
            <ListItemIcon><EventBusy fontSize="small" sx={{ color: ESTADOS.no_asistio.color }} /></ListItemIcon>
            <ListItemText>No asistió</ListItemText>
          </MenuItem>
        )}
        <Divider />
        <MenuItem onClick={() => handleDelete(menuCita)} sx={{ color: 'error.main' }}>
          <ListItemIcon><Delete fontSize="small" sx={{ color: 'error.main' }} /></ListItemIcon>
          <ListItemText>Eliminar</ListItemText>
        </MenuItem>
      </Menu>

      {/* ── FAB nueva cita ── */}
      <Fab variant={isMobile ? 'circular' : 'extended'}
        onClick={() => { setEditing(null); setDialogOpen(true); }}
        sx={{ position: 'fixed', bottom: 24, right: 24, bgcolor: TEAL, color: '#fff', '&:hover': { bgcolor: TEAL_DARK } }}>
        <Add sx={{ mr: isMobile ? 0 : 1 }} />
        {!isMobile && 'Nueva cita'}
      </Fab>

      {dialogOpen && (
        <CitaDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          editing={editing}
          fechaDefault={fecha}
          onSaved={() => { setDialogOpen(false); cargarCitas(); }}
        />
      )}
    </Box>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Dialog de creación / edición de cita
// ════════════════════════════════════════════════════════════════════════════
function CitaDialog({ open, onClose, editing, fechaDefault, onSaved }) {
  const isEdit = Boolean(editing);
  const [servicios, setServicios] = useState([]);
  const [clientes, setClientes]   = useState([]);
  const [loadingMeta, setLoadingMeta] = useState(true);

  const [productoId, setProductoId] = useState(editing?.producto_id || '');
  const [fecha, setFecha] = useState(toYMD(editing ? new Date(editing.fecha_inicio) : fechaDefault));
  const [franjas, setFranjas] = useState([]);
  const [loadingFranjas, setLoadingFranjas] = useState(false);
  const [slot, setSlot] = useState(null); // { inicio, user_id, trabajador_nombre }

  const [clienteSel, setClienteSel] = useState(null);
  const [nombre, setNombre]   = useState(editing?.cliente_nombre || '');
  const [telefono, setTelefono] = useState(editing?.cliente_telefono || '');
  const [email, setEmail]     = useState(editing?.cliente_email || '');
  const [notas, setNotas]     = useState(editing?.notas || '');
  const [saving, setSaving]   = useState(false);

  useEffect(() => {
    (async () => {
      setLoadingMeta(true);
      try {
        const [srvRes, cliRes] = await Promise.all([
          fetchServiciosAgendables(true),
          apiClient.get('/clientes/', { params: { limit: 500 } }),
        ]);
        setServicios(srvRes.data || []);
        setClientes((cliRes.data || []).filter(c => c.es_cliente !== false));
        if (editing?.cliente_id) {
          const c = (cliRes.data || []).find(x => x.id === editing.cliente_id);
          if (c) setClienteSel(c);
        }
      } catch {
        toast.error('Error al cargar datos.');
      } finally {
        setLoadingMeta(false);
      }
    })();
  }, [editing]);

  // Cargar disponibilidad cuando hay servicio + fecha
  const cargarFranjas = useCallback(async () => {
    if (!productoId || !fecha) { setFranjas([]); return; }
    setLoadingFranjas(true);
    setSlot(null);
    try {
      const { data } = await fetchDisponibilidad(productoId, fecha);
      setFranjas(data.franjas || []);
    } catch {
      setFranjas([]);
    } finally {
      setLoadingFranjas(false);
    }
  }, [productoId, fecha]);

  useEffect(() => { cargarFranjas(); }, [cargarFranjas]);

  const servicioActual = servicios.find(s => s.id === productoId);

  const handleGuardar = async () => {
    if (!productoId) return toast.error('Selecciona un servicio.');
    if (!slot) return toast.error('Selecciona una franja horaria disponible.');
    const nombreCli = clienteSel ? clienteSel.nombre : nombre;
    if (!clienteSel && !nombre.trim()) return toast.error('Indica el cliente o su nombre.');

    setSaving(true);
    const payload = {
      producto_id: productoId,
      user_id: slot.user_id,
      cliente_id: clienteSel?.id || null,
      fecha_inicio: slot.inicio,
      cliente_nombre: clienteSel ? null : nombre.trim() || null,
      cliente_telefono: clienteSel ? null : telefono.trim() || null,
      cliente_email: clienteSel ? null : email.trim() || null,
      notas: notas.trim() || null,
    };
    try {
      if (isEdit) {
        await updateCita(editing.id, payload);
        toast.success('Cita actualizada.');
      } else {
        await createCita(payload);
        toast.success('Cita agendada correctamente.');
      }
      onSaved();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'No se pudo guardar la cita.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth
      PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.2, fontWeight: 800 }}>
        <Avatar sx={{ bgcolor: TEAL, width: 34, height: 34 }}><EventNote sx={{ fontSize: 19 }} /></Avatar>
        {isEdit ? 'Editar cita' : 'Nueva cita'}
      </DialogTitle>
      <DialogContent dividers>
        {loadingMeta ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress sx={{ color: TEAL }} />
          </Box>
        ) : servicios.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 3 }}>
            <Typography sx={{ fontWeight: 700, mb: 1 }}>No hay servicios agendables</Typography>
            <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>
              Habilita servicios y asígnales trabajadores en <b>Configurar</b>.
            </Typography>
          </Box>
        ) : (
          <Stack spacing={2.2} sx={{ mt: 0.5 }}>
            {/* Servicio */}
            <TextField select fullWidth label="Servicio" value={productoId}
              onChange={e => setProductoId(e.target.value)} size="small">
              {servicios.map(s => (
                <MenuItem key={s.id} value={s.id}>
                  {s.nombre} · {s.duracion_minutos || 30} min
                </MenuItem>
              ))}
            </TextField>

            {/* Fecha */}
            <TextField type="date" fullWidth label="Fecha" value={fecha}
              onChange={e => setFecha(e.target.value)} size="small"
              InputLabelProps={{ shrink: true }} />

            {/* Franjas disponibles */}
            <Box>
              <Typography sx={{ fontSize: 13, fontWeight: 700, mb: 1, display: 'flex', alignItems: 'center', gap: 0.6 }}>
                <AccessTime sx={{ fontSize: 17, color: TEAL }} /> Horarios disponibles
              </Typography>
              {!productoId ? (
                <Typography sx={{ fontSize: 13, color: 'text.disabled' }}>Selecciona un servicio primero.</Typography>
              ) : loadingFranjas ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}><CircularProgress size={22} sx={{ color: TEAL }} /></Box>
              ) : franjas.length === 0 ? (
                <Paper variant="outlined" sx={{ p: 2, textAlign: 'center', borderRadius: 2, borderStyle: 'dashed' }}>
                  <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>
                    No hay horarios disponibles para esta fecha.
                  </Typography>
                </Paper>
              ) : (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, maxHeight: 180, overflowY: 'auto', p: 0.5 }}>
                  {franjas.map((f, i) => {
                    const sel = slot && slot.inicio === f.inicio && slot.user_id === f.user_id;
                    return (
                      <Tooltip key={i} title={`Atiende: ${f.trabajador_nombre}`} arrow>
                        <Chip
                          label={fmtHora(f.inicio)}
                          onClick={() => setSlot(f)}
                          sx={{
                            fontWeight: 700, cursor: 'pointer', px: 0.5,
                            bgcolor: sel ? TEAL : `${TEAL}12`,
                            color: sel ? '#fff' : TEAL_DARK,
                            border: `1px solid ${sel ? TEAL : `${TEAL}33`}`,
                            '&:hover': { bgcolor: sel ? TEAL_DARK : `${TEAL}22` },
                          }}
                        />
                      </Tooltip>
                    );
                  })}
                </Box>
              )}
              {slot && (
                <Typography sx={{ fontSize: 12.5, color: TEAL_DARK, mt: 1, fontWeight: 600 }}>
                  ✓ {fmtHora(slot.inicio)} con {slot.trabajador_nombre}
                </Typography>
              )}
            </Box>

            <Divider />

            {/* Cliente */}
            <Autocomplete
              options={clientes}
              getOptionLabel={(o) => o.nombre || ''}
              value={clienteSel}
              onChange={(e, v) => setClienteSel(v)}
              isOptionEqualToValue={(o, v) => o.id === v.id}
              renderInput={(params) => (
                <TextField {...params} label="Cliente registrado (opcional)" size="small"
                  placeholder="Buscar cliente…" />
              )}
            />
            {!clienteSel && (
              <Grid container spacing={1.5}>
                <Grid item xs={12}>
                  <TextField fullWidth size="small" label="Nombre del cliente"
                    value={nombre} onChange={e => setNombre(e.target.value)} />
                </Grid>
                <Grid item xs={6}>
                  <TextField fullWidth size="small" label="Teléfono"
                    value={telefono} onChange={e => setTelefono(e.target.value)} />
                </Grid>
                <Grid item xs={6}>
                  <TextField fullWidth size="small" label="Email"
                    value={email} onChange={e => setEmail(e.target.value)} />
                </Grid>
              </Grid>
            )}

            <TextField fullWidth size="small" label="Notas (opcional)" multiline rows={2}
              value={notas} onChange={e => setNotas(e.target.value)} />
          </Stack>
        )}
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} color="inherit">Cancelar</Button>
        <Button variant="contained" disableElevation onClick={handleGuardar}
          disabled={saving || loadingMeta || servicios.length === 0}
          startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <CheckCircle />}
          sx={{ bgcolor: TEAL, '&:hover': { bgcolor: TEAL_DARK } }}>
          {isEdit ? 'Guardar cambios' : 'Agendar cita'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
