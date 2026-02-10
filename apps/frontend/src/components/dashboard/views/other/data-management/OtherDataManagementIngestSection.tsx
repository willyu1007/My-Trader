import type { OtherViewProps } from "../../OtherView";

export type OtherDataManagementIngestSectionProps = Pick<
  OtherViewProps,
  | "Button"
  | "handleTriggerMarketIngest"
  | "marketIngestTriggering"
  | "setOtherTab"
>;

export function OtherDataManagementIngestSection(
  props: OtherDataManagementIngestSectionProps
) {
  return (
    <>
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-bold text-slate-900 dark:text-white">
            手动拉取
          </h3>
        </div>

        <div className="rounded-md border border-slate-200 dark:border-border-dark bg-white dark:bg-gradient-to-b dark:from-panel-dark dark:to-surface-dark p-3">
          <div className="flex items-center gap-2 overflow-x-auto">
            <props.Button
              variant="primary"
              size="sm"
              icon="play_arrow"
              onClick={() => props.handleTriggerMarketIngest("targets")}
              disabled={props.marketIngestTriggering}
            >
              拉取目标池
            </props.Button>
            <props.Button
              variant="secondary"
              size="sm"
              icon="play_arrow"
              onClick={() => props.handleTriggerMarketIngest("universe")}
              disabled={props.marketIngestTriggering}
            >
              拉取全市场
            </props.Button>
            <props.Button
              variant="secondary"
              size="sm"
              icon="playlist_play"
              onClick={() => props.handleTriggerMarketIngest("both")}
              disabled={props.marketIngestTriggering}
            >
              全部拉取
            </props.Button>
            <props.Button
              variant="secondary"
              size="sm"
              icon="monitoring"
              onClick={() => props.setOtherTab("data-status")}
            >
              查看记录
            </props.Button>
          </div>
        </div>
      </section>
    </>
  );
}
