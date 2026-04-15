import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Button, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Chip, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, Stack, 
  Tooltip, Grid, Divider, useTheme, useMediaQuery
} from '@mui/material';
import { Add, Business, Block, CheckCircle, AdminPanelSettings, Close } from '@mui/icons-material';
import { toast } from 'react-toastify';
import apiClient from '../api';

const ACCENT = '#F43F5E';

// ── Card Mobile para Empresas ──
const EmpresaCard = ({ empresa, onToggleStatus }) => (
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
          <Typography sx={{ fontSize: 10, color: 'text.secondary', mb: 0.2 }}>Registro</Typography>
          <Typography sx={{ fontSize: 13, fontWeight: 700 }}>
            {new Date(empresa.created_at).toLocaleDateString()}
          </Typography>
        </Box>
      </Grid>
      <Grid item xs={6}>
        <Box sx={{ textAlign: 'center', p: 1, borderRadius: 2, bgcolor: 'action.hover' }}>
          <Typography sx={{ fontSize: 10, color: 'text.secondary', mb: 0.2 }}>Estado</Typography>
          <Typography sx={{ fontSize: 13, fontWeight: 700, color: empresa.is_active ? '#10B981' : '#EF4444' }}>
            {empresa.is_active ? '✓ Operando' : '✕ Inactiva'}
          </Typography>
        </Box>
      </Grid>
    </Grid>

    <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
      <Tooltip title={empresa.is_active ? "Suspender servicio" : "Reactivar servicio"}>
        <span>
          <IconButton 
            size="small" 
            disabled={empresa.id === 1} 
            onClick={() => onToggleStatus(empresa.id, empresa.is_active)}
            sx={{ 
              color: empresa.is_active ? '#EF4444' : '#10B981', 
              bgcolor: empresa.is_active ? '#FEF2F2' : '#F0FDF4', 
              borderRadius: 1.5 
            }}
          >
            {empresa.is_active ? <Block fontSize="small" /> : <CheckCircle fontSize="small" />}
          </IconButton>
        </span>
      </Tooltip>
    </Box>
  </Paper>
);

