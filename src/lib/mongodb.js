import mongoose from "mongoose";
import dns from "dns";

dns.setDefaultResultOrder("ipv4first");

let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

export async function connectMongo() {
  try {
    const MONGODB_URI = process.env.MONGODB_URI;
    console.log("Connecting to MongoDB...")
    if (!MONGODB_URI) {
      throw new Error("Missing MONGODB_URI environment variable");
    }

    if (cached.conn) {
      return cached.conn;
    }

    if (!cached.promise) {
      cached.promise = mongoose.connect(MONGODB_URI, {
        bufferCommands: false,
        serverSelectionTimeoutMS: 10000,
      });
    }
    cached.conn = await cached.promise;
    console.log("Mongodb Connected")
    return cached.conn;
  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
    throw error;
  }
}