import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import ApprovalModal from '@/components/caja/ApprovalModal.vue';
import { ApiError } from '@/api/errors';
import { useApproval } from '@/composables/useApproval';

vi.mock('@/api/pos', () => ({ requestApproval: vi.fn() }));
import { requestApproval } from '@/api/pos';

const needs = (action: string) => new ApiError('Esta acción necesita la autorización de un supervisor', 422, { code: 'APPROVAL_REQUIRED', message: '…', action });

describe('autorización de supervisor', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.mocked(requestApproval).mockReset();
  });

  it('si el backend no la pide, hace la acción una sola vez', async () => {
    const { run } = useApproval();
    const fn = vi.fn().mockResolvedValue('ok');
    await expect(run(fn)).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith();
  });

  it('con APPROVAL_REQUIRED pide el PIN y reintenta con el approvalId', async () => {
    const { run, action, settle } = useApproval();
    const fn = vi.fn().mockRejectedValueOnce(needs('VOID')).mockResolvedValueOnce('anulada');
    const p = run(fn);
    await flushPromises();
    expect(action.value).toBe('VOID');
    settle('apr-1');
    await expect(p).resolves.toBe('anulada');
    expect(fn).toHaveBeenLastCalledWith('apr-1');
    expect(action.value).toBeNull();
  });

  it('si el cajero cancela el PIN, no reintenta', async () => {
    const { run, settle } = useApproval();
    const fn = vi.fn().mockRejectedValueOnce(needs('RETURN'));
    const p = run(fn);
    await flushPromises();
    settle(null);
    await expect(p).resolves.toBeNull();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('otros errores pasan tal cual', async () => {
    const { run } = useApproval();
    const err = new ApiError('El turno está cerrado: abre uno nuevo', 422, { code: 'SHIFT_CLOSED', message: '…' });
    await expect(run(() => Promise.reject(err))).rejects.toBe(err);
  });

  it('el modal manda correo y PIN, y devuelve el id de la autorización', async () => {
    vi.mocked(requestApproval).mockResolvedValue({ approvalId: 'apr-9', approvedBy: 'Sup', expiresAt: '' });
    const w = mount(ApprovalModal, { attachTo: document.body, props: { action: null } });
    await w.setProps({ action: 'DISCOUNT' });
    await flushPromises();
    expect(document.body.textContent).toContain('un descuento mayor al permitido');
    const email = document.body.querySelector<HTMLInputElement>('#approval-email')!;
    const pin = document.body.querySelector<HTMLInputElement>('#approval-pin')!;
    email.value = 'sup@sirtech.do';
    email.dispatchEvent(new Event('input'));
    pin.value = '4321';
    pin.dispatchEvent(new Event('input'));
    document.body.querySelector<HTMLFormElement>('#approval-form')!.dispatchEvent(new Event('submit'));
    await flushPromises();
    expect(requestApproval).toHaveBeenCalledWith({ action: 'DISCOUNT', supervisorEmail: 'sup@sirtech.do', pin: '4321' });
    expect(w.emitted('approved')?.[0]).toEqual(['apr-9']);
  });

  it('el modal muestra el error y limpia el PIN', async () => {
    vi.mocked(requestApproval).mockRejectedValue(new ApiError('Supervisor o PIN incorrecto', 422));
    const w = mount(ApprovalModal, { attachTo: document.body, props: { action: null } });
    await w.setProps({ action: 'VOID' });
    await flushPromises();
    const email = document.body.querySelector<HTMLInputElement>('#approval-email')!;
    const pin = document.body.querySelector<HTMLInputElement>('#approval-pin')!;
    email.value = 'sup@sirtech.do';
    email.dispatchEvent(new Event('input'));
    pin.value = '0000';
    pin.dispatchEvent(new Event('input'));
    document.body.querySelector<HTMLFormElement>('#approval-form')!.dispatchEvent(new Event('submit'));
    await flushPromises();
    expect(document.body.textContent).toContain('Supervisor o PIN incorrecto');
    expect(pin.value).toBe('');
    expect(w.emitted('approved')).toBeUndefined();
  });
});
