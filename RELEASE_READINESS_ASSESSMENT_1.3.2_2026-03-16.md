# 秀儿直播助手 v1.3.2 发布就绪评估报告

- 评估日期：2026-03-16
- 评估对象：当前工作区版本 `1.3.2`
- 评估范围：Electron 桌面端、前端构建链路、发布脚本、`auth-api` 后端、文档与发布材料
- 评估结论：`未达到正式发布标准`

---

## 一、执行摘要

当前版本具备较完整的功能框架，前端单元测试全部通过，macOS 双架构安装包也能成功生成；但从“正式发布”标准看，仍存在多项阻断问题：

1. 发布门禁脚本 `npm run release:guard` 直接报出 4 个 blocker。
2. 后端测试链路未稳定，`pytest` 结果为 7 通过、6 失败。
3. 存在至少 1 个用户可见功能回归：设置页“联系支持”会失败。
4. 后端默认 CORS 配置不满足自身上线安全清单要求。
5. 文档与版本信息明显失配，无法支持对外准确发布。
6. 回归清单、兼容性矩阵、性能基线和真实 UX 验收证据均不完整。

结论上，本版本更接近“可内部测试 / 可继续修复”的候选版本，不适合直接作为面向外部用户的正式发布版本。

---

## 二、评估方法与实际执行结果

### 2.1 已执行命令

| 类别 | 命令 | 结果 |
|------|------|------|
| 前端测试 | `npm test` | 通过，8 个测试文件、86 个测试全部通过 |
| 发布审计 | `npm run release:audit` | 通过，但给出多项警告 |
| 发布阻断 | `npm run release:guard` | 失败，4 个 blocker |
| 静态质量 | `npx biome check .` | 失败，12 个 error，1 个 warning |
| Windows 构建前校验 | `npm run dist:validate` | 通过，但缺少 `VITE_AUTH_API_BASE_URL` |
| 生产构建 | `npm run build` | 未设置 API 环境变量时失败 |
| 生产构建（带环境变量） | `VITE_AUTH_API_BASE_URL=http://121.41.179.197:8000 npm run build` | 通过 |
| macOS 打包 | `VITE_AUTH_API_BASE_URL=http://121.41.179.197:8000 npm run dist:mac` | 通过，生成 x64/arm64 DMG |
| 后端语法检查 | `python3 -m py_compile auth-api/**/*.py auth-api/*.py` | 通过 |
| 后端测试 | `pytest -q` | 13 项中 7 通过、6 失败 |
| 多账号验证脚本 | `node scripts/verify-multi-account.js` | 21 通过、2 失败，91.3% |

### 2.2 实际产物

已成功生成以下 macOS 产物：

- `release/1.3.2/Xiuer-Live-Assistant_1.3.2_macos_x64.dmg`，约 96 MB
- `release/1.3.2/Xiuer-Live-Assistant_1.3.2_macos_arm64.dmg`，约 92 MB
- 对应 `blockmap` 与 `latest-mac.yml`

注意：当前产物为未签名、未公证测试构建，不等同于面向终端用户的正式 macOS 发布包。

---

## 三、分项评估

### 3.1 功能完整性检查

#### 已有正向证据

- 路由层已覆盖主要业务模块：直播中控台、自动发言、自动弹窗、自动回复、AI 聊天、数据监控、子账号、设置、帮助支持。
- 前端核心单元测试全部通过，说明以下模块至少在单元级别稳定：
  - 权限与套餐规则
  - IPC 通道约束
  - 存储隔离
  - 多账号任务隔离
  - 自动回复任务基础行为
- 多账号验证脚本确认大部分隔离设计已存在，说明“多账号独立运行”并非空实现。

#### 明确不足

- 当前唯一可信回归文档 [`docs/REGRESSION_CHECKLIST.md`](docs/REGRESSION_CHECKLIST.md) 中绝大多数发布前验收项仍为空白，无法证明：
  - 登录链路
  - 打包后验证码登录
  - 中控台连接/断开
  - 浏览器生命周期
  - 打包后全量功能
  - Windows 双击启动
- 多账号验证脚本本身仍报 2 个失败项：
  - `useAutoMessage` 持久化时未排除 `isRunning`
  - `AccountManager` 未发现预期防重入标记
- 设置页“联系支持”调用 `mailto:`，但 IPC 只允许 `http/https`，功能实际不可用。

#### 结论

功能骨架较完整，但缺少针对当前版本的端到端验收闭环。按正式发布标准，功能完整性证据不足。

### 3.2 性能测试结果分析

#### 已获得的数据

