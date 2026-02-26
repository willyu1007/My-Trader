# 05 Pitfalls

## Do-not-repeat summary
- 不要把 `FTS5` 升级直接转成 native sqlite 绑定迁移；Electron/Node ABI 会放大风险。
- `sql.js` npm 包不包含完整源码与 Makefile，无法在包目录直接改 CFLAGS 重编译。
- 观点作用对象不可只按“个股”建模，必须保持“所有可估值标的”的开放集合语义。
- 作用冲突必须先收敛到 symbol 再合并，避免行业/概念层优先级直接裁决。
- 时间轴必须执行“区间外无影响”，防止长期残留偏移污染估值。
- 前端 JSON 编辑器直接 `JSON.parse` 后不能裸传给强类型接口，需做 `assetScope/graph` 结构归一化。

## Entries
### Pitfall 1: 尝试使用 docker 路径编译 sql.js（失败）
- Symptom:
  - `docker run` 报错：无法连接 Docker daemon (`Cannot connect to the Docker daemon...`)。
- Root cause:
  - 当前机器虽然安装了 docker CLI，但 daemon 不可用。
- What was tried:
  - 直接按官方建议使用容器化编译。
- Fix/workaround:
  - 改为本机安装 `emsdk`，在 host 环境编译 sql.js。
- Prevention:
  - 先检查 daemon 可用性，再决定容器编译还是 host 编译。

### Pitfall 2: 尝试切换到 better-sqlite3（回退）
- Symptom:
  - 出现 Node/Electron ABI 与类型语义不兼容风险，且会触发 `SqliteDatabase` 类型与调用面大范围连锁改动。
- Root cause:
  - 现有工程围绕 `sql.js` API 形成了大量隐式契约，native 绑定需要额外适配层。
- What was tried:
  - 接入 `better-sqlite3` 并尝试保持原 API。
- Fix/workaround:
  - 回退 native 迁移，改为“保留 sql.js API + 替换 FTS5 wasm”。
- Prevention:
  - 对“运行时替换但 API 不同”的方案先做契约面扫描，避免中途大回退。

### Pitfall 3: 仅按 symbol 处理跨市场冲突（风险提示）
- Symptom:
  - 同 symbol 异市场数据可能在 catalog 更新中互相覆盖，导致作用对象映射失真。
- Root cause:
  - 当前主键策略仍是 symbol，缺少 instrument_id 维度隔离。
- What was tried:
  - 评估改 instrument_id 全链路迁移，成本过高不适合本期。
- Fix/workaround:
  - 本期采用“同 provider+market+symbol 可覆盖；跨市场同 symbol 阻断并显式报错”。
- Prevention:
  - 在后续 instrument_id 迁移任务前，所有 symbol upsert 路径保持冲突守卫一致。

### Pitfall 4: 估值方法 JSON 输入与共享类型不一致（已修复）
- Symptom:
  - `pnpm typecheck` 报错：`domains: string[]` 不能赋给 `DataDomainId[]`，以及 `graph: unknown[]` 不能赋给 `ValuationMetricNode[]`。
- Root cause:
  - `OtherValuationMethodsTab` 中直接把 `JSON.parse` 结果传给 IPC 输入，缺少结构化归一化步骤。
- What was tried:
  - 先用类型断言硬转，仍触发严格类型报错且存在运行时风险。
- Fix/workaround:
  - 增加 `parseAssetScope` 归一化函数，将字符串数组转换为 `ValuationMethodAssetScope`。
  - 对 `graph` 增加数组校验后再作为 `ValuationMetricNode[]` 传递。
- Prevention:
  - 所有可编辑 JSON 输入在提交前都必须做 schema-aware normalize，不依赖裸断言。

### Pitfall 5: FTS5 MATCH 查询中的连字符导致语法歧义
- Symptom:
  - `verify-insights-e2e` 在删除后 FTS 断言阶段报错：`no such column: out`。
- Root cause:
  - 使用了 `fan-out` 作为 MATCH 关键词，`-` 被 FTS 查询解析器视为操作符而非普通字符。
- What was tried:
  - 直接按自然语言标题片段构造 MATCH 查询。
- Fix/workaround:
  - 改为稳定关键词（`scope`）进行断言，避免符号歧义。
- Prevention:
  - FTS MATCH 验证用例优先使用无操作符歧义的 token；如需短语检索需显式转义/引用。
