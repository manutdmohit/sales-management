import type { Receivable } from "@/domain/types";
import { mapId } from "@/lib/map-document";
import {
  buildPaginatedResult,
  type PaginatedResult,
  type SortDir,
} from "@/lib/pagination";
import { AppointmentModel } from "@/models/appointment.model";
import { SaleModel } from "@/models/sale.model";

const ACTIVE_BOOKING_STATUSES = ["BOOKED", "COMPLETED"];

function buildSaleMatch(
  businessId: string,
  outstandingOnly: boolean,
  search?: string
): Record<string, unknown> {
  const filter: Record<string, unknown> = {
    businessId,
    saleType: "CREDIT",
  };
  if (outstandingOnly) {
    filter.creditStatus = { $in: ["PENDING", "PARTIAL"] };
  }
  if (search?.trim()) {
    const term = search.trim();
    filter.$or = [
      { invoiceNumber: { $regex: term, $options: "i" } },
      { "customer.name": { $regex: term, $options: "i" } },
      { "customer.phone": { $regex: term, $options: "i" } },
    ];
  }
  return filter;
}

function buildAppointmentMatch(
  businessId: string,
  outstandingOnly: boolean,
  search?: string
): Record<string, unknown> {
  const filter: Record<string, unknown> = {
    businessId,
    saleType: "CREDIT",
    status: { $in: ACTIVE_BOOKING_STATUSES },
  };
  if (outstandingOnly) {
    filter.creditStatus = { $in: ["PENDING", "PARTIAL"] };
    filter.amountDue = { $gt: 0 };
  }
  if (search?.trim()) {
    const term = search.trim();
    filter.$or = [
      { customerName: { $regex: term, $options: "i" } },
      { customerPhone: { $regex: term, $options: "i" } },
      { serviceName: { $regex: term, $options: "i" } },
    ];
  }
  return filter;
}

function sortFieldForUnion(sort: string): string {
  return sort === "customer.name" ? "customerName" : sort;
}

const saleProject = {
  source: { $literal: "sale" },
  businessId: 1,
  reference: "$invoiceNumber",
  customerName: { $ifNull: ["$customer.name", "Walk-in"] },
  customerPhone: { $ifNull: ["$customer.phone", ""] },
  clientId: 1,
  total: 1,
  amountPaid: 1,
  amountDue: 1,
  creditStatus: 1,
  dueDate: 1,
  payments: { $ifNull: ["$payments", []] },
  createdAt: 1,
};

const appointmentProject = {
  source: { $literal: "booking" },
  businessId: 1,
  reference: "$serviceName",
  customerName: 1,
  customerPhone: 1,
  clientId: 1,
  total: "$price",
  amountPaid: { $ifNull: ["$amountPaid", 0] },
  amountDue: { $ifNull: ["$amountDue", 0] },
  creditStatus: 1,
  dueDate: 1,
  serviceName: 1,
  appointmentDate: "$startAt",
  createdAt: 1,
  payments: {
    $cond: [
      { $gt: [{ $size: { $ifNull: ["$payments", []] } }, 0] },
      "$payments",
      {
        $cond: [
          {
            $and: [
              { $gt: [{ $ifNull: ["$amountPaid", 0] }, 0] },
              { $ifNull: ["$paymentReceipt", false] },
            ],
          },
          [
            {
              amount: "$amountPaid",
              method: { $ifNull: ["$paymentMethod", "CASH"] },
              at: "$createdAt",
              receipt: "$paymentReceipt",
            },
          ],
          [],
        ],
      },
    ],
  },
};

export const receivableRepository = {
  async findPaginated(
    businessId: string,
    options: {
      outstandingOnly?: boolean;
      search?: string;
      sort?: string;
      dir?: SortDir;
      page: number;
      pageSize: number;
    }
  ): Promise<PaginatedResult<Receivable>> {
    const outstandingOnly = options.outstandingOnly ?? false;
    const saleMatch = buildSaleMatch(businessId, outstandingOnly, options.search);
    const apptMatch = buildAppointmentMatch(
      businessId,
      outstandingOnly,
      options.search
    );
    const sortKey = sortFieldForUnion(options.sort ?? "dueDate");
    const sortDir = options.dir === "desc" ? -1 : 1;
    const skip = (options.page - 1) * options.pageSize;

    const [saleCount, apptCount, rows] = await Promise.all([
      SaleModel.countDocuments(saleMatch),
      AppointmentModel.countDocuments(apptMatch),
      SaleModel.aggregate([
        { $match: saleMatch },
        { $project: saleProject },
        {
          $unionWith: {
            coll: "appointments",
            pipeline: [
              { $match: apptMatch },
              { $project: appointmentProject },
            ],
          },
        },
        { $sort: { [sortKey]: sortDir, createdAt: -1 } },
        { $skip: skip },
        { $limit: options.pageSize },
      ]),
    ]);

    const items = rows.map((row) => mapId(row) as Receivable);
    return buildPaginatedResult(
      items,
      saleCount + apptCount,
      options.page,
      options.pageSize
    );
  },
};
