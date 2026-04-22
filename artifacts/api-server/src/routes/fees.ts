import { Router, type IRouter } from "express";
import { QuoteFeesBody, QuoteFeesResponse } from "@workspace/api-zod";
import { quoteFee } from "../services/fees.service";
import { inrToPaise, paiseToInr } from "../services/money";

const router: IRouter = Router();

router.post("/fees/quote", (req, res) => {
  const body = QuoteFeesBody.parse(req.body);
  const amountPaise = inrToPaise(body.amountInr);
  const { feePaise, netPaise, rule } = quoteFee(body.kind, amountPaise);
  res.json(
    QuoteFeesResponse.parse({
      kind: body.kind,
      amountInr: paiseToInr(amountPaise),
      feeInr: paiseToInr(feePaise),
      netInr: paiseToInr(netPaise),
      feeBps: rule.bps,
      feeFixedInr: paiseToInr(BigInt(rule.fixedPaise)),
    }),
  );
});

export default router;
