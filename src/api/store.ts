import { http } from './client';
import type {
  AdjustmentDetail, AdjustmentRequest, AdjustmentRow, CollectRequest, InvoiceDetail, InvoiceRequest, InvoiceRow, KardexPage, Page,
  PartnerDetail, PartnerRequest, PartnerRow, PurchaseRequest, StockPage, StoreFunds, StoreProduct, StoreProductRequest, StoreSummary,
  StoreTaxRate,
} from '@/types/api';

// Tienda (/pos/store): productos, inventario, compras, proveedores, clientes y facturas. Las reglas (NCF, ITBIS,
// inventario, asientos) las aplica el backend; aquí solo se envía y se muestra.

type Query = Record<string, string | number | boolean | undefined>;
const clean = (q: Query) => Object.fromEntries(Object.entries(q).filter(([, v]) => v !== undefined && v !== ''));

export type PartnerKind = 'customers' | 'suppliers';

export async function getSummary(): Promise<StoreSummary> {
  return (await http.get<StoreSummary>('/pos/store/summary')).data;
}

export async function listTaxRates(): Promise<StoreTaxRate[]> {
  return (await http.get<StoreTaxRate[]>('/pos/store/tax-rates')).data;
}

export async function getFunds(): Promise<StoreFunds> {
  return (await http.get<StoreFunds>('/pos/store/funds')).data;
}

// ---------------- Productos ----------------
export async function listProducts(q: { q?: string; active?: boolean; categoryId?: string; outOfStock?: boolean; page?: number; limit?: number }): Promise<Page<StoreProduct>> {
  return (await http.get<Page<StoreProduct>>('/pos/store/products', { params: clean(q) })).data;
}

export async function getProduct(id: string): Promise<StoreProduct> {
  return (await http.get<StoreProduct>(`/pos/store/products/${id}`)).data;
}

export async function saveProduct(id: string | null, body: StoreProductRequest): Promise<StoreProduct> {
  const res = id ? await http.patch<StoreProduct>(`/pos/store/products/${id}`, body) : await http.post<StoreProduct>('/pos/store/products', body);
  return res.data;
}

// ---------------- Inventario ----------------
export async function listStock(q: { q?: string; withStock?: boolean; page?: number; limit?: number }): Promise<StockPage> {
  return (await http.get<StockPage>('/pos/store/stock', { params: clean(q) })).data;
}

export async function getKardex(productId: string, q: { from?: string; to?: string; page?: number; limit?: number }): Promise<KardexPage> {
  return (await http.get<KardexPage>(`/pos/store/products/${productId}/movements`, { params: clean(q) })).data;
}

export async function listAdjustments(q: { page?: number; limit?: number }): Promise<Page<AdjustmentRow>> {
  return (await http.get<Page<AdjustmentRow>>('/pos/store/adjustments', { params: clean(q) })).data;
}

export async function getAdjustment(id: string): Promise<AdjustmentDetail> {
  return (await http.get<AdjustmentDetail>(`/pos/store/adjustments/${id}`)).data;
}

export async function createAdjustment(body: AdjustmentRequest): Promise<AdjustmentDetail> {
  return (await http.post<AdjustmentDetail>('/pos/store/adjustments', body)).data;
}

export async function voidAdjustment(id: string, reason: string): Promise<AdjustmentDetail> {
  return (await http.post<AdjustmentDetail>(`/pos/store/adjustments/${id}/void`, { reason })).data;
}

// ---------------- Compras ----------------
export async function listPurchases(q: { q?: string; pending?: boolean; page?: number; limit?: number }): Promise<Page<InvoiceRow>> {
  return (await http.get<Page<InvoiceRow>>('/pos/store/purchases', { params: clean(q) })).data;
}

export async function createPurchase(body: PurchaseRequest): Promise<InvoiceDetail> {
  return (await http.post<InvoiceDetail>('/pos/store/purchases', body)).data;
}

// ---------------- Clientes y proveedores ----------------
export async function listPartners(kind: PartnerKind, q: { q?: string; active?: boolean; withBalance?: boolean; page?: number; limit?: number }): Promise<Page<PartnerRow>> {
  return (await http.get<Page<PartnerRow>>(`/pos/store/${kind}`, { params: clean(q) })).data;
}

export async function getPartner(kind: PartnerKind, id: string): Promise<PartnerDetail> {
  return (await http.get<PartnerDetail>(`/pos/store/${kind}/${id}`)).data;
}

export async function savePartner(kind: PartnerKind, id: string | null, body: PartnerRequest): Promise<PartnerDetail> {
  const res = id ? await http.patch<PartnerDetail>(`/pos/store/${kind}/${id}`, body) : await http.post<PartnerDetail>(`/pos/store/${kind}`, body);
  return res.data;
}

// ---------------- Facturas ----------------
export async function listInvoices(q: { q?: string; partnerId?: string; status?: string; pending?: boolean; from?: string; to?: string; page?: number; limit?: number }): Promise<Page<InvoiceRow>> {
  return (await http.get<Page<InvoiceRow>>('/pos/store/invoices', { params: clean(q) })).data;
}

export async function getInvoice(id: string): Promise<InvoiceDetail> {
  return (await http.get<InvoiceDetail>(`/pos/store/invoices/${id}`)).data;
}

export async function createInvoice(body: InvoiceRequest): Promise<InvoiceDetail> {
  return (await http.post<InvoiceDetail>('/pos/store/invoices', body)).data;
}

export async function voidInvoice(id: string, body: { reason: string; reasonCode?: string }): Promise<InvoiceDetail> {
  return (await http.post<InvoiceDetail>(`/pos/store/invoices/${id}/void`, body)).data;
}

export async function collectInvoice(id: string, body: CollectRequest): Promise<InvoiceDetail> {
  return (await http.post<InvoiceDetail>(`/pos/store/invoices/${id}/payments`, body)).data;
}
