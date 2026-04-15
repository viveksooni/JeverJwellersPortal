# ─── Stage 1: Build ───────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json turbo.json ./
COPY packages/ ./packages/
COPY apps/admin/ ./apps/admin/

RUN npm ci --workspace=apps/admin --workspace=packages/shared --include-workspace-root

RUN npm run build --workspace=packages/shared
RUN npm run build --workspace=apps/admin

# ─── Stage 2: Nginx static server ─────────────────────────────────────────────
FROM nginx:alpine AS runner

# Copy built files
COPY --from=builder /app/apps/admin/dist /usr/share/nginx/html

# SPA routing — fall back to index.html for all routes
RUN echo 'server { \
    listen 80; \
    root /usr/share/nginx/html; \
    index index.html; \
    location / { try_files $uri $uri/ /index.html; } \
    location ~* \.(js|css|png|jpg|jpeg|svg|ico|woff2)$ { \
        expires 1y; \
        add_header Cache-Control "public, immutable"; \
    } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 80
