import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, IconButton, Badge, Popover, Divider,
  List, ListItem, Chip, Tooltip, CircularProgress
} from '@mui/material';
import {
  NotificationsNone, NotificationsActive, Close,
  CheckCircleOutline, Warning, ErrorOutline, InfoOutlined, DoneAll
} from '@mui/icons-material';
import apiClient from '../../api';

const ACCENT = '#FF6020';

const TYPE_CONFIG = {
  warning: { icon: <Warning sx={{ fontSize: 16 }} />,          color: '#F59E0B', bg: '#FFFBEB' },
  error:   { icon: <ErrorOutline sx={{ fontSize: 16 }} />,     color: '#EF4444', bg: '#FEF2F2' },
  success: { icon: <CheckCircleOutline sx={{ fontSize: 16 }} />, color: '#10B981', bg: '#ECFDF5' },
  info:    { icon: <InfoOutlined sx={{ fontSize: 16 }} />,      color: '#3B82F6', bg: '#EFF6FF' },
};

const NotifItem = ({ notif, onRead }) => {
  const cfg = TYPE_CONFIG[notif.tipo] || TYPE_CONFIG.info;
  const fecha = new Date(notif.fecha_creacion);
  const diff  = Math.floor((new Date() - fecha) / 60000);
  const timeLabel =
    diff < 1    ? 'Ahora mismo' :
    diff < 60   ? `Hace ${diff} min` :
    diff < 1440 ? `Hace ${Math.floor(diff / 60)}h` :
    fecha.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });

  return (
    <ListItem
      sx={{
        alignItems: 'flex-start', gap: 1.5, px: 2, py: 1.5,
        bgcolor: notif.leido ? 'transparent' : `${cfg.color}08`,
        borderLeft: notif.leido ? '3px solid transparent' : `3px solid ${cfg.color}`,
        cursor: notif.leido ? 'default' : 'pointer',
        '&:hover': { bgcolor: 'action.hover' },
      }}
      onClick={() => !notif.leido && onRead(notif.id)}
    >
      <Box sx={{ width: 30, height: 30, borderRadius: 1.5, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: cfg.bg, color: cfg.color, mt: 0.3 }}>
        {cfg.icon}
      </Box>
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography sx={{ fontSize: 13, lineHeight: 1.4, color: notif.leido ? 'text.secondary' : 'text.primary', fontWeight: notif.leido ? 400 : 500 }}>
          {notif.mensaje}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
          <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{timeLabel}</Typography>
          {!notif.leido && <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: cfg.color }} />}
        </Box>
      </Box>
    </ListItem>
  );
};

