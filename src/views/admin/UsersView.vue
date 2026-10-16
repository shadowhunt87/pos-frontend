<script setup lang="ts">
import { KeyRound, Pencil, Plus, UserCog } from 'lucide-vue-next';
import { computed, onMounted, ref } from 'vue';
import { errorMessage } from '@/api/errors';
import { createUser, listUsers, resetUserPassword, updateUser } from '@/api/users';
import BaseButton from '@/components/BaseButton.vue';
import BaseModal from '@/components/BaseModal.vue';
import EmptyState from '@/components/EmptyState.vue';
import ErrorAlert from '@/components/ErrorAlert.vue';
import LoadingState from '@/components/LoadingState.vue';
import PageHeader from '@/components/PageHeader.vue';
import StatusBadge from '@/components/StatusBadge.vue';
import { useAuthStore } from '@/stores/auth';
import { useToastStore } from '@/stores/toast';
import type { Role, UserRow } from '@/types/api';
import { formatDateTime } from '@/utils/format';
import { ROLE_HINT, ROLE_LABEL } from '@/utils/permissions';

const auth = useAuthStore();
const toast = useToastStore();

// Roles de tienda primero: son los que se crean desde el punto de venta
const ROLES: Role[] = ['CASHIER', 'SELLER', 'WAREHOUSE', 'APPROVER', 'ACCOUNTANT', 'ADMIN', 'VIEWER', 'AUDITOR'];

const rows = ref<UserRow[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);

type Mode = 'create' | 'edit' | 'password';
const mode = ref<Mode | null>(null);
const target = ref<UserRow | null>(null);
const form = ref({ name: '', email: '', password: '', role: 'CASHIER' as Role, active: true, confirmPassword: '', confirmCode: '' });
const busy = ref(false);
const formError = ref<string | null>(null);

const title = computed(() => (mode.value === 'create' ? 'Usuario nuevo' : mode.value === 'edit' ? `Editar ${target.value?.name ?? ''}` : `Nueva clave para ${target.value?.name ?? ''}`));

async function load(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    rows.value = (await listUsers()).data;
  } catch (e) {
    error.value = errorMessage(e);
  } finally {
    loading.value = false;
  }
}

function open(m: Mode, u: UserRow | null): void {
  mode.value = m;
  target.value = u;
  formError.value = null;
  form.value = { name: u?.name ?? '', email: u?.email ?? '', password: '', role: u?.role ?? 'CASHIER', active: u?.active ?? true, confirmPassword: '', confirmCode: '' };
}

function validate(): string | null {
  const f = form.value;
  if (mode.value !== 'password' && !f.name.trim()) return 'Escribe el nombre.';
  if (mode.value === 'create' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) return 'El correo no es válido.';
  if (mode.value !== 'edit' && f.password.length < 8) return 'La clave debe tener al menos 8 caracteres.';
  if (!f.confirmPassword) return 'Escribe tu clave de administrador para confirmar.';
  return null;
}

async function save(): Promise<void> {
  if (busy.value) return;
  const v = validate();
  if (v) {
    formError.value = v;
    return;
  }
  const f = form.value;
  const confirm = { confirmPassword: f.confirmPassword, ...(f.confirmCode.trim() ? { confirmCode: f.confirmCode.trim() } : {}) };
  busy.value = true;
  formError.value = null;
  try {
    if (mode.value === 'create') {
      await createUser({ name: f.name.trim(), email: f.email.trim().toLowerCase(), password: f.password, role: f.role, ...confirm });
      toast.success('Usuario creado', `${f.name.trim()} ya puede entrar con su correo y la clave que le diste.`);
    } else if (mode.value === 'edit' && target.value) {
      await updateUser(target.value.id, { name: f.name.trim(), role: f.role, active: f.active, ...confirm });
      toast.success('Usuario actualizado');
    } else if (mode.value === 'password' && target.value) {
      await resetUserPassword(target.value.id, { password: f.password, ...confirm });
      toast.success('Clave cambiada', 'Dásela a la persona por un medio seguro.');
    }
    mode.value = null;
    await load();
  } catch (e) {
    formError.value = errorMessage(e);
  } finally {
    busy.value = false;
  }
}

onMounted(load);
</script>

