import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createMemoryHistory, createRouter } from 'vue-router';
import LoginView from '@/views/LoginView.vue';
import { ApiError } from '@/api/errors';
import { useAuthStore } from '@/stores/auth';
import type { Role, SessionUser } from '@/types/api';
import { makeToken } from './helpers';

vi.mock('@/api/auth', () => ({ login: vi.fn(), loginTwoFactor: vi.fn(), enrollStart: vi.fn() }));
import { enrollStart, login, loginTwoFactor } from '@/api/auth';

const future = Math.floor(Date.now() / 1000) + 3600;
const tokenFor = (role: Role) => makeToken({ sub: 'u1', email: 'caja@sirtech.do', role, companyId: 'c1', exp: future });
const userFor = (role: Role): SessionUser => ({ id: 'u1', email: 'caja@sirtech.do', name: 'Ana Caja', role, companyId: 'c1' });

async function setup() {
  const pinia = createPinia();
  setActivePinia(pinia);
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/login', name: 'login', component: LoginView },
      { path: '/caja', name: 'caja', component: { template: '<p>caja</p>' } },
      { path: '/inicio', name: 'inicio', component: { template: '<p>inicio</p>' } },
      { path: '/facturas', name: 'facturas', component: { template: '<p>facturas</p>' } },
      { path: '/inventario', name: 'inventario', component: { template: '<p>inventario</p>' } },
      { path: '/sin-acceso', name: 'sin-acceso', component: { template: '<p>sin acceso</p>' } },
    ],
  });
  await router.push('/login');
  await router.isReady();
  const wrapper = mount(LoginView, { global: { plugins: [pinia, router] } });
  return { wrapper, router, auth: useAuthStore() };
}

async function fill(wrapper: Awaited<ReturnType<typeof setup>>['wrapper'], email: string, password: string) {
  await wrapper.get('#login-email').setValue(email);
  await wrapper.get('#login-password').setValue(password);
  await wrapper.get('form').trigger('submit');
  await flushPromises();
}

describe('LoginView', () => {
  beforeEach(() => {
    vi.mocked(login).mockReset();
    vi.mocked(loginTwoFactor).mockReset();
    vi.mocked(enrollStart).mockReset();
  });

  it('entra y va a la caja', async () => {
    vi.mocked(login).mockResolvedValue({ access_token: tokenFor('CASHIER'), user: userFor('CASHIER') });
    const { wrapper, router, auth } = await setup();
    await fill(wrapper, 'caja@sirtech.do', 'clave-segura');
    expect(login).toHaveBeenCalledWith({ email: 'caja@sirtech.do', password: 'clave-segura' });
    expect(auth.user?.name).toBe('Ana Caja');
    expect(auth.role).toBe('CASHIER');
    expect(router.currentRoute.value.name).toBe('caja');
  });

  it('cada rol de tienda entra a su área', async () => {
    for (const [role, home] of [['SELLER', 'facturas'], ['WAREHOUSE', 'inventario'], ['APPROVER', 'inicio']] as const) {
      vi.mocked(login).mockResolvedValue({ access_token: tokenFor(role), user: userFor(role) });
      const { wrapper, router } = await setup();
      await fill(wrapper, 'x@sirtech.do', 'clave-segura');
      expect(router.currentRoute.value.name).toBe(home);
      wrapper.unmount();
    }
  });

  it('un usuario sin acceso al POS va a «sin acceso»', async () => {
    vi.mocked(login).mockResolvedValue({ access_token: tokenFor('VIEWER'), user: userFor('VIEWER') });
    const { wrapper, router } = await setup();
    await fill(wrapper, 'consulta@sirtech.do', 'clave-segura');
    expect(router.currentRoute.value.name).toBe('sin-acceso');
  });

  it('muestra el mensaje del backend si la clave es incorrecta', async () => {
    vi.mocked(login).mockRejectedValue(new ApiError('Credenciales inválidas', 401));
    const { wrapper, auth } = await setup();
    await fill(wrapper, 'caja@sirtech.do', 'mala');
    expect(wrapper.text()).toContain('Credenciales inválidas');
    expect(auth.isAuthenticated).toBe(false);
  });

  it('no envía con un correo inválido', async () => {
    const { wrapper } = await setup();
    await fill(wrapper, 'no-es-correo', 'clave-segura');
    expect(login).not.toHaveBeenCalled();
  });

  it('pide el código de 2FA y entra con él', async () => {
    vi.mocked(login).mockResolvedValue({ twoFactorRequired: true, challengeToken: 'desafio', expiresInSeconds: 300 });
    vi.mocked(loginTwoFactor).mockResolvedValue({ access_token: tokenFor('ADMIN'), user: userFor('ADMIN') });
    const { wrapper, router } = await setup();
    await fill(wrapper, 'admin@sirtech.do', 'clave-segura');
    expect(wrapper.text()).toContain('Verificación en dos pasos');
    await wrapper.get('#login-code').setValue('123 456');
    await wrapper.get('form').trigger('submit');
    await flushPromises();
    expect(loginTwoFactor).toHaveBeenCalledWith('desafio', '123456');
    expect(router.currentRoute.value.name).toBe('inicio');
  });

  it('inscripción obligatoria: muestra el QR y luego los códigos de emergencia', async () => {
    vi.mocked(login).mockResolvedValue({ twoFactorSetupRequired: true, challengeToken: 'enroll', expiresInSeconds: 600 });
    vi.mocked(enrollStart).mockResolvedValue({ otpauthUri: 'otpauth://x', qrCode: 'data:image/svg+xml;base64,AA==', secret: 'ABCD EFGH', expiresInSeconds: 600 });
    vi.mocked(loginTwoFactor).mockResolvedValue({ access_token: tokenFor('ADMIN'), user: userFor('ADMIN'), recoveryCodes: ['aaaa-1111', 'bbbb-2222'] });
    const { wrapper, router } = await setup();
    await fill(wrapper, 'admin@sirtech.do', 'clave-segura');
    expect(enrollStart).toHaveBeenCalledWith('enroll');
    expect(wrapper.find('img').attributes('src')).toContain('data:image/svg+xml');
    expect(wrapper.text()).toContain('ABCD EFGH');
    await wrapper.get('#login-code').setValue('654321');
    await wrapper.get('form').trigger('submit');
    await flushPromises();
    expect(wrapper.text()).toContain('aaaa-1111');
    expect(router.currentRoute.value.name).toBe('login');
    await wrapper.get('button').trigger('click');
    await flushPromises();
    expect(router.currentRoute.value.name).toBe('inicio');
  });
});
