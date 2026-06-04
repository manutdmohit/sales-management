import type { DomainEvent, EventHandler } from "./types";

class EventBus {
  private handlers = new Map<string, EventHandler[]>();

  on(type: string, handler: EventHandler): void {
    const list = this.handlers.get(type) ?? [];
    list.push(handler);
    this.handlers.set(type, list);
  }

  async emit(event: DomainEvent): Promise<void> {
    const handlers = this.handlers.get(event.type) ?? [];
    await Promise.all(handlers.map((h) => h(event)));
  }
}

export const eventBus = new EventBus();

// Default audit log handler
eventBus.on("SALE_CREATED", async (e) => {
  console.info("[event]", e.type, e.businessId, e.payload);
});
eventBus.on("PURCHASE_CREATED", async (e) => {
  console.info("[event]", e.type, e.businessId, e.payload);
});
eventBus.on("STOCK_UPDATED", async (e) => {
  console.info("[event]", e.type, e.businessId, e.payload);
});

import { registerNotificationHandlers } from "./notification-handlers";
import { registerEmailHandlers } from "./email-handlers";

registerNotificationHandlers();
registerEmailHandlers();
