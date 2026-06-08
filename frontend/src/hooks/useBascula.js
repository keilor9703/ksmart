/**
 * useBascula.js
 * Hook para integración con básculas digitales via Web Serial API (USB).
 * Configuración persistida en localStorage.
 *
 * Protocolos soportados:
 *  - Toledo / Mettler: "+  1.250 kg\r\n"
 *  - Torrey:           "ST,GS,  1.250,kg\r\n"
 *  - Genérica China:   "1.250 KG\r\n" | "1250 g\r\n"
 *  - Bematech:         "P 1.250 Kg\r\n"
 *
 * Expone:
 *  conectar(), desconectar()
 *  peso (float), estable (bool), conectado (bool), error (string|null)
 *  unidad ('kg'|'g'), config, guardarConfig(cfg)
 */
import { useState, useEffect, useRef, useCallback } from 'react';

const LS_KEY = 'bascula_config';
const ESTABILIDAD_MS  = 800;   // tiempo sin cambio para considerarse estable
const TOLERANCIA_PESO = 0.005; // diferencia mínima para considerar cambio

const DEFAULT_CONFIG = {
  baudRate:  9600,
  dataBits:  8,
  stopBits:  1,
  parity:    'none',
  unidad:    'kg',   // unidad esperada de la báscula
};

// Regex que captura el número de peso de los formatos más comunes
const PESO_REGEX = /[+-]?\s*(\d{1,6}[.,]\d{1,4}|\d{1,6})\s*(?:kg|kgs|g|gr|grs|lb|lbs)?/i;

function parsearPeso(linea) {
  const limpia = linea.replace(/[^0-9.,+-]/gi, ' ').trim();
  const m = limpia.match(/[+-]?\s*(\d+[.,]\d+|\d+)/);
  if (!m) return null;
  const val = parseFloat(m[0].replace(',', '.'));
  return isNaN(val) ? null : val;
}

export function useBascula() {
  const [config, setConfigState] = useState(() => {
    try { return { ...DEFAULT_CONFIG, ...JSON.parse(localStorage.getItem(LS_KEY) || '{}') }; }
    catch { return DEFAULT_CONFIG; }
  });
  const [conectado,   setConectado]   = useState(false);
  const [peso,        setPeso]        = useState(0);
  const [estable,     setEstable]     = useState(false);
  const [error,       setError]       = useState(null);

  const portRef        = useRef(null);
  const readerRef      = useRef(null);
  const bufferRef      = useRef('');
  const ultimoPesoRef  = useRef(0);
  const timerEstableRef= useRef(null);
  const activoRef      = useRef(false);

  const guardarConfig = useCallback((nuevaCfg) => {
    const cfg = { ...config, ...nuevaCfg };
    localStorage.setItem(LS_KEY, JSON.stringify(cfg));
    setConfigState(cfg);
  }, [config]);

  const _marcarInestable = useCallback((nuevoPeso) => {
    setPeso(nuevoPeso);
    setEstable(false);
    clearTimeout(timerEstableRef.current);
    const diff = Math.abs(nuevoPeso - ultimoPesoRef.current);
    ultimoPesoRef.current = nuevoPeso;
    if (diff < TOLERANCIA_PESO && nuevoPeso > 0) {
      timerEstableRef.current = setTimeout(() => setEstable(true), ESTABILIDAD_MS);
    }
  }, []);

  const _leerStream = useCallback(async (reader) => {
    const decoder = new TextDecoder();
    try {
      while (activoRef.current) {
        const { value, done } = await reader.read();
        if (done) break;
        bufferRef.current += decoder.decode(value, { stream: true });
        const lineas = bufferRef.current.split(/[\r\n]+/);
        bufferRef.current = lineas.pop() ?? '';
        for (const linea of lineas) {
          if (!linea.trim()) continue;
          const val = parsearPeso(linea);
          if (val !== null) _marcarInestable(val);
        }
      }
    } catch (err) {
      if (activoRef.current) setError('Conexión interrumpida con la báscula.');
    }
  }, [_marcarInestable]);

  const conectar = useCallback(async () => {
    setError(null);
    if (!('serial' in navigator)) {
      setError('Web Serial no está disponible. Usa Chrome o Edge en escritorio.');
      return false;
    }
    try {
      const port = await navigator.serial.requestPort();
      await port.open({
        baudRate: config.baudRate,
        dataBits: config.dataBits,
        stopBits: config.stopBits,
        parity:   config.parity,
      });
      portRef.current   = port;
      activoRef.current = true;
      setConectado(true);
      setPeso(0); setEstable(false);
      const reader = port.readable.getReader();
      readerRef.current = reader;
      _leerStream(reader);
      return true;
    } catch (err) {
      if (err.name !== 'NotFoundError') {
        setError(`No se pudo conectar: ${err.message}`);
      }
      return false;
    }
  }, [config, _leerStream]);

  const desconectar = useCallback(async () => {
    activoRef.current = false;
    clearTimeout(timerEstableRef.current);
    try { await readerRef.current?.cancel(); } catch {}
    try { await portRef.current?.close(); } catch {}
    portRef.current  = null;
    readerRef.current = null;
    setConectado(false);
    setPeso(0);
    setEstable(false);
  }, []);

  // Limpiar al desmontar
  useEffect(() => () => {
    activoRef.current = false;
    clearTimeout(timerEstableRef.current);
    try { readerRef.current?.cancel(); } catch {}
    try { portRef.current?.close(); } catch {}
  }, []);

  return { conectar, desconectar, peso, estable, conectado, error, config, guardarConfig };
}

export const UNIDADES_PESABLES = ['KGS', 'GRS', 'LTS', 'MTS', 'LBS'];
export const esPesable = (unidad_medida) =>
  UNIDADES_PESABLES.includes((unidad_medida || '').toUpperCase());
