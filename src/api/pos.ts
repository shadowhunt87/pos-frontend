import { http } from './client';
import type {
  ApprovalRequest, ApprovalResponse, CashMovementRequest, CloseShiftRequest, CreateCustomerRequest, CreateSaleRequest, MovementAccount,
  Page, ParkedPayload, ParkedSale, PosCatalog, PosContext, PosCustomer, PosSale, PosSaleRow, PosShift, PosTicket, ReturnSaleRequest,
  VoidSaleRequest,
} from '@/types/api';

// Llamadas de la caja (rutas que también puede usar el rol Cajero).

export async function getContext(): Promise<PosContext> {
  return (await http.get<PosContext>('/pos/context')).data;
}

export async function getCatalog(): Promise<PosCatalog> {
  return (await http.get<PosCatalog>('/pos/catalog')).data;
}

export async function searchCustomers(q: string): Promise<PosCustomer[]> {
  return (await http.get<PosCustomer[]>('/pos/customers', { params: q.trim() ? { q: q.trim() } : {} })).data;
}

export async function createCustomer(body: CreateCustomerRequest): Promise<PosCustomer> {
  return (await http.post<PosCustomer>('/pos/customers', body)).data;
}

// ---------------- Turnos ----------------
export async function getCurrentShift(terminalId: string): Promise<PosShift | null> {
  // Sin turno, Nest responde 200 con cuerpo vacío
  const { data } = await http.get<PosShift | '' | null>('/pos/shifts/current', { params: { terminalId } });
  return data ? data : null;
}

export async function getShift(id: string): Promise<PosShift> {
  return (await http.get<PosShift>(`/pos/shifts/${id}`)).data;
}

export async function openShift(terminalId: string, openingCash: number): Promise<PosShift> {
  return (await http.post<PosShift>('/pos/shifts/open', { terminalId, openingCash })).data;
}

export async function closeShift(id: string, body: CloseShiftRequest): Promise<PosShift> {
  return (await http.post<PosShift>(`/pos/shifts/${id}/close`, body)).data;
}

export async function getMovementAccounts(terminalId: string): Promise<MovementAccount[]> {
  return (await http.get<MovementAccount[]>('/pos/movement-accounts', { params: { terminalId } })).data;
}

export async function registerMovement(shiftId: string, body: CashMovementRequest): Promise<PosShift> {
  return (await http.post<PosShift>(`/pos/shifts/${shiftId}/movements`, body)).data;
}

export async function openDrawer(shiftId: string, body: { reason: string; approvalId?: string }): Promise<{ ok: true }> {
  return (await http.post<{ ok: true }>(`/pos/shifts/${shiftId}/drawer`, body)).data;
}

// ---------------- Autorización de supervisor ----------------
export async function requestApproval(body: ApprovalRequest): Promise<ApprovalResponse> {
  return (await http.post<ApprovalResponse>('/pos/approvals', body)).data;
}

// ---------------- Ventas ----------------
export async function createSale(body: CreateSaleRequest): Promise<PosSale> {
  return (await http.post<PosSale>('/pos/sales', body)).data;
}

export async function listSales(params: { shiftId?: string; q?: string; limit?: number; page?: number }): Promise<Page<PosSaleRow>> {
  return (await http.get<Page<PosSaleRow>>('/pos/sales', { params })).data;
}

export async function getSale(id: string): Promise<PosSale> {
  return (await http.get<PosSale>(`/pos/sales/${id}`)).data;
}

export async function getTicket(id: string): Promise<PosTicket> {
  return (await http.get<PosTicket>(`/pos/sales/${id}/ticket`)).data;
}

export async function voidSale(id: string, body: VoidSaleRequest): Promise<PosSale> {
  return (await http.post<PosSale>(`/pos/sales/${id}/void`, body)).data;
}

export async function returnSale(id: string, body: ReturnSaleRequest): Promise<PosSale> {
  return (await http.post<PosSale>(`/pos/sales/${id}/returns`, body)).data;
}

// ---------------- Ventas suspendidas ----------------
export async function listParked(terminalId: string): Promise<ParkedSale[]> {
  return (await http.get<ParkedSale[]>('/pos/parked', { params: { terminalId } })).data;
}

export async function parkSale(terminalId: string, label: string, payload: ParkedPayload): Promise<ParkedSale> {
  return (await http.post<ParkedSale>('/pos/parked', { terminalId, label, payload })).data;
}

export async function resumeParked(id: string): Promise<ParkedSale> {
  return (await http.post<ParkedSale>(`/pos/parked/${id}/resume`, {})).data;
}

export async function discardParked(id: string): Promise<{ deleted: true }> {
  return (await http.delete<{ deleted: true }>(`/pos/parked/${id}`)).data;
}
