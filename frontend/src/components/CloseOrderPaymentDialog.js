import React, { useState, useEffect } from 'react';
import {
    Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Button,
    RadioGroup, FormControlLabel, Radio, TextField, FormControl, FormLabel, Box
} from '@mui/material';
import { toast } from 'react-toastify';
import { formatCurrency } from '../utils/formatters';

const CloseOrderPaymentDialog = ({ open, handleClose, orden, onConfirmClose }) => {
    const [wasPaid, setWasPaid] = useState(''); // 'yes' or 'no'
    const [paymentType, setPaymentType] = useState(''); // 'total' or 'partial'
    const [paidAmount, setPaidAmount] = useState('');
    const [amountError, setAmountError] = useState(false);

    useEffect(() => {
        if (open) {
            setWasPaid('');
            setPaymentType('');
            setPaidAmount('');
            setAmountError(false);
        }
    }, [open]);

    const handleConfirm = () => {
        if (wasPaid === 'yes') {
            if (paymentType === 'partial') {
                const amount = parseFloat(paidAmount);
                if (isNaN(amount) || amount <= 0 || amount > orden.total) {
                    setAmountError(true);
                    toast.error(`El monto pagado debe ser un número positivo y no puede exceder el total de la orden (${formatCurrency(orden.total)}).`);
                    return;
                }
            } else if (paymentType === '') {
                toast.error('Por favor, selecciona el tipo de pago (Total o Parcial).');
                return;
            }
        }

        onConfirmClose({
            ordenId: orden.id,
            wasPaid: wasPaid === 'yes',
            paymentType: wasPaid === 'yes' ? paymentType : null,
            paidAmount: wasPaid === 'yes' && paymentType === 'partial' ? parseFloat(paidAmount) : (wasPaid === 'yes' && paymentType === 'total' ? orden.total : 0),
        });
        handleClose();
    };

    return (
        <Dialog open={open} onClose={handleClose}>
            <DialogTitle>Cerrar Orden de Trabajo #{orden?.id}</DialogTitle>
            <DialogContent>
                <DialogContentText sx={{ mb: 2 }}>
                    ¿Estás seguro de cerrar esta orden de trabajo?
                </DialogContentText>

                <FormControl component="fieldset" sx={{ mb: 2 }}>
                    <FormLabel component="legend">¿Esta orden fue pagada?</FormLabel>
                    <RadioGroup row value={wasPaid} onChange={(e) => setWasPaid(e.target.value)}>
                        <FormControlLabel value="yes" control={<Radio />} label="Sí" />
                        <FormControlLabel value="no" control={<Radio />} label="No" />
                    </RadioGroup>
                </FormControl>

                {wasPaid === 'yes' && (
                    <Box sx={{ mb: 2 }}>
                        <FormControl component="fieldset">
                            <FormLabel component="legend">Tipo de pago</FormLabel>
                            <RadioGroup row value={paymentType} onChange={(e) => setPaymentType(e.target.value)}>
                                <FormControlLabel value="total" control={<Radio />} label="Pago total" />
                                <FormControlLabel value="partial" control={<Radio />} label="Pago parcial" />
                            </RadioGroup>
                        </FormControl>

                        {paymentType === 'partial' && (
                            <TextField
                                autoFocus
                                margin="dense"
                                id="paidAmount"
                                label={`Monto pagado (Total: ${formatCurrency(orden?.total)})`}
                                type="number"
                                fullWidth
                                variant="outlined"
                                value={paidAmount}
                                onChange={(e) => {
                                    setPaidAmount(e.target.value);
                                    setAmountError(false);
                                }}
                                error={amountError}
                                helperText={amountError ? `El monto no puede exceder ${formatCurrency(orden?.total)}` : ''}
                                sx={{ mt: 2 }}
                            />
                        )}
                    </Box>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={handleClose}>Cancelar</Button>
                <Button onClick={handleConfirm} variant="contained">Confirmar Cierre</Button>
            </DialogActions>
        </Dialog>
    );
};

export default CloseOrderPaymentDialog;
