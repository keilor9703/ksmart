import { useState, useEffect, useMemo } from 'react';
import {
    Box, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
    Paper, CircularProgress, TextField, Button, Grid, TableSortLabel, useMediaQuery, Card, CardContent
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { visuallyHidden, stableSort, getComparator } from '../utils/sortingUtils';
import apiClient from '../api';
import { toast } from 'react-toastify';
import { formatCurrency } from '../utils/formatters';

import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

// New component: ProductSalesCard
const ProductSalesCard = ({ item, formatCurrency }) => (
    <Card sx={{ mb: 2 }}>
        <CardContent>
            <Typography variant="h6" color="text.primary">{item.product_name}</Typography>
            <Typography color="textSecondary">ID: {item.product_id}</Typography>
            <Typography color="textSecondary">Cantidad Vendida: {item.total_quantity_sold}</Typography>
            <Typography color="textSecondary">Total Vendido: {formatCurrency(item.total_revenue)}</Typography>
        </CardContent>
    </Card>
);

const headCells = [
    { id: 'product_id', numeric: false, disablePadding: false, label: 'ID' },
    { id: 'product_name', numeric: false, disablePadding: false, label: 'Nombre' },
    { id: 'total_quantity_sold', numeric: true, disablePadding: false, label: 'Cantidad Vendida' },
    { id: 'total_revenue', numeric: true, disablePadding: false, label: 'Total Vendido' },
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

const SalesTable = ({ title, data, order, orderBy, onRequestSort, isMobile, theme }) => (
    <Box sx={{ mb: 4 }}>
        <Typography variant="h6" gutterBottom color="text.primary">{title}</Typography>
        {data.length === 0 ? (
            <Typography color="text.secondary">No hay datos para esta categoría.</Typography>
        ) : (
            <Box>
                <Box sx={{ maxWidth: '800px', margin: 'auto', mb: 3 }}>
                    <Bar
                        data={{
                            labels: data.map(item => item.product_name),
                            datasets: [
                                {
                                    label: 'Cantidad Vendida',
                                    data: data.map(item => item.total_quantity_sold),
                                    backgroundColor: 'rgba(75, 192, 192, 0.6)',
                                    yAxisID: 'y',
                                },
                                {
                                    label: 'Ingresos Totales (COP)',
                                    data: data.map(item => item.total_revenue),
                                    backgroundColor: 'rgba(255, 99, 132, 0.6)',
                                    yAxisID: 'y1',
                                },
                            ],
                        }}
                        options={{
                            responsive: true,
                            plugins: {
                                legend: { position: 'top' },
                                title: { display: true, text: title },
                            },
                            scales: {
                                y: { type: 'linear', display: true, position: 'left', beginAtZero: true, title: { display: true, text: 'Cantidad' } },
                                y1: { type: 'linear', display: true, position: 'right', beginAtZero: true, title: { display: true, text: 'Ingresos (COP)' }, grid: { drawOnChartArea: false } },
                            },
                        }}
                    />
                </Box>
                {isMobile ? ( // Conditional rendering
                    <Box>
                        {data.map(item => (
                            <ProductSalesCard key={item.product_id} item={item} formatCurrency={formatCurrency} />
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
                                    onRequestSort={onRequestSort}
                                />
                                <TableBody>
                                    {data.map((item) => (
                                        <TableRow key={item.product_id}>
                                            <TableCell><Typography color="text.primary">{item.product_id}</Typography></TableCell>
                                            <TableCell><Typography color="text.primary">{item.product_name}</Typography></TableCell>
                                            <TableCell align="right"><Typography color="text.primary">{item.total_quantity_sold}</Typography></TableCell>
                                            <TableCell align="right"><Typography color="text.primary">{formatCurrency(item.total_revenue)}</Typography></TableCell>
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

const ProductSales = () => {
    const [salesData, setSalesData] = useState({ productos: [], servicios: [] });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [order, setOrder] = useState('desc');
    const [orderBy, setOrderBy] = useState('total_revenue');
    const [showAllProductos, setShowAllProductos] = useState(false);
    const [showAllServicios, setShowAllServicios] = useState(false);

    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

    const handleRequestSort = (event, property) => {
        const isAsc = orderBy === property && order === 'asc';
        setOrder(isAsc ? 'desc' : 'asc');
        setOrderBy(property);
    };

    useEffect(() => {
        fetchProductSales();
    }, []);

    const fetchProductSales = async () => {
        setLoading(true);
        setError(null);
        try {
            const params = {};
            if (startDate) params.start_date = startDate;
            if (endDate) params.end_date = endDate;

            const response = await apiClient.get('/reportes/productos_vendidos', { params });
            setSalesData(response.data);
        } catch (err) {
            console.error('Error fetching product sales:', err);
            setError('No se pudo cargar el reporte de ventas por producto.');
            toast.error('Error al cargar el reporte de ventas por producto.');
        } finally {
            setLoading(false);
        }
    };

    const handleClearFilters = () => {
        setStartDate('');
        setEndDate('');
        fetchProductSales();
    };

    const sortedProductos = useMemo(() => 
        stableSort(salesData.productos, getComparator(order, orderBy)),
        [salesData.productos, order, orderBy]
    );

    const sortedServicios = useMemo(() => 
        stableSort(salesData.servicios, getComparator(order, orderBy)),
        [salesData.servicios, order, orderBy]
    );

    return (
        <Box>
            <Typography variant="h5" gutterBottom color="text.primary">Reporte de Ventas por Producto y Servicio</Typography>

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
                        <Button variant="contained" onClick={fetchProductSales} sx={{ mr: 1 }}>Filtrar</Button>
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
            ) : (
                <Box>
                    <SalesTable 
                        title="Productos Vendidos" 
                        data={showAllProductos ? sortedProductos : sortedProductos.slice(0, 5)} 
                        order={order}
                        orderBy={orderBy}
                        onRequestSort={handleRequestSort}
                        isMobile={isMobile}
                        theme={theme}
                    />
                    {sortedProductos.length > 5 && (
                        <Button 
                            onClick={() => setShowAllProductos(!showAllProductos)} 
                            sx={{ mt: 2, mb: 4 }}
                        >
                            {showAllProductos ? "Ver Top 5" : "Ver Todos"}
                        </Button>
                    )}

                    <SalesTable 
                        title="Servicios Prestados" 
                        data={showAllServicios ? sortedServicios : sortedServicios.slice(0, 5)} 
                        order={order}
                        orderBy={orderBy}
                        onRequestSort={handleRequestSort}
                        isMobile={isMobile}
                        theme={theme}
                    />
                    {sortedServicios.length > 5 && (
                        <Button 
                            onClick={() => setShowAllServicios(!showAllServicios)} 
                            sx={{ mt: 2, mb: 4 }}
                        >
                            {showAllServicios ? "Ver Top 5" : "Ver Todos"}
                        </Button>
                    )}
                </Box>
            )}
        </Box>
    );
};

export default ProductSales;