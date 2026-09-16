/**
 * marketplaceCart.js — Carrito multi-tienda del Centro Comercial Virtual
 * ─────────────────────────────────────────────────────────────────────
 * Fase 2 del multicarrito: a diferencia del carrito de una tienda
 * individual (CatalogoVirtual.js, clave `cart_${slug}`, sin noción de
 * empresa), este carrito vive en una sola clave de localStorage
 * (`mkt_cart`) y cada item lleva su propia empresa (empresa_slug,
 * empresa_nombre, empresa_color) para poder agruparlo por tienda al
 * momento de pagar. localStorage es por origen (hostname), así que este
 * carrito persiste sin importar si el cliente está en la portada del
 * mall o dentro de la página de una tienda específica — siempre que
 * ambas se sirvan desde el mismo dominio (e-comerce.ksmart360.com).
 *
 * El backend NO tiene (ni necesita) un endpoint multi-empresa: cada
 * tienda sigue validando/creando su propio PedidoVirtual vía
 * POST /catalogo/{slug}/pedido, exactamente igual que un pedido de una
 * sola tienda. Este módulo solo agrupa y dispara una llamada por tienda,
 * y cada una devuelve su propio numero_pedido (único por empresa, ver
 * fase 1) — no existe un solo "número de pedido" para toda la compra,
 * sino uno por tienda involucrada.
 */

const CART_KEY = 'mkt_cart';
const CART_EVENT = 'mkt_cart_changed';

export const MARKETPLACE_HOSTNAME = 'e-comerce.ksmart360.com';
export const isMarketplaceDomain = () => window.location.hostname === MARKETPLACE_HOSTNAME;

