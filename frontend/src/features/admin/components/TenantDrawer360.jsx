import React from 'react';
import { 
  Drawer, Box, Typography, IconButton, Avatar, Chip, 
  Divider, Grid, Paper, List, ListItem, ListItemIcon, 
  ListItemText, Stack, Button, useTheme, useMediaQuery 
} from '@mui/material';
import {
  Close, People, ShoppingBag, Info, AccessTime,
  SupportAgent, CardMembership, Block, CheckCircle, ViewModule,
  Email, Phone, CalendarMonth
} from '@mui/icons-material';

const ACCENT = '#F43F5E';
const BLUE = '#3B82F6';
const GREEN = '#10B981';
const PURPLE = '#8B5CF6';

const getStatusColor = (dias) => {
  if (dias > 30) return GREEN;
  if (dias > 0) return '#F59E0B';
  return '#EF4444';
};

const getActivityColor = (lastActivity) => {
    if (!lastActivity) return '#94A3B8';
    const diff = new Date() - new Date(lastActivity);
    const hours = diff / (1000 * 60 * 60);
    if (hours < 24) return GREEN;
    if (hours < 168) return '#F59E0B';
    return '#EF4444';
};

const formatDateShort = (d) => d ? new Date(d).toLocaleDateString('es-CO') : 'N/A';
const formatDateFull = (d) => d ? new Date(d).toLocaleString('es-CO') : 'N/A';

