<script setup lang="ts">
import { Search } from 'lucide-vue-next';
import { ref, watch } from 'vue';
import { errorMessage } from '@/api/errors';
import { listProducts } from '@/api/store';
import type { StoreProduct } from '@/types/api';
import { formatMoney, formatNumber } from '@/utils/format';

// Buscador de productos (código, nombre o código de barras). Enter con un código exacto lo agrega de una vez.
const props = withDefaults(defineProps<{ label?: string; onlyInventory?: boolean; showCost?: boolean }>(), { label: 'Agregar producto', onlyInventory: false, showCost: false });
const emit = defineEmits<{ pick: [product: StoreProduct] }>();

const q = ref('');
const results = ref<StoreProduct[]>([]);
const open = ref(false);
const error = ref<string | null>(null);
const inputId = `pp-${Math.random().toString(36).slice(2, 8)}`;
let timer: ReturnType<typeof setTimeout> | undefined;
let seq = 0;

async function search(text: string): Promise<void> {
  const mine = ++seq;
  error.value = null;
  try {
    const r = await listProducts({ q: text, active: true, limit: 20 });
    if (mine !== seq) return;
    results.value = props.onlyInventory ? r.data.filter((p) => p.tracksInventory) : r.data;
  } catch (e) {
    if (mine === seq) error.value = errorMessage(e);
  }
}

watch(q, (text) => {
  clearTimeout(timer);
  if (!text.trim()) {
    results.value = [];
    open.value = false;
    return;
  }
  open.value = true;
  timer = setTimeout(() => void search(text.trim()), 200);
});

function pick(p: StoreProduct): void {
  emit('pick', p);
  q.value = '';
  results.value = [];
  open.value = false;
}

async function onEnter(): Promise<void> {
  const text = q.value.trim();
  if (!text) return;
  await search(text);
  const exact = results.value.find((p) => p.code.toLowerCase() === text.toLowerCase() || p.barcodes.includes(text));
  const one = exact ?? (results.value.length === 1 ? results.value[0] : undefined);
  if (one) pick(one);
}
</script>

<template>
  <div class="relative">
    <label :for="inputId" class="label">{{ label }}</label>
    <div class="relative">
      <Search class="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-400" aria-hidden="true" />
      <input
        :id="inputId"
        v-model="q"
        type="search"
        class="input pl-10"
        placeholder="Código, nombre o código de barras"
        autocomplete="off"
        @keydown.enter.prevent="onEnter"
        @keydown.escape="open = false"
      />
    </div>
    <ul v-if="open" class="absolute inset-x-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-xl border border-line bg-surface shadow-pop" role="listbox">
      <li v-for="p in results" :key="p.id">
        <button type="button" class="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm hover:bg-ink-50" @click="pick(p)">
          <span>
            <span class="font-semibold">{{ p.name }}</span>
            <span class="ml-2 font-mono text-xs text-ink-500">{{ p.code }}</span>
          </span>
          <span class="shrink-0 text-right text-xs text-ink-500">
            <span class="num block font-semibold text-ink-900">{{ showCost ? `Costo ${formatMoney(p.avgCost)}` : formatMoney(p.salePrice) }}</span>
            <span v-if="p.tracksInventory">{{ formatNumber(p.stockQty) }} {{ p.unit }}</span>
          </span>
        </button>
      </li>
      <li v-if="!results.length" class="px-4 py-3 text-sm text-ink-500">{{ error ?? 'Sin resultados.' }}</li>
    </ul>
  </div>
</template>
