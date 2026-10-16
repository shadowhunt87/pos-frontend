<script setup lang="ts">
import { Clock } from 'lucide-vue-next';
import { computed, onMounted, ref, watch } from 'vue';
import { listShifts } from '@/api/admin';
import { errorMessage } from '@/api/errors';
import BaseButton from '@/components/BaseButton.vue';
import EmptyState from '@/components/EmptyState.vue';
import ErrorAlert from '@/components/ErrorAlert.vue';
import LoadingState from '@/components/LoadingState.vue';
import PageHeader from '@/components/PageHeader.vue';
import StatusBadge from '@/components/StatusBadge.vue';
import type { ShiftRow } from '@/types/api';
import { formatDateTime, formatMoney } from '@/utils/format';

const LIMIT = 30;
const rows = ref<ShiftRow[]>([]);
const total = ref(0);
const page = ref(1);
const status = ref<'' | 'OPEN' | 'CLOSED'>('');
const loading = ref(true);
const error = ref<string | null>(null);

const pages = computed(() => Math.max(1, Math.ceil(total.value / LIMIT)));

async function load(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    const r = await listShifts({ page: page.value, limit: LIMIT, ...(status.value ? { status: status.value } : {}) });
    rows.value = r.data;
    total.value = r.total;
  } catch (e) {
    error.value = errorMessage(e);
  } finally {
    loading.value = false;
  }
}

watch(status, () => {
  page.value = 1;
  void load();
});

function go(p: number): void {
  page.value = p;
  void load();
}

const diffTone = (d: string | null) => (d === null ? 'text-ink-400' : Number(d) < 0 ? 'text-danger' : Number(d) > 0 ? 'text-info' : 'text-success');

onMounted(load);
</script>

<template>
  <div>
    <PageHeader title="Turnos de caja" subtitle="Cada apertura y cierre de caja, con lo que debía haber y lo que se contó.">
      <template #actions>
        <label for="shift-status" class="sr-only">Estado</label>
        <select id="shift-status" v-model="status" class="input w-40">
          <option value="">Todos</option>
          <option value="OPEN">Abiertos</option>
          <option value="CLOSED">Cerrados</option>
        </select>
      </template>
    </PageHeader>

    <LoadingState v-if="loading && !rows.length" variant="table" />
    <ErrorAlert v-else-if="error" :message="error" retry @retry="load" />
    <EmptyState v-else-if="!rows.length" :icon="Clock" text="Todavía no hay turnos. Se crean al abrir la caja." />
    <template v-else>
      <section class="card overflow-x-auto p-0 sm:p-0">
        <table class="table-base">
          <thead>
            <tr>
              <th>Turno</th><th>Caja</th><th>Abierto</th><th>Cerrado</th><th class="text-right">Ventas</th>
              <th class="text-right">Esperado</th><th class="text-right">Contado</th><th class="text-right">Diferencia</th><th>Estado</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="s in rows" :key="s.id">
              <td><RouterLink :to="{ name: 'turno', params: { id: s.id } }" class="link font-mono">{{ s.number }}</RouterLink></td>
              <td>{{ s.terminal.name }}</td>
              <td class="whitespace-nowrap">{{ formatDateTime(s.openedAt) }}</td>
              <td class="whitespace-nowrap">{{ formatDateTime(s.closedAt) }}</td>
              <td class="num text-right">{{ s._count.sales }}</td>
              <td class="num text-right">{{ formatMoney(s.expectedCash) }}</td>
              <td class="num text-right">{{ formatMoney(s.countedCash) }}</td>
              <td :class="['num text-right font-semibold', diffTone(s.difference)]">{{ formatMoney(s.difference) }}</td>
              <td><StatusBadge :tone="s.status === 'OPEN' ? 'info' : 'neutral'">{{ s.status === 'OPEN' ? 'Abierto' : 'Cerrado' }}</StatusBadge></td>
            </tr>
          </tbody>
        </table>
      </section>
      <nav v-if="pages > 1" class="mt-4 flex items-center justify-end gap-2" aria-label="Páginas">
        <BaseButton size="sm" variant="secondary" :disabled="page <= 1 || loading" @click="go(page - 1)">Anterior</BaseButton>
        <span class="text-sm text-ink-500">Página {{ page }} de {{ pages }}</span>
        <BaseButton size="sm" variant="secondary" :disabled="page >= pages || loading" @click="go(page + 1)">Siguiente</BaseButton>
      </nav>
    </template>
  </div>
</template>
