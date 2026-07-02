import React, { useState, useEffect, useMemo } from 'react';
import apiClient from '../../api';
import { formatCurrency } from '../../utils/formatters';
import PaymentDialog from '../sales/PaymentDialog';
import { toast } from 'react-toastify';
import {
  Box, Typography, Table, TableBody, TableCell,
  TableHead, TableRow, Chip, IconButton, Paper, Grid, Divider,
  Collapse, Tooltip, useMediaQuery, LinearProgress, Dialog, DialogTitle, DialogContent, DialogActions, List, ListItem, ListItemText
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  Payment, AttachMoney, ExpandMore, ExpandLess,
  CheckCircle, Warning, TrendingDown, People, AccountBalanceWallet,
  Visibility, Close, ReceiptLong, History
} from '@mui/icons-material';

const ACCENT = '#3B82F6';
const RED    = '#EF4444';
const GREEN  = '#10B981';
const YELLOW = '#F59E0B';

// Helper para formato de fecha exacto
const formatearFechaExacta = (fechaString) => {
  return new Date(fechaString).toLocaleString('es-CO', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true
  });
};

const KpiCard = ({ label, value, icon, color }) => (
  <Paper sx={{ p: { xs: 1.5, sm: 2 }, borderRadius: 3, display: 'flex', alignItems: 'center', gap: 1, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
    <Box sx={{ width: 34, height: 34, borderRadius: 1.5, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: `${color}18`, color }}>
      {icon}
    </Box>
    <Box sx={{ minWidth: 0, flex: 1 }}>
      <Typography sx={{ fontSize: 10, color: 'text.secondary', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</Typography>
      <Typography sx={{ fontSize: 13, fontWeight: 700, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</Typography>
    </Box>
  </Paper>
);

const EstadoChip = ({ estado }) => {
  const map = { pagado: { label: 'Pagada', color: 'success' }, parcial: { label: 'Parcial', color: 'warning' }, pendiente: { label: 'Pendiente', color: 'error' } };
  const p = map[estado] || { label: estado, color: 'default' };
  return <Chip label={p.label} color={p.color} size="small" sx={{ fontWeight: 600, fontSize: 10, borderRadius: 1.5 }} />;
};

// ─── NUEVO MODAL: DETALLE DE VENTA ───
const VentaDetalleModal = ({ open, onClose, venta }) => {
  if (!venta) return null;
  const saldoPendiente = venta.total - venta.monto_pagado;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: 'action.hover', pb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ width: 40, height: 40, borderRadius: 2, bgcolor: `${ACCENT}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: ACCENT }}>
            <ReceiptLong />
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 800, fontSize: 16 }}>Detalle de Venta #{venta.numero_venta ?? venta.id}</Typography>
            <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{formatearFechaExacta(venta.fecha)}</Typography>
          </Box>
        </Box>
        <IconButton size="small" onClick={onClose}><Close fontSize="small" /></IconButton>
      </DialogTitle>
      
      <DialogContent sx={{ p: 0 }}>
        {/* Lista de Productos */}
        <Box sx={{ p: 3 }}>
          <Typography sx={{ fontSize: 12, fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', mb: 2, letterSpacing: 1 }}>
            Productos Facturados
          </Typography>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontSize: 11, color: 'text.secondary' }}>Producto</TableCell>
                <TableCell align="center" sx={{ fontSize: 11, color: 'text.secondary' }}>Cant.</TableCell>
                <TableCell align="right" sx={{ fontSize: 11, color: 'text.secondary' }}>P. Unit</TableCell>
                <TableCell align="right" sx={{ fontSize: 11, color: 'text.secondary' }}>Subtotal</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {venta.detalles?.map(d => (
                <TableRow key={d.id}>
                  <TableCell sx={{ fontSize: 12, fontWeight: 500 }}>{d.producto?.nombre}</TableCell>
                  <TableCell align="center" sx={{ fontSize: 12 }}>{d.cantidad}</TableCell>
                  <TableCell align="right" sx={{ fontSize: 12 }}>{formatCurrency(d.precio_unitario)}</TableCell>
                  <TableCell align="right" sx={{ fontSize: 12, fontWeight: 700 }}>{formatCurrency(d.cantidad * d.precio_unitario)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>

        <Divider />

        {/* Historial de Pagos (Si hay abonos previos) */}
        {venta.pagos && venta.pagos.length > 0 && (
          <Box sx={{ p: 3, bgcolor: '#F8FAFC' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
              <History sx={{ fontSize: 16, color: 'text.secondary' }} />
              <Typography sx={{ fontSize: 12, fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 1 }}>
                Historial de Abonos
              </Typography>
            </Box>
            <List disablePadding>
              {venta.pagos.map(pago => (
                <ListItem key={pago.id} sx={{ px: 0, py: 0.5 }}>
                  <ListItemText 
                    primary={<Typography sx={{ fontSize: 12, fontWeight: 600 }}>{formatCurrency(pago.monto)}</Typography>}
                    secondary={<Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{formatearFechaExacta(pago.fecha)} • {pago.metodo_pago}</Typography>}
                  />
                </ListItem>
              ))}
            </List>
          </Box>
        )}

        {/* Resumen Financiero */}
        <Box sx={{ p: 3, bgcolor: 'action.hover', borderTop: '1px solid', borderColor: 'divider' }}>
          <Grid container spacing={2}>
            <Grid item xs={4}>
              <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>Total Venta</Typography>
              <Typography sx={{ fontSize: 15, fontWeight: 700 }}>{formatCurrency(venta.total)}</Typography>
            </Grid>
            <Grid item xs={4}>
              <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>Abonado</Typography>
              <Typography sx={{ fontSize: 15, fontWeight: 700, color: GREEN }}>{formatCurrency(venta.monto_pagado)}</Typography>
            </Grid>
            <Grid item xs={4} sx={{ textAlign: 'right' }}>
              <Typography sx={{ fontSize: 11, color: RED, fontWeight: 700 }}>Saldo Pendiente</Typography>
              <Typography sx={{ fontSize: 18, fontWeight: 800, color: RED }}>{formatCurrency(saldoPendiente)}</Typography>
            </Grid>
          </Grid>
        </Box>
      </DialogContent>
    </Dialog>
  );
};

// ─── Tarjetas y Filas ───
const VentaCard = ({ venta, onPago, onPagoTotal, onView }) => (
  <Paper sx={{ p: 1.5, mb: 1, borderRadius: 2, bgcolor: 'action.hover', boxShadow: 'none' }}>
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
      <Box sx={{ minWidth: 0, flex: 1, mr: 1 }}>
        <Typography sx={{ fontSize: 11, color: 'text.secondary', fontWeight: 600 }}>
          {formatearFechaExacta(venta.fecha)} · #{venta.numero_venta ?? venta.id}
        </Typography>
        {venta.detalles?.map(d => (
          <Typography key={d.id} sx={{ fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {d.producto?.nombre} × {d.cantidad}
          </Typography>
        ))}
      </Box>
      <EstadoChip estado={venta.estado_pago} />
    </Box>
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <Box sx={{ display: 'flex', gap: 2 }}>
        <Box>
          <Typography sx={{ fontSize: 9, color: 'text.secondary' }}>Total</Typography>
          <Typography sx={{ fontSize: 12, fontWeight: 700 }}>{formatCurrency(venta.total)}</Typography>
        </Box>
        <Box>
          <Typography sx={{ fontSize: 9, color: 'text.secondary' }}>Pagado</Typography>
          <Typography sx={{ fontSize: 12, fontWeight: 700, color: GREEN }}>{formatCurrency(venta.monto_pagado)}</Typography>
        </Box>
      </Box>
      <Box sx={{ display: 'flex', gap: 0.5 }}>
        {/* Lupa para ver detalles */}
        <Tooltip title="Ver detalle completo">
          <IconButton size="small" onClick={() => onView(venta)} sx={{ color: '#64748b', bgcolor: 'rgba(0,0,0,0.04)', borderRadius: 1.5 }}>
            <Visibility sx={{ fontSize: 14 }} />
          </IconButton>
        </Tooltip>
        {venta.estado_pago !== 'pagado' && (
          <>
            <Tooltip title="Abono">
              <IconButton size="small" onClick={() => onPago(venta)} sx={{ color: ACCENT, bgcolor: `${ACCENT}12`, borderRadius: 1.5 }}>
                <Payment sx={{ fontSize: 14 }} />
              </IconButton>
            </Tooltip>
            <Tooltip title="Pago total">
              <IconButton size="small" onClick={() => onPagoTotal(venta)} sx={{ color: GREEN, bgcolor: `${GREEN}12`, borderRadius: 1.5 }}>
                <AttachMoney sx={{ fontSize: 14 }} />
              </IconButton>
            </Tooltip>
          </>
        )}
      </Box>
    </Box>
  </Paper>
);

const ClienteDeudaRow = ({ cuenta, onPago, onPagoTotal, onView }) => {
  const [open, setOpen] = useState(false);
  const isMobile = useMediaQuery(useTheme().breakpoints.down('sm'));

  return (
    <Paper sx={{ mb: 1.5, borderRadius: 2.5, overflow: 'hidden', boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
      <Box
        onClick={() => setOpen(o => !o)}
        sx={{ display: 'flex', alignItems: 'center', px: 1.5, py: 1.2, cursor: 'pointer', '&:hover': { bgcolor: `${RED}05` } }}
      >
        <Box sx={{ width: 28, height: 28, borderRadius: 1.5, bgcolor: `${RED}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: RED, flexShrink: 0, mr: 1 }}>
          <People sx={{ fontSize: 16 }} />
        </Box>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography sx={{ fontWeight: 700, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {cuenta.cliente_nombre}
          </Typography>
          <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>
            {cuenta.ventas_pendientes?.length} venta{cuenta.ventas_pendientes?.length !== 1 ? 's' : ''} pendiente{cuenta.ventas_pendientes?.length !== 1 ? 's' : ''}
          </Typography>
        </Box>
        <Typography sx={{ fontWeight: 800, fontSize: 13, color: RED, whiteSpace: 'nowrap', ml: 1, flexShrink: 0 }}>
          {formatCurrency(cuenta.monto_pendiente)}
        </Typography>
        <Box sx={{ ml: 0.5, flexShrink: 0 }}>
          {open ? <ExpandLess sx={{ color: 'text.secondary', fontSize: 18 }} /> : <ExpandMore sx={{ color: 'text.secondary', fontSize: 18 }} />}
        </Box>
      </Box>

      <Collapse in={open}>
        <Divider />
        <Box sx={{ p: 1.5 }}>
          {isMobile ? (
            cuenta.ventas_pendientes?.map(v => <VentaCard key={v.id} venta={v} onPago={onPago} onPagoTotal={onPagoTotal} onView={onView} />)
          ) : (
            <Box sx={{ overflowX: 'auto' }}>
              <Table size="small" sx={{ minWidth: 400 }}>
                <TableHead>
                  <TableRow>
                    {['Fecha Exacta', 'Productos (Resumen)', 'Total', 'Pagado', 'Estado', 'Acciones'].map(h => (
                      <TableCell key={h} sx={{ fontSize: 11, whiteSpace: 'nowrap' }}>{h}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {cuenta.ventas_pendientes?.map(venta => (
                    <TableRow key={venta.id} hover>
                      <TableCell sx={{ fontSize: 11, whiteSpace: 'nowrap', fontWeight: 500 }}>
                        {formatearFechaExacta(venta.fecha)}
                      </TableCell>
                      <TableCell>{venta.detalles?.slice(0,2).map(d => <Typography key={d.id} sx={{ fontSize: 10, whiteSpace: 'nowrap', color: 'text.secondary' }}>{d.producto?.nombre} × {d.cantidad}</Typography>)}{venta.detalles?.length > 2 && <Typography sx={{ fontSize: 10, color: 'text.secondary', fontStyle: 'italic' }}>+{venta.detalles.length - 2} más...</Typography>}</TableCell>
                      <TableCell sx={{ fontWeight: 700, fontSize: 11, whiteSpace: 'nowrap' }}>{formatCurrency(venta.total)}</TableCell>
                      <TableCell sx={{ color: GREEN, fontWeight: 600, fontSize: 11, whiteSpace: 'nowrap' }}>{formatCurrency(venta.monto_pagado)}</TableCell>
                      <TableCell><EstadoChip estado={venta.estado_pago} /></TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', gap: 0.5 }}>
                          {/* Lupa para ver detalles */}
                          <Tooltip title="Ver detalle de factura">
                            <IconButton size="small" onClick={() => onView(venta)} sx={{ color: '#64748b', bgcolor: 'rgba(0,0,0,0.04)', borderRadius: 1.5 }}>
                              <Visibility sx={{ fontSize: 14 }} />
                            </IconButton>
                          </Tooltip>
                          {venta.estado_pago !== 'pagado' && (
                            <>
                              <Tooltip title="Registrar Abono">
                                <IconButton size="small" onClick={() => onPago(venta)} sx={{ color: ACCENT, bgcolor: `${ACCENT}12`, borderRadius: 1.5 }}>
                                  <Payment sx={{ fontSize: 14 }} />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Pago total">
                                <IconButton size="small" onClick={() => onPagoTotal(venta)} sx={{ color: GREEN, bgcolor: `${GREEN}12`, borderRadius: 1.5 }}>
                                  <AttachMoney sx={{ fontSize: 14 }} />
                                </IconButton>
                              </Tooltip>
                            </>
                          )}
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          )}
        </Box>
      </Collapse>
    </Paper>
  );
};

const CuentasPorCobrar = () => {
  const [cuentasPorCobrar, setCuentasPorCobrar] = useState([]);
  
  // Estados para los Modales
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [showViewDialog, setShowViewDialog]       = useState(false);
  const [selectedVenta, setSelectedVenta]         = useState(null);

  useEffect(() => { fetchData(); }, []);

  const fetchData = () => apiClient.get('/reportes/cuentas_por_cobrar').then(r => setCuentasPorCobrar(r.data)).catch(console.error);

  // Manejadores de acciones
  const handlePago = (venta) => { setSelectedVenta(venta); setShowPaymentDialog(true); };
  const handleTotalPayment = (venta) => {
    if (venta.total - venta.monto_pagado <= 0) { toast.info('Esta venta ya está pagada.'); return; }
    setSelectedVenta(venta); setShowPaymentDialog(true);
  };
  const handleViewDetails = (venta) => { setSelectedVenta(venta); setShowViewDialog(true); };
  
  const handleClose = () => { setShowPaymentDialog(false); setShowViewDialog(false); setSelectedVenta(null); };
  const handleSuccess = () => { fetchData(); };

  const totalPendiente = useMemo(() => cuentasPorCobrar.reduce((s, c) => s + c.monto_pendiente, 0), [cuentasPorCobrar]);
  const top5 = useMemo(() => [...cuentasPorCobrar].sort((a, b) => b.monto_pendiente - a.monto_pendiente).slice(0, 5), [cuentasPorCobrar]);

  if (cuentasPorCobrar.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 8 }}>
        <CheckCircle sx={{ fontSize: 56, color: GREEN, mb: 2 }} />
        <Typography sx={{ fontWeight: 700, fontSize: 18, mb: 0.5 }}>¡Cartera al día!</Typography>
        <Typography sx={{ color: 'text.secondary' }}>No hay cuentas pendientes por cobrar.</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: '100%', overflow: 'hidden' }}>
      <Grid container spacing={1} sx={{ mb: 2 }}>
        <Grid item xs={6} sm={4}><KpiCard label="Total por cobrar" value={formatCurrency(totalPendiente)} icon={<AccountBalanceWallet />} color={RED} /></Grid>
        <Grid item xs={6} sm={4}><KpiCard label="Con deuda" value={cuentasPorCobrar.length} icon={<People />} color={YELLOW} /></Grid>
        <Grid item xs={12} sm={4}><KpiCard label="Deuda promedio" value={formatCurrency(totalPendiente / cuentasPorCobrar.length)} icon={<TrendingDown />} color={ACCENT} /></Grid>
      </Grid>

      <Paper sx={{ p: 2, mb: 2, borderRadius: 3, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
        <Typography sx={{ fontWeight: 700, fontSize: 13, mb: 1.5 }}>Top clientes con mayor deuda</Typography>
        {top5.map((c, i) => (
          <Box key={c.cliente_id} sx={{ mb: i < top5.length - 1 ? 1.5 : 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 0.5, minWidth: 0 }}>
              <Typography sx={{ fontSize: 12, fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{c.cliente_nombre}</Typography>
              <Typography sx={{ fontSize: 12, fontWeight: 700, color: RED, flexShrink: 0, whiteSpace: 'nowrap' }}>{formatCurrency(c.monto_pendiente)}</Typography>
            </Box>
            <LinearProgress variant="determinate" value={top5[0].monto_pendiente > 0 ? (c.monto_pendiente / top5[0].monto_pendiente) * 100 : 0} sx={{ height: 6, borderRadius: 3, bgcolor: `${RED}18`, '& .MuiLinearProgress-bar': { bgcolor: RED, borderRadius: 3 } }} />
          </Box>
        ))}
      </Paper>

      <Paper sx={{ p: 1.5, mb: 2, borderRadius: 2, bgcolor: `${RED}08`, border: `1px solid ${RED}30`, display: 'flex', alignItems: 'flex-start', gap: 1, boxShadow: 'none', overflow: 'hidden' }}>
        <Warning sx={{ color: RED, flexShrink: 0, fontSize: 18, mt: 0.2 }} />
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontWeight: 700, color: RED, fontSize: 13 }}>{cuentasPorCobrar.length} cliente{cuentasPorCobrar.length > 1 ? 's' : ''} con saldo pendiente</Typography>
          <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>Total a recuperar: <strong>{formatCurrency(totalPendiente)}</strong></Typography>
        </Box>
      </Paper>

      {/* Lista de Deudores */}
      {cuentasPorCobrar.map(cuenta => (
        <ClienteDeudaRow key={cuenta.cliente_id} cuenta={cuenta} onPago={handlePago} onPagoTotal={handleTotalPayment} onView={handleViewDetails} />
      ))}

      {/* MODALES */}
      {selectedVenta && (
        <>
          <PaymentDialog open={showPaymentDialog} handleClose={handleClose} venta={selectedVenta} onPaymentSuccess={handleSuccess} />
          <VentaDetalleModal open={showViewDialog} onClose={handleClose} venta={selectedVenta} />
        </>
      )}
    </Box>
  );
};

export default CuentasPorCobrar;