export default function GestionEmpresas() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [empresas, setEmpresas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [openDialog, setOpenDialog] = useState(false);

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
      {/* ── Header ── */}
      <Box sx={{ 
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
        mb: 3, flexWrap: 'wrap', gap: 2 
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ 
            width: 40, height: 40, borderRadius: 2, 
            bgcolor: `${ACCENT}18`, display: 'flex', 
            alignItems: 'center', justifyContent: 'center', color: ACCENT 
          }}>
            <AdminPanelSettings />
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 700, fontSize: 20, lineHeight: 1.2 }}>
              Clientes SaaS
            </Typography>
            <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>
              Gestión de inquilinos (Tenants)
            </Typography>
          </Box>
        </Box>
        <Button 
          variant="contained" 
          startIcon={<Add />} 
          onClick={() => setOpenDialog(true)}
          sx={{ 
            bgcolor: ACCENT, 
            '&:hover': { bgcolor: '#e11d48' }, 
            borderRadius: 2, fontWeight: 600,
            boxShadow: `0 4px 14px rgba(244,63,94,0.35)`
          }}
        >
          Nueva Empresa
        </Button>
      </Box>

      {/* ── Contenido Responsive ── */}
      <Paper sx={{ 
        borderRadius: 3, 
        boxShadow: '0 2px 12px rgba(0,0,0,0.06)', 
        overflow: 'hidden' 
      }}>
        {isMobile ? (
          <Box sx={{ p: 2 }}>
            {empresas.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 6, color: 'text.secondary' }}>
                <Business sx={{ fontSize: 48, mb: 1, opacity: 0.3 }} />
                <Typography>No hay empresas registradas</Typography>
              </Box>
            ) : (
              empresas.map(emp => (
                <EmpresaCard 
                  key={emp.id} 
                  empresa={emp} 
                  onToggleStatus={handleToggleStatus} 
                />
              ))
            )}
          </Box>
        ) : (
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
                      <Chip 
                        label={emp.is_active ? 'Activa' : 'Suspendida'} 
                        size="small"
                        sx={{ 
                          bgcolor: emp.is_active ? '#10B98120' : '#EF444420', 
                          color: emp.is_active ? '#10B981' : '#EF4444', 
                          fontWeight: 600, fontSize: 11, borderRadius: 1.5 
                        }} 
                      />
                    </TableCell>
                    <TableCell sx={{ fontSize: 12 }}>
                      {new Date(emp.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Tooltip title={emp.is_active ? "Suspender servicio" : "Reactivar servicio"}>
                        <span>
                          <IconButton 
                            size="small" 
                            disabled={emp.id === 1} 
                            onClick={() => handleToggleStatus(emp.id, emp.is_active)}
                            sx={{ color: emp.is_active ? '#EF4444' : '#10B981' }}
                          >
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
        )}
      </Paper>

      {/* ── Modal Crear Empresa ── */}
      <Dialog 
        open={openDialog} 
        onClose={() => setOpenDialog(false)} 
        maxWidth="sm" 
        fullWidth 
        fullScreen={isMobile}
        PaperProps={{ sx: { borderRadius: isMobile ? 0 : 3 } }}
      >
        <DialogTitle sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          pb: 1 
        }}>
          <Box>
            <Typography sx={{ fontWeight: 700, fontSize: 17 }}>
              Alta de nuevo Cliente (Tenant)
            </Typography>
            <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
              Configuración inicial de inquilino
            </Typography>
          </Box>
          <IconButton size="small" onClick={() => setOpenDialog(false)}>
            <Close fontSize="small" />
          </IconButton>
        </DialogTitle>

        <form onSubmit={handleSubmit}>
          <DialogContent dividers>
            <Typography sx={{ 
              fontSize: 11, fontWeight: 600, color: 'text.secondary', 
              mb: 1.5, textTransform: 'uppercase', letterSpacing: 0.6 
            }}>
              Datos de la Empresa
            </Typography>
            <Stack spacing={2} sx={{ mb: 3 }}>
              <TextField 
                label="Nombre comercial de la empresa" 
                required 
                size="small" 
                value={formData.nombre} 
                onChange={e => setFormData({...formData, nombre: e.target.value})} 
              />
              <TextField 
                label="NIT / RUC" 
                size="small" 
                value={formData.nit} 
                onChange={e => setFormData({...formData, nit: e.target.value})} 
              />
            </Stack>

            <Typography sx={{ 
              fontSize: 11, fontWeight: 600, color: 'text.secondary', 
              mb: 1.5, textTransform: 'uppercase', letterSpacing: 0.6 
            }}>
              Credenciales del Dueño (Primer Admin)
            </Typography>
            <Stack spacing={2}>
              <TextField 
                label="Usuario (Ej: admin_empresa)" 
                required 
                size="small" 
                value={formData.admin_username} 
                onChange={e => setFormData({...formData, admin_username: e.target.value})} 
              />
              <TextField 
                label="Contraseña temporal" 
                required 
                type="password" 
                size="small" 
                value={formData.admin_password} 
                onChange={e => setFormData({...formData, admin_password: e.target.value})} 
              />
            </Stack>
          </DialogContent>

          <DialogActions sx={{ p: 2, gap: 1 }}>
            <Button 
              onClick={() => setOpenDialog(false)} 
              variant="outlined"
              sx={{ borderRadius: 2, fontWeight: 600, borderColor: 'divider', flex: isMobile ? 1 : 'auto' }}
            >
              Cancelar
            </Button>
            <Button 
              type="submit" 
              variant="contained" 
              disabled={loading} 
              sx={{ 
                bgcolor: ACCENT, 
                '&:hover': { bgcolor: '#e11d48' },
                borderRadius: 2, 
                fontWeight: 600,
                flex: isMobile ? 1 : 'auto'
              }}
            >
              {loading ? 'Creando...' : 'Crear Inquilino'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
}