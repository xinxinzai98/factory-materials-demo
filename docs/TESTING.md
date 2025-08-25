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

## 认证
- 注册：POST /api/auth/register
- 登录：POST /api/auth/login
- 当前用户：GET /api/auth/me
