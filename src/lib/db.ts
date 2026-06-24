import dns from "node:dns";
import mongoose from "mongoose";

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB_NAME ?? "inventory_platform";

// Some local DNS resolvers fail MongoDB Atlas SRV lookups (querySrv ECONNREFUSED).
if (uri?.startsWith("mongodb+srv://")) {
  dns.setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1"]);
}

declare global {
  // eslint-disable-next-line no-var
  var _mongooseConn: {
    conn: typeof mongoose | null;
    promise: Promise<typeof mongoose> | null;
  };
}

export async function connectDb(): Promise<typeof mongoose> {
  if (!uri) {
    throw new Error("MONGODB_URI is not set");
  }

  if (!global._mongooseConn) {
    global._mongooseConn = { conn: null, promise: null };
  }

  const cached = global._mongooseConn;

  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    cached.promise = mongoose.connect(uri, { dbName });
  }

  cached.conn = await cached.promise;
  return cached.conn;
}
