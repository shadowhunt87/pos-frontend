<script setup lang="ts">
import { Pencil, Plus, Search, Truck, Users } from 'lucide-vue-next';
import { computed, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { errorMessage } from '@/api/errors';
import { listPartners, type PartnerKind } from '@/api/store';
import BaseButton from '@/components/BaseButton.vue';
import EmptyState from '@/components/EmptyState.vue';
import ErrorAlert from '@/components/ErrorAlert.vue';
import LoadingState from '@/components/LoadingState.vue';
import PageHeader from '@/components/PageHeader.vue';
import PaginationBar from '@/components/PaginationBar.vue';
import StatusBadge from '@/components/StatusBadge.vue';
import PartnerFormModal from '@/components/store/PartnerFormModal.vue';
import { useAuthStore } from '@/stores/auth';
import { useToastStore } from '@/stores/toast';
import type { PartnerDetail, PartnerRow } from '@/types/api';
import { formatMoney } from '@/utils/format';

// Clientes (/clientes) y proveedores (/proveedores): mismos datos del sistema contable, distinto permiso.
const props = defineProps<{ kind: PartnerKind }>();
const auth = useAuthStore();
const toast = useToastStore();
const router = useRouter();
const LIMIT = 50;

const isCustomer = computed(() => props.kind === 'customers');
const canEdit = computed(() => auth.can(isCustomer.value ? 'vender' : 'editarInventario'));
const q = ref('');
const withBalance = ref(false);
const rows = ref<PartnerRow[]>([]);
const total = ref(0);
const page = ref(1);
const loading = ref(true);
const error = ref<string | null>(null);
const editing = ref<PartnerRow | null>(null);
const formOpen = ref(false);

async function load(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    const r = await listPartners(props.kind, { q: q.value.trim(), withBalance: withBalance.value || undefined, page: page.value, limit: LIMIT });
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
watch(withBalance, () => {
  page.value = 1;
  void load();
});
watch(() => props.kind, () => {
  q.value = '';
  withBalance.value = false;
  page.value = 1;
  void load();
}, { immediate: true });

function go(p: number): void {
  page.value = p;
  void load();
}

function edit(p: PartnerRow | null): void {
  editing.value = p;
  formOpen.value = true;
}

function saved(p: PartnerDetail): void {
  formOpen.value = false;
  toast.success(isCustomer.value ? 'Cliente guardado' : 'Proveedor guardado', p.name);
  void load();
}

function open(p: PartnerRow): void {
  if (isCustomer.value) void router.push(`/clientes/${p.id}`);
  else if (canEdit.value) edit(p);
}
</script>

<template>
  <div>
    <PageHeader
      :title="isCustomer ? 'Clientes' : 'Proveedores'"
      :subtitle="isCustomer ? 'Quién te compra, cuánto te debe y qué comprobante pide.' : 'A quién le compras la mercancía y cuánto le debes.'"
    >
      <template #actions>
        <BaseButton v-if="canEdit" variant="accent" :icon="Plus" @click="edit(null)">{{ isCustomer ? 'Cliente nuevo' : 'Proveedor nuevo' }}</BaseButton>
      </template>
    </PageHeader>

    <div class="mb-4 flex flex-wrap items-center gap-3">
      <div class="relative min-w-64 flex-1">
        <label for="partner-q" class="sr-only">Buscar</label>
        <Search class="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-400" aria-hidden="true" />
        <input id="partner-q" v-model="q" type="search" class="input pl-10" placeholder="Nombre, RNC o cédula" />
      </div>
      <label class="flex items-center gap-2 text-sm">
        <input v-model="withBalance" type="checkbox" class="size-4 accent-[var(--brand-600)]" />
        Solo con saldo pendiente
      </label>
    </div>

    <LoadingState v-if="loading && !rows.length" variant="table" />
    <ErrorAlert v-else-if="error" :message="error" retry @retry="load" />
    <EmptyState
      v-else-if="!rows.length"
      :icon="isCustomer ? Users : Truck"
      :text="q || withBalance ? 'No hay resultados con ese filtro.' : isCustomer ? 'Todavía no hay clientes.' : 'Todavía no hay proveedores.'"
    />
    <template v-else>
      <section class="card overflow-x-auto p-0 sm:p-0">
        <table class="table-base">
          <thead>
            <tr>
              <th>Nombre</th><th>RNC / Cédula</th><th>Teléfono</th><th class="text-right">Crédito</th>
              <th class="text-right">{{ isCustomer ? 'Me debe' : 'Le debo' }}</th><th>Estado</th><th><span class="sr-only">Acciones</span></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="p in rows" :key="p.id" :class="(isCustomer || canEdit) && 'cursor-pointer'" @click="open(p)">
              <td>
                <p class="font-medium">{{ p.name }}</p>
                <p v-if="p.tradeName" class="text-xs text-ink-500">{{ p.tradeName }}</p>
              </td>
              <td class="font-mono">{{ p.taxId ?? '—' }}</td>
              <td>{{ p.phone ?? '—' }}</td>
              <td class="text-right">{{ p.paymentTermsDays ? `${p.paymentTermsDays} días` : 'Contado' }}</td>
              <td :class="['num text-right', Number(p.balance) > 0 && 'font-semibold']">{{ formatMoney(p.balance) }}</td>
              <td><StatusBadge :tone="p.active ? 'success' : 'neutral'">{{ p.active ? 'Activo' : 'Inactivo' }}</StatusBadge></td>
              <td class="text-right" @click.stop>
                <BaseButton v-if="canEdit" size="sm" variant="ghost" :icon="Pencil" @click="edit(p)">Editar</BaseButton>
              </td>
            </tr>
          </tbody>
        </table>
      </section>
      <PaginationBar :page="page" :limit="LIMIT" :total="total" :busy="loading" @go="go" />
    </template>

    <PartnerFormModal :open="formOpen" :kind="kind" :partner="editing" @saved="saved" @close="formOpen = false" />
  </div>
</template>
