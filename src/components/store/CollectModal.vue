<script setup lang="ts">
import Decimal from 'decimal.js';
import { computed, ref, watch } from 'vue';
import { errorMessage } from '@/api/errors';
import { collectInvoice, getFunds } from '@/api/store';
import BaseButton from '@/components/BaseButton.vue';
import BaseModal from '@/components/BaseModal.vue';
import ErrorAlert from '@/components/ErrorAlert.vue';
import type { CollectMethod, InvoiceDetail, StoreFunds } from '@/types/api';
import { formatMoney } from '@/utils/format';
import { readStorage, writeStorage } from '@/utils/storage';

const props = defineProps<{ open: boolean; invoice: InvoiceDetail | null }>();
const emit = defineEmits<{ done: [invoice: InvoiceDetail]; close: [] }>();

const METHODS: { value: CollectMethod; label: string }[] = [
  { value: 'CASH', label: 'Efectivo' },
  { value: 'CARD', label: 'Tarjeta' },
  { value: 'TRANSFER', label: 'Transferencia' },
  { value: 'CHECK', label: 'Cheque' },
];
const FUND_KEY = 'pos.collect.fund';

const amount = ref('');
const method = ref<CollectMethod>('CASH');
const fundId = ref('');
const reference = ref('');
const funds = ref<StoreFunds | null>(null);
const busy = ref(false);
const error = ref<string | null>(null);

const balance = computed(() => new Decimal(props.invoice?.balance ?? 0));
const options = computed(() =>
  method.value === 'CASH'
    ? (funds.value?.cashRegisters ?? []).map((c) => ({ id: c.id, label: c.name }))
    : (funds.value?.bankAccounts ?? []).map((b) => ({ id: b.id, label: `${b.bankName} ${b.accountNumber}` })),
);
/** Ayuda en el front: el backend también rechaza cobrar más que el saldo */
const amountError = computed(() => {
  const v = amount.value.trim();
  if (!v) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(v)) return 'Escribe un monto con hasta 2 decimales.';
  if (new Decimal(v).lte(0)) return 'El monto debe ser mayor que cero.';
  if (new Decimal(v).gt(balance.value)) return `No puede pasar del saldo pendiente (${formatMoney(balance.value.toFixed(2))}).`;
  return null;
});
const valid = computed(() => !!amount.value.trim() && !amountError.value && !!fundId.value);

watch(
  () => props.open,
  async (open) => {
    if (!open) return;
    amount.value = balance.value.toFixed(2);
    method.value = 'CASH';
    reference.value = '';
    error.value = null;
    try {
      funds.value = await getFunds();
      pickFund();
    } catch (e) {
      error.value = errorMessage(e);
    }
  },
);

watch(method, () => pickFund());

function pickFund(): void {
  const saved = readStorage(`${FUND_KEY}.${method.value}`);
  fundId.value = options.value.find((o) => o.id === saved)?.id ?? (options.value.length === 1 ? options.value[0]!.id : '');
}

async function submit(): Promise<void> {
  const inv = props.invoice;
  if (!inv || !valid.value || busy.value) return;
  busy.value = true;
  error.value = null;
  try {
    writeStorage(`${FUND_KEY}.${method.value}`, fundId.value);
    const updated = await collectInvoice(inv.id, {
      amount: Number(amount.value),
      method: method.value,
      ...(method.value === 'CASH' ? { cashRegisterId: fundId.value } : { bankAccountId: fundId.value }),
      ...(reference.value.trim() ? { reference: reference.value.trim() } : {}),
    });
    emit('done', updated);
  } catch (e) {
    error.value = errorMessage(e);
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <BaseModal :open="open" :title="`Cobrar ${invoice?.number ?? ''}`" :description="invoice ? `${invoice.partner.name} · saldo ${formatMoney(invoice.balance)}` : undefined" @close="emit('close')">
    <form id="collect-form" class="space-y-4" novalidate @submit.prevent="submit">
      <div>
        <label for="collect-amount" class="label">Monto</label>
        <input id="collect-amount" v-model="amount" class="input num text-xl" inputmode="decimal" :aria-invalid="!!amountError" />
        <p v-if="amountError" class="mt-1.5 text-[13px] text-danger">{{ amountError }}</p>
      </div>
      <div class="grid grid-cols-4 gap-1 rounded-xl bg-ink-100 p-1" role="radiogroup" aria-label="Forma de pago">
        <button
          v-for="m in METHODS"
          :key="m.value"
          type="button"
          role="radio"
          :aria-checked="method === m.value"
          :class="['min-h-10 rounded-lg text-sm font-semibold', method === m.value ? 'bg-surface shadow-card' : 'text-ink-600']"
          @click="method = m.value"
        >
          {{ m.label }}
        </button>
      </div>
      <div>
        <label for="collect-fund" class="label">{{ method === 'CASH' ? 'Caja donde entra el efectivo' : 'Banco donde entra el dinero' }}</label>
        <select id="collect-fund" v-model="fundId" class="input">
          <option value="">Elige…</option>
          <option v-for="o in options" :key="o.id" :value="o.id">{{ o.label }}</option>
        </select>
      </div>
      <div v-if="method !== 'CASH'">
        <label for="collect-ref" class="label">Referencia (opcional)</label>
        <input id="collect-ref" v-model="reference" class="input" maxlength="100" placeholder="N.º de autorización, transferencia o cheque" />
      </div>
      <ErrorAlert :message="error" />
    </form>
    <template #footer>
      <BaseButton variant="secondary" @click="emit('close')">Cancelar</BaseButton>
      <BaseButton type="submit" form="collect-form" variant="accent" :loading="busy" :disabled="!valid">Registrar cobro</BaseButton>
    </template>
  </BaseModal>
</template>
