<script setup lang="ts">
import { Package, Pencil, Plus, Search, Tags } from 'lucide-vue-next';
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { listCategories } from '@/api/admin';
import { errorMessage } from '@/api/errors';
import { listProducts, listTaxRates } from '@/api/store';
import BaseButton from '@/components/BaseButton.vue';
import EmptyState from '@/components/EmptyState.vue';
import ErrorAlert from '@/components/ErrorAlert.vue';
import LoadingState from '@/components/LoadingState.vue';
import PageHeader from '@/components/PageHeader.vue';
import PaginationBar from '@/components/PaginationBar.vue';
import StatusBadge from '@/components/StatusBadge.vue';
import CategoriesModal from '@/components/store/CategoriesModal.vue';
import ProductFormModal from '@/components/store/ProductFormModal.vue';
import { useAuthStore } from '@/stores/auth';
import { useToastStore } from '@/stores/toast';
import type { PosCategory, StoreProduct, StoreTaxRate } from '@/types/api';
import { formatMoney, formatNumber } from '@/utils/format';
import { priceWithTax } from '@/utils/pricing';

const auth = useAuthStore();
const toast = useToastStore();
const route = useRoute();
const LIMIT = 50;

const canEdit = computed(() => auth.can('editarCatalogo'));
const q = ref('');
const categoryId = ref('');
const outOfStock = ref(route.query.sinExistencia === '1');
const showInactive = ref(false);
const rows = ref<StoreProduct[]>([]);
const total = ref(0);
const page = ref(1);
const categories = ref<PosCategory[]>([]);
const taxes = ref<StoreTaxRate[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);
const editing = ref<StoreProduct | null>(null);
const formOpen = ref(false);
const catsOpen = ref(false);

const categoryName = computed(() => new Map(categories.value.map((c) => [c.id, c])));

/** Precio con ITBIS para mostrar (mismo cálculo que la tarjeta de la caja). */
const shelfPrice = (p: StoreProduct) =>
  p.salePrice === null ? null : priceWithTax({ salePrice: p.salePrice, tax: p.saleTaxRate });

async function load(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    const r = await listProducts({
      q: q.value.trim(), categoryId: categoryId.value || undefined, outOfStock: outOfStock.value || undefined,
      active: showInactive.value ? undefined : true, page: page.value, limit: LIMIT,
    });
    rows.value = r.data;
    total.value = r.total;
  } catch (e) {
    error.value = errorMessage(e);
  } finally {
    loading.value = false;
  }
}

