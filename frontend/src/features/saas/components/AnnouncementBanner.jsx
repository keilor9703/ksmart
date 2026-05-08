import React, { useState, useEffect } from 'react';
import { Box, Typography, IconButton, Stack, Collapse } from '@mui/material';
import { Close, Campaign, WarningAmber, ErrorOutline, CheckCircleOutline } from '@mui/icons-material';
import apiClient from '../../../api';

const ACCENT = '#F43F5E';
const BLUE = '#3B82F6';
const WARNING = '#F59E0B';
const SUCCESS = '#10B981';

const AnnouncementBanner = () => {
    const [announcements, setAnnouncements] = useState([]);
    const [visible, setVisible] = useState(true);

    useEffect(() => {
        const fetchActive = async () => {
            try {
                const { data } = await apiClient.get('/saas/announcements');
                setAnnouncements(data);
            } catch (err) {
                console.error("Error fetching announcements");
            }
        };
        fetchActive();
    }, []);

    if (announcements.length === 0 || !visible) return null;

    const getColors = (tipo) => {
        switch (tipo) {
            case 'critical': return { bg: `${ACCENT}15`, text: ACCENT, icon: <ErrorOutline /> };
            case 'warning':  return { bg: '#FFFBEB', text: '#B45309', icon: <WarningAmber /> };
            case 'success':  return { bg: '#F0FDF4', text: SUCCESS, icon: <CheckCircleOutline /> };
            default:         return { bg: '#EFF6FF', text: BLUE, icon: <Campaign /> };
        }
    };

    return (
        <Stack spacing={1} sx={{ width: '100%', mb: 2 }}>
            {announcements.map((ann) => {
                const colors = getColors(ann.tipo);
                return (
                    <Box 
                        key={ann.id}
                        sx={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'space-between',
                            p: '10px 20px',
                            borderRadius: 3,
                            bgcolor: colors.bg,
                            border: `1px solid ${colors.text}30`,
                            color: colors.text,
                            boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
                        }}
                    >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            {React.cloneElement(colors.icon, { sx: { fontSize: 20 } })}
                            <Box>
                                <Typography sx={{ fontWeight: 800, fontSize: 13, lineHeight: 1 }}>{ann.titulo}</Typography>
                                <Typography sx={{ fontSize: 12, mt: 0.5, opacity: 0.9 }}>{ann.mensaje}</Typography>
                            </Box>
                        </Box>
                        {/* Botón de cerrar opcional o por sesión */}
                        <IconButton size="small" onClick={() => setVisible(false)} sx={{ color: colors.text }}>
                            <Close fontSize="small" />
                        </IconButton>
                    </Box>
                );
            })}
        </Stack>
    );
};

export default AnnouncementBanner;
