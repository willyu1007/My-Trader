import type { ChangeEvent } from "react";

import type { OtherViewProps } from "../../OtherView";

export type OtherDataManagementSchedulerSectionProps = Pick<
  OtherViewProps,
  | "Button"
  | "FormGroup"
  | "HelpHint"
  | "Input"
  | "Modal"
  | "PopoverSelect"
  | "formatIngestControlStateLabel"
  | "getIngestControlStateDotClass"
  | "handleCancelMarketIngest"
  | "handlePauseMarketIngest"
  | "handleResumeMarketIngest"
  | "handleRunMarketIngestNow"
  | "handleSaveMarketSchedulerConfig"
  | "marketCanCancelIngest"
  | "marketCanPauseIngest"
  | "marketCanResumeIngest"
  | "marketCanTriggerIngestNow"
  | "marketIngestControlStatus"
  | "marketSchedulerAdvancedOpen"
  | "marketSchedulerConfig"
  | "marketSchedulerDirty"
  | "marketSchedulerLoading"
  | "marketSchedulerSaving"
  | "marketSchedulerTimezoneOptions"
  | "marketTriggerIngestBlockedMessage"
  | "marketTriggerIngestBlockedOpen"
  | "setMarketSchedulerAdvancedOpen"
  | "setMarketTriggerIngestBlockedOpen"
  | "updateMarketSchedulerConfig"
>;

