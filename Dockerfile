# Build stage
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json yarn.lock ./

# Install all dependencies (including dev dependencies for build)
RUN yarn install --frozen-lockfile

# Copy source code
COPY . .

# Build the React application
RUN yarn build

# Production stage
FROM node:20-alpine

# Install redis-cli
RUN apk add --no-cache redis

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json yarn.lock ./

# Install only production dependencies
RUN yarn install --production --frozen-lockfile

# Copy built application from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public
COPY --from=builder /app/config ./config
COPY --from=builder /app/routes ./routes
COPY --from=builder /app/services ./services
COPY --from=builder /app/server.js ./server.js

# Create data directory for database persistence
RUN mkdir -p /app/data && chmod 777 /app/data

# Expose the port the app runs on
EXPOSE 3000

# Start the application
CMD ["node", "server.js"] 