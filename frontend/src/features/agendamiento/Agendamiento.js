import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Box, Paper, Typography, Button, Chip, IconButton, CircularProgress, Stack,
  Avatar, Tooltip, Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  MenuItem, Grid, Divider, Menu, ListItemIcon, ListItemText, Autocomplete,
  useMediaQuery, Fab, InputAdornment, ToggleButtonGroup, ToggleButton,
  FormControlLabel, Checkbox,
} from '@mui/material';
import {
  EventNote, ChevronLeft, ChevronRight, Today, Add, Schedule, Person,
  Engineering, MoreVert, CheckCircle, PlayArrow, DoneAll, Cancel as CancelIcon,
  Delete, EventBusy, Settings, AccessTime, Share, WhatsApp, AttachMoney,
  OpenInNew, Link, ViewDay, ViewWeek, CalendarMonth, ViewAgenda,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useTheme } from '@mui/material/styles';
import { Calendar, dayjsLocalizer } from 'react-big-calendar';
import dayjs from 'dayjs';
import 'dayjs/locale/es';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import './CalendarioAgenda.css';
import apiClient, {
  fetchServiciosAgendables, fetchDisponibilidad, fetchCitas,
  createCita, updateCita, cambiarEstadoCita, deleteCita, cobrarCita,
} from '../../api';
import usePolling from '../../hooks/usePolling';

dayjs.locale('es');
const localizer = dayjsLocalizer(dayjs);

const TEAL = '#0891B2';
const TEAL_DARK = '#0E7490';
const GREEN = '#16A34A';

const ESTADOS = {
  pendiente:  { label: 'Pendiente',  color: '#D97706' },
  confirmada: { label: 'Confirmada', color: '#0D9488' },
  en_curso:   { label: 'En curso',   color: '#2563EB' },
  completada: { label: 'Completada', color: '#16A34A' },
  cancelada:  { label: 'Cancelada',  color: '#DC2626' },
  no_asistio: { label: 'No asistió', color: '#6B7280' },
};

const estadoChipSx = (est) => ({
  bgcolor: `${est.color}22`,
  color: est.color,
  fontWeight: 700,
  fontSize: 11,
  border: `1px solid ${est.color}44`,
});

const METODOS_PAGO = ['Efectivo', 'Tarjeta', 'Transferencia', 'Nequi', 'Daviplata', 'Otro'];

const pad = n => String(n).padStart(2, '0');
const toYMD = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fmtHora = (iso) => new Date(iso).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true });
const fmtFechaLarga = (d) => d.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });
const fmtCOP = (n) => `$${Number(n || 0).toLocaleString('es-CO')}`;

// Calcula rango desde/hasta según vista y fecha anchor
function calcularRango(fecha, vista) {
  const d = dayjs(fecha);
  if (vista === 'day')    return { desde: toYMD(d.toDate()), hasta: toYMD(d.toDate()) };
  if (vista === 'week')   return { desde: toYMD(d.startOf('week').toDate()), hasta: toYMD(d.endOf('week').toDate()) };
  if (vista === 'month')  return { desde: toYMD(d.startOf('month').subtract(7, 'day').toDate()), hasta: toYMD(d.endOf('month').add(7, 'day').toDate()) };
  if (vista === 'agenda') return { desde: toYMD(d.toDate()), hasta: toYMD(d.add(30, 'day').toDate()) };
  return { desde: toYMD(d.toDate()), hasta: toYMD(d.toDate()) };
}

// Mensajes en español para react-big-calendar
const messages = {
  allDay: 'Todo el día',
  previous: 'Anterior',
  next: 'Siguiente',
  today: 'Hoy',
  month: 'Mes',
  week: 'Semana',
  day: 'Día',
  agenda: 'Agenda',
  date: 'Fecha',
  time: 'Hora',
  event: 'Cita',
  noEventsInRange: 'Sin citas en este período.',
  showMore: total => `+${total} más`,
};

