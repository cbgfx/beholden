# ===== 1) Build web =====
FROM node:20-alpine AS web-build
WORKDIR /app/web

# Copy only package.json (works even without lockfile)
COPY web/package.json ./
RUN npm install

# Build
COPY web/ ./
RUN npm run build


# ===== 2) Build server =====
FROM node:20-alpine AS server-build
WORKDIR /app/server

COPY server/package.json ./
RUN npm install

COPY server/ ./
RUN npm run build


# ===== 3) Runtime =====
FROM node:20-alpine AS runtime
WORKDIR /app/server

ENV NODE_ENV=production
ENV PORT=2385
ENV HOST=0.0.0.0

# Install runtime deps (no lockfile required)
COPY server/package.json ./
RUN npm install --omit=dev

# Copy built server output
COPY --from=server-build /app/server/dist ./dist

# Copy static web build
COPY --from=web-build /app/web/dist ../web/dist

EXPOSE 2385

# Most common Beholden server entry
CMD ["node", "dist/index.js"]