const TenantDrawer360 = ({ open, onClose, tenant, onImpersonate, onOpenPlan, onOpenModulos, onToggleStatus }) => {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

    if (!tenant) return null;

    return (
        <Drawer 
            anchor={isMobile ? "bottom" : "right"} 
            open={open} 
            onClose={onClose} 
            PaperProps={{ 
                sx: { 
                    width: { xs: '100%', sm: 400 }, 
                    height: { xs: '90vh', sm: '100%' },
                    borderRadius: { xs: '20px 20px 0 0', sm: '20px 0 0 20px' } 
                } 
            }}
        >
            <Box sx={{ p: isMobile ? 2.5 : 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                    <Typography sx={{ fontWeight: 800, fontSize: 20 }}>Visión 360°</Typography>
                    <IconButton onClick={onClose}><Close /></IconButton>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 4 }}>
                    <Avatar sx={{ width: isMobile ? 56 : 64, height: isMobile ? 56 : 64, bgcolor: tenant.color_primario || ACCENT, fontSize: 24, fontWeight: 800 }}>
                        {tenant.nombre.substring(0, 2).toUpperCase()}
                    </Avatar>
                    <Box>
                        <Typography sx={{ fontWeight: 800, fontSize: 18 }}>{tenant.nombre}</Typography>
                        <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>
                            ID: #{tenant.id} • NIT: {tenant.nit}{tenant.dv ? `-${tenant.dv}` : ''}
                        </Typography>
                        <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                            <Chip 
                                label={tenant.is_active ? 'ACTIVO' : 'SUSPENDIDO'} 
                                size="small" 
                                sx={{ height: 20, fontSize: 10, fontWeight: 800, bgcolor: tenant.is_active ? `${GREEN}15` : `${ACCENT}15`, color: tenant.is_active ? GREEN : ACCENT }} 
                            />
                            {tenant.facturacion_electronica_activa && (
                                <Chip 
                                    label="FE ACTIVA" 
                                    size="small" 
                                    sx={{ height: 20, fontSize: 10, fontWeight: 800, bgcolor: `${BLUE}15`, color: BLUE }} 
                                />
                            )}
                        </Stack>
                    </Box>
                </Box>

                <Divider sx={{ mb: 3 }} />

                <Typography sx={{ fontWeight: 800, fontSize: 14, mb: 2, color: 'text.secondary', textTransform: 'uppercase' }}>Información Legal & DIAN</Typography>
                <Paper variant="outlined" sx={{ p: 2, borderRadius: 3, mb: 3, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}>
                    <Grid container spacing={2}>
                        <Grid item xs={6}>
                            <Typography variant="caption" color="text.secondary">Organización</Typography>
                            <Typography sx={{ fontWeight: 700, fontSize: 13 }}>{tenant.tipo_organizacion_id === 1 ? 'Jurídica' : 'Natural'}</Typography>
                        </Grid>
                        <Grid item xs={6}>
                            <Typography variant="caption" color="text.secondary">Régimen</Typography>
                            <Typography sx={{ fontWeight: 700, fontSize: 13 }}>{tenant.tipo_regimen_id === 48 ? 'Responsable IVA' : 'Simplificado'}</Typography>
                        </Grid>
                        <Grid item xs={12}>
                            <Typography variant="caption" color="text.secondary">Responsabilidades</Typography>
                            <Typography sx={{ fontWeight: 700, fontSize: 13 }}>{tenant.responsabilidad_fiscal_codes || 'R-99-PN'}</Typography>
                        </Grid>
                        {tenant.correo_facturacion && (
                            <Grid item xs={12}>
                                <Typography variant="caption" color="text.secondary">Correo Facturación</Typography>
                                <Typography sx={{ fontWeight: 700, fontSize: 13 }}>{tenant.correo_facturacion}</Typography>
                            </Grid>
                        )}
                    </Grid>
                </Paper>

                {(tenant.admin_email || tenant.admin_telefono) && (
                  <>
                    <Typography sx={{ fontWeight: 800, fontSize: 14, mb: 2, color: 'text.secondary', textTransform: 'uppercase' }}>Contacto Admin</Typography>
                    <Paper variant="outlined" sx={{ p: 2, borderRadius: 3, mb: 3, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}>
                      <Grid container spacing={2}>
                        {tenant.admin_email && (
                          <Grid item xs={12}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Email sx={{ fontSize: 16, color: BLUE }} />
                              <Box>
                                <Typography variant="caption" color="text.secondary">Correo</Typography>
                                <Typography sx={{ fontWeight: 700, fontSize: 13 }}>{tenant.admin_email}</Typography>
                              </Box>
                            </Box>
                          </Grid>
                        )}
                        {tenant.admin_telefono && (
                          <Grid item xs={12}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Phone sx={{ fontSize: 16, color: GREEN }} />
                              <Box>
                                <Typography variant="caption" color="text.secondary">Teléfono / WhatsApp</Typography>
                                <Typography sx={{ fontWeight: 700, fontSize: 13 }}>{tenant.admin_telefono}</Typography>
                              </Box>
                            </Box>
                          </Grid>
                        )}
                      </Grid>
                    </Paper>
                  </>
                )}

                <Typography sx={{ fontWeight: 800, fontSize: 14, mb: 2, color: 'text.secondary', textTransform: 'uppercase' }}>Suscripción</Typography>
                <Paper variant="outlined" sx={{ p: 2, borderRadius: 3, mb: 4, bgcolor: 'action.hover', border: 'none' }}>
                    <Grid container spacing={2}>
                        <Grid item xs={6}>
                            <Typography variant="caption" color="text.secondary">Plan</Typography>
                            <Typography sx={{ fontWeight: 800, textTransform: 'capitalize', color: BLUE }}>{tenant.plan_type}</Typography>
                        </Grid>
                        <Grid item xs={6}>
                            <Typography variant="caption" color="text.secondary">Vence en</Typography>
                            <Typography sx={{ fontWeight: 800, color: getStatusColor(tenant.dias_restantes) }}>
                                {tenant.id === 1 ? '∞' : `${tenant.dias_restantes} días`}
                            </Typography>
                        </Grid>
                        {tenant.trial_ends_at && tenant.id !== 1 && (
                          <Grid item xs={12}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <CalendarMonth sx={{ fontSize: 16, color: getStatusColor(tenant.dias_restantes) }} />
                              <Box>
                                <Typography variant="caption" color="text.secondary">Fecha exacta de vencimiento</Typography>
                                <Typography sx={{ fontWeight: 700, fontSize: 13, color: getStatusColor(tenant.dias_restantes) }}>
                                  {formatDateFull(tenant.trial_ends_at)}
                                </Typography>
                              </Box>
                            </Box>
                          </Grid>
                        )}
                    </Grid>
                </Paper>

                <Typography sx={{ fontWeight: 800, fontSize: 14, mb: 2, color: 'text.secondary', textTransform: 'uppercase' }}>Uso Real</Typography>
                <List sx={{ mb: 4 }} dense={isMobile}>
                    <ListItem sx={{ px: 0 }}>
                        <ListItemIcon><People sx={{ color: BLUE }} /></ListItemIcon>
                        <ListItemText primary="Usuarios" secondary={`${tenant.count_usuarios} activos`} primaryTypographyProps={{ fontWeight: 700 }} />
                    </ListItem>
                    <ListItem sx={{ px: 0 }}>
                        <ListItemIcon><ShoppingBag sx={{ color: GREEN }} /></ListItemIcon>
                        <ListItemText primary="Ventas" secondary={`${tenant.count_ventas} facturadas`} primaryTypographyProps={{ fontWeight: 700 }} />
                    </ListItem>
                    <ListItem sx={{ px: 0 }}>
                        <ListItemIcon><AccessTime sx={{ color: getActivityColor(tenant.last_activity_at) }} /></ListItemIcon>
                        <ListItemText primary="Última vez" secondary={formatDateFull(tenant.last_activity_at)} primaryTypographyProps={{ fontWeight: 700 }} />
                    </ListItem>
                </List>

                <Divider sx={{ mb: 3 }} />

                <Stack spacing={2}>
                    <Button fullWidth variant="contained" startIcon={<SupportAgent />} onClick={() => onImpersonate(tenant.id)} sx={{ bgcolor: BLUE, borderRadius: 2, fontWeight: 700, py: 1.2 }}>Entrar como Soporte</Button>
                    <Box sx={{ display: 'flex', gap: 2 }}>
                        <Button fullWidth variant="outlined" startIcon={<CardMembership />} onClick={() => onOpenPlan(tenant)} sx={{ borderRadius: 2, fontWeight: 700 }}>Plan</Button>
                        <Button fullWidth variant="outlined" startIcon={<ViewModule />} onClick={() => onOpenModulos(tenant)} sx={{ borderRadius: 2, fontWeight: 700 }}>Módulos</Button>
                    </Box>
                    <Button fullWidth variant="outlined" color={tenant.is_active ? "error" : "success"} startIcon={tenant.is_active ? <Block /> : <CheckCircle />} onClick={() => onToggleStatus(tenant.id, tenant.is_active)} sx={{ borderRadius: 2, fontWeight: 700 }}>
                        {tenant.is_active ? "Suspender Inquilino" : "Activar Inquilino"}
                    </Button>
                </Stack>
            </Box>
        </Drawer>
    );
};

export default TenantDrawer360;
