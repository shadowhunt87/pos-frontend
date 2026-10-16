import Decimal from 'decimal.js';
import { describe, expect, it } from 'vitest';
import type { PosProduct, PosPromotion } from '@/types/api';
import { isPromoActiveAt, priceCart, priceWithTax, quoteCart, sumQuote } from '@/utils/pricing';

// Mismos casos que el motor del backend (src/verticals/pos/pricing.ts): si cambian allá, estas pruebas avisan.
const promo = (p: Partial<PosPromotion>): PosPromotion => ({
  id: 'pr', name: 'Promo', type: 'PERCENT', value: '10', buyQty: null, payQty: null, productIds: [], categoryIds: [],
  startsAt: null, endsAt: null, weekdays: [], timeFrom: null, timeTo: null, priority: 0, active: true, ...p,
});
const product = (p: Partial<PosProduct>): PosProduct => ({
  id: 'p1', code: 'P1', name: 'Filtro', unit: 'UND', kind: 'GOODS', salePrice: '100.00', saleTaxRateId: 't18', tracksInventory: false,
  stockQty: '0', categoryId: null, sortOrder: 0, barcodes: [], tax: { name: 'ITBIS 18%', rate: '18' }, ...p,
});
const line = (qty: number, price = '100') => ({ productId: 'p1', categoryId: null, quantity: new Decimal(qty), unitPrice: new Decimal(price) });
// Jueves 15-oct-2026 a las 14:00 de Santo Domingo (18:00 UTC)
const AT = new Date('2026-10-15T18:00:00Z');

describe('motor de precios (copia del backend)', () => {
  it('porcentaje sobre el importe de la línea', () => {
    const [r] = priceCart([promo({ value: '10' })], [line(3)], AT);
    expect(r!.gross.toFixed(2)).toBe('300.00');
    expect(r!.promoDiscount.toFixed(2)).toBe('30.00');
  });

  it('lleva 3 paga 2: regala una por cada 3', () => {
    const [r] = priceCart([promo({ type: 'BUY_X_PAY_Y', buyQty: 3, payQty: 2, value: null })], [line(7)], AT);
    expect(r!.promoDiscount.toFixed(2)).toBe('200.00');
  });

  it('precio especial y que no sube el precio', () => {
    expect(priceCart([promo({ type: 'FIXED_PRICE', value: '80' })], [line(2)], AT)[0]!.promoDiscount.toFixed(2)).toBe('40.00');
    expect(priceCart([promo({ type: 'FIXED_PRICE', value: '120' })], [line(2)], AT)[0]!.promoDiscount.toFixed(2)).toBe('0.00');
  });

  it('usa la que más descuenta y, en empate, la de mayor prioridad', () => {
    const rules = [promo({ id: 'a', name: 'A', value: '10', priority: 5 }), promo({ id: 'b', name: 'B', value: '15' }), promo({ id: 'c', name: 'C', value: '15', priority: 9 })];
    expect(priceCart(rules, [line(1)], AT)[0]!.promotionName).toBe('C');
  });

  it('respeta producto, categoría, fechas, días y horario (con ventanas que cruzan medianoche)', () => {
    expect(priceCart([promo({ productIds: ['otro'] })], [line(1)], AT)[0]!.promoDiscount.toNumber()).toBe(0);
    expect(priceCart([promo({ categoryIds: ['cat'] })], [{ ...line(1), categoryId: 'cat' }], AT)[0]!.promoDiscount.toNumber()).toBe(10);
    expect(isPromoActiveAt(promo({ weekdays: [4] }), AT)).toBe(true); // jueves
    expect(isPromoActiveAt(promo({ weekdays: [5] }), AT)).toBe(false);
    expect(isPromoActiveAt(promo({ timeFrom: '13:00', timeTo: '15:00' }), AT)).toBe(true);
    expect(isPromoActiveAt(promo({ timeFrom: '22:00', timeTo: '02:00' }), AT)).toBe(false);
    expect(isPromoActiveAt(promo({ timeFrom: '22:00', timeTo: '02:00' }), new Date('2026-10-16T05:30:00Z'))).toBe(true); // 01:30 RD
    expect(isPromoActiveAt(promo({ endsAt: '2026-10-15T17:00:00Z' }), AT)).toBe(false);
    expect(isPromoActiveAt(promo({ active: false }), AT)).toBe(false);
  });

  it('carrito: promoción, descuento manual e ITBIS por línea, redondeado a centavos', () => {
    const products = new Map([['p1', product({ salePrice: '33.33' })]]);
    const lines = quoteCart([{ productId: 'p1', quantity: 3, discount: 5 }], products, [promo({ value: '10' })], AT);
    // 99.99 − 10.00 (promo) − 5.00 (manual) = 84.99; ITBIS 18 % = 15.30
    expect(lines[0]!.net.toFixed(2)).toBe('84.99');
    expect(lines[0]!.tax.toFixed(2)).toBe('15.30');
    const t = sumQuote(lines);
    expect(t.total.toFixed(2)).toBe('100.29');
    expect(t.promo.plus(t.discount).toFixed(2)).toBe('15.00');
  });

  it('ignora en el carrito productos que ya no están en el catálogo', () => {
    const lines = quoteCart([{ productId: 'borrado', quantity: 1, discount: 0 }], new Map(), [], AT);
    expect(lines).toHaveLength(0);
  });

  it('precio con ITBIS para la tarjeta del producto', () => {
    expect(priceWithTax(product({ salePrice: '100' }))).toBe('118.00');
    expect(priceWithTax(product({ salePrice: '100', tax: null }))).toBe('100.00');
  });
});
