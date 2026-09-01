// A tiny shared helper so every list endpoint (policies, audit,
// approvals, destinations) parses pagination query params the SAME
// way, instead of each route re-implementing its own defaults/limits.
export function parsePagination(query, { defaultTake = 25, maxTake = 100 } = {}) {
  const skip = Math.max(0, Number(query.skip) || 0);
  const take = Math.min(maxTake, Math.max(1, Number(query.take) || defaultTake));
  return { skip, take };
}