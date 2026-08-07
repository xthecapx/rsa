FROM node:20-alpine

WORKDIR /app

# Force public npm; host ~/.npmrc / Artifactory must not affect the image.
COPY .npmrc package.json package-lock.json ./
RUN npm ci --registry=https://registry.npmjs.org/

COPY . .

EXPOSE 7013

CMD ["npm", "run", "dev"]
