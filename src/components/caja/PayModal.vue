<script setup lang="ts">
import Decimal from 'decimal.js';
import { Banknote, CreditCard, Landmark, Trash2 } from 'lucide-vue-next';
import { computed, ref, watch } from 'vue';
import BaseButton from '@/components/BaseButton.vue';
import BaseModal from '@/components/BaseModal.vue';
import ErrorAlert from '@/components/ErrorAlert.vue';
import type { PayMethod, SalePaymentRequest } from '@/types/api';
import { formatAmount, formatMoney } from '@/utils/format';
import { METHOD_LABEL, PAY_METHODS } from '@/utils/labels';
import { r2 } from '@/utils/pricing';

export interface PayConfirm {
  payments: SalePaymentRequest[];
  allowCredit: boolean;
}

const props = withDefaults(defineProps<{ open: boolean; total: string; canCredit?: boolean; busy?: boolean; error?: string | null }>(), {
  canCredit: false,
  busy: false,
  error: null,
});
const emit = defineEmits<{ confirm: [value: PayConfirm]; close: [] }>();

interface PayLine {
  method: PayMethod;
  amount: string;
  reference?: string;
}

const ICONS = { CASH: Banknote, CARD: CreditCard, TRANSFER: Landmark } as const;
const AMOUNT = /^\d+(\.\d{1,2})?$/;

const method = ref<PayMethod>('CASH');
const lines = ref<PayLine[]>([]);
const amount = ref('');
const reference = ref('');
const credit = ref(false);
const localError = ref<string | null>(null);

const totalD = computed(() => new Decimal(props.total || 0));
const paid = computed(() => lines.value.reduce((a, l) => a.plus(l.amount), new Decimal(0)));
const nonCash = computed(() => lines.value.filter((l) => l.method !== 'CASH').reduce((a, l) => a.plus(l.amount), new Decimal(0)));
const pending = computed(() => Decimal.max(0, r2(totalD.value.minus(paid.value))));
/** Cambio: lo que sobra, siempre en efectivo */
const change = computed(() => Decimal.max(0, r2(paid.value.minus(totalD.value))));
/** Billetes que cubren lo que falta, para tocar rápido */
const bills = computed(() => {
  const p = pending.value.toNumber();
  return [100, 200, 500, 1000, 2000]
    .map((b) => Math.ceil(p / b) * b)
    .filter((v, i, a) => v > p && a.indexOf(v) === i)
    .slice(0, 4);
});
const amountValid = computed(() => AMOUNT.test(amount.value.trim()) && new Decimal(amount.value.trim()).gt(0));
const canConfirm = computed(() => {
  if (props.busy) return false;
  if (pending.value.gt(0)) return credit.value && props.canCredit;
  return true;
});

watch(
  () => props.open,
  (open) => {
    if (!open) return;
    lines.value = [];
    method.value = 'CASH';
    credit.value = false;
    reference.value = '';
    localError.value = null;
    amount.value = totalD.value.toFixed(2);
  },
  { immediate: true },
);

watch(method, () => {
  localError.value = null;
  if (pending.value.gt(0)) amount.value = pending.value.toFixed(2);
});

function add(): boolean {
  localError.value = null;
  const raw = amount.value.trim();
  if (!amountValid.value) {
    localError.value = 'Escribe un monto mayor que cero, con hasta 2 decimales.';
    return false;
  }
  const v = new Decimal(raw);
  if (method.value !== 'CASH' && nonCash.value.plus(v).gt(totalD.value)) {
    localError.value = `Con ${METHOD_LABEL[method.value].toLowerCase()} se cobra como máximo ${formatMoney(totalD.value.minus(nonCash.value).toFixed(2))}: el cambio solo se da en efectivo.`;
    return false;
  }
  lines.value = [...lines.value, { method: method.value, amount: v.toFixed(2), ...(reference.value.trim() ? { reference: reference.value.trim() } : {}) }];
  reference.value = '';
  amount.value = pending.value.gt(0) ? pending.value.toFixed(2) : '';
  return true;
}

function quick(value: Decimal.Value): void {
  amount.value = new Decimal(value).toFixed(2);
  add();
}

function remove(i: number): void {
  lines.value = lines.value.filter((_, k) => k !== i);
  amount.value = pending.value.toFixed(2);
}

