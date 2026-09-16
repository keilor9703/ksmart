// Puente JS hacia el plugin nativo SunmiScanner (escáner de códigos de barras
// integrado del dispositivo Sunmi). Solo funciona dentro de la app instalada;
// en un navegador normal, sunmiScannerDisponible() devuelve false.
import { Capacitor, registerPlugin } from '@capacitor/core';

const SunmiScanner = registerPlugin('SunmiScanner');

/** True solo si estamos en la app nativa Y el dispositivo tiene escáner Sunmi. */
export async function sunmiScannerDisponible() {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    const r = await SunmiScanner.isAvailable();
    return !!(r && r.available);
  } catch {
    return false;
  }
}

/** Abre la pantalla de escaneo nativa de Sunmi y resuelve con el código leído (string, o '' si se canceló). */
export async function escanearSunmi() {
  try {
    const r = await SunmiScanner.scan();
    return (r && r.value) ? String(r.value).trim() : '';
  } catch {
    return '';
  }
}

/**
 * Escucha el botón físico del escáner del V3 (modo broadcast). Llama cb(codigo)
 * cada vez que se escanea. Devuelve una función para dejar de escuchar.
 */
export function onScanFisico(cb) {
  let handle = null;
  let cancelled = false;
  SunmiScanner.addListener('scan', (data) => {
    const val = data && data.value ? String(data.value).trim() : '';
    if (val) cb(val);
  }).then((h) => {
    if (cancelled) { h.remove(); } else { handle = h; }
  }).catch(() => {});
  return () => {
    cancelled = true;
    if (handle) { try { handle.remove(); } catch { /* noop */ } }
  };
}

export default SunmiScanner;
