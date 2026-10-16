<script setup lang="ts">
import { computed, type Component } from 'vue';

const props = withDefaults(
  defineProps<{
    variant?: 'primary' | 'accent' | 'secondary' | 'danger' | 'success' | 'ghost';
    type?: 'button' | 'submit';
    size?: 'sm' | 'md' | 'lg';
    icon?: Component;
    iconRight?: Component;
    loading?: boolean;
    disabled?: boolean;
    block?: boolean;
  }>(),
  { variant: 'primary', type: 'button', size: 'md', icon: undefined, iconRight: undefined, loading: false, disabled: false, block: false },
);

const VARIANTS = {
  primary: 'bg-ink-900 text-surface shadow-[0_1px_0_rgb(255_255_255/0.08)_inset,0_1px_2px_rgb(13_16_21/0.3)] hover:bg-ink-800 active:bg-panel',
  accent: 'bg-brand-500 text-white shadow-[0_1px_0_rgb(255_255_255/0.2)_inset,0_1px_2px_rgb(185_71_10/0.4)] hover:bg-brand-600 active:bg-brand-700',
  secondary: 'border border-ink-200 bg-surface text-ink-800 shadow-[0_1px_1px_rgb(22_26_33/0.04)] hover:border-ink-300 hover:bg-ink-50',
  danger: 'bg-danger text-white shadow-sm hover:bg-danger-strong',
  success: 'bg-success text-white shadow-[0_1px_0_rgb(255_255_255/0.15)_inset,0_1px_2px_rgb(4_120_87/0.35)] hover:bg-success-strong',
  ghost: 'text-ink-700 hover:bg-ink-100 hover:text-ink-900',
} as const;

const SIZES = {
  sm: 'min-h-8 gap-1.5 rounded-lg px-3 text-[13px]',
  md: 'min-h-10 gap-2 rounded-xl px-4 text-sm',
  lg: 'min-h-12 gap-2.5 rounded-xl px-5 text-[15px]',
} as const;

const iconSize = computed(() => (props.size === 'lg' ? 'size-5' : 'size-4'));

const classes = computed(() => [
  'inline-flex select-none items-center justify-center font-semibold whitespace-nowrap transition duration-150',
  'active:translate-y-px disabled:pointer-events-none disabled:opacity-50',
  SIZES[props.size],
  props.block ? 'w-full' : '',
  VARIANTS[props.variant],
]);
</script>

<template>
  <button :type="type" :class="classes" :disabled="disabled || loading" :aria-busy="loading">
    <span
      v-if="loading"
      :class="[iconSize, 'animate-spin rounded-full border-2 border-current border-t-transparent opacity-80']"
      aria-hidden="true"
    />
    <component :is="icon" v-else-if="icon" :class="iconSize" aria-hidden="true" />
    <slot />
    <component :is="iconRight" v-if="iconRight" :class="iconSize" aria-hidden="true" />
  </button>
</template>
