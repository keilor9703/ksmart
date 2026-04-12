import React, { useState } from 'react';
import { Box, Typography, Tabs, Tab, Button } from '@mui/material';
import { People, Add } from '@mui/icons-material';
import ClienteForm from './ClienteForm';
import ClienteList from './ClienteList';
import CuentasPorCobrar from './CuentasPorCobrar';

const ACCENT = '#3B82F6';

function TabPanel({ children, value, index }) {
  return (
    <div role="tabpanel" hidden={value !== index}>
      {value === index && <Box sx={{ pt: 2 }}>{children}</Box>}
    </div>
  );
}

export default function Terceros() {
  const [tab, setTab]                     = useState(0);
  const [clienteToEdit, setClienteToEdit] = useState(null);
  const [refreshList, setRefreshList]     = useState(0);
  const [formOpen, setFormOpen]           = useState(false);

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
    // width: 100% + overflow: hidden evita que cualquier hijo desborde la pantalla
    <Box sx={{ width: '100%', maxWidth: '100%', overflowX: 'hidden' }}>

      {/* ── Header ── */}
      <Box sx={{
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-between',
        mb: 2, flexWrap: 'wrap', gap: 1.5,
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{
            width: 40, height: 40, borderRadius: 2, flexShrink: 0,
            bgcolor: `${ACCENT}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: ACCENT,
          }}>
            <People />
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 700, fontSize: 19, lineHeight: 1.2 }}>Terceros</Typography>
            <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>Clientes, proveedores y cuentas por cobrar</Typography>
          </Box>
        </Box>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={handleNewTercero}
          sx={{
            background: `linear-gradient(135deg, ${ACCENT}, #60a5fa)`,
            boxShadow: `0 4px 14px rgba(59,130,246,0.35)`,
            borderRadius: 2, fontWeight: 600, flexShrink: 0,
          }}
        >
          Nuevo Tercero
        </Button>
      </Box>

      {/* ── Formulario colapsable ── */}
      {/* Siempre dentro del flujo normal, ancho 100% contenido */}
      <Box sx={{ width: '100%', mb: 2 }}>
        <ClienteForm
          clienteToEdit={clienteToEdit}
          onClienteAdded={handleSuccess}
          onClienteUpdated={handleSuccess}
          forceOpen={formOpen}
          onClose={() => { setFormOpen(false); setClienteToEdit(null); }}
        />
      </Box>

      {/* ── Tabs ── */}
      <Box sx={{
        borderRadius: 3,
        // NO overflow:hidden aquí — causa problemas de clip en mobile
        boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
        border: '1px solid', borderColor: 'divider',
        bgcolor: 'background.paper',
        width: '100%',
      }}>
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            px: { xs: 1, md: 2 },
            borderBottom: '1px solid', borderColor: 'divider',
            '& .MuiTab-root': { fontWeight: 600, fontSize: 13, textTransform: 'none', minHeight: 48 },
            '& .MuiTabs-indicator': { backgroundColor: ACCENT, height: 3, borderRadius: 3 },
            '& .Mui-selected': { color: `${ACCENT} !important` },
          }}
        >
          <Tab label="👥 Clientes" />
          <Tab label="🏭 Proveedores" />
          <Tab label="💰 Cuentas por Cobrar" />
          <Tab label="🏦 Bancos" disabled sx={{ opacity: 0.4 }} />
        </Tabs>

        <Box sx={{ p: { xs: 1.5, md: 3 } }}>
          <TabPanel value={tab} index={0}>
            <ClienteList
              key={`cli-${refreshList}`}
              filterType="cliente"
              onEditCliente={handleEdit}
              accentColor={ACCENT}
            />
          </TabPanel>

          <TabPanel value={tab} index={1}>
            <ClienteList
              key={`prov-${refreshList}`}
              filterType="proveedor"
              onEditCliente={handleEdit}
              accentColor={ACCENT}
            />
          </TabPanel>

          <TabPanel value={tab} index={2}>
            <CuentasPorCobrar />
          </TabPanel>
        </Box>
      </Box>
    </Box>
  );
}

