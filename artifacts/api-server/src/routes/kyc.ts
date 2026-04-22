import { Router, type IRouter } from "express";
import { GetKycResponse, SubmitKycBody, SubmitKycResponse } from "@workspace/api-zod";
import { db, kycRecordsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireUser } from "../middlewares/auth";
import { getDailyLimitPaise, getOrCreateKyc } from "../services/kyc.service";
import { paiseToInr } from "../services/money";

const router: IRouter = Router();

function mask(pan: string): string {
  const cleaned = pan.replace(/\s/g, "").toUpperCase();
  return cleaned.length >= 4 ? `XXXXXX${cleaned.slice(-4)}` : "XXXXXX";
}

router.get("/kyc", requireUser, async (req, res) => {
  const u = req.user!;
  const k = await getOrCreateKyc(u.id);
  const limit = await getDailyLimitPaise(u.id);
  res.json(
    GetKycResponse.parse({
      status: k.status,
      panMasked: k.panMasked,
      fullName: k.fullName,
      dailyLimitInr: paiseToInr(limit),
      submittedAt: k.submittedAt?.toISOString() ?? null,
      reviewedAt: k.reviewedAt?.toISOString() ?? null,
    }),
  );
});

router.post("/kyc", requireUser, async (req, res) => {
  const u = req.user!;
  const body = SubmitKycBody.parse(req.body);
  const panMasked = mask(body.pan);
  const now = new Date();

  await getOrCreateKyc(u.id);

  // Auto-verify in demo mode (real impl: enqueue to KYC vendor + risk review).
  await db
    .update(kycRecordsTable)
    .set({
      fullName: body.fullName,
      panMasked,
      addressLine: body.addressLine ?? null,
      submittedAt: now,
      reviewedAt: now,
      status: "VERIFIED",
    })
    .where(eq(kycRecordsTable.userId, u.id));

  const k = (await db.select().from(kycRecordsTable).where(eq(kycRecordsTable.userId, u.id)))[0]!;
  const limit = await getDailyLimitPaise(u.id);
  res.json(
    SubmitKycResponse.parse({
      status: k.status,
      panMasked: k.panMasked,
      fullName: k.fullName,
      dailyLimitInr: paiseToInr(limit),
      submittedAt: k.submittedAt?.toISOString() ?? null,
      reviewedAt: k.reviewedAt?.toISOString() ?? null,
    }),
  );
});

export default router;
