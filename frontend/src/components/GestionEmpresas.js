import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Button, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Chip, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, Stack, 
  Tooltip, Grid, Divider, useTheme, useMediaQuery, MenuItem
} from '@mui/material';
import { 
  Add, Business, Block, CheckCircle, AdminPanelSettings, 
  Close, CardMembership, WorkspacePremium, AccessTime 
} from '@mui/icons-material';
import { toast } from 'react-toastify';
import apiClient from '../api';

const ACCENT = '#F43F5E';

// ── Helpers ──
const calcularDiasRestantes = (fechaFin) => {
  if (!fechaFin) return 0;
  const diff = new Date(fechaFin) - new Date();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
};

const formatDateForInput = (dateString) => {
  if (!dateString) return '';
  return new Date(dateString).toISOString().split('T')[0];
};

// ── Card Mobile para Empresas ──
const EmpresaCard = ({ empresa, onToggleStatus, onOpenPlan }) => {
  const dias = calcularDiasRestantes(empresa.trial_ends_at);
  
  return (
    <Paper sx={{ p: 2.5, mb: 2, borderRadius: 3, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
        <Box>
          <Typography sx={{ fontWeight: 700, fontSize: 15 }}>{empresa.nombre}</Typography>
          <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
            #{empresa.id} · NIT: {empresa.nit || 'Sin registro'}
          </Typography>
        </Box>
        <Chip 
          label={empresa.is_active ? 'Activa' : 'Suspendida'} 
          size="small"
          sx={{ 
            bgcolor: empresa.is_active ? '#10B98120' : '#EF444420', 
            color: empresa.is_active ? '#10B981' : '#EF4444', 
            fontWeight: 600, fontSize: 11, borderRadius: 1.5 
          }} 
        />
      </Box>

      <Divider sx={{ my: 1.5 }} />

      <Grid container spacing={1} sx={{ mb: 1.5 }}>
        <Grid item xs={6}>
          <Box sx={{ textAlign: 'center', p: 1, borderRadius: 2, bgcolor: 'action.hover' }}>
            <Typography sx={{ fontSize: 10, color: 'text.secondary', mb: 0.2 }}>Plan Actual</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
              {empresa.plan_type === 'premium' ? <WorkspacePremium sx={{ fontSize: 14, color: '#F59E0B' }} /> : <AccessTime sx={{ fontSize: 14, color: '#3B82F6' }} />}
              <Typography sx={{ fontSize: 13, fontWeight: 700, textTransform: 'capitalize' }}>
                {empresa.plan_type || 'trial'}
              </Typography>
            </Box>
          </Box>
        </Grid>
        <Grid item xs={6}>
          <Box sx={{ textAlign: 'center', p: 1, borderRadius: 2, bgcolor: 'action.hover' }}>
            <Typography sx={{ fontSize: 10, color: 'text.secondary', mb: 0.2 }}>Tiempo Restante</Typography>
            <Typography sx={{ fontSize: 13, fontWeight: 700, color: dias > 0 || empresa.plan_type === 'premium' ? '#10B981' : '#EF4444' }}>
              {empresa.plan_type === 'premium' ? 'Ilimitado' : `${dias > 0 ? dias : 0} Días`}
            </Typography>
          </Box>
        </Grid>
      </Grid>

      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
        <Tooltip title="Gestionar Suscripción">
          <span>
            <IconButton size="small" disabled={empresa.id === 1} onClick={() => onOpenPlan(empresa)}
              sx={{ color: '#8B5CF6', bgcolor: '#F3E8FF', borderRadius: 1.5 }}>
              <CardMembership fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title={empresa.is_active ? "Suspender acceso" : "Reactivar acceso"}>
          <span>
            <IconButton size="small" disabled={empresa.id === 1} onClick={() => onToggleStatus(empresa.id, empresa.is_active)}
              sx={{ color: empresa.is_active ? '#EF4444' : '#10B981', bgcolor: empresa.is_active ? '#FEF2F2' : '#F0FDF4', borderRadius: 1.5 }}>
              {empresa.is_active ? <Block fontSize="small" /> : <CheckCircle fontSize="small" />}
            </IconButton>
          </span>
        </Tooltip>
      </Box>
    </Paper>
  );
};

export default function GestionEmpresas() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [empresas, setEmpresas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [openDialog, setOpenDialog] = useState(false);
  const [openPlanDialog, setOpenPlanDialog] = useState(false);
  const [empresaSeleccionada, setEmpresaSeleccionada] = useState(null);

  const [formData, setFormData] = useState({
    nombre: '', nit: '', admin_username: '', admin_password: ''
  });

  const [planData, setPlanData] = useState({
    plan_type: 'trial', trial_ends_at: ''
  });

  useEffect(() => { fetchEmpresas(); }, []);

  const fetchEmpresas = async () => {
    try {
      const { data } = await apiClient.get('/superadmin/empresas');
      setEmpresas(data);
    } catch (err) {
      toast.error('Error al cargar clientes del SaaS. ¿Eres SuperAdmin?');
    }
  };

  const handleToggleStatus = async (id, is_active) => {
    const action = is_active ? 'suspender' : 'reactivar';
    if (!window.confirm(`¿Estás seguro de que deseas ${action} esta cuenta?`)) return;

    try {
      await apiClient.patch(`/superadmin/empresas/${id}/toggle`);
      toast.success(`Cuenta ${is_active ? 'suspendida' : 'reactivada'} exitosamente`);
      fetchEmpresas();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al cambiar estado');
    }
  };

  const handleOpenPlan = (empresa) => {
    setEmpresaSeleccionada(empresa);
    setPlanData({
      plan_type: empresa.plan_type || 'trial',
      trial_ends_at: formatDateForInput(empresa.trial_ends_at)
    });
    setOpenPlanDialog(true);
  };

  const handleAddDays = (days) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    setPlanData({ ...planData, trial_ends_at: d.toISOString().split('T')[0] });
  };

  const handleUpdatePlan = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        plan_type: planData.plan_type,
        trial_ends_at: planData.trial_ends_at ? new Date(planData.trial_ends_at).toISOString() : null
      };
      await apiClient.patch(`/superadmin/empresas/${empresaSeleccionada.id}/plan`, payload);
      toast.success('Suscripción actualizada exitosamente');
      setOpenPlanDialog(false);
      fetchEmpresas();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al actualizar el plan');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await apiClient.post('/superadmin/empresas', {
        empresa: { nombre: formData.nombre, nit: formData.nit, color_primario: '#3B82F6' },
        admin_username: formData.admin_username,
        admin_password: formData.admin_password
      });
      toast.success('Empresa registrada con 14 días de prueba.');
      setOpenDialog(false);
      setFormData({ nombre: '', nit: '', admin_username: '', admin_password: '' });
      fetchEmpresas();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al crear la empresa');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ width: '100%' }}>
      {/* ── Header ── */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ width: 40, height: 40, borderRadius: 2, bgcolor: `${ACCENT}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: ACCENT }}>
            <AdminPanelSettings />
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 700, fontSize: 20, lineHeight: 1.2 }}>Clientes SaaS</Typography>
            <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>Gestión de suscripciones e inquilinos</Typography>
          </Box>
        </Box>
        <Button variant="contained" startIcon={<Add />} onClick={() => setOpenDialog(true)}
          sx={{ bgcolor: ACCENT, '&:hover': { bgcolor: '#e11d48' }, borderRadius: 2, fontWeight: 600, boxShadow: `0 4px 14px rgba(244,63,94,0.35)` }}>
          Nueva Empresa
        </Button>
      </Box>

      {/* ── Contenido Responsive ── */}
      <Paper sx={{ borderRadius: 3, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
        {isMobile ? (
          <Box sx={{ p: 2 }}>
            {empresas.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 6, color: 'text.secondary' }}>
                <Business sx={{ fontSize: 48, mb: 1, opacity: 0.3 }} />
                <Typography>No hay empresas registradas</Typography>
              </Box>
            ) : (
              empresas.map(emp => (
                <EmpresaCard key={emp.id} empresa={emp} onToggleStatus={handleToggleStatus} onOpenPlan={handleOpenPlan} />
              ))
            )}
          </Box>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>ID</TableCell>
                  <TableCell>Empresa</TableCell>
                  <TableCell>Estado</TableCell>
                  <TableCell>Plan</TableCell>
                  <TableCell>Vence / Días</TableCell>
                  <TableCell align="right">Acciones</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {empresas.map((emp) => {
                  const dias = calcularDiasRestantes(emp.trial_ends_at);
                  return (
                    <TableRow key={emp.id} hover>
                      <TableCell>#{emp.id}</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>
                        {emp.nombre}
                        <Typography variant="caption" display="block" color="text.secondary">NIT: {emp.nit || 'N/A'}</Typography>
                      </TableCell>
                      <TableCell>
                        <Chip label={emp.is_active ? 'Activa' : 'Suspendida'} size="small"
                          sx={{ bgcolor: emp.is_active ? '#10B98120' : '#EF444420', color: emp.is_active ? '#10B981' : '#EF4444', fontWeight: 600, fontSize: 11, borderRadius: 1.5 }} />
                      </TableCell>
                      <TableCell sx={{ textTransform: 'capitalize', fontWeight: 600, color: emp.plan_type === 'premium' ? '#F59E0B' : '#3B82F6' }}>
                        {emp.plan_type || 'trial'}
                      </TableCell>
                      <TableCell sx={{ fontSize: 12, fontWeight: 600, color: dias > 0 || emp.plan_type === 'premium' ? 'text.primary' : '#EF4444' }}>
                        {emp.plan_type === 'premium' ? 'Ilimitado' : (
                          <>
                            {emp.trial_ends_at ? new Date(emp.trial_ends_at).toLocaleDateString() : 'N/A'}
                            <Typography variant="caption" display="block" color={dias > 0 ? '#10B981' : '#EF4444'}>
                              {dias > 0 ? `Quedan ${dias} días` : 'Expirado'}
                            </Typography>
                          </>
                        )}
                      </TableCell>
                      <TableCell align="right">
                        <Tooltip title="Gestionar Suscripción">
                          <span>
                            <IconButton size="small" disabled={emp.id === 1} onClick={() => handleOpenPlan(emp)} sx={{ color: '#8B5CF6', mr: 1 }}>
                              <CardMembership fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                        <Tooltip title={emp.is_active ? "Suspender" : "Reactivar"}>
                          <span>
                            <IconButton size="small" disabled={emp.id === 1} onClick={() => handleToggleStatus(emp.id, emp.is_active)} sx={{ color: emp.is_active ? '#EF4444' : '#10B981' }}>
                              {emp.is_active ? <Block fontSize="small" /> : <CheckCircle fontSize="small" />}
                            </IconButton>
                          </span>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {/* ── Modal: Crear Empresa ── */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth fullScreen={isMobile} PaperProps={{ sx: { borderRadius: isMobile ? 0 : 3 } }}>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1 }}>
          <Box>
            <Typography sx={{ fontWeight: 700, fontSize: 17 }}>Alta de nuevo Cliente</Typography>
            <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>Se crearán automáticamente 14 días de prueba</Typography>
          </Box>
          <IconButton size="small" onClick={() => setOpenDialog(false)}><Close fontSize="small" /></IconButton>
        </DialogTitle>
        <form onSubmit={handleSubmit}>
          <DialogContent dividers>
            <Stack spacing={2} sx={{ mb: 3 }}>
              <TextField label="Nombre comercial de la empresa" required size="small" value={formData.nombre} onChange={e => setFormData({...formData, nombre: e.target.value})} />
              <TextField label="NIT / RUC" size="small" value={formData.nit} onChange={e => setFormData({...formData, nit: e.target.value})} />
            </Stack>
            <Typography sx={{ fontSize: 11, fontWeight: 600, color: 'text.secondary', mb: 1.5, textTransform: 'uppercase' }}>Credenciales del Dueño (Primer Admin)</Typography>
            <Stack spacing={2}>
              <TextField label="Usuario (Ej: admin_empresa)" required size="small" value={formData.admin_username} onChange={e => setFormData({...formData, admin_username: e.target.value})} />
              <TextField label="Contraseña temporal" required type="password" size="small" value={formData.admin_password} onChange={e => setFormData({...formData, admin_password: e.target.value})} />
            </Stack>
          </DialogContent>
          <DialogActions sx={{ p: 2, gap: 1 }}>
            <Button onClick={() => setOpenDialog(false)} variant="outlined" sx={{ borderRadius: 2, fontWeight: 600, borderColor: 'divider', flex: isMobile ? 1 : 'auto' }}>Cancelar</Button>
            <Button type="submit" variant="contained" disabled={loading} sx={{ bgcolor: ACCENT, '&:hover': { bgcolor: '#e11d48' }, borderRadius: 2, fontWeight: 600, flex: isMobile ? 1 : 'auto' }}>
              {loading ? 'Creando...' : 'Crear Inquilino'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* ── Modal: Gestionar Suscripción ── */}
      <Dialog open={openPlanDialog} onClose={() => setOpenPlanDialog(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography sx={{ fontWeight: 700, fontSize: 17 }}>Suscripción: {empresaSeleccionada?.nombre}</Typography>
          <IconButton size="small" onClick={() => setOpenPlanDialog(false)}><Close fontSize="small" /></IconButton>
        </DialogTitle>
        <form onSubmit={handleUpdatePlan}>
          <DialogContent dividers>
            <Stack spacing={3}>
              <TextField select label="Tipo de Plan" value={planData.plan_type} onChange={e => setPlanData({...planData, plan_type: e.target.value})} fullWidth>
                <MenuItem value="trial">Trial (Prueba Gratuita)</MenuItem>
                <MenuItem value="premium">Premium (Suscripción Pagada)</MenuItem>
              </TextField>

              <Box>
                <Typography sx={{ fontSize: 12, fontWeight: 600, color: 'text.secondary', mb: 1 }}>Fecha de Vencimiento</Typography>
                <TextField type="date" value={planData.trial_ends_at} onChange={e => setPlanData({...planData, trial_ends_at: e.target.value})} fullWidth />
                
                <Box sx={{ display: 'flex', gap: 1, mt: 1.5, flexWrap: 'wrap' }}>
                  <Button size="small" variant="outlined" onClick={() => handleAddDays(7)} sx={{ fontSize: 11, borderRadius: 2 }}>+7 Días</Button>
                  <Button size="small" variant="outlined" onClick={() => handleAddDays(14)} sx={{ fontSize: 11, borderRadius: 2 }}>+14 Días</Button>
                  <Button size="small" variant="outlined" onClick={() => handleAddDays(30)} sx={{ fontSize: 11, borderRadius: 2 }}>+1 Mes</Button>
                </Box>
              </Box>
            </Stack>
          </DialogContent>
          <DialogActions sx={{ p: 2, gap: 1 }}>
            <Button onClick={() => setOpenPlanDialog(false)} variant="outlined" sx={{ borderRadius: 2, fontWeight: 600, borderColor: 'divider' }}>Cancelar</Button>
            <Button type="submit" variant="contained" disabled={loading} sx={{ bgcolor: '#8B5CF6', '&:hover': { bgcolor: '#7C3AED' }, borderRadius: 2, fontWeight: 600 }}>
              {loading ? 'Guardando...' : 'Guardar Cambios'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
}