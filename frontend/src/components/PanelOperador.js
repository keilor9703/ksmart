import React, { useState, useEffect } from 'react';
import { getPanelOperadorPendientes, getPanelOperadorProductividad, getPanelOperadorHistorial } from '../api';
import { 
    Box, Typography, Grid, Card, CardContent, CircularProgress, Alert, 
    List, ListItem, ListItemText, Divider, Chip, Tabs, Tab, 
    TableContainer, Table, TableBody, TableCell, TableHead, TableRow, Paper, 
    useMediaQuery, useTheme, Button
} from '@mui/material';
import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import dayjs from 'dayjs';

ChartJS.register(ArcElement, Tooltip, Legend);

// Refactored data fetching function
const fetchPanelData = async (setLoading, setPendientes, setProductividad, setHistorial, setError, startDate = null, endDate = null) => {
    try {
        setLoading(true);
        const [pendientesRes, productividadRes, historialRes] = await Promise.all([
            getPanelOperadorPendientes(),
            getPanelOperadorProductividad(startDate ? startDate.format('YYYY-MM-DD') : null, endDate ? endDate.format('YYYY-MM-DD') : null),
            getPanelOperadorHistorial()
        ]);
        setPendientes(pendientesRes.data);
        setProductividad(productividadRes.data);
        setHistorial(historialRes.data);
        setError(null);
    } catch (err) {
        setError('Error al cargar los datos del panel. Por favor, intente de nuevo más tarde.');
        console.error(err);
    } finally {
        setLoading(false);
    }
};

// TabPanel component for conditional rendering
function TabPanel(props) {
    const { children, value, index, ...other } = props;

    return (
        <div
            role="tabpanel"
            hidden={value !== index}
            id={`simple-tabpanel-${index}`}
            aria-labelledby={`simple-tab-${index}`}
            {...other}
        >
            {value === index && (
                <Box sx={{ p: 3 }}>
                    {children}
                </Box>
            )}
        </div>
    );
}

function a11yProps(index) {
    return {
        id: `simple-tab-${index}`,
        'aria-controls': `simple-tabpanel-${index}`,
    };
}

const OrdenTrabajoCard = ({ orden }) => (
    <Card sx={{ mb: 2 }}>
        <CardContent>
            <Typography variant="h6" color="text.primary">Orden #{orden.id} - {orden.cliente_nombre}</Typography>
            <Typography color="textSecondary">Fecha Creación: {new Date(orden.fecha_creacion + 'Z').toLocaleString('es-CO', { timeZone: 'America/Bogota' })}</Typography>
            <Box sx={{ my: 1 }}>
                <Typography variant="body2" color="text.primary">Estado: <Chip label={orden.estado} color={orden.estado === 'Aprobada' ? 'primary' : 'warning'} size="small" /></Typography>
                <Typography variant="body2" color="text.primary">Total: ${orden.total.toLocaleString()}</Typography>
                {orden.productos && orden.productos.length > 0 && (
                    <Typography variant="body2" color="text.primary">Productos:</Typography>
                )}
                <List dense disablePadding>
                    {orden.productos && orden.productos.length > 0 ? orden.productos.map(item => (
                        <ListItem key={item.id} sx={{ pl: 0 }}>
                            <ListItemText
                                primary={`${item.producto.nombre} (x${item.cantidad})`}
                                secondary={`${item.precio_unitario.toLocaleString()}`}
                            />
                        </ListItem>
                    )) : null}
                </List>
                {orden.servicios && orden.servicios.length > 0 && (
                    <Typography variant="body2" color="text.primary">Servicios:</Typography>
                )}
                <List dense disablePadding>
                    {orden.servicios && orden.servicios.length > 0 ? orden.servicios.map(item => (
                        <ListItem key={item.id} sx={{ pl: 0 }}>
                            <ListItemText
                                primary={`${item.servicio.nombre} (x${item.cantidad})`}
                                secondary={`${item.precio_servicio.toLocaleString()}`}
                            />
                        </ListItem>
                    )) : null}
                </List>
            </Box>
        </CardContent>
    </Card>
);

