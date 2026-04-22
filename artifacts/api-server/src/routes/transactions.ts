import { Router, type IRouter } from "express";
import {
  ListTransactionsQueryParams,
  ListTransactionsResponse,
  GetTransactionParams,
  GetTransactionResponse,
} from "@workspace/api-zod";
import { db, transactionsTable, ledgerEntriesTable, ledgerAccountsTable } from "@workspace/db";
import { and, desc, eq } from "drizzle-orm";
import { requireUser } from "../middlewares/auth";
import { paiseToInr } from "../services/money";

const router: IRouter = Router();

router.get("/transactions", requireUser, async (req, res) => {
  const u = req.user!;
  const q = ListTransactionsQueryParams.parse(req.query);
  const filters = [eq(transactionsTable.userId, u.id)];
  if (q.type) filters.push(eq(transactionsTable.type, q.type));
  const rows = await db
    .select()
    .from(transactionsTable)
    .where(and(...filters))
    .orderBy(desc(transactionsTable.createdAt))
    .limit(q.limit ?? 50);

  res.json(
    ListTransactionsResponse.parse({
      items: rows.map((t) => ({
        id: t.id,
        type: t.type,
        status: t.status,
        amountInr: paiseToInr(t.amountPaise),
        feeInr: paiseToInr(t.feePaise),
        netInr: paiseToInr(t.netPaise),
        description: t.description,
        referenceId: t.referenceId,
        createdAt: t.createdAt.toISOString(),
      })),
    }),
  );
});

router.get("/transactions/:id", requireUser, async (req, res) => {
  const u = req.user!;
  const { id } = GetTransactionParams.parse(req.params);
  const t = (
    await db
      .select()
      .from(transactionsTable)
      .where(and(eq(transactionsTable.id, id), eq(transactionsTable.userId, u.id)))
  )[0];
  if (!t) {
    res.status(404).json({ error: "Transaction not found" });
    return;
  }
  const entries = await db
    .select({
      id: ledgerEntriesTable.id,
      accountId: ledgerEntriesTable.accountId,
      direction: ledgerEntriesTable.direction,
      amountPaise: ledgerEntriesTable.amountPaise,
      createdAt: ledgerEntriesTable.createdAt,
      accountName: ledgerAccountsTable.name,
    })
    .from(ledgerEntriesTable)
    .leftJoin(ledgerAccountsTable, eq(ledgerEntriesTable.accountId, ledgerAccountsTable.id))
    .where(eq(ledgerEntriesTable.transactionId, id));

  res.json(
    GetTransactionResponse.parse({
      transaction: {
        id: t.id,
        type: t.type,
        status: t.status,
        amountInr: paiseToInr(t.amountPaise),
        feeInr: paiseToInr(t.feePaise),
        netInr: paiseToInr(t.netPaise),
        description: t.description,
        referenceId: t.referenceId,
        createdAt: t.createdAt.toISOString(),
      },
      entries: entries.map((e) => ({
        id: e.id,
        accountId: e.accountId,
        accountName: e.accountName ?? "(unknown)",
        direction: e.direction,
        amountInr: paiseToInr(e.amountPaise),
        createdAt: e.createdAt.toISOString(),
      })),
    }),
  );
});

export default router;
