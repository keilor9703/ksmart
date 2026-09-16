import React, { useState } from 'react';
import { Box, Typography, Tabs, Tab, Button, useTheme } from '@mui/material';
import { Inventory, ReceiptLong, Add, Percent, TrendingUp } from '@mui/icons-material';
import ProductoList from './ProductoList';
import ProductoForm from './ProductoForm';
import Recetas from '../production/Recetas';
import TiposImpuesto from './TiposImpuesto';
import HelpGuideTopBar from '../../components/onboarding/HelpGuideTopBar';
import SmartTooltip from '../../components/onboarding/SmartTooltip';

const ACCENT   = '#7C3AED';   // violeta profundo
const ACCENT2  = '#4F46E5';   // indigo complementario
const GLOW     = 'rgba(124,58,237,0.18)';

function TabPanel({ children, value, index }) {
  return (
    <div role="tabpanel" hidden={value !== index}>
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
}

// ─── Tab icon wrapper con color activo ───────────────────────────────────────
const TabIconBox = ({ icon, active }) => (
  <Box sx={{
    width: 28, height: 28, borderRadius: 1.5,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    bgcolor: active ? `${ACCENT}22` : 'transparent',
    color: active ? ACCENT : 'text.secondary',
    transition: 'all 0.2s',
    mr: 0.8,
    flexShrink: 0,
  }}>
    {icon}
  </Box>
);

const Productos = () => {
  const theme  = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const [tab, setTab]                       = useState(0);
  const [key, setKey]                       = useState(0);
  const [editingProducto, setEditingProducto] = useState(null);
  const [formOpen, setFormOpen]             = useState(false);

  const productSteps = [
    { title: 'Gestión de Ítems', description: 'Crea productos físicos o servicios intangibles con precios y costos.' },
    { title: 'Registro con Cámara', description: 'En el formulario, activa la cámara para escanear el código de barras y llenar los campos automáticamente.' },
    { title: 'Recetas (BOM)', description: 'Define fórmulas de producción para productos compuestos.' },
    { title: 'Catálogo Virtual', description: 'Activa la visibilidad de tus productos para que aparezcan en tu tienda online.' }
  ];

  const handleRefresh       = () => { setKey(p => p + 1); setEditingProducto(null); setFormOpen(false); };
  const handleEditProducto  = (producto) => { setEditingProducto(producto); setFormOpen(true); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const handleNewProducto   = () => { setEditingProducto(null); setFormOpen(true); window.scrollTo({ top: 0, behavior: 'smooth' }); };

  const TABS = [
    { label: 'Catálogo', icon: <Inventory fontSize="small" /> },
    { label: 'Recetas (BOM)', icon: <ReceiptLong fontSize="small" /> },
    { label: 'Impuestos', icon: <Percent fontSize="small" /> },
  ];

  return (
    <Box sx={{ width: '100%', maxWidth: '100%', overflowX: 'hidden' }}>

      {/* ══ HERO HEADER ══════════════════════════════════════════════════════════ */}
      <Box sx={{
        position: 'relative',
        borderRadius: 4,
        overflow: 'hidden',
        mb: 3,
        background: isDark
          ? `linear-gradient(135deg, #1E1B4B 0%, #312E81 45%, #1E1B4B 100%)`
          : `linear-gradient(135deg, ${ACCENT} 0%, ${ACCENT2} 60%, #7E22CE 100%)`,
        p: { xs: 2.5, md: 3.5 },
        // decorative circles
        '&::before': {
          content: '""', position: 'absolute',
          width: 320, height: 320, borderRadius: '50%',
          background: 'rgba(255,255,255,0.06)',
          top: -100, right: -60,
        },
        '&::after': {
          content: '""', position: 'absolute',
          width: 200, height: 200, borderRadius: '50%',
          background: 'rgba(255,255,255,0.04)',
          bottom: -80, left: '30%',
        },
      }}>
        <Box sx={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {/* Icon */}
            <Box sx={{
              width: 52, height: 52, borderRadius: 3, flexShrink: 0,
              bgcolor: 'rgba(255,255,255,0.15)',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255,255,255,0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
            }}>
              <Inventory sx={{ color: '#fff', fontSize: 26 }} />
            </Box>

            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Typography sx={{ fontWeight: 800, fontSize: { xs: 20, md: 24 }, color: '#fff', letterSpacing: -0.5, lineHeight: 1.1 }}>
                  Productos
                </Typography>
                <HelpGuideTopBar
                  moduleName="Productos"
                  steps={productSteps}
                  faqItems={[
                    { q: '¿Qué son las "Unidades por empaque"?', a: 'Si compras una caja de 12 unidades, ingresa el costo de la caja completa y escribe 12 en este campo. El sistema calculará el costo por unidad automáticamente para las recetas.' },
                    { q: '¿Qué es el stock mínimo?', a: 'Es el umbral de alerta. Cuando el stock actual baje de ese número, el sistema generará una advertencia para que sepas que necesitas reabastecer.' },
                    { q: '¿Cuál es la diferencia entre producto y servicio?', a: 'Los productos físicos controlan stock (entradas y salidas). Los servicios son intangibles: no llevan inventario, solo precio y descripción.' },
                    { q: '¿Cómo agrego el código de barras a un producto?', a: 'En el formulario, busca el campo "Código de barras": puedes escribirlo, usar un lector USB, o pulsar el ícono de cámara para escanearlo y que el sistema llene los datos automáticamente.' },
                  ]}
                />
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                <TrendingUp sx={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }} />
                <Typography sx={{ fontSize: 12.5, color: 'rgba(255,255,255,0.75)', fontWeight: 400 }}>
                  Catálogo · Servicios · Recetas de producción
                </Typography>
              </Box>
            </Box>
          </Box>

          {/* CTA */}
          {tab === 0 && (
            <SmartTooltip id="prod_new_btn" title="Nuevo Ítem" description="Crea un producto desde cero con todos sus detalles técnicos.">
              <Button
                variant="contained"
                startIcon={<Add />}
                onClick={handleNewProducto}
                sx={{
                  bgcolor: 'rgba(255,255,255,0.18)',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(255,255,255,0.35)',
                  color: '#fff',
                  fontWeight: 700,
                  borderRadius: 2.5,
                  px: 2.5,
                  py: 1,
                  fontSize: 13.5,
                  boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
                  flexShrink: 0,
                  transition: 'all 0.2s',
                  '&:hover': {
                    bgcolor: 'rgba(255,255,255,0.28)',
                    transform: 'translateY(-1px)',
                    boxShadow: '0 6px 24px rgba(0,0,0,0.3)',
                  },
                }}
              >
                Nuevo Producto
              </Button>
            </SmartTooltip>
          )}
        </Box>
      </Box>

      {/* ══ PANEL DE CONTENIDO ═══════════════════════════════════════════════════ */}
      <Box sx={{
        borderRadius: 4,
        border: '1px solid',
        borderColor: isDark ? 'rgba(124,58,237,0.2)' : 'rgba(124,58,237,0.1)',
        bgcolor: 'background.paper',
        overflow: 'hidden',
        boxShadow: isDark
          ? `0 0 0 1px rgba(124,58,237,0.1), 0 8px 32px rgba(0,0,0,0.4)`
          : `0 4px 24px rgba(124,58,237,0.08), 0 1px 4px rgba(0,0,0,0.04)`,
        width: '100%',
      }}>

        {/* Tabs */}
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            px: { xs: 1, md: 2 },
            borderBottom: '1px solid',
            borderColor: 'divider',
            bgcolor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(124,58,237,0.025)',
            minHeight: 52,
            '& .MuiTab-root': {
              fontWeight: 600,
              fontSize: 13.5,
              textTransform: 'none',
              minHeight: 52,
              gap: 0.5,
              color: 'text.secondary',
              transition: 'color 0.2s',
              px: { xs: 1.5, md: 2.5 },
            },
            '& .MuiTabs-indicator': {
              backgroundColor: ACCENT,
              height: 3,
              borderRadius: '3px 3px 0 0',
            },
            '& .Mui-selected': { color: `${ACCENT} !important`, fontWeight: 700 },
          }}
        >
          {TABS.map((t, i) => (
            <Tab
              key={i}
              icon={<TabIconBox icon={t.icon} active={tab === i} />}
              iconPosition="start"
              label={t.label}
            />
          ))}
        </Tabs>

        {/* Contenido de tabs */}
        <Box sx={{ p: { xs: 1.5, md: 3 } }}>
          <TabPanel value={tab} index={0}>
            <ProductoForm
              onProductoAdded={handleRefresh}
              productoToEdit={editingProducto}
              onProductoUpdated={handleRefresh}
              forceOpen={formOpen}
              onClose={() => { setFormOpen(false); setEditingProducto(null); }}
              accentColor={ACCENT}
            />
            <ProductoList key={key} onEditProducto={handleEditProducto} onProductoDeleted={handleRefresh} accentColor={ACCENT} />
          </TabPanel>
          <TabPanel value={tab} index={1}>
            <Recetas accentColor={ACCENT} />
          </TabPanel>
          <TabPanel value={tab} index={2}>
            <TiposImpuesto />
          </TabPanel>
        </Box>
      </Box>
    </Box>
  );
};

export default Productos;
