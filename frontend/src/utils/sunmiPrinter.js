// Puente JS hacia el plugin nativo SunmiPrinter (impresora térmica integrada
// del dispositivo Sunmi). Solo funciona dentro de la app instalada (Capacitor);
// en un navegador normal, sunmiDisponible() devuelve false y no se muestra nada.
import { Capacitor, registerPlugin } from '@capacitor/core';

const SunmiPrinter = registerPlugin('SunmiPrinter');

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
