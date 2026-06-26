import React, { useState } from 'react';
import {
  Box, Typography, List, ListItemButton,
  ListItemText, ListItemIcon, Collapse, Divider,
  Tooltip, Avatar, IconButton, Menu, MenuItem, useTheme,
} from '@mui/material';
import {
  AdminPanelSettings, Business, KeyboardArrowRight, WorkspacePremium,
  PushPin, PushPinOutlined, QrCode2, Storefront, Link as LinkIcon,
  Logout, KeyboardArrowUp, Receipt,
} from '@mui/icons-material';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { MODULE_ICONS, ADMIN_MODULES, HIDDEN_FROM_SIDEBAR, getModuleConfig } from '../utils/modulesConfig';

const ACCENT = '#6366F1';

// Tokens dependientes del tema (look unificado estilo Vercel/Linear)
const useSidebarTokens = () => {
  const theme = useTheme();
  const dark = theme.palette.mode === 'dark';
  return {
    bg:         theme.palette.background.default,   // mismo fondo que el contenido
    border:     theme.palette.divider,
    hover:      dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
    activeBg:   dark ? 'rgba(99,102,241,0.16)'  : 'rgba(99,102,241,0.10)',
    iconIdle:   theme.palette.text.disabled,
    textIdle:   theme.palette.text.secondary,
    textActive: theme.palette.text.primary,
    accent:     ACCENT,
    titleColor: theme.palette.text.primary,
    captionColor: theme.palette.text.disabled,
  };
};

const SidebarItem = ({ item, expanded, onClick, onClose, active }) => {
  const t = useSidebarTokens();
  return (
    <Tooltip title={!expanded ? (item.label || item.text) : ''} placement="right" arrow>
      <ListItemButton
        component={onClick ? 'div' : Link}
        to={onClick ? undefined : item.path}
        onClick={onClick ?? onClose}
        sx={{
          mx: 1, mb: 0.25, borderRadius: 1.5, minHeight: 36,
          px: 1.25, justifyContent: expanded ? 'flex-start' : 'center',
          backgroundColor: active ? t.activeBg : 'transparent',
          transition: 'background-color 0.15s ease, color 0.15s ease',
          '&:hover': { backgroundColor: active ? t.activeBg : t.hover },
        }}
      >
        <ListItemIcon sx={{
          minWidth: 0, mr: expanded ? 1.25 : 0,
          color: active ? t.accent : t.iconIdle,
          transition: 'color 0.15s ease, margin 0.2s',
          '& .MuiSvgIcon-root': { fontSize: 19 },
        }}>
          {item.icon}
        </ListItemIcon>
        {expanded && (
          <ListItemText
            primary={item.label || item.text}
            primaryTypographyProps={{
              fontSize: 13, fontWeight: active ? 600 : 500,
              color: active ? t.textActive : t.textIdle, noWrap: true,
            }}
          />
        )}
      </ListItemButton>
    </Tooltip>
  );
};

