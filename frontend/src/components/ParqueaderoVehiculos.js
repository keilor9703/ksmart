// ═══════════════════════════════════════════════════════════════════════════
// ParqueaderoVehiculos.jsx
// Listado, búsqueda y edición de motos registradas en el parqueadero.
// El alta de nuevas motos se hace desde "Buscar placa" (más natural).
// ═══════════════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Paper, Typography, TextField, InputAdornment, Button, Stack, Chip,
  Avatar, IconButton, Tooltip, CircularProgress, Alert, Skeleton,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Dialog, DialogTitle, DialogContent, DialogActions, Menu, MenuItem,
  Grid, useMediaQuery, useTheme
} from '@mui/material';
import {
  Search, TwoWheeler, MoreVert, Edit, Delete, Add,
  Person, Phone, Refresh, History, Visibility
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import apiClient from '../api';
import { toast } from 'react-toastify';
import { ParqueaderoVehiculoDialog } from './ParqueaderoVehiculoDialog';

const ACCENT = '#FF6020';

export default function ParqueaderoVehiculos() {
  const [vehiculos, setVehiculos]     = useState([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);
  const [search, setSearch]           = useState('');
  const [soloActivos, setSoloActivos] = useState(true);
  const [dlgNuevo, setDlgNuevo]       = useState(false);
  const [dlgEditar, setDlgEditar]     = useState(null);
  const [dlgHistorial, setDlgHistorial] = useState(null);
  const [confirmDel, setConfirmDel]   = useState(null);
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  // ── Cargar vehículos ────────────────────────────────────────────────────
  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.append('search', search.trim());
      params.append('solo_activos', soloActivos);
      const { data } = await apiClient.get(`/parqueadero/vehiculos?${params}`);
      setVehiculos(data);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al cargar.');
    } finally {
      setLoading(false);
    }
  }, [search, soloActivos]);

  useEffect(() => {
    const t = setTimeout(cargar, 300);   // debounce
    return () => clearTimeout(t);
  }, [cargar]);

  // ── Eliminar ────────────────────────────────────────────────────────────
  const handleEliminar = async () => {
    if (!confirmDel) return;
    try {
      await apiClient.delete(`/parqueadero/vehiculos/${confirmDel.id}`);
      toast.success(`Vehículo ${confirmDel.placa} dado de baja.`);
      setConfirmDel(null);
      cargar();
    } catch (err) {
      const status = err.response?.status;
      if (status === 403) {
        toast.error('Solo el administrador puede dar de baja vehículos.');
      } else {
        toast.error(err.response?.data?.detail || 'Error al eliminar.');
      }
    }
  };

  return (
    <Box sx={{ p: { xs: 1, md: 2 }, maxWidth: 1400, mx: 'auto' }}>

      {/* ─── Encabezado ─────────────────────────────────────────── */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2, flexWrap: 'wrap', gap: 1 }}>
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <Box sx={{
            width: 44, height: 44, borderRadius: 2,
            background: `linear-gradient(135deg, ${ACCENT} 0%, #ff9a62 100%)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <TwoWheeler sx={{ color: 'white' }} />
          </Box>
          <Box>
            <Typography sx={{ fontSize: 20, fontWeight: 800, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              Vehículos registrados
            </Typography>
            <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
              {vehiculos.length} moto{vehiculos.length !== 1 ? 's' : ''} {soloActivos ? 'activas' : 'en total'}
            </Typography>
          </Box>
        </Stack>
        <Button
          variant="contained" startIcon={<Add />}
          onClick={() => setDlgNuevo(true)}
          sx={{ bgcolor: ACCENT, '&:hover': { bgcolor: '#e6561c' }, fontWeight: 700, borderRadius: 2 }}
        >
          Nueva moto
        </Button>
      </Stack>

      {/* ─── Buscador y filtros ─────────────────────────────────── */}
      <Paper sx={{ p: 1.5, mb: 2, borderRadius: 3 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
          <TextField
            fullWidth size="small"
            placeholder="Buscar por placa, nombre o cédula…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search sx={{ color: 'text.secondary' }} />
                </InputAdornment>
              ),
            }}
          />
          <Button
            variant={soloActivos ? "contained" : "outlined"}
            onClick={() => setSoloActivos(!soloActivos)}
            sx={{
              minWidth: 160, fontWeight: 700,
              ...(soloActivos && { bgcolor: ACCENT, '&:hover': { bgcolor: '#e6561c' } }),
            }}
          >
            {soloActivos ? '✓ Solo activas' : 'Mostrar todas'}
          </Button>
          <Tooltip title="Actualizar">
            <IconButton onClick={cargar} sx={{ border: '1px solid', borderColor: 'divider' }}>
              <Refresh />
            </IconButton>
          </Tooltip>
        </Stack>
      </Paper>

      {/* ─── Estados ────────────────────────────────────────────── */}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {loading ? (
        <Stack spacing={1}>
          {[1, 2, 3, 4].map(i => <Skeleton key={i} variant="rounded" height={70} />)}
        </Stack>
      ) : vehiculos.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 3 }}>
          <TwoWheeler sx={{ fontSize: 64, color: 'text.disabled', mb: 1 }} />
          <Typography sx={{ fontSize: 16, fontWeight: 700, mb: 0.5 }}>
            {search ? 'No se encontraron motos con ese criterio' : 'Aún no hay motos registradas'}
          </Typography>
          <Typography sx={{ fontSize: 13, color: 'text.secondary', mb: 2 }}>
            {search
              ? 'Prueba con otra búsqueda o limpia el filtro'
              : 'Empieza registrando la primera moto del parqueadero'}
          </Typography>
          {!search && (
            <Button
              variant="contained" startIcon={<Add />}
              onClick={() => setDlgNuevo(true)}
              sx={{ bgcolor: ACCENT, '&:hover': { bgcolor: '#e6561c' }, fontWeight: 700 }}
            >
              Registrar primera moto
            </Button>
          )}
        </Paper>
      ) : isMobile ? (
        // ─── Vista móvil: cards ────────────────────────────────
        <Stack spacing={1}>
          {vehiculos.map(v => (
            <VehiculoCard
              key={v.id} veh={v}
              onVer={() => navigate(`/parqueadero/buscar?placa=${v.placa}`)}
              onHistorial={() => setDlgHistorial(v)}
              onEditar={() => setDlgEditar(v)}
              onEliminar={() => setConfirmDel(v)}
            />
          ))}
        </Stack>
      ) : (
        // ─── Vista desktop: tabla ──────────────────────────────
        <TableContainer component={Paper} sx={{ borderRadius: 3 }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: 'background.default' }}>
                <TableCell sx={{ fontWeight: 800, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>Placa</TableCell>
                <TableCell sx={{ fontWeight: 800, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>Propietario</TableCell>
                <TableCell sx={{ fontWeight: 800, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>Contacto</TableCell>
                <TableCell sx={{ fontWeight: 800, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>Moto</TableCell>
                <TableCell sx={{ fontWeight: 800, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>Estado</TableCell>
                <TableCell align="right" sx={{ fontWeight: 800, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {vehiculos.map(v => (
                <VehiculoRow
                  key={v.id} veh={v}
                  onVer={() => navigate(`/parqueadero/buscar?placa=${v.placa}`)}
                  onHistorial={() => setDlgHistorial(v)}
                  onEditar={() => setDlgEditar(v)}
                  onEliminar={() => setConfirmDel(v)}
                />
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* ─── Diálogos ───────────────────────────────────────────── */}
      <ParqueaderoVehiculoDialog
        open={dlgNuevo}
        onClose={() => setDlgNuevo(false)}
        onSuccess={() => { setDlgNuevo(false); cargar(); }}
      />

      {dlgEditar && (
        <EditarVehiculoDialog
          open={!!dlgEditar} veh={dlgEditar}
          onClose={() => setDlgEditar(null)}
          onSuccess={() => { setDlgEditar(null); cargar(); }}
        />
      )}

      {dlgHistorial && (
        <HistorialSuscripcionesDialog
          open={!!dlgHistorial} veh={dlgHistorial}
          onClose={() => setDlgHistorial(null)}
        />
      )}

      <Dialog open={!!confirmDel} onClose={() => setConfirmDel(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>¿Dar de baja esta moto?</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: 14 }}>
            La moto <strong>{confirmDel?.placa}</strong> de <strong>{confirmDel?.cliente_nombre}</strong> se marcará como inactiva.
          </Typography>
          <Typography sx={{ fontSize: 12, color: 'text.secondary', mt: 1 }}>
            No se borra: el histórico de suscripciones y pagos se conserva. Puedes reactivarla después si vuelve.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDel(null)}>Cancelar</Button>
          <Button variant="contained" color="error" onClick={handleEliminar}>
            Dar de baja
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}


// ═══════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTES
// ═══════════════════════════════════════════════════════════════════════════

function VehiculoRow({ veh, onVer, onHistorial, onEditar, onEliminar }) {
  const [menuEl, setMenuEl] = useState(null);

  return (
    <TableRow hover sx={{ opacity: veh.is_active ? 1 : 0.5 }}>
      <TableCell>
        <Typography sx={{ fontFamily: 'monospace', fontWeight: 800, fontSize: 14, letterSpacing: 1.5 }}>
          {veh.placa}
        </Typography>
      </TableCell>
      <TableCell>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Avatar sx={{ width: 28, height: 28, fontSize: 13, bgcolor: ACCENT + '20', color: ACCENT }}>
            {(veh.cliente_nombre || '?')[0]}
          </Avatar>
          <Box>
            <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{veh.cliente_nombre || '—'}</Typography>
            {veh.cliente_cedula && (
              <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>CC {veh.cliente_cedula}</Typography>
            )}
          </Box>
        </Stack>
      </TableCell>
      <TableCell>
        {veh.cliente_telefono ? (
          <Stack direction="row" alignItems="center" spacing={0.5}>
            <Phone sx={{ fontSize: 14, color: 'text.secondary' }} />
            <Typography sx={{ fontSize: 12 }}>{veh.cliente_telefono}</Typography>
          </Stack>
        ) : (
          <Typography sx={{ fontSize: 12, color: 'text.disabled' }}>—</Typography>
        )}
      </TableCell>
      <TableCell>
        <Typography sx={{ fontSize: 12 }}>
          {[veh.marca, veh.modelo].filter(Boolean).join(' ') || '—'}
        </Typography>
        {veh.color && (
          <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{veh.color}</Typography>
        )}
      </TableCell>
      <TableCell>
        <Chip
          size="small"
          label={veh.is_active ? 'Activa' : 'Inactiva'}
          sx={{
            fontSize: 10, fontWeight: 700, height: 20,
            bgcolor: veh.is_active ? '#10B98115' : '#94A3B815',
            color:   veh.is_active ? '#065F46' : '#475569',
          }}
        />
      </TableCell>
      <TableCell align="right">
        <Tooltip title="Ver / consultar placa">
          <IconButton size="small" onClick={onVer} sx={{ color: ACCENT }}>
            <Visibility fontSize="small" />
          </IconButton>
        </Tooltip>
        <IconButton size="small" onClick={(e) => setMenuEl(e.currentTarget)}>
          <MoreVert fontSize="small" />
        </IconButton>
        <Menu
          anchorEl={menuEl} open={!!menuEl}
          onClose={() => setMenuEl(null)}
        >
          <MenuItem onClick={() => { setMenuEl(null); onHistorial(); }}>
            <History fontSize="small" sx={{ mr: 1 }} /> Historial
          </MenuItem>
          <MenuItem onClick={() => { setMenuEl(null); onEditar(); }}>
            <Edit fontSize="small" sx={{ mr: 1 }} /> Editar datos
          </MenuItem>
          {veh.is_active && (
            <MenuItem onClick={() => { setMenuEl(null); onEliminar(); }} sx={{ color: 'error.main' }}>
              <Delete fontSize="small" sx={{ mr: 1 }} /> Dar de baja
            </MenuItem>
          )}
        </Menu>
      </TableCell>
    </TableRow>
  );
}

function VehiculoCard({ veh, onVer, onHistorial, onEditar, onEliminar }) {
  const [menuEl, setMenuEl] = useState(null);

  return (
    <Paper
      sx={{
        p: 1.5, borderRadius: 2, border: '1px solid', borderColor: 'divider',
        opacity: veh.is_active ? 1 : 0.55,
      }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 1 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{
            fontFamily: 'monospace', fontWeight: 800, fontSize: 18,
            letterSpacing: 2, color: ACCENT, mb: 0.5,
          }}>
            {veh.placa}
          </Typography>
          <Typography sx={{ fontSize: 13, fontWeight: 600 }} noWrap>
            {veh.cliente_nombre || '—'}
          </Typography>
        </Box>
        <Stack direction="row" spacing={0.5}>
          <IconButton size="small" onClick={onVer} sx={{ color: ACCENT }}>
            <Visibility fontSize="small" />
          </IconButton>
          <IconButton size="small" onClick={(e) => setMenuEl(e.currentTarget)}>
            <MoreVert fontSize="small" />
          </IconButton>
          <Menu anchorEl={menuEl} open={!!menuEl} onClose={() => setMenuEl(null)}>
            <MenuItem onClick={() => { setMenuEl(null); onHistorial(); }}>
              <History fontSize="small" sx={{ mr: 1 }} /> Historial
            </MenuItem>
            <MenuItem onClick={() => { setMenuEl(null); onEditar(); }}>
              <Edit fontSize="small" sx={{ mr: 1 }} /> Editar
            </MenuItem>
            {veh.is_active && (
              <MenuItem onClick={() => { setMenuEl(null); onEliminar(); }} sx={{ color: 'error.main' }}>
                <Delete fontSize="small" sx={{ mr: 1 }} /> Dar de baja
              </MenuItem>
            )}
          </Menu>
        </Stack>
      </Stack>
      <Stack direction="row" spacing={0.5} flexWrap="wrap" gap={0.5}>
        {veh.cliente_telefono && (
          <Chip size="small" icon={<Phone />} label={veh.cliente_telefono}
            sx={{ height: 22, fontSize: 11 }} />
        )}
        {(veh.marca || veh.modelo) && (
          <Chip size="small" label={[veh.marca, veh.modelo].filter(Boolean).join(' ')}
            sx={{ height: 22, fontSize: 11 }} />
        )}
        {veh.color && (
          <Chip size="small" label={veh.color} sx={{ height: 22, fontSize: 11 }} />
        )}
        {!veh.is_active && (
          <Chip size="small" label="Inactiva" sx={{ height: 22, fontSize: 11, bgcolor: '#94A3B820' }} />
        )}
      </Stack>
    </Paper>
  );
}


// ═══════════════════════════════════════════════════════════════════════════
// Diálogo: editar datos de moto
// ═══════════════════════════════════════════════════════════════════════════

function EditarVehiculoDialog({ open, onClose, veh, onSuccess }) {
  const [data, setData] = useState({
    placa: veh.placa,
    marca: veh.marca || '',
    modelo: veh.modelo || '',
    color: veh.color || '',
    observaciones: veh.observaciones || '',
  });
  const [loading, setLoading] = useState(false);

  const handleGuardar = async () => {
    setLoading(true);
    try {
      await apiClient.put(`/parqueadero/vehiculos/${veh.id}`, data);
      toast.success('Datos actualizados.');
      onSuccess?.();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al actualizar.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 800 }}>Editar moto</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={1.5} sx={{ mt: 0.5 }}>
          <TextField
            fullWidth size="small" label="Placa"
            value={data.placa}
            onChange={(e) => setData({ ...data, placa: e.target.value.toUpperCase().replace(/[\s-]/g, '') })}
            inputProps={{ style: { fontFamily: 'monospace', fontWeight: 700, letterSpacing: 2 } }}
          />
          <Stack direction="row" spacing={1}>
            <TextField fullWidth size="small" label="Marca"
              value={data.marca} onChange={(e) => setData({ ...data, marca: e.target.value })} />
            <TextField fullWidth size="small" label="Modelo"
              value={data.modelo} onChange={(e) => setData({ ...data, modelo: e.target.value })} />
          </Stack>
          <TextField fullWidth size="small" label="Color"
            value={data.color} onChange={(e) => setData({ ...data, color: e.target.value })} />
          <TextField fullWidth size="small" multiline rows={2} label="Observaciones"
            value={data.observaciones}
            onChange={(e) => setData({ ...data, observaciones: e.target.value })} />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} disabled={loading}>Cancelar</Button>
        <Button variant="contained" onClick={handleGuardar} disabled={loading}
          startIcon={loading ? <CircularProgress size={16} color="inherit" /> : null}
          sx={{ bgcolor: ACCENT, '&:hover': { bgcolor: '#e6561c' }, fontWeight: 700 }}>
          Guardar cambios
        </Button>
      </DialogActions>
    </Dialog>
  );
}


// ═══════════════════════════════════════════════════════════════════════════
// Diálogo: histórico de suscripciones de un vehículo
// ═══════════════════════════════════════════════════════════════════════════

function HistorialSuscripcionesDialog({ open, onClose, veh }) {
  const [items, setItems]     = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open || !veh) return;
    setLoading(true);
    apiClient.get(`/parqueadero/vehiculos/${veh.id}/suscripciones`)
      .then(({ data }) => setItems(data))
      .catch(() => toast.error('Error al cargar historial.'))
      .finally(() => setLoading(false));
  }, [open, veh]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ fontWeight: 800 }}>
        Historial — {veh?.placa}
        <Typography sx={{ fontSize: 12, color: 'text.secondary', mt: 0.3 }}>
          {veh?.cliente_nombre}
        </Typography>
      </DialogTitle>
      <DialogContent dividers>
        {loading ? (
          <Box sx={{ p: 3, textAlign: 'center' }}><CircularProgress /></Box>
        ) : items.length === 0 ? (
          <Typography sx={{ p: 3, textAlign: 'center', color: 'text.secondary' }}>
            Sin suscripciones registradas.
          </Typography>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: 'background.default' }}>
                  <TableCell sx={{ fontWeight: 700, fontSize: 11 }}>FECHA</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: 11 }}>TIPO</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: 11 }}>VENCIMIENTO</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, fontSize: 11 }}>TOTAL</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, fontSize: 11 }}>PAGADO</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: 11 }}>ESTADO</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map(s => (
                  <TableRow key={s.id} hover>
                    <TableCell sx={{ fontSize: 12 }}>{fechaCorta(s.fecha_inicio)}</TableCell>
                    <TableCell>
                      <Chip size="small" label={s.tipo?.toUpperCase()}
                        sx={{ height: 18, fontSize: 9, fontWeight: 700, bgcolor: 'action.hover' }} />
                    </TableCell>
                    <TableCell sx={{ fontSize: 12 }}>{fechaCorta(s.fecha_vencimiento)}</TableCell>
                    <TableCell align="right" sx={{ fontSize: 12, fontWeight: 600 }}>
                      ${(s.monto_total || 0).toLocaleString('es-CO')}
                    </TableCell>
                    <TableCell align="right" sx={{ fontSize: 12, fontWeight: 600, color: '#10B981' }}>
                      ${(s.monto_pagado || 0).toLocaleString('es-CO')}
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={s.estado_pago === 'pagado' ? 'Pagada' :
                               s.estado_pago === 'parcial' ? 'Parcial' : 'Pendiente'}
                        sx={{
                          height: 18, fontSize: 9, fontWeight: 700,
                          bgcolor: s.estado_pago === 'pagado' ? '#10B98120' :
                                   s.estado_pago === 'parcial' ? '#F59E0B20' : '#EF444420',
                          color: s.estado_pago === 'pagado' ? '#065F46' :
                                 s.estado_pago === 'parcial' ? '#78350F' : '#7F1D1D',
                        }}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose}>Cerrar</Button>
      </DialogActions>
    </Dialog>
  );
}


function fechaCorta(fechaIso) {
  if (!fechaIso) return '—';
  const d = new Date(fechaIso);
  if (isNaN(d)) return fechaIso;
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: '2-digit' });
}
