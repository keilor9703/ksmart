import React, { useState } from 'react';
import {
  Box, Paper, Typography, Table, TableHead, TableRow, TableCell, TableBody,
  TableContainer, Chip, Button, CircularProgress, Tooltip, IconButton, alpha,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, InputAdornment,
} from '@mui/material';
import {
  CheckCircle, Cancel, HourglassEmpty, ReceiptLong, Replay, PictureAsPdf,
  ContentCopy, Search, Payments, Warning, Download,
} from '@mui/icons-material';
import { toast } from 'react-toastify';
import apiClient from '../../../api';

const GREEN  = '#059669';
const ORANGE = '#6366F1';
const RED    = '#dc2626';
const BLUE   = '#2563eb';
const GRAY   = '#94a3b8';

const fmt = v => `$${new Intl.NumberFormat('es-CO').format(v)}`;
const fmtDate = d => d ? new Date(d).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const FE_STATES = {
  exitoso:         { label: 'Emitida',       color: GREEN,  icon: <CheckCircle sx={{ fontSize: 13 }} /> },
  fallido:         { label: 'Fallida',        color: RED,    icon: <Cancel sx={{ fontSize: 13 }} /> },
  no_configurado:  { label: 'Sin config FE',  color: GRAY,   icon: <HourglassEmpty sx={{ fontSize: 13 }} /> },
  pendiente:       { label: 'Pendiente',      color: ORANGE, icon: <HourglassEmpty sx={{ fontSize: 13 }} /> },
};

function FeChip({ estado }) {
  const s = FE_STATES[estado] || FE_STATES['no_configurado'];
  return (
    <Chip
      icon={React.cloneElement(s.icon, { sx: { fontSize: '13px !important', color: `${s.color} !important` } })}
      label={s.label}
      size="small"
      sx={{ bgcolor: alpha(s.color, 0.1), color: s.color, fontWeight: 700, fontSize: 10, height: 20, '& .MuiChip-icon': { ml: '4px' } }}
    />
  );
}

