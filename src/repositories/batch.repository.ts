import type { Batch } from "@/domain/types";
import { mapId, toObjectId } from "@/lib/map-document";
import { BatchModel } from "@/models/batch.model";

export const batchRepository = {
  async create(data: Omit<Batch, "_id" | "createdAt">): Promise<Batch> {
    const doc = await BatchModel.create(data);
    return mapId(doc.toObject()) as Batch;
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
};
