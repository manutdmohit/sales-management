export type DomainEventType =
  | "SALE_CREATED"
  | "PURCHASE_CREATED"
  | "STOCK_UPDATED"
  | "PRODUCT_EXPIRED";

export interface DomainEvent<T = Record<string, unknown>> {
  type: DomainEventType;
  businessId: string;
  payload: T;
  timestamp: Date;
}

export type EventHandler = (event: DomainEvent) => void | Promise<void>;
