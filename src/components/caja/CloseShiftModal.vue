<script setup lang="ts">
import Decimal from 'decimal.js';
import { computed, ref, watch } from 'vue';
import BaseButton from '@/components/BaseButton.vue';
import BaseModal from '@/components/BaseModal.vue';
import ErrorAlert from '@/components/ErrorAlert.vue';
import type { CloseShiftRequest, PosShift } from '@/types/api';
import { formatAmount, formatMoney } from '@/utils/format';
import { DENOMINATIONS, METHOD_LABEL, PAY_METHODS } from '@/utils/labels';

const props = withDefaults(defineProps<{ shift: PosShift | null; result: PosShift | null; busy?: boolean; error?: string | null }>(), {
  busy: false,
  error: null,
});
const emit = defineEmits<{ confirm: [value: CloseShiftRequest]; close: []; done: [] }>();

const counts = ref<Record<number, string>>({});
const others = ref('');
const notes = ref('');

watch(
  () => props.shift,
  (s) => {
    if (!s) return;
    counts.value = {};
    others.value = '';
    notes.value = '';
  },
);

const qty = (v: string | undefined) => {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) && n > 0 ? n : 0;
};
const othersValue = computed(() => (/^\d+(\.\d{1,2})?$/.test(others.value.trim()) ? new Decimal(others.value.trim()) : new Decimal(0)));
/** Lo que el cajero contó (suma de su propio conteo; lo esperado lo dice el servidor después) */
const counted = computed(() =>
  DENOMINATIONS.reduce((a, d) => a.plus(new Decimal(d).times(qty(counts.value[d]))), new Decimal(0)).plus(othersValue.value),
);

const diff = computed(() => Number(props.result?.difference ?? 0));
const refunds = computed(() => {
  const r = props.result?.totals.refundsByMethod;
  return r ? PAY_METHODS.reduce((a, m) => a.plus(r[m]), new Decimal(0)).toFixed(2) : '0';
});

function confirm(): void {
  if (props.busy) return;
  const detail: Record<string, number> = {};
  for (const d of DENOMINATIONS) if (qty(counts.value[d])) detail[String(d)] = qty(counts.value[d]);
  if (othersValue.value.gt(0)) detail.otros = othersValue.value.toNumber();
  emit('confirm', {
    countedCash: counted.value.toDecimalPlaces(2).toNumber(),
    countDetail: detail,
    ...(notes.value.trim() ? { notes: notes.value.trim() } : {}),
  });
}
</script>

<template>
  <BaseModal :open="!!shift" :title="`Cerrar turno ${shift?.number ?? ''}`" size="lg" @close="result ? emit('done') : emit('close')">
    <template v-if="shift && !result">
      <p class="text-sm text-ink-500">Cuenta el efectivo de la gaveta por billete y moneda. Lo que debería haber se muestra después de confirmar el conteo.</p>
      <div class="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div v-for="d in DENOMINATIONS" :key="d">
          <label :for="`den-${d}`" class="label">{{ formatAmount(d).replace('.00', '') }}</label>
          <input :id="`den-${d}`" v-model="counts[d]" class="input num" inputmode="numeric" placeholder="0" />
        </div>
        <div class="col-span-2">
          <label for="den-others" class="label">Otros (centavos, monedas sueltas)</label>
          <input id="den-others" v-model="others" class="input num" inputmode="decimal" placeholder="0.00" />
        </div>
      </div>
      <div class="mt-5 flex items-baseline justify-between border-t border-line pt-4">
        <span class="text-base">Contado</span>
        <strong class="num text-2xl" data-test="close-counted">{{ formatMoney(counted.toFixed(2)) }}</strong>
      </div>
      <div class="mt-4">
        <label for="close-notes" class="label">Nota (opcional)</label>
        <input id="close-notes" v-model="notes" class="input" maxlength="500" />
      </div>
      <div class="mt-4"><ErrorAlert :message="error" /></div>
    </template>

    <div v-else-if="result" class="space-y-2 text-[15px]">
      <div class="flex justify-between"><span>Debería haber</span><strong class="num">{{ formatMoney(result.expectedCash) }}</strong></div>
      <div class="flex justify-between"><span>Contado</span><strong class="num">{{ formatMoney(result.countedCash) }}</strong></div>
      <div
        :class="[
          'flex items-baseline justify-between rounded-xl px-4 py-3 text-lg',
          diff === 0 ? 'bg-success-soft text-success-strong' : diff > 0 ? 'bg-info-soft text-info-strong' : 'bg-danger-soft text-danger-strong',
        ]"
        data-test="close-difference"
      >
        <span class="font-semibold">{{ diff === 0 ? 'Cuadra' : diff > 0 ? 'Sobrante' : 'Faltante' }}</span>
        <strong class="num">{{ formatMoney(result.difference) }}</strong>
      </div>
      <hr class="my-3 border-line" />
      <div class="flex justify-between"><span>Ventas ({{ result.totals.salesCount }})</span><strong class="num">{{ formatMoney(result.totals.grossSales) }}</strong></div>
      <div v-for="m in PAY_METHODS" :key="m" class="flex justify-between text-ink-600">
        <span>{{ METHOD_LABEL[m] }}</span><span class="num">{{ formatMoney(result.totals.salesByMethod[m]) }}</span>
      </div>
      <div class="flex justify-between text-ink-600">
        <span>Devoluciones ({{ result.totals.returnsCount }})</span><span class="num">−{{ formatMoney(refunds) }}</span>
      </div>
      <div class="flex justify-between text-ink-600">
        <span>Entradas / salidas</span><span class="num">{{ formatMoney(result.totals.cashIn) }} / −{{ formatMoney(result.totals.cashOut) }}</span>
      </div>
    </div>

    <template #footer>
      <template v-if="!result">
        <BaseButton variant="secondary" @click="emit('close')">Cancelar</BaseButton>
        <BaseButton variant="accent" :loading="busy" data-test="close-confirm" @click="confirm">Cerrar turno</BaseButton>
      </template>
      <BaseButton v-else variant="accent" @click="emit('done')">Listo</BaseButton>
    </template>
  </BaseModal>
</template>
