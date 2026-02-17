
import React, { useState, useEffect } from 'react';
import apiClient from '../api';
import { useNavigate } from 'react-router-dom';
import {
    IconButton, Badge, Popover, List, ListItem, ListItemText, Typography, Divider, Button, Box
} from '@mui/material';
import { Notifications as NotificationsIcon } from '@mui/icons-material';
import { toast } from 'react-toastify';

const Notifications = () => {
    const [notifications, setNotifications] = useState([]);
    const [anchorEl, setAnchorEl] = useState(null);
    const navigate = useNavigate();

    useEffect(() => {
        fetchNotifications();
        const interval = setInterval(fetchNotifications, 10000); // Poll every 10 seconds
        return () => clearInterval(interval);
    }, []);

    const fetchNotifications = () => {
        apiClient.get('/notificaciones/')
            .then(res => setNotifications(res.data.filter(n => !n.leido))) // Filter for unread notifications
            .catch(console.error);
    };

    const handleOpen = (event) => setAnchorEl(event.currentTarget);
    const handleClose = () => setAnchorEl(null);

    const handleNotificationClick = (notif) => {
        handleClose();
        if (!notif.leido) {
            markAsRead(notif.id);
        }
        if (notif.orden_id) {
            navigate('/ordenes-trabajo', { state: { ordenId: notif.orden_id } });
        }
    };

    const markAsRead = (id) => {
        apiClient.put(`/notificaciones/${id}/leida`)
            .then(() => {
                setNotifications(prevNotifications => prevNotifications.filter(n => n.id !== id)); // Remove from local state
            })
            .catch(err => toast.error("Error al marcar la notificación como leída."));
    };

    const unreadCount = notifications.filter(n => !n.leido).length;
    const open = Boolean(anchorEl);

    return (
        <>
            <IconButton color="inherit" onClick={handleOpen}>
                <Badge badgeContent={unreadCount} color="error">
                    <NotificationsIcon />
                </Badge>
            </IconButton>
            <Popover
                open={open}
                anchorEl={anchorEl}
                onClose={handleClose}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            >
                <Box sx={{ width: 360 }}>
                    <Typography sx={{ p: 2 }}>Notificaciones</Typography>
                    <Divider />
                    <List dense>
                        {notifications.length > 0 ? notifications.map(notif => (
                            <ListItem 
                                key={notif.id} 
                                button 
                                onClick={() => handleNotificationClick(notif)}
                                sx={{ 
                                    backgroundColor: notif.leido ? 'transparent' : 'action.hover', // Use a theme-defined hover color for unread
                                    color: 'text.primary' // Explicitly set text color
                                }}
                            >
                                <ListItemText
                                    primary={notif.mensaje}
                                    secondary={new Date(notif.fecha_creacion + 'Z').toLocaleString()}
                                    sx={{
                                        color: 'text.primary', // Apply color directly to ListItemText
                                        '& .MuiListItemText-secondary': {
                                            color: 'text.secondary', // Target secondary text specifically
                                        },
                                    }}
                                />
                            </ListItem>
                        )) : (
                            <ListItem><ListItemText primary="No tienes notificaciones." /></ListItem>)
                        }
                    </List>
                </Box>
            </Popover>
        </>
    );
};

export default Notifications;
