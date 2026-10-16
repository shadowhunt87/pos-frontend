<script setup lang="ts">
import EmptyState from '@/components/EmptyState.vue';
import { SearchX } from 'lucide-vue-next';
</script>

<template>
  <main class="flex min-h-dvh items-center justify-center bg-canvas px-4">
    <EmptyState :icon="SearchX" title="Esta página no existe" text="Revisa la dirección o vuelve a la caja.">
      <RouterLink to="/" class="link">Ir a la caja</RouterLink>
    </EmptyState>
  </main>
</template>
