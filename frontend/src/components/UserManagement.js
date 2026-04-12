import React, { useState, useEffect } from 'react';
import apiClient from '../api';
import { toast } from 'react-toastify';
import ConfirmationDialog from './ConfirmationDialog';
import {
  Box, Paper, Typography, Grid, TextField, Button, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, IconButton, FormControl,
  InputLabel, Select, MenuItem, useMediaQuery, useTheme, Chip, Tooltip,
  Divider, Collapse, Avatar
} from '@mui/material';
import {
  Edit, Delete, PersonAdd, People, ExpandMore, ExpandLess,
  Close, AdminPanelSettings, Person
} from '@mui/icons-material';

const ACCENT = '#8B5CF6'; // violeta — Admin

// ─── Card mobile ──────────────────────────────────────────────────────────────
const UserCard = ({ user, handleEdit, handleDelete }) => (
  <Paper sx={{ p: 2.5, mb: 2, borderRadius: 3, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Avatar sx={{ width: 38, height: 38, bgcolor: `${ACCENT}20`, color: ACCENT, fontWeight: 700, fontSize: 15 }}>
          {user.username[0].toUpperCase()}
        </Avatar>
        <Box>
          <Typography sx={{ fontWeight: 700, fontSize: 14 }}>{user.username}</Typography>
          <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>#{user.id}</Typography>
        </Box>
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Chip label={user.role.name} size="small"
          sx={{ bgcolor: `${ACCENT}15`, color: ACCENT, fontWeight: 600, fontSize: 11, borderRadius: 1.5 }} />
        <Tooltip title="Editar">
          <IconButton size="small" onClick={() => handleEdit(user)}
            sx={{ color: ACCENT, bgcolor: `${ACCENT}12`, borderRadius: 1.5 }}>
            <Edit fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Eliminar">
          <IconButton size="small" onClick={() => handleDelete(user.id)}
            sx={{ color: '#EF4444', bgcolor: '#FEF2F2', borderRadius: 1.5 }}>
            <Delete fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  </Paper>
);

// ─── Componente principal ──────────────────────────────────────────────────────
const UserManagement = () => {
  const [users, setUsers]           = useState([]);
  const [roles, setRoles]           = useState([]);
  const [username, setUsername]     = useState('');
  const [password, setPassword]     = useState('');
  const [roleId, setRoleId]         = useState('');
  const [editingUser, setEditingUser] = useState(null);
  const [formOpen, setFormOpen]     = useState(false);

  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [userToDelete, setUserToDelete]           = useState(null);

  const theme    = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  useEffect(() => { fetchUsers(); fetchRoles(); }, []);

  const fetchUsers = async () => {
    try { const r = await apiClient.get('/users/'); setUsers(r.data); }
    catch { toast.error('Error al cargar usuarios.'); }
  };

  const fetchRoles = async () => {
    try { const r = await apiClient.get('/roles/'); setRoles(r.data); }
    catch { toast.error('Error al cargar roles.'); }
  };

  const handleSubmit = async (e) => {
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
      resetForm(); fetchUsers();
    } catch (err) {
      toast.error(`Error al guardar usuario: ${err.response?.data?.detail || err.message}`);
    }
  };

  const handleEdit = (user) => {
    setEditingUser(user); setUsername(user.username);
    setRoleId(user.role.id); setPassword(''); setFormOpen(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete    = (id) => { setUserToDelete(id); setShowConfirmDialog(true); };
  const confirmDelete   = async () => {
    try { await apiClient.delete(`/users/${userToDelete}`); toast.success('Usuario eliminado'); fetchUsers(); }
    catch (err) { toast.error(`Error al eliminar: ${err.response?.data?.detail || err.message}`); }
    finally { setShowConfirmDialog(false); setUserToDelete(null); }
  };

  const resetForm = () => {
    setUsername(''); setPassword(''); setRoleId('');
    setEditingUser(null); setFormOpen(false);
  };

  return (
    <Box>
      {/* ── Header ── */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ width: 40, height: 40, borderRadius: 2, bgcolor: `${ACCENT}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: ACCENT }}>
            <People />
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 700, fontSize: 18, lineHeight: 1.2 }}>Usuarios</Typography>
            <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>{users.length} usuario{users.length !== 1 ? 's' : ''} registrado{users.length !== 1 ? 's' : ''}</Typography>
          </Box>
        </Box>
        <Button
          variant="contained" startIcon={<PersonAdd />}
          onClick={() => { resetForm(); setFormOpen(true); }}
          sx={{ background: `linear-gradient(135deg, ${ACCENT}, #a78bfa)`, boxShadow: `0 4px 14px rgba(139,92,246,0.3)`, borderRadius: 2, fontWeight: 600 }}
        >
          Nuevo Usuario
        </Button>
      </Box>

      {/* ── Formulario ── */}
      <Box sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider', bgcolor: 'background.paper', overflow: 'hidden', mb: 3, boxShadow: formOpen ? '0 4px 24px rgba(0,0,0,0.08)' : '0 2px 8px rgba(0,0,0,0.04)' }}>
        <Box
          onClick={() => setFormOpen(o => !o)}
          sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2.5, py: 1.8, cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{ width: 32, height: 32, borderRadius: 1.5, bgcolor: `${ACCENT}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: ACCENT }}>
              <PersonAdd fontSize="small" />
            </Box>
            <Typography sx={{ fontWeight: 600, fontSize: 14 }}>
              {editingUser ? 'Editar Usuario' : 'Nuevo Usuario'}
            </Typography>
            {editingUser && <Chip label="Editando" size="small" sx={{ bgcolor: `${ACCENT}18`, color: ACCENT, fontWeight: 600, fontSize: 11 }} />}
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {formOpen && editingUser && (
              <Button size="small" startIcon={<Close fontSize="small" />} onClick={e => { e.stopPropagation(); resetForm(); }}
                sx={{ color: 'text.secondary', fontWeight: 600, fontSize: 12, textTransform: 'none' }}>
                Cerrar
              </Button>
            )}
            {formOpen ? <ExpandLess sx={{ color: 'text.secondary' }} /> : <ExpandMore sx={{ color: 'text.secondary' }} />}
          </Box>
        </Box>

        <Collapse in={formOpen}>
          <Divider />
          <Box component="form" onSubmit={handleSubmit} sx={{ p: { xs: 2, md: 3 } }}>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={4}>
                <TextField label="Nombre de usuario" value={username} onChange={e => setUsername(e.target.value)} fullWidth required />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  label="Contraseña" type="password" value={password}
                  onChange={e => setPassword(e.target.value)} fullWidth
                  required={!editingUser}
                  helperText={editingUser ? 'Dejar en blanco para mantener la contraseña actual' : ''}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <FormControl fullWidth required>
                  <InputLabel>Rol</InputLabel>
                  <Select value={roleId} label="Rol" onChange={e => setRoleId(e.target.value)}>
                    {roles.map(r => <MenuItem key={r.id} value={r.id}>{r.name}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12}>
                <Box sx={{ display: 'flex', gap: 1.5, justifyContent: 'flex-end' }}>
                  <Button onClick={resetForm} variant="outlined"
                    sx={{ borderRadius: 2, fontWeight: 600, borderColor: 'divider', color: 'text.secondary' }}>
                    Cancelar
                  </Button>
                  <Button type="submit" variant="contained"
                    sx={{ background: `linear-gradient(135deg, ${ACCENT}, #a78bfa)`, boxShadow: `0 4px 14px rgba(139,92,246,0.3)`, borderRadius: 2, fontWeight: 600 }}>
                    {editingUser ? 'Actualizar Usuario' : 'Crear Usuario'}
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
          <Typography sx={{ fontWeight: 700, fontSize: 15 }}>Lista de Usuarios</Typography>
        </Box>
        <Box sx={{ p: { xs: 2, md: 2.5 } }}>
          {isMobile ? (
            <Box>
              {users.map(u => <UserCard key={u.id} user={u} handleEdit={handleEdit} handleDelete={handleDelete} />)}
            </Box>
          ) : (
            <TableContainer sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    {['#', 'Usuario', 'Rol', 'Acciones'].map(h => <TableCell key={h}>{h}</TableCell>)}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {users.length === 0
                    ? <TableRow><TableCell colSpan={4} sx={{ textAlign: 'center', py: 5, color: 'text.secondary' }}>No hay usuarios</TableCell></TableRow>
                    : users.map(u => (
                        <TableRow key={u.id} hover>
                          <TableCell sx={{ fontWeight: 600, color: 'text.secondary', fontSize: 12 }}>#{u.id}</TableCell>
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                              <Avatar sx={{ width: 30, height: 30, bgcolor: `${ACCENT}20`, color: ACCENT, fontWeight: 700, fontSize: 12 }}>
                                {u.username[0].toUpperCase()}
                              </Avatar>
                              <Typography sx={{ fontWeight: 600, fontSize: 13 }}>{u.username}</Typography>
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Chip label={u.role.name} size="small"
                              sx={{ bgcolor: `${ACCENT}15`, color: ACCENT, fontWeight: 600, fontSize: 11, borderRadius: 1.5 }} />
                          </TableCell>
                          <TableCell>
                            <Box sx={{ display: 'flex', gap: 0.5 }}>
                              <Tooltip title="Editar">
                                <IconButton size="small" onClick={() => handleEdit(u)}
                                  sx={{ color: ACCENT, '&:hover': { bgcolor: `${ACCENT}12` } }}>
                                  <Edit fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Eliminar">
                                <IconButton size="small" onClick={() => handleDelete(u.id)}
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
        title="Eliminar usuario"
        message="¿Estás seguro de que quieres eliminar este usuario? Esta acción no se puede deshacer."
      />
    </Box>
  );
};

export default UserManagement;
