import React, { useState, useEffect } from 'react';
import apiClient from '../../api';
import { toast } from 'react-toastify';
import ConfirmationDialog from '../ConfirmationDialog';
import {
  Box, Paper, Typography, Grid, TextField, Button, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, IconButton, FormControl,
  InputLabel, Select, MenuItem, useMediaQuery, useTheme, Chip, Tooltip,
  Divider, Collapse, Avatar
} from '@mui/material';
import {
  Edit, Block, CheckCircle, PersonAdd, People, ExpandMore, ExpandLess,
  Close, AdminPanelSettings, Person
} from '@mui/icons-material';

const ACCENT = '#8B5CF6'; 

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [roleId, setRoleId] = useState('');
  const [editingUser, setEditingUser] = useState(null);
  const [formOpen, setFormOpen] = useState(false);

  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [userToToggle, setUserToToggle] = useState(null);

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  useEffect(() => {
    fetchUsers();
    fetchRoles();
  }, []);

  const fetchUsers = () => apiClient.get('/users/').then(r => setUsers(r.data)).catch(console.error);
  const fetchRoles = () => apiClient.get('/roles/').then(r => setRoles(r.data)).catch(console.error);

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
      resetForm();
      fetchUsers();
    } catch (err) {
      // ✅ Aquí capturamos el mensaje de upsell de 7 usuarios
      toast.error(err.response?.data?.detail || 'Error al guardar usuario', { autoClose: 6000 });
    }
  };

  const resetForm = () => {
    setUsername(''); setPassword(''); setRoleId('');
    setEditingUser(null); setFormOpen(false);
  };

  const handleEdit = (user) => {
    setEditingUser(user);
    setUsername(user.username);
    setRoleId(user.role.id);
    setPassword('');
    setFormOpen(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleToggleClick = (user) => {
    setUserToToggle(user);
    setShowConfirmDialog(true);
  };

  const confirmToggle = async () => {
    try {
      if (userToToggle.is_active) {
        // En vez de borrar físicamente, usamos el endpoint DELETE que ahora hace Soft Delete
        await apiClient.delete(`/users/${userToToggle.id}`);
        toast.success('Usuario desactivado exitosamente');
      } else {
        // Endpoint PATCH para reactivarlo
        await apiClient.patch(`/users/${userToToggle.id}/toggle`);
        toast.success('Usuario reactivado exitosamente');
      }
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al cambiar estado del usuario');
    } finally {
      setShowConfirmDialog(false);
      setUserToToggle(null);
    }
  };

  return (
    <Box sx={{ width: '100%' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ width: 40, height: 40, borderRadius: 2, bgcolor: `${ACCENT}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: ACCENT }}>
            <AdminPanelSettings />
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 700, fontSize: 20, lineHeight: 1.2 }}>Usuarios y Permisos</Typography>
            <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>Control de acceso del personal</Typography>
          </Box>
        </Box>
        <Button variant="contained" startIcon={<PersonAdd />} onClick={() => { resetForm(); setFormOpen(true); }}
          sx={{ background: `linear-gradient(135deg, ${ACCENT}, #a78bfa)`, boxShadow: `0 4px 14px rgba(139,92,246,0.3)`, borderRadius: 2, fontWeight: 600 }}>
          Nuevo Usuario
        </Button>
      </Box>

      <Collapse in={formOpen}>
        <Paper sx={{ p: 3, mb: 3, borderRadius: 3, border: `1px solid ${ACCENT}50`, bgcolor: `${ACCENT}05`, boxShadow: 'none' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography sx={{ fontWeight: 700 }}>{editingUser ? 'Editar Usuario' : 'Crear Usuario'}</Typography>
            <IconButton size="small" onClick={resetForm}><Close fontSize="small" /></IconButton>
          </Box>
          <Box component="form" onSubmit={handleSubmit}>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={4}>
                <TextField label="Nombre de usuario" value={username} onChange={e => setUsername(e.target.value)} fullWidth required size="small"/>
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField label="Contraseña" type="password" value={password} onChange={e => setPassword(e.target.value)} fullWidth required={!editingUser} size="small" helperText={editingUser ? 'Dejar en blanco para no cambiarla' : ''} />
              </Grid>
              <Grid item xs={12} sm={4}>
                <FormControl fullWidth required size="small">
                  <InputLabel>Rol del empleado</InputLabel>
                  <Select value={roleId} label="Rol del empleado" onChange={e => setRoleId(e.target.value)}>
                    {roles.map(r => <MenuItem key={r.id} value={r.id}>{r.name}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
                <Button type="submit" variant="contained" sx={{ bgcolor: ACCENT, '&:hover': { bgcolor: '#7c3aed' }, fontWeight: 600 }}>
                  {editingUser ? 'Actualizar' : 'Guardar Usuario'}
                </Button>
              </Grid>
            </Grid>
          </Box>
        </Paper>
      </Collapse>

      <Paper sx={{ borderRadius: 3, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                {['#', 'Usuario', 'Rol', 'Estado', 'Acciones'].map(h => <TableCell key={h} sx={{ fontWeight: 600 }}>{h}</TableCell>)}
              </TableRow>
            </TableHead>
            <TableBody>
              {users.length === 0 ? <TableRow><TableCell colSpan={5} align="center" sx={{ py: 3 }}>No hay usuarios registrados</TableCell></TableRow> :
                users.map(u => (
                  <TableRow key={u.id} hover sx={{ opacity: u.is_active !== false ? 1 : 0.6 }}>
                    <TableCell sx={{ color: 'text.secondary', fontSize: 12 }}>#{u.id}</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Avatar sx={{ width: 26, height: 26, bgcolor: u.is_active !== false ? `${ACCENT}20` : '#e2e8f0', color: u.is_active !== false ? ACCENT : '#94a3b8', fontSize: 11, fontWeight: 700 }}>
                          {u.username[0].toUpperCase()}
                        </Avatar>
                        {u.username}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip label={u.role.name} size="small" sx={{ bgcolor: `${ACCENT}15`, color: ACCENT, fontWeight: 600, fontSize: 11, borderRadius: 1 }} />
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={u.is_active !== false ? 'Activo' : 'Suspendido'} 
                        size="small" 
                        sx={{ 
                          bgcolor: u.is_active !== false ? '#ECFDF5' : '#FEF2F2', 
                          color: u.is_active !== false ? '#10B981' : '#EF4444', 
                          fontWeight: 700, fontSize: 10, borderRadius: 1.5 
                        }} 
                      />
                    </TableCell>
                    <TableCell>
                      <Tooltip title="Editar">
                        <IconButton size="small" onClick={() => handleEdit(u)} sx={{ color: ACCENT, mr: 1, bgcolor: `${ACCENT}12`, borderRadius: 1.5 }}>
                          <Edit fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={u.is_active !== false ? "Suspender acceso" : "Reactivar usuario"}>
                        <IconButton size="small" onClick={() => handleToggleClick(u)} sx={{ color: u.is_active !== false ? '#EF4444' : '#10B981', bgcolor: u.is_active !== false ? '#FEF2F2' : '#ECFDF5', borderRadius: 1.5 }}>
                          {u.is_active !== false ? <Block fontSize="small" /> : <CheckCircle fontSize="small" />}
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))
              }
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <ConfirmationDialog
        open={showConfirmDialog}
        handleClose={() => setShowConfirmDialog(false)}
        handleConfirm={confirmToggle}
        title={userToToggle?.is_active !== false ? "Suspender usuario" : "Reactivar usuario"}
        message={
          userToToggle?.is_active !== false 
          ? "¿Estás seguro? El usuario ya no podrá iniciar sesión, pero sus registros de ventas y cobros seguirán intactos."
          : "¿Deseas permitir que este usuario vuelva a ingresar al sistema?"
        }
      />
    </Box>
  );
};

export default UserManagement;