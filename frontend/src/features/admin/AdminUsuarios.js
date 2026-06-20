import React, { useState, useEffect } from 'react';
import apiClient from '../../api';
import { toast } from 'react-toastify';
import ConfirmationDialog from '../../components/common/ConfirmationDialog';
import AlertaRolModulos from './AlertaRolModulos'; // ✨ IMPORTACIÓN AÑADIDA AQUÍ
import HelpGuideTopBar from '../../components/onboarding/HelpGuideTopBar';

import {
  Box, Paper, Typography, Grid, TextField, Button, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, IconButton, FormControl,
  InputLabel, Select, MenuItem, useMediaQuery, useTheme, Chip, Tooltip,
  Divider, Collapse, Avatar, Tabs, Tab, CircularProgress, Stack,
  TableSortLabel, InputAdornment, Switch
} from '@mui/material';
import {
  Edit, Delete, PersonAdd, People, ExpandMore, ExpandLess,
  Close, AdminPanelSettings, Check, Security, Block, CheckCircle,
  Search, FileDownload, Visibility, VisibilityOff, Email
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
          {user.nombre_completo && (
            <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{user.nombre_completo}</Typography>
          )}
          {user.email && (
            <Typography sx={{ fontSize: 10, color: 'text.disabled' }}>{user.email}</Typography>
          )}
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
  const [nombreCompleto, setNombreCompleto] = useState('');
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

  const [busqueda, setBusqueda]         = useState('');
  const [filtroEstado, setFiltroEstado] = useState('todos'); // 'todos' | 'activos' | 'suspendidos'
  const [sortDir, setSortDir]           = useState('asc');
  const [showPwd, setShowPwd]           = useState(false);

  useEffect(() => {
    fetchUsers(); fetchRoles(); fetchModules(); fetchMe();
  }, []);

  const fetchMe = async () => { try { const r = await apiClient.get('/users/me'); setCurrentUser(r.data); } catch { } };
  const fetchUsers = async () => { try { const r = await apiClient.get('/users/'); setUsers(r.data); } catch { toast.error('Error al cargar usuarios.'); } };
  const fetchRoles = async () => { try { const r = await apiClient.get('/roles/'); setRoles(r.data); } catch { toast.error('Error al cargar roles.'); } };
  const fetchModules = async () => { try { const r = await apiClient.get('/modulos/'); setModules(r.data); } catch { toast.error('Error al cargar módulos.'); } };

  const handleUserSubmit = async (e) => {
    e.preventDefault();
    if (/\s/.test(username)) { toast.error('El nombre de usuario no puede contener espacios'); return; }
    const userData = { username, password, nombre_completo: nombreCompleto || null, role_id: parseInt(roleId) };
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

  const resetUserForm = () => { setUsername(''); setNombreCompleto(''); setPassword(''); setRoleId(''); setEditingUser(null); setFormUserOpen(false); };

  const handleEditUser = (user) => {
    setEditingUser(user);
    setUsername(user.username);
    setNombreCompleto(user.nombre_completo || '');
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

  const modulosFiltrados = React.useMemo(() => {
    const habilitados = currentUser?.empresa?.modulos_habilitados;
    if (!habilitados || habilitados.length === 0) return modules;
    return modules.filter(m => habilitados.includes(m.frontend_path));
  }, [modules, currentUser]);

  const usuariosFiltrados = React.useMemo(() => {
    let list = [...users];
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase();
      list = list.filter(u =>
        u.username.toLowerCase().includes(q) ||
        (u.nombre_completo || '').toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q)
      );
    }
    if (filtroEstado === 'activos')     list = list.filter(u => u.is_active !== false);
    if (filtroEstado === 'suspendidos') list = list.filter(u => u.is_active === false);
    list.sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      return dir * a.username.localeCompare(b.username);
    });
    return list;
  }, [users, busqueda, filtroEstado, sortDir]);

  const handleExportCSV = () => {
    if (!usuariosFiltrados.length) return;
    const rows = [
      ['#', 'Usuario', 'Nombre completo', 'Email', 'Rol', 'Estado'],
      ...usuariosFiltrados.map((u, i) => [
        i + 1, u.username, u.nombre_completo || '', u.email || '',
        u.role?.name || '', u.is_active !== false ? 'Activo' : 'Suspendido',
      ]),
    ];
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'usuarios.csv';
    a.click(); URL.revokeObjectURL(url);
  };

  return (
    <Box sx={{ width: '100%' }}>
      {/* ── Header ── */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3, gap: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ width: 40, height: 40, borderRadius: 2, bgcolor: `${ACCENT}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: ACCENT }}>
            <AdminPanelSettings />
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 800, fontSize: 20, lineHeight: 1.2 }}>Usuarios y Permisos</Typography>
            <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>Control de acceso del personal</Typography>
          </Box>
          <HelpGuideTopBar
            moduleName="Usuarios y Permisos"
            moduleColor={ACCENT}
            steps={[
              { title: 'Crea un usuario', description: 'Define el nombre de usuario, contraseña y rol. El rol determina a qué módulos tendrá acceso.' },
              { title: 'Asigna un rol', description: 'Los roles agrupan permisos de módulos. Asigna el rol que corresponda al cargo del empleado.' },
              { title: 'Gestiona permisos de módulos', description: 'En la pestaña "Roles y Módulos" puedes definir exactamente qué módulos puede ver cada rol.' },
              { title: 'Activa o desactiva usuarios', description: 'Si un empleado sale de la empresa, desactívalo en lugar de eliminarlo para conservar el historial.' },
            ]}
            faqItems={[
              { q: '¿Cuál es la diferencia entre usuario y rol?', a: 'El usuario es la cuenta individual de cada empleado. El rol es un conjunto de permisos (qué módulos puede ver). Varios usuarios pueden tener el mismo rol.' },
              { q: '¿Cómo desactivo a un usuario que ya no trabaja aquí?', a: 'En la lista de usuarios, usa el interruptor de activar/desactivar. El historial de ese usuario se conserva.' },
              { q: '¿Qué módulos puede ver cada empleado?', a: 'Depende del rol asignado. En "Roles y Módulos" puedes ver y editar exactamente qué módulos tiene habilitados cada rol.' },
              { q: '¿Cómo cambio la contraseña de un usuario?', a: 'Edita el usuario con el ícono de lápiz ✏️ y escribe la nueva contraseña en el campo correspondiente.' },
            ]}
          />
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
          <Tab icon={<People sx={{ fontSize: 18, mr: 1 }} />} iconPosition="start"
            label={`Usuarios (${users.length})`} />
          <Tab icon={<Security sx={{ fontSize: 18, mr: 1 }} />} iconPosition="start"
            label={`Roles (${roles.length})`} />
        </Tabs>

        <Box sx={{ p: { xs: 2, md: 3 } }}>

          {/* ════ TAB 0: USUARIOS ════ */}
          <TabPanel value={tab} index={0}>
            <Box sx={{ mb: 2, display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
              <TextField
                size="small"
                placeholder="Buscar por usuario, nombre o email…"
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search sx={{ fontSize: 18, color: 'text.disabled' }} />
                    </InputAdornment>
                  ),
                }}
                sx={{ flex: 1, minWidth: 220 }}
              />
              {[
                { key: 'todos',       label: 'Todos' },
                { key: 'activos',     label: 'Activos' },
                { key: 'suspendidos', label: 'Suspendidos' },
              ].map(f => (
                <Chip
                  key={f.key}
                  label={f.label}
                  size="small"
                  onClick={() => setFiltroEstado(f.key)}
                  sx={{
                    cursor: 'pointer', fontWeight: 700,
                    bgcolor: filtroEstado === f.key ? ACCENT : 'transparent',
                    color:   filtroEstado === f.key ? '#fff' : 'text.secondary',
                    border: '1px solid',
                    borderColor: filtroEstado === f.key ? ACCENT : 'divider',
                    '&:hover': { bgcolor: filtroEstado === f.key ? ACCENT : 'action.hover' },
                  }}
                />
              ))}
              <Button
                size="small" variant="outlined" startIcon={<FileDownload />}
                onClick={handleExportCSV} disabled={!usuariosFiltrados.length}
                sx={{ borderRadius: 2, fontWeight: 600, whiteSpace: 'nowrap' }}
              >
                CSV
              </Button>
              <Button
                variant="contained" startIcon={<PersonAdd />}
                onClick={() => { resetUserForm(); setFormUserOpen(true); }}
                sx={{ bgcolor: ACCENT, borderRadius: 2, fontWeight: 700, boxShadow: `0 4px 14px ${ACCENT}40`, whiteSpace: 'nowrap' }}
              >
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
                    <Grid item xs={12} sm={3}>
                      <TextField
                        label="Nombre de usuario *"
                        value={username}
                        onChange={e => setUsername(e.target.value.replace(/\s/g, ''))}
                        fullWidth required size="small"
                        helperText="Sin espacios. Es el usuario para iniciar sesión."
                        inputProps={{ pattern: '\\S+' }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={3}>
                      <TextField
                        label="Nombre completo"
                        value={nombreCompleto}
                        onChange={e => setNombreCompleto(e.target.value)}
                        fullWidth size="small"
                        helperText="Nombre real del trabajador (aparece en reportes)"
                      />
                    </Grid>
                    <Grid item xs={12} sm={3}>
                      <TextField
                        label="Contraseña"
                        type={showPwd ? 'text' : 'password'}
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        fullWidth
                        required={!editingUser}
                        size="small"
                        helperText={editingUser ? 'Dejar en blanco para no cambiarla' : (
                          password ? (() => {
                            const len = password.length;
                            const hasNum = /[0-9]/.test(password);
                            const hasUp  = /[A-Z]/.test(password);
                            if (len < 4) return '⚠ Muy débil';
                            if (len < 6) return '🟡 Débil';
                            if (len >= 6 && (hasNum || hasUp)) return '🟢 Buena';
                            return '⚠ Débil';
                          })() : 'Mínimo 6 caracteres'
                        )}
                        InputProps={{
                          endAdornment: (
                            <InputAdornment position="end">
                              <IconButton size="small" onClick={() => setShowPwd(p => !p)} edge="end" tabIndex={-1}>
                                {showPwd ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                              </IconButton>
                            </InputAdornment>
                          ),
                        }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={3}>
                      <FormControl fullWidth required size="small">
                        <InputLabel>Rol</InputLabel>
                        <Select value={roleId} label="Rol" onChange={e => setRoleId(e.target.value)}>
                          {roles.map(r => <MenuItem key={r.id} value={r.id}>{r.name}</MenuItem>)}
                        </Select>
                      </FormControl>
                    </Grid>

                    {/* ✨ ALERTA ROL MODULOS AÑADIDA AQUÍ COMO UN GRID ITEM DE ANCHO COMPLETO ✨ */}
                    <Grid item xs={12}>
                      <AlertaRolModulos
                        rolSeleccionado={roles.find(r => r.id === roleId)}
                        empresaActual={currentUser?.empresa}
                      />
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
                  {usuariosFiltrados.map(u => (
                    <UserCardMobile key={u.id} user={u} currentUser={currentUser} onEdit={handleEditUser} onToggle={handleToggleClick} />
                  ))}
               </Stack>
            ) : (
              <TableContainer sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: 'action.hover' }}>
                      <TableCell sx={{ fontWeight: 800 }}>#</TableCell>
                      <TableCell sx={{ fontWeight: 800 }}>
                        <TableSortLabel
                          active
                          direction={sortDir}
                          onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}
                        >
                          Usuario
                        </TableSortLabel>
                      </TableCell>
                      <TableCell sx={{ fontWeight: 800 }}>Rol</TableCell>
                      <TableCell sx={{ fontWeight: 800 }}>Estado</TableCell>
                      <TableCell sx={{ fontWeight: 800 }}>Acciones</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {usuariosFiltrados.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} sx={{ py: 5, textAlign: 'center' }}>
                          <Box sx={{ color: 'text.disabled' }}>
                            <People sx={{ fontSize: 40, mb: 1, opacity: 0.3 }} />
                            <Typography sx={{ fontSize: 13 }}>
                              {busqueda ? `Sin resultados para "${busqueda}"` : 'No hay usuarios registrados'}
                            </Typography>
                          </Box>
                        </TableCell>
                      </TableRow>
                    ) : usuariosFiltrados.map(u => (
                      <TableRow key={u.id} hover sx={{ opacity: u.is_active !== false ? 1 : 0.6 }}>
                        <TableCell sx={{ color: 'text.secondary', fontSize: 12 }}>#{u.id}</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                            <Avatar sx={{ width: 28, height: 28, bgcolor: u.is_active !== false ? `${ACCENT}20` : '#cbd5e1', color: u.is_active !== false ? ACCENT : '#64748b', fontSize: 12, fontWeight: 800 }}>
                              {u.username[0].toUpperCase()}
                            </Avatar>
                            <Box>
                              <Typography sx={{ fontWeight: 700, fontSize: 13 }}>{u.username}</Typography>
                              {u.nombre_completo && <Typography sx={{ fontSize: 11, color: 'text.secondary', lineHeight: 1 }}>{u.nombre_completo}</Typography>}
                              {u.email && <Typography sx={{ fontSize: 10, color: 'text.disabled', lineHeight: 1 }}>{u.email}</Typography>}
                            </Box>
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
                    ))}
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
                        {modulosFiltrados.map(m => (
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
                    {roles.length === 0 ? (
                      <Box sx={{ py: 5, textAlign: 'center', color: 'text.disabled' }}>
                        <Security sx={{ fontSize: 40, mb: 1, opacity: 0.3 }} />
                        <Typography sx={{ fontSize: 13 }}>No hay roles configurados. Crea el primero.</Typography>
                      </Box>
                    ) : roles.map(r => (
                        <Paper key={r.id} sx={{ p: 2, borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                                <Box>
                                  <Typography sx={{ fontWeight: 800, fontSize: 16 }}>{r.name}</Typography>
                                  <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
                                    {users.filter(u => u.role?.id === r.id).length} usuario(s)
                                  </Typography>
                                </Box>
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
                    {roles.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} sx={{ py: 5, textAlign: 'center' }}>
                          <Box sx={{ color: 'text.disabled' }}>
                            <Security sx={{ fontSize: 40, mb: 1, opacity: 0.3 }} />
                            <Typography sx={{ fontSize: 13 }}>No hay roles configurados. Crea el primero.</Typography>
                          </Box>
                        </TableCell>
                      </TableRow>
                    ) : roles.map(r => (
                        <TableRow key={r.id} hover>
                        <TableCell sx={{ fontWeight: 800, fontSize: 14 }}>
                          <Box>
                            <Typography sx={{ fontWeight: 800, fontSize: 14 }}>{r.name}</Typography>
                            <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
                              {users.filter(u => u.role?.id === r.id).length} usuario{users.filter(u => u.role?.id === r.id).length !== 1 ? 's' : ''}
                            </Typography>
                          </Box>
                        </TableCell>
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
