<script setup lang="ts">
import { BarChart3 } from 'lucide-vue-next';
import { onMounted, ref } from 'vue';
import { getSalesReport } from '@/api/admin';
import { errorMessage } from '@/api/errors';
import BaseButton from '@/components/BaseButton.vue';
import EmptyState from '@/components/EmptyState.vue';
import ErrorAlert from '@/components/ErrorAlert.vue';
import LoadingState from '@/components/LoadingState.vue';
import PageHeader from '@/components/PageHeader.vue';
import type { SalesReport } from '@/types/api';
import { formatDay, formatMoney, formatNumber, monthStartInput, todayInput } from '@/utils/format';

const from = ref(monthStartInput());
const to = ref(todayInput());
const data = ref<SalesReport | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);

async function load(): Promise<void> {
  if (!from.value || !to.value) {
    error.value = 'Elige las dos fechas.';
    return;
  }
  if (to.value < from.value) {
    error.value = 'La fecha «Hasta» es anterior a «Desde».';
    return;
  }
  loading.value = true;
  error.value = null;
  try {
    data.value = await getSalesReport({ from: from.value, to: to.value });
  } catch (e) {
    error.value = errorMessage(e);
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<template>
  <div>
    <PageHeader title="Ventas" subtitle="Lo vendido en caja en el período. Las facturas y su contabilidad están en el sistema financiero." />

    <form class="mb-6 flex flex-wrap items-end gap-3" @submit.prevent="load">
      <div>
        <label for="rep-from" class="label">Desde</label>
        <input id="rep-from" v-model="from" type="date" class="input" />
      </div>
      <div>
        <label for="rep-to" class="label">Hasta</label>
        <input id="rep-to" v-model="to" type="date" class="input" />
      </div>
      <BaseButton type="submit" variant="accent" size="lg" :loading="loading">Ver</BaseButton>
    </form>

    <ErrorAlert :message="error" />
    <LoadingState v-if="loading && !data" variant="cards" />

    <template v-if="data">
      <div class="grid gap-4 sm:grid-cols-3">
        <div class="card"><p class="eyebrow">Ventas</p><p class="num mt-2 text-2xl font-bold">{{ data.totals.count }}</p></div>
        <div class="card"><p class="eyebrow">Total vendido</p><p class="num mt-2 text-2xl font-bold">{{ formatMoney(data.totals.total) }}</p></div>
        <div class="card"><p class="eyebrow">Devoluciones</p><p class="num mt-2 text-2xl font-bold">{{ formatMoney(data.totals.returns) }}</p></div>
      </div>

      <EmptyState v-if="!data.totals.count" class="mt-6" :icon="BarChart3" text="No hay ventas en ese período." />
      <div v-else class="mt-6 grid gap-6 lg:grid-cols-2">
        <section class="card overflow-x-auto p-0 sm:p-0">
          <h2 class="card-title border-b border-line px-5 py-4">Por día</h2>
          <table class="table-base">
            <thead><tr><th>Día</th><th class="text-right">Ventas</th><th class="text-right">ITBIS</th><th class="text-right">Total</th></tr></thead>
            <tbody>
              <tr v-for="g in data.byDay" :key="g.key">
                <td>{{ formatDay(g.key) }}</td><td class="num text-right">{{ g.count }}</td>
                <td class="num text-right">{{ formatMoney(g.tax) }}</td><td class="num text-right">{{ formatMoney(g.total) }}</td>
              </tr>
            </tbody>
          </table>
        </section>
        <section class="card overflow-x-auto p-0 sm:p-0">
          <h2 class="card-title border-b border-line px-5 py-4">Productos más vendidos</h2>
          <table class="table-base">
            <thead><tr><th>Producto</th><th class="text-right">Cantidad</th><th class="text-right">Vendido (sin ITBIS)</th></tr></thead>
            <tbody>
              <tr v-for="p in data.topProducts" :key="p.productId">
                <td>{{ p.description }}</td><td class="num text-right">{{ formatNumber(p.quantity) }}</td><td class="num text-right">{{ formatMoney(p.amount) }}</td>
              </tr>
            </tbody>
          </table>
        </section>
        <section class="card overflow-x-auto p-0 sm:p-0">
          <h2 class="card-title border-b border-line px-5 py-4">Por caja</h2>
          <table class="table-base">
            <thead><tr><th>Caja</th><th class="text-right">Ventas</th><th class="text-right">Total</th></tr></thead>
            <tbody>
              <tr v-for="g in data.byTerminal" :key="g.key"><td>{{ g.name }}</td><td class="num text-right">{{ g.count }}</td><td class="num text-right">{{ formatMoney(g.total) }}</td></tr>
            </tbody>
          </table>
        </section>
        <section class="card overflow-x-auto p-0 sm:p-0">
          <h2 class="card-title border-b border-line px-5 py-4">Por cajero</h2>
          <table class="table-base">
            <thead><tr><th>Cajero</th><th class="text-right">Ventas</th><th class="text-right">Total</th></tr></thead>
            <tbody>
              <tr v-for="g in data.byCashier" :key="g.key"><td>{{ g.name }}</td><td class="num text-right">{{ g.count }}</td><td class="num text-right">{{ formatMoney(g.total) }}</td></tr>
            </tbody>
          </table>
        </section>
      </div>
    </template>
  </div>
</template>
