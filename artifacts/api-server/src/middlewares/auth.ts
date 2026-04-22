// Demo auth middleware — pulls a single demo user.
// In production this validates JWT (RS256) issued by the Auth Service and
// optionally checks a refresh-token rotation chain. RBAC via JWT claims.

import type { Request, Response, NextFunction } from "express";
import { db } from "@workspace/db";
import { usersTable, type User } from "@workspace/db";
import { eq } from "drizzle-orm";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

const DEMO_EMAIL = "asha@coinwallet.demo";

export async function ensureDemoUser(): Promise<User> {
  const existing = (
    await db.select().from(usersTable).where(eq(usersTable.email, DEMO_EMAIL))
  )[0];
  if (existing) return existing;
  const [created] = await db
    .insert(usersTable)
    .values({ email: DEMO_EMAIL, name: "Asha Iyer", role: "admin" })
    .returning();
  return created!;
}

export async function requireUser(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  // The "session" is just the demo user for this build. Real impl: parse Bearer JWT.
  req.user = await ensureDemoUser();
  next();
}
