import Decimal from 'decimal.js';
import type { PosTicket } from '@/types/api';
import { formatAmount, formatDateTime, formatNumber } from './format';
import { METHOD_LABEL, NCF_NAME } from './labels';

const esc = (s: string | null | undefined) =>
  (s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);

/** HTML del ticket de 80 mm con los datos que devuelve el backend (empresa, NCF, líneas, pagos, e-CF). */
export function ticketHtml(t: PosTicket): string {
  const s = t.sale;
  const lines = s.lines
    .map((l) => {
      const net = new Decimal(l.quantity).times(l.unitPrice).minus(l.discount).minus(l.promoDiscount);
      const disc = new Decimal(l.discount).plus(l.promoDiscount);
      return `<tr><td colspan="2">${esc(l.description)}</td></tr>
      <tr><td class="dim">${formatNumber(l.quantity)} × ${formatAmount(l.unitPrice)}${disc.gt(0) ? `<br>desc. −${formatAmount(disc.toFixed(2))}` : ''}</td><td class="r">${formatAmount(net.toFixed(2))}</td></tr>`;
    })
    .join('');
  const pays = s.payments
    .map((p) => `<tr><td>${METHOD_LABEL[p.method]}${p.tendered ? ` (recibido ${formatAmount(p.tendered)})` : ''}</td><td class="r">${formatAmount(p.amount)}</td></tr>`)
    .join('');
  const savings = new Decimal(s.promoTotal).plus(s.discountTotal);
  const company = t.company;
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Ticket ${esc(s.number)}</title><style>
    @page { size: 80mm auto; margin: 4mm; } body { font: 12px/1.35 ui-monospace, Consolas, monospace; width: 72mm; margin: 0 auto; color: #000; }
    h1 { font-size: 14px; text-align: center; margin: 0 0 2px; } .c { text-align: center; } .r { text-align: right; white-space: nowrap; } .dim { color: #333; }
    table { width: 100%; border-collapse: collapse; } hr { border: 0; border-top: 1px dashed #000; margin: 6px 0; } .tot td { font-weight: bold; font-size: 14px; }
  </style></head><body>
    <h1>${esc(company.legalName || company.name)}</h1>
    <div class="c">RNC ${esc(company.taxId)}${company.address ? `<br>${esc(company.address)}` : ''}${company.phone ? `<br>Tel. ${esc(company.phone)}` : ''}</div>
    <hr><div class="c"><strong>${esc(NCF_NAME[t.ncfType] ?? 'Comprobante')}</strong><br>NCF ${esc(s.ncf ?? 'pendiente')}</div>
    <hr>Ticket ${esc(s.number)} · Factura ${esc(s.invoiceNumber)}<br>${esc(formatDateTime(t.issuedAt))}${t.cashier ? `<br>Cajero: ${esc(t.cashier)}` : ''}
    ${s.partner ? `<br>Cliente: ${esc(s.partner.name)}${s.partner.taxId ? ` · ${esc(s.partner.taxId)}` : ''}` : ''}
    <hr><table>${lines}</table><hr>
    <table>
      <tr><td>Subtotal</td><td class="r">${formatAmount(s.subtotal)}</td></tr>
      ${savings.gt(0) ? `<tr><td>Descuentos incluidos</td><td class="r">${formatAmount(savings.toFixed(2))}</td></tr>` : ''}
      <tr><td>ITBIS</td><td class="r">${formatAmount(s.taxTotal)}</td></tr>
      <tr class="tot"><td>TOTAL RD$</td><td class="r">${formatAmount(s.total)}</td></tr>
    </table><hr><table>${pays}${new Decimal(s.changeGiven).gt(0) ? `<tr><td>Cambio</td><td class="r">${formatAmount(s.changeGiven)}</td></tr>` : ''}</table>
    ${t.ecf?.securityCode ? `<hr><div class="c">Código de seguridad: ${esc(t.ecf.securityCode)}</div>` : ''}
    ${s.status === 'VOIDED' ? '<hr><div class="c"><strong>*** ANULADA ***</strong></div>' : ''}
    <hr><div class="c">${esc(t.footer ?? 'Gracias por su compra')}</div>
    <script>window.onload = () => { window.print(); setTimeout(() => window.close(), 300); };</script>
  </body></html>`;
}

/** Abre el ticket en una ventana aparte (así se imprime solo el ticket, sin la pantalla de la caja). */
export function printTicket(t: PosTicket): boolean {
  const w = window.open('', '_blank', 'width=420,height=640');
  if (!w) return false;
  w.document.open();
  w.document.write(ticketHtml(t));
  w.document.close();
  return true;
}
