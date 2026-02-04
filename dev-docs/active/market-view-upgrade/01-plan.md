# 01 Plan

## Milestones
### Milestone 1：双栏布局 + 导航自动折叠 + Targets 弹层
- Acceptance
  - 进入 Market 自动折叠为 icon-only（恢复策略明确）
  - 左侧 Explorer 与右侧 Detail 的布局与滚动行为稳定
  - Targets 入口迁移到弹层，不影响主布局

### Milestone 2：报价/涨跌展示（列表与 header）
- Acceptance
  - 左侧列表与右侧 header 能展示 latest close + change/pct（无数据降级）
  - 至少支持 watchlist 与 holdings 的批量报价

### Milestone 3：集合（板块/主题）模式
- Acceptance
  - 左侧可选择集合（tag/group），右侧显示成分股表
  - 支持按涨跌排序；点击成分跳转单标的详情
  - 集合详情提供“整体涨跌/整体走势”（v1 以派生计算实现，口径明确标注为市值加权）

### Milestone 4：时间轴与区间加载
- Acceptance
  - 时间范围 pills（hover 浮出）可切换并驱动数据加载
  - 区间缺数据时有明确提示/回补入口（与 `real-data-auto-fetch` 的回补能力对齐）

## Implementation outline
1. 前端：Market 视图组件化（Explorer / Detail / TargetsModal）
2. 前端：导航折叠策略（enter/exit 记忆与恢复）
3. 后端：批量报价 IPC（latest + prev）与缓存策略
4. 后端：日线区间查询 IPC（分页/limit + 统一 DTO）
5. 前端：集合模式（tag/group -> symbols -> quotes table + 集合整体涨跌/走势）
6. 前端：时间轴交互（hover 浮出、键盘可达、range 切换）
