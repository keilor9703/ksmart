import React, { useEffect, useState } from 'react';
import {
  Box, Typography, Grid, TextField, Button, MenuItem, Chip,
  Table, TableHead, TableRow, TableCell, TableBody, Stack,
  Paper, useMediaQuery, TablePagination, Collapse, Divider,
  InputAdornment, Tooltip
} from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';
import { toast } from 'react-toastify';
import { fetchMovements, createMovement, fetchLowStockAlerts } from '../api';
import apiClient from '../api';
import Autocomplete from '@mui/material/Autocomplete';
import BulkUpload from './BulkUpload';
import { TableContainer } from '@mui/material';
import {
  Warning, ExpandMore, ExpandLess, Search, Add,
  Upload, SwapVert, TrendingUp, TrendingDown, Tune
} from '@mui/icons-material';

const ACCENT = '#F59E0B';
const GREEN  = '#10B981';
const RED    = '#EF4444';
const CYAN   = '#06B6D4';

const formatDate = (d) => {
  if (!d) return '—';
  return new Date(d.endsWith('Z') ? d : d + 'Z').toLocaleString();
};

// ─── Banner stock bajo ────────────────────────────────────────────────────────
const LowStockBanner = () => {
  const [items, setItems] = useState([]);
  const theme = useTheme();

  useEffect(() => {
    fetchLowStockAlerts()
      .then(({ data }) => setItems(data || []))
      .catch(() => setItems([]));
  }, []);

  if (!items.length) return null;

  return (
    <Box sx={{
      display: 'flex', alignItems: 'flex-start', gap: 1.5,
      p: 2, mb: 2.5, borderRadius: 2,
      bgcolor: theme.palette.mode === 'dark'
        ? alpha(theme.palette.warning.main, 0.12)
        : '#FFFBEB',
      border: '1px solid #FCD34D',
    }}>
      <Warning sx={{ color: '#D97706', flexShrink: 0, mt: 0.2 }} />
      <Box>
        <Typography sx={{ fontWeight: 700, fontSize: 13, color: '#92400E', mb: 0.8 }}>
          {items.length} producto{items.length > 1 ? 's' : ''} con stock bajo el mínimo
        </Typography>
        <Box sx={{ display: 'flex', gap: 0.8, flexWrap: 'wrap' }}>
          {items.map(i => (
            <Chip
              key={i.producto_id}
              label={`${i.nombre} (${i.stock_actual}/${i.stock_minimo})`}
              size="small"
              sx={{
                bgcolor: '#FEF3C7', color: '#92400E',
                fontWeight: 600, fontSize: 11, borderRadius: 1.5,
                border: '1px solid #FCD34D',
              }}
            />
          ))}
        </Box>
      </Box>
    </Box>
  );
};

