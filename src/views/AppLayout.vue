<script setup lang="ts">
import {
  BarChart3, BookOpen, Boxes, Clock, ExternalLink, FileText, House, KeyRound, LogOut, Menu, Package, Settings, ShoppingCart, Tag, Truck,
  UserCog, Users, Warehouse, X,
} from 'lucide-vue-next';
import { computed, ref, watch, type Component } from 'vue';
import { useRoute } from 'vue-router';
import BrandMark from '@/components/BrandMark.vue';
import PinModal from '@/components/PinModal.vue';
import { useAuthStore } from '@/stores/auth';
import { FINANCE_URL } from '@/utils/finance';
import { ROLE_LABEL, type Permission } from '@/utils/permissions';

const auth = useAuthStore();
const route = useRoute();

interface NavItem {
  to: string;
  label: string;
  icon: Component;
  permission: Permission;
}
interface NavGroup {
  title: string;
  items: NavItem[];
}

// Cada rol ve solo sus áreas (el backend también lo exige)
const GROUPS: NavGroup[] = [
  { title: '', items: [{ to: '/inicio', label: 'Inicio', icon: House, permission: 'supervisar' }] },
  {
    title: 'Vender',
    items: [
      { to: '/caja', label: 'Caja', icon: ShoppingCart, permission: 'caja' },
      { to: '/facturas', label: 'Facturas', icon: FileText, permission: 'facturas' },
      { to: '/clientes', label: 'Clientes', icon: Users, permission: 'facturas' },
    ],
  },
  {
    title: 'Almacén',
    items: [
      { to: '/productos', label: 'Productos', icon: Package, permission: 'catalogo' },
      { to: '/inventario', label: 'Inventario', icon: Warehouse, permission: 'catalogo' },
      { to: '/compras', label: 'Compras', icon: Boxes, permission: 'inventario' },
      { to: '/proveedores', label: 'Proveedores', icon: Truck, permission: 'inventario' },
    ],
  },
  {
    title: 'Supervisión',
    items: [
      { to: '/turnos', label: 'Turnos de caja', icon: Clock, permission: 'supervisar' },
      { to: '/reportes', label: 'Ventas de caja', icon: BarChart3, permission: 'supervisar' },
    ],
  },
  {
    title: 'Administración',
    items: [
      { to: '/promociones', label: 'Promociones', icon: Tag, permission: 'configurar' },
      { to: '/configuracion', label: 'Configuración', icon: Settings, permission: 'configurar' },
      { to: '/usuarios', label: 'Usuarios', icon: UserCog, permission: 'usuarios' },
      { to: '/contabilidad', label: 'Contabilidad', icon: BookOpen, permission: 'contabilidad' },
    ],
  },
];

const groups = computed(() => GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => auth.can(i.permission)) })).filter((g) => g.items.length));
const pinOpen = ref(false);
const menuOpen = ref(false);
watch(() => route.fullPath, () => (menuOpen.value = false));
</script>

<template>
  <div class="min-h-dvh bg-canvas lg:grid lg:grid-cols-[256px_1fr]">
    <!-- Barra superior en celular y tablet vertical -->
    <div class="sticky top-0 z-30 flex items-center gap-3 bg-panel px-4 py-2.5 lg:hidden">
      <button type="button" class="rounded-lg p-2 text-ink-300 hover:bg-white/10" :aria-label="menuOpen ? 'Cerrar menú' : 'Abrir menú'" @click="menuOpen = !menuOpen">
        <component :is="menuOpen ? X : Menu" class="size-5" />
      </button>
      <BrandMark class="size-7" />
      <p class="font-semibold">Sirtech POS</p>
    </div>

    <aside
      :class="[
        'bg-panel lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col',
        menuOpen ? 'fixed inset-x-0 top-[52px] bottom-0 z-30 flex flex-col overflow-y-auto' : 'hidden',
      ]"
    >
      <div class="hidden items-center gap-3 px-5 py-4 lg:flex">
        <BrandMark class="size-9" />
        <div class="leading-tight">
          <p class="font-bold">Sirtech POS</p>
          <p class="text-xs text-ink-400">Punto de venta</p>
        </div>
      </div>
      <nav class="flex-1 space-y-4 overflow-y-auto px-3 py-3" aria-label="Menú">
        <div v-for="g in groups" :key="g.title">
          <p v-if="g.title" class="px-3.5 pb-1.5 text-[11px] font-semibold tracking-[0.1em] text-ink-500 uppercase">{{ g.title }}</p>
          <RouterLink
            v-for="i in g.items"
            :key="i.to"
            :to="i.to"
            :class="[
              'flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-sm font-medium transition',
              i.to === '/caja' ? 'bg-brand-500 font-semibold text-white hover:bg-brand-600' : 'text-ink-300 hover:bg-white/10 hover:text-white',
            ]"
            active-class="!bg-white/12 !text-white"
          >
            <component :is="i.icon" class="size-4" aria-hidden="true" />{{ i.label }}
          </RouterLink>
        </div>
        <a
          v-if="auth.can('contabilidad')"
          :href="FINANCE_URL"
          target="_blank"
          rel="noopener"
          class="flex items-center gap-2.5 rounded-xl border border-white/10 px-3.5 py-2.5 text-sm font-medium text-ink-300 hover:bg-white/10 hover:text-white"
        >
          <ExternalLink class="size-4" aria-hidden="true" />Abrir el sistema contable
        </a>
      </nav>
      <div class="border-t border-white/10 px-5 py-4">
        <p class="truncate text-sm font-semibold">{{ auth.user?.name }}</p>
        <p class="text-xs text-ink-400">{{ auth.role ? ROLE_LABEL[auth.role] : '' }}</p>
        <div class="mt-3 flex flex-col items-start gap-2">
          <button v-if="auth.can('supervisar')" type="button" class="inline-flex items-center gap-2 text-sm font-medium text-ink-300 hover:text-white" @click="pinOpen = true">
            <KeyRound class="size-4" aria-hidden="true" />Mi PIN de supervisor
          </button>
          <button type="button" class="inline-flex items-center gap-2 text-sm font-medium text-ink-300 hover:text-white" @click="auth.logout()">
            <LogOut class="size-4" aria-hidden="true" />Salir
          </button>
        </div>
      </div>
    </aside>

    <div class="min-w-0">
      <main class="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:py-8">
        <RouterView v-slot="{ Component: page }">
          <Transition name="page" mode="out-in"><component :is="page" :key="route.path" /></Transition>
        </RouterView>
      </main>
    </div>
    <PinModal :open="pinOpen" @close="pinOpen = false" />
  </div>
</template>
