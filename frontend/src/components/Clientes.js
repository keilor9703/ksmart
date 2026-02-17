import React, { useState } from 'react';
import ClienteList from './ClienteList';
import ClienteForm from './ClienteForm';
import ClienteAccountsReceivable from './ClienteAccountsReceivable'; // New import
import { Box, Tabs, Tab, Typography } from '@mui/material'; // New imports for Tabs
import BulkUpload from './BulkUpload';

// Helper component for TabPanel
function TabPanel(props) {
    const { children, value, index, ...other } = props;

    return (
        <div
            role="tabpanel"
            hidden={value !== index}
            id={`simple-tabpanel-${index}`}
            aria-labelledby={`simple-tab-${index}`}
            {...other}
        >
            {value === index && (
                <Box sx={{ p: 3 }}>
                    {children}
                </Box>
            )}
        </div>
    );
}

// Helper function for a11y props
function a11yProps(index) {
    return {
        id: `simple-tab-${index}`,
        'aria-controls': `simple-tabpanel-${index}`,
    };
}

const Clientes = () => {
    const [key, setKey] = useState(0); // Used to trigger re-fetch in ClienteList
    const [editingCliente, setEditingCliente] = useState(null);
    const [value, setValue] = useState(0); // State for tab selection

    const handleChange = (event, newValue) => {
        setValue(newValue);
    };

    const handleClienteAdded = () => {
        setKey(prevKey => prevKey + 1); // Force re-render of ClienteList
        setEditingCliente(null); // Clear editing state after add
    };

    const handleClienteUpdated = () => {
        setKey(prevKey => prevKey + 1); // Force re-render of ClienteList
        setEditingCliente(null); // Clear editing state after update
    };

    const handleClienteDeleted = () => {
        setKey(prevKey => prevKey + 1); // Force re-render of ClienteList
        setEditingCliente(null); // Clear editing state if deleted was being edited
    };

    const handleEditCliente = (cliente) => {
        setEditingCliente(cliente);
        setValue(0); // Switch to the "Gestión de Clientes" tab when editing
    };

    return (
        <Box sx={{ width: '100%' }}>
            <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                <Tabs value={value} onChange={handleChange} aria-label="client management tabs">
                    <Tab label="Gestión de Clientes" {...a11yProps(0)} />
                    <Tab label="Cuentas Pendientes por Cobrar" {...a11yProps(1)} />
                </Tabs>
            </Box>
            <TabPanel value={value} index={0}>
                {/* <BulkUpload uploadType="clientes" onUploadSuccess={handleClienteAdded} /> */}
                <ClienteForm
                    onClienteAdded={handleClienteAdded}
                    clienteToEdit={editingCliente}
                    onClienteUpdated={handleClienteUpdated}
                />
                <hr />
                <ClienteList
                    key={key}
                    onEditCliente={handleEditCliente}
                    onClienteDeleted={handleClienteDeleted}
                />
            </TabPanel>
            <TabPanel value={value} index={1}>
                <ClienteAccountsReceivable />
            </TabPanel>
        </Box>
    );
};

export default Clientes;
