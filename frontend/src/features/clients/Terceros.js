import React, { useState, useEffect, useMemo } from 'react';
import {
  Box, Typography, Tabs, Tab, Button, Grid, Paper,
  useTheme, useMediaQuery, CircularProgress, Tooltip, IconButton
} from '@mui/material';
import { People, Add, AccountBalance, TrendingUp, Refresh, Handshake, FileDownload } from '@mui/icons-material';
import ClienteForm from './ClienteForm';
import ClienteList from './ClienteList';
import CuentasPorCobrar from '../finance/CuentasPorCobrar';

import apiClient from '../../api';
import { toast } from 'react-toastify';
import { formatCurrency } from '../../utils/formatters';
import HelpGuideTopBar from '../../components/onboarding/HelpGuideTopBar';

const ACCENT  = '#3B82F6';
const GREEN   = '#10B981';
const RED     = '#EF4444';
const PURPLE  = '#8B5CF6';

function TabPanel({ children, value, index }) {
  return (
    <div role="tabpanel" hidden={value !== index}>
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
}

const KpiCard = ({ label, value, icon, color, loading, sub }) => (
  <Paper sx={{
    p: 2.5, borderRadius: 3,
    display: 'flex', alignItems: 'center', gap: 2,
    boxShadow: '0 2px 12px rgba(0,0,0,0.06)'
  }}>
    <Box sx={{
      width: 48, height: 48, borderRadius: 2, flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      bgcolor: `${color}18`, color
    }}>
      {icon}
    </Box>
    <Box>
      <Typography sx={{ fontSize: 12, color: 'text.secondary', fontWeight: 500, mb: 0.3 }}>
        {label}
      </Typography>
      <Typography sx={{ fontSize: 18, fontWeight: 700, color: 'text.primary', lineHeight: 1.2 }}>
        {loading ? <CircularProgress size={18} sx={{ color }} /> : value}
      </Typography>
      {sub && !loading && (
        <Typography sx={{ fontSize: 10, color: 'text.secondary', mt: 0.2 }}>{sub}</Typography>
      )}
    </Box>
  </Paper>
);

export default function Terceros() {
  const theme   = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [tab, setTab]               = useState(0);
  const [clienteToEdit, setClienteToEdit] = useState(null);
  const [formOpen, setFormOpen]     = useState(false);

  // Single source of truth for all clientes
  const [clientes, setClientes]     = useState([]);
  const [loadingClientes, setLoadingClientes] = useState(true);
  const [cuentasPorCobrar, setCuentasPorCobrar] = useState(0);
  const [loadingStats, setLoadingStats] = useState(true);

  const fetchAll = async () => {
    setLoadingClientes(true);
    setLoadingStats(true);
    try {
      const [clientesRes, dashboardRes] = await Promise.all([
        apiClient.get('/clientes/'),
        apiClient.get('/reportes/dashboard'),
      ]);
      setClientes(clientesRes.data || []);
      setCuentasPorCobrar(dashboardRes.data?.cuentas_por_cobrar || 0);
    } catch {
      toast.error('Hubo un problema al cargar los terceros.');
    } finally {
      setLoadingClientes(false);
      setLoadingStats(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const stats = useMemo(() => ({
    totalClientes:   clientes.filter(c => c.es_cliente).length,
    totalProveedores: clientes.filter(c => c.es_proveedor).length,
    totalDuales:     clientes.filter(c => c.es_cliente && c.es_proveedor).length,
  }), [clientes]);

  const handleEdit = (cliente) => {
    setClienteToEdit(cliente);
    setFormOpen(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSuccess = () => {
    setClienteToEdit(null);
    setFormOpen(false);
    fetchAll();
  };

  const handleNewTercero = () => {
    setClienteToEdit(null);
    setFormOpen(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const exportCSV = () => {
    const headers = ['ID', 'Nombre', 'NIT/Cédula', 'Teléfono', 'Dirección', 'Zona', 'Cliente', 'Proveedor', 'Cupo Crédito'];
    const rows = clientes.map(c => [
      c.id,
      c.nombre || '',
      c.cedula || '',
      c.telefono || '',
      c.direccion || '',
      c.zona || '',
      c.es_cliente ? 'Sí' : 'No',
      c.es_proveedor ? 'Sí' : 'No',
      c.cupo_credito?.toFixed(2) || '0',
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `terceros_${new Date().toISOString().slice(0,10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  return (
    <Box sx={{ width: '100%', minWidth: 0, overflow: 'hidden' }}>

      {/* ── Header ── */}
      <Box sx={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        mb: 3, flexWrap: 'wrap', gap: 2
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{
            width: 40, height: 40, borderRadius: 2,
            bgcolor: `${ACCENT}18`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: ACCENT
          }}>
            <People />
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 700, fontSize: 20, lineHeight: 1.2 }}>
              Terceros
            </Typography>
            <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>
              Clientes, proveedores y cuentas por cobrar
            </Typography>
          </Box>
          <HelpGuideTopBar
            moduleName="Clientes y Terceros"
            moduleColor={ACCENT}
            steps={[
              { title: 'Registra tus clientes', description: 'Agrega nombre, NIT/cédula, teléfono y dirección. Estos datos se usan en ventas, cotizaciones y reportes.' },
              { title: 'Gestiona cuentas por cobrar', description: 'En la pestaña "Cuentas por Cobrar" verás todas las ventas con saldo pendiente organizadas por cliente.' },
              { title: 'Registra pagos', description: 'Selecciona una deuda y usa el botón de pago para registrar abonos parciales o cancelación total.' },
              { title: 'Consulta el historial', description: 'Haz clic en el nombre de un cliente para ver todo su historial de compras y pagos.' },
            ]}
            faqItems={[
              { q: '¿Cómo busco un cliente rápidamente?', a: 'Usa la barra de búsqueda en la parte superior del listado. Puedes buscar por nombre, NIT/cédula o teléfono.' },
              { q: '¿Puedo editar los datos de un cliente?', a: 'Sí, haz clic en el ícono de lápiz ✏️ junto al cliente. Todos los campos son editables excepto el ID.' },
              { q: '¿Qué es la cartera pendiente?', a: 'Son ventas registradas con el método "Por Cobrar" que aún tienen saldo sin pagar. Se muestran en la pestaña "Cuentas por Cobrar".' },
              { q: '¿Puedo eliminar un cliente?', a: 'Solo si no tiene ventas asociadas. Si ya tiene historial, es preferible dejarlo inactivo para no perder registros.' },
            ]}
          />
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title="Actualizar datos">
            <IconButton onClick={fetchAll} size="small" sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1.5 }}>
              <Refresh fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Exportar listado a CSV">
            <IconButton onClick={exportCSV} size="small" sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1.5 }}>
              <FileDownload fontSize="small" />
            </IconButton>
          </Tooltip>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={handleNewTercero}
            sx={{
              background: `linear-gradient(135deg, ${ACCENT}, #60a5fa)`,
              boxShadow: `0 4px 14px rgba(59,130,246,0.35)`,
              borderRadius: 2, fontWeight: 600,
            }}
          >
            Nuevo Tercero
          </Button>
        </Box>
      </Box>

      {/* ── KPIs ── */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={6} sm={3}>
          <KpiCard
            label="Clientes"
            value={stats.totalClientes}
            icon={<People />}
            color={ACCENT}
            loading={loadingStats}
            sub={`${clientes.filter(c => c.es_cliente && c.cupo_credito > 0).length} con crédito`}
          />
        </Grid>
        <Grid item xs={6} sm={3}>
          <KpiCard
            label="Proveedores"
            value={stats.totalProveedores}
            icon={<AccountBalance />}
            color={GREEN}
            loading={loadingStats}
          />
        </Grid>
        <Grid item xs={6} sm={3}>
          <KpiCard
            label="Cuentas por cobrar"
            value={cuentasPorCobrar.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })}
            icon={<TrendingUp />}
            color={RED}
            loading={loadingStats}
          />
        </Grid>
        <Grid item xs={6} sm={3}>
          <KpiCard
            label="Duales (C + P)"
            value={stats.totalDuales}
            icon={<Handshake />}
            color={PURPLE}
            loading={loadingStats}
            sub="cliente y proveedor"
          />
        </Grid>
      </Grid>

      {/* ── Formulario colapsable ── */}
      {formOpen && (
        <Box sx={{ mb: 3 }}>
          <ClienteForm
            clienteToEdit={clienteToEdit}
            onClienteAdded={handleSuccess}
            onClienteUpdated={handleSuccess}
            forceOpen={formOpen}
            onClose={() => { setFormOpen(false); setClienteToEdit(null); }}
          />
        </Box>
      )}

      {/* ── Tabs ── */}
      <Paper sx={{ borderRadius: 3, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          variant={isMobile ? 'fullWidth' : 'standard'}
          scrollButtons={false}
          sx={{
            px: isMobile ? 0 : 2,
            borderBottom: '1px solid', borderColor: 'divider',
            '& .MuiTab-root': {
              fontWeight: 600,
              fontSize: isMobile ? 11 : 13,
              textTransform: 'none',
              minHeight: isMobile ? 44 : 52,
              minWidth: 0,
              px: isMobile ? 0.5 : 2,
            },
            '& .MuiTabs-indicator': { backgroundColor: ACCENT, height: 3, borderRadius: 3 },
            '& .Mui-selected': { color: `${ACCENT} !important` },
          }}
        >
          <Tab label="👥 Clientes" />
          <Tab label="🏭 Proveedores" />
          <Tab label="💰 Por Cobrar" />
        </Tabs>

        <TabPanel value={tab} index={0}>
          <Box sx={{ px: { xs: 2, md: 3 }, pb: 3 }}>
            <ClienteList
              filterType="cliente"
              onEditCliente={handleEdit}
              onClienteDeleted={fetchAll}
              accentColor={ACCENT}
              clientes={clientes}
              loading={loadingClientes}
            />
          </Box>
        </TabPanel>

        <TabPanel value={tab} index={1}>
          <Box sx={{ px: { xs: 2, md: 3 }, pb: 3 }}>
            <ClienteList
              filterType="proveedor"
              onEditCliente={handleEdit}
              onClienteDeleted={fetchAll}
              accentColor={ACCENT}
              clientes={clientes}
              loading={loadingClientes}
            />
          </Box>
        </TabPanel>

        <TabPanel value={tab} index={2}>
          <Box sx={{ px: { xs: 1.5, md: 3 }, pb: 3 }}>
            <CuentasPorCobrar key={`cxc`} />
          </Box>
        </TabPanel>
      </Paper>
    </Box>
  );
}
