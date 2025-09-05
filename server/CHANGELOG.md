# Changelog

## [Unreleased]
_尚无变更_

## 0.1.1 - 2025-09-05
- 性能与并发：引入悲观锁 + If-Match 乐观版本（ERR_VERSION_STALE）。
- 观测性：新增 /metrics, 结构化日志，/live alias。
- 错误统一：全局 AppError + 标准错误码 (ERR_VALIDATION, ERR_NOT_FOUND, ERR_CONFLICT, ERR_DUPLICATE, ERR_VERSION_STALE, ERR_UNAUTHORIZED, ERR_FORBIDDEN, ERR_API_KEY, 等)。
- 安全：统一 401/403 返回；账号锁定策略、Helmet、简易限流。
- 幂等：Idempotency-Key 处理中间件 + 集成测试。
- 审计：登录、入库(草稿/审批/上架/即时)、出库(审批/拣选)、调整、取消、模板变更、用户注册。
- 文档：生产 README 扩展并发/错误码/指标说明；.env.example 强化安全默认。
- 测试：核心入库流、幂等、错误格式、FEFO 单元测试。

## 0.1.0
- 初始版本：基础物料/仓库/供应商/库存/入出库、调整、通知等核心功能。