// ─── Panel colapsable ─────────────────────────────────────────────────────────
const CollapsePanel = ({ title, icon, color, open, onToggle, chip, children }) => (
  <Box sx={{
    borderRadius: 3, border: '1px solid', borderColor: 'divider',
    bgcolor: 'background.paper', overflow: 'hidden', mb: 2,
    boxShadow: open ? '0 4px 20px rgba(0,0,0,0.08)' : '0 2px 8px rgba(0,0,0,0.04)',
    transition: 'box-shadow 0.2s',
  }}>
    <Box
      onClick={onToggle}
      sx={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        px: 2.5, py: 1.8, cursor: 'pointer',
        '&:hover': { bgcolor: 'action.hover' }, transition: 'background 0.15s',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Box sx={{ width: 32, height: 32, borderRadius: 1.5, bgcolor: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', color }}>
          {icon}
        </Box>
        <Typography sx={{ fontWeight: 600, fontSize: 14 }}>{title}</Typography>
        {chip}
      </Box>
      {open ? <ExpandLess sx={{ color: 'text.secondary' }} /> : <ExpandMore sx={{ color: 'text.secondary' }} />}
    </Box>
    <Collapse in={open}>
      <Divider />
      <Box sx={{ p: { xs: 2, md: 3 } }}>{children}</Box>
    </Collapse>
  </Box>
);

// ─── Formulario de movimiento ─────────────────────────────────────────────────
const MovementForm = ({ onCreated }) => {
  const [productos, setProductos] = useState([]);
  const [productoSel, setProductoSel] = useState(null);
  const [productoInput, setProductoInput] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ tipo: 'ajuste', cantidad: '', motivo: '', referencia: '', observacion: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiClient.get('/productos/').then(r => setProductos(r.data || [])).catch(() => {});
  }, []);

  const handleChange = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const getTipoColor = (tipo) =>
    tipo === 'entrada' ? GREEN : tipo === 'salida' ? RED : ACCENT;

  const submit = async () => {
    if (!productoSel || !form.tipo || !form.cantidad || Number(form.cantidad) <= 0) {
      toast.warning('Debes completar: Producto, Tipo y Cantidad (mayor a 0).');
      return;
    }
    setSaving(true);
    try {
      await createMovement({
        producto_id: productoSel.id,
        tipo: form.tipo,
        cantidad: Number(form.cantidad),
        motivo: form.motivo || '',
        referencia: form.referencia || '',
        observacion: form.observacion || '',
      });
      toast.success('Movimiento registrado exitosamente');
      setProductoSel(null); setProductoInput('');
      setForm({ tipo: 'ajuste', cantidad: '', motivo: '', referencia: '', observacion: '' });
      setOpen(false);
      onCreated?.();
    } catch (e) {
      toast.error(e?.response?.data?.detail ?? 'No se pudo registrar el movimiento.');
    } finally { setSaving(false); }
  };

  return (
    <CollapsePanel
      title="Crear Movimiento Manual"
      icon={<SwapVert fontSize="small" />}
      color={CYAN}
      open={open}
      onToggle={() => setOpen(o => !o)}
      chip={
        <Chip label="Entrada · Salida · Ajuste" size="small"
          sx={{ bgcolor: `${CYAN}12`, color: CYAN, fontWeight: 600, fontSize: 11 }} />
      }
    >
      <Grid container spacing={2}>
        {/* Producto */}
        <Grid item xs={12} md={5}>
          <Autocomplete
            options={productos}
            value={productoSel}
            onChange={(_, v) => setProductoSel(v)}
            inputValue={productoInput}
            onInputChange={(_, v) => setProductoInput(v)}
            getOptionLabel={opt => opt ? `${opt.nombre} (ID: ${opt.id})` : ''}
            filterOptions={(opts, state) => {
              const q = (state.inputValue || '').toLowerCase().trim();
              if (!q) return opts;
              return opts.filter(o => o.nombre.toLowerCase().includes(q) || String(o.id).includes(q));
            }}
            renderInput={params => <TextField {...params} label="Producto (busca por nombre o ID)" />}
            fullWidth
          />
        </Grid>

        {/* Tipo */}
        <Grid item xs={12} md={2}>
          <TextField select label="Tipo" value={form.tipo} onChange={e => handleChange('tipo', e.target.value)} fullWidth>
            {[
              { value: 'entrada', label: '↑ Entrada', color: GREEN },
              { value: 'salida',  label: '↓ Salida',  color: RED   },
              { value: 'ajuste', label: '⟳ Ajuste',  color: ACCENT },
            ].map(({ value, label, color }) => (
              <MenuItem key={value} value={value}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: color }} />
                  {label}
                </Box>
              </MenuItem>
            ))}
          </TextField>
        </Grid>

        {/* Cantidad */}
        <Grid item xs={6} md={2}>
          <TextField
            label="Cantidad" type="number" value={form.cantidad}
            onChange={e => handleChange('cantidad', e.target.value)}
            inputProps={{ min: 0, step: 'any' }} fullWidth
          />
        </Grid>

        {/* Motivo */}
        <Grid item xs={6} md={3}>
          <TextField label="Motivo" value={form.motivo} onChange={e => handleChange('motivo', e.target.value)} fullWidth />
        </Grid>

        {/* Referencia */}
        <Grid item xs={12} md={4}>
          <TextField label="Referencia / Documento" value={form.referencia} onChange={e => handleChange('referencia', e.target.value)} fullWidth />
        </Grid>

        {/* Observación */}
        <Grid item xs={12} md={8}>
          <TextField
            label="Observación" value={form.observacion}
            onChange={e => handleChange('observacion', e.target.value)}
            fullWidth multiline minRows={2}
          />
        </Grid>

        {/* Resumen visual del movimiento antes de guardar */}
        {productoSel && form.cantidad > 0 && (
          <Grid item xs={12}>
            <Box sx={{
              p: 2, borderRadius: 2,
              bgcolor: `${getTipoColor(form.tipo)}08`,
              border: `1.5px dashed ${getTipoColor(form.tipo)}50`,
              display: 'flex', alignItems: 'center', gap: 2,
            }}>
              {form.tipo === 'entrada' ? <TrendingUp sx={{ color: getTipoColor(form.tipo) }} />
                : form.tipo === 'salida' ? <TrendingDown sx={{ color: getTipoColor(form.tipo) }} />
                : <Tune sx={{ color: getTipoColor(form.tipo) }} />}
              <Box>
                <Typography sx={{ fontWeight: 700, fontSize: 13, color: getTipoColor(form.tipo) }}>
                  {form.tipo.toUpperCase()} de {form.cantidad} {productoSel.unidad_medida || 'und'}
                </Typography>
                <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
                  Producto: {productoSel.nombre} · Stock actual: {productoSel.stock_actual ?? 0}
                </Typography>
              </Box>
            </Box>
          </Grid>
        )}
      </Grid>

      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 2.5 }}>
        <Button onClick={() => setOpen(false)} variant="outlined"
          sx={{ borderRadius: 2, fontWeight: 600, borderColor: 'divider', color: 'text.secondary' }}>
          Cancelar
        </Button>
        <Button variant="contained" onClick={submit} disabled={saving}
          sx={{
            background: `linear-gradient(135deg, ${CYAN}, #22d3ee)`,
            boxShadow: `0 4px 14px rgba(6,182,212,0.3)`,
            borderRadius: 2, fontWeight: 600,
          }}>
          {saving ? 'Guardando…' : 'Registrar Movimiento'}
        </Button>
      </Box>
    </CollapsePanel>
  );
};

