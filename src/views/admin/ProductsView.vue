<script setup lang="ts">
import { Plus, RotateCcw, Save, X } from 'lucide-vue-next';
import { computed, onMounted, ref } from 'vue';
import * as admin from '@/api/admin';
import { errorMessage } from '@/api/errors';
import BaseButton from '@/components/BaseButton.vue';
import EmptyState from '@/components/EmptyState.vue';
import ErrorAlert from '@/components/ErrorAlert.vue';
import LoadingState from '@/components/LoadingState.vue';
import PageHeader from '@/components/PageHeader.vue';
import { useToastStore } from '@/stores/toast';
import type { PosCategory, ProductSettingRow } from '@/types/api';
import { formatMoney } from '@/utils/format';

interface Row extends ProductSettingRow {
  codesText: string;
  dirty: boolean;
}

const toast = useToastStore();
const BARCODE = /^[A-Za-z0-9-]{1,40}$/;

const loading = ref(true);
const loadError = ref<string | null>(null);
const categories = ref<PosCategory[]>([]);
const rows = ref<Row[]>([]);
const q = ref('');
const saving = ref(false);
const newCat = ref('');
const newColor = ref('#0f9483');
const catBusy = ref(false);

const activeCategories = computed(() => categories.value.filter((c) => c.active));
const filtered = computed(() => {
  const text = q.value.trim().toLowerCase();
  return rows.value.filter((r) => !text || r.name.toLowerCase().includes(text) || r.code.toLowerCase().includes(text) || r.codesText.toLowerCase().includes(text));
});
const dirty = computed(() => rows.value.filter((r) => r.dirty));
const codesOf = (r: Row) => r.codesText.split(',').map((x) => x.trim()).filter(Boolean);
const badCodes = computed(() => dirty.value.find((r) => codesOf(r).some((c) => !BARCODE.test(c))) ?? null);

async function load(): Promise<void> {
  loading.value = true;
  loadError.value = null;
  try {
    const [cats, list] = await Promise.all([admin.listCategories(), admin.listProductSettings()]);
    categories.value = cats;
    rows.value = list.map((r) => ({ ...r, codesText: r.barcodes.join(', '), dirty: false }));
  } catch (e) {
    loadError.value = errorMessage(e);
  } finally {
    loading.value = false;
  }
}

function mark(r: Row): void {
  r.dirty = true;
}

async function addCategory(): Promise<void> {
  const name = newCat.value.trim();
  if (!name || catBusy.value) return;
  catBusy.value = true;
  try {
    await admin.createCategory({ name, color: newColor.value, sortOrder: categories.value.length });
    newCat.value = '';
    categories.value = await admin.listCategories();
  } catch (e) {
    toast.error('No se pudo crear la categoría', errorMessage(e));
  } finally {
    catBusy.value = false;
  }
}

async function toggleCategory(c: PosCategory): Promise<void> {
  try {
    await admin.updateCategory(c.id, { name: c.name, active: !c.active });
    categories.value = await admin.listCategories();
  } catch (e) {
    toast.error('No se pudo cambiar la categoría', errorMessage(e));
  }
}

async function save(): Promise<void> {
  if (!dirty.value.length || saving.value || badCodes.value) return;
  saving.value = true;
  try {
    const r = await admin.saveProductSettings(
      dirty.value.map((x) => ({ productId: x.id, categoryId: x.categoryId, showInPos: x.showInPos, barcodes: codesOf(x) })),
    );
    toast.success('Productos guardados', `${r.saved} producto(s) actualizados en la caja.`);
    await load();
  } catch (e) {
    toast.error('No se pudo guardar', errorMessage(e));
  } finally {
    saving.value = false;
  }
}

onMounted(load);
</script>

