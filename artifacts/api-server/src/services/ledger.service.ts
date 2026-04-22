// Wallet / Ledger Service — double-entry accounting core.
// Every financial operation creates a Transaction + balanced ledger entries
// (sum of DEBITs == sum of CREDITs). Wallet balances are *derived* from ledger entries,
// never stored as a single column.

import { db } from "@workspace/db";
import {
  ledgerAccountsTable,
  ledgerEntriesTable,
  transactionsTable,
  type LedgerAccount,
} from "@workspace/db";
import { and, eq, sql } from "drizzle-orm";
import { dbNumeric } from "./money";

export type AccountType = "USER" | "PLATFORM" | "FEE";

export interface PostingLine {
  accountId: string;
  direction: "DEBIT" | "CREDIT";
  amountPaise: bigint;
}

export interface PostTransactionInput {
  userId: string;
  type: "LOAD" | "PAYOUT" | "FEE" | "REFUND" | "ADJUSTMENT";
  status: "PENDING" | "SUCCESS" | "FAILED" | "REVERSED";
  amountPaise: bigint;
  feePaise: bigint;
  netPaise: bigint;
  description?: string;
  referenceId?: string;
  idempotencyKey?: string;
  postings: PostingLine[];
}

export class LedgerImbalanceError extends Error {
  constructor(public debits: bigint, public credits: bigint) {
    super(`Ledger imbalance: DEBIT=${debits} CREDIT=${credits}`);
  }
}

export async function ensureSystemAccounts(): Promise<{
  platformCash: LedgerAccount;
  feeRevenue: LedgerAccount;
}> {
  const existing = await db
    .select()
    .from(ledgerAccountsTable)
    .where(eq(ledgerAccountsTable.type, "PLATFORM"));
  let platformCash = existing.find((a) => a.name === "PLATFORM_CASH");
  if (!platformCash) {
    [platformCash] = await db
      .insert(ledgerAccountsTable)
      .values({ name: "PLATFORM_CASH", type: "PLATFORM", normalSide: "DEBIT" })
      .returning();
  }
  const feeRows = await db
    .select()
    .from(ledgerAccountsTable)
    .where(eq(ledgerAccountsTable.type, "FEE"));
  let feeRevenue = feeRows.find((a) => a.name === "FEE_REVENUE");
  if (!feeRevenue) {
    [feeRevenue] = await db
      .insert(ledgerAccountsTable)
      .values({ name: "FEE_REVENUE", type: "FEE", normalSide: "CREDIT" })
      .returning();
  }
  return { platformCash: platformCash!, feeRevenue: feeRevenue! };
}

export async function getOrCreateUserAccount(userId: string): Promise<LedgerAccount> {
  const rows = await db
    .select()
    .from(ledgerAccountsTable)
    .where(and(eq(ledgerAccountsTable.type, "USER"), eq(ledgerAccountsTable.ownerId, userId)));
  if (rows[0]) return rows[0];
  const [created] = await db
    .insert(ledgerAccountsTable)
    .values({
      name: `USER_WALLET:${userId}`,
      type: "USER",
      ownerId: userId,
      normalSide: "CREDIT",
    })
    .returning();
  return created!;
}

/**
 * Post a transaction atomically: writes the transaction row plus all ledger entries
 * inside one DB transaction. Validates that DEBITs == CREDITs.
 */
export async function postTransaction(input: PostTransactionInput): Promise<{ transactionId: string }> {
  let debits = 0n;
  let credits = 0n;
  for (const p of input.postings) {
    if (p.direction === "DEBIT") debits += p.amountPaise;
    else credits += p.amountPaise;
  }
  if (debits !== credits) throw new LedgerImbalanceError(debits, credits);

  return db.transaction(async (tx) => {
    // Idempotency check
    if (input.idempotencyKey) {
      const existing = await tx
        .select()
        .from(transactionsTable)
        .where(
          and(
            eq(transactionsTable.userId, input.userId),
            eq(transactionsTable.idempotencyKey, input.idempotencyKey),
          ),
        );
      if (existing[0]) return { transactionId: existing[0].id };
    }

    const [txnRow] = await tx
      .insert(transactionsTable)
      .values({
        userId: input.userId,
        type: input.type,
        status: input.status,
        amountPaise: dbNumeric(input.amountPaise),
        feePaise: dbNumeric(input.feePaise),
        netPaise: dbNumeric(input.netPaise),
        description: input.description ?? null,
        referenceId: input.referenceId ?? null,
        idempotencyKey: input.idempotencyKey ?? null,
      })
      .returning();

    const txnId = txnRow!.id;

    if (input.status === "SUCCESS") {
      await tx.insert(ledgerEntriesTable).values(
        input.postings.map((p) => ({
          transactionId: txnId,
          accountId: p.accountId,
          direction: p.direction,
          amountPaise: dbNumeric(p.amountPaise),
        })),
      );
    }

    return { transactionId: txnId };
  });
}

/** Compute account balance from ledger entries. */
export async function getAccountBalance(accountId: string): Promise<bigint> {
  const acct = (
    await db.select().from(ledgerAccountsTable).where(eq(ledgerAccountsTable.id, accountId))
  )[0];
  if (!acct) return 0n;
  const rows = await db
    .select({
      debit: sql<string>`COALESCE(SUM(CASE WHEN ${ledgerEntriesTable.direction} = 'DEBIT' THEN ${ledgerEntriesTable.amountPaise} ELSE 0 END), 0)`,
      credit: sql<string>`COALESCE(SUM(CASE WHEN ${ledgerEntriesTable.direction} = 'CREDIT' THEN ${ledgerEntriesTable.amountPaise} ELSE 0 END), 0)`,
    })
    .from(ledgerEntriesTable)
    .where(eq(ledgerEntriesTable.accountId, accountId));
  const d = BigInt(rows[0]?.debit ?? "0");
  const c = BigInt(rows[0]?.credit ?? "0");
  // CREDIT-normal accounts: balance = credits - debits
  // DEBIT-normal accounts: balance = debits - credits
  return acct.normalSide === "CREDIT" ? c - d : d - c;
}

export async function getUserWalletBalance(userId: string): Promise<bigint> {
  const acct = await getOrCreateUserAccount(userId);
  return getAccountBalance(acct.id);
}

export async function getLedgerOverview() {
  const accounts = await db.select().from(ledgerAccountsTable);
  const totals = await Promise.all(
    accounts.map(async (a) => ({
      accountId: a.id,
      name: a.name,
      type: a.type as AccountType,
      balancePaise: await getAccountBalance(a.id),
    })),
  );
  // Across the whole platform, sum(DEBIT) must equal sum(CREDIT)
  const totalsRow = await db
    .select({
      debit: sql<string>`COALESCE(SUM(CASE WHEN ${ledgerEntriesTable.direction} = 'DEBIT' THEN ${ledgerEntriesTable.amountPaise} ELSE 0 END), 0)`,
      credit: sql<string>`COALESCE(SUM(CASE WHEN ${ledgerEntriesTable.direction} = 'CREDIT' THEN ${ledgerEntriesTable.amountPaise} ELSE 0 END), 0)`,
    })
    .from(ledgerEntriesTable);
  const balanced = (totalsRow[0]?.debit ?? "0") === (totalsRow[0]?.credit ?? "0");
  return { accounts: totals, balanced };
}
