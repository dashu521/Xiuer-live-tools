# UI/UX 生成工具 — 提示词与验收标准

---

## 一、给 UI 工具用的 Prompt（中文）

请按以下要求生成**纯静态 UI**，不写任何业务逻辑、不修改数据结构、不接入真实 API/状态。

### 1. 整体风格

- **极简、Apple 风**：留白充足、信息层级清晰、无多余装饰。
- **浅灰背景体系**：页面底为浅灰（约 hsl(210, 22%, 91%)），Header/Sidebar/内容区用略深的浅灰或纯白区分层级，卡片用纯白或极浅灰并带轻微阴影。
- **大圆角**：卡片与主容器圆角 14px–24px，按钮 8px–12px，输入框 8px–10px。
- **细字体层级**：标题用 font-semibold / font-medium，正文用 font-normal，辅助说明用 text-sm + 较浅色（muted）；行高舒适，避免过密。
- **低饱和强调色**：主色为低饱和橙/珊瑚（如 hsl(20, 90%, 48%) 或更柔和变体），仅用于主按钮、选中态、关键链接，其余以灰阶为主。

### 2. 技术栈（必须严格匹配）

- **框架**：React 19，函数组件 + TypeScript。
- **样式**：Tailwind CSS 4（`@tailwindcss/vite`），优先用工具类；全局主题用 CSS 变量，写在 `src/styles/theme.css`，通过 `data-theme="light"` 切换。
- **组件库**：shadcn/ui（new-york 风格），使用项目已有的 Radix UI 基元；路径别名：`@/components`、`@/components/ui`、`@/lib/utils`。
- **工具函数**：使用 `cn(...)` 合并类名（来自 `@/lib/utils`，内部为 clsx + tailwind-merge）。
- **图标**：lucide-react，统一 `className="w-4 h-4"` 或 `w-5 h-5`，不引入其他图标库。

### 3. 必须输出的页面（仅静态布局 + 占位内容）

**（1）Login 页**

- 居中卡片：Logo/产品名、账号输入框、密码输入框、「登录」主按钮、可选「忘记密码」链接。
- 无表单提交逻辑，无校验，仅静态 DOM 与样式；输入框可带 placeholder。
- 背景与当前项目浅灰体系一致（如 `var(--app-bg)`）。

**（2）Main 页（主框架）**

- **顶部栏（Header）**：左侧 Logo + 产品名；右侧预留：主题切换图标、用户头像/名称区域、账号下拉占位。高度约 64px，背景 `var(--header-bg)`，底部细阴影。
- **侧边栏（Sidebar）**：固定宽度约 256px，背景 `var(--sidebar-bg)`，右侧细阴影；导航项为图标 + 文案，选中态用 `var(--sidebar-active-bg)`，hover 用 `var(--sidebar-item-hover)`；仅静态列表，不绑定路由。
- **内容区（Content）**：主区域左侧大圆角（如 24px）+ 左侧阴影，背景 `var(--content-bg)`，内边距 32px；内部仅放一句占位文案（如「内容区域」），不写业务组件逻辑。

**（3）Settings 页**

- 位于 Main 的内容区内：标题「应用设置」+ 若干设置分组卡片（如「账号」「浏览器」「更新」「其他」），每组为 Card 包裹标题 + 若干表单项占位（输入框/开关/按钮占位）；Tab 或分段控制仅做静态选中态样式，不写切换逻辑。
- 表单项仅布局与样式，无受控 value 与 onChange。

### 4. 必须包含的三种状态（静态样式）

- **Empty**：一个通用空状态组件，含图标（如 Inbox）+ 一句提示文案（如「暂无数据」）+ 可选一个次要按钮占位；用于列表/内容区无数据时的占位。
- **Loading**：一个通用加载组件，如居中 spinner 或骨架屏（卡片/列表项骨架），仅静态展示，不包含真实 loading 状态逻辑。
- **Error**：一个通用错误状态组件，含警示图标 + 错误标题 + 简短说明文案 + 可选「重试」按钮占位；样式上与 Empty 区分（如用淡红背景或描边）。

以上三种状态均以独立组件形式存在，可在各页用占位方式引用，不接真实数据。

### 5. 必须提供的可复用组件（仅外观与结构）

- **Header**：接收可选的 `title`、右侧 slot（如 ReactNode），内部固定左侧 Logo+产品名、右侧区域；仅静态布局，不写业务逻辑。
- **Sidebar**：接收 `items` 为数组（如 `{ id: string; label: string; icon?: ReactNode }[]`）和可选的 `activeId`，渲染导航列表；无路由与点击逻辑，仅高亮 activeId 对应项。
- **Card**：与现有 shadcn Card 一致，支持 CardHeader / CardContent / CardFooter，大圆角 + `var(--surface)` + `var(--shadow-card)`。
- **Table**：表头 + 表体若干行的静态表格，使用 Tailwind 表格样式或 shadcn Table 组件；可接受 `columns` 与 `rows` 的占位数据，仅展示，无排序/分页逻辑。
- **Button**：与现有 shadcn Button 一致，支持 variant（default / outline / ghost 等）、size；不绑定点击业务逻辑。
- **Modal**：基于 shadcn Dialog，标题 + 内容区 + 底部按钮占位（如「取消」「确认」）；仅静态打开样式，可不实现打开/关闭状态切换。

