import React, { useState, useEffect, useMemo } from 'react';
import { 
  Box, Typography, Button, Paper, Table, TableBody, TableCell, TableContainer, 
  TableHead, TableRow, IconButton, Dialog, DialogTitle, DialogContent, 
  DialogActions, TextField, MenuItem, Grid, Divider, useTheme, useMediaQuery,
  Card, CardContent, CardActions, TablePagination
} from '@mui/material';
import { Add, Delete, Edit, ReceiptLong } from '@mui/icons-material';
import { fetchRecetas, createReceta, deleteReceta } from '../api';
import apiClient from '../api';
import { toast } from 'react-toastify';
import ConfirmationDialog from './ConfirmationDialog';

const RecetaCard = ({ receta, handleDelete }) => {
  return (
    <Card sx={{ mb: 2 }}>
      <CardContent>
        <Typography variant="h6" color="text.primary">{receta.nombre}</Typography>
        <Typography color="textSecondary">Producto: {receta.producto_resultante.nombre}</Typography>
        <Typography variant="body2" sx={{ mt: 1 }}>
          <strong>Insumos:</strong><br />
          {receta.items.map(it => `${it.insumo.nombre} (${it.cantidad} ${it.insumo.unidad_medida})`).join(', ')}
        </Typography>
      </CardContent>
      <CardActions>
        <IconButton color="error" onClick={() => handleDelete(receta.id)}>
          <Delete />
        </IconButton>
      </CardActions>
    </Card>
  );
};

