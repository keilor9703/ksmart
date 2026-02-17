import React from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Typography,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    Box
} from '@mui/material';
import { formatCurrency } from '../utils/formatters';

const VentaDetailDialog = ({ open, handleClose, venta }) => {
    if (!venta) {
        return null;
    }

    return (
        <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
            <DialogTitle>Detalle de Venta #{venta.id}</DialogTitle>
            <DialogContent dividers>
                <Box sx={{ mb: 2 }}>
                    <Typography variant="h6">Información General</Typography>
                    <Typography><b>Cliente:</b> {venta.cliente?.nombre || 'N/A'}</Typography>
                    <Typography><b>Fecha:</b> {new Date(venta.fecha + 'Z').toLocaleString()}</Typography>
                    <Typography><b>Total Venta:</b> {formatCurrency(venta.total)}</Typography>
                    <Typography><b>Monto Pagado:</b> {formatCurrency(venta.monto_pagado)}</Typography>
                    <Typography><b>Saldo Pendiente:</b> {formatCurrency(venta.total - venta.monto_pagado)}</Typography>
                </Box>
                <Typography variant="h6" gutterBottom>Productos</Typography>
                <TableContainer component={Paper}>
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableCell>Producto</TableCell>
                                <TableCell align="right">Cantidad</TableCell>
                                <TableCell align="right">Precio Unitario</TableCell>
                                <TableCell align="right">Subtotal</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {venta.detalles?.map((detalle) => (
                                <TableRow key={detalle.id}>
                                    <TableCell>{detalle.producto?.nombre}</TableCell>
                                    <TableCell align="right">{detalle.cantidad}</TableCell>
                                    <TableCell align="right">{formatCurrency(detalle.precio_unitario)}</TableCell>
                                    <TableCell align="right">{formatCurrency(detalle.cantidad * detalle.precio_unitario)}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            </DialogContent>
            <DialogActions>
                <Button onClick={handleClose}>Cerrar</Button>
            </DialogActions>
        </Dialog>
    );
};

export default VentaDetailDialog;
