import React, { useState, useEffect, useMemo } from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { Bar } from 'react-chartjs-2';
import apiClient from '../api';
import { formatCurrency } from '../utils/formatters';
import { toast } from 'react-toastify';
import {
    Box, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
    Paper, CircularProgress, TextField, Button, Grid, useMediaQuery, Card, CardContent
} from '@mui/material';
import { useTheme } from '@mui/material/styles';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

// New component: RentabilidadCard
const RentabilidadCard = ({ item, formatCurrency }) => (
    <Card sx={{ mb: 2 }}>
        <CardContent>
            <Typography variant="h6" color="text.primary">{item.product_name}</Typography>
            <Typography color="textSecondary">Cantidad Vendida: {item.total_quantity_sold}</Typography>
            <Typography color="textSecondary">Ingresos Totales: {formatCurrency(item.total_revenue)}</Typography>
            <Typography color="textSecondary">Costo Total: {formatCurrency(item.total_cost)}</Typography>
            <Typography color="text.primary" sx={{ fontWeight: 'bold', color: item.net_profit > 0 ? 'success.main' : 'error.main' }}>
                Ganancia Neta: {formatCurrency(item.net_profit)}
            </Typography>
            <Typography color="text.primary">Margen: {item.profit_margin.toFixed(2)}%</Typography>
        </CardContent>
    </Card>
);

const RentabilidadReporte = () => {
    const [reportData, setReportData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [showAllReport, setShowAllReport] = useState(false);

    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

    useEffect(() => {
        fetchReportData();
    }, []);

    const fetchReportData = async () => {
        setLoading(true);
        setError(null);
        try {
            const params = {};
            if (startDate) params.start_date = startDate;
            if (endDate) params.end_date = endDate;

            const response = await apiClient.get('/reportes/rentabilidad_productos', { params });
            setReportData(response.data);
        } catch (err) {
            console.error('Error fetching profitability report:', err);
            setError('No se pudo cargar el reporte de rentabilidad.');
            toast.error('Error al cargar el reporte.');
        } finally {
            setLoading(false);
        }
    };

    const handleClearFilters = () => {
        setStartDate('');
        setEndDate('');
        fetchReportData();
    };

    const sortedAndFilteredData = useMemo(() => {
        const sorted = [...reportData].sort((a, b) => b.net_profit - a.net_profit);
        return showAllReport ? sorted : sorted.slice(0, 5);
    }, [reportData, showAllReport]);

    return (
        <Box>
            <Typography variant="h5" gutterBottom color="text.primary">Reporte de Rentabilidad por Producto</Typography>

            <Paper sx={{ p: 2, mb: 3 }}>
                <Grid container spacing={2} alignItems="center">
                    <Grid item xs={12} sm={4}>
                        <TextField
                            label="Fecha Inicio"
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            fullWidth
                            InputLabelProps={{ shrink: true }}
                        />
                    </Grid>
                    <Grid item xs={12} sm={4}>
                        <TextField
                            label="Fecha Fin"
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            fullWidth
                            InputLabelProps={{ shrink: true }}
                        />
                    </Grid>
                    <Grid item xs={12} sm={4}>
                        <Button variant="contained" onClick={fetchReportData} sx={{ mr: 1 }}>Filtrar</Button>
                        <Button variant="outlined" onClick={handleClearFilters}>Limpiar</Button>
                    </Grid>
                </Grid>
            </Paper>

            {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200 }}>
                    <CircularProgress />
                </Box>
            ) : error ? (
                <Typography color="error">{error}</Typography>
            ) : sortedAndFilteredData.length === 0 ? (
                <Typography color="text.primary">No hay datos de rentabilidad para el período seleccionado.</Typography>
            ) : (
                <Box>
                    <Box sx={{ maxWidth: '800px', margin: 'auto', mb: 3 }}>
                        <Bar
                            data={{
                                labels: sortedAndFilteredData.map(item => item.product_name),
                                datasets: [
                                    {
                                        label: 'Ganancia Neta',
                                        data: sortedAndFilteredData.map(item => item.net_profit),
                                        backgroundColor: sortedAndFilteredData.map(item => item.net_profit > 0 ? 'rgba(75, 192, 192, 0.6)' : 'rgba(255, 99, 132, 0.6)'),
                                        borderColor: sortedAndFilteredData.map(item => item.net_profit > 0 ? 'rgba(75, 192, 192, 1)' : 'rgba(255, 99, 132, 1)'),
                                        borderWidth: 1,
                                    },
                                ],
                            }}
                            options={{
                                responsive: true,
                                plugins: {
                                    legend: { position: 'top' },
                                    title: { display: true, text: 'Ganancia Neta por Producto' },
                                },
                                scales: {
                                    y: { beginAtZero: true },
                                },
                            }}
                        />
                    </Box>
                    {reportData.length > 5 && (
                        <Button 
                            onClick={() => setShowAllReport(!showAllReport)} 
                            sx={{ mt: 2, mb: 4 }}
                        >
                            {showAllReport ? "Ver Top 5" : "Ver Todos"}
                        </Button>
                    )}
                    {isMobile ? (
                        <Box>
                            {sortedAndFilteredData.map(item => (
                                <RentabilidadCard key={item.product_id} item={item} formatCurrency={formatCurrency} />
                            ))}
                        </Box>
                    ) : (
                        <Box sx={{
                            overflowX: 'auto',
                            backgroundColor: theme.palette.background.paper, // Asegurar el color de fondo del Box con overflow
                            '&::-webkit-scrollbar': {
                                height: '8px',
                            },
                            '&::-webkit-scrollbar-thumb': {
                                backgroundColor: theme.palette.grey[700], // Color del scrollbar en modo oscuro
                                borderRadius: '4px',
                            },
                            '&::-webkit-scrollbar-track': {
                                backgroundColor: theme.palette.background.default, // Color del track del scrollbar
                            },
                        }}>
                            <TableContainer component={Paper}>
                                <Table sx={{ minWidth: 800 }}>
                                    <TableHead>
                                        <TableRow>
                                            <TableCell>Producto</TableCell>
                                            <TableCell align="right">Cantidad Vendida</TableCell>
                                            <TableCell align="right">Ingresos Totales</TableCell>
                                            <TableCell align="right">Costo Total</TableCell>
                                            <TableCell align="right">Ganancia Neta</TableCell>
                                            <TableCell align="right">Margen</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {sortedAndFilteredData.map((item) => (
                                            <TableRow key={item.product_id}>
                                                <TableCell><Typography color="text.primary">{item.product_name}</Typography></TableCell>
                                                <TableCell align="right"><Typography color="text.primary">{item.total_quantity_sold}</Typography></TableCell>
                                                <TableCell align="right"><Typography color="text.primary">{formatCurrency(item.total_revenue)}</Typography></TableCell>
                                                <TableCell align="right"><Typography color="text.primary">{formatCurrency(item.total_cost)}</Typography></TableCell>
                                                <TableCell align="right"><Typography color="text.primary" sx={{ fontWeight: 'bold', color: item.net_profit > 0 ? 'success.main' : 'error.main' }}>{formatCurrency(item.net_profit)}</Typography></TableCell>
                                                <TableCell align="right"><Typography color="text.primary">{item.profit_margin.toFixed(2)}%</Typography></TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        </Box>
                    )}
                </Box>
            )}
        </Box>
    );
};

export default RentabilidadReporte;