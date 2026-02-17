import React, { useState, useMemo } from 'react';
import apiClient from '../api';
import { formatCurrency } from '../utils/formatters';
import { toast } from 'react-toastify';
import {
    Box, Paper, Typography, Grid, TextField, Button, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, IconButton, Collapse, Card, CardContent, useMediaQuery
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { KeyboardArrowDown, KeyboardArrowUp, AttachMoney, TrendingUp, People } from '@mui/icons-material';
import { Bar } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend,
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

// ================== MOBILE CARD ==================
const ProductividadCard = ({ row, formatCurrency, isMobile }) => {
    const [open, setOpen] = useState(false);

    return (
        <Card sx={{ mb: 2 }}>
            <CardContent>
                <Typography variant="h6" color="text.primary">{row.operador_username}</Typography>
                <Typography color="textSecondary">Valor Total: {formatCurrency(row.total_ganado)}</Typography>
                {isMobile && (
                    <IconButton size="small" onClick={() => setOpen(!open)}>
                        {open ? <KeyboardArrowUp /> : <KeyboardArrowDown />}
                    </IconButton>
                )}
                <Collapse in={open} timeout="auto" unmountOnExit>
                    <Box sx={{ margin: 1 }}>
                        {/* === Unidades por Servicio primero en MOBILE === */}
                        {Array.isArray(row.desglose_unidades) && row.desglose_unidades.length > 0 && (
                            <Box sx={{ mb: 2 }}>
                                <Typography variant="h6" gutterBottom component="div">
                                    Unidades por Servicio
                                </Typography>
                                {row.desglose_unidades.map((servicio, index) => (
                                    <Card key={index} variant="outlined" sx={{ mb: 1, p: 1 }}>
                                        <Typography variant="body2"><strong>Servicio:</strong> {servicio.servicio_nombre}</Typography>
                                        <Typography variant="body2"><strong>Total Unidades:</strong> {servicio.total_unidades}</Typography>
                                        <Typography variant="body2"><strong>Valor Total:</strong> {formatCurrency(servicio.total_valor ?? 0)}</Typography>
                                    </Card>
                                ))}
                            </Box>
                        )}

                        {/* === Desglose por Orden después en MOBILE === */}
                        <Typography variant="h6" gutterBottom component="div">Desglose por Orden</Typography>
                        {row.desglose.map((item, index) => (
                            <ProductividadDetailCard key={index} item={item} formatCurrency={formatCurrency} />
                        ))}
                    </Box>
                </Collapse>
            </CardContent>
        </Card>
    );
};

const ProductividadDetailCard = ({ item, formatCurrency }) => (
    <Card variant="outlined" sx={{ mb: 1, p: 1 }}>
        <Typography variant="body2"><strong>Orden ID:</strong> {item.orden_id}</Typography>
        <Typography variant="body2"><strong>Servicio:</strong> {item.servicio_nombre}</Typography>
        <Typography variant="body2"><strong>Valor Total:</strong> {formatCurrency(item.valor_ganado)}</Typography>
    </Card>
);

const ReporteProductividad = () => {
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [reportData, setReportData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [showAllOperators, setShowAllOperators] = useState(false);

    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

    const handleGenerateReport = () => {
        setLoading(true);
        apiClient.get('/reportes/productividad', { params: { start_date: startDate, end_date: endDate } })
            .then(res => {
                setReportData(res.data);
                if (res.data.reporte.length === 0) {
                    toast.info("No se encontraron datos de productividad para el rango de fechas seleccionado.");
                }
            })
            .catch(err => toast.error(err.response?.data?.detail || "Error al generar el reporte."))
            .finally(() => setLoading(false));
    };

    const sortedAndFilteredReport = useMemo(() => {
        if (!reportData || !reportData.reporte) return [];
        const sorted = [...reportData.reporte].sort((a, b) => b.total_ganado - a.total_ganado);
        return showAllOperators ? sorted : sorted.slice(0, 5);
    }, [reportData, showAllOperators]);

    const chartData = useMemo(() => {
        if (!reportData || sortedAndFilteredReport.length === 0) return { labels: [], datasets: [] };
        return {
            labels: sortedAndFilteredReport.map(row => row.operador_username),
            datasets: [{
                label: 'Productividad Total Ganada',
                data: sortedAndFilteredReport.map(row => row.total_ganado),
                backgroundColor: 'rgba(75, 192, 192, 0.6)',
                borderColor: 'rgba(75, 192, 192, 1)',
                borderWidth: 1,
            }],
        };
    }, [sortedAndFilteredReport]);

    const chartOptions = {
        responsive: true,
        plugins: {
            legend: { position: 'top' },
            title: { display: true, text: 'Productividad por Operador' },
            tooltip: {
                callbacks: {
                    label: (context) => {
                        let label = context.dataset.label || '';
                        if (label) label += ': ';
                        if (context.parsed.y !== null) label += formatCurrency(context.parsed.y);
                        return label;
                    }
                }
            }
        },
        scales: {
            y: { beginAtZero: true, ticks: { callback: (value) => formatCurrency(value) } },
            x: { title: { display: true, text: 'Operador' } },
        },
    };

    // ============= FILA DESPLEGABLE DESKTOP =============
    const Row = ({ row }) => {
        const [open, setOpen] = useState(false);
        return (
            <>
                <TableRow sx={{ '& > *': { borderBottom: 'unset' } }}>
                    <TableCell>
                        <IconButton size="small" onClick={() => setOpen(!open)}>
                            {open ? <KeyboardArrowUp /> : <KeyboardArrowDown />}
                        </IconButton>
                    </TableCell>
                    <TableCell>{row.operador_username}</TableCell>
                    <TableCell align="right">{formatCurrency(row.total_ganado)}</TableCell>
                </TableRow>
                <TableRow>
                    <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={3}>
                        <Collapse in={open} timeout="auto" unmountOnExit>
                            <Box sx={{ margin: 1 }}>
                                {/* === Unidades por Servicio primero en DESKTOP === */}
                                {Array.isArray(row.desglose_unidades) && row.desglose_unidades.length > 0 && (
                                    <Box sx={{ mb: 2 }}>
                                        <Typography variant="h6" gutterBottom component="div">
                                            Unidades por Servicio
                                        </Typography>
                                        <TableContainer sx={{
                                            backgroundColor: theme.palette.background.paper,
                                            '&::-webkit-scrollbar': { height: '8px' },
                                            '&::-webkit-scrollbar-thumb': { backgroundColor: theme.palette.grey[700], borderRadius: '4px' },
                                            '&::-webkit-scrollbar-track': { backgroundColor: theme.palette.background.default },
                                        }}>
                                            <Table size="small">
                                                <TableHead>
                                                    <TableRow>
                                                        <TableCell>Servicio</TableCell>
                                                        <TableCell align="right">Total Unidades</TableCell>
                                                        <TableCell align="right">Valor Total</TableCell>
                                                    </TableRow>
                                                </TableHead>
                                                <TableBody>
                                                    {row.desglose_unidades.map((servicio, index) => (
                                                        <TableRow key={index}>
                                                            <TableCell>{servicio.servicio_nombre}</TableCell>
                                                            <TableCell align="right">{servicio.total_unidades}</TableCell>
                                                            <TableCell align="right">{formatCurrency(servicio.total_valor ?? 0)}</TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </TableContainer>
                                    </Box>
                                )}

                                {/* === Desglose por Orden después === */}
                                <Typography variant="h6" gutterBottom component="div">Desglose por Orden</Typography>
                                <TableContainer sx={{
                                    backgroundColor: theme.palette.background.paper,
                                    '&::-webkit-scrollbar': { height: '8px' },
                                    '&::-webkit-scrollbar-thumb': { backgroundColor: theme.palette.grey[700], borderRadius: '4px' },
                                    '&::-webkit-scrollbar-track': { backgroundColor: theme.palette.background.default },
                                }}>
                                    <Table size="small">
                                        <TableHead>
                                            <TableRow>
                                                <TableCell>Orden ID</TableCell>
                                                <TableCell>Servicio</TableCell>
                                                <TableCell align="right">Valor Total</TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {row.desglose.map((item, index) => (
                                                <TableRow key={index}>
                                                    <TableCell>{item.orden_id}</TableCell>
                                                    <TableCell>{item.servicio_nombre}</TableCell>
                                                    <TableCell align="right">{formatCurrency(item.valor_ganado)}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </TableContainer>
                            </Box>
                        </Collapse>
                    </TableCell>
                </TableRow>
            </>
        );
    };

    const totalProductivity = useMemo(() => reportData?.reporte.reduce((sum, row) => sum + row.total_ganado, 0) || 0, [reportData]);
    const totalOperators = useMemo(() => reportData?.reporte.length || 0, [reportData]);

    return (
        <Paper sx={{ p: 3 }}>
            <Typography variant="h5" mb={3}>Reporte de Productividad</Typography>

            <Grid container spacing={2} alignItems="center" mb={3}>
                <Grid item><TextField type="date" label="Fecha de Inicio" value={startDate} onChange={e => setStartDate(e.target.value)} InputLabelProps={{ shrink: true }} /></Grid>
                <Grid item><TextField type="date" label="Fecha de Fin" value={endDate} onChange={e => setEndDate(e.target.value)} InputLabelProps={{ shrink: true }} /></Grid>
                <Grid item><Button variant="contained" onClick={handleGenerateReport} disabled={loading}>{loading ? 'Generando...' : 'Generar Reporte'}</Button></Grid>
            </Grid>

            {reportData && reportData.reporte.length > 0 && (
                <Grid container spacing={3}>
                    <Grid item xs={12} md={8}>
                        <Paper elevation={3} sx={{ p: 2 }}>
                            <Bar data={chartData} options={chartOptions} />
                        </Paper>
                    </Grid>
                    <Grid item xs={12} md={4}>
                        <Paper elevation={3} sx={{ p: 2 }}>
                            <Typography variant="h6" mb={2}>Detalle por Operador</Typography>
                            {reportData.reporte.length > 5 && (
                                <Button onClick={() => setShowAllOperators(!showAllOperators)} sx={{ mb: 2 }}>
                                    {showAllOperators ? "Ver Top 5" : "Ver Todos"}
                                </Button>
                            )}
                            {isMobile ? (
                                <Box>
                                    {sortedAndFilteredReport.map(row => (
                                        <ProductividadCard key={row.operador_id} row={row} formatCurrency={formatCurrency} isMobile={isMobile} />
                                    ))}
                                </Box>
                            ) : (
                                <TableContainer>
                                    <Table size="small">
                                        <TableHead>
                                            <TableRow>
                                                <TableCell />
                                                <TableCell>Operador</TableCell>
                                                <TableCell align="right">Valor Total</TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {sortedAndFilteredReport.map(row => <Row key={row.operador_id} row={row} />)}
                                        </TableBody>
                                    </Table>
                                </TableContainer>
                            )}
                        </Paper>
                    </Grid>
                </Grid>
            )}
        </Paper>
    );
};

export default ReporteProductividad;
