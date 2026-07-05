import React, { useState, useEffect, useMemo } from 'react';
import apiClient from '../../api';
import { toast } from 'react-toastify';
import ConfirmationDialog from '../../components/common/ConfirmationDialog';
import AlertaRolModulos from './AlertaRolModulos';
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
  Search, FileDownload, Visibility, VisibilityOff, Email,
  VerifiedUser, GroupWork, SupervisedUserCircle, SettingsSuggest
} from '@mui/icons-material';
import { keyframes } from '@mui/system';

const ACCENT = '#8B5CF6'; // Violeta — Admin
const GREEN  = '#10B981';
const BLUE   = '#3B82F6';
const RED    = '#EF4444';

const fadeInUp = keyframes`
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
`;

const pulseSoft = keyframes`
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.04); opacity: 0.9; }
`;

const cardShimmer = keyframes`
  0% { left: -100%; }
  100% { left: 200%; }
`;

// ─── Componente Auxiliar: Toggle de módulo interactivo ───────────────────────
const ModuleToggle = ({ module, checked, onChange }) => (
  <Box
    onClick={() => onChange(module.id)}
    sx={{
      display: 'flex', alignItems: 'center', gap: 1.5,
      px: 2, py: 1.4, borderRadius: 3, cursor: 'pointer',
      border: '1.5px solid',
      borderColor: checked ? ACCENT : 'rgba(148, 163, 184, 0.15)',
      bgcolor: checked ? `${ACCENT}0D` : 'background.paper',
      transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
      position: 'relative', overflow: 'hidden',
      '&:hover': {
        borderColor: ACCENT,
        bgcolor: checked ? `${ACCENT}15` : 'action.hover',
        transform: 'translateY(-2px)',
        boxShadow: `0 6px 14px ${checked ? `${ACCENT}20` : 'rgba(0,0,0,0.04)'}`,
      },
      '&:active': { transform: 'scale(0.98)' }
    }}
  >
    <Box sx={{
      width: 20, height: 20, borderRadius: 1.5, flexShrink: 0,
      border: `2px solid ${checked ? ACCENT : '#94a3b8'}`,
      bgcolor: checked ? ACCENT : 'transparent',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      transition: 'all 0.15s ease-in-out',
    }}>
      {checked && <Check sx={{ fontSize: 13, color: '#fff', fontWeight: 900 }} />}
    </Box>
    <Box sx={{ minWidth: 0, flex: 1 }}>
      <Typography sx={{ fontSize: 13, fontWeight: checked ? 700 : 500, color: checked ? ACCENT : 'text.primary', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {module.name}
      </Typography>
      <Typography sx={{ fontSize: 10, color: 'text.secondary', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {module.frontend_path}
      </Typography>
    </Box>
  </Box>
);

function TabPanel({ children, value, index }) {
  return (
    <div role="tabpanel" hidden={value !== index}>
      {value === index && <Box sx={{ pt: 3, animation: `${fadeInUp} 0.4s ease both` }}>{children}</Box>}
    </div>
  );
}

// ─── Tarjeta de Usuario (Mobile Premium) ──────────────────────────────────────
const UserCardMobile = ({ user, currentUser, onEdit, onToggle }) => (
  <Paper sx={{
    p: 2.2, mb: 2, borderRadius: 4,
    border: '1px solid', borderColor: 'divider',
    bgcolor: 'background.paper',
    transition: 'all 0.2s',
    '&:hover': { boxShadow: '0 4px 16px rgba(0,0,0,0.06)' },
    opacity: user.is_active !== false ? 1 : 0.65
  }}>
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Avatar sx={{
          width: 40, height: 40,
          background: user.is_active !== false
            ? `linear-gradient(135deg, ${ACCENT}, ${ACCENT}aa)`
            : 'linear-gradient(135deg, #94a3b8, #cbd5e1)',
          color: '#fff', fontWeight: 900,
          boxShadow: user.is_active !== false ? `0 4px 12px ${ACCENT}35` : 'none'
        }}>
          {user.username[0].toUpperCase()}
        </Avatar>
        <Box>
          <Typography sx={{ fontWeight: 800, fontSize: 16, color: 'text.primary' }}>{user.username}</Typography>
          {user.nombre_completo && (
            <Typography sx={{ fontSize: 11, color: 'text.secondary', fontWeight: 500 }}>{user.nombre_completo}</Typography>
          )}
          {user.email && (
            <Typography sx={{ fontSize: 10, color: 'text.disabled', display: 'flex', alignItems: 'center', gap: 0.3 }}>
              <Email sx={{ fontSize: 10 }} /> {user.email}
            </Typography>
          )}
        </Box>
      </Box>
      <Chip
        label={user.is_active !== false ? 'Activo' : 'Suspendido'}
        size="small"
        sx={{
          bgcolor: user.is_active !== false ? 'success.shading' : 'error.shading',
          color: user.is_active !== false ? 'success.main' : 'error.main',
          fontWeight: 800, fontSize: 10, borderRadius: 2
        }}
      />
    </Box>
    <Divider sx={{ mb: 1.8, borderStyle: 'dashed' }} />
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <Chip label={user.role.name} size="small" sx={{ bgcolor: `${ACCENT}15`, color: ACCENT, fontWeight: 700, fontSize: 11, borderRadius: 2 }} />
      <Box sx={{ display: 'flex', gap: 1 }}>
        <IconButton size="small" onClick={() => onEdit(user)} sx={{ color: ACCENT, bgcolor: `${ACCENT}10`, '&:hover': { bgcolor: `${ACCENT}22` } }}>
          <Edit fontSize="small" />
        </IconButton>
        <IconButton
          size="small"
          disabled={currentUser?.id === user.id}
          onClick={() => onToggle(user)}
          sx={{
            color: user.is_active !== false ? 'error.main' : 'success.main',
            bgcolor: user.is_active !== false ? 'error.shading' : 'success.shading',
            '&:hover': { bgcolor: user.is_active !== false ? 'error.shading2' : 'success.shading2' }
          }}
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
  const GREEN  = '#10B981';
  const BLUE   = '#3B82F6';
  const RED    = '#EF4444';
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const dark = theme.palette.mode === 'dark';
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
  const [filtroEstado, setFiltroEstado] = useState('todos');
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

  const modulosFiltrados = useMemo(() => {
    const habilitados = currentUser?.empresa?.modulos_habilitados;
    if (!habilitados || habilitados.length === 0) return modules;
    return modules.filter(m => habilitados.includes(m.frontend_path));
  }, [modules, currentUser]);

  const usuariosFiltrados = useMemo(() => {
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
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'usuarios.csv';
    a.click(); URL.revokeObjectURL(url);
  };

  // Estadísticas rápidas para la sección superior
  const stats = useMemo(() => {
    const total = users.length;
    const activos = users.filter(u => u.is_active !== false).length;
    const suspendidos = total - activos;
    const totalRoles = roles.length;
    return { total, activos, suspendidos, totalRoles };
  }, [users, roles]);

  return (
    <Box sx={{ width: '100%' }}>
      {/* ── Header ── */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 3, gap: 1.5, flexWrap: 'wrap' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ width: 44, height: 44, borderRadius: 2.5, bgcolor: `${ACCENT}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: ACCENT }}>
            <AdminPanelSettings sx={{ fontSize: 24 }} />
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 900, fontSize: 21, lineHeight: 1.2, letterSpacing: -0.5 }}>Usuarios y Permisos</Typography>
            <Typography sx={{ fontSize: 13, color: 'text.secondary', fontWeight: 500 }}>Control de acceso del personal de {currentUser?.empresa?.nombre || 'Mi Empresa'}</Typography>
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
              { q: '¿Cómo desactivo a un usuario?', a: 'En la lista de usuarios, usa el interruptor de activar/desactivar. El historial de ese usuario se conserva intacto.' },
            ]}
          />
        </Box>
      </Box>

      {/* ── Mini Stats Section ── */}
      <Grid container spacing={1.5} sx={{ mb: 3 }}>
        {[
          { label: 'Usuarios Totales', val: stats.total, color: ACCENT, icon: <People fontSize="small" /> },
          { label: 'Usuarios Activos', val: stats.activos, color: GREEN, icon: <VerifiedUser fontSize="small" /> },
          { label: 'Suspendidos', val: stats.suspendidos, color: RED, icon: <Block fontSize="small" /> },
          { label: 'Roles Creados', val: stats.totalRoles, color: BLUE, icon: <Security fontSize="small" /> },
        ].map((s, idx) => (
          <Grid item xs={6} sm={3} key={idx}>
            <Paper sx={{
              p: 2, borderRadius: 3, display: 'flex', alignItems: 'center', gap: 1.5,
              border: '1px solid', borderColor: 'divider',
              boxShadow: dark ? '0 2px 10px rgba(0,0,0,0.3)' : '0 2px 10px rgba(0,0,0,0.03)',
              position: 'relative', overflow: 'hidden',
              animation: `${fadeInUp} 0.5s ${idx * 0.05}s ease both`,
            }}>
              <Box sx={{ width: 34, height: 34, borderRadius: 2, bgcolor: `${s.color}15`, color: s.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {s.icon}
              </Box>
              <Box>
                <Typography sx={{ fontSize: 10, color: 'text.secondary', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>{s.label}</Typography>
                <Typography sx={{ fontSize: 18, fontWeight: 900, color: 'text.primary', mt: 0.2 }}>{s.val}</Typography>
              </Box>
            </Paper>
          </Grid>
        ))}
      </Grid>

      {/* ── Contenedor Principal (Tabs) ── */}
      <Paper sx={{ borderRadius: 4, boxShadow: dark ? '0 4px 20px rgba(0,0,0,0.35)' : '0 4px 20px rgba(0,0,0,0.03)', overflow: 'hidden', border: '1px solid', borderColor: 'divider' }}>
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          variant={isMobile ? 'fullWidth' : 'standard'}
          sx={{
            px: 2, borderBottom: '1px solid', borderColor: 'divider',
            bgcolor: 'background.paper',
            '& .MuiTab-root': { fontWeight: 700, fontSize: 13, textTransform: 'none', minHeight: 52 },
            '& .MuiTabs-indicator': { backgroundColor: ACCENT, height: 3, borderRadius: 3 },
            '& .Mui-selected': { color: `${ACCENT} !important` },
          }}
        >
          <Tab icon={<People sx={{ fontSize: 18, mr: 1 }} />} iconPosition="start" label={`Usuarios (${users.length})`} />
          <Tab icon={<Security sx={{ fontSize: 18, mr: 1 }} />} iconPosition="start" label={`Roles y Módulos (${roles.length})`} />
        </Tabs>

        <Box sx={{ p: { xs: 2, md: 3 } }}>

          {/* ════ TAB 0: USUARIOS ════ */}
          <TabPanel value={tab} index={0}>
            <Box sx={{ mb: 3, display: 'flex', gap: 1.2, flexWrap: 'wrap', alignItems: 'center' }}>
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
                sx={{
                  flex: 1, minWidth: 220,
                  '& .MuiOutlinedInput-root': { borderRadius: 2.5 }
                }}
              />
              <Stack direction="row" spacing={0.8} sx={{ flexWrap: 'wrap', gap: 0.8 }}>
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
                      bgcolor: filtroEstado === f.key ? `${ACCENT}15` : 'transparent',
                      color:   filtroEstado === f.key ? ACCENT : 'text.secondary',
                      border: '1px solid',
                      borderColor: filtroEstado === f.key ? ACCENT : 'divider',
                      '&:hover': { bgcolor: filtroEstado === f.key ? `${ACCENT}22` : 'action.hover' },
                      borderRadius: 2
                    }}
                  />
                ))}
              </Stack>
              <Button
                size="small" variant="outlined" startIcon={<FileDownload />}
                onClick={handleExportCSV} disabled={!usuariosFiltrados.length}
                sx={{ borderRadius: 2.5, fontWeight: 700, textTransform: 'none', px: 2, py: 0.8 }}
              >
                Exportar CSV
              </Button>
              <Button
                variant="contained" startIcon={<PersonAdd />}
                onClick={() => { resetUserForm(); setFormUserOpen(true); }}
                sx={{ bgcolor: ACCENT, borderRadius: 2.5, fontWeight: 800, textTransform: 'none', boxShadow: `0 8px 18px ${ACCENT}25`, '&:hover': { bgcolor: ACCENT, filter: 'brightness(0.95)' } }}
              >
                Nuevo Usuario
              </Button>
            </Box>

            {/* Formulario Usuarios */}
            <Collapse in={formUserOpen}>
              <Paper sx={{ p: 3, mb: 3.5, borderRadius: 4, border: `1px solid ${ACCENT}40`, bgcolor: 'action.hover', boxShadow: 'none' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2.5 }}>
                  <Typography sx={{ fontWeight: 800, fontSize: 15, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <SupervisedUserCircle sx={{ color: ACCENT }} /> {editingUser ? 'Editar Usuario' : 'Crear Usuario'}
                  </Typography>
                  <IconButton size="small" onClick={resetUserForm} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}><Close fontSize="small" /></IconButton>
                </Box>
                <Box component="form" onSubmit={handleUserSubmit}>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={3}>
                      <TextField
                        label="Nombre de usuario *"
                        value={username}
                        onChange={e => setUsername(e.target.value.replace(/\s/g, ''))}
                        fullWidth required size="small"
                        placeholder="Ej: j.perez"
                        helperText="Identificador único para iniciar sesión."
                        inputProps={{ pattern: '\\S+' }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={3}>
                      <TextField
                        label="Nombre completo"
                        value={nombreCompleto}
                        onChange={e => setNombreCompleto(e.target.value)}
                        fullWidth size="small"
                        placeholder="Ej: Juan Pérez"
                        helperText="Nombre que aparecerá en facturas y reportes."
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
                        helperText={editingUser ? 'Dejar vacío si no deseas cambiarla.' : 'Mínimo 6 caracteres.'}
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

                    <Grid item xs={12}>
                      <AlertaRolModulos
                        rolSeleccionado={roles.find(r => r.id === roleId)}
                        empresaActual={currentUser?.empresa}
                      />
                    </Grid>

                    <Grid item xs={12} sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1.5, mt: 1 }}>
                      <Button variant="outlined" onClick={resetUserForm} sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2.5 }}>
                        Cancelar
                      </Button>
                      <Button type="submit" variant="contained" sx={{ bgcolor: ACCENT, fontWeight: 800, textTransform: 'none', borderRadius: 2.5, px: 3, '&:hover': { bgcolor: ACCENT, filter: 'brightness(0.95)' } }}>
                        {editingUser ? 'Guardar Cambios' : 'Crear Usuario'}
                      </Button>
                    </Grid>
                  </Grid>
                </Box>
              </Paper>
            </Collapse>

            {/* Lista de Usuarios */}
            {isMobile ? (
               <Stack spacing={0}>
                  {usuariosFiltrados.map(u => (
                    <UserCardMobile key={u.id} user={u} currentUser={currentUser} onEdit={handleEditUser} onToggle={handleToggleClick} />
                  ))}
               </Stack>
            ) : (
              <TableContainer sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider', overflow: 'hidden' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: 'action.hover' }}>
                      <TableCell sx={{ fontWeight: 800, py: 1.5 }}>Usuario</TableCell>
                      <TableCell sx={{ fontWeight: 800 }}>Nombre Completo</TableCell>
                      <TableCell sx={{ fontWeight: 800 }}>Rol</TableCell>
                      <TableCell sx={{ fontWeight: 800 }}>Estado</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 800, pr: 2 }}>Acciones</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {usuariosFiltrados.map(u => (
                      <TableRow key={u.id} hover sx={{ '&:hover': { bgcolor: 'action.hover' }, opacity: u.is_active !== false ? 1 : 0.65 }}>
                        <TableCell sx={{ py: 1.2 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
                            <Avatar sx={{
                              width: 32, height: 32,
                              background: u.is_active !== false
                                ? `linear-gradient(135deg, ${ACCENT}, ${ACCENT}aa)`
                                : '#cbd5e1',
                              color: '#fff', fontSize: 13, fontWeight: 900
                            }}>
                              {u.username[0].toUpperCase()}
                            </Avatar>
                            <Typography sx={{ fontWeight: 700, fontSize: 13.5 }}>{u.username}</Typography>
                          </Box>
                        </TableCell>
                        <TableCell sx={{ fontWeight: 500, fontSize: 13 }}>{u.nombre_completo || '-'}</TableCell>
                        <TableCell><Chip label={u.role.name} size="small" sx={{ bgcolor: `${ACCENT}12`, color: ACCENT, fontWeight: 700, fontSize: 11, borderRadius: 2 }} /></TableCell>
                        <TableCell>
                          <Chip
                            label={u.is_active !== false ? 'Activo' : 'Suspendido'}
                            size="small"
                            sx={{
                              bgcolor: u.is_active !== false ? 'success.shading' : 'error.shading',
                              color: u.is_active !== false ? 'success.main' : 'error.main',
                              fontWeight: 800, fontSize: 10, borderRadius: 2
                            }}
                          />
                        </TableCell>
                        <TableCell align="right" sx={{ pr: 2 }}>
                          <Tooltip title="Editar">
                            <IconButton size="small" onClick={() => handleEditUser(u)} sx={{ color: ACCENT, mr: 0.5 }}>
                              <Edit fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title={u.is_active !== false ? 'Suspender' : 'Reactivar'}>
                            <span>
                              <IconButton
                                size="small"
                                disabled={currentUser?.id === u.id}
                                onClick={() => handleToggleClick(u)}
                                sx={{ color: u.is_active !== false ? 'error.main' : 'success.main' }}
                              >
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

          {/* ════ TAB 1: ROLES & MODULOS ════ */}
          <TabPanel value={tab} index={1}>
            <Box sx={{ mb: 3.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
              <Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 800, color: 'text.primary' }}>Roles y Matriz de Permisos</Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 500 }}>Configura qué módulos puede ver cada rol de tu empresa.</Typography>
              </Box>
              <Button
                variant="contained" startIcon={<Security />}
                onClick={() => { resetRoleForm(); setFormRoleOpen(true); }}
                sx={{ bgcolor: ACCENT, borderRadius: 2.5, fontWeight: 800, textTransform: 'none', boxShadow: `0 8px 18px ${ACCENT}25`, '&:hover': { bgcolor: ACCENT, filter: 'brightness(0.95)' } }}
              >
                Nuevo Rol
              </Button>
            </Box>

            {/* Formulario Roles */}
            <Collapse in={formRoleOpen}>
              <Paper sx={{ p: 3, mb: 3.5, borderRadius: 4, border: `1px solid ${ACCENT}40`, bgcolor: 'action.hover', boxShadow: 'none' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2.5 }}>
                  <Typography sx={{ fontWeight: 800, fontSize: 15, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <SettingsSuggest sx={{ color: ACCENT }} /> {editingRole ? `Editar Permisos: ${roleName}` : 'Crear Nuevo Rol'}
                  </Typography>
                  <IconButton size="small" onClick={resetRoleForm} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}><Close fontSize="small" /></IconButton>
                </Box>
                <Box component="form" onSubmit={handleRoleSubmit}>
                  <Grid container spacing={2.5}>
                    {!editingRole && (
                      <Grid item xs={12}>
                        <TextField
                          label="Nombre del Rol *"
                          value={roleName}
                          onChange={e => setRoleName(e.target.value)}
                          fullWidth required size="small"
                          placeholder="Ej: Supervisor, Cajero, Vendedor"
                          helperText="Asigna un nombre claro basado en las funciones del cargo."
                        />
                      </Grid>
                    )}

                    <Grid item xs={12}>
                      <Typography sx={{ fontSize: 12, fontWeight: 800, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.8, mb: 1.5 }}>
                        Selecciona los módulos autorizados para este rol:
                      </Typography>
                      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 1.5 }}>
                        {modulosFiltrados.map(m => (
                          <ModuleToggle
                            key={m.id}
                            module={m}
                            checked={selectedModules.includes(m.id)}
                            onChange={handleModuleChange}
                          />
                        ))}
                      </Box>
                    </Grid>

                    <Grid item xs={12} sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1.5, mt: 1 }}>
                      <Button variant="outlined" onClick={resetRoleForm} sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2.5 }}>
                        Cancelar
                      </Button>
                      <Button type="submit" variant="contained" sx={{ bgcolor: ACCENT, fontWeight: 800, textTransform: 'none', borderRadius: 2.5, px: 3, '&:hover': { bgcolor: ACCENT, filter: 'brightness(0.95)' } }}>
                        {editingRole ? 'Guardar Permisos' : 'Crear Rol'}
                      </Button>
                    </Grid>
                  </Grid>
                </Box>
              </Paper>
            </Collapse>

            {/* Listado de Roles */}
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 2 }}>
              {roles.map(r => (
                <Paper key={r.id} sx={{
                  p: 2.5, borderRadius: 3.5, border: '1px solid', borderColor: 'divider',
                  display: 'flex', flexDirection: 'column', gap: 1.5,
                  transition: 'all 0.22s',
                  '&:hover': {
                    borderColor: ACCENT,
                    boxShadow: dark ? '0 4px 18px rgba(0,0,0,0.3)' : '0 4px 18px rgba(0,0,0,0.04)',
                    transform: 'translateY(-2px)'
                  }
                }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Security sx={{ color: ACCENT, fontSize: 18 }} />
                      <Typography sx={{ fontWeight: 800, fontSize: 14.5 }}>{r.name}</Typography>
                    </Box>
                    <IconButton size="small" onClick={() => handleEditRole(r)} sx={{ color: ACCENT, bgcolor: `${ACCENT}10`, '&:hover': { bgcolor: `${ACCENT}22` } }}>
                      <Edit fontSize="small" />
                    </IconButton>
                  </Box>
                  <Divider sx={{ borderStyle: 'dashed' }} />
                  <Box>
                    <Typography sx={{ fontSize: 10.5, color: 'text.secondary', fontWeight: 700, mb: 1, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      Módulos habilitados ({r.modules.length})
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.6 }}>
                      {r.modules.length > 0 ? r.modules.map(m => (
                        <Chip key={m.id} label={m.name} size="small" sx={{ fontSize: 9.5, fontWeight: 600, height: 18, bgcolor: 'action.hover', color: 'text.secondary', borderRadius: 1.5 }} />
                      )) : (
                        <Typography sx={{ fontSize: 11.5, color: 'text.disabled', fontStyle: 'italic' }}>Ninguno asignado. El rol no tendrá acceso al menú.</Typography>
                      )}
                    </Box>
                  </Box>
                </Paper>
              ))}
            </Box>
          </TabPanel>

        </Box>
      </Paper>

      {/* Confirmation Dialogs */}
      <ConfirmationDialog
        open={showConfirmUser}
        title={userToToggle?.is_active !== false ? '¿Suspender acceso?' : '¿Reactivar acceso?'}
        body={userToToggle?.is_active !== false
          ? `El usuario ${userToToggle?.username} no podrá acceder al sistema hasta que sea reactivado.`
          : `El usuario ${userToToggle?.username} volverá a tener acceso normal a sus módulos.`
        }
        color={userToToggle?.is_active !== false ? RED : GREEN}
        onConfirm={confirmToggleUser}
        onCancel={() => { setShowConfirmUser(false); setUserToToggle(null); }}
      />
    </Box>
  );
}
