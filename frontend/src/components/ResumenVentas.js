import React, { useState, useEffect } from 'react';
import apiClient from '../api';
import { formatCurrency } from '../utils/formatters';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import {
    Box, Paper, Typography, Grid, TextField, Button, Card, CircularProgress,
    useMediaQuery, Stack
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
    AttachMoney, Today, AccountBalanceWallet, CheckCircleOutline
} from '@mui/icons-material';

ChartJS.register(ArcElement, Tooltip, Legend);

const StatCard = ({ title, value, icon, color, isMobile }) => (
    <Card 
        sx={{ 
            display: 'flex',
            flexDirection: isMobile ? 'column' : 'row',
            alignItems: isMobile ? 'flex-start' : 'center',
            p: 2,
            width: '100%',
            borderRadius: 2,
            boxShadow: isMobile ? 1 : 3,
            flexGrow: 1 // hace que todas crezcan igual
        }}
    >
        <Box sx={{ mb: isMobile ? 1 : 0, mr: isMobile ? 0 : 2, color: color }}>
            {icon}
        </Box>
        <Box>
            <Typography color="text.secondary" gutterBottom>{title}</Typography>
            <Typography variant={isMobile ? "body1" : "h5"} component="div">
                {value}
            </Typography>
        </Box>
    </Card>
);

