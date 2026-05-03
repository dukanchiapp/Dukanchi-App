FROM node:22-bookworm-slim

# Canvas native deps + Prisma requirements (Debian)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    python3 \
    pkg-config \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    openssl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies first exactly as in package.json
COPY package.json package-lock.json* ./
RUN npm ci

# Copy full application code
COPY . .

# Generate Prisma client (debian-openssl-3.0.x binary)
RUN node_modules/.bin/prisma generate

# Build main frontend (Vite)
RUN npm run build

# Build admin panel
RUN cd admin-panel && npm install && npm run build

EXPOSE 3000

# Use tsx to run TypeScript server directly (no separate TS compilation step)
CMD ["node_modules/.bin/tsx", "server.ts"]
