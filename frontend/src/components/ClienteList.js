import React, { useState, useEffect,useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../api';
import { formatCurrency } from '../utils/formatters';
import { toast } from 'react-toastify';
import ConfirmationDialog from './ConfirmationDialog';
import ClienteFinancialHistoryDialog from './ClienteFinancialHistoryDialog'; // New import
import {
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Button,
    IconButton, Typography, useMediaQuery, useTheme, Card, CardContent, CardActions, Box,TextField,TablePagination
} from '@mui/material';
import { Edit, Delete, History } from '@mui/icons-material'; // Added History import back




const ClienteCard = ({ cliente, onEditCliente, handleDelete, handleViewHistory }) => (
    <Card sx={{ mb: 2 }}>
        <CardContent>
            <Typography variant="h6" color="text.primary">{cliente.nombre}</Typography>
            <Typography color="textSecondary">ID: {cliente.id}</Typography>
            <Typography color="text.primary">Cédula: {cliente.cedula || 'N/A'}</Typography>
            <Typography color="text.primary">Teléfono: {cliente.telefono || 'N/A'}</Typography>
            <Typography color="text.primary">Dirección: {cliente.direccion || 'N/A'}</Typography>
            <Typography color="text.primary">Cupo de Crédito: {formatCurrency(cliente.cupo_credito)}</Typography>
        </CardContent>
        <CardActions>
            <IconButton onClick={() => onEditCliente(cliente)} color="primary">
                <Edit />
            </IconButton>
            <IconButton onClick={() => handleDelete(cliente.id)} color="error">
                <Delete />
            </IconButton>
            <IconButton onClick={() => handleViewHistory(cliente)} color="info"> {/* Added History button */}
                <History />
            </IconButton>
        </CardActions>
    </Card>
);


const ClienteList = ({ onEditCliente, onClienteDeleted, filterType }) => {
    const [clientes, setClientes] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const navigate = useNavigate();
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

    const [showConfirmDialog, setShowConfirmDialog] = useState(false);
    const [clienteToDelete, setClienteToDelete] = useState(null);

    const [showHistoryDialog, setShowHistoryDialog] = useState(false); // New state
    const [selectedClienteForHistory, setSelectedClienteForHistory] = useState(null); // New state

    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);

    const filteredClientes = useMemo(() => {
        let list = clientes;
        if (filterType === 'cliente') {
            list = list.filter(c => c.es_cliente);
        } else if (filterType === 'proveedor') {
            list = list.filter(c => c.es_proveedor);
        }

        if (!searchTerm) {
            return list;
        }
        const lowerCaseSearchTerm = searchTerm.toLowerCase();
        return list.filter(cliente =>
            cliente.nombre.toLowerCase().includes(lowerCaseSearchTerm) ||
            (cliente.cedula && cliente.cedula.toLowerCase().includes(lowerCaseSearchTerm)) ||
            (cliente.telefono && cliente.telefono.toLowerCase().includes(lowerCaseSearchTerm)) ||
            (cliente.direccion && cliente.direccion.toLowerCase().includes(lowerCaseSearchTerm))
        );
    }, [clientes, searchTerm, filterType]);

    useEffect(() => {
        fetchClientes();
    }, []);

    const fetchClientes = () => {
        apiClient.get('/clientes/')
            .then(response => {
                setClientes(response.data);
            })
            .catch(error => console.error('Error fetching clientes:', error));
    };

    const handleDelete = (id) => {
        setClienteToDelete(id);
        setShowConfirmDialog(true);
    };

    const confirmDelete = () => {
        apiClient.delete(`/clientes/${clienteToDelete}`)
            .then(() => {
                toast.success('Tercero eliminado!');
                fetchClientes(); // Refresh the list
                if (onClienteDeleted) {
                    onClienteDeleted();
                }
            })
            .catch(error => {
                console.error('Error deleting tercero:', error);
                toast.error('Error al eliminar el tercero.');
            })
            .finally(() => {
                setShowConfirmDialog(false);
                setClienteToDelete(null);
            });
    };

    const handleViewHistory = (cliente) => { // New function
        setSelectedClienteForHistory(cliente);
        setShowHistoryDialog(true);
    };

    const handleCloseHistoryDialog = () => { // New function
        setShowHistoryDialog(false);
        setSelectedClienteForHistory(null);
    };

    const handleChangePage = (event, newPage) => {
        setPage(newPage);
    };

    const handleChangeRowsPerPage = (event) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };

    const paginatedClientes = useMemo(() => {
        return filteredClientes.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
    }, [filteredClientes, page, rowsPerPage]);

    return (
        <Paper sx={{ mt: 2 }}>
            <Typography variant="h6" gutterBottom component="div" sx={{ p: 2 }}>
                Lista de {filterType === 'proveedor' ? 'Proveedores' : 'Clientes'}
            </Typography>
            <TextField
                label={`Buscar ${filterType === 'proveedor' ? 'Proveedor' : 'Cliente'}`}
                variant="outlined"
                fullWidth
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                sx={{ mb: 2, px: 2 }} 
            />
            {isMobile ? (
                <Box sx={{ p: 2 }}>
                    {paginatedClientes.map(cliente => (
                        <ClienteCard
                            key={cliente.id}
                            cliente={cliente}
                            onEditCliente={onEditCliente}
                            handleDelete={handleDelete}
                            handleViewHistory={handleViewHistory} // Pass new prop
                        />
                    ))}
                </Box>
            ) : (
                <TableContainer>
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableCell>ID</TableCell>
                                <TableCell>Nombre / Razón Social</TableCell>
                                <TableCell>Cédula / NIT</TableCell>
                                <TableCell>Teléfono</TableCell>
                                <TableCell>Dirección</TableCell>
                                {filterType === 'cliente' && <TableCell>Cupo Crédito</TableCell>}
                                <TableCell>Acciones</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {paginatedClientes.map(cliente => (
                                <TableRow key={cliente.id}>
                                    <TableCell>{cliente.id}</TableCell>
                                    <TableCell>{cliente.nombre}</TableCell>
                                    <TableCell>{cliente.cedula || 'N/A'}</TableCell>
                                    <TableCell>{cliente.telefono || 'N/A'}</TableCell>
                                    <TableCell>{cliente.direccion || 'N/A'}</TableCell>
                                    {filterType === 'cliente' && <TableCell>{formatCurrency(cliente.cupo_credito)}</TableCell>}
                                    <TableCell>
                                        <IconButton onClick={() => onEditCliente(cliente)} color="primary">
                                            <Edit />
                                        </IconButton>
                                        <IconButton onClick={() => handleDelete(cliente.id)} color="error">
                                            <Delete />
                                        </IconButton>
                                        <IconButton onClick={() => handleViewHistory(cliente)} color="info"> {/* Added History button */}
                                            <History />
                                        </IconButton>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}
            <TablePagination
                rowsPerPageOptions={[5, 10, 25]}
                component="div"
                count={filteredClientes.length}
                rowsPerPage={rowsPerPage}
                page={page}
                onPageChange={handleChangePage}
                onRowsPerPageChange={handleChangeRowsPerPage}
                labelRowsPerPage="Filas por página:"
                labelDisplayedRows={({ from, to, count }) => 
                    `${from}-${to} de ${count !== -1 ? count : `más de ${to}`}`
                }
            />

            <ConfirmationDialog
                open={showConfirmDialog}
                handleClose={() => setShowConfirmDialog(false)}
                handleConfirm={confirmDelete}
                title="Confirmar Eliminación"
                message="¿Estás seguro de que quieres eliminar este tercero? Esta acción no se puede deshacer."
            />

            {selectedClienteForHistory && ( // Render dialog conditionally
                <ClienteFinancialHistoryDialog
                    open={showHistoryDialog}
                    handleClose={handleCloseHistoryDialog}
                    clienteId={selectedClienteForHistory.id}
                    clienteNombre={selectedClienteForHistory.nombre}
                />
            )}
        </Paper>
    );
};

export default ClienteList;