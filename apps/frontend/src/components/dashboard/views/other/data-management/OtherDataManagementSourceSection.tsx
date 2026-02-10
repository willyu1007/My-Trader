import { createElement } from "react";

import {
  OtherDataManagementTokenProviderPanel,
  type OtherDataManagementTokenProviderPanelProps
} from "./OtherDataManagementTokenProviderPanel";
import {
  OtherDataManagementUniversePoolPanel,
  type OtherDataManagementUniversePoolPanelProps
} from "./OtherDataManagementUniversePoolPanel";

import type { OtherViewProps } from "../../OtherView";

export type OtherDataManagementSourceSectionProps = Pick<
  OtherViewProps,
  | "formatDateTime"
  | "formatIngestRunStatusLabel"
  | "formatIngestRunTone"
  | "formatMarketTokenSource"
  | "latestMarketIngestRun"
  | "marketTempTargets"
  | "marketTokenStatus"
  | "snapshot"
> &
  OtherDataManagementTokenProviderPanelProps &
  OtherDataManagementUniversePoolPanelProps;

export function OtherDataManagementSourceSection(
  props: OtherDataManagementSourceSectionProps
) {
  const tokenProviderPanelProps = {
    Button: props.Button,
    HelpHint: props.HelpHint,
    Input: props.Input,
    PopoverSelect: props.PopoverSelect,
    handleClearMarketToken: props.handleClearMarketToken,
    handleOpenMarketProvider: props.handleOpenMarketProvider,
    handleSaveMarketToken: props.handleSaveMarketToken,
    handleTestMarketToken: props.handleTestMarketToken,
    marketTokenDraft: props.marketTokenDraft,
    marketTokenProvider: props.marketTokenProvider,
    marketTokenSaving: props.marketTokenSaving,
    marketTokenTesting: props.marketTokenTesting,
    setMarketTokenDraft: props.setMarketTokenDraft,
    setMarketTokenProvider: props.setMarketTokenProvider
  } satisfies OtherDataManagementTokenProviderPanelProps;
  const universePoolPanelProps = {
    Button: props.Button,
    UNIVERSE_POOL_BUCKET_ORDER: props.UNIVERSE_POOL_BUCKET_ORDER,
    formatCnDate: props.formatCnDate,
    getUniversePoolBucketLabel: props.getUniversePoolBucketLabel,
    handleSaveUniversePoolConfig: props.handleSaveUniversePoolConfig,
    handleToggleUniversePoolBucket: props.handleToggleUniversePoolBucket,
    marketUniverseBucketStatusById: props.marketUniverseBucketStatusById,
    marketUniverseEnabledBuckets: props.marketUniverseEnabledBuckets,
    marketUniversePoolConfig: props.marketUniversePoolConfig,
    marketUniversePoolDirty: props.marketUniversePoolDirty,
    marketUniversePoolLoading: props.marketUniversePoolLoading,
    marketUniversePoolSaving: props.marketUniversePoolSaving
  } satisfies OtherDataManagementUniversePoolPanelProps;

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
          {createElement(OtherDataManagementTokenProviderPanel, tokenProviderPanelProps)}
          {createElement(OtherDataManagementUniversePoolPanel, universePoolPanelProps)}
        </div>
      </section>
    </>
  );
}
