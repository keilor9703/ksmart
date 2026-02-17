
import React, { useState } from 'react';
import {
    Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, TextField
} from '@mui/material';

const RechazoDialog = ({ open, handleClose, handleConfirm }) => {
    const [observaciones, setObservaciones] = useState('');

    const onConfirm = () => {
        handleConfirm(observaciones);
        setObservaciones(''); // Reset after confirm
    };

    return (
        <Dialog open={open} onClose={handleClose}>
            <DialogTitle>Rechazar Orden de Trabajo</DialogTitle>
            <DialogContent>
                <DialogContentText>
                    Por favor, introduce el motivo del rechazo. Esta observación será enviada al operador.
                </DialogContentText>
                <TextField
                    autoFocus
                    margin="dense"
                    id="observaciones"
                    label="Motivo del Rechazo"
                    type="text"
                    fullWidth
                    variant="standard"
                    value={observaciones}
                    onChange={(e) => setObservaciones(e.target.value)}
                    multiline
                    rows={3}
                />
            </DialogContent>
            <DialogActions>
                <Button onClick={handleClose}>Cancelar</Button>
                <Button onClick={onConfirm} disabled={!observaciones}>Confirmar Rechazo</Button>
            </DialogActions>
        </Dialog>
    );
};

export default RechazoDialog;
