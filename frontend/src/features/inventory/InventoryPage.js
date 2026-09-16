import React, { useEffect, useState, useMemo } from 'react';
import {
  Box, Typography, Grid, TextField, Button, MenuItem, Chip,
  Table, TableHead, TableRow, TableCell, TableBody,
  Paper, useMediaQuery, TablePagination, Collapse, Divider,
  InputAdornment, Stack, TableSortLabel, Tooltip, IconButton
} from '@mui/material';
import TableContainer from '@mui/material/TableContainer';
import { useTheme, alpha } from '@mui/material/styles';
import { toast } from 'react-toastify';
import { fetchMovements, createMovement, fetchLowStockAlerts } from '../../api';
import apiClient from '../../api';
import Autocomplete from '@mui/material/Autocomplete';
import BulkUpload from '../../components/common/BulkUpload';
import CurrencyField from '../../components/common/CurrencyField';
import {
  Warning, ExpandMore, ExpandLess, Search,
  Upload, SwapVert, TrendingUp, TrendingDown, Tune, Layers,
  Refresh, FileDownload
} from '@mui/icons-material';

const ACCENT = '#F59E0B';
const GREEN  = '#10B981';
const RED    = '#EF4444';
const CYAN   = '#06B6D4';

const formatDate = (d) => {
  if (!d) return '—';
  return new Date(d.endsWith('Z') ? d : d + 'Z').toLocaleString();
};

const fmtFecha = (val) => {
  if (!val) return '—';
  try {
    const [y, m, d] = String(val).split('T')[0].split('-');
    return `${d}/${m}/${y}`;
  } catch { return '—'; }
};

