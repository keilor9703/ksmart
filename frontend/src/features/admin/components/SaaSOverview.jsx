import React from 'react';
import { 
  Grid, Paper, Box, Typography, TableContainer, Table, TableHead, 
  TableRow, TableCell, TableBody, Chip, Button, Stack, useTheme, useMediaQuery, Divider
} from '@mui/material';
import { 
  Payments, Business, WorkspacePremium, People,
  ShoppingBag, WarningAmber, CheckCircle, AccessTime,
  PersonAdd, CalendarMonth
} from '@mui/icons-material';

const GREEN = '#10B981';
const BLUE = '#3B82F6';
const ACCENT = '#F43F5E';
const PURPLE = '#8B5CF6';

const formatCurrency = (val) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(val || 0);
const formatDateFull = (d) => d ? new Date(d).toLocaleString('es-CO') : 'N/A';
const formatDateShort = (d) => d ? new Date(d).toLocaleDateString('es-CO') : 'N/A';

const getActivityColor = (lastActivity) => {
    if (!lastActivity) return '#94A3B8';
    const diff = new Date() - new Date(lastActivity);
    const hours = diff / (1000 * 60 * 60);
    if (hours < 24) return GREEN;
    if (hours < 168) return '#F59E0B';
    return '#EF4444';
};

const KPICard = ({ title, value, icon, color, subtitle, isMobile }) => (
  <Paper sx={{ 
    p: isMobile ? 2 : 2.5, 
    borderRadius: 4, 
    height: '100%', 
    display: 'flex', 
    flexDirection: 'column', 
    position: 'relative', 
    overflow: 'hidden', 
    boxShadow: '0 4px 20px rgba(0,0,0,0.05)' 
  }}>
    <Box sx={{ position: 'absolute', top: -10, right: -10, opacity: 0.1, color }}>
        {React.cloneElement(icon, { sx: { fontSize: isMobile ? 60 : 80 } })}
    </Box>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
        <Box sx={{ p: 0.8, borderRadius: 2, bgcolor: `${color}15`, color, display: 'flex' }}>
            {React.cloneElement(icon, { sx: { fontSize: 18 } })}
        </Box>
        <Typography sx={{ fontSize: isMobile ? 12 : 13, fontWeight: 700, color: 'text.secondary' }}>{title}</Typography>
    </Box>
    <Typography sx={{ fontSize: isMobile ? 22 : 26, fontWeight: 800, mb: 0.5 }}>{value}</Typography>
    {subtitle && <Typography sx={{ fontSize: 11, color: 'text.secondary', noWrap: true }}>{subtitle}</Typography>}
  </Paper>
);

const ActivityCard = ({ emp, onClick }) => (
    <Paper onClick={onClick} sx={{ p: 2, mb: 1.5, borderRadius: 3, cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' }, boxShadow: '0 2px 10px rgba(0,0,0,0.04)' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography sx={{ fontWeight: 800, fontSize: 14 }}>{emp.nombre}</Typography>
            <Chip size="small" label={emp.dias_restantes > 0 ? 'OK' : 'Vencida'} sx={{ height: 18, fontSize: 9, fontWeight: 800, bgcolor: emp.dias_restantes > 0 ? `${GREEN}15` : `${ACCENT}15`, color: emp.dias_restantes > 0 ? GREEN : ACCENT }} />
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: getActivityColor(emp.last_activity_at) }} />
            <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
                Última actividad: {formatDateShort(emp.last_activity_at)}
            </Typography>
        </Box>
    </Paper>
);

