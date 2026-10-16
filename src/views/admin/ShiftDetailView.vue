<script setup lang="ts">
import { ref, watch } from 'vue';
import { getShiftDetail } from '@/api/admin';
import { errorMessage } from '@/api/errors';
import { listSales } from '@/api/pos';
import ErrorAlert from '@/components/ErrorAlert.vue';
import LoadingState from '@/components/LoadingState.vue';
import PageHeader from '@/components/PageHeader.vue';
import StatusBadge from '@/components/StatusBadge.vue';
import type { PosSaleRow, PosShift } from '@/types/api';
import { formatDateTime, formatMoney, formatTime } from '@/utils/format';
import { METHOD_LABEL, PAY_METHODS } from '@/utils/labels';

const props = defineProps<{ id: string }>();

const shift = ref<PosShift | null>(null);
const sales = ref<PosSaleRow[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);

async function load(id: string): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    const [s, v] = await Promise.all([getShiftDetail(id), listSales({ shiftId: id, limit: 100 })]);
    shift.value = s;
    sales.value = v.data;
  } catch (e) {
    error.value = errorMessage(e);
  } finally {
    loading.value = false;
  }
}

watch(() => props.id, (id) => void load(id), { immediate: true });

const diff = (s: PosShift) => Number(s.difference ?? 0);
</script>

