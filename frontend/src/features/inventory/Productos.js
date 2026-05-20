import React, { useState } from 'react';
import { Box, Typography, Tabs, Tab, Button } from '@mui/material';
import { Inventory, ReceiptLong, Add, QrCodeScanner } from '@mui/icons-material';
import ProductoList from './ProductoList';
import ProductoForm from './ProductoForm';
import Recetas from '../production/Recetas';
import AgileBarcodeRegistration from './AgileBarcodeRegistration';
import HelpGuideTopBar from '../../components/onboarding/HelpGuideTopBar';
import SmartTooltip from '../../components/onboarding/SmartTooltip';

const ACCENT = '#8B5CF6'; // violeta — color semántico para Productos

function TabPanel({ children, value, index }) {
  return (
    <div role="tabpanel" hidden={value !== index}>
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
}

const Productos = () => {
  const [tab, setTab]                       = useState(0);
  const [key, setKey]                       = useState(0);
  const [editingProducto, setEditingProducto] = useState(null);
  const [formOpen, setFormOpen]             = useState(false);
  const [agileOpen, setAgileOpen]           = useState(false);

  const productSteps = [
    { title: 'Gestión de Ítems', description: 'Crea productos físicos o servicios intangibles con precios y costos.' },
    { title: 'Modo Ágil', description: 'Usa el escáner de barras para registrar múltiples productos rápidamente.' },
    { title: 'Recetas (BOM)', description: 'Define fórmulas de producción para productos compuestos.' },
    { title: 'Catálogo Virtual', description: 'Activa la visibilidad de tus productos para que aparezcan en tu tienda online.' }
  ];

  const handleRefresh = () => { setKey(p => p + 1); setEditingProducto(null); setFormOpen(false); };

  const handleEditProducto = (producto) => {
    setEditingProducto(producto);
    setFormOpen(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNewProducto = () => {
    setEditingProducto(null);
    setFormOpen(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <Box sx={{ width: '100%', maxWidth: '100%', overflowX: 'hidden' }}>

      {/* ── Header ── */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, flexWrap: 'wrap', gap: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
          <Box sx={{ width: 40, height: 40, borderRadius: 2, flexShrink: 0, bgcolor: `${ACCENT}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: ACCENT }}>
            <Inventory />
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography sx={{ fontWeight: 700, fontSize: 19, lineHeight: 1.2 }}>Productos</Typography>
              <HelpGuideTopBar
                moduleName="Productos"
                steps={productSteps}
                faqItems={[
                  { q: '¿Qué son las "Unidades por empaque"?', a: 'Si compras una caja de 12 unidades, ingresa el costo de la caja completa y escribe 12 en este campo. El sistema calculará el costo por unidad automáticamente para las recetas.' },
                  { q: '¿Qué es el stock mínimo?', a: 'Es el umbral de alerta. Cuando el stock actual baje de ese número, el sistema generará una advertencia para que sepas que necesitas reabastecer.' },
                  { q: '¿Cuál es la diferencia entre producto y servicio?', a: 'Los productos físicos controlan stock (entradas y salidas). Los servicios son intangibles: no llevan inventario, solo precio y descripción.' },
                  { q: '¿Cómo agrego el código de barras a un producto?', a: 'En el formulario, busca el campo "Código de barras" e ingresa el código manualmente o usa un lector USB para escanearlo directamente en el campo.' },
                ]}
              />
            </Box>
            <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>Catálogo, servicios y fórmulas de producción</Typography>
          </Box>
        </Box>
        {tab === 0 && (
          <Box sx={{ display: 'flex', gap: 1.5 }}>
            <SmartTooltip 
              id="prod_agile_mode" 
              title="Registro Veloz" 
              description="Ideal para inventariar mucha mercancía usando solo el lector de barras."
            >
              <Button
                variant="outlined" startIcon={<QrCodeScanner />}
                onClick={() => setAgileOpen(true)}
                sx={{ borderRadius: 2, fontWeight: 600, color: '#10B981', borderColor: '#10B981', '&:hover': { borderColor: '#059669', bgcolor: '#10B98108' } }}
              >
                Modo Ágil
              </Button>
            </SmartTooltip>
            
            <SmartTooltip 
              id="prod_new_btn" 
              title="Nuevo Ítem" 
              description="Crea un producto desde cero con todos sus detalles técnicos."
            >
              <Button
                variant="contained" startIcon={<Add />}
                onClick={handleNewProducto}
                sx={{ background: `linear-gradient(135deg, ${ACCENT}, #a78bfa)`, boxShadow: `0 4px 14px rgba(139,92,246,0.35)`, borderRadius: 2, fontWeight: 600, flexShrink: 0 }}
              >
                Nuevo Producto
              </Button>
            </SmartTooltip>
          </Box>
        )}
      </Box>

      {/* ── MODO ÁGIL (MODAL FULLSCREEN) ── */}
      <AgileBarcodeRegistration 
        open={agileOpen} 
        onClose={() => setAgileOpen(false)} 
        onProductoAdded={handleRefresh} 
      />

      {/* ── Tabs ── */}
      <Box sx={{ borderRadius: 3, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', border: '1px solid', borderColor: 'divider', bgcolor: 'background.paper', width: '100%' }}>
        <Tabs
          value={tab} onChange={(_, v) => setTab(v)}
          variant="scrollable" scrollButtons="auto"
          sx={{
            px: { xs: 1, md: 2 }, borderBottom: '1px solid', borderColor: 'divider',
            '& .MuiTab-root': { fontWeight: 600, fontSize: 13, textTransform: 'none', minHeight: 48, gap: 0.8 },
            '& .MuiTabs-indicator': { backgroundColor: ACCENT, height: 3, borderRadius: 3 },
            '& .Mui-selected': { color: `${ACCENT} !important` },
          }}
        >
          <Tab icon={<Inventory fontSize="small" />} iconPosition="start" label="Productos y Servicios" />
          <Tab icon={<ReceiptLong fontSize="small" />} iconPosition="start" label="Recetas (BOM)" />
        </Tabs>

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
        </Box>
      </Box>
    </Box>
  );
};

export default Productos;
