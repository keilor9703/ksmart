import React, { useEffect, useState } from 'react';
import {
  Box, Typography, Grid, TextField, Button, Table, TableHead, TableRow,
  TableCell, TableBody, Tabs, Tab, Chip, TableContainer, Divider,
  Autocomplete, useMediaQuery, Paper, InputAdornment, Tooltip
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  Inventory2Outlined, Refresh, Download, TrendingUp, TrendingDown,
  Search, BarChart, ReceiptLong, AttachMoney
} from '@mui/icons-material';
import apiClient from '../api';
import { formatCurrency } from '../utils/formatters';

const ACCENT = '#F59E0B';
const GREEN  = '#10B981';
const RED    = '#EF4444';
const BLUE   = '#3B82F6';

function TabPanel({ children, value, index }) {
  return (
    <div role="tabpanel" hidden={value !== index}>
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
const KpiCard = ({ label, value, icon, color }) => (
  <Paper sx={{ p: 2, borderRadius: 2.5, display: 'flex', alignItems: 'center', gap: 1.5, boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
    <Box sx={{ width: 40, height: 40, borderRadius: 1.5, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: `${color}18`, color }}>
      {icon}
    </Box>
    <Box>
      <Typography sx={{ fontSize: 11, color: 'text.secondary', fontWeight: 500 }}>{label}</Typography>
      <Typography sx={{ fontSize: 16, fontWeight: 700, color: 'text.primary' }}>{value}</Typography>
    </Box>
  </Paper>
);

// ─── Tabla de rotación ────────────────────────────────────────────────────────
const RotTable = ({ rows, emptyText }) => (
  <TableContainer sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell>Producto</TableCell>
          <TableCell align="right">Cantidad vendida</TableCell>
          <TableCell align="right">Ingresos</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.length === 0
          ? <TableRow>
              <TableCell colSpan={3} sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
                {emptyText}
              </TableCell>
            </TableRow>
          : rows.map((r, i) => (
              <TableRow key={r.producto_id} hover>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{
                      width: 22, height: 22, borderRadius: 1, flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      bgcolor: i < 3 ? `${ACCENT}20` : 'action.hover',
                      fontSize: 10, fontWeight: 700, color: i < 3 ? ACCENT : 'text.secondary',
                    }}>
                      {i + 1}
                    </Box>
                    <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{r.nombre}</Typography>
                    {r.es_servicio && (
                      <Chip label="Servicio" size="small" sx={{ fontSize: 9, height: 16, borderRadius: 1 }} />
                    )}
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

// ─── Componente principal ──────────────────────────────────────────────────────
export default function InventoryReports() {
  const [tab, setTab]   = useState(0);
  const theme           = useTheme();
  const isMobile        = useMediaQuery(theme.breakpoints.down('sm'));

  // Inventario actual
  const [inv, setInv] = useState({ items: [], total_valor_costo: 0, total_valor_venta: 0 });
  const [invSearch, setInvSearch] = useState('');

  // Rotación
  const [rotStart, setRotStart]     = useState('');
  const [rotEnd, setRotEnd]         = useState('');
  const [rotLimit, setRotLimit]     = useState(10);
  const [rotIncServ, setRotIncServ] = useState(false);
  const [rot, setRot]               = useState({ top: [], slow: [] });
  const [rotLoaded, setRotLoaded]   = useState(false);

  // Kardex
  const [productos, setProductos] = useState([]);
  const [producto, setProducto]   = useState(null);
  const [kStart, setKStart]       = useState('');
  const [kEnd, setKEnd]           = useState('');
  const [kRows, setKRows]         = useState([]);
  const [kLoaded, setKLoaded]     = useState(false);

  const loadInventario = async () => {
    try {
      const { data } = await apiClient.get('/reportes/inventario-actual');
      setInv(data);
    } catch (e) { console.error(e); }
  };

  const loadRotacion = async () => {
    const params = { limit: rotLimit, incluir_servicios: rotIncServ };
    if (rotStart) params.start_date = rotStart;
    if (rotEnd)   params.end_date   = rotEnd;
    const { data } = await apiClient.get('/reportes/rotacion', { params });
    setRot(data); setRotLoaded(true);
  };

  const loadKardex = async () => {
    if (!producto) return;
    const params = {};
    if (kStart) params.start_date = kStart;
    if (kEnd)   params.end_date   = kEnd;
    const { data } = await apiClient.get(`/inventario/kardex/${producto.id}`, { params });
    setKRows(data.items || []); setKLoaded(true);
  };

  useEffect(() => {
    loadInventario();
    apiClient.get('/productos/').then(res => setProductos(res.data || []));
  }, []);

  // Filtrado inventario actual
  const invFiltered = inv.items.filter(it =>
    it.nombre.toLowerCase().includes(invSearch.toLowerCase())
  );

  // Tipo chip del kardex
  const tipoChip = (tipo) => {
    const map = {
      entrada: { color: GREEN,  label: '↑ Entrada' },
      salida:  { color: RED,    label: '↓ Salida'  },
      ajuste:  { color: ACCENT, label: '⟳ Ajuste'  },
      venta:   { color: RED,    label: '⬇ Venta'   },
      compra:  { color: GREEN,  label: '⬆ Compra'  },
    };
    const p = map[tipo] || { color: '#94a3b8', label: tipo };
    return (
      <Chip label={p.label} size="small"
        sx={{ bgcolor: `${p.color}18`, color: p.color, fontWeight: 700, fontSize: 10, borderRadius: 1.5 }} />
    );
  };

  return (
    <Box sx={{ width: '100%' }}>

      {/* ── Header ── */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
        <Box sx={{ width: 40, height: 40, borderRadius: 2, bgcolor: `${ACCENT}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: ACCENT }}>
          <BarChart />
        </Box>
        <Box>
          <Typography sx={{ fontWeight: 700, fontSize: 20, lineHeight: 1.2 }}>Reportes de Inventario</Typography>
          <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>Inventario actual, rotación y kardex</Typography>
        </Box>
      </Box>

      {/* ── Tabs ── */}
      <Paper sx={{ borderRadius: 3, overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', border: '1px solid', borderColor: 'divider' }}>
        <Tabs
          value={tab} onChange={(_, v) => setTab(v)}
          sx={{
            px: 2, borderBottom: '1px solid', borderColor: 'divider',
            '& .MuiTab-root': { fontWeight: 600, fontSize: 13.5, textTransform: 'none', minHeight: 52 },
            '& .MuiTabs-indicator': { backgroundColor: ACCENT, height: 3, borderRadius: 3 },
            '& .Mui-selected': { color: `${ACCENT} !important` },
          }}
        >
          <Tab label="📦 Inventario Actual" />
          <Tab label="📊 Rotación" />
          <Tab label="📋 Kardex" />
        </Tabs>

        <Box sx={{ p: { xs: 2, md: 3 } }}>

          {/* ══ Tab 0: Inventario Actual ══ */}
          <TabPanel value={tab} index={0}>
            {/* KPIs */}
            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid item xs={12} sm={4}>
                <KpiCard label="Valor a costo" value={formatCurrency(inv.total_valor_costo)} icon={<AttachMoney />} color={ACCENT} />
              </Grid>
              <Grid item xs={12} sm={4}>
                <KpiCard label="Valor a precio de venta" value={formatCurrency(inv.total_valor_venta)} icon={<TrendingUp />} color={GREEN} />
              </Grid>
              <Grid item xs={12} sm={4}>
                <KpiCard label="Total ítems" value={inv.items.length} icon={<Inventory2Outlined />} color={BLUE} />
              </Grid>
            </Grid>

            {/* Toolbar */}
            <Box sx={{ display: 'flex', gap: 1.5, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
              <TextField
                placeholder="Buscar producto…"
                value={invSearch}
                onChange={e => setInvSearch(e.target.value)}
                sx={{ flex: 1, minWidth: 200 }}
                InputProps={{
                  startAdornment: <InputAdornment position="start"><Search sx={{ color: 'text.secondary', fontSize: 20 }} /></InputAdornment>,
                }}
              />
              <Button startIcon={<Refresh />} onClick={loadInventario} variant="outlined"
                sx={{ borderRadius: 2, fontWeight: 600, borderColor: 'divider', color: 'text.secondary', whiteSpace: 'nowrap' }}>
                Actualizar
              </Button>
              <Button
                startIcon={<Download />} variant="contained"
                onClick={() => window.open(`${apiClient.defaults.baseURL}/reportes/inventario-actual/export`, '_blank')}
                sx={{ background: `linear-gradient(135deg, ${ACCENT}, #fcd34d)`, boxShadow: `0 4px 14px rgba(245,158,11,0.3)`, borderRadius: 2, fontWeight: 600, whiteSpace: 'nowrap' }}
              >
                Exportar CSV
              </Button>
            </Box>

            <TableContainer sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>#</TableCell>
                    <TableCell>Nombre</TableCell>
                    {!isMobile && <TableCell>Unidad</TableCell>}
                    <TableCell align="right">Stock</TableCell>
                    {!isMobile && <TableCell align="right">Costo</TableCell>}
                    {!isMobile && <TableCell align="right">Precio</TableCell>}
                    <TableCell align="right">Val. Costo</TableCell>
                    {!isMobile && <TableCell align="right">Val. Venta</TableCell>}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {invFiltered.length === 0
                    ? <TableRow>
                        <TableCell colSpan={8} sx={{ textAlign: 'center', py: 5, color: 'text.secondary' }}>
                          No hay items
                        </TableCell>
                      </TableRow>
                    : invFiltered.map(it => (
                        <TableRow key={it.id} hover>
                          <TableCell sx={{ fontWeight: 600, color: 'text.secondary', fontSize: 12 }}>#{it.id}</TableCell>
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Typography sx={{ fontWeight: 600, fontSize: 13 }}>{it.nombre}</Typography>
                              {it.es_servicio && (
                                <Chip label="Servicio" size="small" sx={{ fontSize: 9, height: 16, borderRadius: 1 }} />
                              )}
                            </Box>
                          </TableCell>
                          {!isMobile && <TableCell sx={{ fontSize: 12 }}>{it.unidad_medida || '—'}</TableCell>}
                          <TableCell align="right" sx={{ fontWeight: 700 }}>{it.stock_actual}</TableCell>
                          {!isMobile && <TableCell align="right">{formatCurrency(it.costo)}</TableCell>}
                          {!isMobile && <TableCell align="right">{formatCurrency(it.precio)}</TableCell>}
                          <TableCell align="right" sx={{ fontWeight: 700, color: ACCENT }}>{formatCurrency(it.valor_costo)}</TableCell>
                          {!isMobile && <TableCell align="right" sx={{ color: GREEN, fontWeight: 600 }}>{formatCurrency(it.valor_venta)}</TableCell>}
                        </TableRow>
                      ))
                  }
                </TableBody>
              </Table>
            </TableContainer>
          </TabPanel>

          {/* ══ Tab 1: Rotación ══ */}
          <TabPanel value={tab} index={1}>
            {/* Filtros */}
            <Paper sx={{ p: 2.5, borderRadius: 2.5, mb: 3, boxShadow: 'none', border: '1px solid', borderColor: 'divider' }}>
              <Typography sx={{ fontWeight: 600, fontSize: 12, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.6, mb: 2 }}>
                Parámetros de consulta
              </Typography>
              <Grid container spacing={2} alignItems="flex-end">
                <Grid item xs={6} md={3}>
                  <TextField type="date" label="Fecha inicio" value={rotStart}
                    onChange={e => setRotStart(e.target.value)} InputLabelProps={{ shrink: true }} fullWidth />
                </Grid>
                <Grid item xs={6} md={3}>
                  <TextField type="date" label="Fecha fin" value={rotEnd}
                    onChange={e => setRotEnd(e.target.value)} InputLabelProps={{ shrink: true }} fullWidth />
                </Grid>
                <Grid item xs={6} md={2}>
                  <TextField type="number" label="Top N" value={rotLimit}
                    onChange={e => setRotLimit(parseInt(e.target.value || '10', 10))} fullWidth />
                </Grid>
                <Grid item xs={6} md={2}>
                  <TextField select label="Incluir servicios"
                    SelectProps={{ native: true }}
                    value={rotIncServ ? '1' : '0'}
                    onChange={e => setRotIncServ(e.target.value === '1')} fullWidth>
                    <option value="0">No</option>
                    <option value="1">Sí</option>
                  </TextField>
                </Grid>
                <Grid item xs={12} md={2}>
                  <Button variant="contained" onClick={loadRotacion} fullWidth
                    sx={{ background: `linear-gradient(135deg, ${ACCENT}, #fcd34d)`, boxShadow: `0 4px 14px rgba(245,158,11,0.3)`, borderRadius: 2, fontWeight: 600 }}>
                    Consultar
                  </Button>
                </Grid>
              </Grid>
            </Paper>

            {!rotLoaded ? (
              <Box sx={{ textAlign: 'center', py: 8, color: 'text.secondary' }}>
                <BarChart sx={{ fontSize: 56, mb: 1.5, opacity: 0.25 }} />
                <Typography>Define los parámetros y presiona Consultar</Typography>
              </Box>
            ) : (
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                    <TrendingUp sx={{ color: GREEN }} />
                    <Typography sx={{ fontWeight: 700, fontSize: 15 }}>Más vendidos</Typography>
                    <Chip label={`Top ${rotLimit}`} size="small"
                      sx={{ bgcolor: `${GREEN}12`, color: GREEN, fontWeight: 600, fontSize: 10 }} />
                  </Box>
                  <RotTable rows={rot.top} emptyText="Sin datos de ventas en el período" />
                </Grid>
                <Grid item xs={12} md={6}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                    <TrendingDown sx={{ color: RED }} />
                    <Typography sx={{ fontWeight: 700, fontSize: 15 }}>Menor rotación</Typography>
                    <Chip label={`Top ${rotLimit}`} size="small"
                      sx={{ bgcolor: `${RED}12`, color: RED, fontWeight: 600, fontSize: 10 }} />
                  </Box>
                  <RotTable rows={rot.slow} emptyText="Sin datos de rotación baja" />
                </Grid>
              </Grid>
            )}
          </TabPanel>

          {/* ══ Tab 2: Kardex ══ */}
          <TabPanel value={tab} index={2}>
            {/* Filtros */}
            <Paper sx={{ p: 2.5, borderRadius: 2.5, mb: 3, boxShadow: 'none', border: '1px solid', borderColor: 'divider' }}>
              <Typography sx={{ fontWeight: 600, fontSize: 12, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.6, mb: 2 }}>
                Selecciona el producto y rango de fechas
              </Typography>
              <Grid container spacing={2} alignItems="flex-end">
                <Grid item xs={12} md={4}>
                  <Autocomplete
                    options={productos}
                    getOptionLabel={o => o ? `${o.nombre} (ID: ${o.id})` : ''}
                    value={producto}
                    onChange={(_, v) => setProducto(v)}
                    renderInput={params => <TextField {...params} label="Producto" />}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={6} md={2}>
                  <TextField type="date" label="Inicio" value={kStart}
                    onChange={e => setKStart(e.target.value)} InputLabelProps={{ shrink: true }} fullWidth />
                </Grid>
                <Grid item xs={6} md={2}>
                  <TextField type="date" label="Fin" value={kEnd}
                    onChange={e => setKEnd(e.target.value)} InputLabelProps={{ shrink: true }} fullWidth />
                </Grid>
                <Grid item xs={12} md={4} sx={{ display: 'flex', gap: 1 }}>
                  <Button variant="contained" onClick={loadKardex} disabled={!producto} fullWidth
                    sx={{ background: `linear-gradient(135deg, ${ACCENT}, #fcd34d)`, boxShadow: `0 4px 14px rgba(245,158,11,0.3)`, borderRadius: 2, fontWeight: 600 }}>
                    Consultar
                  </Button>
                  <Tooltip title="Exportar Kardex a CSV">
                    <span style={{ flex: 1 }}>
                      <Button variant="outlined" disabled={!producto} fullWidth
                        startIcon={<Download />}
                        onClick={() => {
                          const params = new URLSearchParams();
                          if (kStart) params.set('start_date', kStart);
                          if (kEnd)   params.set('end_date', kEnd);
                          window.open(`${apiClient.defaults.baseURL}/inventario/kardex/${producto.id}/export?${params}`, '_blank');
                        }}
                        sx={{ borderRadius: 2, fontWeight: 600, borderColor: 'divider' }}>
                        CSV
                      </Button>
                    </span>
                  </Tooltip>
                </Grid>
              </Grid>
            </Paper>

            {!kLoaded ? (
              <Box sx={{ textAlign: 'center', py: 8, color: 'text.secondary' }}>
                <ReceiptLong sx={{ fontSize: 56, mb: 1.5, opacity: 0.25 }} />
                <Typography>Selecciona un producto y presiona Consultar</Typography>
              </Box>
            ) : kRows.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 6, color: 'text.secondary' }}>
                <Typography>No hay movimientos para este producto en el período</Typography>
              </Box>
            ) : (
              <>
                {/* Resumen kardex */}
                {kRows.length > 0 && (
                  <Box sx={{ display: 'flex', gap: 2, mb: 2.5, flexWrap: 'wrap' }}>
                    {[
                      { label: 'Movimientos',    val: kRows.length,                                                    color: BLUE   },
                      { label: 'Saldo final',    val: kRows[kRows.length - 1]?.saldo_cantidad ?? 0,                   color: ACCENT },
                      { label: 'Valor final',    val: formatCurrency(kRows[kRows.length - 1]?.saldo_valor ?? 0),      color: GREEN  },
                      { label: 'Costo promedio', val: formatCurrency(kRows[kRows.length - 1]?.saldo_costo_unitario ?? 0), color: '#8B5CF6' },
                    ].map(({ label, val, color }) => (
                      <Box key={label} sx={{ px: 2, py: 1, borderRadius: 2, bgcolor: `${color}0D`, border: `1px solid ${color}25` }}>
                        <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>{label}</Typography>
                        <Typography sx={{ fontWeight: 700, fontSize: 15, color }}>{val}</Typography>
                      </Box>
                    ))}
                  </Box>
                )}

                <TableContainer sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
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
                          <TableCell sx={{ fontSize: 12, whiteSpace: 'nowrap' }}>{new Date(r.fecha).toLocaleString()}</TableCell>
                          <TableCell>{tipoChip(r.tipo)}</TableCell>
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
              </>
            )}
          </TabPanel>
        </Box>
      </Paper>
    </Box>
  );
}
