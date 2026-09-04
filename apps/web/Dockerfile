FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
COPY packages/shared ./packages/shared
COPY apps/web ./apps/web
RUN npm install --workspace=@dataflow-guardian/web --workspace=@dataflow-guardian/shared
WORKDIR /app/apps/web
RUN npm run build

# Second stage: a minimal server just for static files — the
# build tools from the first stage never make it into this final
# image, keeping it small.
FROM nginx:alpine
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q -O /dev/null http://localhost/ || exit 1
