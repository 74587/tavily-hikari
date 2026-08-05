# Admin 未关联 Token 用量列表替换旧排行榜 演进历史

## 变更记录（Change log）

- 2026-03-27: 创建快车道 spec，冻结“用未关联 token 用量列表替换旧排行榜”的路径、接口、页面与验收范围。
- 2026-03-28: 后端新增 `/api/tokens/unbound-usage` 与 token 维度批量日志聚合，过滤 `owner == null` 后支持搜索、排序、分页与成功率/最近使用排序。
- 2026-03-28: 前端将 `/admin/tokens/leaderboard` 替换为未关联 token 用量页，复用用户用量列表的桌面表格、移动卡片、分页、排序与 token detail 导航。
- 2026-03-28: Storybook 补齐 desktop/mobile/empty/error 与交互覆盖，并在共享用量表列宽、表头文案与状态徽标修正后重新落盘用户用量桌面图、未关联 token 桌面图与移动图，等待主人确认后进入 push/PR 收口。
- 2026-03-28: review-loop 补齐 token detail 返回未关联 token 用量页的上下文保留，确保从 `/admin/tokens/leaderboard` 进入详情后可带着搜索、排序与分页返回原列表。
- 2026-03-28: review-loop 继续修复全局 refresh 未刷新未关联 token 列表、`Last Used` 升序对 never-used token 的排序方向，以及英文 admin 页 stacked timestamp 本地化日期回归，并据此重拍最新 Storybook 证据图等待主人重新确认。
- 2026-03-29: 根据主人验收继续收紧 390px 窄视口的 admin shell / panel 横向留白，补齐未关联 token 移动卡片的身份头部布局与分页器移动端两行结构，并同步更新最终移动端证据图。
- 2026-06-09: 根据主人验收继续压缩用户用量与未关联 token 用量页头部，移除返回按钮、将搜索放到标题行最右侧，并为窄视口补齐标题下方整行搜索的最终 Storybook 证据图。

## Legacy Identity

- Legacy compatibility identity: `#jh5hs`.
