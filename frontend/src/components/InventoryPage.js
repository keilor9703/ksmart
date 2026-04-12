import React, { useEffect, useState } from 'react';
import {
  Box, Typography, Grid, TextField, Button, MenuItem, Chip,
  Table, TableHead, TableRow, TableCell, TableBody,
  Paper, useMediaQuery, TablePagination, Collapse, Divider,
  InputAdornment, Stack
} from '@mui/material';
import TableContainer from '@mui/material/TableContainer';
import { useTheme, alpha } from '@mui/material/styles';
import { toast } from 'react-toastify';
import { fetchMovements, createMovement, fetchLowStockAlerts } from '../api';
import apiClient from '../api';
import Autocomplete from '@mui/material/Autocomplete';
import BulkUpload from './BulkUpload';
import {
  Warning, ExpandMore, ExpandLess, Search,
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
    fetchLowStockAlerts().then(({ data }) => setItems(data || [])).catch(() => setItems([]));
  }, []);

  if (!items.length) return null;

  return (
    <Box sx={{
      display: 'flex', alignItems: 'flex-start', gap: 1.5,
      p: 1.5, mb: 2, borderRadius: 2,
      bgcolor: theme.palette.mode === 'dark' ? alpha(theme.palette.warning.main, 0.12) : '#FFFBEB',
      border: '1px solid #FCD34D',
      width: '100%', boxSizing: 'border-box',
    }}>
      <Warning sx={{ color: '#D97706', flexShrink: 0, mt: 0.2, fontSize: 20 }} />
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontWeight: 700, fontSize: 12, color: '#92400E', mb: 0.5 }}>
          {items.length} producto{items.length > 1 ? 's' : ''} con stock bajo el mínimo
        </Typography>
        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
          {items.map(i => (
            <Chip key={i.producto_id}
              label={`${i.nombre} (${i.stock_actual}/${i.stock_minimo})`}
              size="small"
              sx={{ bgcolor: '#FEF3C7', color: '#92400E', fontWeight: 600, fontSize: 10, borderRadius: 1.5, border: '1px solid #FCD34D' }}
            />
          ))}
        </Box>
      </Box>
    </Box>
  );
};

