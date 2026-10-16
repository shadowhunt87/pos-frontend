<script setup lang="ts">
import Decimal from 'decimal.js';
import { Trash2, UserPlus } from 'lucide-vue-next';
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { errorMessage } from '@/api/errors';
import { createInvoice, getPartner } from '@/api/store';
import BaseButton from '@/components/BaseButton.vue';
import ErrorAlert from '@/components/ErrorAlert.vue';
import PageHeader from '@/components/PageHeader.vue';
import PartnerPicker from '@/components/PartnerPicker.vue';
import ProductPicker from '@/components/ProductPicker.vue';
import ApprovalModal from '@/components/caja/ApprovalModal.vue';
import PartnerFormModal from '@/components/store/PartnerFormModal.vue';
import { useApproval } from '@/composables/useApproval';
import { useToastStore } from '@/stores/toast';
import type { PartnerDetail, PartnerRow, StoreProduct } from '@/types/api';
import { formatMoney, formatNumber, todayInput } from '@/utils/format';
import { r2 } from '@/utils/pricing';
import { newClientUuid } from '@/utils/uuid';

interface Line {
  product: StoreProduct;
  quantity: string;
  discount: string;
}

const route = useRoute();
const router = useRouter();
const toast = useToastStore();
const approval = useApproval();

const customer = ref<PartnerRow | null>(null);
const ncfType = ref('');
const dueDate = ref('');
const notes = ref('');
const lines = ref<Line[]>([]);
const busy = ref(false);
const error = ref<string | null>(null);
const newCustomer = ref(false);
// El mismo id en los reintentos: el servidor no factura dos veces
let clientUuid = newClientUuid();

const QTY = /^\d+(\.\d{1,4})?$/;
const MONEY = /^\d+(\.\d{1,2})?$/;

/** Estimado para mostrar (precio sin ITBIS, descuento e ITBIS por línea). El total exacto lo calcula la factura. */
const preview = computed(() =>
  lines.value.map((l) => {
    const qty = QTY.test(l.quantity.trim()) ? new Decimal(l.quantity) : new Decimal(0);
    const gross = r2(qty.times(l.product.salePrice ?? 0));
    const disc = MONEY.test(l.discount.trim()) ? new Decimal(l.discount) : new Decimal(0);
    const net = Decimal.max(0, r2(gross.minus(disc)));
    const tax = l.product.saleTaxRate ? r2(net.times(l.product.saleTaxRate.rate).div(100)) : new Decimal(0);
    return { gross, net, tax };
  }),
);
const totals = computed(() => {
  const sum = (f: (x: { net: Decimal; tax: Decimal }) => Decimal) => preview.value.reduce((a, x) => a.plus(f(x)), new Decimal(0));
  const net = sum((x) => x.net);
  const tax = sum((x) => x.tax);
  return { net, tax, total: net.plus(tax) };
});

const lineErrors = computed(() => {
  for (const [i, l] of lines.value.entries()) {
    if (!QTY.test(l.quantity.trim()) || Number(l.quantity) <= 0) return `Revisa la cantidad de ${l.product.name}.`;
    if (l.discount.trim() && !MONEY.test(l.discount.trim())) return `El descuento de ${l.product.name} es un monto con hasta 2 decimales.`;
    if (preview.value[i] && new Decimal(l.discount || 0).gt(preview.value[i]!.gross)) return `El descuento de ${l.product.name} es mayor que su importe.`;
    if (l.product.salePrice === null) return `${l.product.name} no tiene precio de venta.`;
  }
  return null;
});
const canSave = computed(() => !!customer.value && lines.value.length > 0 && !lineErrors.value && !busy.value);

watch(customer, (c) => {
  ncfType.value = c?.defaultNcfType ?? '';
  dueDate.value = '';
});

function addProduct(p: StoreProduct): void {
  const found = lines.value.find((l) => l.product.id === p.id);
  if (found) found.quantity = String(Number(found.quantity || 0) + 1);
  else lines.value.push({ product: p, quantity: '1', discount: '' });
  if (p.tracksInventory && Number(p.stockQty) <= 0) toast.info(`${p.name} no tiene existencia`, 'El sistema no deja facturar sin existencia.');
}

function removeLine(i: number): void {
  lines.value.splice(i, 1);
}

function onCustomerCreated(p: PartnerDetail): void {
  newCustomer.value = false;
  customer.value = { ...p };
}

async function save(): Promise<void> {
  if (!canSave.value || !customer.value) return;
  busy.value = true;
  error.value = null;
  const body = {
    clientUuid,
    partnerId: customer.value.id,
    ...(ncfType.value ? { ncfType: ncfType.value } : {}),
    ...(dueDate.value ? { dueDate: dueDate.value } : {}),
    ...(notes.value.trim() ? { notes: notes.value.trim() } : {}),
    lines: lines.value.map((l) => ({ productId: l.product.id, quantity: Number(l.quantity), ...(Number(l.discount) > 0 ? { discount: Number(l.discount) } : {}) })),
  };
  try {
    const inv = await approval.run((approvalId) => createInvoice({ ...body, ...(approvalId ? { approvalId } : {}) }));
    if (inv) {
      toast.success(`Factura ${inv.number} emitida`, inv.ncf ? `NCF ${inv.ncf}` : undefined);
      clientUuid = newClientUuid();
      await router.replace(`/facturas/${inv.id}`);
    }
  } catch (e) {
    error.value = errorMessage(e);
  } finally {
    busy.value = false;
  }
}

onMounted(async () => {
  // Desde la ficha de un cliente: /facturas/nueva?cliente=<id>
  const id = typeof route.query.cliente === 'string' ? route.query.cliente : null;
  if (!id) return;
  try {
    const p = await getPartner('customers', id);
    customer.value = { ...p };
  } catch (e) {
    error.value = errorMessage(e);
  }
});
</script>

