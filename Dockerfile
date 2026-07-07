# ============================================
# RBN Hostel WhatsApp Agent - Dockerfile
# Uses puppeteer's bundled Chromium for reliability
# ============================================

FROM ghcr.io/puppeteer/puppeteer:22

# Root user to install packages
USER root

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (allow puppeteer to download its own Chromium)
RUN npm ci --omit=dev

# Copy source code
COPY . .

# Create required directories and fix permissions
RUN mkdir -p images data .wwebjs_auth .wwebjs_cache && chown -R pptruser:pptruser /app

# Use the puppeteer user (non-root, for security)
USER pptruser

# Expose port
EXPOSE 3000

# Start agent
CMD ["node", "index.js"]
