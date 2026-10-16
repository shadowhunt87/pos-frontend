<script setup lang="ts">
import {
  ArrowLeftRight, Banknote, CircleCheck, LayoutDashboard, LogOut, Minus, PauseCircle, Plus, Printer, ReceiptText, RotateCw, Search,
  ShoppingCart, Tag, Trash2, UserRound, Wallet,
} from 'lucide-vue-next';
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { ApiError, errorMessage } from '@/api/errors';
import * as pos from '@/api/pos';
import BaseButton from '@/components/BaseButton.vue';
import BrandMark from '@/components/BrandMark.vue';
import ErrorAlert from '@/components/ErrorAlert.vue';
import ApprovalModal from '@/components/caja/ApprovalModal.vue';
import CashModal, { type CashSubmit } from '@/components/caja/CashModal.vue';
import CloseShiftModal from '@/components/caja/CloseShiftModal.vue';
import CustomerModal from '@/components/caja/CustomerModal.vue';
import ParkedModal from '@/components/caja/ParkedModal.vue';
import PayModal, { type PayConfirm } from '@/components/caja/PayModal.vue';
import SalesModal, { type ReturnIntent, type VoidIntent } from '@/components/caja/SalesModal.vue';
import { anyModalOpen } from '@/composables/modalStack';
import { useApproval } from '@/composables/useApproval';
import { useAuthStore } from '@/stores/auth';
import { useToastStore } from '@/stores/toast';
import type { CloseShiftRequest, ParkedSale, PosCatalog, PosContext, PosCustomer, PosProduct, PosSale, PosShift } from '@/types/api';
import { formatMoney, formatNumber, formatTime } from '@/utils/format';
import { priceWithTax, quoteCart, sumQuote, type CartItem } from '@/utils/pricing';
import { readStorage, writeStorage } from '@/utils/storage';
import { printTicket } from '@/utils/ticket';
import { newClientUuid } from '@/utils/uuid';

const TERMINAL_KEY = 'pos.terminalId';
const AUTOPRINT_KEY = 'pos.autoPrint';

const auth = useAuthStore();
const toast = useToastStore();
const approval = useApproval();

// ---------------- Estado ----------------
const loading = ref(true);
const fatal = ref<string | null>(null);
const ctx = ref<PosContext | null>(null);
const catalog = ref<PosCatalog | null>(null);
const terminalId = ref<string | null>(readStorage(TERMINAL_KEY));
const shift = ref<PosShift | null>(null);
const openingCash = ref('0');
const opening = ref(false);
const openError = ref<string | null>(null);

const cart = ref<CartItem[]>([]);
const customer = ref<{ id: string; name: string; taxId: string | null; defaultNcfType: string | null } | null>(null);
const ncfType = ref<string | null>(null);
const query = ref('');
const categoryId = ref<string | null>(null);
const editingDiscount = ref<string | null>(null);
const lastSale = ref<PosSale | null>(null);
const autoPrint = ref(readStorage(AUTOPRINT_KEY) === '1');
const mobileView = ref<'products' | 'cart'>('products');
const searchBox = ref<HTMLInputElement | null>(null);
const busy = ref(false);
// Mismo id en los reintentos del cobro: el servidor no cobra dos veces
let checkoutId: string | null = null;

// Ventanas
const payOpen = ref(false);
const payError = ref<string | null>(null);
const customerOpen = ref(false);
const parkedOpen = ref(false);
const parkedItems = ref<ParkedSale[]>([]);
const cashOpen = ref(false);
const cashError = ref<string | null>(null);
const salesOpen = ref(false);
const salesError = ref<string | null>(null);
const salesRefresh = ref(0);
const closing = ref<PosShift | null>(null);
const closeResult = ref<PosShift | null>(null);
const closeError = ref<string | null>(null);

// ---------------- Derivados ----------------
const terminal = computed(() => ctx.value?.terminals.find((t) => t.id === terminalId.value) ?? null);
const settings = computed(() => catalog.value?.settings ?? null);
const productById = computed(() => new Map((catalog.value?.products ?? []).map((p) => [p.id, p])));
const visibleProducts = computed(() => {
  const q = query.value.trim().toLowerCase();
  const cat = categoryId.value;
  return (catalog.value?.products ?? [])
    .filter((p) => (!cat || p.categoryId === cat) && (!q || p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q) || p.barcodes.some((b) => b.toLowerCase().includes(q))))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'es'))
    .slice(0, 120);
});
const lines = computed(() => quoteCart(cart.value, productById.value, catalog.value?.promotions ?? [], new Date()));
const totals = computed(() => sumQuote(lines.value));
const ncfOptions = computed(() => {
  const s = settings.value;
  return [...new Set([s?.defaultNcfType, s?.fiscalCreditNcfType, customer.value?.defaultNcfType].filter((x): x is string => !!x))];
});
const isDefaultCustomer = computed(() => !customer.value || customer.value.id === settings.value?.defaultPartner?.id);