<template>
  <div>
    <PageHeader title="Usuarios" subtitle="Quién entra al punto de venta y qué puede hacer. Cada rol ve solo su área.">
      <template #actions>
        <BaseButton variant="accent" :icon="Plus" @click="open('create', null)">Usuario nuevo</BaseButton>
      </template>
    </PageHeader>

    <section class="card mb-6">
      <h2 class="card-title">Qué ve cada rol</h2>
      <dl class="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
        <div v-for="r in ROLES.slice(0, 6)" :key="r" class="flex gap-2">
          <dt class="w-28 shrink-0 font-semibold">{{ ROLE_LABEL[r] }}</dt>
          <dd class="text-ink-600">{{ ROLE_HINT[r] }}</dd>
        </div>
      </dl>
    </section>

    <LoadingState v-if="loading && !rows.length" variant="table" />
    <ErrorAlert v-else-if="error" :message="error" retry @retry="load" />
    <EmptyState v-else-if="!rows.length" :icon="UserCog" text="No hay usuarios." />
    <section v-else class="card overflow-x-auto p-0 sm:p-0">
      <table class="table-base">
        <thead><tr><th>Nombre</th><th>Correo</th><th>Rol</th><th>Último acceso</th><th>Estado</th><th><span class="sr-only">Acciones</span></th></tr></thead>
        <tbody>
          <tr v-for="u in rows" :key="u.id">
            <td class="font-medium">{{ u.name }}<span v-if="u.id === auth.user?.id" class="ml-1 text-xs text-ink-500">(tú)</span></td>
            <td>{{ u.email }}</td>
            <td>{{ ROLE_LABEL[u.role] ?? u.role }}</td>
            <td class="whitespace-nowrap text-ink-500">{{ u.lastLoginAt ? formatDateTime(u.lastLoginAt) : 'Nunca' }}</td>
            <td><StatusBadge :tone="u.active ? 'success' : 'neutral'">{{ u.active ? 'Activo' : 'Inactivo' }}</StatusBadge></td>
            <td class="text-right whitespace-nowrap">
              <BaseButton size="sm" variant="ghost" :icon="Pencil" @click="open('edit', u)">Editar</BaseButton>
              <BaseButton size="sm" variant="ghost" :icon="KeyRound" @click="open('password', u)">Clave</BaseButton>
            </td>
          </tr>
        </tbody>
      </table>
    </section>

    <BaseModal :open="!!mode" :title="title" size="lg" @close="mode = null">
      <form id="user-form" class="grid gap-4 sm:grid-cols-2" novalidate @submit.prevent="save">
        <template v-if="mode !== 'password'">
          <div :class="mode === 'edit' ? 'sm:col-span-2' : ''">
            <label for="usr-name" class="label">Nombre</label>
            <input id="usr-name" v-model="form.name" class="input" maxlength="150" />
          </div>
          <div v-if="mode === 'create'">
            <label for="usr-email" class="label">Correo (con él entra)</label>
            <input id="usr-email" v-model="form.email" type="email" class="input" autocomplete="off" />
          </div>
          <div class="sm:col-span-2">
            <label for="usr-role" class="label">Rol</label>
            <select id="usr-role" v-model="form.role" class="input">
              <option v-for="r in ROLES" :key="r" :value="r">{{ ROLE_LABEL[r] }}</option>
            </select>
            <p class="hint">{{ ROLE_HINT[form.role] }}</p>
          </div>
          <label v-if="mode === 'edit'" class="flex items-center gap-2 text-sm sm:col-span-2">
            <input v-model="form.active" type="checkbox" class="size-4 accent-[var(--brand-600)]" :disabled="target?.id === auth.user?.id" /> Activo (puede entrar)
          </label>
        </template>
        <div v-if="mode !== 'edit'" class="sm:col-span-2">
          <label for="usr-password" class="label">{{ mode === 'create' ? 'Clave inicial' : 'Clave nueva' }} (mínimo 8 caracteres)</label>
          <input id="usr-password" v-model="form.password" type="password" class="input" autocomplete="new-password" />
        </div>
        <div class="rounded-xl bg-surface-2 p-4 sm:col-span-2">
          <p class="mb-3 text-sm text-ink-600">Por seguridad, confirma con tu clave de administrador.</p>
          <div class="grid gap-4 sm:grid-cols-2">
            <div>
              <label for="usr-confirm" class="label">Tu clave</label>
              <input id="usr-confirm" v-model="form.confirmPassword" type="password" class="input" autocomplete="current-password" />
            </div>
            <div>
              <label for="usr-code" class="label">Tu código de 2 pasos (si lo usas)</label>
              <input id="usr-code" v-model="form.confirmCode" class="input font-mono" inputmode="numeric" maxlength="32" autocomplete="one-time-code" />
            </div>
          </div>
        </div>
        <div class="sm:col-span-2"><ErrorAlert :message="formError" /></div>
      </form>
      <template #footer>
        <BaseButton variant="secondary" @click="mode = null">Cancelar</BaseButton>
        <BaseButton type="submit" form="user-form" variant="accent" :loading="busy">Guardar</BaseButton>
      </template>
    </BaseModal>
  </div>
</template>
