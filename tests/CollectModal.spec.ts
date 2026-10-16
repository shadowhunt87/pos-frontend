import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import CollectModal from '@/components/store/CollectModal.vue';
import { ApiError } from '@/api/errors';
import type { InvoiceDetail } from '@/types/api';

vi.mock('@/api/store', () => ({ collectInvoice: vi.fn(), getFunds: vi.fn() }));
import { collectInvoice, getFunds } from '@/api/store';

const invoice = { id: 'inv1', number: 'FV-000014', balance: '350.00', partner: { name: 'Ferretería' } } as unknown as InvoiceDetail;
const $ = <T extends Element>(s: string) => document.body.querySelector<T>(s)!;

async function mountModal() {
  const w = mount(CollectModal, { attachTo: document.body, props: { open: false, invoice } });
  await w.setProps({ open: true });
  await flushPromises();
  return w;
}

async function type(selector: string, value: string) {
  const el = $<HTMLInputElement | HTMLSelectElement>(selector);
  el.value = value;
  el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? 'change' : 'input'));
  await flushPromises();
}

describe('CollectModal (cobro de una factura)', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.mocked(collectInvoice).mockReset();
    vi.mocked(getFunds).mockResolvedValue({ cashRegisters: [{ id: 'caja1', name: 'Caja principal' }], bankAccounts: [{ id: 'b1', bankName: 'Banco', accountNumber: '001' }] });
  });

  it('propone el saldo y elige la única caja', async () => {
    await mountModal();
    expect($<HTMLInputElement>('#collect-amount').value).toBe('350.00');
    expect($<HTMLSelectElement>('#collect-fund').value).toBe('caja1');
  });

  it('no deja cobrar más que el saldo', async () => {
    await mountModal();
    await type('#collect-amount', '350.01');
    expect(document.body.textContent).toContain('No puede pasar del saldo pendiente');
    $<HTMLFormElement>('#collect-form').dispatchEvent(new Event('submit'));
    await flushPromises();
    expect(collectInvoice).not.toHaveBeenCalled();
  });

  it('cobro parcial con transferencia va al banco con su referencia', async () => {
    vi.mocked(collectInvoice).mockResolvedValue({ ...invoice, balance: '250.00' });
    const w = await mountModal();
    await type('#collect-amount', '100');
    [...document.body.querySelectorAll<HTMLButtonElement>('[role=radio]')].find((b) => b.textContent?.includes('Transferencia'))!.click();
    await flushPromises();
    await type('#collect-fund', 'b1');
    await type('#collect-ref', 'TRF-889');
    $<HTMLFormElement>('#collect-form').dispatchEvent(new Event('submit'));
    await flushPromises();
    expect(collectInvoice).toHaveBeenCalledWith('inv1', { amount: 100, method: 'TRANSFER', bankAccountId: 'b1', reference: 'TRF-889' });
    expect(w.emitted('done')?.[0]?.[0]).toMatchObject({ balance: '250.00' });
  });

  it('muestra el error del backend tal cual', async () => {
    vi.mocked(collectInvoice).mockRejectedValue(new ApiError('Esta factura no tiene saldo pendiente', 422));
    await mountModal();
    $<HTMLFormElement>('#collect-form').dispatchEvent(new Event('submit'));
    await flushPromises();
    expect(document.body.textContent).toContain('Esta factura no tiene saldo pendiente');
  });
});
