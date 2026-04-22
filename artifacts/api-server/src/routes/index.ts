import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import userRouter from "./user";
import kycRouter from "./kyc";
import walletRouter from "./wallet";
import transactionsRouter from "./transactions";
import paymentsRouter from "./payments";
import payoutsRouter from "./payouts";
import payeesRouter from "./payees";
import feesRouter from "./fees";
import adminRouter from "./admin";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(userRouter);
router.use(kycRouter);
router.use(walletRouter);
router.use(transactionsRouter);
router.use(paymentsRouter);
router.use(payoutsRouter);
router.use(payeesRouter);
router.use(feesRouter);
router.use(adminRouter);

export default router;
