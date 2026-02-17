// src/components/InventoryReports.js
import React, { useEffect, useState } from 'react';
import {
  Paper, Box, Typography, Grid, TextField, Button, Table, TableHead, TableRow, TableCell, TableBody,
  Tabs, Tab, Chip, TableContainer, Divider, Autocomplete, useMediaQuery
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import apiClient from '../api';
import { formatCurrency } from '../utils/formatters';

function TabPanel({ children, value, index }) {
  return <div role="tabpanel" hidden={value !== index}>{value === index && <Box sx={{ p: 2 }}>{children}</Box>}</div>;
}

export default function InventoryReports() {
  const [tab, setTab] = useState(0);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // ---------- Inventario Actual ----------
  const [inv, setInv] = useState({ items: [], total_valor_costo: 0, total_valor_venta: 0 });
  const loadInventario = async () => {
    const { data } = await apiClient.get('/reportes/inventario-actual');
    setInv(data);
  };

  // ---------- Rotación ----------
  const [rotStart, setRotStart] = useState('');
  const [rotEnd, setRotEnd] = useState('');
  const [rotLimit, setRotLimit] = useState(10);
  const [rotIncServ, setRotIncServ] = useState(false);
  const [rot, setRot] = useState({ top: [], slow: [] });
  const loadRotacion = async () => {
    const params = { limit: rotLimit, incluir_servicios: rotIncServ };
    if (rotStart) params.start_date = rotStart;
    if (rotEnd) params.end_date = rotEnd;
    const { data } = await apiClient.get('/reportes/rotacion', { params });
    setRot(data);
  };

  // ---------- Kardex ----------
  const [productos, setProductos] = useState([]);
  const [producto, setProducto] = useState(null);
  const [kStart, setKStart] = useState('');
  const [kEnd, setKEnd] = useState('');
  const [kRows, setKRows] = useState([]);

  const loadKardex = async () => {
    if (!producto) return;
    const params = {};
    if (kStart) params.start_date = kStart;
    if (kEnd) params.end_date = kEnd;
    const { data } = await apiClient.get(`/inventario/kardex/${producto.id}`, { params });
    setKRows(data.items || []);
  };

  useEffect(() => {
    loadInventario();
    apiClient.get('/productos/').then(res => setProductos(res.data || []));
  }, []);

  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 2 }}>Reportes de Inventario</Typography>

      <Paper>
        <Tabs value={tab} onChange={(_, v) => setTab(v)}>
          <Tab label="Inventario Actual" />
          <Tab label="Rotación (Top / Slow)" />
          <Tab label="Kardex" />
        </Tabs>

        {/* --------- INVENTARIO ACTUAL --------- */}
        <TabPanel value={tab} index={0}>
          <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
            <Button variant="outlined" onClick={loadInventario}>Actualizar</Button>
            <Button
              variant="contained"
              onClick={() => window.open(`${apiClient.defaults.baseURL}/reportes/inventario-actual/export`, '_blank')}
            >
              Exportar CSV
            </Button>
          </Box>

          <Typography variant="subtitle1" sx={{ mb: 1 }}>
            Totales — Valor a Costo: {formatCurrency(inv.total_valor_costo)} | Valor a Venta: {formatCurrency(inv.total_valor_venta)}
          </Typography>

          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>ID</TableCell>
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
                {inv.items.map(it => (
                  <TableRow key={it.id}>
                    <TableCell>{it.id}</TableCell>
                    <TableCell>
                      {it.nombre}{it.es_servicio && <Chip label="Servicio" size="small" sx={{ ml: 1 }} />}
                    </TableCell>
                    {!isMobile && <TableCell>{it.unidad_medida || '—'}</TableCell>}
                    <TableCell align="right">{it.stock_actual}</TableCell>
                    {!isMobile && <TableCell align="right">{formatCurrency(it.costo)}</TableCell>}
                    {!isMobile && <TableCell align="right">{formatCurrency(it.precio)}</TableCell>}
                    <TableCell align="right">{formatCurrency(it.valor_costo)}</TableCell>
                    {!isMobile && <TableCell align="right">{formatCurrency(it.valor_venta)}</TableCell>}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </TabPanel>

        {/* --------- ROTACIÓN --------- */}
        <TabPanel value={tab} index={1}>
          <Grid container spacing={2} alignItems="center" sx={{ mb: 2 }}>
            <Grid item xs={6} md={3}>
              <TextField type="date" label="Inicio" value={rotStart} onChange={e => setRotStart(e.target.value)} InputLabelProps={{ shrink: true }} fullWidth />
            </Grid>
            <Grid item xs={6} md={3}>
              <TextField type="date" label="Fin" value={rotEnd} onChange={e => setRotEnd(e.target.value)} InputLabelProps={{ shrink: true }} fullWidth />
            </Grid>
            <Grid item xs={6} md={2}>
              <TextField type="number" label="Top N" value={rotLimit} onChange={e => setRotLimit(parseInt(e.target.value || '10', 10))} fullWidth />
            </Grid>
            <Grid item xs={6} md={2}>
              <TextField
                select
                SelectProps={{ native: true }}
                label="Incluir servicios"
                value={rotIncServ ? '1' : '0'}
                onChange={e => setRotIncServ(e.target.value === '1')}
                fullWidth
              >
                <option value="0">No</option>
                <option value="1">Sí</option>
              </TextField>
            </Grid>
            <Grid item xs={12} md={2}>
              <Button variant="contained" onClick={loadRotacion} fullWidth>Consultar</Button>
            </Grid>
          </Grid>

          <Typography variant="subtitle1" sx={{ mt: 1, mb: 1 }}>Más vendidos</Typography>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Producto</TableCell>
                <TableCell align="right">Cantidad</TableCell>
                <TableCell align="right">Ingresos</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rot.top.map(r => (
                <TableRow key={r.producto_id}>
                  <TableCell>{r.nombre}{r.es_servicio && <Chip label="Servicio" size="small" sx={{ ml: 1 }} />}</TableCell>
                  <TableCell align="right">{r.total_cantidad_vendida}</TableCell>
                  <TableCell align="right">{formatCurrency(r.total_ingresos)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <Divider sx={{ my: 2 }} />

          <Typography variant="subtitle1" sx={{ mt: 1, mb: 1 }}>Más lentos</Typography>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Producto</TableCell>
                <TableCell align="right">Cantidad</TableCell>
                <TableCell align="right">Ingresos</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rot.slow.map(r => (
                <TableRow key={r.producto_id}>
                  <TableCell>{r.nombre}{r.es_servicio && <Chip label="Servicio" size="small" sx={{ ml: 1 }} />}</TableCell>
                  <TableCell align="right">{r.total_cantidad_vendida}</TableCell>
                  <TableCell align="right">{formatCurrency(r.total_ingresos)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TabPanel>

        {/* --------- KARDEX --------- */}
        <TabPanel value={tab} index={2}>
          <Grid container spacing={2} alignItems="center" sx={{ mb: 2 }}>
            <Grid item xs={12} md={5}>
              <Autocomplete
                options={productos}
                getOptionLabel={(o)=> o ? `${o.nombre} (ID:${o.id})` : ''}
                value={producto}
                onChange={(_,v)=>setProducto(v)}
                renderInput={(params)=><TextField {...params} label="Producto" fullWidth />}
              />
            </Grid>
            <Grid item xs={6} md={2}>
              <TextField type="date" label="Inicio" value={kStart} onChange={e=>setKStart(e.target.value)} InputLabelProps={{ shrink: true }} fullWidth />
            </Grid>
            <Grid item xs={6} md={2}>
              <TextField type="date" label="Fin" value={kEnd} onChange={e=>setKEnd(e.target.value)} InputLabelProps={{ shrink: true }} fullWidth />
            </Grid>
            <Grid item xs={12} md={3} sx={{ display: 'flex', gap: 1 }}>
              <Button variant="contained" onClick={loadKardex} disabled={!producto} fullWidth>Consultar</Button>
              <Button
                variant="outlined"
                disabled={!producto}
                onClick={() => {
                  const params = new URLSearchParams();
                  if (kStart) params.set('start_date', kStart);
                  if (kEnd) params.set('end_date', kEnd);
                  window.open(`${apiClient.defaults.baseURL}/inventario/kardex/${producto.id}/export?${params}`, '_blank');
                }}
              >
                Exportar CSV
              </Button>
            </Grid>
          </Grid>

          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Fecha</TableCell>
                <TableCell>Tipo</TableCell>
                <TableCell align="right">Cantidad</TableCell>
                <TableCell align="right">Costo Unit.</TableCell>
                <TableCell>Ref.</TableCell>
                <TableCell align="right">Saldo Cant.</TableCell>
                <TableCell align="right">Saldo Costo</TableCell>
                <TableCell align="right">Saldo Valor</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {kRows.map((r,i)=>(
                <TableRow key={i}>
                  <TableCell>{new Date(r.fecha).toLocaleString()}</TableCell>
                  <TableCell>{r.tipo}</TableCell>
                  <TableCell align="right">{r.cantidad}</TableCell>
                  <TableCell align="right">{formatCurrency(r.costo_unitario)}</TableCell>
                  <TableCell>{r.referencia || '—'}</TableCell>
                  <TableCell align="right">{r.saldo_cantidad}</TableCell>
                  <TableCell align="right">{formatCurrency(r.saldo_costo_unitario)}</TableCell>
                  <TableCell align="right">{formatCurrency(r.saldo_valor)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TabPanel>
      </Paper>
    </Box>
  );
}
