<script setup lang="ts">
import { computed } from 'vue';
import BaseButton from '@/components/BaseButton.vue';

const props = defineProps<{ page: number; limit: number; total: number; busy?: boolean }>();
const emit = defineEmits<{ go: [page: number] }>();
const pages = computed(() => Math.max(1, Math.ceil(props.total / props.limit)));
</script>

<template>
  <nav v-if="pages > 1" class="mt-4 flex flex-wrap items-center justify-end gap-2" aria-label="Páginas">
    <span class="mr-auto text-sm text-ink-500">{{ total }} en total</span>
    <BaseButton size="sm" variant="secondary" :disabled="page <= 1 || busy" @click="emit('go', page - 1)">Anterior</BaseButton>
    <span class="text-sm text-ink-500">Página {{ page }} de {{ pages }}</span>
    <BaseButton size="sm" variant="secondary" :disabled="page >= pages || busy" @click="emit('go', page + 1)">Siguiente</BaseButton>
  </nav>
</template>
