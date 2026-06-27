import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Paper, Button, CircularProgress, Chip, Divider,
  Stack, TextField, useTheme, alpha, IconButton, Tooltip, Alert,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material';
import {
  Receipt, CheckCircle, ErrorOutline, PictureAsPdf, Refresh,
  ContentCopy, EventAvailable, Bolt, History, Warning,
} from '@mui/icons-material';
import { toast } from 'react-toastify';
import apiClient from '../../api';

const ACCENT = '#0891B2';

const fmt = (n) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n || 0);
const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const fmtDateTime = (iso) => iso ? new Date(iso).toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';
const toIso = (d) => d.toISOString().split('T')[0];
const copy = (t) => navigator.clipboard?.writeText(t).then(() => toast.success('Copiado'));

function ChipFE({ estado }) {
  if (estado === 'exitoso') return <Chip size="small" color="success" icon={<CheckCircle sx={{ fontSize: '14px !important' }} />} label="Emitida" />;
  if (estado === 'fallido') return <Chip size="small" color="error" icon={<ErrorOutline sx={{ fontSize: '14px !important' }} />} label="Fallida" />;
  return <Chip size="small" label="—" sx={{ bgcolor: 'rgba(0,0,0,0.06)' }} />;
}

export default function ParqueaderoCierreFE({ user }) {
  const theme = useTheme();
  const feActiva = user?.empresa?.facturacion_electronica_activa;

  const [fecha, setFecha] = useState(toIso(new Date()));
  const [preview, setPreview] = useState(null);
  const [loadingPrev, setLoadingPrev] = useState(false);
  const [cierres, setCierres] = useState([]);
  const [loadingHist, setLoadingHist] = useState(false);
  const [emitiendo, setEmitiendo] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const cargarPreview = useCallback(async () => {
    setLoadingPrev(true);
    try {
      const r = await apiClient.get('/parqueadero/cierre-fe/preview', { params: { fecha } });
      setPreview(r.data);
    } catch {
      toast.error('Error al cargar el resumen del día');
    } finally {
      setLoadingPrev(false);
    }
  }, [fecha]);

  const cargarHistorial = useCallback(async () => {
    setLoadingHist(true);
    try {
      const r = await apiClient.get('/parqueadero/cierres-fe');
      setCierres(r.data);
    } catch {
      /* silent */
    } finally {
      setLoadingHist(false);
    }
  }, []);

  useEffect(() => { cargarPreview(); }, [cargarPreview]);
  useEffect(() => { cargarHistorial(); }, [cargarHistorial]);

  const ejecutarCierre = async () => {
    setConfirmOpen(false);
    setEmitiendo(true);
    try {
      const r = await apiClient.post('/parqueadero/cierre-fe', null, { params: { fecha } });
      if (r.data.estado === 'exitoso') {
        toast.success(`FE consolidada emitida: ${r.data.numero_factura}`);
      } else {
        toast.warning(`La FE quedó como ${r.data.estado}. Revisa el historial.`);
      }
      cargarPreview();
      cargarHistorial();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'No se pudo emitir la FE consolidada');
    } finally {
      setEmitiendo(false);
    }
  };

  if (!feActiva) {
    return (
      <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 760, mx: 'auto' }}>
        <Alert severity="info" sx={{ borderRadius: 3 }}>
          La facturación electrónica no está activa para esta empresa. Actívala en
          <strong> Facturación Electrónica → Configuración</strong> para usar el cierre de caja FE.
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 880, mx: 'auto' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
        <Box sx={{ p: 1, borderRadius: 2, bgcolor: alpha(ACCENT, 0.12), display: 'flex' }}>
          <Receipt sx={{ color: ACCENT, fontSize: 26 }} />
        </Box>
        <Box>
          <Typography variant="h6" fontWeight={800} lineHeight={1.1}>Cierre de Caja — FE</Typography>
          <Typography fontSize={12.5} color="text.secondary">
            Factura electrónica consolidada de los accesos por horas (modelo POS DIAN)
          </Typography>
        </Box>
      </Box>

      <Alert severity="info" icon={<Bolt />} sx={{ borderRadius: 2, mb: 2.5, fontSize: 12.5 }}>
        Los cobros por horas a clientes ocasionales se consolidan en <strong>una sola factura
        electrónica diaria</strong> a nombre de Consumidor Final. Las suscripciones se facturan
        de forma individual automáticamente.
      </Alert>

      {/* Selector de día + resumen */}
      <Paper elevation={0} sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 3, border: `1.5px solid ${alpha(ACCENT, 0.25)}`, mb: 3 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }} justifyContent="space-between">
          <TextField
            label="Día a facturar"
            type="date"
            size="small"
            value={fecha}
            onChange={e => setFecha(e.target.value)}
            InputLabelProps={{ shrink: true }}
            InputProps={{ startAdornment: <EventAvailable sx={{ fontSize: 18, color: 'text.disabled', mr: 1 }} /> }}
            sx={{ minWidth: 190 }}
          />
          <IconButton onClick={cargarPreview} disabled={loadingPrev} sx={{ alignSelf: { xs: 'flex-end', sm: 'center' } }}>
            {loadingPrev ? <CircularProgress size={18} /> : <Refresh />}
          </IconButton>
        </Stack>

        <Divider sx={{ my: 2 }} />

        {loadingPrev ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}><CircularProgress sx={{ color: ACCENT }} size={28} /></Box>
        ) : preview && preview.num_accesos > 0 ? (
          <>
            <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
              <Box sx={{ flex: 1, textAlign: 'center', p: 1.5, borderRadius: 2, bgcolor: alpha(ACCENT, 0.06) }}>
                <Typography fontSize={11} color="text.secondary" fontWeight={600}>ACCESOS PENDIENTES</Typography>
                <Typography fontSize={26} fontWeight={900} color={ACCENT}>{preview.num_accesos}</Typography>
              </Box>
              <Box sx={{ flex: 1, textAlign: 'center', p: 1.5, borderRadius: 2, bgcolor: alpha('#059669', 0.06) }}>
                <Typography fontSize={11} color="text.secondary" fontWeight={600}>TOTAL A FACTURAR</Typography>
                <Typography fontSize={26} fontWeight={900} color="#059669">{fmt(preview.total)}</Typography>
              </Box>
            </Stack>
            <Button
              fullWidth variant="contained" size="large"
              disabled={emitiendo}
              startIcon={emitiendo ? <CircularProgress size={18} color="inherit" /> : <Receipt />}
              onClick={() => setConfirmOpen(true)}
              sx={{ bgcolor: ACCENT, '&:hover': { bgcolor: '#E8531A' }, fontWeight: 800, borderRadius: 2.5, py: 1.2 }}
            >
              Emitir FE consolidada del día
            </Button>
          </>
        ) : (
          <Box sx={{ textAlign: 'center', py: 3 }}>
            <CheckCircle sx={{ fontSize: 44, color: alpha('#059669', 0.5), mb: 1 }} />
            <Typography fontWeight={700} fontSize={15}>Todo facturado</Typography>
            <Typography fontSize={13} color="text.secondary">
              No hay accesos por horas pendientes de facturar para este día.
            </Typography>
          </Box>
        )}
      </Paper>

      {/* Historial de cierres */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
        <History sx={{ fontSize: 20, color: 'text.secondary' }} />
        <Typography fontWeight={800} fontSize={15}>Historial de cierres</Typography>
      </Box>

      {loadingHist ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress sx={{ color: ACCENT }} size={26} /></Box>
      ) : cierres.length === 0 ? (
        <Paper elevation={0} sx={{ p: 4, textAlign: 'center', border: '1px dashed', borderColor: 'divider', borderRadius: 3 }}>
          <Typography color="text.secondary" fontSize={13}>Aún no has emitido cierres consolidados.</Typography>
        </Paper>
      ) : (
        <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3 }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: 'rgba(0,0,0,0.03)' }}>
                <TableCell sx={{ fontWeight: 700 }}>Fecha</TableCell>
                <TableCell sx={{ fontWeight: 700 }} align="right">Total</TableCell>
                <TableCell sx={{ fontWeight: 700 }} align="center">Estado</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>N° Factura</TableCell>
                <TableCell sx={{ fontWeight: 700 }} align="center">PDF</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {cierres.map(c => (
                <TableRow key={c.id} hover>
                  <TableCell sx={{ fontSize: 12.5, whiteSpace: 'nowrap' }}>{fmtDateTime(c.fecha)}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>{fmt(c.total)}</TableCell>
                  <TableCell align="center"><ChipFE estado={c.estado_fe} /></TableCell>
                  <TableCell sx={{ fontSize: 12.5 }}>
                    {c.numero_factura ? (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        {c.numero_factura}
                        <Tooltip title="Copiar"><IconButton size="small" onClick={() => copy(c.numero_factura)}><ContentCopy sx={{ fontSize: 13 }} /></IconButton></Tooltip>
                      </Box>
                    ) : '—'}
                  </TableCell>
                  <TableCell align="center">
                    {c.pdf_url ? (
                      <Tooltip title="Ver PDF">
                        <IconButton size="small" component="a" href={c.pdf_url} target="_blank" sx={{ color: '#3B82F6' }}>
                          <PictureAsPdf sx={{ fontSize: 17 }} />
                        </IconButton>
                      </Tooltip>
                    ) : '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Confirmación */}
      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)} PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, fontWeight: 800 }}>
          <Warning sx={{ color: ACCENT }} /> Confirmar cierre FE
        </DialogTitle>
        <DialogContent>
          <Typography fontSize={14}>
            Se emitirá <strong>una factura electrónica</strong> a Consumidor Final que consolida{' '}
            <strong>{preview?.num_accesos} accesos</strong> por un total de{' '}
            <strong>{fmt(preview?.total)}</strong> del día {fmtDate(fecha)}.
          </Typography>
          <Typography fontSize={12.5} color="text.secondary" mt={1.5}>
            Esta acción consume un consecutivo de tu resolución DIAN y no se puede deshacer.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setConfirmOpen(false)} sx={{ borderRadius: 2 }}>Cancelar</Button>
          <Button variant="contained" onClick={ejecutarCierre}
            sx={{ bgcolor: ACCENT, '&:hover': { bgcolor: '#E8531A' }, fontWeight: 700, borderRadius: 2 }}>
            Emitir factura
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
