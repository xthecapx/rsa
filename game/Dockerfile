FROM node:20-alpine

WORKDIR /app

# Force public npm; host ~/.npmrc / Artifactory must not affect the image.
COPY .npmrc package.json package-lock.json ./
RUN npm ci --registry=https://registry.npmjs.org/

COPY . .

# Next.js rewrites are baked at build time, so the backend URL must be known
# when `npm run build` runs. deploy-cloudrun.sh passes this after the backend
# is live; local defaults to the compose backend.
ARG BACKEND_URL=http://localhost:7001
ENV BACKEND_URL=$BACKEND_URL

RUN npm run build

ENV PORT=8080
EXPOSE 8080

CMD ["sh", "-c", "npx next start -H 0.0.0.0 -p ${PORT}"]
