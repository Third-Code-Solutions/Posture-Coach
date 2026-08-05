FROM node:22-alpine AS build

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

FROM node:22-alpine AS runtime

WORKDIR /app
ENV NODE_ENV=production

COPY --from=build --chown=node:node /app/out ./out
COPY --from=build --chown=node:node /app/scripts/static-server.mjs ./scripts/static-server.mjs

USER node

EXPOSE 3000

CMD ["node", "scripts/static-server.mjs"]
