# API Reference (v1, prefix `/api/v1`)

## Auth
- `POST /auth/register` — create org + user, returns tokens
- `POST /auth/login` — returns tokens

## Inspect
- `POST /inspect` — `{content}` → `{action, riskScore, detections, sanitizedContent}`

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