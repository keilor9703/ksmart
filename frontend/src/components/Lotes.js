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

  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const [formData, setFormData] = useState({ receta_id: '', cantidad_a_producir: '', cliente_id: '', observaciones: '' });
  const [confirmData, setConfirmData] = useState({
    cantidad_real: '', 
    precios_servicios: [], // Lista de { servicio_id, nombre, precio }
    observaciones: ''
  });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [lotResponse, recResponse, cliResponse] = await Promise.all([
        fetchLotes(), fetchRecetas(), apiClient.get('/clientes/')
      ]);
      setLotes(lotResponse.data);
      setRecetas(recResponse.data);
      setClientes(cliResponse.data);
    } catch (error) { toast.error("Error cargando lotes"); }
  };

  const handleOpenConfirm = (lote) => {
    setSelectedLote(lote);
    // Inicializar precios para los servicios de la receta
    const srvPrecios = lote.receta.servicios_maquila.map(s => ({
      servicio_id: s.servicio_id,
      nombre: s.servicio.nombre,
      precio: 0
    }));
    setConfirmData({
      cantidad_real: lote.cantidad_a_producir,
      precios_servicios: srvPrecios,
      observaciones: ''
    });
    setOpenConfirm(true);
  };

  const handlePrecioChange = (idx, val) => {
    const newPrecios = [...confirmData.precios_servicios];
    newPrecios[idx].precio = parseFloat(val) || 0;
    setConfirmData({ ...confirmData, precios_servicios: newPrecios });
  };

  const handleConfirmarFinal = async () => {
    setLoading(true);
    try {
      await confirmarLote(selectedLote.id, {
        cantidad_real: parseFloat(confirmData.cantidad_real),
        precios_servicios: confirmData.precios_servicios.map(p => ({ servicio_id: p.servicio_id, precio: p.precio })),
        observaciones: confirmData.observaciones
      });
      toast.success("Producción finalizada");
      loadData();
      setOpenConfirm(false);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error al confirmar");
    } finally { setLoading(false); }
  };

  const filteredLotes = lotes.filter(l =>
    l.id.toString().includes(searchTerm) ||
    l.receta.producto_resultante.nombre.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusChip = (status) => {
    const colors = { 'Borrador': 'default', 'Confirmado': 'success', 'Cancelado': 'error' };
    return <Chip label={status} color={colors[status] || 'default'} size="small" />;
  };

  return (
    <Paper sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h6">Lotes de Producción</Typography>
        <Button variant="contained" startIcon={<Add />} onClick={() => setOpen(true)}>Nuevo Lote</Button>
      </Box>

      <TextField
        label="Buscar..." variant="outlined" fullWidth
        value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
        sx={{ mb: 2 }}
      />

      {isMobile ? (
        <Box>{filteredLotes.map(l => <LoteCard key={l.id} lote={l} handleOpenConfirm={handleOpenConfirm} handleCancelar={async (id) => { await cancelarLote(id); loadData(); }} />)}</Box>
      ) : (
        <TableContainer>
          <Table>
            <TableHead sx={{ bgcolor: 'action.hover' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 'bold' }}>ID</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Fecha</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Producto</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Cantidad Real</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Costo Total</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Estado</TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold' }}>Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredLotes.map((l) => (
                <TableRow key={l.id} hover>
                  <TableCell>#{l.id}</TableCell>
                  <TableCell>{new Date(l.fecha_planificada).toLocaleDateString()}</TableCell>
                  <TableCell>{l.receta.producto_resultante.nombre}</TableCell>
                  <TableCell>{l.cantidad_real || '---'}</TableCell>
                  <TableCell>{l.costo_total > 0 ? `$${l.costo_total.toFixed(2)}` : '---'}</TableCell>
                  <TableCell>{getStatusChip(l.estado)}</TableCell>
                  <TableCell align="right">
                    {l.estado === 'Borrador' && (
                      <IconButton color="success" onClick={() => handleOpenConfirm(l)}><CheckCircle /></IconButton>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Diálogo Creación */}
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Nuevo Lote</DialogTitle>
        <DialogContent dividers>
          <TextField
            select fullWidth label="Receta"
            value={formData.receta_id}
            onChange={(e) => setFormData({...formData, receta_id: e.target.value})}
            margin="normal"
          >
            {recetas.map(r => <MenuItem key={r.id} value={r.id}>{r.nombre}</MenuItem>)}
          </TextField>
          <TextField
            fullWidth type="number" label="Cantidad a Producir"
            value={formData.cantidad_a_producir}
            onChange={(e) => setFormData({...formData, cantidad_a_producir: e.target.value})}
            margin="normal"
          />
          <TextField
            select fullWidth label="Cliente (Maquila)"
            value={formData.cliente_id}
            onChange={(e) => setFormData({...formData, cliente_id: e.target.value})}
            margin="normal"
          >
            <MenuItem value="">Interno (Vialmar)</MenuItem>
            {clientes.map(c => <MenuItem key={c.id} value={c.id}>{c.nombre}</MenuItem>)}
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={async () => { await createLote(formData); loadData(); setOpen(false); }} variant="contained">Crear</Button>
        </DialogActions>
      </Dialog>

      {/* Diálogo Confirmación con Precios de Múltiples Servicios */}
      <Dialog open={openConfirm} onClose={() => setOpenConfirm(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Finalizar Producción</DialogTitle>
        <DialogContent dividers>
          <TextField
            fullWidth type="number" label="Cantidad Real Obtenida"
            value={confirmData.cantidad_real}
            onChange={(e) => setConfirmData({...confirmData, cantidad_real: e.target.value})}
            margin="normal" required
          />
          
          {selectedLote?.cliente_id && confirmData.precios_servicios.length > 0 && (
            <Box sx={{ mt: 2, p: 2, border: '1px dashed #ccc', borderRadius: 1 }}>
              <Typography variant="subtitle2" color="primary" gutterBottom>PRECIOS DE MAQUILA POR SERVICIO</Typography>
              {confirmData.precios_servicios.map((srv, idx) => (
                <TextField
                  key={srv.servicio_id}
                  fullWidth type="number" 
                  label={`Precio: ${srv.nombre}`}
                  value={srv.precio}
                  onChange={(e) => handlePrecioChange(idx, e.target.value)}
                  margin="normal"
                  required
                />
              ))}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenConfirm(false)}>Cancelar</Button>
          <Button onClick={handleConfirmarFinal} variant="contained" color="success" disabled={loading}>Finalizar</Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
};

export default Lotes;
