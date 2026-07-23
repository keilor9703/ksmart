import React, { useState, useEffect, useMemo } from 'react';
import {
  Box, Paper, Typography, Tabs, Tab, TextField, Button, Grid,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TableSortLabel,
  IconButton, Chip, Tooltip, InputAdornment, Divider, useTheme,
  useMediaQuery, Autocomplete, Dialog, DialogTitle, DialogContent,
  DialogActions, MenuItem, Stack, TablePagination, Alert
} from '@mui/material';
import {
  Description, Add, Delete, Visibility, Transform, Search,
  CheckCircle, Cancel, HourglassEmpty, AddCircleOutline,
  RemoveCircleOutline, Close, AttachMoney, Receipt, Print,
  ContentCopy, Warning, BookmarkAdd, BookmarkBorder, Payments,
  TrendingUp, CheckCircleOutline, HelpOutline
} from '@mui/icons-material';
import apiClient from '../../api';
import { formatCurrency } from '../../utils/formatters';
import { toast } from 'react-toastify';
import CurrencyField from '../../components/common/CurrencyField';
import QuickCreateModal from '../../components/common/QuickCreateModal';
import HelpGuideTopBar from '../../components/onboarding/HelpGuideTopBar';
import SmartTooltip from '../../components/onboarding/SmartTooltip';

// ─── Palette ──────────────────────────────────────────────────────────────────
const TEAL   = '#0D9488';
const GREEN  = '#10B981';
const YELLOW = '#F59E0B';
const RED    = '#EF4444';
const BLUE   = '#3B82F6';
const ORANGE = '#F97316';

// ─── Estado de cotización ──────────────────────────────────────────────────────
const ESTADO_CONFIG = {
  vigente:    { label: 'Vigente',    color: 'success', icon: <CheckCircle sx={{ fontSize: 14 }} /> },
  vencida:    { label: 'Vencida',    color: 'error',   icon: <Cancel sx={{ fontSize: 14 }} /> },
  convertida: { label: 'Convertida', color: 'info',    icon: <Transform sx={{ fontSize: 14 }} /> },
};

// ─── Plantillas en localStorage ────────────────────────────────────────────────
const TEMPLATES_KEY = 'ksmart_quote_templates';
const loadTemplates = () => { try { return JSON.parse(localStorage.getItem(TEMPLATES_KEY) || '[]'); } catch { return []; } };
const saveTemplates = (ts) => localStorage.setItem(TEMPLATES_KEY, JSON.stringify(ts));

// ─── Helpers ──────────────────────────────────────────────────────────────────
const parseUTC = (val) => {
  if (!val) return null;
  const s = typeof val === 'string' && !val.endsWith('Z') && !val.includes('+') ? val + 'Z' : val;
  return new Date(s);
};

const fmtDate = (val) => {
  const d = parseUTC(val);
  if (!d) return '—';
  return d.toLocaleDateString('es-CO', { timeZone: 'America/Bogota', day: '2-digit', month: 'short', year: 'numeric' });
};

const fmtDateTime = (val) => {
  const d = parseUTC(val);
  if (!d) return '—';
  return d.toLocaleString('es-CO', { timeZone: 'America/Bogota', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true });
};

const fmtCotNum = (cot) => {
  const year = cot.fecha ? new Date(cot.fecha).getFullYear() : new Date().getFullYear();
  return `COT-${year}-${String(cot.id).padStart(4, '0')}`;
};

const isNearExpiry = (cot) => {
  if (cot.estado_cotizacion !== 'vigente' || !cot.valida_hasta) return false;
  const diff = parseUTC(cot.valida_hasta) - new Date();
  return diff > 0 && diff < 3 * 24 * 60 * 60 * 1000;
};

