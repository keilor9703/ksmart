import React, { useState, useEffect, useMemo } from 'react';
import {
    Box, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
    Paper, CircularProgress, TextField, Button, Grid, TableSortLabel, useMediaQuery, Card, CardContent
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import apiClient from '../api';
import { formatCurrency } from '../utils/formatters';
import { toast } from 'react-toastify';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { visuallyHidden, stableSort, getComparator } from '../utils/sortingUtils';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

// New component: CustomerBuyerCard
const CustomerBuyerCard = ({ customer, formatCurrency }) => (
    <Card sx={{ mb: 2 }}>
        <CardContent>
            <Typography variant="h6" color="text.primary">{customer.client_name}</Typography>
            <Typography color="textSecondary">ID Cliente: {customer.client_id}</Typography>
            <Typography color="textSecondary">Monto Total Comprado: {formatCurrency(customer.total_purchase_amount)}</Typography>
        </CardContent>
    </Card>
);

const headCells = [
    { id: 'client_id', numeric: false, disablePadding: false, label: 'ID Cliente' },
    { id: 'client_name', numeric: false, disablePadding: false, label: 'Nombre del Cliente' },
    { id: 'total_purchase_amount', numeric: true, disablePadding: false, label: 'Monto Total Comprado' },
];

const EnhancedTableHead = (props) => {
    const { order, orderBy, onRequestSort } = props;
    const createSortHandler = (property) => (event) => {
        onRequestSort(event, property);
    };

    return (
        <TableHead>
            <TableRow>
                {headCells.map((headCell) => (
                    <TableCell
                        key={headCell.id}
                        align={headCell.numeric ? 'right' : 'left'}
                        padding={headCell.disablePadding ? 'none' : 'normal'}
                        sortDirection={orderBy === headCell.id ? order : false}
                    >
                        <TableSortLabel
                            active={orderBy === headCell.id}
                            direction={orderBy === headCell.id ? order : 'asc'}
                            onClick={createSortHandler(headCell.id)}
                        >
                            {headCell.label}
                            {orderBy === headCell.id ? (
                                <Box component="span" sx={visuallyHidden}>
                                    {order === 'desc' ? 'sorted descending' : 'sorted ascending'}
                                </Box>
                            ) : null}
                        </TableSortLabel>
                    </TableCell>
                ))}
            </TableRow>
        </TableHead>
    );
};

const CustomerBuyers = () => {
    const [customerBuyers, setCustomerBuyers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [order, setOrder] = useState('desc');
    const [orderBy, setOrderBy] = useState('total_purchase_amount');
    const [showAllCustomers, setShowAllCustomers] = useState(false);

    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

    const handleRequestSort = (event, property) => {
        const isAsc = orderBy === property && order === 'asc';
        setOrder(isAsc ? 'desc' : 'asc');
        setOrderBy(property);
    };

    useEffect(() => {
        fetchCustomerBuyers();
    }, []);

    const fetchCustomerBuyers = async () => {
        setLoading(true);
        setError(null);
        try {
            const params = {};
            if (startDate) params.start_date = startDate;
            if (endDate) params.end_date = endDate;

            const response = await apiClient.get('/reportes/clientes_compradores', { params });
            setCustomerBuyers(response.data);
        } catch (err) {
            console.error('Error fetching customer buyers:', err);
            setError('No se pudo cargar el reporte de clientes compradores.');
            toast.error('Error al cargar el reporte de clientes compradores.');
        } finally {
            setLoading(false);
        }
    };

    const handleClearFilters = () => {
        setStartDate('');
        setEndDate('');
        fetchCustomerBuyers();
    };

    const sortedCustomerBuyers = useMemo(() =>
        stableSort(customerBuyers, getComparator(order, orderBy)),
        [customerBuyers, order, orderBy]
    );

    return (
        <Box>
            <Typography variant="h5" gutterBottom color="text.primary">Reporte de Clientes Compradores</Typography>

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
                        <Button variant="contained" onClick={fetchCustomerBuyers} sx={{ mr: 1 }}>Filtrar</Button>
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
            ) : customerBuyers.length === 0 ? (
                <Typography color="text.primary">No hay datos de clientes compradores para el período seleccionado.</Typography>
            ) : (
                <Box>
                    <Box sx={{ maxWidth: '800px', margin: 'auto', mb: 3 }}>
                        <Bar
                            data={{
                                labels: (showAllCustomers ? sortedCustomerBuyers : sortedCustomerBuyers.slice(0, 5)).map(customer => customer.client_name),
                                datasets: [
                                    {
                                        label: 'Monto Total Comprado',
                                        data: (showAllCustomers ? sortedCustomerBuyers : sortedCustomerBuyers.slice(0, 5)).map(customer => customer.total_purchase_amount),
                                        backgroundColor: 'rgba(54, 162, 235, 0.6)',
                                        borderColor: 'rgba(54, 162, 235, 1)',
                                        borderWidth: 1,
                                    },
                                ],
                            }}
                            options={{
                                responsive: true,
                                plugins: {
                                    legend: { position: 'top' },
                                    title: { display: true, text: 'Top Clientes por Monto de Compra' },
                                },
                                scales: {
                                    y: { beginAtZero: true },
                                },
                            }}
                        />
                    </Box>
                    {customerBuyers.length > 5 && (
                        <Button 
                            onClick={() => setShowAllCustomers(!showAllCustomers)} 
                            sx={{ mt: 2, mb: 4 }}
                        >
                            {showAllCustomers ? "Ver Top 5" : "Ver Todos"}
                        </Button>
                    )}
                    {isMobile ? (
                        <Box>
                            {(showAllCustomers ? sortedCustomerBuyers : sortedCustomerBuyers.slice(0, 5)).map(customer => (
                                <CustomerBuyerCard key={customer.client_id} customer={customer} formatCurrency={formatCurrency} />
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
                                <Table sx={{ minWidth: 650 }}>
                                    <EnhancedTableHead
                                        order={order}
                                        orderBy={orderBy}
                                        onRequestSort={handleRequestSort}
                                    />
                                    <TableBody>
                                        {(showAllCustomers ? sortedCustomerBuyers : sortedCustomerBuyers.slice(0, 5)).map((customer) => (
                                            <TableRow key={customer.client_id}>
                                                <TableCell><Typography color="text.primary">{customer.client_id}</Typography></TableCell>
                                                <TableCell><Typography color="text.primary">{customer.client_name}</Typography></TableCell>
                                                <TableCell align="right"><Typography color="text.primary">{formatCurrency(customer.total_purchase_amount)}</Typography></TableCell>
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

export default CustomerBuyers;