const SaaSOverview = ({ stats, empresas, onViewTenants, onOpenTenant }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  return (
    <Box>
      <Grid container spacing={isMobile ? 2 : 3} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={6} md={3}>
              <KPICard isMobile={isMobile} title="Revenue (ARR)" value={formatCurrency(stats.total_recaudado * 12)} icon={<Payments />} color={GREEN} subtitle={`MRR: ${formatCurrency(stats.total_recaudado)}`} />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
              <KPICard isMobile={isMobile} title="Total Tenants" value={stats.total_tenants} icon={<Business />} color={BLUE} subtitle={`${stats.activos} activos`} />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
              <KPICard isMobile={isMobile} title="Conversión Premium" value={`${Math.round((stats.premium / stats.total_tenants) * 100 || 0)}%`} icon={<WorkspacePremium />} color="#F59E0B" subtitle={`${stats.premium} de pago`} />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
              <KPICard isMobile={isMobile} title="Total Usuarios" value={stats.total_usuarios} icon={<People />} color={PURPLE} subtitle="Carga total" />
          </Grid>
          {/* Altas de empresas: hoy y en el mes en curso (hora Colombia) */}
          <Grid item xs={12} sm={6} md={3}>
              <KPICard
                isMobile={isMobile}
                title="Registros hoy"
                value={stats.nuevos_hoy ?? 0}
                icon={<PersonAdd />}
                color={GREEN}
                subtitle="Empresas nuevas"
              />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
              <KPICard
                isMobile={isMobile}
                title="Registros del mes"
                value={stats.nuevos_mes ?? 0}
                icon={<CalendarMonth />}
                color={BLUE}
                subtitle={new Date().toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })}
              />
          </Grid>
      </Grid>

      <Grid container spacing={isMobile ? 2 : 3}>
          <Grid item xs={12} md={8}>
              <Paper sx={{ p: isMobile ? 2 : 3, borderRadius: 4, height: '100%', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3, alignItems: 'center' }}>
                      <Typography sx={{ fontWeight: 800, fontSize: 16 }}>Actividad Reciente</Typography>
                      <Chip label="Live" size="small" variant="outlined" sx={{ height: 20, fontSize: 10, fontWeight: 700, color: GREEN, borderColor: GREEN }} />
                  </Box>
                  
                  {isMobile ? (
                      <Box sx={{ maxHeight: 400, overflowY: 'auto', pr: 1 }}>
                          {empresas.slice(0, 20).map(emp => (
                              <ActivityCard key={emp.id} emp={emp} onClick={() => onOpenTenant(emp)} />
                          ))}
                      </Box>
                  ) : (
                      <TableContainer sx={{ maxHeight: 350 }}>
                          <Table size="small" stickyHeader>
                              <TableHead>
                                  <TableRow>
                                      <TableCell sx={{ fontWeight: 700, bgcolor: 'background.paper' }}>Empresa</TableCell>
                                      <TableCell sx={{ fontWeight: 700, bgcolor: 'background.paper' }}>Actividad</TableCell>
                                      <TableCell sx={{ fontWeight: 700, bgcolor: 'background.paper' }}>Salud</TableCell>
                                  </TableRow>
                              </TableHead>
                              <TableBody>
                                  {empresas.slice(0, 20).map(emp => (
                                      <TableRow key={emp.id} hover sx={{ cursor: 'pointer' }} onClick={() => onOpenTenant(emp)}>
                                          <TableCell sx={{ fontWeight: 600 }}>{emp.nombre}</TableCell>
                                          <TableCell>
                                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: getActivityColor(emp.last_activity_at) }} />
                                                  <Typography sx={{ fontSize: 12 }}>{formatDateFull(emp.last_activity_at)}</Typography>
                                              </Box>
                                          </TableCell>
                                          <TableCell>
                                              <Chip size="small" label={emp.dias_restantes > 0 ? 'OK' : 'Vencida'} sx={{ height: 20, fontSize: 10, fontWeight: 700, bgcolor: emp.dias_restantes > 0 ? `${GREEN}15` : `${ACCENT}15`, color: emp.dias_restantes > 0 ? GREEN : ACCENT }} />
                                          </TableCell>
                                      </TableRow>
                                  ))}
                              </TableBody>
                          </Table>
                      </TableContainer>
                  )}
                  <Button fullWidth variant="outlined" sx={{ mt: 2, fontWeight: 700, borderRadius: 2 }} onClick={onViewTenants}>Ver Base Completa</Button>
              </Paper>
          </Grid>
          <Grid item xs={12} md={4}>
              <Paper sx={{ p: isMobile ? 2 : 3, borderRadius: 4, height: '100%', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
                <Typography sx={{ fontWeight: 800, fontSize: 16, mb: 3 }}>Alertas Críticas</Typography>
                <Stack spacing={2}>
                    {empresas.filter(e => e.dias_restantes <= 5 && e.id !== 1).slice(0, 5).map(e => (
                        <Box key={e.id} onClick={() => onOpenTenant(e)} sx={{ p: 1.5, borderRadius: 3, bgcolor: `${ACCENT}08`, border: `1px solid ${ACCENT}20`, display: 'flex', alignItems: 'center', gap: 2, cursor: 'pointer', '&:hover': { bgcolor: `${ACCENT}12` } }}>
                            <WarningAmber sx={{ color: ACCENT, fontSize: 20 }} />
                            <Box>
                                <Typography sx={{ fontWeight: 700, fontSize: 13 }}>{e.nombre}</Typography>
                                <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{e.dias_restantes <= 0 ? 'Plan Expirado' : `Expira en ${e.dias_restantes} días`}</Typography>
                            </Box>
                        </Box>
                    ))}
                    {empresas.filter(e => e.dias_restantes <= 5 && e.id !== 1).length === 0 && (
                        <Box sx={{ textAlign: 'center', py: 4 }}>
                            <CheckCircle sx={{ fontSize: 40, color: GREEN, mb: 1, opacity: 0.5 }} />
                            <Typography color="text.secondary" sx={{ fontSize: 13 }}>Operación sin riesgos hoy</Typography>
                        </Box>
                    )}
                </Stack>
              </Paper>
          </Grid>
      </Grid>
    </Box>
  );
};

export default SaaSOverview;
