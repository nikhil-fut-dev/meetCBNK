import mongoose from "mongoose";
import { env } from "./env.js";

export async function connectDatabase() {
  await mongoose.connect(env.mongoUri, {
    serverSelectionTimeoutMS: 10000,
  });

  console.log("MongoDB connected successfully.");
}

export function getDatabaseStatus() {
  return mongoose.connection.readyState;
}