const safeGet = () => {
  try {
    const raw = localStorage.getItem(CART_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const safeSet = (items) => {
  try {
    localStorage.setItem(CART_KEY, JSON.stringify(items));
  } catch { /* localStorage lleno/deshabilitado — el carrito solo vive en memoria esta sesión */ }
  // Notifica a otros componentes montados en la misma pestaña (ej. el
  // badge del header) sin depender de que compartan el mismo useState.
  window.dispatchEvent(new CustomEvent(CART_EVENT, { detail: items }));
};

export function getMarketplaceCart() {
  return safeGet();
}

export function subscribeMarketplaceCart(callback) {
  const handler = (e) => callback(e.detail || safeGet());
  window.addEventListener(CART_EVENT, handler);
  return () => window.removeEventListener(CART_EVENT, handler);
}

/**
 * Agrega un item al carrito compartido. `producto` debe incluir al menos
 * id/nombre/precio, y la empresa a la que pertenece (empresa_slug,
 * empresa_nombre, empresa_color). Si ya existe el mismo producto+variante
 * de la MISMA tienda, suma cantidades en vez de duplicar la fila.
 */
export function buildMarketplaceCartId(empresaSlug, productoId, varianteId) {
  return `${empresaSlug}:${productoId}${varianteId ? `:${varianteId}` : ''}`;
}

export function addToMarketplaceCart({
  producto_id, nombre, precio, cantidad = 1,
  variante_id = null, nombre_variante = null,
  empresa_slug, empresa_nombre, empresa_color,
}) {
  const cartId = buildMarketplaceCartId(empresa_slug, producto_id, variante_id);
  const items = safeGet();
  const idx = items.findIndex(i => i.cartId === cartId);
  if (idx >= 0) {
    items[idx] = { ...items[idx], cantidad: items[idx].cantidad + cantidad };
  } else {
    items.push({
      cartId, producto_id, nombre, precio, cantidad,
      variante_id, nombre_variante,
      empresa_slug, empresa_nombre, empresa_color,
    });
  }
  safeSet(items);
  return items;
}

export function updateMarketplaceCartQty(cartId, cantidad) {
  let items = safeGet();
  if (cantidad <= 0) {
    items = items.filter(i => i.cartId !== cartId);
  } else {
    items = items.map(i => i.cartId === cartId ? { ...i, cantidad } : i);
  }
  safeSet(items);
  return items;
}

export function removeFromMarketplaceCart(cartId) {
  const items = safeGet().filter(i => i.cartId !== cartId);
  safeSet(items);
  return items;
}

/** Resta 1 a la cantidad de un item (lo quita si llega a 0) — espejo de
 * CatalogoVirtual.removeFromCart, para mantener sincronizado el carrito
 * compartido cuando el cliente ajusta cantidades dentro de una tienda. */
export function decrementMarketplaceCartItem(cartId) {
  const items = safeGet();
  const idx = items.findIndex(i => i.cartId === cartId);
  if (idx === -1) return items;
  const next = items[idx].cantidad <= 1
    ? items.filter((_, i) => i !== idx)
    : items.map((it, i) => i === idx ? { ...it, cantidad: it.cantidad - 1 } : it);
  safeSet(next);
  return next;
}

export function clearMarketplaceCart() {
  safeSet([]);
  return [];
}

/** Quita del carrito solo los items de las tiendas indicadas (usado tras un
 * checkout parcial: las tiendas que sí se pudieron pagar se limpian, las
 * que fallaron quedan para reintentar). */
export function removeMarketplaceCartStores(empresaSlugs) {
  const set = new Set(empresaSlugs);
  const items = safeGet().filter(i => !set.has(i.empresa_slug));
  safeSet(items);
  return items;
}

export function groupMarketplaceCartByStore(items) {
  const groups = {};
  for (const item of items) {
    if (!groups[item.empresa_slug]) {
      groups[item.empresa_slug] = {
        empresa_slug: item.empresa_slug,
        empresa_nombre: item.empresa_nombre,
        empresa_color: item.empresa_color,
        items: [],
        total: 0,
      };
    }
    groups[item.empresa_slug].items.push(item);
    groups[item.empresa_slug].total += item.precio * item.cantidad;
  }
  return Object.values(groups);
}

export function marketplaceCartCount(items) {
  return items.reduce((acc, i) => acc + i.cantidad, 0);
}

/**
 * Envía un pedido POR TIENDA (una llamada a POST /catalogo/{slug}/pedido
 * por cada grupo) con la misma info de cliente/entrega para todas.
 * No es atómico entre tiendas (son empresas/transacciones independientes)
 * — se reporta el resultado de cada una por separado para que el
 * checkout pueda mostrar éxito parcial y permitir reintentar solo lo que
 * falló, sin perder lo que ya se guardó.
 */
export async function submitMultiStoreOrder(apiClient, groups, datosCliente) {
  const resultados = [];
  for (const grupo of groups) {
    try {
      const payload = {
        nombre_cliente:    datosCliente.nombre,
        celular_cliente:   datosCliente.celular,
        tipo_entrega:      datosCliente.tipoEntrega,
        direccion_entrega: datosCliente.tipoEntrega === 'domicilio' ? datosCliente.direccion : null,
        comentarios:       datosCliente.comentarios || null,
        detalles: grupo.items.map(i => ({
          producto_id:     i.producto_id,
          cantidad:        i.cantidad,
          precio_unitario: i.precio,
          variante_id:     i.variante_id || undefined,
        })),
      };
      const res = await apiClient.post(`/catalogo/${grupo.empresa_slug}/pedido`, payload);
      resultados.push({
        empresa_slug: grupo.empresa_slug,
        empresa_nombre: grupo.empresa_nombre,
        ok: true,
        numero_pedido: res.data.numero_pedido,
        total: res.data.total,
      });
    } catch (err) {
      const detail = err?.response?.data?.detail;
      const msg = typeof detail === 'string' ? detail : 'No se pudo registrar el pedido.';
      resultados.push({
        empresa_slug: grupo.empresa_slug,
        empresa_nombre: grupo.empresa_nombre,
        ok: false,
        error: msg,
      });
    }
  }
  return resultados;
}
