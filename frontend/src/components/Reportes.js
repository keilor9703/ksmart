import React, { useState } from 'react';
import { Box, Typography, Tabs, Tab } from '@mui/material';
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
        <Box sx={{ pt: 3, width: '100%', maxWidth: '100%', overflowX: 'hidden' }}>
          {children}
        </Box>
      )}
    </div>
  );
}

const TABS = [
  { label: 'Resumen General',   icon: <Assessment fontSize="small" />        },
  { label: 'Ventas x Producto', icon: <ShoppingCart fontSize="small" />      },
  { label: 'Rentabilidad',      icon: <TrendingUp fontSize="small" />        },
  { label: 'Ventas x Cliente',  icon: <People fontSize="small" />            },
  { label: 'Deudores',          icon: <AccountBalanceWallet fontSize="small" /> },
  { label: 'Productividad',     icon: <Engineering fontSize="small" />       },
  { label: 'IVA / Impuestos',   icon: <Receipt fontSize="small" />          },
];

const Reportes = () => {
  const [tab, setTab] = useState(0);

  return (
    <Box sx={{ width: '100%' }}>

      {/* ── Header ── */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
        <Box sx={{ width: 40, height: 40, borderRadius: 2, bgcolor: `${ACCENT}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: ACCENT }}>
          <Assessment />
        </Box>
        <Box>
          <Typography sx={{ fontWeight: 700, fontSize: 20, lineHeight: 1.2 }}>Reportes</Typography>
          <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>Análisis financiero, ventas y productividad</Typography>
        </Box>
      </Box>

      {/* ── Tabs ── */}
      <Box sx={{ borderRadius: 3, overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', border: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}>
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            px: 1,
            borderBottom: '1px solid', borderColor: 'divider',
            '& .MuiTab-root': { fontWeight: 600, fontSize: 12.5, textTransform: 'none', minHeight: 52, gap: 0.8 },
            '& .MuiTabs-indicator': { backgroundColor: ACCENT, height: 3, borderRadius: 3 },
            '& .Mui-selected': { color: `${ACCENT} !important` },
          }}
        >
          {TABS.map((t, i) => (
            <Tab key={i} icon={t.icon} iconPosition="start" label={t.label} />
          ))}
        </Tabs>

        <Box sx={{ p: { xs: 2, md: 3 } }}>
          <TabPanel value={tab} index={0}><ResumenVentas       accentColor={ACCENT} /></TabPanel>
          <TabPanel value={tab} index={1}><ProductSales        accentColor={ACCENT} /></TabPanel>
          <TabPanel value={tab} index={2}><RentabilidadReporte accentColor={ACCENT} /></TabPanel>
          <TabPanel value={tab} index={3}><CustomerBuyers      accentColor={ACCENT} /></TabPanel>
          <TabPanel value={tab} index={4}><CustomerDebtors     accentColor={ACCENT} /></TabPanel>
          <TabPanel value={tab} index={5}><ReporteProductividad accentColor={ACCENT} /></TabPanel>
          <TabPanel value={tab} index={6}><ReporteIVA          accentColor={ACCENT} /></TabPanel>
        </Box>
      </Box>
    </Box>
  );
};

export default Reportes;
