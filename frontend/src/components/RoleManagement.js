import React, { useState, useEffect } from 'react';
import apiClient from '../api';
import { toast } from 'react-toastify';
import {
  Box, Typography, Grid, TextField, Button, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, IconButton,
  Paper, Chip, Divider, Collapse, Tooltip, useMediaQuery, useTheme
} from '@mui/material';
import { Edit, AdminPanelSettings, ExpandMore, ExpandLess, Close, Check } from '@mui/icons-material';

const ACCENT = '#8B5CF6';

// ─── Toggle de módulo ─────────────────────────────────────────────────────────
const ModuleToggle = ({ module, checked, onChange }) => (
  <Box
    onClick={() => onChange(module.id)}
    sx={{
      display: 'flex', alignItems: 'center', gap: 1,
      px: 1.5, py: 1, borderRadius: 2, cursor: 'pointer',
      border: '1px solid',
      borderColor: checked ? ACCENT : 'divider',
      bgcolor: checked ? `${ACCENT}10` : 'action.hover',
      transition: 'all 0.15s ease',
      '&:hover': { borderColor: ACCENT, bgcolor: `${ACCENT}08` },
    }}
  >
    <Box sx={{
      width: 18, height: 18, borderRadius: 1, flexShrink: 0,
      border: `2px solid ${checked ? ACCENT : '#94a3b8'}`,
      bgcolor: checked ? ACCENT : 'transparent',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      transition: 'all 0.15s',
    }}>
      {checked && <Check sx={{ fontSize: 12, color: '#fff' }} />}
    </Box>
    <Typography sx={{ fontSize: 12.5, fontWeight: checked ? 600 : 400, color: checked ? ACCENT : 'text.primary' }}>
      {module.name}
    </Typography>
  </Box>
);

