import React, { useEffect, useState } from 'react';
import { Box, CircularProgress, Typography, Button, Fade } from '@mui/material';
import WifiOffIcon from '@mui/icons-material/WifiOff';
import RefreshIcon from '@mui/icons-material/Refresh';

const ACCENT = '#FF6F00';
const SHOW_MESSAGE_AFTER_MS = 5000;   // 5 s → mostrar mensaje "reconectando"
const SHOW_RETRY_AFTER_MS   = 30000;  // 30 s → mostrar botón reintentar

export default function ReconectandoScreen({ onRetry }) {
  const [elapsed, setElapsed]         = useState(0);
  const [showMessage, setShowMessage] = useState(false);
  const [showRetry, setShowRetry]     = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setElapsed(s => s + 1), 1000);
    const msgTimer   = setTimeout(() => setShowMessage(true), SHOW_MESSAGE_AFTER_MS);
    const retryTimer = setTimeout(() => setShowRetry(true),   SHOW_RETRY_AFTER_MS);
    return () => {
      clearInterval(timer);
      clearTimeout(msgTimer);
      clearTimeout(retryTimer);
    };
  }, []);

  return (
    <Box
      sx={{
        display: 'flex', flexDirection: 'column',
        justifyContent: 'center', alignItems: 'center',
        height: '100vh', width: '100%', gap: 2,
        bgcolor: 'background.default',
      }}
    >
      <CircularProgress sx={{ color: ACCENT }} size={48} />

      <Fade in={showMessage} timeout={600}>
        <Box sx={{ textAlign: 'center', mt: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, justifyContent: 'center', mb: 0.5 }}>
            <WifiOffIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
            <Typography variant="body1" color="text.secondary" fontWeight={500}>
              Reconectando con el servidor…
            </Typography>
          </Box>
          <Typography variant="body2" color="text.disabled">
            El servidor está despertando, esto puede tardar hasta 1 minuto.
            ({elapsed}s)
          </Typography>
        </Box>
      </Fade>

      <Fade in={showRetry} timeout={600}>
        <Button
          startIcon={<RefreshIcon />}
          variant="outlined"
          size="small"
          onClick={onRetry}
          sx={{ mt: 1, borderColor: ACCENT, color: ACCENT, '&:hover': { borderColor: ACCENT, bgcolor: 'rgba(255,111,0,0.08)' } }}
        >
          Reintentar ahora
        </Button>
      </Fade>
    </Box>
  );
}
