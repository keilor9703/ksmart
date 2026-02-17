import React, { useState, useEffect, useMemo } from 'react';
import {
    Box, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
    Paper, CircularProgress, TableSortLabel, useMediaQuery, Card, CardContent
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import apiClient from '../api';
import { formatCurrency } from '../utils/formatters';
import { toast } from 'react-toastify';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { visuallyHidden, stableSort, getComparator } from '../utils/sortingUtils';
import { Button } from '@mui/material';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

// New component: CustomerDebtorCard
const CustomerDebtorCard = ({ customer, formatCurrency }) => (
    <Card sx={{ mb: 2 }}>
        <CardContent>
            <Typography variant="h6" color="text.primary">{customer.client_name}</Typography>
            <Typography color="textSecondary">ID Cliente: {customer.client_id}</Typography>
            <Typography color="textSecondary">Monto Total Adeudado: {formatCurrency(customer.total_debt_amount)}</Typography>
        </CardContent>
    </Card>
);

const headCells = [
    { id: 'client_id', numeric: false, disablePadding: false, label: 'ID Cliente' },
    { id: 'client_name', numeric: false, disablePadding: false, label: 'Nombre del Cliente' },
    { id: 'total_debt_amount', numeric: true, disablePadding: false, label: 'Monto Total Adeudado' },
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

const CustomerDebtors = () => {
    const [customerDebtors, setCustomerDebtors] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [order, setOrder] = useState('desc');
    const [orderBy, setOrderBy] = useState('total_debt_amount');
    const [showAllDebtors, setShowAllDebtors] = useState(false);

    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

    const handleRequestSort = (event, property) => {
        const isAsc = orderBy === property && order === 'asc';
        setOrder(isAsc ? 'desc' : 'asc');
        setOrderBy(property);
    };

    useEffect(() => {
        fetchCustomerDebtors();
    }, []);

    const fetchCustomerDebtors = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await apiClient.get('/reportes/clientes_deudores');
            setCustomerDebtors(response.data);
        } catch (err) {
            console.error('Error fetching customer debtors:', err);
            setError('No se pudo cargar el reporte de clientes deudores.');
            toast.error('Error al cargar el reporte de clientes deudores.');
        } finally {
            setLoading(false);
        }
    };

    const sortedCustomerDebtors = useMemo(() =>
        stableSort(customerDebtors, getComparator(order, orderBy)),
        [customerDebtors, order, orderBy]
    );

    return (
        <Box>
            <Typography variant="h5" gutterBottom color="text.primary">Reporte de Clientes Deudores</Typography>

            {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200 }}>
                    <CircularProgress />
                </Box>
            ) : error ? (
                <Typography color="error">{error}</Typography>
            ) : customerDebtors.length === 0 ? (
                <Typography color="text.primary">No hay clientes con deudas pendientes.</Typography>
            ) : (
                <Box>
                    <Box sx={{ maxWidth: '800px', margin: 'auto', mb: 3 }}>
                        <Bar
                            data={{
                                labels: (showAllDebtors ? sortedCustomerDebtors : sortedCustomerDebtors.slice(0, 5)).map(customer => customer.client_name),
                                datasets: [
                                    {
                                        label: 'Monto Total Adeudado',
                                        data: (showAllDebtors ? sortedCustomerDebtors : sortedCustomerDebtors.slice(0, 5)).map(customer => customer.total_debt_amount),
                                        backgroundColor: 'rgba(255, 99, 132, 0.6)',
                                        borderColor: 'rgba(255, 99, 132, 1)',
                                        borderWidth: 1,
                                    },
                                ],
                            }}
                            options={{
                                responsive: true,
                                plugins: {
                                    legend: { position: 'top' },
                                    title: { display: true, text: 'Top Clientes por Monto Adeudado' },
                                },
                                scales: {
                                    y: { beginAtZero: true },
                                },
                            }}
                        />
                    </Box>
                    {customerDebtors.length > 5 && (
                        <Button 
                            onClick={() => setShowAllDebtors(!showAllDebtors)} 
                            sx={{ mt: 2, mb: 4 }}
                        >
                            {showAllDebtors ? "Ver Top 5" : "Ver Todos"}
                        </Button>
                    )}
                    {isMobile ? (
                        <Box>
                            {(showAllDebtors ? sortedCustomerDebtors : sortedCustomerDebtors.slice(0, 5)).map(customer => (
                                <CustomerDebtorCard key={customer.client_id} customer={customer} formatCurrency={formatCurrency} />
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
                                        {(showAllDebtors ? sortedCustomerDebtors : sortedCustomerDebtors.slice(0, 5)).map((customer) => (
                                            <TableRow key={customer.client_id}>
                                                <TableCell><Typography color="text.primary">{customer.client_id}</Typography></TableCell>
                                                <TableCell><Typography color="text.primary">{customer.client_name}</Typography></TableCell>
                                                <TableCell align="right"><Typography color="text.primary">{formatCurrency(customer.total_debt_amount)}</Typography></TableCell>
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

export default CustomerDebtors;