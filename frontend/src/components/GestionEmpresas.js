import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Button, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Chip, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, Stack, 
  Tooltip, Grid, Divider, useTheme, useMediaQuery, MenuItem, Tabs, Tab, FormControlLabel, Switch
} from '@mui/material';
import { 
  Add, Business, Block, CheckCircle, AdminPanelSettings, 
  Close, CardMembership, WorkspacePremium, AccessTime, Edit, LocalOffer,
  ReceiptLong, AlternateEmail, Payments
} from '@mui/icons-material';
import { toast } from 'react-toastify';
import apiClient, { fetchPlanesAdmin, createPlan, updatePlan } from '../api';

const ACCENT = '#F43F5E';
const BLUE = '#3B82F6';
const GREEN = '#10B981';

const formatCurrency = (val) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(val);
const formatDateFull = (d) => new Date(d).toLocaleString();

export default function GestionSaaS() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [tabValue, setTabValue] = useState(0);
  const [loading, setLoading] = useState(false);

  // Estados
  const [empresas, setEmpresas] = useState([]);
  const [planesCatalog, setPlanesCatalog] = useState([]);
  const [pagos, setPagos] = useState([]); // 👈 Nuevo estado para auditoría

  const [openDialogEmpresa, setOpenDialogEmpresa] = useState(false);
  const [openPlanDialog, setOpenPlanDialog] = useState(false);
  const [empresaSeleccionada, setEmpresaSeleccionada] = useState(null);
  const [formAsignarPlan, setFormAsignarPlan] = useState({ plan_type: 'trial', plan_selector: 'trial', trial_ends_at: '' });

  useEffect(() => { 
    fetchEmpresas(); 
    fetchCatalogoPlanes();
    fetchHistorialPagos();
  }, []);

  const fetchEmpresas = async () => {
    try { const { data } = await apiClient.get('/superadmin/empresas'); setEmpresas(data); } catch (e) {}
  };

  const fetchCatalogoPlanes = async () => {
    try { const { data } = await fetchPlanesAdmin(); setPlanesCatalog(data); } catch (e) {}
  };

  const fetchHistorialPagos = async () => {
    try {
      const { data } = await apiClient.get('/superadmin/historial-pagos');
      setPagos(data);
    } catch (e) { console.error("Error cargando pagos"); }
  };

  // ... (Funciones de manejo de planes y empresas que ya teníamos) ...

  return (
    <Box sx={{ width: '100%' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ width: 44, height: 44, borderRadius: 2, bgcolor: `${ACCENT}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: ACCENT }}>
            <AdminPanelSettings fontSize="medium" />
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 800, fontSize: 22, lineHeight: 1.2 }}>Centro de Control SaaS</Typography>
            <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>Administración global de Ksmart360</Typography>
          </Box>
        </Box>
        
        {tabValue === 0 && <Button variant="contained" startIcon={<Add />} onClick={() => setOpenDialogEmpresa(true)} sx={{ bgcolor: ACCENT, borderRadius: 2 }}>Nueva Empresa</Button>}
        {tabValue === 1 && <Button variant="contained" startIcon={<Add />} onClick={() => {}} sx={{ bgcolor: BLUE, borderRadius: 2 }}>Crear Plan</Button>}
        {tabValue === 2 && <Button variant="outlined" startIcon={<Autorenew />} onClick={fetchHistorialPagos} sx={{ borderRadius: 2 }}>Actualizar Historial</Button>}
      </Box>

      {/* Tabs */}
      <Paper sx={{ mb: 3, borderRadius: 3, boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}>
        <Tabs 
          value={tabValue} onChange={(e, val) => setTabValue(val)} 
          variant={isMobile ? "fullWidth" : "standard"}
          sx={{ '& .MuiTab-root': { fontWeight: 700, fontSize: 13, textTransform: 'none', minHeight: 56 } }}
        >
          <Tab icon={<Business sx={{ mr: 1, mb: '0 !important' }}/>} iconPosition="start" label="Inquilinos" />
          <Tab icon={<LocalOffer sx={{ mr: 1, mb: '0 !important' }}/>} iconPosition="start" label="Catálogo" />
          <Tab icon={<ReceiptLong sx={{ mr: 1, mb: '0 !important' }}/>} iconPosition="start" label="Historial de Pagos" />
        </Tabs>
      </Paper>

      {/* TAB 0 y 1 se mantienen igual... */}
      {tabValue === 0 && <Box> {/* ... Tu código anterior de empresas ... */} </Box>}
      {tabValue === 1 && <Box> {/* ... Tu código anterior de planes ... */} </Box>}

      {/* ══════════════════════════════════════════════════════════════════════════
          TAB 2: HISTORIAL DE PAGOS (LA CAJA REGISTRADORA)
          ══════════════════════════════════════════════════════════════════════════ */}
      {tabValue === 2 && (
        <Paper sx={{ borderRadius: 3, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: 'action.hover' }}>
                  <TableCell sx={{ fontWeight: 700 }}>Fecha y Hora</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Empresa / Cliente</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Plan Adquirido</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Monto</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Método / ID Bold</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {pagos.length === 0 ? (
                  <TableRow><TableCell colSpan={5} align="center" sx={{ py: 4, color: 'text.secondary' }}>No se han registrado pagos aún.</TableCell></TableRow>
                ) : (
                  pagos.map((p) => (
                    <TableRow key={p.id} hover>
                      <TableCell sx={{ fontSize: 12 }}>{formatDateFull(p.fecha_pago)}</TableCell>
                      <TableCell>
                        <Typography sx={{ fontWeight: 700, fontSize: 13 }}>{p.empresa_nombre}</Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'text.secondary' }}>
                          <AlternateEmail sx={{ fontSize: 12 }} />
                          <Typography sx={{ fontSize: 11 }}>{p.email_pagador}</Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip label={p.plan_nombre} size="small" sx={{ fontWeight: 600, fontSize: 10, bgcolor: `${BLUE}15`, color: BLUE }} />
                      </TableCell>
                      <TableCell sx={{ fontWeight: 800, color: GREEN }}>
                        {formatCurrency(p.monto)}
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Chip label={p.metodo_pago} size="small" variant="outlined" sx={{ fontWeight: 700, fontSize: 10 }} />
                          <Typography sx={{ fontSize: 10, color: 'text.secondary', fontFamily: 'monospace' }}>#{p.bold_tx_id}</Typography>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {/* ... (Modales de Inquilinos y Planes que ya tenías) ... */}
    </Box>
  );
}
