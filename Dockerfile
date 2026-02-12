# syntax=docker/dockerfile:1

###
# Beholden (server serves web/dist)
# - Multi-stage build for smaller runtime image
# - Production deps only in runtime
# - Non-root user
# - Healthcheck
###

FROM node:20-alpine AS build

WORKDIR /app

# Copy manifests first for better caching
COPY package.json package-lock.json ./
COPY server/package.json server/package-lock.json ./server/
COPY web/package.json web/package-lock.json ./web/

# Install workspace deps (needed to build web)
RUN npm ci

# Copy the rest of the repo
COPY . .

# Build the web UI (server will serve web/dist)
RUN npm -w web run build


FROM node:20-alpine AS runtime

# tini for proper signal handling (docker stop)
RUN apk add --no-cache tini

# Create a non-root user
RUN addgroup -S beholden && adduser -S beholden -G beholden

WORKDIR /app

# Install ONLY server production deps
COPY server/package.json server/package-lock.json ./server/
WORKDIR /app/server
RUN npm ci --omit=dev

# Copy server source
COPY --from=build /app/server/src ./src

# Copy built web assets
WORKDIR /app
COPY --from=build /app/web/dist ./web/dist

# Data dir inside container (mount a volume here)
VOLUME ["/data"]

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=5174
ENV BEHOLDEN_DATA_DIR=/data

EXPOSE 5174

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:${PORT}/api/health >/dev/null 2>&1 || exit 1

USER beholden

ENTRYPOINT ["/sbin/tini","--"]
CMD ["node", "src/index.js"]
