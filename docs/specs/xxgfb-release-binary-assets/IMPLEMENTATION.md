# Implementation：Release 裸机二进制资产分发（#xxgfb）

## 当前实现

- `build.rs` 在 `web/dist` 存在时复制静态资源到 `OUT_DIR`，生成 `embedded_web_assets.rs`，并通过 `include_bytes!` 内嵌每个资源。
- `src/web_assets.rs` 暴露内嵌资源查询入口。
- SPA 服务路径改为统一从外部静态目录优先读取，找不到时回落到内嵌资源；`/assets/*`、`/favicon.svg`、`/linuxdo-logo.svg`、`/version.json` 与 HTML 页面共享这套读取逻辑。
- release workflow 新增 `binary-native` matrix，在 `ubuntu-24.04` 与 `ubuntu-24.04-arm` 上构建 Web、构建 release binary、打包 `tar.gz`、生成 `.sha256` 并 smoke 解包后的 binary。
- GitHub Release job 下载 binary artifacts 后用 `gh release upload --clobber` 上传资产，同时 PR release comment 列出 binary 资产名称。
- CI workflow 增加 embedded asset contract coverage，避免无外部静态目录的 binary 路径回归。

## 验证

- `cargo test --locked --all-features console_route_serves_spa_when_user_oauth_is_disabled -- --test-threads=1`
- `cargo test --locked --all-features console_deep_link_route_serves_spa_when_user_oauth_is_disabled -- --test-threads=1`
- `cargo test --locked --all-features embedded_public_assets_are_served_without_static_dir -- --test-threads=1`
- `cargo test --locked --all-features embedded_admin_page_is_served_when_dev_open_admin_is_enabled -- --test-threads=1`

## 后续状态

- 等待 full local validation、PR checks 与 review-loop 收敛。
