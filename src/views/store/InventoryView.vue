<script setup lang="ts">
import { ClipboardList, Plus, Search, Warehouse } from 'lucide-vue-next';
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { errorMessage } from '@/api/errors';
import { getAdjustment, listAdjustments, listStock, voidAdjustment } from '@/api/store';
import BaseButton from '@/components/BaseButton.vue';
import BaseModal from '@/components/BaseModal.vue';
import EmptyState from '@/components/EmptyState.vue';
import ErrorAlert from '@/components/ErrorAlert.vue';
import LoadingState from '@/components/LoadingState.vue';
import PageHeader from '@/components/PageHeader.vue';
import PaginationBar from '@/components/PaginationBar.vue';
import StatusBadge from '@/components/StatusBadge.vue';
import AdjustmentModal from '@/components/store/AdjustmentModal.vue';
import { useAuthStore } from '@/stores/auth';
import { useToastStore } from '@/stores/toast';
import type { AdjustmentDetail, AdjustmentRow, StockRow } from '@/types/api';
import { formatDateOnly, formatMoney, formatNumber } from '@/utils/format';

const auth = useAuthStore();
const toast = useToastStore();
const route = useRoute();
const router = useRouter();
const LIMIT = 50;

const tab = ref<'stock' | 'adjustments'>(route.query.tab === 'ajustes' && auth.can('inventario') ? 'adjustments' : 'stock');

// Existencias
const q = ref('');
const withStock = ref(false);
const stock = ref<StockRow[]>([]);
const stockTotal = ref(0);
const totalValue = ref('0');
const stockPage = ref(1);

// Ajustes
const adjustments = ref<AdjustmentRow[]>([]);
const adjTotal = ref(0);
const adjPage = ref(1);
const newOpen = ref(false);
const detail = ref<AdjustmentDetail | null>(null);
const voidReason = ref('');
const voidBusy = ref(false);
const voidError = ref<string | null>(null);

const loading = ref(true);
const error = ref<string | null>(null);
const showValue = computed(() => auth.can('inventario'));

async function loadStock(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    const r = await listStock({ q: q.value.trim(), withStock: withStock.value || undefined, page: stockPage.value, limit: LIMIT });
    stock.value = r.data;
    stockTotal.value = r.total;
    totalValue.value = r.totalValue;
  } catch (e) {
    error.value = errorMessage(e);
  } finally {
    loading.value = false;
  }
}

async function loadAdjustments(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    const r = await listAdjustments({ page: adjPage.value, limit: 30 });
    adjustments.value = r.data;
    adjTotal.value = r.total;
  } catch (e) {
    error.value = errorMessage(e);
  } finally {
    loading.value = false;
  }
}

const load = () => (tab.value === 'stock' ? loadStock() : loadAdjustments());

watch(tab, (t) => {
  void router.replace({ query: t === 'adjustments' ? { tab: 'ajustes' } : {} });
  void load();
});
let timer: ReturnType<typeof setTimeout> | undefined;
watch(q, () => {
  clearTimeout(timer);
  timer = setTimeout(() => {
    stockPage.value = 1;
    void loadStock();
  }, 250);
});
watch(withStock, () => {
  stockPage.value = 1;
  void loadStock();
});

async function openDetail(a: AdjustmentRow): Promise<void> {
  voidReason.value = '';
  voidError.value = null;
  try {
    detail.value = await getAdjustment(a.id);
  } catch (e) {
    toast.error('No se pudo abrir el ajuste', errorMessage(e));
  }
}

async function confirmVoid(): Promise<void> {
  if (!detail.value || !voidReason.value.trim() || voidBusy.value) return;
  voidBusy.value = true;
  voidError.value = null;
  try {
    detail.value = await voidAdjustment(detail.value.id, voidReason.value.trim());
    toast.success('Ajuste anulado', 'Las existencias volvieron como estaban.');
    void loadAdjustments();
  } catch (e) {
    voidError.value = errorMessage(e);
  } finally {
    voidBusy.value = false;
  }
}

