import mongoose from "mongoose";

/**
 * Connects to MongoDB if MONGO_URI is set and reachable. If it's missing or
 * the connection fails, we log a warning and let the app continue with the
 * in-memory conversation store (see services/store.js). This is intentional:
 * a demo should never be blocked by an optional persistence layer.
 */
export async function connectMongo() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.log("[db] MONGO_URI not set — using in-memory conversation store");
    return { connected: false };
  }

  try {
    mongoose.set("strictQuery", true);
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
    console.log("[db] Connected to MongoDB");
    return { connected: true };
  } catch (err) {
    console.warn(
      `[db] Failed to connect to MongoDB (${err.message}) — falling back to in-memory store`
    );
    return { connected: false, error: err };
  }
}

export function isMongoConnected() {
  return mongoose.connection.readyState === 1;
}
