import type { Batch } from "@/domain/types";
import { mapId, toObjectId } from "@/lib/map-document";
import { BatchModel } from "@/models/batch.model";

export const batchRepository = {
  async findById(id: string): Promise<Batch | null> {
    const oid = toObjectId(id);
    if (!oid) return null;
    const doc = await BatchModel.findById(oid).lean();
    return doc ? (mapId(doc) as Batch) : null;
  },

  async create(data: Omit<Batch, "_id" | "createdAt">): Promise<Batch> {
    const doc = await BatchModel.create(data);
    return mapId(doc.toObject()) as Batch;
  },

  async findByPurchaseId(purchaseId: string): Promise<Batch[]> {
    const docs = await BatchModel.find({ purchaseId })
      .sort({ createdAt: 1 })
      .lean();
    return docs.map((doc) => mapId(doc) as Batch);
  },

  async updateBatchMeta(
    id: string,
    data: { batchNumber?: string; expiryDate?: Date | null }
  ): Promise<Batch | null> {
    const oid = toObjectId(id);
    if (!oid) return null;
    const update: Record<string, unknown> = {};
    if (data.batchNumber !== undefined) update.batchNumber = data.batchNumber;
    if (data.expiryDate !== undefined) {
      update.expiryDate = data.expiryDate ?? undefined;
    }
    const doc = await BatchModel.findByIdAndUpdate(
      oid,
      { $set: update },
      { new: true }
    ).lean();
    return doc ? (mapId(doc) as Batch) : null;
  },

  async decrementRemaining(
    batchId: string,
    quantity: number
  ): Promise<Batch | null> {
    const oid = toObjectId(batchId);
    if (!oid) return null;
    const doc = await BatchModel.findOneAndUpdate(
      { _id: oid, remainingQuantity: { $gte: quantity } },
      { $inc: { remainingQuantity: -quantity } },
      { new: true }
    ).lean();
    return doc ? (mapId(doc) as Batch) : null;
  },

  async findByProduct(
    businessId: string,
    productId: string
  ): Promise<Batch[]> {
    const docs = await BatchModel.find({
      businessId,
      productId,
      remainingQuantity: { $gt: 0 },
    })
      .sort({ expiryDate: 1 })
      .lean();
    return docs.map((doc) => mapId(doc) as Batch);
  },

  /** Batches with stock on hand and an expiry date (for expiry alerts). */
  async findActiveWithExpiry(businessId?: string): Promise<Batch[]> {
    const filter: Record<string, unknown> = {
      remainingQuantity: { $gt: 0 },
      expiryDate: { $exists: true, $ne: null },
    };
    if (businessId) filter.businessId = businessId;
    const docs = await BatchModel.find(filter).sort({ expiryDate: 1 }).lean();
    return docs.map((doc) => mapId(doc) as Batch);
  },
};