const UserMenu = ({ user, expanded, onClose: closeSidebar, onLogout }) => {
  const t = useSidebarTokens();
  const theme = useTheme();
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

  const menuItemSx = {
    px: 1.5, py: 0.9, borderRadius: 1, mx: 0.5,
    '&:hover': { bgcolor: t.hover },
  };
  const menuTextSx = { fontSize: 13, color: theme.palette.text.secondary };

  return (
    <>
      <Tooltip title={!expanded ? (user?.username || '') : ''} placement="right" arrow>
        <Box
          onClick={handleOpen}
          sx={{
            borderTop: `1px solid ${t.border}`,
            px: expanded ? 1.5 : 1, py: 1.25,
            display: 'flex', alignItems: 'center', gap: 1.25, cursor: 'pointer',
            transition: 'background 0.15s',
            '&:hover': { bgcolor: t.hover },
          }}
        >
          <Avatar sx={{ width: 30, height: 30, flexShrink: 0, bgcolor: ACCENT, fontSize: 12.5, fontWeight: 600, color: '#fff' }}>
            {user?.username?.[0]?.toUpperCase()}
          </Avatar>
          {expanded && (
            <>
              <Box sx={{ overflow: 'hidden', flex: 1 }}>
                <Typography sx={{ fontSize: 13, fontWeight: 600, color: theme.palette.text.primary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {user?.username}
                </Typography>
                <Typography sx={{ fontSize: 11, color: t.captionColor }}>{user?.role?.name}</Typography>
              </Box>
              <KeyboardArrowUp sx={{ fontSize: 16, color: t.iconIdle, flexShrink: 0, transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
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
              bgcolor: theme.palette.background.paper,
              border: `1px solid ${t.border}`,
              borderRadius: 2,
              minWidth: 220,
              boxShadow: theme.palette.mode === 'dark'
                ? '0 8px 32px rgba(0,0,0,0.5)'
                : '0 8px 28px rgba(0,0,0,0.12)',
              mb: 0.5,
            },
          },
        }}
      >
        <Box sx={{ px: 1.75, py: 1.5, borderBottom: `1px solid ${t.border}` }}>
          <Typography sx={{ fontSize: 13, fontWeight: 600, color: theme.palette.text.primary }}>
            {user?.username}
          </Typography>
          <Typography sx={{ fontSize: 11, color: t.captionColor }}>
            {user?.empresa?.nombre || user?.role?.name}
          </Typography>
        </Box>

        {isAdmin && (
          <Box>
            <Typography sx={{ px: 1.75, pt: 1.25, pb: 0.5, fontSize: 10, fontWeight: 600, color: t.captionColor, letterSpacing: 0.8, textTransform: 'uppercase' }}>
              Mi Cuenta
            </Typography>

            <MenuItem onClick={() => goTo('/mi-suscripcion')} sx={menuItemSx}>
              <WorkspacePremium sx={{ fontSize: 17, color: t.iconIdle, mr: 1.5 }} />
              <Typography sx={menuTextSx}>Mi Suscripción</Typography>
            </MenuItem>

            {!isSuperAdmin && (
              <MenuItem onClick={() => goTo('/admin/catalogo')} sx={menuItemSx}>
                <Storefront sx={{ fontSize: 17, color: t.iconIdle, mr: 1.5 }} />
                <Typography sx={menuTextSx}>Catálogo Virtual</Typography>
              </MenuItem>
            )}

            <MenuItem onClick={() => goTo(isSuperAdmin ? '/superadmin/link-pago' : '/admin/link-pago')} sx={menuItemSx}>
              <QrCode2 sx={{ fontSize: 17, color: t.iconIdle, mr: 1.5 }} />
              <Typography sx={menuTextSx}>Link de Pago POS</Typography>
            </MenuItem>

            <MenuItem onClick={() => goTo('/admin/facturacion-electronica')} sx={menuItemSx}>
              <Receipt sx={{ fontSize: 17, color: t.iconIdle, mr: 1.5 }} />
              <Typography sx={menuTextSx}>Facturación Electrónica</Typography>
            </MenuItem>

            <Divider sx={{ my: 0.75, borderColor: t.border }} />
          </Box>
        )}

        <MenuItem onClick={() => { handleClose(); onLogout?.(); }} sx={{ ...menuItemSx, '&:hover': { bgcolor: 'rgba(239,68,68,0.1)' } }}>
          <Logout sx={{ fontSize: 17, color: '#ef4444', mr: 1.5 }} />
          <Typography sx={{ ...menuTextSx, color: '#ef4444' }}>Cerrar sesión</Typography>
        </MenuItem>
      </Menu>
    </>
  );
};

const Sidebar = ({ expanded, user, hasAccess, onClose, mobile, pinned, onPinToggle, onLogout }) => {
  const t = useSidebarTokens();
  const theme = useTheme();
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
      .filter(m => hasAccess(m.frontend_path) && !adminPaths.has(m.frontend_path) && !HIDDEN_FROM_SIDEBAR.has(m.frontend_path))
      .map(m => {
        const cfg = getModuleConfig(m.frontend_path, m.name);
        return { path: m.frontend_path, label: cfg.label, icon: cfg.icon, color: cfg.color };
      })
      .sort((a, b) => {
        const orderKeys = Object.keys(MODULE_ICONS);
        return orderKeys.indexOf(a.path) - orderKeys.indexOf(b.path);
      });
  }, [user, hasAccess]);

  return (
    <Box sx={{
      display: 'flex', flexDirection: 'column', height: '100%',
      background: t.bg, overflowX: 'hidden',
      borderRight: mobile ? 'none' : `1px solid ${t.border}`,
    }}>
      {/* Header / logo */}
      <Box sx={{ display: 'flex', alignItems: 'center', px: expanded ? 1.75 : 1.5, py: 2, minHeight: 60, borderBottom: `1px solid ${t.border}`, gap: 1.25 }}>
        <Box component={Link} to="/" onClick={mobile ? onClose : undefined} sx={{ display: 'flex', alignItems: 'center', gap: 1.25, textDecoration: 'none', flex: 1, cursor: 'pointer', transition: 'opacity 0.15s', '&:hover': { opacity: 0.8 }, overflow: 'hidden' }}>
          <Box component="img" src="/logos/svg/ksmart-icon-rounded.svg" alt="Ksmart360" sx={{ width: 30, height: 30, borderRadius: 1.5, flexShrink: 0 }} />
          {expanded && (
            <Typography sx={{ fontWeight: 700, fontSize: 15.5, color: t.titleColor, whiteSpace: 'nowrap', letterSpacing: -0.2 }}>
              Ksmart<span style={{ color: ACCENT }}>360</span>
            </Typography>
          )}
        </Box>
        {expanded && !mobile && onPinToggle && (
          <Tooltip title={pinned ? 'Desfijar sidebar' : 'Fijar sidebar'} placement="right">
            <IconButton size="small" onClick={onPinToggle} sx={{ color: pinned ? ACCENT : t.iconIdle, flexShrink: 0, '&:hover': { color: ACCENT } }}>
              {pinned ? <PushPin fontSize="small" /> : <PushPinOutlined fontSize="small" />}
            </IconButton>
          </Tooltip>
        )}
      </Box>

      {/* Navegación */}
      <Box sx={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', py: 1.25, '&::-webkit-scrollbar': { width: 4 }, '&::-webkit-scrollbar-thumb': { background: theme.palette.divider, borderRadius: 4 } }}>
        {user?.role?.name === 'Admin' && user?.empresa_id === 1 && (
          <>
            <SidebarItem expanded={expanded} item={{ path: '/superadmin/empresas', label: 'Clientes SaaS', icon: <Business /> }} active={isActive('/superadmin/empresas')} onClose={mobile ? onClose : undefined} />
            {expanded && <Divider sx={{ mx: 1.5, my: 1, borderColor: t.border }} />}
          </>
        )}

        {user?.role?.name === 'Admin' && (
          <>
            <SidebarItem expanded={expanded} item={{ label: 'Administración', icon: <AdminPanelSettings /> }} onClick={() => setAdminOpen(o => !o)} active={false} />
            <Collapse in={adminOpen && expanded} timeout="auto" unmountOnExit>
              <List disablePadding>
                {ADMIN_MODULES.map(sub => (
                  <ListItemButton key={sub.path} component={Link} to={sub.path} onClick={mobile ? onClose : undefined} sx={{ pl: 4.5, pr: 1.5, py: 0.6, mx: 1, mb: 0.25, borderRadius: 1.5, backgroundColor: isActive(sub.path) ? t.activeBg : 'transparent', '&:hover': { backgroundColor: isActive(sub.path) ? t.activeBg : t.hover } }}>
                    <KeyboardArrowRight sx={{ fontSize: 14, color: t.iconIdle, mr: 1 }} />
                    <ListItemText primary={sub.label} primaryTypographyProps={{ fontSize: 12.5, fontWeight: isActive(sub.path) ? 600 : 500, color: isActive(sub.path) ? t.textActive : t.textIdle }} />
                  </ListItemButton>
                ))}
              </List>
            </Collapse>
            {expanded && <Typography sx={{ px: 2, pt: 2, pb: 0.5, fontSize: 10, fontWeight: 600, color: t.captionColor, letterSpacing: 1, textTransform: 'uppercase' }}>Módulos</Typography>}
          </>
        )}

        {modulosVisibles.map(item => (
          <SidebarItem key={item.path} item={item} expanded={expanded} active={isActive(item.path)} onClose={mobile ? onClose : undefined} />
        ))}

        {modulosVisibles.length === 0 && expanded && user?.role?.name !== 'Admin' && (
          <Box sx={{ p: 2, mx: 1, mt: 2, bgcolor: 'rgba(239,68,68,0.08)', borderRadius: 2, border: '1px solid rgba(239,68,68,0.2)' }}>
            <Typography sx={{ fontSize: 11, fontWeight: 700, color: '#FCA5A5', mb: 0.5 }}>⚠️ Sin módulos asignados</Typography>
            <Typography sx={{ fontSize: 11, color: t.textIdle, lineHeight: 1.5 }}>Tu rol no tiene módulos habilitados por la empresa. Contacta a tu administrador.</Typography>
          </Box>
        )}
      </Box>

      <UserMenu user={user} expanded={expanded} onClose={mobile ? onClose : undefined} onLogout={onLogout} />
    </Box>
  );
};

export default Sidebar;
