import type { ChangeEvent } from "react";

import type { UniversePoolBucketId } from "@mytrader/shared";

import type { OtherViewProps } from "../../OtherView";

export function OtherDataManagementSourceSection(props: OtherViewProps) {
  return (
    <>
      <div className="rounded-md border border-slate-200 dark:border-border-dark bg-white dark:bg-gradient-to-b dark:from-panel-dark dark:to-surface-dark overflow-hidden">
        <div className="divide-y divide-slate-200/70 dark:divide-border-dark/70">
          <div className="grid grid-cols-3 divide-x divide-slate-200/70 dark:divide-border-dark/70">
            <div className="px-3 py-2">
              <div className="text-[10px] text-slate-500 dark:text-slate-400">
                行情日期
              </div>
              <div className="mt-0.5 font-mono text-sm text-slate-900 dark:text-white">
                {props.snapshot?.priceAsOf ?? "--"}
              </div>
            </div>
            <div className="px-3 py-2">
              <div className="text-[10px] text-slate-500 dark:text-slate-400">
                最近一次拉取
              </div>
              <div className="mt-0.5 font-mono text-sm text-slate-900 dark:text-white">
                {props.latestMarketIngestRun
                  ? props.formatDateTime(props.latestMarketIngestRun.startedAt)
                  : "--"}
              </div>
            </div>
            <div className="px-3 py-2">
              <div className="text-[10px] text-slate-500 dark:text-slate-400">
                拉取状态
              </div>
              {props.latestMarketIngestRun ? (
                <div className="mt-0.5 flex items-center gap-2">
                  <span
                    className={`font-mono text-sm ${props.formatIngestRunTone(
                      props.latestMarketIngestRun.status
                    )}`}
                  >
                    {props.formatIngestRunStatusLabel(props.latestMarketIngestRun.status)}
                  </span>
                  {!props.latestMarketIngestRun.finishedAt && (
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      进行中
                    </span>
                  )}
                </div>
              ) : (
                <div className="mt-0.5 font-mono text-sm text-slate-900 dark:text-white">
                  --
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 divide-x divide-slate-200/70 dark:divide-border-dark/70">
            <div className="px-3 py-2">
              <div className="text-[10px] text-slate-500 dark:text-slate-400">
                令牌来源
              </div>
              <div className="mt-0.5 font-mono text-sm text-slate-900 dark:text-white">
                {props.marketTokenStatus
                  ? props.formatMarketTokenSource(props.marketTokenStatus.source)
                  : "--"}
              </div>
            </div>
            <div className="px-3 py-2">
              <div className="text-[10px] text-slate-500 dark:text-slate-400">
                令牌已配置
              </div>
              <div className="mt-0.5 font-mono text-sm text-slate-900 dark:text-white">
                {props.marketTokenStatus?.configured === undefined ||
                props.marketTokenStatus?.configured === null
                  ? "--"
                  : props.marketTokenStatus.configured
                    ? "是"
                    : "否"}
              </div>
            </div>
            <div className="px-3 py-2">
              <div className="text-[10px] text-slate-500 dark:text-slate-400">
                临时标的
              </div>
              <div className="mt-0.5 font-mono text-sm text-slate-900 dark:text-white">
                {props.marketTempTargets.length}
              </div>
            </div>
          </div>
        </div>
      </div>

      <section className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-bold text-slate-900 dark:text-white">
            数据来源
          </h3>
        </div>

        <div className="rounded-md border border-slate-200 dark:border-border-dark bg-white dark:bg-gradient-to-b dark:from-panel-dark dark:to-surface-dark p-2 space-y-2">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2 items-center">
            <div className="flex flex-wrap items-center gap-2">
              <props.PopoverSelect
                value={props.marketTokenProvider}
                onChangeValue={props.setMarketTokenProvider}
                options={[{ value: "tushare", label: "Tushare" }]}
                className="w-[180px]"
              />
              <span className="ml-3 text-[11px] text-slate-500 dark:text-slate-400">
                当前提供商：{props.marketTokenProvider === "tushare" ? "Tushare" : "--"}
              </span>
            </div>
            <div className="flex items-center justify-end gap-2">
              <props.Button
                variant="secondary"
                size="sm"
                icon="open_in_new"
                onClick={props.handleOpenMarketProvider}
                className="min-w-[110px]"
              >
                访问
              </props.Button>
              <props.Button
                variant="primary"
                size="sm"
                icon="save"
                onClick={props.handleSaveMarketToken}
                disabled={props.marketTokenSaving}
                className="min-w-[110px]"
              >
                保存
              </props.Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2 items-center">
            <div className="relative">
              <props.Input
                type="password"
                value={props.marketTokenDraft}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  props.setMarketTokenDraft(event.target.value)
                }
                placeholder="输入数据源令牌"
                className="font-mono text-xs pr-8"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 z-10">
                <props.HelpHint
                  text={
                    "需要接口权限：\n股票列表（stock_basic）\n基金/ETF 列表（fund_basic）\n交易日历（trade_cal）\n日线行情（daily）\n每日指标（daily_basic）\n资金流（moneyflow）"
                  }
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2">
              <props.Button
                variant="secondary"
                size="sm"
                icon="delete"
                onClick={props.handleClearMarketToken}
                disabled={props.marketTokenSaving}
                className="min-w-[110px]"
              >
                清除
              </props.Button>
              <props.Button
                variant="secondary"
                size="sm"
                icon="check_circle"
                onClick={props.handleTestMarketToken}
                disabled={props.marketTokenTesting}
                className="min-w-[110px]"
              >
                测试连接
              </props.Button>
            </div>
          </div>

          <div className="rounded-md border border-slate-200 dark:border-border-dark bg-slate-50/55 dark:bg-background-dark/35 p-2.5 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2 text-[11px]">
                <span className="font-semibold text-slate-700 dark:text-slate-200">
                  全量池配置
                </span>
                <span
                  className={`inline-flex items-center rounded-full border px-2 py-0.5 ${
                    props.marketUniversePoolDirty
                      ? "border-amber-300 text-amber-700 dark:text-amber-300"
                      : "border-emerald-300 text-emerald-700 dark:text-emerald-300"
                  }`}
                >
                  {props.marketUniversePoolDirty ? "未保存" : "已保存"}
                </span>
              </div>
              <props.Button
                variant="primary"
                size="sm"
                icon="save"
                onClick={props.handleSaveUniversePoolConfig}
                disabled={
                  props.marketUniversePoolSaving ||
                  props.marketUniversePoolLoading ||
                  !props.marketUniversePoolConfig ||
                  !props.marketUniversePoolDirty
                }
                className="min-w-[138px]"
              >
                保存全量池配置
              </props.Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              {props.UNIVERSE_POOL_BUCKET_ORDER.map((bucket: UniversePoolBucketId) => {
                const enabled = props.marketUniverseEnabledBuckets.has(bucket);
                const status = props.marketUniverseBucketStatusById.get(bucket);
                return (
                  <button
                    key={`universe-pool-${bucket}`}
                    type="button"
                    onClick={() => props.handleToggleUniversePoolBucket(bucket)}
                    disabled={props.marketUniversePoolSaving || props.marketUniversePoolLoading}
                    className={`rounded-md border px-2.5 py-2 text-left transition-colors ${
                      enabled
                        ? "border-primary/40 bg-primary/12"
                        : "border-slate-200/80 dark:border-border-dark/70 bg-white/70 dark:bg-background-dark/55"
                    } ${
                      props.marketUniversePoolSaving || props.marketUniversePoolLoading
                        ? "opacity-70 cursor-not-allowed"
                        : "hover:bg-slate-100/80 dark:hover:bg-background-dark/75"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                        {props.getUniversePoolBucketLabel(bucket)}
                      </span>
                      <span
                        className={`inline-flex h-5 min-w-[58px] items-center justify-center rounded-full border px-2 text-[11px] ${
                          enabled
                            ? "border-emerald-300 text-emerald-700 dark:text-emerald-300"
                            : "border-slate-300 text-slate-500 dark:border-border-dark dark:text-slate-400"
                        }`}
                      >
                        {enabled ? "纳入同步" : "已停更"}
                      </span>
                    </div>
                    <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                      最后更新：{status?.lastAsOfTradeDate ? props.formatCnDate(status.lastAsOfTradeDate) : "--"}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