<template>
  <div>
    <LoadingState v-if="loading && !shift" variant="detail" />
    <ErrorAlert v-else-if="error" :message="error" retry @retry="load(id)" />
    <template v-else-if="shift">
      <PageHeader :title="`Turno ${shift.number}`" :back="{ to: { name: 'turnos' }, label: 'Turnos de caja' }">
        <template #subtitle>
          {{ shift.terminal.name }} · abrió {{ shift.openedBy }} el {{ formatDateTime(shift.openedAt) }}
          <template v-if="shift.closedAt"> · cerró {{ shift.closedBy }} el {{ formatDateTime(shift.closedAt) }}</template>
        </template>
        <template #actions>
          <StatusBadge :tone="shift.status === 'OPEN' ? 'info' : 'neutral'">{{ shift.status === 'OPEN' ? 'Abierto (reporte X)' : 'Cerrado (reporte Z)' }}</StatusBadge>
        </template>
      </PageHeader>

      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div class="card">
          <p class="eyebrow">Ventas ({{ shift.totals.salesCount }})</p>
          <p class="num mt-2 text-2xl font-bold">{{ formatMoney(shift.totals.grossSales) }}</p>
          <p class="mt-1 text-xs text-ink-500">ITBIS {{ formatMoney(shift.totals.taxes) }}</p>
        </div>
        <div class="card">
          <p class="eyebrow">Fondo inicial</p>
          <p class="num mt-2 text-2xl font-bold">{{ formatMoney(shift.openingCash) }}</p>
        </div>
        <div class="card">
          <p class="eyebrow">Efectivo esperado</p>
          <p class="num mt-2 text-2xl font-bold">{{ formatMoney(shift.expectedCash ?? shift.totals.expectedCash) }}</p>
        </div>
        <div v-if="shift.countedCash !== null" class="card">
          <p class="eyebrow">Contado</p>
          <p class="num mt-2 text-2xl font-bold">{{ formatMoney(shift.countedCash) }}</p>
          <p :class="['mt-1 text-xs font-semibold', diff(shift) === 0 ? 'text-success' : diff(shift) > 0 ? 'text-info' : 'text-danger']">
            {{ diff(shift) === 0 ? 'Cuadra' : `${diff(shift) > 0 ? 'Sobrante' : 'Faltante'} ${formatMoney(shift.difference)}` }}
          </p>
        </div>
      </div>

      <div class="mt-6 grid gap-6 lg:grid-cols-2">
        <section class="card">
          <h2 class="card-title">Por forma de pago</h2>
          <dl class="mt-4 space-y-2 text-sm">
            <div v-for="m in PAY_METHODS" :key="m" class="flex justify-between gap-3">
              <dt>{{ METHOD_LABEL[m] }}</dt>
              <dd class="num">
                {{ formatMoney(shift.totals.salesByMethod[m]) }}
                <span v-if="Number(shift.totals.refundsByMethod[m]) > 0" class="text-ink-500">(devuelto {{ formatMoney(shift.totals.refundsByMethod[m]) }})</span>
              </dd>
            </div>
            <div class="flex justify-between gap-3"><dt>A crédito</dt><dd class="num">{{ formatMoney(shift.totals.creditSales) }}</dd></div>
            <div class="flex justify-between gap-3"><dt>Descuentos y promociones</dt><dd class="num">{{ formatMoney(shift.totals.discounts) }}</dd></div>
            <div class="flex justify-between gap-3"><dt>Ventas anuladas</dt><dd>{{ shift.totals.voidedCount }}</dd></div>
            <div class="flex justify-between gap-3"><dt>Devoluciones</dt><dd>{{ shift.totals.returnsCount }}</dd></div>
            <div class="flex justify-between gap-3"><dt>Aperturas de gaveta sin venta</dt><dd>{{ shift.totals.drawerOpens }}</dd></div>
          </dl>
          <p v-if="shift.closeNotes" class="mt-4 rounded-xl bg-surface-2 px-4 py-3 text-sm text-ink-600">Nota del cierre: {{ shift.closeNotes }}</p>
        </section>

        <section class="card">
          <h2 class="card-title">Entradas y salidas de efectivo</h2>
          <ul class="mt-4 divide-y divide-line text-sm">
            <li v-for="m in shift.movements" :key="m.id" class="flex items-start justify-between gap-3 py-2">
              <span><span class="text-ink-500">{{ formatTime(m.createdAt) }}</span> · {{ m.type === 'IN' ? 'Entrada' : 'Salida' }}: {{ m.reason }}</span>
              <span :class="['num whitespace-nowrap', m.type === 'OUT' && 'text-danger']">{{ m.type === 'OUT' ? '−' : '' }}{{ formatMoney(m.amount) }}</span>
            </li>
            <li v-for="d in shift.drawerEvents" :key="d.id" class="py-2 text-ink-600">
              <span class="text-ink-500">{{ formatTime(d.createdAt) }}</span> · Gaveta abierta sin venta: {{ d.reason }}
            </li>
            <li v-if="!shift.movements.length && !shift.drawerEvents.length" class="py-2 text-ink-500">Sin movimientos.</li>
          </ul>
        </section>
      </div>

      <section class="card mt-6 overflow-x-auto p-0 sm:p-0">
        <h2 class="card-title border-b border-line px-5 py-4 sm:px-6">Ventas del turno</h2>
        <table class="table-base">
          <thead>
            <tr><th>Ticket</th><th>Hora</th><th>Cliente</th><th>NCF</th><th>Factura</th><th class="text-right">Total</th><th>Estado</th></tr>
          </thead>
          <tbody>
            <tr v-for="v in sales" :key="v.id">
              <td class="font-mono">{{ v.number }}</td>
              <td>{{ formatTime(v.createdAt) }}</td>
              <td>{{ v.partner?.name ?? '—' }}</td>
              <td class="font-mono">{{ v.ncf ?? '—' }}</td>
              <td class="font-mono">{{ v.invoiceNumber }}</td>
              <td class="num text-right">{{ formatMoney(v.total) }}</td>
              <td><StatusBadge :tone="v.status === 'VOIDED' ? 'danger' : 'success'">{{ v.status === 'VOIDED' ? 'Anulada' : 'Cobrada' }}</StatusBadge></td>
            </tr>
            <tr v-if="!sales.length"><td colspan="7" class="py-8 text-center text-ink-500">Sin ventas.</td></tr>
          </tbody>
        </table>
      </section>
    </template>
  </div>
</template>
