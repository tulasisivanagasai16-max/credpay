import { Router, type IRouter } from "express";
import {
  ListPayeesResponse,
  CreatePayeeBody,
  CreatePayeeResponse,
} from "@workspace/api-zod";
import { db, payeesTable } from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import { requireUser } from "../middlewares/auth";

const router: IRouter = Router();

function maskAccount(id: string): string {
  if (id.length <= 4) return id;
  return `${"X".repeat(id.length - 4)}${id.slice(-4)}`;
}

router.get("/payees", requireUser, async (req, res) => {
  const u = req.user!;
  const rows = await db
    .select()
    .from(payeesTable)
    .where(eq(payeesTable.userId, u.id))
    .orderBy(desc(payeesTable.createdAt));
  res.json(
    ListPayeesResponse.parse({
      items: rows.map((p) => ({
        id: p.id,
        label: p.label,
        type: p.type,
        identifier: p.type === "BANK" ? maskAccount(p.identifier) : p.identifier,
        ifsc: p.ifsc,
        createdAt: p.createdAt.toISOString(),
      })),
    }),
  );
});

router.post("/payees", requireUser, async (req, res) => {
  const u = req.user!;
  const body = CreatePayeeBody.parse(req.body);
  const [created] = await db
    .insert(payeesTable)
    .values({
      userId: u.id,
      label: body.label,
      type: body.type,
      identifier: body.identifier,
      ifsc: body.ifsc ?? null,
    })
    .returning();
  res.json(
    CreatePayeeResponse.parse({
      id: created!.id,
      label: created!.label,
      type: created!.type,
      identifier:
        created!.type === "BANK" ? maskAccount(created!.identifier) : created!.identifier,
      ifsc: created!.ifsc,
      createdAt: created!.createdAt.toISOString(),
    }),
  );
});

export default router;
