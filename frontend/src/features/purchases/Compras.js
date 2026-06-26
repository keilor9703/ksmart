import React, { useState, useEffect, useMemo } from 'react';
import {
  Box, Paper, Typography, Tabs, Tab, TextField, MenuItem, Button,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TableSortLabel,
  IconButton, Grid, Divider, useTheme, Chip, TablePagination, Autocomplete,
  Dialog, DialogTitle, DialogContent, DialogActions, Select, FormControl, InputLabel,
  List, ListItem, ListItemText, Tooltip, InputAdornment, useMediaQuery, Stack, Alert,
  CircularProgress,
} from '@mui/material';
import {
  Add, Delete, ShoppingBag, Receipt, Payment, CheckCircle,
  Visibility, Search, TrendingDown, AttachMoney, Warning, MoneyOff,
  LocalShipping, Close, Science, Edit, Print, FilterList, Category, CalendarToday,
} from '@mui/icons-material';
import apiClient, { createCompra, addPagoCompra } from '../../api';
import { formatCurrency } from '../../utils/formatters';
import { toast } from 'react-toastify';
import CurrencyField from '../../components/common/CurrencyField';
import QuickCreateModal from '../../components/common/QuickCreateModal';
import HelpGuideTopBar from '../../components/onboarding/HelpGuideTopBar';

// ─── Constantes ────────────────────────────────────────────────────────────────
const ACCENT  = '#6366F1';
const GREEN   = '#10B981';
const RED     = '#EF4444';
const BLUE    = '#3B82F6';
const YELLOW  = '#F59E0B';

const CATEGORIAS_GASTO = [
  'Arriendo', 'Servicios públicos', 'Nómina', 'Domicilios', 'Papelería',
  'Mantenimiento', 'Transporte', 'Publicidad', 'Impuestos', 'Otro',
];

