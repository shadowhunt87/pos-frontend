import axios, { type AxiosInstance } from 'axios';
import { toApiError } from './errors';

const baseURL = import.meta.env.VITE_API_URL || '/api';

// Estado de sesión que la capa HTTP necesita, sin depender de Pinia (evita ciclos de importación).
let tokenGetter: () => string | null = () => null;
let unauthorizedHandler: () => void = () => {};

export function configureSession(options: { getToken: () => string | null; onUnauthorized: () => void }): void {
  tokenGetter = options.getToken;
  unauthorizedHandler = options.onUnauthorized;
}

// Cliente autenticado: agrega el Bearer y cierra la sesión ante cualquier 401.
export const http: AxiosInstance = axios.create({ baseURL, timeout: 30_000 });

http.interceptors.request.use((config) => {
  const token = tokenGetter();
  if (token) config.headers.set('Authorization', `Bearer ${token}`);
  return config;
});

http.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) unauthorizedHandler();
    throw toApiError(error);
  },
);

// Cliente público (login): sin token y sin cerrar sesión en 401 (un 401 ahí es «clave incorrecta»).
export const publicHttp: AxiosInstance = axios.create({ baseURL, timeout: 30_000 });

publicHttp.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    throw toApiError(error);
  },
);
