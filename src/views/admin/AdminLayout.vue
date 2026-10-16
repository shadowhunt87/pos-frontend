<script setup lang="ts">
import { BarChart3, Clock, KeyRound, LogOut, Package, Settings, ShoppingCart, Tag } from 'lucide-vue-next';
import { computed, ref, type Component } from 'vue';
import BrandMark from '@/components/BrandMark.vue';
import PinModal from '@/components/PinModal.vue';
import { useAuthStore } from '@/stores/auth';
import { ROLE_LABEL, type Permission } from '@/utils/permissions';

const auth = useAuthStore();

interface NavItem {
  to: string;
  label: string;
  icon: Component;
  permission: Permission;
}

const ITEMS: NavItem[] = [
  { to: '/admin/turnos', label: 'Turnos de caja', icon: Clock, permission: 'supervisar' },
  { to: '/admin/reportes', label: 'Ventas', icon: BarChart3, permission: 'supervisar' },
  { to: '/admin/productos', label: 'Productos en caja', icon: Package, permission: 'configurar' },
  { to: '/admin/promociones', label: 'Promociones', icon: Tag, permission: 'configurar' },
  { to: '/admin/configuracion', label: 'Configuración', icon: Settings, permission: 'configurar' },
];

const items = computed(() => ITEMS.filter((i) => auth.can(i.permission)));
const pinOpen = ref(false);
</script>

<template>
  <div class="min-h-dvh bg-canvas lg:grid lg:grid-cols-[248px_1fr]">
    <aside class="bg-panel lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col">
      <div class="flex items-center gap-3 px-5 py-4">
        <BrandMark class="size-9" />
        <div class="leading-tight">
          <p class="font-bold">Sirtech POS</p>
          <p class="text-xs text-ink-400">Administración</p>
        </div>
      </div>
      <nav class="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-1 lg:flex-col lg:overflow-visible" aria-label="Menú">
        <RouterLink
          to="/caja"
          class="mb-2 inline-flex shrink-0 items-center gap-2.5 rounded-xl bg-brand-500 px-3.5 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 lg:mb-3"
        >
          <ShoppingCart class="size-4" aria-hidden="true" />Abrir la caja
        </RouterLink>
        <RouterLink
          v-for="i in items"
          :key="i.to"
          :to="i.to"
          class="inline-flex shrink-0 items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-sm font-medium text-ink-300 transition hover:bg-white/10 hover:text-white"
          active-class="!bg-white/12 !text-white"
        >
          <component :is="i.icon" class="size-4" aria-hidden="true" />{{ i.label }}
        </RouterLink>
      </nav>
      <div class="hidden border-t border-white/10 px-5 py-4 lg:block">
        <p class="truncate text-sm font-semibold">{{ auth.user?.name }}</p>
        <p class="text-xs text-ink-400">{{ auth.role ? ROLE_LABEL[auth.role] : '' }}</p>
        <div class="mt-3 flex flex-col items-start gap-2">
          <button type="button" class="inline-flex items-center gap-2 text-sm font-medium text-ink-300 hover:text-white" @click="pinOpen = true">
            <KeyRound class="size-4" aria-hidden="true" />Mi PIN de supervisor
          </button>
          <button type="button" class="inline-flex items-center gap-2 text-sm font-medium text-ink-300 hover:text-white" @click="auth.logout()">
            <LogOut class="size-4" aria-hidden="true" />Salir
          </button>
        </div>
      </div>
    </aside>
    <div class="min-w-0">
      <div class="flex items-center justify-end gap-3 border-b border-line bg-surface px-4 py-2 lg:hidden">
        <span class="mr-auto truncate text-sm text-ink-600">{{ auth.user?.name }}</span>
        <button type="button" class="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-700" @click="pinOpen = true">
          <KeyRound class="size-4" aria-hidden="true" />Mi PIN
        </button>
        <button type="button" class="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-700" @click="auth.logout()">
          <LogOut class="size-4" aria-hidden="true" />Salir
        </button>
      </div>
      <main class="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:py-8">
        <RouterView v-slot="{ Component: view }">
          <Transition name="page" mode="out-in"><component :is="view" /></Transition>
        </RouterView>
      </main>
    </div>
    <PinModal :open="pinOpen" @close="pinOpen = false" />
  </div>
</template>
