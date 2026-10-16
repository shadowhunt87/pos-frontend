<script setup lang="ts">
import { Pencil, Plus, Sparkles } from 'lucide-vue-next';
import { computed, onMounted, ref } from 'vue';
import * as admin from '@/api/admin';
import { errorMessage } from '@/api/errors';
import BaseButton from '@/components/BaseButton.vue';
import BaseModal from '@/components/BaseModal.vue';
import ErrorAlert from '@/components/ErrorAlert.vue';
import LoadingState from '@/components/LoadingState.vue';
import PageHeader from '@/components/PageHeader.vue';
import StatusBadge from '@/components/StatusBadge.vue';
import { useToastStore } from '@/stores/toast';
import type { Account, BankAccount, CashRegister, Partner, PosSettings, PosTerminal } from '@/types/api';

const toast = useToastStore();
const NCF = /^[BE]\d{2}$/;

const loading = ref(true);
const loadError = ref<string | null>(null);
const settings = ref<PosSettings | null>(null);
const terminals = ref<PosTerminal[]>([]);
const customers = ref<Partner[]>([]);
const accounts = ref<Account[]>([]);
const banks = ref<BankAccount[]>([]);
const registers = ref<CashRegister[]>([]);

const form = ref({ defaultPartnerId: '', defaultNcfType: 'B02', fiscalCreditNcfType: 'B01', maxDiscountPct: '10', cashOverShortAccountId: '', receiptFooter: '' });
const saving = ref(false);
const saveError = ref<string | null>(null);
const preparing = ref(false);

const editing = ref<{ id: string | null; code: string; name: string; cashRegisterId: string; cardBankAccountId: string; transferBankAccountId: string; active: boolean } | null>(null);
const terminalBusy = ref(false);
const terminalError = ref<string | null>(null);


const overShortAccounts = computed(() => accounts.value.filter((a) => a.active && a.isPostable && (a.type === 'EXPENSE' || a.type === 'INCOME')));
const activeRegisters = computed(() => registers.value.filter((r) => r.active));
const activeBanks = computed(() => banks.value.filter((b) => b.active));
const formErrors = computed(() => {
  const f = form.value;
  if (!f.defaultPartnerId) return 'Elige el cliente de las ventas sin cliente.';
  if (!NCF.test(f.defaultNcfType.trim().toUpperCase()) || !NCF.test(f.fiscalCreditNcfType.trim().toUpperCase())) return 'Los comprobantes son una letra B o E y dos números (B02, E32…).';
  const pct = Number(f.maxDiscountPct);
  if (!/^\d+(\.\d{1,2})?$/.test(f.maxDiscountPct.trim()) || pct > 100) return 'El descuento sin PIN es un porcentaje de 0 a 100.';
  return null;
});

const registerName = (id: string) => registers.value.find((r) => r.id === id)?.name ?? '—';
const bankName = (id: string | null) => {
  const b = banks.value.find((x) => x.id === id);
  return b ? `${b.bankName} ${b.accountNumber}` : '—';
};

async function load(): Promise<void> {
  loading.value = true;
  loadError.value = null;
  try {
    const [s, t, c, a, b, r] = await Promise.all([
      admin.getSettings(),
      admin.listTerminals(),
      admin.listCustomers(),
      admin.listAccounts(),
      admin.listBankAccounts(),
      admin.listCashRegisters(),
    ]);
    settings.value = s;
    terminals.value = t;
    customers.value = c;
    accounts.value = a;
    banks.value = b;
    registers.value = r;
    if (s) {
      form.value = {
        defaultPartnerId: s.defaultPartnerId,
        defaultNcfType: s.defaultNcfType,
        fiscalCreditNcfType: s.fiscalCreditNcfType,
        maxDiscountPct: String(Number(s.maxDiscountPct)),
        cashOverShortAccountId: s.cashOverShortAccountId ?? '',
        receiptFooter: s.receiptFooter ?? '',
      };
    }
  } catch (e) {
    loadError.value = errorMessage(e);
  } finally {
    loading.value = false;
  }
}

async function prepare(): Promise<void> {
  preparing.value = true;
  try {
    await admin.bootstrapSettings();
    toast.success('Punto de venta preparado', 'Revisa los ajustes y crea al menos una terminal.');
    await load();
  } catch (e) {
    toast.error('No se pudo preparar', errorMessage(e));
  } finally {
    preparing.value = false;
  }
}

async function save(): Promise<void> {
  if (formErrors.value || saving.value) return;
  saving.value = true;
  saveError.value = null;
  const f = form.value;
  try {
    await admin.updateSettings({
      defaultPartnerId: f.defaultPartnerId,
      defaultNcfType: f.defaultNcfType.trim().toUpperCase(),
      fiscalCreditNcfType: f.fiscalCreditNcfType.trim().toUpperCase(),
      maxDiscountPct: Number(f.maxDiscountPct),
      cashOverShortAccountId: f.cashOverShortAccountId || null,
      receiptFooter: f.receiptFooter.trim() || null,
    });
    toast.success('Ajustes guardados');
    await load();
  } catch (e) {
    saveError.value = errorMessage(e);
  } finally {
    saving.value = false;
  }
}

