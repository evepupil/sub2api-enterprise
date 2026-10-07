# 客户官网（Next.js standalone）生产镜像。构建：在 frontend-portal/ 下
#   docker build -t sub2api-enterprise-portal:<版本> .
# 运行时必须给 SUB2API_INTERNAL_URL（官网服务器调后台的内网地址，如 http://sub2api:8080），见 deploy/PORTAL.md。
ARG NODE_IMAGE=node:24-alpine
# 依赖镜像源：国内默认 npmmirror，海外构建可传 --build-arg NPM_REGISTRY=https://registry.npmjs.org
ARG NPM_REGISTRY=https://registry.npmmirror.com

FROM ${NODE_IMAGE} AS deps
ARG NPM_REGISTRY
WORKDIR /app
ENV COREPACK_NPM_REGISTRY=${NPM_REGISTRY} npm_config_registry=${NPM_REGISTRY}
RUN corepack enable
COPY package.json pnpm-lock.yaml .npmrc ./
RUN pnpm install --frozen-lockfile

FROM ${NODE_IMAGE} AS build
ARG NPM_REGISTRY
WORKDIR /app
ENV COREPACK_NPM_REGISTRY=${NPM_REGISTRY} NEXT_TELEMETRY_DISABLED=1
RUN corepack enable
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

FROM ${NODE_IMAGE} AS runtime
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0 TZ=Asia/Shanghai
RUN addgroup -S portal && adduser -S portal -G portal
# standalone 产物：server.js、精简后的依赖与服务端代码；静态资源和 public 要另外拷进去
COPY --from=build --chown=portal:portal /app/.next-build/standalone ./
COPY --from=build --chown=portal:portal /app/.next-build/static ./.next-build/static
COPY --from=build --chown=portal:portal /app/public ./public
USER portal
EXPOSE 3000
# 端口跟着 PORT 走（改端口运行时健康检查不会误报）
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -q -T 5 -O /dev/null "http://127.0.0.1:${PORT}/api/portal/health" || exit 1
CMD ["node", "server.js"]
