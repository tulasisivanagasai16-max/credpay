import { Router, type IRouter } from "express";
import { GetSessionResponse, LoginBody, LoginResponse } from "@workspace/api-zod";
import { requireUser, ensureDemoUser } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/auth/session", requireUser, (req, res) => {
  const u = req.user!;
  res.json(GetSessionResponse.parse({ id: u.id, email: u.email, name: u.name, role: u.role }));
});

router.post("/auth/login", async (req, res) => {
  LoginBody.parse(req.body);
  const u = await ensureDemoUser();
  res.json(LoginResponse.parse({ id: u.id, email: u.email, name: u.name, role: u.role }));
});

export default router;
