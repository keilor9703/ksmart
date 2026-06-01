import React, { useState, useEffect, useRef } from 'react';
import {
  Box, Typography, Button, TextField, ToggleButton, ToggleButtonGroup,
  CircularProgress, Alert, IconButton, Paper, Divider, alpha, useTheme,
  Chip,
} from '@mui/material';
import {
  QrCode2, Link as LinkIcon, Delete, Save, Upload, CheckCircle,
  WarningAmber,
} from '@mui/icons-material';
import { QRCodeSVG } from 'qrcode.react';
import { toast } from 'react-toastify';
import apiClient from '../../api';
import { compressImageToWebP } from '../../utils/imageOptimizer';

export default function LinkPagoConfig() {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const fileRef = useRef(null);

  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [config, setConfig]     = useState(null); // existing saved config

  const [nombre, setNombre]           = useState('');
  const [tipo, setTipo]               = useState('url');
  const [linkUrl, setLinkUrl]         = useState('');
  const [qrBase64, setQrBase64]       = useState('');
  const [qrMimeType, setQrMimeType]   = useState('');
  const [instrucciones, setInstrucciones] = useState('');

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/empresa/link-pago');
      if (res.data) {
        setConfig(res.data);
        setNombre(res.data.nombre || '');
        setTipo(res.data.tipo || 'url');
        setLinkUrl(res.data.link_url || '');
        setQrBase64(res.data.qr_base64 || '');
        setQrMimeType(res.data.qr_mime_type || '');
        setInstrucciones(res.data.instrucciones || '');
      }
    } catch {
      // No config yet — form stays empty
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchConfig(); }, []);

  const [compressing, setCompressing] = useState(false);

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCompressing(true);
    try {
      const dataUrl = await compressImageToWebP(file, 800, 0.9);
      setQrBase64(dataUrl.split(',')[1]);
      setQrMimeType('image/webp');
    } catch {
      toast.error('No se pudo procesar la imagen. Intenta con otro archivo.');
    } finally {
      setCompressing(false);
    }
  };

  const handleSave = async () => {
    if (!nombre.trim()) { toast.error('El nombre es obligatorio.'); return; }
    if (tipo === 'url' && !linkUrl.trim()) { toast.error('Ingresa la URL del link de pago.'); return; }
    if (tipo === 'qr_imagen' && !qrBase64) { toast.error('Sube la imagen del código QR.'); return; }

    setSaving(true);
    try {
      const payload = {
        nombre: nombre.trim(),
        tipo,
        link_url: tipo === 'url' ? linkUrl.trim() : null,
        qr_base64: tipo === 'qr_imagen' ? qrBase64 : null,
        qr_mime_type: tipo === 'qr_imagen' ? qrMimeType : null,
        instrucciones: instrucciones.trim() || null,
        is_active: true,
      };
      if (config) {
        await apiClient.put(`/empresa/link-pago/${config.id}`, payload);
      } else {
        await apiClient.post('/empresa/link-pago', payload);
      }
      toast.success('Link de pago guardado.');
      await fetchConfig();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al guardar.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!config) return;
    setDeleting(true);
    try {
      await apiClient.delete(`/empresa/link-pago/${config.id}`);
      setConfig(null);
      setNombre(''); setTipo('url'); setLinkUrl('');
      setQrBase64(''); setQrMimeType(''); setInstrucciones('');
      toast.success('Link de pago eliminado.');
    } catch {
      toast.error('Error al eliminar.');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress size={28} sx={{ color: '#FF6020' }} />
      </Box>
    );
  }

  return (
    <Box>
      {/* Status banner */}
      {config ? (
        <Alert
          icon={<CheckCircle fontSize="small" />}
          severity="success"
          sx={{ mb: 2, borderRadius: 2, fontSize: 13 }}
        >
          Link activo: <strong>{config.nombre}</strong> ({config.tipo === 'url' ? 'URL' : 'QR imagen'})
        </Alert>
      ) : (
        <Alert
          icon={<WarningAmber fontSize="small" />}
          severity="warning"
          sx={{ mb: 2, borderRadius: 2, fontSize: 13 }}
        >
          Sin link de pago configurado — la opción no aparecerá en el POS.
        </Alert>
      )}

      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 2.5 }}>
        {/* Form */}
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            label="Nombre del método"
            placeholder="Ej: Nequi empresa, Bold QR, Bancolombia"
            size="small"
            fullWidth
            value={nombre}
            onChange={e => setNombre(e.target.value)}
          />

          <Box>
            <Typography fontSize={12} fontWeight={600} color="text.secondary" mb={0.8}>
              Tipo de link
            </Typography>
            <ToggleButtonGroup
              value={tipo}
              exclusive
              onChange={(_, v) => v && setTipo(v)}
              size="small"
              sx={{ width: '100%' }}
            >
              <ToggleButton value="url" sx={{ flex: 1, fontSize: 12, fontWeight: 600 }}>
                <LinkIcon fontSize="small" sx={{ mr: 0.5 }} /> URL
              </ToggleButton>
              <ToggleButton value="qr_imagen" sx={{ flex: 1, fontSize: 12, fontWeight: 600 }}>
                <QrCode2 fontSize="small" sx={{ mr: 0.5 }} /> QR imagen
              </ToggleButton>
            </ToggleButtonGroup>
          </Box>

          {tipo === 'url' && (
            <TextField
              label="URL del link de pago"
              placeholder="https://link.nequi.com.co/pagos/..."
              size="small"
              fullWidth
              value={linkUrl}
              onChange={e => setLinkUrl(e.target.value)}
              helperText="Se generará un QR automáticamente a partir de esta URL"
            />
          )}

          {tipo === 'qr_imagen' && (
            <Box>
              <input
                type="file"
                accept="image/*"
                ref={fileRef}
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />
              <Button
                variant="outlined"
                fullWidth
                disabled={compressing}
                startIcon={compressing ? <CircularProgress size={15} /> : <Upload />}
                onClick={() => fileRef.current?.click()}
                sx={{ borderRadius: 2, borderColor: qrBase64 ? '#10B981' : 'divider', fontWeight: 600 }}
              >
                {compressing ? 'Optimizando…' : qrBase64 ? 'Cambiar imagen QR' : 'Subir imagen QR'}
              </Button>
              {qrBase64 && !compressing && (
                <Chip
                  label="Imagen optimizada ✓"
                  size="small"
                  sx={{ mt: 0.8, bgcolor: alpha('#10B981', 0.1), color: '#10B981', fontWeight: 700 }}
                />
              )}
              <Typography fontSize={11} color="text.secondary" mt={0.5}>
                Cualquier tamaño — se optimiza automáticamente a WebP
              </Typography>
            </Box>
          )}

          <TextField
            label="Instrucciones (opcional)"
            placeholder="Ej: Escanea con tu app de banco y paga"
            size="small"
            fullWidth
            multiline
            rows={2}
            value={instrucciones}
            onChange={e => setInstrucciones(e.target.value)}
          />

          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="contained"
              onClick={handleSave}
              disabled={saving}
              startIcon={saving ? <CircularProgress size={15} sx={{ color: 'white' }} /> : <Save />}
              sx={{
                flex: 1, borderRadius: 2, fontWeight: 700,
                background: 'linear-gradient(135deg, #FF6020, #ff9a62)',
                boxShadow: '0 4px 14px rgba(255,96,32,0.3)',
              }}
            >
              {saving ? 'Guardando…' : (config ? 'Actualizar' : 'Guardar')}
            </Button>
            {config && (
              <Button
                variant="outlined"
                color="error"
                onClick={handleDelete}
                disabled={deleting}
                startIcon={deleting ? <CircularProgress size={15} color="error" /> : <Delete />}
                sx={{ borderRadius: 2, fontWeight: 600 }}
              >
                {deleting ? '…' : 'Eliminar'}
              </Button>
            )}
          </Box>
        </Box>

        {/* Preview */}
        <Box sx={{
          width: { xs: '100%', md: 220 }, flexShrink: 0,
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          gap: 1.5,
        }}>
          <Typography fontSize={12} fontWeight={600} color="text.secondary">
            Vista previa
          </Typography>
          <Paper
            elevation={0}
            sx={{
              p: 2, borderRadius: 3, bgcolor: '#ffffff',
              border: `1.5px solid ${alpha('#FF6020', 0.2)}`,
              display: 'flex', justifyContent: 'center', alignItems: 'center',
              width: 180, height: 180,
            }}
          >
            {tipo === 'url' && linkUrl && (
              <QRCodeSVG value={linkUrl} size={160} level="M" fgColor="#111827" bgColor="#ffffff" />
            )}
            {tipo === 'qr_imagen' && qrBase64 && (
              <img
                src={`data:${qrMimeType};base64,${qrBase64}`}
                alt="QR preview"
                style={{ width: 160, height: 160, objectFit: 'contain' }}
              />
            )}
            {((tipo === 'url' && !linkUrl) || (tipo === 'qr_imagen' && !qrBase64)) && (
              <Box sx={{ textAlign: 'center', color: 'text.disabled' }}>
                <QrCode2 sx={{ fontSize: 48, mb: 0.5, opacity: 0.25 }} />
                <Typography fontSize={11}>Sin vista previa</Typography>
              </Box>
            )}
          </Paper>
          {instrucciones && (
            <Typography fontSize={11} color="text.secondary" textAlign="center" sx={{ maxWidth: 180 }}>
              {instrucciones}
            </Typography>
          )}
        </Box>
      </Box>
    </Box>
  );
}
