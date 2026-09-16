import React, { useState, useMemo } from 'react';
import {
  Paper, TableContainer, Table, TableHead, TableRow, TableCell,
  TableBody, TablePagination, Box, Avatar, Typography, Chip, Tooltip, IconButton,
  useTheme, useMediaQuery, Stack, Divider, TableSortLabel
} from '@mui/material';
import {
  ShoppingBag, Description, People, Info, SupportAgent, Settings, Shield, ShieldOutlined,
  ViewModule, WhatsApp
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

const TenantMobileCard = ({ emp, onOpenDrawer, onImpersonate, onOpenPlan, onOpenModulos, onToggleProtection }) => (
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

        {/* Dueño, teléfono y fecha de registro */}
        <Box sx={{ mb: 1.5 }}>
            <Typography sx={{ fontSize: 12.5, fontWeight: 600 }}>{emp.owner_nombre || 'Sin dueño registrado'}</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', mt: 0.3 }}>
                {emp.owner_telefono && (
                    <Box component="a"
                        href={`https://wa.me/${String(emp.owner_telefono).replace(/\D/g, '')}`}
                        target="_blank" rel="noopener noreferrer"
                        sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.4, textDecoration: 'none', color: GREEN, fontSize: 11.5, fontWeight: 600 }}>
                        <WhatsApp sx={{ fontSize: 13 }} /> {emp.owner_telefono}
                    </Box>
                )}
                <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
                    Registro: {formatDateShort(emp.created_at)}
                </Typography>
            </Box>
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
                <IconButton size="small" disabled={emp.id === 1} onClick={() => onOpenModulos(emp)} sx={{ color: ACCENT }}><ViewModule fontSize="small" /></IconButton>
                <IconButton size="small" disabled={emp.id === 1} onClick={() => onOpenPlan(emp)}><Settings fontSize="small" /></IconButton>
            </Stack>
        </Box>
    </Paper>
);

const COLUMNS = [
  { id: 'nombre', label: 'Inquilino', sortFn: (a, b) => a.nombre.localeCompare(b.nombre) },
  { id: 'owner_nombre', label: 'Dueño / Contacto', sortFn: (a, b) => (a.owner_nombre || '').localeCompare(b.owner_nombre || '') },
  { id: 'created_at', label: 'Registro', sortFn: (a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0) },
  { id: 'plan_type', label: 'Plan / Estado', sortFn: (a, b) => a.plan_type.localeCompare(b.plan_type) },
  { id: 'last_activity_at', label: 'Actividad', sortFn: (a, b) => new Date(b.last_activity_at || 0) - new Date(a.last_activity_at || 0) },
  { id: 'count_ventas', label: 'Uso (V / P / U)', sortFn: (a, b) => b.count_ventas - a.count_ventas },
  { id: 'acciones', label: 'Acciones', sortable: false },
];

const TenantsTable = ({ empresas, onOpenDrawer, onImpersonate, onOpenPlan, onOpenModulos, onToggleProtection }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [sortBy, setSortBy] = useState('nombre');
  const [sortDir, setSortDir] = useState('asc');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const handleSort = (colId) => {
    if (sortBy === colId) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(colId); setSortDir('asc'); }
    setPage(0);
  };

  const sorted = useMemo(() => {
    const col = COLUMNS.find(c => c.id === sortBy);
    if (!col?.sortFn) return empresas;
    const copy = [...empresas].sort(col.sortFn);
    return sortDir === 'desc' ? copy.reverse() : copy;
  }, [empresas, sortBy, sortDir]);

  const paginated = sorted.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

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
                    onOpenModulos={onOpenModulos}
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
              {COLUMNS.map(col => (
                <TableCell
                  key={col.id}
                  align={col.id === 'acciones' ? 'right' : 'left'}
                  sx={{ fontWeight: 800 }}
                  sortDirection={sortBy === col.id ? sortDir : false}
                >
                  {col.sortFn !== undefined ? (
                    <TableSortLabel
                      active={sortBy === col.id}
                      direction={sortBy === col.id ? sortDir : 'asc'}
                      onClick={() => handleSort(col.id)}
                    >
                      {col.label}
                    </TableSortLabel>
                  ) : col.label}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {paginated.map((emp) => (
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
                {/* Dueño: quién registró la empresa + su teléfono (con WhatsApp) */}
                <TableCell>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 600, fontSize: 13 }} noWrap>
                      {emp.owner_nombre || '—'}
                    </Typography>
                    {emp.owner_telefono ? (
                      <Box
                        component="a"
                        href={`https://wa.me/${String(emp.owner_telefono).replace(/\D/g, '')}`}
                        target="_blank" rel="noopener noreferrer"
                        sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.4, textDecoration: 'none', color: GREEN, fontSize: 11.5, fontWeight: 600 }}
                      >
                        <WhatsApp sx={{ fontSize: 13 }} /> {emp.owner_telefono}
                      </Box>
                    ) : (
                      <Typography sx={{ fontSize: 11.5, color: 'text.disabled' }}>Sin teléfono</Typography>
                    )}
                    {emp.owner_email && (
                      <Typography sx={{ fontSize: 10.5, color: 'text.secondary' }} noWrap>{emp.owner_email}</Typography>
                    )}
                  </Box>
                </TableCell>
                {/* Fecha de registro de la empresa */}
                <TableCell>
                  <Tooltip title={formatDateFull(emp.created_at)}>
                    <Typography sx={{ fontSize: 12, fontWeight: 600 }}>
                      {formatDateShort(emp.created_at)}
                    </Typography>
                  </Tooltip>
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
                  <Tooltip title={emp.is_protected ? "Quitar Protección" : "Activar Protección (Inmunidad SaaS)"} arrow>
                    <IconButton size="small" onClick={() => onToggleProtection(emp.id)} sx={{ color: emp.is_protected ? BLUE : 'action.disabled' }}>
                        {emp.is_protected ? <Shield fontSize="small" /> : <ShieldOutlined fontSize="small" />}
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Ver Visión 360°" arrow>
                    <IconButton size="small" onClick={() => onOpenDrawer(emp)} sx={{ color: BLUE }}><Info fontSize="small" /></IconButton>
                  </Tooltip>
                  <Tooltip title="Entrar como Soporte (Impersonate)" arrow>
                    <IconButton size="small" onClick={() => onImpersonate(emp.id)} sx={{ color: PURPLE }}><SupportAgent fontSize="small" /></IconButton>
                  </Tooltip>
                  <Tooltip title="Configurar Módulos Habilitados" arrow>
                    <IconButton size="small" disabled={emp.id === 1} onClick={() => onOpenModulos(emp)} sx={{ color: ACCENT }}><ViewModule fontSize="small" /></IconButton>
                  </Tooltip>
                  <Tooltip title="Gestionar Suscripción y Vencimiento" arrow>
                    <IconButton size="small" disabled={emp.id === 1} onClick={() => onOpenPlan(emp)} sx={{ color: 'text.secondary' }}><Settings fontSize="small" /></IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      <TablePagination
        component="div"
        count={sorted.length}
        page={page}
        onPageChange={(_, p) => setPage(p)}
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
        rowsPerPageOptions={[10, 25, 50]}
        labelRowsPerPage="Por página:"
        labelDisplayedRows={({ from, to, count }) => `${from}–${to} de ${count}`}
      />
    </Paper>
  );
};

export default TenantsTable;
