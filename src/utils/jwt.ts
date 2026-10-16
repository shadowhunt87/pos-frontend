import type { Role, TokenPayload } from '@/types/api';

export const ROLES: readonly Role[] = ['ADMIN', 'ACCOUNTANT', 'APPROVER', 'VIEWER', 'AUDITOR', 'CASHIER', 'SELLER', 'WAREHOUSE'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

// Lee el payload del JWT sin verificar la firma: solo sirve para la interfaz (rol y expiración).
// El backend verifica el token en cada llamada.
export function decodeToken(token: string): TokenPayload | null {
  const part = token.split('.')[1];
  if (!part) return null;
  try {
    const base64 = part.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const bytes = Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
    const data: unknown = JSON.parse(new TextDecoder().decode(bytes));
    if (!isRecord(data)) return null;
    const { sub, companyId, role, email, exp } = data;
    if (typeof sub !== 'string' || typeof companyId !== 'string' || typeof email !== 'string') return null;
    if (typeof role !== 'string' || !ROLES.includes(role as Role)) return null;
    return { sub, companyId, email, role: role as Role, exp: typeof exp === 'number' ? exp : undefined };
  } catch {
    return null;
  }
}

export function isExpired(payload: TokenPayload, nowMs: number = Date.now()): boolean {
  return payload.exp !== undefined && payload.exp * 1000 <= nowMs;
}
