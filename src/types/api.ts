// Tipos de las respuestas del backend financiero (src/verticals/pos y auth). Los montos llegan como texto con decimales
// (Decimal de Prisma); el frontend los muestra, no los recalcula.

// ---------------- Errores y sesión ----------------
/** Cuerpo de error: el estándar de Nest ({ message, error, statusCode }) o el de negocio del POS ({ code, message, ... }). */
export interface ApiErrorBody {
  message: string | string[];
  error?: string;
  statusCode?: number;
  code?: string;
  [extra: string]: unknown;
}

export type Role = 'ADMIN' | 'ACCOUNTANT' | 'APPROVER' | 'VIEWER' | 'AUDITOR' | 'CASHIER' | 'SELLER' | 'WAREHOUSE';

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  companyId: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

/** Login sin 2FA, o segundo paso aprobado (puede traer los códigos de emergencia recién creados). */
export interface LoginTokenResponse {
  access_token: string;
  user: SessionUser;
  recoveryCodes?: string[];
  recoveryCodesRemaining?: number;
}

/** El usuario tiene 2FA (pide el código) o su rol lo exige y aún no lo activó (pide inscribirse). */
export interface LoginChallengeResponse {
  challengeToken: string;
  expiresInSeconds: number;
  twoFactorRequired?: true;
  twoFactorSetupRequired?: true;
}

export type LoginResponse = LoginTokenResponse | LoginChallengeResponse;

export interface EnrollStartResponse {
  otpauthUri: string;
  qrCode: string;
  secret: string;
  expiresInSeconds: number;
}

/** Lo que se lee del JWT (sin verificar la firma: solo para la interfaz). */
export interface TokenPayload {
  sub: string;
  email: string;
  role: Role;
  companyId: string;
  exp?: number;
}

export interface Page<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

// ---------------- Caja ----------------
export type PayMethod = 'CASH' | 'CARD' | 'TRANSFER';
export type ApprovalAction = 'DISCOUNT' | 'VOID' | 'RETURN' | 'CASH_OUT' | 'DRAWER' | 'CREDIT_SALE';

export interface PosTerminalLite {
  id: string;
  code: string;
  name: string;
}

export interface PosContext {
  configured: boolean;
  isSupervisor: boolean;
  terminals: PosTerminalLite[];
}

export interface CatalogSettings {
  defaultNcfType: string;
  fiscalCreditNcfType: string;
  maxDiscountPct: string;
  receiptFooter: string | null;
  defaultPartner: { id: string; name: string } | null;
}

export interface PosCategory {
  id: string;
  name: string;
  color: string | null;
  sortOrder: number;
  active: boolean;
}

export interface PosProduct {
  id: string;
  code: string;
  name: string;
  unit: string;
  kind: 'GOODS' | 'SERVICE';
  salePrice: string;
  saleTaxRateId: string | null;
  tracksInventory: boolean;
  stockQty: string;
  categoryId: string | null;
  sortOrder: number;
  barcodes: string[];
  tax: { name: string; rate: string } | null;
}

export type PromotionType = 'PERCENT' | 'BUY_X_PAY_Y' | 'FIXED_PRICE';

export interface PosPromotion {
  id: string;
  name: string;
  type: PromotionType;
  value: string | null;
  buyQty: number | null;
  payQty: number | null;
  productIds: string[];
  categoryIds: string[];
  startsAt: string | null;
  endsAt: string | null;
  weekdays: number[];
  timeFrom: string | null;
  timeTo: string | null;
  priority: number;
  active: boolean;
}

export interface PosCatalog {
  settings: CatalogSettings;
  categories: PosCategory[];
  products: PosProduct[];
  promotions: PosPromotion[];
  serverTime: string;
}

export interface PosCustomer {
  id: string;
  name: string;
  taxId: string | null;
  taxIdType: string | null;
  defaultNcfType: string | null;
  creditLimit: string | null;
}

export interface CreateCustomerRequest {
  name: string;
  taxId?: string;
  taxIdType?: 'RNC' | 'CEDULA' | 'PASSPORT';
  phone?: string;
  defaultNcfType?: string;
}

export interface ShiftTotals {
  salesCount: number;
  voidedCount: number;
  returnsCount: number;
  grossSales: string;
  discounts: string;
  taxes: string;
  creditSales: string;
  salesByMethod: Record<PayMethod, string>;
  refundsByMethod: Record<PayMethod, string>;
  cashIn: string;
  cashOut: string;
  drawerOpens: number;
  openingCash: string;
  expectedCash: string;
}

export interface CashMovement {
  id: string;
  type: 'IN' | 'OUT';
  amount: string;
  reason: string;
  createdAt: string;
}

