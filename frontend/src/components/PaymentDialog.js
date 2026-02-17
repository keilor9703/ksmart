import React, { useState, useEffect } from 'react';
import { Dialog, DialogActions, DialogContent, DialogTitle, Button, TextField, Typography, Box, Alert, Autocomplete } from '@mui/material';
import { formatCurrency } from '../utils/formatters';
import apiClient from '../api';

const PaymentDialog = ({ open, handleClose, venta, onPaymentSuccess, pagoToEdit }) => {
    const [monto, setMonto] = useState('');
    const [metodoPago, setMetodoPago] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        if (open) {
            setError('');
            if (pagoToEdit) {
                setMonto(pagoToEdit.monto);
                setMetodoPago(pagoToEdit.metodo_pago || '');
            } else {
                setMonto('');
                setMetodoPago('');
            }
        }
    }, [open, pagoToEdit]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (parseFloat(monto) <= 0) {
            setError('Por favor, ingresa un monto de pago válido.');
            return;
        }

        const paymentData = {
            venta_id: venta.id,
            monto: parseFloat(monto),
            metodo_pago: metodoPago,
        };

        try {
            if (pagoToEdit) {
                await apiClient.put(`/pagos/${pagoToEdit.id}`, paymentData);
            } else {
                await apiClient.post('/pagos/', paymentData);
            }
            onPaymentSuccess();
            handleClose();
        } catch (err) {
            setError(err.response?.data?.detail || 'Error al procesar el pago.');
        }
    };

    return (
        <Dialog open={open} onClose={handleClose}>
            <DialogTitle>{pagoToEdit ? 'Editar Pago' : 'Registrar Pago'} para Venta #{venta?.id}</DialogTitle>
            <DialogContent>
                {venta && (
                    <Box sx={{ mb: 2 }}>
                        <Typography color="text.primary">Monto Total: {formatCurrency(venta.total)}</Typography>
                        <Typography color="text.primary">Monto Pagado: {formatCurrency(venta.monto_pagado)}</Typography>
                        <Typography color="error">Monto Pendiente: {formatCurrency(venta.total - venta.monto_pagado)}</Typography>
                    </Box>
                )}
                {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
                <Box component="form" onSubmit={handleSubmit}>
                    <TextField
                        autoFocus
                        margin="dense"
                        label="Monto del Pago"
                        type="number"
                        fullWidth
                        variant="standard"
                        value={monto}
                        onChange={(e) => setMonto(e.target.value)}
                        required
                    />
                    <Autocomplete
                        options={['Efectivo', 'Nequi', 'Transferencia']}
                        value={metodoPago}
                        onChange={(event, newValue) => {
                            setMetodoPago(newValue);
                        }}
                        renderInput={(params) => (
                            <TextField
                                {...params}
                                margin="dense"
                                label="Método de Pago"
                                fullWidth
                                variant="standard"
                            />
                        )}
                        sx={{ mt: 2 }} // Add some top margin
                    />
                </Box>
            </DialogContent>
            <DialogActions>
                <Button onClick={handleClose}>Cancelar</Button>
                <Button onClick={handleSubmit} variant="contained">
                    {pagoToEdit ? 'Actualizar Pago' : 'Registrar Pago'}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default PaymentDialog;
