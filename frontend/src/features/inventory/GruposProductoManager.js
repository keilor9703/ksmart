import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Button, TextField, IconButton, Chip,
  Dialog, DialogTitle, DialogContent, DialogActions,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, Tooltip, Alert, useTheme, useMediaQuery, Divider,
  FormControlLabel, Switch,
} from '@mui/material';
import { Add, Edit, Delete, Lock, OutdoorGrill, PointOfSale, Settings } from '@mui/icons-material';
import { toast } from 'react-toastify';
import apiClient from '../../api';

const COLOR_PRESETS = [
  '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6',
  '#EF4444', '#06B6D4', '#EC4899', '#F97316',
  '#84CC16', '#6366F1', '#14B8A6', '#94a3b8',
];

const DEFAULT_FORM = { nombre: '', codigo: '', color: '#6366F1', orden: 99, requiere_cocina: false, visible_pos: true };

// ── Card móvil por categoría ──────────────────────────────────────────────────
const GrupoCard = ({ grupo, onEdit, onDelete, onConfig, esRestaurante }) => (
  <Paper sx={{
    p: 2, mb: 1.5, borderRadius: 2.5,
    border: '1px solid', borderColor: 'divider',
    boxShadow: '0 1px 6px rgba(0,0,0,0.05)',
    width: '100%', boxSizing: 'border-box',
  }}>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
      <Box sx={{ width: 26, height: 26, borderRadius: 1.5, bgcolor: grupo.color, flexShrink: 0, border: '2px solid', borderColor: 'divider' }} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontWeight: 700, fontSize: 14, lineHeight: 1.2 }}>{grupo.nombre}</Typography>
        <Chip label={grupo.codigo} size="small"
          sx={{ bgcolor: `${grupo.color}18`, color: grupo.color, fontWeight: 700, fontSize: 10, borderRadius: 1, height: 18, mt: 0.3 }} />
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
        {grupo.es_predefinido
          ? <>
              <Chip label="Sistema" size="small" icon={<Lock sx={{ fontSize: '11px !important' }} />}
                sx={{ fontSize: 9, bgcolor: 'action.hover', color: 'text.secondary', height: 20 }} />
              <Tooltip title="Configurar POS / Cocina">
                <IconButton size="small" onClick={() => onConfig(grupo)}
                  sx={{ color: '#F59E0B', bgcolor: '#FFFBEB', borderRadius: 1.5, width: 28, height: 28 }}>
                  <Settings sx={{ fontSize: 14 }} />
                </IconButton>
              </Tooltip>
            </>
          : <>
              <Tooltip title="Editar">
                <IconButton size="small" onClick={() => onEdit(grupo)}
                  sx={{ color: '#6366F1', bgcolor: '#EEF2FF', borderRadius: 1.5, width: 28, height: 28 }}>
                  <Edit sx={{ fontSize: 14 }} />
                </IconButton>
              </Tooltip>
              <Tooltip title="Eliminar">
                <IconButton size="small" onClick={() => onDelete(grupo.id)}
                  sx={{ color: '#EF4444', bgcolor: '#FEF2F2', borderRadius: 1.5, width: 28, height: 28 }}>
                  <Delete sx={{ fontSize: 14 }} />
                </IconButton>
              </Tooltip>
            </>
        }
      </Box>
    </Box>
    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
      <Box sx={{ px: 1.5, py: 0.5, borderRadius: 1.5, bgcolor: 'action.hover', textAlign: 'center' }}>
        <Typography sx={{ fontSize: 9, color: 'text.secondary' }}>Orden</Typography>
        <Typography sx={{ fontSize: 12, fontWeight: 700 }}>{grupo.orden}</Typography>
      </Box>
      <Box sx={{ px: 1.5, py: 0.5, borderRadius: 1.5, bgcolor: 'action.hover', textAlign: 'center' }}>
        <Typography sx={{ fontSize: 9, color: 'text.secondary' }}>Tipo</Typography>
        <Typography sx={{ fontSize: 12, fontWeight: 700 }}>{grupo.es_predefinido ? 'Sistema' : 'Custom'}</Typography>
      </Box>
      {esRestaurante && grupo.requiere_cocina && (
        <Chip
          icon={<OutdoorGrill sx={{ fontSize: '12px !important' }} />}
          label="Cocina"
          size="small"
          sx={{ fontSize: 10, bgcolor: 'rgba(236,72,153,0.1)', color: '#EC4899', height: 24, fontWeight: 700 }}
        />
      )}
      {grupo.visible_pos === false && (
        <Chip
          icon={<PointOfSale sx={{ fontSize: '12px !important' }} />}
          label="Oculto en POS"
          size="small"
          sx={{ fontSize: 10, bgcolor: 'action.hover', color: 'text.secondary', height: 24, fontWeight: 700 }}
        />
      )}
    </Box>
  </Paper>
);

