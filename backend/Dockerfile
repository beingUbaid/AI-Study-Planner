# Pinned Node 20 alpine image
FROM node:20.18.0-alpine

# Set environment
ENV NODE_ENV=production
WORKDIR /app

# Copy package descriptors first to benefit from layer caching
COPY package.json package-lock.json ./

# Run audit report step as requested, then install production-only dependencies
RUN npm audit --omit=dev || true \
    && npm ci --omit=dev \
    && npm cache clean --force

# Copy only index.js, worker.js, app.js and source directory src
COPY index.js worker.js app.js ./
COPY src/ ./src/

# Ensure the uploads directory exists and is owned by the node user
RUN mkdir -p /app/uploads \
    && chown -R node:node /app

# Switch to the non-root node user
USER node

# Expose backend port
EXPOSE 5000

# Docker healthcheck using the readiness endpoint /ready
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "const http = require('http'); const req = http.request({ host: 'localhost', port: process.env.PORT || 5000, path: '/ready', timeout: 2000 }, (res) => { if (res.statusCode === 200) { process.exit(0); } else { process.exit(1); } }); req.on('error', () => process.exit(1)); req.end();"

# Start the application
CMD ["node", "index.js"]
