FROM node:20-alpine
WORKDIR /app

# Copy package files FIRST, install, THEN copy source — this ordering
# means Docker can cache the (slow) npm install layer, and only
# re-runs it when package.json actually changes, not on every code edit.
COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY apps/api/package*.json ./apps/api/
RUN npm install --workspace=@dataflow-guardian/api --workspace=@dataflow-guardian/shared

COPY packages/shared ./packages/shared
COPY apps/api ./apps/api

WORKDIR /app/apps/api
RUN npx prisma generate

# Runs as a non-root user in production — the default `node` user
# already exists in the base image, so this is just opting into it
# rather than staying root for no reason.
RUN chown -R node:node /app
USER node

EXPOSE 5000

# Uses the real liveness endpoint (app.js's GET /health) rather than a
# generic TCP check, and Node's own fetch (Alpine has no curl/wget by
# default) so this doesn't need an extra package just for the healthcheck.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://localhost:5000/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

# Graceful shutdown (SIGTERM handling, src/index.js) needs the signal to
# actually reach the node process — plain `CMD ["node", ...]` (exec
# form, no shell) already achieves that; this comment exists so a future
# edit doesn't "simplify" it back into a shell form that would swallow
# the signal.
CMD ["node", "src/index.js"]
