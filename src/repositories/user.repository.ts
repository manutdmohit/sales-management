import { mapId, toObjectId } from "@/lib/map-document";
import type { UserRole } from "@/domain/roles";
import { normalizeRole } from "@/domain/roles";
import { UserModel } from "@/models/user.model";

export type UserRecord = {
  _id: string;
  email: string;
  passwordHash: string;
  name: string;
  role: UserRole;
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
    role: normalizeRole(doc.role as string | undefined),
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
    role?: UserRole;
  }): Promise<UserRecord> {
    const doc = await UserModel.create({
      email: data.email.toLowerCase(),
      passwordHash: data.passwordHash,
      name: data.name,
      role: data.role ?? "ADMIN",
      isActive: true,
    });
    return toUser(doc.toObject() as Record<string, unknown>);
  },

  async updateRole(id: string, role: UserRole): Promise<UserRecord | null> {
    const oid = toObjectId(id);
    if (!oid) return null;
    const doc = await UserModel.findByIdAndUpdate(
      oid,
      { $set: { role } },
      { new: true }
    ).lean();
    return doc ? toUser(doc as Record<string, unknown>) : null;
  },

  async findPaginated(options: {
    search?: string;
    page: number;
    pageSize: number;
  }): Promise<{ items: UserRecord[]; total: number }> {
    const filter: Record<string, unknown> = {};
    if (options.search?.trim()) {
      const q = options.search.trim();
      filter.$or = [
        { name: { $regex: q, $options: "i" } },
        { email: { $regex: q, $options: "i" } },
      ];
    }
    const skip = (options.page - 1) * options.pageSize;
    const [docs, total] = await Promise.all([
      UserModel.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(options.pageSize)
        .lean(),
      UserModel.countDocuments(filter),
    ]);
    return {
      items: docs.map((d) => toUser(d as Record<string, unknown>)),
      total,
    };
  },

  async countActiveByRole(role: UserRole): Promise<number> {
    return UserModel.countDocuments({ role, isActive: true });
  },

  async findActiveByRole(role: UserRole): Promise<UserRecord[]> {
    const docs = await UserModel.find({ role, isActive: true })
      .sort({ createdAt: 1 })
      .lean();
    return docs.map((d) => toUser(d as Record<string, unknown>));
  },

  async update(
    id: string,
    data: {
      name?: string;
      email?: string;
      role?: UserRole;
      isActive?: boolean;
      passwordHash?: string;
    }
  ): Promise<UserRecord | null> {
    const oid = toObjectId(id);
    if (!oid) return null;
    const patch: Record<string, unknown> = {};
    if (data.name !== undefined) patch.name = data.name;
    if (data.email !== undefined) patch.email = data.email.toLowerCase();
    if (data.role !== undefined) patch.role = data.role;
    if (data.isActive !== undefined) patch.isActive = data.isActive;
    if (data.passwordHash !== undefined) patch.passwordHash = data.passwordHash;

    const doc = await UserModel.findByIdAndUpdate(
      oid,
      { $set: patch },
      { new: true }
    ).lean();
    return doc ? toUser(doc as Record<string, unknown>) : null;
  },
};
