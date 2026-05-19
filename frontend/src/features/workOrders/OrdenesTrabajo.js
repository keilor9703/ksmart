import React, { useState, useEffect, useMemo } from 'react';
import apiClient from '../../api';
import { formatCurrency } from '../../utils/formatters';
import { toast } from 'react-toastify';
import ConfirmationDialog from '../../components/common/ConfirmationDialog';
import RechazoDialog from './RechazoDialog';
import OrdenTrabajoDetailDialog from './OrdenTrabajoDetailDialog';
import QuickCreateModal from '../../components/common/QuickCreateModal';
import CloseOrderPaymentDialog from '../sales/CloseOrderPaymentDialog';
import CurrencyField from '../../components/common/CurrencyField';
import { useLocation } from 'react-router-dom';
import {
  Box, Paper, Typography, Grid, TextField, Button, IconButton, Autocomplete,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Chip, Tabs, Tab, Tooltip, useMediaQuery, Divider, InputAdornment, Stack,
  TableSortLabel, TablePagination
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  Add, Delete, Visibility, CheckCircle, Cancel, Assignment,
  TrendingUp, Receipt, PendingActions, Edit,
  FileDownload, Search, Today, WorkOutline
} from '@mui/icons-material';

const ACCENT = '#EC4899';
const GREEN = '#10B981';
const RED = '#EF4444';
const BLUE = '#3B82F6';
const YELLOW = '#F59E0B';

