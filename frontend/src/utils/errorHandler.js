import { toast } from 'react-toastify';

/**
 * Extrae el mensaje de error más útil de una respuesta de error de Axios.
 *
 * Maneja los formatos que devuelve el backend FastAPI:
 *  - { detail: "mensaje" }                          → string simple
 *  - { detail: [{ loc, msg, type }, ...] }          → errores de validación (422)
 *  - errores de red sin response                    → mensaje genérico de conexión
 *
 * @param {any} error      El error capturado (típicamente de Axios).
 * @param {string} fallback Mensaje a usar si no se puede extraer uno específico.
 * @returns {string} El mensaje de error legible.
 */
export function getErrorMessage(error, fallback = 'Ocurrió un error inesperado.') {
  // Error de red (sin respuesta del servidor)
  if (error && error.request && !error.response) {
    return 'No se pudo conectar con el servidor. Revisa tu conexión a internet.';
  }

  const detail = error?.response?.data?.detail;

  // 422: FastAPI devuelve un array de errores de validación
  if (Array.isArray(detail)) {
    const primero = detail[0];
    if (primero?.msg) {
      const campo = Array.isArray(primero.loc) ? primero.loc[primero.loc.length - 1] : null;
      return campo ? `${campo}: ${primero.msg}` : primero.msg;
    }
    return fallback;
  }

  // 4xx/5xx con detail string
  if (typeof detail === 'string' && detail.trim()) {
    return detail;
  }

  // Algunos endpoints devuelven { message: "..." }
  const message = error?.response?.data?.message;
  if (typeof message === 'string' && message.trim()) {
    return message;
  }

  return fallback;
}

/**
 * Muestra un toast de error con el mensaje extraído del error.
 * Reemplaza el patrón repetido `toast.error(err.response?.data?.detail || '...')`.
 *
 * @param {any} error      El error capturado.
 * @param {string} fallback Mensaje a usar si no se puede extraer uno específico.
 * @returns {string} El mensaje que se mostró (útil para logging o setError).
 */
export function notifyError(error, fallback = 'Ocurrió un error inesperado.') {
  const msg = getErrorMessage(error, fallback);
  toast.error(msg);
  return msg;
}
