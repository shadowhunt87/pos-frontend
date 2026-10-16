<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { errorMessage } from '@/api/errors';
import { saveProduct } from '@/api/store';
import BaseButton from '@/components/BaseButton.vue';
import BaseModal from '@/components/BaseModal.vue';
import ErrorAlert from '@/components/ErrorAlert.vue';
import type { PosCategory, StoreProduct, StoreProductRequest, StoreTaxRate } from '@/types/api';
import { formatMoney, formatNumber } from '@/utils/format';

const props = defineProps<{ open: boolean; product: StoreProduct | null; categories: PosCategory[]; taxes: StoreTaxRate[] }>();
const emit = defineEmits<{ saved: [product: StoreProduct]; close: [] }>();

const CODE = /^[A-Za-z0-9._-]{1,40}$/;
const BARCODE = /^[A-Za-z0-9-]{1,40}$/;
const MONEY = /^\d+(\.\d{1,4})?$/;

const blank = () => ({
  code: '', name: '', description: '', kind: 'GOODS' as 'GOODS' | 'SERVICE', unit: 'UND', salePrice: '', purchasePrice: '',
  saleTaxRateId: '', purchaseTaxRateId: '', tracksInventory: true, active: true, categoryId: '', showInPos: true, barcodes: '',
});
const form = ref(blank());
const busy = ref(false);
const error = ref<string | null>(null);

const saleTaxes = computed(() => props.taxes.filter((t) => t.sales));
const purchaseTaxes = computed(() => props.taxes.filter((t) => t.purchases));
const activeCategories = computed(() => props.categories.filter((c) => c.active || c.id === form.value.categoryId));

watch(
  () => props.open,
  (open) => {
    if (!open) return;
    error.value = null;
    const p = props.product;
    if (!p) {
      form.value = blank();
      // ITBIS general por defecto en un producto nuevo
      const general = saleTaxes.value.find((t) => t.type === 'ITBIS' && Number(t.rate) === 18) ?? saleTaxes.value[0];
      const generalBuy = purchaseTaxes.value.find((t) => t.type === 'ITBIS' && Number(t.rate) === 18) ?? purchaseTaxes.value[0];
      form.value.saleTaxRateId = general?.id ?? '';
      form.value.purchaseTaxRateId = generalBuy?.id ?? '';
      return;
    }
    form.value = {
      code: p.code, name: p.name, description: p.description ?? '', kind: p.kind, unit: p.unit,
      salePrice: p.salePrice === null ? '' : String(Number(p.salePrice)), purchasePrice: p.purchasePrice === null ? '' : String(Number(p.purchasePrice)),
      saleTaxRateId: p.saleTaxRateId ?? '', purchaseTaxRateId: p.purchaseTaxRateId ?? '', tracksInventory: p.tracksInventory, active: p.active,
      categoryId: p.categoryId ?? '', showInPos: p.showInPos, barcodes: p.barcodes.join(', '),
    };
  },
);

watch(() => form.value.kind, (k) => {
  if (k === 'SERVICE') form.value.tracksInventory = false;
});

const codes = computed(() => form.value.barcodes.split(',').map((x) => x.trim()).filter(Boolean));

function validate(): string | null {
  const f = form.value;
  if (!CODE.test(f.code.trim())) return 'El código va sin espacios: letras, números, punto o guion (hasta 40).';
  if (!f.name.trim()) return 'Escribe el nombre.';
  if (!f.unit.trim()) return 'Escribe la unidad (UND, LB, GAL…).';
  if (f.salePrice.trim() && !MONEY.test(f.salePrice.trim())) return 'El precio de venta es un monto (hasta 4 decimales).';
  if (f.purchasePrice.trim() && !MONEY.test(f.purchasePrice.trim())) return 'El costo de referencia es un monto (hasta 4 decimales).';
  if (codes.value.some((c) => !BARCODE.test(c))) return 'Los códigos de barra van separados por comas: solo letras, números y guiones.';
  return null;
}

