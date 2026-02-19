import React, { useState, useEffect } from 'react';
import apiClient from '../api';
import { toast } from 'react-toastify';
import {
  Button, TextField, Box, Typography, Grid, FormControl, InputLabel, Select, MenuItem,
  Checkbox, FormControlLabel, InputAdornment, Accordion, AccordionSummary, AccordionDetails
} from '@mui/material';
import { ExpandMore } from '@mui/icons-material';
import BulkUpload from './BulkUpload'; // ✅ cargue masivo

const ProductoForm = ({ onProductoAdded, productoToEdit, onProductoUpdated }) => {
  const [nombre, setNombre] = useState('');
  const [precio, setPrecio] = useState('');
  const [costo, setCosto] = useState('');
  const [esServicio, setEsServicio] = useState(false);
  const [unidadMedida, setUnidadMedida] = useState('UND');
  const [grupoItem, setGrupoItem] = useState(2);

  // 👇 nuevos estados de inventario
  const [stockMinimo, setStockMinimo] = useState('');
  const [stockActual, setStockActual] = useState(0);

  const [productos, setProductos] = useState([]);

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

  useEffect(() => {
    if (productoToEdit) {
      setNombre(productoToEdit.nombre);
      setPrecio(productoToEdit.precio);
      setCosto(productoToEdit.costo || '');
      setEsServicio(productoToEdit.es_servicio);
      setUnidadMedida(productoToEdit.unidad_medida || 'UND');
      setGrupoItem(productoToEdit.grupo_item || 2);

      // ⬇️ inventario
      setStockMinimo(
        productoToEdit.stock_minimo !== undefined && productoToEdit.stock_minimo !== null
          ? String(productoToEdit.stock_minimo)
          : ''
      );
      setStockActual(productoToEdit.stock_actual ?? 0);
    } else {
      setNombre('');
      setPrecio('');
      setCosto('');
      setEsServicio(false);
      setUnidadMedida('UND');
      setGrupoItem(2);

      // ⬇️ inventario
      setStockMinimo('');
      setStockActual(0);
    }
  }, [productoToEdit]);

  const handleSubmit = (e) => {
    e.preventDefault();

    const productoData = {
      nombre,
      precio: parseFloat(precio),
      costo: parseFloat(costo) || 0.0,
      es_servicio: esServicio,
      unidad_medida: unidadMedida,
      grupo_item: parseInt(grupoItem),
      // ⬇️ guardamos el stock mínimo (el stock actual se mueve por movimientos)
      stock_minimo: stockMinimo === '' ? 0 : parseFloat(stockMinimo)
    };

    const request = productoToEdit
      ? apiClient.put(`/productos/${productoToEdit.id}`, productoData)
      : apiClient.post('/productos/', productoData);

    request.then(response => {
      toast.success(`Producto ${productoToEdit ? 'actualizado' : 'agregado'}!`);
      if (productoToEdit) {
        onProductoUpdated(response.data);
      } else {
        setNombre('');
        setPrecio('');
        setCosto('');
        setEsServicio(false);
        setUnidadMedida('UND');
        setGrupoItem(2);
        setStockMinimo('');
        setStockActual(0);
        onProductoAdded(response.data);
      }
    }).catch(error => {
      console.error(`Error ${productoToEdit ? 'updating' : 'creating'} producto:`, error);
      toast.error(`Error al ${productoToEdit ? 'actualizar' : 'agregar'} el producto.`);
    });
  };


return (
  <Box component="form" onSubmit={handleSubmit} sx={{ mb: 4 }}>
    {/* ⬇️ Acordeón para Nuevo Producto */}
    <Accordion
      // defaultExpanded
      sx={{
        mb: 2,
        borderRadius: 2,
        boxShadow: 2,
        overflow: "hidden",
        "&:before": { display: "none" }
      }}
    >
      <AccordionSummary
        expandIcon={<ExpandMore />}
        sx={{
          minHeight: 48,
          "& .MuiAccordionSummary-content": { margin: 0 }
        }}
      >
        <Typography variant="subtitle1" fontWeight="bold" color="text.primary">
          {productoToEdit
            ? "Editar Producto/Servicio"
            : "Agregar Nuevo Producto/Servicio"}
        </Typography>
      </AccordionSummary>

      <AccordionDetails>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              fullWidth
              required
            />
          </Grid>

          <Grid item xs={12} sm={4}>
            <TextField
              label="Precio de Venta"
              value={precio}
              onChange={(e) =>
                setPrecio(e.target.value.replace(/[^0-9.]/g, ""))
              }
              fullWidth
              required
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">$</InputAdornment>
                )
              }}
            />
          </Grid>

          <Grid item xs={12} sm={4}>
            <TextField
              label="Costo"
              value={costo}
              onChange={(e) =>
                setCosto(e.target.value.replace(/[^0-9.]/g, ""))
              }
              fullWidth
              required
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">$</InputAdornment>
                )
              }}
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <FormControl fullWidth>
              <InputLabel>Grupo de Item</InputLabel>
              <Select
                value={grupoItem}
                label="Grupo de Item"
                onChange={(e) => setGrupoItem(e.target.value)}
                required
              >
                <MenuItem value={1}>MP — Materia Prima</MenuItem>
                <MenuItem value={2}>PT — Producto Terminado</MenuItem>
                <MenuItem value={3}>AF — Activo Fijo</MenuItem>
                <MenuItem value={4}>INS — Insumos</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} sm={6}>
            <FormControl fullWidth>
              <InputLabel>Unidad de Medida</InputLabel>
              <Select
                value={unidadMedida}
                label="Unidad de Medida"
                onChange={(e) => setUnidadMedida(e.target.value)}
              >
                <MenuItem value="UND">Unidad (Und)</MenuItem>
                <MenuItem value="MTS">Metros (Mts)</MenuItem>
                <MenuItem value="Kg">Kilos (Kg)</MenuItem>
                <MenuItem value="Gr">Gramos (Gr)</MenuItem>
                <MenuItem value="PAR">Pares</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} sm={2}>
            <TextField
              label="Stock mínimo"
              value={stockMinimo}
              onChange={(e) =>
                setStockMinimo(e.target.value.replace(/[^0-9.]/g, ""))
              }
              fullWidth
              helperText="Alerta cuando el stock actual sea menor"
            />
          </Grid>

          <Grid item xs={12} sm={2}>
            <TextField
              label="Stock actual"
              value={stockActual}
              fullWidth
              InputProps={{ readOnly: true }}
              helperText="Se actualiza automáticamente con movimientos"
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={esServicio}
                  onChange={(e) => setEsServicio(e.target.checked)}
                />
              }
              label={
                <Typography color="text.primary">Es un Servicio</Typography>
              }
            />
          </Grid>

          <Grid item xs={12}>
            <Button type="submit" variant="contained">
              {productoToEdit ? "Actualizar Producto" : "Agregar Producto"}
            </Button>
          </Grid>
        </Grid>
      </AccordionDetails>
    </Accordion>

    {/* ⬇️ Acordeón para carga masiva */}
    <Accordion
      sx={{
        mt: 1,
        borderRadius: 2,
        boxShadow: 2,
        overflow: "hidden",
        "&:before": { display: "none" }
      }}
    >
      <AccordionSummary
        expandIcon={<ExpandMore />}
        sx={{ minHeight: 48, "& .MuiAccordionSummary-content": { margin: 0 } }}
      >
        <Typography variant="subtitle1" fontWeight="bold" color="text.primary">
          Carga Masiva de Productos
        </Typography>
      </AccordionSummary>

      <AccordionDetails>
        <BulkUpload uploadType="productos" onUploadSuccess={fetchProductos} />
      </AccordionDetails>
    </Accordion>
  </Box>
);

};

export default ProductoForm;
