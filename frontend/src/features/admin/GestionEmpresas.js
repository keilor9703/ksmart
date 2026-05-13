import React, { useState } from 'react';
import {
  Box, Typography, Paper, Button, Grid, useTheme, useMediaQuery, 
  Tabs, Tab, IconButton, TextField, InputAdornment, Dialog, DialogTitle, 
  DialogContent, DialogActions, Stack, MenuItem, FormControlLabel, Switch, Chip,Divider
} from '@mui/material';
import { 
  Add, AdminPanelSettings, Autorenew, TrendingUp, Business, LocalOffer, 
  History, Campaign, Engineering, ReceiptLong, Search, Edit, Payments
} from '@mui/icons-material';
import { toast } from 'react-toastify';

import apiClient, { createPlan, updatePlan } from '../../api';
import { useSaaSData } from '../../hooks/useSaaSData';
import CurrencyField from '../../components/common/CurrencyField';
import ModulosEmpresaDialog from './ModulosEmpresaDialog';

// Componentes Refactorizados
import SaaSOverview from './components/SaaSOverview';
import TenantsTable from './components/TenantsTable';
import TenantDrawer360 from './components/TenantDrawer360';
import AuditLogsTable from './components/AuditLogsTable';
import AnnouncementsManager from './components/AnnouncementsManager';
import JobsControl from './components/JobsControl';
import PlanFormDialog from './components/PlanFormDialog'; // ✅ Nuevo Componente Importado

const ACCENT = '#F43F5E';
const BLUE = '#3B82F6';
const PURPLE = '#8B5CF6';
const GREEN = '#10B981';

// Componente TabPanel con la lógica de limpieza de desbordamiento
function TabPanel({ children, value, index }) {
  return (
    <div role="tabpanel" hidden={value !== index}>
      {value === index && (
        <Box sx={{ pt: { xs: 1, md: 2 }, width: '100%', maxWidth: '100%', overflowX: 'hidden', boxSizing: 'border-box' }}>
          {children}
        </Box>
      )}
    </div>
  );
}

const TABS_CONFIG = [
  { label: 'Overview', icon: <TrendingUp fontSize="small" />, fullLabel: 'Resumen Global' },
  { label: 'Inquilinos', icon: <Business fontSize="small" />, fullLabel: 'Gestión de Clientes' },
  { label: 'Planes', icon: <LocalOffer fontSize="small" />, fullLabel: 'Catálogo de Planes' },
  { label: 'Auditoría', icon: <History fontSize="small" />, fullLabel: 'Logs del Sistema' },
  { label: 'Avisos', icon: <Campaign fontSize="small" />, fullLabel: 'Comunicación SaaS' },
  { label: 'Tareas', icon: <Engineering fontSize="small" />, fullLabel: 'Jobs del Sistema' },
  { label: 'Finanzas', icon: <ReceiptLong fontSize="small" />, fullLabel: 'Control de Pagos' },
];

const formatDateForInput = (dateString) => dateString ? new Date(dateString).toISOString().split('T')[0] : '';

