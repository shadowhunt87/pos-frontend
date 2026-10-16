<script setup lang="ts">
import { ArrowLeft } from 'lucide-vue-next';
import type { RouteLocationRaw } from 'vue-router';

defineProps<{ title: string; subtitle?: string; eyebrow?: string; back?: { to: RouteLocationRaw; label: string } }>();
</script>

<template>
  <header class="mb-7 flex flex-wrap items-end justify-between gap-4">
    <div class="min-w-0">
      <RouterLink
        v-if="back"
        :to="back.to"
        class="group mb-3 inline-flex items-center gap-1.5 text-[13px] font-semibold text-ink-500 hover:text-ink-900"
      >
        <ArrowLeft class="size-4 transition group-hover:-translate-x-0.5" aria-hidden="true" />
        {{ back.label }}
      </RouterLink>
      <p v-if="eyebrow" class="eyebrow mb-1.5">{{ eyebrow }}</p>
      <h1 class="text-[26px] leading-tight font-extrabold text-ink-950 sm:text-[28px]">
        <slot name="title">{{ title }}</slot>
      </h1>
      <p v-if="subtitle || $slots.subtitle" class="mt-1.5 text-[15px] text-ink-500">
        <slot name="subtitle">{{ subtitle }}</slot>
      </p>
    </div>
    <div v-if="$slots.actions" class="flex flex-wrap items-center gap-2"><slot name="actions" /></div>
  </header>
</template>
