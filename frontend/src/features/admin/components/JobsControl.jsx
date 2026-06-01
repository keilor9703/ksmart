import React, { useState, useEffect } from 'react';
import { 
  Box, Typography, Paper, Table, TableContainer, TableHead, 
  TableRow, TableCell, TableBody, Chip, IconButton, Tooltip, Stack,
  CircularProgress, Alert, AlertTitle, Button, useTheme, useMediaQuery, Divider
} from '@mui/material';
import { PlayArrow, History, ErrorOutline, CheckCircleOutline, AccessTime, Info, Terminal } from '@mui/icons-material';
import { toast } from 'react-toastify';
import apiClient from '../../../api';
import usePolling from '../../../hooks/usePolling';

const JobCard = ({ job, getStatusChip }) => (
    <Paper sx={{ p: 2, mb: 2, borderRadius: 3, boxShadow: '0 2px 10px rgba(0,0,0,0.04)', borderLeft: '4px solid #1E293B' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
            <Box>
                <Typography sx={{ fontWeight: 800, fontSize: 14, mb: 0.5 }}>{job.job_name}</Typography>
                <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>
                    ID: {job.execution_id.substring(0, 8)}
                </Typography>
            </Box>
            {getStatusChip(job.status)}
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <AccessTime sx={{ fontSize: 14, color: 'text.secondary' }} />
                <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
                    {new Date(job.started_at).toLocaleTimeString()}
                </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Terminal sx={{ fontSize: 14, color: 'text.secondary' }} />
                <Typography sx={{ fontSize: 12, fontWeight: 700 }}>
                    {job.metrics?.tenants_expired ?? 0} <span style={{ fontWeight: 400, color: 'gray' }}>expirados</span>
                </Typography>
            </Box>
        </Box>

        {job.status === 'failed' && (
            <>
                <Divider sx={{ my: 1, opacity: 0.5 }} />
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'error.main' }}>
                    <Info sx={{ fontSize: 14 }} />
                    <Typography sx={{ fontSize: 11, fontWeight: 600 }}>{job.error_log || 'Error desconocido'}</Typography>
                </Box>
            </>
        )}
    </Paper>
);

