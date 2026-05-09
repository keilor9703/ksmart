import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Button, Dialog, DialogTitle, DialogContent, 
  IconButton, Grid, Paper, Divider, CircularProgress, useTheme
} from '@mui/material';
import { Close, WorkspacePremium } from '@mui/icons-material';
import apiClient from '../../../api';
import { formatCurrency } from '../../../utils/formatters';
import WompiButton from '../../../components/common/WompiButton';

const GREEN = '#10B981';

const SaaSUpgradeManager = ({ user }) => {
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [planes, setPlanes] = useState([]);
  const [loadingPlanes, setLoadingPlanes] = useState(false);
  const theme = useTheme();

  const calculateDaysLeft = (dateString) => {
    if (!dateString) return 0;
    const endsAt = new Date(dateString.endsWith('Z') ? dateString : dateString + 'Z');
    const diffTime = endsAt - new Date();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const diasRestantes = calculateDaysLeft(user?.empresa?.trial_ends_at);
  const isTrial = user?.empresa?.plan_type === 'trial' && user?.empresa_id !== 1;

  const handleOpenUpgrade = async () => {
    setUpgradeOpen(true);
    if (planes.length === 0) {
      setLoadingPlanes(true);
      try {
        const { data: resPlanes } = await apiClient.get('/planes-activos');
        setPlanes(resPlanes);
      } catch (error) {
        console.error("Error cargando planes:", error);
      } finally {
        setLoadingPlanes(false);
      }
    }
  };

  if (!isTrial || diasRestantes <= 0) return null;

  return (
    <>
      {/* ── TRIAL BANNER ── */}
      <Box sx={{ 
        mb: 3, p: 1.5, borderRadius: 2, 
        bgcolor: theme.palette.mode === 'dark' ? 'rgba(37, 99, 235, 0.15)' : '#EFF6FF', 
        border: '1px solid',
        borderColor: theme.palette.mode === 'dark' ? 'rgba(37, 99, 235, 0.3)' : '#BFDBFE', 
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 
      }}>
        <Typography sx={{ fontSize: 12, color: theme.palette.mode === 'dark' ? '#93C5FD' : '#1E3A8A', fontWeight: 600 }}>
          ⏱ Estás en tu periodo de prueba. Te quedan {diasRestantes} días gratis.
        </Typography>
        <Button size="small" variant="contained" onClick={handleOpenUpgrade} sx={{ bgcolor: '#2563EB', fontSize: 11, fontWeight: 700, boxShadow: 'none' }}>
          Activar mi cuenta
        </Button>
      </Box>

      {/* ── MODAL DE SUSCRIPCIÓN ── */}
      <Dialog open={upgradeOpen} onClose={() => setUpgradeOpen(false)} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: 3, bgcolor: 'background.default' } }}>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: 'background.paper', borderBottom: '1px solid', borderColor: 'divider' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{ width: 40, height: 40, borderRadius: 2, bgcolor: 'rgba(244, 63, 94, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#F43F5E' }}>
              <WorkspacePremium />
            </Box>
            <Typography sx={{ fontWeight: 800, fontSize: 18 }}>Elige tu Plan</Typography>
          </Box>
          <IconButton onClick={() => setUpgradeOpen(false)}><Close /></IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: { xs: 2, md: 4 } }}>
          {loadingPlanes ? <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}><CircularProgress sx={{ color: '#F43F5E' }} /></Box> :
            <Grid container spacing={3}>
              {planes.map(plan => (
                <Grid item xs={12} sm={6} md={4} key={plan.id}>
                  <Paper sx={{ 
                    p: 3, 
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    textAlign: 'center', 
                    borderRadius: 4, 
                    border: '1px solid', 
                    borderColor: plan.codigo_interno === 'premium' ? '#F43F5E' : 'divider', 
                    boxShadow: plan.codigo_interno === 'premium' ? '0 10px 25px rgba(244, 63, 94, 0.15)' : '0 4px 12px rgba(0,0,0,0.05)', 
                    bgcolor: 'background.paper',
                    position: 'relative',
                    overflow: 'hidden'
                  }}>
                    {plan.codigo_interno === 'premium' && (
                      <Box sx={{ position: 'absolute', top: 12, right: -30, bgcolor: '#F43F5E', color: 'white', px: 4, py: 0.5, transform: 'rotate(45deg)', fontSize: 10, fontWeight: 900 }}>RECOMENDADO</Box>
                    )}
                    
                    <Typography sx={{ fontWeight: 900, fontSize: 18, mb: 1, color: plan.color || 'inherit' }}>{plan.nombre}</Typography>
                    <Box sx={{ mb: 2 }}>
                      <Typography component="span" sx={{ fontSize: 28, fontWeight: 900, color: '#F43F5E' }}>{formatCurrency(plan.precio)}</Typography>
                      <Typography component="span" sx={{ fontSize: 12, color: 'text.secondary' }}> / {plan.dias_duracion} días</Typography>
                    </Box>

                    <Divider sx={{ mb: 2, opacity: 0.6 }} />

                    <Box sx={{ flex: 1, textAlign: 'left', mb: 3 }}>
                      {plan.caracteristicas ? plan.caracteristicas.split(',').map((feat, i) => (
                        <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                          <Box sx={{ width: 16, height: 16, borderRadius: '50%', bgcolor: `${GREEN}15`, color: GREEN, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                             <Typography sx={{ fontSize: 10, fontWeight: 900 }}>✓</Typography>
                          </Box>
                          <Typography sx={{ fontSize: 12, fontWeight: 500, color: 'text.secondary' }}>{feat.trim()}</Typography>
                        </Box>
                      )) : (
                        <Typography sx={{ fontSize: 12, color: 'text.secondary', fontStyle: 'italic', textAlign: 'center' }}>Incluye todas las funciones estándar</Typography>
                      )}
                    </Box>

                    <WompiButton 
                       planName={plan.codigo_interno} 
                       onSuccess={() => { setUpgradeOpen(false); window.location.reload(); }} 
                    />
                  </Paper>
                </Grid>
              ))}
            </Grid>
          }
        </DialogContent>
      </Dialog>
    </>
  );
};

export default SaaSUpgradeManager;
