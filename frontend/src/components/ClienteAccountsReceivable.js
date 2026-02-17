import React, { useState, useEffect } from 'react';
import apiClient from '../api';
import { formatCurrency } from '../utils/formatters';
import PaymentDialog from './PaymentDialog';
import { toast } from 'react-toastify';
import {
    Box, Paper, Typography, Accordion, AccordionSummary, AccordionDetails,
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow, 
    Chip, IconButton, Card, CardContent, CardActions, useMediaQuery
} from '@mui/material';
import { ExpandMore, Edit, Payment, AttachMoney } from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';

const ClienteAccountsReceivable = () => {
    const [cuentasPorCobrar, setCuentasPorCobrar] = useState([]);
    const [showPaymentDialog, setShowPaymentDialog] = useState(false);
    const [selectedVenta, setSelectedVenta] = useState(null);
    const [selectedPago, setSelectedPago] = useState(null);

    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

    useEffect(() => {
        fetchCuentasPorCobrar();
    }, []);

    const fetchCuentasPorCobrar = () => {
        apiClient.get('/reportes/cuentas_por_cobrar')
            .then(res => setCuentasPorCobrar(res.data))
            .catch(console.error);
    };

    const handleShowPaymentDialog = (venta, pago = null) => {
        setSelectedVenta(venta);
        setSelectedPago(pago);
        setShowPaymentDialog(true);
    };

    const handleClosePaymentDialog = () => {
        setShowPaymentDialog(false);
        setSelectedVenta(null);
        setSelectedPago(null);
    };

    const handlePaymentSuccess = () => {
        fetchCuentasPorCobrar();
        toast.success('Operación de pago completada exitosamente!');
    };
    
    const handleTotalPayment = async (venta) => {
        const montoPendiente = venta.total - venta.monto_pagado;
        if (montoPendiente <= 0) {
            toast.info('Esta venta ya está completamente pagada.');
            return;
        }

        if (window.confirm(`¿Registrar un pago total de ${formatCurrency(montoPendiente)} para la venta #${venta.id}?`)) {
            try {
                await apiClient.post('/pagos/', {
                    venta_id: venta.id,
                    monto: montoPendiente,
                    metodo_pago: 'Pago Total'
                });
                handlePaymentSuccess();
            } catch (error) {
                toast.error('Error al registrar el pago total.');
            }
        }
    };

    const getEstadoPagoChip = (estado) => {
        const chipProps = {
            pagado: { label: 'Pagada', color: 'success' },
            parcial: { label: 'Parcial', color: 'warning' },
            pendiente: { label: 'Pendiente', color: 'error' },
        };
        const props = chipProps[estado] || { label: 'Desconocido', color: 'default' };
        return <Chip label={props.label} color={props.color} size="small" />;
    };

    // 🧮 Calcular días de cartera
    const calcularDiasCartera = (ventas) => {
        if (!ventas || ventas.length === 0) return 0;
        const fechas = ventas.map(v => new Date(v.fecha));
        const fechaMasAntigua = new Date(Math.min(...fechas));
        const hoy = new Date();
        const diffMs = hoy - fechaMasAntigua;
        return Math.floor(diffMs / (1000 * 60 * 60 * 24)); // diferencia en días
    };

    // 📱 Card para móviles
    const CuentaPorCobrarCard = ({ venta }) => {
        const totalPagos = venta.pagos.reduce((acc, p) => acc + p.monto, 0);

        return (
            <Card sx={{ mb: 2 }}>
                <CardContent>
                    <Typography variant="h6" color="text.primary">
                        Venta #{venta.id} - {venta.cliente?.nombre || 'N/A'}
                    </Typography>
                    <Typography color="textSecondary">
                        {new Date(venta.fecha + 'Z').toLocaleString()}
                    </Typography>

                    <Box sx={{ my: 1 }}>
                        {venta.detalles.map(d => (
                            <Typography key={d.id} variant="body2" color="text.primary">
                                {d.producto?.nombre} (x{d.cantidad})
                            </Typography>
                        ))}
                    </Box>

                    <Typography>Total: {formatCurrency(venta.total)}</Typography>
                    <Typography>Saldo: {formatCurrency(venta.total - venta.monto_pagado)}</Typography>

                    <Box sx={{ mt: 1 }}>{getEstadoPagoChip(venta.estado_pago)}</Box>

                    <Box sx={{ mt: 2 }}>
                        <Typography variant="subtitle2" color="text.secondary">
                            Pagos (Total: {formatCurrency(totalPagos)})
                        </Typography>
                        {venta.pagos.map(p => (
                            <Box key={p.id} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <Typography variant="body2">
                                    {formatCurrency(p.monto)} ({new Date(p.fecha + 'Z').toLocaleString()})
                                </Typography>
                                <IconButton size="small" onClick={() => handleShowPaymentDialog(venta, p)}>
                                    <Edit />
                                </IconButton>
                            </Box>
                        ))}
                    </Box>
                </CardContent>
                <CardActions>
                    {venta.estado_pago !== 'pagado' && (
                        <>
                            <IconButton onClick={() => handleShowPaymentDialog(venta)} color="primary"><Payment /></IconButton>
                            <IconButton onClick={() => handleTotalPayment(venta)} color="success"><AttachMoney /></IconButton>
                        </>
                    )}
                </CardActions>
            </Card>
        );
    };

    return (
        <Box>
            <Paper sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom color="text.primary">
                    Cuentas Pendientes por Cobrar
                </Typography>

                {cuentasPorCobrar.map((cuenta) => {
                    // 🔄 Ordenar ventas: más nuevas primero
                    const ventasOrdenadas = [...cuenta.ventas_pendientes].sort(
                        (a, b) => new Date(b.fecha) - new Date(a.fecha)
                    );

                    const diasCartera = calcularDiasCartera(ventasOrdenadas);

                    return (
                        <Accordion key={cuenta.cliente_id}>
                            <AccordionSummary expandIcon={<ExpandMore />}>
                                <Box>
                                    <Typography color="text.primary">
                                        {cuenta.cliente_nombre} - Pendiente: {formatCurrency(cuenta.monto_pendiente)}
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        Días Cartera: {diasCartera} días
                                    </Typography>
                                </Box>
                            </AccordionSummary>
                            <AccordionDetails>
                                {isMobile ? (
                                    <Box>
                                        {ventasOrdenadas.map(venta => (
                                            <CuentaPorCobrarCard 
                                                key={venta.id} 
                                                venta={venta} 
                                            />
                                        ))}
                                    </Box>
                                ) : (
                                    <TableContainer>
                                        <Table size="small">
                                            <TableHead>
                                                <TableRow>
                                                    <TableCell>Fecha</TableCell>
                                                    <TableCell>Productos</TableCell>
                                                    <TableCell>Total</TableCell>
                                                    <TableCell>Saldo</TableCell>
                                                    <TableCell>Estado</TableCell>
                                                    <TableCell>Pagos</TableCell>
                                                    <TableCell>Acciones</TableCell>
                                                </TableRow>
                                            </TableHead>
                                            <TableBody>
                                                {ventasOrdenadas.map(venta => {
                                                    const totalPagos = venta.pagos.reduce((acc, p) => acc + p.monto, 0);
                                                    return (
                                                        <TableRow key={venta.id}>
                                                            <TableCell>{new Date(venta.fecha).toLocaleDateString()}</TableCell>
                                                            <TableCell>
                                                                {venta.detalles.map(d => (
                                                                    <div key={d.id}>{d.producto?.nombre} (x{d.cantidad})</div>
                                                                ))}
                                                            </TableCell>
                                                            <TableCell>{formatCurrency(venta.total)}</TableCell>
                                                            <TableCell>{formatCurrency(venta.total - venta.monto_pagado)}</TableCell>
                                                            <TableCell>{getEstadoPagoChip(venta.estado_pago)}</TableCell>
                                                            <TableCell>
                                                                <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                                                                    Total - {formatCurrency(totalPagos)}
                                                                </Typography>
                                                                {venta.pagos.map(p => (
                                                                    <Box key={p.id} sx={{ display: 'flex', alignItems: 'center' }}>
                                                                        <Typography variant="body2">
                                                                            {formatCurrency(p.monto)} ({new Date(p.fecha + 'Z').toLocaleString()})
                                                                        </Typography>
                                                                        <IconButton size="small" onClick={() => handleShowPaymentDialog(venta, p)}>
                                                                            <Edit />
                                                                        </IconButton>
                                                                    </Box>
                                                                ))}
                                                            </TableCell>
                                                            <TableCell>
                                                                {venta.estado_pago !== 'pagado' && (
                                                                    <>
                                                                        <IconButton onClick={() => handleShowPaymentDialog(venta)} color="primary"><Payment /></IconButton>
                                                                        <IconButton onClick={() => handleTotalPayment(venta)} color="success"><AttachMoney /></IconButton>
                                                                    </>
                                                                )}
                                                            </TableCell>
                                                        </TableRow>
                                                    );
                                                })}
                                            </TableBody>
                                        </Table>
                                    </TableContainer>
                                )}
                            </AccordionDetails>
                        </Accordion>
                    );
                })}
            </Paper>

            {selectedVenta && (
                <PaymentDialog
                    open={showPaymentDialog}
                    handleClose={handleClosePaymentDialog}
                    venta={selectedVenta}
                    onPaymentSuccess={handlePaymentSuccess}
                    pagoToEdit={selectedPago}
                />
            )}
        </Box>
    );
};

export default ClienteAccountsReceivable;