const JobsControl = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  
  const [jobs, setJobs] = useState([]);
  const [running, setRunning] = useState(false);

  const fetchJobs = async () => {
    try {
      const { data } = await apiClient.get('/superadmin/jobs/history');
      setJobs(data);
    } catch (e) {
      console.error("Error cargando historial de jobs");
    }
  };

  useEffect(() => { fetchJobs(); }, []);
  // Refresco cada 15s; se pausa si la pestaña está oculta.
  usePolling(fetchJobs, 15000);

  const handleRunExpiration = async () => {
    if (!window.confirm("¿Ejecutar el proceso de expiración de suscripciones ahora?")) return;
    setRunning(true);
    try {
      const { data } = await apiClient.post('/superadmin/jobs/run-expiration');
      if (data.error) {
        toast.warning(data.error);
      } else {
        toast.success(`Proceso completado: ${data.tenants_expired} empresas expiradas.`);
      }
      fetchJobs();
    } catch (err) {
      toast.error('Error al ejecutar el job');
    } finally {
      setRunning(false);
    }
  };

  const getStatusChip = (status) => {
    switch (status) {
      case 'running': return <Chip label={isMobile ? "EJEC." : "EJECUTANDO"} size="small" color="primary" icon={<CircularProgress size={12} color="inherit" />} sx={{ fontWeight: 800, fontSize: 10 }} />;
      case 'success': return <Chip label={isMobile ? "OK" : "ÉXITO"} size="small" color="success" icon={<CheckCircleOutline sx={{ fontSize: '14px !important' }} />} sx={{ fontWeight: 800, fontSize: 10 }} />;
      case 'failed': return <Chip label={isMobile ? "ERROR" : "FALLÓ"} size="small" color="error" icon={<ErrorOutline sx={{ fontSize: '14px !important' }} />} sx={{ fontWeight: 800, fontSize: 10 }} />;
      default: return <Chip label={status.toUpperCase()} size="small" sx={{ fontSize: 10 }} />;
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
          <Typography sx={{ fontWeight: 800, fontSize: isMobile ? 16 : 18 }}>Tareas de Sistema</Typography>
          <Button 
            variant="contained" 
            fullWidth={isMobile}
            startIcon={running ? <CircularProgress size={20} color="inherit" /> : <PlayArrow />} 
            onClick={handleRunExpiration}
            disabled={running}
            sx={{ bgcolor: '#1E293B', borderRadius: 2, fontWeight: 700 }}
          >
              Ejecutar Expiración
          </Button>
      </Box>

      <Alert severity="info" sx={{ mb: 4, borderRadius: 3, '& .MuiAlert-message': { width: '100%' } }}>
          <AlertTitle sx={{ fontWeight: 800 }}>Lock Lógico Activo</AlertTitle>
          {isMobile 
            ? "Evita ejecuciones duplicadas. Logs inmutables para Rollback."
            : "El sistema evita ejecuciones duplicadas mediante un lock en DB. Los logs son inmutables para asegurar trazabilidad y permitir recuperación manual."}
      </Alert>

      <Typography sx={{ fontWeight: 800, fontSize: 14, mb: 2, color: 'text.secondary', textTransform: 'uppercase' }}>Historial Reciente</Typography>
      
      {isMobile ? (
          <Box sx={{ pb: 5 }}>
              {jobs.map(job => (
                  <JobCard key={job.id} job={job} getStatusChip={getStatusChip} />
              ))}
              {jobs.length === 0 && (
                  <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 4 }}>
                      <History sx={{ fontSize: 40, color: 'action.disabled', mb: 1 }} />
                      <Typography color="text.secondary">Sin historial de tareas.</Typography>
                  </Paper>
              )}
          </Box>
      ) : (
        <Paper sx={{ borderRadius: 4, boxShadow: '0 4px 20px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
            <TableContainer>
            <Table size="medium">
                <TableHead sx={{ bgcolor: 'action.hover' }}>
                <TableRow>
                    <TableCell sx={{ fontWeight: 800 }}>ID / Job</TableCell>
                    <TableCell sx={{ fontWeight: 800 }}>Estado</TableCell>
                    <TableCell sx={{ fontWeight: 800 }}>Inicio</TableCell>
                    <TableCell sx={{ fontWeight: 800 }}>Resultado</TableCell>
                </TableRow>
                </TableHead>
                <TableBody>
                {jobs.map((job) => (
                    <TableRow key={job.id} hover>
                    <TableCell>
                        <Typography sx={{ fontWeight: 700, fontSize: 13 }}>{job.job_name}</Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                            {job.execution_id.substring(0, 8)}
                        </Typography>
                    </TableCell>
                    <TableCell>{getStatusChip(job.status)}</TableCell>
                    <TableCell sx={{ fontSize: 12 }}>
                        {new Date(job.started_at).toLocaleTimeString()}
                    </TableCell>
                    <TableCell>
                        {job.status === 'success' ? (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Typography sx={{ fontSize: 12, fontWeight: 700 }}>
                                    {job.metrics?.tenants_expired}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">expirados</Typography>
                            </Box>
                        ) : (
                            <Tooltip title={job.error_log || "Error desconocido"}>
                                <IconButton size="small" color="error"><Info fontSize="small" /></IconButton>
                            </Tooltip>
                        )}
                    </TableCell>
                    </TableRow>
                ))}
                {jobs.length === 0 && (
                    <TableRow><TableCell colSpan={4} align="center" sx={{ py: 4 }}>Sin historial.</TableCell></TableRow>
                )}
                </TableBody>
            </Table>
            </TableContainer>
        </Paper>
      )}
    </Box>
  );
};

export default JobsControl;
