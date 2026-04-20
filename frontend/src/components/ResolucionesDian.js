import React, { useState, useEffect } from 'react';
import {
  Box, Paper, Typography, Button, TextField, Grid, Chip,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  IconButton, Dialog, DialogTitle, DialogContent, DialogActions,
  Alert, Tooltip, LinearProgress, Divider, Stack
} from '@mui/material';
import {
  VerifiedUser, Add, Edit, CheckCircle, RadioButtonUnchecked,
  Delete, Warning, Close
} from '@mui/icons-material';
import apiClient from '../api';
import { toast } from 'react-toastify';

const TEAL  = '#0D9488';
const GREEN = '#10B981';
const RED   = '#EF4444';

const fmtDate = (val) => val ? new Date(val + 'T12:00:00').toLocaleDateString('es-CO') : '—';

const ResolucionesDian = () => {
  const [resoluciones, setResoluciones] = useState([]);
  const [modal, setModal] = useState({ open: false, editing: null });
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    prefijo: '', numero_resolucion: '',
    numero_inicial: 1, numero_final: 99999999,
    vigencia_desde: '', vigencia_hasta: '',
  });

  useEffect(() => { fetchResoluciones(); }, []);

  const fetchResoluciones = async () => {
    try {
      const res = await apiClient.get('/resoluciones/');
      setResoluciones(res.data);
    } catch {
      toast.error('Error cargando resoluciones DIAN');
    }
  };

  const openCreate = () => {
    setForm({ prefijo: '', numero_resolucion: '', numero_inicial: 1, numero_final: 99999999, vigencia_desde: '', vigencia_hasta: '' });
    setModal({ open: true, editing: null });
  };

  const openEdit = (r) => {
    setForm({
      prefijo:           r.prefijo || '',
      numero_resolucion: r.numero_resolucion || '',
      numero_inicial:    r.numero_inicial,
      numero_final:      r.numero_final,
      vigencia_desde:    r.vigencia_desde || '',
      vigencia_hasta:    r.vigencia_hasta || '',
    });
    setModal({ open: true, editing: r });
  };

  const handleSave = async () => {
    if (!form.numero_inicial || !form.numero_final || form.numero_final <= form.numero_inicial) {
      toast.warning('El número final debe ser mayor que el inicial.');
      return;
    }
    setLoading(true);
    try {
      const payload = {
        prefijo:           form.prefijo.trim(),
        numero_resolucion: form.numero_resolucion.trim() || null,
        numero_inicial:    parseInt(form.numero_inicial),
        numero_final:      parseInt(form.numero_final),
        vigencia_desde:    form.vigencia_desde || null,
        vigencia_hasta:    form.vigencia_hasta || null,
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
      toast.error(err.response?.data?.detail || 'Error al guardar la resolución.');
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

  const handleEliminar = async (id) => {
    if (!window.confirm('¿Eliminar esta resolución?')) return;
    try {
      await apiClient.delete(`/resoluciones/${id}`);
      toast.success('Resolución eliminada.');
      fetchResoluciones();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'No se puede eliminar: ya tiene comprobantes emitidos.');
    }
  };

  const activa = resoluciones.find(r => r.is_active);

  return (
    <Box sx={{ width: '100%' }}>

      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ width: 40, height: 40, borderRadius: 2, bgcolor: `${TEAL}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: TEAL }}>
            <VerifiedUser />
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 700, fontSize: 20, lineHeight: 1.2 }}>Resoluciones DIAN</Typography>
            <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>Numeración consecutiva para facturación</Typography>
          </Box>
        </Box>
        <Button variant="contained" startIcon={<Add />} onClick={openCreate}
          sx={{ bgcolor: TEAL, '&:hover': { bgcolor: '#0F766E' }, borderRadius: 2, fontWeight: 600 }}>
          Nueva Resolución
        </Button>
      </Box>

      {/* Estado actual */}
      {activa ? (
        <Paper sx={{ p: 2.5, mb: 3, borderRadius: 3, border: `2px solid ${GREEN}40`, bgcolor: '#ECFDF5' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
            <CheckCircle sx={{ color: GREEN }} />
            <Typography sx={{ fontWeight: 700, color: GREEN }}>Resolución Activa</Typography>
          </Box>
          <Grid container spacing={2}>
            {[
              { label: 'Resolución', val: activa.numero_resolucion || 'Sin número oficial' },
              { label: 'Prefijo',    val: activa.prefijo || '(sin prefijo)' },
              { label: 'Siguiente N°', val: activa.numero_actual + 1 },
              { label: 'Disponibles', val: `${activa.numeros_disponibles?.toLocaleString()} números` },
              { label: 'Vigencia hasta', val: fmtDate(activa.vigencia_hasta) },
            ].map(({ label, val }) => (
              <Grid item xs={6} sm={4} md={2.4} key={label}>
                <Typography sx={{ fontSize: 11, color: '#059669', mb: 0.3 }}>{label}</Typography>
                <Typography sx={{ fontWeight: 700, fontSize: 14, color: '#065F46' }}>{val}</Typography>
              </Grid>
            ))}
          </Grid>
          {activa.porcentaje_usado > 80 && (
            <Alert severity="warning" sx={{ mt: 2, borderRadius: 2, fontSize: 13 }}>
              Has usado el <strong>{activa.porcentaje_usado}%</strong> del rango numérico. Considera crear una nueva resolución pronto.
            </Alert>
          )}
        </Paper>
      ) : (
        <Alert severity="info" sx={{ mb: 3, borderRadius: 2 }}>
          No hay resolución activa. Las ventas se registrarán sin número de factura DIAN hasta que actives una.
        </Alert>
      )}

      {/* Tabla de resoluciones */}
      <Paper sx={{ borderRadius: 3, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
        <TableContainer>
          <Table>
            <TableHead sx={{ bgcolor: 'action.hover' }}>
              <TableRow>
                {['Estado', 'Resolución DIAN', 'Prefijo', 'Rango', 'Progreso', 'Vigencia', 'Acciones'].map(h => (
                  <TableCell key={h} sx={{ fontWeight: 700 }}>{h}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {resoluciones.length === 0
                ? <TableRow>
                    <TableCell colSpan={7} sx={{ textAlign: 'center', py: 6, color: 'text.secondary' }}>
                      No hay resoluciones registradas
                    </TableCell>
                  </TableRow>
                : resoluciones.map(r => (
                    <TableRow key={r.id} hover sx={{ bgcolor: r.is_active ? '#ECFDF510' : 'transparent' }}>
                      <TableCell>
                        {r.is_active
                          ? <Chip label="Activa" color="success" size="small" icon={<CheckCircle />} sx={{ fontWeight: 700 }} />
                          : <Chip label="Inactiva" variant="outlined" size="small" sx={{ fontWeight: 600, color: 'text.secondary' }} />
                        }
                      </TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>{r.numero_resolucion || '—'}</TableCell>
                      <TableCell>
                        <Chip label={r.prefijo || '(sin prefijo)'} size="small"
                          sx={{ fontFamily: 'monospace', fontWeight: 700, bgcolor: `${TEAL}18`, color: TEAL }} />
                      </TableCell>
                      <TableCell sx={{ fontSize: 12 }}>
                        {r.numero_inicial.toLocaleString()} – {r.numero_final.toLocaleString()}
                        <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
                          Actual: {r.numero_actual}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ minWidth: 140 }}>
                        <Box>
                          <LinearProgress
                            variant="determinate"
                            value={Math.min(r.porcentaje_usado || 0, 100)}
                            sx={{ height: 6, borderRadius: 3, bgcolor: '#e2e8f0',
                              '& .MuiLinearProgress-bar': {
                                bgcolor: (r.porcentaje_usado || 0) > 80 ? RED : TEAL
                              }
                            }}
                          />
                          <Typography sx={{ fontSize: 10, color: 'text.secondary', mt: 0.5 }}>
                            {r.porcentaje_usado || 0}% usado · {r.numeros_disponibles?.toLocaleString()} disp.
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell sx={{ fontSize: 12 }}>
                        {fmtDate(r.vigencia_desde)} – {fmtDate(r.vigencia_hasta)}
                        {!r.esta_vigente && r.vigencia_hasta && (
                          <Chip label="Vencida" color="error" size="small" sx={{ ml: 1, fontSize: 10 }} />
                        )}
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', gap: 0.5 }}>
                          {!r.is_active && (
                            <Tooltip title="Activar esta resolución">
                              <IconButton size="small" onClick={() => handleActivar(r.id)}
                                sx={{ color: GREEN, '&:hover': { bgcolor: '#ECFDF5' } }}>
                                <RadioButtonUnchecked fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                          <Tooltip title="Editar">
                            <IconButton size="small" onClick={() => openEdit(r)}
                              sx={{ color: TEAL, '&:hover': { bgcolor: `${TEAL}10` } }}>
                              <Edit fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          {r.numero_actual === 0 && (
                            <Tooltip title="Eliminar">
                              <IconButton size="small" onClick={() => handleEliminar(r.id)}
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
      </Paper>

      {/* Modal crear / editar */}
      <Dialog open={modal.open} onClose={() => setModal({ open: false, editing: null })}
        maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3, overflow: 'hidden' } }}>
        <Box sx={{ height: 5, bgcolor: TEAL }} />
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography sx={{ fontWeight: 800, fontSize: 17 }}>
            {modal.editing ? 'Editar Resolución' : 'Nueva Resolución DIAN'}
          </Typography>
          <IconButton size="small" onClick={() => setModal({ open: false, editing: null })}><Close fontSize="small" /></IconButton>
        </DialogTitle>
        <DialogContent dividers sx={{ p: 3 }}>
          <Alert severity="info" sx={{ mb: 3, borderRadius: 2, fontSize: 13 }}>
            La resolución autoriza una numeración consecutiva. El prefijo es opcional (ej: "FE-", "FAC").
          </Alert>
          <Grid container spacing={2.5}>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="Número de Resolución DIAN" placeholder="Ej: 18764039000055"
                value={form.numero_resolucion} onChange={e => setForm(p => ({ ...p, numero_resolucion: e.target.value }))} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="Prefijo (opcional)" placeholder="Ej: FE, FAC, F"
                value={form.prefijo}
                onChange={e => setForm(p => ({ ...p, prefijo: e.target.value.toUpperCase().replace(/\s/g, '') }))}
                inputProps={{ maxLength: 10 }}
                helperText="Se añade antes del número: FE0000001"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth required label="Número inicial del rango" type="number"
                value={form.numero_inicial}
                onChange={e => setForm(p => ({ ...p, numero_inicial: parseInt(e.target.value) || 1 }))}
                InputProps={{ inputProps: { min: 1 } }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth required label="Número final del rango" type="number"
                value={form.numero_final}
                onChange={e => setForm(p => ({ ...p, numero_final: parseInt(e.target.value) || 99999999 }))}
                InputProps={{ inputProps: { min: 1 } }}
                helperText={`${(form.numero_final - form.numero_inicial + 1).toLocaleString()} números`}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="Vigencia desde" type="date" InputLabelProps={{ shrink: true }}
                value={form.vigencia_desde}
                onChange={e => setForm(p => ({ ...p, vigencia_desde: e.target.value }))} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="Vigencia hasta" type="date" InputLabelProps={{ shrink: true }}
                value={form.vigencia_hasta}
                onChange={e => setForm(p => ({ ...p, vigencia_hasta: e.target.value }))} />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
          <Button onClick={() => setModal({ open: false, editing: null })} variant="outlined"
            sx={{ borderRadius: 2, fontWeight: 600, borderColor: 'divider' }}>
            Cancelar
          </Button>
          <Button variant="contained" onClick={handleSave} disabled={loading}
            sx={{ bgcolor: TEAL, '&:hover': { bgcolor: '#0F766E' }, borderRadius: 2, fontWeight: 700 }}>
            {loading ? 'Guardando…' : (modal.editing ? 'Actualizar' : 'Crear Resolución')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ResolucionesDian;
