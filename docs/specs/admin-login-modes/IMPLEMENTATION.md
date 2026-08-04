# 管理员登录：ForwardAuth + 内置登录可组合启用 实现状态

## Current Coverage

- ForwardAuth and built-in password authentication have independent runtime switches through
  `ADMIN_AUTH_FORWARD_ENABLED` and `ADMIN_AUTH_BUILTIN_ENABLED`.
- Built-in login uses an HttpOnly cookie session and remains available as a break-glass path;
  passkey is the preferred production administrator boundary.
- README and README.zh-CN document the compatible ForwardAuth, built-in password, and passkey
  deployment choices.

## Remaining Gaps

- None for this compatibility topic. Further production authentication work belongs to the
  `admin-passkey-login` topic.
