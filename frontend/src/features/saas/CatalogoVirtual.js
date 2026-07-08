import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
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
  Favorite, FavoriteBorder, KeyboardArrowUp, FilterList,
  TableRestaurant, CheckCircle, EditNote, LocalShipping,
} from '@mui/icons-material';
import DarkMode from '@mui/icons-material/DarkMode';
import LightMode from '@mui/icons-material/LightMode';
import MenuItem from '@mui/material/MenuItem';
import apiClient from '../../api';
import { toast } from 'react-toastify';

// Inline SVG placeholder — no external dependency
const PLACEHOLDER_IMG = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400' viewBox='0 0 400 400'%3E%3Crect width='400' height='400' fill='%23f1f5f9'/%3E%3Ctext x='50%25' y='50%25' font-size='48' text-anchor='middle' dominant-baseline='middle' fill='%2394a3b8'%3E%F0%9F%93%B7%3C/text%3E%3C/svg%3E";

// Sin este tope, en monitores anchos el grid (columnas 1fr) reparte TODO el
// ancho del viewport entre las columnas — con pocos productos cada tarjeta
// termina ocupando 300-400px, gigante y desproporcionada frente al texto.
const CONTENT_MAX_WIDTH = 1360;

// Espejo de models.EstadoPedidoVirtual — usado por la consulta pública de
// estado de pedido (debe reflejar exactamente lo que ve el vendedor en
// Pedidos Virtuales).
const ESTADO_PEDIDO_LABEL = {
  nuevo:          'Recibido',
  confirmado:     'Confirmado',
  en_preparacion: 'En preparación',
  enviado:        'Enviado',
  entregado:      'Entregado',
  cancelado:      'Cancelado',
};

// localStorage keys are versioned (v1) so a future cart-shape change doesn't
// crash on old stored data; writes are best-effort (private-browsing/quota
// can throw synchronously and must never break the storefront).
const safeGetItem = (key) => {
  try { return localStorage.getItem(key); } catch { return null; }
};
const safeSetItem = (key, value) => {
  try { localStorage.setItem(key, value); } catch { /* quota/private-mode — ignore */ }
};

