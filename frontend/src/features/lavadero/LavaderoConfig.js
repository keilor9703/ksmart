import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Paper, Typography, Grid, TextField, Button, Switch,
  FormControlLabel, CircularProgress, Divider, Stack,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  ToggleButton, ToggleButtonGroup, Tooltip, InputAdornment,
  useMediaQuery, useTheme,
} from '@mui/material';
import {
  Settings, Percent, LocalCarWash, Print, Refresh, Save,
} from '@mui/icons-material';
import { toast } from 'react-toastify';
import apiClient from '../../api';

const ACCENT = '#0891B2';

const SectionCard = ({ title, icon, children }) => (
  <Paper sx={{ p: 3, borderRadius: 3, border: '1px solid', borderColor: 'divider', mb: 2.5 }}>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, mb: 2.5 }}>
      <Box sx={{ color: ACCENT }}>{icon}</Box>
      <Typography sx={{ fontWeight: 700, fontSize: 15 }}>{title}</Typography>
    </Box>
    {children}
  </Paper>
);

export default function LavaderoConfig() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [config, setConfig]     = useState(null);
  const [servicios, setServicios] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [savingId, setSavingId] = useState(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [cfgRes, srvRes] = await Promise.all([
        apiClient.get('/lavadero/config'),
        apiClient.get('/productos/', { params: { es_servicio: true, limit: 200 } }),
      ]);
      setConfig(cfgRes.data);
      const list = srvRes.data.results ?? srvRes.data;
      setServicios(list.filter(s => s.es_servicio).map(s => ({ ...s, _comision: s.comision_pct ?? '' })));
    } catch {
      toast.error('Error al cargar la configuración.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleSaveConfig = async () => {
    setSaving(true);
    try {
      const { data } = await apiClient.put('/lavadero/config', {
        comision_pct_global: parseFloat(config.comision_pct_global) || 0,
        tipo_impresora:      config.tipo_impresora,
        imprimir_recibo:     config.imprimir_recibo,
        nombre_lavadero:     config.nombre_lavadero || null,
      });
      setConfig(data);
      toast.success('Configuración guardada.');
    } catch {
      toast.error('Error al guardar.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveComisionServicio = async (servicio) => {
    setSavingId(servicio.id);
    const val = servicio._comision === '' ? null : parseFloat(servicio._comision);
    try {
      await apiClient.patch(`/lavadero/productos/${servicio.id}/comision`, { comision_pct: val });
      setServicios(prev => prev.map(s => s.id === servicio.id ? { ...s, comision_pct: val } : s));
      toast.success(`Comisión de "${servicio.nombre}" actualizada.`);
    } catch {
      toast.error('Error al guardar la comisión.');
    } finally {
      setSavingId(null);
    }
  };

  const setServicioComision = (id, val) => {
    setServicios(prev => prev.map(s => s.id === id ? { ...s, _comision: val } : s));
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
        <CircularProgress sx={{ color: ACCENT }} />
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 1, md: 2 }, maxWidth: 900, mx: 'auto' }}>

      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ width: 42, height: 42, borderRadius: 2, bgcolor: `${ACCENT}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Settings sx={{ color: ACCENT, fontSize: 24 }} />
          </Box>
          <Box>
            <Typography sx={{ fontSize: 20, fontWeight: 800, lineHeight: 1.1 }}>Config. Lavadero</Typography>
            <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>Comisiones e impresión</Typography>
          </Box>
        </Box>
        <Button
          size="small" variant="outlined" startIcon={<Refresh />}
          onClick={fetchAll}
          sx={{ borderRadius: 2, textTransform: 'none', borderColor: 'divider' }}
        >
          Recargar
        </Button>
      </Box>

      {config && (
        <>
          {/* ─── General ─── */}
          <SectionCard title="General" icon={<LocalCarWash />}>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Nombre del lavadero"
                  value={config.nombre_lavadero || ''}
                  onChange={e => setConfig(c => ({ ...c, nombre_lavadero: e.target.value }))}
                  fullWidth size="small"
                  placeholder="Mi Lavadero"
                  helperText="Aparece en el recibo impreso"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Comisión global (%)"
                  type="number"
                  value={config.comision_pct_global ?? 30}
                  onChange={e => setConfig(c => ({ ...c, comision_pct_global: e.target.value }))}
                  fullWidth size="small"
                  InputProps={{ endAdornment: <InputAdornment position="end"><Percent sx={{ fontSize: 16 }} /></InputAdornment> }}
                  helperText="Se aplica a todos los servicios sin comisión individual"
                  inputProps={{ min: 0, max: 100, step: 0.5 }}
                />
              </Grid>
            </Grid>
          </SectionCard>

          {/* ─── Impresión ─── */}
          <SectionCard title="Impresión" icon={<Print />}>
            <Stack spacing={2}>
              <Box>
                <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 1 }}>Tamaño de impresora</Typography>
                <ToggleButtonGroup
                  value={config.tipo_impresora || 'p80'}
                  exclusive
                  onChange={(_, v) => v && setConfig(c => ({ ...c, tipo_impresora: v }))}
                  size="small"
                >
                  <ToggleButton value="p80" sx={{ fontWeight: 700, textTransform: 'none', px: 3 }}>
                    P80 — 80 mm
                  </ToggleButton>
                  <ToggleButton value="p58" sx={{ fontWeight: 700, textTransform: 'none', px: 3 }}>
                    P58 — 58 mm
                  </ToggleButton>
                </ToggleButtonGroup>
              </Box>
              <FormControlLabel
                control={
                  <Switch
                    checked={!!config.imprimir_recibo}
                    onChange={e => setConfig(c => ({ ...c, imprimir_recibo: e.target.checked }))}
                    sx={{ '& .MuiSwitch-thumb': { bgcolor: ACCENT }, '& .Mui-checked + .MuiSwitch-track': { bgcolor: `${ACCENT}80` } }}
                  />
                }
                label={
                  <Box>
                    <Typography sx={{ fontWeight: 600, fontSize: 14 }}>Imprimir recibo automáticamente al cobrar</Typography>
                    <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>Se abrirá el diálogo de impresión al registrar el pago</Typography>
                  </Box>
                }
              />
            </Stack>
          </SectionCard>

          {/* Save button for main config */}
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 3 }}>
            <Button
              variant="contained"
              startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <Save />}
              onClick={handleSaveConfig}
              disabled={saving}
              sx={{ bgcolor: ACCENT, '&:hover': { bgcolor: '#e6561c' }, fontWeight: 700, borderRadius: 2.5, textTransform: 'none', px: 3 }}
            >
              {saving ? 'Guardando…' : 'Guardar configuración'}
            </Button>
          </Box>

          {/* ─── Comisiones por servicio ─── */}
          <SectionCard title="Comisión por servicio" icon={<Percent />}>
            <Typography sx={{ fontSize: 13, color: 'text.secondary', mb: 2 }}>
              Deja en blanco para usar la comisión global ({config.comision_pct_global ?? 30}%).
              Los cambios se guardan por servicio al presionar el botón de cada fila.
            </Typography>

            {servicios.length === 0 ? (
              <Typography sx={{ color: 'text.disabled', fontSize: 13 }}>
                No hay servicios. Créalos en el módulo Productos marcando "Es servicio".
              </Typography>
            ) : isMobile ? (
              /* ── Móvil: cards ── */
              <Stack spacing={1.25}>
                {servicios.map(s => {
                  const efectiva = s._comision !== '' ? parseFloat(s._comision) : (config.comision_pct_global ?? 30);
                  return (
                    <Paper key={s.id} variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1, mb: 1 }}>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography sx={{ fontWeight: 700, fontSize: 13.5 }}>{s.nombre}</Typography>
                          <Typography sx={{ fontSize: 12.5, color: 'text.secondary' }}>
                            ${Number(s.precio || 0).toLocaleString('es-CO')}
                          </Typography>
                        </Box>
                        <Typography sx={{ fontSize: 11.5, color: 'text.disabled', flexShrink: 0, mt: 0.3 }}>
                          Efectiva: {efectiva}%
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                        <TextField
                          size="small" type="number" fullWidth
                          label="Comisión %"
                          value={s._comision}
                          onChange={e => setServicioComision(s.id, e.target.value)}
                          placeholder={`${config.comision_pct_global ?? 30} (global)`}
                          InputProps={{ endAdornment: <InputAdornment position="end"><Typography sx={{ fontSize: 12 }}>%</Typography></InputAdornment> }}
                          inputProps={{ min: 0, max: 100, step: 0.5 }}
                        />
                        <Button
                          size="small" variant="outlined"
                          disabled={savingId === s.id}
                          onClick={() => handleSaveComisionServicio(s)}
                          sx={{ fontSize: 11, fontWeight: 700, textTransform: 'none', borderRadius: 1.5, minWidth: 76, flexShrink: 0 }}
                        >
                          {savingId === s.id ? <CircularProgress size={12} /> : 'Guardar'}
                        </Button>
                      </Box>
                    </Paper>
                  );
                })}
              </Stack>
            ) : (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: 'action.hover' }}>
                      {['Servicio', 'Precio', 'Comisión %', ''].map(h => (
                        <TableCell key={h} sx={{ fontWeight: 700, fontSize: 11, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                          {h}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {servicios.map(s => {
                      const efectiva = s._comision !== '' ? parseFloat(s._comision) : (config.comision_pct_global ?? 30);
                      return (
                        <TableRow key={s.id} hover sx={{ '&:last-child td': { border: 0 } }}>
                          <TableCell>
                            <Typography sx={{ fontWeight: 600, fontSize: 13 }}>{s.nombre}</Typography>
                          </TableCell>
                          <TableCell sx={{ fontSize: 13, color: 'text.secondary' }}>
                            ${Number(s.precio || 0).toLocaleString('es-CO')}
                          </TableCell>
                          <TableCell sx={{ width: 160 }}>
                            <Tooltip title={`Comisión efectiva: ${efectiva}%`} placement="top">
                              <TextField
                                size="small"
                                type="number"
                                value={s._comision}
                                onChange={e => setServicioComision(s.id, e.target.value)}
                                placeholder={`${config.comision_pct_global ?? 30} (global)`}
                                InputProps={{ endAdornment: <InputAdornment position="end"><Typography sx={{ fontSize: 12 }}>%</Typography></InputAdornment> }}
                                inputProps={{ min: 0, max: 100, step: 0.5, style: { width: 60 } }}
                                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5 } }}
                              />
                            </Tooltip>
                          </TableCell>
                          <TableCell>
                            <Button
                              size="small"
                              variant="outlined"
                              disabled={savingId === s.id}
                              onClick={() => handleSaveComisionServicio(s)}
                              sx={{ fontSize: 11, fontWeight: 700, textTransform: 'none', borderRadius: 1.5, minWidth: 64 }}
                            >
                              {savingId === s.id ? <CircularProgress size={12} /> : 'Guardar'}
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </SectionCard>
        </>
      )}
    </Box>
  );
}
