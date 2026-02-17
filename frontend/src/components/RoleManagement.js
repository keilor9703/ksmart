import React, { useState, useEffect } from 'react';
import apiClient from '../api';
import { toast } from 'react-toastify';
import {
    Box, Paper, Typography, Grid, TextField, Button, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, IconButton, FormGroup, FormControlLabel, Checkbox
} from '@mui/material';
import { Edit } from '@mui/icons-material';

const RoleManagement = () => {
    const [roles, setRoles] = useState([]);
    const [roleName, setRoleName] = useState('');
    const [editingRole, setEditingRole] = useState(null);
    const [modules, setModules] = useState([]);
    const [selectedModules, setSelectedModules] = useState([]);

    useEffect(() => {
        fetchRoles();
        fetchModules();
    }, []);

    const fetchRoles = async () => {
        try {
            const response = await apiClient.get('/roles/');
            setRoles(response.data);
        } catch (error) {
            toast.error('Error al cargar roles.');
        }
    };

    const fetchModules = async () => {
        try {
            const response = await apiClient.get('/modulos/');
            setModules(response.data);
        } catch (error) {
            toast.error('Error al cargar módulos.');
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingRole) {
                await apiClient.put(`/roles/${editingRole.id}/modules`, selectedModules);
                toast.success('Módulos del rol actualizados!');
            } else {
                const newRole = await apiClient.post('/roles/', { name: roleName });
                if (selectedModules.length > 0) {
                    await apiClient.put(`/roles/${newRole.data.id}/modules`, selectedModules);
                }
                toast.success('Rol agregado!');
            }
            resetForm();
            fetchRoles();
        } catch (error) {
            toast.error(`Error al guardar rol: ${error.response?.data?.detail || error.message}`);
        }
    };

    const handleEdit = (role) => {
        setEditingRole(role);
        setRoleName(role.name);
        setSelectedModules(role.modules.map(m => m.id));
    };

    const handleModuleChange = (moduleId) => {
        setSelectedModules(prev =>
            prev.includes(moduleId) ? prev.filter(id => id !== moduleId) : [...prev, moduleId]
        );
    };

    const resetForm = () => {
        setRoleName('');
        setEditingRole(null);
        setSelectedModules([]);
    };

    return (
        <Box>
            <Paper sx={{ p: 2, mb: 4 }}>
                <Typography variant="h6" gutterBottom>{editingRole ? 'Editar Rol' : 'Agregar Nuevo Rol'}</Typography>
                <Box component="form" onSubmit={handleSubmit}>
                    <Grid container spacing={2}>
                        <Grid item xs={12}>
                            <TextField label="Nombre del Rol" value={roleName} onChange={e => setRoleName(e.target.value)} fullWidth required />
                        </Grid>
                        <Grid item xs={12}>
                            <Typography>Módulos</Typography>
                            <FormGroup row>
                                {modules.map(module => (
                                    <FormControlLabel
                                        key={module.id}
                                        control={<Checkbox checked={selectedModules.includes(module.id)} onChange={() => handleModuleChange(module.id)} />}
                                        label={module.name}
                                    />
                                ))}
                            </FormGroup>
                        </Grid>
                        <Grid item xs={12}>
                            <Button type="submit" variant="contained">{editingRole ? 'Actualizar' : 'Agregar'}</Button>
                            {editingRole && <Button onClick={resetForm} sx={{ ml: 1 }}>Cancelar</Button>}
                        </Grid>
                    </Grid>
                </Box>
            </Paper>

            <Paper sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom color="text.primary">Lista de Roles</Typography>
                <TableContainer>
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableCell>ID</TableCell>
                                <TableCell>Nombre</TableCell>
                                <TableCell>Módulos</TableCell>
                                <TableCell>Acciones</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {roles.map(role => (
                                <TableRow key={role.id}>
                                    <TableCell>{role.id}</TableCell>
                                    <TableCell>{role.name}</TableCell>
                                    <TableCell>{role.modules.map(m => m.name).join(', ')}</TableCell>
                                    <TableCell>
                                        <IconButton onClick={() => handleEdit(role)} color="primary"><Edit /></IconButton>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            </Paper>
        </Box>
    );
};

export default RoleManagement;