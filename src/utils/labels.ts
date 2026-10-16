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
