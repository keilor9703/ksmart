import React, { useEffect, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Box, Typography, Button,
} from '@mui/material';
import { SystemUpdate } from '@mui/icons-material';
import { Capacitor } from '@capacitor/core';
import apiClient from '../../api';

// Compara dos versiones tipo "1.2.3". Devuelve <0 si a<b, 0 si igual, >0 si a>b.
function compararVersiones(a, b) {
  const pa = String(a || '0').split('.').map(n => parseInt(n, 10) || 0);
  const pb = String(b || '0').split('.').map(n => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const da = pa[i] || 0, db = pb[i] || 0;
    if (da !== db) return da - db;
  }
  return 0;
}

/**
 * Solo dentro de la app instalada (Capacitor): al abrir, compara la versión
 * nativa del APK contra la última publicada por el backend. Si está
 * desactualizada, muestra un aviso para descargar la nueva versión.
 *
 * Los cambios de la web ya se actualizan solos (la app carga la web en vivo),
 * así que esto solo aplica a cambios NATIVOS que requieren un APK nuevo.
 */
export default function MobileUpdateChecker() {
  const [info, setInfo] = useState(null); // { version, url_descarga, mensaje, obligatoria, actual }

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let cancelado = false;

    (async () => {
      try {
        const { App } = await import('@capacitor/app');
        const [appInfo, res] = await Promise.all([
          App.getInfo(),
          apiClient.get('/app/version-movil'),
        ]);
        if (cancelado) return;
        const actual = appInfo?.version || '0';
        const data = res.data || {};
        if (data.version && compararVersiones(actual, data.version) < 0) {
          setInfo({ ...data, actual });
        }
      } catch {
        // Nunca bloquear la app por un fallo del chequeo de versión.
      }
    })();

    return () => { cancelado = true; };
  }, []);

  if (!info) return null;

  const descargar = () => {
    if (info.url_descarga) window.open(info.url_descarga, '_blank');
  };

  return (
    <Dialog
      open
      onClose={info.obligatoria ? undefined : () => setInfo(null)}
      maxWidth="xs" fullWidth
      PaperProps={{ sx: { borderRadius: 3 } }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5, fontWeight: 800 }}>
        <Box sx={{ width: 40, height: 40, borderRadius: 2, bgcolor: '#0891B218', color: '#0891B2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <SystemUpdate />
        </Box>
        Nueva versión disponible
      </DialogTitle>
      <DialogContent>
        <Typography sx={{ fontSize: 14, color: 'text.secondary' }}>
          {info.mensaje || 'Hay una versión más reciente de la app de Ksmart360. Actualízala para tener las últimas mejoras.'}
        </Typography>
        <Typography sx={{ fontSize: 12, color: 'text.disabled', mt: 1 }}>
          Tu versión: {info.actual} · Disponible: {info.version}
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
        {!info.obligatoria && (
          <Button onClick={() => setInfo(null)} sx={{ textTransform: 'none', color: 'text.secondary' }}>
            Ahora no
          </Button>
        )}
        <Button
          variant="contained"
          onClick={descargar}
          disabled={!info.url_descarga}
          startIcon={<SystemUpdate />}
          sx={{ borderRadius: 2, fontWeight: 700, textTransform: 'none', bgcolor: '#0891B2', '&:hover': { bgcolor: '#0e7490' } }}
        >
          Descargar actualización
        </Button>
      </DialogActions>
    </Dialog>
  );
}
