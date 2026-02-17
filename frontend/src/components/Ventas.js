import React, { useState, useEffect } from 'react';
import apiClient from '../api';
import { formatCurrency } from '../utils/formatters';
import { toast } from 'react-toastify';
import ConfirmationDialog from './ConfirmationDialog';
import VentaDetailDialog from './VentaDetailDialog';
import {
    Box, Paper, Typography, Grid, TextField, Button, IconButton, Autocomplete, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip, useMediaQuery, useTheme, Card, CardContent, CardActions, Tabs, Tab, TablePagination
} from '@mui/material';
import { AddCircleOutline, RemoveCircleOutline, Edit, Delete, Visibility } from '@mui/icons-material';
import { ToggleButton, ToggleButtonGroup } from '@mui/material';

// Helper component for TabPanel
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
// Muestra "eva — Stock: 32" (o "Servicio" si es un servicio)
const productLabel = (p) => {
  if (!p) return '';
  const isService = !!p.es_servicio;
  const stockTxt = isService ? 'Servicio' : `stock: ${p.stock_actual ?? 0}`;
  return `${p.nombre} (${stockTxt})`;
};



// Helper function for a11y props
function a11yProps(index) {
    return {
        id: `simple-tab-${index}`,
        'aria-controls': `simple-tabpanel-${index}`,
    };
}

const VentaCard = ({ venta, handleEdit, handleDelete, handleOpenDetails, getEstadoPagoChip }) => (
    <Card sx={{ mb: 2 }}>
        <CardContent>
            <Typography variant="h6" color="text.primary">Venta #{venta.id} - {venta.cliente?.nombre || 'N/A'}</Typography>
            <Typography color="textSecondary">{new Date(venta.fecha + 'Z').toLocaleString()}</Typography>
            <Box sx={{ my: 1 }}>
                {venta.detalles.map(d => (
                    <Typography key={d.id} variant="body2" color="text.primary">{d.producto?.nombre} (x{d.cantidad})</Typography>
                ))}
            </Box>
            <Typography color="text.primary">Total: {formatCurrency(venta.total)}</Typography>
            <Typography color="text.primary">Pagado: {formatCurrency(venta.monto_pagado)}</Typography>
            <Typography color="text.primary">Saldo: {formatCurrency(venta.total - venta.monto_pagado)}</Typography>

            <Box sx={{ mt: 1 }}>
                {getEstadoPagoChip(venta.estado_pago)}
            </Box>
        </CardContent>
        <CardActions>
            <IconButton onClick={() => handleOpenDetails(venta)} color="info"><Visibility /></IconButton>
            <IconButton onClick={() => handleEdit(venta)} color="primary"><Edit /></IconButton>
            <IconButton onClick={() => handleDelete(venta.id)} color="error"><Delete /></IconButton>
        </CardActions>
    </Card>
);

