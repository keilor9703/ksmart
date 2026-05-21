import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog, DialogContent, DialogTitle, Box, Typography, IconButton,
  Button, CircularProgress, Divider, Chip, TextField, Stack,
  InputAdornment, Tooltip, Alert,
} from '@mui/material';
import {
  Close, WhatsApp, Search, NotificationsActive, CheckCircle, Schedule,
} from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';
import { toast } from 'react-toastify';
import apiClient from '../../api';

const DIAS_ANTICIPACION = 3; // Cuotas que vencen en los próximos N días

function buildWhatsAppText(cuota, empresa) {
  const fechaVencimiento = cuota.fecha_vencimiento
    ? new Date(cuota.fecha_vencimiento).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })
    : 'próximamente';
  const monto = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(cuota.valor_cuota || 0);
  const mora = cuota.valor_mora > 0
    ? `\n⚠️ *Mora acumulada:* ${new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(cuota.valor_mora)}`
    : '';

  return `Hola ${cuota.cliente_nombre}, le saluda *${empresa?.nombre || 'su acreedor'}*.

Le recordamos que tiene una cuota próxima a vencer:

📅 *Fecha de vencimiento:* ${fechaVencimiento}
💰 *Valor de la cuota:* ${monto}${mora}

Por favor, comuníquese con nosotros para coordinar el pago.

¡Gracias por su puntualidad! 🙏`;
}

function CuotaRow({ cuota, empresa, sentIds, onMarkSent }) {
  const theme = useTheme();
  const alreadySent = sentIds.has(cuota.id);
  const diasRestantes = cuota.dias_para_vencer ?? 0;
  const esVencida = diasRestantes < 0;
  const esCritica = diasRestantes <= 1 && !esVencida;

  const colorChip = esVencida ? 'error' : esCritica ? 'warning' : 'info';
  const labelChip = esVencida
    ? `Vencida hace ${Math.abs(diasRestantes)} día(s)`
    : diasRestantes === 0
    ? 'Vence hoy'
    : `${diasRestantes} día(s)`;

  const handleSend = () => {
    const text = buildWhatsAppText(cuota, empresa);
    const telefono = (cuota.cliente_telefono || '').replace(/\D/g, '');
    const numero = telefono.startsWith('57') ? telefono : `57${telefono}`;
    window.open(`https://wa.me/${numero}?text=${encodeURIComponent(text)}`, '_blank');
    onMarkSent(cuota.id);
  };

  return (
    <Box sx={{
      display: 'flex', alignItems: 'center', gap: 1.5,
      p: 1.5, borderRadius: 2,
      border: `1px solid ${alreadySent ? 'rgba(16,185,129,0.3)' : theme.palette.divider}`,
      bgcolor: alreadySent ? 'rgba(16,185,129,0.04)' : 'background.default',
      transition: 'all 0.2s ease',
    }}>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body2" fontWeight={700} noWrap>
          {cuota.cliente_nombre}
        </Typography>
        <Typography variant="caption" color="text.secondary" noWrap>
          {cuota.cliente_telefono || 'Sin teléfono'} · Cuota #{cuota.numero_cuota}
        </Typography>
        <Box sx={{ mt: 0.5 }}>
          <Chip label={labelChip} color={colorChip} size="small" sx={{ fontSize: 10, height: 20 }} />
        </Box>
      </Box>
      <Box sx={{ textAlign: 'right', minWidth: 80 }}>
        <Typography variant="body2" fontWeight={700} color={esVencida ? 'error.main' : 'text.primary'}>
          {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(cuota.valor_cuota || 0)}
        </Typography>
        {cuota.valor_mora > 0 && (
          <Typography variant="caption" color="error.main">
            +{new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(cuota.valor_mora)} mora
          </Typography>
        )}
      </Box>
      <Tooltip title={!cuota.cliente_telefono ? 'Sin teléfono registrado' : alreadySent ? 'Recordatorio enviado' : 'Enviar recordatorio por WhatsApp'}>
        <span>
          <IconButton
            size="small"
            onClick={handleSend}
            disabled={!cuota.cliente_telefono}
            sx={{
              color: alreadySent ? '#10B981' : '#25D366',
              bgcolor: alreadySent ? 'rgba(16,185,129,0.1)' : 'rgba(37,211,102,0.1)',
              '&:hover': { bgcolor: 'rgba(37,211,102,0.2)' },
              '&:disabled': { opacity: 0.35 },
            }}
          >
            {alreadySent ? <CheckCircle fontSize="small" /> : <WhatsApp fontSize="small" />}
          </IconButton>
        </span>
      </Tooltip>
    </Box>
  );
}

