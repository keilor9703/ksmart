import React, { useState, useEffect } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions, Button,
    Typography, Box, CircularProgress, Table, TableBody, TableCell,
    TableContainer, TableHead, TableRow, Paper, Accordion, AccordionSummary,
    AccordionDetails, Chip
} from '@mui/material';
import { ExpandMore } from '@mui/icons-material';
import apiClient from '../api';
import { formatCurrency } from '../utils/formatters';

const ClienteFinancialHistoryDialog = ({ open, handleClose, clienteId, clienteNombre }) => {
    const [history, setHistory] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (open && clienteId) {
            const fetchClienteHistory = async () => {
                try {
                    setLoading(true);
                    setError(null);
                    const response = await apiClient.get(`/clientes/${clienteId}/history`);
                    setHistory(response.data);
                } catch (err) {
                    console.error('Error fetching client history:', err);
                    setError('No se pudo cargar el historial financiero del cliente.');
                } finally {
                    setLoading(false);
                }
            };
            fetchClienteHistory();
        } else {
            // Reset state when dialog is closed
            setHistory(null);
            setLoading(true);
            setError(null);
        }
    }, [open, clienteId]);

    const getEstadoPagoChip = (estado) => {
        const chipProps = {
            pagado: { label: 'Pagada', color: 'success' },
            parcial: { label: 'Parcial', color: 'warning' },
            pendiente: { label: 'Pendiente', color: 'error' },
        };
        const props = chipProps[estado] || { label: 'Desconocido', color: 'default' };
        return <Chip label={props.label} color={props.color} size="small" />;
    };

    return (
        <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
            <DialogTitle color="text.primary">Historial Financiero de {clienteNombre || 'Cliente'}</DialogTitle>
            <DialogContent dividers>
                {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200 }}>
                        <CircularProgress />
                    </Box>
                ) : error ? (
                    <Typography color="error">{error}</Typography>
                ) : !history || (!history.ventas.length && !history.total_ventas_general) ? (
                    <Typography color="text.primary">No se encontró historial financiero para este cliente.</Typography>
                ) : (
                    <Box>
                        <Paper sx={{ p: 2, mb: 3 }}>
                            <Typography variant="h6" gutterBottom color="text.primary">Resumen Financiero</Typography>
                            <Typography color="text.primary">Total Ventas: <strong>{formatCurrency(history.total_ventas_general)}</strong></Typography>
                            <Typography color="text.primary">Total Pagado: <strong>{formatCurrency(history.total_pagado_general)}</strong></Typography>
                            <Typography color="text.primary">Deuda Total Pendiente: <strong>{formatCurrency(history.total_deuda)}</strong></Typography>
                        </Paper>

                        <Typography variant="h6" gutterBottom color="text.primary" sx={{ mt: 4, mb: 2 }}>Detalle de Ventas y Pagos</Typography>
                        {history.ventas.length > 0 ? (
                            history.ventas.map((venta) => (
                                <Accordion key={venta.id} sx={{ mb: 1 }}>
                                    <AccordionSummary expandIcon={<ExpandMore />}>
                                        <Typography color="text.primary">
                                            Venta #{venta.id} - {new Date(venta.fecha).toLocaleDateString()} - Total: {formatCurrency(venta.total)} - {getEstadoPagoChip(venta.estado_pago)}
                                        </Typography>
                                    </AccordionSummary>
                                    <AccordionDetails>
                                        <Box sx={{ mb: 2 }}>
                                            <Typography variant="subtitle1" color="text.primary">Productos de la Venta:</Typography>
                                            <TableContainer component={Paper} sx={{ mt: 1 }}>
                                                <Table size="small">
                                                    <TableHead>
                                                        <TableRow>
                                                            <TableCell>Producto</TableCell>
                                                            <TableCell align="right">Cantidad</TableCell>
                                                            <TableCell align="right">Precio Unitario</TableCell>
                                                            <TableCell align="right">Subtotal</TableCell>
                                                        </TableRow>
                                                    </TableHead>
                                                    <TableBody>
                                                        {venta.detalles.map(detalle => (
                                                            <TableRow key={detalle.id}>
                                                                <TableCell><Typography color="text.primary">{detalle.producto?.nombre || 'N/A'}</Typography></TableCell>
                                                                <TableCell align="right"><Typography color="text.primary">{detalle.cantidad}</Typography></TableCell>
                                                                <TableCell align="right"><Typography color="text.primary">{formatCurrency(detalle.precio_unitario)}</Typography></TableCell>
                                                                <TableCell align="right"><Typography color="text.primary">{formatCurrency(detalle.precio_unitario * detalle.cantidad)}</Typography></TableCell>
                                                            </TableRow>
                                                        ))}
                                                    </TableBody>
                                                </Table>
                                            </TableContainer>
                                        </Box>

                                        <Typography color="text.primary">Monto Pagado: <strong>{formatCurrency(venta.monto_pagado)}</strong></Typography>
                                        <Typography color="text.primary">Monto Pendiente: <strong>{formatCurrency(venta.total - venta.monto_pagado)}</strong></Typography>

                                        {venta.pagos.length > 0 && (
                                            <Box sx={{ mt: 3 }}>
                                                <Typography variant="subtitle1" color="text.primary">Historial de Pagos:</Typography>
                                                <TableContainer component={Paper} sx={{ mt: 1 }}>
                                                    <Table size="small">
                                                        <TableHead>
                                                            <TableRow>
                                                                <TableCell>ID Pago</TableCell>
                                                                <TableCell align="right">Monto</TableCell>
                                                                <TableCell>Fecha</TableCell>
                                                                <TableCell>Método</TableCell>
                                                            </TableRow>
                                                        </TableHead>
                                                        <TableBody>
                                                            {venta.pagos.map(pago => (
                                                                <TableRow key={pago.id}>
                                                                    <TableCell><Typography color="text.primary">{pago.id}</Typography></TableCell>
                                                                    <TableCell align="right"><Typography color="text.primary">{formatCurrency(pago.monto)}</Typography></TableCell>
                                                                    <TableCell><Typography color="text.primary">{new Date(pago.fecha + 'Z').toLocaleString()}</Typography></TableCell>
                                                                    <TableCell><Typography color="text.primary">{pago.metodo_pago || 'N/A'}</Typography></TableCell>
                                                                </TableRow>
                                                            ))}
                                                        </TableBody>
                                                    </Table>
                                                </TableContainer>
                                            </Box>
                                        )}
                                    </AccordionDetails>
                                </Accordion>
                            ))
                        ) : (
                            <Typography color="text.primary">No hay ventas registradas para este cliente.</Typography>
                        )}
                    </Box>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={handleClose}>Cerrar</Button>
            </DialogActions>
        </Dialog>
    );
};

export default ClienteFinancialHistoryDialog;
