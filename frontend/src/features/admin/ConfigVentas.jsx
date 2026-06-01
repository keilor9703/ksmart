import React, { useState, useEffect } from 'react';
import {
    Box, Paper, Typography, Switch, FormControlLabel,
    Divider, CircularProgress, Chip,
} from '@mui/material';
import Settings from '@mui/icons-material/Settings';
import WarningAmberOutlined from '@mui/icons-material/WarningAmberOutlined';
import { toast } from 'react-toastify';
import apiClient from '../../api';

const ACCENT = '#FF6020';

const ConfigVentas = () => {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [omitirInventario, setOmitirInventario] = useState(false);

    useEffect(() => {
        apiClient.get('/empresa/config-ventas')
            .then(r => setOmitirInventario(r.data.omitir_inventario || false))
            .catch(() => toast.error('Error al cargar configuración'))
            .finally(() => setLoading(false));
    }, []);

    const handleToggle = async (value) => {
        setSaving(true);
        try {
            const r = await apiClient.put('/empresa/config-ventas', { omitir_inventario: value });
            setOmitirInventario(r.data.omitir_inventario);
            toast.success(value
                ? 'Validación de inventario desactivada'
                : 'Validación de inventario activada'
            );
        } catch {
            toast.error('Error al guardar configuración');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Box sx={{ width: '100%', minWidth: 0 }}>
            {/* Header */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
                <Box sx={{
                    width: 40, height: 40, borderRadius: 2,
                    bgcolor: `${ACCENT}18`, display: 'flex', alignItems: 'center',
                    justifyContent: 'center', color: ACCENT,
                }}>
                    <Settings />
                </Box>
                <Box>
                    <Typography sx={{ fontWeight: 700, fontSize: 20, lineHeight: 1.2 }}>
                        Configuración de Ventas
                    </Typography>
                    <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>
                        Opciones avanzadas del módulo de ventas
                    </Typography>
                </Box>
            </Box>

            <Paper sx={{ p: 3, borderRadius: 3, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', maxWidth: 640 }}>
                <Typography sx={{ fontWeight: 700, fontSize: 15, mb: 0.5 }}>
                    Control de inventario
                </Typography>
                <Typography sx={{ fontSize: 13, color: 'text.secondary', mb: 2 }}>
                    Define si el sistema debe verificar el stock al registrar ventas.
                </Typography>
                <Divider sx={{ mb: 2.5 }} />

                {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                        <CircularProgress size={28} sx={{ color: ACCENT }} />
                    </Box>
                ) : (
                    <Box>
                        <FormControlLabel
                            control={
                                <Switch
                                    checked={omitirInventario}
                                    onChange={(e) => handleToggle(e.target.checked)}
                                    disabled={saving}
                                    sx={{
                                        '& .MuiSwitch-switchBase.Mui-checked': { color: '#F59E0B' },
                                        '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: '#F59E0B' },
                                    }}
                                />
                            }
                            label={
                                <Box>
                                    <Typography sx={{ fontWeight: 600, fontSize: 14 }}>
                                        Omitir validación de inventario
                                    </Typography>
                                    <Typography sx={{ fontSize: 12, color: 'text.secondary', mt: 0.3 }}>
                                        Al activar esta opción, el sistema no verificará el stock disponible ni
                                        generará movimientos de inventario al registrar ventas. Ideal para negocios
                                        que no llevan control de inventario.
                                    </Typography>
                                </Box>
                            }
                            sx={{ alignItems: 'flex-start', mx: 0 }}
                        />

                        {omitirInventario && (
                            <Box sx={{ mt: 2 }}>
                                <Chip
                                    icon={<WarningAmberOutlined sx={{ fontSize: '16px !important' }} />}
                                    label="El inventario no se está controlando"
                                    sx={{
                                        bgcolor: '#FEF3C7', color: '#92400E',
                                        fontWeight: 700, fontSize: 12,
                                        border: '1px solid #F59E0B40',
                                        '& .MuiChip-icon': { color: '#F59E0B' },
                                    }}
                                />
                            </Box>
                        )}
                    </Box>
                )}
            </Paper>
        </Box>
    );
};

export default ConfigVentas;