// ---------------- Arranque ----------------
async function init(): Promise<void> {
  loading.value = true;
  fatal.value = null;
  try {
    const c = await pos.getContext();
    ctx.value = c;
    if (!c.configured) {
      fatal.value = auth.can('configurar')
        ? 'El punto de venta no está configurado. Complétalo en «Administración › Configuración».'
        : 'El punto de venta no está configurado. Pide a un administrador que lo configure.';
      return;
    }
    if (!c.terminals.length) {
      fatal.value = 'No hay cajas (terminales) activas. Un administrador debe crear una en «Administración › Configuración».';
      return;
    }
    if (!c.terminals.some((t) => t.id === terminalId.value)) terminalId.value = c.terminals.length === 1 ? c.terminals[0]!.id : null;
    await loadCatalog();
    if (terminalId.value) await loadShift();
  } catch (e) {
    fatal.value = errorMessage(e);
  } finally {
    loading.value = false;
  }
}

async function loadCatalog(): Promise<void> {
  catalog.value = await pos.getCatalog();
  if (!customer.value) resetCustomer();
}

async function loadShift(): Promise<void> {
  shift.value = terminalId.value ? await pos.getCurrentShift(terminalId.value) : null;
}

async function chooseTerminal(id: string): Promise<void> {
  terminalId.value = id;
  writeStorage(TERMINAL_KEY, id);
  try {
    await loadShift();
  } catch (e) {
    toast.error('No se pudo leer el turno', errorMessage(e));
  }
}

async function openShift(): Promise<void> {
  const t = terminalId.value;
  if (!t || opening.value) return;
  const cash = openingCash.value.trim() || '0';
  if (!/^\d+(\.\d{1,2})?$/.test(cash)) {
    openError.value = 'Escribe el fondo con hasta 2 decimales (0 si empiezas sin cambio).';
    return;
  }
  opening.value = true;
  openError.value = null;
  try {
    shift.value = await pos.openShift(t, Number(cash));
    toast.success('Turno abierto', '¡Buenas ventas!');
    focusSearch();
  } catch (e) {
    openError.value = errorMessage(e);
  } finally {
    opening.value = false;
  }
}

// ---------------- Carrito ----------------
function add(p: PosProduct, qty = 1): void {
  lastSale.value = null;
  const i = cart.value.findIndex((x) => x.productId === p.id);
  cart.value = i >= 0 ? cart.value.map((x, k) => (k === i ? { ...x, quantity: x.quantity + qty } : x)) : [...cart.value, { productId: p.id, quantity: qty, discount: 0 }];
  if (p.tracksInventory) {
    const inCart = cart.value.find((x) => x.productId === p.id)?.quantity ?? 0;
    if (inCart > Number(p.stockQty)) toast.info(`Solo hay ${formatNumber(p.stockQty)} ${p.unit} de ${p.name}`);
  }
}

function setQty(productId: string, value: number | string): void {
  const n = Number(value);
  const qty = Number.isFinite(n) ? Math.max(0, Math.round(n * 10_000) / 10_000) : 0;
  cart.value = qty === 0 ? cart.value.filter((x) => x.productId !== productId) : cart.value.map((x) => (x.productId === productId ? { ...x, quantity: qty } : x));
}

function setDiscount(productId: string, value: string): void {
  const n = Number(value);
  const discount = Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : 0;
  cart.value = cart.value.map((x) => (x.productId === productId ? { ...x, discount } : x));
}

function resetCustomer(): void {
  const d = settings.value?.defaultPartner;
  customer.value = d ? { id: d.id, name: d.name, taxId: null, defaultNcfType: null } : null;
  ncfType.value = settings.value?.defaultNcfType ?? null;
}

function clearSale(): void {
  cart.value = [];
  editingDiscount.value = null;
  resetCustomer();
  focusSearch();
}

function pickCustomer(c: PosCustomer): void {
  customer.value = { id: c.id, name: c.name, taxId: c.taxId, defaultNcfType: c.defaultNcfType };
  ncfType.value = c.defaultNcfType ?? (c.taxId ? settings.value?.fiscalCreditNcfType ?? null : settings.value?.defaultNcfType ?? null);
  customerOpen.value = false;
}

function pickDefaultCustomer(): void {
  resetCustomer();
  customerOpen.value = false;
}

