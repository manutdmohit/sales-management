import { Types } from "mongoose";

export function toObjectId(id: string): Types.ObjectId | null {
  if (!Types.ObjectId.isValid(id)) return null;
  return new Types.ObjectId(id);
}

export function mapId<T extends { _id: unknown }>(
  doc: T
): Omit<T, "_id"> & { _id: string } {
  const { _id, ...rest } = doc;
  return { ...rest, _id: String(_id) } as Omit<T, "_id"> & { _id: string };
}
