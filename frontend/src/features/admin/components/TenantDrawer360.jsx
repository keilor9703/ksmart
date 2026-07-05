import React from 'react';
import { 
  Drawer, Box, Typography, IconButton, Avatar, Chip, 
  Divider, Grid, Paper, List, ListItem, ListItemIcon, 
  ListItemText, Stack, Button, useTheme, useMediaQuery,
  CircularProgress, Tooltip
} from '@mui/material';
import {
  Close, People, ShoppingBag, AccessTime,
  SupportAgent, CardMembership, Block, CheckCircle, ViewModule,
  Email, Phone, CalendarMonth, DeleteForever, Shield,
  Terminal, Memory, Speed, Hub, SyncAlt
} from '@mui/icons-material';
import { keyframes } from '@mui/system';
import { toast } from 'react-toastify';

const ACCENT = '#F43F5E'; // Rosa — Superadmin
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

const formatDateFull = (d) => d ? new Date(d).toLocaleString('es-CO', {
  day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
}) : 'Sin actividad reciente';

const pulseGlow = keyframes`
  0% { box-shadow: 0 0 4px rgba(244, 63, 94, 0.2); }
  50% { box-shadow: 0 0 16px rgba(244, 63, 94, 0.5); }
  100% { box-shadow: 0 0 4px rgba(244, 63, 94, 0.2); }
`;