// ─── Generador de HTML para impresión ─────────────────────────────────────────
const generatePrintHTML = (cot, { subtotalBruto, ivaAmount, total }) => {
  const empresa = localStorage.getItem('empresa_nombre') || 'Mi Empresa';
  const rows = (cot.detalles || []).map((d, i) => {
    const desc = d.descuento_pct ? ` (${d.descuento_pct}% dto)` : '';
    const sub = d.cantidad * d.precio_unitario * (1 - (d.descuento_pct || 0) / 100);
    return `
      <tr style="${i % 2 === 0 ? 'background:#f8fafc' : ''}">
        <td style="padding:10px 12px">${d.producto?.nombre || '—'}</td>
        <td style="padding:10px 12px;text-align:center">${d.cantidad} ${d.producto?.unidad_medida || ''}</td>
        <td style="padding:10px 12px;text-align:right">${Number(d.precio_unitario).toLocaleString('es-CO', {style:'currency',currency:'COP',maximumFractionDigits:0})}${desc}</td>
        <td style="padding:10px 12px;text-align:right;font-weight:700">${sub.toLocaleString('es-CO', {style:'currency',currency:'COP',maximumFractionDigits:0})}</td>
      </tr>`;
  }).join('');

  const validezTxt = cot.valida_hasta ? `<div class="info-box"><div class="info-label">Válida hasta</div><div class="info-value">${fmtDate(cot.valida_hasta)}</div></div>` : '';

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>${fmtCotNum(cot)}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Segoe UI',Arial,sans-serif;font-size:13px;color:#1F1F1F;padding:40px;max-width:800px;margin:0 auto}
    .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px;padding-bottom:20px;border-bottom:3px solid ${TEAL}}
    .company{font-size:22px;font-weight:800;color:${TEAL};margin-bottom:4px}
    .badge{background:${TEAL};color:white;padding:10px 18px;border-radius:10px;font-size:20px;font-weight:800;text-align:right}
    .sub-badge{font-size:11px;opacity:0.8;margin-top:4px}
    .info-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px}
    .info-box{padding:14px;background:#f8fafc;border-radius:8px;border-left:4px solid ${TEAL}}
    .info-label{font-size:10px;text-transform:uppercase;color:#64748b;font-weight:700;letter-spacing:0.5px;margin-bottom:4px}
    .info-value{font-size:14px;font-weight:600}
    table{width:100%;border-collapse:collapse;margin-bottom:24px}
    th{background:${TEAL};color:white;padding:10px 12px;text-align:left;font-size:11px;text-transform:uppercase;font-weight:700}
    td{border-bottom:1px solid #e2e8f0}
    .totals-box{margin-left:auto;width:280px;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden}
    .total-row{display:flex;justify-content:space-between;padding:10px 16px;font-size:13px}
    .total-row:not(:last-child){border-bottom:1px solid #e2e8f0}
    .total-final{background:${TEAL};color:white;font-size:16px;font-weight:800}
    .obs-box{padding:14px 18px;background:#fffbeb;border:1px solid #fbbf24;border-radius:8px;margin-bottom:24px}
    .footer{margin-top:40px;padding-top:16px;border-top:1px solid #e2e8f0;color:#94a3b8;font-size:11px;text-align:center}
    @media print{body{padding:20px}.print-btn{display:none}}
  </style>
</head>
<body>
  <div style="margin-bottom:16px;text-align:right"><button class="print-btn" onclick="window.print()" style="background:${TEAL};color:white;border:none;padding:10px 24px;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer">🖨 Imprimir / Guardar PDF</button></div>
  <div class="header">
    <div>
      <div class="company">${empresa}</div>
      <div style="font-size:12px;color:#64748b;margin-top:2px">Documento de cotización</div>
    </div>
    <div class="badge">
      ${fmtCotNum(cot)}
      <div class="sub-badge">Emitida: ${fmtDate(cot.fecha)}</div>
    </div>
  </div>
  <div class="info-grid">
    <div class="info-box">
      <div class="info-label">Cliente</div>
      <div class="info-value">${cot.cliente?.nombre || '—'}</div>
      ${cot.cliente?.cedula ? `<div style="font-size:12px;color:#64748b;margin-top:2px">NIT/CC: ${cot.cliente.cedula}</div>` : ''}
    </div>
    ${validezTxt}
    <div class="info-box">
      <div class="info-label">Estado</div>
      <div class="info-value" style="color:${cot.estado_cotizacion === 'vigente' ? GREEN : RED}">${ESTADO_CONFIG[cot.estado_cotizacion]?.label || cot.estado_cotizacion}</div>
    </div>
    <div class="info-box">
      <div class="info-label">IVA aplicado</div>
      <div class="info-value">${cot.iva_porcentaje || 0}%</div>
    </div>
  </div>
  ${cot.observaciones ? `<div class="obs-box"><strong>Observaciones:</strong> ${cot.observaciones}</div>` : ''}
  <table>
    <thead>
      <tr><th>Producto / Servicio</th><th style="text-align:center">Cant.</th><th style="text-align:right">Precio Unit.</th><th style="text-align:right">Subtotal</th></tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="totals-box">
    <div class="total-row"><span>Subtotal</span><span>${subtotalBruto.toLocaleString('es-CO',{style:'currency',currency:'COP',maximumFractionDigits:0})}</span></div>
    <div class="total-row"><span>IVA (${cot.iva_porcentaje || 0}%)</span><span>${ivaAmount.toLocaleString('es-CO',{style:'currency',currency:'COP',maximumFractionDigits:0})}</span></div>
    <div class="total-row total-final"><span>TOTAL</span><span>${total.toLocaleString('es-CO',{style:'currency',currency:'COP',maximumFractionDigits:0})}</span></div>
  </div>
  <div class="footer">Cotización generada con Ksmart360 · ${new Date().toLocaleString('es-CO')} · Válida según condiciones indicadas</div>
</body>
</html>`;
};

// ─── Subcomponentes ────────────────────────────────────────────────────────────
function TabPanel({ children, value, index }) {
  return (
    <div role="tabpanel" hidden={value !== index}>
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
}

const EstadoChip = ({ estado }) => {
  const cfg = ESTADO_CONFIG[estado] || { label: estado, color: 'default' };
  return <Chip label={cfg.label} color={cfg.color} size="small" icon={cfg.icon} sx={{ fontWeight: 700, fontSize: 11, borderRadius: 1.5, pl: 0.5 }} />;
};

const KpiCard = ({ label, value, icon, color, sub }) => (
  <Paper sx={{ p: 2.5, borderRadius: 3, display: 'flex', alignItems: 'center', gap: 2, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', height: '100%' }}>
    <Box sx={{ width: 44, height: 44, borderRadius: 2, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: `${color}18`, color }}>
      {icon}
    </Box>
    <Box>
      <Typography sx={{ fontSize: 12, color: 'text.secondary', fontWeight: 500 }}>{label}</Typography>
      <Typography sx={{ fontSize: 18, fontWeight: 700, lineHeight: 1.2 }}>{value}</Typography>
      {sub && <Typography sx={{ fontSize: 11, color: 'text.secondary', mt: 0.2 }}>{sub}</Typography>}
    </Box>
  </Paper>
);

// ─── Fila de producto ──────────────────────────────────────────────────────────
const DetalleRow = ({ det, idx, productos, productoInput, onProductoInputChange, onProductChange, onFieldChange, onRemove, isMobile, openQuickCreate }) => {
  const subtotal = det.cantidad * det.precio_unitario * (1 - (det.descuento_pct || 0) / 100);
  const prodSel  = productos.find(p => p.id === parseInt(det.producto_id)) || null;

  return (
    <Box sx={{ mb: 1.5, p: 1.5, borderRadius: 2, bgcolor: 'action.hover', border: '1px solid', borderColor: 'divider' }}>
      <Box sx={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'stretch' : 'center', gap: 1.5 }}>
        <Autocomplete
          options={productos}
          getOptionLabel={p => p?.nombre || ''}
          value={prodSel}
          onChange={(_, v) => onProductChange(idx, v)}
          inputValue={productoInput}
          onInputChange={(_, v) => onProductoInputChange(idx, v)}
          filterOptions={(opts, state) => {
            const q = (state.inputValue || '').toLowerCase().trim();
            if (!q) return opts;
            return opts.filter(o =>
              o.nombre.toLowerCase().includes(q) ||
              (o.codigo_barras && o.codigo_barras.toLowerCase().includes(q)) ||
              (o.descripcion && o.descripcion.toLowerCase().includes(q))
            );
          }}
          noOptionsText={
            <Box sx={{ py: 0.5 }}>
              <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 1 }}>Sin resultados</Typography>
              <Button size="small" variant="contained" fullWidth startIcon={<Add />}
                onClick={() => openQuickCreate(productoInput || '', idx)}
                sx={{ borderRadius: 2, fontWeight: 600, fontSize: 12, bgcolor: TEAL }}>
                Crear "{productoInput}"
              </Button>
            </Box>
          }
          renderOption={(props, option) => (
            <li {...props} key={option.id}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%', gap: 2 }}>
                <span style={{ fontSize: 13.5 }}>{option.nombre}</span>
                <Typography variant="caption" color="text.secondary">
                  {option.es_servicio ? 'Servicio' : `Stock: ${option.stock_actual ?? 0}`}
                </Typography>
              </Box>
            </li>
          )}
          renderInput={params => <TextField {...params} label="Producto / Servicio" size="small" placeholder="Buscar…" />}
          sx={{ flex: 1, minWidth: isMobile ? '100%' : 200 }}
        />
        <TextField
          type="number" label="Cant." size="small"
          value={det.cantidad}
          onChange={e => onFieldChange(idx, 'cantidad', parseFloat(e.target.value) || 1)}
          InputProps={{ inputProps: { min: 0.01, step: 'any' } }}
          sx={{ width: isMobile ? '100%' : 80 }}
        />
        <CurrencyField
          label="Precio unit." size="small"
          value={det.precio_unitario}
          onChange={(val) => onFieldChange(idx, 'precio_unitario', val)}
          sx={{ width: isMobile ? '100%' : 130 }}
        />
        <SmartTooltip
          id="cot_descuento"
          title="Descuento por ítem"
          description="Porcentaje de descuento aplicado solo a este producto. Aparecerá reflejado en el documento de cotización."
          variant="warning"
          placement="top"
        >
          <TextField
            type="number" label="Dto %" size="small"
            value={det.descuento_pct || ''}
            placeholder="0"
            onChange={e => onFieldChange(idx, 'descuento_pct', Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)))}
            InputProps={{ inputProps: { min: 0, max: 100, step: 0.5 } }}
            sx={{ width: isMobile ? '100%' : 75 }}
          />
        </SmartTooltip>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 90 }}>
          <Box>
            <Typography sx={{ fontWeight: 700, fontSize: 13, color: TEAL }}>{formatCurrency(subtotal)}</Typography>
            {det.descuento_pct > 0 && (
              <Typography sx={{ fontSize: 10, color: 'text.secondary', textDecoration: 'line-through' }}>
                {formatCurrency(det.cantidad * det.precio_unitario)}
              </Typography>
            )}
          </Box>
          <Tooltip title="Quitar"><span>
            <IconButton size="small" onClick={() => onRemove(idx)} sx={{ color: RED, bgcolor: '#FEF2F2', borderRadius: 1.5 }}>
              <RemoveCircleOutline fontSize="small" />
            </IconButton>
          </span></Tooltip>
        </Box>
      </Box>
    </Box>
  );
};

// ─── Componente principal ──────────────────────────────────────────────────────
const Cotizaciones = () => {
  const theme    = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [tab, setTab] = useState(0);
  const [cotizaciones, setCotizaciones] = useState([]);
  const [clientes, setClientes]         = useState([]);
  const [productos, setProductos]       = useState([]);
  const [loading, setLoading]           = useState(false);

  // Form state
  const [clienteSel, setClienteSel]     = useState(null);
  const [clienteInput, setClienteInput] = useState('');
  const [ivaPorcentaje, setIvaPorcentaje] = useState(0);
  const [validaHasta, setValidaHasta]   = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [detalles, setDetalles] = useState([{ producto_id: '', cantidad: 1, precio_unitario: 0, descuento_pct: 0 }]);
  const [productoInputs, setProductoInputs] = useState(['']);

  // Confirm delete dialog
  const [confirmDel, setConfirmDel] = useState({ open: false, id: null });

  // QuickCreate
  const [quickCreate, setQuickCreate] = useState({ open: false, initialName: '', targetIdx: null });

  // Convertir modal
  const [convertirModal, setConvertirModal] = useState({ open: false, cotizacion: null });
  const [convertirPagada, setConvertirPagada] = useState(true);
  const [convertirMetodo, setConvertirMetodo] = useState('Efectivo');
  const [convertirLoading, setConvertirLoading] = useState(false);
  const [linkPagosConfig, setLinkPagosConfig] = useState([]);

  // Detail modal
  const [detailModal, setDetailModal] = useState({ open: false, cot: null });

  // Plantillas
  const [templates, setTemplates] = useState(loadTemplates);
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [loadTemplateOpen, setLoadTemplateOpen] = useState(false);

  // Filters + sort + pagination
  const [searchTerm, setSearchTerm]   = useState('');
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [fechaDesde, setFechaDesde]   = useState('');
  const [fechaHasta, setFechaHasta]   = useState('');
  const [sortBy, setSortBy]           = useState('fecha');
  const [sortDir, setSortDir]         = useState('desc');
  const [page, setPage]               = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  useEffect(() => { fetchAll(); }, []);
  useEffect(() => {
    apiClient.get('/empresa/link-pago/activos').then(r => setLinkPagosConfig(r.data || [])).catch(() => {});
  }, []);

  const fetchAll = async () => {
    try {
      const [cotRes, cliRes, prodRes] = await Promise.all([
        apiClient.get('/cotizaciones/'),
        apiClient.get('/clientes/'),
        apiClient.get('/productos/'),
      ]);
      setCotizaciones(cotRes.data);
      setClientes(cliRes.data.filter(c => c.es_cliente));
      setProductos(prodRes.data);
    } catch {
      toast.error('Error cargando cotizaciones');
    }
  };

  // ── Cálculos de totales ────────────────────────────────────────────────────
  const calcSubtotalBruto = () => detalles.reduce((s, d) => s + d.cantidad * d.precio_unitario * (1 - (d.descuento_pct || 0) / 100), 0);
  const calcIvaAmount     = () => calcSubtotalBruto() * (parseFloat(ivaPorcentaje) || 0) / 100;
  const calcTotal         = () => calcSubtotalBruto() + calcIvaAmount();

  const totalesParaCot = (cot) => {
    const sub = (cot.detalles || []).reduce((s, d) => s + d.cantidad * d.precio_unitario * (1 - (d.descuento_pct || 0) / 100), 0);
    const iva = sub * (cot.iva_porcentaje || 0) / 100;
    return { subtotalBruto: sub, ivaAmount: iva, total: sub + iva };
  };

  // ── Form helpers ───────────────────────────────────────────────────────────
  const resetForm = () => {
    setClienteSel(null); setClienteInput('');
    setIvaPorcentaje(0); setValidaHasta(''); setObservaciones('');
    setDetalles([{ producto_id: '', cantidad: 1, precio_unitario: 0, descuento_pct: 0 }]);
    setProductoInputs(['']);
  };

  const addDetalle = () => {
    setDetalles(p => [...p, { producto_id: '', cantidad: 1, precio_unitario: 0, descuento_pct: 0 }]);
    setProductoInputs(p => [...p, '']);
  };

  const removeDetalle = (idx) => {
    setDetalles(p => p.filter((_, i) => i !== idx));
    setProductoInputs(p => p.filter((_, i) => i !== idx));
  };

  const handleProductChange = (idx, newVal) => {
    setDetalles(p => p.map((d, i) => i === idx ? { ...d, producto_id: newVal?.id || '', precio_unitario: newVal?.precio || 0 } : d));
  };

  const handleFieldChange = (idx, field, val) =>
    setDetalles(p => p.map((d, i) => i === idx ? { ...d, [field]: val } : d));

  const handleProductoInputChange = (idx, val) =>
    setProductoInputs(p => { const n = [...p]; n[idx] = val; return n; });

  const openQuickCreate = (initialName, targetIdx) => setQuickCreate({ open: true, initialName, targetIdx });

  const handleQuickCreated = (nuevo) => {
    setProductos(prev => [...prev, nuevo]);
    if (quickCreate.targetIdx !== null) {
      handleProductChange(quickCreate.targetIdx, nuevo);
      handleProductoInputChange(quickCreate.targetIdx, nuevo.nombre);
    }
    setQuickCreate(q => ({ ...q, open: false }));
  };

  // ── Duplicar cotización ────────────────────────────────────────────────────
  const handleDuplicar = (cot) => {
    const cli = clientes.find(c => c.id === cot.cliente?.id) || null;
    setClienteSel(cli);
    setClienteInput(cli?.nombre || '');
    setIvaPorcentaje(cot.iva_porcentaje || 0);
    setValidaHasta('');
    setObservaciones(cot.observaciones || '');
    const newDets = (cot.detalles || []).map(d => ({
      producto_id: d.producto?.id || '',
      cantidad: d.cantidad,
      precio_unitario: d.precio_unitario,
      descuento_pct: d.descuento_pct || 0,
    }));
    setDetalles(newDets.length ? newDets : [{ producto_id: '', cantidad: 1, precio_unitario: 0, descuento_pct: 0 }]);
    setProductoInputs((cot.detalles || []).map(d => d.producto?.nombre || ''));
    setTab(0);
    toast.info('Cotización duplicada en el formulario. Ajusta y crea.');
  };

  // ── Plantillas ─────────────────────────────────────────────────────────────
  const handleSaveTemplate = () => {
    if (!templateName.trim()) return;
    const t = {
      id: Date.now(),
      nombre: templateName.trim(),
      ivaPorcentaje,
      detalles: detalles.filter(d => d.producto_id),
      productoInputs,
    };
    const updated = [...templates, t];
    setTemplates(updated);
    saveTemplates(updated);
    setSaveTemplateOpen(false);
    setTemplateName('');
    toast.success('Plantilla guardada.');
  };

  const handleLoadTemplate = (t) => {
    setIvaPorcentaje(t.ivaPorcentaje || 0);
    setDetalles(t.detalles.length ? t.detalles : [{ producto_id: '', cantidad: 1, precio_unitario: 0, descuento_pct: 0 }]);
    setProductoInputs(t.productoInputs || t.detalles.map(() => ''));
    setLoadTemplateOpen(false);
    toast.info(`Plantilla "${t.nombre}" aplicada.`);
  };

  const handleDeleteTemplate = (id) => {
    const updated = templates.filter(t => t.id !== id);
    setTemplates(updated);
    saveTemplates(updated);
  };

  // ── Print / PDF ────────────────────────────────────────────────────────────
  const handlePrint = (cot) => {
    const totales = totalesParaCot(cot);
    const html = generatePrintHTML(cot, totales);
    const win = window.open('', '_blank', 'width=900,height=700');
    win.document.write(html);
    win.document.close();
  };

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!clienteSel) { toast.warning('Selecciona un cliente.'); return; }
    if (detalles.some(d => !d.producto_id || d.cantidad <= 0)) {
      toast.warning('Todos los ítems deben tener producto y cantidad válida.');
      return;
    }
    setLoading(true);
    try {
      await apiClient.post('/cotizaciones/', {
        cliente_id:     clienteSel.id,
        detalles:       detalles.map(d => ({
          producto_id:     parseInt(d.producto_id),
          cantidad:        parseFloat(d.cantidad),
          precio_unitario: parseFloat(d.precio_unitario),
          descuento_pct:   parseFloat(d.descuento_pct) || 0,
        })),
        iva_porcentaje: parseFloat(ivaPorcentaje) || 0,
        valida_hasta:   validaHasta ? new Date(validaHasta + 'T23:59:59').toISOString() : null,
        observaciones:  observaciones || null,
      });
      toast.success('Cotización creada correctamente.');
      resetForm();
      fetchAll();
      setTab(1);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al crear la cotización.');
    } finally {
      setLoading(false);
    }
  };

  // ── Convertir ──────────────────────────────────────────────────────────────
  const handleConvertir = async () => {
    if (!convertirModal.cotizacion) return;
    setConvertirLoading(true);
    try {
      const res = await apiClient.post(`/cotizaciones/${convertirModal.cotizacion.id}/convertir`, {
        pagada:      convertirPagada,
        metodo_pago: convertirPagada ? convertirMetodo : null,
      });
      const ventaId = res.data?.venta_id || res.data?.id;
      toast.success(`¡Convertida exitosamente!${ventaId ? ` → Venta #${ventaId}` : ''}`);
      setConvertirModal({ open: false, cotizacion: null });
      fetchAll();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al convertir la cotización.');
    } finally {
      setConvertirLoading(false);
    }
  };

  // ── Eliminar ───────────────────────────────────────────────────────────────
  const handleEliminar = async () => {
    if (!confirmDel.id) return;
    try {
      await apiClient.delete(`/cotizaciones/${confirmDel.id}`);
      toast.success('Cotización eliminada.');
      setConfirmDel({ open: false, id: null });
      fetchAll();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al eliminar.');
    }
  };

  // ── Sort ───────────────────────────────────────────────────────────────────
  const handleSort = (col) => {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('desc'); }
    setPage(0);
  };

  // ── KPIs ───────────────────────────────────────────────────────────────────
  const vigentes    = cotizaciones.filter(c => c.estado_cotizacion === 'vigente');
  const convertidas = cotizaciones.filter(c => c.estado_cotizacion === 'convertida');
  const totalVigente    = vigentes.reduce((s, c) => s + c.total, 0);
  const totalConvertido = convertidas.reduce((s, c) => s + c.total, 0);
  const tasaConversion  = cotizaciones.length > 0 ? Math.round((convertidas.length / cotizaciones.length) * 100) : 0;
  const proximasVencer  = cotizaciones.filter(isNearExpiry);

  // ── Filtros + sort ─────────────────────────────────────────────────────────
  const filtradas = useMemo(() => {
    let list = cotizaciones.filter(c => {
      const matchSearch = !searchTerm ||
        (c.cliente?.nombre || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        String(c.id).includes(searchTerm);
      const matchEstado = filtroEstado === 'todos' || c.estado_cotizacion === filtroEstado;
      let matchFecha = true;
      if (fechaDesde) matchFecha = matchFecha && new Date(c.fecha) >= new Date(fechaDesde);
      if (fechaHasta) {
        const hasta = new Date(fechaHasta); hasta.setHours(23, 59, 59);
        matchFecha = matchFecha && new Date(c.fecha) <= hasta;
      }
      return matchSearch && matchEstado && matchFecha;
    });

    list = [...list].sort((a, b) => {
      let va, vb;
      if (sortBy === 'fecha')   { va = new Date(a.fecha); vb = new Date(b.fecha); }
      else if (sortBy === 'total') { va = a.total; vb = b.total; }
      else if (sortBy === 'cliente') { va = a.cliente?.nombre || ''; vb = b.cliente?.nombre || ''; return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va); }
      else if (sortBy === 'valida_hasta') { va = new Date(a.valida_hasta || 0); vb = new Date(b.valida_hasta || 0); }
      else return 0;
      return sortDir === 'asc' ? va - vb : vb - va;
    });

    return list;
  }, [cotizaciones, searchTerm, filtroEstado, fechaDesde, fechaHasta, sortBy, sortDir]);

  const paginadas = filtradas.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <Box sx={{ width: '100%' }}>

      {/* ── Header ── */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ width: 40, height: 40, borderRadius: 2, bgcolor: `${TEAL}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: TEAL }}>
            <Description />
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 700, fontSize: 20, lineHeight: 1.2 }}>Cotizaciones</Typography>
            <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>Proformas y presupuestos convertibles a venta</Typography>
          </Box>
          <HelpGuideTopBar
            moduleName="Cotizaciones"
            moduleColor={TEAL}
            steps={[
              { title: 'Selecciona el cliente', description: 'La cotización debe estar asociada a un cliente para poder convertirse a venta después.' },
              { title: 'Agrega productos o servicios', description: 'Busca por nombre o código. Ajusta precios y cantidades libremente — la cotización no descuenta stock.' },
              { title: 'Configura la vigencia', description: 'La fecha "Válida hasta" marca cuándo vence la cotización. El sistema la marca automáticamente como "Vencida".' },
              { title: 'Convierte a venta', description: 'Cuando el cliente acepte, usa el ícono de flecha en el historial. El stock se descuenta en ese momento.' },
              { title: 'Usa plantillas', description: 'Guarda cotizaciones frecuentes como plantilla para reutilizarlas sin escribirlas desde cero cada vez.' },
            ]}
            faqItems={[
              { q: '¿La cotización descuenta el stock?', a: 'No. Las cotizaciones son documentos de presupuesto y no afectan el inventario. El stock solo se descuenta cuando conviertes la cotización a una venta real.' },
              { q: '¿Cómo convierto una cotización en venta?', a: 'En el historial, busca la cotización vigente y haz clic en el ícono de conversión ↗. Podrás elegir el método de pago y el stock se descontará en ese momento.' },
              { q: '¿Para qué sirven las plantillas?', a: 'Guarda una cotización como plantilla para reutilizarla en el futuro. Ideal para servicios que cotizas frecuentemente con los mismos productos y precios.' },
              { q: '¿Cómo comparto la cotización con el cliente?', a: 'En el historial, usa el ícono de impresora 🖨️ para generar un PDF profesional listo para enviar por correo o WhatsApp.' },
            ]}
          />
        </Box>
        <Button
          variant="contained" startIcon={<AddCircleOutline />}
          onClick={() => { resetForm(); setTab(0); }}
          sx={{ bgcolor: TEAL, '&:hover': { bgcolor: '#0F766E' }, borderRadius: 2, fontWeight: 600, boxShadow: `0 4px 14px ${TEAL}40` }}
        >
          Nueva Cotización
        </Button>
      </Box>

      {/* ── Alerta vencimiento próximo ── */}
      {proximasVencer.length > 0 && (
        <Alert severity="warning" icon={<Warning />} sx={{ mb: 2.5, borderRadius: 2, fontWeight: 600 }}>
          {proximasVencer.length} cotización{proximasVencer.length > 1 ? 'es' : ''} vence{proximasVencer.length === 1 ? '' : 'n'} en menos de 3 días:&nbsp;
          {proximasVencer.map(c => fmtCotNum(c)).join(', ')}
        </Alert>
      )}

      {/* ── KPIs ── */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={2}>
          <KpiCard label="Total registradas" value={cotizaciones.length} icon={<Receipt />} color={TEAL} />
        </Grid>
        <Grid item xs={12} sm={6} md={2}>
          <KpiCard label="Vigentes" value={vigentes.length} icon={<HourglassEmpty />} color={YELLOW} sub={formatCurrency(totalVigente)} />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <KpiCard label="Valor cotizaciones vigentes" value={formatCurrency(totalVigente)} icon={<AttachMoney />} color={GREEN} />
        </Grid>
        <Grid item xs={12} sm={6} md={2}>
          <KpiCard label="Convertidas" value={convertidas.length} icon={<CheckCircleOutline />} color={BLUE} sub={formatCurrency(totalConvertido)} />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <KpiCard label="Tasa de conversión" value={`${tasaConversion}%`} icon={<TrendingUp />} color={ORANGE} sub={`${formatCurrency(totalConvertido)} cerrados`} />
        </Grid>
      </Grid>

      {/* ── Tabs ── */}
      <Paper sx={{ borderRadius: 3, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{
          px: 2, borderBottom: '1px solid', borderColor: 'divider',
          '& .MuiTab-root': { fontWeight: 600, fontSize: 13, textTransform: 'none', minHeight: 52 },
          '& .MuiTabs-indicator': { backgroundColor: TEAL, height: 3, borderRadius: 3 },
          '& .Mui-selected': { color: `${TEAL} !important` },
        }}>
          <Tab label="➕ Nueva Cotización" />
          <Tab label={`📋 Historial (${cotizaciones.length})`} />
        </Tabs>

        {/* ══ TAB 0: FORMULARIO ══ */}
        <TabPanel value={tab} index={0}>
          <Box sx={{ p: { xs: 2, md: 3 } }}>

            <Alert severity="info" sx={{ mb: 3, borderRadius: 2 }}>
              Las cotizaciones <strong>no descuentan stock</strong>. Usa "Convertir a Venta" cuando el cliente acepte.
            </Alert>

            {/* Barra de plantillas */}
            <Box sx={{ display: 'flex', gap: 1.5, mb: 3, flexWrap: 'wrap' }}>
              {templates.length > 0 && (
                <Button size="small" variant="outlined" startIcon={<BookmarkBorder />} onClick={() => setLoadTemplateOpen(true)}
                  sx={{ borderRadius: 2, fontWeight: 600, borderColor: TEAL, color: TEAL }}>
                  Cargar plantilla
                </Button>
              )}
              <SmartTooltip
                id="cot_plantilla"
                title="Guardar como plantilla"
                description="Guarda esta cotización como plantilla para reutilizarla en el futuro sin escribirla desde cero."
                variant="success"
                placement="bottom"
              >
                <Button size="small" variant="outlined" startIcon={<BookmarkAdd />} onClick={() => { setTemplateName(''); setSaveTemplateOpen(true); }}
                  sx={{ borderRadius: 2, fontWeight: 600 }}>
                  Guardar como plantilla
                </Button>
              </SmartTooltip>
            </Box>

            {/* Cliente */}
            <Box sx={{ mb: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1.5 }}>
                <Typography sx={{ fontWeight: 600, fontSize: 12, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.6 }}>
                  Cliente
                </Typography>
                <SmartTooltip
                  id="cot_cliente"
                  title="Cliente de la cotización"
                  description="Selecciona el cliente que recibirá la cotización. Su nombre aparecerá en el documento PDF impreso."
                  placement="right"
                >
                  <HelpOutline sx={{ fontSize: 14, color: 'text.disabled', cursor: 'pointer' }} />
                </SmartTooltip>
              </Box>
              <Autocomplete
                options={clientes}
                getOptionLabel={o => o?.nombre || ''}
                value={clienteSel}
                onChange={(_, v) => setClienteSel(v)}
                inputValue={clienteInput}
                onInputChange={(_, v) => setClienteInput(v)}
                filterOptions={(opts, state) => {
                  const q = (state.inputValue || '').toLowerCase().trim();
                  return q ? opts.filter(o => o.nombre.toLowerCase().includes(q) || (o.cedula || '').includes(q)) : opts;
                }}
                renderOption={(props, option) => (
                  <li {...props} key={option.id} style={{ padding: '8px 12px' }}>
                    <Box>
                      <Typography sx={{ fontSize: 14, fontWeight: 600 }}>{option.nombre}</Typography>
                      <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{option.cedula || 'Sin NIT/CC'}</Typography>
                    </Box>
                  </li>
                )}
                renderInput={params => <TextField {...params} label="Seleccionar cliente" required fullWidth placeholder="Busca por nombre o NIT…" />}
              />
            </Box>

            {/* Ítems */}
            <Box sx={{ mb: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography sx={{ fontWeight: 600, fontSize: 12, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.6 }}>
                  Productos / Servicios
                </Typography>
                <Button size="small" startIcon={<AddCircleOutline />} onClick={addDetalle} sx={{ color: TEAL, fontWeight: 600 }}>
                  Añadir ítem
                </Button>
              </Box>
              {detalles.map((det, idx) => (
                <DetalleRow
                  key={idx} det={det} idx={idx} productos={productos}
                  productoInput={productoInputs[idx] || ''}
                  onProductoInputChange={handleProductoInputChange}
                  onProductChange={handleProductChange}
                  onFieldChange={handleFieldChange}
                  onRemove={removeDetalle}
                  isMobile={isMobile}
                  openQuickCreate={openQuickCreate}
                />
              ))}
            </Box>

            <Divider sx={{ mb: 3 }} />

            {/* Configuración + resumen */}
            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth label="% IVA Global" type="number"
                  value={ivaPorcentaje}
                  onChange={e => setIvaPorcentaje(e.target.value)}
                  helperText="Se aplica sobre el subtotal"
                  size="small"
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <TextField
                    fullWidth label="Válida hasta (opcional)" type="date"
                    InputLabelProps={{ shrink: true }}
                    value={validaHasta}
                    onChange={e => setValidaHasta(e.target.value)}
                    inputProps={{ min: new Date().toLocaleDateString('en-CA') }}
                    size="small"
                  />
                  <SmartTooltip
                    id="cot_validez"
                    title="Vigencia de la cotización"
                    description="El sistema marca la cotización como 'Vencida' automáticamente después de esta fecha. Deja en blanco si no tiene vencimiento."
                    placement="top"
                  >
                    <HelpOutline sx={{ fontSize: 18, color: 'text.disabled', cursor: 'pointer', flexShrink: 0 }} />
                  </SmartTooltip>
                </Box>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Paper sx={{ p: 2, borderRadius: 2, bgcolor: `${TEAL}0D`, border: `1.5px dashed ${TEAL}60`, boxShadow: 'none', height: '100%', minHeight: 80, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>Subtotal</Typography>
                    <Typography sx={{ fontSize: 12, fontWeight: 600 }}>{formatCurrency(calcSubtotalBruto())}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>IVA ({ivaPorcentaje || 0}%)</Typography>
                    <Typography sx={{ fontSize: 12, fontWeight: 600 }}>{formatCurrency(calcIvaAmount())}</Typography>
                  </Box>
                  <Divider sx={{ my: 0.5 }} />
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>Total</Typography>
                    <Typography sx={{ fontSize: 18, fontWeight: 800, color: TEAL }}>{formatCurrency(calcTotal())}</Typography>
                  </Box>
                </Paper>
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth multiline rows={2}
                  label="Notas u observaciones (opcional)"
                  value={observaciones}
                  onChange={e => setObservaciones(e.target.value)}
                  placeholder="Ej: Incluye instalación, válido para 2 unidades mínimo…"
                  size="small"
                />
              </Grid>
            </Grid>

            <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                variant="contained" size="large"
                onClick={handleSubmit} disabled={loading}
                startIcon={<Description />}
                sx={{ bgcolor: TEAL, '&:hover': { bgcolor: '#0F766E' }, borderRadius: 2, fontWeight: 700, px: 4, boxShadow: `0 4px 14px ${TEAL}40` }}
              >
                {loading ? 'Creando…' : 'Crear Cotización'}
              </Button>
            </Box>
          </Box>
        </TabPanel>

        {/* ══ TAB 1: HISTORIAL ══ */}
        <TabPanel value={tab} index={1}>
          <Box sx={{ px: { xs: 2, md: 3 }, pb: 3 }}>

            {/* Filtros */}
            <Box sx={{ mb: 2.5, display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
              <TextField
                placeholder="Buscar cliente o #ID…"
                value={searchTerm}
                onChange={e => { setSearchTerm(e.target.value); setPage(0); }}
                InputProps={{ startAdornment: <InputAdornment position="start"><Search sx={{ fontSize: 20, color: 'text.secondary' }} /></InputAdornment> }}
                sx={{ flex: 1, minWidth: 180 }}
                size="small"
              />
              <TextField select label="Estado" value={filtroEstado} onChange={e => { setFiltroEstado(e.target.value); setPage(0); }} sx={{ minWidth: 140 }} size="small">
                <MenuItem value="todos">Todos</MenuItem>
                <MenuItem value="vigente">Vigentes</MenuItem>
                <MenuItem value="vencida">Vencidas</MenuItem>
                <MenuItem value="convertida">Convertidas</MenuItem>
              </TextField>
              <TextField label="Desde" type="date" size="small" value={fechaDesde} onChange={e => { setFechaDesde(e.target.value); setPage(0); }} InputLabelProps={{ shrink: true }} sx={{ minWidth: 145 }} />
              <TextField label="Hasta" type="date" size="small" value={fechaHasta} onChange={e => { setFechaHasta(e.target.value); setPage(0); }} InputLabelProps={{ shrink: true }} sx={{ minWidth: 145 }} />
            </Box>

            {isMobile ? (
              <Box>
                {paginadas.length === 0
                  ? <Box sx={{ textAlign: 'center', py: 6, color: 'text.secondary' }}>
                      <Description sx={{ fontSize: 48, mb: 1, opacity: 0.3 }} />
                      <Typography>No se encontraron cotizaciones</Typography>
                    </Box>
                  : paginadas.map(c => (
                      <Paper key={c.id} sx={{ p: 2.5, mb: 2, borderRadius: 3, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', border: isNearExpiry(c) ? `1.5px solid ${ORANGE}` : 'none' }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
                          <Box>
                            <Typography sx={{ fontWeight: 700, fontSize: 15 }}>{c.cliente?.nombre || 'N/A'}</Typography>
                            <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
                              {fmtCotNum(c)} · {fmtDateTime(c.fecha)}
                            </Typography>
                          </Box>
                          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.5 }}>
                            <EstadoChip estado={c.estado_cotizacion} />
                            {isNearExpiry(c) && <Chip label="Vence pronto" size="small" sx={{ fontSize: 9, height: 18, bgcolor: `${ORANGE}20`, color: ORANGE, fontWeight: 700 }} />}
                          </Box>
                        </Box>
                        <Divider sx={{ my: 1.5 }} />
                        <Grid container spacing={1} sx={{ mb: 1.5 }}>
                          {[
                            { label: 'Total', val: formatCurrency(c.total) },
                            { label: 'Válida hasta', val: fmtDate(c.valida_hasta) },
                            { label: 'Ítems', val: c.detalles?.length || 0 },
                          ].map(({ label, val }) => (
                            <Grid item xs={4} key={label}>
                              <Box sx={{ textAlign: 'center', p: 1, borderRadius: 2, bgcolor: 'action.hover' }}>
                                <Typography sx={{ fontSize: 10, color: 'text.secondary', mb: 0.2 }}>{label}</Typography>
                                <Typography sx={{ fontSize: 12, fontWeight: 700 }}>{val}</Typography>
                              </Box>
                            </Grid>
                          ))}
                        </Grid>
                        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                          <Tooltip title="Imprimir / PDF"><IconButton size="small" onClick={() => handlePrint(c)} sx={{ color: TEAL, bgcolor: `${TEAL}10`, borderRadius: 1.5 }}><Print fontSize="small" /></IconButton></Tooltip>
                          <Tooltip title="Duplicar"><IconButton size="small" onClick={() => handleDuplicar(c)} sx={{ color: BLUE, bgcolor: '#EFF6FF', borderRadius: 1.5 }}><ContentCopy fontSize="small" /></IconButton></Tooltip>
                          <Tooltip title="Ver detalle"><IconButton size="small" onClick={() => setDetailModal({ open: true, cot: c })} sx={{ color: BLUE, bgcolor: '#EFF6FF', borderRadius: 1.5 }}><Visibility fontSize="small" /></IconButton></Tooltip>
                          {c.estado_cotizacion === 'vigente' && (
                            <Tooltip title="Convertir a venta"><IconButton size="small" onClick={() => { setConvertirModal({ open: true, cotizacion: c }); setConvertirPagada(true); setConvertirMetodo('Efectivo'); }} sx={{ color: GREEN, bgcolor: '#ECFDF5', borderRadius: 1.5 }}><Transform fontSize="small" /></IconButton></Tooltip>
                          )}
                          {c.estado_cotizacion !== 'convertida' && (
                            <Tooltip title="Eliminar"><IconButton size="small" onClick={() => setConfirmDel({ open: true, id: c.id })} sx={{ color: RED, bgcolor: '#FEF2F2', borderRadius: 1.5 }}><Delete fontSize="small" /></IconButton></Tooltip>
                          )}
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
                      <TableCell sx={{ fontWeight: 700, width: 130 }}>Referencia</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>
                        <TableSortLabel active={sortBy === 'cliente'} direction={sortBy === 'cliente' ? sortDir : 'asc'} onClick={() => handleSort('cliente')}>Cliente</TableSortLabel>
                      </TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>
                        <TableSortLabel active={sortBy === 'total'} direction={sortBy === 'total' ? sortDir : 'asc'} onClick={() => handleSort('total')}>Total</TableSortLabel>
                      </TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>
                        <TableSortLabel active={sortBy === 'fecha'} direction={sortBy === 'fecha' ? sortDir : 'asc'} onClick={() => handleSort('fecha')}>Creada</TableSortLabel>
                      </TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>
                        <TableSortLabel active={sortBy === 'valida_hasta'} direction={sortBy === 'valida_hasta' ? sortDir : 'asc'} onClick={() => handleSort('valida_hasta')}>Válida Hasta</TableSortLabel>
                      </TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Estado</TableCell>
                      <TableCell sx={{ fontWeight: 700 }} align="right">Acciones</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {paginadas.length === 0
                      ? <TableRow><TableCell colSpan={7} sx={{ textAlign: 'center', py: 6, color: 'text.secondary' }}>No se encontraron cotizaciones</TableCell></TableRow>
                      : paginadas.map(c => (
                          <TableRow key={c.id} hover sx={{ bgcolor: isNearExpiry(c) ? `${ORANGE}06` : 'inherit' }}>
                            <TableCell sx={{ fontWeight: 700, fontSize: 12, color: TEAL, fontFamily: 'monospace' }}>{fmtCotNum(c)}</TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>{c.cliente?.nombre || 'N/A'}</TableCell>
                            <TableCell sx={{ fontWeight: 700, color: TEAL }}>{formatCurrency(c.total)}</TableCell>
                            <TableCell sx={{ fontSize: 12, color: 'text.secondary' }}>{fmtDateTime(c.fecha)}</TableCell>
                            <TableCell>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                {isNearExpiry(c) && <Warning sx={{ fontSize: 14, color: ORANGE }} />}
                                <Typography sx={{ fontSize: 12, color: c.estado_cotizacion === 'vencida' ? RED : isNearExpiry(c) ? ORANGE : 'text.secondary' }}>
                                  {fmtDate(c.valida_hasta)}
                                </Typography>
                              </Box>
                            </TableCell>
                            <TableCell><EstadoChip estado={c.estado_cotizacion} /></TableCell>
                            <TableCell align="right">
                              <Box sx={{ display: 'flex', gap: 0.3, justifyContent: 'flex-end' }}>
                                <Tooltip title="Imprimir / PDF" arrow><IconButton size="small" onClick={() => handlePrint(c)} sx={{ color: TEAL, '&:hover': { bgcolor: `${TEAL}10` } }}><Print fontSize="small" /></IconButton></Tooltip>
                                <Tooltip title="Duplicar cotización" arrow><IconButton size="small" onClick={() => handleDuplicar(c)} sx={{ color: BLUE, '&:hover': { bgcolor: '#EFF6FF' } }}><ContentCopy fontSize="small" /></IconButton></Tooltip>
                                <Tooltip title="Ver detalle" arrow><IconButton size="small" onClick={() => setDetailModal({ open: true, cot: c })} sx={{ color: BLUE, '&:hover': { bgcolor: '#EFF6FF' } }}><Visibility fontSize="small" /></IconButton></Tooltip>
                                {c.estado_cotizacion === 'vigente' && (
                                  <Tooltip title="Convertir a venta" arrow>
                                    <IconButton size="small" onClick={() => { setConvertirModal({ open: true, cotizacion: c }); setConvertirPagada(true); setConvertirMetodo('Efectivo'); }} sx={{ color: GREEN, '&:hover': { bgcolor: '#ECFDF5' } }}>
                                      <Transform fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                )}
                                {c.estado_cotizacion !== 'convertida' && (
                                  <Tooltip title="Eliminar" arrow><IconButton size="small" onClick={() => setConfirmDel({ open: true, id: c.id })} sx={{ color: RED, '&:hover': { bgcolor: '#FEF2F2' } }}><Delete fontSize="small" /></IconButton></Tooltip>
                                )}
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
              rowsPerPageOptions={[10, 25, 50]}
              component="div"
              count={filtradas.length}
              rowsPerPage={rowsPerPage}
              page={page}
              onPageChange={(_, p) => setPage(p)}
              onRowsPerPageChange={e => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
              labelRowsPerPage="Filas:"
              labelDisplayedRows={({ from, to, count }) => `${from}–${to} de ${count}`}
            />
          </Box>
        </TabPanel>
      </Paper>

      {/* ══ MODAL: Detalle cotización ══ */}
      <Dialog open={detailModal.open} onClose={() => setDetailModal({ open: false, cot: null })} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography sx={{ fontWeight: 700, fontSize: 17 }}>{detailModal.cot && fmtCotNum(detailModal.cot)}</Typography>
            <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{detailModal.cot?.cliente?.nombre}</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <EstadoChip estado={detailModal.cot?.estado_cotizacion} />
            <IconButton size="small" onClick={() => setDetailModal({ open: false, cot: null })}><Close fontSize="small" /></IconButton>
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          {detailModal.cot && (() => {
            const tots = totalesParaCot(detailModal.cot);
            return (
              <>
                <Grid container spacing={2} sx={{ mb: 3 }}>
                  {[
                    { label: 'Creada',       val: fmtDateTime(detailModal.cot.fecha) },
                    { label: 'Válida hasta', val: fmtDate(detailModal.cot.valida_hasta) },
                    { label: 'IVA',          val: `${detailModal.cot.iva_porcentaje || 0}%` },
                  ].map(({ label, val }) => (
                    <Grid item xs={12} sm={4} key={label}>
                      <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: 'action.hover' }}>
                        <Typography sx={{ fontSize: 11, color: 'text.secondary', mb: 0.3 }}>{label}</Typography>
                        <Typography sx={{ fontWeight: 600, fontSize: 14 }}>{val}</Typography>
                      </Box>
                    </Grid>
                  ))}
                </Grid>

                {detailModal.cot.observaciones && (
                  <Alert severity="info" sx={{ mb: 2.5, borderRadius: 2, fontSize: 13 }}>{detailModal.cot.observaciones}</Alert>
                )}

                <TableContainer sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider', mb: 2 }}>
                  <Table size="small">
                    <TableHead sx={{ bgcolor: 'action.hover' }}>
                      <TableRow>
                        {['Producto', 'Cantidad', 'Precio Unit.', 'Dto %', 'Subtotal'].map(h => (
                          <TableCell key={h} align={h !== 'Producto' ? 'right' : 'left'} sx={{ fontWeight: 700 }}>{h}</TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {(detailModal.cot.detalles || []).map((d, idx) => {
                        const sub = d.cantidad * d.precio_unitario * (1 - (d.descuento_pct || 0) / 100);
                        return (
                          <TableRow key={idx} hover>
                            <TableCell sx={{ fontWeight: 600 }}>{d.producto?.nombre}</TableCell>
                            <TableCell align="right">{d.cantidad} {d.producto?.unidad_medida}</TableCell>
                            <TableCell align="right">{formatCurrency(d.precio_unitario)}</TableCell>
                            <TableCell align="right">{d.descuento_pct ? `${d.descuento_pct}%` : '—'}</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700 }}>{formatCurrency(sub)}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>

                <Box sx={{ ml: 'auto', width: 260 }}>
                  {[
                    { label: 'Subtotal', val: tots.subtotalBruto },
                    { label: `IVA (${detailModal.cot.iva_porcentaje || 0}%)`, val: tots.ivaAmount },
                  ].map(row => (
                    <Box key={row.label} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
                      <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>{row.label}</Typography>
                      <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{formatCurrency(row.val)}</Typography>
                    </Box>
                  ))}
                  <Divider sx={{ my: 1 }} />
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography sx={{ fontSize: 15, fontWeight: 800 }}>Total</Typography>
                    <Typography sx={{ fontSize: 16, fontWeight: 800, color: TEAL }}>{formatCurrency(tots.total)}</Typography>
                  </Box>
                </Box>
              </>
            );
          })()}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
          {detailModal.cot?.estado_cotizacion === 'vigente' && (
            <Button variant="contained" startIcon={<Transform />}
              onClick={() => {
                setConvertirModal({ open: true, cotizacion: detailModal.cot });
                setDetailModal({ open: false, cot: null });
                setConvertirPagada(true); setConvertirMetodo('Efectivo');
              }}
              sx={{ bgcolor: GREEN, '&:hover': { bgcolor: '#059669' }, borderRadius: 2, fontWeight: 700, mr: 'auto' }}>
              Convertir a Venta
            </Button>
          )}
          <Button startIcon={<Print />} onClick={() => handlePrint(detailModal.cot)} variant="outlined" sx={{ borderRadius: 2, fontWeight: 600, color: TEAL, borderColor: TEAL }}>
            Imprimir
          </Button>
          <Button onClick={() => setDetailModal({ open: false, cot: null })} variant="outlined" sx={{ borderRadius: 2, fontWeight: 600, borderColor: 'divider' }}>
            Cerrar
          </Button>
        </DialogActions>
      </Dialog>

      {/* ══ MODAL: Convertir a venta ══ */}
      <Dialog open={convertirModal.open} onClose={() => setConvertirModal({ open: false, cotizacion: null })} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3, overflow: 'hidden' } }}>
        <Box sx={{ height: 5, background: `linear-gradient(90deg, ${TEAL}, ${GREEN})` }} />
        <DialogTitle sx={{ fontWeight: 800, fontSize: 18 }}>Convertir Cotización a Venta</DialogTitle>
        <DialogContent dividers sx={{ p: 3 }}>
          {convertirModal.cotizacion && (
            <>
              <Box sx={{ p: 2, mb: 3, borderRadius: 2, bgcolor: `${TEAL}08`, border: `1px solid ${TEAL}30` }}>
                <Typography sx={{ fontWeight: 700, fontSize: 15, mb: 0.5 }}>{convertirModal.cotizacion.cliente?.nombre}</Typography>
                <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 1 }}>
                  {fmtCotNum(convertirModal.cotizacion)} · {convertirModal.cotizacion.detalles?.length || 0} ítem(s)
                </Typography>
                <Typography sx={{ fontWeight: 800, fontSize: 20, color: TEAL }}>{formatCurrency(convertirModal.cotizacion.total)}</Typography>
              </Box>

              <Typography sx={{ fontWeight: 600, fontSize: 12, mb: 2, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.6 }}>
                Método de pago
              </Typography>

              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2.5 }}>
                {[
                  { value: 'Efectivo', label: '💵 Efectivo',  pagada: true },
                  ...linkPagosConfig.map(l => ({ value: `Link de Pago: ${l.nombre}`, label: `📲 ${l.nombre}`, pagada: true })),
                  { value: null,       label: '🕒 Por Cobrar', pagada: false },
                ].map(opt => {
                  const selected = opt.pagada ? (convertirPagada && convertirMetodo === opt.value) : !convertirPagada;
                  const color = opt.pagada ? GREEN : RED;
                  return (
                    <Box key={opt.label}
                      onClick={() => { setConvertirPagada(opt.pagada); if (opt.value) setConvertirMetodo(opt.value); }}
                      sx={{ px: 2, py: 1, borderRadius: 2, cursor: 'pointer', border: '1.5px solid', borderColor: selected ? color : 'divider', bgcolor: selected ? `${color}12` : 'background.paper', color: selected ? color : 'text.secondary', fontSize: 13, fontWeight: selected ? 700 : 500, transition: 'all 0.15s', userSelect: 'none', '&:hover': { borderColor: color } }}>
                      {opt.label}
                    </Box>
                  );
                })}
              </Box>

              <Alert severity="warning" sx={{ borderRadius: 2, fontSize: 13 }}>
                Esta acción <strong>validará el stock</strong> y creará los movimientos de inventario. No se puede deshacer.
              </Alert>
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
          <Button onClick={() => setConvertirModal({ open: false, cotizacion: null })} variant="outlined" sx={{ borderRadius: 2, fontWeight: 600, borderColor: 'divider' }} disabled={convertirLoading}>
            Cancelar
          </Button>
          <Button variant="contained" onClick={handleConvertir} disabled={convertirLoading} startIcon={<Payments />}
            sx={{ bgcolor: GREEN, '&:hover': { bgcolor: '#059669' }, borderRadius: 2, fontWeight: 700, px: 3 }}>
            {convertirLoading ? 'Procesando…' : 'Confirmar y Convertir'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ══ MODAL: Confirmar eliminación ══ */}
      <Dialog open={confirmDel.open} onClose={() => setConfirmDel({ open: false, id: null })} maxWidth="xs" fullWidth>
        <DialogContent sx={{ textAlign: 'center', pt: 4, pb: 2 }}>
          <Delete sx={{ fontSize: 44, color: RED, mb: 1.5 }} />
          <Typography sx={{ fontWeight: 800, fontSize: 18, mb: 1 }}>¿Eliminar cotización?</Typography>
          <Typography sx={{ color: 'text.secondary', fontSize: 14 }}>Esta acción no se puede deshacer.</Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2.5, pt: 1, gap: 1 }}>
          <Button fullWidth onClick={() => setConfirmDel({ open: false, id: null })} sx={{ fontWeight: 700 }}>Cancelar</Button>
          <Button fullWidth variant="contained" onClick={handleEliminar} sx={{ bgcolor: RED, fontWeight: 700 }}>Eliminar</Button>
        </DialogActions>
      </Dialog>

      {/* ══ MODAL: Guardar plantilla ══ */}
      <Dialog open={saveTemplateOpen} onClose={() => setSaveTemplateOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>Guardar como Plantilla</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus fullWidth label="Nombre de la plantilla" size="small" sx={{ mt: 1 }}
            value={templateName} onChange={e => setTemplateName(e.target.value)}
            placeholder="Ej: Kit instalación eléctrica"
            onKeyDown={e => e.key === 'Enter' && handleSaveTemplate()}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2.5, gap: 1 }}>
          <Button onClick={() => setSaveTemplateOpen(false)} sx={{ fontWeight: 700 }}>Cancelar</Button>
          <Button variant="contained" onClick={handleSaveTemplate} disabled={!templateName.trim()} sx={{ bgcolor: TEAL, fontWeight: 700 }}>Guardar</Button>
        </DialogActions>
      </Dialog>

      {/* ══ MODAL: Cargar plantilla ══ */}
      <Dialog open={loadTemplateOpen} onClose={() => setLoadTemplateOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>Cargar Plantilla</DialogTitle>
        <DialogContent sx={{ p: 0 }}>
          <Stack>
            {templates.map(t => (
              <Box key={t.id} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 3, py: 1.5, '&:hover': { bgcolor: 'action.hover' }, cursor: 'pointer' }} onClick={() => handleLoadTemplate(t)}>
                <Box>
                  <Typography sx={{ fontWeight: 700 }}>{t.nombre}</Typography>
                  <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{t.detalles.length} ítem(s) · IVA {t.ivaPorcentaje || 0}%</Typography>
                </Box>
                <IconButton size="small" onClick={e => { e.stopPropagation(); handleDeleteTemplate(t.id); }} sx={{ color: RED }}>
                  <Delete fontSize="small" />
                </IconButton>
              </Box>
            ))}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setLoadTemplateOpen(false)} sx={{ fontWeight: 700 }}>Cerrar</Button>
        </DialogActions>
      </Dialog>

      {/* ── QuickCreate ── */}
      <QuickCreateModal
        open={quickCreate.open}
        onClose={() => setQuickCreate(q => ({ ...q, open: false }))}
        type="producto"
        initialName={quickCreate.initialName}
        onCreated={handleQuickCreated}
      />

    </Box>
  );
};

export default Cotizaciones;
