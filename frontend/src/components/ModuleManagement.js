import React, { useState, useEffect } from 'react';
import apiClient from '../api';
import { toast } from 'react-toastify';
import {
    Box, Paper, Typography, Grid, TextField, Button, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, IconButton
} from '@mui/material';
import { Edit, Delete } from '@mui/icons-material';
import ConfirmationDialog from './ConfirmationDialog';

const ModuleManagement = () => {
    const [modulos, setModulos] = useState([]);
    const [moduleName, setModuleName] = useState('');
    const [moduleDescription, setModuleDescription] = useState('');
    const [moduleFrontendPath, setModuleFrontendPath] = useState('');
    const [editingModulo, setEditingModulo] = useState(null);
    const [showConfirmDialog, setShowConfirmDialog] = useState(false);
    const [moduloToDelete, setModuloToDelete] = useState(null);

    useEffect(() => {
        fetchModulos();
    }, []);

    const fetchModulos = async () => {
        try {
            const response = await apiClient.get('/modulos/');
            setModulos(response.data);
        } catch (error) {
            toast.error('Error al cargar módulos.');
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const moduleData = {
            name: moduleName,
            description: moduleDescription,
            frontend_path: moduleFrontendPath
        };
        try {
            if (editingModulo) {
                await apiClient.put(`/modulos/${editingModulo.id}`, moduleData);
                toast.success('Módulo actualizado!');
            } else {
                await apiClient.post('/modulos/', moduleData);
                toast.success('Módulo agregado!');
            }
            resetForm();
            fetchModulos();
        } catch (error) {
            toast.error(`Error al guardar módulo: ${error.response?.data?.detail || error.message}`);
        }
    };

    const handleEdit = (modulo) => {
        setEditingModulo(modulo);
        setModuleName(modulo.name);
        setModuleDescription(modulo.description);
        setModuleFrontendPath(modulo.frontend_path);
    };

    const handleDelete = (id) => {
        setModuloToDelete(id);
        setShowConfirmDialog(true);
    };

    const confirmDelete = async () => {
        try {
            await apiClient.delete(`/modulos/${moduloToDelete}`);
            toast.success('Módulo eliminado!');
            fetchModulos();
        } catch (error) {
            toast.error(`Error al eliminar módulo: ${error.response?.data?.detail || error.message}`);
        } finally {
            setShowConfirmDialog(false);
            setModuloToDelete(null);
        }
    };

    const resetForm = () => {
        setModuleName('');
        setModuleDescription('');
        setModuleFrontendPath('');
        setEditingModulo(null);
    };

    return (
        <Box>
            <Paper sx={{ p: 2, mb: 4 }}>
                <Typography variant="h6" gutterBottom>{editingModulo ? 'Editar Módulo' : 'Agregar Nuevo Módulo'}</Typography>
                <Box component="form" onSubmit={handleSubmit}>
                    <Grid container spacing={2}>
                        <Grid item xs={12} sm={4}>
                            <TextField label="Nombre del Módulo" value={moduleName} onChange={e => setModuleName(e.target.value)} fullWidth required />
                        </Grid>
                        <Grid item xs={12} sm={4}>
                            <TextField label="Descripción" value={moduleDescription} onChange={e => setModuleDescription(e.target.value)} fullWidth />
                        </Grid>
                        <Grid item xs={12} sm={4}>
                            <TextField label="Ruta Frontend" value={moduleFrontendPath} onChange={e => setModuleFrontendPath(e.target.value)} fullWidth required />
                        </Grid>
                        <Grid item xs={12}>
                            <Button type="submit" variant="contained">{editingModulo ? 'Actualizar' : 'Agregar'}</Button>
                            {editingModulo && <Button onClick={resetForm} sx={{ ml: 1 }}>Cancelar</Button>}
                        </Grid>
                    </Grid>
                </Box>
            </Paper>

            <Paper sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom color="text.primary">Lista de Módulos</Typography>
                <TableContainer>
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableCell>ID</TableCell>
                                <TableCell>Nombre</TableCell>
                                <TableCell>Descripción</TableCell>
                                <TableCell>Ruta Frontend</TableCell>
                                <TableCell>Acciones</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {modulos.map(modulo => (
                                <TableRow key={modulo.id}>
                                    <TableCell>{modulo.id}</TableCell>
                                    <TableCell>{modulo.name}</TableCell>
                                    <TableCell>{modulo.description}</TableCell>
                                    <TableCell>{modulo.frontend_path}</TableCell>
                                    <TableCell>
                                        <IconButton onClick={() => handleEdit(modulo)} color="primary"><Edit /></IconButton>
                                        <IconButton onClick={() => handleDelete(modulo.id)} color="error"><Delete /></IconButton>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            </Paper>
            <ConfirmationDialog
                open={showConfirmDialog}
                handleClose={() => setShowConfirmDialog(false)}
                handleConfirm={confirmDelete}
                title="Confirmar Eliminación"
                message="¿Estás seguro de que quieres eliminar este módulo? Esto podría afectar la funcionalidad de los roles."
            />
        </Box>
    );
};

export default ModuleManagement;