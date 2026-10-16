<script setup lang="ts">
import { watch } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import ToastHost from '@/components/ToastHost.vue';

const auth = useAuthStore();
const router = useRouter();

// Al terminar la sesión (401, expiración o salida manual) se vuelve al login.
watch(
  () => auth.isAuthenticated,
  (authenticated) => {
    if (authenticated) return;
    const current = router.currentRoute.value;
    if (current.meta.public) return;
    const query: Record<string, string> = {};
    if (auth.endReason === 'expired') {
      query.expired = '1';
      query.redirect = current.fullPath;
    }
    void router.replace({ name: 'login', query });
  },
);
</script>

<template>
  <RouterView />
  <ToastHost />
</template>
