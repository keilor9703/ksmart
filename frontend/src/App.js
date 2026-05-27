import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { ThemeProvider } from '@mui/material/styles';
import {
  Box, Typography, CircularProgress, Drawer,
  CssBaseline, GlobalStyles,
} from '@mui/material';
import useMediaQueryHook from '@mui/material/useMediaQuery';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { Route, Routes, useNavigate } from 'react-router-dom';

import apiClient from './api';
import getAppTheme from './theme';

// ✅ IMPORTACIÓN DE COMPONENTES DE LAYOUT
import Sidebar from './layout/Sidebar';
import TopBar from './layout/TopBar';

// ✅ IMPORTACIÓN DE COMPONENTES PRIVADOS (PANTALLAS)
import Productos from './features/inventory/Productos';
import Ventas from './features/sales/Ventas';
import PedidosVirtuales from './features/sales/PedidosVirtuales';
import Reportes from './features/reports/Reportes';
import Login from './features/auth/Login';
import OrdenesTrabajo from './features/workOrders/OrdenesTrabajo';
import Recetas from './features/production/Recetas';
import Lotes from './features/inventory/Lotes';
import Terceros from './features/clients/Terceros';
import Compras from './features/purchases/Compras';
import PanelOperador from './features/workOrders/PanelOperador';
import { SpeedInsights } from '@vercel/speed-insights/react';
import Inventario from './features/inventory/Inventario';
import InventoryReports from './features/inventory/InventoryReports';
import AgileBarcodeRegistration from './features/inventory/AgileBarcodeRegistration'; 
import Dashboard from './features/dashboard/Dashboard';
import Caja from './features/finance/Caja';
import AdminUsuarios from './features/admin/AdminUsuarios';
import GestionEmpresas from './features/admin/GestionEmpresas';
import InventarioLotes from './features/inventory/InventarioLotes';
import Cotizaciones from './features/sales/Cotizaciones';
import ResolucionesDian from './features/dian/ResolucionesDian';
import MiSuscripcion from './features/account/MiSuscripcion';

// ✅ CATÁLOGO VIRTUAL
import CatalogoConfig from './features/saas/CatalogoConfig';
import CatalogoVirtual from './features/saas/CatalogoVirtual';

// ✅ IMPORTAMOS LAS PANTALLAS PÚBLICAS (Login, Registro, etc.)
import SuscripcionExpirada from './features/auth/SuscripcionExpirada';
import { Terminos, Privacidad, HabeasData } from './features/legal/LegalPages';

// ✅ IMPORTAMOS LOS NUEVOS MÓDULOS DE PRÉSTAMOS
import PrestamoForm from './features/loans/PrestamoForm';
import RutaCobro from './features/loans/RutaCobro';

// ✅ MÓDULO PARQUEADERO
import ParqueaderoDashboard      from './features/parking/ParqueaderoDashboard';
import ParqueaderoBuscar         from './features/parking/ParqueaderoBuscar';
import ParqueaderoVehiculos      from './features/parking/ParqueaderoVehiculos';
import ParqueaderoSuscripciones  from './features/parking/ParqueaderoSuscripciones';
import ParqueaderoConfig         from './features/parking/ParqueaderoConfig';
import LavaderoVentas            from './features/lavadero/LavaderoVentas';
import LavaderoReporte           from './features/lavadero/LavaderoReporte';

// ✅ MÓDULO SAAS (ANUNCIOS)
import AnnouncementBanner from './features/saas/components/AnnouncementBanner';
import { OnboardingProvider } from './context/OnboardingContext';

// ✨ IMPORTAMOS EL MODAL DE BIOMETRÍA
import ModalHuella from './components/common/ModalHuella';

// ─── Constantes de Layout ──────────────────────────────────────────────────────
const SIDEBAR_FULL  = 240;
const SIDEBAR_MINI  = 68;
const ACCENT        = '#FF6020';
const PAGE_BG_LIGHT = '#F4F6F9';
const PAGE_BG_DARK  = '#0d1117';

