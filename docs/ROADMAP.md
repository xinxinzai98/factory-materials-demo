# 待办与里程碑（最新）

> 工作流：每轮从本页挑选 1-3 个条目→实现与测试→更新本页与 ARCHITECTURE/TESTING→中文提交信息推送。

## 已完成（阶段性）
- [x] 单据流转列表/详情（入/出库 DRAFT→APPROVED→PUTAWAY/PICKED + 取消）
- [x] 迁移切换（关闭 synchronize，使用 migrations）
- [x] 一键启动脚本与测试文档
- [x] UI 与主题美化（玻璃风、浅色修复、动态标题、渐入动画）
- [x] 仪表盘简化（去除图表与装饰性 SVG，保留核心指标与列表，浅色模式细节微调）
- [x] 未使用组件清理（移除 DashboardCharts 及相关引用）
- [x] 鉴权（API Key + JWT，可 REQUIRE_JWT 强制 JWT）
- [x] RBAC（ADMIN/OP/VIEWER）与路由保护
- [x] 自动种子（首次无用户时创建 admin/op/viewer），封面登录流
- [x] 新建入/出库专用页面与仪表盘/列表入口统一
- [x] A：列表筛选/搜索与导出（入/出库支持状态/日期/单号筛选，库存/入库/出库 CSV 导出）
- [x] B：供应商主数据与前端联动（新增 Supplier 实体/迁移/CRUD/种子，入库页供应商下拉联动）
- [x] C：通知中心（实体/迁移/接口；入库上架、出库过账等事件生成通知；前端展示与“全部已读”）
- [x] Dashboard 指标与预警面板（物料/库存/临期/今日单据/未读预警数；预警列表支持全部已读）
- [x] 新增“分析/报表”页面：支持日/周趋势切换、低库存 TopN 卡片
- [x] 分析页筛选：日期范围、物料编码（精确）、仓库与关键字（低库存）
- [x] 报表导出：趋势（daily/weekly）与低库存 CSV 按筛选导出
- [x] E：新建入/出库表单增强（行内校验、草稿保存/继续、批次建议与 FEFO 提示）
- [x] F：阈值与预警（全局最低库存、临期天数、滞销天数 slowDays；手动重算；通知联动）
- [x] G：导入导出增强（按筛选导出、订单级/明细级 CSV、物料导入模板与反馈）
- [x] G2：Excel 导出增强（库存页字段勾选；入/出库列表/明细提供 CSV→XLSX 快捷导出）
- [x] 导出增强 2：入/出库“自定义 Excel/明细”均基于 JSON 导出，支持字段勾选、列顺序与自定义列头；模板本地持久化（localStorage）
- [x] 预警体验：通知项可点击跳转相关详情（入/出库完成→单据详情；库存/临期/滞销→库存页并预填物料/批次）
- [x] 图标按需与摇树（仅按需引入 @ant-design/icons 图标）
- [x] PWA 基础与更新提示（离线横幅 + 新 SW “有更新，点击刷新”）
- [x] PWA 运行时缓存策略细化（按接口类别拆分：参考数据 CacheFirst、列表/指标 SWR、通知 NetworkFirst）
- [x] 列表“自定义 Excel”支持列顺序/自定义列头与模板（与明细对齐）
- [x] 导出模板 UX 打磨：模板重命名/预览，作用域命名规范（inbound/outbound 的 list/detail）
- [x] 代码体积优化（第一步）：xlsx 按需动态导入，所有导出调用 async 化修复
- [x] 导出字段命名对齐与自动化校验脚本（CSV 与 JSON 对齐：export-parity）

## 本轮实施（进行中）
- 已选任务（本轮 Pick ≤3）
  - [ ] 文档补充：TESTING 增加“自定义导出模板”流程；ARCHITECTURE 补充 PWA 缓存策略说明（已初版，继续完善）
  - [x] 导出字段集统一（命名对齐）：修复入/出库明细别名大小写导致字段缺失，新增一致性测试
  - [x] 代码体积优化（第二步-部分）：为 xlsx 单独分包 vendor-xlsx，改进缓存命中
  - [x] 导出体验与一致性小步：
    - 入/出库自定义 Excel：打开弹窗即预热 xlsx，导出文件名追加时间戳
    - 服务端 CSV 日期统一为 ISO8601（inbounds/outbounds/items/notifications）
    - 新增 export-format 脚本校验 CSV createdAt 为 ISO 风格
    - smoke:metrics 脚本增加 /health 等待，降低假失败
  - [x] 导出格式与可解析性测试：新增 export-number（数值解析）与 export-format（日期 ISO）
  - [x] Analytics 导出统一文件名：后端 metrics*.csv 支持 filename 参数；前端按时间戳命名 trends/weekly/low-stocks/compare CSV
  - [x] 库存变动流水：新增 StockMovement 实体/迁移；在入库上架、即时入库、出库拣货、即时出库、调整、移库路径记录流水；提供 /api/movements(.csv) 与 /api/movements/summary(.csv)
  - [x] 前端“库存变动”页面：筛选（日期/仓库/物料/来源类型）、流水表格、CSV 导出、日汇总简图
  - [x] 汇总能力增强：/api/movements/summary(.csv) 支持 period=day|week|month 与 groupBy=warehouse|material；前端新增筛选与导出参数
  - [x] PWA 运行时缓存包含 /api/movements 列表与汇总（SWR 策略）
  - [x] Analytics 快捷导出（入/出库/明细）统一时间戳文件名，并通过 filename 参数透传
  - [x] 共享导出模板接入前端：入/出库“自定义 Excel/明细”弹窗支持共享模板的加载/保存/重命名/删除与合并到本地（ADMIN/OP 可写）
  - [x] 共享模板预设脚本：新增 `seed:export-templates`，一键写入“标准列表/标准明细”等示例方案（四个作用域）
  - [x] Movements 折线图交互增强：支持 In/Out/Net 线显隐开关与鼠标悬停提示

- 验收要点
  - 文档更新到位（测试步骤可复现）
  - 相同导出在 CSV 与 JSON 间字段一致、顺序一致
  - 分包后首屏与导出路径的体积下降，功能不回退

## 短期可选项（候选池）
- [ ] 导出字段集统一：对齐 CSV 与 JSON 字段命名/顺序/含义（若未被本轮 Pick 完成）
- [ ] 代码体积优化：手动 vendor 拆包与更多动态导入（React/AntD/Dayjs 等）
- [ ] Movements 进一步分析图表：按周/月与按仓库/物料的对比柱状/堆叠图（基于已提供的 period/groupBy）
- [ ] 服务端导出模板预设（内置默认方案）与共享维护脚本（批量导入示例模板）
- [ ] 通知/离线体验优化（批量操作、缓存时效 UI 提示）
 - [ ] 文档加固：
   - ARCHITECTURE/TESTING 增加“CSV/JSON 字段映射与格式约定”章节（日期/数值）
   - 明确各导出端到端示例与常见导入目标（Excel/BI）的兼容建议
  - [ ] 将“自定义导出模板”操作流程加入 TESTING 详细步骤（已在代码实现，待补文档）

## 中期
- [ ] 校验与错误码规范（字段校验、业务冲突、异常码表）
- [ ] 并发控制（乐观锁/幂等键，避免重复入/出库）
- [ ] E2E/UI 自动化（Playwright）+ 单元测试（Jest）
- [ ] 审批流/撤销、作废原因/操作审计
- [ ] 多仓位库位策略（上架/拣货策略 FEFO 可配置）

## 长期
- [ ] 数据全链路审计与报表（操作日志、库存变化、按单/按物料统计）