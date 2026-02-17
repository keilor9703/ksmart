import React, { useState, useEffect, useMemo } from 'react';
import apiClient from '../api';
import { formatCurrency } from '../utils/formatters';
import PaymentDialog from './PaymentDialog';
import { toast } from 'react-toastify';
import {
    Box, Paper, Typography, Accordion, AccordionSummary, AccordionDetails, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip, IconButton
} from '@mui/material';
import { ExpandMore, Edit, Payment, AttachMoney } from '@mui/icons-material';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const CuentasPorCobrar = () => {
    const [cuentasPorCobrar, setCuentasPorCobrar] = useState([]);
    const [showPaymentDialog, setShowPaymentDialog] = useState(false);
    const [selectedVenta, setSelectedVenta] = useState(null);
    const [selectedPago, setSelectedPago] = useState(null);

    useEffect(() => {
        fetchCuentasPorCobrar();
    }, []);

    const fetchCuentasPorCobrar = () => {
        apiClient.get('/reportes/cuentas_por_cobrar').then(res => setCuentasPorCobrar(res.data)).catch(console.error);
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
        fetchCuentasPorCobrar(); // Re-fetch accounts receivable after payment
        toast.success('Operación de pago completada exitosamente!');
    };
    
    const handleTotalPayment = async (venta) => {
        const montoPendiente = venta.total - venta.monto_pagado;
        if (montoPendiente <= 0) {
            toast.info('Esta venta ya está completamente pagada.');
            return;
        }

        if (window.confirm(`¿Estás seguro de que quieres registrar un pago total de ${formatCurrency(montoPendiente)} para la venta #${venta.id}?`)) {
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

    const totalCuentasPorCobrar = useMemo(() => {
        return cuentasPorCobrar.reduce((sum, cuenta) => sum + cuenta.monto_pendiente, 0);
    }, [cuentasPorCobrar]);

    const topDeudoresData = useMemo(() => {
        const sortedDebtors = [...cuentasPorCobrar].sort((a, b) => b.monto_pendiente - a.monto_pendiente);
        const top5 = sortedDebtors.slice(0, 5);
        return {
            labels: top5.map(d => d.cliente_nombre),
            datasets: [
                {
                    label: 'Monto Pendiente',
                    data: top5.map(d => d.monto_pendiente),
                    backgroundColor: 'rgba(255, 159, 64, 0.6)',
                    borderColor: 'rgba(255, 159, 64, 1)',
                    borderWidth: 1,
                },
            ],
        };
    }, [cuentasPorCobrar]);

    return (
        <Box>
            <Paper sx={{ p: 2, mb: 3 }}>
                <Typography variant="h5" gutterBottom color="text.primary">Resumen de Cuentas por Cobrar</Typography>
                <Typography variant="h6" color="text.primary" sx={{ mb: 2 }}>
                    Total General Pendiente: {formatCurrency(totalCuentasPorCobrar)}
                </Typography>
                {cuentasPorCobrar.length > 0 && (
                    <Box sx={{ maxWidth: '800px', margin: 'auto', mb: 3 }}>
                        <Bar
                            data={topDeudoresData}
                            options={{
                                responsive: true,
                                plugins: {
                                    legend: { position: 'top' },
                                    title: { display: true, text: 'Top 5 Clientes con Mayor Deuda' },
                                },
                                scales: {
                                    y: { beginAtZero: true },
                                },
                            }}
                        />
                    </Box>
                )}
            </Paper>

            <Paper sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>Detalle por Cliente</Typography>
                {cuentasPorCobrar.length === 0 ? (
                    <Typography color="text.primary">No hay cuentas pendientes por cobrar.</Typography>
                ) : (
                    cuentasPorCobrar.map((cuenta) => (
                        <Accordion key={cuenta.cliente_id}>
                            <AccordionSummary expandIcon={<ExpandMore />}>
                                <Typography>{cuenta.cliente_nombre} - Pendiente: {formatCurrency(cuenta.monto_pendiente)}</Typography>
                            </AccordionSummary>
                            <AccordionDetails>
                                <Box sx={{ overflowX: 'auto' }}>
                                    <TableContainer>
                                        <Table size="small" sx={{ minWidth: 650 }}>
                                            <TableHead>
                                                <TableRow>
                                                    <TableCell>Fecha</TableCell>
                                                    <TableCell>Productos</TableCell>
                                                    <TableCell>Total Venta</TableCell>
                                                    <TableCell>Pagado Venta</TableCell>
                                                    <TableCell>Estado</TableCell>
                                                    <TableCell>Pagos Registrados</TableCell>
                                                    <TableCell>Acciones</TableCell>
                                                </TableRow>
                                            </TableHead>
                                            <TableBody>
                                                {cuenta.ventas_pendientes.map(venta => (
                                                    <TableRow key={venta.id}>
                                                        <TableCell>{new Date(venta.fecha).toLocaleDateString()}</TableCell>
                                                        <TableCell>
                                                            {venta.detalles.map(d => <div key={d.id}>{d.producto?.nombre} (x{d.cantidad})</div>)}
                                                        </TableCell>
                                                        <TableCell>{formatCurrency(venta.total)}</TableCell>
                                                        <TableCell>{formatCurrency(venta.monto_pagado)}</TableCell>
                                                        <TableCell>{getEstadoPagoChip(venta.estado_pago)}</TableCell>
                                                        <TableCell>
                                                            {venta.pagos.map(p => (
                                                                <Box key={p.id} sx={{ display: 'flex', alignItems: 'center' }}>
                                                                    <Typography variant="body2" color="text.primary">{formatCurrency(p.monto)} ({new Date(p.fecha).toLocaleDateString()})</Typography>
                                                                    <IconButton size="small" onClick={() => handleShowPaymentDialog(venta, p)}><Edit /></IconButton>
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
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </TableContainer>
                                </Box>
                            </AccordionDetails>
                        </Accordion>
                    ))
                )}
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

export default CuentasPorCobrar;
