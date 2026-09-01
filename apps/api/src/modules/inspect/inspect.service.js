import { detectSensitiveData } from "../inspection/inspection.service.js";
import { calculateRiskScore } from "../risk/risk.service.js";
import { listPolicies } from "../policy/policy.service.js";
import { makeDecision } from "../decision/decision.service.js";
import { createDecisionRecord } from "../decision/decision.repository.js";
import { logger } from "../../utils/logger.js";
import { truncateForAudit } from "../../utils/crypto.js";

// This is the ENTIRE pipeline in one place, in the correct order:
// detect → score risk → fetch rules → decide → persist → log.
// Every piece was already built and tested independently on Days
// 6-9 — this function just calls them in sequence.
export async function runInspection({ organizationId, content }) {
  const detections = detectSensitiveData(content);
  const policies = await listPolicies(organizationId);
  const riskScore = calculateRiskScore(detections);

  const decision = await makeDecision({ content, detections, policies, riskScore });

  await createDecisionRecord({
    organizationId,
    action: decision.action,
    status: decision.status,
    riskScore: decision.riskScore,
    reason: decision.reason,
    matchedPolicyIds: decision.matchedPolicyIds,
    detections: decision.detections,
    sanitizedContent: decision.sanitizedContent
  });

  // Note: we log a TRUNCATED preview of the content, never the full
  // thing — the whole point of this system is not leaking sensitive
  // data, including into its own logs.
  logger.info("inspection completed", {
    organizationId,
    action: decision.action,
    detectionCount: detections.length,
    contentPreview: truncateForAudit(content, 50)
  });

  return decision;
}