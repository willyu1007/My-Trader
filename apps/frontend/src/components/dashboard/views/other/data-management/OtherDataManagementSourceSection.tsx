import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";

import type {
  ConnectivityTestRecord,
  DataDomainId,
  DataSourceDomainCatalogItem,
  DataSourceModuleCatalogItem,
  DataSourceReadinessResult,
  MarketDataSourceCatalog,
  MarketDataSourceConfigV2,
  MarketTokenMatrixStatus
} from "@mytrader/shared";

import type { OtherViewProps } from "../../OtherView";

type StatusFilter = "all" | "syncable";

export type OtherDataManagementSourceSectionProps = Pick<
  OtherViewProps,
  | "Button"
  | "Input"
  | "PopoverSelect"
  | "formatDateTime"
  | "formatIngestRunStatusLabel"
  | "formatIngestRunTone"
  | "latestMarketIngestRun"
  | "marketTempTargets"
  | "snapshot"
>;

export function OtherDataManagementSourceSection(
  props: OtherDataManagementSourceSectionProps
) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [mainTokenSaving, setMainTokenSaving] = useState(false);
  const [domainTokenSaving, setDomainTokenSaving] = useState(false);
  const [testingKey, setTestingKey] = useState<string | null>(null);

  const [catalog, setCatalog] = useState<MarketDataSourceCatalog | null>(null);
  const [config, setConfig] = useState<MarketDataSourceConfigV2 | null>(null);
  const [savedConfig, setSavedConfig] = useState<MarketDataSourceConfigV2 | null>(null);
  const [tokenMatrix, setTokenMatrix] = useState<MarketTokenMatrixStatus | null>(null);
  const [tests, setTests] = useState<ConnectivityTestRecord[]>([]);
  const [readiness, setReadiness] = useState<DataSourceReadinessResult | null>(null);

  const [selectedDomainId, setSelectedDomainId] = useState<DataDomainId | null>(null);
  const [expandedDomains, setExpandedDomains] = useState<Record<string, boolean>>({});

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [directoryPanelExpanded, setDirectoryPanelExpanded] = useState(true);

  const [mainTokenDraft, setMainTokenDraft] = useState("");
  const [domainTokenDraft, setDomainTokenDraft] = useState("");

  const [runtimeIncompatible, setRuntimeIncompatible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [configSavedFlash, setConfigSavedFlash] = useState(false);
  const configSavedFlashTimerRef = useRef<number | null>(null);

  const refreshAll = useCallback(async () => {
    if (!window.mytrader) return;
    const marketApi = window.mytrader.market as unknown;
    setLoading(true);
    try {
      if (!hasDataSourceCenterApi(marketApi)) {
        const message = buildRuntimeApiMissingMessage();
        setRuntimeIncompatible(true);
        setError(message);
        setNotice(null);
        setCatalog(null);
        setConfig(null);
        setSavedConfig(null);
        setTokenMatrix(null);
        setTests([]);
        setSelectedDomainId(null);
        setReadiness(buildRuntimeBlockedReadiness(message));
        return;
      }

      const [nextCatalog, nextConfig, nextMatrix, nextTests, nextReadiness] =
        await Promise.all([
          window.mytrader.market.getDataSourceCatalog(),
          window.mytrader.market.getDataSourceConfig(),
          window.mytrader.market.getTokenMatrixStatus(),
          window.mytrader.market.listConnectivityTests(),
          window.mytrader.market.validateDataSourceReadiness({ scope: "both" })
        ]);
      setCatalog(nextCatalog);
      setConfig(nextConfig);
      setSavedConfig(nextConfig);
      setTokenMatrix(nextMatrix);
      setTests(nextTests);
      setReadiness(nextReadiness);
      setRuntimeIncompatible(false);

      setExpandedDomains((prev) => {
        const next = { ...prev };
        for (const domain of nextCatalog.domains) {
          if (next[domain.id] === undefined) {
            next[domain.id] = domain.id === "stock" || domain.id === "etf";
          }
        }
        return next;
      });

      setSelectedDomainId((prev) => {
        if (prev && nextCatalog.domains.some((domain) => domain.id === prev)) {
          return prev;
        }
        return nextCatalog.domains[0]?.id ?? null;
      });
      setError(null);
    } catch (err) {
      const message = toErrorMessage(err);
      setError(message);
      setRuntimeIncompatible(isRuntimeApiMissingError(err));
      setReadiness(buildRuntimeBlockedReadiness(message));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshAll();
  }, [refreshAll]);

  useEffect(
    () => () => {
      if (configSavedFlashTimerRef.current !== null) {
        window.clearTimeout(configSavedFlashTimerRef.current);
      }
    },
    []
  );

  useEffect(() => {
    setDomainTokenDraft("");
  }, [selectedDomainId]);

  const testMap = useMemo(() => {
    const map = new Map<string, ConnectivityTestRecord>();
    tests.forEach((record) => {
      const key =
        record.scope === "domain"
          ? `domain:${record.domainId}`
          : `module:${record.domainId}:${record.moduleId ?? ""}`;
      map.set(key, record);
    });
    return map;
  }, [tests]);

  const selectedDomain = useMemo(
    () => catalog?.domains.find((domain) => domain.id === selectedDomainId) ?? null,
    [catalog?.domains, selectedDomainId]
  );

  const selectedDomainConfig =
    selectedDomainId && config ? config.domains[selectedDomainId] : null;

  const domainRows = useMemo(() => {
    if (!catalog || !config) return [];

    return catalog.domains
      .map((domain) => {
        const domainConfig = config.domains[domain.id];
        const domainTest = testMap.get(`domain:${domain.id}`) ?? null;
        const modules = domain.modules.filter((module) => {
          if (statusFilter === "syncable") {
            return module.implemented && module.syncCapable;
          }
          return true;
        });

        return {
          domain,
          domainConfig,
          domainTest,
          modules
        };
      })
      .filter((row) => row.modules.length > 0);
  }, [catalog, config, statusFilter, testMap]);

  const configDirty = useMemo(() => {
    if (!config || !savedConfig) return false;
    return JSON.stringify(config) !== JSON.stringify(savedConfig);
  }, [config, savedConfig]);

  const readinessIssues = readiness?.issues ?? [];
  const readinessErrors = readinessIssues.filter((issue) => issue.level === "error");
  const hasReadiness = Boolean(readiness);

  const setMainProvider = useCallback(
    (value: string) => {
      setConfig((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          mainProvider: value
        };
      });
    },
    []
  );

  const applyMainProviderToDomains = useCallback(() => {
    setConfig((prev) => {
      if (!prev) return prev;
      const nextDomains = Object.fromEntries(
        Object.entries(prev.domains).map(([domainId, domain]) => [
          domainId,
          {
            ...domain,
            provider: prev.mainProvider
          }
        ])
      ) as MarketDataSourceConfigV2["domains"];
      return {
        ...prev,
        domains: nextDomains
      };
    });
  }, []);

  const setDomainProvider = useCallback(
    (domainId: DataDomainId, provider: string) => {
      setConfig((prev) => {
        if (!prev) return prev;
        const current = prev.domains[domainId];
        if (!current) return prev;
        return {
          ...prev,
          domains: {
            ...prev.domains,
            [domainId]: {
              ...current,
              provider
            }
          }
        };
      });
    },
    []
  );

  const setDomainTokenMode = useCallback(
    (domainId: DataDomainId, tokenMode: "inherit_main" | "override") => {
      setConfig((prev) => {
        if (!prev) return prev;
        const current = prev.domains[domainId];
        if (!current) return prev;
        return {
          ...prev,
          domains: {
            ...prev.domains,
            [domainId]: {
              ...current,
              tokenMode
            }
          }
        };
      });
    },
    []
  );

  const expandAllDomains = useCallback(() => {
    if (!catalog) return;
    setExpandedDomains(
      Object.fromEntries(catalog.domains.map((domain) => [domain.id, true]))
    );
  }, [catalog]);

  const collapseAllDomains = useCallback(() => {
    if (!catalog) return;
    setExpandedDomains(
      Object.fromEntries(catalog.domains.map((domain) => [domain.id, false]))
    );
  }, [catalog]);

  const handleOpenProviderHomepage = useCallback(async () => {
    if (!window.mytrader || !config) return;
    setError(null);
    setNotice(null);
    try {
      await window.mytrader.market.openProviderHomepage({
        provider: config.mainProvider
      });
    } catch (err) {
      setError(toErrorMessage(err));
    }
  }, [config]);

  const handleSaveConfig = useCallback(async () => {
    if (!window.mytrader || !config) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const saved = await window.mytrader.market.setDataSourceConfig(config);
      setConfig(saved);
      setSavedConfig(saved);
      const [nextTests, nextReadiness] = await Promise.all([
        window.mytrader.market.listConnectivityTests(),
        window.mytrader.market.validateDataSourceReadiness({ scope: "both" })
      ]);
      setTests(nextTests);
      setReadiness(nextReadiness);
      if (configSavedFlashTimerRef.current !== null) {
        window.clearTimeout(configSavedFlashTimerRef.current);
      }
      setConfigSavedFlash(true);
      configSavedFlashTimerRef.current = window.setTimeout(() => {
        setConfigSavedFlash(false);
        configSavedFlashTimerRef.current = null;
      }, 1000);
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }, [config]);

  const handleSaveMainToken = useCallback(async () => {
    if (!window.mytrader) return;
    setMainTokenSaving(true);
    setError(null);
    setNotice(null);
    try {
      const token = mainTokenDraft.trim();
      const matrix = await window.mytrader.market.setMainToken({
        token: token ? token : null
      });
      setTokenMatrix(matrix);
      setMainTokenDraft("");
      const [nextTests, nextReadiness] = await Promise.all([
        window.mytrader.market.listConnectivityTests(),
        window.mytrader.market.validateDataSourceReadiness({ scope: "both" })
      ]);
      setTests(nextTests);
      setReadiness(nextReadiness);
      setNotice(token ? "主令牌已保存。" : "主令牌已清除。");
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setMainTokenSaving(false);
    }
  }, [mainTokenDraft]);

  const handleTestMainToken = useCallback(async () => {
    if (!window.mytrader) return;
    setMainTokenSaving(true);
    setError(null);
    setNotice(null);
    try {
      const token = mainTokenDraft.trim() || null;
      await window.mytrader.market.testToken({ token });
      setNotice("主令牌连接测试通过。");
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setMainTokenSaving(false);
    }
  }, [mainTokenDraft]);

  const handleSaveDomainToken = useCallback(
    async (domainId: DataDomainId) => {
      if (!window.mytrader) return;
      const token = domainTokenDraft.trim();
      if (!token) {
        setError("请输入域令牌后再保存，或使用“清除域令牌”。");
        setNotice(null);
        return;
      }

      setDomainTokenSaving(true);
      setError(null);
      setNotice(null);
      try {
        const matrix = await window.mytrader.market.setDomainToken({
          domainId,
          token
        });
        setTokenMatrix(matrix);
        setDomainTokenDraft("");
        const [nextTests, nextReadiness] = await Promise.all([
          window.mytrader.market.listConnectivityTests(),
          window.mytrader.market.validateDataSourceReadiness({ scope: "both" })
        ]);
        setTests(nextTests);
        setReadiness(nextReadiness);
        setNotice("域令牌已保存。");
      } catch (err) {
        setError(toErrorMessage(err));
      } finally {
        setDomainTokenSaving(false);
      }
    },
    [domainTokenDraft]
  );

  const handleClearDomainToken = useCallback(async (domainId: DataDomainId) => {
    if (!window.mytrader) return;
    setDomainTokenSaving(true);
    setError(null);
    setNotice(null);
    try {
      const matrix = await window.mytrader.market.clearDomainToken({ domainId });
      setTokenMatrix(matrix);
      setDomainTokenDraft("");
      const [nextTests, nextReadiness] = await Promise.all([
        window.mytrader.market.listConnectivityTests(),
        window.mytrader.market.validateDataSourceReadiness({ scope: "both" })
      ]);
      setTests(nextTests);
      setReadiness(nextReadiness);
      setNotice("域令牌已清除。");
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setDomainTokenSaving(false);
    }
  }, []);

  const handleTestDomain = useCallback(
    async (domainId: DataDomainId) => {
      if (!window.mytrader) return;
      setTestingKey(`domain:${domainId}`);
      setError(null);
      setNotice(null);
      try {
        await window.mytrader.market.testDomainConnectivity({ domainId });
        const [nextTests, nextReadiness] = await Promise.all([
          window.mytrader.market.listConnectivityTests(),
          window.mytrader.market.validateDataSourceReadiness({ scope: "both" })
        ]);
        setTests(nextTests);
        setReadiness(nextReadiness);
        setNotice("域级连通性测试完成。")
      } catch (err) {
        setError(toErrorMessage(err));
      } finally {
        setTestingKey(null);
      }
    },
    []
  );

  const handleTestModule = useCallback(
    async (domainId: DataDomainId, moduleId: string) => {
      if (!window.mytrader) return;
      setTestingKey(`module:${domainId}:${moduleId}`);
      setError(null);
      setNotice(null);
      try {
        await window.mytrader.market.testModuleConnectivity({ domainId, moduleId });
        const [nextTests, nextReadiness] = await Promise.all([
          window.mytrader.market.listConnectivityTests(),
          window.mytrader.market.validateDataSourceReadiness({ scope: "both" })
        ]);
        setTests(nextTests);
        setReadiness(nextReadiness);
        setNotice("模块连通性测试完成。")
      } catch (err) {
        setError(toErrorMessage(err));
      } finally {
        setTestingKey(null);
      }
    },
    []
  );

  const toggleDomainEnabled = useCallback(
    (domain: DataSourceDomainCatalogItem) => {
      setConfig((prev) => {
        if (!prev) return prev;
        const current = prev.domains[domain.id];
        const currentTest = testMap.get(`domain:${domain.id}`);
        const hasEnabledSyncModule = domain.modules.some(
          (module) =>
            module.implemented &&
            module.syncCapable &&
            Boolean(current.modules[module.id]?.enabled)
        );
        const canEnable =
          Boolean(currentTest) &&
          currentTest?.status === "pass" &&
          !currentTest?.stale &&
          hasEnabledSyncModule;

        if (!current.enabled && !canEnable) {
          return prev;
        }

        return {
          ...prev,
          domains: {
            ...prev.domains,
            [domain.id]: {
              ...current,
              enabled: !current.enabled
            }
          }
        };
      });
    },
    [testMap]
  );

  const toggleModuleEnabled = useCallback(
    (domainId: DataDomainId, module: DataSourceModuleCatalogItem) => {
      setConfig((prev) => {
        if (!prev) return prev;
        const domain = prev.domains[domainId];
        const currentEnabled = Boolean(domain.modules[module.id]?.enabled);

        if (!currentEnabled) {
          const moduleTest = testMap.get(`module:${domainId}:${module.id}`);
          const canEnable =
            module.implemented &&
            module.syncCapable &&
            moduleTest?.status === "pass" &&
            !moduleTest?.stale;
          if (!canEnable) {
            return prev;
          }
        }

        const nextModules = {
          ...domain.modules,
          [module.id]: {
            enabled: !currentEnabled
          }
        };

        const hasAnyEnabledModule = selectedDomain
          ? selectedDomain.modules.some((item) => Boolean(nextModules[item.id]?.enabled))
          : true;

        return {
          ...prev,
          domains: {
            ...prev.domains,
            [domainId]: {
              ...domain,
              modules: nextModules,
              enabled: hasAnyEnabledModule ? domain.enabled : false
            }
          }
        };
      });
    },
    [selectedDomain, testMap]
  );

  const providerOptions = useMemo(() => {
    return (
      catalog?.providers.map((provider) => ({
        value: provider.id,
        label:
          provider.status === "active"
            ? formatProviderLabel(provider.id)
            : `${formatProviderLabel(provider.id)}（规划中）`,
        disabled: provider.status !== "active"
      })) ?? []
    );
  }, [catalog?.providers]);

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
                同步域数量
              </div>
              <div className="mt-0.5 font-mono text-sm text-slate-900 dark:text-white">
                {readiness?.selectedDomains.length ?? 0}
              </div>
            </div>
            <div className="px-3 py-2">
              <div className="text-[10px] text-slate-500 dark:text-slate-400">
                同步模块数量
              </div>
              <div className="mt-0.5 font-mono text-sm text-slate-900 dark:text-white">
                {readiness?.selectedModules.length ?? 0}
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
            数据来源中心
          </h3>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {loading
              ? "加载中..."
              : runtimeIncompatible
                ? "就绪状态：运行时不兼容"
                : !hasReadiness
                  ? "就绪状态：待检查"
                : readiness?.ready
                  ? "就绪状态：已就绪"
                  : "就绪状态：存在阻断"}
          </div>
        </div>

        <div className="rounded-md border border-slate-200 dark:border-border-dark bg-white dark:bg-gradient-to-b dark:from-panel-dark dark:to-surface-dark p-3 space-y-3">
          <div className="space-y-2.5">
            <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_auto] gap-2 items-center">
              <div className="flex flex-wrap items-center gap-2">
                <props.PopoverSelect
                  value={config?.mainProvider ?? "tushare"}
                  onChangeValue={setMainProvider}
                  options={providerOptions}
                  disabled={!config || runtimeIncompatible}
                  className="w-[180px]"
                  buttonClassName="h-8"
                />
                <props.Button
                  variant="secondary"
                  size="sm"
                  icon="open_in_new"
                  onClick={handleOpenProviderHomepage}
                  disabled={!config || runtimeIncompatible}
                  className="min-w-[96px]"
                >
                  访问
                </props.Button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 xl:justify-items-end">
                <props.Button
                  variant="secondary"
                  size="sm"
                  icon="sync"
                  onClick={applyMainProviderToDomains}
                  disabled={!config || runtimeIncompatible}
                  className="w-full sm:w-[176px]"
                >
                  全数据领同步
                </props.Button>
                <props.Button
                  variant="primary"
                  size="sm"
                  icon="save"
                  onClick={handleSaveConfig}
                  disabled={!config || !configDirty || saving || runtimeIncompatible}
                  className="w-full sm:w-[176px]"
                >
                  保存变更
                </props.Button>
                {configDirty && (
                  <span className="sm:col-span-2 justify-self-end inline-flex items-center rounded-full px-2 py-1 text-[11px] bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                    有未保存变更
                  </span>
                )}
                {!configDirty && configSavedFlash && (
                  <span className="sm:col-span-2 justify-self-end inline-flex items-center rounded-full px-2 py-1 text-[11px] bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                    已保存
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_auto] gap-2 items-center">
              <props.Input
                type="password"
                value={mainTokenDraft}
                onChange={(event) => setMainTokenDraft(event.target.value)}
                placeholder="输入主令牌（应用于所有继承主令牌的数据域）"
                disabled={runtimeIncompatible}
                className="font-mono text-xs"
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 xl:justify-items-end">
                <props.Button
                  variant="secondary"
                  size="sm"
                  icon="check_circle"
                  onClick={handleTestMainToken}
                  disabled={mainTokenSaving || runtimeIncompatible}
                  className="w-full sm:w-[176px]"
                >
                  测试主令牌
                </props.Button>
                <props.Button
                  variant="secondary"
                  size="sm"
                  icon="save"
                  onClick={handleSaveMainToken}
                  disabled={mainTokenSaving || runtimeIncompatible}
                  className="w-full sm:w-[176px]"
                >
                  保存主令牌
                </props.Button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-slate-500 dark:text-slate-400">
              <div className="rounded bg-slate-50/70 dark:bg-background-dark/50 px-2.5 py-1.5">
                主令牌已配置：{tokenMatrix?.mainConfigured ? "是" : "否"}
              </div>
              <div className="rounded bg-slate-50/70 dark:bg-background-dark/50 px-2.5 py-1.5">
                域覆盖：{countDomainOverrides(tokenMatrix)}
              </div>
              <div className="rounded bg-slate-50/70 dark:bg-background-dark/50 px-2.5 py-1.5">
                待处理阻断：{readinessErrors.length}
              </div>
            </div>
          </div>

          {(error || notice) && (
            <div
              className={`rounded-md border px-3 py-2 text-xs ${
                error
                  ? "border-rose-300 text-rose-700 dark:text-rose-300"
                  : "border-emerald-300 text-emerald-700 dark:text-emerald-300"
              }`}
            >
              {error ?? notice}
            </div>
          )}

          <div className="flex justify-end">
            <props.Button
              variant="secondary"
              size="sm"
              icon={directoryPanelExpanded ? "expand_less" : "expand_more"}
              onClick={() => setDirectoryPanelExpanded((prev) => !prev)}
            >
              {directoryPanelExpanded ? "收起目录区域" : "展开目录区域"}
            </props.Button>
          </div>

          {directoryPanelExpanded ? (
            <>
              <div className="grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-3">
            <aside className="rounded-md p-2 space-y-2 bg-slate-50/45 dark:bg-background-dark/30">
              <div className="text-sm font-semibold text-slate-700 dark:text-slate-200 px-0.5">
                全量池目录
              </div>
              <div className="flex items-center gap-2">
                <props.PopoverSelect
                  value={statusFilter}
                  onChangeValue={(value) => setStatusFilter(value as StatusFilter)}
                  disabled={runtimeIncompatible}
                  options={[
                    { value: "all", label: "全部" },
                    { value: "syncable", label: "可同步" }
                  ]}
                  className="w-[130px]"
                  buttonClassName="h-8"
                />
                <button
                  type="button"
                  onClick={expandAllDomains}
                  disabled={runtimeIncompatible || !catalog}
                  title="全部展开"
                  aria-label="全部展开"
                  className="h-8 w-8 inline-flex items-center justify-center rounded-md border border-transparent bg-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="material-icons-outlined text-[18px]">unfold_more</span>
                </button>
                <button
                  type="button"
                  onClick={collapseAllDomains}
                  disabled={runtimeIncompatible || !catalog}
                  title="全部折叠"
                  aria-label="全部折叠"
                  className="h-8 w-8 inline-flex items-center justify-center rounded-md border border-transparent bg-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="material-icons-outlined text-[18px]">unfold_less</span>
                </button>
              </div>

              <div className="max-h-[560px] overflow-auto space-y-1 pr-1">
                {domainRows.map(({ domain, domainConfig, domainTest, modules }) => {
                  const expanded = Boolean(expandedDomains[domain.id]);
                  const domainSelected = selectedDomainId === domain.id;
                  return (
                    <div key={domain.id} className="rounded-md bg-white/80 dark:bg-surface-dark/45 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.18)]">
                      <button
                        type="button"
                        disabled={runtimeIncompatible}
                        className={`w-full px-2 py-1.5 flex items-center justify-between text-left ${
                          domainSelected
                            ? "bg-primary/10"
                            : "bg-slate-50/60 dark:bg-background-dark/40"
                        }`}
                        onClick={() => {
                          setSelectedDomainId(domain.id);
                          setExpandedDomains((prev) => ({
                            ...prev,
                            [domain.id]: !expanded
                          }));
                        }}
                      >
                        <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                          {domain.label}
                        </span>
                        <span className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-500 dark:text-slate-400">
                            {domainConfig?.enabled ? "纳入同步" : "未纳入"}
                          </span>
                          <span
                            className={`inline-flex h-5 items-center rounded-full px-2 text-[10px] border ${getTestPillClass(
                              domainTest
                            )}`}
                          >
                            {formatTestStatus(domainTest)}
                          </span>
                        </span>
                      </button>

                      {expanded && (
                        <div className="px-2 py-1.5 space-y-1">
                          {modules.map((module) => {
                            const moduleEnabled = Boolean(
                              domainConfig?.modules[module.id]?.enabled
                            );
                            const moduleTest = testMap.get(
                              `module:${domain.id}:${module.id}`
                            );
                            return (
                              <button
                                key={module.id}
                                type="button"
                                disabled={runtimeIncompatible}
                                onClick={() => setSelectedDomainId(domain.id)}
                                className="w-full rounded px-2 py-1 grid grid-cols-[minmax(0,1fr)_190px] items-center gap-2 hover:bg-slate-100 dark:hover:bg-background-dark/70"
                              >
                                <span className="text-xs text-slate-700 dark:text-slate-200 truncate text-left">
                                  {module.label}
                                </span>
                                <span className="grid grid-cols-2 gap-1 w-[190px] justify-self-end">
                                  <span
                                    className={`inline-flex items-center justify-center rounded-full px-2 py-0.5 text-[10px] border whitespace-nowrap ${
                                      module.implemented && module.syncCapable
                                        ? "border-emerald-300 text-emerald-700 dark:text-emerald-300"
                                        : "border-slate-300 text-slate-500 dark:border-border-dark dark:text-slate-400"
                                    }`}
                                  >
                                    {module.implemented && module.syncCapable
                                      ? moduleEnabled
                                        ? "纳入"
                                        : "未纳入"
                                      : "未接入"}
                                  </span>
                                  <span
                                    className={`inline-flex items-center justify-center rounded-full px-2 py-0.5 text-[10px] border whitespace-nowrap ${getTestPillClass(
                                      moduleTest
                                    )}`}
                                  >
                                    {formatTestStatus(moduleTest)}
                                  </span>
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
                {domainRows.length === 0 && (
                  <div className="text-xs text-slate-500 dark:text-slate-400 px-1 py-2">
                    {runtimeIncompatible
                      ? "当前运行时不支持数据来源中心，请重启应用后重试。"
                      : !catalog
                        ? "目录加载失败，请检查运行时版本并重试。"
                        : "无匹配项。"}
                  </div>
                )}
              </div>
            </aside>

            <section className="rounded-md p-3 space-y-3 bg-slate-50/45 dark:bg-background-dark/30">
              {runtimeIncompatible ? (
                <div className="text-sm text-slate-500 dark:text-slate-400">
                  当前应用进程尚未加载数据来源中心所需接口。请重启应用；若仍失败，请更新到最新版本后再试。
                </div>
              ) : !selectedDomain || !selectedDomainConfig ? (
                <div className="text-sm text-slate-500 dark:text-slate-400">请选择左侧数据域。</div>
              ) : (
                <>
                  <div className="text-xl font-semibold text-slate-900 dark:text-white">
                    {selectedDomain.label}
                  </div>

                  <div className="rounded-md bg-white dark:bg-surface-dark/55 p-3 space-y-3 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.12)]">
                    <div className="text-lg font-semibold text-slate-900 dark:text-white">
                      一级配置
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-3 xl:items-end">
                      <div className="space-y-1">
                        <div className="text-xs text-slate-500 dark:text-slate-400">数据源</div>
                        <props.PopoverSelect
                          value={selectedDomainConfig.provider}
                          onChangeValue={(value) =>
                            setDomainProvider(selectedDomain.id, value)
                          }
                          options={providerOptions}
                          disabled={runtimeIncompatible}
                          className="w-full"
                          buttonClassName="h-10"
                        />
                      </div>

                      <div className="space-y-1">
                        <div className="text-xs text-slate-500 dark:text-slate-400">令牌模式</div>
                        <props.PopoverSelect
                          value={selectedDomainConfig.tokenMode}
                          onChangeValue={(value) =>
                            setDomainTokenMode(
                              selectedDomain.id,
                              value === "override" ? "override" : "inherit_main"
                            )
                          }
                          options={[
                            { value: "inherit_main", label: "继承主令牌" },
                            { value: "override", label: "域级覆盖" }
                          ]}
                          disabled={runtimeIncompatible}
                          className="w-full"
                          buttonClassName="h-10"
                        />
                      </div>

                      <div className="flex items-center gap-2 xl:justify-end">
                        <props.Button
                          variant="secondary"
                          size="sm"
                          icon="check_circle"
                          onClick={() => void handleTestDomain(selectedDomain.id)}
                          disabled={
                            runtimeIncompatible ||
                            testingKey === `domain:${selectedDomain.id}`
                          }
                        >
                          测试域连通性
                        </props.Button>
                        <props.Button
                          variant={selectedDomainConfig.enabled ? "danger" : "primary"}
                          size="sm"
                          icon={
                            selectedDomainConfig.enabled ? "pause_circle" : "play_circle"
                          }
                          onClick={() => toggleDomainEnabled(selectedDomain)}
                          disabled={
                            runtimeIncompatible ||
                            (!selectedDomainConfig.enabled &&
                              !canEnableDomain(
                                selectedDomain,
                                selectedDomainConfig,
                                testMap
                              ))
                          }
                        >
                          {selectedDomainConfig.enabled ? "停用域同步" : "纳入域同步"}
                        </props.Button>
                      </div>
                    </div>

                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      当前令牌来源：
                      {formatDomainTokenSource(
                        tokenMatrix?.domains[selectedDomain.id]?.source
                      )}
                    </div>

                    {selectedDomainConfig.tokenMode === "override" && (
                      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_auto_auto] gap-2">
                        <props.Input
                          type="password"
                          value={domainTokenDraft}
                          onChange={(event) => setDomainTokenDraft(event.target.value)}
                          placeholder={`输入${selectedDomain.label}专用令牌（可选）`}
                          disabled={runtimeIncompatible || domainTokenSaving}
                          className="font-mono text-xs"
                        />
                        <props.Button
                          variant="secondary"
                          size="sm"
                          icon="save"
                          onClick={() => void handleSaveDomainToken(selectedDomain.id)}
                          disabled={
                            runtimeIncompatible ||
                            domainTokenSaving ||
                            !domainTokenDraft.trim()
                          }
                        >
                          保存域令牌
                        </props.Button>
                        <props.Button
                          variant="secondary"
                          size="sm"
                          icon="delete"
                          onClick={() => void handleClearDomainToken(selectedDomain.id)}
                          disabled={runtimeIncompatible || domainTokenSaving}
                        >
                          清除域令牌
                        </props.Button>
                      </div>
                    )}
                  </div>

                  <div className="rounded-md bg-white dark:bg-surface-dark/55 p-3 space-y-2 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.12)]">
                    <div className="text-lg font-semibold text-slate-900 dark:text-white">
                      二级配置
                    </div>
                    <div className="hidden xl:grid xl:grid-cols-[minmax(0,1.1fr)_120px_minmax(0,1fr)_auto] gap-3 px-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
                      <div>模块</div>
                      <div>状态</div>
                      <div>连通性</div>
                      <div className="text-right">操作</div>
                    </div>
                    {selectedDomain.modules.map((module) => {
                      const moduleEnabled = Boolean(
                        selectedDomainConfig.modules[module.id]?.enabled
                      );
                      const moduleTest = testMap.get(
                        `module:${selectedDomain.id}:${module.id}`
                      );
                      const canEnable = canEnableModule(
                        selectedDomain.id,
                        module,
                        testMap
                      );
                      const disableReason = moduleEnabled
                        ? null
                        : getModuleDisableReason(
                            selectedDomain.id,
                            module,
                            testMap
                          );
                      return (
                        <div
                          key={module.id}
                          className="rounded-md bg-slate-50/60 dark:bg-background-dark/35 p-3 grid grid-cols-1 xl:grid-cols-[minmax(0,1.1fr)_120px_minmax(0,1fr)_auto] gap-3 xl:items-center shadow-[inset_0_0_0_1px_rgba(148,163,184,0.12)]"
                        >
                          <div className="font-medium text-slate-800 dark:text-slate-100">
                            {module.label}
                          </div>
                          <div>
                            <span
                              className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] ${
                                module.implemented && module.syncCapable
                                  ? "border-emerald-300 text-emerald-700 dark:text-emerald-300"
                                  : "border-slate-300 text-slate-500 dark:border-border-dark dark:text-slate-400"
                              }`}
                            >
                              {module.implemented && module.syncCapable
                                ? "已接入"
                                : "规划中"}
                            </span>
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span
                                className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] ${getTestPillClass(
                                  moduleTest
                                )}`}
                              >
                                {formatTestStatus(moduleTest)}
                              </span>
                              {moduleTest?.message && (
                                <span className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1">
                                  {moduleTest.message}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="xl:text-right">
                            <div className="inline-flex items-center gap-2">
                              <props.Button
                                variant="secondary"
                                size="sm"
                                icon="check_circle"
                                onClick={() =>
                                  void handleTestModule(selectedDomain.id, module.id)
                                }
                                disabled={
                                  runtimeIncompatible ||
                                  testingKey ===
                                    `module:${selectedDomain.id}:${module.id}` ||
                                  (!module.implemented || !module.syncCapable)
                                }
                              >
                                测试
                              </props.Button>
                              <props.Button
                                variant={moduleEnabled ? "danger" : "primary"}
                                size="sm"
                                icon={moduleEnabled ? "pause_circle" : "play_circle"}
                                onClick={() =>
                                  toggleModuleEnabled(selectedDomain.id, module)
                                }
                                disabled={
                                  runtimeIncompatible ||
                                  (!moduleEnabled && !canEnable)
                                }
                              >
                                {moduleEnabled ? "移出同步" : "纳入同步"}
                              </props.Button>
                            </div>
                            {disableReason && (
                              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                                {disableReason}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </section>
              </div>

              <div className="rounded-md border border-slate-200 dark:border-border-dark p-2.5 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                    就绪检查摘要
                  </div>
                  <div
                    className={`text-xs ${
                      !hasReadiness
                        ? "text-slate-500 dark:text-slate-400"
                        : readiness?.ready
                        ? "text-emerald-600 dark:text-emerald-300"
                        : "text-rose-600 dark:text-rose-300"
                    }`}
                  >
                    {!hasReadiness ? "待检查" : readiness?.ready ? "可执行" : "存在阻断"}
                  </div>
                </div>

                {!hasReadiness && (
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    尚未获取就绪检查结果，请刷新页面或重启应用后重试。
                  </div>
                )}

                {hasReadiness && readinessIssues.length === 0 && (
                  <div className="text-xs text-slate-500 dark:text-slate-400">暂无阻断项。</div>
                )}

                {hasReadiness && readinessIssues.length > 0 && (
                  <div className="max-h-40 overflow-auto space-y-1">
                    {readinessIssues.slice(0, 20).map((issue, index) => (
                      <div
                        key={`${issue.code}-${issue.domainId ?? "global"}-${issue.moduleId ?? "none"}-${index}`}
                        className={`text-xs ${
                          issue.level === "error"
                            ? "text-rose-700 dark:text-rose-300"
                            : "text-amber-700 dark:text-amber-300"
                        }`}
                      >
                        {index + 1}. {issue.message}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="rounded-md px-2 py-1.5 text-xs text-slate-500 dark:text-slate-400">
              一二级目录区域已收起。
            </div>
          )}
        </div>
      </section>
    </>
  );
}

function canEnableDomain(
  domain: DataSourceDomainCatalogItem,
  domainConfig: MarketDataSourceConfigV2["domains"][DataDomainId],
  testMap: Map<string, ConnectivityTestRecord>
): boolean {
  const domainTest = testMap.get(`domain:${domain.id}`);
  if (!domainTest || domainTest.status !== "pass" || domainTest.stale) {
    return false;
  }

  return domain.modules.some(
    (module) =>
      module.implemented &&
      module.syncCapable &&
      Boolean(domainConfig.modules[module.id]?.enabled)
  );
}

function canEnableModule(
  domainId: DataDomainId,
  module: DataSourceModuleCatalogItem,
  testMap: Map<string, ConnectivityTestRecord>
): boolean {
  if (!module.implemented || !module.syncCapable) {
    return false;
  }
  const test = testMap.get(`module:${domainId}:${module.id}`);
  return Boolean(test && test.status === "pass" && !test.stale);
}

function getModuleDisableReason(
  domainId: DataDomainId,
  module: DataSourceModuleCatalogItem,
  testMap: Map<string, ConnectivityTestRecord>
): string | null {
  if (!module.implemented || !module.syncCapable) {
    return "该模块尚未接入，当前不可纳入同步。";
  }
  const test = testMap.get(`module:${domainId}:${module.id}`);
  if (!test || test.status === "untested") {
    return "请先完成模块连通性测试。";
  }
  if (test.status === "fail") {
    return "连通性测试失败，请修复后再启用。";
  }
  if (test.stale) {
    return "测试结果已过期，请重新测试。";
  }
  return null;
}

function formatTestStatus(record: ConnectivityTestRecord | null | undefined): string {
  if (!record) return "未测试";
  if (record.status === "pass") return record.stale ? "已过期" : "测试通过";
  if (record.status === "fail") return "测试失败";
  if (record.status === "unsupported") return "不可测试";
  return "未测试";
}

function getTestPillClass(record: ConnectivityTestRecord | null | undefined): string {
  if (!record) return "border-slate-300 text-slate-500 dark:border-border-dark dark:text-slate-400";
  if (record.status === "pass" && !record.stale) {
    return "border-emerald-300 text-emerald-700 dark:text-emerald-300";
  }
  if (record.status === "pass" && record.stale) {
    return "border-amber-300 text-amber-700 dark:text-amber-300";
  }
  if (record.status === "fail") {
    return "border-rose-300 text-rose-700 dark:text-rose-300";
  }
  if (record.status === "unsupported") {
    return "border-slate-300 text-slate-500 dark:border-border-dark dark:text-slate-400";
  }
  return "border-slate-300 text-slate-500 dark:border-border-dark dark:text-slate-400";
}

function formatDomainTokenSource(source: string | undefined): string {
  if (source === "domain_override") return "域覆盖令牌";
  if (source === "main") return "主令牌";
  if (source === "env_fallback") return "环境变量兜底";
  return "未配置";
}

function countDomainOverrides(matrix: MarketTokenMatrixStatus | null): number {
  if (!matrix) return 0;
  return Object.values(matrix.domains).filter((item) => item.source === "domain_override").length;
}

function formatProviderLabel(providerId: string): string {
  if (!providerId.trim()) return "unknown";
  return providerId;
}

function hasDataSourceCenterApi(marketApi: unknown): boolean {
  if (!marketApi || typeof marketApi !== "object") return false;
  const api = marketApi as Record<string, unknown>;
  const required = [
    "getDataSourceCatalog",
    "getDataSourceConfig",
    "setDataSourceConfig",
    "getTokenMatrixStatus",
    "setMainToken",
    "setDomainToken",
    "clearDomainToken",
    "testDomainConnectivity",
    "testModuleConnectivity",
    "listConnectivityTests",
    "validateDataSourceReadiness"
  ];
  return required.every((name) => typeof api[name] === "function");
}

function buildRuntimeApiMissingMessage(): string {
  return "当前应用运行时不支持“数据来源中心”接口，请重启应用后重试。若仍失败，请更新到最新版本。";
}

function isRuntimeApiMissingError(error: unknown): boolean {
  const message =
    error instanceof Error ? error.message : String(error ?? "");
  const apiMethodNames = [
    "getDataSourceCatalog",
    "getDataSourceConfig",
    "setDataSourceConfig",
    "getTokenMatrixStatus",
    "setMainToken",
    "setDomainToken",
    "clearDomainToken",
    "testDomainConnectivity",
    "testModuleConnectivity",
    "listConnectivityTests",
    "validateDataSourceReadiness"
  ];
  return (
    message.includes("window.mytrader.market.") ||
    (message.includes("is not a function") &&
      apiMethodNames.some((method) => message.includes(method)))
  );
}

function buildRuntimeBlockedReadiness(
  message: string
): DataSourceReadinessResult {
  return {
    ready: false,
    selectedDomains: [],
    selectedModules: [],
    issues: [
      {
        level: "error",
        code: "RUNTIME_API_MISSING",
        message,
        domainId: null,
        moduleId: null
      }
    ],
    updatedAt: Date.now()
  };
}

function toErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  const message = raw.trim();
  if (!message) {
    return "请求失败，请稍后重试。";
  }
  if (isRuntimeApiMissingError(error)) {
    return buildRuntimeApiMissingMessage();
  }
  return message;
}
