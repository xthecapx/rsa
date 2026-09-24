FROM node:20-alpine AS dependencies

WORKDIR /app

# Force public npm; host ~/.npmrc / Artifactory must not affect the image.
COPY .npmrc package.json package-lock.json ./
RUN npm ci --registry=https://registry.npmjs.org/

# Compose bind-mounts source and runs Next in development mode. Stop here so
# local rebuilds do not run an unused production build.
FROM dependencies AS development
ENV PORT=7019
EXPOSE 7019
CMD ["npm", "run", "dev"]

FROM dependencies AS builder
COPY . .

# Next.js rewrites are baked at build time. Cloud Run passes the deployed API
# URL; the local development stage reads BACKEND_URL at runtime instead.
ARG BACKEND_URL=http://localhost:7001
ENV BACKEND_URL=$BACKEND_URL
RUN npm run build

FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=8080
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 8080
CMD ["node", "server.js"]
