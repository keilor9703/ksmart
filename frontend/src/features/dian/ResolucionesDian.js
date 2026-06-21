import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Paper, Typography, Button, TextField, MenuItem, Grid, Chip,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  IconButton, Dialog, DialogTitle, DialogContent, DialogActions,
  Alert, Tooltip, LinearProgress, Divider, useTheme, useMediaQuery,
  InputAdornment, Collapse, CircularProgress
} from '@mui/material';
import {
  VerifiedUser, Add, Edit, CheckCircle, RadioButtonUnchecked,
  Delete, Close, ContentCopy, FileCopy, Warning, Schedule,
  ExpandMore, ExpandLess, Tune, SaveAlt, InfoOutlined,
  CheckCircleOutline, ErrorOutline
} from '@mui/icons-material';
import apiClient from '../../api';
import { toast } from 'react-toastify';
import HelpGuideTopBar from '../../components/onboarding/HelpGuideTopBar';

const TEAL   = '#0D9488';
const AMBER  = '#F59E0B';
const GREEN  = '#10B981';
const RED    = '#EF4444';

/* ── helpers ─────────────────────────────────────────────────────────────── */
const parseUTC = (val) => {
  if (!val) return null;
  const s = typeof val === 'string' && !val.endsWith('Z') && !val.includes('+') ? val + 'Z' : val;
  return new Date(s);
};

const fmtDate = (val) => {
  const d = parseUTC(val);
  if (!d) return '—';
  return d.toLocaleDateString('es-CO', { timeZone: 'UTC', day: '2-digit', month: 'short', year: 'numeric' });
};

const progressColor = (pct) => {
  if (pct >= 80) return RED;
  if (pct >= 60) return AMBER;
  return TEAL;
};

const expiryColor = (days) => {
  if (days === null || days === undefined) return 'text.secondary';
  if (days < 0) return RED;
  if (days <= 30) return AMBER;
  return GREEN;
};

const expiryLabel = (days) => {
  if (days === null || days === undefined) return null;
  if (days < 0) return `Vencida hace ${Math.abs(days)}d`;
  if (days === 0) return 'Vence hoy';
  if (days <= 30) return `Vence en ${days}d`;
  return `${days}d`;
};

const copyToClipboard = (text) => {
  navigator.clipboard?.writeText(text).then(() => toast.success('Copiado al portapapeles'));
};

const EMPTY_FORM = {
  tipo: 'fe',
  prefijo: '', numero_resolucion: '',
  numero_inicial: 1, numero_final: 99999999,
  vigencia_desde: '', vigencia_hasta: '',
  clave_tecnica: '', nota: '',
};

/* ── ProgressBar 3-tier ─────────────────────────────────────────────────── */
const UsageBar = ({ pct }) => (
  <Box>
    <LinearProgress
      variant="determinate"
      value={Math.min(pct || 0, 100)}
      sx={{
        height: 7, borderRadius: 4, bgcolor: '#e2e8f0',
        '& .MuiLinearProgress-bar': {
          bgcolor: progressColor(pct || 0),
          transition: 'width 0.6s ease',
        },
      }}
    />
    <Typography sx={{ fontSize: 10, color: progressColor(pct || 0), mt: 0.4, fontWeight: 600 }}>
      {pct || 0}% usado
    </Typography>
  </Box>
);

/* ── ExpiryChip ─────────────────────────────────────────────────────────── */
const ExpiryChip = ({ days, size = 'small' }) => {
  const label = expiryLabel(days);
  if (!label) return null;
  const color = expiryColor(days);
  const Icon = days < 0 ? ErrorOutline : days <= 30 ? Warning : CheckCircleOutline;
  return (
    <Chip
      icon={<Icon sx={{ fontSize: 13 }} />}
      label={label}
      size={size}
      sx={{
        fontWeight: 700, fontSize: 11,
        bgcolor: `${color}18`, color,
        border: `1px solid ${color}40`,
        '& .MuiChip-icon': { color },
      }}
    />
  );
};

/* ── Confirm Dialog ─────────────────────────────────────────────────────── */
const ConfirmDialog = ({ open, title, message, onConfirm, onCancel, confirmColor = RED, confirmLabel = 'Eliminar', loading }) => (
  <Dialog open={open} onClose={onCancel} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
    <Box sx={{ height: 4, bgcolor: confirmColor }} />
    <DialogTitle sx={{ fontWeight: 700, fontSize: 16, pt: 2.5 }}>{title}</DialogTitle>
    <DialogContent>
      <Typography sx={{ color: 'text.secondary', fontSize: 14 }}>{message}</Typography>
    </DialogContent>
    <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
      <Button onClick={onCancel} variant="outlined" sx={{ borderRadius: 2, fontWeight: 600, borderColor: 'divider' }}>
        Cancelar
      </Button>
      <Button
        onClick={onConfirm} variant="contained" disabled={loading}
        sx={{ bgcolor: confirmColor, '&:hover': { filter: 'brightness(0.9)' }, borderRadius: 2, fontWeight: 700 }}
      >
        {loading ? <CircularProgress size={18} sx={{ color: '#fff' }} /> : confirmLabel}
      </Button>
    </DialogActions>
  </Dialog>
);

