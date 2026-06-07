import apiClient from '../api';

const INTERVAL_MS = 10 * 60 * 1000; // 10 minutos
let intervalId = null;

const ping = () => {
  apiClient.get('/ping').catch(() => {});
};

export const startKeepAlive = () => {
  if (intervalId) return;
  ping(); // ping inmediato al autenticar
  intervalId = setInterval(ping, INTERVAL_MS);
};

export const stopKeepAlive = () => {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
};
