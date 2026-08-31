import { DATA_TYPES, SENSITIVITY_LEVELS } from "../types/detection.js";
import { ROLES, ROLE_PERMISSIONS } from "../types/role.js";

/** Flat array form of DATA_TYPES, handy for iterating in the UI. */
export const DETECTION_TYPES = Object.freeze(Object.values(DATA_TYPES));

export const PAGINATION_DEFAULTS = Object.freeze({
  PAGE: 1,
  PAGE_SIZE: 25,
  MAX_PAGE_SIZE: 100
});

export const APPROVAL_DEFAULT_EXPIRY_HOURS = 24;

export { ROLES, ROLE_PERMISSIONS, SENSITIVITY_LEVELS };