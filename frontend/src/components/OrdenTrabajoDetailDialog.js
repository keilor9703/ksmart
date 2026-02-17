
import React from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, Box, Divider, List, ListItem, ListItemText
} from '@mui/material';
import { formatCurrency } from '../utils/formatters';

const OrdenTrabajoDetailDialog = ({ open, handleClose, orden }) => {
    if (!orden) return null;

    return (
        <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
            <DialogTitle>Detalles de la Orden de Trabajo #{orden.id}</DialogTitle>
            <DialogContent dividers>
                <Typography variant="h6" gutterBottom>Información General</Typography>
                <Typography>Cliente: {orden.cliente?.nombre}</Typography>
                <Typography>Operador: {orden.operador?.username}</Typography>
                <Typography>Estado: {orden.estado}</Typography>
                <Typography>Total: {formatCurrency(orden.total)}</Typography>
                <Typography>Fecha de Creación: {new Date(orden.fecha_creacion + 'Z').toLocaleString()}</Typography>
                {orden.observaciones_aprobador && (
                    <Typography>Observaciones del Aprobador: {orden.observaciones_aprobador}</Typography>
                )}

                <Divider sx={{ my: 2 }} />

                {orden.productos && orden.productos.length > 0 && (
                    <>
                        <Typography variant="h6" gutterBottom>Productos</Typography>
                        <List dense>
                            {orden.productos.map(item => (
                                <ListItem key={item.id}>
                                    <ListItemText
                                        primary={`${item.producto?.nombre} (x${item.cantidad})`}
                                        secondary={`Precio Unitario: ${formatCurrency(item.precio_unitario)} - Subtotal: ${formatCurrency(item.cantidad * item.precio_unitario)}`}
                                    />
                                </ListItem>
                            ))}
                        </List>
                        <Divider sx={{ my: 2 }} />
                    </>
                )}

                {orden.servicios && orden.servicios.length > 0 && (
                    <>
                        <Typography variant="h6" gutterBottom>Servicios</Typography>
                        <List dense>
                            {orden.servicios.map(item => (
                                <ListItem key={item.id}>
                                    <ListItemText
                                        primary={`${item.servicio?.nombre} (x${item.cantidad})`}
                                        secondary={`Precio Unitario: ${formatCurrency(item.precio_servicio)} - Subtotal: ${formatCurrency(item.cantidad * item.precio_servicio)}`}
                                    />
                                </ListItem>
                            ))}
                        </List>
                        <Divider sx={{ my: 2 }} />
                    </>
                )}

                {orden.evidencias && orden.evidencias.length > 0 && (
                    <>
                        <Typography variant="h6" gutterBottom>Evidencias</Typography>
                        <List dense>
                            {orden.evidencias.map(item => (
                                <ListItem key={item.id}>
                                    <ListItemText
                                        primary={<a href={`http://localhost:8000/${item.file_path}`} target="_blank" rel="noopener noreferrer">{item.file_path.split('/').pop()}</a>}
                                        secondary={`Subido el: ${new Date(item.uploaded_at + 'Z').toLocaleString()}`}
                                    />
                                </ListItem>
                            ))}
                        </List>
                    </>
                )}

            </DialogContent>
            <DialogActions>
                <Button onClick={handleClose}>Cerrar</Button>
            </DialogActions>
        </Dialog>
    );
};

export default OrdenTrabajoDetailDialog;
