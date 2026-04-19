import React, { useState, useEffect } from 'react';
import apiClient from '../api';
import { toast } from 'react-toastify';
import ConfirmationDialog from './ConfirmationDialog';
import {
  Box, Paper, Typography, Grid, TextField, Button, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, IconButton, FormControl,
  InputLabel, Select, MenuItem, useMediaQuery, useTheme, Chip, Tooltip,
  Divider, Collapse, Avatar, Tabs, Tab, CircularProgress, Stack
} from '@mui/material';
import {
  Edit, Delete, PersonAdd, People, ExpandMore, ExpandLess,
  Close, AdminPanelSettings, Check, Security, Block, CheckCircle
} from '@mui/icons-material';

const ACCENT = '#8B5CF6'; // Violeta — Admin

// ─── Componente Auxiliar: Toggle de módulo ────────────────────────────────────
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

function TabPanel({ children, value, index }) {
  return (
    <div role="tabpanel" hidden={value !== index}>
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
}

// ─── Tarjeta de Usuario (Mobile) ──────────────────────────────────────────────
const UserCardMobile = ({ user, currentUser, onEdit, onToggle }) => (
  <Paper sx={{ p: 2, mb: 2, borderRadius: 3, border: '1px solid', borderColor: 'divider', opacity: user.is_active !== false ? 1 : 0.6 }}>
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Avatar sx={{ width: 36, height: 36, bgcolor: user.is_active !== false ? `${ACCENT}20` : '#cbd5e1', color: user.is_active !== false ? ACCENT : '#64748b', fontWeight: 800 }}>
          {user.username[0].toUpperCase()}
        </Avatar>
        <Box>
          <Typography sx={{ fontWeight: 800, fontSize: 16 }}>{user.username}</Typography>
          <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>ID: #{user.id}</Typography>
        </Box>
      </Box>
      <Chip 
        label={user.is_active !== false ? 'Activo' : 'Suspendido'} 
        size="small" 
        sx={{ bgcolor: user.is_active !== false ? '#ECFDF5' : '#FEF2F2', color: user.is_active !== false ? '#10B981' : '#EF4444', fontWeight: 800, fontSize: 10 }} 
      />
    </Box>
    <Divider sx={{ mb: 1.5, borderStyle: 'dashed' }} />
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <Chip label={user.role.name} size="small" sx={{ bgcolor: `${ACCENT}15`, color: ACCENT, fontWeight: 700, fontSize: 11 }} />
      <Box>
        <IconButton size="small" onClick={() => onEdit(user)} sx={{ color: ACCENT, bgcolor: `${ACCENT}10`, mr: 1 }}><Edit fontSize="small" /></IconButton>
        <IconButton 
          size="small" 
          disabled={currentUser?.id === user.id} 
          onClick={() => onToggle(user)} 
          sx={{ color: user.is_active !== false ? '#EF4444' : '#10B981', bgcolor: user.is_active !== false ? '#FEF2F2' : '#ECFDF5' }}
        >
          {user.is_active !== false ? <Block fontSize="small" /> : <CheckCircle fontSize="small" />}
        </IconButton>
      </Box>
    </Box>
  </Paper>
);

// ─── Componente Principal ──────────────────────────────────────────────────────
export default function AdminUsuarios() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [tab, setTab] = useState(0);

  const [users, setUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [roleId, setRoleId] = useState('');
  const [editingUser, setEditingUser] = useState(null);
  const [formUserOpen, setFormUserOpen] = useState(false);
  const [showConfirmUser, setShowConfirmUser] = useState(false);
  const [userToToggle, setUserToToggle] = useState(null);

  const [roles, setRoles] = useState([]);
  const [modules, setModules] = useState([]);
  const [roleName, setRoleName] = useState('');
  const [editingRole, setEditingRole] = useState(null);
  const [selectedModules, setSelectedModules] = useState([]);
  const [formRoleOpen, setFormRoleOpen] = useState(false);

  useEffect(() => {
    fetchUsers(); fetchRoles(); fetchModules(); fetchMe();
  }, []);

  const fetchMe = async () => { try { const r = await apiClient.get('/users/me'); setCurrentUser(r.data); } catch { } };
  const fetchUsers = async () => { try { const r = await apiClient.get('/users/'); setUsers(r.data); } catch { toast.error('Error al cargar usuarios.'); } };
  const fetchRoles = async () => { try { const r = await apiClient.get('/roles/'); setRoles(r.data); } catch { toast.error('Error al cargar roles.'); } };
  const fetchModules = async () => { try { const r = await apiClient.get('/modulos/'); setModules(r.data); } catch { toast.error('Error al cargar módulos.'); } };

  const handleUserSubmit = async (e) => {
    e.preventDefault();
    const userData = { username, password, role_id: parseInt(roleId) };
    try {
      if (editingUser) {
        await apiClient.put(`/users/${editingUser.id}`, userData);
        toast.success('Usuario actualizado exitosamente');
      } else {
        await apiClient.post('/users/', userData);
        toast.success('Usuario creado exitosamente');
      }
      resetUserForm(); fetchUsers();
    } catch (err) { 
        toast.error(err.response?.data?.detail || 'Error al guardar usuario', { autoClose: 5000 }); 
    }
  };

  const resetUserForm = () => { setUsername(''); setPassword(''); setRoleId(''); setEditingUser(null); setFormUserOpen(false); };

  const handleEditUser = (user) => { 
    setEditingUser(user); 
    setUsername(user.username); 
    setRoleId(user.role.id); 
    setPassword(''); 
    setFormUserOpen(true); 
    window.scrollTo({ top: 0, behavior: 'smooth' }); 
  };

  const handleToggleClick = (user) => { setUserToToggle(user); setShowConfirmUser(true); };

  const confirmToggleUser = async () => {
    try {
      if (userToToggle.is_active !== false) {
        await apiClient.delete(`/users/${userToToggle.id}`);
        toast.success('Acceso suspendido correctamente');
      } else {
        await apiClient.patch(`/users/${userToToggle.id}/toggle`);
        toast.success('Usuario reactivado exitosamente');
      }
      fetchUsers();
    } catch (err) { toast.error(err.response?.data?.detail || 'Error al cambiar estado'); }
    finally { setShowConfirmUser(false); setUserToToggle(null); }
  };

  const handleRoleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingRole) {
        await apiClient.put(`/roles/${editingRole.id}/modules`, selectedModules);
        toast.success('Permisos del rol actualizados');
      } else {
        const newRole = await apiClient.post('/roles/', { name: roleName });
        if (selectedModules.length > 0) {
          await apiClient.put(`/roles/${newRole.data.id}/modules`, selectedModules);
        }
        toast.success('Rol creado exitosamente');
      }
      resetRoleForm(); fetchRoles();
    } catch (err) { toast.error(err.response?.data?.detail || 'Error al guardar rol'); }
  };

  const resetRoleForm = () => { setRoleName(''); setEditingRole(null); setSelectedModules([]); setFormRoleOpen(false); };
  const handleEditRole = (role) => { setEditingRole(role); setRoleName(role.name); setSelectedModules(role.modules.map(m => m.id)); setFormRoleOpen(true); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const handleModuleChange = (id) => setSelectedModules(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  return (
    <Box sx={{ width: '100%' }}>
      {/* ── Header ── */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3, gap: 1.5 }}>
        <Box sx={{ width: 40, height: 40, borderRadius: 2, bgcolor: `${ACCENT}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: ACCENT }}>
          <AdminPanelSettings />
        </Box>
        <Box>
          <Typography sx={{ fontWeight: 800, fontSize: 20, lineHeight: 1.2 }}>Usuarios y Permisos</Typography>
          <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>Control de acceso del personal</Typography>
        </Box>
      </Box>

      {/* ── Contenedor Principal (Tabs) ── */}
      <Paper sx={{ borderRadius: 4, boxShadow: '0 4px 20px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          variant={isMobile ? 'fullWidth' : 'standard'}
          sx={{
            px: 2, borderBottom: '1px solid', borderColor: 'divider',
            '& .MuiTab-root': { fontWeight: 700, fontSize: 13, textTransform: 'none', minHeight: 52 },
            '& .MuiTabs-indicator': { backgroundColor: ACCENT, height: 3, borderRadius: 3 },
            '& .Mui-selected': { color: `${ACCENT} !important` },
          }}
        >
          <Tab icon={<People sx={{ fontSize: 18, mr: 1 }} />} iconPosition="start" label="Usuarios" />
          <Tab icon={<Security sx={{ fontSize: 18, mr: 1 }} />} iconPosition="start" label="Roles y Módulos" />
        </Tabs>

        <Box sx={{ p: { xs: 2, md: 3 } }}>

          {/* ════ TAB 0: USUARIOS ════ */}
          <TabPanel value={tab} index={0}>
            <Box sx={{ mb: 3, display: 'flex', justifyContent: 'flex-end' }}>
              <Button variant="contained" startIcon={<PersonAdd />} onClick={() => { resetUserForm(); setFormUserOpen(true); }}
                sx={{ bgcolor: ACCENT, borderRadius: 2, fontWeight: 700, boxShadow: `0 4px 14px ${ACCENT}40` }}>
                Nuevo Usuario
              </Button>
            </Box>

            {/* Formulario Usuarios */}
            <Collapse in={formUserOpen}>
              <Paper sx={{ p: 3, mb: 3, borderRadius: 3, border: `1px solid ${ACCENT}50`, bgcolor: 'background.default', boxShadow: 'none' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography sx={{ fontWeight: 800 }}>{editingUser ? 'Editar Usuario' : 'Crear Usuario'}</Typography>
                  <IconButton size="small" onClick={resetUserForm}><Close fontSize="small" /></IconButton>
                </Box>
                <Box component="form" onSubmit={handleUserSubmit}>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={4}>
                      <TextField label="Nombre de usuario" value={username} onChange={e => setUsername(e.target.value)} fullWidth required size="small"/>
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <TextField label="Contraseña" type="password" value={password} onChange={e => setPassword(e.target.value)} fullWidth required={!editingUser} size="small" helperText={editingUser ? 'Dejar en blanco para no cambiarla' : ''} />
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <FormControl fullWidth required size="small">
                        <InputLabel>Rol</InputLabel>
                        <Select value={roleId} label="Rol" onChange={e => setRoleId(e.target.value)}>
                          {roles.map(r => <MenuItem key={r.id} value={r.id}>{r.name}</MenuItem>)}
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={12} sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
                      <Button type="submit" variant="contained" sx={{ bgcolor: ACCENT, fontWeight: 700 }}>
                        {editingUser ? 'Actualizar' : 'Guardar'}
                      </Button>
                    </Grid>
                  </Grid>
                </Box>
              </Paper>
            </Collapse>

            {/* Lista de Usuarios (Responsive) */}
            {isMobile ? (
               <Stack spacing={0}>
                  {users.map(u => (
                    <UserCardMobile key={u.id} user={u} currentUser={currentUser} onEdit={handleEditUser} onToggle={handleToggleClick} />
                  ))}
               </Stack>
            ) : (
              <TableContainer sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: 'action.hover' }}>
                      {['#', 'Usuario', 'Rol', 'Estado', 'Acciones'].map(h => <TableCell key={h} sx={{ fontWeight: 800 }}>{h}</TableCell>)}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {users.length === 0 ? <TableRow><TableCell colSpan={5} align="center" sx={{ py: 3 }}>No hay usuarios</TableCell></TableRow> :
                      users.map(u => (
                        <TableRow key={u.id} hover sx={{ opacity: u.is_active !== false ? 1 : 0.6 }}>
                          <TableCell sx={{ color: 'text.secondary', fontSize: 12 }}>#{u.id}</TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                              <Avatar sx={{ width: 28, height: 28, bgcolor: u.is_active !== false ? `${ACCENT}20` : '#cbd5e1', color: u.is_active !== false ? ACCENT : '#64748b', fontSize: 12, fontWeight: 800 }}>{u.username[0].toUpperCase()}</Avatar>
                              {u.username}
                            </Box>
                          </TableCell>
                          <TableCell><Chip label={u.role.name} size="small" sx={{ bgcolor: `${ACCENT}15`, color: ACCENT, fontWeight: 700, fontSize: 11, borderRadius: 1.5 }} /></TableCell>
                          <TableCell>
                            <Chip label={u.is_active !== false ? 'Activo' : 'Suspendido'} size="small" sx={{ bgcolor: u.is_active !== false ? '#ECFDF5' : '#FEF2F2', color: u.is_active !== false ? '#10B981' : '#EF4444', fontWeight: 800, fontSize: 10, borderRadius: 1.5 }} />
                          </TableCell>
                          <TableCell>
                            <Tooltip title="Editar">
                              <IconButton size="small" onClick={() => handleEditUser(u)} sx={{ color: ACCENT, mr: 1, bgcolor: `${ACCENT}10` }}><Edit fontSize="small" /></IconButton>
                            </Tooltip>
                            <Tooltip title={u.is_active !== false ? "Suspender acceso" : "Reactivar usuario"}>
                              <span>
                                  <IconButton size="small" disabled={currentUser?.id === u.id} onClick={() => handleToggleClick(u)} sx={{ color: u.is_active !== false ? '#EF4444' : '#10B981', bgcolor: u.is_active !== false ? '#FEF2F2' : '#ECFDF5' }}>
                                      {u.is_active !== false ? <Block fontSize="small" /> : <CheckCircle fontSize="small" />}
                                  </IconButton>
                              </span>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      ))
                    }
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </TabPanel>

          {/* ════ TAB 1: ROLES Y PERMISOS ════ */}
          <TabPanel value={tab} index={1}>
            <Box sx={{ mb: 3, display: 'flex', justifyContent: 'flex-end' }}>
              <Button variant="contained" startIcon={<AdminPanelSettings />} onClick={() => { resetRoleForm(); setFormRoleOpen(true); }}
                sx={{ bgcolor: ACCENT, borderRadius: 2, fontWeight: 700, boxShadow: `0 4px 14px ${ACCENT}40` }}>
                Nuevo Rol
              </Button>
            </Box>

            {/* Formulario Roles */}
            <Collapse in={formRoleOpen}>
              <Paper sx={{ p: 3, mb: 3, borderRadius: 3, border: `1px solid ${ACCENT}50`, bgcolor: 'background.default', boxShadow: 'none' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography sx={{ fontWeight: 800 }}>{editingRole ? 'Editar Permisos del Rol' : 'Crear Nuevo Rol'}</Typography>
                  <IconButton size="small" onClick={resetRoleForm}><Close fontSize="small" /></IconButton>
                </Box>
                <Box component="form" onSubmit={handleRoleSubmit}>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={4}>
                      <TextField label="Nombre del Rol" value={roleName} onChange={e => setRoleName(e.target.value)} fullWidth required disabled={!!editingRole} size="small" helperText={editingRole ? 'El nombre no se puede cambiar' : ''} />
                    </Grid>
                    <Grid item xs={12} sm={8}>
                      <Typography sx={{ fontSize: 12, fontWeight: 700, color: 'text.secondary', mb: 1.5, textTransform: 'uppercase' }}>
                        Seleccione los módulos a los que tendrá acceso
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                        {modules.map(m => (
                          <ModuleToggle key={m.id} module={m} checked={selectedModules.includes(m.id)} onChange={handleModuleChange} />
                        ))}
                      </Box>
                    </Grid>
                    <Grid item xs={12} sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
                      <Button type="submit" variant="contained" sx={{ bgcolor: ACCENT, fontWeight: 700 }}>
                        {editingRole ? 'Guardar Permisos' : 'Crear Rol'}
                      </Button>
                    </Grid>
                  </Grid>
                </Box>
              </Paper>
            </Collapse>

            {/* Lista de Roles */}
            {isMobile ? (
                <Stack spacing={2}>
                    {roles.map(r => (
                        <Paper key={r.id} sx={{ p: 2, borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                                <Typography sx={{ fontWeight: 800, fontSize: 16 }}>{r.name}</Typography>
                                <IconButton size="small" onClick={() => handleEditRole(r)} sx={{ color: ACCENT, bgcolor: `${ACCENT}10` }}><Edit fontSize="small" /></IconButton>
                            </Box>
                            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 1 }}>
                                {r.modules.length === 0 ? <Typography sx={{ fontSize: 12, color: 'text.secondary', fontStyle: 'italic' }}>Sin accesos configurados</Typography> :
                                r.modules.map(m => <Chip key={m.id} label={m.name} size="small" sx={{ bgcolor: `${ACCENT}10`, color: ACCENT, fontSize: 10, fontWeight: 700, borderRadius: 1 }} />)
                                }
                            </Box>
                        </Paper>
                    ))}
                </Stack>
            ) : (
                <TableContainer sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                <Table size="small">
                    <TableHead>
                    <TableRow sx={{ bgcolor: 'action.hover' }}>
                        {['Rol', 'Módulos con Acceso', 'Acciones'].map(h => <TableCell key={h} sx={{ fontWeight: 800 }}>{h}</TableCell>)}
                    </TableRow>
                    </TableHead>
                    <TableBody>
                    {roles.map(r => (
                        <TableRow key={r.id} hover>
                        <TableCell sx={{ fontWeight: 800, fontSize: 14 }}>{r.name}</TableCell>
                        <TableCell>
                            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                            {r.modules.length === 0 ? <Typography sx={{ fontSize: 12, color: 'text.secondary', fontStyle: 'italic' }}>Sin accesos configurados</Typography> :
                                r.modules.map(m => <Chip key={m.id} label={m.name} size="small" sx={{ bgcolor: `${ACCENT}10`, color: ACCENT, fontSize: 10, fontWeight: 700, borderRadius: 1.5 }} />)
                            }
                            </Box>
                        </TableCell>
                        <TableCell>
                            <Tooltip title="Editar Permisos">
                                <IconButton size="small" onClick={() => handleEditRole(r)} sx={{ color: ACCENT, bgcolor: `${ACCENT}10` }}><Edit fontSize="small" /></IconButton>
                            </Tooltip>
                        </TableCell>
                        </TableRow>
                    ))}
                    </TableBody>
                </Table>
                </TableContainer>
            )}
          </TabPanel>
        </Box>
      </Paper>

      <ConfirmationDialog 
        open={showConfirmUser} 
        handleClose={() => setShowConfirmUser(false)} 
        handleConfirm={confirmToggleUser} 
        title={userToToggle?.is_active !== false ? "Suspender acceso" : "Reactivar acceso"} 
        message={userToToggle?.is_active !== false 
            ? `¿Estás seguro de suspender a ${userToToggle?.username}? Ya no podrá ingresar al sistema hasta que lo reactives.` 
            : `¿Deseas reactivar el acceso para ${userToToggle?.username}?`
        } 
      />
    </Box>
  );
}
