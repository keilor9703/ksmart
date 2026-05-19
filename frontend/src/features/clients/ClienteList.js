import React, { useState, useEffect, useMemo } from 'react';
import apiClient from '../../api';
import { formatCurrency } from '../../utils/formatters';
import { toast } from 'react-toastify';
import ConfirmationDialog from '../../components/common/ConfirmationDialog';
import ClienteFinancialHistoryDialog from './ClienteFinancialHistoryDialog';
import {
  Box, Paper, Typography, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, IconButton, useMediaQuery, useTheme,
  TextField, TablePagination, Tooltip, InputAdornment, Chip, Grid, Divider,
  TableSortLabel, CircularProgress
} from '@mui/material';
import {
  Edit, Delete, History, Search, Person, Business, CreditCard,
  LocationOn, WhatsApp, Email, FileDownload
} from '@mui/icons-material';

const ACCENT = '#3B82F6';
const GREEN  = '#10B981';

// ─── WhatsApp helper ──────────────────────────────────────────────────────────
const openWhatsApp = (telefono) => {
  if (!telefono?.trim()) { toast.warning('Sin número de teléfono'); return; }
  const digits = telefono.replace(/\D/g, '');
  const full = digits.startsWith('57') ? digits : `57${digits}`;
  window.open(`https://wa.me/${full}`, '_blank');
};

