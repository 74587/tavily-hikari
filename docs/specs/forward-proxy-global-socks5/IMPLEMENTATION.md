# Forward Proxy 全局 SOCKS5 收敛 实现状态

## 状态

- Status: 已完成（快车道）
- Created: 2026-03-17
- Last: 2026-03-17

## 里程碑（Milestones / Delivery checklist）

- [x] M1: 扩展 forward proxy settings 存储、API 类型与 SSE phase contract
- [x] M2: 落地 relay/Xray 收口层，让非直连 endpoint 支持“节点代理 -> 全局 SOCKS5”
- [x] M3: 完成启用前校验、优雅切换、subscription/probe/trace 收敛与后端测试
- [x] M4: 完成 admin 配置卡片、草稿交互、锁定逻辑、Storybook 与前端测试
- [x] M5: 完成 README、验证、PR、checks 与 review-loop 收敛
