import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box, Paper, Typography, TextField, InputAdornment, ToggleButtonGroup, ToggleButton,
  IconButton, Tooltip, Chip,
} from '@mui/material';
import { Search, PlayArrow, Pause, DeleteSweep, VerticalAlignBottom, Terminal } from '@mui/icons-material';
import { apiClient } from '../../../api';
import usePolling from '../../../hooks/usePolling';

const NIVEL_COLOR = {
  DEBUG: '#9CA3AF', INFO: '#38BDF8', WARNING: '#F59E0B', ERROR: '#EF4444', CRITICAL: '#F43F5E',
};
const NIVELES = ['ALL', 'INFO', 'WARNING', 'ERROR'];
const MAX_RENDER = 1000;

const fmtHora = (ts) => {
  const d = new Date(ts * 1000);
  return d.toLocaleTimeString('es-CO', { hour12: false }) + '.' + String(d.getMilliseconds()).padStart(3, '0');
};

export default function LogsBackendTab() {
  const [logs, setLogs]       = useState([]);
  const [nivel, setNivel]     = useState('ALL');
  const [q, setQ]             = useState('');
  const [vivo, setVivo]       = useState(true);     // auto-refresco
  const [autoScroll, setAutoScroll] = useState(true);
  const lastIdRef = useRef(0);
  const scrollRef = useRef(null);

  // Reinicia el stream cuando cambian los filtros (server-side filtering).
  const recargar = useCallback(async () => {
    lastIdRef.current = 0;
    try {
      const params = { since_id: 0, limit: 800 };
      if (nivel !== 'ALL') params.level = nivel;
      if (q.trim()) params.q = q.trim();
      const { data } = await apiClient.get('/superadmin/logs', { params });
      const arr = data.logs || [];
      setLogs(arr);
      if (arr.length) lastIdRef.current = arr[arr.length - 1].id;
    } catch { /* silencioso */ }
  }, [nivel, q]);

  useEffect(() => { recargar(); }, [recargar]);

  // Refresco incremental: solo trae registros nuevos (since_id).
  const tick = useCallback(async () => {
    if (!vivo) return;
    try {
      const params = { since_id: lastIdRef.current };
      if (nivel !== 'ALL') params.level = nivel;
      if (q.trim()) params.q = q.trim();
      const { data } = await apiClient.get('/superadmin/logs', { params });
      const nuevos = data.logs || [];
      if (nuevos.length) {
        lastIdRef.current = nuevos[nuevos.length - 1].id;
        setLogs(prev => {
          const merged = [...prev, ...nuevos];
          return merged.length > MAX_RENDER ? merged.slice(-MAX_RENDER) : merged;
        });
      }
    } catch { /* silencioso */ }
  }, [vivo, nivel, q]);

  usePolling(tick, 3000);

  // Auto-scroll al fondo cuando llegan logs nuevos.
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const cerca = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    setAutoScroll(cerca);
  };

  return (
    <Box>
      {/* Controles */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5, flexWrap: 'wrap' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1, minWidth: 200 }}>
          <Terminal sx={{ color: 'text.secondary' }} />
          <Box>
            <Typography sx={{ fontWeight: 800, fontSize: 15, lineHeight: 1.1 }}>Logs del backend</Typography>
            <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
              En vivo desde el servidor · {logs.length} líneas {vivo ? '· actualiza cada 3s' : '· pausado'}
            </Typography>
          </Box>
        </Box>

        <ToggleButtonGroup size="small" exclusive value={nivel} onChange={(_, v) => v && setNivel(v)}>
          {NIVELES.map(n => (
            <ToggleButton key={n} value={n} sx={{ px: 1.2, py: 0.4, fontSize: 11.5, fontWeight: 700 }}>{n}</ToggleButton>
          ))}
        </ToggleButtonGroup>

        <TextField size="small" placeholder="Buscar…" value={q} onChange={e => setQ(e.target.value)}
          sx={{ minWidth: 160 }}
          InputProps={{ startAdornment: <InputAdornment position="start"><Search sx={{ fontSize: 17 }} /></InputAdornment> }} />

        <Tooltip title={vivo ? 'Pausar' : 'Reanudar'}>
          <IconButton size="small" onClick={() => setVivo(v => !v)} sx={{ color: vivo ? '#10B981' : 'text.secondary' }}>
            {vivo ? <Pause /> : <PlayArrow />}
          </IconButton>
        </Tooltip>
        <Tooltip title="Ir al final">
          <IconButton size="small" onClick={() => { setAutoScroll(true); if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }}>
            <VerticalAlignBottom />
          </IconButton>
        </Tooltip>
        <Tooltip title="Limpiar vista">
          <IconButton size="small" onClick={() => setLogs([])}><DeleteSweep /></IconButton>
        </Tooltip>
      </Box>

      {/* Consola */}
      <Paper ref={scrollRef} onScroll={onScroll} elevation={0}
        sx={{
          height: { xs: 380, md: 560 }, overflowY: 'auto', borderRadius: 3,
          bgcolor: '#0A0A0A', border: '1px solid', borderColor: 'divider',
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
          fontSize: 12.5, p: 1.5,
        }}>
        {logs.length === 0 ? (
          <Typography sx={{ color: '#6B7280', fontFamily: 'inherit', fontSize: 12.5 }}>
            Sin registros (todavía no hay actividad o no coincide con el filtro)…
          </Typography>
        ) : logs.map(l => (
          <Box key={l.id} sx={{ display: 'flex', gap: 1, py: 0.15, lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            <Box component="span" sx={{ color: '#4B5563', flexShrink: 0 }}>{fmtHora(l.ts)}</Box>
            <Box component="span" sx={{ color: NIVEL_COLOR[l.level] || '#9CA3AF', flexShrink: 0, fontWeight: 700, width: 64 }}>{l.level}</Box>
            <Box component="span" sx={{ color: '#7C8AA5', flexShrink: 0 }}>{l.logger}</Box>
            <Box component="span" sx={{ color: '#E5E7EB' }}>{l.message}</Box>
          </Box>
        ))}
      </Paper>

      <Typography sx={{ fontSize: 11.5, color: 'text.secondary', mt: 1 }}>
        Buffer en memoria de los últimos ~2000 registros del backend (se reinicia al reiniciar el servidor).
        {!autoScroll && <Chip size="small" label="Auto-scroll pausado (subiste)" sx={{ ml: 1, height: 18, fontSize: 10 }} />}
      </Typography>
    </Box>
  );
}
