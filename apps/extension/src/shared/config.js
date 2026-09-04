/**
 * Backend base URL. Must match manifest.json's host_permissions entry —
 * MV3 background fetches to a host_permissions-covered origin bypass CORS,
 * which is how the service worker can call the API without any backend
 * CORS changes.
 *
 * This is the DEV value, used by `npm test`/`npm run dev` and any plain
 * `npm run build`. scripts/build.js rewrites this constant (and the
 * matching manifest.json host_permissions entry) in dist/ ONLY for a
 * `--production` build — see scripts/build.js and README.md's
 * "Production build" section. Never edit dist/ by hand.
 */
export const API_BASE_URL = "http://localhost:5000/api/v1";
