import type { OtherViewProps } from "../OtherView";

export type OtherTestTabProps = Pick<
  OtherViewProps,
  | "Button"
  | "FormGroup"
  | "Input"
  | "activePortfolio"
  | "handleChooseCsv"
  | "handleImportHoldings"
  | "handleImportPrices"
  | "handleSeedMarketDemoData"
  | "holdingsCsvPath"
  | "marketDemoSeeding"
  | "pricesCsvPath"
  | "setActiveView"
>;

export function OtherTestTab({
  Button,
  FormGroup,
  Input,
  activePortfolio,
  handleChooseCsv,
  handleImportHoldings,
  handleImportPrices,
  handleSeedMarketDemoData,
  holdingsCsvPath,
  marketDemoSeeding,
  pricesCsvPath,
  setActiveView
}: OtherTestTabProps) {
  return (
    <>
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-bold text-slate-900 dark:text-white">
            示例数据
          </h3>
          <Button
            variant="secondary"
            size="sm"
            icon="show_chart"
            onClick={() => setActiveView("market")}
          >
            打开市场行情
          </Button>
        </div>
        <div className="rounded-md border border-slate-200 dark:border-border-dark bg-white dark:bg-gradient-to-b dark:from-panel-dark dark:to-surface-dark p-3 space-y-2">
          <div className="flex flex-wrap gap-2">
            <Button
              variant="primary"
              size="sm"
              icon="science"
              onClick={() => {
                void (async () => {
                  await handleSeedMarketDemoData();
                  setActiveView("market");
                })();
              }}
              disabled={marketDemoSeeding}
            >
              {marketDemoSeeding ? "注入中..." : "注入示例数据"}
            </Button>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="font-bold text-slate-900 dark:text-white">
          数据导入
        </h3>
        <div className="grid grid-cols-1 gap-8">
          <div className="space-y-4">
            <FormGroup label="持仓文件">
              <div className="flex gap-2">
                <Input
                  value={holdingsCsvPath ?? ""}
                  readOnly
                  className="flex-1 text-xs font-mono"
                />
                <Button
                  variant="secondary"
                  onClick={() => handleChooseCsv("holdings")}
                >
                  选择
                </Button>
                <Button
                  variant="primary"
                  onClick={handleImportHoldings}
                  disabled={!holdingsCsvPath || !activePortfolio}
                >
                  导入
                </Button>
              </div>
            </FormGroup>
            <FormGroup label="价格文件">
              <div className="flex gap-2">
                <Input
                  value={pricesCsvPath ?? ""}
                  readOnly
                  className="flex-1 text-xs font-mono"
                />
                <Button
                  variant="secondary"
                  onClick={() => handleChooseCsv("prices")}
                >
                  选择
                </Button>
                <Button
                  variant="primary"
                  onClick={handleImportPrices}
                  disabled={!pricesCsvPath}
                >
                  导入
                </Button>
              </div>
            </FormGroup>
          </div>
        </div>
      </section>
    </>
  );
}
