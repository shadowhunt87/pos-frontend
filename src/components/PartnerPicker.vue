<script setup lang="ts">
import { Search, X } from 'lucide-vue-next';
import { ref, watch } from 'vue';
import { errorMessage } from '@/api/errors';
import { listPartners, type PartnerKind } from '@/api/store';
import type { PartnerRow } from '@/types/api';

// Elegir un cliente o proveedor por nombre, RNC o cédula.
const props = defineProps<{ kind: PartnerKind; label: string; modelValue: PartnerRow | null }>();
const emit = defineEmits<{ 'update:modelValue': [value: PartnerRow | null] }>();

const q = ref('');
const results = ref<PartnerRow[]>([]);
const open = ref(false);
const error = ref<string | null>(null);
const inputId = `ptp-${Math.random().toString(36).slice(2, 8)}`;
let timer: ReturnType<typeof setTimeout> | undefined;
let seq = 0;

async function search(text: string): Promise<void> {
  const mine = ++seq;
  try {
    const r = await listPartners(props.kind, { q: text, active: true, limit: 20 });
    if (mine === seq) results.value = r.data;
  } catch (e) {
    if (mine === seq) error.value = errorMessage(e);
  }
}

watch(q, (text) => {
  clearTimeout(timer);
  open.value = true;
  timer = setTimeout(() => void search(text.trim()), 200);
});

function pick(p: PartnerRow): void {
  emit('update:modelValue', p);
  q.value = '';
  open.value = false;
}
</script>

<template>
  <div class="relative">
    <label :for="inputId" class="label">{{ label }}</label>
    <div v-if="modelValue" class="flex items-center justify-between gap-3 rounded-lg border border-ink-200 bg-surface px-3.5 py-2">
      <span>
        <span class="font-semibold">{{ modelValue.name }}</span>
        <span v-if="modelValue.taxId" class="ml-2 font-mono text-xs text-ink-500">{{ modelValue.taxId }}</span>
      </span>
      <button type="button" class="rounded-md p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-900" aria-label="Cambiar" @click="emit('update:modelValue', null)">
        <X class="size-4" />
      </button>
    </div>
    <template v-else>
      <div class="relative">
        <Search class="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-400" aria-hidden="true" />
        <input :id="inputId" v-model="q" type="search" class="input pl-10" placeholder="Nombre, RNC o cédula" autocomplete="off" @focus="open = true; search(q)" @keydown.escape="open = false" />
      </div>
      <ul v-if="open" class="absolute inset-x-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-xl border border-line bg-surface shadow-pop">
        <li v-for="p in results" :key="p.id">
          <button type="button" class="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm hover:bg-ink-50" @click="pick(p)">
            <span class="font-semibold">{{ p.name }}</span>
            <span class="font-mono text-xs text-ink-500">{{ p.taxId ?? 'Sin RNC' }}</span>
          </button>
        </li>
        <li v-if="!results.length" class="px-4 py-3 text-sm text-ink-500">{{ error ?? (q ? `No hay resultados con «${q}».` : 'Escribe para buscar.') }}</li>
      </ul>
    </template>
  </div>
</template>