- 生产构建耗时约 11.01 秒。
- macOS 双架构打包耗时约 28.37 秒。
- 主要前端包体数据：
  - 主入口 chunk：`526.78 kB`，gzip 后 `162.55 kB`
  - Markdown vendor：`357.62 kB`，gzip 后 `109.77 kB`
  - UI vendor：`162.44 kB`，gzip 后 `50.05 kB`
- 多账号相关单元测试和验证脚本说明“逻辑并发隔离”基本成立。

#### 缺失的数据

- 没有本版本真实的应用启动时间、登录响应时间、连接中控台响应时间测量结果。
- 没有运行态 CPU / 内存 / 句柄 / 浏览器子进程占用基线。
- 没有真实并发压测数据，只有单元测试和源码结构验证。
- 回归清单中规定的性能阈值仍未填写。

#### 结论

当前只能证明“构建性能可接受、并发隔离逻辑基本存在”，不能证明“运行时性能达到发布阈值”。性能项不能判定为达标。

### 3.3 兼容性验证

#### 已验证

- 本机 macOS 上可以完成：
  - 前端生产构建
  - 主进程构建
  - preload 构建
  - macOS x64 / arm64 DMG 打包
- Windows 构建前校验脚本通过，说明图标、脚本、关键配置未发现明显硬错误。

#### 未验证

- 未执行 Windows 实机安装与运行验证。
- 未执行打包后 Windows 双击启动验证。
- 未执行浏览器版本矩阵验证。
- 未执行不同分辨率 / 多显示器 / 低配置设备验证。
- 未执行 macOS Gatekeeper 通过验证，因为当前产物未签名、未公证。

#### 结论

兼容性目前只有“配置层”和“本机 macOS 打包层”证据，远不足以支持正式发布结论。

### 3.4 安全漏洞与风险检查

#### 已确认的正向控制

- Electron 主窗口启用了：
  - `nodeIntegration: false`
  - `contextIsolation: true`
- 新窗口默认拒绝，只放行 `https:` 外链。
- preload 层对 IPC 通道做了白名单校验。
- HTML 渲染使用 DOMPurify 进行净化。

#### 明确风险

1. `auth-api` 默认 `CORS_ORIGINS="*"`，同时 `allow_credentials=True`。
   - 这与仓库自身的上线前清单直接冲突。
   - 风险等级：高。
2. 前端默认仍存在 `http://localhost:8000` fallback。
   - 若发布环境未正确注入变量，构建或运行可能指向本地地址。
   - 风险等级：高。
3. `npm audit` 未能执行。
   - 当前 npm registry 镜像不支持 audit 接口，无法得出“依赖无漏洞”结论。
   - 风险等级：中。
4. `authAPI.getTokenInternal` 仍暴露给 renderer。
   - 虽然注释标记为 internal，但实际上已挂到 `window`。
   - 风险等级：中。

#### 结论

安全方面存在明确 blocker，不能判定为可发布。

### 3.5 用户体验测试反馈

#### 已有证据

- 仓库内已有 UX 评估报告，指出若干 P0/P1 体验问题。
- 当前版本仍保留帮助支持页、用户引导组件、错误边界和通知系统等基础体验设施。

#### 当前版本新增/仍存问题

- 设置页“联系支持”按钮不可用，属于直接可见的交互失败。
- 未执行当前 dirty worktree 的真实人工 UX 回归。
- 历史 UX 报告中列出的高优问题没有可验证的“全部关闭”证据。

#### 结论

UX 只能判定为“基础可用但验收不足”，不满足正式发布前的体验签核要求。

### 3.6 文档完整性

#### 明确问题

1. `package.json` 当前版本为 `1.3.2`，但 `README.md` 顶部仍写 `v1.2.1`。
2. `CHANGELOG.md` 仅记录到 `v1.2.1`。
3. `release-notes/` 目录只有 `v1.2.1.md`。
4. `README.md` 仍引用不存在的脚本 `build-exe` 和 `dist`。
5. `docs/RELEASE_PROCESS.md` 仍大量硬编码 `1.2.1` 示例路径。

#### 结论

文档明显未与当前版本同步，不满足正式发布要求。

### 3.7 已知 bug 修复状态

#### 已知已修复并有文档记录的部分

- 手机验证码登录链路已有修复说明。
- 主进程启动、窗口显示、部分更新与鉴权流程已有多轮历史修复记录。
- 前端单元测试显示近期权限、鉴权工具和多账号隔离相关改动至少没有单元级回归。

#### 当前仍未关闭的问题

1. 发布门禁未通过。
2. `Biome` 仍有 12 个错误。
3. 后端测试中 6 项失败。
4. 多账号验证脚本中 2 项失败。
5. 设置页“联系支持”功能不可用。
6. 文档版本和命令失配。