export default function RecordatoriosCuotasDialog({ open, onClose, empresa }) {
  const [cuotas, setCuotas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [sentIds, setSentIds] = useState(new Set());
  const [diasFiltro, setDiasFiltro] = useState(DIAS_ANTICIPACION);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await apiClient.get('/prestamos/cuotas-pendientes');
      // Filtrar cuotas próximas a vencer o ya vencidas
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);
      const filtradas = data
        .map(c => {
          const fechaVenc = c.fecha_vencimiento ? new Date(c.fecha_vencimiento) : null;
          const diasRestantes = fechaVenc
            ? Math.ceil((fechaVenc.getTime() - hoy.getTime()) / 86400000)
            : 999;
          return { ...c, dias_para_vencer: diasRestantes };
        })
        .filter(c => c.dias_para_vencer <= diasFiltro)
        .sort((a, b) => a.dias_para_vencer - b.dias_para_vencer);
      setCuotas(filtradas);
    } catch {
      toast.error('No se pudo cargar la lista de cuotas.');
    } finally {
      setLoading(false);
    }
  }, [diasFiltro]);

  useEffect(() => {
    if (open) { load(); setSentIds(new Set()); }
  }, [open, load]);

  const handleMarkSent = (id) => setSentIds(prev => new Set([...prev, id]));

  const handleSendAll = () => {
    const pendientes = cuotasFiltradas.filter(c => !sentIds.has(c.id) && c.cliente_telefono);
    if (pendientes.length === 0) {
      toast.info('Todos los recordatorios ya fueron enviados.');
      return;
    }
    pendientes.forEach((cuota, idx) => {
      setTimeout(() => {
        const text = buildWhatsAppText(cuota, empresa);
        const telefono = (cuota.cliente_telefono || '').replace(/\D/g, '');
        const numero = telefono.startsWith('57') ? telefono : `57${telefono}`;
        window.open(`https://wa.me/${numero}?text=${encodeURIComponent(text)}`, '_blank');
        handleMarkSent(cuota.id);
      }, idx * 800); // espaciado para evitar bloqueo de pop-ups
    });
  };

  const cuotasFiltradas = cuotas.filter(c =>
    !search || c.cliente_nombre?.toLowerCase().includes(search.toLowerCase())
  );
  const pendienteCount = cuotasFiltradas.filter(c => !sentIds.has(c.id) && c.cliente_telefono).length;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5, pr: 6 }}>
        <Box sx={{ bgcolor: 'rgba(37,211,102,0.12)', borderRadius: '50%', p: 0.8, display: 'flex' }}>
          <NotificationsActive sx={{ color: '#25D366', fontSize: 22 }} />
        </Box>
        <Box>
          <Typography variant="subtitle1" fontWeight={700} lineHeight={1.2}>
            Recordatorios de cuotas
          </Typography>
          <Typography variant="caption" color="text.secondary">
            WhatsApp · Próximos {diasFiltro} días y vencidas
          </Typography>
        </Box>
      </DialogTitle>
      <IconButton onClick={onClose} sx={{ position: 'absolute', right: 12, top: 12, color: 'text.secondary' }}>
        <Close />
      </IconButton>

      <Divider />

      <DialogContent sx={{ pt: 2, pb: 3 }}>
        {/* Filtros */}
        <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
          <TextField
            size="small" placeholder="Buscar cliente..."
            value={search} onChange={e => setSearch(e.target.value)}
            sx={{ flex: 1 }}
            InputProps={{ startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment> }}
          />
          <Stack direction="row" spacing={0.5}>
            {[1, 3, 7].map(d => (
              <Chip
                key={d} label={`${d}d`}
                onClick={() => setDiasFiltro(d)}
                color={diasFiltro === d ? 'primary' : 'default'}
                size="small"
                sx={{ cursor: 'pointer', fontWeight: 600 }}
              />
            ))}
          </Stack>
        </Stack>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={28} />
          </Box>
        ) : cuotasFiltradas.length === 0 ? (
          <Alert severity="success" icon={<CheckCircle />}>
            {search ? 'No hay resultados para esa búsqueda.' : `No hay cuotas vencidas ni que venzan en los próximos ${diasFiltro} día(s). ¡Todo al día!`}
          </Alert>
        ) : (
          <>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 1.5, display: 'block' }}>
              {cuotasFiltradas.length} cuota(s) · {sentIds.size} recordatorio(s) enviado(s)
            </Typography>
            <Stack spacing={1}>
              {cuotasFiltradas.map(c => (
                <CuotaRow
                  key={c.id}
                  cuota={c}
                  empresa={empresa}
                  sentIds={sentIds}
                  onMarkSent={handleMarkSent}
                />
              ))}
            </Stack>
          </>
        )}

        {cuotasFiltradas.length > 0 && (
          <Button
            variant="contained"
            fullWidth
            startIcon={<WhatsApp />}
            onClick={handleSendAll}
            disabled={pendienteCount === 0}
            sx={{
              mt: 2.5, borderRadius: 2, fontWeight: 700,
              bgcolor: '#25D366', '&:hover': { bgcolor: '#1ebe5b' },
              '&:disabled': { bgcolor: 'action.disabledBackground' },
            }}
          >
            {pendienteCount > 0
              ? `Enviar ${pendienteCount} recordatorio(s) pendiente(s)`
              : '✓ Todos enviados'}
          </Button>
        )}

        <Typography variant="caption" color="text.secondary" sx={{ mt: 1.5, display: 'block', textAlign: 'center' }}>
          Se abrirá WhatsApp para cada cliente. El navegador puede bloquear múltiples ventanas — permítelo si es necesario.
        </Typography>
      </DialogContent>
    </Dialog>
  );
}
