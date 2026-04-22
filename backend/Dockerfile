FROM node:20-alpine

# Install openssl to run the cert generation script at startup
RUN apk add --no-cache openssl

WORKDIR /app

# Copy .npmrc first so npm settings apply during install
COPY .npmrc ./

# Copy package manifest only — npm install will generate a fresh lock file
COPY package.json ./

# Install with minimal network overhead (no audit, no fund calls)
RUN npm install --no-audit --no-fund

# Copy source and static assets
COPY tsconfig.json ./
COPY src ./src
COPY public ./public

# Copy entrypoint script and make it executable
COPY scripts/generate-certs.sh /usr/local/bin/generate-certs.sh
RUN chmod +x /usr/local/bin/generate-certs.sh

# Build TypeScript
RUN npm run build

EXPOSE 3000

# ENTRYPOINT runs the cert script first (generates if missing), then starts server
ENTRYPOINT ["generate-certs.sh"]
CMD ["npm", "start"]
