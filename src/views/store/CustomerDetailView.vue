<script setup lang="ts">
import { FilePlus, Pencil } from 'lucide-vue-next';
import { ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { errorMessage } from '@/api/errors';
import { getPartner } from '@/api/store';
import BaseButton from '@/components/BaseButton.vue';
import ErrorAlert from '@/components/ErrorAlert.vue';
import LoadingState from '@/components/LoadingState.vue';
import PageHeader from '@/components/PageHeader.vue';
import StatusBadge from '@/components/StatusBadge.vue';
import PartnerFormModal from '@/components/store/PartnerFormModal.vue';
import { useAuthStore } from '@/stores/auth';
import type { PartnerDetail } from '@/types/api';
import { formatDateOnly, formatMoney } from '@/utils/format';
import { INVOICE_STATUS, invoiceOrigin } from '@/utils/labels';

const props = defineProps<{ id: string }>();
const auth = useAuthStore();
const router = useRouter();

const partner = ref<PartnerDetail | null>(null);
const loading = ref(true);
const error = ref<string | null>(null);
const editOpen = ref(false);

async function load(id: string): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    partner.value = await getPartner('customers', id);
  } catch (e) {
    error.value = errorMessage(e);
  } finally {
    loading.value = false;
  }
}

watch(() => props.id, (id) => void load(id), { immediate: true });

function saved(p: PartnerDetail): void {
  editOpen.value = false;
  partner.value = p;
}

const TYPE: Record<string, string> = { SALE: 'Factura', CREDIT_NOTE: 'Nota de crédito', DEBIT_NOTE: 'Nota de débito' };
</script>

<template>
  <div>
    <LoadingState v-if="loading && !partner" variant="detail" />
    <ErrorAlert v-else-if="error" :message="error" retry @retry="load(id)" />
    <template v-else-if="partner">
      <PageHeader :title="partner.name" :back="{ to: '/clientes', label: 'Clientes' }">
        <template #subtitle>
          {{ partner.taxId ? `${partner.taxIdType ?? 'RNC'} ${partner.taxId}` : 'Sin RNC ni cédula' }}
          <template v-if="partner.defaultNcfType"> · pide {{ partner.defaultNcfType }}</template>
        </template>
        <template #actions>
          <StatusBadge :tone="partner.active ? 'success' : 'neutral'">{{ partner.active ? 'Activo' : 'Inactivo' }}</StatusBadge>
          <BaseButton v-if="auth.can('vender')" variant="secondary" :icon="Pencil" @click="editOpen = true">Editar</BaseButton>
          <BaseButton v-if="auth.can('vender') && partner.active" variant="accent" :icon="FilePlus" @click="router.push(`/facturas/nueva?cliente=${partner.id}`)">Nueva factura</BaseButton>
        </template>
      </PageHeader>

      <div class="grid gap-4 sm:grid-cols-3">
        <div class="card">
          <p class="eyebrow">Me debe</p>
          <p :class="['num mt-2 text-2xl font-bold', Number(partner.balance) > 0 && 'text-ink-950']">{{ formatMoney(partner.balance) }}</p>
          <p v-if="partner.creditLimit" class="mt-1 text-xs text-ink-500">Límite de crédito {{ formatMoney(partner.creditLimit) }}</p>
        </div>
        <div class="card">
          <p class="eyebrow">Crédito</p>
          <p class="mt-2 font-semibold">{{ partner.paymentTermsDays ? `${partner.paymentTermsDays} días` : 'De contado' }}</p>
        </div>
        <div class="card text-sm">
          <p class="eyebrow">Contacto</p>
          <p class="mt-2">{{ partner.phone ?? 'Sin teléfono' }}</p>
          <p class="text-ink-500">{{ partner.email ?? 'Sin correo' }}</p>
          <p v-if="partner.address" class="text-ink-500">{{ partner.address }}</p>
        </div>
      </div>

      <section class="card mt-6 overflow-x-auto p-0 sm:p-0">
        <h2 class="card-title border-b border-line px-5 py-4 sm:px-6">Facturas (las 50 más recientes)</h2>
        <table class="table-base">
          <thead>
            <tr><th>Documento</th><th>Fecha</th><th>Vence</th><th>NCF</th><th>Origen</th><th class="text-right">Total</th><th class="text-right">Saldo</th><th>Estado</th></tr>
          </thead>
          <tbody>
            <tr v-for="i in partner.invoices" :key="i.id" :class="i.type === 'SALE' && 'cursor-pointer'" @click="i.type === 'SALE' && router.push(`/facturas/${i.id}`)">
              <td class="whitespace-nowrap"><span class="text-ink-500">{{ TYPE[i.type] ?? i.type }}</span> <span class="font-mono">{{ i.number }}</span></td>
              <td>{{ formatDateOnly(i.issueDate) }}</td>
              <td>{{ formatDateOnly(i.dueDate) }}</td>
              <td class="font-mono">{{ i.ncf ?? '—' }}</td>
              <td class="text-ink-500">{{ invoiceOrigin(i.sourceModule) }}</td>
              <td class="num text-right">{{ formatMoney(i.total) }}</td>
              <td class="num text-right">{{ formatMoney(i.balance) }}</td>
              <td><StatusBadge :tone="INVOICE_STATUS[i.status]?.tone ?? 'neutral'">{{ INVOICE_STATUS[i.status]?.label ?? i.status }}</StatusBadge></td>
            </tr>
            <tr v-if="!partner.invoices.length"><td colspan="8" class="py-8 text-center text-ink-500">Sin facturas todavía.</td></tr>
          </tbody>
        </table>
      </section>
    </template>
    <PartnerFormModal :open="editOpen" kind="customers" :partner="partner" @saved="saved" @close="editOpen = false" />
  </div>
</template>
