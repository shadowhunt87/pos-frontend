import axios from 'axios';
import type { ApiErrorBody } from '@/types/api';

// Error de la API con el mensaje del backend listo para mostrar y, si es un error de negocio del POS, su código
// (APPROVAL_REQUIRED, TOTAL_MISMATCH, PAYMENT_SHORT...) y los datos extra que trae (action, pending, total).
export class ApiError extends Error {
  readonly status: number;
  readonly code: string | null;
  readonly body: ApiErrorBody | null;

  constructor(message: string, status: number, body: ApiErrorBody | null = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
    this.code = typeof body?.code === 'string' ? body.code : null;
  }
}

function isApiErrorBody(value: unknown): value is ApiErrorBody {
  if (typeof value !== 'object' || value === null) return false;
  const message = (value as { message?: unknown }).message;
  return typeof message === 'string' || (Array.isArray(message) && message.every((m) => typeof m === 'string'));
}

export function messageFromBody(body: unknown): string | null {
  if (!isApiErrorBody(body)) return null;
  return Array.isArray(body.message) ? body.message.join('\n') : body.message;
}

const STATUS_MESSAGES: Record<number, string> = {
  401: 'Tu sesión expiró. Inicia sesión de nuevo.',
  403: 'No tienes permiso para esta acción.',
  404: 'No se encontró lo que buscabas.',
  429: 'Demasiados intentos. Espera un momento y vuelve a probar.',
};

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (axios.isAxiosError(error)) {
    if (!error.response) return new ApiError('No se pudo conectar con el servidor. Revisa tu conexión.', 0);
    const { status, data } = error.response;
    const body = isApiErrorBody(data) ? data : null;
    const message = messageFromBody(body) ?? STATUS_MESSAGES[status] ?? `Error del servidor (${status})`;
    return new ApiError(message, status, body);
  }
  return new ApiError(error instanceof Error ? error.message : 'Error inesperado', 0);
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Error inesperado';
}

export function errorCode(error: unknown): string | null {
  return error instanceof ApiError ? error.code : null;
}
