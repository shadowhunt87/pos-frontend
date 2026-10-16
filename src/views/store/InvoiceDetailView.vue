<script setup lang="ts">
import { Ban, Printer, Wallet } from 'lucide-vue-next';
import { computed, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { errorMessage } from '@/api/errors';
import { getInvoice, voidInvoice } from '@/api/store';
import BaseButton from '@/components/BaseButton.vue';
import BaseModal from '@/components/BaseModal.vue';
import ErrorAlert from '@/components/ErrorAlert.vue';
import LoadingState from '@/components/LoadingState.vue';
import PageHeader from '@/components/PageHeader.vue';
import StatusBadge from '@/components/StatusBadge.vue';
import CollectModal from '@/components/store/CollectModal.vue';
import { useAuthStore } from '@/stores/auth';
import { useToastStore } from '@/stores/toast';
import type { InvoiceDetail } from '@/types/api';
import { formatDateOnly, formatMoney, formatNumber } from '@/utils/format';
import { INVOICE_STATUS, NCF_NAME, PAYMENT_METHOD_LABEL, VOID_CODES, invoiceOrigin } from '@/utils/labels';
import { printInvoice } from '@/utils/invoicePrint';

// Factura de venta (/facturas/:id) o de compra (/compras/:id): mismo detalle, distintas acciones.
const props = defineProps<{ id: string }>();
const auth = useAuthStore();
const toast = useToastStore();
const route = useRoute();

const inv = ref<InvoiceDetail | null>(null);
const loading = ref(true);
const error = ref<string | null>(null);
const collectOpen = ref(false);
const voidOpen = ref(false);
const voidReason = ref('');
const voidCode = ref('04');
const voidBusy = ref(false);
const voidError = ref<string | null>(null);

const purchase = computed(() => route.name === 'compra' || inv.value?.type === 'PURCHASE');
const back = computed(() => (purchase.value ? { to: '/compras', label: 'Compras' } : { to: '/facturas', label: 'Facturas' }));
const canCollect = computed(() => !!inv.value && !purchase.value && auth.can('cobrar') && inv.value.status !== 'VOIDED' && Number(inv.value.balance) > 0);
const canVoid = computed(
  () => !!inv.value && auth.can('anularFacturas') && inv.value.status !== 'VOIDED' && (inv.value.sourceModule === null || inv.value.sourceModule === 'pos.factura' || inv.value.sourceModule === 'pos.compra'),
);
const activePayments = computed(() => inv.value?.payments.filter((p) => p.status !== 'VOIDED') ?? []);

async function load(id: string): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    inv.value = await getInvoice(id);
  } catch (e) {
    error.value = errorMessage(e);
  } finally {
    loading.value = false;
  }
}

watch(() => props.id, (id) => void load(id), { immediate: true });

function print(): void {
  if (inv.value && !printInvoice(inv.value)) toast.error('No se abrió la factura', 'El navegador bloqueó la ventana: permite las ventanas emergentes para esta página.');
}

function collected(updated: InvoiceDetail): void {
  collectOpen.value = false;
  inv.value = updated;
  toast.success('Cobro registrado', Number(updated.balance) > 0 ? `Queda un saldo de ${formatMoney(updated.balance)}.` : 'La factura quedó pagada.');
}

async function confirmVoid(): Promise<void> {
  if (!inv.value || !voidReason.value.trim() || voidBusy.value) return;
  voidBusy.value = true;
  voidError.value = null;
  try {
    inv.value = await voidInvoice(inv.value.id, { reason: voidReason.value.trim(), ...(purchase.value ? {} : { reasonCode: voidCode.value }) });
    voidOpen.value = false;
    toast.success(`${purchase.value ? 'Compra' : 'Factura'} anulada`);
  } catch (e) {
    voidError.value = errorMessage(e);
  } finally {
    voidBusy.value = false;
  }
}
</script>