所有组件不包含 useState/useEffect 等业务状态与副作用，仅接收 props 渲染；若需展示“选中”“hover”等，用静态 class 或占位 props（如 `activeId`）控制样式即可。

### 6. 禁止事项

- 不写表单校验、不写 API 调用、不写路由跳转逻辑、不写全局状态（Redux/Zustand）。
- 不新增或修改数据结构（如不增加接口类型、不修改现有 store 形状）。
- 不写真实事件处理逻辑（如 onClick 仅可为空函数或未连接）。
- 颜色与间距一律使用 theme.css 中的 CSS 变量或 Tailwind 与变量映射好的类，禁止在组件内写死 hex/rgb。

---

## 二、产物验收标准（可复制给 UI 工具）

以下标准用于验收“UI/UX 生成工具”产出的静态 UI，满足即为通过。

### A. 技术栈与工程

- [ ] **框架**：所有页面与组件为 React 函数组件 + TypeScript，无 class 组件。
- [ ] **样式**：仅使用 Tailwind 工具类或项目内 `src/styles/theme.css` 的 CSS 变量（如 `var(--app-bg)`、`var(--header-bg)`、`var(--content-bg)`、`var(--surface)`、`var(--shadow-card)` 等），无内联 hex/rgb 颜色。
- [ ] **组件库**：使用的 UI 基元来自现有 `src/components/ui`（如 Button、Card、Dialog、Input、Label、Tabs 等），或新写的组件与现有风格一致（大圆角、浅灰背景、低饱和主色）。
- [ ] **工具**：类名合并使用 `cn()`（来自 `@/lib/utils`）；图标仅使用 `lucide-react`。
- [ ] **路径**：组件引用使用 `@/components`、`@/lib/utils` 等别名，与现有项目一致。

### B. 风格一致性

- [ ] **极简 Apple 风**：布局简洁、留白充足、无多余装饰元素。
- [ ] **浅灰背景**：页面底、Header、Sidebar、内容区、卡片层级清晰，且为浅灰/白体系（与 theme.css 日间主题一致）。
- [ ] **大圆角**：主内容区左侧圆角 ≥20px，卡片圆角 ≥14px，按钮约 8–12px。
- [ ] **字体层级**：标题、正文、辅助文案字号与字重区分明显；辅助文案使用 muted 色。
- [ ] **低饱和强调色**：主按钮与选中态使用项目主色（如橙色系），其余以灰阶为主。

### C. 页面完整性（仅静态）

- [ ] **Login 页**：含居中卡片、Logo/产品名、账号与密码输入框、「登录」主按钮、可选「忘记密码」链接；无提交与校验逻辑。
- [ ] **Main 页**：含顶部栏（Header）、侧边栏（Sidebar）、内容区（Content）；Header 含左侧 Logo+产品名与右侧占位区；Sidebar 含导航项列表与选中态样式；Content 含大圆角与占位文案。
- [ ] **Settings 页**：位于 Main 内容区内，含「应用设置」标题与多个设置分组卡片，每组有标题与表单项占位（输入框/开关/按钮）；无真实表单逻辑。

### D. 三种状态组件（静态）

- [ ] **Empty**：独立组件，含图标 + 提示文案 + 可选次要按钮；仅展示用，无数据绑定。
- [ ] **Loading**：独立组件，为居中 spinner 或骨架屏；仅展示用，无真实 loading 状态。
- [ ] **Error**：独立组件，含警示图标 + 标题 + 说明 + 可选「重试」按钮；仅展示用，与 Empty 视觉区分明显。

### E. 可复用组件

- [ ] **Header**：可配置标题与右侧区域，左侧 Logo+产品名固定；仅布局与样式。
- [ ] **Sidebar**：可配置导航项数组与当前选中 id，渲染列表与选中态；无路由与业务逻辑。
- [ ] **Card**：支持 Header/Content/Footer 区域，大圆角与项目 shadow/surface 一致。
- [ ] **Table**：支持表头与多行数据占位展示，样式统一；无排序/分页逻辑。
- [ ] **Button**：与现有 shadcn Button 用法一致，多种 variant/size；无业务点击逻辑。
- [ ] **Modal**：基于 Dialog，含标题、内容、底部按钮占位；可不实现开关逻辑，但结构完整。

### F. 禁止项（一律不出现）

- [ ] 无任何表单校验、API 调用、路由跳转、全局状态管理逻辑。
- [ ] 无新增/修改数据结构或接口类型（仅可使用占位类型或现有类型）。
- [ ] 无在组件内写死的颜色值（hex/rgb）；无引入项目未使用的图标库或 UI 库。
- [ ] 无业务逻辑型 useEffect/useState（仅允许为纯展示服务的局部 state，如 Modal 的 open 占位）。

---

验收时按 A→F 逐条检查，全部勾选即为通过。若某条不满足，需在产物中修正至满足后再交付。
