FROM node:24-alpine AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:24-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000
RUN addgroup -g 10001 -S hookshade && adduser -u 10001 -S hookshade -G hookshade
COPY --from=builder --chown=hookshade:hookshade /app/.next/standalone ./
COPY --from=builder --chown=hookshade:hookshade /app/.next/static ./.next/static
USER hookshade
EXPOSE 3000
CMD ["node", "server.js"]
