import React, { useState } from 'react';
import { Box, Paper, Tabs, Tab, Typography } from '@mui/material';
import InventoryIcon from '@mui/icons-material/Inventory';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import ProductoList from './ProductoList';
import ProductoForm from './ProductoForm';
import Recetas from './Recetas';

function TabPanel({ children, value, index }) {
  return (
    <div role="tabpanel" hidden={value !== index}>
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

const Productos = () => {
    const [tab, setTab] = useState(0);
    const [key, setKey] = useState(0);
    const [editingProducto, setEditingProducto] = useState(null);

    const handleRefresh = () => {
        setKey(prev => prev + 1);
        setEditingProducto(null);
    };

    const handleEditProducto = (producto) => {
        setEditingProducto(producto);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    return (
        <Box>
            <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
                <InventoryIcon sx={{ mr: 1, color: 'primary.main' }} />
                <Typography variant="h5" fontWeight="bold">Catálogo y Fórmulas</Typography>
            </Box>

            <Paper sx={{ mb: 0 }}>
                <Tabs 
                    value={tab} 
                    onChange={(_, v) => setTab(v)} 
                    indicatorColor="primary" 
                    textColor="primary"
                >
                    <Tab label="Productos y Servicios" icon={<InventoryIcon />} iconPosition="start" />
                    <Tab label="Recetas (BOM)" icon={<ReceiptLongIcon />} iconPosition="start" />
                </Tabs>
            </Paper>

            <TabPanel value={tab} index={0}>
                <ProductoForm 
                    onProductoAdded={handleRefresh} 
                    productoToEdit={editingProducto}
                    onProductoUpdated={handleRefresh}
                />
                <ProductoList 
                    key={key} 
                    onEditProducto={handleEditProducto}
                    onProductoDeleted={handleRefresh}
                />
            </TabPanel>

            <TabPanel value={tab} index={1}>
                <Recetas />
            </TabPanel>
        </Box>
    );
};

export default Productos;
