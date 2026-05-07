import React, { useState, useEffect, useMemo } from 'react';
import apiClient from '../../api';
import { formatCurrency } from '../../utils/formatters';
import { toast } from 'react-toastify';
import ConfirmationDialog from '../../components/common/ConfirmationDialog';
import ClienteFinancialHistoryDialog from './ClienteFinancialHistoryDialog';
import {
  Box, Paper, Typography, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, IconButton, useMediaQuery, useTheme,
  TextField, TablePagination, Tooltip, InputAdornment, Chip, Grid, Divider
} from '@mui/material';
import { Edit, Delete, History, Search, Person, Business, CreditCard, LocationOn } from '@mui/icons-material'; // ✅ Añadido LocationOn

const ACCENT = '#3B82F6';
const GREEN  = '#10B981';

// ─── Card mobile ──────────────────────────────────────────────────────────────
const ClienteCard = ({ cliente, onEditCliente, handleDelete, handleViewHistory, handleAbrirMapa, filterType }) => (
  <Paper sx={{ p: 2, mb: 2, borderRadius: 3, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
    {/* Fila 1: nombre + id */}
    <Box sx={{ mb: 1 }}>
      <Typography sx={{ fontWeight: 700, fontSize: 14, lineHeight: 1.3 }}>{cliente.nombre}</Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, mt: 0.4, flexWrap: 'wrap' }}>
        <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
          {cliente.cedula || 'Sin cédula'} · #{cliente.id}
        </Typography>
        {cliente.es_cliente   && <Chip label="Cliente"   size="small" sx={{ height: 16, fontSize: 9, fontWeight: 700, bgcolor: `${ACCENT}18`, color: ACCENT,  borderRadius: 1 }} />}
        {cliente.es_proveedor && <Chip label="Proveedor" size="small" sx={{ height: 16, fontSize: 9, fontWeight: 700, bgcolor: `${GREEN}18`,  color: GREEN,   borderRadius: 1 }} />}
      </Box>
    </Box>

    <Divider sx={{ my: 1 }} />

    {/* Fila 2: datos clave */}
    <Grid container spacing={1} sx={{ mb: 1.5 }}>
      <Grid item xs={6}>
        <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>Teléfono</Typography>
        <Typography sx={{ fontSize: 12, fontWeight: 600 }}>{cliente.telefono || 'N/A'}</Typography>
      </Grid>
      <Grid item xs={6}>
        <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>Dirección</Typography>
        <Typography sx={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {cliente.direccion || 'N/A'}
        </Typography>
      </Grid>
      {filterType === 'cliente' && (
        <Grid item xs={12}>
          <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>Cupo de crédito</Typography>
          <Typography sx={{ fontSize: 13, fontWeight: 700, color: ACCENT }}>{formatCurrency(cliente.cupo_credito)}</Typography>
        </Grid>
      )}
    </Grid>

    {/* Fila 3: botones */}
    <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
      {/* ✅ NUEVO BOTÓN DE MAPA (MÓVIL) */}
      <Tooltip title="Ver en Mapa">
        <IconButton size="small" onClick={() => handleAbrirMapa(cliente.direccion)}
          sx={{ color: '#0ea5e9', bgcolor: 'rgba(14, 165, 233, 0.1)', borderRadius: 1.5 }}>
          <LocationOn fontSize="small" />
        </IconButton>
      </Tooltip>
      
      <Tooltip title="Historial financiero">
        <IconButton size="small" onClick={() => handleViewHistory(cliente)}
          sx={{ color: '#8B5CF6', bgcolor: 'rgba(139,92,246,0.1)', borderRadius: 1.5 }}>
          <History fontSize="small" />
        </IconButton>
      </Tooltip>
      <Tooltip title="Editar">
        <IconButton size="small" onClick={() => onEditCliente(cliente)}
          sx={{ color: ACCENT, bgcolor: `${ACCENT}12`, borderRadius: 1.5 }}>
          <Edit fontSize="small" />
        </IconButton>
      </Tooltip>
      <Tooltip title="Eliminar">
        <IconButton size="small" onClick={() => handleDelete(cliente.id)}
          sx={{ color: '#EF4444', bgcolor: '#FEF2F2', borderRadius: 1.5 }}>
          <Delete fontSize="small" />
        </IconButton>
      </Tooltip>
    </Box>
  </Paper>
);

// ─── Componente principal ──────────────────────────────────────────────────────
const ClienteList = ({ onEditCliente, onClienteDeleted, filterType, accentColor = ACCENT }) => {
  const [clientes, setClientes]   = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

  const theme    = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [clienteToDelete, setClienteToDelete]     = useState(null);
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  const [selectedClienteForHistory, setSelectedClienteForHistory] = useState(null);

  const [page, setPage]               = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  useEffect(() => { fetchClientes(); }, []);

  const fetchClientes = () =>
    apiClient.get('/clientes/')
      .then(r => setClientes(r.data))
      .catch(() => toast.error('Error al cargar terceros'));

  const handleDelete = (id) => { setClienteToDelete(id); setShowConfirmDialog(true); };

  const confirmDelete = () => {
    apiClient.delete(`/clientes/${clienteToDelete}`)
      .then(() => {
        toast.success('Tercero eliminado exitosamente');
        fetchClientes();
        if (onClienteDeleted) onClienteDeleted();
      })
      .catch(err => {
        const msg = err.response?.data?.detail || 'Error al eliminar el tercero.';
        toast.error(msg, { autoClose: 7000 });
      })
      .finally(() => { setShowConfirmDialog(false); setClienteToDelete(null); });
  };

  const handleViewHistory  = (c) => { setSelectedClienteForHistory(c); setShowHistoryDialog(true); };
  const handleCloseHistory = ()  => { setShowHistoryDialog(false); setSelectedClienteForHistory(null); };

  // ✅ FUNCIÓN PARA ABRIR GOOGLE MAPS
  const handleAbrirMapa = (direccion) => {
    if (!direccion || direccion.trim() === '') {
      toast.warning("Este cliente no tiene una dirección registrada.");
      return;
    }
    
    // Concatenamos la ciudad por defecto para mejorar la precisión del GPS
    const direccionCompleta = `${direccion}, Cali, Colombia`;
    const queryCodificada = encodeURIComponent(direccionCompleta);
    
    // URL Universal de Búsqueda de Google Maps (Fuerza la apertura de la app en celulares)
    const urlMapa = `https://www.google.com/maps/search/?api=1&query=${queryCodificada}`;
    
    window.open(urlMapa, '_blank');
  };

  // Filtrado + ordenado
  const filteredClientes = useMemo(() => {
    let list = clientes;
    if (filterType === 'cliente')   list = list.filter(c => c.es_cliente);
    if (filterType === 'proveedor') list = list.filter(c => c.es_proveedor);

    if (!searchTerm) return list;
    const q = searchTerm.toLowerCase();
    return list.filter(c =>
      c.nombre.toLowerCase().includes(q) ||
      (c.cedula    && c.cedula.toLowerCase().includes(q))   ||
      (c.telefono  && c.telefono.toLowerCase().includes(q)) ||
      (c.direccion && c.direccion.toLowerCase().includes(q))
    );
  }, [clientes, searchTerm, filterType]);

  const paginatedClientes = useMemo(() =>
    [...filteredClientes]
      .sort((a, b) => a.nombre.localeCompare(b.nombre))
      .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage),
    [filteredClientes, page, rowsPerPage]
  );

  const label = filterType === 'proveedor' ? 'proveedores' : 'clientes';

  return (
    <Box sx={{ width: '100%', maxWidth: '100%' }}>

      {/* Stats rápidas */}
      <Box sx={{ display: 'flex', gap: 1.5, mb: 2, flexWrap: 'wrap' }}>
        {[
          { label: `Total ${label}`, val: filteredClientes.length, icon: filterType === 'proveedor' ? <Business fontSize="small" /> : <Person fontSize="small" />, color: accentColor },
          ...(filterType === 'cliente'
            ? [{ label: 'Con crédito', val: filteredClientes.filter(c => c.cupo_credito > 0).length, icon: <CreditCard fontSize="small" />, color: GREEN }]
            : []),
        ].map(({ label: l, val, icon, color }) => (
          <Box key={l} sx={{
            display: 'flex', alignItems: 'center', gap: 1,
            px: 1.5, py: 1, borderRadius: 2,
            bgcolor: `${color}0D`, border: `1px solid ${color}25`,
          }}>
            <Box sx={{ color, display: 'flex' }}>{icon}</Box>
            <Box>
              <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>{l}</Typography>
              <Typography sx={{ fontWeight: 700, fontSize: 16, color }}>{val}</Typography>
            </Box>
          </Box>
        ))}
      </Box>

      {/* Buscador */}
      <Box sx={{ mb: 2 }}>
        <TextField
          fullWidth
          placeholder={`Buscar ${label} por nombre, cédula, teléfono…`}
          value={searchTerm}
          onChange={(e) => { setSearchTerm(e.target.value); setPage(0); }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search sx={{ color: 'text.secondary', fontSize: 20 }} />
              </InputAdornment>
            ),
          }}
        />
      </Box>

      {/* Lista */}
      {isMobile ? (
        <Box>
          {paginatedClientes.length === 0
            ? <Box sx={{ textAlign: 'center', py: 6, color: 'text.secondary' }}>
                <Person sx={{ fontSize: 48, mb: 1, opacity: 0.3 }} />
                <Typography>No se encontraron {label}</Typography>
              </Box>
            : paginatedClientes.map(c => (
                <ClienteCard
                  key={c.id}
                  cliente={c}
                  onEditCliente={onEditCliente}
                  handleDelete={handleDelete}
                  handleViewHistory={handleViewHistory}
                  handleAbrirMapa={handleAbrirMapa} // ✅ Pasamos la función a la tarjeta móvil
                  filterType={filterType}
                />
              ))
          }
        </Box>
      ) : (
        <TableContainer sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                {['ID', 'Nombre / Razón Social', 'Cédula / NIT', 'Teléfono', 'Dirección',
                  ...(filterType === 'cliente' ? ['Cupo Crédito'] : []),
                  'Tipo', 'Acciones'
                ].map(h => <TableCell key={h}>{h}</TableCell>)}
              </TableRow>
            </TableHead>
            <TableBody>
              {paginatedClientes.length === 0
                ? <TableRow>
                    <TableCell colSpan={8} sx={{ textAlign: 'center', py: 6, color: 'text.secondary' }}>
                      No se encontraron {label}
                    </TableCell>
                  </TableRow>
                : paginatedClientes.map(c => (
                    <TableRow key={c.id} hover>
                      <TableCell sx={{ fontWeight: 600, color: 'text.secondary', fontSize: 12 }}>#{c.id}</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>{c.nombre}</TableCell>
                      <TableCell sx={{ fontSize: 12, color: 'text.secondary' }}>{c.cedula || 'N/A'}</TableCell>
                      <TableCell sx={{ fontSize: 12 }}>{c.telefono || 'N/A'}</TableCell>
                      <TableCell sx={{ fontSize: 12, color: 'text.secondary' }}>{c.direccion || 'N/A'}</TableCell>
                      {filterType === 'cliente' && (
                        <TableCell sx={{ fontWeight: 600, color: c.cupo_credito > 0 ? accentColor : 'text.secondary' }}>
                          {formatCurrency(c.cupo_credito)}
                        </TableCell>
                      )}
                      <TableCell>
                        <Box sx={{ display: 'flex', gap: 0.5 }}>
                          {c.es_cliente   && <Chip label="Cliente"   size="small" sx={{ bgcolor: `${ACCENT}18`, color: ACCENT, fontWeight: 600, fontSize: 10, borderRadius: 1 }} />}
                          {c.es_proveedor && <Chip label="Proveedor" size="small" sx={{ bgcolor: `${GREEN}18`,  color: GREEN,  fontWeight: 600, fontSize: 10, borderRadius: 1 }} />}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', gap: 0.5 }}>
                          {/* ✅ NUEVO BOTÓN DE MAPA (ESCRITORIO) */}
                          <Tooltip title="Ver en Mapa">
                            <IconButton size="small" onClick={() => handleAbrirMapa(c.direccion)}
                              sx={{ color: '#0ea5e9', '&:hover': { bgcolor: 'rgba(14, 165, 233, 0.1)' } }}>
                              <LocationOn fontSize="small" />
                            </IconButton>
                          </Tooltip>

                          <Tooltip title="Historial financiero">
                            <IconButton size="small" onClick={() => handleViewHistory(c)}
                              sx={{ color: '#8B5CF6', '&:hover': { bgcolor: 'rgba(139,92,246,0.1)' } }}>
                              <History fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Editar">
                            <IconButton size="small" onClick={() => onEditCliente(c)}
                              sx={{ color: accentColor, '&:hover': { bgcolor: `${accentColor}12` } }}>
                              <Edit fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Eliminar">
                            <IconButton size="small" onClick={() => handleDelete(c.id)}
                              sx={{ color: '#EF4444', '&:hover': { bgcolor: '#FEF2F2' } }}>
                              <Delete fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))
              }
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <TablePagination
        rowsPerPageOptions={[5, 10, 25]}
        component="div"
        count={filteredClientes.length}
        rowsPerPage={rowsPerPage}
        page={page}
        onPageChange={(_, p) => setPage(p)}
        onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
        labelRowsPerPage="Filas:"
        labelDisplayedRows={({ from, to, count }) => `${from}-${to}/${count}`}
        sx={{
          '& .MuiTablePagination-toolbar': { flexWrap: 'wrap', pl: 0 },
          '& .MuiTablePagination-spacer': { display: 'none' },
          '& .MuiTablePagination-displayedRows': { fontSize: 11 },
          '& .MuiTablePagination-selectLabel': { fontSize: 11 },
        }}
      />

      <ConfirmationDialog
        open={showConfirmDialog}
        handleClose={() => setShowConfirmDialog(false)}
        handleConfirm={confirmDelete}
        title="Eliminar tercero"
        message="¿Estás seguro de que quieres eliminar este tercero? Esta acción no se puede deshacer."
      />

      {selectedClienteForHistory && (
        <ClienteFinancialHistoryDialog
          open={showHistoryDialog}
          handleClose={handleCloseHistory}
          clienteId={selectedClienteForHistory.id}
          clienteNombre={selectedClienteForHistory.nombre}
        />
      )}
    </Box>
  );
};

export default ClienteList;