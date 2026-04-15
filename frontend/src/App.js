import React, { useState, useEffect, useMemo } from 'react';
import { ThemeProvider } from '@mui/material/styles';
import {
  Box, Typography, IconButton, List, ListItemButton,
  ListItemText, ListItemIcon, Collapse, CircularProgress, Divider,
  Drawer, Tooltip, CssBaseline, GlobalStyles, Menu, MenuItem,
  Avatar
} from '@mui/material';
import {
  ShoppingCart, People, Inventory, Assessment, AdminPanelSettings,
  ExpandLess, ExpandMore, Assignment, Dashboard as DashboardIcon,
  Logout as LogoutIcon, Menu as MenuIcon, MoreVert as MoreVertIcon,
  PrecisionManufacturing, ShoppingBag, KeyboardArrowRight,
  LightMode, DarkMode, PointOfSale as PointOfSaleIcon, Business
} from '@mui/icons-material';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import useMediaQueryHook from '@mui/material/useMediaQuery';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { Route, Routes, Link, useNavigate, useLocation } from 'react-router-dom';

import apiClient from './api';
import getAppTheme from './theme';

import Productos from './components/Productos';
import Ventas from './components/Ventas';
import Reportes from './components/Reportes';
import Login from './components/Login';
import OrdenesTrabajo from './components/OrdenesTrabajo';
import Recetas from './components/Recetas';
import Lotes from './components/Lotes';
import Terceros from './components/Terceros';
import Compras from './components/Compras';
import PanelOperador from './components/PanelOperador';
import { SpeedInsights } from '@vercel/speed-insights/react';
import Inventario from './components/Inventario';
import InventoryReports from './components/InventoryReports';
import Dashboard from './components/Dashboard';
import Notifications from './components/Notifications';
import Caja from './components/Caja';
import AdminUsuarios from './components/AdminUsuarios';
import GestionEmpresas from './components/GestionEmpresas';

// ✅ IMPORTAMOS LA NUEVA PANTALLA DE PAGO
import SuscripcionExpirada from './components/SuscripcionExpirada';

// ─── Constantes ────────────────────────────────────────────────────────────────
const SIDEBAR_FULL   = 240;
const SIDEBAR_MINI   = 68;

// ─── Paleta unificada (dark sidebar + light content) ──────────────────────────
const SIDEBAR_BG     = '#0f172a';
const SIDEBAR_HOVER  = 'rgba(255,255,255,0.06)';
const SIDEBAR_ACTIVE = 'rgba(255,100,30,0.18)';
const ACCENT         = '#FF6020'; 
const PAGE_BG_LIGHT  = '#F4F6F9';
const PAGE_BG_DARK   = '#0d1117';

// ─── Datos de navegación ───────────────────────────────────────────────────────
const menuItems = [
  { path: '/ventas',          text: 'Ventas',              icon: <ShoppingCart />,         color: '#FF6020' },
  { path: '/compras',         text: 'Compras',             icon: <ShoppingBag />,          color: '#10B981' },
  { path: '/clientes',        text: 'Terceros',            icon: <People />,               color: '#3B82F6' },
  { path: '/productos',       text: 'Productos',           icon: <Inventory />,            color: '#8B5CF6' },
  { path: '/inventario',      text: 'Inventarios',         icon: <Inventory2OutlinedIcon />, color: '#F59E0B' },
  { path: '/caja',            text: 'Caja',                icon: <PointOfSaleIcon />,      color: '#FF6020' },
  { path: '/produccion/lotes',text: 'Producción',          icon: <PrecisionManufacturing />,color: '#06B6D4' },
  { path: '/ordenes-trabajo', text: 'Órdenes de Trabajo',  icon: <Assignment />,           color: '#EC4899' },
  { path: '/panel-operador',  text: 'Panel Operador',      icon: <DashboardIcon />,        color: '#14B8A6' },
  { path: '/reportes',        text: 'Reportes',            icon: <Assessment />,           color: '#F43F5E' },
];

const adminMenuItems = [
  { path: '/admin/usuarios', text: 'Usuarios y Permisos' },
];

