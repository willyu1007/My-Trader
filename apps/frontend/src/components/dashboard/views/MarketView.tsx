import { createElement } from "react";

import type { PortfolioSnapshot } from "@mytrader/shared";
import type {
  MarketChartRangeKey,
  MarketFilterMarket,
  MarketScope,
  TargetPoolStatsScope,
  TargetPoolStructureStats
} from "../types";
import {
  MarketDetailWorkspace,
  type MarketDetailWorkspaceProps
} from "./market/MarketDetailWorkspace";
import { MarketDialogs, type MarketDialogsProps } from "./market/MarketDialogs";
import { MarketSidebar, type MarketSidebarProps } from "./market/MarketSidebar";

type DashboardMarketState = ReturnType<
  typeof import("../hooks/use-dashboard-market").useDashboardMarket<
    MarketScope,
    MarketFilterMarket,
    MarketChartRangeKey,
    TargetPoolStatsScope,
    TargetPoolStructureStats
  >
>;
type DashboardMarketAdminDerived = ReturnType<
  typeof import("../hooks/use-dashboard-market-admin-derived").useDashboardMarketAdminDerived<TargetPoolStatsScope>
>;
type DashboardMarketDerived = ReturnType<
  typeof import("../hooks/use-dashboard-market-derived").useDashboardMarketDerived
>;
type DashboardMarketOrchestration = ReturnType<
  typeof import("../hooks/use-dashboard-market-orchestration").useDashboardMarketOrchestration
>;
type DashboardMarketResizeResult = ReturnType<
  typeof import("../hooks/use-dashboard-market-resize").useDashboardMarketResize
>;

interface MarketViewExternalProps {
  Button: typeof import("../shared").Button;
  ChartErrorBoundary: typeof import("../shared").ChartErrorBoundary;
  FormGroup: typeof import("../shared").FormGroup;
  IconButton: typeof import("../shared").IconButton;
  Input: typeof import("../shared").Input;
  MarketAreaChart: typeof import("../shared").MarketAreaChart;
  MarketQuoteHeader: typeof import("../shared").MarketQuoteHeader;
  MarketVolumeMiniChart: typeof import("../shared").MarketVolumeMiniChart;
  Modal: typeof import("../shared").Modal;
  PopoverSelect: typeof import("../shared").PopoverSelect;
  formatCnDate: typeof import("../shared").formatCnDate;
  formatCnWanYiNullable: typeof import("../shared").formatCnWanYiNullable;
  formatNumber: typeof import("../shared").formatNumber;
  formatSignedCnWanYiNullable: typeof import("../shared").formatSignedCnWanYiNullable;
  formatSignedPctNullable: typeof import("../shared").formatSignedPctNullable;
  formatThemeLabel: typeof import("../shared").formatThemeLabel;
  getCnChangeTone: typeof import("../shared").getCnChangeTone;
  getCnToneTextClass: typeof import("../shared").getCnToneTextClass;
  marketChartRanges: ReadonlyArray<MarketRangeOption>;
  snapshot: PortfolioSnapshot | null;
  sortTagMembersByChangePct: typeof import("../shared").sortTagMembersByChangePct;
}

export type MarketViewProps = DashboardMarketState &
  DashboardMarketAdminDerived &
  DashboardMarketDerived &
  DashboardMarketOrchestration &
  Pick<
    DashboardMarketResizeResult,
    | "handleMarketExplorerResizePointerDown"
    | "handleMarketExplorerResizeKeyDown"
  > &
  MarketViewExternalProps;

export interface MarketTagFacetItem {
  tag: string;
  level: string;
  name: string;
}

export interface MarketRangeOption {
  key: MarketChartRangeKey;
  label: string;
}

export interface MarketChartHoverDatum {
  date: string;
  close: number;
}

