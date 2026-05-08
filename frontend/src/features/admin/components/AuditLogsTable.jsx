import React from 'react';
import { 
  TableContainer, Table, TableHead, TableRow, TableCell, 
  TableBody, Paper, Chip, Box, Typography, useTheme, useMediaQuery,
  Divider, Stack
} from '@mui/material';
import { AdminPanelSettings, History, Business, Event } from '@mui/icons-material';

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
      width: '100%', // Forzar ancho total
      boxSizing: 'border-box',
      overflow: 'hidden' // Evitar que el contenido se salga
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
              // CLAVE PARA LA RESPONSIVIDAD:
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

const AuditLogsTable = ({ logs }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  if (isMobile) {
      return (
          <Box sx={{ 
            pb: 2, 
            width: '100%', 
            maxWidth: '100%', 
            boxSizing: 'border-box',
            overflowX: 'hidden' // Doble seguridad
          }}>
              <Typography variant="overline" sx={{ fontWeight: 800, color: 'text.secondary', mb: 2, display: 'block' }}>
                  Últimos Registros
              </Typography>
              {logs.map(log => (
                  <AuditLogCard key={log.id} log={log} />
              ))}
              {logs.length === 0 && (
                  <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 4 }}>
                      <History sx={{ fontSize: 40, color: 'action.disabled', mb: 1 }} />
                      <Typography color="text.secondary">No hay registros.</Typography>
                  </Paper>
              )}
          </Box>
      );
  }

  return (
    <Paper sx={{ borderRadius: 4, boxShadow: '0 4px 20px rgba(0,0,0,0.05)', overflow: 'hidden', width: '100%' }}>
      <TableContainer sx={{ maxHeight: '70vh' }}>
        <Table size="medium" stickyHeader sx={{ tableLayout: 'fixed' }}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 800, bgcolor: 'action.hover', width: '25%' }}>Admin</TableCell>
              <TableCell sx={{ fontWeight: 800, bgcolor: 'action.hover', width: '15%' }}>Acción</TableCell>
              <TableCell sx={{ fontWeight: 800, bgcolor: 'action.hover', width: '60%' }}>Detalles</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {logs.map(log => (
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
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
};

export default AuditLogsTable;