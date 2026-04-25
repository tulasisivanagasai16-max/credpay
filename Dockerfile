# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files and sources
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY lib ./lib
COPY artifacts/api-server ./artifacts/api-server

# Install pnpm
RUN npm install -g pnpm@10

# Install dependencies
RUN pnpm install --frozen-lockfile

# Build the application
WORKDIR /app/artifacts/api-server
RUN pnpm run build

# Runtime stage
FROM node:20-alpine

WORKDIR /app

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Copy built application from builder
COPY --from=builder /app/artifacts/api-server/dist ./dist
COPY --from=builder /app/artifacts/api-server/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules

# Ensure thread-stream worker is available in the expected location
RUN mkdir -p /app/artifacts/api-server/dist && cp /app/dist/thread-stream-worker.mjs /app/artifacts/api-server/dist/ 2>/dev/null || true

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
USER nodejs

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Expose port
EXPOSE 3000

# Use dumb-init to properly handle signals
ENTRYPOINT ["dumb-init", "--"]

# Start application
CMD ["node", "--enable-source-maps", "./dist/index.mjs"]
