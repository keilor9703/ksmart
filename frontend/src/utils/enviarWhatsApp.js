import apiClient from '../api';

// Punto único para "mandarle un WhatsApp a un cliente" en todo el sistema.
// Si la empresa ya tiene su WhatsApp vinculado (Evolution API), lo manda
// directo desde ahí — sin esto, cada módulo abría WhatsApp Web y obligaba
// al empleado a enviarlo desde su número personal aunque el negocio ya
// tuviera el suyo conectado. Si no está vinculado (o falla el envío), abre
// WhatsApp Web igual que antes, como respaldo.
//
// Devuelve { enviado: true } si se mandó directo, o { enviado: false } si
// se abrió WhatsApp Web (o falló todo y no se pudo hacer nada).
export async function enviarWhatsApp(telefono, mensaje) {
  try {
    const { data } = await apiClient.post('/whatsapp-bot/enviar', { telefono, mensaje });
    if (data.enviado) return { enviado: true };
    if (data.url) window.open(data.url, '_blank', 'noopener');
    return { enviado: false };
  } catch {
    // El propio endpoint falló (red, etc.) — aun así dejamos la vía manual.
    const digitos = String(telefono || '').replace(/\D/g, '');
    const numero = digitos.length === 10 && digitos.startsWith('3') ? `57${digitos}` : digitos;
    if (numero) window.open(`https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`, '_blank', 'noopener');
    return { enviado: false };
  }
}
