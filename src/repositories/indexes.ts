import { connectDb } from "@/lib/db";
import {
  AppointmentModel,
  BatchModel,
  BusinessModel,
  InventoryTransactionModel,
  ProductModel,
  PurchaseModel,
  SaleModel,
  ServiceModel,
  NotificationModel,
  ClientModel,
} from "@/models";

import { UserModel } from "@/models/user.model";
import { SupplierModel } from "@/models/supplier.model";
import { ProductCategoryModel } from "@/models/product-category.model";
import { ReminderDispatchModel } from "@/models/reminder-dispatch.model";
import { ProductionRunModel } from "@/models/production-run.model";

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
    ServiceModel.syncIndexes(),
    AppointmentModel.syncIndexes(),
    NotificationModel.syncIndexes(),
    ClientModel.syncIndexes(),
    SupplierModel.syncIndexes(),
    ProductCategoryModel.syncIndexes(),
    ReminderDispatchModel.syncIndexes(),
    ProductionRunModel.syncIndexes(),
  ]);

  indexesEnsured = true;
}
