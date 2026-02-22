import type { Dispatch, SetStateAction } from "react";
import type {
  PortfolioSnapshot,
  RiskLimit,
  RiskLimitType
} from "@mytrader/shared";

import {
  Button,
  EmptyState,
  Input,
  Panel,
  Select
} from "../shared";

interface RiskFormViewState {
  id?: string;
  limitType: RiskLimitType;
  target: string;
  thresholdPct: string;
}

export interface RiskViewProps {
  snapshot: PortfolioSnapshot | null;
  formatAssetClassLabel: (value: string) => string;
  formatPct: (value: number) => string;
  formatCurrency: (value: number | null) => string;
  formatRiskLimitTypeLabel: (value: RiskLimitType) => string;
  handleEditRiskLimit: (limit: RiskLimit) => void;
  handleDeleteRiskLimit: (id: string) => void;
  riskForm: RiskFormViewState;
  setRiskForm: Dispatch<SetStateAction<RiskFormViewState>>;
  riskLimitTypeLabels: Record<string, string>;
  handleSubmitRiskLimit: () => void;
  handleCancelRiskEdit: () => void;
}

export function RiskView({
  snapshot,
  formatAssetClassLabel,
  formatPct,
  formatCurrency,
  formatRiskLimitTypeLabel,
  handleEditRiskLimit,
  handleDeleteRiskLimit,
  riskForm,
  setRiskForm,
  riskLimitTypeLabels,
  handleSubmitRiskLimit,
  handleCancelRiskEdit
}: RiskViewProps) {
  return (
    <Panel>
      {!snapshot ? <EmptyState message="暂无风险数据。" /> : (
        <div className="space-y-8 max-w-6xl">
          {/* Exposure Table */}
          <section>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 pl-1">资产敞口分布</h3>
            <div className="overflow-hidden border border-slate-200 dark:border-border-dark">
              <table className="min-w-full divide-y divide-slate-200 dark:divide-border-dark">
                <thead className="bg-slate-50 dark:bg-background-dark">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase">资产类别</th>
                    <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500 uppercase">权重</th>
                    <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500 uppercase">市值</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-surface-dark/70 divide-y divide-slate-200 dark:divide-border-dark">
                  {snapshot.exposures.byAssetClass.map((item) => (
                    <tr key={item.key}>
                      <td className="px-4 py-2 text-sm text-slate-700 dark:text-slate-300">{formatAssetClassLabel(item.key)}</td>
                      <td className="px-4 py-2 text-sm text-right font-mono text-slate-600 dark:text-slate-400">{formatPct(item.weight)}</td>
                      <td className="px-4 py-2 text-sm text-right font-mono text-slate-900 dark:text-white">{formatCurrency(item.marketValue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Risk Limits */}
          <section>
            <div className="flex justify-between items-center mb-3 px-1">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">限额监控</h3>
              {snapshot.riskWarnings.length > 0 && (
                <span className="text-xs font-medium text-red-500 bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded">
                  {snapshot.riskWarnings.length} 个预警
                </span>
              )}
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {snapshot.riskLimits.map((limit) => (
                  <div key={limit.id} className="bg-white dark:bg-gradient-to-b dark:from-panel-dark dark:to-surface-dark border border-slate-200 dark:border-border-dark p-4 flex flex-col justify-between hover:border-slate-300 dark:hover:border-border-dark/80 transition-colors">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{formatRiskLimitTypeLabel(limit.limitType)}</div>
                        <div className="font-medium text-slate-900 dark:text-white mt-1 text-lg">{limit.target}</div>
                      </div>
                      <div className="text-xl font-mono font-light text-slate-700 dark:text-slate-300">{formatPct(limit.threshold)}</div>
                    </div>
                    <div className="flex justify-end gap-3 mt-4 pt-3 border-t border-slate-100 dark:border-border-dark">
                      <button onClick={() => handleEditRiskLimit(limit)} className="text-xs font-medium text-slate-500 hover:text-primary transition-colors">编辑</button>
                      <button onClick={() => handleDeleteRiskLimit(limit.id)} className="text-xs font-medium text-slate-500 hover:text-red-500 transition-colors">删除</button>
                    </div>
                  </div>
                ))}
                {/* Add New Limit Form */}
                <div className="bg-slate-50 dark:bg-background-dark border border-dashed border-slate-300 dark:border-border-dark p-4 flex flex-col gap-3">
                  <div className="text-xs font-bold text-slate-400 uppercase text-center">{riskForm.id ? "编辑限额" : "新增限额"}</div>
                  <Select
                    value={riskForm.limitType}
                    onChange={(event) =>
                      setRiskForm((previous) => ({ ...previous, limitType: event.target.value as RiskLimitType }))
                    }
                    options={Object.entries(riskLimitTypeLabels).map(([value, label]) => ({ value, label }))}
                    className="text-xs"
                  />
                  <Input
                    value={riskForm.target}
                    onChange={(event) =>
                      setRiskForm((previous) => ({ ...previous, target: event.target.value }))
                    }
                    placeholder="目标 (如 600519)"
                    className="text-xs"
                  />
                  <Input
                    type="number"
                    value={riskForm.thresholdPct}
                    onChange={(event) =>
                      setRiskForm((previous) => ({ ...previous, thresholdPct: event.target.value }))
                    }
                    placeholder="阈值 %"
                    className="text-xs"
                  />
                  <div className="flex gap-2 mt-auto pt-2">
                    <Button variant="primary" size="sm" onClick={handleSubmitRiskLimit} className="w-full">{riskForm.id ? "保存" : "添加"}</Button>
                    {riskForm.id && <Button variant="secondary" size="sm" onClick={handleCancelRiskEdit}>取消</Button>}
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      )}
    </Panel>
  );
}
