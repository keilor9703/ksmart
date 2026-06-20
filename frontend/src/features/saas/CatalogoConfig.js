import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box, Typography, Paper, TextField, Button, Grid, Divider,
  IconButton, Switch, FormControlLabel, Alert, InputAdornment,
  CircularProgress, Card, CardContent, Tooltip
} from '@mui/material';
import {
  Storefront, WhatsApp, Link, ContentCopy, OpenInNew,
  CloudUpload, Delete, CheckCircle, Info, Palette, GetApp,
  CheckCircleOutline, Cancel, LocationOn
} from '@mui/icons-material';
import { QRCodeCanvas } from 'qrcode.react';
import apiClient from '../../api';
import { toast } from 'react-toastify';
import { compressImageToWebP } from '../../utils/imageOptimizer';
import HelpGuideTopBar from '../../components/onboarding/HelpGuideTopBar';
import SmartTooltip from '../../components/onboarding/SmartTooltip';

const CatalogoConfig = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [slug, setSlug] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [logo, setLogo] = useState(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [empresa, setEmpresa] = useState(null);
  const [colorPrimario, setColorPrimario] = useState('#FF6020');
  const [descripcion, setDescripcion] = useState('');
  const [direccionRecogida, setDireccionRecogida] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  const COLOR_PRESETS = ['#FF6020', '#8B5CF6', '#3B82F6', '#10B981', '#F59E0B', '#EF4444'];
  const slugValid = slug.length === 0 || /^[a-z0-9-]+$/.test(slug);

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
      setColorPrimario(emp.color_primario || '#FF6020');
      setDescripcion(emp.descripcion || '');
      setDireccionRecogida(emp.ciudad || '');
    } catch (error) {
      toast.error("Error al cargar configuración");
    } finally {
      setLoading(false);
    }
  };

  const processLogoFile = useCallback(async (file) => {
    if (!file || !file.type.startsWith('image/')) return;
    try {
      setIsCompressing(true);
      const webpBase64 = await compressImageToWebP(file, 400);
      setLogo(webpBase64);
    } catch {
      toast.error("Error al procesar el logo");
    } finally {
      setIsCompressing(false);
    }
  }, []);

  const handleLogoChange = (e) => processLogoFile(e.target.files[0]);

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    processLogoFile(e.dataTransfer.files[0]);
  };

  const handleSave = async () => {
    if (!slug) {
      toast.warning("El slug es obligatorio");
      return;
    }

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
        logo_base64: logo,
        color_primario: colorPrimario,
        descripcion: descripcion.trim() || null,
        direccion_recogida: direccionRecogida.trim() || null,
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
    const url = `https://catalogo.appjeylor.com/${slug}`;
    navigator.clipboard.writeText(url);
    toast.info("Enlace copiado al portapapeles");
  };

  const catalogSteps = [
    { title: 'Define tu URL', description: 'El slug será la dirección única de tu tienda (ej: ksmart.com/tu-tienda).' },
    { title: 'Vincula WhatsApp', description: 'Asegúrate de incluir el código de país para recibir pedidos directamente.' },
    { title: 'Agrega tu dirección', description: 'La dirección de recogida aparecerá cuando el cliente elija "Recoger en tienda" al hacer su pedido.' },
    { title: 'Sube tu Logo', description: 'Un logo profesional genera confianza en tus clientes.' },
    { title: 'Activa tus Productos', description: 'Recuerda marcar "Mostrar en catálogo" en la edición de cada producto.' }
  ];

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}><CircularProgress /></Box>;

  const catalogUrl = `https://catalogo.appjeylor.com/${slug}`;

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto', p: { xs: 1, md: 3 } }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.5 }}>
        <Typography variant="h5" sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Storefront sx={{ color: 'primary.main', fontSize: 32 }} />
          Configuración de Catálogo Virtual
        </Typography>
        <HelpGuideTopBar
          moduleName="Catálogo Virtual"
          steps={catalogSteps}
          faqItems={[
            { q: '¿Cómo comparten mis clientes el catálogo?', a: 'Copia el enlace de tu tienda o descarga el código QR y compártelo por WhatsApp, redes sociales o imprímelo en material publicitario.' },
            { q: '¿Qué productos aparecen en el catálogo?', a: 'Solo los productos que tengan activada la opción "Mostrar en catálogo" en su ficha. Ve a Productos → edita el producto → activa la opción.' },
            { q: '¿Los pedidos llegan automáticamente al sistema?', a: 'Sí. Cada vez que un cliente completa su carrito, el pedido se crea automáticamente en el módulo Pedidos Virtuales con estado "Nuevo" y se genera una notificación en tiempo real para todos los usuarios. Desde ese módulo puedes confirmarlo, prepararlo, marcarlo como enviado y finalmente convertirlo en venta con un solo clic, lo que descuenta el inventario y genera el comprobante.' },
            { q: '¿Puedo cambiar los colores y el logo?', a: 'Sí, usa el selector de color y sube tu logo en esta misma sección de configuración. Los cambios se reflejan en tu tienda virtual de inmediato.' },
          ]}
        />
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
        Personaliza tu tienda online y comparte el enlace directo con tus clientes para recibir pedidos por WhatsApp.
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12} md={7}>
          <Paper variant="outlined" sx={{ p: 3, borderRadius: 4 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              
              <Box>
                <Typography sx={{ fontWeight: 700, fontSize: 14, mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Link fontSize="small" color="primary" /> URL del Catálogo (Slug)
                </Typography>
                <SmartTooltip
                  id="cat_slug_tip"
                  title="Tu enlace único"
                  description="Este nombre identificará tu tienda. Usa algo corto y fácil de recordar para tus clientes."
                >
                  <TextField
                    fullWidth
                    placeholder="ej: mi-tienda-pro"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
                    error={slug.length > 0 && !slugValid}
                    helperText={
                      slug.length > 0 && !slugValid
                        ? 'Solo letras minúsculas, números y guiones'
                        : 'Será tu enlace público'
                    }
                    InputProps={{
                      startAdornment: (
                        <Typography sx={{ color: 'text.secondary', fontSize: 13, mr: 0.5, whiteSpace: 'nowrap' }}>
                          {window.location.hostname}/
                        </Typography>
                      ),
                      endAdornment: slug.length > 0 && (
                        <InputAdornment position="end">
                          {slugValid
                            ? <CheckCircleOutline sx={{ fontSize: 18, color: '#10B981' }} />
                            : <Cancel sx={{ fontSize: 18, color: '#EF4444' }} />}
                        </InputAdornment>
                      ),
                    }}
                  />
                </SmartTooltip>
              </Box>

              <Box>
                <Typography sx={{ fontWeight: 700, fontSize: 14, mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <WhatsApp fontSize="small" sx={{ color: '#25D366' }} /> WhatsApp para Pedidos
                </Typography>
                <SmartTooltip 
                  id="cat_whatsapp_tip" 
                  title="Formato Internacional" 
                  description="Es vital incluir el código de país (ej: 57 para Colombia) para que el botón de pedido funcione correctamente."
                >
                  <TextField
                    fullWidth
                    placeholder="ej: 573001234567"
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(e.target.value.replace(/\D/g, ''))}
                    helperText="Incluye código de país sin el signo +. Ejemplo: 57 para Colombia."
                  />
                </SmartTooltip>
              </Box>

              <Box>
                <Typography sx={{ fontWeight: 700, fontSize: 14, mb: 1 }}>
                  Logo del Catálogo (Opcional)
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                  <Box
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                    sx={{
                      width: 120, height: 120, borderRadius: 3,
                      border: '2px dashed',
                      borderColor: isDragging ? 'primary.main' : 'divider',
                      overflow: 'hidden', display: 'flex', flexShrink: 0,
                      alignItems: 'center', justifyContent: 'center',
                      bgcolor: isDragging ? 'primary.50' : 'action.hover',
                      transition: 'all 0.2s',
                      cursor: 'pointer',
                    }}
                    component="label"
                  >
                    {logo ? (
                      <img src={logo} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    ) : (
                      <Box sx={{ textAlign: 'center', px: 1 }}>
                        <CloudUpload sx={{ color: 'text.disabled', fontSize: 32, mb: 0.5 }} />
                        <Typography sx={{ fontSize: 10, color: 'text.disabled', lineHeight: 1.3 }}>
                          Arrastra o haz clic
                        </Typography>
                      </Box>
                    )}
                    <input hidden accept="image/*" type="file" onChange={handleLogoChange} />
                  </Box>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, pt: 0.5 }}>
                    <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
                      PNG, JPG o WebP. Recomendado cuadrado.
                    </Typography>
                    {isCompressing && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <CircularProgress size={14} />
                        <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>Procesando...</Typography>
                      </Box>
                    )}
                    {logo && (
                      <Button
                        size="small" color="error" variant="outlined" startIcon={<Delete />}
                        onClick={() => setLogo(null)} sx={{ borderRadius: 2, width: 'fit-content' }}
                      >
                        Quitar logo
                      </Button>
                    )}
                  </Box>
                </Box>
              </Box>

              <Box>
                <Typography sx={{ fontWeight: 700, fontSize: 14, mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Palette fontSize="small" sx={{ color: colorPrimario }} /> Color Principal de la Tienda
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                  <Tooltip title="Seleccionar color personalizado">
                    <Box
                      component="label"
                      sx={{
                        width: 40, height: 40, borderRadius: 2, cursor: 'pointer',
                        bgcolor: colorPrimario, border: '3px solid',
                        borderColor: 'divider', flexShrink: 0,
                        transition: 'transform 0.15s',
                        '&:hover': { transform: 'scale(1.1)' },
                      }}
                    >
                      <input
                        hidden type="color"
                        value={colorPrimario}
                        onChange={(e) => setColorPrimario(e.target.value)}
                      />
                    </Box>
                  </Tooltip>
                  {COLOR_PRESETS.map(c => (
                    <Tooltip key={c} title={c}>
                      <Box
                        onClick={() => setColorPrimario(c)}
                        sx={{
                          width: 28, height: 28, borderRadius: '50%', cursor: 'pointer',
                          bgcolor: c, flexShrink: 0,
                          border: '3px solid',
                          borderColor: colorPrimario === c ? c : 'transparent',
                          outline: colorPrimario === c ? `2px solid ${c}40` : 'none',
                          transition: 'transform 0.15s',
                          '&:hover': { transform: 'scale(1.15)' },
                        }}
                      />
                    </Tooltip>
                  ))}
                  <Typography sx={{ fontSize: 12, color: 'text.secondary', fontFamily: 'monospace' }}>
                    {colorPrimario.toUpperCase()}
                  </Typography>
                </Box>
              </Box>

              <Box>
                <Typography sx={{ fontWeight: 700, fontSize: 14, mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <LocationOn fontSize="small" color="error" /> Dirección de Recogida en Tienda
                </Typography>
                <TextField
                  fullWidth
                  placeholder="ej: Calle 10 #5-32, Barrio Centro, Medellín"
                  value={direccionRecogida}
                  onChange={(e) => setDireccionRecogida(e.target.value)}
                  helperText="Esta dirección aparecerá al cliente cuando elija 'Recoger en tienda' al hacer su pedido."
                />
              </Box>

              <Box>
                <Typography sx={{ fontWeight: 700, fontSize: 14, mb: 1 }}>
                  Descripción de la Tienda (Opcional)
                </Typography>
                <TextField
                  fullWidth
                  multiline
                  rows={3}
                  placeholder="Describe tu tienda, productos destacados o tu propuesta de valor para los clientes…"
                  value={descripcion}
                  onChange={(e) => e.target.value.length <= 200 && setDescripcion(e.target.value)}
                  helperText={`${descripcion.length}/200 caracteres`}
                  inputProps={{ maxLength: 200 }}
                />
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

        <Grid item xs={12} md={5}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <Card variant="outlined" sx={{ borderRadius: 4, border: '1.5px solid', borderColor: 'divider' }}>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <CheckCircle sx={{ color: '#10B981', fontSize: 20 }} />
                  <Typography sx={{ fontWeight: 700, fontSize: 15, color: 'text.primary' }}>
                    Tu catálogo está listo
                  </Typography>
                </Box>

                <Box sx={{
                  bgcolor: 'action.hover', p: 2, borderRadius: 2, mb: 2,
                  border: '1px solid', borderColor: 'divider',
                }}>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5, fontWeight: 600 }}>
                    Enlace público:
                  </Typography>
                  <Typography sx={{ fontWeight: 700, fontSize: 13, wordBreak: 'break-all', color: 'primary.main' }}>
                    {catalogUrl}
                  </Typography>
                </Box>

                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button
                    variant="outlined"
                    fullWidth
                    size="small"
                    startIcon={<ContentCopy />}
                    onClick={copyToClipboard}
                    sx={{ borderRadius: 2, fontWeight: 700 }}
                  >
                    Copiar enlace
                  </Button>
                  <Button
                    variant="contained"
                    fullWidth
                    size="small"
                    startIcon={<OpenInNew />}
                    onClick={() => window.open(catalogUrl, '_blank', 'noopener,noreferrer')}
                    sx={{ borderRadius: 2, fontWeight: 700 }}
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
              <Box id="qr-canvas-wrapper" sx={{ display: 'inline-block', p: 1.5, bgcolor: '#fff', borderRadius: 2, border: '1px solid', borderColor: 'divider', mb: 1.5 }}>
                <QRCodeCanvas
                  value={catalogUrl}
                  size={160}
                  level="H"
                  marginSize={1}
                  {...(logo ? {
                    imageSettings: {
                      src: logo,
                      x: undefined,
                      y: undefined,
                      height: 48,
                      width: 48,
                      excavate: true,
                    }
                  } : {})}
                />
              </Box>
              <Box>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<GetApp />}
                  onClick={() => {
                    const canvas = document.querySelector('#qr-canvas-wrapper canvas');
                    if (!canvas) return;
                    const link = document.createElement('a');
                    link.download = `qr-${slug || 'catalogo'}.png`;
                    link.href = canvas.toDataURL('image/png');
                    link.click();
                  }}
                  sx={{ borderRadius: 2, fontWeight: 600, fontSize: 12 }}
                >
                  Descargar QR
                </Button>
              </Box>
            </Paper>
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
};

export default CatalogoConfig;
