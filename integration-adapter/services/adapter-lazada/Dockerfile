FROM node:20-alpine

WORKDIR /app

# Copy workspace root manifest and all local packages so npm workspaces
# can resolve @cxbox/adapter-core as a local symlink
COPY package.json ./
COPY packages/adapter-core ./packages/adapter-core
COPY services/adapter-lazada/package.json ./services/adapter-lazada/package.json

# Install all workspace deps from root so symlinks are created correctly
RUN npm install --production --workspaces

# Copy the service source after install to leverage layer caching
COPY services/adapter-lazada/src ./services/adapter-lazada/src

WORKDIR /app/services/adapter-lazada

EXPOSE 3001

CMD ["node", "src/app.js"]
