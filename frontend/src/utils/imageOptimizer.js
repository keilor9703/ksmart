/**
 * Comprime y redimensiona imágenes antes de subirlas al servidor.
 *
 * Objetivo: que CUALQUIER foto de la galería (sin importar tamaño, formato u
 * orientación) termine siendo un data URL liviano que el backend acepte.
 *
 * Problema que resuelve: muchos WebView de Android NO codifican WebP en canvas
 * y `toDataURL('image/webp')` cae silenciosamente a PNG. Un PNG fotográfico de
 * 800px pesa varios MB en base64, y el servidor (o nginx) rechaza el request →
 * "unas fotos sí dejan y otras no". Aquí detectamos ese caso y usamos JPEG, y
 * además garantizamos un tamaño máximo bajando calidad y dimensiones.
 */

const MAX_BYTES_DEFAULT = 150 * 1024; // 150 KB por imagen (4 fotos ≈ 600 KB, holgado bajo el límite del servidor)

// Tamaño aproximado en bytes de un data URL base64.
function approxBytes(dataUrl) {
  const comma = dataUrl.indexOf(',');
  const b64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  const padding = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0;
  return Math.round((b64.length * 3) / 4) - padding;
}

// Codifica el canvas priorizando WebP; si el navegador no soporta WebP en
// canvas (devuelve un PNG), cae a JPEG, que es universal y liviano para fotos.
function encode(canvas, quality) {
  let url = canvas.toDataURL('image/webp', quality);
  if (!url.startsWith('data:image/webp')) {
    url = canvas.toDataURL('image/jpeg', quality);
  }
  return url;
}

function readAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = () => reject(new Error('No se pudo leer el archivo'));
    reader.readAsDataURL(file);
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Formato de imagen no soportado o archivo dañado'));
    img.src = src;
  });
}

// Dibuja la imagen a un ancho dado (con fondo blanco para aplanar transparencias
// y evitar PNG/JPEG con artefactos) y devuelve el data URL codificado.
function renderAtWidth(img, targetWidth, quality) {
  const width = Math.max(1, Math.round(targetWidth));
  const height = Math.max(1, Math.round((img.height * width) / img.width));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);
  return encode(canvas, quality);
}

/**
 * @param {File|Blob} file       Imagen de entrada.
 * @param {number} maxWidth      Ancho máximo (px). Default 800.
 * @param {number} quality       Calidad inicial 0..1. Default 0.75.
 * @param {number} maxBytes      Tamaño objetivo máximo. Default 200 KB.
 * @returns {Promise<string>}    data URL (WebP o JPEG) liviano.
 */
export const compressImageToWebP = async (
  file,
  maxWidth = 800,
  quality = 0.75,
  maxBytes = MAX_BYTES_DEFAULT,
) => {
  const dataUrl = await readAsDataURL(file);
  const img = await loadImage(dataUrl);

  let width = Math.min(img.width, maxWidth);
  let q = quality;
  let out = renderAtWidth(img, width, q);

  // 1) Baja la calidad hasta llegar al objetivo (sin pasar de un mínimo usable).
  while (approxBytes(out) > maxBytes && q > 0.4) {
    q -= 0.1;
    out = renderAtWidth(img, width, q);
  }

  // 2) Si todavía es muy grande, reduce dimensiones progresivamente.
  let guard = 0;
  while (approxBytes(out) > maxBytes && width > 240 && guard < 6) {
    width = Math.round(width * 0.8);
    out = renderAtWidth(img, width, q);
    guard += 1;
  }

  return out;
};

export default compressImageToWebP;
