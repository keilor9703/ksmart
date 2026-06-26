import React from 'react';
import { Box, Typography, Avatar, Divider, Card, useTheme, alpha } from '@mui/material';
import { QrCode2 } from '@mui/icons-material';
import LinkPagoConfig from '../../components/common/LinkPagoConfig';

export default function ConfigLinkPago() {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 860, mx: 'auto' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
        <Avatar sx={{ bgcolor: alpha('#6366F1', 0.12), width: 44, height: 44 }}>
          <QrCode2 sx={{ color: '#6366F1', fontSize: 22 }} />
        </Avatar>
        <Box>
          <Typography variant="h6" fontWeight={900} lineHeight={1.1}>
            Link de Pago en POS
          </Typography>
          <Typography fontSize={12} color="text.secondary">
            Configura el QR o link de cobro que aparecerá en el punto de venta
          </Typography>
        </Box>
      </Box>

      <Card elevation={0} sx={{
        borderRadius: 3,
        border: `1px solid ${alpha(theme.palette.divider, 1)}`,
        bgcolor: 'background.paper',
        overflow: 'hidden',
      }}>
        <Box sx={{ px: 2.5, py: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography fontWeight={700} fontSize={14}>Configuración</Typography>
        </Box>
        <Divider />
        <Box sx={{ px: 2.5, py: 2.5 }}>
          <LinkPagoConfig />
        </Box>
      </Card>
    </Box>
  );
}
