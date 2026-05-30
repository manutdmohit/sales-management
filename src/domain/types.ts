export type InventoryTransactionType =
  | "PURCHASE"
  | "SALE"
  | "ADJUSTMENT"
  | "DAMAGE"
  | "RETURN"
  | "EXPIRED";

import type { BusinessType } from "./business-types";

export type { BusinessType } from "./business-types";

export type PaymentMethod = "CASH" | "CARD" | "UPI" | "OTHER";

export interface BusinessSettings {
  currency?: string;
  timezone?: string;
  invoicePrefix?: string;
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
}

export interface Product {
  _id: string;
  businessId: string;
  businessType: BusinessType;
  categoryId?: string;
  name: string;
  slug: string;
  sku: string;
  unitId?: string;
  pricing: ProductPricing;
  trackExpiry: boolean;
  minStock: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
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
  paymentMethod: PaymentMethod;
  createdAt: Date;
}

export interface PurchaseItem {
  productId: string;
  productName: string;
  quantity: number;
  unitCost: number;
  batchNumber?: string;
  expiryDate?: Date;
}

export interface Purchase {
  _id: string;
  businessId: string;
  supplierName: string;
  items: PurchaseItem[];
  subtotal: number;
  tax: number;
  total: number;
  referenceNumber?: string;
  createdAt: Date;
}

export interface StockSummary {
  productId: string;
  productName: string;
  sku: string;
  stock: number;
  minStock: number;
  trackExpiry: boolean;
  isLowStock: boolean;
}
