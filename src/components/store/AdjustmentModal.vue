<script setup lang="ts">
import { Trash2 } from 'lucide-vue-next';
import { computed, ref, watch } from 'vue';
import { errorMessage } from '@/api/errors';
import { createAdjustment } from '@/api/store';
import BaseButton from '@/components/BaseButton.vue';
import BaseModal from '@/components/BaseModal.vue';
import ErrorAlert from '@/components/ErrorAlert.vue';
import ProductPicker from '@/components/ProductPicker.vue';
import type { AdjustmentDetail, StoreProduct } from '@/types/api';
import { formatMoney, formatNumber, todayInput } from '@/utils/format';

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ saved: [adjustment: AdjustmentDetail]; close: [] }>();

interface Line {
  product: StoreProduct;
  direction: 'IN' | 'OUT';
  quantity: string;
  unitCost: string;
}

const REASONS = ['Conteo físico', 'Existencia inicial', 'Merma o daño', 'Producto vencido', 'Consumo interno'];
const date = ref(todayInput());
const reason = ref('');
const lines = ref<Line[]>([]);
const busy = ref(false);
const error = ref<string | null>(null);

watch(
  () => props.open,
  (open) => {
    if (!open) return;
    date.value = todayInput();
    reason.value = '';
    lines.value = [];
    error.value = null;
  },
);

function add(p: StoreProduct): void {
  if (!p.tracksInventory) {
    error.value = `${p.name} no controla existencias: actívalo en su ficha de producto.`;
    return;
  }
  if (lines.value.some((l) => l.product.id === p.id)) return;
  const cost = Number(p.avgCost) > 0 ? String(Number(p.avgCost)) : p.purchasePrice ? String(Number(p.purchasePrice)) : '';
  lines.value.push({ product: p, direction: 'OUT', quantity: '', unitCost: cost });
}

const lineError = computed(() => {
  for (const l of lines.value) {
    if (!/^\d+(\.\d{1,4})?$/.test(l.quantity.trim()) || Number(l.quantity) <= 0) return `Escribe la cantidad de ${l.product.name}.`;
    if (l.direction === 'IN' && (!/^\d+(\.\d{1,6})?$/.test(l.unitCost.trim()) || Number(l.unitCost) <= 0)) return `Una entrada necesita el costo unitario de ${l.product.name}.`;
  }
  return null;
});
const valid = computed(() => !!date.value && !!reason.value.trim() && lines.value.length > 0 && !lineError.value);

async function save(): Promise<void> {
  if (!valid.value || busy.value) return;
  busy.value = true;
  error.value = null;
  try {
    emit(
      'saved',
      await createAdjustment({
        date: date.value,
        reason: reason.value.trim(),
        lines: lines.value.map((l) => ({
          productId: l.product.id,
          quantity: l.direction === 'IN' ? Number(l.quantity) : -Number(l.quantity),
          ...(l.direction === 'IN' ? { unitCost: Number(l.unitCost) } : {}),
        })),
      }),
    );
  } catch (e) {
    error.value = errorMessage(e);
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <BaseModal :open="open" title="Ajuste de inventario" description="Conteo físico, mermas, daños o existencia inicial. Genera su asiento en la contabilidad." size="xl" @close="emit('close')">
    <div class="grid gap-4 sm:grid-cols-3">
      <div>
        <label for="adj-date" class="label">Fecha</label>
        <input id="adj-date" v-model="date" type="date" class="input" :max="todayInput()" />
      </div>
      <div class="sm:col-span-2">
        <label for="adj-reason" class="label">Motivo</label>
        <input id="adj-reason" v-model="reason" class="input" maxlength="500" list="adj-reasons" placeholder="Conteo físico de octubre" />
        <datalist id="adj-reasons"><option v-for="r in REASONS" :key="r" :value="r" /></datalist>
      </div>
      <div class="sm:col-span-3"><ProductPicker label="Producto" only-inventory show-cost @pick="add" /></div>
    </div>

    <div v-if="lines.length" class="mt-4 overflow-x-auto rounded-xl border border-line">
      <table class="table-base">
        <thead>
          <tr><th>Producto</th><th>Movimiento</th><th class="text-right">Cantidad</th><th class="text-right">Costo unitario</th><th><span class="sr-only">Quitar</span></th></tr>
        </thead>
        <tbody>
          <tr v-for="(l, i) in lines" :key="l.product.id">
            <td>
              <p class="font-medium">{{ l.product.name }}</p>
              <p class="text-xs text-ink-500">Hay {{ formatNumber(l.product.stockQty) }} {{ l.product.unit }} · costo promedio {{ formatMoney(l.product.avgCost) }}</p>
            </td>
            <td>
              <select v-model="l.direction" class="input w-36 py-1.5" :aria-label="`Movimiento de ${l.product.name}`">
                <option value="OUT">Sale (falta)</option>
                <option value="IN">Entra (sobra)</option>
              </select>
            </td>
            <td class="text-right"><input v-model="l.quantity" class="input num ml-auto w-24 py-1.5 text-right" inputmode="decimal" :aria-label="`Cantidad de ${l.product.name}`" /></td>
            <td class="text-right">
              <input v-if="l.direction === 'IN'" v-model="l.unitCost" class="input num ml-auto w-28 py-1.5 text-right" inputmode="decimal" :aria-label="`Costo de ${l.product.name}`" />
              <span v-else class="text-xs text-ink-500">Al promedio</span>
            </td>
            <td class="text-right">
              <button type="button" class="rounded-md p-1.5 text-ink-400 hover:bg-danger-soft hover:text-danger" :aria-label="`Quitar ${l.product.name}`" @click="lines.splice(i, 1)"><Trash2 class="size-4" /></button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <div class="mt-4"><ErrorAlert :message="error ?? lineError" /></div>
    <template #footer>
      <BaseButton variant="secondary" @click="emit('close')">Cancelar</BaseButton>
      <BaseButton variant="accent" :loading="busy" :disabled="!valid" @click="save">Registrar ajuste</BaseButton>
    </template>
  </BaseModal>
</template>
