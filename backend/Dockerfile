FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production

# Install only production dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy only required source files (excluding tests, local .env files, dev settings)
COPY app.js index.js worker.js ./
COPY src/ ./src/

# Setup uploads folder and secure ownership for non-root node user
RUN mkdir -p /app/uploads && chown -R node:node /app

USER node
EXPOSE 5000

# Native Node healthcheck to verify liveness
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "const http = require('http'); const req = http.request('http://localhost:' + (process.env.PORT || 5000) + '/health', (res) => { if (res.statusCode === 200) { process.exit(0); } else { process.exit(1); } }); req.on('error', () => process.exit(1)); req.end();"

CMD ["node", "index.js"]
