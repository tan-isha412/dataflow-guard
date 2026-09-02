import { AppError } from "../../middleware/errorHandler.js";
import * as policyRepository from "./policy.repository.js";
import { emitAuditEvent } from "../audit/audit.emitter.js";
export function listPolicies(organizationId) {
  return policyRepository.findPoliciesByOrganization(organizationId);
}

export async function createPolicy(organizationId, input) {
  const policy = await policyRepository.createPolicy({ ...input, organizationId });
  await emitAuditEvent({ organizationId, actorUserId: /* pass this in from the route */ undefined, eventType: "POLICY_CREATED", metadata: { policyId: policy.id } });
  return policy;
}

export async function updatePolicy(organizationId, policyId, input) {
  // Ownership check happens HERE, not trusted from the client — a
  // request to update someone else's policy must fail even if the
  // policyId is guessed correctly, because organizationId always
  // comes from the verified JWT (see orgs.routes.js, Day 4).
  const policies = await policyRepository.findPoliciesByOrganization(organizationId);
  const owns = policies.some((p) => p.id === policyId);
  if (!owns) {
    throw new AppError("Policy not found", 404, "POLICY_NOT_FOUND");
  }
  return policyRepository.updatePolicy(policyId, input);
}

export async function deletePolicy(organizationId, policyId) {
  const policies = await policyRepository.findPoliciesByOrganization(organizationId);
  const owns = policies.some((p) => p.id === policyId);
  if (!owns) {
    throw new AppError("Policy not found", 404, "POLICY_NOT_FOUND");
  }
  return policyRepository.deletePolicy(policyId);
}