import type { Role } from '@/types/api';

// Mismos grupos que el backend (src/verticals/pos/pos-common.ts). Aquí solo ordenan el menú y las rutas:
// quien de verdad bloquea es el backend.
export type Permission = 'caja' | 'supervisar' | 'configurar';

const RULES: Record<Permission, readonly Role[]> = {
  // Operan la caja: el cajero y los supervisores
  caja: ['CASHIER', 'APPROVER', 'ACCOUNTANT', 'ADMIN'],
  // Ven turnos y reportes, y autorizan con su PIN
  supervisar: ['APPROVER', 'ACCOUNTANT', 'ADMIN'],
  // Configuran el punto de venta
  configurar: ['ACCOUNTANT', 'ADMIN'],
};

export function can(role: Role | null | undefined, permission: Permission): boolean {
  return !!role && RULES[permission].includes(role);
}

export const ROLE_LABEL: Record<Role, string> = {
  ADMIN: 'Administrador',
  ACCOUNTANT: 'Contador',
  APPROVER: 'Supervisor',
  VIEWER: 'Consulta',
  AUDITOR: 'Auditor',
  CASHIER: 'Cajero',
};
