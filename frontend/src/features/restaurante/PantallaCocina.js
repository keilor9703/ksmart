import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box, Typography, Chip, Button, IconButton, Tooltip,
  CircularProgress, useTheme, alpha, Stack, Divider,
  Badge, ToggleButton, ToggleButtonGroup, Paper, useMediaQuery,
} from '@mui/material';
import {
  Restaurant, CheckCircle, HourglassBottom, Refresh,
  Fullscreen, FullscreenExit, AccessTime, NotificationsActive,
} from '@mui/icons-material';
import { toast } from 'react-toastify';
import apiClient from '../../api';
import usePolling from '../../hooks/usePolling';

const ESTADO = {
  pendiente:      { color: '#F59E0B', bg: 'rgba(245,158,11,0.14)', label: 'Pendiente',      next: 'en_preparacion', nextLabel: 'Iniciar' },
  en_preparacion: { color: '#2563EB', bg: 'rgba(37,99,235,0.14)',  label: 'En preparación', next: 'listo',          nextLabel: 'Listo' },
  listo:          { color: '#059669', bg: 'rgba(5,150,105,0.14)',  label: 'Listo',          next: null,             nextLabel: null },
};

const timeAgo = (iso) => {
  if (!iso) return '';
  const d = new Date(iso.endsWith('Z') || iso.includes('+') ? iso : iso + 'Z');
  const diff = Math.floor((Date.now() - d) / 60000);
  if (isNaN(diff) || diff < 0) return '—';
  if (diff < 1) return '<1min';
  if (diff < 60) return `${diff}min`;
  return `${Math.floor(diff / 60)}h ${diff % 60}min`;
};

const urgencyColor = (iso) => {
  if (!iso) return 'inherit';
  const d = new Date(iso.endsWith('Z') || iso.includes('+') ? iso : iso + 'Z');
  const diff = Math.floor((Date.now() - d) / 60000);
  if (diff >= 20) return '#EF4444';
  if (diff >= 10) return '#F59E0B';
  return 'inherit';
};

// ─── Tarjeta de ítem de cocina ────────────────────────────────────────────────

const ItemCard = ({ item, onAdvance, advancing }) => {
  const theme = useTheme();
  const est = ESTADO[item.estado] || ESTADO.pendiente;
  const age = timeAgo(item.timestamp_pedido);
  const ageColor = urgencyColor(item.timestamp_pedido);

  return (
    <Box sx={{
      border: `2px solid ${est.color}`,
      borderRadius: 2,
      p: 1.5,
      background: est.bg,
      display: 'flex',
      flexDirection: 'column',
      gap: 0.5,
      position: 'relative',
    }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1 }}>
        <Typography sx={{ fontWeight: 700, fontSize: 15, lineHeight: 1.3, color: theme.palette.text.primary }}>
          {item.cantidad}× {item.nombre_producto}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
          <AccessTime sx={{ fontSize: 13, color: ageColor }} />
          <Typography sx={{ fontSize: 12, color: ageColor, fontWeight: 600 }}>{age}</Typography>
        </Box>
      </Box>

      {item.notas && (
        <Typography sx={{ fontSize: 12, color: '#6B7280', fontStyle: 'italic', pl: 0.5 }}>
          📝 {item.notas}
        </Typography>
      )}

      {est.next && (
        <Button
          size="small"
          variant="contained"
          disabled={advancing === item.id}
          onClick={() => onAdvance(item.id, est.next)}
          sx={{
            mt: 0.5, textTransform: 'none', fontWeight: 700,
            bgcolor: est.color, '&:hover': { bgcolor: est.color, filter: 'brightness(0.9)' },
            fontSize: 12, py: 0.4,
          }}
        >
          {advancing === item.id
            ? <CircularProgress size={14} sx={{ color: '#fff' }} />
            : est.nextLabel}
        </Button>
      )}

      {item.estado === 'listo' && (
        <Chip
          icon={<CheckCircle sx={{ fontSize: 14, '&&': { color: '#059669' } }} />}
          label="Listo para entregar"
          size="small"
          sx={{ bgcolor: 'rgba(5,150,105,0.12)', color: '#059669', fontWeight: 600, fontSize: 11 }}
        />
      )}
    </Box>
  );
};

// ─── Tarjeta de comanda ───────────────────────────────────────────────────────

