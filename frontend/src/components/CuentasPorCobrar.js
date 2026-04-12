import React, { useState, useEffect, useMemo } from 'react';
import apiClient from '../api';
import { formatCurrency } from '../utils/formatters';
import PaymentDialog from './PaymentDialog';
import { toast } from 'react-toastify';
import {
  Box, Typography, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Chip, IconButton, Paper, Grid, Divider,
  Collapse, Tooltip, Button
} from '@mui/material';
import {
  Edit, Payment, AttachMoney, ExpandMore, ExpandLess,
  CheckCircle, Warning, TrendingDown, People, AccountBalanceWallet
} from '@mui/icons-material';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip as ChartTooltip, Legend
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, ChartTooltip, Legend);

const ACCENT = '#3B82F6';
const RED    = '#EF4444';
const GREEN  = '#10B981';
const YELLOW = '#F59E0B';

// ─── KPI Card ─────────────────────────────────────────────────────────────────
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

// ─── Fila de cliente (acordeón) ───────────────────────────────────────────────
const ClienteDeudaRow = ({ cuenta, onPago, onPagoTotal, onEditPago }) => {
  const [open, setOpen] = useState(false);
  const pendiente = cuenta.monto_pendiente;

  return (
    <Box sx={{
      borderRadius: 2.5, border: '1px solid', borderColor: 'divider',
      overflow: 'hidden', mb: 2,
      boxShadow: open ? '0 4px 16px rgba(0,0,0,0.08)' : '0 1px 4px rgba(0,0,0,0.04)',
      transition: 'box-shadow 0.2s',
    }}>
      {/* Header del acordeón */}
      <Box
        onClick={() => setOpen(o => !o)}
        sx={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          px: 2.5, py: 2, cursor: 'pointer',
          bgcolor: open ? `${RED}05` : 'background.paper',
          '&:hover': { bgcolor: `${RED}08` },
          transition: 'background 0.15s',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box sx={{
            width: 36, height: 36, borderRadius: 2,
            bgcolor: `${RED}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: RED, flexShrink: 0,
          }}>
            <People fontSize="small" />
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 700, fontSize: 14 }}>{cuenta.cliente_nombre}</Typography>
            <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
              {cuenta.ventas_pendientes?.length} venta{cuenta.ventas_pendientes?.length !== 1 ? 's' : ''} pendiente{cuenta.ventas_pendientes?.length !== 1 ? 's' : ''}
            </Typography>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box sx={{ textAlign: 'right' }}>
            <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>Saldo pendiente</Typography>
            <Typography sx={{ fontWeight: 800, fontSize: 16, color: RED }}>
              {formatCurrency(pendiente)}
            </Typography>
          </Box>
          {open ? <ExpandLess sx={{ color: 'text.secondary' }} /> : <ExpandMore sx={{ color: 'text.secondary' }} />}
        </Box>
      </Box>

      {/* Detalle de ventas */}
      <Collapse in={open}>
        <Divider />
        <Box sx={{ p: 2 }}>
          <TableContainer sx={{ borderRadius: 2, border: "1px solid", borderColor: "divider", overflowX: "auto" }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  {['Fecha', 'Productos', 'Total Venta', 'Pagado', 'Estado', 'Pagos', 'Acciones'].map(h => (
                    <TableCell key={h}>{h}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {cuenta.ventas_pendientes?.map(venta => (
                  <TableRow key={venta.id} hover>
                    <TableCell sx={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                      {new Date(venta.fecha).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      {venta.detalles.map(d => (
                        <Typography key={d.id} sx={{ fontSize: 12, color: 'text.secondary' }}>
                          {d.producto?.nombre} × {d.cantidad}
                        </Typography>
                      ))}
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>{formatCurrency(venta.total)}</TableCell>
                    <TableCell sx={{ color: GREEN, fontWeight: 600 }}>{formatCurrency(venta.monto_pagado)}</TableCell>
                    <TableCell><EstadoChip estado={venta.estado_pago} /></TableCell>
                    <TableCell>
                      {venta.pagos?.map(p => (
                        <Box key={p.id} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.3 }}>
                          <Typography sx={{ fontSize: 12 }}>
                            {formatCurrency(p.monto)} · {new Date(p.fecha).toLocaleDateString()}
                          </Typography>
                          <Tooltip title="Editar pago">
                            <IconButton size="small" onClick={() => onEditPago(venta, p)}
                              sx={{ color: ACCENT, p: 0.3 }}>
                              <Edit sx={{ fontSize: 13 }} />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      ))}
                    </TableCell>
                    <TableCell>
                      {venta.estado_pago !== 'pagado' && (
                        <Box sx={{ display: 'flex', gap: 0.5 }}>
                          <Tooltip title="Registrar abono">
                            <IconButton size="small" onClick={() => onPago(venta)}
                              sx={{ color: ACCENT, bgcolor: `${ACCENT}12`, borderRadius: 1.5 }}>
                              <Payment fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Pago total">
                            <IconButton size="small" onClick={() => onPagoTotal(venta)}
                              sx={{ color: GREEN, bgcolor: `${GREEN}12`, borderRadius: 1.5 }}>
                              <AttachMoney fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      </Collapse>
    </Box>
  );
};

// ─── Componente principal ──────────────────────────────────────────────────────
const CuentasPorCobrar = () => {
  const [cuentasPorCobrar, setCuentasPorCobrar] = useState([]);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [selectedVenta, setSelectedVenta]         = useState(null);
  const [selectedPago, setSelectedPago]           = useState(null);

  useEffect(() => { fetchCuentasPorCobrar(); }, []);

  const fetchCuentasPorCobrar = () =>
    apiClient.get('/reportes/cuentas_por_cobrar')
      .then(r => setCuentasPorCobrar(r.data))
      .catch(console.error);

  const handleShowPaymentDialog = (venta, pago = null) => {
    setSelectedVenta(venta); setSelectedPago(pago); setShowPaymentDialog(true);
  };
  const handleClosePaymentDialog = () => {
    setShowPaymentDialog(false); setSelectedVenta(null); setSelectedPago(null);
  };
  const handlePaymentSuccess = () => {
    fetchCuentasPorCobrar();
    toast.success('Pago registrado exitosamente');
  };

  const handleTotalPayment = async (venta) => {
    const montoPendiente = venta.total - venta.monto_pagado;
    if (montoPendiente <= 0) { toast.info('Esta venta ya está completamente pagada.'); return; }
    if (window.confirm(`¿Confirmar pago total de ${formatCurrency(montoPendiente)} para venta #${venta.id}?`)) {
      try {
        await apiClient.post('/pagos/', { venta_id: venta.id, monto: montoPendiente, metodo_pago: 'Pago Total' });
        handlePaymentSuccess();
      } catch { toast.error('Error al registrar el pago total.'); }
    }
  };

  // ── Stats ────────────────────────────────────────────────────────────────
  const totalPendiente = useMemo(() =>
    cuentasPorCobrar.reduce((s, c) => s + c.monto_pendiente, 0),
    [cuentasPorCobrar]
  );

  const topDeudoresData = useMemo(() => {
    const top5 = [...cuentasPorCobrar].sort((a, b) => b.monto_pendiente - a.monto_pendiente).slice(0, 5);
    return {
      labels: top5.map(d => d.cliente_nombre),
      datasets: [{
        label: 'Saldo pendiente',
        data: top5.map(d => d.monto_pendiente),
        backgroundColor: `${RED}99`,
        borderColor: RED,
        borderWidth: 1,
        borderRadius: 6,
      }],
    };
  }, [cuentasPorCobrar]);

  if (cuentasPorCobrar.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 10 }}>
        <CheckCircle sx={{ fontSize: 64, color: GREEN, mb: 2 }} />
        <Typography sx={{ fontWeight: 700, fontSize: 20, mb: 0.5 }}>¡Cartera al día!</Typography>
        <Typography sx={{ color: 'text.secondary' }}>No hay cuentas pendientes por cobrar.</Typography>
      </Box>
    );
  }

  return (
    <Box>
      {/* ── KPIs ── */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={4}>
          <KpiCard label="Total por cobrar" value={formatCurrency(totalPendiente)} icon={<AccountBalanceWallet />} color={RED} />
        </Grid>
        <Grid item xs={12} sm={4}>
          <KpiCard label="Clientes con deuda" value={cuentasPorCobrar.length} icon={<People />} color={YELLOW} />
        </Grid>
        <Grid item xs={12} sm={4}>
          <KpiCard
            label="Deuda promedio"
            value={formatCurrency(totalPendiente / cuentasPorCobrar.length)}
            icon={<TrendingDown />}
            color={ACCENT}
          />
        </Grid>
      </Grid>

      {/* ── Gráfica top deudores ── */}
      <Paper sx={{ p: 3, borderRadius: 3, mb: 3, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
        <Typography sx={{ fontWeight: 700, fontSize: 15, mb: 2 }}>Top 5 clientes con mayor deuda</Typography>
        <Box sx={{ maxWidth: 700, mx: 'auto' }}>
          <Bar
            data={topDeudoresData}
            options={{
              responsive: true,
              plugins: {
                legend: { display: false },
                title:  { display: false },
                tooltip: {
                  callbacks: { label: (ctx) => ` ${formatCurrency(ctx.parsed.y)}` },
                },
              },
              scales: {
                y: {
                  beginAtZero: true,
                  ticks: { callback: (v) => formatCurrency(v) },
                  grid: { color: 'rgba(0,0,0,0.05)' },
                },
                x: { grid: { display: false } },
              },
            }}
          />
        </Box>
      </Paper>

      {/* ── Alerta resumen ── */}
      <Paper sx={{
        p: 2, mb: 3, borderRadius: 2,
        bgcolor: `${RED}08`, border: `1px solid ${RED}30`,
        display: 'flex', alignItems: 'center', gap: 1.5, boxShadow: 'none',
      }}>
        <Warning sx={{ color: RED, flexShrink: 0 }} />
        <Box>
          <Typography sx={{ fontWeight: 700, color: RED, fontSize: 14 }}>
            {cuentasPorCobrar.length} cliente{cuentasPorCobrar.length > 1 ? 's' : ''} con saldo pendiente
          </Typography>
          <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
            Total a recuperar: <strong>{formatCurrency(totalPendiente)}</strong>
          </Typography>
        </Box>
      </Paper>

      {/* ── Lista de clientes ── */}
      {cuentasPorCobrar.map(cuenta => (
        <ClienteDeudaRow
          key={cuenta.cliente_id}
          cuenta={cuenta}
          onPago={(venta) => handleShowPaymentDialog(venta)}
          onPagoTotal={handleTotalPayment}
          onEditPago={(venta, pago) => handleShowPaymentDialog(venta, pago)}
        />
      ))}

      {selectedVenta && (
        <PaymentDialog
          open={showPaymentDialog}
          handleClose={handleClosePaymentDialog}
          venta={selectedVenta}
          onPaymentSuccess={handlePaymentSuccess}
          pagoToEdit={selectedPago}
        />
      )}
    </Box>
  );
};

export default CuentasPorCobrar;
