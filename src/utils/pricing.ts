import Decimal from 'decimal.js';
import type { PosProduct, PosPromotion } from '@/types/api';

/**
 * Copia del motor de precios del backend (src/verticals/pos/pricing.ts del módulo financiero) con decimal.js, para que el
 * carrito muestre lo mismo que cobrará el servidor. El servidor siempre recalcula: la venta lleva `expectedTotal` y, si
 * el total no coincide, responde 409 TOTAL_MISMATCH y no cobra. Precios SIN ITBIS: el impuesto lo calcula la factura.
 */
export const r2 = (d: Decimal) => d.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
const D = (v: Decimal.Value | null | undefined) => new Decimal(v ?? 0);

/** Hora de Santo Domingo (UTC−4, sin horario de verano): día de la semana y minuto del día. */
export function drClock(at: Date) {
  const local = new Date(at.getTime() - 4 * 3_600_000);
  return { dow: local.getUTCDay(), minute: local.getUTCHours() * 60 + local.getUTCMinutes() };
}

const minuteOf = (hhmm: string | null) => {
  const m = hhmm ? /^(\d{2}):(\d{2})$/.exec(hhmm) : null;
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

export function isPromoActiveAt(p: PosPromotion, at: Date): boolean {
  if (!p.active) return false;
  if (p.startsAt && at < new Date(p.startsAt)) return false;
  if (p.endsAt && at > new Date(p.endsAt)) return false;
  const { dow, minute } = drClock(at);
  if (p.weekdays.length && !p.weekdays.includes(dow)) return false;
  const from = minuteOf(p.timeFrom);
  const to = minuteOf(p.timeTo);
  if (from !== null && to !== null) {
    // Ventanas que cruzan medianoche (22:00–02:00)
    const inside = from <= to ? minute >= from && minute < to : minute >= from || minute < to;
    if (!inside) return false;
  }
  return true;
}

export interface CartLine {
  productId: string;
  categoryId: string | null;
  quantity: Decimal;
  unitPrice: Decimal;
}

export interface PricedLine {
  gross: Decimal;
  promoDiscount: Decimal;
  promotionName: string | null;
}

/** Descuento (monto) que da una promoción a una línea. */
export function promoDiscount(p: PosPromotion, l: CartLine): Decimal {
  const gross = l.quantity.times(l.unitPrice);
  if (l.quantity.lte(0) || l.unitPrice.lte(0)) return D(0);
  switch (p.type) {
    case 'PERCENT':
      return r2(gross.times(Decimal.min(100, Decimal.max(0, D(p.value)))).div(100));
    case 'BUY_X_PAY_Y': {
      const buy = p.buyQty ?? 0;
      const pay = p.payQty ?? 0;
      if (buy <= 0 || pay < 0 || pay >= buy) return D(0);
      return r2(l.quantity.div(buy).floor().times(buy - pay).times(l.unitPrice));
    }
    case 'FIXED_PRICE': {
      const fixed = D(p.value);
      return fixed.gte(l.unitPrice) ? D(0) : r2(l.quantity.times(l.unitPrice.minus(fixed)));
    }
  }
}

/** Por línea, la promoción que más descuenta (empate: mayor prioridad). */
export function priceCart(rules: PosPromotion[], lines: CartLine[], at: Date): PricedLine[] {
  const active = rules.filter((r) => isPromoActiveAt(r, at));
  return lines.map((l) => {
    const gross = r2(l.quantity.times(l.unitPrice));
    let best: PricedLine = { gross, promoDiscount: D(0), promotionName: null };
    let bestPriority = -Infinity;
    for (const r of active) {
      const applies =
        (!r.productIds.length && !r.categoryIds.length) ||
        r.productIds.includes(l.productId) ||
        (!!l.categoryId && r.categoryIds.includes(l.categoryId));
      if (!applies) continue;
      const d = Decimal.min(promoDiscount(r, l), gross);
      if (d.lte(0)) continue;
      if (d.gt(best.promoDiscount) || (d.eq(best.promoDiscount) && r.priority > bestPriority)) {
        best = { gross, promoDiscount: d, promotionName: r.name };
        bestPriority = r.priority;
      }
    }
    return best;
  });
}

export interface CartItem {
  productId: string;
  quantity: number;
  /** Descuento manual en RD$, sin ITBIS, sobre lo que queda después de la promoción */
  discount: number;
}

export interface QuotedLine {
  item: CartItem;
  product: PosProduct;
  gross: Decimal;
  promo: Decimal;
  promoName: string | null;
  discount: Decimal;
  net: Decimal;
  tax: Decimal;
  total: Decimal;
}

export interface QuoteTotals {
  items: number;
  gross: Decimal;
  promo: Decimal;
  discount: Decimal;
  subtotal: Decimal;
  tax: Decimal;
  total: Decimal;
}

/** Carrito con promoción, descuento e ITBIS por línea, como lo calcula la factura del núcleo. */
export function quoteCart(items: CartItem[], products: Map<string, PosProduct>, promotions: PosPromotion[], at: Date): QuotedLine[] {
  const known = items.filter((i) => products.has(i.productId));
  const priced = priceCart(
    promotions,
    known.map((i) => {
      const p = products.get(i.productId)!;
      return { productId: p.id, categoryId: p.categoryId, quantity: D(i.quantity), unitPrice: D(p.salePrice) };
    }),
    at,
  );
  return known.map((item, k) => {
    const product = products.get(item.productId)!;
    const { gross, promoDiscount: promo, promotionName } = priced[k]!;
    const discount = r2(D(item.discount || 0));
    const net = r2(gross.minus(promo).minus(discount));
    const tax = product.tax ? r2(net.times(product.tax.rate).div(100)) : D(0);
    return { item, product, gross, promo, promoName: promotionName, discount, net, tax, total: net.plus(tax) };
  });
}

export function sumQuote(lines: QuotedLine[]): QuoteTotals {
  const sum = (f: (l: QuotedLine) => Decimal) => lines.reduce((a, l) => a.plus(f(l)), D(0));
  const subtotal = sum((l) => l.net);
  const tax = sum((l) => l.tax);
  return {
    items: lines.reduce((a, l) => a + l.item.quantity, 0),
    gross: sum((l) => l.gross),
    promo: sum((l) => l.promo),
    discount: sum((l) => l.discount),
    subtotal,
    tax,
    total: subtotal.plus(tax),
  };
}

/** Precio de venta con su ITBIS, para mostrar en la tarjeta del producto. */
export function priceWithTax(p: PosProduct): string {
  const base = D(p.salePrice);
  return r2(p.tax ? base.plus(base.times(p.tax.rate).div(100)) : base).toFixed(2);
}