function adjustmentSaved(a: AdjustmentDetail): void {
  newOpen.value = false;
  toast.success(`Ajuste ${a.number} registrado`);
  if (tab.value === 'adjustments') void loadAdjustments();
  else tab.value = 'adjustments';
}

onMounted(load);
</script>

<template>
  <div>
    <PageHeader title="Inventario" subtitle="Existencias al día con su costo promedio. Entran con las compras y los ajustes; salen con las ventas.">
      <template #actions>
        <BaseButton v-if="auth.can('editarInventario')" variant="accent" :icon="Plus" @click="newOpen = true">Ajuste de inventario</BaseButton>
      </template>
    </PageHeader>

    <div v-if="auth.can('inventario')" class="mb-4 inline-flex rounded-xl bg-ink-100 p-1" role="tablist">
      <button type="button" role="tab" :aria-selected="tab === 'stock'" :class="['min-h-9 rounded-lg px-4 text-sm font-semibold', tab === 'stock' ? 'bg-surface shadow-card' : 'text-ink-600']" @click="tab = 'stock'">Existencias</button>
      <button type="button" role="tab" :aria-selected="tab === 'adjustments'" :class="['min-h-9 rounded-lg px-4 text-sm font-semibold', tab === 'adjustments' ? 'bg-surface shadow-card' : 'text-ink-600']" @click="tab = 'adjustments'">Ajustes</button>
    </div>

    <!-- Existencias -->
    <template v-if="tab === 'stock'">
      <div class="mb-4 flex flex-wrap items-center gap-3">
        <div class="relative min-w-64 flex-1">
          <label for="stock-q" class="sr-only">Buscar</label>
          <Search class="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-400" aria-hidden="true" />
          <input id="stock-q" v-model="q" type="search" class="input pl-10" placeholder="Código o nombre" />
        </div>
        <label class="flex items-center gap-2 text-sm"><input v-model="withStock" type="checkbox" class="size-4 accent-[var(--brand-600)]" /> Solo con existencia</label>
        <p v-if="showValue" class="text-sm text-ink-500">Valor del inventario: <strong class="num text-ink-900">{{ formatMoney(totalValue) }}</strong></p>
      </div>
      <LoadingState v-if="loading && !stock.length" variant="table" />
      <ErrorAlert v-else-if="error" :message="error" retry @retry="load" />
      <EmptyState v-else-if="!stock.length" :icon="Warehouse" text="No hay productos que controlen existencias. Actívalo en la ficha del producto («Controla existencias»)." />
      <template v-else>
        <section class="card overflow-x-auto p-0 sm:p-0">
          <table class="table-base">
            <thead>
              <tr><th>Producto</th><th class="text-right">Existencia</th><th v-if="showValue" class="text-right">Costo promedio</th><th v-if="showValue" class="text-right">Valor</th><th><span class="sr-only">Kárdex</span></th></tr>
            </thead>
            <tbody>
              <tr v-for="s in stock" :key="s.id" :class="auth.can('inventario') && 'cursor-pointer'" @click="auth.can('inventario') && router.push(`/inventario/${s.id}`)">
                <td>
                  <p class="font-medium">{{ s.name }}</p>
                  <p class="font-mono text-xs text-ink-500">{{ s.code }}</p>
                </td>
                <td :class="['num text-right font-semibold', Number(s.stockQty) <= 0 && 'text-danger']">{{ formatNumber(s.stockQty) }} {{ s.unit }}</td>
                <td v-if="showValue" class="num text-right">{{ formatMoney(s.avgCost) }}</td>
                <td v-if="showValue" class="num text-right">{{ formatMoney(s.stockValue) }}</td>
                <td class="text-right"><span v-if="auth.can('inventario')" class="link text-sm">Kárdex</span></td>
              </tr>
            </tbody>
          </table>
        </section>
        <PaginationBar :page="stockPage" :limit="LIMIT" :total="stockTotal" :busy="loading" @go="(p) => { stockPage = p; loadStock(); }" />
      </template>
    </template>

    <!-- Ajustes -->
    <template v-else>
      <LoadingState v-if="loading && !adjustments.length" variant="table" />
      <ErrorAlert v-else-if="error" :message="error" retry @retry="load" />
      <EmptyState v-else-if="!adjustments.length" :icon="ClipboardList" text="Todavía no hay ajustes de inventario." />
      <template v-else>
        <section class="card overflow-x-auto p-0 sm:p-0">
          <table class="table-base">
            <thead><tr><th>Ajuste</th><th>Fecha</th><th>Motivo</th><th class="text-right">Productos</th><th>Estado</th></tr></thead>
            <tbody>
              <tr v-for="a in adjustments" :key="a.id" class="cursor-pointer" @click="openDetail(a)">
                <td class="font-mono">{{ a.number }}</td>
                <td>{{ formatDateOnly(a.date) }}</td>
                <td>{{ a.reason }}</td>
                <td class="num text-right">{{ a._count.lines }}</td>
                <td><StatusBadge :tone="a.status === 'VOIDED' ? 'neutral' : 'success'">{{ a.status === 'VOIDED' ? 'Anulado' : 'Registrado' }}</StatusBadge></td>
              </tr>
            </tbody>
          </table>
        </section>
        <PaginationBar :page="adjPage" :limit="30" :total="adjTotal" :busy="loading" @go="(p) => { adjPage = p; loadAdjustments(); }" />
      </template>
    </template>

    <AdjustmentModal :open="newOpen" @saved="adjustmentSaved" @close="newOpen = false" />

    <BaseModal :open="!!detail" :title="`Ajuste ${detail?.number ?? ''}`" :description="detail ? `${formatDateOnly(detail.date)} · ${detail.reason}` : undefined" size="lg" @close="detail = null">
      <template v-if="detail">
        <p v-if="detail.status === 'VOIDED'" class="mb-4 rounded-xl bg-surface-2 px-4 py-3 text-sm text-ink-600">Anulado{{ detail.voidReason ? `: ${detail.voidReason}` : '' }}</p>
        <div class="overflow-x-auto rounded-xl border border-line">
          <table class="table-base">
            <thead><tr><th>Producto</th><th class="text-right">Cantidad</th><th class="text-right">Costo unitario</th><th class="text-right">Total</th></tr></thead>
            <tbody>
              <tr v-for="l in detail.lines" :key="l.id">
                <td>{{ l.product.name }} <span class="font-mono text-xs text-ink-500">{{ l.product.code }}</span></td>
                <td :class="['num text-right', Number(l.quantity) < 0 && 'text-danger']">{{ formatNumber(l.quantity) }} {{ l.product.unit }}</td>
                <td class="num text-right">{{ formatMoney(l.unitCost) }}</td>
                <td class="num text-right">{{ formatMoney(l.totalCost) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <form v-if="detail.status !== 'VOIDED' && auth.can('anularInventario')" id="adj-void" class="mt-5" @submit.prevent="confirmVoid">
          <label for="adj-void-reason" class="label">Para anularlo, explica por qué</label>
          <input id="adj-void-reason" v-model="voidReason" class="input" maxlength="500" />
          <div class="mt-3"><ErrorAlert :message="voidError" /></div>
        </form>
      </template>
      <template #footer>
        <BaseButton variant="secondary" @click="detail = null">Cerrar</BaseButton>
        <BaseButton v-if="detail?.status !== 'VOIDED' && auth.can('anularInventario')" type="submit" form="adj-void" variant="danger" :loading="voidBusy" :disabled="!voidReason.trim()">Anular ajuste</BaseButton>
      </template>
    </BaseModal>
  </div>
</template>
