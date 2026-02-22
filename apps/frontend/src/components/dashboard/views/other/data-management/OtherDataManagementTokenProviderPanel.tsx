import type { ChangeEvent } from "react";

import type { OtherViewProps } from "../../OtherView";

export type OtherDataManagementTokenProviderPanelProps = Pick<
  OtherViewProps,
  | "Button"
  | "HelpHint"
  | "Input"
  | "PopoverSelect"
  | "handleClearMarketToken"
  | "handleOpenMarketProvider"
  | "handleSaveMarketToken"
  | "handleTestMarketToken"
  | "marketTokenDraft"
  | "marketTokenProvider"
  | "marketTokenSaving"
  | "marketTokenTesting"
  | "setMarketTokenDraft"
  | "setMarketTokenProvider"
>;

export function OtherDataManagementTokenProviderPanel(
  props: OtherDataManagementTokenProviderPanelProps
) {
  const marketTokenFieldId = "market-token-draft";

  return (
    <>
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

      <form
        className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2 items-center"
        onSubmit={(event) => event.preventDefault()}
      >
        <input
          type="text"
          tabIndex={-1}
          aria-hidden="true"
          className="sr-only"
          name="marketTokenProviderAlias"
          autoComplete="username"
          value={props.marketTokenProvider}
          readOnly
        />
        <div className="relative">
          <props.Input
            id={marketTokenFieldId}
            name="marketTokenDraft"
            type="password"
            value={props.marketTokenDraft}
            onChange={(event: ChangeEvent<HTMLInputElement>) =>
              props.setMarketTokenDraft(event.target.value)
            }
            placeholder="输入数据源令牌"
            autoComplete="current-password"
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
      </form>
    </>
  );
}
