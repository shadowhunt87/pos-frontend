<script setup lang="ts">
import { CircleAlert, RotateCw } from 'lucide-vue-next';

defineProps<{ message: string | null; retry?: boolean }>();
defineEmits<{ retry: [] }>();
</script>

<template>
  <div
    v-if="message"
    class="flex items-start gap-3 rounded-xl border border-danger-soft bg-danger-soft/80 px-4 py-3 text-sm text-danger-strong"
    role="alert"
  >
    <CircleAlert class="mt-0.5 size-4 shrink-0 text-danger" aria-hidden="true" />
    <p class="min-w-0 flex-1 whitespace-pre-line">{{ message }}</p>
    <button
      v-if="retry"
      type="button"
      class="-my-1 inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1 text-[13px] font-semibold text-danger-strong hover:bg-danger-soft"
      @click="$emit('retry')"
    >
      <RotateCw class="size-3.5" aria-hidden="true" />
      Reintentar
    </button>
  </div>
</template>
