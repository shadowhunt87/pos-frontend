<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { errorMessage } from '@/api/errors';
import { savePartner, type PartnerKind } from '@/api/store';
import BaseButton from '@/components/BaseButton.vue';
import BaseModal from '@/components/BaseModal.vue';
import ErrorAlert from '@/components/ErrorAlert.vue';
import type { PartnerDetail, PartnerRequest, PartnerRow } from '@/types/api';

const props = defineProps<{ open: boolean; kind: PartnerKind; partner: PartnerRow | PartnerDetail | null }>();
const emit = defineEmits<{ saved: [partner: PartnerDetail]; close: [] }>();

const isCustomer = computed(() => props.kind === 'customers');
const blank = () => ({
  name: '', tradeName: '', taxIdType: 'RNC' as 'RNC' | 'CEDULA' | 'PASSPORT', taxId: '', phone: '', email: '', address: '', city: '',
  paymentTermsDays: '0', creditLimit: '', defaultNcfType: '', active: true,
});
const form = ref(blank());
const busy = ref(false);
const error = ref<string | null>(null);

watch(
  () => props.open,
  (open) => {
    if (!open) return;
    error.value = null;
    const p = props.partner;
    form.value = p
      ? {
          name: p.name, tradeName: p.tradeName ?? '', taxIdType: (p.taxIdType as 'RNC' | 'CEDULA' | 'PASSPORT' | null) ?? 'RNC', taxId: p.taxId ?? '',
          phone: p.phone ?? '', email: p.email ?? '', address: p.address ?? '', city: p.city ?? '', paymentTermsDays: String(p.paymentTermsDays),
          creditLimit: p.creditLimit ? String(Number(p.creditLimit)) : '', defaultNcfType: p.defaultNcfType ?? '', active: p.active,
        }
      : blank();
  },
);