const ComandaCard = ({ comanda, onAdvance, advancing }) => {
  const theme = useTheme();
  const totalItems = comanda.items.length;
  const listos = comanda.items.filter(i => i.estado === 'listo' || i.estado === 'entregado').length;
  const pendientes = comanda.items.filter(i => i.estado === 'pendiente').length;
  const enPrep = comanda.items.filter(i => i.estado === 'en_preparacion').length;

  const urgente = comanda.items.some(i => {
    if (!i.timestamp_pedido) return false;
    return Math.floor((Date.now() - new Date(i.timestamp_pedido + (i.timestamp_pedido.endsWith('Z') ? '' : 'Z'))) / 60000) >= 15;
  });

  return (
    <Paper elevation={2} sx={{
      borderRadius: 3, overflow: 'hidden',
      border: urgente ? '2px solid #EF4444' : '1px solid rgba(0,0,0,0.08)',
      transition: 'box-shadow 0.2s',
    }}>
      {/* Header */}
      <Box sx={{
        px: 2, py: 1.2,
        background: urgente
          ? 'linear-gradient(90deg, #EF4444 0%, #DC2626 100%)'
          : `linear-gradient(90deg, ${theme.palette.mode === 'dark' ? '#1F1F1F' : '#1e40af'} 0%, ${theme.palette.mode === 'dark' ? '#334155' : '#3b82f6'} 100%)`,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {urgente && <NotificationsActive sx={{ color: '#fff', fontSize: 18 }} />}
          <Typography sx={{ color: '#fff', fontWeight: 800, fontSize: 18 }}>
            Mesa {comanda.mesa_numero}
          </Typography>
          {comanda.mesa_zona && (
            <Typography sx={{ color: 'rgba(255,255,255,0.75)', fontSize: 12 }}>
              {comanda.mesa_zona}
            </Typography>
          )}
          {comanda.origen === 'autoservicio' && (
            <Chip
              label="📱 Cliente"
              size="small"
              sx={{ bgcolor: '#7C3AED', color: '#fff', fontWeight: 700, fontSize: 11, height: 20 }}
            />
          )}
        </Box>
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          {pendientes > 0 && <Chip label={`${pendientes} pend.`} size="small" sx={{ bgcolor: '#F59E0B', color: '#fff', fontWeight: 700, fontSize: 11 }} />}
          {enPrep > 0 && <Chip label={`${enPrep} prep.`} size="small" sx={{ bgcolor: '#2563EB', color: '#fff', fontWeight: 700, fontSize: 11 }} />}
          {listos > 0 && <Chip label={`${listos} listo`} size="small" sx={{ bgcolor: '#059669', color: '#fff', fontWeight: 700, fontSize: 11 }} />}
        </Box>
      </Box>

      {/* Progreso */}
      <Box sx={{ px: 2, pt: 0.5, pb: 0 }}>
        <Box sx={{ height: 4, borderRadius: 2, bgcolor: 'rgba(0,0,0,0.08)', overflow: 'hidden' }}>
          <Box sx={{ height: '100%', borderRadius: 2, bgcolor: '#059669', width: `${(listos / totalItems) * 100}%`, transition: 'width 0.4s' }} />
        </Box>
      </Box>

      {/* Items */}
      <Box sx={{ p: 1.5, display: 'flex', flexDirection: 'column', gap: 1 }}>
        {comanda.items
          .filter(i => i.estado !== 'entregado' && i.estado !== 'cancelado')
          .map(item => (
            <ItemCard key={item.id} item={item} onAdvance={onAdvance} advancing={advancing} />
          ))}
        {comanda.items.filter(i => i.estado !== 'entregado' && i.estado !== 'cancelado').length === 0 && (
          <Typography sx={{ textAlign: 'center', color: '#059669', fontWeight: 600, py: 1, fontSize: 13 }}>
            ✅ Todos los platos listos
          </Typography>
        )}
      </Box>
    </Paper>
  );
};

// ─── Pantalla principal ───────────────────────────────────────────────────────

// ─── Web Audio beep ───────────────────────────────────────────────────────────
const playBeep = () => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    gain.gain.setValueAtTime(0.4, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.4);
  } catch (_) {}
};

