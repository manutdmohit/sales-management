import type { Business, BusinessType } from "@/domain/types";
import { mapId, toObjectId } from "@/lib/map-document";
import { BusinessModel } from "@/models/business.model";

function toBusiness(doc: Record<string, unknown>): Business {
  const mapped = mapId(doc as { _id: unknown }) as unknown as Business;
  return {
    ...mapped,
    type: (doc.type as BusinessType | undefined) ?? "GENERAL",
  };
}

export const businessRepository = {
  async findAll(activeOnly = true): Promise<Business[]> {
    const filter = activeOnly ? { isActive: true } : {};
    const docs = await BusinessModel.find(filter).sort({ name: 1 }).lean();
    return docs.map((doc) => toBusiness(doc as Record<string, unknown>));
  },

  async findById(id: string): Promise<Business | null> {
    const oid = toObjectId(id);
    if (!oid) return null;
    const doc = await BusinessModel.findById(oid).lean();
    return doc ? toBusiness(doc as Record<string, unknown>) : null;
  },

  async findBySlug(slug: string): Promise<Business | null> {
    const doc = await BusinessModel.findOne({ slug }).lean();
    return doc ? toBusiness(doc as Record<string, unknown>) : null;
  },

  async create(
    data: Omit<Business, "_id" | "createdAt">
  ): Promise<Business> {
    const doc = await BusinessModel.create({
      name: data.name,
      slug: data.slug,
      code: data.code,
      type: data.type,
      isActive: data.isActive,
      settings: data.settings ?? {},
    });
    return toBusiness(doc.toObject() as Record<string, unknown>);
  },

  async update(
    id: string,
    data: Partial<Pick<Business, "name" | "type" | "isActive" | "settings">>
  ): Promise<Business | null> {
    const oid = toObjectId(id);
    if (!oid) return null;
    const doc = await BusinessModel.findByIdAndUpdate(
      oid,
      { $set: data },
      { new: true }
    ).lean();
    return doc ? toBusiness(doc as Record<string, unknown>) : null;
  },
};
