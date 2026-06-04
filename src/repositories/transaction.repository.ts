import type { TransactionKind, TransactionListItem } from "@/domain/types";
import type { Appointment } from "@/domain/types";
import type { Sale } from "@/domain/types";
import { resolveAppointmentPayments } from "@/lib/appointment-payments";
import { mapId } from "@/lib/map-document";
import {
  buildPaginatedResult,
  type PaginatedResult,
  type SortDir,
} from "@/lib/pagination";
import { AppointmentModel } from "@/models/appointment.model";
import { SaleModel } from "@/models/sale.model";

export type TransactionKindFilter = "all" | "sale" | "booking";

const APPOINTMENT_STATUS_LABELS: Record<string, string> = {
  BOOKED: "Booked",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  NO_SHOW: "No show",
};

function formatBookingStatus(status: string): string {
  return APPOINTMENT_STATUS_LABELS[status] ?? status.replace(/_/g, " ");
}

function saleItemDetail(items: Sale["items"]): string {
  if (items.length === 0) return "No items";
  if (items.length === 1) return items[0].productName;
  return `${items[0].productName} +${items.length - 1} more`;
}

export function saleToTransaction(sale: Sale): TransactionListItem {
  return {
    _id: sale._id,
    kind: "SALE",
    occurredAt: new Date(sale.createdAt),
    customerName: sale.customer?.name?.trim() || "Walk-in",
    customerPhone: sale.customer?.phone?.trim() || "",
    clientId: sale.clientId,
    reference: sale.invoiceNumber,
    detail: saleItemDetail(sale.items),
    amount: sale.total,
    paymentMethod: sale.paymentMethod,
    saleType: sale.saleType,
    creditStatus: sale.creditStatus,
    items: sale.items,
    payments: sale.payments,
  };
}

export function appointmentToTransaction(
  appointment: Appointment
): TransactionListItem {
  const payments = resolveAppointmentPayments(appointment);
  return {
    _id: appointment._id,
    kind: "BOOKING",
    occurredAt: new Date(appointment.startAt),
    customerName: appointment.customerName,
    customerPhone: appointment.customerPhone,
    clientId: appointment.clientId,
    reference: appointment.serviceName,
    detail: formatBookingStatus(appointment.status),
    amount: appointment.price,
    paymentMethod: appointment.paymentMethod,
    saleType: appointment.saleType,
    creditStatus: appointment.creditStatus,
    status: appointment.status,
    startAt: new Date(appointment.startAt),
    endAt: new Date(appointment.endAt),
    bookedAt: new Date(appointment.createdAt),
    paymentReceipt: appointment.paymentReceipt,
    payments,
  };
}

function buildSearchFilter(
  search: string | undefined,
  kind: "sale" | "booking"
): Record<string, unknown> {
  if (!search?.trim()) return {};
  const term = search.trim();
  if (kind === "sale") {
    return {
      $or: [
        { invoiceNumber: { $regex: term, $options: "i" } },
        { "customer.name": { $regex: term, $options: "i" } },
        { "customer.phone": { $regex: term, $options: "i" } },
      ],
    };
  }
  return {
    $or: [
      { customerName: { $regex: term, $options: "i" } },
      { customerPhone: { $regex: term, $options: "i" } },
      { serviceName: { $regex: term, $options: "i" } },
    ],
  };
}

type AggregatedRow = {
  _id: unknown;
  kind: TransactionKind;
  occurredAt: Date;
  customerName: string;
  customerPhone: string;
  clientId?: string;
  reference: string;
  detail: string;
  amount: number;
  paymentMethod?: string;
  saleType?: string;
  creditStatus?: string;
  status?: string;
  items?: Sale["items"];
  payments?: Sale["payments"];
  startAt?: Date;
  endAt?: Date;
  bookedAt?: Date;
  paymentReceipt?: Appointment["paymentReceipt"];
};

function mapAggregatedRow(row: AggregatedRow): TransactionListItem {
  return {
    _id: String(row._id),
    kind: row.kind,
    occurredAt: new Date(row.occurredAt),
    customerName: row.customerName,
    customerPhone: row.customerPhone ?? "",
    clientId: row.clientId,
    reference: row.reference,
    detail:
      row.kind === "BOOKING" && row.status
        ? formatBookingStatus(row.status)
        : row.detail,
    amount: row.amount,
    paymentMethod: row.paymentMethod as TransactionListItem["paymentMethod"],
    saleType: row.saleType as TransactionListItem["saleType"],
    creditStatus: row.creditStatus as TransactionListItem["creditStatus"],
    status: row.status as TransactionListItem["status"],
    items: row.items,
    payments: row.payments,
    startAt: row.startAt ? new Date(row.startAt) : undefined,
    endAt: row.endAt ? new Date(row.endAt) : undefined,
    bookedAt: row.bookedAt ? new Date(row.bookedAt) : undefined,
    paymentReceipt: row.paymentReceipt,
  };
}

