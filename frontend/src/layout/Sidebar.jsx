import React, { useState } from 'react';
import {
  Box, Typography, List, ListItemButton,
  ListItemText, ListItemIcon, Collapse, Divider,
  Tooltip, Avatar, IconButton, Menu, MenuItem,
} from '@mui/material';
import {
  AdminPanelSettings, Business, KeyboardArrowRight, WorkspacePremium,
  PushPin, PushPinOutlined, QrCode2, Storefront, Link as LinkIcon,
  Logout, KeyboardArrowUp,
} from '@mui/icons-material';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { MODULE_ICONS, ADMIN_MODULES, getModuleConfig } from '../utils/modulesConfig';

const SIDEBAR_BG     = '#0f172a';
const SIDEBAR_HOVER  = 'rgba(255,255,255,0.06)';
const SIDEBAR_ACTIVE = 'rgba(255,100,30,0.18)';
const ACCENT         = '#FF6020';

const SidebarItem = ({ item, expanded, onClick, onClose, active }) => (
  <Tooltip title={!expanded ? (item.label || item.text) : ''} placement="right" arrow>
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
          primary={item.label || item.text}
          primaryTypographyProps={{ fontSize: 13.5, fontWeight: active ? 600 : 400, fontFamily: "'Plus Jakarta Sans', sans-serif", color: active ? '#fff' : '#cbd5e1', noWrap: true }}
        />
      )}
    </ListItemButton>
  </Tooltip>
);

