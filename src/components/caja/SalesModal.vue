<script setup lang="ts">
import Decimal from 'decimal.js';
import { Printer, Search } from 'lucide-vue-next';
import { computed, ref, watch } from 'vue';
import { errorMessage } from '@/api/errors';
import { getSale, listSales } from '@/api/pos';
import BaseButton from '@/components/BaseButton.vue';
import BaseModal from '@/components/BaseModal.vue';
import ErrorAlert from '@/components/ErrorAlert.vue';
import StatusBadge from '@/components/StatusBadge.vue';
import type { PayMethod, PosSale, PosSaleLine, PosSaleRow } from '@/types/api';
import { formatDateTime, formatMoney, formatNumber, formatTime } from '@/utils/format';
import { METHOD_LABEL, PAY_METHODS, VOID_CODES } from '@/utils/labels';

export interface VoidIntent {
  sale: PosSale;
  reason: string;
  reasonCode: string;
}
export interface ReturnIntent {
  sale: PosSale;
  lines: { saleLineId: string; quantity: number }[];
  refundMethod: PayMethod;
  reason: string;
}

const props = withDefaults(
  defineProps<{ open: boolean; shiftId: string | null; busy?: boolean; error?: string | null; refreshKey?: number }>(),
  { busy: false, error: null, refreshKey: 0 },
);
const emit = defineEmits<{ print: [saleId: string]; void: [value: VoidIntent]; return: [value: ReturnIntent]; close: [] }>();

const q = ref('');
const rows = ref<PosSaleRow[]>([]);
const loading = ref(false);
const listError = ref<string | null>(null);
const selected = ref<PosSale | null>(null);
const mode = ref<'view' | 'void' | 'return'>('view');
const reason = ref('');
const code = ref('04');
const refund = ref<PayMethod>('CASH');
const ret = ref<Record<string, string>>({});

async function load(): Promise<void> {
  loading.value = true;
  listError.value = null;
  try {
    const text = q.value.trim();
    const r = await listSales(text ? { q: text, limit: 30 } : { shiftId: props.shiftId ?? undefined, limit: 50 });
    rows.value = r.data;
  } catch (e) {
    rows.value = [];
    listError.value = errorMessage(e);
  } finally {
    loading.value = false;
  }
}

async function pick(id: string): Promise<void> {
  listError.value = null;
  try {
    selected.value = await getSale(id);
    mode.value = 'view';
    reason.value = '';
    ret.value = {};
  } catch (e) {
    listError.value = errorMessage(e);
  }
}

watch(
  () => props.open,
  (open) => {
    if (!open) return;
    selected.value = null;
    q.value = '';
    void load();
  },
);

// Tras anular o devolver, se recarga la venta abierta para ver su estado nuevo
watch(
  () => props.refreshKey,
  () => {
    if (selected.value) void pick(selected.value.id);
    void load();
  },
);

const left = (l: PosSaleLine) => new Decimal(l.quantity).minus(l.returnedQty);
const lineNet = (l: PosSaleLine) => new Decimal(l.quantity).times(l.unitPrice).minus(l.discount).minus(l.promoDiscount).toFixed(2);
const qtyOf = (id: string) => {
  const n = Number(ret.value[id]);
  return Number.isFinite(n) && n > 0 ? n : 0;
};
const returnErrors = computed(() => {
  const s = selected.value;
  if (!s) return null;
  for (const l of s.lines) if (qtyOf(l.id) > left(l).toNumber()) return `De ${l.description} solo quedan ${formatNumber(left(l).toString())} por devolver.`;
  return null;
});
const hasReturn = computed(() => !!selected.value?.lines.some((l) => qtyOf(l.id) > 0));

function startVoid(): void {
  mode.value = 'void';
  reason.value = '';
  code.value = '04';
}

function startReturn(): void {
  mode.value = 'return';
  reason.value = '';
  ret.value = {};
  refund.value = selected.value?.payments[0]?.method ?? 'CASH';
}

function emitVoid(): void {
  if (!selected.value || !reason.value.trim()) return;
  emit('void', { sale: selected.value, reason: reason.value.trim(), reasonCode: code.value });
}

function emitReturn(): void {
  const s = selected.value;
  if (!s || !reason.value.trim() || !hasReturn.value || returnErrors.value) return;
  emit('return', {
    sale: s,
    lines: s.lines.filter((l) => qtyOf(l.id) > 0).map((l) => ({ saleLineId: l.id, quantity: qtyOf(l.id) })),
    refundMethod: refund.value,
    reason: reason.value.trim(),
  });
}

function back(): void {
  if (mode.value !== 'view') mode.value = 'view';
  else selected.value = null;
}
</script>

