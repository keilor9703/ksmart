import React, { useState } from 'react';
import { Box, Tabs, Tab, Typography } from '@mui/material';
import ResumenVentas from './ResumenVentas';
import ProductSales from './ProductSales';
import CustomerBuyers from './CustomerBuyers';
import CustomerDebtors from './CustomerDebtors';
import RentabilidadReporte from './RentabilidadReporte';
import ReporteProductividad from './ReporteProductividad';
import ReporteIVA from './ReporteIVA';

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
                <Box 
                    sx={{ 
                        p: { xs: 1, sm: 3 },   // 👈 menos padding en móvil
                        width: '100%', 
                        maxWidth: '100%',      // 👈 asegura que no desborde
                        overflowX: 'hidden'    // 👈 evita scroll horizontal
                    }}
                >
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

const Reportes = () => {
    const [value, setValue] = useState(0);

    const handleChange = (event, newValue) => {
        setValue(newValue);
    };

    return (
        <Box sx={{ width: '100%' }}>
            <Typography variant="h4" gutterBottom color="text.primary">
                Reportes Detallados
            </Typography>
            <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
                <Tabs 
                    value={value} 
                    onChange={handleChange} 
                    aria-label="report tabs" 
                    variant="scrollable" 
                    scrollButtons="auto"
                >
                    <Tab label="Resumen General" {...a11yProps(0)} />
                    <Tab label="Ventas por Producto" {...a11yProps(1)} />
                    <Tab label="Rentabilidad" {...a11yProps(2)} />
                    <Tab label="Ventas por Cliente" {...a11yProps(3)} />
                    <Tab label="Cuentas por Cliente" {...a11yProps(4)} />
                    <Tab label="Productividad" {...a11yProps(5)} />
                    <Tab label="Impuestos (IVA)" {...a11yProps(6)} />
                </Tabs>
            </Box>

            <TabPanel value={value} index={0}>
                <ResumenVentas />
            </TabPanel>
            <TabPanel value={value} index={1}>
                <ProductSales />
            </TabPanel>
            <TabPanel value={value} index={2}>
                <RentabilidadReporte />
            </TabPanel>
            <TabPanel value={value} index={3}>
                <CustomerBuyers />
            </TabPanel>
            <TabPanel value={value} index={4}>
                <CustomerDebtors />
            </TabPanel>
            <TabPanel value={value} index={5}>
                <ReporteProductividad />
            </TabPanel>
            <TabPanel value={value} index={6}>
                <ReporteIVA />
            </TabPanel>
        </Box>
    );
};

export default Reportes;