// ─── TabPanel ─────────────────────────────────────────────────────────────────
function TabPanel({ children, value, index }) {
  return (
    <div role="tabpanel" hidden={value !== index}>
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
const KpiCard = ({ label, value, icon, color, sub }) => (
  <Paper sx={{ p: 2.5, borderRadius: 3, display: 'flex', alignItems: 'center', gap: 2, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', height: '100%' }}>
    <Box sx={{ width: 48, height: 48, borderRadius: 2, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: `${color}18`, color }}>
      {icon}
    </Box>
    <Box>
      <Typography sx={{ fontSize: 12, color: 'text.secondary', fontWeight: 500, mb: 0.3 }}>{label}</Typography>
      <Typography sx={{ fontSize: 18, fontWeight: 700, color: 'text.primary' }}>{value}</Typography>
      {sub && <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{sub}</Typography>}
    </Box>
  </Paper>
);

// ─── Chip de estado ───────────────────────────────────────────────────────────
const EstadoChip = ({ estado }) => {
  const map = {
    pagado:    { label: 'Pagada',    color: 'success' },
    parcial:   { label: 'Parcial',   color: 'warning' },
    pendiente: { label: 'Pendiente', color: 'error'   },
  };
  const p = map[estado] || { label: estado, color: 'default' };
  return <Chip label={p.label} color={p.color} size="small" sx={{ fontWeight: 600, fontSize: 11, borderRadius: 1.5 }} />;
};

// ─── Sección label ────────────────────────────────────────────────────────────
const SectionLabel = ({ children }) => (
  <Typography sx={{ fontWeight: 600, fontSize: 11, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.8, mb: 1.5 }}>
    {children}
  </Typography>
);

// ─── PDF Orden de Compra ──────────────────────────────────────────────────────
const fmtOCNum = (c) => {
  const year = c.fecha ? new Date(c.fecha).getFullYear() : new Date().getFullYear();
  return `OC-${year}-${String(c.id).padStart(4, '0')}`;
};

const handlePrintOC = (compra) => {
  const empresa = localStorage.getItem('empresa_nombre') || 'Mi Empresa';
  const rows = [...(compra.detalles || [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)).map((d, i) => {
    const sub = d.cantidad * d.precio_unitario;
    return `<tr style="${i % 2 === 0 ? 'background:#f8fafc' : ''}">
      <td style="padding:10px 12px">${d.nombre_libre || d.producto?.nombre || '—'}</td>
      <td style="padding:10px 12px;text-align:center">${d.cantidad} ${d.producto?.unidad_medida || ''}</td>
      <td style="padding:10px 12px;text-align:right">${sub.toLocaleString('es-CO',{style:'currency',currency:'COP',maximumFractionDigits:0})}</td>
      ${d.numero_lote ? `<td style="padding:10px 12px;text-align:center;font-size:11px">${d.numero_lote} / Vence: ${d.fecha_vencimiento || '—'}</td>` : '<td style="padding:10px 12px;text-align:center;color:#94a3b8">—</td>'}
    </tr>`;
  }).join('');

  const subtotal = (compra.detalles || []).reduce((s, d) => s + d.cantidad * d.precio_unitario, 0);
  const ivaAmt   = subtotal * (compra.iva_porcentaje || 0) / 100;
  const total    = subtotal + ivaAmt;

  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>${fmtOCNum(compra)}</title>
  <style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Segoe UI',Arial,sans-serif;font-size:13px;color:#1F1F1F;padding:40px;max-width:850px;margin:0 auto}
  .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px;padding-bottom:20px;border-bottom:3px solid ${GREEN}}
  .company{font-size:22px;font-weight:800;color:${GREEN};margin-bottom:4px}
  .badge{background:${GREEN};color:white;padding:10px 18px;border-radius:10px;font-size:20px;font-weight:800;text-align:right}
  .sub-badge{font-size:11px;opacity:0.8;margin-top:4px}
  .info-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px}
  .info-box{padding:14px;background:#f8fafc;border-radius:8px;border-left:4px solid ${GREEN}}
  .info-label{font-size:10px;text-transform:uppercase;color:#64748b;font-weight:700;letter-spacing:0.5px;margin-bottom:4px}
  .info-value{font-size:14px;font-weight:600}
  table{width:100%;border-collapse:collapse;margin-bottom:24px}
  th{background:${GREEN};color:white;padding:10px 12px;text-align:left;font-size:11px;text-transform:uppercase;font-weight:700}
  td{border-bottom:1px solid #e2e8f0}
  .totals-box{margin-left:auto;width:280px;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden}
  .total-row{display:flex;justify-content:space-between;padding:10px 16px;font-size:13px;border-bottom:1px solid #e2e8f0}
  .total-final{background:${GREEN};color:white;font-size:16px;font-weight:800}
  .obs-box{padding:14px 18px;background:#f0fdf4;border:1px solid #86efac;border-radius:8px;margin-bottom:24px}
  .footer{margin-top:40px;padding-top:16px;border-top:1px solid #e2e8f0;color:#94a3b8;font-size:11px;text-align:center}
  @media print{.print-btn{display:none}}</style></head>
  <body>
  <div style="margin-bottom:16px;text-align:right"><button class="print-btn" onclick="window.print()" style="background:${GREEN};color:white;border:none;padding:10px 24px;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer">🖨 Imprimir / Guardar PDF</button></div>
  <div class="header">
    <div><div class="company">${empresa}</div><div style="font-size:12px;color:#64748b;margin-top:2px">Orden de Compra</div></div>
    <div class="badge">${fmtOCNum(compra)}<div class="sub-badge">Fecha: ${new Date(compra.fecha).toLocaleDateString('es-CO')}</div></div>
  </div>
  <div class="info-grid">
    <div class="info-box"><div class="info-label">Proveedor</div><div class="info-value">${compra.proveedor?.nombre || '—'}</div>${compra.proveedor?.cedula ? `<div style="font-size:12px;color:#64748b;margin-top:2px">NIT/CC: ${compra.proveedor.cedula}</div>` : ''}</div>
    <div class="info-box"><div class="info-label">Referencia Factura</div><div class="info-value">${compra.referencia_factura || 'Sin referencia'}</div></div>
    <div class="info-box"><div class="info-label">Estado de Pago</div><div class="info-value">${compra.estado_pago === 'pagado' ? '✓ Pagada' : compra.estado_pago === 'parcial' ? 'Parcial' : 'Pendiente'}</div></div>
    <div class="info-box"><div class="info-label">IVA aplicado</div><div class="info-value">${compra.iva_porcentaje || 0}%</div></div>
  </div>
  ${compra.observaciones ? `<div class="obs-box"><strong>Observaciones:</strong> ${compra.observaciones}</div>` : ''}
  <table><thead><tr><th>Producto / Insumo</th><th style="text-align:center">Cant.</th><th style="text-align:right">Costo Unit.</th><th style="text-align:center">Lote / Vencimiento</th></tr></thead>
  <tbody>${rows}</tbody></table>
  <div class="totals-box">
    <div class="total-row"><span>Subtotal</span><span>${subtotal.toLocaleString('es-CO',{style:'currency',currency:'COP',maximumFractionDigits:0})}</span></div>
    <div class="total-row"><span>IVA (${compra.iva_porcentaje || 0}%)</span><span>${ivaAmt.toLocaleString('es-CO',{style:'currency',currency:'COP',maximumFractionDigits:0})}</span></div>
    <div class="total-row total-final"><span>TOTAL</span><span>${total.toLocaleString('es-CO',{style:'currency',currency:'COP',maximumFractionDigits:0})}</span></div>
  </div>
  <div class="footer">Orden generada con Ksmart360 · ${new Date().toLocaleString('es-CO')}</div>
  </body></html>`;

  const win = window.open('', '_blank', 'width=950,height=720');
  win.document.write(html);
  win.document.close();
};

// ─── Componente principal ──────────────────────────────────────────────────────
const Compras = () => {
  const theme    = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [tab, setTab]               = useState(0);
  const [proveedores, setProveedores] = useState([]);
  const [terceros, setTerceros]       = useState([]);
  const [productos, setProductos]     = useState([]);
  const [compras, setCompras]         = useState([]);
  const [loading, setLoading]         = useState(false);

  // Form
  const [proveedorSel, setProveedorSel]           = useState(null);
  const [proveedorInput, setProveedorInput]        = useState('');
  const [refFactura, setRefFactura]               = useState('');
  const [observaciones, setObservaciones]         = useState('');
  const [detalles, setDetalles] = useState([{ producto_id: '', cantidad: 1, precio_unitario: 0, numero_lote: '', fecha_vencimiento: '', fecha_fabricacion: '' }]);
  const [ivaPorcentajeGlobal, setIvaPorcentajeGlobal] = useState(0);
  const [pagadaAlCrear, setPagadaAlCrear]         = useState(false);

  // QuickCreate
  const [quickCreate, setQuickCreate] = useState({ open: false, type: 'tercero', initialName: '', targetIdx: null });
  const openQuickCreate = (type, initialName = '', targetIdx = null) => setQuickCreate({ open: true, type, initialName, targetIdx });
  const closeQuickCreate = () => setQuickCreate(q => ({ ...q, open: false }));

  const handleQuickCreated = (nuevoRegistro) => {
    if (quickCreate.type === 'tercero') {
      setProveedores(prev => [...prev, nuevoRegistro]);
      setProveedorSel(nuevoRegistro);
      setProveedorInput(nuevoRegistro.nombre);
    } else {
      setProductos(prev => [...prev, nuevoRegistro]);
      if (quickCreate.targetIdx !== null) handleDetalleChange(quickCreate.targetIdx, 'producto_id', nuevoRegistro.id);
    }
    closeQuickCreate();
  };

  // Pago
  const [openPayDialog, setOpenPayDialog]   = useState(false);
  const [selectedCompra, setSelectedCompra] = useState(null);
  const [montoAbono, setMontoAbono]         = useState('');
  const [metodoPago, setMetodoPago]         = useState('Transferencia');
  const [detallePago, setDetallePago]       = useState('');

  // Detalle
  const [openDetailDialog, setOpenDetailDialog] = useState(false);
  const [compraDetalle, setCompraDetalle]       = useState(null);

  // Editar / Eliminar
  const [editingCompraId, setEditingCompraId]   = useState(null);
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [deleteId, setDeleteId]                 = useState(null);
  const [submitting, setSubmitting]             = useState(false);

  // Filtros historial
  const [searchTerm, setSearchTerm]     = useState('');
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [fechaDesde, setFechaDesde]     = useState('');
  const [fechaHasta, setFechaHasta]     = useState('');
  const [sortBy, setSortBy]             = useState('fecha');
  const [sortDir, setSortDir]           = useState('desc');
  const [page, setPage]                 = useState(0);
  const [rowsPerPage, setRowsPerPage]   = useState(25);
  const [comprasTotal, setComprasTotal] = useState(0);
  const [comprasStats, setComprasStats] = useState({ sum_total: 0, sum_pagado: 0, sum_pendiente: 0 });
  const [historialLoading, setHistorialLoading] = useState(false);
  const [historialError, setHistorialError]     = useState('');

  // ── Estado Gastos ──────────────────────────────────────────────────────────
  const [gastos, setGastos]                   = useState([]);
  const [loadingGastos, setLoadingGastos]     = useState(false);
  const [editingGastoId, setEditingGastoId]   = useState(null);
  const [gastoTercero, setGastoTercero]       = useState(null);
  const [terceroInput, setTerceroInput]       = useState('');
  const [gastoMonto, setGastoMonto]           = useState('');
  const [gastoConcepto, setGastoConcepto]     = useState('');
  const [gastoMetodo, setGastoMetodo]         = useState('Efectivo');
  const [gastoFecha, setGastoFecha]           = useState(new Date().toISOString().slice(0,10));
  const [gastoCategoria, setGastoCategoria]   = useState('');
  const [busquedaGasto, setBusquedaGasto]     = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('');
  const [filtroMetodoPago, setFiltroMetodoPago] = useState('');
  const [gastosPage, setGastosPage]           = useState(0);
  const [gastosRpp, setGastosRpp]             = useState(10);
  const [deleteGastoId, setDeleteGastoId]     = useState(null);
  const [openDeleteGasto, setOpenDeleteGasto] = useState(false);

  // ── Carga inicial ──────────────────────────────────────────────────────────
  useEffect(() => { loadBaseData(); fetchHistorial(); fetchGastos(); }, []);

  const loadBaseData = async () => {
    try {
      const [provRes, prodRes] = await Promise.all([apiClient.get('/clientes/'), apiClient.get('/productos/?page_size=500')]);
      setProveedores(provRes.data.filter(c => c.es_proveedor));
      setTerceros(provRes.data);
      const prodData = Array.isArray(prodRes.data) ? prodRes.data : (prodRes.data.items || []);
      setProductos(prodData.filter(p => !p.es_servicio));
    } catch { toast.error('Error cargando proveedores/productos'); }
  };

  const fetchHistorial = async (p = 0, rpp = rowsPerPage, search = searchTerm, fi = fechaDesde, ff = fechaHasta, ep = filtroEstado) => {
    setHistorialLoading(true);
    setHistorialError('');
    try {
      const params = new URLSearchParams({ page: p + 1, page_size: rpp, search: search || '' });
      if (fi) params.set('fecha_inicio', fi);
      if (ff) params.set('fecha_fin', ff);
      if (ep && ep !== 'todos') params.set('estado_pago', ep);
      const res = await apiClient.get(`/compras/?${params}`);
      setCompras(res.data.items);
      setComprasTotal(res.data.total);
      setComprasStats(res.data.stats || { sum_total: 0, sum_pagado: 0, sum_pendiente: 0 });
    } catch {
      setHistorialError('No se pudo cargar el historial de compras.');
    } finally { setHistorialLoading(false); }
  };

  const [productoInputs, setProductoInputs] = useState(['']);
  const handleProductoInputChange = (idx, val) =>
    setProductoInputs(prev => { const next = [...prev]; next[idx] = val; return next; });

  const addDetalle = () => {
    setDetalles(p => [...p, { producto_id: '', nombre_libre: '', es_libre: false, cantidad: 1, precio_unitario: 0, numero_lote: '', fecha_vencimiento: '', fecha_fabricacion: '' }]);
    setProductoInputs(p => [...p, '']);
  };
  const removeDetalle = (idx) => {
    setDetalles(p => p.filter((_, i) => i !== idx));
    setProductoInputs(p => p.filter((_, i) => i !== idx));
  };
  const handleDetalleChange = (idx, field, val) =>
    setDetalles(p => p.map((d, i) => i === idx ? { ...d, [field]: val } : d));

  // ── Cálculos ───────────────────────────────────────────────────────────────
  const calcSubtotal = () => detalles.reduce((acc, d) => acc + d.cantidad * d.precio_unitario, 0);
  const calcIva      = () => calcSubtotal() * (parseFloat(ivaPorcentajeGlobal) || 0) / 100;
  const calcTotal    = () => calcSubtotal() + calcIva();

  const resetForm = () => {
    setProveedorSel(null); setProveedorInput(''); setRefFactura(''); setObservaciones('');
    setDetalles([{ producto_id: '', nombre_libre: '', es_libre: false, cantidad: 1, precio_unitario: 0, numero_lote: '', fecha_vencimiento: '', fecha_fabricacion: '' }]);
    setProductoInputs(['']);
    setIvaPorcentajeGlobal(0); setPagadaAlCrear(false);
  };

  // ── CRUD Gastos ────────────────────────────────────────────────────────────
  const fetchGastos = async () => {
    setLoadingGastos(true);
    try {
      const { data } = await apiClient.get('/caja/gastos');
      setGastos(data);
    } catch { toast.error('Error al cargar gastos'); }
    finally { setLoadingGastos(false); }
  };

  const resetGastoForm = () => {
    setEditingGastoId(null); setGastoTercero(null); setTerceroInput('');
    setGastoMonto(''); setGastoConcepto(''); setGastoMetodo('Efectivo');
    setGastoFecha(new Date().toISOString().slice(0,10)); setGastoCategoria('');
  };

  const handleRegistrarGasto = async (e) => {
    e?.preventDefault();
    if (!gastoTercero || !gastoMonto || !gastoConcepto) {
      toast.warning('Completa beneficiario, concepto y monto.'); return;
    }
    const payload = {
      tercero_id: gastoTercero.id, monto: parseFloat(gastoMonto),
      concepto: gastoConcepto, metodo_pago: gastoMetodo,
      fecha: gastoFecha, ...(gastoCategoria && { categoria: gastoCategoria }),
    };
    try {
      if (editingGastoId) {
        await apiClient.patch(`/caja/gastos/${editingGastoId}`, payload);
        toast.success('Gasto actualizado');
      } else {
        await apiClient.post('/caja/gastos', payload);
        toast.success('Gasto registrado');
      }
      resetGastoForm(); fetchGastos();
    } catch (err) { toast.error(err.response?.data?.detail || 'Error al guardar el gasto'); }
  };

  const handleEditGasto = (g) => {
    setEditingGastoId(g.id); setGastoTercero(g.tercero); setTerceroInput(g.tercero?.nombre || '');
    setGastoMonto(String(g.monto)); setGastoConcepto(g.concepto || '');
    setGastoMetodo(g.metodo_pago || 'Efectivo');
    setGastoFecha(g.fecha ? g.fecha.slice(0,10) : new Date().toISOString().slice(0,10));
    setGastoCategoria(g.categoria || '');
  };

  const handleDeleteGasto = (id) => { setDeleteGastoId(id); setOpenDeleteGasto(true); };
  const handleConfirmDeleteGasto = async () => {
    try {
      await apiClient.delete(`/caja/gastos/${deleteGastoId}`);
      toast.success('Gasto eliminado'); setOpenDeleteGasto(false); fetchGastos();
    } catch { toast.error('Error al eliminar el gasto'); }
    finally { setDeleteGastoId(null); }
  };

  const handleSubmit = async () => {
    if (!proveedorSel || detalles.some(d => (!d.es_libre && !d.producto_id) || (d.es_libre && !d.nombre_libre?.trim()) || d.cantidad <= 0)) {
      toast.warning('Complete el proveedor y todos los ítems de compra.');
      return;
    }
    for (let d of detalles) {
      if (d.es_libre) continue;
      const prod = productos.find(p => p.id === parseInt(d.producto_id));
      if (prod?.maneja_lotes && (!d.numero_lote || !d.fecha_vencimiento)) {
        toast.warning(`El producto "${prod.nombre}" es perecedero. Ingresa el Lote y Vencimiento.`);
        return;
      }
    }
    setLoading(true);
    try {
      const payload = {
        proveedor_id: proveedorSel.id,
        referencia_factura: refFactura,
        observaciones: observaciones || null,
        detalles: detalles.map((d, idx) => ({
          producto_id:     d.es_libre ? null : (parseInt(d.producto_id) || null),
          nombre_libre:    d.es_libre ? d.nombre_libre.trim() : null,
          sort_order:      idx,
          cantidad:        parseFloat(d.cantidad),
          precio_unitario: parseFloat(d.precio_unitario),
          iva_porcentaje:  0.0,
          numero_lote:        d.numero_lote || undefined,
          fecha_vencimiento:  d.fecha_vencimiento || undefined,
          fecha_fabricacion:  d.fecha_fabricacion || undefined,
        })),
        pagada: pagadaAlCrear,
        iva_porcentaje: parseFloat(ivaPorcentajeGlobal),
      };
      if (editingCompraId) {
        await apiClient.patch(`/compras/${editingCompraId}`, payload);
        toast.success('Compra actualizada e inventario ajustado.');
      } else {
        await createCompra(payload);
        toast.success('Compra registrada e inventario actualizado.');
      }
      resetForm(); setEditingCompraId(null); fetchHistorial(); setTab(1);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al procesar compra');
    } finally { setLoading(false); }
  };

  const handleEditCompra = (c) => {
    setEditingCompraId(c.id);
    setProveedorSel(c.proveedor);
    setProveedorInput(c.proveedor.nombre);
    setRefFactura(c.referencia_factura || '');
    setObservaciones(c.observaciones || '');
    setIvaPorcentajeGlobal(c.iva_porcentaje || 0);
    setPagadaAlCrear(c.estado_pago === 'pagado');
    const d = [...c.detalles]
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      .map(item => ({
        es_libre: !item.producto_id,
        producto_id: item.producto_id || '',
        nombre_libre: item.nombre_libre || '',
        cantidad: item.cantidad,
        precio_unitario: item.precio_unitario,
        numero_lote: item.numero_lote || '',
        fecha_vencimiento: item.fecha_vencimiento || '',
        fecha_fabricacion: item.fecha_fabricacion || '',
      }));
    setDetalles(d);
    setProductoInputs(d.map(item => item.es_libre ? '' : (productos.find(p => p.id === item.producto_id)?.nombre || '')));
    setTab(0);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteCompra = (id) => { setDeleteId(id); setOpenDeleteDialog(true); };

  const handleConfirmDelete = async () => {
    setSubmitting(true);
    try {
      await apiClient.delete(`/compras/${deleteId}`);
      toast.success('Compra eliminada e inventario revertido');
      setOpenDeleteDialog(false);
      fetchHistorial();
    } catch { toast.error('Error al eliminar la compra'); }
    finally { setSubmitting(false); setDeleteId(null); }
  };

  // ── Pagos ──────────────────────────────────────────────────────────────────
  const handleOpenPay = (compra) => {
    setSelectedCompra(compra);
    setMontoAbono(compra.total - compra.monto_pagado);
    setDetallePago(''); setOpenPayDialog(true);
  };

  const handleConfirmPago = async () => {
    if (!montoAbono || montoAbono <= 0) { toast.warning('Ingrese un monto válido.'); return; }
    try {
      await addPagoCompra({ compra_id: selectedCompra.id, monto: parseFloat(montoAbono), metodo_pago: metodoPago, detalle_pago: detallePago });
      toast.success('Pago registrado correctamente');
      setOpenPayDialog(false); fetchHistorial();
    } catch (err) { toast.error(err.response?.data?.detail || 'Error al registrar el pago'); }
  };

  // ── Sort historial ─────────────────────────────────────────────────────────
  const handleSort = (col) => {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('desc'); }
    setPage(0);
  };

  // ── Filtros + stats ────────────────────────────────────────────────────────
  const now = new Date();
  const inicioMes = new Date(now.getFullYear(), now.getMonth(), 1);

  const filteredGastos = useMemo(() => {
    return gastos.filter(g => {
      if (filtroCategoria && g.categoria !== filtroCategoria) return false;
      if (filtroMetodoPago && g.metodo_pago !== filtroMetodoPago) return false;
      if (busquedaGasto) {
        const q = busquedaGasto.toLowerCase();
        if (!g.tercero?.nombre?.toLowerCase().includes(q) &&
            !g.concepto?.toLowerCase().includes(q) &&
            !g.categoria?.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [gastos, busquedaGasto, filtroCategoria, filtroMetodoPago]);

  const paginatedGastos = filteredGastos.slice(gastosPage * gastosRpp, gastosPage * gastosRpp + gastosRpp);
  const gastosTotalMes  = useMemo(() => {
    const m = new Date().toISOString().slice(0,7);
    return gastos.filter(g => g.fecha?.startsWith(m)).reduce((s,g) => s + g.monto, 0);
  }, [gastos]);

  const cuentasPorPagar   = compras.filter(c => c.estado_pago !== 'pagado');
  const totalPorPagar     = cuentasPorPagar.reduce((s, c) => s + (c.total - c.monto_pagado), 0);
  const totalCompras      = compras.reduce((s, c) => s + c.total, 0);
  const comprasMes        = compras.filter(c => new Date(c.fecha) >= inicioMes);
  const totalMes          = comprasMes.reduce((s, c) => s + c.total, 0);

  // proveedor más frecuente del mes
  const topProv = useMemo(() => {
    const cnt = {};
    comprasMes.forEach(c => { cnt[c.proveedor.nombre] = (cnt[c.proveedor.nombre] || 0) + 1; });
    const entries = Object.entries(cnt);
    if (!entries.length) return null;
    return entries.sort((a, b) => b[1] - a[1])[0][0];
  }, [comprasMes]);

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <Box sx={{ width: '100%' }}>

      {/* ── Header ── */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ width: 40, height: 40, borderRadius: 2, bgcolor: `${GREEN}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: GREEN }}>
            <ShoppingBag />
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 700, fontSize: 20, lineHeight: 1.2 }}>Compras</Typography>
            <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>Gestión de proveedores y cuentas por pagar</Typography>
          </Box>
          <HelpGuideTopBar
            moduleName="Compras"
            moduleColor={GREEN}
            steps={[
              { title: 'Selecciona el proveedor', description: 'Busca el proveedor o créalo directamente desde el campo de búsqueda. Quedará guardado para futuras compras.' },
              { title: 'Agrega los productos comprados', description: 'Busca cada producto, ingresa la cantidad recibida y el precio unitario. El costo se actualiza automáticamente.' },
              { title: 'Registra el pago', description: 'Indica si la compra fue pagada de inmediato o queda pendiente (a crédito). Puedes hacer pagos parciales después.' },
              { title: 'Revisa el historial', description: 'En la pestaña "Historial" puedes ver, filtrar y gestionar todas las compras registradas.' },
            ]}
            faqItems={[
              { q: '¿Cómo registro un pago parcial a un proveedor?', a: 'En el historial, selecciona la compra con saldo pendiente y usa el botón de pago para ingresar el monto abonado.' },
              { q: '¿El stock se actualiza al registrar una compra?', a: 'Sí, cuando registras una compra el sistema aumenta automáticamente el stock de los productos incluidos.' },
              { q: '¿Puedo editar una compra ya registrada?', a: 'Sí, pero ten en cuenta que los cambios afectan el inventario. Edita solo si es necesario corregir un error.' },
              { q: '¿Cómo veo el historial de un proveedor específico?', a: 'En el historial de compras, usa el filtro de búsqueda para escribir el nombre del proveedor y ver solo sus registros.' },
            ]}
          />
        </Box>
        <Button
          variant="contained" startIcon={<Add />}
          onClick={() => { resetForm(); setEditingCompraId(null); setTab(0); }}
          sx={{ background: `linear-gradient(135deg, ${GREEN}, #34d399)`, boxShadow: `0 4px 14px rgba(16,185,129,0.35)`, borderRadius: 2, fontWeight: 600 }}
        >
          Nueva Compra
        </Button>
      </Box>

      {/* ── KPIs ── */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <KpiCard label="Total compras" value={formatCurrency(totalCompras)} icon={<TrendingDown />} color={GREEN} sub={`${compras.length} registros`} />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <KpiCard label="Este mes" value={formatCurrency(totalMes)} icon={<Receipt />} color={BLUE} sub={`${comprasMes.length} compras`} />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <KpiCard label="Facturas pendientes" value={cuentasPorPagar.length} icon={<Warning />} color={YELLOW} sub="sin saldar" />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <KpiCard label="Total por pagar" value={formatCurrency(totalPorPagar)} icon={<AttachMoney />} color={RED} sub={topProv ? `Top: ${topProv}` : undefined} />
        </Grid>
      </Grid>

      {/* ── Tabs ── */}
      <Paper sx={{ borderRadius: 3, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} variant={isMobile ? 'scrollable' : 'standard'} scrollButtons="auto" sx={{
          px: 2, borderBottom: '1px solid', borderColor: 'divider',
          '& .MuiTab-root': { fontWeight: 600, fontSize: 13, textTransform: 'none', minHeight: 52 },
          '& .MuiTabs-indicator': { backgroundColor: GREEN, height: 3, borderRadius: 3 },
          '& .Mui-selected': { color: `${GREEN} !important` },
        }}>
          <Tab label={editingCompraId ? '✏️ Editando Compra' : '➕ Registrar Compra'} />
          <Tab label={`📋 Historial (${comprasTotal})`} />
          <Tab label={`⚠️ Por Pagar (${cuentasPorPagar.length})`} />
          <Tab label={`💸 Gastos (${gastos.length})`} />
        </Tabs>

        {/* ══ Tab 0: Registrar ══ */}
        <TabPanel value={tab} index={0}>
          <Box sx={{ p: { xs: 2, md: 3 } }}>
            {editingCompraId && (
              <Alert severity="warning" sx={{ mb: 2.5, borderRadius: 2 }}>
                Editando compra #{editingCompraId} — El inventario será ajustado al guardar.
              </Alert>
            )}

            <SectionLabel>Información de la compra</SectionLabel>
            <Stack direction="column" spacing={1.5} sx={{ mb: 3 }}>
              {/* Proveedor */}
              <Autocomplete
                options={proveedores} getOptionLabel={(o) => o.nombre || ''}
                value={proveedorSel} onChange={(_, v) => setProveedorSel(v)}
                inputValue={proveedorInput} onInputChange={(_, v) => setProveedorInput(v)}
                filterOptions={(opts, state) => {
                  const q = (state.inputValue || '').toLowerCase().trim();
                  if (!q) return opts;
                  return opts.filter(o => o.nombre.toLowerCase().includes(q) || (o.cedula || '').toLowerCase().includes(q));
                }}
                noOptionsText={
                  <Box sx={{ py: 0.5 }}>
                    <Typography sx={{ fontSize: 13, color: 'text.secondary', mb: 1 }}>No se encontró ningún proveedor</Typography>
                    <Button size="small" variant="contained" fullWidth startIcon={<Add />} onClick={() => openQuickCreate('tercero', proveedorInput)} sx={{ borderRadius: 2, fontWeight: 600, fontSize: 12, bgcolor: BLUE }}>
                      Crear "{proveedorInput || 'nuevo proveedor'}"
                    </Button>
                  </Box>
                }
                renderOption={(props, option) => (
                  <li {...props} key={option.id} style={{ padding: '8px 12px' }}>
                    <Box>
                      <Typography sx={{ fontSize: 14, fontWeight: 600 }}>{option.nombre}</Typography>
                      <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>NIT/CC: {option.cedula || 'Sin identificación'}</Typography>
                    </Box>
                  </li>
                )}
                renderInput={(params) => (
                  <TextField {...params} label="Proveedor (busca por nombre o NIT)" required fullWidth size="small" placeholder="Escribe para buscar…"
                    InputProps={{ ...params.InputProps, endAdornment: (<>{params.InputProps.endAdornment}<Tooltip title="Crear nuevo proveedor"><IconButton size="small" onClick={() => openQuickCreate('tercero', proveedorInput)} sx={{ color: BLUE, p: 0.5 }}><Add fontSize="small" /></IconButton></Tooltip></>) }}
                  />
                )}
                fullWidth
              />

              {/* Referencia */}
              <TextField fullWidth label="Referencia / Nro. Factura Proveedor" value={refFactura} onChange={(e) => setRefFactura(e.target.value)} size="small" />

              {/* IVA + Pagada */}
              <Box sx={{ display: 'flex', gap: 1.5 }}>
                <TextField label="% IVA Global" type="number" value={ivaPorcentajeGlobal} onChange={(e) => setIvaPorcentajeGlobal(e.target.value)} helperText="IVA incluido" size="small" sx={{ flex: 1 }} />
                <Button variant={pagadaAlCrear ? 'contained' : 'outlined'} size="small" onClick={() => setPagadaAlCrear(p => !p)}
                  sx={{ borderRadius: 2, fontWeight: 600, fontSize: 12, height: 40, flexShrink: 0, ...(pagadaAlCrear ? { bgcolor: GREEN, '&:hover': { bgcolor: '#059669' }, borderColor: GREEN } : { borderColor: 'divider', color: 'text.secondary' }) }}>
                  {pagadaAlCrear ? '✓ Pagada' : 'Pagada'}
                </Button>
              </Box>

              {/* Observaciones */}
              <TextField fullWidth multiline rows={2} label="Notas / Observaciones (opcional)" value={observaciones} onChange={e => setObservaciones(e.target.value)} placeholder="Ej: Descuento negociado, compra urgente, condiciones especiales…" size="small" />
            </Stack>

            {/* Detalle de ítems */}
            <Box sx={{ mb: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <SectionLabel>Productos / Insumos</SectionLabel>
                <Button size="small" startIcon={<Add />} onClick={addDetalle} sx={{ color: GREEN, fontWeight: 600 }}>Añadir ítem</Button>
              </Box>

              {detalles.map((det, idx) => {
                const prodSel = det.es_libre ? null : productos.find(p => p.id === parseInt(det.producto_id));
                return (
                  <Box key={idx} sx={{ mb: 1.5, p: isMobile ? 2 : 1.5, borderRadius: 2, bgcolor: 'action.hover', border: '1px solid', borderColor: det.es_libre ? `${ACCENT}40` : 'divider' }}>
                    <Box sx={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'stretch' : 'center', gap: 1.5 }}>
                      {/* Toggle ítem libre */}
                      <Tooltip title={det.es_libre ? 'Cambiar a producto del catálogo' : 'Ítem de única vez (sin catálogo)'}>
                        <Button
                          size="small"
                          variant={det.es_libre ? 'contained' : 'outlined'}
                          onClick={() => {
                            handleDetalleChange(idx, 'es_libre', !det.es_libre);
                            handleDetalleChange(idx, 'producto_id', '');
                            handleDetalleChange(idx, 'nombre_libre', '');
                            handleProductoInputChange(idx, '');
                          }}
                          sx={{ minWidth: 36, px: 1, flexShrink: 0, borderRadius: 1.5, height: 40, fontSize: 18, ...(det.es_libre ? { bgcolor: ACCENT, '&:hover': { bgcolor: '#e0521a' }, borderColor: ACCENT } : { borderColor: 'divider', color: 'text.secondary' }) }}
                        >✏️</Button>
                      </Tooltip>

                      {det.es_libre ? (
                        <TextField
                          label="Descripción del ítem"
                          size="small"
                          value={det.nombre_libre}
                          onChange={(e) => handleDetalleChange(idx, 'nombre_libre', e.target.value)}
                          placeholder="Ej: Flete, servicio técnico, varios…"
                          sx={{ flex: 1, minWidth: isMobile ? '100%' : 220 }}
                        />
                      ) : (
                      <Autocomplete
                        options={productos} getOptionLabel={(p) => p.nombre || ''}
                        value={prodSel || null}
                        onChange={(_, v) => handleDetalleChange(idx, 'producto_id', v ? v.id : '')}
                        inputValue={productoInputs[idx] || ''}
                        onInputChange={(_, v) => handleProductoInputChange(idx, v)}
                        filterOptions={(opts, state) => {
                          const q = (state.inputValue || '').toLowerCase().trim();
                          if (!q) return opts;
                          return opts.filter(o => o.nombre.toLowerCase().includes(q) || (o.codigo_barras && o.codigo_barras.toLowerCase().includes(q)));
                        }}
                        noOptionsText={
                          <Box sx={{ py: 0.5 }}>
                            <Typography sx={{ fontSize: 13, color: 'text.secondary', mb: 1 }}>No se encontró ningún producto</Typography>
                            <Button size="small" variant="contained" fullWidth startIcon={<Add />} onClick={() => openQuickCreate('producto', productoInputs[idx] || '', idx)} sx={{ borderRadius: 2, fontWeight: 600, fontSize: 12, bgcolor: GREEN }}>
                              Crear "{productoInputs[idx] || 'nuevo producto'}"
                            </Button>
                          </Box>
                        }
                        renderOption={(props, option) => (
                          <li {...props} key={option.id} style={{ padding: '8px 12px' }}>
                            <Box>
                              <Typography sx={{ fontSize: 14, fontWeight: 600 }}>{option.nombre}</Typography>
                              <Typography sx={{ fontSize: 11, color: option.maneja_lotes ? GREEN : 'text.secondary' }}>
                                {option.unidad_medida} · {option.maneja_lotes ? '📦 Perecedero (Lotes)' : `Stock: ${option.stock_actual ?? 0}`}
                              </Typography>
                            </Box>
                          </li>
                        )}
                        renderInput={(params) => (
                          <TextField {...params} label="Producto / Insumo" size="small" placeholder="Escribe para buscar…"
                            InputProps={{ ...params.InputProps, endAdornment: (<>{params.InputProps.endAdornment}<Tooltip title="Crear nuevo producto"><IconButton size="small" onClick={() => openQuickCreate('producto', productoInputs[idx] || '', idx)} sx={{ color: GREEN, p: 0.5 }}><Add fontSize="small" /></IconButton></Tooltip></>) }}
                          />
                        )}
                        sx={{ flex: 1, minWidth: isMobile ? '100%' : 220 }}
                      />
                      )}
                      <TextField type="number" label="Cantidad" value={det.cantidad} onChange={(e) => handleDetalleChange(idx, 'cantidad', e.target.value)} InputProps={{ inputProps: { min: 0, step: 'any' } }} sx={{ width: isMobile ? '100%' : 110 }} size="small" />
                      <CurrencyField label="Precio Unit. (Costo)" value={det.precio_unitario} onChange={(val) => handleDetalleChange(idx, 'precio_unitario', val)} sx={{ width: isMobile ? '100%' : 160 }} size="small" />
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                        <Typography sx={{ fontWeight: 700, fontSize: 14, color: GREEN, minWidth: 90 }}>{formatCurrency(det.cantidad * det.precio_unitario)}</Typography>
                        <Tooltip title="Quitar"><span>
                          <IconButton size="small" onClick={() => removeDetalle(idx)} disabled={detalles.length === 1} sx={{ color: RED, bgcolor: '#FEF2F2', borderRadius: 1.5, '&.Mui-disabled': { opacity: 0.3 } }}>
                            <Delete fontSize="small" />
                          </IconButton>
                        </span></Tooltip>
                      </Box>
                    </Box>

                    {prodSel?.maneja_lotes && (
                      <Box sx={{ mt: 1.5, p: 1.5, bgcolor: theme.palette.mode === 'dark' ? 'rgba(16,185,129,0.08)' : '#ECFDF5', borderRadius: 2, border: '1px dashed #10B981', display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 1.5, alignItems: 'center' }}>
                        <Typography sx={{ display: { xs: 'none', md: 'flex' }, color: GREEN }}><Science fontSize="small" /></Typography>
                        <TextField size="small" label="Número de Lote *" value={det.numero_lote || ''} onChange={e => handleDetalleChange(idx, 'numero_lote', e.target.value.toUpperCase())} sx={{ flex: 1, width: isMobile ? '100%' : 'auto' }} />
                        <TextField size="small" type="date" label="Fecha Vencimiento *" InputLabelProps={{ shrink: true }} value={det.fecha_vencimiento || ''} onChange={e => handleDetalleChange(idx, 'fecha_vencimiento', e.target.value)} inputProps={{ min: new Date().toLocaleDateString('en-CA') }} sx={{ flex: 1, width: isMobile ? '100%' : 'auto' }} />
                        <TextField size="small" type="date" label="Fabricación" InputLabelProps={{ shrink: true }} value={det.fecha_fabricacion || ''} onChange={e => handleDetalleChange(idx, 'fecha_fabricacion', e.target.value)} sx={{ flex: 1, width: isMobile ? '100%' : 'auto' }} />
                      </Box>
                    )}
                  </Box>
                );
              })}
            </Box>

            <Divider sx={{ mb: 3 }} />

            {/* Resumen totales + botón */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
              <Paper sx={{ p: 2, borderRadius: 2, bgcolor: `${GREEN}0D`, border: `1.5px dashed ${GREEN}60`, boxShadow: 'none', minWidth: 220 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>Subtotal</Typography>
                  <Typography sx={{ fontSize: 12, fontWeight: 600 }}>{formatCurrency(calcSubtotal())}</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>IVA ({ivaPorcentajeGlobal || 0}%)</Typography>
                  <Typography sx={{ fontSize: 12, fontWeight: 600 }}>{formatCurrency(calcIva())}</Typography>
                </Box>
                <Divider sx={{ my: 0.5 }} />
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>Total Compra</Typography>
                  <Typography sx={{ fontSize: 22, fontWeight: 800, color: GREEN }}>{formatCurrency(calcTotal())}</Typography>
                </Box>
              </Paper>

              <Button variant="contained" size="large" onClick={handleSubmit} disabled={loading} startIcon={<LocalShipping />}
                sx={{ background: `linear-gradient(135deg, ${GREEN}, #34d399)`, boxShadow: `0 4px 14px rgba(16,185,129,0.35)`, borderRadius: 2, fontWeight: 600, px: 4 }}>
                {loading ? 'Procesando…' : editingCompraId ? 'Actualizar Compra' : 'Registrar Entrada de Mercancía'}
              </Button>
            </Box>
          </Box>
        </TabPanel>

        {/* ══ Tab 1: Historial ══ */}
        <TabPanel value={tab} index={1}>
          <Box sx={{ px: { xs: 2, md: 3 }, pb: 3 }}>
            {/* Búsqueda */}
            <Box sx={{ mb: 1.5 }}>
              <TextField
                fullWidth placeholder="Buscar por proveedor, N° factura, código C0001…"
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setPage(0); fetchHistorial(0, rowsPerPage, e.target.value, fechaDesde, fechaHasta, filtroEstado); }}
                InputProps={{
                  startAdornment: <InputAdornment position="start"><Search sx={{ color: 'text.secondary', fontSize: 20 }} /></InputAdornment>,
                  endAdornment: searchTerm ? <InputAdornment position="end"><IconButton size="small" onClick={() => { setSearchTerm(''); setPage(0); fetchHistorial(0, rowsPerPage, '', fechaDesde, fechaHasta, filtroEstado); }}><Close fontSize="small" /></IconButton></InputAdornment> : null,
                }}
                size="small"
              />
            </Box>

            {/* Chips rápidos + rango de fechas */}
            <Box sx={{ display: 'flex', gap: 1, mb: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
              {[
                { label: 'Hoy', fn: () => { const d = new Date().toISOString().slice(0,10); setFechaDesde(d); setFechaHasta(d); setPage(0); fetchHistorial(0, rowsPerPage, searchTerm, d, d, filtroEstado); } },
                { label: 'Esta semana', fn: () => { const now = new Date(); const mon = new Date(now); mon.setDate(now.getDate() - now.getDay() + 1); const fi = mon.toISOString().slice(0,10); const ff = now.toISOString().slice(0,10); setFechaDesde(fi); setFechaHasta(ff); setPage(0); fetchHistorial(0, rowsPerPage, searchTerm, fi, ff, filtroEstado); } },
                { label: 'Este mes', fn: () => { const now = new Date(); const fi = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`; const ff = now.toISOString().slice(0,10); setFechaDesde(fi); setFechaHasta(ff); setPage(0); fetchHistorial(0, rowsPerPage, searchTerm, fi, ff, filtroEstado); } },
              ].map(({ label, fn }) => (
                <Chip key={label} label={label} size="small" onClick={fn} variant="outlined" sx={{ fontWeight: 600, cursor: 'pointer' }} />
              ))}
              <Typography sx={{ fontSize: 11, color: 'text.disabled', mx: 0.5 }}>Desde</Typography>
              <TextField type="date" size="small" value={fechaDesde} onChange={(e) => { setFechaDesde(e.target.value); setPage(0); fetchHistorial(0, rowsPerPage, searchTerm, e.target.value, fechaHasta, filtroEstado); }} InputLabelProps={{ shrink: true }} sx={{ width: 145 }} inputProps={{ style: { fontSize: 12 } }} />
              <Typography sx={{ fontSize: 11, color: 'text.disabled' }}>Hasta</Typography>
              <TextField type="date" size="small" value={fechaHasta} onChange={(e) => { setFechaHasta(e.target.value); setPage(0); fetchHistorial(0, rowsPerPage, searchTerm, fechaDesde, e.target.value, filtroEstado); }} InputLabelProps={{ shrink: true }} sx={{ width: 145 }} inputProps={{ style: { fontSize: 12 } }} />
              {(fechaDesde || fechaHasta || searchTerm || filtroEstado !== 'todos') && (
                <Button size="small" variant="text" onClick={() => { setFechaDesde(''); setFechaHasta(''); setSearchTerm(''); setFiltroEstado('todos'); setPage(0); fetchHistorial(0, rowsPerPage, '', '', '', 'todos'); }} sx={{ fontSize: 12, color: 'text.secondary' }}>
                  Limpiar todo
                </Button>
              )}
            </Box>

            {/* Chips de estado */}
            <Box sx={{ display: 'flex', gap: 1, mb: 1.5, flexWrap: 'wrap' }}>
              {[
                { id: 'todos', label: 'Todas' },
                { id: 'pagado', label: 'Pagadas' },
                { id: 'parcial', label: 'Parciales' },
                { id: 'pendiente', label: 'Pendientes' },
              ].map(f => (
                <Chip key={f.id} label={f.label} size="small"
                  onClick={() => { setFiltroEstado(f.id); setPage(0); fetchHistorial(0, rowsPerPage, searchTerm, fechaDesde, fechaHasta, f.id); }}
                  sx={{ fontWeight: 700, cursor: 'pointer', bgcolor: filtroEstado === f.id ? GREEN : 'transparent', color: filtroEstado === f.id ? 'white' : 'text.primary', border: filtroEstado === f.id ? 'none' : '1px solid', borderColor: 'divider' }} />
              ))}
            </Box>

            {/* Barra financiera */}
            <Box sx={{ display: 'flex', gap: 3, mb: 2, px: 1.5, py: 1, bgcolor: 'action.hover', borderRadius: 2, flexWrap: 'wrap' }}>
              <Box sx={{ display: 'flex', gap: 0.7, alignItems: 'center' }}>
                <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{comprasTotal} compras · Total:</Typography>
                <Typography sx={{ fontSize: 13, fontWeight: 800, color: 'text.primary' }}>{formatCurrency(comprasStats.sum_total)}</Typography>
              </Box>
              <Box sx={{ display: 'flex', gap: 0.7, alignItems: 'center' }}>
                <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>Pagado:</Typography>
                <Typography sx={{ fontSize: 13, fontWeight: 700, color: GREEN }}>{formatCurrency(comprasStats.sum_pagado)}</Typography>
              </Box>
              {comprasStats.sum_pendiente > 0 && (
                <Box sx={{ display: 'flex', gap: 0.7, alignItems: 'center' }}>
                  <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>Pendiente:</Typography>
                  <Typography sx={{ fontSize: 13, fontWeight: 700, color: RED }}>{formatCurrency(comprasStats.sum_pendiente)}</Typography>
                </Box>
              )}
            </Box>

            {isMobile ? (
              <Box>
                {compras.length === 0
                  ? <Box sx={{ textAlign: 'center', py: 6, color: 'text.secondary' }}><Receipt sx={{ fontSize: 48, mb: 1, opacity: 0.3 }} /><Typography>No se encontraron compras</Typography></Box>
                  : compras.map(c => (
                      <Paper key={c.id} sx={{ p: 2.5, mb: 2, borderRadius: 3, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
                          <Box>
                            <Typography sx={{ fontWeight: 700, fontSize: 15 }}>{c.proveedor.nombre}</Typography>
                            <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>C{String(c.id).padStart(4,'0')} · {new Date(c.fecha).toLocaleDateString()} · {c.referencia_factura || 'Sin ref.'}</Typography>
                          </Box>
                          <EstadoChip estado={c.estado_pago} />
                        </Box>
                        <Divider sx={{ my: 1.5 }} />
                        <Grid container spacing={1} sx={{ mb: 1.5 }}>
                          {[{ label: 'Total', val: formatCurrency(c.total) }, { label: 'Pagado', val: formatCurrency(c.monto_pagado) }, { label: 'Saldo', val: formatCurrency(c.total - c.monto_pagado) }].map(({ label, val }) => (
                            <Grid item xs={4} key={label}>
                              <Box sx={{ textAlign: 'center', p: 1, borderRadius: 2, bgcolor: 'action.hover' }}>
                                <Typography sx={{ fontSize: 10, color: 'text.secondary', mb: 0.2 }}>{label}</Typography>
                                <Typography sx={{ fontSize: 13, fontWeight: 700 }}>{val}</Typography>
                              </Box>
                            </Grid>
                          ))}
                        </Grid>
                        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                          <Tooltip title="Imprimir OC"><IconButton size="small" onClick={() => handlePrintOC(c)} sx={{ color: GREEN, bgcolor: `${GREEN}10`, borderRadius: 1.5 }}><Print fontSize="small" /></IconButton></Tooltip>
                          <Tooltip title="Ver detalle"><IconButton size="small" onClick={() => { setCompraDetalle(c); setOpenDetailDialog(true); }} sx={{ color: BLUE, bgcolor: '#EFF6FF', borderRadius: 1.5 }}><Visibility fontSize="small" /></IconButton></Tooltip>
                          <Tooltip title="Editar"><IconButton size="small" onClick={() => handleEditCompra(c)} sx={{ color: BLUE, bgcolor: '#EFF6FF', borderRadius: 1.5 }}><Edit fontSize="small" /></IconButton></Tooltip>
                          <Tooltip title="Eliminar"><IconButton size="small" onClick={() => handleDeleteCompra(c.id)} sx={{ color: RED, bgcolor: '#FEF2F2', borderRadius: 1.5 }}><Delete fontSize="small" /></IconButton></Tooltip>
                        </Box>
                      </Paper>
                    ))
                }
              </Box>
            ) : (
              <TableContainer sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                <Table size="small">
                  <TableHead sx={{ bgcolor: 'action.hover' }}>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, width: 80 }}>Compra</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>
                        <TableSortLabel active={sortBy === 'fecha'} direction={sortBy === 'fecha' ? sortDir : 'asc'} onClick={() => handleSort('fecha')}>Fecha</TableSortLabel>
                      </TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>
                        <TableSortLabel active={sortBy === 'proveedor'} direction={sortBy === 'proveedor' ? sortDir : 'asc'} onClick={() => handleSort('proveedor')}>Proveedor</TableSortLabel>
                      </TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Factura Ref.</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>
                        <TableSortLabel active={sortBy === 'total'} direction={sortBy === 'total' ? sortDir : 'asc'} onClick={() => handleSort('total')}>Total</TableSortLabel>
                      </TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Pagado</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Saldo</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Estado</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>Acciones</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {compras.length === 0
                      ? <TableRow><TableCell colSpan={9} sx={{ textAlign: 'center', py: 6, color: 'text.secondary' }}>No se encontraron compras</TableCell></TableRow>
                      : compras.map(c => (
                          <TableRow key={c.id} hover>
                            <TableCell>
                              <Typography sx={{ fontSize: 12, fontWeight: 800, fontFamily: 'monospace', bgcolor: `${GREEN}14`, color: GREEN, px: 0.8, py: 0.2, borderRadius: 1, display: 'inline-block' }}>
                                C{String(c.id).padStart(4, '0')}
                              </Typography>
                            </TableCell>
                            <TableCell sx={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                              <Box>
                                <Typography sx={{ fontSize: 12, fontWeight: 600 }}>{new Date(c.fecha).toLocaleDateString('es-CO')}</Typography>
                                <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{new Date(c.fecha).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}</Typography>
                              </Box>
                            </TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>{c.proveedor.nombre}</TableCell>
                            <TableCell sx={{ fontSize: 12, color: 'text.secondary' }}>{c.referencia_factura || '—'}</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>{formatCurrency(c.total)}</TableCell>
                            <TableCell sx={{ color: GREEN, fontWeight: 600 }}>{formatCurrency(c.monto_pagado)}</TableCell>
                            <TableCell sx={{ color: c.total - c.monto_pagado > 0 ? RED : 'text.primary', fontWeight: 600 }}>{formatCurrency(c.total - c.monto_pagado)}</TableCell>
                            <TableCell><EstadoChip estado={c.estado_pago} /></TableCell>
                            <TableCell align="right">
                              <Stack direction="row" spacing={0.3} justifyContent="flex-end">
                                <Tooltip title="Imprimir Orden de Compra" arrow><IconButton size="small" onClick={() => handlePrintOC(c)} sx={{ color: GREEN, '&:hover': { bgcolor: `${GREEN}10` } }}><Print fontSize="small" /></IconButton></Tooltip>
                                <Tooltip title="Ver detalle" arrow><IconButton size="small" onClick={() => { setCompraDetalle(c); setOpenDetailDialog(true); }} sx={{ color: BLUE, '&:hover': { bgcolor: '#EFF6FF' } }}><Visibility fontSize="small" /></IconButton></Tooltip>
                                <Tooltip title="Editar" arrow><IconButton size="small" onClick={() => handleEditCompra(c)} sx={{ color: BLUE, '&:hover': { bgcolor: '#EFF6FF' } }}><Edit fontSize="small" /></IconButton></Tooltip>
                                <Tooltip title="Eliminar" arrow><IconButton size="small" onClick={() => handleDeleteCompra(c.id)} sx={{ color: RED, '&:hover': { bgcolor: '#FEF2F2' } }}><Delete fontSize="small" /></IconButton></Tooltip>
                              </Stack>
                            </TableCell>
                          </TableRow>
                        ))
                    }
                  </TableBody>
                </Table>
              </TableContainer>
            )}

            <TablePagination
              rowsPerPageOptions={[10, 25, 50]} component="div"
              count={comprasTotal} rowsPerPage={rowsPerPage} page={page}
              onPageChange={(_, p) => { setPage(p); fetchHistorial(p, rowsPerPage); }}
              onRowsPerPageChange={(e) => { const rpp = parseInt(e.target.value, 10); setRowsPerPage(rpp); setPage(0); fetchHistorial(0, rpp); }}
              labelRowsPerPage="Filas:" labelDisplayedRows={({ from, to, count }) => `${from}–${to} de ${count}`}
            />
          </Box>
        </TabPanel>

        {/* ══ Tab 2: Cuentas por pagar ══ */}
        <TabPanel value={tab} index={2}>
          <Box sx={{ px: { xs: 2, md: 3 }, pb: 3 }}>
            {cuentasPorPagar.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 8 }}>
                <CheckCircle sx={{ fontSize: 56, color: GREEN, mb: 1.5 }} />
                <Typography sx={{ fontWeight: 700, fontSize: 18, mb: 0.5 }}>¡Todo al día!</Typography>
                <Typography sx={{ color: 'text.secondary' }}>No hay facturas con saldo pendiente.</Typography>
              </Box>
            ) : (
              <>
                <Paper sx={{ p: 2, mb: 3, borderRadius: 2, bgcolor: `${RED}08`, border: `1px solid ${RED}30`, display: 'flex', alignItems: 'center', gap: 1.5, boxShadow: 'none' }}>
                  <Warning sx={{ color: RED }} />
                  <Box>
                    <Typography sx={{ fontWeight: 700, color: RED }}>{cuentasPorPagar.length} factura{cuentasPorPagar.length > 1 ? 's' : ''} con saldo pendiente</Typography>
                    <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>Total a cancelar: <strong>{formatCurrency(totalPorPagar)}</strong></Typography>
                  </Box>
                </Paper>

                {isMobile ? (
                  <Box>
                    {[...cuentasPorPagar].sort((a, b) => new Date(a.fecha) - new Date(b.fecha)).map(c => (
                      <Paper key={c.id} sx={{ p: 2.5, mb: 2, borderRadius: 3, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', borderLeft: `4px solid ${RED}` }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
                          <Box>
                            <Typography sx={{ fontWeight: 700, fontSize: 15 }}>{c.proveedor.nombre}</Typography>
                            <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{c.referencia_factura || `C${String(c.id).padStart(4,'0')}`} · {new Date(c.fecha).toLocaleDateString()}</Typography>
                          </Box>
                          <EstadoChip estado={c.estado_pago} />
                        </Box>
                        <Grid container spacing={1} sx={{ mb: 1.5 }}>
                          {[{ label: 'Total', val: formatCurrency(c.total) }, { label: 'Pagado', val: formatCurrency(c.monto_pagado) }, { label: 'Pendiente', val: formatCurrency(c.total - c.monto_pagado) }].map(({ label, val }) => (
                            <Grid item xs={4} key={label}><Box sx={{ textAlign: 'center', p: 1, borderRadius: 2, bgcolor: 'action.hover' }}><Typography sx={{ fontSize: 10, color: 'text.secondary', mb: 0.2 }}>{label}</Typography><Typography sx={{ fontSize: 13, fontWeight: 700 }}>{val}</Typography></Box></Grid>
                          ))}
                        </Grid>
                        <Button fullWidth variant="contained" size="small" startIcon={<CheckCircle />} onClick={() => handleOpenPay(c)}
                          sx={{ background: `linear-gradient(135deg, ${GREEN}, #34d399)`, boxShadow: 'none', borderRadius: 2, fontWeight: 600 }}>
                          Registrar Abono
                        </Button>
                      </Paper>
                    ))}
                  </Box>
                ) : (
                  <TableContainer sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                    <Table size="small">
                      <TableHead sx={{ bgcolor: 'action.hover' }}>
                        <TableRow>
                          {['Proveedor', 'Factura', 'Fecha Compra', 'Total', 'Pagado', 'Saldo Pendiente', 'Estado', 'Acción'].map(h => (
                            <TableCell key={h} sx={{ fontWeight: 700 }}>{h}</TableCell>
                          ))}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {[...cuentasPorPagar].sort((a, b) => new Date(a.fecha) - new Date(b.fecha)).map(c => (
                          <TableRow key={c.id} hover>
                            <TableCell sx={{ fontWeight: 600 }}>{c.proveedor.nombre}</TableCell>
                            <TableCell sx={{ fontSize: 12, color: 'text.secondary' }}>{c.referencia_factura || `C${String(c.id).padStart(4,'0')}`}</TableCell>
                            <TableCell sx={{ fontSize: 12, color: 'text.secondary', whiteSpace: 'nowrap' }}>{new Date(c.fecha).toLocaleDateString()}</TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>{formatCurrency(c.total)}</TableCell>
                            <TableCell sx={{ color: GREEN, fontWeight: 600 }}>{formatCurrency(c.monto_pagado)}</TableCell>
                            <TableCell sx={{ color: RED, fontWeight: 700 }}>{formatCurrency(c.total - c.monto_pagado)}</TableCell>
                            <TableCell><EstadoChip estado={c.estado_pago} /></TableCell>
                            <TableCell>
                              <Button variant="contained" size="small" startIcon={<Payment />} onClick={() => handleOpenPay(c)}
                                sx={{ background: `linear-gradient(135deg, ${GREEN}, #34d399)`, boxShadow: 'none', borderRadius: 1.5, fontWeight: 600, fontSize: 12 }}>
                                Abonar
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </>
            )}
          </Box>
        </TabPanel>

        {/* ══ Tab 3: Gastos ══ */}
        <TabPanel value={tab} index={3}>
          <Box sx={{ px: { xs: 2, md: 3 }, pb: 3 }}>
            <Grid container spacing={3}>
              {/* ── Formulario ── */}
              <Grid item xs={12} md={5}>
                <Paper sx={{ p: 3, borderRadius: 3, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                  <Typography sx={{ fontWeight: 700, fontSize: 15, mb: 2 }}>
                    {editingGastoId ? 'Modificar gasto' : 'Registrar nuevo gasto'}
                  </Typography>
                  <Box component="form" onSubmit={handleRegistrarGasto}>
                    <Stack spacing={2}>
                      <Autocomplete
                        options={terceros} getOptionLabel={o => o?.nombre || ''}
                        value={gastoTercero} onChange={(_, v) => setGastoTercero(v)}
                        inputValue={terceroInput} onInputChange={(_, v) => setTerceroInput(v)}
                        noOptionsText={
                          <Box sx={{ py: 0.5 }}>
                            <Typography sx={{ fontSize: 13, color: 'text.secondary', mb: 1 }}>No encontrado</Typography>
                            <Button size="small" variant="contained" fullWidth startIcon={<Add />}
                              onClick={() => openQuickCreate('tercero', terceroInput)}
                              sx={{ borderRadius: 2, fontWeight: 600, fontSize: 12 }}>
                              Crear "{terceroInput || 'nuevo beneficiario'}"
                            </Button>
                          </Box>
                        }
                        renderInput={params => (
                          <TextField {...params} label="Beneficiario (a quién se paga) *" required size="small"
                            InputProps={{ ...params.InputProps, endAdornment: (<>{params.InputProps.endAdornment}<Tooltip title="Crear beneficiario"><IconButton size="small" onClick={() => openQuickCreate('tercero', terceroInput)} sx={{ color: BLUE, p: 0.5 }}><Add fontSize="small" /></IconButton></Tooltip></>) }}
                          />
                        )}
                      />
                      <TextField label="Concepto *" required size="small" fullWidth value={gastoConcepto} onChange={e => setGastoConcepto(e.target.value)} placeholder="Ej: Arriendo local mes de junio" />
                      <CurrencyField label="Monto *" value={gastoMonto} onChange={setGastoMonto} required />
                      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                        <TextField label="Fecha" type="date" size="small" fullWidth value={gastoFecha}
                          onChange={e => setGastoFecha(e.target.value)} InputLabelProps={{ shrink: true }}
                          InputProps={{ startAdornment: <InputAdornment position="start"><CalendarToday sx={{ fontSize: 14, color: 'text.secondary' }} /></InputAdornment> }}
                        />
                        <FormControl size="small" fullWidth>
                          <InputLabel>Categoría</InputLabel>
                          <Select value={gastoCategoria} onChange={e => setGastoCategoria(e.target.value)} label="Categoría"
                            startAdornment={<InputAdornment position="start"><Category sx={{ fontSize: 14, color: 'text.secondary' }} /></InputAdornment>}>
                            <MenuItem value=""><em>Sin categoría</em></MenuItem>
                            {CATEGORIAS_GASTO.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                          </Select>
                        </FormControl>
                      </Stack>
                      <Box>
                        <Typography sx={{ fontSize: 11, fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.6, mb: 1 }}>Método de pago</Typography>
                        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                          {['Efectivo', 'Transferencia', 'Tarjeta', 'Nequi'].map(opt => (
                            <Chip key={opt} label={opt} onClick={() => setGastoMetodo(opt)} sx={{ fontWeight: 600, fontSize: 12, borderRadius: 1.5, cursor: 'pointer', bgcolor: gastoMetodo === opt ? `${RED}18` : 'background.paper', color: gastoMetodo === opt ? RED : 'text.secondary', border: '1.5px solid', borderColor: gastoMetodo === opt ? RED : 'divider' }} />
                          ))}
                        </Box>
                      </Box>
                      <Stack direction="row" spacing={1}>
                        <Button type="submit" variant="contained" fullWidth
                          sx={{ background: editingGastoId ? `linear-gradient(135deg,${BLUE},#60a5fa)` : `linear-gradient(135deg,${RED},#f87171)`, boxShadow: `0 4px 14px rgba(239,68,68,0.25)`, borderRadius: 2, fontWeight: 600 }}>
                          {editingGastoId ? 'Actualizar gasto' : 'Registrar gasto'}
                        </Button>
                        {editingGastoId && (
                          <Button variant="outlined" fullWidth onClick={resetGastoForm} sx={{ borderRadius: 2, fontWeight: 600 }}>Cancelar</Button>
                        )}
                      </Stack>
                    </Stack>
                  </Box>
                </Paper>
              </Grid>

              {/* ── Historial de gastos ── */}
              <Grid item xs={12} md={7}>
                <Paper sx={{ p: 3, borderRadius: 3, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography sx={{ fontWeight: 700, fontSize: 15 }}>Historial de gastos</Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>Este mes:</Typography>
                      <Typography sx={{ fontSize: 13, fontWeight: 800, color: RED }}>{formatCurrency(gastosTotalMes)}</Typography>
                    </Box>
                  </Box>

                  {/* Chips categoría */}
                  {[...new Set(gastos.map(g => g.categoria).filter(Boolean))].length > 0 && (
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 1.5 }}>
                      <Chip label={`Todas (${gastos.length})`} size="small" onClick={() => { setFiltroCategoria(''); setGastosPage(0); }}
                        sx={{ fontWeight: 600, fontSize: 11, borderRadius: 1.5, cursor: 'pointer', bgcolor: !filtroCategoria ? `${BLUE}20` : 'background.paper', color: !filtroCategoria ? BLUE : 'text.secondary', border: '1.5px solid', borderColor: !filtroCategoria ? BLUE : 'divider' }} />
                      {[...new Set(gastos.map(g => g.categoria).filter(Boolean))].sort().map(cat => (
                        <Chip key={cat} label={cat} size="small" onClick={() => { setFiltroCategoria(cat); setGastosPage(0); }}
                          sx={{ fontWeight: 600, fontSize: 11, borderRadius: 1.5, cursor: 'pointer', bgcolor: filtroCategoria === cat ? `${BLUE}20` : 'background.paper', color: filtroCategoria === cat ? BLUE : 'text.secondary', border: '1.5px solid', borderColor: filtroCategoria === cat ? BLUE : 'divider' }} />
                      ))}
                    </Box>
                  )}

                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mb: 2 }}>
                    <TextField size="small" fullWidth placeholder="Buscar por beneficiario, concepto…" value={busquedaGasto}
                      onChange={e => { setBusquedaGasto(e.target.value); setGastosPage(0); }}
                      InputProps={{ startAdornment: <InputAdornment position="start"><Search sx={{ fontSize: 16, color: 'text.secondary' }} /></InputAdornment> }} />
                    <FormControl size="small" sx={{ minWidth: 130 }}>
                      <InputLabel>Método</InputLabel>
                      <Select value={filtroMetodoPago} onChange={e => { setFiltroMetodoPago(e.target.value); setGastosPage(0); }} label="Método">
                        <MenuItem value="">Todos</MenuItem>
                        {['Efectivo', 'Transferencia', 'Tarjeta', 'Nequi'].map(m => <MenuItem key={m} value={m}>{m}</MenuItem>)}
                      </Select>
                    </FormControl>
                  </Stack>

                  {loadingGastos ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={24} sx={{ color: RED }} /></Box>
                  ) : filteredGastos.length === 0 ? (
                    <Box sx={{ textAlign: 'center', py: 5, color: 'text.secondary' }}>
                      <MoneyOff sx={{ fontSize: 40, opacity: 0.2, mb: 1 }} />
                      <Typography fontSize={13}>{gastos.length === 0 ? 'No hay gastos registrados' : 'Sin resultados con estos filtros'}</Typography>
                    </Box>
                  ) : isMobile ? (
                    <Box>
                      {paginatedGastos.map(g => (
                        <Paper key={g.id} sx={{ p: 2, mb: 1.5, borderRadius: 3, boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              <Typography sx={{ fontWeight: 700, fontSize: 14, mb: 0.2 }}>{g.tercero?.nombre || 'Sin beneficiario'}</Typography>
                              <Typography sx={{ fontSize: 12, color: 'text.secondary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.concepto}</Typography>
                            </Box>
                            <Typography sx={{ fontWeight: 800, fontSize: 15, color: RED, ml: 1, flexShrink: 0 }}>{formatCurrency(g.monto)}</Typography>
                          </Box>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 1 }}>
                            {g.categoria && <Chip label={g.categoria} size="small" sx={{ fontSize: 9, height: 18, bgcolor: `${BLUE}12`, color: BLUE, fontWeight: 600 }} />}
                            <Chip label={g.metodo_pago} size="small" sx={{ fontSize: 9, height: 18, bgcolor: 'action.hover', fontWeight: 600 }} />
                            <Typography sx={{ fontSize: 11, color: 'text.disabled', ml: 'auto' }}>{new Date(g.fecha).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}</Typography>
                          </Box>
                          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.5 }}>
                            <IconButton size="small" onClick={() => handleEditGasto(g)} sx={{ color: BLUE, '&:hover': { bgcolor: '#EFF6FF' } }}><Edit fontSize="small" /></IconButton>
                            <IconButton size="small" onClick={() => handleDeleteGasto(g.id)} sx={{ color: RED, '&:hover': { bgcolor: '#FEF2F2' } }}><Delete fontSize="small" /></IconButton>
                          </Box>
                        </Paper>
                      ))}
                    </Box>
                  ) : (
                    <TableContainer sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                      <Table size="small">
                        <TableHead sx={{ bgcolor: 'action.hover' }}>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: 'uppercase' }}>Fecha</TableCell>
                            <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: 'uppercase' }}>Beneficiario</TableCell>
                            <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: 'uppercase' }}>Concepto</TableCell>
                            <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: 'uppercase' }}>Categoría</TableCell>
                            <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: 'uppercase' }}>Método</TableCell>
                            <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: 'uppercase' }} align="right">Monto</TableCell>
                            <TableCell align="center" sx={{ fontWeight: 700, fontSize: 11 }}>Acc.</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {paginatedGastos.map(g => (
                            <TableRow key={g.id} hover>
                              <TableCell sx={{ fontSize: 11, whiteSpace: 'nowrap' }}>{new Date(g.fecha).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })}</TableCell>
                              <TableCell sx={{ fontWeight: 600, fontSize: 12 }}>{g.tercero?.nombre || '—'}</TableCell>
                              <TableCell sx={{ fontSize: 12, color: 'text.secondary', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.concepto}</TableCell>
                              <TableCell>
                                {g.categoria
                                  ? <Chip label={g.categoria} size="small" sx={{ fontSize: 9, height: 18, bgcolor: `${BLUE}12`, color: BLUE, fontWeight: 600 }} />
                                  : <Typography sx={{ fontSize: 11, color: 'text.disabled' }}>—</Typography>}
                              </TableCell>
                              <TableCell sx={{ fontSize: 11 }}>{g.metodo_pago}</TableCell>
                              <TableCell align="right" sx={{ color: RED, fontWeight: 700 }}>{formatCurrency(g.monto)}</TableCell>
                              <TableCell align="center">
                                <Stack direction="row" spacing={0.3} justifyContent="center">
                                  <Tooltip title="Editar"><IconButton size="small" onClick={() => handleEditGasto(g)} sx={{ color: BLUE, '&:hover': { bgcolor: '#EFF6FF' } }}><Edit fontSize="small" /></IconButton></Tooltip>
                                  <Tooltip title="Eliminar"><IconButton size="small" onClick={() => handleDeleteGasto(g.id)} sx={{ color: RED, '&:hover': { bgcolor: '#FEF2F2' } }}><Delete fontSize="small" /></IconButton></Tooltip>
                                </Stack>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  )}
                  {filteredGastos.length > gastosRpp && (
                    <TablePagination component="div" count={filteredGastos.length} page={gastosPage}
                      onPageChange={(_, p) => setGastosPage(p)} rowsPerPage={gastosRpp}
                      onRowsPerPageChange={e => { setGastosRpp(parseInt(e.target.value,10)); setGastosPage(0); }}
                      rowsPerPageOptions={[10, 25, 50]} labelRowsPerPage="Filas:"
                      labelDisplayedRows={({ from, to, count }) => `${from}–${to} de ${count}`} />
                  )}
                </Paper>
              </Grid>
            </Grid>
          </Box>
        </TabPanel>
      </Paper>

      {/* ══ Diálogo: Eliminar Gasto ══ */}
      <Dialog open={openDeleteGasto} onClose={() => setOpenDeleteGasto(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle>Eliminar gasto</DialogTitle>
        <DialogContent><Typography>¿Confirmas que deseas eliminar este gasto? Esta acción no se puede deshacer.</Typography></DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDeleteGasto(false)}>Cancelar</Button>
          <Button onClick={handleConfirmDeleteGasto} color="error" variant="contained" sx={{ borderRadius: 2 }}>Eliminar</Button>
        </DialogActions>
      </Dialog>

      {/* ══ Diálogo: Registrar Pago ══ */}
      <Dialog open={openPayDialog} onClose={() => setOpenPayDialog(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1 }}>
          <Box>
            <Typography sx={{ fontWeight: 700, fontSize: 17 }}>Registrar Pago a Proveedor</Typography>
            <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{selectedCompra?.proveedor?.nombre}</Typography>
          </Box>
          <IconButton size="small" onClick={() => setOpenPayDialog(false)}><Close fontSize="small" /></IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2} sx={{ mb: 2 }}>
            {[{ label: 'Factura', val: selectedCompra?.referencia_factura || `#${selectedCompra?.id}` }, { label: 'Total factura', val: formatCurrency(selectedCompra?.total || 0) }].map(({ label, val }) => (
              <Grid item xs={6} key={label}><Box sx={{ p: 1.5, borderRadius: 2, bgcolor: 'action.hover' }}><Typography sx={{ fontSize: 11, color: 'text.secondary', mb: 0.3 }}>{label}</Typography><Typography sx={{ fontWeight: 700 }}>{val}</Typography></Box></Grid>
            ))}
            <Grid item xs={12}>
              <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: `${RED}0D`, border: `1px dashed ${RED}50` }}>
                <Typography sx={{ fontSize: 11, color: RED, mb: 0.3 }}>Saldo pendiente</Typography>
                <Typography sx={{ fontWeight: 800, fontSize: 18, color: RED }}>{formatCurrency(selectedCompra ? selectedCompra.total - selectedCompra.monto_pagado : 0)}</Typography>
              </Box>
            </Grid>
          </Grid>
          {selectedCompra?.pagos?.length > 0 && (
            <Box sx={{ mb: 2 }}>
              <SectionLabel>Pagos anteriores</SectionLabel>
              <Box sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider', overflow: 'hidden' }}>
                {selectedCompra.pagos.map((p, idx) => (
                  <Box key={idx} sx={{ px: 2, py: 1.2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: idx < selectedCompra.pagos.length - 1 ? '1px solid' : 'none', borderColor: 'divider' }}>
                    <Box>
                      <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{p.metodo_pago}</Typography>
                      <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{new Date(p.fecha).toLocaleString()}{p.detalle_pago ? ` · ${p.detalle_pago}` : ''}</Typography>
                    </Box>
                    <Typography sx={{ fontWeight: 700, color: GREEN }}>{formatCurrency(p.monto)}</Typography>
                  </Box>
                ))}
              </Box>
            </Box>
          )}
          <Divider sx={{ mb: 2 }} />
          <SectionLabel>Nuevo abono</SectionLabel>
          <Grid container spacing={2}>
            <Grid item xs={12}><CurrencyField fullWidth label="Monto a pagar" value={montoAbono} onChange={(val) => setMontoAbono(val)} required autoFocus /></Grid>
            <Grid item xs={12}>
              <TextField select fullWidth label="Método de pago" value={metodoPago} onChange={(e) => setMetodoPago(e.target.value)}>
                {['Transferencia', 'Efectivo', 'Cheque', 'Nota Crédito'].map(m => <MenuItem key={m} value={m}>{m}</MenuItem>)}
              </TextField>
            </Grid>
            {metodoPago !== 'Efectivo' && (
              <Grid item xs={12}>
                <TextField fullWidth label={metodoPago === 'Transferencia' ? 'Nro. Cuenta / Comprobante' : metodoPago === 'Cheque' ? 'Nro. Cheque' : 'Nro. Referencia / Nota'} value={detallePago} onChange={(e) => setDetallePago(e.target.value)} placeholder="Ej: 123456789" required />
              </Grid>
            )}
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
          <Button onClick={() => setOpenPayDialog(false)} variant="outlined" sx={{ borderRadius: 2, fontWeight: 600, borderColor: 'divider' }}>Cancelar</Button>
          <Button onClick={handleConfirmPago} variant="contained" sx={{ background: `linear-gradient(135deg, ${GREEN}, #34d399)`, boxShadow: `0 4px 14px rgba(16,185,129,0.3)`, borderRadius: 2, fontWeight: 600 }}>Confirmar Pago</Button>
        </DialogActions>
      </Dialog>

      {/* ══ Diálogo: Detalle completo ══ */}
      <Dialog open={openDetailDialog} onClose={() => setOpenDetailDialog(false)} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', pb: 1 }}>
          <Box sx={{ flex: 1, minWidth: 0, pr: 1 }}>
            <Typography sx={{ fontWeight: 700, fontSize: 17, lineHeight: 1.3 }}>Detalle de Compra {compraDetalle && fmtOCNum(compraDetalle)}</Typography>
            <Typography sx={{ fontSize: 12, color: 'text.secondary', mt: 0.3 }}>{compraDetalle?.proveedor?.nombre}</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
            <EstadoChip estado={compraDetalle?.estado_pago} />
            <IconButton size="small" onClick={() => setOpenDetailDialog(false)}><Close fontSize="small" /></IconButton>
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          {/* ── Info cards ── */}
          <Grid container spacing={1.5} sx={{ mb: 2.5 }}>
            <Grid item xs={6}>
              <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: 'action.hover' }}>
                <Typography sx={{ fontSize: 11, color: 'text.secondary', mb: 0.3 }}>Fecha</Typography>
                <Typography sx={{ fontWeight: 600, fontSize: 13 }}>
                  {compraDetalle ? new Date(compraDetalle.fecha).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) : ''}
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={6}>
              <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: 'action.hover' }}>
                <Typography sx={{ fontSize: 11, color: 'text.secondary', mb: 0.3 }}>Ref. Factura</Typography>
                <Typography sx={{ fontWeight: 600, fontSize: 13 }}>{compraDetalle?.referencia_factura || 'N/A'}</Typography>
              </Box>
            </Grid>
            <Grid item xs={12}>
              <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: 'action.hover', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography sx={{ fontSize: 11, color: 'text.secondary', mb: 0.3 }}>Proveedor</Typography>
                  <Typography sx={{ fontWeight: 600, fontSize: 13 }}>{compraDetalle?.proveedor?.nombre}</Typography>
                </Box>
                <Box sx={{ textAlign: 'right' }}>
                  <Typography sx={{ fontSize: 11, color: 'text.secondary', mb: 0.3 }}>Total</Typography>
                  <Typography sx={{ fontWeight: 800, fontSize: 15, color: GREEN }}>{formatCurrency(compraDetalle?.total || 0)}</Typography>
                </Box>
              </Box>
            </Grid>
          </Grid>

          {compraDetalle?.observaciones && (
            <Alert severity="info" sx={{ mb: 2.5, borderRadius: 2, fontSize: 13 }}>{compraDetalle.observaciones}</Alert>
          )}

          <SectionLabel>Ítems comprados</SectionLabel>
          {/* En móvil: cards por ítem en vez de tabla horizontal */}
          <Box sx={{ display: { xs: 'flex', sm: 'none' }, flexDirection: 'column', gap: 1, mb: 3 }}>
            {compraDetalle?.detalles.map((d, idx) => (
              <Box key={idx} sx={{ p: 1.5, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.5 }}>
                  <Typography sx={{ fontWeight: 700, fontSize: 13, flex: 1, pr: 1 }}>{d.producto.nombre}</Typography>
                  <Typography sx={{ fontWeight: 800, fontSize: 14, color: GREEN, flexShrink: 0 }}>{formatCurrency(d.cantidad * d.precio_unitario)}</Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                  <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>Cant: <strong>{d.cantidad} {d.producto.unidad_medida}</strong></Typography>
                  <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>P/u: <strong>{formatCurrency(d.precio_unitario)}</strong></Typography>
                </Box>
                {d.numero_lote && (
                  <Typography sx={{ fontSize: 11, color: 'text.secondary', mt: 0.5 }}>
                    Lote: {d.numero_lote}{d.fecha_vencimiento ? ` · Vence: ${new Date(d.fecha_vencimiento).toLocaleDateString('es-CO')}` : ''}
                  </Typography>
                )}
              </Box>
            ))}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', px: 1.5, py: 1, bgcolor: 'action.hover', borderRadius: 2 }}>
              <Typography sx={{ fontWeight: 700, fontSize: 13 }}>Total compra:</Typography>
              <Typography sx={{ fontWeight: 800, fontSize: 14, color: GREEN }}>{formatCurrency(compraDetalle?.total || 0)}</Typography>
            </Box>
          </Box>
          {/* En desktop: tabla normal */}
          <TableContainer sx={{ display: { xs: 'none', sm: 'block' }, borderRadius: 2, border: '1px solid', borderColor: 'divider', mb: 3 }}>
            <Table size="small">
              <TableHead sx={{ bgcolor: 'action.hover' }}>
                <TableRow>
                  {['Producto', 'Lote', 'Cantidad', 'Precio Unit.', 'Subtotal'].map(h => (
                    <TableCell key={h} align={h !== 'Producto' && h !== 'Lote' ? 'right' : 'left'} sx={{ fontWeight: 700 }}>{h}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {compraDetalle?.detalles.map((d, idx) => (
                  <TableRow key={idx} hover>
                    <TableCell sx={{ fontWeight: 600 }}>{d.producto.nombre}</TableCell>
                    <TableCell sx={{ fontSize: 12, color: 'text.secondary' }}>
                      {d.numero_lote ? (<><strong>Lote:</strong> {d.numero_lote}<br /><strong>Vence:</strong> {d.fecha_vencimiento ? new Date(d.fecha_vencimiento).toLocaleDateString() : ''}</>) : '—'}
                    </TableCell>
                    <TableCell align="right">{d.cantidad} {d.producto.unidad_medida}</TableCell>
                    <TableCell align="right">{formatCurrency(d.precio_unitario)}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>{formatCurrency(d.cantidad * d.precio_unitario)}</TableCell>
                  </TableRow>
                ))}
                <TableRow sx={{ bgcolor: 'action.hover' }}>
                  <TableCell colSpan={4} align="right" sx={{ fontWeight: 700 }}>Total:</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 800, color: GREEN }}>{formatCurrency(compraDetalle?.total || 0)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>

          <SectionLabel>Historial de pagos / abonos</SectionLabel>
          {/* Móvil: cards */}
          <Box sx={{ display: { xs: 'flex', sm: 'none' }, flexDirection: 'column', gap: 1 }}>
            {compraDetalle?.pagos?.length > 0
              ? compraDetalle.pagos.map((p, idx) => (
                  <Box key={idx} sx={{ p: 1.5, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{new Date(p.fecha).toLocaleDateString('es-CO')}</Typography>
                      <Typography sx={{ fontWeight: 700, color: GREEN }}>{formatCurrency(p.monto)}</Typography>
                    </Box>
                    <Typography sx={{ fontSize: 12, fontWeight: 600 }}>{p.metodo_pago}</Typography>
                    {p.detalle_pago && <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{p.detalle_pago}</Typography>}
                  </Box>
                ))
              : <Box sx={{ py: 2, textAlign: 'center' }}><Typography sx={{ fontSize: 13, color: 'text.secondary' }}>No hay pagos registrados</Typography></Box>
            }
            <Box sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider', overflow: 'hidden' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', px: 1.5, py: 1.2, bgcolor: 'action.hover' }}>
                <Typography sx={{ fontWeight: 700, fontSize: 13 }}>Total pagado:</Typography>
                <Typography sx={{ fontWeight: 800, fontSize: 14, color: GREEN }}>{formatCurrency(compraDetalle?.monto_pagado || 0)}</Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', px: 1.5, py: 1.2 }}>
                <Typography sx={{ fontWeight: 700, fontSize: 13, color: RED }}>Saldo pendiente:</Typography>
                <Typography sx={{ fontWeight: 800, fontSize: 14, color: RED }}>{formatCurrency(compraDetalle ? compraDetalle.total - compraDetalle.monto_pagado : 0)}</Typography>
              </Box>
            </Box>
          </Box>
          {/* Desktop: tabla */}
          <TableContainer sx={{ display: { xs: 'none', sm: 'block' }, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
            <Table size="small">
              <TableHead sx={{ bgcolor: 'action.hover' }}>
                <TableRow>{['Fecha', 'Método', 'Referencia', 'Monto'].map(h => <TableCell key={h} align={h === 'Monto' ? 'right' : 'left'} sx={{ fontWeight: 700 }}>{h}</TableCell>)}</TableRow>
              </TableHead>
              <TableBody>
                {compraDetalle?.pagos?.length > 0
                  ? compraDetalle.pagos.map((p, idx) => (
                      <TableRow key={idx} hover>
                        <TableCell sx={{ fontSize: 12 }}>{new Date(p.fecha).toLocaleString()}</TableCell>
                        <TableCell sx={{ fontSize: 12 }}>{p.metodo_pago}</TableCell>
                        <TableCell sx={{ fontSize: 12, color: 'text.secondary' }}>{p.detalle_pago || '—'}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700, color: GREEN }}>{formatCurrency(p.monto)}</TableCell>
                      </TableRow>
                    ))
                  : <TableRow><TableCell colSpan={4} sx={{ textAlign: 'center', py: 3, color: 'text.secondary' }}>No hay pagos registrados</TableCell></TableRow>
                }
                <TableRow sx={{ bgcolor: 'action.hover' }}>
                  <TableCell colSpan={3} align="right" sx={{ fontWeight: 700 }}>Total pagado:</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 800, color: GREEN }}>{formatCurrency(compraDetalle?.monto_pagado || 0)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell colSpan={3} align="right" sx={{ fontWeight: 700, color: RED }}>Saldo pendiente:</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 800, color: RED }}>{formatCurrency(compraDetalle ? compraDetalle.total - compraDetalle.monto_pagado : 0)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2, gap: 1, flexWrap: 'wrap' }}>
          {compraDetalle?.estado_pago !== 'pagado' && (
            <Button variant="contained" startIcon={<Payment />} onClick={() => { setOpenDetailDialog(false); handleOpenPay(compraDetalle); }}
              sx={{ background: `linear-gradient(135deg, ${GREEN}, #34d399)`, borderRadius: 2, fontWeight: 600, mr: 'auto' }}>
              Registrar Abono
            </Button>
          )}
          <Button startIcon={<Print />} onClick={() => compraDetalle && handlePrintOC(compraDetalle)} variant="outlined" sx={{ borderRadius: 2, fontWeight: 600, color: GREEN, borderColor: GREEN }}>Imprimir OC</Button>
          <Button onClick={() => setOpenDetailDialog(false)} variant="outlined" sx={{ borderRadius: 2, fontWeight: 600, borderColor: 'divider' }}>Cerrar</Button>
        </DialogActions>
      </Dialog>

      {/* ── QuickCreateModal ── */}
      <QuickCreateModal open={quickCreate.open} onClose={closeQuickCreate} type={quickCreate.type} initialName={quickCreate.initialName} onCreated={handleQuickCreated} />

      {/* ── DIALOG: ELIMINAR COMPRA ── */}
      <Dialog open={openDeleteDialog} onClose={() => !submitting && setOpenDeleteDialog(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3, overflow: 'hidden' } }}>
        <Box sx={{ height: 4, bgcolor: RED }} />
        <DialogTitle sx={{ pb: 1, pt: 2.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{ width: 38, height: 38, borderRadius: 2, bgcolor: `${RED}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: RED }}><Delete /></Box>
            <Typography sx={{ fontWeight: 700, fontSize: 16 }}>¿Eliminar esta compra?</Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: 14, color: 'text.secondary', mt: 1 }}>
            Esta acción <strong>revertirá el stock</strong> de los productos ingresados y eliminará el registro permanentemente.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, pt: 1, gap: 1 }}>
          <Button onClick={() => setOpenDeleteDialog(false)} disabled={submitting} variant="outlined" size="small" fullWidth sx={{ borderRadius: 2, fontWeight: 600, borderColor: 'divider', color: 'text.secondary' }}>Cancelar</Button>
          <Button onClick={handleConfirmDelete} disabled={submitting} variant="contained" size="small" fullWidth sx={{ borderRadius: 2, fontWeight: 600, bgcolor: RED, '&:hover': { bgcolor: '#d32f2f' } }}>
            {submitting ? 'Eliminando...' : 'Confirmar Eliminación'}
          </Button>
        </DialogActions>
      </Dialog>

    </Box>
  );
};

export default Compras;
