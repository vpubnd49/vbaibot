# ==============================================================================
# Multi-stage Dockerfile chuẩn Production & An ninh cao cho vbaibot
# - Chạy dưới Non-root user (node:node, UID 1000)
# - Phân tách rõ ràng giữa Build Stage và Runtime Stage
# - Giảm thiểu tối đa attack surface trên nền Alpine Linux
# ==============================================================================

# Stage 1: Build & Compile
FROM node:22-alpine AS builder

WORKDIR /app

# Cài đặt pnpm và build tools cần thiết (python3, make, g++ cho native modules nếu có)
RUN npm install -g pnpm && apk add --no-cache python3 make g++

# Copy package files để tận dụng Docker layer cache
COPY package.json pnpm-lock.yaml tsconfig*.json ./

# Cài đặt dependencies đầy đủ để build
RUN pnpm install --frozen-lockfile

# Copy toàn bộ mã nguồn
COPY src/ ./src/
COPY web/ ./web/
COPY config/ ./config/
COPY data/administrative_divisions.json ./data/

# Build Web Frontend & Compile TypeScript Backend
RUN pnpm build:web && pnpm build

# Loại bỏ devDependencies để thu gọn node_modules cho production
RUN pnpm prune --prod

# ==============================================================================
# Stage 2: Production Runtime
FROM node:22-alpine AS runner

# pdftoppm dùng cho OCR PDF scan; cài ở runtime vì builder không chạy OCR.
RUN apk add --no-cache poppler-utils

# Thiết lập môi trường Production
ENV NODE_ENV=production
ENV PORT=3000

WORKDIR /app

# Tạo thư mục dữ liệu và cấp quyền cho user 'node'
RUN mkdir -p /app/data /app/data/logs /app/data/media /app/data/accounts && \
    chown -R node:node /app

# Copy production node_modules và build artifacts từ Stage 1
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/dist ./dist
COPY --from=builder --chown=node:node /app/web/dist ./web/dist
COPY --from=builder --chown=node:node /app/config ./config
COPY --from=builder --chown=node:node /app/package.json ./package.json

# Copy tệp dữ liệu hành chính nếu có
COPY --from=builder --chown=node:node /app/data/administrative_divisions.json ./data/

# Chuyển sang user không có quyền root (UID 1000)
USER node

# Khai báo volume lưu trữ dữ liệu bền vững
VOLUME ["/app/data"]

# Mở cổng Dashboard HTTP Server
EXPOSE 3000

# Healthcheck định kỳ kiểm tra sức khỏe container
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

# Khởi động ứng dụng
CMD ["node", "dist/index.js"]
