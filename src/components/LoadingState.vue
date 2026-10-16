<script setup lang="ts">
// Esqueletos con la forma del contenido que viene, para que la carga no "salte".
withDefaults(defineProps<{ text?: string; variant?: 'inline' | 'cards' | 'table' | 'detail' | 'board' }>(), {
  text: 'Cargando…',
  variant: 'inline',
});
</script>

<template>
  <div role="status" :aria-label="text">
    <span class="sr-only">{{ text }}</span>

    <div v-if="variant === 'inline'" class="flex items-center justify-center gap-3 py-12 text-sm text-ink-500">
      <span class="size-5 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" aria-hidden="true" />
      <span aria-hidden="true">{{ text }}</span>
    </div>

    <div v-else-if="variant === 'cards'" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-hidden="true">
      <div v-for="i in 4" :key="i" class="card space-y-3">
        <div class="skeleton h-3 w-20" />
        <div class="skeleton h-7 w-32" />
      </div>
    </div>

    <div v-else-if="variant === 'table'" class="card space-y-4 p-0 sm:p-0" aria-hidden="true">
      <div class="border-b border-line px-5 py-4"><div class="skeleton h-3 w-40" /></div>
      <div v-for="i in 6" :key="i" class="flex items-center gap-4 px-5 pb-4">
        <div class="skeleton h-4 w-28" />
        <div class="skeleton h-4 flex-1" />
        <div class="skeleton h-4 w-20" />
      </div>
    </div>

    <div v-else-if="variant === 'board'" class="flex gap-4 overflow-hidden" aria-hidden="true">
      <div v-for="i in 4" :key="i" class="w-72 shrink-0 space-y-3 rounded-2xl bg-ink-100/60 p-3">
        <div class="skeleton h-4 w-28 bg-ink-200/70" />
        <div v-for="j in 3 - (i % 2)" :key="j" class="space-y-3 rounded-xl bg-surface p-4 shadow-card">
          <div class="skeleton h-6 w-24" />
          <div class="skeleton h-3 w-36" />
          <div class="skeleton h-3 w-20" />
        </div>
      </div>
    </div>

    <div v-else class="grid gap-6 lg:grid-cols-3" aria-hidden="true">
      <div class="space-y-6 lg:col-span-2">
        <div class="skeleton h-8 w-64" />
        <div class="grid gap-4 sm:grid-cols-2">
          <div class="card space-y-3"><div class="skeleton h-3 w-16" /><div class="skeleton h-5 w-40" /><div class="skeleton h-3 w-28" /></div>
          <div class="card space-y-3"><div class="skeleton h-3 w-16" /><div class="skeleton h-5 w-40" /><div class="skeleton h-3 w-28" /></div>
        </div>
        <div class="card space-y-3"><div v-for="i in 4" :key="i" class="skeleton h-4 w-full" /></div>
      </div>
      <div class="card h-64 space-y-3"><div class="skeleton h-4 w-32" /><div class="skeleton h-10 w-full" /></div>
    </div>
  </div>
</template>
