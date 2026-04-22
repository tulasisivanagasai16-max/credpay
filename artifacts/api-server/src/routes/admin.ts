import { Router, type IRouter } from "express";
import { GetLedgerOverviewResponse, GetRiskQueueResponse } from "@workspace/api-zod";
import { db, riskFlagsTable, usersTable } from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import { requireUser } from "../middlewares/auth";
import { getLedgerOverview } from "../services/ledger.service";
import { paiseToInr } from "../services/money";

const router: IRouter = Router();

router.get("/admin/ledger", requireUser, async (_req, res) => {
  const overview = await getLedgerOverview();
  let totalUser = 0n;
  let totalFee = 0n;
  let totalPlatform = 0n;
  for (const a of overview.accounts) {
    if (a.type === "USER") totalUser += a.balancePaise;
    if (a.type === "FEE") totalFee += a.balancePaise;
    if (a.type === "PLATFORM") totalPlatform += a.balancePaise;
  }
  res.json(
    GetLedgerOverviewResponse.parse({
      accounts: overview.accounts.map((a) => ({
        accountId: a.accountId,
        name: a.name,
        type: a.type,
        balanceInr: paiseToInr(a.balancePaise),
      })),
      totalUserCoinsInr: paiseToInr(totalUser),
      totalFeesInr: paiseToInr(totalFee),
      totalPlatformInr: paiseToInr(totalPlatform),
      doubleEntryBalanced: overview.balanced,
    }),
  );
});

router.get("/admin/risk/queue", requireUser, async (_req, res) => {
  const rows = await db
    .select({
      f: riskFlagsTable,
      email: usersTable.email,
    })
    .from(riskFlagsTable)
    .leftJoin(usersTable, eq(usersTable.id, riskFlagsTable.userId))
    .orderBy(desc(riskFlagsTable.createdAt))
    .limit(50);
  res.json(
    GetRiskQueueResponse.parse({
      items: rows.map((r) => ({
        id: r.f.id,
        userEmail: r.email ?? "(unknown)",
        kind: r.f.kind,
        severity: r.f.severity,
        message: r.f.message,
        createdAt: r.f.createdAt.toISOString(),
      })),
    }),
  );
});

export default router;
