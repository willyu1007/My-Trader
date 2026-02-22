import type { ChangeEvent } from "react";

import type { TagSummary } from "@mytrader/shared";

import type { MarketTagFacetItem, MarketViewProps } from "../MarketView";

export type MarketDialogsProps = Pick<
  MarketViewProps,
  | "Button"
  | "FormGroup"
  | "Input"
  | "Modal"
  | "PopoverSelect"
  | "formatCnWanYiNullable"
  | "formatNumber"
  | "formatSignedPctNullable"
  | "formatThemeLabel"
  | "getCnChangeTone"
  | "getCnToneTextClass"
  | "handleAddManualTheme"
  | "handleAddSelectedToWatchlist"
  | "handleAddTargetTag"
  | "handleAddUserTag"
  | "handleRemoveUserTag"
  | "handleSelectInstrument"
  | "handleSelectTag"
  | "marketFilterAssetClasses"
  | "marketFilterKinds"
  | "marketFilterMarket"
  | "marketFiltersActiveCount"
  | "marketFiltersOpen"
  | "marketInstrumentDetailsOpen"
  | "marketManualThemeDraft"
  | "marketManualThemeLoading"
  | "marketManualThemeOptions"
  | "marketQuotesBySymbol"
  | "marketSelectedIndustry"
  | "marketSelectedManualThemes"
  | "marketSelectedPlainUserTags"
  | "marketSelectedProfile"
  | "marketSelectedSymbol"
  | "marketSelectedTag"
  | "marketSelectedTagAggregate"
  | "marketSelectedThemes"
  | "marketShowProviderData"
  | "marketTagMembers"
  | "marketTagMembersLoading"
  | "marketTagMembersModalOpen"
  | "marketTagPickerOpen"
  | "marketTagPickerQuery"
  | "marketTags"
  | "marketTagsLoading"
  | "marketUserTagDraft"
  | "marketWatchlistGroupDraft"
  | "refreshMarketTags"
  | "resetMarketFilters"
  | "setMarketFilterAssetClasses"
  | "setMarketFilterKinds"
  | "setMarketFilterMarket"
  | "setMarketFiltersOpen"
  | "setMarketInstrumentDetailsOpen"
  | "setMarketManualThemeDraft"
  | "setMarketScope"
  | "setMarketShowProviderData"
  | "setMarketTagMembersModalOpen"
  | "setMarketTagPickerOpen"
  | "setMarketTagPickerQuery"
  | "setMarketUserTagDraft"
  | "setMarketWatchlistGroupDraft"
  | "sortTagMembersByChangePct"
>;

