import React from 'react';
import { 
  Paper, TableContainer, Table, TableHead, TableRow, TableCell, 
  TableBody, Box, Avatar, Typography, Chip, Tooltip, IconButton,
  useTheme, useMediaQuery, Stack, Divider
} from '@mui/material';
import { 
  ShoppingBag, Description, People, Info, SupportAgent, Settings, Shield, ShieldOutlined,
  MoreVert
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

const TenantMobileCard = ({ emp, onOpenDrawer, onImpersonate, onOpenPlan, onToggleProtection }) => (
    <Paper sx={{ p: 2, mb: 2, borderRadius: 3, boxShadow: '0 2px 10px rgba(0,0,0,0.04)' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Box sx={{ position: 'relative' }}>
                    <Avatar sx={{ width: 40, height: 40, bgcolor: emp.color_primario || ACCENT, fontSize: 14, fontWeight: 800 }}>
                        {emp.nombre.substring(0, 2).toUpperCase()}
                    </Avatar>
                    {emp.is_protected && (
                        <Shield sx={{ position: 'absolute', bottom: -2, right: -2, fontSize: 12, color: BLUE, bgcolor: 'white', borderRadius: '50%' }} />
                    )}
                </Box>
                <Box>
                    <Typography sx={{ fontWeight: 800, fontSize: 15 }}>{emp.nombre}</Typography>
                    <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>ID: {emp.id} • NIT: {emp.nit || 'N/A'}</Typography>
                </Box>
            </Box>
            <IconButton size="small" onClick={() => onOpenDrawer(emp)}><Info fontSize="small" color="primary" /></IconButton>
        </Box>

        <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
            <Chip label={emp.plan_type.toUpperCase()} size="small" sx={{ fontWeight: 800, fontSize: 9, bgcolor: emp.plan_type === 'premium' ? '#F59E0B20' : `${BLUE}20`, color: emp.plan_type === 'premium' ? '#B45309' : BLUE }} />
            <Chip label={emp.is_active ? 'ACTIVO' : 'SUSPENDIDO'} size="small" sx={{ fontWeight: 800, fontSize: 9, bgcolor: emp.is_active ? `${GREEN}20` : `${ACCENT}20`, color: emp.is_active ? GREEN : ACCENT }} />
            <Chip label={emp.id === 1 ? '∞' : `${emp.dias_restantes}d`} size="small" sx={{ fontWeight: 800, fontSize: 9, color: getStatusColor(emp.dias_restantes) }} />
        </Box>

        <Divider sx={{ my: 1.5, opacity: 0.5 }} />

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box sx={{ display: 'flex', gap: 1.5 }}>
                <Tooltip title="Ventas"><Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}><ShoppingBag sx={{ fontSize: 14, color: 'text.secondary' }} /><Typography variant="caption" fontWeight={700}>{emp.count_ventas}</Typography></Box></Tooltip>
                <Tooltip title="Usuarios"><Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}><People sx={{ fontSize: 14, color: 'text.secondary' }} /><Typography variant="caption" fontWeight={700}>{emp.count_usuarios}</Typography></Box></Tooltip>
            </Box>
            <Stack direction="row" spacing={1}>
                <IconButton size="small" onClick={() => onToggleProtection(emp.id)} color={emp.is_protected ? "primary" : "default"}><Shield fontSize="small" /></IconButton>
                <IconButton size="small" onClick={() => onImpersonate(emp.id)} sx={{ color: PURPLE }}><SupportAgent fontSize="small" /></IconButton>
                <IconButton size="small" disabled={emp.id === 1} onClick={() => onOpenPlan(emp)}><Settings fontSize="small" /></IconButton>
            </Stack>
        </Box>
    </Paper>
);

const TenantsTable = ({ empresas, onOpenDrawer, onImpersonate, onOpenPlan, onToggleProtection }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  if (isMobile) {
      return (
          <Box sx={{ pb: 5 }}>
              {empresas.map(emp => (
                  <TenantMobileCard 
                    key={emp.id} 
                    emp={emp} 
                    onOpenDrawer={onOpenDrawer} 
                    onImpersonate={onImpersonate} 
                    onOpenPlan={onOpenPlan} 
                    onToggleProtection={onToggleProtection} 
                  />
              ))}
          </Box>
      );
  }

  return (
    <Paper sx={{ borderRadius: 4, boxShadow: '0 4px 20px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
      <TableContainer>
        <Table>
          <TableHead sx={{ bgcolor: 'action.hover' }}>
            <TableRow>
              <TableCell sx={{ fontWeight: 800 }}>Inquilino</TableCell>
              <TableCell sx={{ fontWeight: 800 }}>Plan / Estado</TableCell>
              <TableCell sx={{ fontWeight: 800 }}>Actividad</TableCell>
              <TableCell sx={{ fontWeight: 800 }}>Uso (V / P / U)</TableCell>
              <TableCell align="right" sx={{ fontWeight: 800 }}>Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {empresas.map((emp) => (
              <TableRow key={emp.id} hover sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Box sx={{ position: 'relative' }}>
                        <Avatar sx={{ width: 32, height: 32, bgcolor: emp.color_primario || ACCENT, fontSize: 12, fontWeight: 800 }}>{emp.nombre.substring(0, 2).toUpperCase()}</Avatar>
                        {emp.is_protected && (
                            <Tooltip title="Empresa Protegida (QA/Partner)">
                                <Shield sx={{ position: 'absolute', bottom: -4, right: -4, fontSize: 14, color: BLUE, bgcolor: 'white', borderRadius: '50%' }} />
                            </Tooltip>
                        )}
                      </Box>
                      <Box>
                          <Typography sx={{ fontWeight: 700, fontSize: 14 }}>{emp.nombre}</Typography>
                          <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>ID: {emp.id} · NIT: {emp.nit || 'N/A'}</Typography>
                      </Box>
                  </Box>
                </TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography sx={{ fontWeight: 700, fontSize: 13, textTransform: 'capitalize', color: emp.plan_type === 'premium' ? '#F59E0B' : BLUE }}>{emp.plan_type}</Typography>
                          <Chip label={emp.is_active ? 'Activa' : 'Off'} size="small" sx={{ height: 16, fontSize: 9, fontWeight: 900, bgcolor: emp.is_active ? `${GREEN}20` : `${ACCENT}20`, color: emp.is_active ? GREEN : ACCENT }} />
                      </Box>
                      <Typography sx={{ fontSize: 11, color: getStatusColor(emp.dias_restantes), fontWeight: 700 }}>{emp.id === 1 ? 'Ilimitado' : (emp.dias_restantes > 0 ? `En ${emp.dias_restantes} días` : 'Expirado')}</Typography>
                  </Box>
                </TableCell>
                <TableCell>
                    <Tooltip title={`Último login: ${formatDateFull(emp.last_activity_at)}`}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: getActivityColor(emp.last_activity_at), boxShadow: `0 0 5px ${getActivityColor(emp.last_activity_at)}` }} />
                          <Typography sx={{ fontSize: 12, fontWeight: 600 }}>{emp.last_activity_at ? formatDateShort(emp.last_activity_at) : 'Sin datos'}</Typography>
                      </Box>
                    </Tooltip>
                </TableCell>
                <TableCell>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                        <Tooltip title="Ventas"><Chip label={emp.count_ventas} size="small" icon={<ShoppingBag sx={{ fontSize: '14px !important' }} />} sx={{ fontWeight: 700, fontSize: 11 }} /></Tooltip>
                        <Tooltip title="Productos"><Chip label={emp.count_productos} size="small" icon={<Description sx={{ fontSize: '14px !important' }} />} sx={{ fontWeight: 700, fontSize: 11 }} /></Tooltip>
                        <Tooltip title="Usuarios"><Chip label={emp.count_usuarios} size="small" icon={<People sx={{ fontSize: '14px !important' }} />} sx={{ fontWeight: 700, fontSize: 11 }} /></Tooltip>
                    </Box>
                </TableCell>
                <TableCell align="right">
                  <IconButton size="small" onClick={() => onToggleProtection(emp.id)} sx={{ color: emp.is_protected ? BLUE : 'action.disabled' }}>
                      {emp.is_protected ? <Shield fontSize="small" /> : <ShieldOutlined fontSize="small" />}
                  </IconButton>
                  <IconButton size="small" onClick={() => onOpenDrawer(emp)} sx={{ color: BLUE }}><Info fontSize="small" /></IconButton>
                  <IconButton size="small" onClick={() => onImpersonate(emp.id)} sx={{ color: PURPLE }}><SupportAgent fontSize="small" /></IconButton>
                  <IconButton size="small" disabled={emp.id === 1} onClick={() => onOpenPlan(emp)} sx={{ color: 'text.secondary' }}><Settings fontSize="small" /></IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
};

export default TenantsTable;
