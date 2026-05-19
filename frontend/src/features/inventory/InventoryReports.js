import React, { useEffect, useState, useMemo } from 'react';
import {
  Box, Typography, Grid, TextField, Button, Table, TableHead, TableRow,
  TableCell, TableBody, Tabs, Tab, Chip, TableContainer, Paper,
  Autocomplete, useMediaQuery, InputAdornment, Tooltip, Divider, CircularProgress,
  TableSortLabel, TablePagination,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  Inventory2Outlined, Refresh, Download, TrendingUp, TrendingDown,
  Search, BarChart, ReceiptLong, AttachMoney,
} from '@mui/icons-material';
import apiClient from '../../api';
import { formatCurrency } from '../../utils/formatters';
import { toast } from 'react-toastify';

const ACCENT = '#F59E0B';
const GREEN  = '#10B981';
const RED    = '#EF4444';
const BLUE   = '#3B82F6';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function TabPanel({ children, value, index }) {
  return (
    <div role="tabpanel" hidden={value !== index}>
      {value === index && <Box sx={{ pt: 2.5 }}>{children}</Box>}
    </div>
  );
}

const KpiCard = ({ label, value, icon, color }) => (
  <Paper sx={{ p: 2, borderRadius: 2.5, display: 'flex', alignItems: 'center', gap: 1.5, boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
    <Box sx={{ width: 38, height: 38, borderRadius: 1.5, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: `${color}18`, color }}>
      {icon}
    </Box>
    <Box>
      <Typography sx={{ fontSize: 11, color: 'text.secondary', fontWeight: 500 }}>{label}</Typography>
      <Typography sx={{ fontSize: 15, fontWeight: 700, color: 'text.primary' }}>{value}</Typography>
    </Box>
  </Paper>
);

const tipoChipConfig = {
  entrada:     { color: GREEN,  label: '↑ Entrada' },
  salida:      { color: RED,    label: '↓ Salida'  },
  ajuste:      { color: ACCENT, label: '⟳ Ajuste'  },
  venta:       { color: RED,    label: '⬇ Venta'   },
  compra:      { color: GREEN,  label: '⬆ Compra'  },
};
const TipoChip = ({ tipo }) => {
  const p = tipoChipConfig[tipo] || { color: '#94a3b8', label: tipo };
  return (
    <Chip label={p.label} size="small"
      sx={{ bgcolor: `${p.color}18`, color: p.color, fontWeight: 700, fontSize: 10, borderRadius: 1.5 }} />
  );
};

// ─── Margen helpers ────────────────────────────────────────────────────────────
const calcMargen = (precio, costo) => {
  const p = parseFloat(precio) || 0;
  const c = parseFloat(costo) || 0;
  if (!p) return null;
  return ((p - c) / p * 100);
};

const MargenChip = ({ precio, costo }) => {
  const pct = calcMargen(precio, costo);
  if (pct === null) return <Typography sx={{ color: 'text.disabled', fontSize: 12 }}>—</Typography>;
  const color = pct >= 30 ? GREEN : pct >= 10 ? '#F59E0B' : RED;
  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'center', px: 1, py: 0.2, borderRadius: 1.5, bgcolor: `${color}12`, border: `1px solid ${color}30` }}>
      <Typography sx={{ fontSize: 11, fontWeight: 700, color }}>{pct.toFixed(1)}%</Typography>
    </Box>
  );
};

// ─── Tabla de rotación (desktop) ──────────────────────────────────────────────
const RotTable = ({ rows, emptyText }) => (
  <TableContainer sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell>Producto</TableCell>
          <TableCell align="right">Cant. vendida</TableCell>
          <TableCell align="right">Ingresos</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.length === 0
          ? <TableRow><TableCell colSpan={3} sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>{emptyText}</TableCell></TableRow>
          : rows.map((r, i) => (
            <TableRow key={r.producto_id} hover>
              <TableCell>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box sx={{ width: 22, height: 22, borderRadius: 1, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: i < 3 ? `${ACCENT}20` : 'action.hover', fontSize: 10, fontWeight: 700, color: i < 3 ? ACCENT : 'text.secondary' }}>
                    {i + 1}
                  </Box>
                  <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{r.nombre}</Typography>
                </Box>
              </TableCell>
              <TableCell align="right" sx={{ fontWeight: 700 }}>{r.total_cantidad_vendida}</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700, color: GREEN }}>{formatCurrency(r.total_ingresos)}</TableCell>
            </TableRow>
          ))
        }
      </TableBody>
    </Table>
  </TableContainer>
);

