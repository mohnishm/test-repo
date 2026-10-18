# syntax=docker/dockerfile:1
ARG NODE_IMAGE=node:24-alpine

# ---- build: install all deps and compile TypeScript ----
FROM ${NODE_IMAGE} AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-fund --no-audit
COPY tsconfig.json ./
COPY src ./src
COPY test ./test
RUN npm run build

# ---- test: run unit tests (docker build --target test .) ----
FROM build AS test
RUN npm test

# ---- runtime: production deps + compiled JS only ----
FROM ${NODE_IMAGE} AS runtime
ENV NODE_ENV=production \
    PORT=3000
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-fund --no-audit && npm cache clean --force
COPY --from=build /app/dist/src ./dist/src

# Jenkins passes these in so each image reports which build produced it.
ARG BUILD_NUMBER=local
ARG GIT_COMMIT=unknown
ENV BUILD_NUMBER=${BUILD_NUMBER} \
    GIT_COMMIT=${GIT_COMMIT}

USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD wget -qO- http://127.0.0.1:3000/healthz || exit 1
CMD ["node", "dist/src/server.js"]