export interface PosShift {
  id: string;
  number: string;
  status: 'OPEN' | 'CLOSED';
  terminalId: string;
  terminal: PosTerminalLite;
  openedAt: string;
  openingCash: string;
  openedBy: string | null;
  closedAt: string | null;
  closedBy: string | null;
  expectedCash: string | null;
  countedCash: string | null;
  difference: string | null;
  closeNotes: string | null;
  movements: CashMovement[];
  drawerEvents: { id: string; reason: string; createdAt: string }[];
  totals: ShiftTotals;
}

export interface PosSaleLine {
  id: string;
  productId: string;
  description: string;
  quantity: string;
  unitPrice: string;
  discount: string;
  promoDiscount: string;
  returnedQty: string;
  taxRateId: string | null;
}

export interface PosSalePayment {
  method: PayMethod;
  amount: string;
  tendered: string | null;
  reference: string | null;
}

export interface PosReturn {
  id: string;
  number: string;
  total: string;
  method: PayMethod;
  reason: string;
  createdAt: string;
}

export interface PosSale {
  id: string;
  number: string;
  status: 'COMPLETED' | 'VOIDED';
  shiftId: string;
  invoiceId: string;
  invoiceNumber: string;
  ncf: string | null;
  ncfType: string;
  subtotal: string;
  discountTotal: string;
  promoTotal: string;
  taxTotal: string;
  total: string;
  paidTotal: string;
  changeGiven: string;
  createdAt: string;
  voidReason: string | null;
  partner: { id: string; name: string; taxId: string | null } | null;
  lines: PosSaleLine[];
  payments: PosSalePayment[];
  returns: PosReturn[];
}

/** Fila de la lista de ventas (trae solo método y monto de los pagos, sin líneas). */
export interface PosSaleRow {
  id: string;
  number: string;
  status: 'COMPLETED' | 'VOIDED';
  shiftId: string;
  invoiceId: string;
  invoiceNumber: string;
  ncf: string | null;
  total: string;
  createdAt: string;
  partner: { id: string; name: string; taxId: string | null } | null;
  payments: { method: PayMethod; amount: string }[];
}

export interface PosTicket {
  company: { name: string; legalName: string | null; taxId: string; address: string | null; phone: string | null };
  sale: PosSale;
  cashier: string | null;
  ncfType: string;
  issuedAt: string;
  ecf: { securityCode: string | null; status: string } | null;
  footer: string | null;
}

export interface ParkedPayload {
  lines: { productId: string; quantity: string; discount: string }[];
  partnerId: string | null;
  ncfType: string | null;
}

export interface ParkedSale {
  id: string;
  label: string;
  payload: ParkedPayload;
  createdAt: string;
}

export interface SaleLineRequest {
  productId: string;
  quantity: number;
  discount?: number;
}

export interface SalePaymentRequest {
  method: PayMethod;
  amount: number;
  reference?: string;
}

export interface CreateSaleRequest {
  clientUuid: string;
  shiftId: string;
  partnerId?: string;
  ncfType?: string;
  lines: SaleLineRequest[];
  payments: SalePaymentRequest[];
  expectedTotal?: number;
  allowCredit?: boolean;
  approvalId?: string;
  notes?: string;
}

export interface ApprovalRequest {
  action: ApprovalAction;
  supervisorEmail: string;
  pin: string;
}

export interface ApprovalResponse {
  approvalId: string;
  approvedBy: string;
  expiresAt: string;
}

export interface CashMovementRequest {
  type: 'IN' | 'OUT';
  amount: number;
  reason: string;
  accountId: string;
  approvalId?: string;
}

export interface CloseShiftRequest {
  countedCash: number;
  countDetail?: Record<string, number>;
  notes?: string;
}

export interface VoidSaleRequest {
  reason: string;
  reasonCode: string;
  approvalId?: string;
}

export interface ReturnSaleRequest {
  shiftId: string;
  lines: { saleLineId: string; quantity: number }[];
  refundMethod: PayMethod;
  reason: string;
  approvalId?: string;
}

export interface MovementAccount {
  id: string;
  code: string;
  name: string;
  type: string;
}

// ---------------- Administración ----------------
export interface PosSettings {
  companyId: string;
  defaultPartnerId: string;
  defaultNcfType: string;
  fiscalCreditNcfType: string;
  maxDiscountPct: string;
  cashOverShortAccountId: string | null;
  receiptFooter: string | null;
  defaultPartner: { id: string; name: string } | null;
}

export interface UpdateSettingsRequest {
  defaultPartnerId?: string;
  defaultNcfType?: string;
  fiscalCreditNcfType?: string;
  maxDiscountPct?: number;
  cashOverShortAccountId?: string | null;
  receiptFooter?: string | null;
}

export interface PosTerminal {
  id: string;
  code: string;
  name: string;
  cashRegisterId: string;
  cardBankAccountId: string | null;
  transferBankAccountId: string | null;
  active: boolean;
}