// ─── Cards de rotación (mobile) ───────────────────────────────────────────────
const RotCards = ({ rows, emptyText, accentPill }) => {
  if (rows.length === 0) return (
    <Box sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
      <Typography fontSize={13}>{emptyText}</Typography>
    </Box>
  );
  return rows.map((r, i) => (
    <Paper key={r.producto_id} sx={{ p: 2, mb: 1.5, borderRadius: 2.5, border: '1px solid', borderColor: 'divider' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
          <Box sx={{ width: 24, height: 24, borderRadius: 1, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: i < 3 ? `${accentPill}20` : 'action.hover', fontSize: 10, fontWeight: 800, color: i < 3 ? accentPill : 'text.secondary' }}>
            {i + 1}
          </Box>
          <Typography sx={{ fontWeight: 700, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.nombre}</Typography>
        </Box>
        <Box sx={{ textAlign: 'right', flexShrink: 0, ml: 1 }}>
          <Typography sx={{ fontSize: 13, fontWeight: 800, color: GREEN }}>{formatCurrency(r.total_ingresos)}</Typography>
          <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{r.total_cantidad_vendida} uds.</Typography>
        </Box>
      </Box>
    </Paper>
  ));
};

// ─── Componente principal ──────────────────────────────────────────────────────
export default function InventoryReports() {
  const [tab, setTab] = useState(0);
  const theme         = useTheme();
  const isMobile      = useMediaQuery(theme.breakpoints.down('sm'));

  // Inventario actual
  const [inv, setInv]                 = useState({ items: [], total_valor_costo: 0, total_valor_venta: 0 });
  const [invSearch, setInvSearch]     = useState('');
  const [invLoading, setInvLoading]   = useState(false);
  const [invSortCol, setInvSortCol]   = useState('nombre');
  const [invSortDir, setInvSortDir]   = useState('asc');
  const [invPage, setInvPage]         = useState(0);
  const [invRowsPerPage, setInvRowsPerPage] = useState(25);

  // Rotación
  const [rotStart, setRotStart]     = useState('');
  const [rotEnd, setRotEnd]         = useState('');
  const [rotLimit, setRotLimit]     = useState(10);
  const [rotIncServ, setRotIncServ] = useState(false);
  const [rot, setRot]               = useState({ top: [], slow: [] });
  const [rotLoaded, setRotLoaded]   = useState(false);
  const [rotLoading, setRotLoading] = useState(false);

  // Kardex
  const [productos, setProductos] = useState([]);
  const [producto, setProducto]   = useState(null);
  const [kStart, setKStart]       = useState('');
  const [kEnd, setKEnd]           = useState('');
  const [kRows, setKRows]         = useState([]);
  const [kLoaded, setKLoaded]     = useState(false);
  const [kLoading, setKLoading]   = useState(false);

  const loadInventario = async () => {
    setInvLoading(true);
    try {
      const { data } = await apiClient.get('/reportes/inventario-actual');
      setInv(data);
    } catch (e) { console.error(e); }
    finally { setInvLoading(false); }
  };

  const loadRotacion = async () => {
    setRotLoading(true);
    try {
      const params = { limit: rotLimit, incluir_servicios: rotIncServ };
      if (rotStart) params.start_date = rotStart;
      if (rotEnd)   params.end_date   = rotEnd;
      const { data } = await apiClient.get('/reportes/rotacion', { params });
      setRot(data); setRotLoaded(true);
    } catch (e) { console.error(e); }
    finally { setRotLoading(false); }
  };

  const handleExportRotacion = async () => {
    try {
      const params = new URLSearchParams();
      params.set('limit', rotLimit);
      params.set('incluir_servicios', rotIncServ);
      if (rotStart) params.set('start_date', rotStart);
      if (rotEnd)   params.set('end_date', rotEnd);

      const res = await apiClient.get(`/reportes/rotacion/export?${params}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      const filename = `rotacion_${rotStart || 'inicio'}_a_${rotEnd || 'hoy'}.xlsx`;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch {
      toast.error('Error al exportar reporte de rotación');
    }
  };

  const loadKardex = async () => {
    if (!producto) return;
    setKLoading(true);
    try {
      const params = {};
      if (kStart) params.start_date = kStart;
      if (kEnd)   params.end_date   = kEnd;
      const { data } = await apiClient.get(`/inventario/kardex/${producto.id}`, { params });
      setKRows(data.items || []); setKLoaded(true);
    } catch (e) { console.error(e); }
    finally { setKLoading(false); }
  };

  const handleExportKardex = async () => {
    if (!producto) return;
    try {
      const params = new URLSearchParams();
      if (kStart) params.set('start_date', kStart);
      if (kEnd)   params.set('end_date', kEnd);
      const res = await apiClient.get(`/inventario/kardex/${producto.id}/export?${params}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `kardex_${producto.nombre.replace(/\s+/g, '_')}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch {
      toast.error('Error al exportar kardex');
    }
  };

  useEffect(() => {
    loadInventario();
    apiClient.get('/productos/').then(res => setProductos(res.data || []));
  }, []);

  const handleExportInventario = async () => {
    try {
      const params = new URLSearchParams();
      if (invSearch) params.set('search', invSearch);
      const res = await apiClient.get(`/reportes/inventario-actual/export?${params}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'inventario_actual.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch {
      toast.error('Error al exportar inventario');
    }
  };

  // ── Sort + filter + paginate ────────────────────────────────────────────────
  const invFiltered = useMemo(() => {
    const q = invSearch.toLowerCase();
    const filtered = inv.items.filter(it => it.nombre.toLowerCase().includes(q));
    return [...filtered].sort((a, b) => {
      if (invSortCol === 'nombre') {
        return invSortDir === 'asc'
          ? a.nombre.localeCompare(b.nombre)
          : b.nombre.localeCompare(a.nombre);
      }
      const fields = {
        stock:    'stock_actual',
        costo:    'costo',
        precio:   'precio',
        valCosto: 'valor_costo',
        valVenta: 'valor_venta',
      };
      const f = fields[invSortCol];
      if (f) return invSortDir === 'asc'
        ? (a[f] ?? 0) - (b[f] ?? 0)
        : (b[f] ?? 0) - (a[f] ?? 0);
      return 0;
    });
  }, [inv.items, invSearch, invSortCol, invSortDir]);

  const invPaginated = useMemo(() =>
    invFiltered.slice(invPage * invRowsPerPage, invPage * invRowsPerPage + invRowsPerPage),
    [invFiltered, invPage, invRowsPerPage]
  );

  // ── InvSortHeader helper (defined inside component to close over state) ──────
  const InvSortHeader = ({ col, label, align = 'left' }) => (
    <TableCell align={align}>
      <TableSortLabel
        active={invSortCol === col}
        direction={invSortCol === col ? invSortDir : 'asc'}
        onClick={() => {
          setInvSortDir(d => invSortCol === col ? (d === 'asc' ? 'desc' : 'asc') : 'asc');
          setInvSortCol(col);
        }}
      >
        {label}
      </TableSortLabel>
    </TableCell>
  );

  const TABS = [
    { label: 'Inventario', icon: <Inventory2Outlined fontSize="small" />, fullLabel: 'Inventario Actual' },
    { label: 'Rotación',   icon: <BarChart fontSize="small" />,           fullLabel: 'Rotación'          },
    { label: 'Kardex',     icon: <ReceiptLong fontSize="small" />,        fullLabel: 'Kardex (PPP)'      },
  ];

  return (
    <Box sx={{ width: '100%' }}>

      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5 }}>
        <Box sx={{ width: 38, height: 38, borderRadius: 2, bgcolor: `${ACCENT}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: ACCENT, flexShrink: 0 }}>
          <BarChart />
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontWeight: 700, fontSize: 18, lineHeight: 1.2 }}>Reportes de Inventario</Typography>
          <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>Inventario actual, rotación y kardex</Typography>
        </Box>
      </Box>

      {/* Tabs + contenido */}
      <Paper sx={{ borderRadius: 3, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', border: '1px solid', borderColor: 'divider', width: '100%', boxSizing: 'border-box' }}>
        <Tabs
          value={tab} onChange={(_, v) => setTab(v)}
          variant={isMobile ? 'fullWidth' : 'scrollable'}
          scrollButtons={isMobile ? false : 'auto'}
          sx={{
            borderBottom: '1px solid', borderColor: 'divider',
            '& .MuiTab-root': { fontWeight: 600, fontSize: 12, textTransform: 'none', minHeight: isMobile ? 48 : 52, minWidth: isMobile ? 0 : 'auto', px: isMobile ? 0.5 : 2 },
            '& .MuiTabs-indicator': { backgroundColor: ACCENT, height: 3, borderRadius: 3 },
            '& .Mui-selected': { color: `${ACCENT} !important` },
          }}
        >
          {TABS.map((t, i) => (
            <Tab key={i}
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
            <Typography sx={{ fontWeight: 700, fontSize: 13, color: ACCENT }}>{TABS[tab].fullLabel}</Typography>
          </Box>
        )}

        <Box sx={{ p: { xs: 1.5, md: 3 } }}>

          {/* ══ Tab 0: Inventario Actual ══ */}
          <TabPanel value={tab} index={0}>
            {/* KPIs */}
            <Grid container spacing={1.5} sx={{ mb: 2.5 }}>
              <Grid item xs={12} sm={4}>
                <KpiCard label="Valor a costo" value={formatCurrency(inv.total_valor_costo)} icon={<AttachMoney />} color={ACCENT} />
              </Grid>
              <Grid item xs={12} sm={4}>
                <KpiCard label="Valor a precio venta" value={formatCurrency(inv.total_valor_venta)} icon={<TrendingUp />} color={GREEN} />
              </Grid>
              <Grid item xs={12} sm={4}>
                <KpiCard label="Total ítems" value={inv.items.length} icon={<Inventory2Outlined />} color={BLUE} />
              </Grid>
            </Grid>

            {/* Toolbar */}
            <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
              <TextField
                placeholder="Buscar producto…"
                value={invSearch}
                onChange={e => { setInvSearch(e.target.value); setInvPage(0); }}
                size="small"
                sx={{ flex: 1, minWidth: isMobile ? '100%' : 200 }}
                InputProps={{
                  startAdornment: <InputAdornment position="start"><Search sx={{ color: 'text.secondary', fontSize: 18 }} /></InputAdornment>,
                }}
              />
              <Button size="small" startIcon={<Refresh />} onClick={loadInventario} variant="outlined"
                disabled={invLoading}
                sx={{ borderRadius: 2, fontWeight: 600, borderColor: 'divider', color: 'text.secondary', whiteSpace: 'nowrap', flexShrink: 0 }}>
                {invLoading ? <CircularProgress size={14} /> : 'Actualizar'}
              </Button>
              <Button size="small" startIcon={<Download />} variant="contained"
                onClick={handleExportInventario}
                sx={{ background: `linear-gradient(135deg, ${ACCENT}, #fcd34d)`, borderRadius: 2, fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0 }}>
                Excel
              </Button>
            </Box>

            {/* Mobile: cards */}
            {isMobile ? (
              <Box>
                {invFiltered.length === 0
                  ? <Box sx={{ textAlign: 'center', py: 5, color: 'text.secondary' }}><Typography>Sin resultados</Typography></Box>
                  : invFiltered.map(it => (
                    <Paper key={it.id} sx={{ p: 2, mb: 1.5, borderRadius: 2.5, border: '1px solid', borderColor: 'divider' }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <Box sx={{ minWidth: 0, flex: 1 }}>
                          <Typography sx={{ fontWeight: 700, fontSize: 13, mb: 0.3 }}>{it.nombre}</Typography>
                          <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{it.unidad_medida || '—'}</Typography>
                        </Box>
                        <Box sx={{ textAlign: 'right', flexShrink: 0, ml: 1 }}>
                          <Typography sx={{ fontSize: 15, fontWeight: 800, color: ACCENT }}>
                            {it.stock_actual} <Typography component="span" sx={{ fontSize: 10, fontWeight: 400, color: 'text.secondary' }}>uds.</Typography>
                          </Typography>
                        </Box>
                      </Box>
                      <Divider sx={{ my: 1 }} />
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                        <Box>
                          <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>Val. costo</Typography>
                          <Typography sx={{ fontSize: 13, fontWeight: 700, color: ACCENT }}>{formatCurrency(it.valor_costo)}</Typography>
                        </Box>
                        <Box sx={{ textAlign: 'right' }}>
                          <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>Val. venta</Typography>
                          <Typography sx={{ fontSize: 13, fontWeight: 700, color: GREEN }}>{formatCurrency(it.valor_venta)}</Typography>
                        </Box>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
                        <Box>
                          <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>Margen</Typography>
                          <MargenChip precio={it.precio} costo={it.costo} />
                        </Box>
                      </Box>
                    </Paper>
                  ))
                }
              </Box>
            ) : (
              /* Desktop: tabla */
              <>
                <TableContainer sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider', overflowX: 'auto' }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>#</TableCell>
                        <InvSortHeader col="nombre"   label="Nombre"    align="left"  />
                        <TableCell>Unidad</TableCell>
                        <InvSortHeader col="stock"    label="Stock"     align="right" />
                        <InvSortHeader col="costo"    label="Costo"     align="right" />
                        <InvSortHeader col="precio"   label="Precio"    align="right" />
                        <InvSortHeader col="valCosto" label="Val. Costo" align="right" />
                        <InvSortHeader col="valVenta" label="Val. Venta" align="right" />
                        <TableCell align="right">Margen</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {invPaginated.length === 0
                        ? <TableRow><TableCell colSpan={9} sx={{ textAlign: 'center', py: 5, color: 'text.secondary' }}>No hay ítems</TableCell></TableRow>
                        : invPaginated.map(it => (
                          <TableRow key={it.id} hover>
                            <TableCell sx={{ fontWeight: 600, color: 'text.secondary', fontSize: 12 }}>#{it.id}</TableCell>
                            <TableCell>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Typography sx={{ fontWeight: 600, fontSize: 13 }}>{it.nombre}</Typography>
                                {it.es_servicio && <Chip label="Servicio" size="small" sx={{ fontSize: 9, height: 16, borderRadius: 1 }} />}
                              </Box>
                            </TableCell>
                            <TableCell sx={{ fontSize: 12 }}>{it.unidad_medida || '—'}</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700 }}>{it.stock_actual}</TableCell>
                            <TableCell align="right">{formatCurrency(it.costo)}</TableCell>
                            <TableCell align="right">{formatCurrency(it.precio)}</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700, color: ACCENT }}>{formatCurrency(it.valor_costo)}</TableCell>
                            <TableCell align="right" sx={{ color: GREEN, fontWeight: 600 }}>{formatCurrency(it.valor_venta)}</TableCell>
                            <TableCell align="right"><MargenChip precio={it.precio} costo={it.costo} /></TableCell>
                          </TableRow>
                        ))
                      }
                    </TableBody>
                  </Table>
                </TableContainer>
                <TablePagination
                  rowsPerPageOptions={[10, 25, 50, 100]}
                  component="div"
                  count={invFiltered.length}
                  rowsPerPage={invRowsPerPage}
                  page={invPage}
                  onPageChange={(_, p) => setInvPage(p)}
                  onRowsPerPageChange={e => { setInvRowsPerPage(parseInt(e.target.value, 10)); setInvPage(0); }}
                  labelRowsPerPage="Filas:"
                  labelDisplayedRows={({ from, to, count }) => `${from}-${to} de ${count}`}
                  sx={{
                    '& .MuiTablePagination-toolbar': { flexWrap: 'wrap', pl: 0 },
                    '& .MuiTablePagination-spacer': { display: 'none' },
                    '& .MuiTablePagination-displayedRows': { fontSize: 11 },
                    '& .MuiTablePagination-selectLabel': { fontSize: 11 },
                  }}
                />
              </>
            )}
          </TabPanel>

          {/* ══ Tab 1: Rotación ══ */}
          <TabPanel value={tab} index={1}>
            <Paper sx={{ p: 2, borderRadius: 2.5, mb: 3, boxShadow: 'none', border: '1px solid', borderColor: 'divider' }}>
              <Typography sx={{ fontWeight: 600, fontSize: 11, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.6, mb: 1.5 }}>
                Parámetros
              </Typography>
              <Grid container spacing={1.5} alignItems="flex-end">
                <Grid item xs={6} sm={3}>
                  <TextField type="date" label="Desde" size="small" value={rotStart}
                    onChange={e => setRotStart(e.target.value)} InputLabelProps={{ shrink: true }} fullWidth />
                </Grid>
                <Grid item xs={6} sm={3}>
                  <TextField type="date" label="Hasta" size="small" value={rotEnd}
                    onChange={e => setRotEnd(e.target.value)} InputLabelProps={{ shrink: true }} fullWidth />
                </Grid>
                <Grid item xs={6} sm={2}>
                  <TextField type="number" label="Top N" size="small" value={rotLimit}
                    onChange={e => setRotLimit(parseInt(e.target.value || '10', 10))} fullWidth />
                </Grid>
                <Grid item xs={6} sm={2}>
                  <TextField select label="Servicios" size="small"
                    SelectProps={{ native: true }}
                    value={rotIncServ ? '1' : '0'}
                    onChange={e => setRotIncServ(e.target.value === '1')} fullWidth>
                    <option value="0">No incluir</option>
                    <option value="1">Incluir</option>
                  </TextField>
                </Grid>
                <Grid item xs={12} sm={2}>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button variant="contained" onClick={loadRotacion} fullWidth size="small"
                      disabled={rotLoading}
                      startIcon={rotLoading ? <CircularProgress size={14} color="inherit" /> : <BarChart />}
                      sx={{ background: `linear-gradient(135deg, ${ACCENT}, #fcd34d)`, borderRadius: 2, fontWeight: 600 }}>
                      {rotLoading ? 'Cargando…' : 'Consultar'}
                    </Button>
                    <Tooltip title="Exportar Rotación a Excel">
                      <span>
                        <Button variant="outlined" onClick={handleExportRotacion} size="small"
                          disabled={rotLoading || !rotLoaded}
                          sx={{ borderRadius: 2, minWidth: 44, p: 0, height: 38, borderColor: 'divider', color: 'text.secondary' }}>
                          <Download fontSize="small" />
                        </Button>
                      </span>
                    </Tooltip>
                  </Box>
                </Grid>
              </Grid>
            </Paper>

            {!rotLoaded ? (
              <Box sx={{ textAlign: 'center', py: 8, color: 'text.secondary' }}>
                <BarChart sx={{ fontSize: 52, mb: 1.5, opacity: 0.25 }} />
                <Typography>Define los parámetros y presiona Consultar</Typography>
              </Box>
            ) : (
              <Grid container spacing={2.5}>
                <Grid item xs={12} md={6}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                    <TrendingUp sx={{ color: GREEN, fontSize: 20 }} />
                    <Typography sx={{ fontWeight: 700, fontSize: 14 }}>Más vendidos</Typography>
                    <Chip label={`Top ${rotLimit}`} size="small" sx={{ bgcolor: `${GREEN}12`, color: GREEN, fontWeight: 600, fontSize: 10 }} />
                  </Box>
                  {isMobile
                    ? <RotCards rows={rot.top} emptyText="Sin datos de ventas en el período" accentPill={GREEN} />
                    : <RotTable rows={rot.top} emptyText="Sin datos de ventas en el período" />
                  }
                </Grid>
                <Grid item xs={12} md={6}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                    <TrendingDown sx={{ color: RED, fontSize: 20 }} />
                    <Typography sx={{ fontWeight: 700, fontSize: 14 }}>Menor rotación</Typography>
                    <Chip label={`Top ${rotLimit}`} size="small" sx={{ bgcolor: `${RED}12`, color: RED, fontWeight: 600, fontSize: 10 }} />
                  </Box>
                  {isMobile
                    ? <RotCards rows={rot.slow} emptyText="Sin datos de rotación baja" accentPill={RED} />
                    : <RotTable rows={rot.slow} emptyText="Sin datos de rotación baja" />
                  }
                </Grid>
              </Grid>
            )}
          </TabPanel>

          {/* ══ Tab 2: Kardex ══ */}
          <TabPanel value={tab} index={2}>
            <Paper sx={{ p: 2, borderRadius: 2.5, mb: 2.5, boxShadow: 'none', border: '1px solid', borderColor: 'divider' }}>
              <Typography sx={{ fontWeight: 600, fontSize: 11, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.6, mb: 1.5 }}>
                Producto y rango de fechas
              </Typography>
              {/* Fila 1: selector de producto — siempre ancho completo */}
              <Autocomplete
                options={productos}
                getOptionLabel={o => o ? o.nombre : ''}
                value={producto}
                onChange={(_, v) => setProducto(v)}
                renderOption={(props, o) => (
                  <li {...props} key={o.id}>
                    <Box>
                      <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{o.nombre}</Typography>
                      <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>Stock: {o.stock_actual ?? 0}</Typography>
                    </Box>
                  </li>
                )}
                renderInput={params => <TextField {...params} label="Producto" size="small" fullWidth />}
                ListboxProps={{ style: { maxHeight: 280 } }}
                fullWidth
                sx={{ mb: 1.5 }}
              />

              {/* Fila 2: fechas + botones */}
              <Grid container spacing={1.5} alignItems="center">
                <Grid item xs={6} sm={3}>
                  <TextField type="date" label="Inicio" size="small" value={kStart}
                    onChange={e => setKStart(e.target.value)} InputLabelProps={{ shrink: true }} fullWidth />
                </Grid>
                <Grid item xs={6} sm={3}>
                  <TextField type="date" label="Fin" size="small" value={kEnd}
                    onChange={e => setKEnd(e.target.value)} InputLabelProps={{ shrink: true }} fullWidth />
                </Grid>
                <Grid item xs={8} sm={4}>
                  <Button variant="contained" onClick={loadKardex} disabled={!producto || kLoading}
                    startIcon={kLoading ? <CircularProgress size={14} color="inherit" /> : <ReceiptLong />}
                    fullWidth size="small"
                    sx={{ background: `linear-gradient(135deg, ${ACCENT}, #fcd34d)`, borderRadius: 2, fontWeight: 600 }}>
                    {kLoading ? 'Cargando…' : 'Consultar'}
                  </Button>
                </Grid>
                <Grid item xs={4} sm={2}>
                  <Tooltip title="Exportar Kardex a Excel">
                    <span style={{ display: 'block' }}>
                      <Button variant="outlined" disabled={!producto} fullWidth size="small"
                        startIcon={<Download />}
                        onClick={handleExportKardex}
                        sx={{ borderRadius: 2, fontWeight: 600, borderColor: 'divider' }}>
                        Excel
                      </Button>
                    </span>
                  </Tooltip>
                </Grid>
              </Grid>
            </Paper>

            {!kLoaded ? (
              <Box sx={{ textAlign: 'center', py: 8, color: 'text.secondary' }}>
                <ReceiptLong sx={{ fontSize: 52, mb: 1.5, opacity: 0.25 }} />
                <Typography>Selecciona un producto y presiona Consultar</Typography>
              </Box>
            ) : kRows.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 6, color: 'text.secondary' }}>
                <Typography>Sin movimientos en el período</Typography>
              </Box>
            ) : (
              <>
                {/* Mini KPIs kardex */}
                <Box sx={{ display: 'flex', gap: 1.5, mb: 2.5, flexWrap: 'wrap' }}>
                  {[
                    { label: 'Movimientos',    val: kRows.length,                                                       color: BLUE      },
                    { label: 'Saldo final',    val: kRows[kRows.length - 1]?.saldo_cantidad ?? 0,                      color: ACCENT    },
                    { label: 'Valor final',    val: formatCurrency(kRows[kRows.length - 1]?.saldo_valor ?? 0),         color: GREEN     },
                    { label: 'Costo promedio', val: formatCurrency(kRows[kRows.length - 1]?.saldo_costo_unitario ?? 0),color: '#8B5CF6' },
                  ].map(({ label, val, color }) => (
                    <Box key={label} sx={{ px: 2, py: 1, borderRadius: 2, bgcolor: `${color}0D`, border: `1px solid ${color}25`, minWidth: isMobile ? 'calc(50% - 8px)' : 'auto' }}>
                      <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>{label}</Typography>
                      <Typography sx={{ fontWeight: 700, fontSize: 14, color }}>{val}</Typography>
                    </Box>
                  ))}
                </Box>

                {/* Mobile: cards */}
                {isMobile ? (
                  <Box>
                    {kRows.map((r, i) => (
                      <Paper key={i} sx={{ p: 2, mb: 1.5, borderRadius: 2.5, border: '1px solid', borderColor: 'divider' }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                          <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
                            {new Date(r.fecha).toLocaleDateString('es-CO', { timeZone: 'America/Bogota', day: '2-digit', month: 'short', year: 'numeric' })}
                          </Typography>
                          <TipoChip tipo={r.tipo} />
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Box>
                            <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>Cantidad</Typography>
                            <Typography sx={{ fontWeight: 800, fontSize: 14 }}>{r.cantidad}</Typography>
                          </Box>
                          <Box sx={{ textAlign: 'center' }}>
                            <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>Saldo</Typography>
                            <Typography sx={{ fontWeight: 800, fontSize: 14, color: ACCENT }}>{r.saldo_cantidad}</Typography>
                          </Box>
                          <Box sx={{ textAlign: 'right' }}>
                            <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>Val. saldo</Typography>
                            <Typography sx={{ fontWeight: 700, fontSize: 13, color: GREEN }}>{formatCurrency(r.saldo_valor)}</Typography>
                          </Box>
                        </Box>
                        {r.referencia && (
                          <Typography sx={{ fontSize: 11, color: 'text.secondary', mt: 0.5 }}>Ref: {r.referencia}</Typography>
                        )}
                      </Paper>
                    ))}
                  </Box>
                ) : (
                  /* Desktop: tabla completa */
                  <TableContainer sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider', overflowX: 'auto' }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          {['Fecha', 'Tipo', 'Cantidad', 'Costo Unit.', 'Referencia', 'Saldo Cant.', 'Saldo Costo', 'Saldo Valor'].map(h => (
                            <TableCell key={h} align={['Cantidad','Costo Unit.','Saldo Cant.','Saldo Costo','Saldo Valor'].includes(h) ? 'right' : 'left'}>
                              {h}
                            </TableCell>
                          ))}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {kRows.map((r, i) => (
                          <TableRow key={i} hover>
                            <TableCell sx={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                              {new Date(r.fecha).toLocaleDateString('es-CO', { timeZone: 'America/Bogota', day: '2-digit', month: 'short', year: 'numeric' })}
                            </TableCell>
                            <TableCell><TipoChip tipo={r.tipo} /></TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700 }}>{r.cantidad}</TableCell>
                            <TableCell align="right">{formatCurrency(r.costo_unitario)}</TableCell>
                            <TableCell sx={{ fontSize: 12, color: 'text.secondary' }}>{r.referencia || '—'}</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700, color: ACCENT }}>{r.saldo_cantidad}</TableCell>
                            <TableCell align="right">{formatCurrency(r.saldo_costo_unitario)}</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700, color: GREEN }}>{formatCurrency(r.saldo_valor)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </>
            )}
          </TabPanel>
        </Box>
      </Paper>
    </Box>
  );
}
