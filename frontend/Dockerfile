FROM node:20-alpine

WORKDIR /app

# Copy .npmrc first so npm settings apply during install
COPY .npmrc ./

# Copy package manifest only — no lock file to avoid stale-lock conflicts
COPY package.json ./

# Install with minimal network overhead
RUN npm install --no-audit --no-fund

COPY . .

EXPOSE 5173

CMD ["npm", "run", "dev"]