<template>
  <div>
    <PageHeader title="Productos en caja" subtitle="Los productos vienen del sistema financiero («Productos y servicios»). Aquí decides cuáles aparecen en la caja, en qué categoría y con qué códigos de barra.">
      <template #actions>
        <BaseButton variant="accent" :icon="Save" :loading="saving" :disabled="!dirty.length || !!badCodes" @click="save">
          Guardar cambios{{ dirty.length ? ` (${dirty.length})` : '' }}
        </BaseButton>
      </template>
    </PageHeader>

    <LoadingState v-if="loading" variant="table" />
    <ErrorAlert v-else-if="loadError" :message="loadError" retry @retry="load" />

    <div v-else class="space-y-6">
      <section class="card">
        <h2 class="card-title">Categorías de la caja</h2>
        <div class="mt-4 flex flex-wrap gap-2">
          <span
            v-for="c in categories"
            :key="c.id"
            :class="['inline-flex min-h-9 items-center gap-2 rounded-full border border-line py-1 pr-1.5 pl-3.5 text-sm font-medium', !c.active && 'opacity-50']"
          >
            <span class="size-2.5 rounded-full" :style="{ background: c.color || 'var(--ink-300)' }" aria-hidden="true" />{{ c.name }}
            <button
              type="button"
              class="rounded-full p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-900"
              :aria-label="c.active ? `Desactivar ${c.name}` : `Activar ${c.name}`"
              :title="c.active ? 'Desactivar' : 'Activar'"
              @click="toggleCategory(c)"
            >
              <component :is="c.active ? X : RotateCcw" class="size-3.5" />
            </button>
          </span>
          <span v-if="!categories.length" class="text-sm text-ink-500">Sin categorías: la caja muestra todo junto.</span>
        </div>
        <form class="mt-4 flex flex-wrap items-end gap-3" @submit.prevent="addCategory">
          <div class="min-w-48 flex-1">
            <label for="cat-name" class="label">Nueva categoría</label>
            <input id="cat-name" v-model="newCat" class="input" maxlength="60" placeholder="Bebidas, Lubricantes…" />
          </div>
          <div>
            <label for="cat-color" class="label">Color</label>
            <input id="cat-color" v-model="newColor" type="color" class="h-[46px] w-16 cursor-pointer rounded-lg border border-ink-200 bg-surface p-1" />
          </div>
          <BaseButton type="submit" variant="secondary" size="lg" :icon="Plus" :loading="catBusy" :disabled="!newCat.trim()">Agregar</BaseButton>
        </form>
      </section>

      <div>
        <label for="prod-q" class="label">Buscar</label>
        <input id="prod-q" v-model="q" class="input max-w-md" placeholder="Código, nombre o código de barras" />
      </div>
      <ErrorAlert :message="badCodes ? `Hay un código de barras inválido en ${badCodes.name}: solo letras, números y guiones, separados por comas.` : null" />

      <EmptyState v-if="!rows.length" text="No hay productos. Créalos en el sistema financiero («Productos y servicios») con su precio de venta." />
      <section v-else class="card overflow-x-auto p-0 sm:p-0">
        <table class="table-base">
          <thead>
            <tr><th>Producto</th><th class="text-right">Precio (sin ITBIS)</th><th>En caja</th><th>Categoría</th><th>Códigos de barra</th></tr>
          </thead>
          <tbody>
            <tr v-for="r in filtered" :key="r.id" :class="r.dirty && 'bg-brand-50/50'">
              <td>
                <p class="font-semibold">{{ r.name }}</p>
                <p class="font-mono text-xs text-ink-500">{{ r.code }}</p>
              </td>
              <td class="num text-right">
                <span v-if="r.salePrice !== null">{{ formatMoney(r.salePrice) }}</span>
                <span v-else class="text-danger">Sin precio</span>
              </td>
              <td>
                <label class="flex items-center gap-2">
                  <input v-model="r.showInPos" type="checkbox" class="size-4 accent-[var(--brand-600)]" :aria-label="`Mostrar ${r.name} en la caja`" @change="mark(r)" />
                  Sí
                </label>
              </td>
              <td>
                <select v-model="r.categoryId" class="input min-w-36 py-1.5 text-sm" :aria-label="`Categoría de ${r.name}`" @change="mark(r)">
                  <option :value="null">—</option>
                  <option v-for="c in activeCategories" :key="c.id" :value="c.id">{{ c.name }}</option>
                </select>
              </td>
              <td>
                <input v-model="r.codesText" class="input min-w-48 py-1.5 font-mono text-sm" placeholder="7501234567890, …" :aria-label="`Códigos de ${r.name}`" @input="mark(r)" />
              </td>
            </tr>
            <tr v-if="!filtered.length">
              <td colspan="5" class="py-8 text-center text-ink-500">No hay productos con «{{ q }}».</td>
            </tr>
          </tbody>
        </table>
      </section>
      <p class="hint">Un producto sin precio de venta no aparece en la caja. Separa varios códigos de barra con comas.</p>
    </div>
  </div>
</template>
