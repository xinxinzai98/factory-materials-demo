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
	- 点击预警通知可跳转：入库/出库完成类通知跳到单据详情；库存/临期/滞销预警跳到“库存”页并自动带入物料/批次查询参数。

### E. 导出增强（前端）
1) 打开前端“库存”页，任意输入筛选或留空。
2) 点击“导出 CSV”，应能下载 CSV 并用表格软件打开。
3) 点击“导出 Excel”，在弹窗勾选/取消字段后确认，下载 .xlsx。打开文件验证表头与数据列与勾选一致。
4) 从通知中心点击“库存预警/临期预警/滞销预警”，应打开库存页并看到查询条件自动填入（URL 带 materialCode/batchNo），列表随即加载。
5) 入/出库列表页：可点击“自定义 Excel”（列表）或“自定义明细”，勾选导出字段；列表使用 JSON 源数据导出以避免 CSV 精度/格式问题，明细暂以 CSV→XLSX 转换（后续可升级为列级过滤）。

### F. 导出一致性与格式测试
- 字段对齐：`npm run test:export-parity` 校验 CSV 表头与 JSON 字段命名一致。
- 日期格式：`npm run test:export-format` 校验各 CSV 的 createdAt 为 ISO 风格（包含 `T`）。
- 数值可解析性：`npm run test:export-number` 校验 stocks.csv 的数量列（qtyOnHand/qtyAllocated/qtyAvailable）皆为可解析数字。

约定：
- CSV 日期使用 ISO8601；数量列为纯数字（不带千分位）；空值用空字符串表示。
- 所有导出接口接受可选 `filename` 查询参数，以覆盖下载文件名。

### F. PWA 与离线提示
1) 构建与预览前端后，首次访问页面确保 SW 注册（浏览器 Application/Service Workers 可见）。
2) 切换浏览器离线模式或断网，页面顶部出现“离线状态”横幅；返回或刷新非 /api 页面，能够使用已缓存的静态资源继续浏览（接口请求不可用）。
3) 当发布新版本且 SW 准备就绪时，右上区域出现“有更新，点击刷新”按钮，点击后页面刷新并加载新版本。

### G. 指标 CSV 导出校验（文件名覆盖 + 表头）
1) 打开“分析/报表”页，点击趋势/周趋势/低库存/趋势对比的“导出”。
2) 期待：下载的文件名包含时间戳（如 trends-YYYYMMDD-HHmmss.csv），与实际保存一致（后端 filename 覆盖）。
3) 打开 CSV，首行表头分别为：
	- 趋势：date,inbounds,outbounds
	- 周趋势：week,inbounds,outbounds
	- 低库存：materialCode,qty
	- 趋势对比：date, in_*..., out_*...
4) 命令行可运行：`npm run test:export-metrics`（服务器需运行）以自动检查。
