import { createRouter, createWebHistory, type RouteLocationRaw, type RouteRecordRaw } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import type { Permission } from '@/utils/permissions';

declare module 'vue-router' {
  interface RouteMeta {
    public?: boolean;
    permission?: Permission;
    title?: string;
  }
}

export const routes: RouteRecordRaw[] = [
  { path: '/login', name: 'login', component: () => import('@/views/LoginView.vue'), meta: { public: true, title: 'Entrar' } },
  { path: '/', name: 'home', redirect: { name: 'caja' } },
  { path: '/caja', name: 'caja', component: () => import('@/views/CajaView.vue'), meta: { permission: 'caja', title: 'Caja' } },
  {
    path: '/admin',
    component: () => import('@/views/admin/AdminLayout.vue'),
    children: [
      { path: '', name: 'admin', redirect: { name: 'turnos' } },
      { path: 'configuracion', name: 'configuracion', component: () => import('@/views/admin/ConfigView.vue'), meta: { permission: 'configurar', title: 'Configuración' } },
      { path: 'productos', name: 'productos', component: () => import('@/views/admin/ProductsView.vue'), meta: { permission: 'configurar', title: 'Productos en caja' } },
      { path: 'promociones', name: 'promociones', component: () => import('@/views/admin/PromotionsView.vue'), meta: { permission: 'configurar', title: 'Promociones' } },
      { path: 'turnos', name: 'turnos', component: () => import('@/views/admin/ShiftsView.vue'), meta: { permission: 'supervisar', title: 'Turnos de caja' } },
      { path: 'turnos/:id', name: 'turno', component: () => import('@/views/admin/ShiftDetailView.vue'), props: true, meta: { permission: 'supervisar', title: 'Turno' } },
      { path: 'reportes', name: 'reportes', component: () => import('@/views/admin/ReportsView.vue'), meta: { permission: 'supervisar', title: 'Ventas' } },
    ],
  },
  { path: '/sin-acceso', name: 'sin-acceso', component: () => import('@/views/NoAccessView.vue'), meta: { title: 'Sin acceso' } },
  { path: '/:pathMatch(.*)*', name: 'not-found', component: () => import('@/views/NotFoundView.vue'), meta: { public: true, title: 'No encontrada' } },
];

/** Adónde va cada rol al entrar: a la caja quien la opera; si no, a ninguna parte del POS. */
export function homeFor(auth: ReturnType<typeof useAuthStore>): RouteLocationRaw {
  return auth.can('caja') ? { name: 'caja' } : { name: 'sin-acceso' };
}

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
});

router.beforeEach((to) => {
  const auth = useAuthStore();
  if (to.meta.public) {
    if (to.name === 'login' && auth.isAuthenticated) return homeFor(auth);
    return true;
  }
  if (!auth.isAuthenticated) {
    return { name: 'login', query: to.fullPath !== '/' ? { redirect: to.fullPath } : {} };
  }
  // Las rutas hijas heredan el permiso que declaren; la primera que lo pida manda
  const needed = to.matched.map((r) => r.meta.permission).find((p) => p !== undefined);
  if (needed && !auth.can(needed)) return to.name === 'caja' ? { name: 'sin-acceso' } : homeFor(auth);
  return true;
});

router.afterEach((to) => {
  document.title = to.meta.title ? `${to.meta.title} · Sirtech POS` : 'Sirtech POS';
});

export default router;
