// ─── Formateador de moneda COP ────────────────────────────────────────────────
export const formatCurrency = (amount) => {
  if (amount === null || amount === undefined || isNaN(amount)) return '$ 0';
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
};

// ─── Formatea un string numérico con puntos de miles mientras el usuario tipea ─
// Soporta decimales con coma (formato colombiano): "1234567,89" → "1.234.567,89"
export const formatCurrencyInput = (raw) => {
  const str = String(raw);
  // Eliminar separadores de miles existentes (puntos) para limpiar la parte entera
  const withoutThousands = str.replace(/\./g, '');
  // Separar en parte entera y decimal (usando coma como separador decimal)
  const parts = withoutThousands.split(',');
  const intDigits = parts[0].replace(/\D/g, '');
  const hasDecimal = parts.length > 1;
  const decPart = hasDecimal ? parts[1].replace(/\D/g, '').slice(0, 2) : null;

  if (!intDigits && decPart === null) return '';

  const intFormatted = intDigits
    ? parseInt(intDigits, 10).toLocaleString('es-CO')
    : '0';

  if (decPart !== null) return `${intFormatted},${decPart}`;
  return intFormatted;
};

// ─── Convierte string formateado de vuelta a número ──────────────────────────
// Ejemplo: "1.234.567,89" → 1234567.89
export const parseCurrencyInput = (formatted) => {
  const str = String(formatted);
  // Quitar separadores de miles (puntos), convertir coma decimal a punto
  const normalized = str.replace(/\./g, '').replace(',', '.');
  return parseFloat(normalized) || 0;
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
