import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, TextField, InputAdornment, Chip, Avatar,
  Skeleton, IconButton, Tooltip, Badge, Drawer, Divider, Button,
  Dialog, DialogTitle, DialogContent, DialogActions, RadioGroup,
  FormControlLabel, Radio, Alert, CircularProgress,
} from '@mui/material';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import {
  Search, Storefront, ArrowForward, Inventory2,
  Apps as AppsIcon, ShoppingCart, Add, Remove, Close, CheckCircle,
} from '@mui/icons-material';
import DarkMode from '@mui/icons-material/DarkMode';
import LightMode from '@mui/icons-material/LightMode';
import apiClient from '../../api';
import { toast } from 'react-toastify';
import {
  getMarketplaceCart, subscribeMarketplaceCart, addToMarketplaceCart,
  updateMarketplaceCartQty, removeFromMarketplaceCart,
  groupMarketplaceCartByStore, marketplaceCartCount, submitMultiStoreOrder,
  removeMarketplaceCartStores,
} from '../../utils/marketplaceCart';

const ACCENT = '#4F46E5'; // índigo — distinto del catálogo individual (cada tienda tiene el suyo), identidad propia del mall

const safeGetItem = (key) => { try { return localStorage.getItem(key); } catch { return null; } };
const safeSetItem = (key, value) => { try { localStorage.setItem(key, value); } catch {} };

// Paleta determinística por nombre — cada tienda sin logo obtiene un color de
// respaldo estable (no random en cada render) para que el grid no se vea
// monocromático cuando faltan logos.
const FALLBACK_PALETTE = ['#4F46E5', '#0891B2', '#DB2777', '#059669', '#D97706', '#7C3AED', '#DC2626'];
const colorFromName = (name) => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return FALLBACK_PALETTE[Math.abs(hash) % FALLBACK_PALETTE.length];
};

const StoreCard = React.memo(function StoreCard({ store, onOpen }) {
  const brandColor = store.color_primario || colorFromName(store.nombre);
  return (
    <Box
      onClick={() => onOpen(store.slug_catalogo)}
      sx={{
        borderRadius: 4,
        overflow: 'hidden',
        cursor: 'pointer',
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: 'divider',
        display: 'flex',
        flexDirection: 'column',
        transition: 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.3s ease, border-color 0.25s ease',
        '@media (hover: hover)': {
          '&:hover': {
            transform: 'translateY(-6px)',
            boxShadow: `0 20px 40px -14px ${brandColor}40, 0 4px 12px rgba(0,0,0,0.08)`,
            borderColor: brandColor,
          },
        },
      }}
    >
      {/* Franja de color de marca — le da al grid la identidad "por bloques"
          que recomienda la skill de diseño para marketplaces, en vez de
          tarjetas MUI genéricas todas del mismo blanco/negro. */}
      <Box sx={{ height: 6, bgcolor: brandColor }} />

      <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 1.5, flex: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Avatar
            src={store.logo_base64 || undefined}
            variant="rounded"
            sx={{ width: 56, height: 56, borderRadius: 3, bgcolor: `${brandColor}18`, color: brandColor, fontWeight: 800, fontSize: 20 }}
          >
            {!store.logo_base64 && <Storefront />}
          </Avatar>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography sx={{ fontWeight: 800, fontSize: 16, lineHeight: 1.25, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {store.nombre}
            </Typography>
            {store.categoria_marketplace && (
              <Chip
                label={store.categoria_marketplace}
                size="small"
                sx={{ mt: 0.4, height: 20, fontSize: 10.5, fontWeight: 700, bgcolor: `${brandColor}15`, color: brandColor, borderRadius: 1 }}
              />
            )}
          </Box>
        </Box>

        {store.descripcion && (
        <Typography sx={{
          fontSize: 13, color: 'text.secondary', lineHeight: 1.5,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          minHeight: 39,
        }}>
          {store.descripcion}
        </Typography>
      )}

      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 'auto', pt: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'text.disabled' }}>
          <Inventory2 sx={{ fontSize: 14 }} />
          <Typography sx={{ fontSize: 11.5, fontWeight: 600 }}>
            {store.total_productos} producto{store.total_productos !== 1 ? 's' : ''}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3, color: brandColor, fontWeight: 700, fontSize: 12.5 }}>
          Visitar tienda <ArrowForward sx={{ fontSize: 14 }} />
        </Box>
      </Box>
      </Box>
    </Box>
  );
});

