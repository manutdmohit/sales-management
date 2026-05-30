import type { InventoryTransaction } from "@/domain/types";
import { mapId } from "@/lib/map-document";
import { InventoryTransactionModel } from "@/models/inventory-transaction.model";

export const inventoryRepository = {
  async findByProduct(
    businessId: string,
    productId: string
  ): Promise<InventoryTransaction[]> {
    const docs = await InventoryTransactionModel.find({ businessId, productId })
      .sort({ timestamp: 1 })
      .lean();
    return docs.map((doc) => mapId(doc) as InventoryTransaction);
  },

  async findByBusiness(businessId: string): Promise<InventoryTransaction[]> {
    const docs = await InventoryTransactionModel.find({ businessId }).lean();
    return docs.map((doc) => mapId(doc) as InventoryTransaction);
  },

  async aggregateStockByBusiness(
    businessId: string
  ): Promise<{ productId: string; stock: number }[]> {
    return InventoryTransactionModel.aggregate([
      { $match: { businessId } },
      {
        $group: {
          _id: "$productId",
          stock: {
            $sum: {
              $switch: {
                branches: [
                  {
                    case: { $in: ["$type", ["PURCHASE", "RETURN"]] },
                    then: { $abs: "$quantity" },
                  },
                  {
                    case: { $in: ["$type", ["SALE", "DAMAGE", "EXPIRED"]] },
                    then: { $multiply: [{ $abs: "$quantity" }, -1] },
                  },
                  {
                    case: { $eq: ["$type", "ADJUSTMENT"] },
                    then: "$quantity",
                  },
                ],
                default: 0,
              },
            },
          },
        },
      },
      { $project: { productId: "$_id", stock: 1, _id: 0 } },
    ]);
  },

  async create(
    data: Omit<InventoryTransaction, "_id">
  ): Promise<InventoryTransaction> {
    const doc = await InventoryTransactionModel.create(data);
    return mapId(doc.toObject()) as InventoryTransaction;
  },

  async createMany(
    items: Omit<InventoryTransaction, "_id">[]
  ): Promise<InventoryTransaction[]> {
    if (items.length === 0) return [];
    const docs = await InventoryTransactionModel.insertMany(items);
    return docs.map((doc) => mapId(doc.toObject()) as InventoryTransaction);
  },
};
