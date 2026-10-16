<script setup lang="ts">
import { Inbox } from 'lucide-vue-next';
import type { Component } from 'vue';

withDefaults(defineProps<{ text: string; title?: string; icon?: Component }>(), { title: undefined, icon: () => Inbox });
</script>

<template>
  <div class="flex flex-col items-center rounded-2xl border border-dashed border-ink-200 bg-surface/60 px-6 py-14 text-center">
    <span class="mb-4 inline-flex size-12 items-center justify-center rounded-2xl bg-ink-100 text-ink-500 ring-8 ring-ink-50">
      <component :is="icon" class="size-6" aria-hidden="true" />
    </span>
    <p v-if="title" class="font-display text-base font-bold text-ink-900">{{ title }}</p>
    <p :class="['max-w-sm text-sm text-ink-500', title ? 'mt-1' : '']">{{ text }}</p>
    <div v-if="$slots.default" class="mt-5"><slot /></div>
  </div>
</template>
