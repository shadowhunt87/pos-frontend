import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { configureSession, http } from '@/api/client';
import { collectInvoice, createInvoice, createPurchase, listPartners, listProducts, saveProduct } from '@/api/store';
import { createUser } from '@/api/users';
import { bearer, fakeAdapter } from './helpers';

const original = http.defaults.adapter;

describe('API de tienda', () => {
  beforeEach(() => configureSession({ getToken: () => 'tok', onUnauthorized: () => undefined }));
  afterEach(() => {
    http.defaults.adapter = original;
  });

  it('usa las rutas /pos/store con el token y sin filtros vacíos', async () => {
    const fake = fakeAdapter(() => ({ status: 200, data: { data: [], total: 0, page: 1, limit: 50 } }));
    http.defaults.adapter = fake.adapter;
    await listProducts({ q: '', categoryId: undefined, outOfStock: true, page: 2 });
    await listPartners('suppliers', { q: 'dist' });
    expect(fake.calls[0]!.url).toBe('/pos/store/products');
    expect(fake.calls[0]!.params).toEqual({ outOfStock: true, page: 2 });
    expect(bearer(fake.calls[0]!)).toBe('Bearer tok');
    expect(fake.calls[1]!.url).toBe('/pos/store/suppliers');
  });

  it('crear y editar producto usan POST y PATCH', async () => {
    const fake = fakeAdapter(() => ({ status: 200, data: { id: 'p1' } }));
    http.defaults.adapter = fake.adapter;
    await saveProduct(null, { code: 'A', name: 'A' });
    await saveProduct('p1', { salePrice: 10 });
    expect([fake.calls[0]!.method, fake.calls[0]!.url]).toEqual(['post', '/pos/store/products']);
    expect([fake.calls[1]!.method, fake.calls[1]!.url]).toEqual(['patch', '/pos/store/products/p1']);
  });

  it('factura, compra y cobro mandan el cuerpo tal cual (con su id de reintento)', async () => {
    const fake = fakeAdapter(() => ({ status: 201, data: { id: 'x' } }));
    http.defaults.adapter = fake.adapter;
    await createInvoice({ clientUuid: 'abc-123-xyz', partnerId: 'c1', lines: [{ productId: 'p1', quantity: 2 }] });
    await createPurchase({ clientUuid: 'def-456-xyz', supplierId: 's1', issueDate: '2026-10-16', ncfType: 'B11', lines: [{ productId: 'p1', quantity: 5, unitCost: 20 }] });
    await collectInvoice('inv1', { amount: 50, method: 'CASH', cashRegisterId: 'c1' });
    expect(fake.calls.map((c) => c.url)).toEqual(['/pos/store/invoices', '/pos/store/purchases', '/pos/store/invoices/inv1/payments']);
    expect(JSON.parse(String(fake.calls[0]!.data))).toMatchObject({ clientUuid: 'abc-123-xyz', partnerId: 'c1' });
    expect(JSON.parse(String(fake.calls[1]!.data))).toMatchObject({ ncfType: 'B11' });
  });

  it('crear usuario va a /auth/register con la confirmación del administrador', async () => {
    const fake = fakeAdapter(() => ({ status: 201, data: { id: 'u2' } }));
    http.defaults.adapter = fake.adapter;
    await createUser({ email: 'v@x.do', password: '12345678', name: 'V', role: 'SELLER', confirmPassword: 'admin-pass' });
    expect(fake.calls[0]!.url).toBe('/auth/register');
    expect(JSON.parse(String(fake.calls[0]!.data))).toMatchObject({ role: 'SELLER', confirmPassword: 'admin-pass' });
  });
});
