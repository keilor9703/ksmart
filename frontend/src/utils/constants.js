/**
 * constants.js — Fuente única de verdad para dominios del sistema
 * ─────────────────────────────────────────────────────────────────
 * Todos los módulos importan desde aquí.
 * Para agregar o renombrar una opción: cambiar solo en este archivo.
 *
 * Si en el futuro se decide mover a BD, solo hay que reemplazar estas
 * constantes por una llamada a la API en un hook (useConstants) y el
 * resto del código no cambia.
 */

// ─── Grupos de producto ────────────────────────────────────────────────────────
// Coincide exactamente con el campo grupo_item en la tabla productos
// id: valor que se guarda en BD | label: texto visible | short: abreviatura
export const GRUPOS_PRODUCTO = [
  { id: 1, label: 'MP — Materia Prima',      short: 'Materia Prima',  color: '#3B82F6', emoji: '🌿' },
  { id: 2, label: 'PT — Producto Terminado', short: 'Producto Terminado',  color: '#10B981', emoji: '📦' },
  { id: 3, label: 'AF — Activo Fijo',        short: ' Activo Fijo',  color: '#F59E0B', emoji: '🏗️' },
  { id: 4, label: 'INS — Insumos',           short: 'Insumos', color: '#8B5CF6', emoji: '🔩' },
];

// ─── Unidades de medida ────────────────────────────────────────────────────────
// Coincide con los valores aceptados en el campo unidad_medida
export const UNIDADES_MEDIDA = [
  { value: 'UND', label: 'Unidad (Und)' },
  { value: 'KGS', label: 'Kilos (Kg)'  },
  { value: 'GRS', label: 'Gramos (Gr)' },
  { value: 'LTS', label: 'Litros (Lt)' },
  // { value: 'MTS', label: 'Metros (Mts)' },
  // { value: 'PAR', label: 'Pares'        },
  { value: 'CJA', label: 'Caja'         },
  { value: 'PAQ', label: 'Paquete'      },
];

// ─── Métodos de pago ──────────────────────────────────────────────────────────
// Fuente única de verdad para todos los módulos del sistema.
// Al agregar o quitar un método, modificar SOLO aquí.
export const METODOS_PAGO = [
  { value: 'Efectivo',      label: '💵 Efectivo',      color: '#10B981' },
  { value: 'Transferencia', label: '🏦 Transferencia',  color: '#3B82F6' },
  { value: 'Nequi',         label: '💜 Nequi',          color: '#7C3AED' },
  { value: 'Daviplata',     label: '🔵 Daviplata',      color: '#2563EB' },
  { value: 'Tarjeta',       label: '💳 Tarjeta',        color: '#8B5CF6' },
  { value: 'Cheque',        label: '📄 Cheque',         color: '#6B7280' },
  { value: 'Nota Crédito',  label: '📋 Nota Crédito',  color: '#EF4444' },
  { value: 'Otro',          label: '💰 Otro',           color: '#9CA3AF' },
];

/** Array de solo strings, para selects simples */
export const METODOS_PAGO_SIMPLE = METODOS_PAGO.map(m => m.value);

// ─── Helpers ───────────────────────────────────────────────────────────────────

/** Retorna el objeto de grupo por su id */
export const getGrupo = (id) =>
  GRUPOS_PRODUCTO.find(g => g.id === id) || { short: '?', color: '#94a3b8', label: 'Desconocido' };

/** Retorna solo el short label de un grupo */
export const getGrupoShort = (id) => getGrupo(id).short;

/** Retorna la etiqueta de una unidad de medida */
export const getUnidadLabel = (value) =>
  UNIDADES_MEDIDA.find(u => u.value === value)?.label || value;
