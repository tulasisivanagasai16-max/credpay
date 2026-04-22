import { Router, type IRouter } from "express";
import { GetMeResponse } from "@workspace/api-zod";
import { requireUser } from "../middlewares/auth";
import { getOrCreateKyc, getDailyLimitPaise } from "../services/kyc.service";
import { paiseToInr } from "../services/money";

const router: IRouter = Router();

router.get("/me", requireUser, async (req, res) => {
  const u = req.user!;
  const kyc = await getOrCreateKyc(u.id);
  const limit = await getDailyLimitPaise(u.id);
  res.json(
    GetMeResponse.parse({
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      kycStatus: kyc.status,
      dailyLimitInr: paiseToInr(limit),
      createdAt: u.createdAt.toISOString(),
    }),
  );
});

export default router;
