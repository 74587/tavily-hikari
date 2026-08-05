# History

## Decision Trace

- 2026-06-21: 创建 follow-up spec，锁定共享 `AdminRecentRequestsPanel` request type 筛选改为桌面田字形布局，并要求小屏复用同一触发入口但收口到 `Drawer`。
- 2026-06-21: 决定移除整行 `All request types`，改成标题行右侧低强调 `Clear`，保持现有 `onClearRequestKinds()` 语义与 quick-filter 状态机不变。
- 2026-06-21: 确认小屏 `Billing` / `Protocol` 在 drawer 内继续保持按钮单选，因为当前宽度足够容纳，不需要降级为 select。
- 2026-06-21: 桌面版田字形落地后发现 API 列出现视觉缺口，最终通过修正 request-kind grid 对齐策略消除列高拉伸导致的空洞，并补齐最终桌面/移动端视觉证据。

## Key Reasons

- 这次改造的核心目标是压低共享筛选面板高度，而不是改变 request-kind 筛选语义；因此实现集中在布局重排、容器切换与样式对齐，不改 helper 或后端 contract。
- request type 面板属于共享组件面，必须一次改好所有调用方，避免 `/admin/requests`、key detail、token detail 再次分叉出不同布局。
- 移动端继续保留按钮单选可以减少状态理解成本，也能让 drawer 与桌面 quick filters 维持更接近的视觉与交互层级。

## References

- `./SPEC.md`
- `./IMPLEMENTATION.md`

## 变更记录（Change log）

- 2026-06-21: 初始化 follow-up spec，冻结共享 request type 面板的桌面田字形布局、小屏 drawer 收口与 stable Storybook evidence 合同。
- 2026-06-21: 共享 `AdminRecentRequestsPanel` request type 筛选已按合同落地；桌面端改为田字形布局，小屏 Drawer 保持按钮单选，Storybook/build 验证通过并补齐最终视觉证据。

## Legacy Identity

- Legacy compatibility identity: `#kq2rt`.
