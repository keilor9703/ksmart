// ═══════════════════════════════════════════════════════════════════════════
// CacaoPriceWidget.jsx
// Widget exclusivo de Vialmar (empresa_id === 1) para el Dashboard.
// VERSIÓN: Tipografía aumentada + tooltips informativos sobre fuentes
// ═══════════════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Paper, Skeleton, Chip, IconButton, Tooltip, Link, TextField, InputAdornment
} from '@mui/material';
import {
  TrendingUp, TrendingDown, TrendingFlat,
  Refresh, OpenInNew, Spa, Calculate, InfoOutlined
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

// ── Textos de tooltips informativos ──────────────────────────────────────────
const INFO_TOOLTIPS = {
  precioKg: (
    <Box sx={{ p: 0.5 }}>
      <Typography sx={{ fontSize: 12, fontWeight: 700, mb: 0.5 }}>Precio oficial del kilo</Typography>
      <Typography sx={{ fontSize: 11, lineHeight: 1.4 }}>
        Precio de referencia en pesos colombianos publicado por FEPCACAO. Es el valor base que rige la compra a productores en Colombia. Se actualiza dos veces al día (8:00 AM y 2:00 PM hora Colombia).
      </Typography>
    </Box>
  ),
  bolsaIce: (
    <Box sx={{ p: 0.5 }}>
      <Typography sx={{ fontSize: 12, fontWeight: 700, mb: 0.5 }}>¿Qué es la Bolsa ICE?</Typography>
      <Typography sx={{ fontSize: 11, lineHeight: 1.4, mb: 1 }}>
        ICE (Intercontinental Exchange — Nueva York) es el mercado mundial donde se transa el cacao. Es la referencia internacional sobre la cual FEPCACAO calcula el precio interno colombiano.
      </Typography>
      <Typography sx={{ fontSize: 11, lineHeight: 1.4, fontStyle: 'italic', opacity: 0.9 }}>
        Nota: este valor cambia en tiempo real durante horario de mercado. Puede diferir del cierre publicado por FEPCACAO porque ese refleja el último día hábil cerrado.
      </Typography>
    </Box>
  ),
  trm: (
    <Box sx={{ p: 0.5 }}>
      <Typography sx={{ fontSize: 12, fontWeight: 700, mb: 0.5 }}>TRM (Tasa Representativa del Mercado)</Typography>
      <Typography sx={{ fontSize: 11, lineHeight: 1.4 }}>
        Tasa oficial de cambio entre el dólar y el peso colombiano publicada por la Superintendencia Financiera. Se usa para convertir el precio internacional (USD) a pesos colombianos (COP).
      </Typography>
    </Box>
  ),
  tendencia: (
    <Box sx={{ p: 0.5 }}>
      <Typography sx={{ fontSize: 12, fontWeight: 700, mb: 0.5 }}>Tendencia del mercado</Typography>
      <Typography sx={{ fontSize: 11, lineHeight: 1.4 }}>
        Variación porcentual respecto al precio anterior. Sirve para anticipar movimientos del precio interno antes de que FEPCACAO los refleje al día siguiente.
      </Typography>
    </Box>
  ),
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
        p: 2.5, mb: 2, borderRadius: 3,
        border: `1px dashed ${CACAO_GOLD}50`,
        display: 'flex', alignItems: 'center', gap: 1.5,
      }}>
        <CacaoIcon size={28} color={CACAO_GOLD} />
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ fontSize: 14, color: 'text.secondary' }}>
            No fue posible obtener el precio del cacao en este momento.
          </Typography>
        </Box>
        <Tooltip title="Reintentar">
          <IconButton size="medium" onClick={() => fetchPrecio(true)}>
            <Refresh fontSize="small" />
          </IconButton>
        </Tooltip>
      </Paper>
    );
  }

  // ── Render: loading ──────────────────────────────────────────────────────
  if (loading && !precio) {
    return (
      <Paper sx={{ p: 2.5, mb: 2, borderRadius: 3, border: `1px solid ${CACAO_GOLD}25` }}>
        <Skeleton width={180} height={20} sx={{ mb: 1 }} />
        <Skeleton width={160} height={44} />
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

  // ── Helper: ícono de info reutilizable ───────────────────────────────────
  const InfoBadge = ({ tooltip, size = 13 }) => (
    <Tooltip title={tooltip} arrow placement="top" enterTouchDelay={0} leaveTouchDelay={6000}>
      <InfoOutlined
        sx={{
          fontSize: size,
          color: CACAO_GOLD,
          opacity: 0.7,
          cursor: 'help',
          ml: 0.4,
          verticalAlign: 'middle',
          '&:hover': { opacity: 1 },
        }}
      />
    </Tooltip>
  );

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
        px: 2.5, py: 1.2,
        background: `linear-gradient(90deg, ${CACAO_BROWN} 0%, ${CACAO_GOLD} 100%)`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Spa sx={{ fontSize: 18, color: 'white', opacity: 0.9 }} />
          <Typography sx={{ fontSize: 12, fontWeight: 800, color: 'white', textTransform: 'uppercase', letterSpacing: 1 }}>
            Precio Cacao · Vialmar
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Chip
            label="Fuente: FEPCACAO + ICE"
            size="small"
            sx={{ height: 22, fontSize: 11, fontWeight: 700, bgcolor: 'rgba(255,255,255,0.2)', color: 'white', border: 'none' }}
          />
        </Box>
      </Box>

      {/* Contenido principal */}
      <Box sx={{ p: 2.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>

          {/* Precio principal */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <CacaoIcon size={44} color={CACAO_GOLD} />
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Typography sx={{ fontSize: 12, color: CACAO_BROWN, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6, opacity: 0.75 }}>
                  Precio oficial del kilo
                </Typography>
                <InfoBadge tooltip={INFO_TOOLTIPS.precioKg} size={14} />
              </Box>
              {loading ? (
                <Skeleton width={180} height={44} />
              ) : (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography sx={{
                    fontSize: 36, fontWeight: 900, lineHeight: 1.1,
                    color: CACAO_BROWN,
                    fontVariantNumeric: 'tabular-nums',
                  }}>
                    {formatCurrency(precio.precio_cop_kg)}
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                    <Typography sx={{ fontSize: 11, color: 'text.secondary', lineHeight: 1.1, fontWeight: 600 }}>COP</Typography>
                    <Typography sx={{ fontSize: 11, color: 'text.secondary', lineHeight: 1.1, fontWeight: 600 }}>/ kg</Typography>
                  </Box>
                </Box>
              )}
              {/* Etiqueta de fuente del precio del kilo */}
              <Typography sx={{ fontSize: 10, color: 'text.disabled', mt: 0.3, fontWeight: 500 }}>
                Referencia: FEPCACAO · cierre {precio.fecha_precio || '—'}
              </Typography>
            </Box>
          </Box>

          {/* Datos secundarios */}
          <Box sx={{ display: 'flex', gap: 2.5, flexWrap: 'wrap' }}>
            <Box sx={{ textAlign: 'center' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Typography sx={{ fontSize: 11, color: 'text.secondary', fontWeight: 600, textTransform: 'uppercase' }}>
                  Bolsa ICE
                </Typography>
                <InfoBadge tooltip={INFO_TOOLTIPS.bolsaIce} size={13} />
              </Box>
              <Typography sx={{ fontSize: 18, fontWeight: 800, color: BLUE, lineHeight: 1.2 }}>
                ${precio.precio_usd_ton?.toLocaleString('en-US', { minimumFractionDigits: 0 })}
              </Typography>
              <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>USD / ton · ICE NY</Typography>
            </Box>

            <Box sx={{ textAlign: 'center' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Typography sx={{ fontSize: 11, color: 'text.secondary', fontWeight: 600, textTransform: 'uppercase' }}>
                  TRM
                </Typography>
                <InfoBadge tooltip={INFO_TOOLTIPS.trm} size={13} />
              </Box>
              <Typography sx={{ fontSize: 18, fontWeight: 800, color: CACAO_BROWN, lineHeight: 1.2 }}>
                ${precio.trm_cop?.toLocaleString('es-CO', { minimumFractionDigits: 2 })}
              </Typography>
              <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>COP / USD</Typography>
            </Box>

            <Box sx={{ textAlign: 'center' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Typography sx={{ fontSize: 11, color: 'text.secondary', fontWeight: 600, textTransform: 'uppercase' }}>
                  Tendencia
                </Typography>
                <InfoBadge tooltip={INFO_TOOLTIPS.tendencia} size={13} />
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.4, mt: 0.3 }}>
                <TrendIcon tendencia={precio.tendencia} size={24} />
                {precio.variacion_pct !== 0 && (
                  <Typography sx={{ fontSize: 16, fontWeight: 800, color: tendenciaColor }}>
                    {precio.variacion_pct > 0 ? '+' : ''}{precio.variacion_pct}%
                  </Typography>
                )}
              </Box>
              <Typography sx={{ fontSize: 12, color: tendenciaColor, fontWeight: 700, textTransform: 'capitalize' }}>
                {precio.tendencia}
              </Typography>
            </Box>
          </Box>
        </Box>

        {/* ── Calculadora de Compra ── */}
        <Box sx={{
          mt: 2.5, p: 2, borderRadius: 2,
          bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.6)',
          border: `1px dashed ${CACAO_GOLD}60`,
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <Calculate sx={{ color: CACAO_GOLD, fontSize: 24 }} />
            <Typography sx={{ fontSize: 13, fontWeight: 800, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Calculadora de Compra
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2.5 }}>

            {/* ── Inputs (Izquierda) ── */}
            <Box sx={{ display: 'flex', gap: 2.5, flexWrap: 'wrap' }}>
              {/* Descuento */}
              <Box>
                <Typography sx={{ fontSize: 12, fontWeight: 700, color: 'text.secondary', mb: 0.7, textTransform: 'uppercase' }}>
                  Ajuste / Viáticos
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography sx={{ fontSize: 14, fontWeight: 600, color: CACAO_BROWN }}>Restar:</Typography>
                  <TextField
                    size="small"
                    type="number"
                    value={descuentoPct}
                    onChange={(e) => setDescuentoPct(e.target.value === '' ? '' : Number(e.target.value))}
                    sx={{
                      width: 110,
                      '& .MuiInputBase-root': {
                        height: 40, fontSize: 18, fontWeight: 800, color: CACAO_BROWN,
                        bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : '#fff'
                      },
                    }}
                    InputProps={{
                      endAdornment: <InputAdornment position="end" sx={{ '& .MuiTypography-root': { fontSize: 16, fontWeight: 800, color: CACAO_GOLD } }}>%</InputAdornment>,
                    }}
                  />
                </Box>
                {/* Diferencia en pesos */}
                <Typography sx={{ fontSize: 12, color: RED, fontWeight: 700, mt: 0.7 }}>
                  Diferencia: - {formatCurrency(valorDescuento)} / kg
                </Typography>
              </Box>

              {/* Cantidad Kilos */}
              <Box>
                <Typography sx={{ fontSize: 12, fontWeight: 700, color: 'text.secondary', mb: 0.7, textTransform: 'uppercase' }}>
                  Cantidad a comprar
                </Typography>
                <TextField
                  size="small"
                  type="number"
                  placeholder="0"
                  value={kilos}
                  onChange={(e) => setKilos(e.target.value === '' ? '' : Number(e.target.value))}
                  sx={{
                    width: 150,
                    '& .MuiInputBase-root': {
                      height: 40, fontSize: 18, fontWeight: 800, color: CACAO_BROWN,
                      bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : '#fff'
                    },
                  }}
                  InputProps={{
                    endAdornment: <InputAdornment position="end" sx={{ '& .MuiTypography-root': { fontSize: 14, fontWeight: 800, color: CACAO_GOLD } }}>kg</InputAdornment>,
                  }}
                />
              </Box>
            </Box>

            {/* ── Resumen (Derecha) ── */}
            <Box sx={{ textAlign: 'right', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', minWidth: 170 }}>
              <Box sx={{ mb: 1.2 }}>
                <Typography sx={{ fontSize: 12, fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase' }}>
                  Tu precio base
                </Typography>
                <Typography sx={{ fontSize: 22, fontWeight: 800, color: GREEN, lineHeight: 1.15 }}>
                  {formatCurrency(precioCalculado)} <span style={{ fontSize: 12, fontWeight: 600, color: '#888' }}>/ kg</span>
                </Typography>
              </Box>

              <Box sx={{ pt: 1.2, borderTop: `1px solid ${CACAO_GOLD}30` }}>
                <Typography sx={{ fontSize: 13, fontWeight: 800, color: CACAO_BROWN, textTransform: 'uppercase' }}>
                  Total a pagar
                </Typography>
                <Typography sx={{ fontSize: 32, fontWeight: 900, color: CACAO_BROWN, lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' }}>
                  {formatCurrency(totalPagar)}
                </Typography>
              </Box>
            </Box>

          </Box>
        </Box>

        {/* Footer: fecha, fuente, botón refresh */}
        <Box sx={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          mt: 2, pt: 1.8,
          borderTop: `1px solid ${CACAO_GOLD}20`,
          flexWrap: 'wrap', gap: 0.8,
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
            <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
              Actualizado: {precio.fecha_precio} a las{' '}
              {precio.ultima_actualizacion
                ? precio.ultima_actualizacion.split('T')[1]?.slice(0, 5)
                : '--:--'}{' '}
              (hora Colombia)
            </Typography>
            <Typography sx={{ fontSize: 12, color: 'text.disabled', ml: 0.5 }}>
              · Próx. actualización: 8:00 / 14:00
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
            <Link
              href="https://www.fepcacao.com.co/"
              target="_blank" rel="noopener"
              sx={{ fontSize: 12, color: CACAO_GOLD, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 0.4, textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
            >
              FEPCACAO.COM.CO <OpenInNew sx={{ fontSize: 12 }} />
            </Link>
            <Tooltip title={`Actualizar ahora${lastRefresh ? ` · Última vez: ${lastRefresh.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}` : ''}`}>
              <IconButton
                size="medium" onClick={() => fetchPrecio(true)} disabled={loading}
                sx={{ color: CACAO_GOLD, '&:hover': { bgcolor: `${CACAO_GOLD}15` } }}
              >
                <Refresh sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {/* ── Nota explicativa al pie sobre la diferencia de fuentes ── */}
        <Box sx={{
          mt: 1.5, px: 1.2, py: 1, borderRadius: 1.5,
          bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(200, 134, 10, 0.08)' : 'rgba(200, 134, 10, 0.06)',
          borderLeft: `3px solid ${CACAO_GOLD}`,
          display: 'flex', alignItems: 'flex-start', gap: 0.8,
        }}>
          <InfoOutlined sx={{ fontSize: 14, color: CACAO_GOLD, mt: 0.2, flexShrink: 0 }} />
          <Typography sx={{ fontSize: 11, color: 'text.secondary', lineHeight: 1.45 }}>
            <strong style={{ color: CACAO_BROWN }}>¿Por qué el precio internacional puede diferir de FEPCACAO?</strong>{' '}
            La Bolsa ICE (Nueva York) cotiza en tiempo real durante horario de mercado, mientras FEPCACAO publica el cierre del último día hábil. Tener ambas referencias permite anticipar el precio interno antes de que se publique oficialmente.
          </Typography>
        </Box>
      </Box>
    </Paper>
  );
};

export default CacaoPriceWidget;
