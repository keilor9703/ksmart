// ═══════════════════════════════════════════════════════════════════════════
// ParqueaderoVehiculos.jsx
// Listado, búsqueda y edición de vehículos registrados en el parqueadero.
// El alta de nuevos vehículos se hace desde "Buscar placa" (más natural).
// ═══════════════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Paper, Typography, TextField, InputAdornment, Button, Stack, Chip,
  Avatar, IconButton, Tooltip, CircularProgress, Alert, Skeleton,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TableSortLabel, TablePagination,
  Dialog, DialogTitle, DialogContent, DialogActions, Menu, MenuItem,
  Grid, useMediaQuery, useTheme, Autocomplete
} from '@mui/material';
import {
  Search, DirectionsCar, MoreVert, Edit, Delete, Add,
  Person, Phone, Refresh, History, Visibility, FileDownload
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import apiClient from '../../api';
import { toast } from 'react-toastify';
import { ParqueaderoVehiculoDialog } from './ParqueaderoVehiculoDialog';
import DialogoDarBaja from '../inventory/DialogoDarBaja';
import { BRAND_OPTIONS, getModelOptions } from './vehicleBrands';
import HelpGuideTopBar from '../../components/onboarding/HelpGuideTopBar';

const ACCENT = '#0891B2';

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
  const [sortCol, setSortCol]         = useState('placa');
  const [sortDir, setSortDir]         = useState('asc');
  const [page, setPage]               = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(15);
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

  const handleExportCSV = () => {
    if (!vehiculosSorted.length) return;
    const rows = [
      ['#', 'Placa', 'Propietario', 'Cédula', 'Teléfono', 'Marca', 'Modelo', 'Color', 'Estado'],
      ...vehiculosSorted.map((v, i) => [
        i + 1, v.placa || '', v.cliente_nombre || '', v.cliente_cedula || '',
        v.cliente_telefono || '', v.marca || '', v.modelo || '', v.color || '',
        v.is_active ? 'Activo' : 'Inactivo',
      ]),
    ];
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a'); a.href = url; a.download = 'vehiculos-parqueadero.csv';
    a.click(); URL.revokeObjectURL(url);
  };

  useEffect(() => {
    const t = setTimeout(cargar, 300);   // debounce
    return () => clearTimeout(t);
  }, [cargar]);

  const vehiculosSorted = React.useMemo(() => {
    const list = [...vehiculos];
    list.sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      switch (sortCol) {
        case 'propietario': return dir * (a.cliente_nombre || '').localeCompare(b.cliente_nombre || '');
        case 'vehiculo':    return dir * (a.marca || '').localeCompare(b.marca || '');
        default:            return dir * (a.placa || '').localeCompare(b.placa || '');
      }
    });
    return list;
  }, [vehiculos, sortCol, sortDir]);

  const vehiculosPaginados = React.useMemo(() =>
    vehiculosSorted.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage),
    [vehiculosSorted, page, rowsPerPage]
  );

  // ── Eliminar ────────────────────────────────────────────────────────────
  // const handleEliminar = async () => {
  //   if (!confirmDel) return;
  //   try {
  //     await apiClient.delete(`/parqueadero/vehiculos/${confirmDel.id}`);
  //     toast.success(`Vehículo ${confirmDel.placa} dado de baja.`);
  //     setConfirmDel(null);
  //     cargar();
  //   } catch (err) {
  //     const status = err.response?.status;
  //     if (status === 403) {
  //       toast.error('Solo el administrador puede dar de baja vehículos.');
  //     } else {
  //       toast.error(err.response?.data?.detail || 'Error al eliminar.');
  //     }
  //   }
  // };

  const SortTh = ({ col, children, align = 'left' }) => (
    <TableCell align={align} sx={{ fontWeight: 800, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>
      <TableSortLabel
        active={sortCol === col}
        direction={sortCol === col ? sortDir : 'asc'}
        onClick={() => {
          setSortDir(prev => col === sortCol ? (prev === 'asc' ? 'desc' : 'asc') : 'asc');
          setSortCol(col);
          setPage(0);
        }}
      >
        {children}
      </TableSortLabel>
    </TableCell>
  );

  return (
    <Box sx={{ p: { xs: 1, md: 2 }, maxWidth: 1400, mx: 'auto' }}>

      {/* ─── Encabezado ─────────────────────────────────────────── */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2, flexWrap: 'wrap', gap: 1 }}>
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <Box sx={{
            width: 44, height: 44, borderRadius: 2,
            background: `linear-gradient(135deg, ${ACCENT} 0%, #22D3EE 100%)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <DirectionsCar sx={{ color: 'white' }} />
          </Box>
          <Box>
            <Typography sx={{ fontSize: 20, fontWeight: 800 }}>
              Vehículos registrados
            </Typography>
            <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
              {vehiculos.length} vehículo{vehiculos.length !== 1 ? 's' : ''} {soloActivos ? 'activos' : 'en total'}
            </Typography>
          </Box>
          <HelpGuideTopBar
            moduleName="Vehículos"
            moduleColor={ACCENT}
            steps={[
              { title: 'Registra vehículos frecuentes', description: 'Agrega los vehículos de clientes habituales con placa, tipo y datos del propietario para agilizar su ingreso.' },
              { title: 'Busca y filtra', description: 'Usa la barra de búsqueda para encontrar vehículos por placa, propietario o tipo. Puedes filtrar solo activos.' },
              { title: 'Edita información', description: 'Haz clic en el ícono de edición para actualizar datos del vehículo o del propietario.' },
              { title: 'Gestiona el estado', description: 'Activa o desactiva vehículos según si tienen suscripción vigente o no.' },
            ]}
            faqItems={[
              { q: '¿Cuál es la diferencia entre activo e inactivo?', a: 'Activo = vehículo con suscripción vigente o de uso frecuente. Inactivo = no usa el parqueadero actualmente pero el registro se conserva.' },
              { q: '¿Cómo registro un vehículo nuevo?', a: 'También puedes registrarlo desde "Buscar Placa" cuando ingresa por primera vez. Es la forma más rápida.' },
              { q: '¿Puedo eliminar un vehículo?', a: 'Solo si no tiene historial de pagos. Si ya tiene registros, desactívalo en lugar de eliminarlo.' },
              { q: '¿Cómo veo el historial de un vehículo?', a: 'Haz clic en el ícono de detalle del vehículo para ver sus entradas, salidas y pagos anteriores.' },
            ]}
          />
        </Stack>
        <Button
          variant="contained" startIcon={<Add />}
          onClick={() => setDlgNuevo(true)}
          sx={{ bgcolor: ACCENT, '&:hover': { bgcolor: '#e6561c' }, fontWeight: 700, borderRadius: 2 }}
        >
          Nuevo vehículo
        </Button>
      </Stack>

      {/* ─── Buscador y filtros ─────────────────────────────────── */}
      <Paper sx={{ p: 1.5, mb: 2, borderRadius: 3 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
          <TextField
            fullWidth size="small"
            placeholder="Buscar por placa, nombre o cédula…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
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
            onClick={() => { setSoloActivos(!soloActivos); setPage(0); }}
            sx={{
              minWidth: 160, fontWeight: 700,
              ...(soloActivos && { bgcolor: ACCENT, '&:hover': { bgcolor: '#e6561c' } }),
            }}
          >
            {soloActivos ? '✓ Solo activos' : 'Mostrar todos'}
          </Button>
          <Tooltip title="Actualizar">
            <IconButton onClick={cargar} sx={{ border: '1px solid', borderColor: 'divider' }}>
              <Refresh />
            </IconButton>
          </Tooltip>
          <Button size="small" variant="outlined" startIcon={<FileDownload />}
            onClick={handleExportCSV} disabled={!vehiculosSorted.length}
            sx={{ borderRadius: 2, fontWeight: 600, whiteSpace: 'nowrap' }}>
            CSV
          </Button>
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
          <DirectionsCar sx={{ fontSize: 64, color: 'text.disabled', mb: 1 }} />
          <Typography sx={{ fontSize: 16, fontWeight: 700, mb: 0.5 }}>
            {search ? 'No se encontraron vehículos con ese criterio' : 'Aún no hay vehículos registrados'}
          </Typography>
          <Typography sx={{ fontSize: 13, color: 'text.secondary', mb: 2 }}>
            {search
              ? 'Prueba con otra búsqueda o limpia el filtro'
              : 'Empieza registrando el primer vehículo del parqueadero'}
          </Typography>
          {!search && (
            <Button
              variant="contained" startIcon={<Add />}
              onClick={() => setDlgNuevo(true)}
              sx={{ bgcolor: ACCENT, '&:hover': { bgcolor: '#e6561c' }, fontWeight: 700 }}
            >
              Registrar primer vehículo
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
        <>
          <TableContainer component={Paper} sx={{ borderRadius: 3 }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: 'background.default' }}>
                  <SortTh col="placa">Placa</SortTh>
                  <SortTh col="propietario">Propietario</SortTh>
                  <TableCell sx={{ fontWeight: 800, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>Contacto</TableCell>
                  <SortTh col="vehiculo">Vehículo</SortTh>
                  <TableCell sx={{ fontWeight: 800, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>Estado</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 800, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>Acciones</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {vehiculosPaginados.map(v => (
                  <VehiculoRow
                    key={v.id} veh={v}
                    onVer={() => navigate(`/parqueadero/buscar?placa=${v.placa}`)}
                    onHistorial={() => setDlgHistorial(v)}
                    onEditar={() => setDlgEditar(v)}
                    onEliminar={() => setConfirmDel(v)}
                  />
                ))}
                {vehiculosPaginados.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
                      Sin resultados
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            component="div"
            count={vehiculosSorted.length}
            page={page}
            onPageChange={(_, p) => setPage(p)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={e => { setRowsPerPage(parseInt(e.target.value)); setPage(0); }}
            rowsPerPageOptions={[10, 15, 25, 50]}
            labelRowsPerPage="Filas:"
            labelDisplayedRows={({ from, to, count }) => `${from}-${to} de ${count}`}
          />
        </>
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

      {/* <Dialog open={!!confirmDel} onClose={() => setConfirmDel(null)} maxWidth="xs" fullWidth>
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
      </Dialog> */}

       {confirmDel && (
          <DialogoDarBaja
            open={!!confirmDel}
            vehiculo={confirmDel}
            onClose={() => setConfirmDel(null)}
            onSuccess={() => { setConfirmDel(null); cargar(); }}
          />
        )}



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
// Diálogo: editar datos de vehículo
// ═══════════════════════════════════════════════════════════════════════════

function EditarVehiculoDialog({ open, onClose, veh, onSuccess }) {
  const [data, setData] = useState({
    placa: veh.placa,
    marca: veh.marca || '',
    modelo: veh.modelo || '',
    color: veh.color || '',
    observaciones: veh.observaciones || '',
  });
  const [marcaInput, setMarcaInput]   = useState(veh.marca || '');
  const [modeloInput, setModeloInput] = useState(veh.modelo || '');
  const [loading, setLoading] = useState(false);

  const modelOptions = getModelOptions(data.marca);

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
      <DialogTitle sx={{ fontWeight: 800 }}>Editar vehículo</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={1.5} sx={{ mt: 0.5 }}>
          <TextField
            fullWidth size="small" label="Placa"
            value={data.placa}
            onChange={(e) => setData({ ...data, placa: e.target.value.toUpperCase().replace(/[\s-]/g, '') })}
            inputProps={{ style: { fontFamily: 'monospace', fontWeight: 700, letterSpacing: 2 } }}
          />
          <Stack direction="row" spacing={1}>
            <Autocomplete
              sx={{ flex: 1 }}
              size="small"
              freeSolo
              options={BRAND_OPTIONS}
              value={data.marca}
              inputValue={marcaInput}
              onInputChange={(_, val) => setMarcaInput(val)}
              onChange={(_, val) => {
                const v = val || '';
                setData({ ...data, marca: v, modelo: '' });
                setMarcaInput(v);
                setModeloInput('');
              }}
              renderInput={(params) => <TextField {...params} label="Marca" />}
            />
            <Autocomplete
              sx={{ flex: 1 }}
              size="small"
              freeSolo
              options={modelOptions}
              value={data.modelo}
              inputValue={modeloInput}
              onInputChange={(_, val) => setModeloInput(val)}
              onChange={(_, val) => {
                const v = val || '';
                setData({ ...data, modelo: v });
                setModeloInput(v);
              }}
              noOptionsText={data.marca ? 'Sin modelos para esta marca' : 'Selecciona una marca primero'}
              renderInput={(params) => <TextField {...params} label="Modelo" />}
            />
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
