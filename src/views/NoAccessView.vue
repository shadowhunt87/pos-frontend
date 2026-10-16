<script setup lang="ts">
import { Lock } from 'lucide-vue-next';
import BaseButton from '@/components/BaseButton.vue';
import EmptyState from '@/components/EmptyState.vue';
import { useAuthStore } from '@/stores/auth';
import { ROLE_LABEL } from '@/utils/permissions';

const auth = useAuthStore();
</script>

<template>
  <main class="flex min-h-dvh items-center justify-center bg-canvas px-4">
    <EmptyState
      :icon="Lock"
      title="Tu usuario no usa el punto de venta"
      :text="`Entraste como ${auth.user?.name ?? ''} (${auth.role ? ROLE_LABEL[auth.role] : ''}). La caja es para cajeros, supervisores, contadores y administradores. Pide a un administrador que te dé el rol que corresponde.`"
    >
      <BaseButton variant="secondary" @click="auth.logout()">Salir</BaseButton>
    </EmptyState>
  </main>
</template>