export default function GestionSaaS() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
  const {
    loading, filteredEmpresas, planesCatalog, pagos, stats, auditLogs,
    announcements, searchTerm, setSearchTerm, filterState, setFilterState,
    refreshAll, handleToggleStatus, handleToggleAnnouncement, handleToggleProtection,
    handleImpersonate, fetchCatalogoPlanes, fetchAnnouncements
  } = useSaaSData();

  const [tabValue, setTabValue] = useState(0);
  const [openDrawer, setOpenDrawer] = useState(false);
  const [tenantForDrawer, setTenantForDrawer] = useState(null);
  const [openDialogEmpresa, setOpenDialogEmpresa] = useState(false);
  const [formEmpresa, setFormEmpresa] = useState({ 
    nombre: '', nit: '', admin_username: '', admin_password: '', 
    admin_nombre_completo: '', admin_email: '', admin_telefono: '', tipo_negocio: 'erp' 
  });
  const [openPlanDialog, setOpenPlanDialog] = useState(false);
  const [empresaSeleccionada, setEmpresaSeleccionada] = useState(null);
  const [formAsignarPlan, setFormAsignarPlan] = useState({ plan_type: 'trial', plan_selector: 'trial', trial_ends_at: '' });
  const [openCatalogDialog, setOpenCatalogDialog] = useState(false);
  const [editingPlanId, setEditingPlanId] = useState(null);
  const [formPlan, setFormPlan] = useState({ nombre: '', codigo_interno: '', precio: '', dias_duracion: '', caracteristicas: '', is_active: true });
  const [openModulosDialog, setOpenModulosDialog] = useState(false);
  const [empresaParaModulos, setEmpresaParaModulos] = useState(null);

  const handleOpenDrawer = (tenant) => { setTenantForDrawer(tenant); setOpenDrawer(true); };

  const handleOpenModulos = (empresa) => {
    setEmpresaParaModulos(empresa);
    setOpenModulosDialog(true);
  };

  const handleSubmitEmpresa = async (e) => {
    e.preventDefault();
    try {
      await apiClient.post('/superadmin/empresas', { 
        empresa: { nombre: formEmpresa.nombre, nit: formEmpresa.nit, tipo_negocio: formEmpresa.tipo_negocio },
        admin_username: formEmpresa.admin_username, admin_password: formEmpresa.admin_password,
        admin_nombre_completo: formEmpresa.admin_nombre_completo, admin_email: formEmpresa.admin_email, admin_telefono: formEmpresa.admin_telefono
      });
      toast.success('Empresa registrada con éxito.');
      setOpenDialogEmpresa(false);
      refreshAll();
    } catch (err) { toast.error('Error: ' + (err.response?.data?.detail || 'No se pudo crear')); }
  };

  const handleOpenAsignarPlan = (empresa) => {
    setEmpresaSeleccionada(empresa);
    setFormAsignarPlan({ plan_type: empresa.plan_type || 'trial', plan_selector: empresa.plan_type || 'trial', trial_ends_at: formatDateForInput(empresa.trial_ends_at) });
    setOpenPlanDialog(true);
  };

  const handleSelectPlanChange = (e) => {
    const selectedValue = e.target.value;
    let newDate = formAsignarPlan.trial_ends_at;
    let realPlanType = 'premium';
    if (selectedValue === 'trial' || selectedValue === 'premium') { realPlanType = selectedValue; } else {
      const planObj = planesCatalog.find(p => p.codigo_interno === selectedValue);
      if (planObj) { 
        const today = new Date(); today.setDate(today.getDate() + planObj.dias_duracion); 
        newDate = today.toISOString().split('T')[0]; 
      }
    }
    setFormAsignarPlan({ ...formAsignarPlan, plan_type: realPlanType, plan_selector: selectedValue, trial_ends_at: newDate });
  };

  const handleUpdateSuscripcion = async (e) => {
    e.preventDefault();
    try {
      // Forzamos el fin del día en la zona horaria de Colombia (-05:00) para evitar saltos de día al convertir a UTC
      const trial_ends_at = formAsignarPlan.trial_ends_at 
        ? new Date(formAsignarPlan.trial_ends_at + 'T23:59:59-05:00').toISOString() 
        : null;

      await apiClient.patch(`/superadmin/empresas/${empresaSeleccionada.id}/plan`, { 
        plan_type: formAsignarPlan.plan_type, 
        trial_ends_at
      });
      toast.success('Suscripción actualizada');
      setOpenPlanDialog(false);
      setOpenDrawer(false);
      refreshAll();
    } catch (err) { toast.error('Error al actualizar el plan'); }
  };

  const handleSubmitPlan = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...formPlan, precio: Number(formPlan.precio), dias_duracion: Number(formPlan.dias_duracion) };
      if (editingPlanId) await updatePlan(editingPlanId, payload);
      else await createPlan(payload);
      toast.success('Plan guardado.');
      setOpenCatalogDialog(false);
      fetchCatalogoPlanes();
    } catch (err) { toast.error('Error al guardar el plan.'); }
  };

  return (
    <Box sx={{ width: '100%', maxWidth: '100%', overflowX: 'hidden', boxSizing: 'border-box', pb: 4 }}>
      
      {/* ── HEADER PRINCIPAL ── */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2.5, gap: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
          <Box sx={{ width: 40, height: 40, borderRadius: 2, bgcolor: `${ACCENT}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: ACCENT, flexShrink: 0 }}>
            <AdminPanelSettings />
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontWeight: 800, fontSize: { xs: 16, sm: 20 }, lineHeight: 1.2, noWrap: true }}>SaaS Center</Typography>
            {!isMobile && <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>Administración Global</Typography>}
          </Box>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button 
            variant="contained" 
            size={isMobile ? "small" : "medium"}
            startIcon={<Add />} 
            onClick={() => setOpenDialogEmpresa(true)} 
            sx={{ bgcolor: ACCENT, borderRadius: 2, fontWeight: 700, px: { xs: 1.5, sm: 3 } }}
          >
            {isMobile ? 'Nuevo' : 'Nueva Empresa'}
          </Button>
          <IconButton onClick={refreshAll} disabled={loading} size="small" sx={{ bgcolor: 'action.hover' }}><Autorenew fontSize="small" /></IconButton>
        </Box>
      </Box>

      {/* ── CONTENEDOR TABS Y CONTENIDO ── */}
      <Box sx={{ 
        borderRadius: 3, 
        boxShadow: '0 2px 12px rgba(0,0,0,0.06)', 
        border: '1px solid', 
        borderColor: 'divider', 
        bgcolor: 'background.paper', 
        width: '100%', 
        boxSizing: 'border-box',
        overflow: 'hidden'
      }}>
        <Tabs 
          value={tabValue} 
          onChange={(_, v) => setTabValue(v)} 
          variant={isMobile ? 'fullWidth' : 'scrollable'}
          scrollButtons={isMobile ? false : 'auto'}
          sx={{ 
            borderBottom: '1px solid', borderColor: 'divider',
            '& .MuiTab-root': { 
              fontWeight: 700, 
              fontSize: 11, 
              textTransform: 'none', 
              minHeight: isMobile ? 50 : 56,
              minWidth: isMobile ? 0 : 'auto',
              px: isMobile ? 0.5 : 2.5
            },
            '& .MuiTabs-indicator': { backgroundColor: ACCENT, height: 3, borderRadius: 3 },
            '& .Mui-selected': { color: `${ACCENT} !important` }
          }}
        >
          {TABS_CONFIG.map((t, i) => (
            <Tab 
              key={i} 
              icon={t.icon} 
              iconPosition={isMobile ? 'top' : 'start'} 
              label={isMobile ? undefined : t.label} 
              sx={isMobile ? { gap: 0, '& .MuiTab-iconWrapper': { mb: 0 } } : { gap: 1 }}
            />
          ))}
        </Tabs>

        {isMobile && (
          <Box sx={{ px: 2, pt: 1.5, pb: 0 }}>
            <Typography sx={{ fontWeight: 700, fontSize: 13, color: ACCENT }}>
              {TABS_CONFIG[tabValue].fullLabel}
            </Typography>
          </Box>
        )}

        {/* ── CONTENIDO DINÁMICO ── */}
        <Box sx={{ p: { xs: 1.5, md: 3 } }}>
          <TabPanel value={tabValue} index={0}>
            <SaaSOverview stats={stats} empresas={filteredEmpresas} onViewTenants={() => setTabValue(1)} onOpenTenant={handleOpenDrawer} />
          </TabPanel>
          
          <TabPanel value={tabValue} index={1}>
            <Box sx={{ mb: 2 }}>
              <TextField 
                size="small" fullWidth placeholder="Buscar cliente..." 
                value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} 
                InputProps={{ startAdornment: <InputAdornment position="start"><Search /></InputAdornment> }} 
              />
              <Box sx={{ display: 'flex', gap: 1, overflowX: 'auto', py: 1.5, '&::-webkit-scrollbar': { display: 'none' } }}>
                {[{ id: 'all', label: 'Todos' }, { id: 'premium', label: 'Premium' }, { id: 'trial', label: 'Trials' }, { id: 'expired', label: 'Expirados' }].map(f => (
                  <Chip 
                    key={f.id} label={f.label} size="small" onClick={() => setFilterState(f.id)} 
                    sx={{ fontWeight: 700, flexShrink: 0, bgcolor: filterState === f.id ? BLUE : 'transparent', color: filterState === f.id ? 'white' : 'text.primary' }} 
                  />
                ))}
              </Box>
            </Box>
            <Box sx={{ width: '100%', overflowX: 'auto' }}>
              <TenantsTable 
                empresas={filteredEmpresas} onOpenDrawer={handleOpenDrawer} onImpersonate={handleImpersonate} 
                onOpenPlan={handleOpenAsignarPlan} onOpenModulos={handleOpenModulos} onToggleProtection={handleToggleProtection} 
              />
            </Box>
          </TabPanel>

          <TabPanel value={tabValue} index={2}>
            <Grid container spacing={2}>
              {planesCatalog.map((plan) => (
                <Grid item xs={12} sm={6} md={4} key={plan.id}>
                  <Paper sx={{ p: 2, borderRadius: 3, border: '1px solid', borderColor: plan.is_active ? 'divider' : '#fca5a5' }}>
                    <Typography sx={{ fontWeight: 800, color: BLUE }}>{plan.nombre}</Typography>
                    <Typography sx={{ fontSize: 24, fontWeight: 800, my: 1 }}>
                      ${new Intl.NumberFormat().format(plan.precio)}
                    </Typography>
                    <Button fullWidth variant="outlined" startIcon={<Edit />} size="small" onClick={() => { setEditingPlanId(plan.id); setFormPlan({...plan}); setOpenCatalogDialog(true); }}>Editar</Button>
                  </Paper>
                </Grid>
              ))}
              <Grid item xs={12} sm={6} md={4}>
                <Button fullWidth onClick={() => { setEditingPlanId(null); setFormPlan({ nombre: '', codigo_interno: '', precio: '', dias_duracion: '', caracteristicas: '', is_active: true }); setOpenCatalogDialog(true); }} sx={{ border: '2px dashed #CBD5E1', height: '100%', minHeight: 100, borderRadius: 3 }}>
                   <Stack alignItems="center"><Add /><Typography sx={{ fontWeight: 700 }}>Nuevo Plan</Typography></Stack>
                </Button>
              </Grid>
            </Grid>
          </TabPanel>

          <TabPanel value={tabValue} index={3}><AuditLogsTable logs={auditLogs} /></TabPanel>
          <TabPanel value={tabValue} index={4}><AnnouncementsManager announcements={announcements} onRefresh={fetchAnnouncements} onToggle={handleToggleAnnouncement} /></TabPanel>
          <TabPanel value={tabValue} index={5}><JobsControl /></TabPanel>
          
          <TabPanel value={tabValue} index={6}>
            <Paper sx={{ p: 2, borderRadius: 3, bgcolor: `${GREEN}08`, border: `1px solid ${GREEN}20` }}>
              <Typography variant="caption" sx={{ fontWeight: 800, color: GREEN, textTransform: 'uppercase' }}>Ingresos Totales</Typography>
              <Typography sx={{ fontWeight: 900, fontSize: 28, color: GREEN }}>
                ${new Intl.NumberFormat().format(pagos.reduce((acc, p) => acc + p.monto, 0))}
              </Typography>
              <Button variant="contained" startIcon={<Payments />} fullWidth sx={{ mt: 2, bgcolor: GREEN }}>Exportar CSV</Button>
            </Paper>
          </TabPanel>
        </Box>
      </Box>

      {/* ── DIALOGS ── */}
      <TenantDrawer360 
        open={openDrawer} onClose={() => setOpenDrawer(false)} tenant={tenantForDrawer} 
        onImpersonate={handleImpersonate} onOpenPlan={handleOpenAsignarPlan}
        onOpenModulos={handleOpenModulos}
        onToggleStatus={async (id, status) => { if(await handleToggleStatus(id, status)) setOpenDrawer(false); }}
      />

      <ModulosEmpresaDialog 
        open={openModulosDialog} 
        handleClose={() => setOpenModulosDialog(false)} 
        empresa={empresaParaModulos}
        onModulosUpdated={refreshAll}
      />

      <Dialog open={openPlanDialog} onClose={() => setOpenPlanDialog(false)} fullScreen={isMobile} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>Gestionar Suscripción</DialogTitle>
        <form onSubmit={handleUpdateSuscripcion}>
          <DialogContent>
            <Stack spacing={3} sx={{ mt: 1 }}>
              <TextField
                select
                fullWidth
                label="Seleccionar Plan"
                value={formAsignarPlan.plan_selector}
                onChange={handleSelectPlanChange}
                size="small"
              >
                <MenuItem value="trial">Trial (Prueba Corta)</MenuItem>
                <MenuItem value="premium">Premium (Manual)</MenuItem>
                <Divider />
                {planesCatalog.map(p => (
                  <MenuItem key={p.id} value={p.codigo_interno}>
                    {p.nombre} (${new Intl.NumberFormat().format(p.precio)})
                  </MenuItem>
                ))}
              </TextField>

              <TextField
                label="Fecha de Vencimiento"
                type="date"
                fullWidth
                size="small"
                InputLabelProps={{ shrink: true }}
                value={formAsignarPlan.trial_ends_at}
                onChange={(e) => setFormAsignarPlan({ ...formAsignarPlan, trial_ends_at: e.target.value })}
              />
            </Stack>
          </DialogContent>
          <DialogActions sx={{ p: 2.5 }}>
            <Button onClick={() => setOpenPlanDialog(false)} sx={{ fontWeight: 700 }}>Cancelar</Button>
            <Button type="submit" variant="contained" sx={{ bgcolor: BLUE, fontWeight: 700 }}>Actualizar Plan</Button>
          </DialogActions>
        </form>
      </Dialog>

      <Dialog open={openDialogEmpresa} onClose={() => setOpenDialogEmpresa(false)} fullScreen={isMobile} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>Nuevo Cliente SaaS</DialogTitle>
        <form onSubmit={handleSubmitEmpresa}>
          <DialogContent>
            <Stack spacing={2.5}>
              <TextField label="Nombre Empresa" required fullWidth size="small" value={formEmpresa.nombre} onChange={e => setFormEmpresa({...formEmpresa, nombre: e.target.value})} />
              <TextField label="NIT" fullWidth size="small" value={formEmpresa.nit} onChange={e => setFormEmpresa({...formEmpresa, nit: e.target.value})} />
              <TextField select label="Perfil de Negocio" value={formEmpresa.tipo_negocio} onChange={e => setFormEmpresa({...formEmpresa, tipo_negocio: e.target.value})} fullWidth size="small">
                <MenuItem value="erp">Comercio / ERP</MenuItem>
                <MenuItem value="prestamos">Prestamista / Cobranzas</MenuItem>
                <MenuItem value="parqueadero">Parqueadero / Parking</MenuItem>
              </TextField>
              
              <Divider><Chip label="DATOS DEL ADMINISTRADOR" size="small" /></Divider>
              
              <TextField label="Nombre Completo" required fullWidth size="small" value={formEmpresa.admin_nombre_completo} onChange={e => setFormEmpresa({...formEmpresa, admin_nombre_completo: e.target.value})} />
              
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <TextField label="Correo Electrónico" type="email" required fullWidth size="small" value={formEmpresa.admin_email} onChange={e => setFormEmpresa({...formEmpresa, admin_email: e.target.value})} />
                </Grid>
                <Grid item xs={6}>
                  <TextField label="WhatsApp / Teléfono" required fullWidth size="small" value={formEmpresa.admin_telefono} onChange={e => setFormEmpresa({...formEmpresa, admin_telefono: e.target.value})} />
                </Grid>
              </Grid>

              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <TextField label="Usuario de Ingreso" required fullWidth size="small" value={formEmpresa.admin_username} onChange={e => setFormEmpresa({...formEmpresa, admin_username: e.target.value})} />
                </Grid>
                <Grid item xs={6}>
                  <TextField label="Contraseña" required type="password" fullWidth size="small" value={formEmpresa.admin_password} onChange={e => setFormEmpresa({...formEmpresa, admin_password: e.target.value})} />
                </Grid>
              </Grid>
            </Stack>
          </DialogContent>
          <DialogActions sx={{ p: 2 }}>
            <Button onClick={() => setOpenDialogEmpresa(false)}>Cerrar</Button>
            <Button type="submit" variant="contained" sx={{ bgcolor: ACCENT }}>Crear Inquilino</Button>
          </DialogActions>
        </form>
      </Dialog>
      
      {/* ✅ Componente Refactorizado de Planes */}
      <PlanFormDialog 
        open={openCatalogDialog}
        onClose={() => setOpenCatalogDialog(false)}
        onSubmit={handleSubmitPlan}
        formPlan={formPlan}
        setFormPlan={setFormPlan}
        isEditing={!!editingPlanId}
      />

    </Box>
  );
}