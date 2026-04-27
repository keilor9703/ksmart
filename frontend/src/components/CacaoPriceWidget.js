// ═══════════════════════════════════════════════════════════════════════════
// CacaoPriceWidget.jsx
// Widget exclusivo de Vialmar (empresa_id === 1) para el Dashboard.
//
// INTEGRACIÓN EN Dashboard.jsx:
// 1. import CacaoPriceWidget from './CacaoPriceWidget';
// 2. Dentro del JSX del Dashboard, después del KPI Grid, añadir:
//    {user?.empresa_id === 1 && <CacaoPriceWidget />}
// ═══════════════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Paper, Skeleton, Chip, IconButton, Tooltip, Link, TextField, InputAdornment
} from '@mui/material';
import {
  TrendingUp, TrendingDown, TrendingFlat,
  Refresh, OpenInNew, Spa, Calculate
} from '@mui/icons-material';
import apiClient from '../api';
import { formatCurrency } from '../utils/formatters';

// ── Colores ──────────────────────────────────────────────────────────────────
const CACAO_BROWN  = '#5C3317';
const CACAO_GOLD   = '#C8860A';
const GREEN        = '#10B981';
const RED          = '#EF4444';
const BLUE         = '#3B82F6';

// ── Ícono SVG de mazorca de cacao ────────────────────────────────────────────
const CacaoIcon = ({ size = 28, color = CACAO_GOLD }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
    <ellipse cx="12" cy="13" rx="5" ry="8" fill={color} opacity="0.9" />
    <ellipse cx="12" cy="13" rx="3" ry="6" fill={CACAO_BROWN} opacity="0.35" />
    <path d="M12 5 C12 5 10 2 8 3 C9 4 10 5 12 5Z" fill="#2D7A15" />
    <path d="M12 5 C12 5 14 2 16 3 C15 4 14 5 12 5Z" fill="#2D7A15" />
    <rect x="11.5" y="3" width="1" height="3" rx="0.5" fill="#4A8C20" />
  </svg>
);

// ── Indicador de tendencia ────────────────────────────────────────────────────
const TrendIcon = ({ tendencia, size = 18 }) => {
  if (tendencia === 'alza')    return <TrendingUp   sx={{ fontSize: size, color: GREEN }} />;
  if (tendencia === 'baja')    return <TrendingDown sx={{ fontSize: size, color: RED   }} />;
  return <TrendingFlat sx={{ fontSize: size, color: BLUE }} />;
};