// ─── Product card (memoized) ─────────────────────────────────────────────
// Extracted from the grid render body so cart/favorite changes on one card
// don't force React to recreate & re-render every other card's component
// tree and its inline sx objects.
const ProductCard = React.memo(function ProductCard({
  producto: p, imageUrl, isFavorite, isAgotado: agotado, isNuevo, isOferta,
  isFlashing, inCartQty, accentColor, textPri, textSec, divClr, showStock,
  onOpen, onToggleFavorite, onAdd, onRemove, onNeedsVariant,
}) {
  // El stock solo tiene sentido para negocios que manejan inventario real
  // (no restaurantes, no servicios) — ver `esRestaurante`/`isAgotado` arriba.
  const mostrarStock = showStock && !agotado;
  const stockBajo = mostrarStock && p.stock > 0 && p.stock <= 5;
  return (
    <Card
      sx={{
        borderRadius: 3,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        boxShadow: isFlashing
          ? `0 0 0 3px #22c55e, 0 2px 12px rgba(34,197,94,0.25)`
          : '0 1px 3px rgba(0,0,0,0.06)',
        border: '1px solid',
        borderColor: isFlashing ? '#22c55e' : (agotado ? 'divider' : divClr),
        cursor: 'pointer',
        opacity: agotado ? 0.72 : 1,
        transform: isFlashing ? 'scale(1.08)' : 'scale(1)',
        transition: 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.3s ease, border-color 0.25s ease',
        '@media (hover: hover)': {
          '&:hover': {
            transform: isFlashing ? 'scale(1.08)' : 'translateY(-6px)',
            boxShadow: `0 16px 32px -12px ${accentColor}45, 0 4px 10px rgba(0,0,0,0.08)`,
            borderColor: agotado ? 'divider' : accentColor,
            '& .cvz-media': { transform: 'scale(1.09)' },
          },
        },
      }}
      onClick={() => onOpen(p)}
    >
      <Box sx={{ position: 'relative', overflow: 'hidden' }}>
        <CardMedia
          component="img"
          loading="lazy"
          decoding="async"
          className="cvz-media"
          sx={{
            aspectRatio: '1/1', objectFit: 'cover',
            filter: agotado ? 'grayscale(60%)' : 'none',
            transition: 'transform 0.5s cubic-bezier(0.22, 1, 0.36, 1)',
          }}
          image={imageUrl}
          alt={p.nombre}
        />
        <IconButton
          size="small"
          onClick={(e) => onToggleFavorite(p.id, e)}
          sx={{
            position: 'absolute', top: 8, right: 8,
            bgcolor: 'rgba(255,255,255,0.92)', width: 30, height: 30,
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            transition: 'transform 0.15s ease',
            '&:hover': { bgcolor: '#fff', transform: 'scale(1.1)' },
          }}
        >
          {isFavorite
            ? <Favorite sx={{ fontSize: 15, color: '#EF4444' }} />
            : <FavoriteBorder sx={{ fontSize: 15, color: '#94A3B8' }} />}
        </IconButton>

        {(isNuevo || isOferta) && (
          <Box sx={{ position: 'absolute', top: 8, left: 8, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {isNuevo && (
              <Box sx={{ bgcolor: '#0891B2', px: 1.1, py: 0.35, borderRadius: 1.5, boxShadow: '0 2px 6px rgba(0,0,0,0.2)' }}>
                <Typography sx={{ fontSize: 10, fontWeight: 800, color: '#fff', letterSpacing: 0.4 }}>NUEVO</Typography>
              </Box>
            )}
            {isOferta && (
              <Box sx={{ bgcolor: '#ef4444', px: 1.1, py: 0.35, borderRadius: 1.5, boxShadow: '0 2px 6px rgba(0,0,0,0.2)' }}>
                <Typography sx={{ fontSize: 10, fontWeight: 800, color: '#fff', letterSpacing: 0.4 }}>OFERTA</Typography>
              </Box>
            )}
          </Box>
        )}

        {agotado && (
          <Box sx={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            bgcolor: 'rgba(0,0,0,0.65)', py: 0.75, textAlign: 'center',
          }}>
            <Typography sx={{ fontSize: 11, fontWeight: 800, color: '#fff', letterSpacing: 0.6 }}>
              AGOTADO
            </Typography>
          </Box>
        )}
      </Box>

      <CardContent sx={{ p: '12px 14px 14px !important', flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
        <Typography sx={{
          fontWeight: 700,
          fontSize: 14,
          color: textPri,
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
          lineHeight: 1.35,
          mb: 0.75,
          minHeight: 38,
        }}>
          {p.nombre}
        </Typography>

        {isOferta && (
          <Typography sx={{ fontSize: 12, color: textSec, textDecoration: 'line-through', lineHeight: 1, mb: 0.3 }}>
            ${new Intl.NumberFormat('es-CO').format(p.precio_antes)}
          </Typography>
        )}
        <Typography sx={{
          fontWeight: 900,
          fontSize: 18,
          color: agotado ? 'text.disabled' : (isOferta ? '#ef4444' : accentColor),
          mb: mostrarStock ? 0.2 : 1,
        }}>
          ${new Intl.NumberFormat('es-CO').format(p.precio)}
        </Typography>

        {mostrarStock && (
          <Typography sx={{ fontSize: 11, fontWeight: 700, color: stockBajo ? '#F59E0B' : textSec, mb: 1 }}>
            {stockBajo ? `¡Quedan ${p.stock}!` : `${p.stock} disponibles`}
          </Typography>
        )}

        <Box onClick={(e) => e.stopPropagation()}>
          {agotado ? (
            <Box sx={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              bgcolor: 'action.disabledBackground', borderRadius: 2, py: '8px',
              cursor: 'not-allowed',
            }}>
              <Typography sx={{ fontSize: 12, fontWeight: 700, color: 'text.disabled' }}>Sin stock</Typography>
            </Box>
          ) : p.tiene_variantes ? (
            // Ambiguo mostrar +/- a nivel de producto cuando puede haber
            // varias variantes distintas en el carrito a la vez — siempre
            // se pasa por el selector de opciones.
            <Box
              onClick={() => onNeedsVariant(p)}
              sx={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                bgcolor: 'transparent', border: `1.5px solid ${accentColor}`, borderRadius: 2, py: '7px',
                cursor: 'pointer', gap: 0.6,
                transition: 'background-color 0.15s ease',
                '&:hover': { bgcolor: `${accentColor}12` },
              }}
            >
              <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: accentColor }}>Ver opciones</Typography>
            </Box>
          ) : inCartQty ? (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', bgcolor: 'action.hover', borderRadius: 2, px: 0.75, py: 0.5 }}>
              <IconButton size="small" onClick={() => onRemove(String(p.id))} sx={{ p: '4px', color: accentColor }}><Remove sx={{ fontSize: 16 }} /></IconButton>
              <Typography sx={{ fontWeight: 700, fontSize: 14 }}>{inCartQty}</Typography>
              <IconButton size="small" onClick={() => onAdd(p)} sx={{ p: '4px', color: accentColor }}><Add sx={{ fontSize: 16 }} /></IconButton>
            </Box>
          ) : (
            <Box
              onClick={() => onAdd(p)}
              sx={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                bgcolor: accentColor, borderRadius: 2, py: '8px',
                cursor: 'pointer', gap: 0.6,
                transition: 'transform 0.15s ease, filter 0.15s ease',
                '&:hover': { filter: 'brightness(1.08)' },
                '&:active': { transform: 'scale(0.96)' },
              }}
            >
              <Add sx={{ fontSize: 15, color: '#fff' }} />
              <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: '#fff' }}>Agregar</Typography>
            </Box>
          )}
        </Box>
      </CardContent>
    </Card>
  );
});

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
    safeGetItem(`cat_theme_${slug}`) || 'light'
  );
  const catTheme = useMemo(() => createTheme({
    palette: { mode: catMode },
    typography: {
      fontFamily: '"Nunito", "Inter", system-ui, -apple-system, sans-serif',
    },
  }), [catMode]);
  const isDark = catMode === 'dark';

  // Semantic color tokens
  const pageBg    = isDark ? '#0A0A0A' : '#F8FAFC';
  const paperBg   = isDark ? '#1F1F1F' : '#ffffff';
  const subtleBg  = isDark ? '#1A2332' : '#F1F5F9';
  const subtleHov = isDark ? '#263045' : '#E2E8F0';
  const textPri   = isDark ? '#F1F5F9' : '#1F1F1F';
  const textSec   = isDark ? '#94A3B8' : '#64748B';
  const borderClr = isDark ? '#334155' : '#E2E8F0';
  const divClr    = isDark ? '#334155' : '#F1F5F9';

  const toggleCatMode = () => {
    const next = catMode === 'light' ? 'dark' : 'light';
    setCatMode(next);
    safeSetItem(`cat_theme_${slug}`, next);
  };

  // ── Core state ────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [empresa, setEmpresa] = useState(null);
  const [mesas, setMesas] = useState([]);
  const [productos, setProductos] = useState([]);

  // Improvement #3: debounced search
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  const [categoria, setCategoria] = useState('Todas');
  const [cart, setCart] = useState(() => {
    const saved = safeGetItem(`cart_${slug}`);
    try { return saved ? JSON.parse(saved) : []; } catch { return []; }
  });
  const [cartOpen, setCartOpen] = useState(false);
  const [orderModalOpen, setOrderModalOpen] = useState(false);

  // Detalle de Producto
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [currentImgIndex, setCurrentImgIndex] = useState(0);
  const [dialogVariante, setDialogVariante] = useState(null);

  // Resetear la variante elegida cada vez que se abre un producto distinto —
  // si no, quedaría "pegada" la variante del producto anterior visto.
  useEffect(() => {
    if (selectedProduct?.tiene_variantes) {
      // El catálogo público ya solo envía variantes activas (filtradas en el
      // backend) — a diferencia del schema interno de administración, este
      // objeto nunca trae el campo `activo`.
      const activas = selectedProduct.variantes || [];
      setDialogVariante(activas.find(v => v.stock > 0) || activas[0] || null);
    } else {
      setDialogVariante(null);
    }
  }, [selectedProduct?.id]);

  // Improvement #2: touch swipe refs
  const touchStartXRef = useRef(null);

  // Formulario de Pedido (comercio)
  // Improvement #5: read from localStorage on mount
  const [nombre, setNombre] = useState(() => {
    try { const raw = safeGetItem(`cat_cliente_${slug}`); return raw ? JSON.parse(raw).nombre || '' : ''; } catch { return ''; }
  });
  const [celular, setCelular] = useState(() => {
    try { const raw = safeGetItem(`cat_cliente_${slug}`); return raw ? JSON.parse(raw).celular || '' : ''; } catch { return ''; }
  });
  const [tipoEntrega, setTipoEntrega] = useState('domicilio');
  const [direccion, setDireccion] = useState('');
  const [comentarios, setComentarios] = useState('');

  // Improvement #12: checkout steps
  const [checkoutStep, setCheckoutStep] = useState(1);
  // Errores de validación por campo — se activan solo tras un intento fallido
  // de avanzar/enviar, para resaltar visiblemente qué falta diligenciar
  // (el toast solo no bastaba: el usuario no sabía QUÉ campo corregir).
  const [checkoutErrors, setCheckoutErrors] = useState({});

  // Restaurante — notas por ítem y número de mesa
  const [itemNotas, setItemNotas] = useState({});
  const [mesaNumero, setMesaNumero] = useState('');
  const [mesaNotasOpen, setMesaNotasOpen] = useState(null);
  const [confirmedComanda, setConfirmedComanda] = useState(null);

  const [sortProductos, setSortProductos] = useState('');
  const [favoritos, setFavoritos] = useState(() => {
    try { return JSON.parse(safeGetItem(`favs_${slug}`) || '[]'); } catch { return []; }
  });
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [orderSent, setOrderSent] = useState(false);
  const [confirmedPedido, setConfirmedPedido] = useState(null);
  const [terminosOpen, setTerminosOpen] = useState(false);

  // Consulta pública de estado de pedido (número + celular)
  const [trackOpen, setTrackOpen] = useState(false);
  const [trackNumero, setTrackNumero] = useState('');
  const [trackCelular, setTrackCelular] = useState('');
  const [trackLoading, setTrackLoading] = useState(false);
  const [trackResult, setTrackResult] = useState(null);
  const [trackError, setTrackError] = useState('');

  // Improvement #6: add-to-cart flash animation
  const [flashId, setFlashId] = useState(null);

  // Improvement #14: "¡Agregado!" text flash
  const [addedFlash, setAddedFlash] = useState(false);

  // Improvement #10: collapsible header on scroll
  const [scrollY, setScrollY] = useState(0);
  const headerCollapsed = scrollY > 80;

  // ── Effects ──────────────────────────────────────────────────────────

  useEffect(() => { if (slug) fetchData(); }, [slug]);

  useEffect(() => {
    safeSetItem(`cart_${slug}`, JSON.stringify(cart));
  }, [cart, slug]);

  useEffect(() => {
    safeSetItem(`favs_${slug}`, JSON.stringify(favoritos));
  }, [favoritos, slug]);

  // Improvement #3: debounce search 300ms
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Improvement #5: save customer data to localStorage
  useEffect(() => {
    if (nombre || celular) {
      safeSetItem(`cat_cliente_${slug}`, JSON.stringify({ nombre, celular }));
    }
  }, [nombre, celular, slug]);

  // Scroll tracking for collapsible header (#10) and scroll-to-top (#existing)
  useEffect(() => {
    const handleScroll = () => {
      const y = window.scrollY;
      setScrollY(y);
      setShowScrollTop(y > 350);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // ── Data fetching ─────────────────────────────────────────────────────
  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get(`/catalogo/${slug}`);
      setEmpresa(res.data.empresa);
      setProductos(res.data.productos);
      setMesas(res.data.mesas || []);
      document.title = `${res.data.empresa.nombre} - ${res.data.empresa.tipo_negocio === 'restaurante' ? 'Menú Digital' : 'Catálogo Virtual'}`;

      // Reconciliar el carrito guardado (puede tener días) contra el catálogo
      // recién cargado: descartar productos que ya no están visibles/agotados
      // y actualizar el precio si cambió, para no enviar un pedido con datos
      // obsoletos (el backend igual recalcula el precio, pero el cliente debe
      // ver el total real antes de confirmar).
      setCart(prevCart => {
        if (prevCart.length === 0) return prevCart;
        const vigentes = new Map(res.data.productos.map(p => [p.id, p]));
        let changed = false;
        const reconciliado = [];
        for (const item of prevCart) {
          const actual = vigentes.get(item.id);
          if (!actual) { changed = true; continue; }

          // Si el ítem es una variante, la validación de precio/stock es
          // contra ESA variante (que puede haberse desactivado o agotado
          // independientemente del resto del producto), no contra el padre.
          let precioVigente = actual.precio;
          let stockVigente = actual.stock;
          if (item.varianteId) {
            // El catálogo público ya solo lista variantes activas — si no
            // aparece aquí es porque se desactivó o eliminó.
            const variante = (actual.variantes || []).find(v => v.id === item.varianteId);
            if (!variante) { changed = true; continue; }
            precioVigente = variante.precio != null ? variante.precio : actual.precio;
            stockVigente = variante.stock;
          }
          if (!actual.es_servicio && stockVigente <= 0) { changed = true; continue; }

          if (precioVigente !== item.precio || actual.nombre !== item.nombre) {
            changed = true;
            reconciliado.push({ ...item, nombre: actual.nombre, image_count: actual.image_count, precio: precioVigente, stock: stockVigente });
          } else {
            reconciliado.push(item);
          }
        }
        if (changed) {
          toast.info('Actualizamos tu carrito: algunos precios o productos cambiaron desde tu última visita.');
        }
        return changed ? reconciliado : prevCart;
      });
    } catch (error) {
      if (error.response?.status === 404) {
        toast.error("Catálogo no encontrado o inactivo.");
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Derived data ──────────────────────────────────────────────────────
  const categorias = useMemo(() => {
    const cats = new Set(productos.map(p => p.categoria));
    return ['Todas', ...Array.from(cats)];
  }, [productos]);

  const categoryCounts = useMemo(() => {
    const counts = {};
    productos.forEach(p => { counts[p.categoria] = (counts[p.categoria] || 0) + 1; });
    return counts;
  }, [productos]);

  // Improvement #7: badge logic — newest 3 by id desc
  const newestIds = useMemo(() => {
    const sorted = [...productos].sort((a, b) => b.id - a.id);
    return new Set(sorted.slice(0, 3).map(p => p.id));
  }, [productos]);

  const filteredProductos = useMemo(() => {
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

  // En restaurantes los productos se preparan en cocina (no manejan stock real),
  // por lo que nunca deben marcarse como agotados ni bloquear el pedido.
  const esRestaurante = empresa?.tipo_negocio === 'restaurante';
  // `variante` opcional: para productos con variantes el stock/agotado real
  // es el de la variante elegida, no el (obsoleto) del producto padre.
  const isAgotado = (p, variante) => {
    if (esRestaurante || p.es_servicio) return false;
    if (variante) return (variante.stock ?? 0) <= 0;
    if (p.tiene_variantes) return (p.variantes || []).every(v => (v.stock ?? 0) <= 0);
    return p.stock <= 0;
  };

  // Los productos con variantes se identifican en el carrito por
  // `producto.id:variante.id` — un mismo producto puede tener varias
  // variantes distintas agregadas a la vez.
  const cartKey = (productoId, varianteId) => varianteId ? `${productoId}:${varianteId}` : String(productoId);

  // ── Cart actions ──────────────────────────────────────────────────────
  const addToCart = useCallback((producto, variante) => {
    if (isAgotado(producto, variante)) return;
    const key = cartKey(producto.id, variante?.id);
    setCart(prev => {
      const existing = prev.find(item => item.cartId === key);
      if (existing) {
        return prev.map(item => item.cartId === key ? { ...item, quantity: item.quantity + 1 } : item);
      }
      const precio = variante?.precio != null ? variante.precio : producto.precio;
      const stock = variante ? variante.stock : producto.stock;
      return [...prev, {
        ...producto,
        precio, stock,
        cartId: key,
        varianteId: variante?.id || null,
        nombreVariante: variante?.nombre || null,
        quantity: 1,
      }];
    });
    // Improvement #6: flash card border
    setFlashId(producto.id);
    setTimeout(() => setFlashId(null), 600);
    // Improvement #14: "¡Agregado!" text
    setAddedFlash(true);
    setTimeout(() => setAddedFlash(false), 1000);
  }, [esRestaurante]);

  const removeFromCart = (key) => {
    setCart(prev => {
      const existing = prev.find(item => item.cartId === key);
      if (!existing) return prev;
      if (existing.quantity === 1) {
        return prev.filter(item => item.cartId !== key);
      }
      return prev.map(item => item.cartId === key ? { ...item, quantity: item.quantity - 1 } : item);
    });
  };

  const toggleFavorito = (id, e) => {
    e.stopPropagation();
    setFavoritos(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const cartTotal = cart.reduce((sum, item) => sum + (item.precio * item.quantity), 0);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  // ── Touch swipe handlers (Improvement #2) ────────────────────────────
  const handleTouchStart = (e) => {
    touchStartXRef.current = e.touches[0].clientX;
  };
  const handleTouchMove = (e) => {
    // prevent default only if horizontal swipe detected — keep passive
  };
  const handleTouchEnd = (e) => {
    if (touchStartXRef.current === null || !selectedProduct) return;
    const deltaX = e.changedTouches[0].clientX - touchStartXRef.current;
    touchStartXRef.current = null;
    if (Math.abs(deltaX) < 50) return;
    if (deltaX < 0) {
      // swipe left → next
      setCurrentImgIndex(prev => (prev < selectedProduct.image_count - 1 ? prev + 1 : 0));
    } else {
      // swipe right → prev
      setCurrentImgIndex(prev => (prev > 0 ? prev - 1 : selectedProduct.image_count - 1));
    }
  };

  // ── Flujo COMERCIO — WhatsApp ─────────────────────────────────────────
  const handleSendOrder = async () => {
    if (!nombre || !celular) {
      setCheckoutStep(1);
      setCheckoutErrors({ nombre: !nombre, celular: !celular });
      toast.warning("Falta diligenciar tu nombre y/o celular");
      return;
    }
    if (tipoEntrega === 'domicilio' && !direccion) {
      setCheckoutErrors({ direccion: true });
      toast.warning("La dirección es obligatoria para domicilios");
      return;
    }
    setCheckoutErrors({});

    try {
      const payload = {
        nombre_cliente:    nombre,
        celular_cliente:   celular,
        tipo_entrega:      tipoEntrega,
        direccion_entrega: tipoEntrega === 'domicilio' ? direccion : null,
        comentarios:       comentarios || null,
        detalles: cart.map(item => ({
          producto_id:     item.id,
          cantidad:        item.quantity,
          precio_unitario: item.precio,
          variante_id:     item.varianteId || undefined,
        })),
      };
      const res = await apiClient.post(`/catalogo/${slug}/pedido`, payload);
      setConfirmedPedido(res.data);
    } catch (err) {
      const detail = err?.response?.data?.detail;
      const status = err?.response?.status;
      const msg = typeof detail === 'string' ? detail : (typeof detail === 'object' ? JSON.stringify(detail) : 'No se pudo registrar el pedido.');
      console.error('[Catalogo] Error al guardar pedido:', status, detail, err);
      toast.error(`⚠️ ${msg}`, { autoClose: 10000 });
      return;
    }

    setOrderSent(true);
    setTimeout(() => {
      setOrderSent(false);
      setConfirmedPedido(null);
      setCart([]);
      setOrderModalOpen(false);
      setCartOpen(false);
      setCheckoutStep(1);
      setCheckoutErrors({});
    }, 4500);
  };

  // ── Consulta pública de estado de pedido ─────────────────────────────
  const handleTrackSubmit = async () => {
    if (!trackNumero || !trackCelular) {
      setTrackError('Ingresa el número de pedido y el celular.');
      return;
    }
    setTrackLoading(true);
    setTrackError('');
    setTrackResult(null);
    try {
      const res = await apiClient.get(`/catalogo/${slug}/pedido/estado`, {
        params: { numero_pedido: trackNumero, celular_cliente: trackCelular },
      });
      setTrackResult(res.data);
    } catch (err) {
      setTrackError(err?.response?.data?.detail || 'No encontramos un pedido con esos datos.');
    } finally {
      setTrackLoading(false);
    }
  };

  // ── Flujo RESTAURANTE — directo a cocina ─────────────────────────────
  const handleSendOrderRestaurante = async () => {
    if (!mesaNumero.trim()) {
      setCheckoutErrors({ mesa: true });
      toast.warning("Indica el número de tu mesa para continuar");
      return;
    }
    setCheckoutErrors({});
    try {
      const res = await apiClient.post(`/catalogo/${slug}/pedido-restaurante`, {
        mesa_numero: mesaNumero.trim(),
        items: cart.map(item => ({
          producto_id:     item.id,
          nombre_producto: item.nombreVariante ? `${item.nombre} (${item.nombreVariante})` : item.nombre,
          cantidad:        item.quantity,
          precio_unitario: item.precio,
          notas:           itemNotas[item.id] || null,
          variante_id:     item.varianteId || undefined,
        })),
      });
      setConfirmedComanda(res.data);
      setOrderSent(true);
      setTimeout(() => {
        setOrderSent(false);
        setCart([]);
        setItemNotas({});
        setMesaNumero('');
        setOrderModalOpen(false);
        setCartOpen(false);
        setConfirmedComanda(null);
      }, 4000);
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'No se pudo enviar el pedido a cocina');
    }
  };

  // ── Loading skeleton ──────────────────────────────────────────────────
  if (loading) return (
    <ThemeProvider theme={catTheme}>
      <Box sx={{ bgcolor: pageBg, color: textPri, minHeight: '100vh' }}>
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
              <Grid size={{ xs: 6, sm: 4, md: 3 }} key={i}>
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

  if (!empresa) return (
    <Box sx={{ p: 5, textAlign: 'center', color: 'text.primary' }}>
      <Typography variant="h5">Catálogo no disponible</Typography>
    </Box>
  );

  const accentColor = empresa.color_primario || '#0891B2';

  return (
    <ThemeProvider theme={catTheme}>
      <Box sx={{ bgcolor: pageBg, color: textPri, minHeight: '100vh', pb: cartCount > 0 ? 14 : 10 }}>

        {/* ── HEADER (Improvement #10: collapsible on scroll) ─────────── */}
        <Box sx={{
          bgcolor: isDark ? 'rgba(15,15,15,0.85)' : 'rgba(255,255,255,0.85)',
          backdropFilter: 'blur(10px)',
          px: 2,
          pt: headerCollapsed ? 1 : 3,
          pb: headerCollapsed ? 1 : 2,
          boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
          position: 'sticky',
          top: 0,
          zIndex: 100,
          transition: 'padding 0.3s ease',
        }}>
        <Box sx={{ maxWidth: CONTENT_MAX_WIDTH, mx: 'auto' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: headerCollapsed ? 1 : 2 }}>
            {empresa.logo_base64 ? (
              <Avatar
                src={empresa.logo_base64}
                variant="rounded"
                sx={{
                  width: headerCollapsed ? 36 : 50,
                  height: headerCollapsed ? 36 : 50,
                  transition: 'width 0.3s, height 0.3s',
                }}
              />
            ) : (
              <Avatar
                sx={{
                  bgcolor: accentColor,
                  width: headerCollapsed ? 36 : 50,
                  height: headerCollapsed ? 36 : 50,
                  transition: 'width 0.3s, height 0.3s',
                }}
                variant="rounded"
              >
                <Storefront />
              </Avatar>
            )}
            <Box sx={{ flexGrow: 1, minWidth: 0, overflow: 'hidden' }}>
              <Typography sx={{
                fontWeight: 800,
                fontSize: { xs: headerCollapsed ? 13 : 15, sm: headerCollapsed ? 15 : 18 },
                color: textPri,
                lineHeight: 1.2,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                transition: 'font-size 0.3s',
              }}>
                {empresa.nombre}
              </Typography>
              {/* Description hidden when collapsed */}
              {!headerCollapsed && (
                empresa.descripcion ? (
                  <Typography sx={{ fontSize: 11, color: textSec, mt: 0.2, lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {empresa.descripcion}
                  </Typography>
                ) : (
                  <Typography sx={{ fontSize: 11, color: textSec, mt: 0.2 }}>
                    {empresa?.tipo_negocio === 'restaurante' ? 'Menú Digital' : 'Catálogo Virtual'}
                  </Typography>
                )
              )}
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
              <Tooltip title="Rastrear pedido">
                <IconButton
                  onClick={() => { setTrackResult(null); setTrackError(''); setTrackOpen(true); }}
                  size="small"
                  sx={{
                    color: textSec,
                    bgcolor: subtleBg,
                    '&:hover': { bgcolor: subtleHov },
                    width: 30, height: 30,
                  }}
                >
                  <LocalShipping sx={{ fontSize: 15 }} />
                </IconButton>
              </Tooltip>

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
                href="https://www.techstackcol.com/ksmart360?view=pymes"
                target="_blank"
                rel="noopener noreferrer"
                sx={{
                  fontSize: 9, color: '#94A3B8', textDecoration: 'none', whiteSpace: 'nowrap',
                  fontWeight: 700, letterSpacing: 0.2,
                  '&:hover': { color: '#0891B2' }, transition: 'color 0.2s',
                  display: { xs: 'none', sm: 'block' },
                }}
              >
                Powered by Ksmart360
              </Typography>
            </Box>
          </Box>

          {/* Improvement #3: searchInput state for immediate value, search debounced */}
          <TextField
            fullWidth
            size="small"
            placeholder={`¿Qué buscas en ${empresa?.nombre || 'la tienda'}?`}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            sx={{ mb: 2, '& .MuiOutlinedInput-root': { borderRadius: 3, bgcolor: subtleBg } }}
            InputProps={{
              startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment>
            }}
          />

          {/* Filtro Categorías */}
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
        </Box>

        {/* Products count + sort */}
        <Box sx={{ maxWidth: CONTENT_MAX_WIDTH, mx: 'auto', px: 2, pt: 2, pb: 0.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
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

        {/* ── PRODUCTOS GRID (Improvement #1: 2 cols on xs) ───────────── */}
        <Box sx={{ maxWidth: CONTENT_MAX_WIDTH, mx: 'auto', px: 1, pb: 2, pt: 1 }}>
          <Box sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: 'repeat(2, 1fr)',
              sm: 'repeat(3, 1fr)',
              md: 'repeat(4, 1fr)',
              lg: 'repeat(5, 1fr)',
              xl: 'repeat(6, 1fr)',
            },
            gap: { xs: '10px', sm: '14px', md: '18px' },
          }}>
            {filteredProductos.map(p => (
              <ProductCard
                key={p.id}
                producto={p}
                imageUrl={p.image_count > 0
                  ? `${apiClient.defaults.baseURL}/catalogo/${slug}/productos/${p.id}/imagen?index=0`
                  : PLACEHOLDER_IMG}
                isFavorite={favoritos.includes(p.id)}
                isAgotado={isAgotado(p)}
                isNuevo={p.es_nuevo || newestIds.has(p.id)}
                isOferta={Boolean(p.precio_antes && p.precio_antes > p.precio)}
                isFlashing={flashId === p.id}
                inCartQty={cart.find(item => item.cartId === String(p.id))?.quantity || 0}
                accentColor={accentColor}
                textPri={textPri}
                textSec={textSec}
                divClr={divClr}
                showStock={!esRestaurante && !p.es_servicio}
                onOpen={(prod) => { setSelectedProduct(prod); setCurrentImgIndex(0); }}
                onToggleFavorite={toggleFavorito}
                onAdd={addToCart}
                onRemove={removeFromCart}
                onNeedsVariant={(prod) => { setSelectedProduct(prod); setCurrentImgIndex(0); }}
              />
            ))}
          </Box>

          {filteredProductos.length === 0 && (
            <Box sx={{ textAlign: 'center', py: 8, px: 2 }}>
              <Typography sx={{ fontSize: 56, mb: 2, lineHeight: 1 }}>
                {productos.length === 0 ? '🏪' : '🔍'}
              </Typography>
              <Typography sx={{ fontWeight: 800, fontSize: 18, color: textPri, mb: 1 }}>
                {productos.length === 0
                  ? `${empresa?.nombre || 'Esta tienda'} aún no tiene productos publicados`
                  : search
                    ? `Sin resultados para "${search}"`
                    : `Sin productos en ${categoria !== 'Todas' ? categoria : 'el catálogo'}`}
              </Typography>
              <Typography sx={{ color: textSec, mb: 3, fontSize: 14 }}>
                {productos.length === 0
                  ? 'Vuelve pronto — el catálogo se está preparando.'
                  : 'Intenta con otro término o explora otra categoría'}
              </Typography>
              {productos.length > 0 && (search || categoria !== 'Todas') && (
                <Button
                  variant="outlined"
                  onClick={() => { setSearchInput(''); setSearch(''); setCategoria('Todas'); setSortProductos(''); }}
                  sx={{ borderRadius: 3, fontWeight: 700 }}
                >
                  Ver todos los productos
                </Button>
              )}
            </Box>
          )}
        </Box>

        {/* ── DETALLE DE PRODUCTO ─────────────────────────────────────── */}
        <Dialog
          open={Boolean(selectedProduct)}
          onClose={() => setSelectedProduct(null)}
          fullWidth
          maxWidth="sm"
          PaperProps={{ sx: isMobile ? { borderRadius: '24px 24px 0 0', mt: 'auto', mb: 0 } : { borderRadius: 4 } }}
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

                {/* Improvement #2: touch swipe on gallery */}
                <Box
                  sx={{ width: '100%', aspectRatio: '1/1', bgcolor: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}
                  onTouchStart={handleTouchStart}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleTouchEnd}
                >
                  <img
                    src={selectedProduct.image_count > 0
                      ? `${apiClient.defaults.baseURL}/catalogo/${slug}/productos/${selectedProduct.id}/imagen?index=${currentImgIndex}`
                      : PLACEHOLDER_IMG}
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
                          <Box
                            key={i}
                            onClick={() => setCurrentImgIndex(i)}
                            sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: i === currentImgIndex ? accentColor : 'rgba(255,255,255,0.5)', transition: 'all 0.2s', cursor: 'pointer' }}
                          />
                        ))}
                      </Box>
                    </>
                  )}
                </Box>

                {/* Improvement #8: thumbnail strip */}
                {selectedProduct.image_count > 1 && (
                  <Box sx={{
                    display: 'flex',
                    gap: 1,
                    p: 1.5,
                    overflowX: 'auto',
                    bgcolor: paperBg,
                    '&::-webkit-scrollbar': { display: 'none' },
                  }}>
                    {[...Array(selectedProduct.image_count)].map((_, i) => (
                      <Box
                        key={i}
                        onClick={() => setCurrentImgIndex(i)}
                        sx={{
                          width: 48,
                          height: 48,
                          flexShrink: 0,
                          borderRadius: 1.5,
                          overflow: 'hidden',
                          border: '2px solid',
                          borderColor: i === currentImgIndex ? accentColor : borderClr,
                          cursor: 'pointer',
                          transition: 'border-color 0.15s',
                        }}
                      >
                        <img
                          src={`${apiClient.defaults.baseURL}/catalogo/${slug}/productos/${selectedProduct.id}/imagen?index=${i}`}
                          alt={`${selectedProduct.nombre} ${i + 1}`}
                          loading="lazy"
                          decoding="async"
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      </Box>
                    ))}
                  </Box>
                )}
              </Box>

              <DialogContent sx={{ p: 3 }}>
                <Chip label={selectedProduct.categoria} size="small" sx={{ mb: 1, fontWeight: 700, bgcolor: `${accentColor}15`, color: accentColor }} />
                <Typography variant="h5" sx={{ fontWeight: 800, mb: 1 }}>{selectedProduct.nombre}</Typography>

                {/* Improvement #7: oferta price in detail */}
                {selectedProduct.precio_antes && selectedProduct.precio_antes > selectedProduct.precio && (
                  <Typography sx={{ fontSize: 14, color: textSec, textDecoration: 'line-through', mb: 0.3 }}>
                    ${new Intl.NumberFormat('es-CO').format(selectedProduct.precio_antes)}
                  </Typography>
                )}
                <Typography variant="h4" sx={{ fontWeight: 800, color: accentColor, mb: 1 }}>
                  ${new Intl.NumberFormat('es-CO').format(
                    dialogVariante?.precio != null ? dialogVariante.precio : selectedProduct.precio
                  )}
                </Typography>

                {!esRestaurante && !selectedProduct.es_servicio && !selectedProduct.tiene_variantes && !isAgotado(selectedProduct) && (
                  <Typography sx={{
                    fontSize: 12.5, fontWeight: 700, mb: 3,
                    color: selectedProduct.stock <= 5 ? '#F59E0B' : textSec,
                  }}>
                    {selectedProduct.stock <= 5
                      ? `¡Quedan solo ${selectedProduct.stock} unidades!`
                      : `${selectedProduct.stock} unidades disponibles`}
                  </Typography>
                )}

                {/* Selector de variantes (talla/color/etc.) ─────────────── */}
                {selectedProduct.tiene_variantes && (
                  <Box sx={{ mb: 3 }}>
                    <Typography sx={{ fontWeight: 700, fontSize: 13, mb: 1, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      Elige una opción
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                      {(selectedProduct.variantes || []).map(v => {
                        const elegida = dialogVariante?.id === v.id;
                        const sinStock = !esRestaurante && (v.stock ?? 0) <= 0;
                        return (
                          <Box
                            key={v.id}
                            onClick={() => !sinStock && setDialogVariante(v)}
                            sx={{
                              px: 1.5, py: 0.9, borderRadius: 2.5, cursor: sinStock ? 'not-allowed' : 'pointer',
                              border: '2px solid', borderColor: elegida ? accentColor : borderClr,
                              bgcolor: elegida ? `${accentColor}10` : 'transparent',
                              opacity: sinStock ? 0.45 : 1,
                              transition: 'all 0.15s',
                            }}
                          >
                            <Typography sx={{ fontSize: 13, fontWeight: 700, color: elegida ? accentColor : textPri }}>
                              {v.nombre}
                            </Typography>
                            {sinStock && (
                              <Typography sx={{ fontSize: 10, color: '#EF4444', fontWeight: 700 }}>Sin stock</Typography>
                            )}
                          </Box>
                        );
                      })}
                    </Box>
                    {!esRestaurante && dialogVariante && (
                      <Typography sx={{
                        fontSize: 12, fontWeight: 700, mt: 1,
                        color: dialogVariante.stock <= 5 ? '#F59E0B' : textSec,
                      }}>
                        {dialogVariante.stock <= 5
                          ? `¡Quedan solo ${dialogVariante.stock} unidades!`
                          : `${dialogVariante.stock} unidades disponibles`}
                      </Typography>
                    )}
                  </Box>
                )}

                {selectedProduct.descripcion && (
                  <Box sx={{ mb: 3 }}>
                    <Typography sx={{ fontWeight: 700, fontSize: 14, mb: 0.5, color: 'text.secondary' }}>Descripción</Typography>
                    <Typography sx={{ color: 'text.primary', whiteSpace: 'pre-line' }}>{selectedProduct.descripcion}</Typography>
                  </Box>
                )}
              </DialogContent>

              {/* Improvement #9: +/- in dialog when already in cart */}
              <DialogActions sx={{ p: 3, pt: 0 }}>
                {selectedProduct.tiene_variantes && !dialogVariante ? (
                  <Button fullWidth variant="outlined" size="large" disabled
                    sx={{ borderRadius: 3, py: 1.5, fontWeight: 800 }}
                  >
                    Selecciona una opción
                  </Button>
                ) : isAgotado(selectedProduct, dialogVariante) ? (
                  <Button fullWidth variant="outlined" size="large" disabled
                    sx={{ borderRadius: 3, py: 1.5, fontWeight: 800 }}
                  >
                    Producto Agotado
                  </Button>
                ) : (() => {
                  const key = cartKey(selectedProduct.id, dialogVariante?.id);
                  const inCartItem = cart.find(item => item.cartId === key);
                  if (inCartItem) {
                    return (
                      <Box sx={{ width: '100%', display: 'flex', gap: 1.5, alignItems: 'center' }}>
                        <Box sx={{
                          display: 'flex', alignItems: 'center', gap: 1,
                          bgcolor: subtleBg, borderRadius: 3, px: 1.5, py: 1,
                          flex: 1, justifyContent: 'center',
                        }}>
                          <IconButton
                            size="small"
                            onClick={() => removeFromCart(key)}
                            sx={{ bgcolor: paperBg, color: accentColor, '&:hover': { bgcolor: subtleHov } }}
                          >
                            <Remove />
                          </IconButton>
                          <Typography sx={{ fontWeight: 800, fontSize: 18, minWidth: 28, textAlign: 'center' }}>
                            {inCartItem.quantity}
                          </Typography>
                          <IconButton
                            size="small"
                            onClick={() => addToCart(selectedProduct, dialogVariante)}
                            sx={{ bgcolor: paperBg, color: accentColor, '&:hover': { bgcolor: subtleHov } }}
                          >
                            <Add />
                          </IconButton>
                        </Box>
                        <Button
                          variant="contained"
                          size="large"
                          onClick={() => setSelectedProduct(null)}
                          sx={{ bgcolor: accentColor, borderRadius: 3, py: 1.5, fontWeight: 800, flex: 1, '&:hover': { bgcolor: accentColor, opacity: 0.9 } }}
                        >
                          Listo ✓
                        </Button>
                      </Box>
                    );
                  }
                  return (
                    <Button
                      fullWidth variant="contained" size="large"
                      startIcon={<ShoppingCart />}
                      onClick={() => { addToCart(selectedProduct, dialogVariante); setSelectedProduct(null); }}
                      sx={{ bgcolor: accentColor, borderRadius: 3, py: 1.5, fontWeight: 800, '&:hover': { bgcolor: accentColor, opacity: 0.9 } }}
                    >
                      Agregar al Carrito
                    </Button>
                  );
                })()}
              </DialogActions>
            </>
          )}
        </Dialog>

        {/* ── BANNER PROMOCIONAL — usa el accentColor del negocio para no chocar con su marca ── */}
        <Box sx={{ maxWidth: CONTENT_MAX_WIDTH, mx: 'auto', px: 2, py: 1.5 }}>
          <Box sx={{
            display: 'flex', alignItems: 'center', gap: 1.5,
            p: '10px 14px', borderRadius: 2.5,
            background: isDark
              ? 'rgba(255,255,255,0.04)'
              : 'linear-gradient(120deg, #1F1F1F 0%, #0A0A0A 100%)',
            border: isDark ? '1px solid rgba(255,255,255,0.06)' : 'none',
          }}>
            <Box sx={{
              width: 30, height: 30, borderRadius: 1.5, flexShrink: 0,
              bgcolor: accentColor, display: 'flex', alignItems: 'center', justifyContent: 'center',
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
              href="https://www.techstackcol.com/ksmart360?view=pymes"
              target="_blank"
              rel="noopener noreferrer"
              variant="contained"
              size="small"
              endIcon={<ArrowForward sx={{ fontSize: 11 }} />}
              sx={{
                bgcolor: accentColor, borderRadius: 2, fontWeight: 700,
                fontSize: 11, textTransform: 'none', px: 1.5, py: 0.5,
                minWidth: 'auto', flexShrink: 0, boxShadow: 'none',
                '&:hover': { bgcolor: accentColor, opacity: 0.85, boxShadow: `0 4px 12px ${accentColor}4D` },
              }}
            >
              Gratis
            </Button>
          </Box>
        </Box>

        {/* Improvement #11: Sticky bottom bar with total */}
        {cartCount > 0 && (
          <Box
            onClick={() => setCartOpen(true)}
            sx={{
              position: 'fixed',
              bottom: 0,
              left: 0,
              right: 0,
              height: 56,
              bgcolor: accentColor,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 1.5,
              cursor: 'pointer',
              zIndex: 200,
              boxShadow: '0 -4px 20px rgba(0,0,0,0.18)',
              px: 2,
            }}
          >
            <ShoppingBag sx={{ color: '#fff', fontSize: 20 }} />
            <Typography sx={{ fontWeight: 800, fontSize: 14, color: '#fff' }}>
              {addedFlash
                ? '¡Agregado! 🎉'
                : `${cartCount} ${cartCount === 1 ? 'producto' : 'productos'} • $${new Intl.NumberFormat('es-CO').format(cartTotal)} • Ver pedido →`}
            </Typography>
          </Box>
        )}

        {/* Scroll to Top */}
        {showScrollTop && (
          <Zoom in={showScrollTop}>
            <Fab
              size="small"
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              sx={{
                position: 'fixed',
                bottom: cartCount > 0 ? 72 : 24,
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

        {/* ── DRAWER DEL CARRITO ──────────────────────────────────────── */}
        <Drawer
          anchor={isMobile ? 'bottom' : 'right'}
          open={cartOpen}
          onClose={() => setCartOpen(false)}
          PaperProps={{
            sx: {
              width: isMobile ? '100%' : 400,
              maxHeight: isMobile ? '90vh' : '100vh',
              borderRadius: isMobile ? '24px 24px 0 0' : 0,
              overflow: 'hidden',
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
                <ListItem key={item.cartId} sx={{ px: 0, py: 1.5, flexDirection: 'column', alignItems: 'stretch' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Avatar
                      variant="rounded"
                      src={item.image_count > 0 ? `${apiClient.defaults.baseURL}/catalogo/${slug}/productos/${item.id}/imagen?index=0` : null}
                      sx={{ bgcolor: subtleBg, color: '#94A3B8', width: 44, height: 44, flexShrink: 0 }}
                    >
                      <ShoppingBag />
                    </Avatar>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontWeight: 700, fontSize: 13, lineHeight: 1.3 }}>
                        {item.nombre}{item.nombreVariante ? ` · ${item.nombreVariante}` : ''}
                      </Typography>
                      <Typography sx={{ color: accentColor, fontWeight: 700, fontSize: 12 }}>
                        ${new Intl.NumberFormat('es-CO').format(item.precio)} c/u · Sub: ${new Intl.NumberFormat('es-CO').format(item.precio * item.quantity)}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, bgcolor: subtleBg, borderRadius: 2, p: 0.5, flexShrink: 0 }}>
                      <IconButton size="small" onClick={() => removeFromCart(item.cartId)} sx={{ bgcolor: paperBg, color: accentColor, p: '3px' }}><Remove sx={{ fontSize: 14 }} /></IconButton>
                      <Typography sx={{ fontWeight: 700, fontSize: 13, minWidth: 16, textAlign: 'center' }}>{item.quantity}</Typography>
                      <IconButton size="small" onClick={() => addToCart(item, item.varianteId ? { id: item.varianteId, nombre: item.nombreVariante, precio: item.precio, stock: item.stock } : undefined)} sx={{ bgcolor: paperBg, color: accentColor, p: '3px' }}><Add sx={{ fontSize: 14 }} /></IconButton>
                    </Box>
                  </Box>

                  {/* Notas por ítem — solo restaurantes */}
                  {empresa?.tipo_negocio === 'restaurante' && (
                    <Box sx={{ mt: 0.8 }}>
                      {mesaNotasOpen === item.id ? (
                        <TextField
                          size="small"
                          fullWidth
                          autoFocus
                          placeholder="Ej: sin cebolla, extra salsa..."
                          value={itemNotas[item.id] || ''}
                          onChange={e => setItemNotas(prev => ({ ...prev, [item.id]: e.target.value }))}
                          onBlur={() => setMesaNotasOpen(null)}
                          sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2, fontSize: 12 } }}
                          InputProps={{
                            endAdornment: (
                              <IconButton size="small" onClick={() => setMesaNotasOpen(null)} sx={{ p: 0.3 }}>
                                <Close sx={{ fontSize: 14 }} />
                              </IconButton>
                            )
                          }}
                        />
                      ) : (
                        <Box
                          onClick={() => setMesaNotasOpen(item.id)}
                          sx={{
                            display: 'flex', alignItems: 'center', gap: 0.6,
                            cursor: 'pointer', px: 1, py: 0.4, borderRadius: 1.5,
                            border: `1px dashed ${itemNotas[item.id] ? accentColor : borderClr}`,
                            bgcolor: itemNotas[item.id] ? `${accentColor}08` : 'transparent',
                            '&:hover': { bgcolor: `${accentColor}06` },
                          }}
                        >
                          <EditNote sx={{ fontSize: 13, color: itemNotas[item.id] ? accentColor : textSec }} />
                          <Typography sx={{ fontSize: 11, color: itemNotas[item.id] ? accentColor : textSec, fontStyle: itemNotas[item.id] ? 'normal' : 'italic' }}>
                            {itemNotas[item.id] || 'Agregar nota (opcional)'}
                          </Typography>
                        </Box>
                      )}
                    </Box>
                  )}
                  <Divider sx={{ mt: 1.5 }} />
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
              endIcon={empresa?.tipo_negocio === 'restaurante' ? <TableRestaurant /> : <ArrowForward />}
              onClick={() => { setOrderModalOpen(true); setCheckoutStep(1); setCheckoutErrors({}); }}
              sx={{ bgcolor: accentColor, borderRadius: 3, py: 1.5, fontWeight: 700, '&:hover': { bgcolor: accentColor, opacity: 0.9 } }}
            >
              {empresa?.tipo_negocio === 'restaurante' ? 'Pedir a cocina' : 'Siguiente'}
            </Button>
          </Box>
        </Drawer>

        {/* ── DIALOG DE PEDIDO ────────────────────────────────────────── */}
        <Dialog
          open={orderModalOpen}
          onClose={() => !orderSent && setOrderModalOpen(false)}
          fullScreen={isMobile}
          maxWidth="sm"
          fullWidth
          PaperProps={{ sx: { borderRadius: isMobile ? 0 : 4 } }}
        >
          <DialogTitle sx={{ fontWeight: 800, display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {empresa?.tipo_negocio === 'restaurante'
                ? <TableRestaurant sx={{ color: accentColor }} />
                : <ShoppingCart sx={{ color: accentColor }} />}
              {empresa?.tipo_negocio === 'restaurante'
                ? 'Enviar pedido a cocina'
                : checkoutStep === 1 ? 'Tus datos' : 'Entrega'}
            </Box>
            {!orderSent && <IconButton size="small" onClick={() => { setOrderModalOpen(false); setCheckoutStep(1); setCheckoutErrors({}); }}><Close fontSize="small" /></IconButton>}
          </DialogTitle>

          <DialogContent dividers sx={{ position: 'relative', p: 0 }}>

            {/* Pantalla de ÉXITO */}
            {orderSent && (
              <Box sx={{
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                minHeight: 260, gap: 2, px: 3, py: 4,
                textAlign: 'center',
              }}>
                {empresa?.tipo_negocio === 'restaurante' ? (
                  <>
                    <CheckCircle sx={{ fontSize: 72, color: '#059669' }} />
                    <Typography sx={{ fontWeight: 900, fontSize: 22, color: textPri }}>
                      ¡Pedido enviado a cocina!
                    </Typography>
                    {confirmedComanda && (
                      <Box sx={{ p: 2, borderRadius: 3, bgcolor: `${accentColor}10`, border: `1px solid ${accentColor}40`, width: '100%', maxWidth: 280 }}>
                        <Typography sx={{ fontSize: 13, color: textSec }}>Mesa</Typography>
                        <Typography sx={{ fontWeight: 900, fontSize: 28, color: accentColor }}>
                          {confirmedComanda.mesa_numero}
                        </Typography>
                        <Typography sx={{ fontSize: 12, color: textSec, mt: 0.5 }}>
                          Comanda #{confirmedComanda.numero_comanda}
                        </Typography>
                      </Box>
                    )}
                    <Typography sx={{ color: textSec, fontSize: 13, maxWidth: 260 }}>
                      Tu pedido ya está en la cocina. El mesero te traerá tu orden en breve.
                    </Typography>
                  </>
                ) : (
                  <>
                    <Typography sx={{ fontSize: 64, lineHeight: 1 }}>🎉</Typography>
                    <Typography sx={{ fontWeight: 900, fontSize: 22, color: textPri }}>¡Pedido enviado!</Typography>
                    {confirmedPedido?.numero_pedido && (
                      <Box sx={{ p: 2, borderRadius: 3, bgcolor: `${accentColor}10`, border: `1px solid ${accentColor}40`, width: '100%', maxWidth: 280 }}>
                        <Typography sx={{ fontSize: 13, color: textSec }}>Número de tu pedido</Typography>
                        <Typography sx={{ fontWeight: 900, fontSize: 28, color: accentColor }}>
                          #{confirmedPedido.numero_pedido}
                        </Typography>
                      </Box>
                    )}
                    <Typography sx={{ color: textSec, fontSize: 14, maxWidth: 280 }}>
                      Guarda tu número de pedido — con él y tu celular puedes consultar el estado desde el botón "Rastrear pedido" en la parte superior. El vendedor te contactará pronto.
                    </Typography>
                  </>
                )}
              </Box>
            )}

            {/* Formulario RESTAURANTE */}
            {!orderSent && empresa?.tipo_negocio === 'restaurante' && (
              <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 3 }}>
                {/* Resumen del pedido */}
                <Box sx={{ p: 2, borderRadius: 2.5, bgcolor: subtleBg, border: `1px solid ${borderClr}` }}>
                  <Typography sx={{ fontWeight: 700, fontSize: 12, color: textSec, textTransform: 'uppercase', letterSpacing: 0.8, mb: 1 }}>
                    Tu pedido
                  </Typography>
                  {cart.map(item => (
                    <Box key={item.cartId} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.6 }}>
                      <Box sx={{ flex: 1 }}>
                        <Typography sx={{ fontSize: 13, fontWeight: 600 }}>
                          {item.quantity}× {item.nombre}{item.nombreVariante ? ` (${item.nombreVariante})` : ''}
                        </Typography>
                        {itemNotas[item.id] && (
                          <Typography sx={{ fontSize: 11, color: accentColor, fontStyle: 'italic' }}>
                            📝 {itemNotas[item.id]}
                          </Typography>
                        )}
                      </Box>
                      <Typography sx={{ fontSize: 13, fontWeight: 700, flexShrink: 0, ml: 1 }}>
                        ${new Intl.NumberFormat('es-CO').format(item.precio * item.quantity)}
                      </Typography>
                    </Box>
                  ))}
                  <Divider sx={{ my: 1 }} />
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography sx={{ fontWeight: 800 }}>Total</Typography>
                    <Typography sx={{ fontWeight: 900, color: accentColor }}>
                      ${new Intl.NumberFormat('es-CO').format(cartTotal)}
                    </Typography>
                  </Box>
                </Box>

                {/* Número de mesa */}
                <Box>
                  <Typography sx={{ fontWeight: 700, fontSize: 14, mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <TableRestaurant fontSize="small" sx={{ color: accentColor }} />
                    ¿En qué mesa estás? *
                  </Typography>
                  <Typography sx={{ fontSize: 12, color: checkoutErrors.mesa ? '#EF4444' : textSec, mb: 1.5, fontWeight: checkoutErrors.mesa ? 700 : 400 }}>
                    {checkoutErrors.mesa ? '⚠ Debes indicar tu mesa para poder enviar el pedido' : 'Mira el número en la tarjeta de tu mesa.'}
                  </Typography>
                  {mesas.length > 0 ? (
                    <Box sx={{
                      display: 'flex', flexWrap: 'wrap', gap: 1, p: checkoutErrors.mesa ? 1 : 0,
                      borderRadius: 2, border: checkoutErrors.mesa ? '1.5px solid #EF4444' : 'none',
                    }}>
                      {mesas.map(m => (
                        <Box
                          key={m.numero}
                          onClick={() => { setMesaNumero(m.numero); setCheckoutErrors(prev => ({ ...prev, mesa: false })); }}
                          sx={{
                            width: 52, height: 52, borderRadius: 2.5,
                            border: `2.5px solid ${mesaNumero === m.numero ? accentColor : borderClr}`,
                            bgcolor: mesaNumero === m.numero ? `${accentColor}12` : subtleBg,
                            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                            cursor: 'pointer', transition: 'all 0.15s',
                            '&:hover': { borderColor: accentColor, bgcolor: `${accentColor}08` },
                            opacity: m.estado === 'reservada' ? 0.4 : 1,
                          }}
                        >
                          <Typography sx={{ fontWeight: 900, fontSize: 15, color: mesaNumero === m.numero ? accentColor : textPri, lineHeight: 1 }}>
                            {m.numero}
                          </Typography>
                          {m.zona && (
                            <Typography sx={{ fontSize: 8, color: textSec, lineHeight: 1, mt: 0.2 }}>{m.zona}</Typography>
                          )}
                        </Box>
                      ))}
                    </Box>
                  ) : (
                    <TextField
                      fullWidth
                      placeholder="Ej: 5, A3, Barra-2"
                      value={mesaNumero}
                      onChange={e => { setMesaNumero(e.target.value); if (e.target.value.trim()) setCheckoutErrors(prev => ({ ...prev, mesa: false })); }}
                      size="small"
                      error={Boolean(checkoutErrors.mesa)}
                      sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                    />
                  )}
                  {mesas.length > 0 && (
                    <TextField
                      fullWidth
                      placeholder="O escribe el número de tu mesa"
                      value={mesaNumero}
                      onChange={e => { setMesaNumero(e.target.value); if (e.target.value.trim()) setCheckoutErrors(prev => ({ ...prev, mesa: false })); }}
                      size="small"
                      error={Boolean(checkoutErrors.mesa)}
                      sx={{ mt: 1.5, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                    />
                  )}
                </Box>
              </Box>
            )}

            {/* Improvement #12: Formulario COMERCIO en 2 pasos */}
            {!orderSent && empresa?.tipo_negocio !== 'restaurante' && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, p: 3 }}>

                {/* Step indicator */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                  {[1, 2].map(step => (
                    <React.Fragment key={step}>
                      <Box sx={{
                        width: 28, height: 28, borderRadius: '50%',
                        bgcolor: step <= checkoutStep ? accentColor : subtleBg,
                        border: `2px solid ${step <= checkoutStep ? accentColor : borderClr}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'all 0.2s',
                      }}>
                        <Typography sx={{ fontSize: 12, fontWeight: 800, color: step <= checkoutStep ? '#fff' : textSec }}>
                          {step}
                        </Typography>
                      </Box>
                      {step < 2 && (
                        <Box sx={{ flex: 1, height: 2, bgcolor: checkoutStep > step ? accentColor : borderClr, borderRadius: 1, transition: 'background 0.2s' }} />
                      )}
                    </React.Fragment>
                  ))}
                  <Typography sx={{ fontSize: 11, color: textSec, ml: 1 }}>
                    Paso {checkoutStep} de 2
                  </Typography>
                </Box>

                {/* Step 1: nombre + celular */}
                {checkoutStep === 1 && (
                  <>
                    <Box>
                      <Typography sx={{ fontWeight: 700, fontSize: 14, mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Person fontSize="small" color="action" /> Tu Nombre *
                      </Typography>
                      <TextField
                        fullWidth
                        placeholder="¿Cómo te llamas?"
                        value={nombre}
                        onChange={(e) => { setNombre(e.target.value); if (e.target.value) setCheckoutErrors(prev => ({ ...prev, nombre: false })); }}
                        required
                        error={Boolean(checkoutErrors.nombre)}
                        helperText={
                          checkoutErrors.nombre ? 'Este campo es obligatorio'
                          : nombre ? '✓ Datos guardados' : ' '
                        }
                        FormHelperTextProps={{ sx: { color: checkoutErrors.nombre ? undefined : '#22c55e', fontWeight: 600 } }}
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
                        onChange={(e) => { setCelular(e.target.value.replace(/\D/g, '')); if (e.target.value) setCheckoutErrors(prev => ({ ...prev, celular: false })); }}
                        required
                        error={Boolean(checkoutErrors.celular)}
                        helperText={
                          checkoutErrors.celular ? 'Este campo es obligatorio'
                          : celular ? '✓ Datos guardados' : ' '
                        }
                        FormHelperTextProps={{ sx: { color: checkoutErrors.celular ? undefined : '#22c55e', fontWeight: 600 } }}
                      />
                    </Box>
                  </>
                )}

                {/* Step 2: tipo entrega + dirección + comentarios */}
                {checkoutStep === 2 && (
                  <>
                    <Box>
                      <Typography sx={{ fontWeight: 700, fontSize: 14, mb: 1.5 }}>Tipo de Entrega</Typography>
                      <RadioGroup value={tipoEntrega} onChange={(e) => setTipoEntrega(e.target.value)}>
                        <Grid container spacing={2}>
                          <Grid size={{ xs: 6 }}>
                            <Paper variant="outlined" onClick={() => setTipoEntrega('domicilio')}
                              sx={{ p: 2, textAlign: 'center', borderRadius: 3, cursor: 'pointer',
                                borderColor: tipoEntrega === 'domicilio' ? accentColor : 'divider',
                                bgcolor: tipoEntrega === 'domicilio' ? `${accentColor}05` : 'transparent' }}>
                              <Typography sx={{ fontSize: 24, mb: 0.5 }}>🛵</Typography>
                              <Typography sx={{ fontWeight: 700, fontSize: 12 }}>A domicilio</Typography>
                              <Radio value="domicilio" sx={{ display: 'none' }} />
                            </Paper>
                          </Grid>
                          <Grid size={{ xs: 6 }}>
                            <Paper variant="outlined" onClick={() => setTipoEntrega('recoger')}
                              sx={{ p: 2, textAlign: 'center', borderRadius: 3, cursor: 'pointer',
                                borderColor: tipoEntrega === 'recoger' ? accentColor : 'divider',
                                bgcolor: tipoEntrega === 'recoger' ? `${accentColor}05` : 'transparent' }}>
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
                          onChange={(e) => { setDireccion(e.target.value); if (e.target.value) setCheckoutErrors(prev => ({ ...prev, direccion: false })); }}
                          required
                          error={Boolean(checkoutErrors.direccion)}
                          helperText={checkoutErrors.direccion ? 'La dirección es obligatoria para domicilios' : ' '}
                        />
                      </Box>
                    ) : (
                      <Box sx={{
                        p: 2, borderRadius: 3,
                        border: '1.5px solid',
                        borderColor: empresa?.direccion ? 'success.main' : 'warning.main',
                        bgcolor: empresa?.direccion ? 'success.50' : 'warning.50',
                      }}>
                        <Typography sx={{ fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 0.8, mb: 0.5 }}>
                          📍 Punto de recogida
                        </Typography>
                        {empresa?.direccion ? (
                          <Typography sx={{ fontSize: 14, fontWeight: 600 }}>{empresa.direccion}</Typography>
                        ) : (
                          <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>
                            La tienda te indicará el punto de recogida al confirmar tu pedido.
                          </Typography>
                        )}
                      </Box>
                    )}

                    <Box>
                      <Typography sx={{ fontWeight: 700, fontSize: 14, mb: 1 }}>Comentarios adicionales</Typography>
                      <TextField
                        fullWidth
                        multiline
                        rows={2}
                        placeholder="¿Algo más que debamos saber?"
                        value={comentarios}
                        onChange={(e) => setComentarios(e.target.value)}
                      />
                    </Box>
                  </>
                )}
              </Box>
            )}
          </DialogContent>

          {!orderSent && (
            <DialogActions sx={{ p: 3, flexDirection: 'column', gap: 1 }}>
              {empresa?.tipo_negocio === 'restaurante' ? (
                <Button
                  fullWidth variant="contained" size="large"
                  startIcon={<CheckCircle />}
                  onClick={handleSendOrderRestaurante}
                  sx={{
                    bgcolor: mesaNumero.trim() ? accentColor : 'action.disabledBackground',
                    color: mesaNumero.trim() ? '#fff' : 'text.disabled',
                    borderRadius: 3, py: 1.5, fontWeight: 800,
                    '&:hover': { bgcolor: mesaNumero.trim() ? accentColor : 'action.disabledBackground', opacity: 0.9 },
                  }}
                >
                  Enviar a cocina
                </Button>
              ) : (
                <>
                  {/* Improvement #12: step navigation */}
                  {checkoutStep === 1 && (
                    <Button
                      fullWidth variant="contained" size="large"
                      endIcon={<ArrowForward />}
                      onClick={() => {
                        if (!nombre || !celular) {
                          setCheckoutErrors({ nombre: !nombre, celular: !celular });
                          toast.warning("Falta diligenciar tu nombre y/o celular");
                          return;
                        }
                        setCheckoutErrors({});
                        setCheckoutStep(2);
                      }}
                      sx={{ bgcolor: accentColor, borderRadius: 3, py: 1.5, fontWeight: 800, '&:hover': { bgcolor: accentColor, opacity: 0.9 } }}
                    >
                      Continuar →
                    </Button>
                  )}

                  {checkoutStep === 2 && (
                    <>
                      <Button
                        fullWidth variant="contained" size="large"
                        startIcon={<WhatsApp />}
                        onClick={handleSendOrder}
                        sx={{ bgcolor: '#25D366', borderRadius: 3, py: 1.5, fontWeight: 800, '&:hover': { bgcolor: '#128C7E' } }}
                      >
                        Enviar por WhatsApp
                      </Button>
                      <Button
                        fullWidth variant="text" size="medium"
                        onClick={() => setCheckoutStep(1)}
                        sx={{ borderRadius: 3, fontWeight: 700, color: textSec }}
                      >
                        ← Atrás
                      </Button>
                    </>
                  )}

                  <Typography sx={{ fontSize: 11, color: '#94A3B8', textAlign: 'center', lineHeight: 1.5 }}>
                    Al enviar tu pedido aceptas los{' '}
                    <Box component="span" onClick={() => { setOrderModalOpen(false); setTerminosOpen(true); }}
                      sx={{ color: accentColor, cursor: 'pointer', fontWeight: 700, textDecoration: 'underline' }}>
                      Términos y Condiciones
                    </Box>
                    {' '}de {empresa?.nombre}.
                  </Typography>
                </>
              )}
            </DialogActions>
          )}
        </Dialog>

        {/* ── FOOTER ─────────────────────────────────────────────────── */}
        <Box sx={{ mt: 4, borderTop: '1px solid', borderColor: divClr, px: 2, py: 3, textAlign: 'center', bgcolor: isDark ? '#0A0A0A' : '#FAFAFA' }}>
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

        {/* ── MODAL TÉRMINOS Y CONDICIONES ────────────────────────────── */}
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

        {/* ── MODAL RASTREAR PEDIDO ───────────────────────────────────── */}
        <Dialog open={trackOpen} onClose={() => setTrackOpen(false)} maxWidth="xs" fullWidth
          PaperProps={{ sx: { borderRadius: 3, m: { xs: 1, sm: 3 } } }}>
          <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
            <Typography sx={{ fontWeight: 800, fontSize: 17 }}>Rastrear mi pedido</Typography>
            <IconButton onClick={() => setTrackOpen(false)} size="small"><Close /></IconButton>
          </DialogTitle>
          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <Typography sx={{ fontSize: 13, color: textSec }}>
              Ingresa el número de tu pedido y el celular con el que lo hiciste.
            </Typography>
            <TextField
              label="Número de pedido" placeholder="Ej: 12"
              value={trackNumero} onChange={(e) => setTrackNumero(e.target.value.replace(/\D/g, ''))}
              size="small" fullWidth
            />
            <TextField
              label="Celular" placeholder="Ej: 300 123 4567"
              value={trackCelular} onChange={(e) => setTrackCelular(e.target.value)}
              size="small" fullWidth
            />
            {trackError && <Alert severity="error" sx={{ borderRadius: 2, fontSize: 12.5 }}>{trackError}</Alert>}
            {trackResult && (
              <Box sx={{ p: 2, borderRadius: 3, bgcolor: `${accentColor}10`, border: `1px solid ${accentColor}40` }}>
                <Typography sx={{ fontSize: 12, color: textSec }}>Pedido #{trackResult.numero_pedido}</Typography>
                <Typography sx={{ fontWeight: 900, fontSize: 18, color: accentColor, mt: 0.3 }}>
                  {ESTADO_PEDIDO_LABEL[trackResult.estado] || trackResult.estado}
                </Typography>
                <Typography sx={{ fontSize: 12.5, color: textSec, mt: 1 }}>
                  {trackResult.cantidad_items} producto{trackResult.cantidad_items !== 1 ? 's' : ''} · {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(trackResult.total)}
                </Typography>
                <Typography sx={{ fontSize: 11.5, color: textSec, mt: 0.5 }}>
                  {trackResult.tipo_entrega === 'domicilio' ? 'Entrega a domicilio' : 'Recoger en tienda'}
                  {trackResult.fecha_creacion && ` · ${new Date(trackResult.fecha_creacion).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}`}
                </Typography>
              </Box>
            )}
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button
              onClick={handleTrackSubmit}
              disabled={trackLoading}
              variant="contained"
              fullWidth
              sx={{ bgcolor: accentColor, borderRadius: 2, fontWeight: 700, textTransform: 'none', '&:hover': { bgcolor: accentColor, opacity: 0.88 } }}
            >
              {trackLoading ? <CircularProgress size={20} sx={{ color: '#fff' }} /> : 'Consultar estado'}
            </Button>
          </DialogActions>
        </Dialog>

      </Box>
    </ThemeProvider>
  );
};

export default CatalogoVirtual;
