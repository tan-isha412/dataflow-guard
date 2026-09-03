import { authenticatedRequest, ApiError } from "../auth/apiClient.js";

/**
 * Checks whether a previously-created approval request has been decided
 * yet. This is the "handle approved/rejected response when the existing
 * API supports it" half of Phase 5's REQUIRE_APPROVAL requirement — it
 * does NOT create a new approvals system, it just reads the one that
 * already exists (GET /approvals/:id, added alongside this).
 *
 * Never throws for a normal "still pending" / "not found anymore" case —
 * callers (the content script's poll loop) treat both as "nothing new
 * yet" rather than an error state.
 */
export async function checkApprovalStatus(approvalId) {
  try {
    const approval = await authenticatedRequest(`/approvals/${approvalId}`);
    return { found: true, status: approval.status, approval };
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return { found: false, status: null, approval: null };
    }
    throw error;
  }
}
