FROM node:20-slim AS builder

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

COPY index.html vite.config.js ./
COPY .env.production ./
COPY src/ ./src/

ENV VITE_USE_API=true
ENV VITE_API_BASE=
RUN npm run build

FROM node:20-slim

RUN apt-get update && \
    apt-get install -y --no-install-recommends python3 make g++ && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY server/package.json server/package-lock.json ./server/
RUN cd server && npm ci --omit=dev

RUN apt-get purge -y python3 make g++ && apt-get autoremove -y

COPY server/ ./server/
COPY --from=builder /app/dist ./dist

RUN mkdir -p server/db server/uploads/eval

ENV NODE_ENV=production
ENV PORT=3001
EXPOSE 3001

CMD ["node", "server/index.js"]
