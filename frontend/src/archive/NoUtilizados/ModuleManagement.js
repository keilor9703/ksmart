import React, { useState, useEffect } from 'react';
import apiClient from '../../api';
import { toast } from 'react-toastify';
import ConfirmationDialog from '../../components/common/ConfirmationDialog';
import {
  Box, Typography, Grid, TextField, Button, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, IconButton,
  Paper, Chip, Divider, Collapse, Tooltip, useMediaQuery, useTheme
} from '@mui/material';
import { Edit, Delete, Extension, ExpandMore, ExpandLess, Close, Code } from '@mui/icons-material';

const ACCENT = '#8B5CF6';

// ─── Card mobile ──────────────────────────────────────────────────────────────
const ModuleCard = ({ modulo, handleEdit, handleDelete }) => (
  <Paper sx={{ p: 2.5, mb: 2, borderRadius: 3, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
      <Box>
        <Typography sx={{ fontWeight: 700, fontSize: 14 }}>{modulo.name}</Typography>
        <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>#{modulo.id}</Typography>
      </Box>
      <Box sx={{ display: 'flex', gap: 0.5 }}>
        <Tooltip title="Editar">
          <IconButton size="small" onClick={() => handleEdit(modulo)}
            sx={{ color: ACCENT, bgcolor: `${ACCENT}12`, borderRadius: 1.5 }}>
            <Edit fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Eliminar">
          <IconButton size="small" onClick={() => handleDelete(modulo.id)}
            sx={{ color: '#EF4444', bgcolor: '#FEF2F2', borderRadius: 1.5 }}>
            <Delete fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
    <Divider sx={{ my: 1.5 }} />
    <Grid container spacing={1}>
      <Grid item xs={6}>
        <Box sx={{ p: 1, borderRadius: 1.5, bgcolor: 'action.hover' }}>
          <Typography sx={{ fontSize: 9, color: 'text.secondary', mb: 0.2 }}>Descripción</Typography>
          <Typography sx={{ fontSize: 12, fontWeight: 600 }}>{modulo.description || '—'}</Typography>
        </Box>
      </Grid>
      <Grid item xs={6}>
        <Box sx={{ p: 1, borderRadius: 1.5, bgcolor: 'action.hover' }}>
          <Typography sx={{ fontSize: 9, color: 'text.secondary', mb: 0.2 }}>Ruta frontend</Typography>
          <Typography sx={{ fontSize: 11, fontWeight: 600, fontFamily: 'monospace', color: ACCENT }}>{modulo.frontend_path}</Typography>
        </Box>
      </Grid>
    </Grid>
  </Paper>
);

// ─── Componente principal ──────────────────────────────────────────────────────
const ModuleManagement = () => {
  const [modulos, setModulos]                     = useState([]);
  const [moduleName, setModuleName]               = useState('');
  const [moduleDescription, setModuleDescription] = useState('');
  const [moduleFrontendPath, setModuleFrontendPath] = useState('');
  const [editingModulo, setEditingModulo]         = useState(null);
  const [formOpen, setFormOpen]                   = useState(false);

  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [moduloToDelete, setModuloToDelete]       = useState(null);

  const theme    = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  useEffect(() => { fetchModulos(); }, []);

  const fetchModulos = async () => {
    try { const r = await apiClient.get('/modulos/'); setModulos(r.data); }
    catch { toast.error('Error al cargar módulos.'); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const data = { name: moduleName, description: moduleDescription, frontend_path: moduleFrontendPath };
    try {
      if (editingModulo) {
        await apiClient.put(`/modulos/${editingModulo.id}`, data);
        toast.success('Módulo actualizado exitosamente');
      } else {
        await apiClient.post('/modulos/', data);
        toast.success('Módulo creado exitosamente');
      }
      resetForm(); fetchModulos();
    } catch (err) { toast.error(`Error al guardar módulo: ${err.response?.data?.detail || err.message}`); }
  };

  const handleEdit = (modulo) => {
    setEditingModulo(modulo); setModuleName(modulo.name);
    setModuleDescription(modulo.description); setModuleFrontendPath(modulo.frontend_path);
    setFormOpen(true); window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = (id) => { setModuloToDelete(id); setShowConfirmDialog(true); };
  const confirmDelete = async () => {
    try { await apiClient.delete(`/modulos/${moduloToDelete}`); toast.success('Módulo eliminado'); fetchModulos(); }
    catch (err) { toast.error(`Error al eliminar: ${err.response?.data?.detail || err.message}`); }
    finally { setShowConfirmDialog(false); setModuloToDelete(null); }
  };

  const resetForm = () => {
    setModuleName(''); setModuleDescription(''); setModuleFrontendPath('');
    setEditingModulo(null); setFormOpen(false);
  };

  return (
    <Box>
      {/* ── Header ── */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ width: 40, height: 40, borderRadius: 2, bgcolor: `${ACCENT}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: ACCENT }}>
            <Extension />
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 700, fontSize: 18, lineHeight: 1.2 }}>Módulos</Typography>
            <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>{modulos.length} módulo{modulos.length !== 1 ? 's' : ''} registrado{modulos.length !== 1 ? 's' : ''}</Typography>
          </Box>
        </Box>
        <Button variant="contained" startIcon={<Extension />}
          onClick={() => { resetForm(); setFormOpen(true); }}
          sx={{ background: `linear-gradient(135deg, ${ACCENT}, #a78bfa)`, boxShadow: `0 4px 14px rgba(139,92,246,0.3)`, borderRadius: 2, fontWeight: 600 }}>
          Nuevo Módulo
        </Button>
      </Box>

      {/* ── Formulario ── */}
      <Box sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider', bgcolor: 'background.paper', overflow: 'hidden', mb: 3, boxShadow: formOpen ? '0 4px 24px rgba(0,0,0,0.08)' : '0 2px 8px rgba(0,0,0,0.04)' }}>
        <Box onClick={() => setFormOpen(o => !o)}
          sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2.5, py: 1.8, cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{ width: 32, height: 32, borderRadius: 1.5, bgcolor: `${ACCENT}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: ACCENT }}>
              <Extension fontSize="small" />
            </Box>
            <Typography sx={{ fontWeight: 600, fontSize: 14 }}>
              {editingModulo ? 'Editar Módulo' : 'Nuevo Módulo'}
            </Typography>
            {editingModulo && <Chip label="Editando" size="small" sx={{ bgcolor: `${ACCENT}18`, color: ACCENT, fontWeight: 600, fontSize: 11 }} />}
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {formOpen && <Button size="small" startIcon={<Close fontSize="small" />} onClick={e => { e.stopPropagation(); resetForm(); }}
              sx={{ color: 'text.secondary', fontWeight: 600, fontSize: 12, textTransform: 'none' }}>Cerrar</Button>}
            {formOpen ? <ExpandLess sx={{ color: 'text.secondary' }} /> : <ExpandMore sx={{ color: 'text.secondary' }} />}
          </Box>
        </Box>

        <Collapse in={formOpen}>
          <Divider />
          <Box component="form" onSubmit={handleSubmit} sx={{ p: { xs: 2, md: 3 } }}>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={4}>
                <TextField
                  label="Nombre del Módulo" value={moduleName}
                  onChange={e => setModuleName(e.target.value)} fullWidth required
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  label="Descripción" value={moduleDescription}
                  onChange={e => setModuleDescription(e.target.value)} fullWidth
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  label="Ruta Frontend" value={moduleFrontendPath}
                  onChange={e => setModuleFrontendPath(e.target.value)} fullWidth required
                  helperText="Ej: /ventas, /inventario"
                  InputProps={{
                    startAdornment: <Code sx={{ fontSize: 16, color: 'text.secondary', mr: 0.5 }} />,
                  }}
                />
              </Grid>
              <Grid item xs={12}>
                <Box sx={{ display: 'flex', gap: 1.5, justifyContent: 'flex-end' }}>
                  <Button onClick={resetForm} variant="outlined"
                    sx={{ borderRadius: 2, fontWeight: 600, borderColor: 'divider', color: 'text.secondary' }}>
                    Cancelar
                  </Button>
                  <Button type="submit" variant="contained"
                    sx={{ background: `linear-gradient(135deg, ${ACCENT}, #a78bfa)`, boxShadow: `0 4px 14px rgba(139,92,246,0.3)`, borderRadius: 2, fontWeight: 600 }}>
                    {editingModulo ? 'Actualizar Módulo' : 'Crear Módulo'}
                  </Button>
                </Box>
              </Grid>
            </Grid>
          </Box>
        </Collapse>
      </Box>

      {/* ── Lista ── */}
      <Paper sx={{ borderRadius: 3, overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
        <Box sx={{ px: 2.5, py: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Typography sx={{ fontWeight: 700, fontSize: 15 }}>Lista de Módulos</Typography>
        </Box>
        <Box sx={{ p: 2.5 }}>
          {isMobile ? (
            <Box>
              {modulos.length === 0
                ? <Typography sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>No hay módulos registrados</Typography>
                : modulos.map(m => <ModuleCard key={m.id} modulo={m} handleEdit={handleEdit} handleDelete={handleDelete} />)
              }
            </Box>
          ) : (
            <TableContainer sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    {['#', 'Nombre', 'Descripción', 'Ruta Frontend', 'Acciones'].map(h => (
                      <TableCell key={h}>{h}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {modulos.length === 0
                    ? <TableRow><TableCell colSpan={5} sx={{ textAlign: 'center', py: 5, color: 'text.secondary' }}>No hay módulos</TableCell></TableRow>
                    : modulos.map(m => (
                        <TableRow key={m.id} hover>
                          <TableCell sx={{ fontWeight: 600, color: 'text.secondary', fontSize: 12 }}>#{m.id}</TableCell>
                          <TableCell sx={{ fontWeight: 600 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: ACCENT, flexShrink: 0 }} />
                              {m.name}
                            </Box>
                          </TableCell>
                          <TableCell sx={{ fontSize: 12, color: 'text.secondary' }}>{m.description || '—'}</TableCell>
                          <TableCell>
                            <Chip
                              label={m.frontend_path}
                              size="small"
                              icon={<Code sx={{ fontSize: 11, '&&': { color: ACCENT } }} />}
                              sx={{ bgcolor: `${ACCENT}10`, color: ACCENT, fontWeight: 600, fontSize: 11, fontFamily: 'monospace', borderRadius: 1.5 }}
                            />
                          </TableCell>
                          <TableCell>
                            <Box sx={{ display: 'flex', gap: 0.5 }}>
                              <Tooltip title="Editar">
                                <IconButton size="small" onClick={() => handleEdit(m)}
                                  sx={{ color: ACCENT, '&:hover': { bgcolor: `${ACCENT}12` } }}>
                                  <Edit fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Eliminar">
                                <IconButton size="small" onClick={() => handleDelete(m.id)}
                                  sx={{ color: '#EF4444', '&:hover': { bgcolor: '#FEF2F2' } }}>
                                  <Delete fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </Box>
                          </TableCell>
                        </TableRow>
                      ))
                  }
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Box>
      </Paper>

      <ConfirmationDialog
        open={showConfirmDialog}
        handleClose={() => setShowConfirmDialog(false)}
        handleConfirm={confirmDelete}
        title="Eliminar módulo"
        message="¿Estás seguro? Eliminar este módulo podría afectar los roles que lo tienen asignado."
      />
    </Box>
  );
};

export default ModuleManagement;