const TenantDrawer360 = ({ open, onClose, tenant, onImpersonate, onOpenPlan, onOpenModulos, onToggleStatus, onDelete }) => {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    const dark = theme.palette.mode === 'dark';

    if (!tenant) return null;

    // Calcular progreso del trial (asumimos 30 días máx. para la barra visual)
    const diasRest = Math.max(0, tenant.dias_restantes);
    const pctRest = tenant.id === 1 ? 100 : Math.min(100, Math.round((diasRest / 30) * 100));

    return (
        <Drawer 
            anchor={isMobile ? "bottom" : "right"} 
            open={open} 
            onClose={onClose} 
            PaperProps={{ 
                sx: { 
                    width: { xs: '100%', sm: 440 }, 
                    height: { xs: '92vh', sm: '100%' },
                    borderRadius: { xs: '24px 24px 0 0', sm: '24px 0 0 24px' },
                    bgcolor: dark ? '#0A0D14' : '#FAFAFC',
                    borderLeft: `1px solid ${dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                    boxShadow: dark ? '-8px 0 32px rgba(0,0,0,0.5)' : '-8px 0 32px rgba(0,0,0,0.08)',
                    overflow: 'hidden'
                } 
            }}
        >
            {/* Contenedor Principal */}
            <Box sx={{
              height: '100%', display: 'flex', flexDirection: 'column',
              position: 'relative'
            }}>
                
                {/* Cabecera / Telemetría Bar */}
                <Box sx={{
                  p: 3,
                  pb: 2,
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  borderBottom: `1px solid ${dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}`,
                  bgcolor: dark ? '#0E131F' : '#FFF'
                }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Box sx={{ 
                      width: 10, height: 10, borderRadius: '50%', 
                      bgcolor: tenant.is_active ? GREEN : ACCENT, 
                      animation: tenant.is_active ? `${pulseGlow} 2s infinite` : 'none'
                    }} />
                    <Box>
                      <Typography sx={{ fontWeight: 900, fontSize: 15, letterSpacing: 0.5, color: dark ? '#F1F5F9' : '#0F172A', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Terminal fontSize="small" sx={{ color: ACCENT }} /> COCKPIT DE TELEMETRÍA
                      </Typography>
                      <Typography sx={{ fontSize: 10, color: 'text.secondary', fontWeight: 600, fontFamily: 'monospace' }}>
                        SYS_STATUS: {tenant.is_active ? 'ONLINE_ACTIVE' : 'SUSPENDED_HALT'}
                      </Typography>
                    </Box>
                  </Box>
                  <IconButton 
                    onClick={onClose} 
                    sx={{ 
                      border: `1px solid ${dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`, 
                      borderRadius: 2.5,
                      bgcolor: dark ? 'rgba(255,255,255,0.02)' : '#fff',
                      transition: 'all 0.2s',
                      '&:hover': { bgcolor: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)', transform: 'rotate(90deg)' }
                    }}
                  >
                    <Close fontSize="small" />
                  </IconButton>
                </Box>

                {/* Contenido Deslizable */}
                <Box sx={{ 
                  flex: 1, 
                  overflowY: 'auto', 
                  px: 3, 
                  py: 2.5,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 3,
                  '&::-webkit-scrollbar': { width: 5 }, 
                  '&::-webkit-scrollbar-thumb': { bgcolor: dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)', borderRadius: 2.5 },
                  scrollbarWidth: 'thin'
                }}>
                  
                  {/* Identidad del Tenant */}
                  <Paper sx={{ 
                    p: 2.5, 
                    borderRadius: 4, 
                    border: `1px solid ${dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.08)'}`,
                    bgcolor: dark ? 'rgba(17, 24, 39, 0.7)' : '#FFF',
                    position: 'relative',
                    overflow: 'hidden'
                  }}>
                    {/* Efecto Scanline */}
                    <Box sx={{
                      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                      pointerEvents: 'none',
                      background: 'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06))',
                      backgroundSize: '100% 4px, 6px 100%',
                      opacity: dark ? 0.15 : 0.05
                    }} />

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2.5 }}>
                      <Avatar sx={{
                        width: 60, height: 60,
                        background: `linear-gradient(135deg, ${tenant.color_primario || ACCENT}, ${tenant.color_primario || ACCENT}88)`,
                        fontSize: 22, fontWeight: 900, color: '#fff',
                        boxShadow: `0 8px 24px ${(tenant.color_primario || ACCENT)}30`,
                        border: '2px solid rgba(255,255,255,0.2)'
                      }}>
                          {tenant.nombre.substring(0, 2).toUpperCase()}
                      </Avatar>
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                          <Typography sx={{ fontWeight: 900, fontSize: 18, letterSpacing: -0.5, color: dark ? '#FFF' : '#1E293B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {tenant.nombre}
                          </Typography>
                          <Typography sx={{ fontSize: 11, color: 'text.secondary', fontWeight: 600, fontFamily: 'monospace' }}>
                            NIT: {tenant.nit}{tenant.dv ? `-${tenant.dv}` : ''} • ID: #{tenant.id}
                          </Typography>
                          
                          <Stack direction="row" spacing={1} sx={{ mt: 1.2 }}>
                              <Chip 
                                  label={tenant.is_active ? 'ACTIVE_ON' : 'SUSPENDED'} 
                                  size="small" 
                                  sx={{ 
                                    height: 18, 
                                    fontSize: 9, 
                                    fontWeight: 900, 
                                    bgcolor: tenant.is_active ? `${GREEN}15` : `${ACCENT}15`, 
                                    color: tenant.is_active ? GREEN : ACCENT, 
                                    borderRadius: 1.5,
                                    fontFamily: 'monospace'
                                  }} 
                              />
                              {tenant.facturacion_electronica_activa && (
                                  <Chip 
                                      label="FE_DIAN_LINK" 
                                      size="small" 
                                      sx={{ 
                                        height: 18, 
                                        fontSize: 9, 
                                        fontWeight: 900, 
                                        bgcolor: `${BLUE}15`, 
                                        color: BLUE, 
                                        borderRadius: 1.5,
                                        fontFamily: 'monospace'
                                      }} 
                                  />
                              )}
                          </Stack>
                      </Box>
                    </Box>
                  </Paper>

                  {/* Suscripción & Telemetría Gauge */}
                  <Paper sx={{ 
                    p: 2.5, 
                    borderRadius: 4, 
                    border: `1px solid ${dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.08)'}`,
                    bgcolor: dark ? 'rgba(17, 24, 39, 0.7)' : '#FFF',
                  }}>
                    <Typography sx={{ fontWeight: 800, fontSize: 11, mb: 2, color: dark ? '#94A3B8' : '#64748B', textTransform: 'uppercase', letterSpacing: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Memory sx={{ fontSize: 14, color: ACCENT }} /> SUSCRIPCIÓN & CRONOMETRÍA
                    </Typography>

                    <Grid container spacing={2.5} alignItems="center">
                      <Grid item xs={5} sx={{ display: 'flex', justifyContent: 'center' }}>
                        {/* Circular Progress Gauge */}
                        <Box sx={{ position: 'relative', display: 'inline-flex' }}>
                          <CircularProgress
                            variant="determinate"
                            value={100}
                            size={90}
                            thickness={4.5}
                            sx={{ color: dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }}
                          />
                          <CircularProgress
                            variant="determinate"
                            value={pctRest}
                            size={90}
                            thickness={4.5}
                            sx={{ 
                              color: getStatusColor(tenant.dias_restantes),
                              position: 'absolute',
                              left: 0,
                              strokeLinecap: 'round'
                            }}
                          />
                          <Box
                            sx={{
                              top: 0, left: 0, bottom: 0, right: 0,
                              position: 'absolute',
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <Typography sx={{ fontSize: 18, fontWeight: 900, color: getStatusColor(tenant.dias_restantes), lineHeight: 1 }}>
                              {tenant.id === 1 ? '∞' : tenant.dias_restantes}
                            </Typography>
                            <Typography sx={{ fontSize: 8, fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', mt: 0.2 }}>
                              Días
                            </Typography>
                          </Box>
                        </Box>
                      </Grid>

                      <Grid item xs={7}>
                        <Stack spacing={1}>
                          <Box>
                            <Typography sx={{ fontSize: 10, fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase' }}>PLAN CONFIGURADO</Typography>
                            <Typography sx={{ fontWeight: 900, textTransform: 'uppercase', color: BLUE, fontSize: 15, letterSpacing: 0.5 }}>
                              {tenant.plan_type}
                            </Typography>
                          </Box>
                          <Box>
                            <Typography sx={{ fontSize: 10, fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase' }}>ESTADO TEMPORAL</Typography>
                            <Typography sx={{ fontSize: 12, fontWeight: 700, color: getStatusColor(tenant.dias_restantes) }}>
                              {tenant.id === 1 ? 'Suscripción Ilimitada' : tenant.dias_restantes <= 0 ? 'Expirado / Requiere Pago' : 'Periodo de Cobertura Activo'}
                            </Typography>
                          </Box>
                        </Stack>
                      </Grid>
                    </Grid>

                    {tenant.trial_ends_at && tenant.id !== 1 && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 2.5, pt: 1.5, borderTop: `1px dashed ${dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)'}` }}>
                        <CalendarMonth sx={{ fontSize: 14, color: 'text.secondary' }} />
                        <Typography sx={{ fontSize: 11, color: 'text.secondary', fontWeight: 600, fontFamily: 'monospace' }}>
                          EXPIRA EL: {formatDateFull(tenant.trial_ends_at)}
                        </Typography>
                      </Box>
                    )}
                  </Paper>

                  {/* Telemetría de Uso Real */}
                  <Paper sx={{ 
                    p: 2.5, 
                    borderRadius: 4, 
                    border: `1px solid ${dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.08)'}`,
                    bgcolor: dark ? 'rgba(17, 24, 39, 0.7)' : '#FFF',
                  }}>
                    <Typography sx={{ fontWeight: 800, fontSize: 11, mb: 1.5, color: dark ? '#94A3B8' : '#64748B', textTransform: 'uppercase', letterSpacing: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Speed sx={{ fontSize: 14, color: ACCENT }} /> DASHBOARD DE RECURSOS & TRANSACCIONES
                    </Typography>

                    <Grid container spacing={2}>
                      <Grid item xs={12}>
                        <Paper variant="outlined" sx={{ p: 1.5, display: 'flex', alignItems: 'center', gap: 2, bgcolor: dark ? 'rgba(255,255,255,0.01)' : 'rgba(0,0,0,0.01)', border: '1px solid', borderColor: 'divider' }}>
                          <Box sx={{ p: 1, bgcolor: `${BLUE}12`, borderRadius: 2.5, display: 'flex' }}>
                            <People sx={{ color: BLUE, fontSize: 20 }} />
                          </Box>
                          <Box>
                            <Typography sx={{ fontSize: 12.5, fontWeight: 800, color: dark ? '#FFF' : '#334155' }}>Colaboradores Autenticados</Typography>
                            <Typography sx={{ fontSize: 11, fontWeight: 500, fontFamily: 'monospace', color: 'text.secondary' }}>{tenant.count_usuarios} usuarios registrados</Typography>
                          </Box>
                        </Paper>
                      </Grid>

                      <Grid item xs={12}>
                        <Paper variant="outlined" sx={{ p: 1.5, display: 'flex', alignItems: 'center', gap: 2, bgcolor: dark ? 'rgba(255,255,255,0.01)' : 'rgba(0,0,0,0.01)', border: '1px solid', borderColor: 'divider' }}>
                          <Box sx={{ p: 1, bgcolor: `${GREEN}12`, borderRadius: 2.5, display: 'flex' }}>
                            <ShoppingBag sx={{ color: GREEN, fontSize: 20 }} />
                          </Box>
                          <Box>
                            <Typography sx={{ fontSize: 12.5, fontWeight: 800, color: dark ? '#FFF' : '#334155' }}>Carga de Transacciones</Typography>
                            <Typography sx={{ fontSize: 11, fontWeight: 500, fontFamily: 'monospace', color: 'text.secondary' }}>{tenant.count_ventas} ventas en registro</Typography>
                          </Box>
                        </Paper>
                      </Grid>

                      <Grid item xs={12}>
                        <Paper variant="outlined" sx={{ p: 1.5, display: 'flex', alignItems: 'center', gap: 2, bgcolor: dark ? 'rgba(255,255,255,0.01)' : 'rgba(0,0,0,0.01)', border: '1px solid', borderColor: 'divider' }}>
                          <Box sx={{ p: 1, bgcolor: `${getActivityColor(tenant.last_activity_at)}12`, borderRadius: 2.5, display: 'flex' }}>
                            <AccessTime sx={{ color: getActivityColor(tenant.last_activity_at), fontSize: 20 }} />
                          </Box>
                          <Box sx={{ minWidth: 0, flex: 1 }}>
                            <Typography sx={{ fontSize: 12.5, fontWeight: 800, color: dark ? '#FFF' : '#334155' }}>Último Heartbeat</Typography>
                            <Typography sx={{ fontSize: 11, fontWeight: 500, fontFamily: 'monospace', color: 'text.secondary', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{formatDateFull(tenant.last_activity_at)}</Typography>
                          </Box>
                        </Paper>
                      </Grid>
                    </Grid>
                  </Paper>

                  {/* Canales de Comunicación Directa */}
                  <Paper sx={{ 
                    p: 2.5, 
                    borderRadius: 4, 
                    border: `1px solid ${dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.08)'}`,
                    bgcolor: dark ? 'rgba(17, 24, 39, 0.7)' : '#FFF',
                  }}>
                    <Typography sx={{ fontWeight: 800, fontSize: 11, mb: 1.8, color: dark ? '#94A3B8' : '#64748B', textTransform: 'uppercase', letterSpacing: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Hub sx={{ fontSize: 14, color: ACCENT }} /> ENLACES DE SOPORTE DIRECTO
                    </Typography>

                    <Stack spacing={1.5}>
                      {tenant.admin_email && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 1 }}>
                          <Email sx={{ fontSize: 15, color: 'text.secondary' }} />
                          <Tooltip title="Copiar correo" arrow>
                            <Typography 
                              onClick={() => {
                                navigator.clipboard.writeText(tenant.admin_email);
                                toast.info('Correo copiado al portapapeles');
                              }}
                              sx={{ 
                                fontSize: 12, fontWeight: 600, color: 'text.primary', overflow: 'hidden', 
                                textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer',
                                '&:hover': { color: ACCENT } 
                              }}
                            >
                              {tenant.admin_email}
                            </Typography>
                          </Tooltip>
                        </Box>
                      )}
                      {tenant.admin_telefono && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 1 }}>
                          <Phone sx={{ fontSize: 15, color: 'text.secondary' }} />
                          <Typography 
                            onClick={() => {
                              navigator.clipboard.writeText(tenant.admin_telefono);
                              toast.info('Teléfono copiado');
                            }}
                            sx={{ fontSize: 12, fontWeight: 600, color: 'text.primary', cursor: 'pointer', '&:hover': { color: ACCENT } }}
                          >
                            {tenant.admin_telefono}
                          </Typography>
                        </Box>
                      )}
                    </Stack>
                  </Paper>

                </Box>

                {/* Acciones de Control Técnico (Footer) */}
                <Box sx={{ 
                  p: 3, 
                  borderTop: `1px solid ${dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}`, 
                  bgcolor: dark ? '#0E131F' : '#FFF'
                }}>
                  <Stack spacing={1.5}>
                      <Button 
                        fullWidth 
                        variant="contained" 
                        startIcon={<SupportAgent />} 
                        onClick={() => onImpersonate(tenant.id)} 
                        sx={{ 
                          bgcolor: BLUE, borderRadius: 2.5, fontWeight: 800, py: 1.3, textTransform: 'none',
                          boxShadow: `0 6px 16px ${BLUE}30`,
                          transition: 'all 0.2s',
                          '&:hover': { bgcolor: BLUE, filter: 'brightness(1.15)', transform: 'translateY(-1px)' }
                        }}
                      >
                        Suplantar Identidad (Soporte)
                      </Button>
                      <Box sx={{ display: 'flex', gap: 1.5 }}>
                          <Button 
                            fullWidth 
                            variant="outlined" 
                            startIcon={<CardMembership />} 
                            onClick={() => onOpenPlan(tenant)} 
                            sx={{ 
                              borderRadius: 2.5, fontWeight: 700, textTransform: 'none', py: 1, borderColor: dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.15)',
                              color: dark ? '#E2E8F0' : '#475569',
                              transition: 'all 0.2s',
                              '&:hover': { borderColor: ACCENT, bgcolor: `${ACCENT}08` }
                            }}
                          >
                            Plan
                          </Button>
                          <Button 
                            fullWidth 
                            variant="outlined" 
                            startIcon={<ViewModule />} 
                            onClick={() => onOpenModulos(tenant)} 
                            sx={{ 
                              borderRadius: 2.5, fontWeight: 700, textTransform: 'none', py: 1, borderColor: dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.15)',
                              color: dark ? '#E2E8F0' : '#475569',
                              transition: 'all 0.2s',
                              '&:hover': { borderColor: ACCENT, bgcolor: `${ACCENT}08` }
                            }}
                          >
                            Módulos
                          </Button>
                      </Box>
                      <Button 
                        fullWidth 
                        variant="outlined" 
                        color={tenant.is_active ? "error" : "success"} 
                        startIcon={tenant.is_active ? <Block /> : <CheckCircle />} 
                        onClick={() => onToggleStatus(tenant.id, tenant.is_active)} 
                        sx={{ 
                          borderRadius: 2.5, fontWeight: 800, textTransform: 'none', py: 1,
                          borderColor: tenant.is_active ? 'rgba(239, 68, 68, 0.4)' : 'rgba(16, 185, 129, 0.4)',
                          bgcolor: tenant.is_active ? 'rgba(239, 68, 68, 0.02)' : 'rgba(16, 185, 129, 0.02)',
                          transition: 'all 0.2s',
                          '&:hover': { bgcolor: tenant.is_active ? 'rgba(239, 68, 68, 0.08)' : 'rgba(16, 185, 129, 0.08)' }
                        }}
                      >
                          {tenant.is_active ? "Suspender Acceso SaaS" : "Reactivar Acceso SaaS"}
                      </Button>
                      {tenant.id !== 1 && (
                        <Button 
                          fullWidth 
                          variant="text" 
                          color="error" 
                          startIcon={<DeleteForever />} 
                          onClick={() => onDelete(tenant)}
                          sx={{ 
                            fontSize: 11, fontWeight: 700, textTransform: 'none', py: 0.5,
                            opacity: 0.7, '&:hover': { opacity: 1, bgcolor: 'rgba(239, 68, 68, 0.05)' }
                          }}
                        >
                          Eliminar permanentemente del SaaS
                        </Button>
                      )}
                  </Stack>
                </Box>

            </Box>
        </Drawer>
    );
};

export default TenantDrawer360;
