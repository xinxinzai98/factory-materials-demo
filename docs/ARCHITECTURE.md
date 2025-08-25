# 架构与技术说明

- 后端：Node.js + TypeScript + Express + TypeORM + PostgreSQL
  - 模块：鉴权(API Key + JWT)、RBAC(ADMIN/OP/VIEWER)、物料/库存/入库/出库/移库/调整
  - 数据迁移：使用 TypeORM migrations（关闭 synchronize）
  - 事务：单据过账/调整/移库使用事务
- 前端：Vite + React + Ant Design
  - 路由：入/出库列表与详情、材料、库存、转移、调整、设置、Dashboard、Splash
  - 主题：深/浅主题切换与玻璃拟态样式
- 部署/开发：Dockerfile（后端）、docker-compose（DB+API），一键脚本 `scripts/start-dev.sh`

## 鉴权与 RBAC
- 访问保护：所有 /api 路由默认使用 `authGuard`，支持 X-API-Key 或 JWT
- 角色权限：
  - ADMIN：完全权限，含取消单据、维护仓库
  - OP：业务操作（新建、审批、过账、移库、调整）
  - VIEWER：只读

## 单据状态
- 入库单：DRAFT -> APPROVED -> PUTAWAY -> (CANCELLED)
- 出库单：DRAFT -> APPROVED -> PICKED -> (CANCELLED)
- 即时入/出库：创建后直接过账（入：APPROVED+入账；出：直接 PICKED），避免重复扣/加