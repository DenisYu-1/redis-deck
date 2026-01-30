FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json yarn.lock ./

RUN yarn install --frozen-lockfile

COPY . .

RUN yarn build

FROM node:20-alpine

RUN apk add --no-cache redis

WORKDIR /app

COPY package*.json yarn.lock ./

RUN yarn install --production --frozen-lockfile

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public
COPY --from=builder /app/config ./config
COPY --from=builder /app/routes ./routes
COPY --from=builder /app/services ./services
COPY --from=builder /app/server.js ./server.js

RUN mkdir -p /app/data && chmod 777 /app/data

EXPOSE 3000

CMD ["node", "server.js"]