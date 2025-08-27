# 测试说明（整合）

- 端口：后端 8080，前端 5173。
- 认证：`X-API-Key: dev-api-key` 或登录 JWT。
- 种子：`POST /api/seed/dev` 初始化 WH1 与 M001。

## 入库
- 列表：GET /api/inbounds
- 草稿：POST /api/inbounds/draft
- 审批：POST /api/inbounds/:code/approve
- 上架过账：POST /api/inbounds/:code/putaway
- 取消：POST /api/inbounds/:code/cancel
- 即时入库：POST /api/inbounds

## 出库
- 列表：GET /api/outbounds
- 草稿：POST /api/outbounds/draft
- 审批：POST /api/outbounds/:code/approve
- 拣货过账：POST /api/outbounds/:code/pick
- 取消：POST /api/outbounds/:code/cancel
- 即时出库：POST /api/outbounds

## 库存/移库/调整
- 库存：GET /api/stocks?materialCode=&warehouse=&batchNo=
- 移库：POST /api/transfers
- 调整：POST /api/adjustments

### 仓库/库位联动冒烟
1) 获取仓库：GET /api/warehouses 期望至少包含 WH1。
2) 获取库位：GET /api/locations?warehouse=WH1 期望返回 A1/A2/B1 等示例库位。
3) 前端 Transfer 页：选择来源仓库后，目标库位下拉应按所选目标仓库加载；填写 toLocation=现有库位时，移库成功后该批次的新库存行带有对应库位。

## 认证
- 注册：POST /api/auth/register
- 登录：POST /api/auth/login
- 当前用户：GET /api/auth/me

---

## 新增功能详测

### A. 入库/出库流转回归
1) 入库草稿 → 审批 → 上架：参照接口清单，状态应依次为 DRAFT → APPROVED → PUTAWAY；库存增加。
2) 出库草稿 → 审批 → 拣货：状态 DRAFT → APPROVED → PICKED；库存按策略扣减（指定批次或 FEFO）。

### B. 导出 CSV（带筛选）
- 入库：GET /api/inbounds.csv?status=APPROVED&dateFrom=2025-08-01&dateTo=2025-08-31
- 出库：GET /api/outbounds.csv?status=PICKED
- 库存：GET /api/stocks.csv?materialCode=M001&warehouse=WH1
期待：下载 UTF-8 BOM CSV，数据与筛选一致。

### C. 物料模板与导入
1) 下载模板：GET /api/materials/template.csv
2) 准备 CSV 文本（包含表头 code,name,uom,isBatch,shelfLifeDays）。
3) 导入：POST /api/materials/import-csv  Body: {"csv":"<整段CSV文本>"}
4) 期待：返回 created 列表；已存在 code 会跳过。

### D. 阈值与临期预警
1) 设置阈值：PUT /api/settings/thresholds {"globalMinQty":5,"expiryDays":30}
2) 手动重算：POST /api/alerts/recalc
3) 触发库存变化（入库/出库/调整/移库），系统会自动重算。
4) 期待：
	- 低库存生成“库存预警”通知；
	- 到期 N 天内的批次生成“临期预警”通知；
	- 通知中心可查看与“全部已读”。
