import type { Role } from '@/types/api';

// Mismos grupos que el backend (src/verticals/pos/pos-common.ts del módulo financiero). Aquí solo ordenan el menú y las
// rutas: quien de verdad bloquea es el backend.
export type Permission =
  | 'caja' // operar la caja
  | 'supervisar' // turnos, reportes de caja y autorizar con PIN
  | 'configurar' // configuración del POS y promociones
  | 'catalogo' // ver productos, precios y existencias
  | 'editarCatalogo' // crear y editar productos y categorías
  | 'inventario' // kárdex, ajustes, compras y proveedores
  | 'editarInventario' // registrar ajustes, compras y proveedores
  | 'anularInventario' // anular ajustes
  | 'facturas' // ver facturas y clientes
  | 'vender' // crear facturas y clientes
  | 'cobrar' // cobrar facturas pendientes
  | 'anularFacturas' // anular facturas
  | 'contabilidad' // enlaces al sistema financiero
  | 'usuarios'; // administrar usuarios

const RULES: Record<Permission, readonly Role[]> = {
  caja: ['CASHIER', 'APPROVER', 'ACCOUNTANT', 'ADMIN'],
  supervisar: ['APPROVER', 'ACCOUNTANT', 'ADMIN'],
  configurar: ['ACCOUNTANT', 'ADMIN'],
  catalogo: ['CASHIER', 'SELLER', 'WAREHOUSE', 'APPROVER', 'ACCOUNTANT', 'ADMIN'],
  editarCatalogo: ['WAREHOUSE', 'ACCOUNTANT', 'ADMIN'],
  inventario: ['WAREHOUSE', 'APPROVER', 'ACCOUNTANT', 'ADMIN'],
  editarInventario: ['WAREHOUSE', 'ACCOUNTANT', 'ADMIN'],
  anularInventario: ['ACCOUNTANT', 'ADMIN'],
  facturas: ['SELLER', 'CASHIER', 'APPROVER', 'ACCOUNTANT', 'ADMIN'],
  vender: ['SELLER', 'APPROVER', 'ACCOUNTANT', 'ADMIN'],
  cobrar: ['CASHIER', 'APPROVER', 'ACCOUNTANT', 'ADMIN'],
  anularFacturas: ['APPROVER', 'ACCOUNTANT', 'ADMIN'],
  contabilidad: ['ACCOUNTANT', 'ADMIN'],
  usuarios: ['ADMIN'],
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
  SELLER: 'Vendedor',
  WAREHOUSE: 'Almacén',
};

/** Qué hace cada rol, para elegirlo al crear un usuario. */
export const ROLE_HINT: Record<Role, string> = {
  ADMIN: 'Todo el punto de venta, los usuarios y la contabilidad.',
  ACCOUNTANT: 'Todo el punto de venta y la contabilidad, sin usuarios.',
  APPROVER: 'Caja, facturas, clientes, consultas, turnos y reportes. Autoriza con su PIN.',
  VIEWER: 'Solo lectura en el sistema financiero. No usa el punto de venta.',
  AUDITOR: 'Auditoría en el sistema financiero. No usa el punto de venta.',
  CASHIER: 'Solo la caja y el cobro de facturas pendientes.',
  SELLER: 'Clientes y facturas; consulta precios y existencias.',
  WAREHOUSE: 'Productos, inventario, compras y proveedores.',
};