async function loadLookups(): Promise<void> {
  try {
    const [c, t] = await Promise.all([listCategories(), listTaxRates()]);
    categories.value = c;
    taxes.value = t;
  } catch (e) {
    error.value = errorMessage(e);
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
watch([categoryId, outOfStock, showInactive], () => {
  page.value = 1;
  void load();
});

function go(p: number): void {
  page.value = p;
  void load();
}

function edit(p: StoreProduct | null): void {
  editing.value = p;
  formOpen.value = true;
}

function saved(p: StoreProduct): void {
  formOpen.value = false;
  toast.success('Producto guardado', p.name);
  void load();
}

onMounted(() => {
  void load();
  void loadLookups();
});
</script>

<template>
  <div>
    <PageHeader title="Productos" :subtitle="canEdit ? 'Lo que vendes: precio, ITBIS, existencias y cómo aparece en la caja.' : 'Precios y existencias.'">
      <template #actions>
        <BaseButton v-if="canEdit" variant="secondary" :icon="Tags" @click="catsOpen = true">Categorías</BaseButton>
        <BaseButton v-if="canEdit" variant="accent" :icon="Plus" @click="edit(null)">Producto nuevo</BaseButton>
      </template>
    </PageHeader>

    <div class="mb-4 flex flex-wrap items-center gap-3">
      <div class="relative min-w-64 flex-1">
        <label for="prod-q" class="sr-only">Buscar</label>
        <Search class="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-400" aria-hidden="true" />
        <input id="prod-q" v-model="q" type="search" class="input pl-10" placeholder="Código, nombre o código de barras" />
      </div>
      <label for="prod-cat" class="sr-only">Categoría</label>
      <select id="prod-cat" v-model="categoryId" class="input w-48">
        <option value="">Todas las categorías</option>
        <option v-for="c in categories" :key="c.id" :value="c.id">{{ c.name }}</option>
      </select>
      <label class="flex items-center gap-2 text-sm"><input v-model="outOfStock" type="checkbox" class="size-4 accent-[var(--brand-600)]" /> Sin existencia</label>
      <label class="flex items-center gap-2 text-sm"><input v-model="showInactive" type="checkbox" class="size-4 accent-[var(--brand-600)]" /> Ver inactivos</label>
    </div>

    <LoadingState v-if="loading && !rows.length" variant="table" />
    <ErrorAlert v-else-if="error" :message="error" retry @retry="load" />
    <EmptyState v-else-if="!rows.length" :icon="Package" :text="q || categoryId || outOfStock ? 'No hay productos con ese filtro.' : 'Todavía no hay productos.'">
      <BaseButton v-if="canEdit && !q" variant="accent" :icon="Plus" @click="edit(null)">Crear el primero</BaseButton>
    </EmptyState>
    <template v-else>
      <section class="card overflow-x-auto p-0 sm:p-0">
        <table class="table-base">
          <thead>
            <tr>
              <th>Producto</th><th>Categoría</th><th class="text-right">Precio</th><th class="text-right">Con ITBIS</th><th class="text-right">Existencia</th>
              <th>Estado</th><th><span class="sr-only">Acciones</span></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="p in rows" :key="p.id" :class="canEdit && 'cursor-pointer'" @click="canEdit && edit(p)">
              <td>
                <p class="font-medium">{{ p.name }}</p>
                <p class="text-xs text-ink-500"><span class="font-mono">{{ p.code }}</span><span v-if="p.barcodes.length"> · {{ p.barcodes.length }} código(s) de barra</span></p>
              </td>
              <td>
                <span v-if="p.categoryId && categoryName.get(p.categoryId)" class="inline-flex items-center gap-1.5 text-sm">
                  <span class="size-2 rounded-full" :style="{ background: categoryName.get(p.categoryId)?.color || 'var(--ink-300)' }" aria-hidden="true" />{{ categoryName.get(p.categoryId)?.name }}
                </span>
                <span v-else class="text-ink-400">—</span>
              </td>
              <td class="num text-right">{{ p.salePrice === null ? 'Sin precio' : formatMoney(p.salePrice) }}</td>
              <td class="num text-right font-medium">{{ formatMoney(shelfPrice(p)) }}</td>
              <td :class="['num text-right', p.tracksInventory && Number(p.stockQty) <= 0 && 'font-semibold text-danger']">
                {{ p.tracksInventory ? `${formatNumber(p.stockQty)} ${p.unit}` : p.kind === 'SERVICE' ? 'Servicio' : 'No controla' }}
              </td>
              <td>
                <StatusBadge v-if="!p.active" tone="neutral">Inactivo</StatusBadge>
                <StatusBadge v-else-if="!p.showInPos" tone="warning">Fuera de la caja</StatusBadge>
                <StatusBadge v-else tone="success">En la caja</StatusBadge>
              </td>
              <td class="text-right" @click.stop>
                <BaseButton v-if="canEdit" size="sm" variant="ghost" :icon="Pencil" @click="edit(p)">Editar</BaseButton>
                <RouterLink v-else-if="p.tracksInventory && auth.can('inventario')" :to="`/inventario/${p.id}`" class="link text-sm">Kárdex</RouterLink>
              </td>
            </tr>
          </tbody>
        </table>
      </section>
      <PaginationBar :page="page" :limit="LIMIT" :total="total" :busy="loading" @go="go" />
    </template>

    <ProductFormModal :open="formOpen" :product="editing" :categories="categories" :taxes="taxes" @saved="saved" @close="formOpen = false" />
    <CategoriesModal :open="catsOpen" :categories="categories" @changed="loadLookups" @close="catsOpen = false" />
  </div>
</template>
