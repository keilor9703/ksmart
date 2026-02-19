import React, { useState, useEffect, useMemo } from 'react';
import { styled, ThemeProvider, useTheme } from '@mui/material/styles'; // Importar useTheme desde @mui/material/styles
import MuiAppBar from '@mui/material/AppBar';
import { Toolbar, Typography, Button, IconButton, List, ListItem, ListItemButton, ListItemText, ListItemIcon, Collapse, Box, CircularProgress, Divider, Drawer, Tooltip, CssBaseline, GlobalStyles, Menu, MenuItem } from '@mui/material'; // ADD CssBaseline, GlobalStyles, Menu, MenuItem
import { ShoppingCart, People, Inventory, Assessment, AdminPanelSettings, ExpandLess, ExpandMore, Brightness4 as Brightness4Icon, Brightness7 as Brightness7Icon, Assignment, Dashboard as DashboardIcon, Logout as LogoutIcon, Menu as MenuIcon, MoreVert as MoreVertIcon, ReceiptLong, PrecisionManufacturing } from '@mui/icons-material'; // Importar ReceiptLong, PrecisionManufacturing
import useMediaQuery from '@mui/material/useMediaQuery'; // Importar useMediaQuery
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import { Route, Routes, Link, useNavigate, Navigate } from 'react-router-dom';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
//import AssessmentOutlinedIcon from './components/AssessmentOutlinedIcon';

import apiClient from './api';
import getAppTheme from './theme';

import Clientes from './components/Clientes';
import Productos from './components/Productos';
import Ventas from './components/Ventas';
import Reportes from './components/Reportes';
import ResumenVentas from './components/ResumenVentas';
import Login from './components/Login';
import UserManagement from './components/UserManagement';
import RoleManagement from './components/RoleManagement';
import ModuleManagement from './components/ModuleManagement';
import OrdenesTrabajo from './components/OrdenesTrabajo';
import Recetas from './components/Recetas';
import Lotes from './components/Lotes';
import Notifications from './components/Notifications';
import PanelOperador from './components/PanelOperador';
import { SpeedInsights } from "@vercel/speed-insights/react";
import InventarioPage from './components/InventoryPage';
import InventoryReports from './components/InventoryReports';
import Dashboard from './components/Dashboard';

const drawerWidth = 240;
const collapsedDrawerWidth = 70; // Ancho del cajón colapsado para pantallas grandes

const DrawerHeader = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  padding: theme.spacing(0, 1),
  ...theme.mixins.toolbar,
}));



const AppBar = styled(MuiAppBar)(({ theme }) => ({
  zIndex: theme.zIndex.drawer + 1,
  width: '100%',
}));


const StyledDrawer = styled(Drawer, { shouldForwardProp: (prop) => prop !== 'open' })(
  ({ theme, open }) => ({
    width: drawerWidth,
    flexShrink: 0,
    whiteSpace: 'nowrap',
    boxSizing: 'border-box',
    ...(open && {
      width: drawerWidth,
      transition: theme.transitions.create('width', {
        easing: theme.transitions.easing.sharp,
        duration: theme.transitions.duration.enteringScreen,
      }),
      '& .MuiDrawer-paper': {

        position: 'fixed',
        left: 0,
        top: 0,
        height: '100vh',
        zIndex: theme.zIndex.appBar - 1, // o drawer + 2

        width: drawerWidth,
        overflowX: 'hidden',
        transition: theme.transitions.create('width', {
          easing: theme.transitions.easing.sharp,
          duration: theme.transitions.duration.enteringScreen,
        }),
      },
    }),
    ...(!open && {
      width: collapsedDrawerWidth,
      transition: theme.transitions.create('width', {
        easing: theme.transitions.easing.sharp,
        duration: theme.transitions.duration.leavingScreen,
      }),
      '& .MuiDrawer-paper': {
        width: collapsedDrawerWidth,
        overflowX: 'hidden',
        transition: theme.transitions.create('width', {
          easing: theme.transitions.easing.sharp,
          duration: theme.transitions.duration.leavingScreen,
        }),
      },
    }),
  }),
);