/* ── Mobile card ─────────────────────────────────────────────────────────── */
const ResolucionCard = ({ r, onActivar, onEdit, onDuplicate, onEliminar, onAjustar }) => (
  <Paper sx={{
    p: 2.5, mb: 2, borderRadius: 3,
    boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
    border: r.is_active ? `2px solid ${GREEN}40` : '1px solid',
    borderColor: r.is_active ? `${GREEN}40` : 'divider',
    transition: 'box-shadow 0.2s',
    '&:hover': { boxShadow: '0 4px 20px rgba(0,0,0,0.10)' },
  }}>
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, mb: 0.5 }}>
          <Typography sx={{ fontWeight: 700, fontSize: 14, fontFamily: 'monospace' }}>
            {r.numero_resolucion || 'Sin número oficial'}
          </Typography>
          {r.numero_resolucion && (
            <IconButton size="small" onClick={() => copyToClipboard(r.numero_resolucion)}
              sx={{ p: 0.3, color: 'text.secondary' }}>
              <ContentCopy sx={{ fontSize: 13 }} />
            </IconButton>
          )}
        </Box>
        <Box sx={{ display: 'flex', gap: 0.8, flexWrap: 'wrap' }}>
          <Chip label={r.prefijo || 'sin prefijo'} size="small"
            sx={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 11, bgcolor: `${TEAL}18`, color: TEAL }} />
          <Chip label={(r.tipo || 'fe') === 'pos' ? 'POS' : 'FE'} size="small"
            sx={{ fontWeight: 700, fontSize: 10,
              bgcolor: (r.tipo || 'fe') === 'pos' ? `${AMBER}18` : `${GREEN}18`,
              color: (r.tipo || 'fe') === 'pos' ? AMBER : GREEN }} />
          <ExpiryChip days={r.dias_para_vencer} />
        </Box>
      </Box>
      {r.is_active
        ? <Chip label="Activa" color="success" size="small" icon={<CheckCircle sx={{ fontSize: 14 }} />} sx={{ fontWeight: 700 }} />
        : <Chip label="Inactiva" variant="outlined" size="small" sx={{ fontWeight: 600, color: 'text.secondary' }} />
      }
    </Box>

    {/* Preview del siguiente número */}
    {r.is_active && (
      <Box sx={{ mb: 1.5, p: 1.5, borderRadius: 2, bgcolor: `${TEAL}0A`, border: `1px dashed ${TEAL}40` }}>
        <Typography sx={{ fontSize: 10, color: TEAL, mb: 0.3 }}>Próxima factura</Typography>
        <Typography sx={{ fontFamily: 'monospace', fontWeight: 800, fontSize: 16, color: TEAL }}>
          {r.prefijo}{String(r.numero_actual + 1).padStart(5, '0')}
        </Typography>
      </Box>
    )}

    <Divider sx={{ my: 1.5 }} />

    <Grid container spacing={1} sx={{ mb: 1.5 }}>
      {[
        { label: 'Rango',       val: `${r.numero_inicial?.toLocaleString()} – ${r.numero_final?.toLocaleString()}` },
        { label: 'Actual',      val: r.numero_actual?.toLocaleString() },
        { label: 'Disponibles', val: r.numeros_disponibles?.toLocaleString() },
        { label: 'Vigencia',    val: `${fmtDate(r.vigencia_desde)} – ${fmtDate(r.vigencia_hasta)}` },
      ].map(({ label, val }) => (
        <Grid item xs={6} key={label}>
          <Box sx={{ p: 1, borderRadius: 2, bgcolor: 'action.hover' }}>
            <Typography sx={{ fontSize: 10, color: 'text.secondary', mb: 0.2 }}>{label}</Typography>
            <Typography sx={{ fontSize: 12, fontWeight: 700 }}>{val}</Typography>
          </Box>
        </Grid>
      ))}
    </Grid>

    <Box sx={{ mb: 1.5 }}>
      <UsageBar pct={r.porcentaje_usado} />
    </Box>

    {(r.porcentaje_usado || 0) >= 80 && (
      <Alert severity="warning" sx={{ mb: 1.5, borderRadius: 2, fontSize: 12, py: 0.5 }}>
        Más del 80% del rango usado. Crea una nueva resolución pronto.
      </Alert>
    )}

    <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
      {!r.is_active && (
        <Tooltip title="Activar resolución">
          <IconButton size="small" onClick={() => onActivar(r.id)}
            sx={{ color: GREEN, bgcolor: '#ECFDF5', borderRadius: 1.5 }}>
            <RadioButtonUnchecked fontSize="small" />
          </IconButton>
        </Tooltip>
      )}
      {r.is_active && (
        <Tooltip title="Ajustar consecutivo">
          <IconButton size="small" onClick={() => onAjustar(r)}
            sx={{ color: AMBER, bgcolor: `${AMBER}10`, borderRadius: 1.5 }}>
            <Tune fontSize="small" />
          </IconButton>
        </Tooltip>
      )}
      <Tooltip title="Duplicar como base">
        <IconButton size="small" onClick={() => onDuplicate(r)}
          sx={{ color: TEAL, bgcolor: `${TEAL}10`, borderRadius: 1.5 }}>
          <FileCopy fontSize="small" />
        </IconButton>
      </Tooltip>
      <Tooltip title="Editar">
        <IconButton size="small" onClick={() => onEdit(r)}
          sx={{ color: TEAL, bgcolor: `${TEAL}10`, borderRadius: 1.5 }}>
          <Edit fontSize="small" />
        </IconButton>
      </Tooltip>
      {r.numero_actual === 0 && (
        <Tooltip title="Eliminar">
          <IconButton size="small" onClick={() => onEliminar(r)}
            sx={{ color: RED, bgcolor: '#FEF2F2', borderRadius: 1.5 }}>
            <Delete fontSize="small" />
          </IconButton>
        </Tooltip>
      )}
    </Box>
  </Paper>
);

