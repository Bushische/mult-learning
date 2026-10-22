# syntax=docker/dockerfile:1
# --- web image (build -> nginx serving the static PWA + /api proxy) ------------

FROM node:22-alpine AS build
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /app
ENV PNPM_HOME=/usr/local/bin
COPY . .
RUN pnpm install --frozen-lockfile \
  && pnpm --filter @mult/shared build \
  && pnpm --filter web build

FROM nginx:alpine AS release
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
