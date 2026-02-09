# Roadmap: Light Theme Adaptation

## Goal
交付“单套 UI + 双主题 token + 主题运行时统一”的浅色适配方案，并通过自动校验防止后续回退为双维护。

## Milestones
1. 统一主题运行时与启动注入
2. 重构主题 token（light/dark 双分支）
3. 收敛原语样式与关键页面（登录/调度设置）
4. 图表与状态色语义化
5. 增加主题契约校验与文档

## Verification gates
- Gate A: typecheck/build 通过
- Gate B: verify-theme 通过
- Gate C: 手工切换与关键页面回归通过

## Risks and rollback
- 风险：大文件局部改造遗漏
- 回滚：可先强制 `dark` 作为 resolved mode，随后逐步恢复 light 分支
