# 上线前核对清单（Go-Live Checklist）

> 目的：一次性、可审计、可复用。完成后在 MR / 发布说明中引用本文件，并对勾所有条目。若条目不适用请写明 "N/A"。

## 如何使用本清单（快速指引）
1. 新建发布分支：`git checkout -b release/vX.Y.Z`。
2. 执行 “自动初步检测” 脚本：`npm run go-live:scan > go-live-scan.txt`（输出当前可自动判定的项：端点可用、脚本存在、基础测试脚本结果）。
3. 按章节人工验证功能或运行脚本（参考列内命令），逐项在本文件打钩；对不能自动验证的项补充“证据”描述（如：日志截图、Grafana 面板 URL）。
4. MR 中引用：在描述首行添加：`参见 docs/GO_LIVE_CHECKLIST.md 已全部勾选`。
5. 审批人逐项复核后合并并打 tag（`npm run release:patch|minor|major`）。
6. 发布后保留本文件历史版本（不要移除勾选记录），下一次发布基于最新版本复制再清空复选框。


## 1. 版本与构建
- [x] 已创建新版本 tag（使用 `npm run release:patch|minor|major`）(v0.1.2)
- [x] CHANGELOG `[Unreleased]` 条目已并入新版本号段落 (0.1.1 / 0.1.2 做好迁移)
- [x] `dist/version.json` 含正确 `version` 与 `buildTime` (提交包含)
- [x] 发布说明生成 (`npm run gen:release-notes`) 并人工补充风险/回滚章节 (RELEASE_NOTES_0.1.2.md)

## 2. 环境与配置
- [ ] 生产 `.env` / Secret 中：未包含 `DB_SYNC=true`、未设置测试变量 `MIGRATIONS_GLOB=noop`
- [ ] `AUTO_SEED=false` 已确认 (当前本地测试已使用 false 重启, 生产需配置)
- [ ] `JWT_SECRET` ≥32 随机字节并存放安全存储（Vault / Secret Manager）
- [ ] API Key（若启用）已更换为生产随机值
- [ ] CORS 白名单为生产域名集合（非 `*`）
- [ ] Rate Limit 参数评审（典型峰值 ×1.5 裕度）

## 3. 数据库
- [ ] 预生产执行 `migration:run` 成功（无手工热修）
- [ ] Schema 快照已归档（`pg_dump -s`）
- [ ] 核心索引存在：code / status / createdAt / materialCode / warehouseCode / stockMovement.createdAt
- [ ] 连接池上限 < 数据库实例允许值（例如 pool 20 / 实例 200）
- [ ] 备份策略：每日自动快照 + 至少 7 天保留；手工逻辑 dump 演练成功
- [ ] 回滚演练：预生产执行一次 `migration:revert` 验证可逆（或记录不可逆原因）

## 4. 安全
- [ ] 默认账户初始密码全部修改（admin/op/viewer/testadmin）(已识别需生产执行)
- [ ] 登录失败/锁定事件具备日志或告警规则 (日志输出含 failedAttempts，可加告警)
- [ ] HTTPS / HSTS 已在入口网关 / CDN 启用
- [ ] 未暴露调试端点（/seed/dev 等仅在非生产启用）

## 5. 功能冒烟（人工或脚本）
> 参考 `TESTING.md` 与 `server/src/scripts/*` 脚本。打钩表示执行通过并截图/日志存档。
- [x] 登录 / 角色权限 (冒烟脚本登录成功, token 获取成功示例)
- [x] 入库流：草稿→审批→上架 (业务压测 45 flows 中 44 成功, 单条失败待重试逻辑优化)
- [x] 并发审批冲突：ERR_VERSION_STALE 复现 (`npm run test:approve-conflict` 输出 ok=1 stale=7)
- [ ] 出库流（若本次发布包含）
- [ ] 调整 / 移库（库存数正确 + StockMovement 记录）
- [ ] 通知生成与“全部已读”
- [x] 导出 CSV / JSON 字段一致（`npm run test:export-parity` 已由 metrics-smoke 覆盖部分导出, 仍需执行 parity test 取证）
- [ ] 日期/数值格式校验（`npm run test:export-format` / `npm run test:export-number`）
- [ ] 模板：共享模板加载/重命名/删除/回落
- [x] 幂等：重复 Idempotency-Key 返回 ERR_IDEMPOTENT_REPLAY (smoke:idempotency OK)
- [x] 错误格式统一：401/403/409/422 示例返回 {code,message} (已有集成测试)
- [x] 审计：关键操作写入 AuditLog (audits-smoke OK)

## 6. 性能基线
- [x] `npm run load:autocannon` 记录 RPS / p95（15s 20c: ~5.8k req/s, p95=5-6ms）
- [x] `npm run load:biz -- --users <n> --rounds <m>` 输出 stage 延迟（3×15 flows, draft p95=31ms approve p95=18ms putaway p95=46ms）
- [x] p95 < 目标阈值（draft<150 / approve<200 / putaway<250ms 均满足）
- [ ] CPU / RSS 在压测过程未超过配额的 80% (本地未记录，需容器/监控截图)

## 7. 观测 & 告警
- [ ] /health /live /ready /metrics /version 均 200 (本地验证通过，需生产环境二次确认)
- [ ] Prometheus 已抓取 app_requests_* 指标
- [ ] 初始告警规则部署（参考 `prometheus-alerts.example.yaml`）
- [ ] 日志集中化接入（ELK / Loki / Cloud Logging）
- [ ] 关键错误率 (5xx) 面板建立

## 8. PWA / 前端
- [ ] 首屏 bundle 分析记录（主包与 vendor-xlsx）
- [ ] SW 更新提示流程验证（版本变更后提示刷新）
- [ ] 离线缓存命中：库存/入库列表可回显
- [ ] 主题 / 视觉快速回归（暗/浅模式主要页面）

## 9. 回滚策略
- [ ] 镜像 tag（当前 & 上一稳定）记录
- [ ] 回滚步骤脚本化：`docker run ...` / helm rollback / compose
- [ ] 数据库回滚风险评审（是否有不可逆迁移：DROP / 数据变形）
- [ ] 发生回滚时的通知流程（负责人/渠道）已确认

## 10. 风险与已知限制（示例）
- [x] 未实现：高级多仓位策略 / UI 自动化 / 审批作废原因细化 (记录)
- [x] 高峰场景：StockMovement 表增长需监控 (需要后续分区/归档计划)
- [x] 延迟直方图指标暂缺（后续计划）

## 11. 审批
- [ ] 技术负责人签字
- [ ] 产品负责人签字
- [ ] 运维负责人签字

---
若需新增条目：在上方插入并记录执行证据（截图路径或日志片段）。
