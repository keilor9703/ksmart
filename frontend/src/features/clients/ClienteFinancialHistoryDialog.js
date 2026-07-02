import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, Box, Typography, IconButton,
  Grid, Paper, Table, TableBody, TableCell, TableHead, TableRow,
  useMediaQuery, CircularProgress, Accordion, AccordionSummary, AccordionDetails, TableContainer
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  Close, AccountBalanceWallet, ShoppingCart, MoneyOff,
  History, ExpandMore, ReceiptLong, Payment
} from '@mui/icons-material';
import apiClient from '../../api';
import { formatCurrency } from '../../utils/formatters';

const ACCENT = '#3B82F6';
const RED    = '#EF4444';
const GREEN  = '#10B981';

// ─── Helpers ───
const formatearFechaExacta = (fechaString) => {
  if (!fechaString) return 'N/A';
  return new Date(fechaString).toLocaleString('es-CO', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true
  });
};

const EstadoChip = ({ estado }) => {
  const map = { 
    pagado: { label: 'Pagada', color: 'success', bg: `${GREEN}15`, text: GREEN }, 
    parcial: { label: 'Parcial', color: 'warning', bg: '#FEF3C7', text: '#D97706' }, 
    pendiente: { label: 'Pendiente', color: 'error', bg: `${RED}15`, text: RED } 
  };
  const p = map[estado] || { label: estado, color: 'default', bg: 'action.selected', text: 'text.secondary' };
  
  return (
    <Box sx={{ 
      display: 'inline-flex', alignItems: 'center', px: 1.2, py: 0.4, 
      borderRadius: 1.5, bgcolor: p.bg, color: p.text, fontWeight: 700, fontSize: 10, textTransform: 'uppercase'
    }}>
      {p.label}
    </Box>
  );
};