export function MarketDialogs(props: MarketDialogsProps) {
  return (
    <>
      <props.Modal
        open={props.marketFiltersOpen}
        title="筛选"
        onClose={() => props.setMarketFiltersOpen(false)}
      >
        <div className="space-y-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            当前筛选对「搜索 / 持仓」生效；集合成分（Tags）暂不做元数据筛选。
          </div>

          <props.FormGroup label="市场（market）">
            <div className="flex items-center gap-2">
              {([
                { key: "all", label: "全部" },
                { key: "CN", label: "CN" }
              ] as const).map((item) => {
                const isActive = props.marketFilterMarket === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                      isActive
                        ? "bg-primary/20 text-primary dark:bg-white/20 dark:text-white"
                        : "bg-slate-100 dark:bg-background-dark/80 text-slate-600 dark:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-white/10"
                    }`}
                    onClick={() => props.setMarketFilterMarket(item.key)}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          </props.FormGroup>

          <props.FormGroup label="资产类别（assetClass）">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm text-slate-700 dark:text-slate-200">
              {([
                { key: "stock", label: "stock" },
                { key: "etf", label: "etf" }
              ] as const).map((item) => (
                <label key={item.key} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="marketFilterAssetClasses"
                    checked={props.marketFilterAssetClasses.includes(item.key)}
                    onChange={() =>
                      props.setMarketFilterAssetClasses((prev) =>
                        prev.includes(item.key)
                          ? prev.filter((value) => value !== item.key)
                          : [...prev, item.key]
                      )
                    }
                  />
                  <span className="font-mono text-xs">{item.label}</span>
                </label>
              ))}
            </div>
          </props.FormGroup>

          <props.FormGroup label="标的类型（kind，仅搜索结果）">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm text-slate-700 dark:text-slate-200">
              {([
                { key: "stock", label: "stock" },
                { key: "fund", label: "fund" }
              ] as const).map((item) => (
                <label key={item.key} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="marketFilterKinds"
                    checked={props.marketFilterKinds.includes(item.key)}
                    onChange={() =>
                      props.setMarketFilterKinds((prev) =>
                        prev.includes(item.key)
                          ? prev.filter((value) => value !== item.key)
                          : [...prev, item.key]
                      )
                    }
                  />
                  <span className="font-mono text-xs">{item.label}</span>
                </label>
              ))}
            </div>
          </props.FormGroup>

          <div className="flex items-center justify-between gap-2">
            <props.Button
              variant="secondary"
              size="sm"
              icon="restart_alt"
              onClick={props.resetMarketFilters}
              disabled={props.marketFiltersActiveCount === 0}
            >
              重置
            </props.Button>
            <props.Button
              variant="primary"
              size="sm"
              icon="done"
              onClick={() => props.setMarketFiltersOpen(false)}
            >
              完成
            </props.Button>
          </div>
        </div>
      </props.Modal>

      <props.Modal
        open={props.marketInstrumentDetailsOpen}
        title="标的详情"
        onClose={() => props.setMarketInstrumentDetailsOpen(false)}
      >
        {!props.marketSelectedSymbol && (
          <div className="text-sm text-slate-500 dark:text-slate-400">
            暂无选中标的。
          </div>
        )}

        {props.marketSelectedSymbol && props.marketSelectedProfile === null && (
          <div className="text-sm text-slate-500 dark:text-slate-400">
            载入中或该标的暂无详情：{" "}
            <span className="font-mono">{props.marketSelectedSymbol}</span>
          </div>
        )}

        {props.marketSelectedProfile && (
          <div className="space-y-5">
            <div className="space-y-1">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-lg font-semibold text-slate-900 dark:text-white">
                  {props.marketSelectedProfile.name ?? "--"}
                </span>
                <span className="font-mono text-sm text-slate-600 dark:text-slate-300">
                  {props.marketSelectedProfile.symbol}
                </span>
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                提供方：{props.marketSelectedProfile.provider} · 类型：{" "}
                {props.marketSelectedProfile.kind} · 资产类别：{" "}
                {props.marketSelectedProfile.assetClass ?? "--"} · 市场：{" "}
                {props.marketSelectedProfile.market ?? "--"} · 币种：{" "}
                {props.marketSelectedProfile.currency ?? "--"}
              </div>
            </div>

            <props.FormGroup label="自选">
              <div className="flex gap-2">
                <props.Input
                  value={props.marketWatchlistGroupDraft}
                  onChange={(event: ChangeEvent<HTMLInputElement>) =>
                    props.setMarketWatchlistGroupDraft(event.target.value)
                  }
                  placeholder="自选分组（可选）"
                  className="text-xs"
                />
                <props.Button
                  variant="secondary"
                  size="sm"
                  icon="star"
                  onClick={props.handleAddSelectedToWatchlist}
                >
                  加入自选
                </props.Button>
              </div>
            </props.FormGroup>

            <div className="space-y-1">
              <div className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                提供方标签（可加入自动拉取筛选）
              </div>
              <div className="flex flex-wrap gap-1.5">
                {props.marketSelectedProfile.tags.length === 0 && (
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    --
                  </span>
                )}
                {props.marketSelectedProfile.tags.map((tag: string) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => props.handleAddTargetTag(tag)}
                    className="px-2 py-0.5 rounded-full text-[11px] border border-slate-200 dark:border-border-dark text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-background-dark/70"
                    title="加入标签筛选"
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <div className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                行业（SW 口径）
              </div>
              <div className="flex flex-wrap gap-1.5">
                {props.marketSelectedIndustry.length === 0 && (
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    --
                  </span>
                )}
                {props.marketSelectedIndustry.map((item: MarketTagFacetItem) => (
                  <button
                    key={item.tag}
                    type="button"
                    onClick={() => props.handleAddTargetTag(item.tag)}
                    className="px-2 py-0.5 rounded-full text-[11px] border border-slate-200 dark:border-border-dark text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-background-dark/70"
                    title="加入标签筛选"
                  >
                    {`L${item.level.slice(1)}:${item.name}`}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <div className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                主题
              </div>
              <div className="flex flex-wrap gap-1.5">
                {props.marketSelectedThemes.length === 0 && (
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    --
                  </span>
                )}
                {props.marketSelectedThemes.map((theme) => (
                  <button
                    key={theme.tag}
                    type="button"
                    onClick={() => props.handleAddTargetTag(theme.tag)}
                    className="px-2 py-0.5 rounded-full text-[11px] border border-slate-200 dark:border-border-dark text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-background-dark/70"
                    title="加入标签筛选"
                  >
                    {props.formatThemeLabel(theme)}
                  </button>
                ))}
              </div>
            </div>

            <props.FormGroup label="手动主题（THS 选择）">
              <div className="flex gap-2">
                <props.PopoverSelect
                  value={props.marketManualThemeDraft}
                  onChangeValue={props.setMarketManualThemeDraft}
                  options={props.marketManualThemeOptions}
                  className="flex-1"
                  disabled={props.marketManualThemeLoading}
                />
                <props.Button
                  variant="secondary"
                  size="sm"
                  icon="add"
                  onClick={props.handleAddManualTheme}
                  disabled={!props.marketManualThemeDraft || props.marketManualThemeLoading}
                >
                  添加
                </props.Button>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {props.marketSelectedManualThemes.length === 0 && (
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    --
                  </span>
                )}
                {props.marketSelectedManualThemes.map((tag: string) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] border border-slate-200 dark:border-border-dark text-slate-700 dark:text-slate-200"
                  >
                    <button
                      type="button"
                      onClick={() => props.handleAddTargetTag(tag)}
                      className="hover:underline"
                      title="加入标签筛选"
                    >
                      {tag.replace(/^theme:manual:/, "")}
                    </button>
                    <button
                      type="button"
                      onClick={() => props.handleRemoveUserTag(tag)}
                      className="text-slate-400 hover:text-red-500"
                      aria-label={`移除主题 ${tag}`}
                      title="移除主题"
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
              {props.marketManualThemeOptions.length === 0 && (
                <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  暂无 THS 主题可选（需先同步或导入相关主题标签）。
                </div>
              )}
            </props.FormGroup>

            <div className="space-y-1.5">
              <div className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                用户标签
              </div>
              <div className="flex flex-wrap gap-1.5">
                {props.marketSelectedPlainUserTags.length === 0 && (
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    --
                  </span>
                )}
                {props.marketSelectedPlainUserTags.map((tag: string) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] border border-slate-200 dark:border-border-dark text-slate-700 dark:text-slate-200"
                  >
                    <button
                      type="button"
                      onClick={() => props.handleAddTargetTag(tag)}
                      className="hover:underline"
                      title="加入标签筛选"
                    >
                      {tag}
                    </button>
                    <button
                      type="button"
                      onClick={() => props.handleRemoveUserTag(tag)}
                      className="text-slate-400 hover:text-red-500"
                      aria-label={`移除标签 ${tag}`}
                      title="移除标签"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <props.Input
                  value={props.marketUserTagDraft}
                  onChange={(event: ChangeEvent<HTMLInputElement>) =>
                    props.setMarketUserTagDraft(event.target.value)
                  }
                  placeholder="例如：user:核心 / theme:AI"
                  className="text-xs"
                />
                <props.Button
                  variant="primary"
                  size="sm"
                  icon="add"
                  onClick={props.handleAddUserTag}
                  disabled={!props.marketUserTagDraft.trim()}
                >
                  添加
                </props.Button>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  原始字段
                </div>
                <button
                  type="button"
                  className="text-xs text-slate-600 dark:text-slate-300 hover:underline"
                  onClick={() =>
                    props.setMarketShowProviderData((prev: boolean) => !prev)
                  }
                >
                  {props.marketShowProviderData ? "隐藏" : "显示"}
                </button>
              </div>
              {props.marketShowProviderData && (
                <pre className="max-h-96 overflow-auto rounded-md bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark p-3 text-xs font-mono text-slate-700 dark:text-slate-200">
                  {JSON.stringify(props.marketSelectedProfile.providerData, null, 2)}
                </pre>
              )}
              {!props.marketShowProviderData && (
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  用于调试与字段映射。
                </div>
              )}
            </div>
          </div>
        )}
      </props.Modal>

      <props.Modal
        open={props.marketTagPickerOpen}
        title="选择集合（Tags）"
        onClose={() => props.setMarketTagPickerOpen(false)}
      >
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <props.Input
              value={props.marketTagPickerQuery}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                props.setMarketTagPickerQuery(event.target.value)
              }
              placeholder="搜索 tag（例如 watchlist / industry / 白酒）"
              className="text-sm"
            />
            <props.Button
              variant="secondary"
              size="sm"
              icon="refresh"
              onClick={() => props.refreshMarketTags(props.marketTagPickerQuery)}
              disabled={props.marketTagsLoading}
            >
              刷新
            </props.Button>
          </div>

          {props.marketTagsLoading && (
            <div className="text-sm text-slate-500 dark:text-slate-400">
              加载中...
            </div>
          )}

          {!props.marketTagsLoading && props.marketTags.length === 0 && (
            <div className="text-sm text-slate-500 dark:text-slate-400">
              暂无可用集合。请先同步标的库或添加自选/用户标签。
            </div>
          )}

          {!props.marketTagsLoading && props.marketTags.length > 0 && (
            <div className="max-h-[520px] overflow-auto rounded-md border border-slate-200 dark:border-border-dark">
              {props.marketTags.map((tag: TagSummary) => {
                const isActive = props.marketSelectedTag === tag.tag;
                return (
                  <button
                    key={`${tag.source}:${tag.tag}`}
                    type="button"
                    onClick={() => {
                      props.setMarketTagPickerOpen(false);
                      props.setMarketScope("tags");
                      void props.handleSelectTag(tag.tag);
                    }}
                    className={`w-full text-left px-3 py-2 border-b border-slate-200 dark:border-border-dark last:border-b-0 transition-colors ${
                      isActive
                        ? "bg-primary/10"
                        : "hover:bg-slate-50 dark:hover:bg-background-dark/70"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-mono text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                          {tag.tag}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          {tag.source}
                        </div>
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {tag.memberCount}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </props.Modal>

      <props.Modal
        open={props.marketTagMembersModalOpen}
        title={`成分股 · ${props.marketSelectedTag ?? "--"}`}
        onClose={() => props.setMarketTagMembersModalOpen(false)}
      >
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span className="font-mono">
              {props.marketTagMembers.length} symbols
            </span>
            <span>
              {props.marketSelectedTagAggregate
                ? `覆盖 ${props.marketSelectedTagAggregate.includedCount}/${props.marketSelectedTagAggregate.totalCount}（剔除 ${props.marketSelectedTagAggregate.excludedCount}）`
                : "--"}
            </span>
          </div>

          {props.marketTagMembersLoading && (
            <div className="text-sm text-slate-500 dark:text-slate-400">
              加载中...
            </div>
          )}

          {!props.marketTagMembersLoading && props.marketTagMembers.length === 0 && (
            <div className="text-sm text-slate-500 dark:text-slate-400">
              暂无成分。
            </div>
          )}

          {!props.marketTagMembersLoading && props.marketTagMembers.length > 0 && (
            <div className="rounded-md border border-slate-200 dark:border-border-dark overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-white dark:bg-background-dark">
                  <tr className="text-xs text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-border-dark">
                    <th className="text-left font-semibold px-4 py-2">
                      Symbol
                    </th>
                    <th className="text-right font-semibold px-4 py-2">
                      Price
                    </th>
                    <th className="text-right font-semibold px-4 py-2">
                      Change%
                    </th>
                    <th className="text-right font-semibold px-4 py-2">
                      circ_mv
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {props.sortTagMembersByChangePct(
                    props.marketTagMembers,
                    props.marketQuotesBySymbol
                  )
                    .slice(0, 2000)
                    .map((symbol: string) => {
                      const quote = props.marketQuotesBySymbol[symbol] ?? null;
                      const tone = props.getCnChangeTone(quote?.changePct ?? null);
                      return (
                        <tr
                          key={symbol}
                          className="border-b border-slate-200/70 dark:border-border-dark/70 last:border-b-0 hover:bg-slate-50 dark:hover:bg-background-dark/70 cursor-pointer"
                          onClick={() => {
                            props.setMarketTagMembersModalOpen(false);
                            void props.handleSelectInstrument(symbol);
                          }}
                        >
                          <td className="px-4 py-2 font-mono text-xs text-slate-700 dark:text-slate-200">
                            {symbol}
                          </td>
                          <td className="px-4 py-2 text-right font-mono text-xs text-slate-900 dark:text-white">
                            {props.formatNumber(quote?.close ?? null, 2)}
                          </td>
                          <td
                            className={`px-4 py-2 text-right font-mono text-xs ${props.getCnToneTextClass(
                              tone
                            )}`}
                          >
                            {props.formatSignedPctNullable(quote?.changePct ?? null)}
                          </td>
                          <td className="px-4 py-2 text-right font-mono text-xs text-slate-500 dark:text-slate-400">
                            {props.formatCnWanYiNullable(quote?.circMv ?? null, 2, 0)}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}

          {!props.marketTagMembersLoading && props.marketTagMembers.length > 2000 && (
            <div className="text-xs text-slate-500 dark:text-slate-400">
              仅展示前 2000 个标的（共 {props.marketTagMembers.length}）。
            </div>
          )}
        </div>
      </props.Modal>
    </>
  );
}
