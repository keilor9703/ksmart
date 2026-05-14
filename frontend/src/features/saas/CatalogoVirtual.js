import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import {
  Box, Typography, Grid, Card, CardContent, CardMedia, IconButton,
  Button, TextField, InputAdornment, Badge, Drawer, Divider,
  List, ListItem, ListItemText, ListItemAvatar, Avatar,
  CircularProgress, Chip, useMediaQuery, useTheme, Fab,
  Dialog, DialogTitle, DialogContent, DialogActions, RadioGroup,
  FormControlLabel, Radio, Zoom, Paper, Alert
} from '@mui/material';
import {
  Search, ShoppingCart, Add, Remove, WhatsApp,
  Storefront, LocationOn, Person, Phone, Close,
  ArrowForward, ShoppingBag
} from '@mui/icons-material';
import apiClient from '../../api';
import { toast } from 'react-toastify';

const CatalogoVirtual = () => {
  const { slug } = useParams();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
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

  // Formulario de Pedido
  const [nombre, setNombre] = useState('');
  const [celular, setCelular] = useState('');
  const [tipoEntrega, setTipoEntrega] = useState('domicilio');
  const [direccion, setDireccion] = useState('');
  const [comentarios, setComentarios] = useState('');

  useEffect(() => {
    fetchData();
  }, [slug]);

  useEffect(() => {
    localStorage.setItem(`cart_${slug}`, JSON.stringify(cart));
  }, [cart, slug]);

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

  const filteredProductos = useMemo(() => {
    return productos.filter(p => {
      const matchesSearch = p.nombre.toLowerCase().includes(search.toLowerCase()) ||
                          (p.descripcion && p.descripcion.toLowerCase().includes(search.toLowerCase()));
      const matchesCat = categoria === 'Todas' || p.categoria === categoria;
      return matchesSearch && matchesCat;
    });
  }, [productos, search, categoria]);

  const categorias = useMemo(() => {
    const cats = new Set(productos.map(p => p.categoria));
    return ['Todas', ...Array.from(cats)];
  }, [productos]);

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

  const cartTotal = cart.reduce((sum, item) => sum + (item.precio * item.quantity), 0);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const handleSendOrder = () => {
    if (!nombre || !celular) {
      toast.warning("Nombre y celular son obligatorios");
      return;
    }

    if (tipoEntrega === 'domicilio' && !direccion) {
      toast.warning("La dirección es obligatoria para domicilios");
      return;
    }

    const formatCurrency = (val) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(val);

    let message = `🛍️ *NUEVO PEDIDO - ${empresa.nombre}*\n\n`;
    message += `👤 *Cliente:* ${nombre}\n`;
    message += `📱 *Celular:* ${celular}\n`;
    message += `📦 *Entrega:* ${tipoEntrega === 'domicilio' ? 'A domicilio 🛵' : 'Recoger en tienda 🏪'}\n`;
    
    if (tipoEntrega === 'domicilio') {
      message += `📍 *Dirección:* ${direccion}\n`;
    } else if (empresa.direccion) {
      message += `📍 *Punto de recogida:* ${empresa.direccion}\n`;
    }

    if (comentarios) {
      message += `💬 *Comentarios:* ${comentarios}\n`;
    }

    message += `\n*PRODUCTOS:*\n`;
    cart.forEach(item => {
      message += `• ${item.nombre} x${item.quantity} — ${formatCurrency(item.precio)} c/u = ${formatCurrency(item.precio * item.quantity)}\n`;
    });

    message += `\n💰 *TOTAL: ${formatCurrency(cartTotal)}*`;

    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${empresa.whatsapp_pedidos}?text=${encodedMessage}`;
    
    window.open(whatsappUrl, '_blank');
    
    // Limpieza post-envío
    setCart([]);
    setOrderModalOpen(false);
    setCartOpen(false);
    toast.success("¡Pedido enviado por WhatsApp!");
  };

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}><CircularProgress /></Box>;
  if (!empresa) return <Box sx={{ p: 5, textAlign: 'center' }}><Typography variant="h5">Catálogo no disponible</Typography></Box>;

  const accentColor = empresa.color_primario || '#FF6020';

  return (
    <Box sx={{ bgcolor: '#F8FAFC', minHeight: '100vh', pb: 10 }}>
      {/* HEADER */}
      <Box sx={{ bgcolor: '#fff', px: 2, pt: 3, pb: 2, boxShadow: '0 2px 10px rgba(0,0,0,0.05)', position: 'sticky', top: 0, zIndex: 100 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
          {empresa.logo_base64 ? (
            <Avatar src={empresa.logo_base64} variant="rounded" sx={{ width: 50, height: 50 }} />
          ) : (
            <Avatar sx={{ bgcolor: accentColor, width: 50, height: 50 }} variant="rounded"><Storefront /></Avatar>
          )}
          <Box>
            <Typography sx={{ fontWeight: 800, fontSize: 18, color: '#1E293B' }}>{empresa.nombre}</Typography>
            <Typography variant="caption" color="text.secondary">Catálogo Virtual</Typography>
          </Box>
        </Box>

        <TextField
          fullWidth
          size="small"
          placeholder="¿Qué estás buscando hoy?"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ mb: 2, '& .MuiOutlinedInput-root': { borderRadius: 3, bgcolor: '#F1F5F9' } }}
          InputProps={{
            startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment>
          }}
        />

        {/* FILTRO CATEGORÍAS */}
        <Box sx={{ display: 'flex', gap: 1, overflowX: 'auto', pb: 1, '&::-webkit-scrollbar': { display: 'none' } }}>
          {categorias.map(cat => (
            <Chip
              key={cat}
              label={cat}
              onClick={() => setCategoria(cat)}
              sx={{
                bgcolor: categoria === cat ? accentColor : '#fff',
                color: categoria === cat ? '#fff' : '#475569',
                fontWeight: 600,
                border: '1px solid',
                borderColor: categoria === cat ? accentColor : '#E2E8F0',
                '&:hover': { bgcolor: categoria === cat ? accentColor : '#F1F5F9' }
              }}
            />
          ))}
        </Box>
      </Box>

      {/* PRODUCTOS */}
      <Box sx={{ p: 2 }}>
        <Grid container spacing={2}>
          {filteredProductos.map(p => {
            const inCart = cart.find(item => item.id === p.id);
            return (
              <Grid item xs={6} sm={4} md={3} key={p.id}>
                <Card sx={{ borderRadius: 4, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.04)', border: '1px solid #F1F5F9' }}>
                  <Box sx={{ position: 'relative' }}>
                    <CardMedia
                      component="img"
                      sx={{ aspectRatio: '1/1', objectFit: 'cover' }}
                      image={p.has_image ? `${apiClient.defaults.baseURL}/catalogo/${slug}/productos/${p.id}/imagen` : 'https://placehold.co/400x400?text=No+Image'}
                      alt={p.nombre}
                    />
                    {p.categoria && (
                      <Chip 
                        label={p.categoria} 
                        size="small" 
                        sx={{ position: 'absolute', top: 8, left: 8, bgcolor: 'rgba(255,255,255,0.9)', fontWeight: 700, fontSize: 10, height: 20 }} 
                      />
                    )}
                  </Box>
                  <CardContent sx={{ p: 1.5, flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                    <Typography sx={{ fontWeight: 700, fontSize: 14, mb: 0.5, color: '#1E293B', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', minHeight: 40 }}>
                      {p.nombre}
                    </Typography>
                    <Typography sx={{ fontWeight: 800, fontSize: 16, color: accentColor, mt: 'auto' }}>
                      ${new Intl.NumberFormat('es-CO').format(p.precio)}
                    </Typography>
                    
                    <Box sx={{ mt: 1.5 }}>
                      {inCart ? (
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', bgcolor: '#F1F5F9', borderRadius: 2, p: 0.5 }}>
                          <IconButton size="small" onClick={() => removeFromCart(p.id)} sx={{ bgcolor: '#fff', color: accentColor }}><Remove fontSize="small" /></IconButton>
                          <Typography sx={{ fontWeight: 700, fontSize: 14 }}>{inCart.quantity}</Typography>
                          <IconButton size="small" onClick={() => addToCart(p)} sx={{ bgcolor: '#fff', color: accentColor }}><Add fontSize="small" /></IconButton>
                        </Box>
                      ) : (
                        <Button
                          fullWidth
                          variant="contained"
                          size="small"
                          startIcon={<Add />}
                          onClick={() => addToCart(p)}
                          sx={{ bgcolor: accentColor, borderRadius: 2, fontWeight: 700, textTransform: 'none', '&:hover': { bgcolor: accentColor, opacity: 0.9 } }}
                        >
                          Agregar
                        </Button>
                      )}
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>
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
                    src={item.has_image ? `${apiClient.defaults.baseURL}/catalogo/${slug}/productos/${item.id}/imagen` : null}
                    sx={{ bgcolor: '#F1F5F9', color: '#94A3B8' }}
                  >
                    <ShoppingBag />
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={<Typography sx={{ fontWeight: 700, fontSize: 14 }}>{item.nombre}</Typography>}
                  secondary={<Typography sx={{ color: accentColor, fontWeight: 700, fontSize: 13 }}>${new Intl.NumberFormat('es-CO').format(item.precio)}</Typography>}
                />
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, bgcolor: '#F1F5F9', borderRadius: 2, p: 0.5 }}>
                  <IconButton size="small" onClick={() => removeFromCart(item.id)} sx={{ bgcolor: '#fff', color: accentColor }}><Remove fontSize="small" /></IconButton>
                  <Typography sx={{ fontWeight: 700, fontSize: 13 }}>{item.quantity}</Typography>
                  <IconButton size="small" onClick={() => addToCart(item)} sx={{ bgcolor: '#fff', color: accentColor }}><Add fontSize="small" /></IconButton>
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
        <DialogContent dividers>
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
        <DialogActions sx={{ p: 3 }}>
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
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default CatalogoVirtual;
