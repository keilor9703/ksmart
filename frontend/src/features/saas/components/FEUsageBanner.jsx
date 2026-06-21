import React, { useEffect, useState, useCallback } from 'react';
import { Box, Typography, LinearProgress, Button, Collapse, IconButton } from '@mui/material';
import { ReceiptLong, Close, OpenInNew } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import apiClient from '../../../api';

const REFRESH_INTERVAL_MS = 5 * 60 * 1000; // refresca cada 5 min

const COLOR = {
  ok:          { bar: '#10B981', bg: '#F0FDF4', border: '#86EFAC', text: '#166534' },
  advertencia: { bar: '#F59E0B', bg: '#FFFBEB', border: '#FCD34D', text: '#92400E' },
  limite:      { bar: '#EF4444', bg: '#FEF2F2', border: '#FCA5A5', text: '#991B1B' },
};

const COLOR_DARK = {
  ok:          { bar: '#10B981', bg: 'rgba(16,185,129,0.1)',  border: 'rgba(16,185,129,0.3)',  text: '#6EE7B7' },
  advertencia: { bar: '#F59E0B', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.3)', text: '#FCD34D' },
  limite:      { bar: '#EF4444', bg: 'rgba(239,68,68,0.1)',  border: 'rgba(239,68,68,0.3)',  text: '#FCA5A5' },
};

const MENSAJE = {
  ok:          (usados, limite) => `Documentos electrónicos: ${usados} de ${limite} usados este mes.`,
  advertencia: (usados, limite) => `⚠ Llevas ${usados} de ${limite} documentos electrónicos este mes. Considera actualizar tu plan.`,
  limite:      (usados, limite) => `🚫 Límite alcanzado: ${usados}/${limite} documentos. Las nuevas ventas no tendrán documento electrónico hasta el próximo mes o al cambiar de plan.`,
};

export default function FEUsageBanner({ user, isDark }) {
  const [data,       setData]       = useState(null);
  const [dismissed,  setDismissed]  = useState(false);
  const navigate = useNavigate();

  const fetchUsage = useCallback(async () => {
    try {
      const { data: res } = await apiClient.get('/fe/uso-documentos-mes');
      setData(res);
      // reset dismissed cuando el estado cambia a advertencia/limite
      if (res.estado === 'advertencia' || res.estado === 'limite') {
        setDismissed(false);
      }
    } catch {
      // silencioso — no rompe la UI
    }
  }, []);

  useEffect(() => {
    // solo consultar si la empresa tiene FE activa según el objeto user
    if (!user?.empresa?.facturacion_electronica_activa) return;
    fetchUsage();
    const interval = setInterval(fetchUsage, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [user, fetchUsage]);

  if (!data || !data.activo || data.estado === 'sin_limite' || data.estado === 'ok') return null;
  if (dismissed && data.estado === 'advertencia') return null;

  const estado  = data.estado;
  const palette = isDark ? COLOR_DARK[estado] : COLOR[estado];

  return (
    <Collapse in={true}>
      <Box sx={{
        mb: 2,
        px: 2, py: 1.2,
        borderRadius: 2,
        border: '1px solid',
        borderColor: palette.border,
        bgcolor: palette.bg,
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        flexWrap: 'wrap',
      }}>
        {/* Ícono */}
        <ReceiptLong sx={{ color: palette.bar, fontSize: 20, flexShrink: 0 }} />

        {/* Texto + barra */}
        <Box sx={{ flex: 1, minWidth: 200 }}>
          <Typography sx={{ fontSize: 12.5, fontWeight: 600, color: palette.text, lineHeight: 1.4 }}>
            {MENSAJE[estado](data.usados, data.limite)}
          </Typography>
          <Box sx={{ mt: 0.6, display: 'flex', alignItems: 'center', gap: 1 }}>
            <LinearProgress
              variant="determinate"
              value={Math.min(data.porcentaje, 100)}
              sx={{
                flex: 1,
                height: 5,
                borderRadius: 3,
                bgcolor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
                '& .MuiLinearProgress-bar': { bgcolor: palette.bar, borderRadius: 3 },
              }}
            />
            <Typography sx={{ fontSize: 11, fontWeight: 700, color: palette.text, whiteSpace: 'nowrap' }}>
              {data.porcentaje}%
            </Typography>
          </Box>
        </Box>

        {/* Botón actualizar plan */}
        <Button
          size="small"
          variant="outlined"
          endIcon={<OpenInNew sx={{ fontSize: 12 }} />}
          onClick={() => navigate('/mi-suscripcion')}
          sx={{
            fontSize: 11, fontWeight: 700, flexShrink: 0,
            borderColor: palette.bar, color: palette.bar,
            '&:hover': { bgcolor: `${palette.bar}15`, borderColor: palette.bar },
            py: 0.4, px: 1.2,
          }}
        >
          Actualizar plan
        </Button>

        {/* Cerrar (solo en advertencia, no en límite) */}
        {estado === 'advertencia' && (
          <IconButton size="small" onClick={() => setDismissed(true)} sx={{ color: palette.text, p: 0.3 }}>
            <Close sx={{ fontSize: 15 }} />
          </IconButton>
        )}
      </Box>
    </Collapse>
  );
}
