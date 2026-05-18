import React, { useState, useMemo } from 'react';
import {
  TableContainer, Table, TableHead, TableRow, TableCell,
  TableBody, Paper, Chip, Box, Typography, useTheme, useMediaQuery,
  Divider, Stack, TextField, MenuItem, InputAdornment, IconButton
} from '@mui/material';
import { AdminPanelSettings, History, Business, Event, FilterList, Close } from '@mui/icons-material';

const ACCENT = '#F43F5E';
const BLUE = '#3B82F6';

const formatDateFull = (d) => d ? new Date(d).toLocaleString('es-CO') : 'N/A';

const AuditLogCard = ({ log }) => (
    <Paper sx={{
      p: 2,
      mb: 2,
      borderRadius: 3,
      boxShadow: '0 2px 10px rgba(0,0,0,0.04)',
      borderLeft: `4px solid ${ACCENT}`,
      width: '100%',
      boxSizing: 'border-box',
      overflow: 'hidden'
    }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
            <Box sx={{ minWidth: 0, flex: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                    <AdminPanelSettings sx={{ fontSize: 16, color: ACCENT }} />
                    <Typography sx={{ fontWeight: 800, fontSize: 14, noWrap: true }}>{log.admin_username}</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Business sx={{ fontSize: 14, color: BLUE }} />
                    <Typography sx={{ fontWeight: 700, fontSize: 12, color: BLUE, noWrap: true }}>{log.empresa_nombre}</Typography>
                </Box>
            </Box>
            <Chip label={log.accion} size="small" sx={{ fontWeight: 800, fontSize: 10, height: 22, bgcolor: `${BLUE}15`, color: BLUE, ml: 1 }} />
        </Box>

        <Box sx={{ mb: 1.5 }}>
            <Typography sx={{
              fontSize: 11,
              color: 'text.secondary',
              fontFamily: 'monospace',
              p: 1,
              bgcolor: 'action.hover',
              borderRadius: 2,
              wordBreak: 'break-all',
              whiteSpace: 'pre-wrap',
              display: 'block',
              width: '100%',
              boxSizing: 'border-box'
            }}>
                {typeof log.detalle === 'object' ? JSON.stringify(log.detalle, null, 2) : log.detalle}
            </Typography>
        </Box>

        <Divider sx={{ my: 1.5, opacity: 0.5 }} />

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Event sx={{ fontSize: 14, color: 'text.secondary' }} />
            <Typography sx={{ fontSize: 11, color: 'text.secondary', fontWeight: 600 }}>{formatDateFull(log.fecha)}</Typography>
        </Box>
    </Paper>
);

const FilterBar = ({ logs, filters, setFilters }) => {
  const uniqueActions = useMemo(() => [...new Set(logs.map(l => l.accion).filter(Boolean))].sort(), [logs]);

  return (
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 2 }}>
      <TextField
        size="small"
        label="Desde"
        type="date"
        value={filters.desde}
        onChange={e => setFilters(f => ({ ...f, desde: e.target.value }))}
        InputLabelProps={{ shrink: true }}
        sx={{ minWidth: 150 }}
      />
      <TextField
        size="small"
        label="Hasta"
        type="date"
        value={filters.hasta}
        onChange={e => setFilters(f => ({ ...f, hasta: e.target.value }))}
        InputLabelProps={{ shrink: true }}
        sx={{ minWidth: 150 }}
      />
      <TextField
        select
        size="small"
        label="Acción"
        value={filters.accion}
        onChange={e => setFilters(f => ({ ...f, accion: e.target.value }))}
        sx={{ minWidth: 160 }}
        InputProps={{
          endAdornment: filters.accion ? (
            <InputAdornment position="end">
              <IconButton size="small" onClick={() => setFilters(f => ({ ...f, accion: '' }))}><Close fontSize="small" /></IconButton>
            </InputAdornment>
          ) : null
        }}
      >
        <MenuItem value="">Todas</MenuItem>
        {uniqueActions.map(a => <MenuItem key={a} value={a}>{a}</MenuItem>)}
      </TextField>
      <TextField
        size="small"
        label="Empresa"
        placeholder="Filtrar por nombre..."
        value={filters.empresa}
        onChange={e => setFilters(f => ({ ...f, empresa: e.target.value }))}
        sx={{ flex: 1 }}
      />
    </Stack>
  );
};

const AuditLogsTable = ({ logs }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [filters, setFilters] = useState({ desde: '', hasta: '', accion: '', empresa: '' });

  const filtered = useMemo(() => {
    return logs.filter(log => {
      if (filters.accion && log.accion !== filters.accion) return false;
      if (filters.empresa && !log.empresa_nombre?.toLowerCase().includes(filters.empresa.toLowerCase())) return false;
      if (filters.desde) {
        const logDate = new Date(log.fecha);
        if (logDate < new Date(filters.desde)) return false;
      }
      if (filters.hasta) {
        const logDate = new Date(log.fecha);
        const hasta = new Date(filters.hasta);
        hasta.setHours(23, 59, 59);
        if (logDate > hasta) return false;
      }
      return true;
    });
  }, [logs, filters]);

  const hasFilters = filters.accion || filters.empresa || filters.desde || filters.hasta;

  if (isMobile) {
      return (
          <Box sx={{ pb: 2, width: '100%', maxWidth: '100%', boxSizing: 'border-box', overflowX: 'hidden' }}>
              <FilterBar logs={logs} filters={filters} setFilters={setFilters} />
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="overline" sx={{ fontWeight: 800, color: 'text.secondary' }}>
                    {filtered.length} Registros{hasFilters ? ' (filtrados)' : ''}
                </Typography>
                {hasFilters && (
                  <Chip label="Limpiar filtros" size="small" onDelete={() => setFilters({ desde: '', hasta: '', accion: '', empresa: '' })} sx={{ fontSize: 10 }} />
                )}
              </Box>
              {filtered.map(log => (
                  <AuditLogCard key={log.id} log={log} />
              ))}
              {filtered.length === 0 && (
                  <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 4 }}>
                      <History sx={{ fontSize: 40, color: 'action.disabled', mb: 1 }} />
                      <Typography color="text.secondary">No hay registros con estos filtros.</Typography>
                  </Paper>
              )}
          </Box>
      );
  }

  return (
    <Box>
      <FilterBar logs={logs} filters={filters} setFilters={setFilters} />
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700 }}>
          <FilterList sx={{ fontSize: 14, verticalAlign: 'middle', mr: 0.5 }} />
          {filtered.length} de {logs.length} registros
        </Typography>
        {hasFilters && (
          <Chip label="Limpiar filtros" size="small" onDelete={() => setFilters({ desde: '', hasta: '', accion: '', empresa: '' })} sx={{ fontSize: 10 }} />
        )}
      </Box>
      <Paper sx={{ borderRadius: 4, boxShadow: '0 4px 20px rgba(0,0,0,0.05)', overflow: 'hidden', width: '100%' }}>
        <TableContainer sx={{ maxHeight: '65vh' }}>
          <Table size="medium" stickyHeader sx={{ tableLayout: 'fixed' }}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 800, bgcolor: 'action.hover', width: '25%' }}>Admin / Empresa</TableCell>
                <TableCell sx={{ fontWeight: 800, bgcolor: 'action.hover', width: '15%' }}>Acción</TableCell>
                <TableCell sx={{ fontWeight: 800, bgcolor: 'action.hover', width: '60%' }}>Detalles</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map(log => (
                <TableRow key={log.id} hover>
                  <TableCell>
                    <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{formatDateFull(log.fecha)}</Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                      <AdminPanelSettings sx={{ fontSize: 12, color: ACCENT }} />
                      <Typography sx={{ fontWeight: 700, fontSize: 12 }}>{log.admin_username}</Typography>
                    </Box>
                    <Typography variant="caption" sx={{ display: 'block', mt: 0.5, fontWeight: 700, color: BLUE }}>
                        {log.empresa_nombre}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip label={log.accion} size="small" sx={{ fontWeight: 800, fontSize: 9, height: 20 }} />
                  </TableCell>
                  <TableCell>
                    <Typography sx={{
                      fontSize: 11,
                      color: 'text.secondary',
                      fontFamily: 'monospace',
                      wordBreak: 'break-all',
                      whiteSpace: 'pre-wrap'
                    }}>
                      {JSON.stringify(log.detalle)}
                    </Typography>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} sx={{ textAlign: 'center', py: 6 }}>
                    <History sx={{ fontSize: 40, color: 'action.disabled', mb: 1, display: 'block', mx: 'auto' }} />
                    <Typography color="text.secondary">No hay registros con estos filtros.</Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
};

export default AuditLogsTable;
