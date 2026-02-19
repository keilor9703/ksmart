import React, { useState, useEffect, useMemo } from 'react';
import { 
  Box, Paper, Typography, Tabs, Tab, TextField, MenuItem, Button, 
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, 
  IconButton, Grid, Divider, useTheme, Chip, TablePagination, Autocomplete,
  FormControlLabel, Checkbox, Dialog, DialogTitle, DialogContent, DialogActions,
  List, ListItem, ListItemText, Tooltip, Collapse
} from '@mui/material';
import { Add, Delete, ShoppingBag, Receipt, Payment, CheckCircle, Info, KeyboardArrowDown, KeyboardArrowUp, Visibility } from '@mui/icons-material';
import apiClient, { fetchCompras, createCompra, addPagoCompra } from '../api';
import { formatCurrency } from '../utils/formatters';
import { toast } from 'react-toastify';

function TabPanel({ children, value, index }) {
  return (
    <div role="tabpanel" hidden={value !== index}>
      {value === index && <Box sx={{ py: 2 }}>{children}</Box>}
    </div>
  );
}

const Compras = () => {
  const [tab, setTab] = useState(0);
  const [proveedores, setProveedores] = useState([]);
  const [productos, setProductos] = useState([]);
  const [compras, setCompras] = useState([]);
  const [loading, setLoading] = useState(false);

  // Form State Compra
  const [proveedorSel, setProveedorSel] = useState(null);
  const [refFactura, setRefFactura] = useState('');
  const [detalles, setDetalles] = useState([{ producto_id: '', cantidad: 1, precio_unitario: 0 }]);
  const [ivaPorcentajeGlobal, setIvaPorcentajeGlobal] = useState(0);
  const [pagadaAlCrear, setPagadaAlCrear] = useState(false);

  // State para Pago de Deuda
  const [openPayDialog, setOpenPayDialog] = useState(false);
  const [selectedCompra, setSelectedCompra] = useState(null);
  const [montoAbono, setMontoAbono] = useState('');
  const [metodoPago, setMetodoPago] = useState('Transferencia');
  const [detallePago, setDetallePago] = useState('');

  // State para Detalle de Compra (Historial)
  const [openDetailDialog, setOpenDetailDialog] = useState(false);
  const [compraDetalle, setCompraDetalle] = useState(null);

  // Paginación Historial
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadBaseData();
    fetchHistorial();
  }, []);

  const loadBaseData = async () => {
    try {
      const [provRes, prodRes] = await Promise.all([
        apiClient.get('/clientes/'),
        apiClient.get('/productos/')
      ]);
      setProveedores(provRes.data.filter(c => c.es_proveedor));
      setProductos(prodRes.data.filter(p => !p.es_servicio));
    } catch (error) {
      toast.error("Error cargando proveedores/productos");
    }
  };

  const fetchHistorial = async () => {
    try {
      const res = await fetchCompras();
      setCompras(res.data);
    } catch (error) {
      toast.error("Error cargando historial de compras");
    }
  };

  // --- Lógica Formulario ---
  const addDetalle = () => setDetalles([...detalles, { producto_id: '', cantidad: 1, precio_unitario: 0 }]);
  const removeDetalle = (idx) => setDetalles(detalles.filter((_, i) => i !== idx));
  const handleDetalleChange = (idx, field, val) => {
    const newDet = [...detalles];
    newDet[idx][field] = val;
    setDetalles(newDet);
  };

  const calcularTotal = () => {
    return detalles.reduce((acc, curr) => {
      return acc + (curr.cantidad * curr.precio_unitario);
    }, 0);
  };

  const handleSubmit = async () => {
    if (!proveedorSel || detalles.some(d => !d.producto_id || d.cantidad <= 0)) {
      toast.warning("Complete el proveedor y los ítems de compra.");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        proveedor_id: proveedorSel.id,
        referencia_factura: refFactura,
        detalles: detalles.map(d => ({
          ...d,
          producto_id: parseInt(d.producto_id),
          cantidad: parseFloat(d.cantidad),
          precio_unitario: parseFloat(d.precio_unitario),
          iva_porcentaje: 0.0
        })),
        pagada: pagadaAlCrear,
        iva_porcentaje: parseFloat(ivaPorcentajeGlobal)
      };
      await createCompra(payload);
      toast.success("Compra registrada correctamente e inventario actualizado.");
      resetForm();
      fetchHistorial();
      setTab(1);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error al registrar compra");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setProveedorSel(null);
    setRefFactura('');
    setDetalles([{ producto_id: '', cantidad: 1, precio_unitario: 0 }]);
    setIvaPorcentajeGlobal(0);
    setPagadaAlCrear(false);
  };

  // --- Lógica de Pagos ---
  const handleOpenPay = (compra) => {
    setSelectedCompra(compra);
    setMontoAbono(compra.total - compra.monto_pagado);
    setDetallePago('');
    setOpenPayDialog(true);
  };

  const handleConfirmPago = async () => {
    if (!montoAbono || montoAbono <= 0) {
      toast.warning("Ingrese un monto válido.");
      return;
    }
    try {
      await addPagoCompra({
        compra_id: selectedCompra.id,
        monto: parseFloat(montoAbono),
        metodo_pago: metodoPago,
        detalle_pago: detallePago
      });
      toast.success("Pago registrado correctamente");
      setOpenPayDialog(false);
      fetchHistorial();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error al registrar el pago");
    }
  };

  // --- Lógica de Detalle ---
  const handleOpenDetail = (compra) => {
    setCompraDetalle(compra);
    setOpenDetailDialog(true);
  };

  // --- Filtros ---
  const filteredCompras = compras.filter(c => 
    c.proveedor.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.referencia_factura || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  const cuentasPorPagar = compras.filter(c => c.estado_pago !== 'pagado');

  const paginatedCompras = useMemo(() => {
    return filteredCompras.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
  }, [filteredCompras, page, rowsPerPage]);

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
        <ShoppingBag sx={{ mr: 1, color: 'primary.main' }} />
        <Typography variant="h5" fontWeight="bold">Módulo de Compras</Typography>
      </Box>

      <Paper sx={{ mb: 3 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} indicatorColor="primary" textColor="primary">
          <Tab label="Registrar Compra" icon={<Add />} iconPosition="start" />
          <Tab label="Historial de Compras" icon={<Receipt />} iconPosition="start" />
          <Tab label="Cuentas por Pagar" icon={<Payment />} iconPosition="start" />
        </Tabs>
      </Paper>

      {/* REGISTRAR COMPRA */}
      <TabPanel value={tab} index={0}>
        <Paper sx={{ p: 3 }}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={5}>
              <Autocomplete
                options={proveedores}
                getOptionLabel={(option) => `${option.nombre} (${option.cedula || 'S/N'})`}
                value={proveedorSel}
                sx={{ flexGrow: 1, minWidth: '200px' }}
                onChange={(_, v) => setProveedorSel(v)}
                renderInput={(params) => <TextField {...params} label="Proveedor" required />}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField 
                fullWidth label="Referencia Factura Proveedor" 
                value={refFactura} 
                onChange={(e) => setRefFactura(e.target.value)} 
              />
            </Grid>
            <Grid item xs={12} md={2}>
              <TextField
                fullWidth label="% IVA Global" type="number"
                value={ivaPorcentajeGlobal}
                onChange={(e) => setIvaPorcentajeGlobal(e.target.value)}
                helperText="IVA Incluido"
              />
            </Grid>
            <Grid item xs={12} md={1} sx={{ display: 'flex', alignItems: 'center' }}>
              <FormControlLabel
                control={<Checkbox checked={pagadaAlCrear} onChange={(e) => setPagadaAlCrear(e.target.checked)} color="success" />}
                label="Pagada"
              />
            </Grid>
          </Grid>

          <Box sx={{ mt: 4 }}>
            <Typography variant="h6" gutterBottom>Detalle de Compra</Typography>
            <Divider sx={{ mb: 2 }} />
            {detalles.map((det, idx) => (
              <Grid container spacing={2} key={idx} sx={{ mb: 2, alignItems: 'center' }}>
                <Grid item xs={12} md={4}>
                  <TextField
                    select fullWidth label="Producto / Insumo"
                    value={det.producto_id}
                    sx={{ flexGrow: 1, minWidth: '200px' }}
                    onChange={(e) => handleDetalleChange(idx, 'producto_id', e.target.value)}
                  >
                    {productos.map(p => <MenuItem key={p.id} value={p.id}>{p.nombre} ({p.unidad_medida})</MenuItem>)}
                  </TextField>
                </Grid>
                <Grid item xs={4} md={2}>
                  <TextField 
                    fullWidth type="number" label="Cant." 
                    value={det.cantidad} 
                    onChange={(e) => handleDetalleChange(idx, 'cantidad', e.target.value)} 
                  />
                </Grid>
                <Grid item xs={4} md={3}>
                  <TextField 
                    fullWidth type="number" label="Precio Unit. (Costo)" 
                    value={det.precio_unitario} 
                    onChange={(e) => handleDetalleChange(idx, 'precio_unitario', e.target.value)} 
                  />
                </Grid>
                <Grid item xs={1} md={1}>
                  <IconButton color="error" onClick={() => removeDetalle(idx)} disabled={detalles.length === 1}>
                    <Delete />
                  </IconButton>
                </Grid>
              </Grid>
            ))}
            <Button startIcon={<Add />} onClick={addDetalle}>Agregar Línea</Button>
          </Box>

          <Box sx={{ mt: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h5" color="primary">Total Compra: {formatCurrency(calcularTotal())}</Typography>
            <Button variant="contained" size="large" onClick={handleSubmit} disabled={loading} color="success">
              {loading ? "Procesando..." : "Registrar Entrada de Mercancía"}
            </Button>
          </Box>
        </Paper>
      </TabPanel>

      {/* HISTORIAL */}
      <TabPanel value={tab} index={1}>
        <TextField 
          fullWidth label="Buscar por proveedor o factura..." 
          sx={{ mb: 2 }} 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <TableContainer component={Paper}>
          <Table>
            <TableHead sx={{ backgroundColor: 'action.hover' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 'bold' }}>ID</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Fecha</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Proveedor</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Factura Ref.</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Total</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Pagado</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Estado</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paginatedCompras.map((c) => (
                <TableRow key={c.id} hover>
                  <TableCell>#{c.id}</TableCell>
                  <TableCell>{new Date(c.fecha).toLocaleDateString()}</TableCell>
                  <TableCell>{c.proveedor.nombre}</TableCell>
                  <TableCell>{c.referencia_factura || '—'}</TableCell>
                  <TableCell>{formatCurrency(c.total)}</TableCell>
                  <TableCell sx={{ color: 'success.main', fontWeight: 'bold' }}>{formatCurrency(c.monto_pagado)}</TableCell>
                  <TableCell>
                    <Chip 
                      size="small" 
                      label={c.estado_pago.toUpperCase()} 
                      color={c.estado_pago === 'pagado' ? 'success' : c.estado_pago === 'parcial' ? 'warning' : 'error'} 
                    />
                  </TableCell>
                  <TableCell>
                    <Tooltip title="Ver Detalles y Pagos">
                      <IconButton color="info" onClick={() => handleOpenDetail(c)}>
                        <Visibility />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          rowsPerPageOptions={[5, 10, 25]}
          component="div"
          count={filteredCompras.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={(_, p) => setPage(p)}
          onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
        />
      </TabPanel>

      {/* CUENTAS POR PAGAR */}
      <TabPanel value={tab} index={2}>
        <Typography variant="h6" sx={{ mb: 2 }}>Facturas con Saldo Pendiente</Typography>
        <TableContainer component={Paper}>
          <Table>
            <TableHead sx={{ backgroundColor: 'action.hover' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 'bold' }}>Proveedor</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Factura</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Total</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Pagado</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Saldo Pendiente</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Acción</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {cuentasPorPagar.map((c) => (
                <TableRow key={c.id} hover>
                  <TableCell>{c.proveedor.nombre}</TableCell>
                  <TableCell>{c.referencia_factura || `#${c.id}`}</TableCell>
                  <TableCell>{formatCurrency(c.total)}</TableCell>
                  <TableCell sx={{ color: 'success.main' }}>{formatCurrency(c.monto_pagado)}</TableCell>
                  <TableCell sx={{ color: 'error.main', fontWeight: 'bold' }}>{formatCurrency(c.total - c.monto_pagado)}</TableCell>
                  <TableCell>
                    <Button 
                      variant="outlined" 
                      startIcon={<CheckCircle />} 
                      size="small"
                      onClick={() => handleOpenPay(c)}
                    >
                      Registrar Pago
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {cuentasPorPagar.length === 0 && (
                <TableRow><TableCell colSpan={6} align="center">No hay cuentas por pagar pendientes.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </TabPanel>

      {/* DIÁLOGO DE PAGO (ABONOS) */}
      <Dialog open={openPayDialog} onClose={() => setOpenPayDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Registrar Pago a Proveedor</DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <Typography variant="caption" color="textSecondary">Factura:</Typography>
              <Typography variant="body1"><b>{selectedCompra?.referencia_factura || selectedCompra?.id}</b></Typography>
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="caption" color="textSecondary">Proveedor:</Typography>
              <Typography variant="body1"><b>{selectedCompra?.proveedor.nombre}</b></Typography>
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="caption" color="textSecondary">Total Factura:</Typography>
              <Typography variant="body1">{formatCurrency(selectedCompra?.total || 0)}</Typography>
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="caption" color="error">Saldo Pendiente:</Typography>
              <Typography variant="body1" color="error" fontWeight="bold">
                {formatCurrency(selectedCompra ? selectedCompra.total - selectedCompra.monto_pagado : 0)}
              </Typography>
            </Grid>
          </Grid>

          <Divider sx={{ my: 2 }} />

          <Typography variant="subtitle2" gutterBottom><b>HISTORIAL DE PAGOS REALIZADOS</b></Typography>
          <List dense sx={{ bgcolor: 'action.hover', borderRadius: 1, mb: 2 }}>
            {selectedCompra?.pagos && selectedCompra.pagos.length > 0 ? (
              selectedCompra.pagos.map((p, idx) => (
                <ListItem key={idx} divider={idx !== selectedCompra.pagos.length - 1}>
                  <ListItemText 
                    primary={`${formatCurrency(p.monto)} - ${p.metodo_pago}`} 
                    secondary={`${new Date(p.fecha).toLocaleString()} ${p.detalle_pago ? `| Ref: ${p.detalle_pago}` : ''}`} 
                  />
                </ListItem>
              ))
            ) : (
              <ListItem><ListItemText secondary="No se han registrado pagos previos." /></ListItem>
            )}
          </List>

          <Divider sx={{ my: 2 }} />

          <Typography variant="subtitle2">REGISTRAR NUEVO ABONO</Typography>
          <TextField
            fullWidth label="Monto a Pagar" type="number"
            value={montoAbono} onChange={(e) => setMontoAbono(e.target.value)}
            margin="normal" required autoFocus
          />
          <TextField
            select fullWidth label="Método de Pago"
            value={metodoPago} onChange={(e) => setMetodoPago(e.target.value)}
            margin="normal"
          >
            <MenuItem value="Transferencia">Transferencia</MenuItem>
            <MenuItem value="Efectivo">Efectivo</MenuItem>
            <MenuItem value="Cheque">Cheque</MenuItem>
            <MenuItem value="Nota Crédito">Nota Crédito</MenuItem>
          </TextField>
          
          {metodoPago !== 'Efectivo' && (
            <TextField
              fullWidth 
              label={metodoPago === 'Transferencia' ? "Nro. Cuenta / Comprobante" : metodoPago === 'Cheque' ? "Nro. Cheque" : "Nro. Referencia / Nota"}
              value={detallePago} 
              onChange={(e) => setDetallePago(e.target.value)}
              margin="normal"
              placeholder="Ej: 123456789"
              required
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenPayDialog(false)}>Cancelar</Button>
          <Button onClick={handleConfirmPago} variant="contained" color="success">Confirmar Pago</Button>
        </DialogActions>
      </Dialog>

      {/* DIÁLOGO DETALLE COMPLETO (PRODUCTOS Y PAGOS) */}
      <Dialog open={openDetailDialog} onClose={() => setOpenDetailDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          Detalle de Compra #{compraDetalle?.id}
          <Chip label={compraDetalle?.estado_pago.toUpperCase()} color={compraDetalle?.estado_pago === 'pagado' ? 'success' : 'warning'} />
        </DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={4}>
              <Typography variant="caption" color="textSecondary">Proveedor:</Typography>
              <Typography variant="body1"><b>{compraDetalle?.proveedor.nombre}</b></Typography>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Typography variant="caption" color="textSecondary">Fecha:</Typography>
              <Typography variant="body1">{new Date(compraDetalle?.fecha).toLocaleString()}</Typography>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Typography variant="caption" color="textSecondary">Ref. Factura:</Typography>
              <Typography variant="body1">{compraDetalle?.referencia_factura || 'N/A'}</Typography>
            </Grid>
          </Grid>

          <Typography variant="subtitle2" gutterBottom><b>ÍTEMS COMPRADOS</b></Typography>
          <TableContainer component={Paper} variant="outlined" sx={{ mb: 3 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Producto</TableCell>
                  <TableCell align="right">Cantidad</TableCell>
                  <TableCell align="right">Precio Unit.</TableCell>
                  <TableCell align="right">Subtotal</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {compraDetalle?.detalles.map((d, idx) => (
                  <TableRow key={idx}>
                    <TableCell>{d.producto.nombre}</TableCell>
                    <TableCell align="right">{d.cantidad} {d.producto.unidad_medida}</TableCell>
                    <TableCell align="right">{formatCurrency(d.precio_unitario)}</TableCell>
                    <TableCell align="right">{formatCurrency(d.cantidad * d.precio_unitario)}</TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell colSpan={3} align="right"><b>Total Bruto:</b></TableCell>
                  <TableCell align="right"><b>{formatCurrency(compraDetalle ? compraDetalle.total : 0)}</b></TableCell>
                </TableRow>
                <TableRow>
                  <TableCell colSpan={3} align="right">IVA ({compraDetalle?.iva_porcentaje}%):</TableCell>
                  <TableCell align="right">{formatCurrency(compraDetalle?.iva_total || 0)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>

          <Typography variant="subtitle2" gutterBottom><b>HISTORIAL DE PAGOS / ABONOS</b></Typography>
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Fecha</TableCell>
                  <TableCell>Método</TableCell>
                  <TableCell>Referencia / Detalle</TableCell>
                  <TableCell align="right">Monto</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {compraDetalle?.pagos && compraDetalle.pagos.length > 0 ? (
                  compraDetalle.pagos.map((p, idx) => (
                    <TableRow key={idx}>
                      <TableCell>{new Date(p.fecha).toLocaleString()}</TableCell>
                      <TableCell>{p.metodo_pago}</TableCell>
                      <TableCell>{p.detalle_pago || '—'}</TableCell>
                      <TableCell align="right"><b>{formatCurrency(p.monto)}</b></TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow><TableCell colSpan={4} align="center">No hay pagos registrados.</TableCell></TableRow>
                )}
                <TableRow sx={{ bgcolor: 'action.hover' }}>
                  <TableCell colSpan={3} align="right"><b>TOTAL PAGADO:</b></TableCell>
                  <TableCell align="right"><b>{formatCurrency(compraDetalle?.monto_pagado || 0)}</b></TableCell>
                </TableRow>
                <TableRow>
                  <TableCell colSpan={3} align="right"><b style={{ color: 'red' }}>SALDO PENDIENTE:</b></TableCell>
                  <TableCell align="right"><b style={{ color: 'red' }}>{formatCurrency(compraDetalle ? compraDetalle.total - compraDetalle.monto_pagado : 0)}</b></TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDetailDialog(false)} variant="contained">Cerrar</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Compras;