// ─── Home ──────────────────────────────────────────────────────────────────────
const Home = () => (
  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 3 }}>
    <Box component="img" src={process.env.PUBLIC_URL + '/Logo1.jpg'} alt="Ksmart360" sx={{ width: 120, height: 120, borderRadius: 4, boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }} />
    <Box sx={{ textAlign: 'center' }}>
      <Typography variant="h4" fontWeight={700} sx={{ fontFamily: "'Plus Jakarta Sans', sans-serif", mb: 1 }}>Bienvenido a Ksmart360</Typography>
      <Typography variant="body1" color="text.secondary">La nueva forma de gestionar tu negocio de forma inteligente</Typography>
    </Box>
  </Box>
);

// ─── Sidebar Item ──────────────────────────────────────────────────────────────
const SidebarItem = ({ item, expanded, onClick, onClose, active }) => (
  <Tooltip title={!expanded ? item.text : ''} placement="right" arrow>
    <ListItemButton
      component={onClick ? 'div' : Link}   
      to={onClick ? undefined : item.path} 
      onClick={onClick ?? onClose}         
      sx={{
        mx: 1, mb: 0.5, borderRadius: 2, minHeight: 44,
        px: expanded ? 2 : 1.5, justifyContent: expanded ? 'flex-start' : 'center',
        backgroundColor: active ? SIDEBAR_ACTIVE : 'transparent',
        borderLeft: active ? `3px solid ${ACCENT}` : '3px solid transparent',
        transition: 'all 0.18s ease',
        '&:hover': { backgroundColor: active ? SIDEBAR_ACTIVE : SIDEBAR_HOVER },
      }}
    >
      <ListItemIcon sx={{ minWidth: 0, mr: expanded ? 1.5 : 0, color: active ? ACCENT : (item.color || '#94a3b8'), transition: 'margin 0.2s', fontSize: 20 }}>
        {item.icon}
      </ListItemIcon>
      {expanded && (
        <ListItemText
          primary={item.text}
          primaryTypographyProps={{ fontSize: 13.5, fontWeight: active ? 600 : 400, fontFamily: "'Plus Jakarta Sans', sans-serif", color: active ? '#fff' : '#cbd5e1', noWrap: true }}
        />
      )}
    </ListItemButton>
  </Tooltip>
);

