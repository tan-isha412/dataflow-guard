FROM node:20-alpine
WORKDIR /app

COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY apps/worker/package*.json ./apps/worker/
RUN npm install --workspace=@dataflow-guardian/worker --workspace=@dataflow-guardian/shared

COPY packages/shared ./packages/shared
COPY apps/worker ./apps/worker

WORKDIR /app/apps/worker
# Same runtime image, DIFFERENT entrypoint — no exposed port, since
# a worker never receives HTTP requests, it only consumes jobs.
CMD ["node", "src/index.js"]