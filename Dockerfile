FROM node:20-alpine AS base
WORKDIR /app

# Install backend deps first (main dependencies)
COPY backend/package.json backend/package-lock.json* ./backend/
WORKDIR /app/backend
RUN npm install --omit=dev

# Install root deps (shared libs like axios, cookie jar, proxy agent)
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=dev

# Copy source (do this last to avoid invalidating cache)
COPY . .

ENV NODE_ENV=production

WORKDIR /app
CMD ["node", "backend/index.js"]


