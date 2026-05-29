# 访问令牌批量操作与筛选改造实现记录

## Backend

- `AdminTokenListFilters` 将分组、无分组、关键词、绑定关系、令牌启停状态和 quota state 拆成显式筛选输入。
- SQLite 层先执行可 SQL 化的筛选，再分页；`quota_state` 需要先补 runtime quota 信息，因此在 proxy 层对筛选后的全集补 quota 后再分页。
- 批量启停和批量删除都先计算仍存在且未删除的 token ID，再返回 `updated` 和 `missing`。
- 批量删除沿用单条删除的软删除语义：`enabled = 0` 且写入 `deleted_at`。

## Frontend

- token 列表 URL 承载筛选条件，便于刷新和详情页返回时保留上下文。
- 筛选条件变化默认清空 `selectedTokenIds`；分页变化保留选择集合，实现跨页勾选。
- 桌面表格增加 checkbox 列，移动卡片增加独立选择行。
- 悬浮批量面板只在存在选择时显示，提供激活、冻结、删除和清空操作。
- 批量激活和冻结成功后保留选择状态；删除确认后仅移除已删除 ID。
- 批量删除使用独立确认弹窗，确认后移除已删除 ID 并刷新列表。

## Testing

- Rust handler 测试覆盖 owner/q/group/no-group/enabled 筛选，以及批量激活、批量删除和 missing ID 返回。
- Storybook token 页面静态画面展示筛选栏、冻结状态、已选行和批量面板。
