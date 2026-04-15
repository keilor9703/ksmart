import React, { useState } from 'react';
import { 
  Box, Typography, Tabs, Tab, Button, Grid, Paper,
  useTheme, useMediaQuery 
} from '@mui/material';
import { People, Add, AccountBalance, TrendingUp } from '@mui/icons-material';
import ClienteForm from './ClienteForm';
import ClienteList from './ClienteList';
import CuentasPorCobrar from './CuentasPorCobrar';

const ACCENT = '#3B82F6';

function TabPanel({ children, value, index }) {
  return (
    <div role="tabpanel" hidden={value !== index}>
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
}

// ── KPI Card (igual que Compras) ──
const KpiCard = ({ label, value, icon, color }) => (
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
        {value}
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

  // ── Datos de ejemplo para KPIs (deberías traerlos del backend) ──
  const [stats, setStats] = useState({
    totalClientes: 3,
    totalProveedores: 1,
    cuentasPorCobrar: 4000
  });

  const handleEdit = (cliente) => {
    setClienteToEdit(cliente);
    setFormOpen(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSuccess = () => {
    setClienteToEdit(null);
    setRefreshList(prev => prev + 1);
    setFormOpen(false);
  };

  const handleNewTercero = () => {
    setClienteToEdit(null);
    setFormOpen(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <Box sx={{ width: '100%' }}>

      {/* ── Header compacto (IGUAL QUE COMPRAS) ── */}
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

      {/* ── KPIs (IGUAL QUE COMPRAS) ── */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={4}>
          <KpiCard 
            label="Total clientes" 
            value={stats.totalClientes} 
            icon={<People />} 
            color={ACCENT} 
          />
        </Grid>
        <Grid item xs={12} sm={4}>
          <KpiCard 
            label="Proveedores activos" 
            value={stats.totalProveedores} 
            icon={<AccountBalance />} 
            color="#10B981" 
          />
        </Grid>
        <Grid item xs={12} sm={4}>
          <KpiCard 
            label="Cuentas por cobrar" 
            value={`$${stats.cuentasPorCobrar.toLocaleString()}`} 
            icon={<TrendingUp />} 
            color="#EF4444" 
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

      {/* ── Tabs Container (IGUAL QUE COMPRAS) ── */}
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
            <CuentasPorCobrar />
          </Box>
        </TabPanel>
      </Paper>
    </Box>
  );
}