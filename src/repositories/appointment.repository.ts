import type { Appointment } from "@/domain/types";
import { normalizeAppointment } from "@/lib/appointment-payments";
import { mapId, toObjectId } from "@/lib/map-document";
import {
  buildPaginatedResult,
  mongoSort,
  type PaginatedResult,
  type SortDir,
} from "@/lib/pagination";
import { normalizeMongoWeekKey } from "@/lib/report-ranges";
import { AppointmentModel } from "@/models/appointment.model";

function mapAppointment(doc: { _id: unknown } & Record<string, unknown>): Appointment {
  return normalizeAppointment(mapId(doc) as unknown as Appointment);
}

export const appointmentRepository = {
  async findByBusinessPaginated(
    businessId: string,
    options: {
      status?: string;
      search?: string;
      sort?: string;
      dir?: SortDir;
      from?: Date;
      to?: Date;
      page: number;
      pageSize: number;
    }
  ): Promise<PaginatedResult<Appointment>> {
    const filter: Record<string, unknown> = { businessId };
    if (options.status) filter.status = options.status;
    if (options.from || options.to) {
      const startAt: Record<string, Date> = {};
      if (options.from) startAt.$gte = options.from;
      if (options.to) startAt.$lte = options.to;
      filter.startAt = startAt;
    }
    if (options.search?.trim()) {
      const term = options.search.trim();
      filter.$or = [
        { customerName: { $regex: term, $options: "i" } },
        { customerPhone: { $regex: term, $options: "i" } },
        { serviceName: { $regex: term, $options: "i" } },
      ];
    }
    const skip = (options.page - 1) * options.pageSize;
    const [docs, total] = await Promise.all([
      AppointmentModel.find(filter)
        .sort(mongoSort(options.sort ?? "startAt", options.dir ?? "asc"))
        .skip(skip)
        .limit(options.pageSize)
        .lean(),
      AppointmentModel.countDocuments(filter),
    ]);
    const items = docs.map((doc) => mapAppointment(doc));
    return buildPaginatedResult(items, total, options.page, options.pageSize);
  },

  /**
   * Returns the first active appointment whose time frame overlaps the given
   * window for a business. Two ranges overlap when existing.start < newEnd and
   * existing.end > newStart. Cancelled / no-show slots are ignored.
   */
  async findOverlapping(
    businessId: string,
    startAt: Date,
    endAt: Date,
    excludeId?: string
  ): Promise<Appointment | null> {
    const filter: Record<string, unknown> = {
      businessId,
      status: { $in: ["BOOKED", "COMPLETED"] },
      startAt: { $lt: endAt },
      endAt: { $gt: startAt },
    };
    if (excludeId) {
      const oid = toObjectId(excludeId);
      if (oid) filter._id = { $ne: oid };
    }
    const doc = await AppointmentModel.findOne(filter).lean();
    return doc ? mapAppointment(doc) : null;
  },

  async findById(id: string): Promise<Appointment | null> {
    const oid = toObjectId(id);
    if (!oid) return null;
    const doc = await AppointmentModel.findById(oid).lean();
    return doc ? mapAppointment(doc) : null;
  },

  async create(
    data: Omit<Appointment, "_id" | "createdAt" | "updatedAt">
  ): Promise<Appointment> {
    const doc = await AppointmentModel.create(data);
    return mapAppointment(doc.toObject());
  },

  async update(
    id: string,
    data: Partial<Omit<Appointment, "_id" | "businessId" | "createdAt">>
  ): Promise<Appointment | null> {
    const oid = toObjectId(id);
    if (!oid) return null;
    const doc = await AppointmentModel.findByIdAndUpdate(
      oid,
      { $set: { ...data, updatedAt: new Date() } },
      { new: true }
    ).lean();
    return doc ? mapAppointment(doc) : null;
  },

  /** Credit appointments with dueDate in [from, end] (all businesses). */
  async findCreditDueBetween(from: Date, to: Date): Promise<Appointment[]> {
    const docs = await AppointmentModel.find({
      saleType: "CREDIT",
      creditStatus: { $in: ["PENDING", "PARTIAL"] },
      amountDue: { $gt: 0 },
      dueDate: { $gte: from, $lte: to },
      status: { $in: ["BOOKED", "COMPLETED"] },
    }).lean();
    return docs.map((doc) => mapAppointment(doc));
  },

  /** Appointments with followUpAt in [from, end] (all businesses). */
  async findFollowUpBetween(from: Date, to: Date): Promise<Appointment[]> {
    const docs = await AppointmentModel.find({
      followUpAt: { $gte: from, $lte: to },
      status: { $in: ["BOOKED", "COMPLETED"] },
    }).lean();
    return docs.map((doc) => mapAppointment(doc));
  },

  async findForReportDetails(
    businessId: string,
    from: Date,
    to: Date
  ): Promise<
    {
      createdAt: Date;
      items: { productName: string; quantity: number; lineTotal: number }[];
      partyName: string;
    }[]
  > {
    const docs = await AppointmentModel.find({
      businessId,
      createdAt: { $gte: from, $lte: to },
      status: { $in: ["BOOKED", "COMPLETED"] },
    })
      .select("createdAt serviceName price customerName")
      .lean();
    return docs.map((doc) => ({
      createdAt: doc.createdAt as Date,
      items: [
        {
          productName: doc.serviceName as string,
          quantity: 1,
          lineTotal: doc.price as number,
        },
      ],
      partyName: (doc.customerName as string)?.trim() || "Customer",
    }));
  },

  async aggregateReport(
    businessId: string,
    from: Date,
    to: Date,
    dateFormat: string
  ): Promise<{ key: string; count: number; total: number }[]> {
    const rows = await AppointmentModel.aggregate<{
      _id: string;
      count: number;
      total: number;
    }>([
      {
        $match: {
          businessId,
          createdAt: { $gte: from, $lte: to },
          status: { $in: ["BOOKED", "COMPLETED"] },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: dateFormat, date: "$createdAt" },
          },
          count: { $sum: 1 },
          total: { $sum: "$price" },
        },
      },
      { $sort: { _id: 1 } },
    ]);
    return rows.map((r) => ({
      key: normalizeMongoWeekKey(String(r._id)),
      count: r.count,
      total: r.total,
    }));
  },

  /** Cash vs online collected from booking payment ledger in range. */
  async aggregatePaymentMethods(
    businessId: string,
    from: Date,
    to: Date
  ): Promise<{ method: string; amount: number; count: number }[]> {
    const rows = await AppointmentModel.aggregate<{
      _id: string;
      amount: number;
      count: number;
    }>([
      {
        $match: {
          businessId,
          status: { $in: ["BOOKED", "COMPLETED"] },
        },
      },
      {
        $addFields: {
          paymentEntries: {
            $cond: [
              { $gt: [{ $size: { $ifNull: ["$payments", []] } }, 0] },
              "$payments",
              {
                $cond: [
                  { $gt: [{ $ifNull: ["$amountPaid", 0] }, 0] },
                  [
                    {
                      amount: "$amountPaid",
                      method: { $ifNull: ["$paymentMethod", "CASH"] },
                      at: "$createdAt",
                    },
                  ],
                  [],
                ],
              },
            ],
          },
        },
      },
      { $unwind: "$paymentEntries" },
      {
        $match: {
          "paymentEntries.at": { $gte: from, $lte: to },
          "paymentEntries.amount": { $gt: 0 },
        },
      },
      {
        $group: {
          _id: "$paymentEntries.method",
          amount: { $sum: "$paymentEntries.amount" },
          count: { $sum: 1 },
        },
      },
    ]);
    return rows.map((r) => ({
      method: String(r._id ?? "CASH"),
      amount: r.amount,
      count: r.count,
    }));
  },
};
