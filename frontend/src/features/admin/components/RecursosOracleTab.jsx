import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Paper, Typography, LinearProgress, Grid, Chip, IconButton, Tooltip, CircularProgress,
} from '@mui/material';
import { Memory, Storage, Dns, CloudSync, Refresh, CheckCircle, Warning, Error as ErrorIcon } from '@mui/icons-material';
import { apiClient } from '../../../api';
import usePolling from '../../../hooks/usePolling';

const nivel = (pct) => (pct == null ? 'na' : pct >= 90 ? 'crit' : pct >= 70 ? 'warn' : 'ok');
const COLORS = { ok: '#10B981', warn: '#F59E0B', crit: '#EF4444', na: '#9CA3AF' };
const ICONO = { ok: <CheckCircle sx={{ fontSize: 16 }} />, warn: <Warning sx={{ fontSize: 16 }} />, crit: <ErrorIcon sx={{ fontSize: 16 }} />, na: null };

const fmtUptime = (s) => {
  if (!s) return '—';
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  return `${d > 0 ? `${d}d ` : ''}${h}h ${m}m`;
};

function MetricCard({ icon, titulo, pct, valor, limite, detalle }) {
  const lv = nivel(pct);
  const color = COLORS[lv];
  return (
    <Paper sx={{ p: 2.25, borderRadius: 3, border: '1px solid', borderColor: 'divider', height: '100%' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box sx={{ width: 34, height: 34, borderRadius: 2, bgcolor: `${color}18`, color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {icon}
          </Box>
          <Typography sx={{ fontWeight: 800, fontSize: 14 }}>{titulo}</Typography>
        </Box>
        {pct != null && (
          <Chip size="small" icon={ICONO[lv]} label={`${pct}%`}
            sx={{ fontWeight: 800, bgcolor: `${color}18`, color, '& .MuiChip-icon': { color } }} />
        )}
      </Box>

      <LinearProgress variant="determinate" value={Math.min(100, pct || 0)}
        sx={{ height: 8, borderRadius: 99, mb: 1, bgcolor: `${color}1A`, '& .MuiLinearProgress-bar': { bgcolor: color, borderRadius: 99 } }} />

      <Typography sx={{ fontSize: 13, fontWeight: 700 }}>
        {valor} <Typography component="span" sx={{ fontSize: 12, color: 'text.secondary', fontWeight: 500 }}>/ {limite}</Typography>
      </Typography>
      {detalle && <Typography sx={{ fontSize: 11.5, color: 'text.secondary', mt: 0.3 }}>{detalle}</Typography>}
    </Paper>
  );
}

export default function RecursosOracleTab() {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(false);

  const fetchRecursos = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const { data } = await apiClient.get('/superadmin/recursos-oracle');
      setData(data); setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchRecursos(); }, [fetchRecursos]);
  // Tiempo real: refresco silencioso cada 5s (se pausa si la pestaña está oculta).
  usePolling(() => fetchRecursos(true), 5000);

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>;
  }
  if (error || !data) {
    return (
      <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 3, border: '1px dashed', borderColor: 'divider' }}>
        <CloudSync sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
        <Typography sx={{ fontWeight: 700, color: 'text.secondary' }}>No se pudieron leer las métricas del servidor</Typography>
        <Typography sx={{ fontSize: 12.5, color: 'text.disabled' }}>Solo disponible cuando el backend corre en el servidor Linux de producción.</Typography>
      </Paper>
    );
  }

  const { cpu, ram, disco, red, uptime_segundos } = data;

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, flexWrap: 'wrap', gap: 1 }}>
        <Box>
          <Typography sx={{ fontWeight: 800, fontSize: 16 }}>Recursos del servidor — Oracle Cloud (Always Free)</Typography>
          <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>
            Uso en tiempo real vs límites gratuitos · Uptime: {fmtUptime(uptime_segundos)} · Actualiza cada 5s
          </Typography>
        </Box>
        <Tooltip title="Actualizar ahora">
          <IconButton onClick={() => fetchRecursos()}><Refresh /></IconButton>
        </Tooltip>
      </Box>

      <Grid container spacing={2}>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard icon={<Dns sx={{ fontSize: 19 }} />} titulo="CPU (OCPU)"
            pct={cpu.uso_pct} valor={`${cpu.uso_pct}% uso`} limite={`${cpu.limite_ocpu} OCPU`}
            detalle={`Carga: ${cpu.load_1} / ${cpu.load_5} / ${cpu.load_15} (1·5·15m)`} />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard icon={<Memory sx={{ fontSize: 19 }} />} titulo="Memoria RAM"
            pct={ram.uso_pct} valor={ram.usado_gb != null ? `${ram.usado_gb} GB` : '—'} limite={`${ram.limite_gb} GB`}
            detalle={ram.total_gb != null ? `Total físico: ${ram.total_gb} GB` : null} />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard icon={<Storage sx={{ fontSize: 19 }} />} titulo="Almacenamiento"
            pct={disco.uso_pct} valor={disco.usado_gb != null ? `${disco.usado_gb} GB` : '—'} limite={`${disco.limite_gb} GB`}
            detalle={disco.libre_gb != null ? `Libre en disco: ${disco.libre_gb} GB` : null} />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard icon={<CloudSync sx={{ fontSize: 19 }} />} titulo="Red (egreso)"
            pct={red.egress_pct_aprox} valor={`${red.enviado_gb} GB enviados`} limite={`${red.limite_egress_tb_mes} TB/mes`}
            detalle={red.nota} />
        </Grid>
      </Grid>

      <Paper sx={{ mt: 2, p: 2, borderRadius: 3, border: '1px solid', borderColor: 'divider', bgcolor: 'rgba(59,130,246,0.04)' }}>
        <Typography sx={{ fontSize: 12.5, color: 'text.secondary', lineHeight: 1.6 }}>
          <b>Verde</b> &lt; 70% · <b>Ámbar</b> 70–90% · <b>Rojo</b> &gt; 90% del límite gratuito.
          Los porcentajes de CPU, RAM y almacenamiento se miden contra los topes de Oracle Cloud Always Free
          (4 OCPU · 24 GB RAM · 200 GB de bloque). El egreso de red es acumulado desde el último reinicio, no el total mensual.
          Para el control de facturación, configura además una <b>Budget Alert en $1 al 100%</b> en la consola de Oracle.
        </Typography>
      </Paper>
    </Box>
  );
}
