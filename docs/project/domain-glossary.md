# Domain Glossary

## Purpose
Define domain terms used across requirements and implementation.

Terminology sync decision: sync now; this glossary is the SSOT for domain nouns used in `requirements.md`.

## Terms

### Instrument（标的）
- Definition: 可交易或可跟踪的资产对象；本项目主要包括 A 股/港股股票与 ETF（含债券 ETF、贵金属 ETF 等）。
- Synonyms: Security, Asset
- Non-examples: 宏观指标（例如利率）、板块本身（不直接交易的分类）
- Notes: Instrument 具有代码、市场、币种、交易日历等属性。

### Market（市场）
- Definition: 交易市场的抽象（例如 A 股、港股），用于区分交易日历、币种与数据口径。
- Synonyms: Region, Venue
- Non-examples: Sector/Theme（板块/主题）
- Notes: 市场不等同于交易所；同一市场可能包含多个交易所或交易板块。

### Exchange（交易所）
- Definition: 标的挂牌与交易发生的具体交易所（例如 SSE/SZSE/HKEX）。
- Synonyms: Venue
- Non-examples: Market（市场）
- Notes: 交易日历通常以交易所为粒度；应用层可映射到 Market 统一处理。

### Asset Class（资产类别）
- Definition: 用于风险与配置视角的分类（例如股票、债券、贵金属、现金等）。
- Synonyms: Asset category
- Non-examples: Sector/Theme（行业/概念属于“板块/主题”维度）
- Notes: ETF 需要可映射到资产类别（例如债券 ETF、黄金 ETF）。

### Trading Calendar（交易日历）
- Definition: 描述某市场/交易所的交易日、休市日与交易时间的规则与数据集。
- Synonyms: Trading days, Holiday calendar
- Non-examples: 价格数据本身
- Notes: 用于对齐回测频率、计算收益率与处理缺失（停牌/休市）。

### FX Rate（汇率）
- Definition: 不同币种之间的兑换比率（例如 CNY/HKD），用于跨市场估值与收益换算。
- Synonyms: Exchange rate
- Non-examples: 资产价格本身
- Notes: 需要明确频率与取值口径（例如日频收盘价）。

### Corporate Action / Adjustment（公司行为/复权）
- Definition: 分红、送股、拆并股等导致价格序列需要调整以保持可比性的事件与因子。
- Synonyms: Split/Dividend adjustment, Adjusted price
- Non-examples: 普通价格波动
- Notes: 回测与绩效分析需要明确是否使用复权数据以及复权方式。

### Issuer（发行主体）
- Definition: 标的背后的公司/发行方，用于聚合风险暴露与维护 A/H 双重上市映射。
- Synonyms: Company, Issuing entity
- Non-examples: Instrument（具体交易标的）
- Notes: 同一发行主体可能对应多个 Instrument（A 股、H 股、不同市场 ETF 等）。

### A/H Mapping（A/H 映射）
- Definition: 用于关联同一发行主体在 A 股与港股的不同交易标的的映射关系。
- Synonyms: Dual-listed mapping
- Non-examples: 将 A 股与 H 股当作同一可互换标的（价格与流动性并不等同）
- Notes: 用于研究/对照与发行主体聚合风险；交易与持仓层面仍按 Instrument 分开处理。

### Portfolio（投资组合）
- Definition: 用户用于管理与分析的一组资产配置与持仓集合，可包含多个账户或策略子组合。
- Synonyms: 组合、策略组合
- Non-examples: Watchlist（自选列表）
- Notes: Portfolio 是风险与敞口计算的主要边界。

### Account（账户）
- Definition: 组合下的一个资金与持仓容器，用于区分不同资金来源、券商账户或模拟账户。
- Synonyms: 子账户
- Non-examples: User（用户）
- Notes: MVP 可简化为“组合即账户”，后续再细分。

### Position（持仓）
- Definition: 在某一标的上的持有数量与成本等信息，用于计算市值、盈亏与暴露。
- Synonyms: 仓位
- Non-examples: Signal（信号）
- Notes: Position 通常关联到 Portfolio/Account 与 Instrument。

