FROM node:20-alpine
WORKDIR /app

COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY apps/worker/package*.json ./apps/worker/
RUN npm install --workspace=@dataflow-guardian/worker --workspace=@dataflow-guardian/shared

COPY packages/shared ./packages/shared
COPY apps/worker ./apps/worker

# The worker never runs migrations, but it DOES construct its own
# PrismaClient (approvalExpiry.processor.js, auditAggregation.processor.js)
# — an un-generated @prisma/client throws at runtime ("did not initialize
# yet"), so the real schema (only the schema, not the rest of apps/api)
# is copied in just to generate a working client from it.
COPY apps/api/prisma ./apps/api/prisma

WORKDIR /app/apps/worker
RUN npx prisma generate --schema=../api/prisma/schema.prisma

RUN chown -R node:node /app
USER node

# Same runtime image, DIFFERENT entrypoint — no exposed port, since a
# worker never receives HTTP requests, it only consumes jobs. Health is
# "can this process reach Redis" (there's no HTTP endpoint to probe
# instead) rather than a port check.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "import('ioredis').then(({default:Redis})=>{const r=new Redis({host:process.env.REDIS_HOST||'localhost',port:Number(process.env.REDIS_PORT||6379),password:process.env.REDIS_PASSWORD||undefined,lazyConnect:true,connectTimeout:3000});return r.connect().then(()=>r.ping()).then(()=>{r.disconnect();process.exit(0)})}).catch(()=>process.exit(1))"

CMD ["node", "src/index.js"]