const Home = () => {
  const theme = useTheme();

  return (
    <Box sx={{ textAlign: 'center', mt: 5 }}>
      <Box
        component="img"
        sx={{
          height: 'auto',
          width: '100%',
          maxWidth: 250,
          borderRadius: '15px',
          mb: 3,
        }}
        alt="Ksmart360 Logo"
        src={process.env.PUBLIC_URL + '/Logo1.jpg'}
      />
      <Typography variant="h4" component="h2" sx={{ color: theme.palette.text.primary }}>
        Bienvenido a KSmart360, La nueva forma de gestionar tu negocio.
      </Typography>
    </Box>
  );
};

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true); // FIX: Corrected useState initialization
  const [drawerOpen, setDrawerOpen] = useState(false); // Estado para el drawer expandido en desktop
  const [mobileOpen, setMobileOpen] = useState(false); // Estado para el drawer en móvil
  const [adminOpen, setAdminOpen] = useState(false);
  const navigate = useNavigate();

  // State for the contextual menu
  const [anchorEl, setAnchorEl] = useState(null); // NEW
  const openMenu = Boolean(anchorEl); // NEW

  const [mode, setMode] = useState(() => {
    const storedMode = localStorage.getItem('themeMode');
    return storedMode === 'dark' ? 'dark' : 'light';
  });

  const appTheme = useMemo(() => getAppTheme(mode), [mode]);
  const theme = useTheme(); // Este useTheme es del ThemeProvider más externo

  // Determinar si la pantalla es pequeña (móvil)
  const isMobile = useMediaQuery(appTheme.breakpoints.down('sm')); // 'sm' es el breakpoint por defecto para móviles

  useEffect(() => {
    localStorage.setItem('themeMode', mode);
  }, [mode]);

  const handleThemeToggle = () => {
    setMode((prevMode) => (prevMode === 'light' ? 'dark' : 'light'));
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const response = await apiClient.get('/users/me', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        setIsAuthenticated(true);
        setUser(response.data);
        localStorage.setItem('userModules', JSON.stringify(response.data.role.modules.map(m => m.frontend_path)));
      } catch (error) {
        console.error('Error al verificar la autenticación:', error);
        handleLogout(false);
        toast.error('Sesión expirada o inválida. Por favor, inicia sesión nuevamente.');
      }
    } else {
      setIsAuthenticated(false);
      setUser(null);
      localStorage.removeItem('userModules');
    }
    setLoading(false);
  };

  const hasAccess = (path) => {
    if (!user || !user.role || !user.role.modules) return false;
    return user.role.modules.some(module => module.frontend_path === path);
  };

  const handleLogin = () => {
    checkAuth();
  };

  const handleLogout = (showToast = true) => {
    localStorage.removeItem('token');
    localStorage.removeItem('userModules');
    setIsAuthenticated(false);
    setUser(null);
    if (showToast) {
      toast.info('Sesión cerrada.');
    }
    navigate('/login');
  };

  const handleAdminClick = () => {
    setAdminOpen(!adminOpen);
  };

  const handleDrawerOpen = () => {
    if (!isMobile) { // Solo abrir el drawer expandido en desktop
      setDrawerOpen(true);
    }
  };

  const handleDrawerClose = () => {
    if (!isMobile) { // Solo cerrar el drawer expandido en desktop
      setDrawerOpen(false);
    }
  };

  const handleMobileDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };
  
  const handleMenuOpen = (event) => { // NEW
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => { // NEW
    setAnchorEl(null);
  };

  const adminMenuItems = [
    { path: '/admin/users', text: 'Gestionar Usuarios' },
    { path: '/admin/roles', text: 'Gestionar Roles' },
    { path: '/admin/modules', text: 'Gestionar Módulos' },
  ];

  const menuItems = [
    { path: '/ventas', text: 'Ventas', icon: <ShoppingCart />, color: 'orange' },
    { path: '/clientes', text: 'Clientes', icon: <People />, color: 'blue' },
    { path: '/productos', text: 'Productos', icon: <Inventory />, color: 'green' },
    { path: '/inventario', text: 'Inventarios', icon: <Inventory2OutlinedIcon />, color: 'brown' },
    { path: '/produccion/recetas', text: 'Recetas', icon: <ReceiptLong />, color: '#795548' }, // Brown for Cacao
    { path: '/produccion/lotes', text: 'Producción', icon: <PrecisionManufacturing />, color: '#3e2723' }, // Dark brown for Cacao
    { path: '/ordenes-trabajo', text: 'Órdenes de Trabajo', icon: <Assignment />, color: 'teal' },
    { path: '/panel-operador', text: 'Panel del Operador', icon: <DashboardIcon />, color: 'purple' },
    { path: '/reportes', text: 'Reportes', icon: <Assessment />, color: 'red' },
  ];

  return (
    <ThemeProvider theme={appTheme}>
      <CssBaseline />
      <GlobalStyles
        styles={(theme) => ({
          html: {
            width: '100%',
            minHeight: '100vh',
            overflowX: 'hidden',
          },
          body: {
            width: '100%',
            minHeight: '100vh',
            overflowX: 'hidden',
            backgroundColor: theme.palette.background.default,
          },
          '#root': {
            width: '100%',
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            overflowX: 'hidden',
          },
        })}
      />
      <Box sx={{ display: 'flex', minHeight: '100vh', backgroundColor: appTheme.palette.background.default }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', width: '100%' }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            {isAuthenticated ? (
              <>
                <AppBar position="fixed" open={drawerOpen && !isMobile}>
                  <Toolbar>
                    {isMobile && ( // Icono de menú solo en móvil
                      <IconButton
                        color="inherit"
                        aria-label="open drawer"
                        edge="start"
                        onClick={handleMobileDrawerToggle}
                        sx={{ mr: 2 }}
                      >
                        <MenuIcon />
                      </IconButton>
                    )}
                    <Box sx={{ flexGrow: 1, ml: 2, display: 'flex', alignItems: 'center' }}>
                      <Link to="/" style={{ textDecoration: 'none', color: 'inherit', display: 'flex', alignItems: 'center' }}>
                        <Box
                          component="img"
                          sx={{
                            height: 40,
                            mr: 1,
                          }}
                          alt="Logo"
                          src="/Logo2.png"
                        />
                        <Typography variant="h6" noWrap component="div">
                          Ksmart360
                        </Typography>
                      </Link>
                    </Box>
                    {!isMobile && ( // Desktop actions
                      <>
                        <IconButton sx={{ ml: 1 }} onClick={handleThemeToggle} color="inherit">
                          {mode === 'dark' ? <Brightness4Icon /> : <Brightness7Icon />}
                        </IconButton>
                        <Notifications />
                        <Typography variant="body1" sx={{ mr: 2, ml: 2 }}>
                          Bienvenido, {user?.username}
                        </Typography>
                        <Tooltip title="Cerrar Sesión">
                          <IconButton color="inherit" onClick={() => handleLogout()}>
                            <LogoutIcon />
                          </IconButton>
                        </Tooltip>
                      </>
                    )}
                    {isMobile && ( // Mobile actions (contextual menu)
                      <>
                        <IconButton
                          aria-label="more"
                          aria-controls={openMenu ? 'long-menu' : undefined}
                          aria-expanded={openMenu ? 'true' : undefined}
                          aria-haspopup="true"
                          onClick={handleMenuOpen}
                          color="inherit"
                        >
                          <MoreVertIcon />
                        </IconButton>
                        <Menu
                          id="long-menu"
                          MenuListProps={{
                            'aria-labelledby': 'long-button',
                          }}
                          anchorEl={anchorEl}
                          open={openMenu}
                          onClose={handleMenuClose}
                          PaperProps={{
                            style: {
                              maxHeight: 48 * 4.5,
                              width: '20ch',
                            },
                          }}
                        >
                          <MenuItem onClick={() => { handleThemeToggle(); handleMenuClose(); }}>
                            {mode === 'dark' ? 'Modo Claro' : 'Modo Oscuro'}
                          </MenuItem>
                          <MenuItem onClick={() => { /* Notifications logic here */ handleMenuClose(); }}>
                            Notificaciones
                          </MenuItem>
                          <MenuItem onClick={() => { handleLogout(); handleMenuClose(); }}>
                            Salir
                          </MenuItem>
                        </Menu>
                      </>
                    )}
                  </Toolbar>
                </AppBar>

                {/* Drawer permanente para pantallas grandes */}
                {!isMobile && (
                  <StyledDrawer
                    variant="permanent"
                    open={drawerOpen}
                    onMouseEnter={handleDrawerOpen}
                    onMouseLeave={handleDrawerClose}
                  >
                    <DrawerHeader />
                    <Divider />
                    <List>
                      {/* Admin Section (collapsed) */}
                      {user?.role?.name === 'Admin' && (
                        <ListItem disablePadding sx={{ display: 'block' }}>
                          <ListItemButton
                            onClick={handleAdminClick}
                            sx={{
                              minHeight: 48,
                              justifyContent: drawerOpen ? 'initial' : 'center',
                              px: 2.5,
                            }}
                          >
                            <ListItemIcon
                              sx={{
                                minWidth: 0,
                                mr: drawerOpen ? 3 : 'auto',
                                justifyContent: 'center',
                                color: 'purple',
                              }}
                            >
                              <AdminPanelSettings />
                            </ListItemIcon>
                            <ListItemText primary="Administración" sx={{ opacity: drawerOpen ? 1 : 0 }} />
                            {drawerOpen && (adminOpen ? <ExpandLess /> : <ExpandMore />)}
                          </ListItemButton>
                        </ListItem>
                      )}
                      <Collapse in={adminOpen && drawerOpen} timeout="auto" unmountOnExit>
                        <List component="div" disablePadding>
                          {adminMenuItems.map((item) => (
                            <ListItem key={item.text} disablePadding sx={{ display: 'block' }}>
                              <ListItemButton
                                component={Link}
                                to={item.path}
                                sx={{ pl: drawerOpen ? 4 : 2.5, minHeight: 48, justifyContent: drawerOpen ? 'initial' : 'center' }}
                              >
                                <ListItemText primary={item.text} sx={{ color: appTheme.palette.text.primary, opacity: drawerOpen ? 1 : 0 }} />
                              </ListItemButton>
                            </ListItem>
                          ))}
                        </List>
                      </Collapse>

                      {/* Main Menu Items (collapsed) */}
                      {menuItems.map((item) => (
                        hasAccess(item.path) && (
                          <ListItem key={item.text} disablePadding sx={{ display: 'block' }}>
                            <ListItemButton
                              component={Link}
                              to={item.path}
                              sx={{
                                minHeight: 48,
                                justifyContent: drawerOpen ? 'initial' : 'center',
                                px: 2.5,
                              }}
                            >
                              <ListItemIcon
                                sx={{
                                  minWidth: 0,
                                  mr: drawerOpen ? 3 : 'auto',
                                  justifyContent: 'center',
                                  color: item.color,
                                }}
                              >
                                {item.icon}
                              </ListItemIcon>
                              <ListItemText primary={item.text} sx={{ opacity: drawerOpen ? 1 : 0 }} />
                            </ListItemButton>
                          </ListItem>
                        )
                      ))}
                    </List>
                  </StyledDrawer>
                )}

                {/* Drawer temporal para pantallas móviles */}
                <Drawer
                  variant="temporary"
                  open={isMobile && mobileOpen}
                  onClose={handleMobileDrawerToggle}
                  ModalProps={{
                    keepMounted: true, // Mejor rendimiento en móvil.
                  }}
                  sx={{
                    '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
                  }}
                >
                  <DrawerHeader />
                  <Divider />
                  <List>
                    {/* Admin Section (expanded for mobile) */}
                    {user?.role?.name === 'Admin' && (
                      <>
                        <ListItem disablePadding>
                          <ListItemButton onClick={handleAdminClick}>
                            <ListItemIcon sx={{ color: 'purple' }}>
                              <AdminPanelSettings />
                            </ListItemIcon>
                            <ListItemText primary="Administración" />
                            {adminOpen ? <ExpandLess /> : <ExpandMore />}
                          </ListItemButton>
                        </ListItem>
                        <Collapse in={adminOpen} timeout="auto" unmountOnExit>
                          <List component="div" disablePadding>
                            {adminMenuItems.map((item) => (
                              <ListItem key={item.text} disablePadding>
                                <ListItemButton
                                  component={Link}
                                  to={item.path}
                                  onClick={handleMobileDrawerToggle} // Cerrar drawer al hacer clic
                                  sx={{ pl: 4 }}
                                >
                                  <ListItemText primary={item.text} sx={{ color: appTheme.palette.text.primary }} />
                                </ListItemButton>
                              </ListItem>
                            ))}
                          </List>
                        </Collapse>
                      </>
                    )}

                    {/* Main Menu Items (expanded for mobile) */}
                    {menuItems.map((item) => (
                      hasAccess(item.path) && (
                        <ListItem key={item.text} disablePadding>
                          <ListItemButton
                            component={Link}
                            to={item.path}
                            onClick={handleMobileDrawerToggle} // Cerrar drawer al hacer clic
                          >
                            <ListItemIcon sx={{ color: item.color }}>
                              {item.icon}
                            </ListItemIcon>
                            <ListItemText primary={item.text} sx={{ color: appTheme.palette.text.primary }} />
                          </ListItemButton>
                        </ListItem>
                      )
                    ))}
                  </List>
                </Drawer>

                    <Box
                      component="main"
                      sx={{
                        flexGrow: 1,
                        p: 3,
                        display: 'flex',
                        flexDirection: 'column',

                        // ✅ margen dinámico según drawerOpen (desktop)
                        // ml: isMobile ? 0 : (drawerOpen ? `${drawerWidth}px` : `${collapsedDrawerWidth}px`),
                        ml:0,

                        // ✅ ancho dinámico según drawerOpen (desktop)
                        width: isMobile ? '100%' : (drawerOpen
                          ? `calc(100% - ${drawerWidth}px)`
                          : `calc(100% - ${collapsedDrawerWidth}px)`),

                        transition: (theme) =>
                          theme.transitions.create(['margin', 'width'], {
                            easing: theme.transitions.easing.sharp,
                            duration: theme.transitions.duration.standard,
                          }),
                      }}
                    >

                  <DrawerHeader />
                  <Routes>
                    <Route path="/" element={user?.role?.name === 'Admin' ? <Dashboard /> : <Home />} />
                    <Route path="/ventas" element={<Ventas />} />
                    <Route path="/clientes" element={<Clientes />} />
                    <Route path="/productos" element={<Productos />} />
                    <Route path="/inventario" element={<InventarioPage />} />
                    <Route path="/produccion/recetas" element={<Recetas />} />
                    <Route path="/produccion/lotes" element={<Lotes />} />
                    <Route path="/reportes-inventario" element={<InventoryReports />} />
                    <Route path="/reportes" element={<Reportes />} />
                    <Route path="/ordenes-trabajo" element={<OrdenesTrabajo user={user} />} />
                    {hasAccess('/panel-operador') && <Route path="/panel-operador" element={<PanelOperador />} />}
                    {user?.role?.name === 'Admin' && (
                      <>
                        <Route path="/admin/users" element={<UserManagement />} />
                        <Route path="/admin/roles" element={<RoleManagement />} />
                        <Route path="/admin/modules" element={<ModuleManagement />} />
                      </>
                    )}
                  </Routes>
                  <Box component="footer" sx={{ p: 2, mt: 'auto', textAlign: 'center', borderTop: `1px solid ${appTheme.palette.divider}` }}>
                    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                      <Typography variant="body2" color="text.secondary">
                        Powered by Jeylor Systems
                      </Typography>
                      <Box
                        component="img"
                        sx={{
                            height: 24,
                            ml: 1,
                        }}
                        alt="Logo"
                        src="/Logo2.png"
                      />
                    </Box>
                  </Box>
                </Box>
              </>
            ) : (
                <Routes>
                    <Route path="*" element={<Login onLogin={handleLogin} />} />
                </Routes>
            )}
          </>
        )}
      </Box>
      <ToastContainer position="bottom-right" autoClose={3000} hideProgressBar={false} newestOnTop={false} closeOnClick rtl={false} pauseOnFocusLoss draggable pauseOnHover />
    <SpeedInsights />
    </ThemeProvider>
  );
}

export default App;