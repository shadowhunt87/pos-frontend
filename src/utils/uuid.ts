/** Id de la venta que genera la caja: el mismo en los reintentos, para que el servidor no cobre dos veces. */
export function newClientUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 14)}`;
}
