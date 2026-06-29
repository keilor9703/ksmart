import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Paper, Typography, Button, IconButton, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Chip, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, MenuItem, Switch, FormControlLabel, Stack, Tooltip,
  CircularProgress, InputAdornment, Autocomplete, useMediaQuery, useTheme,
} from '@mui/material';
import { Add, Edit, Delete, LocalOffer, ContentCopy } from '@mui/icons-material';
import { apiClient } from '../../../api';
import { toast } from 'react-toastify';

const fmtCOP = (n) => `$${Number(n || 0).toLocaleString('es-CO')}`;
const toInputDate = (iso) => (iso ? String(iso).slice(0, 10) : '');

const emptyForm = {
  codigo: '', descripcion: '', tipo: 'porcentaje', valor: '',
  activo: true, fecha_inicio: '', fecha_fin: '',
  max_usos: '', un_uso_por_empresa: true, planes_aplicables: [],
};

export default function CodigosPromoManager({ planes = [] }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [codigos, setCodigos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen]       = useState(false);
  const [editId, setEditId]   = useState(null);
  const [form, setForm]       = useState(emptyForm);
  const [saving, setSaving]   = useState(false);

  const fetchCodigos = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await apiClient.get('/promociones/admin');
      setCodigos(data || []);
    } catch {
      toast.error('No se pudieron cargar los códigos.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCodigos(); }, [fetchCodigos]);

  const abrirNuevo = () => { setEditId(null); setForm(emptyForm); setOpen(true); };
  const abrirEditar = (c) => {
    setEditId(c.id);
    setForm({
      codigo: c.codigo, descripcion: c.descripcion || '', tipo: c.tipo, valor: c.valor,
      activo: c.activo, fecha_inicio: toInputDate(c.fecha_inicio), fecha_fin: toInputDate(c.fecha_fin),
      max_usos: c.max_usos ?? '', un_uso_por_empresa: c.un_uso_por_empresa,
      planes_aplicables: c.planes_aplicables || [],
    });
    setOpen(true);
  };

  const guardar = async () => {
    if (!form.codigo.trim()) return toast.error('Ingresa el código.');
    if (!form.valor || Number(form.valor) <= 0) return toast.error('Ingresa un valor de descuento válido.');
    if (form.tipo === 'porcentaje' && Number(form.valor) > 100) return toast.error('El porcentaje no puede superar 100.');

    const payload = {
      descripcion: form.descripcion.trim() || null,
      tipo: form.tipo,
      valor: Number(form.valor),
      activo: form.activo,
      fecha_inicio: form.fecha_inicio ? new Date(form.fecha_inicio).toISOString() : null,
      fecha_fin: form.fecha_fin ? new Date(form.fecha_fin + 'T23:59:59').toISOString() : null,
      max_usos: form.max_usos === '' ? null : Number(form.max_usos),
      un_uso_por_empresa: form.un_uso_por_empresa,
      planes_aplicables: form.planes_aplicables.length ? form.planes_aplicables : null,
    };
    setSaving(true);
    try {
      if (editId) {
        await apiClient.put(`/promociones/admin/${editId}`, payload);
        toast.success('Código actualizado.');
      } else {
        await apiClient.post('/promociones/admin', { ...payload, codigo: form.codigo.trim().toUpperCase() });
        toast.success('Código creado.');
      }
      setOpen(false);
      fetchCodigos();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'No se pudo guardar.');
    } finally {
      setSaving(false);
    }
  };

  const eliminar = async (c) => {
    if (!window.confirm(`¿Eliminar el código ${c.codigo}?`)) return;
    try {
      await apiClient.delete(`/promociones/admin/${c.id}`);
      toast.success('Código eliminado.');
      fetchCodigos();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'No se pudo eliminar.');
    }
  };

  const toggleActivo = async (c) => {
    try {
      await apiClient.put(`/promociones/admin/${c.id}`, { activo: !c.activo });
      fetchCodigos();
    } catch {
      toast.error('No se pudo cambiar el estado.');
    }
  };

  const copiar = (codigo) => {
    navigator.clipboard?.writeText(codigo);
    toast.success('Código copiado.');
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, flexWrap: 'wrap', gap: 1 }}>
        <Box>
          <Typography sx={{ fontWeight: 800, fontSize: 16 }}>Códigos promocionales</Typography>
          <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>
            Descuentos aplicables al pagar una suscripción.
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<Add />} onClick={abrirNuevo}>Nuevo código</Button>
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
      ) : codigos.length === 0 ? (
        <Paper sx={{ p: 5, textAlign: 'center', borderRadius: 3, border: '1px dashed', borderColor: 'divider' }}>
          <LocalOffer sx={{ fontSize: 44, color: 'text.disabled', mb: 1 }} />
          <Typography sx={{ fontWeight: 700, color: 'text.secondary' }}>Aún no hay códigos promocionales</Typography>
        </Paper>
      ) : isMobile ? (
        /* ── Móvil: cards ── */
        <Stack spacing={1.5}>
          {codigos.map(c => (
            <Paper key={c.id} sx={{ p: 1.75, borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
              <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
                <Box sx={{ minWidth: 0 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Typography sx={{ fontWeight: 700, fontFamily: 'monospace', fontSize: 15 }} noWrap>{c.codigo}</Typography>
                    <Tooltip title="Copiar"><IconButton size="small" onClick={() => copiar(c.codigo)}><ContentCopy sx={{ fontSize: 14 }} /></IconButton></Tooltip>
                  </Box>
                  {c.descripcion && <Typography sx={{ fontSize: 11.5, color: 'text.secondary' }}>{c.descripcion}</Typography>}
                </Box>
                <Chip size="small" label={c.tipo === 'porcentaje' ? `${c.valor}%` : fmtCOP(c.valor)}
                  sx={{ flexShrink: 0, fontWeight: 700, bgcolor: 'rgba(16,185,129,0.12)', color: '#10B981' }} />
              </Box>

              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, mt: 1.25 }}>
                <Box>
                  <Typography sx={{ fontSize: 10, color: 'text.disabled', textTransform: 'uppercase', fontWeight: 700 }}>Vigencia</Typography>
                  <Typography sx={{ fontSize: 12.5 }}>
                    {c.fecha_inicio || c.fecha_fin
                      ? `${toInputDate(c.fecha_inicio) || '—'} → ${toInputDate(c.fecha_fin) || '—'}`
                      : 'Sin límite'}
                  </Typography>
                </Box>
                <Box>
                  <Typography sx={{ fontSize: 10, color: 'text.disabled', textTransform: 'uppercase', fontWeight: 700 }}>Usos</Typography>
                  <Typography sx={{ fontSize: 12.5 }}>{c.usos_actuales}{c.max_usos != null ? ` / ${c.max_usos}` : ''}</Typography>
                </Box>
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 1, pt: 1, borderTop: '1px solid', borderColor: 'divider' }}>
                <FormControlLabel
                  control={<Switch size="small" checked={c.activo} onChange={() => toggleActivo(c)} />}
                  label={<Typography sx={{ fontSize: 12.5 }}>{c.activo ? 'Activo' : 'Inactivo'}</Typography>}
                  sx={{ m: 0 }}
                />
                <Box>
                  <IconButton size="small" onClick={() => abrirEditar(c)}><Edit sx={{ fontSize: 18 }} /></IconButton>
                  <IconButton size="small" onClick={() => eliminar(c)} sx={{ color: 'error.main' }}><Delete sx={{ fontSize: 18 }} /></IconButton>
                </Box>
              </Box>
            </Paper>
          ))}
        </Stack>
      ) : (
        <TableContainer component={Paper} sx={{ borderRadius: 3 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Código</TableCell>
                <TableCell>Descuento</TableCell>
                <TableCell>Vigencia</TableCell>
                <TableCell>Usos</TableCell>
                <TableCell>Estado</TableCell>
                <TableCell align="right">Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {codigos.map(c => (
                <TableRow key={c.id} hover>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Typography sx={{ fontWeight: 700, fontFamily: 'monospace' }}>{c.codigo}</Typography>
                      <Tooltip title="Copiar"><IconButton size="small" onClick={() => copiar(c.codigo)}><ContentCopy sx={{ fontSize: 14 }} /></IconButton></Tooltip>
                    </Box>
                    {c.descripcion && <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{c.descripcion}</Typography>}
                  </TableCell>
                  <TableCell>
                    <Chip size="small" label={c.tipo === 'porcentaje' ? `${c.valor}%` : fmtCOP(c.valor)}
                      sx={{ fontWeight: 700, bgcolor: 'rgba(16,185,129,0.12)', color: '#10B981' }} />
                  </TableCell>
                  <TableCell sx={{ fontSize: 12 }}>
                    {c.fecha_inicio || c.fecha_fin
                      ? `${toInputDate(c.fecha_inicio) || '—'} → ${toInputDate(c.fecha_fin) || '—'}`
                      : 'Sin límite'}
                  </TableCell>
                  <TableCell sx={{ fontSize: 12 }}>
                    {c.usos_actuales}{c.max_usos != null ? ` / ${c.max_usos}` : ''}
                  </TableCell>
                  <TableCell>
                    <Switch size="small" checked={c.activo} onChange={() => toggleActivo(c)} />
                  </TableCell>
                  <TableCell align="right">
                    <IconButton size="small" onClick={() => abrirEditar(c)}><Edit sx={{ fontSize: 17 }} /></IconButton>
                    <IconButton size="small" onClick={() => eliminar(c)} sx={{ color: 'error.main' }}><Delete sx={{ fontSize: 17 }} /></IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Dialog crear/editar */}
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>{editId ? 'Editar código' : 'Nuevo código promocional'}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 0.5 }}>
            <TextField label="Código" size="small" fullWidth value={form.codigo}
              disabled={Boolean(editId)}
              onChange={e => setForm(f => ({ ...f, codigo: e.target.value.toUpperCase() }))}
              helperText={editId ? 'El código no se puede cambiar.' : 'Ej: BIENVENIDA20'} />
            <TextField label="Descripción (opcional)" size="small" fullWidth value={form.descripcion}
              onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} />
            <Box sx={{ display: 'flex', gap: 1.5 }}>
              <TextField select label="Tipo" size="small" sx={{ minWidth: 150 }} value={form.tipo}
                onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}>
                <MenuItem value="porcentaje">Porcentaje (%)</MenuItem>
                <MenuItem value="fijo">Monto fijo (COP)</MenuItem>
              </TextField>
              <TextField label="Valor" size="small" type="number" fullWidth value={form.valor}
                onChange={e => setForm(f => ({ ...f, valor: e.target.value }))}
                InputProps={{ endAdornment: <InputAdornment position="end">{form.tipo === 'porcentaje' ? '%' : 'COP'}</InputAdornment> }} />
            </Box>
            <Box sx={{ display: 'flex', gap: 1.5 }}>
              <TextField label="Vigente desde" size="small" type="date" fullWidth InputLabelProps={{ shrink: true }}
                value={form.fecha_inicio} onChange={e => setForm(f => ({ ...f, fecha_inicio: e.target.value }))} />
              <TextField label="Vigente hasta" size="small" type="date" fullWidth InputLabelProps={{ shrink: true }}
                value={form.fecha_fin} onChange={e => setForm(f => ({ ...f, fecha_fin: e.target.value }))} />
            </Box>
            <TextField label="Límite de usos (vacío = ilimitado)" size="small" type="number" fullWidth
              value={form.max_usos} onChange={e => setForm(f => ({ ...f, max_usos: e.target.value }))} />
            <Autocomplete multiple size="small" options={planes} getOptionLabel={p => p.nombre || ''}
              value={planes.filter(p => form.planes_aplicables.includes(p.id))}
              onChange={(_, vals) => setForm(f => ({ ...f, planes_aplicables: vals.map(v => v.id) }))}
              isOptionEqualToValue={(o, v) => o.id === v.id}
              renderInput={(params) => <TextField {...params} label="Aplica a planes (vacío = todos)" />} />
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <FormControlLabel control={<Switch checked={form.activo} onChange={e => setForm(f => ({ ...f, activo: e.target.checked }))} />} label="Activo" />
              <FormControlLabel control={<Switch checked={form.un_uso_por_empresa} onChange={e => setForm(f => ({ ...f, un_uso_por_empresa: e.target.checked }))} />} label="Un uso por empresa" />
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpen(false)} color="inherit">Cancelar</Button>
          <Button variant="contained" onClick={guardar} disabled={saving}
            startIcon={saving ? <CircularProgress size={16} color="inherit" /> : null}>
            {editId ? 'Guardar' : 'Crear'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
