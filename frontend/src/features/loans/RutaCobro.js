import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box, Typography, Paper, CircularProgress, IconButton, Tooltip, Button,
  Divider, Chip, Grid, TextField, InputAdornment, Autocomplete,
  FormControlLabel, Switch, Badge, Stack, Avatar, MenuItem
} from '@mui/material';
import {
  WhatsApp, CheckCircle, Search, DirectionsRun, LocationOn,
  PersonSearch, MoreTime, FilterList, AccountBalanceWallet,
  AssignmentInd, TrendingUp, PointOfSale, Receipt, Edit, Print,
  PictureAsPdf, Map as MapIcon, FilterAlt, PhotoCamera, NotInterested,
  ErrorOutline
} from '@mui/icons-material';
import apiClient from '../../api';
import { formatCurrency } from '../../utils/formatters';
import { toast } from 'react-toastify';
import CurrencyField from '../../components/common/CurrencyField';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import HelpGuideTopBar from '../../components/onboarding/HelpGuideTopBar';
import { sunmiDisponible, imprimirRecibo as imprimirReciboSunmi, padLR } from '../../utils/sunmiPrinter';
import { printHtml } from '../../utils/printHtml';

const ACCENT = '#0891B2';
const GREEN  = '#10B981';
const BLUE   = '#3B82F6';
const YELLOW = '#F59E0B';
const RED = '#EF4444';

const calcularMoraCliente = (cuota, tasaMoraMensual = 2) => {
  if (cuota.estado_pago === 'Pagado' || (cuota.saldo_pendiente || 0) <= 0)
    return { mora: 0, dias: 0, total: cuota.saldo_pendiente || 0 };
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const fv = new Date(((cuota.fecha_vencimiento || '').split('T')[0]) + 'T00:00:00');
  if (fv >= hoy) return { mora: 0, dias: 0, total: cuota.saldo_pendiente };
  const dias = Math.floor((hoy - fv) / 86400000);
  const tasaDiaria = (tasaMoraMensual / 100) / 30;
  const mora = Math.round(cuota.saldo_pendiente * tasaDiaria * dias);
  return { mora, dias, total: cuota.saldo_pendiente + mora };
};

// ─── Formatea fecha legible dd/mm/yyyy ────────────────────────────────────────
const getSafeDateString = (fechaStr) => {
  if (!fechaStr) return 'Sin fecha';
  try {
    const base = fechaStr.split('T')[0];
    const [year, month, day] = base.split('-');
    return `${day}/${month}/${year}`;
  } catch {
    return 'Inválida';
  }
};

