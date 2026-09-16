import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box, Typography, Paper, TextField, Button, Grid, Divider,
  IconButton, Switch, FormControlLabel, Alert, InputAdornment,
  CircularProgress, Card, CardContent, Tooltip
} from '@mui/material';
import {
  Storefront, WhatsApp, Link, ContentCopy, OpenInNew,
  CloudUpload, Delete, CheckCircle, Info, Palette, GetApp,
  CheckCircleOutline, Cancel, LocationOn, Apartment,
  Instagram, Facebook,
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
  const [colorPrimario, setColorPrimario] = useState('#0891B2');
  const [descripcion, setDescripcion] = useState('');
  const [direccionRecogida, setDireccionRecogida] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [visibleMarketplace, setVisibleMarketplace] = useState(false);
  const [categoriaMarketplace, setCategoriaMarketplace] = useState('');
  const [instagramUrl, setInstagramUrl] = useState('');
  const [facebookUrl, setFacebookUrl] = useState('');

  const CATEGORIAS_MARKETPLACE = [
    'Calzado', 'Ropa y Accesorios', 'Alimentos y Bebidas', 'Restaurantes',
    'Belleza y Cuidado Personal', 'Hogar y Decoración', 'Tecnología',
    'Salud', 'Automotriz', 'Deportes', 'Otros',
  ];

  const COLOR_PRESETS = ['#0891B2', '#8B5CF6', '#3B82F6', '#10B981', '#F59E0B', '#EF4444'];
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
      setColorPrimario(emp.color_primario || '#0891B2');
      setDescripcion(emp.descripcion || '');
      setDireccionRecogida(emp.ciudad || '');
      setVisibleMarketplace(Boolean(emp.visible_marketplace));
      setCategoriaMarketplace(emp.categoria_marketplace || '');
      setInstagramUrl(emp.instagram_url || '');
      setFacebookUrl(emp.facebook_url || '');
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
    if (visibleMarketplace && !categoriaMarketplace) {
      toast.warning("Elige una categoría para aparecer en el Centro Comercial Virtual");
      return;
    }
    const urlRegex = /^https?:\/\/.+/i;
    if (instagramUrl.trim() && !urlRegex.test(instagramUrl.trim())) {
      toast.warning("El link de Instagram debe empezar con https://");
      return;
    }
    if (facebookUrl.trim() && !urlRegex.test(facebookUrl.trim())) {
      toast.warning("El link de Facebook debe empezar con https://");
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
        visible_marketplace: visibleMarketplace,
        categoria_marketplace: categoriaMarketplace || null,
        instagram_url: instagramUrl.trim() || null,
        facebook_url: facebookUrl.trim() || null,
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
    const url = `https://catalogo.ksmart360.com/${slug}`;
    navigator.clipboard.writeText(url);
    toast.info("Enlace copiado al portapapeles");
  };

  // El catálogo de un restaurante es un Menú Digital con QR de mesa: el cliente
  // escanea, ve la carta y pide directo a cocina (sin stock, sin domicilio/recogida).
  const esRestaurante = empresa?.tipo_negocio === 'restaurante';
  const labelModulo  = esRestaurante ? 'Menú Digital' : 'Catálogo Virtual';
  const labelEntidad = esRestaurante ? 'menú' : 'tienda';

  const catalogSteps = esRestaurante ? [
    { title: 'Define tu URL', description: 'El slug será la dirección única de tu menú digital (ej: tudominio.com/mi-restaurante).' },
    { title: 'Sube tu logo', description: 'Un logo profesional refuerza tu marca en la cabecera del menú.' },
    { title: 'Elige tu color', description: 'Personaliza el menú con el color de tu restaurante.' },
    { title: 'Imprime el QR en las mesas', description: 'Descarga el código QR y colócalo en cada mesa. Tus clientes lo escanean, ven la carta y piden directo a cocina.' },
    { title: 'Activa tus platos', description: 'Marca "Mostrar en catálogo" en cada plato que quieras ofrecer en la carta.' },
  ] : [
    { title: 'Define tu URL', description: 'El slug será la dirección única de tu tienda (ej: ksmart.com/tu-tienda).' },
    { title: 'Vincula WhatsApp', description: 'Asegúrate de incluir el código de país para recibir pedidos directamente.' },
    { title: 'Agrega tu dirección', description: 'La dirección de recogida aparecerá cuando el cliente elija "Recoger en tienda" al hacer su pedido.' },
    { title: 'Sube tu Logo', description: 'Un logo profesional genera confianza en tus clientes.' },
    { title: 'Activa tus Productos', description: 'Recuerda marcar "Mostrar en catálogo" en la edición de cada producto.' }
  ];

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}><CircularProgress /></Box>;

  const catalogUrl = `https://catalogo.ksmart360.com/${slug}`;

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto', p: { xs: 1, md: 3 } }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.5 }}>
        <Typography variant="h5" sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Storefront sx={{ color: 'primary.main', fontSize: 32 }} />
          Configuración de {labelModulo}
        </Typography>
        <HelpGuideTopBar
          moduleName={labelModulo}
          steps={catalogSteps}
          faqItems={esRestaurante ? [
            { q: '¿Cómo acceden mis clientes al menú?', a: 'Descarga el código QR y colócalo en cada mesa (o imprímelo en la carta). El cliente lo escanea con su celular, ve la carta y pide directo a cocina sin necesidad de app ni mesero.' },
            { q: '¿Qué platos aparecen en el menú?', a: 'Solo los productos que tengan activada la opción "Mostrar en catálogo" en su ficha. Ve a Productos → edita el plato → activa la opción.' },
            { q: '¿Los pedidos llegan automáticamente a cocina?', a: 'Sí. Cuando el cliente confirma su pedido desde la mesa, se crea o actualiza la comanda de esa mesa y los platos aparecen en la Pantalla de Cocina. Además se genera una notificación y la mesa se marca como "📱 Cliente" en el Mapa de Mesas para que el personal la atienda.' },
            { q: '¿Necesito validar el inventario de los platos?', a: 'No. Al ser preparación en cocina, el menú digital no bloquea por stock: los clientes siempre pueden pedir cualquier plato visible en la carta.' },
            { q: '¿Puedo cambiar los colores y el logo?', a: 'Sí, usa el selector de color y sube tu logo en esta misma sección de configuración. Los cambios se reflejan en tu menú digital de inmediato.' },
          ] : [
            { q: '¿Cómo comparten mis clientes el catálogo?', a: 'Copia el enlace de tu tienda o descarga el código QR y compártelo por WhatsApp, redes sociales o imprímelo en material publicitario.' },
            { q: '¿Qué productos aparecen en el catálogo?', a: 'Solo los productos que tengan activada la opción "Mostrar en catálogo" en su ficha. Ve a Productos → edita el producto → activa la opción.' },
            { q: '¿Los pedidos llegan automáticamente al sistema?', a: 'Sí. Cada vez que un cliente completa su carrito, el pedido se crea automáticamente en el módulo Pedidos Virtuales con estado "Nuevo" y se genera una notificación en tiempo real para todos los usuarios. Desde ese módulo puedes confirmarlo, prepararlo, marcarlo como enviado y finalmente convertirlo en venta con un solo clic, lo que descuenta el inventario y genera el comprobante.' },
            { q: '¿Puedo cambiar los colores y el logo?', a: 'Sí, usa el selector de color y sube tu logo en esta misma sección de configuración. Los cambios se reflejan en tu tienda virtual de inmediato.' },
          ]}
        />
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
        {esRestaurante
          ? 'Personaliza tu menú digital e imprime el código QR para cada mesa. Tus clientes escanean, ven la carta y piden directo a cocina.'
          : 'Personaliza tu tienda online y comparte el enlace directo con tus clientes para recibir pedidos por WhatsApp.'}
      </Typography>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 7 }}>
          <Paper variant="outlined" sx={{ p: 3, borderRadius: 4 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              
              <Box>
                <Typography sx={{ fontWeight: 700, fontSize: 14, mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Link fontSize="small" color="primary" /> URL del {labelModulo} (Slug)
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
                  <WhatsApp fontSize="small" sx={{ color: '#25D366' }} />
                  {esRestaurante ? 'WhatsApp de Contacto (Opcional)' : 'WhatsApp para Pedidos'}
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
                    helperText={esRestaurante
                      ? 'Los pedidos de mesa llegan directo a cocina. Este número es solo para contacto del cliente.'
                      : 'Incluye código de país sin el signo +. Ejemplo: 57 para Colombia.'}
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
                  <Palette fontSize="small" sx={{ color: colorPrimario }} /> Color Principal del {labelModulo}
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

              {!esRestaurante && (
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
              )}

              <Box>
                <Typography sx={{ fontWeight: 700, fontSize: 14, mb: 1 }}>
                  {esRestaurante ? 'Descripción del Restaurante (Opcional)' : 'Descripción de la Tienda (Opcional)'}
                </Typography>
                <TextField
                  fullWidth
                  multiline
                  rows={3}
                  placeholder={esRestaurante
                    ? 'Describe tu restaurante, especialidades de la casa o tu propuesta gastronómica…'
                    : 'Describe tu tienda, productos destacados o tu propuesta de valor para los clientes…'}
                  value={descripcion}
                  onChange={(e) => e.target.value.length <= 200 && setDescripcion(e.target.value)}
                  helperText={`${descripcion.length}/200 caracteres`}
                  inputProps={{ maxLength: 200 }}
                />
              </Box>

              <Box>
                <Typography sx={{ fontWeight: 700, fontSize: 14, mb: 1 }}>
                  Redes Sociales (Opcional)
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      placeholder="https://instagram.com/tu_tienda"
                      value={instagramUrl}
                      onChange={(e) => setInstagramUrl(e.target.value)}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <Instagram fontSize="small" sx={{ color: '#E1306C' }} />
                          </InputAdornment>
                        ),
                      }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      placeholder="https://facebook.com/tu_tienda"
                      value={facebookUrl}
                      onChange={(e) => setFacebookUrl(e.target.value)}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <Facebook fontSize="small" sx={{ color: '#1877F2' }} />
                          </InputAdornment>
                        ),
                      }}
                    />
                  </Grid>
                </Grid>
                <Typography sx={{ fontSize: 11.5, color: 'text.secondary', mt: 0.5 }}>
                  Se mostrarán como íconos en tu catálogo virtual, junto al logo y al final de la página.
                </Typography>
              </Box>

              {!esRestaurante && (
                <Box sx={{
                  p: 2.5, borderRadius: 3, border: '1.5px solid',
                  borderColor: visibleMarketplace ? '#10B981' : 'divider',
                  bgcolor: visibleMarketplace ? 'rgba(16,185,129,0.06)' : 'transparent',
                  transition: 'all 0.2s',
                }}>
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2 }}>
                    <Box sx={{ display: 'flex', gap: 1.5 }}>
                      <Apartment sx={{ color: visibleMarketplace ? '#10B981' : 'text.secondary', fontSize: 22, mt: 0.2 }} />
                      <Box>
                        <Typography sx={{ fontWeight: 700, fontSize: 14 }}>
                          Aparecer en el Centro Comercial Virtual
                        </Typography>
                        <Typography sx={{ fontSize: 12.5, color: 'text.secondary', mt: 0.3, maxWidth: 420 }}>
                          Un directorio público (dominio aparte) donde varios negocios se agrupan por marca.
                          Los clientes te descubren ahí y entran directo a tu tienda de siempre. Apagado por defecto.
                        </Typography>
                      </Box>
                    </Box>
                    <Switch
                      checked={visibleMarketplace}
                      onChange={(e) => setVisibleMarketplace(e.target.checked)}
                      sx={{
                        '& .MuiSwitch-switchBase.Mui-checked': { color: '#10B981' },
                        '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: '#10B981' },
                      }}
                    />
                  </Box>
                  {visibleMarketplace && (
                    <TextField
                      select fullWidth size="small"
                      label="Categoría de tu negocio *"
                      value={categoriaMarketplace}
                      onChange={(e) => setCategoriaMarketplace(e.target.value)}
                      SelectProps={{ native: true }}
                      sx={{ mt: 2 }}
                      helperText="Así los clientes te encuentran filtrando por rubro en el directorio."
                    >
                      <option value="" disabled>Selecciona una categoría</option>
                      {CATEGORIAS_MARKETPLACE.map(c => <option key={c} value={c}>{c}</option>)}
                    </TextField>
                  )}
                </Box>
              )}

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

        <Grid size={{ xs: 12, md: 5 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <Card variant="outlined" sx={{ borderRadius: 4, border: '1.5px solid', borderColor: 'divider' }}>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <CheckCircle sx={{ color: '#10B981', fontSize: 20 }} />
                  <Typography sx={{ fontWeight: 700, fontSize: 15, color: 'text.primary' }}>
                    {esRestaurante ? 'Tu menú digital está listo' : 'Tu catálogo está listo'}
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
              Recuerda activar la opción <strong>"Mostrar en catálogo"</strong> en tus {esRestaurante ? 'platos' : 'productos'} para que aparezcan en el {labelEntidad}.
            </Alert>

            <Paper variant="outlined" sx={{ p: 2, borderRadius: 3, textAlign: 'center' }}>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                {esRestaurante ? 'Imprime este QR y colócalo en cada mesa:' : 'Escanea para ir al catálogo:'}
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