export default function Agendamiento({ user }) {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isDark = theme.palette.mode === 'dark';

  const [fecha, setFecha]           = useState(() => new Date());
  const [vista, setVista]           = useState('day');
  const [citas, setCitas]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing]       = useState(null);
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [menuCita, setMenuCita]     = useState(null);
  const [cobrarCitaObj, setCobrarCitaObj] = useState(null);
  const [trabajadores, setTrabajadores]   = useState([]);
  const [filtroTrabajador, setFiltroTrabajador] = useState('');
  // Para nueva cita desde click en calendario
  const [nuevaCitaFecha, setNuevaCitaFecha] = useState(null);

  const esAdmin = user?.role?.name === 'Admin';
  const ymd = toYMD(fecha);
  const rango = useMemo(() => calcularRango(fecha, vista), [fecha, vista]);

  const cargarCitas = useCallback(async () => {
    setLoading(true);
    try {
      const params = { desde: rango.desde, hasta: rango.hasta };
      if (filtroTrabajador) params.user_id = filtroTrabajador;
      const { data } = await fetchCitas(params);
      setCitas(data || []);
    } catch {
      toast.error('Error al cargar las citas.');
    } finally {
      setLoading(false);
    }
  }, [rango, filtroTrabajador]);

  const refrescarSilencioso = useCallback(async () => {
    try {
      const params = { desde: rango.desde, hasta: rango.hasta };
      if (filtroTrabajador) params.user_id = filtroTrabajador;
      const { data } = await fetchCitas(params);
      const nuevas = data || [];
      setCitas(prev => {
        const idsPrev = new Set(prev.map(c => c.id));
        const agregadas = nuevas.filter(c => !idsPrev.has(c.id));
        if (agregadas.length > 0 && prev.length > 0) {
          toast.info(agregadas.length === 1
            ? `📅 Nueva cita: ${agregadas[0].cliente_display || 'cliente'} · ${agregadas[0].producto_nombre}`
            : `📅 ${agregadas.length} nuevas citas recibidas`);
        }
        return nuevas;
      });
    } catch { /* silencioso */ }
  }, [rango, filtroTrabajador]);

  useEffect(() => { cargarCitas(); }, [cargarCitas]);
  usePolling(refrescarSilencioso, 30000);

  useEffect(() => {
    if (!esAdmin) return;
    (async () => {
      try {
        const { data } = await apiClient.get('/users/');
        setTrabajadores((data || []).filter(u => u.is_active !== false));
      } catch { /* silencioso */ }
    })();
  }, [esAdmin]);

  const handleSaved = (saved) => {
    setDialogOpen(false);
    setCobrarCitaObj(null);
    setNuevaCitaFecha(null);
    if (saved?.fecha_inicio) {
      const d = new Date(saved.fecha_inicio);
      if (toYMD(d) !== ymd) { setFecha(d); return; }
    }
    cargarCitas();
  };

  const moverPeriodo = (delta) => {
    const d = dayjs(fecha);
    if (vista === 'day')    setFecha(d.add(delta, 'day').toDate());
    if (vista === 'week')   setFecha(d.add(delta, 'week').toDate());
    if (vista === 'month')  setFecha(d.add(delta, 'month').toDate());
    if (vista === 'agenda') setFecha(d.add(delta * 30, 'day').toDate());
  };

  const labelPeriodo = useMemo(() => {
    const d = dayjs(fecha);
    if (vista === 'day')    return fmtFechaLarga(fecha);
    if (vista === 'week')   return `${d.startOf('week').format('D MMM')} – ${d.endOf('week').format('D MMM YYYY')}`;
    if (vista === 'month')  return d.format('MMMM YYYY');
    if (vista === 'agenda') return `${d.format('D MMM')} – ${d.add(30, 'day').format('D MMM YYYY')}`;
    return '';
  }, [fecha, vista]);

  const esHoy = toYMD(new Date()) === ymd;

  const stats = useMemo(() => ({
    activos:    citas.filter(c => !['cancelada', 'no_asistio'].includes(c.estado)).length,
    pendientes: citas.filter(c => c.estado === 'pendiente').length,
    completadas: citas.filter(c => c.estado === 'completada').length,
  }), [citas]);

  // Eventos para react-big-calendar
  const eventos = useMemo(() => citas.map(c => ({
    id: c.id,
    title: `${c.cliente_display || 'Sin cliente'} — ${c.producto_nombre}`,
    start: new Date(c.fecha_inicio),
    end: new Date(c.fecha_fin),
    resource: c,
  })), [citas]);

  const estiloEvento = useCallback((event) => {
    const c = event.resource;
    const color = ESTADOS[c?.estado]?.color || TEAL;
    return {
      style: {
        backgroundColor: `${color}CC`,
        borderLeft: `3px solid ${color}`,
        color: '#fff',
        borderRadius: 6,
      },
    };
  }, []);

  const handleSelectEvent = useCallback((event) => {
    setMenuCita(event.resource);
    // Abrir menú anclado al cursor usando un elemento temporal
    setMenuAnchor(document.getElementById('cal-event-anchor'));
  }, []);

  const handleSelectSlot = useCallback(({ start }) => {
    setNuevaCitaFecha(start);
    setEditing(null);
    setDialogOpen(true);
  }, []);

  const enviarRecordatorio = async (cita) => {
    setMenuAnchor(null);
    const tel = (cita.cliente_telefono || '').replace(/\D/g, '');
    if (!tel) { toast.info('Esta cita no tiene teléfono de cliente registrado.'); return; }
    let negocio = 'nuestro negocio';
    try {
      const { data } = await apiClient.get('/users/me');
      negocio = data?.empresa?.nombre || data?.empresa_nombre || negocio;
    } catch {}
    const numero = tel.length === 10 ? `57${tel}` : tel;
    const cuando = `${fmtFechaLarga(new Date(cita.fecha_inicio))} a las ${fmtHora(cita.fecha_inicio)}`;
    const msg = [
      `👋 ¡Hola ${cita.cliente_display || ''}! Te escribe *${negocio}* 🗓️`,
      ``,
      `Te recordamos tu cita de *${cita.producto_nombre}* con *${cita.trabajador_nombre}*:`,
      `📅 ${cuando}`,
      ``,
      `Por favor llega puntual 🙏. Si necesitas reagendar, no dudes en avisarnos.`,
      ``,
      `¡Te esperamos! ✨`,
    ].join('\n');
    window.open(`https://wa.me/${numero}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const compartirLink = async () => {
    try {
      const { data } = await apiClient.get('/catalogo/config');
      const slug = data?.slug_catalogo;
      if (!slug) { toast.info('Configura primero el enlace de tu negocio en Catálogo Virtual.'); return; }
      const url = `${window.location.origin}/${slug}/agendar`;
      try { await navigator.clipboard.writeText(url); toast.success('¡Link copiado! Compártelo con tus clientes 📋'); }
      catch { window.prompt('Tu link público de agendamiento:', url); }
    } catch { toast.error('No se pudo obtener el link público.'); }
  };

  const handleEstado = async (cita, estado) => {
    setMenuAnchor(null);
    try {
      await cambiarEstadoCita(cita.id, estado);
      toast.success(`Cita marcada como ${ESTADOS[estado]?.label?.toLowerCase()}.`);
      cargarCitas();
    } catch (e) { toast.error(e?.response?.data?.detail || 'No se pudo actualizar.'); }
  };

  const handleDelete = async (cita) => {
    setMenuAnchor(null);
    if (!window.confirm(`¿Eliminar la cita de ${cita.cliente_display || 'cliente'}?`)) return;
    try {
      await deleteCita(cita.id);
      toast.success('Cita eliminada.');
      cargarCitas();
    } catch { toast.error('No se pudo eliminar.'); }
  };

  const citasOrdenadas = [...citas]
    .filter(c => vista === 'day' ? toYMD(new Date(c.fecha_inicio)) === ymd : true)
    .sort((a, b) => new Date(a.fecha_inicio) - new Date(b.fecha_inicio));

  // Referencia invisible anclada al centro de pantalla para el menú de evento cal.
  const calAnchorRef = useRef(null);

  return (
    <Box sx={{ p: { xs: 1.5, sm: 3 }, maxWidth: vista === 'day' ? 1000 : 1400, mx: 'auto', pb: 10 }}>
      {/* Elemento invisible anclado para el menú de evento del calendario */}
      <span id="cal-event-anchor" ref={calAnchorRef}
        style={{ position: 'fixed', top: '50%', left: '50%', width: 1, height: 1, pointerEvents: 'none' }} />

      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5, flexWrap: 'wrap' }}>
        <Avatar sx={{ bgcolor: TEAL, width: 44, height: 44 }}><EventNote /></Avatar>
        <Box sx={{ flex: 1, minWidth: 160 }}>
          <Typography sx={{ fontWeight: 800, fontSize: { xs: 20, sm: 24 } }}>Agenda de Citas</Typography>
          <Typography sx={{ color: 'text.secondary', fontSize: 13 }}>Gestiona las citas de tus servicios.</Typography>
        </Box>
        <Tooltip title="Copiar link público para clientes">
          <Button onClick={compartirLink} startIcon={!isMobile ? <Link /> : null} size="small" variant="contained" disableElevation
            sx={{ bgcolor: TEAL, '&:hover': { bgcolor: TEAL_DARK }, minWidth: { xs: 40, sm: 'auto' }, px: { xs: 1, sm: 2 } }}>
            {isMobile ? <Link sx={{ fontSize: 18 }} /> : 'Compartir'}
          </Button>
        </Tooltip>
        <Tooltip title="Configurar servicios y trabajadores">
          <Button onClick={() => navigate('/agendamiento/config')} startIcon={!isMobile ? <Settings /> : null}
            size="small" variant="outlined" sx={{ color: TEAL_DARK, borderColor: `${TEAL}66`, minWidth: { xs: 40, sm: 'auto' }, px: { xs: 1, sm: 2 } }}>
            {isMobile ? <Settings sx={{ fontSize: 18 }} /> : 'Configurar'}
          </Button>
        </Tooltip>
      </Box>

      {/* Barra de controles: navegación + vistas + filtro */}
      <Paper elevation={0} sx={{
        p: { xs: 1.25, sm: 1.5 }, borderRadius: 3, border: '1px solid', borderColor: 'divider',
        mb: 2, display: 'flex', alignItems: 'center', gap: { xs: 0.75, sm: 1 }, flexWrap: 'wrap',
      }}>
        {/* Fila 1: navegación de período */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flex: 1, minWidth: { xs: '100%', sm: 200 } }}>
          <IconButton onClick={() => moverPeriodo(-1)} size="small"><ChevronLeft /></IconButton>
          <Box sx={{ flex: 1, textAlign: 'center', minWidth: 0 }}>
            <Typography sx={{ fontWeight: 700, fontSize: { xs: 14, sm: 15 }, textTransform: 'capitalize', lineHeight: 1.2 }} noWrap>
              {labelPeriodo}
            </Typography>
            {vista === 'day' && (
              <Typography sx={{ fontSize: 12, color: esHoy ? TEAL : 'text.secondary', fontWeight: esHoy ? 700 : 400 }}>
                {esHoy ? '● Hoy' : fecha.getFullYear()}
              </Typography>
            )}
          </Box>
          <IconButton onClick={() => moverPeriodo(1)} size="small"><ChevronRight /></IconButton>
          <Tooltip title="Ir a hoy">
            <IconButton onClick={() => setFecha(new Date())} size="small" sx={{ color: TEAL }}><Today /></IconButton>
          </Tooltip>
        </Box>

        {/* Fila 2: vistas + filtros (full width en móvil) */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap', width: { xs: '100%', sm: 'auto' }, justifyContent: { xs: 'space-between', sm: 'flex-end' } }}>
          <ToggleButtonGroup value={vista} exclusive size="small"
            onChange={(_, v) => { if (v) setVista(v); }}
            sx={{ '& .MuiToggleButton-root': { px: { xs: 1, sm: 1.2 }, py: 0.6, fontSize: 12, border: `1px solid ${TEAL}44`,
              '&.Mui-selected': { bgcolor: `${TEAL}20`, color: TEAL, fontWeight: 700 } } }}>
            <ToggleButton value="day"><Tooltip title="Día"><ViewDay sx={{ fontSize: 18 }} /></Tooltip></ToggleButton>
            <ToggleButton value="week"><Tooltip title="Semana"><ViewWeek sx={{ fontSize: 18 }} /></Tooltip></ToggleButton>
            <ToggleButton value="month"><Tooltip title="Mes"><CalendarMonth sx={{ fontSize: 18 }} /></Tooltip></ToggleButton>
            <ToggleButton value="agenda"><Tooltip title="Lista"><ViewAgenda sx={{ fontSize: 18 }} /></Tooltip></ToggleButton>
          </ToggleButtonGroup>

          {vista === 'day' && (
            <TextField type="date" size="small" value={ymd}
              onChange={e => { const [y, m, d] = e.target.value.split('-'); setFecha(new Date(+y, +m - 1, +d)); }}
              sx={{ width: { xs: 140, sm: 150 } }} />
          )}

          {esAdmin && trabajadores.length > 0 && (
            <TextField select size="small" label="Trabajador" value={filtroTrabajador}
              onChange={e => setFiltroTrabajador(e.target.value)}
              sx={{ minWidth: { xs: '100%', sm: 180 }, flex: { xs: '1 1 100%', sm: '0 0 auto' } }}
              InputProps={{ startAdornment: <InputAdornment position="start"><Engineering sx={{ fontSize: 17, color: TEAL }} /></InputAdornment> }}>
              <MenuItem value="">Todos</MenuItem>
              {trabajadores.map(t => (
                <MenuItem key={t.id} value={t.id}>{t.nombre_completo || t.username}</MenuItem>
              ))}
            </TextField>
          )}
        </Box>
      </Paper>

      {/* Stats */}
      {!loading && citas.length > 0 && (
        <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap', gap: 1 }}>
          <Chip label={`${stats.activos} activas`} sx={{ bgcolor: `${TEAL}1A`, color: TEAL_DARK, fontWeight: 700 }} />
          {stats.pendientes > 0 && <Chip size="small" label={`${stats.pendientes} pendientes`} sx={estadoChipSx(ESTADOS.pendiente)} />}
          {stats.completadas > 0 && <Chip size="small" label={`${stats.completadas} completadas`} sx={estadoChipSx(ESTADOS.completada)} />}
        </Stack>
      )}

      {/* Contenido principal */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress sx={{ color: TEAL }} />
        </Box>
      ) : vista === 'day' ? (
        /* ── Vista Día: lista detallada ── */
        citasOrdenadas.length === 0 ? (
          <Paper sx={{ p: 6, textAlign: 'center', borderRadius: 3, border: '1px dashed', borderColor: 'divider' }}>
            <EventBusy sx={{ fontSize: 56, color: 'text.disabled', mb: 1 }} />
            <Typography sx={{ fontWeight: 700, color: 'text.secondary' }}>Sin citas para este día</Typography>
            <Typography sx={{ fontSize: 13, color: 'text.disabled', mb: 2.5 }}>
              Agenda una nueva cita con el botón inferior.
            </Typography>
            <Button variant="contained" disableElevation startIcon={<Add />}
              onClick={() => { setEditing(null); setNuevaCitaFecha(fecha); setDialogOpen(true); }}
              sx={{ bgcolor: TEAL, '&:hover': { bgcolor: TEAL_DARK } }}>
              Nueva cita
            </Button>
          </Paper>
        ) : (
          <Stack spacing={1.2}>
            {citasOrdenadas.map(cita => <CitaCard key={cita.id} cita={cita}
              onMenu={(e, c) => { setMenuAnchor(e.currentTarget); setMenuCita(c); }}
              onCobrar={setCobrarCitaObj} />)}
          </Stack>
        )
      ) : (
        /* ── Vistas Semana / Mes / Agenda: react-big-calendar ── */
        <Box sx={{
          // En móvil, semana y mes hacen scroll horizontal para no cortar info.
          overflowX: { xs: (vista === 'week' || vista === 'month') ? 'auto' : 'visible', sm: 'visible' },
          WebkitOverflowScrolling: 'touch',
          mx: { xs: -0.5, sm: 0 },
        }}>
        <Box className={isDark ? 'dark-mode' : ''}
          sx={{
            height: vista === 'month' ? 680 : vista === 'agenda' ? 'auto' : 620,
            minHeight: vista === 'agenda' ? 300 : undefined,
            minWidth: { xs: (vista === 'week' || vista === 'month') ? 680 : 'auto', sm: 'auto' },
            '& .rbc-calendar': {
              background: theme.palette.background.paper,
              color: theme.palette.text.primary,
            },
            '& .rbc-header': { color: theme.palette.text.secondary },
            '& .rbc-time-slot': { color: theme.palette.text.disabled },
            '& .rbc-date-cell': { color: theme.palette.text.primary },
            '& .rbc-off-range': { color: theme.palette.text.disabled },
            '& .rbc-show-more': { color: TEAL },
            '& .rbc-agenda-date-cell, & .rbc-agenda-time-cell': { color: theme.palette.text.secondary },
          }}>
          <Calendar
            localizer={localizer}
            events={eventos}
            date={fecha}
            onNavigate={setFecha}
            view={vista === 'agenda' ? 'agenda' : vista}
            onView={() => {}}
            toolbar={false}
            selectable
            onSelectEvent={handleSelectEvent}
            onSelectSlot={handleSelectSlot}
            eventPropGetter={estiloEvento}
            messages={messages}
            culture="es"
            formats={{
              dayHeaderFormat: (date) => dayjs(date).format('dddd D'),
              dayRangeHeaderFormat: ({ start, end }) =>
                `${dayjs(start).format('D MMM')} – ${dayjs(end).format('D MMM YYYY')}`,
              agendaDateFormat: (date) => dayjs(date).format('ddd D MMM'),
              agendaTimeFormat: (date) => dayjs(date).format('h:mm A'),
              agendaTimeRangeFormat: ({ start, end }) =>
                `${dayjs(start).format('h:mm A')} – ${dayjs(end).format('h:mm A')}`,
              timeGutterFormat: (date) => dayjs(date).format('h A'),
            }}
            min={new Date(0, 0, 0, 6, 0)}
            max={new Date(0, 0, 0, 22, 0)}
            step={30}
            timeslots={2}
            popup
            style={{ height: '100%' }}
          />
        </Box>
        </Box>
      )}

      {/* Menú de acciones */}
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
        {menuCita && !menuCita.venta_id && !['cancelada', 'no_asistio'].includes(menuCita.estado) && (
          <MenuItem onClick={() => { setCobrarCitaObj(menuCita); setMenuAnchor(null); }}>
            <ListItemIcon><AttachMoney fontSize="small" sx={{ color: GREEN }} /></ListItemIcon>
            <ListItemText>Cobrar</ListItemText>
          </MenuItem>
        )}
        {menuCita && menuCita.cliente_telefono
          && !['completada', 'cancelada', 'no_asistio'].includes(menuCita.estado)
          && !menuCita.venta_id && (
          <MenuItem onClick={() => enviarRecordatorio(menuCita)}>
            <ListItemIcon><WhatsApp fontSize="small" sx={{ color: '#25D366' }} /></ListItemIcon>
            <ListItemText>Recordar por WhatsApp</ListItemText>
          </MenuItem>
        )}
        {menuCita && !menuCita.venta_id && !['completada', 'cancelada', 'no_asistio'].includes(menuCita.estado) && (
          <MenuItem onClick={() => { setEditing(menuCita); setNuevaCitaFecha(null); setDialogOpen(true); setMenuAnchor(null); }}>
            <ListItemIcon><Schedule fontSize="small" /></ListItemIcon>
            <ListItemText>Reprogramar / Editar</ListItemText>
          </MenuItem>
        )}
        {menuCita && ['pendiente', 'confirmada', 'en_curso'].includes(menuCita.estado) && !menuCita.venta_id && (
          <MenuItem onClick={() => handleEstado(menuCita, 'cancelada')}>
            <ListItemIcon><CancelIcon fontSize="small" sx={{ color: ESTADOS.cancelada.color }} /></ListItemIcon>
            <ListItemText>Cancelar cita</ListItemText>
          </MenuItem>
        )}
        {menuCita && ['pendiente', 'confirmada', 'en_curso'].includes(menuCita.estado) && !menuCita.venta_id && (
          <MenuItem onClick={() => handleEstado(menuCita, 'no_asistio')}>
            <ListItemIcon><EventBusy fontSize="small" sx={{ color: ESTADOS.no_asistio.color }} /></ListItemIcon>
            <ListItemText>No asistió</ListItemText>
          </MenuItem>
        )}
        {menuCita && !menuCita.venta_id && (
          <>
            <Divider />
            <MenuItem onClick={() => handleDelete(menuCita)} sx={{ color: 'error.main' }}>
              <ListItemIcon><Delete fontSize="small" sx={{ color: 'error.main' }} /></ListItemIcon>
              <ListItemText>Eliminar</ListItemText>
            </MenuItem>
          </>
        )}
      </Menu>

      {/* FAB */}
      <Fab variant={isMobile ? 'circular' : 'extended'}
        onClick={() => { setEditing(null); setNuevaCitaFecha(fecha); setDialogOpen(true); }}
        sx={{ position: 'fixed', bottom: 24, right: 24, bgcolor: TEAL, color: '#fff', '&:hover': { bgcolor: TEAL_DARK } }}>
        <Add sx={{ mr: isMobile ? 0 : 1 }} />
        {!isMobile && 'Nueva cita'}
      </Fab>

      {/* Diálogos */}
      {dialogOpen && (
        <CitaDialog open={dialogOpen} onClose={() => setDialogOpen(false)}
          editing={editing}
          fechaDefault={nuevaCitaFecha || fecha}
          horaDefault={nuevaCitaFecha}
          onSaved={handleSaved} />
      )}
      {cobrarCitaObj && (
        <CobrarDialog open cita={cobrarCitaObj}
          onClose={() => setCobrarCitaObj(null)}
          onSaved={handleSaved} />
      )}
    </Box>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Tarjeta de cita (vista día)
// ════════════════════════════════════════════════════════════════════════════
function CitaCard({ cita, onMenu, onCobrar }) {
  const est = ESTADOS[cita.estado] || ESTADOS.pendiente;
  const cancelada = ['cancelada', 'no_asistio'].includes(cita.estado);
  const cobrada = Boolean(cita.venta_id);
  return (
    <Paper elevation={0} sx={{
      p: { xs: 1.5, sm: 2 }, borderRadius: 3, border: '1px solid', borderColor: 'divider',
      borderLeft: `4px solid ${est.color}`, opacity: cancelada ? 0.6 : 1,
      display: 'flex', alignItems: 'flex-start', gap: { xs: 1.25, sm: 2 },
    }}>
      {/* Hora */}
      <Box sx={{ textAlign: 'center', minWidth: { xs: 50, sm: 62 }, flexShrink: 0, pt: 0.2 }}>
        <Typography sx={{ fontWeight: 800, fontSize: { xs: 13.5, sm: 14.5 }, color: TEAL_DARK, lineHeight: 1.1 }}>
          {fmtHora(cita.fecha_inicio)}
        </Typography>
        <Typography sx={{ fontSize: 11, color: 'text.disabled' }}>{fmtHora(cita.fecha_fin)}</Typography>
      </Box>
      <Divider orientation="vertical" flexItem />

      {/* Detalle */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, flexWrap: 'wrap' }}>
          <Typography sx={{ fontWeight: 700, fontSize: { xs: 14, sm: 14.5 }, minWidth: 0, flexShrink: 1 }} noWrap>
            {cita.producto_nombre}
          </Typography>
          {cita.producto_precio != null && (
            <Typography sx={{ fontSize: 12, color: GREEN, fontWeight: 700, flexShrink: 0 }}>{fmtCOP(cita.producto_precio)}</Typography>
          )}
        </Box>
        <Stack direction="row" spacing={1.5} sx={{ mt: 0.3, flexWrap: 'wrap', rowGap: 0.2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4, minWidth: 0 }}>
            <Person sx={{ fontSize: 14, color: 'text.disabled', flexShrink: 0 }} />
            <Typography sx={{ fontSize: 12, color: 'text.secondary' }} noWrap>{cita.cliente_display || 'Sin cliente'}</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4, minWidth: 0 }}>
            <Engineering sx={{ fontSize: 14, color: 'text.disabled', flexShrink: 0 }} />
            <Typography sx={{ fontSize: 12, color: 'text.secondary' }} noWrap>{cita.trabajador_nombre}</Typography>
          </Box>
        </Stack>
        {/* Estado + cobrada: dentro del detalle, hacen wrap en móvil */}
        <Stack direction="row" spacing={0.75} sx={{ mt: 0.75, flexWrap: 'wrap', rowGap: 0.5 }}>
          <Chip label={est.label} size="small" sx={estadoChipSx(est)} />
          {cobrada && (
            <Chip size="small" label="Cobrada" icon={<AttachMoney sx={{ fontSize: 13 }} />}
              sx={{ bgcolor: '#DCFCE7', color: GREEN, fontWeight: 700, height: 20, fontSize: 11 }} />
          )}
          {!cobrada && !cancelada && (
            <Button size="small" variant="outlined" startIcon={<AttachMoney sx={{ fontSize: 15 }} />}
              onClick={() => onCobrar(cita)}
              sx={{ fontSize: 11, py: 0.1, px: 1, minHeight: 24, color: GREEN, borderColor: `${GREEN}66`,
                '&:hover': { bgcolor: '#DCFCE7', borderColor: GREEN } }}>
              Cobrar
            </Button>
          )}
        </Stack>
      </Box>

      {/* Acciones a la derecha: solo ⋮ (+ ver venta si cobrada) */}
      <Stack direction="row" spacing={0} alignItems="center" sx={{ flexShrink: 0 }}>
        {cobrada && (
          <Tooltip title="Ver venta generada">
            <IconButton size="small" onClick={() => window.open(`/ventas`, '_blank')}>
              <OpenInNew sx={{ fontSize: 16, color: GREEN }} />
            </IconButton>
          </Tooltip>
        )}
        <IconButton size="small" onClick={(e) => onMenu(e, cita)}><MoreVert /></IconButton>
      </Stack>
    </Paper>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Dialog de cobro
// ════════════════════════════════════════════════════════════════════════════
function CobrarDialog({ open, cita, onClose, onSaved }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const [metodo, setMetodo]       = useState('Efectivo');
  const [precio, setPrecio]       = useState(cita.producto_precio || '');
  const [solicita_fe, setSolicitaFe] = useState(false);
  const [cedula_fe, setCedulaFe]  = useState('');
  const [saving, setSaving]       = useState(false);

  const total = parseFloat(precio) || 0;
  const greenBg     = isDark ? 'rgba(16,185,129,0.12)' : '#F0FDF4';
  const greenBorder = isDark ? 'rgba(134,239,172,0.3)'  : '#86EFAC';
  const necesitaCedula = solicita_fe && !cita.cliente_id;

  const handleCobrar = async () => {
    if (!total) { toast.error('Ingresa un precio válido.'); return; }
    if (solicita_fe && necesitaCedula && !cedula_fe.trim()) {
      toast.error('Ingresa el número de cédula o NIT del cliente para emitir la factura electrónica.');
      return;
    }
    setSaving(true);
    try {
      const payload = { metodo_pago: metodo, precio_unitario: total, solicita_fe };
      if (solicita_fe && cedula_fe.trim()) payload.cedula_fe = cedula_fe.trim();
      await cobrarCita(cita.id, payload);
      toast.success(`✅ Venta registrada por $${total.toLocaleString('es-CO')}`);
      onSaved();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'No se pudo registrar la venta.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.2, fontWeight: 800 }}>
        <Avatar sx={{ bgcolor: GREEN, width: 34, height: 34 }}><AttachMoney sx={{ fontSize: 20 }} /></Avatar>
        Cobrar cita
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ mt: 0.5 }}>
          <Box sx={{ p: 1.5, bgcolor: greenBg, borderRadius: 2, border: `1px solid ${greenBorder}` }}>
            <Typography sx={{ fontWeight: 700, fontSize: 15 }}>{cita.producto_nombre}</Typography>
            <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>
              Cliente: {cita.cliente_display || 'Sin cliente'} · Trabajador: {cita.trabajador_nombre}
            </Typography>
          </Box>
          <TextField fullWidth size="small" label="Precio / Total a cobrar"
            type="number" value={precio} onChange={e => setPrecio(e.target.value)}
            InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }} />
          <TextField select fullWidth size="small" label="Método de pago"
            value={metodo} onChange={e => setMetodo(e.target.value)}>
            {METODOS_PAGO.map(m => <MenuItem key={m} value={m}>{m}</MenuItem>)}
          </TextField>
          <FormControlLabel
            control={<Checkbox size="small" checked={solicita_fe}
              onChange={e => { setSolicitaFe(e.target.checked); if (!e.target.checked) setCedulaFe(''); }}
              sx={{ color: GREEN, '&.Mui-checked': { color: GREEN } }} />}
            label={<Typography sx={{ fontSize: 13 }}>Emitir Factura Electrónica (DIAN)</Typography>}
          />
          {necesitaCedula && (
            <TextField fullWidth size="small"
              label="Cédula o NIT del cliente (requerido para FE)"
              value={cedula_fe} onChange={e => setCedulaFe(e.target.value)}
              helperText="El cliente se registrará en el sistema con este documento."
              autoFocus />
          )}
          {total > 0 && (
            <Paper sx={{ p: 1.5, bgcolor: greenBg, border: `1px solid ${greenBorder}`, borderRadius: 2, textAlign: 'right' }}>
              <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>Total a registrar</Typography>
              <Typography sx={{ fontSize: 22, fontWeight: 800, color: GREEN }}>
                ${total.toLocaleString('es-CO')}
              </Typography>
            </Paper>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} color="inherit">Cancelar</Button>
        <Button variant="contained" disableElevation onClick={handleCobrar}
          disabled={saving || !total || (necesitaCedula && !cedula_fe.trim())}
          startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <CheckCircle />}
          sx={{ bgcolor: GREEN, '&:hover': { bgcolor: '#15803D' } }}>
          Registrar venta
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Dialog de creación / edición de cita
// ════════════════════════════════════════════════════════════════════════════
function CitaDialog({ open, onClose, editing, fechaDefault, horaDefault, onSaved }) {
  const isEdit = Boolean(editing);
  const [servicios, setServicios] = useState([]);
  const [clientes, setClientes]   = useState([]);
  const [loadingMeta, setLoadingMeta] = useState(true);

  const [productoId, setProductoId] = useState(editing?.producto_id || '');
  const [fecha, setFecha]   = useState(toYMD(editing ? new Date(editing.fecha_inicio) : (fechaDefault || new Date())));
  const [franjas, setFranjas]     = useState([]);
  const [loadingFranjas, setLoadingFranjas] = useState(false);
  const [slot, setSlot]           = useState(null);
  const [trabajadorId, setTrabajadorId] = useState(editing?.user_id || null);

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
        const clis = (cliRes.data || []).filter(c => c.es_cliente !== false);
        setClientes(clis);
        if (editing?.cliente_id) {
          const c = clis.find(x => x.id === editing.cliente_id);
          if (c) setClienteSel(c);
        }
      } catch {
        toast.error('Error al cargar datos.');
      } finally {
        setLoadingMeta(false);
      }
    })();
  }, [editing]);

  const cargarFranjas = useCallback(async () => {
    if (!productoId || !fecha) { setFranjas([]); return; }
    setLoadingFranjas(true);
    setSlot(null);
    setTrabajadorId(null);
    try {
      const { data } = await fetchDisponibilidad(productoId, fecha);
      const fs = data.franjas || [];
      setFranjas(fs);
      // Preseleccionar franja más cercana a la hora del click en calendario
      if (horaDefault && fs.length > 0) {
        const clickH = horaDefault.getHours() * 60 + horaDefault.getMinutes();
        const mejor = fs.reduce((prev, cur) => {
          const ph = new Date(prev.inicio).getHours() * 60 + new Date(prev.inicio).getMinutes();
          const ch = new Date(cur.inicio).getHours() * 60 + new Date(cur.inicio).getMinutes();
          return Math.abs(ch - clickH) < Math.abs(ph - clickH) ? cur : prev;
        });
        setSlot(mejor);
        setTrabajadorId(mejor.user_id);
      }
    } catch {
      setFranjas([]);
    } finally {
      setLoadingFranjas(false);
    }
  }, [productoId, fecha, horaDefault]);

  useEffect(() => { cargarFranjas(); }, [cargarFranjas]);

  const servicioActual = servicios.find(s => s.id === productoId);
  const trabajadoresServicio = servicioActual?.trabajadores || [];

  const handleGuardar = async () => {
    if (!productoId) return toast.error('Selecciona un servicio.');
    const uid = slot?.user_id || trabajadorId;
    if (!uid) return toast.error('Selecciona un horario o un trabajador.');
    if (!slot && !editing) return toast.error('Selecciona una franja horaria.');

    setSaving(true);
    const payload = {
      producto_id: productoId,
      user_id: uid,
      cliente_id: clienteSel?.id || null,
      fecha_inicio: slot?.inicio || editing?.fecha_inicio,
      cliente_nombre: clienteSel ? null : nombre.trim() || null,
      cliente_telefono: clienteSel ? null : telefono.trim() || null,
      cliente_email: clienteSel ? null : email.trim() || null,
      notas: notas.trim() || null,
    };
    try {
      let saved;
      if (isEdit) {
        ({ data: saved } = await updateCita(editing.id, payload));
        toast.success('Cita actualizada.');
      } else {
        ({ data: saved } = await createCita(payload));
        toast.success('Cita agendada.');
      }
      onSaved(saved);
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'No se pudo guardar la cita.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
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
            <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>Habilita servicios en <b>Configurar</b>.</Typography>
          </Box>
        ) : (
          <Stack spacing={2.2} sx={{ mt: 0.5 }}>
            <TextField select fullWidth label="Servicio" value={productoId}
              onChange={e => setProductoId(e.target.value)} size="small">
              {servicios.map(s => (
                <MenuItem key={s.id} value={s.id}>
                  {s.nombre} · {s.duracion_minutos || 30} min
                  {s.precio != null ? ` · $${Number(s.precio).toLocaleString('es-CO')}` : ''}
                </MenuItem>
              ))}
            </TextField>
            <TextField type="date" fullWidth label="Fecha" value={fecha}
              onChange={e => setFecha(e.target.value)} size="small"
              InputLabelProps={{ shrink: true }} />

            <Box>
              <Typography sx={{ fontSize: 13, fontWeight: 700, mb: 1, display: 'flex', alignItems: 'center', gap: 0.6 }}>
                <AccessTime sx={{ fontSize: 17, color: TEAL }} /> Horarios disponibles
              </Typography>
              {!productoId ? (
                <Typography sx={{ fontSize: 13, color: 'text.disabled' }}>Selecciona un servicio primero.</Typography>
              ) : loadingFranjas ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                  <CircularProgress size={22} sx={{ color: TEAL }} />
                </Box>
              ) : franjas.length === 0 ? (
                <Paper variant="outlined" sx={{ p: 2, textAlign: 'center', borderRadius: 2, borderStyle: 'dashed' }}>
                  <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>
                    No hay horarios disponibles. Prueba otra fecha.
                  </Typography>
                </Paper>
              ) : (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, maxHeight: 160, overflowY: 'auto', p: 0.5 }}>
                  {franjas.map((f, i) => {
                    const sel = slot && slot.inicio === f.inicio && slot.user_id === f.user_id;
                    return (
                      <Tooltip key={i} title={`Atiende: ${f.trabajador_nombre}`} arrow>
                        <Chip label={fmtHora(f.inicio)} onClick={() => { setSlot(f); setTrabajadorId(f.user_id); }}
                          sx={{
                            fontWeight: 700, cursor: 'pointer',
                            bgcolor: sel ? TEAL : `${TEAL}12`, color: sel ? '#fff' : TEAL_DARK,
                            border: `1px solid ${sel ? TEAL : `${TEAL}33`}`,
                            '&:hover': { bgcolor: sel ? TEAL_DARK : `${TEAL}22` },
                          }} />
                      </Tooltip>
                    );
                  })}
                </Box>
              )}
            </Box>

            {trabajadoresServicio.length > 0 && (
              <TextField select fullWidth size="small" label="Trabajador asignado"
                value={slot?.user_id || trabajadorId || ''}
                onChange={e => setTrabajadorId(e.target.value)}
                helperText="El admin puede cambiar el trabajador manualmente.">
                {trabajadoresServicio.map(t => (
                  <MenuItem key={t.id} value={t.id}>{t.nombre_completo || t.username}</MenuItem>
                ))}
              </TextField>
            )}

            {slot && (
              <Typography sx={{ fontSize: 12.5, color: TEAL_DARK, fontWeight: 600 }}>
                ✓ {fmtHora(slot.inicio)} — {slot.trabajador_nombre}
              </Typography>
            )}

            <Divider />

            <Autocomplete options={clientes} getOptionLabel={(o) => o.nombre || ''}
              value={clienteSel} onChange={(e, v) => setClienteSel(v)}
              isOptionEqualToValue={(o, v) => o.id === v.id}
              renderInput={(params) => (
                <TextField {...params} label="Cliente registrado (opcional)" size="small" placeholder="Buscar cliente…" />
              )} />
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