### Exposure（敞口/暴露）
- Definition: 组合对某个维度的风险或权重暴露，例如单一标的占比、板块占比、因子暴露。
- Synonyms: Risk exposure
- Non-examples: 单次行情涨跌（短期价格变化不是敞口本身）
- Notes: 暴露计算需要明确口径（市值权重、净敞口、杠杆等）。

### Risk Limit（风险限制）
- Definition: 用户设定的风险规则与阈值，用于约束组合或策略的最大暴露与集中度。
- Synonyms: 风控规则、阈值
- Non-examples: “建议”或“信号”
- Notes: 触发时应给出原因与计算口径。

### Watchlist（自选列表）
- Definition: 用户关注的标的集合，用于行情跟踪与机会观察。
- Synonyms: 自选
- Non-examples: Portfolio（组合持仓）
- Notes: Watchlist 不代表持有关系。

### Sector/Theme（板块/主题）
- Definition: 对标的的分类集合（行业、概念、主题等），用于板块跟踪、轮动与机会发现。
- Synonyms: 行业、主题、概念
- Non-examples: Instrument（标的本体）
- Notes: 分类体系与成分数据依赖数据源与口径。

### Universe（投资/回测范围）
- Definition: 策略、筛选或回测的标的集合边界，例如某指数成分、自选池或板块成分。
- Synonyms: 投资池、标的池
- Non-examples: Watchlist（纯关注列表）
- Notes: Universe 需要可复现：记录生成规则与数据版本。

### Factor（因子）
- Definition: 用于解释或预测资产收益/风险的特征变量（例如动量、价值、波动率等）。
- Synonyms: 特征、指标
- Non-examples: 原始价格本身（价格是输入，不等同于因子）
- Notes: 因子需要定义计算窗口、频率、缺失值处理与中性化等。

### Model（模型）
- Definition: 基于因子或规则生成评分、排序或决策的算法/流程。
- Synonyms: 策略模型、打分模型
- Non-examples: 纯展示图表（可视化不是模型）
- Notes: 需要记录版本、参数与数据依赖以支持复现。

### Signal（信号）
- Definition: 由模型/规则在特定时间产生的动作建议（例如买入/卖出/调仓/关注）。
- Synonyms: Action, Recommendation
- Non-examples: 最终交易执行（本期不做自动执行）
- Notes: 信号应与风险限制联动，避免“只给建议不解释”。

### Backtest（回测）
- Definition: 使用历史数据模拟策略在过去的表现，输出指标与曲线，并可复现。
- Synonyms: 历史模拟
- Non-examples: 未来预测（回测不等于预测）
- Notes: 需要明确：频率、复权/除权、成本/滑点、交易规则。

### Backtest Run（回测运行）
- Definition: 一次具体的回测执行记录，包含参数、数据版本、结果摘要与可视化产物。
- Synonyms: Run, Experiment
- Non-examples: 仅保存一张图但无参数（不可复现）
- Notes: Run 是对比与复盘的基本单位。

### Thesis / Viewpoint（观点/研究结论）
- Definition: 用户对某标的/板块/策略的研究记录，包含理由、证据、风险点与触发条件。
- Synonyms: Thesis, Idea
- Non-examples: 情绪化短评（可记录，但不应混淆为研究结论）
- Notes: 应支持“计划-执行-复盘”的结构化记录。

### Decision Guidance（决策引导）
- Definition: 帮助用户在操作前完成信息检查与风险校验的流程化支持（例如检查清单、提示与回链）。
- Synonyms: Checklist, Workflow
- Non-examples: 自动替用户做决定（避免暗示为投顾）
- Notes: 以信息组织与约束为主，减少认知偏差与遗漏。

## Entity list (optional)
- Entity: Instrument
  - Key fields: symbol, market, name, type(stock|etf), currency, exchangeCalendar
  - Lifecycle: create/import → update metadata → delist/retire
- Entity: Portfolio
  - Key fields: name, baseCurrency, createdAt, archivedAt
  - Lifecycle: create → maintain positions/rules → archive
- Entity: Position
  - Key fields: instrumentId, quantity, costBasis, openDate, tags
  - Lifecycle: open → adjust → close
- Entity: PriceBar
  - Key fields: instrumentId, dateTime, open, high, low, close, volume, adjusted
  - Lifecycle: ingest → validate → query → archive/prune

## Verification
- All nouns used in `requirements.md` are defined here (or explicitly marked as common language).