// ─── Componente principal ──────────────────────────────────────────────────────
const RoleManagement = () => {
  const [roles, setRoles]               = useState([]);
  const [roleName, setRoleName]         = useState('');
  const [editingRole, setEditingRole]   = useState(null);
  const [modules, setModules]           = useState([]);
  const [selectedModules, setSelectedModules] = useState([]);
  const [formOpen, setFormOpen]         = useState(false);

  const theme    = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  useEffect(() => { fetchRoles(); fetchModules(); }, []);

  const fetchRoles   = async () => {
    try { const r = await apiClient.get('/roles/');   setRoles(r.data);   } catch { toast.error('Error al cargar roles.'); }
  };
  const fetchModules = async () => {
    try { const r = await apiClient.get('/modulos/'); setModules(r.data); } catch { toast.error('Error al cargar módulos.'); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingRole) {
        await apiClient.put(`/roles/${editingRole.id}/modules`, selectedModules);
        toast.success('Rol actualizado exitosamente');
      } else {
        const newRole = await apiClient.post('/roles/', { name: roleName });
        if (selectedModules.length > 0) {
          await apiClient.put(`/roles/${newRole.data.id}/modules`, selectedModules);
        }
        toast.success('Rol creado exitosamente');
      }
      resetForm(); fetchRoles();
    } catch (err) { toast.error(`Error al guardar rol: ${err.response?.data?.detail || err.message}`); }
  };

  const handleEdit = (role) => {
    setEditingRole(role); setRoleName(role.name);
    setSelectedModules(role.modules.map(m => m.id));
    setFormOpen(true); window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleModuleChange = (id) =>
    setSelectedModules(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const resetForm = () => {
    setRoleName(''); setEditingRole(null);
    setSelectedModules([]); setFormOpen(false);
  };

  return (
    <Box>
      {/* ── Header ── */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ width: 40, height: 40, borderRadius: 2, bgcolor: `${ACCENT}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: ACCENT }}>
            <AdminPanelSettings />
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 700, fontSize: 18, lineHeight: 1.2 }}>Roles</Typography>
            <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>{roles.length} rol{roles.length !== 1 ? 'es' : ''} configurado{roles.length !== 1 ? 's' : ''}</Typography>
          </Box>
        </Box>
        <Button variant="contained" startIcon={<AdminPanelSettings />}
          onClick={() => { resetForm(); setFormOpen(true); }}
          sx={{ background: `linear-gradient(135deg, ${ACCENT}, #a78bfa)`, boxShadow: `0 4px 14px rgba(139,92,246,0.3)`, borderRadius: 2, fontWeight: 600 }}>
          Nuevo Rol
        </Button>
      </Box>

      {/* ── Formulario ── */}
      <Box sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider', bgcolor: 'background.paper', overflow: 'hidden', mb: 3, boxShadow: formOpen ? '0 4px 24px rgba(0,0,0,0.08)' : '0 2px 8px rgba(0,0,0,0.04)' }}>
        <Box onClick={() => setFormOpen(o => !o)}
          sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2.5, py: 1.8, cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{ width: 32, height: 32, borderRadius: 1.5, bgcolor: `${ACCENT}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: ACCENT }}>
              <AdminPanelSettings fontSize="small" />
            </Box>
            <Typography sx={{ fontWeight: 600, fontSize: 14 }}>
              {editingRole ? 'Editar Rol' : 'Nuevo Rol'}
            </Typography>
            {editingRole && <Chip label="Editando" size="small" sx={{ bgcolor: `${ACCENT}18`, color: ACCENT, fontWeight: 600, fontSize: 11 }} />}
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
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Nombre del Rol" value={roleName}
                  onChange={e => setRoleName(e.target.value)}
                  fullWidth required
                  disabled={!!editingRole}
                  helperText={editingRole ? 'El nombre del rol no se puede cambiar' : ''}
                />
              </Grid>

              <Grid item xs={12}>
                <Typography sx={{ fontWeight: 600, fontSize: 12, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.6, mb: 1.5 }}>
                  Módulos con acceso ({selectedModules.length}/{modules.length})
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  {modules.map(m => (
                    <ModuleToggle key={m.id} module={m} checked={selectedModules.includes(m.id)} onChange={handleModuleChange} />
                  ))}
                </Box>
                {modules.length === 0 && (
                  <Typography sx={{ fontSize: 13, color: 'text.secondary', fontStyle: 'italic' }}>No hay módulos registrados</Typography>
                )}
              </Grid>

              <Grid item xs={12}>
                <Box sx={{ display: 'flex', gap: 1.5, justifyContent: 'flex-end' }}>
                  <Button onClick={resetForm} variant="outlined"
                    sx={{ borderRadius: 2, fontWeight: 600, borderColor: 'divider', color: 'text.secondary' }}>
                    Cancelar
                  </Button>
                  <Button type="submit" variant="contained"
                    sx={{ background: `linear-gradient(135deg, ${ACCENT}, #a78bfa)`, boxShadow: `0 4px 14px rgba(139,92,246,0.3)`, borderRadius: 2, fontWeight: 600 }}>
                    {editingRole ? 'Actualizar Rol' : 'Crear Rol'}
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
          <Typography sx={{ fontWeight: 700, fontSize: 15 }}>Lista de Roles</Typography>
        </Box>
        <Box sx={{ p: 2.5 }}>
          {isMobile ? (
            <Box>
              {roles.length === 0
                ? <Typography sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>No hay roles</Typography>
                : roles.map(role => (
                    <Paper key={role.id} sx={{ p: 2.5, mb: 2, borderRadius: 3, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: ACCENT }} />
                          <Typography sx={{ fontWeight: 700, fontSize: 15 }}>{role.name}</Typography>
                          <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>#{role.id}</Typography>
                        </Box>
                        <Tooltip title="Editar módulos">
                          <IconButton size="small" onClick={() => handleEdit(role)}
                            sx={{ color: ACCENT, bgcolor: `${ACCENT}12`, borderRadius: 1.5 }}>
                            <Edit fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                      <Divider sx={{ mb: 1.5 }} />
                      <Typography sx={{ fontSize: 11, color: 'text.secondary', mb: 0.8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        Módulos ({role.modules.length})
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                        {role.modules.length === 0
                          ? <Typography sx={{ fontSize: 12, color: 'text.secondary', fontStyle: 'italic' }}>Sin módulos asignados</Typography>
                          : role.modules.map(m => (
                              <Chip key={m.id} label={m.name} size="small"
                                sx={{ bgcolor: `${ACCENT}10`, color: ACCENT, fontWeight: 600, fontSize: 10, borderRadius: 1 }} />
                            ))
                        }
                      </Box>
                    </Paper>
                  ))
              }
            </Box>
          ) : (
            <TableContainer sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    {['#', 'Nombre', 'Módulos asignados', 'Acciones'].map(h => (
                      <TableCell key={h}>{h}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {roles.length === 0
                    ? <TableRow><TableCell colSpan={4} sx={{ textAlign: 'center', py: 5, color: 'text.secondary' }}>No hay roles</TableCell></TableRow>
                    : roles.map(role => (
                        <TableRow key={role.id} hover>
                          <TableCell sx={{ fontWeight: 600, color: 'text.secondary', fontSize: 12 }}>#{role.id}</TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: ACCENT, flexShrink: 0 }} />
                              {role.name}
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                              {role.modules.length === 0
                                ? <Typography sx={{ fontSize: 12, color: 'text.secondary', fontStyle: 'italic' }}>Sin módulos</Typography>
                                : role.modules.map(m => (
                                    <Chip key={m.id} label={m.name} size="small"
                                      sx={{ bgcolor: `${ACCENT}10`, color: ACCENT, fontWeight: 600, fontSize: 10, borderRadius: 1 }} />
                                  ))
                              }
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Tooltip title="Editar módulos">
                              <IconButton size="small" onClick={() => handleEdit(role)}
                                sx={{ color: ACCENT, '&:hover': { bgcolor: `${ACCENT}12` } }}>
                                <Edit fontSize="small" />
                              </IconButton>
                            </Tooltip>
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
    </Box>
  );
};

export default RoleManagement;
