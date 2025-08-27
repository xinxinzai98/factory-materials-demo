# 测试说明

本文覆盖新增功能的详细步骤与历史功能的快速检查。

## 前置
- 后端默认端口 8080，前端 5173。
- 鉴权：使用 X-API-Key，默认 dev-api-key；如已登录也会带 Bearer Token。
- 快速准备：可先调用 POST /api/seed/dev 创建 WH1 仓库与 M001 物料。

## 一键启动
- 运行脚本：`scripts/start-dev.sh`
- 自动执行迁移、启动后端与前端，并打开浏览器。

---

## 新增功能详测

### 1. 入库单列表/详情/流转
1) 打开“入库单”菜单（/inbounds），应显示列表为空或历史数据。
2) 新建草稿：调用接口（可用 Postman）
   - POST /api/inbounds/draft
   - Body 示例：
     {
       "code": "INB-0001",
       "sourceType": "PURCHASE",
       "supplier": "供应商A",
       "arriveDate": "2025-08-25",
       "items": [
         {"materialCode":"M001","qty":10,"batchNo":"B001","expDate":"2026-08-01"}
       ]
     }
3) 列表页刷新，应看到 INB-0001 状态为 DRAFT，点击单号进入详情。
4) 在详情页点击“审批”，状态变更为 APPROVED。
5) 在详情页点击“上架过账”，状态变更为 PUTAWAY；此时库存应增加（WH1 对应批次）。
6) 校验库存：GET /api/stocks?materialCode=M001&warehouse=WH1。

注意：也可走“即时入库”页（/inbound-new），直接创建并过账；这条路径创建的单据默认已过账。

### 2. 出库单列表/详情/流转
1) 打开“出库单”菜单（/outbounds）。
2) 新建草稿：
   - POST /api/outbounds/draft
   - Body 示例：
     {
       "code": "OUT-0001",
       "purpose": "MO_ISSUE",
       "items": [
         {"materialCode":"M001","qty":5,"batchPolicy":"SYSTEM"}
       ]
     }
3) 列表页刷新，进入详情。
4) 点击“审批”，状态变为 APPROVED。
5) 点击“拣货过账”，状态变为 PICKED；库存相应减少（按 FEFO；若指定批次则按批次扣）。
6) 校验库存：GET /api/stocks?materialCode=M001&warehouse=WH1。

注意：即时出库（/outbound-new）会直接扣减库存，并把单据状态置为 PICKED（无需再次拣货）。

### 3. 移库
1) 确保 WH1 有 M001 库存（可用入库单 PUTAWAY 或 seed+调整）。
2) 调用 POST /api/transfers
   - Body 示例：
     {"materialCode":"M001","qty":2,"fromWarehouse":"WH1","toWarehouse":"WH1","fromBatchNo":"B001"}
3) 期望：源批次库存减少，目标维度（相同仓/批次则合并）增加。

### 4. 盘点/调整
1) 调用 POST /api/adjustments
   - Body 示例：
     {"materialCode":"M001","warehouse":"WH1","batchNo":"B001","targetQty":100,"reason":"月度盘点"}
2) 期望：该批次库存直接调整为 100，并新增一条调整记录。

---

## 历史功能快测

### A. 物料管理
- 新增物料：POST /api/materials
  {"code":"M002","name":"物料2","uom":"PCS"}
- 查询列表：GET /api/materials?page=1&pageSize=20&q=M

### B. 库存查询
- GET /api/stocks
- GET /api/stocks?materialCode=M001
- GET /api/stocks?warehouse=WH1

### C. 健康检查与种子
- GET /health 返回 {status:"ok"}
- POST /api/seed/dev 初始化 WH1/M001

### D. 认证（可选）
- 登录：POST /api/auth/login {"username":"admin","password":"admin"}（若已注册过）
- 前端会带上 JWT；若未登录则用 API Key 也能访问。

---

## 期望结果要点
- 入库：PUTAWAY 后库存增加。
- 出库：PICK 后库存减少（FEFO 与指定批次策略正确）。
- 调整：目标批次数量被强制到 targetQty，并记录调整。
- 转移：源批次减少、目标批次增加；不足时报错。

## 故障排查
- 迁移失败：检查 Postgres 可达、.env 中 DB_* 配置；或用 `POST /api/seed/dev` 先初始化基础数据。
- 鉴权失败：确认请求头包含 X-API-Key: dev-api-key；如登录请检查 Authorization: Bearer <token>。
- 前端接口 404：确认前端以 /api 作为 base（vite 已代理），后端监听 8080。

---

## 分析/报表（筛选与导出）测试
1) 打开“分析/报表”页面（/analytics）。
2) KPI 卡片应显示：物料数、库存总量、临期批次数、低库存物料数、滞销物料数、未读预警数。
3) 趋势卡片：
  - 切换“按日/按周”，应分别加载近 30 天/12 周数据。
  - 选择日期范围或输入“物料编码（精确）”，应重新加载趋势数据。
  - 点击“导出”按钮，下载 CSV，行数与图表点数一致。
4) 低库存 Top10：
  - 选择仓库下拉、输入关键字（物料编码/名称模糊），列表刷新。
  - 点击“导出”，下载 CSV，内容与当前筛选一致。

## 指标冒烟测试（可选）
在 server 目录运行冒烟测试脚本（需后端已启动在 8080）：

```bash
cd server
npm run smoke:metrics
```

期望：打印 dashboard/trends/weekly/low-stocks 的统计信息与 CSV 长度，最后输出 OK。
