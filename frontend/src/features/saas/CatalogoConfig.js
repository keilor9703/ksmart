import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, TextField, Button, Grid, Divider, 
  IconButton, Tooltip, Switch, FormControlLabel, Alert, 
  CircularProgress, Card, CardContent
} from '@mui/material';
import { 
  Storefront, WhatsApp, Link, ContentCopy, OpenInNew, 
  CloudUpload, Delete, CheckCircle, Info
} from '@mui/icons-material';
import apiClient from '../../api';
import { toast } from 'react-toastify';
import { compressImageToWebP } from '../../utils/imageOptimizer';

const CatalogoConfig = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [slug, setSlug] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [logo, setLogo] = useState(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [empresa, setEmpresa] = useState(null);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const res = await apiClient.get('/users/me');
      const emp = res.data.empresa;
      setEmpresa(emp);
      setSlug(emp.slug_catalogo || '');
      setWhatsapp(emp.whatsapp_pedidos || '');
      setLogo(emp.logo_base64 || null);
    } catch (error) {
      toast.error("Error al cargar configuración");
    } finally {
      setLoading(false);
    }
  };

  const handleLogoChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      setIsCompressing(true);
      const webpBase64 = await compressImageToWebP(file, 400); // Logo más pequeño
      setLogo(webpBase64);
    } catch (error) {
      toast.error("Error al procesar el logo");
    } finally {
      setIsCompressing(false);
    }
  };

  const handleSave = async () => {
    if (!slug) {
      toast.warning("El slug es obligatorio");
      return;
    }

    // Validación básica de slug: minúsculas, números y guiones
    const slugRegex = /^[a-z0-9-]+$/;
    if (!slugRegex.test(slug)) {
      toast.error("El slug solo permite letras minúsculas, números y guiones");
      return;
    }

    try {
      setSaving(true);
      await apiClient.put('/catalogo/config', {
        slug_catalogo: slug,
        whatsapp_pedidos: whatsapp,
        logo_base64: logo
      });
      toast.success("Configuración guardada exitosamente");
    } catch (error) {
      const detail = error.response?.data?.detail || "Error al guardar";
      toast.error(detail);
    } finally {
      setSaving(false);
    }
  };

  const copyToClipboard = () => {
    const url = `${window.location.origin}/${slug}`;
    navigator.clipboard.writeText(url);
    toast.info("Enlace copiado al portapapeles");
  };

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}><CircularProgress /></Box>;

  const catalogUrl = `${window.location.origin}/${slug}`;

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto', p: { xs: 1, md: 3 } }}>
      <Typography variant="h5" sx={{ fontWeight: 800, mb: 0.5, display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Storefront sx={{ color: 'primary.main', fontSize: 32 }} />
        Configuración de Catálogo Virtual
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
        Personaliza tu tienda online y comparte el enlace directo con tus clientes para recibir pedidos por WhatsApp.
      </Typography>

      <Grid container spacing={3}>
        {/* PANEL DE CONFIGURACIÓN */}
        <Grid item xs={12} md={7}>
          <Paper variant="outlined" sx={{ p: 3, borderRadius: 4 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              
              <Box>
                <Typography sx={{ fontWeight: 700, fontSize: 14, mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Link fontSize="small" color="primary" /> URL del Catálogo (Slug)
                </Typography>
                <TextField
                  fullWidth
                  placeholder="ej: mi-tienda-pro"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
                  helperText="Solo letras minúsculas, números y guiones. Será tu enlace público."
                  InputProps={{
                    startAdornment: (
                      <Typography sx={{ color: 'text.secondary', fontSize: 13, mr: 0.5, whiteSpace: 'nowrap' }}>
                        {window.location.hostname}/
                      </Typography>
                    )
                  }}
                />
              </Box>

              <Box>
                <Typography sx={{ fontWeight: 700, fontSize: 14, mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <WhatsApp fontSize="small" sx={{ color: '#25D366' }} /> WhatsApp para Pedidos
                </Typography>
                <TextField
                  fullWidth
                  placeholder="ej: 573001234567"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value.replace(/\D/g, ''))}
                  helperText="Incluye código de país sin el signo +. Ejemplo: 57 para Colombia."
                />
              </Box>

              <Box>
                <Typography sx={{ fontWeight: 700, fontSize: 14, mb: 1 }}>
                  Logo del Catálogo (Opcional)
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Box 
                    sx={{ 
                      width: 80, height: 80, borderRadius: 2, border: '2px dashed', 
                      borderColor: 'divider', overflow: 'hidden', display: 'flex', 
                      alignItems: 'center', justifyContent: 'center', bgcolor: 'action.hover' 
                    }}
                  >
                    {logo ? (
                      <img src={logo} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    ) : (
                      <Storefront sx={{ color: 'text.disabled', fontSize: 40 }} />
                    )}
                  </Box>
                  <Box>
                    <Button 
                      variant="outlined" 
                      component="label" 
                      size="small" 
                      startIcon={<CloudUpload />}
                      disabled={isCompressing}
                    >
                      {isCompressing ? 'Procesando...' : 'Subir Logo'}
                      <input hidden accept="image/*" type="file" onChange={handleLogoChange} />
                    </Button>
                    {logo && (
                      <IconButton size="small" color="error" onClick={() => setLogo(null)} sx={{ ml: 1 }}>
                        <Delete fontSize="small" />
                      </IconButton>
                    )}
                  </Box>
                </Box>
              </Box>

              <Divider />

              <Button
                variant="contained"
                size="large"
                fullWidth
                onClick={handleSave}
                disabled={saving}
                sx={{ 
                  borderRadius: 3, 
                  py: 1.5, 
                  fontWeight: 700,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                }}
              >
                {saving ? 'Guardando...' : 'Guardar Cambios'}
              </Button>
            </Box>
          </Paper>
        </Grid>

        {/* PANEL DE VISTA PREVIA Y COMPARTIR */}
        <Grid item xs={12} md={5}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <Card variant="outlined" sx={{ borderRadius: 4, bgcolor: 'primary.main', color: '#fff', border: 'none' }}>
              <CardContent sx={{ p: 3 }}>
                <Typography sx={{ fontWeight: 700, fontSize: 16, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CheckCircle fontSize="small" /> Tu catálogo está listo
                </Typography>
                
                <Box sx={{ bgcolor: 'rgba(255,255,255,0.15)', p: 2, borderRadius: 3, mb: 2 }}>
                  <Typography variant="caption" sx={{ opacity: 0.8, display: 'block', mb: 0.5 }}>
                    Enlace público:
                  </Typography>
                  <Typography sx={{ fontWeight: 600, fontSize: 14, wordBreak: 'break-all' }}>
                    {catalogUrl}
                  </Typography>
                </Box>

                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button 
                    variant="contained" 
                    fullWidth 
                    size="small"
                    startIcon={<ContentCopy />}
                    onClick={copyToClipboard}
                    sx={{ bgcolor: '#fff', color: 'primary.main', fontWeight: 700, '&:hover': { bgcolor: '#f0f0f0' } }}
                  >
                    Copiar
                  </Button>
                  <Button 
                    variant="contained" 
                    fullWidth 
                    size="small"
                    startIcon={<OpenInNew />}
                    onClick={() => window.open(`/${slug}`, '_blank')}
                    sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: '#fff', fontWeight: 700, '&:hover': { bgcolor: 'rgba(255,255,255,0.3)' } }}
                  >
                    Abrir
                  </Button>
                </Box>
              </CardContent>
            </Card>

            <Alert icon={<Info fontSize="inherit" />} severity="info" sx={{ borderRadius: 3 }}>
              Recuerda activar la opción <strong>"Mostrar en tienda virtual"</strong> en tus productos para que aparezcan en el catálogo.
            </Alert>

            <Paper variant="outlined" sx={{ p: 2, borderRadius: 3, textAlign: 'center' }}>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                Escanea para ir al catálogo:
              </Typography>
              <Box sx={{ display: 'inline-block', p: 1.5, bgcolor: '#fff', borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                <img 
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(catalogUrl)}`} 
                  alt="QR Code" 
                  style={{ width: 120, height: 120 }}
                />
              </Box>
            </Paper>
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
};

export default CatalogoConfig;
