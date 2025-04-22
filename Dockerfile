# Use Node.js as base image
FROM node:20-alpine

# Install redis-cli
RUN apk add --no-cache redis

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json yarn.lock ./

# Install dependencies
RUN yarn install

# Copy application code
COPY . .

# Create data directory for database persistence
RUN mkdir -p /app/data && chmod 777 /app/data

# Expose the port the app runs on
EXPOSE 3000

# Start the application
CMD ["node", "server.js"] 