export interface CreateTerminalRequest {
  code: string;
  name: string;
  cashRegisterId: string;
  cardBankAccountId?: string;
  transferBankAccountId?: string;
}

export interface UpdateTerminalRequest {
  name?: string;
  cashRegisterId?: string;
  cardBankAccountId?: string | null;
  transferBankAccountId?: string | null;
  active?: boolean;
}

export interface CategoryRequest {
  name: string;
  color?: string | null;
  sortOrder?: number;
  active?: boolean;
}

export interface ProductSettingRow {
  id: string;
  code: string;
  name: string;
  salePrice: string | null;
  kind: 'GOODS' | 'SERVICE';
  categoryId: string | null;
  showInPos: boolean;
  sortOrder: number;
  barcodes: string[];
}

export interface ProductSettingRequest {
  productId: string;
  categoryId?: string | null;
  showInPos?: boolean;
  sortOrder?: number;
  barcodes?: string[];
}

export interface PromotionRequest {
  name: string;
  type: PromotionType;
  value?: number;
  buyQty?: number;
  payQty?: number;
  productIds?: string[];
  categoryIds?: string[];
  startsAt?: string | null;
  endsAt?: string | null;
  weekdays?: number[];
  timeFrom?: string | null;
  timeTo?: string | null;
  priority?: number;
  active?: boolean;
}

export interface ShiftRow {
  id: string;
  number: string;
  status: 'OPEN' | 'CLOSED';
  openedAt: string;
  closedAt: string | null;
  openingCash: string;
  expectedCash: string | null;
  countedCash: string | null;
  difference: string | null;
  terminal: { code: string; name: string };
  _count: { sales: number };
}

export interface ReportGroup {
  key: string;
  name?: string;
  count: number;
  total: string;
  tax: string;
  discounts: string;
}

export interface SalesReport {
  totals: { count: number; total: string; returns: string };
  byDay: ReportGroup[];
  byTerminal: ReportGroup[];
  byCashier: ReportGroup[];
  topProducts: { productId: string; description: string; quantity: string; amount: string }[];
}

// ---------------- Catálogos del núcleo (para configurar) ----------------
export interface Partner {
  id: string;
  type: string;
  name: string;
  taxId: string | null;
  active: boolean;
}

export interface Account {
  id: string;
  code: string;
  name: string;
  type: string;
  isPostable: boolean;
  active: boolean;
}

export interface BankAccount {
  id: string;
  bankName: string;
  accountNumber: string;
  glAccountId: string | null;
  active: boolean;
}

export interface CashRegister {
  id: string;
  name: string;
  glAccountId: string | null;
  active: boolean;
}

// ---------------- Tienda: productos, inventario, compras, clientes y facturas (/pos/store) ----------------
export interface StoreSummary {
  receivable: { count: number; total: string; overdue: number };
  outOfStock: number;
  salesToday: { count: number; total: string };
}

export interface StoreTaxRate {
  id: string;
  name: string;
  type: string;
  rate: string;
  sales: boolean;
  purchases: boolean;
}

export interface StoreFunds {
  cashRegisters: { id: string; name: string }[];
  bankAccounts: { id: string; bankName: string; accountNumber: string }[];
}

export interface StoreProduct {
  id: string;
  code: string;
  name: string;
  description: string | null;
  kind: 'GOODS' | 'SERVICE';
  unit: string;
  salePrice: string | null;
  purchasePrice: string | null;
  saleTaxRateId: string | null;
  purchaseTaxRateId: string | null;
  tracksInventory: boolean;
  stockQty: string;
  avgCost: string;
  active: boolean;
  saleTaxRate: { name: string; rate: string } | null;
  categoryId: string | null;
  showInPos: boolean;
  barcodes: string[];
}

export interface StoreProductRequest {
  code?: string;
  name?: string;
  description?: string | null;
  kind?: 'GOODS' | 'SERVICE';
  unit?: string;
  salePrice?: number | null;
  purchasePrice?: number | null;
  saleTaxRateId?: string | null;
  purchaseTaxRateId?: string | null;
  tracksInventory?: boolean;
  active?: boolean;
  categoryId?: string | null;
  showInPos?: boolean;
  barcodes?: string[];
}

export interface StockRow {
  id: string;
  code: string;
  name: string;
  unit: string;
  active: boolean;
  stockQty: string;
  avgCost: string;
  stockValue: string;
}

export interface StockPage extends Page<StockRow> {
  totalValue: string;
}

export interface KardexMovement {
  id: string;
  seq: number;
  date: string;
  type: 'PURCHASE' | 'SALE' | 'SALE_RETURN' | 'PURCHASE_RETURN' | 'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT' | 'REVERSAL';
  quantity: string;
  unitCost: string;
  totalCost: string;
  qtyAfter: string;
  valueAfter: string;
  invoice: { id: string; number: string; type: string; ncf: string | null } | null;
  adjustment: { id: string; number: string } | null;
}

