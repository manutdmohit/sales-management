import { mapId, toObjectId } from "@/lib/map-document";
import { UserModel } from "@/models/user.model";

export type UserRecord = {
  _id: string;
  email: string;
  passwordHash: string;
  name: string;
  isActive: boolean;
  createdAt: Date;
};

function toUser(doc: Record<string, unknown>): UserRecord {
  const mapped = mapId(doc as { _id: unknown }) as unknown as UserRecord;
  return {
    ...mapped,
    email: String(doc.email).toLowerCase(),
    passwordHash: String(doc.passwordHash),
    name: String(doc.name),
    isActive: Boolean(doc.isActive ?? true),
    createdAt: doc.createdAt as Date,
  };
}

export const userRepository = {
  async findByEmail(email: string): Promise<UserRecord | null> {
    const doc = await UserModel.findOne({
      email: email.toLowerCase(),
    }).lean();
    return doc ? toUser(doc as Record<string, unknown>) : null;
  },

  async findById(id: string): Promise<UserRecord | null> {
    const oid = toObjectId(id);
    if (!oid) return null;
    const doc = await UserModel.findById(oid).lean();
    return doc ? toUser(doc as Record<string, unknown>) : null;
  },

  async create(data: {
    email: string;
    passwordHash: string;
    name: string;
  }): Promise<UserRecord> {
    const doc = await UserModel.create({
      email: data.email.toLowerCase(),
      passwordHash: data.passwordHash,
      name: data.name,
      isActive: true,
    });
    return toUser(doc.toObject() as Record<string, unknown>);
  },
};
