# 02 Architecture

## Theme model
- ThemeMode: `system | light | dark`
- ResolvedTheme: `light | dark`
- Storage key: `mytrader:ui:theme-mode`
- Legacy key migration: `theme` -> `mytrader:ui:theme-mode`

## DOM contract
- `document.documentElement.dataset.theme = resolvedTheme`
- `document.documentElement.classList.toggle("dark", resolvedTheme === "dark")`

## Styling contract
- 颜色仅通过语义 token 消费：`--mt-*`
- 图表颜色走 `--mt-chart-*`
- 状态语义走 `--mt-tone-*` / `--mt-state-*`

## Compatibility choices
- 保留 Tailwind `dark` class 兼容既有页面
- 去除 `prefers-color-scheme` CSS 分支，避免运行时冲突
- 启动脚本提前设置主题，减少闪烁

## Risks
- Dashboard 文件体量大，局部改造需避免行为回归
- 既有字符串 class 较多，可能存在遗漏的硬编码色值
- SVG 图表变量颜色在不同平台需验证
