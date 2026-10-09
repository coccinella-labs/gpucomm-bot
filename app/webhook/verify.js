import crypto from "crypto";

export function verifyWebhookSignature(payload, signature, secret) {
  if (typeof signature !== "string" || signature.length === 0) return false;
  if (typeof secret !== "string" || secret.length === 0) return false;

  let payloadBytes;
  if (Buffer.isBuffer(payload)) {
    payloadBytes = payload;
  } else if (typeof payload === "string") {
    payloadBytes = Buffer.from(payload, "utf8");
  } else {
    return false;
  }

  const expected =
    "sha256=" +
    crypto.createHmac("sha256", secret).update(payloadBytes).digest("hex");
  if (signature.length !== expected.length) return false;

  return crypto.timingSafeEqual(
    Buffer.from(signature, "utf8"),
    Buffer.from(expected, "utf8"),
  );
}