// ── Componente principal ──────────────────────────────────────────────────────
const CacaoPriceWidget = () => {
  const [precio,        setPrecio]        = useState(null);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState(false);
  const [lastRefresh,   setLastRefresh]   = useState(null);
  
  // Estados para la calculadora
  const [descuentoPct,  setDescuentoPct]  = useState(15);
  const [kilos,         setKilos]         = useState('');

  const fetchPrecio = useCallback(async (manual = false) => {
    if (manual) setLoading(true);
    setError(false);
    try {
      const { data } = await apiClient.get('/mercado/precio-cacao');
      setPrecio(data);
      setLastRefresh(new Date());
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  // Carga inicial
  useEffect(() => { fetchPrecio(); }, [fetchPrecio]);

  // Auto-refresh cada 30 minutos
  useEffect(() => {
    const id = setInterval(() => fetchPrecio(), 30 * 60 * 1000);
    return () => clearInterval(id);
  }, [fetchPrecio]);

  // ── Render: error ────────────────────────────────────────────────────────
  if (error && !precio) {
    return (
      <Paper sx={{
        p: 2, mb: 2, borderRadius: 3,
        border: `1px dashed ${CACAO_GOLD}50`,
        display: 'flex', alignItems: 'center', gap: 1.5,
      }}>
        <CacaoIcon size={24} color={CACAO_GOLD} />
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
            No fue posible obtener el precio del cacao en este momento.
          </Typography>
        </Box>
        <Tooltip title="Reintentar">
          <IconButton size="small" onClick={() => fetchPrecio(true)}>
            <Refresh fontSize="small" />
          </IconButton>
        </Tooltip>
      </Paper>
    );
  }

  // ── Render: loading ──────────────────────────────────────────────────────
  if (loading && !precio) {
    return (
      <Paper sx={{ p: 2, mb: 2, borderRadius: 3, border: `1px solid ${CACAO_GOLD}25` }}>
        <Skeleton width={160} height={16} sx={{ mb: 1 }} />
        <Skeleton width={120} height={36} />
      </Paper>
    );
  }

  if (!precio) return null;

  const tendenciaColor = precio.tendencia === 'alza' ? GREEN
    : precio.tendencia === 'baja' ? RED : BLUE;

  // ── Cálculos de la calculadora ─────────────────────────────────────────────
  const precioBase = precio.precio_cop_kg || 0;
  const valorDescuento = (precioBase * (descuentoPct || 0)) / 100;
  const precioCalculado = precioBase - valorDescuento;
  const totalPagar = precioCalculado * (kilos || 0);

  return (
    <Paper sx={{
      p: 0, mb: 2, borderRadius: 3, overflow: 'hidden',
      border: `1px solid ${CACAO_GOLD}30`,
      boxShadow: `0 2px 16px ${CACAO_GOLD}15`,
      background: (theme) =>
        theme.palette.mode === 'dark'
          ? `linear-gradient(135deg, #1a0f05 0%, #2d1a08 100%)`
          : `linear-gradient(135deg, #FFF8EE 0%, #FFF3E0 100%)`,
    }}>

      {/* Barra superior */}
      <Box sx={{
        px: 2, py: 0.8,
        background: `linear-gradient(90deg, ${CACAO_BROWN} 0%, ${CACAO_GOLD} 100%)`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
          <Spa sx={{ fontSize: 14, color: 'white', opacity: 0.9 }} />
          <Typography sx={{ fontSize: 10, fontWeight: 800, color: 'white', textTransform: 'uppercase', letterSpacing: 1 }}>
            Precio Cacao · Vialmar
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Chip
            label="Referencia FEPCACAO"
            size="small"
            sx={{ height: 18, fontSize: 9, fontWeight: 700, bgcolor: 'rgba(255,255,255,0.2)', color: 'white', border: 'none' }}
          />
        </Box>
      </Box>

      {/* Contenido principal */}
      <Box sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1.5 }}>

          {/* Precio principal */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <CacaoIcon size={36} color={CACAO_GOLD} />
            <Box>
              <Typography sx={{ fontSize: 10, color: CACAO_BROWN, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6, opacity: 0.7 }}>
                Precio oficial del kilo
              </Typography>
              {loading ? (
                <Skeleton width={140} height={34} />
              ) : (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography sx={{
                    fontSize: 28, fontWeight: 900, lineHeight: 1.1,
                    color: CACAO_BROWN,
                    fontVariantNumeric: 'tabular-nums',
                  }}>
                    {formatCurrency(precio.precio_cop_kg)}
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                    <Typography sx={{ fontSize: 9, color: 'text.secondary', lineHeight: 1 }}>COP</Typography>
                    <Typography sx={{ fontSize: 9, color: 'text.secondary', lineHeight: 1 }}>/ kg</Typography>
                  </Box>
                </Box>
              )}
            </Box>
          </Box>

          {/* Datos secundarios */}
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography sx={{ fontSize: 9, color: 'text.secondary', fontWeight: 600, textTransform: 'uppercase' }}>Bolsa ICE</Typography>
              <Typography sx={{ fontSize: 14, fontWeight: 800, color: BLUE }}>${precio.precio_usd_ton?.toLocaleString('en-US', { minimumFractionDigits: 0 })}</Typography>
              <Typography sx={{ fontSize: 9, color: 'text.secondary' }}>USD / ton</Typography>
            </Box>

            <Box sx={{ textAlign: 'center' }}>
              <Typography sx={{ fontSize: 9, color: 'text.secondary', fontWeight: 600, textTransform: 'uppercase' }}>TRM</Typography>
              <Typography sx={{ fontSize: 14, fontWeight: 800, color: CACAO_BROWN }}>${precio.trm_cop?.toLocaleString('es-CO', { minimumFractionDigits: 2 })}</Typography>
              <Typography sx={{ fontSize: 9, color: 'text.secondary' }}>COP / USD</Typography>
            </Box>

            <Box sx={{ textAlign: 'center' }}>
              <Typography sx={{ fontSize: 9, color: 'text.secondary', fontWeight: 600, textTransform: 'uppercase' }}>Tendencia</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.3, mt: 0.3 }}>
                <TrendIcon tendencia={precio.tendencia} size={20} />
                {precio.variacion_pct !== 0 && (
                  <Typography sx={{ fontSize: 12, fontWeight: 800, color: tendenciaColor }}>
                    {precio.variacion_pct > 0 ? '+' : ''}{precio.variacion_pct}%
                  </Typography>
                )}
              </Box>
              <Typography sx={{ fontSize: 9, color: tendenciaColor, fontWeight: 700, textTransform: 'capitalize' }}>
                {precio.tendencia}
              </Typography>
            </Box>
          </Box>
        </Box>

        {/* ── Calculadora de Compra ── */}
        <Box sx={{
          mt: 2, p: 1.5, borderRadius: 2,
          bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.6)',
          border: `1px dashed ${CACAO_GOLD}60`,
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
            <Calculate sx={{ color: CACAO_GOLD, fontSize: 20 }} />
            <Typography sx={{ fontSize: 11, fontWeight: 800, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Calculadora de Compra
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
            
            {/* ── Inputs (Izquierda) ── */}
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              {/* Descuento */}
              <Box>
                <Typography sx={{ fontSize: 10, fontWeight: 700, color: 'text.secondary', mb: 0.5, textTransform: 'uppercase' }}>
                  Ajuste / Viáticos
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography sx={{ fontSize: 12, fontWeight: 600, color: CACAO_BROWN }}>Restar:</Typography>
                  <TextField
                    size="small"
                    type="number"
                    value={descuentoPct}
                    onChange={(e) => setDescuentoPct(e.target.value === '' ? '' : Number(e.target.value))}
                    sx={{
                      width: 90,
                      '& .MuiInputBase-root': { 
                        height: 30, fontSize: 14, fontWeight: 800, color: CACAO_BROWN, 
                        bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : '#fff' 
                      },
                    }}
                    InputProps={{
                      endAdornment: <InputAdornment position="end" sx={{ '& .MuiTypography-root': { fontSize: 14, fontWeight: 800, color: CACAO_GOLD } }}>%</InputAdornment>,
                    }}
                  />
                </Box>
                {/* Diferencia en pesos */}
                <Typography sx={{ fontSize: 10, color: RED, fontWeight: 700, mt: 0.5 }}>
                  Diferencia: - {formatCurrency(valorDescuento)} / kg
                </Typography>
              </Box>

              {/* Cantidad Kilos */}
              <Box>
                <Typography sx={{ fontSize: 10, fontWeight: 700, color: 'text.secondary', mb: 0.5, textTransform: 'uppercase' }}>
                  Cantidad a comprar
                </Typography>
                <TextField
                  size="small"
                  type="number"
                  placeholder="0"
                  value={kilos}
                  onChange={(e) => setKilos(e.target.value === '' ? '' : Number(e.target.value))}
                  sx={{
                    width: 130,
                    '& .MuiInputBase-root': { 
                      height: 30, fontSize: 14, fontWeight: 800, color: CACAO_BROWN, 
                      bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : '#fff' 
                    },
                  }}
                  InputProps={{
                    endAdornment: <InputAdornment position="end" sx={{ '& .MuiTypography-root': { fontSize: 12, fontWeight: 800, color: CACAO_GOLD } }}>kg</InputAdornment>,
                  }}
                />
              </Box>
            </Box>

            {/* ── Resumen (Derecha) ── */}
            <Box sx={{ textAlign: 'right', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', minWidth: 140 }}>
              <Box sx={{ mb: 1 }}>
                <Typography sx={{ fontSize: 10, fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase' }}>
                  Tu precio base
                </Typography>
                <Typography sx={{ fontSize: 16, fontWeight: 800, color: GREEN, lineHeight: 1.1 }}>
                  {formatCurrency(precioCalculado)} <span style={{ fontSize: 10, fontWeight: 600, color: 'text.secondary' }}>/ kg</span>
                </Typography>
              </Box>
              
              <Box sx={{ pt: 1, borderTop: `1px solid ${CACAO_GOLD}30` }}>
                <Typography sx={{ fontSize: 10, fontWeight: 800, color: CACAO_BROWN, textTransform: 'uppercase' }}>
                  Total a pagar
                </Typography>
                <Typography sx={{ fontSize: 24, fontWeight: 900, color: CACAO_BROWN, lineHeight: 1.1 }}>
                  {formatCurrency(totalPagar)}
                </Typography>
              </Box>
            </Box>

          </Box>
        </Box>

        {/* Footer: fecha, fuente, botón refresh */}
        <Box sx={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          mt: 1.5, pt: 1.5,
          borderTop: `1px solid ${CACAO_GOLD}20`,
          flexWrap: 'wrap', gap: 0.5,
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>
              Actualizado: {precio.fecha_precio} a las{' '}
              {precio.ultima_actualizacion
                ? precio.ultima_actualizacion.split('T')[1]?.slice(0, 5)
                : '--:--'}{' '}
              (hora Colombia)
            </Typography>
            <Typography sx={{ fontSize: 10, color: 'text.disabled', ml: 0.5 }}>
              · Próx. actualización: 8:00 / 14:00
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Link
              href="https://www.fepcacao.com.co/"
              target="_blank" rel="noopener"
              sx={{ fontSize: 10, color: CACAO_GOLD, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 0.3, textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
            >
              FEPCACAO.COM.CO <OpenInNew sx={{ fontSize: 10 }} />
            </Link>
            <Tooltip title={`Actualizar ahora${lastRefresh ? ` · Última vez: ${lastRefresh.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}` : ''}`}>
              <IconButton
                size="small" onClick={() => fetchPrecio(true)} disabled={loading}
                sx={{ color: CACAO_GOLD, '&:hover': { bgcolor: `${CACAO_GOLD}15` } }}
              >
                <Refresh sx={{ fontSize: 14 }} />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
      </Box>
    </Paper>
  );
};

export default CacaoPriceWidget;
