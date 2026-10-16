import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import * as authApi from '@/api/auth';
import type { LoginChallengeResponse, LoginTokenResponse, Role, SessionUser } from '@/types/api';
import { decodeToken, isExpired, ROLES } from '@/utils/jwt';
import { can as canRole, type Permission } from '@/utils/permissions';
import { readStorage, removeStorage, writeStorage } from '@/utils/storage';

const TOKEN_KEY = 'pos.token';
const USER_KEY = 'pos.user';

/** Resultado del primer paso del login: entró, o falta el código de 2FA, o falta activarlo. */
export type LoginStep =
  | { kind: 'done'; recoveryCodes?: string[] }
  | { kind: 'code'; challengeToken: string }
  | { kind: 'enroll'; challengeToken: string };

function isChallenge(r: LoginTokenResponse | LoginChallengeResponse): r is LoginChallengeResponse {
  return 'challengeToken' in r;
}

function parseUser(raw: string | null): SessionUser | null {
  if (!raw) return null;
  try {
    const u: unknown = JSON.parse(raw);
    if (typeof u !== 'object' || u === null) return null;
    const { id, email, name, role, companyId } = u as Record<string, unknown>;
    if (typeof id !== 'string' || typeof email !== 'string' || typeof companyId !== 'string') return null;
    if (typeof role !== 'string' || !ROLES.includes(role as Role)) return null;
    return { id, email, name: typeof name === 'string' ? name : email, role: role as Role, companyId };
  } catch {
    return null;
  }
}

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(null);
  const user = ref<SessionUser | null>(null);
  // Motivo del último cierre de sesión, para avisar en el login.
  const endReason = ref<'expired' | null>(null);
  let expiryTimer: ReturnType<typeof setTimeout> | undefined;

  const isAuthenticated = computed(() => token.value !== null && user.value !== null);
  const role = computed<Role | null>(() => user.value?.role ?? null);

  function startSession(value: string, who: SessionUser): boolean {
    const payload = decodeToken(value);
    if (!payload || isExpired(payload)) {
      logout();
      return false;
    }
    token.value = value;
    // El rol y la empresa salen del token (lo que el backend va a verificar); el nombre, de la respuesta del login
    user.value = { ...who, id: payload.sub, role: payload.role, companyId: payload.companyId, email: payload.email };
    endReason.value = null;
    writeStorage(TOKEN_KEY, value);
    writeStorage(USER_KEY, JSON.stringify(user.value));
    clearTimeout(expiryTimer);
    if (payload.exp !== undefined) {
      const ms = payload.exp * 1000 - Date.now();
      if (ms > 0 && ms < 2 ** 31 - 1) expiryTimer = setTimeout(() => logout('expired'), ms);
    }
    return true;
  }

  // Recupera la sesión guardada al abrir la app.
  function restore(): void {
    const saved = readStorage(TOKEN_KEY);
    const who = parseUser(readStorage(USER_KEY));
    if (saved && who) startSession(saved, who);
    else if (saved) logout();
  }

  function finish(r: LoginTokenResponse): LoginStep {
    if (!startSession(r.access_token, r.user)) throw new Error('El servidor devolvió una sesión inválida');
    return { kind: 'done', ...(r.recoveryCodes?.length ? { recoveryCodes: r.recoveryCodes } : {}) };
  }

  async function login(email: string, password: string): Promise<LoginStep> {
    const r = await authApi.login({ email: email.trim(), password });
    if (!isChallenge(r)) return finish(r);
    return r.twoFactorSetupRequired ? { kind: 'enroll', challengeToken: r.challengeToken } : { kind: 'code', challengeToken: r.challengeToken };
  }

  async function verifyCode(challengeToken: string, code: string): Promise<LoginStep> {
    return finish(await authApi.loginTwoFactor(challengeToken, code.replace(/\s+/g, '')));
  }

  function logout(reason: 'expired' | null = null): void {
    clearTimeout(expiryTimer);
    endReason.value = reason;
    token.value = null;
    user.value = null;
    removeStorage(TOKEN_KEY);
    removeStorage(USER_KEY);
  }

  function can(permission: Permission): boolean {
    return canRole(role.value, permission);
  }

  return { token, user, role, endReason, isAuthenticated, restore, login, verifyCode, logout, can };
});
