# LinuxDo 登录复用既有 Token + 强制重登录 + 历史误建自愈 演进历史

## 变更记录

- 2026-03-04: 初始化规格，冻结“强制重登录 + 自愈重绑 + 误建 token 保留可用”口径。
- 2026-03-04: 已完成后端/前端实现与本地验证（fmt + clippy + test + web build）；等待快车道收敛。
- 2026-03-04: PR #89 已创建并通过 CI/Label Gate，合并状态 clean。
- 2026-03-05: 修复 LinuxDo OAuth 登录启动重定向：`/auth/linuxdo` 使用 `303 See Other`，避免浏览器保留 POST body 导致上游 `authorize` GET-only 返回 405，并消除表单字段出站风险。

## Legacy Identity

- Legacy compatibility identity: `#vr67d`.
