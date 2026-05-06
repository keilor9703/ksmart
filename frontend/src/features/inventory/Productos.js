import React, { useState } from 'react';
import { Box, Typography, Tabs, Tab, Button } from '@mui/material';
import { Inventory, ReceiptLong, Add, QrCodeScanner } from '@mui/icons-material';
import ProductoList from './ProductoList';
import ProductoForm from './ProductoForm';
import Recetas from '../production/Recetas';
import AgileBarcodeRegistration from './AgileBarcodeRegistration';

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
            <Typography sx={{ fontWeight: 700, fontSize: 19, lineHeight: 1.2 }}>Productos</Typography>
            <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>Catálogo, servicios y fórmulas de producción</Typography>
          </Box>
        </Box>
        {tab === 0 && (
          <Box sx={{ display: 'flex', gap: 1.5 }}>
            <Button
              variant="outlined" startIcon={<QrCodeScanner />}
              onClick={() => setAgileOpen(true)}
              sx={{ borderRadius: 2, fontWeight: 600, color: '#10B981', borderColor: '#10B981', '&:hover': { borderColor: '#059669', bgcolor: '#10B98108' } }}
            >
              Modo Ágil
            </Button>
            <Button
              variant="contained" startIcon={<Add />}
              onClick={handleNewProducto}
              sx={{ background: `linear-gradient(135deg, ${ACCENT}, #a78bfa)`, boxShadow: `0 4px 14px rgba(139,92,246,0.35)`, borderRadius: 2, fontWeight: 600, flexShrink: 0 }}
            >
              Nuevo Producto
            </Button>
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