/** Enter en la búsqueda: código de barras o código exacto, o el único resultado. */
function onSearchEnter(): void {
  const q = query.value.trim();
  if (!q) return;
  const ps = catalog.value?.products ?? [];
  const exact = ps.find((p) => p.barcodes.includes(q) || p.code.toLowerCase() === q.toLowerCase());
  const one = exact ?? (visibleProducts.value.length === 1 ? visibleProducts.value[0] : undefined);
  if (one) {
    add(one);
    query.value = '';
  } else if (!visibleProducts.value.length) {
    toast.info(`No hay un producto con «${q}»`);
  }
}

function focusSearch(): void {
  void nextTick(() => searchBox.value?.focus());
}

// ---------------- Cobrar ----------------
function startPay(): void {
  if (!lines.value.length || !shift.value) return;
  checkoutId = newClientUuid();
  payError.value = null;
  payOpen.value = true;
}

async function pay(ev: PayConfirm): Promise<void> {
  const s = shift.value;
  if (!s || busy.value) return;
  busy.value = true;
  payError.value = null;
  const body = {
    clientUuid: checkoutId ?? newClientUuid(),
    shiftId: s.id,
    ...(customer.value ? { partnerId: customer.value.id } : {}),
    ...(ncfType.value ? { ncfType: ncfType.value } : {}),
    lines: cart.value.map((i) => ({ productId: i.productId, quantity: i.quantity, ...(i.discount ? { discount: i.discount } : {}) })),
    payments: ev.payments,
    expectedTotal: Number(totals.value.total.toFixed(2)),
    ...(ev.allowCredit ? { allowCredit: true } : {}),
  };
  try {
    const sale = await approval.run((approvalId) => pos.createSale({ ...body, ...(approvalId ? { approvalId } : {}) }));
    if (sale) {
      payOpen.value = false;
      lastSale.value = sale;
      cart.value = [];
      editingDiscount.value = null;
      resetCustomer();
      checkoutId = null;
      mobileView.value = 'cart';
      if (autoPrint.value) await print(sale.id);
      void refreshAfterSale();
    }
  } catch (e) {
    // El total cambió en el servidor (precio o promoción): se recarga el catálogo para que el carrito muestre lo nuevo
    if (e instanceof ApiError && e.code === 'TOTAL_MISMATCH') await loadCatalog().catch(() => undefined);
    payError.value = errorMessage(e);
  } finally {
    busy.value = false;
  }
}

async function refreshAfterSale(): Promise<void> {
  await Promise.all([loadCatalog(), loadShift()]).catch(() => undefined);
}

async function print(saleId: string): Promise<void> {
  try {
    if (!printTicket(await pos.getTicket(saleId))) toast.error('No se abrió el ticket', 'El navegador bloqueó la ventana: permite las ventanas emergentes para esta página.');
  } catch (e) {
    toast.error('No se pudo imprimir', errorMessage(e));
  }
}

function toggleAutoPrint(): void {
  autoPrint.value = !autoPrint.value;
  writeStorage(AUTOPRINT_KEY, autoPrint.value ? '1' : '0');
}

function newSale(): void {
  lastSale.value = null;
  mobileView.value = 'products';
  focusSearch();
}

// ---------------- Suspender y recuperar ----------------
async function park(): Promise<void> {
  const t = terminalId.value;
  if (!t || !cart.value.length || busy.value) return;
  busy.value = true;
  try {
    await pos.parkSale(t, `${customer.value?.name ?? 'Venta'} · ${formatTime(new Date().toISOString())}`, {
      lines: cart.value.map((i) => ({ productId: i.productId, quantity: String(i.quantity), discount: String(i.discount) })),
      partnerId: customer.value?.id ?? null,
      ncfType: ncfType.value,
    });
    toast.success('Venta suspendida', 'Recupérala con «Suspendidas» (F10).');
    clearSale();
  } catch (e) {
    toast.error('No se pudo suspender', errorMessage(e));
  } finally {
    busy.value = false;
  }
}

async function showParked(): Promise<void> {
  const t = terminalId.value;
  if (!t) return;
  try {
    parkedItems.value = await pos.listParked(t);
    parkedOpen.value = true;
  } catch (e) {
    toast.error('No se pudieron leer las suspendidas', errorMessage(e));
  }
}

