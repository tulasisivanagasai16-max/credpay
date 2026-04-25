import { defineConfig } from "drizzle-kit";
import path from "path";

if (!process.env.DATABASE_URL) {
  if (process.env.MONGODB_URI) {
    console.warn(
      "Drizzle migrations are disabled because MONGODB_URI is set. MongoDB mode uses a separate data layer.",
    );
  } else {
    throw new Error("DATABASE_URL or MONGODB_URI must be set, ensure the database is provisioned");
  }
}

export default defineConfig({
  schema: path.join(__dirname, "./src/schema/index.ts"),
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
