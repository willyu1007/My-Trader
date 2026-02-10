import type { UniversePoolBucketId } from "@mytrader/shared";

import type { OtherViewProps } from "../../OtherView";

export function OtherDataManagementUniversePoolPanel(props: OtherViewProps) {
  return (
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
  );
}
