import React, { useState, useEffect, useMemo } from "react";
import {
  Box, Typography, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TableSortLabel, Chip, TextField, TablePagination,
  useTheme, useMediaQuery, Paper, Grid, InputAdornment, Button, Autocomplete,
  IconButton, Tooltip
} from "@mui/material";
import {
  Inventory2Outlined, Search, Warning, AttachMoney, Category,
  Receipt, Settings, Refresh, FileDownload
} from "@mui/icons-material";
import apiClient from "../../api";
import { formatCurrency } from "../../utils/formatters";
import InventoryPage from "./InventoryPage";
import GruposProductoManager from "./GruposProductoManager";

const ACCENT = '#F59E0B';
const GREEN  = '#10B981';
const RED    = '#EF4444';
const BLUE   = '#3B82F6';

const TODOS_GRUPO = { id: 0, nombre: 'Todos', codigo: 'ALL', color: '#94a3b8' };

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
  const pct    = minimo > 0 ? Math.min(100, Math.round((stock / minimo) * 100)) : 100;

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
          { label: 'Stock actual', val: stock,                            color: low ? RED : 'text.primary' },
          { label: 'Stock mínimo', val: minimo,                           color: 'text.secondary' },
          { label: 'Costo unit.',  val: formatCurrency(producto.costo),   color: 'text.primary' },
          { label: 'Valorización', val: formatCurrency(stock * producto.costo), color: ACCENT },
        ].map(({ label, val, color }) => (
          <Grid size={{ xs: 6 }} key={label}>
            <Box sx={{ p: 1, borderRadius: 1.5, bgcolor: 'action.hover', textAlign: 'center' }}>
              <Typography sx={{ fontSize: 9, color: 'text.secondary', mb: 0.1 }}>{label}</Typography>
              <Typography sx={{ fontSize: 12, fontWeight: 700, color }}>{val}</Typography>
            </Box>
          </Grid>
        ))}
      </Grid>
      {/* Stock % progress bar */}
      <Box sx={{ mt: 1.5 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.4 }}>
          <Typography sx={{ fontSize: 9, color: 'text.secondary' }}>Stock vs mínimo</Typography>
          <Typography sx={{ fontSize: 9, fontWeight: 700, color: low ? RED : GREEN }}>{pct}%</Typography>
        </Box>
        <Box sx={{ height: 5, borderRadius: 3, bgcolor: 'action.hover', overflow: 'hidden' }}>
          <Box sx={{ height: '100%', width: `${pct}%`, borderRadius: 3, bgcolor: low ? RED : GREEN, transition: 'width 0.4s' }} />
        </Box>
      </Box>
    </Paper>
  );
};