// ─── Home ──────────────────────────────────────────────────────────────────────
const Home = () => (
  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 3 }}>
    <Box component="img" src="/logos/svg/ksmart-icon-rounded.svg" alt="Ksmart360" sx={{ width: 120, height: 120, borderRadius: 4, boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }} />
    <Box sx={{ textAlign: 'center' }}>
      <Typography variant="h4" fontWeight={700} sx={{ fontFamily: "'Plus Jakarta Sans', sans-serif", mb: 1 }}>Bienvenido a Ksmart360</Typography>
      <Typography variant="body1" color="text.secondary">La nueva forma de gestionar tu negocio de forma inteligente</Typography>
    </Box>
  </Box>
);

const ProtectedRoute = ({ path, hasAccess, children }) => {
  if (hasAccess(path)) return children;
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', minHeight: '60vh', gap: 2, textAlign: 'center' }}>
      <Box sx={{ fontSize: 48 }}>🔒</Box>
      <Typography variant="h5" fontWeight={700}>Acceso restringido</Typography>
      <Typography color="text.secondary" sx={{ maxWidth: 400 }}>
        Tu rol no tiene permisos para ver este módulo.<br />
        Contacta al administrador si crees que es un error.
      </Typography>
    </Box>
  );
};

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl]   = useState(null);
  const navigate = useNavigate();

  const [mode, setMode] = useState(() => {
    const saved = localStorage.getItem('themeMode');
    if (saved === 'dark' || saved === 'light') return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  const appTheme = useMemo(() => getAppTheme(mode), [mode]);
  const isMobile = useMediaQueryHook(appTheme.breakpoints.down('md'));
  const openMenu = Boolean(anchorEl);

  useEffect(() => { localStorage.setItem('themeMode', mode); }, [mode]);
  useEffect(() => { checkAuth(); }, []);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e) => {
      if (!localStorage.getItem('themeMode')) {
        setMode(e.matches ? 'dark' : 'light');
      }
    };
    mq.addEventListener('change', handleChange);
    return () => mq.removeEventListener('change', handleChange);
  }, []);

  const checkAuth = async () => {
      const token = localStorage.getItem('token');
      if (token) {
        try {
          const res = await apiClient.get('/users/me', {
            headers: { Authorization: `Bearer ${token}` },
          });
          const emp = res.data.empresa;
          const expirado = emp?.is_plan_expired;

          if (expirado && emp.id !== 1 && !emp.is_protected) {
             setIsAuthenticated(false);
             setUser({ ...res.data, isPlanExpired: true });
             navigate('/suscripcion-expirada');
          } else {
             setIsAuthenticated(true);
             setUser({ ...res.data, isPlanExpired: false });
          }

          const modulosDelRol = res.data.role.modules.map(m => m.frontend_path);
          const modulosDeLaEmpresa = res.data.empresa?.modulos_habilitados;
          let modulosFinales = modulosDelRol;

          if (modulosDeLaEmpresa && Array.isArray(modulosDeLaEmpresa)) {
            modulosFinales = modulosDelRol.filter(path => modulosDeLaEmpresa.includes(path));
          }
          localStorage.setItem('userModules', JSON.stringify(modulosFinales));

        } catch (error) {
          const status = error.response?.status;
          if (status === 402 || status === 403) {
            setIsAuthenticated(false);
            navigate('/suscripcion-expirada');
          } else {
            handleLogout(false);
            toast.error('Sesión expirada. Por favor inicia sesión nuevamente.');
          }
        }
    } else {
      setIsAuthenticated(false);
      setUser(null);
      localStorage.removeItem('userModules');
    }
    setLoading(false);
  };

