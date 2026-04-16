# ─── Stage 1: Build ───────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root workspace manifests (layer-cache friendly)
COPY package.json package-lock.json turbo.json ./

# Copy only the package.json files for every workspace so npm can
# resolve the full workspace graph without copying all source code yet.
COPY packages/shared/package.json ./packages/shared/package.json
COPY apps/server/package.json     ./apps/server/package.json

# Stub for apps/admin — prevents npm from erroring on the "apps/*" glob
# since we're not building the admin in this image.
RUN mkdir -p apps/admin && \
    echo '{"name":"@jever/admin","version":"1.0.0","private":true}' \
    > apps/admin/package.json

# Install ALL workspace dependencies (incl. devDeps needed for tsc)
RUN npm ci

# Copy the actual source trees
COPY packages/ ./packages/
COPY apps/server/ ./apps/server/

# ── 1. Build shared (CommonJS output + .d.ts declarations) ───────────────────
RUN npm run build --workspace=packages/shared

# Patch shared/package.json so server's tsc resolves to the compiled dist,
# not the raw TypeScript source file used in dev.
RUN node -e " \
  const fs = require('fs'); \
  const p = JSON.parse(fs.readFileSync('packages/shared/package.json','utf8')); \
  p.main  = './dist/index.js'; \
  p.types = './dist/index.d.ts'; \
  fs.writeFileSync('packages/shared/package.json', JSON.stringify(p, null, 2)); \
"

# ── 2. Build server ───────────────────────────────────────────────────────────
RUN npm run build --workspace=apps/server

# ─── Stage 2: Production runner ───────────────────────────────────────────────
FROM node:20-alpine AS runner

# Chromium for Puppeteer PDF generation
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

# Copy shared package into node_modules (pre-built, no registry fetch needed)
RUN mkdir -p ./node_modules/@jever/shared
COPY --from=builder /app/packages/shared/dist         ./node_modules/@jever/shared/dist
COPY --from=builder /app/packages/shared/package.json ./node_modules/@jever/shared/package.json

# Copy server package.json, strip @jever/shared from deps so npm install
# does not try to fetch the private workspace package from the registry.
COPY apps/server/package.json ./package.json
RUN node -e " \
  const fs = require('fs'); \
  const p = JSON.parse(fs.readFileSync('package.json','utf8')); \
  delete p.dependencies['@jever/shared']; \
  fs.writeFileSync('package.json', JSON.stringify(p, null, 2)); \
"
RUN npm install --omit=dev

# Upload directories
RUN mkdir -p uploads/invoices uploads/products uploads/logo

EXPOSE 3001

CMD ["node", "dist/index.js"]