// ─── Componente principal ──────────────────────────────────────────────────────
export default function Inventario() {
  const [vista, setVista]               = useState('grupo');
  const [productos, setProductos]       = useState([]);
  const [grupos, setGrupos]             = useState([]);
  const [currentGrupo, setCurrentGrupo] = useState(null);
  const [searchTerm, setSearchTerm]     = useState('');
  const [filterStock, setFilterStock]   = useState('all');
  const [sortCol, setSortCol]           = useState('nombre');
  const [sortDir, setSortDir]           = useState('asc');
  const [page, setPage]                 = useState(0);
  const [rowsPerPage, setRowsPerPage]   = useState(10);

  const theme    = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  useEffect(() => { fetchStock(); fetchGrupos(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchStock = async () => {
    try { const res = await apiClient.get('/productos/'); setProductos(res.data || []); }
    catch (err) { console.error(err); }
  };

  const fetchGrupos = async () => {
    try {
      const res = await apiClient.get('/grupos-producto/');
      const data = res.data || [];
      setGrupos(data);
      if (data.length > 0 && !currentGrupo) setCurrentGrupo(TODOS_GRUPO);
    } catch (err) { console.error(err); }
  };

  const handleRefresh = () => { fetchStock(); fetchGrupos(); };

  const soloProductos  = productos.filter(p => !p.es_servicio);
  const stockBajoCount = soloProductos.filter(p => (p.stock_actual ?? 0) < (p.stock_minimo ?? 0)).length;
  const valorTotal     = soloProductos.reduce((s, p) => s + (p.stock_actual ?? 0) * p.costo, 0);

  // Products belonging to the selected group (or all if Todos)
  const soloProductosFiltered = useMemo(() => {
    const byGroup = (!currentGrupo || currentGrupo.id === 0)
      ? soloProductos
      : soloProductos.filter(p => p.grupo_item === currentGrupo.id);
    const q = searchTerm.toLowerCase();
    return byGroup.filter(p =>
      p.nombre.toLowerCase().includes(q) ||
      (p.codigo_barras && p.codigo_barras.toLowerCase().includes(q)) ||
      (p.descripcion && p.descripcion.toLowerCase().includes(q))
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productos, currentGrupo, searchTerm]);

  // Apply stock filter chip
  const filteredBase = useMemo(() => {
    if (filterStock === 'bajo')     return soloProductosFiltered.filter(p => (p.stock_actual ?? 0) > 0 && (p.stock_actual ?? 0) < (p.stock_minimo ?? 0));
    if (filterStock === 'sinStock') return soloProductosFiltered.filter(p => (p.stock_actual ?? 0) <= 0);
    return soloProductosFiltered;
  }, [soloProductosFiltered, filterStock]);

  // Apply sort
  const filteredData = useMemo(() => {
    return [...filteredBase].sort((a, b) => {
      let va, vb;
      if (sortCol === 'nombre') {
        va = a.nombre; vb = b.nombre;
        return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
      }
      if (sortCol === 'stock')  { va = a.stock_actual ?? 0; vb = b.stock_actual ?? 0; }
      if (sortCol === 'minimo') { va = a.stock_minimo ?? 0; vb = b.stock_minimo ?? 0; }
      if (sortCol === 'costo')  { va = a.costo ?? 0;        vb = b.costo ?? 0; }
      if (sortCol === 'valor')  { va = (a.stock_actual ?? 0) * a.costo; vb = (b.stock_actual ?? 0) * b.costo; }
      return sortDir === 'asc' ? va - vb : vb - va;
    });
  }, [filteredBase, sortCol, sortDir]);

  const paginatedData = useMemo(() =>
    filteredData.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage),
    [filteredData, page, rowsPerPage]
  );

  const grupoItems = currentGrupo && currentGrupo.id !== 0
    ? soloProductos.filter(p => p.grupo_item === currentGrupo.id)
    : soloProductos;
  const grupoValor = grupoItems.reduce((s, p) => s + (p.stock_actual ?? 0) * p.costo, 0);
  const grupoBajo  = grupoItems.filter(p => (p.stock_actual ?? 0) < (p.stock_minimo ?? 0)).length;

  const handleGrupoChange = (_, newGrupo) => {
    setCurrentGrupo(newGrupo);
    setSearchTerm('');
    setFilterStock('all');
    setPage(0);
    if (newGrupo) setVista('grupo');
  };

  const handleSort = (col) => {
    setSortDir(prev => sortCol === col ? (prev === 'asc' ? 'desc' : 'asc') : 'asc');
    setSortCol(col);
  };

  const SortHeader = ({ col, label, align = 'left' }) => (
    <TableCell align={align}>
      <TableSortLabel
        active={sortCol === col}
        direction={sortCol === col ? sortDir : 'asc'}
        onClick={() => handleSort(col)}
      >
        {label}
      </TableSortLabel>
    </TableCell>
  );

  const exportCSV = () => {
    const headers = ['ID', 'Nombre', 'Categoría', 'U.M.', 'Stock', 'Mínimo', 'Costo', 'Valorización', 'Estado'];
    const rows = filteredData.map(p => {
      const grupo = grupos.find(g => g.id === p.grupo_item) || { nombre: '—' };
      const stock = p.stock_actual ?? 0;
      return [
        p.id, p.nombre, grupo.nombre, p.unidad_medida,
        stock, p.stock_minimo ?? 0, p.costo,
        stock * p.costo,
        stock < (p.stock_minimo ?? 0) ? 'Bajo' : 'Normal',
      ];
    });
    const now = new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' }).replace(/[/:, ]/g, '-');
    const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `stock_inventario_${now}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
  };

  // Groups list with synthetic "Todos" at the top
  const gruposConTodos = useMemo(() => [TODOS_GRUPO, ...grupos], [grupos]);

  return (
    <Box sx={{ width: '100%', maxWidth: '100%', overflowX: 'hidden', boxSizing: 'border-box' }}>

      {/* ── Header ── */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
        <Box sx={{ width: 38, height: 38, borderRadius: 2, flexShrink: 0, bgcolor: `${ACCENT}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: ACCENT }}>
          <Inventory2Outlined />
        </Box>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography sx={{ fontWeight: 700, fontSize: 18, lineHeight: 1.2 }}>Inventarios</Typography>
          <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>Stock, valorización y movimientos</Typography>
        </Box>
        <Tooltip title="Actualizar datos">
          <IconButton size="small" onClick={handleRefresh} sx={{ color: 'text.secondary' }}>
            <Refresh fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      {/* ── KPIs globales ── */}
      <Grid container spacing={1.5} sx={{ mb: 2 }}>
        <Grid size={{ xs: 6, sm: 4 }}>
          <KpiCard label="Valorización total" value={formatCurrency(valorTotal)} icon={<AttachMoney />} color={ACCENT} />
        </Grid>
        <Grid size={{ xs: 6, sm: 4 }}>
          <KpiCard label="Total SKUs" value={soloProductos.length} icon={<Category />} color={BLUE} />
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <KpiCard
            label="Alertas de stock" value={stockBajoCount} icon={<Warning />}
            color={stockBajoCount > 0 ? RED : GREEN}
            sub={stockBajoCount === 0 ? 'Todo en niveles normales' : 'Productos bajo mínimo'}
          />
        </Grid>
      </Grid>

      <Paper sx={{ borderRadius: 3, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', border: '1px solid', borderColor: 'divider', overflow: 'hidden' }}>

        {/* ── Selector de categoría + botones de acción ── */}
        <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>

          <Autocomplete
            options={gruposConTodos}
            getOptionLabel={(g) => g.nombre}
            value={currentGrupo}
            onChange={handleGrupoChange}
            isOptionEqualToValue={(a, b) => a.id === b.id}
            disableClearable
            renderOption={(props, g) => {
              if (g.id === 0) {
                return (
                  <Box component="li" {...props} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: '10px !important' }}>
                    <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: g.color, flexShrink: 0 }} />
                    <Typography sx={{ fontSize: 13, fontWeight: 700 }}>{g.nombre}</Typography>
                    <Typography sx={{ fontSize: 11, color: 'text.secondary', ml: 'auto' }}>{soloProductos.length} productos</Typography>
                  </Box>
                );
              }
              const bajos = soloProductos.filter(p => p.grupo_item === g.id)
                .filter(p => (p.stock_actual ?? 0) < (p.stock_minimo ?? 0)).length;
              return (
                <Box component="li" {...props} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: '10px !important' }}>
                  <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: g.color, flexShrink: 0 }} />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{g.nombre}</Typography>
                    <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{g.codigo}</Typography>
                  </Box>
                  {bajos > 0 && (
                    <Chip label={`${bajos} bajo`} size="small"
                      sx={{ height: 18, fontSize: 9, fontWeight: 700, bgcolor: '#EF444420', color: RED, '& .MuiChip-label': { px: 0.8 } }} />
                  )}
                </Box>
              );
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                size="small"
                placeholder="Buscar categoría…"
                InputProps={{
                  ...params.InputProps,
                  startAdornment: currentGrupo ? (
                    <Box sx={{ display: 'flex', alignItems: 'center', pl: 0.5, pr: 0.5 }}>
                      <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: currentGrupo.color }} />
                    </Box>
                  ) : params.InputProps.startAdornment,
                  sx: { borderRadius: 2, fontSize: 13 }
                }}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
              />
            )}
            sx={{ flex: 1, minWidth: 160 }}
            noOptionsText="Sin categorías"
          />

          <Box sx={{ display: 'flex', gap: 1, flexShrink: 0 }}>
            <Button
              size="small"
              variant={vista === 'movimientos' ? 'contained' : 'outlined'}
              startIcon={<Receipt sx={{ fontSize: 16 }} />}
              onClick={() => setVista('movimientos')}
              sx={{
                borderRadius: 2, fontWeight: 600, fontSize: { xs: 10, md: 11 }, textTransform: 'none',
                ...(vista === 'movimientos'
                  ? { bgcolor: '#06B6D4', '&:hover': { bgcolor: '#0891B2' }, boxShadow: 'none' }
                  : { borderColor: '#06B6D4', color: '#06B6D4' }),
              }}
            >
              Movimientos
            </Button>
            <Button
              size="small"
              variant={vista === 'config' ? 'contained' : 'outlined'}
              startIcon={<Settings sx={{ fontSize: 16 }} />}
              onClick={() => setVista('config')}
              sx={{
                borderRadius: 2, fontWeight: 600, fontSize: { xs: 10, md: 11 }, textTransform: 'none',
                ...(vista === 'config'
                  ? { bgcolor: '#6366F1', '&:hover': { bgcolor: '#4F46E5' }, boxShadow: 'none' }
                  : { borderColor: '#6366F1', color: '#6366F1' }),
              }}
            >
              Categorías
            </Button>
          </Box>
        </Box>

        <Box sx={{ p: { xs: 1.5, md: 3 } }}>

          {/* ── Vista: stock de la categoría seleccionada ── */}
          {vista === 'grupo' && (
            <>
              <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'nowrap' }}>
                <MiniKpi
                  label={currentGrupo?.id === 0 ? 'Total productos' : `Ítems en ${currentGrupo?.nombre}`}
                  value={grupoItems.length}
                  color={currentGrupo?.color ?? '#94a3b8'}
                />
                <MiniKpi label="Valorización" value={formatCurrency(grupoValor)} color={ACCENT} />
                {grupoBajo > 0 && <MiniKpi label="Stock bajo" value={grupoBajo} color={RED} />}
              </Box>

              {/* Search bar + export button */}
              <Box sx={{ display: 'flex', gap: 1, mb: 1, alignItems: 'center' }}>
                <TextField
                  fullWidth size="small"
                  placeholder={currentGrupo?.id === 0 ? 'Buscar en todos los productos…' : `Buscar en ${currentGrupo?.nombre ?? 'categoría'}…`}
                  value={searchTerm}
                  onChange={e => { setSearchTerm(e.target.value); setPage(0); }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Search sx={{ color: 'text.secondary', fontSize: 18 }} />
                      </InputAdornment>
                    ),
                  }}
                />
                <Tooltip title="Exportar CSV">
                  <IconButton size="small" onClick={exportCSV} sx={{ color: 'text.secondary', flexShrink: 0 }}>
                    <FileDownload fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>

              {/* Filter chips */}
              <Box sx={{ display: 'flex', gap: 0.8, flexWrap: 'wrap', mb: 2 }}>
                {[
                  { key: 'all',      label: 'Todos',      count: soloProductosFiltered.length },
                  { key: 'bajo',     label: 'Stock bajo', count: soloProductosFiltered.filter(p => (p.stock_actual ?? 0) > 0 && (p.stock_actual ?? 0) < (p.stock_minimo ?? 0)).length },
                  { key: 'sinStock', label: 'Sin stock',  count: soloProductosFiltered.filter(p => (p.stock_actual ?? 0) <= 0).length },
                ].map(({ key, label, count }) => (
                  <Chip
                    key={key}
                    label={`${label} (${count})`}
                    onClick={() => { setFilterStock(key); setPage(0); }}
                    size="small"
                    variant={filterStock === key ? 'filled' : 'outlined'}
                    sx={{
                      fontWeight: 600, fontSize: 11, cursor: 'pointer',
                      bgcolor: filterStock === key ? ACCENT : 'transparent',
                      color: filterStock === key ? '#fff' : 'text.secondary',
                      borderColor: filterStock === key ? ACCENT : 'divider',
                    }}
                  />
                ))}
              </Box>

              {isMobile ? (
                <Box>
                  {paginatedData.length === 0
                    ? <Box sx={{ textAlign: 'center', py: 5, color: 'text.secondary' }}>
                        <Inventory2Outlined sx={{ fontSize: 44, mb: 1, opacity: 0.3 }} />
                        <Typography fontSize={13}>No hay productos en esta categoría</Typography>
                      </Box>
                    : paginatedData.map(p => <StockCard key={p.id} producto={p} grupos={grupos} />)
                  }
                </Box>
              ) : (
                <TableContainer sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider', overflowX: 'auto' }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>#</TableCell>
                        <SortHeader col="nombre" label="Nombre" />
                        <TableCell>Categoría</TableCell>
                        <TableCell>U.M.</TableCell>
                        <SortHeader col="stock"  label="Stock"       align="left" />
                        <SortHeader col="minimo" label="Mínimo"      align="left" />
                        <SortHeader col="costo"  label="Costo"       align="left" />
                        <SortHeader col="valor"  label="Valorización" align="left" />
                        <TableCell>Estado</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {paginatedData.length === 0
                        ? <TableRow><TableCell colSpan={9} sx={{ textAlign: 'center', py: 5, color: 'text.secondary' }}>
                            No hay productos en esta categoría
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
                                <TableCell sx={{ fontWeight: 700, color: low ? RED : 'text.primary' }}>{stock}</TableCell>
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
          )}

          {/* ── Vista: movimientos ── */}
          {vista === 'movimientos' && <InventoryPage />}

          {/* ── Vista: gestión de categorías ── */}
          {vista === 'config' && (
            <GruposProductoManager onGruposChange={(nuevos) => {
              setGrupos(nuevos);
              if (nuevos.length > 0) {
                const still = nuevos.find(g => g.id === currentGrupo?.id);
                setCurrentGrupo(still ?? TODOS_GRUPO);
              } else {
                setCurrentGrupo(TODOS_GRUPO);
              }
            }} />
          )}

        </Box>
      </Paper>
    </Box>
  );
}
