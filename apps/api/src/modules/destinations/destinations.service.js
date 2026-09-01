import { AppError } from "../../middleware/errorHandler.js";
import * as destinationsRepository from "./destinations.repository.js";

export function listDestinations(organizationId) {
  return destinationsRepository.findDestinationsByOrganization(organizationId);
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