<template>
  <BaseModal :open="open" :title="selected ? `Ticket ${selected.number}` : 'Ventas y devoluciones'" size="xl" @close="emit('close')">
    <template v-if="!selected">
      <form class="mb-4 flex items-end gap-2" @submit.prevent="load">
        <div class="flex-1">
          <label for="sales-q" class="label">Buscar ticket o NCF (también de otros turnos, para una devolución)</label>
          <input id="sales-q" v-model="q" class="input font-mono" placeholder="TK-000012 o B0200000045" autocomplete="off" />
        </div>
        <BaseButton type="submit" variant="secondary" size="lg" :icon="Search">Buscar</BaseButton>
      </form>
      <ErrorAlert :message="listError" />
      <div class="overflow-x-auto rounded-xl border border-line">
        <table class="table-base">
          <thead>
            <tr><th>Ticket</th><th>Hora</th><th>Cliente</th><th>NCF</th><th class="text-right">Total</th><th>Estado</th></tr>
          </thead>
          <tbody>
            <tr v-for="s in rows" :key="s.id" class="cursor-pointer" tabindex="0" @click="pick(s.id)" @keydown.enter="pick(s.id)">
              <td class="font-mono">{{ s.number }}</td>
              <td>{{ formatTime(s.createdAt) }}</td>
              <td>{{ s.partner?.name ?? '—' }}</td>
              <td class="font-mono">{{ s.ncf ?? '—' }}</td>
              <td class="num text-right">{{ formatMoney(s.total) }}</td>
              <td><StatusBadge :tone="s.status === 'VOIDED' ? 'danger' : 'success'">{{ s.status === 'VOIDED' ? 'Anulada' : 'Cobrada' }}</StatusBadge></td>
            </tr>
            <tr v-if="!rows.length">
              <td colspan="6" class="py-8 text-center text-ink-500">{{ loading ? 'Cargando…' : 'No hay ventas.' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <template v-else>
      <div class="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p class="font-semibold">{{ selected.partner?.name }}</p>
          <p class="text-sm text-ink-500">NCF {{ selected.ncf ?? 'pendiente' }} · Factura {{ selected.invoiceNumber }} · {{ formatDateTime(selected.createdAt) }}</p>
        </div>
        <strong class="num text-2xl">{{ formatMoney(selected.total) }}</strong>
      </div>
      <p v-if="selected.status === 'VOIDED'" class="mb-4 rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger-strong">Anulada: {{ selected.voidReason }}</p>

      <div class="overflow-x-auto rounded-xl border border-line">
        <table class="table-base">
          <thead>
            <tr>
              <th>Producto</th><th class="text-right">Cant.</th><th class="text-right">Devueltas</th>
              <th v-if="mode === 'return'" class="text-right">Devolver</th>
              <th class="text-right">Importe (sin ITBIS)</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="l in selected.lines" :key="l.id">
              <td>{{ l.description }}</td>
              <td class="num text-right">{{ formatNumber(l.quantity) }}</td>
              <td class="num text-right">{{ Number(l.returnedQty) ? formatNumber(l.returnedQty) : '' }}</td>
              <td v-if="mode === 'return'" class="text-right">
                <input
                  v-model="ret[l.id]"
                  class="input num ml-auto w-24 py-1.5 text-right"
                  inputmode="decimal"
                  :disabled="left(l).lte(0)"
                  :aria-label="`Cantidad a devolver de ${l.description}`"
                  placeholder="0"
                />
              </td>
              <td class="num text-right">{{ formatMoney(lineNet(l)) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-if="selected.returns.length" class="mt-3 text-sm text-ink-500">
        Devoluciones:
        <span v-for="(r, i) in selected.returns" :key="r.id">{{ i ? ', ' : '' }}{{ r.number }} ({{ formatMoney(r.total) }}, {{ METHOD_LABEL[r.method] }})</span>
      </p>

      <form v-if="mode === 'void'" id="void-form" class="mt-4 grid gap-4 sm:grid-cols-2" @submit.prevent="emitVoid">
        <div class="sm:col-span-2">
          <label for="void-code" class="label">Motivo de anulación (DGII)</label>
          <select id="void-code" v-model="code" class="input">
            <option v-for="c in VOID_CODES" :key="c[0]" :value="c[0]">{{ c[0] }} · {{ c[1] }}</option>
          </select>
        </div>
        <div class="sm:col-span-2">
          <label for="void-reason" class="label">Explica qué pasó</label>
          <input id="void-reason" v-model="reason" class="input" maxlength="500" />
        </div>
      </form>

      <form v-if="mode === 'return'" id="return-form" class="mt-4 grid gap-4 sm:grid-cols-3" @submit.prevent="emitReturn">
        <div>
          <label for="return-method" class="label">Devolver el dinero en</label>
          <select id="return-method" v-model="refund" class="input">
            <option v-for="m in PAY_METHODS" :key="m" :value="m">{{ METHOD_LABEL[m] }}</option>
          </select>
        </div>
        <div class="sm:col-span-2">
          <label for="return-reason" class="label">Motivo</label>
          <input id="return-reason" v-model="reason" class="input" maxlength="500" placeholder="No le sirvió, vino dañado…" />
        </div>
        <p class="hint sm:col-span-3">El monto exacto (con su ITBIS) lo calcula la nota de crédito. Se devuelve desde el turno abierto.</p>
        <div v-if="returnErrors" class="sm:col-span-3"><ErrorAlert :message="returnErrors" /></div>
      </form>

      <div class="mt-4"><ErrorAlert :message="error ?? listError" /></div>
    </template>

    <template #footer>
      <template v-if="selected">
        <BaseButton variant="secondary" @click="back">Volver</BaseButton>
        <template v-if="mode === 'view'">
          <BaseButton variant="secondary" :icon="Printer" @click="emit('print', selected.id)">Imprimir ticket</BaseButton>
          <template v-if="selected.status === 'COMPLETED'">
            <BaseButton v-if="selected.shiftId === shiftId" variant="danger" @click="startVoid">Anular</BaseButton>
            <BaseButton variant="accent" @click="startReturn">Devolución</BaseButton>
          </template>
        </template>
        <BaseButton v-else-if="mode === 'void'" type="submit" form="void-form" variant="danger" :loading="busy" :disabled="!reason.trim()">
          Anular venta
        </BaseButton>
        <BaseButton
          v-else
          type="submit"
          form="return-form"
          variant="accent"
          :loading="busy"
          :disabled="!reason.trim() || !hasReturn || !!returnErrors"
        >
          Registrar devolución
        </BaseButton>
      </template>
      <BaseButton v-else variant="secondary" @click="emit('close')">Cerrar</BaseButton>
    </template>
  </BaseModal>
</template>