/* ══════════════════════════════════════════════════════════════════════════ */
const ResolucionesDian = ({ embedded = false }) => {
  const theme    = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [resoluciones, setResoluciones] = useState([]);
  const [modal, setModal]               = useState({ open: false, editing: null });
  const [loading, setLoading]           = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [confirmDelete, setConfirmDelete] = useState({ open: false, target: null, busy: false });
  const [ajusteModal, setAjusteModal]     = useState({ open: false, resolucion: null, valor: '', motivo: '', busy: false });

  const [form, setForm] = useState(EMPTY_FORM);

  const fetchResoluciones = useCallback(async () => {
    try {
      const res = await apiClient.get('/resoluciones/');
      setResoluciones(res.data);
    } catch {
      toast.error('Error cargando resoluciones DIAN');
    }
  }, []);

  useEffect(() => { fetchResoluciones(); }, [fetchResoluciones]);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setShowAdvanced(false);
    setModal({ open: true, editing: null });
  };

  const openEdit = (r) => {
    setForm({
      tipo:              r.tipo || 'fe',
      prefijo:           r.prefijo || '',
      numero_resolucion: r.numero_resolucion || '',
      numero_inicial:    r.numero_inicial,
      numero_final:      r.numero_final,
      vigencia_desde:    r.vigencia_desde || '',
      vigencia_hasta:    r.vigencia_hasta || '',
      clave_tecnica:     r.clave_tecnica || '',
      nota:              r.nota || '',
    });
    setShowAdvanced(!!(r.clave_tecnica || r.nota));
    setModal({ open: true, editing: r });
  };

  const openDuplicate = (r) => {
    setForm({
      tipo:              r.tipo || 'fe',
      prefijo:           r.prefijo || '',
      numero_resolucion: '',
      numero_inicial:    r.numero_final + 1,
      numero_final:      r.numero_final + (r.numero_final - r.numero_inicial + 1),
      vigencia_desde:    '',
      vigencia_hasta:    '',
      clave_tecnica:     r.clave_tecnica || '',
      nota:              r.nota ? `Copia de: ${r.nota}` : '',
    });
    setShowAdvanced(!!(r.clave_tecnica || r.nota));
    setModal({ open: true, editing: null });
  };

  const handleSave = async () => {
    if (!form.numero_inicial || !form.numero_final || parseInt(form.numero_final) <= parseInt(form.numero_inicial)) {
      toast.warning('El número final debe ser mayor que el inicial.');
      return;
    }
    setLoading(true);
    try {
      const payload = {
        tipo:              form.tipo || 'fe',
        prefijo:           form.prefijo.trim(),
        numero_resolucion: form.numero_resolucion.trim() || null,
        numero_inicial:    parseInt(form.numero_inicial),
        numero_final:      parseInt(form.numero_final),
        vigencia_desde:    form.vigencia_desde || null,
        vigencia_hasta:    form.vigencia_hasta || null,
        clave_tecnica:     form.clave_tecnica.trim() || null,
        nota:              form.nota.trim() || null,
      };
      if (modal.editing) {
        await apiClient.put(`/resoluciones/${modal.editing.id}`, payload);
        toast.success('Resolución actualizada.');
      } else {
        await apiClient.post('/resoluciones/', payload);
        toast.success('Resolución creada. Actívala cuando estés listo.');
      }
      setModal({ open: false, editing: null });
      fetchResoluciones();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al guardar.');
    } finally {
      setLoading(false);
    }
  };

  const handleActivar = async (id) => {
    try {
      await apiClient.patch(`/resoluciones/${id}/activar`);
      toast.success('Resolución activada correctamente.');
      fetchResoluciones();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al activar.');
    }
  };

  const handleEliminar = async () => {
    const { target } = confirmDelete;
    setConfirmDelete(p => ({ ...p, busy: true }));
    try {
      await apiClient.delete(`/resoluciones/${target.id}`);
      toast.success('Resolución eliminada.');
      fetchResoluciones();
      setConfirmDelete({ open: false, target: null, busy: false });
    } catch (err) {
      toast.error(err.response?.data?.detail || 'No se puede eliminar: ya tiene comprobantes emitidos.');
      setConfirmDelete(p => ({ ...p, busy: false }));
    }
  };

  const handleAjustarNumero = async () => {
    const { resolucion, valor, motivo } = ajusteModal;
    if (!motivo.trim()) { toast.warning('Ingresa un motivo para el ajuste.'); return; }
    const nuevo = parseInt(valor);
    if (isNaN(nuevo)) { toast.warning('Número inválido.'); return; }
    setAjusteModal(p => ({ ...p, busy: true }));
    try {
      await apiClient.patch(`/resoluciones/${resolucion.id}/ajustar-numero`, { nuevo_numero: nuevo, motivo: motivo.trim() });
      toast.success(`Consecutivo ajustado a ${nuevo}.`);
      fetchResoluciones();
      setAjusteModal({ open: false, resolucion: null, valor: '', motivo: '', busy: false });
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al ajustar.');
      setAjusteModal(p => ({ ...p, busy: false }));
    }
  };

  const activa    = resoluciones.find(r => r.is_active && (r.tipo || 'fe') === 'fe')
                 || resoluciones.find(r => r.is_active);
  const activaPos = resoluciones.find(r => r.is_active && r.tipo === 'pos');
  const sinDee    = activa && !activaPos; // tiene FE pero no tiene DEE/POS

  /* ── preview next number ── */
  const previewNum = (form.prefijo || '') + String(parseInt(form.numero_inicial) || 1).padStart(5, '0');

  /* ── stats ── */
  const totalDisp  = activa ? activa.numeros_disponibles : 0;
  const pctActiva  = activa ? (activa.porcentaje_usado || 0) : 0;

  return (
    <Box sx={{ width: '100%' }}>

      {/* ── Header ── */}
      {!embedded && (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ width: 40, height: 40, borderRadius: 2, bgcolor: `${TEAL}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: TEAL }}>
            <VerifiedUser />
          </Box>
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography sx={{ fontWeight: 700, fontSize: 20, lineHeight: 1.2 }}>Resoluciones DIAN</Typography>
              <HelpGuideTopBar
                moduleName="Resoluciones DIAN"
                moduleColor={TEAL}
                steps={[
                  { title: '¿Qué es una resolución?', description: 'Es la autorización de la DIAN para usar un rango de números de factura. Sin ella, las facturas no son válidas fiscalmente.' },
                  { title: 'Ingresa los datos', description: 'Registra el número de resolución, prefijo, rango desde/hasta y fecha de vencimiento exactamente como aparece en el documento de la DIAN.' },
                  { title: 'Activa la resolución', description: 'Marca la resolución como "Activa" para que el sistema la use automáticamente al generar nuevas facturas.' },
                  { title: 'Monitorea el consecutivo', description: 'El sistema muestra una barra de progreso con los números usados. Renueva antes de que se agoten.' },
                ]}
                faqItems={[
                  { q: '¿Por qué necesito una resolución DIAN?', a: 'La DIAN exige que cada factura tenga un número autorizado dentro del rango aprobado. Sin resolución vigente, las facturas no tienen validez legal.' },
                  { q: '¿Qué pasa cuando se acaban los consecutivos?', a: 'El sistema te alertará. Debes solicitar una nueva resolución a la DIAN antes de que el rango se agote para no interrumpir la facturación.' },
                  { q: '¿Puedo tener varias resoluciones?', a: 'Sí, pero solo una puede estar activa a la vez. Las anteriores quedan en historial para consulta.' },
                  { q: '¿Cómo cambio la resolución activa?', a: 'Activa la nueva resolución y el sistema la usará automáticamente para el siguiente número de factura.' },
                ]}
              />
            </Box>
            <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>Numeración consecutiva para facturación</Typography>
          </Box>
        </Box>
        <Button
          variant="contained" startIcon={<Add />} onClick={openCreate}
          sx={{
            bgcolor: TEAL, '&:hover': { bgcolor: '#0F766E' },
            borderRadius: 2, fontWeight: 600,
            width: isMobile ? '100%' : 'auto',
          }}
        >
          Nueva Resolución
        </Button>
      </Box>
      )}
      {embedded && (
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
        <Button
          variant="contained" startIcon={<Add />} onClick={openCreate}
          sx={{
            bgcolor: TEAL, '&:hover': { bgcolor: '#0F766E' },
            borderRadius: 2, fontWeight: 600,
            width: isMobile ? '100%' : 'auto',
          }}
        >
          Nueva Resolución
        </Button>
      </Box>
      )}

      {/* ── Banner resolución activa ── */}
      {activa ? (
        <Paper sx={{
          p: 2.5, mb: 3, borderRadius: 3,
          border: `2px solid ${GREEN}40`,
          bgcolor: theme.palette.mode === 'dark' ? `${GREEN}10` : '#F0FDF4',
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5, flexWrap: 'wrap', gap: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CheckCircle sx={{ color: GREEN }} />
              <Typography sx={{ fontWeight: 700, color: GREEN }}>Resolución Activa</Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {pctActiva >= 60 && (
                <Chip
                  icon={<Warning sx={{ fontSize: 13 }} />}
                  label={`${pctActiva}% usado`}
                  size="small"
                  sx={{ bgcolor: `${progressColor(pctActiva)}18`, color: progressColor(pctActiva), fontWeight: 700, fontSize: 11 }}
                />
              )}
              <ExpiryChip days={activa.dias_para_vencer} />
            </Box>
          </Box>

          <Grid container spacing={1.5}>
            {[
              { label: 'Resolución',   val: activa.numero_resolucion || 'Sin número oficial', copy: true },
              { label: 'Prefijo',      val: activa.prefijo || '(sin prefijo)' },
              { label: 'Próxima Fac.', val: `${activa.prefijo || ''}${String(activa.numero_actual + 1).padStart(5, '0')}`, mono: true },
              { label: 'Disponibles',  val: totalDisp?.toLocaleString() },
              { label: 'Vigencia',     val: fmtDate(activa.vigencia_hasta) },
            ].map(({ label, val, copy, mono }) => (
              <Grid item xs={6} sm={4} md={2.4} key={label}>
                <Box sx={{ p: 1.2, borderRadius: 2, bgcolor: theme.palette.mode === 'dark' ? `${GREEN}15` : '#DCFCE7' }}>
                  <Typography sx={{ fontSize: 10, color: '#059669', mb: 0.3 }}>{label}</Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Typography sx={{ fontWeight: 800, fontSize: 13, color: '#065F46', fontFamily: mono ? 'monospace' : 'inherit' }}>
                      {val}
                    </Typography>
                    {copy && val !== 'Sin número oficial' && (
                      <IconButton size="small" onClick={() => copyToClipboard(val)} sx={{ p: 0.2, color: '#059669' }}>
                        <ContentCopy sx={{ fontSize: 12 }} />
                      </IconButton>
                    )}
                  </Box>
                </Box>
              </Grid>
            ))}
          </Grid>

          {/* Usage bar in banner */}
          <Box sx={{ mt: 2 }}>
            <UsageBar pct={pctActiva} />
          </Box>

          {pctActiva >= 80 && (
            <Alert severity="warning" icon={<Warning />} sx={{ mt: 1.5, borderRadius: 2, fontSize: 13 }}>
              Has usado el <strong>{pctActiva}%</strong> del rango. Solicita una nueva resolución a la DIAN.
            </Alert>
          )}
          {activa.dias_para_vencer !== null && activa.dias_para_vencer <= 30 && activa.dias_para_vencer >= 0 && (
            <Alert severity="warning" icon={<Schedule />} sx={{ mt: 1, borderRadius: 2, fontSize: 13 }}>
              La resolución vence en <strong>{activa.dias_para_vencer} día{activa.dias_para_vencer !== 1 ? 's' : ''}</strong>. Renuévala con la DIAN a tiempo.
            </Alert>
          )}
        </Paper>
      ) : (
        <Alert severity="info" sx={{ mb: 3, borderRadius: 2 }}>
          No hay resolución activa. Las ventas se registrarán sin número de factura DIAN hasta que actives una.
        </Alert>
      )}

      {/* ── Aviso: FE activa pero sin resolución DEE/POS ── */}
      {sinDee && (
        <Alert severity="warning" icon={<Warning />} sx={{ mb: 3, borderRadius: 2 }}>
          <strong>Sin resolución DEE/POS configurada.</strong> Las ventas donde el cliente <em>no</em> solicita
          factura electrónica se generan como Documento Equivalente Electrónico (DEE / Tiquete POS), que
          requiere una habilitación DIAN separada a la de FE. Sin ella, esas ventas no se reportan a la DIAN
          ni consumen cupo del plan, pero tampoco cumplen la obligación normativa.{' '}
          Tramita la habilitación POS ante la DIAN y regístrala aquí con tipo <strong>POS</strong>.
        </Alert>
      )}

      {/* ── Lista ── */}
      <Paper sx={{ borderRadius: 3, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', overflow: 'hidden' }}>

        {isMobile ? (
          <Box sx={{ p: 2 }}>
            {resoluciones.length === 0
              ? <Box sx={{ textAlign: 'center', py: 6, color: 'text.secondary' }}>
                  <VerifiedUser sx={{ fontSize: 48, mb: 1, opacity: 0.2 }} />
                  <Typography>No hay resoluciones registradas</Typography>
                </Box>
              : resoluciones.map(r => (
                  <ResolucionCard
                    key={r.id} r={r}
                    onActivar={handleActivar}
                    onEdit={openEdit}
                    onDuplicate={openDuplicate}
                    onEliminar={(r) => setConfirmDelete({ open: true, target: r, busy: false })}
                    onAjustar={(r) => setAjusteModal({ open: true, resolucion: r, valor: String(r.numero_actual), motivo: '', busy: false })}
                  />
                ))
            }
          </Box>
        ) : (
          <TableContainer>
            <Table>
              <TableHead sx={{ bgcolor: 'action.hover' }}>
                <TableRow>
                  {['Estado', 'Resolución DIAN', 'Prefijo', 'Rango / Consecutivo', 'Uso', 'Vigencia', 'Acciones'].map(h => (
                    <TableCell key={h} sx={{ fontWeight: 700, fontSize: 12, py: 1.5 }}>{h}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {resoluciones.length === 0
                  ? <TableRow>
                      <TableCell colSpan={7} sx={{ textAlign: 'center', py: 8, color: 'text.secondary' }}>
                        <VerifiedUser sx={{ fontSize: 48, mb: 1, opacity: 0.15, display: 'block', mx: 'auto' }} />
                        No hay resoluciones registradas
                      </TableCell>
                    </TableRow>
                  : resoluciones.map(r => (
                      <TableRow key={r.id} hover sx={{ bgcolor: r.is_active ? `${GREEN}05` : 'transparent' }}>

                        {/* Estado */}
                        <TableCell>
                          {r.is_active
                            ? <Chip label="Activa" color="success" size="small" icon={<CheckCircle />} sx={{ fontWeight: 700 }} />
                            : <Chip label="Inactiva" variant="outlined" size="small" sx={{ fontWeight: 600, color: 'text.secondary' }} />
                          }
                        </TableCell>

                        {/* Resolución */}
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <Typography sx={{ fontWeight: 600, fontSize: 13, fontFamily: 'monospace' }}>
                              {r.numero_resolucion || '—'}
                            </Typography>
                            {r.numero_resolucion && (
                              <Tooltip title="Copiar">
                                <IconButton size="small" onClick={() => copyToClipboard(r.numero_resolucion)}
                                  sx={{ p: 0.3, color: 'text.disabled' }}>
                                  <ContentCopy sx={{ fontSize: 12 }} />
                                </IconButton>
                              </Tooltip>
                            )}
                          </Box>
                          {/* Preview próxima factura */}
                          {r.is_active && (
                            <Typography sx={{ fontFamily: 'monospace', fontSize: 11, color: TEAL, fontWeight: 700, mt: 0.3 }}>
                              → {r.prefijo}{String(r.numero_actual + 1).padStart(5, '0')}
                            </Typography>
                          )}
                        </TableCell>

                        {/* Prefijo */}
                        <TableCell>
                          <Chip label={r.prefijo || '(sin)'} size="small"
                            sx={{ fontFamily: 'monospace', fontWeight: 700, bgcolor: `${TEAL}15`, color: TEAL }} />
                          <Chip
                            label={(r.tipo || 'fe') === 'pos' ? 'POS' : 'FE'}
                            size="small"
                            sx={{ ml: 0.5, fontWeight: 700, fontSize: 10,
                              bgcolor: (r.tipo || 'fe') === 'pos' ? `${AMBER}18` : `${GREEN}18`,
                              color: (r.tipo || 'fe') === 'pos' ? AMBER : GREEN }} />
                        </TableCell>

                        {/* Rango */}
                        <TableCell sx={{ fontSize: 12 }}>
                          <Typography sx={{ fontSize: 12 }}>
                            {r.numero_inicial?.toLocaleString()} – {r.numero_final?.toLocaleString()}
                          </Typography>
                          <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
                            Actual: {r.numero_actual?.toLocaleString()} · Disp: {r.numeros_disponibles?.toLocaleString()}
                          </Typography>
                        </TableCell>

                        {/* Uso */}
                        <TableCell sx={{ minWidth: 120 }}>
                          <UsageBar pct={r.porcentaje_usado} />
                        </TableCell>

                        {/* Vigencia */}
                        <TableCell sx={{ fontSize: 12 }}>
                          <Typography sx={{ fontSize: 12 }}>{fmtDate(r.vigencia_desde)} – {fmtDate(r.vigencia_hasta)}</Typography>
                          <Box sx={{ mt: 0.5 }}>
                            <ExpiryChip days={r.dias_para_vencer} />
                          </Box>
                        </TableCell>

                        {/* Acciones */}
                        <TableCell>
                          <Box sx={{ display: 'flex', gap: 0.5 }}>
                            {!r.is_active && (
                              <Tooltip title="Activar">
                                <IconButton size="small" onClick={() => handleActivar(r.id)}
                                  sx={{ color: GREEN, '&:hover': { bgcolor: '#ECFDF5' } }}>
                                  <RadioButtonUnchecked fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                            {r.is_active && (
                              <Tooltip title="Ajustar consecutivo">
                                <IconButton size="small"
                                  onClick={() => setAjusteModal({ open: true, resolucion: r, valor: String(r.numero_actual), motivo: '', busy: false })}
                                  sx={{ color: AMBER, '&:hover': { bgcolor: `${AMBER}10` } }}>
                                  <Tune fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                            <Tooltip title="Duplicar como base">
                              <IconButton size="small" onClick={() => openDuplicate(r)}
                                sx={{ color: TEAL, '&:hover': { bgcolor: `${TEAL}10` } }}>
                                <FileCopy fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Editar">
                              <IconButton size="small" onClick={() => openEdit(r)}
                                sx={{ color: TEAL, '&:hover': { bgcolor: `${TEAL}10` } }}>
                                <Edit fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            {r.numero_actual === 0 && (
                              <Tooltip title="Eliminar">
                                <IconButton size="small"
                                  onClick={() => setConfirmDelete({ open: true, target: r, busy: false })}
                                  sx={{ color: RED, '&:hover': { bgcolor: '#FEF2F2' } }}>
                                  <Delete fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                          </Box>
                        </TableCell>
                      </TableRow>
                    ))
                }
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {/* ══ Modal crear / editar ═══════════════════════════════════════════ */}
      <Dialog
        open={modal.open}
        onClose={() => setModal({ open: false, editing: null })}
        maxWidth="sm" fullWidth fullScreen={isMobile}
        PaperProps={{ sx: { borderRadius: isMobile ? 0 : 3, overflow: 'hidden' } }}
      >
        <Box sx={{ height: 5, bgcolor: TEAL }} />
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pt: 2.5 }}>
          <Typography sx={{ fontWeight: 800, fontSize: 17 }}>
            {modal.editing ? 'Editar Resolución' : 'Nueva Resolución DIAN'}
          </Typography>
          <IconButton size="small" onClick={() => setModal({ open: false, editing: null })}>
            <Close fontSize="small" />
          </IconButton>
        </DialogTitle>

        <DialogContent dividers sx={{ p: { xs: 2, sm: 3 } }}>
          <Alert severity="info" icon={<InfoOutlined />} sx={{ mb: 3, borderRadius: 2, fontSize: 13 }}>
            Ingresa los datos exactamente como aparecen en el documento de habilitación de la DIAN.
          </Alert>

          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                select fullWidth label="Tipo de documento"
                value={form.tipo}
                onChange={e => setForm(p => ({ ...p, tipo: e.target.value }))}
                disabled={!!modal.editing}
                helperText={
                  form.tipo === 'pos'
                    ? 'Documento Equivalente POS: se emite cuando el cliente NO pide factura (consumidor final). Requiere su propia resolución DIAN con prefijo distinto (ej. FPOS).'
                    : 'Factura Electrónica: se emite cuando el cliente la solicita o la venta supera 5 UVT.'
                }
              >
                <MenuItem value="fe">Factura Electrónica (FE)</MenuItem>
                <MenuItem value="pos">Documento Equivalente POS (Tiquete electrónico)</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth label="Número de Resolución DIAN"
                placeholder="Ej: 18764039000055"
                value={form.numero_resolucion}
                onChange={e => setForm(p => ({ ...p, numero_resolucion: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth label="Prefijo (opcional)"
                placeholder="Ej: FE, FAC"
                value={form.prefijo}
                onChange={e => setForm(p => ({ ...p, prefijo: e.target.value.toUpperCase().replace(/\s/g, '') }))}
                inputProps={{ maxLength: 10 }}
                helperText={
                  <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    Preview: <Box component="span" sx={{ fontFamily: 'monospace', fontWeight: 700, color: TEAL }}>{previewNum}</Box>
                  </Box>
                }
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth required label="Número inicial"
                type="number" value={form.numero_inicial}
                onChange={e => setForm(p => ({ ...p, numero_inicial: parseInt(e.target.value) || 1 }))}
                InputProps={{ inputProps: { min: 1 } }}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth required label="Número final"
                type="number" value={form.numero_final}
                onChange={e => setForm(p => ({ ...p, numero_final: parseInt(e.target.value) || 99999999 }))}
                InputProps={{ inputProps: { min: 1 } }}
                helperText={`${Math.max(0, (parseInt(form.numero_final) || 0) - (parseInt(form.numero_inicial) || 0) + 1).toLocaleString()} números`}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth label="Vigencia desde" type="date"
                InputLabelProps={{ shrink: true }} value={form.vigencia_desde}
                onChange={e => setForm(p => ({ ...p, vigencia_desde: e.target.value }))}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth label="Vigencia hasta" type="date"
                InputLabelProps={{ shrink: true }} value={form.vigencia_hasta}
                onChange={e => setForm(p => ({ ...p, vigencia_hasta: e.target.value }))}
              />
            </Grid>
          </Grid>

          {/* ── Sección avanzada (clave técnica + nota) ── */}
          <Box sx={{ mt: 2 }}>
            <Button
              size="small" variant="text"
              startIcon={showAdvanced ? <ExpandLess /> : <ExpandMore />}
              onClick={() => setShowAdvanced(p => !p)}
              sx={{ color: 'text.secondary', fontWeight: 600, textTransform: 'none', px: 0 }}
            >
              {showAdvanced ? 'Ocultar campos avanzados' : 'Campos avanzados (FE / notas)'}
            </Button>
            <Collapse in={showAdvanced}>
              <Grid container spacing={2} sx={{ mt: 0.5 }}>
                <Grid item xs={12}>
                  <TextField
                    fullWidth label="Clave técnica DIAN"
                    placeholder="Proporcionada en el habilitamiento FE"
                    value={form.clave_tecnica}
                    onChange={e => setForm(p => ({ ...p, clave_tecnica: e.target.value }))}
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          <Tooltip title="Código alfanumérico entregado por la DIAN en la habilitación de Factura Electrónica">
                            <InfoOutlined sx={{ fontSize: 18, color: 'text.disabled', cursor: 'help' }} />
                          </Tooltip>
                        </InputAdornment>
                      ),
                    }}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth multiline rows={2} label="Observaciones / Notas"
                    placeholder="Ej: Resolución para sucursal norte, enviada 15/05/2025"
                    value={form.nota}
                    onChange={e => setForm(p => ({ ...p, nota: e.target.value }))}
                  />
                </Grid>
              </Grid>
            </Collapse>
          </Box>
        </DialogContent>

        <DialogActions sx={{ px: { xs: 2, sm: 3 }, py: 2, gap: 1 }}>
          <Button
            onClick={() => setModal({ open: false, editing: null })}
            variant="outlined"
            sx={{ borderRadius: 2, fontWeight: 600, borderColor: 'divider', flex: isMobile ? 1 : 'none' }}
          >
            Cancelar
          </Button>
          <Button
            variant="contained" onClick={handleSave} disabled={loading}
            startIcon={loading ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : <SaveAlt />}
            sx={{ bgcolor: TEAL, '&:hover': { bgcolor: '#0F766E' }, borderRadius: 2, fontWeight: 700, flex: isMobile ? 1 : 'none' }}
          >
            {loading ? 'Guardando…' : (modal.editing ? 'Actualizar' : 'Crear Resolución')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ══ Modal ajuste de consecutivo ══════════════════════════════════ */}
      <Dialog
        open={ajusteModal.open}
        onClose={() => setAjusteModal(p => ({ ...p, open: false }))}
        maxWidth="xs" fullWidth
        PaperProps={{ sx: { borderRadius: 3, overflow: 'hidden' } }}
      >
        <Box sx={{ height: 4, bgcolor: AMBER }} />
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pt: 2.5 }}>
          <Typography sx={{ fontWeight: 700, fontSize: 16 }}>Ajustar Consecutivo</Typography>
          <IconButton size="small" onClick={() => setAjusteModal(p => ({ ...p, open: false }))}>
            <Close fontSize="small" />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers sx={{ p: 3 }}>
          <Alert severity="warning" sx={{ mb: 2.5, borderRadius: 2, fontSize: 13 }}>
            Esta acción modifica el número actual del consecutivo. Úsala solo para correcciones autorizadas.
          </Alert>
          {ajusteModal.resolucion && (
            <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 2 }}>
              Rango: {ajusteModal.resolucion.numero_inicial?.toLocaleString()} – {ajusteModal.resolucion.numero_final?.toLocaleString()} · Actual: <strong>{ajusteModal.resolucion.numero_actual}</strong>
            </Typography>
          )}
          <TextField
            fullWidth label="Nuevo número actual" type="number" sx={{ mb: 2 }}
            value={ajusteModal.valor}
            onChange={e => setAjusteModal(p => ({ ...p, valor: e.target.value }))}
            InputProps={{ inputProps: { min: ajusteModal.resolucion ? ajusteModal.resolucion.numero_inicial - 1 : 0 } }}
          />
          <TextField
            fullWidth required label="Motivo del ajuste"
            placeholder="Ej: Corrección por migración del sistema"
            value={ajusteModal.motivo}
            onChange={e => setAjusteModal(p => ({ ...p, motivo: e.target.value }))}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button onClick={() => setAjusteModal(p => ({ ...p, open: false }))}
            variant="outlined" sx={{ borderRadius: 2, fontWeight: 600, borderColor: 'divider' }}>
            Cancelar
          </Button>
          <Button
            onClick={handleAjustarNumero} variant="contained" disabled={ajusteModal.busy}
            sx={{ bgcolor: AMBER, color: '#fff', '&:hover': { bgcolor: '#D97706' }, borderRadius: 2, fontWeight: 700 }}
          >
            {ajusteModal.busy ? <CircularProgress size={18} sx={{ color: '#fff' }} /> : 'Aplicar Ajuste'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ══ Confirm Delete ═══════════════════════════════════════════════ */}
      <ConfirmDialog
        open={confirmDelete.open}
        title="Eliminar Resolución"
        message={`¿Eliminar la resolución ${confirmDelete.target?.numero_resolucion || ''}? Esta acción no se puede deshacer.`}
        onConfirm={handleEliminar}
        onCancel={() => setConfirmDelete({ open: false, target: null, busy: false })}
        loading={confirmDelete.busy}
        confirmColor={RED}
        confirmLabel="Eliminar"
      />
    </Box>
  );
};

export default ResolucionesDian;
