import { connectDb } from "@/lib/db";
import {
  BatchModel,
  BusinessModel,
  InventoryTransactionModel,
  ProductModel,
  PurchaseModel,
  SaleModel,
} from "@/models";

import { UserModel } from "@/models/user.model";

let indexesEnsured = false;

export async function ensureIndexes(): Promise<void> {
  if (indexesEnsured) return;

  await connectDb();

  await Promise.all([
    UserModel.syncIndexes(),
    BusinessModel.syncIndexes(),
    ProductModel.syncIndexes(),
    InventoryTransactionModel.syncIndexes(),
    BatchModel.syncIndexes(),
    SaleModel.syncIndexes(),
    PurchaseModel.syncIndexes(),
  ]);

  indexesEnsured = true;
}