async function resume(p: ParkedSale): Promise<void> {
  if (cart.value.length) {
    toast.info('Primero cobra, suspende o limpia la venta actual');
    return;
  }
  busy.value = true;
  try {
    const got = await pos.resumeParked(p.id);
    const known = got.payload.lines.filter((l) => productById.value.has(l.productId));
    cart.value = known.map((l) => ({ productId: l.productId, quantity: Number(l.quantity), discount: Number(l.discount) }));
    if (known.length < got.payload.lines.length) toast.info('Algún producto ya no se vende y se quitó de la venta');
    if (got.payload.ncfType) ncfType.value = got.payload.ncfType;
    parkedOpen.value = false;
    lastSale.value = null;
  } catch (e) {
    toast.error('No se pudo recuperar', errorMessage(e));
    parkedItems.value = parkedItems.value.filter((x) => x.id !== p.id);
  } finally {
    busy.value = false;
  }
}

async function discard(p: ParkedSale): Promise<void> {
  try {
    await pos.discardParked(p.id);
    parkedItems.value = parkedItems.value.filter((x) => x.id !== p.id);
  } catch (e) {
    toast.error('No se pudo descartar', errorMessage(e));
  }
}

// ---------------- Efectivo, ventas del turno y cierre ----------------
async function cashSubmit(ev: CashSubmit): Promise<void> {
  const s = shift.value;
  if (!s || busy.value) return;
  busy.value = true;
  cashError.value = null;
  try {
    const ok =
      ev.mode === 'DRAWER'
        ? await approval.run((approvalId) => pos.openDrawer(s.id, { reason: ev.reason, ...(approvalId ? { approvalId } : {}) }))
        : await approval.run((approvalId) =>
            pos.registerMovement(s.id, { type: ev.mode === 'IN' ? 'IN' : 'OUT', amount: ev.amount, reason: ev.reason, accountId: ev.accountId, ...(approvalId ? { approvalId } : {}) }),
          );
    if (ok) {
      cashOpen.value = false;
      toast.success(ev.mode === 'DRAWER' ? 'Gaveta abierta' : 'Movimiento registrado', ev.mode === 'DRAWER' ? 'Quedó anotado en el turno.' : undefined);
      await loadShift();
    }
  } catch (e) {
    cashError.value = errorMessage(e);
  } finally {
    busy.value = false;
  }
}

async function voidSale(v: VoidIntent): Promise<void> {
  if (busy.value) return;
  busy.value = true;
  salesError.value = null;
  try {
    const ok = await approval.run((approvalId) => pos.voidSale(v.sale.id, { reason: v.reason, reasonCode: v.reasonCode, ...(approvalId ? { approvalId } : {}) }));
    if (ok) {
      toast.success(`Venta ${v.sale.number} anulada`);
      salesRefresh.value++;
      void refreshAfterSale();
    }
  } catch (e) {
    salesError.value = errorMessage(e);
  } finally {
    busy.value = false;
  }
}

async function returnSale(r: ReturnIntent): Promise<void> {
  const s = shift.value;
  if (!s || busy.value) return;
  busy.value = true;
  salesError.value = null;
  try {
    const ok = await approval.run((approvalId) =>
      pos.returnSale(r.sale.id, { shiftId: s.id, lines: r.lines, refundMethod: r.refundMethod, reason: r.reason, ...(approvalId ? { approvalId } : {}) }),
    );
    if (ok) {
      const last = ok.returns[ok.returns.length - 1];
      toast.success('Devolución registrada', last ? `Entrega ${formatMoney(last.total)} al cliente.` : undefined);
      salesRefresh.value++;
      void refreshAfterSale();
    }
  } catch (e) {
    salesError.value = errorMessage(e);
  } finally {
    busy.value = false;
  }
}

function startClose(): void {
  if (cart.value.length) {
    toast.info('Primero cobra, suspende o limpia la venta actual');
    return;
  }
  closeResult.value = null;
  closeError.value = null;
  closing.value = shift.value;
}

async function confirmClose(body: CloseShiftRequest): Promise<void> {
  const s = shift.value;
  if (!s || busy.value) return;
  busy.value = true;
  closeError.value = null;
  try {
    closeResult.value = await pos.closeShift(s.id, body);
  } catch (e) {
    closeError.value = errorMessage(e);
  } finally {
    busy.value = false;
  }
}

function closeDone(): void {
  closing.value = null;
  closeResult.value = null;
  shift.value = null;
  lastSale.value = null;
  openingCash.value = '0';
}

function exit(): void {
  auth.logout();
}

// ---------------- Teclado ----------------
function onKey(e: KeyboardEvent): void {
  if (!shift.value || anyModalOpen()) return;
  if (e.key === 'F2') {
    e.preventDefault();
    focusSearch();
  } else if (e.key === 'F9') {
    e.preventDefault();
    void park();
  } else if (e.key === 'F10') {
    e.preventDefault();
    void showParked();
  } else if (e.key === 'F12') {
    e.preventDefault();
    startPay();
  } else if (e.key === 'Enter' && lastSale.value && document.activeElement !== searchBox.value) {
    newSale();
  }
}

