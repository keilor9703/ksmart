import React, { useState, useEffect, useMemo } from 'react';
import { 
  Box, Typography, Button, Paper, Table, TableBody, TableCell, TableContainer, 
  TableHead, TableRow, Chip, IconButton, Dialog, DialogTitle, DialogContent, 
  DialogActions, TextField, MenuItem, Grid, Divider, useTheme, useMediaQuery,
  Card, CardContent, CardActions, TablePagination
} from '@mui/material';
import { Add, CheckCircle, Cancel, Visibility } from '@mui/icons-material';
import { fetchLotes, createLote, confirmarLote, cancelarLote, fetchRecetas } from '../api';
import apiClient from '../api';
import { toast } from 'react-toastify';
import ConfirmationDialog from './ConfirmationDialog';

const LoteCard = ({ lote, handleOpenConfirm, handleCancelar }) => {
  const getStatusChip = (status) => {
    const colors = { 'Borrador': 'default', 'Confirmado': 'success', 'Cancelado': 'error' };
    return <Chip label={status} color={colors[status] || 'default'} size="small" />;
  };

  return (
    <Card sx={{ mb: 2 }}>
      <CardContent>
        <Typography variant="h6">Lote #{lote.id}</Typography>
        <Typography color="textSecondary">{lote.receta.producto_resultante.nombre}</Typography>
        <Typography variant="body2" sx={{ mt: 1 }}>
          <strong>Planificado:</strong> {lote.cantidad_a_producir} {lote.receta.producto_resultante.unidad_medida}
        </Typography>
        {lote.cantidad_real && (
          <Typography variant="body2" color="secondary">
            <strong>Real:</strong> {lote.cantidad_real}
          </Typography>
        )}
        <Box sx={{ mt: 1 }}>{getStatusChip(lote.estado)}</Box>
        <Typography variant="caption" display="block" sx={{ mt: 1 }}>
          {lote.cliente ? `Maquila: ${lote.cliente.nombre}` : 'Interno (Vialmar)'}
        </Typography>
      </CardContent>
      <CardActions>
        {lote.estado === 'Borrador' && (
          <>
            <IconButton color="success" onClick={() => handleOpenConfirm(lote)}>
              <CheckCircle />
            </IconButton>
            <IconButton color="error" onClick={() => handleCancelar(lote.id)}>
              <Cancel />
            </IconButton>
          </>
        )}
      </CardActions>
    </Card>
  );
};

