import React, { useState, useEffect, useMemo } from 'react';
import { 
  Box, Typography, Button, Paper, Table, TableBody, TableCell, TableContainer, 
  TableHead, TableRow, IconButton, Dialog, DialogTitle, DialogContent, 
  DialogActions, TextField, MenuItem, Grid, Divider, useTheme, useMediaQuery,
  Card, CardContent, CardActions, TablePagination
} from '@mui/material';
import { Add, Delete, Edit } from '@mui/icons-material';
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
          <strong>Insumos:</strong> {receta.items.map(it => it.insumo.nombre).join(', ')}
        </Typography>
        <Typography variant="body2" color="primary">
          <strong>Servicios:</strong> {receta.servicios_maquila.map(s => s.servicio.nombre).join(', ') || 'N/A'}
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
  
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);

  const [formData, setFormData] = useState({
    producto_id: '', nombre: '', descripcion: '',
    servicios: [], // Lista de { servicio_id }
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
      setInsumos(allProds.filter(p => !p.es_servicio && (p.grupo_item === 1 || p.grupo_item === 4)));
    } catch (error) {
      toast.error("Error cargando recetas");
    }
  };

  const handleOpen = () => setOpen(true);
  const handleClose = () => {
    setOpen(false);
    setFormData({
      producto_id: '', nombre: '', descripcion: '', servicios: [],
      items: [{ insumo_id: '', cantidad: '' }]
    });
  };

  const addItem = () => setFormData({ ...formData, items: [...formData.items, { insumo_id: '', cantidad: '' }] });
  const addServicio = () => setFormData({ ...formData, servicios: [...formData.servicios, { servicio_id: '' }] });
  const removeItem = (index) => setFormData({ ...formData, items: formData.items.filter((_, i) => i !== index) });
  const removeServicio = (index) => setFormData({ ...formData, servicios: formData.servicios.filter((_, i) => i !== index) });

  const handleItemChange = (index, field, value) => {
    const newItems = [...formData.items];
    newItems[index][field] = value;
    setFormData({ ...formData, items: newItems });
  };

  const handleServicioChange = (index, value) => {
    const newSrv = [...formData.servicios];
    newSrv[index].servicio_id = value;
    setFormData({ ...formData, servicios: newSrv });
  };

  const handleSubmit = async () => {
    if (!formData.producto_id || formData.items.some(it => !it.insumo_id || !it.cantidad)) {
      toast.warning("Complete todos los campos requeridos");
      return;
    }
    setLoading(true);
    try {
      const payload = {
        ...formData,
        producto_id: parseInt(formData.producto_id),
        servicios: formData.servicios
          .filter(s => s.servicio_id !== "")
          .map(s => ({ servicio_id: parseInt(s.servicio_id) })),
        items: formData.items.map(it => ({
          insumo_id: parseInt(it.insumo_id),
          cantidad: parseFloat(it.cantidad)
        }))
      };
      await createReceta(payload);
      toast.success("Receta creada");
      loadData();
      handleClose();
    } catch (error) {
      toast.error(error.response?.data?.detail?.[0]?.msg || "Error al crear receta");
    } finally {
      setLoading(false);
    }
  };

  const filteredRecetas = recetas.filter(r =>
    r.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.producto_resultante.nombre.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Paper sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h6">Fórmulas de Producción (Recetas)</Typography>
        <Button variant="contained" startIcon={<Add />} onClick={handleOpen}>Nueva Receta</Button>
      </Box>

      <TextField
        label="Buscar..." variant="outlined" fullWidth
        value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
        sx={{ mb: 2 }}
      />

      {isMobile ? (
        <Box>{filteredRecetas.map(r => <RecetaCard key={r.id} receta={r} handleDelete={(id) => { setItemToDelete(id); setShowConfirmDialog(true); }} />)}</Box>
      ) : (
        <TableContainer>
          <Table>
            <TableHead sx={{ bgcolor: 'action.hover' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 'bold' }}>Nombre</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Producto Resultante</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Insumos</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Servicios Maquila</TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold' }}>Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredRecetas.map((r) => (
                <TableRow key={r.id} hover>
                  <TableCell>{r.nombre}</TableCell>
                  <TableCell>{r.producto_resultante.nombre}</TableCell>
                  <TableCell>{r.items.map(it => it.insumo.nombre).join(', ')}</TableCell>
                  <TableCell color="primary">{r.servicios_maquila.map(s => s.servicio.nombre).join(', ') || 'N/A'}</TableCell>
                  <TableCell align="right">
                    <IconButton color="error" onClick={() => { setItemToDelete(r.id); setShowConfirmDialog(true); }}><Delete /></IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

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
                {productos.filter(p => !p.es_servicio).map(p => <MenuItem key={p.id} value={p.id}>{p.nombre}</MenuItem>)}
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
          </Grid>

          <Box sx={{ mt: 3 }}>
            <Typography variant="subtitle1" fontWeight="bold">Servicios de Maquila Asociados</Typography>
            {formData.servicios.map((srv, idx) => (
              <Grid container spacing={2} key={idx} sx={{ mb: 1, alignItems: 'center' }}>
                <Grid item xs={10}>
                  <TextField
                    select fullWidth label="Servicio"
                    value={srv.servicio_id}
                    sx={{ flexGrow: 1, minWidth: '200px' }}
                    onChange={(e) => handleServicioChange(idx, e.target.value)}
                  >
                    {productos.filter(p => p.es_servicio).map(p => <MenuItem key={p.id} value={p.id}>{p.nombre}</MenuItem>)}
                  </TextField>
                </Grid>
                <Grid item xs={2}>
                  <IconButton color="error" onClick={() => removeServicio(idx)}><Delete /></IconButton>
                </Grid>
              </Grid>
            ))}
            <Button startIcon={<Add />} onClick={addServicio} size="small">Añadir Servicio de Maquila</Button>
          </Box>

          <Box sx={{ mt: 3 }}>
            <Typography variant="subtitle1" fontWeight="bold">Ingredientes / Insumos (Por unidad)</Typography>
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
                    onChange={(e) => handleItemChange(index, 'cantidad', e.target.value)}
                  />
                </Grid>
                <Grid item xs={2}>
                  <IconButton color="error" onClick={() => removeItem(index)} disabled={formData.items.length === 1}><Delete /></IconButton>
                </Grid>
              </Grid>
            ))}
            <Button startIcon={<Add />} onClick={addItem} size="small">Añadir Insumo</Button>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Cancelar</Button>
          <Button onClick={handleSubmit} variant="contained" disabled={loading}>Guardar Receta</Button>
        </DialogActions>
      </Dialog>

      <ConfirmationDialog
        open={showConfirmDialog}
        handleClose={() => setShowConfirmDialog(false)}
        handleConfirm={async () => {
          try {
            await deleteReceta(itemToDelete);
            toast.success("Receta eliminada");
            loadData();
          } catch {
            toast.error("Error al eliminar");
          } finally {
            setShowConfirmDialog(false);
          }
        }}
        title="Eliminar Receta"
        message="¿Estás seguro?"
      />
    </Paper>
  );
};

export default Recetas;
