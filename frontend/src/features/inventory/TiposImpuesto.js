import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Button, IconButton, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, Switch, FormControlLabel, Table, TableBody,
  TableCell, TableHead, TableRow, Chip, CircularProgress, Tooltip, useMediaQuery,
} from '@mui/material';
import { Add, Edit, Delete, Percent } from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';
import { alpha } from '@mui/material/styles';
import { toast } from 'react-toastify';
import apiClient from '../../api';

const ACCENT = '#F43F5E';

const EMPTY_FORM = { nombre: '', codigo: '', porcentaje: '', descripcion: '', is_active: true };

export default function TiposImpuesto() {
  const theme = useTheme();
  const [impuestos, setImpuestos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const fetchImpuestos = () => {
    setLoading(true);
    apiClient.get('/impuestos/?solo_activos=false')
      .then(r => setImpuestos(r.data || []))
      .catch(() => toast.error('Error al cargar impuestos'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchImpuestos(); }, []);

  const openCreate = () => { setEditing(null); setForm(EMPTY_FORM); setDialogOpen(true); };
  const openEdit = (imp) => {
    setEditing(imp);
    setForm({ nombre: imp.nombre, codigo: imp.codigo, porcentaje: String(imp.porcentaje), descripcion: imp.descripcion || '', is_active: imp.is_active });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.nombre.trim() || !form.codigo.trim()) { toast.error('Nombre y código son obligatorios'); return; }
    const porcentaje = parseFloat(form.porcentaje);
    if (isNaN(porcentaje) || porcentaje < 0) { toast.error('El porcentaje debe ser un número positivo'); return; }
    setSaving(true);
    try {
      const payload = { ...form, porcentaje, codigo: form.codigo.toUpperCase() };
      if (editing) {
        await apiClient.put(`/impuestos/${editing.id}`, payload);
        toast.success('Impuesto actualizado');
      } else {
        await apiClient.post('/impuestos/', payload);
        toast.success('Impuesto creado');
      }
      fetchImpuestos();
      setDialogOpen(false);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (imp) => {
    try {
      await apiClient.delete(`/impuestos/${imp.id}`);
      toast.success('Impuesto eliminado');
      fetchImpuestos();
    } catch {
      toast.error('No se pudo eliminar (puede estar en uso)');
    }
    setDeleteConfirm(null);
  };

  const isDark = theme.palette.mode === 'dark';
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ width: 36, height: 36, borderRadius: 2, bgcolor: alpha(ACCENT, 0.1), display: 'flex', alignItems: 'center', justifyContent: 'center', color: ACCENT }}>
            <Percent fontSize="small" />
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 700, fontSize: 15 }}>Tipos de Impuesto</Typography>
            <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>Configura IVA, INC y tarifas para tus productos</Typography>
          </Box>
        </Box>
        <Button
          variant="contained" startIcon={<Add />} size="small"
          onClick={openCreate}
          sx={{ background: `linear-gradient(135deg, ${ACCENT}, #fb7185)`, borderRadius: 2, fontWeight: 600, boxShadow: `0 4px 12px ${alpha(ACCENT, 0.3)}` }}
        >
          Nuevo
        </Button>
      </Box>

      {/* Tabla */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress sx={{ color: ACCENT }} /></Box>
      ) : impuestos.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 5, color: 'text.secondary' }}>
          <Percent sx={{ fontSize: 40, mb: 1, opacity: 0.3 }} />
          <Typography>No hay tipos de impuesto configurados.</Typography>
          <Button sx={{ mt: 1, color: ACCENT }} onClick={openCreate}>Crear el primero</Button>
        </Box>
      ) : isMobile ? (
        // En celular las 6 columnas no caben (se cortaban Estado y Acciones).
        // Se muestra cada impuesto como tarjeta apilada.
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {impuestos.map((imp) => (
            <Box key={imp.id} sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider', p: 1.75, bgcolor: 'background.paper' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1 }}>
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 700, fontSize: 15 }}>{imp.nombre}</Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.75, flexWrap: 'wrap' }}>
                    <Chip label={imp.codigo} size="small" sx={{ fontWeight: 700, fontSize: 11, height: 20, bgcolor: alpha(ACCENT, 0.1), color: ACCENT }} />
                    <Chip
                      label={`${imp.porcentaje}%`}
                      size="small"
                      sx={{
                        fontWeight: 700, fontSize: 12, height: 22,
                        bgcolor: imp.porcentaje > 0 ? alpha('#F43F5E', 0.1) : alpha('#10B981', 0.1),
                        color: imp.porcentaje > 0 ? '#F43F5E' : '#10B981',
                      }}
                    />
                    <Chip
                      label={imp.is_active ? 'Activo' : 'Inactivo'}
                      size="small"
                      sx={{
                        fontSize: 10, height: 18,
                        bgcolor: imp.is_active ? alpha('#10B981', 0.1) : alpha('#94a3b8', 0.1),
                        color: imp.is_active ? '#10B981' : '#94a3b8',
                      }}
                    />
                  </Box>
                </Box>
                <Box sx={{ display: 'flex', flexShrink: 0 }}>
                  <IconButton size="small" onClick={() => openEdit(imp)} sx={{ color: 'text.secondary' }}>
                    <Edit fontSize="small" />
                  </IconButton>
                  <IconButton size="small" onClick={() => setDeleteConfirm(imp)} sx={{ color: '#EF4444' }}>
                    <Delete fontSize="small" />
                  </IconButton>
                </Box>
              </Box>
              {imp.descripcion && (
                <Typography sx={{ fontSize: 12, color: 'text.secondary', mt: 1 }}>{imp.descripcion}</Typography>
              )}
            </Box>
          ))}
        </Box>
      ) : (
        <Box sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider', overflow: 'hidden' }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: isDark ? alpha('#fff', 0.04) : alpha('#000', 0.03) }}>
                <TableCell sx={{ fontWeight: 700, fontSize: 12 }}>Nombre</TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: 12 }}>Código</TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: 12 }} align="center">%</TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: 12 }}>Descripción</TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: 12 }} align="center">Estado</TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: 12 }} align="right">Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {impuestos.map((imp) => (
                <TableRow key={imp.id} sx={{ '&:last-child td': { border: 0 } }}>
                  <TableCell sx={{ fontWeight: 600, fontSize: 13 }}>{imp.nombre}</TableCell>
                  <TableCell>
                    <Chip label={imp.codigo} size="small" sx={{ fontWeight: 700, fontSize: 11, height: 20, bgcolor: alpha(ACCENT, 0.1), color: ACCENT }} />
                  </TableCell>
                  <TableCell align="center">
                    <Chip
                      label={`${imp.porcentaje}%`}
                      size="small"
                      sx={{
                        fontWeight: 700, fontSize: 12, height: 22,
                        bgcolor: imp.porcentaje > 0 ? alpha('#F43F5E', 0.1) : alpha('#10B981', 0.1),
                        color: imp.porcentaje > 0 ? '#F43F5E' : '#10B981',
                      }}
                    />
                  </TableCell>
                  <TableCell sx={{ fontSize: 12, color: 'text.secondary', maxWidth: 220 }}>
                    {imp.descripcion || '—'}
                  </TableCell>
                  <TableCell align="center">
                    <Chip
                      label={imp.is_active ? 'Activo' : 'Inactivo'}
                      size="small"
                      sx={{
                        fontSize: 10, height: 18,
                        bgcolor: imp.is_active ? alpha('#10B981', 0.1) : alpha('#94a3b8', 0.1),
                        color: imp.is_active ? '#10B981' : '#94a3b8',
                      }}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="Editar">
                      <IconButton size="small" onClick={() => openEdit(imp)} sx={{ color: 'text.secondary' }}>
                        <Edit fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Eliminar">
                      <IconButton size="small" onClick={() => setDeleteConfirm(imp)} sx={{ color: '#EF4444' }}>
                        <Delete fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      )}

      {/* Dialog Crear/Editar */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>
          {editing ? 'Editar Tipo de Impuesto' : 'Nuevo Tipo de Impuesto'}
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              label="Nombre *"
              value={form.nombre}
              onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
              fullWidth
              placeholder="Ej: IVA 19%"
            />
            <TextField
              label="Código *"
              value={form.codigo}
              onChange={e => setForm(f => ({ ...f, codigo: e.target.value.toUpperCase() }))}
              sx={{ width: 120 }}
              inputProps={{ maxLength: 10 }}
              placeholder="IVA19"
            />
          </Box>
          <TextField
            label="Porcentaje *"
            value={form.porcentaje}
            onChange={e => setForm(f => ({ ...f, porcentaje: e.target.value.replace(/[^0-9.]/g, '') }))}
            type="number"
            inputProps={{ min: 0, max: 100, step: 0.5 }}
            InputProps={{ endAdornment: <Typography sx={{ color: 'text.secondary', pr: 1 }}>%</Typography> }}
            helperText="0 = Excluido de IVA"
          />
          <TextField
            label="Descripción"
            value={form.descripcion}
            onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
            fullWidth
            multiline
            rows={2}
            placeholder="Ej: Tarifa general de IVA en Colombia (Ley 1943)"
          />
          <FormControlLabel
            control={<Switch checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} />}
            label="Impuesto activo"
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDialogOpen(false)} disabled={saving}>Cancelar</Button>
          <Button
            variant="contained" onClick={handleSave} disabled={saving}
            sx={{ background: `linear-gradient(135deg, ${ACCENT}, #fb7185)`, fontWeight: 700, borderRadius: 2 }}
          >
            {saving ? 'Guardando…' : editing ? 'Actualizar' : 'Crear'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog Confirmar Eliminación */}
      <Dialog open={Boolean(deleteConfirm)} onClose={() => setDeleteConfirm(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>¿Eliminar impuesto?</DialogTitle>
        <DialogContent>
          <Typography>
            Se eliminará <strong>{deleteConfirm?.nombre}</strong>. Los productos que lo tenían asignado quedarán sin impuesto.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleteConfirm(null)}>Cancelar</Button>
          <Button variant="contained" color="error" onClick={() => handleDelete(deleteConfirm)}>
            Eliminar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