const Lotes = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
  const [lotes, setLotes] = useState([]);
  const [recetas, setRecetas] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [open, setOpen] = useState(false);
  const [openConfirm, setOpenConfirm] = useState(false);
  const [selectedLote, setSelectedLote] = useState(null);
  const [loading, setLoading] = useState(false);

  // Paginación
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Form State Creación
  const [formData, setFormData] = useState({
    receta_id: '', cantidad_a_producir: '', cliente_id: '', observaciones: ''
  });

  // Form State Confirmación
  const [confirmData, setConfirmData] = useState({
    cantidad_real: '', precio_maquila: 0, observaciones: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [lotResponse, recResponse, cliResponse] = await Promise.all([
        fetchLotes(), fetchRecetas(), apiClient.get('/clientes/')
      ]);
      setLotes(lotResponse.data);
      setRecetas(recResponse.data);
      setClientes(cliResponse.data);
    } catch (error) {
      toast.error("Error cargando lotes");
    }
  };

  const filteredLotes = lotes.filter(l =>
    l.id.toString().includes(searchTerm) ||
    l.receta.producto_resultante.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (l.cliente?.nombre || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  const paginatedLotes = useMemo(() => {
    return filteredLotes.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
  }, [filteredLotes, page, rowsPerPage]);

  const handleChangePage = (event, newPage) => setPage(newPage);
  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleOpen = () => setOpen(true);
  const handleClose = () => {
    setOpen(false);
    setFormData({ receta_id: '', cantidad_a_producir: '', cliente_id: '', observaciones: '' });
  };

  const handleOpenConfirm = (lote) => {
    setSelectedLote(lote);
    setConfirmData({
      cantidad_real: lote.cantidad_a_producir,
      precio_maquila: 0,
      observaciones: ''
    });
    setOpenConfirm(true);
  };

  const handleCloseConfirm = () => {
    setOpenConfirm(false);
    setSelectedLote(null);
  };

  const handleSubmit = async () => {
    if (!formData.receta_id || !formData.cantidad_a_producir) {
      toast.warning("Complete todos los campos requeridos");
      return;
    }
    setLoading(true);
    try {
      // Limpiar datos para el backend
      const payload = {
        ...formData,
        receta_id: parseInt(formData.receta_id),
        cantidad_a_producir: parseFloat(formData.cantidad_a_producir),
        cliente_id: formData.cliente_id !== "" ? parseInt(formData.cliente_id) : null
      };
      await createLote(payload);
      toast.success("Lote creado");
      loadData();
      handleClose();
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.detail?.[0]?.msg || "Error al crear lote");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmarFinal = async () => {
    setLoading(true);
    try {
      await confirmarLote(selectedLote.id, confirmData);
      toast.success("Producción finalizada");
      loadData();
      handleCloseConfirm();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error al confirmar");
    } finally {
      setLoading(false);
    }
  };

  const handleCancelarClick = async (id) => {
    if (window.confirm("¿Cancelar este lote?")) {
      try {
        await cancelarLote(id);
        toast.success("Lote cancelado");
        loadData();
      } catch (error) {
        toast.error("Error al cancelar");
      }
    }
  };

  const getStatusChip = (status) => {
    const colors = { 'Borrador': 'default', 'Confirmado': 'success', 'Cancelado': 'error' };
    return <Chip label={status} color={colors[status] || 'default'} size="small" />;
  };

  return (
    <Paper sx={{ mt: 4, p: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6" gutterBottom component="div">
          Lotes de Producción (Transformación)
        </Typography>
        <Button variant="contained" startIcon={<Add />} onClick={handleOpen} color="primary">
          Nuevo Lote
        </Button>
      </Box>

      <TextField
        label="Buscar por ID, producto o cliente..."
        variant="outlined"
        fullWidth
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        sx={{ mb: 2, mt: 1 }}
      />

      {isMobile ? (
        <Box sx={{ mt: 2 }}>
          {paginatedLotes.map(l => (
            <LoteCard key={l.id} lote={l} handleOpenConfirm={handleOpenConfirm} handleCancelar={handleCancelarClick} />
          ))}
        </Box>
      ) : (
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 'bold' }}>ID</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Fecha</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Producto</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Planificado vs Real</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Costo Total</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Tipo</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Estado</TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold' }}>Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paginatedLotes.map((l) => (
                <TableRow key={l.id} hover>
                  <TableCell>#{l.id}</TableCell>
                  <TableCell>{new Date(l.fecha_planificada).toLocaleDateString()}</TableCell>
                  <TableCell>{l.receta.producto_resultante.nombre}</TableCell>
                  <TableCell>
                    {l.cantidad_a_producir} {l.receta.producto_resultante.unidad_medida}
                    {l.cantidad_real && (
                      <Typography variant="caption" display="block" color="secondary">
                        Real: {l.cantidad_real}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    {l.costo_total > 0 ? `$${l.costo_total.toFixed(2)}` : '---'}
                  </TableCell>
                  <TableCell>
                    {l.cliente ? `Maquila: ${l.cliente.nombre}` : 'Interno'}
                  </TableCell>
                  <TableCell>{getStatusChip(l.estado)}</TableCell>
                  <TableCell align="right">
                    {l.estado === 'Borrador' && (
                      <>
                        <IconButton color="success" onClick={() => handleOpenConfirm(l)}>
                          <CheckCircle />
                        </IconButton>
                        <IconButton color="error" onClick={() => handleCancelarClick(l.id)}>
                          <Cancel />
                        </IconButton>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <TablePagination
        rowsPerPageOptions={[5, 10, 25]}
        component="div"
        count={filteredLotes.length}
        rowsPerPage={rowsPerPage}
        page={page}
        onPageChange={handleChangePage}
        onRowsPerPageChange={handleChangeRowsPerPage}
        labelRowsPerPage="Filas por página:"
      />

      {/* Diálogo Creación */}
      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle>Iniciar Lote de Producción</DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                select fullWidth label="Receta"
                value={formData.receta_id}
                onChange={(e) => setFormData({...formData, receta_id: e.target.value})}
                margin="normal" required
              >
                {recetas.map(r => (
                  <MenuItem key={r.id} value={r.id}>
                    {r.nombre} ({r.producto_resultante.nombre})
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth type="number" label="Cantidad a Producir"
                value={formData.cantidad_a_producir}
                onChange={(e) => setFormData({...formData, cantidad_a_producir: e.target.value})}
                margin="normal" required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                select fullWidth label="Cliente (Solo para Maquila)"
                value={formData.cliente_id}
                onChange={(e) => setFormData({...formData, cliente_id: e.target.value})}
                margin="normal"
              >
                <MenuItem value="">Interno (Vialmar)</MenuItem>
                {clientes.map(c => <MenuItem key={c.id} value={c.id}>{c.nombre}</MenuItem>)}
              </TextField>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Cancelar</Button>
          <Button onClick={handleSubmit} variant="contained" disabled={loading}>Crear Lote</Button>
        </DialogActions>
      </Dialog>

      {/* Diálogo Confirmación Avanzada */}
      <Dialog open={openConfirm} onClose={handleCloseConfirm} maxWidth="xs" fullWidth>
        <DialogTitle>Finalizar Producción</DialogTitle>
        <DialogContent dividers>
          <Typography variant="subtitle2" color="primary">Lote #{selectedLote?.id}</Typography>
          <TextField
            fullWidth type="number" label="Cantidad Real Obtenida"
            value={confirmData.cantidad_real}
            onChange={(e) => setConfirmData({...confirmData, cantidad_real: e.target.value})}
            margin="normal" required
            helperText="Ingrese la cantidad final con mermas"
          />
          {selectedLote?.cliente_id && (
            <Box sx={{ mt: 2, p: 2, border: '1px dashed #ccc', borderRadius: 1 }}>
              <TextField
                fullWidth type="number" label="Precio de Servicio (Maquila)"
                value={confirmData.precio_maquila}
                onChange={(e) => setConfirmData({...confirmData, precio_maquila: e.target.value})}
                margin="normal" required
              />
            </Box>
          )}
          <TextField
            fullWidth label="Observaciones"
            value={confirmData.observaciones}
            onChange={(e) => setConfirmData({...confirmData, observaciones: e.target.value})}
            margin="normal" multiline rows={2}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseConfirm}>Cancelar</Button>
          <Button onClick={handleConfirmarFinal} variant="contained" color="success">Finalizar</Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
};

export default Lotes;
