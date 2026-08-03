// Impresión de comprobantes HTML segura para TODA la app.
//
// Problema que resuelve: dentro del WebView de la app instalada (Capacitor),
// window.open('about:blank' | '') NO abre una pestaña nueva: navega el MISMO
// WebView a una página en blanco sin barra de navegación → la app queda
// "bloqueada" y solo se recupera cerrándola. En navegador normal sí funciona.
//
// Estrategia:
//  - App nativa  → iframe oculto SIEMPRE (no navega, no bloquea).
//  - Navegador   → ventana nueva (mejor para guardar PDF en móvil) con
//                  fallback a iframe si el popup es bloqueado.
import { Capacitor } from '@capacitor/core';

function printViaIframe(html) {
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:none;opacity:0;pointer-events:none;';
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument || iframe.contentWindow.document;
  doc.open(); doc.write(html); doc.close();
  setTimeout(() => {
    try {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    } catch (e) {
      console.warn('printHtml: error al imprimir', e);
    }
    setTimeout(() => {
      if (document.body.contains(iframe)) document.body.removeChild(iframe);
    }, 3000);
  }, 350);
}

function printViaWindow(html, features) {
  const win = window.open('about:blank', '_blank', features || undefined);
  if (!win) { printViaIframe(html); return; }
  win.document.open();
  win.document.write(html);
  win.document.close();
  const doPrint = () => { try { win.focus(); win.print(); } catch (e) {} };
  if (win.document.readyState === 'complete') {
    setTimeout(doPrint, 250);
  } else {
    win.onload = () => setTimeout(doPrint, 100);
    setTimeout(doPrint, 600); // fallback de seguridad
  }
}

/**
 * Imprime un documento HTML completo (con <html>...</html>).
 * @param {string} html      Documento HTML a imprimir.
 * @param {string} [features] Features de window.open (solo navegador, opcional).
 */
export function printHtml(html, features) {
  if (Capacitor.isNativePlatform()) {
    printViaIframe(html);
    return;
  }
  printViaWindow(html, features);
}

export default printHtml;
