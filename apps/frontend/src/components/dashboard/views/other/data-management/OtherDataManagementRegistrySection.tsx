import type { ChangeEvent } from "react";

import type { InstrumentRegistryEntry } from "@mytrader/shared";

import type { OtherViewProps } from "../../OtherView";

export function OtherDataManagementRegistrySection(props: OtherViewProps) {
  return (
    <>
      {props.marketRegistryEntryEnabled && (
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-bold text-slate-900 dark:text-white">
            注册标的
          </h3>
          <div className="flex items-center gap-2">
            <props.Button
              variant="secondary"
              size="sm"
              icon="select_all"
              onClick={props.handleToggleSelectAllRegistry}
              disabled={!props.marketRegistryResult?.items.length}
            >
              {props.marketRegistryResult &&
              props.marketRegistrySelectedSymbols.length ===
                props.marketRegistryResult.items.length
                ? "取消全选"
                : "全选"}
            </props.Button>
            <props.Button
              variant="secondary"
              size="sm"
              icon="check_circle"
              onClick={() => {
                void props.handleBatchSetRegistryAutoIngest(true);
              }}
              disabled={props.marketRegistrySelectedSymbols.length === 0}
            >
              批量启用
            </props.Button>
            <props.Button
              variant="secondary"
              size="sm"
              icon="remove_circle"
              onClick={() => {
                void props.handleBatchSetRegistryAutoIngest(false);
              }}
              disabled={props.marketRegistrySelectedSymbols.length === 0}
            >
              批量禁用
            </props.Button>
          </div>
        </div>
        <div className="rounded-md border border-slate-200 dark:border-border-dark bg-white dark:bg-gradient-to-b dark:from-panel-dark dark:to-surface-dark p-3 space-y-2">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_160px_auto] gap-2">
            <props.Input
              value={props.marketRegistryQuery}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                props.setMarketRegistryQuery(event.target.value)
              }
              placeholder="搜索 symbol / name"
              className="font-mono text-xs"
            />
            <props.PopoverSelect
              value={props.marketRegistryAutoFilter}
              onChangeValue={(value: string) =>
                props.setMarketRegistryAutoFilter(
                  value as "all" | "enabled" | "disabled"
                )
              }
              options={[
                { value: "all", label: "全部" },
                { value: "enabled", label: "仅已启用" },
                { value: "disabled", label: "仅未启用" }
              ]}
            />
            <props.Button
              variant="secondary"
              size="sm"
              icon="refresh"
              onClick={() => {
                void props.refreshMarketRegistry();
              }}
              disabled={props.marketRegistryLoading}
            >
              刷新
            </props.Button>
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {props.marketRegistryLoading
              ? "加载中..."
              : `共 ${props.marketRegistryResult?.total ?? 0} 条，当前 ${props.marketRegistryResult?.items.length ?? 0} 条`}
          </div>
          <div className="max-h-64 overflow-auto rounded-md border border-slate-200 dark:border-border-dark">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-white dark:bg-background-dark">
                <tr className="border-b border-slate-200 dark:border-border-dark text-slate-500 dark:text-slate-400">
                  <th className="px-2 py-1 text-left">选择</th>
                  <th className="px-2 py-1 text-left">代码</th>
                  <th className="px-2 py-1 text-left">名称</th>
                  <th className="px-2 py-1 text-left">自动拉取</th>
                </tr>
              </thead>
              <tbody>
                {(props.marketRegistryResult?.items ?? []).map((
                  item: InstrumentRegistryEntry
                ) => (
                  <tr
                    key={item.symbol}
                    className="border-b border-slate-200/70 dark:border-border-dark/70 last:border-b-0"
                  >
                    <td className="px-2 py-1">
                      <input
                        type="checkbox"
                        checked={props.marketRegistrySelectedSymbols.includes(
                          item.symbol
                        )}
                        onChange={() =>
                          props.handleToggleRegistrySymbol(item.symbol)
                        }
                      />
                    </td>
                    <td className="px-2 py-1 font-mono">
                      {item.symbol}
                    </td>
                    <td className="px-2 py-1">
                      {item.name ?? "--"}
                    </td>
                    <td className="px-2 py-1">
                      <label className="inline-flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={item.autoIngest}
                          onChange={(event) => {
                            void props.handleSetRegistryAutoIngest(
                              item.symbol,
                              event.target.checked
                            );
                          }}
                          disabled={props.marketRegistryUpdating}
                        />
                        <span>
                          {item.autoIngest ? "启用" : "禁用"}
                        </span>
                      </label>
                    </td>
                  </tr>
                ))}
                {!props.marketRegistryLoading &&
                  (!props.marketRegistryResult ||
                    props.marketRegistryResult.items.length === 0) && (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-2 py-4 text-center text-slate-500 dark:text-slate-400"
                      >
                        --
                      </td>
                    </tr>
                  )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
      )}
    </>
  );
}
