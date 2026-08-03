import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Button, TextField, Switch, FormControlLabel,
  Table, TableHead, TableRow, TableCell, TableBody, IconButton,
  Chip, CircularProgress, Tooltip, Paper, useMediaQuery, Grid,
} from '@mui/material';
import { Add, Delete, SystemUpdate, CheckCircle, Cancel } from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';
import { toast } from 'react-toastify';
import apiClient from '../../../api';

const ACCENT = '#0891B2';

// Deriva un version_code numérico de "1.4.0" → 10400 para ordenar la "última".
function codeFromVersion(v) {
  const parts = String(v || '').split('.').map(n => parseInt(n, 10) || 0);
  const [a = 0, b = 0, c = 0] = parts;
  return a * 10000 + b * 100 + c;
}

export default function AppVersionsManager() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [versiones, setVersiones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    version: '', url_descarga: '', mensaje: '', obligatoria: false, is_active: true,
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await apiClient.get('/superadmin/app-versiones');
      setVersiones(data || []);
    } catch {
      toast.error('No se pudieron cargar las versiones.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handlePublicar = async () => {
    if (!form.version.trim()) { toast.warning('Ingresa la versión (ej. 1.4.0).'); return; }
    setSaving(true);
    try {
      await apiClient.post('/superadmin/app-versiones', {
        version: form.version.trim(),
        version_code: codeFromVersion(form.version),
        plataforma: 'android',
        url_descarga: form.url_descarga.trim() || null,
        mensaje: form.mensaje.trim() || null,
        obligatoria: form.obligatoria,
        is_active: form.is_active,
      });
      toast.success('Versión publicada. Las apps la detectarán al abrir.');
      setForm({ version: '', url_descarga: '', mensaje: '', obligatoria: false, is_active: true });
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'No se pudo publicar la versión.');
    } finally {
      setSaving(false);
    }
  };

  const handleEliminar = async (id) => {
    if (!window.confirm('¿Eliminar esta versión?')) return;
    try {
      await apiClient.delete(`/superadmin/app-versiones/${id}`);
      toast.success('Versión eliminada.');
      load();
    } catch {
      toast.error('No se pudo eliminar.');
    }
  };

  const toggleActiva = async (v) => {
    try {
      await apiClient.patch(`/superadmin/app-versiones/${v.id}`, {
        version: v.version, version_code: v.version_code, plataforma: v.plataforma,
        url_descarga: v.url_descarga, mensaje: v.mensaje, obligatoria: v.obligatoria,
        is_active: !v.is_active,
      });
      load();
    } catch {
      toast.error('No se pudo actualizar.');
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
        <Box sx={{ width: 36, height: 36, borderRadius: 2, bgcolor: `${ACCENT}18`, color: ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <SystemUpdate fontSize="small" />
        </Box>
        <Box>
          <Typography sx={{ fontWeight: 800, fontSize: 16 }}>Versiones de la app móvil</Typography>
          <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
            Publica una versión nueva del APK. Las apps instaladas la detectan al abrir y avisan al usuario.
          </Typography>
        </Box>
      </Box>

      {/* Formulario de publicación */}
      <Paper sx={{ p: 2, borderRadius: 3, border: '1px solid', borderColor: 'divider', mb: 3, boxShadow: 'none' }}>
        <Grid container spacing={1.5}>
          <Grid item xs={12} sm={4}>
            <TextField label="Versión (ej. 1.4.0)" value={form.version} size="small" fullWidth
              onChange={e => setForm(f => ({ ...f, version: e.target.value }))} />
          </Grid>
          <Grid item xs={12} sm={8}>
            <TextField label="URL de descarga del APK" value={form.url_descarga} size="small" fullWidth
              placeholder="https://github.com/keilor9703/ksmart/releases/download/v1.4.0/ksmart360-1.4.0.apk"
              onChange={e => setForm(f => ({ ...f, url_descarga: e.target.value }))} />
          </Grid>
          <Grid item xs={12}>
            <TextField label="Mensaje para el usuario (opcional)" value={form.mensaje} size="small" fullWidth
              onChange={e => setForm(f => ({ ...f, mensaje: e.target.value }))} />
          </Grid>
          <Grid item xs={12}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
              <FormControlLabel
                control={<Switch checked={form.obligatoria} onChange={e => setForm(f => ({ ...f, obligatoria: e.target.checked }))} />}
                label="Obligatoria (bloquea hasta actualizar)" />
              <FormControlLabel
                control={<Switch checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} />}
                label="Activa" />
              <Box sx={{ flex: 1 }} />
              <Button variant="contained" startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <Add />}
                disabled={saving} onClick={handlePublicar}
                sx={{ borderRadius: 2, fontWeight: 700, bgcolor: ACCENT, '&:hover': { bgcolor: '#0e7490' } }}>
                Publicar versión
              </Button>
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {/* Listado */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>
      ) : versiones.length === 0 ? (
        <Typography sx={{ color: 'text.secondary', textAlign: 'center', py: 4 }}>
          Aún no hay versiones publicadas.
        </Typography>
      ) : isMobile ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {versiones.map((v, i) => (
            <Paper key={v.id} sx={{ p: 1.75, borderRadius: 2, border: '1px solid', borderColor: 'divider', boxShadow: 'none' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography sx={{ fontWeight: 700 }}>v{v.version}</Typography>
                  {i === 0 && v.is_active && <Chip label="Última" size="small" sx={{ height: 18, fontSize: 10, bgcolor: `${ACCENT}18`, color: ACCENT, fontWeight: 700 }} />}
                  {v.obligatoria && <Chip label="Obligatoria" size="small" color="error" sx={{ height: 18, fontSize: 10 }} />}
                </Box>
                <IconButton size="small" color="error" onClick={() => handleEliminar(v.id)}><Delete fontSize="small" /></IconButton>
              </Box>
              {v.mensaje && <Typography sx={{ fontSize: 12, color: 'text.secondary', mt: 0.5 }}>{v.mensaje}</Typography>}
              <Box sx={{ mt: 0.75 }}>
                <Chip size="small" onClick={() => toggleActiva(v)}
                  icon={v.is_active ? <CheckCircle sx={{ fontSize: '14px !important' }} /> : <Cancel sx={{ fontSize: '14px !important' }} />}
                  label={v.is_active ? 'Activa' : 'Inactiva'}
                  sx={{ height: 22, fontSize: 11, cursor: 'pointer', bgcolor: v.is_active ? '#10B98118' : 'action.hover', color: v.is_active ? '#10B981' : 'text.secondary' }} />
              </Box>
            </Paper>
          ))}
        </Box>
      ) : (
        <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: 'action.hover' }}>
                <TableCell sx={{ fontWeight: 700 }}>Versión</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Mensaje</TableCell>
                <TableCell sx={{ fontWeight: 700 }} align="center">Obligatoria</TableCell>
                <TableCell sx={{ fontWeight: 700 }} align="center">Estado</TableCell>
                <TableCell sx={{ fontWeight: 700 }} align="right">Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {versiones.map((v, i) => (
                <TableRow key={v.id} hover>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                      <Typography sx={{ fontWeight: 700 }}>v{v.version}</Typography>
                      {i === 0 && v.is_active && <Chip label="Última" size="small" sx={{ height: 18, fontSize: 10, bgcolor: `${ACCENT}18`, color: ACCENT, fontWeight: 700 }} />}
                    </Box>
                  </TableCell>
                  <TableCell sx={{ fontSize: 12, color: 'text.secondary', maxWidth: 320 }}>{v.mensaje || '—'}</TableCell>
                  <TableCell align="center">{v.obligatoria ? <Chip label="Sí" size="small" color="error" sx={{ height: 18, fontSize: 10 }} /> : '—'}</TableCell>
                  <TableCell align="center">
                    <Chip size="small" onClick={() => toggleActiva(v)}
                      label={v.is_active ? 'Activa' : 'Inactiva'}
                      sx={{ height: 22, fontSize: 11, cursor: 'pointer', bgcolor: v.is_active ? '#10B98118' : 'action.hover', color: v.is_active ? '#10B981' : 'text.secondary' }} />
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="Eliminar">
                      <IconButton size="small" color="error" onClick={() => handleEliminar(v.id)}><Delete fontSize="small" /></IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      )}
    </Box>
  );
}
