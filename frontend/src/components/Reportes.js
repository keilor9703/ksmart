import React, { useState } from 'react';
import { Box, Typography, Tabs, Tab, useMediaQuery } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  Assessment, ShoppingCart, TrendingUp, People,
  AccountBalanceWallet, Engineering, Receipt
} from '@mui/icons-material';
import ResumenVentas from './ResumenVentas';
import ProductSales from './ProductSales';
import CustomerBuyers from './CustomerBuyers';
import CustomerDebtors from './CustomerDebtors';
import RentabilidadReporte from './RentabilidadReporte';
import ReporteProductividad from './ReporteProductividad';
import ReporteIVA from './ReporteIVA';

const ACCENT = '#F43F5E';

function TabPanel({ children, value, index }) {
  return (
    <div role="tabpanel" hidden={value !== index}>
      {value === index && (
        <Box sx={{ pt: 2, width: '100%', maxWidth: '100%', overflowX: 'hidden', boxSizing: 'border-box' }}>
          {children}
        </Box>
      )}
    </div>
  );
}

// Labels completos para desktop, cortos para mobile
const TABS = [
  { label: 'Resumen General',   short: 'Resumen',      icon: <Assessment fontSize="small" />           },
  { label: 'Ventas x Producto', short: 'Ventas',       icon: <ShoppingCart fontSize="small" />         },
  { label: 'Rentabilidad',      short: 'Rentab.',      icon: <TrendingUp fontSize="small" />           },
  { label: 'Ventas x Cliente',  short: 'Clientes',     icon: <People fontSize="small" />               },
  { label: 'Deudores',          short: 'Deudores',     icon: <AccountBalanceWallet fontSize="small" /> },
  { label: 'Productividad',     short: 'Product.',     icon: <Engineering fontSize="small" />          },
  { label: 'IVA / Impuestos',   short: 'IVA',          icon: <Receipt fontSize="small" />             },
];

const Reportes = () => {
  const [tab, setTab] = useState(0);
  const isMobile = useMediaQuery(useTheme().breakpoints.down('sm'));

  return (
    <Box sx={{ width: '100%', maxWidth: '100%', overflowX: 'hidden', boxSizing: 'border-box' }}>

      {/* ── Header ── */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
        <Box sx={{
          width: 38, height: 38, borderRadius: 2, flexShrink: 0,
          bgcolor: `${ACCENT}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: ACCENT,
        }}>
          <Assessment />
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontWeight: 700, fontSize: 18, lineHeight: 1.2 }}>Reportes</Typography>
          <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>Análisis financiero, ventas y productividad</Typography>
        </Box>
      </Box>

      {/* ── Contenedor de tabs — sin overflow:hidden ── */}
      <Box sx={{
        borderRadius: 3,
        boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
        border: '1px solid', borderColor: 'divider',
        bgcolor: 'background.paper',
        width: '100%', boxSizing: 'border-box',
      }}>
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          variant="scrollable"
          scrollButtons="auto"
          allowScrollButtonsMobile
          sx={{
            borderBottom: '1px solid', borderColor: 'divider',
            '& .MuiTab-root': {
              fontWeight: 600,
              fontSize: isMobile ? 11 : 12.5,
              textTransform: 'none',
              minHeight: isMobile ? 44 : 52,
              gap: 0.6,
              px: isMobile ? 1 : 2,
            },
            '& .MuiTabs-indicator': { backgroundColor: ACCENT, height: 3, borderRadius: 3 },
            '& .Mui-selected': { color: `${ACCENT} !important` },
          }}
        >
          {TABS.map((t, i) => (
            <Tab
              key={i}
              icon={t.icon}
              iconPosition="start"
              label={isMobile ? t.short : t.label}
            />
          ))}
        </Tabs>

        <Box sx={{ p: { xs: 1.5, md: 3 } }}>
          <TabPanel value={tab} index={0}><ResumenVentas        accentColor={ACCENT} /></TabPanel>
          <TabPanel value={tab} index={1}><ProductSales         accentColor={ACCENT} /></TabPanel>
          <TabPanel value={tab} index={2}><RentabilidadReporte  accentColor={ACCENT} /></TabPanel>
          <TabPanel value={tab} index={3}><CustomerBuyers       accentColor={ACCENT} /></TabPanel>
          <TabPanel value={tab} index={4}><CustomerDebtors      accentColor={ACCENT} /></TabPanel>
          <TabPanel value={tab} index={5}><ReporteProductividad accentColor={ACCENT} /></TabPanel>
          <TabPanel value={tab} index={6}><ReporteIVA           accentColor={ACCENT} /></TabPanel>
        </Box>
      </Box>
    </Box>
  );
};

export default Reportes;
