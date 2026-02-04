# 05 Pitfalls (do not repeat)

## Do-not-repeat summary (keep current)
- 不要把任何 Token/密钥写入仓库、SQLite、或明文输出到日志/错误信息中（只允许 env + `safeStorage` 加密存储）。
- 不要把账号业务信息写入 `market-cache.sqlite`（例如持仓数量、现金余额、交易记录）。
- 不要在 DB transaction 内调用外部 HTTP（Tushare）；拉取与入库必须分离。
- 不要让手动拉取与 auto-ingest 并发写同一个 market-cache（必须有 mutex/串行化）。
- 不要把“新鲜度”直接用自然日计算；接入交易日历后避免周末/节假日误判。
- 不要默认开启“全量拉取”；必须有 Targets 配置与按需回补策略，且 UI 能预览当前拉取范围。
- 不要在来源（Tushare/CSV）冲突时默默覆盖；必须保留 `source` 并有明确策略，必要时在 UI 可见（未来接入多 provider 时尤其重要）。

## Pitfall log (append-only)
- 2026-02-01: 启动后后台定时拉取导致进程崩溃/告警 `UnhandledPromiseRejectionWarning: Missing Tushare token.`
  - Symptom: 未配置 token 时，启动或定时触发 ingest 会出现未处理的 Promise rejection，进程可能退出或出现警告。
  - Root cause: `marketIngestScheduler` 在 `setTimeout` 中使用 `void triggerMarketIngest("startup")` 未 `.catch()`；同时 `runTargetsDailyIngest/runUniverseDailyIngest` 在缺失 token 时会 `throw`。
  - Fix: `marketIngestScheduler` 对 startup 调用显式 `.catch()`，并在 `startup/schedule` 场景下缺失 token 时直接 skip（warn 一次）避免触发 runner。
  - Prevention: 所有后台/定时任务触发的 async 必须有 `.catch()`；缺失配置（token）在非手动场景下应“可观测地跳过”，而不是抛错中断进程。
