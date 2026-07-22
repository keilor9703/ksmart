import React, { useState, useEffect, useRef } from 'react';
import {
  Box, Typography, Button, TextField, ToggleButton, ToggleButtonGroup,
  CircularProgress, Alert, IconButton, Paper, Divider, alpha, useTheme,
  Chip, Switch, FormControlLabel,
} from '@mui/material';
import {
  QrCode2, Link as LinkIcon, Delete, Save, Upload, CheckCircle,
  WarningAmber, Edit, Add, Close,
} from '@mui/icons-material';
import { QRCodeCanvas } from 'qrcode.react';
import { toast } from 'react-toastify';
import apiClient from '../../api';
import { compressImageToWebP } from '../../utils/imageOptimizer';

const emptyForm = {
  nombre: '', tipo: 'url', linkUrl: '', qrBase64: '', qrMimeType: '',
  instrucciones: '', isActive: true,
};

export default function LinkPagoConfig() {
  const theme = useTheme();
  const fileRef = useRef(null);

  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [links, setLinks]         = useState([]);
  const [empresaLogo, setEmpresaLogo] = useState(null);

  const [editingId, setEditingId] = useState(null); // null = no hay formulario abierto
  const [form, setForm]           = useState(emptyForm);
  const [compressing, setCompressing] = useState(false);

  const fetchLinks = async () => {
    setLoading(true);
    try {
      const [res, empRes] = await Promise.allSettled([
        apiClient.get('/empresa/link-pago/todos'),
        apiClient.get('/catalogo/config'),
      ]);
      if (res.status === 'fulfilled') setLinks(res.value.data || []);
      if (empRes.status === 'fulfilled' && empRes.value.data?.logo_base64) {
        setEmpresaLogo(empRes.value.data.logo_base64);
      }
    } catch {
      // sin links aún
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchLinks(); }, []);

  const openNewForm = () => {
    setForm(emptyForm);
    setEditingId('new');
  };

  const openEditForm = (link) => {
    setForm({
      nombre: link.nombre || '',
      tipo: link.tipo || 'url',
      linkUrl: link.link_url || '',
      qrBase64: link.qr_base64 || '',
      qrMimeType: link.qr_mime_type || '',
      instrucciones: link.instrucciones || '',
      isActive: link.is_active ?? true,
    });
    setEditingId(link.id);
  };

  const closeForm = () => {
    setEditingId(null);
    setForm(emptyForm);
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCompressing(true);
    try {
      const dataUrl = await compressImageToWebP(file, 800, 0.9);
      setForm(f => ({ ...f, qrBase64: dataUrl.split(',')[1], qrMimeType: 'image/webp' }));
    } catch {
      toast.error('No se pudo procesar la imagen. Intenta con otro archivo.');
    } finally {
      setCompressing(false);
    }
  };

  const handleSave = async () => {
    if (!form.nombre.trim()) { toast.error('El nombre es obligatorio.'); return; }
    if (form.tipo === 'url' && !form.linkUrl.trim()) { toast.error('Ingresa la URL del link de pago.'); return; }
    if (form.tipo === 'qr_imagen' && !form.qrBase64) { toast.error('Sube la imagen del código QR.'); return; }

    setSaving(true);
    try {
      const payload = {
        nombre: form.nombre.trim(),
        tipo: form.tipo,
        link_url: form.tipo === 'url' ? form.linkUrl.trim() : null,
        qr_base64: form.tipo === 'qr_imagen' ? form.qrBase64 : null,
        qr_mime_type: form.tipo === 'qr_imagen' ? form.qrMimeType : null,
        instrucciones: form.instrucciones.trim() || null,
        is_active: form.isActive,
      };
      if (editingId && editingId !== 'new') {
        await apiClient.put(`/empresa/link-pago/${editingId}`, payload);
      } else {
        await apiClient.post('/empresa/link-pago', payload);
      }
      toast.success('Link de pago guardado.');
      closeForm();
      await fetchLinks();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al guardar.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (link) => {
    if (!window.confirm(`¿Eliminar "${link.nombre}"? Ya no aparecerá como método de pago en Ventas.`)) return;
    setDeletingId(link.id);
    try {
      await apiClient.delete(`/empresa/link-pago/${link.id}`);
      toast.success('Link de pago eliminado.');
      if (editingId === link.id) closeForm();
      await fetchLinks();
    } catch {
      toast.error('Error al eliminar.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleToggleActive = async (link) => {
    try {
      await apiClient.put(`/empresa/link-pago/${link.id}`, { ...link, is_active: !link.is_active });
      await fetchLinks();
    } catch {
      toast.error('No se pudo actualizar.');
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress size={28} sx={{ color: '#0891B2' }} />
      </Box>
    );
  }

  const activos = links.filter(l => l.is_active);

  return (
    <Box>
      {activos.length > 0 ? (
        <Alert
          icon={<CheckCircle fontSize="small" />}
          severity="success"
          sx={{ mb: 2, borderRadius: 2, fontSize: 13 }}
        >
          {activos.length === 1
            ? <>Link activo: <strong>{activos[0].nombre}</strong></>
            : <>{activos.length} links de pago activos — cada uno aparece como su propio método de pago en Ventas.</>}
        </Alert>
      ) : (
        <Alert
          icon={<WarningAmber fontSize="small" />}
          severity="warning"
          sx={{ mb: 2, borderRadius: 2, fontSize: 13 }}
        >
          Sin links de pago activos — no aparecerá ninguna opción de Link/QR en el POS.
        </Alert>
      )}

      {/* ── Lista de links configurados ── */}
      {links.length > 0 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 2.5 }}>
          {links.map(link => (
            <Paper
              key={link.id}
              variant="outlined"
              sx={{
                p: 1.5, borderRadius: 2, display: 'flex', alignItems: 'center', gap: 1.5,
                opacity: link.is_active ? 1 : 0.6,
                borderColor: editingId === link.id ? '#0891B2' : 'divider',
              }}
            >
              <Box sx={{
                width: 36, height: 36, borderRadius: 1.5, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                bgcolor: alpha('#0891B2', 0.1), color: '#0891B2',
              }}>
                {link.tipo === 'url' ? <LinkIcon fontSize="small" /> : <QrCode2 fontSize="small" />}
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography fontSize={13} fontWeight={700} noWrap>{link.nombre}</Typography>
                <Typography fontSize={11} color="text.secondary">
                  {link.tipo === 'url' ? 'URL (QR generado)' : 'Imagen QR subida'}
                </Typography>
              </Box>
              <FormControlLabel
                sx={{ mr: 0 }}
                control={
                  <Switch
                    size="small"
                    checked={!!link.is_active}
                    onChange={() => handleToggleActive(link)}
                  />
                }
                label={<Typography fontSize={11} color="text.secondary">Activo</Typography>}
                labelPlacement="start"
              />
              <IconButton size="small" onClick={() => openEditForm(link)}>
                <Edit fontSize="small" />
              </IconButton>
              <IconButton
                size="small" color="error"
                disabled={deletingId === link.id}
                onClick={() => handleDelete(link)}
              >
                {deletingId === link.id ? <CircularProgress size={16} color="error" /> : <Delete fontSize="small" />}
              </IconButton>
            </Paper>
          ))}
        </Box>
      )}

      {editingId === null ? (
        <Button
          variant="outlined" startIcon={<Add />}
          onClick={openNewForm}
          sx={{ borderRadius: 2, fontWeight: 700, borderColor: '#0891B2', color: '#0891B2' }}
        >
          Agregar link de pago
        </Button>
      ) : (
        <Paper variant="outlined" sx={{ p: 2, borderRadius: 3, borderColor: alpha('#0891B2', 0.3) }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
            <Typography fontSize={13} fontWeight={700} color="#0891B2">
              {editingId === 'new' ? 'Nuevo link de pago' : 'Editar link de pago'}
            </Typography>
            <IconButton size="small" onClick={closeForm}><Close fontSize="small" /></IconButton>
          </Box>

          <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 2.5 }}>
            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField
                label="Nombre del método"
                placeholder="Ej: Nequi empresa, Bold QR, Bancolombia"
                size="small" fullWidth
                value={form.nombre}
                onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
              />

              <Box>
                <Typography fontSize={12} fontWeight={600} color="text.secondary" mb={0.8}>
                  Tipo de link
                </Typography>
                <ToggleButtonGroup
                  value={form.tipo}
                  exclusive
                  onChange={(_, v) => v && setForm(f => ({ ...f, tipo: v }))}
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

              {form.tipo === 'url' && (
                <TextField
                  label="URL del link de pago"
                  placeholder="https://link.nequi.com.co/pagos/..."
                  size="small" fullWidth
                  value={form.linkUrl}
                  onChange={e => setForm(f => ({ ...f, linkUrl: e.target.value }))}
                  helperText="Se generará un QR automáticamente a partir de esta URL"
                />
              )}

              {form.tipo === 'qr_imagen' && (
                <Box>
                  <input
                    type="file" accept="image/*" ref={fileRef}
                    onChange={handleFileChange}
                    style={{ display: 'none' }}
                  />
                  <Button
                    variant="outlined" fullWidth
                    disabled={compressing}
                    startIcon={compressing ? <CircularProgress size={15} /> : <Upload />}
                    onClick={() => fileRef.current?.click()}
                    sx={{ borderRadius: 2, borderColor: form.qrBase64 ? '#10B981' : 'divider', fontWeight: 600 }}
                  >
                    {compressing ? 'Optimizando…' : form.qrBase64 ? 'Cambiar imagen QR' : 'Subir imagen QR'}
                  </Button>
                  {form.qrBase64 && !compressing && (
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
                size="small" fullWidth multiline rows={2}
                value={form.instrucciones}
                onChange={e => setForm(f => ({ ...f, instrucciones: e.target.value }))}
              />

              <FormControlLabel
                control={
                  <Switch
                    checked={form.isActive}
                    onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))}
                  />
                }
                label={<Typography fontSize={12} color="text.secondary">Activo (visible como método de pago en Ventas)</Typography>}
              />

              <Button
                variant="contained"
                onClick={handleSave}
                disabled={saving}
                startIcon={saving ? <CircularProgress size={15} sx={{ color: 'white' }} /> : <Save />}
                sx={{
                  borderRadius: 2, fontWeight: 700,
                  background: 'linear-gradient(135deg, #0891B2, #22D3EE)',
                  boxShadow: '0 4px 14px rgba(8,145,178,0.3)',
                }}
              >
                {saving ? 'Guardando…' : (editingId !== 'new' ? 'Actualizar' : 'Guardar')}
              </Button>
            </Box>

            {/* Preview */}
            <Box sx={{
              width: { xs: '100%', md: 220 }, flexShrink: 0,
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5,
            }}>
              <Typography fontSize={12} fontWeight={600} color="text.secondary">
                Vista previa
              </Typography>
              <Paper
                elevation={0}
                sx={{
                  p: 2, borderRadius: 3, bgcolor: '#ffffff',
                  border: `1.5px solid ${alpha('#0891B2', 0.2)}`,
                  display: 'flex', justifyContent: 'center', alignItems: 'center',
                  width: 180, height: 180,
                }}
              >
                {form.tipo === 'url' && form.linkUrl && (
                  <QRCodeCanvas
                    value={form.linkUrl} size={160} level="H"
                    fgColor="#111827" bgColor="#ffffff"
                    {...(empresaLogo ? {
                      imageSettings: { src: empresaLogo, height: 48, width: 48, excavate: true }
                    } : {})}
                  />
                )}
                {form.tipo === 'qr_imagen' && form.qrBase64 && (
                  <img
                    src={`data:${form.qrMimeType};base64,${form.qrBase64}`}
                    alt="QR preview"
                    style={{ width: 160, height: 160, objectFit: 'contain' }}
                  />
                )}
                {((form.tipo === 'url' && !form.linkUrl) || (form.tipo === 'qr_imagen' && !form.qrBase64)) && (
                  <Box sx={{ textAlign: 'center', color: 'text.disabled' }}>
                    <QrCode2 sx={{ fontSize: 48, mb: 0.5, opacity: 0.25 }} />
                    <Typography fontSize={11}>Sin vista previa</Typography>
                  </Box>
                )}
              </Paper>
              {form.instrucciones && (
                <Typography fontSize={11} color="text.secondary" textAlign="center" sx={{ maxWidth: 180 }}>
                  {form.instrucciones}
                </Typography>
              )}
            </Box>
          </Box>
        </Paper>
      )}
    </Box>
  );
}
