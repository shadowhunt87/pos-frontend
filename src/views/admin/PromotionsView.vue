<script setup lang="ts">
import { Pencil, Plus, Tag } from 'lucide-vue-next';
import { computed, onMounted, ref } from 'vue';
import * as admin from '@/api/admin';
import { errorMessage } from '@/api/errors';
import BaseButton from '@/components/BaseButton.vue';
import BaseModal from '@/components/BaseModal.vue';
import EmptyState from '@/components/EmptyState.vue';
import ErrorAlert from '@/components/ErrorAlert.vue';
import LoadingState from '@/components/LoadingState.vue';
import PageHeader from '@/components/PageHeader.vue';
import StatusBadge from '@/components/StatusBadge.vue';
import { useToastStore } from '@/stores/toast';
import type { PosCategory, PosPromotion, ProductSettingRow, PromotionRequest, PromotionType } from '@/types/api';
import { dayBoundaryIso, formatDate, formatMoney, isoToDateInput } from '@/utils/format';
import { PROMOTION_LABEL, WEEKDAYS } from '@/utils/labels';

interface Form {
  name: string;
  type: PromotionType;
  value: string;
  buyQty: string;
  payQty: string;
  productIds: string[];
  categoryIds: string[];
  startsAt: string;
  endsAt: string;
  timeFrom: string;
  timeTo: string;
  weekdays: number[];
  priority: string;
  active: boolean;
}

const toast = useToastStore();

const loading = ref(true);
const loadError = ref<string | null>(null);
const rows = ref<PosPromotion[]>([]);
const products = ref<ProductSettingRow[]>([]);
const categories = ref<PosCategory[]>([]);
const editingId = ref<string | null>(null);
const form = ref<Form | null>(null);
const productFilter = ref('');
const saving = ref(false);
const formError = ref<string | null>(null);

const productName = computed(() => new Map(products.value.map((p) => [p.id, p.name])));
const categoryName = computed(() => new Map(categories.value.map((c) => [c.id, c.name])));
const productOptions = computed(() => {
  const t = productFilter.value.trim().toLowerCase();
  return products.value.filter((p) => !t || p.name.toLowerCase().includes(t) || p.code.toLowerCase().includes(t)).slice(0, 200);
});

function describe(p: PosPromotion): string {
  if (p.type === 'PERCENT') return `${Number(p.value)} % de descuento`;
  if (p.type === 'BUY_X_PAY_Y') return `Lleva ${p.buyQty}, paga ${p.payQty}`;
  return `Precio especial ${formatMoney(p.value)}`;
}

function appliesTo(p: PosPromotion): string {
  if (!p.productIds.length && !p.categoryIds.length) return 'Todos los productos';
  const parts = [
    ...p.categoryIds.map((id) => categoryName.value.get(id) ?? 'Categoría'),
    ...p.productIds.slice(0, 3).map((id) => productName.value.get(id) ?? 'Producto'),
  ];
  const more = p.productIds.length > 3 ? ` y ${p.productIds.length - 3} más` : '';
  return parts.join(', ') + more;
}

function when(p: PosPromotion): string {
  const parts: string[] = [];
  if (p.startsAt || p.endsAt) parts.push(`${p.startsAt ? formatDate(p.startsAt) : '…'} – ${p.endsAt ? formatDate(p.endsAt) : '…'}`);
  if (p.weekdays.length) parts.push(p.weekdays.map((d) => WEEKDAYS[d]).join(', '));
  if (p.timeFrom && p.timeTo) parts.push(`${p.timeFrom}–${p.timeTo}`);
  return parts.join(' · ') || 'Siempre';
}

async function load(): Promise<void> {
  loading.value = true;
  loadError.value = null;
  try {
    const [p, prods, cats] = await Promise.all([admin.listPromotions(), admin.listProductSettings(), admin.listCategories()]);
    rows.value = p;
    products.value = prods;
    categories.value = cats;
  } catch (e) {
    loadError.value = errorMessage(e);
  } finally {
    loading.value = false;
  }
}

function edit(p: PosPromotion | null): void {
  formError.value = null;
  productFilter.value = '';
  editingId.value = p?.id ?? null;
  form.value = p
    ? {
        name: p.name,
        type: p.type,
        value: p.value === null ? '' : String(Number(p.value)),
        buyQty: String(p.buyQty ?? 2),
        payQty: String(p.payQty ?? 1),
        productIds: [...p.productIds],
        categoryIds: [...p.categoryIds],
        startsAt: p.startsAt ? isoToDateInput(p.startsAt) : '',
        endsAt: p.endsAt ? isoToDateInput(p.endsAt) : '',
        timeFrom: p.timeFrom ?? '',
        timeTo: p.timeTo ?? '',
        weekdays: [...p.weekdays],
        priority: String(p.priority),
        active: p.active,
      }
    : { name: '', type: 'PERCENT', value: '10', buyQty: '2', payQty: '1', productIds: [], categoryIds: [], startsAt: '', endsAt: '', timeFrom: '', timeTo: '', weekdays: [], priority: '0', active: true };
}

