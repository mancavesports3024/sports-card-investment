FROM node:20-alpine AS base
WORKDIR /app

# Install backend deps
COPY package.json package-lock.json* ./
RUN npm install --omit=dev

# Copy backend source
COPY . .

ENV NODE_ENV=production

CMD ["node", "index.js"]











