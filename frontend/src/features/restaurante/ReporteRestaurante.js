import React, { useState, useCallback, useEffect } from 'react';
import {
  Box, Typography, Button, CircularProgress, Paper, Grid,
  Tab, Tabs, Chip, Divider, useTheme, alpha,
} from '@mui/material';
import {
  BarChart, TrendingUp, TableRestaurant, Person,
  Restaurant, Refresh, CalendarToday,
} from '@mui/icons-material';
import { toast } from 'react-toastify';
import apiClient from '../../api';

const ACCENT = '#FF6020';

const fmt = (n) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n || 0);

// Rango de fechas rápidos
const RANGOS = [
  { label: 'Hoy',       getDates: () => { const d = new Date(); return [d, d]; } },
  { label: '7 días',    getDates: () => { const d = new Date(); const d2 = new Date(); d2.setDate(d.getDate() - 6); return [d2, d]; } },
  { label: '30 días',   getDates: () => { const d = new Date(); const d2 = new Date(); d2.setDate(d.getDate() - 29); return [d2, d]; } },
  { label: 'Este mes',  getDates: () => { const d = new Date(); return [new Date(d.getFullYear(), d.getMonth(), 1), d]; } },
];

const toIso = (date) => date.toISOString().split('T')[0];

// Barra horizontal simple
const BarraH = ({ label, valor, max, sub }) => {
  const pct = max > 0 ? (valor / max) * 100 : 0;
  return (
    <Box sx={{ mb: 1.5 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.4 }}>
        <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{label}</Typography>
        <Box sx={{ textAlign: 'right' }}>
          <Typography sx={{ fontSize: 13, fontWeight: 700, color: ACCENT }}>{fmt(valor)}</Typography>
          {sub && <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{sub}</Typography>}
        </Box>
      </Box>
      <Box sx={{ height: 6, borderRadius: 3, bgcolor: 'rgba(0,0,0,0.07)', overflow: 'hidden' }}>
        <Box sx={{ height: '100%', width: `${pct}%`, bgcolor: ACCENT, borderRadius: 3, transition: 'width 0.5s' }} />
      </Box>
    </Box>
  );
};

// KPI card
const KPI = ({ icon, label, value, sub, color }) => (
  <Paper elevation={0} sx={{ p: 2, borderRadius: 2, border: '1px solid rgba(0,0,0,0.08)', height: '100%' }}>
    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
      <Box sx={{ p: 1, borderRadius: 2, bgcolor: alpha(color || ACCENT, 0.1) }}>
        {React.cloneElement(icon, { sx: { color: color || ACCENT, fontSize: 22 } })}
      </Box>
      <Box>
        <Typography sx={{ fontSize: 12, color: 'text.secondary', fontWeight: 500 }}>{label}</Typography>
        <Typography sx={{ fontSize: 22, fontWeight: 800, lineHeight: 1.2 }}>{value}</Typography>
        {sub && <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{sub}</Typography>}
      </Box>
    </Box>
  </Paper>
);