const Notifications = ({ mode }) => {
  const [anchorEl, setAnchorEl] = useState(null);
  const [notifs, setNotifs]     = useState([]);
  const [unread, setUnread]     = useState(0);
  const [loading, setLoading]   = useState(false);
  const open = Boolean(anchorEl);

  const fetchUnread = useCallback(async () => {
    try {
      const { data } = await apiClient.get('/notificaciones/unread-count');
      setUnread(data.unread || 0);
    } catch { /* silencioso */ }
  }, []);

  useEffect(() => {
    fetchUnread();
    const interval = setInterval(fetchUnread, 60000);
    return () => clearInterval(interval);
  }, [fetchUnread]);

  const handleOpen = async (e) => {
    setAnchorEl(e.currentTarget);
    setLoading(true);
    try {
      const { data } = await apiClient.get('/notificaciones/');
      setNotifs(data);
    } catch { /* silencioso */ }
    finally { setLoading(false); }
  };

  const handleClose = () => setAnchorEl(null);

  const handleRead = async (id) => {
    try {
      await apiClient.put(`/notificaciones/${id}/leida`);
      setNotifs(prev => prev.map(n => n.id === id ? { ...n, leido: true } : n));
      setUnread(prev => Math.max(0, prev - 1));
    } catch { /* silencioso */ }
  };

  const handleReadAll = async () => {
    try {
      await apiClient.put('/notificaciones/mark-all-read');
      setNotifs(prev => prev.map(n => ({ ...n, leido: true })));
      setUnread(0);
    } catch { /* silencioso */ }
  };

  const unreadNotifs = notifs.filter(n => !n.leido);
  const readNotifs   = notifs.filter(n => n.leido);

  return (
    <>
      <Tooltip title="Notificaciones">
        <IconButton onClick={handleOpen} size="small" sx={{ color: mode === 'dark' ? '#94a3b8' : '#6B7280' }}>
          <Badge badgeContent={unread} max={99} sx={{ '& .MuiBadge-badge': { bgcolor: '#EF4444', color: '#fff', fontSize: 10, fontWeight: 700, minWidth: 16, height: 16, padding: '0 4px' } }}>
            {unread > 0
              ? <NotificationsActive fontSize="small" sx={{ color: '#EF4444' }} />
              : <NotificationsNone fontSize="small" />
            }
          </Badge>
        </IconButton>
      </Tooltip>

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        PaperProps={{ sx: { width: 360, maxHeight: 520, borderRadius: 3, overflow: 'hidden', boxShadow: '0 12px 40px rgba(0,0,0,0.15)', border: '1px solid', borderColor: 'divider', display: 'flex', flexDirection: 'column' } }}
      >
        {/* Header */}
        <Box sx={{ px: 2, py: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid', borderColor: 'divider' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography sx={{ fontWeight: 700, fontSize: 15 }}>Notificaciones</Typography>
            {unread > 0 && <Chip label={unread} size="small" sx={{ bgcolor: '#EF444415', color: '#EF4444', fontWeight: 700, fontSize: 10, height: 18 }} />}
          </Box>
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            {unread > 0 && (
              <Tooltip title="Marcar todas como leídas">
                <IconButton size="small" onClick={handleReadAll} sx={{ color: 'text.secondary' }}>
                  <DoneAll sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
            )}
            <IconButton size="small" onClick={handleClose} sx={{ color: 'text.secondary' }}>
              <Close sx={{ fontSize: 16 }} />
            </IconButton>
          </Box>
        </Box>

        {/* Lista */}
        <Box sx={{ overflowY: 'auto', flex: 1 }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress size={24} sx={{ color: ACCENT }} />
            </Box>
          ) : notifs.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 6 }}>
              <NotificationsNone sx={{ fontSize: 44, color: 'text.secondary', opacity: 0.3, mb: 1 }} />
              <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>Sin notificaciones</Typography>
            </Box>
          ) : (
            <List disablePadding>
              {unreadNotifs.length > 0 && (
                <>
                  <Box sx={{ px: 2, py: 0.8, bgcolor: 'action.hover' }}>
                    <Typography sx={{ fontSize: 10, fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.6 }}>Sin leer ({unreadNotifs.length})</Typography>
                  </Box>
                  {unreadNotifs.map(n => <React.Fragment key={n.id}><NotifItem notif={n} onRead={handleRead} /><Divider /></React.Fragment>)}
                </>
              )}
              {readNotifs.length > 0 && (
                <>
                  <Box sx={{ px: 2, py: 0.8, bgcolor: 'action.hover' }}>
                    <Typography sx={{ fontSize: 10, fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.6 }}>Anteriores</Typography>
                  </Box>
                  {readNotifs.slice(0, 10).map(n => <React.Fragment key={n.id}><NotifItem notif={n} onRead={handleRead} /><Divider /></React.Fragment>)}
                </>
              )}
            </List>
          )}
        </Box>

        {notifs.length > 0 && (
          <Box sx={{ px: 2, py: 1, borderTop: '1px solid', borderColor: 'divider', textAlign: 'center' }}>
            <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>Últimas {notifs.length} notificaciones</Typography>
          </Box>
        )}
      </Popover>
    </>
  );
};

export default Notifications;
