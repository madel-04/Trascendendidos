FROM node:20-alpine

# Install openssl to run the cert generation script at startup
RUN apk add --no-cache openssl

WORKDIR /app

COPY package*.json ./
RUN npm install

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
