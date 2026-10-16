<script setup lang="ts">
import { CircleAlert, CircleCheck, Info, X } from 'lucide-vue-next';
import { useToastStore } from '@/stores/toast';

const store = useToastStore();
const ICONS = { success: CircleCheck, error: CircleAlert, info: Info } as const;
const TONES = { success: 'text-success', error: 'text-danger', info: 'text-info' } as const;
</script>

<template>
  <div
    class="pointer-events-none fixed inset-x-0 top-3 z-[60] flex flex-col items-center gap-2 px-4 sm:inset-x-auto sm:top-auto sm:right-5 sm:bottom-5 sm:items-end"
    aria-live="polite"
  >
    <TransitionGroup
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0 translate-y-2 scale-95"
      leave-active-class="transition duration-200 ease-in"
      leave-to-class="opacity-0 scale-95"
    >
      <div
        v-for="t in store.toasts"
        :key="t.id"
        class="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl bg-ink-900 px-4 py-3.5 text-surface shadow-pop ring-1 ring-white/10"
        :role="t.tone === 'error' ? 'alert' : 'status'"
      >
        <component :is="ICONS[t.tone]" :class="['mt-0.5 size-5 shrink-0', TONES[t.tone]]" aria-hidden="true" />
        <div class="min-w-0 flex-1">
          <p class="text-sm font-semibold">{{ t.title }}</p>
          <p v-if="t.message" class="mt-0.5 text-[13px] whitespace-pre-line text-ink-300">{{ t.message }}</p>
        </div>
        <button type="button" class="-mr-1 rounded-md p-1 text-ink-400 hover:bg-surface/10 hover:text-white" aria-label="Cerrar aviso" @click="store.dismiss(t.id)">
          <X class="size-4" />
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>
