<script setup lang="ts">
import { AlertTriangle, Boxes, FileText, PackageX, ShoppingCart, Wallet } from 'lucide-vue-next';
import { computed, onMounted, ref, type Component } from 'vue';
import { errorMessage } from '@/api/errors';
import { getSummary } from '@/api/store';
import ErrorAlert from '@/components/ErrorAlert.vue';
import LoadingState from '@/components/LoadingState.vue';
import PageHeader from '@/components/PageHeader.vue';
import { useAuthStore } from '@/stores/auth';
import type { StoreSummary } from '@/types/api';
import { formatMoney } from '@/utils/format';
import type { Permission } from '@/utils/permissions';

const auth = useAuthStore();
const data = ref<StoreSummary | null>(null);
const loading = ref(true);
const error = ref<string | null>(null);

interface Action {
  to: string;
  label: string;
  hint: string;
  icon: Component;
  permission: Permission;
}
const ACTIONS: Action[] = [
  { to: '/caja', label: 'Abrir la caja', hint: 'Vender en el mostrador', icon: ShoppingCart, permission: 'caja' },
  { to: '/facturas/nueva', label: 'Nueva factura', hint: 'A crédito o a una empresa', icon: FileText, permission: 'vender' },
  { to: '/facturas?pendientes=1', label: 'Cobrar facturas', hint: 'Facturas con saldo pendiente', icon: Wallet, permission: 'cobrar' },
  { to: '/compras/nueva', label: 'Registrar compra', hint: 'Entrada de mercancía', icon: Boxes, permission: 'editarInventario' },
];
const actions = computed(() => ACTIONS.filter((a) => auth.can(a.permission)));

async function load(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    data.value = await getSummary();
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
    <PageHeader :title="`Hola, ${auth.user?.name?.split(' ')[0] ?? ''}`" subtitle="Lo que pasa hoy en la tienda." />

    <LoadingState v-if="loading" variant="cards" />
    <ErrorAlert v-else-if="error" :message="error" retry @retry="load" />
    <div v-else-if="data" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div class="card">
        <p class="eyebrow">Vendido hoy</p>
        <p class="num mt-2 text-2xl font-bold">{{ formatMoney(data.salesToday.total) }}</p>
        <p class="mt-1 text-xs text-ink-500">{{ data.salesToday.count }} factura(s), caja incluida</p>
      </div>
      <RouterLink to="/facturas?pendientes=1" class="card transition hover:border-brand-500">
        <p class="eyebrow">Por cobrar</p>
        <p class="num mt-2 text-2xl font-bold">{{ formatMoney(data.receivable.total) }}</p>
        <p class="mt-1 text-xs text-ink-500">{{ data.receivable.count }} factura(s) con saldo</p>
      </RouterLink>
      <RouterLink to="/facturas?pendientes=1" :class="['card transition hover:border-brand-500', data.receivable.overdue && 'border-danger/40']">
        <p class="eyebrow flex items-center gap-1.5"><AlertTriangle v-if="data.receivable.overdue" class="size-3.5 text-danger" aria-hidden="true" />Vencidas</p>
        <p :class="['num mt-2 text-2xl font-bold', data.receivable.overdue && 'text-danger']">{{ data.receivable.overdue }}</p>
        <p class="mt-1 text-xs text-ink-500">Facturas pasadas de su vencimiento</p>
      </RouterLink>
      <RouterLink to="/productos?sinExistencia=1" :class="['card transition hover:border-brand-500', data.outOfStock && 'border-warning/40']">
        <p class="eyebrow flex items-center gap-1.5"><PackageX v-if="data.outOfStock" class="size-3.5 text-warning" aria-hidden="true" />Sin existencia</p>
        <p :class="['num mt-2 text-2xl font-bold', data.outOfStock && 'text-warning']">{{ data.outOfStock }}</p>
        <p class="mt-1 text-xs text-ink-500">Productos agotados</p>
      </RouterLink>
    </div>

    <h2 v-if="actions.length" class="mt-8 mb-3 text-base font-semibold">Accesos rápidos</h2>
    <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <RouterLink v-for="a in actions" :key="a.to" :to="a.to" class="card flex items-start gap-3 transition hover:border-brand-500 hover:shadow-lift">
        <span class="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700"><component :is="a.icon" class="size-5" aria-hidden="true" /></span>
        <span>
          <span class="block font-semibold">{{ a.label }}</span>
          <span class="text-sm text-ink-500">{{ a.hint }}</span>
        </span>
      </RouterLink>
    </div>
  </div>
</template>
