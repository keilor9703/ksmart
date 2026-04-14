import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Button, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Chip, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, Stack, Tooltip
} from '@mui/material';
import { Add, Business, Block, CheckCircle, AdminPanelSettings } from '@mui/icons-material';
import { toast } from 'react-toastify';
import apiClient from '../api';

const ACCENT = '#F43F5E';

export default function GestionEmpresas() {
  const [empresas, setEmpresas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [openDialog, setOpenDialog] = useState(false);

  // Formulario para crear empresa y su primer admin
  const [formData, setFormData] = useState({
    nombre: '', nit: '', admin_username: '', admin_password: ''
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await apiClient.post('/superadmin/empresas', {
        empresa: { nombre: formData.nombre, nit: formData.nit, color_primario: '#3B82F6' },
        admin_username: formData.admin_username,
        admin_password: formData.admin_password
      });
      toast.success('Empresa registrada. El cliente ya puede iniciar sesión.');
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
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ width: 42, height: 42, borderRadius: 2, bgcolor: `${ACCENT}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: ACCENT }}>
            <AdminPanelSettings />
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 700, fontSize: 20 }}>Clientes SaaS</Typography>
            <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>Gestión de inquilinos (Tenants)</Typography>
          </Box>
        </Box>
        <Button variant="contained" startIcon={<Add />} onClick={() => setOpenDialog(true)}
          sx={{ bgcolor: ACCENT, '&:hover': { bgcolor: '#e11d48' }, borderRadius: 2, fontWeight: 600 }}>
          Registrar Empresa
        </Button>
      </Box>

      <Paper sx={{ borderRadius: 3, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>ID</TableCell>
                <TableCell>Nombre de Empresa</TableCell>
                <TableCell>NIT / Doc</TableCell>
                <TableCell>Estado Suscripción</TableCell>
                <TableCell>Registro</TableCell>
                <TableCell>Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {empresas.map((emp) => (
                <TableRow key={emp.id} hover>
                  <TableCell>#{emp.id}</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>{emp.nombre}</TableCell>
                  <TableCell sx={{ color: 'text.secondary' }}>{emp.nit || 'N/A'}</TableCell>
                  <TableCell>
                    <Chip label={emp.is_active ? 'Activa' : 'Suspendida'} size="small"
                      sx={{ bgcolor: emp.is_active ? '#10B98120' : '#EF444420', color: emp.is_active ? '#10B981' : '#EF4444', fontWeight: 600, fontSize: 11 }} />
                  </TableCell>
                  <TableCell sx={{ fontSize: 12 }}>{new Date(emp.created_at).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <Tooltip title={emp.is_active ? "Suspender servicio" : "Reactivar servicio"}>
                      <span>
                        <IconButton size="small" disabled={emp.id === 1} onClick={() => handleToggleStatus(emp.id, emp.is_active)}
                          sx={{ color: emp.is_active ? '#EF4444' : '#10B981' }}>
                          {emp.is_active ? <Block fontSize="small" /> : <CheckCircle fontSize="small" />}
                        </IconButton>
                      </span>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Modal Crear Empresa */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 700 }}>Alta de nuevo Cliente (Tenant)</DialogTitle>
        <form onSubmit={handleSubmit}>
          <DialogContent dividers>
            <Typography sx={{ fontSize: 12, fontWeight: 600, color: 'text.secondary', mb: 1, textTransform: 'uppercase' }}>Datos de la Empresa</Typography>
            <Stack spacing={2} sx={{ mb: 3 }}>
              <TextField label="Nombre comercial de la empresa" required size="small" value={formData.nombre} onChange={e => setFormData({...formData, nombre: e.target.value})} />
              <TextField label="NIT / RUC" size="small" value={formData.nit} onChange={e => setFormData({...formData, nit: e.target.value})} />
            </Stack>

            <Typography sx={{ fontSize: 12, fontWeight: 600, color: 'text.secondary', mb: 1, textTransform: 'uppercase' }}>Credenciales del Dueño (Primer Admin)</Typography>
            <Stack spacing={2}>
              <TextField label="Usuario (Ej: admin_empresa)" required size="small" value={formData.admin_username} onChange={e => setFormData({...formData, admin_username: e.target.value})} />
              <TextField label="Contraseña temporal" required type="password" size="small" value={formData.admin_password} onChange={e => setFormData({...formData, admin_password: e.target.value})} />
            </Stack>
          </DialogContent>
          <DialogActions sx={{ p: 2 }}>
            <Button onClick={() => setOpenDialog(false)} color="inherit">Cancelar</Button>
            <Button type="submit" variant="contained" disabled={loading} sx={{ bgcolor: ACCENT }}>{loading ? 'Creando...' : 'Crear Inquilino'}</Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
}