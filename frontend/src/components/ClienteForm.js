import React, { useState, useEffect } from 'react';
import apiClient from '../api';
import { toast } from 'react-toastify';
import { Button, TextField, Box, Typography, Grid, InputAdornment, Accordion, AccordionSummary, AccordionDetails, FormControlLabel, Checkbox } from '@mui/material';
import { Edit, Delete, ExpandMore } from '@mui/icons-material';
import BulkUpload from './BulkUpload'; // ✅ importamos el cargue masivo


const ClienteForm = ({ onClienteAdded, clienteToEdit, onClienteUpdated }) => {
    const [nombre, setNombre] = useState('');
    const [cedula, setCedula] = useState('');
    const [telefono, setTelefono] = useState('');
    const [direccion, setDireccion] = useState('');
    const [cupoCredito, setCupoCredito] = useState('');
    const [esCliente, setEsCliente] = useState(true);
    const [esProveedor, setEsProveedor] = useState(false);
    const [clientes, setClientes] = useState([]);
    

     useEffect(() => {
        fetchClientes();
    }, []);

    const fetchClientes = () => {
        apiClient.get('/clientes/')
            .then(response => setClientes(response.data))
            .catch(error => console.error('Error fetching clientes:', error));
    };

    useEffect(() => {
        if (clienteToEdit) {
            setNombre(clienteToEdit.nombre);
            setCedula(clienteToEdit.cedula || '');
            setTelefono(clienteToEdit.telefono || '');
            setDireccion(clienteToEdit.direccion || '');
            setCupoCredito(clienteToEdit.cupo_credito || '');
            setEsCliente(clienteToEdit.es_cliente ?? true);
            setEsProveedor(clienteToEdit.es_proveedor ?? false);
        } else {
            setNombre('');
            setCedula('');
            setTelefono('');
            setDireccion('');
            setCupoCredito('');
            setEsCliente(true);
            setEsProveedor(false);
        }
    }, [clienteToEdit]);
    
    const accordionStyles = {
    mt: 3,
    borderRadius: 2,
    boxShadow: 2,
    '&:before': { display: 'none' } // 🔹 quita la línea fea por defecto
    };


    const handleSubmit = (e) => {
        e.preventDefault();
        
        if (!esCliente && !esProveedor) {
            toast.warning("El tercero debe ser al menos Cliente o Proveedor.");
            return;
        }

        const clienteData = {
            nombre,
            cedula,
            telefono,
            direccion,
            cupo_credito: parseFloat(cupoCredito) || 0,
            es_cliente: esCliente,
            es_proveedor: esProveedor
        };

        const request = clienteToEdit
            ? apiClient.put(`/clientes/${clienteToEdit.id}`, clienteData)
            : apiClient.post('/clientes/', clienteData);

        request.then(response => {
            toast.success(`Tercero ${clienteToEdit ? 'actualizado' : 'agregado'}!`);
            if (clienteToEdit) {
                onClienteUpdated(response.data);
            } else {
                setNombre('');
                setCedula('');
                setTelefono('');
                setDireccion('');
                setCupoCredito('');
                setEsCliente(true);
                setEsProveedor(false);
                onClienteAdded(response.data);
            }
        }).catch(error => {
            console.error(`Error ${clienteToEdit ? 'updating' : 'creating'} tercero:`, error);
            toast.error(`Error al ${clienteToEdit ? 'actualizar' : 'agregar'} el tercero.`);
        });
    };


return (
  <Box component="form" onSubmit={handleSubmit} sx={{ mb: 4 }}>
    {/* ⬇️ Acordeón para Nuevo Cliente */}
    <Accordion
      
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
        sx={{ minHeight: 48, "& .MuiAccordionSummary-content": { margin: 0 } }}
      >
        <Typography variant="subtitle1" fontWeight="bold" color="text.primary">
          {clienteToEdit ? "Editar Tercero" : "Agregar Nuevo Tercero"}
        </Typography>
      </AccordionSummary>

      <AccordionDetails>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Nombre / Razón Social"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              fullWidth
              required
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField
              label="Cédula / NIT"
              value={cedula}
              onChange={(e) => setCedula(e.target.value)}
              fullWidth
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField
              label="Teléfono"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              fullWidth
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField
              label="Dirección"
              value={direccion}
              onChange={(e) => setDireccion(e.target.value)}
              fullWidth
            />
          </Grid>

          <Grid item xs={12} sm={4}>
            <TextField
              label="Cupo de Crédito (Clientes)"
              value={cupoCredito}
              onChange={(e) =>
                setCupoCredito(e.target.value.replace(/[^0-9.]/g, ""))
              }
              fullWidth
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">$</InputAdornment>
                )
              }}
            />
          </Grid>

          <Grid item xs={12} sm={4}>
            <FormControlLabel
              control={<Checkbox checked={esCliente} onChange={(e) => setEsCliente(e.target.checked)} />}
              label="Es Cliente"
            />
          </Grid>

          <Grid item xs={12} sm={4}>
            <FormControlLabel
              control={<Checkbox checked={esProveedor} onChange={(e) => setEsProveedor(e.target.checked)} />}
              label="Es Proveedor"
            />
          </Grid>

          <Grid item xs={12}>
            <Button type="submit" variant="contained">
              {clienteToEdit ? "Actualizar Tercero" : "Agregar Tercero"}
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
          Carga Masiva de Terceros (Clientes/Proveedores)
        </Typography>
      </AccordionSummary>

      <AccordionDetails>
        <BulkUpload uploadType="clientes" onUploadSuccess={fetchClientes} />
      </AccordionDetails>
    </Accordion>
  </Box>
);

};

export default ClienteForm;
