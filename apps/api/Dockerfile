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

EXPOSE 5000
CMD ["node", "src/index.js"]