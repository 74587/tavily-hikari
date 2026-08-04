# 管理员近期请求列表全量统一 演进历史

## Change log

- 2026-03-20: 初始化 spec，冻结“管理员近期请求列表全量统一”的数据对齐、共享组件、facet 过滤与 no-wrap 桌面表格边界。
- 2026-03-22: 共享近期请求列表、日志 facets、Storybook 证据与截图裁剪已落地；规格同步到“已实现（待审查）”，等待 PR 收敛。
- 2026-03-28: 跟进共享列表详情收敛；列表接口改为摘要负载，新增全局 / key / token 作用域详情 bodies 接口，前端展开区改为懒加载 + 缓存 + 重试，并清理冗余“请求类型详情 / 建议处理”展示。
- 2026-04-06: 跟进桌面态 `Key` / `Token` 标识链接的视觉垂直居中；共享组件补齐统一 entity-link 对齐样式，并新增专用 Storybook canvas 作为稳定验收入口。

## Legacy Identity

- Legacy compatibility identity: `#wnzdr`.