const hasAccess = useCallback((path) => {
  if (user?.role?.name === 'Admin' && user?.empresa_id === 1) return true;
  const rolTieneModulo = user?.role?.modules?.some(m => m.frontend_path === path);
  if (!rolTieneModulo) return false;
  const modulosEmpresa = user?.empresa?.modulos_habilitados;
  if (modulosEmpresa === null || modulosEmpresa === undefined) return true;
  return Array.isArray(modulosEmpresa) && modulosEmpresa.includes(path);
}, [user]);

  const handleLogout = (showToast = true) => {
    localStorage.removeItem('token');
    localStorage.removeItem('userModules');
    setIsAuthenticated(false);
    setUser(null);
    if (showToast) toast.info('Sesión cerrada.');
    navigate('/login');
  };

  const sidebarWidth = isMobile ? 0 : (sidebarExpanded ? SIDEBAR_FULL : SIDEBAR_MINI);

  return (
    <OnboardingProvider>
      <ThemeProvider theme={appTheme}>
        <CssBaseline />
        <GlobalStyles
          styles={(theme) => ({
            '@import': "url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap')",
            html: { width: '100%', minHeight: '100vh', overflowX: 'hidden' },
            body: {
              width: '100%', minHeight: '100vh', overflowX: 'hidden',
              backgroundColor: theme.palette.background.default,
              fontFamily: "'Plus Jakarta Sans', sans-serif",
            },
            '#root': { width: '100%', minHeight: '100vh', display: 'flex', flexDirection: 'column' },
            '*': { boxSizing: 'border-box' },
            '@keyframes pulse': {
              '0%': { boxShadow: '0 0 0 0 rgba(239, 68, 68, 0.7)' },
              '70%': { boxShadow: '0 0 0 8px rgba(239, 68, 68, 0)' },
              '100%': { boxShadow: '0 0 0 0 rgba(239, 68, 68, 0)' }
            }
          })}
        />

        <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default', width: '100%', maxWidth: '100vw', overflowX: 'hidden' }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', width: '100%' }}>
              <CircularProgress sx={{ color: ACCENT }} />
            </Box>
          ) : isAuthenticated ? (
            <>
              <ModalHuella />
              {!isMobile && (
                <Box
                  onMouseEnter={() => setSidebarExpanded(true)}
                  onMouseLeave={() => setSidebarExpanded(false)}
                  sx={{
                    position: 'fixed', top: 0, left: 0, zIndex: 1200,
                    height: '100vh', width: sidebarExpanded ? SIDEBAR_FULL : SIDEBAR_MINI,
                    transition: 'width 0.22s cubic-bezier(0.4,0,0.2,1)', overflow: 'hidden',
                    boxShadow: sidebarExpanded ? '4px 0 24px rgba(0,0,0,0.18)' : 'none',
                  }}
                >
                  <Sidebar expanded={sidebarExpanded} user={user} hasAccess={hasAccess} />
                </Box>
              )}

              {isMobile && (
                <Drawer
                  variant="temporary" open={mobileOpen} onClose={() => setMobileOpen(false)}
                  ModalProps={{ keepMounted: true }}
                  sx={{ '& .MuiDrawer-paper': { width: SIDEBAR_FULL, border: 'none' } }}
                >
                  <Sidebar expanded user={user} hasAccess={hasAccess} onClose={() => setMobileOpen(false)} mobile />
                </Drawer>
              )}

              <TopBar
                sidebarExpanded={sidebarExpanded} isMobile={isMobile}
                onMobileMenuOpen={() => setMobileOpen(true)} mode={mode}
                onThemeToggle={() => setMode(m => m === 'light' ? 'dark' : 'light')}
                onLogout={handleLogout} user={user} anchorEl={anchorEl}
                openMenu={openMenu} onMenuOpen={(e) => setAnchorEl(e.currentTarget)}
                onMenuClose={() => setAnchorEl(null)}
              />

              <Box
                component="main"
                sx={{
                  flexGrow: 1, minWidth: 0, ml: isMobile ? 0 : `${sidebarWidth}px`, mt: '60px',
                  minHeight: 'calc(100vh - 60px)', transition: 'margin-left 0.22s cubic-bezier(0.4,0,0.2,1)',
                  backgroundColor: mode === 'dark' ? PAGE_BG_DARK : PAGE_BG_LIGHT,
                  display: 'flex', flexDirection: 'column', overflow: 'hidden',
                }}
              >
                <Box sx={{ flex: 1, p: { xs: 1.5, md: 3 }, minWidth: 0, overflow: 'hidden' }}>
                  <AnnouncementBanner />
                  <Routes>
                    <Route path="/" element={
                      ["Admin", "Socio", "Consulta"].includes(user?.role?.name)
                        ? (user?.empresa?.modulos_habilitados?.includes('/parqueadero') 
                            ? <ParqueaderoDashboard user={user} /> 
                            : <Dashboard user={user} />)
                        : <Home />
                    } />
                    <Route path="/ventas"             element={<ProtectedRoute path="/ventas"             hasAccess={hasAccess}><Ventas user={user} /></ProtectedRoute>} />
                    <Route path="/pedidos-virtuales" element={<ProtectedRoute path="/pedidos-virtuales" hasAccess={hasAccess}><PedidosVirtuales user={user} /></ProtectedRoute>} />
                    <Route path="/cotizaciones"       element={<ProtectedRoute path="/cotizaciones"       hasAccess={hasAccess}><Cotizaciones /></ProtectedRoute>} />
                    <Route path="/admin/resoluciones" element={<ProtectedRoute path="/admin/resoluciones" hasAccess={hasAccess}><ResolucionesDian /></ProtectedRoute>} />
                    <Route path="/compras"            element={<ProtectedRoute path="/compras"            hasAccess={hasAccess}><Compras /></ProtectedRoute>} />
                    <Route path="/clientes"           element={<ProtectedRoute path="/clientes"           hasAccess={hasAccess}><Terceros /></ProtectedRoute>} />
                    <Route path="/productos"          element={<ProtectedRoute path="/productos"          hasAccess={hasAccess}><Productos /></ProtectedRoute>} />
                    <Route path="/inventario"         element={<ProtectedRoute path="/inventario"         hasAccess={hasAccess}><Inventario /></ProtectedRoute>} />
                    <Route path="/inventario/lotes"   element={<ProtectedRoute path="/inventario/lotes"   hasAccess={hasAccess}><InventarioLotes /></ProtectedRoute>} />
                    <Route path="/caja"               element={<ProtectedRoute path="/caja"               hasAccess={hasAccess}><Caja /></ProtectedRoute>} />
                    <Route path="/produccion/recetas" element={<ProtectedRoute path="/produccion/recetas" hasAccess={hasAccess}><Recetas /></ProtectedRoute>} />
                    <Route path="/produccion/lotes"   element={<ProtectedRoute path="/produccion/lotes"   hasAccess={hasAccess}><Lotes /></ProtectedRoute>} />
                    <Route path="/reportes-inventario"element={<ProtectedRoute path="/reportes-inventario"hasAccess={hasAccess}><InventoryReports /></ProtectedRoute>} />
                    <Route path="/reportes"           element={<ProtectedRoute path="/reportes"           hasAccess={hasAccess}><Reportes /></ProtectedRoute>} />
                    <Route path="/ordenes-trabajo"    element={<ProtectedRoute path="/ordenes-trabajo"    hasAccess={hasAccess}><OrdenesTrabajo user={user} /></ProtectedRoute>} />
                    <Route path="/prestamos"          element={<ProtectedRoute path="/prestamos"          hasAccess={hasAccess}><PrestamoForm /></ProtectedRoute>} />
                    <Route path="/ruta-cobro"         element={<ProtectedRoute path="/ruta-cobro"         hasAccess={hasAccess}><RutaCobro /></ProtectedRoute>} />
                    <Route path="/panel-operador"     element={<ProtectedRoute path="/panel-operador"     hasAccess={hasAccess}><PanelOperador /></ProtectedRoute>} />
                    <Route path="/parqueadero"                element={<ProtectedRoute path="/parqueadero"                hasAccess={hasAccess}><ParqueaderoDashboard user={user} /></ProtectedRoute>} />
                    <Route path="/parqueadero/buscar"         element={<ProtectedRoute path="/parqueadero/buscar"         hasAccess={hasAccess}><ParqueaderoBuscar         /></ProtectedRoute>} />
                    <Route path="/parqueadero/vehiculos"      element={<ProtectedRoute path="/parqueadero/vehiculos"      hasAccess={hasAccess}><ParqueaderoVehiculos      /></ProtectedRoute>} />
                    <Route path="/parqueadero/suscripciones"  element={<ProtectedRoute path="/parqueadero/suscripciones"  hasAccess={hasAccess}><ParqueaderoSuscripciones  /></ProtectedRoute>} />
                    <Route path="/parqueadero/config"         element={<ProtectedRoute path="/parqueadero/config"         hasAccess={hasAccess}><ParqueaderoConfig         /></ProtectedRoute>} />
                    <Route path="/lavadero/ventas"   element={<ProtectedRoute path="/lavadero/ventas"  hasAccess={hasAccess}><LavaderoVentas  user={user} /></ProtectedRoute>} />
                    <Route path="/lavadero/reporte"  element={<ProtectedRoute path="/lavadero/reporte" hasAccess={hasAccess}><LavaderoReporte user={user} /></ProtectedRoute>} />
                    {user?.role?.name === 'Admin' && user?.empresa_id === 1 && (
                      <Route path="/superadmin/empresas" element={<GestionEmpresas />} />
                    )}
                    {user?.role?.name === 'Admin' && (
                      <>
                        <Route path="/admin/usuarios" element={<AdminUsuarios />} />
                        <Route path="/admin/catalogo" element={<CatalogoConfig />} />
                      </>
                    )}
                    <Route path="/mi-suscripcion" element={<MiSuscripcion user={user} />} />
                    <Route path="/terminos" element={<Terminos />} />
                    <Route path="/privacidad" element={<Privacidad />} />
                    <Route path="/habeas-data" element={<HabeasData />} />
                  </Routes>
                </Box>
                <Box component="footer" sx={{ 
                  py: 2, px: 3, display: 'flex', flexDirection: { xs: 'column', sm: 'row' },
                  alignItems: 'center', justifyContent: 'center', gap: { xs: 1, sm: 3 }, 
                  borderTop: `1px solid ${mode === 'dark' ? 'rgba(255,255,255,0.06)' : '#E5E7EB'}`, 
                }}>
                  <Typography variant="caption" color="text.secondary">Powered KSMP Systems - 2026</Typography>
                  <Box sx={{ display: 'flex', gap: 2 }}>
                    <Typography variant="caption" component="a" href="/terminos" sx={{ color: 'text.secondary', textDecoration: 'none' }}>Términos</Typography>
                    <Typography variant="caption" component="a" href="/privacidad" sx={{ color: 'text.secondary', textDecoration: 'none' }}>Privacidad</Typography>
                    <Typography variant="caption" component="a" href="/habeas-data" sx={{ color: 'text.secondary', textDecoration: 'none' }}>Habeas Data</Typography>
                  </Box>
                  <Box component="img" src="/logos/svg/ksmart-mark-white.svg" alt="Ksmart360" sx={{ height: 20, opacity: 0.7 }} />
                </Box>
              </Box>
            </>
          ) : (
            <Box sx={{ width: '100%', minHeight: '100vh' }}>
              <Routes>
                <Route path="/suscripcion-expirada" element={<SuscripcionExpirada onActive={checkAuth} />} />
                <Route path="/login" element={<Login onLogin={checkAuth} />} />
                <Route path="/terminos" element={<Terminos />} />
                <Route path="/privacidad" element={<Privacidad />} />
                <Route path="/habeas-data" element={<HabeasData />} />
                <Route path="/:slug" element={<CatalogoVirtual />} />
                <Route path="*" element={<Login onLogin={checkAuth} />} />
              </Routes>
            </Box>
          )}
        </Box>
        <ToastContainer position="bottom-right" autoClose={3500} />
        <SpeedInsights />
      </ThemeProvider>
    </OnboardingProvider>
  );
}

export default App;
