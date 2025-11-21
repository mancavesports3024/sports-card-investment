FROM node:20-alpine AS base
WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./
COPY backend/package.json backend/package-lock.json* ./backend/

# Install root deps first
RUN npm install --omit=dev

# Install backend deps
RUN cd backend && npm install --omit=dev

# Copy all source files
COPY . .

ENV NODE_ENV=production

CMD ["node", "backend/index.js"]


