import React, { useState } from "react";
import { Box, Paper, Typography, Tabs, Tab } from "@mui/material";
import PeopleIcon from "@mui/icons-material/People";
import ClienteForm from "./ClienteForm";
import ClienteList from "./ClienteList";
import CuentasPorCobrar from "./CuentasPorCobrar";
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';

function TabPanel({ children, value, index }) {
  return (
    <div role="tabpanel" hidden={value !== index}>
      {value === index && <Box sx={{ pt: 2 }}>{children}</Box>}
    </div>
  );
}

export default function Terceros() {
  const [tab, setTab] = useState(0);
  const [clienteToEdit, setClienteToEdit] = useState(null);
  const [refreshList, setRefreshList] = useState(0);

  const handleEdit = (cliente) => {
    setClienteToEdit(cliente);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSuccess = () => {
    setClienteToEdit(null);
    setRefreshList(prev => prev + 1);
  };

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
        <PeopleIcon sx={{ mr: 1, color: 'primary.main' }} />
        <Typography variant="h5" fontWeight="bold">Gestión de Terceros</Typography>
      </Box>

      <ClienteForm 
        clienteToEdit={clienteToEdit} 
        onClienteAdded={handleSuccess} 
        onClienteUpdated={handleSuccess} 
      />

      <Paper sx={{ mb: 3 }}>
        <Tabs 
          value={tab} 
          onChange={(_, v) => setTab(v)}
          indicatorColor="primary"
          textColor="primary"
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab label="Clientes" />
          <Tab label="Proveedores" />
          <Tab label="Cuentas por Cobrar" />
          <Tab label="Bancos (Próximamente)" icon={<AccountBalanceIcon />} iconPosition="start" disabled />
        </Tabs>
      </Paper>

      <TabPanel value={tab} index={0}>
        <ClienteList key={`cli-${refreshList}`} filterType="cliente" onEditCliente={handleEdit} />
      </TabPanel>

      <TabPanel value={tab} index={1}>
        <ClienteList key={`prov-${refreshList}`} filterType="proveedor" onEditCliente={handleEdit} />
      </TabPanel>

      <TabPanel value={tab} index={2}>
        <CuentasPorCobrar />
      </TabPanel>
    </Box>
  );
}
