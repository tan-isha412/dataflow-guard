import crypto from "node:crypto";

// For logging/auditing WITHOUT storing raw sensitive content —
// truncate long content, or hash it if you need to compare two
// pieces of content without ever storing either one in full.
export function hashForAudit(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function truncateForAudit(value, maxLength = 200) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength)}... [truncated, ${value.length} chars total]`;
}