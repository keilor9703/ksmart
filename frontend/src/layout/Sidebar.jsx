import React, { useState } from 'react';
import {
  Box, Typography, List, ListItemButton,
  ListItemText, ListItemIcon, Collapse, Divider,
  Tooltip, Avatar
} from '@mui/material';
import {
  AdminPanelSettings, Business, KeyboardArrowRight
} from '@mui/icons-material';
import { Link, useLocation } from 'react-router-dom';
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

const Sidebar = ({ expanded, user, hasAccess, onClose, mobile }) => {
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
    const modulosDelRol = user.role?.modules || [];
    return modulosDelRol
      .filter(m => hasAccess(m.frontend_path))
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

export default Sidebar;
