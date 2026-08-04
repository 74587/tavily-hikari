# LinuxDo 登录入口与自动填充 Token 演进历史

## 变更记录（Change log）

- 2026-02-26: 初版规格建立，冻结接口/数据模型/验收口径。
- 2026-02-26: 完成后端 OAuth2/用户会话与首页①②交互实现，补齐测试与 README 更新。
- 2026-02-26: 安全加固回补：OAuth state 绑定浏览器上下文、优化回调错误码语义、并修复并发登录场景的绑定 cookie 清理行为。
- 2026-02-27: 补充首页验收截图（未登录按钮、已登录自动填充、后端静态模式按钮图标可见）。

## Legacy Identity

- Legacy compatibility identity: `#rg5ju`.