#### 结论

“所有已知 bug 均已修复”这一条件不成立。

---

## 四、阻断发布的问题清单

| 编号 | 问题 | 影响 | 建议 |
|------|------|------|------|
| B1 | `release:guard` 失败，当前工作区不干净且 remote 不符合脚本要求 | 发布流程不能进入冻结状态 | 先冻结候选版本，清理/提交变更，并统一发布 remote 规则 |
| B2 | 构建依赖 `VITE_AUTH_API_BASE_URL`，未设置时直接失败 | 发布命令不可复现 | 在 CI/发布脚本中强制注入，并移除前端 `localhost` fallback |
| B3 | 设置页“联系支持”调用 `mailto:`，但 `openExternal` 禁止该协议 | 用户可见功能失败 | 在 IPC 中允许 `mailto:`，或为邮件跳转单独提供 handler |
| B4 | `auth-api` 默认 `CORS_ORIGINS="*"` 且 `allow_credentials=True` | 存在安全风险 | 默认值改为 fail-fast，生产环境必须显式配置白名单 |
| B5 | `pytest` 失败 6 项，测试脚本硬编码旧仓库绝对路径 | 后端测试不可复现 | 改为相对路径或临时目录，并在测试前自动建库 |
| B6 | `npx biome check .` 失败 | 代码质量门禁未通过 | 修复格式、导入顺序和 Hook 依赖等问题 |
| B7 | 文档与版本失配 | 对外发布说明不可信 | 同步 README、CHANGELOG、release-notes、RELEASE_PROCESS |
| B8 | 正式回归清单大量未执行 | 缺少发布验收证据 | 按清单完成开发态、打包后、Windows/macOS 回归 |
| B9 | macOS 产物未签名未公证 | 终端用户安装受阻 | 若面向外部正式分发，必须补齐签名与公证 |

---

## 五、建议整改方案

### P0：发布前必须完成

1. 修复 `mailto:` 支持问题。
2. 将 `auth-api` 的 CORS 默认值改为安全配置，未设置时禁止启动。
3. 修复 `auth-api/test_subscription_system.py` 的硬编码绝对路径。
4. 修复全部 Biome 错误。
5. 同步所有发布文档到 `1.3.2`。
6. 重新执行并记录：
   - `npm test`
   - `npx biome check .`
   - `pytest -q`
   - `npm run release:guard`
   - `npm run dist:mac`

### P1：发布前强烈建议完成

1. 依据 [`docs/REGRESSION_CHECKLIST.md`](docs/REGRESSION_CHECKLIST.md) 完成勾选记录。
2. 做一轮当前版本的人工 UX 验收。
3. 记录启动时间、登录响应、连接中控台耗时、单账号与多账号内存占用。
4. 完成至少一次 Windows 实机安装与启动验证。

### P2：若目标是“对外正式商用发布”

1. 配置 Apple 签名与公证。
2. 完成依赖漏洞审计，或切换到支持 `npm audit` 的 registry。
3. 收紧 renderer 可访问的 token 接口。

---

## 六、最终判定

### 当前版本是否达到发布标准

`否`

### 判定依据

- 发布阻断脚本未通过。
- 安全配置存在高风险默认值。
- 存在用户可见功能故障。
- 后端测试链路未稳定通过。
- 文档与版本信息不一致。
- 缺少完整回归、兼容性和性能验收证据。

### 可接受的发布范围

- 可作为内部测试版本：`可以`
- 可作为受控灰度版本：`需先完成 P0`
- 可作为正式对外发布版本：`当前不建议`

---

## 七、附录：关键证据

### 7.1 关键通过项

- 前端单元测试：`86/86` 通过
- 生产构建：带生产 API 环境变量后通过
- macOS 打包：x64 / arm64 DMG 成功生成

### 7.2 关键失败项

- `release:guard`：4 个 blocker
- `Biome`：12 个 error，1 个 warning
- `pytest`：7 通过，6 失败
- 多账号验证脚本：21 通过，2 失败

### 7.3 关键文件定位

- API fallback：`src/config/authApiBase.ts`
- 发布强制环境变量：`scripts/generate-build-config.js`
- 联系支持故障链路：
  - `src/pages/SettingsPage/components/OtherSetting.tsx`
  - `electron/main/ipc/app.ts`
- 后端 CORS 风险：
  - `auth-api/config.py`
  - `auth-api/main.py`
- 文档版本失配：
  - `README.md`
  - `CHANGELOG.md`
  - `docs/RELEASE_PROCESS.md`