const Ventas = () => {
    const [totalVentasHoy, setTotalVentasHoy] = useState(0);
    const [ventas, setVentas] = useState([]);
    const [clientes, setClientes] = useState([]);
    const [productos, setProductos] = useState([]);

    const [cliente, setCliente] = useState(null);
    const [saleDetails, setSaleDetails] = useState([{ id: Date.now(), producto: null, cantidad: 1, precioUnitario: 0 }]);
    const [pagada, setPagada] = useState(true);
    const [editingVenta, setEditingVenta] = useState(null);
    const [creditoHabilitado, setCreditoHabilitado] = useState(true);
    const [mensajeCredito, setMensajeCredito] = useState('');

    const [showConfirmDialog, setShowConfirmDialog] = useState(false);
    const [ventaToDelete, setVentaToDelete] = useState(null);
    const [showConfirmSaleDialog, setShowConfirmSaleDialog] = useState(false); // New state for sale confirmation
    const [saleToConfirm, setSaleToConfirm] = useState(null); // New state to hold sale data for confirmation

    const [detailModalOpen, setDetailModalOpen] = useState(false);
    const [selectedVenta, setSelectedVenta] = useState(null);
    
    const [value, setValue] = useState(0); // State for tab selection
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [searchTerm, setSearchTerm] = useState('');


    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

    const [estadoPago, setEstadoPago] = useState("pagada");

    useEffect(() => {
        fetchVentas();
        fetchClientes();
        fetchProductos();
        fetchVentasSummary();
    }, []);

    const fetchVentas = () => apiClient.get('/ventas/').then(res => setVentas(res.data)).catch(console.error);
    const fetchClientes = () => apiClient.get('/clientes/').then(res => setClientes(res.data)).catch(console.error);
    const fetchProductos = () => apiClient.get('/productos/').then(res => setProductos(res.data)).catch(console.error);
    const fetchVentasSummary = () =>
  apiClient
    .get('/reportes/ventas_summary')
    .then(res => setTotalVentasHoy(res.data.total_ventas_hoy))
    .catch(console.error);

    useEffect(() => {
        if (editingVenta) {
            const clienteSeleccionado = clientes.find(c => c.id === editingVenta.cliente_id);
            setCliente(clienteSeleccionado);
            setSaleDetails(editingVenta.detalles.map(d => ({
                id: d.id,
                producto: d.producto,
                cantidad: d.cantidad,
                precioUnitario: d.precio_unitario,
            })));
            setPagada(editingVenta.estado_pago === 'pagado');
        } else {
            resetForm();
        }
    }, [editingVenta, clientes]);

    const resetForm = () => {
        setCliente(null);
        setSaleDetails([{ id: Date.now(), producto: null, cantidad: 1, precioUnitario: 0 }]);
        setPagada(true);
        setEditingVenta(null);
        setCreditoHabilitado(true);
        setMensajeCredito('');
    };

    const handleAddSaleDetail = () => {
        setSaleDetails([...saleDetails, { id: Date.now(), producto: null, cantidad: 1, precioUnitario: 0 }]);
    };

    const handleRemoveSaleDetail = (id) => {
        setSaleDetails(saleDetails.filter(detail => detail.id !== id));
    };

    const handleSaleDetailChange = (id, field, value) => {
        setSaleDetails(prevDetails => prevDetails.map(detail =>
            detail.id === id ? { ...detail, [field]: value } : detail
        ));
    };
    
    const calculateSubtotal = () => {
        return saleDetails.reduce((total, detail) => total + (detail.cantidad * detail.precioUnitario), 0);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!cliente || saleDetails.some(d => !d.producto || d.cantidad <= 0)) {
            toast.error('Asegúrese de seleccionar un cliente y que todos los productos tengan una cantidad válida.');
            return;
        }

        const ventaData = {
            cliente_id: cliente.id,
            detalles: saleDetails.map(({ producto, cantidad, precioUnitario }) => ({
                producto_id: producto.id,
                cantidad,
                precio_unitario: precioUnitario
            })),
            pagada: pagada
        };

        setSaleToConfirm(ventaData);
        setShowConfirmSaleDialog(true);
    };

    const confirmSale = () => {
        const ventaData = saleToConfirm;
        if (!ventaData) return;

        const request = editingVenta
            ? apiClient.put(`/ventas/${editingVenta.id}`, ventaData)
            : apiClient.post('/ventas/', ventaData);

        request.then(() => {
            toast.success(`Venta ${editingVenta ? 'actualizada' : 'registrada'}!`);
            fetchVentas();
            fetchVentasSummary();
            resetForm();
            setValue(1); // Switch to history tab after submit
        }).catch(error => {
            const errorMessage = error.response?.data?.detail || `Error al ${editingVenta ? 'actualizar' : 'registrar'} la venta.`;
            toast.error(errorMessage);
        }).finally(() => {
            setShowConfirmSaleDialog(false);
            setSaleToConfirm(null);
        });
    };

    const handleDelete = (id) => {
        setVentaToDelete(id);
        setShowConfirmDialog(true);
    };

    const confirmDelete = () => {
        apiClient.delete(`/ventas/${ventaToDelete}`).then(() => {
            toast.success('Venta eliminada!');
            fetchVentas();
            fetchVentasSummary();
        }).catch(error => {
            toast.error('Error al eliminar la venta.');
        }).finally(() => {
            setShowConfirmDialog(false);
            setVentaToDelete(null);
        });
    };

    const handleEdit = (venta) => {
        setEditingVenta(venta);
        setValue(0); // Switch to the form tab when editing
    };

    const handleOpenDetails = (venta) => {
        setSelectedVenta(venta);
        setDetailModalOpen(true);
    };

    const handleCloseDetails = () => {
        setDetailModalOpen(false);
        setSelectedVenta(null);
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

    const handleChange = (event, newValue) => {
        setValue(newValue);
    };

    const handleChangePage = (event, newPage) => {
        setPage(newPage);
    };

    const handleChangeRowsPerPage = (event) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };

    const filteredVentas = ventas.filter(venta =>
        (venta.cliente?.nombre.toLowerCase() || '').includes(searchTerm.toLowerCase())
    );

    // Ensure sales are always sorted from newest to oldest
    const sortedVentas = [...filteredVentas].sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

    return (
        <Box sx={{ width: '100%' }}>
            <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                <Tabs value={value} onChange={handleChange} aria-label="sales management tabs">
                    <Tab label="Registrar Venta" {...a11yProps(0)} />
                    <Tab label="Historial de Ventas" {...a11yProps(1)} />
                </Tabs>
            </Box>
            <TabPanel value={value} index={0}>
                <Paper sx={{ p: 3 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                        <Typography variant="h6">
                            {editingVenta ? 'Editar Venta' : 'Registrar Nueva Venta'}
                        </Typography>
                        <Typography variant="h6">Ventas del día (Hoy): {formatCurrency(totalVentasHoy)}</Typography>
                    </Box>
                    <Box component="form" onSubmit={handleSubmit}>
                        {/* Client Autocomplete Section */}
                        <Box sx={{ mb: 3 }}>
                            <Autocomplete
                                options={clientes}
                                getOptionLabel={(option) => option.nombre}
                                value={cliente}
                                onChange={(event, newValue) => {
                                    setCliente(newValue);
                                }}
                                renderInput={(params) => <TextField {...params} label="Cliente" required fullWidth />}
                            />
                        </Box>

                        {/* Sale Details Section */}
                        <Box sx={{ mb: 2 }}>
                            <Typography variant="subtitle1" gutterBottom mb={2}>Detalles de la Venta</Typography>
                            {saleDetails.map((detail) => (
                                <Box key={detail.id} sx={{ display: 'flex', alignItems: 'center', mb: 1, gap: 2, flexWrap: 'wrap' }}>
                                   <Autocomplete
                                    options={productos}
                                    // 👇 etiqueta que verá el usuario en el input (y cuando está seleccionado)
                                    getOptionLabel={productLabel}
                                    value={detail.producto}
                                    onChange={(event, newValue) => {
                                        handleSaleDetailChange(detail.id, 'producto', newValue);
                                        handleSaleDetailChange(detail.id, 'precioUnitario', newValue ? newValue.precio : 0);
                                    }}
                                    // 👇 personalizamos cada fila del dropdown para mostrar nombre + stock
                                    renderOption={(props, option) => (
                                        <li {...props} key={option.id}>
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%', gap: 2 }}>
                                            <span>{option.nombre}</span>
                                            <Typography variant="caption" color="text.secondary">
                                            {option.es_servicio ? 'Servicio' : `Stock: ${option.stock_actual ?? 0}`}
                                            </Typography>
                                        </Box>
                                        </li>
                                    )}
                                    renderInput={(params) => (
                                        <TextField
                                        {...params}
                                        label="Producto"
                                        sx={{ flexGrow: 1, minWidth: '250px' }}
                                        placeholder="Busca por nombre…"
                                        />
                                    )}
                                    />

                                    <TextField
                                        type="number"
                                        label="Cantidad"
                                        value={detail.cantidad}
                                        onChange={(e) => {
                                            const value = e.target.value;
                                            let parsedValue;
                                            if (detail.producto && (detail.producto.unidad_medida === 'MTS' || detail.producto.unidad_medida === 'KGS')) { // Use MTS/KGS as per ProductoForm.js
                                                parsedValue = parseFloat(value);
                                            } else {
                                                parsedValue = parseInt(value, 10);
                                            }
                                            handleSaleDetailChange(detail.id, 'cantidad', isNaN(parsedValue) ? '' : parsedValue);
                                        }}
                                        InputProps={{
                                            inputProps: {
                                                step: (detail.producto && (detail.producto.unidad_medida === 'MTS' || detail.producto.unidad_medida === 'KGS')) ? "any" : "1"
                                            }
                                        }}
                                        sx={{ width: '100px' }}
                                    />
                                    <TextField
                                        type="number"
                                        label="Precio Unit."
                                        value={detail.precioUnitario}
                                        onChange={(e) => handleSaleDetailChange(detail.id, 'precioUnitario', parseFloat(e.target.value))}
                                        sx={{ width: '120px' }}
                                    />
                                    <Typography sx={{ width: '120px' }}>{formatCurrency(detail.cantidad * detail.precioUnitario)}</Typography>
                                    <IconButton onClick={() => handleRemoveSaleDetail(detail.id)} color="error">
                                        <RemoveCircleOutline />
                                    </IconButton>
                                </Box>
                            ))}
                            <Button startIcon={<AddCircleOutline />} onClick={handleAddSaleDetail}>
                                Añadir Producto
                            </Button>
                        </Box>

                        {/* Subtotal, Pagada switch, and Submit Buttons Section */}
                        <Box>
                            <Grid container spacing={2} justifyContent="flex-end" alignItems="center">
                            <Grid item xs={12} sm={6}>
                                <Typography variant="h6" align="right">
                                Subtotal: {formatCurrency(calculateSubtotal())}
                                </Typography>
                            </Grid>

                           <Grid item xs={12} sm={6} sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
                            <ToggleButtonGroup
                                value={estadoPago}
                                exclusive
                                onChange={(e, newValue) => {
                                if (newValue !== null) {
                                    setEstadoPago(newValue);
                                    setPagada(newValue === "pagada"); // sincroniza con tu estado actual
                                }
                                }}
                                sx={{ mr: 2 }}
                            >
                                <ToggleButton value="pagada" color="success">💰 Efectivo</ToggleButton>
                                <ToggleButton value="pendiente" color="error">🕒 X Cobrar</ToggleButton>
                            </ToggleButtonGroup>

                            <Button type="submit" variant="contained">
                                {editingVenta ? 'Actualizar Venta' : 'Registrar Venta'}
                            </Button>
                            {editingVenta && (
                                <Button onClick={resetForm} sx={{ ml: 1 }}>Cancelar</Button>
                            )}
                            </Grid>

                            </Grid>

                        </Box>
                    </Box>
                </Paper>
            </TabPanel>
            <TabPanel value={value} index={1}>
                <Paper sx={{ p: 3 }}>
                  <Box
                    sx={{
                        display: 'flex',
                        flexDirection: isMobile ? 'column' : 'row',
                        justifyContent: isMobile ? 'flex-start' : 'space-between',
                        alignItems: isMobile ? 'stretch' : 'center',
                        gap: 2,
                        mb: 2,
                    }}
                    >
                    <Typography variant="h6">Historial de Ventas</Typography>

                    <TextField
                        fullWidth={isMobile} // 👈 hace que ocupe el ancho completo en móvil
                        label="Buscar por cliente"
                        variant="outlined"
                        size="small"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />

                    <Typography variant="h6">Ventas del día (Hoy): {formatCurrency(totalVentasHoy)}</Typography>
                    </Box>

                    {isMobile ? (
                        <Box>
                            {sortedVentas
                                .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                                .map(venta => (
                                <VentaCard 
                                    key={venta.id}
                                    venta={venta}
                                    handleEdit={handleEdit}
                                    handleDelete={handleDelete}
                                    handleOpenDetails={handleOpenDetails}
                                    getEstadoPagoChip={getEstadoPagoChip}
                                />
                            ))}
                        </Box>
                    ) : (
                        <TableContainer>
                            <Table>
                                <TableHead>
                                    <TableRow>
                                        <TableCell>ID</TableCell>
                                        <TableCell>Cliente</TableCell>
                                        <TableCell>Productos</TableCell>
                                        <TableCell>Total</TableCell>
                                        <TableCell>Pagado</TableCell>
                                        <TableCell>Saldo</TableCell>
                                        <TableCell>Estado</TableCell>
                                        <TableCell>Fecha</TableCell>
                                        <TableCell>Acciones</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {sortedVentas
                                        .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                                        .map(venta => (
                                        <TableRow key={venta.id}>
                                            <TableCell>{venta.id}</TableCell>
                                            <TableCell>{venta.cliente?.nombre || 'N/A'}</TableCell>
                                            <TableCell>
                                                {venta.detalles.map(d => (
                                                    <div key={d.id}>{d.producto?.nombre} (x{d.cantidad})</div>
                                                ))}
                                            </TableCell>
                                            <TableCell>{formatCurrency(venta.total)}</TableCell>
                                            <TableCell>{formatCurrency(venta.monto_pagado)}</TableCell>
                                            <TableCell>{formatCurrency(venta.total - venta.monto_pagado)}</TableCell>
                                            <TableCell>{getEstadoPagoChip(venta.estado_pago)}</TableCell>
                                            <TableCell>{new Date(venta.fecha + 'Z').toLocaleString()}</TableCell>
                                            <TableCell>
                                                <IconButton onClick={() => handleOpenDetails(venta)} color="info"><Visibility /></IconButton>
                                                <IconButton onClick={() => handleEdit(venta)} color="primary"><Edit /></IconButton>
                                                <IconButton onClick={() => handleDelete(venta.id)} color="error"><Delete /></IconButton>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    )}
                     <TablePagination
                        rowsPerPageOptions={[10, 25, 50]}
                        component="div"
                        count={filteredVentas.length}
                        rowsPerPage={rowsPerPage}
                        page={page}
                        onPageChange={handleChangePage}
                        onRowsPerPageChange={handleChangeRowsPerPage}
                    />
                </Paper>
            </TabPanel>

            <ConfirmationDialog
                open={showConfirmDialog}
                handleClose={() => setShowConfirmDialog(false)}
                handleConfirm={confirmDelete}
                title="Confirmar Eliminación"
                message="¿Estás seguro de que quieres eliminar esta venta? Esta acción no se puede deshacer."
            />

            <VentaDetailDialog 
                open={detailModalOpen}
                handleClose={handleCloseDetails}
                venta={selectedVenta}
            />

            <ConfirmationDialog
                open={showConfirmSaleDialog}
                handleClose={() => setShowConfirmSaleDialog(false)}
                handleConfirm={confirmSale}
                title="Confirmar Registro de Venta"
                message="¿Estás seguro de que quieres registrar esta venta?"
            />
        </Box>
    );
};

export default Ventas;