function editTerminal(t: PosTerminal | null): void {
  terminalError.value = null;
  editing.value = t
    ? { id: t.id, code: t.code, name: t.name, cashRegisterId: t.cashRegisterId, cardBankAccountId: t.cardBankAccountId ?? '', transferBankAccountId: t.transferBankAccountId ?? '', active: t.active }
    : { id: null, code: '', name: '', cashRegisterId: '', cardBankAccountId: '', transferBankAccountId: '', active: true };
}

const terminalValid = computed(() => {
  const t = editing.value;
  return !!t && /^[A-Za-z0-9._-]{1,20}$/.test(t.code.trim()) && !!t.name.trim() && !!t.cashRegisterId;
});

async function saveTerminal(): Promise<void> {
  const t = editing.value;
  if (!t || !terminalValid.value || terminalBusy.value) return;
  terminalBusy.value = true;
  terminalError.value = null;
  try {
    if (t.id) {
      await admin.updateTerminal(t.id, {
        name: t.name.trim(),
        cashRegisterId: t.cashRegisterId,
        cardBankAccountId: t.cardBankAccountId || null,
        transferBankAccountId: t.transferBankAccountId || null,
        active: t.active,
      });
    } else {
      await admin.createTerminal({
        code: t.code.trim(),
        name: t.name.trim(),
        cashRegisterId: t.cashRegisterId,
        ...(t.cardBankAccountId ? { cardBankAccountId: t.cardBankAccountId } : {}),
        ...(t.transferBankAccountId ? { transferBankAccountId: t.transferBankAccountId } : {}),
      });
    }
    toast.success('Terminal guardada');
    editing.value = null;
    terminals.value = await admin.listTerminals();
  } catch (e) {
    terminalError.value = errorMessage(e);
  } finally {
    terminalBusy.value = false;
  }
}


onMounted(load);
</script>

