import type * as React from "react";
import { createElement } from "react";

import type { OtherViewProps } from "../../OtherView";
import {
  OtherDataManagementTargetPoolDiffPane,
  type OtherDataManagementTargetPoolDiffPaneProps
} from "./OtherDataManagementTargetPoolDiffPane";
import {
  OtherDataManagementTargetPoolEditorPane,
  type OtherDataManagementTargetPoolEditorPaneProps
} from "./OtherDataManagementTargetPoolEditorPane";

export type OtherDataManagementTargetPoolSectionProps = Pick<
  OtherViewProps,
  | "Button"
  | "handleResetTargetsDraft"
  | "handleSaveTargets"
  | "handleTargetsEditorResizeKeyDown"
  | "handleTargetsEditorResizePointerDown"
  | "marketTargetsDiffPreview"
  | "marketTargetsDirty"
  | "marketTargetsLoading"
  | "marketTargetsPreview"
  | "marketTargetsSaving"
  | "refreshMarketTargets"
  | "refreshMarketTargetsDiff"
  | "targetsEditorGridRef"
  | "targetsEditorLeftPct"
> &
  OtherDataManagementTargetPoolEditorPaneProps &
  OtherDataManagementTargetPoolDiffPaneProps;

export function OtherDataManagementTargetPoolSection(
  props: OtherDataManagementTargetPoolSectionProps
) {
  const editorPaneProps = {
    handleApplyManualTargetSymbols: props.handleApplyManualTargetSymbols,
    handlePreviewManualTargetSymbols: props.handlePreviewManualTargetSymbols,
    handleRemoveManualPreviewSymbol: props.handleRemoveManualPreviewSymbol,
    handleToggleTargetsSection: props.handleToggleTargetsSection,
    marketManualSymbolPreview: props.marketManualSymbolPreview,
    marketRegistryEntryEnabled: props.marketRegistryEntryEnabled,
    marketTargetsConfig: props.marketTargetsConfig,
    marketTargetsSectionOpen: props.marketTargetsSectionOpen,
    marketTargetsSymbolDraft: props.marketTargetsSymbolDraft,
    setMarketManualSymbolPreview: props.setMarketManualSymbolPreview,
    setMarketTargetsConfig: props.setMarketTargetsConfig,
    setMarketTargetsSymbolDraft: props.setMarketTargetsSymbolDraft
  } satisfies OtherDataManagementTargetPoolEditorPaneProps;
  const diffPaneProps = {
    formatTargetsReasons: props.formatTargetsReasons,
    handleToggleDiffSection: props.handleToggleDiffSection,
    marketActiveTargetPoolStats: props.marketActiveTargetPoolStats,
    marketDiffSectionOpen: props.marketDiffSectionOpen,
    marketFilteredAddedSymbols: props.marketFilteredAddedSymbols,
    marketFilteredReasonChangedSymbols: props.marketFilteredReasonChangedSymbols,
    marketFilteredRemovedSymbols: props.marketFilteredRemovedSymbols,
    marketTargetPoolMetricCards: props.marketTargetPoolMetricCards,
    marketTargetPoolStatsScope: props.marketTargetPoolStatsScope,
    marketTargetsDiffPreview: props.marketTargetsDiffPreview,
    marketTargetsPreview: props.marketTargetsPreview,
    refreshMarketTargetsDiff: props.refreshMarketTargetsDiff,
    setMarketCurrentTargetsModalOpen: props.setMarketCurrentTargetsModalOpen,
    setMarketTargetPoolDetailMetric: props.setMarketTargetPoolDetailMetric,
    setMarketTargetPoolStatsScope: props.setMarketTargetPoolStatsScope
  } satisfies OtherDataManagementTargetPoolDiffPaneProps;

  return (
    <>
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-bold text-slate-900 dark:text-white">
            目标池编辑
          </h3>
        </div>

        <div className="rounded-md border border-slate-200 dark:border-border-dark bg-white dark:bg-gradient-to-b dark:from-panel-dark dark:to-surface-dark overflow-hidden">
          <div className="border-b border-slate-200 dark:border-border-dark bg-slate-50/70 dark:bg-background-dark/45 px-3 py-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span
                  className={`inline-flex items-center rounded-full border px-2 py-0.5 ${
                    props.marketTargetsDirty
                      ? "border-amber-300 text-amber-700 dark:text-amber-300"
                      : "border-emerald-300 text-emerald-700 dark:text-emerald-300"
                  }`}
                >
                  {props.marketTargetsDirty ? "草稿未保存" : "草稿已同步"}
                </span>
                <span className="text-slate-500 dark:text-slate-400">
                  预览标的：
                  <span className="ml-1 font-mono text-slate-700 dark:text-slate-200">
                    {props.marketTargetsDiffPreview
                      ? props.marketTargetsDiffPreview.draft.symbols.length
                      : props.marketTargetsPreview
                        ? props.marketTargetsPreview.symbols.length
                        : "--"}
                  </span>
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <props.Button
                  variant="secondary"
                  size="sm"
                  icon="restart_alt"
                  onClick={props.handleResetTargetsDraft}
                  disabled={!props.marketTargetsDirty}
                >
                  重置草稿
                </props.Button>
                <props.Button
                  variant="secondary"
                  size="sm"
                  icon="refresh"
                  onClick={() => {
                    void props.refreshMarketTargets();
                    void props.refreshMarketTargetsDiff();
                  }}
                  disabled={props.marketTargetsLoading}
                >
                  刷新基线
                </props.Button>
                <props.Button
                  variant="primary"
                  size="sm"
                  icon="save"
                  onClick={props.handleSaveTargets}
                  disabled={props.marketTargetsSaving || !props.marketTargetsDirty}
                >
                  保存
                </props.Button>
              </div>
            </div>
          </div>

          <div
            ref={props.targetsEditorGridRef}
            className="grid grid-cols-1 lg:grid-cols-[minmax(0,var(--targets-left-pct))_8px_minmax(0,var(--targets-right-pct))] gap-3 p-3 items-start"
            style={
              {
                "--targets-left-pct": `${props.targetsEditorLeftPct}%`,
                "--targets-right-pct": `calc(${100 - props.targetsEditorLeftPct}% - 8px)`
              } as React.CSSProperties
            }
          >
            {createElement(OtherDataManagementTargetPoolEditorPane, editorPaneProps)}

            <div
              role="separator"
              aria-orientation="vertical"
              tabIndex={0}
              onPointerDown={props.handleTargetsEditorResizePointerDown}
              onKeyDown={props.handleTargetsEditorResizeKeyDown}
              className="hidden lg:flex w-[8px] h-full cursor-col-resize items-center justify-center rounded-[3px] hover:bg-primary/12 focus:bg-primary/16 focus:outline-none transition-colors"
              title="拖拽调节左右宽度（←/→ 可微调）"
            >
              <span className="h-full w-px bg-slate-300/95 dark:bg-border-dark pointer-events-none" />
            </div>

            {createElement(OtherDataManagementTargetPoolDiffPane, diffPaneProps)}
          </div>
        </div>
      </section>
    </>
  );
}
