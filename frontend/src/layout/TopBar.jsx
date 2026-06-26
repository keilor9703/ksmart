import React, { useState } from 'react';
import {
  Box, Typography, IconButton, Tooltip, Avatar, Menu, MenuItem, Button, Divider,
} from '@mui/material';
import {
  Logout as LogoutIcon, Menu as MenuIcon, MoreVert as MoreVertIcon,
  LightMode, DarkMode, Security,
} from '@mui/icons-material';
import { useLocation } from 'react-router-dom';
import { ADMIN_MODULES, MODULE_ICONS } from '../utils/modulesConfig';
import Notifications from '../components/common/Notifications';
import SecurityDialog from '../components/common/SecurityDialog';

const SIDEBAR_FULL = 240;
const SIDEBAR_MINI = 68;
const ACCENT       = '#6366F1';

const TopBar = ({ sidebarExpanded, isMobile, onMobileMenuOpen, mode, onThemeToggle, onLogout, user, anchorEl, openMenu, onMenuOpen, onMenuClose }) => {
  const [securityOpen, setSecurityOpen] = useState(false);
  const location = useLocation();
  const path = location.pathname;
  const adminItem = ADMIN_MODULES.find(i => path === i.path);
  const moduleConfig = MODULE_ICONS[path] || (() => {
    const match = Object.keys(MODULE_ICONS).find(p => path.startsWith(p + '/'));
    return match ? MODULE_ICONS[match] : null;
  })();

  const currentPage =
    adminItem?.label ||
    moduleConfig?.label ||
    (path === '/superadmin/empresas' ? 'Clientes SaaS' : 'Inicio');

  let isImpersonated = false;
  try {
    const token = localStorage.getItem('token');
    if (token) {
      const payload = JSON.parse(atob(token.split('.')[1]));
      isImpersonated = payload.is_impersonated === true;
    }
  } catch (e) { }

  return (
    <Box component="header" sx={{ position: 'fixed', top: 0, right: 0, zIndex: 1100, left: isMobile ? 0 : (sidebarExpanded ? SIDEBAR_FULL : SIDEBAR_MINI), height: 60, display: 'flex', alignItems: 'center', px: { xs: 2, md: 3 }, backgroundColor: mode === 'dark' ? '#0A0A0A' : '#fff', borderBottom: `1px solid ${mode === 'dark' ? 'rgba(255,255,255,0.06)' : '#E5E7EB'}`, gap: 2, transition: 'left 0.22s cubic-bezier(0.4,0,0.2,1)' }}>
      {isMobile && (
        <IconButton onClick={onMobileMenuOpen} size="small"><MenuIcon /></IconButton>
      )}
      <Box sx={{ flex: 1 }}>
        <Typography sx={{ fontFamily: "'Geist', sans-serif", fontWeight: 700, fontSize: 16, color: mode === 'dark' ? '#f1f5f9' : '#111827' }}>{currentPage}</Typography>
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        {isImpersonated && (
          <Button 
            variant="contained" 
            color="error" 
            size="small"
            onClick={() => {
              localStorage.removeItem('token');
              localStorage.removeItem('userModules');
              window.location.href = '/login';
            }}
            sx={{ 
              mr: { xs: 0, md: 2 }, 
              fontWeight: 800, 
              animation: 'pulse 2s infinite',
              whiteSpace: 'nowrap'
            }}
          >
            {isMobile ? 'SALIR' : 'FINALIZAR SOPORTE'}
          </Button>
        )}

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
            <Tooltip title="Seguridad de la cuenta">
              <Box
                onClick={() => setSecurityOpen(true)}
                sx={{
                  display: 'flex', alignItems: 'center', gap: 1, ml: 1,
                  pl: 1.5, pr: 2, py: 0.75, borderRadius: 3, cursor: 'pointer',
                  backgroundColor: mode === 'dark' ? 'rgba(255,255,255,0.05)' : '#F4F6F9',
                  border: `1px solid ${mode === 'dark' ? 'rgba(255,255,255,0.08)' : '#E5E7EB'}`,
                  transition: 'all 0.18s ease',
                  '&:hover': {
                    backgroundColor: mode === 'dark' ? 'rgba(99,102,241,0.1)' : 'rgba(99,102,241,0.06)',
                    borderColor: 'rgba(99,102,241,0.35)',
                  },
                }}
              >
                <Avatar sx={{ width: 26, height: 26, background: `linear-gradient(135deg, ${ACCENT}, #818CF8)`, fontSize: 11, fontWeight: 700 }}>
                  {user?.username?.[0]?.toUpperCase()}
                </Avatar>
                <Typography sx={{ fontSize: 13, fontWeight: 600, fontFamily: "'Geist', sans-serif", color: mode === 'dark' ? '#e2e8f0' : '#374151' }}>
                  {user?.username}
                </Typography>
              </Box>
            </Tooltip>
          </>
        )}

        {isMobile && (
          <>
            <IconButton onClick={onMenuOpen} size="small"><MoreVertIcon /></IconButton>
            <Menu anchorEl={anchorEl} open={openMenu} onClose={onMenuClose} PaperProps={{ sx: { mt: 1, minWidth: 180, borderRadius: 2 } }}>
              <MenuItem onClick={() => { setSecurityOpen(true); onMenuClose(); }}>
                <Security fontSize="small" sx={{ mr: 1.5, color: '#6366F1' }} /> Seguridad
              </MenuItem>
              <Divider />
              <MenuItem onClick={() => { onLogout(); onMenuClose(); }} sx={{ color: 'error.main' }}>
                <LogoutIcon fontSize="small" sx={{ mr: 1.5 }} /> Cerrar sesión
              </MenuItem>
            </Menu>
          </>
        )}

        <SecurityDialog open={securityOpen} onClose={() => setSecurityOpen(false)} user={user} />
      </Box>
    </Box>
  );
};

export default TopBar;