export default function ReporteRestaurante() {
  const theme = useTheme();
  const [tab, setTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [rangoIdx, setRangoIdx] = useState(1); // 7 días por defecto
  const [resumen, setResumen]    = useState(null);
  const [mesas, setMesas]         = useState([]);
  const [meseros, setMeseros]     = useState([]);
  const [productos, setProductos] = useState([]);

  const [desde, hasta] = RANGOS[rangoIdx].getDates();

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const params = { desde: toIso(desde) + 'T00:00:00Z', hasta: toIso(hasta) + 'T23:59:59Z' };
    try {
      const [r, m, me, p] = await Promise.all([
        apiClient.get('/restaurante/reportes/resumen', { params }),
        apiClient.get('/restaurante/reportes/mesas',   { params }),
        apiClient.get('/restaurante/reportes/meseros', { params }),
        apiClient.get('/restaurante/reportes/productos', { params }),
      ]);
      setResumen(r.data);
      setMesas(m.data);
      setMeseros(me.data);
      setProductos(p.data);
    } catch (err) {
      toast.error('Error al cargar reportes');
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangoIdx]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const maxMesa    = mesas[0]?.total    || 1;
  const maxMesero  = meseros[0]?.total  || 1;
  const maxProd    = productos[0]?.cantidad || 1;

  return (
    <Box sx={{ maxWidth: 960, mx: 'auto', p: { xs: 1, md: 0 } }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3, flexWrap: 'wrap', gap: 1 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800, fontFamily: "'Plus Jakarta Sans', sans-serif", display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <BarChart sx={{ color: ACCENT, fontSize: 28 }} />
            Reportes del Restaurante
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Análisis de ventas, mesas y desempeño del equipo
          </Typography>
        </Box>
        <Button
          variant="outlined" startIcon={loading ? <CircularProgress size={14} /> : <Refresh />}
          onClick={fetchAll} disabled={loading} size="small"
          sx={{ borderColor: ACCENT, color: ACCENT }}
        >
          Actualizar
        </Button>
      </Box>

      {/* Selector de rango */}
      <Box sx={{ display: 'flex', gap: 1, mb: 3, flexWrap: 'wrap', alignItems: 'center' }}>
        <CalendarToday sx={{ fontSize: 16, color: 'text.secondary' }} />
        {RANGOS.map((r, i) => (
          <Chip
            key={r.label}
            label={r.label}
            size="small"
            onClick={() => setRangoIdx(i)}
            sx={{
              cursor: 'pointer',
              bgcolor: rangoIdx === i ? ACCENT : alpha(ACCENT, 0.1),
              color: rangoIdx === i ? '#fff' : ACCENT,
              fontWeight: 600,
            }}
          />
        ))}
      </Box>

      {/* KPIs resumen */}
      {resumen && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={6} sm={3}>
            <KPI icon={<TrendingUp />} label="Total vendido" value={fmt(resumen.total_ventas)} color={ACCENT} />
          </Grid>
          <Grid item xs={6} sm={3}>
            <KPI icon={<Restaurant />} label="Comandas" value={resumen.total_comandas} color="#3B82F6" />
          </Grid>
          <Grid item xs={6} sm={3}>
            <KPI icon={<TableRestaurant />} label="Ticket promedio" value={fmt(resumen.ticket_promedio)} color="#10B981" />
          </Grid>
          <Grid item xs={6} sm={3}>
            <KPI icon={<CalendarToday />} label="Días con ventas" value={resumen.por_dia?.length || 0} color="#8B5CF6" />
          </Grid>
        </Grid>
      )}

      {/* Tabs de detalle */}
      <Tabs
        value={tab} onChange={(_, v) => setTab(v)}
        sx={{
          mb: 3, borderBottom: 1, borderColor: 'divider',
          '& .MuiTab-root': { textTransform: 'none', fontWeight: 600 },
          '& .Mui-selected': { color: `${ACCENT} !important` },
          '& .MuiTabs-indicator': { bgcolor: ACCENT },
        }}
      >
        <Tab label="Ventas por día" icon={<TrendingUp />} iconPosition="start" />
        <Tab label="Por mesa" icon={<TableRestaurant />} iconPosition="start" />
        <Tab label="Por mesero" icon={<Person />} iconPosition="start" />
        <Tab label="Productos top" icon={<Restaurant />} iconPosition="start" />
      </Tabs>

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress sx={{ color: ACCENT }} /></Box>
      )}

      {!loading && tab === 0 && resumen && (
        <Paper elevation={0} sx={{ p: 2.5, borderRadius: 2, border: '1px solid rgba(0,0,0,0.08)' }}>
          <Typography sx={{ fontWeight: 700, mb: 2 }}>Ventas diarias</Typography>
          {resumen.por_dia?.length > 0 ? (
            resumen.por_dia.map(d => {
              const maxDia = Math.max(...resumen.por_dia.map(x => x.total));
              return (
                <BarraH key={d.fecha} label={d.fecha} valor={d.total} max={maxDia} />
              );
            })
          ) : (
            <Typography color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>Sin ventas en el período seleccionado</Typography>
          )}
        </Paper>
      )}

      {!loading && tab === 1 && (
        <Paper elevation={0} sx={{ p: 2.5, borderRadius: 2, border: '1px solid rgba(0,0,0,0.08)' }}>
          <Typography sx={{ fontWeight: 700, mb: 2 }}>Ingresos por mesa</Typography>
          {mesas.length > 0 ? mesas.map(m => (
            <BarraH key={m.mesa} label={`Mesa ${m.mesa}${m.zona ? ` — ${m.zona}` : ''}`} valor={m.total} max={maxMesa} sub={`${m.comandas} comanda${m.comandas !== 1 ? 's' : ''}`} />
          )) : (
            <Typography color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>Sin datos en el período</Typography>
          )}
        </Paper>
      )}

      {!loading && tab === 2 && (
        <Paper elevation={0} sx={{ p: 2.5, borderRadius: 2, border: '1px solid rgba(0,0,0,0.08)' }}>
          <Typography sx={{ fontWeight: 700, mb: 2 }}>Desempeño por mesero</Typography>
          {meseros.length > 0 ? meseros.map(m => (
            <BarraH key={m.mesero_id} label={m.nombre} valor={m.total} max={maxMesero} sub={`${m.comandas} comanda${m.comandas !== 1 ? 's' : ''}`} />
          )) : (
            <Typography color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>Sin datos en el período</Typography>
          )}
        </Paper>
      )}

      {!loading && tab === 3 && (
        <Paper elevation={0} sx={{ p: 2.5, borderRadius: 2, border: '1px solid rgba(0,0,0,0.08)' }}>
          <Typography sx={{ fontWeight: 700, mb: 2 }}>Productos más vendidos (top 30)</Typography>
          {productos.length > 0 ? productos.map((p, i) => (
            <Box key={p.nombre} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.2 }}>
              <Typography sx={{ fontSize: 11, fontWeight: 700, color: 'text.disabled', width: 20, textAlign: 'right' }}>{i + 1}</Typography>
              <Box sx={{ flex: 1 }}>
                <BarraH label={p.nombre} valor={p.total} max={maxProd * (productos[0]?.precio_unitario || 1)} sub={`${p.cantidad} unidades · ${fmt(p.total)}`} />
              </Box>
            </Box>
          )) : (
            <Typography color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>Sin datos en el período</Typography>
          )}
        </Paper>
      )}
    </Box>
  );
}
