import React, { useState, useEffect, useMemo } from "react";
import {
  Box, Typography, Tabs, Tab, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Chip, TextField, TablePagination, useTheme, useMediaQuery,
  Paper, Grid, Divider, InputAdornment
} from "@mui/material";
import {
  Inventory2Outlined, Search, Warning, AttachMoney, Category
} from "@mui/icons-material";
import apiClient from "../../api";
import { formatCurrency } from "../../utils/formatters";
import InventoryPage from "./InventoryPage";
import GruposProductoManager from "./GruposProductoManager";

const ACCENT = '#F59E0B';

function TabPanel({ children, value, index }) {
  return (
    <div role="tabpanel" hidden={value !== index}>
      {value === index && <Box sx={{ pt: 2 }}>{children}</Box>}
    </div>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
const KpiCard = ({ label, value, icon, color, sub }) => (
  <Paper sx={{
    p: 2, borderRadius: 2.5,
    display: 'flex', alignItems: 'center', gap: 1.5,
    boxShadow: '0 2px 10px rgba(0,0,0,0.06)',
    width: '100%', boxSizing: 'border-box',
  }}>
    <Box sx={{
      width: 38, height: 38, borderRadius: 1.5, flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      bgcolor: `${color}18`, color,
    }}>
      {icon}
    </Box>
    <Box sx={{ minWidth: 0, flex: 1 }}>
      <Typography sx={{ fontSize: 10, color: 'text.secondary', fontWeight: 500 }}>{label}</Typography>
      <Typography sx={{ fontSize: 15, fontWeight: 700, color: 'text.primary', lineHeight: 1.2 }}>{value}</Typography>
      {sub && <Typography sx={{ fontSize: 9, color: 'text.secondary' }}>{sub}</Typography>}
    </Box>
  </Paper>
);

// ─── Mini KPI ─────────────────────────────────────────────────────────────────
const MiniKpi = ({ label, value, color }) => (
  <Box sx={{
    px: 1.5, py: 1, borderRadius: 2,
    bgcolor: `${color}0D`, border: `1px solid ${color}25`,
    flex: '1 1 0', minWidth: 0,
  }}>
    <Typography sx={{ fontSize: 9, color: 'text.secondary', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
      {label}
    </Typography>
    <Typography sx={{ fontWeight: 700, fontSize: 14, color, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
      {value}
    </Typography>
  </Box>
);

// ─── Card mobile de stock ──────────────────────────────────────────────────────
const StockCard = ({ producto, grupos }) => {
  const stock  = producto.stock_actual ?? 0;
  const minimo = producto.stock_minimo ?? 0;
  const low    = stock < minimo;
  const grupo  = grupos.find(g => g.id === producto.grupo_item) || { codigo: '—', color: '#94a3b8' };

  return (
    <Paper sx={{ p: 2, mb: 1.5, borderRadius: 3, boxShadow: '0 2px 10px rgba(0,0,0,0.06)', width: '100%', boxSizing: 'border-box' }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 1.5, gap: 1 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 700, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {producto.nombre}
          </Typography>
          <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
            #{producto.id} · {producto.unidad_medida}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.4, flexShrink: 0, alignItems: 'flex-end' }}>
          <Chip label={grupo.codigo} size="small"
            sx={{ bgcolor: `${grupo.color}18`, color: grupo.color, fontWeight: 700, fontSize: 9, borderRadius: 1, height: 17 }} />
          <Chip label={low ? '⚠ Bajo' : '✓ OK'} size="small" color={low ? 'error' : 'success'}
            sx={{ fontWeight: 600, fontSize: 9, borderRadius: 1, height: 17 }} />
        </Box>
      </Box>

      <Grid container spacing={1}>
        {[
          { label: 'Stock actual', val: stock,                            color: low ? '#EF4444' : 'text.primary' },
          { label: 'Stock mínimo', val: minimo,                           color: 'text.secondary' },
          { label: 'Costo unit.',  val: formatCurrency(producto.costo),   color: 'text.primary' },
          { label: 'Valorización', val: formatCurrency(stock * producto.costo), color: ACCENT },
        ].map(({ label, val, color }) => (
          <Grid item xs={6} key={label}>
            <Box sx={{ p: 1, borderRadius: 1.5, bgcolor: 'action.hover', textAlign: 'center' }}>
              <Typography sx={{ fontSize: 9, color: 'text.secondary', mb: 0.1 }}>{label}</Typography>
              <Typography sx={{ fontSize: 12, fontWeight: 700, color }}>{val}</Typography>
            </Box>
          </Grid>
        ))}
      </Grid>
    </Paper>
  );
};

// ─── Componente principal ──────────────────────────────────────────────────────
export default function Inventario() {
  const [tab, setTab]               = useState(0);
  const [productos, setProductos]   = useState([]);
  const [grupos, setGrupos]         = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage]             = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const theme    = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  useEffect(() => {
    fetchStock();
    fetchGrupos();
  }, []);

  const fetchStock = async () => {
    try {
      const res = await apiClient.get('/productos/');
      setProductos(res.data || []);
    } catch (err) { console.error(err); }
  };

  const fetchGrupos = async () => {
    try {
      const res = await apiClient.get('/grupos-producto/');
      setGrupos(res.data || []);
    } catch (err) { console.error(err); }
  };

  // Índices: 0..N-1 → grupos, N → inventario/movimientos, N+1 → configuración
  const TAB_INVENTARIO = grupos.length;
  const TAB_CONFIG     = grupos.length + 1;

  const currentGrupo = tab < grupos.length ? grupos[tab] : null;

  const soloProductos  = productos.filter(p => !p.es_servicio);
  const stockBajoCount = soloProductos.filter(p => (p.stock_actual ?? 0) < (p.stock_minimo ?? 0)).length;
  const valorTotal     = soloProductos.reduce((s, p) => s + (p.stock_actual ?? 0) * p.costo, 0);

  const filteredData = useMemo(() => {
    if (!currentGrupo) return [];
    const q = searchTerm.toLowerCase();
    return soloProductos
      .filter(p => p.grupo_item === currentGrupo.id &&
        (p.nombre.toLowerCase().includes(q) ||
         (p.codigo_barras && p.codigo_barras.toLowerCase().includes(q)) ||
         (p.descripcion && p.descripcion.toLowerCase().includes(q)))
      )
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [productos, tab, searchTerm, grupos]);

  const paginatedData = useMemo(() =>
    filteredData.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage),
    [filteredData, page, rowsPerPage]
  );

  const grupoItems = currentGrupo ? soloProductos.filter(p => p.grupo_item === currentGrupo.id) : [];
  const grupoValor = grupoItems.reduce((s, p) => s + (p.stock_actual ?? 0) * p.costo, 0);
  const grupoBajo  = grupoItems.filter(p => (p.stock_actual ?? 0) < (p.stock_minimo ?? 0)).length;

  return (
    <Box sx={{ width: '100%', maxWidth: '100%', overflowX: 'hidden', boxSizing: 'border-box' }}>

      {/* ── Header ── */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
        <Box sx={{ width: 38, height: 38, borderRadius: 2, flexShrink: 0, bgcolor: `${ACCENT}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: ACCENT }}>
          <Inventory2Outlined />
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontWeight: 700, fontSize: 18, lineHeight: 1.2 }}>Inventarios</Typography>
          <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>Stock, valorización y movimientos</Typography>
        </Box>
      </Box>

      {/* ── KPIs globales ── */}
      <Grid container spacing={1.5} sx={{ mb: 2 }}>
        <Grid item xs={6} sm={4}>
          <KpiCard label="Valorización total" value={formatCurrency(valorTotal)} icon={<AttachMoney />} color={ACCENT} />
        </Grid>
        <Grid item xs={6} sm={4}>
          <KpiCard label="Total SKUs" value={soloProductos.length} icon={<Category />} color="#3B82F6" />
        </Grid>
        <Grid item xs={12} sm={4}>
          <KpiCard
            label="Alertas de stock" value={stockBajoCount} icon={<Warning />}
            color={stockBajoCount > 0 ? '#EF4444' : '#10B981'}
            sub={stockBajoCount === 0 ? 'Todo en niveles normales' : 'Productos bajo mínimo'}
          />
        </Grid>
      </Grid>

      <Paper sx={{ borderRadius: 3, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', border: '1px solid', borderColor: 'divider', width: '100%', boxSizing: 'border-box' }}>

        {/* ── Tabs dinámicos ── */}
        <Tabs
          value={tab}
          onChange={(_, v) => { setTab(v); setPage(0); setSearchTerm(''); }}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            borderBottom: '1px solid', borderColor: 'divider',
            '& .MuiTab-root': {
              fontWeight: 600, textTransform: 'none',
              minHeight: isMobile ? 52 : 48,
              minWidth: isMobile ? 70 : 'auto',
              px: isMobile ? 2 : 1.5,
              fontSize: isMobile ? 11 : 12,
            },
            '& .MuiTabs-indicator': { backgroundColor: ACCENT, height: 3, borderRadius: 3 },
            '& .Mui-selected': { color: `${ACCENT} !important` },
          }}
        >
          {grupos.map(g => {
            const bajos = soloProductos.filter(p => p.grupo_item === g.id)
              .filter(p => (p.stock_actual ?? 0) < (p.stock_minimo ?? 0)).length;
            return (
              <Tab
                key={g.id}
                title={g.nombre}
                label={
                  isMobile ? (
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.3 }}>
                      <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: g.color }} />
                      <Typography sx={{ fontSize: 10, fontWeight: 700, lineHeight: 1 }}>{g.codigo}</Typography>
                      {bajos > 0 && (
                        <Chip label={bajos} size="small" sx={{
                          height: 12, fontSize: 8, fontWeight: 700,
                          bgcolor: '#EF444420', color: '#EF4444',
                          '& .MuiChip-label': { px: 0.4 },
                        }} />
                      )}
                    </Box>
                  ) : (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
                      <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: g.color, flexShrink: 0 }} />
                      <span style={{ whiteSpace: 'nowrap' }}>{g.nombre}</span>
                      {bajos > 0 && (
                        <Chip label={bajos} size="small" sx={{
                          height: 14, fontSize: 8, fontWeight: 700,
                          bgcolor: '#EF444420', color: '#EF4444',
                          '& .MuiChip-label': { px: 0.4 },
                        }} />
                      )}
                    </Box>
                  )
                }
              />
            );
          })}

          {/* Tab Movimientos/Config */}
          <Tab
            title="Movimientos de inventario"
            label={isMobile ? '📋' : '📋 Movimientos'}
            sx={{ fontWeight: 700, color: '#06B6D4 !important' }}
          />
          <Tab
            title="Configurar categorías"
            label={isMobile ? '⚙️' : '⚙️ Categorías'}
            sx={{ fontWeight: 700, color: '#6366F1 !important' }}
          />
        </Tabs>

        {/* Nombre del tab activo en mobile */}
        {isMobile && currentGrupo && (
          <Box sx={{ px: 2, pt: 1, pb: 0.5, borderBottom: '1px solid', borderColor: 'divider' }}>
            <Typography sx={{ fontWeight: 700, fontSize: 13, color: currentGrupo.color }}>
              {currentGrupo.nombre}
            </Typography>
          </Box>
        )}

        <Box sx={{ p: { xs: 1.5, md: 3 } }}>
          {tab < grupos.length ? (
            /* ── Vista de grupo de inventario ── */
            <>
              {currentGrupo && (
                <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'nowrap' }}>
                  <MiniKpi label={`Ítems en ${currentGrupo.nombre}`} value={grupoItems.length} color={currentGrupo.color} />
                  <MiniKpi label={`Valorización`} value={formatCurrency(grupoValor)} color={ACCENT} />
                  {grupoBajo > 0 && <MiniKpi label="Stock bajo" value={grupoBajo} color="#EF4444" />}
                </Box>
              )}

              <TextField
                fullWidth size="small"
                placeholder={`Buscar en ${currentGrupo?.nombre}…`}
                value={searchTerm}
                onChange={e => { setSearchTerm(e.target.value); setPage(0); }}
                sx={{ mb: 2 }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search sx={{ color: 'text.secondary', fontSize: 18 }} />
                    </InputAdornment>
                  ),
                }}
              />

              {isMobile ? (
                <Box>
                  {paginatedData.length === 0
                    ? <Box sx={{ textAlign: 'center', py: 5, color: 'text.secondary' }}>
                        <Inventory2Outlined sx={{ fontSize: 44, mb: 1, opacity: 0.3 }} />
                        <Typography fontSize={13}>No hay productos en este grupo</Typography>
                      </Box>
                    : paginatedData.map(p => <StockCard key={p.id} producto={p} grupos={grupos} />)
                  }
                </Box>
              ) : (
                <TableContainer sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider', overflowX: 'auto' }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        {['#', 'Nombre', 'Categoría', 'U.M.', 'Stock', 'Mínimo', 'Costo', 'Valorización', 'Estado'].map(h => (
                          <TableCell key={h}>{h}</TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {paginatedData.length === 0
                        ? <TableRow><TableCell colSpan={9} sx={{ textAlign: 'center', py: 5, color: 'text.secondary' }}>
                            No hay productos en este grupo
                          </TableCell></TableRow>
                        : paginatedData.map(p => {
                            const stock  = p.stock_actual ?? 0;
                            const minimo = p.stock_minimo ?? 0;
                            const low    = stock < minimo;
                            const grupo  = grupos.find(g => g.id === p.grupo_item) || { codigo: '—', color: '#94a3b8' };
                            return (
                              <TableRow key={p.id} hover>
                                <TableCell sx={{ fontWeight: 600, color: 'text.secondary', fontSize: 12 }}>#{p.id}</TableCell>
                                <TableCell sx={{ fontWeight: 600 }}>{p.nombre}</TableCell>
                                <TableCell>
                                  <Chip label={grupo.codigo} size="small"
                                    sx={{ bgcolor: `${grupo.color}18`, color: grupo.color, fontWeight: 700, fontSize: 10, borderRadius: 1 }} />
                                </TableCell>
                                <TableCell sx={{ fontSize: 12 }}>{p.unidad_medida}</TableCell>
                                <TableCell sx={{ fontWeight: 700, color: low ? '#EF4444' : 'text.primary' }}>{stock}</TableCell>
                                <TableCell sx={{ color: 'text.secondary' }}>{minimo}</TableCell>
                                <TableCell>{formatCurrency(p.costo)}</TableCell>
                                <TableCell sx={{ fontWeight: 700, color: ACCENT }}>{formatCurrency(stock * p.costo)}</TableCell>
                                <TableCell>
                                  <Chip label={low ? 'Stock bajo' : 'Normal'} color={low ? 'error' : 'success'}
                                    size="small" sx={{ fontWeight: 600, fontSize: 10, borderRadius: 1.5 }} />
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
                labelDisplayedRows={({ from, to, count }) => `${from}-${to}/${count}`}
                sx={{
                  '& .MuiTablePagination-toolbar': { flexWrap: 'wrap', pl: 0 },
                  '& .MuiTablePagination-spacer': { display: 'none' },
                  '& .MuiTablePagination-displayedRows': { fontSize: 11 },
                  '& .MuiTablePagination-selectLabel': { fontSize: 11 },
                }}
              />
            </>
          ) : tab === TAB_INVENTARIO ? (
            /* ── Movimientos de inventario ── */
            <InventoryPage />
          ) : (
            /* ── Gestión de categorías ── */
            <GruposProductoManager onGruposChange={(nuevos) => {
              setGrupos(nuevos);
              // Solo reseteamos si el tab actual es mayor a los tabs disponibles (grupos + movimientos + config)
              if (tab > nuevos.length + 1) setTab(0);
            }} />
          )}
        </Box>
      </Paper>
    </Box>
  );
}
