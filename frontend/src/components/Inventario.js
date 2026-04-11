import React, { useState, useEffect, useMemo } from "react";
import {
  Box, Typography, Tabs, Tab, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Chip, TextField, TablePagination, useTheme, useMediaQuery,
  Paper, Grid, Divider, InputAdornment, Tooltip
} from "@mui/material";
import {
  Inventory2Outlined, Search, Warning, TrendingUp,
  AttachMoney, Category
} from "@mui/icons-material";
import apiClient from "../api";
import { formatCurrency } from "../utils/formatters";
import InventoryPage from "./InventoryPage";

const ACCENT = '#F59E0B'; // ámbar — color semántico de Inventarios

// ─── Config de grupos ─────────────────────────────────────────────────────────
const GRUPOS = [
  { id: 1, label: 'Materia Prima',      short: 'MP',  color: '#3B82F6' },
  { id: 2, label: 'Producto Terminado', short: 'PT',  color: '#10B981' },
  { id: 3, label: 'Activo Fijo',        short: 'AF',  color: '#F59E0B' },
  { id: 4, label: 'Insumos',            short: 'INS', color: '#8B5CF6' },
];

function TabPanel({ children, value, index }) {
  return (
    <div role="tabpanel" hidden={value !== index}>
      {value === index && <Box sx={{ pt: 2.5 }}>{children}</Box>}
    </div>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
const KpiCard = ({ label, value, icon, color, sub }) => (
  <Paper sx={{ p: 2, borderRadius: 2.5, display: 'flex', alignItems: 'center', gap: 1.5, boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
    <Box sx={{ width: 42, height: 42, borderRadius: 1.5, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: `${color}18`, color }}>
      {icon}
    </Box>
    <Box>
      <Typography sx={{ fontSize: 11, color: 'text.secondary', fontWeight: 500 }}>{label}</Typography>
      <Typography sx={{ fontSize: 17, fontWeight: 700, color: 'text.primary', lineHeight: 1.2 }}>{value}</Typography>
      {sub && <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{sub}</Typography>}
    </Box>
  </Paper>
);

// ─── Card mobile ──────────────────────────────────────────────────────────────
const StockCard = ({ producto }) => {
  const stock  = producto.stock_actual ?? 0;
  const minimo = producto.stock_minimo ?? 0;
  const low    = stock < minimo;
  const grupo  = GRUPOS.find(g => g.id === producto.grupo_item) || { short: '—', color: '#94a3b8' };

  return (
    <Paper sx={{ p: 2.5, mb: 2, borderRadius: 3, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ fontWeight: 700, fontSize: 14 }}>{producto.nombre}</Typography>
          <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
            #{producto.id} · {producto.unidad_medida}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <Chip label={grupo.short} size="small"
            sx={{ bgcolor: `${grupo.color}18`, color: grupo.color, fontWeight: 700, fontSize: 10, borderRadius: 1 }} />
          <Chip label={low ? '⚠ Stock bajo' : '✓ OK'} size="small" color={low ? 'error' : 'success'}
            sx={{ fontWeight: 600, fontSize: 10, borderRadius: 1 }} />
        </Box>
      </Box>

      <Grid container spacing={1}>
        {[
          { label: 'Stock actual', val: stock, color: low ? '#EF4444' : 'text.primary' },
          { label: 'Stock mínimo', val: minimo, color: 'text.secondary' },
          { label: 'Costo unit.', val: formatCurrency(producto.costo), color: 'text.primary' },
          { label: 'Valorización', val: formatCurrency(stock * producto.costo), color: ACCENT },
        ].map(({ label, val, color }) => (
          <Grid item xs={6} key={label}>
            <Box sx={{ p: 1, borderRadius: 1.5, bgcolor: 'action.hover', textAlign: 'center' }}>
              <Typography sx={{ fontSize: 10, color: 'text.secondary', mb: 0.2 }}>{label}</Typography>
              <Typography sx={{ fontSize: 13, fontWeight: 700, color }}>{val}</Typography>
            </Box>
          </Grid>
        ))}
      </Grid>
    </Paper>
  );
};

// ─── Componente principal ──────────────────────────────────────────────────────
export default function Inventario() {
  const [tab, setTab]         = useState(0);
  const [productos, setProductos] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage]       = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const theme    = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  useEffect(() => { fetchStock(); }, []);

  const fetchStock = async () => {
    try {
      const res = await apiClient.get('/productos/');
      setProductos(res.data || []);
    } catch (err) { console.error('Error cargando inventario:', err); }
  };

  // Datos del grupo activo (solo tabs 0-3)
  const currentGrupo = tab <= 3 ? GRUPOS[tab] : null;

  const filteredData = useMemo(() => {
    if (!currentGrupo) return [];
    return productos
      .filter(p =>
        p.grupo_item === currentGrupo.id &&
        !p.es_servicio &&
        p.nombre.toLowerCase().includes(searchTerm.toLowerCase())
      )
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [productos, tab, searchTerm]);

  const paginatedData = useMemo(() =>
    filteredData.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage),
    [filteredData, page, rowsPerPage]
  );

  // KPIs globales
  const soloProductos   = productos.filter(p => !p.es_servicio);
  const stockBajoCount  = soloProductos.filter(p => (p.stock_actual ?? 0) < (p.stock_minimo ?? 0)).length;
  const valorTotal      = soloProductos.reduce((s, p) => s + (p.stock_actual ?? 0) * p.costo, 0);

  // KPIs del grupo activo
  const grupoItems = currentGrupo
    ? soloProductos.filter(p => p.grupo_item === currentGrupo.id)
    : [];
  const grupoValor = grupoItems.reduce((s, p) => s + (p.stock_actual ?? 0) * p.costo, 0);
  const grupoBajo  = grupoItems.filter(p => (p.stock_actual ?? 0) < (p.stock_minimo ?? 0)).length;

  return (
    <Box sx={{ width: '100%' }}>

      {/* ── Header ── */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
        <Box sx={{ width: 40, height: 40, borderRadius: 2, bgcolor: `${ACCENT}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: ACCENT }}>
          <Inventory2Outlined />
        </Box>
        <Box>
          <Typography sx={{ fontWeight: 700, fontSize: 20, lineHeight: 1.2 }}>Inventarios</Typography>
          <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>Stock, valorización y movimientos</Typography>
        </Box>
      </Box>

      {/* ── KPIs globales ── */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={4}>
          <KpiCard label="Valorización total" value={formatCurrency(valorTotal)} icon={<AttachMoney />} color={ACCENT} />
        </Grid>
        <Grid item xs={12} sm={4}>
          <KpiCard label="Total SKUs" value={soloProductos.length} icon={<Category />} color="#3B82F6" />
        </Grid>
        <Grid item xs={12} sm={4}>
          <KpiCard
            label="Alertas de stock"
            value={stockBajoCount}
            icon={<Warning />}
            color={stockBajoCount > 0 ? '#EF4444' : '#10B981'}
            sub={stockBajoCount === 0 ? 'Todo en niveles normales' : 'Productos bajo mínimo'}
          />
        </Grid>
      </Grid>

      {/* ── Tabs ── */}
      <Paper sx={{ borderRadius: 3, overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', border: '1px solid', borderColor: 'divider' }}>
        <Tabs
          value={tab}
          onChange={(_, v) => { setTab(v); setPage(0); setSearchTerm(''); }}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            px: 1,
            borderBottom: '1px solid', borderColor: 'divider',
            '& .MuiTab-root': { fontWeight: 600, fontSize: 13, textTransform: 'none', minHeight: 52 },
            '& .MuiTabs-indicator': { backgroundColor: ACCENT, height: 3, borderRadius: 3 },
            '& .Mui-selected': { color: `${ACCENT} !important` },
          }}
        >
          {GRUPOS.map(g => {
            const items = soloProductos.filter(p => p.grupo_item === g.id);
            const bajos = items.filter(p => (p.stock_actual ?? 0) < (p.stock_minimo ?? 0)).length;
            return (
              <Tab
                key={g.id}
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: g.color }} />
                    {g.short} — {g.label}
                    {bajos > 0 && (
                      <Chip label={bajos} size="small"
                        sx={{ height: 16, fontSize: 9, fontWeight: 700, bgcolor: '#EF444420', color: '#EF4444', ml: 0.5 }} />
                    )}
                  </Box>
                }
              />
            );
          })}
          <Tab
            label="⚙️ Movimientos y Ajustes"
            sx={{ fontWeight: 700, color: '#06B6D4 !important' }}
          />
        </Tabs>

        <Box sx={{ p: { xs: 2, md: 3 } }}>
          {tab <= 3 ? (
            <>
              {/* KPIs del grupo activo */}
              {currentGrupo && (
                <Box sx={{ display: 'flex', gap: 2, mb: 2.5, flexWrap: 'wrap' }}>
                  <Box sx={{ px: 2, py: 1, borderRadius: 2, bgcolor: `${currentGrupo.color}0D`, border: `1px solid ${currentGrupo.color}25` }}>
                    <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>Ítems en {currentGrupo.short}</Typography>
                    <Typography sx={{ fontWeight: 700, fontSize: 16, color: currentGrupo.color }}>{grupoItems.length}</Typography>
                  </Box>
                  <Box sx={{ px: 2, py: 1, borderRadius: 2, bgcolor: `${ACCENT}0D`, border: `1px solid ${ACCENT}25` }}>
                    <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>Valorización {currentGrupo.short}</Typography>
                    <Typography sx={{ fontWeight: 700, fontSize: 16, color: ACCENT }}>{formatCurrency(grupoValor)}</Typography>
                  </Box>
                  {grupoBajo > 0 && (
                    <Box sx={{ px: 2, py: 1, borderRadius: 2, bgcolor: '#EF44440D', border: '1px solid #EF444425' }}>
                      <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>Stock bajo</Typography>
                      <Typography sx={{ fontWeight: 700, fontSize: 16, color: '#EF4444' }}>{grupoBajo}</Typography>
                    </Box>
                  )}
                </Box>
              )}

              {/* Buscador */}
              <TextField
                fullWidth
                placeholder={`Buscar en ${currentGrupo?.label}…`}
                value={searchTerm}
                onChange={e => { setSearchTerm(e.target.value); setPage(0); }}
                sx={{ mb: 2 }}
                InputProps={{
                  startAdornment: <InputAdornment position="start"><Search sx={{ color: 'text.secondary', fontSize: 20 }} /></InputAdornment>,
                }}
              />

              {/* Mobile / Desktop */}
              {isMobile ? (
                <Box>
                  {paginatedData.length === 0
                    ? <Box sx={{ textAlign: 'center', py: 6, color: 'text.secondary' }}>
                        <Inventory2Outlined sx={{ fontSize: 48, mb: 1, opacity: 0.3 }} />
                        <Typography>No hay productos en este grupo</Typography>
                      </Box>
                    : paginatedData.map(p => <StockCard key={p.id} producto={p} />)
                  }
                </Box>
              ) : (
                <TableContainer sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        {['#', 'Nombre', 'Grupo', 'U.M.', 'Stock Actual', 'Mínimo', 'Costo Unit.', 'Valorización', 'Estado'].map(h => (
                          <TableCell key={h}>{h}</TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {paginatedData.length === 0
                        ? <TableRow>
                            <TableCell colSpan={9} sx={{ textAlign: 'center', py: 6, color: 'text.secondary' }}>
                              No hay productos en este grupo
                            </TableCell>
                          </TableRow>
                        : paginatedData.map(p => {
                            const stock  = p.stock_actual ?? 0;
                            const minimo = p.stock_minimo ?? 0;
                            const low    = stock < minimo;
                            const grupo  = GRUPOS.find(g => g.id === p.grupo_item) || { short: '—', color: '#94a3b8' };

                            return (
                              <TableRow key={p.id} hover sx={{ bgcolor: low ? 'rgba(239,68,68,0.03)' : 'transparent' }}>
                                <TableCell sx={{ fontWeight: 600, color: 'text.secondary', fontSize: 12 }}>#{p.id}</TableCell>
                                <TableCell sx={{ fontWeight: 600 }}>{p.nombre}</TableCell>
                                <TableCell>
                                  <Chip label={grupo.short} size="small"
                                    sx={{ bgcolor: `${grupo.color}18`, color: grupo.color, fontWeight: 700, fontSize: 10, borderRadius: 1 }} />
                                </TableCell>
                                <TableCell sx={{ fontSize: 12 }}>{p.unidad_medida}</TableCell>
                                <TableCell sx={{ fontWeight: 700, color: low ? '#EF4444' : 'text.primary', fontSize: 15 }}>
                                  {stock}
                                </TableCell>
                                <TableCell sx={{ color: 'text.secondary' }}>{minimo}</TableCell>
                                <TableCell>{formatCurrency(p.costo)}</TableCell>
                                <TableCell sx={{ fontWeight: 700, color: ACCENT }}>{formatCurrency(stock * p.costo)}</TableCell>
                                <TableCell>
                                  <Chip
                                    label={low ? 'Stock bajo' : 'Normal'}
                                    color={low ? 'error' : 'success'}
                                    size="small"
                                    sx={{ fontWeight: 600, fontSize: 11, borderRadius: 1.5 }}
                                  />
                                </TableCell>
                              </TableRow>
                            );
                          })
                      }
                    </TableBody>
                  </Table>
                </TableContainer>
              )}

              <TablePagination
                rowsPerPageOptions={[5, 10, 25]}
                component="div"
                count={filteredData.length}
                rowsPerPage={rowsPerPage}
                page={page}
                onPageChange={(_, p) => setPage(p)}
                onRowsPerPageChange={e => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
                labelRowsPerPage="Filas:"
                labelDisplayedRows={({ from, to, count }) => `${from}–${to} de ${count}`}
              />
            </>
          ) : (
            <InventoryPage />
          )}
        </Box>
      </Paper>
    </Box>
  );
}
