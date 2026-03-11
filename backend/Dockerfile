FROM node:20-alpine

# Install openssl to generate self-signed dev certificates
RUN apk add --no-cache openssl

WORKDIR /app

COPY package*.json ./
RUN npm install

# Generate self-signed certificate for development (HTTPS requirement)
RUN mkdir -p certs && \
    openssl req -nodes -new -x509 -keyout certs/server.key -out certs/server.cert -subj "/C=US/ST=State/L=City/O=Organization/OU=Unit/CN=localhost"

# Copy source and static assets
COPY tsconfig.json ./
COPY src ./src
COPY public ./public

# Build TypeScript
RUN npm run build

EXPOSE 3000

# Start compiled server
CMD ["npm", "start"]
