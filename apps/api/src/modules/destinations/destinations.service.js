import { AppError } from "../../middleware/errorHandler.js";
import * as destinationsRepository from "./destinations.repository.js";

export function listDestinations(organizationId) {
  return destinationsRepository.findDestinationsByOrganization(organizationId);
}

// Defaults for AI destinations the extension can recognize out of the
// box (one adapter per site — see apps/extension/src/content/adapters).
// An org overrides any of this simply by creating/approving a Destination
// row (existing CRUD above) whose name matches the site's display name —
// no separate "destination catalog" concept to keep in sync.
const KNOWN_DESTINATIONS = {
  chatgpt: { type: "EXTERNAL_AI", riskLevel: "MEDIUM" },
  claude: { type: "EXTERNAL_AI", riskLevel: "MEDIUM" },
  gemini: { type: "EXTERNAL_AI", riskLevel: "MEDIUM" }
};

/**
 * Turns what the extension reports about where a prompt is headed
 * (a logical id like "chatgpt", plus the type/display name its adapter
 * knows) into the context risk scoring and policy evaluation actually
 * use. This is the ONLY place destination risk is decided — the
 * extension never computes or asserts its own risk level.
 *
 * Fail-closed by construction: a destination this organization has
 * never seen or approved comes back UNAPPROVED/HIGH risk rather than
 * silently inheriting whatever the client claims about itself.
 */
export async function resolveDestinationContext(organizationId, reported) {
  // No destination reported at all (e.g. an admin manually scanning text
  // in the Playground, not headed anywhere) is not the same thing as an
  // unrecognized destination — there's no external site to be risky
  // about, so this doesn't inflate the risk score or need an org override.
  if (!reported?.destinationId) {
    return { destinationId: null, destinationType: null, riskLevel: "LOW", status: "APPROVED", registeredDestinationId: null };
  }

  const destinationId = reported.destinationId;
  const displayName = reported.displayName || destinationId;
  const known = KNOWN_DESTINATIONS[destinationId];

  const orgDestinations = await destinationsRepository.findDestinationsByOrganization(organizationId);
  const registered = orgDestinations.find((d) => d.name.toLowerCase() === displayName.toLowerCase());

  if (registered) {
    return {
      destinationId,
      destinationType: registered.type,
      riskLevel: registered.riskLevel,
      status: registered.status,
      registeredDestinationId: registered.id
    };
  }

  return {
    destinationId,
    destinationType: known?.type ?? reported?.destinationType ?? "CUSTOM",
    riskLevel: known?.riskLevel ?? "HIGH",
    status: "UNAPPROVED",
    registeredDestinationId: null
  };
}

export async function createDestination(organizationId, input) {
  return destinationsRepository.createDestination({ ...input, organizationId });
}

export async function updateDestinationStatus(organizationId, destinationId, status) {
  const destination = await destinationsRepository.findDestinationById(destinationId);

  // Same ownership-check pattern as policy.service.js on Day 8 —
  // the destination must belong to the caller's own org, even if
  // they somehow guess a valid destination id from another company.
  if (!destination || destination.organizationId !== organizationId) {
    throw new AppError("Destination not found", 404, "DESTINATION_NOT_FOUND");
  }

  return destinationsRepository.updateDestination(destinationId, { status });
}