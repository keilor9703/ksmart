// Puente JS hacia el plugin nativo SunmiPrinter (impresora térmica integrada
// del dispositivo Sunmi). Solo funciona dentro de la app instalada (Capacitor);
// en un navegador normal, sunmiDisponible() devuelve false y no se muestra nada.
import { Capacitor, registerPlugin } from '@capacitor/core';

const SunmiPrinter = registerPlugin('SunmiPrinter');

/**
 * Arma un renglón "izquierda .... derecha" ocupando el ancho de una térmica
 * (58mm ≈ 32 caracteres), para alinear precios/valores a la derecha. Reutilizable
 * por los recibos de todos los módulos.
 */
export function padLR(left, right, width = 32) {
  let l = String(left);
  const r = String(right);
  if (l.length + r.length >= width) l = l.slice(0, Math.max(0, width - r.length - 1));
  const space = Math.max(1, width - l.length - r.length);
  return l + ' '.repeat(space) + r;
}

/** True solo si estamos en la app nativa Y el dispositivo tiene impresora Sunmi. */
export async function sunmiDisponible() {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    const r = await SunmiPrinter.isAvailable();
    return !!(r && r.available);
  } catch {
    return false;
  }
}

/** Recibo de prueba fijo, para validar el hardware sin una venta real. */
export function imprimirPrueba() {
  return SunmiPrinter.printTest();
}

/**
 * Imprime un recibo estructurado.
 * lines: [{ type?: 'text'|'divider'|'feed', text?, align?: 'left'|'center'|'right', size?, bold? }]
 */
export function imprimirRecibo(lines, { cut = true } = {}) {
  return SunmiPrinter.printReceipt({ lines, cut });
}

export default SunmiPrinter;
