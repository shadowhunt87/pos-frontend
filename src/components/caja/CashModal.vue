<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { errorMessage } from '@/api/errors';
import { getMovementAccounts } from '@/api/pos';
import BaseButton from '@/components/BaseButton.vue';
import BaseModal from '@/components/BaseModal.vue';
import ErrorAlert from '@/components/ErrorAlert.vue';
import type { MovementAccount } from '@/types/api';

export type CashMode = 'OUT' | 'IN' | 'DRAWER';
export interface CashSubmit {
  mode: CashMode;
  amount: number;
  accountId: string;
  reason: string;
}

const props = withDefaults(defineProps<{ open: boolean; terminalId: string | null; busy?: boolean; error?: string | null }>(), {
  busy: false,
  error: null,
});
const emit = defineEmits<{ submit: [value: CashSubmit]; close: [] }>();

const TABS: { mode: CashMode; label: string }[] = [
  { mode: 'OUT', label: 'Salida' },
  { mode: 'IN', label: 'Entrada' },
  { mode: 'DRAWER', label: 'Abrir gaveta' },
];

const mode = ref<CashMode>('OUT');
const amount = ref('');
const accountId = ref('');
const reason = ref('');
const accounts = ref<MovementAccount[]>([]);
const accountsError = ref<string | null>(null);

const amountValid = computed(() => /^\d+(\.\d{1,2})?$/.test(amount.value.trim()) && Number(amount.value) > 0);
const valid = computed(() => !!reason.value.trim() && (mode.value === 'DRAWER' || (amountValid.value && !!accountId.value)));

watch(
  () => [props.open, props.terminalId] as const,
  async ([open, terminalId]) => {
    if (!open || !terminalId) return;
    mode.value = 'OUT';
    amount.value = '';
    accountId.value = '';
    reason.value = '';
    accountsError.value = null;
    try {
      accounts.value = await getMovementAccounts(terminalId);
    } catch (e) {
      accountsError.value = errorMessage(e);
    }
  },
);

function submit(): void {
  if (!valid.value || props.busy) return;
  emit('submit', { mode: mode.value, amount: Number(amount.value), accountId: accountId.value, reason: reason.value.trim() });
}
</script>

<template>
  <BaseModal :open="open" title="Efectivo de la gaveta" @close="emit('close')">
    <div class="mb-5 grid grid-cols-3 gap-1 rounded-xl bg-ink-100 p-1" role="tablist">
      <button
        v-for="t in TABS"
        :key="t.mode"
        type="button"
        role="tab"
        :aria-selected="mode === t.mode"
        :class="['min-h-10 rounded-lg text-sm font-semibold transition', mode === t.mode ? 'bg-surface text-ink-950 shadow-card' : 'text-ink-600 hover:text-ink-900']"
        @click="mode = t.mode"
      >
        {{ t.label }}
      </button>
    </div>
    <form id="cash-form" class="space-y-4" novalidate @submit.prevent="submit">
      <template v-if="mode !== 'DRAWER'">
        <div>
          <label for="cash-amount" class="label">Monto</label>
          <input id="cash-amount" v-model="amount" class="input num" inputmode="decimal" autocomplete="off" />
        </div>
        <div>
          <label for="cash-account" class="label">{{ mode === 'OUT' ? 'A dónde va' : 'De dónde viene' }}</label>
          <select id="cash-account" v-model="accountId" class="input">
            <option value="">Elige la cuenta…</option>
            <option v-for="a in accounts" :key="a.id" :value="a.id">{{ a.code }} · {{ a.name }}</option>
          </select>
          <p class="hint">{{ mode === 'OUT' ? 'Por ejemplo, el banco donde se depositó o un gasto menor.' : 'Por ejemplo, el fondo que se trajo del banco.' }}</p>
          <ErrorAlert :message="accountsError" />
        </div>
      </template>
      <div>
        <label for="cash-reason" class="label">Motivo</label>
        <input
          id="cash-reason"
          v-model="reason"
          class="input"
          maxlength="300"
          :placeholder="mode === 'OUT' ? 'Depósito al banco, pago al mensajero…' : mode === 'IN' ? 'Fondo de cambio…' : 'Cambio de billetes a un cliente…'"
        />
        <p v-if="mode === 'DRAWER'" class="hint">Abrir la gaveta sin venta queda registrado en el turno.</p>
        <p v-else-if="mode === 'OUT'" class="hint">Una salida de efectivo de un cajero necesita el PIN de un supervisor.</p>
      </div>
      <ErrorAlert :message="error" />
    </form>
    <template #footer>
      <BaseButton variant="secondary" @click="emit('close')">Cancelar</BaseButton>
      <BaseButton type="submit" form="cash-form" variant="accent" :loading="busy" :disabled="!valid">Registrar</BaseButton>
    </template>
  </BaseModal>
</template>
