# 秀儿直播助手 - 设计系统规范

> 本文档定义了项目中的 UI 设计规范和组件使用标准，所有开发者必须遵守。

---

## 1. 按钮使用规范 (Button)

### 1.1 Variant 使用规则

| 场景 | Variant | 颜色 | 示例 |
|------|---------|------|------|
| **主要操作** | `default` | 橙色 (bg-primary) | 连接直播中控台、一键开启、确认 |
| **次要操作** | `secondary` | 灰色 (bg-secondary) | 停止任务、断开连接、取消 |
| **危险操作** | `outline` | 透明+边框 | 删除账号、重置数据、清除缓存 |
| **幽灵按钮** | `ghost` | 透明 | 链接、返回、查看更多 |
| **链接样式** | `link` | 文字链接 | 跳转链接 |

### 1.2 按钮尺寸规范

```tsx
// 标准按钮
<Button className="h-10 px-4">标准按钮</Button>

// 小按钮
<Button size="sm" className="h-9 px-3">小按钮</Button>

// 图标按钮
<Button size="icon" className="h-10 w-10">图标</Button>
```

### 1.3 禁用状态

- 使用 `disabled` 属性
- 禁用按钮保持原有 variant，自动应用透明度

---

## 2. 任务控制按钮规范

### 2.1 统一模式

所有任务控制卡片**必须**使用以下统一模式：

```tsx
import { TaskControlButton } from '@/components/business/TaskControlButton'

// 使用示例
<TaskControlButton
  isRunning={isRunning}
  onStart={handleStart}
  onStop={handleStop}
  gate={gate}
  startText="开始任务"
  stopText="停止任务"
/>
```

### 2.2 规则说明

- **开始任务**：使用 `GateButton`，需要检查权限
- **停止任务**：使用普通 `Button`，`variant="secondary"`
- 图标规范：开始用 `Play`，停止用 `Square`

---

## 3. 提示信息规范

### 3.1 Toast 提示

```tsx
// 成功提示
toast.success('操作成功')

// 错误提示
toast.error('操作失败')
```

**样式**：透明背景 + 边框，无彩色背景

### 3.2 Tooltip 提示

```tsx
<Tooltip>
  <TooltipTrigger>...</TooltipTrigger>
  <TooltipContent>
    <p>提示内容</p>
  </TooltipContent>
</Tooltip>
```

**样式**：透明背景 + 边框，无彩色背景

### 3.3 Alert 提示

```tsx
<Alert variant="default">
  <AlertTitle>标题</AlertTitle>
  <AlertDescription>描述</AlertDescription>
</Alert>
```

**样式**：使用卡片背景，无彩色背景

---

## 4. 状态指示器规范

### 4.1 运行状态

```tsx
// 运行中
<div className="h-3 w-3 rounded-full border-2 border-green-500 animate-pulse" />

// 已停止
<div className="h-3 w-3 rounded-full border-2 border-gray-500" />
```

**规则**：使用边框样式，不使用背景色

### 4.2 连接状态

```tsx
// 已连接
<div className="h-3 w-3 rounded-full border-2 border-green-500 animate-pulse" />

// 未连接
<div className="h-3 w-3 rounded-full border-2 border-gray-500" />
```

---

## 5. 卡片布局规范

### 5.1 标准卡片

```tsx
<Card>
  <CardHeader className="px-6 py-4">
    <CardTitle>标题</CardTitle>
  </CardHeader>
  <CardContent className="p-6">
    内容
  </CardContent>
</Card>
```

### 5.2 任务控制卡片

```tsx
<Card>
  <CardHeader className="px-6 py-4">
    <div className="flex items-center justify-between">
      <CardTitle className="flex items-center gap-2">
        <Icon className="h-5 w-5" />
        任务控制
      </CardTitle>
      <TaskControlButton ... />
    </div>
  </CardHeader>
  <CardContent className="p-6">
    内容
  </CardContent>
</Card>
```

---

## 6. 颜色使用规范

### 6.1 禁止直接使用的颜色

❌ **禁止**在组件中直接使用以下 Tailwind 类：

```
bg-green-100, bg-green-50, bg-blue-100, bg-blue-50
bg-yellow-100, bg-yellow-50, bg-red-100, bg-red-50
bg-orange-100, bg-orange-50
```

### 6.2 推荐使用的颜色

✅ **必须**使用以下方式：

```
bg-background      - 背景色
bg-card            - 卡片背景
bg-muted           - 次要背景
bg-primary         - 主色调（仅按钮）
bg-secondary       - 次色调（仅按钮）
border-border      - 边框色
border-primary     - 主色边框
text-foreground    - 主要文字
text-muted-foreground - 次要文字
```

---

## 7. 图标使用规范

### 7.1 图标库

- 主要使用 `lucide-react`
- 尺寸规范：`h-4 w-4` (小), `h-5 w-5` (中), `h-6 w-6` (大)

### 7.2 常用图标对应

| 功能 | 图标 | 导入 |
|------|------|------|
| 开始/播放 | Play | `lucide-react` |
| 停止 | Square | `lucide-react` |
| 设置 | Settings | `lucide-react` |
| 删除 | Trash2 | `lucide-react` |
| 连接 | Monitor | `lucide-react` |
| 刷新 | RotateCw | `lucide-react` |

---

## 8. 表单组件规范

### 8.1 输入框

```tsx
<Input 
  className="h-10" 
  placeholder="提示文字" 
/>
```

### 8.2 开关

```tsx
<Switch 
  checked={checked} 
  onCheckedChange={onChange} 
/>
```

### 8.3 选择器

```tsx
<Select value={value} onValueChange={onChange}>
  <SelectTrigger className="h-10">
    <SelectValue placeholder="请选择" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="option1">选项1</SelectItem>
  </SelectContent>
</Select>
```

---

## 9. 开发检查清单

在提交代码前，请检查：

- [ ] 按钮 variant 是否符合规范
- [ ] 是否使用了 TaskControlButton 组件
- [ ] 提示信息是否有彩色背景
- [ ] 状态指示器是否使用边框样式
- [ ] 是否使用了设计令牌中的颜色
- [ ] 不同页面的相同功能是否样式一致

---

## 10. 违规处理

如发现代码不符合本规范：

1. **立即修复** - 在当前 PR 中修复
2. **记录问题** - 在代码审查中记录
3. **更新文档** - 如有遗漏，更新本文档

---

**最后更新**：2026-02-09
**维护者**：开发团队
