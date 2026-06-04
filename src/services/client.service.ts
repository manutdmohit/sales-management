import type {
  Client,
  ClientDetail,
  ClientPurchaseRecord,
  ClientServiceRecord,
} from "@/domain/types";
import { AppError } from "@/lib/errors";
import type { PaginatedResult, SortDir } from "@/lib/pagination";
import {
  clientRepository,
  normalizePhone,
} from "@/repositories/client.repository";
import { saleRepository } from "@/repositories/sale.repository";
import { businessService } from "./business.service";
import { emailTemplates } from "@/lib/email/templates";
import { emailService } from "@/services/email.service";
import type { SendClientEmailInput } from "@/schemas/client-email.schema";

type UpsertContactInput = {
  businessId: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
};

export const clientService = {
  async list(
    businessId: string,
    options?: {
      search?: string;
      sort?: string;
      dir?: SortDir;
      page?: number;
      pageSize?: number;
    }
  ): Promise<PaginatedResult<Client>> {
    await businessService.getById(businessId);
    return clientRepository.findByBusinessPaginated(businessId, {
      search: options?.search,
      sort: options?.sort,
      dir: options?.dir,
      page: options?.page ?? 1,
      pageSize: options?.pageSize ?? 20,
    });
  },

  async getById(id: string): Promise<Client> {
    const client = await clientRepository.findById(id);
    if (!client) {
      throw new AppError("Client not found", 404, "NOT_FOUND");
    }
    return client;
  },

  /** Profile header: aggregate stats + the 5 most recent of each history. */
  async getDetail(id: string): Promise<ClientDetail> {
    const client = await this.getById(id);
    await businessService.getById(client.businessId);
    const [stats, recentPurchases, recentBookings] = await Promise.all([
      clientRepository.getStats(client.businessId, client._id, client.phone),
      clientRepository.findPurchaseHistoryPaginated(
        client.businessId,
        client._id,
        client.phone,
        { page: 1, pageSize: 5 }
      ),
      clientRepository.findServiceHistoryPaginated(
        client.businessId,
        client._id,
        client.phone,
        { page: 1, pageSize: 5 }
      ),
    ]);

    return {
      ...client,
      stats,
      recentPurchases: recentPurchases.items,
      recentBookings: recentBookings.items,
    };
  },

  async listPurchases(
    id: string,
    options?: { search?: string; page?: number; pageSize?: number }
  ): Promise<PaginatedResult<ClientPurchaseRecord>> {
    const client = await this.getById(id);
    return clientRepository.findPurchaseHistoryPaginated(
      client.businessId,
      client._id,
      client.phone,
      {
        search: options?.search,
        page: options?.page ?? 1,
        pageSize: options?.pageSize ?? 10,
      }
    );
  },

  async listBookings(
    id: string,
    options?: { page?: number; pageSize?: number }
  ): Promise<PaginatedResult<ClientServiceRecord>> {
    const client = await this.getById(id);
    return clientRepository.findServiceHistoryPaginated(
      client.businessId,
      client._id,
      client.phone,
      { page: options?.page ?? 1, pageSize: options?.pageSize ?? 10 }
    );
  },

  async create(input: UpsertContactInput): Promise<Client> {
    await businessService.getById(input.businessId);
    const phone = normalizePhone(input.phone);
    const existing = await clientRepository.findByPhone(input.businessId, phone);
    if (existing) {
      throw new AppError(
        "A client with this contact number already exists",
        409,
        "DUPLICATE_PHONE"
      );
    }
    return clientRepository.create({
      businessId: input.businessId,
      name: input.name.trim(),
      phone,
      email: input.email?.trim() || undefined,
      address: input.address?.trim() || undefined,
    });
  },

  async update(
    id: string,
    input: Partial<UpsertContactInput>
  ): Promise<Client> {
    const existing = await this.getById(id);
    if (input.phone) {
      const phone = normalizePhone(input.phone);
      const clash = await clientRepository.findByPhone(
        existing.businessId,
        phone
      );
      if (clash && clash._id !== id) {
        throw new AppError(
          "Another client already uses this contact number",
          409,
          "DUPLICATE_PHONE"
        );
      }
    }
    const updated = await clientRepository.update(id, {
      name: input.name?.trim(),
      phone: input.phone ? normalizePhone(input.phone) : undefined,
      email: input.email,
      address: input.address,
    });
    if (!updated) {
      throw new AppError("Client not found", 404, "NOT_FOUND");
    }
    return updated;
  },

  /**
   * One-time migration: create/link client records for sales that captured a
   * customer before sale→client linking existed. Returns counts for logging.
   */
  async backfillFromSales(
    businessId?: string
  ): Promise<{ clientsLinked: number; salesUpdated: number }> {
    const sales = await saleRepository.findWithCustomerPhone(businessId);
    let salesUpdated = 0;
    const linkedClients = new Set<string>();

    for (const sale of sales) {
      const customer = sale.customer;
      if (!customer?.phone?.trim()) continue;

      const client = await this.upsertFromContact({
        businessId: sale.businessId,
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
      });
      linkedClients.add(client._id);

      if (sale.clientId !== client._id) {
        await saleRepository.setClientId(sale._id, client._id);
        salesUpdated += 1;
      }
    }

    return { clientsLinked: linkedClients.size, salesUpdated };
  },

  /** Link bookings to a client record — upsert by phone within the business. */
  async upsertFromContact(input: UpsertContactInput): Promise<Client> {
    await businessService.getById(input.businessId);
    const phone = normalizePhone(input.phone);
    const existing = await clientRepository.findByPhone(input.businessId, phone);
    if (existing) {
      const updated = await clientRepository.update(existing._id, {
        name: input.name.trim() || existing.name,
        email: input.email ?? existing.email,
        address: input.address ?? existing.address,
      });
      return updated ?? existing;
    }
    return clientRepository.create({
      businessId: input.businessId,
      name: input.name.trim(),
      phone,
      email: input.email?.trim() || undefined,
      address: input.address?.trim() || undefined,
    });
  },

  async sendEmail(
    clientId: string,
    input: SendClientEmailInput,
    sentBy: { name: string; email: string }
  ): Promise<{ id: string }> {
    const client = await this.getById(clientId);
    const business = await businessService.getById(client.businessId);

    const to = (input.to ?? client.email)?.trim().toLowerCase();
    if (!to) {
      throw new AppError(
        "This client has no email on file. Enter a recipient address to send.",
        400,
        "NO_RECIPIENT"
      );
    }

    if (!emailService.isConfigured()) {
      throw new AppError(
        "Email is not configured. Set RESEND_API_KEY in .env",
        503,
        "EMAIL_NOT_CONFIGURED"
      );
    }

    const tpl = emailTemplates.clientMessage({
      businessName: business.name,
      clientName: client.name,
      message: input.message,
      senderName: sentBy.name,
    });

    return emailService.send({
      to,
      subject: input.subject,
      html: tpl.html,
      text: tpl.text,
      replyTo: sentBy.email,
    });
  },
};
