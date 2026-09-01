# DataFlow Guardian

An AI-aware data egress security platform: scans outgoing text for
sensitive data (PII, credentials, secrets) and enforces org-defined
policies (allow / redact / block / require approval) before it reaches
an external destination.

## Stack
JavaScript, React, Express, PostgreSQL (Prisma), Redis, BullMQ.

## Local development
\`\`\`bash
npm install
docker-compose up -d
npx prisma migrate dev --schema=apps/api/prisma/schema.prisma
npm run dev:api    # terminal 1
npm run dev:web    # terminal 2
npm run dev:worker # terminal 3
\`\`\`

## Testing
\`\`\`bash
npm run test --workspaces
\`\`\`

## Architecture
See [ARCHITECTURE.md](./ARCHITECTURE.md).