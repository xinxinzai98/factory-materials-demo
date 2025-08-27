# 架构与技术说明

- 后端：Node.js + TypeScript + Express + TypeORM + PostgreSQL
  - 模块：鉴权(API Key + JWT)、RBAC(ADMIN/OP/VIEWER)、物料/库存/入库/出库/移库/调整
  - 数据迁移：使用 TypeORM migrations（关闭 synchronize）
  - 事务：单据过账/调整/移库使用事务
- 前端：Vite + React + Ant Design
  - 路由：入/出库列表与详情、材料、库存、转移、调整、设置、Dashboard、Splash
  - 主题：深/浅主题切换与玻璃拟态样式
- 部署/开发：Dockerfile（后端）、docker-compose（DB+API），一键脚本 `scripts/start-dev.sh`

## 分析与报表（Analytics）
- 页面：`/analytics`（前端 `web/src/pages/Analytics.tsx`）
  - 关键指标卡片：物料数、库存总量、临期批次数（阈值内）、低库存物料数、滞销物料数、未读预警数
  - 趋势：
    - 日趋势（最近 N 天，默认 30 天）与周趋势（最近 N 周，默认 12 周）切换
    - 支持筛选并带参导出 CSV
  - 低库存 Top N：支持按仓库与关键字筛选并导出 CSV
- 后端接口（均位于 `server/src/routes/api.ts`）：
  - KPIs 概览：`GET /api/metrics/dashboard`
  - 日趋势：`GET /api/metrics/trends`，导出：`GET /api/metrics/trends.csv`
  - 周趋势：`GET /api/metrics/weekly`，导出：`GET /api/metrics/weekly.csv`
  - 低库存 TopN：`GET /api/metrics/low-stocks`，导出：`GET /api/metrics/low-stocks.csv`
  - 基础主数据：仓库列表 `GET /api/warehouses`；库位列表 `GET /api/locations?warehouse=WH1&enabled=true`
- 筛选与参数约定：
  - 通用日期：`dateFrom`、`dateTo`（YYYY-MM-DD，可任选其一）
  - 趋势：`days`（1-90，默认30）、`weeks`（1-52，默认12）、`materialCode`（精确匹配）
  - 低库存：`limit`（默认10）、`warehouse`（仓库code）、`q`（物料编码/名称模糊）
  - 导出 CSV 与查询接口参数一致，可直接拼接查询串

## 指标口径定义
- 全局阈值来源：`app_settings` 表中的 `thresholds` JSON，形如 `{ globalMinQty, expiryDays, slowDays }`
  - `globalMinQty`：最低安全库存阈值（用于低库存统计）
  - `expiryDays`：临期天数阈值（如 30 天内到期为临期）
  - `slowDays`：滞销天数阈值（如 60 天内无出库视为滞销）
- KPIs：
  - `materialsCount`：`materials` 总数
  - `stocksQtyOnHand`：`stocks.qty_on_hand` 全量求和
  - `soonToExpireBatches`：`exp_date` 在 `expiryDays` 天内且 `qty_on_hand > 0` 的批次数
  - `inboundsToday`、`outboundsToday`：当日创建的入库单/出库单数量
  - `unreadNotifications`：未读通知数量
  - `lowStockMaterials`：按物料聚合总在库量，`sum(qty_on_hand) < globalMinQty` 的物料数量
  - `slowMaterials`：当前有存量但 `slowDays` 内没有任何出库记录的物料数量

### 口径对齐补充
- 低库存统计严格以 `app_settings.thresholds.globalMinQty` 为准，按物料维度汇总总在库量后比较。
- 临期批次口径：仅统计有库存的批次（qty_on_hand > 0），并以 `expiryDays` 天内到期作为临期阈值。
- 滞销物料口径：有存量但在 `slowDays` 内无任何出库订单涉及该物料（按订单去重）。
- 趋势统计：
  - 不筛物料时，统计每天/每周的订单数量（入库单/出库单）。
  - 指定 `materialCode` 时，统计包含该物料的订单数量（对订单去重）。
- 趋势对比（多物料）：并行获取每个物料的按日趋势并按日期对齐，支持 CSV 导出；当前数据模型中订单不绑定仓库，故不提供“按仓库的趋势对比”，仓库维度建议通过库存变动报表实现（后续可选）。

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

## 功能说明与角色可见性
- 菜单项
  - 仪表盘：关键指标与快捷入口（全部角色可见）
  - 物料：物料主数据查看与新增（VIEWER 仅查看；OP/ADMIN 可新增）
  - 库存：按物料/仓库/批次查询（全部可见）
  - 入库单：列表/详情/草稿/审批/上架（VIEWER 仅查看；OP/ADMIN 可操作）
  - 出库单：列表/详情/草稿/审批/拣货（VIEWER 仅查看；OP/ADMIN 可操作）
  - 移库：在仓间/批次间转移库存（OP/ADMIN 可见）
    - Transfer 页下拉：仓库来源自 `/warehouses`，库位来源自 `/locations?warehouse=...`；
      当提交参数包含 `toLocation` 且该库位存在时，目标库存记录会设置到该库位。
  - 盘点/调整：将批次库存强制到目标量（OP/ADMIN 可见）
  - 设置：系统参数、API 基址/Key、主题切换（OP/ADMIN 可见；部分只读）

> 前端按 localStorage 中 role 进行菜单过滤；后端路由由 RBAC 强制校验，确保越权无效。

## PWA 与缓存策略
- 预缓存：构建产物通过 generateSW 生成 precache manifest。
- 运行时缓存（workbox.runtimeCaching，见 `web/vite.config.ts`）：
  - 参考数据（warehouses/locations/materials/settings）：CacheFirst，24h 失效。
  - 列表与指标（inbounds/outbounds/stocks/metrics）：StaleWhileRevalidate，10min 失效。
  - 通知（notifications）：NetworkFirst，5s 超时兜底缓存，10min 失效。
- 前端在 App 中展示离线横幅与 SW 更新提示按钮。

## 导出体系与动态加载
- 前端导出统一走 `web/src/utils/exportExcel.ts`：
  - 使用 `import('xlsx')` 动态按需加载，避免首屏加载大型依赖。
  - `exportToExcel` 与 `exportCsvToExcel` 为 async，调用方需 `await`。
- 自定义导出：入/出库列表与明细均改为 JSON 驱动，支持勾选字段、列顺序、自定义列头与模板（localStorage 持久化）。
- 导出字段一致性：新增 `server/src/scripts/export-parity.ts`，校验 CSV 表头与 JSON 字段命名一致；CI/本地可运行 `npm run test:export-parity`。

## 构建与拆包策略（前端）
- 路由级懒加载：所有页面以 `React.lazy` 按路由拆分，减少首屏体积。
- 手动 vendor 分包（见 `web/vite.config.ts` → `manualChunks`）：
  - react/react-dom → vendor-react
  - antd → vendor-antd
  - @ant-design/icons → vendor-icons
  - rc-* / @rc-component → vendor-rc
  - dayjs → vendor-dayjs
  - xlsx（动态导入）→ vendor-xlsx（稳定 chunk 名便于缓存）
- 其他：去除 console/debugger，保持较低首屏包体；PWA 预缓存构建产物。