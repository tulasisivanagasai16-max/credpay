import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

export const isMongo = Boolean(process.env.MONGODB_URI);

if (!isMongo && !process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set for PostgreSQL mode. If you want MongoDB, set MONGODB_URI instead.",
  );
}

export const mongoClient = isMongo ? import("./mongo").then(m => m.getMongoClient()) : undefined;
export const mongoDb = isMongo ? import("./mongo").then(m => m.getMongoDb()) : undefined;

export const pool = !isMongo
  ? new Pool({ connectionString: process.env.DATABASE_URL })
  : undefined;

export const db = !isMongo && pool ? drizzle(pool, { schema }) : undefined;

export * from "./schema";
