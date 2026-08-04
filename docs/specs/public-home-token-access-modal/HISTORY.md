# PublicHome：未登录无令牌时隐藏 Token 面板 + 令牌访问弹窗入口 演进历史

## 变更记录（Change log）

- 2026-02-28: 创建规格，冻结范围与验收口径。
- 2026-03-02: 完成未登录无 token 隐藏面板、令牌访问弹窗入口、按钮样式统一；补充 Storybook 下首屏卡片全状态与页面级 Token 弹窗打开态预览。
- 2026-03-02: review-loop 修复兼容性问题：在不支持原生 `dialog.showModal` 的环境自动回退为内联 Token 面板，避免无入口风险。
- 2026-03-02: review-loop 修复首屏闪烁：在 profile 加载阶段先隐藏 token 面板，避免“未登录无 token”场景短暂暴露旧面板。

## Legacy Identity

- Legacy compatibility identity: `#3rb68`.
