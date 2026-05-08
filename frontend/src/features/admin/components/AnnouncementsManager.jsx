import React, { useState } from 'react';
import { 
  Paper, TableContainer, Table, TableHead, TableRow, TableCell, 
  TableBody, Box, Typography, Chip, Button, IconButton, Dialog,
  DialogTitle, DialogContent, DialogActions, TextField, MenuItem,
  Stack, Switch, FormControlLabel, useTheme, useMediaQuery, Divider
} from '@mui/material';
import { Add, Notifications, ToggleOn, ToggleOff, AccessTime, Edit, Delete } from '@mui/icons-material';
import { toast } from 'react-toastify';
import apiClient from '../../../api';

const ACCENT = '#F43F5E';
const BLUE = '#3B82F6';
const GREEN = '#10B981';

const AnnouncementCard = ({ ann, onToggle }) => (
    <Paper sx={{ p: 2, mb: 2, borderRadius: 3, boxShadow: '0 2px 10px rgba(0,0,0,0.04)', borderLeft: `4px solid ${ann.is_active ? GREEN : 'gray'}` }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
            <Box>
                <Typography sx={{ fontWeight: 800, fontSize: 15, mb: 0.5 }}>{ann.titulo}</Typography>
                <Chip 
                    label={ann.tipo.toUpperCase()} 
                    size="small" 
                    sx={{ height: 18, fontSize: 9, fontWeight: 800, bgcolor: ann.tipo === 'critical' ? `${ACCENT}15` : (ann.tipo === 'warning' ? '#FFFBEB' : '#E0F2FE'), color: ann.tipo === 'critical' ? ACCENT : (ann.tipo === 'warning' ? '#B45309' : BLUE) }}
                />
            </Box>
            <IconButton size="small" onClick={() => onToggle(ann.id)}>
                {ann.is_active ? <ToggleOn color="success" /> : <ToggleOff color="action" />}
            </IconButton>
        </Box>

        <Typography sx={{ fontSize: 13, color: 'text.secondary', mb: 2 }}>{ann.mensaje}</Typography>

        <Divider sx={{ my: 1.5, opacity: 0.5 }} />

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <AccessTime sx={{ fontSize: 14, color: 'text.secondary' }} />
                <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
                    Vence: {ann.expires_at ? new Date(ann.expires_at).toLocaleDateString() : 'Nunca'}
                </Typography>
            </Box>
            <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.disabled' }}>ID: {ann.id}</Typography>
        </Box>
    </Paper>
);

const AnnouncementsManager = ({ announcements, onRefresh, onToggle }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    titulo: '',
    mensaje: '',
    tipo: 'info',
    is_active: true,
    expires_at: ''
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...form,
        expires_at: form.expires_at ? new Date(form.expires_at + 'T23:59:59').toISOString() : null
      };
      await apiClient.post('/superadmin/announcements', payload);
      toast.success('Anuncio creado correctamente');
      setOpen(false);
      setForm({ titulo: '', mensaje: '', tipo: 'info', is_active: true, expires_at: '' });
      onRefresh();
    } catch (err) {
      toast.error('Error al crear anuncio');
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
          <Typography sx={{ fontWeight: 800, fontSize: isMobile ? 16 : 18 }}>Gestión de Comunicación</Typography>
          <Button fullWidth={isMobile} variant="contained" startIcon={<Add />} onClick={() => setOpen(true)} sx={{ bgcolor: BLUE, borderRadius: 2, fontWeight: 700 }}>
              Nuevo Anuncio
          </Button>
      </Box>

      {isMobile ? (
          <Box sx={{ pb: 5 }}>
              {announcements.map(ann => (
                  <AnnouncementCard key={ann.id} ann={ann} onToggle={onToggle} />
              ))}
              {announcements.length === 0 && (
                  <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 4 }}>
                      <Notifications sx={{ fontSize: 40, color: 'action.disabled', mb: 1 }} />
                      <Typography color="text.secondary">No hay anuncios registrados.</Typography>
                  </Paper>
              )}
          </Box>
      ) : (
        <Paper sx={{ borderRadius: 4, boxShadow: '0 4px 20px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
            <TableContainer>
            <Table size="medium">
                <TableHead sx={{ bgcolor: 'action.hover' }}>
                <TableRow>
                    <TableCell sx={{ fontWeight: 800 }}>Título / Mensaje</TableCell>
                    <TableCell sx={{ fontWeight: 800 }}>Tipo</TableCell>
                    <TableCell sx={{ fontWeight: 800 }}>Estado</TableCell>
                    <TableCell sx={{ fontWeight: 800 }}>Expiración</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 800 }}>Acciones</TableCell>
                </TableRow>
                </TableHead>
                <TableBody>
                {announcements.map((ann) => (
                    <TableRow key={ann.id} hover>
                    <TableCell>
                        <Typography sx={{ fontWeight: 700, fontSize: 14 }}>{ann.titulo}</Typography>
                        <Typography sx={{ fontSize: 12, color: 'text.secondary', maxWidth: 400, noWrap: true, textOverflow: 'ellipsis', overflow: 'hidden' }}>
                            {ann.mensaje}
                        </Typography>
                    </TableCell>
                    <TableCell>
                        <Chip 
                            label={ann.tipo.toUpperCase()} 
                            size="small" 
                            sx={{ 
                                fontWeight: 800, fontSize: 10,
                                bgcolor: ann.tipo === 'critical' ? `${ACCENT}15` : (ann.tipo === 'warning' ? '#FFFBEB' : '#E0F2FE'),
                                color: ann.tipo === 'critical' ? ACCENT : (ann.tipo === 'warning' ? '#B45309' : BLUE)
                            }} 
                        />
                    </TableCell>
                    <TableCell>
                        <IconButton size="small" onClick={() => onToggle(ann.id)}>
                            {ann.is_active ? <ToggleOn color="success" /> : <ToggleOff color="action" />}
                        </IconButton>
                    </TableCell>
                    <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <AccessTime sx={{ fontSize: 14, color: 'text.secondary' }} />
                            <Typography sx={{ fontSize: 12 }}>{ann.expires_at ? new Date(ann.expires_at).toLocaleDateString() : 'Nunca'}</Typography>
                        </Box>
                    </TableCell>
                    <TableCell align="right">
                        <Typography variant="caption" color="text.secondary">ID: {ann.id}</Typography>
                    </TableCell>
                    </TableRow>
                ))}
                {announcements.length === 0 && (
                    <TableRow><TableCell colSpan={5} align="center" sx={{ py: 4 }}>No hay anuncios registrados.</TableCell></TableRow>
                )}
                </TableBody>
            </Table>
            </TableContainer>
        </Paper>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth fullScreen={isMobile} PaperProps={{ sx: { borderRadius: isMobile ? 0 : 4 } }}>
        <DialogTitle sx={{ fontWeight: 800 }}>
            Crear Anuncio Global
        </DialogTitle>
        <form onSubmit={handleSubmit}>
          <DialogContent dividers>
            <Stack spacing={3}>
              <TextField label="Título del Anuncio" required fullWidth size="small" value={form.titulo} onChange={e => setForm({...form, titulo: e.target.value})} />
              <TextField label="Contenido del Mensaje" required multiline rows={isMobile ? 8 : 4} fullWidth size="small" value={form.mensaje} onChange={e => setForm({...form, mensaje: e.target.value})} />
              <Box sx={{ display: 'flex', gap: 2, flexDirection: isMobile ? 'column' : 'row' }}>
                <TextField select label="Prioridad / Tipo" fullWidth size="small" value={form.tipo} onChange={e => setForm({...form, tipo: e.target.value})}>
                    <MenuItem value="info">Informativo (Azul)</MenuItem>
                    <MenuItem value="warning">Advertencia (Amarillo)</MenuItem>
                    <MenuItem value="critical">Crítico (Rojo)</MenuItem>
                    <MenuItem value="success">Éxito (Verde)</MenuItem>
                </TextField>
                <TextField type="date" label="Expira el..." InputLabelProps={{ shrink: true }} fullWidth size="small" value={form.expires_at} onChange={e => setForm({...form, expires_at: e.target.value})} />
              </Box>
              <FormControlLabel control={<Switch checked={form.is_active} onChange={e => setForm({...form, is_active: e.target.checked})} />} label="Publicar inmediatamente" />
            </Stack>
          </DialogContent>
          <DialogActions sx={{ p: 3 }}>
            <Button onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="submit" variant="contained" sx={{ bgcolor: BLUE, borderRadius: 2, px: 4, fontWeight: 700 }}>Crear Anuncio</Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
};

export default AnnouncementsManager;