const saleProject = {
  kind: { $literal: "SALE" as const },
  occurredAt: "$createdAt",
  customerName: {
    $ifNull: [{ $trim: { input: "$customer.name" } }, "Walk-in"],
  },
  customerPhone: { $ifNull: ["$customer.phone", ""] },
  clientId: 1,
  reference: "$invoiceNumber",
  detail: {
    $cond: {
      if: { $eq: [{ $size: "$items" }, 0] },
      then: "No items",
      else: {
        $let: {
          vars: {
            count: { $size: "$items" },
            first: { $arrayElemAt: ["$items.productName", 0] },
          },
          in: {
            $cond: {
              if: { $eq: ["$$count", 1] },
              then: "$$first",
              else: {
                $concat: [
                  "$$first",
                  " +",
                  { $toString: { $subtract: ["$$count", 1] } },
                  " more",
                ],
              },
            },
          },
        },
      },
    },
  },
  amount: "$total",
  paymentMethod: 1,
  saleType: 1,
  creditStatus: 1,
  status: { $literal: null },
  items: 1,
  payments: 1,
  startAt: { $literal: null },
  endAt: { $literal: null },
  bookedAt: { $literal: null },
  paymentReceipt: { $literal: null },
};

const bookingProject = {
  kind: { $literal: "BOOKING" as const },
  occurredAt: "$startAt",
  customerName: 1,
  customerPhone: 1,
  clientId: 1,
  reference: "$serviceName",
  detail: "$status",
  amount: "$price",
  paymentMethod: 1,
  saleType: 1,
  creditStatus: 1,
  status: 1,
  items: { $literal: null },
  payments: { $literal: null },
  startAt: 1,
  endAt: 1,
  bookedAt: "$createdAt",
  paymentReceipt: 1,
};

export const transactionRepository = {
  async findPaginated(
    businessId: string,
    options: {
      kind: TransactionKindFilter;
      search?: string;
      sort?: string;
      dir?: SortDir;
      page: number;
      pageSize: number;
    }
  ): Promise<PaginatedResult<TransactionListItem>> {
    const { kind, page, pageSize, search } = options;
    const skip = (page - 1) * pageSize;

    if (kind === "sale") {
      const filter = { businessId, ...buildSearchFilter(search, "sale") };
      const [docs, total] = await Promise.all([
        SaleModel.find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(pageSize)
          .lean(),
        SaleModel.countDocuments(filter),
      ]);
      const items = docs.map((doc) => saleToTransaction(mapId(doc) as Sale));
      return buildPaginatedResult(items, total, page, pageSize);
    }

    if (kind === "booking") {
      const filter = { businessId, ...buildSearchFilter(search, "booking") };
      const [docs, total] = await Promise.all([
        AppointmentModel.find(filter)
          .sort({ startAt: -1 })
          .skip(skip)
          .limit(pageSize)
          .lean(),
        AppointmentModel.countDocuments(filter),
      ]);
      const items = docs.map((doc) =>
        appointmentToTransaction(mapId(doc) as Appointment)
      );
      return buildPaginatedResult(items, total, page, pageSize);
    }

    const saleMatch = { businessId, ...buildSearchFilter(search, "sale") };
    const bookingMatch = { businessId, ...buildSearchFilter(search, "booking") };

    const pipeline = [
      { $match: saleMatch },
      { $project: saleProject },
      {
        $unionWith: {
          coll: "appointments",
          pipeline: [
            { $match: bookingMatch },
            { $project: bookingProject },
          ],
        },
      },
      { $sort: { occurredAt: -1 as const } },
      {
        $facet: {
          items: [{ $skip: skip }, { $limit: pageSize }],
          total: [{ $count: "count" }],
        },
      },
    ];

    const [result] = await SaleModel.aggregate<{
      items: AggregatedRow[];
      total: { count: number }[];
    }>(pipeline);

    const items = (result?.items ?? []).map(mapAggregatedRow);
    const total = result?.total?.[0]?.count ?? 0;
    return buildPaginatedResult(items, total, page, pageSize);
  },
};
