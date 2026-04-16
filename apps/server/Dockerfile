# ─── Stage 1: Build ───────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root workspace manifests first (layer-cache friendly)
COPY package.json package-lock.json turbo.json ./

# Copy only the package.json files for every workspace so npm ci can
# resolve the full workspace graph without copying all source code yet.
COPY packages/shared/package.json ./packages/shared/package.json
COPY apps/server/package.json     ./apps/server/package.json

# Create a minimal stub for apps/admin so npm does not error on the
# "apps/*" workspace glob — we are not building the admin here.
RUN mkdir -p apps/admin && \
    echo '{"name":"@jever/admin","version":"1.0.0","private":true}' \
    > apps/admin/package.json

# Install ALL workspace dependencies (including devDeps needed for tsc)
RUN npm ci

# Now copy the real source trees
COPY packages/ ./packages/
COPY apps/server/ ./apps/server/

# ── Build shared package first ────────────────────────────────────────────────
RUN npm run build --workspace=packages/shared

# Patch shared/package.json so server's tsc resolves to the compiled dist,
# not the raw TypeScript source (needed because main = ./src/index.ts in dev).
RUN node -e " \
  const fs = require('fs'); \
  const p = JSON.parse(fs.readFileSync('packages/shared/package.json','utf8')); \
  p.main  = './dist/index.js'; \
  p.types = './dist/index.d.ts'; \
  fs.writeFileSync('packages/shared/package.json', JSON.stringify(p, null, 2)); \
"

# ── Build server ──────────────────────────────────────────────────────────────
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

# Copy compiled server output
COPY --from=builder /app/apps/server/dist ./dist

# Copy shared package — use the patched package.json (main → dist/)
# and the compiled dist so the server can import @jever/shared at runtime.
COPY --from=builder /app/packages/shared/dist         ./node_modules/@jever/shared/dist
COPY --from=builder /app/packages/shared/package.json ./node_modules/@jever/shared/package.json

# Copy server package.json and install only production deps
COPY apps/server/package.json ./
RUN npm install --omit=dev

# Create uploads directories
RUN mkdir -p uploads/invoices uploads/products uploads/logo

EXPOSE 3001

CMD ["node", "dist/index.js"]
