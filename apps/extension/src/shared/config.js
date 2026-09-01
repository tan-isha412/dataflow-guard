/**
 * Backend base URL. Must match manifest.json's host_permissions entry —
 * MV3 background fetches to a host_permissions-covered origin bypass CORS,
 * which is how the service worker can call the API without any backend
 * CORS changes. Production (HTTPS) packaging is Phase 9 work.
 */
export const API_BASE_URL = "http://localhost:5000/api/v1";