<template>
  <div>
    <PageHeader title="Nueva factura" subtitle="Para ventas a crédito o a empresas. Se emite al guardar, con su NCF; el precio es el de la lista de productos." :back="{ to: '/facturas', label: 'Facturas' }" />

    <div class="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
      <div class="min-w-0 space-y-6">
        <section class="card">
          <div class="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
            <PartnerPicker v-model="customer" kind="customers" label="Cliente" />
            <BaseButton variant="secondary" size="lg" :icon="UserPlus" @click="newCustomer = true">Cliente nuevo</BaseButton>
          </div>
          <div v-if="customer" class="mt-4 grid gap-4 sm:grid-cols-3">
            <div>
              <label for="inv-ncf" class="label">Comprobante</label>
              <select id="inv-ncf" v-model="ncfType" class="input">
                <option value="">El de la configuración (consumo)</option>
                <option value="B01">B01 · Crédito fiscal</option>
                <option value="B02">B02 · Consumo</option>
                <option value="B14">B14 · Régimen especial</option>
                <option value="B15">B15 · Gubernamental</option>
                <option value="E31">E31 · Crédito fiscal electrónica</option>
                <option value="E32">E32 · Consumo electrónica</option>
              </select>
            </div>
            <div>
              <label for="inv-due" class="label">Vence</label>
              <input id="inv-due" v-model="dueDate" type="date" class="input" :min="todayInput()" />
              <p class="hint">{{ dueDate ? '' : customer.paymentTermsDays ? `Si lo dejas vacío: ${customer.paymentTermsDays} días de crédito.` : 'Si lo dejas vacío: de contado (hoy).' }}</p>
            </div>
            <div>
              <p class="label">Saldo pendiente del cliente</p>
              <p class="num py-2.5 text-lg font-semibold">{{ formatMoney(customer.balance) }}</p>
            </div>
          </div>
        </section>

        <section class="card">
          <ProductPicker @pick="addProduct" />
          <div v-if="lines.length" class="mt-4 overflow-x-auto">
            <table class="table-base [&_td]:px-2 [&_th]:px-2">
              <thead>
                <tr><th>Producto</th><th class="text-right">Cantidad</th><th class="text-right">Precio</th><th class="text-right">Descuento</th><th class="text-right">ITBIS</th><th class="text-right">Importe</th><th><span class="sr-only">Quitar</span></th></tr>
              </thead>
              <tbody>
                <tr v-for="(l, i) in lines" :key="l.product.id">
                  <td class="min-w-40">
                    <p class="font-medium">{{ l.product.name }}</p>
                    <p class="text-xs text-ink-500">
                      <span class="font-mono">{{ l.product.code }}</span>
                      <span v-if="l.product.tracksInventory"> · {{ formatNumber(l.product.stockQty) }} {{ l.product.unit }} en existencia</span>
                    </p>
                  </td>
                  <td class="text-right"><input v-model="l.quantity" class="input num ml-auto w-20 px-2 py-1.5 text-right" inputmode="decimal" :aria-label="`Cantidad de ${l.product.name}`" /></td>
                  <td class="num text-right">{{ formatMoney(l.product.salePrice) }}</td>
                  <td class="text-right"><input v-model="l.discount" class="input num ml-auto w-20 px-2 py-1.5 text-right" inputmode="decimal" placeholder="0.00" :aria-label="`Descuento de ${l.product.name}`" /></td>
                  <td class="num text-right text-ink-500">{{ formatMoney(preview[i]?.tax.toFixed(2)) }}</td>
                  <td class="num text-right font-medium">{{ formatMoney(preview[i]?.net.toFixed(2)) }}</td>
                  <td class="text-right">
                    <button type="button" class="rounded-md p-1.5 text-ink-400 hover:bg-danger-soft hover:text-danger" :aria-label="`Quitar ${l.product.name}`" @click="removeLine(i)"><Trash2 class="size-4" /></button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p v-else class="mt-4 text-sm text-ink-500">Busca y agrega los productos de la factura.</p>
        </section>

        <section class="card">
          <label for="inv-notes" class="label">Nota (opcional, sale en la factura)</label>
          <textarea id="inv-notes" v-model="notes" class="input" rows="2" maxlength="1000" />
        </section>
      </div>

      <aside class="min-w-0 space-y-4 xl:sticky xl:top-6 xl:self-start">
        <section class="card space-y-2 text-sm">
          <div class="flex justify-between text-ink-500"><span>Subtotal (sin ITBIS)</span><span class="num">{{ formatMoney(totals.net.toFixed(2)) }}</span></div>
          <div class="flex justify-between text-ink-500"><span>ITBIS</span><span class="num">{{ formatMoney(totals.tax.toFixed(2)) }}</span></div>
          <div class="flex items-baseline justify-between border-t border-line pt-3">
            <span class="text-base font-semibold">Total estimado</span>
            <strong class="num text-2xl">{{ formatMoney(totals.total.toFixed(2)) }}</strong>
          </div>
          <p class="hint">El monto exacto (con el ITBIS vigente) lo calcula la factura al emitirse.</p>
        </section>
        <ErrorAlert :message="error ?? lineErrors" />
        <BaseButton variant="accent" size="lg" block :loading="busy" :disabled="!canSave" @click="save">Emitir factura</BaseButton>
        <p v-if="!customer" class="text-center text-sm text-ink-500">Elige el cliente para continuar.</p>
      </aside>
    </div>

    <PartnerFormModal :open="newCustomer" kind="customers" :partner="null" @saved="onCustomerCreated" @close="newCustomer = false" />
    <ApprovalModal :action="approval.action.value" @approved="approval.settle" @close="approval.settle(null)" />
  </div>
</template>
