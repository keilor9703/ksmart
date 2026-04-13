import React, { useState, useEffect, useMemo } from 'react';
import apiClient from '../api';
import { formatCurrency } from '../utils/formatters';
import PaymentDialog from './PaymentDialog';
import { toast } from 'react-toastify';
import {
  Box, Typography, Table, TableBody, TableCell,
  TableHead, TableRow, Chip, IconButton, Paper, Grid, Divider,
  Collapse, Tooltip, useMediaQuery, LinearProgress
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  Payment, AttachMoney, ExpandMore, ExpandLess,
  CheckCircle, Warning, TrendingDown, People, AccountBalanceWallet
} from '@mui/icons-material';

const ACCENT = '#3B82F6';
const RED    = '#EF4444';
const GREEN  = '#10B981';
const YELLOW = '#F59E0B';

const KpiCard = ({ label, value, icon, color }) => (
  <Paper sx={{ p: 2, borderRadius: 3, display: 'flex', alignItems: 'center', gap: 1.5, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
    <Box sx={{ width: 38, height: 38, borderRadius: 2, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: `${color}18`, color }}>
      {icon}
    </Box>
    <Box sx={{ minWidth: 0 }}>
      <Typography sx={{ fontSize: 11, color: 'text.secondary', fontWeight: 500 }}>{label}</Typography>
      <Typography sx={{ fontSize: 15, fontWeight: 700, lineHeight: 1.2 }}>{value}</Typography>
    </Box>
  </Paper>
);

const EstadoChip = ({ estado }) => {
  const map = { pagado: { label: 'Pagada', color: 'success' }, parcial: { label: 'Parcial', color: 'warning' }, pendiente: { label: 'Pendiente', color: 'error' } };
  const p = map[estado] || { label: estado, color: 'default' };
  return <Chip label={p.label} color={p.color} size="small" sx={{ fontWeight: 600, fontSize: 10, borderRadius: 1.5 }} />;
};

const VentaCard = ({ venta, onPago, onPagoTotal }) => (
  <Paper sx={{ p: 1.5, mb: 1, borderRadius: 2, bgcolor: 'action.hover', boxShadow: 'none' }}>
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
      <Box sx={{ minWidth: 0, flex: 1, mr: 1 }}>
        <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
          {new Date(venta.fecha).toLocaleDateString()} · #{venta.id}
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
      {venta.estado_pago !== 'pagado' && (
        <Box sx={{ display: 'flex', gap: 0.5 }}>
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
        </Box>
      )}
    </Box>
  </Paper>
);

const ClienteDeudaRow = ({ cuenta, onPago, onPagoTotal }) => {
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
            cuenta.ventas_pendientes?.map(v => <VentaCard key={v.id} venta={v} onPago={onPago} onPagoTotal={onPagoTotal} />)
          ) : (
            <Box sx={{ overflowX: 'auto' }}>
              <Table size="small" sx={{ minWidth: 400 }}>
                <TableHead>
                  <TableRow>
                    {['Fecha', 'Productos', 'Total', 'Pagado', 'Estado', 'Acciones'].map(h => (
                      <TableCell key={h} sx={{ fontSize: 11, whiteSpace: 'nowrap' }}>{h}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {cuenta.ventas_pendientes?.map(venta => (
                    <TableRow key={venta.id} hover>
                      <TableCell sx={{ fontSize: 11, whiteSpace: 'nowrap' }}>{new Date(venta.fecha).toLocaleDateString()}</TableCell>
                      <TableCell>{venta.detalles?.map(d => <Typography key={d.id} sx={{ fontSize: 10, whiteSpace: 'nowrap', color: 'text.secondary' }}>{d.producto?.nombre} × {d.cantidad}</Typography>)}</TableCell>
                      <TableCell sx={{ fontWeight: 700, fontSize: 11, whiteSpace: 'nowrap' }}>{formatCurrency(venta.total)}</TableCell>
                      <TableCell sx={{ color: GREEN, fontWeight: 600, fontSize: 11, whiteSpace: 'nowrap' }}>{formatCurrency(venta.monto_pagado)}</TableCell>
                      <TableCell><EstadoChip estado={venta.estado_pago} /></TableCell>
                      <TableCell>
                        {venta.estado_pago !== 'pagado' && (
                          <Box sx={{ display: 'flex', gap: 0.5 }}>
                            <Tooltip title="Abono"><IconButton size="small" onClick={() => onPago(venta)} sx={{ color: ACCENT, bgcolor: `${ACCENT}12`, borderRadius: 1.5 }}><Payment sx={{ fontSize: 14 }} /></IconButton></Tooltip>
                            <Tooltip title="Pago total"><IconButton size="small" onClick={() => onPagoTotal(venta)} sx={{ color: GREEN, bgcolor: `${GREEN}12`, borderRadius: 1.5 }}><AttachMoney sx={{ fontSize: 14 }} /></IconButton></Tooltip>
                          </Box>
                        )}
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
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [selectedVenta, setSelectedVenta]         = useState(null);

  useEffect(() => { fetchData(); }, []);

  const fetchData = () =>
    apiClient.get('/reportes/cuentas_por_cobrar').then(r => setCuentasPorCobrar(r.data)).catch(console.error);

  const handlePago = (venta) => { setSelectedVenta(venta); setShowPaymentDialog(true); };
  const handleClose = () => { setShowPaymentDialog(false); setSelectedVenta(null); };
  const handleSuccess = () => { fetchData(); toast.success('Pago registrado exitosamente'); };

  const handleTotalPayment = async (venta) => {
    const monto = venta.total - venta.monto_pagado;
    if (monto <= 0) { toast.info('Esta venta ya está pagada.'); return; }
    // Usar PaymentDialog para que el usuario elija el método de pago
    setSelectedVenta(venta);
    setShowPaymentDialog(true);
  };

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
    <Box>
      {/* KPIs — mismo Grid que Inventario */}
      <Grid container spacing={1.5} sx={{ mb: 2 }}>
        <Grid item xs={6} sm={4}>
          <KpiCard label="Total por cobrar" value={formatCurrency(totalPendiente)} icon={<AccountBalanceWallet />} color={RED} />
        </Grid>
        <Grid item xs={6} sm={4}>
          <KpiCard label="Con deuda" value={cuentasPorCobrar.length} icon={<People />} color={YELLOW} />
        </Grid>
        <Grid item xs={12} sm={4}>
          <KpiCard label="Deuda promedio" value={formatCurrency(totalPendiente / cuentasPorCobrar.length)} icon={<TrendingDown />} color={ACCENT} />
        </Grid>
      </Grid>

      {/* Top deudores con LinearProgress — nunca desborda */}
      <Paper sx={{ p: 2, mb: 2, borderRadius: 3, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
        <Typography sx={{ fontWeight: 700, fontSize: 13, mb: 1.5 }}>Top clientes con mayor deuda</Typography>
        {top5.map((c, i) => (
          <Box key={c.cliente_id} sx={{ mb: i < top5.length - 1 ? 1.5 : 0 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
              <Typography sx={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '65%' }}>
                {c.cliente_nombre}
              </Typography>
              <Typography sx={{ fontSize: 12, fontWeight: 700, color: RED, flexShrink: 0, ml: 1 }}>
                {formatCurrency(c.monto_pendiente)}
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={top5[0].monto_pendiente > 0 ? (c.monto_pendiente / top5[0].monto_pendiente) * 100 : 0}
              sx={{ height: 6, borderRadius: 3, bgcolor: `${RED}18`, '& .MuiLinearProgress-bar': { bgcolor: RED, borderRadius: 3 } }}
            />
          </Box>
        ))}
      </Paper>

      {/* Alerta */}
      <Paper sx={{ p: 1.5, mb: 2, borderRadius: 2, bgcolor: `${RED}08`, border: `1px solid ${RED}30`, display: 'flex', alignItems: 'center', gap: 1.5, boxShadow: 'none' }}>
        <Warning sx={{ color: RED, flexShrink: 0, fontSize: 18 }} />
        <Box>
          <Typography sx={{ fontWeight: 700, color: RED, fontSize: 13 }}>
            {cuentasPorCobrar.length} cliente{cuentasPorCobrar.length > 1 ? 's' : ''} con saldo pendiente
          </Typography>
          <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
            Total a recuperar: <strong>{formatCurrency(totalPendiente)}</strong>
          </Typography>
        </Box>
      </Paper>

      {/* Acordeones */}
      {cuentasPorCobrar.map(cuenta => (
        <ClienteDeudaRow key={cuenta.cliente_id} cuenta={cuenta} onPago={handlePago} onPagoTotal={handleTotalPayment} />
      ))}

      {selectedVenta && (
        <PaymentDialog open={showPaymentDialog} handleClose={handleClose} venta={selectedVenta} onPaymentSuccess={handleSuccess} />
      )}
    </Box>
  );
};

export default CuentasPorCobrar;