const PantallaCocina = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [comandas, setComandas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [advancing, setAdvancing] = useState(null);
  const [filtroArea, setFiltroArea] = useState('todas');
  const [areas, setAreas] = useState([]);
  const [fullscreen, setFullscreen] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [countdown, setCountdown] = useState(10);
  const [sonidoActivo, setSonidoActivo] = useState(() => localStorage.getItem('cocina_sonido') !== 'off');
  const prevIdsRef = useRef(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await apiClient.get('/restaurante/cocina');
      const data = res.data;
      // Detectar nuevas comandas para emitir sonido
      const currentIds = new Set(data.map(c => c.id));
      if (prevIdsRef.current !== null) {
        const nuevas = [...currentIds].filter(id => !prevIdsRef.current.has(id));
        if (nuevas.length > 0 && sonidoActivo) playBeep();
      }
      prevIdsRef.current = currentIds;
      setComandas(data);
      // Extraer áreas únicas de los items
      const allAreas = new Set();
      data.forEach(c => c.items.forEach(i => i.area_cocina && allAreas.add(i.area_cocina)));
      setAreas([...allAreas]);
      setLastRefresh(new Date());
      setCountdown(10);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [sonidoActivo]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Auto-refresh cada 10s; se pausa si la pestaña está oculta.
  usePolling(fetchData, 10000);

  // Countdown visual
  useEffect(() => {
    const tick = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) return 10;
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(tick);
  }, []);

  const handleAdvance = async (itemId, nuevoEstado) => {
    setAdvancing(itemId);
    try {
      await apiClient.patch(`/restaurante/cocina/items/${itemId}`, { estado: nuevoEstado });
      await fetchData();
    } catch (err) {
      toast.error('Error al actualizar el estado');
    } finally {
      setAdvancing(null);
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setFullscreen(true);
    } else {
      document.exitFullscreen();
      setFullscreen(false);
    }
  };

  // Filtrar comandas por área
  const comandasFiltradas = comandas
    .map(c => ({
      ...c,
      items: filtroArea === 'todas'
        ? c.items
        : c.items.filter(i => i.area_cocina === filtroArea),
    }))
    .filter(c => c.items.length > 0);

  const totalPendientes = comandas.reduce((acc, c) =>
    acc + c.items.filter(i => i.estado === 'pendiente').length, 0);

  const totalEnPrep = comandas.reduce((acc, c) =>
    acc + c.items.filter(i => i.estado === 'en_preparacion').length, 0);

  return (
    <Box sx={{
      minHeight: '100vh',
      bgcolor: theme.palette.mode === 'dark' ? '#0A0A0A' : '#f0f4f8',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* TopBar cocina — responsive */}
      <Box sx={{
        bgcolor: theme.palette.mode === 'dark' ? '#161616' : '#1F1F1F',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        position: 'sticky', top: 0, zIndex: 100,
      }}>
        {/* Fila 1: título + acciones */}
        <Box sx={{
          px: 2, py: 1.2,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1,
        }}>
          {/* Izquierda: icono + título */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
            <Restaurant sx={{ color: '#6366F1', fontSize: isMobile ? 22 : 26, flexShrink: 0 }} />
            <Typography sx={{
              color: '#fff', fontWeight: 800,
              fontSize: isMobile ? 16 : 19,
              fontFamily: "'Geist', sans-serif",
              whiteSpace: 'nowrap',
            }}>
              {isMobile ? 'Cocina' : 'Pantalla de Cocina'}
            </Typography>
          </Box>

          {/* Derecha: chips de estado + botones */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, flexShrink: 0 }}>
            {totalPendientes > 0 && (
              <Chip
                icon={<HourglassBottom sx={{ fontSize: 13, '&&': { color: '#F59E0B' } }} />}
                label={isMobile ? totalPendientes : 'Pendientes'}
                size="small"
                sx={{ bgcolor: 'rgba(245,158,11,0.18)', color: '#F59E0B', fontWeight: 700, fontSize: 11, height: 24 }}
              />
            )}
            {totalEnPrep > 0 && (
              <Chip
                icon={<Restaurant sx={{ fontSize: 13, '&&': { color: '#60a5fa' } }} />}
                label={isMobile ? totalEnPrep : `${totalEnPrep} prep.`}
                size="small"
                sx={{ bgcolor: 'rgba(37,99,235,0.18)', color: '#60a5fa', fontWeight: 700, fontSize: 11, height: 24 }}
              />
            )}
            {/* Countdown compacto */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4 }}>
              <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: '#059669', flexShrink: 0 }} />
              {!isMobile && (
                <Typography sx={{ color: '#64748b', fontSize: 11 }}>{countdown}s</Typography>
              )}
            </Box>
            <Tooltip title={sonidoActivo ? 'Silenciar alertas' : 'Activar alertas de sonido'}>
              <IconButton
                size="small"
                onClick={() => setSonidoActivo(v => {
                  const next = !v;
                  localStorage.setItem('cocina_sonido', next ? 'on' : 'off');
                  return next;
                })}
                sx={{ color: sonidoActivo ? '#F59E0B' : '#475569', p: 0.5 }}
              >
                <NotificationsActive sx={{ fontSize: 17 }} />
              </IconButton>
            </Tooltip>
            <IconButton size="small" onClick={fetchData} sx={{ color: '#94a3b8', p: 0.5 }}>
              <Refresh sx={{ fontSize: 17 }} />
            </IconButton>
            <IconButton size="small" onClick={toggleFullscreen} sx={{ color: '#94a3b8', p: 0.5 }}>
              {fullscreen ? <FullscreenExit sx={{ fontSize: 17 }} /> : <Fullscreen sx={{ fontSize: 17 }} />}
            </IconButton>
          </Box>
        </Box>

        {/* Fila 2: filtro de áreas (solo si hay más de una) */}
        {areas.length > 0 && (
          <Box sx={{
            px: 2, pb: 1,
            display: 'flex', alignItems: 'center', gap: 1,
            overflowX: 'auto',
            '&::-webkit-scrollbar': { display: 'none' },
          }}>
            <ToggleButtonGroup
              value={filtroArea}
              exclusive
              onChange={(_, v) => v && setFiltroArea(v)}
              size="small"
              sx={{
                flexShrink: 0,
                '& .MuiToggleButton-root': {
                  color: '#94a3b8',
                  borderColor: 'rgba(255,255,255,0.12)',
                  fontSize: 12, py: 0.4, px: 1.4,
                  textTransform: 'none', whiteSpace: 'nowrap',
                },
                '& .Mui-selected': {
                  bgcolor: 'rgba(99,102,241,0.2) !important',
                  color: '#6366F1 !important',
                  fontWeight: 700,
                },
              }}
            >
              <ToggleButton value="todas">Todas</ToggleButton>
              {areas.map(a => <ToggleButton key={a} value={a}>{a}</ToggleButton>)}
            </ToggleButtonGroup>
            {isMobile && (
              <Typography sx={{ color: '#64748b', fontSize: 11, flexShrink: 0, ml: 'auto' }}>
                {countdown}s
              </Typography>
            )}
          </Box>
        )}
      </Box>

      {/* Content */}
      <Box sx={{ flex: 1, p: 2 }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', pt: 8 }}>
            <CircularProgress sx={{ color: '#6366F1' }} />
          </Box>
        ) : comandasFiltradas.length === 0 ? (
          <Box sx={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', minHeight: '50vh', gap: 2,
          }}>
            <CheckCircle sx={{ fontSize: 72, color: '#059669', opacity: 0.4 }} />
            <Typography sx={{ fontSize: 22, fontWeight: 700, color: '#94a3b8' }}>
              Sin pedidos pendientes
            </Typography>
            <Typography sx={{ fontSize: 14, color: '#6b7280' }}>
              La cocina está al día. Los nuevos pedidos aparecerán aquí.
            </Typography>
          </Box>
        ) : (
          <Box sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: '1fr',
              sm: 'repeat(2, 1fr)',
              md: 'repeat(3, 1fr)',
              lg: 'repeat(4, 1fr)',
            },
            gap: 2,
            alignItems: 'start',
          }}>
            {comandasFiltradas.map(comanda => (
              <ComandaCard
                key={comanda.comanda_id}
                comanda={comanda}
                onAdvance={handleAdvance}
                advancing={advancing}
              />
            ))}
          </Box>
        )}
      </Box>

      {/* Footer */}
      <Box sx={{
        px: 2.5, py: 1,
        bgcolor: theme.palette.mode === 'dark' ? '#161616' : '#1F1F1F',
        borderTop: '1px solid rgba(255,255,255,0.08)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <Typography sx={{ color: '#64748b', fontSize: 12 }}>
          {comandasFiltradas.length} comanda(s) activa(s)
        </Typography>
        <Typography sx={{ color: '#64748b', fontSize: 12 }}>
          Última actualización: {lastRefresh.toLocaleTimeString('es-CO')}
        </Typography>
      </Box>
    </Box>
  );
};

export default PantallaCocina;
