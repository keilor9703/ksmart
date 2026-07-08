import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, TextField, InputAdornment, Chip, Avatar,
  Skeleton, IconButton, Tooltip,
} from '@mui/material';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import {
  Search, Storefront, ArrowForward, Inventory2,
  Apps as AppsIcon,
} from '@mui/icons-material';
import DarkMode from '@mui/icons-material/DarkMode';
import LightMode from '@mui/icons-material/LightMode';
import apiClient from '../../api';

const ACCENT = '#4F46E5'; // índigo — distinto del catálogo individual (cada tienda tiene el suyo), identidad propia del mall

// Posiciones/tiempos para las insignias flotantes del hero — las FOTOS son
// reales, tomadas de productos publicados por las propias empresas del mall
// (ver /marketplace/productos/destacados), no emoji ni stock genérico.
const FLOATING_BADGE_LAYOUT = [
  { top: '6%',  left: '2%',  size: 128, delay: '0s',    duration: '6s' },
  { top: '60%', left: '3%',  size: 108, delay: '1.2s',  duration: '7s' },
  { top: '10%', left: '84%', size: 118, delay: '0.6s',  duration: '6.5s' },
  { top: '44%', left: '89%', size: 124, delay: '1.8s',  duration: '5.5s' },
  { top: '78%', left: '80%', size: 104, delay: '0.3s',  duration: '7.5s' },
  { top: '80%', left: '14%', size: 112, delay: '2.1s',  duration: '6.2s' },
];

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
const ProductResultCard = React.memo(function ProductResultCard({ producto, apiBaseURL, onOpen }) {
  return (
    <Box
      onClick={() => onOpen(producto.empresa_slug)}
      sx={{
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

  // Búsqueda cruzada de PRODUCTOS entre todas las tiendas — esto es lo que
  // distingue al mall de una simple lista de marcas: buscar "tenis" encuentra
  // resultados de cualquier tienda opt-in, sin que el usuario sepa cuál.
  const [productos, setProductos] = useState([]);
  const [loadingProductos, setLoadingProductos] = useState(false);

  // Fotos reales de productos (no emoji/íconos) para las insignias flotantes
  // del hero — muestran la variedad real de lo que hay dentro del mall.
  const [featuredProducts, setFeaturedProducts] = useState([]);

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
    apiClient.get('/marketplace/productos/destacados', { params: { limit: FLOATING_BADGE_LAYOUT.length } })
      .then(r => setFeaturedProducts(r.data || []))
      .catch(() => setFeaturedProducts([]));
  }, []);

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
          {/* Insignias de producto flotantes — FOTOS REALES de productos
              publicados por las tiendas del mall (no emoji/íconos), muestran
              la variedad real de lo que hay adentro. Ocultas en mobile para
              no saturar el layout. */}
          <Box aria-hidden="true" sx={{
            display: { xs: 'none', md: 'block' },
            position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0,
          }}>
            {FLOATING_BADGE_LAYOUT.map((b, i) => {
              const p = featuredProducts[i];
              if (!p) return null;
              const brandColor = p.empresa_color || ACCENT;
              return (
              <Box key={i} sx={{
                position: 'absolute', top: b.top, left: b.left,
                width: b.size, height: b.size, borderRadius: '24%',
                overflow: 'hidden',
                border: '4px solid', borderColor: isDark ? 'rgba(255,255,255,0.12)' : '#fff',
                boxShadow: `0 18px 36px -14px ${brandColor}70, 0 4px 10px rgba(0,0,0,0.08)`,
                animation: `marketplaceFloat ${b.duration} ease-in-out ${b.delay} infinite`,
                '@keyframes marketplaceFloat': {
                  '0%, 100%': { transform: 'translateY(0) rotate(-4deg)' },
                  '50%': { transform: 'translateY(-16px) rotate(4deg)' },
                },
                '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
              }}>
                <Box component="img"
                  src={`${apiClient.defaults.baseURL}/catalogo/${p.empresa_slug}/productos/${p.id}/imagen?index=0`}
                  alt={p.nombre}
                  loading="lazy"
                  sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </Box>
              );
            })}
          </Box>

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
              <Tooltip title={isDark ? 'Modo claro' : 'Modo oscuro'}>
                <IconButton onClick={toggleMode} size="small" aria-label={isDark ? 'Modo claro' : 'Modo oscuro'} sx={{
                  color: 'text.secondary', bgcolor: 'action.hover', '&:hover': { bgcolor: 'action.selected' },
                }}>
                  {isDark ? <LightMode sx={{ fontSize: 18 }} /> : <DarkMode sx={{ fontSize: 18 }} />}
                </IconButton>
              </Tooltip>
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
                      <ProductResultCard key={`${p.empresa_slug}-${p.id}`} producto={p} apiBaseURL={apiClient.defaults.baseURL} onOpen={openStore} />
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
      </Box>
    </ThemeProvider>
  );
}
