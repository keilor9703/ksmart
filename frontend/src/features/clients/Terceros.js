import React, { useState, useEffect } from 'react';
import { 
  Box, Typography, Tabs, Tab, Button, Grid, Paper,
  useTheme, useMediaQuery, CircularProgress 
} from '@mui/material';
import { People, Add, AccountBalance, TrendingUp } from '@mui/icons-material';
import ClienteForm from './ClienteForm';
import ClienteList from './ClienteList';
import CuentasPorCobrar from '../finance/CuentasPorCobrar';

// ✅ IMPORTACIONES DE GRADO COMERCIAL
import apiClient from '../../api';
import { toast } from 'react-toastify';

const ACCENT = '#3B82F6';

function TabPanel({ children, value, index }) {
  return (
    <div role="tabpanel" hidden={value !== index}>
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
}

// ── KPI Card (Mejorada con esqueleto/loading state) ──
const KpiCard = ({ label, value, icon, color, loading }) => (
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
      <Typography sx={{ fontSize: 18, fontWeight: 700, color: 'text.primary' }}>
        {loading ? <CircularProgress size={18} sx={{ color }} /> : value}
      </Typography>
    </Box>
  </Paper>
);

export default function Terceros() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [tab, setTab] = useState(0);
  const [clienteToEdit, setClienteToEdit] = useState(null);
  const [refreshList, setRefreshList] = useState(0);
  const [formOpen, setFormOpen] = useState(false);

  // ── Estados reales para los KPIs ──
  const [loadingStats, setLoadingStats] = useState(true);
  const [stats, setStats] = useState({
    totalClientes: 0,
    totalProveedores: 0,
    cuentasPorCobrar: 0
  });

  // ── FUNCIÓN DE EXTRACCIÓN PARALELA Y OPTIMIZADA ──
  const fetchStats = async () => {
    setLoadingStats(true);
    try {
      // Usamos Promise.all para evitar el bloqueo en cascada (N+1 Request Anti-pattern)
      const [clientesRes, dashboardRes] = await Promise.all([
        apiClient.get('/clientes/'),
        apiClient.get('/reportes/dashboard') // Aquí el backend ya calcula la cartera limpia
      ]);

      const clientesData = clientesRes.data || [];
      
      setStats({
        totalClientes: clientesData.filter(c => c.es_cliente).length,
        totalProveedores: clientesData.filter(c => c.es_proveedor).length,
        cuentasPorCobrar: dashboardRes.data?.cuentas_por_cobrar || 0
      });
    } catch (error) {
      console.error("Error al obtener estadísticas de terceros:", error);
      toast.error("Hubo un problema al cargar los indicadores.");
    } finally {
      setLoadingStats(false);
    }
  };

  // ── EFECTO REACTIVO: Se dispara al montar y cada vez que 'refreshList' cambie ──
  useEffect(() => {
    fetchStats();
  }, [refreshList]);

  const handleEdit = (cliente) => {
    setClienteToEdit(cliente);
    setFormOpen(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSuccess = () => {
    setClienteToEdit(null);
    setFormOpen(false);
    // Disparar la actualización de listas y KPIs simultáneamente
    setRefreshList(prev => prev + 1); 
  };

  const handleNewTercero = () => {
    setClienteToEdit(null);
    setFormOpen(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <Box sx={{ width: '100%' }}>

      {/* ── Header ── */}
      <Box sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        mb: 3, 
        flexWrap: 'wrap', 
        gap: 2 
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
        </Box>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={handleNewTercero}
          sx={{
            background: `linear-gradient(135deg, ${ACCENT}, #60a5fa)`,
            boxShadow: `0 4px 14px rgba(59,130,246,0.35)`,
            borderRadius: 2,
            fontWeight: 600,
          }}
        >
          Nuevo Tercero
        </Button>
      </Box>

      {/* ── KPIs DINÁMICOS ── */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={4}>
          <KpiCard 
            label="Total clientes" 
            value={stats.totalClientes} 
            icon={<People />} 
            color={ACCENT}
            loading={loadingStats}
          />
        </Grid>
        <Grid item xs={12} sm={4}>
          <KpiCard 
            label="Proveedores activos" 
            value={stats.totalProveedores} 
            icon={<AccountBalance />} 
            color="#10B981"
            loading={loadingStats}
          />
        </Grid>
        <Grid item xs={12} sm={4}>
          <KpiCard 
            label="Cuentas por cobrar" 
            // Formateo seguro para monedas (UX comercial)
            value={stats.cuentasPorCobrar.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })} 
            icon={<TrendingUp />} 
            color="#EF4444"
            loading={loadingStats}
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

      {/* ── Tabs Container ── */}
      <Paper sx={{ 
        borderRadius: 3, 
        boxShadow: '0 2px 12px rgba(0,0,0,0.06)', 
        overflow: 'hidden' 
      }}>
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          variant={isMobile ? 'scrollable' : 'standard'}
          scrollButtons="auto"
          sx={{
            px: 2,
            borderBottom: '1px solid',
            borderColor: 'divider',
            '& .MuiTab-root': {
              fontWeight: 600,
              fontSize: 13,
              textTransform: 'none',
              minHeight: 52
            },
            '& .MuiTabs-indicator': {
              backgroundColor: ACCENT,
              height: 3,
              borderRadius: 3
            },
            '& .Mui-selected': { color: `${ACCENT} !important` },
          }}
        >
          <Tab label="👥 Clientes" />
          <Tab label="🏭 Proveedores" />
          <Tab label="💰 Cuentas por Cobrar" />
        </Tabs>

        {/* ── Contenido de Tabs ── */}
        <TabPanel value={tab} index={0}>
          <Box sx={{ px: { xs: 2, md: 3 }, pb: 3 }}>
            <ClienteList
              key={`cli-${refreshList}`}
              filterType="cliente"
              onEditCliente={handleEdit}
              accentColor={ACCENT}
            />
          </Box>
        </TabPanel>

        <TabPanel value={tab} index={1}>
          <Box sx={{ px: { xs: 2, md: 3 }, pb: 3 }}>
            <ClienteList
              key={`prov-${refreshList}`}
              filterType="proveedor"
              onEditCliente={handleEdit}
              accentColor={ACCENT}
            />
          </Box>
        </TabPanel>

        <TabPanel value={tab} index={2}>
          <Box sx={{ px: { xs: 2, md: 3 }, pb: 3 }}>
            <CuentasPorCobrar key={`cxc-${refreshList}`} />
          </Box>
        </TabPanel>
      </Paper>
    </Box>
  );
}