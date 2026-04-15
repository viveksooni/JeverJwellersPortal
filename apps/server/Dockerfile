# ─── Stage 1: Build ───────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root workspace files
COPY package.json package-lock.json turbo.json ./
COPY packages/ ./packages/
COPY apps/server/ ./apps/server/

# Install all deps (including devDeps for build)
RUN npm ci --workspace=apps/server --workspace=packages/shared --include-workspace-root

# Build shared package first, then server
RUN npm run build --workspace=packages/shared
RUN npm run build --workspace=apps/server

# ─── Stage 2: Production image ────────────────────────────────────────────────
FROM node:20-alpine AS runner

# Install Chromium for Puppeteer PDF generation
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    font-noto

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

WORKDIR /app

# Copy built artifacts
COPY --from=builder /app/apps/server/dist ./dist
COPY --from=builder /app/packages/shared/dist ./node_modules/@jever/shared/dist
COPY --from=builder /app/packages/shared/package.json ./node_modules/@jever/shared/package.json

# Copy package.json and install production deps only
COPY apps/server/package.json ./
RUN npm install --omit=dev

# Create uploads directories
RUN mkdir -p uploads/invoices uploads/products uploads/logo

EXPOSE 3001

CMD ["node", "dist/index.js"]
