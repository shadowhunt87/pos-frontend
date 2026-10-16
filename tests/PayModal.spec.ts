import { beforeEach, describe, expect, it } from 'vitest';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import PayModal from '@/components/caja/PayModal.vue';

const $ = <T extends Element>(selector: string) => {
  const el = document.body.querySelector<T>(selector);
  if (!el) throw new Error(`No existe ${selector}`);
  return el;
};

async function mountModal(total = '1180.00', canCredit = false) {
  const wrapper = mount(PayModal, { attachTo: document.body, props: { open: false, total, canCredit } });
  await wrapper.setProps({ open: true });
  await flushPromises();
  return wrapper;
}

async function type(selector: string, value: string) {
  const input = $<HTMLInputElement>(selector);
  input.value = value;
  input.dispatchEvent(new Event('input'));
  await flushPromises();
}

async function click(el: Element) {
  (el as HTMLElement).click();
  await flushPromises();
}

const button = (text: string) => {
  const b = [...document.body.querySelectorAll('button')].find((x) => x.textContent?.trim().startsWith(text));
  if (!b) throw new Error(`No hay botón «${text}»`);
  return b;
};

async function addAmount(value: string) {
  await type('#pay-amount', value);
  $<HTMLFormElement>('form').dispatchEvent(new Event('submit'));
  await flushPromises();
}

const confirmed = (w: VueWrapper) => w.emitted('confirm') as [{ payments: unknown[]; allowCredit: boolean }][] | undefined;

describe('PayModal (cobro)', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('propone el total y cobra exacto en efectivo con un toque', async () => {
    const w = await mountModal();
    expect($<HTMLInputElement>('#pay-amount').value).toBe('1180.00');
    await click($('[data-test="pay-confirm"]'));
    expect(confirmed(w)?.[0]?.[0]).toEqual({ payments: [{ method: 'CASH', amount: 1180 }], allowCredit: false });
  });

  it('calcula el cambio cuando el cliente entrega de más', async () => {
    const w = await mountModal('1180.00');
    await addAmount('2000');
    expect($('[data-test="pay-change"]').textContent).toContain('820.00');
    await click($('[data-test="pay-confirm"]'));
    expect(confirmed(w)?.[0]?.[0].payments).toEqual([{ method: 'CASH', amount: 2000 }]);
  });

  it('pago mixto: tarjeta con referencia y el resto en efectivo', async () => {
    const w = await mountModal('1000.00');
    await click(button('Tarjeta'));
    await type('#pay-ref', 'AUT-778');
    await addAmount('600');
    expect($('[data-test="pay-pending"]').textContent).toContain('400.00');
    await click(button('Efectivo'));
    expect($<HTMLInputElement>('#pay-amount').value).toBe('400.00');
    await addAmount('400');
    await click($('[data-test="pay-confirm"]'));
    expect(confirmed(w)?.[0]?.[0].payments).toEqual([
      { method: 'CARD', amount: 600, reference: 'AUT-778' },
      { method: 'CASH', amount: 400 },
    ]);
  });

  it('no deja pasar del total con tarjeta: el cambio solo es en efectivo', async () => {
    const w = await mountModal('500.00');
    await click(button('Tarjeta'));
    await addAmount('600');
    expect(document.body.textContent).toContain('el cambio solo se da en efectivo');
    expect(document.body.querySelector('[aria-label="Pagos agregados"]')).toBeNull();
    expect(w.emitted('confirm')).toBeUndefined();
  });

  it('valida el monto', async () => {
    await mountModal();
    await addAmount('10.555');
    expect(document.body.textContent).toContain('hasta 2 decimales');
  });

  it('si falta dinero no confirma, salvo que el cliente pueda quedar a crédito', async () => {
    const w = await mountModal('1000.00');
    await addAmount('300');
    expect(($('[data-test="pay-confirm"]') as HTMLButtonElement).disabled).toBe(true);
    expect(document.body.textContent).not.toContain('a crédito');
    w.unmount();

    document.body.innerHTML = '';
    const w2 = await mountModal('1000.00', true);
    await addAmount('300');
    const credit = [...document.body.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')][0]!;
    credit.checked = true;
    credit.dispatchEvent(new Event('change'));
    await flushPromises();
    await click($('[data-test="pay-confirm"]'));
    expect(confirmed(w2)?.[0]?.[0]).toEqual({ payments: [{ method: 'CASH', amount: 300 }], allowCredit: true });
  });

  it('muestra el error del backend tal cual', async () => {
    const w = await mountModal();
    await w.setProps({ error: 'Falta cobrar 180.00' });
    expect(document.body.textContent).toContain('Falta cobrar 180.00');
  });
});
