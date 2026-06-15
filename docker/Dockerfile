# Stage 1: Build NestJS backend
FROM node:20-bookworm AS builder
WORKDIR /app

# Copy dependency files
COPY package*.json ./
RUN npm ci --build-from-source

# Copy backend files and database schema
COPY . .

# Build application
RUN npm run build

# Remove development dependencies
RUN npm prune --production

# Stage 2: Runtime
FROM node:20-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production

# Copy compiled JS and dependencies from builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package*.json ./
COPY schema.sql ./
COPY docker/docker-entrypoint.sh ./

# Create db directory for Volume2 persistent mount and ensure entrypoint script is executable
RUN mkdir -p db && chmod +x ./docker-entrypoint.sh

EXPOSE 3000

# Run entrypoint script
ENTRYPOINT ["sh", "./docker-entrypoint.sh"]