export interface KardexPage extends Page<KardexMovement> {
  product: { id: string; code: string; name: string; unit: string; tracksInventory: boolean; stockQty: string; avgCost: string; stockValue: string };
}

export interface AdjustmentRow {
  id: string;
  number: string;
  date: string;
  reason: string;
  status: 'POSTED' | 'VOIDED';
  total?: string;
  _count: { lines: number };
}

export interface AdjustmentDetail {
  id: string;
  number: string;
  date: string;
  reason: string;
  status: 'POSTED' | 'VOIDED';
  voidReason?: string | null;
  lines: { id: string; quantity: string; unitCost: string; totalCost: string; product: { id: string; code: string; name: string; unit: string } }[];
}

export interface AdjustmentRequest {
  date: string;
  reason: string;
  lines: { productId: string; quantity: number; unitCost?: number }[];
}

export interface PartnerRow {
  id: string;
  type: 'CUSTOMER' | 'SUPPLIER' | 'BOTH';
  name: string;
  tradeName: string | null;
  taxId: string | null;
  taxIdType: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  creditLimit: string | null;
  paymentTermsDays: number;
  defaultNcfType: string | null;
  active: boolean;
  balance: string;
}

export type InvoiceStatus = 'DRAFT' | 'ISSUED' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE' | 'VOIDED';

export interface InvoiceRow {
  id: string;
  number: string;
  type: 'SALE' | 'PURCHASE' | 'CREDIT_NOTE' | 'DEBIT_NOTE';
  ncf: string | null;
  ncfType?: string | null;
  issueDate: string;
  dueDate: string | null;
  subtotal?: string;
  taxTotal?: string;
  total: string;
  balance: string;
  status: InvoiceStatus;
  sourceModule: string | null;
  partner?: { id: string; name: string; taxId: string | null };
}

export interface PartnerDetail extends Omit<PartnerRow, 'balance'> {
  balance: string;
  invoices: InvoiceRow[];
}

export interface PartnerRequest {
  name?: string;
  tradeName?: string;
  taxIdType?: 'RNC' | 'CEDULA' | 'PASSPORT';
  taxId?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  creditLimit?: number;
  paymentTermsDays?: number;
  defaultNcfType?: string;
  active?: boolean;
}

export interface InvoiceLine {
  id: string;
  description: string;
  quantity: string;
  unitPrice: string;
  discount: string;
  taxAmount: string;
  /** Neto de la línea, sin ITBIS */
  total: string;
  productId: string | null;
  taxRate: { name: string; rate: string } | null;
}

export interface InvoiceDetail {
  id: string;
  number: string;
  type: 'SALE' | 'PURCHASE' | 'CREDIT_NOTE' | 'DEBIT_NOTE';
  status: InvoiceStatus;
  ncf: string | null;
  ncfType: string | null;
  issueDate: string;
  dueDate: string | null;
  subtotal: string;
  discountTotal: string;
  taxTotal: string;
  withholdingTotal?: string;
  total: string;
  balance: string;
  notes: string | null;
  sourceModule: string | null;
  partner: { id: string; name: string; taxId: string | null; address: string | null; phone: string | null; email: string | null };
  lines: InvoiceLine[];
  company: { name: string; legalName: string | null; taxId: string; address: string | null; phone: string | null };
  payments: { id: string; number: string | null; date: string; method: string; reference: string | null; status: string; amount: string }[];
}

export interface InvoiceRequest {
  clientUuid: string;
  partnerId: string;
  ncfType?: string;
  dueDate?: string;
  lines: { productId: string; quantity: number; discount?: number }[];
  notes?: string;
  approvalId?: string;
}

export interface PurchaseRequest {
  clientUuid: string;
  supplierId: string;
  issueDate: string;
  ncf?: string;
  ncfType?: string;
  lines: { productId: string; quantity: number; unitCost: number; taxRateId?: string | null }[];
  notes?: string;
}

export type CollectMethod = 'CASH' | 'CARD' | 'TRANSFER' | 'CHECK';

export interface CollectRequest {
  amount: number;
  method: CollectMethod;
  cashRegisterId?: string;
  bankAccountId?: string;
  reference?: string;
}

// ---------------- Usuarios (rutas del núcleo, solo administrador) ----------------
export interface UserRow {
  id: string;
  email: string;
  name: string;
  role: Role;
  active: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  twoFactor: { enabledAt: string | null } | null;
}

export interface CreateUserRequest {
  email: string;
  password: string;
  name: string;
  role: Role;
  confirmPassword: string;
  confirmCode?: string;
}

export interface UpdateUserRequest {
  name?: string;
  role?: Role;
  active?: boolean;
  confirmPassword: string;
  confirmCode?: string;
}
