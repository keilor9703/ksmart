import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Grid, Button, Divider,
  TextField, Chip, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, CircularProgress,
  Dialog, DialogTitle, DialogContent, DialogActions,
  IconButton, Alert
} from '@mui/material';
import {
  PointOfSale, CheckCircle, Close,
  TrendingUp, AttachMoney, CreditCard, AccountBalance,
  MoreHoriz, Refresh
} from '@mui/icons-material';
import { toast } from 'react-toastify';
import apiClient from '../api';
import { formatCurrency } from '../utils/formatters';
import CurrencyField from './CurrencyField';

const ACCENT = '#FF6020';
const GREEN  = '#10B981';
const RED    = '#EF4444';
const BLUE   = '#3B82F6';
const YELLOW = '#F59E0B';

const KpiCard = ({ label, value, icon, color, sub }) => (
  <Paper sx={{ p: 2, borderRadius: 3, display: 'flex', alignItems: 'center', gap: 1.5, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
    <Box sx={{ width: 42, height: 42, borderRadius: 2, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: `${color}18`, color }}>
      {icon}
    </Box>
    <Box sx={{ minWidth: 0 }}>
      <Typography sx={{ fontSize: 11, color: 'text.secondary', fontWeight: 500 }}>{label}</Typography>
      <Typography sx={{ fontSize: 17, fontWeight: 800, lineHeight: 1.2 }}>{value}</Typography>
      {sub && <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>{sub}</Typography>}
    </Box>
  </Paper>
);

const MetodoRow = ({ icon, label, value, color }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1.2, borderBottom: '1px solid', borderColor: 'divider' }}>
    <Box sx={{ width: 30, height: 30, borderRadius: 1.5, bgcolor: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', color, flexShrink: 0 }}>
      {icon}
    </Box>
    <Typography sx={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{label}</Typography>
    <Typography sx={{ fontSize: 14, fontWeight: 700, color }}>{formatCurrency(value)}</Typography>
  </Box>
);

export default function Caja() {
  const [preview, setPreview]                   = useState(null);
  const [historial, setHistorial]               = useState([]);
  const [loadingPreview, setLoadingPreview]     = useState(true);
  const [loadingHistorial, setLoadingHistorial] = useState(true);
  const [openDialog, setOpenDialog]             = useState(false);
  const [efectivoFisico, setEfectivoFisico]     = useState(0);
  const [observaciones, setObservaciones]       = useState('');
  const [submitting, setSubmitting]             = useState(false);

  useEffect(() => { fetchPreview(); fetchHistorial(); }, []);

  const fetchPreview = async () => {
    setLoadingPreview(true);
    try {
      const { data } = await apiClient.get('/caja/corte/preview');
      setPreview(data);
    } catch { toast.error('Error al cargar el resumen del día'); }
    finally { setLoadingPreview(false); }
  };

  const fetchHistorial = async () => {
    setLoadingHistorial(true);
    try {
      const { data } = await apiClient.get('/caja/cortes');
      setHistorial(data);
    } catch { /* silencioso */ }
    finally { setLoadingHistorial(false); }
  };

  const handleCerrarCaja = async () => {
    setSubmitting(true);
    try {
      await apiClient.post('/caja/corte', { efectivo_fisico: efectivoFisico, observaciones });
      toast.success('¡Caja cerrada exitosamente!');
      setOpenDialog(false);
      setEfectivoFisico(0);
      setObservaciones('');
      fetchPreview();
      fetchHistorial();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al cerrar la caja');
    } finally { setSubmitting(false); }
  };

  const diferencia = efectivoFisico - (preview?.efectivo || 0);

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2.5, flexWrap: 'wrap', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ width: 42, height: 42, borderRadius: 2, bgcolor: `${ACCENT}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: ACCENT }}>
            <PointOfSale />
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 700, fontSize: 20, lineHeight: 1.2 }}>Caja</Typography>
            <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>Corte diario y arqueo de efectivo</Typography>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="outlined" startIcon={<Refresh />} onClick={fetchPreview} size="small"
            sx={{ borderRadius: 2, fontWeight: 600, borderColor: 'divider', color: 'text.secondary' }}>
            Actualizar
          </Button>
          <Button variant="contained" startIcon={<PointOfSale />} onClick={() => setOpenDialog(true)} size="small"
            sx={{ background: `linear-gradient(135deg, ${ACCENT}, #ff9a62)`, boxShadow: `0 4px 14px rgba(255,96,32,0.3)`, borderRadius: 2, fontWeight: 600 }}>
            Cerrar Caja
          </Button>
        </Box>
      </Box>

      {loadingPreview ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress sx={{ color: ACCENT }} />
        </Box>
      ) : preview && (
        <>
          <Grid container spacing={1.5} sx={{ mb: 2 }}>
            <Grid item xs={6} sm={3}>
              <KpiCard label="Total del día" value={formatCurrency(preview.total_dia)} icon={<TrendingUp />} color={ACCENT} sub={preview.fecha} />
            </Grid>
            <Grid item xs={6} sm={3}>
              <KpiCard label="Efectivo" value={formatCurrency(preview.efectivo)} icon={<AttachMoney />} color={GREEN} />
            </Grid>
            <Grid item xs={6} sm={3}>
              <KpiCard label="Transferencias" value={formatCurrency(preview.transferencia)} icon={<AccountBalance />} color={BLUE} />
            </Grid>
            <Grid item xs={6} sm={3}>
              <KpiCard label="Tarjeta / Otros" value={formatCurrency((preview.tarjeta || 0) + (preview.otros || 0))} icon={<CreditCard />} color={YELLOW} />
            </Grid>
          </Grid>

          <Paper sx={{ p: 2.5, borderRadius: 3, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', mb: 2 }}>
            <Typography sx={{ fontWeight: 700, fontSize: 14, mb: 1.5 }}>Desglose por método — hoy</Typography>
            <MetodoRow icon={<AttachMoney sx={{ fontSize: 16 }} />}  label="Efectivo"       value={preview.efectivo}     color={GREEN}  />
            <MetodoRow icon={<AccountBalance sx={{ fontSize: 16 }} />} label="Transferencia" value={preview.transferencia} color={BLUE}   />
            <MetodoRow icon={<CreditCard sx={{ fontSize: 16 }} />}   label="Tarjeta"        value={preview.tarjeta}      color={YELLOW} />
            <MetodoRow icon={<MoreHoriz sx={{ fontSize: 16 }} />}    label="Otros"          value={preview.otros}        color="#8B5CF6" />
            <Box sx={{ display: 'flex', justifyContent: 'space-between', pt: 1.5 }}>
              <Typography sx={{ fontWeight: 700, fontSize: 14 }}>Total</Typography>
              <Typography sx={{ fontWeight: 800, fontSize: 16, color: ACCENT }}>{formatCurrency(preview.total_dia)}</Typography>
            </Box>

            {/* Desglose por origen */}
            {(preview.ventas_contado > 0 || preview.abonos_cartera > 0) && (
              <Box sx={{ mt: 2, pt: 1.5, borderTop: '1px dashed', borderColor: 'divider' }}>
                <Typography sx={{ fontSize: 11, fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.6, mb: 1 }}>
                  Por origen
                </Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Box sx={{ flex: 1, p: 1.2, borderRadius: 2, bgcolor: `${GREEN}08`, border: `1px solid ${GREEN}20`, textAlign: 'center' }}>
                    <Typography sx={{ fontSize: 10, color: 'text.secondary', mb: 0.3 }}>
                      Ventas al contado ({preview.num_ventas || 0})
                    </Typography>
                    <Typography sx={{ fontSize: 13, fontWeight: 700, color: GREEN }}>{formatCurrency(preview.ventas_contado || 0)}</Typography>
                  </Box>
                  <Box sx={{ flex: 1, p: 1.2, borderRadius: 2, bgcolor: `${BLUE}08`, border: `1px solid ${BLUE}20`, textAlign: 'center' }}>
                    <Typography sx={{ fontSize: 10, color: 'text.secondary', mb: 0.3 }}>
                      Abonos cartera ({preview.num_abonos || 0})
                    </Typography>
                    <Typography sx={{ fontSize: 13, fontWeight: 700, color: BLUE }}>{formatCurrency(preview.abonos_cartera || 0)}</Typography>
                  </Box>
                </Box>
              </Box>
            )}
          </Paper>
        </>
      )}

      {/* Historial */}
      <Paper sx={{ p: 2.5, borderRadius: 3, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
        <Typography sx={{ fontWeight: 700, fontSize: 14, mb: 1.5 }}>Historial de cortes</Typography>
        {loadingHistorial ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}><CircularProgress size={24} sx={{ color: ACCENT }} /></Box>
        ) : historial.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
            <PointOfSale sx={{ fontSize: 40, opacity: 0.2, mb: 1 }} />
            <Typography fontSize={13}>No hay cortes registrados</Typography>
          </Box>
        ) : (
          <TableContainer sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider', overflowX: 'auto' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  {['Fecha', 'Total día', 'Efectivo sistema', 'Efectivo físico', 'Diferencia', 'Estado'].map(h => (
                    <TableCell key={h} sx={{ fontSize: 11 }}>{h}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {historial.map(c => {
                  const dif = c.diferencia;
                  const difColor = dif === 0 ? 'text.primary' : dif > 0 ? BLUE : RED;
                  return (
                    <TableRow key={c.id} hover>
                      <TableCell sx={{ fontSize: 11, whiteSpace: 'nowrap' }}>
                        {new Date(c.fecha).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>{formatCurrency(c.total_ventas_dia)}</TableCell>
                      <TableCell sx={{ color: GREEN, fontWeight: 600 }}>{formatCurrency(c.total_efectivo_ventas)}</TableCell>
                      <TableCell>{formatCurrency(c.efectivo_fisico)}</TableCell>
                      <TableCell sx={{ fontWeight: 700, color: difColor }}>
                        {dif === 0 ? '—' : dif > 0 ? `+${formatCurrency(dif)}` : formatCurrency(dif)}
                      </TableCell>
                      <TableCell>
                        <Chip label={c.estado} size="small"
                          sx={{ bgcolor: c.estado === 'cerrado' ? `${GREEN}15` : `${YELLOW}15`, color: c.estado === 'cerrado' ? GREEN : YELLOW, fontWeight: 600, fontSize: 10, borderRadius: 1.5 }} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {/* Dialog cierre */}
      <Dialog open={openDialog} onClose={() => !submitting && setOpenDialog(false)} maxWidth="xs" fullWidth
        PaperProps={{ sx: { borderRadius: 3, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' } }}>
        <Box sx={{ height: 4, bgcolor: ACCENT }} />
        <DialogTitle sx={{ pb: 1, pt: 2.5, pr: 6 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{ width: 38, height: 38, borderRadius: 2, bgcolor: `${ACCENT}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: ACCENT }}>
              <PointOfSale />
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 700, fontSize: 15 }}>Cerrar Caja</Typography>
              <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{preview?.fecha}</Typography>
            </Box>
          </Box>
          <IconButton size="small" onClick={() => setOpenDialog(false)} disabled={submitting}
            sx={{ position: 'absolute', right: 12, top: 16, color: 'text.secondary' }}>
            <Close fontSize="small" />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ pt: 1 }}>
          <Paper sx={{ p: 1.5, mb: 2, borderRadius: 2, bgcolor: 'action.hover', boxShadow: 'none', border: 'none' }}>
            <Typography sx={{ fontSize: 11, fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.6, mb: 1 }}>
              Resumen del sistema
            </Typography>
            {[
              { label: 'Efectivo',        val: preview?.efectivo,      color: GREEN  },
              { label: 'Transferencias',  val: preview?.transferencia, color: BLUE   },
              { label: 'Tarjeta / Otros', val: (preview?.tarjeta || 0) + (preview?.otros || 0), color: YELLOW },
            ].map(({ label, val, color }) => (
              <Box key={label} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.4 }}>
                <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{label}</Typography>
                <Typography sx={{ fontSize: 12, fontWeight: 600, color }}>{formatCurrency(val || 0)}</Typography>
              </Box>
            ))}
            <Divider sx={{ my: 0.8 }} />
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography sx={{ fontSize: 13, fontWeight: 700 }}>Total del día</Typography>
              <Typography sx={{ fontSize: 13, fontWeight: 800, color: ACCENT }}>{formatCurrency(preview?.total_dia || 0)}</Typography>
            </Box>
            {/* Origen del dinero */}
            <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
              <Box sx={{ flex: 1, p: 1, borderRadius: 1.5, bgcolor: `${GREEN}08`, textAlign: 'center' }}>
                <Typography sx={{ fontSize: 9, color: 'text.secondary' }}>Ventas contado</Typography>
                <Typography sx={{ fontSize: 12, fontWeight: 700, color: GREEN }}>{formatCurrency(preview?.ventas_contado || 0)}</Typography>
              </Box>
              <Box sx={{ flex: 1, p: 1, borderRadius: 1.5, bgcolor: `${BLUE}08`, textAlign: 'center' }}>
                <Typography sx={{ fontSize: 9, color: 'text.secondary' }}>Abonos cartera</Typography>
                <Typography sx={{ fontSize: 12, fontWeight: 700, color: BLUE }}>{formatCurrency(preview?.abonos_cartera || 0)}</Typography>
              </Box>
            </Box>
          </Paper>

          <Divider sx={{ mb: 2 }} />

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <CurrencyField
              label="Efectivo físico contado"
              value={efectivoFisico}
              onChange={setEfectivoFisico}
              helperText="Cuenta el dinero en caja y digita el total"
            />
            {efectivoFisico > 0 && (
              <Alert severity={diferencia === 0 ? 'success' : diferencia > 0 ? 'info' : 'error'}
                sx={{ borderRadius: 2, fontSize: 13 }}>
                {diferencia === 0 ? '✓ Cuadre exacto' :
                 diferencia > 0 ? `Sobrante: ${formatCurrency(Math.abs(diferencia))}` :
                 `Faltante: ${formatCurrency(Math.abs(diferencia))}`}
              </Alert>
            )}
            <TextField fullWidth size="small" multiline rows={2}
              label="Observaciones (opcional)"
              value={observaciones}
              onChange={e => setObservaciones(e.target.value)}
              placeholder="Ej: Faltante por vuelto en efectivo..."
            />
          </Box>
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2.5, pt: 1, gap: 1 }}>
          <Button onClick={() => setOpenDialog(false)} disabled={submitting} variant="outlined" size="small"
            sx={{ borderRadius: 2, fontWeight: 600, borderColor: 'divider', color: 'text.secondary', flex: 1 }}>
            Cancelar
          </Button>
          <Button onClick={handleCerrarCaja} disabled={submitting} variant="contained" size="small"
            startIcon={submitting ? <CircularProgress size={14} color="inherit" /> : <CheckCircle sx={{ fontSize: 16 }} />}
            sx={{ borderRadius: 2, fontWeight: 600, flex: 1, background: `linear-gradient(135deg, ${ACCENT}, #ff9a62)`, boxShadow: `0 4px 14px rgba(255,96,32,0.3)`, color: '#fff' }}>
            {submitting ? 'Cerrando…' : 'Confirmar cierre'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
