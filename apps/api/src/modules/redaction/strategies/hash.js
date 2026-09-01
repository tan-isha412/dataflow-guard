import crypto from "node:crypto";

// Same input always produces the same hash — useful when you want
// to know "is this the SAME secret appearing twice" without ever
// storing the secret itself.
export function hashStrategy(detection, originalValue) {
  const hash = crypto.createHash("sha256").update(originalValue).digest("hex").slice(0, 8);
  return `[HASH:${hash}]`;
}