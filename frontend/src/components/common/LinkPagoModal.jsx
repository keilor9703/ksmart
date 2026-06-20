import React, { useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Box, Typography, Button, TextField, InputAdornment, IconButton,
  CircularProgress, Divider, alpha, useTheme,
} from '@mui/material';
import {
  CheckCircle, Close, WhatsApp, QrCode2, OpenInNew,
} from '@mui/icons-material';
import { QRCodeCanvas } from 'qrcode.react';

export default function LinkPagoModal({ open, onClose, onConfirm, linkConfig, clienteTelefono }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const [telefono, setTelefono] = useState(clienteTelefono || '');
  const [confirming, setConfirming] = useState(false);

  if (!linkConfig) return null;

  const isQrImagen = linkConfig.tipo === 'qr_imagen';
  const isUrl      = linkConfig.tipo === 'url';

  const handleWhatsApp = () => {
    const num = telefono.replace(/\D/g, '');
    if (!num) return;
    const countryNum = num.startsWith('57') ? num : `57${num}`;
    const msg = encodeURIComponent(
      `Hola! Tu pago puede hacerse a través de este link: ${linkConfig.link_url}`
    );
    window.open(`https://wa.me/${countryNum}?text=${msg}`, '_blank');
  };

  const handleConfirm = async () => {
    setConfirming(true);
    try {
      await onConfirm();
    } finally {
      setConfirming(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 4,
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : '#E5E7EB'}`,
          overflow: 'hidden',
        },
      }}
    >
      {/* Header */}
      <DialogTitle
        sx={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          px: 2.5, py: 2,
          background: isDark
            ? 'linear-gradient(135deg, rgba(255,96,32,0.12), rgba(255,96,32,0.04))'
            : 'linear-gradient(135deg, rgba(255,96,32,0.08), rgba(255,150,50,0.04))',
          borderBottom: `1px solid ${isDark ? 'rgba(255,96,32,0.2)' : 'rgba(255,96,32,0.15)'}`,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{
            width: 36, height: 36, borderRadius: 2,
            bgcolor: alpha('#FF6020', 0.15),
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <QrCode2 sx={{ color: '#FF6020', fontSize: 20 }} />
          </Box>
          <Box>
            <Typography fontWeight={800} fontSize={15} lineHeight={1.1}>
              {linkConfig.nombre}
            </Typography>
            <Typography fontSize={11} color="text.secondary">
              Muestra el código al cliente para pagar
            </Typography>
          </Box>
        </Box>
        <IconButton size="small" onClick={onClose} sx={{ color: 'text.secondary' }}>
          <Close fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ px: 2.5, py: 3 }}>
        {/* QR */}
        <Box sx={{
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          mb: linkConfig.instrucciones ? 2 : 0,
        }}>
          <Box sx={{
            p: 2.5, borderRadius: 3,
            bgcolor: '#ffffff',
            border: `2px solid ${alpha('#FF6020', 0.25)}`,
            boxShadow: `0 8px 32px ${alpha('#FF6020', 0.1)}`,
            display: 'inline-flex',
          }}>
            {isQrImagen && (
              <img
                src={`data:${linkConfig.qr_mime_type};base64,${linkConfig.qr_base64}`}
                alt="QR de pago"
                style={{ width: 240, height: 240, objectFit: 'contain', display: 'block' }}
              />
            )}
            {isUrl && (
              <QRCodeCanvas
                value={linkConfig.link_url}
                size={240}
                level="H"
                fgColor="#111827"
                bgColor="#ffffff"
                {...(linkConfig.logo_base64 ? {
                  imageSettings: { src: linkConfig.logo_base64, height: 68, width: 68, excavate: true }
                } : {})}
              />
            )}
          </Box>
        </Box>

        {/* Instrucciones */}
        {linkConfig.instrucciones && (
          <Typography
            fontSize={12.5}
            color="text.secondary"
            textAlign="center"
            sx={{ mt: 1.5, mb: isUrl ? 2 : 0 }}
          >
            {linkConfig.instrucciones}
          </Typography>
        )}

        {/* Opciones URL: abrir + WhatsApp */}
        {isUrl && (
          <>
            <Divider sx={{ mb: 2 }} />
            <Typography fontSize={12} fontWeight={600} color="text.secondary" mb={1}>
              Enviar link al cliente
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
              <TextField
                size="small"
                fullWidth
                label="Teléfono del cliente"
                placeholder="3001234567"
                value={telefono}
                onChange={e => setTelefono(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Typography fontSize={12} color="text.secondary">+57</Typography>
                    </InputAdornment>
                  ),
                }}
              />
              <Button
                variant="contained"
                onClick={handleWhatsApp}
                disabled={!telefono.replace(/\D/g, '')}
                startIcon={<WhatsApp />}
                sx={{
                  whiteSpace: 'nowrap', flexShrink: 0,
                  bgcolor: '#25D366', '&:hover': { bgcolor: '#20b95a' },
                  borderRadius: 2, fontWeight: 700, fontSize: 12, px: 1.5,
                }}
              >
                Enviar
              </Button>
            </Box>
            <Button
              fullWidth
              variant="outlined"
              size="small"
              href={linkConfig.link_url}
              target="_blank"
              rel="noopener noreferrer"
              startIcon={<OpenInNew fontSize="small" />}
              sx={{ mt: 1, borderRadius: 2, fontSize: 12, borderColor: 'divider' }}
            >
              Abrir link
            </Button>
          </>
        )}
      </DialogContent>

      <Divider />

      <DialogActions sx={{ px: 2.5, py: 2, gap: 1 }}>
        <Button
          variant="outlined"
          onClick={onClose}
          sx={{ borderRadius: 2, fontWeight: 600, borderColor: 'divider', flex: 1 }}
        >
          Cancelar
        </Button>
        <Button
          variant="contained"
          onClick={handleConfirm}
          disabled={confirming}
          startIcon={confirming ? <CircularProgress size={16} sx={{ color: 'white' }} /> : <CheckCircle />}
          sx={{
            flex: 2, borderRadius: 2, fontWeight: 800, py: 1.2,
            background: 'linear-gradient(135deg, #10B981, #059669)',
            boxShadow: '0 4px 14px rgba(16,185,129,0.3)',
            '&:hover': { background: 'linear-gradient(135deg, #059669, #047857)' },
          }}
        >
          {confirming ? 'Registrando…' : '✅ Pago confirmado'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
