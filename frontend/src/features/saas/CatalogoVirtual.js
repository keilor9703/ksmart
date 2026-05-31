import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import {
  Box, Typography, Grid, Card, CardContent, CardMedia, IconButton,
  Button, TextField, InputAdornment, Badge, Drawer, Divider,
  List, ListItem, ListItemText, ListItemAvatar, Avatar,
  CircularProgress, Chip, useMediaQuery, useTheme, Fab,
  Dialog, DialogTitle, DialogContent, DialogActions, RadioGroup,
  FormControlLabel, Radio, Zoom, Paper, Alert, Skeleton, Select, Tooltip
} from '@mui/material';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import {
  Search, ShoppingCart, Add, Remove, WhatsApp,
  Storefront, LocationOn, Person, Phone, Close,
  ArrowForward, ShoppingBag, RocketLaunch, BarChart, Inventory2,
  Favorite, FavoriteBorder, KeyboardArrowUp, FilterList
} from '@mui/icons-material';
import DarkMode from '@mui/icons-material/DarkMode';
import LightMode from '@mui/icons-material/LightMode';
import MenuItem from '@mui/material/MenuItem';
import apiClient from '../../api';
import { toast } from 'react-toastify';

const CatalogoVirtual = () => {
  const { slug } = useParams();
  const outerTheme = useTheme();
  const isMobile = useMediaQuery(outerTheme.breakpoints.down('sm'));

  // ── Inyectar fuente moderna (solo una vez por sesión) ─────────────────
  useEffect(() => {
    if (!document.getElementById('cat-font-nunito')) {
      const link = document.createElement('link');
      link.id = 'cat-font-nunito';
      link.rel = 'stylesheet';
      link.href = 'https://fonts.googleapis.com/css2?family=Nunito:ital,wght@0,400;0,500;0,600;0,700;0,800;0,900;1,400&display=swap';
      document.head.appendChild(link);
    }
  }, []);


  // ── Local theme mode — independent of system/app preference ──────────
  const [catMode, setCatMode] = useState(() =>
    localStorage.getItem(`cat_theme_${slug}`) || 'light'
  );
  const catTheme = useMemo(() => createTheme({
    palette: { mode: catMode },
    typography: {
      fontFamily: '"Nunito", "Inter", system-ui, -apple-system, sans-serif',
    },
  }), [catMode]);
  const isDark = catMode === 'dark';

  // Semantic color tokens for custom Box/Typography that bypass MUI theming
  const pageBg    = isDark ? '#0F172A' : '#F8FAFC';
  const paperBg   = isDark ? '#1E293B' : '#ffffff';
  const subtleBg  = isDark ? '#1A2332' : '#F1F5F9';
  const subtleHov = isDark ? '#263045' : '#E2E8F0';
  const textPri   = isDark ? '#F1F5F9' : '#1E293B';
  const textSec   = isDark ? '#94A3B8' : '#64748B';
  const borderClr = isDark ? '#334155' : '#E2E8F0';
  const divClr    = isDark ? '#334155' : '#F1F5F9';

  const toggleCatMode = () => {
    const next = catMode === 'light' ? 'dark' : 'light';
    setCatMode(next);
    localStorage.setItem(`cat_theme_${slug}`, next);
  };
  // ─────────────────────────────────────────────────────────────────────

  const [loading, setLoading] = useState(true);
  const [empresa, setEmpresa] = useState(null);
  const [productos, setProductos] = useState([]);
  const [search, setSearch] = useState('');
  const [categoria, setCategoria] = useState('Todas');
  const [cart, setCart] = useState(() => {
    const saved = localStorage.getItem(`cart_${slug}`);
    return saved ? JSON.parse(saved) : [];
  });
  const [cartOpen, setCartOpen] = useState(false);
  const [orderModalOpen, setOrderModalOpen] = useState(false);

  // Detalle de Producto
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [currentImgIndex, setCurrentImgIndex] = useState(0);

  // Formulario de Pedido
  const [nombre, setNombre] = useState('');
  const [celular, setCelular] = useState('');
  const [tipoEntrega, setTipoEntrega] = useState('domicilio');
  const [direccion, setDireccion] = useState('');
  const [comentarios, setComentarios] = useState('');

  const [sortProductos, setSortProductos] = useState('');
  const [favoritos, setFavoritos]         = useState(() => {
    try { return JSON.parse(localStorage.getItem(`favs_${slug}`) || '[]'); } catch { return []; }
  });
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [orderSent, setOrderSent]         = useState(false);
  const [terminosOpen, setTerminosOpen]   = useState(false);

  useEffect(() => {
    fetchData();
  }, [slug]);

  useEffect(() => {
    localStorage.setItem(`cart_${slug}`, JSON.stringify(cart));
  }, [cart, slug]);

  useEffect(() => {
    localStorage.setItem(`favs_${slug}`, JSON.stringify(favoritos));
  }, [favoritos, slug]);

  useEffect(() => {
    const handleScroll = () => setShowScrollTop(window.scrollY > 350);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get(`/catalogo/${slug}`);
      setEmpresa(res.data.empresa);
      setProductos(res.data.productos);

      // SEO: Título dinámico
      document.title = `${res.data.empresa.nombre} - Catálogo Virtual`;
    } catch (error) {
      toast.error("Catálogo no encontrado o inactivo.");
    } finally {
      setLoading(false);
    }
  };

  const categorias = useMemo(() => {
    const cats = new Set(productos.map(p => p.categoria));
    return ['Todas', ...Array.from(cats)];
  }, [productos]);

  const categoryCounts = React.useMemo(() => {
    const counts = {};
    productos.forEach(p => { counts[p.categoria] = (counts[p.categoria] || 0) + 1; });
    return counts;
  }, [productos]);

  const filteredProductos = React.useMemo(() => {
    let list = productos.filter(p => {
      const matchesSearch = p.nombre.toLowerCase().includes(search.toLowerCase()) ||
                          (p.descripcion && p.descripcion.toLowerCase().includes(search.toLowerCase()));
      const matchesCat = categoria === 'Todas' || p.categoria === categoria;
      return matchesSearch && matchesCat;
    });
    switch (sortProductos) {
      case 'precio_asc':  list = [...list].sort((a, b) => a.precio - b.precio); break;
      case 'precio_desc': list = [...list].sort((a, b) => b.precio - a.precio); break;
      case 'az':          list = [...list].sort((a, b) => a.nombre.localeCompare(b.nombre)); break;
      default: break;
    }
    return list;
  }, [productos, search, categoria, sortProductos]);

  const addToCart = (producto) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === producto.id);
      if (existing) {
        return prev.map(item => item.id === producto.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { ...producto, quantity: 1 }];
    });
  };

  const removeFromCart = (id) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === id);
      if (existing.quantity === 1) {
        return prev.filter(item => item.id !== id);
      }
      return prev.map(item => item.id === id ? { ...item, quantity: item.quantity - 1 } : item);
    });
  };

  const toggleFavorito = (id, e) => {
    e.stopPropagation();
    setFavoritos(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const cartTotal = cart.reduce((sum, item) => sum + (item.precio * item.quantity), 0);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const handleSendOrder = async () => {
    if (!nombre || !celular) {
      toast.warning("Nombre y celular son obligatorios");
      return;
    }
    if (tipoEntrega === 'domicilio' && !direccion) {
      toast.warning("La dirección es obligatoria para domicilios");
      return;
    }

    const formatCurrency = (val) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(val);

    // 1. Register order in backend (fire-and-forget; WhatsApp opens regardless)
    let numeroPedido = null;
    try {
      const payload = {
        nombre_cliente:    nombre,
        celular_cliente:   celular,
        tipo_entrega:      tipoEntrega,
        direccion_entrega: tipoEntrega === 'domicilio' ? direccion : null,
        comentarios:       comentarios || null,
        detalles: cart.map(item => ({
          producto_id:    item.id,
          cantidad:       item.quantity,
          precio_unitario: item.precio,
        })),
      };
      const res = await apiClient.post(`/catalogo/${slug}/pedido`, payload);
      numeroPedido = res.data.id;
    } catch {
      // If backend fails, continue with WhatsApp anyway so the customer is not blocked
    }

    // 2. Build WhatsApp message
    let message = `🛍️ *NUEVO PEDIDO - ${empresa.nombre}*`;
    if (numeroPedido) message += ` #${numeroPedido}`;
    message += `\n\n`;
    message += `👤 *Cliente:* ${nombre}\n`;
    message += `📱 *Celular:* ${celular}\n`;
    message += `📦 *Entrega:* ${tipoEntrega === 'domicilio' ? 'A domicilio 🛵' : 'Recoger en tienda 🏪'}\n`;
    if (tipoEntrega === 'domicilio') {
      message += `📍 *Dirección:* ${direccion}\n`;
    } else if (empresa.direccion) {
      message += `📍 *Punto de recogida:* ${empresa.direccion}\n`;
    }
    if (comentarios) message += `💬 *Comentarios:* ${comentarios}\n`;
    message += `\n*PRODUCTOS:*\n`;
    cart.forEach(item => {
      message += `• ${item.nombre} x${item.quantity} — ${formatCurrency(item.precio)} c/u = ${formatCurrency(item.precio * item.quantity)}\n`;
    });
    message += `\n💰 *TOTAL: ${formatCurrency(cartTotal)}*`;
    if (numeroPedido) message += `\n\n📋 *Pedido #${numeroPedido}* — guardado en el sistema.`;

    window.open(`https://wa.me/${empresa.whatsapp_pedidos}?text=${encodeURIComponent(message)}`, '_blank');
    setOrderSent(true);
    setTimeout(() => {
      setOrderSent(false);
      setCart([]);
      setOrderModalOpen(false);
      setCartOpen(false);
    }, 2500);
  };

  if (loading) return (
    <ThemeProvider theme={catTheme}>
      <Box sx={{ bgcolor: pageBg, minHeight: '100vh' }}>
        <Box sx={{ bgcolor: paperBg, px: 2, pt: 3, pb: 2, boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            <Skeleton variant="rounded" width={50} height={50} sx={{ borderRadius: 2 }} />
            <Box sx={{ flex: 1 }}>
              <Skeleton width="50%" height={22} />
              <Skeleton width="30%" height={14} sx={{ mt: 0.5 }} />
            </Box>
          </Box>
          <Skeleton variant="rounded" height={40} sx={{ mb: 2, borderRadius: 3 }} />
          <Box sx={{ display: 'flex', gap: 1 }}>
            {[1,2,3,4].map(i => <Skeleton key={i} variant="rounded" width={90} height={32} sx={{ borderRadius: 4 }} />)}
          </Box>
        </Box>
        <Box sx={{ p: 2 }}>
          <Grid container spacing={2}>
            {[...Array(8)].map((_, i) => (
              <Grid item xs={6} sm={4} md={3} key={i}>
                <Skeleton variant="rounded" sx={{ aspectRatio: '1/1', borderRadius: 3 }} />
                <Skeleton sx={{ mt: 1 }} width="75%" height={18} />
                <Skeleton width="45%" height={22} sx={{ mt: 0.5 }} />
                <Skeleton variant="rounded" height={34} sx={{ mt: 1, borderRadius: 2 }} />
              </Grid>
            ))}
          </Grid>
        </Box>
      </Box>
    </ThemeProvider>
  );
  if (!empresa) return <Box sx={{ p: 5, textAlign: 'center' }}><Typography variant="h5">Catálogo no disponible</Typography></Box>;

  const accentColor = empresa.color_primario || '#FF6020';

  return (
    <ThemeProvider theme={catTheme}>
      <Box sx={{ bgcolor: pageBg, minHeight: '100vh', pb: 10 }}>
        {/* HEADER */}
        <Box sx={{ bgcolor: paperBg, px: 2, pt: 3, pb: 2, boxShadow: '0 2px 10px rgba(0,0,0,0.05)', position: 'sticky', top: 0, zIndex: 100 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            {empresa.logo_base64 ? (
              <Avatar src={empresa.logo_base64} variant="rounded" sx={{ width: 50, height: 50 }} />
            ) : (
              <Avatar sx={{ bgcolor: accentColor, width: 50, height: 50 }} variant="rounded"><Storefront /></Avatar>
            )}
            <Box sx={{ flexGrow: 1, minWidth: 0, overflow: 'hidden' }}>
              <Typography sx={{
                fontWeight: 800, fontSize: { xs: 15, sm: 18 }, color: textPri,
                lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {empresa.nombre}
              </Typography>
              <Typography sx={{ fontSize: 11, color: textSec, mt: 0.2 }}>
                Catálogo Virtual
              </Typography>
            </Box>

            {/* Dark / light toggle + Powered by — alineados juntos */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
              <Tooltip title={isDark ? 'Modo claro' : 'Modo oscuro'}>
                <IconButton
                  onClick={toggleCatMode}
                  size="small"
                  sx={{
                    color: textSec,
                    bgcolor: subtleBg,
                    '&:hover': { bgcolor: subtleHov },
                    width: 30, height: 30,
                  }}
                >
                  {isDark ? <LightMode sx={{ fontSize: 15 }} /> : <DarkMode sx={{ fontSize: 15 }} />}
                </IconButton>
              </Tooltip>

              <Typography
                component="a"
                href="/login"
                sx={{
                  fontSize: 9, color: '#94A3B8', textDecoration: 'none', whiteSpace: 'nowrap',
                  fontWeight: 700, letterSpacing: 0.2,
                  '&:hover': { color: '#FF6020' }, transition: 'color 0.2s',
                  display: { xs: 'none', sm: 'block' },
                }}
              >
                Powered by Ksmart360
              </Typography>
            </Box>
          </Box>

          <TextField
            fullWidth
            size="small"
            placeholder={`¿Qué buscas en ${empresa?.nombre || 'la tienda'}?`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{ mb: 2, '& .MuiOutlinedInput-root': { borderRadius: 3, bgcolor: subtleBg } }}
            InputProps={{
              startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment>
            }}
          />

          {/* FILTRO CATEGORÍAS */}
          <Box sx={{ display: 'flex', gap: 1, overflowX: 'auto', pb: 1, '&::-webkit-scrollbar': { display: 'none' } }}>
            {categorias.map(cat => (
              <Chip
                key={cat}
                label={cat === 'Todas' ? `Todas (${productos.length})` : `${cat} (${categoryCounts[cat] || 0})`}
                onClick={() => setCategoria(cat)}
                sx={{
                  bgcolor: categoria === cat ? accentColor : paperBg,
                  color: categoria === cat ? '#fff' : textSec,
                  fontWeight: 600,
                  border: '1px solid',
                  borderColor: categoria === cat ? accentColor : borderClr,
                  '&:hover': { bgcolor: categoria === cat ? accentColor : subtleBg }
                }}
              />
            ))}
          </Box>
        </Box>

        {/* Products count + sort */}
        <Box sx={{ px: 2, pt: 2, pb: 0.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
          <Typography sx={{ fontWeight: 600, color: textSec, fontSize: 13 }}>
            {filteredProductos.length} {filteredProductos.length === 1 ? 'producto' : 'productos'}
            {search ? ` para "${search}"` : ''}
            {categoria !== 'Todas' ? ` en ${categoria}` : ''}
          </Typography>
          <Select
            size="small"
            value={sortProductos}
            onChange={(e) => setSortProductos(e.target.value)}
            displayEmpty
            sx={{
              fontSize: 12, minWidth: 150, bgcolor: paperBg,
              borderRadius: 2,
              '& .MuiOutlinedInput-notchedOutline': { borderColor: borderClr },
            }}
          >
            <MenuItem value="" sx={{ fontSize: 12 }}>Relevancia</MenuItem>
            <MenuItem value="az" sx={{ fontSize: 12 }}>A → Z</MenuItem>
            <MenuItem value="precio_asc" sx={{ fontSize: 12 }}>Menor precio</MenuItem>
            <MenuItem value="precio_desc" sx={{ fontSize: 12 }}>Mayor precio</MenuItem>
          </Select>
        </Box>

        {/* PRODUCTOS */}
        <Box sx={{ px: 1, pb: 2, pt: 1 }}>
          <Box sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'repeat(3, 1fr)', sm: 'repeat(4, 1fr)', md: 'repeat(5, 1fr)', lg: 'repeat(6, 1fr)' },
            gap: '6px',
          }}>
            {filteredProductos.map(p => {
              const inCart = cart.find(item => item.id === p.id);
              return (
                <Card
                  key={p.id}
                  sx={{
                    borderRadius: 2, display: 'flex', flexDirection: 'column',
                    overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
                    border: '1px solid', borderColor: divClr,
                    cursor: 'pointer',
                  }}
                  onClick={() => { setSelectedProduct(p); setCurrentImgIndex(0); }}
                >
                  <Box sx={{ position: 'relative' }}>
                    <CardMedia
                      component="img"
                      sx={{ aspectRatio: '1/1', objectFit: 'cover' }}
                      image={p.image_count > 0 ? `${apiClient.defaults.baseURL}/catalogo/${slug}/productos/${p.id}/imagen?index=0` : 'https://placehold.co/400x400?text=Sin+imagen'}
                      alt={p.nombre}
                    />
                    <IconButton
                      size="small"
                      onClick={(e) => toggleFavorito(p.id, e)}
                      sx={{
                        position: 'absolute', top: 3, right: 3,
                        bgcolor: 'rgba(255,255,255,0.88)', width: 22, height: 22,
                        '&:hover': { bgcolor: '#fff' },
                      }}
                    >
                      {favoritos.includes(p.id)
                        ? <Favorite sx={{ fontSize: 11, color: '#EF4444' }} />
                        : <FavoriteBorder sx={{ fontSize: 11, color: '#94A3B8' }} />}
                    </IconButton>
                    {p.stock === 0 && (
                      <Box sx={{ position: 'absolute', bottom: 0, left: 0, right: 0, bgcolor: 'rgba(0,0,0,0.55)', py: 0.3, textAlign: 'center' }}>
                        <Typography sx={{ fontSize: 9, fontWeight: 700, color: '#fff' }}>Agotado</Typography>
                      </Box>
                    )}
                  </Box>
                  <CardContent sx={{ p: '6px 7px 7px !important', flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                    <Typography sx={{ fontWeight: 600, fontSize: 11, color: textPri, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: 1.3, mb: 0.5, minHeight: 28 }}>
                      {p.nombre}
                    </Typography>
                    <Typography sx={{ fontWeight: 800, fontSize: 12, color: accentColor, mb: 0.75 }}>
                      ${new Intl.NumberFormat('es-CO').format(p.precio)}
                    </Typography>
                    <Box onClick={(e) => e.stopPropagation()}>
                      {inCart ? (
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', bgcolor: subtleBg, borderRadius: 1.5, px: 0.5, py: 0.25 }}>
                          <IconButton size="small" onClick={() => removeFromCart(p.id)} sx={{ p: '2px', color: accentColor }}><Remove sx={{ fontSize: 14 }} /></IconButton>
                          <Typography sx={{ fontWeight: 700, fontSize: 12 }}>{inCart.quantity}</Typography>
                          <IconButton size="small" onClick={() => addToCart(p)} sx={{ p: '2px', color: accentColor }}><Add sx={{ fontSize: 14 }} /></IconButton>
                        </Box>
                      ) : (
                        <Box
                          onClick={() => addToCart(p)}
                          sx={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            bgcolor: accentColor, borderRadius: 1.5, py: '4px',
                            cursor: 'pointer', gap: 0.4,
                            '&:hover': { opacity: 0.88 },
                          }}
                        >
                          <Add sx={{ fontSize: 13, color: '#fff' }} />
                          <Typography sx={{ fontSize: 10, fontWeight: 700, color: '#fff' }}>Agregar</Typography>
                        </Box>
                      )}
                    </Box>
                  </CardContent>
                </Card>
              );
            })}
          </Box>

          {filteredProductos.length === 0 && (
            <Box sx={{ textAlign: 'center', py: 8, px: 2 }}>
              <Typography sx={{ fontSize: 56, mb: 2, lineHeight: 1 }}>🔍</Typography>
              <Typography sx={{ fontWeight: 800, fontSize: 18, color: textPri, mb: 1 }}>
                {search
                  ? `Sin resultados para "${search}"`
                  : `Sin productos en ${categoria !== 'Todas' ? categoria : 'el catálogo'}`}
              </Typography>
              <Typography sx={{ color: textSec, mb: 3, fontSize: 14 }}>
                Intenta con otro término o explora otra categoría
              </Typography>
              {(search || categoria !== 'Todas') && (
                <Button
                  variant="outlined"
                  onClick={() => { setSearch(''); setCategoria('Todas'); setSortProductos(''); }}
                  sx={{ borderRadius: 3, fontWeight: 700 }}
                >
                  Ver todos los productos
                </Button>
              )}
            </Box>
          )}
        </Box>

        {/* DETALLE DE PRODUCTO */}
        <Dialog
          open={Boolean(selectedProduct)}
          onClose={() => setSelectedProduct(null)}
          fullWidth
          maxWidth="sm"
          PaperProps={{ sx: { borderRadius: isMobile ? '24px 24px 0 0' : 4, mt: isMobile ? 'auto' : 0, mb: isMobile ? 0 : 'auto' } }}
          TransitionComponent={Zoom}
        >
          {selectedProduct && (
            <>
              <Box sx={{ position: 'relative' }}>
                <IconButton
                  onClick={() => setSelectedProduct(null)}
                  sx={{ position: 'absolute', top: 12, right: 12, zIndex: 10, bgcolor: 'rgba(0,0,0,0.4)', color: '#fff', '&:hover': { bgcolor: 'rgba(0,0,0,0.6)' } }}
                >
                  <Close fontSize="small" />
                </IconButton>

                {/* Galería Principal */}
                <Box sx={{ width: '100%', aspectRatio: '1/1', bgcolor: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                  <img
                    src={selectedProduct.image_count > 0 ? `${apiClient.defaults.baseURL}/catalogo/${slug}/productos/${selectedProduct.id}/imagen?index=${currentImgIndex}` : 'https://placehold.co/400x400?text=No+Image'}
                    alt={selectedProduct.nombre}
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                  />

                  {selectedProduct.image_count > 1 && (
                    <>
                      <IconButton
                        onClick={() => setCurrentImgIndex(prev => (prev > 0 ? prev - 1 : selectedProduct.image_count - 1))}
                        sx={{ position: 'absolute', left: 8, bgcolor: 'rgba(255,255,255,0.3)', color: '#fff' }}
                      >
                        <ArrowForward sx={{ transform: 'rotate(180deg)' }} />
                      </IconButton>
                      <IconButton
                        onClick={() => setCurrentImgIndex(prev => (prev < selectedProduct.image_count - 1 ? prev + 1 : 0))}
                        sx={{ position: 'absolute', right: 8, bgcolor: 'rgba(255,255,255,0.3)', color: '#fff' }}
                      >
                        <ArrowForward />
                      </IconButton>

                      <Box sx={{ position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 1 }}>
                        {[...Array(selectedProduct.image_count)].map((_, i) => (
                          <Box key={i} sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: i === currentImgIndex ? accentColor : 'rgba(255,255,255,0.5)', transition: 'all 0.2s' }} />
                        ))}
                      </Box>
                    </>
                  )}
                </Box>
              </Box>

              <DialogContent sx={{ p: 3 }}>
                <Chip label={selectedProduct.categoria} size="small" sx={{ mb: 1, fontWeight: 700, bgcolor: `${accentColor}15`, color: accentColor }} />
                <Typography variant="h5" sx={{ fontWeight: 800, mb: 1 }}>{selectedProduct.nombre}</Typography>
                <Typography variant="h4" sx={{ fontWeight: 800, color: accentColor, mb: 3 }}>
                  ${new Intl.NumberFormat('es-CO').format(selectedProduct.precio)}
                </Typography>

                {selectedProduct.descripcion && (
                  <Box sx={{ mb: 3 }}>
                    <Typography sx={{ fontWeight: 700, fontSize: 14, mb: 0.5, color: 'text.secondary' }}>Descripción</Typography>
                    <Typography sx={{ color: 'text.primary', whiteSpace: 'pre-line' }}>{selectedProduct.descripcion}</Typography>
                  </Box>
                )}
              </DialogContent>

              <DialogActions sx={{ p: 3, pt: 0 }}>
                <Button
                  fullWidth
                  variant="contained"
                  size="large"
                  startIcon={<ShoppingCart />}
                  onClick={() => { addToCart(selectedProduct); setSelectedProduct(null); }}
                  sx={{ bgcolor: accentColor, borderRadius: 3, py: 1.5, fontWeight: 800, '&:hover': { bgcolor: accentColor, opacity: 0.9 } }}
                >
                  Agregar al Carrito
                </Button>
              </DialogActions>
            </>
          )}
        </Dialog>

        {/* ── BANNER PROMOCIONAL — compacto ──────────────────────────────── */}
        <Box sx={{ px: 2, py: 1.5 }}>
          <Box sx={{
            display: 'flex', alignItems: 'center', gap: 1.5,
            p: '10px 14px', borderRadius: 2.5,
            background: isDark
              ? 'rgba(255,255,255,0.04)'
              : 'linear-gradient(120deg, #1E293B 0%, #0F172A 100%)',
            border: isDark ? '1px solid rgba(255,255,255,0.06)' : 'none',
          }}>
            <Box sx={{
              width: 30, height: 30, borderRadius: 1.5, flexShrink: 0,
              bgcolor: '#FF6020', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <RocketLaunch sx={{ color: '#fff', fontSize: 15 }} />
            </Box>
            <Typography sx={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: 700, color: '#fff', lineHeight: 1.4 }}>
              ¿Tienes un negocio?{' '}
              <Box component="span" sx={{ fontWeight: 400, color: '#94A3B8' }}>
                Crea tu catálogo y gestiona ventas con Ksmart360.
              </Box>
            </Typography>
            <Button
              component="a"
              href="/login"
              variant="contained"
              size="small"
              endIcon={<ArrowForward sx={{ fontSize: 11 }} />}
              sx={{
                bgcolor: '#FF6020', borderRadius: 2, fontWeight: 700,
                fontSize: 11, textTransform: 'none', px: 1.5, py: 0.5,
                minWidth: 'auto', flexShrink: 0, boxShadow: 'none',
                '&:hover': { bgcolor: '#e65520', boxShadow: '0 4px 12px rgba(255,96,32,0.3)' },
              }}
            >
              Gratis
            </Button>
          </Box>
        </Box>

        {/* CARRITO FLOTANTE */}
        {cartCount > 0 && (
          <Zoom in={cartCount > 0}>
            <Fab
              variant="extended"
              onClick={() => setCartOpen(true)}
              sx={{
                position: 'fixed',
                bottom: 24,
                left: '50%',
                transform: 'translateX(-50%) !important',
                bgcolor: accentColor,
                color: '#fff',
                px: 3,
                boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
                '&:hover': { bgcolor: accentColor, opacity: 0.9 }
              }}
            >
              <Badge badgeContent={cartCount} color="error" sx={{ mr: 1.5 }}>
                <ShoppingBag />
              </Badge>
              Ver Pedido • ${new Intl.NumberFormat('es-CO').format(cartTotal)}
            </Fab>
          </Zoom>
        )}

        {/* SCROLL TO TOP */}
        {showScrollTop && (
          <Zoom in={showScrollTop}>
            <Fab
              size="small"
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              sx={{
                position: 'fixed',
                bottom: cartCount > 0 ? 90 : 24,
                right: 16,
                bgcolor: paperBg,
                color: textSec,
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                '&:hover': { bgcolor: subtleBg, transform: 'translateY(-2px)' },
                transition: 'all 0.2s',
                zIndex: 50,
              }}
            >
              <KeyboardArrowUp />
            </Fab>
          </Zoom>
        )}

        {/* DRAWER / BOTTOM SHEET DEL CARRITO */}
        <Drawer
          anchor={isMobile ? 'bottom' : 'right'}
          open={cartOpen}
          onClose={() => setCartOpen(false)}
          PaperProps={{
            sx: {
              width: isMobile ? '100%' : 400,
              maxHeight: isMobile ? '90vh' : '100vh',
              borderRadius: isMobile ? '24px 24px 0 0' : 0,
              overflow: 'hidden'
            }
          }}
        >
          <Box sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 800 }}>Mi Pedido</Typography>
              <IconButton onClick={() => setCartOpen(false)}><Close /></IconButton>
            </Box>

            <List sx={{ flexGrow: 1, overflowY: 'auto' }}>
              {cart.map(item => (
                <ListItem key={item.id} sx={{ px: 0, py: 2 }}>
                  <ListItemAvatar>
                    <Avatar
                      variant="rounded"
                      src={item.image_count > 0 ? `${apiClient.defaults.baseURL}/catalogo/${slug}/productos/${item.id}/imagen?index=0` : null}
                      sx={{ bgcolor: subtleBg, color: '#94A3B8' }}
                    >
                      <ShoppingBag />
                    </Avatar>
                  </ListItemAvatar>

                  <ListItemText
                    primary={<Typography sx={{ fontWeight: 700, fontSize: 14 }}>{item.nombre}</Typography>}
                    secondary={
                      <Box>
                        <Typography sx={{ color: accentColor, fontWeight: 700, fontSize: 13 }}>
                          ${new Intl.NumberFormat('es-CO').format(item.precio)} c/u
                        </Typography>
                        <Typography sx={{ fontSize: 12, color: 'text.secondary', fontWeight: 600 }}>
                          Subtotal: ${new Intl.NumberFormat('es-CO').format(item.precio * item.quantity)}
                        </Typography>
                      </Box>
                    }
                  />
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, bgcolor: subtleBg, borderRadius: 2, p: 0.5 }}>
                    <IconButton size="small" onClick={() => removeFromCart(item.id)} sx={{ bgcolor: paperBg, color: accentColor }}><Remove fontSize="small" /></IconButton>
                    <Typography sx={{ fontWeight: 700, fontSize: 13 }}>{item.quantity}</Typography>
                    <IconButton size="small" onClick={() => addToCart(item)} sx={{ bgcolor: paperBg, color: accentColor }}><Add fontSize="small" /></IconButton>
                  </Box>
                </ListItem>
              ))}
            </List>

            <Divider sx={{ my: 2 }} />

            <Box sx={{ mb: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography color="text.secondary">Subtotal:</Typography>
                <Typography sx={{ fontWeight: 700 }}>${new Intl.NumberFormat('es-CO').format(cartTotal)}</Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography sx={{ fontWeight: 800, fontSize: 18 }}>Total:</Typography>
                <Typography sx={{ fontWeight: 800, fontSize: 18, color: accentColor }}>${new Intl.NumberFormat('es-CO').format(cartTotal)}</Typography>
              </Box>
            </Box>

            <Button
              variant="contained"
              fullWidth
              size="large"
              endIcon={<ArrowForward />}
              onClick={() => setOrderModalOpen(true)}
              sx={{ bgcolor: accentColor, borderRadius: 3, py: 1.5, fontWeight: 700, '&:hover': { bgcolor: accentColor, opacity: 0.9 } }}
            >
              Siguiente
            </Button>
          </Box>
        </Drawer>

        {/* DIALOG DE DATOS DEL CLIENTE */}
        <Dialog
          open={orderModalOpen}
          onClose={() => setOrderModalOpen(false)}
          fullScreen={isMobile}
          PaperProps={{ sx: { borderRadius: isMobile ? 0 : 4 } }}
        >
          <DialogTitle sx={{ fontWeight: 800, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            Finalizar Pedido
            {isMobile && <IconButton onClick={() => setOrderModalOpen(false)}><Close /></IconButton>}
          </DialogTitle>
          <DialogContent dividers sx={{ position: 'relative' }}>
            {orderSent && (
              <Box sx={{
                position: 'absolute', inset: 0, zIndex: 20,
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                bgcolor: paperBg, gap: 2, px: 2,
                borderRadius: 'inherit',
              }}>
                <Typography sx={{ fontSize: 64, lineHeight: 1 }}>🎉</Typography>
                <Typography sx={{ fontWeight: 900, fontSize: 22, color: textPri, textAlign: 'center' }}>
                  ¡Pedido enviado!
                </Typography>
                <Typography sx={{ color: textSec, textAlign: 'center', maxWidth: 280, fontSize: 14 }}>
                  Se abrió WhatsApp con tu pedido listo para enviar. El vendedor te contactará pronto.
                </Typography>
              </Box>
            )}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, py: 1 }}>
              <Box>
                <Typography sx={{ fontWeight: 700, fontSize: 14, mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Person fontSize="small" color="action" /> Tu Nombre *
                </Typography>
                <TextField
                  fullWidth
                  placeholder="¿Cómo te llamas?"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  required
                />
              </Box>

              <Box>
                <Typography sx={{ fontWeight: 700, fontSize: 14, mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Phone fontSize="small" color="action" /> Número de Celular *
                </Typography>
                <TextField
                  fullWidth
                  placeholder="Ej: 300 123 4567"
                  value={celular}
                  onChange={(e) => setCelular(e.target.value.replace(/\D/g, ''))}
                  required
                />
              </Box>

              <Box>
                <Typography sx={{ fontWeight: 700, fontSize: 14, mb: 1.5 }}>
                  Tipo de Entrega
                </Typography>
                <RadioGroup value={tipoEntrega} onChange={(e) => setTipoEntrega(e.target.value)}>
                  <Grid container spacing={2}>
                    <Grid item xs={6}>
                      <Paper
                        variant="outlined"
                        onClick={() => setTipoEntrega('domicilio')}
                        sx={{
                          p: 2, textAlign: 'center', borderRadius: 3, cursor: 'pointer',
                          borderColor: tipoEntrega === 'domicilio' ? accentColor : 'divider',
                          bgcolor: tipoEntrega === 'domicilio' ? `${accentColor}05` : 'transparent'
                        }}
                      >
                        <Typography sx={{ fontSize: 24, mb: 0.5 }}>🛵</Typography>
                        <Typography sx={{ fontWeight: 700, fontSize: 12 }}>A domicilio</Typography>
                        <Radio value="domicilio" sx={{ display: 'none' }} />
                      </Paper>
                    </Grid>
                    <Grid item xs={6}>
                      <Paper
                        variant="outlined"
                        onClick={() => setTipoEntrega('recoger')}
                        sx={{
                          p: 2, textAlign: 'center', borderRadius: 3, cursor: 'pointer',
                          borderColor: tipoEntrega === 'recoger' ? accentColor : 'divider',
                          bgcolor: tipoEntrega === 'recoger' ? `${accentColor}05` : 'transparent'
                        }}
                      >
                        <Typography sx={{ fontSize: 24, mb: 0.5 }}>🏪</Typography>
                        <Typography sx={{ fontWeight: 700, fontSize: 12 }}>Recoger en tienda</Typography>
                        <Radio value="recoger" sx={{ display: 'none' }} />
                      </Paper>
                    </Grid>
                  </Grid>
                </RadioGroup>
              </Box>

              {tipoEntrega === 'domicilio' ? (
                <Box>
                  <Typography sx={{ fontWeight: 700, fontSize: 14, mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <LocationOn fontSize="small" color="action" /> Dirección de Entrega *
                  </Typography>
                  <TextField
                    fullWidth
                    placeholder="Calle, Barrio, Apartamento..."
                    value={direccion}
                    onChange={(e) => setDireccion(e.target.value)}
                    required
                  />
                </Box>
              ) : empresa.direccion && (
                <Alert severity="info" sx={{ borderRadius: 3 }}>
                  Dirección de recogida: <strong>{empresa.direccion}</strong>
                </Alert>
              )}

              <Box>
                <Typography sx={{ fontWeight: 700, fontSize: 14, mb: 1 }}>
                  Comentarios adicionales
                </Typography>
                <TextField
                  fullWidth
                  multiline
                  rows={2}
                  placeholder="¿Algo más que debamos saber?"
                  value={comentarios}
                  onChange={(e) => setComentarios(e.target.value)}
                />
              </Box>
            </Box>
          </DialogContent>
          <DialogActions sx={{ p: 3, flexDirection: 'column', gap: 1 }}>
            <Button
              fullWidth
              variant="contained"
              size="large"
              startIcon={<WhatsApp />}
              onClick={handleSendOrder}
              sx={{ bgcolor: '#25D366', borderRadius: 3, py: 1.5, fontWeight: 800, '&:hover': { bgcolor: '#128C7E' } }}
            >
              Enviar por WhatsApp
            </Button>
            <Typography sx={{ fontSize: 11, color: '#94A3B8', textAlign: 'center', lineHeight: 1.5 }}>
              Al enviar tu pedido aceptas los{' '}
              <Box component="span"
                onClick={() => { setOrderModalOpen(false); setTerminosOpen(true); }}
                sx={{ color: accentColor, cursor: 'pointer', fontWeight: 700, textDecoration: 'underline' }}>
                Términos y Condiciones
              </Box>
              {' '}de {empresa?.nombre}.
            </Typography>
          </DialogActions>
        </Dialog>

        {/* ── FOOTER ─────────────────────────────────────────────────────── */}
        <Box sx={{ mt: 4, borderTop: '1px solid', borderColor: divClr, px: 2, py: 3, textAlign: 'center', bgcolor: isDark ? '#0F172A' : '#FAFAFA' }}>
          <Typography sx={{ fontSize: 12, color: textSec, mb: 0.5 }}>
            {empresa?.nombre} · Catálogo virtual operado con KSmart360
          </Typography>
          <Typography sx={{ fontSize: 11, color: '#CBD5E1' }}>
            Los productos, precios e información publicados son responsabilidad exclusiva de{' '}
            <strong style={{ color: isDark ? '#94A3B8' : '#94A3B8' }}>{empresa?.nombre}</strong>.
          </Typography>
          <Button
            size="small"
            onClick={() => setTerminosOpen(true)}
            sx={{ mt: 1.5, fontSize: 11, color: textSec, textDecoration: 'underline', textTransform: 'none', fontWeight: 600, '&:hover': { color: accentColor } }}
          >
            Términos y Condiciones · Política de Devoluciones
          </Button>
        </Box>

        {/* ── MODAL TÉRMINOS Y CONDICIONES ───────────────────────────────── */}
        <Dialog open={terminosOpen} onClose={() => setTerminosOpen(false)} maxWidth="md" fullWidth scroll="paper"
          PaperProps={{ sx: { borderRadius: 3, m: { xs: 1, sm: 3 } } }}>
          <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1, borderBottom: '1px solid', borderColor: divClr }}>
            <Box>
              <Typography sx={{ fontWeight: 800, fontSize: 17 }}>Términos y Condiciones</Typography>
              <Typography sx={{ fontSize: 12, color: '#94A3B8' }}>
                {empresa?.nombre} · Última actualización: {new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'long' })}
              </Typography>
            </Box>
            <IconButton onClick={() => setTerminosOpen(false)} size="small"><Close /></IconButton>
          </DialogTitle>

          <DialogContent sx={{ px: { xs: 2, sm: 3 }, py: 2 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 13, lineHeight: 1.7 }}>

              {/* Aviso general */}
              <Alert severity="info" sx={{ borderRadius: 2, fontSize: 12 }}>
                Los productos, precios y disponibilidad publicados en este catálogo virtual son de responsabilidad
                exclusiva de <strong>{empresa?.nombre}</strong>. KSmart360 actúa únicamente como plataforma
                tecnológica de soporte y no tiene vinculación comercial con las transacciones realizadas.
              </Alert>

              {[
                {
                  titulo: '1. Identificación del Vendedor',
                  texto: `Este catálogo virtual es administrado y operado por ${empresa?.nombre || 'el establecimiento comercial'}, en adelante "el Vendedor". Toda compra, pedido o transacción realizada a través de este medio establece una relación comercial directa y exclusiva entre el comprador y el Vendedor. El Vendedor es el único responsable de la veracidad de la información publicada, la calidad de los productos ofertados, el cumplimiento de los pedidos, el proceso de entrega y la atención posventa.`,
                },
                {
                  titulo: '2. Marco Legal Aplicable',
                  texto: `Este catálogo virtual se rige por la legislación colombiana vigente, en particular:\n\n• Ley 1480 de 2011 — Estatuto del Consumidor: establece los derechos de los consumidores, incluyendo el derecho de retracto, garantías mínimas y condiciones de calidad.\n• Ley 527 de 1999 — Comercio Electrónico: regula el acceso y uso de mensajes de datos, firmas digitales y comercio por medios electrónicos.\n• Decreto 1499 de 2014: reglamenta las ventas a distancia y el comercio electrónico en Colombia.\n• Ley 1581 de 2012 — Habeas Data: regula el tratamiento de datos personales de los consumidores.\n• Decreto 1377 de 2013: desarrolla la Ley de Protección de Datos Personales.\n• Resolución 3768 de 2008 de la SIC: condiciones para la venta a distancia y protección al consumidor en canales digitales.`,
                },
                {
                  titulo: '3. Precios y Disponibilidad',
                  texto: `Los precios publicados están expresados en pesos colombianos (COP) e incluyen el IVA aplicable según la naturaleza del producto. El Vendedor se reserva el derecho de modificar precios y disponibilidad sin previo aviso. El precio vigente al momento de confirmar el pedido es el que aplica para la transacción. La disponibilidad de los productos está sujeta al inventario del Vendedor y puede variar sin previo aviso. En caso de que un producto no esté disponible tras la confirmación del pedido, el Vendedor se compromete a informar al comprador dentro de las 24 horas siguientes.`,
                },
                {
                  titulo: '4. Proceso de Compra y Pedidos',
                  texto: `Los pedidos realizados a través de este catálogo virtual se formalizan mediante el envío del resumen del carrito por WhatsApp al Vendedor. El pedido se considera confirmado únicamente cuando el Vendedor lo acepta de forma expresa. El Vendedor puede rechazar o modificar un pedido por razones de inventario, error en precios o condiciones de entrega. El comprador debe suministrar información veraz y completa para garantizar la entrega correcta del pedido. La confirmación del pedido no implica el cobro hasta que el Vendedor lo valide.`,
                },
                {
                  titulo: '5. Formas de Pago',
                  texto: `Las formas de pago aceptadas son definidas por el Vendedor y pueden incluir: efectivo contra entrega, transferencia bancaria, pago electrónico u otras modalidades que el Vendedor indique al momento de confirmar el pedido. El Vendedor es responsable de garantizar la seguridad en el proceso de pago y de emitir el comprobante correspondiente de acuerdo con la normatividad tributaria colombiana.`,
                },
                {
                  titulo: '6. Entregas y Domicilios',
                  texto: `Las condiciones de entrega (tiempo, costo de domicilio, cobertura de zonas) son determinadas exclusivamente por el Vendedor. Los tiempos de entrega son estimados y pueden variar por condiciones externas. El Vendedor asume la responsabilidad de entregar los productos en las condiciones pactadas. En caso de demora significativa, el Vendedor debe informar al comprador con la debida antelación. El riesgo de pérdida o daño del producto se traslada al comprador en el momento de la entrega física.`,
                },
                {
                  titulo: '7. Derecho de Retracto (Devoluciones)',
                  texto: `De conformidad con el artículo 47 de la Ley 1480 de 2011 (Estatuto del Consumidor), el comprador tiene derecho de retracto cuando la compra se realiza a través de canales no presenciales (catálogo virtual, internet, teléfono). El plazo para ejercer este derecho es de cinco (5) días hábiles contados a partir de la entrega del producto. Para ejercer el derecho de retracto, el comprador debe:\n\n• Notificar al Vendedor por escrito dentro del plazo establecido.\n• Devolver el producto en las mismas condiciones en que fue recibido, sin uso, con empaque original y todos sus accesorios.\n• El Vendedor reembolsará el valor pagado dentro de los treinta (30) días calendario siguientes a la recepción del producto devuelto.\n\nExcepciones al derecho de retracto:\n• Productos personalizados o elaborados conforme a especificaciones del comprador.\n• Productos perecederos o de corta duración.\n• Productos de higiene personal que hayan sido abiertos o usados.\n• Servicios que ya hayan sido prestados completamente.`,
                },
                {
                  titulo: '8. Garantías',
                  texto: `Todos los productos ofrecidos cuentan con las garantías mínimas establecidas en el Estatuto del Consumidor colombiano. Para bienes con elementos o componentes que no son de consumo inmediato, la garantía mínima es de un (1) año a partir de la entrega, salvo que el Vendedor ofrezca una garantía mayor. El Vendedor es el primer responsable de hacer efectiva la garantía ante el comprador. En caso de defecto o falla dentro del período de garantía, el comprador puede solicitar: la reparación del bien, la sustitución por un bien de iguales características, o la devolución del precio pagado. El tiempo de resolución de garantías no puede superar los treinta (30) días hábiles.`,
                },
                {
                  titulo: '9. Responsabilidad del Vendedor',
                  texto: `${empresa?.nombre || 'El Vendedor'} es el único responsable de:\n\n• La exactitud y veracidad de la información de los productos publicados (descripción, imágenes, precio, características).\n• La calidad y estado de los productos al momento de la entrega.\n• El cumplimiento de los pedidos confirmados.\n• La atención de reclamaciones, garantías y devoluciones.\n• El manejo seguro de los datos personales del comprador.\n\nKSmart360, como plataforma tecnológica, no asume responsabilidad alguna por los productos comercializados, los precios publicados, las transacciones realizadas, ni por incumplimientos del Vendedor frente a los compradores.`,
                },
                {
                  titulo: '10. Protección de Datos Personales',
                  texto: `De conformidad con la Ley 1581 de 2012 y el Decreto 1377 de 2013, el Vendedor es el responsable del tratamiento de los datos personales recopilados a través de este catálogo (nombre, teléfono, dirección). Dichos datos serán utilizados exclusivamente para la gestión del pedido, la entrega y la atención posventa. El comprador tiene derecho a conocer, actualizar, rectificar y suprimir sus datos personales. Para ejercer estos derechos, el comprador debe contactar directamente al Vendedor. Los datos no serán compartidos con terceros sin autorización expresa del titular, salvo en los casos previstos por la ley.`,
                },
                {
                  titulo: '11. Propiedad Intelectual',
                  texto: `Las imágenes, textos, marcas y demás contenidos publicados en este catálogo son responsabilidad del Vendedor, quien declara contar con los derechos necesarios para su uso. El comprador no está autorizado para reproducir, modificar o distribuir el contenido del catálogo sin autorización expresa del Vendedor.`,
                },
                {
                  titulo: '12. Resolución de Conflictos',
                  texto: `En caso de controversias derivadas de las transacciones realizadas a través de este catálogo, el comprador podrá acudir a:\n\n• El Vendedor directamente para una solución directa.\n• La Superintendencia de Industria y Comercio (SIC) — www.sic.gov.co — para presentar reclamaciones como consumidor.\n• Los centros de conciliación autorizados en Colombia.\n• La jurisdicción ordinaria colombiana si las vías anteriores resultan insuficientes.\n\nLos presentes términos y condiciones se rigen por las leyes de la República de Colombia.`,
                },
              ].map(({ titulo, texto }) => (
                <Box key={titulo}>
                  <Typography sx={{ fontWeight: 800, fontSize: 14, color: 'text.primary', mb: 0.75, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box component="span" sx={{ width: 3, height: 16, bgcolor: accentColor, borderRadius: 2, display: 'inline-block', flexShrink: 0 }} />
                    {titulo}
                  </Typography>
                  <Typography sx={{ fontSize: 13, color: 'text.secondary', lineHeight: 1.75, whiteSpace: 'pre-line', pl: 1.5 }}>
                    {texto}
                  </Typography>
                </Box>
              ))}

              <Box sx={{ mt: 1, p: 2, bgcolor: subtleBg, borderRadius: 2, border: '1px solid', borderColor: borderClr }}>
                <Typography sx={{ fontSize: 12, color: textSec, textAlign: 'center', lineHeight: 1.6 }}>
                  Al realizar un pedido en este catálogo, el comprador declara haber leído, entendido y aceptado
                  los presentes términos y condiciones.<br />
                  <strong style={{ color: isDark ? '#cbd5e1' : '#374151' }}>{empresa?.nombre}</strong> · Catálogo operado con KSmart360 ·{' '}
                  {new Date().getFullYear()}
                </Typography>
              </Box>

            </Box>
          </DialogContent>
          <DialogActions sx={{ px: 3, py: 2, borderTop: '1px solid', borderColor: divClr }}>
            <Button onClick={() => setTerminosOpen(false)} variant="contained"
              sx={{ bgcolor: accentColor, borderRadius: 2, fontWeight: 700, textTransform: 'none', '&:hover': { bgcolor: accentColor, opacity: 0.88 } }}>
              Entendido
            </Button>
          </DialogActions>
        </Dialog>

      </Box>
    </ThemeProvider>
  );
};

export default CatalogoVirtual;