// ─── Banner stock bajo ────────────────────────────────────────────────────────
const LowStockBanner = () => {
  const [items, setItems] = useState([]);
  const theme = useTheme();

  const load = () => {
    fetchLowStockAlerts().then(({ data }) => setItems(data || [])).catch(() => setItems([]));
  };

  useEffect(() => { load(); }, []);

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
      <Box sx={{ minWidth: 0, flex: 1 }}>
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
      <Tooltip title="Actualizar">
        <IconButton size="small" onClick={load} sx={{ flexShrink: 0, color: '#D97706' }}>
          <Refresh fontSize="small" />
        </IconButton>
      </Tooltip>
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
  const [open, setOpen]                   = useState(true);
  const [saving, setSaving]               = useState(false);

  const [form, setForm] = useState({
    tipo: 'ajuste', cantidad: '', motivo: '', referencia: '', observacion: '', costo_unitario: '',
  });

  const [lotesExistentes, setLotesExistentes]   = useState([]);
  const [modoLote, setModoLote]                 = useState('existente');
  const [loteSel, setLoteSel]                   = useState(null);
  const [loteInput, setLoteInput]               = useState('');
  const [cantidadLote, setCantidadLote]         = useState('');
  const [motivoLote, setMotivoLote]             = useState('');
  const [nuevoLote, setNuevoLote] = useState({
    numero_lote: '', fecha_vencimiento: '', fecha_fabricacion: '',
    cantidad_inicial: '', costo_unitario: '', referencia_compra: '', observaciones: '',
  });

  useEffect(() => {
    apiClient.get('/productos/').then(r => setProductos(r.data || [])).catch(() => {});
  }, []);

  const handleProductoChange = async (prod) => {
    setProductoSel(prod);
    setLoteSel(null); setLoteInput('');
    setCantidadLote(''); setMotivoLote('');
    setNuevoLote({ numero_lote: '', fecha_vencimiento: '', fecha_fabricacion: '',
                   cantidad_inicial: '', costo_unitario: '', referencia_compra: '', observaciones: '' });

    if (prod?.maneja_lotes) {
      try {
        const res = await apiClient.get(`/inventario/lotes/${prod.id}?solo_activos=false`);
        setLotesExistentes(res.data || []);
        setModoLote(res.data?.length > 0 ? 'existente' : 'nuevo');
      } catch {
        setLotesExistentes([]);
        setModoLote('nuevo');
      }
    } else {
      setLotesExistentes([]);
    }
  };

  const handleChange = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const getTipoColor = (t) => t === 'entrada' ? GREEN : t === 'salida' ? RED : ACCENT;

  const submitNormal = async () => {
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
        costo_unitario: form.tipo === 'entrada' && form.costo_unitario !== '' ? Number(form.costo_unitario) : 0,
      });
      toast.success('Movimiento registrado exitosamente');
      setProductoSel(null); setProductoInput('');
      setForm({ tipo: 'ajuste', cantidad: '', motivo: '', referencia: '', observacion: '', costo_unitario: '' });
      setOpen(false);
      onCreated?.();
    } catch (e) {
      toast.error(e?.response?.data?.detail ?? 'No se pudo registrar el movimiento.');
    } finally { setSaving(false); }
  };

  const submitLoteExistente = async () => {
    if (!loteSel) { toast.warning('Selecciona un lote.'); return; }
    if (!cantidadLote || Number(cantidadLote) === 0) { toast.warning('Ingresa la cantidad (positivo = entrada, negativo = salida).'); return; }
    if (!motivoLote.trim()) { toast.warning('Ingresa el motivo del ajuste.'); return; }
    setSaving(true);
    try {
      await apiClient.patch(`/inventario/lotes/${loteSel.id}/ajuste`, {
        cantidad:   parseFloat(cantidadLote),
        motivo:     motivoLote,
        referencia: form.referencia || undefined,
      });
      toast.success('Lote ajustado correctamente');
      setProductoSel(null); setProductoInput('');
      setLoteSel(null); setLoteInput('');
      setCantidadLote(''); setMotivoLote('');
      setOpen(false);
      onCreated?.();
    } catch (e) {
      toast.error(e?.response?.data?.detail ?? 'Error al ajustar el lote.');
    } finally { setSaving(false); }
  };

  const submitNuevoLote = async () => {
    const { numero_lote, fecha_vencimiento, cantidad_inicial, costo_unitario } = nuevoLote;
    if (!numero_lote || !fecha_vencimiento || !cantidad_inicial || !costo_unitario) {
      toast.warning('Completa los campos obligatorios: N° Lote, Fecha Venc., Cantidad y Costo.');
      return;
    }
    setSaving(true);
    try {
      await apiClient.post('/inventario/lotes', {
        producto_id:       productoSel.id,
        numero_lote:       numero_lote.trim().toUpperCase(),
        fecha_vencimiento: fecha_vencimiento,
        fecha_fabricacion: nuevoLote.fecha_fabricacion || undefined,
        cantidad_inicial:  parseFloat(cantidad_inicial),
        costo_unitario:    parseFloat(costo_unitario),
        referencia_compra: nuevoLote.referencia_compra || undefined,
        observaciones:     nuevoLote.observaciones || undefined,
      });
      toast.success('Nuevo lote registrado correctamente');
      setProductoSel(null); setProductoInput('');
      setNuevoLote({ numero_lote: '', fecha_vencimiento: '', fecha_fabricacion: '',
                     cantidad_inicial: '', costo_unitario: '', referencia_compra: '', observaciones: '' });
      setOpen(false);
      onCreated?.();
    } catch (e) {
      toast.error(e?.response?.data?.detail ?? 'Error al registrar el lote.');
    } finally { setSaving(false); }
  };

  const esPerecible = Boolean(productoSel?.maneja_lotes);

  return (
    <CollapsePanel
      title="Crear Movimiento Manual"
      icon={<SwapVert fontSize="small" />}
      color={CYAN} open={open} onToggle={() => setOpen(o => !o)}
    >
      <Stack direction="column" spacing={1.5} sx={{ width: '100%' }}>

        <Autocomplete
          options={productos}
          value={productoSel}
          onChange={(_, v) => { setProductoInput(v?.nombre || ''); handleProductoChange(v); }}
          inputValue={productoInput}
          onInputChange={(_, v) => setProductoInput(v)}
          getOptionLabel={opt => opt ? `${opt.nombre} (ID: ${opt.id})` : ''}
          filterOptions={(opts, state) => {
            const q = (state.inputValue || '').toLowerCase().trim();
            if (!q) return opts;
            return opts.filter(o =>
              o.nombre.toLowerCase().includes(q) ||
              String(o.id).includes(q) ||
              (o.codigo_barras && o.codigo_barras.toLowerCase().includes(q))
            );
          }}
          renderOption={(props, option) => (
            <li {...props} key={option.id} style={{ padding: '10px 14px' }}>
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography sx={{ fontSize: 14, fontWeight: 600, lineHeight: 1.3 }}>{option.nombre}</Typography>
                  {option.maneja_lotes && (
                    <Chip label="Perecedero" size="small"
                      sx={{ height: 18, fontSize: 10, fontWeight: 700, bgcolor: '#ECFDF5', color: GREEN }} />
                  )}
                </Box>
                <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
                  ID: {option.id} · Stock: {option.stock_actual ?? 0} {option.unidad_medida}
                </Typography>
              </Box>
            </li>
          )}
          renderInput={params => (
            <TextField {...params} label="Producto (busca por nombre o ID)" size="small" fullWidth />
          )}
          fullWidth
        />

        {/* ── Producto PERECEDERO ── */}
        {esPerecible && productoSel && (
          <>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1.2, borderRadius: 2,
                        bgcolor: '#ECFDF5', border: '1px solid #A7F3D0' }}>
              <Layers sx={{ color: GREEN, fontSize: 18, flexShrink: 0 }} />
              <Typography sx={{ fontSize: 12, color: '#065F46', fontWeight: 600 }}>
                Producto perecedero — los movimientos se gestionan por lotes
              </Typography>
            </Box>

            {lotesExistentes.length > 0 && (
              <Box sx={{ display: 'flex', gap: 1 }}>
                {[
                  { key: 'existente', label: '📋 Ajustar lote existente' },
                  { key: 'nuevo',     label: '➕ Registrar nuevo lote' },
                ].map(({ key, label }) => (
                  <Button
                    key={key}
                    size="small"
                    variant={modoLote === key ? 'contained' : 'outlined'}
                    onClick={() => setModoLote(key)}
                    sx={{
                      flex: 1, borderRadius: 2, fontWeight: 600, fontSize: 12,
                      bgcolor: modoLote === key ? GREEN : 'transparent',
                      borderColor: GREEN, color: modoLote === key ? '#fff' : GREEN,
                      '&:hover': { bgcolor: modoLote === key ? '#059669' : `${GREEN}10`, borderColor: GREEN },
                    }}
                  >
                    {label}
                  </Button>
                ))}
              </Box>
            )}

            {modoLote === 'existente' && lotesExistentes.length > 0 && (
              <>
                <Autocomplete
                  options={lotesExistentes}
                  value={loteSel}
                  onChange={(_, v) => setLoteSel(v)}
                  inputValue={loteInput}
                  onInputChange={(_, v) => setLoteInput(v)}
                  getOptionLabel={opt => opt
                    ? `${opt.numero_lote} — Vence: ${fmtFecha(opt.fecha_vencimiento)} · Stock: ${opt.cantidad_actual}`
                    : ''}
                  renderOption={(props, option) => (
                    <li {...props} key={option.id} style={{ padding: '10px 14px' }}>
                      <Box>
                        <Typography sx={{ fontSize: 13, fontWeight: 700 }}>{option.numero_lote}</Typography>
                        <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
                          Vence: {option.fecha_vencimiento} · Stock actual: {option.cantidad_actual}
                        </Typography>
                      </Box>
                    </li>
                  )}
                  renderInput={params => (
                    <TextField {...params} label="Seleccionar lote *" size="small" fullWidth />
                  )}
                  fullWidth
                />

                <Box sx={{ display: 'flex', gap: 1.5 }}>
                  <TextField
                    label="Cantidad"
                    type="number"
                    size="small"
                    value={cantidadLote}
                    onChange={e => setCantidadLote(e.target.value)}
                    helperText="Positivo = entrada  ·  Negativo = salida"
                    sx={{ flex: 1 }}
                  />
                  <TextField
                    label="Motivo *"
                    size="small"
                    value={motivoLote}
                    onChange={e => setMotivoLote(e.target.value)}
                    placeholder="Ej: Merma, Ajuste de inventario..."
                    sx={{ flex: 2 }}
                  />
                </Box>

                <TextField
                  label="Referencia (opcional)"
                  size="small"
                  value={form.referencia}
                  onChange={e => handleChange('referencia', e.target.value)}
                  fullWidth
                />
              </>
            )}

            {(modoLote === 'nuevo' || lotesExistentes.length === 0) && (
              <>
                <Box sx={{ display: 'flex', gap: 1.5 }}>
                  <TextField
                    label="N° de Lote *" size="small"
                    value={nuevoLote.numero_lote}
                    onChange={e => setNuevoLote(p => ({ ...p, numero_lote: e.target.value.toUpperCase() }))}
                    sx={{ flex: 1 }}
                  />
                  <TextField
                    label="Cantidad *" type="number" size="small"
                    value={nuevoLote.cantidad_inicial}
                    onChange={e => setNuevoLote(p => ({ ...p, cantidad_inicial: e.target.value }))}
                    InputProps={{ endAdornment: <InputAdornment position="end">{productoSel?.unidad_medida || 'UND'}</InputAdornment> }}
                    sx={{ flex: 1 }}
                  />
                </Box>

                <Box sx={{ display: 'flex', gap: 1.5 }}>
                  <TextField
                    label="Fecha Vencimiento *" type="date" size="small"
                    InputLabelProps={{ shrink: true }}
                    value={nuevoLote.fecha_vencimiento}
                    onChange={e => setNuevoLote(p => ({ ...p, fecha_vencimiento: e.target.value }))}
                    inputProps={{ min: new Date().toLocaleDateString('en-CA') }}
                    sx={{ flex: 1 }}
                  />
                  <TextField
                    label="Fabricación (Opc.)" type="date" size="small"
                    InputLabelProps={{ shrink: true }}
                    value={nuevoLote.fecha_fabricacion}
                    onChange={e => setNuevoLote(p => ({ ...p, fecha_fabricacion: e.target.value }))}
                    sx={{ flex: 1 }}
                  />
                </Box>

                <Box sx={{ display: 'flex', gap: 1.5 }}>
                  <CurrencyField
                    label="Costo Unitario *"
                    value={nuevoLote.costo_unitario}
                    onChange={val => setNuevoLote(p => ({ ...p, costo_unitario: val }))}
                    sx={{ flex: 1 }}
                  />
                  <TextField
                    label="Referencia / Factura" size="small"
                    value={nuevoLote.referencia_compra}
                    onChange={e => setNuevoLote(p => ({ ...p, referencia_compra: e.target.value }))}
                    sx={{ flex: 1 }}
                  />
                </Box>

                <TextField
                  label="Observaciones" size="small" multiline minRows={2} fullWidth
                  value={nuevoLote.observaciones}
                  onChange={e => setNuevoLote(p => ({ ...p, observaciones: e.target.value }))}
                />
              </>
            )}
          </>
        )}

        {/* ── Producto NORMAL ── */}
        {!esPerecible && productoSel && (
          <>
            <TextField
              select label="Tipo de movimiento" value={form.tipo}
              onChange={e => handleChange('tipo', e.target.value)}
              fullWidth size="small"
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

            <Box sx={{ display: 'flex', gap: 1.5, width: '100%' }}>
              <TextField
                label="Cantidad" type="number" value={form.cantidad}
                onChange={e => handleChange('cantidad', e.target.value)}
                inputProps={{ min: 0, step: 'any' }} size="small" sx={{ flex: 1 }}
              />
              <TextField
                label="Motivo" value={form.motivo}
                onChange={e => handleChange('motivo', e.target.value)}
                size="small" sx={{ flex: 2 }}
              />
            </Box>

            {form.tipo === 'entrada' && (
              <CurrencyField
                label="Costo unitario (para Kardex)"
                value={form.costo_unitario}
                onChange={val => handleChange('costo_unitario', val)}
                fullWidth
                helperText="Ingresa el costo para un Kardex preciso. Deja en 0 si es un ajuste de inventario."
              />
            )}

            <TextField
              label="Referencia / Documento" value={form.referencia}
              onChange={e => handleChange('referencia', e.target.value)}
              fullWidth size="small"
            />
            <TextField
              label="Observación" value={form.observacion}
              onChange={e => handleChange('observacion', e.target.value)}
              fullWidth size="small" multiline minRows={2}
            />

            {productoSel && Number(form.cantidad) > 0 && (
              <Box sx={{
                p: 1.5, borderRadius: 2,
                bgcolor: `${getTipoColor(form.tipo)}08`,
                border: `1.5px dashed ${getTipoColor(form.tipo)}50`,
                display: 'flex', alignItems: 'center', gap: 1.5,
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
          </>
        )}
      </Stack>

      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 2, flexWrap: 'wrap' }}>
        <Button onClick={() => setOpen(false)} variant="outlined" size="small"
          sx={{ borderRadius: 2, fontWeight: 600, borderColor: 'divider', color: 'text.secondary' }}>
          Cancelar
        </Button>
        <Button
          variant="contained" size="small" disabled={saving || !productoSel}
          onClick={
            !esPerecible
              ? submitNormal
              : (modoLote === 'existente' && lotesExistentes.length > 0)
                ? submitLoteExistente
                : submitNuevoLote
          }
          sx={{ background: `linear-gradient(135deg, ${CYAN}, #22d3ee)`, boxShadow: `0 4px 14px rgba(6,182,212,0.3)`, borderRadius: 2, fontWeight: 600 }}
        >
          {saving
            ? 'Guardando…'
            : esPerecible
              ? (modoLote === 'existente' && lotesExistentes.length > 0 ? 'Ajustar Lote' : 'Registrar Nuevo Lote')
              : 'Registrar Movimiento'
          }
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
          <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>#{row.numero_movimiento ?? row.id} · {formatDate(row.created_at)}</Typography>
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
          <Grid size={{ xs: 4 }} key={label}>
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
  const [rows, setRows]               = useState([]);
  const [searchTerm, setSearchTerm]   = useState('');
  const [page, setPage]               = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [filtroTipo, setFiltroTipo]   = useState('all');
  const [filtroDesde, setFiltroDesde] = useState('');
  const [filtroHasta, setFiltroHasta] = useState('');
  const [sortCol, setSortCol]         = useState('fecha');
  const [sortDir, setSortDir]         = useState('desc');
  const isMobile = useMediaQuery(useTheme().breakpoints.down('sm'));

  useEffect(() => {
    fetchMovements({ limit: 500 }).then(({ data }) => setRows(data || [])).catch(() => {});
  }, [refreshKey]);

  const filteredRows = useMemo(() => rows.filter(r => {
    const q = searchTerm.toLowerCase();
    const matchSearch = String(r.id).includes(q) ||
      r.producto?.nombre?.toLowerCase().includes(q) ||
      (r.producto?.codigo_barras && r.producto.codigo_barras.toLowerCase().includes(q)) ||
      (r.tipo && r.tipo.toLowerCase().includes(q)) ||
      (r.motivo && r.motivo.toLowerCase().includes(q)) ||
      (r.referencia && r.referencia.toLowerCase().includes(q));
    const matchTipo = filtroTipo === 'all' || r.tipo === filtroTipo;
    const dt = r.created_at ? new Date(r.created_at) : null;
    const matchDesde = !filtroDesde || (dt && dt >= new Date(filtroDesde));
    const matchHasta = !filtroHasta || (dt && dt <= new Date(filtroHasta + 'T23:59:59'));
    return matchSearch && matchTipo && matchDesde && matchHasta;
  }), [rows, searchTerm, filtroTipo, filtroDesde, filtroHasta]);

  const sortedRows = useMemo(() => {
    return [...filteredRows].sort((a, b) => {
      if (sortCol === 'fecha') {
        const da = new Date(a.created_at || 0), db = new Date(b.created_at || 0);
        return sortDir === 'asc' ? da - db : db - da;
      }
      if (sortCol === 'nombre') {
        const na = a.producto?.nombre ?? '', nb = b.producto?.nombre ?? '';
        return sortDir === 'asc' ? na.localeCompare(nb) : nb.localeCompare(na);
      }
      if (sortCol === 'tipo') {
        const ta = a.tipo ?? '', tb = b.tipo ?? '';
        return sortDir === 'asc' ? ta.localeCompare(tb) : tb.localeCompare(ta);
      }
      if (sortCol === 'cantidad') return sortDir === 'asc' ? a.cantidad - b.cantidad : b.cantidad - a.cantidad;
      return 0;
    });
  }, [filteredRows, sortCol, sortDir]);

  const paginated = sortedRows.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
  const tipoColor = (t) => t === 'entrada' ? GREEN : t === 'salida' ? RED : ACCENT;

  const SortHeader = ({ col, label, align = 'left' }) => (
    <TableCell align={align}>
      <TableSortLabel
        active={sortCol === col}
        direction={sortCol === col ? sortDir : 'asc'}
        onClick={() => {
          setSortDir(d => sortCol === col ? (d === 'asc' ? 'desc' : 'asc') : 'desc');
          setSortCol(col);
        }}
      >
        {label}
      </TableSortLabel>
    </TableCell>
  );

  const exportCSV = () => {
    const headers = ['ID', 'Producto', 'Tipo', 'Cantidad', 'Costo Unit.', 'Motivo', 'Referencia', 'Fecha'];
    const csvRows = sortedRows.map(r => [
      r.id,
      r.producto?.nombre ?? r.producto_id,
      r.tipo,
      r.cantidad,
      r.costo_unitario ?? 0,
      r.motivo || '',
      r.referencia || '',
      formatDate(r.created_at)
    ]);
    const csv = [headers, ...csvRows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const now = new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' }).replace(/[/:, ]/g, '-');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `movimientos_${now}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
  };

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
          <Grid size={{ xs: 6, sm: 3 }} key={label}>
            <Box sx={{ px: 1.5, py: 1, borderRadius: 2, bgcolor: `${color}0D`, border: `1px solid ${color}25`, width: '100%', boxSizing: 'border-box' }}>
              <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>{label}</Typography>
              <Typography sx={{ fontWeight: 700, fontSize: 15, color }}>{val}</Typography>
            </Box>
          </Grid>
        ))}
      </Grid>

      {/* Date range filter */}
      <Box sx={{ display: 'flex', gap: 1, mb: 1.5, flexWrap: 'wrap' }}>
        <TextField type="date" label="Desde" size="small" value={filtroDesde}
          onChange={e => { setFiltroDesde(e.target.value); setPage(0); }}
          InputLabelProps={{ shrink: true }} sx={{ flex: 1, minWidth: 140 }} />
        <TextField type="date" label="Hasta" size="small" value={filtroHasta}
          onChange={e => { setFiltroHasta(e.target.value); setPage(0); }}
          InputLabelProps={{ shrink: true }} sx={{ flex: 1, minWidth: 140 }} />
        {(filtroDesde || filtroHasta) && (
          <Button size="small" onClick={() => { setFiltroDesde(''); setFiltroHasta(''); }}
            variant="outlined" sx={{ borderRadius: 2, borderColor: 'divider', color: 'text.secondary', fontWeight: 600, flexShrink: 0 }}>
            Limpiar
          </Button>
        )}
      </Box>

      {/* Tipo filter chips */}
      <Box sx={{ display: 'flex', gap: 0.8, flexWrap: 'wrap', mb: 1.5 }}>
        {[
          { key: 'all',     label: 'Todos',    color: '#3B82F6' },
          { key: 'entrada', label: 'Entradas', color: '#10B981' },
          { key: 'salida',  label: 'Salidas',  color: '#EF4444' },
          { key: 'ajuste',  label: 'Ajustes',  color: '#F59E0B' },
        ].map(({ key, label, color }) => {
          const count = key === 'all' ? filteredRows.length : rows.filter(r => r.tipo === key).length;
          return (
            <Chip key={key} label={`${label} (${count})`}
              onClick={() => { setFiltroTipo(key); setPage(0); }}
              size="small"
              sx={{ fontWeight: 600, fontSize: 11, cursor: 'pointer',
                    bgcolor: filtroTipo === key ? color : 'transparent',
                    color: filtroTipo === key ? '#fff' : 'text.secondary',
                    border: `1px solid ${filtroTipo === key ? color : 'divider'}` }}
            />
          );
        })}
      </Box>

      {/* Search bar + CSV export */}
      <Box sx={{ display: 'flex', gap: 1, mb: 1.5, alignItems: 'center' }}>
        <TextField
          fullWidth size="small"
          placeholder="Buscar por producto, tipo, motivo, referencia…"
          value={searchTerm}
          onChange={e => { setSearchTerm(e.target.value); setPage(0); }}
          InputProps={{
            startAdornment: <InputAdornment position="start"><Search sx={{ color: 'text.secondary', fontSize: 18 }} /></InputAdornment>,
          }}
          sx={{ flex: 1 }}
        />
        <Tooltip title="Exportar CSV">
          <IconButton onClick={exportCSV} size="small"
            sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1.5 }}>
            <FileDownload fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

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
                <TableCell>#</TableCell>
                <SortHeader col="nombre"   label="Producto" />
                <SortHeader col="tipo"     label="Tipo" />
                <SortHeader col="cantidad" label="Cantidad" align="left" />
                <TableCell>Motivo</TableCell>
                <TableCell>Referencia / Lote</TableCell>
                <SortHeader col="fecha"    label="Fecha" />
              </TableRow>
            </TableHead>
            <TableBody>
              {paginated.length === 0
                ? <TableRow><TableCell colSpan={7} sx={{ textAlign: 'center', py: 5, color: 'text.secondary' }}>Sin movimientos</TableCell></TableRow>
                : paginated.map(r => (
                    <TableRow key={r.id} hover>
                      <TableCell sx={{ fontWeight: 600, color: 'text.secondary', fontSize: 12 }}>#{r.numero_movimiento ?? r.id}</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>{r.producto?.nombre ?? `#${r.producto_id}`}</TableCell>
                      <TableCell>
                        <Chip label={r.tipo} size="small"
                          sx={{ bgcolor: `${tipoColor(r.tipo)}18`, color: tipoColor(r.tipo), fontWeight: 700, fontSize: 10, borderRadius: 1.5 }} />
                      </TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>{r.cantidad}</TableCell>
                      <TableCell sx={{ fontSize: 12, color: 'text.secondary' }}>{r.motivo || '—'}</TableCell>
                      <TableCell sx={{ fontSize: 12, color: 'text.secondary' }}>
                        {r.referencia || '—'}
                        {r.numero_lote && (
                          <Chip label={`Lote: ${r.numero_lote}`} size="small"
                            sx={{ ml: 0.5, height: 16, fontSize: 9, fontWeight: 700, bgcolor: '#ECFDF5', color: GREEN, '& .MuiChip-label': { px: 0.6 } }} />
                        )}
                      </TableCell>
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
        count={sortedRows.length}
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
