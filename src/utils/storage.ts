// Acceso a localStorage envuelto: en modo privado o con almacenamiento bloqueado puede lanzar.
export function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStorage(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Sin almacenamiento la sesión dura solo mientras la pestaña esté abierta.
  }
}

export function removeStorage(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // nada que limpiar
  }
}