// ─── Card mobile ──────────────────────────────────────────────────────────────
const ClienteCard = ({ cliente, onEditCliente, handleDelete, handleViewHistory, handleAbrirMapa, filterType }) => (
  <Paper sx={{ p: 2, mb: 2, borderRadius: 3, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
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

    <Grid container spacing={1} sx={{ mb: 1.5 }}>
      <Grid item xs={6}>
        <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>Teléfono</Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Typography sx={{ fontSize: 12, fontWeight: 600 }}>{cliente.telefono || 'N/A'}</Typography>
          {cliente.telefono && (
            <Tooltip title="Abrir WhatsApp">
              <IconButton size="small" onClick={() => openWhatsApp(cliente.telefono)} sx={{ p: 0.2, color: '#25D366' }}>
                <WhatsApp sx={{ fontSize: 14 }} />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      </Grid>
      <Grid item xs={6}>
        <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>Email</Typography>
        <Typography sx={{ fontSize: 11, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: cliente.email ? 'text.primary' : 'text.disabled' }}>
          {cliente.email || 'N/A'}
        </Typography>
      </Grid>
      <Grid item xs={6}>
        <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>Dirección</Typography>
        <Typography sx={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {cliente.direccion || 'N/A'}
        </Typography>
      </Grid>
      {filterType === 'cliente' && (
        <Grid item xs={6}>
          <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>Cupo de crédito</Typography>
          <Typography sx={{ fontSize: 13, fontWeight: 700, color: ACCENT }}>{formatCurrency(cliente.cupo_credito)}</Typography>
        </Grid>
      )}
    </Grid>

    <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
      <Tooltip title="Ver en Google Maps">
        <IconButton size="small" onClick={() => handleAbrirMapa(cliente.direccion)}
          sx={{ color: '#0ea5e9', bgcolor: 'rgba(14,165,233,0.1)', borderRadius: 1.5 }}>
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
const ClienteList = ({
  onEditCliente, onClienteDeleted, filterType, accentColor = ACCENT,
  clientes: clientesProp, loading: loadingProp,
}) => {
  const [clientesLocal, setClientesLocal] = useState([]);
  const [loadingLocal, setLoadingLocal]   = useState(clientesProp === undefined);
  const [searchTerm, setSearchTerm]       = useState('');
  const [sortBy, setSortBy]               = useState('nombre');
  const [sortDir, setSortDir]             = useState('asc');
  const [page, setPage]                   = useState(0);
  const [rowsPerPage, setRowsPerPage]     = useState(10);

  const theme    = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [clienteToDelete, setClienteToDelete]     = useState(null);
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  const [selectedClienteForHistory, setSelectedClienteForHistory] = useState(null);

  const clientes = clientesProp !== undefined ? clientesProp : clientesLocal;
  const loading  = clientesProp !== undefined ? (loadingProp ?? false) : loadingLocal;

  useEffect(() => {
    if (clientesProp === undefined) fetchClientes();
  }, []);

  const fetchClientes = () => {
    setLoadingLocal(true);
    apiClient.get('/clientes/')
      .then(r => setClientesLocal(r.data))
      .catch(() => toast.error('Error al cargar terceros'))
      .finally(() => setLoadingLocal(false));
  };

  const handleDelete = (id) => { setClienteToDelete(id); setShowConfirmDialog(true); };

  const confirmDelete = () => {
    apiClient.delete(`/clientes/${clienteToDelete}`)
      .then(() => {
        toast.success('Tercero eliminado exitosamente');
        if (clientesProp === undefined) fetchClientes();
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

  const handleAbrirMapa = (direccion) => {
    if (!direccion?.trim()) { toast.warning('Este cliente no tiene una dirección registrada.'); return; }
    const query = encodeURIComponent(`${direccion}, Colombia`);
    window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank');
  };

  const handleSort = (col) => {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('asc'); }
    setPage(0);
  };

  // ─── CSV export ───────────────────────────────────────────────────────────
  const handleExportCSV = () => {
    const rows = [
      ['ID', 'Nombre', 'Cédula/NIT', 'Teléfono', 'Email', 'Dirección', 'Cupo Crédito', 'Tipo'],
      ...filteredClientes.map(c => [
        c.id, c.nombre, c.cedula || '', c.telefono || '', c.email || '',
        c.direccion || '', c.cupo_credito || 0,
        [c.es_cliente && 'Cliente', c.es_proveedor && 'Proveedor'].filter(Boolean).join('+'),
      ]),
    ];
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filterType === 'proveedor' ? 'proveedores' : 'clientes'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ─── Filtrado + ordenado ───────────────────────────────────────────────────
  const filteredClientes = useMemo(() => {
    let list = clientes;
    if (filterType === 'cliente')   list = list.filter(c => c.es_cliente);
    if (filterType === 'proveedor') list = list.filter(c => c.es_proveedor);

    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      list = list.filter(c =>
        c.nombre.toLowerCase().includes(q) ||
        (c.cedula    && c.cedula.toLowerCase().includes(q))    ||
        (c.telefono  && c.telefono.toLowerCase().includes(q))  ||
        (c.email     && c.email.toLowerCase().includes(q))     ||
        (c.direccion && c.direccion.toLowerCase().includes(q))
      );
    }
    return list;
  }, [clientes, searchTerm, filterType]);

  const paginatedClientes = useMemo(() => {
    const copy = [...filteredClientes].sort((a, b) => {
      if (sortBy === 'nombre') {
        const cmp = a.nombre.localeCompare(b.nombre);
        return sortDir === 'asc' ? cmp : -cmp;
      }
      if (sortBy === 'cedula') {
        const cmp = (a.cedula || '').localeCompare(b.cedula || '');
        return sortDir === 'asc' ? cmp : -cmp;
      }
      if (sortBy === 'cupo_credito') {
        const cmp = (a.cupo_credito || 0) - (b.cupo_credito || 0);
        return sortDir === 'asc' ? cmp : -cmp;
      }
      return 0;
    });
    return copy.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
  }, [filteredClientes, sortBy, sortDir, page, rowsPerPage]);

  const label = filterType === 'proveedor' ? 'proveedores' : 'clientes';

  const SortHeader = ({ col, children }) => (
    <TableCell sortDirection={sortBy === col ? sortDir : false}>
      <TableSortLabel
        active={sortBy === col}
        direction={sortBy === col ? sortDir : 'asc'}
        onClick={() => handleSort(col)}
        sx={{ fontWeight: 700, fontSize: 12 }}
      >
        {children}
      </TableSortLabel>
    </TableCell>
  );

  return (
    <Box sx={{ width: '100%', maxWidth: '100%' }}>

      {/* Stats rápidas + CSV */}
      <Box sx={{ display: 'flex', gap: 1.5, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        {[
          { label: `Total ${label}`, val: filteredClientes.length, icon: filterType === 'proveedor' ? <Business fontSize="small" /> : <Person fontSize="small" />, color: accentColor },
          ...(filterType === 'cliente'
            ? [{ label: 'Con crédito', val: filteredClientes.filter(c => c.cupo_credito > 0).length, icon: <CreditCard fontSize="small" />, color: GREEN }]
            : []),
          ...(filterType === 'cliente'
            ? [{ label: 'Con email', val: filteredClientes.filter(c => c.email).length, icon: <Email fontSize="small" />, color: '#8B5CF6' }]
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
        <Box sx={{ ml: 'auto' }}>
          <Tooltip title={`Exportar ${label} a CSV`}>
            <IconButton size="small" onClick={handleExportCSV} sx={{ color: GREEN, border: `1px solid ${GREEN}30`, borderRadius: 1.5 }}>
              <FileDownload fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Buscador */}
      <Box sx={{ mb: 2 }}>
        <TextField
          fullWidth size="small"
          placeholder={`Buscar ${label} por nombre, cédula, teléfono, email…`}
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
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress sx={{ color: accentColor }} />
        </Box>
      ) : isMobile ? (
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
                  handleAbrirMapa={handleAbrirMapa}
                  filterType={filterType}
                />
              ))
          }
        </Box>
      ) : (
        <TableContainer sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
          <Table size="small">
            <TableHead sx={{ bgcolor: 'action.hover' }}>
              <TableRow>
                <SortHeader col="nombre">Nombre / Razón Social</SortHeader>
                <SortHeader col="cedula">Cédula / NIT</SortHeader>
                <TableCell sx={{ fontWeight: 700, fontSize: 12 }}>Teléfono</TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: 12 }}>Email</TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: 12 }}>Dirección</TableCell>
                {filterType === 'cliente' && <SortHeader col="cupo_credito">Cupo Crédito</SortHeader>}
                <TableCell sx={{ fontWeight: 700, fontSize: 12 }}>Tipo</TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: 12 }} align="right">Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paginatedClientes.length === 0
                ? <TableRow>
                    <TableCell colSpan={filterType === 'cliente' ? 8 : 7} sx={{ textAlign: 'center', py: 6 }}>
                      <Person sx={{ fontSize: 40, opacity: 0.2, display: 'block', mx: 'auto', mb: 1 }} />
                      <Typography color="text.secondary" fontSize={13}>No se encontraron {label}</Typography>
                    </TableCell>
                  </TableRow>
                : paginatedClientes.map(c => (
                    <TableRow key={c.id} hover>
                      <TableCell sx={{ fontWeight: 600 }}>{c.nombre}</TableCell>
                      <TableCell sx={{ fontSize: 12, color: 'text.secondary' }}>{c.cedula || '—'}</TableCell>
                      <TableCell sx={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                        {c.telefono ? (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            {c.telefono}
                            <Tooltip title="Abrir WhatsApp">
                              <IconButton size="small" onClick={() => openWhatsApp(c.telefono)} sx={{ p: 0.2, color: '#25D366' }}>
                                <WhatsApp sx={{ fontSize: 14 }} />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        ) : '—'}
                      </TableCell>
                      <TableCell sx={{ fontSize: 11, color: c.email ? 'text.primary' : 'text.disabled', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {c.email || '—'}
                      </TableCell>
                      <TableCell sx={{ fontSize: 12, color: 'text.secondary', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <Tooltip title={c.direccion || ''}>
                          <span>{c.direccion || '—'}</span>
                        </Tooltip>
                      </TableCell>
                      {filterType === 'cliente' && (
                        <TableCell sx={{ fontWeight: 600, color: c.cupo_credito > 0 ? accentColor : 'text.secondary' }}>
                          {formatCurrency(c.cupo_credito)}
                        </TableCell>
                      )}
                      <TableCell>
                        <Box sx={{ display: 'flex', gap: 0.5 }}>
                          {c.es_cliente   && <Chip label="Cliente"   size="small" sx={{ bgcolor: `${ACCENT}18`, color: ACCENT, fontWeight: 600, fontSize: 9, borderRadius: 1 }} />}
                          {c.es_proveedor && <Chip label="Proveedor" size="small" sx={{ bgcolor: `${GREEN}18`,  color: GREEN,  fontWeight: 600, fontSize: 9, borderRadius: 1 }} />}
                        </Box>
                      </TableCell>
                      <TableCell align="right">
                        <Box sx={{ display: 'flex', gap: 0.3, justifyContent: 'flex-end' }}>
                          <Tooltip title="Ver en Google Maps">
                            <IconButton size="small" onClick={() => handleAbrirMapa(c.direccion)}
                              sx={{ color: '#0ea5e9', '&:hover': { bgcolor: 'rgba(14,165,233,0.1)' } }}>
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
        rowsPerPageOptions={[5, 10, 25, 50]}
        component="div"
        count={filteredClientes.length}
        rowsPerPage={rowsPerPage}
        page={page}
        onPageChange={(_, p) => setPage(p)}
        onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
        labelRowsPerPage="Filas:"
        labelDisplayedRows={({ from, to, count }) => `${from}–${to} de ${count}`}
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
