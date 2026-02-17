import React, { useState, useEffect } from 'react';
import apiClient from '../api';
import { formatCurrency } from '../utils/formatters';
import { toast } from 'react-toastify';
import ConfirmationDialog from './ConfirmationDialog';

import {
  Table, TableBody, TableCell, TableContainer, TablePagination,
  TableHead, TableRow, Paper, IconButton, Typography,
  useMediaQuery, useTheme, Card, CardContent, CardActions,
  Box, TextField, Chip,Button   
} from '@mui/material';
import { Edit, Delete } from '@mui/icons-material';

const ProductoCard = ({ producto, onEditProducto, handleDelete }) => {
  const stockActual = producto.stock_actual ?? 0;
  const stockMinimo = producto.stock_minimo ?? 0;
  const isService = !!producto.es_servicio;
  const low = !isService && stockActual < stockMinimo;

  return (
    <Card sx={{ mb: 2 }}>
      <CardContent>
        <Typography variant="h6" color="text.primary">{producto.nombre}</Typography>
        <Typography color="textSecondary">ID: {producto.id}</Typography>
        <Typography color="text.primary">Unidad de Medida: {producto.unidad_medida}</Typography>
        <Typography color="text.primary">Precio: {formatCurrency(producto.precio)}</Typography>
        <Typography color="text.primary">Tipo: {isService ? 'Servicio' : 'Producto'}</Typography>

        {!isService && (
          <Box sx={{ mt: 1 }}>
            <Chip
              label={`Stock: ${stockActual} / ${stockMinimo}`}
              color={low ? 'error' : 'success'}
              size="small"
              variant={low ? 'filled' : 'outlined'}
            />
          </Box>
        )}
      </CardContent>
      <CardActions>
        <IconButton onClick={() => onEditProducto(producto)} color="primary">
          <Edit />
        </IconButton>
        <IconButton onClick={() => handleDelete(producto.id)} color="error">
          <Delete />
        </IconButton>
      </CardActions>
    </Card>
  );
};

const ProductoList = ({ onEditProducto, onProductoDeleted }) => {
  const [productos, setProductos] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [productoToDelete, setProductoToDelete] = useState(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  useEffect(() => {
    fetchProductos();
  }, []);

  const fetchProductos = () => {
    apiClient.get('/productos/')
      .then(response => {
        setProductos(response.data);
      })
      .catch(error => console.error('Error fetching productos:', error));
  };

  const handleDelete = (id) => {
    setProductoToDelete(id);
    setShowConfirmDialog(true);
  };

  const confirmDelete = () => {
    apiClient.delete(`/productos/${productoToDelete}`)
      .then(() => {
        toast.success('Producto/Servicio eliminado!');
        fetchProductos();
        if (onProductoDeleted) {
          onProductoDeleted();
        }
      })
      .catch(() => {
        toast.error('Error al eliminar el producto/servicio.');
      })
      .finally(() => {
        setShowConfirmDialog(false);
        setProductoToDelete(null);
      });
  };

  const handleExport = async (formato) => {
  try {
    const response = await apiClient.get(`/productos/export?formato=${formato}`, {
      responseType: 'blob', // 👈 importante para descargar binarios
    });

    // Crear un enlace temporal y forzar la descarga
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `productos.${formato}`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  } catch (err) {
    console.error(err);
    toast.error("Error al exportar productos");
  }
};


  const filteredProductos = productos.filter(producto =>
    producto.nombre.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const paginatedProductos = React.useMemo(() => {
    return filteredProductos.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
  }, [filteredProductos, page, rowsPerPage]);

  return (
        <Paper sx={{ mt: 4, p: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 3, mb: 2 }}>
      <Typography variant="h6" gutterBottom component="div">
        Lista de Productos
      </Typography>
      <Box>
        <Button 
          variant="outlined" 
          onClick={() => handleExport("csv")}
          sx={{ mr: 1 }}
        >
          Exportar CSV
        </Button>
        <Button 
          variant="outlined" 
          onClick={() => handleExport("xlsx")}
        >
          Exportar Excel
        </Button>

      </Box>
    </Box>


      <TextField
        label="Buscar Producto"
        variant="outlined"
        fullWidth
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        sx={{ mb: 2, mt: 1 }}
      />
      
      {isMobile ? (
        <Box sx={{ p: 2 }}>
          {paginatedProductos.map(producto => (
            <ProductoCard
              key={producto.id}
              producto={producto}
              onEditProducto={onEditProducto}
              handleDelete={handleDelete}
            />
          ))}
        </Box>
      ) : (
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>ID</TableCell>
                <TableCell>Nombre</TableCell>
                <TableCell>Unidad de Medida</TableCell>
                <TableCell>Precio</TableCell>
                <TableCell>Stock</TableCell> {/* 👈 nueva columna */}
                <TableCell>Tipo</TableCell>
                <TableCell>Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paginatedProductos.map(producto => {
                const stockActual = producto.stock_actual ?? 0;
                const stockMinimo = producto.stock_minimo ?? 0;
                const isService = !!producto.es_servicio;
                const low = !isService && stockActual < stockMinimo;

                return (
                  <TableRow key={producto.id}>
                    <TableCell>{producto.id}</TableCell>
                    <TableCell>{producto.nombre}</TableCell>
                    <TableCell>{producto.unidad_medida}</TableCell>
                    <TableCell>{formatCurrency(producto.precio)}</TableCell>
                    <TableCell>
                      {isService ? '—' : (
                        <Chip
                          label={`${stockActual} / ${stockMinimo}`}
                          color={low ? 'error' : 'success'}
                          size="small"
                          variant={low ? 'filled' : 'outlined'}
                        />
                      )}
                    </TableCell>
                    <TableCell>{isService ? 'Servicio' : 'Producto'}</TableCell>
                    <TableCell>
                      <IconButton onClick={() => onEditProducto(producto)} color="primary">
                        <Edit />
                      </IconButton>
                      <IconButton onClick={() => handleDelete(producto.id)} color="error">
                        <Delete />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <TablePagination
        rowsPerPageOptions={[5, 10, 25]}
        component="div"
        count={filteredProductos.length}
        rowsPerPage={rowsPerPage}
        page={page}
        onPageChange={handleChangePage}
        onRowsPerPageChange={handleChangeRowsPerPage}
        labelRowsPerPage="Filas por página:"
        labelDisplayedRows={({ from, to, count }) =>
          `${from}-${to} de ${count !== -1 ? count : `más de ${to}`}`
        }
      />

      <ConfirmationDialog
        open={showConfirmDialog}
        handleClose={() => setShowConfirmDialog(false)}
        handleConfirm={confirmDelete}
        title="Confirmar Eliminación"
        message="¿Estás seguro de que quieres eliminar este producto/servicio? Esta acción no se puede deshacer."
      />
    </Paper>
  );
};

export default ProductoList;
