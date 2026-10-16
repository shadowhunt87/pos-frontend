<script setup lang="ts">
// Estado con punto de color y texto (nunca solo color).
withDefaults(defineProps<{ tone?: 'success' | 'warning' | 'danger' | 'info' | 'neutral' }>(), { tone: 'neutral' });

const TONES = {
  success: 'bg-success-soft text-success-strong',
  warning: 'bg-warning-soft text-warning-strong',
  danger: 'bg-danger-soft text-danger-strong',
  info: 'bg-info-soft text-info-strong',
  neutral: 'bg-ink-100 text-ink-700',
} as const;
const DOTS = { success: 'bg-success', warning: 'bg-warning', danger: 'bg-danger', info: 'bg-info', neutral: 'bg-ink-400' } as const;
</script>

<template>
  <span :class="['inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap', TONES[tone]]">
    <span :class="['size-1.5 rounded-full', DOTS[tone]]" aria-hidden="true" />
    <slot />
  </span>
</template>