const KpiMiniCard = ({ label, value, icon, color }) => (
  <Paper sx={{ p: 1.5, borderRadius: 2, display: 'flex', alignItems: 'center', gap: 1.5, boxShadow: '0 2px 8px rgba(0,0,0,0.04)', border: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}>
    <Box sx={{ width: 34, height: 34, borderRadius: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: `${color}15`, color: color }}>
      {icon}
    </Box>
    <Box>
      <Typography sx={{ fontSize: 10, color: 'text.secondary', fontWeight: 600, textTransform: 'uppercase' }}>{label}</Typography>
      <Typography sx={{ fontSize: 16, fontWeight: 800, color: 'text.primary', lineHeight: 1.1 }}>{value}</Typography>
    </Box>
  </Paper>
);

const ClienteFinancialHistoryDialog = ({ open, handleClose, clienteId, clienteNombre }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
  const [history, setHistory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (open && clienteId) {
      setLoading(true);
      setError(null);
      apiClient.get(`/clientes/${clienteId}/history`)
        .then(res => setHistory(res.data))
        .catch(err => {
          console.error("Error cargando historial", err);
          setError('No se pudo cargar el historial financiero del cliente.');
        })
        .finally(() => setLoading(false));
    } else {
      setHistory(null);
      setError(null);
    }
  }, [open, clienteId]);

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: 3, bgcolor: 'background.default' } }}>
      {/* ── HEADER DEL MODAL ── */}
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: 'background.paper', borderBottom: '1px solid', borderColor: 'divider', pb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ width: 42, height: 42, borderRadius: 2, bgcolor: `${ACCENT}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: ACCENT }}>
            <History />
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 800, fontSize: 18, color: 'text.primary' }}>Historial Financiero</Typography>
            <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>Cliente: {clienteNombre}</Typography>
          </Box>
        </Box>
        <IconButton onClick={handleClose} sx={{ bgcolor: 'action.hover' }}><Close fontSize="small" /></IconButton>
      </DialogTitle>

      <DialogContent sx={{ p: { xs: 2, sm: 3 } }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 10 }}>
            <CircularProgress sx={{ color: ACCENT }} />
          </Box>
        ) : error ? (
          <Box sx={{ textAlign: 'center', py: 5 }}>
             <Typography sx={{ color: RED, fontWeight: 600 }}>{error}</Typography>
          </Box>
        ) : !history || (!history.ventas.length && !history.total_ventas_general) ? (
          <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 3, border: '1px dashed', borderColor: 'divider', bgcolor: 'background.paper' }}>
            <Typography sx={{ color: 'text.secondary', fontSize: 14 }}>No se encontró historial financiero para este cliente.</Typography>
          </Paper>
        ) : (
          <Box>
            {/* ── KPIs FINANCIEROS ── */}
            <Grid container spacing={2} sx={{ mb: 4 }}>
              <Grid item xs={12} sm={4}>
                <KpiMiniCard label="Total Ventas" value={formatCurrency(history.total_ventas_general || 0)} icon={<ShoppingCart fontSize="small" />} color={ACCENT} />
              </Grid>
              <Grid item xs={12} sm={4}>
                <KpiMiniCard label="Total Pagado" value={formatCurrency(history.total_pagado_general || 0)} icon={<AccountBalanceWallet fontSize="small" />} color={GREEN} />
              </Grid>
              <Grid item xs={12} sm={4}>
                <KpiMiniCard label="Deuda Pendiente" value={formatCurrency(history.total_deuda || 0)} icon={<MoneyOff fontSize="small" />} color={RED} />
              </Grid>
            </Grid>

            <Typography sx={{ fontWeight: 800, fontSize: 15, mb: 2, display: 'flex', alignItems: 'center', gap: 1, color: 'text.primary' }}>
              <ReceiptLong sx={{ fontSize: 20, color: 'text.secondary' }} />
              Detalle de Ventas y Pagos
            </Typography>

            {/* ── ACORDEONES MODERNOS ── */}
            {history.ventas.map((venta) => (
              <Accordion 
                key={venta.id} 
                disableGutters 
                elevation={0}
                sx={{ 
                  mb: 1.5, 
                  borderRadius: '12px !important', 
                  border: '1px solid', borderColor: 'divider', 
                  bgcolor: 'background.paper',
                  '&:before': { display: 'none' },
                  boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
                }}
              >
                {/* Resumen del Acordeón (La barra visible) */}
                <AccordionSummary expandIcon={<ExpandMore />} sx={{ px: 2, py: 0.5, borderRadius: '12px' }}>
                  <Grid container alignItems="center" spacing={1}>
                    <Grid item xs={12} sm={3}>
                      <Typography sx={{ fontWeight: 800, fontSize: 14, color: 'text.primary' }}>Venta #{venta.numero_venta ?? venta.id}</Typography>
                      <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{formatearFechaExacta(venta.fecha)}</Typography>
                    </Grid>
                    <Grid item xs={6} sm={4}>
                      <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>Total Factura</Typography>
                      <Typography sx={{ fontWeight: 700, fontSize: 14, color: 'text.primary' }}>{formatCurrency(venta.total)}</Typography>
                    </Grid>
                    <Grid item xs={6} sm={5} sx={{ textAlign: isMobile ? 'left' : 'right' }}>
                      <EstadoChip estado={venta.estado_pago} />
                    </Grid>
                  </Grid>
                </AccordionSummary>

                {/* Contenido Desplegable */}
                {/* ✅ CORRECCIÓN MODO OSCURO: Usamos background.default para el interior */}
                <AccordionDetails sx={{ p: 0, borderTop: '1px solid', borderColor: 'divider', bgcolor: 'background.default' }}>
                  
                  {/* Sección de Productos */}
                  <Box sx={{ p: 2 }}>
                    <Typography sx={{ fontSize: 12, fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', mb: 1 }}>Productos Facturados</Typography>
                    {/* ✅ CORRECCIÓN MODO OSCURO: Usamos background.paper para las tablas */}
                    <TableContainer component={Paper} sx={{ boxShadow: 'none', border: '1px solid', borderColor: 'divider', borderRadius: 2, bgcolor: 'background.paper' }}>
                      <Table size="small">
                        <TableHead>
                          <TableRow sx={{ bgcolor: 'action.hover' }}>
                            <TableCell sx={{ fontSize: 11, fontWeight: 600, color: 'text.primary' }}>Producto</TableCell>
                            <TableCell align="right" sx={{ fontSize: 11, fontWeight: 600, color: 'text.primary' }}>Cant.</TableCell>
                            <TableCell align="right" sx={{ fontSize: 11, fontWeight: 600, color: 'text.primary' }}>Precio</TableCell>
                            <TableCell align="right" sx={{ fontSize: 11, fontWeight: 600, color: 'text.primary' }}>Subtotal</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {venta.detalles?.map(detalle => (
                            <TableRow key={detalle.id}>
                              <TableCell sx={{ fontSize: 12, color: 'text.primary' }}>{detalle.producto?.nombre || 'N/A'}</TableCell>
                              <TableCell align="right" sx={{ fontSize: 12, color: 'text.primary' }}>{detalle.cantidad}</TableCell>
                              <TableCell align="right" sx={{ fontSize: 12, color: 'text.primary' }}>{formatCurrency(detalle.precio_unitario)}</TableCell>
                              <TableCell align="right" sx={{ fontSize: 12, fontWeight: 600, color: 'text.primary' }}>{formatCurrency(detalle.precio_unitario * detalle.cantidad)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Box>

                  {/* Sección de Pagos (Solo si hay pagos) */}
                  {venta.pagos?.length > 0 && (
                    <Box sx={{ px: 2, pb: 2 }}>
                      <Typography sx={{ fontSize: 12, fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', mb: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Payment sx={{ fontSize: 14 }} /> Historial de Abonos
                      </Typography>
                      <TableContainer component={Paper} sx={{ boxShadow: 'none', border: '1px solid', borderColor: 'divider', borderRadius: 2, bgcolor: 'background.paper' }}>
                        <Table size="small">
                          <TableHead>
                            <TableRow sx={{ bgcolor: 'action.hover' }}>
                              <TableCell sx={{ fontSize: 11, fontWeight: 600, color: 'text.primary' }}># Pago</TableCell>
                              <TableCell sx={{ fontSize: 11, fontWeight: 600, color: 'text.primary' }}>Fecha Exacta</TableCell>
                              <TableCell sx={{ fontSize: 11, fontWeight: 600, color: 'text.primary' }}>Método</TableCell>
                              <TableCell align="right" sx={{ fontSize: 11, fontWeight: 600, color: 'text.primary' }}>Monto</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {venta.pagos.map(pago => (
                              <TableRow key={pago.id}>
                                <TableCell sx={{ fontSize: 12, color: 'text.primary' }}>{pago.id}</TableCell>
                                <TableCell sx={{ fontSize: 12, color: 'text.primary' }}>{formatearFechaExacta(pago.fecha)}</TableCell>
                                <TableCell sx={{ fontSize: 12, color: 'text.primary' }}>{pago.metodo_pago || 'N/A'}</TableCell>
                                <TableCell align="right" sx={{ fontSize: 12, fontWeight: 700, color: GREEN }}>+{formatCurrency(pago.monto)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </Box>
                  )}

                  {/* Resumen Financiero de esta Venta */}
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3, p: 2, bgcolor: 'action.hover', borderTop: '1px dashed', borderColor: 'divider' }}>
                     <Box>
                       <Typography sx={{ fontSize: 10, color: 'text.secondary', textTransform: 'uppercase' }}>Monto Pagado</Typography>
                       <Typography sx={{ fontWeight: 700, fontSize: 14, color: GREEN }}>{formatCurrency(venta.monto_pagado)}</Typography>
                     </Box>
                     <Box>
                       <Typography sx={{ fontSize: 10, color: 'text.secondary', textTransform: 'uppercase' }}>Saldo Pendiente</Typography>
                       <Typography sx={{ fontWeight: 800, fontSize: 14, color: venta.total - venta.monto_pagado > 0 ? RED : 'text.primary' }}>
                         {formatCurrency(venta.total - venta.monto_pagado)}
                       </Typography>
                     </Box>
                  </Box>

                </AccordionDetails>
              </Accordion>
            ))}
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ClienteFinancialHistoryDialog;