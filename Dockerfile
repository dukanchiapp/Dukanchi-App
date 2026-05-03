FROM node:22-alpine

# Canvas and node-gyp native build deps (Alpine uses apk)
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    pkgconfig \
    cairo-dev \
    pango-dev \
    jpeg-dev \
    giflib-dev \
    librsvg-dev \
    pixman-dev

WORKDIR /app

# Install dependencies first exactly as in package.json
COPY package.json package-lock.json* ./
RUN npm ci

# Copy full application code
COPY . .

# Generate Prisma client
RUN node_modules/.bin/prisma generate

# Build frontend (Vite)
RUN npm run build

EXPOSE 3000

# Use tsx to run TypeScript server directly (no separate TS compilation step)
CMD ["node_modules/.bin/tsx", "server.ts"]
