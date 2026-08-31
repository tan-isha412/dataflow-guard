/**
 * Roles a user can hold within an organization.
 */
export const ROLES = Object.freeze({
  ADMIN: "ADMIN",
  SECURITY_ANALYST: "SECURITY_ANALYST",
  DEVELOPER: "DEVELOPER",
  APPROVER: "APPROVER",
  VIEWER: "VIEWER"
});

/**
 * What each role is allowed to do. Consumed by the RBAC middleware
 * on the API and by the frontend to conditionally render controls.
 */
export const ROLE_PERMISSIONS = Object.freeze({
  [ROLES.ADMIN]: [
    "org:manage", "users:manage", "policies:write", "destinations:write",
    "approvals:decide", "audit:read", "inspect:run"
  ],
  [ROLES.SECURITY_ANALYST]: [
    "policies:write", "destinations:write", "approvals:decide",
    "audit:read", "inspect:run"
  ],
  [ROLES.APPROVER]: ["approvals:decide", "audit:read", "inspect:run"],
  [ROLES.DEVELOPER]: ["inspect:run", "destinations:read"],
  [ROLES.VIEWER]: ["audit:read", "destinations:read"]
});

/**
 * @typedef {Object} Membership
 * @property {string} id
 * @property {string} userId
 * @property {string} organizationId
 * @property {string} role
 */

export function isValidRole(value) {
  return Object.values(ROLES).includes(value);
}

export function roleHasPermission(role, permission) {
  return (ROLE_PERMISSIONS[role] ?? []).includes(permission);
}