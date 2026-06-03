import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Button, IconButton, Tooltip, CircularProgress,
  useTheme, alpha, TextField, Dialog, DialogTitle, DialogContent,
  DialogActions, Chip, Paper, Grid, Switch, FormControlLabel,
  InputAdornment, Divider, Stack, Tab, Tabs,
  ToggleButtonGroup, ToggleButton,
} from '@mui/material';
import {
  Add, Edit, Delete, Save, TableRestaurant, Restaurant,
  Settings, DragIndicator, Check, Close, Print, PointOfSale as PointOfSaleIcon,
} from '@mui/icons-material';
import { toast } from 'react-toastify';
import apiClient from '../../api';

const ACCENT = '#FF6020';

// ─── TagInput (para áreas y zonas) ───────────────────────────────────────────

const TagInput = ({ label, value = [], onChange }) => {
  const theme = useTheme();
  const [input, setInput] = useState('');

  const addTag = () => {
    const trimmed = input.trim();
    if (!trimmed || value.includes(trimmed)) return;
    onChange([...value, trimmed]);
    setInput('');
  };

  const removeTag = (tag) => onChange(value.filter(t => t !== tag));

  return (
    <Box>
      <Typography sx={{ fontSize: 13, fontWeight: 600, mb: 1, color: theme.palette.text.secondary }}>
        {label}
      </Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.8, mb: 1, minHeight: 36 }}>
        {value.map(tag => (
          <Chip
            key={tag}
            label={tag}
            size="small"
            onDelete={() => removeTag(tag)}
            sx={{ bgcolor: alpha(ACCENT, 0.12), color: ACCENT, fontWeight: 600, '& .MuiChip-deleteIcon': { color: ACCENT } }}
          />
        ))}
        {value.length === 0 && (
          <Typography sx={{ fontSize: 12, color: theme.palette.text.disabled, lineHeight: '28px' }}>
            Sin elementos aún
          </Typography>
        )}
      </Box>
      <Box sx={{ display: 'flex', gap: 1 }}>
        <TextField
          size="small"
          placeholder={`Nueva ${label.toLowerCase()}...`}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
          sx={{ flex: 1 }}
        />
        <Button variant="outlined" size="small" onClick={addTag} disabled={!input.trim()}>
          <Add sx={{ fontSize: 18 }} />
        </Button>
      </Box>
    </Box>
  );
};

// ─── DialogMesa ───────────────────────────────────────────────────────────────