// Resultado de la búsqueda cruzada — un producto encontrado en CUALQUIER
// tienda del mall. Deja clarísimo a cuál tienda pertenece (el usuario nunca
// "compra" aquí; hace clic y entra a esa tienda como si hubiera llegado
// directo a su catálogo).
const ProductResultCard = React.memo(function ProductResultCard({ producto, apiBaseURL, onOpen, onQuickAdd }) {
  return (
    <Box
      onClick={() => onOpen(producto.empresa_slug)}
      sx={{
        position: 'relative',
        borderRadius: 3, overflow: 'hidden', cursor: 'pointer',
        bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider',
        transition: 'transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.25s ease',
        '@media (hover: hover)': {
          '&:hover': { transform: 'translateY(-4px)', boxShadow: `0 14px 28px -12px ${producto.empresa_color}40` },
        },
      }}
    >
      <Box sx={{
        aspectRatio: '1/1', bgcolor: 'action.hover',
        display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
      }}>
        {producto.image_count > 0 ? (
          <Box component="img"
            src={`${apiBaseURL}/catalogo/${producto.empresa_slug}/productos/${producto.id}/imagen?index=0`}
            alt={producto.nombre}
            loading="lazy"
            sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <Inventory2 sx={{ fontSize: 32, color: 'text.disabled' }} />
        )}

        {/* Agregar al carrito multi-tienda directo desde la búsqueda — solo
            si el producto NO tiene variantes: la búsqueda cruzada no trae
            tallas/colores, así que un producto con variantes debe elegirse
            dentro de su tienda (ver onOpen). */}
        {onQuickAdd && (
          <Tooltip title={producto.tiene_variantes ? 'Elige una opción en la tienda' : 'Agregar al carrito'}>
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                if (producto.tiene_variantes) { onOpen(producto.empresa_slug); return; }
                onQuickAdd(producto);
              }}
              sx={{
                position: 'absolute', top: 6, right: 6,
                bgcolor: producto.empresa_color, color: '#fff',
                width: 26, height: 26,
                '&:hover': { bgcolor: producto.empresa_color, opacity: 0.85 },
              }}
            >
              <Add sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        )}
      </Box>
      <Box sx={{ p: 1.5 }}>
        <Typography sx={{ fontSize: 12.5, fontWeight: 700, lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', minHeight: 32 }}>
          {producto.nombre}
        </Typography>
        <Typography sx={{ fontSize: 14, fontWeight: 900, color: producto.empresa_color, mt: 0.4 }}>
          ${new Intl.NumberFormat('es-CO').format(producto.precio)}
        </Typography>
        <Chip
          label={producto.empresa_nombre}
          size="small"
          sx={{ mt: 0.6, height: 18, fontSize: 9.5, fontWeight: 700, bgcolor: `${producto.empresa_color}15`, color: producto.empresa_color, borderRadius: 1 }}
        />
      </Box>
    </Box>
  );
});

const CardSkeleton = () => (
  <Box sx={{ borderRadius: 4, p: 3, border: '1px solid', borderColor: 'divider' }}>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
      <Skeleton variant="rounded" width={56} height={56} sx={{ borderRadius: 3 }} />
      <Box sx={{ flex: 1 }}>
        <Skeleton width="70%" height={20} />
        <Skeleton width="40%" height={16} sx={{ mt: 0.5 }} />
      </Box>
    </Box>
    <Skeleton width="100%" height={14} />
    <Skeleton width="60%" height={14} />
  </Box>
);

