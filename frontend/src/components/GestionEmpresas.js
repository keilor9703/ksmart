import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Button, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Chip, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, Stack, 
  Tooltip, Grid, Divider, useTheme, useMediaQuery, MenuItem, Tabs, Tab, FormControlLabel, Switch, InputAdornment
} from '@mui/material';
import { 
  Add, Business, Block, CheckCircle, AdminPanelSettings, 
  Close, CardMembership, WorkspacePremium, AccessTime, Edit, LocalOffer,
  ReceiptLong, AlternateEmail, Autorenew, SupportAgent, Search, FilterList, WarningAmber, Payments
} from '@mui/icons-material';
import { toast } from 'react-toastify';
import apiClient, { fetchPlanesAdmin, createPlan, updatePlan, impersonateCompany } from '../api';

const ACCENT = '#F43F5E';
const BLUE = '#3B82F6';
const GREEN = '#10B981';

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

const formatCurrency = (val) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(val);
const formatDateFull = (d) => new Date(d).toLocaleString('es-CO');

// ── Componentes Móviles ──
const EmpresaCard = ({ empresa, onToggleStatus, onOpenPlan, onImpersonate }) => {
  const dias = calcularDiasRestantes(empresa.trial_ends_at);
  
  return (
    <Paper sx={{ p: 2.5, mb: 2, borderRadius: 3, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
        <Box>
          <Typography sx={{ fontWeight: 700, fontSize: 15 }}>{empresa.nombre}</Typography>
          <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>#{empresa.id} · NIT: {empresa.nit || 'Sin registro'}</Typography>
        </Box>
        <Chip label={empresa.is_active ? 'Activa' : 'Suspendida'} size="small" sx={{ bgcolor: empresa.is_active ? '#10B98120' : '#EF444420', color: empresa.is_active ? '#10B981' : '#EF4444', fontWeight: 600, fontSize: 11, borderRadius: 1.5 }} />
      </Box>

      <Divider sx={{ my: 1.5 }} />

      <Grid container spacing={1} sx={{ mb: 1.5 }}>
        <Grid item xs={6}>
          <Box sx={{ textAlign: 'center', p: 1, borderRadius: 2, bgcolor: 'action.hover' }}>
            <Typography sx={{ fontSize: 10, color: 'text.secondary', mb: 0.2 }}>Suscripción</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
              {empresa.plan_type === 'premium' ? <WorkspacePremium sx={{ fontSize: 14, color: '#F59E0B' }} /> : <AccessTime sx={{ fontSize: 14, color: '#3B82F6' }} />}
              <Typography sx={{ fontSize: 13, fontWeight: 700, textTransform: 'capitalize' }}>{empresa.plan_type || 'trial'}</Typography>
            </Box>
          </Box>
        </Grid>
        <Grid item xs={6}>
          <Box sx={{ textAlign: 'center', p: 1, borderRadius: 2, bgcolor: 'action.hover' }}>
            <Typography sx={{ fontSize: 10, color: 'text.secondary', mb: 0.2 }}>Vencimiento</Typography>
            <Typography sx={{ fontSize: 13, fontWeight: 700, color: dias > 0 ? '#10B981' : '#EF4444' }}>{dias > 0 ? `En ${dias} días` : 'Expirado'}</Typography>
          </Box>
        </Grid>
      </Grid>

      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
        <Button size="small" variant="outlined" disabled={empresa.id === 1} onClick={() => onOpenPlan(empresa)} startIcon={<CardMembership />} sx={{ borderRadius: 2, color: '#8B5CF6', borderColor: '#8B5CF6', flex: 1 }}>Plan</Button>
        <Tooltip title={empresa.is_active ? "Suspender acceso" : "Reactivar acceso"}>
          {/* ✅ CORREGIDO: empresa.id */}
          <span><IconButton size="small" disabled={empresa.id === 1} onClick={() => onToggleStatus(empresa.id, empresa.is_active)} sx={{ color: empresa.is_active ? '#EF4444' : '#10B981', bgcolor: empresa.is_active ? '#FEF2F2' : '#F0FDF4', borderRadius: 1.5, width: 40, height: 40 }}>{empresa.is_active ? <Block fontSize="small" /> : <CheckCircle fontSize="small" />}</IconButton></span>
        </Tooltip>
        <Tooltip title="Entrar como Cliente (Soporte)">
          {/* ✅ CORREGIDO: empresa.id */}
          <span><IconButton size="small" onClick={() => onImpersonate(empresa.id)} sx={{ color: '#0EA5E9', bgcolor: '#E0F2FE', borderRadius: 1.5, width: 40, height: 40 }}><SupportAgent fontSize="small" /></IconButton></span>
        </Tooltip>
      </Box>
    </Paper>
  );
};

const PagoCard = ({ pago }) => (
  <Paper sx={{ p: 2.5, mb: 2, borderRadius: 3, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', borderLeft: `4px solid ${GREEN}` }}>
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
      <Typography sx={{ fontWeight: 800, fontSize: 16, color: GREEN }}>{formatCurrency(pago.monto)}</Typography>
      <Typography sx={{ fontSize: 11, color: 'text.secondary', textAlign: 'right' }}>{formatDateFull(pago.fecha_pago)}</Typography>
    </Box>
    <Typography sx={{ fontWeight: 700, fontSize: 14 }}>{pago.empresa_nombre}</Typography>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'text.secondary', mb: 2 }}>
      <AlternateEmail sx={{ fontSize: 12 }} /><Typography sx={{ fontSize: 12 }}>{pago.email_pagador}</Typography>
    </Box>
    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
      <Chip label={pago.plan_nombre} size="small" sx={{ fontWeight: 600, fontSize: 10, bgcolor: `${BLUE}15`, color: BLUE }} />
      <Chip label={pago.metodo_pago} size="small" variant="outlined" sx={{ fontWeight: 700, fontSize: 10 }} />
      <Typography sx={{ fontSize: 10, color: 'text.secondary', fontFamily: 'monospace' }}>#{pago.bold_tx_id}</Typography>
    </Box>
  </Paper>
);

export default function GestionSaaS() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [tabValue, setTabValue] = useState(0);
  const [loading, setLoading] = useState(false);

  // Estados Base
  const [empresas, setEmpresas] = useState([]);
  const [planesCatalog, setPlanesCatalog] = useState([]);
  const [pagos, setPagos] = useState([]);

  // Estados Buscador y Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [filterState, setFilterState] = useState('all');

  // Estados Formularios
  const [openDialogEmpresa, setOpenDialogEmpresa] = useState(false);
  const [formEmpresa, setFormEmpresa] = useState({ nombre: '', nit: '', admin_username: '', admin_password: '' });
  const [openPlanDialog, setOpenPlanDialog] = useState(false);
  const [empresaSeleccionada, setEmpresaSeleccionada] = useState(null);
  const [formAsignarPlan, setFormAsignarPlan] = useState({ plan_type: 'trial', plan_selector: 'trial', trial_ends_at: '' });
  const [openCatalogDialog, setOpenCatalogDialog] = useState(false);
  const [editingPlanId, setEditingPlanId] = useState(null);
  const [formPlan, setFormPlan] = useState({ nombre: '', codigo_interno: '', precio: '', dias_duracion: '', caracteristicas: '', is_active: true });

  useEffect(() => { 
    fetchEmpresas(); 
    fetchCatalogoPlanes();
    fetchHistorialPagos();
  }, []);

  // ── Peticiones API ──
  const fetchEmpresas = async () => { try { const { data } = await apiClient.get('/superadmin/empresas'); setEmpresas(data); } catch (e) { toast.error('Error al cargar inquilinos'); } };
  const fetchCatalogoPlanes = async () => { try { const { data } = await fetchPlanesAdmin(); setPlanesCatalog(data); } catch (e) { console.error("Error cargando planes"); } };
  const fetchHistorialPagos = async () => { try { const { data } = await apiClient.get('/superadmin/historial-pagos'); setPagos(data); } catch (e) { console.error("Error cargando historial de pagos"); } };

  // ── Funciones de Acción ──
  const handleToggleStatus = async (id, is_active) => {
    const action = is_active ? 'suspender' : 'reactivar';
    if (!window.confirm(`¿Estás seguro de que deseas ${action} esta cuenta?`)) return;
    try { await apiClient.patch(`/superadmin/empresas/${id}/toggle`); toast.success(`Cuenta ${is_active ? 'suspendida' : 'reactivada'}`); fetchEmpresas(); } catch (err) { toast.error('Error al cambiar estado'); }
  };

  const handleSubmitEmpresa = async (e) => {
    e.preventDefault(); setLoading(true);
    try {
      await apiClient.post('/superadmin/empresas', { empresa: { nombre: formEmpresa.nombre, nit: formEmpresa.nit, color_primario: '#3B82F6' }, admin_username: formEmpresa.admin_username, admin_password: formEmpresa.admin_password });
      toast.success('Empresa registrada con 14 días de prueba.');
      setOpenDialogEmpresa(false); setFormEmpresa({ nombre: '', nit: '', admin_username: '', admin_password: '' }); fetchEmpresas();
    } catch (err) { toast.error('Error al crear la empresa'); } finally { setLoading(false); }
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
      if (planObj) { const today = new Date(); today.setDate(today.getDate() + planObj.dias_duracion); newDate = formatDateForInput(today); }
    }
    setFormAsignarPlan({ ...formAsignarPlan, plan_type: realPlanType, plan_selector: selectedValue, trial_ends_at: newDate });
  };

  const handleUpdateSuscripcion = async (e) => {
    e.preventDefault(); setLoading(true);
    try {
      await apiClient.patch(`/superadmin/empresas/${empresaSeleccionada.id}/plan`, { plan_type: formAsignarPlan.plan_type, trial_ends_at: formAsignarPlan.trial_ends_at ? new Date(formAsignarPlan.trial_ends_at).toISOString() : null });
      toast.success('Suscripción actualizada'); setOpenPlanDialog(false); fetchEmpresas();
    } catch (err) { toast.error('Error al actualizar el plan'); } finally { setLoading(false); }
  };

  const handleOpenCreatePlan = () => { setEditingPlanId(null); setFormPlan({ nombre: '', codigo_interno: '', precio: '', dias_duracion: '', caracteristicas: '', is_active: true }); setOpenCatalogDialog(true); };
  const handleOpenEditPlan = (plan) => { setEditingPlanId(plan.id); setFormPlan({ nombre: plan.nombre, codigo_interno: plan.codigo_interno, precio: plan.precio, dias_duracion: plan.dias_duracion, caracteristicas: plan.caracteristicas || '', is_active: plan.is_active }); setOpenCatalogDialog(true); };

  const handleSubmitPlan = async (e) => {
    e.preventDefault(); setLoading(true);
    try {
      const payload = { ...formPlan, precio: Number(formPlan.precio), dias_duracion: Number(formPlan.dias_duracion) };
      if (editingPlanId) { await updatePlan(editingPlanId, payload); toast.success('Plan actualizado.'); } else { await createPlan(payload); toast.success('Nuevo plan creado.'); }
      setOpenCatalogDialog(false); fetchCatalogoPlanes();
    } catch (err) { toast.error('Error al guardar el plan.'); } finally { setLoading(false); }
  };

  const handleImpersonate = async (empresaId) => {
    if (!window.confirm("¿Entrar al sistema como este cliente? Tu sesión de Admin se cerrará temporalmente.")) return;
    try {
      const { data } = await impersonateCompany(empresaId);
      localStorage.setItem('token', data.access_token);
      localStorage.removeItem('userModules'); 
      toast.success("Iniciando sesión de soporte...");
      setTimeout(() => { window.location.href = '/'; }, 1000);
    } catch (err) { toast.error("No se pudo iniciar la suplantación."); }
  };

  const exportarPagosCSV = () => {
    if (pagos.length === 0) return toast.info("No hay datos para exportar.");
    const headers = ["Fecha", "Empresa", "Plan", "Monto", "Moneda", "Metodo", "ID_Bold", "Email_Pagador"];
    const rows = pagos.map(p => [
      new Date(p.fecha_pago).toLocaleString(), `"${p.empresa_nombre}"`, `"${p.plan_nombre}"`,
      p.monto, p.moneda, p.metodo_pago, p.bold_tx_id, p.email_pagador
    ]);
    const csvContent = [headers.join(","), ...rows.map(row => row.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a"); link.setAttribute("href", url);
    link.setAttribute("download", `Reporte_Pagos_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
    toast.success("Reporte exportado.");
  };

  // ── Cálculos Inteligentes (KPIs) y Búsqueda ──
  const kpis = {
    total: empresas.length,
    premium: empresas.filter(e => e.plan_type === 'premium').length,
    trial: empresas.filter(e => e.plan_type !== 'premium' && calcularDiasRestantes(e.trial_ends_at) > 0).length,
    expired: empresas.filter(e => e.plan_type !== 'premium' && calcularDiasRestantes(e.trial_ends_at) <= 0).length,
  };

  const filteredEmpresas = empresas.filter(emp => {
    const matchBusqueda = emp.nombre.toLowerCase().includes(searchTerm.toLowerCase()) || (emp.nit && emp.nit.includes(searchTerm));
    const dias = calcularDiasRestantes(emp.trial_ends_at);
    let matchFiltro = true;
    if (filterState === 'premium') matchFiltro = emp.plan_type === 'premium';
    if (filterState === 'trial') matchFiltro = emp.plan_type !== 'premium' && dias > 0;
    if (filterState === 'expired') matchFiltro = emp.plan_type !== 'premium' && dias <= 0;
    return matchBusqueda && matchFiltro;
  });

  return (
    <Box sx={{ width: '100%' }}>
      {/* HEADER PRINCIPAL */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ width: 44, height: 44, borderRadius: 2, bgcolor: `${ACCENT}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: ACCENT }}><AdminPanelSettings fontSize="medium" /></Box>
          <Box>
            <Typography sx={{ fontWeight: 800, fontSize: 22, lineHeight: 1.2 }}>Centro de Control SaaS</Typography>
            <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>Administración global de Ksmart360</Typography>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {tabValue === 0 && <Button variant="contained" startIcon={<Add />} onClick={() => setOpenDialogEmpresa(true)} sx={{ bgcolor: ACCENT, borderRadius: 2, fontWeight: 600 }}>Nueva Empresa</Button>}
          {tabValue === 1 && <Button variant="contained" startIcon={<Add />} onClick={handleOpenCreatePlan} sx={{ bgcolor: BLUE, borderRadius: 2, fontWeight: 600 }}>Crear Plan</Button>}
          {tabValue === 2 && <Button variant="outlined" startIcon={<Autorenew />} onClick={fetchHistorialPagos} sx={{ borderRadius: 2, fontWeight: 600 }}>Actualizar Historial</Button>}
        </Box>
      </Box>

      {/* TABS DE NAVEGACIÓN */}
      <Paper sx={{ mb: 3, borderRadius: 3, boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}>
        <Tabs value={tabValue} onChange={(e, val) => setTabValue(val)} indicatorColor="primary" textColor="primary" variant={isMobile ? "scrollable" : "standard"} scrollButtons="auto" sx={{ '& .MuiTab-root': { fontWeight: 700, fontSize: 13, textTransform: 'none', minHeight: 56 } }}>
          <Tab icon={<Business sx={{ mr: 1, mb: '0 !important' }}/>} iconPosition="start" label="Inquilinos" />
          <Tab icon={<LocalOffer sx={{ mr: 1, mb: '0 !important' }}/>} iconPosition="start" label="Catálogo" />
          <Tab icon={<ReceiptLong sx={{ mr: 1, mb: '0 !important' }}/>} iconPosition="start" label="Historial de Pagos" />
        </Tabs>
      </Paper>

      {/* ══════════════════════════════════════════════════════════════════════════
          TAB 0: INQUILINOS (DASHBOARD)
          ══════════════════════════════════════════════════════════════════════════ */}
      {tabValue === 0 && (
        <Box>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            {[
              { label: 'Total Inquilinos', value: kpis.total, icon: <Business />, color: '#3B82F6', bg: '#EFF6FF' },
              { label: 'Clientes Premium', value: kpis.premium, icon: <WorkspacePremium />, color: '#F59E0B', bg: '#FEF3C7' },
              { label: 'En Prueba', value: kpis.trial, icon: <AccessTime />, color: '#10B981', bg: '#D1FAE5' },
              { label: 'Expiradas', value: kpis.expired, icon: <WarningAmber />, color: '#EF4444', bg: '#FEE2E2' },
            ].map((kpi, index) => (
              <Grid item xs={6} md={3} key={index}>
                <Paper sx={{ p: 2, borderRadius: 3, display: 'flex', alignItems: 'center', gap: 2, boxShadow: '0 2px 10px rgba(0,0,0,0.03)' }}>
                  <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: kpi.bg, color: kpi.color, display: 'flex' }}>{kpi.icon}</Box>
                  <Box>
                    <Typography sx={{ fontSize: 24, fontWeight: 800, lineHeight: 1 }}>{kpi.value}</Typography>
                    <Typography sx={{ fontSize: 12, color: 'text.secondary', fontWeight: 600 }}>{kpi.label}</Typography>
                  </Box>
                </Paper>
              </Grid>
            ))}
          </Grid>

          <Paper sx={{ p: 2, mb: 3, borderRadius: 3, display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
            <TextField size="small" placeholder="Buscar por nombre o NIT..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} sx={{ flexGrow: 1, minWidth: 250 }} InputProps={{ startAdornment: <InputAdornment position="start"><Search sx={{ color: 'text.secondary' }}/></InputAdornment> }} />
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', overflowX: 'auto' }}>
              <FilterList sx={{ color: 'text.secondary', mr: 1 }} />
              {[{ id: 'all', label: 'Todos' }, { id: 'premium', label: 'Solo Premium' }, { id: 'trial', label: 'En Prueba' }, { id: 'expired', label: 'Expirados' }].map(f => (
                <Chip key={f.id} label={f.label} onClick={() => setFilterState(f.id)} sx={{ fontWeight: 600, bgcolor: filterState === f.id ? ACCENT : 'transparent', color: filterState === f.id ? 'white' : 'text.primary', border: '1px solid', borderColor: filterState === f.id ? ACCENT : 'divider', '&:hover': { bgcolor: filterState === f.id ? ACCENT : 'action.hover' } }} />
              ))}
            </Box>
          </Paper>

          <Paper sx={{ borderRadius: 3, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', overflow: 'hidden', bgcolor: isMobile ? 'transparent' : 'background.paper', p: isMobile ? 2 : 0 }}>
            {!isMobile ? (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: 'action.hover' }}>
                      <TableCell sx={{ fontWeight: 700 }}>ID</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Empresa</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Estado</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Suscripción</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Vence / Días</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>Acciones</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredEmpresas.map((emp) => {
                      const dias = calcularDiasRestantes(emp.trial_ends_at);
                      return (
                        <TableRow key={emp.id} hover>
                          <TableCell>#{emp.id}</TableCell>
                          <TableCell sx={{ fontWeight: 600 }}>{emp.nombre}<Typography variant="caption" display="block" color="text.secondary">NIT: {emp.nit || 'N/A'}</Typography></TableCell>
                          <TableCell><Chip label={emp.is_active ? 'Activa' : 'Suspendida'} size="small" sx={{ bgcolor: emp.is_active ? '#10B98120' : '#EF444420', color: emp.is_active ? '#10B981' : '#EF4444', fontWeight: 600, fontSize: 11, borderRadius: 1.5 }} /></TableCell>
                          <TableCell sx={{ textTransform: 'capitalize', fontWeight: 600, color: emp.plan_type === 'premium' ? '#F59E0B' : '#3B82F6' }}>{emp.plan_type || 'trial'}</TableCell>
                          <TableCell sx={{ fontSize: 12, fontWeight: 600, color: dias > 0 ? 'text.primary' : '#EF4444' }}>
                            {emp.trial_ends_at ? new Date(emp.trial_ends_at).toLocaleDateString() : 'N/A'}
                            <Typography variant="caption" display="block" color={dias > 0 ? '#10B981' : '#EF4444'}>{dias > 0 ? `Quedan ${dias} días` : 'Expirado'}</Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Tooltip title="Gestionar Suscripción"><span><IconButton size="small" disabled={emp.id === 1} onClick={() => handleOpenAsignarPlan(emp)} sx={{ color: '#8B5CF6', mr: 1 }}><CardMembership fontSize="small" /></IconButton></span></Tooltip>
                            <Tooltip title={emp.is_active ? "Suspender Sistema" : "Reactivar Sistema"}><span><IconButton size="small" disabled={emp.id === 1} onClick={() => handleToggleStatus(emp.id, emp.is_active)} sx={{ color: emp.is_active ? '#EF4444' : '#10B981' }}>{emp.is_active ? <Block fontSize="small" /> : <CheckCircle fontSize="small" />}</IconButton></span></Tooltip>
                            <Tooltip title="Entrar como Cliente (Soporte)"><span><IconButton size="small" onClick={() => handleImpersonate(emp.id)} sx={{ color: '#0EA5E9', ml: 1 }}><SupportAgent fontSize="small" /></IconButton></span></Tooltip>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Box>{filteredEmpresas.map(emp => <EmpresaCard key={emp.id} empresa={emp} onToggleStatus={handleToggleStatus} onOpenPlan={handleOpenAsignarPlan} onImpersonate={handleImpersonate} />)}</Box>
            )}
          </Paper>
        </Box>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════
          TAB 1: CATÁLOGO DE PLANES
          ══════════════════════════════════════════════════════════════════════════ */}
      {tabValue === 1 && (
        <Grid container spacing={2}>
          {planesCatalog.map((plan) => (
            <Grid item xs={12} sm={6} md={4} key={plan.id}>
              <Paper sx={{ p: 3, borderRadius: 3, height: '100%', display: 'flex', flexDirection: 'column', border: '1px solid', borderColor: plan.is_active ? 'divider' : '#fca5a5', boxShadow: '0 4px 20px rgba(0,0,0,0.04)', position: 'relative' }}>
                {!plan.is_active && <Chip label="Inactivo" size="small" sx={{ position: 'absolute', top: 12, right: 12, bgcolor: '#FEF2F2', color: '#EF4444', fontWeight: 700, fontSize: 10 }} />}
                <Typography sx={{ fontWeight: 800, fontSize: 18, color: BLUE, mb: 0.5 }}>{plan.nombre}</Typography>
                <Typography sx={{ fontSize: 11, color: 'text.secondary', fontFamily: 'monospace', mb: 2 }}>Código: {plan.codigo_interno}</Typography>
                <Box sx={{ display: 'flex', alignItems: 'baseline', mb: 2 }}><Typography sx={{ fontSize: 28, fontWeight: 800 }}>{formatCurrency(plan.precio)}</Typography><Typography sx={{ fontSize: 13, color: 'text.secondary', ml: 1 }}>/ {plan.dias_duracion} días</Typography></Box>
                <Typography sx={{ fontSize: 13, color: 'text.secondary', mb: 3, flex: 1 }}>{plan.caracteristicas || 'Sin características.'}</Typography>
                <Button fullWidth variant="outlined" startIcon={<Edit />} onClick={() => handleOpenEditPlan(plan)} sx={{ borderRadius: 2, fontWeight: 600 }}>Editar Plan</Button>
              </Paper>
            </Grid>
          ))}
        </Grid>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════
          TAB 2: HISTORIAL DE PAGOS Y EXPORTACIÓN
          ══════════════════════════════════════════════════════════════════════════ */}
      {tabValue === 2 && (
        <Box>
          <Paper sx={{ p: 2, mb: 2, borderRadius: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 2px 10px rgba(0,0,0,0.03)' }}>
            <Typography sx={{ fontWeight: 700, color: 'text.secondary', fontSize: 14 }}>
              Total recaudado: {formatCurrency(pagos.reduce((acc, p) => acc + p.monto, 0))}
            </Typography>
            <Button variant="outlined" startIcon={<Payments />} onClick={exportarPagosCSV} sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700, color: GREEN, borderColor: GREEN, '&:hover': { borderColor: GREEN, bgcolor: `${GREEN}10` } }}>
              Exportar Excel
            </Button>
          </Paper>

          <Paper sx={{ borderRadius: 3, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', overflow: 'hidden', bgcolor: isMobile ? 'transparent' : 'background.paper', p: isMobile ? 2 : 0 }}>
            {!isMobile ? (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: 'action.hover' }}>
                      <TableCell sx={{ fontWeight: 700 }}>Fecha y Hora</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Empresa / Cliente</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Plan</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Monto</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Método / ID Bold</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {pagos.map((p) => (
                      <TableRow key={p.id} hover>
                        <TableCell sx={{ fontSize: 12 }}>{formatDateFull(p.fecha_pago)}</TableCell>
                        <TableCell><Typography sx={{ fontWeight: 700, fontSize: 13 }}>{p.empresa_nombre}</Typography><Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'text.secondary' }}><AlternateEmail sx={{ fontSize: 12 }} /><Typography sx={{ fontSize: 11 }}>{p.email_pagador}</Typography></Box></TableCell>
                        <TableCell><Chip label={p.plan_nombre} size="small" sx={{ fontWeight: 600, fontSize: 10, bgcolor: `${BLUE}15`, color: BLUE }} /></TableCell>
                        <TableCell sx={{ fontWeight: 800, color: GREEN }}>{formatCurrency(p.monto)}</TableCell>
                        <TableCell><Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><Chip label={p.metodo_pago} size="small" variant="outlined" sx={{ fontWeight: 700, fontSize: 10 }} /><Typography sx={{ fontSize: 10, color: 'text.secondary', fontFamily: 'monospace' }}>#{p.bold_tx_id}</Typography></Box></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Box>{pagos.map((p) => <PagoCard key={p.id} pago={p} />)}</Box>
            )}
          </Paper>
        </Box>
      )}

      {/* ── Modales Base (Crear Empresa y Planes) ── */}
      <Dialog open={openDialogEmpresa} onClose={() => setOpenDialogEmpresa(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
         <DialogTitle>Alta de Cliente</DialogTitle>
         <form onSubmit={handleSubmitEmpresa}>
            <DialogContent dividers>
              <Stack spacing={2}>
                <TextField label="Nombre" required size="small" value={formEmpresa.nombre} onChange={e => setFormEmpresa({...formEmpresa, nombre: e.target.value})} />
                <TextField label="NIT" size="small" value={formEmpresa.nit} onChange={e => setFormEmpresa({...formEmpresa, nit: e.target.value})} />
                <TextField label="Usuario Admin" required size="small" value={formEmpresa.admin_username} onChange={e => setFormEmpresa({...formEmpresa, admin_username: e.target.value})} />
                <TextField label="Password" required type="password" size="small" value={formEmpresa.admin_password} onChange={e => setFormEmpresa({...formEmpresa, admin_password: e.target.value})} />
              </Stack>
            </DialogContent>
            <DialogActions sx={{ p: 2 }}><Button onClick={() => setOpenDialogEmpresa(false)} variant="outlined" sx={{ borderRadius: 2 }}>Cancelar</Button><Button type="submit" variant="contained" disabled={loading} sx={{ bgcolor: ACCENT, borderRadius: 2 }}>Crear Inquilino</Button></DialogActions>
         </form>
      </Dialog>

      <Dialog open={openCatalogDialog} onClose={() => setOpenCatalogDialog(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><Typography sx={{ fontWeight: 700, fontSize: 17 }}>{editingPlanId ? 'Editar Plan' : 'Crear Nuevo Plan'}</Typography><IconButton size="small" onClick={() => setOpenCatalogDialog(false)}><Close fontSize="small" /></IconButton></DialogTitle>
        <form onSubmit={handleSubmitPlan}>
          <DialogContent dividers>
            <Stack spacing={2.5}>
              <TextField label="Nombre Comercial" required size="small" value={formPlan.nombre} onChange={e => setFormPlan({...formPlan, nombre: e.target.value})} />
              <TextField label="Código Interno" required size="small" value={formPlan.codigo_interno} onChange={e => setFormPlan({...formPlan, codigo_interno: e.target.value.toLowerCase().replace(/ /g, '_')})} disabled={!!editingPlanId} />
              <Box sx={{ display: 'flex', gap: 2 }}><TextField label="Precio (COP)" type="number" required size="small" fullWidth value={formPlan.precio} onChange={e => setFormPlan({...formPlan, precio: e.target.value})} /><TextField label="Duración (Días)" type="number" required size="small" fullWidth value={formPlan.dias_duracion} onChange={e => setFormPlan({...formPlan, dias_duracion: e.target.value})} /></Box>
              <TextField label="Características (Separadas por coma)" size="small" multiline rows={2} value={formPlan.caracteristicas} onChange={e => setFormPlan({...formPlan, caracteristicas: e.target.value})} />
              <FormControlLabel control={<Switch checked={formPlan.is_active} onChange={e => setFormPlan({...formPlan, is_active: e.target.checked})} color="primary" />} label="Plan Visible" />
            </Stack>
          </DialogContent>
          <DialogActions sx={{ p: 2 }}><Button onClick={() => setOpenCatalogDialog(false)} variant="outlined" sx={{ borderRadius: 2 }}>Cancelar</Button><Button type="submit" variant="contained" disabled={loading} sx={{ bgcolor: BLUE, borderRadius: 2 }}>Guardar Plan</Button></DialogActions>
        </form>
      </Dialog>

      <Dialog open={openPlanDialog} onClose={() => setOpenPlanDialog(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><Typography sx={{ fontWeight: 700, fontSize: 16 }}>Suscripción: {empresaSeleccionada?.nombre}</Typography><IconButton size="small" onClick={() => setOpenPlanDialog(false)}><Close fontSize="small" /></IconButton></DialogTitle>
        <form onSubmit={handleUpdateSuscripcion}>
          <DialogContent dividers>
            <Stack spacing={3}>
              <TextField select label="Seleccionar Plan o Acción" value={formAsignarPlan.plan_selector} onChange={handleSelectPlanChange} fullWidth size="small">
                <MenuItem value="trial">Volver a Trial (Prueba)</MenuItem><MenuItem value="premium">Premium Genérico (Manual)</MenuItem><Divider sx={{ my: 1 }} />
                <MenuItem disabled value=""><Typography variant="caption" sx={{ fontWeight: 800 }}>PLANES DEL CATÁLOGO:</Typography></MenuItem>
                {planesCatalog.map(plan => <MenuItem key={plan.id} value={plan.codigo_interno} sx={{ pl: 3 }}>Asignar: {plan.nombre}</MenuItem>)}
              </TextField>
              <TextField type="date" label="Fecha de Vencimiento" InputLabelProps={{ shrink: true }} value={formAsignarPlan.trial_ends_at} onChange={e => setFormAsignarPlan({...formAsignarPlan, trial_ends_at: e.target.value})} fullWidth size="small" />
            </Stack>
          </DialogContent>
          <DialogActions sx={{ p: 2 }}><Button onClick={() => setOpenPlanDialog(false)} variant="outlined" sx={{ borderRadius: 2 }}>Cancelar</Button><Button type="submit" variant="contained" disabled={loading} sx={{ bgcolor: '#8B5CF6', borderRadius: 2 }}>Guardar</Button></DialogActions>
        </form>
      </Dialog>
    </Box>
  );
}