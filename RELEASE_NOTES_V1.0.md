# TASI-live-Supertool V1.0

## 版本

**V1.0**（对应 Git tag `v1.0`）

## 关键变更

- **UI 结构分离**：Header / Main 区域拆分，布局更清晰
- **主题变量**：统一使用 `theme.css` 设计令牌，便于定制主题
- **Header 阴影层级**：调整头部阴影与层级，视觉层次更明确
- **云鉴权**：登录/注册对接远程 auth-api（默认 `http://121.41.179.197:8000`），支持 POST /register、POST /login（返回 `.token`）
- **订阅状态**：桌面端登录后可查询订阅状态（GET /subscription/status，Bearer 鉴权），用于禁用/到期校验
- **管理员后台**：auth-api 提供 /admin/login 与 /admin/users/* 接口，可配合 Appsmith/Datasette 做用户可视化管理

## 已知限制

- 鉴权基准地址可在构建时通过 `VITE_AUTH_API_BASE_URL` 覆盖；若未覆盖则使用默认云地址
- 订阅/支付与阿里云深度集成将于后续版本补齐

## 下载

- **Windows x64**
  - Installer：`TASI-live-Supertool_V1.0_win-x64.exe`（NSIS 安装包）
  - Portable：`TASI-live-Supertool_V1.0_win-x64.zip`（绿色解压即用）

请从 [GitHub Releases](https://github.com/Xiuer-Chinese/Tasi-live-tool/releases/tag/v1.0) 或 [Gitee Releases](https://gitee.com/Xiuer/tasi-live-supertool/releases/tag/v1.0) 下载。
