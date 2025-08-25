# 工厂物料管理系统

更多文档见 `docs/README.md`（架构、OpenAPI、测试、Roadmap、需求）。

快速开始：
- 一键开发启动：`scripts/start-dev.sh`
- 后端：`cd server && npm run dev`
- 前端：`cd web && npm run dev`

说明：使用 PostgreSQL + TypeORM 迁移（DB_SYNC=false），开发鉴权支持 `X-API-Key: dev-api-key` 或登录获取 JWT。