// ─── Panel colapsable ─────────────────────────────────────────────────────────
const CollapsePanel = ({ title, icon, color, open, onToggle, children }) => (
  <Box sx={{
    borderRadius: 3, border: '1px solid', borderColor: 'divider',
    bgcolor: 'background.paper',
    overflowX: 'hidden',
    mb: 2, width: '100%', boxSizing: 'border-box',
    boxShadow: open ? '0 4px 20px rgba(0,0,0,0.08)' : '0 2px 8px rgba(0,0,0,0.04)',
  }}>
    <Box
      onClick={onToggle}
      sx={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        px: { xs: 1.5, md: 2.5 }, py: 1.5, cursor: 'pointer',
        '&:hover': { bgcolor: 'action.hover' },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0, flex: 1 }}>
        <Box sx={{ width: 30, height: 30, borderRadius: 1.5, flexShrink: 0, bgcolor: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', color }}>
          {icon}
        </Box>
        <Typography sx={{ fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {title}
        </Typography>
      </Box>
      <Box sx={{ flexShrink: 0, ml: 1 }}>
        {open ? <ExpandLess sx={{ color: 'text.secondary', fontSize: 20 }} /> : <ExpandMore sx={{ color: 'text.secondary', fontSize: 20 }} />}
      </Box>
    </Box>
    <Collapse in={open}>
      <Divider />
      <Box sx={{ p: { xs: 1.5, md: 3 }, boxSizing: 'border-box' }}>{children}</Box>
    </Collapse>
  </Box>
);

// ─── Formulario de movimiento ─────────────────────────────────────────────────
const MovementForm = ({ onCreated }) => {
  const [productos, setProductos]         = useState([]);
  const [productoSel, setProductoSel]     = useState(null);
  const [productoInput, setProductoInput] = useState('');
  const [open, setOpen]                   = useState(false);
  const [form, setForm] = useState({ tipo: 'ajuste', cantidad: '', motivo: '', referencia: '', observacion: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiClient.get('/productos/').then(r => setProductos(r.data || [])).catch(() => {});
  }, []);

  const handleChange = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const getTipoColor = (t) => t === 'entrada' ? GREEN : t === 'salida' ? RED : ACCENT;

  const submit = async () => {
    if (!productoSel || !form.tipo || !form.cantidad || Number(form.cantidad) <= 0) {
      toast.warning('Debes completar: Producto, Tipo y Cantidad (mayor a 0).');
      return;
    }
    setSaving(true);
    try {
      await createMovement({
        producto_id: productoSel.id, tipo: form.tipo,
        cantidad: Number(form.cantidad),
        motivo: form.motivo || '', referencia: form.referencia || '', observacion: form.observacion || '',
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
      color={CYAN} open={open} onToggle={() => setOpen(o => !o)}
    >
      {/*
        Usamos Stack con direction="column" explícito en lugar de Grid.
        Esto garantiza que cada campo ocupe su propia fila sin importar
        el breakpoint o cualquier CSS externo que interfiera.
      */}
      <Stack direction="column" spacing={1.5} sx={{ width: '100%' }}>

        {/* ── Campo 1: Producto — siempre ocupa toda la fila ── */}
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
          renderOption={(props, option) => (
            <li {...props} key={option.id} style={{ padding: '10px 14px' }}>
              <Box>
                <Typography sx={{ fontSize: 14, fontWeight: 600, lineHeight: 1.3 }}>
                  {option.nombre}
                </Typography>
                <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
                  ID: {option.id} · Stock: {option.stock_actual ?? 0} {option.unidad_medida}
                </Typography>
              </Box>
            </li>
          )}
          renderInput={params => (
            <TextField
              {...params}
              label="Producto (busca por nombre o ID)"
              size="small"
              fullWidth
            />
          )}
          fullWidth
          sx={{ width: '100%' }}
        />

        {/* ── Campo 2: Tipo de movimiento — siempre ocupa toda la fila ── */}
        <TextField
          select
          label="Tipo de movimiento"
          value={form.tipo}
          onChange={e => handleChange('tipo', e.target.value)}
          fullWidth
          size="small"
          sx={{ width: '100%' }}
        >
          {[
            { value: 'entrada', label: '↑ Entrada', color: GREEN  },
            { value: 'salida',  label: '↓ Salida',  color: RED    },
            { value: 'ajuste',  label: '⟳ Ajuste',  color: ACCENT },
          ].map(({ value, label, color }) => (
            <MenuItem key={value} value={value}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: color, flexShrink: 0 }} />
                {label}
              </Box>
            </MenuItem>
          ))}
        </TextField>

        {/* ── Fila 3: Cantidad + Motivo en la misma fila ── */}
        <Box sx={{ display: 'flex', gap: 1.5, width: '100%' }}>
          <TextField
            label="Cantidad"
            type="number"
            value={form.cantidad}
            onChange={e => handleChange('cantidad', e.target.value)}
            inputProps={{ min: 0, step: 'any' }}
            size="small"
            sx={{ flex: 1 }}
          />
          <TextField
            label="Motivo"
            value={form.motivo}
            onChange={e => handleChange('motivo', e.target.value)}
            size="small"
            sx={{ flex: 2 }}
          />
        </Box>

        {/* ── Campo 4: Referencia ── */}
        <TextField
          label="Referencia / Documento"
          value={form.referencia}
          onChange={e => handleChange('referencia', e.target.value)}
          fullWidth size="small"
          sx={{ width: '100%' }}
        />

        {/* ── Campo 5: Observación ── */}
        <TextField
          label="Observación"
          value={form.observacion}
          onChange={e => handleChange('observacion', e.target.value)}
          fullWidth size="small" multiline minRows={2}
          sx={{ width: '100%' }}
        />

        {/* ── Resumen visual ── */}
        {productoSel && Number(form.cantidad) > 0 && (
          <Box sx={{
            p: 1.5, borderRadius: 2,
            bgcolor: `${getTipoColor(form.tipo)}08`,
            border: `1.5px dashed ${getTipoColor(form.tipo)}50`,
            display: 'flex', alignItems: 'center', gap: 1.5,
            width: '100%',
          }}>
            {form.tipo === 'entrada'
              ? <TrendingUp sx={{ color: getTipoColor(form.tipo), fontSize: 20, flexShrink: 0 }} />
              : form.tipo === 'salida'
                ? <TrendingDown sx={{ color: getTipoColor(form.tipo), fontSize: 20, flexShrink: 0 }} />
                : <Tune sx={{ color: getTipoColor(form.tipo), fontSize: 20, flexShrink: 0 }} />
            }
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontWeight: 700, fontSize: 12, color: getTipoColor(form.tipo) }}>
                {form.tipo.toUpperCase()} de {form.cantidad} {productoSel.unidad_medida || 'und'}
              </Typography>
              <Typography sx={{ fontSize: 11, color: 'text.secondary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {productoSel.nombre} · Stock actual: {productoSel.stock_actual ?? 0}
              </Typography>
            </Box>
          </Box>
        )}

      </Stack>

      {/* Botones */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 2, flexWrap: 'wrap' }}>
        <Button onClick={() => setOpen(false)} variant="outlined" size="small"
          sx={{ borderRadius: 2, fontWeight: 600, borderColor: 'divider', color: 'text.secondary' }}>
          Cancelar
        </Button>
        <Button variant="contained" onClick={submit} disabled={saving} size="small"
          sx={{ background: `linear-gradient(135deg, ${CYAN}, #22d3ee)`, boxShadow: `0 4px 14px rgba(6,182,212,0.3)`, borderRadius: 2, fontWeight: 600 }}>
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
    <Paper sx={{ p: 2, mb: 1.5, borderRadius: 3, boxShadow: '0 2px 10px rgba(0,0,0,0.06)', width: '100%', boxSizing: 'border-box' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 700, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {row.producto?.nombre ?? `#${row.producto_id}`}
          </Typography>
          <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>#{row.id} · {formatDate(row.created_at)}</Typography>
        </Box>
        <Chip label={row.tipo} size="small"
          sx={{ bgcolor: `${color}18`, color, fontWeight: 700, fontSize: 10, borderRadius: 1.5, flexShrink: 0, ml: 1 }} />
      </Box>
      <Grid container spacing={1}>
        {[
          { label: 'Cantidad',   val: row.cantidad },
          { label: 'Motivo',     val: row.motivo || '—' },
          { label: 'Referencia', val: row.referencia || '—' },
        ].map(({ label, val }) => (
          <Grid item xs={4} key={label}>
            <Box sx={{ p: 0.8, borderRadius: 1.5, bgcolor: 'action.hover', textAlign: 'center' }}>
              <Typography sx={{ fontSize: 9, color: 'text.secondary', mb: 0.1 }}>{label}</Typography>
              <Typography sx={{ fontSize: 11, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{val}</Typography>
            </Box>
          </Grid>
        ))}
      </Grid>
    </Paper>
  );
};

// ─── Tabla / lista de movimientos ─────────────────────────────────────────────
const MovementsTable = ({ refreshKey }) => {
  const [rows, setRows]             = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage]             = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const isMobile = useMediaQuery(useTheme().breakpoints.down('sm'));

  useEffect(() => {
    fetchMovements({ limit: 500 }).then(({ data }) => setRows(data || [])).catch(() => {});
  }, [refreshKey]);

  const filteredRows = rows.filter(r => {
    const q = searchTerm.toLowerCase();
    return String(r.id).includes(q) ||
      r.producto?.nombre?.toLowerCase().includes(q) ||
      (r.tipo && r.tipo.toLowerCase().includes(q)) ||
      (r.motivo && r.motivo.toLowerCase().includes(q)) ||
      (r.referencia && r.referencia.toLowerCase().includes(q));
  });

  const paginated = filteredRows.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
  const tipoColor = (t) => t === 'entrada' ? GREEN : t === 'salida' ? RED : ACCENT;

  const stats = [
    { label: 'Entradas', val: rows.filter(r => r.tipo === 'entrada').length, color: GREEN },
    { label: 'Salidas',  val: rows.filter(r => r.tipo === 'salida').length,  color: RED   },
    { label: 'Ajustes',  val: rows.filter(r => r.tipo === 'ajuste').length,  color: ACCENT },
    { label: 'Total',    val: rows.length,                                    color: '#3B82F6' },
  ];

  return (
    <Box sx={{ width: '100%', boxSizing: 'border-box' }}>
      <Grid container spacing={1} sx={{ mb: 2 }}>
        {stats.map(({ label, val, color }) => (
          <Grid item xs={6} sm={3} key={label}>
            <Box sx={{ px: 1.5, py: 1, borderRadius: 2, bgcolor: `${color}0D`, border: `1px solid ${color}25`, width: '100%', boxSizing: 'border-box' }}>
              <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>{label}</Typography>
              <Typography sx={{ fontWeight: 700, fontSize: 15, color }}>{val}</Typography>
            </Box>
          </Grid>
        ))}
      </Grid>

      <TextField
        fullWidth size="small"
        placeholder="Buscar por producto, tipo, motivo, referencia…"
        value={searchTerm}
        onChange={e => { setSearchTerm(e.target.value); setPage(0); }}
        sx={{ mb: 2 }}
        InputProps={{
          startAdornment: <InputAdornment position="start"><Search sx={{ color: 'text.secondary', fontSize: 18 }} /></InputAdornment>,
        }}
      />

      {isMobile ? (
        <Box>
          {paginated.length === 0
            ? <Box sx={{ textAlign: 'center', py: 5, color: 'text.secondary' }}>
                <SwapVert sx={{ fontSize: 44, mb: 1, opacity: 0.3 }} />
                <Typography fontSize={13}>No hay movimientos</Typography>
              </Box>
            : paginated.map(r => <MovementCard key={r.id} row={r} />)
          }
        </Box>
      ) : (
        <TableContainer sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider', overflowX: 'auto' }}>
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
                ? <TableRow><TableCell colSpan={7} sx={{ textAlign: 'center', py: 5, color: 'text.secondary' }}>Sin movimientos</TableCell></TableRow>
                : paginated.map(r => (
                    <TableRow key={r.id} hover>
                      <TableCell sx={{ fontWeight: 600, color: 'text.secondary', fontSize: 12 }}>#{r.id}</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>{r.producto?.nombre ?? `#${r.producto_id}`}</TableCell>
                      <TableCell>
                        <Chip label={r.tipo} size="small"
                          sx={{ bgcolor: `${tipoColor(r.tipo)}18`, color: tipoColor(r.tipo), fontWeight: 700, fontSize: 10, borderRadius: 1.5 }} />
                      </TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>{r.cantidad}</TableCell>
                      <TableCell sx={{ fontSize: 12, color: 'text.secondary' }}>{r.motivo || '—'}</TableCell>
                      <TableCell sx={{ fontSize: 12, color: 'text.secondary' }}>{r.referencia || '—'}</TableCell>
                      <TableCell sx={{ fontSize: 11, color: 'text.secondary', whiteSpace: 'nowrap' }}>{formatDate(r.created_at)}</TableCell>
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
        labelDisplayedRows={({ from, to, count }) => `${from}-${to}/${count}`}
        sx={{
          '& .MuiTablePagination-toolbar': { flexWrap: 'wrap', pl: 0 },
          '& .MuiTablePagination-spacer': { display: 'none' },
          '& .MuiTablePagination-displayedRows': { fontSize: 11 },
          '& .MuiTablePagination-selectLabel': { fontSize: 11 },
        }}
      />
    </Box>
  );
};

// ─── Wrapper principal ────────────────────────────────────────────────────────
export default function InventoryPage() {
  const [refresh, setRefresh]   = useState(0);
  const [bulkOpen, setBulkOpen] = useState(false);

  return (
    <Box sx={{ width: '100%', maxWidth: '100%', overflowX: 'hidden', boxSizing: 'border-box' }}>
      <LowStockBanner />

      <MovementForm onCreated={() => setRefresh(x => x + 1)} />

      <CollapsePanel
        title="Carga Masiva de Movimientos"
        icon={<Upload fontSize="small" />}
        color="#8B5CF6" open={bulkOpen} onToggle={() => setBulkOpen(o => !o)}
      >
        <BulkUpload uploadType="movimientos" onUploadSuccess={() => setRefresh(x => x + 1)} />
      </CollapsePanel>

      <Box sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider', bgcolor: 'background.paper', p: { xs: 1.5, md: 3 }, width: '100%', boxSizing: 'border-box' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
          <Box sx={{ width: 30, height: 30, borderRadius: 1.5, flexShrink: 0, bgcolor: `${ACCENT}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: ACCENT }}>
            <SwapVert fontSize="small" />
          </Box>
          <Typography sx={{ fontWeight: 700, fontSize: 14 }}>Historial de Movimientos</Typography>
        </Box>
        <MovementsTable key={refresh} refreshKey={refresh} />
      </Box>
    </Box>
  );
}
