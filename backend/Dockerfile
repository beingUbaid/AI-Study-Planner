# ── STAGE 1: BUILD DEPENDENCIES ──
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci

# Copy application files
COPY . .

# ── STAGE 2: PRODUCTION RUNTIME ──
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Install only production dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy built dependencies from build stage
COPY --from=builder /app ./

# Setup production directories
RUN mkdir -p /app/uploads && chown -R node:node /app

# Expose port and run as non-root node user
USER node
EXPOSE 5000

# Docker healthcheck utilizing node script directly to check API health state
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "const http = require('http'); const req = http.request('http://localhost:' + (process.env.PORT || 5000) + '/health', (res) => { if (res.statusCode === 200) { process.exit(0); } else { process.exit(1); } }); req.on('error', () => process.exit(1)); req.end();"

# Start the application directly utilizing node to pass signals (SIGTERM/SIGINT) correctly
CMD ["node", "index.js"]
