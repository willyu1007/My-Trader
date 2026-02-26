# 05 Pitfalls

## Do-not-repeat summary
- 不要把 `FTS5` 升级直接转成 native sqlite 绑定迁移；Electron/Node ABI 会放大风险。
- `sql.js` npm 包不包含完整源码与 Makefile，无法在包目录直接改 CFLAGS 重编译。

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
