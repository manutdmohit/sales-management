export type InventoryTransactionType =
  | "PURCHASE"
  | "SALE"
  | "ADJUSTMENT"
  | "DAMAGE"
  | "RETURN"
  | "EXPIRED"
  | "PRODUCTION_CONSUME"
  | "PRODUCTION_OUTPUT";

import type { BusinessType } from "./business-types";

export type { BusinessType } from "./business-types";

export type PaymentMethod = "CASH" | "ONLINE";

export interface BusinessSettings {
  currency?: string;
  timezone?: string;
  invoicePrefix?: string;
  logoUrl?: string;
  address?: string;
}

export interface Business {
  _id: string;
  name: string;
  slug: string;
  code: string;
  type: BusinessType;
  isActive: boolean;
  settings: BusinessSettings;
  createdAt: Date;
}

export interface ProductPricing {
  purchase: number;
  selling: number;
  /** Weighted-average inventory cost (production or purchases). */
  unitCost?: number;
}

export type ProductKind = "RAW" | "FINISHED";

export interface ProductRecipeLine {
  rawProductId: string;
  rawProductName?: string;
  rawUnitId?: string;
  quantityPerUnit: number;
}

export interface Product {
  _id: string;
  businessId: string;
  businessType: BusinessType;
  productKind: ProductKind;
  categoryId?: string;
  name: string;
  slug: string;
  sku: string;
  unitId?: string;
  pricing: ProductPricing;
  trackExpiry: boolean;
  minStock: number;
  recipe?: ProductRecipeLine[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductCategory {
  _id: string;
  businessId: string;
  name: string;
  slug: string;
  description?: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductionMaterialSnapshot {
  rawProductId: string;
  rawProductName?: string;
  rawUnitId?: string;
  quantityConsumed: number;
  unitCost: number;
  lineCost: number;
}

export interface ProductionRun {
  _id: string;
  businessId: string;
  finishedProductId: string;
  finishedProductName: string;
  finishedUnitId?: string;
  quantityProduced: number;
  recipeSnapshot: ProductRecipeLine[];
  materialsSnapshot?: ProductionMaterialSnapshot[];
  totalMaterialCost?: number;
  unitMaterialCost?: number;
  notes?: string;
  createdAt: Date;
}

export interface InventoryTransaction {
  _id: string;
  businessId: string;
  productId: string;
  batchId?: string;
  type: InventoryTransactionType;
  quantity: number;
  referenceId?: string;
  notes?: string;
  timestamp: Date;
}

export interface Batch {
  _id: string;
  businessId: string;
  productId: string;
  batchNumber: string;
  expiryDate?: Date;
  quantity: number;
  remainingQuantity: number;
  purchaseId?: string;
  createdAt: Date;
}

export interface SaleItem {
  productId: string;
  productName: string;
  batchId?: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  unitCost?: number;
  lineCost?: number;
}

/** Whether the sale is settled immediately or carried as credit. */
export type SaleType = "IMMEDIATE" | "CREDIT";

/** Settlement status for a credit sale's outstanding balance. */
export type CreditStatus = "PENDING" | "PARTIAL" | "PAID";

export interface SaleCustomer {
  name: string;
  phone: string;
  email?: string;
}

export interface PaymentReceipt {
  url: string;
  publicId: string;
  uploadedAt?: Date;
  uploadedBy?: string;
  label?: string;
}

export interface SalePayment {
  amount: number;
  method: PaymentMethod;
  at: Date;
  note?: string;
  receipt?: PaymentReceipt;
}

export interface Sale {
  _id: string;
  businessId: string;
  invoiceNumber: string;
  items: SaleItem[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  /** Sum of line COGS at time of sale. */
  totalCost?: number;
  paymentMethod: PaymentMethod;
  saleType: SaleType;
  customer?: SaleCustomer;
  /** Linked client record (when the sale captured a customer). */
  clientId?: string;
  /** Due date for settling the outstanding balance (credit sales only). */
  dueDate?: Date;
  /** Amount collected so far (equals total for cash sales). */
  amountPaid: number;
  /** Outstanding balance (0 for cash sales). */
  amountDue: number;
  /** Settlement status; only meaningful for credit sales. */
  creditStatus?: CreditStatus;
  /** Ledger of payments collected against a credit sale. */
  payments: SalePayment[];
  createdAt: Date;
}

export interface PurchaseItem {
  productId: string;
  productName: string;
  quantity: number;
  unitId?: string;
  unitCost: number;
  batchNumber?: string;
  expiryDate?: Date;
  /** Linked inventory batch when received with expiry tracking. */
  batchId?: string;
}

export interface Purchase {
  _id: string;
  businessId: string;
  supplierId?: string;
  supplierName: string;
  items: PurchaseItem[];
  subtotal: number;
  tax: number;
  total: number;
  referenceNumber?: string;
  receipts?: PaymentReceipt[];
  createdAt: Date;
}

export interface Supplier {
  _id: string;
  businessId: string;
  name: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface SupplierStats {
  purchaseCount: number;
  purchaseTotal: number;
  lastPurchaseAt?: Date;
}

export interface SupplierDetail extends Supplier {
  stats: SupplierStats;
  recentPurchases: Purchase[];
}

export interface StockSummary {
  productId: string;
  productName: string;
  sku: string;
  productKind: ProductKind;
  unitId?: string;
  stock: number;
  minStock: number;
  trackExpiry: boolean;
  isLowStock: boolean;
}

export interface Service {
  _id: string;
  businessId: string;
  name: string;
  category?: string;
  price: number;
  durationMinutes?: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type AppointmentStatus =
  | "BOOKED"
  | "COMPLETED"
  | "CANCELLED"
  | "NO_SHOW";

export interface Appointment {
  _id: string;
  businessId: string;
  serviceId: string;
  serviceName: string;
  clientId?: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  price: number;
  /** Settlement, mirroring POS sales. Optional for pre-payment appointments. */
  saleType?: SaleType;
  paymentMethod?: PaymentMethod;
  amountPaid?: number;
  amountDue?: number;
  creditStatus?: CreditStatus;
  dueDate?: Date;
  /** QR / online payment proof collected at booking (legacy; see payments). */
  paymentReceipt?: PaymentReceipt;
  /** Ledger of payments collected against a credit booking. */
  payments?: SalePayment[];
  startAt: Date;
  endAt: Date;
  followUpAt?: Date;
  status: AppointmentStatus;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type ReceivableSource = "sale" | "booking";

/** Unified credit balance row for the receivables ledger. */
export interface Receivable {
  _id: string;
  source: ReceivableSource;
  businessId: string;
  /** Invoice number or service name. */
  reference: string;
  customerName: string;
  customerPhone: string;
  clientId?: string;
  total: number;
  amountPaid: number;
  amountDue: number;
  creditStatus?: CreditStatus;
  dueDate?: Date;
  payments: SalePayment[];
  createdAt: Date;
  /** Populated for service bookings. */
  serviceName?: string;
  appointmentDate?: Date;
}

export type TransactionKind = "SALE" | "BOOKING";

/** Unified row for the sales & bookings ledger. */
export interface TransactionListItem {
  _id: string;
  kind: TransactionKind;
  occurredAt: Date;
  customerName: string;
  customerPhone: string;
  clientId?: string;
  reference: string;
  detail: string;
  amount: number;
  paymentMethod?: PaymentMethod;
  saleType?: SaleType;
  creditStatus?: CreditStatus;
  status?: AppointmentStatus;
  /** Populated for product sales when viewing details. */
  items?: SaleItem[];
  /** Populated for service bookings when viewing details. */
  startAt?: Date;
  endAt?: Date;
  /** When the booking was recorded (may differ from appointment date). */
  bookedAt?: Date;
  /** Booking payment proof. */
  paymentReceipt?: PaymentReceipt;
  /** Product sale payment ledger (includes receipts). */
  payments?: SalePayment[];
}

export type NotificationType =
  | "LOW_STOCK"
  | "CREDIT_SALE"
  | "APPOINTMENT_BOOKED"
  | "CREDIT_DUE_REMINDER"
  | "FOLLOWUP_REMINDER"
  | "EXPIRY_WARNING"
  | "EXPIRY_CRITICAL";

export type NotificationReferenceType =
  | "product"
  | "sale"
  | "appointment"
  | "batch";

export interface Client {
  _id: string;
  businessId: string;
  name: string;
  address?: string;
  email?: string;
  phone: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ClientServiceRecord {
  appointmentId: string;
  serviceName: string;
  price: number;
  startAt: Date;
  endAt: Date;
  status: AppointmentStatus;
  paymentReceipt?: PaymentReceipt;
}

export interface ClientPurchaseRecord {
  saleId: string;
  invoiceNumber: string;
  total: number;
  amountDue: number;
  saleType: SaleType;
  paymentMethod: PaymentMethod;
  itemCount: number;
  items: { productName: string; quantity: number; lineTotal: number }[];
  createdAt: Date;
  payments?: SalePayment[];
}

export interface ClientStats {
  purchaseCount: number;
  purchaseTotal: number;
  outstandingCredit: number;
  bookingCount: number;
  serviceSpend: number;
  lastVisit?: Date;
}

export interface ClientDetail extends Client {
  stats: ClientStats;
  recentPurchases: ClientPurchaseRecord[];
  recentBookings: ClientServiceRecord[];
}

export interface Notification {
  _id: string;
  businessId: string;
  type: NotificationType;
  title: string;
  message: string;
  referenceType?: NotificationReferenceType;
  referenceId?: string;
  /** Stable key for deduplicating alerts (e.g. low stock per product). */
  dedupeKey?: string;
  isRead: boolean;
  createdAt: Date;
}
