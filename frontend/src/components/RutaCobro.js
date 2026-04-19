import React, { useState, useEffect, useMemo } from 'react';
import { 
  Box, Typography, Paper, CircularProgress, IconButton, Tooltip, Button,
  Divider, Chip, Grid, TextField, InputAdornment, Autocomplete, FormControlLabel, Switch, Badge, Stack, Avatar
} from '@mui/material';
import { 
  WhatsApp, CheckCircle, Search, DirectionsRun, LocationOn, PersonSearch, MoreTime, FilterList,
  AccountBalanceWallet, AssignmentInd, TrendingUp, PointOfSale, Receipt, Edit, Print
} from '@mui/icons-material';
import apiClient, { registrarPagoRuta, reprogramarCuotaRuta } from '../api';
import { formatCurrency } from '../utils/formatters';
import { toast } from 'react-toastify';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';

const ACCENT = '#FF6020';
const GREEN  = '#10B981';
const BLUE   = '#3B82F6';
const YELLOW = '#F59E0B';

// ─── Formatea fecha legible ───────────────────────────────────────────────────
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

// ─── Genera el texto completo del recibo para WhatsApp ───────────────────────
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

// ─── Imprime recibo en ventana nueva ─────────────────────────────────────────
const imprimirRecibo = (cuota, montoPagado, saldoRestante) => {
  const ahora    = new Date();
  const fecha    = ahora.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const hora     = ahora.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
  const saldo    = typeof saldoRestante === 'number' ? saldoRestante : (cuota.saldo_pendiente - montoPagado);
  const saldoFmt = saldo > 0 ? formatCurrency(Math.max(0, saldo)) : 'SALDADA ✓';

  const html = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8"/>
      <title>Recibo #${cuota.cuota_id}</title>
      <style>
        * { margin:0; padding:0; box-sizing:border-box; }
        body { font-family: 'Courier New', monospace; width: 280px; padding: 16px; font-size: 12px; }
        .logo  { text-align:center; font-size:18px; font-weight:700; letter-spacing:1px; margin-bottom:4px; }
        .sub   { text-align:center; font-size:10px; color:#555; margin-bottom:12px; }
        .sep   { border-top:1px dashed #000; margin:8px 0; }
        .row   { display:flex; justify-content:space-between; margin:3px 0; }
        .label { color:#555; }
        .val   { font-weight:700; text-align:right; }
        .total { font-size:15px; margin-top:6px; }
        .footer{ text-align:center; margin-top:12px; font-size:10px; color:#888; }
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
    </html>
  `;

  const win = window.open('', '_blank', 'width=320,height=480');
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); win.close(); }, 400);
};

// ─── Componente principal ─────────────────────────────────────────────────────
const RutaCobro = () => {
  const [cuotas,        setCuotas]        = useState([]);
  const [usuarios,      setUsuarios]      = useState([]);
  const [resumenDias,   setResumenDias]   = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [searchTerm,    setSearchTerm]    = useState('');
  const [filtroFecha,   setFiltroFecha]   = useState(new Date().toISOString().split('T')[0]);
  const [currentUser,   setCurrentUser]   = useState(null);

  const [asignacionGlobal,    setAsignacionGlobal]    = useState({});
  const [editandoAsignacion,  setEditandoAsignacion]  = useState({});

  const [pagoModal,        setPagoModal]        = useState({ open: false, cuota: null, monto: '' });
  const [reprogramarModal, setReprogramarModal] = useState({ open: false, cuota: null, nuevaFecha: '' });
  const [reciboModal,      setReciboModal]      = useState({ open: false, cuota: null, monto: 0, saldoRestante: 0 });

  const [liquidacionModal, setLiquidacionModal] = useState(false);
  const [datosLiquidacion, setDatosLiquidacion] = useState(null);

  useEffect(() => { fetchInicial(); }, []);

  const fetchInicial = async () => {
    setLoading(true);
    try {
      const [cRes, meRes, calRes] = await Promise.all([
        apiClient.get('/prestamos/cuotas-pendientes'),
        apiClient.get('/users/me'),
        apiClient.get('/reportes/calendario-cobros'),
      ]);
      setCuotas(cRes.data);
      setCurrentUser(meRes.data);
      setResumenDias(calRes.data);

      if (meRes.data?.role?.name === 'Admin') {
        const uRes = await apiClient.get('/admin/usuarios');
        setUsuarios(uRes.data);
      }
    } catch {
      toast.error('Error al sincronizar datos de ruta');
    } finally {
      setLoading(false);
    }
  };

  const esAdmin = currentUser?.role?.name === 'Admin';

  const cuotasFiltradas = useMemo(() => {
    return cuotas.filter(c => {
      const asignadaAMi = !esAdmin ? c.usuario_asignado_id === currentUser?.id : true;
      const matchSearch =
        (c.cliente_nombre  || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.cliente_direccion || '').toLowerCase().includes(searchTerm.toLowerCase());
      const fechaCuota = c.fecha_vencimiento ? c.fecha_vencimiento.split('T')[0] : '';
      const matchFecha = filtroFecha ? fechaCuota === filtroFecha : true;
      return asignadaAMi && matchSearch && matchFecha;
    });
  }, [cuotas, searchTerm, filtroFecha, esAdmin, currentUser]);

  const kpis = useMemo(() => ({
    total:    cuotasFiltradas.reduce((s, c) => s + (c.saldo_pendiente || 0), 0),
    cantidad: cuotasFiltradas.length,
  }), [cuotasFiltradas]);

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

  // ── Confirmar pago + mostrar modal de recibo ──────────────────────────────
  const confirmarPago = async () => {
    const { cuota, monto } = pagoModal;
    const montoPagado = parseFloat(monto);
    try {
      const res = await apiClient.post(
        `/prestamos/cuotas/${cuota.cuota_id}/pagar`,
        { monto_pagado: montoPagado }
      );
      toast.success(res.data?.msg || 'Pago registrado');

      const saldoRestante = Math.max(0, (cuota.saldo_pendiente || 0) - montoPagado);
      setPagoModal({ open: false, cuota: null, monto: '' });

      // Abrimos el modal de recibo con los datos del pago
      setReciboModal({ open: true, cuota, monto: montoPagado, saldoRestante });
      fetchInicial();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error en el pago');
    }
  };

  const confirmarReprogramacion = async () => {
    const { cuota, nuevaFecha } = reprogramarModal;
    try {
      await apiClient.post(
        `/prestamos/cuotas/${cuota.cuota_id}/reprogramar`,
        { nueva_fecha: new Date(nuevaFecha).toISOString() }
      );
      toast.success('Compromiso actualizado');
      setReprogramarModal({ open: false, cuota: null, nuevaFecha: '' });
      fetchInicial();
    } catch {
      toast.error('Error al reprogramar');
    }
  };

  if (loading) return <Box sx={{ p: 5, textAlign: 'center' }}><CircularProgress /></Box>;

  return (
    <Box sx={{ maxWidth: 1100, margin: '0 auto', p: { xs: 1, sm: 3 }, boxSizing: 'border-box' }}>

      {/* ── KPIs ── */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[
          { icon: <AccountBalanceWallet />, color: BLUE,   label: 'TOTAL RUTA',    value: formatCurrency(kpis.total) },
          { icon: <AssignmentInd />,        color: ACCENT, label: 'CLIENTES HOY',  value: `${kpis.cantidad} Pendientes` },
          { icon: <TrendingUp />,           color: GREEN,  label: 'ESTADO',         value: esAdmin ? 'Supervisión' : 'Operativo' },
        ].map(({ icon, color, label, value }) => (
          <Grid item xs={12} sm={4} key={label}>
            <Paper sx={{ p: 2, borderRadius: 3, display: 'flex', alignItems: 'center', gap: 2, border: '1px solid', borderColor: 'divider' }}>
              <Avatar sx={{ bgcolor: `${color}15`, color }}>{icon}</Avatar>
              <Box>
                <Typography variant="caption" color="text.secondary" fontWeight={700}>{label}</Typography>
                <Typography variant="h6" fontWeight={800}>{value}</Typography>
              </Box>
            </Paper>
          </Grid>
        ))}
      </Grid>

      {/* ── Header ── */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800 }}>
            {esAdmin ? 'Gestión de Rutas' : 'Mi Ruta de Cobro'}
          </Typography>
          <Typography color="text.secondary" sx={{ fontSize: 13 }}>
            {esAdmin ? 'Asigna personal y supervisa el recaudo' : 'Cobros asignados para ti'}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {esAdmin && (
            <Button variant="contained" startIcon={<PointOfSale />} onClick={abrirLiquidacion}
              sx={{ bgcolor: ACCENT, fontWeight: 800, borderRadius: 3, height: 45 }}>
              Cierre
            </Button>
          )}
          <Box sx={{ p: 1.2, borderRadius: 3, bgcolor: `${ACCENT}15`, color: ACCENT, display: { xs: 'none', sm: 'flex' } }}>
            <DirectionsRun fontSize="large" />
          </Box>
        </Box>
      </Box>

      {/* ── Filtros / Calendario ── */}
      <Paper sx={{ p: 2.5, mb: 3, borderRadius: 4, boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
          <FilterList sx={{ color: 'text.secondary', fontSize: 20 }} />
          <Typography sx={{ fontSize: 13, fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase' }}>
            Calendario de Cobros
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
          <Chip label="Ver Todo" onClick={() => setFiltroFecha('')}
            sx={{ fontWeight: 700, bgcolor: filtroFecha === '' ? 'action.selected' : 'background.default',
              border: '1px solid', borderColor: filtroFecha === '' ? 'divider' : 'transparent' }} />
          {resumenDias.map(d => {
            const labelStr = `${d.fecha.split('-')[2]} de ${new Date(d.fecha + 'T00:00:00').toLocaleDateString('es-CO', { month: 'short' })}`;
            return (
              <Badge key={d.fecha} badgeContent={d.total_cuotas} color="error"
                sx={{ '& .MuiBadge-badge': { right: 5, top: 5 } }}>
                <Chip label={labelStr} onClick={() => setFiltroFecha(d.fecha)}
                  sx={{ fontWeight: 700, pr: 1,
                    bgcolor: filtroFecha === d.fecha ? ACCENT : 'background.default',
                    color:   filtroFecha === d.fecha ? 'white' : 'text.primary',
                    border: '1px solid', borderColor: filtroFecha === d.fecha ? ACCENT : 'divider' }} />
              </Badge>
            );
          })}
        </Box>

        <TextField fullWidth placeholder="Buscar por cliente o dirección..."
          value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
          InputProps={{
            disableUnderline: true,
            startAdornment: <InputAdornment position="start"><Search sx={{ color: 'text.secondary' }} /></InputAdornment>,
            sx: { borderRadius: 3, bgcolor: 'background.default', px: 2, py: 0.5, border: '1px solid', borderColor: 'divider' },
          }}
          variant="standard" />
      </Paper>

      {/* ── Lista de cuotas ── */}
      <Stack spacing={3}>
        {cuotasFiltradas.length === 0 ? (
          <Paper sx={{ p: 8, textAlign: 'center', borderRadius: 4, bgcolor: 'action.hover', border: '2px dashed', borderColor: 'divider' }}>
            <Typography color="text.secondary">No se encontraron cobros pendientes para esta selección.</Typography>
          </Paper>
        ) : (
          cuotasFiltradas.map(cuota => {
            const cobradorAsignado = usuarios.find(u => u.id === cuota.usuario_asignado_id) || null;
            const idReal           = cuota.cuota_id;
            const estaEditando     = editandoAsignacion[idReal];

            return (
              <Paper key={idReal} sx={{ p: { xs: 2, sm: 3 }, borderRadius: 4, border: '1px solid', borderColor: 'divider', boxShadow: '0 4px 15px rgba(0,0,0,0.03)' }}>
                <Stack spacing={2}>

                  {/* Encabezado cuota */}
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 2 }}>
                    <Box sx={{ flex: 1, minWidth: '200px' }}>
                      <Typography sx={{ fontWeight: 800, fontSize: 18, lineHeight: 1.2 }}>{cuota.cliente_nombre}</Typography>
                      <Typography sx={{ fontSize: 13, color: 'text.secondary', mt: 0.5 }}>{cuota.cliente_direccion || 'Sin dirección'}</Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
                        <Chip label={`Cuota #${cuota.numero_cuota}`} size="small" sx={{ fontWeight: 700, bgcolor: 'action.selected' }} />
                        <Chip label={getSafeDateString(cuota.fecha_vencimiento)} size="small" variant="outlined" />
                        {!esAdmin && cuota.usuario_asignado_id && <Chip icon={<AssignmentInd />} label="Mi Ruta" size="small" color="success" variant="outlined" />}
                      </Box>
                    </Box>
                    <Box sx={{ textAlign: { xs: 'left', sm: 'right' }, minWidth: '120px' }}>
                      <Typography sx={{ fontSize: 10, fontWeight: 800, color: 'text.secondary' }}>RECAUDAR</Typography>
                      <Typography sx={{ fontWeight: 900, fontSize: 24, color: GREEN }}>{formatCurrency(cuota.saldo_pendiente ?? cuota.monto_cuota)}</Typography>
                    </Box>
                  </Box>

                  {/* Asignación cobrador (Admin) */}
                  {esAdmin && (
                    <Box sx={{ p: 2, bgcolor: 'background.default', borderRadius: 3 }}>
                      {cobradorAsignado && !estaEditando ? (
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                            <Avatar sx={{ width: 32, height: 32, bgcolor: `${GREEN}20`, color: GREEN }}>
                              <AssignmentInd sx={{ fontSize: 18 }} />
                            </Avatar>
                            <Box>
                              <Typography sx={{ fontSize: 10, color: 'text.secondary', fontWeight: 700 }}>COBRADOR ASIGNADO</Typography>
                              <Typography sx={{ fontSize: 14, fontWeight: 800 }}>{cobradorAsignado.username.toUpperCase()}</Typography>
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
                              control={<Switch size="small" checked={!!asignacionGlobal[idReal]} onChange={() => handleToggleGlobal(idReal)} color="primary" />}
                              label={<Typography sx={{ fontSize: 11, color: 'text.secondary' }}>Todo el préstamo</Typography>}
                            />
                          </Stack>
                          <Autocomplete fullWidth options={usuarios}
                            getOptionLabel={o => o.username ? o.username.toUpperCase() : ''}
                            value={cobradorAsignado}
                            onChange={(e, newValue) => handleAsignar(cuota, newValue)}
                            renderInput={params => (
                              <TextField {...params} size="small" placeholder="Busca por nombre..." autoFocus={estaEditando}
                                InputProps={{
                                  ...params.InputProps,
                                  startAdornment: (
                                    <><InputAdornment position="start"><PersonSearch sx={{ color: ACCENT, ml: 1 }} /></InputAdornment>{params.InputProps.startAdornment}</>
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

                  {/* Acciones */}
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
                    <Box sx={{ display: 'flex', gap: 1.5 }}>
                      <Tooltip title="Ubicación en Maps">
                        <IconButton onClick={() => handleOpenMaps(cuota.cliente_direccion)}
                          sx={{ bgcolor: BLUE, color: 'white', '&:hover': { bgcolor: '#2563EB' }, width: 44, height: 44, boxShadow: '0 4px 10px rgba(59,130,246,0.3)' }}>
                          <LocationOn fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Chat WhatsApp">
                        <IconButton onClick={() => window.open(`https://wa.me/57${cuota.cliente_telefono}`, '_blank')}
                          sx={{ bgcolor: '#22C55E', color: 'white', '&:hover': { bgcolor: '#16A34A' }, width: 44, height: 44, boxShadow: '0 4px 10px rgba(34,197,94,0.3)' }}>
                          <WhatsApp fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Reprogramar Visita">
                        <IconButton
                          onClick={() => setReprogramarModal({ open: true, cuota, nuevaFecha: cuota.fecha_vencimiento ? cuota.fecha_vencimiento.split('T')[0] : '' })}
                          sx={{ bgcolor: YELLOW, color: 'white', '&:hover': { bgcolor: '#D97706' }, width: 44, height: 44, boxShadow: '0 4px 10px rgba(245,158,11,0.3)' }}>
                          <MoreTime fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>

                    <Button variant="contained" startIcon={<CheckCircle />}
                      onClick={() => setPagoModal({ open: true, cuota, monto: cuota.saldo_pendiente ?? cuota.monto_cuota })}
                      sx={{ bgcolor: GREEN, px: 3, py: 1, borderRadius: 3, fontWeight: 800, boxShadow: '0 4px 12px rgba(16,185,129,0.3)', '&:hover': { bgcolor: '#059669' } }}>
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
      <Dialog open={pagoModal.open} onClose={() => setPagoModal({ ...pagoModal, open: false })} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 800 }}>Registrar Recaudo</DialogTitle>
        <DialogContent>
          <Typography variant="body2" mb={2}>
            Monto recibido de <strong>{pagoModal.cuota?.cliente_nombre}</strong>:
          </Typography>
          <TextField fullWidth autoFocus type="number"
            value={pagoModal.monto}
            onChange={e => setPagoModal({ ...pagoModal, monto: e.target.value })}
            InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }} />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setPagoModal({ ...pagoModal, open: false })} color="inherit">Cancelar</Button>
          <Button onClick={confirmarPago} variant="contained" sx={{ bgcolor: GREEN, fontWeight: 800 }}>Confirmar</Button>
        </DialogActions>
      </Dialog>

      {/* ════════════════════════════════════════════════════
          MODAL: Recibo post-pago (WhatsApp + Imprimir)
          ════════════════════════════════════════════════════ */}
      <Dialog open={reciboModal.open} onClose={() => setReciboModal({ ...reciboModal, open: false })} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}>
          <Receipt sx={{ color: GREEN }} /> Pago Registrado
        </DialogTitle>
        <DialogContent>
          {/* Resumen visual del recibo */}
          <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2, mb: 2, bgcolor: `${GREEN}08` }}>
            <Stack spacing={1}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="caption" color="text.secondary">Cliente</Typography>
                <Typography variant="caption" fontWeight={700}>{reciboModal.cuota?.cliente_nombre}</Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="caption" color="text.secondary">Préstamo / Cuota</Typography>
                <Typography variant="caption" fontWeight={700}>#{reciboModal.cuota?.prestamo_id} / #{reciboModal.cuota?.numero_cuota}</Typography>
              </Box>
              <Divider sx={{ borderStyle: 'dashed', my: 0.5 }} />
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2" color="text.secondary">Recibido</Typography>
                <Typography variant="body2" fontWeight={900} color={GREEN}>{formatCurrency(reciboModal.monto)}</Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2" color="text.secondary">Saldo restante</Typography>
                <Typography variant="body2" fontWeight={700} color={reciboModal.saldoRestante > 0 ? ACCENT : GREEN}>
                  {reciboModal.saldoRestante > 0 ? formatCurrency(reciboModal.saldoRestante) : '✅ Saldada'}
                </Typography>
              </Box>
            </Stack>
          </Paper>

          <Typography variant="caption" color="text.secondary">
            ¿Deseas enviar el recibo al cliente?
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, gap: 1, flexWrap: 'wrap' }}>
          <Button onClick={() => setReciboModal({ ...reciboModal, open: false })} color="inherit" sx={{ fontWeight: 700 }}>
            Cerrar
          </Button>
          <Button
            startIcon={<Print />}
            variant="outlined"
            onClick={() => imprimirRecibo(reciboModal.cuota, reciboModal.monto, reciboModal.saldoRestante)}
            sx={{ fontWeight: 700, borderRadius: 2 }}
          >
            Imprimir
          </Button>
          <Button
            startIcon={<WhatsApp />}
            variant="contained"
            onClick={() => {
              const texto = generarTextoRecibo(reciboModal.cuota, reciboModal.monto, reciboModal.saldoRestante);
              window.open(`https://wa.me/57${reciboModal.cuota?.cliente_telefono}?text=${encodeURIComponent(texto)}`, '_blank');
            }}
            sx={{ bgcolor: '#22C55E', fontWeight: 800, borderRadius: 2, '&:hover': { bgcolor: '#16A34A' } }}
          >
            Enviar por WhatsApp
          </Button>
        </DialogActions>
      </Dialog>

      {/* ════════════════════════════════════════════════════
          MODAL: Reprogramar cobro
          ════════════════════════════════════════════════════ */}
      <Dialog open={reprogramarModal.open} onClose={() => setReprogramarModal({ ...reprogramarModal, open: false })} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 800 }}>Reprogramar Cobro</DialogTitle>
        <DialogContent>
          <Typography variant="body2" mb={2}>Selecciona la nueva fecha de compromiso para este cliente.</Typography>
          <TextField fullWidth type="date" InputLabelProps={{ shrink: true }}
            value={reprogramarModal.nuevaFecha}
            onChange={e => setReprogramarModal({ ...reprogramarModal, nuevaFecha: e.target.value })} />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setReprogramarModal({ ...reprogramarModal, open: false })} color="inherit">Cancelar</Button>
          <Button onClick={confirmarReprogramacion} variant="contained" sx={{ bgcolor: YELLOW, fontWeight: 800 }}>Guardar Fecha</Button>
        </DialogActions>
      </Dialog>

      {/* ════════════════════════════════════════════════════
          MODAL: Liquidación diaria
          ════════════════════════════════════════════════════ */}
      <Dialog open={liquidacionModal} onClose={() => setLiquidacionModal(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 4 } }}>
        <DialogTitle sx={{ fontWeight: 900, textAlign: 'center', bgcolor: 'action.hover', pb: 3 }}>
          Liquidación Diaria
          <Typography variant="body2" color="text.secondary">Resumen de efectivo a entregar hoy</Typography>
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          {datosLiquidacion?.cobradores?.length === 0 ? (
            <Typography textAlign="center" color="text.secondary" py={4}>No hay recaudos registrados hoy.</Typography>
          ) : (
            <Stack spacing={2} mt={2}>
              {datosLiquidacion?.cobradores.map(cob => (
                <Paper key={cob.cobrador_id} variant="outlined" sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box>
                    <Typography fontWeight={800} fontSize={16}>{cob.cobrador_nombre}</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Receipt fontSize="small" /> {cob.cuotas_cobradas} recibos hoy
                    </Typography>
                  </Box>
                  <Typography fontWeight={900} fontSize={20} color={GREEN}>{formatCurrency(cob.total_recaudado)}</Typography>
                </Paper>
              ))}
              <Divider sx={{ my: 2, borderStyle: 'dashed' }} />
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 1 }}>
                <Typography fontWeight={800} fontSize={18}>EFECTIVO TOTAL:</Typography>
                <Typography fontWeight={900} fontSize={26} color={ACCENT}>{formatCurrency(datosLiquidacion?.total_global || 0)}</Typography>
              </Box>
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setLiquidacionModal(false)} color="inherit" sx={{ fontWeight: 700 }}>Cerrar</Button>
          <Button onClick={confirmarLiquidacion} variant="contained" disabled={!datosLiquidacion?.cobradores?.length}
            sx={{ bgcolor: ACCENT, fontWeight: 800 }}>
            Recibir Dinero
          </Button>
        </DialogActions>
      </Dialog>

    </Box>
  );
};

export default RutaCobro;