const Recetas = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
  const [recetas, setRecetas] = useState([]);
  const [productos, setProductos] = useState([]);
  const [insumos, setInsumos] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Paginación
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Confirmación borrado
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);

  const [formData, setFormData] = useState({
    producto_id: '',
    nombre: '',
    descripcion: '',
    servicio_maquila_id: '',
    items: [{ insumo_id: '', cantidad: '' }]
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [recResponse, prodResponse] = await Promise.all([
        fetchRecetas(),
        apiClient.get('/productos/')
      ]);
      setRecetas(recResponse.data);
      const allProds = prodResponse.data;
      setProductos(allProds);
      setInsumos(allProds.filter(p => !p.es_servicio));
    } catch (error) {
      toast.error("Error cargando recetas");
    }
  };

  const filteredRecetas = recetas.filter(r =>
    r.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.producto_resultante.nombre.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const paginatedRecetas = useMemo(() => {
    return filteredRecetas.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
  }, [filteredRecetas, page, rowsPerPage]);

  const handleChangePage = (event, newPage) => setPage(newPage);
  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleOpen = () => setOpen(true);
  const handleClose = () => {
    setOpen(false);
    setFormData({
      producto_id: '', nombre: '', descripcion: '', servicio_maquila_id: '',
      items: [{ insumo_id: '', cantidad: '' }]
    });
  };

  const addItem = () => {
    setFormData({ ...formData, items: [...formData.items, { insumo_id: '', cantidad: '' }] });
  };

  const removeItem = (index) => {
    const newItems = formData.items.filter((_, i) => i !== index);
    setFormData({ ...formData, items: newItems });
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...formData.items];
    newItems[index][field] = value;
    setFormData({ ...formData, items: newItems });
  };

  const handleSubmit = async () => {
    if (!formData.producto_id || formData.items.some(it => !it.insumo_id || !it.cantidad)) {
      toast.warning("Complete todos los campos requeridos");
      return;
    }
    setLoading(true);
    try {
      // Limpiar y parsear datos para el backend
      const payload = {
        ...formData,
        producto_id: parseInt(formData.producto_id),
        servicio_maquila_id: formData.servicio_maquila_id !== "" ? parseInt(formData.servicio_maquila_id) : null,
        items: formData.items.map(it => ({
          insumo_id: parseInt(it.insumo_id),
          cantidad: parseFloat(it.cantidad)
        }))
      };
      await createReceta(payload);
      toast.success("Receta creada correctamente");
      loadData();
      handleClose();
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.detail?.[0]?.msg || "Error al crear receta");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = (id) => {
    setItemToDelete(id);
    setShowConfirmDialog(true);
  };

  const confirmDelete = async () => {
    try {
      await deleteReceta(itemToDelete);
      toast.success("Receta eliminada");
      loadData();
    } catch (error) {
      toast.error("No se pudo eliminar la receta");
    } finally {
      setShowConfirmDialog(false);
      setItemToDelete(null);
    }
  };

  return (
    <Paper sx={{ mt: 4, p: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6" gutterBottom component="div">
          Gestión de Recetas (BOM)
        </Typography>
        <Button variant="contained" startIcon={<Add />} onClick={handleOpen} color="primary">
          Nueva Receta
        </Button>
      </Box>

      <TextField
        label="Buscar por nombre o producto..."
        variant="outlined"
        fullWidth
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        sx={{ mb: 2, mt: 1 }}
      />

      {isMobile ? (
        <Box sx={{ mt: 2 }}>
          {paginatedRecetas.map(r => (
            <RecetaCard key={r.id} receta={r} handleDelete={handleDeleteClick} />
          ))}
        </Box>
      ) : (
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 'bold' }}>Nombre</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Producto Resultante</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Insumos</TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold' }}>Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paginatedRecetas.map((r) => (
                <TableRow key={r.id} hover>
                  <TableCell>{r.nombre}</TableCell>
                  <TableCell>{r.producto_resultante.nombre}</TableCell>
                  <TableCell>
                    {r.items.map(it => `${it.insumo.nombre} (${it.cantidad})`).join(', ')}
                  </TableCell>
                  <TableCell align="right">
                    <IconButton color="error" onClick={() => handleDeleteClick(r.id)}>
                      <Delete />
                    </IconButton>
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
        count={filteredRecetas.length}
        rowsPerPage={rowsPerPage}
        page={page}
        onPageChange={handleChangePage}
        onRowsPerPageChange={handleChangeRowsPerPage}
        labelRowsPerPage="Filas por página:"
      />

      {/* Diálogo Formulario */}
      <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
        <DialogTitle>Definir Nueva Receta</DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField
                select fullWidth label="Producto a Producir"
                value={formData.producto_id}
                 sx={{ flexGrow: 1, minWidth: '200px' }}
                onChange={(e) => setFormData({...formData, producto_id: e.target.value})}
                margin="normal" required
              >
                {productos.map(p => <MenuItem key={p.id} value={p.id}>{p.nombre}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth label="Nombre de la Receta"
                value={formData.nombre}
                onChange={(e) => setFormData({...formData, nombre: e.target.value})}
                margin="normal" required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                select fullWidth label="Servicio de Maquila (Opcional)"
                value={formData.servicio_maquila_id}
                sx={{ flexGrow: 1, minWidth: '200px' }}
                onChange={(e) => setFormData({...formData, servicio_maquila_id: e.target.value})}
                margin="normal"
              >
                <MenuItem value="">N/A</MenuItem>
                {productos.filter(p => p.es_servicio).map(p => (
                  <MenuItem key={p.id} value={p.id}>{p.nombre}</MenuItem>
                ))}
              </TextField>
            </Grid>
          </Grid>
          <Box sx={{ mt: 3 }}>
            <Typography variant="subtitle1" gutterBottom>Insumos (por unidad)</Typography>
            <Divider sx={{ mb: 2 }} />
            {formData.items.map((item, index) => (
              <Grid container spacing={2} key={index} sx={{ mb: 1, alignItems: 'center' }}>
                <Grid item xs={7}>
                  <TextField
                    select fullWidth label="Insumo"
                    value={item.insumo_id}
                    sx={{ flexGrow: 1, minWidth: '200px' }}
                    onChange={(e) => handleItemChange(index, 'insumo_id', e.target.value)}
                  >
                    {insumos.map(p => <MenuItem key={p.id} value={p.id}>{p.nombre}</MenuItem>)}
                  </TextField>
                </Grid>
                <Grid item xs={3}>
                  <TextField
                    fullWidth type="number" label="Cant."
                    value={item.cantidad}
                    sx={{ flexGrow: 1, minWidth: '100px' }}
                    onChange={(e) => handleItemChange(index, 'cantidad', e.target.value)}
                  />
                </Grid>
                <Grid item xs={2}>
                  <IconButton color="error" onClick={() => removeItem(index)} disabled={formData.items.length === 1}>
                    <Delete />
                  </IconButton>
                </Grid>
              </Grid>
            ))}
            <Button startIcon={<Add />} onClick={addItem} size="small">Agregar Insumo</Button>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Cancelar</Button>
          <Button onClick={handleSubmit} variant="contained" disabled={loading}>Guardar</Button>
        </DialogActions>
      </Dialog>

      <ConfirmationDialog
        open={showConfirmDialog}
        handleClose={() => setShowConfirmDialog(false)}
        handleConfirm={confirmDelete}
        title="Eliminar Receta"
        message="¿Estás seguro de que quieres eliminar esta receta? Esta acción no se puede deshacer."
      />
    </Paper>
  );
};

export default Recetas;
