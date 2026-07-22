import { Hono } from "hono";
import { cors } from "hono/cors";
import { authMiddleware } from "kitcn/auth/http";
import { createHttpRouter } from "kitcn/server";
import { router } from "../lib/crpc";
import { getEnv } from "../lib/get-env";
import { getAuth } from "./generated/auth";
import { paymentWebhookRouter } from "./payment/webhook";

// __KITCN_HTTP_IMPORTS__

const app = new Hono();

app.use(
  "/api/*",
  cors({
    allowHeaders: ["Content-Type", "Authorization", "Better-Auth-Cookie"],
    credentials: true,
    exposeHeaders: ["Set-Better-Auth-Cookie"],
    origin: getEnv().SITE_URL,
  })
);

app.use(authMiddleware(getAuth));

export const httpRouter = router({
  payment: paymentWebhookRouter,
  // __KITCN_HTTP_ROUTES__
});

export default createHttpRouter(app, httpRouter);