// ─── Genera texto del recibo para WhatsApp ────────────────────────────────────
const generarTextoRecibo = (cuota, montoPagado, saldoRestante) => {
  const ahora    = new Date();
  const fecha    = ahora.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const hora     = ahora.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
  const vence    = getSafeDateString(cuota.fecha_vencimiento);
  const saldo    = typeof saldoRestante === 'number' ? saldoRestante : (cuota.saldo_pendiente - montoPagado);
  const saldoFmt = saldo > 0 ? formatCurrency(Math.max(0, saldo)) : '✅ Saldada';

  return (
    `🧾 *RECIBO DE PAGO - Ksmart360*\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `👤 *Cliente:* ${cuota.cliente_nombre}\n` +
    `📋 *Préstamo #${cuota.prestamo_id} | Cuota #${cuota.numero_cuota}*\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `💰 *Valor recibido:* ${formatCurrency(montoPagado)}\n` +
    `📅 *Fecha de pago:* ${fecha} ${hora}\n` +
    `📆 *Vencimiento cuota:* ${vence}\n` +
    `💳 *Saldo restante:* ${saldoFmt}\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `_Powered by Ksmart360_`
  );
};

// ─── Arma las líneas del recibo para la térmica Sunmi ─────────────────────────
const buildReciboLines = (cuota, montoPagado, saldoRestante) => {
  const ahora    = new Date();
  const fecha    = ahora.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const hora     = ahora.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
  const saldo    = typeof saldoRestante === 'number' ? saldoRestante : (cuota.saldo_pendiente - montoPagado);
  const saldoFmt = saldo > 0 ? formatCurrency(Math.max(0, saldo)) : 'SALDADA';
  const lines = [];
  lines.push({ text: 'KSMART360', align: 'center', size: 30, bold: true });
  lines.push({ text: 'Sistema de Gestion de Cartera', align: 'center', size: 20 });
  lines.push({ type: 'divider' });
  lines.push({ text: padLR('Recibo N.', String(cuota.cuota_id)), size: 22 });
  lines.push({ text: padLR('Fecha', `${fecha} ${hora}`), size: 22 });
  lines.push({ type: 'divider' });
  lines.push({ text: padLR('Cliente', cuota.cliente_nombre || ''), size: 22 });
  lines.push({ text: padLR('Prestamo #', String(cuota.prestamo_id)), size: 22 });
  lines.push({ text: padLR('Cuota #', String(cuota.numero_cuota)), size: 22 });
  lines.push({ text: padLR('Vencimiento', getSafeDateString(cuota.fecha_vencimiento)), size: 22 });
  lines.push({ type: 'divider' });
  // Tamaño 24 = ancho calibrado a 32 caracteres; con un tamaño mayor la térmica
  // parte la línea del valor en dos renglones.
  lines.push({ text: padLR('VALOR RECIBIDO', formatCurrency(montoPagado)), size: 24, bold: true });
  lines.push({ text: padLR('Saldo restante', saldoFmt), size: 22 });
  lines.push({ type: 'divider' });
  lines.push({ text: 'Ksmart360 · Gracias por su pago', align: 'center', size: 20 });
  lines.push({ type: 'feed' });
  return lines;
};

// ─── Imprime recibo en ventana del navegador ──────────────────────────────────
const imprimirRecibo = async (cuota, montoPagado, saldoRestante) => {
  // En el dispositivo Sunmi imprimimos en la térmica integrada.
  if (await sunmiDisponible()) {
    try {
      await imprimirReciboSunmi(buildReciboLines(cuota, montoPagado, saldoRestante));
      return;
    } catch (e) {
      console.warn('imprimirRecibo: falló Sunmi, se usa HTML', e);
    }
  }

  const ahora    = new Date();
  const fecha    = ahora.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const hora     = ahora.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
  const saldo    = typeof saldoRestante === 'number' ? saldoRestante : (cuota.saldo_pendiente - montoPagado);
  const saldoFmt = saldo > 0 ? formatCurrency(Math.max(0, saldo)) : 'SALDADA ✓';

  const html = `<!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8"/>
      <title>Recibo #${cuota.cuota_id}</title>
      <style>
        * { margin:0; padding:0; box-sizing:border-box; }
        body { font-family:'Courier New',monospace; width:280px; padding:16px; font-size:12px; }
        .logo   { text-align:center; font-size:18px; font-weight:700; letter-spacing:1px; margin-bottom:4px; }
        .sub    { text-align:center; font-size:10px; color:#555; margin-bottom:12px; }
        .sep    { border-top:1px dashed #000; margin:8px 0; }
        .row    { display:flex; justify-content:space-between; margin:3px 0; }
        .label  { color:#555; }
        .val    { font-weight:700; text-align:right; }
        .total  { font-size:15px; margin-top:6px; }
        .footer { text-align:center; margin-top:12px; font-size:10px; color:#888; }
      </style>
    </head>
    <body>
      <div class="logo">KSMART360</div>
      <div class="sub">Sistema de Gestión de Cartera</div>
      <div class="sep"></div>
      <div class="row"><span class="label">Recibo N°</span><span class="val">${cuota.cuota_id}</span></div>
      <div class="row"><span class="label">Fecha</span><span class="val">${fecha} ${hora}</span></div>
      <div class="sep"></div>
      <div class="row"><span class="label">Cliente</span><span class="val">${cuota.cliente_nombre}</span></div>
      <div class="row"><span class="label">Préstamo #</span><span class="val">${cuota.prestamo_id}</span></div>
      <div class="row"><span class="label">Cuota #</span><span class="val">${cuota.numero_cuota}</span></div>
      <div class="row"><span class="label">Vencimiento</span><span class="val">${getSafeDateString(cuota.fecha_vencimiento)}</span></div>
      <div class="sep"></div>
      <div class="row total"><span class="label">VALOR RECIBIDO</span><span class="val">${formatCurrency(montoPagado)}</span></div>
      <div class="row"><span class="label">Saldo restante</span><span class="val">${saldoFmt}</span></div>
      <div class="sep"></div>
      <div class="footer">Ksmart360 · Gracias por su pago</div>
    </body>
    </html>`;

  // printHtml: seguro dentro de la app instalada (window.open bloqueaba el WebView)
  printHtml(html, 'width=320,height=480');
};

// ─── Descarga el PDF desde el backend ─────────────────────────────────────────
const descargarPDF = async (cuota, montoPagado, saldoRestante) => {
  try {
    const params = new URLSearchParams({
      monto_pagado:    montoPagado,
      saldo_restante:  Math.max(0, saldoRestante),
    });

    // apiClient ya tiene el token en los headers por interceptor
    const response = await apiClient.get(
      `/prestamos/cuotas/${cuota.cuota_id}/recibo-pdf?${params.toString()}`,
      { responseType: 'blob' }   // ← clave: recibir bytes, no JSON
    );

    const blob    = new Blob([response.data], { type: 'application/pdf' });
    const url     = URL.createObjectURL(blob);
    const a       = document.createElement('a');
    a.href        = url;
    a.download    = `recibo_cuota_${cuota.cuota_id}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success('PDF descargado');
  } catch (err) {
    console.error(err);
    toast.error('Error al generar el PDF. Verifica que reportlab esté instalado en el servidor.');
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════
const RutaCobro = () => {
  const [cuotas,       setCuotas]       = useState([]);
  const [usuarios,     setUsuarios]     = useState([]);
  const [resumenDias,  setResumenDias]  = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [searchTerm,   setSearchTerm]   = useState('');
  const [filtroFecha,  setFiltroFecha]  = useState(new Date().toLocaleDateString('en-CA'));
  const [filtroZona,   setFiltroZona]   = useState('');
  const [currentUser,  setCurrentUser]  = useState(null);

  const [mapaModal,    setMapaModal]    = useState(false);
  const [evidenciaModal, setEvidenciaModal] = useState({ open: false, cuota: null, tipo: 'No encontrado', comentario: '', foto: null, uploading: false });

  const [asignacionGlobal,   setAsignacionGlobal]   = useState({});
  const [editandoAsignacion, setEditandoAsignacion] = useState({});

  // Estados faltantes identificados por ESLint
  const [pagoModal,        setPagoModal]        = useState({ open: false, cuota: null, monto: '', metodoPago: 'Efectivo' });
  const [reciboModal,      setReciboModal]      = useState({ open: false, cuota: null, monto: 0, saldoRestante: 0 });
  const [reprogramarModal, setReprogramarModal] = useState({ open: false, cuota: null, nuevaFecha: '' });
  const [liquidacionModal, setLiquidacionModal] = useState(false);
  const [datosLiquidacion, setDatosLiquidacion] = useState(null);
  const [pdfLoading,       setPdfLoading]       = useState(false);
  const [cobrasHoy, setCobrasHoy] = useState([]);
  const [sortCuotas, setSortCuotas] = useState('mora');
  const [linkPagosConfig, setLinkPagosConfig] = useState([]);

  const esAdmin = currentUser?.role?.name === 'Admin';

  // Solo Efectivo viene fijo — el resto son los links de pago que la empresa
  // configure en Mi Cuenta → Link de Pago.
  const metodosPago = [
    { value: 'Efectivo', label: '💵 Efectivo' },
    ...linkPagosConfig.map(l => ({ value: `Link de Pago: ${l.nombre}`, label: `📲 ${l.nombre}` })),
  ];

  useEffect(() => {
    apiClient.get('/empresa/link-pago/activos').then(r => setLinkPagosConfig(r.data || [])).catch(() => {});
  }, []);

  // ── Carga de datos ────────────────────────────────────────────────────────
  const fetchInicial = useCallback(async () => {
    try {
      const [resCuotas, resResumen] = await Promise.all([
        apiClient.get('/prestamos/cuotas-pendientes'),
        apiClient.get('/prestamos/calendario-resumen')
      ]);
      setCuotas(resCuotas.data);
      setResumenDias(resResumen.data);
    } catch (e) {
      console.error("Error al refrescar cuotas:", e);
    }
  }, []);

  useEffect(() => {
    const cargarTodo = async () => {
      setLoading(true);
      try {
        const [resUser, resUsuarios] = await Promise.all([
          apiClient.get('/users/me'),
          apiClient.get('/users')
        ]);
        setCurrentUser(resUser.data);
        setUsuarios(resUsuarios.data.filter(u => u.is_active !== false));
        await fetchInicial();
      } catch (e) {
        toast.error("Error al cargar la ruta de cobro");
      } finally {
        setLoading(false);
      }
    };
    cargarTodo();
  }, [fetchInicial]);

  const zonasDisponibles = useMemo(() => {
    const zs = new Set(cuotas.map(c => c.zona).filter(Boolean));
    return Array.from(zs).sort();
  }, [cuotas]);

  // ── Filtrado de cuotas ────────────────────────────────────────────────────
  const cuotasFiltradas = useMemo(() => {
    let list = cuotas.filter(c => {
      const asignadaAMi = !esAdmin ? c.usuario_asignado_id === currentUser?.id : true;
      const matchSearch =
        (c.cliente_nombre    || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.cliente_direccion || '').toLowerCase().includes(searchTerm.toLowerCase());
      const fechaCuota = c.fecha_vencimiento ? c.fecha_vencimiento.split('T')[0] : '';
      const matchFecha = filtroFecha ? fechaCuota === filtroFecha : true;
      const matchZona  = filtroZona ? c.zona === filtroZona : true;
      return asignadaAMi && matchSearch && matchFecha && matchZona;
    });

    list.sort((a, b) => {
      if (sortCuotas === 'mora') {
        const { mora: ma } = calcularMoraCliente(a, 2);
        const { mora: mb } = calcularMoraCliente(b, 2);
        return mb - ma;
      }
      if (sortCuotas === 'monto') return (b.saldo_pendiente || 0) - (a.saldo_pendiente || 0);
      const fa = (a.fecha_vencimiento || '').split('T')[0];
      const fb = (b.fecha_vencimiento || '').split('T')[0];
      return fa.localeCompare(fb);
    });

    return list;
  }, [cuotas, searchTerm, filtroFecha, filtroZona, esAdmin, currentUser, sortCuotas]);

  // ── Registrar Evidencia ──────────────────────────────────────────────────
  const guardarEvidencia = async () => {
    const { cuota, tipo, comentario, foto } = evidenciaModal;
    let geoParams = {};
    try {
      if (navigator.geolocation) {
        const pos = await new Promise((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000, enableHighAccuracy: true }));
        geoParams = { latitud: pos.coords.latitude, longitud: pos.coords.longitude };
      }
    } catch { /* geolocation unavailable or denied */ }
    setEvidenciaModal(prev => ({ ...prev, uploading: true }));
    try {
      const formData = new FormData();
      if (foto) formData.append('foto', foto);

      await apiClient.post(`/prestamos/evidencia`, formData, {
        params: {
          cuota_id: cuota.cuota_id,
          tipo,
          comentario,
          ...geoParams,
        },
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success('Evidencia guardada correctamente');
      setEvidenciaModal({ open: false, cuota: null, tipo: 'No encontrado', comentario: '', foto: null, uploading: false });
      fetchInicial();
    } catch {
      toast.error('Error al guardar evidencia');
      setEvidenciaModal(prev => ({ ...prev, uploading: false }));
    }
  };

  const kpis = useMemo(() => {
    let total = 0, moraTotal = 0, vencidas = 0;
    cuotasFiltradas.forEach(c => {
      const { mora, dias } = calcularMoraCliente(c, 2);
      total += (c.saldo_pendiente || 0);
      moraTotal += mora;
      if (dias > 0) vencidas++;
    });
    return { total, moraTotal, vencidas, cantidad: cuotasFiltradas.length, cobrasHoy: cobrasHoy.length };
  }, [cuotasFiltradas, cobrasHoy]);

  // ── Liquidación diaria ────────────────────────────────────────────────────
  const abrirLiquidacion = async () => {
    try {
      const res = await apiClient.get('/prestamos/liquidacion-diaria');
      setDatosLiquidacion(res.data);
      setLiquidacionModal(true);
    } catch {
      toast.error('Error al obtener la liquidación del día.');
    }
  };

  const confirmarLiquidacion = () => {
    toast.success('✅ Cierre de caja auditado correctamente.');
    setLiquidacionModal(false);
  };

  // ── Asignación de cobrador ────────────────────────────────────────────────
  const handleToggleGlobal = (cuotaId) =>
    setAsignacionGlobal(prev => ({ ...prev, [cuotaId]: !prev[cuotaId] }));

  const handleOpenMaps = (direccion) => {
    if (!direccion) return toast.info('El cliente no tiene dirección registrada');
    window.open(`https://maps.google.com/maps?q=${encodeURIComponent(direccion)}`, '_blank');
  };

  const handleAsignar = async (cuota, newValue) => {
    const usuarioId = newValue ? newValue.id : null;
    const idReal    = cuota.cuota_id || cuota.id;
    const isGlobal  = !!asignacionGlobal[idReal];

    const payload = {
      usuario_id: usuarioId,
      cliente_id: isGlobal ? cuota.cliente_id : null,
      cuota_ids:  !isGlobal ? [idReal] : null,
    };

    if (isGlobal && !cuota.cliente_id) {
      toast.error('Error: No se encontró el identificador del cliente.');
      return;
    }

    try {
      await apiClient.post('/prestamos/asignar-cobrador', payload);
      toast.success(isGlobal ? 'Se asignó TODA la ruta del cliente.' : 'Cobrador asignado a la cuota.');
      setEditandoAsignacion(prev => ({ ...prev, [idReal]: false }));
      fetchInicial();
    } catch (e) {
      toast.error(`Fallo la asignación: ${e.response?.data?.detail || 'Verifique los datos'}`);
    }
  };

  // ── Confirmar pago → abrir modal recibo ───────────────────────────────────
const confirmarPago = async () => {
  const { cuota, monto, metodoPago } = pagoModal;
  const montoPagado = parseFloat(monto);
  if (!montoPagado || montoPagado <= 0) {
    toast.warning('Ingresa un monto válido mayor a cero.');
    return;
  }
  try {
    const res = await apiClient.post(
      `/prestamos/cuotas/${cuota.cuota_id}/pagar`,
      { monto_pagado: montoPagado, metodo_pago: metodoPago }   // ← método incluido
    );
    toast.success(res.data?.msg || 'Pago registrado');

    const saldoRestante = Math.max(0, (cuota.saldo_pendiente || 0) - montoPagado);
    setPagoModal({ open: false, cuota: null, monto: '', metodoPago: 'Efectivo' });
    setReciboModal({ open: true, cuota: { ...cuota, metodoPago }, monto: montoPagado, saldoRestante });
    fetchInicial();
    setCobrasHoy(prev => [...prev, cuota.cuota_id]);
  } catch (error) {
    toast.error(error.response?.data?.detail || 'Error en el pago');
  }
};


  // ── Reprogramar cuota ─────────────────────────────────────────────────────
  const confirmarReprogramacion = async () => {
    const { cuota, nuevaFecha } = reprogramarModal;
    try {
      await apiClient.post(
        `/prestamos/cuotas/${cuota.cuota_id}/reprogramar`,
        { nueva_fecha: new Date(nuevaFecha + 'T23:59:59').toISOString() }
      );
      toast.success('Compromiso actualizado');
      setReprogramarModal({ open: false, cuota: null, nuevaFecha: '' });
      fetchInicial();
    } catch {
      toast.error('Error al reprogramar');
    }
  };

  // ── Handler PDF con loading ───────────────────────────────────────────────
  const handleDescargarPDF = async () => {
    setPdfLoading(true);
    await descargarPDF(reciboModal.cuota, reciboModal.monto, reciboModal.saldoRestante);
    setPdfLoading(false);
  };

  if (loading) return <Box sx={{ p: 5, textAlign: 'center' }}><CircularProgress /></Box>;

  return (
    <Box sx={{ maxWidth: 1100, margin: '0 auto', p: { xs: 1, sm: 3 }, boxSizing: 'border-box' }}>

      {/* ── KPIs ── */}
      <Grid container spacing={1.5} sx={{ mb: 3 }}>
        {[
          { icon: <AccountBalanceWallet />, color: BLUE,   label: 'TOTAL RUTA',    value: formatCurrency(kpis.total),   sub: `${kpis.cantidad} cobros pendientes` },
          { icon: <ErrorOutline />,        color: kpis.moraTotal > 0 ? RED : GREEN, label: 'MORA ACUMULADA', value: kpis.moraTotal > 0 ? formatCurrency(kpis.moraTotal) : 'Sin mora', sub: kpis.vencidas > 0 ? `${kpis.vencidas} vencidas` : 'Todas al día' },
          { icon: <AssignmentInd />,       color: ACCENT, label: 'PENDIENTES HOY', value: `${kpis.cantidad}`,          sub: 'Clientes a visitar' },
          { icon: <CheckCircle />,         color: GREEN,  label: 'COBRADAS HOY',   value: `${kpis.cobrasHoy}`,         sub: 'En esta sesión' },
        ].map(({ icon, color, label, value, sub }) => (
          <Grid item xs={6} sm={3} key={label}>
            <Paper sx={{ p: 1.5, borderRadius: 3, height: '100%', border: '1px solid', borderColor: 'divider', display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                <Avatar sx={{ width: 26, height: 26, bgcolor: `${color}15`, color, '& .MuiSvgIcon-root': { fontSize: 15 } }}>{icon}</Avatar>
                <Typography sx={{ fontSize: 9, fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.5, lineHeight: 1.2 }}>{label}</Typography>
              </Box>
              <Typography sx={{ fontWeight: 900, fontSize: 15, color, lineHeight: 1.1 }}>{value}</Typography>
              {sub && <Typography sx={{ fontSize: 9, color: 'text.secondary' }}>{sub}</Typography>}
            </Paper>
          </Grid>
        ))}
      </Grid>

      {/* ── Header ── */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 800 }}>
              {esAdmin ? 'Gestión de Rutas' : 'Mi Ruta de Cobro'}
            </Typography>
            <Typography color="text.secondary" sx={{ fontSize: 13 }}>
              {esAdmin ? 'Asigna personal y supervisa el recaudo' : 'Cobros asignados para ti'}
            </Typography>
          </Box>
          <HelpGuideTopBar
            moduleName="Ruta de Cobro"
            moduleColor={ACCENT}
            steps={[
              { title: 'Revisa los cobros pendientes', description: 'Verás todos los préstamos con cuotas vencidas asignados a tu ruta, ordenados por vencimiento.' },
              { title: 'Filtra por fecha', description: 'Usa el calendario de cobros para ver qué cuotas vencen en cada fecha específica.' },
              { title: 'Registra el pago', description: 'Selecciona una cuota, ingresa el monto recibido y el método de pago. El saldo se actualiza automáticamente.' },
              { title: 'Cierre de ruta', description: 'Al final del día, el administrador realiza el cierre para consolidar el total recaudado por cada cobrador.' },
            ]}
            faqItems={[
              { q: '¿Qué son los cobros pendientes?', a: 'Son cuotas de préstamos que ya vencieron y aún no han sido pagadas. Aparecen ordenadas por fecha de vencimiento.' },
              { q: '¿Cómo registro un pago parcial?', a: 'Abre el detalle del cobro e ingresa el monto recibido aunque sea menor a la cuota. El sistema actualiza el saldo pendiente.' },
              { q: '¿Puedo ver los cobros en un mapa?', a: 'Sí, usa el botón "Mapa" en la esquina superior derecha. Los clientes con geolocalización aparecerán como puntos en el mapa.' },
              { q: '¿Qué es el cierre de ruta?', a: 'Es el proceso al final del día donde el administrador valida el total cobrado por cada cobrador y registra el resumen del día.' },
            ]}
          />
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Button variant="outlined" startIcon={<MapIcon />} onClick={() => setMapaModal(true)}
            sx={{ color: BLUE, borderColor: BLUE, fontWeight: 700, borderRadius: 3, height: 45 }}>
            Mapa
          </Button>
          {esAdmin && (
            <Button variant="contained" startIcon={<PointOfSale />} onClick={abrirLiquidacion}
              sx={{ bgcolor: ACCENT, fontWeight: 800, borderRadius: 3, height: 45 }}>
              Cierre
            </Button>
          )}
          <Box sx={{ p: 1.2, borderRadius: 3, bgcolor: `${ACCENT}15`, color: ACCENT,
            display: { xs: 'none', sm: 'flex' } }}>
            <DirectionsRun fontSize="large" />
          </Box>
        </Box>
      </Box>

      {/* ── Filtros / Calendario ── */}
      <Paper sx={{ p: 2.5, mb: 3, borderRadius: 4, boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>

  {/* Cabecera del calendario */}
  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: 2 }}>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <FilterList sx={{ color: 'text.secondary', fontSize: 20 }} />
      <Typography sx={{ fontSize: 13, fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase' }}>
        Calendario de Cobros
      </Typography>
    </Box>
    {filtroFecha && (
      <Chip
        label="Limpiar filtro"
        size="small"
        onDelete={() => setFiltroFecha('')}
        sx={{ fontWeight: 600, fontSize: 11 }}
      />
    )}
  </Box>

  {/* Chips de fechas agrupados por semana */}
  {(() => {
    // Agrupa resumenDias por semana (lunes–domingo)
    const grupos = {};
    resumenDias.forEach(d => {
      const fecha = new Date(d.fecha + 'T00:00:00');
      // Número de semana relativo al primer día del conjunto
      const lunes = new Date(fecha);
      lunes.setDate(fecha.getDate() - ((fecha.getDay() + 6) % 7)); // lunes de esa semana
      const key = lunes.toISOString().split('T')[0];
      if (!grupos[key]) grupos[key] = [];
      grupos[key].push(d);
    });

    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 2 }}>
        {/* "Ver todo" siempre visible */}
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
          <Chip
            label="Ver todo"
            onClick={() => setFiltroFecha('')}
            sx={{
              fontWeight: 700,
              bgcolor: filtroFecha === '' ? ACCENT : 'background.default',
              color:   filtroFecha === '' ? 'white' : 'text.primary',
              border: '1px solid', borderColor: filtroFecha === '' ? ACCENT : 'divider',
            }}
          />
        </Box>

        {/* Una fila por semana */}
        {Object.entries(grupos).map(([semanaKey, dias]) => {
          const lunesFecha = new Date(semanaKey + 'T00:00:00');
          const semanaLabel = lunesFecha.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });
          return (
            <Box key={semanaKey}>
              <Typography sx={{ fontSize: 10, color: 'text.disabled', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6, mb: 0.5 }}>
                Semana del {semanaLabel}
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                {dias.map(d => {
                  const fecha = new Date(d.fecha + 'T00:00:00');
                  const labelStr = fecha.toLocaleDateString('es-CO', { weekday: 'short', day: '2-digit', month: 'short' });
                  const isSelected = filtroFecha === d.fecha;
                  const isToday = d.fecha === new Date().toLocaleDateString('en-CA');
                  return (
                    <Badge
                      key={d.fecha}
                      badgeContent={d.total_cuotas}
                      color="error"
                      sx={{ '& .MuiBadge-badge': { right: 5, top: 5, fontSize: 9 } }}
                    >
                      <Chip
                        label={labelStr}
                        onClick={() => setFiltroFecha(d.fecha)}
                        sx={{
                          fontWeight: 700,
                          pr: 1,
                          border: '1.5px solid',
                          borderColor: isSelected ? ACCENT : isToday ? GREEN : 'divider',
                          bgcolor:     isSelected ? ACCENT : isToday ? `${GREEN}12` : 'background.default',
                          color:       isSelected ? 'white' : isToday ? GREEN : 'text.primary',
                        }}
                      />
                    </Badge>
                  );
                })}
              </Box>
            </Box>
          );
        })}

        {resumenDias.length === 0 && (
          <Typography sx={{ fontSize: 12, color: 'text.disabled', py: 1 }}>
            No hay cobros programados próximamente.
          </Typography>
        )}
      </Box>
    );
  })()}

  {/* Buscador y Filtro de Zona */}
  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
    <TextField
      fullWidth
      size="small"
      placeholder="Buscar por cliente o dirección..."
      value={searchTerm}
      onChange={e => setSearchTerm(e.target.value)}
      InputProps={{
        startAdornment: <InputAdornment position="start"><Search sx={{ color: 'text.secondary', fontSize: 18 }} /></InputAdornment>,
        sx: { borderRadius: 3, bgcolor: 'background.default' },
      }}
    />
    <TextField
      select
      sx={{ minWidth: { sm: 200 } }}
      label="Filtrar por Zona"
      value={filtroZona}
      onChange={e => setFiltroZona(e.target.value)}
      size="small"
      InputProps={{
        sx: { borderRadius: 3, bgcolor: 'background.default' },
      }}
    >
      <MenuItem value="">Todas las zonas</MenuItem>
      {zonasDisponibles.map(z => (
        <MenuItem key={z} value={z}>{z}</MenuItem>
      ))}
    </TextField>
  </Stack>
</Paper>

      {/* Sort controls */}
      <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <Typography sx={{ fontSize: 11, color: 'text.secondary', fontWeight: 700, mr: 0.5 }}>Ordenar:</Typography>
        {[
          { key: 'mora',  label: 'Mayor mora'  },
          { key: 'monto', label: 'Mayor monto' },
          { key: 'fecha', label: 'Por fecha'   },
        ].map(s => (
          <Chip
            key={s.key}
            label={s.label}
            size="small"
            onClick={() => setSortCuotas(s.key)}
            sx={{
              fontWeight: 700, fontSize: 11,
              bgcolor: sortCuotas === s.key ? ACCENT : 'transparent',
              color:   sortCuotas === s.key ? 'white' : 'text.secondary',
              border: '1px solid',
              borderColor: sortCuotas === s.key ? ACCENT : 'divider',
              cursor: 'pointer',
            }}
          />
        ))}
      </Box>

      {/* ── Lista de cuotas ── */}
      <Stack spacing={3}>
        {cuotasFiltradas.length === 0 ? (
          <Paper sx={{ p: 8, textAlign: 'center', borderRadius: 4,
            bgcolor: 'action.hover', border: '2px dashed', borderColor: 'divider' }}>
            <Typography color="text.secondary">
              No se encontraron cobros pendientes para esta selección.
            </Typography>
          </Paper>
        ) : (
          cuotasFiltradas.map(cuota => {
            const cobradorAsignado = usuarios.find(u => u.id === cuota.usuario_asignado_id) || null;
            const idReal           = cuota.cuota_id;
            const estaEditando     = editandoAsignacion[idReal];
            const { mora, dias, total: totalConMora } = calcularMoraCliente(cuota, 2);

            return (
              <Paper key={idReal} sx={{
                p: { xs: 2, sm: 3 }, borderRadius: 4,
                border: '1.5px solid',
                borderColor: dias > 0 ? `${RED}50` : 'divider',
                borderLeft: dias > 0 ? `5px solid ${RED}` : undefined,
                bgcolor: dias > 0 ? `${RED}03` : 'background.paper',
                boxShadow: dias > 0 ? `0 4px 15px ${RED}12` : '0 4px 15px rgba(0,0,0,0.03)',
              }}>
                <Stack spacing={2}>

                  {/* Encabezado */}
                  <Box sx={{ display: 'flex', justifyContent: 'space-between',
                    alignItems: 'flex-start', flexWrap: 'wrap', gap: 2 }}>
                    <Box sx={{ flex: 1, minWidth: '200px' }}>
                      <Typography sx={{ fontWeight: 800, fontSize: 18, lineHeight: 1.2 }}>
                        {cuota.cliente_nombre}
                      </Typography>
                      <Typography sx={{ fontSize: 13, color: 'text.secondary', mt: 0.5 }}>
                        {cuota.cliente_direccion || 'Sin dirección'}
                      </Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
                        <Chip label={`Cuota #${cuota.numero_cuota}`} size="small"
                          sx={{ fontWeight: 700, bgcolor: 'action.selected' }} />
                        <Chip label={getSafeDateString(cuota.fecha_vencimiento)} size="small" variant="outlined" />
                        {!esAdmin && cuota.usuario_asignado_id && (
                          <Chip icon={<AssignmentInd />} label="Mi Ruta"
                            size="small" color="success" variant="outlined" />
                        )}
                      </Box>
                    </Box>
                    <Box sx={{ textAlign: { xs: 'left', sm: 'right' }, minWidth: '120px' }}>
                      <Typography sx={{ fontSize: 10, fontWeight: 800, color: 'text.secondary' }}>
                        RECAUDAR
                      </Typography>
                      <Typography sx={{ fontWeight: 900, fontSize: 24, color: dias > 0 ? RED : GREEN }}>
                        {formatCurrency(dias > 0 ? totalConMora : (cuota.saldo_pendiente ?? cuota.monto_cuota))}
                      </Typography>
                      {dias > 0 && (
                        <Box sx={{ mt: 0.3 }}>
                          <Typography sx={{ fontSize: 9, color: 'text.secondary', textDecoration: 'line-through' }}>
                            Base: {formatCurrency(cuota.saldo_pendiente)}
                          </Typography>
                          <Chip
                            icon={<ErrorOutline sx={{ fontSize: '10px !important' }} />}
                            label={`+${formatCurrency(mora)} mora · ${dias}d`}
                            size="small"
                            sx={{ height: 16, fontSize: 8, fontWeight: 700, bgcolor: `${RED}15`, color: RED, mt: 0.3,
                              '& .MuiChip-icon': { color: RED } }}
                          />
                        </Box>
                      )}
                    </Box>
                  </Box>

                  {/* Asignación cobrador (solo Admin) */}
                  {esAdmin && (
                    <Box sx={{ p: 2, bgcolor: 'background.default', borderRadius: 3 }}>
                      {cobradorAsignado && !estaEditando ? (
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                            <Avatar sx={{ width: 32, height: 32, bgcolor: `${GREEN}20`, color: GREEN }}>
                              <AssignmentInd sx={{ fontSize: 18 }} />
                            </Avatar>
                            <Box>
                              <Typography sx={{ fontSize: 10, color: 'text.secondary', fontWeight: 700 }}>
                                COBRADOR ASIGNADO
                              </Typography>
                              <Typography sx={{ fontSize: 14, fontWeight: 800 }}>
                                {cobradorAsignado.username.toUpperCase()}
                              </Typography>
                            </Box>
                          </Box>
                          <Button size="small" variant="outlined" startIcon={<Edit />}
                            onClick={() => setEditandoAsignacion(prev => ({ ...prev, [idReal]: true }))}
                            sx={{ borderRadius: 2, fontSize: 11, fontWeight: 700, textTransform: 'none' }}>
                            Cambiar
                          </Button>
                        </Box>
                      ) : (
                        <Box>
                          <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
                            <Typography sx={{ fontSize: 12, color: 'text.secondary', fontWeight: 600 }}>
                              {cobradorAsignado ? 'Reasignar Cobrador' : 'Asignar Cobrador'}
                            </Typography>
                            <FormControlLabel
                              control={
                                <Switch size="small"
                                  checked={!!asignacionGlobal[idReal]}
                                  onChange={() => handleToggleGlobal(idReal)}
                                  color="primary" />
                              }
                              label={<Typography sx={{ fontSize: 11, color: 'text.secondary' }}>Todo el préstamo</Typography>}
                            />
                          </Stack>
                          <Autocomplete
                            fullWidth options={usuarios}
                            getOptionLabel={o => o.username ? o.username.toUpperCase() : ''}
                            value={cobradorAsignado}
                            onChange={(e, newValue) => handleAsignar(cuota, newValue)}
                            renderInput={params => (
                              <TextField {...params} size="small" placeholder="Busca por nombre..."
                                autoFocus={estaEditando}
                                InputProps={{
                                  ...params.InputProps,
                                  startAdornment: (
                                    <>
                                      <InputAdornment position="start">
                                        <PersonSearch sx={{ color: ACCENT, ml: 1 }} />
                                      </InputAdornment>
                                      {params.InputProps.startAdornment}
                                    </>
                                  ),
                                  sx: { borderRadius: 2, bgcolor: 'background.paper' },
                                }} />
                            )} />
                          {cobradorAsignado && (
                            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
                              <Button size="small" sx={{ fontSize: 11, color: 'text.secondary' }}
                                onClick={() => setEditandoAsignacion(prev => ({ ...prev, [idReal]: false }))}>
                                Cancelar
                              </Button>
                            </Box>
                          )}
                        </Box>
                      )}
                    </Box>
                  )}

                  <Divider sx={{ borderStyle: 'dashed' }} />

                  {/* Botones de acción */}
                  <Box sx={{ display: 'flex', justifyContent: 'space-between',
                    alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
                    <Box sx={{ display: 'flex', gap: 1.5 }}>
                      <Tooltip title="Ubicación en Maps">
                        <IconButton onClick={() => handleOpenMaps(cuota.cliente_direccion)}
                          sx={{ bgcolor: BLUE, color: 'white', '&:hover': { bgcolor: '#2563EB' },
                            width: 44, height: 44, boxShadow: '0 4px 10px rgba(59,130,246,0.3)' }}>
                          <LocationOn fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Chat WhatsApp">
                        <IconButton
                          onClick={() => window.open(`https://wa.me/57${cuota.cliente_telefono}`, '_blank')}
                          sx={{ bgcolor: '#22C55E', color: 'white', '&:hover': { bgcolor: '#16A34A' },
                            width: 44, height: 44, boxShadow: '0 4px 10px rgba(34,197,94,0.3)' }}>
                          <WhatsApp fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Reprogramar Visita">
                        <IconButton
                          onClick={() => setReprogramarModal({
                            open: true, cuota,
                            nuevaFecha: cuota.fecha_vencimiento
                              ? cuota.fecha_vencimiento.split('T')[0] : ''
                          })}
                          sx={{ bgcolor: YELLOW, color: 'white', '&:hover': { bgcolor: '#D97706' },
                            width: 44, height: 44, boxShadow: '0 4px 10px rgba(245,158,11,0.3)' }}>
                          <MoreTime fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Registrar Novedad (Sin pago)">
                        <IconButton
                          onClick={() => setEvidenciaModal({ ...evidenciaModal, open: true, cuota })}
                          sx={{ bgcolor: '#64748b', color: 'white', '&:hover': { bgcolor: '#475569' },
                            width: 44, height: 44, boxShadow: '0 4px 10px rgba(100,116,139,0.3)' }}>
                          <NotInterested fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>

                    <Button variant="contained" startIcon={<CheckCircle />}
                      onClick={() => setPagoModal({
                        open: true, cuota,
                        monto: cuota.saldo_pendiente ?? cuota.monto_cuota
                      })}
                      sx={{ bgcolor: GREEN, px: 3, py: 1, borderRadius: 3, fontWeight: 800,
                        boxShadow: '0 4px 12px rgba(16,185,129,0.3)',
                        '&:hover': { bgcolor: '#059669' } }}>
                      RECAUDAR
                    </Button>
                  </Box>
                </Stack>
              </Paper>
            );
          })
        )}
      </Stack>

      {/* ════════════════════════════════════════════════════
          MODAL: Registrar pago
          ════════════════════════════════════════════════════ */}
            
        <Dialog
          open={pagoModal.open}
          onClose={() => setPagoModal({ open: false, cuota: null, monto: '', metodoPago: 'Efectivo' })}
          maxWidth="xs" fullWidth
          PaperProps={{ sx: { borderRadius: 3, overflow: 'hidden' } }}
        >
          <Box sx={{ height: 4, bgcolor: GREEN }} />
          <DialogTitle sx={{ fontWeight: 800 }}>Registrar Recaudo</DialogTitle>
          <DialogContent>
            {/* Resumen del cliente */}
            <Box sx={{ p: 1.5, mb: 2.5, borderRadius: 2, bgcolor: `${GREEN}08`, border: `1px solid ${GREEN}25` }}>
              <Typography sx={{ fontWeight: 700, fontSize: 14 }}>{pagoModal.cuota?.cliente_nombre}</Typography>
              <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
                Préstamo #{pagoModal.cuota?.prestamo_id} · Cuota #{pagoModal.cuota?.numero_cuota}
              </Typography>
              <Typography sx={{ fontSize: 13, fontWeight: 800, color: GREEN, mt: 0.5 }}>
                Saldo pendiente: {formatCurrency(pagoModal.cuota?.saldo_pendiente || 0)}
              </Typography>
            </Box>
            {(() => {
              if (!pagoModal.cuota) return null;
              const { mora: moraCalc, dias: diasCalc, total: totalCalc } = calcularMoraCliente(pagoModal.cuota, 2);
              if (diasCalc <= 0 || moraCalc <= 0) return null;
              return (
                <Box sx={{ mt: 1, p: 1, borderRadius: 1.5, bgcolor: `${RED}08`, border: `1px solid ${RED}20` }}>
                  <Typography sx={{ fontSize: 11, fontWeight: 700, color: RED }}>
                    ⚠️ Vencida hace {diasCalc} días · Mora: {formatCurrency(moraCalc)}
                  </Typography>
                  <Typography sx={{ fontSize: 12, fontWeight: 900, color: RED, mt: 0.3 }}>
                    Total sugerido a cobrar: {formatCurrency(totalCalc)}
                  </Typography>
                </Box>
              );
            })()}

            {/* Monto */}
            <CurrencyField
              fullWidth autoFocus
              label="Monto recibido *"
              value={pagoModal.monto}
              onChange={val => setPagoModal({ ...pagoModal, monto: val })}
              sx={{ mb: 2.5 }}
            />

            {/* Método de pago */}
            <Typography sx={{ fontSize: 11, fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.6, mb: 1 }}>
              Método de pago
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {metodosPago.map(opt => {
                const selected = pagoModal.metodoPago === opt.value;
                return (
                  <Box
                    key={opt.value}
                    onClick={() => setPagoModal({ ...pagoModal, metodoPago: opt.value })}
                    sx={{
                      px: 1.5, py: 0.8, borderRadius: 2, cursor: 'pointer',
                      border: '1.5px solid',
                      borderColor: selected ? GREEN : 'divider',
                      bgcolor: selected ? `${GREEN}12` : 'background.paper',
                      color: selected ? GREEN : 'text.secondary',
                      fontSize: 12, fontWeight: selected ? 700 : 500,
                      transition: 'all 0.15s',
                      '&:hover': { borderColor: GREEN },
                      userSelect: 'none',
                    }}
                  >
                    {opt.label}
                  </Box>
                );
              })}
            </Box>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 3, gap: 1 }}>
            <Button
              onClick={() => setPagoModal({ open: false, cuota: null, monto: '', metodoPago: 'Efectivo' })}
              color="inherit"
            >
              Cancelar
            </Button>
            <Button
              onClick={confirmarPago}
              variant="contained"
              sx={{ bgcolor: GREEN, fontWeight: 800 }}
            >
              Confirmar Recaudo
            </Button>
          </DialogActions>
        </Dialog>

      {/* ════════════════════════════════════════════════════
          MODAL: Recibo post-pago
          — WhatsApp + Imprimir + Descargar PDF
          ════════════════════════════════════════════════════ */}
      <Dialog open={reciboModal.open}
        onClose={() => setReciboModal({ ...reciboModal, open: false })}
        maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>

        <DialogTitle sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}>
          <Receipt sx={{ color: GREEN }} /> Pago Registrado
        </DialogTitle>

        <DialogContent>
          {/* Resumen visual */}
          <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2, mb: 2, bgcolor: `${GREEN}08` }}>
            <Stack spacing={1}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="caption" color="text.secondary">Cliente</Typography>
                <Typography variant="caption" fontWeight={700}>
                  {reciboModal.cuota?.cliente_nombre}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="caption" color="text.secondary">Préstamo / Cuota</Typography>
                <Typography variant="caption" fontWeight={700}>
                  #{reciboModal.cuota?.prestamo_id} / #{reciboModal.cuota?.numero_cuota}
                </Typography>
              </Box>
              <Divider sx={{ borderStyle: 'dashed', my: 0.5 }} />
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2" color="text.secondary">Recibido</Typography>
                <Typography variant="body2" fontWeight={900} color={GREEN}>
                  {formatCurrency(reciboModal.monto)}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2" color="text.secondary">Saldo restante</Typography>
                <Typography variant="body2" fontWeight={700}
                  color={reciboModal.saldoRestante > 0 ? ACCENT : GREEN}>
                  {reciboModal.saldoRestante > 0
                    ? formatCurrency(reciboModal.saldoRestante)
                    : '✅ Saldada'}
                </Typography>
              </Box>
            </Stack>
          </Paper>

          <Typography variant="caption" color="text.secondary">
            ¿Cómo deseas compartir el recibo con el cliente?
          </Typography>
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 3, gap: 1, flexWrap: 'wrap' }}>
          {/* Cerrar */}
          <Button onClick={() => setReciboModal({ ...reciboModal, open: false })}
            color="inherit" sx={{ fontWeight: 700 }}>
            Cerrar
          </Button>

          {/* Descargar PDF ← NUEVO */}
          <Button
            startIcon={pdfLoading
              ? <CircularProgress size={16} color="inherit" />
              : <PictureAsPdf />}
            variant="outlined"
            disabled={pdfLoading}
            onClick={handleDescargarPDF}
            sx={{
              fontWeight: 700, borderRadius: 2,
              color: '#DC2626', borderColor: '#DC2626',
              '&:hover': { bgcolor: '#FEF2F2', borderColor: '#DC2626' },
            }}>
            {pdfLoading ? 'Generando...' : 'Descargar PDF'}
          </Button>

          {/* Imprimir */}
          <Button
            startIcon={<Print />}
            variant="outlined"
            onClick={() => imprimirRecibo(reciboModal.cuota, reciboModal.monto, reciboModal.saldoRestante)}
            sx={{ fontWeight: 700, borderRadius: 2 }}>
            Imprimir
          </Button>

          {/* WhatsApp */}
          <Button
            startIcon={<WhatsApp />}
            variant="contained"
            onClick={() => {
              const texto = generarTextoRecibo(
                reciboModal.cuota, reciboModal.monto, reciboModal.saldoRestante
              );
              window.open(
                `https://wa.me/57${reciboModal.cuota?.cliente_telefono}?text=${encodeURIComponent(texto)}`,
                '_blank'
              );
            }}
            sx={{ bgcolor: '#22C55E', fontWeight: 800, borderRadius: 2,
              '&:hover': { bgcolor: '#16A34A' } }}>
            WhatsApp
          </Button>
        </DialogActions>
      </Dialog>

      {/* ════════════════════════════════════════════════════
          MODAL: Reprogramar cobro
          ════════════════════════════════════════════════════ */}
      <Dialog open={reprogramarModal.open}
        onClose={() => setReprogramarModal({ ...reprogramarModal, open: false })}
        maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 800 }}>Reprogramar Cobro</DialogTitle>
        <DialogContent>
          <Typography variant="body2" mb={2}>
            Selecciona la nueva fecha de compromiso para este cliente.
          </Typography>
          <TextField fullWidth type="date" InputLabelProps={{ shrink: true }}
            value={reprogramarModal.nuevaFecha}
            onChange={e => setReprogramarModal({ ...reprogramarModal, nuevaFecha: e.target.value })} />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setReprogramarModal({ ...reprogramarModal, open: false })} color="inherit">
            Cancelar
          </Button>
          <Button onClick={confirmarReprogramacion} variant="contained"
            sx={{ bgcolor: YELLOW, fontWeight: 800 }}>
            Guardar Fecha
          </Button>
        </DialogActions>
      </Dialog>

      {/* ════════════════════════════════════════════════════
          MODAL: Liquidación diaria
          ════════════════════════════════════════════════════ */}
      <Dialog open={liquidacionModal} onClose={() => setLiquidacionModal(false)}
        maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 4 } }}>
        <DialogTitle sx={{ fontWeight: 900, textAlign: 'center', bgcolor: 'action.hover', pb: 3 }}>
          Liquidación Diaria
          <Typography variant="body2" color="text.secondary">
            Resumen de efectivo a entregar hoy
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          {datosLiquidacion?.cobradores?.length === 0 ? (
            <Typography textAlign="center" color="text.secondary" py={4}>
              No hay recaudos registrados hoy.
            </Typography>
          ) : (
            <Stack spacing={2} mt={2}>
              {datosLiquidacion?.cobradores.map(cob => (
                <Paper key={cob.cobrador_id} variant="outlined"
                  sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box>
                    <Typography fontWeight={800} fontSize={16}>{cob.cobrador_nombre}</Typography>
                    <Typography variant="caption" color="text.secondary"
                      sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Receipt fontSize="small" /> {cob.cuotas_cobradas} recibos hoy
                    </Typography>
                    {cob.metodos && Object.entries(cob.metodos).filter(([, v]) => v > 0).length > 0 && (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                        {Object.entries(cob.metodos).filter(([, v]) => v > 0).map(([met, val]) => (
                          <Chip key={met} label={`${met}: ${formatCurrency(val)}`} size="small"
                            sx={{ height: 16, fontSize: 9, bgcolor: 'action.selected' }} />
                        ))}
                      </Box>
                    )}
                  </Box>
                  <Typography fontWeight={900} fontSize={20} color={GREEN}>
                    {formatCurrency(cob.total_recaudado)}
                  </Typography>
                </Paper>
              ))}
              <Divider sx={{ my: 2, borderStyle: 'dashed' }} />
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 1 }}>
                <Typography fontWeight={800} fontSize={18}>EFECTIVO TOTAL:</Typography>
                <Typography fontWeight={900} fontSize={26} color={ACCENT}>
                  {formatCurrency(datosLiquidacion?.total_global || 0)}
                </Typography>
              </Box>
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setLiquidacionModal(false)} color="inherit" sx={{ fontWeight: 700 }}>
            Cerrar
          </Button>
          <Button onClick={confirmarLiquidacion} variant="contained"
            disabled={!datosLiquidacion?.cobradores?.length}
            sx={{ bgcolor: ACCENT, fontWeight: 800 }}>
            Recibir Dinero
          </Button>
        </DialogActions>
      </Dialog>

      {/* ════════════════════════════════════════════════════
          MODAL: Mapa de Ruta
          ════════════════════════════════════════════════════ */}
      <Dialog open={mapaModal} onClose={() => setMapaModal(false)}
        maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 4 } }}>
        <DialogTitle sx={{ fontWeight: 900, display: 'flex', alignItems: 'center', gap: 1 }}>
          <MapIcon sx={{ color: BLUE }} /> Orden de Visita Sugerido
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" mb={3}>
            Esta es la secuencia lógica de cobro según tu ubicación actual y las zonas asignadas.
          </Typography>
          <Stack spacing={2}>
            {cuotasFiltradas.map((c, i) => (
              <Paper key={i} variant="outlined" sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 2, borderRadius: 2 }}>
                <Avatar sx={{ bgcolor: BLUE, width: 28, height: 28, fontSize: 14, fontWeight: 800 }}>{i + 1}</Avatar>
                <Box sx={{ flex: 1 }}>
                  <Typography fontWeight={700} fontSize={14}>{c.cliente_nombre}</Typography>
                  <Typography variant="caption" color="text.secondary">{c.cliente_direccion}</Typography>
                </Box>
                <IconButton size="small" onClick={() => handleOpenMaps(c.cliente_direccion)} sx={{ color: BLUE }}>
                  <LocationOn />
                </IconButton>
              </Paper>
            ))}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setMapaModal(false)} sx={{ fontWeight: 700 }}>Cerrar</Button>
        </DialogActions>
      </Dialog>

      {/* ════════════════════════════════════════════════════
          MODAL: Registrar Evidencia (Novedad)
          ════════════════════════════════════════════════════ */}
      <Dialog open={evidenciaModal.open} onClose={() => !evidenciaModal.uploading && setEvidenciaModal({ ...evidenciaModal, open: false })}
        maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 4 } }}>
        <DialogTitle sx={{ fontWeight: 900 }}>Registrar Novedad</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" mb={2}>
            ¿Por qué no se pudo realizar el recaudo con <strong>{evidenciaModal.cuota?.cliente_nombre}</strong>?
          </Typography>
          
          <TextField select fullWidth label="Motivo de la novedad" sx={{ mb: 2 }}
            value={evidenciaModal.tipo}
            onChange={e => setEvidenciaModal({ ...evidenciaModal, tipo: e.target.value })}>
            {['No encontrado', 'Local cerrado', 'Promesa de pago', 'Sin dinero', 'Dirección errada', 'Otro'].map(t => (
              <MenuItem key={t} value={t}>{t}</MenuItem>
            ))}
          </TextField>

          <TextField fullWidth multiline rows={3} label="Comentarios adicionales" placeholder="Escribe detalles de la visita..."
            value={evidenciaModal.comentario}
            onChange={e => setEvidenciaModal({ ...evidenciaModal, comentario: e.target.value })}
            sx={{ mb: 2 }} />

          <Button component="label" variant="outlined" fullWidth startIcon={<PhotoCamera />}
            sx={{ py: 1.5, borderRadius: 2, borderStyle: 'dashed' }}>
            {evidenciaModal.foto ? `Foto: ${evidenciaModal.foto.name.substring(0, 20)}...` : 'Subir Foto de Evidencia'}
            <input type="file" hidden accept="image/*" capture="environment"
              onChange={e => setEvidenciaModal({ ...evidenciaModal, foto: e.target.files[0] })} />
          </Button>
          {evidenciaModal.foto && (
            <Typography variant="caption" color="success.main" sx={{ mt: 0.5, display: 'block', textAlign: 'center' }}>
              ✓ Imagen lista para subir
            </Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 3, gap: 1 }}>
          <Button disabled={evidenciaModal.uploading} onClick={() => setEvidenciaModal({ ...evidenciaModal, open: false })}>Cancelar</Button>
          <Button variant="contained" disabled={evidenciaModal.uploading} onClick={guardarEvidencia}
            sx={{ bgcolor: '#64748b', fontWeight: 800 }}>
            {evidenciaModal.uploading ? <CircularProgress size={20} color="inherit" /> : 'Guardar Novedad'}
          </Button>
        </DialogActions>
      </Dialog>

    </Box>
  );
};

export default RutaCobro;
