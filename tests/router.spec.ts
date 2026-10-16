import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import router from '@/router';
import { useAuthStore } from '@/stores/auth';
import type { Role } from '@/types/api';
import { can } from '@/utils/permissions';
import { makeToken } from './helpers';

const future = Math.floor(Date.now() / 1000) + 3600;

function signIn(role: Role) {
  const auth = useAuthStore();
  const token = makeToken({ sub: 'u1', email: 'x@sirtech.do', role, companyId: 'c1', exp: future });
  window.localStorage.setItem('pos.token', token);
  window.localStorage.setItem('pos.user', JSON.stringify({ id: 'u1', email: 'x@sirtech.do', name: 'X', role, companyId: 'c1' }));
  auth.restore();
  return auth;
}

async function go(path: string) {
  await router.push(path);
  return router.currentRoute.value.name;
}

describe('rutas y permisos por rol', () => {
  beforeEach(async () => {
    setActivePinia(createPinia());
    window.localStorage.clear();
    useAuthStore().logout();
    await router.push('/login').catch(() => undefined);
  });

  it('sin sesión manda al login y recuerda adónde iba', async () => {
    await router.push('/turnos');
    expect(router.currentRoute.value.name).toBe('login');
    expect(router.currentRoute.value.query.redirect).toBe('/turnos');
  });

  it('cajero: caja y cobro de facturas; nada de almacén ni administración', async () => {
    signIn('CASHIER');
    expect(await go('/caja')).toBe('caja');
    expect(await go('/facturas')).toBe('facturas');
    expect(await go('/productos')).toBe('productos');
    expect(await go('/facturas/nueva')).toBe('caja');
    expect(await go('/compras')).toBe('caja');
    expect(await go('/turnos')).toBe('caja');
    expect(await go('/configuracion')).toBe('caja');
    expect(await go('/contabilidad')).toBe('caja');
  });

  it('vendedor: facturas y clientes; no la caja, el almacén ni la administración', async () => {
    signIn('SELLER');
    expect(await go('/')).toBe('facturas');
    expect(await go('/facturas/nueva')).toBe('nueva-factura');
    expect(await go('/clientes')).toBe('clientes');
    expect(await go('/productos')).toBe('productos');
    expect(await go('/caja')).toBe('facturas');
    expect(await go('/compras')).toBe('facturas');
    expect(await go('/usuarios')).toBe('facturas');
  });

  it('almacén: productos, inventario, compras y proveedores; no vende', async () => {
    signIn('WAREHOUSE');
    expect(await go('/')).toBe('inventario');
    expect(await go('/compras/nueva')).toBe('nueva-compra');
    expect(await go('/proveedores')).toBe('proveedores');
    expect(await go('/inventario/p1')).toBe('kardex');
    expect(await go('/facturas')).toBe('inventario');
    expect(await go('/clientes')).toBe('inventario');
    expect(await go('/caja')).toBe('inventario');
  });

  it('supervisor: caja, facturas, turnos y reportes; no configura', async () => {
    signIn('APPROVER');
    expect(await go('/')).toBe('inicio');
    expect(await go('/turnos')).toBe('turnos');
    expect(await go('/reportes')).toBe('reportes');
    expect(await go('/facturas/nueva')).toBe('nueva-factura');
    expect(await go('/configuracion')).toBe('inicio');
    expect(await go('/contabilidad')).toBe('inicio');
  });

  it('contador: todo el POS y la contabilidad, sin usuarios', async () => {
    signIn('ACCOUNTANT');
    expect(await go('/configuracion')).toBe('configuracion');
    expect(await go('/contabilidad')).toBe('contabilidad');
    expect(await go('/compras/nueva')).toBe('nueva-compra');
    expect(await go('/usuarios')).toBe('inicio');
  });

  it('administrador: también los usuarios', async () => {
    signIn('ADMIN');
    expect(await go('/usuarios')).toBe('usuarios');
    expect(await go('/login')).toBe('inicio');
  });

  it('las rutas de la primera versión siguen funcionando', async () => {
    signIn('ADMIN');
    expect(await go('/admin/turnos')).toBe('turnos');
  });

  it('consulta y auditor no usan el POS', async () => {
    signIn('VIEWER');
    expect(await go('/caja')).toBe('sin-acceso');
    expect(await go('/facturas')).toBe('sin-acceso');
  });

  it('una sesión vencida guardada no se restaura', () => {
    const auth = useAuthStore();
    window.localStorage.setItem('pos.token', makeToken({ sub: 'u1', email: 'x@sirtech.do', role: 'ADMIN', companyId: 'c1', exp: 1000 }));
    window.localStorage.setItem('pos.user', JSON.stringify({ id: 'u1', email: 'x@sirtech.do', name: 'X', role: 'ADMIN', companyId: 'c1' }));
    auth.restore();
    expect(auth.isAuthenticated).toBe(false);
    expect(window.localStorage.getItem('pos.token')).toBeNull();
  });

  it('los grupos de permisos son los del backend', () => {
    expect(can('SELLER', 'vender')).toBe(true);
    expect(can('SELLER', 'cobrar')).toBe(false);
    expect(can('CASHIER', 'cobrar')).toBe(true);
    expect(can('CASHIER', 'vender')).toBe(false);
    expect(can('WAREHOUSE', 'editarCatalogo')).toBe(true);
    expect(can('WAREHOUSE', 'anularInventario')).toBe(false);
    expect(can('APPROVER', 'anularFacturas')).toBe(true);
    expect(can('ACCOUNTANT', 'contabilidad')).toBe(true);
    expect(can('ACCOUNTANT', 'usuarios')).toBe(false);
    expect(can('VIEWER', 'catalogo')).toBe(false);
  });
});
