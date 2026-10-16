import type { InvoiceDetail } from '@/types/api';
import { formatAmount, formatDateOnly, formatNumber } from './format';
import { NCF_NAME, PAYMENT_METHOD_LABEL } from './labels';

const esc = (s: string | null | undefined) =>
  (s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);

/** Factura en tamaño carta con los datos que devuelve el backend (empresa, NCF, líneas, ITBIS, cobros). */
export function invoiceHtml(inv: InvoiceDetail): string {
  const purchase = inv.type === 'PURCHASE';
  const c = inv.company;
  const title = purchase ? 'Factura de compra' : NCF_NAME[inv.ncfType ?? ''] ?? 'Factura';
  const lines = inv.lines
    .map(
      (l) => `<tr><td>${esc(l.description)}</td><td class="r">${formatNumber(l.quantity)}</td><td class="r">${formatAmount(l.unitPrice)}</td>
        <td class="r">${Number(l.discount) ? formatAmount(l.discount) : ''}</td><td class="r">${formatAmount(l.taxAmount)}</td><td class="r">${formatAmount(l.total)}</td></tr>`,
    )
    .join('');
  const pays = inv.payments.filter((p) => p.status !== 'VOIDED');
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${esc(inv.number)}</title><style>
    @page { size: letter; margin: 16mm; } body { font: 12px/1.45 system-ui, sans-serif; color: #111; }
    header { display: flex; justify-content: space-between; gap: 24px; border-bottom: 2px solid #111; padding-bottom: 12px; }
    h1 { font-size: 18px; margin: 0 0 4px; } h2 { font-size: 15px; margin: 0; text-align: right; } .muted { color: #555; }
    .box { margin: 16px 0; display: flex; justify-content: space-between; gap: 24px; } table { width: 100%; border-collapse: collapse; }
    th { text-align: left; border-bottom: 1px solid #111; padding: 6px 4px; font-size: 11px; text-transform: uppercase; }
    td { border-bottom: 1px solid #ddd; padding: 6px 4px; } .r { text-align: right; white-space: nowrap; }
    .tot { margin-left: auto; width: 280px; margin-top: 12px; } .tot td { border: 0; padding: 3px 4px; } .tot .big td { font-size: 15px; font-weight: 700; border-top: 1px solid #111; }
    .void { color: #b42318; font-size: 20px; font-weight: 700; text-align: center; border: 2px solid #b42318; padding: 6px; margin: 12px 0; }
  </style></head><body>
    <header>
      <div><h1>${esc(c.legalName || c.name)}</h1><div class="muted">RNC ${esc(c.taxId)}${c.address ? ` · ${esc(c.address)}` : ''}${c.phone ? ` · Tel. ${esc(c.phone)}` : ''}</div></div>
      <div><h2>${esc(title)}</h2><div class="r">${inv.ncf ? `NCF <strong>${esc(inv.ncf)}</strong><br>` : ''}N.º ${esc(inv.number)}</div></div>
    </header>
    ${inv.status === 'VOIDED' ? '<div class="void">ANULADA</div>' : ''}
    <div class="box">
      <div><strong>${purchase ? 'Proveedor' : 'Cliente'}</strong><br>${esc(inv.partner.name)}${inv.partner.taxId ? `<br>RNC/Cédula ${esc(inv.partner.taxId)}` : ''}${inv.partner.address ? `<br>${esc(inv.partner.address)}` : ''}</div>
      <div class="r">Fecha: ${esc(formatDateOnly(inv.issueDate))}${inv.dueDate ? `<br>Vence: ${esc(formatDateOnly(inv.dueDate))}` : ''}</div>
    </div>
    <table><thead><tr><th>Descripción</th><th class="r">Cant.</th><th class="r">Precio</th><th class="r">Desc.</th><th class="r">ITBIS</th><th class="r">Importe</th></tr></thead><tbody>${lines}</tbody></table>
    <table class="tot">
      <tr><td>Subtotal</td><td class="r">${formatAmount(inv.subtotal)}</td></tr>
      ${Number(inv.discountTotal) ? `<tr><td>Descuentos</td><td class="r">−${formatAmount(inv.discountTotal)}</td></tr>` : ''}
      <tr><td>ITBIS</td><td class="r">${formatAmount(inv.taxTotal)}</td></tr>
      <tr class="big"><td>Total RD$</td><td class="r">${formatAmount(inv.total)}</td></tr>
      ${pays.length ? `<tr><td>Saldo pendiente</td><td class="r">${formatAmount(inv.balance)}</td></tr>` : ''}
    </table>
    ${pays.length ? `<p class="muted">Cobros: ${pays.map((p) => `${esc(formatDateOnly(p.date))} ${esc(PAYMENT_METHOD_LABEL[p.method] ?? p.method)} ${formatAmount(p.amount)}`).join(' · ')}</p>` : ''}
    ${inv.notes ? `<p class="muted">${esc(inv.notes)}</p>` : ''}
    <script>window.onload = () => { window.print(); };</script>
  </body></html>`;
}

export function printInvoice(inv: InvoiceDetail): boolean {
  const w = window.open('', '_blank', 'width=900,height=1000');
  if (!w) return false;
  w.document.open();
  w.document.write(invoiceHtml(inv));
  w.document.close();
  return true;
}