function CopyText({ value }) {
  if (!value) return <Typography sx={{ fontSize: 11, color: 'text.disabled' }}>—</Typography>;
  return (
    <Box
      sx={{ display: 'flex', alignItems: 'center', gap: 0.4, cursor: 'pointer' }}
      onClick={() => { navigator.clipboard.writeText(value); toast.info('Copiado'); }}
    >
      <Typography sx={{ fontSize: 11, fontFamily: 'monospace', color: 'text.secondary', maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {value}
      </Typography>
      <ContentCopy sx={{ fontSize: 11, color: 'text.disabled', flexShrink: 0 }} />
    </Box>
  );
}

export default function FinanzasTab({ pagos: initialPagos }) {
  const [pagos, setPagos]               = useState(initialPagos || []);
  const [search, setSearch]             = useState('');
  const [retryingId, setRetryingId]     = useState(null);
  const [wompiId, setWompiId]           = useState('');
  const [recoveryLoading, setRecoveryLoading] = useState(false);

  // Refrescar lista desde la API
  const refrescar = async () => {
    const { data } = await apiClient.get('/superadmin/historial-pagos');
    setPagos(data);
  };

  const reintentar = async (pago) => {
    setRetryingId(pago.id);
    try {
      const { data } = await apiClient.post(`/superadmin/reintentar-fe/${pago.id}`);
      if (data.estado === 'exitoso') {
        toast.success(`✅ FE emitida — ${data.numero_factura || ''}`);
      } else {
        toast.error(`FE fallida: ${data.mensaje}`);
      }
      await refrescar();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Error al reintentar la FE.');
    } finally {
      setRetryingId(null);
    }
  };

  const recuperarPago = async () => {
    if (!wompiId.trim()) return;
    setRecoveryLoading(true);
    try {
      const { data } = await apiClient.post('/superadmin/recuperar-pago-wompi', { wompi_id: wompiId.trim() });
      toast.success(`✅ ${data.mensaje || 'Pago recuperado'} — ${data.empresa} | ${data.plan}`);
      setWompiId('');
      await refrescar();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Error al recuperar el pago.');
    } finally {
      setRecoveryLoading(false);
    }
  };

  const exportar = () => {
    if (!pagos.length) return;
    const cols = ['id','empresa_nombre','plan_nombre','monto','moneda','metodo_pago','bold_tx_id','fecha_pago','estado_fe','numero_factura_ksmart','cufe_fe','pdf_url_fe'];
    const csv = [cols.join(','), ...pagos.map(p => cols.map(k => `"${p[k] ?? ''}"`).join(','))].join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = 'historial_pagos.csv';
    a.click();
  };

  const filtered = pagos.filter(p => {
    const q = search.toLowerCase();
    return !q || [p.empresa_nombre, p.plan_nombre, p.bold_tx_id, p.numero_factura_ksmart, p.cufe_fe].some(v => String(v || '').toLowerCase().includes(q));
  });

  const totalIngresos = pagos.reduce((a, p) => a + (p.monto || 0), 0);
  const feExitosas   = pagos.filter(p => p.estado_fe === 'exitoso').length;
  const feFallidas   = pagos.filter(p => p.estado_fe === 'fallido').length;

  return (
    <Box>
      {/* KPIs */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <Paper sx={{ p: 2.5, borderRadius: 3, bgcolor: alpha(GREEN, 0.06), border: `1px solid ${alpha(GREEN, 0.2)}`, flex: 1, minWidth: 180 }}>
          <Typography sx={{ fontWeight: 800, fontSize: 11, color: GREEN, textTransform: 'uppercase', mb: 0.3 }}>Ingresos totales</Typography>
          <Typography sx={{ fontWeight: 900, fontSize: 26, color: GREEN }}>{fmt(totalIngresos)}</Typography>
          <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{pagos.length} transacciones</Typography>
        </Paper>
        <Paper sx={{ p: 2.5, borderRadius: 3, bgcolor: alpha(BLUE, 0.06), border: `1px solid ${alpha(BLUE, 0.2)}`, flex: 1, minWidth: 150 }}>
          <Typography sx={{ fontWeight: 800, fontSize: 11, color: BLUE, textTransform: 'uppercase', mb: 0.3 }}>FE emitidas</Typography>
          <Typography sx={{ fontWeight: 900, fontSize: 26, color: BLUE }}>{feExitosas}</Typography>
          <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>facturas válidas DIAN</Typography>
        </Paper>
        {feFallidas > 0 && (
          <Paper sx={{ p: 2.5, borderRadius: 3, bgcolor: alpha(RED, 0.06), border: `1px solid ${alpha(RED, 0.2)}`, flex: 1, minWidth: 150 }}>
            <Typography sx={{ fontWeight: 800, fontSize: 11, color: RED, textTransform: 'uppercase', mb: 0.3 }}>FE fallidas</Typography>
            <Typography sx={{ fontWeight: 900, fontSize: 26, color: RED }}>{feFallidas}</Typography>
            <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>pendientes de reintento</Typography>
          </Paper>
        )}
      </Box>

      {/* Recuperar pago perdido */}
      <Paper sx={{ p: 2, mb: 3, borderRadius: 3, border: `1px solid ${alpha(ORANGE, 0.35)}`, bgcolor: alpha(ORANGE, 0.04) }}>
        <Typography sx={{ fontWeight: 800, fontSize: 13, color: ORANGE, mb: 0.5, display: 'flex', alignItems: 'center', gap: 0.8 }}>
          <Warning fontSize="small" /> Recuperar pago no registrado
        </Typography>
        <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 1.5 }}>
          Si un cliente pagó con Wompi pero el pago no aparece en la tabla, pega el ID de transacción de Wompi.
        </Typography>
        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
          <TextField
            size="small" placeholder="ID de transacción Wompi (wom_prod_abc123...)"
            value={wompiId} onChange={e => setWompiId(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && recuperarPago()}
            sx={{ flex: 1, minWidth: 260, bgcolor: 'background.paper', borderRadius: 2 }}
          />
          <Button
            variant="contained" disabled={!wompiId.trim() || recoveryLoading}
            startIcon={recoveryLoading ? <CircularProgress size={14} color="inherit" /> : <Search />}
            onClick={recuperarPago}
            sx={{ bgcolor: ORANGE, '&:hover': { bgcolor: '#e5551c' }, fontWeight: 700, borderRadius: 2 }}
          >
            Recuperar
          </Button>
        </Box>
      </Paper>

      {/* Barra de búsqueda + exportar */}
      <Box sx={{ display: 'flex', gap: 1.5, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField
          size="small" placeholder="Buscar empresa, plan, TX, factura, CUFE..."
          value={search} onChange={e => setSearch(e.target.value)}
          InputProps={{ startAdornment: <InputAdornment position="start"><Search sx={{ fontSize: 18 }} /></InputAdornment> }}
          sx={{ flex: 1, minWidth: 260 }}
        />
        <Button startIcon={<Download />} onClick={exportar} sx={{ fontWeight: 700, borderRadius: 2, color: 'text.secondary' }}>
          Exportar CSV
        </Button>
      </Box>

      {/* Tabla */}
      {filtered.length > 0 ? (
        <Paper sx={{ borderRadius: 3, overflow: 'hidden' }}>
          <TableContainer sx={{ maxHeight: '60vh' }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  {['Fecha', 'Empresa', 'Plan', 'Monto', 'ID Wompi', 'Estado FE', 'N° Factura', 'CUFE', 'PDF', 'Acción'].map(h => (
                    <TableCell key={h} sx={{ fontWeight: 800, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4, bgcolor: 'action.hover' }}>
                      {h}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {filtered.map(p => (
                  <TableRow key={p.id} hover sx={{ '& td': { py: 1.2 } }}>
                    <TableCell>
                      <Typography sx={{ fontSize: 12, fontWeight: 600 }}>{fmtDate(p.fecha_pago)}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography sx={{ fontSize: 12, fontWeight: 700 }}>{p.empresa_nombre}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography sx={{ fontSize: 12 }}>{p.plan_nombre}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography sx={{ fontSize: 13, fontWeight: 800, color: GREEN }}>{fmt(p.monto)}</Typography>
                    </TableCell>
                    <TableCell sx={{ maxWidth: 130 }}>
                      <CopyText value={p.bold_tx_id} />
                    </TableCell>
                    <TableCell>
                      <FeChip estado={p.estado_fe} />
                    </TableCell>
                    <TableCell>
                      <Typography sx={{ fontSize: 12, fontFamily: 'monospace', fontWeight: 600 }}>
                        {p.numero_factura_ksmart || '—'}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ maxWidth: 130 }}>
                      <CopyText value={p.cufe_fe} />
                    </TableCell>
                    <TableCell>
                      {p.pdf_url_fe ? (
                        <Tooltip title="Ver PDF">
                          <IconButton size="small" component="a" href={p.pdf_url_fe} target="_blank" rel="noopener noreferrer"
                            sx={{ color: BLUE }}>
                            <PictureAsPdf fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      ) : <Typography sx={{ fontSize: 11, color: 'text.disabled' }}>—</Typography>}
                    </TableCell>
                    <TableCell>
                      {(p.estado_fe === 'fallido' || p.estado_fe === 'no_configurado') && (
                        <Tooltip title="Reintentar emisión FE">
                          <IconButton
                            size="small"
                            disabled={retryingId === p.id}
                            onClick={() => reintentar(p)}
                            sx={{ color: ORANGE }}
                          >
                            {retryingId === p.id
                              ? <CircularProgress size={16} sx={{ color: ORANGE }} />
                              : <Replay fontSize="small" />}
                          </IconButton>
                        </Tooltip>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      ) : (
        <Paper sx={{ p: 6, textAlign: 'center', borderRadius: 3 }}>
          <ReceiptLong sx={{ fontSize: 48, color: 'action.disabled', mb: 1 }} />
          <Typography color="text.secondary">
            {search ? 'Sin resultados para esa búsqueda.' : 'No hay registros de pagos aún.'}
          </Typography>
        </Paper>
      )}
    </Box>
  );
}
