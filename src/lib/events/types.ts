export type DomainEventType =
  | "SALE_CREATED"
  | "CREDIT_SALE_CREATED"
  | "PAYMENT_RECORDED"
  | "PURCHASE_CREATED"
  | "STOCK_UPDATED"
  | "LOW_STOCK"
  | "PRODUCT_EXPIRED"
  | "APPOINTMENT_BOOKED";

export interface DomainEvent<T = Record<string, unknown>> {
  type: DomainEventType;
  businessId: string;
  payload: T;
  timestamp: Date;
}

export type EventHandler = (event: DomainEvent) => void | Promise<void>;
