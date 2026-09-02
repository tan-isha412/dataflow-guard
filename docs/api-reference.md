# API Reference (v1, prefix `/api/v1`)

## Auth
- `POST /auth/register` — create org + user, returns tokens
- `POST /auth/login` — returns tokens
- `POST /auth/refresh` — `{refreshToken}` → new `{accessToken, refreshToken}`

## Inspect
- `POST /inspect` — `{content, destinationId?}` → `{action, status, riskScore, reason, matchedPolicyIds, detections, sanitizedContent, approvalRequestId}`.
  `destinationId` is a free-form tag (e.g. `"chatgpt"` from the browser extension), not a foreign key — it's threaded through to the approval record when `action` is `REQUIRE_APPROVAL`. `organizationId` always comes from the authenticated token, never from the request body.

## Policy
- `GET /policy`, `POST /policy`, `PATCH /policy/:id`, `DELETE /policy/:id`

## Destinations
- `GET /destinations`, `POST /destinations`, `PATCH /destinations/:id/status`

## Approvals
- `GET /approvals?status=`, `PATCH /approvals/:id/decide` — `{decision: "APPROVED"|"REJECTED"}`

## Audit
- `GET /audit?eventType=`, `GET /audit/summary`

## Analytics
- `GET /analytics/risk-over-time?days=30`, `GET /analytics/detections-by-type`

All endpoints except `/auth/*` require `Authorization: Bearer <accessToken>`.