const UserMenu = ({ user, expanded, onClose: closeSidebar, onLogout }) => {
  const [anchor, setAnchor] = useState(null);
  const navigate = useNavigate();
  const isAdmin = user?.role?.name === 'Admin';
  const isSuperAdmin = isAdmin && user?.empresa_id === 1;

  const open = Boolean(anchor);

  const handleOpen = (e) => setAnchor(e.currentTarget);
  const handleClose = () => setAnchor(null);

  const goTo = (path) => {
    handleClose();
    if (closeSidebar) closeSidebar();
    navigate(path);
  };

  return (
    <>
      <Tooltip title={!expanded ? (user?.username || '') : ''} placement="right" arrow>
        <Box
          onClick={handleOpen}
          sx={{
            borderTop: '1px solid rgba(255,255,255,0.06)',
            px: expanded ? 2 : 1,
            py: 1.5,
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            cursor: 'pointer',
            transition: 'background 0.15s',
            '&:hover': { bgcolor: SIDEBAR_HOVER },
          }}
        >
          <Avatar sx={{ width: 34, height: 34, flexShrink: 0, background: `linear-gradient(135deg, ${ACCENT}, #ff9a62)`, fontSize: 13, fontWeight: 700 }}>
            {user?.username?.[0]?.toUpperCase()}
          </Avatar>
          {expanded && (
            <>
              <Box sx={{ overflow: 'hidden', flex: 1 }}>
                <Typography sx={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0', fontFamily: "'Plus Jakarta Sans', sans-serif", whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {user?.username}
                </Typography>
                <Typography sx={{ fontSize: 11, color: '#64748b' }}>{user?.role?.name}</Typography>
              </Box>
              <KeyboardArrowUp sx={{ fontSize: 16, color: '#475569', flexShrink: 0, transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
            </>
          )}
        </Box>
      </Tooltip>

      <Menu
        anchorEl={anchor}
        open={open}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        slotProps={{
          paper: {
            sx: {
              bgcolor: '#1e293b',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 2,
              minWidth: 220,
              boxShadow: '0 -8px 32px rgba(0,0,0,0.4)',
              mb: 0.5,
            },
          },
        }}
      >
        {/* Header del menú */}
        <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            {user?.username}
          </Typography>
          <Typography sx={{ fontSize: 11, color: '#64748b' }}>
            {user?.empresa?.nombre || user?.role?.name}
          </Typography>
        </Box>

        {/* Opciones de Mi Cuenta — solo Admin */}
        {isAdmin && (
          <Box>
            <Typography sx={{ px: 2, pt: 1.5, pb: 0.5, fontSize: 10, fontWeight: 700, color: '#475569', letterSpacing: 1, textTransform: 'uppercase', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              Mi Cuenta
            </Typography>

            <MenuItem onClick={() => goTo('/mi-suscripcion')} sx={menuItemSx}>
              <WorkspacePremium sx={{ fontSize: 17, color: ACCENT, mr: 1.5 }} />
              <Typography sx={menuTextSx}>Mi Suscripción</Typography>
            </MenuItem>

            {!isSuperAdmin && (
              <MenuItem onClick={() => goTo('/admin/catalogo')} sx={menuItemSx}>
                <Storefront sx={{ fontSize: 17, color: '#10B981', mr: 1.5 }} />
                <Typography sx={menuTextSx}>Catálogo Virtual</Typography>
              </MenuItem>
            )}

            <MenuItem onClick={() => goTo(isSuperAdmin ? '/superadmin/link-pago' : '/admin/link-pago')} sx={menuItemSx}>
              <QrCode2 sx={{ fontSize: 17, color: '#3B82F6', mr: 1.5 }} />
              <Typography sx={menuTextSx}>Link de Pago POS</Typography>
            </MenuItem>

            <Divider sx={{ my: 0.75, borderColor: 'rgba(255,255,255,0.06)' }} />
          </Box>
        )}

        {/* Cerrar sesión */}
        <MenuItem onClick={() => { handleClose(); onLogout?.(); }} sx={{ ...menuItemSx, '&:hover': { bgcolor: 'rgba(239,68,68,0.1)' } }}>
          <Logout sx={{ fontSize: 17, color: '#ef4444', mr: 1.5 }} />
          <Typography sx={{ ...menuTextSx, color: '#ef4444' }}>Cerrar sesión</Typography>
        </MenuItem>
      </Menu>
    </>
  );
};

const menuItemSx = {
  px: 2, py: 1, borderRadius: 1, mx: 0.5,
  '&:hover': { bgcolor: 'rgba(255,255,255,0.06)' },
};
const menuTextSx = {
  fontSize: 13, fontFamily: "'Plus Jakarta Sans', sans-serif", color: '#cbd5e1',
};

const Sidebar = ({ expanded, user, hasAccess, onClose, mobile, pinned, onPinToggle, onLogout }) => {
  const location = useLocation();
  const [adminOpen, setAdminOpen] = useState(false);
  const isActive = (path) => location.pathname === path || location.pathname.startsWith(path + '/');

  const modulosVisibles = React.useMemo(() => {
    if (!user) return [];
    if (user.role?.name === 'Admin' && user.empresa_id === 1) {
      return Object.keys(MODULE_ICONS).map(path => {
        const cfg = getModuleConfig(path);
        return { path, ...cfg };
      });
    }
    const adminPaths = new Set(ADMIN_MODULES.map(a => a.path));
    const modulosDelRol = user.role?.modules || [];
    return modulosDelRol
      .filter(m => hasAccess(m.frontend_path) && !adminPaths.has(m.frontend_path))
      .map(m => {
        const cfg = getModuleConfig(m.frontend_path, m.name);
        return {
          path:  m.frontend_path,
          label: cfg.label,
          icon:  cfg.icon,
          color: cfg.color,
        };
      })
      .sort((a, b) => {
        const orderKeys = Object.keys(MODULE_ICONS);
        return orderKeys.indexOf(a.path) - orderKeys.indexOf(b.path);
      });
  }, [user, hasAccess]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', background: SIDEBAR_BG, overflowX: 'hidden' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', px: expanded ? 2 : 1.5, py: 2.5, minHeight: 64, borderBottom: '1px solid rgba(255,255,255,0.06)', gap: 1.5 }}>
        <Box component={Link} to="/" onClick={mobile ? onClose : undefined} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, textDecoration: 'none', flex: 1, cursor: 'pointer', transition: 'opacity 0.15s', '&:hover': { opacity: 0.85 }, overflow: 'hidden' }}>
          <Box component="img" src="/logos/svg/ksmart-icon-rounded.svg" alt="Ksmart360" sx={{ width: 34, height: 34, borderRadius: 1.5, flexShrink: 0 }} />
          {expanded && (
            <Typography sx={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, fontSize: 16, color: '#fff', whiteSpace: 'nowrap' }}>
              Ksmart<span style={{ color: ACCENT }}>360</span>
            </Typography>
          )}
        </Box>
        {expanded && !mobile && onPinToggle && (
          <Tooltip title={pinned ? 'Desfijar sidebar' : 'Fijar sidebar'} placement="right">
            <IconButton size="small" onClick={onPinToggle} sx={{ color: pinned ? ACCENT : '#475569', flexShrink: 0, '&:hover': { color: ACCENT } }}>
              {pinned ? <PushPin fontSize="small" /> : <PushPinOutlined fontSize="small" />}
            </IconButton>
          </Tooltip>
        )}
      </Box>

      <Box sx={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', py: 1.5, '&::-webkit-scrollbar': { width: 4 }, '&::-webkit-scrollbar-thumb': { background: 'rgba(255,255,255,0.1)', borderRadius: 4 } }}>
        {user?.role?.name === 'Admin' && user?.empresa_id === 1 && (
          <>
            <SidebarItem expanded={expanded} item={{ path: '/superadmin/empresas', label: 'Clientes SaaS', icon: <Business />, color: '#F43F5E' }} active={isActive('/superadmin/empresas')} onClose={mobile ? onClose : undefined} />
            {expanded && <Divider sx={{ mx: 2, my: 1, borderColor: 'rgba(255,255,255,0.06)' }} />}
          </>
        )}

        {user?.role?.name === 'Admin' && (
          <>
            <SidebarItem expanded={expanded} item={{ label: 'Administración', icon: <AdminPanelSettings />, color: '#a78bfa' }} onClick={() => setAdminOpen(o => !o)} active={false} />
            <Collapse in={adminOpen && expanded} timeout="auto" unmountOnExit>
              <List disablePadding>
                {ADMIN_MODULES.map(sub => (
                  <ListItemButton key={sub.path} component={Link} to={sub.path} onClick={mobile ? onClose : undefined} sx={{ pl: 5, pr: 2, py: 0.75, mx: 1, mb: 0.25, borderRadius: 2, backgroundColor: isActive(sub.path) ? SIDEBAR_ACTIVE : 'transparent', '&:hover': { backgroundColor: SIDEBAR_HOVER } }}>
                    <KeyboardArrowRight sx={{ fontSize: 14, color: '#64748b', mr: 1 }} />
                    <ListItemText primary={sub.label} primaryTypographyProps={{ fontSize: 13, color: isActive(sub.path) ? '#fff' : '#94a3b8', fontFamily: "'Plus Jakarta Sans', sans-serif" }} />
                  </ListItemButton>
                ))}
              </List>
            </Collapse>
            {expanded && <Typography sx={{ px: 2.5, pt: 2, pb: 0.5, fontSize: 10, fontWeight: 600, color: '#475569', letterSpacing: 1.2, textTransform: 'uppercase', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Módulos</Typography>}
          </>
        )}

        {modulosVisibles.map(item => (
          <SidebarItem key={item.path} item={item} expanded={expanded} active={isActive(item.path)} onClose={mobile ? onClose : undefined} />
        ))}

        {modulosVisibles.length === 0 && expanded && user?.role?.name !== 'Admin' && (
          <Box sx={{ p: 2, mx: 1, mt: 2, bgcolor: 'rgba(239,68,68,0.08)', borderRadius: 2, border: '1px solid rgba(239,68,68,0.2)' }}>
            <Typography sx={{ fontSize: 11, fontWeight: 700, color: '#FCA5A5', mb: 0.5 }}>⚠️ Sin módulos asignados</Typography>
            <Typography sx={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.5 }}>Tu rol no tiene módulos habilitados por la empresa. Contacta a tu administrador.</Typography>
          </Box>
        )}
      </Box>

      <UserMenu user={user} expanded={expanded} onClose={mobile ? onClose : undefined} onLogout={onLogout} />
    </Box>
  );
};

export default Sidebar;
