// Sugerencias de "valor recibido" para cobros en efectivo (POS).
// Dado el total a cobrar, propone el pago exacto y los billetes/redondeos con
// los que un cliente colombiano suele pagar (múltiplo superior de 5.000,
// 10.000, 20.000, 50.000 y 100.000). Un toque llena el campo y evita teclear.
export function sugerenciasEfectivo(total) {
  const t = Math.max(0, Math.round(total || 0));
  if (t <= 0) return [];

  const redondeos = [5000, 10000, 20000, 50000, 100000];
  const candidatos = new Set([t]);
  redondeos.forEach((r) => {
    const arriba = Math.ceil(t / r) * r;
    if (arriba >= t) candidatos.add(arriba);
  });

  const fmt = (v) => `$${v.toLocaleString('es-CO')}`;
  return [...candidatos]
    .sort((a, b) => a - b)
    .slice(0, 5)
    .map((v) => ({ valor: v, label: v === t ? 'Exacto' : fmt(v) }));
}

export default sugerenciasEfectivo;
