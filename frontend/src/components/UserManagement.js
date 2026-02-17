import React, { useState, useEffect } from 'react';
import apiClient from '../api';
import { toast } from 'react-toastify';
import {
    Box, Paper, Typography, Grid, TextField, Button, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, IconButton, FormControl, InputLabel, Select, MenuItem, useMediaQuery, useTheme, Card, CardContent, CardActions
} from '@mui/material';
import { Edit, Delete } from '@mui/icons-material';
import ConfirmationDialog from './ConfirmationDialog';

const UserCard = ({ user, handleEdit, handleDelete }) => (
    <Card sx={{ mb: 2 }}>
        <CardContent>
            <Typography variant="h6" color="text.primary">{user.username}</Typography>
            <Typography color="textSecondary">ID: {user.id}</Typography>
            <Typography color="text.primary">Rol: {user.role.name}</Typography>
        </CardContent>
        <CardActions>
            <IconButton onClick={() => handleEdit(user)} color="primary"><Edit /></IconButton>
            <IconButton onClick={() => handleDelete(user.id)} color="error"><Delete /></IconButton>
        </CardActions>
    </Card>
);

const UserManagement = () => {
    const [users, setUsers] = useState([]);
    const [roles, setRoles] = useState([]);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [roleId, setRoleId] = useState('');
    const [editingUser, setEditingUser] = useState(null);
    const [showConfirmDialog, setShowConfirmDialog] = useState(false);
    const [userToDelete, setUserToDelete] = useState(null);
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

    useEffect(() => {
        fetchUsers();
        fetchRoles();
    }, []);

    const fetchUsers = async () => {
        try {
            const response = await apiClient.get('/users/');
            setUsers(response.data);
        } catch (error) {
            toast.error('Error al cargar usuarios.');
        }
    };

    const fetchRoles = async () => {
        try {
            const response = await apiClient.get('/roles/');
            setRoles(response.data);
        } catch (error) {
            toast.error('Error al cargar roles.');
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const userData = {
            username,
            password,
            role_id: parseInt(roleId),
        };

        try {
            if (editingUser) {
                await apiClient.put(`/users/${editingUser.id}`, userData);
                toast.success('Usuario actualizado!');
            } else {
                await apiClient.post('/users/', userData);
                toast.success('Usuario agregado!');
            }
            resetForm();
            fetchUsers();
        } catch (error) {
            toast.error(`Error al guardar usuario: ${error.response?.data?.detail || error.message}`);
        }
    };

    const handleEdit = (user) => {
        setEditingUser(user);
        setUsername(user.username);
        setRoleId(user.role.id);
        setPassword('');
    };

    const handleDelete = (id) => {
        setUserToDelete(id);
        setShowConfirmDialog(true);
    };

    const confirmDelete = async () => {
        try {
            await apiClient.delete(`/users/${userToDelete}`);
            toast.success('Usuario eliminado!');
            fetchUsers();
        } catch (error) {
            toast.error(`Error al eliminar usuario: ${error.response?.data?.detail || error.message}`);
        } finally {
            setShowConfirmDialog(false);
            setUserToDelete(null);
        }
    };

    const resetForm = () => {
        setUsername('');
        setPassword('');
        setRoleId('');
        setEditingUser(null);
    };

    return (
        <Box>
            <Paper sx={{ p: 3, mb: 4 }}>
                <Typography variant="h6" gutterBottom>{editingUser ? 'Editar Usuario' : 'Agregar Nuevo Usuario'}</Typography>
                <Box component="form" onSubmit={handleSubmit}>
                    <Grid container spacing={2}>
                        <Grid item xs={12} sm={6} mb={2}>
                            <TextField label="Usuario" value={username} onChange={e => setUsername(e.target.value)} fullWidth required />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField label="Contraseña" type="password" value={password} onChange={e => setPassword(e.target.value)} fullWidth required={!editingUser} />
                        </Grid>
                        <Grid item xs={12} sm={6} mb={2}>
                            <FormControl fullWidth required>
                                <InputLabel>Rol</InputLabel>
                                <Select value={roleId} label="Rol" onChange={e => setRoleId(e.target.value)}>
                                    {roles.map(role => (
                                        <MenuItem key={role.id} value={role.id}>{role.name}</MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12}>
                            <Button type="submit" variant="contained">{editingUser ? 'Actualizar' : 'Agregar'}</Button>
                            {editingUser && <Button onClick={resetForm} sx={{ ml: 1 }}>Cancelar</Button>}
                        </Grid>
                    </Grid>
                </Box>
            </Paper>

            <Paper sx={{ p: 3 }}>
                <Typography variant="h6" gutterBottom>Lista de Usuarios</Typography>
                {isMobile ? (
                    <Box>
                        {users.map(user => (
                            <UserCard 
                                key={user.id}
                                user={user}
                                handleEdit={handleEdit}
                                handleDelete={handleDelete}
                            />
                        ))}
                    </Box>
                ) : (
                    <TableContainer>
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableCell>ID</TableCell>
                                    <TableCell>Usuario</TableCell>
                                    <TableCell>Rol</TableCell>
                                    <TableCell>Acciones</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {users.map(user => (
                                    <TableRow key={user.id}>
                                        <TableCell>{user.id}</TableCell>
                                        <TableCell>{user.username}</TableCell>
                                        <TableCell>{user.role.name}</TableCell>
                                        <TableCell>
                                            <IconButton onClick={() => handleEdit(user)} color="primary"><Edit /></IconButton>
                                            <IconButton onClick={() => handleDelete(user.id)} color="error"><Delete /></IconButton>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                )}
            </Paper>
            <ConfirmationDialog
                open={showConfirmDialog}
                handleClose={() => setShowConfirmDialog(false)}
                handleConfirm={confirmDelete}
                title="Confirmar Eliminación"
                message="¿Estás seguro de que quieres eliminar este usuario?"
            />
        </Box>
    );
};

export default UserManagement;