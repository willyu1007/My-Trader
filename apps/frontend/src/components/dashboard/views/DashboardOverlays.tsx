import type { Dispatch, SetStateAction } from "react";

import type { LedgerEntry, ResolvedTargetSymbol } from "@mytrader/shared";

import type { TargetPoolStructureStats } from "../types";
import { Button, ConfirmDialog, Input } from "../shared";

interface TargetPoolDetailCategoryRow {
  key: string;
  label: string;
  count: number;
  ratio: number | null;
  symbols: string[];
}

export interface DashboardOverlaysProps {
  error: string | null;
  notice: string | null;
  toastMessage: string;
  formatPct: (value: number) => string;
  formatTargetsReasons: (reasons: string[]) => string;
  handleCancelDeleteLedgerEntry: () => void;
  handleConfirmDeleteLedgerEntry: () => Promise<void>;
  ledgerDeleteSummary: string;
  ledgerDeleteTarget: LedgerEntry | null;
  marketActiveTargetPoolStats: Pick<TargetPoolStructureStats, "symbolNames">;
  marketCurrentTargetsFilter: string;
  marketCurrentTargetsModalOpen: boolean;
  marketCurrentTargetsSource: ResolvedTargetSymbol[];
  marketFilteredCurrentTargets: ResolvedTargetSymbol[];
  marketTargetPoolActiveCategoryRow: TargetPoolDetailCategoryRow | null;
  marketTargetPoolDetailCategoryRows: TargetPoolDetailCategoryRow[];
  marketTargetPoolDetailDescription: string;
  marketTargetPoolDetailMemberFilter: string;
  marketTargetPoolDetailMembers: string[];
  marketTargetPoolDetailMetric: string | null;
  marketTargetPoolDetailTitle: string;
  marketTargetPoolDetailValue: string;
  setError: Dispatch<SetStateAction<string | null>>;
  setNotice: Dispatch<SetStateAction<string | null>>;
  setMarketCurrentTargetsFilter: Dispatch<SetStateAction<string>>;
  setMarketCurrentTargetsModalOpen: Dispatch<SetStateAction<boolean>>;
  setMarketTargetPoolDetailCategoryKey: Dispatch<SetStateAction<string | null>>;
  setMarketTargetPoolDetailMemberFilter: Dispatch<SetStateAction<string>>;
  setMarketTargetPoolDetailMetric: Dispatch<SetStateAction<string | null>>;
}

