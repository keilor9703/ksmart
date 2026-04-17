import React, { useState, useEffect, useMemo } from 'react';
import { Box, Typography, Tabs, Tab, useMediaQuery, CircularProgress } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  Assessment, ShoppingCart, TrendingUp, People,
  AccountBalanceWallet, Engineering, Receipt, AttachMoney
} from '@mui/icons-material'; 
import ResumenVentas from './ResumenVentas';
import ProductSales from './ProductSales';
import CustomerBuyers from './CustomerBuyers';
import CustomerDebtors from './CustomerDebtors';
import RentabilidadReporte from './RentabilidadReporte';
import ReporteProductividad from './ReporteProductividad';
import ReporteIVA from './ReporteIVA';
import ReportePrestamos from './ReportePrestamos';
import apiClient from '../api';

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

const TABS_ERP = [
  { label: 'Resumen',       icon: <Assessment fontSize="small" />,           fullLabel: 'Resumen General'   },
  { label: 'Ventas',        icon: <ShoppingCart fontSize="small" />,         fullLabel: 'Ventas x Producto' },
  { label: 'Rentab.',       icon: <TrendingUp fontSize="small" />,           fullLabel: 'Rentabilidad'      },
  { label: 'Clientes',      icon: <People fontSize="small" />,               fullLabel: 'Ventas x Cliente'  },
  { label: 'Deudores',      icon: <AccountBalanceWallet fontSize="small" />, fullLabel: 'Deudores'          },
  { label: 'Product.',      icon: <Engineering fontSize="small" />,          fullLabel: 'Productividad'     },
  { label: 'IVA',           icon: <Receipt fontSize="small" />,              fullLabel: 'IVA / Impuestos'   },
];

const Reportes = () => {
  const [tab, setTab] = useState(0);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  useEffect(() => {
    apiClient.get('/users/me')
      .then(res => setUser(res.data))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  const esPrestamista = useMemo(() => {
    const mods = user?.empresa?.modulos_habilitados || [];
    return mods.includes('/prestamos') && !mods.includes('/ventas');
  }, [user]);

  if (loading) return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
      <CircularProgress sx={{ color: ACCENT }} />
    </Box>
  );

  return (
    <Box sx={{ width: '100%', maxWidth: '100%', overflowX: 'hidden', boxSizing: 'border-box' }}>

      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
        <Box sx={{ width: 38, height: 38, borderRadius: 2, flexShrink: 0, bgcolor: `${ACCENT}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: ACCENT }}>
          {esPrestamista ? <AttachMoney /> : <Assessment />}
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontWeight: 700, fontSize: 18, lineHeight: 1.2 }}>
            {esPrestamista ? 'Análisis de Cartera' : 'Reportes'}
          </Typography>
          <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
            {esPrestamista ? 'Rendimiento de préstamos e intereses' : 'Análisis financiero, ventas y productividad'}
          </Typography>
        </Box>
      </Box>

      {/* Contenedor dinámico */}
      <Box sx={{ 
        borderRadius: 3, 
        boxShadow: '0 2px 12px rgba(0,0,0,0.06)', 
        border: '1px solid', 
        borderColor: 'divider', 
        bgcolor: 'background.paper', 
        width: '100%', 
        boxSizing: 'border-box' 
      }}>

        {esPrestamista ? (
          /* VISTA PARA PRESTAMISTAS (Directo al reporte financiero) */
          <Box sx={{ p: { xs: 1.5, md: 3 } }}>
             <ReportePrestamos />
          </Box>
        ) : (
          /* VISTA PARA ERP COMERCIAL (Con Tabs) */
          <>
            <Tabs
              value={tab}
              onChange={(_, v) => setTab(v)}
              variant={isMobile ? 'fullWidth' : 'scrollable'}
              scrollButtons={isMobile ? false : 'auto'}
              sx={{
                borderBottom: '1px solid', borderColor: 'divider',
                '& .MuiTab-root': {
                  fontWeight: 600,
                  fontSize: 11,
                  textTransform: 'none',
                  minHeight: isMobile ? 48 : 52,
                  minWidth: isMobile ? 0 : 'auto',
                  px: isMobile ? 0.5 : 2,
                },
                '& .MuiTabs-indicator': { backgroundColor: ACCENT, height: 3, borderRadius: 3 },
                '& .Mui-selected': { color: `${ACCENT} !important` },
              }}
            >
              {TABS_ERP.map((t, i) => (
                <Tab
                  key={i}
                  icon={t.icon}
                  iconPosition={isMobile ? 'top' : 'start'}
                  label={isMobile ? undefined : t.label}
                  title={t.fullLabel}
                  sx={isMobile ? { gap: 0, '& .MuiTab-iconWrapper': { mb: 0 } } : { gap: 0.6 }}
                />
              ))}
            </Tabs>

            {isMobile && (
              <Box sx={{ px: 2, pt: 1.5, pb: 0.5 }}>
                <Typography sx={{ fontWeight: 700, fontSize: 13, color: ACCENT }}>
                  {TABS_ERP[tab].fullLabel}
                </Typography>
              </Box>
            )}

            <Box sx={{ p: { xs: 1.5, md: 3 } }}>
              <TabPanel value={tab} index={0}><ResumenVentas        accentColor={ACCENT} /></TabPanel>
              <TabPanel value={tab} index={1}><ProductSales         accentColor={ACCENT} /></TabPanel>
              <TabPanel value={tab} index={2}><RentabilidadReporte  accentColor={ACCENT} /></TabPanel>
              <TabPanel value={tab} index={3}><CustomerBuyers       accentColor={ACCENT} /></TabPanel>
              <TabPanel value={tab} index={4}><CustomerDebtors      accentColor={ACCENT} /></TabPanel>
              <TabPanel value={tab} index={5}><ReporteProductividad accentColor={ACCENT} /></TabPanel>
              <TabPanel value={tab} index={6}><ReporteIVA           accentColor={ACCENT} /></TabPanel>
            </Box>
          </>
        )}
      </Box>
    </Box>
  );
};

export default Reportes;