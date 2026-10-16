<script setup lang="ts">
import BaseButton from '@/components/BaseButton.vue';
import BaseModal from '@/components/BaseModal.vue';
import type { ParkedSale } from '@/types/api';
import { formatDateTime } from '@/utils/format';

defineProps<{ open: boolean; items: ParkedSale[]; busy?: boolean }>();
const emit = defineEmits<{ resume: [item: ParkedSale]; discard: [item: ParkedSale]; close: [] }>();
</script>

<template>
  <BaseModal :open="open" title="Ventas suspendidas" description="Se recuperan una sola vez: al recuperarla deja de estar en la lista." @close="emit('close')">
    <ul class="divide-y divide-line">
      <li v-for="p in items" :key="p.id" class="flex flex-wrap items-center justify-between gap-3 py-3">
        <div>
          <p class="font-semibold">{{ p.label }}</p>
          <p class="text-sm text-ink-500">{{ p.payload.lines.length }} producto(s) · {{ formatDateTime(p.createdAt) }}</p>
        </div>
        <span class="flex gap-2">
          <BaseButton size="sm" variant="ghost" :disabled="busy" @click="emit('discard', p)">Descartar</BaseButton>
          <BaseButton size="sm" variant="accent" :disabled="busy" @click="emit('resume', p)">Recuperar</BaseButton>
        </span>
      </li>
      <li v-if="!items.length" class="py-6 text-center text-sm text-ink-500">No hay ventas suspendidas en esta caja.</li>
    </ul>
    <template #footer>
      <BaseButton variant="secondary" @click="emit('close')">Cerrar</BaseButton>
    </template>
  </BaseModal>
</template>