export function DashboardOverlays(props: DashboardOverlaysProps) {
  const {
    error,
    formatPct,
    formatTargetsReasons,
    handleCancelDeleteLedgerEntry,
    handleConfirmDeleteLedgerEntry,
    ledgerDeleteSummary,
    ledgerDeleteTarget,
    marketActiveTargetPoolStats,
    marketCurrentTargetsFilter,
    marketCurrentTargetsModalOpen,
    marketCurrentTargetsSource,
    marketFilteredCurrentTargets,
    marketTargetPoolActiveCategoryRow,
    marketTargetPoolDetailCategoryRows,
    marketTargetPoolDetailDescription,
    marketTargetPoolDetailMemberFilter,
    marketTargetPoolDetailMembers,
    marketTargetPoolDetailMetric,
    marketTargetPoolDetailTitle,
    marketTargetPoolDetailValue,
    notice,
    setError,
    setMarketCurrentTargetsFilter,
    setMarketCurrentTargetsModalOpen,
    setMarketTargetPoolDetailCategoryKey,
    setMarketTargetPoolDetailMemberFilter,
    setMarketTargetPoolDetailMetric,
    setNotice,
    toastMessage,
  } = props;

  return (
    <>
        {marketCurrentTargetsModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div
              className="absolute inset-0 bg-black/45 backdrop-blur-sm"
              onClick={() => {
                setMarketCurrentTargetsModalOpen(false);
                setMarketCurrentTargetsFilter("");
              }}
            />
            <div
              role="dialog"
              aria-modal="true"
              className="relative bg-white dark:bg-surface-dark border border-slate-200 dark:border-border-dark rounded-lg shadow-xl w-full max-w-3xl mx-4 p-4 space-y-3"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    当前目标池
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    共 {marketCurrentTargetsSource.length} 个标的
                  </div>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  icon="close"
                  onClick={() => {
                    setMarketCurrentTargetsModalOpen(false);
                    setMarketCurrentTargetsFilter("");
                  }}
                >
                  关闭
                </Button>
              </div>

              <Input
                value={marketCurrentTargetsFilter}
                onChange={(event) => setMarketCurrentTargetsFilter(event.target.value)}
                placeholder="按代码过滤当前目标池"
                className="font-mono text-xs"
              />

              <div className="max-h-[520px] overflow-auto rounded-md border border-slate-200 dark:border-border-dark p-2">
                {marketFilteredCurrentTargets.slice(0, 500).map((row) => (
                  <div
                    key={`current-target-${row.symbol}`}
                    className="flex items-start justify-between gap-3 py-1 border-b border-slate-200/60 dark:border-border-dark/60 last:border-b-0"
                  >
                    <span className="font-mono text-xs text-slate-700 dark:text-slate-200">
                      {row.symbol}
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 text-right">
                      {formatTargetsReasons(row.reasons)}
                    </span>
                  </div>
                ))}
                {marketFilteredCurrentTargets.length === 0 && (
                  <div className="text-xs text-slate-500 dark:text-slate-400 py-2 px-1">
                    暂无匹配标的
                  </div>
                )}
                {marketFilteredCurrentTargets.length > 500 && (
                  <div className="pt-2 text-[11px] text-slate-500 dark:text-slate-400 px-1">
                    仅展示前 500 个标的（共 {marketFilteredCurrentTargets.length}）。
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {marketTargetPoolDetailMetric && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div
              className="absolute inset-0 bg-black/45 backdrop-blur-sm"
              onClick={() => setMarketTargetPoolDetailMetric(null)}
            />
            <div
              role="dialog"
              aria-modal="true"
              className="relative bg-white dark:bg-surface-dark border border-slate-200 dark:border-border-dark rounded-lg shadow-xl w-full max-w-2xl mx-4 p-4 space-y-3"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {marketTargetPoolDetailTitle}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    当前值：<span className="font-mono">{marketTargetPoolDetailValue}</span>
                  </div>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  icon="close"
                  onClick={() => setMarketTargetPoolDetailMetric(null)}
                >
                  关闭
                </Button>
              </div>

              <div className="text-xs text-slate-600 dark:text-slate-300">
                {marketTargetPoolDetailDescription}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-[0.95fr_1.05fr] gap-3">
                <div className="rounded-md border border-slate-200 dark:border-border-dark p-2 space-y-2">
                  <div className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                    分类列表
                  </div>
                    <div className="max-h-[360px] overflow-auto space-y-1">
                      {marketTargetPoolDetailCategoryRows.length === 0 && (
                        <div className="text-xs text-slate-500 dark:text-slate-400 px-1 py-1">
                          暂无分类数据
                        </div>
                      )}
                    {marketTargetPoolDetailCategoryRows.map((row) => {
                      const active = row.key === marketTargetPoolActiveCategoryRow?.key;
                      return (
                        <button
                          key={`target-pool-category-${row.key}`}
                          type="button"
                          onClick={() => setMarketTargetPoolDetailCategoryKey(row.key)}
                          className={`w-full rounded-md px-2 py-1.5 text-left transition-colors ${
                            active
                              ? "bg-primary/15 border border-primary/40"
                              : "bg-slate-50/80 dark:bg-background-dark/45 hover:bg-slate-100 dark:hover:bg-background-dark/65"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs text-slate-700 dark:text-slate-200 truncate">
                              {row.label}
                            </span>
                            <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
                              {row.count}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            占比 {row.ratio === null ? "--" : formatPct(row.ratio)}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="rounded-md border border-slate-200 dark:border-border-dark p-2 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                      成分列表
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                      {marketTargetPoolDetailMembers.length}
                    </div>
                  </div>
                  <Input
                    value={marketTargetPoolDetailMemberFilter}
                    onChange={(event) =>
                      setMarketTargetPoolDetailMemberFilter(event.target.value)
                    }
                    placeholder="按代码或名称过滤成分"
                    className="font-mono text-xs"
                  />
                  <div className="max-h-[320px] overflow-auto rounded-md border border-slate-200/70 dark:border-border-dark/70 p-2">
                    {marketTargetPoolDetailMembers.length === 0 && (
                      <div className="text-xs text-slate-500 dark:text-slate-400 px-1 py-1">
                        暂无匹配成分
                      </div>
                    )}
                    {marketTargetPoolDetailMembers.slice(0, 500).map((symbol) => (
                      <div
                        key={`target-pool-member-${symbol}`}
                        className="py-1.5 px-1 border-b border-slate-200/60 dark:border-border-dark/60 last:border-b-0"
                      >
                        <div className="font-mono text-xs text-slate-700 dark:text-slate-200">
                          {symbol}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                          {marketActiveTargetPoolStats.symbolNames[symbol] ?? "--"}
                        </div>
                      </div>
                    ))}
                    {marketTargetPoolDetailMembers.length > 500 && (
                      <div className="pt-2 text-[11px] text-slate-500 dark:text-slate-400 px-1">
                        仅展示前 500 个成分（共 {marketTargetPoolDetailMembers.length}）。
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {ledgerDeleteTarget && (
          <ConfirmDialog
            open={Boolean(ledgerDeleteTarget)}
            title="确认删除"
            message={
              <div className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
                <p>将删除以下流水记录，操作不可撤销。</p>
                <p className="font-mono text-xs text-slate-500 dark:text-slate-400">
                  {ledgerDeleteSummary}
                </p>
              </div>
            }
            confirmLabel="删除"
            onConfirm={handleConfirmDeleteLedgerEntry}
            onCancel={handleCancelDeleteLedgerEntry}
          />
        )}

        {/* Global Notifications */}
        {(error || notice) && (
           <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 animate-fade-in-up">
              <div className={`px-4 py-3 rounded-lg shadow-lg border flex items-center gap-3 ${
                 error 
                 ? "bg-red-50 dark:bg-red-900 border-red-200 dark:border-red-800 text-red-800 dark:text-red-100" 
                 : "bg-emerald-50 dark:bg-emerald-900 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-100"
              }`}>
                 <span className="material-icons-outlined">{error ? "error" : "check_circle"}</span>
                 <span className="text-sm font-medium">{toastMessage}</span>
                 <button onClick={() => { setError(null); setNotice(null); }} className="ml-2 opacity-60 hover:opacity-100">
                    <span className="material-icons-outlined text-sm">close</span>
                 </button>
              </div>
           </div>
        )}
    </>
  );
}
