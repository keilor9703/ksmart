import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Button, Grid, useTheme, useMediaQuery,
  Tabs, Tab, IconButton, TextField, InputAdornment, Dialog, DialogTitle,
  DialogContent, DialogActions, Stack, MenuItem, FormControlLabel, Switch, Chip, Divider, Collapse,
  Table, TableHead, TableRow, TableCell, TableBody, TableContainer, CircularProgress, FormGroup
} from '@mui/material';
import {
  Add, AdminPanelSettings, Autorenew, TrendingUp, Business, LocalOffer,
  History, Campaign, Engineering, ReceiptLong, Search, Edit, Payments,
  ExpandLess, ExpandMore, Warning, SupportAgent, DeleteForever, Tune,
  ViewModule, Close, Storefront,
} from '@mui/icons-material';
import { toast } from 'react-toastify';

import apiClient, { createPlan, updatePlan, fetchTiposNegocio, updateTipoNegocio } from '../../api';
import { APP_MODULES } from '../../utils/modulesConfig';
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
import PlataformaConfigForm from './components/PlataformaConfigForm';

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
  { label: 'Perfiles', icon: <Tune fontSize="small" />, fullLabel: 'Módulos por Tipo de Negocio' },
  { label: 'Mi Empresa', icon: <Storefront fontSize="small" />, fullLabel: 'Datos del Facturador (Plataforma)' },
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

  const [confirmState, setConfirmState] = useState({ open: false, title: '', body: '', icon: null, color: ACCENT, action: null, loading: false });

  const askConfirm = (title, body, icon, color, action) => {
    setConfirmState({ open: true, title, body, icon, color, action, loading: false });
  };

  const handleConfirm = async () => {
    setConfirmState(prev => ({ ...prev, loading: true }));
    try { await confirmState.action(); } finally {
      setConfirmState({ open: false, title: '', body: '', icon: null, color: ACCENT, action: null, loading: false });
    }
  };

  const onImpersonate = (id) => askConfirm(
    '¿Entrar como Soporte?',
    'Tu sesión de Admin se cerrará temporalmente. Se iniciará sesión como este cliente.',
    <SupportAgent sx={{ fontSize: 40, color: PURPLE }} />, PURPLE,
    () => handleImpersonate(id)
  );

  const onToggleStatus = (id, is_active) => askConfirm(
    is_active ? '¿Suspender Inquilino?' : '¿Reactivar Inquilino?',
    is_active ? 'La cuenta será desactivada de inmediato. El cliente no podrá acceder al sistema.' : 'La cuenta será reactivada y el cliente podrá acceder nuevamente.',
    <Warning sx={{ fontSize: 40, color: is_active ? ACCENT : GREEN }} />, is_active ? ACCENT : GREEN,
    async () => { if (await handleToggleStatus(id, is_active)) setOpenDrawer(false); }
  );

  const [tabValue, setTabValue] = useState(0);
  const [openDrawer, setOpenDrawer] = useState(false);
  const [tenantForDrawer, setTenantForDrawer] = useState(null);
  const [openDialogEmpresa, setOpenDialogEmpresa] = useState(false);
  const [formEmpresa, setFormEmpresa] = useState({
    nombre: '', nit: '', dv: '', admin_username: '', admin_password: '',
    admin_nombre_completo: '', admin_email: '', admin_telefono: '', tipo_negocio: 'erp',
    tipo_organizacion_id: 1, tipo_regimen_id: 48, responsabilidad_fiscal_codes: 'O-13',
    departamento_code: '', ciudad_code: '', correo_facturacion: '',
    facturacion_electronica_activa: false, matias_api_key: '', matias_test_mode: true
  });
  const [openPlanDialog, setOpenPlanDialog] = useState(false);
  const [empresaSeleccionada, setEmpresaSeleccionada] = useState(null);
  const [formAsignarPlan, setFormAsignarPlan] = useState({ plan_type: 'trial', plan_selector: 'trial', trial_ends_at: '' });
  const [openCatalogDialog, setOpenCatalogDialog] = useState(false);
  const [wompiRecoveryId, setWompiRecoveryId] = useState('');
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [editingPlanId, setEditingPlanId] = useState(null);
  const [formPlan, setFormPlan] = useState({ nombre: '', codigo_interno: '', precio: '', dias_duracion: '', caracteristicas: '', is_active: true });
  const [openModulosDialog, setOpenModulosDialog] = useState(false);
  const [empresaParaModulos, setEmpresaParaModulos] = useState(null);
  const [showAdvancedEmpresa, setShowAdvancedEmpresa] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState({ open: false, empresa: null, confirmText: '', loading: false });
  const [tiposNegocio, setTiposNegocio] = useState([]);
  const [perfilDialog, setPerfilDialog] = useState({ open: false, tipo: null, modulos: [], loading: false });

  useEffect(() => {
    fetchTiposNegocio().then(r => setTiposNegocio(r.data)).catch(() => {});
  }, []);

  const handleOpenDrawer = (tenant) => { setTenantForDrawer(tenant); setOpenDrawer(true); };

  const handleDeleteEmpresa = async () => {
    const { empresa } = deleteDialog;
    if (deleteDialog.confirmText !== empresa.nombre) return;
    setDeleteDialog(s => ({ ...s, loading: true }));
    try {
      await apiClient.delete(`/superadmin/empresas/${empresa.id}`);
      toast.success(`Empresa "${empresa.nombre}" eliminada permanentemente.`);
      setDeleteDialog({ open: false, empresa: null, confirmText: '', loading: false });
      setOpenDrawer(false);
      refreshAll();
    } catch (err) {
      toast.error('Error al eliminar: ' + (err.response?.data?.detail || 'Error desconocido'));
      setDeleteDialog(s => ({ ...s, loading: false }));
    }
  };

  const handleOpenModulos = (empresa) => {
    setEmpresaParaModulos(empresa);
    setOpenModulosDialog(true);
  };

  const handleSubmitEmpresa = async (e) => {
    e.preventDefault();
    try {
      await apiClient.post('/superadmin/empresas', {
        empresa: { 
          nombre: formEmpresa.nombre, 
          nit: formEmpresa.nit, 
          dv: formEmpresa.dv,
          tipo_negocio: formEmpresa.tipo_negocio,
          tipo_organizacion_id: formEmpresa.tipo_organizacion_id,
          tipo_regimen_id: formEmpresa.tipo_regimen_id,
          responsabilidad_fiscal_codes: formEmpresa.responsabilidad_fiscal_codes,
          departamento_code: formEmpresa.departamento_code,
          ciudad_code: formEmpresa.ciudad_code,
          correo_facturacion: formEmpresa.correo_facturacion,
          facturacion_electronica_activa: formEmpresa.facturacion_electronica_activa,
          matias_api_key: formEmpresa.matias_api_key,
          matias_test_mode: formEmpresa.matias_test_mode
        },
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

  const handleSavePerfilTipo = async () => {
    const { tipo, modulos } = perfilDialog;
    setPerfilDialog(s => ({ ...s, loading: true }));
    try {
      const { data } = await updateTipoNegocio(tipo, { modulos });
      setTiposNegocio(prev => prev.map(t => t.tipo === tipo ? data : t));
      toast.success(`Perfil "${tipo}" actualizado. Las nuevas empresas de este tipo usarán esta configuración.`);
      setPerfilDialog({ open: false, tipo: null, modulos: [], loading: false });
    } catch {
      toast.error('Error al guardar el perfil.');
      setPerfilDialog(s => ({ ...s, loading: false }));
    }
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
                {[
                  { id: 'all', label: 'Todos' },
                  { id: 'premium', label: 'Premium' },
                  { id: 'trial', label: 'Trials' },
                  { id: 'expired', label: 'Expirados' },
                  { id: 'inactive', label: 'Inactivos +7d' }
                ].map(f => (
                  <Chip
                    key={f.id} label={f.label} size="small" onClick={() => setFilterState(f.id)}
                    sx={{ fontWeight: 700, flexShrink: 0, bgcolor: filterState === f.id ? BLUE : 'transparent', color: filterState === f.id ? 'white' : 'text.primary' }}
                  />
                ))}
              </Box>
            </Box>
            <Box sx={{ width: '100%', overflowX: 'auto' }}>
              <TenantsTable
                empresas={filteredEmpresas} onOpenDrawer={handleOpenDrawer} onImpersonate={onImpersonate}
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
            {/* ── Panel de recuperación de pagos perdidos ── */}
            <Paper sx={{ p: 2.5, mb: 3, borderRadius: 3, border: '1px solid', borderColor: 'warning.main', bgcolor: 'warning.light', opacity: 0.95 }}>
              <Typography sx={{ fontWeight: 800, fontSize: 13, color: 'warning.dark', mb: 0.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                <Warning fontSize="small" /> Recuperar pago no registrado
              </Typography>
              <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 1.5 }}>
                Si un cliente pagó con Wompi pero el pago no aparece en la tabla, pega aquí el ID de transacción de Wompi (lo encuentras en tu panel Wompi → Transacciones).
              </Typography>
              <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
                <TextField
                  size="small"
                  placeholder="ID de transacción Wompi (ej: wom_prod_abc123...)"
                  value={wompiRecoveryId}
                  onChange={e => setWompiRecoveryId(e.target.value)}
                  sx={{ flex: 1, minWidth: 260, bgcolor: 'background.paper', borderRadius: 2 }}
                />
                <Button
                  variant="contained"
                  disabled={!wompiRecoveryId.trim() || recoveryLoading}
                  startIcon={recoveryLoading ? <CircularProgress size={16} color="inherit" /> : <Search />}
                  sx={{ bgcolor: 'warning.dark', color: '#fff', fontWeight: 700, borderRadius: 2, '&:hover': { bgcolor: 'warning.dark' } }}
                  onClick={async () => {
                    setRecoveryLoading(true);
                    try {
                      const { data } = await apiClient.post('/superadmin/recuperar-pago-wompi', { wompi_id: wompiRecoveryId.trim() });
                      toast.success(`✅ ${data.mensaje || 'Pago recuperado'} — Empresa: ${data.empresa} | Plan: ${data.plan} | Activo hasta: ${data.activo_hasta ? new Date(data.activo_hasta).toLocaleDateString('es-CO') : '—'}`);
                      setWompiRecoveryId('');
                      // Refrescar lista de pagos
                      const res = await apiClient.get('/superadmin/historial-pagos');
                      // El hook useSaaSData no expone setPagos; recargar la página es el fallback
                      window.location.reload();
                    } catch (err) {
                      const msg = err?.response?.data?.detail || 'Error al recuperar el pago';
                      toast.error(msg);
                    } finally {
                      setRecoveryLoading(false);
                    }
                  }}
                >
                  Recuperar pago
                </Button>
              </Box>
            </Paper>

            <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
              <Paper sx={{ p: 2.5, borderRadius: 3, bgcolor: `${GREEN}08`, border: `1px solid ${GREEN}20`, flex: 1, minWidth: 200 }}>
                <Typography variant="caption" sx={{ fontWeight: 800, color: GREEN, textTransform: 'uppercase' }}>Ingresos Totales</Typography>
                <Typography sx={{ fontWeight: 900, fontSize: 28, color: GREEN }}>
                  ${new Intl.NumberFormat('es-CO').format(pagos.reduce((acc, p) => acc + (p.monto || 0), 0))}
                </Typography>
                <Typography sx={{ fontSize: 11, color: 'text.secondary', mt: 0.5 }}>{pagos.length} transacciones registradas</Typography>
              </Paper>
              <Button
                variant="contained"
                startIcon={<Payments />}
                sx={{ bgcolor: GREEN, borderRadius: 2, fontWeight: 700, alignSelf: 'center', px: 3 }}
                onClick={() => {
                  if (!pagos.length) return;
                  const headers = Object.keys(pagos[0]).join(',');
                  const rows = pagos.map(p => Object.values(p).map(v => `"${v ?? ''}"`).join(','));
                  const csv = [headers, ...rows].join('\n');
                  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = 'historial_pagos.csv'; a.click();
                }}
              >
                Exportar CSV
              </Button>
            </Box>
            {pagos.length > 0 ? (
              <Paper sx={{ borderRadius: 3, overflow: 'hidden' }}>
                <TableContainer sx={{ maxHeight: '60vh' }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        {Object.keys(pagos[0]).map(k => (
                          <TableCell key={k} sx={{ fontWeight: 800, bgcolor: 'action.hover', textTransform: 'capitalize', fontSize: 12 }}>{k.replace(/_/g, ' ')}</TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {pagos.map((p, i) => (
                        <TableRow key={i} hover>
                          {Object.values(p).map((v, j) => (
                            <TableCell key={j} sx={{ fontSize: 12 }}>
                              {typeof v === 'number' && Object.keys(p)[j] === 'monto'
                                ? `$${new Intl.NumberFormat('es-CO').format(v)}`
                                : String(v ?? '-')}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>
            ) : (
              <Paper sx={{ p: 6, textAlign: 'center', borderRadius: 3 }}>
                <ReceiptLong sx={{ fontSize: 48, color: 'action.disabled', mb: 1 }} />
                <Typography color="text.secondary">No hay registros de pagos aún.</Typography>
              </Paper>
            )}
          </TabPanel>

          <TabPanel value={tabValue} index={7}>
            <Box sx={{ mb: 3 }}>
              <Typography sx={{ fontWeight: 800, fontSize: 16, mb: 0.5 }}>Módulos por defecto según tipo de negocio</Typography>
              <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>
                Define qué módulos se habilitan cuando se registra una nueva empresa de cada tipo.
                No afecta a empresas ya existentes.
              </Typography>
            </Box>
            <Grid container spacing={2}>
              {tiposNegocio.map(perfil => (
                <Grid item xs={12} sm={6} md={4} key={perfil.tipo}>
                  <Paper sx={{ p: 2.5, borderRadius: 3, border: '1px solid', borderColor: 'divider', height: '100%', display: 'flex', flexDirection: 'column' }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                      <Box>
                        <Typography sx={{ fontWeight: 800, fontSize: 14 }}>{perfil.label || perfil.tipo}</Typography>
                        <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{perfil.modulos.length} módulos</Typography>
                      </Box>
                      <Button
                        size="small" variant="outlined" startIcon={<Edit />}
                        onClick={() => setPerfilDialog({ open: true, tipo: perfil.tipo, modulos: [...perfil.modulos], loading: false })}
                        sx={{ borderRadius: 2, fontWeight: 700, fontSize: 12 }}
                      >
                        Editar
                      </Button>
                    </Box>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 'auto' }}>
                      {perfil.modulos.map(path => (
                        <Chip
                          key={path} label={path.replace(/^\//, '')} size="small"
                          sx={{ fontSize: 10, fontWeight: 600, bgcolor: `${PURPLE}12`, color: PURPLE }}
                        />
                      ))}
                    </Box>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          </TabPanel>

          <TabPanel value={tabValue} index={8}>
            <PlataformaConfigForm />
          </TabPanel>
        </Box>
      </Box>

      {/* ── DIALOG: Editar perfil tipo negocio ── */}
      <Dialog open={perfilDialog.open} onClose={() => setPerfilDialog(s => ({ ...s, open: false }))} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{ width: 38, height: 38, borderRadius: 2, bgcolor: `${PURPLE}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: PURPLE }}>
              <ViewModule />
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 800, fontSize: 17 }}>Módulos por defecto</Typography>
              <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>Tipo: {perfilDialog.tipo}</Typography>
            </Box>
          </Box>
          <IconButton size="small" onClick={() => setPerfilDialog(s => ({ ...s, open: false }))}><Close fontSize="small" /></IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 2 }}>
            Activa los módulos que tendrán habilitados las nuevas empresas de este tipo al registrarse.
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
            <Button size="small" sx={{ fontSize: 11, textTransform: 'none' }}
              onClick={() => setPerfilDialog(s => ({ ...s, modulos: APP_MODULES.map(m => m.path) }))}>
              Todos
            </Button>
            <Button size="small" sx={{ fontSize: 11, textTransform: 'none', color: 'text.secondary' }}
              onClick={() => setPerfilDialog(s => ({ ...s, modulos: [] }))}>
              Ninguno
            </Button>
          </Box>
          <FormGroup sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 1 }}>
            {APP_MODULES.map(modulo => {
              const active = perfilDialog.modulos.includes(modulo.path);
              return (
                <Box key={modulo.path} sx={{
                  p: 1, borderRadius: 2, border: '1px solid',
                  borderColor: active ? `${PURPLE}50` : 'divider',
                  bgcolor: active ? `${PURPLE}08` : 'transparent',
                  transition: 'all 0.15s'
                }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={active}
                        onChange={() => setPerfilDialog(s => ({
                          ...s,
                          modulos: active ? s.modulos.filter(p => p !== modulo.path) : [...s.modulos, modulo.path]
                        }))}
                        size="small"
                        sx={{ '& .MuiSwitch-switchBase.Mui-checked': { color: PURPLE }, '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: PURPLE } }}
                      />
                    }
                    label={<Typography sx={{ fontSize: 12.5, fontWeight: active ? 700 : 400 }}>{modulo.label}</Typography>}
                    sx={{ m: 0, width: '100%' }}
                  />
                </Box>
              );
            })}
          </FormGroup>
        </DialogContent>
        <DialogActions sx={{ p: 2, px: 3 }}>
          <Button onClick={() => setPerfilDialog(s => ({ ...s, open: false }))} color="inherit" sx={{ fontWeight: 600, textTransform: 'none' }}>Cancelar</Button>
          <Button
            variant="contained" onClick={handleSavePerfilTipo} disabled={perfilDialog.loading}
            startIcon={perfilDialog.loading && <CircularProgress size={16} color="inherit" />}
            sx={{ bgcolor: PURPLE, '&:hover': { bgcolor: '#7C3AED' }, fontWeight: 700, borderRadius: 2, textTransform: 'none' }}
          >
            Guardar perfil
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── DIALOGS ── */}
      <TenantDrawer360
        open={openDrawer} onClose={() => setOpenDrawer(false)} tenant={tenantForDrawer}
        onImpersonate={onImpersonate} onOpenPlan={handleOpenAsignarPlan}
        onOpenModulos={handleOpenModulos}
        onToggleStatus={onToggleStatus}
        onDelete={(t) => setDeleteDialog({ open: true, empresa: t, confirmText: '', loading: false })}
      />

      {/* ── DIALOG: Eliminar empresa ── */}
      <Dialog open={deleteDialog.open} onClose={() => !deleteDialog.loading && setDeleteDialog(s => ({ ...s, open: false }))} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5, color: '#b91c1c' }}>
          <DeleteForever /> Eliminar empresa permanentemente
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 2, fontSize: 14 }}>
            Esta acción es <strong>irreversible</strong>. Se eliminarán todos los datos de la empresa
            {deleteDialog.empresa && <strong> "{deleteDialog.empresa.nombre}"</strong>}, incluyendo usuarios, ventas, clientes e inventario.
          </Typography>
          <Typography sx={{ mb: 1.5, fontSize: 13, fontWeight: 700 }}>
            Escribe el nombre exacto de la empresa para confirmar:
          </Typography>
          <TextField
            fullWidth size="small" autoComplete="off"
            placeholder={deleteDialog.empresa?.nombre}
            value={deleteDialog.confirmText}
            onChange={e => setDeleteDialog(s => ({ ...s, confirmText: e.target.value }))}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleteDialog(s => ({ ...s, open: false }))} disabled={deleteDialog.loading} sx={{ fontWeight: 600 }}>Cancelar</Button>
          <Button
            variant="contained"
            disabled={deleteDialog.confirmText !== deleteDialog.empresa?.nombre || deleteDialog.loading}
            startIcon={deleteDialog.loading && <CircularProgress size={16} color="inherit" />}
            onClick={handleDeleteEmpresa}
            sx={{ bgcolor: '#b91c1c', '&:hover': { bgcolor: '#991b1b' }, fontWeight: 700, borderRadius: 2 }}
          >
            Eliminar definitivamente
          </Button>
        </DialogActions>
      </Dialog>

      <ModulosEmpresaDialog
        open={openModulosDialog}
        handleClose={() => setOpenModulosDialog(false)}
        empresa={empresaParaModulos}
        onModulosUpdated={refreshAll}
      />

      {/* ── ELIMINAR EMPRESA ── */}
      <Dialog
        open={deleteDialog.open}
        onClose={() => !deleteDialog.loading && setDeleteDialog(s => ({ ...s, open: false }))}
        maxWidth="xs" fullWidth
        PaperProps={{ sx: { borderRadius: 3, border: '2px solid #b91c1c' } }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5, pb: 1 }}>
          <DeleteForever sx={{ color: '#b91c1c', fontSize: 28 }} />
          <Typography sx={{ fontWeight: 800, fontSize: 17, color: '#b91c1c' }}>
            Eliminar empresa permanentemente
          </Typography>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2}>
            <Box sx={{ bgcolor: '#fef2f2', border: '1px solid #fecaca', borderRadius: 2, p: 2 }}>
              <Typography sx={{ fontWeight: 700, fontSize: 13, color: '#991b1b', mb: 0.5 }}>
                ⚠️ Esta acción es IRREVERSIBLE
              </Typography>
              <Typography sx={{ fontSize: 13, color: '#7f1d1d' }}>
                Se eliminarán todos los datos de <strong>{deleteDialog.empresa?.nombre}</strong>:
                usuarios, ventas, productos, clientes, configuración y todos los registros asociados.
              </Typography>
            </Box>
            <Box>
              <Typography sx={{ fontSize: 13, mb: 1, fontWeight: 600 }}>
                Escribe el nombre exacto de la empresa para confirmar:
              </Typography>
              <Typography sx={{ fontFamily: 'monospace', fontWeight: 800, fontSize: 14, mb: 1, color: '#b91c1c', p: 1, bgcolor: 'action.hover', borderRadius: 1 }}>
                {deleteDialog.empresa?.nombre}
              </Typography>
              <TextField
                fullWidth size="small" autoFocus
                placeholder={deleteDialog.empresa?.nombre}
                value={deleteDialog.confirmText}
                onChange={e => setDeleteDialog(s => ({ ...s, confirmText: e.target.value }))}
                disabled={deleteDialog.loading}
                error={deleteDialog.confirmText.length > 0 && deleteDialog.confirmText !== deleteDialog.empresa?.nombre}
                helperText={deleteDialog.confirmText.length > 0 && deleteDialog.confirmText !== deleteDialog.empresa?.nombre ? 'El nombre no coincide' : ''}
              />
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button
            onClick={() => setDeleteDialog(s => ({ ...s, open: false }))}
            disabled={deleteDialog.loading}
            sx={{ fontWeight: 700, textTransform: 'none' }}
          >
            Cancelar
          </Button>
          <Button
            variant="contained"
            onClick={handleDeleteEmpresa}
            disabled={deleteDialog.loading || deleteDialog.confirmText !== deleteDialog.empresa?.nombre}
            startIcon={deleteDialog.loading ? <CircularProgress size={16} color="inherit" /> : <DeleteForever />}
            sx={{ bgcolor: '#b91c1c', '&:hover': { bgcolor: '#991b1b' }, fontWeight: 700, textTransform: 'none', borderRadius: 2 }}
          >
            {deleteDialog.loading ? 'Eliminando…' : 'Eliminar permanentemente'}
          </Button>
        </DialogActions>
      </Dialog>

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

              <Divider><Button size="small" onClick={() => setShowAdvancedEmpresa(!showAdvancedEmpresa)} endIcon={showAdvancedEmpresa ? <ExpandLess /> : <ExpandMore />}>Facturación Electrónica</Button></Divider>

              <Collapse in={showAdvancedEmpresa}>
                <Stack spacing={2} sx={{ pt: 1 }}>
                  <Grid container spacing={2}>
                    <Grid item xs={4}>
                      <TextField label="DV" fullWidth size="small" value={formEmpresa.dv} onChange={e => setFormEmpresa({...formEmpresa, dv: e.target.value})} />
                    </Grid>
                    <Grid item xs={8}>
                      <TextField label="Correo Facturación" fullWidth size="small" type="email" value={formEmpresa.correo_facturacion} onChange={e => setFormEmpresa({...formEmpresa, correo_facturacion: e.target.value})} />
                    </Grid>
                  </Grid>

                  <Grid container spacing={2}>
                    <Grid item xs={6}>
                      <TextField select label="Tipo Organización" fullWidth size="small" value={formEmpresa.tipo_organizacion_id} onChange={e => setFormEmpresa({...formEmpresa, tipo_organizacion_id: e.target.value})}>
                        <MenuItem value={1}>Jurídica</MenuItem>
                        <MenuItem value={2}>Natural</MenuItem>
                      </TextField>
                    </Grid>
                    <Grid item xs={6}>
                      <TextField select label="Régimen Fiscal" fullWidth size="small" value={formEmpresa.tipo_regimen_id} onChange={e => setFormEmpresa({...formEmpresa, tipo_regimen_id: e.target.value})}>
                        <MenuItem value={48}>Responsable de IVA</MenuItem>
                        <MenuItem value={49}>No responsable de IVA</MenuItem>
                      </TextField>
                    </Grid>
                  </Grid>

                  <TextField label="Responsabilidades Fiscales" fullWidth size="small" placeholder="O-13, O-15" value={formEmpresa.responsabilidad_fiscal_codes} onChange={e => setFormEmpresa({...formEmpresa, responsabilidad_fiscal_codes: e.target.value})} />
                  
                  <Grid container spacing={2}>
                    <Grid item xs={6}>
                       <TextField label="Cód. Departamento" fullWidth size="small" value={formEmpresa.departamento_code} onChange={e => setFormEmpresa({...formEmpresa, departamento_code: e.target.value})} />
                    </Grid>
                    <Grid item xs={6}>
                       <TextField label="Cód. Ciudad" fullWidth size="small" value={formEmpresa.ciudad_code} onChange={e => setFormEmpresa({...formEmpresa, ciudad_code: e.target.value})} />
                    </Grid>
                  </Grid>

                  <FormControlLabel
                    control={<Switch checked={formEmpresa.facturacion_electronica_activa} onChange={e => setFormEmpresa({...formEmpresa, facturacion_electronica_activa: e.target.checked})} />}
                    label="Activar Facturación Electrónica"
                  />
                  
                  {formEmpresa.facturacion_electronica_activa && (
                    <>
                      <TextField label="MATIAS API KEY" fullWidth size="small" value={formEmpresa.matias_api_key} onChange={e => setFormEmpresa({...formEmpresa, matias_api_key: e.target.value})} />
                      <FormControlLabel
                        control={<Switch checked={formEmpresa.matias_test_mode} onChange={e => setFormEmpresa({...formEmpresa, matias_test_mode: e.target.checked})} />}
                        label="Modo Pruebas (MATIAS)"
                      />
                    </>
                  )}
                </Stack>
              </Collapse>
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

      {/* ── CONFIRM DIALOG ── */}
      <Dialog open={confirmState.open} onClose={() => !confirmState.loading && setConfirmState(prev => ({ ...prev, open: false }))} maxWidth="xs" fullWidth>
        <DialogContent sx={{ textAlign: 'center', pt: 4, pb: 2 }}>
          {confirmState.icon && <Box sx={{ mb: 2 }}>{confirmState.icon}</Box>}
          <Typography sx={{ fontWeight: 800, fontSize: 18, mb: 1 }}>{confirmState.title}</Typography>
          <Typography sx={{ color: 'text.secondary', fontSize: 14 }}>{confirmState.body}</Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2.5, pt: 1, gap: 1 }}>
          <Button fullWidth onClick={() => setConfirmState(prev => ({ ...prev, open: false }))} disabled={confirmState.loading} sx={{ fontWeight: 700 }}>Cancelar</Button>
          <Button fullWidth variant="contained" onClick={handleConfirm} disabled={confirmState.loading} sx={{ bgcolor: confirmState.color, fontWeight: 700 }}>
            {confirmState.loading ? 'Procesando...' : 'Confirmar'}
          </Button>
        </DialogActions>
      </Dialog>

    </Box>
  );
}