/** Ayuda en el front; el backend valida de verdad (incluido el RNC en el padrón de la DGII si está cargado). */
function validate(): string | null {
  const f = form.value;
  if (!f.name.trim()) return 'Escribe el nombre.';
  const id = f.taxId.replace(/\D/g, '');
  if (id && f.taxIdType === 'RNC' && id.length !== 9) return 'El RNC tiene 9 números.';
  if (id && f.taxIdType === 'CEDULA' && id.length !== 11) return 'La cédula tiene 11 números.';
  if (f.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) return 'El correo no es válido.';
  if (!/^\d{1,3}$/.test(f.paymentTermsDays.trim()) || Number(f.paymentTermsDays) > 365) return 'Los días de crédito van de 0 a 365.';
  if (f.creditLimit.trim() && !/^\d+(\.\d{1,2})?$/.test(f.creditLimit.trim())) return 'El límite de crédito es un monto con hasta 2 decimales.';
  if (f.defaultNcfType && !/^[BE]\d{2}$/.test(f.defaultNcfType.trim().toUpperCase())) return 'El comprobante es una letra B o E y dos números (B01, B02…).';
  if (f.defaultNcfType.trim().toUpperCase() === 'B01' && !id) return 'Para crédito fiscal (B01) hace falta el RNC o la cédula.';
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
  const id = f.taxId.replace(/\D/g, '');
  const body: PartnerRequest = {
    name: f.name.trim(),
    ...(f.tradeName.trim() ? { tradeName: f.tradeName.trim() } : {}),
    ...(id ? { taxId: id, taxIdType: f.taxIdType } : {}),
    ...(f.phone.trim() ? { phone: f.phone.trim() } : {}),
    ...(f.email.trim() ? { email: f.email.trim() } : {}),
    ...(f.address.trim() ? { address: f.address.trim() } : {}),
    ...(f.city.trim() ? { city: f.city.trim() } : {}),
    paymentTermsDays: Number(f.paymentTermsDays),
    ...(f.creditLimit.trim() ? { creditLimit: Number(f.creditLimit) } : {}),
    ...(f.defaultNcfType.trim() ? { defaultNcfType: f.defaultNcfType.trim().toUpperCase() } : {}),
    ...(props.partner ? { active: f.active } : {}),
  };
  busy.value = true;
  error.value = null;
  try {
    emit('saved', await savePartner(props.kind, props.partner?.id ?? null, body));
  } catch (e) {
    error.value = errorMessage(e);
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <BaseModal :open="open" :title="partner ? `Editar ${isCustomer ? 'cliente' : 'proveedor'}` : isCustomer ? 'Cliente nuevo' : 'Proveedor nuevo'" size="lg" @close="emit('close')">
    <form id="partner-form" class="grid gap-4 sm:grid-cols-2" novalidate @submit.prevent="save">
      <div class="sm:col-span-2">
        <label for="pf-name" class="label">Nombre o razón social</label>
        <input id="pf-name" v-model="form.name" class="input" maxlength="200" />
      </div>
      <div class="sm:col-span-2">
        <label for="pf-trade" class="label">Nombre comercial (opcional)</label>
        <input id="pf-trade" v-model="form.tradeName" class="input" maxlength="200" />
      </div>
      <div>
        <label for="pf-doctype" class="label">Documento</label>
        <select id="pf-doctype" v-model="form.taxIdType" class="input">
          <option value="RNC">RNC</option>
          <option value="CEDULA">Cédula</option>
          <option value="PASSPORT">Pasaporte</option>
        </select>
      </div>
      <div>
        <label for="pf-taxid" class="label">Número {{ isCustomer ? '(opcional)' : '' }}</label>
        <input id="pf-taxid" v-model="form.taxId" class="input font-mono" inputmode="numeric" placeholder="Solo números" />
      </div>
      <div>
        <label for="pf-phone" class="label">Teléfono</label>
        <input id="pf-phone" v-model="form.phone" class="input" inputmode="tel" maxlength="50" />
      </div>
      <div>
        <label for="pf-email" class="label">Correo</label>
        <input id="pf-email" v-model="form.email" type="email" class="input" />
      </div>
      <div class="sm:col-span-2">
        <label for="pf-address" class="label">Dirección</label>
        <input id="pf-address" v-model="form.address" class="input" maxlength="300" />
      </div>
      <div>
        <label for="pf-terms" class="label">Días de crédito</label>
        <input id="pf-terms" v-model="form.paymentTermsDays" class="input num" inputmode="numeric" />
        <p class="hint">0 = de contado. Con días, la factura vence ese tiempo después.</p>
      </div>
      <div v-if="isCustomer">
        <label for="pf-limit" class="label">Límite de crédito (opcional)</label>
        <input id="pf-limit" v-model="form.creditLimit" class="input num" inputmode="decimal" />
      </div>
      <div v-if="isCustomer">
        <label for="pf-ncf" class="label">Comprobante que pide</label>
        <select id="pf-ncf" v-model="form.defaultNcfType" class="input">
          <option value="">El de siempre (consumo)</option>
          <option value="B01">B01 · Crédito fiscal</option>
          <option value="B02">B02 · Consumo</option>
          <option value="B14">B14 · Régimen especial</option>
          <option value="B15">B15 · Gubernamental</option>
          <option value="E31">E31 · Crédito fiscal electrónica</option>
          <option value="E32">E32 · Consumo electrónica</option>
        </select>
      </div>
      <label v-if="partner" class="flex items-center gap-2 text-sm sm:col-span-2">
        <input v-model="form.active" type="checkbox" class="size-4 accent-[var(--brand-600)]" /> Activo
      </label>
      <div class="sm:col-span-2"><ErrorAlert :message="error" /></div>
    </form>
    <template #footer>
      <BaseButton variant="secondary" @click="emit('close')">Cancelar</BaseButton>
      <BaseButton type="submit" form="partner-form" variant="accent" :loading="busy">Guardar</BaseButton>
    </template>
  </BaseModal>
</template>
