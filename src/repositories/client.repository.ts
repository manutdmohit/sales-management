import type {
  Appointment,
  Client,
  ClientPurchaseRecord,
  ClientServiceRecord,
  ClientStats,
  Sale,
} from "@/domain/types";
import { mapId, toObjectId } from "@/lib/map-document";
import {
  buildPaginatedResult,
  mongoSort,
  type PaginatedResult,
  type SortDir,
} from "@/lib/pagination";
import { AppointmentModel } from "@/models/appointment.model";
import { ClientModel } from "@/models/client.model";
import { SaleModel } from "@/models/sale.model";

export function normalizePhone(phone: string): string {
  return phone.trim();
}

export const clientRepository = {
  async findByBusinessPaginated(
    businessId: string,
    options: {
      search?: string;
      sort?: string;
      dir?: SortDir;
      page: number;
      pageSize: number;
    }
  ): Promise<PaginatedResult<Client>> {
    const filter: Record<string, unknown> = { businessId };
    if (options.search?.trim()) {
      const q = options.search.trim();
      filter.$or = [
        { name: { $regex: q, $options: "i" } },
        { phone: { $regex: q, $options: "i" } },
        { email: { $regex: q, $options: "i" } },
        { address: { $regex: q, $options: "i" } },
      ];
    }
    const skip = (options.page - 1) * options.pageSize;
    const [docs, total] = await Promise.all([
      ClientModel.find(filter)
        .sort(mongoSort(options.sort ?? "name", options.dir ?? "asc"))
        .skip(skip)
        .limit(options.pageSize)
        .lean(),
      ClientModel.countDocuments(filter),
    ]);
    const items = docs.map((doc) => mapId(doc) as Client);
    return buildPaginatedResult(items, total, options.page, options.pageSize);
  },

  async findById(id: string): Promise<Client | null> {
    const oid = toObjectId(id);
    if (!oid) return null;
    const doc = await ClientModel.findById(oid).lean();
    return doc ? (mapId(doc) as Client) : null;
  },

  async findByPhone(
    businessId: string,
    phone: string
  ): Promise<Client | null> {
    const doc = await ClientModel.findOne({
      businessId,
      phone: normalizePhone(phone),
    }).lean();
    return doc ? (mapId(doc) as Client) : null;
  },

  async create(
    data: Omit<Client, "_id" | "createdAt" | "updatedAt">
  ): Promise<Client> {
    const doc = await ClientModel.create({
      ...data,
      phone: normalizePhone(data.phone),
      email: data.email?.trim() || undefined,
      address: data.address?.trim() || undefined,
      updatedAt: new Date(),
    });
    return mapId(doc.toObject()) as Client;
  },

  async update(
    id: string,
    data: Partial<Omit<Client, "_id" | "businessId" | "createdAt">>
  ): Promise<Client | null> {
    const oid = toObjectId(id);
    if (!oid) return null;
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (data.name !== undefined) patch.name = data.name;
    if (data.address !== undefined) {
      patch.address = data.address.trim() || undefined;
    }
    if (data.email !== undefined) patch.email = data.email.trim() || undefined;
    if (data.phone !== undefined) patch.phone = normalizePhone(data.phone);

    const doc = await ClientModel.findByIdAndUpdate(
      oid,
      { $set: patch },
      { new: true }
    ).lean();
    return doc ? (mapId(doc) as Client) : null;
  },

  /** Sales linked to a client either by id or by the captured customer phone. */
  saleFilter(clientId: string, phone: string): Record<string, unknown> {
    return { $or: [{ clientId }, { "customer.phone": normalizePhone(phone) }] };
  },

  /** Appointments linked to a client either by id or captured customer phone. */
  appointmentFilter(clientId: string, phone: string): Record<string, unknown> {
    return { $or: [{ clientId }, { customerPhone: normalizePhone(phone) }] };
  },

  async findServiceHistoryPaginated(
    businessId: string,
    clientId: string,
    phone: string,
    options: { page: number; pageSize: number }
  ): Promise<PaginatedResult<ClientServiceRecord>> {
    const filter = {
      businessId,
      ...this.appointmentFilter(clientId, phone),
    };
    const skip = (options.page - 1) * options.pageSize;
    const [docs, total] = await Promise.all([
      AppointmentModel.find(filter)
        .sort({ startAt: -1 })
        .skip(skip)
        .limit(options.pageSize)
        .lean(),
      AppointmentModel.countDocuments(filter),
    ]);
    const items = docs.map((doc) => mapServiceRecord(mapId(doc) as Appointment));
    return buildPaginatedResult(items, total, options.page, options.pageSize);
  },

  async findPurchaseHistoryPaginated(
    businessId: string,
    clientId: string,
    phone: string,
    options: { search?: string; page: number; pageSize: number }
  ): Promise<PaginatedResult<ClientPurchaseRecord>> {
    const filter: Record<string, unknown> = {
      businessId,
      ...this.saleFilter(clientId, phone),
    };
    if (options.search?.trim()) {
      const q = options.search.trim();
      filter.$and = [
        {
          $or: [
            { invoiceNumber: { $regex: q, $options: "i" } },
            { "items.productName": { $regex: q, $options: "i" } },
          ],
        },
      ];
    }
    const skip = (options.page - 1) * options.pageSize;
    const [docs, total] = await Promise.all([
      SaleModel.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(options.pageSize)
        .lean(),
      SaleModel.countDocuments(filter),
    ]);
    const items = docs.map((doc) => mapPurchaseRecord(mapId(doc) as Sale));
    return buildPaginatedResult(items, total, options.page, options.pageSize);
  },

  /** Aggregate counters for the client profile header (no full document loads). */
  async getStats(
    businessId: string,
    clientId: string,
    phone: string
  ): Promise<ClientStats> {
    const saleMatch = { businessId, ...this.saleFilter(clientId, phone) };
    const apptMatch = {
      businessId,
      ...this.appointmentFilter(clientId, phone),
    };

    const [saleAgg, apptAgg, lastSale, lastAppt] = await Promise.all([
      SaleModel.aggregate<{
        count: number;
        total: number;
        outstanding: number;
      }>([
        { $match: saleMatch },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            total: { $sum: "$total" },
            outstanding: { $sum: "$amountDue" },
          },
        },
      ]),
      AppointmentModel.aggregate<{
        count: number;
        spend: number;
        outstanding: number;
      }>([
        { $match: apptMatch },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            spend: {
              $sum: {
                $cond: [
                  { $in: ["$status", ["BOOKED", "COMPLETED"]] },
                  "$price",
                  0,
                ],
              },
            },
            outstanding: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $eq: ["$saleType", "CREDIT"] },
                      { $in: ["$status", ["BOOKED", "COMPLETED"]] },
                    ],
                  },
                  { $ifNull: ["$amountDue", 0] },
                  0,
                ],
              },
            },
          },
        },
      ]),
      SaleModel.findOne(saleMatch).sort({ createdAt: -1 }).select("createdAt").lean(),
      AppointmentModel.findOne(apptMatch)
        .sort({ startAt: -1 })
        .select("startAt")
        .lean(),
    ]);

    const sale = saleAgg[0];
    const appt = apptAgg[0];
    const dates = [
      (lastSale as { createdAt?: Date } | null)?.createdAt,
      (lastAppt as { startAt?: Date } | null)?.startAt,
    ].filter(Boolean) as Date[];
    const lastVisit =
      dates.length > 0
        ? new Date(Math.max(...dates.map((d) => new Date(d).getTime())))
        : undefined;

    return {
      purchaseCount: sale?.count ?? 0,
      purchaseTotal: sale?.total ?? 0,
      outstandingCredit: (sale?.outstanding ?? 0) + (appt?.outstanding ?? 0),
      bookingCount: appt?.count ?? 0,
      serviceSpend: appt?.spend ?? 0,
      lastVisit,
    };
  },
};

function mapServiceRecord(a: Appointment): ClientServiceRecord {
  return {
    appointmentId: a._id,
    serviceName: a.serviceName,
    price: a.price,
    startAt: a.startAt,
    endAt: a.endAt,
    status: a.status,
    paymentReceipt: a.paymentReceipt,
  };
}

function mapPurchaseRecord(sale: Sale): ClientPurchaseRecord {
  return {
    saleId: sale._id,
    invoiceNumber: sale.invoiceNumber,
    total: sale.total,
    amountDue: sale.amountDue,
    saleType: sale.saleType,
    paymentMethod: sale.paymentMethod,
    itemCount: sale.items.length,
    items: sale.items.map((i) => ({
      productName: i.productName,
      quantity: i.quantity,
      lineTotal: i.lineTotal,
    })),
    createdAt: sale.createdAt,
    payments: sale.payments,
  };
}
