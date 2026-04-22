import { Router, type IRouter } from "express";
import { QuoteFeesQueryParams, QuoteFeesResponse } from "@workspace/api-zod";
import { quoteFee } from "../services/fees.service";
import { inrToPaise, paiseToInr } from "../services/money";

const router: IRouter = Router();

router.get("/fees/quote", (req, res) => {
  const q = QuoteFeesQueryParams.parse({
    kind: req.query["kind"],
    amountInr: Number(req.query["amountInr"]),
  });
  const amountPaise = inrToPaise(q.amountInr);
  const { feePaise, netPaise, rule } = quoteFee(q.kind, amountPaise);
  res.json(
    QuoteFeesResponse.parse({
      kind: q.kind,
      amountInr: paiseToInr(amountPaise),
      feeInr: paiseToInr(feePaise),
      netInr: paiseToInr(netPaise),
      feeBps: rule.bps,
      feeFixedInr: paiseToInr(BigInt(rule.fixedPaise)),
    }),
  );
});

export default router;
