FROM node:22-alpine AS dependencies

RUN apk add --no-cache python3 make g++
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM dependencies AS production-dependencies
WORKDIR /app
RUN npm prune --omit=dev

FROM dependencies AS builder
WORKDIR /app
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-alpine AS runner
RUN apk add --no-cache libstdc++ su-exec \
    && addgroup -S dashboard \
    && adduser -S dashboard -G dashboard \
    && mkdir -p /data /app
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
ENV DATABASE_PATH=/data/dashboard.sqlite
COPY --from=production-dependencies --chown=dashboard:dashboard /app/node_modules ./node_modules
COPY --from=builder --chown=dashboard:dashboard /app/.next ./.next
COPY --from=builder --chown=dashboard:dashboard /app/public ./public
COPY --from=builder --chown=dashboard:dashboard /app/package.json ./package.json
COPY --from=builder --chown=dashboard:dashboard /app/server.js ./server.js
COPY --from=builder --chown=dashboard:dashboard /app/ingress-path.js ./ingress-path.js
COPY --chown=root:root entrypoint.sh ./entrypoint.sh
RUN chmod 755 ./entrypoint.sh
EXPOSE 3000
CMD ["./entrypoint.sh"]
