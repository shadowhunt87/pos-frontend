import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AxiosAdapter } from 'axios';
import { configureSession, http, publicHttp } from '@/api/client';
import { ApiError } from '@/api/errors';
import { login, loginTwoFactor } from '@/api/auth';
import { createSale, getCurrentShift, requestApproval } from '@/api/pos';
import { getSettings, listCustomers } from '@/api/admin';
import { bearer, fakeAdapter } from './helpers';

const originalHttp = http.defaults.adapter;
const originalPublic = publicHttp.defaults.adapter;

function use(adapter: AxiosAdapter) {
  http.defaults.adapter = adapter;
  publicHttp.defaults.adapter = adapter;
}

describe('capa de API', () => {
  const onUnauthorized = vi.fn();

  beforeEach(() => {
    onUnauthorized.mockReset();
    configureSession({ getToken: () => 'token-123', onUnauthorized });
  });

  afterEach(() => {
    http.defaults.adapter = originalHttp;
    publicHttp.defaults.adapter = originalPublic;
  });

  it('agrega el Bearer y manda la venta tal cual al backend', async () => {
    const fake = fakeAdapter(() => ({ status: 201, data: { id: 's1', number: 'TK-000001' } }));
    use(fake.adapter);
    await createSale({
      clientUuid: 'abcdef12-3456',
      shiftId: 'sh1',
      lines: [{ productId: 'p1', quantity: 2 }],
      payments: [{ method: 'CASH', amount: 500 }],
      expectedTotal: 236,
    });
    const call = fake.calls[0]!;
    expect(bearer(call)).toBe('Bearer token-123');
    expect(call.method).toBe('post');
    expect(call.url).toBe('/pos/sales');
    expect(JSON.parse(String(call.data))).toMatchObject({ clientUuid: 'abcdef12-3456', expectedTotal: 236, payments: [{ method: 'CASH', amount: 500 }] });
  });

  it('no manda token al login ni al segundo paso del 2FA', async () => {
    const fake = fakeAdapter(() => ({ status: 200, data: { access_token: 'x', user: {} } }));
    use(fake.adapter);
    await login({ email: 'a@b.com', password: '12345678' });
    await loginTwoFactor('desafio', '123456');
    expect(bearer(fake.calls[0]!)).toBeUndefined();
    expect(bearer(fake.calls[1]!)).toBeUndefined();
    expect(fake.calls[1]!.url).toBe('/auth/login/2fa');
  });

  it('cierra la sesión ante un 401 de una ruta autenticada, pero no en el login', async () => {
    use(fakeAdapter(() => ({ status: 401, data: { message: 'Unauthorized', statusCode: 401 } })).adapter);
    await expect(getSettings()).rejects.toBeInstanceOf(ApiError);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
    await expect(login({ email: 'a@b.com', password: 'malaclave' })).rejects.toMatchObject({ status: 401 });
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('traduce los mensajes genéricos de Nest y deja pasar los del negocio', async () => {
    use(fakeAdapter(() => ({ status: 403, data: { message: 'Forbidden resource', error: 'Forbidden', statusCode: 403 } })).adapter);
    await expect(getSettings()).rejects.toThrow('Tu usuario no tiene permiso para esta acción.');
    use(fakeAdapter(() => ({ status: 401, data: { message: 'Credenciales inválidas', statusCode: 401 } })).adapter);
    await expect(login({ email: 'a@b.com', password: 'malaclave' })).rejects.toThrow('Credenciales inválidas');
  });

  it('une los mensajes de validación con saltos de línea', async () => {
    use(fakeAdapter(() => ({ status: 400, data: { message: ['amount must be positive', 'shiftId must be a UUID'], error: 'Bad Request', statusCode: 400 } })).adapter);
    await expect(getSettings()).rejects.toThrow('amount must be positive\nshiftId must be a UUID');
  });

  it('conserva el código de negocio del POS y sus datos extra', async () => {
    use(fakeAdapter(() => ({ status: 422, data: { code: 'APPROVAL_REQUIRED', message: 'Esta acción necesita la autorización de un supervisor', action: 'VOID' } })).adapter);
    const err = await requestApproval({ action: 'VOID', supervisorEmail: 's@x.com', pin: '1234' }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).code).toBe('APPROVAL_REQUIRED');
    expect((err as ApiError).body?.action).toBe('VOID');
    expect((err as ApiError).status).toBe(422);
  });

  it('avisa si no hay conexión', async () => {
    const adapter: AxiosAdapter = async (config) => {
      const { AxiosError } = await import('axios');
      throw new AxiosError('Network Error', 'ERR_NETWORK', config);
    };
    use(adapter);
    await expect(getSettings()).rejects.toThrow('No se pudo conectar con el servidor');
  });

  it('turno actual: cuerpo vacío es «sin turno»', async () => {
    use(fakeAdapter(() => ({ status: 200, data: '' })).adapter);
    await expect(getCurrentShift('t1')).resolves.toBeNull();
  });

  it('recorre todas las páginas de clientes y deja fuera proveedores e inactivos', async () => {
    const fake = fakeAdapter((config) => {
      const page = Number((config.params as { page: number }).page);
      const data =
        page === 1
          ? [{ id: 'c1', type: 'CUSTOMER', name: 'A', taxId: null, active: true }, { id: 'c2', type: 'SUPPLIER', name: 'B', taxId: null, active: true }]
          : [{ id: 'c3', type: 'BOTH', name: 'C', taxId: null, active: true }, { id: 'c4', type: 'CUSTOMER', name: 'D', taxId: null, active: false }];
      return { status: 200, data: { data, total: 4, page, limit: 100 } };
    });
    use(fake.adapter);
    const list = await listCustomers();
    expect(fake.calls).toHaveLength(2);
    expect(list.map((c) => c.id)).toEqual(['c1', 'c3']);
  });
});
