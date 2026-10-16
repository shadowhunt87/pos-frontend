<script setup lang="ts">
import Decimal from 'decimal.js';
import { Trash2, Truck } from 'lucide-vue-next';
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { errorMessage } from '@/api/errors';
import { createPurchase, listTaxRates } from '@/api/store';
import BaseButton from '@/components/BaseButton.vue';
import ErrorAlert from '@/components/ErrorAlert.vue';
import PageHeader from '@/components/PageHeader.vue';
import PartnerPicker from '@/components/PartnerPicker.vue';
import ProductPicker from '@/components/ProductPicker.vue';
import PartnerFormModal from '@/components/store/PartnerFormModal.vue';
import { useToastStore } from '@/stores/toast';
import type { PartnerDetail, PartnerRow, StoreProduct, StoreTaxRate } from '@/types/api';
import { formatMoney, formatNumber, todayInput } from '@/utils/format';
import { r2 } from '@/utils/pricing';
import { newClientUuid } from '@/utils/uuid';

interface Line {
  product: StoreProduct;
  quantity: string;
  unitCost: string;
  taxRateId: string;
}

const router = useRouter();
const toast = useToastStore();

const supplier = ref<PartnerRow | null>(null);
const issueDate = ref(todayInput());
const informal = ref(false);
const ncf = ref('');
const notes = ref('');
const lines = ref<Line[]>([]);
const taxes = ref<StoreTaxRate[]>([]);
const busy = ref(false);
const error = ref<string | null>(null);
const newSupplier = ref(false);
let clientUuid = newClientUuid();

const QTY = /^\d+(\.\d{1,4})?$/;
const purchaseTaxes = computed(() => taxes.value.filter((t) => t.purchases));
const rateOf = (id: string) => purchaseTaxes.value.find((t) => t.id === id)?.rate ?? '0';

/** Estimado para revisar contra la factura del proveedor; el total exacto lo calcula el sistema contable. */
const preview = computed(() =>
  lines.value.map((l) => {
    const net = QTY.test(l.quantity.trim()) && QTY.test(l.unitCost.trim()) ? r2(new Decimal(l.quantity).times(l.unitCost)) : new Decimal(0);
    return { net, tax: r2(net.times(rateOf(l.taxRateId)).div(100)) };
  }),
);
const totals = computed(() => {
  const net = preview.value.reduce((a, x) => a.plus(x.net), new Decimal(0));
  const tax = preview.value.reduce((a, x) => a.plus(x.tax), new Decimal(0));
  return { net, tax, total: net.plus(tax) };
});

const formError = computed(() => {
  if (!informal.value && ncf.value.trim() && !/^[BE]\d{10,11}$/.test(ncf.value.trim().toUpperCase())) return 'El NCF es una letra B o E seguida de 10 u 11 números (B0100000123).';
  for (const l of lines.value) {
    if (!QTY.test(l.quantity.trim()) || Number(l.quantity) <= 0) return `Escribe la cantidad de ${l.product.name}.`;
    if (!QTY.test(l.unitCost.trim())) return `Escribe el costo de ${l.product.name} (sin ITBIS).`;
  }
  return null;
});
const canSave = computed(() => !!supplier.value && lines.value.length > 0 && !formError.value && (informal.value || !!ncf.value.trim()) && !busy.value);

function add(p: StoreProduct): void {
  if (lines.value.some((l) => l.product.id === p.id)) return;
  const cost = p.purchasePrice ? String(Number(p.purchasePrice)) : Number(p.avgCost) > 0 ? String(Number(p.avgCost)) : '';
  lines.value.push({ product: p, quantity: '1', unitCost: cost, taxRateId: p.purchaseTaxRateId ?? '' });
  if (!p.tracksInventory) toast.info(`${p.name} no controla existencias`, 'Se registra la compra, pero no entra al inventario.');
}

function onSupplierCreated(p: PartnerDetail): void {
  newSupplier.value = false;
  supplier.value = { ...p };
}

async function save(): Promise<void> {
  if (!canSave.value || !supplier.value) return;
  busy.value = true;
  error.value = null;
  try {
    const inv = await createPurchase({
      clientUuid,
      supplierId: supplier.value.id,
      issueDate: issueDate.value,
      ...(informal.value ? { ncfType: 'B11' } : { ncf: ncf.value.trim().toUpperCase() }),
      ...(notes.value.trim() ? { notes: notes.value.trim() } : {}),
      lines: lines.value.map((l) => ({ productId: l.product.id, quantity: Number(l.quantity), unitCost: Number(l.unitCost), taxRateId: l.taxRateId || null })),
    });
    toast.success(`Compra ${inv.number} registrada`, 'La mercancía ya está en el inventario.');
    clientUuid = newClientUuid();
    await router.replace(`/compras/${inv.id}`);
  } catch (e) {
    error.value = errorMessage(e);
  } finally {
    busy.value = false;
  }
}

onMounted(async () => {
  try {
    taxes.value = await listTaxRates();
  } catch (e) {
    error.value = errorMessage(e);
  }
});
</script>

