import "dotenv/config";
import express from "express";
import { handleWebhook } from "./routes.js";
import { verifyWebhookSignature } from "./webhook/verify.js";

const app = express();
app.use(
  express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.get("/", (req, res) => {
  res.status(200).type("text/plain").send("gpucomm-bot up. POST /webhook");
});

app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use((err, req, res, next) => {
  console.error("[error]", err?.message ?? err);
  res.status(500).json({ error: "Internal server error" });
});

app.post("/webhook", (req, res, next) => {
  const sig = req.headers["x-hub-signature-256"];
  const secret = process.env.WEBHOOK_SECRET;

  if (!secret) {
    console.error("WEBHOOK_SECRET not set, rejecting webhook");
    return res.status(503).json({ error: "Webhook verification unavailable" });
  }

  if (!sig) {
    console.warn("Missing X-Hub-Signature-256 header");
    return res.sendStatus(401);
  }

  if (!Buffer.isBuffer(req.rawBody) || req.rawBody.length === 0) {
    console.warn("Webhook raw body unavailable for signature verification");
    return res.sendStatus(401);
  }

  if (!verifyWebhookSignature(req.rawBody, sig, secret)) {
    console.warn("Invalid webhook signature");
    return res.sendStatus(401);
  }

  next();
}, handleWebhook);

const port = Number.parseInt(process.env.PORT ?? "3000", 10);
const host = process.env.HOST ?? "0.0.0.0";

const server = app.listen(port, host, () => {
  console.log(`gpucomm-bot running on http://${host}:${port}`);
});

server.on("error", (err) => {
  console.error("Failed to start server:", err?.message ?? err);
  process.exitCode = 1;
});
