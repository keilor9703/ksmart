import React, { useState, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Slider,
  Typography,
  IconButton
} from '@mui/material';
import { Close, ZoomIn, RestartAlt } from '@mui/icons-material';
import Cropper from 'react-easy-crop';

/**
 * Crea un canvas con la porción recortada de la imagen.
 */
const getCroppedImg = (imageSrc, pixelCrop, outputSize = 800) => {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.src = imageSrc;

    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = outputSize;
      canvas.height = outputSize;
      const ctx = canvas.getContext('2d');

      ctx.drawImage(
        image,
        pixelCrop.x,
        pixelCrop.y,
        pixelCrop.width,
        pixelCrop.height,
        0,
        0,
        outputSize,
        outputSize
      );

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('No se pudo generar la imagen'));
            return;
          }
          // Convertimos a File para que mantenga compatibilidad
          // con tu función compressImageToWebP
          const file = new File([blob], 'cropped.jpg', {
            type: 'image/jpeg'
          });
          resolve(file);
        },
        'image/jpeg',
        0.95
      );
    };

    image.onerror = () => reject(new Error('Error al cargar imagen'));
  });
};

const ImageCropperDialog = ({
  open,
  imageSrc,
  onClose,
  onCropComplete,
  accentColor = '#8B5CF6'
}) => {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [processing, setProcessing] = useState(false);

  const onCropChangeComplete = useCallback((_, areaPixels) => {
    setCroppedAreaPixels(areaPixels);
  }, []);

  const handleReset = () => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
  };

  const handleConfirm = async () => {
    if (!croppedAreaPixels) return;
    try {
      setProcessing(true);
      const croppedFile = await getCroppedImg(imageSrc, croppedAreaPixels, 800);
      onCropComplete(croppedFile);
      handleReset();
    } catch (err) {
      console.error('Error al recortar:', err);
    } finally {
      setProcessing(false);
    }
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: { borderRadius: 3 } }}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontWeight: 700,
          fontSize: 16
        }}
      >
        Ajustar Imagen (1:1)
        <IconButton onClick={handleClose} size="small">
          <Close />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ p: 0 }}>
        <Box
          sx={{
            position: 'relative',
            width: '100%',
            height: { xs: 320, sm: 400 },
            bgcolor: '#000'
          }}
        >
          {imageSrc && (
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={1}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropChangeComplete}
              showGrid
              objectFit="contain"
            />
          )}
        </Box>

        <Box sx={{ px: 3, py: 2 }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              mb: 1
            }}
          >
            <ZoomIn sx={{ color: 'text.secondary' }} />
            <Slider
              value={zoom}
              min={1}
              max={3}
              step={0.05}
              onChange={(_, v) => setZoom(v)}
              sx={{ color: accentColor }}
            />
            <Typography
              sx={{
                fontSize: 12,
                color: 'text.secondary',
                minWidth: 40,
                textAlign: 'right'
              }}
            >
              {zoom.toFixed(1)}x
            </Typography>
          </Box>

          <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
            Arrastra la imagen para reposicionar · Usa el deslizador para
            acercar
          </Typography>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
        <Button
          onClick={handleReset}
          startIcon={<RestartAlt />}
          sx={{ color: 'text.secondary' }}
        >
          Reiniciar
        </Button>
        <Box sx={{ flex: 1 }} />
        <Button onClick={handleClose} variant="outlined">
          Cancelar
        </Button>
        <Button
          onClick={handleConfirm}
          variant="contained"
          disabled={processing || !croppedAreaPixels}
          sx={{
            background: `linear-gradient(135deg, ${accentColor}, #a78bfa)`,
            fontWeight: 600,
            px: 3
          }}
        >
          {processing ? 'Procesando...' : 'Aplicar'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ImageCropperDialog;