// ─── Sidebar ───────────────────────────────────────────────────────────────────
const Sidebar = ({ expanded, user, hasAccess, onClose, mobile }) => {
  const location = useLocation();
  const [adminOpen, setAdminOpen] = useState(false);
  const isActive = (path) => location.pathname === path || location.pathname.startsWith(path + '/');

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', background: SIDEBAR_BG, overflowX: 'hidden' }}>
      <Box component={Link} to="/" onClick={mobile ? onClose : undefined} sx={{ display: 'flex', alignItems: 'center', px: expanded ? 2.5 : 1.5, py: 2.5, minHeight: 64, borderBottom: '1px solid rgba(255,255,255,0.06)', gap: 1.5, textDecoration: 'none', cursor: 'pointer', transition: 'opacity 0.15s', '&:hover': { opacity: 0.85 } }}>
        <Box component="img" src="/Logo2.png" alt="Logo" sx={{ width: 34, height: 34, borderRadius: 1.5, flexShrink: 0 }} />
        {expanded && (
          <Typography sx={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, fontSize: 16, color: '#fff', whiteSpace: 'nowrap' }}>
            Ksmart<span style={{ color: ACCENT }}>360</span>
          </Typography>
        )}
      </Box>

      <Box sx={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', py: 1.5, '&::-webkit-scrollbar': { width: 4 }, '&::-webkit-scrollbar-thumb': { background: 'rgba(255,255,255,0.1)', borderRadius: 4 } }}>
        {user?.role?.name === 'Admin' && user?.empresa_id === 1 && (
          <>
            <SidebarItem expanded={expanded} item={{ path: '/superadmin/empresas', text: 'Clientes SaaS', icon: <Business />, color: '#F43F5E' }} active={isActive('/superadmin/empresas')} onClose={mobile ? onClose : undefined} />
            {expanded && <Divider sx={{ mx: 2, my: 1, borderColor: 'rgba(255,255,255,0.06)' }} />}
          </>
        )}

        {user?.role?.name === 'Admin' && (
          <>
            <SidebarItem expanded={expanded} item={{ text: 'Administración', icon: <AdminPanelSettings />, color: '#a78bfa' }} onClick={() => setAdminOpen(o => !o)} active={false} />
            <Collapse in={adminOpen && expanded} timeout="auto" unmountOnExit>
              <List disablePadding>
                {adminMenuItems.map(sub => (
                  <ListItemButton key={sub.path} component={Link} to={sub.path} onClick={mobile ? onClose : undefined} sx={{ pl: 5, pr: 2, py: 0.75, mx: 1, mb: 0.25, borderRadius: 2, backgroundColor: isActive(sub.path) ? SIDEBAR_ACTIVE : 'transparent', '&:hover': { backgroundColor: SIDEBAR_HOVER } }}>
                    <KeyboardArrowRight sx={{ fontSize: 14, color: '#64748b', mr: 1 }} />
                    <ListItemText primary={sub.text} primaryTypographyProps={{ fontSize: 13, color: isActive(sub.path) ? '#fff' : '#94a3b8', fontFamily: "'Plus Jakarta Sans', sans-serif" }} />
                  </ListItemButton>
                ))}
              </List>
            </Collapse>
            {expanded && <Typography sx={{ px: 2.5, pt: 2, pb: 0.5, fontSize: 10, fontWeight: 600, color: '#475569', letterSpacing: 1.2, textTransform: 'uppercase', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Módulos</Typography>}
          </>
        )}

        {menuItems.map(item => hasAccess(item.path) ? (
          <SidebarItem key={item.path} item={item} expanded={expanded} active={isActive(item.path)} onClose={mobile ? onClose : undefined} />
        ) : null)}
      </Box>

      <Box sx={{ borderTop: '1px solid rgba(255,255,255,0.06)', px: expanded ? 2 : 1, py: 1.5, display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Avatar sx={{ width: 34, height: 34, flexShrink: 0, background: `linear-gradient(135deg, ${ACCENT}, #ff9a62)`, fontSize: 13, fontWeight: 700 }}>
          {user?.username?.[0]?.toUpperCase()}
        </Avatar>
        {expanded && (
          <Box sx={{ overflow: 'hidden', flex: 1 }}>
            <Typography sx={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0', fontFamily: "'Plus Jakarta Sans', sans-serif", whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.username}</Typography>
            <Typography sx={{ fontSize: 11, color: '#64748b' }}>{user?.role?.name}</Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
};

// ─── TopBar ────────────────────────────────────────────────────────────────────
const TopBar = ({ sidebarExpanded, isMobile, onMobileMenuOpen, mode, onThemeToggle, onLogout, user, anchorEl, openMenu, onMenuOpen, onMenuClose }) => {
  const location = useLocation();
  const currentPage = [...menuItems, ...adminMenuItems, { path: '/superadmin/empresas', text: 'Clientes SaaS' }].find(i => location.pathname === i.path || location.pathname.startsWith(i.path + '/'))?.text || 'Inicio';

  return (
    <Box component="header" sx={{ position: 'fixed', top: 0, right: 0, zIndex: 1100, left: isMobile ? 0 : (sidebarExpanded ? SIDEBAR_FULL : SIDEBAR_MINI), height: 60, display: 'flex', alignItems: 'center', px: { xs: 2, md: 3 }, backgroundColor: mode === 'dark' ? '#0d1117' : '#fff', borderBottom: `1px solid ${mode === 'dark' ? 'rgba(255,255,255,0.06)' : '#E5E7EB'}`, gap: 2, transition: 'left 0.25s ease' }}>
      {isMobile && (
        <IconButton onClick={onMobileMenuOpen} size="small"><MenuIcon /></IconButton>
      )}
      <Box sx={{ flex: 1 }}>
        <Typography sx={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, fontSize: 16, color: mode === 'dark' ? '#f1f5f9' : '#111827' }}>{currentPage}</Typography>
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <Tooltip title={mode === 'dark' ? 'Modo claro' : 'Modo oscuro'}>
          <IconButton onClick={onThemeToggle} size="small" sx={{ color: mode === 'dark' ? '#94a3b8' : '#6B7280' }}>
            {mode === 'dark' ? <LightMode fontSize="small" /> : <DarkMode fontSize="small" />}
          </IconButton>
        </Tooltip>
        <Notifications mode={mode} />
        {!isMobile && (
          <>
            <Tooltip title="Cerrar sesión">
              <IconButton onClick={onLogout} size="small" sx={{ color: mode === 'dark' ? '#94a3b8' : '#6B7280' }}>
                <LogoutIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, ml: 1, pl: 1.5, pr: 2, py: 0.75, borderRadius: 3, backgroundColor: mode === 'dark' ? 'rgba(255,255,255,0.05)' : '#F4F6F9', border: `1px solid ${mode === 'dark' ? 'rgba(255,255,255,0.08)' : '#E5E7EB'}` }}>
              <Avatar sx={{ width: 26, height: 26, background: `linear-gradient(135deg, ${ACCENT}, #ff9a62)`, fontSize: 11, fontWeight: 700 }}>
                {user?.username?.[0]?.toUpperCase()}
              </Avatar>
              <Typography sx={{ fontSize: 13, fontWeight: 600, fontFamily: "'Plus Jakarta Sans', sans-serif", color: mode === 'dark' ? '#e2e8f0' : '#374151' }}>{user?.username}</Typography>
            </Box>
          </>
        )}
        {isMobile && (
          <>
            <IconButton onClick={onMenuOpen} size="small"><MoreVertIcon /></IconButton>
            <Menu anchorEl={anchorEl} open={openMenu} onClose={onMenuClose} PaperProps={{ sx: { mt: 1, minWidth: 160, borderRadius: 2 } }}>
              <MenuItem onClick={() => { onLogout(); onMenuClose(); }} sx={{ color: 'error.main' }}>
                <LogoutIcon fontSize="small" sx={{ mr: 1.5 }} /> Cerrar sesión
              </MenuItem>
            </Menu>
          </>
        )}
      </Box>
    </Box>
  );
};

// ─── App ───────────────────────────────────────────────────────────────────────
function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl]   = useState(null);
  const navigate = useNavigate();

  const [mode, setMode] = useState(() =>
    localStorage.getItem('themeMode') === 'dark' ? 'dark' : 'light'
  );

  const appTheme = useMemo(() => getAppTheme(mode), [mode]);
  const isMobile = useMediaQueryHook(appTheme.breakpoints.down('md'));
  const openMenu = Boolean(anchorEl);

  useEffect(() => { localStorage.setItem('themeMode', mode); }, [mode]);

  useEffect(() => { checkAuth(); }, []);

  const checkAuth = async () => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const res = await apiClient.get('/users/me', {
          headers: { Authorization: `Bearer ${token}` },
        });
        setIsAuthenticated(true);
        setUser(res.data);
        localStorage.setItem('userModules', JSON.stringify(
          res.data.role.modules.map(m => m.frontend_path)
        ));
      } catch (error) {
        // ✅ AQUÍ ESTÁ LA MAGIA DEL TRIAL
        // Si el backend nos responde con 402, enviamos al usuario al muro de pago
        if (error.response && error.response.status === 402) {
          setIsAuthenticated(false);
          navigate('/suscripcion-expirada');
        } else {
          // Si es cualquier otro error (ej. token inválido), lo deslogueamos normal
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

  const hasAccess = (path) => {
    if (!user?.role?.modules) return false;
    return user.role.modules.some(m => m.frontend_path === path);
  };

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
        })}
      />

      <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', width: '100%' }}>
            <CircularProgress sx={{ color: ACCENT }} />
          </Box>
        ) : isAuthenticated ? (
          <>
            {/* ── Sidebar desktop ── */}
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

            {/* ── Sidebar mobile ── */}
            {isMobile && (
              <Drawer
                variant="temporary" open={mobileOpen} onClose={() => setMobileOpen(false)}
                ModalProps={{ keepMounted: true }}
                sx={{ '& .MuiDrawer-paper': { width: SIDEBAR_FULL, border: 'none' } }}
              >
                <Sidebar expanded user={user} hasAccess={hasAccess} onClose={() => setMobileOpen(false)} mobile />
              </Drawer>
            )}

            {/* ── TopBar ── */}
            <TopBar
              sidebarExpanded={sidebarExpanded} isMobile={isMobile}
              onMobileMenuOpen={() => setMobileOpen(true)} mode={mode}
              onThemeToggle={() => setMode(m => m === 'light' ? 'dark' : 'light')}
              onLogout={handleLogout} user={user} anchorEl={anchorEl}
              openMenu={openMenu} onMenuOpen={(e) => setAnchorEl(e.currentTarget)}
              onMenuClose={() => setAnchorEl(null)}
            />

            {/* ── Contenido principal protegido ── */}
            <Box
              component="main"
              sx={{
                flexGrow: 1, ml: isMobile ? 0 : `${sidebarWidth}px`, mt: '60px',
                minHeight: 'calc(100vh - 60px)', transition: 'margin-left 0.22s cubic-bezier(0.4,0,0.2,1)',
                backgroundColor: mode === 'dark' ? PAGE_BG_DARK : PAGE_BG_LIGHT,
                display: 'flex', flexDirection: 'column',
              }}
            >
              <Box sx={{ flex: 1, p: { xs: 1.5, md: 3 } }}>
                <Routes>
                  <Route path="/"                  element={["Admin", "Socio"].includes(user?.role?.name) ?  <Dashboard /> : <Home />} />
                  <Route path="/ventas"              element={<Ventas />} />
                  <Route path="/compras"             element={<Compras />} />
                  <Route path="/clientes"            element={<Terceros />} />
                  <Route path="/productos"           element={<Productos />} />
                  <Route path="/inventario"          element={<Inventario />} />
                  <Route path="/caja"                element={<Caja />} />
                  <Route path="/produccion/recetas"  element={<Recetas />} />
                  <Route path="/produccion/lotes"    element={<Lotes />} />
                  <Route path="/reportes-inventario" element={<InventoryReports />} />
                  <Route path="/reportes"            element={<Reportes />} />
                  <Route path="/ordenes-trabajo"     element={<OrdenesTrabajo user={user} />} />
                  
                  {user?.role?.name === 'Admin' && user?.empresa_id === 1 && (
                    <Route path="/superadmin/empresas" element={<GestionEmpresas />} />
                  )}
                  {hasAccess('/panel-operador') && (
                    <Route path="/panel-operador" element={<PanelOperador />} />
                  )}
                  {user?.role?.name === 'Admin' && (
                    <Route path="/admin/usuarios" element={<AdminUsuarios />} />
                  )}
                </Routes>
              </Box>

              <Box component="footer" sx={{ py: 2, px: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, borderTop: `1px solid ${mode === 'dark' ? 'rgba(255,255,255,0.06)' : '#E5E7EB'}`, }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                  Powered KSMP Systems - 2026
                </Typography>
                <Box component="img" src="/Logo2.png" alt="Logo" sx={{ height: 20 }} />
              </Box>
            </Box>
          </>
        ) : (
          // ✅ AQUÍ ESTÁN LAS RUTAS PÚBLICAS (Login y Pantalla de Pago)
          <Box sx={{ width: '100%', minHeight: '100vh' }}>
            <Routes>
              <Route path="/suscripcion-expirada" element={<SuscripcionExpirada />} />
              <Route path="*" element={<Login onLogin={checkAuth} />} />
            </Routes>
          </Box>
        )}
      </Box>

      <ToastContainer
        position="bottom-right" autoClose={3500} hideProgressBar={false} newestOnTop closeOnClick pauseOnHover draggable
        toastStyle={{
          fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 13.5, borderRadius: 12,
          boxShadow: '0 8px 24px rgba(0,0,0,0.14)', border: '1px solid rgba(0,0,0,0.06)', padding: '12px 16px',
        }}
        style={{ bottom: 24, right: 16 }}
      />
      <SpeedInsights />
    </ThemeProvider>
  );
}

export default App;