function confirm(): void {
  // Si se escribió un monto y no se agregó, cuenta
  if (!lines.value.length && amount.value.trim() && !add()) return;
  if (!canConfirm.value) return;
  emit('confirm', {
    payments: lines.value.map((l) => ({ method: l.method, amount: Number(l.amount), ...(l.reference ? { reference: l.reference } : {}) })),
    allowCredit: pending.value.gt(0) && credit.value,
  });
}
</script>

<template>
  <BaseModal :open="open" title="Cobrar" size="lg" @close="emit('close')">
    <div class="space-y-5">
      <div class="flex items-baseline justify-between rounded-2xl bg-panel px-5 py-4">
        <span class="text-sm text-ink-300">Total a cobrar</span>
        <strong class="num text-3xl font-bold" data-test="pay-total">{{ formatMoney(total) }}</strong>
      </div>

      <div class="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Forma de pago">
        <button
          v-for="m in PAY_METHODS"
          :key="m"
          type="button"
          role="radio"
          :aria-checked="method === m"
          :class="[
            'flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl border text-sm font-semibold transition',
            method === m ? 'border-brand-500 bg-brand-50 text-brand-800 ring-2 ring-brand-500/30' : 'border-line bg-surface text-ink-700 hover:border-ink-300',
          ]"
          @click="method = m"
        >
          <component :is="ICONS[m]" class="size-5" aria-hidden="true" />
          {{ METHOD_LABEL[m] }}
        </button>
      </div>

      <form class="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end" novalidate @submit.prevent="add">
        <div :class="method === 'CASH' ? 'sm:col-span-2' : ''">
          <label for="pay-amount" class="label">{{ method === 'CASH' ? 'Recibido' : 'Monto' }}</label>
          <input id="pay-amount" v-model="amount" class="input num text-xl" inputmode="decimal" autocomplete="off" />
        </div>
        <div v-if="method !== 'CASH'">
          <label for="pay-ref" class="label">Referencia (opcional)</label>
          <input id="pay-ref" v-model="reference" class="input" maxlength="100" placeholder="Autorización o n.º de transferencia" />
        </div>
        <BaseButton type="submit" variant="secondary" size="lg" :disabled="!amount.trim()">Agregar</BaseButton>
      </form>

      <div v-if="method === 'CASH' && pending.gt(0)" class="flex flex-wrap gap-2">
        <BaseButton size="sm" variant="secondary" @click="quick(pending)">Exacto</BaseButton>
        <BaseButton v-for="b in bills" :key="b" size="sm" variant="secondary" @click="quick(b)">{{ formatAmount(b) }}</BaseButton>
      </div>

      <ul v-if="lines.length" class="divide-y divide-line rounded-xl border border-line" aria-label="Pagos agregados">
        <li v-for="(l, i) in lines" :key="i" class="flex items-center gap-3 py-2 pr-2 pl-4">
          <span class="flex-1 text-sm">
            {{ METHOD_LABEL[l.method] }}<span v-if="l.reference" class="text-ink-500"> · {{ l.reference }}</span>
          </span>
          <span class="num font-semibold">{{ formatMoney(l.amount) }}</span>
          <button type="button" class="rounded-lg p-2 text-ink-400 hover:bg-ink-100 hover:text-danger" :aria-label="`Quitar pago ${i + 1}`" @click="remove(i)">
            <Trash2 class="size-4" />
          </button>
        </li>
      </ul>

      <div class="space-y-1">
        <div v-if="pending.gt(0)" class="flex justify-between text-base">
          <span>Falta</span><strong class="num text-danger" data-test="pay-pending">{{ formatMoney(pending.toFixed(2)) }}</strong>
        </div>
        <div v-if="change.gt(0)" class="flex items-baseline justify-between">
          <span class="text-base">Cambio</span><strong class="num text-2xl text-success" data-test="pay-change">{{ formatMoney(change.toFixed(2)) }}</strong>
        </div>
      </div>

      <label v-if="canCredit && pending.gt(0)" class="flex items-center gap-2 text-sm">
        <input v-model="credit" type="checkbox" class="size-4 accent-[var(--brand-600)]" />
        Dejar lo que falta a crédito del cliente
      </label>

      <ErrorAlert :message="localError ?? error" />
    </div>
    <template #footer>
      <BaseButton variant="secondary" @click="emit('close')">Volver</BaseButton>
      <BaseButton variant="accent" size="lg" :loading="busy" :disabled="!canConfirm && !(lines.length === 0 && amountValid)" data-test="pay-confirm" @click="confirm">
        Confirmar cobro
      </BaseButton>
    </template>
  </BaseModal>
</template>
