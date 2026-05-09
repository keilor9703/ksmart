// ─── Formateador de moneda COP ────────────────────────────────────────────────
export const formatCurrency = (amount) => {
  if (amount === null || amount === undefined || isNaN(amount)) return '$ 0';
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

// ─── Formatea un string numérico con puntos de miles mientras el usuario tipea ─
// Ejemplo: "1234567" → "1.234.567"
export const formatCurrencyInput = (raw) => {
  // Quitar todo lo que no sea dígito
  const digits = String(raw).replace(/\D/g, '');
  if (!digits) return '';
  // Agregar puntos de miles
  return parseInt(digits, 10).toLocaleString('es-CO');
};

// ─── Convierte string formateado de vuelta a número ──────────────────────────
// Ejemplo: "1.234.567" → 1234567
export const parseCurrencyInput = (formatted) => {
  const digits = String(formatted).replace(/\D/g, '');
  return digits ? parseInt(digits, 10) : 0;
};

// ─── Formatea fecha ISO a string legible (Forzando Colombia UTC-5) ────────────
export const formatDate = (isoString) => {
  if (!isoString) return '—';
  try {
    const date = new Date(isoString);
    return new Intl.DateTimeFormat('es-CO', {
      day: '2-digit', month: 'short', year: 'numeric',
      timeZone: 'America/Bogota'
    }).format(date);
  } catch (e) { return 'Fecha inválida'; }
};

// ─── Formatea fecha+hora (Forzando Colombia UTC-5) ────────────────────────────
export const formatDateTime = (isoString) => {
  if (!isoString) return '—';
  try {
    const date = new Date(isoString);
    return new Intl.DateTimeFormat('es-CO', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true,
      timeZone: 'America/Bogota'
    }).format(date);
  } catch (e) { return 'Fecha/Hora inválida'; }
};
