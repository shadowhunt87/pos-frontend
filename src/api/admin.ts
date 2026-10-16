import { http } from './client';
import type {
  Account, BankAccount, CashRegister, CategoryRequest, CreateTerminalRequest, Page, Partner, PosCategory, PosPromotion, PosSettings,
  PosShift, PosTerminal, ProductSettingRequest, ProductSettingRow, PromotionRequest, SalesReport, ShiftRow, UpdateSettingsRequest,
  UpdateTerminalRequest,
} from '@/types/api';

// Administración del POS (administrador y contador; turnos y reportes, también el aprobador).

// ---------------- Ajustes ----------------
export async function getSettings(): Promise<PosSettings | null> {
  const { data } = await http.get<PosSettings | '' | null>('/pos/settings');
  return data ? data : null;
}

export async function updateSettings(body: UpdateSettingsRequest): Promise<PosSettings> {
  return (await http.put<PosSettings>('/pos/settings', body)).data;
}

/** «Preparar»: crea el cliente «Consumidor final» y los ajustes por defecto. */
export async function bootstrapSettings(): Promise<PosSettings> {
  return (await http.post<PosSettings>('/pos/settings/bootstrap', {})).data;
}

export async function setPin(pin: string): Promise<{ ok: true }> {
  return (await http.put<{ ok: true }>('/pos/pin', { pin })).data;
}

// ---------------- Terminales ----------------
export async function listTerminals(): Promise<PosTerminal[]> {
  return (await http.get<PosTerminal[]>('/pos/terminals')).data;
}

export async function createTerminal(body: CreateTerminalRequest): Promise<PosTerminal> {
  return (await http.post<PosTerminal>('/pos/terminals', body)).data;
}

export async function updateTerminal(id: string, body: UpdateTerminalRequest): Promise<PosTerminal> {
  return (await http.patch<PosTerminal>(`/pos/terminals/${id}`, body)).data;
}

// ---------------- Categorías y productos en caja ----------------
export async function listCategories(): Promise<PosCategory[]> {
  return (await http.get<PosCategory[]>('/pos/categories')).data;
}

export async function createCategory(body: CategoryRequest): Promise<PosCategory> {
  return (await http.post<PosCategory>('/pos/categories', body)).data;
}

export async function updateCategory(id: string, body: CategoryRequest): Promise<PosCategory> {
  return (await http.patch<PosCategory>(`/pos/categories/${id}`, body)).data;
}

export async function listProductSettings(): Promise<ProductSettingRow[]> {
  return (await http.get<ProductSettingRow[]>('/pos/product-settings')).data;
}

export async function saveProductSettings(items: ProductSettingRequest[]): Promise<{ saved: number }> {
  return (await http.put<{ saved: number }>('/pos/product-settings', { items })).data;
}

// ---------------- Promociones ----------------
export async function listPromotions(): Promise<PosPromotion[]> {
  return (await http.get<PosPromotion[]>('/pos/promotions')).data;
}

export async function savePromotion(id: string | null, body: PromotionRequest): Promise<PosPromotion> {
  const res = id ? await http.patch<PosPromotion>(`/pos/promotions/${id}`, body) : await http.post<PosPromotion>('/pos/promotions', body);
  return res.data;
}

// ---------------- Turnos y reportes ----------------
export async function listShifts(params: { page?: number; limit?: number; status?: 'OPEN' | 'CLOSED' }): Promise<Page<ShiftRow>> {
  return (await http.get<Page<ShiftRow>>('/pos/shifts', { params })).data;
}

export async function getShiftDetail(id: string): Promise<PosShift> {
  return (await http.get<PosShift>(`/pos/shifts/${id}`)).data;
}

export async function getSalesReport(params: { from: string; to: string; terminalId?: string }): Promise<SalesReport> {
  return (await http.get<SalesReport>('/pos/reports/sales', { params })).data;
}

// ---------------- Catálogos del sistema financiero (solo para configurar) ----------------
/** Clientes activos (no proveedores), recorriendo todas las páginas. */
export async function listCustomers(): Promise<Partner[]> {
  const out: Partner[] = [];
  for (let page = 1; page < 100; page++) {
    const { data } = await http.get<Page<Partner>>('/partners', { params: { page, limit: 100 } });
    out.push(...data.data);
    if (out.length >= data.total || data.data.length === 0) break;
  }
  return out.filter((p) => p.active && p.type !== 'SUPPLIER');
}

export async function listAccounts(): Promise<Account[]> {
  return (await http.get<Account[]>('/accounting/accounts', { params: { active: true } })).data;
}

export async function listBankAccounts(): Promise<BankAccount[]> {
  return (await http.get<BankAccount[]>('/bank-accounts')).data;
}

export async function listCashRegisters(): Promise<CashRegister[]> {
  return (await http.get<CashRegister[]>('/cash-registers')).data;
}
