# 工厂物料管理系统（最小可运行后端）

本目录提供一个 Node.js + TypeScript + Express + TypeORM + PostgreSQL 的最小可运行后端，支持以下 API：
- GET /api/materials
- GET /api/stocks
- POST /api/inbounds
- POST /api/outbounds
- GET /api/orders/:code

默认需要请求头 X-API-Key: dev-api-key

## 本地快速启动（Docker 推荐）
1. 安装 Docker Desktop。
2. 在仓库根目录执行：
   - docker compose up -d --build
3. 访问：
   - 健康检查: http://localhost:8080/health

### 局域网联调
若你希望在同一局域网的其他设备上访问前端并调用本机 API：
- 前端开发：
   - cd web && npm install && npm run dev
   - 记录终端输出的 Network 地址（如 http://192.168.x.x:5173/），分享给同网段同事即可访问。
   - 我们已在 Vite 配置了 `server.host=true` 与 `/api -> http://localhost:8080` 代理；其他设备访问 5173 即可透传到你本机 8080。
- 后端（Docker）：确保 `docker compose up -d --build` 已启动，映射端口 8080 已开放。
- 若需生产构建预览：
   - cd web && npm run build && npm run preview
   - 终端同样会给出 Network 地址（默认端口 4173）。

## 本地开发（不使用 Docker）
1. 安装 PostgreSQL 并启动，确保连接参数与 server/.env 一致（或复制 .env.example 为 .env 并修改 DB_HOST=localhost）。
2. 安装依赖并启动：
   - cd server
   - npm install
   - cp .env.example .env
   - npm run dev
3. 前端同样支持局域网访问（同上“局域网联调”）。

## 初始化数据（示例）
首启时会自动建表（DB_SYNC=true）。你可以调用 API 新建入库/出库；如需预置物料与仓库，请先调用：
- POST /api/inbounds 之前需确保存在 material(code) 与 warehouse(code)，目前默认仓库使用 WH1。

## 说明
- 此为最小骨架，未实现用户登录与完整 RBAC，仅提供 API Key 鉴权示例。
- 库存扣减采用简单 FEFO 规则，未实现乐观锁/版本号并发控制，后续可增强。
- 更多业务与字段见 docs/需求说明书-物料管理系统.md 与 docs/openapi.yaml。