export default function MarketplaceHome() {
  const navigate = useNavigate();

  const [mode, setMode] = useState(() => safeGetItem('mkt_theme') || 'light');
  const isDark = mode === 'dark';
  const theme = useMemo(() => createTheme({
    palette: { mode, ...(isDark ? {
      background: { default: '#0A0A0F', paper: '#15151F' },
    } : {
      background: { default: '#F7F7FB', paper: '#ffffff' },
    }) },
    typography: { fontFamily: '"Plus Jakarta Sans", "Inter", system-ui, sans-serif' },
  }), [mode, isDark]);

  useEffect(() => {
    if (!document.getElementById('mkt-font')) {
      const link = document.createElement('link');
      link.id = 'mkt-font';
      link.rel = 'stylesheet';
      link.href = 'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap';
      document.head.appendChild(link);
    }
    document.title = 'Centro Comercial Virtual — Descubre negocios locales';
  }, []);

  const toggleMode = () => {
    const next = mode === 'light' ? 'dark' : 'light';
    setMode(next);
    safeSetItem('mkt_theme', next);
  };

  const [loading, setLoading] = useState(true);
  const [stores, setStores] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [categoria, setCategoria] = useState('Todas');

  // ── Carrito multi-tienda (fase 2 del multicarrito) ──────────────────────
  // Compartido con CatalogoVirtual.js vía localStorage (misma clave, mismo
  // origen) — agregar aquí desde la búsqueda cruzada o dentro de una tienda
  // termina en el mismo carrito.
  const [cartItems, setCartItems] = useState(() => getMarketplaceCart());
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutStep, setCheckoutStep] = useState(1); // 1: datos, 2: confirmar, 3: resultado
  const [ckNombre, setCkNombre] = useState('');
  const [ckCelular, setCkCelular] = useState('');
  const [ckTipoEntrega, setCkTipoEntrega] = useState('tienda');
  const [ckDireccion, setCkDireccion] = useState('');
  const [ckComentarios, setCkComentarios] = useState('');
  const [ckErrors, setCkErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [checkoutResults, setCheckoutResults] = useState(null);

  useEffect(() => subscribeMarketplaceCart(setCartItems), []);

  const cartGroups = useMemo(() => groupMarketplaceCartByStore(cartItems), [cartItems]);
  const cartCount = useMemo(() => marketplaceCartCount(cartItems), [cartItems]);
  const cartTotal = useMemo(() => cartGroups.reduce((acc, g) => acc + g.total, 0), [cartGroups]);

  const handleQuickAdd = useCallback((producto) => {
    addToMarketplaceCart({
      producto_id: producto.id,
      nombre: producto.nombre,
      precio: producto.precio,
      empresa_slug: producto.empresa_slug,
      empresa_nombre: producto.empresa_nombre,
      empresa_color: producto.empresa_color,
    });
    toast.success(`${producto.nombre} agregado al carrito`);
  }, []);

  const handleCheckoutSubmit = async () => {
    if (!ckNombre || !ckCelular) {
      setCkErrors({ nombre: !ckNombre, celular: !ckCelular });
      return;
    }
    if (ckTipoEntrega === 'domicilio' && !ckDireccion) {
      setCkErrors({ direccion: true });
      return;
    }
    setCkErrors({});
    setSubmitting(true);
    const resultados = await submitMultiStoreOrder(apiClient, cartGroups, {
      nombre: ckNombre, celular: ckCelular, tipoEntrega: ckTipoEntrega,
      direccion: ckDireccion, comentarios: ckComentarios,
    });
    setSubmitting(false);
    setCheckoutResults(resultados);
    setCheckoutStep(3);
    const tiendasOk = resultados.filter(r => r.ok).map(r => r.empresa_slug);
    if (tiendasOk.length) removeMarketplaceCartStores(tiendasOk);
  };

  const closeCheckout = () => {
    setCheckoutOpen(false);
    setCheckoutStep(1);
    setCheckoutResults(null);
    setCkErrors({});
  };

  // Búsqueda cruzada de PRODUCTOS entre todas las tiendas — esto es lo que
  // distingue al mall de una simple lista de marcas: buscar "tenis" encuentra
  // resultados de cualquier tienda opt-in, sin que el usuario sepa cuál.
  const [productos, setProductos] = useState([]);
  const [loadingProductos, setLoadingProductos] = useState(false);

  const fetchStores = useCallback(async () => {
    try {
      setLoading(true);
      const [rStores, rCats] = await Promise.all([
        apiClient.get('/marketplace/empresas'),
        apiClient.get('/marketplace/categorias'),
      ]);
      setStores(rStores.data || []);
      setCategorias(rCats.data || []);
    } catch {
      setStores([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchStores(); }, [fetchStores]);

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    if (!search || search.trim().length < 2) { setProductos([]); return; }
    let cancelado = false;
    setLoadingProductos(true);
    apiClient.get('/marketplace/productos', { params: { search, categoria: categoria !== 'Todas' ? categoria : undefined } })
      .then(r => { if (!cancelado) setProductos(r.data || []); })
      .catch(() => { if (!cancelado) setProductos([]); })
      .finally(() => { if (!cancelado) setLoadingProductos(false); });
    return () => { cancelado = true; };
  }, [search, categoria]);

  const filteredStores = useMemo(() => {
    let list = stores;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(s => s.nombre.toLowerCase().includes(q) || (s.descripcion && s.descripcion.toLowerCase().includes(q)));
    }
    if (categoria !== 'Todas') list = list.filter(s => s.categoria_marketplace === categoria);
    return list;
  }, [stores, search, categoria]);

  const categoryCounts = useMemo(() => {
    const counts = {};
    stores.forEach(s => { if (s.categoria_marketplace) counts[s.categoria_marketplace] = (counts[s.categoria_marketplace] || 0) + 1; });
    return counts;
  }, [stores]);

  const openStore = useCallback((slug) => navigate(`/${slug}`), [navigate]);

  return (
    <ThemeProvider theme={theme}>
      <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', color: 'text.primary' }}>

        {/* ── HERO ─────────────────────────────────────────────────── */}
        <Box sx={{
          position: 'relative', overflow: 'hidden',
          background: isDark
            ? 'radial-gradient(1200px 500px at 20% -10%, rgba(79,70,229,0.35), transparent), radial-gradient(900px 400px at 100% 0%, rgba(219,39,119,0.18), transparent), #0A0A0F'
            : 'radial-gradient(1200px 500px at 20% -10%, rgba(79,70,229,0.14), transparent), radial-gradient(900px 400px at 100% 0%, rgba(219,39,119,0.08), transparent), #F7F7FB',
          backgroundSize: '200% 200%',
          animation: 'marketplaceHeroPan 18s ease-in-out infinite',
          '@keyframes marketplaceHeroPan': {
            '0%': { backgroundPosition: '0% 0%' },
            '50%': { backgroundPosition: '100% 40%' },
            '100%': { backgroundPosition: '0% 0%' },
          },
          '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
          px: 2, pt: { xs: 4, md: 7 }, pb: { xs: 5, md: 8 },
        }}>
          <Box sx={{ maxWidth: 1200, mx: 'auto', position: 'relative', zIndex: 1 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: { xs: 3, md: 5 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
                <Box sx={{
                  width: 36, height: 36, borderRadius: 2, bgcolor: ACCENT,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
                }}>
                  <AppsIcon fontSize="small" />
                </Box>
                <Typography sx={{ fontWeight: 800, fontSize: 16 }}>Centro Comercial Virtual</Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Tooltip title="Carrito">
                  <IconButton onClick={() => setCartOpen(true)} size="small" aria-label="Carrito" sx={{
                    color: 'text.secondary', bgcolor: 'action.hover', '&:hover': { bgcolor: 'action.selected' },
                  }}>
                    <Badge badgeContent={cartCount} color="error" sx={{ '& .MuiBadge-badge': { fontSize: 9, height: 15, minWidth: 15 } }}>
                      <ShoppingCart sx={{ fontSize: 18 }} />
                    </Badge>
                  </IconButton>
                </Tooltip>
                <Tooltip title={isDark ? 'Modo claro' : 'Modo oscuro'}>
                  <IconButton onClick={toggleMode} size="small" aria-label={isDark ? 'Modo claro' : 'Modo oscuro'} sx={{
                    color: 'text.secondary', bgcolor: 'action.hover', '&:hover': { bgcolor: 'action.selected' },
                  }}>
                    {isDark ? <LightMode sx={{ fontSize: 18 }} /> : <DarkMode sx={{ fontSize: 18 }} />}
                  </IconButton>
                </Tooltip>
              </Box>
            </Box>

            <Typography sx={{
              fontWeight: 900, lineHeight: 1.22,
              fontSize: { xs: 34, sm: 46, md: 58 },
              letterSpacing: '-0.02em',
              background: `linear-gradient(135deg, ${isDark ? '#fff' : '#0A0A0F'} 40%, ${ACCENT} 100%)`,
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              maxWidth: 760,
              pb: 0.5,
            }}>
              Tus negocios de confianza, ahora en un solo lugar.
            </Typography>
            <Typography sx={{ fontSize: { xs: 15, md: 18 }, color: 'text.secondary', mt: 2, maxWidth: 560 }}>
              Tenis, belleza, tecnología, comida y mucho más — negocios colombianos con su propio catálogo y pedidos directos por WhatsApp.
            </Typography>

            <Box sx={{ display: 'flex', gap: 1.5, mt: 4, maxWidth: 640, flexWrap: 'wrap' }}>
              <TextField
                fullWidth size="medium"
                placeholder="Busca una marca o tienda…"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                sx={{
                  flex: 1, minWidth: 240,
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 3, bgcolor: 'background.paper',
                    boxShadow: isDark ? 'none' : '0 4px 20px rgba(0,0,0,0.06)',
                  },
                }}
                InputProps={{
                  startAdornment: <InputAdornment position="start"><Search sx={{ color: 'text.secondary' }} /></InputAdornment>,
                }}
              />
            </Box>

            {/* Category chips */}
            {categorias.length > 0 && (
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 3 }}>
                {['Todas', ...categorias].map(cat => {
                  const active = categoria === cat;
                  const count = cat === 'Todas' ? stores.length : (categoryCounts[cat] || 0);
                  return (
                    <Chip
                      key={cat}
                      label={`${cat} (${count})`}
                      onClick={() => setCategoria(cat)}
                      sx={{
                        fontWeight: 700, fontSize: 12.5, cursor: 'pointer',
                        bgcolor: active ? ACCENT : 'background.paper',
                        color: active ? '#fff' : 'text.secondary',
                        border: '1px solid', borderColor: active ? ACCENT : 'divider',
                        '&:hover': { bgcolor: active ? ACCENT : 'action.hover' },
                      }}
                    />
                  );
                })}
              </Box>
            )}
          </Box>
        </Box>

        {/* ── RESULTADOS DE PRODUCTOS (búsqueda cruzada entre tiendas) ── */}
        {search.trim().length >= 2 && (
          <Box sx={{ maxWidth: 1200, mx: 'auto', px: 2, pt: { xs: 3, md: 4 } }}>
            <Typography sx={{ fontWeight: 700, fontSize: 13, color: 'text.secondary', mb: 2, textTransform: 'uppercase', letterSpacing: 0.6 }}>
              {loadingProductos ? 'Buscando productos…' : `Productos para "${search}" ${productos.length > 0 ? `(${productos.length})` : ''}`}
            </Typography>
            {!loadingProductos && productos.length === 0 ? (
              <Typography sx={{ fontSize: 13, color: 'text.secondary', mb: 3 }}>
                Ningún producto coincide — puede que la marca exista igual, revisa abajo.
              </Typography>
            ) : (
              <Box sx={{
                display: 'grid',
                gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)', md: 'repeat(5, 1fr)' },
                gap: 1.5, mb: { xs: 3, md: 4 },
              }}>
                {loadingProductos
                  ? Array.from({ length: 5 }).map((_, i) => (
                      <Skeleton key={i} variant="rounded" sx={{ aspectRatio: '3/4', borderRadius: 3 }} />
                    ))
                  : productos.map(p => (
                      <ProductResultCard key={`${p.empresa_slug}-${p.id}`} producto={p} apiBaseURL={apiClient.defaults.baseURL} onOpen={openStore} onQuickAdd={handleQuickAdd} />
                    ))
                }
              </Box>
            )}
          </Box>
        )}

        {/* ── GRID DE MARCAS ───────────────────────────────────────── */}
        <Box sx={{ maxWidth: 1200, mx: 'auto', px: 2, py: { xs: 4, md: 6 } }}>
          <Typography sx={{ fontWeight: 700, fontSize: 13, color: 'text.secondary', mb: 2.5, textTransform: 'uppercase', letterSpacing: 0.6 }}>
            {loading ? 'Cargando marcas…' : `${filteredStores.length} marca${filteredStores.length !== 1 ? 's' : ''} disponible${filteredStores.length !== 1 ? 's' : ''}`}
          </Typography>

          <Box sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)', lg: 'repeat(4, 1fr)' },
            gap: 2.5,
          }}>
            {loading
              ? Array.from({ length: 8 }).map((_, i) => <CardSkeleton key={i} />)
              : filteredStores.map(s => <StoreCard key={s.slug_catalogo} store={s} onOpen={openStore} />)
            }
          </Box>

          {!loading && filteredStores.length === 0 && (
            <Box sx={{ textAlign: 'center', py: 8 }}>
              <Storefront sx={{ fontSize: 56, opacity: 0.2, mb: 2 }} />
              <Typography sx={{ fontWeight: 800, fontSize: 17 }}>
                {stores.length === 0 ? 'Muy pronto habrá marcas aquí' : 'Sin resultados'}
              </Typography>
              <Typography sx={{ color: 'text.secondary', fontSize: 13.5, mt: 0.5 }}>
                {stores.length === 0
                  ? 'Estamos invitando negocios a unirse al Centro Comercial Virtual.'
                  : 'Intenta con otro término o cambia de categoría.'}
              </Typography>
            </Box>
          )}
        </Box>

        {/* ── RECLUTAMIENTO — este dominio es de Ksmart360, así que a
             diferencia del catálogo de cada tienda (donde este banner sería
             ruido), aquí SÍ tiene sentido: es el canal para sumar más marcas
             al directorio. ── */}
        <Box sx={{ maxWidth: 1200, mx: 'auto', px: 2, pb: { xs: 4, md: 6 } }}>
          <Box sx={{
            borderRadius: 4, p: { xs: 3, md: 4 },
            display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 2,
            background: `linear-gradient(120deg, ${ACCENT} 0%, #7C3AED 100%)`,
          }}>
            <Box>
              <Typography sx={{ fontWeight: 800, fontSize: { xs: 17, md: 19 }, color: '#fff' }}>
                ¿Tienes un negocio? Súmate al Centro Comercial Virtual.
              </Typography>
              <Typography sx={{ fontSize: 13, color: 'rgba(255,255,255,0.85)', mt: 0.5 }}>
                Crea tu catálogo con Ksmart360 y actívalo aquí en un clic — gratis para empezar.
              </Typography>
            </Box>
            <Box
              component="a"
              href="https://www.techstackcol.com/ksmart360?view=pymes"
              target="_blank" rel="noopener noreferrer"
              sx={{
                bgcolor: '#fff', color: ACCENT, fontWeight: 800, fontSize: 13.5,
                px: 3, py: 1.3, borderRadius: 3, textDecoration: 'none', flexShrink: 0,
                transition: 'transform 0.15s ease', '&:hover': { transform: 'scale(1.04)' },
              }}
            >
              Crear mi tienda gratis →
            </Box>
          </Box>
        </Box>

        {/* ── FOOTER ───────────────────────────────────────────────── */}
        <Box sx={{ borderTop: '1px solid', borderColor: 'divider', px: 2, py: 3, textAlign: 'center' }}>
          <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
            Centro Comercial Virtual · Operado con{' '}
            <Box component="a" href="https://www.techstackcol.com/ksmart360?view=pymes" target="_blank" rel="noopener noreferrer"
              sx={{ color: ACCENT, fontWeight: 700, textDecoration: 'none' }}>
              Ksmart360
            </Box>
          </Typography>
        </Box>

        {/* ── CARRITO MULTI-TIENDA ─────────────────────────────────── */}
        <Drawer anchor="right" open={cartOpen} onClose={() => setCartOpen(false)}
          PaperProps={{ sx: { width: { xs: '100%', sm: 400 }, bgcolor: 'background.default' } }}>
          <Box sx={{ p: 2.5, display: 'flex', flexDirection: 'column', height: '100%' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Typography sx={{ fontWeight: 800, fontSize: 17 }}>Tu carrito</Typography>
              <IconButton size="small" onClick={() => setCartOpen(false)}><Close fontSize="small" /></IconButton>
            </Box>

            {cartGroups.length === 0 ? (
              <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1.5, color: 'text.secondary' }}>
                <ShoppingCart sx={{ fontSize: 40, opacity: 0.3 }} />
                <Typography sx={{ fontSize: 13.5 }}>Tu carrito está vacío</Typography>
                <Typography sx={{ fontSize: 12, textAlign: 'center', maxWidth: 260 }}>
                  Agrega productos desde la búsqueda o entrando a cualquier tienda del Centro Comercial.
                </Typography>
              </Box>
            ) : (
              <Box sx={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                {cartGroups.map(grupo => (
                  <Box key={grupo.empresa_slug}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: grupo.empresa_color }} />
                      <Typography sx={{ fontWeight: 800, fontSize: 13 }}>{grupo.empresa_nombre}</Typography>
                    </Box>
                    {grupo.items.map(item => (
                      <Box key={item.cartId} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography sx={{ fontSize: 12.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {item.nombre}{item.nombre_variante ? ` (${item.nombre_variante})` : ''}
                          </Typography>
                          <Typography sx={{ fontSize: 11.5, color: 'text.secondary' }}>
                            ${new Intl.NumberFormat('es-CO').format(item.precio)} c/u
                          </Typography>
                        </Box>
                        <IconButton size="small" onClick={() => setCartItems(updateMarketplaceCartQty(item.cartId, item.cantidad - 1))}>
                          <Remove sx={{ fontSize: 14 }} />
                        </IconButton>
                        <Typography sx={{ fontSize: 12.5, fontWeight: 700, minWidth: 16, textAlign: 'center' }}>{item.cantidad}</Typography>
                        <IconButton size="small" onClick={() => setCartItems(updateMarketplaceCartQty(item.cartId, item.cantidad + 1))}>
                          <Add sx={{ fontSize: 14 }} />
                        </IconButton>
                        <IconButton size="small" onClick={() => setCartItems(removeFromMarketplaceCart(item.cartId))}>
                          <Close sx={{ fontSize: 14 }} />
                        </IconButton>
                      </Box>
                    ))}
                    <Divider sx={{ mt: 1 }} />
                  </Box>
                ))}
              </Box>
            )}

            {cartGroups.length > 0 && (
              <Box sx={{ pt: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1.5 }}>
                  <Typography sx={{ fontWeight: 700, fontSize: 13.5 }}>Total ({cartGroups.length} tienda{cartGroups.length !== 1 ? 's' : ''})</Typography>
                  <Typography sx={{ fontWeight: 900, fontSize: 15, color: ACCENT }}>
                    ${new Intl.NumberFormat('es-CO').format(cartTotal)}
                  </Typography>
                </Box>
                <Button
                  fullWidth variant="contained" size="large"
                  onClick={() => { setCartOpen(false); setCheckoutOpen(true); }}
                  sx={{ bgcolor: ACCENT, borderRadius: 3, py: 1.3, fontWeight: 800, '&:hover': { bgcolor: ACCENT, opacity: 0.9 } }}
                >
                  Finalizar pedido
                </Button>
              </Box>
            )}
          </Box>
        </Drawer>

        {/* ── CHECKOUT MULTI-TIENDA ────────────────────────────────── */}
        <Dialog open={checkoutOpen} onClose={checkoutStep === 3 ? closeCheckout : () => setCheckoutOpen(false)}
          maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3, m: { xs: 1, sm: 3 } } }}>
          <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
            <Typography sx={{ fontWeight: 800, fontSize: 17 }}>
              {checkoutStep === 3 ? 'Resultado de tu pedido' : 'Finalizar pedido'}
            </Typography>
            <IconButton size="small" onClick={checkoutStep === 3 ? closeCheckout : () => setCheckoutOpen(false)}><Close fontSize="small" /></IconButton>
          </DialogTitle>
          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            {checkoutStep !== 3 && (
              <Alert severity="info" sx={{ borderRadius: 2, fontSize: 12 }}>
                Tu carrito tiene productos de {cartGroups.length} tienda{cartGroups.length !== 1 ? 's' : ''} distinta{cartGroups.length !== 1 ? 's' : ''}.
                Cada una recibirá su propio pedido con su propio número.
              </Alert>
            )}

            {checkoutStep === 1 && (
              <>
                <TextField label="Tu nombre" size="small" value={ckNombre} onChange={(e) => setCkNombre(e.target.value)} error={!!ckErrors.nombre} fullWidth />
                <TextField label="Tu celular" size="small" value={ckCelular} onChange={(e) => setCkCelular(e.target.value)} error={!!ckErrors.celular} fullWidth />
                <RadioGroup row value={ckTipoEntrega} onChange={(e) => setCkTipoEntrega(e.target.value)}>
                  <FormControlLabel value="tienda" control={<Radio size="small" />} label="Recoger en tienda" />
                  <FormControlLabel value="domicilio" control={<Radio size="small" />} label="Domicilio" />
                </RadioGroup>
                {ckTipoEntrega === 'domicilio' && (
                  <TextField label="Dirección de entrega" size="small" value={ckDireccion} onChange={(e) => setCkDireccion(e.target.value)} error={!!ckErrors.direccion} fullWidth />
                )}
                <TextField label="Comentarios (opcional)" size="small" value={ckComentarios} onChange={(e) => setCkComentarios(e.target.value)} fullWidth multiline minRows={2} />
              </>
            )}

            {checkoutStep === 2 && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {cartGroups.map(grupo => (
                  <Box key={grupo.empresa_slug} sx={{ p: 1.5, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                    <Typography sx={{ fontWeight: 800, fontSize: 13 }}>{grupo.empresa_nombre}</Typography>
                    <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
                      {grupo.items.length} producto{grupo.items.length !== 1 ? 's' : ''} · ${new Intl.NumberFormat('es-CO').format(grupo.total)}
                    </Typography>
                  </Box>
                ))}
              </Box>
            )}

            {checkoutStep === 3 && checkoutResults && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {checkoutResults.map(r => (
                  <Box key={r.empresa_slug} sx={{
                    p: 1.5, borderRadius: 2, border: '1px solid',
                    borderColor: r.ok ? 'success.main' : 'error.main',
                    bgcolor: r.ok ? 'rgba(5,150,105,0.08)' : 'rgba(239,68,68,0.08)',
                  }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {r.ok ? <CheckCircle sx={{ fontSize: 18, color: 'success.main' }} /> : null}
                      <Typography sx={{ fontWeight: 800, fontSize: 13 }}>{r.empresa_nombre}</Typography>
                    </Box>
                    {r.ok ? (
                      <Typography sx={{ fontSize: 12.5, mt: 0.3 }}>Pedido #{r.numero_pedido} registrado.</Typography>
                    ) : (
                      <Typography sx={{ fontSize: 12.5, mt: 0.3, color: 'error.main' }}>{r.error}</Typography>
                    )}
                  </Box>
                ))}
                <Typography sx={{ fontSize: 11.5, color: 'text.secondary', mt: 0.5 }}>
                  Guarda el número de cada pedido — con él y tu celular puedes consultar el estado desde la tienda correspondiente.
                </Typography>
              </Box>
            )}
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            {checkoutStep === 1 && (
              <Button fullWidth variant="contained" onClick={() => {
                if (!ckNombre || !ckCelular) { setCkErrors({ nombre: !ckNombre, celular: !ckCelular }); return; }
                if (ckTipoEntrega === 'domicilio' && !ckDireccion) { setCkErrors({ direccion: true }); return; }
                setCkErrors({});
                setCheckoutStep(2);
              }} sx={{ bgcolor: ACCENT, borderRadius: 2, fontWeight: 700, '&:hover': { bgcolor: ACCENT, opacity: 0.9 } }}>
                Continuar
              </Button>
            )}
            {checkoutStep === 2 && (
              <Button fullWidth variant="contained" disabled={submitting} onClick={handleCheckoutSubmit}
                sx={{ bgcolor: ACCENT, borderRadius: 2, fontWeight: 700, '&:hover': { bgcolor: ACCENT, opacity: 0.9 } }}>
                {submitting ? <CircularProgress size={20} sx={{ color: '#fff' }} /> : 'Confirmar pedido'}
              </Button>
            )}
            {checkoutStep === 3 && (
              <Button fullWidth variant="contained" onClick={closeCheckout}
                sx={{ bgcolor: ACCENT, borderRadius: 2, fontWeight: 700, '&:hover': { bgcolor: ACCENT, opacity: 0.9 } }}>
                Entendido
              </Button>
            )}
          </DialogActions>
        </Dialog>
      </Box>
    </ThemeProvider>
  );
}
