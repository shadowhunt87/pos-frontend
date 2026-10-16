import type { ApprovalAction, PayMethod, PromotionType } from '@/types/api';

export const METHOD_LABEL: Record<PayMethod, string> = { CASH: 'Efectivo', CARD: 'Tarjeta', TRANSFER: 'Transferencia' };
export const PAY_METHODS: readonly PayMethod[] = ['CASH', 'CARD', 'TRANSFER'];

export const APPROVAL_LABEL: Record<ApprovalAction, string> = {
  DISCOUNT: 'un descuento mayor al permitido',
  VOID: 'anular una venta',
  RETURN: 'una devolución',
  CASH_OUT: 'una salida de efectivo',
  DRAWER: 'abrir la gaveta sin venta',
  CREDIT_SALE: 'una venta a crédito',
};

export const PROMOTION_LABEL: Record<PromotionType, string> = {
  PERCENT: '% de descuento',
  BUY_X_PAY_Y: 'Lleva X, paga Y',
  FIXED_PRICE: 'Precio especial',
};

/** Códigos de anulación de la DGII (formato 608). */
export const VOID_CODES: readonly (readonly [string, string])[] = [
  ['01', 'Deterioro de factura preimpresa'],
  ['02', 'Errores de impresión (factura preimpresa)'],
  ['03', 'Impresión defectuosa'],
  ['04', 'Corrección de la información'],
  ['05', 'Cambio de productos'],
  ['06', 'Devolución de productos'],
  ['07', 'Omisión de productos'],
  ['08', 'Errores en secuencia de NCF'],
  ['09', 'Por cese de operaciones'],
  ['10', 'Pérdida o hurto de talonarios'],
];

/** Billetes y monedas dominicanos para el conteo del cierre. */
export const DENOMINATIONS: readonly number[] = [2000, 1000, 500, 200, 100, 50, 25, 10, 5, 1];

export const WEEKDAYS: readonly string[] = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

export const NCF_NAME: Record<string, string> = {
  B01: 'Factura de crédito fiscal',
  B02: 'Factura de consumo',
  B14: 'Régimen especial',
  B15: 'Gubernamental',
  E31: 'Factura de crédito fiscal electrónica',
  E32: 'Factura de consumo electrónica',
};

export const INVOICE_STATUS: Record<string, { label: string; tone: 'success' | 'warning' | 'danger' | 'info' | 'neutral' }> = {
  DRAFT: { label: 'Borrador', tone: 'neutral' },
  ISSUED: { label: 'Por cobrar', tone: 'info' },
  PARTIALLY_PAID: { label: 'Pago parcial', tone: 'warning' },
  PAID: { label: 'Pagada', tone: 'success' },
  OVERDUE: { label: 'Vencida', tone: 'danger' },
  VOIDED: { label: 'Anulada', tone: 'neutral' },
};

export const PAYMENT_METHOD_LABEL: Record<string, string> = {
  CASH: 'Efectivo',
  CARD: 'Tarjeta',
  BANK_TRANSFER: 'Transferencia',
  TRANSFER: 'Transferencia',
  CHECK: 'Cheque',
};

export const MOVEMENT_LABEL: Record<string, string> = {
  PURCHASE: 'Compra',
  SALE: 'Venta',
  SALE_RETURN: 'Devolución de cliente',
  PURCHASE_RETURN: 'Devolución a proveedor',
  ADJUSTMENT_IN: 'Ajuste (entrada)',
  ADJUSTMENT_OUT: 'Ajuste (salida)',
  REVERSAL: 'Reverso',
};

/** De dónde salió una factura (el campo sourceModule del backend). */
export function invoiceOrigin(sourceModule: string | null): string {
  if (sourceModule === 'pos.venta') return 'Caja';
  if (sourceModule === 'pos.factura') return 'Facturación';
  if (sourceModule === 'pos.compra') return 'Compras';
  if (!sourceModule) return 'Sistema contable';
  return 'Otro sistema';
}