export function OtherDataManagementSchedulerSection(
  props: OtherDataManagementSchedulerSectionProps
) {
  return (
    <>
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-bold text-slate-900 dark:text-white">
            调度与运行控制
          </h3>
        </div>

        <div className="scheduler-shell rounded-md border p-3">
          {!props.marketSchedulerConfig && !props.marketSchedulerLoading && (
            <div className="text-xs text-slate-500 dark:text-slate-400">
              --
            </div>
          )}
          {props.marketSchedulerLoading && !props.marketSchedulerConfig && (
            <div className="text-xs text-slate-500 dark:text-slate-400">
              加载中...
            </div>
          )}
          {props.marketSchedulerConfig && (
            <div className="grid grid-cols-1 lg:grid-cols-[1.05fr_1.35fr] gap-3">
              <div className="space-y-3 lg:pr-5 lg:border-r border-slate-200/70 dark:border-border-dark/70">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <props.FormGroup
                    label={
                      <span className="inline-flex items-center gap-1">
                        执行时间
                        <props.HelpHint text="每天在该时间触发自动拉取（24小时制，格式 HH:mm）。" />
                      </span>
                    }
                  >
                    <props.Input
                      value={props.marketSchedulerConfig.runAt}
                      onChange={(event: ChangeEvent<HTMLInputElement>) =>
                        props.updateMarketSchedulerConfig({
                          runAt: event.target.value
                        })
                      }
                      placeholder="19:30"
                      className="h-8 font-mono text-sm"
                    />
                  </props.FormGroup>
                  <props.FormGroup
                    label={
                      <span className="inline-flex items-center gap-1">
                        拉取范围
                        <props.HelpHint text={"控制每次定时任务拉取对象：\n目标池 + 全市场：先维护目标池，再维护全市场。\n仅目标池：只更新目标池标的。\n仅全市场：只执行全市场维护。"} />
                      </span>
                    }
                  >
                    <props.PopoverSelect
                      value={props.marketSchedulerConfig.scope}
                      onChangeValue={(value: string) =>
                        props.updateMarketSchedulerConfig({
                          scope: value as "targets" | "universe" | "both"
                        })
                      }
                      options={[
                        { value: "both", label: "目标池 + 全市场" },
                        { value: "targets", label: "仅目标池" },
                        { value: "universe", label: "仅全市场" }
                      ]}
                      buttonClassName="h-8 pl-3 text-sm"
                    />
                  </props.FormGroup>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <props.Button
                    variant="secondary"
                    size="sm"
                    icon="tune"
                    onClick={() => props.setMarketSchedulerAdvancedOpen(true)}
                    className="min-w-[120px] justify-center"
                  >
                    更多设置
                  </props.Button>
                  <props.Button
                    variant="primary"
                    size="sm"
                    icon="save"
                    onClick={props.handleSaveMarketSchedulerConfig}
                    disabled={
                      props.marketSchedulerSaving ||
                      !props.marketSchedulerConfig ||
                      !props.marketSchedulerDirty
                    }
                    className="min-w-[136px] justify-center"
                  >
                    保存调度
                  </props.Button>
                </div>
                {props.marketSchedulerDirty && (
                  <div className="text-xs text-amber-600 dark:text-amber-300">
                    存在未保存变更
                  </div>
                )}
              </div>

              <div className="space-y-3 lg:pl-0">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <div className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 dark:text-slate-400">
                      状态
                      <props.HelpHint text="当前拉取执行状态：空闲 / 运行中 / 已暂停 / 取消中。" />
                    </div>
                    <div className="h-8 rounded-md border border-slate-200 dark:border-border-dark px-3 flex items-center">
                      <span className="inline-flex items-center gap-2 font-mono text-sm text-slate-700 dark:text-slate-200">
                        <span>
                          {props.marketIngestControlStatus
                            ? props.formatIngestControlStateLabel(
                                props.marketIngestControlStatus.state
                              )
                            : "--"}
                        </span>
                        <span
                          className={`inline-block h-2.5 w-2.5 rounded-full ${props.getIngestControlStateDotClass(
                            props.marketIngestControlStatus?.state ?? null
                          )}`}
                        />
                      </span>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <div className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 dark:text-slate-400">
                      队列
                      <props.HelpHint text="等待执行的拉取任务数量（含当前排队项）。" />
                    </div>
                    <div className="h-8 rounded-md border border-slate-200 dark:border-border-dark px-3 flex items-center font-mono text-sm text-slate-700 dark:text-slate-200">
                      {props.marketIngestControlStatus?.queueLength ?? "--"}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <div className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 dark:text-slate-400">
                      Run ID
                      <props.HelpHint text="当前运行任务的唯一标识；空闲时为空。" />
                    </div>
                    <div className="h-8 rounded-md border border-slate-200 dark:border-border-dark px-3 flex items-center font-mono text-sm text-slate-700 dark:text-slate-200 truncate">
                      {props.marketIngestControlStatus?.currentRunId ?? "--"}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <props.Button
                    variant="secondary"
                    size="sm"
                    icon="pause"
                    onClick={props.handlePauseMarketIngest}
                    disabled={!props.marketCanPauseIngest}
                    className="w-full justify-center"
                  >
                    暂停
                  </props.Button>
                  <props.Button
                    variant="secondary"
                    size="sm"
                    icon="play_arrow"
                    onClick={props.handleResumeMarketIngest}
                    disabled={!props.marketCanResumeIngest}
                    className="w-full justify-center"
                  >
                    继续
                  </props.Button>
                  <props.Button
                    variant="primary"
                    size="sm"
                    icon="play_circle"
                    onClick={props.handleRunMarketIngestNow}
                    disabled={!props.marketCanTriggerIngestNow}
                    className="w-full justify-center"
                  >
                    拉取
                  </props.Button>
                  <props.Button
                    variant="danger"
                    size="sm"
                    icon="cancel"
                    onClick={props.handleCancelMarketIngest}
                    disabled={!props.marketCanCancelIngest}
                    className="w-full justify-center"
                  >
                    取消
                  </props.Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      <props.Modal
        open={props.marketSchedulerAdvancedOpen}
        title="调度高级设置"
        onClose={() => props.setMarketSchedulerAdvancedOpen(false)}
      >
        {props.marketSchedulerConfig ? (
          <div className="space-y-4">
            <div className="scheduler-intro rounded-lg border p-4">
              <div className="text-base font-semibold text-[color:var(--mt-text)]">
                自动调度补充项
              </div>
            </div>

            <div className="scheduler-card rounded-lg border p-4 space-y-4">
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  name="marketSchedulerEnabled"
                  className="mt-1 h-4 w-4 accent-primary"
                  checked={props.marketSchedulerConfig.enabled}
                  onChange={(event) =>
                    props.updateMarketSchedulerConfig({
                      enabled: event.target.checked
                    })
                  }
                />
                <span className="space-y-1">
                  <span className="inline-flex items-center gap-1 text-sm font-semibold text-[color:var(--mt-text)]">
                    启用定时调度
                    <props.HelpHint text="关闭后不会按计划自动触发，但不影响手动拉取。" />
                  </span>
                </span>
              </label>

              <props.FormGroup
                label={
                  <span className="inline-flex items-center gap-1">时区</span>
                }
              >
                <props.PopoverSelect
                  value={props.marketSchedulerConfig.timezone}
                  onChangeValue={(value: string) =>
                    props.updateMarketSchedulerConfig({ timezone: value })
                  }
                  options={props.marketSchedulerTimezoneOptions}
                  className="w-full"
                  buttonClassName="h-10 pl-3 pr-14 text-sm font-mono"
                  rightAccessory={
                    <props.HelpHint text="执行时间解释所使用的时区，例如 Asia/Shanghai。" />
                  }
                />
              </props.FormGroup>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="scheduler-toggle-card rounded-md border p-3">
                  <span className="inline-flex items-center gap-2 text-sm font-semibold text-[color:var(--mt-text)]">
                    <input
                      type="checkbox"
                      name="marketSchedulerRunOnStartup"
                      className="h-4 w-4 accent-primary"
                      checked={props.marketSchedulerConfig.runOnStartup}
                      onChange={(event) =>
                        props.updateMarketSchedulerConfig({
                          runOnStartup: event.target.checked
                        })
                      }
                    />
                    启动后立即执行
                    <props.HelpHint text="应用启动后触发一次拉取，无需等待当天定时时间。" />
                  </span>
                  <span className="ui-tone-neutral mt-1 block pl-6 text-xs">
                    适合长时间离线后快速补齐最新数据。
                  </span>
                </label>

                <label className="scheduler-toggle-card rounded-md border p-3">
                  <span className="inline-flex items-center gap-2 text-sm font-semibold text-[color:var(--mt-text)]">
                    <input
                      type="checkbox"
                      name="marketSchedulerCatchUpMissed"
                      className="h-4 w-4 accent-primary"
                      checked={props.marketSchedulerConfig.catchUpMissed}
                      onChange={(event) =>
                        props.updateMarketSchedulerConfig({
                          catchUpMissed: event.target.checked
                        })
                      }
                    />
                    补跑错过的当日任务
                    <props.HelpHint text="若应用在执行时段离线，恢复后会补一次当日任务。" />
                  </span>
                  <span className="ui-tone-neutral mt-1 block pl-6 text-xs">
                    减少因离线导致的数据缺口。
                  </span>
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-border-dark">
              <props.Button
                variant="secondary"
                size="sm"
                onClick={() => props.setMarketSchedulerAdvancedOpen(false)}
              >
                取消
              </props.Button>
              <props.Button
                variant="primary"
                size="sm"
                icon="save"
                onClick={async () => {
                  const saved = await props.handleSaveMarketSchedulerConfig();
                  if (saved) {
                    props.setMarketSchedulerAdvancedOpen(false);
                  }
                }}
                disabled={
                  props.marketSchedulerSaving ||
                  !props.marketSchedulerConfig ||
                  !props.marketSchedulerDirty
                }
              >
                保存更改
              </props.Button>
            </div>
          </div>
        ) : (
          <div className="text-sm text-slate-500 dark:text-slate-400">
            暂无调度配置。
          </div>
        )}
      </props.Modal>

      <props.Modal
        open={props.marketTriggerIngestBlockedOpen}
        title="无法执行拉取"
        onClose={() => props.setMarketTriggerIngestBlockedOpen(false)}
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {props.marketTriggerIngestBlockedMessage}
          </p>
          <div className="flex justify-end">
            <props.Button
              variant="primary"
              size="sm"
              onClick={() => props.setMarketTriggerIngestBlockedOpen(false)}
            >
              我知道了
            </props.Button>
          </div>
        </div>
      </props.Modal>
    </>
  );
}
