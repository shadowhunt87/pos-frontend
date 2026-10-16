<script setup lang="ts">
import { UserPlus, UserRound } from 'lucide-vue-next';
import { ref, watch } from 'vue';
import { errorMessage } from '@/api/errors';
import { createCustomer, searchCustomers } from '@/api/pos';
import BaseButton from '@/components/BaseButton.vue';
import BaseModal from '@/components/BaseModal.vue';
import ErrorAlert from '@/components/ErrorAlert.vue';
import type { PosCustomer } from '@/types/api';

const props = defineProps<{ open: boolean; defaultName: string | null; fiscalCreditNcf: string }>();
const emit = defineEmits<{ pick: [customer: PosCustomer]; pickDefault: []; close: [] }>();

const q = ref('');
const results = ref<PosCustomer[]>([]);
const searching = ref(false);
const searchError = ref<string | null>(null);
const creating = ref(false);
const saving = ref(false);
const createError = ref<string | null>(null);
const form = ref({ name: '', taxIdType: 'RNC' as 'RNC' | 'CEDULA', taxId: '', phone: '', fiscalCredit: false });

let timer: ReturnType<typeof setTimeout> | undefined;
let seq = 0;

async function search(text: string): Promise<void> {
  const mine = ++seq;
  searching.value = true;
  searchError.value = null;
  try {
    const r = await searchCustomers(text);
    if (mine === seq) results.value = r;
  } catch (e) {
    if (mine === seq) searchError.value = errorMessage(e);
  } finally {
    if (mine === seq) searching.value = false;
  }
}

watch(q, (text) => {
  clearTimeout(timer);
  timer = setTimeout(() => void search(text), 250);
});

watch(
  () => props.open,
  (open) => {
    if (!open) return;
    creating.value = false;
    createError.value = null;
    q.value = '';
    void search('');
  },
);

async function create(): Promise<void> {
  const name = form.value.name.trim();
  if (!name || saving.value) return;
  const taxId = form.value.taxId.replace(/\D/g, '');
  if (taxId && !(form.value.taxIdType === 'RNC' ? taxId.length === 9 : taxId.length === 11)) {
    createError.value = form.value.taxIdType === 'RNC' ? 'El RNC tiene 9 números.' : 'La cédula tiene 11 números.';
    return;
  }
  saving.value = true;
  createError.value = null;
  try {
    const c = await createCustomer({
      name,
      ...(taxId ? { taxId, taxIdType: form.value.taxIdType } : {}),
      ...(form.value.phone.trim() ? { phone: form.value.phone.trim() } : {}),
      ...(form.value.fiscalCredit ? { defaultNcfType: props.fiscalCreditNcf } : {}),
    });
    form.value = { name: '', taxIdType: 'RNC', taxId: '', phone: '', fiscalCredit: false };
    emit('pick', c);
  } catch (e) {
    createError.value = errorMessage(e);
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <BaseModal :open="open" title="Cliente de la venta" @close="emit('close')">
    <div v-if="!creating" class="space-y-4">
      <div>
        <label for="customer-q" class="label">Buscar por nombre, RNC o cédula</label>
        <input id="customer-q" v-model="q" class="input" autocomplete="off" />
      </div>
      <ErrorAlert :message="searchError" />
      <ul class="max-h-80 divide-y divide-line overflow-y-auto rounded-xl border border-line">
        <li v-if="defaultName">
          <button type="button" class="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-ink-50" @click="emit('pickDefault')">
            <span class="flex items-center gap-2 font-semibold"><UserRound class="size-4 text-ink-400" aria-hidden="true" />{{ defaultName }}</span>
            <span class="text-xs text-ink-500">Sin datos fiscales</span>
          </button>
        </li>
        <li v-for="c in results" :key="c.id">
          <button type="button" class="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-ink-50" @click="emit('pick', c)">
            <span class="font-semibold">{{ c.name }}</span>
            <span class="font-mono text-xs text-ink-500">{{ c.taxId ?? 'Sin RNC' }}</span>
          </button>
        </li>
        <li v-if="!results.length && !searching && q" class="px-4 py-3 text-sm text-ink-500">No hay clientes con «{{ q }}».</li>
        <li v-if="searching" class="px-4 py-3 text-sm text-ink-500">Buscando…</li>
      </ul>
    </div>

    <form v-else id="customer-form" class="grid gap-4 sm:grid-cols-2" novalidate @submit.prevent="create">
      <div class="sm:col-span-2">
        <label for="customer-name" class="label">Nombre o razón social</label>
        <input id="customer-name" v-model="form.name" class="input" maxlength="200" required />
      </div>
      <div>
        <label for="customer-doc" class="label">Documento</label>
        <select id="customer-doc" v-model="form.taxIdType" class="input">
          <option value="RNC">RNC</option>
          <option value="CEDULA">Cédula</option>
        </select>
      </div>
      <div>
        <label for="customer-taxid" class="label">Número (opcional)</label>
        <input id="customer-taxid" v-model="form.taxId" class="input font-mono" inputmode="numeric" placeholder="Solo números" />
      </div>
      <div class="sm:col-span-2">
        <label for="customer-phone" class="label">Teléfono (opcional)</label>
        <input id="customer-phone" v-model="form.phone" class="input" maxlength="50" inputmode="tel" />
      </div>
      <label class="flex items-center gap-2 text-sm sm:col-span-2">
        <input v-model="form.fiscalCredit" type="checkbox" class="size-4 accent-[var(--brand-600)]" />
        Pide comprobante de crédito fiscal ({{ fiscalCreditNcf }})
      </label>
      <div class="sm:col-span-2"><ErrorAlert :message="createError" /></div>
    </form>

    <template #footer>
      <template v-if="creating">
        <BaseButton variant="secondary" @click="creating = false">Volver</BaseButton>
        <BaseButton type="submit" form="customer-form" variant="accent" :loading="saving" :disabled="!form.name.trim()">Crear y usar</BaseButton>
      </template>
      <template v-else>
        <BaseButton variant="secondary" :icon="UserPlus" @click="creating = true">Cliente nuevo</BaseButton>
        <BaseButton variant="secondary" @click="emit('close')">Cerrar</BaseButton>
      </template>
    </template>
  </BaseModal>
</template>
