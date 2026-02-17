import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Box, Grid, Card, CardContent, Typography, CircularProgress, Paper, List, ListItem, ListItemText, ListItemAvatar, Avatar, Divider } from '@mui/material';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js';
import apiClient from '../api';
import { formatCurrency } from '../utils/formatters';
import { MonetizationOn, AccountBalanceWallet, Warning, Assignment } from '@mui/icons-material';

// Register Chart.js components
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

const KpiCard = ({ title, value, icon }) => (
    <Card sx={{
        display: 'flex',
        alignItems: 'center',
        p: 2,
        transition: 'transform 0.2s, box-shadow 0.2s',
        '&:hover': {
            transform: 'scale(1.03)',
            boxShadow: 3,
            cursor: 'pointer'
        }
    }}>
        <Avatar sx={{ bgcolor: 'primary.main', width: 56, height: 56, mr: 2 }}>
            {icon}
        </Avatar>
        <Box>
            <Typography color="textSecondary" gutterBottom>{title}</Typography>
            <Typography variant="h5" component="div">{value}</Typography>
        </Box>
    </Card>
);

const Dashboard = () => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                const response = await apiClient.get('/reportes/dashboard');
                setData(response.data);
                setError(null);
            } catch (err) {
                setError('Error al cargar los datos del dashboard.');
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    if (loading) {
        return <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}><CircularProgress /></Box>;
    }

    if (error) {
        return <Typography color="error" align="center">{error}</Typography>;
    }

    const chartData = {
        labels: data.ventas_ultimos_30_dias.map(d => new Date(d.day + 'T00:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })),
        datasets: [
            {
                label: 'Ventas',
                data: data.ventas_ultimos_30_dias.map(d => d.total),
                fill: true,
                backgroundColor: 'rgba(75, 192, 192, 0.2)',
                borderColor: 'rgb(75, 192, 192)',
                tension: 0.3,
            },
        ],
    };
    
    const chartOptions = {
        responsive: true,
        plugins: {
            legend: {
                position: 'top',
            },
            title: {
                display: true,
                text: 'Ventas de los últimos 30 días',
            },
        },
    };

    return (
        <Box sx={{ flexGrow: 1 }}>
            <Grid container spacing={3}>
                {/* KPI Cards */}
                <Grid item xs={12} sm={6} md={3}>
                    <Link to="/ventas" style={{ textDecoration: 'none' }}>
                        <KpiCard title="Ventas Hoy" value={formatCurrency(data.ventas_hoy)} icon={<MonetizationOn />} />
                    </Link>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <Link to="/clientes" style={{ textDecoration: 'none' }}>
                        <KpiCard title="Cuentas por Cobrar" value={formatCurrency(data.cuentas_por_cobrar)} icon={<AccountBalanceWallet />} />
                    </Link>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <Link to="/inventario" style={{ textDecoration: 'none' }}>
                        <KpiCard title="Productos Bajo Stock" value={data.productos_bajo_stock} icon={<Warning />} />
                    </Link>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <Link to="/ordenes-trabajo" style={{ textDecoration: 'none' }}>
                        <KpiCard title="Órdenes Recientes" value={data.ordenes_recientes.length} icon={<Assignment />} />
                    </Link>
                </Grid>

                {/* Sales Chart */}
                <Grid item xs={12} lg={8}>
                    <Paper sx={{ p: 2 }}>
                        <Line options={chartOptions} data={chartData} />
                    </Paper>
                </Grid>

                {/* Recent Work Orders */}
                <Grid item xs={12} lg={4}>
                    <Paper sx={{ p: 2, height: '100%' }}>
                        <Typography variant="h6" gutterBottom>Órdenes de Trabajo Recientes</Typography>
                        <List>
                            {data.ordenes_recientes.map((orden, index) => (
                                <React.Fragment key={orden.id}>
                                    <ListItem alignItems="flex-start">
                                        <ListItemText
                                            primary={`OT #${orden.id} - ${orden.cliente.nombre}`}
                                            secondary={
                                                <>
                                                    <Typography component="span" variant="body2" color="text.primary">
                                                        {formatCurrency(orden.total)}
                                                    </Typography>
                                                    {` — ${orden.estado}`}
                                                </>
                                            }
                                        />
                                    </ListItem>
                                    {index < data.ordenes_recientes.length - 1 && <Divider variant="inset" component="li" />}
                                </React.Fragment>
                            ))}
                        </List>
                    </Paper>
                </Grid>
            </Grid>
        </Box>
    );
};

export default Dashboard;
