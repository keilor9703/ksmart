import { useEffect, useRef } from 'react';

/**
 * Ejecuta `callback` cada `intervalMs` milisegundos, PERO se pausa
 * automáticamente cuando la pestaña del navegador está oculta
 * (document.hidden) y reanuda — refrescando de inmediato — al volver.
 *
 * Beneficios frente a un setInterval crudo:
 *  - No martilla al backend cuando el usuario tiene la pestaña en segundo plano.
 *  - Al regresar a la pestaña, los datos se actualizan al instante (no espera
 *    al siguiente tick completo).
 *  - Usa una ref para el callback, así no reinicia el intervalo en cada render
 *    aunque la función cambie de identidad.
 *
 * @param {Function} callback   Función a ejecutar en cada tick. Puede ser async.
 * @param {number}   intervalMs Intervalo en milisegundos. Si es null/0/false, no hace polling.
 * @param {object}   [options]
 * @param {boolean}  [options.runImmediately=false] Ejecuta una vez al montar, sin esperar el primer intervalo.
 * @param {boolean}  [options.enabled=true]         Permite activar/desactivar el polling dinámicamente.
 */
export default function usePolling(callback, intervalMs, options = {}) {
  const { runImmediately = false, enabled = true } = options;
  const savedCallback = useRef(callback);

  // Mantener siempre la última versión del callback sin reiniciar el intervalo.
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!enabled || !intervalMs) return undefined;

    let intervalId = null;

    const tick = () => {
      // Defensa extra: no ejecutar si la pestaña quedó oculta entre ticks.
      if (!document.hidden) savedCallback.current();
    };

    const start = () => {
      if (intervalId !== null) return;
      intervalId = setInterval(tick, intervalMs);
    };

    const stop = () => {
      if (intervalId !== null) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };

    const handleVisibility = () => {
      if (document.hidden) {
        stop();
      } else {
        // Al volver a la pestaña: refrescar de inmediato y reanudar el ciclo.
        savedCallback.current();
        start();
      }
    };

    if (runImmediately) savedCallback.current();

    // Solo arrancar el intervalo si la pestaña está visible.
    if (!document.hidden) start();

    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      stop();
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [intervalMs, enabled, runImmediately]);
}
