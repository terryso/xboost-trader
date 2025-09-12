# Deployment Architecture

## Deployment Strategy

**Frontend Deployment:**
- **Platform:** 本地 macOS 系统
- **Build Command:** `npm run build`
- **Output Directory:** `dist/`
- **CDN/Edge:** 不适用（本地应用）

**Backend Deployment:**
- **Platform:** 本地 macOS 系统 + PM2 进程管理
- **Build Command:** `npm run build && npm run db:migrate`
- **Deployment Method:** 本地安装 + 系统服务注册

## CI/CD Pipeline

```yaml