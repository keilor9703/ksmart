// Impresión de comprobantes HTML segura para TODA la app.
//
// Problemas que resuelve:
//  1. window.open('about:blank' | '') dentro del WebView de la app instalada
//     (Capacitor) NO abre una pestaña nueva: navega el MISMO WebView a una
//     página en blanco sin barra de navegación → la app queda "bloqueada" y
//     solo se recupera cerrándola. En navegador normal sí funciona.
//  2. window.print() (usado antes vía iframe oculto) simplemente NO HACE
//     NADA dentro del WebView nativo de Android — a diferencia de un
//     navegador de escritorio, el WebView no implementa la API de impresión.
//     El botón parecía "no responder".
//
// Estrategia:
//  - App nativa  → se comparte el comprobante con el selector nativo de
//                  Android (Share), que sí permite imprimir (si hay un
//                  servicio de impresión instalado), enviarlo por WhatsApp,
//                  guardarlo, etc. Si el share falla, cae a iframe+print
//                  como último recurso (no navega, no bloquea, aunque en
//                  muchos WebView no haga nada visible).
//  - Navegador   → ventana nueva (mejor para guardar PDF en móvil) con
//                  fallback a iframe si el popup es bloqueado.
import { Capacitor } from '@capacitor/core';

async function printViaShareNative(html) {
  try {
    const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem');
    const { Share } = await import('@capacitor/share');
    const fileName = `comprobante-${Date.now()}.html`;
    const { uri } = await Filesystem.writeFile({
      path: fileName,
      data: html,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
    });
    await Share.share({
      title: 'Comprobante de venta',
      dialogTitle: 'Imprimir o compartir comprobante',
      url: uri,
    });
  } catch (e) {
    console.warn('printHtml: no se pudo compartir el comprobante, se intenta imprimir directo', e);
    printViaIframe(html);
  }
}

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
    printViaShareNative(html);
    return;
  }
  printViaWindow(html, features);
}

export default printHtml;
