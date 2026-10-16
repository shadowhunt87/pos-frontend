<script setup lang="ts">
import { KeyRound, LogIn, ShieldCheck } from 'lucide-vue-next';
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { enrollStart } from '@/api/auth';
import { errorMessage } from '@/api/errors';
import BaseButton from '@/components/BaseButton.vue';
import BrandMark from '@/components/BrandMark.vue';
import ErrorAlert from '@/components/ErrorAlert.vue';
import { homeFor } from '@/router';
import { useAuthStore, type LoginStep } from '@/stores/auth';

const auth = useAuthStore();
const route = useRoute();
const router = useRouter();

type Stage = 'password' | 'code' | 'enroll' | 'recovery';
const stage = ref<Stage>('password');
const email = ref('');
const password = ref('');
const code = ref('');
const challengeToken = ref('');
const qrCode = ref<string | null>(null);
const secret = ref<string | null>(null);
const recoveryCodes = ref<string[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);

const expired = computed(() => route.query.expired === '1');
const validEmail = computed(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim()));
const canSubmitPassword = computed(() => validEmail.value && password.value.length > 0);
const canSubmitCode = computed(() => code.value.replace(/\s+/g, '').length >= 6);

async function goIn(): Promise<void> {
  const redirect = typeof route.query.redirect === 'string' && route.query.redirect.startsWith('/') ? route.query.redirect : null;
  await router.replace(redirect ?? homeFor(auth));
}

async function handle(step: LoginStep): Promise<void> {
  if (step.kind === 'done') {
    if (step.recoveryCodes?.length) {
      recoveryCodes.value = step.recoveryCodes;
      stage.value = 'recovery';
      return;
    }
    await goIn();
    return;
  }
  challengeToken.value = step.challengeToken;
  code.value = '';
  if (step.kind === 'code') {
    stage.value = 'code';
    return;
  }
  stage.value = 'enroll';
  const e = await enrollStart(step.challengeToken);
  qrCode.value = e.qrCode;
  secret.value = e.secret;
}

async function submitPassword(): Promise<void> {
  if (!canSubmitPassword.value || loading.value) return;
  loading.value = true;
  error.value = null;
  try {
    await handle(await auth.login(email.value, password.value));
  } catch (e) {
    error.value = errorMessage(e);
  } finally {
    loading.value = false;
  }
}

async function submitCode(): Promise<void> {
  if (!canSubmitCode.value || loading.value) return;
  loading.value = true;
  error.value = null;
  try {
    await handle(await auth.verifyCode(challengeToken.value, code.value));
  } catch (e) {
    error.value = errorMessage(e);
    code.value = '';
  } finally {
    loading.value = false;
  }
}

function backToPassword(): void {
  stage.value = 'password';
  challengeToken.value = '';
  qrCode.value = null;
  secret.value = null;
  error.value = null;
}
</script>

<template>
  <main class="flex min-h-dvh items-center justify-center bg-canvas px-4 py-10">
    <div class="w-full max-w-md">
      <div class="mb-8 flex items-center gap-3">
        <BrandMark class="size-11" />
        <div>
          <p class="text-lg font-bold text-ink-950">Sirtech POS</p>
          <p class="text-sm text-ink-500">Punto de venta</p>
        </div>
      </div>

      <section class="card">
        <!-- Clave -->
        <form v-if="stage === 'password'" novalidate class="space-y-5" @submit.prevent="submitPassword">
          <div>
            <h1 class="text-xl font-bold text-ink-950">Entrar a la caja</h1>
            <p class="mt-1 text-sm text-ink-500">Usa el mismo correo y clave del sistema financiero.</p>
          </div>
          <p v-if="expired" class="rounded-xl bg-warning-soft px-4 py-3 text-sm text-warning-strong" role="status">
            Tu sesión terminó. Entra de nuevo para seguir.
          </p>
          <ErrorAlert :message="error" />
          <div>
            <label for="login-email" class="label">Correo</label>
            <input id="login-email" v-model="email" type="email" class="input" autocomplete="username" required />
          </div>
          <div>
            <label for="login-password" class="label">Clave</label>
            <input id="login-password" v-model="password" type="password" class="input" autocomplete="current-password" required />
          </div>
          <BaseButton type="submit" variant="accent" size="lg" block :icon="LogIn" :loading="loading" :disabled="!canSubmitPassword">
            Entrar
          </BaseButton>
        </form>

        <!-- Código de la app de autenticación -->
        <form v-else-if="stage === 'code' || stage === 'enroll'" novalidate class="space-y-5" @submit.prevent="submitCode">
          <div class="flex items-start gap-3">
            <span class="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
              <ShieldCheck class="size-5" aria-hidden="true" />
            </span>
            <div>
              <h1 class="text-xl font-bold text-ink-950">{{ stage === 'enroll' ? 'Activa la verificación en dos pasos' : 'Verificación en dos pasos' }}</h1>
              <p class="mt-1 text-sm text-ink-500">
                {{
                  stage === 'enroll'
                    ? 'Tu usuario la necesita. Escanea el código con tu app de autenticación (Google Authenticator, Microsoft Authenticator…) y escribe los 6 números que te muestra.'
                    : 'Escribe los 6 números de tu app de autenticación. También sirve un código de emergencia.'
                }}
              </p>
            </div>
          </div>
          <div v-if="stage === 'enroll'" class="flex flex-col items-center gap-3 rounded-xl border border-line bg-white p-4">
            <img v-if="qrCode" :src="qrCode" alt="Código QR para la app de autenticación" class="size-48" />
            <p v-else class="py-16 text-sm text-ink-500">Preparando el código…</p>
            <p v-if="secret" class="text-center text-xs text-ink-500">
              ¿No puedes escanear? Escribe esta clave en la app:<br />
              <span class="font-mono text-sm font-semibold tracking-wider text-ink-900">{{ secret }}</span>
            </p>
          </div>
          <ErrorAlert :message="error" />
          <div>
            <label for="login-code" class="label">Código</label>
            <input
              id="login-code"
              v-model="code"
              class="input text-center font-mono text-xl tracking-[0.3em]"
              inputmode="numeric"
              autocomplete="one-time-code"
              maxlength="32"
              required
            />
          </div>
          <BaseButton type="submit" variant="accent" size="lg" block :icon="KeyRound" :loading="loading" :disabled="!canSubmitCode">
            Verificar
          </BaseButton>
          <button type="button" class="link block w-full text-center text-sm" @click="backToPassword">Volver</button>
        </form>

        <!-- Códigos de emergencia recién creados -->
        <div v-else class="space-y-5">
          <div>
            <h1 class="text-xl font-bold text-ink-950">Guarda tus códigos de emergencia</h1>
            <p class="mt-1 text-sm text-ink-500">
              Te sirven para entrar si pierdes el teléfono. Cada uno se usa una sola vez y no se vuelven a mostrar: anótalos en un lugar seguro.
            </p>
          </div>
          <ul class="grid grid-cols-2 gap-2 rounded-xl border border-line bg-surface-2 p-4 font-mono text-sm">
            <li v-for="c in recoveryCodes" :key="c" class="text-center">{{ c }}</li>
          </ul>
          <BaseButton variant="accent" size="lg" block @click="goIn">Ya los guardé</BaseButton>
        </div>
      </section>
    </div>
  </main>
</template>