onMounted(() => {
  document.addEventListener('keydown', onKey);
  void init();
});
onBeforeUnmount(() => document.removeEventListener('keydown', onKey));
</script>

<template>
  <div class="flex h-dvh flex-col bg-canvas">
    <!-- Barra superior -->
    <header class="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 bg-panel px-4 py-2.5">
      <div class="flex min-w-0 items-center gap-3">
        <BrandMark class="size-8" />
        <div class="min-w-0 leading-tight">
          <p class="truncate font-semibold">Caja<span v-if="terminal"> · {{ terminal.name }}</span></p>
          <p class="truncate text-xs text-ink-400">
            <span v-if="shift">Turno {{ shift.number }} · </span>{{ auth.user?.name }}
          </p>
        </div>
      </div>
      <nav v-if="shift" class="order-last -mx-1 flex w-full items-center gap-1 overflow-x-auto lg:order-none lg:mx-0 lg:w-auto lg:flex-1" aria-label="Acciones de la caja">
        <button type="button" class="caja-act" @click="salesOpen = true"><ReceiptText class="size-4" aria-hidden="true" />Ventas y devoluciones</button>
        <button type="button" class="caja-act" @click="showParked"><PauseCircle class="size-4" aria-hidden="true" />Suspendidas <span class="kbd">F10</span></button>
        <button type="button" class="caja-act" @click="cashOpen = true"><Wallet class="size-4" aria-hidden="true" />Efectivo</button>
        <button type="button" class="caja-act" @click="startClose"><Banknote class="size-4" aria-hidden="true" />Cerrar turno</button>
      </nav>
      <div class="ml-auto flex items-center gap-1">
        <RouterLink v-if="auth.can('supervisar')" :to="{ name: 'admin' }" class="caja-act"><LayoutDashboard class="size-4" aria-hidden="true" />Administración</RouterLink>
        <button type="button" class="caja-act" @click="exit"><LogOut class="size-4" aria-hidden="true" />Salir</button>
      </div>
    </header>

    <!-- Estados previos a vender -->
    <div v-if="loading" class="flex flex-1 items-center justify-center gap-3 text-ink-500" role="status">
      <span class="size-5 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" aria-hidden="true" />
      Preparando la caja…
    </div>

    <div v-else-if="fatal" class="flex flex-1 items-center justify-center p-4">
      <section class="card w-full max-w-md text-center">
        <h1 class="text-lg font-bold">No se puede abrir la caja</h1>
        <p class="mt-2 text-sm text-ink-500">{{ fatal }}</p>
        <div class="mt-5 flex justify-center gap-2">
          <BaseButton variant="secondary" :icon="RotateCw" @click="init">Reintentar</BaseButton>
          <RouterLink v-if="auth.can('configurar')" :to="{ name: 'configuracion' }" class="inline-flex min-h-10 items-center rounded-xl bg-brand-500 px-4 text-sm font-semibold text-white hover:bg-brand-600">
            Ir a configuración
          </RouterLink>
        </div>
      </section>
    </div>

    <div v-else-if="!terminalId" class="flex flex-1 items-center justify-center p-4">
      <section class="card w-full max-w-lg">
        <h1 class="text-lg font-bold">¿Qué caja es esta?</h1>
        <p class="mt-1 text-sm text-ink-500">Elige la terminal. Este equipo la recordará.</p>
        <div class="mt-5 grid gap-3 sm:grid-cols-2">
          <button
            v-for="t in ctx?.terminals ?? []"
            :key="t.id"
            type="button"
            class="flex min-h-20 flex-col items-start justify-center rounded-xl border border-line bg-surface px-4 text-left transition hover:border-brand-500 hover:bg-brand-50"
            @click="chooseTerminal(t.id)"
          >
            <span class="font-semibold">{{ t.name }}</span>
            <span class="font-mono text-xs text-ink-500">{{ t.code }}</span>
          </button>
        </div>
      </section>
    </div>

    <div v-else-if="!shift" class="flex flex-1 items-center justify-center p-4">
      <form class="card w-full max-w-md" novalidate @submit.prevent="openShift">
        <h1 class="text-lg font-bold">Abrir turno</h1>
        <p class="mt-1 text-sm text-ink-500">Cuenta el fondo de cambio con el que empiezas en la gaveta.</p>
        <div class="mt-5">
          <label for="opening-cash" class="label">Fondo inicial (RD$)</label>
          <input id="opening-cash" v-model="openingCash" class="input num text-2xl" inputmode="decimal" autocomplete="off" />
        </div>
        <div class="mt-4"><ErrorAlert :message="openError" /></div>
        <div class="mt-5 flex flex-wrap gap-2">
          <BaseButton type="submit" variant="accent" size="lg" :loading="opening">Abrir turno</BaseButton>
          <BaseButton v-if="(ctx?.terminals.length ?? 0) > 1" variant="secondary" size="lg" :icon="ArrowLeftRight" @click="terminalId = null">Cambiar de caja</BaseButton>
        </div>
      </form>
    </div>

    <!-- Venta -->
    <main v-else class="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_420px]">
      <!-- Catálogo -->
      <section :class="['min-h-0 flex-col', mobileView === 'products' ? 'flex' : 'hidden lg:flex']" aria-label="Productos">
        <div class="shrink-0 space-y-3 border-b border-line bg-surface px-4 py-3">
          <div class="relative">
            <Search class="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-ink-400" aria-hidden="true" />
            <input
              ref="searchBox"
              v-model="query"
              type="search"
              class="input min-h-12 pl-11 text-base"
              placeholder="Buscar o escanear el código (F2)"
              aria-label="Buscar producto o escanear código de barras"
              autocomplete="off"
              @keydown.enter.prevent="onSearchEnter"
            />
          </div>
          <div v-if="catalog?.categories.length" class="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Categorías">
            <button type="button" role="tab" :aria-selected="!categoryId" :class="['caja-chip', !categoryId && 'caja-chip-on']" @click="categoryId = null">Todo</button>
            <button
              v-for="c in catalog.categories"
              :key="c.id"
              type="button"
              role="tab"
              :aria-selected="categoryId === c.id"
              :class="['caja-chip', categoryId === c.id && 'caja-chip-on']"
              @click="categoryId = c.id"
            >
              <span class="size-2.5 rounded-full" :style="{ background: c.color || 'var(--ink-300)' }" aria-hidden="true" />{{ c.name }}
            </button>
          </div>
        </div>
        <div class="min-h-0 flex-1 overflow-y-auto p-4 pb-24 lg:pb-4">
          <div class="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3">
            <button
              v-for="p in visibleProducts"
              :key="p.id"
              type="button"
              :class="[
                'flex min-h-28 flex-col items-start rounded-xl border bg-surface p-3 text-left shadow-card transition hover:border-brand-500 hover:shadow-lift active:scale-[0.98]',
                p.tracksInventory && Number(p.stockQty) <= 0 ? 'border-dashed border-ink-300 opacity-70' : 'border-line',
              ]"
              @click="add(p)"
            >
              <span class="line-clamp-2 text-sm leading-snug font-semibold text-ink-900">{{ p.name }}</span>
              <span class="mt-0.5 font-mono text-[11px] text-ink-400">{{ p.code }}</span>
              <span class="num mt-auto pt-2 text-base font-bold text-ink-950">{{ formatMoney(priceWithTax(p)) }}</span>
              <span v-if="p.tracksInventory" :class="['text-[11px]', Number(p.stockQty) <= 0 ? 'text-danger' : 'text-ink-500']">
                {{ formatNumber(p.stockQty) }} {{ p.unit }}
              </span>
            </button>
          </div>
          <p v-if="!visibleProducts.length" class="py-16 text-center text-sm text-ink-500">
            {{ catalog?.products.length ? 'No hay productos con ese filtro.' : 'La caja no tiene productos. Un administrador los agrega en «Administración › Productos en caja».' }}
          </p>
        </div>
      </section>

      <!-- Venta actual -->
      <section
        :class="['min-h-0 flex-col border-l border-line bg-surface pb-[76px] lg:pb-0', mobileView === 'cart' ? 'flex' : 'hidden lg:flex']"
        aria-label="Venta actual"
      >
        <div class="flex shrink-0 items-end gap-3 border-b border-line px-4 py-3">
          <button type="button" class="min-w-0 flex-1 rounded-xl border border-line px-3 py-2 text-left hover:border-ink-300" @click="customerOpen = true">
            <span class="block text-[11px] font-medium text-ink-500">Cliente</span>
            <span class="flex items-center gap-1.5 truncate font-semibold">
              <UserRound class="size-4 shrink-0 text-ink-400" aria-hidden="true" />{{ customer?.name ?? 'Elegir' }}
            </span>
            <span v-if="customer?.taxId" class="font-mono text-xs text-ink-500">{{ customer.taxId }}</span>
          </button>
          <div class="w-28">
            <label for="ncf-type" class="label">Comprobante</label>
            <select id="ncf-type" v-model="ncfType" class="input py-2">
              <option v-for="t in ncfOptions" :key="t" :value="t">{{ t }}</option>
            </select>
          </div>
        </div>

        <!-- Venta cobrada -->
        <div v-if="lastSale" class="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center" role="status">
          <CircleCheck class="size-14 text-success" aria-hidden="true" />
          <h2 class="text-xl font-bold">Venta cobrada</h2>
          <p class="text-sm text-ink-500">Ticket {{ lastSale.number }} · NCF {{ lastSale.ncf ?? 'pendiente' }}</p>
          <div v-if="Number(lastSale.changeGiven) > 0" class="w-full rounded-2xl bg-success-soft px-5 py-4 text-success-strong">
            <p class="text-sm font-medium">Cambio</p>
            <p class="num text-4xl font-bold" data-test="change">{{ formatMoney(lastSale.changeGiven) }}</p>
          </div>
          <p v-else class="num text-2xl font-bold">{{ formatMoney(lastSale.total) }}</p>
          <div class="mt-2 flex flex-wrap justify-center gap-2">
            <BaseButton variant="secondary" :icon="Printer" @click="print(lastSale.id)">Imprimir ticket</BaseButton>
            <BaseButton variant="accent" @click="newSale">Nueva venta <span class="kbd">Enter</span></BaseButton>
          </div>
          <label class="mt-1 flex items-center gap-2 text-sm text-ink-600">
            <input type="checkbox" :checked="autoPrint" class="size-4 accent-[var(--brand-600)]" @change="toggleAutoPrint" />
            Imprimir siempre al cobrar
          </label>
        </div>

        <template v-else>
          <ul class="min-h-0 flex-1 divide-y divide-line overflow-y-auto">
            <li v-for="l in lines" :key="l.item.productId" class="px-4 py-3">
              <div class="flex items-start justify-between gap-3">
                <span class="text-sm font-semibold">{{ l.product.name }}</span>
                <strong class="num">{{ formatMoney(l.total.toFixed(2)) }}</strong>
              </div>
              <div class="mt-2 flex flex-wrap items-center gap-2">
                <span class="inline-flex items-center rounded-lg border border-line">
                  <button type="button" class="p-2 text-ink-600 hover:bg-ink-100" :aria-label="`Quitar uno de ${l.product.name}`" @click="setQty(l.item.productId, l.item.quantity - 1)">
                    <Minus class="size-4" />
                  </button>
                  <input
                    :value="l.item.quantity"
                    class="num w-14 border-x border-line bg-transparent py-1.5 text-center text-sm focus:outline-none"
                    inputmode="decimal"
                    :aria-label="`Cantidad de ${l.product.name}`"
                    @change="setQty(l.item.productId, ($event.target as HTMLInputElement).value)"
                  />
                  <button type="button" class="p-2 text-ink-600 hover:bg-ink-100" :aria-label="`Agregar uno de ${l.product.name}`" @click="setQty(l.item.productId, l.item.quantity + 1)">
                    <Plus class="size-4" />
                  </button>
                </span>
                <span class="text-xs text-ink-500">× {{ formatMoney(priceWithTax(l.product)) }}</span>
                <span class="ml-auto flex gap-1">
                  <button type="button" class="rounded-md px-2 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-50" @click="editingDiscount = editingDiscount === l.item.productId ? null : l.item.productId">
                    Descuento
                  </button>
                  <button type="button" class="rounded-md p-1.5 text-ink-400 hover:bg-danger-soft hover:text-danger" :aria-label="`Quitar ${l.product.name}`" @click="setQty(l.item.productId, 0)">
                    <Trash2 class="size-4" />
                  </button>
                </span>
              </div>
              <p v-if="l.promoName" class="mt-1.5 flex items-center gap-1 text-xs font-medium text-success">
                <Tag class="size-3.5" aria-hidden="true" />{{ l.promoName }} · −{{ formatMoney(l.promo.toFixed(2)) }}
              </p>
              <div v-if="editingDiscount === l.item.productId" class="mt-2">
                <label :for="`disc-${l.item.productId}`" class="label">Descuento en RD$ (sin ITBIS)</label>
                <input
                  :id="`disc-${l.item.productId}`"
                  :value="l.item.discount || ''"
                  class="input num py-2"
                  inputmode="decimal"
                  placeholder="0.00"
                  @change="setDiscount(l.item.productId, ($event.target as HTMLInputElement).value)"
                />
                <p class="hint">Si pasa del {{ settings?.maxDiscountPct ?? '' }} % de la línea, se pedirá el PIN de un supervisor al cobrar.</p>
              </div>
              <p v-else-if="l.discount.gt(0)" class="mt-1.5 text-xs text-ink-500">Descuento · −{{ formatMoney(l.discount.toFixed(2)) }}</p>
            </li>
            <li v-if="!lines.length" class="flex flex-col items-center gap-2 px-6 py-16 text-center text-ink-500">
              <ShoppingCart class="size-10 text-ink-300" aria-hidden="true" />
              <p class="text-sm">Toca un producto o escanea su código para empezar.</p>
            </li>
          </ul>

          <div class="shrink-0 space-y-1 border-t border-line px-4 py-3 text-sm">
            <div class="flex justify-between text-ink-500"><span>Subtotal (sin ITBIS)</span><span class="num">{{ formatMoney(totals.subtotal.toFixed(2)) }}</span></div>
            <div v-if="totals.promo.plus(totals.discount).gt(0)" class="flex justify-between text-success">
              <span>Ahorro</span><span class="num">−{{ formatMoney(totals.promo.plus(totals.discount).toFixed(2)) }}</span>
            </div>
            <div class="flex justify-between text-ink-500"><span>ITBIS</span><span class="num">{{ formatMoney(totals.tax.toFixed(2)) }}</span></div>
            <div class="flex items-baseline justify-between pt-1">
              <span class="text-base font-semibold">Total</span>
              <strong class="num text-3xl font-bold" data-test="cart-total">{{ formatMoney(totals.total.toFixed(2)) }}</strong>
            </div>
          </div>
          <div class="shrink-0 space-y-2 px-4 pb-4">
            <BaseButton variant="accent" size="lg" block :disabled="!lines.length" @click="startPay">Cobrar <span class="kbd">F12</span></BaseButton>
            <div class="grid grid-cols-2 gap-2">
              <BaseButton variant="secondary" :disabled="!lines.length || busy" @click="park">Suspender <span class="kbd">F9</span></BaseButton>
              <BaseButton variant="ghost" :disabled="!lines.length" @click="clearSale">Limpiar</BaseButton>
            </div>
          </div>
        </template>
      </section>

      <!-- Celular: alternar productos y venta -->
      <div class="fixed inset-x-0 bottom-0 z-30 flex gap-2 border-t border-line bg-surface/95 p-3 backdrop-blur lg:hidden">
        <BaseButton v-if="mobileView === 'cart'" variant="secondary" size="lg" block @click="mobileView = 'products'">Ver productos</BaseButton>
        <BaseButton v-else variant="accent" size="lg" block :icon="ShoppingCart" @click="mobileView = 'cart'">
          Venta ({{ formatNumber(totals.items) }}) · {{ formatMoney(totals.total.toFixed(2)) }}
        </BaseButton>
      </div>
    </main>

    <PayModal :open="payOpen" :total="totals.total.toFixed(2)" :can-credit="!isDefaultCustomer" :busy="busy" :error="payError" @confirm="pay" @close="payOpen = false" />
    <CustomerModal
      :open="customerOpen"
      :default-name="settings?.defaultPartner?.name ?? null"
      :fiscal-credit-ncf="settings?.fiscalCreditNcfType ?? 'B01'"
      @pick="pickCustomer"
      @pick-default="pickDefaultCustomer"
      @close="customerOpen = false"
    />
    <ParkedModal :open="parkedOpen" :items="parkedItems" :busy="busy" @resume="resume" @discard="discard" @close="parkedOpen = false" />
    <CashModal :open="cashOpen" :terminal-id="terminalId" :busy="busy" :error="cashError" @submit="cashSubmit" @close="cashOpen = false; cashError = null" />
    <SalesModal
      :open="salesOpen"
      :shift-id="shift?.id ?? null"
      :busy="busy"
      :error="salesError"
      :refresh-key="salesRefresh"
      @print="print"
      @void="voidSale"
      @return="returnSale"
      @close="salesOpen = false; salesError = null"
    />
    <CloseShiftModal :shift="closing" :result="closeResult" :busy="busy" :error="closeError" @confirm="confirmClose" @close="closing = null" @done="closeDone" />
    <!-- Va al final: se abre encima de cobro, ventas o efectivo, y con el mismo z-index manda el orden en el DOM -->
    <ApprovalModal :action="approval.action.value" @approved="approval.settle" @close="approval.settle(null)" />
  </div>
</template>

<style scoped>
@reference '../style.css';

.caja-act {
  @apply inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg px-3 text-[13px] font-semibold whitespace-nowrap text-ink-300 transition hover:bg-white/10 hover:text-white;
}
.caja-chip {
  @apply inline-flex min-h-9 shrink-0 items-center gap-2 rounded-full border border-line bg-surface px-3.5 text-sm font-medium text-ink-700 transition hover:border-ink-300;
}
.caja-chip-on {
  @apply border-brand-500 bg-brand-50 text-brand-800;
}
</style>
