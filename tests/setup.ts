import { afterEach } from 'vitest';

afterEach(() => {
  try {
    window.localStorage.clear();
  } catch {
    // sin almacenamiento en este entorno
  }
});