function toggle(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

function toggleDay(i: number): void {
  if (!form.value) return;
  const d = form.value.weekdays;
  form.value.weekdays = d.includes(i) ? d.filter((x) => x !== i) : [...d, i].sort((a, b) => a - b);
}

/** Valida en el front como ayuda; el backend tiene la última palabra. */
function build(f: Form): PromotionRequest | string {
  if (!f.name.trim()) return 'Ponle un nombre a la promoción.';
  const body: PromotionRequest = {
    name: f.name.trim(),
    type: f.type,
    productIds: f.productIds,
    categoryIds: f.categoryIds,
    weekdays: f.weekdays,
    active: f.active,
    priority: Number(f.priority) || 0,
    startsAt: f.startsAt ? dayBoundaryIso(f.startsAt) : null,
    // «Hasta» incluye todo ese día, hasta las 23:59 de Santo Domingo
    endsAt: f.endsAt ? dayBoundaryIso(f.endsAt, true) : null,
    timeFrom: f.timeFrom || null,
    timeTo: f.timeTo || null,
  };
  if (f.type === 'BUY_X_PAY_Y') {
    const buy = Number(f.buyQty);
    const pay = Number(f.payQty);
    if (!Number.isInteger(buy) || buy < 2 || !Number.isInteger(pay) || pay < 0 || pay >= buy) return 'En «lleva X, paga Y», Y debe ser menor que X (por ejemplo, lleva 2 y paga 1).';
    body.buyQty = buy;
    body.payQty = pay;
  } else {
    const v = Number(f.value);
    if (!/^\d+(\.\d{1,4})?$/.test(f.value.trim())) return 'Escribe el valor de la promoción.';
    if (f.type === 'PERCENT' && v > 100) return 'El porcentaje no puede pasar de 100.';
    body.value = v;
  }
  if (f.startsAt && f.endsAt && f.endsAt < f.startsAt) return 'La promoción termina antes de empezar.';
  if (!!f.timeFrom !== !!f.timeTo) return 'Pon las dos horas (desde y hasta) o ninguna.';
  return body;
}

async function save(): Promise<void> {
  const f = form.value;
  if (!f || saving.value) return;
  const body = build(f);
  if (typeof body === 'string') {
    formError.value = body;
    return;
  }
  saving.value = true;
  formError.value = null;
  try {
    await admin.savePromotion(editingId.value, body);
    toast.success('Promoción guardada');
    form.value = null;
    rows.value = await admin.listPromotions();
  } catch (e) {
    formError.value = errorMessage(e);
  } finally {
    saving.value = false;
  }
}

onMounted(load);
</script>

<template>
  <div>
    <PageHeader title="Promociones" subtitle="Se aplican solas en la caja. Por producto se usa la que más descuenta. No piden PIN.">
      <template #actions>
        <BaseButton variant="accent" :icon="Plus" @click="edit(null)">Nueva promoción</BaseButton>
      </template>
    </PageHeader>

    <LoadingState v-if="loading" variant="table" />
    <ErrorAlert v-else-if="loadError" :message="loadError" retry @retry="load" />
    <EmptyState v-else-if="!rows.length" :icon="Tag" title="Sin promociones" text="Crea un % de descuento, un 2x1 o un precio especial, por producto o categoría, con fechas, días y horario." />
    <section v-else class="card overflow-x-auto p-0 sm:p-0">
      <table class="table-base">
        <thead>
          <tr><th>Nombre</th><th>Tipo</th><th>Aplica a</th><th>Cuándo</th><th>Estado</th><th><span class="sr-only">Acciones</span></th></tr>
        </thead>
        <tbody>
          <tr v-for="p in rows" :key="p.id">
            <td class="font-semibold">{{ p.name }}</td>
            <td>{{ describe(p) }}</td>
            <td class="max-w-64 text-ink-600">{{ appliesTo(p) }}</td>
            <td class="text-ink-600">{{ when(p) }}</td>
            <td><StatusBadge :tone="p.active ? 'success' : 'neutral'">{{ p.active ? 'Activa' : 'Inactiva' }}</StatusBadge></td>
            <td class="text-right"><BaseButton size="sm" variant="ghost" :icon="Pencil" @click="edit(p)">Editar</BaseButton></td>
          </tr>
        </tbody>
      </table>
    </section>

    <BaseModal :open="!!form" :title="editingId ? 'Editar promoción' : 'Nueva promoción'" size="xl" @close="form = null">
      <form v-if="form" id="promo-form" class="grid gap-4 sm:grid-cols-4" novalidate @submit.prevent="save">
        <div class="sm:col-span-2">
          <label for="promo-name" class="label">Nombre</label>
          <input id="promo-name" v-model="form.name" class="input" maxlength="100" placeholder="2x1 en filtros" />
        </div>
        <div class="sm:col-span-2">
          <label for="promo-type" class="label">Tipo</label>
          <select id="promo-type" v-model="form.type" class="input">
            <option v-for="(label, key) in PROMOTION_LABEL" :key="key" :value="key">{{ label }}</option>
          </select>
        </div>
        <template v-if="form.type === 'BUY_X_PAY_Y'">
          <div>
            <label for="promo-buy" class="label">Lleva</label>
            <input id="promo-buy" v-model="form.buyQty" class="input num" inputmode="numeric" />
          </div>
          <div>
            <label for="promo-pay" class="label">Paga</label>
            <input id="promo-pay" v-model="form.payQty" class="input num" inputmode="numeric" />
          </div>
        </template>
        <div v-else class="sm:col-span-2">
          <label for="promo-value" class="label">{{ form.type === 'PERCENT' ? 'Descuento (%)' : 'Precio especial (sin ITBIS)' }}</label>
          <input id="promo-value" v-model="form.value" class="input num" inputmode="decimal" />
        </div>
        <div class="sm:col-span-2">
          <label for="promo-priority" class="label">Prioridad (desempate)</label>
          <input id="promo-priority" v-model="form.priority" class="input num" inputmode="numeric" />
        </div>

        <fieldset class="sm:col-span-4">
          <legend class="label">Categorías (ninguna y ningún producto = todo)</legend>
          <div class="flex flex-wrap gap-2">
            <label
              v-for="c in categories.filter((x) => x.active)"
              :key="c.id"
              :class="['inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-sm', form.categoryIds.includes(c.id) ? 'border-brand-500 bg-brand-50' : 'border-line']"
            >
              <input type="checkbox" class="sr-only" :checked="form.categoryIds.includes(c.id)" @change="form.categoryIds = toggle(form.categoryIds, c.id)" />
              <span class="size-2.5 rounded-full" :style="{ background: c.color || 'var(--ink-300)' }" aria-hidden="true" />{{ c.name }}
            </label>
            <span v-if="!categories.length" class="text-sm text-ink-500">No hay categorías de caja.</span>
          </div>
        </fieldset>

        <fieldset class="sm:col-span-4">
          <legend class="label">Productos ({{ form.productIds.length }} elegidos)</legend>
          <input v-model="productFilter" class="input mb-2" placeholder="Filtrar productos" aria-label="Filtrar productos" />
          <div class="max-h-48 overflow-y-auto rounded-xl border border-line">
            <label v-for="p in productOptions" :key="p.id" class="flex cursor-pointer items-center gap-3 border-b border-line px-3 py-2 text-sm last:border-b-0 hover:bg-ink-50">
              <input type="checkbox" class="size-4 accent-[var(--brand-600)]" :checked="form.productIds.includes(p.id)" @change="form.productIds = toggle(form.productIds, p.id)" />
              <span class="font-mono text-xs text-ink-500">{{ p.code }}</span>{{ p.name }}
            </label>
          </div>
        </fieldset>

        <div>
          <label for="promo-from" class="label">Desde</label>
          <input id="promo-from" v-model="form.startsAt" type="date" class="input" />
        </div>
        <div>
          <label for="promo-to" class="label">Hasta</label>
          <input id="promo-to" v-model="form.endsAt" type="date" class="input" />
        </div>
        <div>
          <label for="promo-h1" class="label">Hora desde</label>
          <input id="promo-h1" v-model="form.timeFrom" type="time" class="input" />
        </div>
        <div>
          <label for="promo-h2" class="label">Hora hasta</label>
          <input id="promo-h2" v-model="form.timeTo" type="time" class="input" />
        </div>

        <fieldset class="sm:col-span-4">
          <legend class="label">Días (ninguno = todos)</legend>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="(d, i) in WEEKDAYS"
              :key="d"
              type="button"
              :aria-pressed="form.weekdays.includes(i)"
              :class="['min-h-9 min-w-12 rounded-lg border px-3 text-sm font-semibold', form.weekdays.includes(i) ? 'border-brand-500 bg-brand-50 text-brand-800' : 'border-line text-ink-600']"
              @click="toggleDay(i)"
            >
              {{ d }}
            </button>
          </div>
        </fieldset>
        <label class="flex items-center gap-2 text-sm sm:col-span-4">
          <input v-model="form.active" type="checkbox" class="size-4 accent-[var(--brand-600)]" /> Activa
        </label>
        <div class="sm:col-span-4"><ErrorAlert :message="formError" /></div>
      </form>
      <template #footer>
        <BaseButton variant="secondary" @click="form = null">Cancelar</BaseButton>
        <BaseButton type="submit" form="promo-form" variant="accent" :loading="saving">Guardar</BaseButton>
      </template>
    </BaseModal>
  </div>
</template>
