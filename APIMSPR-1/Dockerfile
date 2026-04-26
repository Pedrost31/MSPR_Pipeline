# ── Stage 1 : Build React ───────────────────────────────────────────
FROM node:20-alpine AS frontend
WORKDIR /app

COPY client/package*.json ./client/
RUN cd client && npm ci

COPY client/ ./client/
# vite.config.js : outDir = '../public/dist'  →  /app/public/dist
RUN cd client && npm run build

# ── Stage 2 : API Node.js ────────────────────────────────────────────
FROM node:20-alpine AS api
WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY src/ ./src/

# Copier le build React depuis le stage frontend
COPY --from=frontend /app/public/dist ./public/dist

EXPOSE 3000
CMD ["node", "src/index.js"]
