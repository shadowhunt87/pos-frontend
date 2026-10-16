<script setup lang="ts">
import { ref, watch } from 'vue';
import { errorMessage } from '@/api/errors';
import { getKardex } from '@/api/store';
import ErrorAlert from '@/components/ErrorAlert.vue';
import LoadingState from '@/components/LoadingState.vue';
import PageHeader from '@/components/PageHeader.vue';
import PaginationBar from '@/components/PaginationBar.vue';
import type { KardexPage } from '@/types/api';
import { formatDateOnly, formatMoney, formatNumber } from '@/utils/format';
import { MOVEMENT_LABEL } from '@/utils/labels';

const props = defineProps<{ id: string }>();
const LIMIT = 100;
const data = ref<KardexPage | null>(null);
const page = ref(1);
const loading = ref(true);
const error = ref<string | null>(null);

async function load(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    data.value = await getKardex(props.id, { page: page.value, limit: LIMIT });
  } catch (e) {
    error.value = errorMessage(e);
  } finally {
    loading.value = false;
  }
}

watch(() => props.id, () => {
  page.value = 1;
  void load();
}, { immediate: true });

function docLink(m: KardexPage['data'][number]): string | null {
  if (!m.invoice) return null;
  return m.invoice.type === 'PURCHASE' ? `/compras/${m.invoice.id}` : `/facturas/${m.invoice.id}`;
}
</script>

<template>
  <div>
    <LoadingState v-if="loading && !data" variant="table" />
    <ErrorAlert v-else-if="error" :message="error" retry @retry="load" />
    <template v-else-if="data">
      <PageHeader :title="data.product.name" :subtitle="`Kárdex · ${data.product.code}`" :back="{ to: '/inventario', label: 'Inventario' }" />
      <div class="grid gap-4 sm:grid-cols-3">
        <div class="card"><p class="eyebrow">Existencia</p><p class="num mt-2 text-2xl font-bold">{{ formatNumber(data.product.stockQty) }} {{ data.product.unit }}</p></div>
        <div class="card"><p class="eyebrow">Costo promedio</p><p class="num mt-2 text-2xl font-bold">{{ formatMoney(data.product.avgCost) }}</p></div>
        <div class="card"><p class="eyebrow">Valor</p><p class="num mt-2 text-2xl font-bold">{{ formatMoney(data.product.stockValue) }}</p></div>
      </div>
      <section class="card mt-6 overflow-x-auto p-0 sm:p-0">
        <table class="table-base">
          <thead>
            <tr><th>Fecha</th><th>Movimiento</th><th>Documento</th><th class="text-right">Cantidad</th><th class="text-right">Costo unitario</th><th class="text-right">Queda</th><th class="text-right">Valor</th></tr>
          </thead>
          <tbody>
            <tr v-for="m in data.data" :key="m.id">
              <td class="whitespace-nowrap">{{ formatDateOnly(m.date) }}</td>
              <td>{{ MOVEMENT_LABEL[m.type] ?? m.type }}</td>
              <td>
                <RouterLink v-if="docLink(m)" :to="docLink(m)!" class="link font-mono">{{ m.invoice?.number }}</RouterLink>
                <span v-else-if="m.adjustment" class="font-mono">{{ m.adjustment.number }}</span>
                <span v-else class="text-ink-400">—</span>
              </td>
              <td :class="['num text-right', Number(m.quantity) < 0 ? 'text-danger' : 'text-success']">{{ Number(m.quantity) > 0 ? '+' : '' }}{{ formatNumber(m.quantity) }}</td>
              <td class="num text-right">{{ formatMoney(m.unitCost) }}</td>
              <td class="num text-right font-medium">{{ formatNumber(m.qtyAfter) }}</td>
              <td class="num text-right">{{ formatMoney(m.valueAfter) }}</td>
            </tr>
            <tr v-if="!data.data.length"><td colspan="7" class="py-8 text-center text-ink-500">Este producto no tiene movimientos todavía.</td></tr>
          </tbody>
        </table>
      </section>
      <PaginationBar :page="page" :limit="LIMIT" :total="data.total" :busy="loading" @go="(p) => { page = p; load(); }" />
    </template>
  </div>
</template>
