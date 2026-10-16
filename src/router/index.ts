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

const view = {
  inicio: () => import('@/views/HomeView.vue'),
  facturas: () => import('@/views/store/InvoicesView.vue'),
  nuevaFactura: () => import('@/views/store/InvoiceFormView.vue'),
  factura: () => import('@/views/store/InvoiceDetailView.vue'),
  clientes: () => import('@/views/store/PartnersView.vue'),
  cliente: () => import('@/views/store/CustomerDetailView.vue'),
  productos: () => import('@/views/store/ProductsView.vue'),
  inventario: () => import('@/views/store/InventoryView.vue'),
  kardex: () => import('@/views/store/KardexView.vue'),
  compras: () => import('@/views/store/PurchasesView.vue'),
  nuevaCompra: () => import('@/views/store/PurchaseFormView.vue'),
};

export const routes: RouteRecordRaw[] = [
  { path: '/login', name: 'login', component: () => import('@/views/LoginView.vue'), meta: { public: true, title: 'Entrar' } },
  { path: '/caja', name: 'caja', component: () => import('@/views/CajaView.vue'), meta: { permission: 'caja', title: 'Caja' } },
  {
    path: '/',
    component: () => import('@/views/AppLayout.vue'),
    children: [
      { path: '', name: 'home', redirect: () => homeFor(useAuthStore()) },
      { path: 'inicio', name: 'inicio', component: view.inicio, meta: { permission: 'catalogo', title: 'Inicio' } },
      // Vender
      { path: 'facturas', name: 'facturas', component: view.facturas, meta: { permission: 'facturas', title: 'Facturas' } },
      { path: 'facturas/nueva', name: 'nueva-factura', component: view.nuevaFactura, meta: { permission: 'vender', title: 'Nueva factura' } },
      { path: 'facturas/:id', name: 'factura', component: view.factura, props: true, meta: { permission: 'facturas', title: 'Factura' } },
      { path: 'clientes', name: 'clientes', component: view.clientes, props: { kind: 'customers' }, meta: { permission: 'facturas', title: 'Clientes' } },
      { path: 'clientes/:id', name: 'cliente', component: view.cliente, props: true, meta: { permission: 'facturas', title: 'Cliente' } },
      // Almacén
      { path: 'productos', name: 'productos', component: view.productos, meta: { permission: 'catalogo', title: 'Productos' } },
      { path: 'inventario', name: 'inventario', component: view.inventario, meta: { permission: 'catalogo', title: 'Inventario' } },
      { path: 'inventario/:id', name: 'kardex', component: view.kardex, props: true, meta: { permission: 'inventario', title: 'Kárdex' } },
      { path: 'compras', name: 'compras', component: view.compras, meta: { permission: 'inventario', title: 'Compras' } },
      { path: 'compras/nueva', name: 'nueva-compra', component: view.nuevaCompra, meta: { permission: 'editarInventario', title: 'Nueva compra' } },
      { path: 'compras/:id', name: 'compra', component: view.factura, props: true, meta: { permission: 'inventario', title: 'Compra' } },
      { path: 'proveedores', name: 'proveedores', component: view.clientes, props: { kind: 'suppliers' }, meta: { permission: 'inventario', title: 'Proveedores' } },
      // Supervisión y administración
      { path: 'turnos', name: 'turnos', component: () => import('@/views/admin/ShiftsView.vue'), meta: { permission: 'supervisar', title: 'Turnos de caja' } },
      { path: 'turnos/:id', name: 'turno', component: () => import('@/views/admin/ShiftDetailView.vue'), props: true, meta: { permission: 'supervisar', title: 'Turno' } },
      { path: 'reportes', name: 'reportes', component: () => import('@/views/admin/ReportsView.vue'), meta: { permission: 'supervisar', title: 'Ventas de caja' } },
      { path: 'promociones', name: 'promociones', component: () => import('@/views/admin/PromotionsView.vue'), meta: { permission: 'configurar', title: 'Promociones' } },
      { path: 'configuracion', name: 'configuracion', component: () => import('@/views/admin/ConfigView.vue'), meta: { permission: 'configurar', title: 'Configuración' } },
      { path: 'usuarios', name: 'usuarios', component: () => import('@/views/admin/UsersView.vue'), meta: { permission: 'usuarios', title: 'Usuarios' } },
      { path: 'contabilidad', name: 'contabilidad', component: () => import('@/views/AccountingView.vue'), meta: { permission: 'contabilidad', title: 'Contabilidad' } },
    ],
  },
  // Rutas de la primera versión
  { path: '/admin/:rest(.*)*', redirect: (to) => `/${Array.isArray(to.params.rest) ? to.params.rest.join('/') : ''}` },
  { path: '/sin-acceso', name: 'sin-acceso', component: () => import('@/views/NoAccessView.vue'), meta: { title: 'Sin acceso' } },
  { path: '/:pathMatch(.*)*', name: 'not-found', component: () => import('@/views/NotFoundView.vue'), meta: { public: true, title: 'No encontrada' } },
];

/** Adónde va cada rol al entrar: el cajero a la caja, el vendedor a facturas, almacén a inventario y el resto al inicio. */
export function homeFor(auth: ReturnType<typeof useAuthStore>): RouteLocationRaw {
  switch (auth.role) {
    case 'CASHIER':
      return { name: 'caja' };
    case 'SELLER':
      return { name: 'facturas' };
    case 'WAREHOUSE':
      return { name: 'inventario' };
    default:
      return auth.can('catalogo') ? { name: 'inicio' } : { name: 'sin-acceso' };
  }
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
  if (to.name === 'sin-acceso') return true;
  // Consulta y auditor no usan el punto de venta
  if (!auth.can('catalogo')) return { name: 'sin-acceso' };
  const needed = to.matched.map((r) => r.meta.permission).filter((p) => p !== undefined);
  if (needed.some((p) => !auth.can(p))) return homeFor(auth);
  return true;
});

router.afterEach((to) => {
  document.title = to.meta.title ? `${to.meta.title} · Sirtech POS` : 'Sirtech POS';
});

export default router;
