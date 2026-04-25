import { MongoClient, type Db } from "mongodb";

if (!process.env.MONGODB_URI) {
  throw new Error(
    "MONGODB_URI must be set when using MongoDB. Add it to your environment or .env file.",
  );
}

const mongoClient = new MongoClient(process.env.MONGODB_URI, {
  maxPoolSize: 10,
});

let dbInstance: Db | null = null;

export async function connectMongo(): Promise<Db> {
  if (!dbInstance) {
    await mongoClient.connect();
    const dbName = process.env.MONGODB_DB_NAME || "credpay";
    dbInstance = mongoClient.db(dbName);
  }

  return dbInstance;
}

export function getMongoClient(): MongoClient {
  return mongoClient;
}

export async function getMongoDb(): Promise<Db> {
  return connectMongo();
}