async function save(): Promise<void> {
  if (busy.value) return;
  const v = validate();
  if (v) {
    error.value = v;
    return;
  }
  const f = form.value;
  const body: StoreProductRequest = {
    code: f.code.trim(),
    name: f.name.trim(),
    description: f.description.trim() || null,
    kind: f.kind,
    unit: f.unit.trim().toUpperCase(),
    salePrice: f.salePrice.trim() ? Number(f.salePrice) : null,
    purchasePrice: f.purchasePrice.trim() ? Number(f.purchasePrice) : null,
    saleTaxRateId: f.saleTaxRateId || null,
    purchaseTaxRateId: f.purchaseTaxRateId || null,
    tracksInventory: f.kind === 'GOODS' && f.tracksInventory,
    categoryId: f.categoryId || null,
    showInPos: f.showInPos,
    barcodes: codes.value,
    ...(props.product ? { active: f.active } : {}),
  };
  busy.value = true;
  error.value = null;
  try {
    emit('saved', await saveProduct(props.product?.id ?? null, body));
  } catch (e) {
    error.value = errorMessage(e);
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <BaseModal :open="open" :title="product ? `Editar ${product.name}` : 'Producto nuevo'" size="xl" @close="emit('close')">
    <form id="product-form" class="grid gap-4 sm:grid-cols-4" novalidate @submit.prevent="save">
      <div>
        <label for="prd-code" class="label">Código</label>
        <input id="prd-code" v-model="form.code" class="input font-mono" maxlength="40" placeholder="ARROZ-5" />
      </div>
      <div class="sm:col-span-3">
        <label for="prd-name" class="label">Nombre</label>
        <input id="prd-name" v-model="form.name" class="input" maxlength="200" />
      </div>
      <div>
        <label for="prd-kind" class="label">Tipo</label>
        <select id="prd-kind" v-model="form.kind" class="input">
          <option value="GOODS">Producto (mercancía)</option>
          <option value="SERVICE">Servicio</option>
        </select>
      </div>
      <div>
        <label for="prd-unit" class="label">Unidad</label>
        <input id="prd-unit" v-model="form.unit" class="input uppercase" maxlength="20" placeholder="UND" />
      </div>
      <div>
        <label for="prd-price" class="label">Precio de venta (sin ITBIS)</label>
        <input id="prd-price" v-model="form.salePrice" class="input num" inputmode="decimal" />
      </div>
      <div>
        <label for="prd-stax" class="label">ITBIS de venta</label>
        <select id="prd-stax" v-model="form.saleTaxRateId" class="input">
          <option value="">Exento</option>
          <option v-for="t in saleTaxes" :key="t.id" :value="t.id">{{ t.name }} ({{ Number(t.rate) }} %)</option>
        </select>
      </div>
      <div>
        <label for="prd-cost" class="label">Costo de referencia (opcional)</label>
        <input id="prd-cost" v-model="form.purchasePrice" class="input num" inputmode="decimal" />
      </div>
      <div>
        <label for="prd-ptax" class="label">ITBIS de compra</label>
        <select id="prd-ptax" v-model="form.purchaseTaxRateId" class="input">
          <option value="">Exento</option>
          <option v-for="t in purchaseTaxes" :key="t.id" :value="t.id">{{ t.name }} ({{ Number(t.rate) }} %)</option>
        </select>
      </div>
      <div class="sm:col-span-2">
        <label for="prd-cat" class="label">Categoría en la caja</label>
        <select id="prd-cat" v-model="form.categoryId" class="input">
          <option value="">Sin categoría</option>
          <option v-for="c in activeCategories" :key="c.id" :value="c.id">{{ c.name }}</option>
        </select>
      </div>
      <div class="sm:col-span-4">
        <label for="prd-codes" class="label">Códigos de barra (separados por comas)</label>
        <input id="prd-codes" v-model="form.barcodes" class="input font-mono" placeholder="7501234567890, …" />
      </div>
      <div class="sm:col-span-4">
        <label for="prd-desc" class="label">Descripción (opcional)</label>
        <input id="prd-desc" v-model="form.description" class="input" maxlength="1000" />
      </div>
      <div class="flex flex-wrap gap-x-6 gap-y-2 text-sm sm:col-span-4">
        <label class="flex items-center gap-2" :class="form.kind === 'SERVICE' && 'opacity-50'">
          <input v-model="form.tracksInventory" type="checkbox" class="size-4 accent-[var(--brand-600)]" :disabled="form.kind === 'SERVICE'" />
          Controla existencias (inventario con costo promedio)
        </label>
        <label class="flex items-center gap-2"><input v-model="form.showInPos" type="checkbox" class="size-4 accent-[var(--brand-600)]" /> Aparece en la caja</label>
        <label v-if="product" class="flex items-center gap-2"><input v-model="form.active" type="checkbox" class="size-4 accent-[var(--brand-600)]" /> Activo</label>
      </div>
      <p v-if="product?.tracksInventory" class="rounded-xl bg-surface-2 px-4 py-3 text-sm text-ink-600 sm:col-span-4">
        Existencia: <strong>{{ formatNumber(product.stockQty) }} {{ product.unit }}</strong> · costo promedio {{ formatMoney(product.avgCost) }}. La existencia
        cambia con compras, ventas y ajustes, no desde aquí.
      </p>
      <div class="sm:col-span-4"><ErrorAlert :message="error" /></div>
    </form>
    <template #footer>
      <BaseButton variant="secondary" @click="emit('close')">Cancelar</BaseButton>
      <BaseButton type="submit" form="product-form" variant="accent" :loading="busy">Guardar</BaseButton>
    </template>
  </BaseModal>
</template>
