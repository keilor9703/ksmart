import React from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Typography, Box, IconButton
} from '@mui/material';
import {
  Warning, DeleteOutline, InfoOutlined,
  CheckCircleOutline, ErrorOutline, Close
} from '@mui/icons-material';

const PRESETS = {
  delete: {
    icon: <DeleteOutline sx={{ fontSize: 28 }} />,
    color: '#EF4444',
    confirmLabel: 'Eliminar',
    confirmSx: { bgcolor: '#EF4444', '&:hover': { bgcolor: '#dc2626' } },
  },
  warning: {
    icon: <Warning sx={{ fontSize: 28 }} />,
    color: '#F59E0B',
    confirmLabel: 'Continuar',
    confirmSx: { bgcolor: '#F59E0B', '&:hover': { bgcolor: '#d97706' } },
  },
  info: {
    icon: <InfoOutlined sx={{ fontSize: 28 }} />,
    color: '#3B82F6',
    confirmLabel: 'Aceptar',
    confirmSx: { background: 'linear-gradient(135deg, #3B82F6, #60a5fa)', boxShadow: '0 4px 14px rgba(59,130,246,0.3)' },
  },
  success: {
    icon: <CheckCircleOutline sx={{ fontSize: 28 }} />,
    color: '#10B981',
    confirmLabel: 'Confirmar',
    confirmSx: { background: 'linear-gradient(135deg, #10B981, #34d399)', boxShadow: '0 4px 14px rgba(16,185,129,0.3)' },
  },
  error: {
    icon: <ErrorOutline sx={{ fontSize: 28 }} />,
    color: '#EF4444',
    confirmLabel: 'Entendido',
    confirmSx: { bgcolor: '#EF4444', '&:hover': { bgcolor: '#dc2626' } },
  },
};

/**
 * ConfirmationDialog modernizado
 *
 * Props:
 *   open          {bool}
 *   handleClose   {fn}    — cancela / cierra
 *   handleConfirm {fn}    — acción confirmada
 *   title         {string}
 *   message       {string|node}
 *   type          {'delete'|'warning'|'info'|'success'|'error'} — default: 'delete'
 *   confirmLabel  {string} — override del label del botón de confirmar
 *   cancelLabel   {string} — default: 'Cancelar'
 *   loading       {bool}   — deshabilita botones mientras procesa
 */
const ConfirmationDialog = ({
  open,
  handleClose,
  handleConfirm,
  title = '¿Estás seguro?',
  message = 'Esta acción no se puede deshacer.',
  type = 'delete',
  confirmLabel,
  cancelLabel = 'Cancelar',
  loading = false,
}) => {
  const preset = PRESETS[type] || PRESETS.delete;
  const finalConfirmLabel = confirmLabel || preset.confirmLabel;

  return (
    <Dialog
      open={open}
      onClose={loading ? undefined : handleClose}
      maxWidth="xs"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          overflow: 'hidden',
          border: 'none',
          boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
        },
      }}
    >
      {/* Barra de color superior */}
      <Box sx={{ height: 4, bgcolor: preset.color, width: '100%' }} />

      <DialogTitle sx={{ pb: 1, pt: 2.5, pr: 6 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{
            width: 44, height: 44, borderRadius: 2, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            bgcolor: `${preset.color}15`, color: preset.color,
          }}>
            {preset.icon}
          </Box>
          <Typography sx={{ fontWeight: 700, fontSize: 16, lineHeight: 1.3 }}>
            {title}
          </Typography>
        </Box>
        <IconButton
          size="small"
          onClick={handleClose}
          disabled={loading}
          sx={{ position: 'absolute', right: 12, top: 16, color: 'text.secondary' }}
        >
          <Close fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 0.5, pb: 1 }}>
        <Typography sx={{ fontSize: 14, color: 'text.secondary', lineHeight: 1.6, pl: 7 }}>
          {message}
        </Typography>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5, pt: 1, gap: 1 }}>
        <Button
          onClick={handleClose}
          disabled={loading}
          variant="outlined"
          size="small"
          sx={{ borderRadius: 2, fontWeight: 600, borderColor: 'divider', color: 'text.secondary', flex: 1 }}
        >
          {cancelLabel}
        </Button>
        <Button
          onClick={handleConfirm}
          disabled={loading}
          variant="contained"
          size="small"
          sx={{
            borderRadius: 2, fontWeight: 600, flex: 1,
            ...preset.confirmSx,
            color: '#fff',
            '&.Mui-disabled': { opacity: 0.5 },
          }}
        >
          {loading ? 'Procesando…' : finalConfirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ConfirmationDialog;