<template>
  <div>
    <LoadingState v-if="loading && !inv" variant="detail" />
    <ErrorAlert v-else-if="error" :message="error" retry @retry="load(id)" />
    <template v-else-if="inv">
      <PageHeader :title="`${purchase ? 'Compra' : 'Factura'} ${inv.number}`" :back="back">
        <template #subtitle>
          {{ purchase ? 'Factura de compra' : NCF_NAME[inv.ncfType ?? ''] ?? 'Factura' }}<template v-if="inv.ncf"> · NCF <span class="font-mono">{{ inv.ncf }}</span></template>
          · {{ invoiceOrigin(inv.sourceModule) }}
        </template>
        <template #actions>
          <StatusBadge :tone="INVOICE_STATUS[inv.status]?.tone ?? 'neutral'">{{ INVOICE_STATUS[inv.status]?.label ?? inv.status }}</StatusBadge>
          <BaseButton variant="secondary" :icon="Printer" @click="print">Imprimir</BaseButton>
          <BaseButton v-if="canCollect" variant="accent" :icon="Wallet" @click="collectOpen = true">Cobrar</BaseButton>
          <BaseButton v-if="canVoid" variant="ghost" :icon="Ban" @click="voidOpen = true; voidReason = ''; voidError = null">Anular</BaseButton>
        </template>
      </PageHeader>

      <p v-if="inv.sourceModule === 'pos.venta' && inv.status !== 'VOIDED'" class="mb-4 rounded-xl bg-info-soft px-4 py-3 text-sm text-info-strong">
        Es una venta de la caja: se anula o se devuelve desde la caja, en «Ventas y devoluciones».
      </p>

      <div class="grid gap-4 sm:grid-cols-3">
        <div class="card">
          <p class="eyebrow">{{ purchase ? 'Proveedor' : 'Cliente' }}</p>
          <p class="mt-2 font-semibold">
            <RouterLink v-if="!purchase && auth.can('facturas')" :to="`/clientes/${inv.partner.id}`" class="link">{{ inv.partner.name }}</RouterLink>
            <template v-else>{{ inv.partner.name }}</template>
          </p>
          <p v-if="inv.partner.taxId" class="font-mono text-sm text-ink-500">{{ inv.partner.taxId }}</p>
        </div>
        <div class="card">
          <p class="eyebrow">Fechas</p>
          <p class="mt-2 text-sm">Emitida el {{ formatDateOnly(inv.issueDate) }}</p>
          <p class="text-sm text-ink-500">Vence el {{ formatDateOnly(inv.dueDate) }}</p>
        </div>
        <div class="card">
          <p class="eyebrow">{{ purchase ? 'Por pagar' : 'Saldo por cobrar' }}</p>
          <p :class="['num mt-2 text-2xl font-bold', Number(inv.balance) > 0 && inv.status !== 'VOIDED' ? 'text-ink-950' : 'text-success']">{{ formatMoney(inv.balance) }}</p>
          <p class="text-sm text-ink-500">de {{ formatMoney(inv.total) }}</p>
        </div>
      </div>

      <section class="card mt-6 overflow-x-auto p-0 sm:p-0">
        <table class="table-base">
          <thead>
            <tr><th>Descripción</th><th class="text-right">Cantidad</th><th class="text-right">{{ purchase ? 'Costo' : 'Precio' }}</th><th class="text-right">Descuento</th><th class="text-right">ITBIS</th><th class="text-right">Importe</th></tr>
          </thead>
          <tbody>
            <tr v-for="l in inv.lines" :key="l.id">
              <td>{{ l.description }}</td>
              <td class="num text-right">{{ formatNumber(l.quantity) }}</td>
              <td class="num text-right">{{ formatMoney(l.unitPrice) }}</td>
              <td class="num text-right">{{ Number(l.discount) ? formatMoney(l.discount) : '' }}</td>
              <td class="num text-right">{{ formatMoney(l.taxAmount) }}</td>
              <td class="num text-right font-medium">{{ formatMoney(l.total) }}</td>
            </tr>
          </tbody>
        </table>
        <dl class="ml-auto max-w-xs space-y-1.5 px-5 py-4 text-sm sm:px-6">
          <div class="flex justify-between"><dt class="text-ink-500">Subtotal</dt><dd class="num">{{ formatMoney(inv.subtotal) }}</dd></div>
          <div v-if="Number(inv.discountTotal)" class="flex justify-between"><dt class="text-ink-500">Descuentos</dt><dd class="num">−{{ formatMoney(inv.discountTotal) }}</dd></div>
          <div class="flex justify-between"><dt class="text-ink-500">ITBIS</dt><dd class="num">{{ formatMoney(inv.taxTotal) }}</dd></div>
          <div class="flex justify-between border-t border-line pt-2 text-base font-bold"><dt>Total</dt><dd class="num">{{ formatMoney(inv.total) }}</dd></div>
        </dl>
      </section>

      <section v-if="!purchase" class="card mt-6">
        <h2 class="card-title">Cobros</h2>
        <ul v-if="activePayments.length" class="mt-3 divide-y divide-line text-sm">
          <li v-for="p in activePayments" :key="p.id" class="flex flex-wrap items-center justify-between gap-2 py-2.5">
            <span>{{ formatDateOnly(p.date) }} · {{ PAYMENT_METHOD_LABEL[p.method] ?? p.method }}<span v-if="p.reference" class="text-ink-500"> · {{ p.reference }}</span></span>
            <span class="num font-semibold">{{ formatMoney(p.amount) }}</span>
          </li>
        </ul>
        <p v-else class="mt-2 text-sm text-ink-500">Sin cobros todavía.</p>
      </section>
      <p v-if="inv.notes" class="mt-4 text-sm text-ink-500">Nota: {{ inv.notes }}</p>
    </template>

    <CollectModal :open="collectOpen" :invoice="inv" @done="collected" @close="collectOpen = false" />
    <BaseModal :open="voidOpen" :title="`Anular ${inv?.number ?? ''}`" @close="voidOpen = false">
      <form id="void-inv-form" class="space-y-4" @submit.prevent="confirmVoid">
        <p class="text-sm text-ink-500">
          {{ purchase ? 'La mercancía sale del inventario y se reversa su asiento.' : 'Se reversan el asiento y el inventario. El NCF queda anulado y va al formato 608.' }}
          Si tiene cobros, primero hay que anularlos en el sistema contable.
        </p>
        <div v-if="!purchase">
          <label for="void-inv-code" class="label">Motivo de anulación (DGII)</label>
          <select id="void-inv-code" v-model="voidCode" class="input">
            <option v-for="c in VOID_CODES" :key="c[0]" :value="c[0]">{{ c[0] }} · {{ c[1] }}</option>
          </select>
        </div>
        <div>
          <label for="void-inv-reason" class="label">Explica qué pasó</label>
          <input id="void-inv-reason" v-model="voidReason" class="input" maxlength="500" />
        </div>
        <ErrorAlert :message="voidError" />
      </form>
      <template #footer>
        <BaseButton variant="secondary" @click="voidOpen = false">Cancelar</BaseButton>
        <BaseButton type="submit" form="void-inv-form" variant="danger" :loading="voidBusy" :disabled="!voidReason.trim()">Anular</BaseButton>
      </template>
    </BaseModal>
  </div>
</template>
