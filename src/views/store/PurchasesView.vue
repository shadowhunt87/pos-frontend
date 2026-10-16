<script setup lang="ts">
import { Boxes, Plus, Search } from 'lucide-vue-next';
import { onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { errorMessage } from '@/api/errors';
import { listPurchases } from '@/api/store';
import EmptyState from '@/components/EmptyState.vue';
import ErrorAlert from '@/components/ErrorAlert.vue';
import LoadingState from '@/components/LoadingState.vue';
import PageHeader from '@/components/PageHeader.vue';
import PaginationBar from '@/components/PaginationBar.vue';
import StatusBadge from '@/components/StatusBadge.vue';
import { useAuthStore } from '@/stores/auth';
import type { InvoiceRow } from '@/types/api';
import { formatDateOnly, formatMoney } from '@/utils/format';
import { INVOICE_STATUS } from '@/utils/labels';

const auth = useAuthStore();
const router = useRouter();
const LIMIT = 30;
const q = ref('');
const rows = ref<InvoiceRow[]>([]);
const total = ref(0);
const page = ref(1);
const loading = ref(true);
const error = ref<string | null>(null);

async function load(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    const r = await listPurchases({ q: q.value.trim(), page: page.value, limit: LIMIT });
    rows.value = r.data;
    total.value = r.total;
  } catch (e) {
    error.value = errorMessage(e);
  } finally {
    loading.value = false;
  }
}

let timer: ReturnType<typeof setTimeout> | undefined;
watch(q, () => {
  clearTimeout(timer);
  timer = setTimeout(() => {
    page.value = 1;
    void load();
  }, 250);
});

onMounted(load);
</script>

<template>
  <div>
    <PageHeader title="Compras" subtitle="Facturas de los proveedores: la mercancía entra al inventario a su costo y queda la cuenta por pagar en la contabilidad.">
      <template #actions>
        <RouterLink v-if="auth.can('editarInventario')" to="/compras/nueva" class="inline-flex min-h-10 items-center gap-2 rounded-xl bg-brand-500 px-4 text-sm font-semibold text-white hover:bg-brand-600">
          <Plus class="size-4" aria-hidden="true" />Registrar compra
        </RouterLink>
      </template>
    </PageHeader>

    <div class="relative mb-4 max-w-md">
      <label for="pur-q" class="sr-only">Buscar</label>
      <Search class="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-400" aria-hidden="true" />
      <input id="pur-q" v-model="q" type="search" class="input pl-10" placeholder="Número, NCF o proveedor" />
    </div>

    <LoadingState v-if="loading && !rows.length" variant="table" />
    <ErrorAlert v-else-if="error" :message="error" retry @retry="load" />
    <EmptyState v-else-if="!rows.length" :icon="Boxes" :text="q ? 'No hay compras con ese filtro.' : 'Todavía no hay compras registradas.'" />
    <template v-else>
      <section class="card overflow-x-auto p-0 sm:p-0">
        <table class="table-base">
          <thead><tr><th>Compra</th><th>Fecha</th><th>Proveedor</th><th>NCF</th><th class="text-right">Total</th><th class="text-right">Por pagar</th><th>Estado</th></tr></thead>
          <tbody>
            <tr v-for="r in rows" :key="r.id" class="cursor-pointer" @click="router.push(`/compras/${r.id}`)">
              <td class="font-mono font-medium whitespace-nowrap">{{ r.number }}</td>
              <td>{{ formatDateOnly(r.issueDate) }}</td>
              <td>{{ r.partner?.name }}</td>
              <td class="font-mono">{{ r.ncf ?? '—' }}</td>
              <td class="num text-right">{{ formatMoney(r.total) }}</td>
              <td class="num text-right">{{ formatMoney(r.balance) }}</td>
              <td><StatusBadge :tone="INVOICE_STATUS[r.status]?.tone ?? 'neutral'">{{ r.status === 'PAID' ? 'Pagada' : r.status === 'VOIDED' ? 'Anulada' : 'Por pagar' }}</StatusBadge></td>
            </tr>
          </tbody>
        </table>
      </section>
      <PaginationBar :page="page" :limit="LIMIT" :total="total" :busy="loading" @go="(p) => { page = p; load(); }" />
    </template>
  </div>
</template>