// ─── Card mobile de movimiento ────────────────────────────────────────────────
const MovementCard = ({ row }) => {
  const color = row.tipo === 'entrada' ? GREEN : row.tipo === 'salida' ? RED : ACCENT;
  return (
    <Paper sx={{ p: 2.5, mb: 2, borderRadius: 3, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
        <Box>
          <Typography sx={{ fontWeight: 700, fontSize: 14 }}>
            {row.producto?.nombre ?? `#${row.producto_id}`}
          </Typography>
          <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>#{row.id} · {formatDate(row.created_at)}</Typography>
        </Box>
        <Chip
          label={row.tipo}
          size="small"
          sx={{ bgcolor: `${color}18`, color, fontWeight: 700, fontSize: 11, borderRadius: 1.5 }}
        />
      </Box>
      <Grid container spacing={1}>
        {[
          { label: 'Cantidad',   val: row.cantidad },
          { label: 'Motivo',     val: row.motivo || '—' },
          { label: 'Referencia', val: row.referencia || '—' },
        ].map(({ label, val }) => (
          <Grid item xs={4} key={label}>
            <Box sx={{ p: 1, borderRadius: 1.5, bgcolor: 'action.hover', textAlign: 'center' }}>
              <Typography sx={{ fontSize: 9, color: 'text.secondary', mb: 0.2 }}>{label}</Typography>
              <Typography sx={{ fontSize: 12, fontWeight: 600 }}>{val}</Typography>
            </Box>
          </Grid>
        ))}
      </Grid>
    </Paper>
  );
};

// ─── Tabla de movimientos ─────────────────────────────────────────────────────
const MovementsTable = ({ refreshKey }) => {
  const [rows, setRows]           = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage]           = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const theme    = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  useEffect(() => {
    fetchMovements({ limit: 500 }).then(({ data }) => setRows(data || [])).catch(() => {});
  }, [refreshKey]);

  const filteredRows = rows.filter(r => {
    const q = searchTerm.toLowerCase();
    return (
      String(r.id).includes(q) ||
      r.producto?.nombre?.toLowerCase().includes(q) ||
      (r.tipo      && r.tipo.toLowerCase().includes(q)) ||
      (r.motivo    && r.motivo.toLowerCase().includes(q)) ||
      (r.referencia && r.referencia.toLowerCase().includes(q))
    );
  });

  const paginated = filteredRows.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  const tipoColor = (tipo) =>
    tipo === 'entrada' ? GREEN : tipo === 'salida' ? RED : ACCENT;

  return (
    <Box>
      {/* Stats rápidas */}
      <Box sx={{ display: 'flex', gap: 2, mb: 2.5, flexWrap: 'wrap' }}>
        {[
          { label: 'Entradas',  val: rows.filter(r => r.tipo === 'entrada').length,  color: GREEN },
          { label: 'Salidas',   val: rows.filter(r => r.tipo === 'salida').length,   color: RED   },
          { label: 'Ajustes',   val: rows.filter(r => r.tipo === 'ajuste').length,   color: ACCENT },
          { label: 'Total mov.',val: rows.length,                                     color: '#3B82F6' },
        ].map(({ label, val, color }) => (
          <Box key={label} sx={{ px: 2, py: 1, borderRadius: 2, bgcolor: `${color}0D`, border: `1px solid ${color}25` }}>
            <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>{label}</Typography>
            <Typography sx={{ fontWeight: 700, fontSize: 16, color }}>{val}</Typography>
          </Box>
        ))}
      </Box>

      {/* Buscador */}
      <TextField
        fullWidth placeholder="Buscar por producto, tipo, motivo, referencia…"
        value={searchTerm}
        onChange={e => { setSearchTerm(e.target.value); setPage(0); }}
        sx={{ mb: 2 }}
        InputProps={{
          startAdornment: <InputAdornment position="start"><Search sx={{ color: 'text.secondary', fontSize: 20 }} /></InputAdornment>,
        }}
      />

      {isMobile ? (
        <Box>
          {paginated.length === 0
            ? <Box sx={{ textAlign: 'center', py: 6, color: 'text.secondary' }}>
                <SwapVert sx={{ fontSize: 48, mb: 1, opacity: 0.3 }} />
                <Typography>No hay movimientos</Typography>
              </Box>
            : paginated.map(r => <MovementCard key={r.id} row={r} />)
          }
        </Box>
      ) : (
        <TableContainer sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                {['#', 'Producto', 'Tipo', 'Cantidad', 'Motivo', 'Referencia', 'Fecha'].map(h => (
                  <TableCell key={h}>{h}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {paginated.length === 0
                ? <TableRow>
                    <TableCell colSpan={7} sx={{ textAlign: 'center', py: 6, color: 'text.secondary' }}>
                      No se encontraron movimientos
                    </TableCell>
                  </TableRow>
                : paginated.map(r => (
                    <TableRow key={r.id} hover>
                      <TableCell sx={{ fontWeight: 600, color: 'text.secondary', fontSize: 12 }}>#{r.id}</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>{r.producto?.nombre ?? `#${r.producto_id}`}</TableCell>
                      <TableCell>
                        <Chip
                          label={r.tipo}
                          size="small"
                          sx={{ bgcolor: `${tipoColor(r.tipo)}18`, color: tipoColor(r.tipo), fontWeight: 700, fontSize: 11, borderRadius: 1.5 }}
                        />
                      </TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>{r.cantidad}</TableCell>
                      <TableCell sx={{ fontSize: 12, color: 'text.secondary' }}>{r.motivo || '—'}</TableCell>
                      <TableCell sx={{ fontSize: 12, color: 'text.secondary' }}>{r.referencia || '—'}</TableCell>
                      <TableCell sx={{ fontSize: 12, color: 'text.secondary', whiteSpace: 'nowrap' }}>
                        {formatDate(r.created_at)}
                      </TableCell>
                    </TableRow>
                  ))
              }
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <TablePagination
        rowsPerPageOptions={[5, 10, 25, 50]}
        component="div"
        count={filteredRows.length}
        rowsPerPage={rowsPerPage}
        page={page}
        onPageChange={(_, p) => setPage(p)}
        onRowsPerPageChange={e => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
        labelRowsPerPage="Filas:"
        labelDisplayedRows={({ from, to, count }) => `${from}–${to} de ${count}`}
      />
    </Box>
  );
};

// ─── Wrapper principal ────────────────────────────────────────────────────────
export default function InventoryPage() {
  const [refresh, setRefresh]   = useState(0);
  const [bulkOpen, setBulkOpen] = useState(false);

  return (
    <Box>
      <LowStockBanner />

      {/* Crear movimiento */}
      <MovementForm onCreated={() => setRefresh(x => x + 1)} />

      {/* Carga masiva */}
      <CollapsePanel
        title="Carga Masiva de Movimientos"
        icon={<Upload fontSize="small" />}
        color="#8B5CF6"
        open={bulkOpen}
        onToggle={() => setBulkOpen(o => !o)}
        chip={
          <Chip label="Excel / CSV" size="small"
            sx={{ bgcolor: 'rgba(139,92,246,0.1)', color: '#8B5CF6', fontWeight: 600, fontSize: 11 }} />
        }
      >
        <BulkUpload uploadType="movimientos" onUploadSuccess={() => setRefresh(x => x + 1)} />
      </CollapsePanel>

      {/* Tabla de movimientos */}
      <Box sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider', bgcolor: 'background.paper', overflow: 'hidden', p: { xs: 2, md: 3 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5 }}>
          <Box sx={{ width: 32, height: 32, borderRadius: 1.5, bgcolor: `${ACCENT}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: ACCENT }}>
            <SwapVert fontSize="small" />
          </Box>
          <Typography sx={{ fontWeight: 700, fontSize: 15 }}>Historial de Movimientos</Typography>
        </Box>
        <MovementsTable key={refresh} refreshKey={refresh} />
      </Box>
    </Box>
  );
}
