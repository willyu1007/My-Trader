# 01 Plan

## Phase 1: Theme runtime unification
- 新增主题运行时模块：模式读取、旧键迁移、系统主题监听、DOM 同步
- 启动时在 `main.tsx` 初始化主题
- `index.html` 仅做最小首屏主题注入，移除 `body` 固定 `dark` class

## Phase 2: Token architecture
- `theme.css` 改为 `:root[data-theme="light"]` / `:root[data-theme="dark"]`
- 新增图表与状态语义 token
- `styles.css` 移除 `prefers-color-scheme` 媒体查询，改为 data-theme 选择器

## Phase 3: Primitive convergence
- 优先改造 Dashboard 原语组件（Input/Select/PopoverSelect/Button/IconButton/Badge/Modal/FormGroup）
- App 登录区改为使用统一语义样式类

## Phase 4: Scheduler panel polish
- 精修“调度高级设置”区域视觉层级，保持交互不变

## Phase 5: Chart/status semanticization
- 图表硬编码颜色改为 `--mt-chart-*`
- 状态色统一到 `--mt-state-*` / `--mt-tone-*`

## Phase 6: Regression guardrails
- 增加 `verify:theme` 脚本，约束颜色字面量、`prefers-color-scheme` 和原语段 `dark:` 回流

## Acceptance
- typecheck/build/verify:theme 全通过
- 手工验证 `system/light/dark` 切换与主要页面可读性
