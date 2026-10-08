FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN --mount=type=secret,id=npm_ca,required=false \
    if [ -f /run/secrets/npm_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/npm_ca; fi; \
    npm ci
COPY . .
RUN npm run build

FROM node:24-bookworm-slim
ENV NODE_ENV=production PORT=3000
WORKDIR /app
COPY package*.json ./
RUN --mount=type=secret,id=npm_ca,required=false \
    if [ -f /run/secrets/npm_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/npm_ca; fi; \
    npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY server ./server
COPY shared ./shared
# COPY preserves workspace permissions; runtime code must remain readable to USER node.
# Keep code root-owned, with write access reserved for the account-data directory.
RUN chmod -R u=rwX,go=rX /app/server /app/shared /app/dist \
    && chmod 644 /app/package*.json \
    && mkdir -p /app/data \
    && chmod 700 /app/data \
    && chown node:node /app/data
USER node
EXPOSE 3000
CMD ["node", "server/index.mjs"]