<template>
  <div>
    <PageHeader title="Registrar compra" subtitle="Copia la factura del proveedor. Al guardar, la mercancía entra al inventario a ese costo." :back="{ to: '/compras', label: 'Compras' }" />

    <div class="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
      <div class="min-w-0 space-y-6">
        <section class="card">
          <div class="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
            <PartnerPicker v-model="supplier" kind="suppliers" label="Proveedor" />
            <BaseButton variant="secondary" size="lg" :icon="Truck" @click="newSupplier = true">Proveedor nuevo</BaseButton>
          </div>
          <div class="mt-4 grid gap-4 sm:grid-cols-3">
            <div>
              <label for="pur-date" class="label">Fecha de la factura</label>
              <input id="pur-date" v-model="issueDate" type="date" class="input" :max="todayInput()" />
            </div>
            <div class="sm:col-span-2">
              <label for="pur-ncf" class="label">NCF del proveedor</label>
              <input id="pur-ncf" v-model="ncf" class="input font-mono uppercase" :disabled="informal" placeholder="B0100000123" maxlength="13" />
              <label class="mt-2 flex items-center gap-2 text-sm">
                <input v-model="informal" type="checkbox" class="size-4 accent-[var(--brand-600)]" />
                Proveedor informal: no trae NCF y el comprobante (B11) lo emites tú
              </label>
            </div>
          </div>
        </section>

        <section class="card">
          <ProductPicker label="Agregar producto" show-cost @pick="add" />
          <div v-if="lines.length" class="mt-4 overflow-x-auto">
            <table class="table-base [&_td]:px-2 [&_th]:px-2">
              <thead><tr><th>Producto</th><th class="text-right">Cantidad</th><th class="text-right">Costo (sin ITBIS)</th><th>ITBIS</th><th class="text-right">Importe</th><th><span class="sr-only">Quitar</span></th></tr></thead>
              <tbody>
                <tr v-for="(l, i) in lines" :key="l.product.id">
                  <td class="min-w-40">
                    <p class="font-medium">{{ l.product.name }}</p>
                    <p class="text-xs text-ink-500">Hay {{ formatNumber(l.product.stockQty) }} {{ l.product.unit }} · promedio {{ formatMoney(l.product.avgCost) }}</p>
                  </td>
                  <td class="text-right"><input v-model="l.quantity" class="input num ml-auto w-20 px-2 py-1.5 text-right" inputmode="decimal" :aria-label="`Cantidad de ${l.product.name}`" /></td>
                  <td class="text-right"><input v-model="l.unitCost" class="input num ml-auto w-24 px-2 py-1.5 text-right" inputmode="decimal" :aria-label="`Costo de ${l.product.name}`" /></td>
                  <td>
                    <select v-model="l.taxRateId" class="input w-32 py-1.5 text-sm" :aria-label="`ITBIS de ${l.product.name}`">
                      <option value="">Exento</option>
                      <option v-for="t in purchaseTaxes" :key="t.id" :value="t.id">{{ t.name }}</option>
                    </select>
                  </td>
                  <td class="num text-right font-medium">{{ formatMoney(preview[i]?.net.toFixed(2)) }}</td>
                  <td class="text-right">
                    <button type="button" class="rounded-md p-1.5 text-ink-400 hover:bg-danger-soft hover:text-danger" :aria-label="`Quitar ${l.product.name}`" @click="lines.splice(i, 1)"><Trash2 class="size-4" /></button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p v-else class="mt-4 text-sm text-ink-500">Agrega los productos de la factura del proveedor.</p>
        </section>

        <section class="card">
          <label for="pur-notes" class="label">Nota (opcional)</label>
          <textarea id="pur-notes" v-model="notes" class="input" rows="2" maxlength="1000" />
        </section>
      </div>

      <aside class="min-w-0 space-y-4 xl:sticky xl:top-6 xl:self-start">
        <section class="card space-y-2 text-sm">
          <div class="flex justify-between text-ink-500"><span>Subtotal</span><span class="num">{{ formatMoney(totals.net.toFixed(2)) }}</span></div>
          <div class="flex justify-between text-ink-500"><span>ITBIS</span><span class="num">{{ formatMoney(totals.tax.toFixed(2)) }}</span></div>
          <div class="flex items-baseline justify-between border-t border-line pt-3">
            <span class="text-base font-semibold">Total estimado</span>
            <strong class="num text-2xl">{{ formatMoney(totals.total.toFixed(2)) }}</strong>
          </div>
          <p class="hint">Compáralo con la factura del proveedor antes de guardar.</p>
        </section>
        <ErrorAlert :message="error ?? formError" />
        <BaseButton variant="accent" size="lg" block :loading="busy" :disabled="!canSave" @click="save">Registrar compra</BaseButton>
      </aside>
    </div>

    <PartnerFormModal :open="newSupplier" kind="suppliers" :partner="null" @saved="onSupplierCreated" @close="newSupplier = false" />
  </div>
</template>