const ResumenVentas = () => {
    const [ventasSummary, setVentasSummary] = useState(null);
    const [loading, setLoading] = useState(true);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

    useEffect(() => {
        fetchVentasSummary();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const fetchVentasSummary = async () => {
        setLoading(true);
        const params = {};
        if (startDate) params.start_date = startDate;
        if (endDate) params.end_date = endDate;
        try {
            const res = await apiClient.get('/reportes/ventas_summary', { params });
            setVentasSummary(res.data);
        } catch (error) {
            console.error('Error fetching sales summary:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleClearFilters = () => {
        setStartDate('');
        setEndDate('');
        fetchVentasSummary();
    };

    const chartData = ventasSummary ? {
        labels: ['Total Pagado', 'Total Pendiente'],
        datasets: [
            {
                data: [ventasSummary.total_pagado, ventasSummary.total_pendiente],
                backgroundColor: [
                    'rgba(75, 192, 192, 0.6)',
                    'rgba(255, 99, 132, 0.6)',
                ],
                borderColor: [
                    'rgba(75, 192, 192, 1)',
                    'rgba(255, 99, 132, 1)',
                ],
                borderWidth: 1,
            },
        ],
    } : {};

    const chartOptions = {
        responsive: true,
        plugins: {
            legend: { position: 'top' },
            tooltip: {
                callbacks: {
                    label: function(context) {
                        let label = context.label || '';
                        if (label) label += ': ';
                        if (context.parsed !== null) {
                            label += formatCurrency(context.parsed);
                        }
                        const total = context.dataset.data.reduce((sum, val) => sum + val, 0);
                        const percentage = total > 0 ? ((context.parsed / total) * 100).toFixed(2) : 0;
                        return label + ` (${percentage}%)`;
                    }
                }
            }
        }
    };

    return (
        <Box>
            {/* 🔹 Filtros */}
            <Paper sx={{ p: 2, mb: 3 }}>
                <Typography variant="h6" gutterBottom>Filtrar por Fecha</Typography>

                {isMobile ? (
                    <Stack spacing={2}>
                        <TextField
                            label="Fecha Inicio"
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            fullWidth
                            InputLabelProps={{ shrink: true }}
                        />
                        <TextField
                            label="Fecha Fin"
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            fullWidth
                            InputLabelProps={{ shrink: true }}
                        />
                        <Button variant="contained" onClick={fetchVentasSummary} fullWidth>
                            Filtrar
                        </Button>
                        <Button variant="outlined" onClick={handleClearFilters} fullWidth>
                            Limpiar
                        </Button>
                    </Stack>
                ) : (
                    <Grid container spacing={2} alignItems="center">
                        <Grid item xs={12} sm={5}>
                            <TextField
                                label="Fecha Inicio"
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                fullWidth
                                InputLabelProps={{ shrink: true }}
                            />
                        </Grid>
                        <Grid item xs={12} sm={5}>
                            <TextField
                                label="Fecha Fin"
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                fullWidth
                                InputLabelProps={{ shrink: true }}
                            />
                        </Grid>
                        <Grid item xs={12} sm={2}>
                            <Button variant="contained" onClick={fetchVentasSummary} fullWidth>
                                Filtrar
                            </Button>
                            <Button variant="outlined" onClick={handleClearFilters} fullWidth sx={{ mt: 1 }}>
                                Limpiar
                            </Button>
                        </Grid>
                    </Grid>
                )}
            </Paper>

            {/* 🔹 Contenido */}
            {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
                    <CircularProgress />
                </Box>
            ) : ventasSummary ? (
                isMobile ? (
                    <Stack spacing={2}>
                        <StatCard 
                            title="Total General" 
                            value={formatCurrency(ventasSummary.total_general)} 
                            icon={<AttachMoney fontSize="large" />} 
                            color="#fbc02d" 
                            isMobile={isMobile}
                        />
                        <StatCard 
                            title="Ventas de Hoy" 
                            value={formatCurrency(ventasSummary.total_ventas_hoy)} 
                            icon={<Today fontSize="large" />} 
                            color="#66bb6a" 
                            isMobile={isMobile}
                        />
                        <StatCard 
                            title="Total Pagado" 
                            value={formatCurrency(ventasSummary.total_pagado)} 
                            icon={<CheckCircleOutline fontSize="large" />} 
                            color="#42a5f5" 
                            isMobile={isMobile}
                        />
                        <StatCard 
                            title="Total Pendiente" 
                            value={formatCurrency(ventasSummary.total_pendiente)} 
                            icon={<AccountBalanceWallet fontSize="large" />} 
                            color="#ef5350" 
                            isMobile={isMobile}
                        />

                        <Paper sx={{ p: 2 }}>
                            <Typography variant="h6" gutterBottom>Distribución de Pagos</Typography>
                            <Box sx={{ height: 250, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                                <Doughnut data={chartData} options={chartOptions} />
                            </Box>
                        </Paper>
                    </Stack>
                ) : (
                    <Grid container spacing={3}>
                        <Grid item xs={12} md={8}>
                           <Paper sx={{ p: 2, height: '100%' }}>
                            <Typography variant="h6" gutterBottom>Métricas Clave</Typography>
                            <Grid container spacing={2} alignItems="stretch">
                                <Grid item xs={12} sm={6} md={3} sx={{ display: 'flex' }}>
                                    <StatCard title="Total General" value={formatCurrency(ventasSummary.total_general)} icon={<AttachMoney fontSize="large" />} color="#fbc02d" isMobile={isMobile}/>
                                </Grid>
                                <Grid item xs={12} sm={6} md={3} sx={{ display: 'flex' }}>
                                    <StatCard title="Ventas de Hoy" value={formatCurrency(ventasSummary.total_ventas_hoy)} icon={<Today fontSize="large" />} color="#66bb6a" isMobile={isMobile}/>
                                </Grid>
                                <Grid item xs={12} sm={6} md={3} sx={{ display: 'flex' }}>
                                    <StatCard title="Total Pagado" value={formatCurrency(ventasSummary.total_pagado)} icon={<CheckCircleOutline fontSize="large" />} color="#42a5f5" isMobile={isMobile}/>
                                </Grid>
                                <Grid item xs={12} sm={6} md={3} sx={{ display: 'flex' }}>
                                    <StatCard title="Total Pendiente" value={formatCurrency(ventasSummary.total_pendiente)} icon={<AccountBalanceWallet fontSize="large" />} color="#ef5350" isMobile={isMobile}/>
                                </Grid>
                            </Grid>
                            </Paper>
                        </Grid>
                        <Grid item xs={12} md={4}>
                            <Paper sx={{ p: 2, height: '100%' }}>
                                <Typography variant="h6" gutterBottom>Distribución de Pagos</Typography>
                                <Box sx={{ height: 300, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                                    <Doughnut data={chartData} options={chartOptions} />
                                </Box>
                            </Paper>
                        </Grid>
                    </Grid>
                )
            ) : (
                <Typography color="text.primary">No se pudo cargar el resumen.</Typography>
            )}
        </Box>
    );
};

export default ResumenVentas;
