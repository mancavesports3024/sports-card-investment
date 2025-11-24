FROM node:20-alpine AS base
WORKDIR /app

# Install build tools required for native modules like sqlite3
RUN apk add --no-cache python3 make g++

# Install root deps (shared libs like axios, cookie jar, proxy agent)
COPY package.json package-lock.json* ./
RUN npm install --omit=dev

# Install backend deps
COPY backend/package.json backend/package-lock.json* ./backend/
RUN cd backend && npm install --omit=dev

# Copy source
COPY . .

ENV NODE_ENV=production

CMD ["node", "backend/index.js"]