export function MarketView(props: MarketViewProps) {
  const {
    handleMarketExplorerResizeKeyDown,
    handleMarketExplorerResizePointerDown
  } = props;
  const sidebarProps = {
    Button: props.Button,
    IconButton: props.IconButton,
    Input: props.Input,
    PopoverSelect: props.PopoverSelect,
    formatNumber: props.formatNumber,
    formatSignedPctNullable: props.formatSignedPctNullable,
    getCnChangeTone: props.getCnChangeTone,
    getCnToneTextClass: props.getCnToneTextClass,
    handleRemoveWatchlistItem: props.handleRemoveWatchlistItem,
    handleSelectInstrument: props.handleSelectInstrument,
    handleSelectTag: props.handleSelectTag,
    handleSyncInstrumentCatalog: props.handleSyncInstrumentCatalog,
    marketCatalogSyncSummary: props.marketCatalogSyncSummary,
    marketCatalogSyncing: props.marketCatalogSyncing,
    marketCollectionSelectValue: props.marketCollectionSelectValue,
    marketEffectiveScope: props.marketEffectiveScope,
    marketExplorerWidth: props.marketExplorerWidth,
    marketFilteredListSymbols: props.marketFilteredListSymbols,
    marketFiltersActiveCount: props.marketFiltersActiveCount,
    marketHoldingsSymbols: props.marketHoldingsSymbols,
    marketHoldingsSymbolsFiltered: props.marketHoldingsSymbolsFiltered,
    marketNameBySymbol: props.marketNameBySymbol,
    marketQuotesBySymbol: props.marketQuotesBySymbol,
    marketQuotesLoading: props.marketQuotesLoading,
    marketSearchLoading: props.marketSearchLoading,
    marketSearchQuery: props.marketSearchQuery,
    marketSearchResults: props.marketSearchResults,
    marketSearchResultsFiltered: props.marketSearchResultsFiltered,
    marketSelectedSymbol: props.marketSelectedSymbol,
    marketSelectedTag: props.marketSelectedTag,
    marketSelectedTagAggregate: props.marketSelectedTagAggregate,
    marketTagMembersLoading: props.marketTagMembersLoading,
    marketTags: props.marketTags,
    marketWatchlistLoading: props.marketWatchlistLoading,
    setMarketFiltersOpen: props.setMarketFiltersOpen,
    setMarketScope: props.setMarketScope,
    setMarketSearchQuery: props.setMarketSearchQuery,
    setMarketSelectedSymbol: props.setMarketSelectedSymbol,
    setMarketSelectedTag: props.setMarketSelectedTag,
    snapshot: props.snapshot
  } satisfies MarketSidebarProps;
  const detailProps = {
    Button: props.Button,
    ChartErrorBoundary: props.ChartErrorBoundary,
    IconButton: props.IconButton,
    MarketAreaChart: props.MarketAreaChart,
    MarketQuoteHeader: props.MarketQuoteHeader,
    MarketVolumeMiniChart: props.MarketVolumeMiniChart,
    formatCnDate: props.formatCnDate,
    formatCnWanYiNullable: props.formatCnWanYiNullable,
    formatNumber: props.formatNumber,
    formatSignedCnWanYiNullable: props.formatSignedCnWanYiNullable,
    formatSignedPctNullable: props.formatSignedPctNullable,
    getCnChangeTone: props.getCnChangeTone,
    getCnToneTextClass: props.getCnToneTextClass,
    handleAddSelectedToWatchlist: props.handleAddSelectedToWatchlist,
    handleSelectInstrument: props.handleSelectInstrument,
    marketActiveMoneyflowRatio: props.marketActiveMoneyflowRatio,
    marketActiveMoneyflowVol: props.marketActiveMoneyflowVol,
    marketActiveVolume: props.marketActiveVolume,
    marketChartBars: props.marketChartBars,
    marketChartHasEnoughData: props.marketChartHasEnoughData,
    marketChartHoverDate: props.marketChartHoverDate,
    marketChartHoverPrice: props.marketChartHoverPrice,
    marketChartLoading: props.marketChartLoading,
    marketChartRange: props.marketChartRange,
    marketChartRanges: props.marketChartRanges,
    marketEffectiveScope: props.marketEffectiveScope,
    marketHoldingUnitCost: props.marketHoldingUnitCost,
    marketLatestBar: props.marketLatestBar,
    marketQuotesBySymbol: props.marketQuotesBySymbol,
    marketRangeSummary: props.marketRangeSummary,
    marketSelectedProfile: props.marketSelectedProfile,
    marketSelectedQuote: props.marketSelectedQuote,
    marketSelectedSymbol: props.marketSelectedSymbol,
    marketSelectedTag: props.marketSelectedTag,
    marketSelectedTagAggregate: props.marketSelectedTagAggregate,
    marketSelectedTagSeriesReturnPct: props.marketSelectedTagSeriesReturnPct,
    marketSelectedTagSeriesTone: props.marketSelectedTagSeriesTone,
    marketTagChartHoverDate: props.marketTagChartHoverDate,
    marketTagChartHoverPrice: props.marketTagChartHoverPrice,
    marketTagMembers: props.marketTagMembers,
    marketTagMembersLoading: props.marketTagMembersLoading,
    marketTagSeriesBars: props.marketTagSeriesBars,
    marketTagSeriesError: props.marketTagSeriesError,
    marketTagSeriesLatestCoverageLabel: props.marketTagSeriesLatestCoverageLabel,
    marketTagSeriesLoading: props.marketTagSeriesLoading,
    marketTagSeriesResult: props.marketTagSeriesResult,
    marketTargetPrice: props.marketTargetPrice,
    marketVolumeMode: props.marketVolumeMode,
    setMarketChartHoverDate: props.setMarketChartHoverDate,
    setMarketChartHoverPrice: props.setMarketChartHoverPrice,
    setMarketChartRange: props.setMarketChartRange,
    setMarketInstrumentDetailsOpen: props.setMarketInstrumentDetailsOpen,
    setMarketSelectedSymbol: props.setMarketSelectedSymbol,
    setMarketTagChartHoverDate: props.setMarketTagChartHoverDate,
    setMarketTagChartHoverPrice: props.setMarketTagChartHoverPrice,
    setMarketTagMembersModalOpen: props.setMarketTagMembersModalOpen,
    setMarketTagPickerOpen: props.setMarketTagPickerOpen,
    setMarketVolumeMode: props.setMarketVolumeMode,
    sortTagMembersByChangePct: props.sortTagMembersByChangePct
  } satisfies MarketDetailWorkspaceProps;
  const dialogProps = {
    Button: props.Button,
    FormGroup: props.FormGroup,
    Input: props.Input,
    Modal: props.Modal,
    PopoverSelect: props.PopoverSelect,
    formatCnWanYiNullable: props.formatCnWanYiNullable,
    formatNumber: props.formatNumber,
    formatSignedPctNullable: props.formatSignedPctNullable,
    formatThemeLabel: props.formatThemeLabel,
    getCnChangeTone: props.getCnChangeTone,
    getCnToneTextClass: props.getCnToneTextClass,
    handleAddManualTheme: props.handleAddManualTheme,
    handleAddSelectedToWatchlist: props.handleAddSelectedToWatchlist,
    handleAddTargetTag: props.handleAddTargetTag,
    handleAddUserTag: props.handleAddUserTag,
    handleRemoveUserTag: props.handleRemoveUserTag,
    handleSelectInstrument: props.handleSelectInstrument,
    handleSelectTag: props.handleSelectTag,
    marketFilterAssetClasses: props.marketFilterAssetClasses,
    marketFilterKinds: props.marketFilterKinds,
    marketFilterMarket: props.marketFilterMarket,
    marketFiltersActiveCount: props.marketFiltersActiveCount,
    marketFiltersOpen: props.marketFiltersOpen,
    marketInstrumentDetailsOpen: props.marketInstrumentDetailsOpen,
    marketManualThemeDraft: props.marketManualThemeDraft,
    marketManualThemeLoading: props.marketManualThemeLoading,
    marketManualThemeOptions: props.marketManualThemeOptions,
    marketQuotesBySymbol: props.marketQuotesBySymbol,
    marketSelectedIndustry: props.marketSelectedIndustry,
    marketSelectedManualThemes: props.marketSelectedManualThemes,
    marketSelectedPlainUserTags: props.marketSelectedPlainUserTags,
    marketSelectedProfile: props.marketSelectedProfile,
    marketSelectedSymbol: props.marketSelectedSymbol,
    marketSelectedTag: props.marketSelectedTag,
    marketSelectedTagAggregate: props.marketSelectedTagAggregate,
    marketSelectedThemes: props.marketSelectedThemes,
    marketShowProviderData: props.marketShowProviderData,
    marketTagMembers: props.marketTagMembers,
    marketTagMembersLoading: props.marketTagMembersLoading,
    marketTagMembersModalOpen: props.marketTagMembersModalOpen,
    marketTagPickerOpen: props.marketTagPickerOpen,
    marketTagPickerQuery: props.marketTagPickerQuery,
    marketTags: props.marketTags,
    marketTagsLoading: props.marketTagsLoading,
    marketUserTagDraft: props.marketUserTagDraft,
    marketWatchlistGroupDraft: props.marketWatchlistGroupDraft,
    refreshMarketTags: props.refreshMarketTags,
    resetMarketFilters: props.resetMarketFilters,
    setMarketFilterAssetClasses: props.setMarketFilterAssetClasses,
    setMarketFilterKinds: props.setMarketFilterKinds,
    setMarketFilterMarket: props.setMarketFilterMarket,
    setMarketFiltersOpen: props.setMarketFiltersOpen,
    setMarketInstrumentDetailsOpen: props.setMarketInstrumentDetailsOpen,
    setMarketManualThemeDraft: props.setMarketManualThemeDraft,
    setMarketScope: props.setMarketScope,
    setMarketShowProviderData: props.setMarketShowProviderData,
    setMarketTagMembersModalOpen: props.setMarketTagMembersModalOpen,
    setMarketTagPickerOpen: props.setMarketTagPickerOpen,
    setMarketTagPickerQuery: props.setMarketTagPickerQuery,
    setMarketUserTagDraft: props.setMarketUserTagDraft,
    setMarketWatchlistGroupDraft: props.setMarketWatchlistGroupDraft,
    sortTagMembersByChangePct: props.sortTagMembersByChangePct
  } satisfies MarketDialogsProps;

  return (
    <>
      <div className="h-full min-h-0 flex">
        {createElement(MarketSidebar, sidebarProps)}

        <div
          role="separator"
          aria-orientation="vertical"
          tabIndex={0}
          onPointerDown={handleMarketExplorerResizePointerDown}
          onKeyDown={handleMarketExplorerResizeKeyDown}
          className="w-1 flex-shrink-0 cursor-col-resize bg-transparent hover:bg-primary/20 focus:bg-primary/25 focus:outline-none"
          title="拖拽调节宽度（←/→ 可微调）"
        />

        {createElement(MarketDetailWorkspace, detailProps)}
      </div>

      {createElement(MarketDialogs, dialogProps)}
    </>
  );
}
