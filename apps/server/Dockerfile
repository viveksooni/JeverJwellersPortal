# ─── Stage 1: Build ───────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json turbo.json ./
COPY packages/shared/package.json ./packages/shared/package.json
COPY apps/server/package.json     ./apps/server/package.json

# Stub admin workspace so npm doesn't error on the "apps/*" glob
RUN mkdir -p apps/admin && \
    echo '{"name":"@jever/admin","version":"1.0.0","private":true}' \
    > apps/admin/package.json

RUN npm install && npm dedupe

COPY packages/ ./packages/
COPY apps/server/ ./apps/server/

# Build shared first (needed for TypeScript type checking of server)
RUN npm run build --workspace=packages/shared

# Patch shared/package.json so tsc resolves to compiled dist, not .ts source
RUN node -e " \
  const fs = require('fs'); \
  const p = JSON.parse(fs.readFileSync('packages/shared/package.json','utf8')); \
  p.main  = './dist/index.js'; \
  p.types = './dist/index.d.ts'; \
  fs.writeFileSync('packages/shared/package.json', JSON.stringify(p, null, 2)); \
"

# Build server — @jever/shared is only used for types (erased at compile time)
RUN npm run build --workspace=apps/server

# ─── Stage 2: Production runner ───────────────────────────────────────────────
FROM node:20-alpine AS runner

RUN apk add --no-cache \
    chromium nss freetype harfbuzz \
    ca-certificates ttf-freefont font-noto

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

WORKDIR /app

# Copy compiled server — no @jever/shared import remains in the JS output
COPY --from=builder /app/apps/server/dist ./dist

# Install production deps (@jever/shared removed — it has no runtime presence)
COPY apps/server/package.json ./package.json
RUN node -e " \
  const fs = require('fs'); \
  const p = JSON.parse(fs.readFileSync('package.json','utf8')); \
  delete p.dependencies['@jever/shared']; \
  fs.writeFileSync('package.json', JSON.stringify(p, null, 2)); \
"
RUN npm install --omit=dev

RUN mkdir -p uploads/invoices uploads/products uploads/logo

EXPOSE 3001
CMD ["node", "dist/index.js"]