export default function GruposProductoManager({ onGruposChange }) {
  const [grupos, setGrupos]               = useState([]);
  const [open, setOpen]                   = useState(false);
  const [editing, setEditing]             = useState(null);
  const [form, setForm]                   = useState(DEFAULT_FORM);
  const [saving, setSaving]               = useState(false);
  const [deleteId, setDeleteId]           = useState(null);
  const [esRestaurante, setEsRestaurante] = useState(false);
  // Config dialog — solo flags — para grupos predefinidos
  const [configGrupo, setConfigGrupo]     = useState(null); // grupo siendo configurado
  const [configForm, setConfigForm]       = useState({ requiere_cocina: false, visible_pos: true });
  const [savingConfig, setSavingConfig]   = useState(false);

  const theme    = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  useEffect(() => {
    fetchGrupos();
    apiClient.get('/restaurante/config').then(() => setEsRestaurante(true)).catch(() => {});
  }, []);

  const fetchGrupos = async () => {
    try {
      const res = await apiClient.get('/grupos-producto/');
      setGrupos(res.data || []);
      if (onGruposChange) onGruposChange(res.data || []);
    } catch { toast.error('Error al cargar categorías'); }
  };

  const openCreate = () => { setEditing(null); setForm(DEFAULT_FORM); setOpen(true); };

  const openEdit = (g) => {
    setEditing(g);
    setForm({ nombre: g.nombre, codigo: g.codigo, color: g.color, orden: g.orden, requiere_cocina: g.requiere_cocina || false, visible_pos: g.visible_pos !== false });
    setOpen(true);
  };

  const handleSave = async () => {
    if (!form.nombre.trim() || !form.codigo.trim()) {
      toast.error('Nombre y código son obligatorios');
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await apiClient.put(`/grupos-producto/${editing.id}`, form);
        toast.success('Categoría actualizada');
      } else {
        await apiClient.post('/grupos-producto/', form);
        toast.success('Categoría creada');
      }
      setOpen(false);
      fetchGrupos();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await apiClient.delete(`/grupos-producto/${deleteId}`);
      toast.success('Categoría eliminada');
      setDeleteId(null);
      fetchGrupos();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al eliminar');
      setDeleteId(null);
    }
  };

  const openConfig = (g) => {
    setConfigGrupo(g);
    setConfigForm({ requiere_cocina: g.requiere_cocina || false, visible_pos: g.visible_pos !== false });
  };

  const handleSaveConfig = async () => {
    setSavingConfig(true);
    try {
      await apiClient.patch(`/grupos-producto/${configGrupo.id}/config`, configForm);
      toast.success('Configuración guardada');
      setConfigGrupo(null);
      fetchGrupos();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al guardar');
    } finally {
      setSavingConfig(false);
    }
  };

  return (
    <Box sx={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>

      {/* ── Header ── */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography sx={{ fontWeight: 700, fontSize: 14 }}>Categorías / Grupos de Producto</Typography>
        <Button
          variant="contained" size="small" startIcon={<Add />}
          onClick={openCreate}
          sx={{ borderRadius: 2, fontWeight: 600, textTransform: 'none', fontSize: 13 }}
        >
          {isMobile ? 'Nueva' : 'Nueva Categoría'}
        </Button>
      </Box>

      <Alert severity="info" sx={{ mb: 2, fontSize: 12 }}>
        Las categorías con <Lock fontSize="inherit" sx={{ verticalAlign: 'middle', fontSize: 13 }} /> son predefinidas del sistema y no se pueden eliminar.
        Puedes agregar las tuyas según el tipo de negocio.
      </Alert>

      {/* ── Vista móvil: cards ── */}
      {isMobile ? (
        <Box>
          {grupos.map(g => (
            <GrupoCard key={g.id} grupo={g} onEdit={openEdit} onDelete={setDeleteId} onConfig={openConfig} esRestaurante={esRestaurante} />
          ))}
        </Box>
      ) : (
        /* ── Vista desktop: tabla ── */
        <Box sx={{ width: '100%', overflowX: 'auto' }}>
          <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2, minWidth: 480 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  {['Color', 'Nombre', 'Código', 'Orden', 'Tipo', ...(esRestaurante ? ['Cocina', 'POS'] : []), 'Acciones'].map(h => (
                    <TableCell key={h} sx={{ fontWeight: 700, fontSize: 11, textTransform: 'uppercase' }}>{h}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {grupos.map(g => (
                  <TableRow key={g.id} hover>
                    <TableCell>
                      <Box sx={{ width: 22, height: 22, borderRadius: 1, bgcolor: g.color, border: '2px solid #e2e8f0' }} />
                    </TableCell>
                    <TableCell sx={{ fontWeight: 600, fontSize: 13 }}>{g.nombre}</TableCell>
                    <TableCell>
                      <Chip label={g.codigo} size="small"
                        sx={{ bgcolor: `${g.color}18`, color: g.color, fontWeight: 700, fontSize: 10, borderRadius: 1 }} />
                    </TableCell>
                    <TableCell sx={{ color: 'text.secondary', fontSize: 12 }}>{g.orden}</TableCell>
                    <TableCell>
                      {g.es_predefinido
                        ? <Chip label="Sistema" size="small" icon={<Lock sx={{ fontSize: '12px !important' }} />}
                            sx={{ fontSize: 10, bgcolor: 'action.hover', color: 'text.secondary' }} />
                        : <Chip label="Personalizado" size="small"
                            sx={{ fontSize: 10, bgcolor: '#EFF6FF', color: '#3B82F6' }} />
                      }
                    </TableCell>
                    {esRestaurante && (
                      <TableCell>
                        {g.requiere_cocina
                          ? <Chip icon={<OutdoorGrill sx={{ fontSize: '12px !important' }} />} label="Sí"
                              size="small" sx={{ fontSize: 10, bgcolor: 'rgba(236,72,153,0.1)', color: '#EC4899', fontWeight: 700 }} />
                          : <Typography fontSize={11} color="text.disabled">—</Typography>
                        }
                      </TableCell>
                    )}
                    {esRestaurante && (
                      <TableCell>
                        {g.visible_pos !== false
                          ? <Chip icon={<PointOfSale sx={{ fontSize: '12px !important' }} />} label="Sí"
                              size="small" sx={{ fontSize: 10, bgcolor: 'rgba(16,185,129,0.1)', color: '#10B981', fontWeight: 700 }} />
                          : <Typography fontSize={11} color="text.disabled">Oculto</Typography>
                        }
                      </TableCell>
                    )}
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        {g.es_predefinido ? (
                          <Tooltip title="Configurar POS / Cocina">
                            <IconButton size="small" onClick={() => openConfig(g)}
                              sx={{ color: '#F59E0B', '&:hover': { bgcolor: '#FFFBEB' } }}>
                              <Settings fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        ) : (
                          <>
                            <Tooltip title="Editar">
                              <IconButton size="small" onClick={() => openEdit(g)}
                                sx={{ color: '#6366F1', '&:hover': { bgcolor: '#EEF2FF' } }}>
                                <Edit fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Eliminar">
                              <IconButton size="small" onClick={() => setDeleteId(g.id)}
                                sx={{ color: '#EF4444', '&:hover': { bgcolor: '#FEF2F2' } }}>
                                <Delete fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </>
                        )}
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}

      {/* ── Modal crear/editar ── */}
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="xs" fullWidth fullScreen={isMobile}>
        <DialogTitle sx={{ fontWeight: 700, fontSize: 16 }}>
          {editing ? 'Editar Categoría' : 'Nueva Categoría'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField
              label="Nombre *" fullWidth size="small"
              value={form.nombre}
              onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
              placeholder="Ej: Celulares, Colchones, Ropa..."
            />
            <TextField
              label="Código corto *" fullWidth size="small"
              value={form.codigo}
              onChange={e => setForm(f => ({ ...f, codigo: e.target.value.toUpperCase().slice(0, 10) }))}
              placeholder="Ej: CEL, COL, RPA"
              helperText="Máximo 10 caracteres, se guarda en mayúsculas"
            />
            <TextField
              label="Orden de visualización" fullWidth size="small" type="number"
              value={form.orden}
              onChange={e => setForm(f => ({ ...f, orden: parseInt(e.target.value) || 99 }))}
              helperText="Menor número = aparece primero"
            />
            <Box>
              <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 1 }}>Color</Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {COLOR_PRESETS.map(c => (
                  <Box
                    key={c}
                    onClick={() => setForm(f => ({ ...f, color: c }))}
                    sx={{
                      width: 28, height: 28, borderRadius: 1.5, bgcolor: c, cursor: 'pointer',
                      border: form.color === c ? '3px solid #1F1F1F' : '2px solid transparent',
                      transition: 'transform 0.1s',
                      '&:hover': { transform: 'scale(1.15)' },
                    }}
                  />
                ))}
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1.5 }}>
                <Box sx={{ width: 32, height: 32, borderRadius: 1.5, bgcolor: form.color, border: '2px solid #e2e8f0', flexShrink: 0 }} />
                <TextField
                  size="small" label="Hex personalizado"
                  value={form.color}
                  onChange={e => setForm(f => ({ ...f, color: e.target.value }))}
                  sx={{ flex: 1 }}
                  inputProps={{ maxLength: 7 }}
                />
              </Box>
            </Box>

            {esRestaurante && (
              <Box sx={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                p: 1.5, borderRadius: 2,
                border: `1px solid ${form.requiere_cocina ? 'rgba(236,72,153,0.4)' : 'rgba(0,0,0,0.12)'}`,
                bgcolor: form.requiere_cocina ? 'rgba(236,72,153,0.06)' : 'transparent',
                transition: 'all 0.2s',
              }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <OutdoorGrill sx={{ fontSize: 18, color: form.requiere_cocina ? '#EC4899' : 'text.disabled' }} />
                  <Box>
                    <Typography fontSize={13} fontWeight={600}>¿Va a cocina?</Typography>
                    <Typography fontSize={11} color="text.secondary">
                      Los productos de esta categoría se enviarán a la pantalla de cocina
                    </Typography>
                  </Box>
                </Box>
                <Switch
                  checked={form.requiere_cocina}
                  onChange={e => setForm(f => ({ ...f, requiere_cocina: e.target.checked }))}
                  size="small"
                  sx={{ '& .MuiSwitch-thumb': { bgcolor: form.requiere_cocina ? '#EC4899' : undefined },
                        '& .Mui-checked + .MuiSwitch-track': { bgcolor: '#EC4899 !important' } }}
                />
              </Box>
            )}

            {esRestaurante && (
              <Box sx={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                p: 1.5, borderRadius: 2,
                border: `1px solid ${form.visible_pos ? 'rgba(16,185,129,0.4)' : 'rgba(0,0,0,0.12)'}`,
                bgcolor: form.visible_pos ? 'rgba(16,185,129,0.06)' : 'transparent',
                transition: 'all 0.2s',
              }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <PointOfSale sx={{ fontSize: 18, color: form.visible_pos ? '#10B981' : 'text.disabled' }} />
                  <Box>
                    <Typography fontSize={13} fontWeight={600}>¿Visible en POS?</Typography>
                    <Typography fontSize={11} color="text.secondary">
                      Los productos de esta categoría aparecerán en ventas POS y en el menú de los meseros
                    </Typography>
                  </Box>
                </Box>
                <Switch
                  checked={form.visible_pos}
                  onChange={e => setForm(f => ({ ...f, visible_pos: e.target.checked }))}
                  size="small"
                  sx={{ '& .MuiSwitch-thumb': { bgcolor: form.visible_pos ? '#10B981' : undefined },
                        '& .Mui-checked + .MuiSwitch-track': { bgcolor: '#10B981 !important' } }}
                />
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setOpen(false)} sx={{ color: 'text.secondary', fontWeight: 600 }}>Cancelar</Button>
          <Button onClick={handleSave} variant="contained" disabled={saving}
            sx={{ borderRadius: 2, fontWeight: 600, textTransform: 'none' }}>
            {saving ? 'Guardando...' : editing ? 'Actualizar' : 'Crear'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Confirmación eliminar ── */}
      <Dialog open={Boolean(deleteId)} onClose={() => setDeleteId(null)} maxWidth="xs">
        <DialogTitle sx={{ fontWeight: 700 }}>Eliminar categoría</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: 14 }}>
            ¿Confirmas eliminar esta categoría? Solo se puede eliminar si no tiene productos asignados.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleteId(null)} sx={{ color: 'text.secondary', fontWeight: 600 }}>Cancelar</Button>
          <Button onClick={handleDelete} color="error" variant="contained"
            sx={{ borderRadius: 2, fontWeight: 600, textTransform: 'none' }}>
            Eliminar
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Modal configurar flags para categorías del sistema ── */}
      <Dialog open={Boolean(configGrupo)} onClose={() => setConfigGrupo(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, fontSize: 16 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{ width: 14, height: 14, borderRadius: 1, bgcolor: configGrupo?.color, flexShrink: 0 }} />
            {configGrupo?.nombre}
          </Box>
        </DialogTitle>
        <DialogContent>
          <Typography fontSize={12} color="text.secondary" sx={{ mb: 2 }}>
            Estos ajustes solo afectan a tu empresa.
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Box sx={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              p: 1.5, borderRadius: 2,
              border: `1px solid ${configForm.visible_pos ? 'rgba(16,185,129,0.4)' : 'rgba(0,0,0,0.12)'}`,
              bgcolor: configForm.visible_pos ? 'rgba(16,185,129,0.06)' : 'transparent',
              transition: 'all 0.2s',
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <PointOfSale sx={{ fontSize: 18, color: configForm.visible_pos ? '#10B981' : 'text.disabled' }} />
                <Box>
                  <Typography fontSize={13} fontWeight={600}>¿Visible en POS?</Typography>
                  <Typography fontSize={11} color="text.secondary">Aparece en ventas POS y en el menú de meseros</Typography>
                </Box>
              </Box>
              <Switch
                checked={configForm.visible_pos}
                onChange={e => setConfigForm(f => ({ ...f, visible_pos: e.target.checked }))}
                size="small"
                sx={{ '& .Mui-checked + .MuiSwitch-track': { bgcolor: '#10B981 !important' } }}
              />
            </Box>

            {esRestaurante && (
              <Box sx={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                p: 1.5, borderRadius: 2,
                border: `1px solid ${configForm.requiere_cocina ? 'rgba(236,72,153,0.4)' : 'rgba(0,0,0,0.12)'}`,
                bgcolor: configForm.requiere_cocina ? 'rgba(236,72,153,0.06)' : 'transparent',
                transition: 'all 0.2s',
              }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <OutdoorGrill sx={{ fontSize: 18, color: configForm.requiere_cocina ? '#EC4899' : 'text.disabled' }} />
                  <Box>
                    <Typography fontSize={13} fontWeight={600}>¿Va a cocina?</Typography>
                    <Typography fontSize={11} color="text.secondary">Los pedidos de esta categoría se envían a cocina</Typography>
                  </Box>
                </Box>
                <Switch
                  checked={configForm.requiere_cocina}
                  onChange={e => setConfigForm(f => ({ ...f, requiere_cocina: e.target.checked }))}
                  size="small"
                  sx={{ '& .Mui-checked + .MuiSwitch-track': { bgcolor: '#EC4899 !important' } }}
                />
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setConfigGrupo(null)} sx={{ color: 'text.secondary', fontWeight: 600 }}>Cancelar</Button>
          <Button onClick={handleSaveConfig} variant="contained" disabled={savingConfig}
            sx={{ borderRadius: 2, fontWeight: 600, textTransform: 'none' }}>
            {savingConfig ? 'Guardando...' : 'Guardar'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