function TabPanel({ children, value, index }) {
  return (
    <div role="tabpanel" hidden={value !== index}>
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
}

const KpiCard = ({ label, value, icon, color }) => (
  <Paper sx={{ p: 2.5, borderRadius: 3, display: 'flex', alignItems: 'center', gap: 2, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
    <Box sx={{ width: 48, height: 48, borderRadius: 2, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: `${color}18`, color }}>
      {icon}
    </Box>
    <Box>
      <Typography sx={{ fontSize: 12, color: 'text.secondary', fontWeight: 500, mb: 0.3 }}>{label}</Typography>
      <Typography sx={{ fontSize: 18, fontWeight: 700, color: 'text.primary' }}>{value}</Typography>
    </Box>
  </Paper>
);

const OrdenCard = ({ orden, onEdit, onView, onSend, onApprove, onReject, onClose, user }) => {
  const getEstadoChip = (estado) => {
    const map = {
      'Borrador': { label: 'Borrador', color: 'default' },
      'Pendiente': { label: 'Pendiente', color: 'info' },
      'Iniciada': { label: 'Iniciada', color: 'primary' },
      'En revisión': { label: 'En Revisión', color: 'warning' },
      'Aprobada': { label: 'Aprobada', color: 'success' },
      'Rechazada': { label: 'Rechazada', color: 'error' },
      'Cerrada': { label: 'Cerrada', color: 'default' },
    };
    const props = map[estado] || { label: estado, color: 'default' };
    return <Chip label={props.label} color={props.color} size="small" sx={{ fontWeight: 600, fontSize: 11, borderRadius: 1.5 }} />;
  };

  return (
    <Paper sx={{ p: 2.5, mb: 2, borderRadius: 3, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
        <Box>
          <Typography sx={{ fontWeight: 700, fontSize: 15 }}>Orden #{orden.id}</Typography>
          <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{orden.cliente?.nombre || 'Sin cliente'}</Typography>
        </Box>
        {getEstadoChip(orden.estado)}
      </Box>

      <Divider sx={{ my: 1.5 }} />

      <Grid container spacing={1} sx={{ mb: 1.5 }}>
        <Grid item xs={6}><Box sx={{ textAlign: 'center', p: 1, borderRadius: 2, bgcolor: 'action.hover' }}><Typography sx={{ fontSize: 10, color: 'text.secondary', mb: 0.2 }}>Total</Typography><Typography sx={{ fontSize: 13, fontWeight: 700 }}>{formatCurrency(orden.total)}</Typography></Box></Grid>
        <Grid item xs={6}><Box sx={{ textAlign: 'center', p: 1, borderRadius: 2, bgcolor: 'action.hover' }}><Typography sx={{ fontSize: 10, color: 'text.secondary', mb: 0.2 }}>Operador</Typography><Typography sx={{ fontSize: 13, fontWeight: 700 }}>{orden.operador?.username || 'N/A'}</Typography></Box></Grid>
      </Grid>

      <Typography sx={{ fontSize: 11, color: 'text.secondary', mb: 0.5 }}>
        {new Date(orden.fecha_creacion + 'Z').toLocaleString('es-CO')}
      </Typography>

      <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end', mt: 1.5 }}>
        <Tooltip title="Ver detalles">
          <IconButton size="small" onClick={() => onView(orden)} sx={{ color: BLUE, bgcolor: '#EFF6FF', borderRadius: 1.5 }}>
            <Visibility fontSize="small" />
          </IconButton>
        </Tooltip>

        {/* ✅ FIX: Ahora el Admin puede editar si está en Pendiente o Borrador */}
        {(orden.estado === 'Borrador' || orden.estado === 'Pendiente' || orden.estado === 'Rechazada') && (
          <>
            <Tooltip title="Editar">
              <IconButton size="small" onClick={() => onEdit(orden)} sx={{ color: ACCENT, bgcolor: `${ACCENT}12`, borderRadius: 1.5 }}>
                <Edit fontSize="small" />
              </IconButton>
            </Tooltip>
          </>
        )}

        {user?.role?.name === 'Admin' && orden.estado === 'En revisión' && (
          <>
            <Tooltip title="Aprobar">
              <IconButton size="small" onClick={() => onApprove(orden.id)} sx={{ color: GREEN, bgcolor: `${GREEN}12`, borderRadius: 1.5 }}>
                <CheckCircle fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Rechazar">
              <IconButton size="small" onClick={() => onReject(orden)} sx={{ color: RED, bgcolor: `${RED}12`, borderRadius: 1.5 }}>
                <Cancel fontSize="small" />
              </IconButton>
            </Tooltip>
          </>
        )}

        {user?.role?.name === 'Admin' && (orden.estado === 'Aprobada' || orden.estado === 'Rechazada') && (
          <Tooltip title="Cerrar orden">
            <IconButton size="small" onClick={() => onClose(orden)} sx={{ color: GREEN, bgcolor: `${GREEN}12`, borderRadius: 1.5 }}>
              <CheckCircle fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </Box>
    </Paper>
  );
};

const ESTADOS = ['todos', 'Borrador', 'Pendiente', 'Iniciada', 'En revisión', 'Aprobada', 'Rechazada', 'Cerrada'];

const PRESETS = [
  { key: 'hoy', label: 'Hoy' },
  { key: 'semana', label: 'Esta semana' },
  { key: 'mes', label: 'Este mes' },
];

const OrdenesTrabajo = ({ user }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const location = useLocation();

  const [ordenes, setOrdenes] = useState([]);
  const [ordenesParaAprobar, setOrdenesParaAprobar] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [productos, setProductos] = useState([]);
  const [operators, setOperators] = useState([]);

  const [cliente, setCliente] = useState(null);
  const [selectedOperatorForForm, setSelectedOperatorForForm] = useState(null);
  const [addedProductos, setAddedProductos] = useState([]);
  const [addedServicios, setAddedServicios] = useState([]);
  const [evidenceFile, setEvidenceFile] = useState(null);

  const [clienteInput, setClienteInput] = useState('');
  const [productoInputs, setProductoInputs] = useState({});
  const [quickCreate, setQuickCreate] = useState({ open: false, type: 'tercero', initialName: '', targetIdx: null });

  const [editingOrden, setEditingOrden] = useState(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [ordenAction, setOrdenAction] = useState({ action: null, id: null, message: '' });
  const [showRechazoDialog, setShowRechazoDialog] = useState(false);
  const [ordenToProcess, setOrdenToProcess] = useState(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [selectedOrden, setSelectedOrden] = useState(null);
  const [showCloseOrderPaymentDialog, setShowCloseOrderPaymentDialog] = useState(false);
  const [ordenToClose, setOrdenToClose] = useState(null);

  const [tabValue, setTabValue] = useState(0);
  const [startDate, setStartDate] = useState(new Date().toLocaleDateString('en-CA'));
  const [endDate, setEndDate] = useState(new Date().toLocaleDateString('en-CA'));
  const [selectedClient, setSelectedClient] = useState(null);
  const [selectedOperator, setSelectedOperator] = useState(null);
  const [accumulatedTotal, setAccumulatedTotal] = useState(0);

  // New state: search, filter, sort, pagination
  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [sortCol, setSortCol] = useState('id');
  const [sortDir, setSortDir] = useState('desc');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(15);

  useEffect(() => {
    fetchClientes(); fetchProductos();
    if (user?.role?.name === 'Admin') fetchOperators();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const filters = { startDate, endDate, clienteId: selectedClient?.id, operadorId: selectedOperator?.id };
    fetchOrdenes(filters);
    fetchAccumulatedTotal(filters);
    if (user?.role?.name === 'Admin') fetchOrdenesParaAprobar();
  }, [user, startDate, endDate, selectedClient, selectedOperator]);

  useEffect(() => {
    if (editingOrden) {
      const clienteSeleccionado = clientes.find(c => c.id === editingOrden.cliente.id);
      setCliente(clienteSeleccionado);
      setClienteInput(clienteSeleccionado?.nombre || '');
      setSelectedOperatorForForm(operators.find(op => op.id === editingOrden.operador.id));

      const pInputs = {};
      const prodsEdit = editingOrden.productos.map(p => {
        const newId = Date.now() + Math.random();
        pInputs[newId] = p.producto?.nombre || '';
        return { id: newId, producto: p.producto, cantidad: p.cantidad, precioUnitario: p.precio_unitario };
      });

      setAddedProductos(prodsEdit);
      setProductoInputs(pInputs);

      setAddedServicios(editingOrden.servicios.map(s => ({
        id: Date.now() + Math.random(), servicio: s.servicio, cantidad: s.cantidad, precioUnitario: s.precio_servicio,
      })));
      setTabValue(0);
    } else {
      resetForm();
    }
  }, [editingOrden, clientes, productos, operators]);

  useEffect(() => {
    if (location.state?.ordenId) {
      apiClient.get(`/ordenes-trabajo/${location.state.ordenId}`)
        .then(res => {
          setSelectedOrden(res.data);
          setShowDetailDialog(true);
          window.history.replaceState({}, document.title, location.pathname);
        })
        .catch(err => toast.error('Error al cargar la orden'));
    }
  }, [location.state?.ordenId]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchOrdenes = (filters = {}) => {
    const params = {
      skip: 0, limit: 100, estado: filters.estado || null,
      start_date: filters.startDate || null, end_date: filters.endDate || null,
      cliente_id: filters.clienteId || null, operador_id: filters.operadorId || null,
    };
    apiClient.get('/ordenes-trabajo/', { params }).then(res => setOrdenes(res.data)).catch(() => toast.error("Error al cargar órdenes"));
  };

  const fetchAccumulatedTotal = (filters = {}) => {
    const params = {
      estado: filters.estado || null, start_date: filters.startDate || null,
      end_date: filters.endDate || null, cliente_id: filters.clienteId || null,
    };
    apiClient.get('/ordenes-trabajo/total', { params }).then(res => setAccumulatedTotal(res.data)).catch(() => toast.error("Error al cargar total"));
  };

  const fetchOrdenesParaAprobar = () =>
    apiClient.get('/ordenes-trabajo/?estado=En revisión').then(res => setOrdenesParaAprobar(res.data)).catch(() => toast.error("Error al cargar pendientes"));

  const fetchClientes = () => apiClient.get('/clientes/').then(res => setClientes(res.data)).catch(() => toast.error("Error al cargar clientes"));
  const fetchProductos = () => apiClient.get('/productos/').then(res => setProductos(res.data)).catch(() => toast.error("Error al cargar productos"));
  const fetchOperators = () => apiClient.get('/users/').then(res => setOperators(res.data)).catch(() => toast.error("Error al cargar operadores"));

  const resetForm = () => {
    setCliente(null); setClienteInput(''); setSelectedOperatorForForm(null);
    setAddedProductos([]); setProductoInputs({}); setAddedServicios([]);
    setEditingOrden(null); setEvidenceFile(null);
  };

  const openQuickCreate = (type, initialName = '', targetIdx = null) => setQuickCreate({ open: true, type, initialName, targetIdx });
  const closeQuickCreate = () => setQuickCreate(q => ({ ...q, open: false }));

  const handleQuickCreated = (nuevoRegistro) => {
    if (quickCreate.type === 'tercero') {
      setClientes(prev => [...prev, nuevoRegistro]);
      setCliente(nuevoRegistro);
      setClienteInput(nuevoRegistro.nombre);
    } else {
      setProductos(prev => [...prev, nuevoRegistro]);
      if (quickCreate.targetIdx !== null) {
        handleProductoChange(quickCreate.targetIdx, 'producto', nuevoRegistro);
        handleProductoChange(quickCreate.targetIdx, 'precioUnitario', nuevoRegistro.precio || 0);
        setProductoInputs(prev => ({ ...prev, [quickCreate.targetIdx]: nuevoRegistro.nombre }));
      }
    }
    closeQuickCreate();
  };

  const handleAddProducto = () => setAddedProductos([...addedProductos, { id: Date.now() + Math.random(), producto: null, cantidad: 1, precioUnitario: 0 }]);
  const handleRemoveProducto = (id) => { setAddedProductos(addedProductos.filter(p => p.id !== id)); setProductoInputs(prev => { const next = { ...prev }; delete next[id]; return next; }); };
  const handleProductoChange = (id, field, value) => setAddedProductos(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));
  const handleProductoInputChange = (id, val) => setProductoInputs(prev => ({ ...prev, [id]: val }));

  const handleAddServicio = () => setAddedServicios([...addedServicios, { id: Date.now() + Math.random(), servicio: null, cantidad: 1, precioUnitario: 0 }]);
  const handleRemoveServicio = (id) => setAddedServicios(addedServicios.filter(s => s.id !== id));
  const handleServicioChange = (id, field, value) => setAddedServicios(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));

  const calculateTotal = () => {
    const totalProductos = addedProductos.reduce((total, p) => total + (p.cantidad * p.precioUnitario), 0);
    const totalServicios = addedServicios.reduce((total, s) => total + (s.cantidad * s.precioUnitario), 0);
    return totalProductos + totalServicios;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!cliente || (addedProductos.length === 0 && addedServicios.length === 0)) {
      toast.error('Seleccione un cliente y añada al menos un producto o servicio');
      return;
    }

    const ordenData = {
      cliente_id: cliente.id,
      total: calculateTotal(),
      productos: addedProductos.map(p => ({ producto_id: p.producto.id, cantidad: p.cantidad, precio_unitario: p.precioUnitario })),
      servicios: addedServicios.map(s => ({ servicio_id: s.servicio.id, cantidad: s.cantidad, precio_servicio: s.precioUnitario })),
      ...(user?.role?.name === 'Admin' && selectedOperatorForForm && { operador_id: selectedOperatorForForm.id }),
    };

    const request = editingOrden ? apiClient.put(`/ordenes-trabajo/${editingOrden.id}`, ordenData) : apiClient.post('/ordenes-trabajo/', ordenData);

    request.then((response) => {
      const newOrdenId = response.data.id;
      toast.success(`Orden ${editingOrden ? 'actualizada' : 'registrada'} exitosamente`);
      if (evidenceFile && newOrdenId) {
        const formData = new FormData(); formData.append("file", evidenceFile);
        return apiClient.post(`/ordenes-trabajo/${newOrdenId}/evidencia`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      }
      return Promise.resolve();
    }).then(() => {
      const today = new Date().toISOString().split('T')[0];
      setStartDate(today); setEndDate(today); setSelectedClient(null); setSelectedOperator(null);
      fetchOrdenes({ startDate: today, endDate: today, clienteId: null, operadorId: null });
      fetchAccumulatedTotal({ startDate: today, endDate: today, clienteId: null });
      resetForm(); setTabValue(1);
    }).catch(err => toast.error(err.response?.data?.detail || 'Error al procesar la orden'));
  };

  const handleApprove = async (id) => {
    const ok = await checkStockForOrder(id);
    if (!ok) return;
    setOrdenAction({ action: 'aprobar', id, message: '¿Aprobar esta orden? Se registrará la venta automáticamente y se descontará el inventario.' });
    setShowConfirmDialog(true);
  };

  const handleOpenRejectDialog = (orden) => { setOrdenToProcess(orden); setShowRechazoDialog(true); };

  const handleCloseOrder = (orden) => {
    if (user?.role?.name === 'Admin') {
      setOrdenToClose(orden);
      setShowCloseOrderPaymentDialog(true);
    }
  };

  const confirmAction = () => {
    if (ordenAction.action === 'aprobar') {
      apiClient.post(`/ordenes-trabajo/${ordenAction.id}/aprobar`)
        .then(() => {
          toast.success('Orden aprobada exitosamente. Venta generada e inventario ajustado.');
          fetchOrdenes(); fetchOrdenesParaAprobar();
        })
        .catch(err => toast.error(err.response?.data?.detail || 'Error al aprobar'))
        .finally(() => setShowConfirmDialog(false));
    }
  };

  const handleConfirmReject = (observaciones) => {
    if (!ordenToProcess) return;
    apiClient.post(`/ordenes-trabajo/${ordenToProcess.id}/rechazar?observaciones=${encodeURIComponent(observaciones)}`)
      .then(() => { toast.warn('Orden rechazada'); fetchOrdenes(); fetchOrdenesParaAprobar(); })
      .catch(err => toast.error(err.response?.data?.detail || 'Error al rechazar'))
      .finally(() => { setShowRechazoDialog(false); setOrdenToProcess(null); });
  };

  const handleConfirmCloseOrderWithPayment = (paymentData) => {
    const { ordenId, wasPaid, paymentType, paidAmount } = paymentData;
    apiClient.put(`/ordenes-trabajo/${ordenId}/cerrar`, { was_paid: wasPaid, payment_type: paymentType, paid_amount: paidAmount })
      .then(() => { toast.success('Orden cerrada correctamente'); fetchOrdenes(); if (user?.role?.name === 'Admin') fetchOrdenesParaAprobar(); })
      .catch(err => toast.error(err.response?.data?.detail || 'Error al cerrar orden'))
      .finally(() => { setShowCloseOrderPaymentDialog(false); setOrdenToClose(null); });
  };

  const checkStockForOrder = async (ordenId) => {
    try {
      const res = await apiClient.get(`/ordenes-trabajo/${ordenId}`);
      const orden = res.data;
      const faltantes = [];
      (orden.productos || []).forEach((linea) => {
        const prod = linea.producto;
        if (!prod || prod.es_servicio) return;
        const disponible = Number(prod.stock_actual ?? 0);
        const requerido = Number(linea.cantidad ?? 0);
        if (disponible < requerido) { faltantes.push({ nombre: prod.nombre, requerido, disponible }); }
      });
      if (faltantes.length) {
        faltantes.forEach(f => toast.error(`Stock insuficiente: ${f.nombre} (req: ${f.requerido}, disp: ${f.disponible})`));
        return false;
      }
      return true;
    } catch { toast.error('Error al validar stock'); return false; }
  };

  const handleExportCSV = () => {
    const rows = [
      ['ID', 'Cliente', 'Operador', 'Estado', 'Total', 'Fecha'],
      ...ordenesFiltradas.map(o => [
        o.id,
        o.cliente?.nombre || '',
        o.operador?.username || '',
        o.estado,
        o.total,
        new Date(o.fecha_creacion + 'Z').toLocaleDateString('es-CO'),
      ]),
    ];
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'ordenes-trabajo.csv';
    a.click(); URL.revokeObjectURL(url);
  };

  const applyPreset = (key) => {
    const now = new Date();
    const pad = n => String(n).padStart(2, '0');
    const fmt = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    if (key === 'hoy') { setStartDate(fmt(now)); setEndDate(fmt(now)); }
    else if (key === 'semana') { const d = new Date(now); d.setDate(now.getDate() - 6); setStartDate(fmt(d)); setEndDate(fmt(now)); }
    else if (key === 'mes') { setStartDate(`${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`); setEndDate(fmt(now)); }
  };

  const statsOrdenes = {
    total: ordenes.length,
    pendientes: ordenes.filter(o => o.estado === 'En revisión').length,
    aprobadas: ordenes.filter(o => o.estado === 'Aprobada').length,
    cerradas: ordenes.filter(o => o.estado === 'Cerrada').length,
  };

  // Client-side filtering, sorting, pagination
  const estadoCounts = useMemo(() => {
    const counts = {};
    ESTADOS.forEach(e => { counts[e] = e === 'todos' ? ordenes.length : ordenes.filter(o => o.estado === e).length; });
    return counts;
  }, [ordenes]);

  const ordenesFiltradas = useMemo(() => {
    let list = [...ordenes];
    if (filtroEstado !== 'todos') list = list.filter(o => o.estado === filtroEstado);
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase();
      list = list.filter(o =>
        String(o.id).includes(q) ||
        (o.cliente?.nombre || '').toLowerCase().includes(q) ||
        (o.operador?.username || '').toLowerCase().includes(q)
      );
    }
    list.sort((a, b) => {
      let va, vb;
      switch (sortCol) {
        case 'cliente': va = a.cliente?.nombre || ''; vb = b.cliente?.nombre || ''; return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
        case 'total': va = a.total; vb = b.total; break;
        case 'fecha': va = new Date(a.fecha_creacion); vb = new Date(b.fecha_creacion); break;
        case 'estado': va = a.estado; vb = b.estado; return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
        default: va = a.id; vb = b.id;
      }
      return sortDir === 'asc' ? va - vb : vb - va;
    });
    return list;
  }, [ordenes, filtroEstado, busqueda, sortCol, sortDir]);

  const ordenesPaginadas = useMemo(() =>
    ordenesFiltradas.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage),
    [ordenesFiltradas, page, rowsPerPage]
  );

  const handleSort = (col) => {
    setSortDir(prev => col === sortCol ? (prev === 'asc' ? 'desc' : 'asc') : 'desc');
    setSortCol(col);
    setPage(0);
  };

  // Sortable header cell helper
  const SortTh = ({ col, children, align = 'left' }) => (
    <TableCell align={align} sx={{ fontWeight: 800 }}>
      <TableSortLabel active={sortCol === col} direction={sortCol === col ? sortDir : 'asc'} onClick={() => handleSort(col)}>
        {children}
      </TableSortLabel>
    </TableCell>
  );

  return (
    <Box sx={{ width: '100%' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ width: 40, height: 40, borderRadius: 2, bgcolor: `${ACCENT}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: ACCENT }}>
            <Assignment />
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 700, fontSize: 20, lineHeight: 1.2 }}>Órdenes de Trabajo</Typography>
            <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>Gestión de órdenes de servicio y producción</Typography>
          </Box>
        </Box>
        <Button variant="contained" startIcon={<Add />} onClick={() => { resetForm(); setTabValue(0); }} sx={{ background: `linear-gradient(135deg, ${ACCENT}, #f472b6)`, boxShadow: `0 4px 14px rgba(236,72,153,0.35)`, borderRadius: 2, fontWeight: 600 }}>Nueva Orden</Button>
      </Box>

      {tabValue === 1 && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={6} sm={4} md={2.4}><KpiCard label="Total órdenes" value={statsOrdenes.total} icon={<Receipt />} color={ACCENT} /></Grid>
          <Grid item xs={6} sm={4} md={2.4}><KpiCard label="Pendientes" value={statsOrdenes.pendientes} icon={<PendingActions />} color={YELLOW} /></Grid>
          <Grid item xs={6} sm={4} md={2.4}><KpiCard label="Aprobadas" value={statsOrdenes.aprobadas} icon={<CheckCircle />} color={GREEN} /></Grid>
          <Grid item xs={6} sm={4} md={2.4}><KpiCard label="Cerradas" value={statsOrdenes.cerradas} icon={<WorkOutline />} color={BLUE} /></Grid>
          <Grid item xs={12} sm={4} md={2.4}><KpiCard label="Total acumulado" value={formatCurrency(accumulatedTotal)} icon={<TrendingUp />} color={GREEN} /></Grid>
        </Grid>
      )}

      <Paper sx={{ borderRadius: 3, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
        <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)} variant={isMobile ? 'scrollable' : 'standard'} scrollButtons="auto" sx={{ px: 2, borderBottom: '1px solid', borderColor: 'divider', '& .MuiTab-root': { fontWeight: 600, fontSize: 13, textTransform: 'none', minHeight: 52 }, '& .MuiTabs-indicator': { backgroundColor: ACCENT, height: 3, borderRadius: 3 }, '& .Mui-selected': { color: `${ACCENT} !important` } }}>
          <Tab label="➕ Registrar Orden" />
          <Tab label={`📋 Mis Órdenes (${ordenes.length})`} />
          {user?.role?.name === 'Admin' && <Tab label={`⚠️ Aprobaciones (${ordenesParaAprobar.length})`} />}
        </Tabs>

        <TabPanel value={tabValue} index={0}>
          <Box sx={{ p: { xs: 2, md: 3 } }}>
            <Typography sx={{ fontWeight: 600, fontSize: 11, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.6, mb: 2 }}>{editingOrden ? 'Editar orden de trabajo' : 'Nueva orden de trabajo'}</Typography>
            <Box component="form" onSubmit={handleSubmit}>
              <Autocomplete options={clientes} getOptionLabel={(o) => o?.nombre || ''} value={cliente} onChange={(_, v) => setCliente(v)} inputValue={clienteInput} onInputChange={(_, v) => setClienteInput(v)} filterOptions={(opts, state) => { const q = (state.inputValue || '').toLowerCase().trim(); if (!q) return opts; return opts.filter(o => o.nombre.toLowerCase().includes(q) || (o.cedula || '').toLowerCase().includes(q)); }} noOptionsText={<Box sx={{ py: 0.5 }}><Typography sx={{ fontSize: 13, color: 'text.secondary', mb: 1 }}>No se encontró ningún cliente</Typography><Button size="small" variant="contained" fullWidth startIcon={<Add />} onClick={() => openQuickCreate('tercero', clienteInput)} sx={{ borderRadius: 2, fontWeight: 600, fontSize: 12, bgcolor: '#3B82F6', '&:hover': { bgcolor: '#2563EB' } }}>Crear "{clienteInput || 'nuevo cliente'}"</Button></Box>} renderInput={(params) => (<TextField {...params} label="Cliente *" required fullWidth placeholder="Busca por nombre o NIT…" InputProps={{ ...params.InputProps, endAdornment: (<>{params.InputProps.endAdornment}<Tooltip title="Crear nuevo cliente"><IconButton size="small" onClick={() => openQuickCreate('tercero', clienteInput)} sx={{ color: '#3B82F6', p: 0.5 }}><Add fontSize="small" /></IconButton></Tooltip></>), }} />)} sx={{ mb: 3 }} />
              {user?.role?.name === 'Admin' && (<Autocomplete options={operators} getOptionLabel={(o) => o.username} value={selectedOperatorForForm} onChange={(_, v) => setSelectedOperatorForForm(v)} renderInput={(params) => <TextField {...params} label="Asignar Operador" fullWidth />} sx={{ mb: 3 }} />)}
              <Divider sx={{ mb: 3 }} />

              <Box sx={{ mb: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}><Typography sx={{ fontWeight: 600, fontSize: 11, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.6 }}>Productos / Insumos</Typography><Button size="small" startIcon={<Add />} onClick={handleAddProducto} sx={{ color: ACCENT, fontWeight: 600 }}>Añadir producto</Button></Box>
                <Stack direction="column" spacing={1.5}>
                  {addedProductos.map(p => (
                    <Box key={p.id} sx={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 1.5, alignItems: isMobile ? 'stretch' : 'center', p: 1.5, borderRadius: 2, bgcolor: 'action.hover', border: '1px solid', borderColor: 'divider' }}>
                      <Autocomplete options={productos.filter(prod => !prod.es_servicio)} getOptionLabel={(opt) => opt?.nombre || ''} value={p.producto} onChange={(_, v) => { handleProductoChange(p.id, 'producto', v); handleProductoChange(p.id, 'precioUnitario', v ? v.precio : 0); }} inputValue={productoInputs[p.id] || ''} onInputChange={(_, v) => handleProductoInputChange(p.id, v)} noOptionsText={<Box sx={{ py: 0.5 }}><Typography sx={{ fontSize: 13, color: 'text.secondary', mb: 1 }}>No se encontró ningún producto</Typography><Button size="small" variant="contained" fullWidth startIcon={<Add />} onClick={() => openQuickCreate('producto', productoInputs[p.id] || '', p.id)} sx={{ borderRadius: 2, fontWeight: 600, fontSize: 12, bgcolor: '#10B981', '&:hover': { bgcolor: '#059669' } }}>Crear "{productoInputs[p.id] || 'nuevo producto'}"</Button></Box>} renderInput={(params) => (<TextField {...params} label="Producto" size="small" placeholder="Busca por nombre…" InputProps={{ ...params.InputProps, endAdornment: (<>{params.InputProps.endAdornment}<Tooltip title="Crear nuevo producto"><IconButton size="small" onClick={() => openQuickCreate('producto', productoInputs[p.id] || '', p.id)} sx={{ color: '#10B981', p: 0.5 }}><Add fontSize="small" /></IconButton></Tooltip></>), }} />)} sx={{ flex: 2, minWidth: isMobile ? '100%' : 220 }} />
                      <TextField type="number" label="Cantidad" size="small" value={p.cantidad} onChange={e => handleProductoChange(p.id, 'cantidad', parseFloat(e.target.value))} sx={{ width: isMobile ? '100%' : 110 }} InputProps={{ inputProps: { min: 0, step: 'any' } }} />
                      <CurrencyField
                        label="Precio Unit."
                        value={p.precioUnitario}
                        onChange={val => handleProductoChange(p.id, 'precioUnitario', val)}
                        sx={{ width: isMobile ? '100%' : 140 }}
                      />
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}><Typography sx={{ fontWeight: 700, fontSize: 14, color: ACCENT, minWidth: 90 }}>{formatCurrency(p.cantidad * p.precioUnitario)}</Typography><Tooltip title="Quitar"><IconButton size="small" onClick={() => handleRemoveProducto(p.id)} sx={{ color: RED, bgcolor: '#FEF2F2', borderRadius: 1.5 }}><Delete fontSize="small" /></IconButton></Tooltip></Box>
                    </Box>
                  ))}
                </Stack>
              </Box>

              <Box sx={{ mb: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}><Typography sx={{ fontWeight: 600, fontSize: 11, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.6 }}>Servicios a realizar</Typography><Button size="small" startIcon={<Add />} onClick={handleAddServicio} sx={{ color: BLUE, fontWeight: 600 }}>Añadir servicio</Button></Box>
                <Stack direction="column" spacing={1.5}>
                  {addedServicios.map(s => (
                    <Box key={s.id} sx={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 1.5, alignItems: isMobile ? 'stretch' : 'center', p: 1.5, borderRadius: 2, bgcolor: 'action.hover', border: '1px solid', borderColor: 'divider' }}>
                      <Autocomplete options={productos.filter(prod => prod.es_servicio)} getOptionLabel={(opt) => opt?.nombre || ''} value={s.servicio} onChange={(_, v) => { handleServicioChange(s.id, 'servicio', v); handleServicioChange(s.id, 'precioUnitario', v ? v.precio : 0); }} renderInput={(params) => (<TextField {...params} label="Servicio" size="small" placeholder="Busca..." />)} sx={{ flex: 2, minWidth: isMobile ? '100%' : 220 }} />
                      <TextField type="number" label="Cantidad" size="small" value={s.cantidad} onChange={e => handleServicioChange(s.id, 'cantidad', parseFloat(e.target.value))} sx={{ width: isMobile ? '100%' : 110 }} />
                      <CurrencyField
                        label="Precio Unit."
                        value={s.precioUnitario}
                        onChange={val => handleServicioChange(s.id, 'precioUnitario', val)}
                        sx={{ width: isMobile ? '100%' : 140 }}
                      />
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}><Typography sx={{ fontWeight: 700, fontSize: 14, color: BLUE, minWidth: 90 }}>{formatCurrency(s.cantidad * s.precioUnitario)}</Typography><Tooltip title="Quitar"><IconButton size="small" onClick={() => handleRemoveServicio(s.id)} sx={{ color: RED, bgcolor: '#FEF2F2', borderRadius: 1.5 }}><Delete fontSize="small" /></IconButton></Tooltip></Box>
                    </Box>
                  ))}
                </Stack>
              </Box>

              <Divider sx={{ mb: 3 }} />
              <Box sx={{ mb: 3 }}><Typography sx={{ fontWeight: 600, fontSize: 11, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.6, mb: 1.5 }}>Adjuntar evidencia (opcional)</Typography><Button variant="outlined" component="label" sx={{ borderRadius: 2, fontWeight: 600, borderColor: 'divider' }}>{evidenceFile ? evidenceFile.name : 'Seleccionar archivo'}<input type="file" hidden onChange={(e) => setEvidenceFile(e.target.files[0])} /></Button></Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
                <Paper sx={{ p: 2, borderRadius: 2, textAlign: 'center', bgcolor: `${ACCENT}0D`, border: `1.5px dashed ${ACCENT}60`, boxShadow: 'none', minWidth: 200 }}><Typography sx={{ fontSize: 11, color: 'text.secondary', mb: 0.5 }}>Total Orden</Typography><Typography sx={{ fontSize: 24, fontWeight: 800, color: ACCENT }}>{formatCurrency(calculateTotal())}</Typography></Paper>
                <Box sx={{ display: 'flex', gap: 1 }}>{editingOrden && (<Button onClick={resetForm} variant="outlined" sx={{ borderRadius: 2, fontWeight: 600, borderColor: 'divider' }}>Cancelar</Button>)}<Button type="submit" variant="contained" sx={{ background: `linear-gradient(135deg, ${ACCENT}, #f472b6)`, boxShadow: `0 4px 14px rgba(236,72,153,0.35)`, borderRadius: 2, fontWeight: 600, px: 4 }}>{editingOrden ? 'Actualizar Orden' : 'Guardar y Asignar'}</Button></Box>
              </Box>
            </Box>
          </Box>
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          <Box sx={{ px: { xs: 2, md: 3 }, pb: 3 }}>

            {/* Search bar + CSV export */}
            <Box sx={{ display: 'flex', gap: 1.5, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
              <TextField
                size="small"
                placeholder="Buscar por #, cliente, operador..."
                value={busqueda}
                onChange={e => { setBusqueda(e.target.value); setPage(0); }}
                InputProps={{ startAdornment: <InputAdornment position="start"><Search sx={{ fontSize: 18, color: 'text.disabled' }} /></InputAdornment> }}
                sx={{ minWidth: 260, flex: 1 }}
              />
              <Button variant="outlined" startIcon={<FileDownload />} onClick={handleExportCSV} disabled={ordenesFiltradas.length === 0} sx={{ borderRadius: 2, fontWeight: 600 }}>CSV</Button>
            </Box>

            {/* Status filter chips */}
            <Box sx={{ display: 'flex', gap: 0.8, mb: 2.5, flexWrap: 'wrap' }}>
              {ESTADOS.map(e => (
                <Chip
                  key={e}
                  label={`${e === 'todos' ? 'Todos' : e} (${estadoCounts[e]})`}
                  size="small"
                  onClick={() => { setFiltroEstado(e); setPage(0); }}
                  sx={{
                    borderRadius: 1.5, fontWeight: 600, cursor: 'pointer',
                    bgcolor: filtroEstado === e ? ACCENT : 'transparent',
                    color: filtroEstado === e ? '#fff' : 'text.secondary',
                    border: '1px solid', borderColor: filtroEstado === e ? ACCENT : 'divider',
                  }}
                />
              ))}
            </Box>

            {/* Date preset chips */}
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
              {PRESETS.map(p => (
                <Chip key={p.key} label={p.label} size="small" variant="outlined"
                  icon={<Today sx={{ fontSize: '14px !important' }} />}
                  onClick={() => applyPreset(p.key)}
                  sx={{ borderRadius: 1.5, fontWeight: 600, cursor: 'pointer' }}
                />
              ))}
            </Stack>

            {/* Date and client/operator filters */}
            <Grid container spacing={2} sx={{ mb: 2.5 }}>
              <Grid item xs={6} sm={3}><TextField type="date" label="Fecha Inicio" value={startDate} onChange={e => setStartDate(e.target.value)} InputLabelProps={{ shrink: true }} fullWidth size="small" /></Grid>
              <Grid item xs={6} sm={3}><TextField type="date" label="Fecha Fin" value={endDate} onChange={e => setEndDate(e.target.value)} InputLabelProps={{ shrink: true }} fullWidth size="small" /></Grid>
              <Grid item xs={12} sm={3}><Autocomplete options={clientes} getOptionLabel={(o) => o.nombre} value={selectedClient} onChange={(_, v) => setSelectedClient(v)} renderInput={(params) => <TextField {...params} label="Filtrar por cliente" fullWidth size="small" />} /></Grid>
              {user?.role?.name === 'Admin' && (<Grid item xs={12} sm={3}><Autocomplete options={operators} getOptionLabel={(o) => o.username} value={selectedOperator} onChange={(_, v) => setSelectedOperator(v)} renderInput={(params) => <TextField {...params} label="Filtrar por operador" fullWidth size="small" />} /></Grid>)}
            </Grid>

            {isMobile ? (
              <Box>
                {ordenesFiltradas.length === 0 ? (
                  <Box sx={{ textAlign: 'center', py: 6, color: 'text.secondary' }}><Assignment sx={{ fontSize: 48, mb: 1, opacity: 0.3 }} /><Typography>No hay órdenes registradas</Typography></Box>
                ) : (
                  ordenesFiltradas.map(orden => <OrdenCard key={orden.id} orden={orden} onEdit={(o) => { setEditingOrden(o); setTabValue(0); }} onView={(o) => { setSelectedOrden(o); setShowDetailDialog(true); }} onApprove={handleApprove} onReject={handleOpenRejectDialog} onClose={handleCloseOrder} user={user} />)
                )}
              </Box>
            ) : (
              <>
                <TableContainer sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <SortTh col="id">ID</SortTh>
                        <SortTh col="cliente">Cliente</SortTh>
                        <TableCell sx={{ fontWeight: 800 }}>Operador</TableCell>
                        <TableCell sx={{ fontWeight: 800 }}>Servicios/Productos</TableCell>
                        <SortTh col="total" align="right">Total</SortTh>
                        <SortTh col="estado">Estado</SortTh>
                        <SortTh col="fecha">Fecha</SortTh>
                        <TableCell sx={{ fontWeight: 800 }}>Acciones</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {ordenesPaginadas.length === 0 ? <TableRow><TableCell colSpan={8} sx={{ textAlign: 'center', py: 6, color: 'text.secondary' }}>No hay órdenes registradas</TableCell></TableRow> : (
                        ordenesPaginadas.map(orden => (
                          <TableRow key={orden.id} hover>
                            <TableCell sx={{ fontWeight: 600, color: 'text.secondary' }}>#{orden.id}</TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>{orden.cliente?.nombre}</TableCell>
                            <TableCell sx={{ fontSize: 12 }}>{orden.operador?.username}</TableCell>
                            <TableCell sx={{ fontSize: 11 }}>
                              {orden.servicios?.length > 0 && <Box sx={{ color: BLUE, fontWeight: 600 }}>{orden.servicios.map(s => s.servicio.nombre).join(', ')}</Box>}
                              {orden.productos?.length > 0 && <Box sx={{ color: 'text.secondary' }}>{orden.productos.map(p => `${p.producto.nombre} ×${p.cantidad}`).join(', ')}</Box>}
                            </TableCell>
                            <TableCell sx={{ fontWeight: 700, textAlign: 'right' }}>{formatCurrency(orden.total)}</TableCell>
                            <TableCell>
                              {(() => {
                                const map = {
                                  'Borrador': { label: 'Borrador', color: 'default' },
                                  'Pendiente': { label: 'Pendiente', color: 'info' },
                                  'Iniciada': { label: 'Iniciada', color: 'primary' },
                                  'En revisión': { label: 'En Revisión', color: 'warning' },
                                  'Aprobada': { label: 'Aprobada', color: 'success' },
                                  'Rechazada': { label: 'Rechazada', color: 'error' },
                                  'Cerrada': { label: 'Cerrada', color: 'default' },
                                };
                                const props = map[orden.estado] || { label: orden.estado, color: 'default' };
                                return <Chip label={props.label} color={props.color} size="small" sx={{ fontWeight: 600, fontSize: 10, borderRadius: 1.5 }} />;
                              })()}
                            </TableCell>
                            <TableCell sx={{ fontSize: 11, whiteSpace: 'nowrap' }}>{new Date(orden.fecha_creacion + 'Z').toLocaleDateString()}</TableCell>
                            <TableCell>
                              <Tooltip title="Ver detalles"><IconButton size="small" onClick={() => { setSelectedOrden(orden); setShowDetailDialog(true); }} sx={{ color: BLUE, '&:hover': { bgcolor: '#EFF6FF' } }}><Visibility fontSize="small" /></IconButton></Tooltip>
                              {(orden.estado === 'Borrador' || orden.estado === 'Pendiente' || orden.estado === 'Rechazada') && (
                                <>
                                  <Tooltip title="Editar"><IconButton size="small" onClick={() => { setEditingOrden(orden); setTabValue(0); }} sx={{ color: ACCENT, '&:hover': { bgcolor: `${ACCENT}12` } }}><Edit fontSize="small" /></IconButton></Tooltip>
                                </>
                              )}
                              {user?.role?.name === 'Admin' && (orden.estado === 'Aprobada' || orden.estado === 'Rechazada') && (
                                <Tooltip title="Cerrar orden"><IconButton size="small" onClick={() => handleCloseOrder(orden)} sx={{ color: GREEN, '&:hover': { bgcolor: `${GREEN}12` } }}><CheckCircle fontSize="small" /></IconButton></Tooltip>
                              )}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
                <TablePagination
                  component="div"
                  count={ordenesFiltradas.length}
                  page={page}
                  onPageChange={(_, p) => setPage(p)}
                  rowsPerPage={rowsPerPage}
                  onRowsPerPageChange={e => { setRowsPerPage(parseInt(e.target.value)); setPage(0); }}
                  rowsPerPageOptions={[10, 15, 25, 50]}
                  labelRowsPerPage="Filas:"
                  labelDisplayedRows={({ from, to, count }) => `${from}-${to} de ${count}`}
                />
              </>
            )}
          </Box>
        </TabPanel>

        {user?.role?.name === 'Admin' && (
          <TabPanel value={tabValue} index={2}>
            <Box sx={{ px: { xs: 2, md: 3 }, pb: 3 }}>
              {isMobile ? (
                <Box>
                  {ordenesParaAprobar.length === 0 ? (
                    <Box sx={{ textAlign: 'center', py: 6, color: 'text.secondary' }}><CheckCircle sx={{ fontSize: 48, mb: 1, opacity: 0.3 }} /><Typography>No hay órdenes pendientes de aprobación</Typography></Box>
                  ) : (
                    ordenesParaAprobar.map(orden => <OrdenCard key={orden.id} orden={orden} onView={(o) => { setSelectedOrden(o); setShowDetailDialog(true); }} onApprove={handleApprove} onReject={handleOpenRejectDialog} user={user} />)
                  )}
                </Box>
              ) : (
                <TableContainer sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        {['ID', 'Cliente', 'Operador', 'Servicios / Productos', 'Total', 'Fecha', 'Acciones'].map(h => <TableCell key={h} sx={{ fontWeight: 800 }}>{h}</TableCell>)}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {ordenesParaAprobar.length === 0 ? <TableRow><TableCell colSpan={7} sx={{ textAlign: 'center', py: 6, color: 'text.secondary' }}>No hay órdenes pendientes de aprobación</TableCell></TableRow> : (
                        ordenesParaAprobar.map(orden => (
                          <TableRow key={orden.id} hover>
                            <TableCell sx={{ fontWeight: 600, color: 'text.secondary' }}>#{orden.id}</TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>{orden.cliente?.nombre}</TableCell>
                            <TableCell sx={{ fontSize: 12 }}>{orden.operador?.username}</TableCell>
                            <TableCell sx={{ fontSize: 11 }}>
                              {orden.servicios?.length > 0 && <Box sx={{ color: BLUE, fontWeight: 600 }}>{orden.servicios.map(s => s.servicio.nombre).join(', ')}</Box>}
                              {orden.productos?.length > 0 && <Box sx={{ color: 'text.secondary' }}>{orden.productos.map(p => `${p.producto.nombre} ×${p.cantidad}`).join(', ')}</Box>}
                            </TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>{formatCurrency(orden.total)}</TableCell>
                            <TableCell sx={{ fontSize: 11 }}>{new Date(orden.fecha_creacion + 'Z').toLocaleDateString()}</TableCell>
                            <TableCell>
                              <Tooltip title="Ver detalles"><IconButton size="small" onClick={() => { setSelectedOrden(orden); setShowDetailDialog(true); }} sx={{ color: BLUE, '&:hover': { bgcolor: '#EFF6FF' } }}><Visibility fontSize="small" /></IconButton></Tooltip>
                              <Tooltip title="Aprobar"><IconButton size="small" onClick={() => handleApprove(orden.id)} sx={{ color: GREEN, '&:hover': { bgcolor: `${GREEN}12` } }}><CheckCircle fontSize="small" /></IconButton></Tooltip>
                              <Tooltip title="Rechazar"><IconButton size="small" onClick={() => handleOpenRejectDialog(orden)} sx={{ color: RED, '&:hover': { bgcolor: `${RED}12` } }}><Cancel fontSize="small" /></IconButton></Tooltip>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Box>
          </TabPanel>
        )}
      </Paper>

      <ConfirmationDialog open={showConfirmDialog} handleClose={() => setShowConfirmDialog(false)} handleConfirm={confirmAction} title="Confirmar Acción" message={ordenAction.message} />
      <RechazoDialog open={showRechazoDialog} handleClose={() => setShowRechazoDialog(false)} handleConfirm={handleConfirmReject} />
      <OrdenTrabajoDetailDialog open={showDetailDialog} handleClose={() => { setSelectedOrden(null); setShowDetailDialog(false); }} orden={selectedOrden} />
      <CloseOrderPaymentDialog open={showCloseOrderPaymentDialog} handleClose={() => setShowCloseOrderPaymentDialog(false)} orden={ordenToClose} onConfirmClose={handleConfirmCloseOrderWithPayment} />
      <QuickCreateModal open={quickCreate.open} onClose={closeQuickCreate} type={quickCreate.type} initialName={quickCreate.initialName} onCreated={handleQuickCreated} />
    </Box>
  );
};

export default OrdenesTrabajo;