const DialogMesa = ({ open, onClose, mesa, zonas, onSaved }) => {
  const [form, setForm] = useState({
    numero: '', nombre: '', capacidad: 4, zona: 'Salón principal',
    pos_x: 10, pos_y: 10, is_active: true,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (mesa) setForm({ ...mesa });
    else setForm({ numero: '', nombre: '', capacidad: 4, zona: zonas[0] || 'Salón principal', pos_x: 10, pos_y: 10, is_active: true });
  }, [mesa, zonas, open]);

  const isEdit = Boolean(mesa);

  const handleSave = async () => {
    if (!form.numero) return toast.error('El número de mesa es obligatorio');
    setSaving(true);
    try {
      if (isEdit) {
        await apiClient.put(`/restaurante/mesas/${mesa.id}`, form);
        toast.success('Mesa actualizada');
      } else {
        await apiClient.post('/restaurante/mesas', form);
        toast.success('Mesa creada');
      }
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al guardar la mesa');
    } finally {
      setSaving(false);
    }
  };

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>
        {isEdit ? `Editar Mesa ${mesa?.numero}` : 'Nueva Mesa'}
      </DialogTitle>
      <DialogContent>
        <Grid container spacing={2} sx={{ mt: 0 }}>
          <Grid item xs={6}>
            <TextField
              fullWidth label="Número de mesa *" type="number"
              value={form.numero} onChange={e => set('numero', e.target.value)}
              size="small"
            />
          </Grid>
          <Grid item xs={6}>
            <TextField
              fullWidth label="Nombre / etiqueta" placeholder="ej: Terraza, VIP..."
              value={form.nombre || ''} onChange={e => set('nombre', e.target.value)}
              size="small"
            />
          </Grid>
          <Grid item xs={6}>
            <TextField
              fullWidth label="Capacidad (personas)" type="number"
              value={form.capacidad} onChange={e => set('capacidad', parseInt(e.target.value) || 1)}
              size="small" InputProps={{ inputProps: { min: 1, max: 30 } }}
            />
          </Grid>
          <Grid item xs={6}>
            <TextField
              select fullWidth label="Zona / área" value={form.zona || ''}
              onChange={e => set('zona', e.target.value)}
              size="small" SelectProps={{ native: true }}
            >
              {zonas.map(z => <option key={z} value={z}>{z}</option>)}
            </TextField>
          </Grid>
          <Grid item xs={6}>
            <TextField
              fullWidth label="Posición X (% horizontal)" type="number"
              value={form.pos_x ?? 10} onChange={e => set('pos_x', parseFloat(e.target.value) || 0)}
              size="small" InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment>, inputProps: { min: 0, max: 95 } }}
            />
          </Grid>
          <Grid item xs={6}>
            <TextField
              fullWidth label="Posición Y (% vertical)" type="number"
              value={form.pos_y ?? 10} onChange={e => set('pos_y', parseFloat(e.target.value) || 0)}
              size="small" InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment>, inputProps: { min: 0, max: 95 } }}
            />
          </Grid>
          <Grid item xs={12}>
            <FormControlLabel
              control={<Switch checked={form.is_active} onChange={e => set('is_active', e.target.checked)} color="warning" />}
              label={<Typography sx={{ fontSize: 14 }}>Mesa activa</Typography>}
            />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={saving}>Cancelar</Button>
        <Button variant="contained" onClick={handleSave} disabled={saving}
          sx={{ bgcolor: ACCENT, '&:hover': { bgcolor: '#e55516' } }}>
          {saving ? <CircularProgress size={18} sx={{ color: '#fff' }} /> : (isEdit ? 'Guardar cambios' : 'Crear mesa')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ─── Tab Mesas ────────────────────────────────────────────────────────────────

const TabMesas = ({ zonas }) => {
  const theme = useTheme();
  const [mesas, setMesas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [mesaEditing, setMesaEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [filtroZona, setFiltroZona] = useState('todas');

  const fetchMesas = useCallback(async () => {
    try {
      const res = await apiClient.get('/restaurante/mesas');
      setMesas(res.data);
    } catch (err) {
      toast.error('Error al cargar mesas');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchMesas(); }, [fetchMesas]);

  const handleDelete = async (mesa) => {
    if (!window.confirm(`¿Eliminar mesa ${mesa.numero}? Esta acción no se puede deshacer.`)) return;
    setDeleting(mesa.id);
    try {
      await apiClient.delete(`/restaurante/mesas/${mesa.id}`);
      toast.success('Mesa eliminada');
      fetchMesas();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al eliminar');
    } finally {
      setDeleting(null);
    }
  };

  const mesasFiltradas = filtroZona === 'todas'
    ? mesas
    : mesas.filter(m => m.zona === filtroZona);

  return (
    <Box>
      {/* Filtro zona + botón nuevo */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
        <Box sx={{ display: 'flex', gap: 0.8, flexWrap: 'wrap' }}>
          {['todas', ...zonas].map(z => (
            <Chip
              key={z}
              label={z === 'todas' ? 'Todas las zonas' : z}
              size="small"
              onClick={() => setFiltroZona(z)}
              sx={{
                cursor: 'pointer',
                bgcolor: filtroZona === z ? ACCENT : alpha(ACCENT, 0.1),
                color: filtroZona === z ? '#fff' : ACCENT,
                fontWeight: 600,
              }}
            />
          ))}
        </Box>
        <Button
          variant="contained" startIcon={<Add />} size="small"
          onClick={() => { setMesaEditing(null); setDialogOpen(true); }}
          sx={{ bgcolor: ACCENT, '&:hover': { bgcolor: '#e55516' } }}
        >
          Nueva mesa
        </Button>
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress sx={{ color: ACCENT }} /></Box>
      ) : (
        <Grid container spacing={1.5}>
          {mesasFiltradas.map(mesa => (
            <Grid item xs={6} sm={4} md={3} key={mesa.id}>
              <Paper
                elevation={1}
                sx={{
                  p: 1.5, borderRadius: 2,
                  border: `1px solid ${mesa.is_active ? 'rgba(0,0,0,0.08)' : 'rgba(239,68,68,0.3)'}`,
                  opacity: mesa.is_active ? 1 : 0.6,
                }}
              >
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Box>
                    <Typography sx={{ fontWeight: 800, fontSize: 18 }}>Mesa {mesa.numero}</Typography>
                    {mesa.nombre && <Typography sx={{ fontSize: 12, color: theme.palette.text.secondary }}>{mesa.nombre}</Typography>}
                    <Typography sx={{ fontSize: 12, color: theme.palette.text.secondary, mt: 0.3 }}>
                      {mesa.capacidad} personas · {mesa.zona}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', gap: 0.3 }}>
                    <Tooltip title="Editar">
                      <IconButton size="small" onClick={() => { setMesaEditing(mesa); setDialogOpen(true); }}>
                        <Edit sx={{ fontSize: 15 }} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Eliminar">
                      <IconButton size="small" onClick={() => handleDelete(mesa)} disabled={deleting === mesa.id} sx={{ color: '#EF4444' }}>
                        {deleting === mesa.id ? <CircularProgress size={14} /> : <Delete sx={{ fontSize: 15 }} />}
                      </IconButton>
                    </Tooltip>
                  </Box>
                </Box>
                {!mesa.is_active && (
                  <Chip label="Inactiva" size="small" sx={{ mt: 0.5, bgcolor: 'rgba(239,68,68,0.1)', color: '#EF4444', fontSize: 11 }} />
                )}
              </Paper>
            </Grid>
          ))}
          {mesasFiltradas.length === 0 && (
            <Grid item xs={12}>
              <Box sx={{ textAlign: 'center', py: 4, color: theme.palette.text.secondary }}>
                <TableRestaurant sx={{ fontSize: 48, opacity: 0.3 }} />
                <Typography sx={{ mt: 1 }}>No hay mesas en esta zona</Typography>
              </Box>
            </Grid>
          )}
        </Grid>
      )}

      <DialogMesa
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        mesa={mesaEditing}
        zonas={zonas.length > 0 ? zonas : ['Salón principal']}
        onSaved={fetchMesas}
      />
    </Box>
  );
};

// ─── Tab Configuración General ────────────────────────────────────────────────

const TabGeneral = ({ config, set, saving, onSave, loading }) => {
  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress sx={{ color: ACCENT }} /></Box>;
  if (!config) return null;

  return (
    <Stack spacing={3}>
      {/* Áreas de cocina */}
      <Paper elevation={0} sx={{ p: 2.5, borderRadius: 2, border: '1px solid rgba(0,0,0,0.08)' }}>
        <Typography sx={{ fontWeight: 700, mb: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
          <Restaurant sx={{ color: ACCENT, fontSize: 20 }} /> Áreas de cocina
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
          Define las estaciones de tu cocina (ej: Cocina, Parrilla, Bar, Postres). Los ítems de comanda se asignan a cada área.
        </Typography>
        <TagInput
          label="Áreas de cocina"
          value={config.areas_cocina || []}
          onChange={v => set('areas_cocina', v)}
        />
      </Paper>

      {/* Zonas de salón */}
      <Paper elevation={0} sx={{ p: 2.5, borderRadius: 2, border: '1px solid rgba(0,0,0,0.08)' }}>
        <Typography sx={{ fontWeight: 700, mb: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
          <TableRestaurant sx={{ color: ACCENT, fontSize: 20 }} /> Zonas del salón
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
          Agrega las áreas de tu restaurante (ej: Terraza, Salón VIP, Barra). Las mesas se asignan a cada zona.
        </Typography>
        <TagInput
          label="Zonas"
          value={config.zonas_sala || []}
          onChange={v => set('zonas_sala', v)}
        />
      </Paper>

      {/* Parámetros operativos */}
      <Paper elevation={0} sx={{ p: 2.5, borderRadius: 2, border: '1px solid rgba(0,0,0,0.08)' }}>
        <Typography sx={{ fontWeight: 700, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
          <Settings sx={{ color: ACCENT, fontSize: 20 }} /> Parámetros operativos
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth label="Tiempo de cocina estimado" type="number"
              value={config.tiempo_cocina_estimado ?? 15}
              onChange={e => set('tiempo_cocina_estimado', parseInt(e.target.value) || 0)}
              size="small"
              InputProps={{ endAdornment: <InputAdornment position="end">min</InputAdornment>, inputProps: { min: 1, max: 120 } }}
              helperText="Referencia para alertas visuales en cocina"
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth label="Propina sugerida" type="number"
              value={config.propina_sugerida_pct ?? 0}
              onChange={e => set('propina_sugerida_pct', parseFloat(e.target.value) || 0)}
              size="small"
              InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment>, inputProps: { min: 0, max: 30, step: 0.5 } }}
              helperText="Se muestra al cerrar la cuenta (0 para desactivar)"
            />
          </Grid>
          <Grid item xs={12}>
            <FormControlLabel
              control={
                <Switch
                  checked={config.permitir_nota_por_item ?? true}
                  onChange={e => set('permitir_nota_por_item', e.target.checked)}
                  sx={{ '& .MuiSwitch-switchBase.Mui-checked': { color: ACCENT }, '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: ACCENT } }}
                />
              }
              label={
                <Box>
                  <Typography sx={{ fontSize: 14, fontWeight: 500 }}>Permitir notas por ítem</Typography>
                  <Typography variant="caption" color="text.secondary">Los meseros pueden agregar notas especiales a cada plato</Typography>
                </Box>
              }
            />
          </Grid>
        </Grid>
      </Paper>

      {/* Impresión de comandas */}
      <Paper elevation={0} sx={{ p: 2.5, borderRadius: 2, border: '1px solid rgba(0,0,0,0.08)' }}>
        <Typography sx={{ fontWeight: 700, mb: 0.5, display: 'flex', alignItems: 'center', gap: 1 }}>
          <Print sx={{ color: ACCENT, fontSize: 20 }} /> Impresión de comandas
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
          Para restaurantes sin pantallas en cocina. Al activar esta opción, cada vez que un mesero envíe un pedido a cocina se abrirá automáticamente el diálogo de impresión del navegador para imprimir el ticket en la impresora térmica conectada al dispositivo.
        </Typography>
        <FormControlLabel
          control={
            <Switch
              checked={config.imprimir_comanda_auto ?? false}
              onChange={e => set('imprimir_comanda_auto', e.target.checked)}
              sx={{ '& .MuiSwitch-switchBase.Mui-checked': { color: ACCENT }, '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: ACCENT } }}
            />
          }
          label={
            <Box>
              <Typography sx={{ fontSize: 14, fontWeight: 500 }}>Imprimir comanda automáticamente al enviar a cocina</Typography>
              <Typography variant="caption" color="text.secondary">El mesero deberá tener una impresora térmica configurada en su dispositivo</Typography>
            </Box>
          }
        />

        <Divider sx={{ my: 2 }} />

        {/* Tipo de impresora */}
        <Typography sx={{ fontSize: 13, fontWeight: 600, mb: 0.5 }}>Tipo de impresora térmica</Typography>
        <Typography variant="caption" color="text.secondary" sx={{ mb: 1.5, display: 'block' }}>
          Define el ancho del papel. Esto ajusta el tamaño de fuente y el formato del ticket impreso.
        </Typography>

        <ToggleButtonGroup
          value={config.tipo_impresora || 'p80'}
          exclusive
          onChange={(_, v) => v && set('tipo_impresora', v)}
          size="small"
          sx={{
            mb: 2.5,
            '& .MuiToggleButton-root': {
              px: 2.5, py: 0.7, fontSize: 13, fontWeight: 600,
              borderRadius: '8px !important', textTransform: 'none',
            },
            '& .Mui-selected': { color: `${ACCENT} !important`, borderColor: `${ACCENT} !important`, bgcolor: `${alpha(ACCENT, 0.07)} !important` },
          }}
        >
          <ToggleButton value="p80">🖨️ Térmica 80 mm</ToggleButton>
          <ToggleButton value="p58">🖨️ Térmica 58 mm</ToggleButton>
        </ToggleButtonGroup>

        {/* Preview visual del ticket */}
        <Box sx={{ display: 'flex', gap: 3, justifyContent: 'center', flexWrap: 'wrap' }}>
          {[
            { key: 'p80', label: 'Térmica 80 mm', w: 200, fMesa: 14, fItem: 11, fMeta: 8, fBase: 9, fFooter: 8 },
            { key: 'p58', label: 'Térmica 58 mm', w: 145, fMesa: 12, fItem: 9,  fMeta: 7, fBase: 8, fFooter: 7 },
          ].map(({ key, label, w, fMesa, fItem, fMeta, fBase, fFooter }) => {
            const selected = (config.tipo_impresora || 'p80') === key;
            return (
              <Box key={key} onClick={() => set('tipo_impresora', key)}
                sx={{ cursor: 'pointer', transition: 'all 0.2s', opacity: selected ? 1 : 0.45, '&:hover': { opacity: 0.8 } }}>
                {/* Ticket body */}
                <Box sx={{
                  width: w,
                  bgcolor: 'white',
                  border: `2px solid ${selected ? ACCENT : 'rgba(0,0,0,0.15)'}`,
                  borderBottom: 'none',
                  borderRadius: '4px 4px 0 0',
                  px: 1.2, pt: 1.2, pb: 0.8,
                  fontFamily: 'Courier New, monospace',
                  boxShadow: selected ? `0 4px 20px ${alpha(ACCENT, 0.2)}` : '0 2px 8px rgba(0,0,0,0.08)',
                }}>
                  <Typography align="center" sx={{ fontSize: fMesa, fontWeight: 800, fontFamily: 'inherit', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Mi Restaurante
                  </Typography>
                  <Box sx={{ borderTop: '1.5px solid #000', my: 0.4 }} />
                  <Typography align="center" sx={{ fontSize: fBase + 1, fontWeight: 700, fontFamily: 'inherit', letterSpacing: 2 }}>✦ COMANDA ✦</Typography>
                  <Box sx={{ borderTop: '1.5px solid #000', my: 0.4 }} />
                  <Typography sx={{ fontSize: fMesa, fontWeight: 800, fontFamily: 'inherit' }}>Mesa 5</Typography>
                  <Typography sx={{ fontSize: fMeta, fontFamily: 'inherit' }}>Comanda #42</Typography>
                  <Typography sx={{ fontSize: fMeta, fontFamily: 'inherit' }}>2 personas · 14/06 12:30</Typography>
                  <Box sx={{ borderTop: '1px dashed #555', my: 0.4 }} />
                  <Typography sx={{ fontSize: fItem, fontWeight: 700, fontFamily: 'inherit' }}>2× Bandeja paisa</Typography>
                  <Typography sx={{ fontSize: fItem, fontWeight: 700, fontFamily: 'inherit' }}>1× Limonada de coco</Typography>
                  <Typography sx={{ fontSize: fItem, fontWeight: 700, fontFamily: 'inherit' }}>3× Arepa con hogao</Typography>
                  <Box sx={{ borderTop: '1.5px solid #000', my: 0.4 }} />
                  <Typography align="center" sx={{ fontSize: fFooter, fontFamily: 'inherit', color: '#555' }}>Mesero: Carlos A.</Typography>
                  <Typography align="center" sx={{ fontSize: fFooter, fontFamily: 'inherit', color: '#555' }}>— Ksmart360 —</Typography>
                </Box>
                {/* Borde serrado (efecto papel térmico) */}
                <Box sx={{
                  width: w, height: 8,
                  background: `linear-gradient(135deg, white 33%, transparent 33%) 0 0,
                               linear-gradient(225deg, white 33%, transparent 33%) 0 0`,
                  backgroundSize: '10px 8px',
                  bgcolor: 'white',
                  borderLeft: `2px solid ${selected ? ACCENT : 'rgba(0,0,0,0.15)'}`,
                  borderRight: `2px solid ${selected ? ACCENT : 'rgba(0,0,0,0.15)'}`,
                  boxShadow: selected ? `4px 4px 20px ${alpha(ACCENT, 0.15)}` : '2px 2px 8px rgba(0,0,0,0.06)',
                }} />
                <Typography align="center" sx={{
                  fontSize: 11, fontWeight: selected ? 700 : 400, mt: 0.8,
                  color: selected ? ACCENT : 'text.secondary',
                }}>
                  {label}
                  {selected && <Typography component="span" sx={{ ml: 0.5, fontSize: 10 }}>✓</Typography>}
                </Typography>
              </Box>
            );
          })}
        </Box>
      </Paper>

      {/* Cobro directo por mesero */}
      <Paper elevation={0} sx={{ p: 2.5, borderRadius: 2, border: '1px solid rgba(0,0,0,0.08)' }}>
        <Typography sx={{ fontWeight: 700, mb: 0.5, display: 'flex', alignItems: 'center', gap: 1 }}>
          <PointOfSaleIcon sx={{ color: ACCENT, fontSize: 20 }} /> Cobro por mesero
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
          Por defecto el cobro lo realiza el cajero en el módulo Caja Restaurante. Activa esta opción si también quieres que el mesero pueda cobrar directamente desde la mesa, sin pasar por caja.
        </Typography>
        <FormControlLabel
          control={
            <Switch
              checked={config.mesero_puede_cobrar_directo ?? false}
              onChange={e => set('mesero_puede_cobrar_directo', e.target.checked)}
              sx={{ '& .MuiSwitch-switchBase.Mui-checked': { color: ACCENT }, '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: ACCENT } }}
            />
          }
          label={
            <Box>
              <Typography sx={{ fontSize: 14, fontWeight: 500 }}>Permitir que el mesero cobre directamente</Typography>
              <Typography variant="caption" color="text.secondary">Activa el botón "Cobrar directamente" en el panel del mesero</Typography>
            </Box>
          }
        />
      </Paper>

      {/* Guardar */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          variant="contained" startIcon={saving ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : <Save />}
          onClick={onSave} disabled={saving}
          sx={{ bgcolor: ACCENT, px: 4, '&:hover': { bgcolor: '#e55516' } }}
        >
          {saving ? 'Guardando...' : 'Guardar configuración'}
        </Button>
      </Box>
    </Stack>
  );
};

// ─── Pantalla principal ───────────────────────────────────────────────────────

const RestauranteConfig = () => {
  const [tab, setTab] = useState(0);
  const [config, setConfig] = useState(null);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchConfig = useCallback(async () => {
    try {
      const res = await apiClient.get('/restaurante/config');
      setConfig(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingConfig(false);
    }
  }, []);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  const set = (k, v) => setConfig(p => ({ ...p, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiClient.put('/restaurante/config', config);
      toast.success('Configuración guardada');
    } catch (err) {
      toast.error('Error al guardar la configuración');
    } finally {
      setSaving(false);
    }
  };

  const zonas = config?.zonas_sala || ['Salón principal'];

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto', p: { xs: 1, md: 0 } }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 800, fontFamily: "'Plus Jakarta Sans', sans-serif", display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Settings sx={{ color: ACCENT, fontSize: 28 }} />
          Configuración del Restaurante
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          Gestiona mesas, zonas, áreas de cocina y parámetros generales del módulo.
        </Typography>
      </Box>

      {/* Tabs */}
      <Tabs
        value={tab} onChange={(_, v) => setTab(v)}
        sx={{
          mb: 3, borderBottom: 1, borderColor: 'divider',
          '& .MuiTab-root': { textTransform: 'none', fontWeight: 600, fontFamily: "'Plus Jakarta Sans', sans-serif" },
          '& .Mui-selected': { color: `${ACCENT} !important` },
          '& .MuiTabs-indicator': { bgcolor: ACCENT },
        }}
      >
        <Tab label="Mesas y zonas" icon={<TableRestaurant />} iconPosition="start" />
        <Tab label="Cocina y parámetros" icon={<Settings />} iconPosition="start" />
      </Tabs>

      {tab === 0 && <TabMesas zonas={zonas} />}
      {tab === 1 && (
        <TabGeneral
          config={config}
          set={set}
          saving={saving}
          onSave={handleSave}
          loading={loadingConfig}
        />
      )}
    </Box>
  );
};

export default RestauranteConfig;
