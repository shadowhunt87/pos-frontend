<script setup lang="ts">
import { X } from 'lucide-vue-next';
import { nextTick, onBeforeUnmount, ref, useId, watch } from 'vue';
import { isTopModal, popModal, pushModal } from '@/composables/modalStack';

const props = withDefaults(defineProps<{ open: boolean; title: string; description?: string; size?: 'md' | 'lg' | 'xl' }>(), {
  description: undefined,
  size: 'md',
});
const emit = defineEmits<{ close: [] }>();

const titleId = useId();
const panel = ref<HTMLElement | null>(null);
let previousFocus: HTMLElement | null = null;
const stackId = Symbol('modal');

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape' && isTopModal(stackId)) {
    event.stopPropagation();
    emit('close');
  }
}

watch(
  () => props.open,
  async (open) => {
    if (open) {
      previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      pushModal(stackId);
      document.addEventListener('keydown', onKeydown);
      await nextTick();
      const target = panel.value?.querySelector<HTMLElement>('[data-autofocus], input, select, textarea');
      (target ?? panel.value)?.focus();
    } else {
      popModal(stackId);
      document.removeEventListener('keydown', onKeydown);
      previousFocus?.focus();
    }
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  popModal(stackId);
  document.removeEventListener('keydown', onKeydown);
});
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0"
      leave-active-class="transition duration-150 ease-in"
      leave-to-class="opacity-0"
    >
      <div
        v-if="open"
        class="fixed inset-0 z-50 flex items-end justify-center bg-scrim backdrop-blur-[2px] sm:items-center sm:p-6"
        @click.self="emit('close')"
      >
        <div
          ref="panel"
          role="dialog"
          aria-modal="true"
          :aria-labelledby="titleId"
          tabindex="-1"
          :class="[
            'max-h-[92vh] w-full animate-fade-up overflow-y-auto rounded-t-3xl bg-surface shadow-pop outline-none sm:rounded-3xl',
            size === 'xl' ? 'sm:max-w-3xl' : size === 'lg' ? 'sm:max-w-2xl' : 'sm:max-w-lg',
          ]"
        >
          <div class="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-line bg-surface/95 px-6 py-5 backdrop-blur">
            <div>
              <h2 :id="titleId" class="text-lg font-bold text-ink-950">{{ title }}</h2>
              <p v-if="description" class="mt-0.5 text-sm text-ink-500">{{ description }}</p>
            </div>
            <button
              type="button"
              class="-mt-1 -mr-2 rounded-lg p-2 text-ink-400 transition hover:bg-ink-100 hover:text-ink-900"
              aria-label="Cerrar"
              @click="emit('close')"
            >
              <X class="size-5" />
            </button>
          </div>
          <div class="px-6 py-5"><slot /></div>
          <div
            v-if="$slots.footer"
            class="sticky bottom-0 flex flex-wrap items-center justify-end gap-2 border-t border-line bg-surface/95 px-6 py-4 backdrop-blur"
          >
            <slot name="footer" />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
