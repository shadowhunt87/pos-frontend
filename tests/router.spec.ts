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
  auth.restore();
  const token = makeToken({ sub: 'u1', email: 'x@sirtech.do', role, companyId: 'c1', exp: future });
  window.localStorage.setItem('pos.token', token);
  window.localStorage.setItem('pos.user', JSON.stringify({ id: 'u1', email: 'x@sirtech.do', name: 'X', role, companyId: 'c1' }));
  auth.restore();
  return auth;
}

async function go(path: string) {
  await router.push(path);
  return router.currentRoute.value;
}

describe('rutas y permisos', () => {
  beforeEach(async () => {
    setActivePinia(createPinia());
    await router.push('/login').catch(() => undefined);
  });

  it('sin sesión manda al login y recuerda adónde iba', async () => {
    const r = await go('/admin/turnos');
    expect(r.name).toBe('login');
    expect(r.query.redirect).toBe('/admin/turnos');
  });

  it('el cajero solo entra a la caja', async () => {
    signIn('CASHIER');
    expect((await go('/caja')).name).toBe('caja');
    expect((await go('/admin/turnos')).name).toBe('caja');
    expect((await go('/admin/configuracion')).name).toBe('caja');
  });

  it('el aprobador ve turnos y ventas, no la configuración', async () => {
    signIn('APPROVER');
    expect((await go('/admin/turnos')).name).toBe('turnos');
    expect((await go('/admin/reportes')).name).toBe('reportes');
    expect((await go('/admin/promociones')).name).toBe('caja');
  });

  it('el contador y el administrador configuran', async () => {
    signIn('ACCOUNTANT');
    expect((await go('/admin/configuracion')).name).toBe('configuracion');
    expect((await go('/admin')).name).toBe('turnos');
  });

  it('consulta y auditor no usan el POS', async () => {
    signIn('VIEWER');
    expect((await go('/caja')).name).toBe('sin-acceso');
    expect((await go('/admin/turnos')).name).toBe('sin-acceso');
  });

  it('con sesión, el login lleva a la caja', async () => {
    signIn('ADMIN');
    await go('/admin/turnos');
    expect((await go('/login')).name).toBe('caja');
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
    expect(['CASHIER', 'APPROVER', 'ACCOUNTANT', 'ADMIN'].every((r) => can(r as Role, 'caja'))).toBe(true);
    expect(can('CASHIER', 'supervisar')).toBe(false);
    expect(can('APPROVER', 'configurar')).toBe(false);
    expect(can('VIEWER', 'caja')).toBe(false);
  });
});
