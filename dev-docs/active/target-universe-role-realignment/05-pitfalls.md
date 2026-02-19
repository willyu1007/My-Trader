# 05 Pitfalls

- 2026-02-19 DuckDB wasm 持久化重开不可写
  - Symptom: `analysis.duckdb` 首轮写入后，下一次打开出现 `Failed to commit: File is not opened in write mode`，部分版本还会报文件损坏。
  - Root cause: `@duckdb/duckdb-wasm` 在当前 Node worker 文件持久化路径下不稳定（重开写入/恢复 WAL 存在系统性问题）。
  - Tried: 调整 wasm 版本（1.26~1.33 dev）、切换 `accessMode`、尝试 checkpoint 与 WAL 处理、替换 web-worker 适配，均未稳定解决。
  - Fix/workaround: 切换到 `@duckdb/node-api` 并保留现有仓储接口，彻底消除重开写入阻断。
  - Prevention: 后续禁止在主链路回归 `duckdb-wasm` 持久化；新增 Node API reopen smoke 作为回归检查。

- 2026-02-19 `metal_spot` 未覆盖 SGE 国际板
  - Symptom: `metal_spot` only 场景下 `spot_sge_contract_meta` 数量不足，`iAu99.99` 未入池。
  - Root cause: 金属匹配规则仅覆盖 `au/ag`，未包含 `iAu/iAg`。
  - Tried: 对比 mock 合约与 bucket 命中结果，确认 `matchUniversePoolBuckets` 漏判。
  - Fix/workaround: 补充 `\biau\d*`、`\biag\d*` 规则。
  - Prevention: 新增 spot 样例时必须覆盖主板与国际板两类代码。

- 2026-02-19 调度去重误伤 startup run
  - Symptom: schedule 与 startup 连续入队时，startup run 被跳过，导致无 `source=startup` 运行记录。
  - Root cause: Orchestrator 去重粒度仅按 `scope`，不同来源任务被错误合并。
  - Tried: 复现并检查 queue/hasScopeInFlight 逻辑，确认跳过发生在入队阶段。
  - Fix/workaround: 去重键改为 `scope+mode+source`。
  - Prevention: 新增调度回归场景必须同时覆盖 manual/schedule/startup 三来源。