const PanelOperador = () => {
    const [pendientes, setPendientes] = useState([]);
    const [productividad, setProductividad] = useState(null);
    const [historial, setHistorial] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [currentTab, setCurrentTab] = useState(0); // State for active tab
    const [startDate, setStartDate] = useState(null); // New state for start date filter
    const [endDate, setEndDate] = useState(null);     // New state for end date filter

    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

    // Effect to fetch data on component mount and when dates change
    useEffect(() => {
        fetchPanelData(setLoading, setPendientes, setProductividad, setHistorial, setError, startDate, endDate);
    }, [startDate, endDate]); // Re-run when startDate or endDate changes

    const handleTabChange = (event, newValue) => {
        setCurrentTab(newValue);
    };

    const chartData = {
        labels: productividad?.grafica_servicios_semana.map(d => d.name) || [],
        datasets: [
            {
                label: 'Unidades de Servicio de la Semana', // Updated label
                data: productividad?.grafica_servicios_semana.map(d => d.value) || [],
                backgroundColor: [
                    'rgba(255, 99, 132, 0.7)',
                    'rgba(54, 162, 235, 0.7)',
                    'rgba(255, 206, 86, 0.7)',
                    'rgba(75, 192, 192, 0.7)',
                    'rgba(153, 102, 255, 0.7)',
                    'rgba(255, 159, 64, 0.7)',
                ],
                borderColor: [
                    'rgba(255, 99, 132, 1)',
                    'rgba(54, 162, 235, 1)',
                    'rgba(255, 206, 86, 1)',
                    'rgba(75, 192, 192, 1)',
                    'rgba(153, 102, 255, 1)',
                    'rgba(255, 159, 64, 1)',
                ],
                borderWidth: 1,
            },
        ],
    };

    if (loading) {
        return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}><CircularProgress /></Box>;
    }

    if (error) {
        return <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>;
    }

    return (
        <Box sx={{ p: 3 }}>
            <Typography variant="h4" gutterBottom color="text.primary">Panel del Operador</Typography>
            <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                <Tabs value={currentTab} onChange={handleTabChange} aria-label="panel de operador tabs">
                    <Tab label="Órdenes Pendientes" {...a11yProps(0)} />
                    <Tab label="Productividad" {...a11yProps(1)} />
                    <Tab label="Historial" {...a11yProps(2)} />
                </Tabs>
            </Box>

            <TabPanel value={currentTab} index={0}>
                <Card elevation={3} sx={{ backgroundColor: 'background.paper' }}>
                    <CardContent>
                        <Typography variant="h5" gutterBottom>Órdenes de Trabajo Pendientes</Typography>
                        {isMobile ? (
                            <Box>
                                {pendientes.length > 0 ? pendientes.map(orden => (
                                    <OrdenTrabajoCard key={orden.id} orden={orden} />
                                )) : (
                                    <Typography align="center">No hay órdenes pendientes.</Typography>
                                )}
                            </Box>
                        ) : (
                            <TableContainer component={Paper} sx={{ overflowX: 'auto', backgroundColor: 'background.paper' }}>
                                <Table aria-label="órdenes de trabajo pendientes">
                                    <TableHead>
                                        <TableRow>
                                            <TableCell>ID Orden</TableCell>
                                            <TableCell>Cliente</TableCell>
                                            <TableCell>Contacto</TableCell>
                                            <TableCell>Fecha Creación</TableCell>
                                            <TableCell>Estado</TableCell>
                                            <TableCell>Productos</TableCell>
                                            <TableCell>Servicios</TableCell>
                                            <TableCell align="right">Total</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {pendientes.length > 0 ? pendientes.map((orden) => (
                                            <TableRow
                                                key={orden.id}
                                                sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
                                            >
                                                <TableCell component="th" scope="row">
                                                    {orden.id}
                                                </TableCell>
                                                <TableCell>{orden.cliente_nombre}</TableCell>
                                                <TableCell>
                                                    <Typography variant="body2">Tel: {orden.cliente_telefono || 'N/A'}</Typography>
                                                    <Typography variant="body2">Dir: {orden.cliente_direccion || 'N/A'}</Typography>
                                                </TableCell>
                                                <TableCell>{new Date(orden.fecha_creacion + 'Z').toLocaleString('es-CO', { timeZone: 'America/Bogota' })}</TableCell>
                                                <TableCell><Chip label={orden.estado} color={orden.estado === 'Aprobada' ? 'primary' : 'warning'} /></TableCell>
                                                <TableCell>
                                                    <List dense disablePadding>
                                                        {orden.productos && orden.productos.length > 0 ? orden.productos.map(item => (
                                                            <ListItem key={item.id} sx={{ pl: 0 }}>
                                                                <ListItemText
                                                                    primary={`${item.producto.nombre} (x${item.cantidad})`}
                                                                    secondary={`${item.precio_unitario.toLocaleString()}`}
                                                                />
                                                            </ListItem>
                                                        )) : <ListItemText primary="N/A" />}
                                                    </List>
                                                </TableCell>
                                                <TableCell>
                                                    <List dense disablePadding>
                                                        {orden.servicios && orden.servicios.length > 0 ? orden.servicios.map(item => (
                                                            <ListItem key={item.id} sx={{ pl: 0 }}>
                                                                <ListItemText
                                                                    primary={`${item.servicio.nombre} (x${item.cantidad})`}
                                                                    secondary={`${item.precio_servicio.toLocaleString()}`}
                                                                />
                                                            </ListItem>
                                                        )) : <ListItemText primary="N/A" />}
                                                    </List>
                                                </TableCell>
                                                <TableCell align="right">${orden.total.toLocaleString()}</TableCell>
                                            </TableRow>
                                        )) : (
                                            <TableRow>
                                                <TableCell colSpan={8} align="center">
                                                    No hay órdenes pendientes.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        )}
                    </CardContent>
                </Card>
            </TabPanel>

          <TabPanel value={currentTab} index={1}>
  <Card elevation={3}>
    <CardContent>
      <Typography variant="h5" gutterBottom>Panel de Productividad (Unidades)</Typography>

      {productividad && (
        <>
          <LocalizationProvider dateAdapter={AdapterDayjs}>
            <Box sx={{ display: 'flex', gap: 2, mb: 3, flexDirection: isMobile ? 'column' : 'row' }}>
              <DatePicker
                label="Fecha Inicio"
                value={startDate}
                onChange={(newValue) => setStartDate(newValue)}
                slotProps={{ textField: { fullWidth: isMobile } }}
              />
              <DatePicker
                label="Fecha Fin"
                value={endDate}
                onChange={(newValue) => setEndDate(newValue)}
                slotProps={{ textField: { fullWidth: isMobile } }}
              />
              <Button
                variant="contained"
                onClick={() => fetchPanelData(setLoading, setPendientes, setProductividad, setHistorial, setError, startDate, endDate)}
                sx={{ height: '56px' }}
              >
                Aplicar Filtro
              </Button>
              <Button
                variant="outlined"
                onClick={() => { setStartDate(null); setEndDate(null); }}
                sx={{ height: '56px' }}
              >
                Limpiar Filtro
              </Button>
            </Box>
          </LocalizationProvider>

          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={6}>
              <Card sx={{ textAlign: 'center', p: 1, backgroundColor: '#f0f4f8' }}>
                <Typography variant="h6" color="black">{productividad.servicios_hoy}</Typography>
                <Typography variant="body2" color="black">Unidades Hoy</Typography>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Card sx={{ textAlign: 'center', p: 1, backgroundColor: '#e8f5e9' }}>
                <Typography variant="h6" color="black">{productividad.servicios_semana}</Typography>
                <Typography variant="body2" color="black">Unidades Semana</Typography>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Card sx={{ textAlign: 'center', p: 1, backgroundColor: '#e3f2fd' }}>
                <Typography variant="h6" color="black">{productividad.servicios_mes}</Typography>
                <Typography variant="body2" color="black">Unidades Mes</Typography>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Card sx={{ textAlign: 'center', p: 1, backgroundColor: '#fff3e0' }}>
                <Typography variant="h6" color="black">{productividad.ordenes_completadas_semana}</Typography>
                <Typography variant="body2" color="black">Órdenes Cerradas (Semana)</Typography>
              </Card>
            </Grid>

            <Grid item xs={12} sx={{ mt: 2 }}>
              <Typography variant="h6" align="center">Unidades de Servicio por Periodo (Gráfica)</Typography>
              {productividad.grafica_servicios_semana.length > 0 ? (
                <Doughnut data={chartData} />
              ) : (
                <Typography align="center" sx={{ mt: 2 }}>
                  No hay datos de servicios para mostrar en la gráfica.
                </Typography>
              )}
            </Grid>

            <Grid item xs={12} sx={{ mt: 4 }}>
              <Typography variant="h6" gutterBottom align="center">
                Total de Unidades por Tipo de Servicio (Tabla)
              </Typography>
              {productividad.unidades_por_servicio_filtrado.length > 0 ? (
                <TableContainer component={Paper} sx={{ mt: 2 }}>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Servicio</TableCell>
                        <TableCell align="right">Unidades</TableCell>
                        <TableCell align="right">Valor Total</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {productividad.unidades_por_servicio_filtrado.map((row) => (
                        <TableRow key={row.servicio_id}>
                          <TableCell>{row.servicio_nombre}</TableCell>
                          <TableCell align="right">{row.total_unidades}</TableCell>
                          <TableCell align="right">
                            ${row.total_valor.toLocaleString('es-CO')}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              ) : (
                <Typography align="center" sx={{ mt: 2 }}>
                  No hay datos de unidades por servicio para mostrar en la tabla.
                </Typography>
              )}
            </Grid>
          </Grid>
        </>
      )}
    </CardContent>
  </Card>
</TabPanel>


            <TabPanel value={currentTab} index={2}>
                <Card elevation={3}>
                    <CardContent>
                        <Typography variant="h5" gutterBottom>Historial Reciente (Últimos 7 días)</Typography>
                        <List>
                            {historial.length > 0 ? historial.map((orden, index) => (
                                <React.Fragment key={orden.id}>
                                    <ListItem>
                                        <ListItemText 
                                            primary={`#${orden.id} - ${orden.cliente_nombre}`}
                                            secondary={`Total: ${orden.total.toLocaleString()} - ${new Date(orden.fecha_actualizacion).toLocaleDateString()}`}
                                        />
                                        <Chip label={`Pago: ${orden.estado_pago_venta}`} color={orden.estado_pago_venta === 'pagado' ? 'success' : 'default'} />
                                    </ListItem>
                                    {index < historial.length - 1 && <Divider />}
                                </React.Fragment>
                            )) : <Typography>No hay órdenes cerradas recientemente.</Typography>}
                        </List>
                    </CardContent>
                </Card>
            </TabPanel>
        </Box>
    );
};

export default PanelOperador;