<template>
  <div>
    <PageHeader title="Configuración" subtitle="Cómo vende la caja: cliente por defecto, comprobantes, descuentos permitidos y terminales." />

    <LoadingState v-if="loading" variant="detail" />
    <ErrorAlert v-else-if="loadError" :message="loadError" retry @retry="load" />

    <div v-else class="space-y-6">
      <!-- Preparar -->
      <section v-if="!settings" class="card">
        <div class="flex items-start gap-3">
          <span class="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700"><Sparkles class="size-5" aria-hidden="true" /></span>
          <div class="flex-1">
            <h2 class="card-title">Preparar el punto de venta</h2>
            <p class="mt-1 text-sm text-ink-500">
              Crea el cliente «Consumidor final» y los ajustes por defecto (B02 para consumo, B01 para crédito fiscal y 10 % de descuento sin PIN). Después
              puedes cambiarlos.
            </p>
            <BaseButton class="mt-4" variant="accent" :loading="preparing" @click="prepare">Preparar</BaseButton>
          </div>
        </div>
      </section>

      <!-- Ajustes -->
      <section v-else class="card">
        <h2 class="card-title">Ajustes de la caja</h2>
        <form class="mt-5 grid gap-4 sm:grid-cols-2" novalidate @submit.prevent="save">
          <div class="sm:col-span-2">
            <label for="cfg-partner" class="label">Cliente de las ventas sin cliente</label>
            <select id="cfg-partner" v-model="form.defaultPartnerId" class="input">
              <option value="">Elige…</option>
              <option v-for="c in customers" :key="c.id" :value="c.id">{{ c.name }}{{ c.taxId ? ` · ${c.taxId}` : '' }}</option>
            </select>
          </div>
          <div>
            <label for="cfg-ncf" class="label">Comprobante por defecto</label>
            <input id="cfg-ncf" v-model="form.defaultNcfType" class="input font-mono uppercase" maxlength="3" />
            <p class="hint">B02 (consumo) o E32 si emites e-CF.</p>
          </div>
          <div>
            <label for="cfg-ncf-fiscal" class="label">Comprobante de crédito fiscal</label>
            <input id="cfg-ncf-fiscal" v-model="form.fiscalCreditNcfType" class="input font-mono uppercase" maxlength="3" />
            <p class="hint">B01 o E31: para clientes con RNC que lo piden.</p>
          </div>
          <div>
            <label for="cfg-discount" class="label">Descuento sin PIN (%)</label>
            <input id="cfg-discount" v-model="form.maxDiscountPct" class="input num" inputmode="decimal" />
            <p class="hint">Un descuento manual mayor a este porcentaje de la línea pide el PIN de un supervisor.</p>
          </div>
          <div>
            <label for="cfg-overshort" class="label">Sobrantes y faltantes de caja</label>
            <select id="cfg-overshort" v-model="form.cashOverShortAccountId" class="input">
              <option value="">Sin definir</option>
              <option v-for="a in overShortAccounts" :key="a.id" :value="a.id">{{ a.code }} · {{ a.name }}</option>
            </select>
            <p class="hint">Cuenta donde va la diferencia entre lo contado y lo esperado al cerrar un turno.</p>
          </div>
          <div class="sm:col-span-2">
            <label for="cfg-footer" class="label">Pie del ticket</label>
            <input id="cfg-footer" v-model="form.receiptFooter" class="input" maxlength="300" placeholder="Gracias por su compra" />
          </div>
          <div class="sm:col-span-2"><ErrorAlert :message="saveError ?? formErrors" /></div>
          <div class="sm:col-span-2">
            <BaseButton type="submit" variant="accent" :loading="saving" :disabled="!!formErrors">Guardar ajustes</BaseButton>
          </div>
        </form>
      </section>

      <!-- Terminales -->
      <section v-if="settings" class="card p-0 sm:p-0">
        <div class="flex items-center justify-between gap-3 border-b border-line px-5 py-4 sm:px-6">
          <div>
            <h2 class="card-title">Terminales</h2>
            <p class="text-sm text-ink-500">Cada caja física es una terminal con su gaveta.</p>
          </div>
          <BaseButton size="sm" variant="secondary" :icon="Plus" @click="editTerminal(null)">Nueva terminal</BaseButton>
        </div>
        <div class="overflow-x-auto">
          <table class="table-base">
            <thead>
              <tr><th>Código</th><th>Nombre</th><th>Efectivo</th><th>Tarjeta</th><th>Transferencia</th><th>Estado</th><th><span class="sr-only">Acciones</span></th></tr>
            </thead>
            <tbody>
              <tr v-for="t in terminals" :key="t.id">
                <td class="font-mono whitespace-nowrap">{{ t.code }}</td>
                <td class="font-medium">{{ t.name }}</td>
                <td>{{ registerName(t.cashRegisterId) }}</td>
                <td>{{ bankName(t.cardBankAccountId) }}</td>
                <td>{{ bankName(t.transferBankAccountId) }}</td>
                <td><StatusBadge :tone="t.active ? 'success' : 'neutral'">{{ t.active ? 'Activa' : 'Inactiva' }}</StatusBadge></td>
                <td class="text-right">
                  <BaseButton size="sm" variant="ghost" :icon="Pencil" @click="editTerminal(t)">Editar</BaseButton>
                </td>
              </tr>
              <tr v-if="!terminals.length">
                <td colspan="7" class="py-8 text-center text-ink-500">Crea al menos una terminal para poder vender.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

    </div>

    <BaseModal :open="!!editing" :title="editing?.id ? 'Editar terminal' : 'Nueva terminal'" size="lg" @close="editing = null">
      <form v-if="editing" id="terminal-form" class="grid gap-4 sm:grid-cols-3" novalidate @submit.prevent="saveTerminal">
        <div>
          <label for="t-code" class="label">Código</label>
          <input id="t-code" v-model="editing.code" class="input font-mono" maxlength="20" placeholder="CAJA-01" :disabled="!!editing.id" />
        </div>
        <div class="sm:col-span-2">
          <label for="t-name" class="label">Nombre</label>
          <input id="t-name" v-model="editing.name" class="input" maxlength="100" placeholder="Caja del mostrador" />
        </div>
        <div class="sm:col-span-3">
          <label for="t-register" class="label">Caja donde entra el efectivo</label>
          <select id="t-register" v-model="editing.cashRegisterId" class="input">
            <option value="">Elige…</option>
            <option v-for="r in activeRegisters" :key="r.id" :value="r.id">{{ r.name }}{{ r.glAccountId ? '' : ' (sin cuenta contable)' }}</option>
          </select>
          <p class="hint">Las cajas se crean en el sistema financiero, en «Bancos y caja», y deben tener cuenta contable.</p>
        </div>
        <div class="sm:col-span-3 grid gap-4 sm:grid-cols-2">
          <div>
            <label for="t-card" class="label">Banco de las tarjetas</label>
            <select id="t-card" v-model="editing.cardBankAccountId" class="input">
              <option value="">No acepta tarjeta</option>
              <option v-for="b in activeBanks" :key="b.id" :value="b.id">{{ b.bankName }} {{ b.accountNumber }}</option>
            </select>
          </div>
          <div>
            <label for="t-transfer" class="label">Banco de las transferencias</label>
            <select id="t-transfer" v-model="editing.transferBankAccountId" class="input">
              <option value="">No acepta transferencia</option>
              <option v-for="b in activeBanks" :key="b.id" :value="b.id">{{ b.bankName }} {{ b.accountNumber }}</option>
            </select>
          </div>
        </div>
        <label v-if="editing.id" class="flex items-center gap-2 text-sm sm:col-span-3">
          <input v-model="editing.active" type="checkbox" class="size-4 accent-[var(--brand-600)]" /> Activa
        </label>
        <div class="sm:col-span-3"><ErrorAlert :message="terminalError" /></div>
      </form>
      <template #footer>
        <BaseButton variant="secondary" @click="editing = null">Cancelar</BaseButton>
        <BaseButton type="submit" form="terminal-form" variant="accent" :loading="terminalBusy" :disabled="!terminalValid">Guardar</BaseButton>
      </template>
    </BaseModal>
  </div>
</template>
